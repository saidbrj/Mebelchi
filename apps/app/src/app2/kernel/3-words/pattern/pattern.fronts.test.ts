import { describe, it, expect } from "vitest";
import { cutList, run } from "../../index";
import { build, CUBE_600, dims, origin } from "../../testkit";
import type { Command } from "../../index";
import { frontCellMm } from "../../../poligon/model/fill";

/** Фасадный паттерн: ячейки заполняются фасадами, между ними воздух, по краям поле (Q20). */
const doors = (count: number): Command => ({
  word: "PATTERN", op: "create", space: "U1", axis: "x",
  gaps: Array.from({ length: count }, () => ({ ratio: 1 })), member: null,
  fill: { type: "front", face: "front" },
});

describe("фасады [spec:Q20]", () => {
  it("[spec:Q20] одна створка: юнит минус поле с каждой стороны", () => {
    const { state } = build(CUBE_600, doors(1));
    // Полигон считает так же: 600 − 1.5 − 1.5 = 597 по ширине, 720 − 3 = 717 по высоте
    expect(dims(state.evaluation.boxes.P5)).toEqual([597, 717, 16]);
    expect(frontCellMm(600, 1)).toBe(597);
    expect(frontCellMm(720, 1)).toBe(717);
  });

  it("[spec:Q20] две створки: поле по краям, зазор между ними", () => {
    const { state } = build(CUBE_600, doors(2));
    const left = dims(state.evaluation.boxes.P5);
    const right = dims(state.evaluation.boxes.P6);
    expect(left[0]).toBe(frontCellMm(600, 2));   // (600 − 3 − 3) / 2 = 297
    expect(left).toEqual(right);
    expect(left[1]).toBe(717);
  });

  it("[spec:E08] фасад лежит СНАРУЖИ юнита и не лезет внутрь", () => {
    const { state } = build(CUBE_600, doors(1));
    const front = state.evaluation.boxes.P5!;
    expect(origin(front)[2]).toBe(-16);          // от −16 до 0: перед юнита
    expect(front.max.z).toBe(0);
  });

  it("[spec:R37] фасады доезжают до раскроя своими размерами", () => {
    const s = build(CUBE_600, doors(2));
    const rows = cutList(s).filter((r) => r.role === "front");
    expect(rows).toHaveLength(2);
    // у фасада длина — это высота, как у Полигона: 717 × 297
    expect([rows[0]!.lengthMm, rows[0]!.widthMm, rows[0]!.thicknessMm]).toEqual([717, 297, 16]);
  });

  it("[spec:Q20] поля и зазор приходят из профиля: зазор 2 меняет обе створки", () => {
    const s = build(CUBE_600, doors(2));
    const narrower = run(s, { word: "DRAG", target: "unit", axis: "x", size: 800 });
    expect(dims(narrower.session.state.evaluation.boxes.P5)[0]).toBe(frontCellMm(800, 2));
  });
});
