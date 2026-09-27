// ПОЛИГОН · T5 — operations, refusals, and the legal domain.
//
// Two laws live here, and one fence.
//
// L0 — every operation is ONE atomic named transaction. Invariants are checked at commit, never
// during, so a split is allowed to be briefly inconsistent inside `apply` and can never be
// briefly inconsistent outside it. Whole, or refused whole.
//
// L13 — every operation reports its LEGAL DOMAIN before it is attempted, without mutating. This is
// what turns a hard stop into a feel: the UI greys out the impossible junction flip before the tap
// instead of refusing after it. Corollary, from the verdict: a refusal the legal-domain query
// could have prevented is a UI bug, not a user error — so every RefusalRecord carries
// `preventable`, and the ratio is a product metric.
//
// ─── THE FENCE (verdict §2, §6.1) ─────────────────────────────────────────────────────────────
//
// The legality oracle is where the no-solver law breaks first, and the breach has a name:
// "suggest a fix" on a cross-part refusal. Turning this API into a search over the constraint
// space produces a solver, built by accident, with no termination proof.
//
// So the fence is structural, not a comment:
//
//   · `legalDomain` takes ONE op kind and ONE target. It cannot see a second.
//   · It returns VALUES — a range or a set — never a sequence of operations. There is no field
//     on `Domain` that could hold an Op, and adding one is the breach.
//   · `RefusalRecord` has no `suggestedFixes`. Its absence is deliberate and tested.
//
// Probing candidate VALUES for one op on one target is not a search: the domain is bounded and
// enumerable, and the answer is "which of these values commit", not "what would make this legal".
// That distinction is the whole fence, and it is subtle enough to be worth stating twice.

import {
  addLine, checkInvariants, distribute, linesOn, normalizeSegments, rescaleOpening, resolvePositions,
  type Axis, type BlockId, type BlockKind, type LineId, type Segment, type Sheet, type SheetProfile,
  type Violation,
} from "./sheet";
import { resolveJunctions, type JunctionState } from "./junctions";
import type { Role } from "./roles";

// ─── operations ───────────────────────────────────────────────────────────────────────────────

/** A CLOSED union. Every way to change a sheet is named here, and there is no generic "patch"
 *  escape hatch — the second permanent condition from the verdict's round-trip guarantee. */
export type Op =
  | { kind: "move-line"; line: LineId; toMm: number }
  | { kind: "split-line"; axis: Axis; atMm: number }
  | { kind: "remove-line"; line: LineId }
  | { kind: "set-seam"; line: LineId; from: LineId; to: LineId; boards: 0 | 1 | 2; role?: Role }
  | { kind: "set-block-kind"; block: BlockId; to: BlockKind }
  | { kind: "absorb"; block: BlockId }
  | { kind: "equalize"; lines: LineId[] }
  | { kind: "rescale-opening"; widthMm: number }
  | { kind: "flip-junction"; v: LineId; h: LineId; to: Exclude<JunctionState, "both"> };

export type OpKind = Op["kind"];

// ─── refusals ─────────────────────────────────────────────────────────────────────────────────

/** Built in full now because it is cheap now and catastrophic to retrofit (verdict §6.3). What
 *  gets cut under deadline is prose polish and three-surface parity — never the schema. */
export interface RefusalRecord {
  /** the law that fired — every refusal names one (L8) */
  law: string;
  /** what was attempted */
  op: OpKind;
  detail: string;
  /** where to look */
  anchor?: { line?: LineId; block?: BlockId; junction?: { v: LineId; h: LineId } };
  /** the setting that would resolve it. Law E: a refusal that cannot be acted on in one click is
   *  a bug — this is the field that makes the click possible. */
  setting?: string;
  /** Could `legalDomain` have prevented this? If yes it is a UI bug, not a user error, and the
   *  ratio of these is the number that says whether the app feels like a game or a form. */
  preventable: boolean;
  // NOTE: there is deliberately NO `suggestedFixes` here. See THE FENCE above.
}

export type OpResult =
  | { ok: true; sheet: Sheet }
  | { ok: false; refusals: RefusalRecord[] };

const refuse = (op: OpKind, vs: Violation[], preventable: boolean): RefusalRecord[] =>
  vs.map((v) => ({
    law: v.law,
    op,
    detail: v.detail,
    anchor: v.where,
    setting: SETTING_FOR[v.law],
    preventable,
  }));

/** Which setting resolves which law, so a refusal can point at a file rather than at the user.
 *  Grows into the Thing index at T8; a flat map is honest until then. */
const SETTING_FOR: Record<string, string | undefined> = {
  L1: "profile.minInterior",
  L8: "profile.minInterior",
  L3: "sheet.blocks",
  L4: "sheet.blocks",
  L16: "profile.residual",
  "L-DERIVED": "line.position",
  "L-JUNCT-RANK": "profile.rank",
  "L-JUNCT-SPAN": "sheet.segments",
  "L-JUNCT-BOTH": "sheet.junctionOverrides",
};

// ─── the transaction ──────────────────────────────────────────────────────────────────────────

/** Build the candidate sheet for an op. Pure, and allowed to produce an ILLEGAL sheet — that is
 *  the point of L0: invariants hold between operations, not during them. */
function project(sheet: Sheet, op: Op, p: SheetProfile): Sheet | { fatal: Violation[] } {
  const { mm } = resolvePositions(sheet);

  switch (op.kind) {
    case "move-line": {
      if (!sheet.lines.some((l) => l.id === op.line))
        return { fatal: [{ law: "D1", detail: `no line ${op.line}`, where: { line: op.line } }] };
      return {
        ...sheet,
        lines: sheet.lines.map((l) =>
          l.id === op.line ? { ...l, pos: { kind: "authored", mm: Math.round(op.toMm) } } : l,
        ),
      };
    }

    case "split-line": {
      const added = addLine(sheet, op.axis, { kind: "authored", mm: Math.round(op.atMm) });
      return normalizeSegments(added.sheet);
    }

    case "remove-line": {
      const gone = sheet.lines.find((l) => l.id === op.line);
      if (!gone) return { fatal: [{ law: "D1", detail: `no line ${op.line}`, where: { line: op.line } }] };
      // a line that still bounds a block cannot simply vanish — the block would lose an edge
      if (sheet.blocks.some((b) => Object.values(b.bounds).includes(op.line)))
        return {
          fatal: [{
            law: "L4",
            detail: `line ${op.line} still bounds a block; absorb or re-bound the block first`,
            where: { line: op.line },
          }],
        };
      return {
        ...sheet,
        lines: sheet.lines.filter((l) => l.id !== op.line),
        segments: sheet.segments.filter((s) => s.line !== op.line && s.from !== op.line && s.to !== op.line),
      };
    }

    case "set-seam": {
      const next = sheet.segments.map((s) => {
        const hit = s.line === op.line &&
          ((s.from === op.from && s.to === op.to) || (s.from === op.to && s.to === op.from));
        if (!hit) return s;
        if (op.boards === 0) return { line: s.line, from: s.from, to: s.to, boards: 0 } as Segment;
        const role = op.role ?? (s.boards !== 0 ? s.role : undefined);
        if (!role)
          return s; // caught below: a board with no role cannot be built (Law E, and it will not type)
        return { line: s.line, from: s.from, to: s.to, boards: op.boards, role } as Segment;
      });
      if (op.boards !== 0 && !op.role && !sheet.segments.some((s) =>
        s.line === op.line && s.boards !== 0 &&
        ((s.from === op.from && s.to === op.to) || (s.from === op.to && s.to === op.from))))
        return {
          fatal: [{
            law: "E",
            detail: `putting a board on ${op.line} needs a declared role — nothing is inferred`,
            where: { line: op.line },
          }],
        };
      return { ...sheet, segments: next };
    }

    case "set-block-kind":
      return {
        ...sheet,
        blocks: sheet.blocks.map((b) => (b.id === op.block ? { ...b, kind: op.to } : b)),
      };

    case "absorb": {
      // L9 — "delete and close the gap" exists ONLY as this explicit command, never as a
      // consequence of deleting. The left neighbour takes the space, deterministically.
      const victim = sheet.blocks.find((b) => b.id === op.block);
      if (!victim) return { fatal: [{ law: "L9", detail: `no block ${op.block}` }] };
      const vs = linesOn(sheet, "v", mm);
      const i = vs.findIndex((l) => l.id === victim.bounds.v0);
      if (i <= 0)
        return {
          fatal: [{
            law: "L9",
            detail: `block ${op.block} has no left neighbour to absorb it`,
            where: { block: op.block },
          }],
        };
      // the victim's left bound moves out to swallow it; the victim's own cell disappears
      return {
        ...sheet,
        blocks: sheet.blocks
          .filter((b) => b.id !== op.block)
          .map((b) => (b.bounds.v1 === victim.bounds.v0 ? { ...b, bounds: { ...b.bounds, v1: victim.bounds.v1 } } : b)),
      };
    }

    case "equalize": {
      // L10 — a COMMAND, never a consequence. Only the named lines move.
      const vs = linesOn(sheet, "v", mm).filter((l) => op.lines.includes(l.id));
      if (vs.length < 2) return { fatal: [{ law: "L10", detail: "equalize needs at least two lines" }] };
      const first = mm.get(vs[0]!.id)!, last = mm.get(vs[vs.length - 1]!.id)!;
      const shares = distribute(last - first, vs.slice(1).map(() => 1), p.residual);
      let run = first;
      const moved = new Map<LineId, number>();
      vs.slice(1).forEach((l, k) => { run += shares[k]!; moved.set(l.id, run); });
      return {
        ...sheet,
        lines: sheet.lines.map((l) =>
          moved.has(l.id) ? { ...l, pos: { kind: "authored", mm: moved.get(l.id)! } } : l,
        ),
      };
    }

    case "rescale-opening": {
      const r = rescaleOpening(sheet, op.widthMm, p);
      return "sheet" in r ? r.sheet : { fatal: r.refused };
    }

    case "flip-junction": {
      const rest = (sheet.junctionOverrides ?? []).filter((o) => !(o.v === op.v && o.h === op.h));
      return { ...sheet, junctionOverrides: [...rest, { v: op.v, h: op.h, state: op.to }] };
    }
  }
}

/** ONE atomic named transaction (L0). Commits whole, or refuses whole and changes nothing. */
export function apply(sheet: Sheet, op: Op, p: SheetProfile): OpResult {
  const projected = project(sheet, op, p);
  if ("fatal" in projected) return { ok: false, refusals: refuse(op.kind, projected.fatal, true) };

  const violations = [
    ...checkInvariants(projected, p),
    ...resolveJunctions(projected, projected.junctionOverrides ?? []).violations,
  ];
  if (violations.length) return { ok: false, refusals: refuse(op.kind, violations, true) };
  return { ok: true, sheet: projected };
}

// ─── the legal domain ─────────────────────────────────────────────────────────────────────────

/** What would be accepted. VALUES, never operations — see THE FENCE. */
export type Domain =
  | { kind: "range"; min: number; max: number; step: number }
  | { kind: "set"; values: (string | number)[] }
  | { kind: "unavailable"; why: RefusalRecord[] };

const commits = (sheet: Sheet, op: Op, p: SheetProfile): boolean => apply(sheet, op, p).ok;

/** Binary-search one boundary of a continuous domain. Bounded, deterministic, O(log n) probes of
 *  the SAME op on the SAME target — evaluating a predicate at candidate points, not searching for
 *  a fix. */
function edge(sheet: Sheet, p: SheetProfile, make: (mm: number) => Op, from: number, toward: number): number {
  if (!commits(sheet, make(from), p)) return from;
  let good = from, bad = toward;
  for (let i = 0; i < 24 && Math.abs(bad - good) > 1; i++) {
    const mid = Math.round((good + bad) / 2);
    if (commits(sheet, make(mid), p)) good = mid; else bad = mid;
  }
  return good;
}

/** L13 — every op answers this without mutating. */
export function legalDomain(sheet: Sheet, op: Op, p: SheetProfile): Domain {
  const { mm } = resolvePositions(sheet);

  switch (op.kind) {
    case "move-line": {
      const at = mm.get(op.line);
      if (at === undefined)
        return { kind: "unavailable", why: refuse(op.kind, [{ law: "D1", detail: `no line ${op.line}` }], true) };
      const make = (x: number): Op => ({ kind: "move-line", line: op.line, toMm: x });
      if (!commits(sheet, make(at), p))
        return { kind: "unavailable", why: apply(sheet, make(at), p).ok ? [] : (apply(sheet, make(at), p) as { ok: false; refusals: RefusalRecord[] }).refusals };
      return {
        kind: "range",
        min: edge(sheet, p, make, at, at - sheet.opening.width),
        max: edge(sheet, p, make, at, at + sheet.opening.width),
        step: 1,
      };
    }

    case "set-seam": {
      const values = ([0, 1, 2] as const).filter((b) =>
        commits(sheet, { ...op, boards: b } as Op, p));
      return values.length ? { kind: "set", values: [...values] } : { kind: "unavailable", why: [] };
    }

    case "set-block-kind": {
      const values = (["block", "void", "reserved"] as BlockKind[]).filter((k) =>
        commits(sheet, { kind: "set-block-kind", block: op.block, to: k }, p));
      return values.length ? { kind: "set", values } : { kind: "unavailable", why: [] };
    }

    case "flip-junction": {
      const values = (["V-through", "H-through", "neither"] as const).filter((st) =>
        commits(sheet, { kind: "flip-junction", v: op.v, h: op.h, to: st }, p));
      return values.length ? { kind: "set", values: [...values] } : { kind: "unavailable", why: [] };
    }

    case "rescale-opening": {
      const at = sheet.opening.width;
      const make = (x: number): Op => ({ kind: "rescale-opening", widthMm: x });
      return {
        kind: "range",
        min: edge(sheet, p, make, at, Math.max(1, Math.round(at / 4))),
        max: edge(sheet, p, make, at, at * 2),
        step: 1,
      };
    }

    // discrete, no value to choose: the op is either available here or it is not
    case "split-line":
    case "remove-line":
    case "absorb":
    case "equalize": {
      const r = apply(sheet, op, p);
      return r.ok ? { kind: "set", values: ["available"] } : { kind: "unavailable", why: r.refusals };
    }
  }
}

/** The metric the verdict asks for: of the refusals seen, how many could the query have prevented?
 *  A rising number means the UI is not asking before it acts. */
export const preventableRatio = (log: RefusalRecord[]): number =>
  log.length === 0 ? 0 : log.filter((r) => r.preventable).length / log.length;
