// apps/app/src/three/spaceToMesh.ts
//
// ZERO-MATH THREE.JS TERMINAL for App 2 Universal Kernel (DB/58).
//
// THE LAW: This module is a "dumb terminal". It performs ZERO sizing math, ZERO clearance calculations,
// and ZERO offset derivations. All physical dimensions, positions, overhangs, and hole placements are
// computed upstream by evaluate() in `apps/app/src/poligon/model/space.ts`.
//
// Features:
// 1. Boards: Evaluated Board[] -> BoxGeometry meshes with PBR materials.
// 2. Dual bounds:
//    - Slot Box: Nominal App 1 envelope in dashed cyan lines.
//    - Body Box: Real physical boundary with overhangs in accent blue (#2f6fed).
// 3. X-Ray & Drillings (F1):
//    - Translucent board rendering.
//    - 3D instanced/positioned drillings on faces and edges color-coded by purpose.
// 4. Interactive Edge Hitboxes:
//    - Edge handles for direct manipulation DRAG gestures.
// 5. Kinematic Paths (PATH):
//    - Door rotation on hinge side.
//    - Drawer sliding along -Z.
//    - Swept path collision detection (Law 1: Trajectory collision -> amber #f59e0b).
// 6. Volumetric Split Preview:
//    - Cyan translucent cutting plane inside cavity for SPLIT gesture.

import * as THREE from "three";
import type { Evaluated, Board, Box, Axis, Hole, FaceName } from "../poligon/model/space";

export interface SpaceMeshOptions {
  /** X-Ray mode: makes boards translucent and reveals 3D drillings */
  xray?: boolean;
  /** Show nominal App 1 Slot Box (dashed cyan lines) */
  showSlotBox?: boolean;
  /** Show physical Body Box with overhangs (#2f6fed) */
  showBodyBox?: boolean;
  /** Selected board ID for visual highlight */
  selectedBoardId?: string;
  /** Hovered edge handle: { boardId, edge } */
  hoveredEdge?: { boardId: string; edge: FaceName };
  /** Active dragged edge: { boardId, edge, deltaMm? } */
  draggedEdge?: { boardId: string; edge: FaceName; deltaMm?: number };
  /** Show cyan rubberband guidelines for front overhangs (default: true) */
  showRubberband?: boolean;
  /** Enable invisible/interactive hitboxes along board edges for DRAG gesture */
  interactiveEdges?: boolean;
  /** Kinematic open fractions: boardId -> s in [0, 1] */
  kinematics?: Record<string, number>;
  /** Preview plane for volumetric split gesture */
  splitPlane?: {
    spaceId: string;
    axis: Axis;
    posRatio: number;
  };
  /** Material colors */
  colors?: {
    carcass?: number;
    facade?: number;
    shelf?: number;
    worktop?: number;
    back?: number;
    accent?: number;
  };
  /** Selected space (cavity) ID */
  selectedSpaceId?: string;
  /** Hovered space (cavity) ID */
  hoveredSpaceId?: string;
  /** Show push-pull cube face handles for direct dimension resize */
  showCubeHandles?: boolean;
}

export interface CollisionInfo {
  boardId: string;
  obstacleId: string;
  type: "door_blocked" | "hinge_strike" | "mesh_overlap";
  side?: "left" | "right";
  protrusionMm?: number;
  position?: THREE.Vector3;
  message?: string;
}

export interface BuiltSpaceScene {
  /** Root Three.js group */
  group: THREE.Group;
  /** Map of boardId to mesh */
  boardMeshes: Map<string, THREE.Mesh>;
  /** Array of edge handle hitboxes for raycasting */
  edgeHandles: THREE.Mesh[];
  /** Interactive space cavity hitboxes */
  spaceHitboxes: THREE.Mesh[];
  /** Push-pull face handles for W, H, D direct drag */
  cubeHandles: THREE.Mesh[];
  /** Drillings group */
  drillingsGroup?: THREE.Group;
  /** List of detected trajectory collisions (Law 1) */
  collisions: CollisionInfo[];
  /** Cleanup function to dispose geometries and materials */
  dispose: () => void;
}

const DEFAULT_COLORS = {
  carcass: 0xeeece6, // LDSP 16 White / Cream
  facade: 0xc8a878,  // Sage / Natural Oak
  shelf: 0xe8e6e0,
  worktop: 0xd8d8d8,
  back: 0xf4f4f2,
  accent: 0x2f6fed,
};

/** Hole colors by purpose */
const HOLE_COLORS: Record<Hole["purpose"], number> = {
  confirmat: 0xef4444, // Red
  minifix: 0xf97316,   // Orange
  runner: 0x3b82f6,    // Blue
  hinge: 0x8b5cf6,     // Purple
  dowel: 0xeab308,     // Yellow
  shelf_pin: 0x10b981, // Emerald
};

/**
 * Builds the 3D scene from an Evaluated kernel state.
 */
export function buildSpaceScene(
  evaluated: Evaluated,
  opts: SpaceMeshOptions = {},
): BuiltSpaceScene {
  const root = new THREE.Group();
  root.name = "space-scene-root";

  const boardMeshes = new Map<string, THREE.Mesh>();
  const edgeHandles: THREE.Mesh[] = [];
  const collisions: CollisionInfo[] = [];
  const disposables: { dispose: () => void }[] = [];

  const colors = { ...DEFAULT_COLORS, ...opts.colors };
  const slotBox = evaluated.slotBox;

  // Origin centering in Three.js coordinates:
  // Center horizontally around slotBox X center, Y from 0 up, Z centered on slotBox Z.
  const cxMm = (slotBox.x[0] + slotBox.x[1]) / 2;
  const czMm = (slotBox.z[0] + slotBox.z[1]) / 2;

  const to3d = (x: number, y: number, z: number): THREE.Vector3 =>
    new THREE.Vector3(
      (x - cxMm) / 1000,
      y / 1000,
      -(z - czMm) / 1000, // Z goes negative into the screen (back wall)
    );

  // ── 1. Render Boards ────────────────────────────────────────────────────────
  for (const board of evaluated.boards) {
    const wMm = board.box.x[1] - board.box.x[0];
    const hMm = board.box.y[1] - board.box.y[0];
    const dMm = board.box.z[1] - board.box.z[0];

    const wM = Math.max(0.001, wMm / 1000);
    const hM = Math.max(0.001, hMm / 1000);
    const dM = Math.max(0.001, dMm / 1000);

    const geo = new THREE.BoxGeometry(wM, hM, dM);
    disposables.push(geo);

    // Pick base color
    let baseColor = colors.carcass;
    if (board.role === "front") baseColor = colors.facade;
    else if (board.role === "shelf") baseColor = colors.shelf;
    else if (board.role === "worktop") baseColor = colors.worktop;
    else if (board.role === "back") baseColor = colors.back;

    const isSelected = opts.selectedBoardId === board.id;
    if (isSelected) baseColor = colors.accent;

    let mat: THREE.Material;
    if (opts.xray) {
      mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity: isSelected ? 0.45 : 0.22,
        depthWrite: false,
        roughness: 0.3,
        metalness: 0.05,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: board.role === "front" ? 0.45 : 0.65,
        metalness: 0.05,
      });
    }
    disposables.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `board-${board.id}`;
    mesh.castShadow = !opts.xray;
    mesh.receiveShadow = !opts.xray;
    mesh.userData = {
      isBoard: true,
      boardId: board.id,
      role: board.role,
      slot: board.slot,
      material: board.material,
      thicknessMm: board.thicknessMm,
    };

    const midX = (board.box.x[0] + board.box.x[1]) / 2;
    const midY = (board.box.y[0] + board.box.y[1]) / 2;
    const midZ = (board.box.z[0] + board.box.z[1]) / 2;
    const pos3d = to3d(midX, midY, midZ);

    // ── Kinematics Handling (PATH & Law 1 Collision Interlock) ─────────────
    const isDrawer =
      board.id.toLowerCase().includes("drawer") ||
      board.id.toLowerCase().includes("drw") ||
      board.slot.toLowerCase().includes("drawer") ||
      (board.source && (board.source.toLowerCase().includes("drawer") || board.source.toLowerCase().includes("drw")));

    const isDoor = board.role === "front" && !isDrawer;

    // Logical identifier for kinematics tracking
    const logicalDrawerId = board.source && (board.source.toLowerCase().includes("drawer") || board.source.toLowerCase().includes("drw"))
      ? board.source
      : board.id.replace(/-(side-left|side-right|subfront|back|bottom|front)$/, "");

    const kinVal = isDrawer
      ? (opts.kinematics?.[logicalDrawerId] ?? opts.kinematics?.[board.id] ?? (board.source ? opts.kinematics?.[board.source] : 0) ?? 0)
      : (opts.kinematics?.[board.id] ?? 0);

    if (isDoor && kinVal > 0) {
      const kinGroup = new THREE.Group();
      kinGroup.name = `kinematic-group-${board.id}`;

      // Door hinged on left (or right if id/source implies)
      const hingeOnRight = board.id.includes("right");
      const pivotXMm = hingeOnRight ? board.box.x[1] : board.box.x[0];
      const pivotZMm = board.box.z[0];
      const pivot3d = to3d(pivotXMm, midY, pivotZMm);

      kinGroup.position.copy(pivot3d);
      const swingSign = hingeOnRight ? 1 : -1;
      // 110 degree opening angle for full European clearance
      kinGroup.rotation.y = swingSign * THREE.MathUtils.degToRad(110) * kinVal;

      // Position mesh relative to hinge pivot
      const localOffX = (midX - pivotXMm) / 1000;
      const localOffZ = -(midZ - pivotZMm) / 1000;
      mesh.position.set(localOffX, 0, localOffZ);

      kinGroup.add(mesh);
      root.add(kinGroup);

      // Law 1 Collision Check: Check if open door collides with other boards
      if (kinVal > 0.8) {
        const doorWorldBox = new THREE.Box3().setFromObject(mesh);
        for (const other of evaluated.boards) {
          if (other.id === board.id || other.role === "front") continue;
          const otherMid = to3d(
            (other.box.x[0] + other.box.x[1]) / 2,
            (other.box.y[0] + other.box.y[1]) / 2,
            (other.box.z[0] + other.box.z[1]) / 2,
          );
          const otherExt = new THREE.Vector3(
            (other.box.x[1] - other.box.x[0]) / 2000,
            (other.box.y[1] - other.box.y[0]) / 2000,
            (other.box.z[1] - other.box.z[0]) / 2000,
          );
          const otherWorldBox = new THREE.Box3(
            otherMid.clone().sub(otherExt),
            otherMid.clone().add(otherExt),
          );

          if (doorWorldBox.intersectsBox(otherWorldBox)) {
            collisions.push({
              boardId: board.id,
              obstacleId: other.id,
              type: "mesh_overlap",
              message: "Створка упирается в деталь корпуса",
            });
            // Highlight collided front in amber (Law 1)
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
          }
        }
      }
    } else if (isDrawer && kinVal > 0) {
      const kinGroup = new THREE.Group();
      kinGroup.name = `kinematic-group-${board.id}`;

      // Check if internal drawer behind an outer door
      const coveringDoor = evaluated.boards.find((d) => {
        if (d.id === board.id || d.role !== "front") return false;
        const dIsDrawer =
          d.id.toLowerCase().includes("drawer") ||
          d.id.toLowerCase().includes("drw") ||
          d.slot.toLowerCase().includes("drawer");
        if (dIsDrawer) return false;
        // Outer door is in front of the drawer
        if (d.box.z[0] > board.box.z[0] + 10) return false;
        const xOverlap = Math.max(board.box.x[0], d.box.x[0]) < Math.min(board.box.x[1], d.box.x[1]);
        const yOverlap = Math.max(board.box.y[0], d.box.y[0]) < Math.min(board.box.y[1], d.box.y[1]);
        return xOverlap && yOverlap;
      });

      const maxTravelM = Math.min(0.45, Math.max(0.2, (extentOf(board.box, "z") || 450) * 0.75 / 1000));
      let effectiveTravelM = maxTravelM * kinVal;

      if (coveringDoor) {
        const doorKin = opts.kinematics?.[coveringDoor.id] ?? 0;
        const doorAngleDeg = 110 * doorKin;
        const isDoorOpen90 = doorAngleDeg >= 90;

        if (!isDoorOpen90) {
          // ── INTERLOCK 1: Door Closed or < 90° -> Movement Blocked ─────────
          effectiveTravelM = 0.005; // Arrested at inner face of door
          (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);

          if (!collisions.some((c) => c.boardId === logicalDrawerId && c.type === "door_blocked")) {
            collisions.push({
              boardId: logicalDrawerId,
              obstacleId: coveringDoor.id,
              type: "door_blocked",
              side: coveringDoor.id.includes("right") ? "right" : "left",
              position: to3d(midX, midY, coveringDoor.box.z[1]),
              message: `Фасад «${coveringDoor.id}» закрыт (<90°). Движение ящика заблокировано.`,
            });
          }
        } else {
          // ── INTERLOCK 2: Door Open >= 90°, Hinge Protrusion Strike ────────
          const hingeSide = coveringDoor.id.includes("right") ? "right" : "left";
          const leftGable = evaluated.boards.find((b2) => b2.role === "side" && b2.box.x[0] <= 2);
          const rightGable = evaluated.boards.find((b2) => b2.role === "side" && b2.box.x[1] >= (extentOf(evaluated.bodyBox, "x") - 2));

          const gableInnerX = hingeSide === "left"
            ? (leftGable ? leftGable.box.x[1] : 16)
            : (rightGable ? rightGable.box.x[0] : extentOf(evaluated.bodyBox, "x") - 16);

          // Check if drawer has a spacer on the hinge side
          const hasSpacer = hingeSide === "left"
            ? board.box.x[0] - gableInnerX >= 24.5 || evaluated.boards.some((b2) => b2.role === "filler" && b2.box.x[0] < gableInnerX + 26)
            : gableInnerX - board.box.x[1] >= 24.5 || evaluated.boards.some((b2) => b2.role === "filler" && b2.box.x[1] > gableInnerX - 26);

          if (!hasSpacer) {
            // Collision: drawer strikes standard hinge (25mm protrusion)
            effectiveTravelM = Math.min(0.035, maxTravelM);
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);

            const hingeX = hingeSide === "left" ? gableInnerX + 25 : gableInnerX - 25;
            const hingePos = to3d(hingeX, midY, 37);

            if (!collisions.some((c) => c.boardId === logicalDrawerId && c.type === "hinge_strike")) {
              collisions.push({
                boardId: logicalDrawerId,
                obstacleId: `${coveringDoor.id}-hinge`,
                type: "hinge_strike",
                side: hingeSide,
                protrusionMm: 25,
                position: hingePos,
                message: "Удар о петлю: стандартная петля входит в проём на 25 мм. Требуется проставка 25 мм.",
              });

              // 3D Amber Pulsing Marker at the collision strike point
              const markerGroup = new THREE.Group();
              markerGroup.name = "collision-marker-hinge-strike";
              markerGroup.position.copy(hingePos);

              const sphereMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.014, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
              );
              markerGroup.add(sphereMesh);

              const ringMesh = new THREE.Mesh(
                new THREE.RingGeometry(0.018, 0.026, 24),
                new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }),
              );
              ringMesh.rotation.x = Math.PI / 2;
              markerGroup.add(ringMesh);

              root.add(markerGroup);
            }
          }
        }
      }

      kinGroup.position.copy(pos3d);
      kinGroup.position.z += effectiveTravelM;
      mesh.position.set(0, 0, 0);
      kinGroup.add(mesh);
      root.add(kinGroup);
    } else {
      mesh.position.copy(pos3d);
      root.add(mesh);
    }

    boardMeshes.set(board.id, mesh);

    // ── 2. Edge Handles for DRAG gesture (Touch-first >= 44dp ergonomics) ────
    const isDoorOpen = isDoor && kinVal > 0.05;
    if (opts.interactiveEdges && ((board.role === "front" && !isDoorOpen) || opts.selectedBoardId === board.id)) {
      const handleThicknessM = 0.044; // 44mm physical depth zone
      const handleReachM = 0.044;     // 44mm reach zone for easy finger grab

      const edgeConfigs: { edge: FaceName; w: number; h: number; d: number; offX: number; offY: number; offZ: number }[] = [
        { edge: "bottom", w: wM, h: handleReachM, d: handleThicknessM, offX: 0, offY: -hM / 2, offZ: 0 },
        { edge: "top", w: wM, h: handleReachM, d: handleThicknessM, offX: 0, offY: hM / 2, offZ: 0 },
        { edge: "left", w: handleReachM, h: hM, d: handleThicknessM, offX: -wM / 2, offY: 0, offZ: 0 },
        { edge: "right", w: handleReachM, h: hM, d: handleThicknessM, offX: wM / 2, offY: 0, offZ: 0 },
      ];

      for (const ec of edgeConfigs) {
        const isHovered = opts.hoveredEdge?.boardId === board.id && opts.hoveredEdge?.edge === ec.edge;
        const isDragged = opts.draggedEdge?.boardId === board.id && opts.draggedEdge?.edge === ec.edge;
        const isHoveredOrDragged = isHovered || isDragged;

        const edgeGeo = new THREE.BoxGeometry(ec.w, ec.h, ec.d);
        const edgeMat = new THREE.MeshBasicMaterial({
          color: isHoveredOrDragged ? 0x06b6d4 : 0x2563eb,
          transparent: true,
          opacity: isHoveredOrDragged ? 0.85 : 0.12,
          depthTest: false,
        });
        disposables.push(edgeGeo, edgeMat);

        const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
        edgeMesh.position.set(pos3d.x + ec.offX, pos3d.y + ec.offY, pos3d.z + ec.offZ);
        edgeMesh.userData = {
          isEdgeHandle: true,
          boardId: board.id,
          edge: ec.edge,
        };
        root.add(edgeMesh);
        edgeHandles.push(edgeMesh);

        // ── Cyan Rubberband Guides for Front Bottom Overhang ─────────────────
        if (ec.edge === "bottom" && opts.showRubberband !== false) {
          const hasOffset = Math.abs(board.box.y[0] - slotBox.y[0]) > 0.5;

          if (isHoveredOrDragged || hasOffset) {
            const nomYMm = slotBox.y[0];
            const frontYMm = board.box.y[0];
            const x0Mm = board.box.x[0];
            const x1Mm = board.box.x[1];
            const zFrontMm = board.box.z[0] - 2; // 2mm proud of facade

            const pNomLeft = to3d(x0Mm, nomYMm, zFrontMm);
            const pNomRight = to3d(x1Mm, nomYMm, zFrontMm);
            const pFrontLeft = to3d(x0Mm, frontYMm, zFrontMm);
            const pFrontRight = to3d(x1Mm, frontYMm, zFrontMm);

            // 1. Carcass nominal baseline (dashed cyan)
            const baseGeo = new THREE.BufferGeometry().setFromPoints([pNomLeft, pNomRight]);
            const baseMat = new THREE.LineDashedMaterial({
              color: 0x06b6d4,
              dashSize: 0.025,
              gapSize: 0.015,
              depthTest: false,
            });
            disposables.push(baseGeo, baseMat);
            const baseLine = new THREE.Line(baseGeo, baseMat);
            baseLine.computeLineDistances();
            baseLine.renderOrder = 999;
            root.add(baseLine);

            // 2. Vertical rubberband extension guidelines (stretch with drag)
            const extGeo = new THREE.BufferGeometry().setFromPoints([
              pNomLeft, pFrontLeft,
              pNomRight, pFrontRight,
            ]);
            const extMat = new THREE.LineSegments(
              extGeo,
              new THREE.LineBasicMaterial({
                color: isHoveredOrDragged ? 0x22d3ee : 0x0284c7,
                linewidth: 2,
                depthTest: false,
              }),
            );
            extMat.renderOrder = 999;
            disposables.push(extGeo, extMat.material as THREE.Material);
            root.add(extMat);

            // 3. Glowing bottom edge guide bar
            const edgeBarGeo = new THREE.BufferGeometry().setFromPoints([pFrontLeft, pFrontRight]);
            const edgeBarMat = new THREE.LineBasicMaterial({
              color: isHoveredOrDragged ? 0x38bdf8 : 0x06b6d4,
              linewidth: 3,
              depthTest: false,
            });
            disposables.push(edgeBarGeo, edgeBarMat);
            const edgeBarLine = new THREE.Line(edgeBarGeo, edgeBarMat);
            edgeBarLine.renderOrder = 999;
            root.add(edgeBarLine);
          }
        }
      }
    }
  }

  // ── 3. Dual Bounds Visualization ──────────────────────────────────────────
  // A. Slot Box (Nominal App 1 envelope in cyan dashed wireframe)
  if (opts.showSlotBox !== false) {
    const slotWM = (slotBox.x[1] - slotBox.x[0]) / 1000;
    const slotHM = (slotBox.y[1] - slotBox.y[0]) / 1000;
    const slotDM = (slotBox.z[1] - slotBox.z[0]) / 1000;

    const slotBoxGeo = new THREE.BoxGeometry(slotWM, slotHM, slotDM);
    const slotEdgesGeo = new THREE.EdgesGeometry(slotBoxGeo);
    const slotMat = new THREE.LineDashedMaterial({
      color: 0x06b6d4,
      dashSize: 0.04,
      gapSize: 0.02,
    });
    disposables.push(slotBoxGeo, slotEdgesGeo, slotMat);

    const slotLine = new THREE.LineSegments(slotEdgesGeo, slotMat);
    slotLine.computeLineDistances();
    slotLine.position.set(0, slotHM / 2, 0);
    slotLine.name = "slotBox-wireframe";
    root.add(slotLine);
  }

  // B. Body Box (True physical boundary with overhangs in solid accent line #2f6fed)
  if (opts.showBodyBox) {
    const body = evaluated.bodyBox;
    const bodyWM = (body.x[1] - body.x[0]) / 1000;
    const bodyHM = (body.y[1] - body.y[0]) / 1000;
    const bodyDM = (body.z[1] - body.z[0]) / 1000;

    const bodyBoxGeo = new THREE.BoxGeometry(bodyWM, bodyHM, bodyDM);
    const bodyEdgesGeo = new THREE.EdgesGeometry(bodyBoxGeo);
    const bodyMat = new THREE.LineBasicMaterial({
      color: 0x2f6fed,
      linewidth: 2,
    });
    disposables.push(bodyBoxGeo, bodyEdgesGeo, bodyMat);

    const bodyLine = new THREE.LineSegments(bodyEdgesGeo, bodyMat);
    const midX = (body.x[0] + body.x[1]) / 2;
    const midY = (body.y[0] + body.y[1]) / 2;
    const midZ = (body.z[0] + body.z[1]) / 2;
    bodyLine.position.copy(to3d(midX, midY, midZ));
    bodyLine.name = "bodyBox-wireframe";
    root.add(bodyLine);
  }

  // ── 4. X-Ray Drillings Overlay (F1) ────────────────────────────────────────
  let drillingsGroup: THREE.Group | undefined;
  if (opts.xray && evaluated.drillings.length > 0) {
    drillingsGroup = new THREE.Group();
    drillingsGroup.name = "drillings-overlay";

    const boardById = new Map<string, Board>(evaluated.boards.map((b) => [b.id, b]));

    for (const proj of evaluated.drillings) {
      const board = boardById.get(proj.boardId);
      if (!board) continue;

      for (const hole of proj.holes) {
        const radiusM = Math.max(0.002, (hole.diameter / 2) / 1000);
        const depthM = Math.max(0.003, hole.depth / 1000);

        const cylGeo = new THREE.CylinderGeometry(radiusM, radiusM, depthM, 12);
        const cylMat = new THREE.MeshBasicMaterial({
          color: HOLE_COLORS[hole.purpose] ?? 0xff0000,
        });
        disposables.push(cylGeo, cylMat);

        const cyl = new THREE.Mesh(cylGeo, cylMat);

        // Position cylinder according to face and thin axis
        let hx = 0;
        let hy = 0;
        let hz = 0;

        if (board.thin === "x") {
          // Gable / side board in Y-Z plane
          const xFace = hole.face === "inner" ? board.box.x[1] : board.box.x[0];
          hx = xFace;
          hy = board.box.y[0] + hole.y;
          hz = board.box.z[0] + hole.x;
          cyl.rotation.z = Math.PI / 2;
        } else if (board.thin === "y") {
          // Horizontal shelf / bottom / top in X-Z plane
          const yFace = hole.face === "edge" ? (board.box.y[0] + board.box.y[1]) / 2 : board.box.y[1];
          hx = board.box.x[0] + (hole.face === "edge" ? 0 : hole.x);
          hy = yFace;
          hz = board.box.z[0] + hole.x;
          if (hole.face === "edge") cyl.rotation.z = Math.PI / 2;
        } else {
          // Front or back in X-Y plane
          hx = board.box.x[0] + hole.x;
          hy = board.box.y[0] + hole.y;
          hz = hole.face === "inner" ? board.box.z[1] : board.box.z[0];
          cyl.rotation.x = Math.PI / 2;
        }

        cyl.position.copy(to3d(hx, hy, hz));
        drillingsGroup.add(cyl);
      }
    }
    root.add(drillingsGroup);
  }

  // ── 5. Volumetric Split Preview (SPLIT gesture) ───────────────────────────
  if (opts.splitPlane) {
    const spaceBox = evaluated.spaces[opts.splitPlane.spaceId];
    if (spaceBox) {
      const sp = opts.splitPlane;
      const ratio = Math.max(0.05, Math.min(0.95, sp.posRatio));

      let planeGeo: THREE.PlaneGeometry;
      let planePos: THREE.Vector3;
      let rot = new THREE.Euler(0, 0, 0);

      const sWM = (spaceBox.x[1] - spaceBox.x[0]) / 1000;
      const sHM = (spaceBox.y[1] - spaceBox.y[0]) / 1000;
      const sDM = (spaceBox.z[1] - spaceBox.z[0]) / 1000;

      if (sp.axis === "x") {
        // Vertical divider plane
        planeGeo = new THREE.PlaneGeometry(sDM, sHM);
        rot = new THREE.Euler(0, Math.PI / 2, 0);
        const cutX = spaceBox.x[0] + (spaceBox.x[1] - spaceBox.x[0]) * ratio;
        const midY = (spaceBox.y[0] + spaceBox.y[1]) / 2;
        const midZ = (spaceBox.z[0] + spaceBox.z[1]) / 2;
        planePos = to3d(cutX, midY, midZ);
      } else if (sp.axis === "y") {
        // Horizontal shelf plane
        planeGeo = new THREE.PlaneGeometry(sWM, sDM);
        rot = new THREE.Euler(Math.PI / 2, 0, 0);
        const midX = (spaceBox.x[0] + spaceBox.x[1]) / 2;
        const cutY = spaceBox.y[0] + (spaceBox.y[1] - spaceBox.y[0]) * ratio;
        const midZ = (spaceBox.z[0] + spaceBox.z[1]) / 2;
        planePos = to3d(midX, cutY, midZ);
      } else {
        // Z plane
        planeGeo = new THREE.PlaneGeometry(sWM, sHM);
        const midX = (spaceBox.x[0] + spaceBox.x[1]) / 2;
        const midY = (spaceBox.y[0] + spaceBox.y[1]) / 2;
        const cutZ = spaceBox.z[0] + (spaceBox.z[1] - spaceBox.z[0]) * ratio;
        planePos = to3d(midX, midY, cutZ);
      }

      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      });
      disposables.push(planeGeo, planeMat);

      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.copy(planePos);
      planeMesh.rotation.copy(rot);
      planeMesh.name = "split-preview-plane";
      root.add(planeMesh);
    }
  }

  // ── 6. Interactive Volumetric Spaces (Void selection & highlight) ─────────
  const spaceHitboxes: THREE.Mesh[] = [];
  for (const [spaceId, spaceBox] of Object.entries(evaluated.spaces)) {
    // Only leaf spaces are interactive
    const isParent = Object.entries(evaluated.spaces).some(([otherId, otherBox]) => {
      if (otherId === spaceId) return false;
      return (
        otherBox.x[0] >= spaceBox.x[0] - 1 &&
        otherBox.x[1] <= spaceBox.x[1] + 1 &&
        otherBox.y[0] >= spaceBox.y[0] - 1 &&
        otherBox.y[1] <= spaceBox.y[1] + 1 &&
        otherBox.z[0] >= spaceBox.z[0] - 1 &&
        otherBox.z[1] <= spaceBox.z[1] + 1
      );
    });
    if (isParent) continue;

    const sWM = Math.max(0.01, (spaceBox.x[1] - spaceBox.x[0]) / 1000);
    const sHM = Math.max(0.01, (spaceBox.y[1] - spaceBox.y[0]) / 1000);
    const sDM = Math.max(0.01, (spaceBox.z[1] - spaceBox.z[0]) / 1000);

    const isSelected = opts.selectedSpaceId === spaceId;
    const isHovered = opts.hoveredSpaceId === spaceId;

    const spaceGeo = new THREE.BoxGeometry(sWM, sHM, sDM);
    const spaceMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x06b6d4 : 0x38bdf8,
      transparent: true,
      opacity: isSelected ? 0.35 : isHovered ? 0.15 : 0.001,
      depthWrite: false,
    });
    disposables.push(spaceGeo, spaceMat);

    const spaceMesh = new THREE.Mesh(spaceGeo, spaceMat);
    const midX = (spaceBox.x[0] + spaceBox.x[1]) / 2;
    const midY = (spaceBox.y[0] + spaceBox.y[1]) / 2;
    const midZ = (spaceBox.z[0] + spaceBox.z[1]) / 2;
    spaceMesh.position.copy(to3d(midX, midY, midZ));
    spaceMesh.userData = {
      isSpace: true,
      spaceId,
    };

    if (isSelected || isHovered) {
      const edgesGeo = new THREE.EdgesGeometry(spaceGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0x22d3ee : 0x0284c7,
        linewidth: isSelected ? 2 : 1,
        depthTest: false,
      });
      disposables.push(edgesGeo, edgesMat);
      const wireframe = new THREE.LineSegments(edgesGeo, edgesMat);
      wireframe.renderOrder = 998;
      spaceMesh.add(wireframe);
    }

    root.add(spaceMesh);
    spaceHitboxes.push(spaceMesh);
  }

  // ── 7. Push-Pull Face Handles for Root Cube (Direct W, H, D resize) ───────
  const cubeHandles: THREE.Mesh[] = [];
  if (opts.showCubeHandles !== false) {
    const handleThicknessM = 0.035;
    const handlePadM = 0.08;

    // Right gable handle: drag X to stretch Width
    const wGeo = new THREE.BoxGeometry(handleThicknessM, handlePadM, handlePadM);
    const wMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    disposables.push(wGeo, wMat);
    const wHandle = new THREE.Mesh(wGeo, wMat);
    wHandle.position.copy(to3d(slotBox.x[1] + 15, (slotBox.y[0] + slotBox.y[1]) / 2, (slotBox.z[0] + slotBox.z[1]) / 2));
    wHandle.userData = { isCubeHandle: true, axis: "x", sign: 1, label: "Ширина" };
    root.add(wHandle);
    cubeHandles.push(wHandle);

    // Top lid handle: drag Y to stretch Height
    const hGeo = new THREE.BoxGeometry(handlePadM, handleThicknessM, handlePadM);
    const hMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    disposables.push(hGeo, hMat);
    const hHandle = new THREE.Mesh(hGeo, hMat);
    hHandle.position.copy(to3d((slotBox.x[0] + slotBox.x[1]) / 2, slotBox.y[1] + 15, (slotBox.z[0] + slotBox.z[1]) / 2));
    hHandle.userData = { isCubeHandle: true, axis: "y", sign: 1, label: "Высота" };
    root.add(hHandle);
    cubeHandles.push(hHandle);

    // Front face handle: drag Z to stretch Depth
    const dGeo = new THREE.BoxGeometry(handlePadM, handlePadM, handleThicknessM);
    const dMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
    disposables.push(dGeo, dMat);
    const dHandle = new THREE.Mesh(dGeo, dMat);
    dHandle.position.copy(to3d((slotBox.x[0] + slotBox.x[1]) / 2, (slotBox.y[0] + slotBox.y[1]) / 2, slotBox.z[0] - 15));
    dHandle.userData = { isCubeHandle: true, axis: "z", sign: -1, label: "Глубина" };
    root.add(dHandle);
    cubeHandles.push(dHandle);
  }

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    group: root,
    boardMeshes,
    edgeHandles,
    spaceHitboxes,
    cubeHandles,
    drillingsGroup,
    collisions,
    dispose,
  };
}

function extentOf(b: Box, a: Axis): number {
  return b[a][1] - b[a][0];
}
