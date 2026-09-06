// The project model — the central contract everything reads from
// (PRICING_AND_SCHEMA.md §1). Stored as small JSON per the ADR-001 sync model.

import type { UUID } from "./common.js";
import type { Space } from "./space.js";
import type { Module } from "./module.js";

export interface MaterialSelection {
  /** Corpus material (LDSP etc.). */
  carcassId: UUID;
  /** Default facade material — the MDF BLANK a front is routed from, whatever its profile. */
  facadeId: UUID;
  /** Glass for a витрина front's pane. Absent → a glazed front falls back to the facade material,
   *  which is what happened before glass existed. */
  glassId?: UUID;
  worktopId?: UUID;
  /** 2mm kromka. */
  edgeVisibleId: UUID;
  /** 0.4mm kromka. */
  edgeHiddenId: UUID;
}

/** Which rate table this quote used, and when it was snapshotted. */
export interface ProjectPricing {
  rateTableId: UUID;
  snapshotAt: string;
}

export interface ProjectMeta {
  variantArchetype?: string;
}

/**
 * The workshop's BUILD CONVENTIONS — how this shop actually assembles a carcass, as opposed to
 * what it charges (rates) or what it builds out of (materials). Every seller's shop differs, so
 * these are settings, not constants; they travel on the Project so a saved quote reprices under
 * the conventions it was quoted with rather than whatever the seller has configured today.
 *
 * Absent → `DEFAULT_PRODUCTION` (see @mebelchi/pricing), which reproduces the historic hardcoded
 * behaviour exactly.
 */
export interface ProductionOpts {
  /** Wall hangers (навесы) fitted per wall carcass — per BOX, not per module. This is the whole
   *  economic point of a merged row: four separate uppers need four sets, one merged carcass needs
   *  one. Applies to `upper` modules only; a base cabinet stands on the floor. */
  hangingsPerCarcass: number;
  /** Add another set of hangers every N mm of carcass width. 0 = one set per carcass however wide
   *  it gets — which is what a shop using a mounting rail (монтажная планка) does, and what makes a
   *  2400 merged row cost 2 hangers instead of 8. A shop that wants a pair every 900mm sets 900. */
  hangingSpanMm: number;
}

/**
 * A FLAT WALL PANEL — the фартук between the counter and the wall units, or the strip that closes
 * the cabinetry to the ceiling.
 *
 * Not a Module: no carcass, no front, no hardware, no interior. It is one finished sheet with a
 * size, a stock and some holes in it, and that is the whole of what the shop needs to make it and
 * what the quote needs to charge for it. Modelling it as a zero-everything Module would have made
 * every walk in `parts.ts` guard against it.
 *
 * The app DERIVES these from the layout (apps/app model/wallPanels.ts) rather than storing them, so
 * they cannot fall out of step with the cabinets they sit between.
 */
export interface FlatPanel {
  id: UUID;
  kind: "splash" | "closer";
  /** finished size (mm) */
  w: number;
  h: number;
  t: number;
  /** WHAT IT IS CUT FROM. `worktop` bills per running metre off the counter slab — a постформинг
   *  фартук really is cut from the same 600-wide slab as the counter, so the counter's п.м. rate is
   *  the right one. The sheet stocks bill per m². */
  stock: "worktop" | "facade" | "carcass";
  /** THE DECOR'S OWN NAME, as the catalog calls it («Мрамор белый»). The rate table only knows
   *  generic stock, and its names carry the SLAB's thickness — a фартук listed as «Столешница
   *  постформинг 38мм · 6мм» is a contradiction the shop has to guess its way out of. The decor is
   *  also what actually gets ordered. Absent → fall back to the stock's name. */
  decor?: string;
  /** WHICH WALL it goes on (1-based, as the drawings number them). The fitter arriving with six
   *  flat boards needs to know which one belongs where, and the cut map has no cabinet number to
   *  borrow. Absent on a panel that isn't attributed to a run. */
  wall?: number;
  /** THE HOLES IN IT — sockets, switches, vents — in PANEL-LOCAL mm from its bottom-left corner.
   *
   *  Carried as real rectangles, not a total length: the quote only needs the routed contour, but
   *  the cut list has to SAY there are holes and the machine file has to put them somewhere. A
   *  фартук that reaches the shop without its socket cut-outs is one that gets cut twice. */
  cutouts?: PanelCutout[];
}

/** A rectangular hole in a flat panel, panel-local mm. */
export interface PanelCutout {
  x: number;
  y: number;
  w: number;
  h: number;
  /** what it is for, in the seller's words — "Розетка", "Вытяжная решётка" */
  label?: string;
}

export interface Project {
  id: UUID;
  name: string;
  ownerId: UUID;
  units: "mm";
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
  schemaVersion: 1;

  /** From manual entry OR a RoomPlan scan. */
  space: Space;
  /** The cabinet run. */
  run: Module[];
  /** The flat wall panels — фартук + the strip to the ceiling. Absent → none, exactly as before. */
  panels?: FlatPanel[];
  /** The LED built into the cabinetry, already measured. Absent → none, exactly as before. */
  lighting?: ProjectLighting;
  /** Openings routed out of the COUNTER — a sink's bowl, a cooktop's. Absent → an uncut slab. */
  worktopCuts?: WorktopCut[];
  materials: MaterialSelection;
  pricing: ProjectPricing;
  /** How this workshop builds a box. Absent → the engine defaults. */
  production?: ProductionOpts;
  meta?: ProjectMeta;
}

/**
 * THE LIGHT BUILT INTO THE CABINETRY, as quantities.
 *
 * Already measured: the app derives the strips from the layout (model/ledStrips.ts) and hands the
 * pricing engine metres and counts. The engine has no idea where a cabinet is and should not learn
 * — the same split the flat panels use.
 */
export interface ProjectLighting {
  /** metres of strip cut off the reel */
  metres: number;
  /** metres of aluminium profile + diffuser — the strip is not screwed to bare board */
  profileM: number;
  /** drivers, sized to the load rather than counted per run */
  psu: number;
  /** door sensors / IR switches, when the client is paying for them instead of a wall switch */
  sensors: number;
}

/**
 * AN OPENING ROUTED OUT OF THE COUNTER.
 *
 * A sink's bowl and a cooktop are the same operation to the shop: a rectangle cut out of the slab,
 * billed by the metre of routed contour. Sized upstream (apps/app model/sink.ts), because how big
 * the hole is depends on the MOUNT — a rimless sink cuts the bowl exactly, a rimmed one cuts
 * smaller so the rim lands on slab — and the engine has no business knowing that.
 */
export interface WorktopCut {
  kind: "sink" | "hob";
  /** the opening's size (mm) */
  w: number;
  d: number;
}
