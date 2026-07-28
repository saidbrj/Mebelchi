// Bridges the seller's editable price list (Settings.rates) to the engine's RateTable.
// The pricing engine consumes a full RateTable keyed by UUID; the seller edits a flat,
// friendly RateOverrides. `ratesToTable` clones the seed table (so all the UUID refs the
// project's MaterialSelection points at still resolve) and overwrites the numbers with the
// seller's own — matching the same material/edge/worktop/hardware picks toProject makes.

import { seedRateTable } from "@mebelchi/pricing";
import type { RateTable } from "@mebelchi/schema";
import type { RateOverrides } from "./settings";

/** The seller's price list merged over the seed rate table. Always USD (the base currency);
 *  the UI converts the resulting quote to the seller's display currency. */
/** THE HARDWARE GRADE, as a price. «Класс фурнитуры» used to be a LABEL — written to the handoff CSV
 *  and read by nothing, so a seller could pick «Премиум» and watch the quote not move. It is the
 *  single biggest swing in a real kitchen's hardware bill (generic hinges against Blum is not a
 *  rounding error), so it has to be money.
 *
 *  It scales the two SKUs a grade actually IS — hinges and drawer slides. It deliberately does NOT
 *  scale навесы, dowels, cams or minifix: nobody buys premium dowels, and pretending they do would
 *  inflate the quote with a number the seller cannot defend to a client. */
export type HwGrade = "eco" | "std" | "premium";
export const HW_GRADE_FACTOR: Record<HwGrade, number> = { eco: 0.7, std: 1, premium: 1.8 };

export function ratesToTable(o: RateOverrides, grade: HwGrade = "std"): RateTable {
  // deep clone so we never mutate the shared seed (JSON clone: the seed is pure JSON, and
  // this works on every WebView regardless of structuredClone support)
  const t = JSON.parse(JSON.stringify(seedRateTable)) as RateTable;

  for (const m of Object.values(t.materials)) {
    if (m.type === "LDSP") m.pricePerM2 = o.sheetPerM2;
    else if (m.type === "MDF") m.pricePerM2 = o.facadePerM2;
    else if (m.type === "HDF") m.pricePerM2 = o.backPerM2;
    else if (m.type === "GLASS") m.pricePerM2 = o.glassPerM2;
  }

  // edges: toProject picks the two most-expensive as [visible, hidden] — mirror that order
  const edgeIds = Object.entries(t.edge)
    .sort((a, b) => b[1].pricePerM - a[1].pricePerM)
    .map(([id]) => id);
  if (edgeIds[0]) t.edge[edgeIds[0]].pricePerM = o.edgeVisiblePerM;
  if (edgeIds[1]) t.edge[edgeIds[1]].pricePerM = o.edgeHiddenPerM;

  const worktopId = Object.keys(t.worktop)[0];
  if (worktopId) t.worktop[worktopId].pricePerM = o.worktopPerM;

  const gf = HW_GRADE_FACTOR[grade] ?? 1;
  for (const hw of Object.values(t.hardware)) {
    // hinges + slides ARE the grade — эко / стандарт / премиум is a statement about these two and
    // nothing else, so they are the only SKUs it touches
    if (hw.sku.startsWith("HNG")) hw.pricePerUnit = o.hingePerUnit * gf;
    else if (hw.sku.startsWith("SLIDE")) hw.pricePerUnit = o.slidePerUnit * gf;
    // the навес a wall carcass hangs on. EVERY sku in this table must be claimed by a branch here:
    // the seed's numbers are сум, and the table is USD, so anything that falls through prices a
    // 7000-сум hanger at $7000.
    else if (hw.sku.startsWith("HANG")) hw.pricePerUnit = o.hangingPerUnit;
    // dowels / cams aren't exposed in the UI, but the seed's UZS values (300 / 1500) would be
    // read as $300 / $1500 now the table is USD — a cabinet has dozens, so convert to USD.
    else if (hw.sku.startsWith("DOWEL")) hw.pricePerUnit = 0.02; // 300 сум ÷ ~12600
    else if (hw.sku.startsWith("CAM")) hw.pricePerUnit = 0.12; // 1500 сум ÷ ~12600
  }

  t.operations.cutPerPanel = o.cutPerPanel;
  t.operations.drillPerHole = o.drillPerHole;
  // the facade material is a BLANK — the profile's cost is machine time, and it lands here.
  // Both default to 0, so a seller who never opens these fields prices exactly as before.
  t.operations.millPerM = o.millPerM;
  t.operations.flutePerM2 = o.flutePerM2;
  t.labor.assemblyPerModule = o.assemblyPerModule;
  t.labor.hardeningPerPreset = 2; // 25000 сум ÷ ~12600 — was left at the UZS value (→ $25000)
  t.delivery.base = o.deliveryBase;
  t.delivery.perModule = o.deliveryPerModule;
  t.currency = "USD"; // the base currency — quotes are USD, converted for display
  t.source = "manual"; // the seller's own numbers, not the Chin Wood snapshot
  return t;
}
