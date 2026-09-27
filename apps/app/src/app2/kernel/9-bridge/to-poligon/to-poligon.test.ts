import { describe, it, expect } from "vitest";
import { run, segments } from "../../index";
import { build, CUBE_600 } from "../../testkit";
import type { Command, Session } from "../../index";
import { disagreements, sizes, toCabinetFill, toFillParts } from "./to-poligon";
import { frontCellMm, innerWidthMm, shelfDepthMm } from "../../../poligon/model/fill";
import { partsOf } from "../../1-graph/model/model";

const input = (s: Session) => ({ graph: s.state.graph, evaluation: s.state.evaluation, segments: segments(s) });
const SHELVES: Command = { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ ratio: 1 }, { ratio: 1 }], member: "shelf" };
const FRONTS = (leaves: number): Command => ({
  word: "PATTERN", op: "create", space: "U1", axis: "x",
  gaps: Array.from({ length: leaves }, () => ({ ratio: 1 })), member: null,
  fill: { type: "front", face: "front" },
});
/** тот же юнит, но App 1 сказал: боковины общие с соседями */
const CUBE_SHARED: Command = { word: "CUBE", w: 600, h: 720, d: 560, neighbours: { left: "unit", right: "unit" } };

describe("мост в Полигон [spec:O08]", () => {
  it("[spec:P04] [rt:J6] числа ядра и формулы Полигона сходятся: проём 568, полка 538", () => {
    const s = build(CUBE_600, SHELVES);
    const c = toCabinetFill(input(s))!;
    expect(innerWidthMm(c)).toBe(568);
    expect(shelfDepthMm(c)).toBe(538);
    expect(disagreements(input(s))).toEqual([]);
  });

  it("[spec:O02] Полигон получает готовые детали, а не пересчитывает их", () => {
    const s = build(CUBE_600, SHELVES);
    const rows = toFillParts(input(s));
    expect(rows).toHaveLength(5);   // 4 доски корпуса + одна полка (два промежутка)
    const side = rows.find((r) => r.role === "side")!;
    expect([side.lengthMm, side.widthMm, side.thicknessMm]).toEqual([720, 560, 16]);
    const shelf = rows.find((r) => r.role === "shelf")!;
    expect([shelf.lengthMm, shelf.widthMm, shelf.thicknessMm]).toEqual([568, 538, 16]);
    for (const r of rows) expect(r.cabinet).toBe("U1");
  });

  it("[spec:R37] в раскрой едут отрезки, и в примечании написано, кем отрезаны", () => {
    const s = build(
      CUBE_600,
      { word: "PLACE", host: "S1", type: "shelf", spans: { x: "full", z: "full" },
        relation: { kind: "on", plane: { node: "S1", face: "bottom" }, side: "inside", offset: 300 } },
      { word: "PLACE", host: "S1", type: "divider", spans: { y: "full", z: "full" },
        relation: { kind: "on", plane: { node: "S1", face: "left" }, side: "inside", offset: 200 } },
    );
    const rows = toFillParts(input(s));
    const pieces = rows.filter((r) => r.role === "shelf");
    expect(pieces.map((p) => p.lengthMm)).toEqual([200, 352]);
    expect(pieces[0]!.note).toContain("отрезана P6");
    expect(rows.find((r) => r.role === "divider")!.lengthMm).toBe(688);
  });

  it("[spec:U05] mm10 переводятся в мм один раз, на границе", () => {
    const s = build(CUBE_600);
    const part = partsOf(s.state.graph)[0]!;
    const box = s.state.evaluation.boxes[part.id]!;
    expect(sizes(part, box)).toEqual({ lengthMm: 720, widthMm: 560, thicknessMm: 16 });
    expect(Number.isInteger(box.max.y)).toBe(true);    // внутри всё ещё целые mm10
    expect(box.max.y).toBe(7200);
  });

  it("[spec:P04] расхождение ядра и Полигона было бы видно сразу", () => {
    const s = build(CUBE_600, SHELVES);
    const broken = { ...input(s) };
    // подменяем один размер, как если бы слои разошлись: сверка обязана это назвать
    const shelf = partsOf(broken.graph).find((p) => p.type === "shelf")!;
    const box = broken.evaluation.boxes[shelf.id]!;
    broken.evaluation = { ...broken.evaluation, boxes: { ...broken.evaluation.boxes, [shelf.id]: { ...box, max: { ...box.max, z: box.max.z - 100 } } } };
    const found = disagreements(broken);
    expect(found.map((d) => d.what)).toContain("глубина полки");
    expect(found[0]!.kernel).not.toBe(found[0]!.poligon);
  });

  it("[spec:O08] габарит юнита в терминах Полигона считается по осям стоек", () => {
    const s = build(CUBE_600);
    const c = toCabinetFill(input(s))!;
    expect(c.widthMm).toBe(584);          // 600 наружу − половина каждой стойки
    expect(c.heightMm).toBe(720);
    expect(c.depthMm).toBe(560);
    expect(c.back).toBe(false);
  });
  it("[spec:P04] [spec:Q20] у общей стойки створка ядра — это створка Полигона", () => {
    const s = build(CUBE_SHARED, FRONTS(2));
    const c = toCabinetFill(input(s))!;
    const leaf = toFillParts(input(s)).filter((r) => r.role === "front");
    expect(leaf).toHaveLength(2);
    // ширина створки — поперёк прогона; длина фасада — его высота
    expect(leaf[0]!.widthMm).toBe(frontCellMm(c.widthMm, 2));
    expect(leaf[0]!.lengthMm).toBe(frontCellMm(c.heightMm, 1));
    expect(disagreements(input(s))).toEqual([]);
  });

  it("[spec:P04] у отдельного юнита фасад шире: Полигон такую колонку не описывает, и сверка молчит", () => {
    const s = build(CUBE_600, FRONTS(1));
    const front = toFillParts(input(s)).find((r) => r.role === "front")!;
    expect([front.lengthMm, front.widthMm]).toEqual([717, 597]);   // закрывает боковины целиком
    expect(frontCellMm(toCabinetFill(input(s))!.widthMm, 1)).toBe(581);
    // разошлась не арифметика, а картина мира: сверять эти два числа нельзя
    expect(disagreements(input(s)).map((d) => d.what)).not.toContain("ширина створки");
  });

  it("[spec:P04] подменённая створка сверку роняет", () => {
    const s = build(CUBE_SHARED, FRONTS(2));
    const broken = { ...input(s) };
    const front = partsOf(broken.graph).find((p) => p.type === "front")!;
    const box = broken.evaluation.boxes[front.id]!;
    broken.evaluation = { ...broken.evaluation, boxes: { ...broken.evaluation.boxes, [front.id]: { ...box, max: { ...box.max, x: box.max.x - 100 } } } };
    expect(disagreements(broken).map((d) => d.what)).toContain("ширина створки");
  });
});
