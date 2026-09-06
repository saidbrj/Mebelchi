// THE SINK, AND THE HOLE IT NEEDS IN THE COUNTER.
//
// Until now this app drew exactly one sink: a well, a rim sitting ON TOP of the worktop, and a tap.
// The rim above the slab is not a detail — it is what makes a sink НАКЛАДНАЯ, so that single
// hard-coded shape meant врезная, подстольная and integrated could not be expressed at all. A
// designer specifying an undermount stone sink had a drawing of the wrong sink.
//
// THE HOLE IS THE POINT. Every mount but a true overmount is defined by how the bowl meets the cut
// edge of the slab, so the opening has to be real geometry rather than something hidden under a
// rim. It is also a real machining operation that somebody has to pay for and the shop has to cut,
// which is why it is DERIVED here — one definition, read by the 3D and by the quote.
//
// Pure. No React, no store, no THREE.

import { GEOM } from "./layout";
import { cabDepth } from "./bands";
import type { Cabinet } from "./cabinet";

/**
 * HOW THE BOWL MEETS THE SLAB. This is the whole difference between one sink and another.
 *
 * - `overmount` (накладная) — the rim sits on top of the worktop and covers the cut edge. The
 *   cheapest fit, and the only one the app could draw before.
 * - `inset` (врезная) — dropped in from above, its thin rim almost flush. The ordinary modern fit.
 * - `undermount` (подстольная) — fixed under the slab, so the slab's own cut edge is what you see
 *   and there is no lip to catch crumbs. Wants a solid counter, not postforming.
 * - `integrated` (интегрированная) — the bowl is the same material as the worktop, no seam at all.
 */
export type SinkMount = "overmount" | "inset" | "undermount" | "integrated";
export const SINK_MOUNTS: SinkMount[] = ["inset", "overmount", "undermount", "integrated"];

/** A rimless mount shows the slab's own cut edge, so the opening IS the bowl. */
export const isRimless = (m: SinkMount): boolean => m === "undermount" || m === "integrated";

export interface SinkSpec {
  mount: SinkMount;
  /** one bowl or two — a double is two wells under ONE opening, not two holes */
  bowls: 1 | 2;
  /** one bowl's outer footprint (mm) */
  w: number;
  d: number;
  /** how deep the well is (mm) */
  well: number;
  /** shift along the cabinet's width from its centre (mm) — a drainer pushes the bowl to one side */
  offset: number;
}

/**
 * DEFAULT: врезная, one bowl, 450×400.
 *
 * `inset` rather than the `overmount` the old drawing was, because that is what a modern kitchen
 * actually fits and what a client assumes they are getting. It changes how an existing project
 * LOOKS — the rim drops flush — but not what it costs: the opening bills through `millPerM`, which
 * is seeded at 0 until the seller sets their own rate.
 */
export const DEFAULT_SINK: SinkSpec = {
  mount: "inset",
  bowls: 1,
  w: 450,
  d: 400,
  well: 180,
  offset: 0,
};

/** How far a rim laps onto the slab, each side (mm). What makes the opening smaller than the bowl. */
export const SINK_RIM = 12;
/** Slab that must be left standing between the opening and the carcass side (mm). */
export const SINK_RAIL = 40;
/** Slab left behind the bowl for the tap to stand in (mm). */
export const SINK_TAP_ZONE = 90;
/** Slab left in front of the bowl (mm) — the front edge needs a lip, not a knife edge. */
export const SINK_FRONT_RAIL = 45;
/** The gap between the two wells of a double (mm). */
export const SINK_BRIDGE = 20;

/** THE ONE ACCESSOR. Read this, never `c.sink` — an older project has no spec and still has a sink. */
export function sinkOf(c: Cabinet): SinkSpec | null {
  if (c.appliance !== "sink") return null;
  return { ...DEFAULT_SINK, ...(c.sink ?? {}) };
}

/** A rectangle cut out of the counter, in the cabinet's own frame (mm). */
export interface WorktopHole {
  /** the opening's size */
  w: number;
  d: number;
  /** its centre, offset from the cabinet's centre across the width */
  cx: number;
  /** its centre, measured from the WALL */
  cz: number;
}

export const holePerimeter = (h: WorktopHole): number => 2 * (h.w + h.d);

/**
 * THE OPENING THIS SINK NEEDS.
 *
 * The bowl block is one bowl, or two with a bridge between them. A rimmed mount cuts SMALLER than
 * the block, because the rim has to land on slab; a rimless one cuts the block exactly, because
 * there is nothing to cover an overcut with.
 *
 * Then it is made to fit: a hole wider than the cabinet is not a hole, it is a cabinet in two
 * pieces. The rails are what keeps the slab in one piece, and the tap zone is what keeps the tap
 * from standing in the bowl.
 *
 * Returns null when the module is not a sink, or when the cabinet is too small to cut at all.
 */
export function sinkHole(c: Cabinet): WorktopHole | null {
  const s = sinkOf(c);
  if (!s) return null;

  const blockW = s.bowls === 2 ? s.w * 2 + SINK_BRIDGE : s.w;
  const lap = isRimless(s.mount) ? 0 : SINK_RIM;
  let w = blockW - 2 * lap;
  let d = s.d - 2 * lap;

  // ACROSS THE CABINET. The slab is the module's width; the rails are what is left standing.
  const maxW = c.w - 2 * SINK_RAIL;
  if (maxW < 120) return null; // nothing worth cutting — a 200mm filler is not a sink base
  w = Math.min(w, maxW);

  // FRONT TO BACK. The slab runs from the wall to the front overhang; the tap stands behind the
  // bowl and the front edge keeps its lip.
  const slabD = cabDepth(c) + WORKTOP_OVERHANG;
  const maxD = slabD - SINK_TAP_ZONE - SINK_FRONT_RAIL;
  if (maxD < 120) return null;
  d = Math.min(d, maxD);

  // centre it in what is left, then hold it inside the rails
  const halfSpare = (c.w - w) / 2 - SINK_RAIL;
  const cx = Math.max(-halfSpare, Math.min(halfSpare, s.offset));
  const cz = SINK_TAP_ZONE + d / 2;
  return { w: Math.round(w), d: Math.round(d), cx: Math.round(cx), cz: Math.round(cz) };
}

/** How far the counter oversails the carcass at the front (mm) — the same lip kitchen3d draws. */
export const WORKTOP_OVERHANG = 20;

/** Where the tap stands, in the cabinet's frame (mm) — behind the bowl, off to one side. */
export function tapAt(c: Cabinet): { cx: number; cz: number } | null {
  const hole = sinkHole(c);
  if (!hole) return null;
  return { cx: hole.cx - hole.w / 2 + 60, cz: SINK_TAP_ZONE / 2 + 10 };
}

/**
 * EVERY HOLE CUT IN THE COUNTER, across a run — what the quote bills as machine time.
 *
 * A hob is the same operation as a sink: a rectangle routed out of the slab. It is counted here for
 * the same reason, so a kitchen is not quoted as though its cooktop sits on an uncut worktop.
 */
export interface WorktopCut {
  kind: "sink" | "hob";
  w: number;
  d: number;
}

/** A cooktop's opening (mm) — a standard 4-burner drops into 560×490 whatever its trim. */
export const HOB_HOLE = { w: 560, d: 490 };

/**
 * A COOKTOP'S OPENING. Same operation, simpler rules: it drops into the middle of the slab with a
 * margin behind it, and it has no rim to hide an overcut behind either.
 */
export function hobHole(c: Cabinet): WorktopHole | null {
  const w = Math.min(HOB_HOLE.w, c.w - 2 * SINK_RAIL);
  const slabD = cabDepth(c) + WORKTOP_OVERHANG;
  const d = Math.min(HOB_HOLE.d, slabD - HOB_BACK_RAIL - SINK_FRONT_RAIL);
  if (w < 120 || d < 120) return null;
  return { w: Math.round(w), d: Math.round(d), cx: 0, cz: Math.round(HOB_BACK_RAIL + d / 2) };
}

/** Slab left behind a cooktop (mm) — it is not a tap zone, just the clearance a hob needs. */
export const HOB_BACK_RAIL = 60;

/**
 * THE OPENING THIS MODULE NEEDS IN THE COUNTER — the one question the 3D and the quote both ask.
 *
 * Keeping it in one place is what stops the drawn hole and the billed hole from being different
 * sizes, which is the sort of disagreement that only shows up at the saw.
 */
export function worktopHole(c: Cabinet): WorktopHole | null {
  if (c.furniture) return null;
  if (c.appliance === "sink") return sinkHole(c);
  // a `hob` is the oven+hob COLUMN — its glass sits on the appliance, not in the slab
  if (c.appliance === "cooktop") return hobHole(c);
  return null;
}

export function worktopCuts(cabs: Cabinet[]): WorktopCut[] {
  const out: WorktopCut[] = [];
  for (const c of cabs) {
    const h = worktopHole(c);
    if (h) out.push({ kind: c.appliance === "sink" ? "sink" : "hob", w: h.w, d: h.d });
  }
  return out;
}

/** Total routed contour across the counter (mm) — what `millPerM` multiplies. */
export function cutContourMm(cuts: WorktopCut[]): number {
  return cuts.reduce((mm, c) => mm + 2 * (c.w + c.d), 0);
}

/** The counter's own thickness (mm) — re-exported so callers do not reach past this module. */
export const WORKTOP_T = GEOM.worktop;
