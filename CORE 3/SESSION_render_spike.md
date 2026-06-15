# Claude Code Session — Floor-Device Render Spike (R-M7)

**Goal:** Prove the render layer sustains ≥30fps on a $150 Redmi-class Android, on the architecture we will actually ship (no CSG, instanced geometry, transform-not-rebuild). This is a **go/no-go gate** before the UI build. The engine data layer is already proven fast (PERF_LEDGER: 710-op parse ~5ms, export 1.6ms); this spike tests only the GPU/render side.

---

## 0. STANDING DIRECTORY RULE — read first, obey for the whole session

Paste this as the first instruction every session from now on:

> Numbered docs (`NN_*.md`) and all research files (`DB/`, `-r*.md`, `-rU_*`, `-rF_*`, `-rR8_*`) are **READ-ONLY REFERENCE**. Never move, rename, edit, or delete them. All new **code** lives under `packages/` and `tools/`. Any new **strategy/spec doc** takes the next `NN_` number and goes in the repo root. This spike's code lives in a new `packages/render-spike/`. Do not touch `packages/engine/`, the golden suite, or any existing tests. Keep the working tree clean and commit with a clear message at the end.

---

## 1. What to build

A **standalone render spike** — decoupled from any UI framework and from Zustand. One runnable page that opens on a phone. It imports the engine's data structures (read-only) to generate a realistic scene, then renders it under strict rules and measures performance.

```
packages/render-spike/
  index.html          # entry, opens on phone
  spike.ts            # scene gen + render + metrics
  (vite or esbuild)   # whatever builds to a static bundle fastest
```

### 1.1 Scene generation (use the engine's data, don't reinvent)
Programmatically generate a **G-shape kitchen** from the engine's existing part/panel structures:
- 12+ cabinets: base run + wall run + a corner return (the G), standard base/wall/tall + one corner unit.
- 40+ panels total (sides, bottoms, tops, shelves, backs, fronts).
- Each panel carries its real drill operations (cups, cams, pins, confirmats) from the engine's machining model — the same data the verified hinge fixture produces. We render these as markers, never as cuts.

If wiring the real engine generator is slow, a faithful hardcoded G-kitchen with the same panel/op *shape and count* is acceptable for the spike — the point is GPU load, not solver correctness. State in a comment which path was taken.

### 1.2 Render rules — STRICT (these are the architecture under test)
1. **Panels = shared low-poly geometry, transformed, never rebuilt.** One reused `BoxGeometry`; each panel is a transform (scale + position) of it. A box is ~12 triangles. Whole kitchen target: a few thousand triangles, not tens of thousands.
2. **NO CSG. NO booleans. NO geometry cutting.** Ever. Holes are not subtracted.
3. **Holes/cams/dowels/pins = `InstancedMesh` markers**, one instanced mesh per marker type, visible only in an **X-ray toggle** state. Ten thousand holes must be a handful of draw calls, not thousands of meshes.
4. **Baked/cheap lighting + real-time PBR preview.** No path-tracing, no real-time GI. Clean materials, one baked environment. Must look professional (avoid the "почему размыто?" blur — decent material + sensible texture sizes), not photoreal.
5. **LOD + draw-call discipline.** Far cabinets render as plain boxes; X-ray detail only when toggled/zoomed; merge static geometry so the base run is a handful of draw calls. Keep total draw calls low — draw-call count, not triangle count, is the real Mali stall predictor.
6. Three.js settings consistent with our locked render config (PCFSoftShadowMap or cheaper if it costs FPS on the floor device; ACESFilmic tone mapping; mm scale = 0.001).

### 1.3 Metrics — make them visible ON the phone screen
An always-on overlay (large, readable) showing live:
- **FPS** (rolling average + 1% low).
- **Frame time** (ms, current + p95).
- **Draw calls** (`renderer.info.render.calls`).
- **Triangles** (`renderer.info.render.triangles`).
- **Geometry/texture memory** (`renderer.info.memory`).

Two scripted stress tests with on-screen buttons:
- **[Orbit stress]** — continuous auto-orbit for 30s; report sustained FPS + 1% low + draw calls.
- **[Width-drag stress]** — rapidly change a central cabinet's width N times/second for 15s. CRITICAL: this must call the engine's `solvePreview`-style update and apply **matrix transforms only** — explicitly NOT rebuild geometry. This proves the transform-not-rebuild architecture under live editing, which is the exact thing the mobile-CAD red-team said was impossible. Report FPS during the drag and the per-update cost in ms.
- **[X-ray toggle]** — flip all hole markers on; report the draw-call delta and FPS impact (proves instancing holds).

Log results to screen AND `console` (so they're capturable over USB).

---

## 2. The pass bar (write the verdict to screen at the end)

| Metric | Pass | Source |
|---|---|---|
| Sustained FPS during orbit (floor device) | ≥ 30 | doc 18 |
| FPS during width-drag stress | ≥ 30 | doc 18 |
| Per parametric update | ≤ 4 ms (transform only) | doc 18 |
| Draw calls (full kitchen, X-ray off) | low dozens, not hundreds | this spike |
| X-ray on: still ≥ 30 fps | yes (instancing works) | this spike |
| Cold load → interactive | ≤ 3 s | doc 18 |

**If it passes:** the 3D-first bet is validated; UI build proceeds. **If it fails:** report exactly which rule broke the budget (triangles? draw calls? rebuild leaked in? texture size? shadow cost?) so we fix the architecture, not guess. Do NOT optimize blindly — diagnose and report.

---

## 3. How it gets onto the phone (the deployment path)

Build to a **static bundle** (plain HTML/JS, no server runtime needed). Three ways to open it on the Redmi, easiest first:

1. **Local network (fastest for iterating):** `vite build` then serve the `dist/` over LAN (`vite preview --host` or any static server bound to `0.0.0.0`); open the laptop's LAN IP on the phone's Chrome — same Wi-Fi. Refresh to re-test after each change.
2. **GitHub Pages (zero-setup, shareable):** push `dist/` to a `gh-pages` branch or the existing `saidislomsaidazimovv.github.io` repo; open the URL on the phone. Good for showing the factory friend too.
3. **USB + chrome://inspect (for the FPS console logs):** plug the Redmi in, enable USB debugging, open `chrome://inspect` on the laptop to read the phone's console and confirm the metrics.

Output a one-line "open this URL on your phone" instruction at the end of the session.

---

## 4. Deliverable
- `packages/render-spike/` building to a static bundle.
- On-screen metrics overlay + 3 stress buttons.
- A printed verdict (pass/fail per row of §2) and, if fail, the diagnosed bottleneck.
- A new `PERF_LEDGER.md` section "Render spike (floor device)" with the measured numbers and the exact device model.
- Clean working tree, one commit: "Render spike: G-kitchen FPS gate on floor device".
- Do not modify the engine, goldens, or existing tests.
