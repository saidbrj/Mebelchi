// Offcuts: the workshop's leftover boards, and which parts may be cut from them.
//
// The bug this pins down: the packer handed every offcut to the LARGEST board group, whatever
// material that group was. A leftover МДФ facade board would be used to cut ЛДСП carcass
// sides — a cut plan that looks perfectly reasonable and cannot be built. It failed the other
// way too: an offcut of a board that wasn't the biggest group was silently never used, so the
// shop bought sheets it already had on the rack.

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

import { nest, type NestPanel, type RemainSheet } from "../src/model/nest";
import { listOffcuts, addOffcut, removeOffcut, clearOffcuts } from "../src/model/offcuts";

const LDSP = "ЛДСП 16мм, белый · 16";
const MDF = "МДФ фасад 18мм · 18";

/** n panels of one board, each w×h */
const panels = (group: string, material: string, thickness: number, n: number, w: number, h: number): NestPanel[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${group}-${i}`, w, h, part: "side", partRu: "Бок", module: "1. Напольный 600",
    group, material, thickness, grain: false,
  }));

const OPTS = { sheetW: 2750, sheetH: 1830, kerf: 4, respectGrain: false };

/** the boards a nest actually used, as `group → [WxH...]` */
const boardsUsed = (sheets: { group: string; W: number; H: number; isRemain: boolean }[]) =>
  sheets.filter((s) => s.isRemain).map((s) => `${s.group}@${s.W}x${s.H}`);

beforeEach(() => {
  localStorage.clear();
});

describe("an offcut is only used for the board it IS", () => {
  // a job where МДФ is the LARGEST group — so the old code would have given it every offcut
  const job = (): NestPanel[] => [
    ...panels(MDF, "МДФ фасад 18мм", 18, 12, 700, 600),
    ...panels(LDSP, "ЛДСП 16мм, белый", 16, 3, 700, 500),
  ];

  it("does not cut МДФ parts from a ЛДСП offcut", () => {
    const remains: RemainSheet[] = [{ w: 1200, h: 900, group: LDSP }];
    const r = nest(job(), { ...OPTS, remains });
    for (const s of r.sheets) {
      if (s.isRemain) expect(s.group).toBe(LDSP); // never the МДФ group
    }
  });

  it("uses an offcut of a group that is NOT the largest — the shop already owns that board", () => {
    const remains: RemainSheet[] = [{ w: 1200, h: 900, group: LDSP }];
    const r = nest(job(), { ...OPTS, remains });
    // LDSP is the smaller group; before, `gi === 0` meant its offcut was never reachable
    expect(boardsUsed(r.sheets)).toContain(`${LDSP}@1200x900`);
  });

  it("routes each offcut to its own board when both are on the rack", () => {
    const remains: RemainSheet[] = [
      { w: 1200, h: 900, group: LDSP },
      { w: 1400, h: 1000, group: MDF },
    ];
    const used = boardsUsed(nest(job(), { ...OPTS, remains }).sheets);
    expect(used).toContain(`${LDSP}@1200x900`);
    expect(used).toContain(`${MDF}@1400x1000`);
  });

  it("ignores an offcut of a board this job does not cut", () => {
    const remains: RemainSheet[] = [{ w: 1200, h: 900, group: "ХДФ 3мм · 3" }];
    const r = nest(job(), { ...OPTS, remains });
    expect(r.sheets.filter((s) => s.isRemain)).toHaveLength(0);
    expect(r.ok).toBe(true); // and the job still nests, on new sheets
  });

  it("saves board: nesting onto an offcut buys fewer full sheets", () => {
    const without = nest(job(), { ...OPTS, remains: [] });
    const withIt = nest(job(), { ...OPTS, remains: [{ w: 1400, h: 1000, group: MDF }] });
    expect(withIt.stats.standardCount).toBeLessThan(without.stats.standardCount);
  });
});

describe("an untyped offcut keeps the old behaviour", () => {
  it("falls back to the largest group rather than being dropped", () => {
    // a record saved before offcuts carried a board — it must still be usable, and the
    // largest group is exactly where it used to go
    const job = [
      ...panels(MDF, "МДФ фасад 18мм", 18, 12, 700, 600),
      ...panels(LDSP, "ЛДСП 16мм, белый", 16, 3, 700, 500),
    ];
    const r = nest(job, { ...OPTS, remains: [{ w: 1400, h: 1000 }] });
    expect(boardsUsed(r.sheets)).toEqual([`${MDF}@1400x1000`]);
  });
});

describe("the offcut rack persists", () => {
  it("survives a reload", () => {
    addOffcut(800, 600, LDSP);
    addOffcut(1200, 400, MDF);
    expect(listOffcuts()).toHaveLength(2);
    expect(listOffcuts()[0]).toMatchObject({ w: 800, h: 600, group: LDSP });
  });

  it("removes one without disturbing the rest", () => {
    const a = addOffcut(800, 600, LDSP);
    addOffcut(1200, 400, MDF);
    removeOffcut(a.id);
    const left = listOffcuts();
    expect(left).toHaveLength(1);
    expect(left[0].group).toBe(MDF);
  });

  it("mints unique ids so two identical pieces stay separate", () => {
    const a = addOffcut(800, 600, LDSP);
    const b = addOffcut(800, 600, LDSP);
    expect(a.id).not.toBe(b.id);
    expect(listOffcuts()).toHaveLength(2);
  });

  it("accepts an offcut with no board (the picker is optional)", () => {
    addOffcut(800, 600);
    expect(listOffcuts()[0].group).toBeUndefined();
  });

  it("clears", () => {
    addOffcut(800, 600, LDSP);
    clearOffcuts();
    expect(listOffcuts()).toHaveLength(0);
  });
});

describe("corrupt or nonsense storage never breaks the cut plan", () => {
  it("survives unparseable JSON", () => {
    localStorage.setItem("mebelchi.offcuts.v1", "{not json");
    expect(listOffcuts()).toEqual([]);
  });

  it("drops records with no usable size", () => {
    // a 0×0 offcut would be handed to the packer, hold nothing and be skipped every run
    localStorage.setItem("mebelchi.offcuts.v1", JSON.stringify([
      { id: "a", w: 0, h: 600 },
      { id: "b", w: 800, h: 600 },
      { id: "c", w: 800 },
      "nope",
    ]));
    const l = listOffcuts();
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe("b");
  });

  it("ignores a stored value that isn't a list", () => {
    localStorage.setItem("mebelchi.offcuts.v1", JSON.stringify({ w: 800 }));
    expect(listOffcuts()).toEqual([]);
  });
});
