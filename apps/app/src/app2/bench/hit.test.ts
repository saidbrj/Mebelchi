import { describe, it, expect } from "vitest";
import { hitTest, padOf, rectPoly } from "./hit";

// Полка 12 px толщиной поперёк проёма, перегородка 12 px под ней — как на экране 10″.
const shelf = { id: "P5", poly: rectPoly(100, 300, 500, 312) };
const divider = { id: "P6", poly: rectPoly(294, 312, 306, 520) };
const above = { id: "S3", poly: rectPoly(100, 60, 500, 300) };
const below = { id: "S4", poly: rectPoly(100, 312, 294, 520) };
const parts = [shelf, divider];
const spaces = [above, below];

describe("хит-тест стенда", () => {
  it("тонкая доска получает зону не меньше 60 px", () => {
    expect(12 + 2 * padOf(shelf.poly)).toBeGreaterThanOrEqual(60);
  });

  it("20 px от полки — полка, 40 px — проём", () => {
    expect(hitTest(200, 332, parts, spaces, null).hit).toEqual({ id: "P5", kind: "part" });
    expect(hitTest(200, 352, parts, spaces, null).hit).toEqual({ id: "S4", kind: "space" });
  });

  it("у пересечения: выбранная деталь выигрывает, если палец в её зоне", () => {
    const h = hitTest(310, 318, parts, spaces, "P5");
    expect(h.hit?.id).toBe("P5");
    expect(h.rule).toBe(2);
    expect(h.candidates.map((c) => c.id)).toEqual(expect.arrayContaining(["P5", "P6"]));
  });

  it("у пересечения без выбора: то, что палец накрыл прямо, а не ближайшая осевая", () => {
    // палец на перегородке в 8 px от полки: перегородка под пальцем — она и выбрана
    const h = hitTest(300, 320, parts, spaces, null);
    expect(h.hit?.id).toBe("P6");
    expect(h.rule).toBe(1);
  });

  it("видимое сильнее выделенного: выбрана перегородка, палец на полке у стыка — полка", () => {
    const h = hitTest(300, 306, parts, spaces, "P6");
    expect(h.hit?.id).toBe("P5");
    expect(h.candidates.find((c) => c.id === "P6")?.why).toBe("selected");
  });

  it("мимо всех досок — ближайший край, а не центр", () => {
    // 10 px правее перегородки и 22 px ниже полки: ближе край перегородки
    const h = hitTest(316, 334, parts, spaces, null);
    expect(h.hit?.id).toBe("P6");
    expect(h.rule).toBe(3);
  });

  it("наклонная полка (ракурс 3/4): попадание по грани, а не по описанному прямоугольнику", () => {
    const slanted = { id: "P9", poly: [[100, 300], [500, 330], [500, 342], [100, 312]] as [number, number][] };
    // над левым концом, но в 30 px выше грани у правого конца: описанный прямоугольник взял бы полку
    expect(hitTest(480, 290, [slanted], [], null).hit).toBeNull();
    expect(hitTest(480, 320, [slanted], [], null).hit?.id).toBe("P9");
  });

  it("вне тумбы — ничего", () => {
    expect(hitTest(700, 700, parts, spaces, "P5").hit).toBeNull();
  });
});
