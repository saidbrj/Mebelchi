import { describe, it, expect } from "vitest";
import { EMPTY_COUNTERS, allocate, allocateMany, kindOf } from "./ids";

describe("ids", () => {
  it("[spec:G10] uid = буква вида + номер; счётчики не мутируются", () => {
    const [a, c1] = allocate(EMPTY_COUNTERS, "P");
    const [b] = allocate(c1, "P");
    expect([a, b]).toEqual(["P1", "P2"]);
    expect(EMPTY_COUNTERS.P).toBe(0);
    expect(kindOf("S12")).toBe("S");
  });

  it("[spec:G17] одни и те же счётчики дают одни и те же uid", () => {
    expect(allocateMany(EMPTY_COUNTERS, "S", 3)[0]).toEqual(allocateMany(EMPTY_COUNTERS, "S", 3)[0]);
  });
});
