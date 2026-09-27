// ПОЛИГОН · T2 — junctions: which board runs through, and therefore how long every board is.
//
// This is the piece that makes board length stop being a special case. A board runs from junction
// to junction; at each end it either RUNS THROUGH (extend to the far face) or BUTTS (stop at the
// near face). Nothing else. One derivation, both European conventions, zero branches:
//
//   800 carcass, 16mm boards, V-through at both top junctions → top = 800 − 16 − 16 = 768
//   flip those two junctions to H-through                     → top = 800, sides shorter by 32
//
// It also swallows DB/48 L6. A vertical board's identity is a maximal run of collinear segments
// joined at V-through junctions, so "three stacked boxes" and "one tall box" differ by junction
// data rather than by an assertion someone has to defend in code. Swapping them requires changing
// a junction, which is a named, visible, logged operation — never a silent drift.

import {
  facesOf, linesOn, resolvePositions, segmentAt, thicknessMm,
  type LineId, type Segment, type Sheet, type SheetProfile, type Violation,
} from "./sheet";
import { RANK, type Role } from "./roles";

/** `both` is physically impossible — there is no half-lap in LDSP — and is refused at commit. */
export type JunctionState = "V-through" | "H-through" | "neither" | "both";

/** L — two arms, both boards end (four per box). T — three arms, one runs through. X — four arms. */
export type JunctionClass = "L" | "T" | "X";

/** How the state was decided. Shown in the inspector: tap a seam, see which tier answered. */
export type JunctionBy = "override" | "spanning" | "continuity" | "rank" | "tie";

export interface Junction {
  v: LineId;
  h: LineId;
  cls: JunctionClass;
  state: JunctionState;
  by: JunctionBy;
  /** the roles that met here, for the refusal message and the inspector */
  roles: { v?: Role; h?: Role };
}

/** A per-junction override, keyed STRUCTURALLY by the two lines that cross. Keyed this way it
 *  survives both lines moving; if a line is deleted the crossing disappears and the override
 *  surfaces as a conflict (see `resolveJunctions`) instead of silently evaporating. */
export interface JunctionOverride {
  v: LineId;
  h: LineId;
  state: Exclude<JunctionState, "both">;
}

const key = (v: LineId, h: LineId) => `${v}|${h}`;

// ─── arms ─────────────────────────────────────────────────────────────────────────────────────

/** The four segments meeting at a crossing: the vertical line below/above, the horizontal
 *  left/right. A crossing with fewer than two boarded arms is not a junction at all. */
function armsAt(sheet: Sheet, v: LineId, h: LineId, vs: LineId[], hs: LineId[]) {
  const hi = hs.indexOf(h), vi = vs.indexOf(v);
  // Whether a span EXISTS on each side, which is a different question from whether it carries a
  // board. At the floor line there is no span below — not a board that stopped, just the edge of
  // the wall — and the continuity rule must not read the two as the same thing.
  const interiorV = hi > 0 && hi < hs.length - 1;
  const interiorH = vi > 0 && vi < vs.length - 1;
  const seg = (line: LineId, a: LineId | undefined, b: LineId | undefined): Segment | undefined =>
    a && b ? segmentAt(sheet, line, a, b) : undefined;

  return {
    down: seg(v, hs[hi - 1], h),
    up: seg(v, h, hs[hi + 1]),
    left: seg(h, vs[vi - 1], v),
    right: seg(h, v, vs[vi + 1]),
    interiorV, interiorH,
  };
}

const boarded = (s: Segment | undefined): boolean => !!s && s.boards > 0;
const roleOf = (s: Segment | undefined): Role | undefined =>
  s && s.boards !== 0 ? s.role : undefined; // `!== 0` narrows the union; `> 0` does not

/** L / T / X from arm count — with the decomposition that matters:
 *
 *  THICKNESS DECOMPOSES X. Four arms whose vertical is `boards: 2` is a MODULE BOUNDARY, and two
 *  boards back to back are not one crossing — they are two independent T junctions, one per
 *  module. So a true X exists only where the vertical is shared (`boards: 1`), i.e. only INSIDE a
 *  module. The hard four-way case is therefore rare and always local to one carcass. */
/** Takes only the four arms — `armsAt` also reports whether each side has ROOM to continue, and
 *  that is the resolver's business, not the classifier's. */
export function classify(arms: {
  down?: Segment; up?: Segment; left?: Segment; right?: Segment;
}): JunctionClass | null {
  const n = [arms.down, arms.up, arms.left, arms.right].filter(boarded).length;
  if (n < 2) return null;
  if (n === 4) {
    const shared = (arms.down?.boards ?? arms.up?.boards) === 1;
    return shared ? "X" : "T";
  }
  if (n === 3) return "T";
  // two arms: an L only if they are perpendicular; two collinear arms are just a continuing board
  const perpendicular = (boarded(arms.down) || boarded(arms.up)) && (boarded(arms.left) || boarded(arms.right));
  return perpendicular ? "L" : null;
}

// ─── the spanning rule ────────────────────────────────────────────────────────────────────────

/** DB/48 §2, the rule that silently wrecks three-level kitchens if it is missed:
 *
 *  > A high-rank horizontal crossing a vertical block that SPANS that height produces no board
 *  > inside it. The junction is V-through, the horizontal terminates, the spanning block gets
 *  > nothing.
 *
 *  Without it every floor-to-ceiling pantry beside the bases quietly grows a shelf at 850, because
 *  the worktop line happens to cross it. Default is terminate; a shelf there is an explicit
 *  assignment, which is why `role === "shelf"` is exempt. */
export function spanningViolations(sheet: Sheet, hLine: LineId): Violation[] {
  const { mm } = resolvePositions(sheet);
  const hMm = mm.get(hLine);
  if (hMm === undefined) return [];
  const out: Violation[] = [];

  for (const b of sheet.blocks) {
    if (b.kind !== "block") continue;
    const lo = mm.get(b.bounds.h0)!, hi = mm.get(b.bounds.h1)!;
    if (!(lo < hMm && hMm < hi)) continue; // the block must strictly span the line

    const v0 = mm.get(b.bounds.v0)!, v1 = mm.get(b.bounds.v1)!;
    for (const seg of sheet.segments) {
      if (seg.line !== hLine || seg.boards === 0 || seg.role === "shelf") continue;
      const a = mm.get(seg.from)!, z = mm.get(seg.to)!;
      const [lowX, highX] = a < z ? [a, z] : [z, a];
      if (lowX >= v0 && highX <= v1) {
        out.push({
          law: "L-JUNCT-SPAN",
          detail:
            `a ${seg.role} on line ${hLine} lies inside block ${b.id}, which spans that height — ` +
            `the horizontal must terminate at the block's side, not continue through it. ` +
            `A board here has to be an explicit shelf.`,
          where: { line: hLine, block: b.id },
        });
      }
    }
  }
  return out;
}

// ─── resolution ───────────────────────────────────────────────────────────────────────────────

/** Three tiers, in order — DB/48 §2. Rank covers ~98%; the override is the escape hatch, badged
 *  and countable; a tie is REFUSED rather than defaulted, because a tie means the profile has not
 *  said what the shop actually does. */
export function resolveJunctions(
  sheet: Sheet,
  overrides: JunctionOverride[] = [],
): { junctions: Junction[]; violations: Violation[] } {
  const { mm } = resolvePositions(sheet);
  const vs = linesOn(sheet, "v", mm).map((l) => l.id);
  const hs = linesOn(sheet, "h", mm).map((l) => l.id);
  const byKey = new Map(overrides.map((o) => [key(o.v, o.h), o]));
  const used = new Set<string>();

  const junctions: Junction[] = [];
  const violations: Violation[] = [];

  for (const v of vs) {
    for (const h of hs) {
      const arms = armsAt(sheet, v, h, vs, hs);
      const cls = classify(arms);
      if (!cls) continue;

      const vRole = roleOf(arms.down) ?? roleOf(arms.up);
      const hRole = roleOf(arms.left) ?? roleOf(arms.right);
      const roles = { v: vRole, h: hRole };

      // tier 1 — an explicit override on this crossing
      const ov = byKey.get(key(v, h));
      if (ov) {
        used.add(key(v, h));
        junctions.push({ v, h, cls, state: ov.state, by: "override", roles });
        continue;
      }

      // tier 2 — a block spanning this height keeps its side continuous
      const spans = sheet.blocks.some(
        (b) =>
          b.kind === "block" &&
          mm.get(b.bounds.h0)! < mm.get(h)! && mm.get(h)! < mm.get(b.bounds.h1)! &&
          (b.bounds.v0 === v || b.bounds.v1 === v),
      );
      if (spans) {
        junctions.push({ v, h, cls, state: "V-through", by: "spanning", roles });
        continue;
      }

      // tier 3 — CONTINUITY. Rank settles a contest, and a contest needs two claimants.
      //
      // Found by a founder question: a wall of dividers at 120mm spacing, each stopping at a
      // shelf, with one wide shelf running over them. Rank said side (70) beats shelf (30), so
      // the shelf came out as ten 120mm pieces — and no shop on earth builds it that way. The
      // divider ends AT the shelf; it has nothing above it to run through with. The shelf is
      // continuous and the divider butts into its underside.
      //
      // So: if exactly one of the two boards passes through the crossing, it runs through and
      // there is nothing to rank. Rank decides only where both genuinely continue (an X), or
      // where neither does (an L, where it settles which face is covered).
      // Only meaningful where BOTH lines have room to continue. At the floor, the ceiling or an
      // end wall there is no "beyond", so a missing board there is the edge of the sheet rather
      // than a board that stopped — and rank, not continuity, is what settles those. A side
      // running to the floor with the bottom between it is exactly what rank 70 > 50 says.
      const vContinues = arms.interiorV && boarded(arms.down) && boarded(arms.up);
      const hContinues = arms.interiorH && boarded(arms.left) && boarded(arms.right);
      const contested = arms.interiorV && arms.interiorH;
      if (contested && vContinues !== hContinues && (vContinues || hContinues)) {
        junctions.push({
          v, h, cls, state: vContinues ? "V-through" : "H-through", by: "continuity", roles,
        });
        continue;
      }

      // tier 4 — rank from the profile
      if (!vRole || !hRole) {
        junctions.push({ v, h, cls, state: "neither", by: "rank", roles });
        continue;
      }
      if (RANK[vRole] === RANK[hRole]) {
        violations.push({
          law: "L-JUNCT-RANK",
        setting: "tables/junction-rank.rank",
          detail:
            `${vRole} and ${hRole} meet at ${v}×${h} with equal rank (${RANK[vRole]}). ` +
            `A tie is refused, never defaulted — rank them in the profile or override this junction.`,
          where: { line: v },
        });
        junctions.push({ v, h, cls, state: "neither", by: "tie", roles });
        continue;
      }
      junctions.push({
        v, h, cls,
        state: RANK[vRole] > RANK[hRole] ? "V-through" : "H-through",
        by: "rank",
        roles,
      });
    }
  }

  // an override whose crossing no longer exists must SURFACE, not evaporate (DB/48 §2)
  for (const o of overrides) {
    if (!used.has(key(o.v, o.h))) {
      violations.push({
        law: "L-JUNCT-BOTH",
        detail:
          `an override sets ${o.v}×${o.h} to ${o.state}, but those lines no longer cross with ` +
          `boards on both arms. The override is orphaned — resolve it, it will not be dropped.`,
        where: { line: o.v },
      });
    }
  }

  return { junctions, violations };
}

/** `both` is unrepresentable in a resolved junction, so this can only fire on authored data —
 *  which is exactly where it must be caught (DB/48 §2: refuse at commit). */
export const checkNoBothThrough = (junctions: Junction[]): Violation[] =>
  junctions
    .filter((j) => j.state === "both")
    .map((j) => ({
      law: "L-JUNCT-BOTH",
      detail: `${j.v}×${j.h} claims both boards run through. There is no half-lap in LDSP.`,
      where: { line: j.v },
    }));

// ─── board extent — the whole point ───────────────────────────────────────────────────────────

export interface BoardExtent {
  from: number;
  to: number;
  lengthMm: number;
}

/** How far does a board on `line` reach, given the crossings at its two outer ends?
 *
 *  At each end: RUNS THROUGH → extend to the crossing line's far face; BUTTS → stop at the near
 *  face. That single rule produces both conventions with no branch per convention, and it is why
 *  "does the top sit on the sides or between them" becomes a rank in a profile rather than an
 *  argument. Used for one segment (T2) and for a whole run (T3) — the ends are the only input. */
export function extentBetween(
  sheet: Sheet, p: SheetProfile, junctions: Junction[], line: LineId, endA: LineId, endB: LineId,
): BoardExtent | null {
  const { mm } = resolvePositions(sheet);
  const self = sheet.lines.find((l) => l.id === line);
  if (!self) return null;

  const runsThroughAt = (cross: LineId): boolean => {
    const j = junctions.find((x) =>
      self.axis === "v" ? x.v === line && x.h === cross : x.h === line && x.v === cross,
    );
    if (!j) return true; // nothing crosses here with a board — the run simply continues
    return self.axis === "v" ? j.state === "V-through" : j.state === "H-through";
  };

  /** The crossing line's own thickness AT this junction, so the face we stop at is a real face.
   *  The crossing runs on the OTHER axis, so its segments are bounded by lines of THIS axis —
   *  the arm touching this junction is a segment on `cross` whose `from` or `to` is `line`.
   *  (Comparing against the segment's own endpoints instead, as the first version did, compares
   *  v-line ids to h-line ids: never matches, thickness reads 0, and every board comes out
   *  centre-to-centre — 784 instead of 768.) */
  const crossThickness = (cross: LineId): number => {
    const arm = sheet.segments.find(
      (x) => x.line === cross && x.boards > 0 && (x.from === line || x.to === line),
    );
    return thicknessMm(arm, p);
  };

  const edge = (cross: LineId, towardHigher: boolean): number => {
    const f = facesOf(mm.get(cross)!, crossThickness(cross));
    if (runsThroughAt(cross)) return towardHigher ? f.high : f.low;
    return towardHigher ? f.low : f.high;
  };

  const a = mm.get(endA), z = mm.get(endB);
  if (a === undefined || z === undefined) return null;
  const [loId, hiId] = a < z ? [endA, endB] : [endB, endA];
  const from = edge(loId, false);
  const to = edge(hiId, true);
  return { from, to, lengthMm: to - from };
}

/** The extent of one segment — T2's question, now a special case of the run's. */
export function boardExtent(
  sheet: Sheet, p: SheetProfile, junctions: Junction[], seg: Segment,
): BoardExtent | null {
  if (seg.boards === 0) return null;
  return extentBetween(sheet, p, junctions, seg.line, seg.from, seg.to);
}
