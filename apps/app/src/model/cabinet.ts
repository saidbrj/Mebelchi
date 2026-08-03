// The app's cabinet model — the editable run. Ported from v7-journey.html's
// cabinet helpers, typed, with stable ids so React can key on them. This is the
// UI-facing model; model/toProject.ts maps it to the @mebelchi/schema Project
// that pricing consumes.
//
// The INTERIOR (the `Cell` tree) is not defined here — it lives in @mebelchi/schema, and the
// logic that walks it in @mebelchi/pricing, because production has to read the same tree the 3D
// draws. This file re-exports both so the view layer's imports are unchanged.

import type { Cell, CombinedDoor, DoorOpening, HandlePos, FrontProfile } from "@mebelchi/schema";
import { deriveLayout, cellSizes, isLeaf, evenFractions, defaultHandlePos, frontOf, mullionsFor } from "@mebelchi/pricing";

export type { Cell, CombinedDoor, DoorOpening, HandlePos, FrontProfile };
export { cellSizes, isLeaf, evenFractions, defaultHandlePos, frontOf, mullionsFor };

/** A built-in appliance carried by a module (priced as its host cabinet).
 *  `hob` = cooktop + oven under it; `cooktop` = cooktop only (oven lives in a tower);
 *  `filler` is a render-only scribe panel and never enters the priced run. */
export type ApplianceKind =
  | "sink"
  | "hob"
  | "cooktop"
  | "oven"
  | "fridge"
  | "dishwasher"
  | "washer"
  | "hood"
  | "filler"
  | "none";

/** The recolourable parts of a module. A picked material maps to one of these and
 *  is stored on the cabinet as a colour override (int), read by the 3D + 2D views. */
export type FinishKey = "facade" | "carcass" | "worktop" | "handle";

/** Back panel mounting method for cabinets:
 *  `groove` = HDF in a milled groove (4x8mm at setback 10-12mm)
 *  `overlay` = full-size LDSP nailed/screwed on back
 *  `none` = no back panel at all (wall behind acts as back) */
export type BackPanelMethod = "groove" | "overlay" | "none";

/** THE MODULE'S ADDRESS IN THE SHEET — see model/grid.ts.
 *
 *  A module in the grid does not know where it is. It knows which CELLS it holds, and its `x`,
 *  `w`, `h` and `mountY` below are PROJECTED out of the wall's column/row track by prefix sum
 *  (grid.applyGrid). That is why two modules can no longer overlap: neither of them has a position
 *  to collide with — column D's left edge simply *is* w(A)+w(B)+w(C), exactly as in a spreadsheet.
 *
 *  Anchored by id, not index, so inserting a column to the left doesn't re-point every module after
 *  it. `cs`/`rs` are merges: a tall column is a vertical merge across the worktop line, a wide sink
 *  base a horizontal one.
 *
 *  ABSENT on the floating layer — islands, dining tables, corner units. Those keep px/pz and sit on
 *  top of the sheet, the way a chart floats over cells. */
export interface CellRef {
  /** anchor column id — a column of THIS module's row (columns are per-band now) */
  c: string;
  /** anchor row id */
  r: string;
  /** columns spanned (≥1) — a wide sink base. There is no row-span: a tall is a full-height floor
   *  cell (a `kind`), not a vertical merge across bands. */
  cs?: number;
}

export interface Cabinet {
  id: string;
  kind: "base" | "tall" | "upper";
  w: number; // mm
  h: number; // mm
  fill: "shelves" | "drawers" | "open";
  count: number; // shelves or drawers
  /** custom shelf heights as fractions 0..1 from the bottom (only when the user drags
   *  individual shelves in the fill editor). Absent → shelves are spread evenly by `count`. */
  shelfYs?: number[];
  /** vertical divider positions as fractions 0..1 across the interior width (left→right).
   *  Legacy freeform-divider field; superseded by `layout` but kept for derivation. */
  dividerXs?: number[];
  /** ONE door covering a rectangular block of cells (interior fractions) — an overlay, so
   *  it can span across rows AND columns (which the cell tree can't express as one node).
   *  The cells it covers are left open (their dividers become interior shelves behind it). */
  combinedDoors?: CombinedDoor[];
  /** HYBRID INTERIOR — a recursive cell tree. The whole interior is one root Cell; a cell
   *  either splits into rows/columns (child cells) or is a leaf with its OWN type (door
   *  «shelves» / drawers / open), so a cabinet can mix drawers + doors + open in any
   *  arbitrary layout. When present it SUPERSEDES the whole-cabinet `fill`/`count` for the
   *  interior + front; absent → derived from those legacy fields. See `cabinetLayout`. */
  layout?: Cell;
  div: 0 | 1; // vertical divider (legacy flag; kept in sync with the layout for pricing)
  /** @deprecated index into DOORS. Superseded by `front` — read `frontOf(c)`, never this. Kept so a
   *  project saved before the profile existed still renders (frontOf maps the index). */
  door: number;
  /** THE FRONT'S BODY — flat / shaker / raised / fluted / glass / grid / none. See
   *  @mebelchi/schema FrontProfile. Absent → derived from the legacy `door` index by `frontOf`. */
  front?: FrontProfile;
  handle: number; // index into HANDLES (the handle TYPE: bar/profile/knob/none)
  /** Whole-cabinet DEFAULT door opening side + handle placement, set from the module editor's
   *  "Ручка → Редактировать" panel. They seed the DERIVED layout (see `cabinetLayout`); a custom
   *  per-cell `layout` from the Fill Editor keeps its own per-cell values. */
  opening?: DoorOpening;
  handlePos?: HandlePos;
  /** Built-in appliance this module carries (sink/hob/fridge…), default none. */
  appliance?: ApplianceKind;
  /** Height of appliance opening (mm, e.g. 580). Default 580. */
  applianceH?: number;
  /** Height of bottom edge of appliance above floor (mm, e.g. 850). Default 850. */
  applianceY?: number;
  /** Integrated appliance behind a matching facade (vs a free-standing steel unit).
   *  Drives whether the fridge/oven renders as a panelled column or bare steel. */
  builtin?: boolean;
  /** Which wall run this module sits on (0 = primary, 1 = L return wall). */
  run?: number;
  /** WHICH CELLS OF THE WALL'S SHEET this module holds. When present it OWNS the module's
   *  geometry: `x`, `w`, `h` and `mountY` are all rewritten from the grid's prefix sums on every
   *  edit (grid.applyGrid), so they can never disagree with each other or with a neighbour. */
  cell?: CellRef;
  /** Left edge of the module along its run (mm). DERIVED when the module has a `cell` — the grid
   *  writes it, nothing else may. Legacy runs without a cell still carry a hand-set `x` and are
   *  laid out left→right by width instead. */
  x?: number;
  /** Bottom of a wall-mounted (upper) module above the floor (mm). Lets the user
   *  slide an upper up/down in the front view; defaults to GEOM.upperBottom. */
  mountY?: number;
  /** Free plan transform (set when the user drags/rotates a module in the 2D plan).
   *  px/pz = footprint centre in absolute room mm; rot = rotation in degrees. When
   *  present they override the wall-run placement IN THE PLAN. */
  px?: number;
  pz?: number;
  rot?: number;
  /** Depth override (mm); defaults to the per-kind depth (base/tall 560, upper 350). */
  depth?: number;
  /** Corner unit (L/U layouts) — a square body filling the inside corner, with the room-facing
   *  corner cut away. Placed via px/pz/rot; the 3D + the 2D plan build special geometry for it. */
  corner?: boolean;
  /** WHICH corner body. "diagonal" = a single 45° chamfer with one diagonal door; "l" = the
   *  room-facing corner notched out, giving an L-shaped box with one L-shaped door; "outer" = the
   *  ANGLED END UNIT that caps a run's exposed end — the run's own depth, its own width, one front
   *  corner cut at 45°, open display shelves, reserving no zone. Real kitchens use all three, on
   *  wall units as well as base ones. Absent → the historic default, which was hardcoded off the
   *  kind: a wall unit was always diagonal, a base one always L. */
  cornerShape?: "diagonal" | "l" | "outer";
  /** OUTER corner only — a world point (mm) the cut corner looks toward, so the angled face lands on
   *  the EXPOSED front corner (the open end of the run) instead of the room-centre one, which is
   *  right for inner corners but meaningless for an end unit. Set when the unit is seated; absent →
   *  fall back to the room centre. */
  cornerFace?: { x: number; y: number };
  /** OUTER corner only — how far back the 45° cut reaches (mm). Absent → the full cut: a leg equal to
   *  the shorter side, which takes the whole front face away and leaves one long diagonal. Never
   *  bigger than that (see model/outerCorner.ts `outerCutFor`). */
  chamfer?: number;
  /** The depth of the RUNS this corner butts into (mm) — NOT its own depth, which is the square's
   *  side (840 / 613). The two are different numbers, which is why the 3D used to re-derive this
   *  one from the kind. A deep (base-depth) top row needs 560 here where a wall unit needs 350.
   *  Absent → the per-kind default. See model/bands.ts `cornerArm`. */
  armDepth?: number;
  /** Free-standing kitchen island: a real base counter placed free (px/pz) like a corner
   *  unit — it never tiles a wall run. The 3D gives it the freestanding treatment (a
   *  seating-side worktop overhang + bar stools); it's priced as a normal base module. */
  island?: boolean;
  /** Free-standing furniture / extras — NOT a cabinet: no worktop, no wall run, placed
   *  free-floating via px/pz/rot. The 3D builds bespoke geometry per kind and pricing
   *  skips it. table/chair = dining; trolley/stool/shelf/bin = kitchen extras. */
  furniture?: "table" | "chair" | "trolley" | "stool" | "shelf" | "bin";
  /** Per-module finish overrides (colour ints, like KitchenStyle). Set from the
   *  material picker; each present key wins over the kitchen-wide style in the render. */
  finish?: Partial<Record<FinishKey, number>>;
  /** WHERE THIS BOX HANGS — the side panels carrying a навес, as mm from the BOX's left edge.
   *
   *  Not a count: a навес is a bracket screwed to the top rear corner of a SIDE PANEL, so "two
   *  hangers on a 4-bay row" is a statement about WHICH panels, and that is what the fitter needs and
   *  what the drilling file will have to place. The count is just `hangPos.length`.
   *
   *  Absent → the shop's standing rule applies (Настройки → hangingsPerCarcass / hangingSpanMm).
   *  Carried by every member of the box, so any one of them can answer for it. */
  hangPos?: number[];
  /** SHARED CARCASS — modules with the same tag are built as ONE box (two outer sides, a shared
   *  stile at each internal boundary, one long top/bottom/back) instead of N separate boxes.
   *
   *  This is the workshop's economy build for a row of wall units: four 600s merged into one 2400
   *  carcass go from 8 side panels to 5, from 4 backs to 1, and from 8 wall hangers to 2 — about a
   *  quarter off the row, with the FRONTS UNCHANGED, so the client sees the same kitchen.
   *
   *  Set by the "Объединить в один корпус" toggle, which only ever tags a valid row (see
   *  model/carcassGroups.ts). Absent → the module is its own box, exactly as before. */
  carcassGroup?: string;
  /** Carcass board thickness in mm (16 or 18). Absent -> defaults to 16mm. */
  boardThickness?: 16 | 18;
  /** Facade thickness in mm (18, 19, or 22). Absent -> defaults to 18mm. */
  facadeThickness?: 18 | 19 | 22;
  /** Whether the cabinet has a back panel. Absent -> defaults to true. */
  hasBack?: boolean;
  /** Back panel mounting method (`groove`, `overlay`, or `none`). Absent -> defaults to "groove". */
  backMount?: BackPanelMethod;
  /** Distance from rear edge to HDF groove in mm (default 10mm). */
  grooveSetback?: number;
  /** Bottom board fit: `nakladnoe` = full-width (sits under the sides), `vkladnoe` = inset between
   *  the sides. Absent → "nakladnoe". Read by hollowCarcass + the V21 studio. */
  bottomMode?: "nakladnoe" | "vkladnoe";
  /** Top of the carcass: `full` lid, `stretchers` (two 80mm rails), or `none`. Absent → "full". */
  topMode?: "full" | "stretchers" | "none";
  /** Base support: a `box` plinth, `sides` (the side panels run to the floor), or `legs`.
   *  Absent → "box". Render-only for now (see the V21 construction editor). */
  plinthMode?: "box" | "sides" | "legs";
  /** HANDLELESS / GOLA — an aluminium profile replaces handles. Presence enables it; the object
   *  tunes the profile geometry (absent fields use GOLA_DEFAULTS). The profiles, the front grip gaps
   *  and the side-panel notches are all DERIVED from the layout by model/gola.ts. */
  gola?: { depthMm?: number; heightMm?: number; gapMm?: number };
  /** Width of left scribe/filler panel (фальш-панель) in mm. */
  fillerLeft?: number;
  /** Width of right scribe/filler panel (фальш-панель) in mm. */
  fillerRight?: number;
  /** Height of top scribe/filler panel (фальш-панель) in mm. */
  fillerTop?: number;
}

/** Visual corpus materials (swatches). Pricing currently uses the seed LDSP rate
 *  regardless of swatch — see model/toProject.ts. */
export const MATERIALS = [
  { n: "Белый", c: "#f3f0ea", e: "#dcd6ca" },
  { n: "Дуб", c: "#d8b483", e: "#b9905c" },
  { n: "Графит", c: "#5d5b57", e: "#43413d" },
  { n: "Песок", c: "#cdbfa3", e: "#ab9b7c" },
  { n: "Олива", c: "#8c8d6f", e: "#6e6f54" },
  { n: "Бордо", c: "#7c4a4a", e: "#5e3636" },
] as const;

/** @deprecated the legacy `door` index — kept only so `frontOf` can read old projects. */
export const DOORS = ["Гладкий", "Фрезер", "Стекло", "Без"] as const; // 0..3
/** The front bodies the picker offers, in order. «Без» is not one of them: an open module is a
 *  FILL («Открытый»), not a style — offering both would give two ways to say the same thing. */
export const FRONT_PROFILES: FrontProfile[] = ["flat", "shaker", "raised", "fluted", "glass", "grid"];
export const HANDLES = ["Скоба", "Профиль", "Кнопка", "Без"] as const; // 0..3
export const FILLS: [Cabinet["fill"], string][] = [
  ["shelves", "Полки"],
  ["drawers", "Ящики"],
  ["open", "Открытый"],
];

let _seq = 0;
// A per-load random tag keeps ids UNIQUE ACROSS RELOADS: `_seq` resets to 0 every page
// load, but a reopened project's cabs keep their saved `cab-N` ids — so without this the
// first freshly-added cabinet would be `cab-1`, colliding with an existing one (selecting/
// moving one then hits both). The random tag makes a new id like `cab-1-k3f9a`.
const _tag = Math.random().toString(36).slice(2, 7);
const uid = () => `cab-${++_seq}-${_tag}`;

/** Guarantee every cabinet has a UNIQUE id — regenerate any missing/duplicate one. Repairs
 *  projects saved before ids were collision-proof (a reload + add produced two `cab-1`). */
export function dedupeIds(cabs: Cabinet[]): Cabinet[] {
  const seen = new Set<string>();
  return cabs.map((c) => {
    if (c.id && !seen.has(c.id)) {
      seen.add(c.id);
      return c;
    }
    const fresh = uid();
    seen.add(fresh);
    return { ...c, id: fresh };
  });
}

/** Shelf heights as fractions 0..1 from the bottom: the custom `shelfYs` if set,
 *  else `count` shelves spread evenly. Shared by the 3D, the 2D elevation + the fill editor. */
export function shelfPositions(count: number, shelfYs?: number[]): number[] {
  if (shelfYs && shelfYs.length) return shelfYs;
  return Array.from({ length: Math.max(0, count) }, (_, i) => (i + 1) / (count + 1));
}

/** Vertical divider positions as fractions 0..1 across the interior width (left→right):
 *  the custom `dividerXs` if set, else `n` dividers spread evenly. Shared by the 3D, the
 *  2D elevation + the fill editor. Legacy `div` (0|1) maps to n = div. */
export function dividerPositions(div: 0 | 1, dividerXs?: number[]): number[] {
  if (dividerXs && dividerXs.length) return dividerXs;
  return div ? [0.5] : [];
}

/** The cabinet's interior as a cell tree: the freeform `layout` if set, else derived from the
 *  legacy whole-cabinet `fill`/`count`/`dividerXs`, so a module saved before the tree existed
 *  still renders and edits. `deriveLayout` is the SAME derivation pricing uses, so what the 3D
 *  draws and what the factory cuts cannot drift apart. */
export function cabinetLayout(cab: Cabinet): Cell {
  return cab.layout ?? deriveLayout(cab);
}

/** Appliance cabinets that carry a real facade even though they are modelled `fill: "open"` —
 *  there is nothing to shelve inside them, but the sink cabinet has doors and an integrated
 *  dishwasher / washer has a front panel. */
const FRONTED_APPLIANCES: ReadonlySet<string> = new Set(["sink", "dishwasher", "washer"]);

/** The interior a cabinet actually PRESENTS — `cabinetLayout` plus the appliance rule above.
 *
 *  Read this, not `cabinetLayout`, anywhere the answer feeds production or a drawing: taking
 *  `fill: "open"` literally would drop the sink cabinet's doors from the cut list. The 3D and the
 *  on-screen elevation already special-case it their own way (`{...c, fill: "shelves"}`); this is
 *  the same rule, in one place, so the sheet and the cut list cannot disagree. */
export function cabinetInterior(cab: Cabinet): Cell {
  if (cab.layout) return cab.layout;
  const fronted = cab.fill === "open" && cab.appliance && FRONTED_APPLIANCES.has(cab.appliance);
  return deriveLayout(fronted ? { ...cab, fill: "shelves" } : cab);
}

/** THE KITCHEN'S STYLE — the look a NEW or SWAPPED module has to arrive wearing.
 *
 *  A catalog template says what a module IS (a drawer bank, a sink base, a пенал). It does not say
 *  what the kitchen LOOKS like — almost none of them set a front profile or a handle — so `mk()`
 *  filled those from its own defaults and every module you added or swapped came out flat-fronted
 *  with a bar handle, in a fluted, knob-handled kitchen. You then had to restyle it by hand to put
 *  back what it should never have lost.
 *
 *  Read the style off the kitchen instead. Prefer a module of the same KIND (wall units and bases
 *  can legitimately differ — ribbed uppers over flat bases is a real look, and the generator makes
 *  it), and fall back to any real cabinet. Appliances and free-standing furniture are excluded:
 *  a hood has no front and a chair is not a cabinet, so neither can speak for the kitchen. */
export function styleOf(cabs: Cabinet[], kind?: Cabinet["kind"]): Partial<Cabinet> {
  const real = cabs.filter((c) => !c.furniture && !c.appliance && !c.corner);
  const src = (kind && real.find((c) => c.kind === kind)) ?? real[0];
  if (!src) return {};
  return {
    front: src.front ?? frontOf(src), // frontOf maps the legacy `door` index, so this is never blank
    handle: src.handle,
    handlePos: src.handlePos,
    opening: src.opening,
    finish: src.finish ? { ...src.finish } : undefined,
  };
}

export function mk(o: Partial<Cabinet> = {}): Cabinet {
  return {
    id: uid(),
    kind: "base",
    w: 600,
    h: 720,
    fill: "shelves",
    count: 2,
    div: 0,
    door: 0,
    handle: 0,
    ...o,
  };
}

/** The 4 starter layouts offered in Phase B (ported from v7 `arch`). */
export function archetype(v: number): Cabinet[] {
  if (v === 0)
    return [
      mk({ fill: "open", count: 2 }),
      mk({ count: 1 }),
      mk({ fill: "drawers", count: 3 }),
      mk({ count: 1 }),
      mk({ kind: "tall", h: 2100, fill: "shelves", count: 5 }),
    ];
  if (v === 1)
    return [
      mk({ fill: "open", count: 2 }),
      mk({ fill: "drawers", count: 3 }),
      mk({ kind: "tall", h: 2100, fill: "shelves", count: 5 }),
      mk({ count: 1 }),
      mk({ kind: "tall", h: 2100, fill: "shelves", count: 6 }),
    ];
  if (v === 2)
    return [
      mk({ fill: "drawers", count: 3 }),
      mk({ fill: "drawers", count: 4 }),
      mk({ fill: "drawers", count: 2 }),
      mk({ count: 1 }),
      mk({ kind: "tall", h: 2100, fill: "drawers", count: 4 }),
    ];
  return [
    mk({ fill: "open", count: 2 }),
    mk({ fill: "drawers", count: 3 }),
    mk({ kind: "tall", h: 2100, fill: "shelves", count: 5 }),
  ];
}
