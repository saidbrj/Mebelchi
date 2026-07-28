// THE vertical stack. One definition of how tall a module is and where it sits, read by every
// view — 3D, front elevation, 2D plan, PDF drawings — and by the clash test.
//
// Why it lives in its own file: `resolve.ts` used to own this, but `resolve.ts` imports
// `footprint.ts`, and `footprint.ts` needs the band to answer "do these two modules collide?".
// That's a cycle. Splitting the stack out (it depends on nothing but GEOM and the Cabinet type)
// lets the footprint reason about height without inverting the graph. `resolve.ts` re-exports
// everything here, so no call site outside these two files changed.
//
// Pure. No React, no store.

import type { Cabinet } from "./cabinet";
import { GEOM } from "./layout";

/** Default depth per kind (mm) — a per-module `depth` overrides it. */
export const FOOT_DEPTH_MM: Record<Cabinet["kind"], number> = { base: 560, tall: 560, upper: 350 };

/** THE depth of a module (mm). Honours a per-module `depth` override — several call sites
 *  used to silently ignore it, so a 400mm-deep base priced/cut as 560. */
export function cabDepth(c: Cabinet): number {
  return c.depth ?? FOOT_DEPTH_MM[c.kind] ?? 560;
}

/** Default hood mount (its underside clears the worktop by 560mm). */
export const HOOD_BOTTOM = GEOM.plinth + GEOM.baseH + GEOM.worktop + 560; // 1420

/** The default wall-unit mounting height (mm above floor) — where an upper lands with no `mountY`. */
export const UPPER_BOTTOM = GEOM.upperBottom;

/** The vertical extent of a module, mm above the floor. ONE definition of the vertical stack
 *  (the 3D used metres + a hardcoded 2.2m tall top; the elevation used `plinth + h`). */
export interface Band {
  /** occupied band — used for collision / fill / "does this block that" */
  y0: number;
  y1: number;
  /** the carcass box itself (for a base this sits under the worktop) */
  carcass0: number;
  carcass1: number;
  hasWorktop: boolean;
}

export function cabBand(c: Cabinet): Band {
  if (c.kind === "upper") {
    const y0 = c.mountY ?? (c.appliance === "hood" ? HOOD_BOTTOM : GEOM.upperBottom);
    return { y0, y1: y0 + c.h, carcass0: y0, carcass1: y0 + c.h, hasWorktop: false };
  }
  if (c.kind === "tall") {
    // honours c.h — the 3D used to pin every tall to 2.2m and ignore the edit entirely
    const top = GEOM.plinth + c.h;
    return { y0: 0, y1: top, carcass0: GEOM.plinth, carcass1: top, hasWorktop: false };
  }
  const carcass1 = GEOM.plinth + c.h;
  return { y0: 0, y1: carcass1 + GEOM.worktop, carcass0: GEOM.plinth, carcass1, hasWorktop: true };
}

/** THE corner body — a 45° chamfer or an L-shaped notch.
 *
 *  This used to be a consequence of the kind (a wall unit was always diagonal, a base one always L),
 *  which is simply untrue of real kitchens: both bodies exist at both heights. The old behaviour is
 *  the default, so nothing already drawn changes. */
export function cornerShapeOf(c: Cabinet): "diagonal" | "l" | "outer" {
  return c.cornerShape ?? (c.kind === "upper" ? "diagonal" : "l");
}

/** An OUTER (convex) corner — a run's angled open end cap. Unlike an inner corner it reserves no
 *  zone, so the run-planning / reanchor / complete-the-L machinery must skip it. */
export function isOuterCorner(c: Cabinet): boolean {
  return !!c.corner && c.cornerShape === "outer";
}

/** The depth of the RUNS a corner unit butts into (mm).
 *
 *  Not the same as the corner's own `depth`, which is the side of the square it fills (840 / 613) —
 *  and that is exactly why the 3D re-derived this from the kind instead of reading it. A deep
 *  (base-depth) antresol needs 560 here even though it is a wall unit. */
export function cornerArm(c: Cabinet): number {
  return c.armDepth ?? FOOT_DEPTH_MM[c.kind] ?? 560;
}

/** shortest module worth having (mm) */
export const MIN_H = 200;

/** depth range a module may be resized to (mm) — a 200mm shallow wall unit up to a 900mm island.
 *  This used to be an unexplained `Math.max(200, Math.min(900, v))` inline in the one screen that
 *  could edit depth at all; now the 3D arrow, the plan's dimension line and the module editor all
 *  clamp against the same two numbers. */
export const D_MIN = 200;
export const D_MAX = 900;

/** THE tallest a module may be, given the room.
 *
 *  Everything used to clamp at a flat 2400mm — so with the 100mm plinth a column topped out at 2500
 *  and could never reach a 2700 ceiling. Every reference kitchen is floor-to-ceiling, so the limit
 *  has to come from the room, not from a constant.
 *
 *  A base is the exception: its height is the COUNTER height, which has its own sane range and is
 *  shared by every base so the worktop stays level. */
export function maxCabH(c: Cabinet, ceiling: number): number {
  if (c.kind === "base") return 1000;
  if (c.kind === "tall") return Math.max(MIN_H, ceiling - GEOM.plinth);
  return Math.max(MIN_H, ceiling - cabBand(c).y0); // an upper grows up from where it hangs
}

/** Do two vertical intervals overlap by more than `tol`? The one test that decides whether two
 *  modules compete for the same space — a base and the upper above it don't; a tall blocks both. */
export function spansOverlap(a: { y0: number; y1: number }, b: { y0: number; y1: number }, tol = 30): boolean {
  return Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > tol;
}

/** Two modules compete for the same horizontal space only if their bands overlap. */
export function bandsOverlap(a: Cabinet, b: Cabinet, tol = 30): boolean {
  return spansOverlap(cabBand(a), cabBand(b), tol);
}
