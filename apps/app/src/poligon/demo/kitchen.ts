// ПОЛИГОН · a real kitchen, end to end.
//
// Not a test fixture — a wall somebody would actually order. 3600mm, a run of bases under a
// worktop, uppers above, and a floor-to-ceiling pantry on the right that SHARES its left board
// with the last base. That shared board is the founder's own case: physically one 2400mm panel,
// and the base beside it simply has no right side of its own.
//
// Everything below is built through the ordinary API. Nothing here is special-cased for the demo.

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type LineId, type Opening, type Segment, type Sheet, type SheetProfile,
} from "../model/sheet";
import type { Role } from "../model/roles";

export const OPENING: Opening = {
  width: 3600,
  height: 2400,
  ends: { left: "into-corner", right: "free" },
};

export interface Kitchen {
  sheet: Sheet;
  v: Record<string, LineId>;
  h: Record<string, LineId>;
}

export function kitchen(p: SheetProfile): Kitchen {
  let s = createSheet(OPENING, p);
  const m0 = resolvePositions(s).mm;
  const [wall, free] = linesOn(s, "v", m0);
  const [floor, ceil] = linesOn(s, "h", m0);

  const V: Record<string, LineId> = { wall: wall!.id, free: free!.id };
  const H: Record<string, LineId> = { floor: floor!.id, ceil: ceil!.id };

  const add = (into: Record<string, LineId>, name: string, axis: "v" | "h", mm: number) => {
    const r = addLine(s, axis, { kind: "authored", mm });
    s = r.sheet;
    into[name] = r.id;
  };

  // the vertical grid: sink · drawers · cooker · corner base | pantry
  add(V, "a", "v", 800);    // sink cabinet ends
  add(V, "b", "v", 1400);   // drawer bank ends
  add(V, "c", "v", 2000);   // cooker opening ends
  add(V, "pantry", "v", 3000); // the SHARED board — base on the left, pantry on the right

  // the horizontal grid
  add(H, "worktop", "h", 850);   // столешница
  add(H, "upperLow", "h", 1450); // uppers start
  add(H, "upperTop", "h", 2100); // uppers end

  const seg = (line: LineId, from: LineId, to: LineId, boards: 1 | 2, role: Role): Segment =>
    ({ line, from, to, boards, role });

  // `createSheet` already authored the two outer verticals full height (L15). The left one is
  // replaced here — this wall's end cabinet has a side under the worktop and another behind the
  // upper, with nothing between them. The right one is kept exactly as it is: the pantry's outer
  // side really does run floor to ceiling.
  const segments: Segment[] = [
    ...s.segments.filter((x) => x.line !== V.wall),

    // ── vertical carcass boards ───────────────────────────────────────────────────────────────
    // base run: a side on every line, floor to worktop
    seg(V.a!, H.floor!, H.worktop!, 1, "side"),
    seg(V.b!, H.floor!, H.worktop!, 1, "side"),
    seg(V.c!, H.floor!, H.worktop!, 1, "side"),
    // the pantry's left board, floor to CEILING, shared with the base beside it
    seg(V.pantry!, H.floor!, H.ceil!, 1, "side"),
    seg(V.wall!, H.floor!, H.worktop!, 1, "side"),

    // upper run: sides only where the uppers are
    seg(V.wall!, H.upperLow!, H.upperTop!, 1, "side"),
    seg(V.a!, H.upperLow!, H.upperTop!, 1, "side"),
    seg(V.b!, H.upperLow!, H.upperTop!, 1, "side"),
    seg(V.c!, H.upperLow!, H.upperTop!, 1, "side"),

    // ── horizontal boards ─────────────────────────────────────────────────────────────────────
    // bottoms of the bases — one authored span; the sides outrank them, so each cabinet gets
    // its own bottom automatically. Nobody authors "four bottoms".
    seg(H.floor!, V.wall!, V.pantry!, 1, "bottom"),
    // the worktop: outranks every side it crosses, so it runs straight through and the bases
    // lose their tops. It terminates on the pantry board.
    seg(H.worktop!, V.wall!, V.pantry!, 1, "worktop"),
    // upper bottoms and tops
    seg(H.upperLow!, V.wall!, V.c!, 1, "bottom"),
    seg(H.upperTop!, V.wall!, V.c!, 1, "top"),
    // pantry shelves
    seg(H.worktop!, V.pantry!, V.free!, 1, "shelf"),
    seg(H.upperLow!, V.pantry!, V.free!, 1, "shelf"),
  ];

  const cell = (id: string, kind: "block" | "void" | "reserved", v0: LineId, v1: LineId, h0: LineId, h1: LineId, tags?: string[]) =>
    ({ id, kind, layer: "carcass" as const, bounds: { v0, v1, h0, h1 }, ...(tags ? { tags } : {}) });

  return {
    sheet: normalizeSegments({
      ...s,
      segments,
      blocks: [
        // base row
        cell("mojka", "block", V.wall!, V.a!, H.floor!, H.worktop!, ["sink"]),
        cell("yashiklar", "block", V.a!, V.b!, H.floor!, H.worktop!),
        cell("plita", "reserved", V.b!, V.c!, H.floor!, H.worktop!),
        cell("burchak", "block", V.c!, V.pantry!, H.floor!, H.worktop!),
        // backsplash band
        cell("fartuk-1", "void", V.wall!, V.a!, H.worktop!, H.upperLow!),
        cell("fartuk-2", "void", V.a!, V.b!, H.worktop!, H.upperLow!),
        cell("fartuk-3", "void", V.b!, V.c!, H.worktop!, H.upperLow!),
        cell("fartuk-4", "void", V.c!, V.pantry!, H.worktop!, H.upperLow!),
        // upper row
        cell("yuqori-1", "block", V.wall!, V.a!, H.upperLow!, H.upperTop!),
        cell("yuqori-2", "block", V.a!, V.b!, H.upperLow!, H.upperTop!),
        cell("so'rg'ich", "reserved", V.b!, V.c!, H.upperLow!, H.upperTop!, ["hood"]),
        cell("yuqori-3", "block", V.c!, V.pantry!, H.upperLow!, H.upperTop!),
        // above the uppers
        cell("tepa-1", "void", V.wall!, V.a!, H.upperTop!, H.ceil!),
        cell("tepa-2", "void", V.a!, V.b!, H.upperTop!, H.ceil!),
        cell("tepa-3", "void", V.b!, V.c!, H.upperTop!, H.ceil!),
        cell("tepa-4", "void", V.c!, V.pantry!, H.upperTop!, H.ceil!),
        // the pantry, floor to ceiling, one block
        cell("penal", "block", V.pantry!, V.free!, H.floor!, H.ceil!, ["tall"]),
      ],
    }),
    v: V, h: H,
  };
}
