# ADR-001 — Cross-Platform Stack & 3D Architecture

**Status:** Proposed (for Oppoq + brother + Saidislom + Davron to ratify)
**Author:** Oppoq (with Claude)
**Date:** June 2026
**Decision needed by:** before V1 build sprint starts
**Supersedes / amends:** the stack table in `HANDOVER_UI_V3.md` §1 (Expo lock) — see "Relationship to existing decision" below.
**Companion docs:** `MEBELCHI_STRATEGIC_MEMO.md`, `IKEA_KITCHEN_TEARDOWN.md`, `ENGINE_README.md`, `HANDOVER_UI_V3.md`

---

## Context

We want, in one product:

1. **iOS + Android + Web** from a single codebase.
2. **One account** with cloud sync — an Android user's projects open on the web and vice-versa.
3. **Optimized 3D** that renders realistic, X-ray, and wireframe/line modes, with a **seamless floor-plan ⇄ 3D transition**.
4. **IKEA-grade UX** (simple yet professional) — but with **editable parametric furniture** and **CNC-grade output**, which IKEA does not do.
5. Built by a **small team** (brother = frontend, Saidislom = backend/engine), mobile-first, for Tashkent workshops.

This ADR records the recommended stack and the 3D architecture, with the trade-offs, so the team builds against one decision.

---

## The decisive constraint: stay in TypeScript

The Mebelchi engine is already a **headless TypeScript package** (`solvePreview` / `solveFull` / `solveAndExportSWJ008`), designed to run identically in Node, a browser, or a phone (`ENGINE_README.md`). That is the most valuable asset in the project.

**Implication:** if the UI is also TypeScript, the *same engine code* runs in the app, the web build, and on the server — one language from drilling math to UI to backend.

**This rules out Flutter.** Dart would orphan the TS engine (rewrite it, or run it over a bridge). The 3D ecosystem on Flutter is also far less mature than three.js for a parametric-CAD workload. Flutter is rejected on these two grounds, despite its strong general cross-platform story.

The real question is therefore not "which language" but **"which thin UI shell wraps the TypeScript core."**

---

## Decision

### 1. Rendering core — three.js (with WebGPU)

One scene-graph codebase shared across web and native. As of three.js **r171 (Sept 2025)**, WebGPU is production-ready with automatic WebGL2 fallback (`import * as THREE from 'three/webgpu'`), and **TSL** shaders compile to both WGSL (WebGPU) and GLSL (WebGL) from one source. WebGPU's main win — lower CPU cost on high-draw-call scenes — maps directly onto our workload (a cabinet run is hundreds of small repeated parts).

### 2. UI shell — two viable options, one recommended

| | **A. Expo (RN + RN Web)** | **B. Web-core + Capacitor** *(recommended)* |
|---|---|---|
| Codebase → platforms | One RN codebase → iOS / Android / Web | One React web app → wrapped for iOS / Android, shipped as Web/PWA |
| Native feel | Best | Good (chrome is light; app is 3D-canvas-dominated) |
| 3D path | **Friction in 2026:** react-three-fiber depends on an older `expo-gl` than recent Expo SDKs ship → breaks 3D on physical devices; web fine. Mitigate by pinning versions or rendering 3D via Expo "DOM components." | **Cleanest:** three.js on the web is the most mature path; identical canvas on every platform |
| Web as first-class surface | Yes (via RN Web) | Yes (it *is* the web app) |
| OTA / native ecosystem | Stronger | Via Capacitor plugins |

**Recommendation: Option B (web-core + Capacitor).** Rationale: (a) the team admires IKEA's *web* app and wants to mirror it; (b) the app is dominated by a 3D canvas where web three.js is strongest; (c) web access is a stated first-class requirement; (d) it sidesteps the 2026 RN-3D friction; (e) it keeps one TS codebase from engine to UI. **Option A (Expo)** remains the fallback if native polish / OTA updates outweigh 3D simplicity — and our existing handover already leans Expo, so this is a real reconsideration, not a rubber stamp.

Either way: **the 3D scene code and the engine are identical across platforms — only the thin shell differs.** The choice is reversible at the shell layer at moderate cost; it is not reversible at the engine/rendering layer, which is why those are locked first.

### 3. Account + sync — Supabase

Supabase (Postgres + Auth + Storage + Realtime); Firebase is the alternative.

**Data-model trick — store projects as small JSON, not meshes.** A project is just its **parametric parameters**; geometry is regenerated on each device by the engine. So sync = syncing tiny JSON rows: cheap, fast, conflict-friendly. Android save → Postgres row → web reads the same row. Exported artifacts (DXF / SWJ008 / PDF) live in Supabase Storage, scoped to the account.

---

## 3D architecture — the three requirements are one idea: *one scene, never rebuilt*

- **Realistic / X-ray / wireframe** = three **material sets** on the same meshes. Toggle materials (PBR → transparent → line); never rebuild the model. This is what makes mode-switching instant and seamless.
- **Floor-plan ⇄ 3D** = the same scene with an **animated camera** (orthographic top-down ⇄ perspective) plus walls collapsing / rising. One scene, one camera tween — not two screens. This is the key to the seamless transition.
- **Performance budget:**
  - **Instanced meshes** for repeated parts (shelves, dowels, hinge cups, cam locks) — these drive draw-call counts.
  - **Generate each module's geometry once** from its parameters and **cache** it; regenerate only on edit.
  - **Render-on-demand** — redraw only on interaction, not every frame.
  - **WebGPU** for the draw-call savings on dense scenes; LOD for distant/!selected modules.

### The part that is NOT a copy of IKEA

IKEA loads **pre-made catalog meshes** (fixed GLB models). Mebelchi must **generate geometry from parameters** every time a module is resized or a shelf/divider/drawer changes. This is a genuinely harder 3D problem than IKEA solved, and it is exactly where the parametric engine earns its keep. "Basically copy IKEA" must not hide that this layer is net-new engineering.

---

## Relationship to the existing Expo lock

`HANDOVER_UI_V3.md` §1 locked Expo SDK 54 + RN 0.81 + three.js/r3f. This ADR does **not** silently overturn that; it surfaces the 2026 reality that the RN-native 3D path now carries version friction, and proposes web-core + Capacitor as the lower-risk route to the same three platforms. If the team ratifies Option B, update `HANDOVER_UI_V3.md` §1 accordingly. If the team keeps Option A, adopt the expo-gl pinning / DOM-components mitigation explicitly.

---

## Consequences

**Positive**
- One TypeScript codebase: engine + UI + server.
- Engine already runs on all targets — minimal porting.
- 3D identical everywhere; modes and 2D⇄3D are cheap (material/camera ops).
- Tiny-JSON sync is robust and low-cost.

**Negative / risks**
- Parametric geometry generation is real, net-new 3D work (highest technical risk).
- Option B trades some native-chrome polish; Option A carries 3D-on-native version friction.
- WebGPU device coverage still has gaps → WebGL2 fallback must be tested on target Android hardware (Redmi).

---

## Next steps (in order)

1. **Ratify this ADR** — pick Option A or B; update `HANDOVER_UI_V3.md` §1.
2. **Spike the riskiest thing first**, before any features: a single three.js scene with the three render modes **and** the 2D⇄3D camera transition, running on **both web and a real Redmi phone**. Go/no-go gate.
3. **Wire the headless engine** into the chosen shell (it already runs everywhere).
4. **Supabase auth + project sync** using the JSON-model approach; exports to Storage.
5. **Build the IKEA-style 6-phase shell** on top, using prototype `UI Exploration/v7-journey.html` as the visual/interaction reference.

---

## Open questions for the team

- **Davron:** does the expo-gl/r3f friction (Option A) or WebGPU Android coverage (Option B) change your call? Which risk is cheaper to carry?
- **Saidislom:** can the engine emit a stable JSON project schema now, so sync and geometry-regen build against a fixed contract?
- **Brother:** build the week-1 3D spike on web first (fastest), then port to the chosen shell — agreed?
