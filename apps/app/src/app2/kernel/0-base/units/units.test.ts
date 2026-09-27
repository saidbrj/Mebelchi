import { describe, it, expect } from "vitest";
import { divide, fromMm, toMm } from "./units";

describe("units · mm10", () => {
  it("[spec:U01] 16 мм = 160, 1.5 мм = 15, 0.1 мм = 1", () => {
    expect(fromMm(16)).toBe(160);
    expect(fromMm(1.5)).toBe(15);
    expect(fromMm(0.1)).toBe(1);
    expect(toMm(5685)).toBe(568.5);
  });

  it("[spec:U06] [rt:J8] ввод точнее 0.1 мм не округляется молча", () => {
    expect(fromMm(0.05)).toBeNull();
    expect(fromMm(237.25)).toBeNull();
    expect(fromMm(Number.NaN)).toBeNull();
  });

  it("[spec:U03] [rt:H3] 1000 на 3 → 3334 + 3333 + 3333, сумма точна", () => {
    const parts = divide(10000, [1, 1, 1], "leftmost-absorbs");
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(divide(10000, [1, 1, 1], "last-absorbs")).toEqual([3333, 3333, 3334]);
  });

  it("[spec:U03] сумма частей всегда равна целому, при любых весах", () => {
    for (const total of [0, 1, 7, 5680, 10001, 23999]) {
      for (const w of [[1], [1, 2], [1, 1.618], [3, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1]]) {
        const parts = divide(total, w, "leftmost-absorbs");
        expect(parts.reduce((a, p) => a + p, 0)).toBe(total);
        expect(parts.every(Number.isInteger)).toBe(true);
      }
    }
  });
});
