import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Cabinet } from "../model/cabinet";
import type { Settings } from "../model/settings";
import { V21BlueprintEditor } from "./V21BlueprintEditor";

/** Individual Cabinet 3D Mesh Generator for isolated studio preview (with Bazis-style physical hardware) */
function createIsolatedCabinetMesh(cab: Cabinet, viewMode: "3d" | "2d" | "outline" = "3d", settings?: Settings): THREE.Group {
  const group = new THREE.Group();

  const w = cab.w / 1000;
  const h = cab.h / 1000;
  const d = (cab.depth ?? 560) / 1000;
  const boardT = (cab.boardThickness ?? 16) / 1000;
  const hasBack = cab.hasBack ?? (cab.backMount !== "none");
  const isGroove = hasBack && (cab.backMount ?? "groove") === "groove";
  const grooveSetback = (cab.grooveSetback ?? 12) / 1000;
  const plinthH = (cab.plinthMode === "box" || !cab.plinthMode ? 120 : cab.plinthMode === "legs" ? 100 : 0) / 1000;
  const isOutline = viewMode === "outline";
  const jointHw = settings?.jointFamily ?? "confirmat";
  const jointSetback = (settings?.jointSetbackMm ?? 65) / 1000;

  // Materials (translucent in outline mode)
  const carcassMat = new THREE.MeshStandardMaterial({
    color: 0xeeece6,
    roughness: 0.4,
    metalness: 0.05,
    transparent: isOutline,
    opacity: isOutline ? 0.35 : 1.0,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xe5dfd3,
    roughness: 0.6,
    metalness: 0.0,
    transparent: isOutline,
    opacity: isOutline ? 0.3 : 1.0,
  });
  const frontMat = new THREE.MeshStandardMaterial({
    color: 0xc8a878,
    roughness: 0.3,
    metalness: 0.1,
    transparent: isOutline,
    opacity: isOutline ? 0.25 : 0.9,
  });
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x4a4740,
    roughness: 0.5,
    transparent: isOutline,
    opacity: isOutline ? 0.4 : 1.0,
  });

  // Physical Hardware Materials (Bazis-style metal & wood)
  const steelHwMat = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.8, roughness: 0.2 });
  const minifixCamMat = new THREE.MeshStandardMaterial({ color: 0x8e9499, metalness: 0.85, roughness: 0.3 });
  const woodDowelMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.7 });
  const edgeMat = new THREE.LineBasicMaterial({ color: isOutline ? 0x2f6fe4 : 0x1b4d3e, linewidth: 2 });

  // 1. Plinth / Base
  if (plinthH > 0) {
    if (cab.plinthMode === "legs") {
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, plinthH, 16);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
      const offsets = [
        [-w / 2 + 0.05, plinthH / 2, -d / 2 + 0.05],
        [w / 2 - 0.05, plinthH / 2, -d / 2 + 0.05],
        [-w / 2 + 0.05, plinthH / 2, d / 2 - 0.05],
        [w / 2 - 0.05, plinthH / 2, d / 2 - 0.05],
      ];
      for (const [lx, ly, lz] of offsets) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      }
    } else {
      const plinthGeo = new THREE.BoxGeometry(w - 0.01, plinthH, d - 0.04);
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.set(0, plinthH / 2, 0.02);
      group.add(plinth);
    }
  }

  const bodyY = plinthH;
  const bodyH = h - plinthH;

  // Helper: Render Bazis-Style Hardware at (x, y, z)
  const addHardwareJoint = (jx: number, jy: number, jzFront: number, jzBack: number) => {
    for (const jz of [jzFront, jzBack]) {
      if (jointHw === "confirmat") {
        // Confirmat Ø7×50mm Screw Head
        const headGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 16);
        const headL = new THREE.Mesh(headGeo, steelHwMat);
        headL.rotation.z = Math.PI / 2;
        headL.position.set(-w / 2 + 0.001, jy, jz);
        group.add(headL);

        const headR = new THREE.Mesh(headGeo, steelHwMat);
        headR.rotation.z = Math.PI / 2;
        headR.position.set(w / 2 - 0.001, jy, jz);
        group.add(headR);
      } else if (jointHw === "minifix") {
        // Minifix Ø15×12.5mm Cam Cylinder + Dowel Ø8×30mm
        const camGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.0125, 16);
        const camL = new THREE.Mesh(camGeo, minifixCamMat);
        camL.position.set(-w / 2 + boardT + 0.035, jy - boardT / 2 - 0.006, jz);
        group.add(camL);

        const camR = new THREE.Mesh(camGeo, minifixCamMat);
        camR.position.set(w / 2 - boardT - 0.035, jy - boardT / 2 - 0.006, jz);
        group.add(camR);

        // Dowel Ø8×30mm
        const dowelGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12);
        const dowelL = new THREE.Mesh(dowelGeo, woodDowelMat);
        dowelL.rotation.z = Math.PI / 2;
        dowelL.position.set(-w / 2 + boardT / 2, jy, jz + 0.032);
        group.add(dowelL);

        const dowelR = new THREE.Mesh(dowelGeo, woodDowelMat);
        dowelR.rotation.z = Math.PI / 2;
        dowelR.position.set(w / 2 - boardT / 2, jy, jz + 0.032);
        group.add(dowelR);
      }
    }
  };

  // 2. Left Side Board
  const sideW = boardT;
  const sideH = bodyH;
  const sideD = d;
  const sideGeo = new THREE.BoxGeometry(sideW, sideH, sideD);
  const leftSide = new THREE.Mesh(sideGeo, carcassMat);
  leftSide.position.set(-w / 2 + boardT / 2, bodyY + bodyH / 2, 0);
  group.add(leftSide);

  // 3. Right Side Board
  const rightSide = new THREE.Mesh(sideGeo, carcassMat);
  rightSide.position.set(w / 2 - boardT / 2, bodyY + bodyH / 2, 0);
  group.add(rightSide);

  // 4. Bottom Board
  const bottomW = cab.bottomMode === "vkladnoe" ? w - 2 * boardT : w;
  const bottomGeo = new THREE.BoxGeometry(bottomW, boardT, d);
  const bottomMesh = new THREE.Mesh(bottomGeo, carcassMat);
  const bottomY = bodyY + boardT / 2;
  bottomMesh.position.set(0, bottomY, 0);
  group.add(bottomMesh);
  addHardwareJoint(0, bottomY, d / 2 - jointSetback, -d / 2 + jointSetback);

  // 5. Top Board / Stretchers
  if (cab.topMode === "stretchers") {
    const stW = w - 2 * boardT;
    const stD = 0.08;
    const stGeo = new THREE.BoxGeometry(stW, boardT, stD);
    const stFront = new THREE.Mesh(stGeo, carcassMat);
    stFront.position.set(0, bodyY + bodyH - boardT / 2, d / 2 - stD / 2);
    group.add(stFront);

    const stBack = new THREE.Mesh(stGeo, carcassMat);
    stBack.position.set(0, bodyY + bodyH - boardT / 2, -d / 2 + stD / 2);
    group.add(stBack);
  } else if (cab.topMode !== "none") {
    const topGeo = new THREE.BoxGeometry(w - 2 * boardT, boardT, d);
    const topMesh = new THREE.Mesh(topGeo, carcassMat);
    const topY = bodyY + bodyH - boardT / 2;
    topMesh.position.set(0, topY, 0);
    group.add(topMesh);
    addHardwareJoint(0, topY, d / 2 - jointSetback, -d / 2 + jointSetback);
  }

  // 6. Shelves + Hardware Fasteners
  const shelfCount = Math.max(0, cab.count ?? 0);
  if (shelfCount > 0) {
    const shelfW = w - 2 * boardT;
    const shelfD = isGroove ? d - grooveSetback - 0.004 : d - 0.01;
    const shelfGeo = new THREE.BoxGeometry(shelfW, boardT, shelfD);
    const innerH = bodyH - 2 * boardT;
    const stepH = innerH / (shelfCount + 1);

    for (let i = 1; i <= shelfCount; i++) {
      const shelf = new THREE.Mesh(shelfGeo, carcassMat);
      const sy = bodyY + boardT + i * stepH;
      const sz = isGroove ? grooveSetback / 2 : 0;
      shelf.position.set(0, sy, sz);
      group.add(shelf);
      addHardwareJoint(0, sy, sz + shelfD / 2 - jointSetback, sz - shelfD / 2 + jointSetback);
    }
  }

  // 7. Back Panel (В паз vs Внахлёст)
  if (hasBack) {
    if (isGroove) {
      const backW = w - 2 * boardT + 0.016;
      const backH = bodyH - 2 * boardT + 0.016;
      const backGeo = new THREE.BoxGeometry(backW, backH, 0.003);
      const backMesh = new THREE.Mesh(backGeo, backMat);
      backMesh.position.set(0, bodyY + bodyH / 2, -d / 2 + grooveSetback);
      group.add(backMesh);
    } else {
      const backW = w;
      const backH = bodyH;
      const backGeo = new THREE.BoxGeometry(backW, backH, 0.016);
      const backMesh = new THREE.Mesh(backGeo, backMat);
      backMesh.position.set(0, bodyY + bodyH / 2, -d / 2 - 0.008);
      group.add(backMesh);
    }
  }

  // 8. Facade / Door + Hinge Cups Ø35mm
  if (cab.door !== 3 && cab.fill !== "open") {
    const doorW = w - 0.004;
    const doorH = bodyH - boardT;
    const doorD = 0.018;
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, doorD);
    const doorMesh = new THREE.Mesh(doorGeo, frontMat);
    const doorY = bodyY + bodyH / 2;
    const doorZ = d / 2 + doorD / 2;
    doorMesh.position.set(0, doorY, doorZ);
    group.add(doorMesh);

    // Hinge Cups Ø35mm on Inner Door Face
    const cupGeo = new THREE.CylinderGeometry(0.0175, 0.0175, 0.013, 16);
    const cupTop = new THREE.Mesh(cupGeo, minifixCamMat);
    cupTop.rotation.x = Math.PI / 2;
    cupTop.position.set(-doorW / 2 + 0.0215, doorY + doorH / 2 - 0.1, doorZ - doorD / 2 - 0.006);
    group.add(cupTop);

    const cupBot = new THREE.Mesh(cupGeo, minifixCamMat);
    cupBot.rotation.x = Math.PI / 2;
    cupBot.position.set(-doorW / 2 + 0.0215, doorY - doorH / 2 + 0.1, doorZ - doorD / 2 - 0.006);
    group.add(cupBot);
  }

  // Add Wireframe Outlines for CAD Blueprint feel
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const edges = new THREE.EdgesGeometry(obj.geometry);
      const line = new THREE.LineSegments(edges, edgeMat);
      obj.add(line);
    }
  });

  return group;
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
  const t = cab.boardThickness ?? 16;
  const plinthH = cab.plinthMode === "box" || !cab.plinthMode ? 120 : cab.plinthMode === "legs" ? 100 : 0;
  const count = cab.count ?? 0;
  const hasBack = cab.hasBack ?? (cab.backMount !== "none");
  const isGroove = hasBack && (cab.backMount ?? "groove") === "groove";
  const grooveOff = cab.grooveSetback ?? 12;

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
}: {
  cab: Cabinet;
  patchCab: (patch: Partial<Cabinet>) => void;
  onClose: () => void;
  settings?: Settings;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [viewMode, setViewMode] = useState<"3d" | "2d" | "outline">("3d");

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

    const initialMesh = createIsolatedCabinetMesh(cab, "3d", settings);
    meshRef.current = initialMesh;
    scene.add(initialMesh);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
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
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Update mesh when cab/viewMode/settings change — camera preserved
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (meshRef.current) scene.remove(meshRef.current);
    const mode = viewMode === "2d" ? "3d" : viewMode;
    const newMesh = createIsolatedCabinetMesh(cab, mode, settings);
    meshRef.current = newMesh;
    scene.add(newMesh);
  }, [cab, viewMode, settings]);

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

  const viewBtn = (mode: "3d" | "2d" | "outline", label: string) => (
    <button
      onClick={() => setViewMode(mode)}
      style={{
        border: "none",
        background: viewMode === mode ? "#00ac7a" : "transparent",
        color: viewMode === mode ? "#fff" : "#475569",
        padding: "5px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: viewMode === mode ? "0 2px 6px rgba(0,172,122,0.25)" : "none",
      }}
      type="button"
    >{label}</button>
  );

  return (
    <div className="v21-studio-overlay" style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0f172a", display: "flex", flexDirection: "column", fontFamily: "var(--sans, system-ui, sans-serif)" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "#0f172a", color: "#f8fafc", borderBottom: "1px solid #1e293b", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.08)", color: "#94a3b8", width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", transition: "all 0.15s" }} type="button">✕</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>📐 Студия: {cab.w}×{cab.h}×{cab.depth ?? 560} мм</h2>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "#00ac7a", color: "#fff", padding: "8px 20px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,172,122,0.3)" }} type="button">Готово</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Top Viewport — grows when panel is collapsed, shrinks when panel is expanded */}
        <div style={{
          flex: panelState === "collapsed" ? 1 : "none",
          height: panelState === "collapsed" ? undefined : panelState === "expanded" ? 160 : "38vh",
          minHeight: panelState === "collapsed" ? 0 : panelState === "expanded" ? 160 : undefined,
          width: "100%",
          position: "relative",
          background: "#f8fafc",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          {/* 3D canvas — ALWAYS mounted, just hidden when 2D is active */}
          <div
            ref={mountRef}
            style={{
              width: "100%",
              height: "100%",
              display: viewMode === "2d" ? "none" : "block",
              background: "#f8fafc",
            }}
          />

          {/* 2D overlay — shown only when viewMode is "2d" */}
          {viewMode === "2d" && (
            <V21Technical2DCADDrawing cab={cab} settings={settings} />
          )}

          {/* View switcher bar */}
          <div style={{ position: "absolute", top: 12, left: 14, zIndex: 10, display: "flex", gap: 4, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", padding: 4, borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
            {viewBtn("3d", "3D")}
            {viewBtn("2d", "2D Чертеж")}
            {viewBtn("outline", "Сетка")}
          </div>
        </div>

        {/* Bottom Collapsible Settings Sheet */}
        <div style={{
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
              borderBottom: panelState === "collapsed" ? "none" : "1px solid #e2e8f0",
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
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>⚙️ Настройки и узлы V21</span>
              {panelState === "collapsed" && (
                <span style={{ fontSize: 11, color: "#00ac7a", fontWeight: 600 }}>(3D на весь экран)</span>
              )}
            </div>
            
            {/* Directional arrow controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Push panel down -> enlarge 3D view */}
              <button
                onClick={collapsePanelDown}
                disabled={panelState === "collapsed"}
                title="Свернуть панели (увеличить 3D)"
                style={{
                  border: "1px solid #e2e8f0",
                  background: panelState === "collapsed" ? "#f1f5f9" : "#ffffff",
                  color: panelState === "collapsed" ? "#94a3b8" : "#475569",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: panelState === "collapsed" ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                type="button"
              >
                ▼ <span style={{ fontSize: 11 }}>Свернуть</span>
              </button>

              {/* Pull panel up -> shrink 3D view */}
              <button
                onClick={expandPanelUp}
                disabled={panelState === "expanded"}
                title="Расширить панели (уменьшить 3D)"
                style={{
                  border: "1px solid #e2e8f0",
                  background: panelState === "expanded" ? "#f1f5f9" : "#ffffff",
                  color: panelState === "expanded" ? "#94a3b8" : "#475569",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: panelState === "expanded" ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                type="button"
              >
                ▲ <span style={{ fontSize: 11 }}>Расширить</span>
              </button>
            </div>
          </div>

          {/* Settings Content Body */}
          {panelState !== "collapsed" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <V21BlueprintEditor cab={cab} patchCab={patchCab} onClose={onClose} settings={settings} hideHeader={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

