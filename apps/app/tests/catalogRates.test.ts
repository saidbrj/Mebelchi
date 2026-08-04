// Catalog prices driving the quote. The failure this guards against is the one a demo sails
// past: a seller corrects a price in Каталог, the смета does not move, and nobody notices
// until a customer is quoted from a rate the shop stopped paying two years ago.

import { describe, it, expect, beforeEach } from "vitest";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
(globalThis as unknown as { localStorage: Storage }).localStorage = new MemStorage() as unknown as Storage;

import {
  sheetAreaM2, unitPrice, materialPerM2, materialPerM,
  dominantMaterial, catalogRatesFor, ratesForDesign,
} from "../src/model/catalogRates";
import { upsertMaterial, listMaterials, removeMaterial } from "../src/model/catalog";
import { EMAN_MATERIALS, hexToInt, type EmanMaterial } from "../src/model/materials";
import { DEFAULT_RATE_OVERRIDES } from "../src/model/settings";
import { ratesToTable } from "../src/model/rates";
import { priceCabs } from "../src/model/toProject";
import { mk, type Cabinet } from "../src/model/cabinet";
import type { KitchenStyle } from "../src/model/layout";

const seedOf = (id: string) => EMAN_MATERIALS.find((m) => m.id === id)!;

/** a kitchen whose cabinets carry no per-module finish → the style colours decide */
const styleOf = (over: Partial<KitchenStyle> = {}): KitchenStyle => ({
  carcass: hexToInt(seedOf("ldsp-egger-white").color),
  facade: hexToInt(seedOf("torhamn").color),
  worktop: hexToInt(seedOf("ekbacken").color),
  handle: hexToInt(seedOf("bagannas-bk").color),
  glassUppers: false,
  ...over,
});

const base = (n = 3): Cabinet[] => Array.from({ length: n }, () => mk({ kind: "base", w: 600, h: 720 }));

beforeEach(() => {
  localStorage.clear();
});

describe("deriving a rate from a sheet price", () => {
  it("turns a sheet price into $/m²", () => {
    const egger = seedOf("ldsp-egger-white"); // $45, 2750×1830 = 5.0325 m²
    expect(sheetAreaM2(egger)).toBeCloseTo(5.0325, 4);
    expect(materialPerM2(egger)).toBeCloseTo(45 / 5.0325, 4);
  });

  it("divides a pack price by the pack size", () => {
    const handle = seedOf("bagannas-bk"); // $4.40 buys 2
    expect(unitPrice(handle)).toBeCloseTo(2.2, 6);
  });

  it("bills a worktop by the running metre, not by area", () => {
    const oak = seedOf("ekbacken"); // $290, 3000mm long
    expect(materialPerM(oak)).toBeCloseTo(290 / 3, 4);
  });

  it("declines to guess when the record isn't a sheet good", () => {
    const handle = seedOf("bagannas-bk"); // no sheetW/sheetH
    expect(sheetAreaM2(handle)).toBeUndefined();
    expect(materialPerM2(handle)).toBeUndefined();
  });

  it("declines on a zero or missing price rather than pricing the kitchen at 0", () => {
    const free: EmanMaterial = { ...seedOf("ldsp-grey"), price: 0 };
    expect(materialPerM2(free)).toBeUndefined();
    expect(materialPerM(free)).toBeUndefined();
  });
});

describe("finding the decor a design is made of", () => {
  it("resolves the dominant colour back to its catalog material", () => {
    expect(dominantMaterial(base(), "carcass", styleOf().carcass)?.id).toBe("ldsp-egger-white");
    expect(dominantMaterial(base(), "facade", styleOf().facade)?.id).toBe("torhamn");
  });

  it("follows a per-module override when most modules carry one", () => {
    const grey = hexToInt(seedOf("ldsp-grey").color);
    const cabs = base(3).map((c) => ({ ...c, finish: { carcass: grey } }));
    expect(dominantMaterial(cabs, "carcass", styleOf().carcass)?.id).toBe("ldsp-grey");
  });

  it("ignores appliances — a fridge panel is not the kitchen's facade", () => {
    const grey = hexToInt(seedOf("ldsp-grey").color);
    const cabs: Cabinet[] = [
      ...base(1),
      mk({ kind: "tall", appliance: "fridge", finish: { carcass: grey } }),
      mk({ kind: "tall", appliance: "oven", finish: { carcass: grey } }),
    ];
    // two of three modules are grey, but both are appliances → the real cabinet decides
    expect(dominantMaterial(cabs, "carcass", styleOf().carcass)?.id).toBe("ldsp-egger-white");
  });

  it("is undefined for a colour no catalog material has", () => {
    expect(dominantMaterial(base(), "carcass", 0x010203)).toBeUndefined();
  });
});

describe("ratesForDesign — specific beats general", () => {
  it("overrides the blanket rates with the picked decor's own", () => {
    const r = ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), styleOf());
    expect(r.sheetPerM2).toBeCloseTo(45 / 5.0325, 4);
    expect(r.facadePerM2).toBeCloseTo(55 / 5.0325, 4);
    expect(r.worktopPerM).toBeCloseTo(290 / 3, 4);
  });

  it("leaves the seller's own rate alone where the catalog can say nothing", () => {
    const r = ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), styleOf());
    // no cabinet has a `finish.back`, so ХДФ cannot be identified — the Настройки rate stands
    expect(r.backPerM2).toBe(DEFAULT_RATE_OVERRIDES.backPerM2);
    expect(r.hingePerUnit).toBe(DEFAULT_RATE_OVERRIDES.hingePerUnit);
    expect(r.assemblyPerModule).toBe(DEFAULT_RATE_OVERRIDES.assemblyPerModule);
  });

  it("falls back entirely on an unrecognised palette", () => {
    const alien = styleOf({ carcass: 0x010203, facade: 0x040506, worktop: 0x070809 });
    expect(ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), alien)).toEqual(DEFAULT_RATE_OVERRIDES);
  });

  it("changes nothing for an empty design", () => {
    expect(ratesForDesign(DEFAULT_RATE_OVERRIDES, [], styleOf())).toEqual(DEFAULT_RATE_OVERRIDES);
  });
});

describe("editing a price in Каталог reaches the quote", () => {
  it("moves the derived rate, proportionally", () => {
    const before = ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), styleOf()).sheetPerM2;

    // the seller discovers Egger went up — doubles it in Каталог
    const egger = listMaterials().find((m) => m.id === "ldsp-egger-white")!;
    upsertMaterial({ ...egger, price: egger.price * 2 });

    const after = ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), styleOf()).sheetPerM2;
    expect(after).toBeCloseTo(before! * 2, 6);
  });

  it("works for a decor the shop added themselves", () => {
    const own: EmanMaterial = {
      id: "mat-own-1", name: "Свой ЛДСП", kind: "ЛДСП", desc: "", thickness: "16mm",
      thicknessMm: 16, sheetW: 2800, sheetH: 2070, price: 120, per: 1,
      color: "#0a0b0c", part: "carcass",
    };
    upsertMaterial(own);
    const r = ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), styleOf({ carcass: hexToInt("#0a0b0c") }));
    expect(r.sheetPerM2).toBeCloseTo(120 / ((2800 * 2070) / 1e6), 4);
  });

  it("stops overriding once the decor is deleted from the catalog", () => {
    const grey = seedOf("ldsp-grey");
    const style = styleOf({ carcass: hexToInt(grey.color) });
    expect(ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), style).sheetPerM2).not.toBe(DEFAULT_RATE_OVERRIDES.sheetPerM2);

    // model/catalog.ts remembers a deleted seed — the lookup must stop finding it
    removeMaterial("ldsp-grey");
    expect(ratesForDesign(DEFAULT_RATE_OVERRIDES, base(), style).sheetPerM2).toBe(DEFAULT_RATE_OVERRIDES.sheetPerM2);
  });
});

// The end-to-end claim, through the real engine: not "a rate changed" but "the смета changed".
describe("the quoted TOTAL follows the catalog", () => {
  const quote = (cabs: Cabinet[], style: KitchenStyle) =>
    priceCabs(cabs, ratesToTable(ratesForDesign(DEFAULT_RATE_OVERRIDES, cabs, style), "std"));

  it("goes up when the shop's carcass board goes up", () => {
    const cabs = base(4);
    const style = styleOf();
    const before = quote(cabs, style);
    expect(before).toBeGreaterThan(0);

    const egger = listMaterials().find((m) => m.id === "ldsp-egger-white")!;
    upsertMaterial({ ...egger, price: egger.price * 3 });

    const after = quote(cabs, style);
    expect(after).toBeGreaterThan(before);
  });

  it("is unchanged by editing a decor this kitchen does not use", () => {
    const cabs = base(4);
    const style = styleOf(); // white Egger carcass, Sonoma oak fronts
    const before = quote(cabs, style);

    const unused = listMaterials().find((m) => m.id === "ldsp-anthracite")!;
    upsertMaterial({ ...unused, price: 9999 });

    // pricing off the whole catalog rather than the picked decor would move this
    expect(quote(cabs, style)).toBeCloseTo(before, 6);
  });
});

describe("catalogRatesFor — what the Смета can show as catalog-sourced", () => {
  it("reports only the fields the catalog actually supplied", () => {
    const c = catalogRatesFor(base(), styleOf({ worktop: 0x010203 }));
    expect(c.sheetPerM2).toBeDefined();
    expect(c.facadePerM2).toBeDefined();
    expect(c.worktopPerM).toBeUndefined(); // unrecognised worktop colour
  });
});
