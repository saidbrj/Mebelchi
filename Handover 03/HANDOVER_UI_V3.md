# Mebelchi UI v3 — Handover to Saidislom

**Supersedes:** `HANDOVER_UI_V2.md`
**Companion docs:** `00_CJM_V1.md` (sacred pipeline), `10_UI_PRINCIPLES.md`, `UI_TYPES_V2.ts`, `Bazis_vs_Mebelchi.md`
**Owner:** Oppoq
**Date:** June 2026
**Sprint length:** 4 weeks (20 working days)

---

## What changed since v2

After 7 clusters of imos + 4 clusters of mobile-app research, three concrete model changes lock in:

1. **Plan My Kitchen flow is now the Phase A → B sequence.** Room → dimensions → constraints → **fixed-count variant generation** → swipe-confirm. Not algorithmic 3–5 variants; deliberately 4 every time.
2. **Moblo-style 3D direct manipulation is V1 baseline.** Not V1.5 deferred. Axis gizmo, parts hierarchy tree, snap toggles ship with Phase D.
3. **Multi-view selector ships V1.** User can switch between 3D iso, front elevation, top plan, side section, X-ray, nested cut layout. imos has dozens; we ship six and they're all useful.

Plus deliverable polish from Cabinetry-style apps (scroll-of-cards Phase F output) and the supplier-grade catalog vocabulary (RAL, decor SKUs alongside friendly names) from the dated Polyboard reference.

---

## 0. Hard scope rules

**Build the shell first, attach the engine second.** Phase F Step 25 (DXF export) calls into your existing engine on day 18; before day 18 it returns hardcoded mock files from your test fixtures. This separation is non-negotiable: Oppoq signs off on visual feel before logic attaches.

**Custom hardening panels are sacred.** Phase D Step 17 is the killer feature that makes Bazis dropouts switch. If anything else falls behind schedule, it stays in. Cut from advisor rules, drawer interior config, or Phase A constraints depth before cutting hardening panels.

**One bad drilling file ends the company.** Layer 1 atomic functions (`hingeDrillPattern`, `dowelPattern`, `eccentricCamPattern`, etc.) require their own test files with hand-calculated expected coordinates before they ship. No exceptions.

---

## 1. Tech stack — locked, unchanged

| Layer | Tool |
|---|---|
| Platform | Expo SDK 54 + RN 0.81 |
| Language | TypeScript 5.9 strict |
| 3D | three.js 0.184 + @react-three/fiber 9 + expo-gl 16 |
| State | Zustand 5 |
| Bottom sheets | @gorhom/bottom-sheet 5 |
| Gestures | react-native-gesture-handler 2 |
| Animation | react-native-reanimated 4 + react-native-worklets |
| 2D / SVG | react-native-svg 15 |
| Persistence | expo-sqlite 16 |
| PDF generation | expo-print |
| Haptics | expo-haptics |
| Routing | expo-router 6 |

---

## 2. Routes — six phase routes plus shell

```
/                                  splash → redirect
/home                              recent projects + new kitchen
/setup                             first-launch wizard
/settings                          shop config

/studio/[id]/phaseA                Discovery + measurement + constraints
/studio/[id]/phaseB                Layout (variant generation + swipe + confirm)
/studio/[id]/phaseC                Configuration (per-cabinet editing)
/studio/[id]/phaseD                Engineering (X-ray, hardware, hardening panels)
/studio/[id]/phaseE                Cost + advisor
/studio/[id]/phaseF                Lock + multi-view handoff
```

Phase transitions are visual events. Background warms in Phase B, cools in Phase D, becomes near-white in Phase F. The user feels they're moving from "customer-facing" → "workshop" → "professional handoff" without being told.

---

## 3. Phase A — Discovery & Measurement (3 days)

**Adopts Plan My Kitchen's onboarding sequence.** Three sub-screens, sequential.

### A.1 — Room shape (1 day)

Tappable strip across the top: **Прямая (linear) / Г-образная (L-shape) / П-образная (U-shape)**. V1 ships only "Прямая" working; L and U show "Скоро" badge and are unselectable.

Below: single illustration of a straight wall, no input yet.

Continue button at bottom: **"Дальше →"** (active immediately since linear is preselected).

### A.2 — Dimensions (1 day)

Top: large numeric input for **wall length** in mm. Default 2400. Tappable to bring up the numeric keypad. Snap to nearest 50mm on commit.

Below: large numeric input for **wall height** (the ceiling height where uppers will hang) — default 2600mm. Choices below as pill buttons: 2400 / 2500 / **2600** / 2700 / 3000.

Continue button: **"Дальше →"**.

### A.3 — Constraints capture (1 day)

Top-down wall strip rendered as horizontal SVG (full-width, ~120px tall). Marker palette below the strip showing 6 draggable icons:

- 🟡 Window (yellow rectangle marker)
- 🟠 Door (orange marker with swing arc)
- 🔴 Gas line (red point marker)
- 🔵 Drain stack (blue point marker)
- ⚪ Outlet (gray point marker)
- 🟣 Hood vent (purple point marker, only relevant if uppers will be there)

Drag a marker onto the strip → it snaps to 50mm grid → tap to set dimensions in a popover. Long-press to delete. Markers are optional; if none are added, variant generator falls back to "no constraints" rules.

Below: **"Создать варианты →"** primary button. Triggers variant generation, navigates to Phase B.

---

## 4. Phase B — Layout (3 days)

**Plan My Kitchen pattern.** Variant generator produces exactly 4 layouts. User swipes between them. Picks one. Confirms with the customer present.

### B.1 — Variant generator behavior

After Phase A submission, server-side (or local worker) generates 4 distinct layouts respecting Phase A constraints:
- Sink anchor must be within 800mm of drain-stack marker (if marker exists)
- Stove anchor must be within 1500mm of gas-line marker (if marker exists)
- No cabinet wider than 1000mm
- Sink not adjacent to stove (always at least one cabinet between them)
- Cabinets must avoid window/door X-position ranges

The 4 variants differ in:
1. **Standard layout** — sink center-ish, stove offset, single tall column for fridge
2. **With pantry** — same as 1 + tall pantry column
3. **Drawer-heavy** — more drawer stacks instead of door cabinets
4. **Compact** — for shorter walls, fewer items

If wall length is very short (<1500mm) or constraint-heavy, generator may produce only 3 variants. Always at least 2.

### B.2 — Swipe + dots interface

Familiar from your existing studio prototype. 4 dots at top showing position, horizontal swipe to cycle, variant name appears briefly on switch ("Стандартная" / "С пеналом" / "Ящики" / "Компактная").

Bottom: small pill showing "Стоимость: 12.4M сум" — real-time price even at this early phase. Tap the price to expand a quick breakdown.

### B.3 — Customer confirmation checkpoint

After variants are loaded, primary button bottom-right: **"Показать клиенту"**.

Tapping it:
1. UI chrome fades to 0 over 320ms
2. Camera does a slow hero parallax (continuous 8-second lerp loop)
3. Top-left "← Назад к редактированию" pill appears after 1s
4. Bottom-center **"Клиент согласен — продолжить"** pill appears after 3s

When customer says "yes" verbally and mebelchi taps the agreement button:
- Screenshot captured to project storage with timestamp
- Phase B marked complete
- Auto-navigate to `/studio/[id]/phaseC`

This screenshot is the audit trail for layout disputes weeks later. Mandatory.

---

## 5. Phase C — Configuration (3 days)

Phase B's editor with extra controls unlocked. Per-cabinet editing.

### C.1 — Two-surface selection model (adopted from Cabinetry pattern)

When a cabinet is tapped:

**Top toolbar (white pills):**
- ↔ Dimension
- 🎨 Color/Material
- ⚙ Properties (door style, handle, appliance)
- ✓ Done (black primary)

**Bottom 3×2 structural grid:**
| Move Left | Show Detail | Move Right |
|---|---|---|
| Add Left | Delete | Add Right |

Tap "Done" → both surfaces dismiss → return to overview state.

### C.2 — Dimension panel

Tap "Dimension" in top toolbar → opens modal sheet with:
- Cabinet width: numeric with −/+ at 50mm steps, range 300–1200mm
- Cabinet depth: numeric, default 560mm, range 300–650
- Cabinet height: locked at 820mm in V1 (uniform base cabinets)

### C.3 — Material picker

Tap "Color" → bottom sheet **"Материалы"** (adopted from Moblo pattern). Shows project-level palette:

```
⚪ Белая классика          [SKU: Egger W1000 ST9]    ⋮
⚪ Кашемир                 [SKU: Kronospan K001 PW]  ⋮
🟠 Дуб Lorenzo             [SKU: Egger H1334 ST9]    ⋮
⚪ Серый камень            [SKU: Kronospan K350 PE]  ⋮
🟫 Орех Hamilton           [SKU: Egger H3303 ST10]   ⋮
⚫ Антрацит                [SKU: Egger U899 ST9]     ⋮

[+ Добавить материал из каталога]
[+ Свой цвет RAL]
[🔄 Заменить всё]
```

Tap a material pill → assigns to selected cabinet. The "Заменить всё" button at the bottom is the Moblo "Replace all" pattern — applies the chosen material to every cabinet that currently has the same material.

V1 ships with 6 default palette entries. The "+ Добавить материал" button opens a supplier-catalog picker (V1.5 reads from the Imkon / Egger UZ / Kronospan UZ catalog; V1 ships with a fixed expanded list of ~20 decor SKUs).

The "+ Свой цвет RAL" button opens a RAL chooser (full RAL classic palette, scrollable list).

### C.4 — Properties panel

Tap "Properties" → modal sheet with accordions (adopted from Cabinetry pattern):

- ▾ Door Type
  - Hinge Position: Left / Right / Double (pill buttons)
  - Door Style: Flat / Shaker / Grooved (pill buttons)
- ▾ Handle Type
  - Bar / Knob / Inset (pill buttons)
- ▾ Drawers (only shown if cabinet has drawers)
  - Count: 2 / 3 / 4 (pill buttons)
  - Soft-close: Yes / No (toggle)
  - Deep bottom drawer: Yes / No (toggle)
- ▾ Appliance (only shown if cabinet is sink/stove/fridge/dishwasher type)
  - Sink: Single / Double / None (pill buttons)
  - Stove: Induction / Gas / None (pill buttons)
  - Dishwasher: 45cm / 60cm / None (pill buttons)
- ▾ Notes (PRO badge — V1.5 paywall feature)

### C.5 — Structural grid actions

**Move Left / Right** — swaps cabinet position with its neighbor in the layout. Animates over 320ms. Updates the linked Phase F drawings.

**Add Module Left / Right** — opens a small palette of cabinet types to insert; default insertion is a 600mm base cabinet. Variant index resets to "custom" (no longer "Стандартная" etc.) once user adds modules.

**Delete Module** — confirmation popover ("Удалить шкаф?" / Yes / Cancel), then removes and reflows neighbors.

**Show Detail** — opens Phase D for this specific cabinet (skip-link, allowed before reaching Phase D officially).

### C.6 — Phase C exit

Bottom bar primary button: **"К инженерии →"**. Navigates to Phase D.

---

## 6. Phase D — Engineering (6 days, the hardest phase)

**Moblo-style 3D direct manipulation is now V1 baseline.** This was V1.5 in the previous handover; promoted to V1 because the user wants it from the start.

### D.1 — The view selector (NEW, key feature)

**This is the imos-style multi-view selector.** Replaces the 3D/2D toggle from previous handover.

Top-right corner: a single pill button labeled **"3D Изо"** (default). Tap it → drops down a list of 6 views:

| Pill | View | Camera target |
|---|---|---|
| **3D Изо** | Isometric overview | (2.1, 1.55, 3.05) → (0, 0.65, -0.2) |
| **Фасад** | Front elevation (flat orthographic) | (0, 1.0, 4.5) → (0, 1.0, 0) |
| **План** | Top plan (top-down orthographic) | (0.01, 4.2, 0.6) → (0, 0, 0.6) |
| **Разрез** | Side section (typical section) | (4.5, 1.0, 0) → (0, 1.0, 0) |
| **Рентген** | X-ray (3D iso with facades at 35% opacity) | Same as 3D Изо |
| **Раскрой** | Nested cut layout (2D, sheets visible) | Auto-frame to fit nesting diagram |

Selecting a view triggers an animated camera tween (540ms easeOutCubic). Selection state and per-cabinet overrides survive view changes. View mode is part of project state and persists across sessions.

The 6 views map to the imos viewport modes — different views are useful for different decisions:
- **3D Изо** for showing the customer
- **Фасад** for door alignment, handle positioning
- **План** for cabinet ordering, anchor positions
- **Разрез** for height relationships, hood clearance
- **Рентген** for drilling spec, hardware placement, hardening panels
- **Раскрой** for sheet utilization, cut economy

### D.2 — Moblo-style 3D manipulation (NEW)

When a cabinet (or panel, or hardening element) is selected:

**Axis gizmo appears on the selected object:**
- 🟢 Green arrow (Y-axis, vertical) — move up/down
- 🔴 Red arrow (X-axis) — move left/right
- 🔵 Blue arrow (Z-axis) — move forward/back

Drag any arrow → constrains motion to that axis. Snap toggles (see D.3) control magnetic behavior.

For V1, gizmo is **only enabled for hardening panels and standalone elements** that the user has explicitly added. Standard cabinet positions are managed by the Phase C structural grid (Move Left/Right), not by free-form gizmo dragging. This prevents accidental dimensional chaos.

V1.5 will allow gizmo dragging on cabinets for advanced repositioning.

### D.3 — Snap toggles (NEW)

Floating action pill on left edge of screen (replaces the existing single redo/undo column). Shows 3 toggleable circular buttons (Moblo style, blue when active):

- 🧲 **Магнитные края** (Edge snap) — snap to edges of other parts, default ON
- ⊕ **Центрирование** (Center snap) — snap to centers, default OFF
- 🔄 **Шаг 15°** (15° rotation increments) — default ON

Toggles persist across the project.

### D.4 — Parts hierarchy bottom-sheet (NEW)

Bottom-left pull-up handle opens the parts tree (Moblo pattern). Bottom sheet at 60% screen height:

```
Детали                            [☰] [🔍] [▼]

▾ 📁 Sink Cabinet · 800mm
    ⚪ Левая стенка
    ⚪ Правая стенка
    ⚪ Дно
    ⚪ Задняя стенка
    🟠 Полка
    ⚫ Петля Blum × 4
    ⚫ Ручка
▾ 📁 Drawer Cabinet · 600mm
    ...
▾ 📁 Stove Cabinet · 800mm
    ...
```

Each row has material-color sphere (Moblo pattern), name, and right-side controls:
- 🎯 Focus camera on this part
- 🔓 Lock (prevents accidental edit)
- 👁 Visibility toggle (hide from view)
- ⋮ Overflow (Duplicate, Rename, Save as preset, Delete)

Tap any part name → camera focuses on it (animated 480ms tween) AND selects it AND opens the gizmo.

This is the only way to select internal panels (back, shelves) that aren't visible in default 3D. Without this, the mebelchi cannot place a hardening doubler on a hidden back panel.

### D.5 — Hardware override (existing from v2, refined)

Tap a cabinet → top toolbar shows "Hardware" pill. Tap it → bottom sheet with hardware override panel:

- Hinge brand: Blum / Hettich / Boyard (3 chips)
- Hinge overlay: Full / Half / Inset (3 chips)
- Drawer slide brand: Blum / Hettich / Boyard (if cabinet has drawers)
- Drawer slide length: 450mm / 500mm

V1 ships with **15 SKUs** (per Bazis teardown §5):
- 3 hinge brands × 2 overlay types = 6 hinges
- Boyard slim hinge (popular Tashkent specific) = 7 hinges total
- 2 slide brands × 2 lengths = 4 slides
- GTV basic slide = 5 slides total
- 3 shelf support styles

Changing any hardware updates drill marks in the X-ray view in real-time. The drilling-coordinate logic lives in Layer 1 primitives; UI just calls them.

### D.6 — Custom hardening panels (NON-NEGOTIABLE)

Top-right floating button: **"+ Усилитель"**. Tap to enter sketching mode.

Sketching mode:
1. All cabinets dim to 50% opacity. Instruction toast: "Выберите грань шкафа."
2. User taps a face → that face highlights blue, other faces dim further.
3. Axis gizmo appears on the highlighted face. User drags two corners (or types dimensions in popover).
4. Rectangle preview appears with snap toggles (D.3) active. Edge snap pulls to cabinet edges; center snap aligns to face center.
5. On release: popover with material picker (default ЛДСП 16mm, dropdown to override), joint type (Screws / Clamex / Cam-dowel — pill buttons), label (text input for master's personal naming).
6. Save → rectangle becomes a real hardening panel mesh. Cut list updates. Cost updates.

**Personal preset slots (5 total — promoted from 3 per Bazis teardown):**
Below the "+ Усилитель" button, five small numbered slots (1-5). Long-press any saved hardening panel → "Save as preset" → choose slot. Tap a preset slot → loads that preset's dimensions, material, joint into the next sketch.

This single feature is what makes Bazis-dropouts switch. The Tashkent master's craft identity. **If anything else slips in this sprint, this stays.**

### D.7 — Structural benchmark (V1 ships green-stub)

Every cabinet gets a small green dot in its top-right corner indicating "passed." No real physics in V1; the dot is purely visual placeholder until V1.5 ships beam-deflection math.

Bottom info area: "Все шкафы прошли проверку" status line.

### D.8 — Phase D exit

Bottom bar primary: **"К расчёту →"** — navigates to Phase E.

---

## 7. Phase E — Cost & Optimization (2 days)

### E.1 — Real-time breakdown panel

Top third of screen: full cost panel.

```
СТОИМОСТЬ КОМПЛЕКТА
12 480 000 сум

  ЛДСП 16мм             3.2 листа · 1 216 000
  Кромка ПВХ 2мм        94 м · 1 880 000
  Кромка ПВХ 0.4мм      62 м · 248 000
  Фурнитура Hettich     1 420 000
  Усилители             3 шт · 380 000
  Мойка + смеситель     850 000
  Плита индукционная    1 800 000
  Работа цеха           4 686 000

ЛИСТ ИСПОЛЬЗОВАН НА 87%
```

Each line tappable to expand sub-breakdown. The 3D scene shrinks into bottom 2/3, still interactive.

### E.2 — Smart material advisor

After 1.5s on Phase E load, yellow card slides in from below with the highest-impact tip:

```
💡 СОВЕТ
Сделайте фасады матовыми, а корпус — стандартным белым.
Экономия 340 000 сум.

[ Применить ]  [ × ]
```

V1 ships 5 advice rules (per Bazis teardown):
1. Two-tone split (facade vs carcass)
2. Skip 2mm kromka on hidden back edges
3. Use 16mm instead of 18mm for cabinets <800mm wide
4. Skip ЛДСП on back panel, use ДВП 3mm instead
5. Use 16mm not 18mm for inside non-load shelves

Tap "Применить" → state updates, breakdown refreshes, toast "Сэкономлено 340 000 сум".

### E.3 — Phase E exit

Bottom bar primary: **"К чертежам →"** — navigates to Phase F.

---

## 8. Phase F — Manufacture Handoff (3 days)

The CNC moment. Every interaction must build confidence.

### F.1 — Aesthetic shift

Background near-white (#fafaf7). Typography more rectilinear, Plex Mono prominent. Less rounded UI. This is the professional moment.

### F.2 — Multi-view deliverable scroll (NEW, Cabinetry pattern)

Replaces the single hero shot with a scrollable stack of deliverable cards. Each card is one auto-generated view:

```
ВАША КУХНЯ ГОТОВА                       [Save] [Send]

   [Hero 3D render — large card at top]

✓ ТОП ВИД · FLOOR PLAN                  [Modify]
   [Auto-generated top-down plan with dimensions]

✓ ФАСАД · ELEVATION                     [Modify]
   [Auto-generated front elevation, dashed-X doors]

✓ РАЗРЕЗ · SECTION                      [Modify]
   [Side section showing heights]

✓ РЕНТГЕН · X-RAY                       [Modify]
   [3D X-ray with drill marks visible]

✓ РАСКРОЙ · CUT LAYOUT                  [Modify]
   [Sheet nesting diagram, 87% utilization]

✓ КАРТА СВЕРЛЕНИЯ · DRILL MAP           [Modify]
   [Per-panel drilling spec, D1-D5 codes]
```

Each card has its own "Modify" affordance that drops the user back to the relevant phase to fix something. The "✓" indicator shows the card has passed its pre-flight check.

The "Карта сверления" card uses the imos D1–D5 drill code system: D1=Ø8×30 dowel, D2=Ø15×13.4 cam, D3=Ø8×34 through-dowel, D4=Ø8×12 edge dowel, D5=Ø5×9 shelf-pin.

### F.3 — Pre-flight checklist (7 items)

Bottom of scroll, before the export button: a 7-item checklist (promoted from 6 per Bazis teardown):

```
ПРОВЕРКА ПЕРЕД ЧПУ

✓ Все панели имеют размеры
✓ Все петли имеют точки сверления
✓ Использование листа 87% (минимум 75%)
✓ Все шкафы прошли benchmark
✓ Кромка указана для всех видимых краёв
✓ Все шкафы имеют кромку на видимых краях
✓ Клиент согласовал внешний вид (24 мая 2026, 14:32)
```

If any item is red, the export button below is disabled with tooltip explaining why.

### F.4 — Export ceremony

Below the checklist: large dark button **"ОТПРАВИТЬ НА ЧПУ"**.

When tapped:
1. Button shows spinner + "Проверка..." for 600ms
2. Spinner replaces with white checkmark, button becomes green for 300ms
3. Page transitions to F.5

### F.5 — Готово screen

Clean centered layout:

```
              ✓

   ГОТОВО · 8 ФАЙЛОВ СГЕНЕРИРОВАНЫ

      kitchen_2400.dxf
      kitchen_2400.mpr
      kitchen_2400.cix
      kitchen_2400_swj008.xml

   + 4 PDF документа
   (раскрой, сверление, кромка, сборка)

   [ Поделиться в Telegram ]  ← NEW (per Bazis teardown)
   [ Сохранить в папку ]
```

Below in small text:
```
Сгенерировано Mebelchi v1.0 · сборка 0612 · checksum: 7a3f9b21
```

Provenance footer per CJM Step 28. Builds professional trust.

### F.6 — Telegram share (NEW, per teardown)

Tapping "Поделиться в Telegram" opens the OS share sheet with all 8 files pre-attached. Mebelchi picks the workshop group chat or the customer's chat. **Every shared file is an ad for Mebelchi.**

---

## 9. Acceptance criteria

**Phase A:**
- [ ] Three-screen flow: room shape → dimensions → constraints
- [ ] Constraint markers draggable on wall strip
- [ ] State persists to SQLite across app restart

**Phase B:**
- [ ] Variant generator produces exactly 4 layouts (or 2–4 for edge cases)
- [ ] Variants respect Phase A constraints (sink near drain, stove near gas, no sink-stove adjacency)
- [ ] Customer confirmation creates screenshot with timestamp
- [ ] Going back from C → B clears confirmation with prompt

**Phase C:**
- [ ] Two-surface selection model works (top toolbar + bottom 3×2 grid)
- [ ] Material picker shows project palette with SKU codes
- [ ] Properties accordion uses pill-button option groups
- [ ] Move Left/Right reflows neighbors smoothly

**Phase D:**
- [ ] Multi-view selector switches between 6 views (3D iso, front, top, section, x-ray, cut layout)
- [ ] Camera tween between views = 540ms ± 30ms
- [ ] Axis gizmo appears on hardening panel selection
- [ ] Snap toggles visible, persistent, functional
- [ ] Parts hierarchy bottom-sheet shows full tree
- [ ] Hardware brand change updates drill marks in real-time
- [ ] Custom hardening panel sketching works end-to-end
- [ ] 5 personal preset slots save/load correctly

**Phase E:**
- [ ] Cost breakdown shows 8+ line items
- [ ] Advisor card appears after 1.5s with 1 of 5 rules
- [ ] Applying advisor tip updates state and breakdown

**Phase F:**
- [ ] Scrollable card stack with 6+ deliverable views
- [ ] Pre-flight checklist computes 7 items correctly
- [ ] Export button disabled if any check fails
- [ ] Готово screen shows 8 file names and provenance footer
- [ ] Telegram share opens OS share sheet with all files

**Global:**
- [ ] Cold start < 2s on mid-range Android
- [ ] All Russian text renders correctly
- [ ] Demo runs end-to-end in < 8 minutes
- [ ] No phase-skipping (D requires B confirmation)

---

## 10. Timeline (20 working days)

| Day | Work |
|---|---|
| 1 | Splash, Home, Setup, Settings, Zustand store v3, design tokens (warm/cool/pro per phase) |
| 2–4 | Phase A: 3-screen flow (room shape, dimensions, constraints) |
| 5–7 | Phase B: variant generator (server or worker), swipe, customer confirmation |
| 8–10 | Phase C: two-surface selection, material picker with SKUs, properties accordion |
| 11–16 | Phase D: view selector (6 modes), parts hierarchy, axis gizmo, snap toggles, hardware override, **custom hardening panels (most important)** |
| 17–18 | Phase E: cost breakdown, advisor card with 5 rules |
| 19–20 | Phase F: deliverable scroll, pre-flight checklist, export ceremony, Telegram share. Wire to existing export engine. Polish. Demo rehearsal. |

Buffer is in Phase D days 11–16. If Phase D takes 7 days, take it from day 20 polish. **Do not cut Phase D scope.**

---

## 11. Updates to companion docs that this handover triggers

These are required updates to other sacred documents that this handover assumes:

**`10_UI_PRINCIPLES.md`:**
- §3 (interaction inversion): add §3a clause for two-surface selection model (top toolbar + bottom grid co-existing)
- §4 (atomic verbs): add "Show Detail" as 10th verb
- §5 (NFS camera): add the 6 view targets (3D iso, front, top, section, x-ray, cut layout) with their camera positions and tween durations
- §9 (hard "no" list): remove "color picker UI" prohibition (RAL palette is allowed as discrete swatch grid); keep continuous color picker forbidden
- New §12: Snap & Manipulation Contract (snap toggles, gizmo behavior, axis conventions)

**`00_CJM_V1.md`:**
- Step 1 (room geometry): expand to three sub-steps per Plan My Kitchen flow
- Step 5 (template swipe): lock at exactly 4 variants
- Step 13 (material palette): expand from 6 friendly names to 6 names + SKU codes + RAL fallback
- Step 17 (custom hardening): 5 preset slots, gizmo-based sketching
- Step 22 (smart advisor): 5 rules total
- Step 24 (pre-flight checklist): 7 items
- New Step 30.5: Telegram share ceremony

**`UI_TYPES_V2.ts`:**
- Add `ViewMode = '3d_iso' | 'front' | 'top' | 'section' | 'xray' | 'cut_layout'` (replaces existing 3-value enum)
- Add `SnapConfig` interface (edgeSnap, centerSnap, rotationStep)
- Add `GizmoState` interface (axis, dragOrigin, dragTarget)
- Extend `HardeningPanelPreset` slot range from 1-3 to 1-5
- Add `AdvisorRuleId` two more values: `skip_back_ldsp` and `thinner_internal_shelves`
- Add `ChecklistItemId` value: `kromka_on_visible_edges`

---

## 12. Demo script (8 minutes)

Setup: new project, mock customer "ул. Чиланзар 14, кв. 23".

1. **Phase A (45s):** Pick "Прямая". Wall 2400mm, height 2600mm. Drop window marker at 800–1400mm, gas line at 1800mm. Mention: "Софт учтёт окно и газ при размещении."

2. **Phase B (90s):** 4 variants generated, respecting constraints. Show that sink stays away from window, stove near gas. Swipe through 4. Pick variant 2. Tap "Показать клиенту" — chrome fades, parallax starts. "Это уже как реальная 3D-визуализация для клиента." Tap "Клиент согласен".

3. **Phase C (90s):** Tap a cabinet. Top toolbar appears with Dimension/Color/Properties, bottom 3×2 structural grid. Open Color → show palette with SKU codes. Pick walnut for this cabinet only. Tap a different cabinet, keep white. Tap Properties → cycle door style. Tap Move Right → neighbors reflow.

4. **Phase D (180s — the centerpiece):** Tap view selector → cycle through 6 views (3D, фасад, план, разрез). Show how each view reveals different information. Switch to Рентген. Tap a door → hinge override sheet. Change Hettich → Blum → drill marks update visibly. Tap "+ Усилитель". Tap rear face of sink cabinet. Drag rectangle. Material popover. Save. Show preset slot saving for next time. **This is unique. No other mobile app does this.**

5. **Phase E (45s):** Switch back to 3D Изо. Show cost breakdown. Tap ЛДСП line → expand. Advisor card appears: "Экономия 340K". Tap Применить → price drops.

6. **Phase F (90s):** Scroll through 6 deliverable cards (top, elevation, section, x-ray, cut layout, drill map). Show pre-flight checklist all green. Tap "ОТПРАВИТЬ НА ЧПУ". Spinner. Checkmark. Готово screen with 8 file names. Tap "Поделиться в Telegram" — show OS share sheet.

7. **Close (30s):** "В Базисе на это уходит 4 часа на десктопе. У нас — 8 минут на телефоне. С полным CNC-выходом."

---

## 13. What Saidislom can push back on

Five questions allowed. Everything else: build to spec.

1. **Variant generator placement:** runs on device (WebWorker) or server-side? Default: device. Push back if computation is heavy enough to block UI.
2. **Multi-view selector:** drop-down list (Plan My Kitchen pattern) or segmented control (cleaner but less view names)? Default: drop-down with labels.
3. **Axis gizmo on tall column cabinets:** does dragging the Y-axis affect upper and lower halves together or separately? Default: together (single object).
4. **Parts hierarchy:** when a parent group is selected, do its children show selected too? Default: only parent selected; children remain inactive.
5. **Phase F file count:** 8 files (DXF + MPR + CIX + SWJ008 + 4 PDFs) — is the SWJ008 V1 or V1.5? Default: V1 if your existing engine supports it; V1.5 otherwise.

---

## 14. The point of this sprint, restated

Mebelchi V1 is a 6-phase mobile pipeline that takes a Tashkent mebelchi from "customer called" to "DXF on the CNC" in under 30 minutes total work time, with output quality equal to imos/Bazis at 1/200th the licensing cost.

The mobile patterns from Plan My Kitchen + Moblo + Cabinetry + supplier RAL apps prove this combination is buildable and feels right. The engineering depth from imos proves the output is professional. The Bazis teardown proves the differentiation is durable.

Build the shell first. Attach the engine second. Don't cut hardening panels.

— Oppoq
