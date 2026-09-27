// ПОЛИГОН · T7 — the cascade: how a value reaches a board, and in what order.
//
// A rule never names a board. It describes one, and the set falls out (`50` Law A). Membership is
// computed at resolve time and stored nowhere. What makes that safe is not the ban on storage —
// pins store a board reference too — but that a stale reference must fail LOUDLY: a pin surfaces
// as an orphan, where a stored group would quietly lose a member and ship a wrong cut list.
//
// ─── THE PIPELINE, AND WHY THE ORDER IS NOT AN IMPLEMENTATION DETAIL ──────────────────────────
//
//   P0  Sheet            lines, segments, junctions, blocks, modules
//   P1  Resolve GEOMETRIC parameters   predicates may match Tier-0 facets ONLY
//   P2  Derive geometry               junctions → board runs → model dimensions
//   P3  Compute Tier-3 facets         edge exposure, final size
//   P4  Resolve APPEARANCE parameters predicates may match any tier
//   P5  Validate                      minimums, collisions, domains
//   P6  Project to the CUT plane      banding, kerf, tolerance
//
// Feedback from P4 into P1 is impossible BY CONSTRUCTION, because a P1 rule that references a
// Tier-3 facet is rejected when it is WRITTEN, not when it runs (`51` D8). That is what makes
// resolution provably terminate, and it is the difference between a rule system and a solver.

import { FACET_TIER, type Facets } from "./facets";

/** Low → high. The system layer must be TOTAL — it defines every property for every board, so
 *  resolution can never return nothing and "why is this board unresolved" is never a ticket. */
export const LAYERS = ["system", "catalog", "theme", "project", "wall", "module", "block", "pin"] as const;
export type Layer = (typeof LAYERS)[number];

/** P1 — parameters that FEED GEOMETRY. A rule setting one of these may match Tier-0 facets only. */
export const GEOMETRIC = [
  "thickness", "depth", "setback", "overlay", "gap", "clearance", "presence",
] as const;
/** P4 — parameters that describe a finished surface. They feed nothing, so they may match anything. */
export const APPEARANCE = ["material", "color", "kromka", "texture", "hardware"] as const;

export type GeometricProperty = (typeof GEOMETRIC)[number];
export type AppearanceProperty = (typeof APPEARANCE)[number];
export type Property = GeometricProperty | AppearanceProperty;

export const phaseOf = (p: Property): "P1" | "P4" =>
  (GEOMETRIC as readonly string[]).includes(p) ? "P1" : "P4";

/** Every property a rule is allowed to set. The union is closed on purpose. */
export const PROPERTIES = [...GEOMETRIC, ...APPEARANCE] as readonly Property[];

export interface UndeclaredProperty {
  ruleId: string;
  property: string;
  detail: string;
}

/** DB/51 D2 — rules set only TYPE-DECLARED parameters. Inside this repo the `Property` union makes
 *  that a compile error, but rules also arrive from Themes and from files, where the compiler is
 *  not present. So the same law needs a runtime gate at the door, checked when a rule pack is
 *  LOADED rather than when one of its rules happens to fire.
 *
 *  The other half of D2 — "rules cannot invent parts" — needs no check, because it is structural:
 *  a rule sets a property on a board that already exists, and the only things that can bring a
 *  board into being are the ops in the closed `Op` union. There is no code path from a rule to a
 *  new part, which is stronger than any validation. */
export function checkRuleProperties(rules: { id: string; property: string }[]): UndeclaredProperty[] {
  return rules
    .filter((r) => !(PROPERTIES as readonly string[]).includes(r.property))
    .map((r) => ({
      ruleId: r.id,
      property: r.property,
      detail:
        `rule "${r.id}" sets "${r.property}", which is not a declared parameter. ` +
        `Declared: ${PROPERTIES.join(", ")}. A rule may set a parameter a Type declares; ` +
        `it may not introduce one.`,
    }));
}

/** A declarative predicate — an object, not a function, so a Theme can be serialised, shipped,
 *  diffed and inspected. A lambda in a rule pack is unshippable, and it also cannot be checked
 *  for stratification, which would quietly reopen the cycle this file exists to close. */
export interface Selector {
  role?: Facets["role"] | Facets["role"][];
  axis?: Facets["axis"];
  layer?: Facets["layer"];
  adjacency?: Facets["adjacency"];
  zone?: Facets["zone"] | Facets["zone"][];
  module?: string;
  span?: Facets["span"];
  tag?: string;
  /** Tier-3 — legal for appearance rules, refused for geometric ones */
  edgeExposure?: Facets["edgeExposure"][number];
  minLengthMm?: number;
  maxLengthMm?: number;
}

/** Which facet each selector field reads. The stratification check walks this, so a new selector
 *  field cannot be added without declaring the facet — and therefore the tier — it depends on. */
const SELECTOR_FACET: Record<keyof Selector, keyof Facets> = {
  role: "role", axis: "axis", layer: "layer", adjacency: "adjacency", zone: "zone",
  module: "module", span: "span", tag: "tags",
  edgeExposure: "edgeExposure", minLengthMm: "lengthMm", maxLengthMm: "lengthMm",
};

export interface Rule {
  id: string;
  layer: Layer;
  property: Property;
  value: string | number;
  where: Selector;
}

export interface Resolved {
  value: string | number;
  ruleId: string;
  layer: Layer;
}

export class ConflictError extends Error {
  constructor(readonly boardId: string, readonly property: Property, readonly layer: Layer, readonly rules: Rule[]) {
    super(
      `Conflict on ${boardId} · ${property} @${layer}: ` +
      rules.map((r) => `${r.id}="${r.value}"`).join(" vs ") +
      ` — two rules in one layer disagree; move one to a different layer.`,
    );
  }
}

export class IncompleteError extends Error {
  constructor(readonly boardId: string, readonly property: Property) {
    super(`No rule defines ${property} for ${boardId}. The system layer must be total.`);
  }
}

// ─── stratification (D8) ──────────────────────────────────────────────────────────────────────

export interface StratificationProblem {
  ruleId: string;
  property: Property;
  field: keyof Selector;
  facet: keyof Facets;
  detail: string;
}

/** Checked when a rule is WRITTEN, not when it runs. A geometric rule matching a Tier-3 facet is
 *  a cycle: thickness changes lengths, lengths decide which boards match, matching changes
 *  thickness. There is no fixpoint to find, and looking for one is the solver DB/48 refuses. */
export function checkStratification(rules: Rule[]): StratificationProblem[] {
  const out: StratificationProblem[] = [];
  for (const rule of rules) {
    if (phaseOf(rule.property) !== "P1") continue;
    for (const field of Object.keys(rule.where) as (keyof Selector)[]) {
      const facet = SELECTOR_FACET[field];
      if (FACET_TIER[facet] === 0) continue;
      out.push({
        ruleId: rule.id, property: rule.property, field, facet,
        detail:
          `rule "${rule.id}" sets ${rule.property} (geometric, P1) but matches on ${field} → ` +
          `facet "${facet}" is Tier-3 and is not known until after geometry is derived. ` +
          `This is a cycle. If you meant coarse exposure, match on "adjacency" (Tier-0) instead.`,
      });
    }
  }
  return out;
}

// ─── matching and resolution ──────────────────────────────────────────────────────────────────

const asArray = <T>(v: T | T[] | undefined): T[] | undefined =>
  v === undefined ? undefined : Array.isArray(v) ? v : [v];

export function matches(f: Facets, s: Selector): boolean {
  const roles = asArray(s.role);
  if (roles && !roles.includes(f.role)) return false;
  const zones = asArray(s.zone);
  if (zones && !zones.includes(f.zone)) return false;
  if (s.axis && f.axis !== s.axis) return false;
  if (s.layer && f.layer !== s.layer) return false;
  if (s.adjacency && f.adjacency !== s.adjacency) return false;
  if (s.module && f.module !== s.module) return false;
  if (s.span && f.span !== s.span) return false;
  if (s.tag && !f.tags.includes(s.tag)) return false;
  if (s.edgeExposure && !f.edgeExposure.includes(s.edgeExposure)) return false;
  if (s.minLengthMm !== undefined && f.lengthMm < s.minLengthMm) return false;
  if (s.maxLengthMm !== undefined && f.lengthMm > s.maxLengthMm) return false;
  return true;
}

/** Resolve one property for one board, and say WHICH rule decided it — the inspector thesis in a
 *  return value. Tap a board, see the chain that set its colour.
 *
 *  `phase` narrows the visible facets: during P1 the Tier-3 ones have not been computed, so
 *  passing them is a programming error rather than a rule error, and `checkStratification` has
 *  already refused any rule that would need them. */
export function resolve(
  boardId: string, facets: Facets, property: Property, rules: Rule[],
): Resolved {
  let winner: Resolved | null = null;

  for (const layer of LAYERS) {
    const hits = rules.filter(
      (r) => r.layer === layer && r.property === property && matches(facets, r.where),
    );
    if (hits.length === 0) continue;
    const distinct = new Set(hits.map((h) => h.value));
    if (distinct.size > 1) throw new ConflictError(boardId, property, layer, hits);
    winner = { value: hits[0]!.value, ruleId: hits[0]!.id, layer };
  }

  if (!winner) throw new IncompleteError(boardId, property);
  return winner;
}

/** What a rule would touch — and, just as importantly, what it would NOT, because a lower layer
 *  already holds those boards. A restyle that silently spares fourteen boards is how a user stops
 *  trusting the cascade. */
export function blastRadius(
  facets: Map<string, Facets>, rule: Rule, rules: Rule[],
): { changed: string[]; heldByLowerLayer: { boardId: string; by: Resolved }[] } {
  const changed: string[] = [];
  const heldByLowerLayer: { boardId: string; by: Resolved }[] = [];

  for (const [boardId, f] of facets) {
    if (!matches(f, rule.where)) continue;
    let current: Resolved | null = null;
    try { current = resolve(boardId, f, rule.property, rules); } catch { current = null; }
    const ruleRank = LAYERS.indexOf(rule.layer);
    if (current && LAYERS.indexOf(current.layer) > ruleRank) heldByLowerLayer.push({ boardId, by: current });
    else if (!current || current.value !== rule.value) changed.push(boardId);
  }
  return { changed, heldByLowerLayer };
}
