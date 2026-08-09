// УСИЛЕНИЕ — reinforced shelves, decided by SPAN.
//
// This used to be a global switch. Flipping it tagged exactly ONE module — the first `fill: "open"`
// one, or module #0 if there wasn't one — with a single "standard-shelf" preset, which became one
// labour line on the quote. It was a stub wearing a feature's clothes: it reinforced nothing in
// particular, it picked its victim arbitrarily, and a seller flipping it had no way to know what
// they had just bought.
//
// A shop does not reinforce A KITCHEN. It reinforces A SHELF, and it does so for one reason: the
// shelf is too wide to carry a load without sagging. That is a property of the SPAN, not of the
// project — so it is computed, not asked. A 400mm shelf never needs it and a 1000mm one always does,
// and no seller should have to know the threshold.
//
// WHY THE THRESHOLD IS A FORMULA NOW, NOT A NUMBER.
// It used to be `REINFORCE_SPAN_MM = 800` — "the usual workshop line for 16mm ЛДСП". One number
// cannot be right for two different shelves: stiffness scales with the shelf's DEPTH (linearly)
// and with its THICKNESS (cubed), and 800 was measurably optimistic at the shallow end. A 300mm-deep
// upper's shelf actually starts sagging at ~560mm, not 800 — and an upper's shelf is the one at eye
// level, the one the customer sees drooping a year later. The formula below is the standard case
// and it is cited, not guessed:
//
//   δ = 5qL⁴ / (384·E·I),   I = b·h³/12,   serviceability limit L/240,   long-term creep ×1.5
//
// Simply-supported (not fixed-fixed) is the correct boundary condition: our shelves sit on Ø5 pins,
// they are not glued into the sides. Source: `37_MINIMUM_SIZE_GATE.md` §2.3 (which restates R33),
// with E cited to EN 312 P2's own bending-MOE table and corroborated by the EGGER Eurospan and
// Kronospan P2 datasheets, and the L/240 limit to the Composite Panel Association's shelving
// bulletin. The creep multiplier is why a shelf that looks fine on day one sags by year two.
//
// Pure. No React, no store.

import type { Cabinet } from "./cabinet";
import { shelfPositions, dividerPositions } from "./cabinet";
import { constructionOf } from "./construction";
import { cabDepth } from "./bands";

/** Bending modulus of ЛДСП (EN 312 type P2, 13–20mm band), N/mm². EGGER Eurospan E1 P2 and
 *  Kronospan Trading P2 both publish this same figure for the band. */
export const E_LDSP_N_MM2 = 1600;
/** Deflection limit as a fraction of the span: L/240. A serviceability limit — past it the shelf
 *  sags visibly. It does not break. */
export const DEFLECTION_LIMIT_DIVISOR = 240;
/** Particleboard and MDF creep under sustained load: the long-term sag is ~1.5× the day-one
 *  elastic figure, so the check runs against `1.5 × δ`, never the instantaneous value. */
export const CREEP_FACTOR = 1.5;
/** Assumed shelf load, kg per running metre.
 *
 *  OPEN DECISION — and the one number here that is NOT cited. No default for `q` exists anywhere in
 *  the shop's corpus; the research doc names picking it as a founder decision and offers 15–20 kg/m
 *  as the range furniture-shelving literature uses for books and kitchenware.
 *
 *  We take 15, the LOW end, and the reason is worth writing down because it is a judgement call, not
 *  a finding: at 20 kg/m a perfectly ordinary 600mm upper lands about 2% over the line — inside the
 *  formula's own uncertainty, since E varies by board and the load is an assumption to begin with —
 *  and a gate that flags every standard cabinet in the catalogue is a gate the seller turns off. At
 *  15 the check still catches everything that is unambiguously too wide (any span past ~620mm on a
 *  shallow upper, ~760mm on a full-depth base) without re-pricing kitchens that have been built and
 *  hung for years without complaint.
 *
 *  Every threshold in this module moves with this number. When the founder settles it — ideally as a
 *  shop setting next to the board thickness, since a shop that fits pantries carries more than one
 *  that fits show kitchens — this is the single line to change. */
export const DEFAULT_LOAD_KG_PER_M = 15;

const G = 9.81; // m/s² — kg per metre → newtons per metre

/**
 * The longest a shelf of this thickness and depth may span before its long-term sag passes L/240.
 *
 * `thicknessMm` is the board's real thickness (h in the formula — cubed, so it dominates);
 * `depthMm` is the shelf's front-to-back dimension (b — the module depth, which is exactly what
 * the cut list gives a shelf panel for its width).
 */
export function maxShelfSpan(thicknessMm: number, depthMm: number, loadKgPerM = DEFAULT_LOAD_KG_PER_M): number {
  if (thicknessMm <= 0 || depthMm <= 0 || loadKgPerM <= 0) return Infinity;
  const I = (depthMm * thicknessMm ** 3) / 12; // mm⁴, second moment of area
  const q = (loadKgPerM * G) / 1000; // N/mm, uniformly distributed
  // solve  CREEP · 5qL⁴/(384·E·I) ≤ L/240  for L
  const L3 = (384 * E_LDSP_N_MM2 * I) / (DEFLECTION_LIMIT_DIVISOR * CREEP_FACTOR * 5 * q);
  return Math.cbrt(L3);
}

/** A shelf's front-to-back dimension: the module depth, the same figure the cut list bills it at. */
const shelfDepth = (c: Cabinet): number => cabDepth(c);

/** Past this span THIS cabinet's shelves sag and get reinforced (a doubled board). */
export function reinforceSpanFor(c: Cabinet): number {
  return maxShelfSpan(constructionOf(c).boardThickness, shelfDepth(c));
}

/** …and past THIS even the reinforced shelf sags, so it needs a centre support as well.
 *
 *  A reinforced shelf is TWO GLUED LAYERS of the shop's own board — never a single 32mm blank,
 *  which is the shop's standing rule. Glued layers act compositely, so the effective thickness is
 *  2×t, which is 8× the stiffness and therefore 2× the allowable span. */
export function midSupportSpanFor(c: Cabinet): number {
  return maxShelfSpan(2 * constructionOf(c).boardThickness, shelfDepth(c));
}

/** The clear span of one shelf in this cabinet — the interior width, divided by its bays, minus the
 *  dividers that stand between them. A vertical divider is exactly a way of halving the span, which
 *  is why a 900mm cabinet with a divider needs no reinforcement at all and a 900mm one without it
 *  does. Thickness comes from the shop standard, never a literal — an 18mm shop has narrower bays. */
export function shelfSpan(c: Cabinet): number {
  const t = constructionOf(c).boardThickness;
  const bays = dividerPositions(c.div, c.dividerXs).length + 1;
  return Math.max(0, (c.w - 2 * t - (bays - 1) * t) / bays);
}

/** How many shelf PIECES this cabinet has: one per level, per bay. */
function shelfPieces(c: Cabinet): number {
  if (c.fill !== "shelves") return 0;
  const levels = shelfPositions(c.count, c.shelfYs).length;
  const bays = dividerPositions(c.div, c.dividerXs).length + 1;
  return levels * bays;
}

export interface Reinforcement {
  /** the shelf pieces in this cabinet that need reinforcing */
  shelves: number;
  /** …and how many of those are wide enough to want a centre support too */
  midSupports: number;
  /** the clear span that triggered it (mm) */
  span: number;
  /** the span this cabinet's shelves were allowed (mm) — what `span` exceeded */
  limit: number;
}

/** What THIS cabinet needs. Null when nothing does — which is the common case, and the point: a
 *  kitchen of 600mm cabinets is reinforced nowhere, and says so. */
export function reinforcementFor(c: Cabinet): Reinforcement | null {
  if (c.furniture || c.appliance) return null; // a machine housing has no shelves to sag
  const n = shelfPieces(c);
  if (!n) return null;
  const span = shelfSpan(c);
  const limit = reinforceSpanFor(c);
  if (span <= limit) return null;
  return {
    shelves: n,
    midSupports: span > midSupportSpanFor(c) ? n : 0,
    span: Math.round(span),
    limit: Math.round(limit),
  };
}

/** The hardening presets `toProject` puts on a module — one per shelf piece that needs it, plus one
 *  per centre support. Pricing bills `hardeningPerPreset` per entry, so the count IS the cost. */
export function hardeningPresets(c: Cabinet): string[] | undefined {
  const r = reinforcementFor(c);
  if (!r) return undefined;
  return [
    ...Array.from({ length: r.shelves }, () => "standard-shelf"),
    ...Array.from({ length: r.midSupports }, () => "mid-support"),
  ];
}

/** The whole kitchen's reinforcement, for the Инженерия read-out. Reinforcement is now a FACT about
 *  the design, not a decision — so it is reported, not asked. */
export function reinforcementReport(cabs: Cabinet[]): {
  shelves: number;
  midSupports: number;
  totalShelves: number;
  cabs: number;
  widest: number;
  /** the tightest span limit in play across the shelved modules (mm) — the number the "nothing to
   *  reinforce" line quotes, so it is this project's real threshold and not a global constant */
  limit: number;
} {
  let shelves = 0;
  let midSupports = 0;
  let totalShelves = 0;
  let n = 0;
  let widest = 0;
  let limit = Infinity;
  for (const c of cabs) {
    const pieces = shelfPieces(c);
    totalShelves += pieces;
    if (pieces && !c.furniture && !c.appliance) limit = Math.min(limit, reinforceSpanFor(c));
    const r = reinforcementFor(c);
    if (!r) continue;
    shelves += r.shelves;
    midSupports += r.midSupports;
    widest = Math.max(widest, r.span);
    n++;
  }
  return {
    shelves,
    midSupports,
    totalShelves,
    cabs: n,
    widest,
    limit: Math.round(Number.isFinite(limit) ? limit : maxShelfSpan(16, 560)),
  };
}
