// THE CARCASS — the box the workshop actually builds, which is not always one cabinet.
//
// A run of four 600mm wall units can be built two ways. As four boxes: 8 side panels, 4 tops, 4
// bottoms, 4 backs, 4 sets of wall hangers. Or as ONE 2400 box with three shared stiles: 5 vertical
// panels, 1 top, 1 bottom, 1 back, 1 set of hangers. Same kitchen, same fronts, materially less
// board and hardware — which is exactly the economy build a workshop quotes when it wants to win a
// job on price.
//
// So the unit of PRODUCTION is the carcass, not the module. `groupCarcasses` is the one place that
// decides which modules share a box; everything downstream (panels, edge banding, joints, hangers,
// assembly, delivery) counts per carcass and therefore gets the saving for free.
//
// THE INVARIANT THAT MAKES THIS SAFE: a carcass holding ONE module decomposes bit-identically to
// the old per-module code. Merging is opt-in, absent by default, and every project saved before it
// existed prices to the same сум it always did.
//
// Pure. No I/O.

import type { Module, ProductionOpts } from "../../schema/src/index.js";

/**
 * One box. `modules` are the cabinets it holds, LEFT TO RIGHT — order matters: the first and last
 * get the outer sides, and the boundaries between them get the shared stiles.
 *
 * A length-1 carcass is an ordinary standalone cabinet.
 */
export interface Carcass {
  /** stable id — the group tag when merged, else the lone module's id */
  id: string;
  modules: Module[];
}

/** The shop's build conventions when the project carries none. Reproduces the historic behaviour:
 *  one set of hangers per wall box, no extra sets however wide it gets. */
export const DEFAULT_PRODUCTION: ProductionOpts = {
  hangingsPerCarcass: 2,
  hangingSpanMm: 0,
};

export function resolveProduction(p?: Partial<ProductionOpts>): ProductionOpts {
  return { ...DEFAULT_PRODUCTION, ...(p ?? {}) };
}

/** Can these two modules physically share a box? They must be the same kind and have the same
 *  height and depth — you cannot merge a 720 upper with a 900 one, there is no single side panel
 *  that serves both. The APP only ever tags valid sets (see model/carcassGroups.ts), but pricing
 *  is fed by saved projects and by API callers, so it re-checks rather than trusting the tag. */
export function canShareCarcass(a: Module, b: Module): boolean {
  return a.kind === b.kind && a.h === b.h && a.d === b.d;
}

/**
 * Split a run into the boxes the shop builds.
 *
 * Modules carrying the same `carcassGroup` merge — but only while they stay CONTIGUOUS in the run
 * and compatible with each other. A group interrupted by a foreign module, or containing a module
 * of a different height, splits at that point rather than silently pricing a box that cannot be
 * built. Untagged modules are each their own carcass.
 */
export function groupCarcasses(run: Module[]): Carcass[] {
  const out: Carcass[] = [];
  for (const m of run) {
    const open = out[out.length - 1];
    const joins =
      open &&
      m.carcassGroup != null &&
      open.id === m.carcassGroup &&
      canShareCarcass(open.modules[0], m);
    if (joins) open.modules.push(m);
    else out.push({ id: m.carcassGroup ?? m.id, modules: [m] });
  }
  // a group whose members got split apart by the contiguity rule can leave two carcasses claiming
  // the same id; make them unique so panel ids downstream stay unique
  const seen = new Map<string, number>();
  for (const c of out) {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    if (n > 0) c.id = `${c.id}#${n + 1}`;
  }
  return out;
}

/** Total width of the box (mm). */
export function carcassWidth(c: Carcass): number {
  return c.modules.reduce((w, m) => w + m.w, 0);
}

/** The kind of box this is — every member is the same kind (canShareCarcass enforces it). */
export function carcassKind(c: Carcass): Module["kind"] {
  return c.modules[0].kind;
}

/**
 * Wall hangers for one box.
 *
 * ZERO unless it hangs on a wall — a base cabinet stands on the floor and a column on its own
 * plinth. This is the line that makes merging pay: a 2400 carcass takes ONE set of hangers where
 * the four 600s it replaced took four.
 *
 * With `hangingSpanMm: 0` (the default) a box gets one set however wide it is — the mounting-rail
 * build. Set a span and wide boxes get proportionally more.
 */
export function hangingCount(c: Carcass, opts: ProductionOpts): number {
  if (carcassKind(c) !== "upper") return 0;
  // AN EXPLICIT OVERRIDE ON THE BOX BEATS THE RULE. The shop's width rule is right nearly always,
  // but it cannot know that this box holds the microwave or hangs on plasterboard — and that is
  // precisely when the fitter wants another pair of навесы. Zero is a legitimate answer (a box
  // sitting on a rail), so this is `!= null`, not a truthiness test.
  const override = c.modules[0]?.hangings;
  if (override != null) return Math.max(0, Math.round(override));
  const per = Math.max(0, opts.hangingsPerCarcass);
  if (per === 0) return 0;
  const span = Math.max(0, opts.hangingSpanMm);
  const sets = span > 0 ? Math.max(1, Math.ceil(carcassWidth(c) / span)) : 1;
  // A навес screws to a SIDE PANEL, and a box of N modules has N+1 of them. A narrow span rule can
  // ask for more than that; billing brackets with nowhere to go would make the quote disagree with
  // the drawing (and with the fitter).
  return Math.min(per * sets, c.modules.length + 1);
}
