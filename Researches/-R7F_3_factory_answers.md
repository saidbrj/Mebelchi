# -rF_3 — Factory Answers (Constructor Abzal, 13 Jun 2026)

**Source:** WhatsApp Q&A with Abzal (constructor, Eman-class factory). Uzbek → engineering. These answer the four open engine questions from -rU_0_verdict §9 / -rU_1 §5.
**Status:** Constructor's stated practice. Each becomes `verified:true` for THIS factory once cross-checked against a real SWJ008 export (doc-15 flow). Other workshops differ — Abzal said so explicitly ("hamma har xil ishlatadi" / everyone does it differently). So these are **strong defaults, configurable**, not universal law.

---

## 1. Assembly convention (the M1 question — was critical)

> "Shkofni dnosini holasez orasiga, holasez tagiga qoyasiz — vaziyatga qarab. Tepasini ham o'zingizga qulay va yuk ko'tarish vaziyatiga qarab orasiga/tepasiga qo'ysa bo'ladi."

**Translation:** The bottom (dno) goes **sometimes between the sides, sometimes under the sides — depending on the situation.** The top (kryshka) likewise — between or on top, depending on convenience and **load**. Upper cabinets: same logic.

**Engineering verdict — this is the most important answer in the batch.** The constructor does NOT use one fixed convention. He chooses per cabinet based on load path. This confirms, at the source, doc-16's whole thesis: **joint/assembly choice is a function of context, not a constant.** Concretely:
- `assembly_convention` is **not** a single global setting (my earlier M1 assumption was too simple). It is a **per-carcass, per-horizontal-panel decision** with a load-aware default.
- Default rule to encode (then validate against his exports): high-load horizontals (bottom of a base cabinet carrying weight, any heavy-load shelf) → **between the sides** (panel bears on the sides in compression / dado — stronger). Low-load / top panels where convenient → **under or on top**. This is exactly a `jointResolver`-style rule: `panelPlacement(role, loadClass) → between | under | on_top`, cited to constructor practice.
- The UI consequence: this is an **engine default the user never sets by hand** in the normal flow; it surfaces only in the section-dive for the master who wants to override. Schoolboy never sees it.

→ doc 16: add `panel_placement` as a resolved decision alongside joint family. doc 15: bottom/top panel primitives need a placement parameter.

---

## 2. Saw kerf (was: 400%-error-adjacent guess in R-U7)

> "Arra qalinligi: katta arraniki (paketni) 4.4–4.7, kichik arraniki 3.3–3.5."

**Translation:** Kerf depends on saw: **large/beam saw (cuts a stack/packet) = 4.4–4.7mm; small saw = 3.3–3.5mm.**

**Verdict:** Confirms the R-U7 red-team correction that kerf is **machine-dependent and must be user-configurable** — the single 3.5 default would have been wrong for any shop running a beam saw. Encode:
- `kerf_mm` per workshop profile, with two presets: `beam_saw: 4.5` (mid of 4.4–4.7), `panel_saw: 3.4` (mid of 3.3–3.5). Default to panel_saw 3.4; the sheet counter and nesting use it.
- This directly feeds the `sheets = ...` formula in -rU_0 §M5. Wrong kerf = wrong sheet count = wrong margin.

→ materials_defaults.json: `kerf_presets`, workshop-selectable.

---

## 3. Back panel / ХДФ mounting (the back-groove question)

> "XDF har xil o'rnatiladi: 1) orqadan qotiriladi (nailed/screwed on back), 2) paz ochilib ichiga qotiriladi (into a groove). Pazlar ham har xil. Asosan: paz orqadan ichkariga **10mm**, paz kengligi **4mm**, paz chuqurligi **8mm gacha**. Biz shunaqa ishlatamiz, lekin hamma har xil."

**Translation — two mounting methods, groove method dimensions given:**
| Parameter | Value |
|---|---|
| Mounting method 1 | Overlay — fixed on the back (nailed/screwed) |
| Mounting method 2 | **Inset into a groove (paz)** — his default |
| Groove setback from rear edge | **10 mm** |
| Groove width | **4 mm** |
| Groove depth | **up to 8 mm** |

**Verdict:** This fully resolves M2 (back-panel cut formula) with real numbers. Combined with the 4mm ХДФ thickness (groove width 4mm ⇒ 4mm board):
- Back panel cut size (groove method): `width = cabinet_internal_width + 2×groove_depth`, `height = cabinet_internal_height + 2×groove_depth`, using **groove_depth ≤ 8mm** (use 8, validate against export). Setback 10mm from rear edge positions the groove.
- This is a **Type 4 saw groove** in SWJ008 terms — exactly the machining the SHKOF panels introduced and that the engine must round-trip (README known-gap). Abzal's numbers give the golden values to test Type-4 export against.
- `back_mount: groove | overlay` is a workshop default (his = groove), per-cabinet overridable.

→ doc 15: back-panel groove primitive — width 4, depth 8, setback 10, all `source: Abzal, verified:false`. doc 16/README: these become the Type-4 golden fixture acceptance values.

---

## 4. Eccentric / cam-dowel drill classes (the connectors_pilot ground truth)

Drill classes the factory actually uses — **diameter × depth**:

**Face / cam-seat side (the panel face):**
| Ø × depth | Likely meaning |
|---|---|
| 8 × 11 mm | dowel seat / cam variant |
| 5 × 11 mm | shelf-pin / minifix dowel |
| 5 × 9 mm | shelf-pin (shallower) |
| 10 × 11 mm | larger cam/fitting seat |
| **15 × 12.5 mm** | **cam housing (Minifix/Rastex Ø15)** |

**Edge / mating side:**
| Ø × depth | Meaning |
|---|---|
| 8 × 34 mm | dowel / cam-bolt into panel edge |

**Verdict — this is the ground truth `connectors_pilot.json` was waiting for.** Cross-check against the eye-transcribed GTV pilot (-rU pack, connectors_pilot.json):
- **Ø15 × 12.5** matches `WK-CAM-15-12-D` (cam height 12 + 0.5 clearance = 12.5 seat) — the pilot's flagged guess is **CONFIRMED by the factory**. The other guessed class (Ø15×11/13) is NOT in his main set → likely drop or keep as secondary.
- **Ø8 × 34 edge** = the standard cam-bolt/dowel edge bore — matches the `eccentric_bolts` length family.
- **Ø5 × 9 and Ø5 × 11** = the two shelf-pin depth classes (System-32 line holes) — confirms two pin depths, not one.
- **Ø8 × 11 face** and **Ø10 × 11** = additional seat classes to map to specific SKUs.

These six classes ARE the constructor's connector vocabulary (the doc-16 §1 "joint families" made concrete). The moment a real export arrives, `swj008_inventory.py` hole-class table should show **exactly these six** as the high-count rows — that's the parser-coverage checkpoint.

→ connectors_pilot.json: flip `Ø15×12.5` toward verified (pending export); add the 6-class table as the factory's confirmed drill vocabulary; these are the golden hole-classes for Type-1/2 coverage.

---

## 5. Edge banding (kromka)

> "Maslahatim 2mm ishlatmang, bu qimmatroq; 1mm ishlatsangiz ham bo'ladi. 0.4 va 0.6 ishlatsangiz ekonom bo'ladi."

**Translation:** His advice — **2mm is pricier; 1mm is fine; 0.4 and 0.6 are economical.** (Note: he reframed our 2mm-visible/0.4-hidden assumption — in this market 1mm visible is acceptable and common, 2mm is a premium choice, 0.4/0.6 for hidden/economy.)

**Verdict:** Edge-banding defaults are a **cost lever, not a fixed rule**. Encode as workshop profile:
- `edge_visible_mm`: options 0.4 / 0.6 / 1.0 / 2.0; market default **1.0** (not 2.0 — corrected by field).
- `edge_hidden_mm`: 0.4 default.
- Surfaces in the Материалы phase (per-role), affects price + the edge-meter total on the Facade Schedule / Passport.

---

## 6. Sheet sizes (feeds the sheet counter)

> ЛДСП (qaren list): **1830×2750, 1830×2500, 2070×2800** — asosan shular.
> Akril: **1220×2440** asosan; **1220×2750, 2070×2800** ham uchraydi.

**Verdict:** Confirms and extends the R-U7 sheet list with **local-actual** sizes. This is better than the research because it's the supply Tashkent actually buys.
- `sheet_sizes_ldsp`: [1830×2750, 1830×2500, 2070×2800] — primary set.
- `sheet_sizes_acrylic`: [1220×2440 primary, 1220×2750, 2070×2800].
- Material record carries its own sheet size (confirmed earlier from the imos material code `..._2800`); the sheet counter computes per-decor against the right sheet. Acrylic's small 1220 width materially changes nesting yield — the counter must use per-material sheet, never one global size.

→ materials_defaults.json: `sheet_sizes` per material class; nesting/counter reads the bound material's sheet.

---

## 7. Net engine impact (hand to Claude Code with the factory dump)

1. **doc 16:** `panel_placement(role, loadClass) → between|under|on_top` joins joint family as a resolved, load-aware decision (the §1 finding — the single most important one).
2. **doc 15 specs (all `source:Abzal, verified:false`):** back-groove (4w × 8d × 10 setback); bottom/top placement parameter; 6 eccentric drill classes; kerf presets; edge presets; per-material sheet sizes.
3. **README/goldens:** Abzal's numbers are the **Type-4 groove** and **Type-1/2 hole-class** golden acceptance values — the parser-coverage checkpoint when the dump lands.
4. **connectors_pilot.json:** Ø15×12.5 confirmed; 6-class vocabulary added.
5. Everything is a **workshop-configurable default**, because the constructor's own refrain was "hamma har xil ishlatadi." Configurability isn't a feature here — it's a documented market fact.

## Still open
- The assembly-convention default table (which load classes → between vs under) needs the real exports to calibrate the threshold — interview-confirm with Abzal only where the dump is ambiguous (doc-16 Source B discipline).
- Acrylic vs ЛДСП is a facade-material distinction → ties into the late-binding decor slot (F2), not carcass.
