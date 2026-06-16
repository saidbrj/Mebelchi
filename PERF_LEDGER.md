# PERF_LEDGER — the feature cost ledger (doc 18 §4)

Every feature that grows the engine adds rows here, measured **before** merge.
Run `npm run bench` (median + p95 over 100 runs after 30 warmup, full golden suite).
Numbers below are Node-on-dev-machine proxies; floor-device budgets (doc 18 §3) apply
once the on-device suite exists.

| Operation | Median ms | p95 ms | Suite | Node | Machine | Date | Commit | Note |
|---|---|---|---|---|---|---|---|---|
| parseSWJ008 (suite) | 0.261 | 0.490 | 4 files / 4 panels / 49 drill ops | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 380627b | BASELINE before Types 3–4 |
| canonicalizeParts (suite) | 0.014 | 0.020 | same | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 380627b | BASELINE before Types 3–4 |
| exportSWJ008 (suite) | 0.154 | 0.242 | same | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 380627b | BASELINE before Types 3–4 |
| solveFull (suite) | 0.011 | 0.031 | same | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 380627b | BASELINE before Types 3–4 |

| parseSWJ008 (suite) | 0.363 | 0.554 | original 4 files (BENCH_FILTER) | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | Types 3–4 + tolerate-and-flag: parse +0.10 ms (+39%) — attr whitelist & flag scan |
| canonicalizeParts (suite) | 0.015 | 0.031 | original 4 files | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | unchanged |
| exportSWJ008 (suite) | 0.130 | 0.138 | original 4 files | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | unchanged |
| solveFull (suite) | 0.009 | 0.014 | original 4 files | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | unchanged |
| parseSWJ008 (suite) | 0.689 | 0.986 | 6 files / 6 panels / 94 ops (incl. SHKOF T3/T4) | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | new full-suite reference |
| canonicalizeParts (suite) | 0.027 | 0.040 | same 6-file suite | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | new full-suite reference |
| exportSWJ008 (suite) | 0.204 | 0.310 | same 6-file suite | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | new full-suite reference |
| solveFull (suite) | 0.014 | 0.041 | same 6-file suite | v22.17.0 | darwin/x64 i7-9750H | 2026-06-11 | 9c1b4ba+T34 | new full-suite reference |

| parseSWJ008 (prop-0 scale ref) | 4.997 | 6.292 | 64 files / 64 panels / 710 ops (real factory project) | v22.17.0 | darwin/x64 i7-9750H | 2026-06-12 | 2cac660 | scale reference added — measurement only, no optimization |
| canonicalizeParts (prop-0 scale ref) | 0.103 | 0.148 | same 64-panel project | v22.17.0 | darwin/x64 i7-9750H | 2026-06-12 | 2cac660 | scale reference |
| exportSWJ008 (prop-0 scale ref) | 1.607 | 2.066 | same 64-panel project | v22.17.0 | darwin/x64 i7-9750H | 2026-06-12 | 2cac660 | scale reference |

The scale reference (`bench: 64-panel project scale reference`) reads the committed
factory dump at `Example sets/prop-0` in place — a realistic denominator for future
deltas. Per-panel cost at real-project size: parse ~0.078 ms, export ~0.025 ms.
Extrapolated to the dump's largest set (193 panels) parse stays ~15 ms — far inside
any budget; no optimization warranted. (Note: the golden suite itself grew to
7 files / 109 ops with the door fixture — golden-suite rows across dates are only
comparable via `BENCH_FILTER`.)

Budget context (doc 18 §3): `solveFull` 8-cabinet budget is ≤ 400 ms on the floor
device; the current suite at ~0.01 ms median is ~4 orders inside it. The value
of this table is the **delta** the next rows show, not the absolute numbers.

Use `BENCH_FILTER='^(POLKA|POL_|YON|ORTA_BAK)' npm run bench` to reproduce the
original-4-file suite for apples-to-apples deltas after the suite grows.

---

## Render spike (floor device) — R-M7 go/no-go

Standalone Three.js spike in `packages/render-spike/` (G-kitchen: 13 cabinets,
99 panels, 246 hole markers; real ops from the verified Layer-1 primitives).
Architecture under test: shared box geometry transformed never rebuilt, no CSG,
holes as InstancedMesh markers, draw-call discipline.

**Device-independent (fixed by construction — verified in a headless browser):**

| Metric | Measured | Pass bar | Verdict |
|---|---|---|---|
| Draw calls, X-ray OFF | 2 | low dozens | PASS |
| Draw calls, X-ray ON | 6 (+4 for 246 markers) | instancing holds | PASS |
| Triangles | 1,190 off / 4,142 on | a few thousand | PASS |
| Per parametric update (rebuild+solvePreview+matrices) | 0.12 ms median / 0.60 ms max | ≤ 4 ms | PASS |
| Geometries created during 15s width-drag | 0 (geom count constant at 18) | transform-not-rebuild | PASS |
| Cold load → first interactive frame (dev/LAN) | 0.07 s; bundle 510 KB / 131 KB gzip | ≤ 3 s | PASS (confirm on phone) |

**Device-dependent — measured ON the floor device (Redmi-class ~$150 Android; exact
model TBD, 2026-06-13):** production bundle served over LAN, Chrome.

| Metric | Pass bar | FPS | 1% low | Verdict |
|---|---|---|---|---|
| Sustained FPS during orbit (30s) | ≥ 30 | 44 | 19 | PASS |
| FPS during width-drag (15s) | ≥ 30 | 45–55 (two runs) | — | PASS |
| Per parametric update | ≤ 4 ms | 0.45–0.57 ms median (max 1.30–2.90) | — | PASS |
| FPS with X-ray ON (all markers) | ≥ 30 | 47–58 @ 6 draws | — | PASS |
| Cold load → interactive | ≤ 3 s | 0.41 s warm / 1.05 s first | — | PASS |
| Draw calls X-ray off / on | dozens | 2 / 6 (confirmed on device) | — | PASS |

**VERDICT: GO. 6/6 measured rows pass on the floor device.** The 3D-first bet is
validated; UI build may proceed on this render architecture (instanced panels,
no-CSG marker instancing, transform-not-rebuild editing).

Notes:
- The on-device per-update cost (0.45–0.57 ms) includes `rebuildCabinet` +
  `solvePreview` + matrix writes and never rebuilds geometry (geom count constant) —
  the live mobile-CAD parametric edit the red-team called impossible, with ~7× margin
  on the 4 ms budget.
- Orbit 1% low = 19 fps: occasional single-frame dips (likely GC / first-orbit warmup),
  not a sustained stall. Worth a glance once the real UI + Zustand land, but inside
  the gate (the bar is sustained ≥30; 1% low is reported, not gated).
- TODO: record the exact Redmi model and buy two of that unit as the standing floor
  device (doc 18 §2).
