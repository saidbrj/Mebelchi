// Pure row operations for the front-view sheet — the "Excel" edits.
//
// Shared by each committed store action (one undo step) and its `…Live` twin (used during a
// drag, no history). Returns null when nothing changed, so the caller can skip the set().
//
// Pure: no store, no React. That's the point — this is the logic that decides how a row
// re-tiles, so it has to be testable on its own.

import type { Cabinet } from "./cabinet";
import { bandsOverlap, cabBand, cornerArm } from "./bands";
import { GEOM } from "./layout";
import { isTiled } from "./resolve";
import { cornerUnits, outerEndSeats, cornerSideFor, type KitchenLayout, type CornerSpec } from "./runPlan";
import { cabFootprints, footsClash } from "./footprint";
import type { Pt, Opening } from "./room";

export const MIN_W = 150;
export const MAX_W = 1200;

/** a run-local span the row may not cross */
export interface Span {
  a: number;
  b: number;
}

export interface ResizeBounds {
  /** run-local left limit — the wall start. NEGATIVE when the run begins inside a corner zone. */
  minX?: number;
  /** run-local right limit — the wall end */
  maxX?: number;
  /** run-local spans a column may not enter: windows, doorways, radiators, corner units, and any
   *  cleared corner zone with nothing standing in it. Supplied by the sheet, which is the thing
   *  that knows what's on the wall. */
  blocked?: Span[];
}

/** Resize a module by dragging ONE of its edges. The opposite edge stays put.
 *
 *  THE KEY RULE — and the one that was wrong: the module beyond the dragged edge absorbs the
 *  change ONLY IF IT IS TOUCHING. Any module on the row used to be treated as "the neighbour",
 *  so widening a cabinet on one side of a window dragged the cabinet on the FAR side of the
 *  window across to meet it — the window simply wasn't in the model. Now a neighbour separated
 *  by a gap is a hard STOP: you grow into the gap and halt at its edge.
 *
 *  "Same row" is a BAND overlap, not a kind test — a tall column sits in both the floor and wall
 *  bands, so widening an upper into one is correctly absorbed instead of silently overlapping it.
 *
 *  Obstacles that are not columns (a window, the corner unit) come in via `blocked`. They stop
 *  the edge but never move — which is what lets the cabinet beside a corner grow back until it
 *  is flush with it, instead of being stranded short of it forever. */
export function resizeCabs(
  cabs: Cabinet[],
  id: string,
  newW: number,
  edge: "left" | "right" = "right",
  bounds: ResizeBounds = {},
): Cabinet[] | null {
  const { minX = 0, maxX = Infinity, blocked = [] } = bounds;
  const i = cabs.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const a = cabs[i];
  const w = Math.max(MIN_W, Math.min(MAX_W, Math.round(newW)));
  if (w === a.w) return null;
  const out = cabs.slice();

  if (!isTiled(a)) {
    // A free module's px/pz is its CENTRE, so setting w grows it in BOTH directions and it has
    // no neighbours to push — that's how a module "detached" from the row and drifted into an
    // overlap. The sheet DOCKS a module before dragging its edge (store.dockCab), so this path
    // is only reached by typing an exact width on something genuinely off-run.
    out[i] = { ...a, w };
    return out;
  }

  const ax = a.x as number;
  const aRight = ax + a.w;
  // only TILED modules have a meaningful run-local x — a free/corner one would compare as
  // x=0 and could be picked as the neighbour to the left-most cabinet
  const sameRow = (c: Cabinet) =>
    isTiled(c) && (c.run ?? 0) === (a.run ?? 0) && c.appliance !== "filler" && !c.furniture && bandsOverlap(a, c);
  const TOUCH = 2; // mm — flush enough to count as sharing a border

  if (edge === "right") {
    // left edge pinned; the nearest column to the RIGHT
    let nb = -1;
    let nbX = Infinity;
    for (let j = 0; j < cabs.length; j++) {
      if (j === i) continue;
      const c = cabs[j];
      if (!sameRow(c)) continue;
      const cx = c.x as number;
      if (cx >= aRight - TOUCH && cx < nbX) {
        nb = j;
        nbX = cx;
      }
    }
    const flush = nb >= 0 && Math.abs(nbX - aRight) <= TOUCH;

    // how far right this edge may travel
    let cap = maxX;
    for (const bl of blocked) if (bl.a >= aRight - TOUCH) cap = Math.min(cap, bl.a);
    if (nb >= 0 && !flush) cap = Math.min(cap, nbX); // a gap away → stop at it, don't drag it over
    let lo = MIN_W;
    if (flush) {
      const b = cabs[nb];
      cap = Math.min(cap, nbX + (b.w - MIN_W)); // the neighbour can give until it hits MIN_W
      lo = Math.max(lo, a.w - (MAX_W - b.w)); // …and take until it hits MAX_W
    }

    const hi = Math.max(a.w, Math.min(MAX_W, cap - ax)); // capping must never force a SHRINK
    const wf = Math.max(Math.min(a.w, lo), Math.min(hi, w));
    if (wf === a.w) return null;
    out[i] = { ...a, w: wf };
    if (flush) {
      const b = cabs[nb];
      const d = wf - a.w;
      out[nb] = { ...b, x: nbX + d, w: b.w - d };
    }
    return out;
  }

  // edge === "left": the RIGHT edge is pinned and the left edge moves
  let nb = -1;
  let nbRight = -Infinity;
  for (let j = 0; j < cabs.length; j++) {
    if (j === i) continue;
    const c = cabs[j];
    if (!sameRow(c)) continue;
    const cr = (c.x as number) + c.w;
    if (cr <= ax + TOUCH && cr > nbRight) {
      nb = j;
      nbRight = cr;
    }
  }
  const flush = nb >= 0 && Math.abs(nbRight - ax) <= TOUCH;

  let floor = minX;
  for (const bl of blocked) if (bl.b <= ax + TOUCH) floor = Math.max(floor, bl.b);
  if (nb >= 0 && !flush) floor = Math.max(floor, nbRight);
  let lo = MIN_W;
  if (flush) {
    const b = cabs[nb];
    floor = Math.max(floor, (b.x as number) + MIN_W);
    lo = Math.max(lo, a.w - (MAX_W - b.w));
  }

  const hi = Math.max(a.w, Math.min(MAX_W, aRight - floor));
  const wf = Math.max(Math.min(a.w, lo), Math.min(hi, w));
  if (wf === a.w) return null;
  const left = aRight - wf;
  out[i] = { ...a, x: left, w: wf };
  if (flush) {
    const b = cabs[nb];
    out[nb] = { ...b, w: left - (b.x as number) };
  }
  return out;
}

/** A corner unit's SIZE IS STRUCTURAL, not a preference: both walls clear exactly CORNER_MM for
 *  it, and the runs' usable lengths are derived from that. Resizing one (the front view used to
 *  offer a width chip on it) leaves it too small to fill its zone — so a permanent gap opens
 *  between it and the cabinets beside it, and nothing can close it, because the zone is reserved.
 *
 *  Restore the structural size and RE-SEAT it: the seat's centre is a function of the side
 *  length (side/√2 along the diagonal), so a resized unit is in the wrong place too. Its position
 *  is left alone when the size is already right, so you can still move it. */
export function healCornerUnits(
  cabs: Cabinet[],
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
): Cabinet[] | null {
  let changed = false;
  const out = cabs.map((c) => {
    if (!c.corner) return c;
    // an OUTER (reverse-L) corner is NOT an inside-corner square — it's a run-depth L the user places
    // by hand. `seatCorner` would snap it to a wall vertex at the big 840 square, so on every heal it
    // would jump back to an inside corner (the "drag it to the elbow, release, it teleports back" bug).
    if (c.cornerShape === "outer") return c;
    // the square follows the ARM DEPTH, not the kind. Keying it on `kind === "upper"` meant a
    // BASE-DEPTH top row's corner — a wall unit that legitimately needs the big 840 square — was
    // forcibly snapped back to 613 on the next heal, collapsing its door face to ~50mm.
    const side = cornerSideFor(cornerArm(c));
    if (c.w === side && c.depth === side) return c; // right size → leave its seat alone
    const fixed = seatCorner(c, points, waterWall, layout, openings);
    if (fixed === c) return c;
    changed = true;
    return fixed;
  });
  return changed ? out : null;
}

/** SIZE AND SEAT one corner unit from its arm depth.
 *
 *  Both follow from the arm: the square is `cornerSideFor(arm)`, and the seat is offset from the
 *  wall vertex by `side/√2` — so a corner cannot be resized without also being moved. That is why
 *  this is one operation and not two, and why the editor's depth field routes through it. */
export function seatCorner(
  c: Cabinet,
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
): Cabinet {
  const side = cornerSideFor(cornerArm(c));
  const seats = cornerUnits(points, waterWall, layout, openings, side);
  if (!seats.length) return { ...c, w: side, depth: side };
  const near = (a: CornerSpec) => Math.hypot(a.px - (c.px ?? 0), a.pz - (c.pz ?? 0));
  const best = seats.reduce((a, b) => (near(b) < near(a) ? b : a));
  return { ...c, w: side, depth: side, px: best.px, pz: best.pz, rot: best.rot };
}

/** SEAT AN ANGLED END UNIT at the exposed run end nearest where it dropped.
 *
 *  Unlike `seatCorner` this is NOT the big inner square: it keeps its own WIDTH (an end unit is as
 *  narrow or wide as you like) and takes the run's DEPTH (`cornerArm(c)`), so it lines up with the
 *  module beside it. It stores `cornerFace` — a point out in the room past the exposed end — so the
 *  2D plan and the 3D cut the same front corner. A room with no reflex corner (a plain rectangle) has
 *  no exposed run end → the unit keeps its depth and stays where it is for the caller to notice. */
export function seatOuterCorner(
  c: Cabinet,
  points: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[],
  cabs?: Cabinet[],
): Cabinet {
  const depth = cornerArm(c);
  const w = c.w || depth;
  const seats = outerEndSeats(points, w, depth);
  if (!seats.length) return { ...c, w, depth };
  const at = (s: { px: number; pz: number; rot: number }) => ({ ...c, w, depth, px: s.px, pz: s.pz, rot: s.rot });
  // AN ELBOW OFFERS TWO SEATS — one per wall — and "nearest to where it dropped" is a coin toss for a
  // unit that has never been placed. Prefer the wall that is actually FREE: dropping the cap on top of
  // the cabinet already standing at the corner is never what was meant, and the user then has to
  // notice the red and move it by hand. Distance breaks the tie.
  const others = (cabs ?? []).filter((o) => o.id !== c.id);
  const taken = (s: { px: number; pz: number; rot: number }) => {
    if (!others.length) return false;
    const foots = cabFootprints([at(s), ...others], points, waterWall, layout, openings);
    const mine = foots.find((f) => f.id === c.id);
    return !!mine && foots.some((o) => o.id !== c.id && footsClash(mine, o));
  };
  const near = (s: { px: number; pz: number }) => Math.hypot(s.px - (c.px ?? 0), s.pz - (c.pz ?? 0));
  const score = (s: (typeof seats)[number]) => near(s) + (taken(s) ? 1e6 : 0);
  const best = seats.reduce((a, b) => (score(b) < score(a) ? b : a));
  return { ...at(best), cornerFace: best.face };
}

/** A run-local `x` below its legal floor means the column has been pushed into the CLEARED
 *  CORNER ZONE at the start of its wall — on top of the corner unit standing there. Both go red,
 *  it can't be dragged back out, and the 3D shows a cabinet buried in the corner.
 *
 *  Heal by SHIFTING THE WHOLE ROW back out of the zone, not by clamping each module: clamping
 *  would stack every offender at the floor, on top of each other. A shift keeps the design.
 *  Idempotent. `floorOf` gives each module its legal floor (0, or −227 for a wall unit reaching
 *  in to meet a shallower corner upper). Returns null if nothing was wrong. */
export function healRunStarts(cabs: Cabinet[], floorOf: (c: Cabinet) => number): Cabinet[] | null {
  // keyed on the BAND, not just the kind: every wall unit used to share one "up" lane, so healing
  // the main uppers dragged a stacked antresol along with them
  const rowKey = (c: Cabinet) =>
    `${c.run ?? 0}:${c.kind === "upper" ? `up${Math.round(cabBand(c).y0)}` : "floor"}`;
  const worst = new Map<string, number>();
  for (const c of cabs) {
    if (!isTiled(c)) continue;
    const under = (c.x as number) - floorOf(c);
    if (under >= 0) continue;
    const k = rowKey(c);
    worst.set(k, Math.min(worst.get(k) ?? 0, under));
  }
  if (!worst.size) return null;
  return cabs.map((c) => {
    if (!isTiled(c)) return c;
    const shift = worst.get(rowKey(c));
    return shift ? { ...c, x: (c.x as number) - shift } : c;
  });
}

/** Counter height applies to EVERY base module, so the worktop stays level (the Excel "change
 *  a cell's height and the whole row follows" rule). */
export function setBasesH(cabs: Cabinet[], mm: number): Cabinet[] | null {
  const h = Math.max(550, Math.min(1000, Math.round(mm))); // sensible counter-height range
  if (!cabs.some((c) => c.kind === "base" && c.h !== h)) return null;
  return cabs.map((c) => (c.kind === "base" ? { ...c, h } : c));
}

/** THE ROW a module belongs to: the modules beside it on the SAME WALL, in the SAME BAND, of the
 *  SAME KIND. Includes the module itself.
 *
 *  This is the row the user is looking at — the run matters (a depth change on wall A must not reach
 *  around the corner to wall B), the band matters (an antresol is a different row from the wall units
 *  it sits on), and the kind matters (pushing a column's height onto the base beside it is nonsense,
 *  even though their bands overlap).
 *
 *  Free-placed modules (islands, corner units, furniture) have no row — they answer only for
 *  themselves. Same predicate `healRunStarts` keys on. */
export function rowMates(cabs: Cabinet[], ref: Cabinet): Cabinet[] {
  if (!isTiled(ref) || ref.furniture || ref.island || ref.corner) return [ref];
  return cabs.filter(
    (c) =>
      isTiled(c) &&
      !c.furniture &&
      !c.island &&
      !c.corner &&
      (c.run ?? 0) === (ref.run ?? 0) &&
      c.kind === ref.kind &&
      bandsOverlap(c, ref),
  );
}

/** shortest wall unit worth having (mm) */
export const MIN_ROW_H = 200;

/** One edit to a wall unit's vertical placement. */
export interface RowEdit {
  id: string;
  mountY?: number;
  h?: number;
}

/**
 * Re-hang / resize wall units — the front sheet's row drags.
 *
 * The caller (the sheet, which owns the row geometry) decides WHICH modules move and by how much;
 * this applies the batch and enforces the one rule the sheet can't: **nothing may pass through the
 * ceiling.** The old `setUpperMountLive` clamped `mountY` to `ceiling − 200` while ignoring the
 * unit's own height, so a 720-high upper could be hung at 2500 and poke 520mm out through a 2700
 * ceiling.
 *
 * Pure, and returns null when nothing changed so the caller can skip the set().
 */
export function editRows(cabs: Cabinet[], edits: RowEdit[], ceiling: number): Cabinet[] | null {
  if (!edits.length) return null;
  const byId = new Map(edits.map((e) => [e.id, e]));
  let changed = false;

  const out = cabs.map((c) => {
    const e = byId.get(c.id);
    if (!e || c.kind !== "upper") return c;

    // height first — the mount clamp depends on it
    const mountY0 = e.mountY ?? cabBand(c).y0;
    const h = e.h != null ? Math.max(MIN_ROW_H, Math.min(ceiling - GEOM.plinth, Math.round(e.h))) : c.h;
    const lo = GEOM.plinth + 200;
    const mountY = Math.round(Math.max(lo, Math.min(ceiling - h, mountY0)));

    if (h === c.h && mountY === cabBand(c).y0) return c;
    changed = true;
    return { ...c, h, mountY };
  });

  return changed ? out : null;
}
