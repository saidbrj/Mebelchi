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
// Pure. No React, no store.

import type { Cabinet } from "./cabinet";
import { shelfPositions, dividerPositions } from "./cabinet";

/** Above this clear span a shelf sags under a normal load and gets reinforced (thicker board, or a
 *  mid-support on the really wide ones). 800mm is the usual workshop line for 16mm LDSP. */
export const REINFORCE_SPAN_MM = 800;
/** …and past THIS it needs a centre support as well, not just a thicker board. */
export const MID_SUPPORT_SPAN_MM = 1100;

const CARCASS_T = 16; // side panel thickness (mm)

/** The clear span of one shelf in this cabinet — the interior width, divided by its bays. A vertical
 *  divider is exactly a way of halving the span, which is why a 900mm cabinet with a divider needs no
 *  reinforcement at all and a 900mm one without it does. */
export function shelfSpan(c: Cabinet): number {
  const bays = dividerPositions(c.div, c.dividerXs).length + 1;
  return Math.max(0, (c.w - 2 * CARCASS_T) / bays);
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
}

/** What THIS cabinet needs. Null when nothing does — which is the common case, and the point: a
 *  kitchen of 600mm cabinets is reinforced nowhere, and says so. */
export function reinforcementFor(c: Cabinet): Reinforcement | null {
  if (c.furniture || c.appliance) return null; // a machine housing has no shelves to sag
  const n = shelfPieces(c);
  if (!n) return null;
  const span = shelfSpan(c);
  if (span <= REINFORCE_SPAN_MM) return null;
  return { shelves: n, midSupports: span > MID_SUPPORT_SPAN_MM ? n : 0, span: Math.round(span) };
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
} {
  let shelves = 0;
  let midSupports = 0;
  let totalShelves = 0;
  let n = 0;
  let widest = 0;
  for (const c of cabs) {
    totalShelves += shelfPieces(c);
    const r = reinforcementFor(c);
    if (!r) continue;
    shelves += r.shelves;
    midSupports += r.midSupports;
    widest = Math.max(widest, r.span);
    n++;
  }
  return { shelves, midSupports, totalShelves, cabs: n, widest };
}
