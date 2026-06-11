# Factory Visit Checklist — Layer-1 Primitive Verification

## ADDED for the dump visit (June 12)

1. **One folder per cabinet/project** — without grouping, cross-panel joint matching is impossible. Include door, drawer and corner projects (Ø35 hinge ground truth still missing).
2. **Hardware purchase list** — promotes/demotes core catalogue defaults (CORE_DOCTRINE R12).
3. **Ø15 cam seats: why two depths (11.0 vs 12.5mm)?** Which connector SKU ↔ which depth.
4. **Quarter-millimetre coordinates** (e.g. X=907.250 marking holes in SHKOF): ask whether Bazis emits sub-0.1mm positions on *structural* drills too, or only on marks. Drives the mm10→mm100 core decision — count them in the dump with `swj008_inventory.py` before deciding.

---

Generated from the failing primitive proofs (`15_PRIMITIVES_STEP2.md`). Each row is a
spec value the dummy could not confirm. Bring back the number **and its source**
(datasheet photo / drilling card / Bazis export), enter it in
`engine/catalogs/hardware_specs.dummy.json`, flip `verified: true`, and the
corresponding proof test goes green automatically.

The primitive **functions are done and never need editing** — only the JSON.

## Precise field diffs (what the tests fail on today)

| Primitive | Spec field | Dummy value | Factory value (from current panels) | Status |
|---|---|---|---|---|
| `shelfPinPattern` | `system32.frontRowSetback` | 37 mm | **91.5 mm** (ORTA_BAK) | confirm front vs back separately |
| `shelfPinPattern` | `system32.backRowSetback` | 37 mm | **91.5 mm** (ORTA_BAK) | confirm |
| `rastex15Pattern` | `connectors.DUMMY_RASTEX_15.camSeat.fromMatingEdge` | 20 mm | **34 mm** (ORTA_BAK) | added field — confirm |
| `hingeCupPattern` | *all* | research estimates | **no data** | get a door export (no Ø35 holes exist) |

Field diffs are also printed live by `npm test` (the `[checklist]` diagnostic tests):

```
shelfPinPattern UNVERIFIED diffs:  op#0.y: generated=370 real=915 ; op#1.y: generated=4660 real=4115
rastex15Pattern cam UNVERIFIED diffs:  op#0.x: generated=5180 real=5040 ; op#1.x: generated=5180 real=5040
```

## Already matching the factory (proven green today — do NOT re-measure)

- Ø5 shelf-pin **diameter + depth (11 mm)** — confirmed against ORTA_BAK.
- Ø15 cam-seat **diameter + depth (12.5 mm)** — confirmed against ORTA_BAK edge-3 cams.
- Ø8 edge-dowel **diameter + depth (34 mm) + Z = thickness/2** — fully matches ORTA_BAK.

## Data to bring back (from `15_PRIMITIVES_STEP2.md`)

**Hinge — need a real door panel export (this cabinet had none):**
- Cup diameter, cup depth, cup centre distance from door edge (overlay "E").
- Mounting screw count, diameter, depth, spacing from cup centre.
- Actual SKU bought (Boyard B-35H? Blum CLIP top? Hettich?).

**Rastex/Minifix cam connector:**
- Which connector explains Ø15 **11 mm** vs **12.5 mm** holes (two depths seen).
- Cam-seat distance from mating edge (factory shows 34 mm — confirm).
- The exact SKU on the shelf / purchase list.

**System 32:**
- First-hole offset from edge (research says 37 — factory shelf rows show 91.5; confirm origin convention).
- Confirm 32 mm pitch and the front-row / back-row setbacks separately.

**Exports:** one door + one drawer + one corner cabinet from Bazis → golden fixtures 4–6.
