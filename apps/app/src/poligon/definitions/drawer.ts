// apps/app/src/poligon/definitions/drawer.ts
//
// DECLARATIVE 5-PIECE DRAWER BOX DEFINITION (DB/58 §1.2 & §2.4).
//
// THE LAW: No hardcoded drawer enum in the kernel. A drawer is a parametric assembly:
// 1. Five connected Parts:
//    - Left and Right sides: thickness locked to 16mm board.
//    - Front and Back sub-walls: width = CavityWidth - 2 * 12.7mm (slide gap) - 2 * 16mm (sides).
//    - Bottom: locked to drawer footprint.
// 2. Motion Path: translation along -Z (opening towards camera).
// 3. Slide clearance invariance:
//    When CavityWidth expands (e.g. 600 -> 800 mm), the 12.7mm slide clearance is strictly preserved.

import type { Board, Box } from "../model/space";
import type { Role } from "../model/roles";

export interface DrawerParams {
  id: string;
  cavityWidthMm: number;
  cavityHeightMm: number;
  cavityDepthMm: number;
  /** Slide clearance per side, default 12.7mm (System 32 ball-bearing / undermount) */
  slideClearanceMm?: number;
  /** Carcass / box board thickness, default 16mm */
  sideThicknessMm?: number;
  /** Bottom panel thickness, default 16mm (or 4mm HDF) */
  bottomThicknessMm?: number;
  /** Drawer box height, default 120mm */
  boxHeightMm?: number;
  /** Drawer box depth, default 450mm (or cavityDepth - 50mm) */
  boxDepthMm?: number;
  /** Slot name, default 'carcass' */
  slot?: string;
  /** Material name, default 'LDSP 16 White' */
  material?: string;
}

export interface DrawerKinematicPath {
  type: "slide";
  axis: "z";
  travelMm: number;
}

export interface DrawerAssembly {
  id: string;
  boards: Board[];
  path: DrawerKinematicPath;
  bounds: Box;
  clearanceVerified: boolean;
}

export const DEFAULT_SLIDE_CLEARANCE_MM = 12.7;
export const DEFAULT_SIDE_THICKNESS_MM = 16;
export const DEFAULT_BOX_HEIGHT_MM = 120;
export const DEFAULT_DRAWER_SETBACK_Z_MM = 10;

/**
 * Generates the 5 connected boards of a drawer box positioned inside a host cavity.
 */
export function createDrawerBox(params: DrawerParams): DrawerAssembly {
  const slideClearance = params.slideClearanceMm ?? DEFAULT_SLIDE_CLEARANCE_MM;
  const sideT = params.sideThicknessMm ?? DEFAULT_SIDE_THICKNESS_MM;
  const bottomT = params.bottomThicknessMm ?? sideT;
  const boxH = params.boxHeightMm ?? DEFAULT_BOX_HEIGHT_MM;
  const boxD = params.boxDepthMm ?? Math.max(250, params.cavityDepthMm - 50);
  const slot = params.slot ?? "carcass";
  const material = params.material ?? "LDSP 16 White";

  // Invariant width computation:
  // Subfront width = Cavity - 2 * slideClearance - 2 * sideThickness
  const boxOuterWidth = params.cavityWidthMm - 2 * slideClearance;
  const subfrontWidth = boxOuterWidth - 2 * sideT;

  const x0 = slideClearance;
  const x1 = params.cavityWidthMm - slideClearance;
  const y0 = 10; // Clearance above cavity floor
  const y1 = y0 + boxH;
  const z0 = DEFAULT_DRAWER_SETBACK_Z_MM;
  const z1 = z0 + boxD;

  // 1. Left drawer side
  const leftSide: Board = {
    id: `${params.id}-side-left`,
    role: "side" as Role,
    slot,
    material,
    thicknessMm: sideT,
    thin: "x",
    box: {
      x: [x0, x0 + sideT],
      y: [y0, y1],
      z: [z0, z1],
    },
    source: params.id,
  };

  // 2. Right drawer side
  const rightSide: Board = {
    id: `${params.id}-side-right`,
    role: "side" as Role,
    slot,
    material,
    thicknessMm: sideT,
    thin: "x",
    box: {
      x: [x1 - sideT, x1],
      y: [y0, y1],
      z: [z0, z1],
    },
    source: params.id,
  };

  // 3. Front sub-wall (inner front of drawer box)
  const subfront: Board = {
    id: `${params.id}-subfront`,
    role: "front" as Role,
    slot,
    material,
    thicknessMm: sideT,
    thin: "z",
    box: {
      x: [x0 + sideT, x1 - sideT],
      y: [y0, y1],
      z: [z0, z0 + sideT],
    },
    source: params.id,
  };

  // 4. Back wall
  const backWall: Board = {
    id: `${params.id}-back`,
    role: "back" as Role,
    slot,
    material,
    thicknessMm: sideT,
    thin: "z",
    box: {
      x: [x0 + sideT, x1 - sideT],
      y: [y0, y1],
      z: [z1 - sideT, z1],
    },
    source: params.id,
  };

  // 5. Bottom panel
  const bottom: Board = {
    id: `${params.id}-bottom`,
    role: "bottom" as Role,
    slot,
    material,
    thicknessMm: bottomT,
    thin: "y",
    box: {
      x: [x0, x1],
      y: [y0, y0 + bottomT],
      z: [z0, z1],
    },
    source: params.id,
  };

  const boards = [leftSide, rightSide, subfront, backWall, bottom];

  const bounds: Box = {
    x: [x0, x1],
    y: [y0, y1],
    z: [z0, z1],
  };

  // Verify slide clearance invariance:
  // The gap between left side and 0 must be exactly slideClearance
  // The gap between right side and cavityWidth must be exactly slideClearance
  const leftGap = leftSide.box.x[0];
  const rightGap = params.cavityWidthMm - rightSide.box.x[1];
  const clearanceVerified =
    Math.abs(leftGap - slideClearance) < 0.001 &&
    Math.abs(rightGap - slideClearance) < 0.001 &&
    subfrontWidth > 0;

  return {
    id: params.id,
    boards,
    path: {
      type: "slide",
      axis: "z",
      travelMm: boxD * 0.75, // 75% slide extension
    },
    bounds,
    clearanceVerified,
  };
}
