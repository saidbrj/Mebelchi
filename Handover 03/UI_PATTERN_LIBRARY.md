# UI Pattern Library — Mobile Interaction Patterns for Mebelchi V1

**Purpose:** Catalog every interaction pattern observed across 4 mobile app research clusters, with explicit adoption decisions and concrete implementation notes for Saidislom. The companion document to `IMOS_FEATURE_MAP.md` — where that catalogs engineering depth, this catalogs interaction polish.

**Status:** Working document. Update as new app research surfaces.
**Source apps:** Plan My Kitchen (Phase A/B onboarding model), Kitchen Editor Line (CAD-on-mobile, the negative example), Cabinetry-style (modern minimalist deliverable polish), Polyboard-style (RAL palette + supplier catalogs), Moblo (3D direct manipulation primitives).
**Companion docs:** `10_UI_PRINCIPLES.md` (sacred principles), `HANDOVER_UI_V3.md` (current build brief), `IMOS_FEATURE_MAP.md` (engine primitives).
**Date:** June 2026
**Owner:** Oppoq

---

## How to read this document

Each pattern is named, sourced, mapped to one of the 6 phases in `00_CJM_V1.md`, and given a clear adoption verdict.

**Adoption levels:**
- 🟢 **Claim** — Adopt into V1, as specified in `HANDOVER_UI_V3.md`.
- 🟡 **Claim partial** — Adopt the concept, modify for Mebelchi constraints.
- 🔴 **Reject** — Do not build. Reason explained.
- 📋 **Defer** — Document for V1.5 or later.

**Phase reference (from `00_CJM_V1.md`):**
- Phase A — Discovery & Measurement
- Phase B — Layout
- Phase C — Configuration
- Phase D — Engineering
- Phase E — Cost & Optimization
- Phase F — Manufacture Handoff

---

## Patterns from Plan My Kitchen (the Phase A/B onboarding model)

Plan My Kitchen's strength: it converts "design a kitchen" from a 4-hour task to a 3-screen onboarding. Room shape → dimensions → constraints → 4 generated variants → 3-view drawings. This is the foundation of Mebelchi's Phase A/B.

### P1 — Sequential 3-screen onboarding for Phase A

**What it is:** Three sub-screens in fixed order: (A.1) Room shape selector (linear / L / U), (A.2) Wall dimensions, (A.3) Constraints capture. Each screen has one focus, big primary "Дальше →" button, no skip-ahead.

**Source:** Plan My Kitchen.

**Phase:** A.

**Adoption:** 🟢 **Claim.** This is the schoolboy-test foundation. The user can't get lost because there's nothing to choose besides what's on screen.

**Implementation note:** Three routes under `/studio/[id]/phaseA`: `phaseA/shape`, `phaseA/dimensions`, `phaseA/constraints`. Each is a separate screen with its own continue button. Going back is allowed via OS back gesture. State persists per-screen on transition.

---

### P2 — Fixed-count variant generation (always 4)

**What it is:** After Phase A submission, exactly 4 layout variants are generated and shown as a swipeable carousel. Not "as many as we computed" — deliberately 4. (Plan My Kitchen always shows 4.)

**Source:** Plan My Kitchen.

**Phase:** B.

**Adoption:** 🟢 **Claim** (locked decision from this thread).

**Implementation note:** Variant generator produces 4 outputs by design. If wall is short or constraints are heavy, it produces fewer (minimum 2). Never more than 4. The 4 archetypes (per `HANDOVER_UI_V3.md` §4.1):
1. Standard
2. With pantry
3. Drawer-heavy
4. Compact (for shorter walls)

Each is labeled at the top of the swipe state ("Стандартная" / "С пеналом" / "Ящики" / "Компактная").

---

### P3 — Multi-card 3-view deliverable scroll

**What it is:** After Phase B confirmation, the user lands on a deliverable screen with a scroll of cards: top view, front elevation, typical section. Each card has its own "Modify" button.

**Source:** Plan My Kitchen, Cabinetry-style.

**Phase:** F (and Phase B confirmation).

**Adoption:** 🟢 **Claim** (expanded to 6 cards per `HANDOVER_UI_V3.md` §8.2).

**Implementation note:** Six cards in Phase F: 3D iso, top view, front elevation, side section, X-ray, cut layout. Each card renders a fixed-camera screenshot of the project. "Modify" on each card jumps to the relevant phase.

---

### P4 — Mobile floor plan capture with corner drag handles

**What it is:** Tap a wall corner → it turns blue with circular drag handles → drag to resize. Auto-dimensions appear in blue alongside the dragged edge.

**Source:** Magicplan/Planoplan-style (referenced in Plan My Kitchen context).

**Phase:** A.

**Adoption:** 📋 **Defer to V1.5.** V1 ships linear walls only (single numeric input for length). L-shape and U-shape rooms with corner drag come in V1.5.

**Implementation note:** When V1.5 ships, use react-native-svg for the floor plan canvas. Corner handles are 44px touch targets (Apple HIG minimum). Snap to 50mm grid on drag. Show dimensions in blue at edge midpoints.

---

## Patterns from Cabinetry-style modern apps

These apps demonstrate that mobile-grade UX and CAD-grade vocabulary can coexist.

### P5 — Two-surface selection model (top toolbar + bottom grid)

**What it is:** When a cabinet is selected, two contextual surfaces appear simultaneously:
- Top toolbar (white pills): property edits (Dimension, Color, Properties, Done)
- Bottom 3×2 grid (blue outline): structural edits (Move L/R, Show Detail, Add L/R, Delete)

Both surfaces dismiss when "Done" is tapped or selection is cleared.

**Source:** Cabinetry-style modern app.

**Phase:** C.

**Adoption:** 🟢 **Claim.** Replaces the single selection-pill from `HANDOVER_UI_V2.md`.

**Implementation note:** Two separate React components: `<PropertyToolbar>` rendered as a floating top overlay, `<StructuralGrid>` rendered as a bottom sheet at 40% screen height. Both subscribe to `selectedCabinetId` in Zustand and mount/dismount together.

---

### P6 — Pill-button option groups inside accordion

**What it is:** Instead of dropdowns (`<select>`), discrete options are rendered as pill buttons in a row when count ≤4. Selected pill is white-filled with stronger shadow; unselected are gray-tinted. One tap to change.

**Source:** Cabinetry-style.

**Phase:** C, D.

**Adoption:** 🟢 **Claim.** This becomes the V1 default for any choice with ≤4 options.

**Implementation note:** New component `<PillButtonGroup>`. Props: `options: string[]`, `selected: string`, `onChange: (option: string) => void`. Used for: Hinge Position (Left/Right/Double), Door Style (Flat/Shaker/Grooved), Drawer Count (2/3/4), Sink Type (Single/Double/None), etc.

---

### P7 — Architectural detail catalog as scrollable cards

**What it is:** Scrollable list of detail cards (Shadow Gap, Upper Cabinet Extension, Kickboard, Worktop Thickness, etc.). Each card shows a CAD-style diagram with labeled dimensions + edit inputs.

**Source:** Cabinetry-style.

**Phase:** D (under "Show Detail" entry from Phase C).

**Adoption:** 🟡 **Claim partial.** V1 ships 4 detail cards (Shadow Gap, Kickboard, Worktop Thickness, Door Extension). V1.5 expands to 12.

**Implementation note:** Each card is a sub-route under `/studio/[id]/phaseD/details/[type]`. Card content: SVG diagram (static), labeled dimensions in blue, numeric inputs below for editing, "?" help icon for definition popover.

---

### P8 — Full-screen detail dialog with paginated dots

**What it is:** Tap a detail card → opens a full-screen dialog with paginated sub-pages (3 dots at bottom). First page shows the primary spec; subsequent pages show related details.

**Source:** Cabinetry-style.

**Phase:** D.

**Adoption:** 📋 **Defer to V1.5.** V1 keeps details as single-card screens; V1.5 adds the paginated multi-page detail dialog.

---

### P9 — Persistent "Modify design" floating pill

**What it is:** Bottom-center floating button (black pill with pencil icon, "Modify design" label) persists across all deliverable cards in Phase F. Always visible, never covered.

**Source:** Cabinetry-style.

**Phase:** F.

**Adoption:** 🟢 **Claim.**

**Implementation note:** Renders as a fixed-position component above the scroll view. Tapping it opens a phase-selection sheet ("Back to A / B / C / D / E"). Used for late-stage edits without scrolling back through the deliverable scroll.

---

### P10 — Help icons next to CAD terminology

**What it is:** Every CAD term in the UI ("Shadow Gap", "Kromka", "Confirmat") has a "?" icon next to it. Tapping opens a small popover with definition + diagram.

**Source:** Cabinetry-style.

**Phase:** All phases.

**Adoption:** 🟢 **Claim.** This is how Mebelchi handles vocabulary literacy across senior/junior mebelchi.

**Implementation note:** New component `<HelpIcon term="kromka" />`. Maps to `helpText.catalog.json` with Russian + Uzbek-Latin definitions per term. Definitions written by Oppoq + factory-friend technologist (factory friend's technologist holds the deep Bazis/CNC expertise to validate). Initial list of terms to define: kromka, prisadka, raskroy, sex, mebelchi, confirmat, dowel, rastex, twister, shadow gap, kickboard, extension, цоколь, плинтус.

---

## Patterns from Moblo (3D direct manipulation primitives)

Moblo proves desktop-CAD interaction primitives translate cleanly to mobile.

### P11 — 3-arrow XYZ axis gizmo on selected object

**What it is:** When an object is selected, a 3-axis gizmo (red X, green Y, blue Z arrows) appears on it. Drag an arrow to constrain motion to that axis.

**Source:** Moblo (also SketchUp, Fusion 360, Blender — universal CAD primitive).

**Phase:** D.

**Adoption:** 🟢 **Claim** (V1, promoted from V1.5 per locked decision).

**Implementation note:** Three.js implementation: parent group containing three `ArrowHelper` meshes (red, green, blue) attached to the selected object's transform. Touch handler: detect which arrow is dragged via raycaster, then constrain `object.position[axis] += dragDelta`. Color convention is universal CAD: red=X, green=Y, blue=Z. Do not invert.

V1 scope: gizmo enabled only for hardening panels (Phase D Step 17). V1.5 extends to cabinet repositioning. Standard cabinet placement in Phase C uses the structural grid (Move L/R), not the gizmo.

---

### P12 — Snap toggles as visible floating action buttons

**What it is:** Edge snap, center snap, rotation increment — each is a one-tap toggle visible on the screen, not buried in settings. Blue circle = active.

**Source:** Moblo.

**Phase:** D.

**Adoption:** 🟢 **Claim** (V1, per locked decision).

**Implementation note:** Three circular toggle buttons in a vertical column on the left edge of the Phase D screen. Default states: edge snap ON, center snap OFF, rotation 15° increments ON. State persists in Zustand and survives session.

The snap behavior must be implemented in the gizmo drag handler: on every drag tick, query edge/center positions of nearby parts and snap the dragged position if within threshold (e.g., 5mm at current zoom level).

---

### P13 — Parts hierarchy as bottom-sheet tree

**What it is:** Pull-up bottom sheet showing the full parts tree (Drawer, Cabinet, Handle, Cube1, etc.) with material-color spheres next to each name. Indentation shows hierarchy. Each row has lock, hide, focus, and overflow controls.

**Source:** Moblo (and imos `iX Elements` from Cluster A).

**Phase:** D.

**Adoption:** 🟢 **Claim** (V1, per locked decision).

**Implementation note:** Bottom sheet at 60% screen height (`@gorhom/bottom-sheet`). Tree rendered with `FlatList` for performance (kitchens may have 100+ parts). Each row: indent + material-color sphere (rendered as a small canvas with the part's material applied) + part name + right-side action icons.

Tap part name → camera tweens to focus on that part + selection gets the gizmo. Tap material sphere → opens material picker scoped to that part.

This is the only way to select internal panels (back, shelves, hardening doublers) that aren't visible in default 3D.

---

### P14 — Project-level material palette with per-part assignment

**What it is:** Project has a defined palette (e.g., 4 named materials: "Drawer shiny", "White 1", "Plywood", "Aluminum"). Parts are assigned to materials by reference. A "Replace all" affordance bulk-assigns one material to every part currently using a specific other material.

**Source:** Moblo (and imos's Variant Family `Catalog Reference` pattern).

**Phase:** C, D.

**Adoption:** 🟢 **Claim** (V1).

**Implementation note:** Already represented in `UI_TYPES_V2.ts`. The UI to *manage the project palette* is what needs building: a Materials sheet in Phase C with add/rename/delete affordances.

Each material in the project palette references a SKU from L0 `materials.catalog.json`. Project state stores the project-local material name + the catalog SKU.

---

### P15 — Group/part overflow menu (Lock/Hide/Duplicate/Rename/Save As/Delete/Detach)

**What it is:** Right-side overflow menu (⋮) on each tree row opens a 7-action popover.

**Source:** Moblo.

**Phase:** D.

**Adoption:** 🟡 **Claim partial.** V1 ships 5 actions: Hide, Show (toggle), Lock/Unlock (toggle), Save as hardening preset, Delete. V1.5 adds Duplicate, Rename, Detach (ungroup), Save as project template.

**Implementation note:** Use the popover pattern from `@gorhom/bottom-sheet` or RN's `ActionSheet`. Show only V1 actions; V1.5 actions can be marked as "PRO" badges to validate demand before building.

---

### P16 — Demo-mode "your changes won't be saved" banner

**What it is:** Orange banner across the top of the screen: "Пример проекта: ваши изменения не будут сохранены" — lets first-time users explore a complete example before signing up.

**Source:** Moblo.

**Phase:** All phases, when in demo mode.

**Adoption:** 🟢 **Claim** (V1 for onboarding).

**Implementation note:** When a user opens the app for the first time without an account, route them into a "demo project" — a finished example kitchen with all phases pre-filled. The banner persists across all screens until signup. Tapping the banner opens the signup prompt.

The demo kitchen should be a real Tashkent example (3000mm wall, walnut + white, Hettich hardware, ЛДСП 16mm Imkon, full DXF/MPR/CIX ready to export). Builds credibility — they see the full pipeline working.

---

## Patterns from Polyboard-style (the negative example with hidden depth)

The dated CAD-on-mobile app from Cluster 1 looks like a toy but exposes serious vocabulary the modern apps hide.

### P17 — RAL color codes as first-class material option

**What it is:** A toggle "Color RAL / Texture" lets the user switch between named decor textures (Oak Lorenzo, Oak Hamilton) and RAL color codes (RAL1020, RAL1023, RAL1026). The RAL palette is the full RAL Classic set, scrollable.

**Source:** Polyboard-style.

**Phase:** C (material picker).

**Adoption:** 🟢 **Claim** (V1).

**Implementation note:** Material picker sheet has a sub-toggle: "Декор / RAL". Default tab is Декор (the 6 named palette entries + 14 supplier SKUs). Switching to RAL shows the full RAL Classic palette as a scrollable grid of swatches with codes.

When a RAL code is selected, the cabinet's material becomes a custom entry: "RAL 1023 — Транспортный жёлтый." This is stored as a project-level material with the RAL code as the SKU.

Painted RAL surfaces have different cost calculation than melamine (typically 2–3× per m²). The cost engine must distinguish.

---

### P18 — Decor names with manufacturer designations

**What it is:** Wood decor names are not generic ("Light Oak") but manufacturer-specific (Oak Lorenzo, Oak Hamilton, Wood Natur). These map to Egger/Kronospan/Pfleiderer decor catalogs.

**Source:** Polyboard-style.

**Phase:** C.

**Adoption:** 🟢 **Claim** (V1).

**Implementation note:** V1 catalog includes ~20 named decors with their actual manufacturer SKUs. Examples already in `HANDOVER_UI_V3.md` §5.3:
- Белая классика → Egger W1000 ST9
- Кашемир → Kronospan K001 PW
- Дуб Lorenzo → Egger H1334 ST9
- Орех Hamilton → Egger H3303 ST10

The friendly Russian name is the headline; the supplier SKU is the subhead. Both shown in the UI.

---

## The 18 patterns — quick scope table

| # | Pattern | Phase | Adoption |
|---|---|---|---|
| P1 | Sequential 3-screen onboarding | A | 🟢 Claim |
| P2 | Fixed-count variant generation (4) | B | 🟢 Claim |
| P3 | Multi-card deliverable scroll | F | 🟢 Claim (6 cards) |
| P4 | Floor plan corner drag handles | A | 📋 Defer V1.5 |
| P5 | Two-surface selection model | C | 🟢 Claim |
| P6 | Pill-button option groups | C, D | 🟢 Claim |
| P7 | Architectural detail card catalog | D | 🟡 Claim 4 cards V1, 12 V1.5 |
| P8 | Full-screen paginated detail dialog | D | 📋 Defer V1.5 |
| P9 | Persistent "Modify design" pill | F | 🟢 Claim |
| P10 | Help icons next to CAD terms | All | 🟢 Claim |
| P11 | 3-arrow XYZ gizmo | D | 🟢 Claim |
| P12 | Snap toggles visible floating | D | 🟢 Claim |
| P13 | Parts hierarchy bottom-sheet | D | 🟢 Claim |
| P14 | Project material palette + Replace all | C, D | 🟢 Claim |
| P15 | Group/part overflow menu | D | 🟡 Claim 5 actions V1 |
| P16 | Demo-mode banner | All | 🟢 Claim |
| P17 | RAL color codes first-class | C | 🟢 Claim |
| P18 | Decor names with manufacturer SKUs | C | 🟢 Claim |

**V1 count: 15 patterns full + 2 partial. V1.5: 3 (2 deferred + 1 partial extension). Rejected: 0.**

---

## What this gives you

When Saidislom asks "how should I implement X interaction?" — look up X in this table. The implementation note has specifics. The source app reference lets him look at the original for visual reference.

When a Tashkent mebelchi says "Bazis lets me do X gesture; can yours?" — look up the closest pattern here. If V1 claims it, demo it. If V1.5, promise the date.

When you (Oppoq) are reviewing Saidislom's work-in-progress and something feels off, this is the appeal court. "P5 says two-surface selection model — this one-surface selection violates the contract."

---

## What's NOT in this library (and why)

A few patterns from the source apps that we deliberately did not adopt, beyond P10 (the imos mode-based workspace already in IMOS_FEATURE_MAP B10):

- **Kitchen Editor Line's drag-and-drop cabinet palette from the side panel.** Rejected because it's the desktop-CAD-shrunk-to-mobile anti-pattern. Mebelchi uses templates + variants + structural grid; cabinets aren't dragged from a palette.

- **Plan My Kitchen's "PRO" paywall on Notes feature.** Rejected for V1 because Mebelchi shouldn't paywall basic features. Notes is a V1.5 freemium consideration but only if it's a power-user feature that justifies the upsell — not a basic affordance.

- **Cabinetry's tile-on-tile cabinet rendering** (where cabinets look like flat 2D icons in some views). Rejected because Mebelchi's 3D engine is real-3D throughout; we don't drop to 2D icons except in the "Раскрой" (cut layout) view, which is intentionally schematic.

- **Moblo's "Add shape" primitive** (drop a cube/cylinder/sphere onto the canvas). Rejected because Mebelchi's mental model is template-and-tweak, not free-form modeling. The user never starts from a blank canvas; they always start from a generated variant.

- **Polyboard-style cabinet thumbnails in left-side scrolling palette.** Same reason as Kitchen Editor Line rejection.

---

## Open questions

1. **Snap thresholds in mm** — what's the snap distance threshold at typical zoom? Default 5mm but might need tuning. Test with factory-friend during V1 field validation.

2. **Demo mode kitchen content** — should it be a real Tashkent example (3000mm linear) or aspirational (3500mm with L-shape pantry)? Default: real. Aspirational hurts onboarding by setting expectations the V1 product can't meet.

3. **RAL palette scope for V1** — full RAL Classic (213 codes) or curated subset (~30 most common in kitchens)? Curated is faster to scroll but limits power users. Default: full RAL Classic; sort by popularity in cabinets.

4. **Help-text catalog content** — Oppoq writes the Russian; who writes the Uzbek-Latin? Default: factory-friend's technologist with Oppoq's review.

These four block V1 polish, not V1 demo.
