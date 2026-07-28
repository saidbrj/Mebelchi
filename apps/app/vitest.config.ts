import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The app's PURE MODEL suite — bands, rows, the clash test, the variant generator. Geometry that
// no view can vouch for and that fails silently: a mis-clustered row or a false clash looks fine
// until it reaches a customer's kitchen.
//
// It lives here rather than in the root `tests/` because the root tsconfig is the ENGINE's — it
// runs noUncheckedIndexedAccess for the engine's integer geometry, which the app source is not
// written against. Same reason the aliases are repeated: apps/app resolves @mebelchi/* to package
// SOURCE (see vite.config.ts), not to a built dist.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mebelchi/schema": r("../../packages/schema/src/index.ts"),
      "@mebelchi/pricing": r("../../packages/pricing/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
