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
  materials: MaterialSelection;
  pricing: ProjectPricing;
  /** How this workshop builds a box. Absent → the engine defaults. */
  production?: ProductionOpts;
  meta?: ProjectMeta;
}
