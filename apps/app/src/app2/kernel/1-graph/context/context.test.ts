import { describe, it, expect } from "vitest";
import { EMPTY_COUNTERS, allocateMany } from "../../0-base/ids/ids";
import { FOREIGN, externalAt, isForeign, type UnitContext } from "./context";
import { FIXTURES } from "./context.fixtures";

const all = Object.entries(FIXTURES);

describe("контракт App 1 → App 2 [spec:R60]", () => {
  it("[spec:R60] в контексте есть всё, что нужно юниту, и ничего про модуль", () => {
    for (const [name, ctx] of all) {
      expect(ctx.unit.id, name).toMatch(/^U\d+$/);
      expect(ctx.unit.type.length, name).toBeGreaterThan(0);
      expect(ctx.profile, name).toBe("qorasu");
      expect(["floor", "plinth", "wall", "frame"], name).toContain(ctx.support);
      expect(JSON.stringify(ctx).toLowerCase(), name).not.toContain("mod" + "ule");
      expect(JSON.stringify(ctx).toLowerCase(), name).not.toContain("моду" + "ль");
    }
  });

  it("[spec:R22] чужую деталь нельзя спутать со своей: её id ядро не выдаёт никогда", () => {
    const [mine] = allocateMany(EMPTY_COUNTERS, "P", 50);
    expect(mine.some(isForeign)).toBe(false);
    for (const [name, ctx] of all) {
      for (const e of ctx.external) {
        expect(isForeign(e.id), `${name}: ${e.id}`).toBe(true);
        expect(e.id.split(FOREIGN)[0], name).not.toBe("");
        expect(e.thickness, name).toBeGreaterThan(0);
        expect(e.type.length, name).toBeGreaterThan(0);
      }
    }
  });

  it("[spec:R62] три фикстуры покрывают три обычные ситуации", () => {
    expect(FIXTURES.standalone!.external).toHaveLength(0);
    expect(externalAt(FIXTURES.sharedRight!, "right")?.type).toBe("боковина");
    expect(externalAt(FIXTURES.sharedRight!, "left")).toBeUndefined();
    expect(FIXTURES.betweenTwo!.external).toHaveLength(2);
  });

  it("[spec:R60] сосед и стена объявлены для каждой стороны, где они есть", () => {
    const ctx: UnitContext = FIXTURES.betweenTwo!;
    expect(ctx.neighbours.filter((n) => n.kind === "unit")).toHaveLength(2);
    expect(ctx.walls[0]!.side).toBe("back");
  });
});
