// Только для прототипа стенда (UI Exploration, Round 1). Не часть основного набора.
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/bench/**/*.test.ts"] } });
