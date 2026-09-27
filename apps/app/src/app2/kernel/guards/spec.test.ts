// Страж SPEC (фаза 0). Держит связь между спецификацией, красной командой и тестами:
//   · id в SPEC объявлены один раз;
//   · каждый сценарий ссылается только на существующие id;
//   · каждая ссылка `RT xx` в SPEC ведёт на существующий сценарий;
//   · у сценария заполнены все поля, id уникальны, фаза в пределах 2–11;
//   · сценарий из DONE действительно имеет тест с тегом [rt:ID].
// Правила объявления id: SPEC/README.md.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { SCENARIOS, FAMILIES, DONE } from "../redteam/scenarios";
import { PATTERN_SCENARIOS, PATTERN_FAMILIES, PATTERN_DONE } from "../redteam/pattern";

/** обе колоды красной команды проверяются одинаково */
const DECKS = [
  { name: "заказы", scenarios: SCENARIOS, families: FAMILIES, done: DONE },
  { name: "паттерн", scenarios: PATTERN_SCENARIOS, families: PATTERN_FAMILIES, done: PATTERN_DONE },
];
const ALL = DECKS.flatMap((d) => d.scenarios);
const ALL_DONE = DECKS.flatMap((d) => [...d.done]);

const KERNEL = join(__dirname, "..");
const SPEC_DIR = join(KERNEL, "SPEC");
const specFiles = readdirSync(SPEC_DIR).filter((f) => f.endsWith(".md"));
const specText: Record<string, string> = Object.fromEntries(
  specFiles.map((f) => [f, readFileSync(join(SPEC_DIR, f), "utf8")]),
);

const ID = "[A-Z][A-Za-z0-9]*(?:-[A-Z0-9]+)*";
const HEADING = new RegExp(`^#{2,4} (${ID}) — `, "gm");
const ROW = new RegExp(`^\\| \\*\\*(${ID})\\*\\* \\|`, "gm");

function declaredIds(): Map<string, string[]> {
  const where = new Map<string, string[]>();
  for (const [file, text] of Object.entries(specText)) {
    for (const re of [HEADING, ROW]) {
      for (const m of text.matchAll(re)) {
        const id = m[1]!;
        where.set(id, [...(where.get(id) ?? []), file]);
      }
    }
  }
  return where;
}

const DECLARED = declaredIds();

function testFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return testFiles(p);
    return f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("SPEC · id [spec:A07]", () => {
  it("каждый id объявлен ровно один раз", () => {
    const dupes = [...DECLARED].filter(([, files]) => files.length > 1).map(([id, f]) => `${id} (${f.join(", ")})`);
    expect(dupes).toEqual([]);
  });

  it("основные группы на месте: 12 принципов, 15 слов, законы L1–L5", () => {
    const has = (prefix: RegExp) => [...DECLARED.keys()].filter((id) => prefix.test(id)).length;
    expect(has(/^P\d\d$/)).toBe(12);
    expect(has(/^W\d\d$/)).toBe(15);
    for (const l of ["L1a", "L1b", "L1c", "L1d", "L2", "L3", "L4", "L5"]) expect(DECLARED.has(l), l).toBe(true);
  });
});

describe("красная команда ↔ SPEC [spec:T06]", () => {
  it("у сценариев уникальные id вида <семейство><номер> и все поля заполнены", () => {
    const ids = ALL.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DECKS) {
      for (const s of d.scenarios) {
        expect(Object.keys(d.families), s.id).toContain(s.id[0]);
      }
    }
    for (const s of ALL) {
      expect(s.id).toMatch(/^[A-Z]\d+$/);
      for (const f of [s.title, s.given, s.action, s.expect, s.mustNotChange]) expect(f.length, s.id).toBeGreaterThan(0);
      expect(s.spec.length, s.id).toBeGreaterThan(0);
      expect(s.phase, s.id).toBeGreaterThanOrEqual(2);
      expect(s.phase, s.id).toBeLessThanOrEqual(11);
    }
  });

  it("сценарии ссылаются только на объявленные id SPEC", () => {
    const missing = ALL.flatMap((s) => s.spec.filter((id) => !DECLARED.has(id)).map((id) => `${s.id} → ${id}`));
    expect(missing).toEqual([]);
  });

  it("каждая ссылка `RT xx` в SPEC ведёт на существующий сценарий", () => {
    const known = new Set(ALL.map((s) => s.id));
    const dangling = Object.entries(specText).flatMap(([file, text]) =>
      [...text.matchAll(/RT ([A-J]\d+)/g)].map((m) => m[1]!).filter((id) => !known.has(id)).map((id) => `${file}: RT ${id}`),
    );
    expect(dangling).toEqual([]);
  });

  it("сценарий, отмеченный DONE, имеет настоящий тест с тегом [rt:ID]", () => {
    const sources = testFiles(KERNEL)
      .filter((p) => !p.includes(`${sep}redteam${sep}`))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    const missing = ALL_DONE.filter((id) => !sources.includes(`[rt:${id}]`));
    expect(missing).toEqual([]);
  });
});
