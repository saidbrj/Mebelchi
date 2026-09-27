// ПОЛИГОН · the bench's starting wall.
//
// Deliberately not an empty opening. A blank sheet shows nothing about the engine, and DB/48 §6 is
// explicit that speed comes from opening in a plausible state rather than from typing your way to
// one. This wall exercises the four things worth seeing at a glance:
//
//   · a SHARED seam (one board between two bases) next to a MODULE BOUNDARY (two, back to back)
//   · a tall block SPANNING the worktop line, so the worktop must terminate at its side
//   · a worktop outranking the sides it crosses, so its ends butt and the bases lose their tops
//   · Voids above the bases, because the carcass layer is always full and never holed

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type Opening, type Segment, type Sheet, type SheetProfile,
} from "./model/sheet";

export const OPENING: Opening = {
  width: 3000,
  height: 2400,
  ends: { left: "against-wall", right: "free" },
};

export function seedWall(p: SheetProfile): Sheet {
  const base = createSheet(OPENING, p);
  const m0 = resolvePositions(base).mm;
  const [left, right] = linesOn(base, "v", m0);
  const [floor, ceil] = linesOn(base, "h", m0);

  const w = addLine(base, "h", { kind: "authored", mm: 850 });   // the worktop line
  const a = addLine(w.sheet, "v", { kind: "authored", mm: 900 }); // shared seam
  const b = addLine(a.sheet, "v", { kind: "authored", mm: 1800 }); // module boundary

  const segments: Segment[] = [
    ...b.sheet.segments,
    { line: a.id, from: floor!.id, to: w.id, boards: 1, role: "side" },
    { line: b.id, from: floor!.id, to: ceil!.id, boards: 2, role: "side" },
    { line: w.id, from: left!.id, to: b.id, boards: 1, role: "worktop" },
  ];

  return normalizeSegments({
    ...b.sheet,
    segments,
    blocks: [
      { id: "base-1", kind: "block", layer: "carcass", bounds: { v0: left!.id, v1: a.id, h0: floor!.id, h1: w.id } },
      { id: "base-2", kind: "block", layer: "carcass", bounds: { v0: a.id, v1: b.id, h0: floor!.id, h1: w.id } },
      { id: "air-1", kind: "void", layer: "carcass", bounds: { v0: left!.id, v1: a.id, h0: w.id, h1: ceil!.id } },
      { id: "air-2", kind: "void", layer: "carcass", bounds: { v0: a.id, v1: b.id, h0: w.id, h1: ceil!.id } },
      { id: "pantry", kind: "block", layer: "carcass", bounds: { v0: b.id, v1: right!.id, h0: floor!.id, h1: ceil!.id } },
    ],
  });
}
