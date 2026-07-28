// MERGING A ROW INTO ONE CARCASS — the app's side of @mebelchi/pricing's `carcassGroup`.
//
// The workshop's economy build: a row of wall units built as ONE box (two outer sides, a shared
// stile at every internal boundary, one long top/bottom/back) instead of one box per cabinet. On a
// 4 × 600 upper row that is ~24% off — 8 hangers become 2, 32 minifix become 20, 28 panels to saw
// become 16 — and the fronts do not move, so the client sees the same kitchen.
//
// This file answers exactly two questions: WHICH cabinets may share a box, and how to tag/untag
// them. What a merged box actually cuts is pricing's business (packages/pricing/src/carcass.ts).
//
// THE ROW IS ALREADY DEFINED. `rowMates` — the set behind the existing «Применить ко всему ряду»
// pill — is the same-wall, same-band, same-kind, tiled set. That is precisely the set a shared
// carcass can span, so merging borrows it rather than inventing a second notion of "row".
//
// Pure. Every function returns a new array, or null when nothing would change.

import { canShareCarcass } from "@mebelchi/pricing";
import type { Cabinet } from "./cabinet";
import { rowMates } from "./rowOps";
import { cabDepth } from "./resolve";
import { cabToModule } from "./toProject";

/** Sort a row the way it is built: left to right along the wall. The carcass's first and last
 *  members get the outer sides, so the order is structural, not cosmetic. */
function inBuildOrder(row: Cabinet[]): Cabinet[] {
  return [...row].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
}

/** Can these two cabinets physically be one box? Same kind, same height, same depth — there is no
 *  single side panel that serves a 720 upper and a 900 one. Defers to pricing's own predicate so
 *  the app and the BOM can never disagree about what is buildable. */
/** Appliances that live in the WORKTOP, not in the box.
 *
 *  A sink bowl and a hob drop through a hole in the counter. The cabinet underneath is an ordinary
 *  cabinet — same sides, same bottom, same back — with a cut-out in its top rail. A workshop builds
 *  a sink base into a merged run all day long.
 *
 *  So the old blanket "no appliance may share a carcass" was simply wrong, and it was the reason a
 *  BASE ROW could never be merged: almost every base run has a sink somewhere in the middle of it,
 *  and that one cabinet split the row into fragments too short to be worth merging. (The comment
 *  claimed the drilling solver refused to touch an appliance too. It has no such check.) */
const IN_THE_WORKTOP: ReadonlySet<string> = new Set(["sink", "hob", "cooktop"]);

/** A machine HOUSING — a box built around an appliance, with its own frame, its own clearances and
 *  usually no shelves at all. A fridge tower, an oven tower, a dishwasher niche, a hood. These
 *  genuinely are their own carcass, and merging one into its neighbours is not a thing. */
function isHousing(c: Cabinet): boolean {
  return !!c.appliance && c.appliance !== "none" && !IN_THE_WORKTOP.has(c.appliance);
}

export function canShare(a: Cabinet, b: Cabinet): boolean {
  return (
    canShareCarcass(cabToModule(a), cabToModule(b)) &&
    !isHousing(a) &&
    !isHousing(b) &&
    cabDepth(a) === cabDepth(b)
  );
}

/** mm of slack allowed between two cabinets before they stop counting as touching. */
const TOUCH_TOL = 1;

/**
 * The unbroken run of cabinets that physically TOUCH, around `ref`.
 *
 * A carcass is one continuous box. It cannot span a gap — there is no such thing as a 2400 side
 * panel with a 600mm hole in the middle of the cabinet it belongs to. `rowMates` answers "same
 * wall, same band, same kind", which is necessary but NOT sufficient: delete the third cabinet of a
 * four-cabinet row and the survivors are still row-mates while no longer being a buildable box.
 *
 * So walk out from `ref` in both directions and stop at the first gap.
 */
function touchingAround(row: Cabinet[], ref: Cabinet): Cabinet[] {
  const i = row.findIndex((c) => c.id === ref.id);
  if (i < 0) return [];
  const touches = (left: Cabinet, right: Cabinet) =>
    Math.abs((left.x ?? 0) + left.w - (right.x ?? 0)) <= TOUCH_TOL;

  const out = [row[i]];
  for (let k = i; k > 0 && touches(row[k - 1], row[k]); k--) out.unshift(row[k - 1]);
  for (let k = i; k < row.length - 1 && touches(row[k], row[k + 1]); k++) out.push(row[k + 1]);
  return out;
}

/** THE MERGE CANDIDATES for a cabinet: the cabinets it could actually share a box with — same wall,
 *  same band, same kind, same height and depth, AND butting right up against it with no gap. A
 *  cabinet alone in its row, or cut off from its row-mates by a gap, has none. */
export function mergeCandidates(cabs: Cabinet[], ref: Cabinet): Cabinet[] {
  const row = inBuildOrder(rowMates(cabs, ref)).filter((c) => c.id === ref.id || canShare(ref, c));
  const box = touchingAround(row, ref);
  return box.length > 1 ? box : [];
}

/** Is this cabinet part of a merged box right now? */
export function isMerged(c: Cabinet): boolean {
  return c.carcassGroup != null;
}

/** The cabinets sharing a box with this one (including itself). Empty when it stands alone. */
export function boxMates(cabs: Cabinet[], ref: Cabinet): Cabinet[] {
  if (!ref.carcassGroup) return [];
  return inBuildOrder(cabs.filter((c) => c.carcassGroup === ref.carcassGroup));
}

/** Can the row this cabinet sits in be merged? (More than one cabinet, and not already merged.) */
export function canMergeRow(cabs: Cabinet[], ref: Cabinet): boolean {
  return !isMerged(ref) && mergeCandidates(cabs, ref).length > 1;
}

let _seq = 0;
const groupId = () => `box-${++_seq}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Build this cabinet's whole row as ONE carcass.
 *
 * Tags every merge candidate in the row with a fresh group id. Pricing re-checks the tag (a saved
 * project can be edited into an unbuildable shape), but tagging only a valid set here is what keeps
 * the price the seller sees honest.
 *
 * Returns null when there is nothing to merge — a lone cabinet, or a row already merged.
 */
export function mergeRow(cabs: Cabinet[], ref: Cabinet): Cabinet[] | null {
  const row = mergeCandidates(cabs, ref);
  if (row.length < 2) return null;
  const gid = groupId();
  const ids = new Set(row.map((c) => c.id));
  return cabs.map((c) => (ids.has(c.id) ? { ...c, carcassGroup: gid } : c));
}

/** Break this cabinet's box back into separate carcasses — every member of the group, not just the
 *  one tapped: half a merged box is not a thing. Null when it wasn't merged. */
export function unmergeRow(cabs: Cabinet[], ref: Cabinet): Cabinet[] | null {
  const gid = ref.carcassGroup;
  if (!gid) return null;
  return cabs.map((c) => {
    if (c.carcassGroup !== gid) return c;
    const { carcassGroup: _drop, ...rest } = c;
    return rest as Cabinet;
  });
}

/**
 * Repair the tags after an edit that could have broken a box.
 *
 * A merged row is a promise about geometry — same kind, same height, same depth, and BUTTING UP
 * against each other on the same wall. Resizing one member's height, moving it to another wall, or
 * deleting the cabinet in the middle of the row all break that promise, and a box that cannot be
 * built must not be priced or sent to a shop. (Deleting a middle cabinet is the sly one: the
 * survivors are still row-mates, so every same-wall/same-band test still passes — but the box now
 * has a 600mm hole in it, and there is no side panel shaped like that.)
 *
 * So: after any edit to the run, any group that is no longer a valid touching set is dissolved, and
 * a group left with one member is dropped (a box of one is just a cabinet).
 *
 * Called from the store on every cab mutation — the cheap, boring way to guarantee the invariant,
 * rather than making each of a dozen edit paths remember it.
 */
export function healCarcassGroups(cabs: Cabinet[]): Cabinet[] {
  const groups = new Map<string, Cabinet[]>();
  for (const c of cabs) {
    if (!c.carcassGroup) continue;
    const g = groups.get(c.carcassGroup) ?? [];
    g.push(c);
    groups.set(c.carcassGroup, g);
  }
  if (!groups.size) return cabs;

  const dissolve = new Set<string>();
  for (const [gid, members] of groups) {
    if (members.length < 2) {
      dissolve.add(gid);
      continue;
    }
    // every member must still be able to share a box with the first, and they must all still be in
    // one row — `mergeCandidates` recomputes the row from the CURRENT geometry, so a cabinet that
    // was moved or resized out of the row simply isn't in it any more
    const row = new Set(mergeCandidates(cabs, members[0]).map((c) => c.id));
    if (!members.every((m) => row.has(m.id))) dissolve.add(gid);
  }
  if (!dissolve.size) return cabs;

  return cabs.map((c) => {
    if (!c.carcassGroup || !dissolve.has(c.carcassGroup)) return c;
    const { carcassGroup: _drop, ...rest } = c;
    return rest as Cabinet;
  });
}

// ── SEAMS: merging PART of a row ──────────────────────────────────────────────────────────────
//
// `mergeRow` is all-or-nothing — it tags the whole touching run. That is the common case and it is
// one tap, but it is not a model: a seller who wants the two drawer banks built as one box and the
// sink base left on its own has no way to say so.
//
// The right unit of control is the SEAM, not the row. The boundary between two neighbouring cabinets
// is exactly one of two things in the workshop: a SHARED STILE (one box continues through it) or TWO
// SIDE PANELS (two boxes butt against each other). That is a per-boundary fact, so it gets a
// per-boundary switch — and merging "some but not others" falls out of it for free, because a box is
// just a maximal run of joined seams.

/** One boundary between two adjacent cabinets that COULD be a shared stile. */
export interface Seam {
  left: Cabinet;
  right: Cabinet;
  /** they are already one box */
  joined: boolean;
}

/** Every seam on the run that the workshop could actually build through: neighbours that touch, in
 *  the same band, of the same kind, height and depth. A sink base and the drawer bank beside it are
 *  NOT a seam — an appliance housing is a box built around a machine. */
export function seams(cabs: Cabinet[]): Seam[] {
  const out: Seam[] = [];
  const seen = new Set<string>();
  for (const c of cabs) {
    if (seen.has(c.id)) continue;
    const row = inBuildOrder(rowMates(cabs, c));
    row.forEach((m) => seen.add(m.id));
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i];
      const b = row[i + 1];
      if (Math.abs((a.x ?? 0) + a.w - (b.x ?? 0)) > TOUCH_TOL) continue; // a gap is not a seam
      if (!canShare(a, b)) continue;
      out.push({ left: a, right: b, joined: !!a.carcassGroup && a.carcassGroup === b.carcassGroup });
    }
  }
  return out;
}

/** JOIN the two cabinets either side of a seam into one box. Either may already be in a box, in
 *  which case the two boxes fuse — which is how you build a 3-bay box out of two taps. */
export function joinSeam(cabs: Cabinet[], leftId: string, rightId: string): Cabinet[] | null {
  const a = cabs.find((c) => c.id === leftId);
  const b = cabs.find((c) => c.id === rightId);
  if (!a || !b || !canShare(a, b)) return null;
  if (a.carcassGroup && a.carcassGroup === b.carcassGroup) return null; // already one box

  const gid = a.carcassGroup ?? b.carcassGroup ?? groupId();
  const move = new Set<string>([a.id, b.id]);
  for (const c of cabs) {
    if (c.carcassGroup && (c.carcassGroup === a.carcassGroup || c.carcassGroup === b.carcassGroup)) move.add(c.id);
  }
  return cabs.map((c) => (move.has(c.id) ? { ...c, carcassGroup: gid } : c));
}

/** SPLIT the box at this seam: everything left of it stays one box, everything right becomes
 *  another. A side left holding a single cabinet loses its tag — a box of one is just a cabinet. */
export function splitSeam(cabs: Cabinet[], leftId: string, rightId: string): Cabinet[] | null {
  const a = cabs.find((c) => c.id === leftId);
  const b = cabs.find((c) => c.id === rightId);
  if (!a || !b || !a.carcassGroup || a.carcassGroup !== b.carcassGroup) return null;

  const box = boxMates(cabs, a); // already in build order
  const cut = box.findIndex((c) => c.id === b.id);
  if (cut <= 0) return null;

  const lhs = box.slice(0, cut);
  const rhs = box.slice(cut);
  const tag = (part: Cabinet[]) => (part.length > 1 ? groupId() : null); // a box of one is no box
  const lg = tag(lhs);
  const rg = tag(rhs);
  const put = new Map<string, string | null>();
  lhs.forEach((c) => put.set(c.id, lg));
  rhs.forEach((c) => put.set(c.id, rg));

  return cabs.map((c) => {
    if (!put.has(c.id)) return c;
    const g = put.get(c.id) ?? null;
    if (g) return { ...c, carcassGroup: g };
    const { carcassGroup: _drop, ...rest } = c;
    return rest as Cabinet;
  });
}

// ── НАВЕСЫ: how many, AND WHERE ───────────────────────────────────────────────────────────────
//
// A навес is not an abstract quantity, it is a bracket screwed to the top rear corner of a SIDE
// PANEL. So a box of N cabinets has exactly N+1 places one can go — the two outer sides, and the
// internal stiles between the bays — and "how many hangers" is really "which of those panels get
// one". A seller who says "that 4-bay row hangs on two" is naming positions, not a number.
//
// The shop's rule (Настройки) still supplies the default. This is the override, and it is the
// positions, because that is the thing the fitter actually needs to know and the thing the drilling
// file will one day have to place.

/** Every side panel of this box, as an offset in mm from the box's LEFT edge. */
export function hangerSlots(box: Cabinet[]): number[] {
  const out = [0];
  let x = 0;
  for (const c of inBuildOrder(box)) {
    x += c.w;
    out.push(Math.round(x));
  }
  return out;
}

/** How many hangers the SHOP'S RULE fits on a box of this width (ProductionOpts, from Настройки). */
export function ruleHangerCount(box: Cabinet[], per: number, spanMm: number): number {
  if (box[0]?.kind !== "upper") return 0; // a base cabinet stands on the floor
  const p = Math.max(0, Math.round(per));
  if (!p) return 0;
  const w = box.reduce((a, c) => a + c.w, 0);
  const want = p * (spanMm > 0 ? Math.max(1, Math.ceil(w / spanMm)) : 1);
  // A BOX CANNOT CARRY MORE HANGERS THAN IT HAS SIDE PANELS. A навес screws to a panel; there is
  // nowhere else to put one. Without this clamp a narrow-span rule asks for 6 on a box with 5
  // panels, and the number on the quote stops matching the number of brackets in the drawing.
  return Math.min(want, box.length + 1);
}

/** The slots the rule would use. The two ENDS first — they are what actually carries the load — then
 *  internal stiles, spread as evenly as the panels allow, until the count is met. */
export function defaultHangerSlots(box: Cabinet[], count: number): number[] {
  const slots = hangerSlots(box);
  const n = Math.max(0, Math.min(count, slots.length));
  if (n === 0) return [];
  if (n === 1) return [slots[Math.floor(slots.length / 2)]];

  const picked = new Set<number>([slots[0], slots[slots.length - 1]]);
  const inner = slots.slice(1, -1);
  const extra = Math.min(n - picked.size, inner.length);
  // spread the extras across the internal stiles, and NEVER pick the same panel twice — a duplicate
  // silently gives you fewer brackets than the count promised
  const used = new Set<number>();
  for (let k = 0; k < extra; k++) {
    let at = Math.min(inner.length - 1, Math.round((k + 0.5) * (inner.length / extra)));
    while (used.has(at)) at = (at + 1) % inner.length;
    used.add(at);
    picked.add(inner[at]);
  }
  return [...picked].sort((a, b) => a - b);
}

/** WHERE THIS BOX ACTUALLY HANGS: the seller's chosen panels, else the shop's rule. */
export function hangersOn(box: Cabinet[], per: number, spanMm: number): number[] {
  const set = box[0]?.hangPos;
  if (set) return [...set].sort((a, b) => a - b);
  return defaultHangerSlots(box, ruleHangerCount(box, per, spanMm));
}
