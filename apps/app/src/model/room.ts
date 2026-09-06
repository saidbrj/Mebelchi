// Shared room geometry (millimetres) used by both the 2D floor plan and the 3D
// scene so they always agree. The L-shape matches the reference: a 4000×4000
// room with a 1000×1000 notch cut from the top-right → 15 m².

export type RoomShape = "i" | "l";
export interface Pt {
  x: number;
  y: number; // depth (top→bottom in plan)
}

export function roomOutlineMm(shape: RoomShape): Pt[] {
  if (shape === "l") {
    return [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 1000 },
      { x: 4000, y: 1000 },
      { x: 4000, y: 4000 },
      { x: 0, y: 4000 },
    ];
  }
  return [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ];
}

export function roomBoundsMm(shape: RoomShape): { w: number; h: number } {
  return shape === "l" ? { w: 4000, h: 4000 } : { w: 4000, h: 3000 };
}

export function roomAreaM2(shape: RoomShape): number {
  return shape === "l" ? 15 : 12;
}

// ---- editable-polygon helpers (the room is a free polygon once you edit it) ----

export function polygonAreaM2(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2 / 1_000_000;
}

export function formatAreaM2(pts: Pt[]): string {
  const a = Math.round(polygonAreaM2(pts) * 10) / 10;
  return (Number.isInteger(a) ? a.toString() : a.toFixed(1)) + " м²";
}

export function polygonBoundsMm(pts: Pt[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Polygon (mm) → metres, centred on the origin — for the 3D scene (x, z plane). */
export function pointsToMetersCentered(pts: Pt[]): { x: number; z: number }[] {
  const b = polygonBoundsMm(pts);
  return pts.map((p) => ({ x: (p.x - b.cx) / 1000, z: (p.y - b.cy) / 1000 }));
}

/** Default opening placement: window on the top-most wall, door on the bottom-most. */
export function defaultOpeningWalls(pts: Pt[]): { win: number; door: number } {
  const midY = (i: number) => (pts[i].y + pts[(i + 1) % pts.length].y) / 2;
  let win = 0;
  let door = 0;
  for (let i = 1; i < pts.length; i++) {
    if (midY(i) < midY(win)) win = i;
    if (midY(i) > midY(door)) door = i;
  }
  return { win, door };
}

// ---- openings (windows / doors / wall passages) — placed along a wall by `t` ----
export type OpeningKindId = "window" | "door" | "opening";

export interface Opening {
  id: string;
  wall: number; // wall (edge) index it sits on
  kind: OpeningKindId;
  t: number; // 0..1 position of its centre along the wall
  width: number; // mm
  height: number; // mm
  design: string; // visual variant (mullion pattern / door style)
  name: string; // catalog display name (for the info card / edit sheet)
  desc: string;
  flip?: boolean; // mirror the leaf / swing side
  sill?: number; // bottom above floor (mm); undefined = per-kind default
  finish?: string; // OPENING_FINISHES id (frame / leaf colour or wood); undefined = default
}

/** Colour / material finishes for a window frame or door leaf (the "Цвет" picker). */
export interface OpeningFinish {
  id: string;
  name: string;
  color: string; // swatch + tint
  tex?: string; // PBR texture key (wood) — overrides the flat colour in the 3D
}
export const OPENING_FINISHES: OpeningFinish[] = [
  { id: "white", name: "Белый", color: "#f4f4f4" },
  { id: "grey", name: "Серый", color: "#b7bbbf" },
  { id: "anthracite", name: "Антрацит", color: "#3b3f43" },
  { id: "black", name: "Чёрный", color: "#202225" },
  { id: "oak", name: "Дуб", color: "#c79a64", tex: "wood_oak" },
  { id: "walnut", name: "Орех", color: "#6e4a2f", tex: "wood_walnut" },
];
export function openingFinish(id: string | undefined): OpeningFinish | null {
  return id ? OPENING_FINISHES.find((f) => f.id === id) ?? null : null;
}

/** Default head/pane height (mm) for an opening kind. */
export function defaultOpeningHeight(kind: OpeningKindId): number {
  return kind === "window" ? 1200 : kind === "opening" ? 2100 : 2050;
}

/** Default sill (bottom above floor, mm): windows at 900 (a balcony block goes to
 *  the floor), doors + wall openings start at the floor. */
export function defaultOpeningSill(kind: OpeningKindId, design?: string): number {
  if (kind !== "window") return 0;
  return design === "balcony" ? 50 : 900;
}

export function defaultOpenings(pts: Pt[]): Opening[] {
  const { win, door } = defaultOpeningWalls(pts);
  return [
    { id: "win", wall: win, kind: "window", t: 0.5, width: 1000, height: 1200, design: "twin", name: "Окно", desc: "Окно с изменяемым размером" },
    { id: "door", wall: door, kind: "door", t: 0.5, width: 900, height: 2050, design: "panel", name: "Дверь", desc: "Дверь с изменяемым размером" },
  ];
}

// catalogs for the Openings menu (Windows / Doors / Wall openings)
export interface OpeningKind {
  id: string;
  name: string;
  desc: string;
  kind: OpeningKindId;
  design: string;
  width: number; // mm
  height?: number; // mm (defaults from defaultOpeningHeight when absent)
}

const OPEN_DESC = "элемент с изменяемым размером";

export const WINDOW_CATALOG: OpeningKind[] = [
  { id: "win-single", name: "Одностворчатое окно", desc: OPEN_DESC, kind: "window", design: "single", width: 600, height: 1200 },
  { id: "win-twin", name: "Двустворчатое окно", desc: OPEN_DESC, kind: "window", design: "twin", width: 1000, height: 1200 },
  { id: "win-grid", name: "Окно с раскладкой", desc: OPEN_DESC, kind: "window", design: "grid", width: 1200, height: 1300 },
  { id: "win-triple", name: "Трёхстворчатое окно", desc: OPEN_DESC, kind: "window", design: "triple", width: 1500, height: 1300 },
  { id: "win-pano", name: "Панорамное окно", desc: OPEN_DESC, kind: "window", design: "pano", width: 1800, height: 1600 },
  { id: "win-balcony", name: "Балконный блок", desc: OPEN_DESC, kind: "window", design: "balcony", width: 1500, height: 2100 },
];

export const DOOR_CATALOG: OpeningKind[] = [
  { id: "door-panel", name: "Филёнчатая дверь", desc: OPEN_DESC, kind: "door", design: "panel", width: 800, height: 2050 },
  { id: "door-glazed", name: "Дверь со стеклом", desc: OPEN_DESC, kind: "door", design: "glazed", width: 800, height: 2050 },
  { id: "door-double", name: "Двустворчатая дверь", desc: OPEN_DESC, kind: "door", design: "double", width: 1200, height: 2050 },
  { id: "door-entry", name: "Входная дверь", desc: OPEN_DESC, kind: "door", design: "solid", width: 900, height: 2050 },
];

export const WALL_OPENING_CATALOG: OpeningKind[] = [
  { id: "hole", name: "Проём в стене", desc: "проём в размер двери", kind: "opening", design: "plain", width: 900, height: 2100 },
];

export function openingCatalog(kind: OpeningKindId): OpeningKind[] {
  return kind === "window" ? WINDOW_CATALOG : kind === "door" ? DOOR_CATALOG : WALL_OPENING_CATALOG;
}

// ---- unified wall segments: room-polygon edges first, then interior-wall
// segments. Openings/fittings store `wall` as an index into this list, so they
// can attach to a free-drawn wall exactly like a room wall. ----
export interface WallSeg {
  a: Pt;
  b: Pt;
}

export function wallSegments(roomPoints: Pt[], interiorWalls: Pt[][]): WallSeg[] {
  const segs: WallSeg[] = [];
  const n = roomPoints.length;
  for (let i = 0; i < n; i++) segs.push({ a: roomPoints[i], b: roomPoints[(i + 1) % n] });
  // interior segments keep their structural index (stable for stored references)
  for (const poly of interiorWalls) {
    for (let i = 0; i < poly.length - 1; i++) segs.push({ a: poly[i], b: poly[i + 1] });
  }
  return segs;
}

export function segAt(roomPoints: Pt[], interiorWalls: Pt[][], wall: number): WallSeg | null {
  const segs = wallSegments(roomPoints, interiorWalls);
  return segs[wall] ?? null;
}

/** Map a global wall-segment index (>= roomPoints.length) to its interior wall + local segment. */
export function interiorSegRef(roomPoints: Pt[], interiorWalls: Pt[][], globalSeg: number): { wall: number; seg: number } | null {
  let idx = globalSeg - roomPoints.length;
  if (idx < 0) return null;
  for (let w = 0; w < interiorWalls.length; w++) {
    const segCount = interiorWalls[w].length - 1;
    if (idx < segCount) return { wall: w, seg: idx };
    idx -= segCount;
  }
  return null;
}

/** Geometry of an opening along its wall: centre, unit direction, jamb points. */
export function openingSpan(a: Pt, b: Pt, t: number, width: number) {
  const wl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / wl;
  const uy = (b.y - a.y) / wl;
  const cx = a.x + (b.x - a.x) * t;
  const cy = a.y + (b.y - a.y) * t;
  const h = width / 2;
  return {
    cx,
    cy,
    ux,
    uy,
    wl,
    p1: { x: cx - ux * h, y: cy - uy * h },
    p2: { x: cx + ux * h, y: cy + uy * h },
  };
}

// ---- wall fittings (electrical / heating / ventilation) — items placed on a
// wall, dragged along / between walls just like an opening. Shared by 2D + 3D ----
/** `plumbing` is the one that CANNOT be avoided: a riser or a supply pipe running up the face of
 *  the wall. Unlike a radiator it does not stop you putting a cabinet there — the cabinet is cut to
 *  fit around it, which is exactly what a shop does and what this app could not express. */
/**
 * UNIQUE IDS FOR WALL ITEMS.
 *
 * A bare counter is not enough. It lives in a module, so it restarts at 0 on every page load —
 * while the project you just reopened still holds `f1`, `f2`, `f3`. The next item you add or
 * duplicate is handed `f1` again, and from then on two records answer to one id: every action maps
 * `e.id === id`, so dragging the socket drags the pipe with it. Cabinets hit this exact bug and
 * were fixed the same way (model/cabinet `uid` / `dedupeIds`); wall items never were.
 *
 * The tag is per SESSION, so an id minted now can never collide with one restored from disk.
 */
const _tag = Math.random().toString(36).slice(2, 6);
let _seq = 0;
export const wallItemId = (prefix: "f" | "o"): string => `${prefix}${++_seq}-${_tag}`;

/** Give every item a unique id, regenerating any missing or duplicated one. Repairs a project
 *  already saved with a collision — the reason a copied socket moved the pipe. */
export function dedupeWallItems<T extends { id: string }>(items: T[], prefix: "f" | "o"): T[] {
  const seen = new Set<string>();
  let changed = false;
  const out = items.map((it) => {
    if (it.id && !seen.has(it.id)) {
      seen.add(it.id);
      return it;
    }
    changed = true;
    const fresh = wallItemId(prefix);
    seen.add(fresh);
    return { ...it, id: fresh };
  });
  return changed ? out : items;
}

export type FittingCategory = "electric" | "heating" | "vent" | "plumbing";

export interface Fitting {
  id: string;
  category: FittingCategory;
  wall: number; // wall (edge) index it sits on
  t: number; // 0..1 position of its centre along the wall
  width: number; // mm
  height?: number; // mm (radiators / vents); undefined = category default
  kind: string; // catalog id within its category
  mountY?: number; // centre height (mm); undefined = category default
  /** THE PIPE'S PATH along its wall — the polyline it actually follows.
   *
   *  A pipe is rarely a single straight barrel: it comes up out of the floor, turns, and runs along
   *  under the counter. So a pipe is a PATH, and a plain riser is simply a two-point one. Points
   *  are in WALL space (`a` mm along the wall from its start corner, `y` mm above the floor), which
   *  is the frame the notch derivation, the elevation and the blocking all already measure in.
   *
   *  Absent → the pipe is the straight run its `t`/`width`/`height`/`orient` describe, so anything
   *  placed before paths existed still draws and still cuts. `pipePathOf` resolves the two. */
  path?: PipePoint[];
  /** WHICH WAY A PIPE RUNS. Plumbing only — everything else is a plate on the wall and has no run.
   *
   *  `width` and `height` keep their meaning whatever this says: width is the extent ALONG the
   *  wall, height the extent UP it. So a vertical riser is (diameter × length) and a horizontal
   *  run is (length × diameter) — the same two numbers, read the other way round. That is what
   *  lets the notch derivation, the elevation and the "+"-cell blocking stay untouched: they all
   *  measure a rectangle on the wall, and a pipe is one either way. Absent → vertical. */
  orient?: "v" | "h";
}

/** A point on a pipe's path, in WALL space. `a` = mm along the wall from its start corner,
 *  `y` = mm above the floor. */
export interface PipePoint {
  a: number;
  y: number;
}

/** One straight length of pipe between two bends. */
export interface PipeSegment {
  a0: number;
  y0: number;
  a1: number;
  y1: number;
}

/**
 * THE PATH A PIPE FOLLOWS, whether it was drawn or placed as a straight run.
 *
 * One resolver so nothing downstream has to care which it was: a legacy straight pipe becomes the
 * two-point path it always was, and everything — the 3D, the notches, the blocking — reads paths.
 */
export function pipePathOf(f: Fitting, wallLenMm: number): PipePoint[] {
  if (f.path && f.path.length >= 2) return f.path;
  const centre = f.t * wallLenMm;
  const len = pipeLength(f);
  const yc = fittingCentreY(f);
  return f.orient === "h"
    ? [{ a: centre - len / 2, y: yc }, { a: centre + len / 2, y: yc }]
    : [{ a: centre, y: yc - len / 2 }, { a: centre, y: yc + len / 2 }];
}

/** The path as segments — what clashes with a cabinet, one at a time. */
export function pipeSegments(f: Fitting, wallLenMm: number): PipeSegment[] {
  const pts = pipePathOf(f, wallLenMm);
  const out: PipeSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ a0: pts[i].a, y0: pts[i].y, a1: pts[i + 1].a, y1: pts[i + 1].y });
  }
  return out;
}

/** A pipe's DIAMETER (mm) — the number the carcass is notched around. */
export function pipeDiameter(f: Fitting): number {
  return f.orient === "h" ? f.height ?? defaultFittingHeight(f.category) : f.width;
}

/** How far a pipe RUNS (mm) — floor-to-ceiling for a riser, a metre or two for a branch. */
export function pipeLength(f: Fitting): number {
  return f.orient === "h" ? f.width : f.height ?? defaultFittingHeight(f.category);
}

/** Angle snap tolerance (radians) — how close a leg has to land before it is pulled onto plumb. */
export const PIPE_SNAP_RAD = (9 * Math.PI) / 180;

/**
 * PULL A DRAGGED PIPE POINT ONTO 90° / 45°.
 *
 * Pipes run plumb, level, or on a 45° elbow — those are the fittings that exist, so those are the
 * angles a drag should land on exactly rather than 89.6°. A leg within `PIPE_SNAP_RAD` of one is
 * pulled onto it; anything further away is left alone. A magnet, not a constraint: an odd angle is
 * still drawable, it just has to be meant.
 *
 * `anchors` are the neighbouring points — one for an end of the run, two for a bend. A bend snaps
 * to whichever leg it is closer to aligning, which is what makes squaring up an L one gesture
 * instead of two.
 *
 * The snapped point is placed by its OFFSET from the anchor, rounded to the 10mm grid. That keeps
 * a right angle exactly right whatever the anchor sits on (a zero offset stays zero), and keeps a
 * 45° exactly 45° — its two offsets are equal in magnitude, so they round together.
 */
export function snapPipePoint(
  anchors: PipePoint[],
  a: number,
  y: number,
): { a: number; y: number; snapped: boolean } {
  const STEP = Math.PI / 4;
  const grid = (v: number) => Math.round(v / 10) * 10;
  const hits: { a: number; y: number; err: number; an: PipePoint; to: number }[] = [];
  for (const an of anchors) {
    const len = Math.hypot(a - an.a, y - an.y);
    // too short to have a direction worth respecting — snapping here would fling the point
    if (len < 20) continue;
    const ang = Math.atan2(y - an.y, a - an.a);
    const to = Math.round(ang / STEP) * STEP;
    // shortest signed angle between where the leg is and where it would go
    if (Math.abs(Math.atan2(Math.sin(ang - to), Math.cos(ang - to))) > PIPE_SNAP_RAD) continue;
    const na = an.a + grid(Math.cos(to) * len);
    const ny = an.y + grid(Math.sin(to) * len);
    hits.push({ a: na, y: ny, err: Math.hypot(na - a, ny - y), an, to });
  }
  if (!hits.length) return { a, y, snapped: false };

  // BOTH legs land near an angle → put the corner where the two lines actually cross, so an L
  // comes out square in one gesture instead of needing the corner nudged once per leg. The two
  // directions are multiples of 45°, so distinct ones are at least that far apart and the crossing
  // is always close by; identical ones give no crossing and fall through to the single-leg case.
  if (hits.length > 1) {
    const [p, q] = hits;
    const x = lineIntersect(
      p.an.a, p.an.y, Math.cos(p.to), Math.sin(p.to),
      q.an.a, q.an.y, Math.cos(q.to), Math.sin(q.to),
    );
    if (x) return { a: grid(x.x), y: grid(x.y), snapped: true };
  }
  const best = hits.reduce((m, h) => (h.err < m.err ? h : m));
  return { a: best.a, y: best.y, snapped: true };
}

/** Default height (mm) for a fitting category. */
export function defaultFittingHeight(category: FittingCategory): number {
  // a riser runs the full height of the room — it is a column, not a fixture on the wall
  if (category === "plumbing") return 2500;
  return category === "heating" ? 500 : category === "vent" ? 250 : 120;
}

/**
 * HOW HIGH AN ITEM'S CENTRE SITS (mm above the floor).
 *
 * One definition, because three things now measure it: the wall features the layout blocks and
 * notches against, the 3D that draws the item, and the dimension chain that tells the fitter where
 * to put it. If they disagree, the number on screen is not the number in the wall.
 */
export function fittingCentreY(f: Fitting): number {
  if (f.mountY != null) return f.mountY;
  const h = f.category === "electric" ? 120 : f.height ?? defaultFittingHeight(f.category);
  if (f.category === "plumbing") return h / 2; // a riser stands on the floor
  if (f.category === "heating") return 400;
  if (f.category === "vent") return 2250;
  return f.kind.startsWith("switch") ? 1250 : 1050;
}

export interface FittingKind {
  id: string;
  name: string;
  desc: string;
  width: number; // mm
  symbol: string; // 2D glyph hint: socket(2) / switch(2) / radiator / vent(-fan)
}

const FIT_DESC = "элемент с изменяемым размером";

export const ELECTRIC_CATALOG: FittingKind[] = [
  { id: "socket", name: "Розетка", desc: FIT_DESC, width: 90, symbol: "socket" },
  { id: "socket2", name: "Двойная розетка", desc: FIT_DESC, width: 160, symbol: "socket2" },
  { id: "switch", name: "Выключатель света", desc: FIT_DESC, width: 90, symbol: "switch" },
  { id: "switch2", name: "Двойной выключатель света", desc: FIT_DESC, width: 160, symbol: "switch2" },
  { id: "socketG", name: "Розетка с заземлением", desc: FIT_DESC, width: 90, symbol: "socket" },
  { id: "usb", name: "USB-розетка", desc: FIT_DESC, width: 90, symbol: "socket2" },
  // BLOCKS. Above a worktop nobody fits single sockets in a row — they fit one block, on one
  // backing box, and the фартук is cut once for it. Widths are the real thing: a gang is ~71mm of
  // frame plus the surround, so 3 ≈ 230 and 4 ≈ 300.
  { id: "socket3", name: "Блок из 3 розеток", desc: FIT_DESC, width: 230, symbol: "socket3" },
  { id: "socket4", name: "Блок из 4 розеток", desc: FIT_DESC, width: 300, symbol: "socket4" },
  { id: "socketSw", name: "Блок: розетки + выключатель", desc: FIT_DESC, width: 230, symbol: "socketSw" },
];

export const HEATING_CATALOG: FittingKind[] = [
  { id: "rad-panel", name: "Панельный радиатор", desc: FIT_DESC, width: 600, symbol: "radiator" },
  { id: "rad-bimetal", name: "Биметаллический радиатор", desc: FIT_DESC, width: 800, symbol: "radiator" },
  { id: "convector", name: "Конвектор", desc: FIT_DESC, width: 700, symbol: "radiator" },
  { id: "towel", name: "Полотенцесушитель", desc: FIT_DESC, width: 500, symbol: "radiator" },
];

/** PIPES AND RISERS. `width` is the OUTSIDE diameter of the pipe (or the width of a boxed pair) —
 *  what the carcass has to be cut around, so it is the number the notch is derived from. */
export const PLUMBING_CATALOG: FittingKind[] = [
  { id: "pipe-water", name: "Водопроводная труба", desc: "Ø32 · по стене", width: 32, symbol: "pipe" },
  { id: "pipe-heat", name: "Труба отопления", desc: "Ø50 · по стене", width: 50, symbol: "pipe" },
  { id: "riser-sewer", name: "Канализационный стояк", desc: "Ø110 · от пола до потолка", width: 110, symbol: "pipe" },
  { id: "riser-pair", name: "Стояк: подача + обратка", desc: "две трубы в коробе", width: 180, symbol: "pipe" },
  { id: "pipe-gas", name: "Газовая труба", desc: "Ø25 · по стене", width: 25, symbol: "pipe" },
];

export const VENT_CATALOG: FittingKind[] = [
  { id: "grille", name: "Вытяжная решётка", desc: FIT_DESC, width: 200, symbol: "vent" },
  { id: "valve", name: "Приточный клапан", desc: FIT_DESC, width: 150, symbol: "vent" },
  { id: "fan", name: "Канальный вентилятор", desc: FIT_DESC, width: 180, symbol: "vent-fan" },
  { id: "diffuser", name: "Диффузор", desc: FIT_DESC, width: 200, symbol: "vent-fan" },
];

export function fittingCatalog(cat: FittingCategory): FittingKind[] {
  if (cat === "plumbing") return PLUMBING_CATALOG;
  return cat === "heating" ? HEATING_CATALOG : cat === "vent" ? VENT_CATALOG : ELECTRIC_CATALOG;
}

export function fittingKind(cat: FittingCategory, id: string): FittingKind | undefined {
  return fittingCatalog(cat).find((k) => k.id === id);
}

export function centroidOf(pts: Pt[]): Pt {
  const n = pts.length;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

function lineIntersect(
  ax: number, ay: number, adx: number, ady: number,
  bx: number, by: number, bdx: number, bdy: number,
): Pt | null {
  const denom = adx * bdy - ady * bdx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((bx - ax) * bdy - (by - ay) * bdx) / denom;
  return { x: ax + t * adx, y: ay + t * ady };
}

/**
 * Inset the polygon inward by `dist` (mm) with mitred corners — used for the wall
 * inner face (3D + inside dimensions). Robust for convex and concave (L) shapes.
 */
export function offsetPolygon(pts: Pt[], dist: number): Pt[] {
  const n = pts.length;
  const c = centroidOf(pts);
  // each inset edge: a point on it + its direction
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    let nx = -dy;
    let ny = dx; // a normal
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if ((c.x - mx) * nx + (c.y - my) * ny < 0) {
      nx = -nx;
      ny = -ny;
    } // point inward (toward centroid)
    return { px: a.x + nx * dist, py: a.y + ny * dist, dx, dy };
  });
  return pts.map((_, i) => {
    const e1 = edges[(i - 1 + n) % n];
    const e2 = edges[i];
    const p = lineIntersect(e1.px, e1.py, e1.dx, e1.dy, e2.px, e2.py, e2.dx, e2.dy);
    return p ?? pts[i];
  });
}
