// ПОЛИГОН · Kitchen #3 — П-образная. Третья работа корпуса.
//
// Здесь контракт угла встречается САМ С СОБОЙ: одна стена ведёт ДВА угла сразу.
//
//        стена-лево                        стена-право
//        (ведомая)                          (ведомая)
//            ║                                  ║
//            ║        ← проход →                ║
//            ║                                  ║
//            ╚══════════ стена-окно ════════════╝
//                        (ведущая)
//
// Задняя стена идёт во всю длину и владеет обоими углами. Боковые начинают свои шкафы после
// 600 её глубины плюс доборный брусок 53 — каждая со своего конца.
//
// И появляется величина, которой в Г-образной не было вовсе: ПРОХОД между боковыми рядами. Они
// стоят лицом друг к другу, и ящик напротив ящика — это не абстракция. Меряется он между
// ФАСАДАМИ, а не между стенами: глубина съедает с каждой стороны.

import {
  addLine, createSheet, linesOn, normalizeSegments, resolvePositions,
  type LineId, type Opening, type Segment, type Sheet, type SheetProfile,
} from "../model/sheet";
import type { Role } from "../model/roles";
import type { CabinetFill } from "../model/fill";
import { minFillerMm, type CornerBinding, type Passage } from "../model/corner";
import { STANDARDS } from "./kitchen1";

/** Ведущая: идёт во всю длину и владеет обоими углами. */
export const WALL_BACK: Opening = {
  width: 3000, height: 2400, ends: { left: "against-wall", right: "against-wall" },
};

/** Боковые: обе ведомые, каждая теряет угол со своего конца. */
export const WALL_SIDE: Opening = {
  width: 2453, height: 2400, ends: { left: "against-wall", right: "against-wall" },
};

export const LEADER_DEPTH_MM = 600;
export const FILLER_MM = minFillerMm("surface");
export const START_MM = LEADER_DEPTH_MM + FILLER_MM;

export const BINDINGS: CornerBinding[] = [
  { leaderWall: "стена-окно", followerWall: "стена-лево", angleDeg: 90,
    leaderDepthMm: LEADER_DEPTH_MM, handles: "surface", miter: "EURO_MITER" },
  { leaderWall: "стена-окно", followerWall: "стена-право", angleDeg: 90,
    leaderDepthMm: LEADER_DEPTH_MM, handles: "surface", miter: "EURO_MITER" },
];

export const LINEUP_BACK = [
  { w: 600, id: "z-мойка" },
  { w: 600, id: "z-пмм" },
  { w: 900, id: "z-ящики" },
  { w: 900, id: "z-кастрюли" },
] as const;

export const LINEUP_LEFT = [
  { w: 600, id: "l-духовка" },
  { w: 600, id: "l-ящики" },
  { w: 600, id: "l-шкаф" },
] as const;

export const LINEUP_RIGHT = [
  { w: 900, id: "r-варочная" },
  { w: 900, id: "r-шкаф" },
] as const;

/**
 * ПРОХОД. Боковые стены стоят напротив друг друга. Расстояние между их ФАСАДАМИ — это ширина
 * комнаты минус две глубины. `roomWidthMm` объявляется отдельно: комната не выводится из мебели.
 */
export const ROOM_WIDTH_MM = 2600;

export const passage = (drawerExtensionMm: [number, number] = [500, 500]): Passage => ({
  between: ["стена-лево", "стена-право"],
  clearMm: ROOM_WIDTH_MM - 560 * 2,
  drawerExtensionMm,
});

export interface Wall { sheet: Sheet; vs: LineId[]; boundariesMm: number[] }

function wall(
  opening: Opening, lineup: readonly { w: number; id: string }[],
  startAtMm: number, p: SheetProfile,
): Wall {
  let s = createSheet(opening, p);
  const m0 = resolvePositions(s).mm;
  const [left, right] = linesOn(s, "v", m0);
  const [floor, ceil] = linesOn(s, "h", m0);

  const H: Record<string, LineId> = { floor: floor!.id, ceil: ceil!.id };
  for (const [name, mm] of [["plinth", STANDARDS.plinthMm], ["worktop", STANDARDS.worktopMm]] as const) {
    const r = addLine(s, "h", { kind: "authored", mm });
    s = r.sheet; H[name] = r.id;
  }

  const inner: LineId[] = [];
  const boundariesMm: number[] = [];
  let x = startAtMm;
  if (startAtMm > 0) {
    const r = addLine(s, "v", { kind: "authored", mm: startAtMm });
    s = r.sheet; inner.push(r.id); boundariesMm.push(startAtMm);
  }
  for (const c of lineup.slice(0, -1)) {
    x += c.w;
    boundariesMm.push(x);
    const r = addLine(s, "v", { kind: "authored", mm: x });
    s = r.sheet; inner.push(r.id);
  }
  const vs = [left!.id, ...inner, right!.id];
  const carcassV = startAtMm > 0 ? vs.slice(1) : vs;

  const seg = (line: LineId, from: LineId, to: LineId, boards: 1 | 2, role: Role): Segment =>
    ({ line, from, to, boards, role });

  const segments: Segment[] = [
    ...s.segments.filter((q) => q.line !== left!.id && q.line !== right!.id),
    ...carcassV.map((v) => seg(v, H.plinth!, H.worktop!, 1, "side")),
    seg(H.plinth!, carcassV[0]!, carcassV[carcassV.length - 1]!, 1, "bottom"),
    seg(H.worktop!, vs[0]!, vs[vs.length - 1]!, 1, "worktop"),
    seg(H.floor!, carcassV[0]!, carcassV[carcassV.length - 1]!, 1, "plinth"),
  ];

  const cell = (id: string, kind: "block" | "void" | "reserved",
                v0: LineId, v1: LineId, h0: LineId, h1: LineId) =>
    ({ id, kind, layer: "carcass" as const, bounds: { v0, v1, h0, h1 } });

  const blocks: ReturnType<typeof cell>[] = [];
  if (startAtMm > 0) {
    blocks.push(
      cell("угол-цоколь", "void", vs[0]!, vs[1]!, H.floor!, H.plinth!),
      cell("угол-занят", "reserved", vs[0]!, vs[1]!, H.plinth!, H.worktop!),
      cell("угол-верх", "void", vs[0]!, vs[1]!, H.worktop!, H.ceil!),
    );
  }
  lineup.forEach((c, i) => {
    const v0 = carcassV[i]!, v1 = carcassV[i + 1]!;
    blocks.push(
      cell(`${c.id}-цоколь`, "void", v0, v1, H.floor!, H.plinth!),
      cell(c.id, c.id.includes("пмм") || c.id.includes("духовка") ? "reserved" : "block",
           v0, v1, H.plinth!, H.worktop!),
      cell(`${c.id}-верх`, "void", v0, v1, H.worktop!, H.ceil!),
    );
  });

  return { sheet: normalizeSegments({ ...s, segments, blocks }), vs, boundariesMm };
}

export const wallBack = (p: SheetProfile): Wall => wall(WALL_BACK, LINEUP_BACK, 0, p);
export const wallLeft = (p: SheetProfile): Wall => wall(WALL_SIDE, LINEUP_LEFT, START_MM, p);
export const wallRight = (p: SheetProfile): Wall => wall(WALL_SIDE, LINEUP_RIGHT, START_MM, p);

const BASE_H = STANDARDS.worktopMm - STANDARDS.plinthMm;

export function kitchen3Fill(p: SheetProfile): CabinetFill[] {
  const t = p.boardMm;
  const base = (id: string, widthMm: number, fill: CabinetFill["fill"], back = true): CabinetFill =>
    ({ id, widthMm, heightMm: BASE_H, depthMm: 560, sideMm: { left: t, right: t }, fill, back });

  return [
    base("z-мойка", 600, [
      { what: { kind: "false-front" }, heightMm: 140 },
      { what: { kind: "door", leaves: 2 } },
    ]),
    base("z-пмм", 600, { kind: "appliance-door" }, false),
    base("z-ящики", 900, { kind: "drawers", count: 3 }),
    base("z-кастрюли", 900, { kind: "drawers", count: 2 }),

    base("l-духовка", 600, { kind: "appliance-door" }, false),
    base("l-ящики", 600, { kind: "drawers", count: 2 }),
    base("l-шкаф", 600, { kind: "door", leaves: 2 }),

    base("r-варочная", 900, { kind: "drawers", count: 2 }),
    base("r-шкаф", 900, { kind: "door", leaves: 2 }),
  ];
}
