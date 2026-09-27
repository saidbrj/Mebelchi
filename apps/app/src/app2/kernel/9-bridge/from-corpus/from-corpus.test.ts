import { describe, it, expect } from "vitest";
import { cutList, run, setProfile, start, type Command, type Session } from "../../index";
import { compareRole, doorLeaves, outerWidthMm, poligonParts, shelfCount, unsupported } from "./from-corpus";
import { kitchen1Fill } from "../../../poligon/demo/kitchen1";
import { kitchen4Fill } from "../../../poligon/demo/kitchen4";
import { SHOP_PROFILE } from "../../../poligon/model/settings";
import type { CabinetFill, FillContext } from "../../../poligon/model/fill";

const CTX: FillContext = { profile: SHOP_PROFILE, slideClearancePerSideMm: 12.5, slideLengthsMm: [250, 300, 350, 400, 450, 500, 550] };

/** Тот же шкаф словами ядра: куб по наружным размерам и паттерн полок. */
function plan(c: CabinetFill): Command[] {
  // в ряду стойка общая с обоими соседями — это контекст App 1, от него зависит ширина фасада
  const cmds: Command[] = [{
    word: "CUBE", w: outerWidthMm(c), h: c.heightMm, d: c.depthMm,
    neighbours: { left: "unit", right: "unit" },
  }];
  const leaves = doorLeaves(c);
  if (leaves) {
    cmds.push({
      word: "PATTERN", op: "create", space: "U1", axis: "x",
      gaps: Array.from({ length: leaves }, () => ({ ratio: 1 })), member: null,
      fill: { type: "front", face: "front" },
    });
  }
  const shelves = shelfCount(c);
  if (shelves) {
    cmds.push({
      word: "PATTERN", op: "create", space: "S1", axis: "y",
      gaps: Array.from({ length: shelves + 1 }, () => ({ ratio: 1 })), member: "shelf",
    });
  }
  return cmds;
}

function inKernel(c: CabinetFill): Session {
  let s = start();
  for (const cmd of plan(c)) {
    const r = run(s, cmd);
    if (!r.result.accepted) throw new Error(`${c.id}: ${r.result.findings.map((f) => f.text).join("; ")}`);
    s = r.session;
  }
  return s;
}

const corpus = [...kitchen1Fill(SHOP_PROFILE), ...kitchen4Fill(SHOP_PROFILE)];
const withShelves = corpus.filter((c) => shelfCount(c) > 0);
/** Шкафы, у которых распашной фасад — единственное наполнение: их ядро выражает целиком. */
const withDoors = corpus.filter((c) => doorLeaves(c) > 0 && unsupported(c).length === 0 && shelfCount(c) === 0);

describe("корпус через ядро [spec:T07]", () => {
  it("в корпусе есть шкафы с полками, и они разные", () => {
    expect(withShelves.length).toBeGreaterThanOrEqual(3);
    expect(new Set(withShelves.map((c) => `${c.widthMm}×${c.depthMm}`)).size).toBeGreaterThan(1);
  });

  it.each(withShelves.map((c) => [c.id, c] as const))(
    "[spec:P04] [spec:T07] %s: полки ядра совпадают с деталями Полигона",
    (_id, c) => {
      const ours = cutList(inKernel(c));
      const theirs = poligonParts(c, CTX);
      expect(compareRole("shelf", ours, theirs)).toEqual([]);
      expect(ours.filter((p) => p.role === "shelf")).toHaveLength(shelfCount(c));
    },
  );

  it("[spec:T07] готовность корпуса: сколько шкафов ядро выражает целиком", () => {
    const all = [...kitchen1Fill(SHOP_PROFILE), ...kitchen4Fill(SHOP_PROFILE)];
    const missing = new Map<string, number>();
    for (const c of all) for (const k of unsupported(c)) missing.set(k, (missing.get(k) ?? 0) + 1);

    expect(all).toHaveLength(22);
    expect(all.filter((c) => shelfCount(c) > 0)).toHaveLength(6);       // все шесть сверены выше
    expect(all.filter((c) => doorLeaves(c) > 0)).toHaveLength(10);      // распашные фасады ядро уже умеет
    expect(all.filter((c) => unsupported(c).length === 0)).toHaveLength(11);
    // чего ядру не хватает до полной кухни — названо числом, а не «когда-нибудь»
    expect(Object.fromEntries([...missing].sort())).toEqual({
      "appliance-door": 4, drawers: 6, "false-front": 3,
    });
  });

  it.each(withDoors.map((c) => [c.id, c] as const))(
    "[spec:Q20] [spec:T07] %s: фасады ядра совпадают с деталями Полигона",
    (_id, c) => {
      const ours = cutList(inKernel(c));
      const theirs = poligonParts(c, CTX);
      expect(compareRole("front", ours, theirs)).toEqual([]);
      expect(ours.filter((p) => p.role === "front")).toHaveLength(doorLeaves(c));
    },
  );

  it("[spec:T07] полка backless-шкафа теряет зазор задника у ОБОИХ слоёв", () => {
    const backless = withShelves.find((c) => !c.back)!;
    const shelf = poligonParts(backless, CTX).find((p) => p.role === "shelf")!;
    // 350 − 20 отступ − 2 зазор до задника = 328, хотя задника у шкафа нет
    expect(shelf.widthMm).toBe(backless.depthMm - 22);
    expect(compareRole("shelf", cutList(inKernel(backless)), poligonParts(backless, CTX))).toEqual([]);
  });

  it("[spec:O03] на профиле 18 мм совпадение держится у обоих слоёв", () => {
    const c = withShelves.find((x) => x.sideMm.left === 16)!;
    const thick: CabinetFill = { ...c, sideMm: { left: 18, right: 18 } };

    // ядро: тот же шкаф, но профиль цеха 18
    const started = setProfile(start(), "carcassThicknessMm", 18);
    expect(started.result.accepted).toBe(true);
    let s = started.session;
    for (const cmd of plan(thick)) {
      const r = run(s, cmd);
      expect(r.result.accepted, JSON.stringify(cmd)).toBe(true);
      s = r.session;
    }
    const theirs = poligonParts(thick, { ...CTX, profile: { ...SHOP_PROFILE, boardMm: 18 } });
    expect(compareRole("shelf", cutList(s), theirs)).toEqual([]);
    expect(theirs.find((p) => p.role === "shelf")!.lengthMm).toBe(thick.widthMm - 18);
  });
});
