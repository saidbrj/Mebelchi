// ПОЛИГОН · T3 — board runs: where the cut list actually comes from.
//
// DB/48 L6: a board is a MAXIMAL RUN of collinear segments joined at through-junctions, and a
// change of thickness, material or grain terminates the run.
//
// This is the law that stops a workshop cutting the wrong boards, and it is worth being precise
// about why it matters. Three stacked boxes and one tall box occupy the same cells and look
// identical on screen. They differ only in whether the vertical board is CUT at the horizontals —
// which is junction data. So the difference is derived, never asserted, and swapping one for the
// other requires changing a junction: a named, visible, logged operation. Silent swapping becomes
// unrepresentable rather than merely discouraged.
//
// The case that proves it is the founder's own: a base cabinet beside a floor-to-ceiling pantry,
// sharing the line between them. Over the base's height the segment is jointly owned; above it,
// only the pantry is there. Physically that is ONE board, 2400 long, and the base simply has no
// right side of its own — it hangs off the pantry. That is exactly how a workshop builds it, and
// it falls out of run-joining with no special case.

import {
  linesOn, resolvePositions, thicknessMm,
  type Axis, type BlockId, type Lamination, type LineId, type Segment, type Sheet, type SheetProfile,
} from "./sheet";
import { extentBetween, type Junction } from "./junctions";
import type { Role } from "./roles";

export interface Board {
  /** DB/51 H1 — structural identity: role plus the lines that bound it. Never a UUID: a board that
   *  grew 4mm must read as the same board that changed, not as one deleted and one created, or the
   *  release diff (DB/53 §2) is noise and every pin orphans on the first drag. */
  id: string;
  line: LineId;
  axis: Axis;
  role: Role;
  /** which of the pair this is, when a module boundary carries two boards back to back */
  panel: 0 | 1;
  material?: string;
  /** the outer ends of the run, as line ids — the identity-bearing part */
  ends: { from: LineId; to: LineId };
  from: number;
  to: number;
  lengthMm: number;
  thicknessMm: number;
  /** R76 — set when this board is glued from layers rather than cut as one */
  lamination?: Lamination;
  /** the segments this one board covers */
  covers: Segment[];
}

/** Everything that must agree for two adjacent segments to be one board (L6). Thickness, role and
 *  material each terminate a run — two collinear, equally thick, through-joined segments of
 *  different material are two boards, and getting that wrong is a wrong cut list, not a nicety. */
const sameBoard = (a: Segment, b: Segment): boolean => {
  if (a.boards === 0 || b.boards === 0) return false;
  if (a.boards !== b.boards) return false;
  if (a.role !== b.role) return false;
  // a doubled panel and a single one are two different boards, however collinear (L6)
  if (JSON.stringify(a.lamination ?? null) !== JSON.stringify(b.lamination ?? null)) return false;
  const ma = a.materials ?? [], mb = b.materials ?? [];
  return ma.length === mb.length && ma.every((m, i) => m === mb[i]);
};

/** Does a board on `line` continue across the crossing at `cross`, or is it cut there? */
function continuesAcross(junctions: Junction[], axis: Axis, line: LineId, cross: LineId): boolean {
  const j = junctions.find((x) => (axis === "v" ? x.v === line && x.h === cross : x.h === line && x.v === cross));
  if (!j) return true; // no junction here — nothing cuts the board
  return axis === "v" ? j.state === "V-through" : j.state === "H-through";
}

/** Segments on one line, ordered along that line, with the crossing line each pair shares. */
function orderedSegments(sheet: Sheet, line: LineId, mm: Map<LineId, number>): Segment[] {
  return sheet.segments
    .filter((s) => s.line === line)
    .map((s) => {
      const a = mm.get(s.from)!, z = mm.get(s.to)!;
      // normalise direction so `from` is always the lower end — run-walking assumes it
      return a <= z ? s : ({ ...s, from: s.to, to: s.from } as Segment);
    })
    .sort((p, q) => mm.get(p.from)! - mm.get(q.from)!);
}

/** Join collinear segments into maximal runs, then emit one Board per physical panel. */
export function deriveBoards(sheet: Sheet, p: SheetProfile, junctions: Junction[]): Board[] {
  const { mm } = resolvePositions(sheet);
  const out: Board[] = [];

  for (const line of sheet.lines) {
    const segs = orderedSegments(sheet, line.id, mm).filter((s) => s.boards > 0);
    if (segs.length === 0) continue;

    let run: Segment[] = [segs[0]!];

    const flush = () => {
      const first = run[0]!, last = run[run.length - 1]!;
      if (first.boards === 0) return;
      const ext = extentBetween(sheet, p, junctions, line.id, first.from, last.to);
      if (!ext) return;

      for (let panel = 0; panel < first.boards; panel++) {
        out.push({
          id: `${first.role}:${line.id}:${first.from}..${last.to}#${panel}`,
          line: line.id,
          axis: line.axis,
          role: first.role,
          panel: panel as 0 | 1,
          material: first.materials?.[panel],
          ends: { from: first.from, to: last.to },
          from: ext.from,
          to: ext.to,
          lengthMm: ext.lengthMm,
          thicknessMm: thicknessMm(first, p) / first.boards,
          lamination: first.lamination,
          covers: [...run],
        });
      }
    };

    for (let i = 1; i < segs.length; i++) {
      const prev = segs[i - 1]!, cur = segs[i]!;
      const adjacent = prev.to === cur.from;
      const joins =
        adjacent && sameBoard(prev, cur) && continuesAcross(junctions, line.axis, line.id, prev.to);
      if (joins) run.push(cur);
      else { flush(); run = [cur]; }
    }
    flush();
  }

  return out;
}

/** A module is a maximal set of blocks not separated by a two-board segment (DB/48 §0, `50` §4).
 *  DERIVED, never authored — share a seam and the module appears; unshare it and it splits. One
 *  source of truth, so "one tall block" and "three stacked blocks sharing seams" can never
 *  disagree about what gets delivered.
 *
 *  Note modules are NOT required to be rectangles (L4 constrains blocks, not modules): a base
 *  sharing a panel with a floor-to-ceiling pantry is one L-shaped assembly, and it is one because
 *  a single board belongs to both. */
export function deriveModules(sheet: Sheet): Map<BlockId, string> {
  const { mm } = resolvePositions(sheet);
  const carcass = sheet.blocks.filter((b) => b.kind !== "void");
  const parent = new Map<BlockId, BlockId>(carcass.map((b) => [b.id, b.id]));

  const find = (x: BlockId): BlockId => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: BlockId, b: BlockId) => { parent.set(find(a), find(b)); };

  /** Every board sitting on `line` strictly between `lo` and `hi`, measured across the line. */
  const between = (line: LineId, lo: number, hi: number) =>
    sheet.segments.filter((sg) => {
      if (sg.line !== line || sg.boards === 0) return false;
      const p = mm.get(sg.from)!, q = mm.get(sg.to)!;
      return Math.min(p, q) < hi && Math.max(p, q) > lo;
    });

  for (const a of carcass) {
    for (const b of carcass) {
      if (a.id >= b.id) continue;

      // ── Phase 1 · LEFT ↔ RIGHT across a shared vertical ────────────────────────────────────
      const v = a.bounds.v1 === b.bounds.v0 ? a.bounds.v1 : b.bounds.v1 === a.bounds.v0 ? b.bounds.v1 : null;
      if (v) {
        const lo = Math.max(mm.get(a.bounds.h0)!, mm.get(b.bounds.h0)!);
        const hi = Math.min(mm.get(a.bounds.h1)!, mm.get(b.bounds.h1)!);
        if (hi > lo) {
          const seam = between(v, lo, hi);
          // one board fuses them; two back to back is a module boundary and keeps them apart
          if (seam.length && seam.every((sg) => sg.boards === 1)) union(a.id, b.id);
        }
      }

      // ── Phase 2 · UP ↕ DOWN across a shared horizontal (R70 §1.2) ──────────────────────────
      // The exact transpose of Phase 1, and its absence was a real defect: a three-drawer bank
      // came out as THREE separate cabinets, because only the left-right direction was ever
      // walked. A boards:1 horizontal is a fixed shelf INSIDE one carcass and merges the cells
      // above and below it; boards:2 is a top panel plus a bottom panel — two carcasses stacked,
      // and they stay apart.
      const h = a.bounds.h1 === b.bounds.h0 ? a.bounds.h1 : b.bounds.h1 === a.bounds.h0 ? b.bounds.h1 : null;
      if (h) {
        const lo = Math.max(mm.get(a.bounds.v0)!, mm.get(b.bounds.v0)!);
        const hi = Math.min(mm.get(a.bounds.v1)!, mm.get(b.bounds.v1)!);
        if (hi > lo) {
          const seam = between(h, lo, hi);
          if (seam.length && seam.every((sg) => sg.boards === 1)) union(a.id, b.id);
        }
      }
    }
  }
  // Phase 3 · the union-find IS the connected-component closure: merging is transitive in both
  // directions at once, so an L-shaped module falls out with no extra pass.
  return new Map([...parent.keys()].map((id) => [id, find(id)]));
}

export function transportCheck(
  boards: Board[], maxWidthMm: number,
): { over: Board[]; widestMm: number } {
  const widest = boards.reduce((m, b) => Math.max(m, b.lengthMm), 0);
  return { over: boards.filter((b) => b.lengthMm > maxWidthMm), widestMm: widest };
}

/** The cut list, grouped the way a workshop reads it: identical boards merged with a quantity. */
export function cutList(boards: Board[]): { role: Role; lengthMm: number; thicknessMm: number; material?: string; qty: number }[] {
  const groups = new Map<string, { role: Role; lengthMm: number; thicknessMm: number; material?: string; qty: number }>();
  for (const b of boards) {
    const k = `${b.role}|${b.lengthMm}|${b.thicknessMm}|${b.material ?? ""}`;
    const hit = groups.get(k);
    if (hit) hit.qty++;
    else groups.set(k, { role: b.role, lengthMm: b.lengthMm, thicknessMm: b.thicknessMm, material: b.material, qty: 1 });
  }
  return [...groups.values()];
}

// ─── L5a · where a line's position actually means something ───────────────────────────────────

/** One span of a line between two crossings. */
export interface LineSpan {
  from: LineId;
  to: LineId;
  /** Does the line carry a board HERE? This is the question a drag handle asks: grab the line in
   *  this band and something at this place moves. */
  meaningful: boolean;
  /** the boards sitting on the line inside this span */
  carries: string[];
}

/** DB/48 L5a — lines are GLOBAL (L5), but a global line is not equally real everywhere. Below the
 *  worktop the seam between two bases carries their shared side; above it, in the backsplash band,
 *  the same line carries nothing at all. Dragging it up there moves a handle and changes nothing
 *  visible at that place, which reads as a broken app.
 *
 *  DEFINITION, and it was narrowed once already. The first version also counted a span as
 *  meaningful when a perpendicular board terminated on the line at a crossing BOUNDING the span.
 *  Running a real kitchen through it showed why that is wrong: every horizontal board lives ON a
 *  crossing line, so almost every span came back meaningful and the law stopped distinguishing
 *  anything. A board on the boundary is not in the band.
 *
 *  So: a span is meaningful when the line CARRIES a board there. What a move does to the rest of
 *  the sheet is a different question, answered by `affectedBy` — and keeping them apart is what
 *  makes either one useful.
 *
 *  This reports. It never proposes splitting a line, never hides one, never moves anything —
 *  THE FENCE (`59` §2) holds here as everywhere. */
export function lineSpans(sheet: Sheet, line: LineId, boards: Board[]): LineSpan[] {
  const self = sheet.lines.find((l) => l.id === line);
  if (!self) return [];

  const mm = resolvePositions(sheet).mm;
  const cross = linesOn(sheet, self.axis === "v" ? "h" : "v", mm);
  const carried = boards.filter((b) => b.line === line);

  // Membership is read from the SEGMENTS a board covers, not from its millimetre extent. A board
  // running through a crossing sticks half a board thickness past it, so an extent test says a
  // side belongs to the empty band above it by 8mm — which is how "every span is meaningful"
  // happened the first time. Segments are exact and need no epsilon.
  const covers = (b: Board, from: LineId, to: LineId) =>
    b.covers.some((c) => (c.from === from && c.to === to) || (c.from === to && c.to === from));

  const out: LineSpan[] = [];
  for (let i = 0; i + 1 < cross.length; i++) {
    const from = cross[i]!.id, to = cross[i + 1]!.id;
    const carries = carried.filter((b) => covers(b, from, to)).map((b) => b.id);
    out.push({ from, to, meaningful: carries.length > 0, carries });
  }
  return out;
}

/** Every board whose SIZE OR PLACE changes if this line moves — the boards on it, and the
 *  perpendicular boards that terminate on it. Not per-span: a line moves as a whole, so this
 *  question has one answer for the whole line. */
export const affectedBy = (line: LineId, boards: Board[]): string[] =>
  boards
    .filter((b) => b.line === line || b.ends.from === line || b.ends.to === line)
    .map((b) => b.id);

/** Lines whose position is meaningful NOWHERE and that nothing terminates on — a user can drag
 *  these all day and the cut list will not move. */
export const inertLines = (sheet: Sheet, boards: Board[]): LineId[] =>
  sheet.lines
    .filter((l) => !lineSpans(sheet, l.id, boards).some((s) => s.meaningful)
                && affectedBy(l.id, boards).length === 0)
    .map((l) => l.id);
