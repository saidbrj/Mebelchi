# catalog/ — versioned catalog packs (doc 17)

- `packs/<brand>_<version>/index.json` — browse-grade SKU index (auto-extracted, safe: no drilling data).
- `packs/<brand>_<version>/connectors_pilot.json` — manufacturing-grade *candidates*; every number `verified:false` until cross-checked against a factory export or manufacturer technical sheet. Same law as `hardware_specs.dummy.json`: numbers in JSON, never in code.
- `rules/` — cited selection-rule tables (doc 16). Each rule carries `source` + `verified`.
- `media_samples/` — proof of the no-3D media pipeline: catalogue page renders (image + technical drawing in one frame).

## packs/core_2026_06 — the curated core (3 brands)

**Layout:** `index.json` is a slim manifest (pack meta + function groups + entry list). Each accessory lives in its own file: `accessories/<id>.json` — so verification, review, and git diffs happen one accessory at a time, matching the per-SKU verified flow. Media in `media/`. The bulk GTV browse index (`gtv_2025_06`, 3,552 auto-extracted SKUs) stays single-file by design — it's generated, not hand-maintained.

53 universal families (≈100+ orderable SKUs with variants), every entry with page-render media (image + technical drilling drawing): Blum 17 (CLIP top hinges, AVENTOS, TANDEMBOX/LEGRABOX/METABOX, MOVENTO/TANDEM), Hettich 15 (Sensys/Intermat, InnoTech Atira, Quadro, KA 270, **Rastex 15**, VB 35/36, TopLine), GTV 21 (soft-close hinges, VERSALITE slides, AXIS PRO, gas lifts, connectors, handles, legs, sliding, LED). Tier mapping: GTV = core, Hettich = upper (widely in UZ, pricier), Blum = premium.

Spot-verified visually: GTV VERSALITE H45 page (SKUs + drilling positions), Hettich Rastex 15/25 + Rapid S/Twister pages (the exact pairing `rastex15Pattern` models), Blum CLIP top ordering pages. Overlay-type labels on a few Hettich hinges still carry `confirm` notes.

## Tomorrow's factory dump (hundreds of XMLs)

```
python3 tools/swj008_inventory.py <folder-with-xmls> mined/<date>
```

Outputs panels/operations/hole-class CSVs + a report that flags anything outside machining Types 1–4. Run it the moment you get the files; the hole-class table + flags tell us immediately whether the parser and primitives cover the constructor's full vocabulary.

Already known from the 9 panels on hand: the two SHKOF panels introduce **Type 3 contour milling** (corner notches), **Type 4 saw grooves** (4mm back-panel dado), Ø3×1mm marking holes, and a new **Ø8×14mm** face-drill class — none of which the golden suite covers yet. Engine parse/export coverage for Types 3–4 must be added (with new goldens) before those panels can round-trip.
