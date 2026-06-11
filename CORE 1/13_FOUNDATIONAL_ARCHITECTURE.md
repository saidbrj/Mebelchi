# 13 — Foundational Architecture (The Constitution)

**Version:** 2.0 — incorporates the pre-build stress test
**Status:** SACRED — highest-level architecture document. Governs how layers are packaged, isolated, and executed at runtime.
**Author:** Oppoq, with lead-architect synthesis
**Date:** June 2026

---

## What changed from v1.0 → v2.0 (and why)

A pre-build adversarial stress test (three external architecture reviews) found one real hole in v1.0 and several refinements. All were judged against the founder's principles: lasting, future-proof, advanced-not-toy, unbreakable, trackable, "slow is smooth," change-only-if-proven.

| Change | v1.0 said | v2.0 says | Why (which principle) |
|---|---|---|---|
| **Runtime topology** | Engine is a pure package (structure only) | Engine has a pure CORE plus a RUNTIME with two solve grades: `solvePreview` (sync, cheap) + `solveFull` (async, heavy) | RN runs logic on the JS thread; a sync solver freezes touch/FPS during drag. Certain, not risk. (unbreakable, advanced-not-toy) |
| **Units** | Round to 0.1mm (float) | Store as fixed-point integers `mm10` (tenths of mm); floats only at render/export edges | Eliminates the float-drift bug class entirely, not partially. Proven standard. (unbreakable) |
| **Correctness proof** | One shelf perfect | Three golden fixtures (base+door+hinges, drawer, corner/sink) | A shelf doesn't exercise the geometry that breaks spindles. Stronger coverage. (unbreakable) |
| **Export test** | Byte-for-byte match | Semantic golden (parse to canonical form, diff that); byte-for-byte only as a one-time spike | Byte-for-byte is brittle and doesn't verify machining intent. (trackable) |
| **Packaging** | `packages/` + CI import-lint enforcement | Module separation with ONE public entry point now; promote to formal workspace package when a 2nd app/team exists | Monorepo tooling is ceremony at 1.5 devs; the separation that matters costs nothing and still survives 30 devs. (future-proof without waste) |
| **Rules engine** | Rules in JSON, never if/else | Data tables + constants in catalogs; small testable selection logic in code; minimal arithmetic only — NOT a DSL | "Never if/else" pushes teams to build an accidental programming language. (lasting, not over-engineered) |

v1.0's core ideas survive unchanged: the engine is UI-free, the Base is model + conventions + gates, progressive disclosure with override-on-the-same-contract, evolve by addition.

---

## The governing principle (unchanged)

**The engine is UI-free and reached through one public entry point.**

The engine imports no React, React Native, Three.js, Zustand, or Expo. It runs identically in a phone, a browser, a Node test, or a CLI. The UI reaches it through exactly one module that exports two functions. A junior developer cannot put drilling logic in a screen, because the screen layer cannot import engine internals — only the entry point.

---

## The Base — what never changes (unchanged from v1.0, with mm10 added)

The constitution is three things; everything else is legislation that may change while obeying them.

1. **The universal model** — `Part`, `Operation`, `CutLayout`, `Project`, plus the runtime result types (`PreviewResult`, `FullResult`/`MachiningPlan`, `RenderPacket`). Coordinates are `mm10` integers. (See `05_CONTRACTS.md`, `14_RUNTIME_AND_BUILD.md`.)
2. **The conventions** — Face A/B, origin, transform order, units (`mm10`), tolerance, encoding (SWJ008 charset). (See `06_CONVENTIONS.md` as amended by `14`.)
3. **The safety gates** — collision check → SWJ008 sandbox → air-cutting simulation.

Evolve by **addition** (optional fields, free) never by **replacement** (rename/delete → major version + migration). Extended hundreds of times, broken almost never.

---

## The runtime topology (NEW in v2.0 — the heart of this revision)

Conceptual layering (the 7 layers in `11`) describes how code is *organized*. Runtime topology describes how it *executes*. Both are required; v1.0 had only the first.

```
ENGINE CORE  (pure, deterministic, UI-free)
  • fixed-point mm10 units
  • primitives produce a canonical MachiningPlan
  • validators (safety gates) run here
        │
        ▼
ENGINE RUNTIME  (the async boundary — the public entry point)
  • solvePreview(project): PreviewResult        // sync, cheap (~2ms), bounded per gesture tick
  • solveFull(project): Promise<FullResult>      // async, heavy (~50-200ms), debounced / on commit / for export
        │
        ▼
UI  (Expo / RN)
  • gestures touch ONLY preview packets
  • full solve runs on debounce/commit, never during live drag
  • exports use ONLY the validated full result
```

**Rules of the topology:**

1. `solvePreview` must be bounded — it returns bounding boxes, faces, outlines, and LOD drill *zones/counts*, never hundreds of individual coordinates. It is allowed to run on every gesture tick.
2. `solveFull` is always called through a Promise and always wrapped (initially `InteractionManager.runAfterInteractions()`), so the JS thread never blocks on it. It produces the manufacturing-grade `MachiningPlan` that exporters and gates consume.
3. The *location* where `solveFull` executes is a swappable implementation detail behind the Promise: on-device async now → native-thread (JSI/worklets) later → server as an optional accelerator. **Offline-first is the default; server is never required.** The contract never changes when the location does. This is the future-proofing.
4. Web Workers are not a dependable primitive in Expo/RN — do not design around them.

This topology is what makes the boundary survive rewrites: it is two typed functions, not a folder diagram and not a pile of lint rules.

---

## Packaging (TEMPERED in v2.0)

- **Now (1.5 devs):** the engine is a directory with one public entry point, `engine/index.ts`, exporting `solvePreview` and `solveFull`. Internals are organized into the `11` modules and are private. The UI imports only `engine` (the index). No monorepo tooling, no Nx, no CI import-lint yet.
- **Later (2nd app or real team):** promote the directory to a formal workspace package. Because the public surface is already one entry point, this is a packaging change — not a code move, not a redo.

The separation that prevents redo is the **single entry point + the UI-free rule**, not the build tooling. Tooling is added when it solves a problem you actually have.

---

## Progressive disclosure — "do everything imos does, hidden like magic" (unchanged)

- **Default (magic):** the solver computes hinge counts, drill offsets, shelf positions. The user sees a simple result.
- **Advanced (hidden menu):** every computed value is overridable. An override sets `source: "user"` on the value; the solver does not recompute user-set values.
- **Same contract:** an override writes to the same `Operation`/`Part` model. There is no separate "advanced" data model. (Exactly how imos variant families work — defaults flow, overridable per node.)

---

## The rules engine (CLARIFIED in v2.0)

Do **not** build a DSL. The proven hybrid:

- **Data** (catalogs): constants and lookup tables — hinge counts by height band, drill offsets per hardware SKU, edge-banding defaults.
- **Code** (solver): small, testable selection functions that read the tables and pick. Plain TypeScript, unit-tested.
- **Expressions:** minimal — arithmetic at most (e.g., `handleX = drawerWidth / 2`). No conditional language, no custom evaluator, no rule debugger.

This keeps flexibility (edit a table to change behavior) without the unbounded cost of a rule runtime (its own versioning, migrations, evaluator correctness).

---

## Build order — engine-first, proven by the Golden Cabinet Suite (UPDATED)

You do not ship a half product and do not visit masters until proud. The resolution: build a *complete tiny product*, engine-first, proven by three fixtures before UI depends on it. Full build sequence in `14_RUNTIME_AND_BUILD.md`. In brief:

1. Stand up the runtime boundary (`solvePreview`/`solveFull`) returning fixtures.
2. Build the Golden Cabinet Suite (3 fixtures) + Fixture 0 (the real factory `POLKA` SWJ008) as regression gates.
3. Wire Phase A–C UI to the real boundary from day one (fixtures acceptable early — real contracts, no fake data).
4. Make `solveFull` real, async, and fast on a real phone.
5. Split modules only where actual pilot usage proves the seams.

---

## Failure register (v2.0 — expanded with stress-test findings)

| Predicted failure | When | Prevention (in the base now) |
|---|---|---|
| JS thread freezes during Phase D drag | Week 3, kitchen > 2 cabinets | `solvePreview` sync+cheap for drag; `solveFull` async, debounced 200ms after gesture. Async wired day 1. |
| Float drift → phantom collisions / 0.1mm drilling drift | Months in | `mm10` integers in the core; floats only at render/export edges. |
| Golden output drifts silently after a catalog change | Any hinge/catalog edit | Golden Cabinet Suite + Fixture 0; `npm test` diffs canonical output every commit; zero tolerance. |
| SWJ008 charset/face error → wrong hole type | First real export | Charset (Windows-1251) + Face A/B locked as core constants; tested against real `POLKA` as Fixture 0. |
| 3D viewport chokes on 200+ holes | Phase D, 8-cabinet kitchen | Holes are instanced/batched geometry; `solvePreview` returns zones/counts, full coords only in `solveFull`. |
| Exports regress quietly | After any solver change | Semantic goldens on canonical `MachiningPlan`, not byte-for-byte. |
| PDF differs by device / unreadable fonts | First Phase F print on a new Android | Deterministic SVG→PDF with explicitly embedded fonts; never WebView HTML→PDF. |
| Zustand becomes a re-render pump | ~20 cabinets | `subscribeWithSelector`; bind to `selectedPartId`/`activeViewId`/`renderPacketId`, not `project` monolith. |
| Engine entry point becomes a god object | Week 6 | The boundary is two pure functions with typed results, not a dumping-ground hook. Logic lives in core modules behind them. |
| Worker strategy collapses in Expo | If attempted | Don't use Web Workers; offline default is on-device async → native-thread; server optional. |
| Corner kitchen breaks the solver | First L-shaped kitchen | Corner fixture is in the golden suite before any Phase-A screen uses it. |

---

## Changelog

- **v2.0 (June 2026):** Added runtime topology (Engine Core / Engine Runtime / UI; preview+full solve split; async-from-day-1; swappable solve location, offline default). Units → `mm10` fixed-point. One-shelf → Golden Cabinet Suite (3 fixtures). Byte-for-byte → semantic goldens. Packaging tempered to single-entry-point, no monorepo tooling yet. Rules engine clarified to data+small-code+minimal-expressions (not a DSL). Expanded failure register. Origin of changes: pre-build stress test, accepted/tempered per founder principles.
- **v1.0 (June 2026):** Initial constitution. Engine-as-pure-package. Base = model + conventions + gates. Package laws. Progressive-disclosure override. Engine-first build order.
