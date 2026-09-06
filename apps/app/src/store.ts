// Single zustand store for the whole journey. Mirrors v7-journey.html's `S`
// object + actions, typed. Screens read slices from here; the price ticker reads
// the same state through model/toProject.ts → priceProject.

import { useMemo } from "react";
import { create } from "zustand";
import { MATERIALS, mk, dedupeIds, styleOf, frontOf, type Cabinet, type FinishKey, type FrontProfile } from "./model/cabinet";
import { fillGapSpan, firstFitX, parkX } from "./model/fill";
import { dockAll, cabFootprints, footsClash } from "./model/footprint";
import { generateVariants as solveVariants, type GenVariant, type KitchenStyle, type Zone, type FridgeType, type OvenType, type HoodType, type WallBand } from "./model/layout";
import { isTiled, runFloor, resolveLayout, wallRows } from "./model/resolve";
import { maxCabH, cabDepth, isOuterCorner, bandsOverlap, cabBand, FOOT_DEPTH_MM, MIN_H, D_MIN, D_MAX } from "./model/bands";
import { resizeCabs, setBasesH, editRows, seatCorner, seatOuterCorner, healRunStarts, healCornerUnits, type ResizeBounds, type RowEdit } from "./model/rowOps";
import { mergeRow, unmergeRow, healCarcassGroups, joinSeam, splitSeam, boxMates, hangersOn } from "./model/carcassGroups";
import {
  editSheet,
  setColWidth,
  setRowHeight,
  splitRow,
  setRowKind,
  addColumn,
  dropColumn,
  resizeSpan,
  resizeSpanLeft,
  equalizeSpan,
  lastFillColId,
  reconcileTalls,
  locate,
  rowIndex,
  rowEdges,
  ROW_MIN,
  type CellRef,
  type RowKind,
} from "./model/grid";
import { ensureSheet, rehangCorners, openCells, inSheet, type Grids } from "./model/sheet";
import { completeCornerL, reanchorAfterCorner } from "./model/cornerEdit";
import { GEOM } from "./model/layout";

const PLINTH = GEOM.plinth;
const WORKTOP = GEOM.worktop;

/** The kitchen's default finish — a warm light oak. The initial run wears it, and so does a
 *  from-scratch start, so a blank kitchen isn't a colourless one. */
const DEFAULT_RUN_STYLE: KitchenStyle = { carcass: 0xefe8da, facade: 0xe7ddc9, worktop: 0x7c756b, handle: 0x6f6a62, glassUppers: false };
import { planRuns, candidateLayouts, cornerUnits, cornerSideFor, interiorWallCabs, type KitchenLayout } from "./model/runPlan";
import { roomOutlineMm, defaultOpenings, defaultOpeningHeight, defaultFittingHeight, fittingKind, wallSegments, interiorSegRef, polygonBoundsMm, wallItemId, dedupeWallItems, pipePathOf, type PipePoint, type Pt, type Opening, type OpeningKind, type Fitting, type FittingCategory } from "./model/room";
import { defaultSurface, splitLeaf, colorLeaf, type Surface, type SurfPath } from "./model/walls";
import { DEFAULT_SPLASH, DEFAULT_CLOSER, DEFAULT_UNDERSIDE, type SplashSpec, type CloserSpec, type UndersideSpec, type PanelSpecs } from "./model/wallPanels";
import { DEFAULT_LED, type LedSpec } from "./model/ledStrips";
import { PERSIST_KEYS, loadProjectState, upsertProject, deleteProject, updateProjectMeta, newProjectId, allProjects, replaceAllProjects, type DesignState, type MetaPatch, type ProjectBucket } from "./model/projects";
import { toProject } from "./model/toProject";
import { ratesToTable } from "./model/rates";
import { ratesForDesign } from "./model/catalogRates";
import { priceProject } from "@mebelchi/pricing";
import { runExport } from "./lib/handoffExport";
import { loadSettings, saveSettings, type Settings } from "./model/settings";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { pullProfile, pushProfile, pullProjects, pushProject, deleteProjectCloud, pullSavedCabs, pushSavedCab, deleteSavedCabCloud } from "./lib/sync";
import { addSavedCab, removeSavedCab as removeSavedCabLS, renameSavedCab as renameSavedCabLS, stripCab, allSavedCabs, replaceAllSavedCabs } from "./model/savedCabs";
import { upsertMaterial, removeMaterial, resetCatalog } from "./model/catalog";
import { addOffcut as addOffcutLS, removeOffcut as removeOffcutLS } from "./model/offcuts";
import type { EmanMaterial } from "./model/materials";
import { captureCabinetThumbnail } from "./lib/cabThumb";
import { captureThumbnail } from "./lib/thumbnailCapture";
import { QUIZ } from "./quiz/questions";

const snap100 = (v: number) => Math.round(v / 100) * 100;

/** The length of a wall segment (mm) — what a pipe's `a` coordinate is measured along. */
const wallLenOf = (s: { roomPoints: Pt[]; interiorWalls: Pt[][] }, wall: number): number => {
  const seg = wallSegments(s.roomPoints, s.interiorWalls)[wall];
  return seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 4000;
};
// ids for wall items come from model/room now — a bare module counter restarts on every page load
// and collided with the ids a reopened project already held (see `wallItemId`)

interface RoomSnapshot {
  shape: "i" | "l";
  roomPoints: Pt[];
  openings: Opening[];
  interiorWalls: Pt[][];
  fittings: Fitting[];
}
const snapshot = (s: RoomSnapshot): RoomSnapshot => ({
  shape: s.shape,
  roomPoints: s.roomPoints,
  openings: s.openings,
  interiorWalls: s.interiorWalls,
  fittings: s.fittings,
});

// ---- constructor (cabinet) edit history — separate from the room geometry undo ----
// The GRIDS ride along in the snapshot: a column drag changes the track AND every module the track
// projects, so undoing one without the other would leave modules addressing columns that no longer
// have those widths. One snapshot, one undo step — the sheet is the unit of history.
interface CabSnap {
  cabs: Cabinet[];
  grids: Grids;
  runStyle: KitchenStyle;
  mat: number;
}
type CabHistState = { cabsPast: CabSnap[]; cabs: Cabinet[]; grids: Grids; runStyle: KitchenStyle; mat: number };
// push the current cabinet state onto the undo stack (and clear redo)
const cabHist = (s: CabHistState) => ({
  cabsPast: [...s.cabsPast.slice(-49), { cabs: s.cabs, grids: s.grids, runStyle: s.runStyle, mat: s.mat }],
  cabsFuture: [] as CabSnap[],
});
const cabNow = (s: CabHistState): CabSnap => ({ cabs: s.cabs, grids: s.grids, runStyle: s.runStyle, mat: s.mat });

/** Translate every gridded module's run INDEX from one layout to another via its physical wall, so a
 *  cabinet keeps standing on the same wall when the constructor switches the shape to "all" (whose run
 *  order differs from i/l/u). Free/corner modules carry px/pz, not a run index — they pass through. */
function remapCabRuns(cabs: Cabinet[], from: KitchenLayout, to: KitchenLayout, points: Pt[], waterWall: number | null, openings: Opening[]): Cabinet[] {
  if (from === to) return cabs;
  const oldRuns = planRuns(points, waterWall, from, openings).runs;
  const newRuns = planRuns(points, waterWall, to, openings).runs;
  const wallToNew = new Map<number, number>();
  newRuns.forEach((r, i) => { if (r.kind === "wall") wallToNew.set(r.wall, i); });
  return cabs.map((c) => {
    if (c.px != null || c.run == null) return c;
    const wall = oldRuns[c.run]?.wall;
    const nr = wall != null ? wallToNew.get(wall) : undefined;
    return nr != null && nr !== c.run ? { ...c, run: nr } : c;
  });
}


export type Screen =
  | "home" // the hub AND the full project/deal list (the separate "projects" screen is gone)
  | "catalog" // the shop's own materials / hardware / saved cabinets
  | "settings"
  | "user"
  | "auth"
  | "quiz"
  | "space"
  | "details"
  | "variants"
  | "configure"
  | "preview"
  | "engineering"
  | "cost"
  | "handoff";

// ROOM FIRST. The quiz used to sit here as a hard gate — four questions, one of them ("what shape
// is your kitchen?") asked BEFORE the user had drawn a single wall, when the room itself answers
// most of it (see runPlan.candidateLayouts). For a seller redrawing a room per client that's four
// abstract questions they must answer before seeing anything.
//
// The questions still exist and still drive the generator; they now live on the VARIANTS screen as
// a «Параметры» sheet, where each choice is made while looking at the kitchen it changes. Unanswered
// ones fall back to sensible defaults, which `generateVariants` has always had.
export const FLOW: Screen[] = [
  // "space" (the standalone shape picker) was retired: a new project opens straight on the room
  // editor, which carries the same shape choice inline. The Screen type keeps "space" for legacy
  // saved projects — openProject coerces any that resume onto it (it's no longer in FLOW).
  "details",
  "variants",
  "configure",
  "preview", // «Рендер» — the payoff step. Always in the flow now; only the AI inside it is held.
  "engineering",
  "cost",
  "handoff",
];

/** Screens OUTSIDE the design journey — a project must never be saved with one of these as
 *  its resume point (otherwise reopening it can't find the design and falls back to onboarding). */
const MENU_SCREENS: Screen[] = ["home", "catalog", "settings", "user", "auth"];
/** A sensible design screen to resume at, from the design's content (used when the saved
 *  screen is missing / a menu screen). Furthest sensible point given how far they got. */
function resumeScreen(state: Partial<AppState>): Screen {
  if (state.cabs && state.cabs.length > 0) return "configure"; // committed a layout
  if (state.genVariants && state.genVariants.length > 0) return "variants";
  return "details"; // nothing designed yet → start where a design starts: the room editor
}

/** The quote total in USD (the base currency) for the live design, for the project-card snapshot.
 *  Same call the Смета ticker makes (pricing/usePrice.ts) so a card can never disagree with the
 *  screen. Pure and cheap. Wrapped because a save must never fail over a price: saveCurrent runs
 *  on auto-save and on every navigation, so a throw here would strand the user mid-journey. */
function projectTotalUSD(s: AppState): number {
  if (!s.cabs.length) return 0;
  try {
    // ratesForDesign, exactly as the ticker does it — a project card that priced from the
    // blanket rate while the screen priced from the catalog would be the same disagreement
    // this function's own docstring exists to prevent.
    return priceProject(toProject(s), ratesToTable(ratesForDesign(s.settings.rates, s.cabs, s.runStyle), s.hwGrade)).total;
  } catch {
    return 0;
  }
}

/** Hardware grade picked in the Инженерия step (фаза Г). */
export type HwGrade = "eco" | "std" | "premium";

/** The signed-in user (Supabase auth). Null when signed out / auth disabled. */
export interface AuthUser {
  id: string;
  email: string;
}

/** RU labels for the hardware grade — shared by the Инженерия + Передача screens. */
export const HW_GRADE_LABEL: Record<HwGrade, string> = {
  eco: "Эконом",
  std: "Стандарт",
  premium: "Премиум",
};

export interface AppState {
  // journey
  screen: Screen;
  qi: number;
  /** selected option(s) per quiz question (multi-select where the question allows) */
  quiz: Record<string, string[]>;
  /** true when a quiz question was opened from the summary to be changed */
  editing: boolean;
  // space (Phase A.2)
  shape: "i" | "l";
  /** the editable room outline (mm); seeded from `shape`, then freely edited */
  roomPoints: Pt[];
  openings: Opening[];
  /** free-drawn interior wall polylines (mm) */
  interiorWalls: Pt[][];
  /** wall fittings — sockets/switches, radiators, vents — placed on walls */
  fittings: Fitting[];
  /** per-wall paint surface (split tree); missing wall = unpainted */
  wallSurfaces: Record<number, Surface>;
  past: RoomSnapshot[];
  future: RoomSnapshot[];
  wallLen: number;
  ceiling: number;
  /** FILLER GAP (mm) reserved at each run end that butts a wall, and under the ceiling on a
   *  floor-to-ceiling run — the scribe «добор». 0 = cabinets go wall-to-wall. See model/runPlan. */
  reveal: number;
  /** THE ФАРТУК — the wall panel between the worktop and the wall units. A SPEC, not geometry:
   *  where the panels land is derived every time from what is standing there (model/wallPanels). */
  splash: SplashSpec;
  /** THE STRIP TO THE CEILING — what makes a kitchen floor-to-ceiling in a room too low for a
   *  second row of wall units. Same deal: a spec, the panels are derived. */
  closer: CloserSpec;
  /** THE PLANE UNDER THE WALL UNITS — one panel per row, so the undersides read as one surface
   *  rather than a row of separate boxes. Same deal again. */
  underside: UndersideSpec;
  /** THE LIGHT BUILT INTO THE CABINETRY — which zones are lit, and in what colour. A spec again:
   *  a strip's LENGTH is the length of the run it is screwed to, so it is derived, never typed
   *  (model/ledStrips). */
  led: LedSpec;
  water: "left" | "center" | "right" | "none";
  /** wall index the water supply comes from (drives dishwasher placement), null = unset */
  waterWall: number | null;
  constraints: string[];
  // room metadata
  roomName: string;
  roomType: string;
  floorCovering: number;
  // transient UI toast
  toast: string | null;
  // navbar hamburger drawer
  menuOpen: boolean;
  // Настройки popup — an overlay (not a screen) so it opens over any journey step
  // without unmounting the work in progress
  settingsOpen: boolean;
  // Каталог popup — same deal. It matters MORE here than for settings: editing a material
  // mid-journey re-prices the live design (catalogRev), and routing to the catalog SCREEN
  // would tear down the constructor to do it.
  catalogOpen: boolean;
  // set when the variants "add water?" prompt sends the user to the room to place it →
  // RoomScene opens its water-picker on entry
  pendingWater: boolean;
  // persistence — the project this session is editing + a bump to refresh lists
  currentProjectId: string | null;
  projectsRev: number;
  /** Which deal-stage chip the Projects list is filtered by. Lives in the store, not in the
   *  screen, so Home's "Ждут ответа" banner can hand the list a filter on the way in. */
  projectBucket: ProjectBucket;
  // "My cabinets" reusable library — a bump to refresh the saved-cabinet list
  savedCabsRev: number;
  // the editable material catalog — bumped on add/edit/delete so every open picker
  // (Стиль tab, FurnitureEditor sheet) re-reads the list instead of showing a stale one
  catalogRev: number;
  // the workshop's offcut stock (Раскрой) — bumped so the cut plan re-nests on a change
  offcutsRev: number;
  // global user/app settings (profile · company · preferences), Supabase-ready
  settings: Settings;
  /** Bumped on every «Стандарт цеха» change so the open 3D redraws — the carcass build is read
   *  from model/construction.ts, not from `cabs`, so no cabinet identity changes when it does. */
  constructionRev: number;
  // auth (Supabase). authReady = session checked; authUser = null when signed out.
  // The app is GUEST-FIRST: no login wall at launch — sign in from the menu / the nudge.
  authReady: boolean;
  authUser: AuthUser | null;
  recovery: boolean; // in a password-recovery session (opened from the reset email)
  authReturn: Screen; // where the auth screen returns to on close
  loginNudge: boolean; // one-time soft "sign in to sync" prompt after the first project
  // cloud sync status (for the subtle indicator): in-flight writes + last-write-failed
  syncBusy: number;
  syncError: boolean;
  // run
  variant: number;
  /** Phase-B generated layouts (empty until "Сгенерировать раскладки" runs). */
  genVariants: GenVariant[];
  cabs: Cabinet[];
  cabsFrom: number;
  selIdx: number;
  /** THE SELECTION (3D). A set of module ids — there is no separate "multi" mode: a tap toggles a
   *  module in/out, one selected reads as a single edit, several as a batch. `selIdx` tracks the
   *  PRIMARY (last-tapped) member for single-value readouts. */
  selIds: string[];
  /** EACH WALL'S SPREADSHEET — its column track and row track (model/grid.ts).
   *
   *  This, not `cabs`, is now what the front view and the 3D draw their cells from. It exists for a
   *  wall with nothing on it: an empty room already has columns and rows you can drag and fill.
   *  A module's x / w / h / mountY are PROJECTED out of it, which is why two of them can no longer
   *  overlap — they have no positions of their own to collide with. */
  grids: Grids;
  /** constructor edit history (cabs + grids + finish), separate from the room geometry undo */
  cabsPast: CabSnap[];
  cabsFuture: CabSnap[];
  /** layout + finish committed from the chosen variant (drives the constructor 3D) */
  runLayout: KitchenLayout;
  runStyle: KitchenStyle;
  // configure view / materials
  view: "front" | "open" | "top";
  mat: number;
  mode: "real" | "xray" | "wire";
  // engineering / cost / handoff
  xray: boolean;
  hardened: boolean;
  hwGrade: HwGrade;
  recFixed: boolean;
  adviceApplied: boolean;
  exported: boolean;

  // actions — quiz
  pickQuiz: (id: string, v: string) => void;
  // actions — nav
  next: () => void;
  back: () => void;
  goTo: (s: Screen) => void;
  requestWater: () => void; // go to the room + auto-open the water picker
  clearPendingWater: () => void;
  // actions — space
  setShape: (v: "i" | "l") => void;
  setWater: (v: AppState["water"]) => void;
  toggleConstraint: (c: string) => void;
  setWall: (d: number) => void;
  setCeiling: (d: number) => void;
  setCeilingValue: (val: number) => void;
  /** Set the filler «добор» width (mm, absolute), clamped [0,120]. 0 removes the fillers. Rebuilds
   *  the wall sheets so the reserved dead zones move with it. */
  setReveal: (mm: number) => void;
  /** Edit the ФАРТУК spec — on/off, decor, height. Nothing is stored per wall: the panels are
   *  re-derived from this + the layout on every render, so changing it here changes every run. */
  setSplash: (patch: Partial<SplashSpec>) => void;
  /** Edit the ceiling-closer spec. Same story. */
  setCloser: (patch: Partial<CloserSpec>) => void;
  /** Edit the under-the-wall-units panel spec. Same story. */
  setUnderside: (patch: Partial<UndersideSpec>) => void;
  /** Edit the built-in lighting. Same story — nothing here is geometry. */
  setLed: (patch: Partial<LedSpec>) => void;
  /** WHICH WAY THE GRAIN RUNS on the fronts (kitchen-wide). The fronts are mapped in slab space,
   *  so this turns the whole board rather than re-tiling each door. */
  setGrain: (horizontal: boolean) => void;
  /** How this shop builds its L corners: one L-shaped leaf, or two doors. Kitchen-wide default;
   *  a single module can still differ (Cabinet.cornerDoors). */
  setCornerDoors: (v: "single" | "pair") => void;
  setRoomName: (v: string) => void;
  setRoomType: (v: string) => void;
  setFloorCovering: (i: number) => void;
  setHardened: (v: boolean) => void;
  setHwGrade: (v: HwGrade) => void;
  // room polygon editing
  beginEdit: () => void; // snapshot before a drag/edit gesture (for undo)
  undo: () => void;
  redo: () => void;
  moveCorner: (i: number, x: number, y: number) => void;
  setWallEndpoints: (i: number, a: Pt, b: Pt) => void;
  setWallLength: (i: number, length: number, endpoint: "a" | "b") => void;
  /** resize a RECTANGULAR room (4 corners) by width / depth, keeping it rectangular (moves the far
   *  edge's BOTH corners, unlike setWallLength which skews it by dragging one). No-op if not a rect. */
  setRoomWidth: (mm: number) => void;
  setRoomDepth: (mm: number) => void;
  moveOpening: (id: string, t: number) => void;
  dragOpeningTo: (id: string, x: number, y: number) => void; // hop to the nearest wall
  setOpeningWidth: (id: string, width: number) => void;
  setOpeningHeight: (id: string, height: number) => void;
  setOpeningSill: (id: string, sill: number) => void;
  setOpeningFinish: (id: string, finish: string) => void;
  addOpening: (item: OpeningKind, wall?: number) => string;
  removeOpening: (id: string) => void;
  duplicateOpening: (id: string) => string | null;
  replaceOpening: (id: string, item: OpeningKind) => void;
  flipOpening: (id: string) => void;
  addInteriorWall: (poly: Pt[]) => void;
  moveInteriorPoint: (wi: number, pi: number, x: number, y: number) => void;
  /** resize a drawn-wall segment (global segment index) to `length`, moving its far endpoint */
  setInteriorWallLength: (globalSeg: number, length: number) => void;
  // wall paint / surfaces
  setWallColor: (wall: number, c: number) => void; // whole wall → one colour
  setAllWallsColor: (c: number) => void;
  splitWallSurface: (wall: number, path: SurfPath, dir: "h" | "v") => void;
  colorWallSurface: (wall: number, path: SurfPath, c: number) => void;
  // wall fittings (electric / heating / vent)
  addFitting: (category: FittingCategory, kind: string, wall?: number) => string;
  dragFittingTo: (id: string, x: number, y: number) => void; // slide along / hop to nearest wall
  moveFitting: (id: string, t: number) => void; // slide along its current wall
  setFittingWidth: (id: string, width: number) => void;
  setFittingHeight: (id: string, height: number) => void;
  /** TURN A PIPE. Swaps its two extents so it keeps its shape: a Ø110 riser 2500 tall becomes a
   *  2500 run of Ø110 lying along the wall. Plumbing only. */
  setFittingOrient: (id: string, orient: "v" | "h") => void;
  /** POSITION MEASURED FROM THE WALL — mm from the wall's start corner to the item's centre. The
   *  drag gesture is fine for roughing in; a pipe is surveyed, and the fitter has a tape. */
  setFittingAlong: (id: string, mm: number) => void;
  /** Height of the item's CENTRE above the floor (mm). */
  setFittingMountY: (id: string, mm: number) => void;
  /** MOVE ONE POINT of a pipe's path (wall space: mm along, mm up). This is what a drag on a
   *  handle does — and it is also how a pipe is resized and reshaped, because a path has no
   *  separate width to pull. */
  setPipePoint: (id: string, i: number, a: number, y: number, live?: boolean) => void;
  /** BEND IT — split the segment after point `i`, putting a new bend at its middle. */
  addPipeBend: (id: string, i: number) => void;
  /** Straighten a bend out again. Refuses to leave fewer than two points. */
  removePipeBend: (id: string, i: number) => void;
  /** Replace the whole path — what the drawing tool commits. */
  setPipePath: (id: string, pts: PipePoint[]) => void;
  dragFitting3D: (id: string, x: number, y: number, heightMm: number) => void; // 3D: nearest wall + along + height
  removeFitting: (id: string) => void;
  duplicateFitting: (id: string) => string | null;
  replaceFitting: (id: string, category: FittingCategory, kind: string) => void;
  // water supply
  setWaterWall: (i: number | null) => void;
  // phase B — variant generation
  generateVariants: () => void;
  selectVariant: (i: number) => void;
  /** START FROM SCRATCH — skip the generated options and open the constructor on a BARE room: no
   *  cabinets, just the empty grid on every wall, ready to fill. For the seller who is going to
   *  rebuild the auto-layout anyway (which is most of them). The room still decides the run shape;
   *  only the furniture is empty. */
  startBlank: () => void;
  // phase C — constructor (per-module editing)
  selectCab: (i: number) => void;
  /** select exactly one module (a chip tap, or after adding) — the selection becomes just `[id]`. */
  selectOnly: (id: string) => void;
  /** set the whole selection to `ids` (e.g. after duplicating a group). */
  selectMany: (ids: string[]) => void;
  /** clear the whole selection. */
  clearSel: () => void;
  /** add/remove a module id from the selection (a tap in the 3D). Keeps `selIdx` on the primary. */
  toggleSelId: (id: string) => void;
  /** push a style patch (front / handle / door …) onto EVERY selected module at once. */
  applyToSelected: (patch: Partial<Cabinet>) => void;
  /** push a finish (part → colour) onto every selected module at once. */
  applyFinishToSelected: (finish: Partial<Record<FinishKey, number>>) => void;
  /** resize the whole selection to a new COMBINED width (mm), redistributed across its members. Only
   *  fires when the selection is a contiguous run of gridded modules on ONE wall band; otherwise no-op. */
  resizeSelectedWidth: (mm: number) => void;
  /** DRAG-resize the selection's combined width from ONE outer edge (the 3D group handle): "right"
   *  grows the group's right edge into the column after it, "left" grows the left edge into the column
   *  before it; the members redistribute proportionally. Live steps push no undo. Same contiguity
   *  guard as `resizeSelectedWidth`. */
  resizeSelectedSpan: (mm: number, edge: "left" | "right", live?: boolean) => void;
  /** set height / depth on EVERY selected module at once (same clamps + corner/base rules as one). */
  dimSelected: (patch: { h?: number; depth?: number }, live?: boolean) => void;
  /** make every selected module in a contiguous run the same width (their combined width unchanged). */
  equalizeSelected: () => void;
  patchCab: (i: number, patch: Partial<Cabinet>) => void;
  /** live patch (NO undo entry) — for continuous gestures; pair with beginCabEdit() */
  patchCabLive: (i: number, patch: Partial<Cabinet>) => void;
  /** «Применить ко всему ряду» — while on, a HEIGHT or DEPTH edit applies to the module's whole row
   *  (same wall, same band, same kind). A persistent mode: you turn it on to shape a row and off
   *  after. Width never participates — that re-tiles the row, which is a different operation. */
  /** THE dimension edit — height/depth for ONE module. Every view routes through it. */
  patchCabDims: (id: string, patch: { h?: number; depth?: number }, live?: boolean) => void;
  /** «Объединить в один корпус» — build this module's whole ROW as ONE carcass (two outer sides, a
   *  shared stile at each boundary, one long top/bottom/back) instead of one box per cabinet.
   *
   *  The workshop's economy build: on a 4 × 600 wall row it takes ~24% off — 8 навесов become 2,
   *  32 minifix become 20, 28 panels to saw become 16 — and the FRONTS DO NOT MOVE, so the client
   *  sees the same kitchen. Toggling it off splits the box back into separate cabinets. */
  toggleCarcassMerge: (id: string) => void;
  /** JOIN or SPLIT the seam between two neighbouring cabinets — the per-boundary switch that lets a
   *  seller merge SOME of a row and leave the rest. A box is just a maximal run of joined seams. */
  toggleSeam: (leftId: string, rightId: string) => void;
  /** PUT A HANGER ON THIS SIDE PANEL — or take it off. `pos` is mm from the BOX's left edge, and the
   *  legal positions are the box's side panels (carcassGroups.hangerSlots). The seller is naming a
   *  PLACE, not a number; the count is however many places they picked. */
  toggleHangerAt: (id: string, pos: number) => void;
  /** back to the workshop's standing rule (Настройки) for this box */
  resetHangers: (id: string) => void;
  /** merge a finish (part → colour) into every module — the editor's "apply to all" */
  applyFinishToAll: (finish: Partial<Record<FinishKey, number>>) => void;
  /** apply a patch (e.g. handle type, fill) to every module — "apply to all" scope */
  patchAllCabs: (patch: Partial<Cabinet>) => void;
  /** add a NEW module from the catalog (model/addCatalog) — auto-fits into the first
   *  free gap on a wall run (else drops free-floating); selects it; returns its id */
  /** `topBand` seats it in the topmost EXISTING wall row of the target run (height, mount and depth
   *  all adopted from it) — a catalogue template can't know any of those. */
  addCab: (cab: Partial<Cabinet>, preferredRun?: number, topBand?: boolean) => string | null;
  /** grow a module to fill the empty space beside it in its row (after a delete) */
  fillCabGap: (id: string) => void;
  /** save a customised module to the "My cabinets" reusable library (captures a thumbnail) */
  saveCab: (cabId: string, name: string) => void;
  /** remove a saved cabinet from the library */
  removeSavedCab: (id: string) => void;
  /** rename a saved cabinet in the library */
  renameSavedCab: (id: string, name: string) => void;
  /** add or overwrite a material in the shop's catalog */
  saveMaterial: (m: EmanMaterial) => void;
  /** delete a material from the catalog (a shipped one stays deleted across reloads) */
  deleteMaterial: (id: string) => void;
  /** discard every catalog edit — back to the shipped material list */
  resetMaterials: () => void;
  /** add an offcut to the workshop's stock (`group` = the board it is, from the cut plan) */
  addOffcut: (w: number, h: number, group?: string) => void;
  /** remove one offcut from stock */
  removeOffcut: (id: string) => void;
  /** remove a module from the run (best-effort — the run isn't re-flowed yet) */
  removeCab: (id: string) => void;
  /** copy a module, parked at the end of its run lane; returns the new id */
  duplicateCab: (id: string) => string | null;
  /** swap a module's TYPE for a catalog template, keeping its place (run/x or px/pz/rot),
   *  finish and id — a run-tiled module keeps its slot width so it fits the same space */
  replaceCab: (id: string, cab: Partial<Cabinet>) => void;
  // ── THE SHEET (model/grid.ts) ────────────────────────────────────────────────────────────────
  // Every one of these goes through grid.editSheet, which re-projects the modules from the new
  // track and REFUSES any edit that would put two of them in the same cell. A refused edit changes
  // nothing at all — so a border you drag too far simply stops, and there is no half-applied state
  // to repair afterwards. That is the whole difference from resizeCab() below, which mutates
  // positions directly and therefore has to be *checked*.
  /** Build this wall's sheet if it has none yet (or the room moved the wall under it). Silent:
   *  adopting an existing kitchen into a grid is a migration, not an edit, so it takes no undo step. */
  openSheet: (run: number) => void;
  /** Force the constructor into the "all" shape (a grid on every wall). Idempotent; remaps cab run
   *  indices when migrating a stored i/l/u project. Called on entering the constructor. */
  ensureAllWalls: () => void;
  /** Set column `i`'s width (mm) IN BAND `rowId`. Columns are per-band now, so a column belongs to a
   *  row: the floor band and each wall band have their own tracks. The columns beyond it in that band
   *  absorb the change, so the band's total never moves. Border drag and typed number are the same
   *  path. `live` skips the undo stack; pair it with beginCabEdit() so one gesture is one undo step. */
  gridSetColW: (run: number, rowId: string, i: number, mm: number, live?: boolean) => void;
  /** ADD a cabinet-column to band `rowId` — the "+". Appends a fresh slot on the end and equalises
   *  the whole band. Independent per band: bumping the uppers never touches the bases. */
  gridAddCol: (run: number, rowId: string) => void;
  /** DROP the last column of band `rowId` — the "−". Removes the rightmost cabinet (if any) and
   *  re-equalises the rest, so the row stays uniform. */
  gridDropCol: (run: number, rowId: string) => void;
  /** FILL A CORNER by extending the cabinet next to a 227mm reach strip INTO it (or retract it back
   *  out) — the corner reach is a fixed size, so this is a toggle, not a resize. `reachIdx` is the
   *  strip's column index in band `rowId`. Lets the last cabinet reach into the corner instead of
   *  dropping a tiny standalone unit there. */
  gridFillReach: (run: number, rowId: string, reachIdx: number) => void;
  /** ADD AN L-SHAPED CORNER CABINET to band `rowId` of wall `run` — the floating unit that turns the
   *  inside corner (deep rows have no reach strip, so the neighbour can't reach in; this is the only
   *  way to use their corner). Seats it in the corner square at the band's height/depth, matching the
   *  auto-generated corners. No-op if the band already has one or the room has no inside corner. */
  addCornerCab: (run: number, rowId: string) => void;
  /** TAP-TO-PLACE a corner: seat the armed corner template at run `run`'s inside corner, in the band
   *  of row `rowId` (floor → base/tall corner, wall → upper corner). Corners are free-standing (px/pz),
   *  so this never goes through a cell. */
  placeCornerInBand: (run: number, rowId: string, tpl?: Partial<Cabinet>) => void;
  /** Set row `j`'s height (mm) — the rows above give up what it takes, so the ceiling never moves.
   *  A void row (the backsplash, the gap under the ceiling) gives first, which is what makes
   *  "raise the wall units" eat dead wall instead of squashing the антресоль. */
  gridSetRowH: (run: number, j: number, mm: number, live?: boolean) => void;
  /** Carve a new band out of a row — how an антресоль is born: the dead strip under the ceiling
   *  becomes a row of cells you can fill. */
  gridSplitRow: (run: number, j: number, atMm: number, kind: RowKind) => void;
  /** Turn a row into one that holds modules, or back into dead wall. */
  gridSetRowKind: (run: number, j: number, kind: RowKind) => void;
  /** PUT A MODULE IN A CELL. It takes the CELL's width, height, depth and kind — you never type a
   *  dimension to add a unit, which is the entire point of the grid existing before the furniture.
   *  Returns null if the cell is taken. */
  addCabInCell: (run: number, cell: CellRef, tpl?: Partial<Cabinet>) => string | null;
  /** fill every empty cell of the selected module's ROW with a copy of it (one undo step) */
  fillWallRow: (id: string) => void;
  /** «3-й ряд» when the wall has no second upper row yet: turn the top void into a wall row AND drop
   *  the module into it, in one step. Returns the new id, or null if there's no room. */
  addCabInTopVoid: (run: number, tpl?: Partial<Cabinet>) => string | null;
  /** RESIZE A MODULE BY GRABBING ONE OF ITS FACES — the gesture the 3D offers, expressed as what it
   *  really is: a change to the COLUMN the module sits in. Grab the right face and the columns to
   *  the right absorb it; grab the left face and the column before it gives way. The neighbours
   *  visibly slide along the wall, because their x is a prefix sum of that column.
   *
   *  This is why the 3D needs no layout code of its own: dragging a face in the scene and dragging a
   *  border in the sheet are the SAME edit, and they meet here. Returns silently if the module isn't
   *  in a grid (an island, a corner unit) — those still resize the old free-form way. */
  gridSetCabW: (id: string, w: number, edge: "left" | "right", live?: boolean) => void;

  /** resize a module's width; the next module in its row absorbs the change (shifts
   *  + shrinks/grows) so the row stays tiled with no overlap */
  resizeCab: (id: string, newW: number, edge?: "left" | "right", bounds?: ResizeBounds) => void;
  /** resizeCab with NO undo entry — for the grid's border drag; pair with beginCabEdit() */
  resizeCabLive: (id: string, newW: number, edge?: "left" | "right", bounds?: ResizeBounds) => void;
  /**
   * LIFT A FLOOR MODULE OFF THE FLOOR, or set it back down (mm to the carcass bottom; null = down).
   *
   * `mountY` has always meant "the bottom of the carcass" for a wall unit; this lets a base or a
   * tall say the same thing. A lifted base is HUNG — it loses its plinth in the 3D, in the
   * elevation and in the quote, and gains the навесы that actually carry it (model/bands.ts
   * `isFloating`). This is the axis free placement was missing: the plan could put a module
   * anywhere on the floor and nothing could lift it off.
   */
  liftCab: (id: string, mm: number | null) => void;
  /** set the base-cabinet (counter) height for ALL base cabinets at once (mm) — keeps the
   *  worktop level; base bodies + worktop are driven by `c.h` in the 3D/elevation/pricing */
  setBaseHeight: (mm: number) => void;
  /** setBaseHeight with NO undo entry — for the grid's worktop drag */
  setBaseHeightLive: (mm: number) => void;
  /** re-hang EVERY wall unit on a run to a new underside height (mm) — the grid's upper-row
   *  drag; the whole row follows so the wall units stay level. No undo entry. */
  /** re-hang / resize wall units — the front sheet's row drags. `…Live` skips the undo stack
   *  (beginCabEdit already snapshotted at pointerdown, so a drag is ONE undo step). */
  setRows: (edits: RowEdit[]) => void;
  setRowsLive: (edits: RowEdit[]) => void;
  /** add a module at an EXACT free slot on a run (the grid's tap-an-empty-cell) — unlike
   *  addCab there is no first-fit search, so it lands in the cell that was tapped */
  addCabAt: (cab: Partial<Cabinet>, run: number, x: number, w: number) => string | null;
  /** Re-attach a free-placed module to a wall run at a run-local x — it becomes a real column
   *  in the sheet (neighbours absorb its resizes; it can no longer overlap). The front view
   *  calls this the moment you grab a detached module's edge. No undo entry — the gesture's
   *  beginCabEdit() already snapshotted. */
  dockCab: (id: string, run: number, x: number) => void;
  /** repair columns that ended up inside a wall's cleared corner zone (negative run-local x) —
   *  they overlap the corner unit and cannot be dragged back out. Idempotent, no undo entry. */
  healRows: () => void;
  /** batch-set module positions (x / mountY) — front-view drag reorder commit */
  moveCabsX: (updates: { id: string; x: number; mountY?: number; run?: number }[]) => void;
  /** set a module's free plan transform (px/pz centre mm, rot degrees) — 2D plan drag/rotate */
  moveCabPlan: (id: string, patch: { px?: number; pz?: number; rot?: number; cornerFace?: Pt }) => void;
  setMat: (i: number) => void;
  /** snapshot cabs before a continuous gesture (plan drag/rotate) so it's one undo step */
  beginCabEdit: () => void;
  undoCab: () => void;
  redoCab: () => void;
  /** constructor render style: realistic / translucent / wireframe */
  setMode: (m: AppState["mode"]) => void;
  flash: (msg: string) => void;
  clearToast: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openCatalog: () => void;
  closeCatalog: () => void;
  // projects — saveCurrent persists the design; withThumb=true ALSO (re)captures the
  // project card image (only done once per constructor entry, not on every auto-save)
  saveCurrent: (withThumb?: boolean) => void;
  openProject: (id: string) => void;
  newProject: () => void;
  removeProject: (id: string) => void;
  renameProject: (id: string, patch: MetaPatch) => void;
  setProjectBucket: (b: ProjectBucket) => void;
  // settings
  updateSettings: (patch: Partial<Settings>) => void;
  // auth
  openAuth: () => void; // open the login/registration screen (remembers where to return)
  closeAuth: () => void;
  dismissNudge: () => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ error?: string }>;
}

// The default design slice — shared by the store's initial state and `newProject`
// (everything `newProject` should reset; transient UI + project id live outside).
function freshDesign() {
  return {
    screen: "details" as Screen, // a new project opens on the ROOM EDITOR, not a shape picker
    qi: 0,
    quiz: {} as Record<string, string[]>,
    editing: false,
    shape: "i" as "i" | "l",
    roomPoints: roomOutlineMm("i"),
    openings: defaultOpenings(roomOutlineMm("i")),
    interiorWalls: [] as Pt[][],
    fittings: [] as Fitting[],
    wallSurfaces: {} as Record<number, Surface>,
    past: [] as RoomSnapshot[],
    future: [] as RoomSnapshot[],
    wallLen: 2400,
    ceiling: 2700,
    reveal: 0, // «Добор у стен» OFF by default — most kitchens tile wall-to-wall; the seller opts in
    // Both ON by default, because both are what a kitchen built in the last five years looks like:
    // a стеновая панель rather than bare wall behind the counter, and no dead strip under the
    // ceiling. A shop that tiles its splashbacks turns the first one off in «Отделка».
    splash: DEFAULT_SPLASH as SplashSpec,
    closer: DEFAULT_CLOSER as CloserSpec,
    underside: DEFAULT_UNDERSIDE as UndersideSpec,
    led: DEFAULT_LED as LedSpec,

    water: "left" as AppState["water"],
    waterWall: null as number | null,
    constraints: [] as string[],
    roomName: "Kitchen",
    roomType: "Кухня",
    floorCovering: 0,
    variant: 0,
    genVariants: [] as GenVariant[],
    cabs: [] as Cabinet[],
    cabsFrom: -1,
    selIdx: -1,
    selIds: [] as string[],
    grids: {} as Grids, // built on first sight of a wall (sheet.ensureSheet)
    cabsPast: [] as CabSnap[],
    cabsFuture: [] as CabSnap[],
    runLayout: "i" as KitchenLayout,
    runStyle: DEFAULT_RUN_STYLE,
    view: "front" as AppState["view"],
    mat: 0,
    mode: "real" as AppState["mode"],
    xray: true,
    hardened: false,
    hwGrade: "std" as HwGrade,
    recFixed: false,
    adviceApplied: false,
    exported: false,
  };
}

let profileTimer: ReturnType<typeof setTimeout> | undefined; // debounces the profile cloud push

// one-time soft login nudge (shown once after a guest saves their first project)
const NUDGE_KEY = "mebelchi.nudged.v1";
const nudged = () => { try { return !!localStorage.getItem(NUDGE_KEY); } catch { return true; } };

// Track a cloud write for the sync indicator: bump busy, then clear + flip error on result.
function trackSync(p: Promise<unknown>): void {
  useStore.setState((s) => ({ syncBusy: s.syncBusy + 1 }));
  const done = (error: boolean) =>
    useStore.setState((s) => ({ syncBusy: Math.max(0, s.syncBusy - 1), syncError: error }));
  p.then(() => done(false), () => done(true));
}

export const useStore = create<AppState>((set, get) => ({
  ...freshDesign(),
  toast: null,
  // an editing MODE, not part of the design — never persisted, off at the start of every session
  menuOpen: false,
  settingsOpen: false,
  catalogOpen: false,
  pendingWater: false,
  currentProjectId: null,
  projectsRev: 0,
  projectBucket: "all",
  savedCabsRev: 0,
  catalogRev: 0,
  offcutsRev: 0,
  settings: loadSettings(),
  constructionRev: 0,
  // if Supabase isn't configured, auth is skipped (app runs on localStorage)
  authReady: !isSupabaseConfigured,
  authUser: null,
  recovery: false,
  authReturn: "home",
  loginNudge: false,
  syncBusy: 0,
  syncError: false,
  screen: "home", // guest-first: launch on the home hub (freshDesign's "quiz" is for New project)

  pickQuiz: (id, v) =>
    set((s) => {
      if (id === "layout") {
        // multi-select kitchen layout; the variants explore each chosen layout.
        // Room shape stays a rectangle unless the ONLY choice is L (then an
        // L-shaped room); a rectangle hosts every layout (incl. an L-run).
        const cur = s.quiz.layout ?? [];
        const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
        const sel = next.length ? next : [v];
        const shape: "i" | "l" = sel.length === 1 && sel[0] === "l" ? "l" : "i";
        const roomChanged = shape !== s.shape;
        return {
          quiz: { ...s.quiz, layout: sel },
          ...(roomChanged
            ? {
                shape,
                roomPoints: roomOutlineMm(shape),
                openings: defaultOpenings(roomOutlineMm(shape)),
                interiorWalls: [],
                fittings: [],
                wallSurfaces: {},
                waterWall: null,
                past: [],
                future: [],
              }
            : {}),
        };
      }
      const multi = QUIZ.find((q) => q.id === id)?.multi;
      const cur = s.quiz[id] ?? [];
      if (multi) {
        const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
        return { quiz: { ...s.quiz, [id]: next } };
      }
      return { quiz: { ...s.quiz, [id]: [v] } };
    }),

  next: () => {
    const s = get();
    switch (s.screen) {
      case "details":
        set({ screen: "variants" });
        break;
      case "variants": {
        const chosen = s.genVariants[s.variant];
        if (!chosen) return; // nothing generated yet — CTA is disabled anyway
        // commit the chosen layout + finish to the editable run on the way into the
        // constructor; re-commit only when the selection changed so edits survive
        if (s.cabsFrom !== s.variant) {
          // Commit the variant EXACTLY as solved — same layout, same run indices, so nothing re-anchors
          // or shifts on the way in. (An earlier remap to an "all-walls" shape is what moved cabinets.)
          set({ cabs: chosen.cabs.map((c) => ({ ...c })), cabsFrom: s.variant, selIdx: 0, runLayout: chosen.layout, runStyle: chosen.style, cabsPast: [], cabsFuture: [] });
        }
        set({ screen: "configure" });
        break;
      }
      case "configure":
        set({ screen: "preview" }); // → «Рендер»
        break;
      case "preview":
        set({ screen: "engineering" });
        break;
      case "engineering":
        // skip the Смета step entirely when the seller has pricing turned off
        set({ screen: s.settings.showPricing ? "cost" : "handoff" });
        break;
      case "cost":
        set({ screen: "handoff" });
        break;
      case "handoff":
        // actually run the export/share (send SWJ008 + DXF + CSV to production) — not just
        // flip a flag. Re-runnable, so a second tap shares again instead of doing nothing.
        // only stamp the deal "exported" when files actually went out — the handoff screen refuses
        // when a module is drawn too small for its own hardware (model/minSize.ts)
        if (runExport() && !s.exported) set({ exported: true });
        break;
    }
  },

  back: () => {
    const s = get();
    // the Смета step drops out of the journey when pricing is off — so "back" from Передача
    // returns to Инженерия, not an unreachable price screen
    const flow = FLOW.filter((sc) => sc !== "cost" || s.settings.showPricing);
    const i = flow.indexOf(s.screen);
    if (i > 0) set({ screen: flow[i - 1] });
    // the room editor is the FIRST journey step now (the shape picker is gone) — so its ← has no
    // previous step; leave to the home hub instead of being a dead button. goTo saves on the way out.
    else if (i === 0) get().goTo("home");
  },

  goTo: (screen) => {
    const s = get();
    const toList = screen === "home"; // home IS the project list now
    const fromMenu = s.screen === "home" || s.screen === "settings" || s.screen === "auth";
    const hasContent = s.cabs.length > 0 || Object.keys(s.quiz).length > 0;
    // leaving a design screen for the project list → flush a save NOW, while the 3D scene
    // is still mounted, so the card gets a freshly captured thumbnail (the debounced
    // auto-save would otherwise fire 30s later, after the scene is gone). Bump projectsRev
    // so the list re-reads the new thumbnail.
    if (toList && !fromMenu && hasContent) {
      s.saveCurrent();
      set((st) => ({ screen, projectsRev: st.projectsRev + 1 }));
    } else {
      set({ screen });
    }
  },
  requestWater: () => set({ pendingWater: true, screen: "details" }),
  clearPendingWater: () => set({ pendingWater: false }),

  setShape: (shape) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      shape,
      roomPoints: roomOutlineMm(shape),
      openings: defaultOpenings(roomOutlineMm(shape)),
      interiorWalls: [],
      fittings: [],
      wallSurfaces: {},
      waterWall: null,
    })),
  setWater: (water) => set({ water }),
  toggleConstraint: (c) =>
    set((s) => ({
      constraints: s.constraints.includes(c)
        ? s.constraints.filter((x) => x !== c)
        : [...s.constraints, c],
    })),
  setWall: (d) =>
    set((s) => ({ wallLen: Math.min(4000, Math.max(1200, s.wallLen + d)) })),
  setCeiling: (d) =>
    set((s) => ({ ceiling: Math.min(4000, Math.max(2000, s.ceiling + d)) })),
  setCeilingValue: (val) =>
    set({ ceiling: Math.min(4000, Math.max(2000, Math.round(val))) }),
  // clear the sheets so the reserved dead zones (which now include the reveal) rebuild against the
  // new width; the 3D/front views re-read `reveal` from the room and redraw the panels.
  setReveal: (mm) => set({ reveal: Math.max(0, Math.min(120, Math.round(mm))), grids: {} }),
  // No `grids: {}` on either of these: a panel occupies no CELL. It fills the dead space the sheet
  // already leaves empty (the void row, the strip under the ceiling), which is exactly why it can be
  // switched on and off without disturbing a single module.
  setSplash: (patch) =>
    set((st) => ({
      splash: {
        ...st.splash,
        ...patch,
        h: patch.h == null ? st.splash.h : Math.max(100, Math.min(1200, Math.round(patch.h))),
        t: patch.t == null ? st.splash.t : Math.max(3, Math.min(40, Math.round(patch.t))),
      },
    })),
  setCloser: (patch) =>
    set((st) => ({
      closer: {
        ...st.closer,
        ...patch,
        maxGap: patch.maxGap == null ? st.closer.maxGap : Math.max(0, Math.min(1200, Math.round(patch.maxGap))),
        t: patch.t == null ? st.closer.t : Math.max(3, Math.min(40, Math.round(patch.t))),
      },
    })),
  setUnderside: (patch) =>
    set((st) => ({
      underside: {
        ...st.underside,
        ...patch,
        t: patch.t == null ? st.underside.t : Math.max(3, Math.min(40, Math.round(patch.t))),
      },
    })),
  setLed: (patch) => set((st) => ({ led: { ...st.led, ...patch } })),
  setGrain: (horizontal) => set((st) => ({ runStyle: { ...st.runStyle, grainHorizontal: horizontal } })),
  setCornerDoors: (v) =>
    set((st) => ({
      ...cabHist(st),
      runStyle: { ...st.runStyle, cornerDoors: v },
      // a module that was told individually keeps its own answer; the rest follow the shop
      cabs: st.cabs.map((c) => (c.corner ? { ...c, cornerDoors: undefined } : c)),
    })),
  setRoomName: (roomName) => set({ roomName }),
  setRoomType: (roomType) => set({ roomType }),
  setFloorCovering: (floorCovering) => set({ floorCovering }),
  setHardened: (hardened) => set({ hardened }),
  setHwGrade: (hwGrade) => set({ hwGrade }),

  // snapshot the room before a continuous gesture so it's one undo step
  beginEdit: () => set((s) => ({ past: [...s.past.slice(-49), snapshot(s)], future: [] })),
  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      const prev = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), future: [...s.future, snapshot(s)], ...prev };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const nxt = s.future[s.future.length - 1];
      return { future: s.future.slice(0, -1), past: [...s.past, snapshot(s)], ...nxt };
    }),

  moveCorner: (i, x, y) =>
    set((s) => {
      const p = s.roomPoints.slice();
      p[i] = { x: snap100(x), y: snap100(y) };
      return { roomPoints: p };
    }),

  // move a whole wall (both endpoints) — used for edge dragging
  setWallEndpoints: (i, a, b) =>
    set((s) => {
      const n = s.roomPoints.length;
      const p = s.roomPoints.slice();
      p[i] = { x: snap100(a.x), y: snap100(a.y) };
      p[(i + 1) % n] = { x: snap100(b.x), y: snap100(b.y) };
      return { roomPoints: p };
    }),

  // resize wall `i` (points[i]→points[i+1]) to `length`, moving endpoint a or b
  setWallLength: (i, length, endpoint) =>
    set((s) => {
      const n = s.roomPoints.length;
      const a = s.roomPoints[i];
      const b = s.roomPoints[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const p = s.roomPoints.slice();
      if (endpoint === "b") {
        p[(i + 1) % n] = { x: snap100(a.x + ux * length), y: snap100(a.y + uy * length) };
      } else {
        p[i] = { x: snap100(b.x - ux * length), y: snap100(b.y - uy * length) };
      }
      return { roomPoints: p }; // history handled by the caller (beginEdit)
    }),

  // WIDTH = the length of edge 0 (p0→p1); DEPTH = the length of edge 1 (p1→p2). Both slide the FAR edge
  // (its two corners together) along that edge's direction, so a rectangle stays a rectangle — the near
  // corners (p0, and its neighbour on that axis) hold still. Only meaningful for a 4-corner room.
  setRoomWidth: (mm) =>
    set((s) => {
      const p = s.roomPoints;
      if (p.length !== 4) return {};
      const len = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) || 1;
      const ux = (p[1].x - p[0].x) / len, uy = (p[1].y - p[0].y) / len;
      const w = Math.max(1000, Math.round(mm));
      const np = p.slice();
      np[1] = { x: Math.round(p[0].x + ux * w), y: Math.round(p[0].y + uy * w) };
      np[2] = { x: Math.round(p[3].x + ux * w), y: Math.round(p[3].y + uy * w) };
      return { roomPoints: np };
    }),
  setRoomDepth: (mm) =>
    set((s) => {
      const p = s.roomPoints;
      if (p.length !== 4) return {};
      const len = Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y) || 1;
      const vx = (p[2].x - p[1].x) / len, vy = (p[2].y - p[1].y) / len;
      const d = Math.max(1000, Math.round(mm));
      const np = p.slice();
      np[3] = { x: Math.round(p[0].x + vx * d), y: Math.round(p[0].y + vy * d) };
      np[2] = { x: Math.round(p[1].x + vx * d), y: Math.round(p[1].y + vy * d) };
      return { roomPoints: np };
    }),

  // slide an opening along its wall segment (clamped so it stays on the wall)
  moveOpening: (id, t) =>
    set((s) => {
      const op = s.openings.find((o) => o.id === id);
      if (!op) return {};
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[op.wall];
      if (!seg) return {};
      const wl = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1;
      const margin = (op.width / 2 + 60) / wl;
      const ct = Math.max(margin, Math.min(1 - margin, t));
      return { openings: s.openings.map((o) => (o.id === id ? { ...o, t: ct } : o)) };
    }),

  // drag an opening to whichever wall segment (room or drawn) is nearest, clamped onto it
  dragOpeningTo: (id, x, y) =>
    set((s) => {
      const op = s.openings.find((o) => o.id === id);
      if (!op) return {};
      const segs = wallSegments(s.roomPoints, s.interiorWalls);
      let best = { wall: op.wall, t: 0.5, d: Infinity };
      for (let i = 0; i < segs.length; i++) {
        const { a, b } = segs[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        if (l2 < 1) continue; // ignore degenerate (e.g. loop-closing) segments
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
        const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
        if (d < best.d) best = { wall: i, t, d };
      }
      const seg = segs[best.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 1;
      const margin = (op.width / 2 + 60) / wl;
      const ct = Math.max(margin, Math.min(1 - margin, best.t));
      return { openings: s.openings.map((o) => (o.id === id ? { ...o, wall: best.wall, t: ct } : o)) };
    }),

  setOpeningWidth: (id, width) =>
    set((s) => {
      const op = s.openings.find((o) => o.id === id);
      if (!op) return {};
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[op.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 4000;
      const w = Math.max(300, Math.min(wl - 200, snap100(width)));
      return { openings: s.openings.map((o) => (o.id === id ? { ...o, width: w } : o)) };
    }),
  setOpeningHeight: (id, height) =>
    set((s) => ({
      openings: s.openings.map((o) => (o.id === id ? { ...o, height: Math.max(300, Math.min(3000, snap100(height))) } : o)),
    })),
  // window sill — bottom above floor (mm), clamped to leave room under the ceiling
  setOpeningSill: (id, sill) =>
    set((s) => ({
      openings: s.openings.map((o) => (o.id === id ? { ...o, sill: Math.max(0, Math.min(s.ceiling - 300, snap100(sill))) } : o)),
    })),
  // window-frame / door-leaf finish (colour or wood) — see OPENING_FINISHES
  setOpeningFinish: (id, finish) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      openings: s.openings.map((o) => (o.id === id ? { ...o, finish } : o)),
    })),
  // add a window / door / wall-opening from a catalog; seeds on the longest wall
  addOpening: (item, wall) => {
    const id = wallItemId("o");
    set((s) => {
      const n = s.roomPoints.length;
      let w = wall ?? 0;
      if (wall == null) {
        let best = -1;
        for (let i = 0; i < n; i++) {
          const a = s.roomPoints[i];
          const b = s.roomPoints[(i + 1) % n];
          const l = Math.hypot(b.x - a.x, b.y - a.y);
          if (l > best) {
            best = l;
            w = i;
          }
        }
      }
      const op: Opening = { id, wall: Math.min(w, n - 1), kind: item.kind, t: 0.5, width: item.width, height: item.height ?? defaultOpeningHeight(item.kind), design: item.design, name: item.name, desc: item.desc };
      return { past: [...s.past.slice(-49), snapshot(s)], future: [], openings: [...s.openings, op] };
    });
    return id;
  },
  removeOpening: (id) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      openings: s.openings.filter((o) => o.id !== id),
    })),
  duplicateOpening: (id) => {
    const src = get().openings.find((o) => o.id === id);
    if (!src) return null;
    const nid = wallItemId("o");
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      openings: [...s.openings, { ...src, id: nid, t: Math.min(0.9, src.t + 0.12) }],
    }));
    return nid;
  },
  replaceOpening: (id, item) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      openings: s.openings.map((o) =>
        o.id === id ? { ...o, kind: item.kind, width: item.width, height: item.height ?? defaultOpeningHeight(item.kind), design: item.design, name: item.name, desc: item.desc } : o,
      ),
    })),
  flipOpening: (id) =>
    set((s) => ({ openings: s.openings.map((o) => (o.id === id ? { ...o, flip: !o.flip } : o)) })),

  addInteriorWall: (poly) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      interiorWalls: [...s.interiorWalls, poly.map((p) => ({ x: snap100(p.x), y: snap100(p.y) }))],
    })),
  moveInteriorPoint: (wi, pi, x, y) =>
    set((s) => ({
      interiorWalls: s.interiorWalls.map((w, i) =>
        i === wi ? w.map((p, j) => (j === pi ? { x: snap100(x), y: snap100(y) } : p)) : w,
      ),
    })),
  // resize a drawn segment by moving its far endpoint along the segment direction
  setInteriorWallLength: (globalSeg, length) =>
    set((s) => {
      const ref = interiorSegRef(s.roomPoints, s.interiorWalls, globalSeg);
      if (!ref) return {};
      const poly = s.interiorWalls[ref.wall];
      const a = poly[ref.seg];
      const b = poly[ref.seg + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nb = { x: snap100(a.x + ((b.x - a.x) / len) * length), y: snap100(a.y + ((b.y - a.y) / len) * length) };
      return {
        interiorWalls: s.interiorWalls.map((w, i) => (i === ref.wall ? w.map((p, j) => (j === ref.seg + 1 ? nb : p)) : w)),
      }; // history handled by the caller (beginEdit)
    }),

  // ---- wall paint / surfaces ----
  setWallColor: (wall, c) => set((s) => ({ wallSurfaces: { ...s.wallSurfaces, [wall]: { t: "leaf", c } } })),
  setAllWallsColor: (c) =>
    set((s) => {
      const next: Record<number, Surface> = {};
      for (let i = 0; i < s.roomPoints.length; i++) next[i] = { t: "leaf", c };
      return { wallSurfaces: next };
    }),
  splitWallSurface: (wall, path, dir) =>
    set((s) => ({ wallSurfaces: { ...s.wallSurfaces, [wall]: splitLeaf(s.wallSurfaces[wall] ?? defaultSurface(), path, dir) } })),
  colorWallSurface: (wall, path, c) =>
    set((s) => ({ wallSurfaces: { ...s.wallSurfaces, [wall]: colorLeaf(s.wallSurfaces[wall] ?? defaultSurface(), path, c) } })),

  // ---- wall fittings (electric / heating / vent) ----
  addFitting: (category, kind, wall = 0) => {
    const k = fittingKind(category, kind);
    const id = wallItemId("f");
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      fittings: [...s.fittings, { id, category, wall: Math.min(wall, s.roomPoints.length - 1), t: 0.5, width: k?.width ?? 120, kind }],
    }));
    return id;
  },
  // slide along (or hop to) whichever wall segment (room or drawn) is nearest
  dragFittingTo: (id, x, y) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const segs = wallSegments(s.roomPoints, s.interiorWalls);
      let best = { wall: it.wall, t: 0.5, d: Infinity };
      for (let i = 0; i < segs.length; i++) {
        const { a, b } = segs[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        if (l2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
        const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
        if (d < best.d) best = { wall: i, t, d };
      }
      const seg = segs[best.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 1;
      const margin = (it.width / 2 + 40) / wl;
      const ct = Math.max(margin, Math.min(1 - margin, best.t));
      return { fittings: s.fittings.map((e) => (e.id === id ? { ...e, wall: best.wall, t: ct } : e)) };
    }),
  // slide a fitting along its current wall segment (clamped)
  moveFitting: (id, t) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[it.wall];
      if (!seg) return {};
      const wl = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1;
      const margin = (it.width / 2 + 40) / wl;
      const ct = Math.max(margin, Math.min(1 - margin, t));
      return { fittings: s.fittings.map((e) => (e.id === id ? { ...e, t: ct } : e)) };
    }),
  setFittingWidth: (id, width) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[it.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 4000;
      // NOT snapped to 100: a socket is 90 and a pipe is Ø32 or Ø110, and rounding either to the
      // nearest 100 makes the фартук's hole and the carcass's notch the wrong size. The floor is
      // the narrowest thing worth drawing rather than the narrowest socket.
      const w = Math.max(20, Math.min(wl - 200, Math.round(width)));
      return { fittings: s.fittings.map((e) => (e.id === id ? { ...e, width: w } : e)) };
    }),
  // NOT snapped to 100, and the floor is 20mm — same reasoning as setFittingWidth: this number is
  // a pipe's diameter as often as it is a radiator's height, and Ø32 must not round to 0.
  setFittingHeight: (id, height) =>
    set((s) => ({
      fittings: s.fittings.map((e) => (e.id === id ? { ...e, height: Math.max(20, Math.min(4000, Math.round(height))) } : e)),
    })),
  // TURNING A PIPE turns its PATH — a quarter turn about the run's own centre, so an L stays an L
  // and simply faces the other way. It used to swap `width`/`height`, which said nothing about a
  // path and could not turn a bend at all.
  setFittingOrient: (id, orient) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it || (it.orient ?? "v") === orient) return {};
      const pts = pipePathOf(it, wallLenOf(s, it.wall));
      const ca = pts.reduce((n, p) => n + p.a, 0) / pts.length;
      const cy = pts.reduce((n, p) => n + p.y, 0) / pts.length;
      const turned = pts.map((p) => ({
        a: Math.round(ca + (p.y - cy)),
        y: Math.max(0, Math.min(s.ceiling, Math.round(cy - (p.a - ca)))),
      }));
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, orient, path: turned } : e)),
      };
    }),
  setFittingAlong: (id, mm) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[it.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 4000;
      const t = Math.max(0, Math.min(1, Math.round(mm) / wl));
      return { fittings: s.fittings.map((e) => (e.id === id ? { ...e, t } : e)) };
    }),
  setFittingMountY: (id, mm) =>
    set((s) => ({
      fittings: s.fittings.map((e) => (e.id === id ? { ...e, mountY: Math.max(0, Math.min(s.ceiling, Math.round(mm))) } : e)),
    })),
  // ── A PIPE'S PATH ────────────────────────────────────────────────────────────────────────────
  // Every edit resolves the path FIRST (`pipePathOf`), so a pipe placed before paths existed turns
  // into one the moment you touch it rather than needing a migration.
  setPipePoint: (id, i, a, y, live = false) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const pts = [...pipePathOf(it, wallLenOf(s, it.wall))];
      if (i < 0 || i >= pts.length) return {};
      pts[i] = { a: Math.round(a), y: Math.max(0, Math.min(s.ceiling, Math.round(y))) };
      return {
        ...(live ? {} : { past: [...s.past.slice(-49), snapshot(s)], future: [] }),
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, path: pts } : e)),
      };
    }),
  addPipeBend: (id, i) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const pts = [...pipePathOf(it, wallLenOf(s, it.wall))];
      if (i < 0 || i >= pts.length - 1) return {};
      const mid = { a: Math.round((pts[i].a + pts[i + 1].a) / 2), y: Math.round((pts[i].y + pts[i + 1].y) / 2) };
      pts.splice(i + 1, 0, mid);
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, path: pts } : e)),
      };
    }),
  removePipeBend: (id, i) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const pts = pipePathOf(it, wallLenOf(s, it.wall));
      if (pts.length <= 2 || i <= 0 || i >= pts.length - 1) return {}; // a pipe needs two ends
      const next = pts.filter((_, k) => k !== i);
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, path: next } : e)),
      };
    }),
  setPipePath: (id, pts) =>
    set((s) => {
      if (pts.length < 2) return {};
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, path: pts.map((p) => ({ a: Math.round(p.a), y: Math.round(p.y) })) } : e)),
      };
    }),
  // 3D drag: hop to whichever wall segment is nearest (x,y in mm), set along + height
  dragFitting3D: (id, x, y, heightMm) =>
    set((s) => {
      const it = s.fittings.find((e) => e.id === id);
      if (!it) return {};
      const segs = wallSegments(s.roomPoints, s.interiorWalls);
      let best = { wall: it.wall, t: 0.5, d: Infinity };
      for (let i = 0; i < segs.length; i++) {
        const { a, b } = segs[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        if (l2 < 1) continue;
        const tt = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
        const dd = Math.hypot(x - (a.x + dx * tt), y - (a.y + dy * tt));
        if (dd < best.d) best = { wall: i, t: tt, d: dd };
      }
      const seg = segs[best.wall];
      const wl = seg ? Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1 : 1;
      const margin = (it.width / 2 + 40) / wl;
      const ct = Math.max(margin, Math.min(1 - margin, best.t));
      const mountY = Math.max(80, Math.min(3200, Math.round(heightMm)));
      return { fittings: s.fittings.map((e) => (e.id === id ? { ...e, wall: best.wall, t: ct, mountY } : e)) };
    }),
  removeFitting: (id) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      fittings: s.fittings.filter((e) => e.id !== id),
    })),
  duplicateFitting: (id) => {
    const src = get().fittings.find((e) => e.id === id);
    if (!src) return null;
    const nid = wallItemId("f");
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      fittings: [...s.fittings, { ...src, id: nid, t: Math.min(0.9, src.t + 0.12) }],
    }));
    return nid;
  },
  replaceFitting: (id, category, kind) =>
    set((s) => {
      const k = fittingKind(category, kind);
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        fittings: s.fittings.map((e) => (e.id === id ? { ...e, category, kind, width: k?.width ?? e.width } : e)),
      };
    }),

  // ---- water supply: pick the wall it enters from; also derive the legacy
  // left/center/right marker so the plan + project stay consistent ----
  setWaterWall: (i) =>
    set((s) => {
      if (i == null) return { waterWall: null, water: "none" };
      const seg = wallSegments(s.roomPoints, s.interiorWalls)[i];
      if (!seg) return { waterWall: i, water: "center" };
      const mx = (seg.a.x + seg.b.x) / 2;
      const xs = s.roomPoints.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const f = (mx - minX) / (maxX - minX || 1);
      const water = f < 0.34 ? "left" : f > 0.66 ? "right" : "center";
      return { waterWall: i, water };
    }),

  // ---- phase B: generate the four layout variants from the current space ----
  // Geometry lives here (we have roomPoints/openings + helpers); the solver itself
  // is a pure function fed clean primitives. The water gate is enforced by the
  // screen before this runs, so `water` is always a real side by now.
  generateVariants: () =>
    set((s) => {
      const water: Zone = s.water === "none" ? "center" : s.water;
      // plan the runs for each SELECTED layout (the planner handles water-wall
      // priority, door avoidance, corners, island/peninsula); the solver spreads
      // these layouts across the variants
      const LAYOUTS = ["i", "galley", "l", "u", "peninsula"];
      const chosen = (s.quiz.layout ?? []).filter((v): v is KitchenLayout => LAYOUTS.includes(v));
      // No layout picked → ASK THE ROOM. The shape is mostly decided by the polygon the user drew
      // (you can't put a U in a corridor), and it used to fall back to a bare "i" regardless. Take
      // the two roomiest shapes that fit, so the variants span two real layouts instead of one.
      const fit = chosen.length ? chosen : candidateLayouts(s.roomPoints, s.waterWall, s.openings).slice(0, 2);
      const layouts = fit.map((lay) => {
        const { runs, waterRun } = planRuns(s.roomPoints, s.waterWall, lay, s.openings, undefined, s.reveal);
        return { layout: lay, runs: runs.map((r) => ({ kind: r.kind, len: r.len, cornerStart: r.cornerStart, cornerEnd: r.cornerEnd, openings: r.openings })), waterRun };
      });
      // the user's selected option SET per appliance dimension (multi-select → the
      // variants explore each choice); fall back to a sensible default when unanswered
      const sel = <T extends string>(id: string, map: (v: string) => T | null, fallback: T): T[] => {
        const vals = (s.quiz[id] ?? []).map(map).filter((x): x is T => x != null);
        return vals.length ? Array.from(new Set(vals)) : [fallback];
      };
      // Defaults for anything the user hasn't answered. They matter more than they used to: the
      // quiz is no longer a gate, so MOST kitchens are generated from these. They're set to what a
      // custom kitchen actually is — integrated fridge, oven in a tower — not to the cheapest box.
      const fridge = sel<FridgeType>("fridge", (v) => (v === "integ" ? "integ" : v === "free" ? "free" : null), "integ");
      const oven = sel<OvenType>("oven", (v) => (v === "tall" ? "tall" : v === "under" ? "under" : null), "tall");
      const hood = sel<HoodType>("hood", (v) => (v === "dome" ? "dome" : v === "integ" ? "integ" : null), "integ");
      // the wall band is an OVERRIDE, not a default: unpicked → each strategy keeps its own, so the
      // four variants show a standard wall, a full-height one and an antresol side by side
      const WALLS = ["single", "tall", "antresol", "antresolDeep"];
      const wall = (s.quiz.wall ?? []).filter((v): v is WallBand => WALLS.includes(v));
      // the front's body — same override rules as the wall band (unpicked → the strategies' own mix)
      const FRONTS = ["flat", "shaker", "raised", "fluted", "glass", "grid"];
      const front = (s.quiz.front ?? []).filter((v): v is FrontProfile => FRONTS.includes(v));
      const genVariants = solveVariants({
        layouts,
        ceiling: s.ceiling,
        reveal: s.reveal,
        water,
        hasGas: s.constraints.includes("Газовая труба"),
        fridge,
        oven,
        hood,
        wall,
        front,
      });
      // Inject a corner unit into every inside corner the runs cleared — an L has one, a U has two.
      //
      // ONE PER WALL BAND, not one in total. This used to add exactly one base + one upper corner
      // (hardcoded 840/613, `h: 720`, no mountY), so a kitchen with an antresol had a hole in its
      // corner on the top row. `gv.bands` is what the generator actually built, so the corners land
      // at the right height, height and DEPTH without re-deriving the banding here.
      //
      // The square follows the arm depth: a 350-deep wall row gets 613, a base-depth one gets 840.
      const withCorners = genVariants.map((gv) => {
        if (gv.layout !== "l" && gv.layout !== "u") return gv;
        const seatsFor = (side: number) => cornerUnits(s.roomPoints, s.waterWall, gv.layout, s.openings, side);
        const baseSide = cornerSideFor(FOOT_DEPTH_MM.base);
        const baseCorner = seatsFor(baseSide);
        if (!baseCorner.length) return gv;

        const corners: Cabinet[] = baseCorner.map((cs) =>
          mk({ kind: "base", corner: true, px: cs.px, pz: cs.pz, rot: cs.rot, w: cs.w, depth: cs.depth, armDepth: FOOT_DEPTH_MM.base, h: 720, fill: "shelves", count: 1, door: 0, handle: 0, run: 0 }),
        );
        for (const b of gv.bands) {
          for (const cs of seatsFor(cornerSideFor(b.depth))) {
            corners.push(
              mk({ kind: "upper", corner: true, px: cs.px, pz: cs.pz, rot: cs.rot, w: cs.w, depth: cs.depth, armDepth: b.depth, h: b.h, mountY: b.mountY, fill: "shelves", count: 1, door: 0, handle: 0, run: 0 }),
            );
          }
        }
        return { ...gv, cabs: [...gv.cabs, ...corners] };
      });
      // back a cabinet row against every wall the user DREW inside the room — placed free
      // (px/pz/rot) so it renders through the existing free-placement path; added to every
      // variant so a drawn wall is never ignored by the furniture generation
      const wallCabs = interiorWallCabs(s.roomPoints, s.interiorWalls);
      const withWalls = wallCabs.length
        ? withCorners.map((gv) => {
            // build the wall modules, then DROP any that clash with an existing same-layer
            // module (perimeter run / corner) or an already-accepted wall module — so a row
            // backed against a drawn wall never triggers the red overlap warning
            const objs = wallCabs.map((c) => mk({ kind: c.kind, px: c.px, pz: c.pz, rot: c.rot, w: c.w, depth: c.depth, h: 720, fill: "shelves", count: 2, door: 0, handle: 0 }));
            const foots = [...cabFootprints(gv.cabs, s.roomPoints, s.waterWall, gv.layout, s.openings, s.reveal)];
            const wallFoots = cabFootprints(objs, s.roomPoints, s.waterWall, gv.layout, s.openings, s.reveal);
            const keep: typeof objs = [];
            objs.forEach((cab, i) => {
              const f = wallFoots[i];
              if (f && !foots.some((o) => footsClash(o, f))) {
                keep.push(cab);
                foots.push(f);
              }
            });
            return { ...gv, cabs: [...gv.cabs, ...keep] };
          })
        : withCorners;
      // fresh layouts → force a re-commit on the way into the constructor
      return { genVariants: withWalls, variant: 0, cabsFrom: -1 };
    }),
  selectVariant: (i) => set({ variant: i }),
  startBlank: () =>
    set((s) => {
      // «С нуля» = build on any wall, in any shape, without being pre-committed to one. So it opens in
      // the "all" shape — EVERY wall is its own fillable run — instead of a fixed i/l/u picked before a
      // single cabinet is placed. Corner zones are DYNAMIC in "all": a wall stays fully fillable until
      // you drop a corner cabinet turning it, at which point that vertex's two walls reserve their
      // square (activeCorners). That is what lets you fill one wall, change the last unit to a corner,
      // and have the neighbouring wall's grid pick up from there — the "walk the walls" flow.
      return {
        cabs: [],
        grids: {}, // ensureSheet builds a fresh default grid per wall the moment the constructor opens
        // match next()'s "already committed this variant" guard, so stepping BACK to the options and
        // forward again doesn't silently overwrite the blank start with a generated layout
        cabsFrom: s.variant,
        selIdx: 0,
        runLayout: "all" as KitchenLayout,
        runStyle: DEFAULT_RUN_STYLE,
        cabsPast: [],
        cabsFuture: [],
        screen: "configure" as const,
      };
    }),

  // ---- phase C: constructor (per-module editing) ----
  selectCab: (i) => set({ selIdx: i }),
  selectOnly: (id) =>
    set((s) => ({ selIds: [id], selIdx: s.cabs.findIndex((c) => c.id === id) })),
  selectMany: (ids) =>
    set((s) => ({ selIds: ids, selIdx: ids.length ? s.cabs.findIndex((c) => c.id === ids[ids.length - 1]) : -1 })),
  clearSel: () => set({ selIds: [], selIdx: -1 }),
  toggleSelId: (id) =>
    set((s) => {
      const selIds = s.selIds.includes(id) ? s.selIds.filter((x) => x !== id) : [...s.selIds, id];
      const primary = selIds[selIds.length - 1]; // the last-tapped member drives single-value readouts
      return { selIds, selIdx: primary ? s.cabs.findIndex((c) => c.id === primary) : -1 };
    }),
  applyToSelected: (patch) =>
    set((s) => {
      const ids = new Set(s.selIds);
      if (!ids.size) return {};
      let changed = false;
      const next = s.cabs.map((c) => {
        if (!ids.has(c.id)) return c;
        let diff = false;
        for (const k in patch) {
          if ((c as any)[k] !== (patch as any)[k]) { diff = true; break; }
        }
        if (!diff) return c;
        changed = true;
        return { ...c, ...patch };
      });
      if (!changed) return {};
      return { ...cabHist(s), cabs: next };
    }),
  applyFinishToSelected: (finish) =>
    set((s) => {
      const ids = new Set(s.selIds);
      if (!ids.size) return {};
      return { ...cabHist(s), cabs: s.cabs.map((c) => (ids.has(c.id) ? { ...c, finish: { ...c.finish, ...finish } } : c)) };
    }),
  resizeSelectedWidth: (mm) =>
    set((s) => {
      const ids = new Set(s.selIds);
      const picked = s.cabs.filter((c) => ids.has(c.id) && c.cell && c.px == null);
      if (!picked.length) return {};
      const run = picked[0].run ?? 0;
      if (picked.some((c) => (c.run ?? 0) !== run)) return {}; // all on ONE wall
      const g = s.grids[run];
      if (!g) return {};
      const locs = picked.map((c) => ({ c, loc: locate(g, c.cell!) }));
      if (locs.some((l) => l.loc.j < 0 || l.loc.i < 0)) return {};
      const j = locs[0].loc.j;
      if (locs.some((l) => l.loc.j !== j)) return {}; // all in ONE band
      // the members must tile a CONTIGUOUS column range [i0..i1] — no gaps, no non-selected cells
      const ranges = locs
        .map((l) => [l.loc.i, l.loc.i + (l.c.cell!.cs ?? 1) - 1] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      let i0 = ranges[0][0];
      let i1 = ranges[0][1];
      for (let k = 1; k < ranges.length; k++) {
        if (ranges[k][0] !== i1 + 1) return {}; // gap / overlap → not a clean group
        i1 = ranges[k][1];
      }
      const next = resizeSpan(g, j, i0, i1, mm);
      if (!next) return {};
      const res = editSheet(s.cabs, next);
      if (!res) return {};
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
    }),
  resizeSelectedSpan: (mm, edge, live = false) =>
    set((s) => {
      // Same contiguity resolution as resizeSelectedWidth (one wall, one band, no gaps) — then scale
      // the group from the chosen outer edge. `resizeSpanLeft` mirrors `resizeSpan` for the left edge.
      const ids = new Set(s.selIds);
      const picked = s.cabs.filter((c) => ids.has(c.id) && c.cell && c.px == null);
      if (!picked.length) return {};
      const run = picked[0].run ?? 0;
      if (picked.some((c) => (c.run ?? 0) !== run)) return {};
      const g = s.grids[run];
      if (!g) return {};
      const locs = picked.map((c) => ({ c, loc: locate(g, c.cell!) }));
      if (locs.some((l) => l.loc.j < 0 || l.loc.i < 0)) return {};
      const j = locs[0].loc.j;
      if (locs.some((l) => l.loc.j !== j)) return {};
      const ranges = locs
        .map((l) => [l.loc.i, l.loc.i + (l.c.cell!.cs ?? 1) - 1] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      let i0 = ranges[0][0];
      let i1 = ranges[0][1];
      for (let k = 1; k < ranges.length; k++) {
        if (ranges[k][0] !== i1 + 1) return {};
        i1 = ranges[k][1];
      }
      const next = edge === "left" ? resizeSpanLeft(g, j, i0, i1, mm) : resizeSpan(g, j, i0, i1, mm);
      if (!next) return {};
      const res = editSheet(s.cabs, next);
      if (!res) return {};
      const out = { grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
      return live ? out : { ...cabHist(s), ...out };
    }),
  dimSelected: (patch, live = false) =>
    set((s) => {
      const ids = new Set(s.selIds);
      if (!ids.size) return {};
      const d = patch.depth != null ? Math.max(D_MIN, Math.min(D_MAX, Math.round(patch.depth))) : null;

      let changed = false;
      const next = s.cabs.map((c) => {
        if (!ids.has(c.id)) return c;
        const p: Partial<Cabinet> = {};
        if (patch.h != null && c.kind !== "base") {
          const newH = Math.max(MIN_H, Math.min(maxCabH(c, s.ceiling), Math.round(patch.h)));
          if (newH !== c.h) p.h = newH;
        }
        if (d != null && cabDepth(c) !== d) {
          p.depth = d;
        }

        if (c.corner) {
          if (d == null) {
            if (!Object.keys(p).length) return c;
            changed = true;
            return { ...c, ...p };
          }
          if (c.armDepth === d && !Object.keys(p).length) return c;
          changed = true;
          if (c.cornerShape === "outer") return seatOuterCorner({ ...c, ...p, armDepth: d }, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.cabs);
          return seatCorner({ ...c, ...p, armDepth: d }, s.roomPoints, s.waterWall, s.runLayout, s.openings);
        }

        if (!Object.keys(p).length) return c;
        changed = true;
        return { ...c, ...p };
      });

      if (!changed) return {};

      // a base's height goes through the counter rule (one worktop line for the whole kitchen)
      const anyBase = s.cabs.some((c) => ids.has(c.id) && c.kind === "base");
      const withCounter = patch.h != null && anyBase ? (setBasesH(next, patch.h) ?? next) : next;
      if (withCounter === s.cabs) return {};
      return live ? { cabs: withCounter } : { ...cabHist(s), cabs: withCounter };
    }),
  equalizeSelected: () =>
    set((s) => {
      const ids = new Set(s.selIds);
      const picked = s.cabs.filter((c) => ids.has(c.id) && c.cell && c.px == null);
      if (picked.length < 2) return {};
      const run = picked[0].run ?? 0;
      if (picked.some((c) => (c.run ?? 0) !== run)) return {};
      const g = s.grids[run];
      if (!g) return {};
      const locs = picked.map((c) => ({ c, loc: locate(g, c.cell!) }));
      if (locs.some((l) => l.loc.j < 0 || l.loc.i < 0)) return {};
      const j = locs[0].loc.j;
      if (locs.some((l) => l.loc.j !== j)) return {};
      const ranges = locs.map((l) => [l.loc.i, l.loc.i + (l.c.cell!.cs ?? 1) - 1] as [number, number]).sort((a, b) => a[0] - b[0]);
      let i0 = ranges[0][0];
      let i1 = ranges[0][1];
      for (let k = 1; k < ranges.length; k++) { if (ranges[k][0] !== i1 + 1) return {}; i1 = ranges[k][1]; }
      const next = equalizeSpan(g, j, i0, i1);
      if (!next) return {};
      const res = editSheet(s.cabs, next);
      if (!res) return {};
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
    }),
  patchCab: (i, patch) =>
    set((s) => ({ ...cabHist(s), cabs: s.cabs.map((c, j) => (j === i ? { ...c, ...patch } : c)) })),
  patchCabLive: (i, patch) =>
    set((s) => ({ cabs: s.cabs.map((c, j) => (j === i ? { ...c, ...patch } : c)) })),


  // ONE BOX, OR FOUR. A row of wall units can be built as four separate carcasses or as one long
  // one with shared stiles between the bays. The shop saves board, hangers, minifix, saw time and a
  // van slot; the client sees exactly the same fronts. Which of the two it is, is the seller's call
  // — so it is a toggle, not something the app decides for them.
  //
  // The tag is all this writes. What a merged box actually CUTS is pricing's business
  // (packages/pricing/src/carcass.ts), and the 3D, the cut list and the quote all read it from
  // there — so they cannot disagree about what the workshop is being sent.
  toggleSeam: (leftId, rightId) =>
    set((s) => {
      const a = s.cabs.find((c) => c.id === leftId);
      if (!a) return {};
      const joined = !!a.carcassGroup && a.carcassGroup === s.cabs.find((c) => c.id === rightId)?.carcassGroup;
      const next = joined ? splitSeam(s.cabs, leftId, rightId) : joinSeam(s.cabs, leftId, rightId);
      return next ? { ...cabHist(s), cabs: healCarcassGroups(next) } : {};
    }),
  toggleHangerAt: (id, pos) =>
    set((s) => {
      const ref = s.cabs.find((c) => c.id === id);
      if (!ref) return {};
      // the whole BOX carries the positions — a навес is fitted to the carcass, not to a cabinet
      // inside it, so any member has to be able to answer for the lot
      const box = ref.carcassGroup ? boxMates(s.cabs, ref) : [ref];
      const now = hangersOn(box, s.settings.hangingsPerCarcass, s.settings.hangingSpanMm);
      const at = Math.round(pos);
      const next = now.includes(at) ? now.filter((p) => p !== at) : [...now, at].sort((a, b) => a - b);
      const ids = new Set(box.map((c) => c.id));
      return { ...cabHist(s), cabs: s.cabs.map((c) => (ids.has(c.id) ? { ...c, hangPos: next } : c)) };
    }),
  resetHangers: (id) =>
    set((s) => {
      const ref = s.cabs.find((c) => c.id === id);
      if (!ref) return {};
      const box = ref.carcassGroup ? boxMates(s.cabs, ref) : [ref];
      const ids = new Set(box.map((c) => c.id));
      return {
        ...cabHist(s),
        cabs: s.cabs.map((c) => {
          if (!ids.has(c.id)) return c;
          const { hangPos: _drop, ...rest } = c;
          return rest as Cabinet;
        }),
      };
    }),
  toggleCarcassMerge: (id) =>
    set((s) => {
      const ref = s.cabs.find((c) => c.id === id);
      if (!ref) return {};
      const next = ref.carcassGroup ? unmergeRow(s.cabs, ref) : mergeRow(s.cabs, ref);
      return next ? { ...cabHist(s), cabs: next } : {};
    }),

  // THE DIMENSION EDIT — every height/depth change goes through here (the 3D arrows, the plan's
  // dimension lines, the module editor's fields), so «Применить ко всему ряду» works the same way
  // whichever view you happen to be in.
  patchCabDims: (id, patch, live = false) =>
    set((s) => {
      const ref = s.cabs.find((c) => c.id === id);
      if (!ref) return {};
      const d = patch.depth != null ? Math.max(D_MIN, Math.min(D_MAX, Math.round(patch.depth))) : null;

      // DEPTH IS TIER-OWNED: when depth changes, all cabinets of the same tier/kind and all corner
      // units in that tier adapt to the new depth in lock-step so corner squares + seats stay aligned
      // and never overlap or leave gaps.
      const tierEdit = d != null;
      const depthCabs = tierEdit
        ? new Set(s.cabs.filter((c) => c.kind === ref.kind && inSheet(c) && bandsOverlap(c, ref)).map((c) => c.id))
        : null;
      const tierCorners = tierEdit
        ? new Set(s.cabs.filter((c) => c.corner && c.kind === ref.kind && bandsOverlap(c, ref)).map((c) => c.id))
        : null;

      // re-arm a corner to depth `d` and re-seat it (its square + seat both follow the arm)
      const reseat = (c: Cabinet): Cabinet => {
        const withArm = { ...c, armDepth: d! };
        if (c.cornerShape === "outer") return seatOuterCorner(withArm, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.cabs);
        return seatCorner(withArm, s.roomPoints, s.waterWall, s.runLayout, s.openings);
      };

      const next = s.cabs.map((c) => {
        const isRef = c.id === ref.id;
        const p: Partial<Cabinet> = {};
        if (isRef && patch.h != null && c.kind !== "base") p.h = Math.max(MIN_H, Math.min(maxCabH(c, s.ceiling), Math.round(patch.h)));

        if (c.corner) {
          if (d != null && (isRef || (tierCorners?.has(c.id) ?? false))) return reseat({ ...c, ...p });
          return Object.keys(p).length ? { ...c, ...p } : c;
        }

        const setDepth = d != null && (depthCabs?.has(c.id) ?? isRef);
        if (!isRef && !setDepth) return c;
        if (setDepth) p.depth = d;
        return Object.keys(p).length ? { ...c, ...p } : c;
      });

      // a base's height still goes through the counter rule, whatever the row mode says
      const withCounter =
        patch.h != null && ref.kind === "base" ? (setBasesH(next, patch.h) ?? next) : next;

      if (withCounter === s.cabs) return {};
      return live ? { cabs: withCounter } : { ...cabHist(s), cabs: withCounter };
    }),
  applyFinishToAll: (finish) =>
    set((s) => ({ ...cabHist(s), cabs: s.cabs.map((c) => ({ ...c, finish: { ...c.finish, ...finish } })) })),
  patchAllCabs: (patch) =>
    set((s) => ({ ...cabHist(s), cabs: s.cabs.map((c) => ({ ...c, ...patch })) })),
  addCab: (tpl, preferredRun, topBand) => {
    const s = get();
    // a new module arrives wearing the KITCHEN's front profile and handle, not mk()'s defaults —
    // otherwise every catalog add lands flat-fronted and bar-handled in a fluted, knob-handled run
    const cab = mk({ ...styleOf(s.cabs, tpl.kind), ...tpl });
    // a new BASE cabinet adopts the kitchen's current base height, so the worktop stays level
    if (cab.kind === "base") {
      const baseH = s.cabs.find((c) => c.kind === "base")?.h;
      if (baseH != null) cab.h = baseH;
    }
    // «в верхний ряд» — seat it in the TOPMOST wall row that actually exists on the target wall,
    // adopting its height, mounting height and DEPTH. A catalogue template can't know any of those:
    // they depend on the ceiling and on what the user has already built.
    if (topBand) {
      const L = resolveLayout(s.cabs, { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal });
      const rows = wallRows(L.elevation(preferredRun ?? 0));
      const top = rows[rows.length - 1];
      if (top) {
        const first = s.cabs.find((c) => c.id === top.ids[0]);
        cab.mountY = top.y0;
        cab.h = top.y1 - top.y0;
        const armDepth = first ? cabDepth(first) : FOOT_DEPTH_MM.upper;
        cab.armDepth = armDepth;
        // the square follows the arm depth — a base-depth top row needs 840, not 613
        const side = cornerSideFor(armDepth);
        if (cab.corner) { cab.w = side; cab.depth = side; }
        else cab.depth = armDepth;
      }
    }
    let placed: Cabinet | null = null;
    // auto-fit into a wall run with a gap that holds it (corner units +
    // free-standing furniture can't tile a straight run → skip to free-floating)
    if (!cab.corner && !cab.furniture && !cab.island) {
      const runs = planRuns(s.roomPoints, s.waterWall, s.runLayout, s.openings, s.cabs, s.reveal).runs;
      // try the active wall (e.g. the one shown in the front view) FIRST, so adding
      // to a switched-to wall lands there instead of always filling the main wall
      const order =
        preferredRun != null && preferredRun >= 0 && preferredRun < runs.length
          ? [preferredRun, ...runs.map((_, i) => i).filter((i) => i !== preferredRun)]
          : runs.map((_, i) => i);
      for (const r of order) {
        if (runs[r].kind !== "wall") continue;
        // fit against the REAL module (its own mountY/h), not a synthesised default-band probe —
        // otherwise a second-row wall unit is fitted against the first row's occupancy
        const x = firstFitX(s.cabs, r, cab, runs[r].len, cab.w);
        if (x != null) {
          placed = { ...cab, run: r, x };
          break;
        }
      }
    }
    // nothing fit → a CORNER unit is SEATED in an inside corner (so it shows on both walls it turns,
    // in the front view too — not stranded mid-room where cornerSlots can't place it); anything else
    // drops free-floating at the room centre to drag.
    if (!placed) {
      const b = polygonBoundsMm(s.roomPoints);
      const atCenter = { ...cab, px: b.cx, pz: b.cy, rot: cab.rot ?? 0 };
      // an ANGLED END UNIT caps a run's exposed end (no zone); an INNER corner seats at the vertex
      // two runs share (the big square); everything else drops free.
      //
      // The end unit takes THE DEPTH OF THE ROW IT JOINS, not a catalogue number: it stands in the
      // run, so a 600-deep kitchen must not get a 560-deep cap with its front face 40mm behind its
      // neighbour's. Read it off a real module of the same kind, falling back to the per-kind default.
      const rowDepth = s.cabs.find((k) => k.kind === cab.kind && !k.corner && !k.island && !k.furniture)?.depth;
      placed = !cab.corner
        ? atCenter
        : cab.cornerShape === "outer"
          ? seatOuterCorner({ ...atCenter, armDepth: cab.armDepth ?? rowDepth }, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.cabs)
          : seatCorner(atCenter, s.roomPoints, s.waterWall, s.runLayout, s.openings);
    }
    // SELECT the new module (selIds, not just the legacy selIdx) — the 3D reads selIds to decide the
    // single selection, and that selection is what lights up its wall's grid. Without this, a
    // freshly-placed cabinet leaves selIds empty, the wall is no longer "empty", and the grid hides.
    // a seated INNER corner reserves a wall's start zone → keep the existing cabs on that wall put.
    // an OUTER end cap reserves nothing, so it just joins the free layer with no re-anchor.
    const nextCabs = cab.corner && cab.cornerShape !== "outer"
      ? reanchorAfterCorner(s.cabs, [...s.cabs, placed], s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal)
      : [...s.cabs, placed];
    set({ ...cabHist(s), cabs: nextCabs, selIdx: s.cabs.length, selIds: [placed.id] });
    return placed.id;
  },
  fillCabGap: (id) =>
    set((s) => {
      const i = s.cabs.findIndex((c) => c.id === id);
      if (i < 0) return {};
      const room = { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal };
      const cab = s.cabs[i];
      if (!cab) return {};
      const span = fillGapSpan(s.cabs, cab, room, cab.run ?? 0);
      if (!span) return {}; // nothing to fill (already snug)
      const filled = { ...cab, x: span.x, w: span.w }; // only the selected module is re-tiled/grown
      return { ...cabHist(s), cabs: s.cabs.map((c, j) => (j === i ? filled : c)) };
    }),
  saveCab: (cabId, name) => {
    const s = get();
    const cab = s.cabs.find((c) => c.id === cabId);
    if (!cab) return;
    // snapshot the config (no position) + a transparent 3/4 thumbnail rendered off-screen
    const thumb = captureCabinetThumbnail(cab, s.runStyle);
    const item = addSavedCab(stripCab(cab), name, thumb);
    if (s.authUser) void pushSavedCab(s.authUser.id, item); // cloud sync (tolerant, fire-and-forget)
    set((st) => ({ savedCabsRev: st.savedCabsRev + 1 }));
  },
  removeSavedCab: (id) => {
    removeSavedCabLS(id);
    if (get().authUser) void deleteSavedCabCloud(id);
    set((s) => ({ savedCabsRev: s.savedCabsRev + 1 }));
  },
  renameSavedCab: (id, name) => {
    renameSavedCabLS(id, name);
    set((s) => ({ savedCabsRev: s.savedCabsRev + 1 }));
  },

  // ── the shop's material catalog ────────────────────────────────────────────
  // Each of these writes localStorage and bumps catalogRev; every picker reads the
  // list through that counter, so a price corrected in Каталог is the price the next
  // quote uses — no reload, no second copy of the list to keep in step.
  saveMaterial: (m) => {
    upsertMaterial(m);
    set((s) => ({ catalogRev: s.catalogRev + 1 }));
  },
  deleteMaterial: (id) => {
    removeMaterial(id);
    set((s) => ({ catalogRev: s.catalogRev + 1 }));
  },
  resetMaterials: () => {
    resetCatalog();
    set((s) => ({ catalogRev: s.catalogRev + 1 }));
  },

  // ── the workshop's offcut rack ─────────────────────────────────────────────
  addOffcut: (w, h, group) => {
    addOffcutLS(w, h, group);
    set((s) => ({ offcutsRev: s.offcutsRev + 1 }));
  },
  removeOffcut: (id) => {
    removeOffcutLS(id);
    set((s) => ({ offcutsRev: s.offcutsRev + 1 }));
  },
  removeCab: (id) =>
    set((s) => {
      const cabs = s.cabs.filter((c) => c.id !== id);
      return { ...cabHist(s), cabs, selIdx: Math.min(s.selIdx, cabs.length - 1) };
    }),
  // ── THE SHEET ────────────────────────────────────────────────────────────────────────────────
  // Every edit is: run a pure track op → hand it to editSheet → take the result, or take nothing.
  // editSheet re-anchors the modules, refuses anything that would put two of them in one cell, and
  // re-projects x/w/h/mountY from the new prefix sums. There is no "and then fix up the row"
  // step anywhere below, and there cannot be one: a refused edit returns {} and the sheet is
  // untouched. That is why the border stops instead of the cabinets piling up.
  openSheet: (run) =>
    set((s) => {
      const room = { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal };
      const next = ensureSheet(s.grids, s.cabs, room, s.ceiling, run);
      return next ?? {}; // migration, not an edit — deliberately no undo step
    }),
  ensureAllWalls: () =>
    set((s) => {
      if (s.runLayout === "all") return {}; // already there — the common case, cheap no-op
      // A stored i/l/u project (runLayout is persisted) opens with only its 1–3 walls as runs, so you
      // could not build on the others. Migrate it to "all" — a grid on every wall — remapping the cabs
      // onto the new run order so each stays on its own wall. Not an edit: no undo step.
      const cabs = remapCabRuns(s.cabs, s.runLayout, "all", s.roomPoints, s.waterWall, s.openings);
      return { cabs, runLayout: "all" };
    }),
  gridSetColW: (run, rowId, i, mm, live) =>
    set((s) => {
      const g = s.grids[run];
      const j = g ? rowIndex(g, rowId) : -1;
      if (!g || j < 0) return {};
      const res = editSheet(s.cabs, setColWidth(g, j, i, mm));
      if (!res) return {};
      const next = { grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
      return live ? next : { ...cabHist(s), ...next };
    }),
  gridAddCol: (run, rowId) =>
    set((s) => {
      const g0 = s.grids[run];
      if (!g0) return {};
      // reconcile the tall shadows BEFORE equalising — a fridge just added from the catalog may not
      // have carved its shadow into the stored grid yet, and without it addColumn would redistribute
      // the row across the pantry's space and push the uppers underneath it.
      const g = reconcileTalls(g0, s.cabs);
      const j = rowIndex(g, rowId);
      if (j < 0) return {};
      const res = editSheet(s.cabs, addColumn(g, j));
      if (!res) return {};
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
    }),
  gridDropCol: (run, rowId) =>
    set((s) => {
      const g0 = s.grids[run];
      if (!g0) return {};
      const g = reconcileTalls(g0, s.cabs); // ensure shadows before equalising (see gridAddCol)
      const j = rowIndex(g, rowId);
      if (j < 0) return {};
      const next = dropColumn(g, j);
      if (!next) return {};
      // the rightmost column is going away — DELETE whatever cabinet is anchored in it (it has
      // nowhere to move to). A cabinet merely spanning INTO it just loses a column and shrinks.
      const gone = lastFillColId(g.rows[j]);
      const removed = gone ? s.cabs.find((c) => c.cell?.c === gone && c.cell?.r === rowId && (c.run ?? 0) === run) : undefined;
      const cabs = removed ? s.cabs.filter((c) => c.id !== removed.id) : s.cabs;
      const res = editSheet(cabs, next);
      if (!res) return {};
      const selIdx = removed ? Math.min(s.selIdx, res.cabs.length - 1) : s.selIdx;
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs, selIdx };
    }),
  gridFillReach: (run, rowId, reachIdx) =>
    set((s) => {
      const g = s.grids[run];
      const j = g ? rowIndex(g, rowId) : -1;
      if (!g || j < 0) return {};
      const row = g.rows[j];
      const reach = row.cols[reachIdx];
      if (!reach || !reach.lock || reach.dead || reach.tall) return {}; // not a fillable reach strip
      const endCorner = !!row.cols[reachIdx + 1]?.dead; // the dead corner square sits on which side
      const startCorner = !!row.cols[reachIdx - 1]?.dead;
      if (!endCorner && !startCorner) return {};
      const startIdx = (c: Cabinet) =>
        c.cell && c.cell.r === rowId && (c.run ?? 0) === run && c.px == null ? locate(g, c.cell).i : -1;

      // already filled? a cabinet spans the reach strip → RETRACT it back out of the corner
      const spanner = s.cabs.find((c) => {
        const i = startIdx(c);
        return i >= 0 && reachIdx >= i && reachIdx < i + (c.cell!.cs ?? 1);
      });
      let cabs: Cabinet[];
      if (spanner) {
        const i = startIdx(spanner);
        const cs = spanner.cell!.cs ?? 1;
        if (cs <= 1) return {}; // it is ONLY the reach strip (a standalone corner unit) — leave it
        // reach is the last column of an end corner (just shrink) or the first of a start corner
        // (drop it and move the anchor one column inward)
        const cell = endCorner
          ? { ...spanner.cell!, cs: cs - 1 }
          : { ...spanner.cell!, c: row.cols[i + 1].id, cs: cs - 1 };
        cabs = s.cabs.map((c) => (c.id === spanner.id ? { ...c, cell } : c));
      } else {
        // EXTEND the neighbour on the non-corner side into the strip
        const nbIdx = endCorner ? reachIdx - 1 : reachIdx + 1;
        const nb = s.cabs.find((c) => {
          const i = startIdx(c);
          const cs = c.cell?.cs ?? 1;
          return i >= 0 && (endCorner ? i + cs - 1 === nbIdx : i === nbIdx);
        });
        if (!nb) return {}; // nothing to extend — the "+" adds a standalone unit instead
        const cs = nb.cell!.cs ?? 1;
        const cell = endCorner
          ? { ...nb.cell!, cs: cs + 1 } // grow rightward over the strip
          : { ...nb.cell!, c: reach.id, cs: cs + 1 }; // grow leftward: the strip becomes the new anchor
        cabs = s.cabs.map((c) => (c.id === nb.id ? { ...c, cell } : c));
      }
      const res = editSheet(cabs, g);
      if (!res) return {};
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
    }),
  addCornerCab: (run, rowId) =>
    set((s) => {
      const room = { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal };
      const g = s.grids[run];
      const j = g ? rowIndex(g, rowId) : -1;
      if (!g || j < 0 || g.rows[j].kind !== "wall") return {};
      const ys = rowEdges(g);
      const y0 = ys[j];
      const y1 = ys[j + 1];
      const depth = g.rows[j].depth;
      const side = cornerSideFor(depth); // the corner SQUARE for this band's depth (deep → 840, shallow upper → 613)
      const seats = cornerUnits(s.roomPoints, s.waterWall, s.runLayout, s.openings, side);
      if (!seats.length) return {}; // straight kitchen — no inside corner to fill
      const look = styleOf(s.cabs, "upper");
      // one candidate per inside corner, sized + hung for THIS band
      const cands = seats.map((cs) =>
        mk({
          ...look, kind: "upper", corner: true,
          px: cs.px, pz: cs.pz, rot: cs.rot, w: cs.w, depth: cs.depth,
          armDepth: depth, h: y1 - y0, mountY: y0, fill: "shelves", count: 1, door: 0, handle: 0, run: 0,
        }),
      );
      // keep only the corner(s) that actually show on THIS wall, and only where this band has none yet
      const L = resolveLayout([...s.cabs, ...cands], room);
      const onWall = (c: Cabinet) => L.elevation(run).some((rc) => rc.id === c.id);
      const fresh = cands.filter(
        (c) =>
          onWall(c) &&
          !s.cabs.some(
            (e) =>
              e.corner && e.kind === "upper" && Math.abs((e.mountY ?? 0) - y0) < 20 &&
              Math.hypot((e.px ?? 0) - (c.px ?? 0), (e.pz ?? 0) - (c.pz ?? 0)) < 40,
          ),
      );
      if (!fresh.length) return {};
      const withCorners = reanchorAfterCorner(s.cabs, [...s.cabs, ...fresh], s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal);
      return { ...cabHist(s), cabs: withCorners, selIdx: s.cabs.length, selIds: [fresh[0].id] };
    }),
  placeCornerInBand: (run, rowId, tpl) =>
    set((s) => {
      const room = { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal };
      const g = s.grids[run];
      const j = g ? rowIndex(g, rowId) : -1;
      if (!g || j < 0 || g.rows[j].kind === "void") return {};
      const ys = rowEdges(g);
      const y0 = ys[j];
      const y1 = ys[j + 1];
      const depth = g.rows[j].depth;
      // the band decides the KIND: the floor row holds a base (or a tall, if that's what's armed); any
      // wall row holds an upper. The corner SQUARE follows the band depth, not the template's own size.
      const isFloor = g.rows[j].kind === "floor";
      const kind: Cabinet["kind"] = isFloor ? (tpl?.kind === "tall" ? "tall" : "base") : "upper";
      const side = cornerSideFor(depth);
      const seats = cornerUnits(s.roomPoints, s.waterWall, s.runLayout, s.openings, side);
      if (!seats.length) return { toast: "В этой кухне нет угла" }; // a straight run has no inside corner
      const look = styleOf(s.cabs, kind);
      const cands = seats.map((cs) =>
        mk({
          ...look, ...tpl, kind, corner: true,
          px: cs.px, pz: cs.pz, rot: cs.rot, w: cs.w, depth: cs.depth,
          armDepth: depth, h: y1 - y0, mountY: y0, run: 0, cell: undefined, x: undefined,
        }),
      );
      const L = resolveLayout([...s.cabs, ...cands], room);
      const onWall = (c: Cabinet) => L.elevation(run).some((rc) => rc.id === c.id);
      const fresh = cands.filter(
        (c) =>
          onWall(c) &&
          !s.cabs.some(
            (e) =>
              e.corner && e.kind === c.kind && Math.abs((e.mountY ?? 0) - y0) < 20 &&
              Math.hypot((e.px ?? 0) - (c.px ?? 0), (e.pz ?? 0) - (c.pz ?? 0)) < 40,
          ),
      );
      if (!fresh.length) return { toast: "Здесь уже стоит угловой шкаф" };
      // complete the L at each seated corner (convert the nearest OTHER-band cabinet), then re-anchor
      let combined: Cabinet[] = [...s.cabs, ...fresh];
      for (const fc of fresh) combined = completeCornerL(combined, fc, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal);
      const withCorners = reanchorAfterCorner(s.cabs, combined, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal);
      return { ...cabHist(s), cabs: withCorners, selIdx: s.cabs.length, selIds: [fresh[0].id] };
    }),
  gridSetRowH: (run, j, mm, live) =>
    set((s) => {
      const g = s.grids[run];
      if (!g) return {};
      const res = editSheet(s.cabs, setRowHeight(g, j, mm));
      if (!res) return {};
      let cabs = res.cabs;
      const grids: Grids = { ...s.grids, [run]: res.grid };

      // THE FLOOR ROW IS GLOBAL. Its height IS the counter height, and a kitchen has ONE worktop
      // plane — so dragging it on this wall has to carry every other wall's floor row with it, and
      // the island's too (an island is a base on the floating layer, in no grid at all). Without
      // this you get a worktop that steps down as it turns the corner.
      //
      // It is the same rule a spreadsheet has always had — change a row's height and the whole row
      // follows — just applied across the walls that share the row.
      // THE CORNER UNITS ride the rows too. They are free-placed (two walls at once) so the grid
      // does not own them — but a corner wall unit that stays put while the row beside it moves is
      // simply hanging at the wrong height. This also catches the indirect case: raising the floor
      // row pushes every row above it up, so a corner follows even though its own row wasn't touched.
      const hung = rehangCorners(cabs, g, res.grid, s.ceiling);
      if (hung) cabs = hung;

      if (g.rows[j].kind === "floor") {
        const fh = res.grid.rows[j].h;
        for (const key of Object.keys(grids)) {
          const r = Number(key);
          if (r === run) continue;
          const og = grids[r];
          const fj = og.rows.findIndex((x) => x.kind === "floor");
          if (fj < 0) continue;
          const r2 = editSheet(cabs, setRowHeight(og, fj, fh));
          if (r2) {
            grids[r] = r2.grid;
            cabs = r2.cabs;
            const h2 = rehangCorners(cabs, og, r2.grid, s.ceiling);
            if (h2) cabs = h2;
          }
        }
        const level = setBasesH(cabs, fh - PLINTH - WORKTOP);
        if (level) cabs = level;
      }

      const next = { grids, cabs };
      return live ? next : { ...cabHist(s), ...next };
    }),
  gridSplitRow: (run, j, atMm, kind) =>
    set((s) => {
      const g = s.grids[run];
      if (!g) return {};
      const res = editSheet(s.cabs, splitRow(g, j, atMm, kind));
      if (!res) return {};
      const cabs = rehangCorners(res.cabs, g, res.grid, s.ceiling) ?? res.cabs;
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs };
    }),
  gridSetRowKind: (run, j, kind) =>
    set((s) => {
      const g = s.grids[run];
      if (!g) return {};
      const res = editSheet(s.cabs, setRowKind(g, j, kind));
      if (!res) return {};
      const cabs = rehangCorners(res.cabs, g, res.grid, s.ceiling) ?? res.cabs;
      return { ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs };
    }),
  // Grabbing a module's FACE is grabbing its COLUMN. That is the whole 3D story.
  //
  //   • right face → widen the LAST column of its span; the columns beyond absorb it
  //   • left face  → the module's right edge is pinned, so it grows leftwards by taking from the
  //                  column BEFORE it, which shrinks. (dragBorder spills into the nearest neighbour
  //                  first, and the nearest neighbour of column i−1 is the module's own column.)
  //
  // Either way the neighbours slide, nothing overlaps, and the sheet updates in lockstep — because
  // the sheet and the scene are the same numbers.
  gridSetCabW: (id, w, edge, live) =>
    set((s) => {
      const cab = s.cabs.find((c) => c.id === id);
      const run = cab?.run ?? 0;
      const g = s.grids[run];
      if (!cab?.cell || cab.px != null || !g) return {}; // floating layer — not ours to resize
      const { j, i } = locate(g, cab.cell); // the cabinet's BAND and its column within it
      if (j < 0 || i < 0) return {};
      const row = g.rows[j];
      const cs = Math.max(1, cab.cell.cs ?? 1);
      const delta = Math.round(w) - cab.w;
      if (!delta) return {};

      // grabbing the left face of the left-most column has nothing to take from — the wall is there
      const target = edge === "right" ? i + cs - 1 : i - 1;
      if (target < 0 || target >= row.cols.length) return {};
      const want = edge === "right" ? row.cols[target].w + delta : row.cols[target].w - delta;

      const res = editSheet(s.cabs, setColWidth(g, j, target, want));
      if (!res) return {};
      const next = { grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs };
      return live ? next : { ...cabHist(s), ...next };
    }),
  // FILL THE WALL — from the selected module, fill every empty cell of its ROW with a copy of it, so
  // you don't hand-place each unit. Repeats: find the row's open cells, drop one in the first, re-solve,
  // until the row is full or nothing more fits. An APPLIANCE seeds a plain cabinet of the same kind
  // instead (nobody wants a wall of dishwashers). One undo step for the whole fill.
  fillWallRow: (id) =>
    set((s) => {
      const seed = s.cabs.find((c) => c.id === id);
      if (!seed || seed.px != null || !seed.cell) return {};
      const run = seed.run ?? 0;
      const rowId = seed.cell.r;
      const room = { points: s.roomPoints, waterWall: s.waterWall, layout: s.runLayout, openings: s.openings, reveal: s.reveal };
      const look = styleOf(s.cabs, seed.kind);
      const tpl: Partial<Cabinet> = seed.appliance
        ? { kind: seed.kind, fill: "shelves", count: 2, door: 0 }
        : { kind: seed.kind, fill: seed.fill, count: seed.count, door: seed.door, handle: seed.handle, front: frontOf(seed), finish: seed.finish };
      let cabs = s.cabs;
      let grids = s.grids;
      for (let guard = 0; guard < 40; guard++) {
        const g = grids[run];
        const j = g ? rowIndex(g, rowId) : -1;
        if (!g || j < 0) break;
        const L = resolveLayout(cabs, room);
        const cells = openCells(g, j, cabs, L, run, s.ceiling, s.openings, s.fittings);
        if (!cells.length) break;
        const cell = cells[0];
        const cab = mk({ ...look, ...tpl, run, cell: { c: cell.c, r: rowId, cs: cell.cs }, px: undefined, pz: undefined, rot: undefined });
        const res = editSheet([...cabs, cab], g);
        if (!res) break; // couldn't place there — stop rather than loop forever
        const LNext = resolveLayout(res.cabs, room);
        if (LNext.clashing.has(cab.id)) break; // stop if placed module clashes with a corner/other module
        cabs = res.cabs;
        grids = { ...grids, [run]: res.grid };
      }
      if (cabs === s.cabs) return {}; // nothing was free
      return { ...cabHist(s), cabs, grids };
    }),
  addCabInCell: (run, cell, tpl) => {
    const s = get();
    const g = s.grids[run];
    if (!g || locate(g, cell).i < 0) return null;
    // it has to LOOK like the rest of the kitchen the moment it appears — see cabinet.styleOf
    const look = styleOf(s.cabs, (tpl?.kind as Cabinet["kind"]) ?? undefined);
    // NOTE what is NOT here: a width, a height, a mounting height, a depth, or even a kind. The
    // CELL has all of those, and applyGrid writes them onto the module. That is what makes adding
    // furniture a single tap — and what makes it impossible for the new module to overlap anything,
    // since a taken cell is simply refused below.
    const cab = mk({ ...look, ...tpl, run, cell, px: undefined, pz: undefined, rot: undefined });
    const res = editSheet([...s.cabs, cab], g);
    if (!res) return null; // that cell is taken
    set({ ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs, selIdx: s.cabs.length, selIds: [cab.id] });
    return cab.id;
  },
  addCabInTopVoid: (run, tpl) => {
    const s = get();
    const g = s.grids[run];
    if (!g) return null;
    // the highest convertible void — same rule the 3D uses to draw the "+ ряд" panel
    const ys = rowEdges(g);
    let voidJ = -1;
    for (let j = 0; j < g.rows.length; j++) {
      if (g.rows[j].kind === "void" && ys[j + 1] - ys[j] >= ROW_MIN + 50) voidJ = j;
    }
    if (voidJ < 0) return null; // no room for a third row
    const g1 = setRowKind(g, voidJ, "wall"); // the void becomes an upper band
    if (!g1) return null;
    const row = g1.rows[voidJ];
    const col = row.cols.find((c) => !c.dead && !c.lock); // first fillable column
    if (!col) return null;
    const look = styleOf(s.cabs, (tpl?.kind as Cabinet["kind"]) ?? undefined);
    const cab = mk({ ...look, ...tpl, run, cell: { c: col.id, r: row.id, cs: 1 }, px: undefined, pz: undefined, rot: undefined });
    const res = editSheet([...s.cabs, cab], g1);
    if (!res) return null;
    set({ ...cabHist(s), grids: { ...s.grids, [run]: res.grid }, cabs: res.cabs, selIdx: s.cabs.length, selIds: [cab.id] });
    return cab.id;
  },

  resizeCab: (id, newW, edge, bounds) =>
    set((s) => {
      const cabs = resizeCabs(s.cabs, id, newW, edge, bounds);
      return cabs ? { ...cabHist(s), cabs } : {};
    }),
  resizeCabLive: (id, newW, edge, bounds) =>
    set((s) => {
      const cabs = resizeCabs(s.cabs, id, newW, edge, bounds);
      return cabs ? { cabs } : {};
    }),
  liftCab: (id, mm) =>
    set((st) => ({
      ...cabHist(st),
      cabs: st.cabs.map((c) => {
        if (c.id !== id || c.kind === "upper") return c;
        if (mm == null) {
          const { mountY: _drop, ...rest } = c;
          return rest as Cabinet;
        }
        // it cannot go through the floor, and it cannot go through the ceiling either
        const top = cabBand({ ...c, mountY: 0 }).y1;
        return { ...c, mountY: Math.max(0, Math.min(Math.max(0, st.ceiling - top), Math.round(mm))) };
      }),
    })),
  setBaseHeight: (mm) =>
    set((s) => {
      const cabs = setBasesH(s.cabs, mm);
      return cabs ? { ...cabHist(s), cabs } : {};
    }),
  setBaseHeightLive: (mm) =>
    set((s) => {
      const cabs = setBasesH(s.cabs, mm);
      return cabs ? { cabs } : {};
    }),
  // Re-hang / resize wall units. The SHEET decides which modules move and where (it owns the row
  // geometry — including the rule that rows above a dragged one ride along, since they are stacked
  // boxes); `editRows` applies the batch and stops anything passing through the ceiling.
  //
  // The caller passes explicit ids rather than this filtering by `run`: a CORNER upper is
  // free-placed and belongs to two runs at once, so a run+`!corner` filter left it hanging at the
  // old height while the rest of the row moved. mountY is purely vertical, so re-hanging a corner
  // unit is safe — it doesn't touch its px/pz seat.
  setRows: (edits) =>
    set((s) => {
      const cabs = editRows(s.cabs, edits, s.ceiling);
      return cabs ? { ...cabHist(s), cabs } : {};
    }),
  setRowsLive: (edits) =>
    set((s) => {
      const cabs = editRows(s.cabs, edits, s.ceiling);
      return cabs ? { cabs } : {};
    }),
  addCabAt: (tpl, run, x, w) => {
    const s = get();
    const cab = mk({ ...styleOf(s.cabs, tpl.kind), ...tpl });
    // a new base adopts the kitchen's counter height, so the worktop stays level
    if (cab.kind === "base") {
      const baseH = s.cabs.find((c) => c.kind === "base")?.h;
      if (baseH != null) cab.h = baseH;
    }
    // drop it EXACTLY in the tapped empty cell — no first-fit search (that's what made a
    // module added from the front view land on a different wall than the one you tapped)
    const placed: Cabinet = { ...cab, run, x: Math.round(x), w: Math.round(w), px: undefined, pz: undefined, rot: undefined };
    set({ ...cabHist(s), cabs: [...s.cabs, placed], selIdx: s.cabs.length, selIds: [placed.id] });
    return placed.id;
  },
  healRows: () =>
    set((s) => {
      let cabs = s.cabs;
      // 1. a corner unit that was resized no longer fills the zone both walls clear for it, so a
      //    gap opens beside it that nothing can close — restore its structural size and re-seat it
      const corners = healCornerUnits(cabs, s.roomPoints, s.waterWall, s.runLayout, s.openings);
      if (corners) cabs = corners;
      // 2. …and any row that slid INTO a corner zone gets shifted back out of it
      const { runs } = planRuns(s.roomPoints, s.waterWall, s.runLayout, s.openings, cabs, s.reveal);
      const rows = healRunStarts(cabs, (c) => runFloor(runs[c.run ?? 0], cabDepth(c)));
      if (rows) cabs = rows;
      return cabs === s.cabs ? {} : { cabs };
    }),
  dockCab: (id, run, x) =>
    set((s) => ({
      cabs: s.cabs.map((c) =>
        // a CORNER is free by design (the 3D needs px/pz/rot for the diagonal body) — never
        // dock one, it would collapse into a flat box on the wall
        c.id === id && !c.corner && !c.furniture && !c.island
          ? { ...c, run, x: Math.round(x), px: undefined, pz: undefined, rot: undefined }
          : c,
      ),
    })),
  moveCabsX: (updates) =>
    set((s) => ({
      ...cabHist(s),
      cabs: s.cabs.map((c) => {
        const u = updates.find((x) => x.id === c.id);
        // corners + furniture live free (px/pz) and the 3D NEEDS those coords — don't
        // dock/clear them (that made a corner vanish when nudged in the elevation).
        if (!u || c.corner || c.furniture || c.island) return c;
        // Moving a module in the front elevation DOCKS it to that wall: set run-local x (+
        // the wall run) and CLEAR any free transform, so the 3D honours the move instead of
        // keeping the old px/pz (which made a dragged free cab snap back).
        return {
          ...c,
          x: u.x,
          ...(u.run != null ? { run: u.run } : {}),
          px: undefined,
          pz: undefined,
          rot: undefined,
          ...(u.mountY != null ? { mountY: u.mountY } : {}),
        };
      }),
    })),
  // Dragging a module out into the room takes it OFF the sheet and onto the floating layer — so it
  // SURRENDERS ITS CELL. (Excel does the same when you drag a cell's content out onto the canvas: it
  // stops being a cell and becomes a shape.) Without this it kept squatting on a cell it no longer
  // stood in, the "+" under it never came back, and the grid went on rewriting the x/w of a module
  // that is now positioned by px/pz. Re-dock it and `sheet.adopt` gives it a fresh address.
  moveCabPlan: (id, patch) =>
    set((s) => ({
      cabs: s.cabs.map((c) => {
        if (c.id !== id) return c;
        const next: Cabinet = { ...c, ...patch, cell: patch.px != null || patch.pz != null ? undefined : c.cell };
        // An OUTER (reverse-L) corner is positioned by hand: as it's dragged / rotated, keep its open
        // faces pointing "forward" (the +u,+i local corner) so the L stays oriented with the user's
        // grab instead of snapping back to whatever it was seated toward.
        //
        // …unless the gesture SEATED it (a drag onto a reflex vertex — the L-room elbow this shape
        // exists to wrap). The seat knows which way the room is; deriving the facing from the
        // rotation instead would only be right by accident.
        if (patch.cornerFace) return next;
        if (isOuterCorner(next) && (patch.rot != null || patch.px != null || patch.pz != null)) {
          const r = ((next.rot ?? 0) * Math.PI) / 180;
          const fx = Math.cos(r) - Math.sin(r); // (u + i) direction in world
          const fy = Math.sin(r) + Math.cos(r);
          next.cornerFace = { x: Math.round((next.px ?? 0) + fx * 2000), y: Math.round((next.pz ?? 0) + fy * 2000) };
        }
        return next;
      }),
    })),
  duplicateCab: (id) => {
    const s = get();
    const src = s.cabs.find((c) => c.id === id);
    if (!src) return null;
    // drop the copy into the first gap in its row that fits (so duplicating fills
    // empty space directly), else at the row end — never overlapping a sibling
    const { id: _drop, ...rest } = src;
    void _drop;
    const dup = mk({ ...rest, x: src.x != null ? parkX(s.cabs, src, src.w) : undefined });
    set({ ...cabHist(s), cabs: [...s.cabs, dup], selIdx: s.cabs.length, selIds: [dup.id] });
    return dup.id;
  },
  replaceCab: (id, tpl) =>
    set((s) => {
      const i = s.cabs.findIndex((c) => c.id === id);
      if (i < 0) return {};
      const old = s.cabs[i];
      const tiled = isTiled(old); // sits in a run slot vs free-floating
      const base = mk(tpl);
      const sameKind = base.kind === old.kind;
      // A SWAP CHANGES WHAT A MODULE IS, NOT HOW BIG IT IS. This used to take the template's
      // size, so swapping a base for another base reset its carcass height and left a step in
      // the worktop. Keep the module's own dimensions whenever the swap stays in the same kind.
      const h = sameKind
        ? old.h
        : base.kind === "base"
          ? // changing kind INTO a base → adopt the kitchen's counter height, not the template's,
            // so the worktop stays level
            (s.cabs.find((c) => c.kind === "base" && c.id !== id)?.h ?? base.h)
          : base.h;
      // A SWAP CHANGES WHAT A MODULE IS, NOT WHAT IT LOOKS LIKE.
      //
      // A catalog template says "drawer bank" or "sink base"; it almost never says which front
      // profile or handle the kitchen uses, so `mk()` filled those with its own defaults and the
      // swapped module came out flat-fronted and bar-handled in a fluted, knob-handled run. The user
      // then had to restyle it by hand to put back what it should never have lost.
      //
      // Read the look off the module being REPLACED — by definition it already matches its
      // neighbours. `tpl.X ?? old.X` and not `base.X ?? old.X`, because `base` has been through mk()
      // and its defaults are indistinguishable from a deliberate choice. Only a template that
      // EXPLICITLY sets a field (the hood, which has no front and no handle) overrides the kitchen.
      let next: Cabinet = {
        ...base,
        front: tpl.front ?? frontOf(old),
        handle: tpl.handle ?? old.handle,
        door: tpl.door ?? old.door,
        handlePos: tpl.handlePos ?? old.handlePos,
        opening: tpl.opening ?? old.opening,
        id: old.id, // keep the id so the selection stays valid
        run: old.run,
        cell: old.cell, // it stays in the same cell — the grid still owns its geometry
        x: old.x,
        px: old.px,
        pz: old.pz,
        rot: old.rot,
        // a wall unit keeps the height it was hung at; anything else re-derives its band
        mountY: base.kind === "upper" && old.kind === "upper" ? old.mountY : undefined,
        w: tiled ? old.w : base.w, // tiled → keep the slot width; free → take the new size
        h,
        depth: sameKind ? old.depth : base.depth,
        finish: { ...old.finish, ...tpl.finish },
      };
      // Same rule, applied to a CORNER's size: its square and its seat are not free numbers, they
      // follow from the depth of the runs beside it. Swapping the BODY (diagonal ↔ L) must not throw
      // that away — without this the swap took the template's default arm depth and left `w` and
      // `depth` disagreeing with each other.
      // OUTER (convex) end cap: a different seating from an inner corner — it caps the exposed run end
      // nearest the module, keeps the run's own depth, and reserves NOTHING (no complete-the-L, no
      // re-anchor). Without this branch a swap-to-outer fell through to inner seating and jumped the
      // unit to a wall vertex at the big 840 square — "can't convert to an outer corner".
      if (next.corner && next.cornerShape === "outer") {
        const foot = cabFootprints([old], s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal)[0];
        const seed = foot ? { px: foot.cx, pz: foot.cy } : {};
        const seated = seatOuterCorner(
          { ...next, ...seed, cell: undefined, x: undefined, run: 0, armDepth: old.armDepth ?? cabDepth(old) },
          s.roomPoints, s.waterWall, s.runLayout, s.openings, s.cabs,
        );
        return { ...cabHist(s), cabs: s.cabs.map((c, j) => (j === i ? seated : c)) };
      }
      if (next.corner) {
        // The constructor runs in the "all" shape — a run on EVERY wall — so every inside corner of
        // the room already exists. Turning a module into a corner just SEATS it at the nearest one;
        // there is no layout to grow (that old grow/remap dance was for the retired i/l/u constructor
        // and only corrupted things here). Seed at the module's true world position so it seats at the
        // corner beside IT, not the one nearest the room origin.
        const seats = cornerUnits(s.roomPoints, s.waterWall, s.runLayout, s.openings);
        if (!seats.length) return { toast: "В этой комнате нет угла" }; // a single-wall room has none
        const foot = cabFootprints([old], s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal)[0];
        const seed = foot ? { px: foot.cx, pz: foot.cy } : {};
        const seated = seatCorner(
          { ...next, ...seed, cell: undefined, x: undefined, run: 0, armDepth: old.armDepth ?? base.armDepth },
          s.roomPoints, s.waterWall, s.runLayout, s.openings,
        );
        // that corner already holds a same-kind corner unit AT THIS HEIGHT → a second one just goes red.
        // Refuse. The `mountY` guard is what lets a corner stack: an antresol (3rd-row) corner sits at
        // the same wall corner as the upper corner below it, so without it the height check reads the
        // lower corner as "occupied" and blocked every corner in the 3rd row (matches addCornerCab).
        const occupied = s.cabs.some(
          (c) => c.id !== id && c.corner && c.kind === seated.kind &&
            Math.abs((c.mountY ?? 0) - (seated.mountY ?? 0)) < 20 &&
            Math.hypot((c.px ?? 0) - (seated.px ?? 0), (c.pz ?? 0) - (seated.pz ?? 0)) < 60,
        );
        if (occupied) return { toast: "У этого угла уже есть угловой шкаф" };
        next = seated;
      }
      const swapped = s.cabs.map((c, j) => (j === i ? next : c));
      // COMPLETE THE L: turning one band into a corner converts the nearest OTHER-band cabinet at that
      // vertex into a corner too (see completeCornerL) — otherwise a lone upper corner mangles the end
      // base, and a lone base corner strands the upper reach strip.
      const completed = next.corner ? completeCornerL(swapped, next, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal) : swapped;
      // turning a module into (or out of) a corner can shift its wall's start frame — re-anchor the
      // neighbours so they stay put instead of sliding off the wall (only the touching one shrinks)
      const cabs = !!next.corner !== !!old.corner || completed !== swapped
        ? reanchorAfterCorner(s.cabs, completed, s.roomPoints, s.waterWall, s.runLayout, s.openings, s.reveal)
        : completed;
      return { ...cabHist(s), cabs };
    }),
  setMat: (i) =>
    set((s) => {
      const m = MATERIALS[i] ?? MATERIALS[0];
      return { ...cabHist(s), mat: i, runStyle: { ...s.runStyle, facade: parseInt(m.c.slice(1), 16) } };
    }),
  // continuous gesture (plan drag/rotate uses moveCabPlan live) → one snapshot up front
  beginCabEdit: () => set((s) => cabHist(s)),
  undoCab: () =>
    set((s) => {
      if (!s.cabsPast.length) return {};
      const prev = s.cabsPast[s.cabsPast.length - 1];
      return { cabsPast: s.cabsPast.slice(0, -1), cabsFuture: [...s.cabsFuture, cabNow(s)], ...prev };
    }),
  redoCab: () =>
    set((s) => {
      if (!s.cabsFuture.length) return {};
      const nxt = s.cabsFuture[s.cabsFuture.length - 1];
      return { cabsFuture: s.cabsFuture.slice(0, -1), cabsPast: [...s.cabsPast, cabNow(s)], ...nxt };
    }),
  setMode: (mode) => set({ mode }),

  flash: (msg) => set({ toast: msg }),
  clearToast: () => set({ toast: null }),
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  // settings + catalog are popup overlays (they keep the current screen mounted) — close the
  // menu on open. Only one at a time: they'd stack on the same backdrop otherwise.
  openSettings: () => set({ settingsOpen: true, catalogOpen: false, menuOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  openCatalog: () => set({ catalogOpen: true, settingsOpen: false, menuOpen: false }),
  closeCatalog: () => set({ catalogOpen: false }),

  // ---- projects (persisted to localStorage) ----
  saveCurrent: (withThumb = false) => {
    const s = get();
    let id = s.currentProjectId;
    const created = !id;
    if (!id) id = newProjectId();
    const design: DesignState = {};
    for (const k of PERSIST_KEYS) design[k] = (s as unknown as Record<string, unknown>)[k];
    // Never persist a menu screen (home/settings/…) as the project's resume point — the
    // 30s auto-save + leave-flush fire while on home, and reopening at "home" makes
    // openProject fall back to onboarding. Keep the last real design screen instead.
    // The fallback tests `prev.screen` against FLOW rather than merely "not a menu screen",
    // so a value that is neither — a retired screen like "space", or "projects" from before
    // Home absorbed the deal list — gets healed here instead of being copied forward. This is
    // the same test openProject applies on the way back in; localStorage holds whatever an
    // older build wrote, so the runtime check is what protects us, not the Screen type.
    if (MENU_SCREENS.includes(design.screen as Screen)) {
      const prev = loadProjectState(id) as Partial<AppState> | null;
      design.screen = prev?.screen && FLOW.includes(prev.screen) ? prev.screen : resumeScreen(s);
    }
    // Only (re)capture the thumbnail when asked (constructor entry). Otherwise pass null so
    // upsertProject KEEPS the existing image — the auto-save / leave-flush persist data
    // without disturbing the one consistent thumbnail captured on entry.
    //
    // The quote total is snapshotted on EVERY save, regardless of settings.showPricing: the
    // number costs one pure BOM×rates pass (the same one the ticker runs at 60fps), and storing
    // it unconditionally means the project list is already correct the moment a seller turns
    // pricing on. Only its DISPLAY is gated by the flag.
    upsertProject(id, design, undefined, withThumb ? captureThumbnail() : null, projectTotalUSD(s));
    if (created) set({ currentProjectId: id });
    if (withThumb) set((st) => ({ projectsRev: st.projectsRev + 1 })); // refresh any open list
    if (s.authUser) {
      const p = allProjects().find((x) => x.id === id); // full record with fresh meta
      if (p) trackSync(pushProject(s.authUser.id, p)); // push to the cloud + track status
    } else if (isSupabaseConfigured && !nudged() && s.cabs.length > 0) {
      // a guest's first REAL project (a kitchen has been designed) → soft, one-time
      // "sign in to sync" nudge. Guarded by a flag so it appears exactly once, ever.
      try { localStorage.setItem(NUDGE_KEY, "1"); } catch { /* ignore */ }
      set({ loginNudge: true });
    }
  },
  openProject: (id) => {
    const state = loadProjectState(id);
    if (!state) return;
    // Never restore to a menu screen — resume in the design (at a screen matching how far
    // the project got, so an existing project doesn't drop back into onboarding).
    const restored = state as Partial<AppState>;
    // `!FLOW.includes(...)` also catches a RETIRED screen — a project saved on the old onboarding
    // quiz would otherwise resume onto a screen that no longer exists in the journey, with no way
    // forward (next() has no case for it any more).
    if (!restored.screen || MENU_SCREENS.includes(restored.screen) || !FLOW.includes(restored.screen)) {
      restored.screen = resumeScreen(restored);
    }
    // repair any duplicate ids from projects saved before ids were collision-proof. Cabinets have
    // been healed here for a while; WALL ITEMS had the same bug and were not — a socket added after
    // a reload took an id the pipe already held, and from then on moving one moved both.
    if (Array.isArray(restored.cabs)) restored.cabs = dedupeIds(restored.cabs as Cabinet[]);
    if (Array.isArray(restored.fittings)) restored.fittings = dedupeWallItems(restored.fittings as Fitting[], "f");
    if (Array.isArray(restored.openings)) restored.openings = dedupeWallItems(restored.openings as Opening[], "o");
    set({ ...freshDesign(), ...restored, currentProjectId: id, menuOpen: false });
    set((s) => ({ projectsRev: s.projectsRev + 1 }));
  },
  newProject: () => set({ ...freshDesign(), currentProjectId: null, menuOpen: false }),
  removeProject: (id) => {
    deleteProject(id);
    if (get().authUser) trackSync(deleteProjectCloud(id));
    set((s) => ({
      projectsRev: s.projectsRev + 1,
      currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
    }));
  },
  renameProject: (id, patch) => {
    updateProjectMeta(id, patch);
    const s = get();
    if (s.authUser) {
      const p = allProjects().find((x) => x.id === id);
      if (p) trackSync(pushProject(s.authUser.id, p));
    }
    set(() => ({ projectsRev: s.projectsRev + 1 }));
  },
  setProjectBucket: (b) => set({ projectBucket: b }),
  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch };
      saveSettings(settings); // also republishes «Стандарт цеха» to model/construction.ts
      if (s.authUser) {
        clearTimeout(profileTimer); // debounce cloud push while typing
        const uid = s.authUser.id;
        profileTimer = setTimeout(() => trackSync(pushProfile(uid, useStore.getState().settings)), 800);
      }
      // The carcass geometry reads the shop standard from a module cache, not from `cabs` — so
      // nothing in the 3D's rebuild deps changes when the standard does. This counter is what
      // tells the open scene to redraw; without it a seller switching to 18мм ЛДСП would see the
      // kitchen keep its 16мм build until they happened to nudge a cabinet.
      const conChanged = patch.construction != null && patch.construction !== s.settings.construction;
      return conChanged ? { settings, constructionRev: s.constructionRev + 1 } : { settings };
    }),

  openAuth: () => set((s) => ({ screen: "auth", authReturn: s.screen === "auth" ? s.authReturn : s.screen, loginNudge: false, menuOpen: false })),
  closeAuth: () => set((s) => ({ screen: s.authReturn })),
  dismissNudge: () => set({ loginNudge: false }),
  signIn: async (email, password) => {
    if (!supabase) return { error: "Supabase не настроен" };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message };
  },
  signUp: async (email, password) => {
    if (!supabase) return { error: "Supabase не настроен" };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { error: error.message };
    // no session back → the project requires email confirmation before first login
    return { needsConfirm: !data.session };
  },
  signOut: async () => {
    await supabase?.auth.signOut();
  },
  resetPassword: async (email) => {
    if (!supabase) return { error: "Supabase не настроен" };
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message };
  },
  updatePassword: async (password) => {
    if (!supabase) return { error: "Supabase не настроен" };
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) set({ recovery: false });
    return { error: error?.message };
  },
  deleteAccount: async () => {
    if (!supabase) return { error: "Supabase не настроен" };
    const { error } = await supabase.rpc("delete_own_account");
    if (error) return { error: error.message };
    // wipe the local cache so nothing lingers, then sign out
    try {
      localStorage.removeItem("mebelchi.projects.v1");
      localStorage.removeItem("mebelchi.settings.v1");
      localStorage.removeItem("mebelchi.savedcabs.v1");
      localStorage.removeItem("mebelchi.migrated.v1");
      localStorage.removeItem(NUDGE_KEY);
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    return {};
  },
}));

// auto-save the current design to localStorage (debounced) once it has content,
// so the journey is captured as a project without an explicit "save" step
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = useStore.getState();
    if (s.cabs.length > 0 || Object.keys(s.quiz).length > 0) s.saveCurrent();
  }, 30_000);
});

// One-time-per-login sync: adopt the cloud profile + projects for this user.
// Cloud is the source of truth; on the very first login on this device we migrate any
// local-only projects up (so pre-account work isn't lost), guarded by a flag so a second
// account on the same device can't leak the first account's local projects.
const MIGRATED_KEY = "mebelchi.migrated.v1";
async function syncOnLogin(userId: string): Promise<void> {
  try {
    const profile = await pullProfile(userId);
    if (profile) {
      // the pricing settings (toggles, modes, per-m² rate, fx rates, USD price list) have no
      // cloud columns yet — keep the device's local values so login doesn't reset them
      const local = useStore.getState().settings;
      const merged = {
        ...profile,
        showPricing: local.showPricing,
        pricingItems: local.pricingItems,
        pricingSqm: local.pricingSqm,
        sqmRate: local.sqmRate,
        fxRates: local.fxRates,
        rates: local.rates,
        sheetW: local.sheetW,
        sheetH: local.sheetH,
        kerf: local.kerf,
        respectGrain: local.respectGrain,
        hangingsPerCarcass: local.hangingsPerCarcass,
        hangingSpanMm: local.hangingSpanMm,
        advancedExport: local.advancedExport,
        quality: local.quality,
      };
      saveSettings(merged);
      useStore.setState({ settings: merged });
    }
    const cloud = await pullProjects();
    try {
      if (!localStorage.getItem(MIGRATED_KEY)) {
        const cloudIds = new Set(cloud.map((p) => p.id));
        for (const lp of allProjects()) {
          if (!cloudIds.has(lp.id)) {
            await pushProject(userId, lp);
            cloud.push(lp);
          }
        }
        localStorage.setItem(MIGRATED_KEY, "1");
      }
    } catch {
      /* storage / push error — fall through with whatever cloud we have */
    }
    replaceAllProjects(cloud);
    useStore.setState((s) => ({ projectsRev: s.projectsRev + 1, screen: "home" }));
  } catch {
    /* offline / RLS error — keep the local cache, app still works */
  }

  // "My cabinets" library sync — INDEPENDENT of the projects sync above (its own try/catch),
  // so a projects hiccup never skips restoring the library. Union: cloud + any local-only cabs
  // (pushed up); the cloud is authoritative but a LOCAL cab is never dropped. If the pull errors
  // (returns null) we leave the local cache untouched rather than clobber it with nothing.
  try {
    const cloudCabs = await pullSavedCabs();
    if (cloudCabs) {
      const cloudIds = new Set(cloudCabs.map((c) => c.id));
      for (const lc of allSavedCabs()) if (!cloudIds.has(lc.id)) { await pushSavedCab(userId, lc); cloudCabs.push(lc); }
      replaceAllSavedCabs(cloudCabs);
      useStore.setState((s) => ({ savedCabsRev: s.savedCabsRev + 1 }));
    }
  } catch { /* library sync is best-effort */ }
}

// wire Supabase auth → store: pick up an existing session on load, then track changes;
// run the login sync once when a user appears (not on token refresh)
if (supabase) {
  let syncedUser: string | null = null;
  const toUser = (u: { id: string; email?: string } | undefined | null): AuthUser | null =>
    u ? { id: u.id, email: u.email ?? "" } : null;
  const handle = (event: string, session: { user?: { id: string; email?: string } } | null) => {
    const authUser = toUser(session?.user);
    useStore.setState({ authUser, authReady: true });
    // opened the reset link → show "set a new password" instead of the app
    if (event === "PASSWORD_RECOVERY") useStore.setState({ recovery: true });
    if (authUser) {
      if (syncedUser !== authUser.id) {
        syncedUser = authUser.id;
        trackSync(syncOnLogin(authUser.id));
      }
    } else {
      syncedUser = null;
    }
  };
  // GUEST-FIRST HAS TO MEAN GUEST-FIRST, INCLUDING WHEN THE BACKEND IS UNREACHABLE.
  //
  // App.tsx renders nothing but a «Загрузка…» splash until `authReady` flips, and the only thing
  // that flipped it was this promise resolving. It had no .catch() and no timeout — so a rejected
  // or hanging getSession() (blocked DNS, a captive/proxied network, Supabase down or throttled,
  // a TLS failure) left the app on that splash FOREVER, with no UI at all. Every feature would
  // look absent, on a device where nothing we ship is at fault.
  //
  // Designing a kitchen needs no account and no network, so the app must never be gated on one.
  // Fail OPEN: open up regardless, and let a session arrive late if it ever does — `handle` is
  // safe to run afterwards and simply fills in the user.
  const AUTH_READY_TIMEOUT_MS = 3000;
  const openAnyway = () => {
    if (!useStore.getState().authReady) useStore.setState({ authReady: true });
  };
  const authTimer = setTimeout(openAnyway, AUTH_READY_TIMEOUT_MS);
  supabase.auth
    .getSession()
    .then(({ data }) => handle("INITIAL_SESSION", data.session))
    .catch(openAnyway)
    .finally(() => clearTimeout(authTimer));
  supabase.auth.onAuthStateChange((event, session) => handle(event, session));
}

// ── A MERGED BOX IS A PROMISE ABOUT GEOMETRY ───────────────────────────────────────────────────
// Same kind, same height, same depth, adjacent on the same wall. Raise one member's height, drag it
// to another wall, or delete the cabinet in the middle of the row, and that promise is broken — the
// box can no longer be built, and a box that cannot be built must not be priced or sent to a shop.
//
// There are a dozen ways to edit the run (the sheet, the plan, the 3D arrows, the module editor,
// undo). Rather than make each of them remember the rule — which is how an invariant rots — the
// rule is enforced once, here, on any change to `cabs`. Dissolving a broken group is always safe:
// the worst case is the seller re-taps «Объединить».
//
// Idempotent (healing healed cabs returns the same array), so this cannot loop.
useStore.subscribe((s, prev) => {
  if (s.cabs === prev.cabs) return;
  const healed = healCarcassGroups(s.cabs);
  if (healed !== s.cabs) useStore.setState({ cabs: healed });
});

// dev-only: lets local tooling drive the store directly (stripped from prod builds)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
}

/** THE PANEL SPECS as one stable object — the фартук and the ceiling closer.
 *
 *  A hook rather than a raw selector because the 3D rebuilds when this reference changes: returning
 *  a fresh `{ splash, closer }` on every render would rebuild the whole kitchen group on every
 *  render. The two specs are only ever replaced wholesale (setSplash / setCloser), so memoising on
 *  them is exact. */
export function usePanelSpecs(): PanelSpecs {
  const splash = useStore((s) => s.splash);
  const closer = useStore((s) => s.closer);
  const underside = useStore((s) => s.underside);
  return useMemo(() => ({ splash, closer, underside }), [splash, closer, underside]);
}
