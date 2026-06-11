# 10 — UI Principles

**Version:** 1.0
**Last updated:** May 2026
**Owner:** Oppoq
**Status:** SACRED — same modification rules as `06_CONVENTIONS.md`

---

## What this document is

The locked UI design contract for Mebelchi V1. Saidislom codes against this. The brother codes against this. Future designers code against this. If a UI decision is not in this document, it has not been made — escalate to Oppoq.

This is the companion to `06_CONVENTIONS.md`. Where conventions govern data flow between modules, this governs interaction flow between user and data.

---

## The thesis in one sentence

The kitchen is the UI. Every interaction is reached by touching the object being changed, the camera physically moves to whatever is being edited, no chrome persists except a price ticker and one primary action.

---

## 1. The five primary inputs — LOCKED

Every kitchen Mebelchi produces reduces to five user decisions. Everything else is derived, defaulted, or hidden.

| # | Decision | Type | Where user provides it |
|---|---|---|---|
| 1 | Wall length | Number | Tappable pill in header, default 1500mm, cycles 1200–3000 |
| 2 | Anchor positions (sink, stove) | Spatial | Per-cabinet swap via tap on cabinet body |
| 3 | Material palette | Categorical, 6 options | Bottom drawer triggered by material button |
| 4 | Door style | Categorical, 3 options | Tap on selected cabinet's door |
| 5 | Budget tier | Categorical, 3 options | Set once in setup wizard, hidden after |

**Rule:** Any new feature proposal must answer "which of the five inputs does this serve?" before it can be added.

---

## 2. The nine atomic verbs — LOCKED

Every gesture in the app must reduce to exactly one of these nine.

| # | Verb | Gesture | Purpose |
|---|---|---|---|
| 1 | Look | Passive view | The kitchen at rest |
| 2 | Choose | Horizontal swipe / dot tap | Template variants, palette swatches |
| 3 | Move | Drag | V2 only — cabinet repositioning |
| 4 | Resize | Tap ± buttons in selection pill | Cabinet width |
| 5 | Swap | Tap cycle | Door style, handle, sink type, stove type, worktop |
| 6 | Add | Tap empty slot | V2 only — adding new cabinets |
| 7 | Remove | Double-tap with confirm | V2 only — deleting cabinets |
| 8 | Inspect | Pinch-zoom | V2 only — detail dive |
| 9 | Lock | Bottom primary button | Save → DXF + quote |

**Forbidden verbs in V1:** Configure, Adjust, Customize, Settings, Preferences, Setup, Calibrate, Edit properties, Modify, Set.

---

## 3. The interaction inversion — LOCKED

Five persistent UI elements only:

| Element | Position | Purpose |
|---|---|---|
| 3D canvas | Full viewport | The work itself |
| Wall length pill | Top-center | Primary input #1 |
| Price block | Top-right | The value, always live |
| 3D/2D toggle | Top-right corner | View mode |
| Bottom bar | Bottom edge | Material button · Save button · Variant counter |

Nothing else is persistent. The cabinet IS its own panel. The edge IS its own width control. The swatch IS the material picker.

**Adding any sixth persistent element requires the modification protocol below.**

---

## 4. The six stages — LOCKED

| Stage | Time budget | Visible | User does |
|---|---|---|---|
| 1 · Arrival | 0–5s | Default kitchen + chrome | Look |
| 2 · Template swipe | 5–20s | Dots indicator | Choose (swipe) |
| 3 · Cabinet selected | 20–90s | Selection pill, camera framed on cabinet | Resize, Swap |
| 4 · Material drawer | 90–150s | Bottom sheet with 6 palettes | Choose (swatch) |
| 5 · Detail dive | optional | Single cabinet, door style chips | Swap (V2 only) |
| 6 · Lock & quote | last 30s | Hero camera, breakdown | Lock |

---

## 5. The NFS camera contract — LOCKED

| Property | Value |
|---|---|
| Camera type | PerspectiveCamera, FOV 34° |
| Overview position | (2.1, 1.55, 3.05) looking at (0, 0.65, -0.2) |
| Plan position | (0.01, 4.2, 0.6) looking at (0, 0, 0.6), FOV 32° |
| Tween duration (selection) | 480ms |
| Tween duration (deselection) | 480ms |
| Tween duration (view change) | 540ms |
| Easing | easeOutCubic for all |
| Position when focused | (center.x × 0.5 ± 0.45, center.y + 0.4, center.z + 1.35 + width × 0.4) |
| LookAt when focused | Cabinet center + (0, 0.04, 0) |
| Manual orbit / rotation in V1 | NONE — camera fully automated |

**Rule:** Camera position is a function of selection state. The user never manually controls the camera in V1. This single rule is why the schoolboy test passes.

---

## 6. The three technical pillars — LOCKED

| # | Pillar | Implementation in our stack |
|---|---|---|
| 1 | Raycaster | three.js Raycaster against userData-tagged hitboxes; priority order in §7 |
| 2 | Camera tween | Reanimated shared values bridged via R3F's useFrame; lerp position + look target |
| 3 | Vector projection | RN absolute-positioned views over Canvas; coords computed from camera.project() |

---

## 7. Hit priority — LOCKED

When pointer hits multiple meshes:

1. Handle (smallest target)
2. Sink / Stove
3. Door
4. Worktop
5. Cabinet body
6. Plinth
7. Shelf
8. Floor (deselects)

---

## 8. Repaint contract — LOCKED

| Operation | Method | Budget |
|---|---|---|
| Per-cabinet material change | `mat.color.setHex()` direct mutation, no rebuild | < 100ms |
| Door style change | Local rebuild of that cabinet's overlays only | < 200ms |
| Handle change | Local rebuild | < 200ms |
| Width change | Full kitchen rebuild (neighbors reflow) | < 300ms |
| Variant change | Full kitchen rebuild, IDs regenerate | < 400ms |
| Wall length change | Full variants regen + kitchen rebuild | < 500ms |

If any operation exceeds budget on a mid-range Android, treat it as a bug.

---

## 9. The hard "no" list — LOCKED

| Forbidden | Why |
|---|---|
| Settings screen mid-flow | `conventions.md` IS settings |
| Tutorial overlay | The interface IS the tutorial |
| Blank canvas | Always render a default kitchen |
| Modal dialogs on cabinet edit | Use the selection pill |
| Free camera orbit | Camera is automated only |
| Free object rotation | Camera moves, object never rotates |
| Property sidebar | Use floating selection pill |
| Tabs / mode switcher | One model, two cameras only |
| Color picker UI | Use palette presets only |
| "Advanced settings" | If it needs that label, it's not in V1 |
| Account creation before first interaction | Signup at Stage 6 (Bitwig model) |
| Loading splash > 800ms | If you need a longer one, bundle is too big |

---

## 10. Acceptance criteria

| # | Criterion |
|---|---|
| 1 | Cold load < 2s on mid-range Android |
| 2 | Camera tween 480 ± 30ms |
| 3 | Per-cabinet material swap < 100ms, others untouched |
| 4 | Two-tone kitchen reachable in two taps |
| 5 | Schoolboy test: 5 teenagers, no instructions, < 5 min to a saved kitchen |
| 6 | CNC test: DXF from teenager's kitchen cuts without engineer intervention |
| 7 | No settings screen in app body |
| 8 | No empty state reachable through any sequence |
| 9 | Russian default, Uzbek toggle present |
| 10 | Wall pill reachable in 1 tap from any stage |

---

## 11. Modification protocol

To change anything in this document:

1. Telegram message to team: "Предлагаю изменить UI_PRINCIPLES.md, раздел N: [причина]"
2. Explicit "да" from at least two of three core members (Oppoq, Saidislom, brother)
3. Bump version, add changelog entry
4. Romchi CTO mentor reviews any change to acceptance criteria or technical pillars

Same status as `06_CONVENTIONS.md`. Drift kills the project.

---

## Changelog

- **v1.0 (May 2026):** Initial lock. Five primary inputs, nine atomic verbs, six stages, NFS camera contract, three technical pillars, hit priority, repaint contract, hard "no" list.
