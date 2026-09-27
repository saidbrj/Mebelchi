// ПОЛИГОН · T6/T7 — facets: what a board knows about itself, and WHEN it knows it.
//
// A rule never names a board. It describes one — "every free end", "every front in the upper
// zone" — and the set falls out (`50` Law A). That only works if a board carries enough about
// itself to be found by a sentence, so the facet vocabulary is not a detail, it IS the feature.
//
// ─── WHY TIERS ────────────────────────────────────────────────────────────────────────────────
//
// Tier is not cosmetic. It is what makes resolution provably terminate (`50` §5, `51` D8).
//
//   Tier 0 — knowable from TOPOLOGY alone: the sheet's lines, blocks and segments. No board
//            length has been computed yet.
//   Tier 3 — needs FINAL GEOMETRY: how long a board actually came out, which edges ended up
//            exposed.
//
// A rule that sets a GEOMETRIC parameter may match Tier-0 facets only. Otherwise you can write
// "parts wider than 900 use 18mm", where thickness changes interior widths, which changes which
// parts are wider than 900, which changes thickness — a cycle with no fixpoint, and chasing one
// is a solver.
//
// The apparent casualty is "exposed end panels use 18mm", which is a completely standard
// requirement. It is not a casualty, and the reason is the whole point of this file: COARSE
// exposure — is there a block on the other side of this panel — is topology, and it is Tier-0
// `adjacency`. Fine per-edge exposure needs final dimensions, stays Tier-3, and drives appearance
// only. The stratification costs nothing real.

import { linesOn, resolvePositions, type BlockId, type LineId, type Sheet } from "./sheet";
import { HEIGHT_BANDS, type HeightBand } from "./settings";
import { deriveModules, type Board } from "./runs";
import type { Role } from "./roles";

export type Tier = 0 | 3;

export type Layer = "behind" | "carcass" | "front" | "above";
/** R70 §2 — a band id from the PROFILE, not a closed set in the engine. A shop with three tiers
 *  and a bulkhead declares four bands; a garage declares two. Nothing here knows their names. */
export type Zone = string;
/** Tier-0 exposure: purely "what is on the other side", with no dimension involved. */
export type Adjacency = "free-end" | "abutting" | "wall-facing";
/** Tier-3 exposure: which of this board's own edges ended up visible. */
export type EdgeExposure = "exposed" | "hidden";

/** The index contract for `Facets.edgeExposure`. Two of these four edges bound the board's
 *  LENGTH (the ends of the run); the other two bound its DEPTH. Anything that turns banding into
 *  a size has to know which is which, or it subtracts the front band from the wrong dimension. */
export const EDGE = { lowEnd: 0, highEnd: 1, front: 2, back: 3 } as const;

/** the two edges whose banding lands on the length — the only ones a cut LENGTH may subtract */
export const LENGTH_EDGES = [EDGE.lowEnd, EDGE.highEnd] as const;

export interface Facets {
  // ── Tier 0 — topology ───────────────────────────────────────────────────────────────────────
  role: Role;
  axis: "v" | "h";
  layer: Layer;
  adjacency: Adjacency;
  zone: Zone;
  module: string;
  /** does this board pass a crossing, or terminate at one? */
  span: "spanning" | "terminating";
  tags: string[];
  // ── Tier 3 — final geometry ─────────────────────────────────────────────────────────────────
  edgeExposure: EdgeExposure[];
  lengthMm: number;
  thicknessMm: number;
}

/** Which tier each facet belongs to. The single source for the stratification check — a facet
 *  that is not in this table cannot be matched on at all, which is deliberate: an unlisted facet
 *  has no declared tier, and guessing one is how a cycle gets in. */
export const FACET_TIER: Record<keyof Facets, Tier> = {
  role: 0, axis: 0, layer: 0, adjacency: 0, zone: 0, module: 0, span: 0, tags: 0,
  edgeExposure: 3, lengthMm: 3, thicknessMm: 3,
};

/** R70 §2.3 — which band does this height fall in? ZERO numeric literals: every threshold comes
 *  from `profile.heightBands`. A module starting exactly on a boundary belongs to the lower band,
 *  which is a convention and is stated here rather than discovered later. */
export function bandAt(mmFromFloor: number, bands: HeightBand[]): HeightBand {
  for (const b of bands) if (mmFromFloor <= (b.hi ?? Infinity)) return b;
  throw new Error(`${mmFromFloor}mm is above every declared height band`);
}

/** R70 §3.2 — Multi-Tier Zone Inheritance. A module gets ONE zone (Law B), resolved from its
 *  BOTTOM edge, because a tall pantry is a base cabinet that was built tall: it stands on the
 *  plinth, takes base-height hinges, and is priced as base end to end. Two exceptions, and both
 *  are declared in the profile rather than named in code:
 *
 *    mount "above"   — nothing is mounted IN this band, so look one band up. The plinth is a
 *                      toe-kick void; the worktop gap is the splash zone, and a wall cabinet
 *                      whose bottom edge sits there is an upper, not a splash.
 *    mount "ceiling" — it hangs from above, so resolve from the TOP edge (антресоль, короб). */
export function resolveZone(bottomMm: number, topMm: number, bands: HeightBand[]): Zone {
  let i = bands.findIndex((b) => bottomMm <= (b.hi ?? Infinity));
  if (i < 0) throw new Error(`${bottomMm}mm is above every declared height band`);

  // "above" can chain — a module standing on the floor passes plinth and lands on base
  while (bands[i]!.mount === "above" && i + 1 < bands.length) i++;
  if (bands[i]!.mount === "ceiling") return bandAt(topMm, bands).id;
  return bands[i]!.id;
}

/** Zone is decided PER BLOCK and inherited (`50` Law B). Deriving it from a board's own geometry
 *  is what made a tall pantry's single door resolve to two zones — and two colours — for one
 *  uncuttable board. A block sits in the sheet and is classified once. */
function zoneOfBlock(sheet: Sheet, blockId: BlockId, mm: Map<LineId, number>, bands: HeightBand[]): Zone {
  const b = sheet.blocks.find((x) => x.id === blockId);
  // The fallback must be a band a module can actually BE in. `bands[0]` is the plinth here — a
  // toe-kick void with mount "above", so nothing declares a depth for it and the cascade could
  // not answer. Resolving height zero through the same function lands on the first real band,
  // whatever this profile happens to call it.
  if (!b) return resolveZone(0, 0, bands);
  return resolveZone(mm.get(b.bounds.h0)!, mm.get(b.bounds.h1)!, bands);
}

/** The blocks a board sits between, on its own axis. */
function neighbours(sheet: Sheet, board: Board, mm: Map<LineId, number>): { low?: BlockId; high?: BlockId } {
  const centre = mm.get(board.line)!;
  const lo = Math.min(board.from, board.to), hi = Math.max(board.from, board.to);
  let low: BlockId | undefined, high: BlockId | undefined;

  for (const b of sheet.blocks) {
    if (b.kind === "void") continue;
    const [a0, a1] = board.axis === "v"
      ? [mm.get(b.bounds.v0)!, mm.get(b.bounds.v1)!]
      : [mm.get(b.bounds.h0)!, mm.get(b.bounds.h1)!];
    const [c0, c1] = board.axis === "v"
      ? [mm.get(b.bounds.h0)!, mm.get(b.bounds.h1)!]
      : [mm.get(b.bounds.v0)!, mm.get(b.bounds.v1)!];
    if (c1 <= lo || c0 >= hi) continue;      // no overlap along the board's own length
    if (Math.abs(a1 - centre) < 1) low = b.id;
    if (Math.abs(a0 - centre) < 1) high = b.id;
  }
  return { low, high };
}

export function deriveFacets(
  sheet: Sheet, boards: Board[], bands: HeightBand[] = HEIGHT_BANDS,
): Map<string, Facets> {
  const { mm } = resolvePositions(sheet);
  const modules = deriveModules(sheet);
  const vs = linesOn(sheet, "v", mm);
  const out = new Map<string, Facets>();

  for (const board of boards) {
    const { low, high } = neighbours(sheet, board, mm);
    const owner = low ?? high;

    // Tier-0 adjacency: what is on the other side, and nothing about how long anything is.
    const centre = mm.get(board.line)!;
    const isEnd = board.axis === "v" && (vs[0]?.id === board.line || vs[vs.length - 1]?.id === board.line);
    const end = vs[0]?.id === board.line ? sheet.opening.ends.left : sheet.opening.ends.right;
    const adjacency: Adjacency =
      low && high ? "abutting"
      : isEnd && end === "against-wall" ? "wall-facing"
      : "free-end";

    // Tier-3: which of this board's own edges are visible in the finished piece.
    // The ORDER is a contract — see EDGE below; downstream code reads these by index.
    const edgeExposure: EdgeExposure[] = [
      low ? "hidden" : "exposed",
      high ? "hidden" : "exposed",
      "exposed", // the front edge of a carcass board faces the room
      "hidden",  // the back edge faces the wall
    ];

    out.set(board.id, {
      role: board.role,
      axis: board.axis,
      layer: "carcass",
      adjacency,
      zone: owner ? zoneOfBlock(sheet, owner, mm, bands) : resolveZone(0, 0, bands),
      module: owner ? modules.get(owner) ?? owner : "—",
      span: board.covers.length > 1 ? "spanning" : "terminating",
      tags: owner ? (sheet.blocks.find((b) => b.id === owner)?.tags ?? []) : [],
      edgeExposure,
      lengthMm: board.lengthMm,
      thicknessMm: board.thicknessMm,
      // keep the centre out of the facet set: a position is not a property anything may match on
    });
    void centre;
  }

  return out;
}
