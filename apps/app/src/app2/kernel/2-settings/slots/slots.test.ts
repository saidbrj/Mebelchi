import { describe, it, expect } from "vitest";
import { DEFAULT_SLOTS, materialOf, slotForType } from "./slots";

describe("слоты [spec:E12]", () => {
  it("[spec:S03] слоты проекта и их материалы приходят из файла", () => {
    expect(Object.keys(DEFAULT_SLOTS)).toContain("ФАСАД-A");
    expect(Object.keys(DEFAULT_SLOTS)).toContain("КОРПУС-A");
    expect(materialOf(DEFAULT_SLOTS, "ФАСАД-A")).toBe("ldsp-16-white");
  });

  it("[spec:E12] деталь получает слот по своему типу, а не по названию в коде", () => {
    expect(slotForType("shelf")).toBe("КОРПУС-A");
    expect(slotForType("front")).toBe("ФАСАД-A");
    expect(slotForType("невиданный")).toBe(Object.keys(DEFAULT_SLOTS)[0]);
  });

  it("[spec:E12] слот, которого нет в проекте, честно показывает прочерк", () => {
    expect(materialOf({}, "ФАСАД-Z")).toBe("—");
  });
});
