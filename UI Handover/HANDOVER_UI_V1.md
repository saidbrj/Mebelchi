# Mebelchi UI v1 — Handover to Saidislom

**Audience:** Saidislom
**Sprint goal:** Build a fully functional UI shell in our real stack with mocked logic, suitable for live demos and investor meetings within 5–7 working days.
**Owner:** Oppoq
**Status:** Greenlit. Build directly against this brief.

---

## 0. What this is, what this isn't

**This is** the visible app — every screen, every tap, every animation. Wired to mock data, not to real geometry or real DXF export. The point is: a person picks up the phone, taps a kitchen, plays with cabinets, sees prices change, sees the camera fly around — and walks away believing this is a real product.

**This is not:**
- The DXF generator
- The cutting optimizer
- The drilling engine
- The hardware catalog logic
- The SQLite persistence layer
- Authentication
- Backend / sync

All of those exist in your existing codebase already. This sprint **only** builds the UI shell that will eventually call into them. Right now: hardcoded mock returns and visual feedback only.

**Hard rule:** Do not start integrating the export pipeline, the drilling engine, or any business logic into this UI until Oppoq has signed off on the visual feel. The whole point is to lock the experience first, then attach the engine.

---

## 1. Tech stack — already confirmed

| Layer | Tool | Notes |
|---|---|---|
| Platform | Expo SDK 54 + RN 0.81 | Existing |
| Language | TypeScript 5.9 strict | Existing |
| 3D | three.js 0.184 + @react-three/fiber 9 | Existing |
| 3D bridge | expo-gl 16 | Existing |
| State | Zustand 5 | Existing |
| Bottom sheets | @gorhom/bottom-sheet 5 | Existing |
| Gestures | react-native-gesture-handler 2 | Existing |
| Animation | react-native-reanimated 4 | Existing |
| Icons | @expo/vector-icons + Material Symbols Sharp | Existing |
| Routing | expo-router 6 | Existing |
| SVG (for 2D plan view) | react-native-svg 15 | Existing |
| Haptics | expo-haptics | Add if not already in |

**Nothing new to install.** Everything is already in the stack.

---

## 2. The 7 screens we're shipping

| # | Screen | Route | State |
|---|---|---|---|
| 1 | Splash / brand intro | `/` (auto-redirects) | Static, 800ms then routes to /home |
| 2 | Home (recent projects + new kitchen CTA) | `/home` | List of mock projects from store |
| 3 | Setup wizard | `/setup` | Shown once on first launch; saves to AsyncStorage flag |
| 4 | **Studio** — the main editor | `/studio/[projectId]` | All editor interactions live here |
| 5 | Material palette drawer | bottom sheet on studio | Triggered from studio |
| 6 | Quote / lock screen | `/studio/[projectId]/lock` | Final view with hero camera |
| 7 | Settings | `/settings` | Shop name, default supplier, language toggle (RU / UZ) |

The **Studio** screen is 80% of the work. Get it right; the others are formalities.

---

## 3. The Studio screen — full spec

This is the heart of the app. Build it carefully.

### 3.1 Layout (always-on persistent chrome)

```
┌──────────────────────────────────────────┐
│  MEBELCHI STUDIO            3D / 2D       │ ← header (logo · toggle)
│                                           │
│       [1500 мм]      Стоимость: 7 337 500 │ ← wall pill · price block
│                                           │
│         · · ●  (variant dots)             │
│                                           │
│       ⚠ Раковина рядом с плитой  (if any) │
│                                           │
│                                           │
│         [   3D KITCHEN CANVAS   ]         │ ← R3F Canvas, fills viewport
│                                           │
│                                           │
│      [Floating selection pill, if any]    │ ← appears on cabinet select
│                                           │
│                                           │
│  [материал ▾]  [Сохранить]  [Вариант 3/3] │ ← bottom bar
└──────────────────────────────────────────┘
```

**Five persistent UI elements only:**
1. The 3D canvas
2. The wall length pill (top-center)
3. The price block (top-right)
4. The bottom bar (material button · save button · variant counter)
5. The 3D / 2D toggle (top-right corner above price)

**No sidebar. No menu. No tool palette. No tabs.** Anything else appears contextually and dismisses.

### 3.2 The 9 atomic gestures — implement exactly these, no others

| # | Gesture | Target | Action |
|---|---|---|---|
| 1 | **Single tap** | Cabinet body | Selects cabinet → camera tweens to it → selection pill rises |
| 2 | **Single tap** | Selected cabinet's door | Cycles door style: flat → shaker → grooved |
| 3 | **Single tap** | Selected cabinet's handle | Cycles handle: bar → knob → inset |
| 4 | **Single tap** | Worktop | Cycles worktop material (5 options) |
| 5 | **Single tap** | Sink basin | Cycles sink: single → double → none |
| 6 | **Single tap** | Stove top | Cycles stove: induction → gas → none |
| 7 | **Single tap** | Empty floor / background | Deselects → camera tweens to overview |
| 8 | **Horizontal swipe** | Anywhere on canvas (when no cabinet selected) | Cycles to next/prev variant |
| 9 | **Tap wall pill** | Header | Cycles wall size: 1200 → 1500 → 1800 → 2100 → 2400 → 2700 → 3000 mm |

**Reserved for V2 (do not implement now):** pinch-zoom on cabinets, long-press for material drawer scoped to one cabinet, drag-to-move cabinets. We have them in our research, but they're scope creep for this sprint.

### 3.3 Selection pill — exact behavior

When a cabinet is selected:

- **Slides up** from below the bottom bar with 280ms `cubic-bezier(0.2, 0.9, 0.3, 1)` easing
- **Contains:**
  - Cabinet name + size: `МОЙКА · 800 мм`
  - Close button (×) at top-right
  - Width row: `[ − ] 600 мм [ + ]` — large tappable, ±50mm per press
  - Divider
  - Section label: `Цвет фасада`
  - 6 mini-swatches in a horizontal grid (one per material from the global palette)
  - Hint line below: small italic text `tap door · tap handle · tap worktop · tap sink · tap stove`

- **Swatch tap behavior:**
  - Triggers per-cabinet material override (not global)
  - Direct three.js material color mutation: `mat.color.setHex(...)` — no scene rebuild
  - Sub-100ms repaint requirement on a mid-range Android
  - Other cabinets are NOT affected
  - Active swatch gets 1.5px black border

- **Close button (×) or background tap:** dismisses pill, camera returns to overview.

### 3.4 NFS camera tween

When a cabinet is selected:
- Camera position smoothly animates over **480ms** with `easeOutCubic`
- Target position: `(center.x × 0.5 ± 0.45, center.y + 0.4, center.z + 1.35 + cabinetWidth × 0.4)` — frames the cabinet without losing peripheral context
- Look-at target: cabinet center, raised by 0.04
- When deselected: 480ms tween back to overview position `(2.1, 1.55, 3.05)` looking at `(0, 0.65, -0.2)`

Use a single animated value driven by a frame loop or Reanimated's `useFrame`. Do not use multiple competing tweens.

### 3.5 The 3D / 2D toggle

Tapping `2D`:
- Camera animates from iso position to top-down `(0.01, 4.2, 0.6)` looking at `(0, 0, 0.6)` over **540ms** with `easeOutCubic`
- FOV narrows from 34° to 32° during the tween
- A grid overlay fades in: 100mm minor lines (rgba(0,0,0,0.05)) + 1000mm major lines (rgba(0,0,0,0.10)) — implement as a CSS-grid background image on a transparent overlay layer above the canvas, NOT as 3D geometry
- All other UI stays exactly the same; selection state survives the transition
- Tapping `3D` reverses it

This is the "one model, two cameras" principle. Same scene, different camera. **Do not** rebuild geometry or change the model on view change.

### 3.6 Material drawer (bottom sheet)

Triggered by tapping the material button at bottom-left:
- @gorhom/bottom-sheet 5 with snap points `['45%']`
- Pull-handle at top
- Section header: `Палитра кухни · 6 вариантов`
- 6 palette cards in a 3-column grid (aspect ratio 1.15:1)
- Each card shows: facade color (60% area) + worktop color (40% area) + label pill at bottom
- Active card: 1.5px black border
- Tapping a card:
  - Updates global material in store
  - Clears any per-cabinet overrides? **No** — per-cabinet overrides survive (this is two-tone kitchen support)
  - Pulses a small toast: `Палитра: Кашемир`
  - Auto-closes drawer after 240ms
  - Triggers full scene material refresh

### 3.7 Variant cycling

Tapping the variant counter at bottom-right OR horizontal swipe on empty canvas:
- Cycles to next variant
- Variant dots animate (active dot widens to 16px rounded rect)
- Mock variants are generated based on wall length (see §6.2)
- On variant change: all per-cabinet overrides clear (because cabinet IDs regenerate)
- Toast pulses: `Линейная` / `С пеналом` / etc.

### 3.8 Wall pill cycling

Tapping the wall pill cycles wall sizes: 1200 → 1500 → 1800 → 2100 → 2400 → 2700 → 3000 → back to 1200.
- Mini-dots inside the pill show position (`. . . ● . . .`)
- New variants generate for the new wall size
- Toast pulses: `Стена 2100 мм`

### 3.9 Adjacency warning

If the current variant happens to place sink next to stove (no separating cabinet between them):
- Amber warning pill appears below the dots: `⚠ Раковина рядом с плитой`
- 280ms fade in / out
- Non-blocking — purely advisory
- Auto-hides when user moves to a variant without the adjacency

### 3.10 Save button

Tapping "Сохранить и заказать раскрой":
- Navigates to `/studio/[projectId]/lock`
- That screen shows the final hero shot with a placeholder for the quote PDF preview
- No actual DXF generation yet — just a toast: `DXF + смета · отправлено в Telegram`

---

## 4. The other 6 screens (kept brief)

### 4.1 Splash

- Black background, MEBELCHI logo center, fade-in then fade-out over 800ms
- Auto-routes to `/home` (or `/setup` if `hasCompletedSetup` flag is false)

### 4.2 Home

- Header: `MEBELCHI` + `Кухни`
- Recent projects: horizontal scroll cards. Each card shows a small 3D thumbnail (use a static rendered preview or a placeholder geometric pattern), kitchen name, date, price.
- Big primary button at bottom: `+ Новая кухня` → navigates to `/studio/new` which creates a fresh mock project and routes to `/studio/[generated-id]`
- Top-right small icon: settings (gear icon) → `/settings`

### 4.3 Setup wizard

Single screen, vertical scroll, shown once:
- Title: `Настроим ваш цех`
- Subtitle: `Эти настройки применятся ко всем будущим кухням`
- Fields:
  - `Название цеха` — text input, default "Мебельный цех"
  - `Поставщик ЛДСП` — dropdown: Imkon Group / Egger UZ / Kronospan UZ
  - `Толщина ЛДСП` — segmented choice: `10 мм` / **`16 мм`** (default selected) / `18 мм`
  - `Бренд фурнитуры` — segmented: Blum / **Hettich** (default) / Boyard
- Bottom button: `Начать работу` → saves to store, sets flag, routes to `/home`

### 4.4 Material palette drawer

See §3.6 above. Implemented as a bottom sheet from `/studio/[projectId]`, not a route.

### 4.5 Lock / quote screen

- Full-screen hero shot of the final kitchen
- Camera at hero angle (slow continuous lerp from `(2.0, 1.4, 3.0)` to `(2.4, 1.55, 3.2)` and back over 8 seconds — gentle parallax)
- Bottom card with breakdown:
  - Total price as headline (32px font)
  - 4 rows: ЛДСП / Фурнитура / Кромка / Работа (each row: label + mock soum value)
  - Mock utilization bar: `Использование листа · 87%`
- Two buttons:
  - `Поделиться PDF` (secondary, ghost style)
  - `Отправить в Telegram` (primary, dark)

### 4.6 Settings

- Header: `Настройки`
- Sections:
  - `Цех` — shows shop name (tappable to edit)
  - `Язык интерфейса` — toggle: Русский / O'zbek
  - `Поставщики` — list of suppliers from setup
  - `Версия` — `1.0 MVP · сборка от [date]`
- All non-functional in this sprint — just visible.

---

## 5. Zustand store shape

Put this in `/src/store/uiStore.ts`. Use it for UI state only — separate from your existing business store.

```typescript
import { create } from 'zustand';

export type MaterialId = 'white_classic' | 'cashmere' | 'oak_light' | 'graphite' | 'walnut' | 'anthracite';
export type DoorStyle = 'flat' | 'shaker' | 'grooved';
export type HandleType = 'bar' | 'knob' | 'inset';
export type SinkType = 'single' | 'double' | 'none';
export type StoveType = 'induction' | 'gas' | 'none';
export type ViewMode = '3d' | '2d';
export type CabinetType =
  | 'base' | 'drawer3' | 'drawer4'
  | 'sink' | 'stove' | 'sink_stove'
  | 'tall' | 'fridge';

export interface Cabinet {
  id: string;
  type: CabinetType;
  width: number;        // in meters
}

export interface Variant {
  name: string;
  cabinets: Cabinet[];
  hasUppers: boolean;
  hasSideShelves: boolean;
}

export interface UIStore {
  // Wall + variant state
  wallLengthMm: number;
  variantIdx: number;
  variants: Variant[];

  // Global selections
  globalMaterial: MaterialId;
  globalDoorStyle: DoorStyle;
  sinkType: SinkType;
  stoveType: StoveType;
  worktopOverride: number | null;

  // Per-cabinet overrides (keyed by cabinet id)
  cabinetMaterial: Record<string, MaterialId>;
  cabinetDoorStyle: Record<string, DoorStyle>;
  cabinetHandle: Record<string, HandleType>;

  // Selection + view
  selectedCabinetId: string | null;
  viewMode: ViewMode;

  // Setup flag
  hasCompletedSetup: boolean;

  // Actions
  setWallLength: (mm: number) => void;
  setVariant: (idx: number) => void;
  setGlobalMaterial: (m: MaterialId) => void;
  setCabinetMaterial: (cabId: string, m: MaterialId) => void;
  cycleDoorStyle: (cabId: string) => void;
  cycleHandle: (cabId: string) => void;
  cycleSink: () => void;
  cycleStove: () => void;
  cycleWorktop: () => void;
  selectCabinet: (id: string | null) => void;
  setViewMode: (m: ViewMode) => void;
  resizeCabinet: (cabId: string, deltaMm: number) => void;
  completeSetup: () => void;
}

export const useUI = create<UIStore>((set) => ({
  wallLengthMm: 1500,
  variantIdx: 0,
  variants: [],
  globalMaterial: 'white_classic',
  globalDoorStyle: 'flat',
  sinkType: 'single',
  stoveType: 'induction',
  worktopOverride: null,
  cabinetMaterial: {},
  cabinetDoorStyle: {},
  cabinetHandle: {},
  selectedCabinetId: null,
  viewMode: '3d',
  hasCompletedSetup: false,
  // ... actions implementation
}));
```

**Subscriptions:** the 3D canvas should subscribe to slices, not the whole store. Use Zustand's selector pattern aggressively. Camera tween state should NOT live in Zustand — it's purely visual; keep it in a Reanimated shared value or a `useRef`.

---

## 6. Mock data

### 6.1 Materials catalog

Put in `/src/mocks/materials.ts`:

```typescript
export const MATERIALS = [
  { id: 'white_classic', name: 'Белая классика', facade: 0xf6f3ea, top: 0xdfd9c8 },
  { id: 'cashmere',      name: 'Кашемир',        facade: 0xddd0b6, top: 0xc5b88f },
  { id: 'oak_light',     name: 'Дуб светлый',    facade: 0xc4a575, top: 0x2c2c2a },
  { id: 'graphite',      name: 'Серый камень',   facade: 0x8e8a83, top: 0x1f1f1d },
  { id: 'walnut',        name: 'Орех тёмный',    facade: 0x6b4528, top: 0x1a1a18 },
  { id: 'anthracite',    name: 'Антрацит',       facade: 0x2e2e30, top: 0x1a1a18 },
] as const;
```

### 6.2 Variant generator

Put in `/src/mocks/variants.ts`. Pure function, no side effects:

```typescript
export function generateVariants(wallMm: number): Variant[] {
  const W = wallMm / 1000;
  // Branches by W range — see prototype HTML for full logic
  // Returns 2–4 variants per wall size
  // Each variant: { name, cabinets[], hasUppers, hasSideShelves }
}
```

The exact branching logic is in the prototype HTML Oppoq has — copy that function verbatim into TypeScript. It's the canonical variant generator for V1.

### 6.3 Mock projects (for home screen)

3 hardcoded projects with mock thumbnails (use the recharts gradient pattern or a tiny static SVG). Just enough to show the home screen has content.

---

## 7. The 3D scene — what to render

Use `@react-three/fiber` `<Canvas>`. Build everything declaratively as React components — do NOT do imperative three.js scene management except for the camera tween.

### 7.1 Scene composition

```tsx
<Canvas>
  <ambientLight intensity={0.55} color={0xfff5e8} />
  <directionalLight intensity={0.85} position={[2.6, 4.5, 2.8]} castShadow />
  <directionalLight intensity={0.18} position={[-3, 2, 2]} color={0xc8d8ff} />

  <Floor />
  <BackWall />

  <Kitchen variant={currentVariant} />

  <CameraRig />   {/* Controls camera position/look via tween state */}
</Canvas>
```

### 7.2 Component breakdown

| Component | Renders |
|---|---|
| `<Floor />` | 14×10 plane, color 0xe5dfd1, receives shadow |
| `<BackWall />` | 14×4 plane at z=-0.65, color 0xede8db |
| `<Kitchen />` | Group containing cabinets + worktop + uppers |
| `<Cabinet />` | One cabinet: body, doors (invisible hitboxes), handles, plinth |
| `<Worktop />` | Continuous worktop spanning non-tall cabinets |
| `<Upper />` | Upper cabinet (when variant has uppers) |
| `<Sink />` | Sink basin + faucet (when cabinet type is sink/sink_stove) |
| `<Stove />` | Stove top + burners (when cabinet type is stove/sink_stove) |
| `<Shelves />` | Side-wall floating shelves (when variant has them) |
| `<CameraRig />` | Animates camera position/look using shared values |

### 7.3 Cabinet hitboxes

Each cabinet's "interactive parts" are separate invisible meshes layered on top of the visible facade:
- 1 hitbox for the body (covers the whole front face)
- 1 hitbox per door (for door-style cycling)
- 1 hitbox per handle (for handle cycling)
- 1 hitbox for worktop section above this cabinet
- 1 hitbox for sink basin (if sink)
- 1 hitbox for stove top (if stove)

Each hitbox has `userData.type` and `userData.cabId`. The pointer-event handler on the canvas reads `userData.type` and dispatches to the right Zustand action.

**Hit priority** (when multiple intersections):
1. Handle (smallest, most specific)
2. Sink / stove (specific accessories)
3. Door
4. Worktop
5. Cabinet body
6. Plinth
7. Floor (deselects)

### 7.4 Camera tween

Implement in `<CameraRig />`. Use Reanimated `useSharedValue` for position and look-at vectors. Bridge to the three.js camera in a `useFrame` loop:

```tsx
useFrame(() => {
  camera.position.x = camPos.value.x;
  // ... etc
  camera.lookAt(lookTarget.value.x, lookTarget.value.y, lookTarget.value.z);
});
```

When selection changes (subscribe via Zustand selector), call `withTiming(targetVec, { duration: 480, easing: Easing.out(Easing.cubic) })`.

---

## 8. Typography, colors, spacing

Match exactly:

| Token | Value |
|---|---|
| Background | `#e8e3d7` (warm cream — Mebelchi brand) |
| Soft background | `#f0ebde` |
| Card / white | `#ffffff` |
| Ink (primary text) | `#1c1c1a` |
| Ink soft | `#4a4a48` |
| Ink muted | `#7a7972` |
| Ink faint | `#aaa8a0` |
| Line | `rgba(28, 28, 26, 0.08)` |
| Warning | `#b85b1d` |
| Warning bg | `rgba(184, 91, 29, 0.08)` |
| Border radius small | 8 |
| Border radius medium | 12 |
| Border radius large | 18 |
| Border radius pill | 999 |
| Shadow small | `0 1px 3px rgba(0,0,0,0.04)` |
| Shadow medium | `0 4px 14px rgba(0,0,0,0.06)` |
| Shadow large | `0 8px 30px rgba(0,0,0,0.08)` |

**Font:** IBM Plex Sans (300/400/500/600) for prose, IBM Plex Mono (400/500) for numbers and uppercase labels. Cyrillic subset required. Load with `expo-font`.

**Text sizes:**

| Use | Size | Weight |
|---|---|---|
| Brand logo | 14px | 600 |
| Brand tag (uppercase) | 10px | 400 |
| Wall pill | 17px | 500 |
| Price | 19px | 500 |
| Price currency | 11px | 400 |
| Section label (uppercase) | 10–11px mono | 500 |
| Body | 13px | 400–500 |
| Pill button | 13–14px | 500 |
| Toast | 12px | 500 |
| Hint text | 10–11px italic | 400 |

---

## 9. Acceptance criteria — Oppoq signs off when these all pass

- [ ] Cold start to interactive on a mid-range Android: < 2 seconds
- [ ] Tap a cabinet → camera arrives at target in 480ms ± 30ms
- [ ] Tap a swatch in selection pill → that cabinet's facade repaints in < 100ms, others unchanged
- [ ] Two-tone kitchen works: select cabinet A → walnut; select cabinet B → keep white; both visible simultaneously
- [ ] 3D / 2D toggle: camera animates over 540ms, grid fades in, selection survives the transition
- [ ] Horizontal swipe with no selection: variant cycles, dots animate
- [ ] Horizontal swipe with selection active: NOTHING happens (gesture suppressed)
- [ ] Wall pill tap: cycles 1200→3000mm, variants regenerate, mini-dots update
- [ ] Variant counter tap: cycles variants, same effect as swipe
- [ ] Setup wizard appears on first launch only, never again
- [ ] Save button navigates to lock screen with hero camera parallax
- [ ] All Russian text renders correctly, no Cyrillic ?? glyphs
- [ ] No settings screen reachable except via the gear icon on home
- [ ] No empty state reachable through any sequence of user actions — always a default kitchen visible
- [ ] All gestures haptic-feedback on a real iPhone (use `expo-haptics` `selectionAsync` for taps, `impactAsync('light')` for swatches)
- [ ] Demo runs for 5 minutes on a real phone without crashing or dropping below 30fps

---

## 10. File tree (suggested)

```
/app
  _layout.tsx                  // root with font loader, providers
  index.tsx                    // splash → redirect
  home.tsx
  setup.tsx
  settings.tsx
  /studio
    [projectId].tsx            // the Studio screen
    [projectId]/lock.tsx
/src
  /components
    /studio
      Canvas3D.tsx             // R3F Canvas wrapper
      Kitchen.tsx              // composes cabinets
      Cabinet.tsx
      Worktop.tsx
      Upper.tsx
      Sink.tsx
      Stove.tsx
      Shelves.tsx
      CameraRig.tsx
      WallPill.tsx
      PriceBlock.tsx
      VariantDots.tsx
      AdjacencyWarning.tsx
      SelectionPill.tsx
      MaterialButton.tsx
      SaveButton.tsx
      VariantCounter.tsx
      ViewToggle.tsx
      PlanGridOverlay.tsx
      Toast.tsx
    /home
      ProjectCard.tsx
      NewKitchenButton.tsx
    /setup
      WizardField.tsx
      WizardChoice.tsx
    /shared
      Pill.tsx
      MiniSwatch.tsx
      PaletteCard.tsx
  /mocks
    materials.ts
    variants.ts
    projects.ts
  /store
    uiStore.ts
  /lib
    /three
      makeMaterials.ts         // material factory functions
      hitPriority.ts           // raycaster hit priority logic
      cameraTargets.ts         // computes camera position from selection
    /tokens
      colors.ts
      typography.ts
      shadows.ts
      spacing.ts
  /types
    ui.ts                      // see UI_TYPES.ts
```

---

## 11. What to NOT build in this sprint

These are real V1/V2 features but explicitly out of scope right now:

- DXF generation (already exists in your codebase — do not touch in this UI sprint)
- Drilling engine integration
- Hardware catalog UI (114 items — V2)
- L-shape kitchens (linear only for now)
- Custom dimension entry (numeric keypad)
- Cabinet drag-to-reorder (V2 — keep the gesture token reserved)
- Long-press → material drawer scoped to one cabinet (V2)
- Pinch-zoom into cabinet detail view (V2)
- Quote PDF generation
- Account creation / sign-up
- Telegram share (mock the button — just show a toast)
- Multi-language UZ Latin actual translation (just leave UZ as placeholder strings)

---

## 12. Timeline (suggested, 5–7 working days)

| Day | Work |
|---|---|
| 1 | Splash, Home, Setup wizard, base navigation, Zustand store, design tokens |
| 2 | Studio screen scaffolding, R3F canvas, floor + walls + camera, single cabinet rendering |
| 3 | Full kitchen rendering with all cabinet types, worktop, uppers, sink, stove, shelves |
| 4 | Raycaster hit priority, selection state, NFS camera tween, selection pill animations |
| 5 | Material drawer, per-cabinet overrides, swatch interactions, variant cycling, wall pill |
| 6 | 3D/2D toggle with grid overlay, adjacency warning, lock screen with hero parallax |
| 7 | Polish: haptics, toasts, typography, performance testing on real Android |

---

## 13. Demo script (for when we show this for money)

The demo is 90 seconds. Saidislom rehearses it once with Oppoq before any meeting.

1. **Open app.** Splash → home screen with 3 mock projects → tap "Новая кухня" → Studio loads.
2. **Show the default kitchen.** Point out the wall length, the price, the variant dots. (~10s)
3. **Tap a base cabinet.** Camera flies in, pill rises. Width +/-. Watch price update. (~15s)
4. **Tap a swatch.** That cabinet's facade goes walnut. Tap a different cabinet → keep it white. Two-tone kitchen, two taps. (~15s)
5. **Tap the door of selected cabinet.** Cycles to shaker. Tap again → grooved. (~10s)
6. **Tap handle.** Cycles handle styles. (~5s)
7. **Tap floor to deselect.** Camera returns to overview. (~5s)
8. **Swipe canvas.** Variant cycles. Show the dots animate. (~10s)
9. **Toggle 2D.** Top-down view appears with grid. Toggle back to 3D. (~10s)
10. **Tap material button.** Drawer slides up. Pick "Орех тёмный". Whole kitchen repaints. (~10s)

That's the demo. Practice it. Keep it tight. Investor meetings die when the demo stutters.

---

## 14. Questions Saidislom is allowed to push back on

He can come back to Oppoq with these questions specifically (anything else, just build):

1. Does the camera tween feel right at 480ms, or should it be faster/slower?
2. Should the selection pill cover the bottom bar or float above it?
3. When variant cycles, should per-cabinet overrides survive or clear? (Current spec: clear.)
4. Should the 2D view show dimensions automatically, or only on tap?
5. Adjacency warning — should it block the layout or just warn?

Everything else: build to spec. Iterate after demo.

---

## 15. The point of this sprint, restated

**We are not building furniture-making software. We are building a 5-minute demo that makes investors believe we already built furniture-making software.** The real engine exists. The UI is what they see. That's why this sprint matters more than any sprint that came before it.

Build it well. Show me when stage 4 of §12 is done — I want to feel the NFS camera tween before you write any of stage 5.

— Oppoq
