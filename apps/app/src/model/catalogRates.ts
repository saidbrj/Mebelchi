// Makes the shop's own catalog prices drive the quote.
//
// THE GAP THIS CLOSES. The pricing engine bills sheet goods by AREA — `RateOverrides` holds
// one blanket $/m² per material type (sheetPerM2, facadePerM2…) that a seller edits in
// Настройки. The catalog holds something more specific: the price of ONE SHEET of the exact
// decor this kitchen is made of. Until now those never met, so a seller could correct a
// price in Каталог and watch the смета not move — the quote was still billing the blanket
// rate for a decor it knew nothing about.
//
// THE RULE: specific beats general. When the design has actually picked a catalog decor AND
// that decor carries enough to derive a rate (a price and a sheet size), its rate wins.
// Otherwise the seller's Настройки rate stands. Nothing is silently zeroed — a material with
// no sheet size simply doesn't override anything.
//
// WHICH DECOR THE DESIGN USES. A cabinet stores a finish COLOUR, not a material id, so the
// path back is `dominant colour per part → catalogByColor → the material`. That is the same
// lookup the AI render prompt uses to name the material (model/renderPrompt.ts) — one way of
// answering "what is this kitchen actually made of", not a second one that can disagree.

import type { Cabinet, FinishKey } from "./cabinet";
import type { KitchenStyle } from "./layout";
import type { RateOverrides } from "./settings";
import { catalogByColor } from "./catalog";
import type { EmanMaterial } from "./materials";

/** One sheet's area in m², or undefined when the record isn't a sheet good (a handle). */
export function sheetAreaM2(m: EmanMaterial): number | undefined {
  if (!m.sheetW || !m.sheetH) return undefined;
  const a = (m.sheetW * m.sheetH) / 1e6;
  return a > 0 ? a : undefined;
}

/** What one unit costs. `price` buys `per` of them — 1 sheet, or a pack of 2 handles. */
export function unitPrice(m: EmanMaterial): number {
  const per = m.per > 0 ? m.per : 1;
  return m.price / per;
}

/** The $/m² a sheet-goods decor implies, or undefined if it can't be derived. */
export function materialPerM2(m: EmanMaterial | undefined): number | undefined {
  if (!m || m.price <= 0) return undefined;
  const area = sheetAreaM2(m);
  if (!area) return undefined;
  return unitPrice(m) / area;
}

/** The $/running-metre a worktop slab implies. A worktop is billed by LENGTH, not area —
 *  the shop buys a 3200mm slab and cuts a counter run from it, so the width is a given of
 *  the product rather than something the quote varies. */
export function materialPerM(m: EmanMaterial | undefined): number | undefined {
  if (!m || m.price <= 0 || !m.sheetW) return undefined;
  const metres = m.sheetW / 1000;
  return metres > 0 ? unitPrice(m) / metres : undefined;
}

/** The catalog decor a design predominantly uses for one part, via its finish colour.
 *  Appliances are skipped: a fridge's panel is not a statement about the kitchen's facade. */
export function dominantMaterial(cabs: Cabinet[], part: FinishKey, fallback: number): EmanMaterial | undefined {
  const tally = new Map<number, number>();
  for (const c of cabs) {
    if (c.appliance && c.appliance !== "none" && c.appliance !== "filler") continue;
    const v = c.finish?.[part] ?? fallback;
    tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  let best = fallback;
  let bestN = -1;
  for (const [v, n] of tally) if (n > bestN) ((bestN = n), (best = v));
  return catalogByColor(best, part);
}

/** What the catalog contributes to this design's rates — undefined per field where the
 *  catalog has nothing to say. Exported so the Смета can SHOW which rates came from the
 *  catalog rather than leaving the seller to wonder why a number moved. */
export interface CatalogRates {
  sheetPerM2?: number;
  facadePerM2?: number;
  worktopPerM?: number;
}

/** A rate the catalog supplied, WITH the decor it came from — so Настройки can say
 *  "this field is currently overridden, by this material" instead of leaving a seller to
 *  wonder why the number they typed isn't the number being billed. */
export interface CatalogSource {
  key: keyof CatalogRates;
  rate: number;
  material: EmanMaterial;
}

export function catalogSourcesFor(cabs: Cabinet[], style: KitchenStyle): CatalogSource[] {
  if (!cabs.length) return [];
  const out: CatalogSource[] = [];
  const push = (key: keyof CatalogRates, m: EmanMaterial | undefined, rate: number | undefined) => {
    if (m && rate != null) out.push({ key, rate, material: m });
  };
  const carcass = dominantMaterial(cabs, "carcass", style.carcass);
  const facade = dominantMaterial(cabs, "facade", style.facade);
  const worktop = dominantMaterial(cabs, "worktop", style.worktop);
  push("sheetPerM2", carcass, materialPerM2(carcass));
  push("facadePerM2", facade, materialPerM2(facade));
  push("worktopPerM", worktop, materialPerM(worktop));
  return out;
}

export function catalogRatesFor(cabs: Cabinet[], style: KitchenStyle): CatalogRates {
  const out: CatalogRates = {};
  for (const s of catalogSourcesFor(cabs, style)) out[s.key] = s.rate;
  return out;
}

/**
 * The seller's price list with the catalog's more-specific rates laid over it.
 *
 * NOT overridden, deliberately:
 *  • `backPerM2` — a cabinet has no `finish.back`, so there is no way to know which ХДФ the
 *    design uses. Wiring it off a guess would be worse than leaving the seller's rate alone.
 *  • handles — the seed rate table has no handle SKU at all, so a handle's catalog price has
 *    nowhere to land. Pricing them needs a new BOM line, not a rate override.
 * Both are honest gaps rather than silent approximations.
 */
export function ratesForDesign(base: RateOverrides, cabs: Cabinet[], style: KitchenStyle): RateOverrides {
  if (!cabs.length) return base;
  const c = catalogRatesFor(cabs, style);
  return {
    ...base,
    ...(c.sheetPerM2 != null ? { sheetPerM2: c.sheetPerM2 } : {}),
    ...(c.facadePerM2 != null ? { facadePerM2: c.facadePerM2 } : {}),
    ...(c.worktopPerM != null ? { worktopPerM: c.worktopPerM } : {}),
  };
}
