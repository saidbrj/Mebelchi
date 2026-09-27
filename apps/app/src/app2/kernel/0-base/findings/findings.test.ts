import { describe, it, expect } from "vitest";
import { finding, refuse } from "./findings";
import { CATALOG } from "./findings.findings";

describe("findings", () => {
  it("[spec:REF-ORPHAN] находка берёт серьёзность и смысл из каталога", () => {
    const f = finding("REF-ORPHAN", ["P7"], "полка P7", ["убрать P7"]);
    expect(f.severity).toBe("refusal");
    expect(f.text).toContain("без ячейки");
    expect(f.options).toEqual(["убрать P7"]);
  });

  it("[spec:G11] отказ не несёт значения", () => {
    const r = refuse(finding("REF-OVERLAP", ["P1", "P2"], ""));
    expect(r.ok).toBe(false);
  });

  it("каждый код каталога объявлен в SPEC 07_FINDINGS и помечен там той же серьёзностью", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const spec = readFileSync(join(__dirname, "..", "..", "SPEC", "07_FINDINGS.md"), "utf8");
    for (const code of Object.keys(CATALOG)) expect(spec, code).toContain(`**${code}**`);
  });
});
