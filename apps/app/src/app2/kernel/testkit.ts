// Помощники для тестов ядра: коробка в мм, быстрый сценарий. Не для кода ядра.
import { run, start, type Command, type Session } from "./index";
import { toMm } from "./0-base/units/units";
import type { Box } from "./1-graph/evaluate/evaluate";

/** Размер коробки в мм: [x, y, z]. */
export const dims = (b: Box | undefined): number[] =>
  b ? (["x", "y", "z"] as const).map((a) => toMm(b.max[a] - b.min[a])) : [];

/** Положение коробки в мм: [x0, y0, z0]. */
export const origin = (b: Box | undefined): number[] =>
  b ? (["x", "y", "z"] as const).map((a) => toMm(b.min[a])) : [];

/** Выполняет команды подряд; падает, если какая-то отказана. */
export function build(...cmds: Command[]): Session {
  let s = start();
  for (const c of cmds) {
    const r = run(s, c);
    if (!r.result.accepted) throw new Error(`${c.word}: ${r.result.findings.map((f) => f.text).join("; ")}`);
    s = r.session;
  }
  return s;
}

export const CUBE_600: Command = { word: "CUBE", w: 600, h: 720, d: 560 };
