// Стражи архитектуры ядра (SPEC A07), фаза 2. Ловят то, что память не удержит:
//   · GOLDEN-RULE: в коде ядра нет чисел-настроек (рекурсивно по всем папкам);
//   · направление импорта: слой N берёт только слои ≤ N; файлы Полигона — только слой 2 (настройки)
//     и слой 9 (мост); React и three в ядро не попадают;
//   · пять файлов в каждой папке функции (A03);
//   · каждый объявленный ключ настройки существует в своём файле things/ и имеет диапазон (A04).

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const KERNEL = join(__dirname, "..");
const THINGS = join(KERNEL, "..", "poligon", "things");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p: string) => relative(KERNEL, p);
const isTest = (p: string) => p.endsWith(".test.ts") || p.endsWith(".fixtures.ts") || rel(p) === "testkit.ts";
const SOURCES = walk(KERNEL).filter((p) => p.endsWith(".ts") && !isTest(p));
/** код ядра: слои и фасад, без красной команды и стражей */
const CODE = SOURCES.filter((p) => !/^(redteam|guards)\//.test(rel(p)));

/** Комментарии и строки вырезаются: число в тексте сообщения — не настройка. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

/** Разрешённые числа — с причиной вслух. */
const ALLOWED: Record<string, string> = {
  0: "ноль — отсутствие, начало координат, первый индекс",
  1: "единица — шаг счёта, направление ±1, соседний индекс",
  2: "двойка — арность, а не размер: промежуток делится НАДВОЕ, сливаются ДВА промежутка",
};

const layerOf = (p: string): number | null => {
  const m = /^(\d)-/.exec(rel(p));
  return m ? Number(m[1]) : null;
};

describe("стражи архитектуры [spec:A07]", () => {
  it("[spec:P05] [law:GOLDEN-RULE] в коде ядра нет чисел, кроме 0 и 1 (масштаб mm10 — только в 0-base/units)", () => {
    const found: string[] = [];
    for (const p of CODE) {
      if (rel(p).startsWith("0-base/units/")) continue;
      code(readFileSync(p, "utf8")).split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?)(?![\w.])/g)) {
          if (!(m[1]! in ALLOWED)) found.push(`${rel(p)}:${i + 1} «${m[1]}» ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it("[spec:A02] слой берёт только слои с меньшим или тем же номером", () => {
    const bad: string[] = [];
    for (const p of CODE) {
      const from = layerOf(p);
      for (const m of readFileSync(p, "utf8").matchAll(/from\s+"([^"]+)"/g)) {
        const spec = m[1]!;
        if (spec === "react" || spec === "three" || spec.startsWith("three/")) bad.push(`${rel(p)} → ${spec} (UI в ядре)`);
        if (!spec.startsWith(".")) continue;
        const target = resolve(dirname(p), spec);
        if (!target.startsWith(KERNEL)) {
          const poligon = relative(join(KERNEL, "..", "poligon"), target);
          const settingsFile = poligon.startsWith("things/") && target.endsWith(".json");
          if (!(settingsFile && from === 2) && from !== 9) bad.push(`${rel(p)} → ${spec} (Полигон только из слоя 2 — файлы настроек — и слоя 9)`);
          continue;
        }
        const to = layerOf(target);
        if (from !== null && to !== null && to > from) bad.push(`${rel(p)} (слой ${from}) → ${spec} (слой ${to})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("[spec:A03] каждая папка функции — README.md + X.ts + X.settings.ts + X.findings.ts + X.test.ts", () => {
    const bad: string[] = [];
    const layers = readdirSync(KERNEL).filter((d) => /^\d-/.test(d));
    for (const layer of layers) {
      if (!existsSync(join(KERNEL, layer, "README.md"))) bad.push(`${layer}: нет README.md`);
      for (const fn of readdirSync(join(KERNEL, layer)).filter((d) => statSync(join(KERNEL, layer, d)).isDirectory())) {
        const files = readdirSync(join(KERNEL, layer, fn));
        if (!files.some((f) => f.endsWith(".ts"))) continue;
        const main = files.filter((f) => /^[\w-]+\.ts$/.test(f) && !f.includes("."));
        const bases = files.filter((f) => /^[\w-]+\.ts$/.test(f)).map((f) => f.slice(0, -3));
        const need = (b: string) => ["README.md", `${b}.ts`, `${b}.settings.ts`, `${b}.findings.ts`, `${b}.test.ts`];
        const ok = bases.some((b) => need(b).every((f) => files.includes(f)));
        if (!ok) bad.push(`${layer}/${fn}: нет полного набора (${main.join(", ") || "нет основного файла"})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("[spec:A04] [spec:S05] каждый объявленный ключ настройки есть в своём файле things/ и имеет диапазон", async () => {
    const modules = import.meta.glob("../**/*.settings.ts", { eager: true }) as Record<string, { SETTINGS: { key: string; file: string }[] }>;
    const bad: string[] = [];
    let seen = 0;
    for (const [path, mod] of Object.entries(modules)) {
      for (const s of mod.SETTINGS) {
        seen++;
        const def = join(THINGS, s.file, "def.json");
        if (!existsSync(def)) { bad.push(`${path}: нет файла ${s.file}`); continue; }
        const field = JSON.parse(readFileSync(def, "utf8")).fields?.[s.key];
        if (!field) bad.push(`${path}: в ${s.file} нет поля ${s.key}`);
        else if (field.type === "number" && !field.domain) bad.push(`${path}: у ${s.file}.${s.key} нет диапазона`);
        else if (field.type === "algorithm" && !field.of) bad.push(`${path}: у ${s.file}.${s.key} нет списка вариантов`);
      }
    }
    expect(bad).toEqual([]);
    expect(seen).toBeGreaterThan(0);
  });
});
