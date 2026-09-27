// Красная команда: каждый сценарий из scenarios.ts — отдельный тест.
// Пока слой его фазы не построен, это it.todo: видно в отчёте, не краснеет, не забывается.
// Когда фаза построена, сценарий переезжает в тест её папки с тегом [rt:ID], а отсюда убирается
// в DONE — страж ниже требует, чтобы такой тег существовал.

import { describe, it } from "vitest";
import { SCENARIOS, FAMILIES, DONE } from "./scenarios";

for (const [family, name] of Object.entries(FAMILIES)) {
  describe(`красная команда · ${family} · ${name}`, () => {
    for (const s of SCENARIOS.filter((x) => x.id.startsWith(family))) {
      if (DONE.has(s.id)) continue;
      it.todo(`[rt:${s.id}] фаза ${s.phase} · ${s.title} → ${s.expect}`);
    }
  });
}
