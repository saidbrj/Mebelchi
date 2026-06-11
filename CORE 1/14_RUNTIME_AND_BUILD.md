# 14 — Runtime & Build (Executable Contract + Claude Code Kickoff)

**Version:** 1.0
**Status:** SACRED for the runtime boundary; operational for the build plan.
**Date:** June 2026
**Purpose:** Turn the constitution (`13` v2.0) into something Claude Code can build, and amend the conventions that the stress test proved must change.

---

## Part 1 — The executable runtime contract

The boundary is two functions. This is the single most important code surface in the product. Everything else is UI iteration on top of it.

```ts
// engine/index.ts — the ONLY public surface of the engine

export function solvePreview(project: Project): PreviewResult;
// sync, cheap (~2ms), bounded per gesture tick.
// returns bounding boxes, faces, outlines, LOD drill ZONES/COUNTS — never full coordinates.
// safe to call on every drag frame.

export function solveFull(project: Project): Promise<FullResult>;
// async, heavy (~50-200ms). debounced after gesture / on commit / for export.
// returns the manufacturing-grade MachiningPlan. exporters and safety gates consume ONLY this.
```

### The result types (additions to the Base — see `05_CONTRACTS.md`)

```ts
// All coordinates are mm10 integers (tenths of a millimeter). Floats appear only at render/export edges.

type mm10 = number; // integer; 16mm board = 160; divide by 10.0 only at the edge

interface PreviewResult {
  parts: Array<{
    id: string;
    bbox: { x: mm10; y: mm10; z: mm10; w: mm10; h: mm10; d: mm10 };
    drillZones: Array<{ face: Face; count: number; region: BBox2D }>; // LOD only
  }>;
  // bounded: no operation-level coordinates here
}

interface FullResult {
  plan: MachiningPlan;       // canonical, the single source of manufacturing truth
  renderPacket: RenderPacket; // compact arrays/buffers for instanced rendering
  validation: ValidationReport; // gate results; export blocked unless clean
}

interface MachiningPlan {
  parts: Part[];             // each with operations[] in mm10, panel-local
  cutLayout: CutLayout;
  schemaVersion: number;     // stored in every saved project
}

interface RenderPacket {
  // compact, instancing-friendly — NOT a Mesh-per-hole object graph
  holeInstances: { positions: Int32Array; diameters: Int32Array; faces: Uint8Array };
  panelMeshes: Array<{ id: string; verts: Float32Array; }>;
}

interface Operation {
  // ...existing fields...
  source: "auto" | "user";   // user-overridden values are never recomputed by the solver
}
```

### Topology rules (from `13` v2.0, restated as build constraints)

1. Gestures call `solvePreview` only. Never call `solveFull` during live drag.
2. `solveFull` is always awaited and always wrapped so the JS thread never blocks (`InteractionManager.runAfterInteractions()` initially).
3. The execution location of `solveFull` is swappable behind the Promise: on-device async (now) → native-thread/JSI (later) → server (optional accelerator). Offline-first is default. Contract never changes.
4. No Web Workers in Expo/RN.

---

## Part 2 — Amendment to `06_CONVENTIONS.md` §4 (units)

**Supersedes** the prior "round to 0.1mm (float)" rule. Justified under "change only if proved": the float-drift bug class is documented and standard CAD practice is fixed-point.

> **§4 Units (amended).** The engine core stores all coordinates and dimensions as fixed-point integers in tenths of a millimeter (`mm10`). 16mm = 160. All arithmetic, collision checks, bounds checks, and safety gates operate on integers. Conversion to floating point happens only at two edges: the render layer (divide by 10.0 for Three.js scene units) and the exporter (format to the decimal string each machine format expects). No engine-internal value is ever a float. This eliminates "almost equal" float bugs permanently.

---

## Part 3 — The Golden Cabinet Suite (regression harness)

Three fixtures + Fixture 0. Each produces canonical output diffed on every commit. Runs in ~2 seconds. No CNC required. This is the safety gate that lets 30 developers change the engine without silently breaking it.

| Fixture | Exercises |
|---|---|
| **Fixture 0 — real `POLKA` SWJ008** | Charset (Windows-1251), Face mapping, the exact format the factory machine already eats. Parse to canonical, store as `golden/polka-canonical.json`. |
| **Fixture 1 — base cabinet, single door, 3 hinges** | Hinge cup + plate pairing, overlay logic, dowel/cam carcass joints |
| **Fixture 2 — drawer cabinet, 3-stack** | Slide hardware, clearances, bottom panel groove |
| **Fixture 3 — corner / sink cabinet** | Non-90° joint logic, back-panel exclusion zones |

**The gate:** every time the engine changes, run the four fixtures. Parse each export into canonical form (sorted ops, normalized units/precision). Diff against the stored golden. Zero diff = engine correct. This is **semantic** comparison, not byte-for-byte. Byte-for-byte against `POLKA` is allowed once, as the initial format-confirmation spike, then retired in favor of the canonical diff.

---

## Part 4 — Render, PDF, and state constraints (locked)

- **Render:** holes are instanced/batched geometry consuming the `RenderPacket` arrays. Never a `Mesh`/`SphereGeometry` per hole. Drill marks in `solvePreview` are LOD billboards; full geometry only from `solveFull`.
- **PDF:** Phase F deliverables are generated as deterministic SVG/vector → PDF via a deterministic library (or server-side), with fonts explicitly embedded. Never WebView HTML→PDF (device WebView variance breaks fonts).
- **State:** Zustand with `subscribeWithSelector`. Screens bind to `selectedPartId`, `activeViewId`, `renderPacketId` — never to the `project` monolith. State management lives in the UI layer and never leaks into the engine.

---

## Part 5 — Ordered build plan

**Step 1 — Lock the executable boundary (prevents redo).**
Create `engine/index.ts` exporting `solvePreview`/`solveFull` with the typed results above. Move existing drilling primitives into engine core modules behind it. UI calls these from day one; early returns may be fixtures. Wrap `solveFull` in `InteractionManager.runAfterInteractions()`.

**Step 2 — Install the regression harness (prevents silent regressions).**
Build Fixture 0 (`POLKA` canonical) and Fixtures 1–3. Wire `npm test` to diff canonical output. Never delete a golden.

**Step 3 — Wire Phase A–C UI to the real boundary.**
Every screen gets real engine responses (fixtures acceptable while `solveFull` is incomplete). No fake data, no stubs — real contracts from the first screen, so async/error shapes are validated early.

**Step 4 — Make `solveFull` real and fast on a real phone.**
Preview stays local and cheap. Full solve becomes complete; keep it async. Switch rendering to instancing. Profile on a mid-range Android, not a simulator.

**Step 5 — Split modules only where pilot usage proves the seam.**
After a real master uses it once, the places `solver` must split become obvious. Extract then, not before.

---

## Part 6 — The Claude Code starter manifest

Hand Claude Code **only** these files. Not the full 20-doc database — extra context dilutes focus and invites scope drift. This set is the engine-first slice and nothing else.

**Give Claude Code:**

1. `13_FOUNDATIONAL_ARCHITECTURE.md` (v2.0) — the constitution: UI-free engine, single entry point, runtime topology, the Base, failure register.
2. `14_RUNTIME_AND_BUILD.md` (this file) — the two-function contract, result types, `mm10` amendment, Golden Cabinet Suite, render/PDF/state constraints, ordered build plan.
3. `05_CONTRACTS.md` — `Part`, `Operation`, `CutLayout`, `Project` (with the runtime result types and `source` flag from Part 1 added).
4. `06_CONVENTIONS.md` — Face A/B, origin, transform order, tolerance, SWJ008 charset, units (as amended by Part 2 of this doc).
5. `11_ENGINE_ARCHITECTURE.md` — the seven modules: how the engine internals are organized behind the entry point.
6. The real factory SWJ008 XML files (`POLKA-1_7_1.XML` and siblings) — as Fixture 0 source data.

**Do NOT give Claude Code (yet):** the CJM, UI principles, handover, IMOS feature map, UI pattern library, market/distribution/pitch docs. Those govern the UI build that comes *after* the engine slice is proven. Introducing them now invites the exact coupling (drilling logic inside UI phases) that the constitution forbids.

**The kickoff instruction to Claude Code:**

> Build the engine slice first, headless, per `14_RUNTIME_AND_BUILD.md` Steps 1–2. Create `engine/index.ts` with `solvePreview` and `solveFull`. All coordinates `mm10` integers. Stand up the Golden Cabinet Suite + Fixture 0 against the provided real SWJ008 files, using semantic (canonical-parse) comparison, not byte-for-byte. Do not build any screen until the four fixtures pass. Do not put any drilling or solver logic outside the engine modules. Report back when `npm test` shows four green fixtures.

---

## The one sentence

**One public entry point, two functions (`solvePreview` sync + `solveFull` async-from-day-1), `mm10` integers, four golden fixtures with semantic comparison, offline-first with a swappable solve location.** That is the foundation that never needs to be redone. Everything after is UI iteration on a proven engine.
