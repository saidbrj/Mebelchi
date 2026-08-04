// The editable material catalog. What matters here is the MERGE between the shipped seed list
// and the shop's own edits — the cases that silently lose a shop's work or resurrect a decor
// they deleted, neither of which is visible until someone quotes a kitchen from a wrong list.

import { describe, it, expect, beforeEach } from "vitest";

// vitest runs in node — model/catalog.ts talks to localStorage directly (and swallows any
// failure), so without a stub every write would silently no-op and the assertions would lie.
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
  listMaterials, materialsFor, findMaterial, upsertMaterial, removeMaterial,
  resetCatalog, isSeedMaterial, describeMaterial, catalogByColor, newMaterialId,
} from "../src/model/catalog";
import { EMAN_MATERIALS, hexToInt, matPriceLabel, type EmanMaterial } from "../src/model/materials";
import { formatMoney } from "../src/model/format";
import { DEFAULT_FX_RATES } from "../src/model/settings";

const custom = (over: Partial<EmanMaterial> = {}): EmanMaterial => ({
  id: newMaterialId(),
  name: "Мой ЛДСП",
  kind: "ЛДСП",
  desc: "",
  thickness: "16mm",
  thicknessMm: 16,
  sheetW: 2800,
  sheetH: 2070,
  stockSheets: 3,
  price: 99000,
  per: 1,
  color: "#123456",
  part: "carcass",
  ...over,
});

beforeEach(() => {
  localStorage.clear();
});

describe("a fresh catalog is the shipped one", () => {
  it("returns every seed, in shipped order", () => {
    const list = listMaterials();
    expect(list).toHaveLength(EMAN_MATERIALS.length);
    expect(list.map((m) => m.id)).toEqual(EMAN_MATERIALS.map((m) => m.id));
  });

  it("knows which ids are shipped", () => {
    expect(isSeedMaterial("fac-graphite-enamel")).toBe(true);
    expect(isSeedMaterial("mat-whatever")).toBe(false);
  });
});

describe("editing a seed", () => {
  it("keeps the edit and the seed's position", () => {
    const before = listMaterials();
    const i = before.findIndex((m) => m.id === "fac-graphite-enamel");
    expect(i).toBeGreaterThan(-1);

    const edited = { ...before[i], price: 200000, name: "Графит эмаль PRO" };
    upsertMaterial(edited);

    const after = listMaterials();
    // the grouping A1…A5 / B1…B4 / … is what makes the picker readable — an edit must not
    // shuffle the edited row to the end of the list
    expect(after).toHaveLength(before.length);
    expect(after[i].id).toBe("fac-graphite-enamel");
    expect(after[i].price).toBe(200000);
    expect(after[i].name).toBe("Графит эмаль PRO");
  });

  it("survives a reload (it is in storage, not in memory)", () => {
    upsertMaterial({ ...EMAN_MATERIALS[0], price: 1 });
    expect(findMaterial(EMAN_MATERIALS[0].id)?.price).toBe(1);
  });
});

describe("deleting", () => {
  it("keeps a deleted seed deleted across reads", () => {
    removeMaterial("hdf-oak");
    expect(listMaterials().some((m) => m.id === "hdf-oak")).toBe(false);
    // re-reading rebuilds from the seed list — without the `removed` ledger the decor
    // would quietly come back and get quoted again
    expect(listMaterials().some((m) => m.id === "hdf-oak")).toBe(false);
  });

  it("drops a custom material outright", () => {
    const m = custom();
    upsertMaterial(m);
    expect(findMaterial(m.id)).toBeTruthy();
    removeMaterial(m.id);
    expect(findMaterial(m.id)).toBeUndefined();
  });

  it("brings a seed back when it is saved again", () => {
    removeMaterial("hdf-oak");
    const seed = EMAN_MATERIALS.find((m) => m.id === "hdf-oak")!;
    upsertMaterial({ ...seed, price: 50000 });
    // saving a row and having it stay invisible is the kind of bug that reads as data loss
    expect(findMaterial("hdf-oak")?.price).toBe(50000);
  });
});

describe("adding", () => {
  it("appends custom materials after the seeds", () => {
    const m = custom();
    upsertMaterial(m);
    const list = listMaterials();
    expect(list).toHaveLength(EMAN_MATERIALS.length + 1);
    expect(list[list.length - 1].id).toBe(m.id);
  });

  it("upserts by id rather than duplicating", () => {
    const m = custom();
    upsertMaterial(m);
    upsertMaterial({ ...m, price: 1000 });
    expect(listMaterials().filter((x) => x.id === m.id)).toHaveLength(1);
    expect(findMaterial(m.id)?.price).toBe(1000);
  });

  it("mints unique ids", () => {
    expect(newMaterialId()).not.toBe(newMaterialId());
  });
});

describe("materialsFor — what a picker sees", () => {
  it("filters by role and includes the shop's own", () => {
    const m = custom({ part: "facade", name: "Свой фасад" });
    upsertMaterial(m);
    const fronts = materialsFor("facade");
    expect(fronts.every((x) => x.part === "facade")).toBe(true);
    expect(fronts.some((x) => x.id === m.id)).toBe(true);
    expect(materialsFor("handle").some((x) => x.id === m.id)).toBe(false);
  });
});

describe("catalogByColor — how the 3D recovers a texture", () => {
  it("finds a custom decor, not just a shipped one", () => {
    const m = custom({ part: "facade", color: "#abcdef", tex: "wood_ash" });
    upsertMaterial(m);
    // a decor the shop added has to light and texture like a shipped one — this lookup is
    // the only path from a stored finish colour back to its PBR texture
    expect(catalogByColor(hexToInt("#abcdef"), "facade")?.tex).toBe("wood_ash");
  });

  it("is undefined for an unknown colour, and for no colour at all", () => {
    expect(catalogByColor(hexToInt("#010203"), "facade")).toBeUndefined();
    expect(catalogByColor(undefined, "facade")).toBeUndefined();
  });
});

describe("describeMaterial", () => {
  it("builds the sub-line from the structured fields", () => {
    expect(describeMaterial(custom())).toBe("ЛДСП · 2800×2070 · 16мм");
  });

  it("falls back to the hand-written desc when there is nothing structured", () => {
    const handle: EmanMaterial = { ...custom(), kind: undefined, sheetW: undefined, sheetH: undefined, thicknessMm: undefined, thickness: "", desc: "Ручка, черная" };
    expect(describeMaterial(handle)).toBe("Ручка, черная");
  });
});

describe("reset", () => {
  it("throws away edits, deletions and additions", () => {
    upsertMaterial({ ...EMAN_MATERIALS[0], price: 7 });
    upsertMaterial(custom());
    removeMaterial("hdf-oak");

    resetCatalog();

    const list = listMaterials();
    expect(list.map((m) => m.id)).toEqual(EMAN_MATERIALS.map((m) => m.id));
    expect(findMaterial(EMAN_MATERIALS[0].id)?.price).toBe(EMAN_MATERIALS[0].price);
  });
});

describe("seed prices are USD, the app's base currency", () => {
  // The bug this guards: prices were seeded in сум (175000) while every consumer formats them
  // through useMoney(), which takes USD. That printed "$175,000" for a sheet of ЛДСП, and in
  // сум mode would have multiplied by the fx rate again. Nothing crashes — the number is just
  // wrong by ~12,600×, which is exactly the kind of error a demo sails straight past.
  it("keeps every seed inside a plausible USD range", () => {
    for (const m of EMAN_MATERIALS) {
      expect(m.price, `${m.id} looks like a сум amount, not USD`).toBeGreaterThan(0);
      expect(m.price, `${m.id} looks like a сум amount, not USD`).toBeLessThan(2000);
    }
  });

  it("formats as money a person recognises, in both currencies", () => {
    const egger = EMAN_MATERIALS.find((m) => m.id === "ldsp-egger-white")!;
    expect(formatMoney(egger.price, "USD", DEFAULT_FX_RATES)).toBe("$45");
    // 45 × 12600 — a realistic сум price for one Egger sheet
    expect(formatMoney(egger.price, "UZS", DEFAULT_FX_RATES)).toBe("567 000 сум");
  });

  it("labels a pack price with what the pack contains", () => {
    const handle = EMAN_MATERIALS.find((m) => m.id === "bagannas-bk")!;
    expect(handle.per).toBe(2);
    expect(matPriceLabel(handle, (n) => formatMoney(n, "USD", DEFAULT_FX_RATES))).toBe("$4.4 за 2");
  });
});

describe("corrupt storage never takes the catalog down", () => {
  it("falls back to the seed list on unparseable JSON", () => {
    localStorage.setItem("mebelchi.catalog.v1", "{not json");
    expect(listMaterials()).toHaveLength(EMAN_MATERIALS.length);
  });

  it("ignores a stored record of the wrong shape", () => {
    localStorage.setItem("mebelchi.catalog.v1", JSON.stringify({ items: "nope", removed: 5 }));
    expect(listMaterials()).toHaveLength(EMAN_MATERIALS.length);
  });
});
