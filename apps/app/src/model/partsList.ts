// The CNC parts list — the "just give us the real sizes" deliverable a nesting router / its
// optimiser (CutRite, bSolid, WoodWOP, NestingWorks…) imports. Unlike the manual cut plan
// (model/nest.ts), this does NO nesting and adds NO kerf: the machine does its own nesting and
// compensates for the ROUTER BIT (~6–8 mm, wider than a saw's ~4 mm kerf), so pre-nesting or
// pre-spacing here would come out wrong. We hand over FINISHED part sizes exactly as the pricing
// engine computed them, plus the metadata the optimiser needs (material, thickness, grain, edge).
//
// Glass panes are excluded — they arrive cut to size from the glazier and never go on the router,
// the same reason model/nest.ts drops them. Pure; the .xlsx and PDF exporters render the result.

import type { Production } from "./cncExport";

export interface PartLine {
  no: number; // 1-based row number
  module: string; // owning cabinet/box label — traceability for the assembler
  part: string; // Бок левый, Полка 1, Фасад…
  material: string;
  thicknessMm: number;
  lengthMm: number; // FINISHED size — exactly as production() computed it, no kerf added
  widthMm: number;
  qty: number;
  grain: boolean; // true = the panel has a run direction (a facade) → the optimiser must not rotate it
  edge: string; // edgeband spec (band thickness); the shop's software subtracts it from the finished size
  profile: string; // routed face profile, if any (blank on a carcass panel)
}

export interface PartsList {
  lines: PartLine[];
  totalParts: number; // Σ qty — physical panels the router cuts
  distinct: number; // number of grouped rows
  boardM2: number; // area of the sawn parts (Σ L·W·qty), glass excluded
  hardware: { name: string; qty: number }[];
}

/** Build the CNC parts list from the run's production package. Exact duplicates (same module,
 *  part, material, thickness, size, edge, profile and grain) merge into one row with a summed
 *  Qty; everything else stays a distinct, fully-traceable line. `respectGrain` mirrors the
 *  manual nest's setting so the two exports agree on which panels are grained. */
export function partsList(prod: Production, respectGrain: boolean): PartsList {
  const groups = new Map<string, PartLine>();
  let order = 0;

  for (const p of prod.panels) {
    if (p.role === "glass") continue; // bought cut to size — nothing for the router to cut
    const grain = respectGrain && p.role === "facade";
    const key = [p.module, p.part, p.material, p.thicknessMm, p.lengthMm, p.widthMm, p.edge, p.profile, grain].join("¦");
    const hit = groups.get(key);
    if (hit) {
      hit.qty += 1;
    } else {
      groups.set(key, {
        no: order++, // provisional; renumbered after sorting
        module: p.module,
        part: p.part,
        material: p.material,
        thicknessMm: p.thicknessMm,
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        qty: 1,
        grain,
        edge: p.edge,
        profile: p.profile || "",
      });
    }
  }

  const lines = [...groups.values()].sort(
    (a, b) =>
      a.material.localeCompare(b.material) ||
      b.thicknessMm - a.thicknessMm ||
      b.lengthMm * b.widthMm - a.lengthMm * a.widthMm ||
      a.module.localeCompare(b.module),
  );
  lines.forEach((l, i) => (l.no = i + 1));

  const totalParts = lines.reduce((s, l) => s + l.qty, 0);
  const boardMm2 = lines.reduce((s, l) => s + l.lengthMm * l.widthMm * l.qty, 0);

  return {
    lines,
    totalParts,
    distinct: lines.length,
    boardM2: Math.round((boardMm2 / 1e6) * 100) / 100,
    hardware: prod.hardware,
  };
}
