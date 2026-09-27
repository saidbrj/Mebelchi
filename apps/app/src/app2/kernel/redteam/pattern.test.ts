import { describe, it } from "vitest";
import { PATTERN_SCENARIOS, PATTERN_FAMILIES, PATTERN_DONE } from "./pattern";

for (const [family, name] of Object.entries(PATTERN_FAMILIES)) {
  describe(`красная команда паттерна · ${family} · ${name}`, () => {
    for (const s of PATTERN_SCENARIOS.filter((x) => x.id.startsWith(family))) {
      if (PATTERN_DONE.has(s.id)) continue;
      it.todo(`[rt:${s.id}] фаза ${s.phase} · ${s.title} → ${s.expect}`);
    }
  });
}
