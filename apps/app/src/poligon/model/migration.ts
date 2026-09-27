// ПОЛИГОН · Migration — the escape valve that keeps `resolve` honest.
//
// DB/51 D4 states the hardest constraint in the whole rule system:
//
//   > Resolve is PURE and never moves a line. Anything that must move a line is a MIGRATION —
//   > explicit, previewed, atomic, refusable.
//
// Why that line is worth defending. A rule like "tall units use 18mm carcass" changes a board's
// thickness. Thickness is a face, faces bound the interior, and the interior has minimums — so on
// some walls, obeying that rule requires the lines to MOVE. The tempting implementation is to let
// resolution nudge them. That is how a rule engine becomes a solver: resolution stops being a pure
// function of (facets, rules), stops being idempotent, and starts having an order of application
// that nobody wrote down and everybody depends on.
//
// So resolution refuses instead, and the refusal is routed here. A Migration is a first-class,
// named, previewed thing: it says what it will move, by how much, and what it will cost in parts,
// BEFORE anything happens, and it is one atomic commit or nothing (D10).
//
// It is also where D5 lands. Changing 16mm white for 16mm oak is a free cascade — same thickness
// class, no line moves, the cut list is identical. Changing 16mm for 18mm is not: every carcass
// face shifts by a millimetre and the interiors shrink. Same operation in the UI, completely
// different consequence, and the difference is a thickness CLASS boundary read from the profile
// file. Crossing one is always a Migration. Never crossing one silently is the point.

import { apply, legalDomain, type Op, type RefusalRecord } from "./ops";
import { deriveBoards, type Board } from "./runs";
import { resolveJunctions } from "./junctions";
import { resolvePositions, type LineId, type Sheet, type SheetProfile } from "./sheet";
import { THICKNESS_CLASSES } from "./settings";

// ─── D5 · thickness classes ───────────────────────────────────────────────────────────────────

/** Which class a thickness belongs to. The classes themselves come from
 *  `things/profiles/qorasu/def.json` — a shop stocking something else says so in its own file. */
export const classOf = (mm: number): number | undefined =>
  THICKNESS_CLASSES.find((c) => Math.abs(c - mm) < 0.001);

/** DB/51 D5 — a material swap WITHIN a thickness class is a free cascade; crossing a class
 *  boundary moves faces, and is therefore a Migration. This predicate is the whole law. */
export const crossesThicknessClass = (fromMm: number, toMm: number): boolean =>
  classOf(fromMm) !== classOf(toMm);

// ─── the Migration itself ─────────────────────────────────────────────────────────────────────

export interface MigrationCost {
  /** lines this migration will move, and by how much */
  moves: { line: LineId; fromMm: number; toMm: number }[];
  /** parts whose length changes, with both numbers — the founder's "what actually changed?" */
  resized: { board: string; fromMm: number; toMm: number }[];
  appeared: string[];
  vanished: string[];
}

export interface Migration {
  id: string;
  /** why this cannot be a plain cascade — always populated, never a blank */
  reason: string;
  ops: Op[];
}

export type MigrationPreview =
  | { ok: true; migration: Migration; cost: MigrationCost; after: Sheet }
  | { ok: false; migration: Migration; refusals: RefusalRecord[] };

const boardsOf = (sheet: Sheet, p: SheetProfile): Board[] =>
  deriveBoards(sheet, p, resolveJunctions(sheet, sheet.junctionOverrides ?? []).junctions);

/** PREVIEW — pure. Runs the whole migration against a copy and reports what it would cost, without
 *  touching the caller's sheet. A migration that cannot be previewed cannot be offered, because
 *  "apply and see" is exactly the experience this law exists to prevent. */
export function previewMigration(sheet: Sheet, m: Migration, p: SheetProfile): MigrationPreview {
  const before = { mm: resolvePositions(sheet).mm, boards: boardsOf(sheet, p) };

  let cur = sheet;
  for (const op of m.ops) {
    const r = apply(cur, op, p);
    // D10 — atomic. One refused op refuses the WHOLE migration; there is no partial application
    // and no "applied 3 of 5" state for anyone to reason about.
    if (!r.ok) return { ok: false, migration: m, refusals: r.refusals };
    cur = r.sheet;
  }

  const after = { mm: resolvePositions(cur).mm, boards: boardsOf(cur, p) };
  const wasById = new Map(before.boards.map((b) => [b.id, b]));
  const nowById = new Map(after.boards.map((b) => [b.id, b]));

  const moves = sheet.lines
    .map((l) => ({ line: l.id, fromMm: before.mm.get(l.id) ?? 0, toMm: after.mm.get(l.id) ?? 0 }))
    .filter((x) => x.fromMm !== x.toMm);

  return {
    ok: true, migration: m, after: cur,
    cost: {
      moves,
      resized: after.boards
        .filter((b) => wasById.has(b.id) && wasById.get(b.id)!.lengthMm !== b.lengthMm)
        .map((b) => ({ board: b.id, fromMm: wasById.get(b.id)!.lengthMm, toMm: b.lengthMm })),
      appeared: after.boards.filter((b) => !wasById.has(b.id)).map((b) => b.id),
      vanished: before.boards.filter((b) => !nowById.has(b.id)).map((b) => b.id),
    },
  };
}

/** COMMIT — atomic (D10). Re-previews rather than trusting a preview the caller may have been
 *  holding while the sheet moved under them, so a stale preview refuses instead of committing
 *  something nobody looked at. */
export function commitMigration(
  sheet: Sheet, m: Migration, p: SheetProfile,
): { ok: true; sheet: Sheet; cost: MigrationCost } | { ok: false; refusals: RefusalRecord[] } {
  const pre = previewMigration(sheet, m, p);
  if (!pre.ok) return { ok: false, refusals: pre.refusals };
  return { ok: true, sheet: pre.after, cost: pre.cost };
}

/** D10's other half — "a domain miss is REPORTED, not a failure". A migration asking for a value
 *  outside an op's legal domain is a finding you can show someone, not an exception. */
export interface DomainMiss {
  op: Op;
  wanted: number;
  nearest: { min: number; max: number };
}

export function domainMisses(sheet: Sheet, m: Migration, p: SheetProfile): DomainMiss[] {
  const out: DomainMiss[] = [];
  for (const op of m.ops) {
    if (op.kind !== "move-line") continue;
    const d = legalDomain(sheet, op, p);
    if (d.kind !== "range") continue;
    if (op.toMm < d.min || op.toMm > d.max) {
      out.push({ op, wanted: op.toMm, nearest: { min: d.min, max: d.max } });
    }
  }
  return out;
}
