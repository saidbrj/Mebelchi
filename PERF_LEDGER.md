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

**Device-dependent — MUST be read on the Redmi (PENDING on-device run):**

| Metric | Pass bar | Floor device | FPS | 1% low | Notes |
|---|---|---|---|---|---|
| Sustained FPS during orbit | ≥ 30 | _Redmi ____ (model)_ | ___ | ___ | from on-screen Orbit-30s |
| FPS during width-drag | ≥ 30 | _same_ | ___ | — | from Width-drag-15s |
| FPS with X-ray ON | ≥ 30 | _same_ | ___ | — | from X-ray toggle |

FPS cannot be measured in this repo: a headless/CI browser uses software
rasterization (~7 fps observed — the rasterizer, not a GPU). Fill the three FPS
rows from the spike's on-screen overlay on the actual floor device; the device
model goes in the blanks (doc 18 §2: buy two of that exact phone). All
non-FPS rows already pass and are device-independent, so the only open risk is
raw fill-rate/shader cost on Mali — which the low draw-call + low triangle counts
make very unlikely.
