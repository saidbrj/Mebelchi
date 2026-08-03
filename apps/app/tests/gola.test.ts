import { describe, it, expect } from "vitest";
import { mk } from "../src/model/cabinet";
import { golaSpec, golaEnabled, GOLA_DEFAULTS } from "../src/model/gola";

describe("GOLA derivation", () => {
  it("is null / disabled when the cabinet isn't handleless", () => {
    const c = mk({ kind: "base", w: 600, h: 720, fill: "drawers", count: 2 });
    expect(golaEnabled(c)).toBe(false);
    expect(golaSpec(c)).toBeNull();
  });

  it("puts a profile at the top and at each drawer seam", () => {
    const c = mk({ kind: "base", w: 600, h: 720, fill: "drawers", count: 2, gola: {} });
    const spec = golaSpec(c)!;
    expect(spec).not.toBeNull();
    // two stacked drawers → a seam at ~0.5 and the top C-profile at 1
    expect(spec.profileFractions).toContain(1);
    expect(spec.profileFractions.some((f) => Math.abs(f - 0.5) < 0.01)).toBe(true);
    expect(spec.profileFractions[spec.profileFractions.length - 1]).toBe(1);
  });

  it("a single door gets just the top profile", () => {
    const c = mk({ kind: "base", w: 600, h: 720, fill: "shelves", count: 2, gola: {} });
    const spec = golaSpec(c)!;
    // one full-height door → only the top C-profile, no internal horizontal seam
    expect(spec.profileFractions).toEqual([1]);
  });

  it("falls back to the default profile geometry, and honours overrides", () => {
    expect(golaSpec(mk({ kind: "base", w: 600, h: 720, gola: {} }))!.depthMm).toBe(GOLA_DEFAULTS.depthMm);
    expect(golaSpec(mk({ kind: "base", w: 600, h: 720, gola: { depthMm: 40 } }))!.depthMm).toBe(40);
  });

  it("fractions are sorted bottom→top", () => {
    const c = mk({ kind: "base", w: 900, h: 720, fill: "drawers", count: 3, gola: {} });
    const f = golaSpec(c)!.profileFractions;
    expect([...f].sort((a, b) => a - b)).toEqual(f);
  });
});
