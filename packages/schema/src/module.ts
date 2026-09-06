// A single cabinet module in the run (PRICING_AND_SCHEMA.md §1).

import type { MM, UUID } from "./common.js";

export type ModuleKind = "base" | "tall" | "upper";

export type ModuleFill = "shelves" | "drawers" | "open";

/**
 * THE FRONT'S BODY. Not a colour and not a material — the shape of the door itself, which is what
 * separates a plain slab kitchen from a neoclassic or a fluted one.
 *
 *   flat    — a plain slab
 *   shaker  — a routed frame around a recessed panel
 *   raised  — a routed frame around a RAISED, profiled panel (неоклассика)
 *   fluted  — vertical ribs routed across the face (рифлёный)
 *   glass   — a frame with a glass pane (витрина)
 *   grid    — a glass front with a mullion grid (витрина с раскладкой)
 *   none    — no front at all
 *
 * All but `glass`/`grid` are ONE piece of MDF: the CNC routes the profile into a single blank and it
 * is then painted. So a profiled front is a panel PLUS a machining operation — never an assembled
 * frame. Glass is the exception: the blank's middle is routed out and a bought pane goes in.
 *
 * (This replaces `DoorStyle = "flat" | "milled" | "glass" | "none"`, of which only `"none"` was ever
 * read by anything.)
 */
export type FrontProfile = "flat" | "shaker" | "raised" | "fluted" | "glass" | "grid" | "none";

/** @deprecated the old four-member style; kept as an alias while callers migrate */
export type DoorStyle = FrontProfile;

export type HandleType = "bar" | "profile" | "knob" | "none";

export interface ModuleDoor {
  style: FrontProfile;
  hingeSide?: "L" | "R";
}

export interface ModuleHandle {
  type: HandleType;
}

/** A door's opening side (hinge for left/right; hydraulic lift for top/bottom). */
export type DoorOpening = "left" | "right" | "top" | "bottom";

/** Where the handle sits on a door / drawer front. "center" = a central knob; "none" =
 *  handleless (a push-to-open / tip-on latch — a real hardware item in production). */
export type HandlePos = "top" | "bottom" | "left" | "right" | "center" | "none";

/** A recursive interior cell — the hybrid model. Separators SPLIT a cell into `children`
 *  (rows = horizontal separators, cols = vertical), creating a grid of cells. A `front`
 *  (door / drawer) is then placed onto a cell — and because a front can sit on a SPLIT node,
 *  ONE door can cover a whole group of cells (the children become the compartments behind
 *  it). No front → an open compartment.
 *
 *  This is THE interior model. It supersedes the flat `fill`/`count`/`dividers` fields, which
 *  survive only as the legacy shape a tree is derived from (see pricing's `deriveLayout`). */
export interface Cell {
  split?: "rows" | "cols";
  sizes?: number[]; // child fractions (normalized to sum 1)
  children?: Cell[];
  front?: "door" | "drawer"; // covers this cell's whole rect; undefined = open
  opening?: DoorOpening; // door only (default "left")
  handle?: HandlePos; // handle placement
  /** drawer only: a top-down split of the drawer FLOOR into organizer compartments
   *  (cutlery tray). Same recursive model, edited from a top view. Never a cut panel. */
  organizer?: Cell;
}

/** A door covering a rectangular block of the interior (fractions 0..1), spanning any number
 *  of cells. An overlay on top of the cell tree — it can span across rows AND columns, which
 *  a single tree node cannot express. */
export interface CombinedDoor {
  fx0: number;
  fy0: number;
  fx1: number;
  fy1: number;
  opening?: DoorOpening;
  handle?: HandlePos;
}

export interface Module {
  id: UUID;
  kind: ModuleKind;
  w: MM;
  h: MM;
  d: MM;
  fill: ModuleFill;
  /** Number of shelves or drawers. */
  count: number;
  /** Vertical separators (0..n). */
  dividers: number;
  door: ModuleDoor;
  handle: ModuleHandle;
  /** THE interior, as a cell tree. When present it supersedes `fill`/`count`/`dividers` for
   *  the whole decomposition (panels, fronts, hinges, slides). Absent → the decomposition
   *  falls back to those legacy fields. The app always sends one. */
  layout?: Cell;
  /** Doors spanning a rectangular block of cells — an overlay on `layout`. */
  combinedDoors?: CombinedDoor[];
  /** Optional override — enables the "split facade/carcass" advisor. */
  facadeMaterialId?: UUID;
  /** Applied hardening-panel preset ids. */
  hardening?: string[];
  /**
   * SHARED CARCASS. Modules tagged with the same `carcassGroup` are built as ONE box: two outer
   * sides, a shared stile at every internal boundary, and one top / bottom / back spanning the
   * whole run — instead of N separate boxes each with its own pair of sides.
   *
   * This is the economy build a workshop quotes for a row of wall units: four 600mm uppers merged
   * into one 2400 carcass drop from 8 side panels to 5 vertical panels, from 4 backs to 1, and
   * (crucially) from 8 wall hangers to one set for the whole box.
   *
   * The FRONTS ARE UNCHANGED. Every module keeps its own doors and drawers at exactly the size it
   * had standalone — merging is a carcass decision, not a facade one, so the kitchen looks
   * identical. Only the shell behind it changes.
   *
   * Absent (the default, and every project saved before this existed) → the module is its own
   * carcass, and the decomposition is bit-identical to what it always was.
   */
  carcassGroup?: string;
  /** WALL HANGERS (навесы) fitted to THIS BOX — an override of the shop's standing rule.
   *
   *  The rule (ProductionOpts.hangingsPerCarcass / hangingSpanMm) is what the workshop does by
   *  default, and it is right nearly always. But it is a rule about WIDTH, and it cannot know that
   *  this particular box carries a stone worktop, or hangs on plasterboard, or holds the microwave —
   *  which is exactly when a fitter wants a third pair of навесы and no formula will tell him so.
   *
   *  Read off the box's FIRST module (see pricing/carcass.hangingCount). Absent → the rule applies. */
  hangings?: number;
  /**
   * THIS BOX HANGS ON THE WALL rather than standing on the floor.
   *
   * Always true of a wall unit, and now expressible for a base or a tall as well: lifted off the
   * floor, one is carried by навесы exactly like an upper is. It matters to the quote — a hung box
   * needs the brackets and a standing one does not — so it travels on the module rather than being
   * guessed from the kind.
   */
  hung?: boolean;
  /**
   * PER-ROLE PANEL OVERRIDES — the first-class panel model, at the granularity that is actually
   * useful.
   *
   * Every panel in a box has always been derived from the module (parts.ts `carcassPanels`), and
   * every one of them took the carcass's own depth. That is right for a side and wrong for a shelf:
   * shops routinely cut shelves shallower so a door closes clean over the front edge, and there was
   * no way to say so — the cut list ordered a full-depth board and the 3D drew one.
   *
   * Keyed by ROLE, not by individual panel. A shop does not decide that THIS shelf is 500 and the
   * one above it is 520; it decides that shelves are 500. Per-individual-panel control is a
   * different, much larger feature and this is deliberately not it.
   */
  panels?: Partial<Record<PanelPart, PanelOverride>>;
}

/**
 * WHAT A PANEL IS, structurally.
 *
 * This vocabulary already existed as a naming convention inside the cut list («shelf-2»,
 * «side-left», «stile-1») and was re-parsed from strings wherever anyone needed it. Naming it makes
 * it a key that per-role overrides — depth today, material and edge banding next — can hang off.
 */
export type PanelPart =
  | "side"
  | "stile"
  | "bottom"
  | "top"
  | "back"
  | "shelf"
  | "divider"
  | "door"
  | "drawer"
  | "glass"
  | "mullion";

export interface PanelOverride {
  /** How deep this role's panels are cut (mm). Absent → the carcass's own depth. */
  depthMm?: number;
  /**
   * WHICH EDGES OF THIS ROLE ARE BANDED. Absent → the role's own default.
   *
   * `front` is the ordinary answer for an interior board: the one edge you see when the door is
   * open. `all` is what an open shelf unit gets, where every edge is on show. `none` is a shop
   * that genuinely leaves them raw.
   */
  banding?: PanelBanding;
}

export type PanelBanding = "none" | "front" | "all";
