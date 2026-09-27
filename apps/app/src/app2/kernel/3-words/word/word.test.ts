import { describe, it, expect } from "vitest";
import { fullSpan } from "./word";

describe("word", () => {
  it("[spec:W06] пролёт «на всю ширину» — ссылка на грани, не число", () => {
    expect(fullSpan("S1", "x")).toEqual({
      kind: "between", from: { node: "S1", face: "left" }, to: { node: "S1", face: "right" },
    });
  });
});
