# -rU_1 — imos iX Walkthrough (20 screenshots, annotated by founder)

**Date:** June 12, 2026
**Input:** Step-by-step imos iX kitchen build: room → profile wizard → unit placement → end panels → plinth/worktop/cornice via select-then-apply → cost table → LED variables → reports → in3D viewer → per-article exploded passport.
**Founder verdicts:** (1) "We need that kind of PDF — very detailed — this giving trust" (img 20); (2) "imos cons: material selection is boring — every time right-click and select among dozens."

---

## 1. What the walkthrough PROVES (cross-checked against R-U1/R-U2/R-U4)

**P1. Select-articles → apply is imos's group-operation backbone.** Plinth (09), worktop (10), fillers (11), cornice (12) are all: multi-select cabinets (blue) → pick a variant from catalog → entity spans the selection. Three independent sources now converge on the same pattern — the founder's strengthening-panels instinct, the R-U4 multi-select lock, and imos's production workflow. **The multi-select → apply group operation is now triple-confirmed as a core Ring-0/1 pattern.**

**P2. Continuous elements are first-class entities.** imos's profile wizard literally has a step named "Continguous Options"; worktop/plinth/cornice/skirting are entities that span articles. Validates and upgrades our span model: continuous elements own their relationship to the articles beneath (function map §2 gets explicit rows).

**P3. Type-first confirmed in production.** Placement happens with live numeric fields (343.73 / 2744.36 / 1481.27 in imgs 5–6); precision flows through typing, not dragging. L1 (type-first, drag-coarse) matches how the market leader actually works.

**P4. Multi-select as a BUTTON confirmed by imos itself.** Their own touch viewer (img 17) has a `Multiselect` toolbar toggle — plus Reset View, Part, Visibility, Explode. The R-U4 red-team correction (L2) is exactly what imos's mobile team already shipped.

**P5. The variables table (img 14) = our Construction Standard + overrides.** Families: Materials / Construction / Vertical_Panel / Sides / Lighting / Hinge_Side / Doors / **Connection_situation** / Base_Height_Adjusters / Back / Adjustable_Shelves — with default value vs article value columns. This is R-U2's 3-noun model in the wild, and `Connection_situation` is imos's name for what doc 16 calls the joint context. Naming cross-check for `jointResolver(ctx)` complete.

**P6. Profile wizard = materials as a phase, set once.** "1 Front and Carcase Materials → 2 Carcase internal options → 3 Continuous Options" at project start. Confirms our Материалы-as-phase lock. The pain comes later (see O1) — not from the profile, but from per-article changes.

**P7. Catalog taxonomy of 9** (img 3): Infills, Base units, Tall units, Wall units, Panels, Worktops, Plinth, Skirting, Cornice. Clean, adoptable skeleton for our section library's top level. Short-code search ("bfl", "b1d") = power-user retrieval; mobile translation = instant search + recents/favorites (R-U2 already locked).

**P8. Drill classes are labeled on drawings (D1/D2, img 16)** — the industry communicates in hole classes, exactly the vocabulary `swj008_inventory.py` mines. Material codes embed sheet length (`EG_ED_P2_H3349_ST19_18_2800` → Egger P2, decor H3349, ST19, 18mm, **2800 sheet**) — material records must carry their own sheet size; the ambient sheet counter computes per-decor with that decor's actual sheet. → doc 17 schema note.

---

## 2. What we STEAL

**S1. THE ARTICLE PASSPORT (img 20) — new priority output.** Per-cabinet sheet: exploded X-ray with leader lines → Parts table (name, L×W×THK×QTY) → Fittings table (hinges, plates, legs, screws with QTY) → edge & core material codes → weight → barcode → construction name → scale. The founder's words: *this gives trust.* For us it is nearly free: the engine's canonical model already contains panels, ops, and (post doc-16) fittings; weight = area × density (density already planned in materials catalog). Deliverables: «Паспорт изделия» per cabinet + project set, in Phase F and in the dealer pitch. **This is also the partnership sales weapon — a Bazis-grade document from a phone.**

**S2. The 9-category library taxonomy** (P7) as our top level: Секции (низ/верх/пенал), Заполнители, Панели, Столешницы, Цоколь, Плинтус, Карниз.

**S3. End-panel oversize parameters** (img 7): Panel Oversize Front 25 / Back 0 / Bottom 0 — how a fasad-flush end panel and floor-extension are expressed parametrically. → doc 15 panel primitive fields.

**S4. Auto-filler upgrade.** imos makes the user *search* for "bfl" manually. We detect the wall gap and *offer* the filler (smart default with override) — same capability, one decision fewer. Schoolboy test serviced.

**S5. Per-article cost/margin table at output** (img 13): cost vs SP vs VAT vs margin per article. Our quote output adopts per-article breakdown (master-facing), while the ambient price stays a single number.

**S6. Viewer verbs** (img 17): Reset View, Part isolate, Visibility (facades off — their "fasad-off" = our layers/X-ray), Explode. All already in our lens/dive plan; Explode joins the section-dive as the passport's interactive twin.

**S7. Parameter locking pattern** (img 7: password-locked Height). Industry precedent for role-gated parameters (brand/franchise protection). Low priority; note for dealer/factory tiers.

---

## 3. What we REJECT (their disease = our opening)

**O1. The material pain, diagnosed.** The founder's complaint is structural: imos has no select-many → change-material path in the main flow; material change = right-click → Modify article → configurator dialog → search among dozens (img 4/7), per article. **The irony: imos owns the perfect pattern (select-then-apply, P1) and never applied it to materials.** Our fix is already locked and now sharpened: global palette as a phase + per-section override through the SAME multi-select → apply gesture used for plinths. One pattern, everywhere.

**O2. The 20-item right-click menu** (img 8: Modify/Refresh/Copy/Move/Reinsert/Stretch/Variables/Select edges/parts/subassembly/article/planposition/Isolate/UCS/Clipboard/Measure/…) — every verb at equal distance, zero frequency hierarchy. The exact disease the frequency law exists to prevent. Note: their `Select edges → parts → subassembly → article` ladder is scope-switching solved as a menu; ours is the scope selector + pinch-dive.

**O3. Coded flat lists as the user-facing model** (BFL_720, B1D_720 trees, imgs 13/18). Codes belong in the order table and passport footer; the canvas IS the structure tree for our user.

**O4. Floating multi-window panels** — desktop-only; our library is the one summoned sheet.

---

## 4. Function map amendments (v0.2 → v0.21)

| §  | Change |
|---|---|
| §2-B | Multi-select → apply upgraded from "structure ops" to the universal group-operation pattern: materials, strengthening, plinth/worktop/cornice, hardware overrides — one gesture |
| §2-C | Library top level = the 9-category taxonomy (S2); auto-filler proposal on wall-gap detection (S4) |
| §2-E | Material records carry own sheet size (P8); per-article cost/margin in quote output (S5) |
| §2-F | `Connection_situation` adopted as cross-reference name in jointResolver ctx docs (P5) |
| §2-I | **NEW: Article Passport** per cabinet + project set — exploded view, parts, fittings, edges, weight, barcode (S1). Priority output, Phase F + dealer pitch |
| §3  | Continuous elements (worktop/plinth/cornice/skirting) = first-class span entities owning joints to articles below (P2); end-panel oversize F/B/Bottom parameters (S3) |

---

## 5. Still open (waiting on next field inputs)

F1 frequency film; factory answers (assembly convention, kerf, groove, 16/18, width grid); Bazis-side walkthrough if available — the same 20-step exercise in Базис-Шкаф would complete the incumbent picture from the constructor's seat, not the marketing video's.
