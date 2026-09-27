// apps/app/src/poligon/definitions/hinged_door.ts
//
// DECLARATIVE HINGED DOOR DEFINITION (DB/58 §1.2 & §2.4).
//
// Combines:
// 1. Front entity (slot, covers, delta, mount).
// 2. Kinematic Path: Rotational swing around hinge side Y-axis (95°–110°).
// 3. Dual-drilling Contact projection:
//    - On facade: Ø35mm hinge cup holes (21.5mm edge setback, 12.5mm depth).
//    - On carcass gable: System 32 mounting plate holes (37mm setback, 32mm hole pitch).

import type { Front, FaceName, Hole } from "../model/space";

export interface HingedDoorParams {
  id: string;
  covers: string[];
  side: "left" | "right";
  /** Overlay type: full (16mm), half (8mm), or inset (-2mm). Default 16mm */
  overlayMm?: number;
  /** Opening angle, default 110 degrees */
  openingAngleDeg?: number;
  /** Front thickness, default 18mm */
  thicknessMm?: number;
  /** Edge deltas: bottom overhang (e.g. 25mm for Gola) */
  delta?: Partial<Record<FaceName, number>>;
  /** Slot name, default 'facade' */
  slot?: string;
  /** Height of front in mm (for vertical hinge count and hole distribution) */
  heightMm: number;
}

export interface DoorKinematicPath {
  type: "rotation";
  axis: "y";
  pivotSide: "left" | "right";
  angleDeg: number;
}

export interface ContactDrillingPair {
  facadeHoles: Hole[];
  carcassPlateHoles: Hole[];
}

export interface HingedDoorAssembly {
  front: Front;
  path: DoorKinematicPath;
  drillings: ContactDrillingPair;
  hingeCount: number;
}

export const CUP_DIAMETER_MM = 35;
export const CUP_DEPTH_MM = 12.5;
export const CUP_EDGE_SETBACK_MM = 21.5; // K = 4mm + 35/2 = 21.5mm from door edge
export const PLATE_FRONT_SETBACK_MM = 37; // System 32 datum
export const PLATE_HOLE_PITCH_MM = 32;   // System 32 32mm spacing
export const HINGE_END_MARGIN_MM = 100;  // 100mm from top/bottom edge

/**
 * Creates a declarative hinged door with its kinematic path and dual drilling contact projection.
 */
export function createHingedDoor(params: HingedDoorParams): HingedDoorAssembly {
  const angleDeg = params.openingAngleDeg ?? 110;
  const slot = params.slot ?? "facade";

  // Calculate hinge count based on height
  const h = params.heightMm;
  const hingeCount = h < 900 ? 2 : h < 1600 ? 3 : 4;

  // Front definition for kernel
  const front: Front = {
    id: params.id,
    covers: params.covers,
    slot,
    mount: {
      thing: "hinge_standard",
      side: params.side,
    },
    delta: params.delta,
  };

  // Kinematic path definition
  const path: DoorKinematicPath = {
    type: "rotation",
    axis: "y",
    pivotSide: params.side,
    angleDeg,
  };

  // Calculate hole positions along height
  const yPositions: number[] = [];
  yPositions.push(HINGE_END_MARGIN_MM);
  yPositions.push(h - HINGE_END_MARGIN_MM);
  if (hingeCount >= 3) {
    yPositions.push(h / 2);
  }
  if (hingeCount >= 4) {
    yPositions.push(h / 3);
    yPositions.push((2 * h) / 3);
  }

  // 1. Facade holes (Ø35mm cup)
  const facadeHoles: Hole[] = yPositions.map((y) => ({
    x: CUP_EDGE_SETBACK_MM,
    y,
    diameter: CUP_DIAMETER_MM,
    depth: CUP_DEPTH_MM,
    face: "inner",
    purpose: "hinge",
  }));

  // 2. Carcass mounting plate holes (System 32 on gable)
  const carcassPlateHoles: Hole[] = [];
  for (const y of yPositions) {
    // Top screw hole
    carcassPlateHoles.push({
      x: PLATE_FRONT_SETBACK_MM,
      y: y + PLATE_HOLE_PITCH_MM / 2,
      diameter: 5,
      depth: 13,
      face: "inner",
      purpose: "runner", // System 32 euro-screw
    });
    // Bottom screw hole
    carcassPlateHoles.push({
      x: PLATE_FRONT_SETBACK_MM,
      y: y - PLATE_HOLE_PITCH_MM / 2,
      diameter: 5,
      depth: 13,
      face: "inner",
      purpose: "runner",
    });
  }

  return {
    front,
    path,
    drillings: {
      facadeHoles,
      carcassPlateHoles,
    },
    hingeCount,
  };
}
