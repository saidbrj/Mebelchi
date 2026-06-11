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

Budget context (doc 18 §3): `solveFull` 8-cabinet budget is ≤ 400 ms on the floor
device; the current 4-panel suite at ~0.01 ms median is ~4 orders inside it. The value
of this table is the **delta** the next rows show, not the absolute numbers.
