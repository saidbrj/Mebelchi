# 17 — Catalog Platform (Thousands of SKUs Without Dying)

**Version:** 1.0
**Date:** June 2026
**Origin:** Factory visit — one brand alone has thousands of catalog items. We add them over time, sell access, and keep a mid-range Android fast.

---

## 1. The core principle: catalogs are data, never code

A new SKU must never require an app release. The engine already enforces this (doc 13 rules engine, doc 15 spec JSONs). Scaling to thousands of SKUs is therefore a *data pipeline* problem plus an *on-device storage* problem — the solver doesn't change.

## 2. Two grades of SKU (the safety line)

One bad drilling file ends the company — so we cannot bulk-import thousands of drilling patterns and trust them. Every SKU carries a grade:

| Grade | What it has | What the app allows |
|---|---|---|
| **Browse grade** | name, brand, image, price, dimensions | show, price, spec into a quote |
| **Manufacturing grade** | + drilling pattern with `verified: true` against a real export or manufacturer datasheet | drives drilling output |

Bulk import gets you browse grade in thousands. Manufacturing grade is earned one SKU at a time through the doc-15 verification flow (test diffs against ground truth). The UI shows the difference honestly. This converts "thousands of SKUs" from a terrifying safety problem into a growth funnel: browse grade creates demand; demand prioritizes which SKUs we verify next.

## 3. The catalog compiler (offline pipeline, not on device)

```
manufacturer data (datasheets / CAD / price lists / supplier xlsx)
   → ingest (scrapers, parsers, LLM extraction with human review)
   → normalize to catalog schema (SKU, family, dims, drilling, price, media refs)
   → validate (schema + drilling sanity rules + duplicate detection)
   → sign + version → publish as catalog PACKS
```

- A **pack** = one brand/category bundle (e.g. `blum_hinges@2026.06`), a few hundred KB of data + media refs. Versioned, immutable, signed.
- App ships with the **core pack** (the 50–200 SKUs Tashkent actually buys — the doc-15 / strategic-memo question). Everything else downloads on demand and works offline after.
- On device: packs land in **SQLite with FTS index** — not one giant JSON in memory. The solver resolves only the SKUs a project references (it already works by string key — IMOS_FEATURE_MAP A4). Memory stays flat no matter how many packs are installed.

## 4. Money

1. **Supplier listing (B2B, already in the memo):** Imkon/Egger/Kronospan-scale suppliers pay for placement, current prices, and "order this list" routing. The mebelchi's fittings list is a purchase order — whoever owns that list owns the order flow. This is the big one; commission on hardware orders dwarfs $10/month subscriptions.
2. **Premium brand packs (B2C/B2B):** core catalog free; full Blum/Hettich/Häfele packs as paid unlocks or in the higher tier.
3. **Verified-drilling as the premium:** browse grade is marketing for suppliers; manufacturing grade is value for users. Both sides pay for the same data, differently.

## 5. Accessory media (challenge 3 — image, structure frame, animation)

Per-accessory media is not hand-made; it is **rendered from one source 3D model per accessory family**:

```
one glTF model per SKU/family
   → headless Blender batch render (scripted, deterministic):
        thumbnail.webp        (≤30 KB, product shot)
        structure.webp        (wireframe/X-ray "frame" view — same camera, line shader)
        motion.webp           (animated WebP turntable / open-close / exploded, ≤300 KB)
   → media CDN, referenced from the SKU record by hash
```

- **Animated WebP, not GIF** — ~10× smaller at equal quality; RN renders it natively. Same pipeline can emit MP4 for marketing later.
- Manufacturers (Blum, Hettich, Häfele) publish CAD models and product media — **media rights become a clause in the supplier listing deal**, turning our biggest content cost into something partners provide.
- Media packs are separate from data packs: data is required, media is lazy (download on first view, LRU cache, cap e.g. 200 MB). A missing image must never block pricing or solving.
- For the long tail with no CAD model: generic family renders (every Ø35 cup hinge looks alike at thumbnail size) until the SKU earns its own model.

## 6. Device performance rules for catalogs (binding)

1. Catalog access is **by key, on demand** — never iterate the whole catalog on the UI thread; FTS handles search.
2. Packs are immutable + versioned → caching is trivial, sync is diff-of-packs.
3. Images decoded at display size; animations play only on screen, one at a time.
4. The solver's hot path touches only the project's resolved SKUs (tens, not thousands).
5. A catalog edit can never change solver output silently — pack version is recorded in every project and every export's provenance footer (Phase F already has one).

## Amendment A (June 11, 2026) — founder decisions + first real data

1. **No 3D media.** §5's Blender pipeline is deferred indefinitely. Media v1 = product image + technical drawing ("the holes") only. Source: catalogue page renders (cropped) now; manufacturer media later. The R5 research + GTV's own catalogue confirm **GTV operates a B2B data API** exposing product data, hi-res photos, catalog sheets and videos — that API is the real media/data source; request access via the GTV B2B partner route.
2. **Brand tiering locked:** GTV = the core mid-tier pack (good price/quality, technical PDFs obtainable); Hettich = available-in-UZ upper tier (price higher); Blum = premium tier. Boyard/Samet remain candidates for the budget tier pending shop-visit confirmation.
3. **First pack built (pilot):** `catalog/packs/gtv_2025_06/` — 3,552 browse-grade SKUs auto-extracted from the GTV 2025 catalogue (953 handles, 418 drawer systems, 204 slides, 171 hinges, 156 connectors…), plus `connectors_pilot.json` (eye-transcribed manufacturing-grade candidates, all `verified:false`) and the first cited rule table `catalog/rules/hinge_count.gtv.json`.
4. **Source PDFs on hand:** GTV Furniture Accessories 2025 (788 pp), Blum Catalogue & Technical Manual 2024/25 (758 pp), Hettich Technik & Anwendung (1,390 pp). Blum/Hettich technical manuals contain the official drilling patterns — they are the verification source for premium-tier SKUs.

## 7. Sequence

1. Lock the catalog schema (extend the existing 114-item one with `grade`, `source`, `verified`, `media`, `packVersion`).
2. Build the compiler for **one brand the factory actually buys** (Boyard or Samet class — confirm at shops) end to end: ingest → pack → SQLite → app.
3. Verify drilling for the top-15 SKUs (doc 15 flow) → manufacturing grade.
4. Blender media pipeline for that one pack (proves §5 costs ~nothing per SKU after setup).
5. Then, and only then, scale brands one pack at a time — and start the first supplier-listing conversation with the pack as the demo.
