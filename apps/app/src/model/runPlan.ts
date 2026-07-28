// Run planning — picks which wall(s)/runs the kitchen sits on for each layout and
// turns them into metre-space placements for the 3D builder. Single source of
// truth (`planRuns`) so the solver (run lengths) and the renderer (placements)
// always agree. Pure: geometry only.
//
// Layouts (kitchen-design guides):
//   i          one wall (water/longest, door-avoiding)
//   galley     two parallel walls (work wall + opposite), aisle between
//   l          two adjacent walls incl. the water wall, blind corner
//   u          three connected walls; sink/hob/fridge spread across the legs
//   peninsula  one wall + a free-standing leg jutting into the room
// Plus an optional ISLAND run for large rooms (filled by some variants).

import { polygonBoundsMm, offsetPolygon, type Pt, type Opening } from "./room";

// "all" is a CONSTRUCTOR-ONLY shape: every wall of the room is its own run, so you can build on any
// of them (an L-shaped room gives all six). The variant SOLVER never proposes it — it only ever
// emits i/galley/l/u/peninsula — but once you enter the constructor the shape is switched to "all"
// so the grid follows the whole room.
export type KitchenLayout = "i" | "galley" | "l" | "u" | "peninsula" | "all";

export interface Placement {
  ax: number;
  az: number;
  ux: number;
  uz: number; // unit direction A→B
  ix: number;
  iz: number; // inward normal (room side / facing direction)
  startS: number; // metres along the run where modules begin
  lenM: number;
}

export interface RunOpening {
  a: number;
  b: number;
  kind: "door" | "window";
}

export interface PlannedRun {
  kind: "wall" | "peninsula" | "island";
  wall: number; // -1 for synthetic runs
  len: number; // usable length (mm)
  cornerStart: boolean;
  cornerEnd: boolean;
  /** FILLER RESERVE (mm) at each end of a wall run where it butts a perpendicular wall — a scribe
   *  gap that keeps a door off the wall and absorbs an out-of-true wall. Reserved as a dead zone (the
   *  same mechanism as the corner zone, and mutually exclusive with it: a corner end takes 0). Absent
   *  / 0 on peninsula & island runs and on exposed (reflex) ends. See DEFAULT_REVEAL, reflexVertices. */
  revealStart?: number;
  revealEnd?: number;
  openings: RunOpening[];
  placement: Placement;
}

// Corner units. A corner body is a square filling the inside corner with its room-facing corner
// removed; the runs on both walls butt into it. Each wall run clears CORNER_MM so the regular
// cabinets meet it flush, and a shallower module reaches back into the leftover (see runReach).
const UPPER_DEPTH_MM = 350;
const BASE_DEPTH_MM = 560;

/** The flat door face a corner body presents to the room (mm) — as wide as it can usefully be. */
const CORNER_FACE = 280;

/**
 * THE corner square for a run of this depth (mm).
 *
 * `side = armDepth + face`. The face is capped two ways: at CORNER_FACE (a wider door than that is
 * just a bigger hole), and at ¾ of the arm depth — because the body's geometry is
 * `cut = armDepth − side/2`, which goes NEGATIVE once `side ≥ 2 × armDepth` and turns the footprint
 * polygon inside out.
 *
 * The two sizes the app has always used fall straight out of this, exactly:
 *   560 (base)  → face 280        → 840   (the old "1.5 × depth")
 *   350 (upper) → face 263 (¾)    → 613   (the old "1.75 × depth")
 * …and now every depth in between and beyond works too, which is what lets a corner unit be
 * resized at all.
 */
export function cornerSideFor(armDepthMm: number): number {
  const arm = Math.round(armDepthMm);
  return arm + Math.min(CORNER_FACE, Math.round(arm * 0.75));
}

export const CORNER_MM = cornerSideFor(BASE_DEPTH_MM); // 840
export const CORNER_UPPER_MM = cornerSideFor(UPPER_DEPTH_MM); // 613

/** THE FILLER GAP (mm) reserved at a run end that butts a perpendicular wall. Real kitchens leave
 *  this so a door next to the wall opens past 90° without tapping it and an out-of-true wall can be
 *  scribed. The seller can override it (0 = none); this is the default when none is given. */
export const DEFAULT_REVEAL = 50;

/** How far a module of THIS DEPTH may reach into a cleared corner zone (mm).
 *
 *  The run always clears CORNER_MM (840). A module only needs `cornerSideFor(depth)` of that; the
 *  difference is slack it can reach into. A 560-deep base needs the whole 840 → 0 slack. A 350-deep
 *  wall unit needs only 613 → it reaches the last 227mm in, to meet the shallower corner unit.
 *
 *  This used to be a boolean ("is it a wall unit?"), which is wrong the moment a wall row is
 *  BASE-DEPTH: it's a wall unit, but it needs the big square and so has no slack at all. Lives here
 *  rather than in resolve.ts because the variant generator needs it too, and layout.ts cannot import
 *  resolve (bands → layout is already an edge). */
export function runReach(depthMm: number): number {
  return CORNER_MM - cornerSideFor(depthMm);
}

const AISLE_MM = 1100;
const ISLAND_DEPTH_MM = 600;
const FAR_CLEAR_MM = 450;
const DOOR_PEN = 1e7;

/** WALL THICKNESS (mm). `roomPoints` is the wall boundary; furniture stands against the INNER FACES,
 *  which is this much inside it — so every run placement is built from `offsetPolygon(points, WALL_T)`
 *  and anything that seats a module has to measure from the same polygon. Reading a seat off the raw
 *  points instead buries the module 100mm into the wall on both axes. */
export const WALL_T = 100;

function vlen(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function innerLen(inner: Pt[], w: number): number {
  return vlen(inner[w], inner[(w + 1) % inner.length]);
}
function doorCount(openings: Opening[], w: number): number {
  return openings.filter((o) => o.wall === w && o.kind !== "window").length;
}

interface Geo {
  innerM: { x: number; z: number }[];
  ctr: { x: number; z: number };
}
function geo(points: Pt[]): Geo {
  const b = polygonBoundsMm(points);
  const toM = (p: Pt) => ({ x: (p.x - b.cx) / 1000, z: (p.y - b.cy) / 1000 });
  const innerM = offsetPolygon(points, WALL_T).map(toM);
  const ctr = { x: innerM.reduce((s, p) => s + p.x, 0) / innerM.length, z: innerM.reduce((s, p) => s + p.z, 0) / innerM.length };
  return { innerM, ctr };
}

/** is this point inside the room polygon? (ray cast; metres) */
function inRoom(poly: { x: number; z: number }[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** A wall run's placement (metres), with `startS` clearing the reserved zone at A (corner + filler
 *  reveal), in mm. */
function wallPlacement(g: Geo, w: number, startOffMm: number): Placement {
  const n = g.innerM.length;
  const A = g.innerM[w];
  const B = g.innerM[(w + 1) % n];
  let ux = B.x - A.x;
  let uz = B.z - A.z;
  const lenM = Math.hypot(ux, uz) || 1;
  ux /= lenM;
  uz /= lenM;
  let ix = -uz;
  let iz = ux;
  const mx = (A.x + B.x) / 2;
  const mz = (A.z + B.z) / 2;
  // WHICH WAY DOES THIS WALL FACE? Step a millimetre off its midpoint along the candidate normal and
  // ask the ROOM. This used to compare against `g.ctr`, the average of the polygon's vertices — and in
  // an L-shaped room that average lands INSIDE THE NOTCH, i.e. outside the room. Every wall bounding
  // the notch was then flipped to face the cut-out: cabinets tiled on it were built on the far side of
  // the wall, and anything projecting onto it (the front elevation, the sheet's "+" cells) rejected
  // modules that were standing right against it as "turned away from this wall".
  const EPS = 0.001;
  const front = inRoom(g.innerM, mx + ix * EPS, mz + iz * EPS);
  const back = inRoom(g.innerM, mx - ix * EPS, mz - iz * EPS);
  const flip = front === back
    ? (g.ctr.x - mx) * ix + (g.ctr.z - mz) * iz < 0 // inconclusive (degenerate wall) → the old test
    : back; // the room is on the other side
  if (flip) {
    ix = -ix;
    iz = -iz;
  }
  return { ax: A.x, az: A.z, ux, uz, ix, iz, startS: startOffMm / 1000, lenM };
}

/** Openings on wall `w`, projected into the run's local coords (mm). */
function projectOpenings(inner: Pt[], w: number, startOff: number, usable: number, openings: Opening[]): RunOpening[] {
  const wallLen = innerLen(inner, w);
  const out: RunOpening[] = [];
  for (const o of openings) {
    if (o.wall !== w) continue;
    const center = o.t * wallLen;
    const half = o.width / 2;
    const a = Math.max(0, center - half - startOff);
    const b = Math.min(usable, center + half - startOff);
    if (b - a > 1) out.push({ a, b, kind: o.kind === "window" ? "window" : "door" });
  }
  return out;
}

interface WallRun {
  wall: number;
  cornerStart: boolean;
  cornerEnd: boolean;
}

/** Pick the wall runs for a layout + which run holds the sink (water). */
function pickWalls(points: Pt[], waterWall: number | null, layout: KitchenLayout, openings: Opening[], corners?: CornerFlags): { walls: WallRun[]; waterRun: number } {
  const n = points.length;
  const inner = offsetPolygon(points, WALL_T);
  const len = (w: number) => innerLen(inner, w);
  const score = (w: number) => len(w) - DOOR_PEN * doorCount(openings, w);
  const valid = waterWall != null && waterWall >= 0 && waterWall < n;
  const bestWall = () => {
    let best = 0;
    let bs = -Infinity;
    for (let w = 0; w < n; w++) if (score(w) > bs) (bs = score(w)), (best = w);
    return best;
  };

  if (layout === "all") {
    // EVERY wall becomes its own run, in polygon order. A corner square is reserved at a vertex ONLY
    // when a corner cabinet actually turns it (`corners`, derived from the placed cabs by
    // `activeCorners`) — so a bare wall is fully fillable and the zone appears the moment you drop a
    // corner. With `corners` omitted every end is reserved (the old static behaviour), which is the
    // safe default for any consumer that doesn't know the cabs. Skip a wall too short to stand
    // anything (< 0.6 m). If somehow nothing qualifies, fall back to the single best wall.
    const walls: WallRun[] = [];
    for (let w = 0; w < n; w++) {
      if (len(w) < 600) continue;
      walls.push({
        wall: w,
        cornerStart: corners ? corners.start.has(w) : true,
        cornerEnd: corners ? corners.end.has(w) : true,
      });
    }
    if (!walls.length) walls.push({ wall: bestWall(), cornerStart: false, cornerEnd: false });
    const wr = valid ? walls.findIndex((r) => r.wall === waterWall) : 0;
    return { walls, waterRun: wr >= 0 ? wr : 0 };
  }

  if (layout === "l" && n >= 4) {
    const pairScore = (a: number, b: number) => score(a) + score(b);
    let best: { walls: WallRun[]; waterRun: number } | null = null;
    let bestScore = -Infinity;
    const consider = (a: number, b: number, waterRun: number) => {
      const sc = pairScore(a, b);
      if (sc > bestScore) {
        bestScore = sc;
        best = { walls: [{ wall: a, cornerStart: false, cornerEnd: true }, { wall: b, cornerStart: true, cornerEnd: false }], waterRun };
      }
    };
    if (valid) {
      consider(waterWall!, (waterWall! + 1) % n, 0);
      consider((waterWall! - 1 + n) % n, waterWall!, 1);
    } else for (let w = 0; w < n; w++) consider(w, (w + 1) % n, 0);
    return best!;
  }

  if (layout === "galley" && n === 4) {
    const primary = valid ? waterWall! : bestWall();
    const opposite = (primary + 2) % 4;
    return { walls: [{ wall: primary, cornerStart: false, cornerEnd: false }, { wall: opposite, cornerStart: false, cornerEnd: false }], waterRun: 0 };
  }

  if (layout === "u" && n === 4) {
    // open the U toward the door (exclude the door wall), else the shortest wall
    let excluded = -1;
    let md = 0;
    for (let w = 0; w < 4; w++) {
      const d = doorCount(openings, w);
      if (d > md) (md = d), (excluded = w);
    }
    if (excluded < 0) {
      let sl = Infinity;
      for (let w = 0; w < 4; w++) if (len(w) < sl) (sl = len(w)), (excluded = w);
    }
    const a = (excluded + 1) % 4;
    const m = (excluded + 2) % 4;
    const b = (excluded + 3) % 4;
    const walls: WallRun[] = [
      { wall: a, cornerStart: false, cornerEnd: true }, // left arm, corner where it meets the middle
      { wall: m, cornerStart: true, cornerEnd: true }, // middle clears BOTH corners → a diagonal unit in each
      { wall: b, cornerStart: true, cornerEnd: false }, // right arm, corner where it meets the middle
    ];
    const waterRun = valid ? walls.findIndex((r) => r.wall === waterWall) : 1;
    return { walls, waterRun: waterRun >= 0 ? waterRun : 1 };
  }

  // i + peninsula: a single wall run
  const primary = valid ? waterWall! : bestWall();
  return { walls: [{ wall: primary, cornerStart: false, cornerEnd: false }], waterRun: 0 };
}

/** Max room depth perpendicular to a placement's wall (metres). */
function depthFrom(g: Geo, p: Placement): number {
  let d = 0;
  for (const q of g.innerM) {
    const dd = (q.x - p.ax) * p.ix + (q.z - p.az) * p.iz;
    if (dd > d) d = dd;
  }
  return d;
}

function islandPlacement(g: Geo, p0: Placement): { fits: boolean; lenM: number; placement: Placement } {
  const need = (BASE_DEPTH_MM + AISLE_MM + ISLAND_DEPTH_MM + FAR_CLEAR_MM) / 1000;
  const lenM = Math.min(p0.lenM * 0.6, 2.4);
  if (depthFrom(g, p0) < need || lenM < 1.2) return { fits: false, lenM: 0, placement: p0 };
  const off = (BASE_DEPTH_MM + AISLE_MM) / 1000; // island BACK line (modules extend inward)
  const cx = p0.ax + p0.ux * (p0.lenM / 2) + p0.ix * off;
  const cz = p0.az + p0.uz * (p0.lenM / 2) + p0.iz * off;
  return { fits: true, lenM, placement: { ax: cx - p0.ux * (lenM / 2), az: cz - p0.uz * (lenM / 2), ux: p0.ux, uz: p0.uz, ix: p0.ix, iz: p0.iz, startS: 0, lenM } };
}

/** Peninsula leg: perpendicular to the wall, attached at the wall run's far (B) end. */
function peninsulaPlacement(g: Geo, p0: Placement): { fits: boolean; lenM: number; placement: Placement } {
  const depth = depthFrom(g, p0);
  // leg starts at the base-run FRONT, so subtract base depth too
  const lenM = Math.min(depth - (BASE_DEPTH_MM + FAR_CLEAR_MM) / 1000, 2.4);
  if (lenM < 1.2) return { fits: false, lenM: 0, placement: p0 };
  // start at the far end of the wall run, at the front face of the base run
  const ex = p0.ax + p0.ux * p0.lenM + p0.ix * (BASE_DEPTH_MM / 1000);
  const ez = p0.az + p0.uz * p0.lenM + p0.iz * (BASE_DEPTH_MM / 1000);
  // run direction = inward; facing = back along the wall (so it reads as a leg)
  return { fits: true, lenM, placement: { ax: ex - p0.ux * BASE_DEPTH_MM / 1000, az: ez - p0.uz * BASE_DEPTH_MM / 1000, ux: p0.ix, uz: p0.iz, ix: -p0.ux, iz: -p0.uz, startS: 0, lenM } };
}

/** Indices of the room's REFLEX vertices (interior angle > 180°) on the inner-face polygon — the
 *  exposed elbows that jut into the room, where a run END has no perpendicular wall to butt (that is
 *  where an outer end-cap unit goes, not a filler). Every OTHER (convex) vertex is a real corner
 *  where the run meets a wall. Shared by `outerEndSeats` and the filler-reveal rule so both read one
 *  definition of "exposed end". */
export function reflexVertices(points: Pt[]): Set<number> {
  const pts = offsetPolygon(points, WALL_T);
  const n = pts.length;
  const out = new Set<number>();
  if (n < 4) return out;
  let area2 = 0; // shoelace → winding
  for (let i = 0; i < n; i++) { const p = pts[i]; const q = pts[(i + 1) % n]; area2 += p.x * q.y - q.x * p.y; }
  const ccw = area2 > 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], V = pts[i], next = pts[(i + 1) % n];
    const ax = V.x - prev.x, ay = V.y - prev.y; // incoming edge
    const bx = next.x - V.x, by = next.y - V.y; // outgoing edge
    const reflex = ccw ? ax * by - ay * bx < 0 : ax * by - ay * bx > 0;
    if (reflex) out.add(i);
  }
  return out;
}

/** The full run plan for a layout: wall runs + an optional island/peninsula run.
 *
 *  `reveal` (mm) is the filler gap reserved at each wall-run end that butts a perpendicular wall (see
 *  DEFAULT_REVEAL); pass 0 to place cabinets wall-to-wall. */
export function planRuns(points: Pt[], waterWall: number | null, layout: KitchenLayout, openings: Opening[] = [], cabs?: CornerCab[], reveal: number = DEFAULT_REVEAL): { runs: PlannedRun[]; waterRun: number } {
  const g = geo(points);
  const inner = offsetPolygon(points, WALL_T);
  // In the constructor's "all" shape, corner squares are DYNAMIC: a wall clears an end only when a
  // corner cabinet actually turns that vertex. Passing the current cabs lets every consumer derive
  // the same flags, so the grid, the 3D and pricing can't disagree about where a zone is. Non-"all"
  // layouts ignore `cabs` entirely — their corners are structural (see pickWalls).
  const corners = layout === "all" && cabs ? activeCorners(cabs, points, waterWall, openings) : undefined;
  const { walls, waterRun } = pickWalls(points, waterWall, layout, openings, corners);

  // A run end gets a filler reveal only where it butts a perpendicular wall (a convex vertex) and no
  // corner zone already clears it — the two are mutually exclusive, so a reveal is never stacked onto
  // the 840 corner square. Exposed (reflex) ends take an outer end-cap, not a filler.
  const n = points.length;
  const reflex = reveal > 0 ? reflexVertices(points) : null;

  const runs: PlannedRun[] = walls.map((wr) => {
    const wallLen = innerLen(inner, wr.wall);
    const revealStart = !wr.cornerStart && reflex && !reflex.has(wr.wall) ? reveal : 0;
    const revealEnd = !wr.cornerEnd && reflex && !reflex.has((wr.wall + 1) % n) ? reveal : 0;
    const startOff = (wr.cornerStart ? CORNER_MM : 0) + revealStart;
    const endOff = (wr.cornerEnd ? CORNER_MM : 0) + revealEnd;
    const len = Math.max(300, wallLen - startOff - endOff);
    return {
      kind: "wall" as const,
      wall: wr.wall,
      len,
      cornerStart: wr.cornerStart,
      cornerEnd: wr.cornerEnd,
      revealStart,
      revealEnd,
      openings: projectOpenings(inner, wr.wall, startOff, len, openings),
      placement: wallPlacement(g, wr.wall, startOff),
    };
  });

  if (layout === "peninsula") {
    const pen = peninsulaPlacement(g, runs[0].placement);
    if (pen.fits) runs.push({ kind: "peninsula", wall: -1, len: Math.round(pen.lenM * 1000), cornerStart: false, cornerEnd: false, openings: [], placement: pen.placement });
  } else if (layout === "i" || layout === "l") {
    // an island only suits open layouts; galley/U already face an opposite run
    const isl = islandPlacement(g, runs[0].placement);
    if (isl.fits) runs.push({ kind: "island", wall: -1, len: Math.round(isl.lenM * 1000), cornerStart: false, cornerEnd: false, openings: [], placement: isl.placement });
  }

  return { runs, waterRun };
}

/** how many WALL runs each shape needs to mean anything */
const WALLS_NEEDED: Record<KitchenLayout, number> = { i: 1, galley: 2, l: 2, u: 3, peninsula: 1, all: 1 };
/** a kitchen needs at least this much usable wall to be worth proposing (mm) */
const MIN_KITCHEN_RUN = 1500;

/**
 * WHICH SHAPES ACTUALLY FIT THIS ROOM.
 *
 * The onboarding used to ask the user to pick a layout BEFORE they had drawn a single wall, and
 * then defaulted to a bare "i" when they didn't. But the room decides most of this: you cannot put a
 * U in a corridor. So run the planner for each shape and keep the ones that come back with the runs
 * that shape actually needs, at a workable length.
 *
 * Ordered longest-total-run first, so the caller can take the top few and get the roomiest kitchens.
 * Never empty — "i" always works against something.
 */
export function candidateLayouts(points: Pt[], waterWall: number | null, openings: Opening[] = []): KitchenLayout[] {
  const ALL: KitchenLayout[] = ["i", "galley", "l", "u", "peninsula"];
  const scored: { lay: KitchenLayout; total: number }[] = [];

  for (const lay of ALL) {
    const { runs } = planRuns(points, waterWall, lay, openings);
    const walls = runs.filter((r) => r.kind === "wall" && r.len >= MIN_KITCHEN_RUN);
    if (walls.length < WALLS_NEEDED[lay]) continue;
    // a peninsula/island only counts if the planner found room for it
    if (lay === "peninsula" && !runs.some((r) => r.kind === "peninsula")) continue;
    scored.push({ lay, total: walls.reduce((a, r) => a + r.len, 0) });
  }

  scored.sort((a, b) => b.total - a.total);
  return scored.length ? scored.map((s) => s.lay) : ["i"];
}

/** Just the placements (for the renderer) — same selection as `planRuns`. */
export function computePlacements(points: Pt[], waterWall: number | null, layout: KitchenLayout, openings: Opening[] = []): Placement[] {
  return planRuns(points, waterWall, layout, openings).runs.map((r) => r.placement);
}

// ---- cabinets backed against a user-drawn interior wall ----
const IW_MIN_SEG = 700; // ignore segments too short to hold a cabinet (mm)
const IW_HALF_THICK = 50; // half the drawn-wall thickness (3D IWT = 100mm)
const IW_LADDER = [600, 500, 450, 400];

function packLadder(total: number, ladder: number[]): number[] {
  const out: number[] = [];
  let rem = Math.round(total);
  const min = ladder[ladder.length - 1];
  while (rem >= min) {
    const w = ladder.find((x) => x <= rem) ?? min;
    out.push(w);
    rem -= w;
  }
  return out;
}

/** A base + upper module spec for each drawn-wall segment, placed FREE (px/pz absolute
 *  room mm, rot degrees so the facade faces the room). These render through the existing
 *  free-placement path (3D / plan / footprint / pricing) — no run-planning changes — so a
 *  wall the user draws inside the room gets a real cabinet row backed against it. */
export interface WallCab {
  px: number;
  pz: number;
  rot: number;
  w: number;
  kind: "base" | "upper";
  depth: number;
}
export function interiorWallCabs(points: Pt[], interiorWalls: Pt[][]): WallCab[] {
  const b = polygonBoundsMm(points);
  const out: WallCab[] = [];
  for (const poly of interiorWalls) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const A = poly[i];
      const B = poly[i + 1];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const L = Math.hypot(dx, dy);
      if (L < IW_MIN_SEG) continue;
      const ux = dx / L;
      const uy = dy / L;
      // inward normal: perpendicular to the wall, pointing toward the room centroid (the
      // open side the cabinets face)
      let nx = -uy;
      let ny = ux;
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      if ((b.cx - mx) * nx + (b.cy - my) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const rot = Math.round((Math.atan2(-nx, ny) * 180) / Math.PI * 10) / 10; // facade faces the room
      let s = 0;
      for (const w of packLadder(L, IW_LADDER)) {
        const sc = s + w / 2;
        const fx = A.x + ux * sc;
        const fy = A.y + uy * sc;
        for (const [kind, depth] of [["base", 560], ["upper", 350]] as const) {
          const off = IW_HALF_THICK + depth / 2; // centre = wall face + half the module depth
          out.push({ px: Math.round(fx + nx * off), pz: Math.round(fy + ny * off), rot, w, kind, depth });
        }
        s += w;
      }
    }
  }
  return out;
}

/** Diagonal corner unit(s) — a free transform (px/pz absolute mm, rot deg) + footprint
 *  w×depth, sitting in a cleared corner with its diagonal door facing the room. One per
 *  inside corner: L has 1, U has 2 (each arm meets the middle run). */
export interface CornerSpec {
  px: number;
  pz: number;
  rot: number;
  w: number;
  depth: number;
}
/** Which wall ENDS carry a corner. Indices are polygon-wall indices, as `pickWalls("all")` keys on. */
export interface CornerFlags {
  start: Set<number>; // walls whose START vertex (A) has a corner cabinet
  end: Set<number>; // walls whose END vertex (B) has a corner cabinet
}
/** The minimum a corner cabinet must expose for `activeCorners` to place it — a free unit at px/pz.
 *  `cornerShape` lets the planner tell an INNER corner (reserves a zone) from an OUTER end cap
 *  (`"outer"`, reserves nothing). */
export interface CornerCab {
  corner?: boolean;
  px?: number;
  pz?: number;
  cornerShape?: "diagonal" | "l" | "outer";
}

interface CornerSeat extends CornerSpec {
  endWall: number; // the wall this seat sits at the END of
  startWall: number; // the wall this seat sits at the START of
}

/** Every GEOMETRIC inside corner of the layout, each tagged with the two walls it turns. Enumerated
 *  from the reference run plan (no cabs → all ends cleared), so it lists every corner that COULD hold
 *  a unit — `seatCorner` picks the nearest, `activeCorners` matches placed units against it. */
function cornerSeats(points: Pt[], waterWall: number | null, layout: KitchenLayout, openings: Opening[] = [], sideMm = CORNER_MM): CornerSeat[] {
  if (layout !== "l" && layout !== "u" && layout !== "all") return [];
  const n = points.length;
  const { runs } = planRuns(points, waterWall, layout, openings);
  const wallRuns = runs.filter((r) => r.kind === "wall");
  const b = polygonBoundsMm(points);
  const off = (sideMm / 1000) / Math.SQRT2; // centre of the corner square, from the vertex along the diagonal
  // each adjacent pair of wall runs that both clear their shared end forms an inside corner
  const pairs: [PlannedRun, PlannedRun][] = [];
  for (let i = 0; i + 1 < wallRuns.length; i++) pairs.push([wallRuns[i], wallRuns[i + 1]]);
  // a room is a closed loop: for "all", the last wall also meets the first when they are consecutive
  // polygon edges (a full perimeter), so include that wrap-around vertex. l/u are open arms — no wrap.
  if (layout === "all" && wallRuns.length > 2) {
    const last = wallRuns[wallRuns.length - 1];
    const first = wallRuns[0];
    if ((last.wall + 1) % n === first.wall) pairs.push([last, first]);
  }
  const out: CornerSeat[] = [];
  for (const [r1, r2] of pairs) {
    if (!r1.cornerEnd || !r2.cornerStart) continue;
    const V = { x: r2.placement.ax, z: r2.placement.az }; // shared corner vertex (metres)
    let dx = r1.placement.ix + r2.placement.ix; // room-facing diagonal = bisector of inward normals
    let dz = r1.placement.iz + r2.placement.iz;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    // rot aligns the footprint square with the walls (not the diagonal) so it sits exactly
    // in the corner square; the 3D builds the diagonal door from the room-centre direction.
    const rot = (Math.atan2(r1.placement.uz, r1.placement.ux) * 180) / Math.PI;
    out.push({
      px: Math.round((V.x + dx * off) * 1000 + b.cx),
      pz: Math.round((V.z + dz * off) * 1000 + b.cy),
      rot: Math.round(rot * 10) / 10,
      w: sideMm, // wall-aligned corner square (base 1.5× = 840 / upper 1.75× = 613)
      depth: sideMm,
      endWall: r1.wall,
      startWall: r2.wall,
    });
  }
  return out;
}

export function cornerUnits(points: Pt[], waterWall: number | null, layout: KitchenLayout, openings: Opening[] = [], sideMm = CORNER_MM): CornerSpec[] {
  return cornerSeats(points, waterWall, layout, openings, sideMm).map(({ endWall: _e, startWall: _s, ...spec }) => spec);
}

/** WHICH SEAT a drag should drop into — the one the user is aiming at, which is not simply the
 *  nearest centre.
 *
 *  Two things the plain nearest-centre rule got wrong at a room's elbow, where an end unit has TWO
 *  seats (both walls end there):
 *    • the user aims at the CORNER, not at a seat centre half a module away from it, so the reach is
 *      measured to whichever of the two is closer;
 *    • the nearer centre is often the seat on the OTHER wall — so dragging along one wall span the
 *      module 90° onto the perpendicular one. A seat already aligned with how the module is turned
 *      wins over one that isn't, however close.
 *  Returns null when nothing is within `radius`. */
export function pickSeat<T extends { px: number; pz: number; rot: number; vertex?: Pt }>(
  seats: T[],
  px: number,
  pz: number,
  rotDeg: number,
  radius: number,
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const s of seats) {
    const d = Math.hypot(px - s.px, pz - s.pz);
    // REACH is measured to the corner as well: the user aims at the elbow, not at a seat centre half
    // a module away from it. CHOICE is by the true seat distance — every seat at one elbow shares that
    // vertex, so scoring by it would flatten them into a tie.
    const reach = Math.min(d, s.vertex ? Math.hypot(px - s.vertex.x, pz - s.vertex.y) : Infinity);
    if (reach >= radius) continue;
    const turn = Math.abs(((((s.rot - rotDeg) % 360) + 540) % 360) - 180); // 0° = same way round
    // A HANDICAP, NOT A VETO. Staying on the wall the module already lies along wins a close call —
    // but it must not be absolute, or the elbow's OTHER seat becomes unreachable: the aligned one
    // always wins, so no drag can ever move the unit to the other wall (which is exactly what turning
    // it 90° is for).
    const score = d + (turn < 45 ? 0 : ALIGN_HANDICAP_MM);
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}
/** how much closer the OTHER wall's seat must be to win a drag away from the aligned one (mm) */
const ALIGN_HANDICAP_MM = 300;

/** An OUTER (angled end unit) seat — the EXPOSED END of a wall run. `face` is the world point its cut
 *  corner looks toward, stored on the cabinet so both the 2D plan and the 3D cut the same corner.
 *  Run depth, run-aligned (not the big inner corner square). `wall` is the polygon wall it caps and
 *  `atStart` says which end of that wall the unit occupies. */
export interface OuterSeat {
  px: number;
  pz: number;
  rot: number;
  w: number;
  depth: number;
  face: Pt;
  wall: number;
  atStart: boolean;
  /** the room corner this seat caps — what the user is actually aiming at when they drag */
  vertex: Pt;
}

/** WHERE AN ANGLED END UNIT GOES: the EXPOSED END of a wall run.
 *
 *  A run's end is exposed where the room turns a CONVEX (reflex) corner — the inner elbow of an
 *  L/T/U-shaped room, interior angle > 180°. Two walls meet at such a vertex and BOTH of them end
 *  there with nothing to butt into, so each reflex vertex offers TWO seats: the last slot of the wall
 *  arriving at it, and the first slot of the wall leaving it. The unit is the run's own depth, sits
 *  back against its wall like every other module in that run, and fills the last `w` millimetres up
 *  to the vertex — so it lands flush with the module beside it.
 *
 *  This used to seat ONE unit centred on the vertex itself, as a single L-shaped body wrapping the
 *  wall corner. Real kitchens don't do that (see model/outerCorner.ts): the corner is two ordinary
 *  runs, and only the exposed END is a special module.
 *
 *  `face` is a point out in the room past the exposed end — it tells both renderers which front
 *  corner to cut. A rectangular room has no reflex vertex → no seats (no run end is exposed). */
export function outerEndSeats(points: Pt[], w = BASE_DEPTH_MM, depth = BASE_DEPTH_MM): OuterSeat[] {
  // MEASURE FROM THE INNER FACES, like every run placement does. Reading the seat off the raw
  // `points` (the wall boundary) put the unit WALL_T inside the wall on both axes — it looked buried
  // in the elbow, which is exactly what a wall corner jutting into the room does to anything seated
  // a wall-thickness behind where it should be.
  const pts = offsetPolygon(points, WALL_T);
  const n = pts.length;
  if (n < 4) return [];
  let area2 = 0; // shoelace → winding
  for (let i = 0; i < n; i++) { const p = pts[i]; const q = pts[(i + 1) % n]; area2 += p.x * q.y - q.x * p.y; }
  const ccw = area2 > 0;
  const s = ccw ? 1 : -1;
  const out: OuterSeat[] = [];
  /** one seat: the wall runs along `ux,uy`, its inward normal is `nx,ny`, and the unit is CENTRED ON
   *  THE VERTEX `V` — so half of it stands in the run and half hangs past the corner, out in front of
   *  the other wall's run. (It used to sit entirely inside the run with its outer edge on the vertex;
   *  straddling the tip is the seller's call — it puts the angled face on the corner point itself.)
   *  `dir` points along the wall PAST the corner: the exposed side, and so which end carries the cut. */
  const seat = (V: Pt, ux: number, uy: number, dir: 1 | -1, wall: number, atStart: boolean) => {
    const nx = s * -uy, ny = s * ux; // inward normal (left of the edge for a CCW loop)
    const px = Math.round(V.x + nx * (depth / 2)); // only the DEPTH offset — the width straddles V
    const pz = Math.round(V.y + ny * (depth / 2));
    // the module's local +i (depth axis) must be the inward normal — the same convention cabFootprints
    // reads back out of `rot`
    const rot = Math.round((Math.atan2(-nx, ny) * 180) / Math.PI * 10) / 10;
    // The facing point needs BOTH components. Straight out along the normal it would sit exactly on
    // the unit's own centre line, and `outerFacingSigns` would read an along-component of 0 — the cut
    // side would fall to the default instead of the exposed one. Aim it diagonally out past the
    // corner, which is where the exposed corner actually looks.
    out.push({
      px, pz, rot, w, depth,
      face: { x: Math.round(V.x + (nx + dir * ux) * 1500), y: Math.round(V.y + (ny + dir * uy) * 1500) },
      wall, atStart, vertex: { x: V.x, y: V.y },
    });
  };
  const reflex = reflexVertices(points); // one definition of "exposed end", shared with the reveal rule
  for (let i = 0; i < n; i++) {
    if (!reflex.has(i)) continue;
    const prev = pts[(i - 1 + n) % n], V = pts[i], next = pts[(i + 1) % n];
    const ax = V.x - prev.x, ay = V.y - prev.y; // incoming edge (the wall ENDING here)
    const bx = next.x - V.x, by = next.y - V.y; // outgoing edge (the wall STARTING here)
    const al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
    seat(V, ax / al, ay / al, 1, (i - 1 + n) % n, false); // cap the wall arriving at the elbow
    seat(V, bx / bl, by / bl, -1, i, true);               // …and the one leaving it
  }
  return out;
}

/** DYNAMIC corner zones for the "all" shape: which wall ends a corner cabinet actually turns. A corner
 *  is free-placed (px/pz) at a vertex, so match each one to the nearest geometric seat and light up
 *  that vertex's two walls. An empty room returns empty sets → every wall is fully fillable. Base
 *  (840) and upper (613) corners at the same vertex both fall well inside the match radius, so either
 *  one reserves the vertex. */
export function activeCorners(cabs: CornerCab[], points: Pt[], waterWall: number | null, openings: Opening[] = []): CornerFlags {
  const start = new Set<number>();
  const end = new Set<number>();
  // OUTER end caps sit at free run ends and reserve nothing — only INNER corners light a vertex up.
  const placed = cabs.filter((c) => c.corner && c.px != null && c.pz != null && c.cornerShape !== "outer");
  if (!placed.length) return { start, end };
  const seats = cornerSeats(points, waterWall, "all", openings);
  if (!seats.length) return { start, end };
  for (const c of placed) {
    let best: CornerSeat | null = null;
    let bd = Infinity;
    for (const s of seats) {
      const d = Math.hypot(s.px - (c.px as number), s.pz - (c.pz as number));
      if (d < bd) { bd = d; best = s; }
    }
    if (best && bd < CORNER_MM) { end.add(best.endWall); start.add(best.startWall); } // within a corner square of the vertex
  }
  return { start, end };
}
