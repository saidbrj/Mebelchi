// Bridge: the app's Cabinet run → the engine's Layer-2 drilling solver → a machining
// plan, a safety report, and the SWJ008 machine file. Reuses the SAME engine the cut
// list/pricing use, so the holes are the real spec-driven operations (cams, dowels,
// shelf pins, hinge cups) gated by the engine's safety validator — nothing exports dirty.
//
// We import the engine SOURCE directly (Vite resolves the .js specifiers to .ts, exactly
// as @mebelchi/pricing already does) and load the hardware spec as a plain JSON import,
// avoiding the engine index's JSON import-attribute path.

import { solveBaseCabinet } from "../../../../engine/solver/baseCabinet.js";
import { exportSWJ008 } from "../../../../engine/postprocessors/swj008.js";
import { validateParts } from "../../../../engine/core/validate.js";
import hardwareSpecRaw from "../../../../engine/catalogs/hardware_specs.dummy.json";
import type { HardwareSpec } from "../../../../engine/primitives/types.js";
import type { Cabinet } from "./cabinet";

export type { Part, Operation, DrillOp, ValidationFinding } from "../../../../engine/contracts/types.js";
import type { Part, ValidationFinding } from "../../../../engine/contracts/types.js";

const spec = hardwareSpecRaw as unknown as HardwareSpec;
const DEPTH: Record<Cabinet["kind"], number> = { base: 560, tall: 560, upper: 350 };

/** One cabinet → solver input (carcass + adjustable shelves + optional hinged door). */
function cabInput(c: Cabinet) {
  const shelves = c.fill === "shelves" ? Math.max(0, c.count) : 0;
  // a hinged door exists on a closed cabinet whose door style isn't "Без" (index 3);
  // drawers carry fronts (no hinges) and open units have no door — both skip the cup step
  const hasDoor = c.fill !== "drawers" && c.fill !== "open" && c.door !== 3;
  return {
    id: c.id,
    height_mm: c.h,
    width_mm: c.w,
    depth_mm: c.depth ?? DEPTH[c.kind] ?? 560,
    shelves,
    hasDoor,
    hingeEdge: "left" as const,
  };
}

/** Can the drilling solver handle this cabinet?
 *
 *  It cannot handle a CUSTOM INTERIOR. `solveBaseCabinet` takes a flat `{shelves, hasDoor}` and
 *  assumes evenly-spread shelves, ONE full-height door hinged on the left, and no drawers at all
 *  (it emits zero slide holes). Hand it a cell-tree cabinet and it drills confidently wrong: hinge
 *  cups where there is no door, shelf-pin rows where there is no shelf. Worse, `cabInput` reads
 *  `fill`/`count`, which the Fill Editor never updates — so it would work from the cabinet's
 *  PRE-EDIT shape.
 *
 *  Until the solver learns the tree, such a module is EXCLUDED and reported. A missing module in
 *  the machine file is a visible problem; a ruined panel is not. */
export const canDrill = (c: Cabinet): boolean => !c.layout && !c.combinedDoors?.length;

/** Solve the whole run into engine Parts WITH drill operations. Furniture and custom-interior
 *  modules excluded (see `canDrill`). */
export function solveRun(cabs: Cabinet[]): Part[] {
  const parts: Part[] = [];
  for (const c of cabs.filter((c) => !c.furniture && canDrill(c))) parts.push(...solveBaseCabinet(cabInput(c), spec));
  return parts;
}

export interface MachiningReport {
  parts: Part[];
  ok: boolean;
  findings: ValidationFinding[];
  holeCount: number;
  partCount: number;
  /** modules left out because the solver cannot drill a custom interior — surfaced in the UI so
   *  nobody ships a machine file that is quietly missing cabinets. */
  skipped: Cabinet[];
}

/** Solve + run the safety gate. The UI shows this before unlocking the machine file. */
export function machiningReport(cabs: Cabinet[]): MachiningReport | null {
  const real = cabs.filter((c) => !c.furniture);
  if (!real.length) return null;
  const skipped = real.filter((c) => !canDrill(c));
  const parts = solveRun(real);
  const v = validateParts(parts);
  const holeCount = parts.reduce((n, p) => n + p.operations.length, 0);
  return { parts, ok: v.ok, findings: v.findings, holeCount, partCount: parts.length, skipped };
}

/** SWJ008 machine file — ONLY if the safety gate passes (mirrors solveAndExportSWJ008). */
export function runSWJ008(cabs: Cabinet[]): string | null {
  const rep = machiningReport(cabs);
  // no parts = every module was skipped — don't hand the shop an empty machine file
  if (!rep || !rep.ok || !rep.parts.length) return null;
  return exportSWJ008({ id: "mebely", name: "Mebely kitchen", parts: rep.parts });
}
