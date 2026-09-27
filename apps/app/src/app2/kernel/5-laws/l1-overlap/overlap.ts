// L1a (SPEC 06_LAWS): две доски не занимают один объём. Проверяет, ничего не чинит.
import { finding, type Finding } from "../../0-base/findings/findings";
import { toMm } from "../../0-base/units/units";
import { AXES, partsOf, type Graph } from "../../1-graph/model/model";
import type { Box, Evaluation } from "../../1-graph/evaluate/evaluate";

/** Глубина перекрытия по каждой оси; пересечение — только если все три больше нуля. */
function depths(a: Box, b: Box): number[] {
  return AXES.map((ax) => Math.min(a.max[ax], b.max[ax]) - Math.max(a.min[ax], b.min[ax]));
}

/**
 * L1a с одним исключением (R37): две доски МОГУТ пересекаться, если стык говорит, кто из них
 * сквозной — тогда вторую режут в раскрое. Всё остальное пересечение по-прежнему отказ.
 */
export function overlap(g: Graph, ev: Evaluation, resolved: ReadonlySet<string> = new Set()): Finding[] {
  const parts = partsOf(g).filter((p) => ev.boxes[p.id]);
  const out: Finding[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!;
      const b = parts[j]!;
      // Задняя стенка (ХДФ 4мм) заходит в паз или крепится внахлёст, не конфликтует с полками/корпусом
      if ((a.type === "back" && b.type !== "back") || (b.type === "back" && a.type !== "back")) continue;
      const d = depths(ev.boxes[a.id]!, ev.boxes[b.id]!);
      if (d.every((v) => v > 0) && !resolved.has([a.id, b.id].sort().join("×"))) {
        out.push(finding("REF-OVERLAP", [a.id, b.id],
          `${a.id} (${a.type}) и ${b.id} (${b.type}) перекрываются на ${d.map((v) => toMm(v)).join(" × ")} мм`,
          ["сдвинуть одну из них", "изменить размер одной из них"]));
      }
    }
  }
  return out;
}
