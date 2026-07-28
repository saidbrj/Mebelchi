// Pricing assumptions — the geometric/manufacturing rules buildBom applies when
// it decomposes a parametric Module into panels, edges, hardware and operations.
//
// These are PLACEHOLDER engineering defaults (a frameless LDSP carcass), not
// rates. Rates live in the RateTable (data). When the Layer-2 parametric solver
// in the engine lands, this decomposition moves behind it; pricing keeps reading
// the same RateTable. Everything here is pure data — no logic, no I/O.

import type { BomKind, QuoteGroup } from "../../schema/src/index.js";

/** Carcass board thickness (LDSP). Used to derive inner widths. */
export const CARCASS_THICKNESS_MM = 16;

/** Facade blank thickness (MDF). The profile is routed INTO this one board — a shaker or a raised
 *  front is not an assembled frame — so the thickness is the same whatever the body. */
export const FACADE_THICKNESS_MM = 18;

/** Glass pane thickness (mm) — a bought insert, not a cut board: no edge banding, no saw line. */
export const GLASS_THICKNESS_MM = 4;

/**
 * Canonical SKUs buildBom emits for the default hardware set. priceProject
 * resolves them against RateTable.hardware by `sku`. These are the seam where a
 * real per-module hardware-selection model would plug in; until then every
 * module uses this default kit. The strings MUST exist in the active RateTable.
 */
export const DEFAULT_HARDWARE_SKUS = {
  hinge: "HNG-CLIP-110",
  slide: "SLIDE-BB-450",
  dowel: "DOWEL-8x30",
  cam: "CAM-MINIFIX-15",
  /** The wall hanger a навесной carcass hangs on. Counted per BOX — see `hangingCount`. */
  hanging: "HANG-BRACKET-01",
} as const;

/**
 * Cam-and-dowel joints in a carcass holding `bays` modules.
 *
 * A box is joined where the top and the bottom meet each VERTICAL panel. A standalone cabinet has
 * two verticals (its two sides) → top×2 + bottom×2 = 4 joints. A carcass merging n modules has
 * n+1 verticals (2 outer sides + n−1 shared stiles) → 2(n+1) joints.
 *
 * `carcassJoints(1) === 4`, so an unmerged run bills exactly what it always did.
 */
export function carcassJoints(bays: number): number {
  return 2 * (Math.max(1, bays) + 1);
}

/** Each joint takes 2 cams + 2 dowels. */
export const CAMS_PER_JOINT = 2;
export const DOWELS_PER_JOINT = 2;

/** Cam-and-dowel joints in a standalone (unmerged) cabinet. */
export const CARCASS_JOINTS = carcassJoints(1); // 4
export const CAMS_PER_MODULE = CARCASS_JOINTS * CAMS_PER_JOINT; // 8
export const DOWELS_PER_MODULE = CARCASS_JOINTS * DOWELS_PER_JOINT; // 8

/** Drilled holes per hinge: 1 cup + 2 mounting-plate marks. */
export const HOLES_PER_HINGE = 3;
/** Adjustable shelf rests on 4 pins → 4 holes. */
export const HOLES_PER_SHELF = 4;
/** One drawer slide set → 4 screw holes (2 per runner). */
export const HOLES_PER_SLIDE_SET = 4;

/** BomLine.kind → the UI quote group it rolls up into (PRICING_AND_SCHEMA.md §4). */
export const KIND_TO_GROUP: Record<BomKind, QuoteGroup> = {
  panel: "carcassFacade",
  labor: "carcassFacade",
  edge: "worktopEdge",
  worktop: "worktopEdge",
  hardware: "hardware",
  operation: "cnc",
  delivery: "delivery",
};

/** Hinges for a single door, by leaf height (mm). */
export function hingesForDoorHeight(heightMm: number): number {
  if (heightMm <= 900) return 2;
  if (heightMm <= 1600) return 3;
  return 4;
}
