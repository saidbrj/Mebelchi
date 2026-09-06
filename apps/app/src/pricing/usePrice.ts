// The live ticker. Recomputes priceProject on every store change that affects
// the model — cheap by design (PRICING_AND_SCHEMA.md: BOM × rates at 60fps).
// Returns 0 while there are no modules (quiz / space phases) so the ticker hides.

import { useMemo } from "react";
import { priceProject } from "@mebelchi/pricing";
import type { RateTable, ProductionOpts } from "@mebelchi/schema";
import { useStore } from "../store";
import { toProject, priceCabs, sqmPrice, panelsFor, bandsFor, lightingFor, type PanelInput } from "../model/toProject";
import { ratesToTable } from "../model/rates";
import { ratesForDesign } from "../model/catalogRates";
import { productionFrom } from "../model/settings";
import type { Cabinet } from "../model/cabinet";
import type { FlatPanel, PanelCutout, ProjectLighting } from "@mebelchi/schema";
import { backCutouts } from "../model/cutouts";
import { ledStrips, type LedStrip } from "../model/ledStrips";

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

/** THE ФАРТУК + the ceiling closer, as priceable panels — derived from the design, memoised.
 *
 *  Subscribed slice by slice rather than `useStore(panelsFor)`: that selector would build a fresh
 *  array on every store change and zustand compares by reference, so the ticker would re-render on
 *  every frame of every drag. */
function usePanelInput(): PanelInput {
  const cabs = useStore((s) => s.cabs);
  const roomPoints = useStore((s) => s.roomPoints);
  const waterWall = useStore((s) => s.waterWall);
  const runLayout = useStore((s) => s.runLayout);
  const openings = useStore((s) => s.openings);
  const reveal = useStore((s) => s.reveal);
  const ceiling = useStore((s) => s.ceiling);
  const fittings = useStore((s) => s.fittings);
  const splash = useStore((s) => s.splash);
  const closer = useStore((s) => s.closer);
  const underside = useStore((s) => s.underside);
  const led = useStore((s) => s.led);
  const runStyle = useStore((s) => s.runStyle);
  return useMemo(
    () => ({ cabs, roomPoints, waterWall, runLayout, openings, reveal, ceiling, fittings, splash, closer, underside, led, runStyle }),
    [cabs, roomPoints, waterWall, runLayout, openings, reveal, ceiling, fittings, splash, closer, underside, led, runStyle],
  );
}

/** The фартук + closer as PRICEABLE panels — what the quote and the cut list charge for. */
export function useDesignPanels(): FlatPanel[] {
  const input = usePanelInput();
  return useMemo(() => panelsFor(input), [input]);
}

/** The same panels as GEOMETRY, with the layout they were measured against — what a drawing needs
 *  (it lays a run out from the run's own zero, not the wall's). */
export function useDesignBands() {
  const input = usePanelInput();
  return useMemo(() => bandsFor(input), [input]);
}

/** THE BACK-PANEL NOTCHES, by module — where a riser runs up the face of the wall and the box is
 *  built around it. Derived from the same resolve the panels are, so a pipe that moves re-cuts
 *  every box it passes. */
export function useBackCutouts(): Map<string, PanelCutout[]> {
  const derived = useDesignBands();
  const fittings = useStore((s) => s.fittings);
  const openings = useStore((s) => s.openings);
  return useMemo(
    () => new Map((derived ? backCutouts(derived.L, fittings, openings) : []).map((b) => [b.cabId, b.cuts])),
    [derived, fittings, openings],
  );
}

/** THE LIGHT BUILT INTO THE CABINETRY, measured — metres of strip, the profile, the drivers.
 *  Derived from the same resolve the panels are, so moving a cabinet reprices the light with it. */
export function useDesignLighting(): ProjectLighting | undefined {
  const input = usePanelInput();
  return useMemo(() => lightingFor(input), [input]);
}

/** The STRIPS themselves, as geometry — what the 3D draws. Same list, before it is measured. */
export function useLedStrips(): LedStrip[] {
  const derived = useDesignBands();
  const led = useStore((s) => s.led);
  return useMemo(() => (derived ? ledStrips(derived.L, led) : []), [derived, led]);
}

/** The USD amount to show in an ambient ticker for `cabs`, per the active pricing mode:
 *  the itemised cost when it's on (also the default), else the per-m² price. */
export function useDesignPrice(cabs: Cabinet[]): number {
  const rates = useRateTable();
  const prod = useProduction();
  const panels = useDesignPanels();
  const pricingItems = useStore((s) => s.settings.pricingItems);
  const pricingSqm = useStore((s) => s.settings.pricingSqm);
  const sqmRate = useStore((s) => s.settings.sqmRate);
  const lighting = useDesignLighting();
  return pricingItems || !pricingSqm ? priceCabs(cabs, rates, prod, panels, lighting) : sqmPrice(cabs, sqmRate);
}

export function usePrice(): number {
  const rates = useRateTable();
  return useStore((s) =>
    s.cabs.length ? priceProject(toProject(s), rates).total : 0,
  );
}
