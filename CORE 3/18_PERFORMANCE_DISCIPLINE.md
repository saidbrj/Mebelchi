# 18 — Performance Discipline (Staying Fast While Everything Grows)

**Version:** 1.0
**Date:** June 2026
**Origin:** Factory visit question 4 — joints engine + physics engine + thousands of SKUs + media + animations are all additive load. How do we keep the app fast forever, not just at V1?

---

## 1. The honest answer

Performance at scale is not a trick; it is **governance**: a budget, a floor device, and a regression gate. Doc 13 already gives the architectural halves (`solvePreview`/`solveFull` split, mm10, instanced holes, Zustand selectors). What's missing is the discipline that keeps every *future* feature inside those walls. That is this document.

## 2. The floor device (define it once)

All budgets are measured on the **floor device**: the cheapest phone a Tashkent mebelchi realistically carries — a ~$150 Android, 4 GB RAM, Mali-class GPU (Redmi/Galaxy-A tier; confirm the actual model in the first 5 shop visits and buy two of that exact phone). If it's fast there, it's fast everywhere. iPhones and flagships are not test devices; they hide sins.

## 3. The budget table (binding, CI-enforced)

| Operation | Budget on floor device | Where enforced |
|---|---|---|
| `solvePreview` per gesture tick | ≤ 4 ms | bench test in CI (Node proxy) + on-device suite |
| `solveFull`, 8-cabinet kitchen | ≤ 400 ms | bench on golden kitchen fixture |
| Physics Grade-1 gate (doc 16) | inside the `solveFull` budget | same fixture |
| Joint resolver, full kitchen | ≤ 50 ms (it's table lookups) | bench |
| Catalog SKU resolve (SQLite) | ≤ 5 ms per lookup, search ≤ 80 ms | bench |
| Cold start → first interactive screen | ≤ 3 s | on-device suite |
| 3D viewport, 8-cabinet kitchen | ≥ 30 fps during drag | manual matrix + perf overlay |
| App base size | ≤ 60 MB; media via lazy packs (doc 17) | CI size check |
| Memory, largest golden kitchen open | ≤ 350 MB | on-device suite |

Numbers are v1 guesses — tighten or justify-and-amend with a changelog entry, exactly like the constitution. The point is that a number exists and a red CI exists.

**The regression gate:** `npm run bench` runs the solver benchmarks over the golden suite on every commit, alongside the correctness goldens. A PR that makes `solveFull` 30% slower fails the same way as one that moves a hole 0.3 mm. Slowness becomes a *visible, attributable event*, never a drift.

## 4. The feature cost ledger

Every new feature (physics check, catalog pack, animation, view mode) adds one row to `PERF_LEDGER.md`: what it costs on which budget line, measured, before merge. Two effects: (a) nothing lands unmeasured; (b) when a budget line fills up, the ledger shows exactly what to optimize or evict. This is the "alter all the functions added" answer: each function is admitted with a price tag.

## 5. Standing rules (the walls themselves)

1. **Heavy work is async or absent.** Anything that can exceed 4 ms runs behind `solveFull`'s Promise. Physics, joint resolution, export, pricing aggregation — all there. The gesture path allocates nothing and loops over nothing unbounded.
2. **Data scales on disk, not in RAM.** Catalogs in SQLite (doc 17 §6); projects load lazily; the 3D scene holds instanced geometry, full drill coordinates only on demand.
3. **Media never blocks logic** (doc 17 §5): lazy, cached, capped, decoded at display size; one animation playing at a time.
4. **LOD everywhere:** preview returns zones/counts (doc 13); far cabinets render as boxes; X-ray detail appears at zoom, not by default.
5. **No new runtime dependencies without a ledger entry** — libraries are the silent budget killers (a date library has ended more startups' FPS than physics ever will).
6. **Server is an accelerator, never a requirement** (doc 13 rule 3) — if a feature only fits the budget with a server, it isn't V1 material.

## 6. Sequence

1. Buy the floor device (×2) after shop visits identify it.
2. Add `npm run bench` over the existing golden suite — baseline today's numbers before any new engine grows.
3. Create `PERF_LEDGER.md` with the first entries (current solver, current exporter).
4. Wire the on-device test build (golden kitchen + perf overlay) — the demo phone IS the test rig.
5. First budget review after the joint resolver and physics Grade 1 land.
