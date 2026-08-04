// The live ticker. Recomputes priceProject on every store change that affects
// the model — cheap by design (PRICING_AND_SCHEMA.md: BOM × rates at 60fps).
// Returns 0 while there are no modules (quiz / space phases) so the ticker hides.

import { useMemo } from "react";
import { priceProject } from "@mebelchi/pricing";
import type { RateTable, ProductionOpts } from "@mebelchi/schema";
import { useStore } from "../store";
import { toProject, priceCabs, sqmPrice } from "../model/toProject";
import { ratesToTable } from "../model/rates";
import { ratesForDesign } from "../model/catalogRates";
import { productionFrom } from "../model/settings";
import type { Cabinet } from "../model/cabinet";

/** The seller's own price list as an engine RateTable (USD) — reactive to Настройки edits,
 *  to the hardware grade, AND to Каталог: the decor this kitchen is actually made of prices
 *  itself where it can (model/catalogRates.ts), falling back to the blanket per-m² rate. */
export function useRateTable(): RateTable {
  const rates = useStore((s) => s.settings.rates);
  // «Класс фурнитуры» is a PRICE, not a label — it scales the hinge and slide SKUs (model/rates.ts)
  const grade = useStore((s) => s.hwGrade);
  const cabs = useStore((s) => s.cabs);
  const style = useStore((s) => s.runStyle);
  // catalogRev is what makes a price edited in Каталог reach the ticker: the decor lookup
  // reads the live catalog, and without this the memo would hold yesterday's rate.
  const catalogRev = useStore((s) => s.catalogRev);
  return useMemo(
    () => ratesToTable(ratesForDesign(rates, cabs, style), grade),
    [rates, cabs, style, grade, catalogRev],
  );
}

/** How this workshop builds a box (hangers per carcass, hanger span) — reactive to Настройки. */
export function useProduction(): ProductionOpts {
  const per = useStore((s) => s.settings.hangingsPerCarcass);
  const span = useStore((s) => s.settings.hangingSpanMm);
  return useMemo(() => ({ hangingsPerCarcass: per, hangingSpanMm: span }), [per, span]);
}

/** The USD amount to show in an ambient ticker for `cabs`, per the active pricing mode:
 *  the itemised cost when it's on (also the default), else the per-m² price. */
export function useDesignPrice(cabs: Cabinet[]): number {
  const rates = useRateTable();
  const prod = useProduction();
  const pricingItems = useStore((s) => s.settings.pricingItems);
  const pricingSqm = useStore((s) => s.settings.pricingSqm);
  const sqmRate = useStore((s) => s.settings.sqmRate);
  return pricingItems || !pricingSqm ? priceCabs(cabs, rates, prod) : sqmPrice(cabs, sqmRate);
}

export function usePrice(): number {
  const rates = useRateTable();
  return useStore((s) =>
    s.cabs.length ? priceProject(toProject(s), rates).total : 0,
  );
}
