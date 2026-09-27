// Отрезки в раскрое (SPEC R37, R35). В модели деталь остаётся одной; сквозные соседи режут её
// на куски только для производства. Имена отрезков производные: P5.1, P5.2 — uid модели не трогаем.
import { toMm, type Mm10 } from "../../0-base/units/units";
import { partsOf, type Axis, type Graph } from "../../1-graph/model/model";
import { extent, type Box, type Evaluation } from "../../1-graph/evaluate/evaluate";
import type { Joint } from "./joints";

export interface Segment {
  /** производное имя: `P5.1`. Один отрезок — имя совпадает с деталью */
  id: string;
  part: string;
  box: Box;
  /** длина по оси реза, мм */
  lengthMm: number;
  /** чем отрезан слева и справа: имена сквозных деталей или пусто на краю */
  between: [string | null, string | null];
}

/**
 * Режет деталь по всем стыкам, где сквозной объявлен сосед. Порядок отрезков — от меньшей
 * координаты к большей, поэтому результат не зависит от порядка команд.
 */
export function segmentsOf(g: Graph, ev: Evaluation, joints: Joint[]): Segment[] {
  const out: Segment[] = [];
  for (const part of partsOf(g)) {
    const box = ev.boxes[part.id];
    if (!box) continue;
    const cuts = joints
      .filter((j) => j.kind === "cross" && j.through && j.through !== part.id && (j.a === part.id || j.b === part.id))
      .map((j) => ({ by: j.through!, axis: j.axis, box: ev.boxes[j.through!]! }))
      .filter((c) => c.box);

    if (!cuts.length) {
      out.push({ id: part.id, part: part.id, box, lengthMm: 0, between: [null, null] });
      continue;
    }
    const axis: Axis = cuts[0]!.axis;
    const ordered = [...cuts].sort((x, y) => x.box.min[axis] - y.box.min[axis]);
    let from: Mm10 = box.min[axis];
    let previous: string | null = null;
    const pieces: Segment[] = [];
    for (const cut of [...ordered, null]) {
      const to: Mm10 = cut ? cut.box.min[axis] : box.max[axis];
      if (to > from) {
        pieces.push({
          id: `${part.id}.${pieces.length + 1}`, part: part.id,
          box: { min: { ...box.min, [axis]: from }, max: { ...box.max, [axis]: to } },
          lengthMm: toMm(to - from),
          between: [previous, cut ? cut.by : null],
        });
      }
      if (cut) {
        from = cut.box.max[axis];
        previous = cut.by;
      }
    }
    out.push(...pieces);
  }
  return out;
}

/** Сколько деталей уедет в раскрой: одна целая деталь или её отрезки. */
export const cutCount = (segments: Segment[]): number => segments.length;

export const lengthOfPart = (b: Box, axis: Axis): number => toMm(extent(b, axis));
