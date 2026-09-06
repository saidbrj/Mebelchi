// THE FLAT PANELS THAT CLOSE A WALL — the фартук and the strip up to the ceiling.
//
// A kitchen is not only boxes. Between the worktop and the wall units there is a стеновая панель
// («фартук»), and above the top row there is the panel that takes the cabinetry to the ceiling.
// Both are flat sheets fixed to the wall, both are cut from a real board, both cost money — and
// neither of them existed in the model. The gap between the bands was literally a `void` row that
// nothing ever drew, and the strip under the ceiling was a render-only scribe in kitchen3d.ts that
// only appeared when the gap happened to be ≤120mm.
//
// DERIVED, NEVER STORED — the same doctrine as the side fillers («доборы»). What is stored is the
// SPEC (is there a фартук, what decor, how tall); WHERE the panels go is read off the resolved
// layout every time. A cabinet that moves, grows or is deleted re-shapes the panel behind it with
// no self-healing pass, because there is nothing to heal.
//
// ONE derivation, three consumers: the 3D draws these bands, the quote prices them, and the cut
// list will cut them. That is deliberate — the alternative is the drift this codebase has already
// paid for once (see model/resolve.ts).
//
// Everything here is in WALL space (mm from the wall start, corner zones included), which is what
// `ResolvedLayout.elevation()` returns and what `Placement.startS` already measures. The 3D
// divides by 1000 and draws; nothing converts back to run-local.
//
// Pure. No React, no store, no THREE.

import { cabBand, cabDepth } from "./bands";
import { wallFeatures, cornerOffset, cornerEndOffset, startOffset, endOffset, type ResolvedLayout, type ResolvedCab } from "./resolve";
import type { PlannedRun } from "./runPlan";
import type { Opening, Fitting } from "./room";
import type { KitchenStyle } from "./layout";

/** WHERE THE PANEL'S DECOR COMES FROM.
 *
 *  `worktop` is the premium look and the default: the same decor as the counter, mapped in the same
 *  run space, so the veining runs off the back of the worktop and straight up the wall. That
 *  continuity is the whole reason a stone фартук reads as expensive — a matching colour with a
 *  restarted pattern does not. */
export type PanelDecor = "worktop" | "facade" | "carcass" | "custom";

/** THE ФАРТУК. */
export interface SplashSpec {
  on: boolean;
  decor: PanelDecor;
  /** colour int — `custom` only; ignored otherwise (the decor is read off the style). */
  color?: number;
  /** `fill` = worktop → the underside of whatever hangs above (the modern default: no dead strip).
   *  `fixed` = `h` mm of panel and bare wall above it, which is what a tiled splashback looks like. */
  mode: "fill" | "fixed";
  /** height in `fixed` mode, and the fallback height where nothing hangs above (mm) */
  h: number;
  /** board thickness (mm) — 6 for a laminate panel, 8-10 for stone, 6 for скинали glass */
  t: number;
}

/** THE STRIP TO THE CEILING. */
export interface CloserSpec {
  on: boolean;
  /** The biggest gap worth closing with a flat panel (mm). Above this the wall does not want a
   *  panel, it wants another ROW of cabinets — closing a metre of wall with one sheet looks like
   *  what it is. Below ~150 it is a scribe («добор»); above that it is a фальш-панель. Same
   *  geometry, so one rule covers both. */
  maxGap: number;
  decor: PanelDecor;
  color?: number;
  t: number;
}

/** THE PANEL UNDER THE WALL UNITS.
 *
 *  A row of wall units has a bottom board per cabinet, so from below you read a row of separate
 *  boxes with a seam at every join. Real kitchens don't look like that: the undersides are one
 *  continuous plane, the same way the worktops are one slab rather than a counter per cabinet.
 *
 *  IT REPLACES THE PER-CABINET BOTTOMS, it does not sit under them — the 3D suppresses a bottom
 *  board wherever this plane covers it. So it is the same board area as before, drawn as the one
 *  surface it looks like, and it is deliberately NOT priced as an extra panel: each module still
 *  bills its own bottom. Actually MERGING the cut into one long board is a different (and cheaper)
 *  thing, and this app already has it — that is what `carcassGroup` does. */
export interface UndersideSpec {
  on: boolean;
  decor: PanelDecor;
  color?: number;
  /** board thickness (mm) */
  t: number;
}

export interface PanelSpecs {
  splash: SplashSpec;
  closer: CloserSpec;
  underside: UndersideSpec;
}

/** MODERN DEFAULT: a фартук to the underside of the wall units, and the cabinetry closed to the
 *  ceiling. Both switchable — a shop that tiles its splashbacks turns the first one off. */
export const DEFAULT_SPLASH: SplashSpec = { on: true, decor: "worktop", mode: "fill", h: 600, t: 6 };
export const DEFAULT_CLOSER: CloserSpec = { on: true, maxGap: 800, decor: "facade", t: 16 };
/** Carcass decor by default: it is the box's own underside, not a facade. */
export const DEFAULT_UNDERSIDE: UndersideSpec = { on: true, decor: "carcass", t: 16 };
export const DEFAULT_PANELS: PanelSpecs = { splash: DEFAULT_SPLASH, closer: DEFAULT_CLOSER, underside: DEFAULT_UNDERSIDE };

/** A hole in a panel, in PANEL-LOCAL mm (origin = the band's bottom-left corner). A socket, a
 *  switch, a vent grille — the things that end up in a фартук and have to be cut before it ships. */
export interface PanelCut {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

/** One flat panel, in WALL space. */
export interface PanelBand {
  kind: "splash" | "closer" | "underside";
  run: number;
  /** wall-space span (mm) */
  x0: number;
  x1: number;
  /** above the floor (mm) */
  y0: number;
  y1: number;
  /** how far the panel stands off the wall — its thickness (mm) */
  t: number;
  /** how deep the modules this panel belongs to are (mm). A closer matches the row under it; a
   *  фартук reports the COUNTER depth below it — the 3D needs it to continue the worktop's pattern
   *  up the wall, and the fitter needs to know what the panel meets. */
  depth: number;
  /** rectangular holes, panel-local mm */
  cuts: PanelCut[];
  /** what to draw / price it in (colour int, resolved from the decor + style) */
  color: number;
}

export const panelW = (b: PanelBand): number => b.x1 - b.x0;
export const panelH = (b: PanelBand): number => b.y1 - b.y0;
/** panel area in m² — what the quote charges for */
export const panelArea = (b: PanelBand): number => (panelW(b) * panelH(b)) / 1_000_000;

// ── span algebra ────────────────────────────────────────────────────────────────────────────────
// A panel is what is LEFT of a wall once the things that interrupt it are taken out, so all three
// of these are needed: union (the counter run), subtract (talls, windows) and a sweep (the height
// profile of what hangs above). Small and pure; the tests pin them through the public API.

interface Span {
  a: number;
  b: number;
}

const TOL = 2; // mm — two cabinets that meet are one span, not two

function union(spans: Span[]): Span[] {
  const sorted = [...spans].filter((s) => s.b - s.a > TOL).sort((p, q) => p.a - q.a);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.a <= last.b + TOL) last.b = Math.max(last.b, s.b);
    else out.push({ ...s });
  }
  return out;
}

function subtract(from: Span[], cuts: Span[]): Span[] {
  let out = from;
  for (const c of union(cuts)) {
    const next: Span[] = [];
    for (const s of out) {
      if (c.b <= s.a || c.a >= s.b) {
        next.push(s); // no overlap
        continue;
      }
      if (c.a - s.a > TOL) next.push({ a: s.a, b: c.a });
      if (s.b - c.b > TOL) next.push({ a: c.b, b: s.b });
    }
    out = next;
  }
  return out;
}

/** Split `span` where `value` changes, and merge neighbours that agree.
 *
 *  This is what stops one фартук from being one height: a hood hangs lower than the wall units, so
 *  the panel behind the hob is short and the panel either side of it is tall. Sweeping the profile
 *  instead of taking a single min over the whole run is the difference between a drawing and a
 *  kitchen. */
function sweep<T>(span: Span, edges: number[], valueAt: (mid: number) => T, same: (a: T, b: T) => boolean): { a: number; b: number; v: T }[] {
  const xs = [span.a, span.b, ...edges.filter((e) => e > span.a + TOL && e < span.b - TOL)].sort((p, q) => p - q);
  const out: { a: number; b: number; v: T }[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (b - a <= TOL) continue;
    const v = valueAt((a + b) / 2);
    const last = out[out.length - 1];
    if (last && same(last.v, v)) last.b = b;
    else out.push({ a, b, v });
  }
  return out;
}

const overlaps = (rc: ResolvedCab, mid: number): boolean => rc.x <= mid && rc.x + rc.w >= mid;

/**
 * REACH THE SIDE WALL. The cabinets stop a scribe gap («добор») short of a wall they butt — a panel
 * does not. Nobody fits a фартук 50mm shy of the return wall and leaves a stripe of bare plaster
 * there; the panel runs into the corner and the scribe strip covers the cabinets' gap below it.
 *
 * Only across the REVEAL, never across a corner zone: a corner zone holds an 840mm cabinet, and
 * where there is one it is already in the elevation and the span already reaches it.
 */
function reachWalls(pr: PlannedRun, wl: number, seg: Span): Span {
  const out = { ...seg };
  if ((pr.revealStart ?? 0) > 0 && Math.abs(seg.a - startOffset(pr)) < TOL) out.a = cornerOffset(pr);
  if ((pr.revealEnd ?? 0) > 0 && Math.abs(seg.b - (wl - endOffset(pr))) < TOL) out.b = wl - cornerEndOffset(pr);
  return out;
}

// ── which modules matter ────────────────────────────────────────────────────────────────────────

/** Modules that belong to a wall elevation's panel arithmetic. Fillers are the panels' own
 *  siblings, free furniture and islands are not on the wall at all. */
const onWall = (rc: ResolvedCab): boolean =>
  !rc.cab.furniture && rc.cab.appliance !== "filler" && !rc.cab.island;

const isBase = (rc: ResolvedCab): boolean => onWall(rc) && rc.cab.kind === "base";
const isTall = (rc: ResolvedCab): boolean => onWall(rc) && rc.cab.kind === "tall";
/** Everything that HANGS — wall units and the hood, which is exactly what a фартук stops under.
 *  Exported because `model/ledStrips.ts` needs the SAME definition of "hung on this wall": a strip
 *  and the box it is screwed under must agree about which boxes those are. */
export const isHung = (rc: ResolvedCab): boolean => onWall(rc) && rc.cab.kind === "upper";

/** A module a FLAT panel can span.
 *
 *  A corner unit is not one. Its body is a chamfered or L-shaped prism filling the corner square,
 *  and its `depth` is that square's SIDE (613 / 840) rather than the 350 of the row it butts — so a
 *  straight rectangle drawn across it is both too deep and the wrong shape, and stands out of the
 *  chamfer into the room. It carries its own bottom and its own top; the flat panels leave it be. */
export const isStraight = (rc: ResolvedCab): boolean => !rc.cab.corner;

/** The decor colour a panel takes from the kitchen's style. */
export function panelColor(decor: PanelDecor, custom: number | undefined, style: KitchenStyle): number {
  if (decor === "custom") return custom ?? style.worktop;
  return decor === "facade" ? style.facade : decor === "carcass" ? style.carcass : style.worktop;
}

// ── the фартук ──────────────────────────────────────────────────────────────────────────────────

/**
 * THE BACKSPLASH BANDS of one wall.
 *
 * Where there is counter there is фартук: the panel starts on the worktop and stops under whatever
 * hangs above it — a wall unit, a hood, or (with nothing above) at the spec height. It is
 * interrupted by anything that owns the full height of the wall: a pantry column, a window, a
 * doorway. Sockets do not interrupt it; they are cut out of it.
 */
export function splashBands(
  L: ResolvedLayout,
  run: number,
  spec: SplashSpec,
  style: KitchenStyle,
  ceiling: number,
  openings: Opening[] = [],
  fittings: Fitting[] = [],
): PanelBand[] {
  if (!spec.on) return [];
  const pr = L.runs[run];
  if (!pr || pr.kind !== "wall") return []; // an island has no wall behind it
  const cells = L.elevation(run);
  const bases = cells.filter(isBase);
  if (!bases.length) return [];

  const color = panelColor(spec.decor, spec.color, style);
  const feats = wallFeatures(pr, L.wallLen(run), openings, fittings);
  const hung = cells.filter(isHung);

  /** THE ROW'S LINE — the underside of this wall's wall units, ignoring the hood.
   *
   *  A фартук is one panel at one height; it does not dip in the gap between two cabinets. Taking
   *  the height purely from what is directly overhead gave a stepped edge wherever the uppers had a
   *  break in them, which is not a thing any kitchen has. So a stretch with nothing above it takes
   *  the ROW's line, and only a stretch with something genuinely LOWER above it (the hood) steps
   *  down. A run with no wall units at all has no line to take, and falls back to the spec height. */
  const rowBottom = (() => {
    const row = hung.filter((rc) => rc.cab.appliance !== "hood").map((rc) => cabBand(rc.cab).y0);
    return row.length ? Math.min(...row) : null;
  })();

  // WHERE there is panel: the counter run, less the columns and openings that break it.
  const counter = union(bases.map((rc) => ({ a: rc.x, b: rc.x + rc.w })));
  const breaks: Span[] = [
    ...cells.filter(isTall).map((rc) => ({ a: rc.x, b: rc.x + rc.w })),
    // a window sill at counter height, a doorway — the panel stops at the reveal, it does not
    // cross the glass. (A window ABOVE the splash zone is not a break; the y-test decides.)
    ...feats.filter((f) => f.blocks).map((f) => ({ a: f.x0, b: f.x1 })),
  ];

  const wl = L.wallLen(run);
  const out: PanelBand[] = [];
  for (const seg of subtract(counter, breaks)) {
    // the worktop is level per base, but a shop CAN sit one module higher — take the top under
    // each stretch rather than a project-wide constant
    const edges = [
      ...bases.flatMap((rc) => [rc.x, rc.x + rc.w]),
      ...hung.flatMap((rc) => [rc.x, rc.x + rc.w]),
    ];
    const profile = sweep(
      seg,
      edges,
      (mid) => {
        const under_ = bases.filter((rc) => overlaps(rc, mid));
        const y0 = Math.max(...under_.map((rc) => cabBand(rc.cab).y1), 0);
        const above = hung.filter((rc) => overlaps(rc, mid)).map((rc) => cabBand(rc.cab).y0);
        const top = above.length ? Math.min(...above) : Infinity;
        // `fill` reaches the cabinet above — or, with nothing above, the row's own line;
        // `fixed` is a set height that still never runs into a cabinet
        const line = rowBottom ?? y0 + spec.h;
        const want = spec.mode === "fill" ? (Number.isFinite(top) ? top : line) : y0 + spec.h;
        return {
          y0,
          y1: Math.min(want, top, ceiling),
          depth: Math.max(...under_.map((rc) => cabDepth(rc.cab)), 0),
        };
      },
      (a, b) => Math.abs(a.y0 - b.y0) < 1 && Math.abs(a.y1 - b.y1) < 1 && Math.abs(a.depth - b.depth) < 1,
    );
    // reach the side wall AFTER the sweep, by stretching the outermost piece — extending the span
    // first would sweep the scribe gap as its own zone (no counter under it, so no height) and split
    // one panel into two.
    const reach = reachWalls(pr, wl, seg);
    if (profile.length) {
      profile[0].a = reach.a;
      profile[profile.length - 1].b = reach.b;
    }
    for (const p of profile) {
      if (p.v.y1 - p.v.y0 < 100) continue; // a sliver is not a panel
      out.push(band("splash", run, p.a, p.b, p.v.y0, p.v.y1, spec.t, p.v.depth, color, feats));
    }
  }
  return out;
}

// ── the strip to the ceiling ────────────────────────────────────────────────────────────────────

/**
 * THE CEILING CLOSER — what turns a kitchen floor-to-ceiling.
 *
 * Two rooms, two answers, one rule. A tall room has space for a second row of wall units and the
 * antresol already meets the ceiling, so this finds no gap and emits nothing. A low room has room
 * for one row and a few hundred millimetres of dead wall above it — and dead wall above a kitchen
 * is the tell of a cheap job. That gap is closed with a flat panel, matching the fronts.
 *
 * `maxGap` is what keeps this honest: a gap too big for a panel is a missing ROW, and the answer to
 * it is «3-й ряд», not a metre-tall sheet of MDF.
 */
export function closerBands(
  L: ResolvedLayout,
  run: number,
  ceiling: number,
  spec: CloserSpec,
  style: KitchenStyle,
): PanelBand[] {
  if (!spec.on || ceiling <= 0) return [];
  const pr = L.runs[run];
  if (!pr || pr.kind !== "wall") return [];
  const cells = L.elevation(run);
  // what stands up the wall: the wall units and the columns. A hood is excluded — it hangs at its
  // own height over the hob and the row beside it is what meets the ceiling.
  const cols = cells.filter((rc) => ((isHung(rc) && rc.cab.appliance !== "hood") || isTall(rc)) && isStraight(rc));
  if (!cols.length) return [];

  const color = panelColor(spec.decor, spec.color, style);
  // merge across small breaks so a 30mm seam between two cabinets doesn't split the strip in two
  const spans = union(cols.map((rc) => ({ a: rc.x - 40, b: rc.x + rc.w + 40 })));
  const edges = cols.flatMap((rc) => [rc.x, rc.x + rc.w]);

  const out: PanelBand[] = [];
  for (const seg of spans) {
    const profile = sweep(
      seg,
      edges,
      (mid) => {
        const here = cols.filter((rc) => overlaps(rc, mid));
        if (!here.length) return null;
        return {
          top: Math.max(...here.map((rc) => cabBand(rc.cab).y1)),
          depth: Math.max(...here.map((rc) => cabDepth(rc.cab))),
        };
      },
      (a, b) => (a === null) === (b === null) && (!a || !b || (Math.abs(a.top - b.top) < 1 && Math.abs(a.depth - b.depth) < 1)),
    );
    for (const p of profile) {
      if (!p.v) continue;
      const gap = ceiling - p.v.top;
      if (gap <= 2 || gap > spec.maxGap) continue;
      // clip back to the real cabinets — the ±40 merge margin must not hang the panel in mid-air —
      // then let it reach the side wall across the scribe gap, exactly as the фартук does
      const clipped = {
        a: Math.max(p.a, Math.min(...cols.map((rc) => rc.x))),
        b: Math.min(p.b, Math.max(...cols.map((rc) => rc.x + rc.w))),
      };
      const { a, b } = reachWalls(pr, L.wallLen(run), clipped);
      if (b - a <= TOL) continue;
      out.push(band("closer", run, a, b, p.v.top, ceiling, spec.t, p.v.depth, color, []));
    }
  }
  return out;
}

// ── the panel under the wall units ──────────────────────────────────────────────────────────────

/**
 * THE UNDERSIDE — one plane under a row of wall units, the way the worktop is one slab over a row
 * of base units.
 *
 * Clustered by ROW, not by run: a wall can carry a main row at 1520 and an antresol above it, and
 * each is its own plane. Within a row the panel merges across the small breaks between cabinets
 * (that is the whole point — you should not see where one box ends and the next begins), but a real
 * break — a gap wider than a cabinet's worth of wall — starts a new panel rather than a strip
 * hanging over nothing.
 *
 * The hood is excluded: it hangs at its own height with its own bottom, and a plane joining it to
 * the row beside it would be a picture of a kitchen nobody builds.
 */
export function undersideBands(
  L: ResolvedLayout,
  run: number,
  spec: UndersideSpec,
  style: KitchenStyle,
): PanelBand[] {
  if (!spec.on) return [];
  const pr = L.runs[run];
  if (!pr || pr.kind !== "wall") return [];

  const color = panelColor(spec.decor, spec.color, style);
  const wl = L.wallLen(run);
  const out: PanelBand[] = [];

  // ONE PLANE PER STRETCH of wall units (`hungSpans`) — the same stretches the under-cabinet LED
  // follows, because the strip is screwed to this panel.
  for (const { y0, members: here, x0: ca, x1: cb } of hungSpans(L, run)) {
    {
      const clipped = { a: ca, b: cb };
      // SWEEP THE DEPTH along the row. One max over the whole stretch made a 350mm row of wall
      // units wear a plane as deep as its deepest member, which stood a quarter of a metre out into
      // the room the moment anything deeper stood in the row.
      const edges = here.flatMap((rc) => [rc.x, rc.x + rc.w]);
      const depths = sweep(
        clipped,
        edges,
        (mid) => {
          const over = here.filter((rc) => overlaps(rc, mid));
          return over.length ? Math.max(...over.map((rc) => cabDepth(rc.cab))) : 0;
        },
        (a, b) => a === b,
      );
      if (!depths.length) continue;
      // reach the side wall by stretching the outermost piece — sweeping the extended span first
      // would read the scribe gap as its own depth-less zone and split one plane in two
      const reached = reachWalls(pr, wl, clipped);
      depths[0].a = reached.a;
      depths[depths.length - 1].b = reached.b;
      for (const p of depths) {
        // y0 is the carcass bottom, and the bottom board is the first `t` of the box — so the plane
        // occupies exactly the space the boards it replaces did
        if (!p.v) continue;
        out.push(band("underside", run, p.a, p.b, y0, y0 + spec.t, spec.t, p.v, color, []));
      }
    }
  }
  return out;
}

/** One continuous stretch of wall units, at the height their undersides share. */
export interface HungSpan {
  /** the height the row's undersides agree on (mm above the floor) */
  y0: number;
  /** wall-space span (mm), clipped back to the real cabinets */
  x0: number;
  x1: number;
  /** the units this stretch is made of, in wall order */
  members: ResolvedCab[];
}

/**
 * THE ROWS OF WALL UNITS ON A RUN, and the continuous stretches inside each row.
 *
 * Two units share a row when their undersides agree — the same test `resolve.wallRows` uses to turn
 * stacked uppers into rows, applied to the BOTTOM edge because that is the line these consumers
 * care about. Within a row the stretches merge across the joins between cabinets but not across a
 * real hole, so a row broken by a window comes back as two.
 *
 * Shared on purpose: the underside plane and the strip lit under it must follow the SAME line, or
 * the light hangs off the end of the panel it is screwed to.
 */
export function hungSpans(L: ResolvedLayout, run: number): HungSpan[] {
  const pr = L.runs[run];
  if (!pr || pr.kind !== "wall") return [];
  const uppers = L.elevation(run).filter((rc) => isHung(rc) && rc.cab.appliance !== "hood" && isStraight(rc));
  if (!uppers.length) return [];

  const rows = new Map<number, ResolvedCab[]>();
  for (const rc of uppers) {
    const y0 = cabBand(rc.cab).y0;
    const key = [...rows.keys()].find((k) => Math.abs(k - y0) < 30) ?? y0;
    rows.set(key, [...(rows.get(key) ?? []), rc]);
  }

  const out: HungSpan[] = [];
  for (const [y0, members] of rows) {
    const MERGE = 120; // mm — a seam, a scribe, a filler; anything wider is a gap, not a join
    for (const sp of union(members.map((rc) => ({ a: rc.x - MERGE / 2, b: rc.x + rc.w + MERGE / 2 })))) {
      const here = members.filter((rc) => rc.x + rc.w > sp.a && rc.x < sp.b);
      if (!here.length) continue;
      // clip the merge margin back off the ends — it exists to bridge joins, not to overhang
      const x0 = Math.max(sp.a, Math.min(...here.map((rc) => rc.x)));
      const x1 = Math.min(sp.b, Math.max(...here.map((rc) => rc.x + rc.w)));
      if (x1 - x0 <= TOL) continue;
      out.push({ y0, x0, x1, members: [...here].sort((a, b) => a.x - b.x) });
    }
  }
  return out.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

// ── assembly ────────────────────────────────────────────────────────────────────────────────────

/** Build a band and punch the wall features that fall inside it. */
function band(
  kind: PanelBand["kind"],
  run: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  t: number,
  depth: number,
  color: number,
  feats: { id: string; kind: string; x0: number; x1: number; y0: number; y1: number; blocks: boolean; label: string }[],
): PanelBand {
  const cuts: PanelCut[] = [];
  for (const f of feats) {
    // only the things you actually cut a panel around. A radiator BLOCKS the panel (it is already
    // out of the span); a socket, switch or grille goes THROUGH it.
    if (f.blocks || (f.kind !== "socket" && f.kind !== "vent")) continue;
    const a = Math.max(f.x0, x0);
    const b = Math.min(f.x1, x1);
    const c = Math.max(f.y0, y0);
    const d = Math.min(f.y1, y1);
    if (b - a < 10 || d - c < 10) continue;
    cuts.push({ id: f.id, x: a - x0, y: c - y0, w: b - a, h: d - c, label: f.label });
  }
  return { kind, run, x0, x1, y0, y1, t, depth, cuts, color };
}

/** EVERY flat panel in the kitchen — the one call the 3D and the quote both make. */
export function wallPanels(opts: {
  L: ResolvedLayout;
  ceiling: number;
  specs: PanelSpecs;
  style: KitchenStyle;
  openings?: Opening[];
  fittings?: Fitting[];
}): PanelBand[] {
  const { L, ceiling, specs, style, openings = [], fittings = [] } = opts;
  const out: PanelBand[] = [];
  L.runs.forEach((_, r) => {
    out.push(...splashBands(L, r, specs.splash, style, ceiling, openings, fittings));
    out.push(...closerBands(L, r, ceiling, specs.closer, style));
    out.push(...undersideBands(L, r, specs.underside, style));
  });
  return out;
}

/**
 * The same bands, measured from the RUN's zero instead of the wall's.
 *
 * The 3D and the front elevation both work in wall space, so that is what `wallPanels` returns. The
 * PDF elevation does not: it lays a run out from its own first module (`DrawRun.wallLen` is
 * `max(x + w)` over run-local x), so a band handed to it unconverted lands a scribe gap — or a
 * whole corner zone — to the right of where it belongs.
 */
export function runLocalBands(bands: PanelBand[], L: ResolvedLayout): PanelBand[] {
  return bands.map((b) => {
    const pr = L.runs[b.run];
    const off = pr ? startOffset(pr) : 0;
    return { ...b, x0: b.x0 - off, x1: b.x1 - off };
  });
}
