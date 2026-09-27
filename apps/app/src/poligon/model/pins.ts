// ПОЛИГОН · Laws C, C-STAMP, E and V-PROVENANCE — the pin, and where every value came from.
//
// A pin is the one place a person overrules the rules: "this door, this colour, because the
// customer asked". `50` Law C says four things about it, and all four exist because of the same
// failure — a pin that quietly stops meaning anything:
//
//   attached to PART IDENTITY   not to a position, so it survives the first drag
//   PER-PROPERTY                pinning a colour must not freeze a thickness
//   ORPHANS VISIBLY             when its part stops existing, it surfaces; it never evaporates
//   COUNTABLE                   "37 pins" is a health metric; a rule system nobody trusts grows
//                               pins until it is a spreadsheet with extra steps
//
// C-STAMP (`59` §3.1) adds the fifth, and it is the subtle one. A pin set when a board was a
// 600mm base side still applies after that board becomes an 1800mm tall side — the id is
// structural, so it survived, and the pin is now decorating something nobody pinned. So a pin
// records the FACET VALUES that held when it was set, and drift is SURFACED AT RESOLVE.
//
// Never auto-corrected. Auto-correcting drift means the app silently discards a human decision,
// which is the single thing a pin exists to prevent.
//
// Law E lands here too, from the other direction: every value reaching an output must be declared
// somewhere a person can see and change. `provenance` is that guarantee made queryable — for each
// property, the value, the layer, the rule that set it, and whether a pin has drifted.

import { resolve, type Layer, type Property, type Rule } from "./cascade";
import type { Facets } from "./facets";

// ─── the pin ──────────────────────────────────────────────────────────────────────────────────

/** The facets a pin remembers. Deliberately the Tier-0 ones plus length: they are what a person
 *  was actually looking at when they pinned, and what changes when a design moves under them. */
export interface FacetStamp {
  role: Facets["role"];
  zone: Facets["zone"];
  adjacency: Facets["adjacency"];
  module: string;
  lengthMm: number;
}

export const stampOf = (f: Facets): FacetStamp => ({
  role: f.role, zone: f.zone, adjacency: f.adjacency, module: f.module, lengthMm: f.lengthMm,
});

export interface Pin {
  id: string;
  /** structural part identity (DB/51 H1) — never a position, never a UUID */
  partId: string;
  /** ONE property. Pinning a colour leaves the thickness free. */
  property: Property;
  value: string | number;
  /** who and when, because a pin nobody can explain is a pin nobody dares delete */
  note?: string;
  at: string;
  /** C-STAMP — what was true when this was set */
  stamp: FacetStamp;
}

/** One facet that has changed since the pin was set. Reported, never acted on. */
export interface Drift {
  facet: keyof FacetStamp;
  was: string | number;
  now: string | number;
}

export function driftOf(pin: Pin, f: Facets): Drift[] {
  const now = stampOf(f);
  return (Object.keys(pin.stamp) as (keyof FacetStamp)[])
    .filter((k) => pin.stamp[k] !== now[k])
    .map((k) => ({ facet: k, was: pin.stamp[k], now: now[k] }));
}

// ─── resolution with pins on top ──────────────────────────────────────────────────────────────

export interface Decision {
  property: Property;
  value: unknown;
  layer: Layer;
  /** the rule id, or the pin id when a pin decided */
  by: string;
  /** populated only when a pin decided AND the world moved under it */
  drift?: Drift[];
}

/** The pin layer is the highest in `LAYERS`, so a pin always wins. It wins LOUDLY: if the board it
 *  is attached to has changed shape since, the drift rides along with the answer. */
export function resolvePinned(
  boardId: string, facets: Facets, property: Property, rules: Rule[], pins: Pin[],
): Decision {
  const pin = pins.find((p) => p.partId === boardId && p.property === property);
  if (pin) {
    const drift = driftOf(pin, facets);
    return {
      property, value: pin.value, layer: "pin", by: pin.id,
      ...(drift.length ? { drift } : {}),
    };
  }
  const r = resolve(boardId, facets, property, rules);
  return { property, value: r.value, layer: r.layer, by: r.ruleId };
}

// ─── orphans, counts, and drift across a whole design ─────────────────────────────────────────

/** A pin whose part no longer exists. It is RETURNED, not dropped: the design changed under a
 *  decision somebody made on purpose, and that is worth a line on screen. */
export const orphanPins = (pins: Pin[], liveIds: string[]): Pin[] =>
  pins.filter((p) => !liveIds.includes(p.partId));

export interface PinCensus {
  total: number;
  orphaned: number;
  drifted: number;
  byProperty: Record<string, number>;
}

/** Countable — the health metric. A design carrying forty pins is not being driven by its rules
 *  any more, and the number is the only way anyone finds that out before the rules stop paying. */
export function census(pins: Pin[], facets: Map<string, Facets>): PinCensus {
  const byProperty: Record<string, number> = {};
  let drifted = 0;
  for (const p of pins) {
    byProperty[p.property] = (byProperty[p.property] ?? 0) + 1;
    const f = facets.get(p.partId);
    if (f && driftOf(p, f).length > 0) drifted++;
  }
  return {
    total: pins.length,
    orphaned: orphanPins(pins, [...facets.keys()]).length,
    drifted,
    byProperty,
  };
}

// ─── Law E · provenance ───────────────────────────────────────────────────────────────────────

/** Every property this board answers, with the source of each answer. Nothing in a part list is
 *  allowed to come from anywhere else — that is Law E, and this is how you check it rather than
 *  believe it. */
export function provenance(
  boardId: string, facets: Facets, properties: readonly Property[], rules: Rule[], pins: Pin[],
): Decision[] {
  return properties.map((prop) => resolvePinned(boardId, facets, prop, rules, pins));
}
