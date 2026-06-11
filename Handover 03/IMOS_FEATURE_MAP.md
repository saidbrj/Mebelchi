# IMOS Feature Map — Engineering Primitives for Mebelchi V1

**Purpose:** Map every imos iX feature observed across 3 research clusters to the 7-layer Mebelchi architecture, with explicit V1 / V1.5 / V2 / Never decisions per primitive. This is the reference Saidislom and future engineers use when scoping engine work.

**Status:** Working document. Update as new imos research surfaces.
**Source clusters:** 3 imos clusters covering Article Designer (editing UI), 3D/render output, and CNC manufacturing output.
**Companion docs:** `11_ENGINE_ARCHITECTURE.md` (layer definitions), `UI_PATTERN_LIBRARY.md` (interaction patterns), `Bazis_vs_Mebelchi.md` (competitive context).
**Date:** June 2026
**Owner:** Oppoq

---

## How to read this document

Each imos primitive is labeled by cluster (A/B/C), mapped to one or more architecture layers (L0–L7), graded for V1 scope, and given a one-sentence "why" for the decision. The right-hand "implementation note" column points to specific files/modules in Saidislom's codebase where the work lands.

**Layer reference (from `11_ENGINE_ARCHITECTURE.md`):**
- L0 — JSON catalogs (materials, hardware, panel roles, templates)
- L1 — Drilling primitive functions (small pure functions, hand-tested)
- L2 — Parametric solver (rule engine + collision check)
- L3 — Custom layer (user-authored panels, signature reinforcements)
- L4 — Universal model (Part/CutLayout/Project locked contracts)
- L5 — Post-processors (per-format output modules)
- L6 — Solver-to-screen bridge (`useProject`, `useSolverResult`)
- L7 — UI screens (template-and-tweak Phase A–F)

**Scope reference:**
- 🔴 **V1** — Cannot ship without it. 4-week sprint includes it.
- 🟡 **V1.5** — V1 if budget allows; otherwise V1.5 (next quarter).
- 🟢 **V2** — Documented, deferred to second product version.
- ⚫ **Never** — Documented as deliberately rejected, with reason.

---

## Cluster A — Article Designer (editing UI primitives)

These primitives describe how imos lets the user *author* a furniture article.

### A1 — Construction Principle (CP) as packaged recipe

**What it is:** Each part type (door, side, shelf, partition) references a Construction Principle code like `CP_SDO_H_PM_FD` (Single Door Overlay, Horizontal, Position Middle, Full Depth). The CP carries the complete recipe — hinge type, hinge count rule, drilling pattern, edge banding, joint scheme.

**Layer:** L0 catalog (`construction_principles.catalog.json`) + L2 solver (CP resolution).

**Scope:** 🔴 **V1.** This is the spine of the parametric engine. Saidislom's existing engine likely has equivalent logic but possibly not as catalog references.

**Implementation note:** Extend the existing template system to use CP codes as catalog keys. Example V1 CP codes:
- `CP_DOOR_FLAT_FO_L` — flat door, full overlay, left hinge
- `CP_DOOR_SHAKER_FO_R` — shaker door, full overlay, right hinge
- `CP_DRAWER_3STACK_SC` — 3-drawer stack, soft-close
- `CP_PARTITION_DOWEL_CAM` — partition with dowel+cam joinery
- `CP_SHELF_PIN_5MM` — shelf on Ø5mm pin supports

Ship V1 with ~8 CPs. V1.5 expands to ~20. V2 to ~50.

---

### A2 — Zone Division as parametric rule

**What it is:** A partition isn't a panel you drag in — it's a rule that subdivides a parent zone. Definition types include "Perpendicular" (90° split) and "Linear" (1:1:1 ratio for three equal zones). The rule has a reference edge.

**Layer:** L2 solver (`zoneDivision()` function).

**Scope:** 🟡 **V1.5.** V1 ships fixed templates with predefined partitions. V1.5 introduces user-controlled zone division for "split this cabinet into 2 equal sections" without manually computing mm.

**Implementation note:** New file `src/lib/solver/zoneDivision.ts`. Input: parent zone bounds + ratio + reference edge. Output: array of child zones. Used by Phase C structural grid actions.

---

### A3 — Variant Family with formulas

**What it is:** Parameters live in a tree structure (Family → Construction → Connectors → Connection_situation). Variables can carry formulas like `Handle_Position_DRW_X = ($DRW/2)mm` — "place handle at half the drawer width along X." Numeric variables (`Drill_Distance = 160`), text variables (`Handle_Type = Hale_160_Ss_9070796`), and computed variables.

**Layer:** L0 catalog (variables file) + L2 solver (formula evaluation).

**Scope:** 🟡 **V1.5.** V1 ships hardcoded defaults for these parameters. V1.5 exposes a variables panel for power users.

**Implementation note:** When V1.5 ships, add a simple expression evaluator that supports `+`, `-`, `*`, `/`, and variable references (`$DRW`, `$CAB_W`, `$CAB_H`). No conditionals in V1.5; those wait for V2.

---

### A4 — Catalog Reference as string variables

**What it is:** Variables like `Handle_Type` are string keys pointing into the catalog. Changing `Handle_Type` from `Hale_160_Ss_9070796` to `Handle_Recessed_Square` swaps the handle across the article and the drilling pattern recomputes from the new catalog entry.

**Layer:** L0 catalog + L2 solver.

**Scope:** 🔴 **V1.** This is the architecture pattern Saidislom's hardware catalog already uses (the 114-item catalog with manufacturer codes). Lock it explicitly.

**Implementation note:** In `hardware.catalog.json`, every entry must have a unique SKU code (e.g., `BlumCLIP_Top_110_FullOverlay`). UI state references the code, not the object. L2 solver resolves the code via catalog lookup at solve time.

---

### A5 — Construction Principle inheritance with per-side override

**What it is:** Every part inherits from a CP, and the variant database lets you override per side, per zone. For example: `C1_Bottom = Dowel_CAM` default, but `C1_Top` overridden to `Confirmat` for the specific cabinet you're editing.

**Layer:** L2 solver (override resolution).

**Scope:** 🟡 **V1.5.** V1 ships CP defaults only, no overrides. V1.5 adds per-cabinet override panel.

**Implementation note:** Override storage in project: `overrides: Record<CabinetId, Record<ConnectionSide, JointType>>`. Solver checks overrides before CP defaults.

---

## Cluster B — 3D / Render output

These primitives describe how imos visualizes and presents the article.

### B6 — X-ray render with drill marks as 3D geometry

**What it is:** Standard visual mode showing facade at ~35% opacity, internal structure solid, drilling points rendered as red dotted lines along edges (hinge cup positions, shelf-pin columns). Cam-lock receivers as small circles.

**Layer:** L7 (Phase D X-ray view) reading from L4 universal model.

**Scope:** 🔴 **V1.** This IS Phase D's centerpiece. Mebelchi's X-ray view must render drill marks visibly as 3D mesh dots (not as overlay UI).

**Implementation note:** When in X-ray view mode, three.js scene rebuilds facades with `transparent: true, opacity: 0.35`. Drill marks render as `SphereGeometry` with red emissive material at the operation coordinates. Read coordinates from L1 primitive outputs.

---

### B7 — Auto-generated assembly PDF

**What it is:** One A3 sheet with: parts table (left, every panel with NCNO/name/L×W×T/qty), fittings table (right, every hardware item with manufacturer code and quantity), exploded view (center, leader lines pointing to part names), title block (bottom-right with date/scale/article name/imos logo), mini-render (bottom-left for reference).

**Layer:** L5 new post-processor (`exportAssemblyPDF.ts`).

**Scope:** 🔴 **V1.** Phase F deliverable card "Карта сборки." This is the workshop-floor handoff document.

**Implementation note:** Use `expo-print` to generate PDF from HTML template. Template has fixed regions; data filled from L4 model + L2 solver results. Scale auto-computed to fit on A3.

---

### B8 — Fittings naming with manufacturer prefixes

**What it is:** Every fitting in imos has a code with a manufacturer prefix:
- `GS_` = Grass (drawer slides, drawer systems)
- `ha_` = Häfele (heavy/structural hardware)
- `he_` = Häfele (lighter hardware)
- `L_` = Left-handed variant prefix
- `Aboa_` = brand-specific leg manufacturer
- `Rastex_` = Häfele iconic product line (no manufacturer prefix because it's iconic)

**Layer:** L0 `hardware.catalog.json` SKU field.

**Scope:** 🔴 **V1.** Adopt this naming convention directly. Saidislom's existing catalog already uses manufacturer codes; verify the naming follows this prefix pattern.

**Implementation note:** Update catalog entries to add `manufacturer_prefix` field. Examples:
- `BLU_CLIP_TOP_110_FO_71B3550` (Blum CLIP top BLUMOTION, 110° opening, full overlay, model 71B3550)
- `HET_INTERMAT_9956_FO` (Hettich Intermat 9956, full overlay)
- `GTV_4PR_500_SC` (GTV 4PR slide, 500mm, soft-close)

---

### B9 — Joint counting (pair-matching)

**What it is:** imos's parts table shows `Rastex_15_18 × 34` AND `Dowel_Twister × 34` — exactly matching because each cam-lock joint is one Rastex (cam housing) + one Twister (anti-rotation dowel). Plus 84 additional 8×40mm dowels for non-cam joints.

**Layer:** L2 solver (joint resolution + counting).

**Scope:** 🔴 **V1.** Saidislom's existing engine likely does this; verify the joint pairing logic is correct for V1's 5 joint types (dowel, cam-dowel, confirmat, clamex, screw).

**Implementation note:** `jointResolver(partA, partB)` returns a `JointType`. `quantityCounter(jointType, partA, partB)` returns `{rastex: 1, twister: 1, dowels: 2}` for a typical cam-lock corner. Sum across all joints for the fittings table.

---

### B10 — Mode-based workspace (Designer/Drawing/Output/Presentation/Support)

**What it is:** imos has six workspaces, each with its own ribbon, totaling ~60 tool surfaces in the UI.

**Layer:** L7.

**Scope:** ⚫ **Never.** This is the architectural anti-pattern Mebelchi explicitly inverts. Your `10_UI_PRINCIPLES.md` §4 (nine atomic verbs) is the deliberate opposite. Don't build modes; build phases.

**Implementation note:** None. Documented as rejected.

---

### B11 — Non-90° construction (angled legs, chamfered cabinets)

**What it is:** imos's media unit example has mid-century angled legs at non-90°. The CP system handles this; the solver computes positions trigonometrically.

**Layer:** L1 + L2.

**Scope:** 🟢 **V2.** V1 ships rectilinear-only. Tashkent kitchens are 95% rectilinear; the 5% that aren't can be hand-finished.

**Implementation note:** When V2 ships, extend the L1 primitives to accept a rotation transform. L2 solver needs to handle non-90° corner joinery, which is significantly harder.

---

### B12 — Parametric cascade ("change variable, everything updates")

**What it is:** imos's marketing slogan: "Alter materials, fittings, finishes, hardware and dimensions parametrically." Change one variable → solver re-runs → all dependent geometry updates.

**Layer:** L6 (`useSolverResult` hook).

**Scope:** 🔴 **V1.** This is the central UX promise. Saidislom's existing engine does this; UI just needs to call `useSolverResult` and subscribe to changes.

**Implementation note:** Zustand state holds project + variant + overrides. Selector runs through L2 solver, returns Parts array. R3F scene reads Parts and rebuilds geometry on every change. Cache aggressively.

---

## Cluster C — Manufacturing output

These primitives describe how imos produces CNC-ready outputs.

### C13 — Order/project metadata wrapper

**What it is:** Top-level "Order" with name, owner, responsible user, site (multi-location), customer data, document manager, barcode settings, calculation flag, part-pictures flag, iX Share status.

**Layer:** New L8 if we build it (order management layer). Currently outside the 7-layer architecture.

**Scope:** 🟢 **V3.** Mebelchi V1/V1.5/V2 has one mebelchi per shop, one project at a time. The full order management wrapper (multi-site, multi-user, customer database, barcode labels) is V3 when the workshop grows beyond single-mebelchi operation.

**Implementation note:** Document the deferred scope in `00_README.md`. The `currentProjectId` field in the existing Zustand store is sufficient for V1.

---

### C14 — Per-panel CNC drawing with origin marker

**What it is:** Each panel gets a one-page drawing with: origin marker (hatched circle at bottom-left = 0,0 reference), edge profile codes (`0_PRF_00` on each edge), drilling positions labeled (D1, D2, D3, etc.), dimensions in mm, scale notation (1:16), title block with date/material/finish.

**Layer:** L5 new post-processor (`exportPanelPDF.ts`).

**Scope:** 🔴 **V1.** Phase F deliverable card "Карта сверления." Goes to the CNC operator.

**Implementation note:** One PDF per unique panel (deduplicated by dimensions + drilling pattern). Each PDF is one A4 page. Use the same expo-print pipeline as the assembly PDF.

---

### C15 — Edge banding spec on every edge of every panel

**What it is:** Edge codes like `0.3_iX_MEL_WHITE_03mm_M` encode: 0.3mm dimensional allowance, iX catalog reference, Melamine White 0.3mm Matte. Every edge of every panel has one of these (or `0_PRF_00` for unbanded edges).

**Layer:** L0 (`kromka.catalog.json`) + L2 solver (per-edge resolution).

**Scope:** 🔴 **V1.** Already in `00_CJM_V1.md` Step 18 and `06_CONVENTIONS.md`.

**Implementation note:** Add `kromka.catalog.json` with V1 SKUs:
- `MEL_WHITE_2MM` (visible 2mm white melamine, the default for facade-color edges)
- `MEL_WHITE_04MM` (hidden 0.4mm white, default for carcass-color edges)
- `MEL_OAK_2MM` (oak-color 2mm for wood-decor cabinets)
- `MEL_GRAPHITE_2MM` (graphite 2mm for dark-decor cabinets)

L2 solver assigns one of these per edge based on the smart-default rule from CJM Step 18.

---

### C16 — Sheet nesting layout with grain-direction respect

**What it is:** Nesting algorithm produces a 2D layout of all panels on stock sheets. For wood-decor materials, panels can't rotate 90° because the grain would mismatch — the algorithm respects grain direction.

**Layer:** L5 (`exportNestingPDF.ts`) + L2 solver (grain constraint).

**Scope:** 🔴 **V1** (simple, rectangle-pack). 🟡 **V1.5** (with grain-direction respect for wood decors).

**Implementation note:** V1 nesting algorithm: bin-packing with rotation allowed for non-directional materials. Output is one PDF per sheet with all parts laid out and drilling marks visible per panel. Sheet utilization computed (87% target). V1.5 adds grain-direction respect by passing the material's `has_grain` flag and disallowing 90° rotation.

---

### C17 — B_SOLID CAM simulation (third safety gate)

**What it is:** Biesse B_SOLID is the CAM verification software that reads .cix files and shows tool paths (red lines extending up from drill positions, yellow cutting outlines). The CNC operator uses it to verify before cutting.

**Layer:** External tool, not built by Mebelchi.

**Scope:** 🔴 **V1.** Mebelchi's CIX output must be B_SOLID-compatible. **Verify this once before V1 ships** by running Saidislom's existing CIX exporter through B_SOLID with a test panel.

**Implementation note:** Document the test in `09_QA_PLAYBOOK.md`: "Before any V1 release: run kitchen_2400.cix through Biesse B_SOLID demo, confirm all 42+ operations parse without errors." If errors occur, fix in `exportCIX.ts` before release.

---

### C18 — Drill code vocabulary D1–D5

**What it is:** Five named drill operations with diameter+depth catalog. Every drill operation in the panel drawings references one of these codes:
- **D1** — Ø8mm × 30mm depth (face dowel hole for 8×40mm dowels)
- **D2** — Ø15mm × 13.4mm depth (Rastex 15/18 cam housing)
- **D3** — Ø8mm × 34mm depth (through-dowel for deeper joints)
- **D4** — Ø8mm × 12mm depth (edge dowel hole)
- **D5** — Ø5mm × 9mm depth (shelf-pin hole, 5mm system)

**Layer:** L1 `Operation` schema field.

**Scope:** 🔴 **V1.** Adopt directly.

**Implementation note:** Update `Operation` type in `UI_TYPES_V2.ts` to include `code: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8'`. L1 primitive functions return operations with codes. L5 post-processors group operations by code in the drawing output.

V1.5 adds:
- **D6** — Ø35mm × 13mm depth (hinge cup, the Blum/Hettich standard)
- **D7** — Ø7mm × 50mm depth (confirmat screw shaft)
- **D8** — Ø10mm × 5mm depth (confirmat screw head countersink)

---

### C19 — Blind vs through drilling encoded via depth

**What it is:** In imos, if depth > panel thickness, the drill goes all the way through. D3 = 34mm depth in an 18mm panel = through-hole. This is intentional, not a bug.

**Layer:** L1 + L2 (collision check).

**Scope:** 🔴 **V1.**

**Implementation note:** L2 `collisionCheck()` must NOT reject operations where `operation.depth > panel.thickness`. Instead, mark them as "through" operations and verify they don't collide with adjacent parts that the drill would exit into.

---

### C20 — Material naming convention `iX_PB18_MEL_White_M`

**What it is:** Material codes follow the pattern: `iX_PB18_MEL_White_M` = imos catalog reference, 18mm Particleboard, Melamine surface, White color, Matte finish.

**Layer:** L0 `materials.catalog.json` SKU field.

**Scope:** 🔴 **V1.** Adopt similar structure.

**Implementation note:** Mebelchi material SKU convention: `MEB_LDSP{thickness}_{decor_code}_{finish}`. Examples:
- `MEB_LDSP16_WhiteClassic_Smooth`
- `MEB_LDSP18_OakHamilton_Textured`
- `MEB_MDF18_Anthracite_Matte`

Plus parallel mapping to supplier SKUs:
- Imkon: `Imkon_ЛДСП16_БЕЛ_Гл`
- Egger UZ: `Egger_W1000_ST9`
- Kronospan UZ: `Kronospan_K001_PW`

Both shown in UI: friendly name as headline, supplier SKU as subhead, internal code in catalog only.

---

### C21 — Per-panel weight calculation

**What it is:** imos calculates panel weight from dimensions × material density. The example media unit's "Fixed shelf" weighs 11.703kg.

**Layer:** L2 solver.

**Scope:** 🟡 **V1.5.** Useful for delivery cost calculation and structural benchmark. Not critical for V1.

**Implementation note:** Add `density_kg_per_m3` field to `materials.catalog.json` (ЛДСП ≈ 680, MDF ≈ 720, HDF ≈ 850). `panelWeight(part) = part.volume_m3 * material.density_kg_per_m3`.

---

### C22 — Surface top / surface bottom separate specs

**What it is:** Each panel can have different surface finishes on top vs bottom. Important for shelves where one side is visible (top, melamine) and one isn't (bottom, raw or different color).

**Layer:** L0 + L2.

**Scope:** 🟡 **V1.5.** V1 ships single-surface (top and bottom both finished). V1.5 exposes the dual-surface option for shelves and worktop bottoms.

**Implementation note:** Extend `Part` type to include `surface_top` and `surface_bottom` separately. UI exposes the override only for shelf and worktop part types (not for sides, where dual-surface is structurally implied).

---

### C23 — Scale notation on every drawing

**What it is:** imos prints "Scale 1:16" or "1:33.9" on every auto-generated drawing. Standard CAD convention.

**Layer:** L5 PDF templates.

**Scope:** 🔴 **V1.**

**Implementation note:** PDF generator auto-computes scale to fit the drawing on the page, then renders the scale notation in the title block. Use the format "1:XX.X" (one decimal).

---

### C24 — Multi-orthographic views per part

**What it is:** Each per-panel drawing shows the part from multiple angles: face view (with drill positions), edge view (showing edge profile), other-edge view (showing other edge profile).

**Layer:** L5 PDF templates.

**Scope:** 🔴 **V1.**

**Implementation note:** Standard "first-angle projection" CAD layout: face view top-left, top edge above, side edge to the right. Use SVG to render and inline into the PDF.

---

### C25 — Grain text engraving as named CNC operation (`GRAINTXT`)

**What it is:** B_SOLID shows `GRAINTXT (Linear text)` as an operation in the machining tree — text engraving on the panel for grain-direction marking (so the assembler knows which way to orient the panel).

**Layer:** L1 + L5.

**Scope:** 🟡 **V1.5.** Useful when wood decors ship (V1.5). Not relevant for white-melamine V1.

**Implementation note:** When a panel uses a wood-decor material (`has_grain: true`), add a `GRAINTXT` operation to its operation list. Position it at the bottom-left corner, oriented along the grain direction. Text content: "GRAIN →" or "В". L5 CIX exporter emits this as a text engraving operation.

---

## The 25 primitives — quick scope table

| # | Primitive | Layer | V1 / V1.5 / V2 / Never |
|---|---|---|---|
| A1 | Construction Principle as packaged recipe | L0 + L2 | 🔴 V1 |
| A2 | Zone Division as parametric rule | L2 | 🟡 V1.5 |
| A3 | Variant Family with formulas | L0 + L2 | 🟡 V1.5 |
| A4 | Catalog Reference string variables | L0 + L2 | 🔴 V1 |
| A5 | CP inheritance with per-side override | L2 | 🟡 V1.5 |
| B6 | X-ray render with drill marks as 3D | L7 | 🔴 V1 |
| B7 | Auto-generated assembly PDF | L5 | 🔴 V1 |
| B8 | Fittings naming with manufacturer prefixes | L0 | 🔴 V1 |
| B9 | Joint counting (pair-matching) | L2 | 🔴 V1 |
| B10 | Mode-based workspace | L7 | ⚫ Never |
| B11 | Non-90° construction | L1 + L2 | 🟢 V2 |
| B12 | Parametric cascade | L6 | 🔴 V1 |
| C13 | Order/project metadata wrapper | L8 | 🟢 V3 |
| C14 | Per-panel CNC drawing | L5 | 🔴 V1 |
| C15 | Edge banding spec per edge | L0 + L2 | 🔴 V1 |
| C16 | Sheet nesting with grain respect | L5 + L2 | 🔴 V1 (simple), 🟡 V1.5 (grain) |
| C17 | B_SOLID CAM simulation compatibility | External | 🔴 V1 (verify only) |
| C18 | Drill code vocabulary D1–D5 | L1 | 🔴 V1 |
| C19 | Blind vs through drilling via depth | L1 + L2 | 🔴 V1 |
| C20 | Material naming convention | L0 | 🔴 V1 |
| C21 | Per-panel weight calculation | L2 | 🟡 V1.5 |
| C22 | Surface top/bottom separate specs | L0 + L2 | 🟡 V1.5 |
| C23 | Scale notation on drawings | L5 | 🔴 V1 |
| C24 | Multi-orthographic views per part | L5 | 🔴 V1 |
| C25 | Grain text engraving operation | L1 + L5 | 🟡 V1.5 |

**V1 count: 15 primitives. V1.5: 8. V2/V3: 2. Never: 1.**

---

## What this gives you

When Saidislom asks "should I build X?" — look up X in this table. If it's V1, build it now per the implementation note. If it's V1.5, document it as deferred but don't build. If it's Never, push back on the request.

When an investor asks "are you imos-equivalent?" — answer: "We ship 15 of imos's 25 core engineering primitives in V1. The 10 we defer are documented and scoped. Our differentiator is not feature count; it's mobile-first delivery at $10/month vs imos at $5,000+/seat."

When a Tashkent mebelchi asks "can you do X that Bazis does?" — look up the imos equivalent here. Most Bazis features map to one of these 25. If it's V1, demo it. If it's V1.5, promise the date. If it's V2/V3, explain why deferred.

This document is the engineering source-of-truth. Update it when new imos research surfaces.

---

## Open questions

1. **The 8 CPs for V1 — are these the right 8?** Validate with factory friend: which door styles, drawer configs, partition types do Tashkent mebelchi actually need on day 1?

2. **Drill code D6/D7/D8 — V1 or V1.5?** D6 (hinge cup) is arguably V1 because every kitchen has hinges. But it's a more complex tool (35mm Forstner bit) than D1–D5. Decision pending Saidislom's existing engine support.

3. **CIX vs SWJ008 vs MPR — which is primary for V1?** All three target different CNC brands. Existing engine supports DXF, MPR, CIX. SWJ008 (Excitech/KDT) is the most common in Tashkent per the breakthrough research. Decision: V1 ships all four; primary target is SWJ008 for the demo CNC.

4. **The 20-decor SKU catalog for V1 — sourced from which suppliers?** Imkon Group, Egger UZ, Kronospan UZ each have their own catalogs. V1 needs at least one supplier confirmed as a partnership before the SKU codes lock.

These four block V1.1 finalization, not V1 demo.
