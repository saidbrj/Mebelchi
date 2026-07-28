import { defineConfig } from "vitest/config";

// The ENGINE's suite. The app's own model tests live in apps/app (apps/app/vitest.config.ts) —
// they must not run under this config: the root tsconfig is deliberately stricter than the app's
// (noUncheckedIndexedAccess, for the engine's integer geometry), so pulling app source in here
// would typecheck it against rules it was never written to.
//
// npm test runs the correctness suite only; benchmarks live behind npm run bench
// (vitest.bench.config.ts) so measurement noise never gates correctness.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
