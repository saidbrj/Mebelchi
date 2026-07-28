// Phase B layout solver — turns a Space + the user's onboarding choices into
// realistic, production-ready cabinet runs. Pure & deterministic.
//
// TWO LAYERS:
//  1. Onboarding = HARD CONSTRAINTS applied to every variant — fridge type
//     (built-in / free / none), oven placement (under the hob / in a tower), hood
//     (integrated / dome), and shape (I = one run, L = two runs + corner).
//  2. Variant = the DIFFERENTIATOR — the four strategies differ structurally:
//     tall-bank size/composition, upper height/coverage/glass, module rhythm,
//     finish (colour/handle), and storage approach. So they read as four genuinely
//     different designs, not reskins.
//
// Placement respects the room: doors/passages are hard gaps (no module), windows
// block tall units and uppers (but a base cabinet may sit under a window, and the
// sink prefers it), the sink anchors to the water side, and the hob stays clear of
// the sink and any window.

import { mk, type ApplianceKind, type Cabinet, type FrontProfile } from "./cabinet";
import { runReach, DEFAULT_REVEAL, type RunOpening, type KitchenLayout } from "./runPlan";

export type Zone = "left" | "center" | "right";
export type FridgeType = "integ" | "free" | "none";
export type OvenType = "under" | "tall";
export type HoodType = "integ" | "dome";

/** One planned run, as the solver needs it (geometry lives in runPlan). */
export interface RunInput {
  kind: "wall" | "peninsula" | "island";
  len: number;
  cornerStart: boolean;
  cornerEnd: boolean;
  openings: RunOpening[];
}

/** A selected kitchen layout with its pre-planned runs (from runPlan). */
export interface PlannedLayout {
  layout: KitchenLayout;
  runs: RunInput[];
  /** Index (into runs) of the run on the water wall — gets the sink. */
  waterRun: number;
}

export interface LayoutInput {
  /** The selected layout(s), each pre-planned; spread across the variants. */
  layouts: PlannedLayout[];
  ceiling: number;
  /** filler «добор» gap (mm) held back at the ceiling on floor-to-ceiling runs; absent → DEFAULT_REVEAL. */
  reveal?: number;
  water: Zone;
  hasGas: boolean;
  // each is the SET of options the user is open to; with >1 the variants explore
  // each choice (so multi-select onboarding → more diverse variants)
  fridge: FridgeType[];
  oven: OvenType[];
  hood: HoodType[];
  /** OVERRIDE how the wall is banded, on every variant. Empty (the default) → each strategy keeps
   *  its own, so the four variants show all three shapes and the user can just pick one. */
  wall?: WallBand[];
  /** OVERRIDE the front's body, same rules as `wall`: pick one → every variant is built with it;
   *  pick none → the strategies keep their variety (flat / fluted / shaker / neoclassic). */
  front?: FrontProfile[];
}

/** How a wall is banded — see Strategy.wall.
 *  `antresolDeep` is an antresol at BASE depth (560): a deep storage box overhanging the wall units,
 *  which is what real kitchens do with the top row. */
export type WallBand = "single" | "tall" | "antresol" | "antresolDeep";

/** One band of wall units: where it hangs, how tall it is, how deep. */
export interface WallBandSpec {
  mountY: number;
  h: number;
  depth: number;
}

/** shortest antresol worth building — below this it's a sliver, so run one tall row instead */
const MIN_ANTRESOL = 300;

/**
 * THE WALL BANDS a strategy builds at a given ceiling — main row first, the antresol (if any) on
 * top. Nothing is left over: a strip of bare wall above the cabinets is the one thing none of the
 * reference kitchens have.
 *
 * Exported because the STORE seats a corner unit in each band, and re-deriving the banding there
 * would be a second copy of this arithmetic waiting to drift.
 */
export function wallBandsFor(wall: WallBand, ceiling: number, reveal = 0): WallBandSpec[] {
  const wallSpace = ceiling - GEOM.upperBottom; // 1180 on a 2700 ceiling
  const antresolH = wallSpace - UPPER_H; // what's left once a standard row is seated
  const deep = wall === "antresolDeep";
  const wantsAntresol = wall === "antresol" || deep;

  // graceful degradation: no room for a real antresol → one tall row; no room even for that → standard
  const band: WallBand =
    wantsAntresol && antresolH < MIN_ANTRESOL ? "tall" : wall === "tall" && wallSpace <= UPPER_H ? "single" : wall;

  const main: WallBandSpec = {
    mountY: GEOM.upperBottom,
    // a "tall" wall band runs worktop→ceiling; hold back the filler reveal so a scribe strip closes
    // the gap to the ceiling (a "single" row already stops well short — that's open wall, not a gap).
    h: band === "tall" ? Math.max(UPPER_H, wallSpace - reveal) : UPPER_H,
    depth: UPPER_DEPTH,
  };
  if (band !== "antresol" && band !== "antresolDeep") return [main];
  // the antresol is the band that meets the ceiling → it carries the top reveal
  return [main, { mountY: GEOM.upperBottom + UPPER_H, h: Math.max(UPPER_H / 2, antresolH - reveal), depth: deep ? BASE_DEPTH : UPPER_DEPTH }];
}

/** A single variant's resolved onboarding choices (one option per dimension). */
interface VariantInput {
  layout: KitchenLayout;
  runs: RunInput[];
  waterRun: number;
  ceiling: number;
  reveal: number;
  water: Zone;
  fridge: FridgeType;
  oven: OvenType;
  hood: HoodType;
}

export interface KitchenStyle {
  carcass: number;
  facade: number;
  worktop: number;
  handle: number;
  glassUppers: boolean;
}

export interface GenVariant {
  id: string;
  name: string;
  blurb: string;
  cabs: Cabinet[];
  style: KitchenStyle;
  /** the layout this variant uses (the scene needs it to place the runs) */
  layout: KitchenLayout;
  /** the WALL BANDS this variant built, bottom → top. The store seats a corner unit in each one
   *  (an L/U kitchen needs a corner in the antresol too, not just in the main row), and it must not
   *  re-derive the banding to do it. */
  bands: WallBandSpec[];
}

// ---- standard catalog (mm) ----
const BASE_H = 720;
const TALL_H = 2100;
const UPPER_H = 720;
const UPPER_DEPTH = 350;
const BASE_DEPTH = 560;
export const GEOM = {
  plinth: 100,
  baseH: BASE_H,
  worktop: 40,
  tallH: TALL_H,
  upperH: UPPER_H,
  upperBottom: 1520,
} as const;

const WIDE_LADDER = [800, 600, 500, 450, 400, 300];
const NARROW_LADDER = [600, 500, 450, 400, 300, 800];
const MIN_W = 300;
const TALL_W = 600;
const DOOR_MARGIN = 40; // clearance kept around a door (mm)
/** A wall run shorter than this is a SMALL kitchen's wall: every strategy covers it fully with wall
 *  units, because there is nowhere else for the storage to go. ~3m is about four base slots — below
 *  that, skipping the sink slot and the narrow ones leaves you with almost nothing. */
const TIGHT_RUN = 3000;

const zoneCenterFrac = (z: Zone): number => (z === "left" ? 1 / 6 : z === "right" ? 5 / 6 : 0.5);

interface Span {
  a: number;
  b: number;
}

/** [lo,hi] minus the blocked intervals → the free spans that remain. */
function subtract(lo: number, hi: number, blocks: Span[]): Span[] {
  const sorted = blocks.filter((b) => b.b > b.a).sort((a, b) => a.a - b.a);
  const res: Span[] = [];
  let cur = lo;
  for (const blk of sorted) {
    if (blk.a > cur) res.push({ a: cur, b: Math.min(hi, blk.a) });
    cur = Math.max(cur, blk.b);
    if (cur >= hi) break;
  }
  if (cur < hi) res.push({ a: cur, b: hi });
  return res.filter((s) => s.b - s.a > 1);
}

function packWidths(total: number, ladder: number[]): number[] {
  const widths: number[] = [];
  let rem = Math.max(0, Math.round(total));
  while (rem >= MIN_W) {
    let pick = ladder.find((w) => w <= rem && (rem - w === 0 || rem - w >= MIN_W));
    if (pick == null) pick = [...ladder].sort((a, b) => a - b).find((w) => w <= rem);
    if (pick == null) break;
    widths.push(pick);
    rem -= pick;
  }
  return widths;
}

/** Find a tall-bank position [pos,pos+w] clear of doors AND windows, at the end. */
function placeBank(L: number, w: number, end: "near" | "far", doors: Span[], windows: Span[]): number {
  const spans = subtract(0, L, [...doors, ...windows]);
  const fit = spans.filter((s) => s.b - s.a >= w - 1);
  if (!fit.length) return -1;
  if (end === "far") return Math.round(fit[fit.length - 1].b - w);
  return Math.round(fit[0].a);
}

interface Strategy {
  id: string;
  name: string;
  blurb: string;
  dishwasher: boolean;
  extraPantry: boolean;
  baseFill: "shelves" | "drawers" | "mix";
  drawerCount: number;
  ladder: number[];
  upperCoverage: "partial" | "full";
  /** HOW THE WALL IS BANDED — the biggest structural difference between variants, and the one
   *  the generator could not express: it only ever emitted a single 720mm row at 1520.
   *    single   — one standard row, a plain gap of wall above it
   *    tall     — ONE row running from the worktop line to the ceiling
   *    antresol — the standard row PLUS a second row seated on top of it, up to the ceiling
   *  `tall` and `antresol` are what the reference kitchens actually do; `single` stays the cheap
   *  option. Both fall back to `single`/`tall` when a low ceiling leaves no room. */
  wall: WallBand;
  /** columns run floor-to-ceiling instead of stopping at the standard 2100 */
  tallToCeiling: boolean;
  /** THE FRONT'S BODY per row (three/frontFace + pricing/fronts). These used to be indices into the
   *  legacy DOORS list — where «Фрезер» was read by NOTHING: not the 3D, not the elevation, not the
   *  PDF, not the quote. So every variant was, in fact, the same flat slab in a different colour. */
  frontUpper: FrontProfile;
  frontBase: FrontProfile;
  handle: number;
  /** Add a freestanding island when the room is large enough. */
  island: boolean;
  style: KitchenStyle;
}

const STRATEGIES: Strategy[] = [
  {
    id: "standard",
    name: "Стандартная",
    blurb: "Светлый дуб, распашные фасады — лучшая цена",
    dishwasher: false,
    extraPantry: false,
    baseFill: "shelves",
    drawerCount: 3,
    ladder: WIDE_LADDER,
    upperCoverage: "partial",
    wall: "single",
    tallToCeiling: false,
    frontUpper: "flat",
    frontBase: "flat",
    handle: 0,
    island: false,
    style: { carcass: 0xefe8da, facade: 0xe7ddc9, worktop: 0x7c756b, handle: 0x6f6a62, glassUppers: false },
  },
  {
    id: "ergonomic",
    name: "Эргономичная",
    blurb: "Белые ящики, посудомойка, плотный ряд",
    dishwasher: true,
    extraPantry: false,
    baseFill: "drawers",
    drawerCount: 3,
    ladder: NARROW_LADDER,
    upperCoverage: "full",
    wall: "single",
    tallToCeiling: false,
    frontUpper: "fluted", // ribbed uppers over flat bases — the look of three of the reference photos
    frontBase: "flat",
    handle: 2,
    island: false,
    style: { carcass: 0xeeeeec, facade: 0xf2f2f0, worktop: 0x8a8f93, handle: 0x9aa0a6, glassUppers: false },
  },
  {
    id: "storage",
    name: "Максимум хранения",
    // it always PROMISED "шкафы до потолка" in this blurb; until now it could not actually build
    // them — the wall stopped at 2240 and the columns at 2200
    blurb: "Тёплое дерево, колонны и антресоли до потолка",
    dishwasher: true,
    extraPantry: true,
    baseFill: "mix",
    drawerCount: 3,
    ladder: WIDE_LADDER,
    upperCoverage: "full",
    wall: "antresol", // the second row — the thing five of the reference kitchens have
    tallToCeiling: true,
    frontUpper: "shaker",
    frontBase: "shaker",
    handle: 0,
    island: true,
    style: { carcass: 0xe3d5b8, facade: 0xd8c69f, worktop: 0x5b5550, handle: 0x6f6a62, glassUppers: false },
  },
  {
    id: "premium",
    name: "Премиум",
    blurb: "Графит, стеклянные витрины во всю высоту",
    dishwasher: true,
    extraPantry: false,
    baseFill: "drawers",
    drawerCount: 3,
    ladder: WIDE_LADDER, // bold full-width drawer fronts (vs ergonomic's many narrow)
    upperCoverage: "full",
    wall: "tall", // one unbroken glass-fronted band, worktop line → ceiling
    tallToCeiling: true,
    frontUpper: "grid", // витрина with раскладка — the neoclassic upper in photo 1
    frontBase: "raised", // филёнка
    handle: 1,
    island: true,
    style: { carcass: 0x44484d, facade: 0x4c5157, worktop: 0x2e3236, handle: 0xc8ccd0, glassUppers: true },
  },
];

interface TallSpec {
  kind: "fridge" | "oven" | "pantry";
  builtin: boolean;
}

function tallsFor(v: VariantInput, st: Strategy): TallSpec[] {
  const talls: TallSpec[] = [];
  if (v.fridge !== "none") talls.push({ kind: "fridge", builtin: v.fridge === "integ" });
  if (v.oven === "tall") talls.push({ kind: "oven", builtin: true });
  if (st.extraPantry) talls.push({ kind: "pantry", builtin: true });
  return talls;
}

interface RunFill {
  length: number;
  run: number;
  sink: boolean;
  cook: "hob" | "cooktop" | "none";
  dishwasher: boolean;
  talls: TallSpec[];
  tallEnd: "near" | "far";
  openings: RunOpening[];
  cornerStart: boolean; // blind corner at the near (x=0) end
  cornerEnd: boolean; // blind corner at the far (x=L) end
}

interface BaseSlot {
  x: number;
  w: number;
}

/** Fill one wall run, respecting its openings; returns base + tall + upper Cabinets. */
function fillRun(rf: RunFill, st: Strategy, v: VariantInput): Cabinet[] {
  const L = Math.max(MIN_W, Math.round(rf.length));
  const doors: Span[] = rf.openings.filter((o) => o.kind === "door").map((o) => ({ a: Math.max(0, o.a - DOOR_MARGIN), b: Math.min(L, o.b + DOOR_MARGIN) }));
  const windows: Span[] = rf.openings.filter((o) => o.kind === "window").map((o) => ({ a: o.a, b: o.b }));
  const overlapsWin = (x: number, w: number) => windows.some((win) => x < win.b && x + w > win.a);

  // --- tall bank: fit at the preferred end, clear of doors + windows ---
  const talls = rf.talls.slice();
  let tallStart = -1;
  while (talls.length) {
    tallStart = placeBank(L, talls.length * TALL_W, rf.tallEnd, doors, windows);
    if (tallStart >= 0) break;
    talls.pop(); // drop pantry, then oven, then fridge until it fits
  }
  const tallBlock: Span[] = tallStart >= 0 ? [{ a: tallStart, b: tallStart + talls.length * TALL_W }] : [];

  // --- base modules fill the run minus doors minus the tall bank (windows OK) ---
  // The last module in each span absorbs the packing remainder so the span is filled
  // edge-to-edge — no sub-300mm gap, and the run-end cabinet butts a corner unit flush.
  const baseSlots: BaseSlot[] = [];
  for (const sp of subtract(0, L, [...doors, ...tallBlock])) {
    const ws = packWidths(sp.b - sp.a, st.ladder);
    const extra = sp.b - sp.a - ws.reduce((a, w) => a + w, 0);
    let x = sp.a;
    ws.forEach((w, k) => {
      const wEff = k === ws.length - 1 ? w + extra : w;
      baseSlots.push({ x, w: wEff });
      x += wEff;
    });
  }
  baseSlots.sort((p, q) => p.x - q.x);

  const frac = (s: BaseSlot) => (s.x + s.w / 2) / L;

  // sink — nearest the water zone (the wall the user put the supply on)
  let sinkIdx = -1;
  if (rf.sink && baseSlots.length) {
    const wf = zoneCenterFrac(v.water);
    const wide = baseSlots.map((s, i) => i).filter((i) => baseSlots[i].w >= 500);
    const cand = wide.length ? wide : baseSlots.map((_, i) => i);
    sinkIdx = cand.reduce((b, i) => (Math.abs(frac(baseSlots[i]) - wf) < Math.abs(frac(baseSlots[b]) - wf) ? i : b), cand[0]);
  }

  // hob/cooktop — clear of the sink + window, and as far as possible from the fridge
  // tower AND the dead corners (work-triangle: spread the three points, keep the
  // cooktop out of the blind corner and away from the fridge)
  const tallCenter = tallStart >= 0 && talls.length ? tallStart + (talls.length * TALL_W) / 2 : null;
  const avoid: number[] = [];
  if (sinkIdx >= 0) avoid.push(baseSlots[sinkIdx].x + baseSlots[sinkIdx].w / 2);
  if (tallCenter != null) avoid.push(tallCenter);
  if (rf.cornerStart) avoid.push(0);
  if (rf.cornerEnd) avoid.push(L);
  const hobIdx = rf.cook === "none" ? -1 : pickHob(baseSlots, sinkIdx, overlapsWin, avoid);

  // dishwasher — beside the sink, on the side AWAY from the hob (so the hob never ends
  // up next to the dishwasher either)
  let dwIdx = -1;
  if (rf.dishwasher && sinkIdx >= 0) {
    const order = hobIdx >= 0 && hobIdx < sinkIdx ? [sinkIdx + 1, sinkIdx - 1] : [sinkIdx - 1, sinkIdx + 1];
    for (const j of order) {
      if (j >= 0 && j < baseSlots.length && j !== hobIdx && baseSlots[j].w >= 450) {
        dwIdx = j;
        break;
      }
    }
  }

  const cabs: Cabinet[] = [];

  // tall columns. A floor-to-ceiling strategy runs them right up to the ceiling; a free-standing
  // fridge is the exception — it's a machine of a fixed height, not a cabinet we can stretch.
  // a floor-to-ceiling column stops the filler reveal short of the ceiling; a scribe strip closes the gap
  const tallH = st.tallToCeiling ? Math.max(TALL_H, v.ceiling - GEOM.plinth - v.reveal) : TALL_H;
  let tx = tallStart;
  if (tallStart >= 0) {
    for (const t of talls) {
      const b = { w: TALL_W, handle: st.handle, x: tx, run: rf.run };
      if (t.kind === "fridge") cabs.push(mk({ ...b, kind: "tall", h: t.builtin ? tallH : TALL_H, fill: "shelves", count: 0, front: "flat", appliance: "fridge", builtin: t.builtin }));
      else if (t.kind === "oven") cabs.push(mk({ ...b, kind: "tall", h: tallH, fill: "shelves", count: 2, front: st.frontBase, appliance: "oven", builtin: true }));
      else cabs.push(mk({ ...b, kind: "tall", h: tallH, fill: "shelves", count: 5, front: st.frontBase, appliance: "none" }));
      tx += TALL_W;
    }
  }

  // base modules
  let mix = 0;
  baseSlots.forEach((s, i) => {
    const b = { w: s.w, handle: st.handle, x: s.x, run: rf.run };
    if (i === sinkIdx) cabs.push(mk({ ...b, kind: "base", h: BASE_H, fill: "shelves", count: 0, front: st.frontBase, appliance: "sink" }));
    else if (i === hobIdx) cabs.push(mk({ ...b, kind: "base", h: BASE_H, fill: "drawers", count: 2, front: st.frontBase, appliance: rf.cook === "cooktop" ? "cooktop" : "hob" }));
    else if (i === dwIdx) cabs.push(mk({ ...b, kind: "base", h: BASE_H, fill: "open", count: 0, front: st.frontBase, appliance: "dishwasher" }));
    else {
      const drawers = st.baseFill === "drawers" || (st.baseFill === "mix" && mix++ % 2 === 0);
      cabs.push(
        drawers
          ? mk({ ...b, kind: "base", h: BASE_H, fill: "drawers", count: st.drawerCount, front: st.frontBase })
          : mk({ ...b, kind: "base", h: BASE_H, fill: "shelves", count: 2, front: st.frontBase }),
      );
    }
  });

  // ── THE WALL BANDS ─────────────────────────────────────────────────────────────────────────
  // One definition (wallBandsFor), shared with the store, which seats a CORNER UNIT in each band.
  const bands = wallBandsFor(st.wall, v.ceiling, v.reveal);
  const mainBand = bands[0];
  const antresolBand = bands[1]; // undefined unless the strategy asked for a second row
  const upperH = mainBand.h;

  // A SMALL KITCHEN CANNOT AFFORD BARE WALLS.
  //
  // `upperCoverage: "partial"` skips the wall unit over the sink, and any slot under 500mm. In a
  // big kitchen that reads as airy and it is the cheap variant's whole point. In a SMALL one it is
  // ruinous: a 2.2m run has about three base slots, one is the sink and one is usually narrow, so
  // the rules stack up and the kitchen comes out with NO WALL STORAGE AT ALL — which is exactly
  // where the storage has to go when there is no floor to spare.
  //
  // So coverage is a function of how much wall the kitchen actually has, not just of the variant.
  // Below `TIGHT_RUN` the wall gets covered regardless of the strategy. The window rule stays: that
  // one is physics, not taste.
  const coverage = L < TIGHT_RUN ? "full" : st.upperCoverage;

  const uppers: Cabinet[] = [];
  baseSlots.forEach((s, i) => {
    const onWindow = overlapsWin(s.x, s.w);
    if (i === hobIdx) {
      if (v.hood === "dome") uppers.push(mk({ kind: "upper", w: s.w, h: 350, fill: "open", count: 0, front: "none", handle: 3, appliance: "hood", x: s.x, run: rf.run }));
      else if (!onWindow) uppers.push(mk({ kind: "upper", w: s.w, h: upperH, fill: "shelves", count: 2, front: st.frontUpper, handle: st.handle, x: s.x, run: rf.run }));
      return;
    }
    if (i === sinkIdx && coverage !== "full") return;
    if (coverage === "partial" && s.w < 500) return;

    // CLIP THE UPPER TO THE WALL THAT IS ACTUALLY THERE — don't throw the whole slot away.
    //
    // This used to be `if (onWindow) return`: a base slot that overlapped a window by ONE
    // MILLIMETRE got no wall unit at all. On a 2.2m run with a 1.2m window that is every slot, so a
    // small kitchen came out with zero wall storage — the wall beside the glass, which is perfectly
    // good hanging space, was thrown away with the glass.
    //
    // Subtracting the windows leaves the hangable spans. A slot clear of glass yields itself back
    // unchanged, so nothing about a window-free wall changes. The clipped edges land on the window
    // reveal, which is where a cabinet should end anyway — and where the sheet puts a column line.
    for (const sp of subtract(s.x, s.x + s.w, windows)) {
      const w = sp.b - sp.a;
      if (w < MIN_W) continue; // a sliver of wall beside a window is a filler, not a cabinet
      uppers.push(mk({ kind: "upper", w, h: upperH, fill: "shelves", count: 2, front: st.frontUpper, handle: st.handle, x: sp.a, run: rf.run }));
    }
  });

  // The antresol row's columns are taken from the main row so the two share the same boundaries and
  // the stack reads as one bank. Snapshot them BEFORE the corner widening below: a DEEP antresol
  // needs the big 840 corner square and therefore has no reach into the zone, so it must not
  // inherit the shallow row's +227.
  const preWiden = uppers.map((u) => ({ x: u.x ?? 0, w: u.w, hood: u.appliance === "hood" }));

  // A shallow wall unit's corner (613) is smaller than the zone the run cleared (840), so the
  // corner-most upper is widened by the difference to butt it flush. `runReach` is the same
  // quantity, keyed on depth — a deep row gets 0.
  const EXT = runReach(mainBand.depth);
  const TOL = 60;
  if (EXT > 0 && uppers.length) {
    if (rf.cornerStart) {
      const first = uppers.reduce((a, b) => ((b.x ?? 0) < (a.x ?? 0) ? b : a));
      if ((first.x ?? 0) <= TOL) { first.x = (first.x ?? 0) - EXT; first.w += EXT; }
    }
    if (rf.cornerEnd) {
      const last = uppers.reduce((a, b) => ((b.x ?? 0) + b.w > (a.x ?? 0) + a.w ? b : a));
      if ((last.x ?? 0) + last.w >= L - TOL) last.w += EXT;
    }
  }
  cabs.push(...uppers);

  // ── THE ANTRESOL ROW ──────────────────────────────────────────────────────────────────────
  // A second band of wall units SEATED ON the first, filling the last of the wall to the ceiling.
  // It may be DEEPER than the row below it (base depth, 560) — real kitchens do this for storage,
  // and the box simply overhangs the uppers.
  //
  // It also spans the dome-hood slot: a dome hood tops out at 1770, far below the antresol's 2240,
  // so the band runs unbroken over it instead of leaving a hole in the middle of the wall.
  if (antresolBand) {
    const AEXT = runReach(antresolBand.depth); // 0 when the row is deep
    const seats = [...preWiden.filter((s) => !s.hood), ...preWiden.filter((s) => s.hood)];
    const lastIdx = seats.reduce((b, s, i) => (s.x + s.w > seats[b].x + seats[b].w ? i : b), 0);
    const firstIdx = seats.reduce((b, s, i) => (s.x < seats[b].x ? i : b), 0);
    seats.forEach((s, i) => {
      let { x, w } = s;
      // widen this row's corner-most unit by ITS OWN reach, not the row below it's
      if (AEXT > 0 && rf.cornerStart && i === firstIdx && x <= TOL) { x -= AEXT; w += AEXT; }
      if (AEXT > 0 && rf.cornerEnd && i === lastIdx && x + w >= L - TOL) w += AEXT;
      cabs.push(
        mk({
          kind: "upper",
          w,
          h: antresolBand.h,
          mountY: antresolBand.mountY,
          depth: antresolBand.depth,
          fill: "shelves",
          count: 1,
          front: st.frontUpper,
          handle: st.handle,
          x,
          run: rf.run,
        }),
      );
    });
  }

  return cabs;
}

/** Hob slot, by kitchen-design rules (priority order, never relaxing the window rule
 *  until the last resort): a cooktop must NOT sit under/in front of a window (fire +
 *  no hood venting), and must have worktop BETWEEN it and the sink/dishwasher (no
 *  cooktop directly next to water). Among the valid slots, sit as far as possible from
 *  EVERY `avoid` point (sink, fridge tower, dead corners) — i.e. maximise the smallest
 *  distance to any of them — to spread the work triangle and keep the cooktop out of
 *  the blind corner. */
function pickHob(slots: BaseSlot[], sinkIdx: number, overlapsWin: (x: number, w: number) => boolean, avoid: number[]): number {
  if (!slots.length) return -1;
  const cx = (i: number) => slots[i].x + slots[i].w / 2;
  const pts = avoid.length ? avoid : [sinkIdx >= 0 ? cx(sinkIdx) : 0];
  const minDist = (i: number) => Math.min(...pts.map((p) => Math.abs(cx(i) - p)));
  const farthest = (pool: number[]) => (pool.length ? pool.reduce((b, i) => (minDist(i) > minDist(b) ? i : b), pool[0]) : -1);
  const win = (i: number) => overlapsWin(slots[i].x, slots[i].w);
  // index gap from the sink — the dishwasher sits at sink±1, so ≥2 means a cabinet
  // stands between the cooktop and both the sink and the dishwasher
  const sep = (i: number) => (sinkIdx < 0 ? 99 : Math.abs(i - sinkIdx));
  const idxs = slots.map((_, i) => i).filter((i) => i !== sinkIdx);
  const tiers = [
    idxs.filter((i) => !win(i) && sep(i) >= 2 && slots[i].w >= 500), // ideal: off-window, clear of sink+dishwasher, wide
    idxs.filter((i) => !win(i) && sep(i) >= 2 && slots[i].w >= 450),
    idxs.filter((i) => !win(i) && sep(i) >= 1 && slots[i].w >= 450), // off-window, at least not abutting the sink
    idxs.filter((i) => !win(i)), // any off-window slot — the window rule holds
    idxs, // last resort only (a run that's all window)
  ];
  for (const t of tiers) {
    const pick = farthest(t);
    if (pick >= 0) return pick;
  }
  return -1;
}

interface Role {
  sink: boolean;
  hob: boolean;
  dw: boolean;
  talls: boolean;
}

/** Spread sink / hob / fridge-bank across the wall runs per the layout — the
 *  work-triangle placement from kitchen-design guides (KitchenAid "9 kitchen layouts"):
 *   • single wall  → fridge — sink — cooktop in a line (fillRun spaces them).
 *   • galley       → fridge + cooktop on ONE wall (opposite ends); sink + dishwasher on
 *                    the OPPOSITE (water) wall.
 *   • L            → sink + dishwasher + fridge on the water wall; cooktop on the other
 *                    wall, so the fridge and cooktop land at the two open ends with the
 *                    sink "between" them by the corner.
 *   • U            → sink + dishwasher in the CENTRE (middle run); fridge and cooktop on
 *                    the two opposite arms.
 *  Dishwasher always rides with the sink (fillRun seats it beside the sink). */
function assignRoles(layout: KitchenLayout, runs: RunInput[], waterRun: number): Record<number, Role> {
  const wallIdx = runs.map((_, i) => i).filter((i) => runs[i].kind === "wall");
  const roles: Record<number, Role> = {};
  const set = (i: number, r: Partial<Role>) => (roles[i] = { sink: false, hob: false, dw: false, talls: false, ...r });
  const water = wallIdx.includes(waterRun) ? waterRun : wallIdx[0];

  if (layout === "i" || layout === "peninsula" || wallIdx.length === 1) {
    set(wallIdx[0], { sink: true, hob: true, dw: true, talls: true });
  } else if (layout === "u" && wallIdx.length >= 3) {
    const mid = wallIdx[1];
    const arms = wallIdx.filter((i) => i !== mid);
    set(mid, { sink: true, dw: true }); // sink in the centre of the U
    set(arms[0], { hob: true }); // cooktop on one arm,
    set(arms[1] ?? arms[0], { talls: true }); // fridge on the opposite arm
  } else if (layout === "l") {
    const other = wallIdx.find((i) => i !== water) ?? water;
    set(water, { sink: true, dw: true, talls: true }); // sink by the corner, fridge at the open end
    set(other, { hob: true }); // cooktop on the other wall → opposite open end
  } else {
    // galley (two parallel walls)
    const other = wallIdx.find((i) => i !== water) ?? water;
    set(water, { sink: true, dw: true }); // sink on the water wall
    set(other, { hob: true, talls: true }); // fridge + cooktop on the opposite wall
  }
  for (const i of wallIdx) if (!roles[i]) set(i, {});
  return roles;
}

/** Storage modules for an island / peninsula run (base drawers, no uppers). */
function fillStorageRun(r: RunInput, runIdx: number, st: Strategy): Cabinet[] {
  const cabs: Cabinet[] = [];
  let x = 0;
  for (const w of packWidths(r.len, st.ladder)) {
    cabs.push(mk({ kind: "base", h: BASE_H, w, fill: "drawers", count: 3, front: st.frontBase, handle: st.handle, x, run: runIdx }));
    x += w;
  }
  return cabs;
}

const FRIDGE_NOTE: Record<FridgeType, string> = { integ: "встроенный х-к", free: "отдельный х-к", none: "без х-ка" };
const OVEN_NOTE: Record<OvenType, string> = { under: "духовка под столешницей", tall: "духовка-пенал" };
const HOOD_NOTE: Record<HoodType, string> = { integ: "встроенная вытяжка", dome: "купольная вытяжка" };
const LAYOUT_NOTE: Record<KitchenLayout, string> = { i: "Прямая", galley: "Параллельная", l: "Угловая", u: "П-образная", peninsula: "С полуостровом", all: "По всем стенам" };

const FALLBACK_LAYOUT: PlannedLayout = { layout: "i", runs: [], waterRun: 0 };

/** Generate the four Phase-B variants. The selected layout(s) AND onboarding option
 *  sets are spread across the variants, so multi-select → genuinely different kitchens. */
export function generateVariants(input: LayoutInput): GenVariant[] {
  const lays = input.layouts.length ? input.layouts : [FALLBACK_LAYOUT];
  const fr = input.fridge.length ? input.fridge : (["free"] as FridgeType[]);
  const ov = input.oven.length ? input.oven : (["under"] as OvenType[]);
  const ho = input.hood.length ? input.hood : (["integ"] as HoodType[]);
  const layoutVaries = lays.length > 1;
  const applVaries = fr.length > 1 || ov.length > 1 || ho.length > 1;

  // more selected layouts → more variants (like IKEA): 2 finishes per layout,
  // min 4, max 8. Staggered so every (layout × finish) pairing is distinct.
  const count = Math.max(4, Math.min(8, lays.length * 2));

  const wl = input.wall ?? [];
  const fl = input.front ?? [];
  // A raised-panel (неоклассика) kitchen glazes its wall units — that IS photo 1. Every other pick
  // runs the same body top and bottom.
  const upperFor = (p: FrontProfile): FrontProfile => (p === "raised" ? "grid" : p);

  return Array.from({ length: count }, (_, si) => {
    const pl = lays[si % lays.length];
    const base = STRATEGIES[Math.floor(si / lays.length) % STRATEGIES.length];
    // The user ASKED for a wall shape → every variant obeys, and the variants then differ by finish
    // and storage instead. With >1 picked, they're spread across the variants like the appliances.
    // Nothing picked → each strategy keeps its own, which is the better default: you see all three
    // shapes side by side and just point at one.
    let st: Strategy = wl.length
      ? { ...base, wall: wl[si % wl.length], tallToCeiling: wl[si % wl.length] !== "single" }
      : base;
    if (fl.length) {
      const p = fl[si % fl.length];
      st = { ...st, frontBase: p, frontUpper: upperFor(p) };
    }
    const { layout, runs, waterRun } = pl;
    const roles = assignRoles(layout, runs, waterRun);
    const hi = (si >> 1) & 1;
    const lo = si & 1;
    const fridge = fr[hi % fr.length];
    const oven = ov[lo % ov.length];
    const hood = ho[(hi ^ lo) % ho.length];

    const v: VariantInput = { layout, runs, waterRun, ceiling: input.ceiling, reveal: input.reveal ?? DEFAULT_REVEAL, water: input.water, fridge, oven, hood };
    const cook: RunFill["cook"] = oven === "tall" ? "cooktop" : "hob";
    const talls = tallsFor(v, st);
    const cabs: Cabinet[] = [];
    runs.forEach((r, i) => {
      if (r.kind !== "wall") {
        if (r.kind === "island" && !st.island) return; // island only for some variants
        if (r.len > 600) cabs.push(...fillStorageRun(r, i, st));
        return;
      }
      const role = roles[i] ?? { sink: false, hob: false, dw: false, talls: false };
      const tallEnd: RunFill["tallEnd"] = r.cornerEnd ? "near" : layout === "i" && v.water === "right" ? "near" : "far";
      cabs.push(
        ...fillRun(
          { length: r.len, run: i, sink: role.sink, cook: role.hob ? cook : "none", dishwasher: role.dw && st.dishwasher, talls: role.talls ? talls : [], tallEnd, openings: r.openings, cornerStart: r.cornerStart, cornerEnd: r.cornerEnd },
          st,
          v,
        ),
      );
    });

    // when layouts vary, lead with the layout name and put the finish in the blurb
    const name = layoutVaries ? LAYOUT_NOTE[layout] : st.name;
    const bits: string[] = [];
    if (layoutVaries) bits.push(st.name);
    if (applVaries) bits.push([FRIDGE_NOTE[fridge], OVEN_NOTE[oven], HOOD_NOTE[hood]].join(", "));
    return {
      id: `${st.id}-${si}`,
      name,
      blurb: bits.join(" · ") || st.blurb,
      cabs,
      style: st.style,
      layout,
      bands: wallBandsFor(st.wall, input.ceiling, input.reveal ?? DEFAULT_REVEAL),
    };
  });
}
