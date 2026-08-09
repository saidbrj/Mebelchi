// «Стандарт цеха» — the shop's construction standard and how a cabinet inherits from it.
//
// The point of the module is that a cabinet stores only what it does DIFFERENTLY, so the tests
// that matter are: an untouched cabinet follows the shop; changing the shop moves it; an
// overridden cabinet does not move; and clearing an override puts it back under the shop's
// authority rather than freezing today's value onto it.
import { describe, it, expect, beforeEach } from "vitest";
import {
  SHOP_CONSTRUCTION_DEFAULTS,
  setShopConstruction,
  shopConstruction,
  constructionOf,
  hasBackOf,
  backSetbackOf,
  overridesOf,
  resetToShop,
  backMountPatch,
} from "../src/model/construction";
import { mk, type Cabinet } from "../src/model/cabinet";

const cab = (patch: Partial<Cabinet> = {}): Cabinet => mk({ kind: "base", w: 600, ...patch });

beforeEach(() => setShopConstruction(SHOP_CONSTRUCTION_DEFAULTS));

describe("the built-in standard", () => {
  it("is the market build every project silently used before this module existed", () => {
    // these are the old hardcoded `?? x` fallbacks — if one changes, existing kitchens change shape
    expect(SHOP_CONSTRUCTION_DEFAULTS).toEqual({
      boardThickness: 16,
      facadeThickness: 18,
      backMount: "groove",
      grooveSetback: 12,
      bottomMode: "nakladnoe",
      topMode: "full",
      plinthMode: "box",
      gola: false,
    });
  });

  it("fills gaps when the shop is set from a partial (an old save with new fields missing)", () => {
    setShopConstruction({ boardThickness: 18 });
    expect(shopConstruction().boardThickness).toBe(18);
    expect(shopConstruction().backMount).toBe("groove");
  });
});

describe("a cabinet with no overrides", () => {
  it("follows the shop standard", () => {
    expect(constructionOf(cab()).boardThickness).toBe(16);
    expect(overridesOf(cab())).toEqual([]);
  });

  it("MOVES when the shop changes its mind — the whole point of inheriting", () => {
    const c = cab();
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, boardThickness: 18, plinthMode: "legs" });
    expect(constructionOf(c).boardThickness).toBe(18);
    expect(constructionOf(c).plinthMode).toBe("legs");
    expect(overridesOf(c)).toEqual([]); // still not an override — it never asked for anything
  });
});

describe("a cabinet with overrides", () => {
  it("keeps its own value and reports it as changed", () => {
    const c = cab({ boardThickness: 18 });
    expect(constructionOf(c).boardThickness).toBe(18);
    expect(overridesOf(c)).toEqual(["boardThickness"]);
  });

  it("does NOT move when the shop changes to something else", () => {
    const c = cab({ boardThickness: 18 });
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, boardThickness: 16 });
    expect(constructionOf(c).boardThickness).toBe(18);
  });

  it("stops being an override once the shop adopts the same value", () => {
    const c = cab({ boardThickness: 18 });
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, boardThickness: 18 });
    expect(overridesOf(c)).toEqual([]); // it no longer DIFFERS, so the editor says "стандарт цеха"
  });

  it("counts each differing property separately", () => {
    expect(overridesOf(cab({ boardThickness: 18, topMode: "stretchers" })).sort()).toEqual([
      "boardThickness",
      "topMode",
    ]);
  });
});

describe("resetToShop", () => {
  it("clears overrides rather than copying today's standard onto the cabinet", () => {
    const c = { ...cab({ boardThickness: 18, plinthMode: "legs" }), ...resetToShop() };
    expect(overridesOf(c)).toEqual([]);
    // and it must now FOLLOW a later change, which a copied value would not
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, boardThickness: 18 });
    expect(constructionOf(c).boardThickness).toBe(18);
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, boardThickness: 16 });
    expect(constructionOf(c).boardThickness).toBe(16);
  });
});

describe("the back panel", () => {
  it("reads legacy hasBack:false as backMount none", () => {
    // saved projects predate backMount's "none" case and carry only the boolean
    const c = cab({ hasBack: false });
    expect(constructionOf(c).backMount).toBe("none");
    expect(hasBackOf(c)).toBe(false);
  });

  it("lets an explicit backMount win over the legacy boolean", () => {
    expect(constructionOf(cab({ hasBack: false, backMount: "overlay" })).backMount).toBe("overlay");
  });

  it("writes both fields together so they can never disagree", () => {
    expect(backMountPatch("overlay")).toEqual({ backMount: "overlay", hasBack: true });
    expect(backMountPatch("none")).toEqual({ backMount: "none", hasBack: false });
  });

  it("clears the override when the pick IS the shop's own method", () => {
    expect(backMountPatch("groove")).toEqual({ backMount: undefined, hasBack: undefined });
    const c = { ...cab({ backMount: "overlay", hasBack: true }), ...backMountPatch("groove") };
    expect(overridesOf(c)).toEqual([]);
  });
});

describe("backSetbackOf — the bug this module was built to kill", () => {
  // The «чистый габарит» readout computed the groove at 10мм while three/kitchen3d.ts drew it at
  // 12мм, so the internal depth shown to the seller was 2мм short of what the shop actually built.
  // One resolver means one number.
  it("is the groove offset plus the 4мм groove itself", () => {
    expect(backSetbackOf(cab())).toBe(16); // 12 + 4
  });

  it("follows the shop's groove offset", () => {
    setShopConstruction({ ...SHOP_CONSTRUCTION_DEFAULTS, grooveSetback: 10 });
    expect(backSetbackOf(cab())).toBe(14);
  });

  it("is zero when the back is overlaid or absent — nothing is set back", () => {
    expect(backSetbackOf(cab({ backMount: "overlay" }))).toBe(0);
    expect(backSetbackOf(cab({ backMount: "none" }))).toBe(0);
  });
});
