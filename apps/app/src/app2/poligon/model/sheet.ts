// ПОЛИГОН · T1 — the Sheet: lines, segments, cells, blocks.
//
// The wall holds LINES. Everything else is derived. This file is the whole data model of DB/48 and
// nothing else: no operations (T5), no junctions (T2), no board runs (T3). Pure, no I/O, no React.
//
// Three decisions here are load-bearing, and each one is a law made structural rather than
// remembered:
//
//   · A line has a POSITION, never a width (L2). Toggling a seam from two boards to one grows both
//     interiors and moves no line — the arithmetic that killed "Σ widths = wall length".
//   · Thickness lives on the SEGMENT, not the line (L7), on both axes. The same vertical line can
//     be one shared board between two bases and two separate boards between two uppers.
//   · The invariant is FACE ORDERING, not a sum (L1). Sum-of-widths cannot express a negative
//     interior; faces can, and they catch it.
//
// DELIBERATE REFINEMENT vs DB/48, flagged rather than smuggled: the docs write segment thickness as
// `0 | 16 | 32` mm. We store `boards: 0 | 1 | 2` and resolve millimetres from the profile. Storing
// 16 would bake a profile number into the sheet, which contradicts L2 (the sheet stores decisions,
// the profile supplies numbers) and D5 (thickness is a material property). It is also strictly more
// expressive: a 16mm side back-to-back with an 18mm end panel is `boards: 2` with two materials,
// which `32` cannot say.

import type { Role } from "./roles";

export type Axis = "v" | "h";
export type LineId = string;
export type BlockId = string;

/** DB/48 L3 — fullness is per layer, and only `carcass` must be full. */
export type Layer = "behind" | "carcass" | "front" | "above";

/** DB/48 L15 — each end of the opening is declared, never assumed. */
export type EndCondition = "free" | "into-corner" | "against-wall";

/** DB/48 L16 — a division that leaves a remainder names who absorbs it. */
export type ResidualPolicy = "leftmost-absorbs" | "last-absorbs";

/** DB/48 L9 — a deleted block becomes an explicit Void; a Reserved is an obstacle, not nothing. */
export type BlockKind = "block" | "void" | "reserved";

/** DB/48 L-DERIVED — a position is derived until it is touched; touching it pins it. */
export type Position =
  | { kind: "authored"; mm: number }
  | { kind: "derived"; from: LineId; offset: number };

export interface Line {
  /** DB/51 H1 — stable, never reused. Identity is by ID, never by position, or every pin in the
   *  project orphans the first time a line moves. */
  id: LineId;
  axis: Axis;
  pos: Position;
}

/** R76 — DOUBLING, and why it is not `boards: 2`.
 *
 *  A modern kitchen's exposed end panel is two 16mm boards glued face to face, banded on the front
 *  with a single 32mm edge so it reads as one Italian slab. The outer board is full depth (600);
 *  the backing behind it is shorter (560), because nobody sees it and the weight is free to lose.
 *
 *  The temptation is to call that `boards: 2`. It is not, and conflating them would be a bug
 *  waiting years to surface:
 *
 *    boards: 2   TOPOLOGY. Two INDEPENDENT panels back to back — the boundary between two
 *                carcasses. Two modules, two module ids, two separately delivered assemblies.
 *    lamination  FABRICATION. ONE panel in the wall, one module, one shared seam — that happens
 *                to be made by gluing two blanks together.
 *
 *  Both are 32mm of material. They mean opposite things about what gets delivered. So `boards`
 *  keeps its one job — the seam topology — and doubling is declared here, where it belongs. The
 *  glossary already had the right formulation and it is kept: layers as INTENT, never "32mm",
 *  because the profile decides whether that is 2×16 or 2×18. */
export interface Lamination {
  layers: 2 | 3;
  /** how much SHALLOWER each backing blank is than the face blank. 0 = flush all round. */
  stepDepthMm: number;
  /** the front faces align, so the step falls at the back where nothing sees it */
  frontFlush: boolean;
}

/** The piece of a line between two crossing lines. Thickness lives here (L7).
 *
 *  A discriminated union, not an optional field: a segment that CARRIES a board must declare what
 *  role that board plays, because rank at a junction has nothing to compare otherwise. Making it
 *  a union means "a board with no declared role" does not compile — Law E (nothing is inferred)
 *  enforced by the type system rather than by a runtime check nobody runs. */
export type Segment =
  /** spanned — no board here at all, so nothing to name */
  | { line: LineId; from: LineId; to: LineId; boards: 0 }
  /** 1 = one shared board · 2 = two boards back to back (a module boundary) */
  | {
      line: LineId; from: LineId; to: LineId;
      boards: 1 | 2;
      role: Role;
      /** R76 — glued layers. Multiplies THICKNESS; leaves topology entirely alone. */
      lamination?: Lamination;
      /** per board, low side first. Absent → the profile's default carcass material. */
      materials?: [string] | [string, string];
    };

export interface Block {
  id: BlockId;
  kind: BlockKind;
  layer: Layer;
  /** DB/48 L4 — a rectangle of whole cells, named by its bounding lines. */
  bounds: { v0: LineId; v1: LineId; h0: LineId; h1: LineId };
  /** Reserved only: the appliance's own size, before clearance from the profile (DB/48 L9). */
  nominal?: { w: number; h: number };
  tags?: string[];
}

export interface Opening {
  /** the wall is an opening; the outermost lines' OUTER FACES bound it (L15) */
  width: number;
  height: number;
  ends: { left: EndCondition; right: EndCondition };
}

/** Only what the sheet needs from the profile. The real Profile is a Thing (T8). */
export interface SheetProfile {
  boardMm: number;
  /** minimum interior width by occupant, not by column (L8) */
  minInterior: Record<BlockKind, number>;
  residual: ResidualPolicy;
  /** ε in MODEL space (mm), never screen pixels (L5b) */
  epsilonMm: number;
}

// The shop's numbers live in `things/profiles/qorasu/def.json` and are read by `settings.ts`.
// Nothing here is a literal any more: a setting hardcoded in the engine is a setting nobody can
// edit, which is the golden rule broken (DB/52). Import SHOP_PROFILE instead.

export interface Sheet {
  opening: Opening;
  lines: Line[];
  segments: Segment[];
  blocks: Block[];
  /** Per-junction overrides live in the DOCUMENT, not beside it: DB/48 §2 requires them to be
   *  badged, listed and countable, and an override kept outside the sheet cannot be any of those.
   *  Keyed structurally (v × h), so one whose crossing disappears surfaces rather than evaporates. */
  junctionOverrides?: { v: LineId; h: LineId; state: "V-through" | "H-through" | "neither" }[];
  /** The id counter lives IN the document, not in the module. A module-global counter would make
   *  id minting impure, make ids depend on how many other sheets the process happened to build,
   *  and break determinism across sessions — and every pin is keyed to a line id (D1/H1), so an
   *  id that shifts is a pin that orphans. Per-sheet, ids are deterministic and reproducible. */
  nextId: number;
}

/** A law broken. T5 folds this into the full RefusalRecord; this is the minimum it needs to name. */
export interface Violation {
  law: string;
  detail: string;
  where?: { line?: LineId; block?: BlockId };
  /** Law E, доведённый до конца: КАКАЯ настройка снимает этот отказ. Без неё мастер вынужден
   *  искать правило, а требование ровно обратное — менять настройку по ходу. Пусто только там,
   *  где отказ снимается действием (передвинуть линию), а не числом. */
  setting?: string;
}

// ─── positions ────────────────────────────────────────────────────────────────────────────────

/** Resolve every line's millimetre position, following derived relations (L-DERIVED).
 *  A single ordered pass over a DAG — deliberately NOT iterative, because iterating to a fixpoint
 *  is a solver, and DB/48 refuses one. A cycle is reported, never chased. */
export function resolvePositions(sheet: Sheet): { mm: Map<LineId, number>; violations: Violation[] } {
  const mm = new Map<LineId, number>();
  const violations: Violation[] = [];
  const byId = new Map(sheet.lines.map((l) => [l.id, l]));
  const state = new Map<LineId, "open" | "done">();

  const walk = (id: LineId): number => {
    const done = mm.get(id);
    if (done !== undefined) return done;
    const line = byId.get(id);
    if (!line) {
      violations.push({ law: "D1", detail: `line ${id} is referenced but does not exist`, where: { line: id } });
      return 0;
    }
    if (state.get(id) === "open") {
      violations.push({ law: "L-DERIVED", detail: `position of ${id} is defined in a cycle`, where: { line: id } });
      mm.set(id, 0);
      return 0;
    }
    state.set(id, "open");
    const value = line.pos.kind === "authored" ? line.pos.mm : walk(line.pos.from) + line.pos.offset;
    const rounded = Math.round(value); // L16 — positions are integers, always
    state.set(id, "done");
    mm.set(id, rounded);
    return rounded;
  };

  for (const l of sheet.lines) walk(l.id);
  return { mm, violations };
}

export const linesOn = (sheet: Sheet, axis: Axis, mm: Map<LineId, number>): Line[] =>
  sheet.lines.filter((l) => l.axis === axis).sort((a, b) => mm.get(a.id)! - mm.get(b.id)!);

// ─── thickness and faces ──────────────────────────────────────────────────────────────────────

/** R76 §4 — a laminated panel is ONE monolithic part in the wall, as thick as its layers. Board
 *  COUNT is topology and layer COUNT is fabrication, and this is the one place they meet: the
 *  thickness a neighbour has to make room for. */
export function layersOf(seg: Segment | undefined): number {
  if (!seg || seg.boards === 0) return 0;
  return seg.lamination?.layers ?? 1;
}

export const thicknessMm = (seg: Segment | undefined, p: SheetProfile): number =>
  seg ? seg.boards * layersOf(seg) * p.boardMm : 0;

/** The two faces of a board sitting on a line. A segment with no board has both faces on the
 *  centreline, so a spanned interval simply has no thickness to account for. */
export const facesOf = (centre: number, thickness: number) => ({
  low: centre - thickness / 2,
  high: centre + thickness / 2,
});

/** The segment of `line` covering the interval between two perpendicular lines. */
export const segmentAt = (sheet: Sheet, line: LineId, from: LineId, to: LineId): Segment | undefined =>
  sheet.segments.find(
    (s) => s.line === line && ((s.from === from && s.to === to) || (s.from === to && s.to === from)),
  );

/** A segment is the piece of a line between two ADJACENT crossing lines. A segment that spans an
 *  intermediate crossing is not a coarser segment — it is an unnormalised one, and it makes the
 *  crossing invisible to anything that looks for arms at a junction (T2).
 *
 *  Splitting is safe under L10: it provably cannot change the part list, because a board run (T3)
 *  re-joins collinear pieces that agree on thickness, role and material. One canonical
 *  representation, so "one long segment" and "three atomic ones" can never disagree. */
export function normalizeSegments(sheet: Sheet): Sheet {
  const { mm } = resolvePositions(sheet);
  const out: Segment[] = [];

  for (const seg of sheet.segments) {
    const line = sheet.lines.find((l) => l.id === seg.line);
    if (!line) { out.push(seg); continue; }
    const crossAxis: Axis = line.axis === "v" ? "h" : "v";
    const a = mm.get(seg.from), z = mm.get(seg.to);
    if (a === undefined || z === undefined) { out.push(seg); continue; }
    const [lo, hi] = a < z ? [a, z] : [z, a];

    const cuts = linesOn(sheet, crossAxis, mm).filter((l) => {
      const v = mm.get(l.id)!;
      return v > lo && v < hi;
    });
    if (cuts.length === 0) { out.push(seg); continue; }

    const chain = [a < z ? seg.from : seg.to, ...cuts.map((c) => c.id), a < z ? seg.to : seg.from];
    for (let i = 0; i + 1 < chain.length; i++) {
      out.push({ ...seg, from: chain[i]!, to: chain[i + 1]! } as Segment);
    }
  }
  return { ...sheet, segments: out };
}

// ─── invariants ───────────────────────────────────────────────────────────────────────────────

/** L1 — face ordering, checked PER ROW, because thickness lives on segments and a line may be a
 *  board in one row and nothing in the next. Checking it per row is also what makes L5a true:
 *  a line that terminates nothing at this height constrains nothing at this height. */
export function checkFaceOrdering(sheet: Sheet, p: SheetProfile): Violation[] {
  const { mm } = resolvePositions(sheet);
  const vs = linesOn(sheet, "v", mm);
  const hs = linesOn(sheet, "h", mm);
  const out: Violation[] = [];

  for (let r = 0; r + 1 < hs.length; r++) {
    const h0 = hs[r]!, h1 = hs[r + 1]!;
    for (let i = 0; i + 1 < vs.length; i++) {
      const a = vs[i]!, b = vs[i + 1]!;
      const ta = thicknessMm(segmentAt(sheet, a.id, h0.id, h1.id), p);
      const tb = thicknessMm(segmentAt(sheet, b.id, h0.id, h1.id), p);
      const right = facesOf(mm.get(a.id)!, ta).high;
      const left = facesOf(mm.get(b.id)!, tb).low;

      const occupant = blockBetween(sheet, a.id, b.id, h0.id, h1.id);
      const min = occupant ? p.minInterior[occupant.kind] : 0;

      if (right + min > left) {
        out.push({
          law: "L1",
        setting: "profile.minCarcassMm",
          detail:
            `interior between ${a.id} and ${b.id} in row ${h0.id}..${h1.id} is ` +
            `${left - right}mm, below the ${min}mm minimum for a ${occupant?.kind ?? "gap"}`,
          where: { line: b.id, block: occupant?.id },
        });
      }
    }
  }
  return out;
}

/** The block occupying exactly this cell, if any. */
export const blockBetween = (
  sheet: Sheet, v0: LineId, v1: LineId, h0: LineId, h1: LineId,
): Block | undefined =>
  sheet.blocks.find(
    (b) => b.bounds.v0 === v0 && b.bounds.v1 === v1 && b.bounds.h0 === h0 && b.bounds.h1 === h1,
  );

/** L3 — every carcass-layer cell belongs to exactly one block. Other layers may overlap and may
 *  leave gaps: a plinth in `front` running past three carcasses is legal and must stay legal. */
export function checkFullness(sheet: Sheet): Violation[] {
  const { mm } = resolvePositions(sheet);
  const vs = linesOn(sheet, "v", mm);
  const hs = linesOn(sheet, "h", mm);
  const out: Violation[] = [];
  const carcass = sheet.blocks.filter((b) => b.layer === "carcass");

  const covers = (b: Block, vi: number, hi: number): boolean => {
    const v0 = vs.findIndex((l) => l.id === b.bounds.v0);
    const v1 = vs.findIndex((l) => l.id === b.bounds.v1);
    const h0 = hs.findIndex((l) => l.id === b.bounds.h0);
    const h1 = hs.findIndex((l) => l.id === b.bounds.h1);
    return vi >= v0 && vi < v1 && hi >= h0 && hi < h1;
  };

  for (let hi = 0; hi + 1 < hs.length; hi++) {
    for (let vi = 0; vi + 1 < vs.length; vi++) {
      const hits = carcass.filter((b) => covers(b, vi, hi));
      if (hits.length === 0) {
        out.push({ law: "L3", detail: `carcass cell [${vi},${hi}] belongs to no block — a hole, not a Void` });
      } else if (hits.length > 1) {
        out.push({
          law: "L3",
          detail: `carcass cell [${vi},${hi}] is claimed by ${hits.map((b) => b.id).join(" and ")}`,
          where: { block: hits[0]!.id },
        });
      }
    }
  }
  return out;
}

/** L4 — a block is a rectangle of WHOLE cells: its bounds must name real lines, in order, on the
 *  right axes. A block that starts or ends mid-cell is unrepresentable rather than merely wrong. */
export function checkBlockRectangles(sheet: Sheet): Violation[] {
  const { mm } = resolvePositions(sheet);
  const out: Violation[] = [];
  const isAxis = (id: LineId, axis: Axis) => sheet.lines.find((l) => l.id === id)?.axis === axis;

  for (const b of sheet.blocks) {
    const { v0, v1, h0, h1 } = b.bounds;
    if (!isAxis(v0, "v") || !isAxis(v1, "v") || !isAxis(h0, "h") || !isAxis(h1, "h")) {
      out.push({ law: "L4", detail: `block ${b.id} names a line on the wrong axis`, where: { block: b.id } });
      continue;
    }
    if (mm.get(v0)! >= mm.get(v1)! || mm.get(h0)! >= mm.get(h1)!) {
      out.push({ law: "L4", detail: `block ${b.id} has non-positive extent`, where: { block: b.id } });
    }
  }
  return out;
}

/** Two segments claiming the same span of the same line. Found while building the first real
 *  kitchen: the demo re-authored an outer side that `createSheet` had already placed, and the
 *  sheet took both without a word. Every downstream layer then saw the span twice — two boards in
 *  the cut list where the wall has one, and a junction with two opinions about its own thickness.
 *
 *  A span belongs to exactly one segment. That was always true and was never checked. */
export function checkSegmentOverlap(sheet: Sheet): Violation[] {
  const seen = new Map<string, number>();
  for (const s of sheet.segments) {
    const [lo, hi] = [s.from, s.to].sort();
    const key = `${s.line}|${lo}|${hi}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, n]) => n > 1)
    .map(([key, n]) => {
      const [line, from, to] = key.split("|");
      return {
        law: "L7",
        detail:
          `${n} segments claim ${from}..${to} on line ${line}. A span carries one segment: ` +
          `two is two boards where the wall has one. Set the span, do not add to it.`,
        where: { line },
      };
    });
}

export const checkInvariants = (sheet: Sheet, p: SheetProfile): Violation[] => [
  ...resolvePositions(sheet).violations,
  ...checkBlockRectangles(sheet),
  ...checkFaceOrdering(sheet, p),
  ...checkFullness(sheet),
];

// ─── ε-snap (L5b) ─────────────────────────────────────────────────────────────────────────────

/** Two lines closer than ε are the same line. Clusters against COMMITTED positions only — never
 *  chained within one operation, or A at 0, B at ε−1 and C at 2ε−2 walk the whole track. */
export function snapToExisting(
  sheet: Sheet, axis: Axis, mmWanted: number, p: SheetProfile,
): { snappedTo: LineId } | { position: number } {
  const { mm } = resolvePositions(sheet);
  for (const line of sheet.lines) {
    if (line.axis !== axis) continue;
    if (Math.abs(mm.get(line.id)! - mmWanted) < p.epsilonMm) return { snappedTo: line.id };
  }
  return { position: Math.round(mmWanted) };
}

// ─── residuals (L16) ──────────────────────────────────────────────────────────────────────────

/** Split `total` by weights into integers that sum EXACTLY to total. The remainder goes where the
 *  policy says, never "wherever the rounding lands" — that is the bug that makes one cabinet 1mm
 *  narrower than its twin across a thousand builds. */
export function distribute(total: number, weights: number[], policy: ResidualPolicy): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map(Math.floor);
  let residual = total - floored.reduce((a, b) => a + b, 0);

  const order = policy === "leftmost-absorbs"
    ? floored.map((_, i) => i)
    : floored.map((_, i) => floored.length - 1 - i);

  for (const i of order) {
    if (residual <= 0) break;
    floored[i] = floored[i]! + 1;
    residual--;
  }
  return floored;
}

// ─── wall length is an input (L14) ────────────────────────────────────────────────────────────

/** The wall measured 2980, not 3000. Not an invariant repair — a declared, named operation that is
 *  allowed to FAIL LOUDLY rather than quietly squeezing a cabinet under its minimum. */
export function rescaleOpening(
  sheet: Sheet, newWidth: number, p: SheetProfile,
): { sheet: Sheet } | { refused: Violation[] } {
  const { mm } = resolvePositions(sheet);
  const vs = linesOn(sheet, "v", mm);
  if (vs.length < 2) return { sheet: { ...sheet, opening: { ...sheet.opening, width: newWidth } } };

  const first = mm.get(vs[0]!.id)!;
  const gaps = vs.slice(1).map((l, i) => mm.get(l.id)! - mm.get(vs[i]!.id)!);
  const shared = distribute(newWidth - first, gaps, p.residual);

  let running = first;
  const moved = new Map<LineId, number>([[vs[0]!.id, first]]);
  vs.slice(1).forEach((l, i) => { running += shared[i]!; moved.set(l.id, running); });

  const next: Sheet = {
    ...sheet,
    opening: { ...sheet.opening, width: newWidth },
    lines: sheet.lines.map((l) =>
      moved.has(l.id) && l.pos.kind === "authored" ? { ...l, pos: { kind: "authored", mm: moved.get(l.id)! } } : l,
    ),
  };

  const refused = checkInvariants(next, p);
  return refused.length ? { refused } : { sheet: next };
}

// ─── construction ─────────────────────────────────────────────────────────────────────────────

/** Mint a line id from the sheet's own counter. Pure: same sheet in, same id out. */
export const peekLineId = (sheet: Sheet, axis: Axis): LineId => `${axis}${sheet.nextId.toString(36)}`;

/** Add a line, returning the new sheet and the id it was given. The only way to create a line, so
 *  the counter can never be bypassed and two lines can never share an id. */
export function addLine(sheet: Sheet, axis: Axis, pos: Position): { sheet: Sheet; id: LineId } {
  const id = peekLineId(sheet, axis);
  return {
    id,
    sheet: { ...sheet, nextId: sheet.nextId + 1, lines: [...sheet.lines, { id, axis, pos }] },
  };
}

/** An empty opening: two vertical lines at the ends, two horizontal, one carcass Void between them.
 *  The sheet is full from the first moment (L3) — there is never a hole, only a Void. */
/** The profile is REQUIRED, with no default: a default here would be a setting living in the
 *  engine again, and the caller always has one loaded from `things/profiles/`. */
export function createSheet(opening: Opening, p: SheetProfile): Sheet {
  const empty: Sheet = { opening, lines: [], segments: [], blocks: [], nextId: 0 };
  // L15 — the outer faces bound the opening, so an end carrying a board sits half a board inside.
  const endBoards = (e: EndCondition): 0 | 1 => (e === "against-wall" ? 0 : 1);
  const lb = endBoards(opening.ends.left), rb = endBoards(opening.ends.right);

  const a = addLine(empty, "v", { kind: "authored", mm: (lb * p.boardMm) / 2 });
  const b = addLine(a.sheet, "v", { kind: "authored", mm: opening.width - (rb * p.boardMm) / 2 });
  const c = addLine(b.sheet, "h", { kind: "authored", mm: 0 });
  const d = addLine(c.sheet, "h", { kind: "authored", mm: opening.height });

  return {
    ...d.sheet,
    segments: [
      lb === 0
        ? { line: a.id, from: c.id, to: d.id, boards: 0 as const }
        : { line: a.id, from: c.id, to: d.id, boards: lb, role: "side" as const },
      rb === 0
        ? { line: b.id, from: c.id, to: d.id, boards: 0 as const }
        : { line: b.id, from: c.id, to: d.id, boards: rb, role: "side" as const },
    ],
    blocks: [
      { id: "b0", kind: "void", layer: "carcass", bounds: { v0: a.id, v1: b.id, h0: c.id, h1: d.id } },
    ],
  };
}
