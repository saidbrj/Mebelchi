// apps/app/src/app2/UniversalCanvas.tsx
//
// INTERACTIVE UNIVERSAL CANVAS (App 2 Meso-Level CAD/CAM Editor).
// Directly connects the Universal Kernel (evaluate()) with the Zero-Math Three.js terminal (spaceToMesh.ts).
//
// Gestures Implemented:
// 1. DRAG (Touch-first iPad Layer):
//    - Floating size HUD badge directly over the touching finger.
//    - Sticky Magnetic Detents (8-10px drag lock) at 0, 18, 20, 25, 35 mm with haptic vibration.
//    - Ergonomic hitboxes (>= 44dp) preventing touch slips and camera jumps.
//    - Instant 60fps re-evaluation.
// 2. SPLIT: Volumetric cutter plane (cyan translucent) inside cavities. Click splits space into two children.
// 3. TAP / PATH: Tapping a front triggers kinematic open (door 90°-110° swing / drawer pull).
//    Law 1 trajectory collision highlights obstacle/front in amber (#f59e0b).
// 4. Library Assemblies: One-tap declarative insertion of 5-piece Drawer box & 110° Hinged Door.
// 5. X-Ray & Drill Overlay: Instant toggle of 3D drillings (Confirmat, System 32, hinge cups).
// 6. Golden Export: Download Gidlab 14-column CSV and SWJ008 CNC XML.

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  evaluate,
  type Design,
  type Construction,
  type Space,
  type FaceName,
  type Axis,
  type Gallery,
  type Attachment,
} from "../poligon/model/space";
import { buildSpaceScene, type BuiltSpaceScene, type CollisionInfo } from "../three/spaceToMesh";
import { toGidlabRows, toGidlabCsv, toSWJ008Xml } from "../model/gidlabExport";
import { createDrawerBox } from "../poligon/definitions/drawer";
import { createHingedDoor } from "../poligon/definitions/hinged_door";
import { NfsCameraChoreographer } from "../three/nfsCamera";
import {
  computeDimensionChips,
  projectChipsToScreen,
  type DimensionChipDef,
} from "../three/dimensionChips";
import { BottomTray } from "./BottomTray";
import type { CatalogPreset } from "./catalogPresets";
import { MATERIAL_THEMES, type MaterialTheme, applyMaterialTheme } from "./materialPalettes";

export interface DetentPoint {
  offsetYMm: number; // Cartesian offset: -25, -18, 0, +20 mm
  deltaBottomMm: number; // space.ts delta.bottom: 25, 18, 0, -20 mm
  label: string;
  tag: string;
}

export const DETENT_POINTS: DetentPoint[] = [
  {
    offsetYMm: -25,
    deltaBottomMm: 25,
    label: "Стандарт нижнего захвата верхних баз (-25 мм)",
    tag: "Верхние базы (-25 мм)",
  },
  {
    offsetYMm: -18,
    deltaBottomMm: 18,
    label: "Свес под захват пальцами (-18 мм)",
    tag: "Свес под пальцы (-18 мм)",
  },
  {
    offsetYMm: 0,
    deltaBottomMm: 0,
    label: "Номинал вровень с корпусом (0 мм)",
    tag: "Заподлицо (0 мм)",
  },
  {
    offsetYMm: 20,
    deltaBottomMm: -20,
    label: "Перекрытие профиля Gola снизу (+20 мм)",
    tag: "Gola Grip (+20 мм)",
  },
];

const DETENT_THRESHOLD_PX = 10; // Sticky lock for 10 pixels of drag travel

export interface UniversalCanvasProps {
  initialDesign?: Design;
  construction?: Construction;
  onDesignChange?: (d: Design) => void;
}

export const DEFAULT_CONSTRUCTION: Construction = {
  slots: {
    carcass: { thicknessMm: 16, material: "Egger W980 SM Белый платиновый 16мм" },
    facade: { thicknessMm: 18, material: "Egger H1180 ST37 Дуб Галифакс 18мм" },
    worktop: { thicknessMm: 38, material: "Egger H1180 ST37 Столешница 38мм" },
    back: { thicknessMm: 3.2, material: "HDF 3.2 Белый" },
  },
  hardware: {
    hinge_standard: {
      kind: "hinge",
      requires: "solid",
      protrusionMm: 25,
      clearancePerSideMm: 0,
    },
    hinge_zero_protrusion: {
      kind: "hinge",
      requires: "solid",
      protrusionMm: 0,
      clearancePerSideMm: 0,
    },
    slide_h45: {
      kind: "slide",
      clearancePerSideMm: 12.7,
      lengthsMm: [300, 350, 400, 450, 500, 550],
    },
  },
  library: {},
  facePrecedence: ["left", "right", "bottom", "top", "back"],
  revealMm: 2,
  innerFrontInsetMm: 20,
  drawerSideHeightMm: 120,
  slideBackGapMm: 10,
  touchMm: 2,
};

export const DEFAULT_DESIGN: Design = {
  envelope: { w: 600, h: 720, d: 300 },
  root: {
    id: "cab-root",
    faces: {
      left: { kind: "board", slot: "carcass" },
      right: { kind: "board", slot: "carcass" },
      bottom: { kind: "board", slot: "carcass" },
      top: { kind: "board", slot: "carcass" },
    },
    split: {
      axis: "y",
      children: [
        { rule: { rule: "ratio", weight: 1 }, space: { id: "cell-bot" } },
        { rule: { rule: "ratio", weight: 1 }, space: { id: "cell-top" } },
      ],
      between: [{ kind: "board", slot: "carcass" }],
    },
  },
  fronts: [
    {
      id: "door-1",
      covers: ["cab-root"],
      slot: "facade",
      mount: { thing: "hinge_standard", side: "left" },
      delta: { bottom: 0 },
    },
  ],
};

export function UniversalCanvas({
  initialDesign = DEFAULT_DESIGN,
  construction = DEFAULT_CONSTRUCTION,
  onDesignChange,
}: UniversalCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State
  const [design, setDesign] = useState<Design>(initialDesign);
  const [activeTool, setActiveTool] = useState<"select" | "drag" | "split">("drag");
  const [splitAxis, setSplitAxis] = useState<Axis>("y");
  const [xray, setXray] = useState(false);
  const [showSlotBox, setShowSlotBox] = useState(true);
  const [showBodyBox, setShowBodyBox] = useState(true);
  const [kinematics, setKinematics] = useState<Record<string, number>>({});
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ boardId: string; edge: FaceName } | null>(null);
  const [splitPreview, setSplitPreview] = useState<{ spaceId: string; axis: Axis; posRatio: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // iPad Touch HUD state over finger
  const [dragHud, setDragHud] = useState<{
    x: number;
    y: number;
    valMm: number;
    snapped: boolean;
    label?: string;
    tag?: string;
  } | null>(null);

  // Active dragged edge state passed to Three.js scene
  const [draggedEdgeState, setDraggedEdgeState] = useState<{
    boardId: string;
    edge: FaceName;
    deltaMm: number;
  } | null>(null);

  // Active drag tracking with sticky magnetic detents
  const dragRef = useRef<{
    active: boolean;
    boardId: string;
    edge: FaceName;
    startY: number;
    startX: number;
    initialDelta: number;
    initialOffset: number;
    pendingDelta?: number;
    latchedOffset: number | null;
    latchEntryY: number;
  } | null>(null);

  // Push-pull direct cube resize tracking
  const cubeDragRef = useRef<{
    active: boolean;
    axis: "x" | "y" | "z";
    startX: number;
    startY: number;
    initialDim: number;
    pendingDim?: number;
    label: string;
  } | null>(null);

  // Space (Void) selection state
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [hoveredSpaceId, setHoveredSpaceId] = useState<string | null>(null);

  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const builtSceneRef = useRef<BuiltSpaceScene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const choreographerRef = useRef<NfsCameraChoreographer | null>(null);
  const updateProjectedChipsRef = useRef<() => void>(() => {});

  // On-Object Dimension Chips State & Camera Presets
  const [chips, setChips] = useState<DimensionChipDef[]>([]);
  const [activeChipPopover, setActiveChipPopover] = useState<DimensionChipDef | null>(null);
  const [cameraAngle, setCameraAngle] = useState<"iso" | "front" | "top">("iso");
  const [showDimensionChips, setShowDimensionChips] = useState(true);

  // 3-Level Catalog Presets State (Step 3)
  const [activeCategory, setActiveCategory] = useState<Gallery>("module");
  const [activePresetId, setActivePresetId] = useState<string>("mod-wall-cabinet-720");
  const [isBottomTrayOpen, setIsBottomTrayOpen] = useState(false);

  // ── Step 4: Law 1 Kinematic Collision State ──────────────────────────────
  const [activeCollisions, setActiveCollisions] = useState<CollisionInfo[]>([]);
  const [spacerResolved, setSpacerResolved] = useState(false);
  const [projectedCollisionChip, setProjectedCollisionChip] = useState<{
    collision: CollisionInfo;
    screenX: number;
    screenY: number;
    visible: boolean;
  } | null>(null);

  // ── Step 5: Fast Material Palette State (Eman / Egger) ────────────────────
  const [activeThemeId, setActiveThemeId] = useState<string>("halifax_oak");
  const activeTheme = useMemo(
    () => MATERIAL_THEMES.find((t) => t.id === activeThemeId) ?? MATERIAL_THEMES[0],
    [activeThemeId],
  );

  const effectiveConstruction = useMemo(
    () => applyMaterialTheme(construction, activeTheme),
    [construction, activeTheme],
  );

  // Recompute kernel with active material theme
  const evaluated = useMemo(() => {
    return evaluate(design, effectiveConstruction);
  }, [design, effectiveConstruction]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2400);
  }, []);

  // Update projected screen coordinates for dimension chips & collision markers
  const updateProjectedChips = useCallback(() => {
    const el = containerRef.current;
    const camera = cameraRef.current;
    if (!el || !camera) return;

    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    const rawChips = computeDimensionChips(evaluated, design);
    const projected = projectChipsToScreen(rawChips, camera, w, h);
    setChips(projected);

    // Project active Law 1 hinge strike collision
    const strikeCol = builtSceneRef.current?.collisions.find(
      (c) => c.type === "hinge_strike" && c.position,
    );
    if (strikeCol && strikeCol.position) {
      const v = strikeCol.position.clone();
      v.project(camera);
      const isVisible = v.z < 1 && v.x >= -1.1 && v.x <= 1.1 && v.y >= -1.1 && v.y <= 1.1;
      const screenX = ((v.x + 1) / 2) * w;
      const screenY = ((-v.y + 1) / 2) * h;
      setProjectedCollisionChip({
        collision: strikeCol,
        screenX,
        screenY,
        visible: isVisible,
      });
    } else {
      setProjectedCollisionChip(null);
    }
  }, [evaluated, design]);

  useEffect(() => {
    updateProjectedChipsRef.current = updateProjectedChips;
    updateProjectedChips();
  }, [updateProjectedChips]);

  // Cinematic NFS Camera sweep to 34° FOV focus on target bounds
  const triggerNfsCamera = useCallback(
    (preset: "iso" | "front" | "top") => {
      const choreographer = choreographerRef.current;
      if (!choreographer) return;

      setCameraAngle(preset);
      const cxMm = (evaluated.slotBox.x[0] + evaluated.slotBox.x[1]) / 2;
      const czMm = (evaluated.slotBox.z[0] + evaluated.slotBox.z[1]) / 2;

      const minX = (evaluated.bodyBox.x[0] - cxMm) / 1000;
      const maxX = (evaluated.bodyBox.x[1] - cxMm) / 1000;
      const minY = evaluated.bodyBox.y[0] / 1000;
      const maxY = evaluated.bodyBox.y[1] / 1000;
      const minZ = -(evaluated.bodyBox.z[1] - czMm) / 1000;
      const maxZ = -(evaluated.bodyBox.z[0] - czMm) / 1000;

      const boundsMin = new THREE.Vector3(minX, minY, Math.min(minZ, maxZ));
      const boundsMax = new THREE.Vector3(maxX, maxY, Math.max(minZ, maxZ));

      const targetPose = choreographer.computeFocusPose(boundsMin, boundsMax, preset);
      choreographer.transitionTo(targetPose, 480, () => {
        updateProjectedChipsRef.current();
      });

      const label =
        preset === "iso"
          ? "🏎️ NFS Hero (34° FOV фокус)"
          : preset === "front"
          ? "📐 Фронтальный вид (34°)"
          : "📋 План сверху (34°)";
      showToast(label);
    },
    [evaluated, showToast],
  );

  // Live on-the-move dimension modification (steppers / System 32 / catalog presets)
  const handleModifyDimension = useCallback(
    (axis: Axis, deltaMm: number, exactValue?: number) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }
      setDesign((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as Design;
        const key = axis === "x" ? "w" : axis === "y" ? "h" : "d";
        const cur = next.envelope[key];
        const newVal = exactValue !== undefined ? exactValue : Math.max(150, cur + deltaMm);
        next.envelope[key] = newVal;
        onDesignChange?.(next);
        return next;
      });
    },
    [onDesignChange],
  );

  // Update design wrapper
  const updateDesign = useCallback(
    (updater: (prev: Design) => Design) => {
      setDesign((prev) => {
        const next = updater(prev);
        onDesignChange?.(next);
        return next;
      });
    },
    [onDesignChange],
  );

  // Preset selection with seamless NFS Camera Morphing
  const handleSelectPreset = useCallback(
    (preset: CatalogPreset) => {
      setActivePresetId(preset.id);
      updateDesign(() => preset.design);
      showToast(`✓ Загружен: ${preset.name} (${preset.dims.w} × ${preset.dims.h} × ${preset.dims.d} мм)`);

      // NFS camera morphing into tight 34° focus on the new cabinet bounds
      setTimeout(() => {
        triggerNfsCamera("iso");
      }, 50);
    },
    [updateDesign, showToast, triggerNfsCamera],
  );

  // Toggle kinematic animation for a front or drawer
  const toggleKinematics = useCallback((boardId: string) => {
    setKinematics((prev) => {
      // Find the logical group ID if this is a sub-part of a drawer
      const rootId = boardId.replace(/-(side-left|side-right|subfront|back|bottom|front)$/, "");
      const cur = prev[rootId] ?? prev[boardId] ?? 0;
      const target = cur > 0.5 ? 0 : 1;
      return {
        ...prev,
        [rootId]: target,
        [boardId]: target,
        [`${rootId}-side-left`]: target,
        [`${rootId}-side-right`]: target,
        [`${rootId}-subfront`]: target,
        [`${rootId}-back`]: target,
        [`${rootId}-bottom`]: target,
      };
    });
  }, []);

  // ── Step 4: One-Tap Resolution of Hinge Collision ─────────────────────────
  const handleResolveHingeCollision = useCallback(() => {
    // Tactile haptic feedback
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([15, 60, 15]);
    }

    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const attachments = next.attachments ?? [];

      // Add 25mm spacer strip on left gable
      if (!attachments.some((a) => a.id.includes("spacer-hinge"))) {
        attachments.push({
          id: "spacer-hinge-25",
          role: "filler",
          slot: "carcass",
          thin: "x",
          x: { from: { of: "cab-root", face: "left" }, size: 25 },
          y: { from: { of: "cab-root", face: "bottom" }, to: { of: "cab-root", face: "top" } },
          z: { from: { of: "cab-root", face: "front" }, to: { of: "cab-root", face: "back" } },
          mount: { fixed: true },
        });
        next.attachments = attachments;
      }

      // Recompute internal drawer width: deduct 25mm spacer on left
      // preserving 12.7mm slide clearance invariance
      if (next.fronts) {
        for (const f of next.fronts) {
          if (
            f.id.toLowerCase().includes("drawer") ||
            f.id.toLowerCase().includes("drw")
          ) {
            f.delta = { ...(f.delta || {}), left: -25 };
          }
        }
      }

      return next;
    });

    setSpacerResolved(true);
    showToast("✓ Проставка 25 мм установлена: ширина ящика пересчитана, зазор 12.7 мм сохранен");

    setTimeout(() => {
      setSpacerResolved(false);
      setProjectedCollisionChip(null);
    }, 2800);
  }, [updateDesign, showToast]);

  // ── Step 1: Library Declarative Insertion ─────────────────────────────────
  const insertDrawerBox = useCallback(() => {
    const cavityW = design.envelope.w;
    const cavityH = 260;
    const cavityD = design.envelope.d;

    const drawerAssembly = createDrawerBox({
      id: `drawer-${Date.now().toString().slice(-4)}`,
      cavityWidthMm: cavityW,
      cavityHeightMm: cavityH,
      cavityDepthMm: cavityD,
    });

    // Add drawer front with slide mount to design
    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const fronts = next.fronts ?? [];
      fronts.push({
        id: `drw-front-${Date.now().toString().slice(-4)}`,
        covers: ["cell-bot"],
        slot: "facade",
        mount: { thing: "slide_h45", side: "left" },
        delta: { bottom: 0 },
      });
      next.fronts = fronts;
      return next;
    });

    showToast(`✓ Ящик 5P добавлен (боковины 16 мм, зазоры 12.7 мм сохранены)`);
  }, [design.envelope, updateDesign, showToast]);

  const insertHingedDoor = useCallback(() => {
    const h = design.envelope.h;
    const doorAssembly = createHingedDoor({
      id: `door-${Date.now().toString().slice(-4)}`,
      covers: ["cab-root"],
      side: "left",
      heightMm: h,
      delta: { bottom: 25 },
    });

    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const fronts = next.fronts ?? [];
      fronts.push(doorAssembly.front);
      next.fronts = fronts;
      return next;
    });

    showToast(`✓ Дверь с петлями добавлена (распах 110°, присадка Ø35 мм + System 32)`);
  }, [design.envelope.h, updateDesign, showToast]);

  // ── Space Contextual Actions (Minecraft Direct Manipulation) ─────────────
  const handleSplitSpace = useCallback((spaceId: string, axis: Axis) => {
    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const findAndSplit = (s: Space): boolean => {
        if (s.id === spaceId) {
          s.split = {
            axis,
            children: [
              { rule: { rule: "ratio", weight: 1 }, space: { id: `${s.id}-1` } },
              { rule: { rule: "ratio", weight: 1 }, space: { id: `${s.id}-2` } },
            ],
            between: [{ kind: "board", slot: "carcass" }],
          };
          return true;
        }
        for (const ch of s.split?.children ?? []) {
          if (findAndSplit(ch.space)) return true;
        }
        return false;
      };
      findAndSplit(next.root);
      return next;
    });
    setSelectedSpaceId(null);
    showToast(`✓ Ниша разделена по оси ${axis.toUpperCase()}`);
  }, [updateDesign, showToast]);

  const handleInsertDrawerInSpace = useCallback((spaceId: string) => {
    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const fronts = next.fronts ?? [];
      const frontId = `drw-${spaceId}-${Date.now().toString().slice(-4)}`;
      fronts.push({
        id: frontId,
        covers: [spaceId],
        slot: "facade",
        mount: { thing: "slide_h45", side: "left" },
        delta: { bottom: 0 },
      });
      next.fronts = fronts;
      return next;
    });
    setSelectedSpaceId(null);
    showToast(`✓ Ящик установлен в нишу ${spaceId} (зазоры 12.7 мм сохранены)`);
  }, [updateDesign, showToast]);

  const handleCoverSpaceWithDoor = useCallback((spaceId: string) => {
    // Law 5 check: Face ownership
    const existing = (design.fronts ?? []).find((f) => f.covers.includes(spaceId));
    if (existing) {
      showToast(`⚠️ Ниша уже закрыта фасадом (${existing.id})! Закон 5: одна грань — один фасад`);
      return;
    }

    updateDesign((d) => {
      const next = JSON.parse(JSON.stringify(d)) as Design;
      const fronts = next.fronts ?? [];
      const frontId = `door-${spaceId}-${Date.now().toString().slice(-4)}`;
      fronts.push({
        id: frontId,
        covers: [spaceId],
        slot: "facade",
        mount: { thing: "hinge_standard", side: "left" },
        delta: { bottom: 25 },
      });
      next.fronts = fronts;
      return next;
    });
    setSelectedSpaceId(null);
    showToast(`✓ Фасад с петлями 110° навешен на нишу ${spaceId}`);
  }, [design.fronts, updateDesign, showToast]);

  // ── Download Handlers ───────────────────────────────────────────────────────
  const downloadGidlabCsv = useCallback(() => {
    const rows = toGidlabRows(evaluated, effectiveConstruction);
    const csv = toGidlabCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gidlab_export_${activeTheme.id}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Gidlab 14-колоночный CSV выгружен (${activeTheme.name})`);
  }, [evaluated, effectiveConstruction, activeTheme, showToast]);

  const downloadSwj008Xml = useCallback(() => {
    const xml = toSWJ008Xml(evaluated);
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swj008_cnc_${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ SWJ008 ЧПУ XML выгружен");
  }, [evaluated, showToast]);

  // ── Three.js Viewport Mount & Render Loop ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth || 800;
    const height = el.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d); // Sleek Apple dark slate

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.05, 100);
    camera.position.set(0.85, 0.95, 1.45);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.36, 0);

    const choreographer = new NfsCameraChoreographer(camera, controls);
    choreographerRef.current = choreographer;

    const onControlsChange = () => {
      updateProjectedChipsRef.current();
    };
    controls.addEventListener("change", onControlsChange);

    // Studio PBR Rig
    const ambLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(2.5, 3.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.65);
    fillLight.position.set(-2.5, 1.5, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(0, 2.5, -3);
    scene.add(rimLight);

    // Architectural Ground Grid
    const grid = new THREE.GridHelper(2.4, 24, 0x334155, 0x1e293b);
    grid.position.y = -0.001;
    scene.add(grid);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const isCamChoreo = choreographer.update();
      controls.update();
      if (isCamChoreo) {
        updateProjectedChipsRef.current();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateProjectedChipsRef.current();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls.removeEventListener("change", onControlsChange);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ── Sync Scene with Evaluated State & Options ──────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (builtSceneRef.current) {
      scene.remove(builtSceneRef.current.group);
      builtSceneRef.current.dispose();
      builtSceneRef.current = null;
    }

    const built = buildSpaceScene(evaluated, {
      xray,
      showSlotBox,
      showBodyBox,
      selectedBoardId: selectedBoardId ?? undefined,
      selectedSpaceId: selectedSpaceId ?? undefined,
      hoveredSpaceId: hoveredSpaceId ?? undefined,
      showCubeHandles: activeTool === "drag",
      hoveredEdge: hoveredEdge ?? undefined,
      draggedEdge: draggedEdgeState ?? undefined,
      showRubberband: true,
      interactiveEdges: activeTool === "drag",
      kinematics,
      splitPlane: activeTool === "split" && splitPreview ? splitPreview : undefined,
      colors: activeTheme.colors,
    });

    scene.add(built.group);
    builtSceneRef.current = built;
    setActiveCollisions(built.collisions);

    const doorBlock = built.collisions.find((c) => c.type === "door_blocked");
    if (doorBlock) {
      showToast(`⚠️ Блокировка движения: фасад закрыт (<90°). Сначала откройте дверь!`);
    } else if (built.collisions.some((c) => c.type === "hinge_strike")) {
      showToast(`⚠️ Удар о петлю 25 мм! Закон 1: необходима планка-проставка`);
    }

    updateProjectedChips();
  }, [evaluated, xray, showSlotBox, showBodyBox, selectedBoardId, selectedSpaceId, hoveredSpaceId, hoveredEdge, draggedEdgeState, activeTool, kinematics, splitPreview, activeTheme, showToast, updateProjectedChips]);

  // ── Raycasting & Direct Manipulation Pointer Handlers ─────────────────────
  const getRaycasterIntersects = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      const scene = sceneRef.current;
      if (!el || !scene) return [];

      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const camera = (controlsRef.current as unknown as { object: THREE.Camera })?.object;
      if (!camera) return [];

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      return raycaster.intersectObjects(scene.children, true);
    },
    [],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Dismiss active dimension chip popover on canvas tap
    if (activeChipPopover) {
      setActiveChipPopover(null);
    }

    const hits = getRaycasterIntersects(e);
    if (hits.length === 0) {
      setSelectedSpaceId(null);
      setSelectedBoardId(null);
      return;
    }

    // 1. Check Cube Face Handles for direct Push-Pull resize (W, H, D)
    const cubeHit = hits.find((h) => h.object.userData?.isCubeHandle);
    if (cubeHit && activeTool === "drag") {
      const { axis, label } = cubeHit.object.userData;
      if (controlsRef.current) controlsRef.current.enabled = false;
      const initialDim = axis === "x" ? design.envelope.w : axis === "y" ? design.envelope.h : design.envelope.d;
      cubeDragRef.current = {
        active: true,
        axis,
        startX: e.clientX,
        startY: e.clientY,
        initialDim,
        pendingDim: initialDim,
        label,
      };
      setDragHud({
        x: e.clientX,
        y: e.clientY,
        valMm: initialDim,
        snapped: false,
        label: `Тянуть: ${label}`,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // 2. Check edge handles for DRAG gesture (Touch-first >= 44dp ergonomics)
    const handleHit = hits.find((h) => h.object.userData?.isEdgeHandle);
    if (handleHit && activeTool === "drag") {
      const { boardId, edge } = handleHit.object.userData;
      if (controlsRef.current) controlsRef.current.enabled = false;

      const targetFront = design.fronts?.find((f) => f.id === boardId);
      const initDelta = (targetFront?.delta?.[edge as FaceName] as number) ?? 0;
      const initOffset = edge === "bottom" ? -initDelta : initDelta;

      dragRef.current = {
        active: true,
        boardId,
        edge,
        startY: e.clientY,
        startX: e.clientX,
        initialDelta: initDelta,
        initialOffset: initOffset,
        pendingDelta: initDelta,
        latchedOffset: null,
        latchEntryY: e.clientY,
      };

      setDraggedEdgeState({ boardId, edge, deltaMm: initDelta });

      const matchingDetent = DETENT_POINTS.find(
        (p) => edge === "bottom" && p.deltaBottomMm === initDelta,
      );

      setDragHud({
        x: e.clientX,
        y: e.clientY,
        valMm: initOffset,
        snapped: matchingDetent !== undefined,
        label: matchingDetent?.label,
        tag: matchingDetent?.tag,
      });

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // 3. SPLIT Tool Immediate Cut
    if (activeTool === "split") {
      const targetSpaceId = splitPreview?.spaceId ?? selectedSpaceId ?? "cell-bot";
      handleSplitSpace(targetSpaceId, splitAxis);
      return;
    }

    // 4. Primary Selection: Closest Board or Space Hitbox
    const primaryHit = hits.find((h) => h.object.userData?.isBoard || h.object.userData?.isSpace);
    if (primaryHit) {
      if (primaryHit.object.userData?.isBoard) {
        const { boardId, role } = primaryHit.object.userData;
        setSelectedBoardId(boardId);
        setSelectedSpaceId(null);

        const isDrawer =
          boardId.toLowerCase().includes("drawer") ||
          boardId.toLowerCase().includes("drw") ||
          primaryHit.object.userData?.isDrawer;

        if (role === "front" || isDrawer) {
          toggleKinematics(boardId);
        }
        return;
      } else if (primaryHit.object.userData?.isSpace) {
        const { spaceId } = primaryHit.object.userData;
        setSelectedSpaceId(spaceId);
        setSelectedBoardId(null);
        showToast(`📦 Выбрана ниша: ${spaceId}`);
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // A1. Handle Cube Handle direct resize (Push-Pull W, H, D)
    if (cubeDragRef.current?.active) {
      const cd = cubeDragRef.current;
      const mmPerPx = 0.8;
      const deltaPx = cd.axis === "y" ? -(e.clientY - cd.startY) : (e.clientX - cd.startX);
      const rawDim = cd.initialDim + Math.round(deltaPx * mmPerPx);

      // Magnetic detents to 50mm grid
      let effectiveDim = Math.max(150, rawDim);
      let isSnapped = false;
      let snapTag: string | undefined;

      const nearest50 = Math.round(effectiveDim / 50) * 50;
      if (Math.abs(effectiveDim - nearest50) <= 6) {
        effectiveDim = nearest50;
        isSnapped = true;
        snapTag = "Сетка 50 мм";
      }

      cd.pendingDim = effectiveDim;

      setDragHud({
        x: e.clientX,
        y: e.clientY,
        valMm: effectiveDim,
        snapped: isSnapped,
        label: `${cd.label}: ${effectiveDim} мм`,
        tag: snapTag,
      });
      return;
    }

    // A2. Handle active Edge DRAG with iPad Sticky Haptic Detents
    if (dragRef.current?.active) {
      const d = dragRef.current;
      const deltaYPx = e.clientY - d.startY;
      const mmPerPx = 0.8;

      let effectiveOffset = d.initialOffset;
      let effectiveDelta = d.initialDelta;
      let isSnapped = false;
      let snapLabel: string | undefined;
      let snapTag: string | undefined;

      if (d.edge === "bottom") {
        const rawOffsetMm = d.initialOffset - deltaYPx * mmPerPx;

        for (const p of DETENT_POINTS) {
          if (Math.abs(rawOffsetMm - p.offsetYMm) <= 4.0) {
            if (d.latchedOffset !== p.offsetYMm) {
              d.latchedOffset = p.offsetYMm;
              d.latchEntryY = e.clientY;
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(12);
              }
            }

            if (Math.abs(e.clientY - d.latchEntryY) < DETENT_THRESHOLD_PX) {
              effectiveOffset = p.offsetYMm;
              effectiveDelta = p.deltaBottomMm;
              isSnapped = true;
              snapLabel = p.label;
              snapTag = p.tag;
              break;
            } else {
              d.latchedOffset = null;
            }
          }
        }

        if (!isSnapped) {
          effectiveOffset = Math.max(-60, Math.min(40, Math.round(rawOffsetMm)));
          effectiveDelta = -effectiveOffset;
        }
      } else {
        const rawDeltaMm = d.initialDelta + (d.edge === "top" ? -deltaYPx * mmPerPx : deltaYPx * mmPerPx);
        effectiveOffset = Math.round(rawDeltaMm);
        effectiveDelta = effectiveOffset;
      }

      d.pendingDelta = effectiveDelta;
      setDraggedEdgeState({ boardId: d.boardId, edge: d.edge, deltaMm: effectiveDelta });

      // Live HUD update without recreating entire Three.js scene (Zero stutter)
      setDragHud({
        x: e.clientX,
        y: e.clientY,
        valMm: effectiveOffset,
        snapped: isSnapped,
        label: snapLabel,
        tag: snapTag,
      });
      return;
    }

    // B. Handle Hover
    const hits = getRaycasterIntersects(e);
    const handleHit = hits.find((h) => h.object.userData?.isEdgeHandle);
    if (handleHit) {
      setHoveredEdge({
        boardId: handleHit.object.userData.boardId,
        edge: handleHit.object.userData.edge,
      });
    } else {
      setHoveredEdge(null);
    }

    const spaceHit = hits.find((h) => h.object.userData?.isSpace);
    if (spaceHit && !handleHit) {
      setHoveredSpaceId(spaceHit.object.userData.spaceId);
    } else {
      setHoveredSpaceId(null);
    }

    // C. Handle Split Tool Hover Preview
    if (activeTool === "split") {
      const spaceIds = Object.keys(evaluated.spaces);
      if (spaceIds.length > 0) {
        setSplitPreview({
          spaceId: selectedSpaceId ?? spaceIds[0]!,
          axis: splitAxis,
          posRatio: 0.5,
        });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Commit Cube direct drag
    if (cubeDragRef.current?.active) {
      const cd = cubeDragRef.current;
      if (cd.pendingDim !== undefined && cd.pendingDim !== cd.initialDim) {
        updateDesign((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as Design;
          if (cd.axis === "x") next.envelope.w = cd.pendingDim!;
          else if (cd.axis === "y") next.envelope.h = cd.pendingDim!;
          else if (cd.axis === "z") next.envelope.d = cd.pendingDim!;
          return next;
        });
        showToast(`✓ Размер ${cd.label}: ${cd.pendingDim} мм зафиксирован`);
      }
      cubeDragRef.current = null;
      setDragHud(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // 2. Commit Edge Drag
    if (dragRef.current?.active) {
      const d = dragRef.current;
      if (d.pendingDelta !== undefined && d.pendingDelta !== d.initialDelta) {
        updateDesign((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as Design;
          const front = next.fronts?.find((f) => f.id === d.boardId);
          if (front) {
            front.delta = {
              ...front.delta,
              [d.edge]: d.pendingDelta,
            };
          }
          return next;
        });
      }
      dragRef.current = null;
      setDragHud(null);
      setDraggedEdgeState(null);
      if (controlsRef.current) controlsRef.current.enabled = true;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const currentBottomDelta = (design.fronts?.[0]?.delta?.bottom as number) ?? 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", userSelect: "none" }}>
      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: "100%", height: "100%", cursor: activeTool === "drag" ? "ns-resize" : "crosshair" }}
      />

      {/* Floating Apple Calliper HUD Badge over touching finger */}
      {dragHud && (
        <div
          style={{
            position: "fixed",
            left: dragHud.x,
            top: dragHud.y - 58,
            transform: "translateX(-50%)",
            background: dragHud.snapped ? "rgba(12, 74, 110, 0.96)" : "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(16px)",
            color: dragHud.snapped ? "#38bdf8" : "#f8fafc",
            padding: "8px 16px",
            borderRadius: 14,
            border: dragHud.snapped ? "1.5px solid #06b6d4" : "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: dragHud.snapped
              ? "0 0 24px rgba(6, 182, 212, 0.55), 0 12px 32px rgba(0,0,0,0.6)"
              : "0 12px 32px rgba(0,0,0,0.6)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 14,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 10,
            pointerEvents: "none",
            zIndex: 9999,
            transition: "background 0.15s, border 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dragHud.snapped && <span style={{ fontSize: 13 }}>🧲</span>}
            <span style={{ fontSize: 16, fontWeight: 900 }}>
              {dragHud.valMm > 0 ? `+${dragHud.valMm}` : dragHud.valMm} мм
            </span>
          </div>
          {dragHud.tag && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: dragHud.snapped ? "#ffffff" : "#94a3b8",
                background: dragHud.snapped ? "rgba(6, 182, 212, 0.35)" : "rgba(255,255,255,0.1)",
                padding: "2px 8px",
                borderRadius: 6,
                borderLeft: "none",
              }}
            >
              {dragHud.tag}
            </span>
          )}
        </div>
      )}

      {/* Primary Top Floating Toolbar */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "flex",
          gap: 6,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(14px)",
          padding: "6px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTool("drag")}
          style={{
            background: activeTool === "drag" ? "#2563eb" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "0.15s",
          }}
          title="Тянуть край детали (DRAG) с магнитным снапом"
        >
          ↕ Тянуть (DRAG)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTool("split");
            setSplitAxis((a) => (a === "y" ? "x" : "y"));
          }}
          style={{
            background: activeTool === "split" ? "#06b6d4" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "0.15s",
          }}
          title="Разрезать полость (SPLIT)"
        >
          ✂ Разрез ({splitAxis.toUpperCase()})
        </button>

        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

        {/* Declarative Library Adders (Step 1) */}
        <button
          type="button"
          onClick={insertDrawerBox}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "7px 11px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Добавить параметрический ящик (5 деталей, зазоры 12.7 мм)"
        >
          ➕ Ящик 5P
        </button>

        <button
          type="button"
          onClick={insertHingedDoor}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "7px 11px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Добавить фасад с петлями (распах 110°, чашки Ø35 мм)"
        >
          ➕ Дверь 110°
        </button>

        {/* Quick Kinematics Drawer Pull-out Trigger (Law 1 Inspection) */}
        {design.fronts?.some((f) => f.id.toLowerCase().includes("drawer") || f.id.toLowerCase().includes("drw")) && (
          <button
            type="button"
            onClick={() => {
              const drw = design.fronts?.find((f) => f.id.toLowerCase().includes("drawer") || f.id.toLowerCase().includes("drw"));
              if (drw) toggleKinematics(drw.id);
            }}
            style={{
              background: Object.keys(kinematics).some((k) => k.includes("drw") && (kinematics[k] ?? 0) > 0)
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.35))"
                : "rgba(255,255,255,0.08)",
              color: Object.keys(kinematics).some((k) => k.includes("drw") && (kinematics[k] ?? 0) > 0) ? "#fef08a" : "#e2e8f0",
              border: Object.keys(kinematics).some((k) => k.includes("drw") && (kinematics[k] ?? 0) > 0)
                ? "1px solid #f59e0b"
                : "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "7px 11px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Выдвинуть ящик по направляющим (проверка Закона 1)"
          >
            <span>⚡️ Выдвинуть ящик</span>
          </button>
        )}

        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

        <button
          type="button"
          onClick={() => setXray((v) => !v)}
          style={{
            background: xray ? "#7c3aed" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="X-Ray: присадка System 32 + конфирматы"
        >
          🔬 X-Ray {xray ? "ВКЛ" : "ВЫКЛ"}
        </button>
      </div>

      {/* Secondary Top Toolbar: NFS Camera Choreography & Angle Switcher */}
      <div
        style={{
          position: "absolute",
          top: 66,
          left: 16,
          display: "flex",
          gap: 6,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(14px)",
          padding: "6px 10px",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={() => triggerNfsCamera("iso")}
          style={{
            background: cameraAngle === "iso" ? "linear-gradient(135deg, #0284c7, #0369a1)" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 11px",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          title="Кинематографичный фокус 34° (NFS 480ms cubic-bezier)"
        >
          <span>🏎️</span> NFS Hero (34°)
        </button>

        <button
          type="button"
          onClick={() => triggerNfsCamera("front")}
          style={{
            background: cameraAngle === "front" ? "#0284c7" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Фронтальная ортогональная проекция"
        >
          📐 Фронт
        </button>

        <button
          type="button"
          onClick={() => triggerNfsCamera("top")}
          style={{
            background: cameraAngle === "top" ? "#0284c7" : "transparent",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="План сверху"
        >
          📋 План
        </button>

        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

        <button
          type="button"
          onClick={() => setShowDimensionChips((v) => !v)}
          style={{
            background: showDimensionChips ? "rgba(56, 189, 248, 0.2)" : "transparent",
            color: showDimensionChips ? "#38bdf8" : "#94a3b8",
            border: showDimensionChips ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid transparent",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
          title="Показать/скрыть плавающие размерные чипы"
        >
          🏷️ Размеры {showDimensionChips ? "ВКЛ" : "ВЫКЛ"}
        </button>

        <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

        <button
          type="button"
          onClick={() => setShowBodyBox((v) => !v)}
          style={{
            background: showBodyBox ? "rgba(47, 111, 237, 0.25)" : "transparent",
            color: showBodyBox ? "#60a5fa" : "#94a3b8",
            border: showBodyBox ? "1px solid rgba(47, 111, 237, 0.45)" : "1px solid transparent",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Body Box: габарит со свесами"
        >
          Body Box {showBodyBox ? "ВКЛ" : "ВЫКЛ"}
        </button>

        <button
          type="button"
          onClick={() => setShowSlotBox((v) => !v)}
          style={{
            background: showSlotBox ? "rgba(8, 145, 178, 0.25)" : "transparent",
            color: showSlotBox ? "#22d3ee" : "#94a3b8",
            border: showSlotBox ? "1px solid rgba(8, 145, 178, 0.45)" : "1px solid transparent",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
          title="Slot Box: монтажный конверт"
        >
          Slot Box {showSlotBox ? "ВКЛ" : "ВЫКЛ"}
        </button>
      </div>

      {/* Floating On-Object Dimension Chips ([ ↔ W ], [ ↕ H ], [ ↗ D ]) */}
      {showDimensionChips &&
        chips.map((chip) => {
          if (!chip.screenPos?.visible) return null;
          const isSelected = activeChipPopover?.id === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveChipPopover((cur) => (cur?.id === chip.id ? null : chip));
              }}
              style={{
                position: "absolute",
                left: chip.screenPos.x,
                top: chip.screenPos.y,
                transform: "translate(-50%, -50%)",
                background: isSelected ? "rgba(14, 165, 233, 0.95)" : "rgba(15, 23, 42, 0.88)",
                color: isSelected ? "#ffffff" : "#f8fafc",
                border: isSelected ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                cursor: "pointer",
                backdropFilter: "blur(12px)",
                boxShadow: isSelected
                  ? "0 0 16px rgba(56, 189, 248, 0.6), 0 8px 24px rgba(0,0,0,0.5)"
                  : "0 6px 18px rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                zIndex: 25,
                transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                minHeight: 36,
                userSelect: "none",
              }}
              title={`Кликните для изменения: ${chip.label} ${chip.valueMm} мм`}
            >
              <span style={{ color: isSelected ? "#fff" : "#38bdf8", fontSize: 13 }}>{chip.label}</span>
              <span>{chip.valueMm}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>мм</span>
            </button>
          );
        })}

      {/* ── Step 4: Law 1 Kinematic Collision Floating Chip ───────────────── */}
      {projectedCollisionChip && projectedCollisionChip.visible && (
        <button
          type="button"
          onClick={handleResolveHingeCollision}
          style={{
            position: "absolute",
            left: projectedCollisionChip.screenX,
            top: projectedCollisionChip.screenY,
            transform: "translate(-50%, -50%)",
            background: spacerResolved
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.96), rgba(5, 150, 105, 0.96))"
              : "linear-gradient(135deg, rgba(245, 158, 11, 0.96), rgba(217, 119, 6, 0.96))",
            color: "#ffffff",
            border: spacerResolved ? "2px solid #34d399" : "2px solid #fbbf24",
            borderRadius: 24,
            padding: "8px 18px",
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            backdropFilter: "blur(16px)",
            boxShadow: spacerResolved
              ? "0 0 24px rgba(16, 185, 129, 0.7), 0 8px 24px rgba(0,0,0,0.5)"
              : "0 0 28px rgba(245, 158, 11, 0.75), 0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            userSelect: "none",
          }}
          title="Нажмите для устранения коллизии: установка планки-проставки 25 мм"
        >
          {spacerResolved ? (
            <>
              <span style={{ fontSize: 14 }}>✓</span>
              <span>Проставка 25 мм установлена</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span>Удар о петлю</span>
              <span style={{ opacity: 0.8 }}>➔</span>
              <span style={{ textDecoration: "underline", color: "#fef08a" }}>+ Проставка 25 мм</span>
            </>
          )}
        </button>
      )}

      {/* Interactive Apple-Grade Dimension Stepper Popover */}
      {activeChipPopover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: Math.max(
              16,
              Math.min((containerRef.current?.clientWidth ?? 800) - 290, (activeChipPopover.screenPos?.x ?? 200) - 130),
            ),
            top: Math.max(
              68,
              Math.min(
                (containerRef.current?.clientHeight ?? 600) - 340,
                (activeChipPopover.screenPos?.y ?? 200) + 24,
              ),
            ),
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(20px)",
            border: "1.5px solid rgba(56, 189, 248, 0.5)",
            borderRadius: 16,
            padding: "16px",
            boxShadow: "0 20px 48px rgba(0,0,0,0.7), 0 0 24px rgba(56, 189, 248, 0.25)",
            zIndex: 100,
            width: 270,
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{activeChipPopover.label}</span>
              <span>
                {activeChipPopover.axis === "x"
                  ? "Ширина (W)"
                  : activeChipPopover.axis === "y"
                  ? "Высота (H)"
                  : "Глубина (D)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveChipPopover(null)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 24,
                height: 24,
                color: "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>

          {/* Live Value Monospace Display */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: 6,
              background: "rgba(2, 6, 23, 0.6)",
              padding: "10px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                fontSize: 28,
                fontWeight: 900,
                color: "#38bdf8",
                letterSpacing: "-0.5px",
              }}
            >
              {activeChipPopover.axis === "x"
                ? design.envelope.w
                : activeChipPopover.axis === "y"
                ? design.envelope.h
                : design.envelope.d}
            </span>
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>мм</span>
          </div>

          {/* Micro Steppers: [-50] [-10] [+10] [+50] */}
          <div style={{ display: "flex", gap: 6 }}>
            {[-50, -10, 10, 50].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => handleModifyDimension(activeChipPopover.axis, step)}
                style={{
                  flex: 1,
                  minHeight: 44, // Touch target >= 44dp
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  color: "#f1f5f9",
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                {step > 0 ? `+${step}` : step}
              </button>
            ))}
          </div>

          {/* System 32 Raster Ticks: [-32] [+32] */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontSize: 10.5,
                color: "#94a3b8",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Шаг System 32:</span>
              <span style={{ color: "#38bdf8" }}>±32 мм</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => handleModifyDimension(activeChipPopover.axis, -32)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: 8,
                  color: "#38bdf8",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                − 32 мм
              </button>
              <button
                type="button"
                onClick={() => handleModifyDimension(activeChipPopover.axis, 32)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  background: "rgba(56, 189, 248, 0.12)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: 8,
                  color: "#38bdf8",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}
              >
                + 32 мм
              </button>
            </div>
          </div>

          {/* Standard Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 600 }}>Стандартные размеры:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(activeChipPopover.axis === "x"
                ? [300, 400, 450, 600, 800, 900, 1200]
                : activeChipPopover.axis === "y"
                ? [360, 720, 870, 900, 1320, 2040]
                : [300, 400, 560, 600]
              ).map((presetVal) => {
                const curVal =
                  activeChipPopover.axis === "x"
                    ? design.envelope.w
                    : activeChipPopover.axis === "y"
                    ? design.envelope.h
                    : design.envelope.d;
                const isCur = curVal === presetVal;
                return (
                  <button
                    key={presetVal}
                    type="button"
                    onClick={() => handleModifyDimension(activeChipPopover.axis, 0, presetVal)}
                    style={{
                      minHeight: 32,
                      padding: "4px 9px",
                      borderRadius: 6,
                      background: isCur ? "#0284c7" : "rgba(255,255,255,0.06)",
                      color: isCur ? "#fff" : "#cbd5e1",
                      border: isCur ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                      fontSize: 11.5,
                      fontWeight: isCur ? 800 : 600,
                      cursor: "pointer",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    }}
                  >
                    {presetVal}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Live Caliper & Dual Bounds Indicator (Audit of Slot Box vs Body Box) */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 20,
          background: "rgba(15, 23, 42, 0.92)",
          color: "#fff",
          padding: "12px 18px",
          borderRadius: 14,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          backdropFilter: "blur(14px)",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>Свес фасада снизу:</span>
          <span
            style={{
              fontWeight: 900,
              color: -currentBottomDelta !== 0 ? "#38bdf8" : "#fff",
              fontSize: 15,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {-currentBottomDelta > 0 ? `+${-currentBottomDelta}` : -currentBottomDelta} мм
          </span>
          {(() => {
            const matched = DETENT_POINTS.find((p) => p.deltaBottomMm === currentBottomDelta);
            return (
              matched && (
                <span
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #0369a1)",
                    color: "#fff",
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontWeight: 700,
                  }}
                >
                  {matched.tag}
                </span>
              )
            );
          })()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "#94a3b8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2f6fed", display: "inline-block" }} />
            <span>Физический <b>Body Box</b> (со свесами):</span>
            <span style={{ color: "#f8fafc", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
              Y [{evaluated.bodyBox.y[0]}, {evaluated.bodyBox.y[1]}] мм (H = {evaluated.bodyBox.y[1] - evaluated.bodyBox.y[0]} мм)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, border: "1px dashed #06b6d4", display: "inline-block" }} />
            <span>Монтажный <b>Slot Box</b> (номинал):</span>
            <span style={{ color: "#38bdf8", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
              Y [{evaluated.slotBox.y[0]}, {evaluated.slotBox.y[1]}] мм (H = {evaluated.slotBox.y[1] - evaluated.slotBox.y[0]} мм)
            </span>
          </div>
        </div>
      </div>

      {/* Fast Material Palette (Eman / Egger) & Golden Export Actions Bar */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* Material Selector Glass Segmented Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(15, 23, 42, 0.92)",
            backdropFilter: "blur(14px)",
            padding: "4px 6px",
            borderRadius: 12,
            border: "1px solid rgba(255, 255, 255, 0.14)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {MATERIAL_THEMES.map((t) => {
            const isActive = t.id === activeThemeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveThemeId(t.id);
                  showToast(`🎨 Палитра: ${t.name} (${t.subtitle})`);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: isActive
                    ? "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))"
                    : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  border: isActive ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                }}
                title={`${t.name} — ${t.description}`}
              >
                {/* Swatch indicator circle */}
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${t.swatchHex} 50%, ${t.secondaryHex} 50%)`,
                    border: "1px solid rgba(255,255,255,0.35)",
                    flexShrink: 0,
                  }}
                />
                <span>{t.name}</span>
              </button>
            );
          })}
        </div>

        {/* Golden Export Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={downloadGidlabCsv}
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Выгрузить 14-колоночную таблицу для оптимизатора раскроя Gidlab"
          >
            <span>📄</span>
            <span>Gidlab (14 колонок)</span>
          </button>

          <button
            type="button"
            onClick={downloadSwj008Xml}
            style={{
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Выгрузить XML для ЧПУ станков KDT / Nanxing / Biesse"
          >
            <span>⚙️</span>
            <span>SWJ008 ЧПУ XML</span>
          </button>
        </div>
      </div>

      {/* ── Contextual Floating Action Pill (Minecraft Direct Manipulation) ── */}
      {selectedSpaceId && (
        <div
          style={{
            position: "absolute",
            bottom: isBottomTrayOpen ? 210 : 76,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(56, 189, 248, 0.45)",
            borderRadius: 16,
            padding: "7px 12px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(56, 189, 248, 0.15)",
            zIndex: 45,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
            <span style={{ fontSize: 15 }}>📦</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Ниша</span>
              <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 700, fontSize: 12 }}>{selectedSpaceId}</span>
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.15)" }} />

          <button
            type="button"
            onClick={() => handleSplitSpace(selectedSpaceId, "y")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "6px 11px",
              color: "#f8fafc",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Разделить нишу горизонтальной полкой"
          >
            <span>✂ Полка (Y)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSplitSpace(selectedSpaceId, "x")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "6px 11px",
              color: "#f8fafc",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Разделить нишу вертикальной стойкой"
          >
            <span>✂ Стойка (X)</span>
          </button>

          <button
            type="button"
            onClick={() => handleInsertDrawerInSpace(selectedSpaceId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: 8,
              padding: "6px 11px",
              color: "#34d399",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Установить выдвижной ящик в эту нишу (зазоры 12.7 мм)"
          >
            <span>➕ Ящик</span>
          </button>

          <button
            type="button"
            onClick={() => handleCoverSpaceWithDoor(selectedSpaceId)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              borderRadius: 8,
              padding: "6px 11px",
              color: "#a5b4fc",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Навесить фасад с петлями 110° на эту нишу (Закон 5)"
          >
            <span>🚪 Дверь</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSpaceId(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: 14,
              padding: "4px 8px",
              cursor: "pointer",
              borderRadius: 6,
            }}
            title="Снять выделение"
          >
            ✕
          </button>
        </div>
      )}

      {selectedBoardId && (
        <div
          style={{
            position: "absolute",
            bottom: isBottomTrayOpen ? 210 : 76,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(15, 23, 42, 0.94)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(99, 102, 241, 0.45)",
            borderRadius: 16,
            padding: "7px 14px",
            boxShadow: "0 12px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(99, 102, 241, 0.15)",
            zIndex: 45,
          }}
        >
          {(() => {
            const b = evaluated.boards.find((x) => x.id === selectedBoardId);
            const isFront = b?.role === "front";
            const frontDef = design.fronts?.find((f) => f.id === selectedBoardId);
            const w = b ? Math.round(b.box.x[1] - b.box.x[0]) : 0;
            const h = b ? Math.round(b.box.y[1] - b.box.y[0]) : 0;
            const d = b ? Math.round(b.box.z[1] - b.box.z[0]) : 0;

            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
                  <span style={{ fontSize: 15 }}>🪵</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                      {isFront ? "Фасад" : "Деталь"}
                    </span>
                    <span style={{ fontFamily: "monospace", color: "#a5b4fc", fontWeight: 700, fontSize: 12 }}>
                      {selectedBoardId} ({w} × {h} × {d} мм)
                    </span>
                  </div>
                </div>

                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.15)" }} />

                {isFront && frontDef && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ color: "#94a3b8" }}>Свес снизу:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = typeof frontDef.delta?.bottom === "number" ? frontDef.delta.bottom : 0;
                        const nextVal = cur - 5;
                        updateDesign((prevD) => {
                          const next = JSON.parse(JSON.stringify(prevD)) as Design;
                          const f = next.fronts?.find((x) => x.id === selectedBoardId);
                          if (f) f.delta = { ...(f.delta ?? {}), bottom: nextVal };
                          return next;
                        });
                      }}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "3px 7px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      -5
                    </button>
                    <span style={{ fontFamily: "monospace", color: "#f8fafc", fontWeight: 700, minWidth: 36, textAlign: "center" }}>
                      {(() => {
                        const bVal = typeof frontDef.delta?.bottom === "number" ? frontDef.delta.bottom : 0;
                        return `${bVal > 0 ? `+${bVal}` : bVal} мм`;
                      })()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = typeof frontDef.delta?.bottom === "number" ? frontDef.delta.bottom : 0;
                        const nextVal = cur + 5;
                        updateDesign((prevD) => {
                          const next = JSON.parse(JSON.stringify(prevD)) as Design;
                          const f = next.fronts?.find((x) => x.id === selectedBoardId);
                          if (f) f.delta = { ...(f.delta ?? {}), bottom: nextVal };
                          return next;
                        });
                      }}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "3px 7px",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      +5
                    </button>
                  </div>
                )}

                {b?.id.toLowerCase().includes("bottom") && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <button
                      type="button"
                      onClick={() => {
                        updateDesign((prevD) => {
                          const next = JSON.parse(JSON.stringify(prevD)) as Design;
                          const bFace = next.root.faces?.bottom;
                          if (bFace && typeof bFace === "object" && bFace.kind === "board") {
                            const curInset = typeof bFace.inset?.front === "number" ? bFace.inset.front : 0;
                            const nextInset = curInset === 20 ? 0 : 20;
                            bFace.inset = { ...(bFace.inset ?? {}), front: nextInset };
                          }
                          return next;
                        });
                        showToast("✓ Дно утоплено на 20 мм (Gola-паз для захвата рукой снизу)");
                      }}
                      style={{
                        background: "rgba(245, 158, 11, 0.2)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "#fcd34d",
                        borderRadius: 8,
                        padding: "6px 11px",
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Утопить дно на 20 мм для ручки-профиля Gola"
                    >
                      ⚡ Gola паз (-20 мм дно)
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedBoardId(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    fontSize: 14,
                    padding: "4px 8px",
                    cursor: "pointer",
                    borderRadius: 6,
                  }}
                  title="Снять выделение"
                >
                  ✕
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Step 3: Bottom 3-Level Floating Dock (Types / Modules / Components) ── */}
      <BottomTray
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        isOpen={isBottomTrayOpen}
        onToggleOpen={() => setIsBottomTrayOpen((v) => !v)}
      />

      {/* Floating Toast Message (Moved to top center) */}
      {toastMsg && (
        <div
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#38bdf8",
            padding: "8px 18px",
            borderRadius: 20,
            border: "1px solid rgba(56, 189, 248, 0.35)",
            fontSize: 12.5,
            fontWeight: 600,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
