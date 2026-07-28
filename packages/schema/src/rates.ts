// The rate table — the swappable data source (PRICING_AND_SCHEMA.md §2).
// Stored in Supabase; seeded from an eman.uz snapshot, switched to an API/partner
// feed later WITHOUT touching pricing code. Old quotes keep their `rateTableId`
// so a saved project's price stays reproducible.

import type { UUID } from "./common.js";

export type MaterialType = "LDSP" | "MDF" | "HDF" | "solid" | "GLASS";

export interface MaterialRate {
  name: string;
  type: MaterialType;
  pricePerM2: number;
}

export interface EdgeRate {
  name: string;
  pricePerM: number;
}

export interface WorktopRate {
  name: string;
  pricePerM: number;
}

export interface HardwareRate {
  name: string;
  sku: string;
  pricePerUnit: number;
}

/** Per-unit machining operation rates. */
export interface OperationRates {
  drillPerHole: number;
  cutPerPanel: number;
  edgebandPerM: number;
  /** CNC routing of a front's profile — per metre of routed contour. A shaker / raised / glazed
   *  front is one MDF blank with its shape milled in, so THIS is what a profile costs, not extra
   *  parts. Seeded at 0: until the seller sets it, no existing quote moves. */
  millPerM: number;
  /** CNC fluting of a front's face — per m² of ribbed surface. Same story. */
  flutePerM2: number;
}

export interface LaborRates {
  assemblyPerModule: number;
  hardeningPerPreset: number;
}

export interface DeliveryRates {
  base: number;
  perModule: number;
}

/** The seller's working currency. Rates are entered and displayed natively in it — no
 *  cross-currency conversion (a KZT seller's numbers are KZT, a UZS seller's are UZS). */
export type Currency = "UZS" | "KZT" | "USD";

export interface RateTable {
  id: UUID;
  currency: Currency;
  effectiveDate: string;
  /** e.g. 'eman.uz snapshot 2026-06-20' | 'manual' | 'api:eman'. */
  source: string;
  materials: Record<UUID, MaterialRate>;
  edge: Record<UUID, EdgeRate>;
  worktop: Record<UUID, WorktopRate>;
  /** Hinges, slides, dowels, cams… */
  hardware: Record<UUID, HardwareRate>;
  operations: OperationRates;
  labor: LaborRates;
  delivery: DeliveryRates;
}
