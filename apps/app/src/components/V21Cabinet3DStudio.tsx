import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Cabinet } from "../model/cabinet";
import { constructionOf } from "../model/construction";
import type { Settings } from "../model/settings";
import type { KitchenStyle } from "../model/layout";
import { buildCabinetSolo, moveFront, tagOpenFronts } from "../three/kitchen3d";
import { V21BlueprintEditor } from "./V21BlueprintEditor";
import { DimSlider, GlyphD } from "./DimControls";
import { FillEditor, FILL_TOOLS, ToolIcon, type Tool } from "./FillEditor";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { cabDepth, D_MIN, D_MAX } from "../model/bands";
import { IconUndo, IconRedo, IconLines } from "./icons";

/** Neutral fallback finish for the isolated studio when the caller supplies no kitchen style. */
const DEFAULT_SOLO_STYLE: KitchenStyle = { carcass: 0xeeece6, facade: 0xc8a878, worktop: 0xd8d8d8, handle: 0x8e9499, glassUppers: false };

/** Build the isolated cabinet mesh — one place so the mount + rebuild effects can't diverge.
 *  «2D Чертеж» still needs a 3D mesh behind the SVG overlay, so it maps to the solid 3D build. */
function makeSoloMesh(cab: Cabinet, viewMode: "3d" | "2d" | "outline", style: KitchenStyle | undefined, settings?: Settings): THREE.Group {
  return buildCabinetSolo(cab, style ?? DEFAULT_SOLO_STYLE, {
    outline: viewMode === "outline",
    hardwareOpts: { family: settings?.jointFamily, setbackMm: settings?.jointSetbackMm },
  });
}

/** Free a built group's geometries + materials — the studio makes a fresh mesh on every edit. */
function disposeGroup(g: THREE.Object3D): void {
  g.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

/** ─── Interactive 2D Technical Vector CAD Drawing (Bazis / GOST) ─── */
type Projection2D = "front" | "side" | "top";

function V21Technical2DCADDrawing({ cab, settings }: { cab: Cabinet; settings?: Settings }) {
  const [proj, setProj] = useState<Projection2D>("front");

  // Zoom & pan state
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const lastTouchDist = useRef<number | null>(null);

  // Touch/mouse handlers for pan
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx / zoom, y: dragRef.current.panY + dy / zoom });
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Wheel zoom (fast)
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(8, Math.max(0.2, z * (1 - e.deltaY * 0.003))));
  };

  // Pinch zoom (touch) — amplified for fast response
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastTouchDist.current !== null) {
        const rawScale = dist / lastTouchDist.current;
        // Amplify: small finger movements → bigger zoom steps
        const amplified = rawScale > 1 ? Math.pow(rawScale, 2.2) : 1 / Math.pow(1 / rawScale, 2.2);
        setZoom((z) => Math.min(8, Math.max(0.2, z * amplified)));
      }
      lastTouchDist.current = dist;
    }
  };
  const onTouchEnd = () => { lastTouchDist.current = null; };

  // Measurements
  const w = cab.w;
  const h = cab.h;
  const d = cab.depth ?? 560;
  // effective build = the shop standard with this module's overrides on top (model/construction.ts)
  const con = constructionOf(cab);
  const t = con.boardThickness;
  const plinthH = con.plinthMode === "box" ? 120 : con.plinthMode === "legs" ? 100 : 0;
  const count = cab.count ?? 0;
  const hasBack = con.backMount !== "none";
  const isGroove = con.backMount === "groove";
  const grooveOff = con.grooveSetback;

  const INK = "#1c1b18";
  const FILL = "#ececec";
  const BLUE = "#2f6fe4";
  const GREY = "#8d8778";
  const HDF = "#e0dbcd";
  const HATCH = "#d8d3c5";

  // Shared dimension arrow helper
  const DimLine = ({ x1, y1, x2, y2, label, offset = 0 }: { x1: number; y1: number; x2: number; y2: number; label: string; offset?: number }) => {
    const isVert = x1 === x2;
    const mx = (x1 + x2) / 2 + (isVert ? -14 - offset : 0);
    const my = (y1 + y2) / 2 + (isVert ? 0 : -6 - offset);
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLUE} strokeWidth="1" />
        {/* tick marks */}
        {isVert ? (
          <>
            <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} stroke={BLUE} strokeWidth="1.5" />
            <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} stroke={BLUE} strokeWidth="1.5" />
          </>
        ) : (
          <>
            <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke={BLUE} strokeWidth="1.5" />
            <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} stroke={BLUE} strokeWidth="1.5" />
          </>
        )}
        <text
          x={mx} y={my}
          fontSize="11" fontWeight="700" fill={BLUE}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={isVert ? `rotate(-90 ${mx} ${my})` : undefined}
        >{label}</text>
      </g>
    );
  };

  // Scale factor so the drawing fills ~280px drawing area regardless of real mm dims
  const drawW = 260;
  const drawH = 240;

  // ─── Render one projection ───────────────────────────────
  const renderProjection = () => {
    if (proj === "front") {
      // Front elevation: width × height
      const sx = drawW / w;
      const sy = drawH / h;
      const s = Math.min(sx, sy) * 0.92;
      const pw = w * s;
      const ph = h * s;
      const ox = (drawW - pw) / 2 + 30;
      const oy = (drawH - ph) / 2 + 30;
      const bT = t * s;
      const plH = plinthH * s;

      return (
        <g>
          <text x={ox + pw / 2} y={14} fontSize="12" fontWeight="700" fill={INK} textAnchor="middle">ВИД СПЕРЕДИ (Фасад)</text>
          {/* Overall dims */}
          <DimLine x1={ox} y1={oy - 2} x2={ox + pw} y2={oy - 2} label={`${w}`} />
          <DimLine x1={ox - 2} y1={oy} x2={ox - 2} y2={oy + ph} label={`${h}`} />

          {/* Plinth */}
          {plinthH > 0 && <rect x={ox + bT} y={oy + ph - plH} width={pw - 2 * bT} height={plH} fill="#4a4740" stroke={INK} strokeWidth="1.2" />}

          {/* Left side */}
          <rect x={ox} y={oy} width={bT} height={ph - plH} fill={FILL} stroke={INK} strokeWidth="1.3" />
          {/* Right side */}
          <rect x={ox + pw - bT} y={oy} width={bT} height={ph - plH} fill={FILL} stroke={INK} strokeWidth="1.3" />

          {/* Bottom */}
          <rect x={ox + (cab.bottomMode === "vkladnoe" ? bT : 0)} y={oy + ph - plH - bT} width={pw - (cab.bottomMode === "vkladnoe" ? 2 * bT : 0)} height={bT} fill={FILL} stroke={INK} strokeWidth="1.3" />

          {/* Top */}
          {cab.topMode !== "none" && (
            <rect x={ox + bT} y={oy} width={pw - 2 * bT} height={bT} fill={FILL} stroke={INK} strokeWidth="1.3" />
          )}

          {/* Shelves + bore marks */}
          {count > 0 && Array.from({ length: count }).map((_, i) => {
            const innerH = ph - plH - 2 * bT;
            const sy2 = oy + bT + innerH * (i + 1) / (count + 1);
            return (
              <g key={i}>
                <rect x={ox + bT} y={sy2 - bT / 2} width={pw - 2 * bT} height={bT} fill={FILL} stroke={INK} strokeWidth="1" />
                {/* bore crosses */}
                <circle cx={ox + bT / 2} cy={sy2} r={2.5} fill="none" stroke={BLUE} strokeWidth="1.2" />
                <line x1={ox + bT / 2 - 4} y1={sy2} x2={ox + bT / 2 + 4} y2={sy2} stroke={BLUE} strokeWidth="0.8" />
                <line x1={ox + bT / 2} y1={sy2 - 4} x2={ox + bT / 2} y2={sy2 + 4} stroke={BLUE} strokeWidth="0.8" />
                <circle cx={ox + pw - bT / 2} cy={sy2} r={2.5} fill="none" stroke={BLUE} strokeWidth="1.2" />
                <line x1={ox + pw - bT / 2 - 4} y1={sy2} x2={ox + pw - bT / 2 + 4} y2={sy2} stroke={BLUE} strokeWidth="0.8" />
                <line x1={ox + pw - bT / 2} y1={sy2 - 4} x2={ox + pw - bT / 2} y2={sy2 + 4} stroke={BLUE} strokeWidth="0.8" />
              </g>
            );
          })}

          <text x={ox + pw / 2} y={oy + ph + 22} fontSize="10" fill={GREY} textAnchor="middle">ЛДСП {t} мм · Фасад · K1 торцы</text>
        </g>
      );
    }

    if (proj === "side") {
      // Side cross-section: depth × height
      const sx = drawW / d;
      const sy = drawH / h;
      const s = Math.min(sx, sy) * 0.92;
      const pd = d * s;
      const ph = h * s;
      const ox = (drawW - pd) / 2 + 30;
      const oy = (drawH - ph) / 2 + 30;
      const bT = t * s;
      const plH = plinthH * s;
      const gOff = grooveOff * s;

      return (
        <g>
          <text x={ox + pd / 2} y={14} fontSize="12" fontWeight="700" fill={INK} textAnchor="middle">РАЗРЕЗ СБОКУ (Паз / Задник)</text>
          <DimLine x1={ox} y1={oy - 2} x2={ox + pd} y2={oy - 2} label={`${d}`} />
          <DimLine x1={ox - 2} y1={oy} x2={ox - 2} y2={oy + ph} label={`${h}`} />

          {/* Side outline */}
          <rect x={ox} y={oy} width={pd} height={ph - plH} fill={FILL} stroke={INK} strokeWidth="1.3" />

          {/* Back panel */}
          {hasBack && (
            isGroove ? (
              <>
                <rect x={ox + pd - gOff} y={oy} width={Math.max(3, bT * 0.2)} height={ph - plH} fill={HDF} stroke={INK} strokeWidth="1" />
                <line x1={ox + pd - gOff} y1={oy - 6} x2={ox + pd - gOff} y2={oy + ph - plH + 6} stroke={BLUE} strokeWidth="0.8" strokeDasharray="3 2" />
                <DimLine x1={ox + pd - gOff} y1={oy + ph - plH + 10} x2={ox + pd} y2={oy + ph - plH + 10} label={`${grooveOff}`} />
              </>
            ) : (
              <rect x={ox + pd} y={oy} width={bT} height={ph - plH} fill={HDF} stroke={INK} strokeWidth="1.3" />
            )
          )}

          {/* Shelf lines */}
          {count > 0 && Array.from({ length: count }).map((_, i) => {
            const innerH = ph - plH - 2 * bT;
            const sy2 = oy + bT + innerH * (i + 1) / (count + 1);
            const shelfEnd = isGroove ? ox + pd - gOff - 2 : ox + pd - 2;
            return <line key={i} x1={ox + 2} y1={sy2} x2={shelfEnd} y2={sy2} stroke={INK} strokeWidth="1.5" />;
          })}

          {/* Hinge cups */}
          <circle cx={ox + bT + 6} cy={oy + 20} r={5} fill="none" stroke={BLUE} strokeWidth="1.4" strokeDasharray="2 1.5" />
          <text x={ox + bT + 16} y={oy + 23} fontSize="9" fontWeight="700" fill={BLUE}>Ø35</text>
          <circle cx={ox + bT + 6} cy={oy + ph - plH - 20} r={5} fill="none" stroke={BLUE} strokeWidth="1.4" strokeDasharray="2 1.5" />

          {/* Plinth */}
          {plinthH > 0 && <rect x={ox + 2} y={oy + ph - plH} width={pd - 4} height={plH} fill="#4a4740" stroke={INK} strokeWidth="1" />}

          <text x={ox + pd / 2} y={oy + ph + 22} fontSize="10" fill={GREY} textAnchor="middle">
            {isGroove ? `Паз 4×8 · Отступ ${grooveOff} мм · ХДФ 3 мм` : "Внахлёст 16 мм ЛДСП"}
          </text>
        </g>
      );
    }

    // Top / plan view: width × depth
    const sx = drawW / w;
    const sy = drawH / d;
    const s = Math.min(sx, sy) * 0.92;
    const pw = w * s;
    const pd = d * s;
    const ox = (drawW - pw) / 2 + 30;
    const oy = (drawH - pd) / 2 + 30;
    const bT = t * s;
    const gOff = grooveOff * s;

    return (
      <g>
        <text x={ox + pw / 2} y={14} fontSize="12" fontWeight="700" fill={INK} textAnchor="middle">ВИД СВЕРХУ (План)</text>
        <DimLine x1={ox} y1={oy - 2} x2={ox + pw} y2={oy - 2} label={`${w}`} />
        <DimLine x1={ox - 2} y1={oy} x2={ox - 2} y2={oy + pd} label={`${d}`} />

        {/* Left side */}
        <rect x={ox} y={oy} width={bT} height={pd} fill={FILL} stroke={INK} strokeWidth="1.3" />
        {/* Right side */}
        <rect x={ox + pw - bT} y={oy} width={bT} height={pd} fill={FILL} stroke={INK} strokeWidth="1.3" />

        {/* Back panel */}
        {hasBack && (
          isGroove ? (
            <rect x={ox + bT} y={oy + pd - gOff} width={pw - 2 * bT} height={Math.max(2, bT * 0.2)} fill={HDF} stroke={INK} strokeWidth="1" />
          ) : (
            <rect x={ox} y={oy + pd} width={pw} height={bT} fill={HDF} stroke={INK} strokeWidth="1.3" />
          )
        )}

        {/* Top lid / stretchers */}
        {cab.topMode === "stretchers" ? (
          <>
            <rect x={ox + bT} y={oy} width={pw - 2 * bT} height={bT * 3} fill={FILL} stroke={INK} strokeWidth="1" />
            <rect x={ox + bT} y={oy + pd - bT * 3} width={pw - 2 * bT} height={bT * 3} fill={FILL} stroke={INK} strokeWidth="1" />
            <text x={ox + pw / 2} y={oy + bT * 2} fontSize="8" fill={GREY} textAnchor="middle">Царга</text>
          </>
        ) : cab.topMode !== "none" ? (
          <rect x={ox + bT} y={oy} width={pw - 2 * bT} height={pd} fill={HATCH} fillOpacity="0.3" stroke={INK} strokeWidth="0.6" strokeDasharray="4 2" />
        ) : null}

        {/* Hatch crosshatch fill for interior */}
        <text x={ox + pw / 2} y={oy + pd + 22} fontSize="10" fill={GREY} textAnchor="middle">Вид сверху · {w}×{d} мм</text>
      </g>
    );
  };

  // Button style helper
  const projBtn = (p: Projection2D, label: string) => (
    <button
      onClick={() => { setProj(p); setZoom(1); setPan({ x: 0, y: 0 }); }}
      style={{
        border: "none",
        background: proj === p ? "#2f6fe4" : "rgba(255,255,255,0.7)",
        color: proj === p ? "#fff" : "#333",
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
      }}
      type="button"
    >{label}</button>
  );

  return (
    <div
      style={{ width: "100%", height: "100%", background: "#faf8f5", position: "relative", overflow: "hidden", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 320 300"
        style={{ width: "100%", height: "100%", display: "block", transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: "center center" }}
      >
        {renderProjection()}
      </svg>

      {/* Projection switcher pills */}
      <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)", padding: 3, borderRadius: 8, border: "1px solid #ddd" }}>
        {projBtn("front", "Спереди")}
        {projBtn("side", "Сбоку")}
        {projBtn("top", "Сверху")}
      </div>

      {/* Zoom indicator */}
      <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 600, color: "#666", background: "rgba(255,255,255,0.8)", padding: "2px 6px", borderRadius: 4 }}>
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}


/** ─── Main Studio Component ───────────────────────────────── */
export function V21Cabinet3DStudio({
  cab,
  patchCab,
  onClose,
  settings,
  style,
}: {
  cab: Cabinet;
  patchCab: (patch: Partial<Cabinet>) => void;
  onClose: () => void;
  settings?: Settings;
  /** the kitchen-wide finish (colours) — falls back to a neutral default if the caller omits it */
  style?: KitchenStyle;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // ── TAP A DOOR, OPEN THAT DOOR ────────────────────────────────────────────────────────────────
  // Same gesture the room scene has. Refs, not state: the animation runs inside the render loop,
  // which is created once on mount and would otherwise close over a stale value.
  //   openRef   — which fronts the user has opened, by `openKey` (`<cabId>#n`, build order)
  //   amountRef — each front's CURRENT 0..1 position, so it eases instead of snapping
  // Both are keyed by the string, not the object, so the state survives the mesh rebuild that
  // every edit triggers — otherwise changing a shelf count would slam the open doors shut.
  const openRef = useRef<Set<string>>(new Set());
  const amountRef = useRef<Map<string, number>>(new Map());

  const [viewMode, setViewMode] = useState<"3d" | "2d" | "outline">("3d");
  // the active interior tool — OWNED here so the viewport rail and the 2D edit canvas share it
  const [tool, setTool] = useState<Tool>("draw");
  // the bottom-left «Глубина» button expands a depth slider to its right
  const [depthOpen, setDepthOpen] = useState(false);
  // set by the embedded 2D editor when a divider/cell/front is selected → shows the delete button
  const [hasSel, setHasSel] = useState(false);
  const deleteFnRef = useRef<(() => void) | null>(null); // the 2D editor's delete action, for our button
  const t = useT();

  // store wiring for the embedded interior editor — it patches cab.layout by index; the studio's
  // 3D rebuilds on every `cab` change, so edits here appear live in the view above.
  const cabs = useStore((s) => s.cabs);
  const storePatchCab = useStore((s) => s.patchCab);
  const storePatchCabLive = useStore((s) => s.patchCabLive);
  const patchCabDims = useStore((s) => s.patchCabDims);
  const beginCabEdit = useStore((s) => s.beginCabEdit);
  const undoCab = useStore((s) => s.undoCab);
  const redoCab = useStore((s) => s.redoCab);
  const canUndoCab = useStore((s) => s.cabsPast.length > 0);
  const canRedoCab = useStore((s) => s.cabsFuture.length > 0);
  const ceiling = useStore((s) => s.ceiling);
  const fillIndex = cabs.findIndex((c) => c.id === cab.id);

  // 1. Initialize Three.js scene ONCE on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 20);
    camera.position.set(1.4, 1.2, 2.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, cab.h / 2000, 0);
    controls.update();
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(3, 4, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);
    scene.add(new THREE.GridHelper(4, 20, 0x00ac7a, 0xcbd5e1));

    const initialMesh = makeSoloMesh(cab, "3d", style, settings);
    tagOpenFronts(initialMesh, cab.id);
    meshRef.current = initialMesh;
    scene.add(initialMesh);

    // TAP A DOOR OR DRAWER → it swings/slides open; tap it again → it shuts. Distinguished from an
    // ORBIT by distance: OrbitControls owns the drag, so anything that moved more than a few px was
    // the user turning the cabinet round, not touching a front.
    const downAt = { x: 0, y: 0, ok: false };
    const onDown = (e: PointerEvent) => {
      downAt.x = e.clientX;
      downAt.y = e.clientY;
      downAt.ok = true;
    };
    const raycaster = new THREE.Raycaster();
    const onUp = (e: PointerEvent) => {
      if (!downAt.ok) return;
      downAt.ok = false;
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return; // was an orbit
      const mesh = meshRef.current;
      if (!mesh) return;
      const r = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
        camera,
      );
      // walk up from whatever the ray struck to the nearest openable subgroup, so the drawer you
      // touched is the drawer that moves — not the whole bank
      for (const h of raycaster.intersectObjects(mesh.children, true)) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const key = o.userData.openKey as string | undefined;
          if (key) {
            if (openRef.current.has(key)) openRef.current.delete(key);
            else openRef.current.add(key);
            return;
          }
          o = o.parent;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      // ease every front toward its target. Applied unconditionally rather than only while moving,
      // so a freshly rebuilt mesh (born shut) is put back where the user left it on its first frame.
      const mesh = meshRef.current;
      if (mesh) {
        mesh.traverse((o) => {
          const key = o.userData.openKey as string | undefined;
          if (!key) return;
          const target = openRef.current.has(key) ? 1 : 0;
          const cur = amountRef.current.get(key) ?? 0;
          const next = Math.abs(target - cur) < 0.005 ? target : cur + (target - cur) * 0.18;
          amountRef.current.set(key, next);
          moveFront(o, next);
        });
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const rw = container.clientWidth;
      const rh = container.clientHeight;
      if (rw === 0 || rh === 0) return;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      if (meshRef.current) disposeGroup(meshRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Rebuild the mesh when the cabinet / view / finish / settings change — camera preserved.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (meshRef.current) {
      scene.remove(meshRef.current);
      disposeGroup(meshRef.current); // free the old build's geometries + materials
    }
    const newMesh = makeSoloMesh(cab, viewMode, style, settings);
    // re-issue the per-front keys: build order is deterministic, so «the second drawer is open»
    // still means the second drawer. The render loop eases it back open on the next frame.
    tagOpenFronts(newMesh, cab.id);
    meshRef.current = newMesh;
    scene.add(newMesh);
  }, [cab, viewMode, settings, style]);

  // 3. Bottom panel states:
  // - "collapsed": Panel minimized to 48px header at bottom -> 3D scene TAKES FULL SCREEN
  // - "normal": Default balanced view -> 3D scene takes 38vh, panel takes rest
  // - "expanded": Panel expanded UP -> panel takes majority of screen, 3D scene SHRINKS to 160px
  const [panelState, setPanelState] = useState<"collapsed" | "normal" | "expanded">("normal");

  // Use ResizeObserver to keep Three.js renderer in sync with the container size
  // at all times — during CSS transitions, panel toggles, and window resizes.
  useEffect(() => {
    const container = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!container || !renderer || !camera) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rw = entry.contentRect.width;
        const rh = entry.contentRect.height;
        if (rw > 0 && rh > 0) {
          camera.aspect = rw / rh;
          camera.updateProjectionMatrix();
          renderer.setSize(rw, rh);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Pull bottom panel UP (expands panel -> shrinks 3D scene)
  const expandPanelUp = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPanelState((prev) => (prev === "collapsed" ? "normal" : "expanded"));
  };

  // Push bottom panel DOWN (collapses panel -> enlarges 3D scene)
  const collapsePanelDown = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPanelState((prev) => (prev === "expanded" ? "normal" : "collapsed"));
  };

  const viewBtn = (mode: "3d" | "2d" | "outline", label: React.ReactNode) => (
    <button
      onClick={() => setViewMode(mode)}
      style={{
        border: "none",
        background: viewMode === mode ? "#00ac7a" : "transparent",
        color: viewMode === mode ? "#fff" : "#475569",
        width: 34,
        height: 34,
        padding: 0,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: viewMode === mode ? "0 2px 6px rgba(0,172,122,0.25)" : "none",
      }}
      type="button"
    >{label}</button>
  );

  return (
    <div className="v21-studio-overlay" style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0f172a", display: "flex", flexDirection: "column", fontFamily: "var(--sans, system-ui, sans-serif)" }}>
      {/* Top Header — light bar, black text; the green «Готово» is the only close affordance */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "#f9fafc", color: "#0f172a", flex: "none" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>Студия: {cab.w}×{cab.h}×{cab.depth ?? 560} мм</h2>
        <button onClick={onClose} style={{ border: "none", background: "#00ac7a", color: "#fff", padding: "8px 20px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,172,122,0.3)" }} type="button">Готово</button>
      </div>

      <div className="v21-studio-body" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Top Viewport — grows when panel is collapsed, shrinks when panel is expanded */}
        <div className="v21-studio-viewport" style={{
          flex: panelState === "collapsed" ? 1 : "none",
          height: panelState === "collapsed" ? undefined : panelState === "expanded" ? 160 : "38vh",
          minHeight: panelState === "collapsed" ? 0 : panelState === "expanded" ? 160 : undefined,
          width: "100%",
          position: "relative",
          background: "#f8fafc",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          {/* 3D canvas — ALWAYS mounted, just hidden when the 2D edit canvas is active */}
          <div
            ref={mountRef}
            style={{
              width: "100%",
              height: "100%",
              display: viewMode === "2d" ? "none" : "block",
              background: "#f8fafc",
            }}
          />

          {/* 2D editable interior canvas — the tools act HERE; the viewport rail (below) drives them,
              and every edit writes cab.layout so the 3D view reflects it the moment you switch back. */}
          {viewMode === "2d" && fillIndex >= 0 && (
            <div className="studio-fillwrap">
              <FillEditor
                embedded
                tool={tool}
                onToolChange={setTool}
                onSelChange={setHasSel}
                deleteRef={deleteFnRef}
                cab={cab}
                index={fillIndex}
                name=""
                style={style ?? DEFAULT_SOLO_STYLE}
                patchCab={storePatchCab}
                patchCabLive={storePatchCabLive}
                beginEdit={beginCabEdit}
                undo={undoCab}
                redo={redoCab}
                canUndo={canUndoCab}
                canRedo={canRedoCab}
                ceiling={ceiling}
                onClose={() => setViewMode("3d")}
              />
            </div>
          )}

          {/* Bottom-LEFT: a vertical pill of 3D / 2D / Сетка, and — SEPARATE below it — a «Глубина»
              icon button that slides the depth slider out to its right (the one dim 2D can't do). */}
          <div className="studio-views">
            <div className="studio-viewcol">
              {viewBtn("3d", "3D")}
              {viewBtn("2d", "2D")}
              {viewBtn("outline", <IconLines />)}
            </div>
            <button type="button" className={`studio-depth-pill${depthOpen ? " on" : ""}`} onClick={() => setDepthOpen((o) => !o)} aria-label="Глубина" title="Глубина">
              <GlyphD />
            </button>
            {depthOpen && (
              <div className="studio-depth-slider">
                <DimSlider icon={null} label="Глубина" value={cabDepth(cab)} min={D_MIN} max={D_MAX} step={10}
                  onBegin={beginCabEdit}
                  onLive={(v) => patchCabDims(cab.id, { depth: v }, true)}
                  onCommit={(v) => patchCabDims(cab.id, { depth: v })} />
              </div>
            )}
          </div>

          {/* Bottom-CENTER: undo/redo (like the main construction scene). When something is selected
              in the 2D editor, its delete button sits just above them. */}
          {viewMode === "2d" && hasSel && (
            <button type="button" className="studio-del" aria-label="delete" onClick={() => deleteFnRef.current?.()}>✕ Удалить</button>
          )}
          <div className="studio-undoredo">
            <button onClick={undoCab} disabled={!canUndoCab} type="button" aria-label={t.config.undo}><IconUndo /></button>
            <button onClick={redoCab} disabled={!canRedoCab} type="button" aria-label={t.config.redo}><IconRedo /></button>
          </div>

          {/* Bottom-RIGHT TOOL RAIL — tapping a tool jumps into the 2D edit canvas and activates it. */}
          <div className="studio-rail">
            {FILL_TOOLS.map((ft) => {
              const active = viewMode === "2d" && tool === ft.key;
              return (
                <button key={ft.key} className={`studio-tool${active ? " sel" : ""}`} type="button"
                  onClick={() => { setTool(ft.key); setViewMode("2d"); }}>
                  <span className="studio-tool-ic"><ToolIcon tool={ft.key} /></span>
                  <span className="studio-tool-lbl">{(t.fe as unknown as Record<string, string>)[ft.labelKey]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Collapsible Settings Sheet */}
        <div className="v21-studio-panel" style={{
          flex: panelState === "collapsed" ? "none" : 1,
          height: panelState === "collapsed" ? 48 : undefined,
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -6px 20px rgba(0,0,0,0.05)",
          zIndex: 5,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {/* Handle / Header Bar */}
          <div
            onClick={panelState === "collapsed" ? expandPanelUp : collapsePanelDown}
            style={{
              height: 48,
              minHeight: 48,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 4, borderRadius: 2, background: "#cbd5e1" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Настройки</span>
            </div>

            {/* Directional arrow controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(() => {
                const arrowBtn = (dir: "down" | "up", onClick: (e?: React.MouseEvent) => void, disabled: boolean, title: string) => (
                  <button onClick={onClick} disabled={disabled} title={title} type="button"
                    style={{
                      border: "1px solid #e2e8f0",
                      background: disabled ? "#f1f5f9" : "#ffffff",
                      color: disabled ? "#cbd5e1" : "#475569",
                      width: 34, height: 34, padding: 0, borderRadius: 8,
                      cursor: disabled ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={dir === "down" ? "M6 9 L12 15 L18 9" : "M6 15 L12 9 L18 15"} />
                    </svg>
                  </button>
                );
                return (
                  <>
                    {arrowBtn("down", collapsePanelDown, panelState === "collapsed", "Свернуть панели (увеличить 3D)")}
                    {arrowBtn("up", expandPanelUp, panelState === "expanded", "Расширить панели (уменьшить 3D)")}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Settings Content Body — construction (Безручковый/Задняя стенка/Дно/Верх/Цоколь · Узлы ·
              Кромка · Назначение). Dimensions live on the viewport: W/H/shelves via the tools, depth
              via the bottom-left «Глубина» button. */}
          {panelState !== "collapsed" && (
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              <V21BlueprintEditor cab={cab} patchCab={patchCab} onClose={onClose} settings={settings} hideHeader={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

