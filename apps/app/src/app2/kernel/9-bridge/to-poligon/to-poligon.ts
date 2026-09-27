// Мост в Полигон (SPEC O02, O08, P04). Ядро отдаёт готовые детали; Полигон их не пересчитывает.
import { toMm } from "../../0-base/units/units";
import { AXES, partsOf, type Graph, type PartNode, type UnitNode } from "../../1-graph/model/model";
import { extent, type Box, type Evaluation } from "../../1-graph/evaluate/evaluate";
import type { Segment } from "../../4-constraints/joints/joints.segments";
// тип детали Полигона переэкспортируется отсюда: выше слоя 9 Полигон никто не трогает (A02)
import type { FillPart } from "../../../poligon/model/fill";
export type { FillPart };
import {
  backWidthMm, frontCellMm, innerWidthMm, shelfDepthMm, type CabinetFill,
} from "../../../poligon/model/fill";

export interface BridgeInput {
  graph: Graph;
  evaluation: Evaluation;
  segments: Segment[];
  /** имя юнита для Полигона: он группирует детали по шкафу */
  cabinet?: string;
}

/**
 * Три размера детали так, как их ждёт лист (соглашение Полигона): толщина — по нормали;
 * **длина — вдоль прогона детали**: у боковины и фасада это высота, у полки — ширина юнита;
 * ширина — оставшийся размер. Брать «больший из двух» нельзя: отрезанная полка 200 × 538 поехала
 * бы в раскрой длиной 538, а фасад 397 × 717 — длиной 397 вместо высоты.
 */
export function sizes(part: PartNode, box: Box): { lengthMm: number; widthMm: number; thicknessMm: number } {
  const others = AXES.filter((a) => a !== part.normal) as [typeof AXES[number], typeof AXES[number]];
  // у вертикальной детали (боковина, фасад, задник) длина — это высота; у горизонтальной — ширина юнита
  const along = part.normal === "y" ? "x" : "y";
  const across = others.find((a) => a !== along)!;
  return {
    lengthMm: toMm(extent(box, along)),
    widthMm: toMm(extent(box, across)),
    thicknessMm: toMm(extent(box, part.normal)),
  };
}

/** Детали ядра в виде, который принимает Полигон. В раскрой едут ОТРЕЗКИ, а не целые доски (R37). */
export function toFillParts({ graph, evaluation, segments, cabinet = "U1" }: BridgeInput): FillPart[] {
  const byId = new Map(partsOf(graph).map((p) => [p.id, p]));
  return segments.flatMap((s): FillPart[] => {
    const part = byId.get(s.part);
    if (!part) return [];
    const { lengthMm, widthMm, thicknessMm } = sizes(part, s.box);
    const cut = s.between.filter(Boolean);
    return [{
      cabinet, role: part.type, lengthMm, widthMm, thicknessMm,
      note: cut.length ? `${s.id}, отрезана ${cut.join(" и ")}` : s.id,
    }];
  });
}

/** Юнит графа: у моста он один (App 2 строит одну ячейку). */
function unitOf(graph: Graph): UnitNode | undefined {
  const n = graph.order.map((id) => graph.nodes[id]!).find((x) => x.kind === "unit");
  return n?.kind === "unit" ? n : undefined;
}

/** Юнит в терминах Полигона — чтобы его собственные формулы можно было спросить о том же шкафу. */
export function toCabinetFill({ graph, evaluation, cabinet = "U1" }: BridgeInput): CabinetFill | undefined {
  const unit = graph.order.map((id) => graph.nodes[id]!).find((n) => n.kind === "unit");
  const sides = partsOf(graph).filter((p) => p.type === "side");
  const box = unit && evaluation.boxes[unit.id];
  if (!unit || unit.kind !== "unit" || !box || sides.length < 2) return undefined;
  const thickness = (p: PartNode) => toMm(extent(evaluation.boxes[p.id]!, p.normal));
  return {
    id: cabinet,
    // Полигон меряет колонку по ОСЯМ стоек, ядро — по наружным граням: половина стойки с каждой стороны
    widthMm: toMm(extent(box, "x")) - thickness(sides[0]!) / 2 - thickness(sides[1]!) / 2,
    heightMm: toMm(extent(box, "y")),
    depthMm: toMm(extent(box, "z")),
    sideMm: { left: thickness(sides[0]!), right: thickness(sides[1]!) },
    // наполнение ядро описывает своими словами; Полигону здесь нужен только корпус
    fill: { kind: "open" },
    back: partsOf(graph).some((p) => p.type === "back"),
  };
}

export interface Disagreement {
  what: string;
  kernel: number;
  poligon: number;
}

/**
 * Сверка «одна правда» (P04): величины, которые Полигон умеет посчитать сам, против чисел ядра.
 * Пустой список — слои согласны. Непустой — красный тест: разошёлся СМЫСЛ, а не число.
 */
export function disagreements(input: BridgeInput): Disagreement[] {
  const c = toCabinetFill(input);
  if (!c) return [];
  const { graph, evaluation } = input;
  const out: Disagreement[] = [];
  const say = (what: string, kernel: number | undefined, poligon: number) => {
    if (kernel !== undefined && Math.abs(kernel - poligon) > 0) out.push({ what, kernel, poligon });
  };

  const space = graph.order.map((id) => graph.nodes[id]!).find((n) => n.kind === "space" && n.host?.startsWith("U"));
  const inner = space && evaluation.boxes[space.id];
  say("проём по ширине", inner ? toMm(extent(inner, "x")) : undefined, innerWidthMm(c));

  const shelf = partsOf(graph).find((p) => p.type === "shelf");
  const shelfBox = shelf && evaluation.boxes[shelf.id];
  if (shelf && shelfBox) say("глубина полки", sizes(shelf, shelfBox).widthMm, shelfDepthMm(c));

  const back = partsOf(graph).find((p) => p.type === "back");
  const backBox = back && evaluation.boxes[back.id];
  // «ширина» — поперёк прогона: у задника длина это высота (см. sizes)
  if (back && backBox) say("ширина задника", sizes(back, backBox).widthMm, backWidthMm(c));

  // Фасад Полигон считает от колонки между ОСЯМИ стоек: он всегда исходит из общей боковины.
  // У отдельно стоящего юнита фасад закрывает боковины целиком — такой колонки у Полигона
  // просто нет, сверять нечего. Разошлось бы не число, а картина мира.
  const unit = unitOf(graph);
  const shared = unit?.neighbours?.left === "unit" && unit?.neighbours?.right === "unit";
  const front = partsOf(graph).find((p) => p.type === "front");
  const frontBox = front && evaluation.boxes[front.id];
  if (front && frontBox && shared) {
    const pattern = front.position.kind === "fill" ? front.position.pattern : undefined;
    const leaves = partsOf(graph).filter(
      (p) => p.type === "front" && p.position.kind === "fill" && p.position.pattern === pattern,
    ).length;
    const box = sizes(front, frontBox);
    say("ширина створки", box.widthMm, frontCellMm(c.widthMm, leaves));
    say("высота фасада", box.lengthMm, frontCellMm(c.heightMm, 1));
  }

  return out;
}
