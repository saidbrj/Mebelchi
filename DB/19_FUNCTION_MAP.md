# 19 — Function Map (What Exists, How Often, Where It Lives)

**Version:** 0.1 DRAFT
**Date:** June 2026
**Status:** Hypothesis. Becomes legislation after the R-U research pack returns and the F1 field study (filmed Bazis session) validates the frequency column.
**Origin:** Skeleton prototype rejection (June 12). Root cause identified: UI was designed for the end-customer; the primary user is the mebelchi (master). This document re-derives the entire UI from the master's actual work.

---

## 0. The user correction (supersedes the v1.0 framing)

| | Old assumption (10_UI_PRINCIPLES v1.0) | Corrected |
|---|---|---|
| Primary user | Homeowner / "schoolboy" | **The mebelchi** — a professional building real furniture daily |
| Customer's role | The user | A *mode* — "customer view" for showing decor and getting agreement |
| Schoolboy test | The whole product must be toy-simple | The **Ring 0 gestures** must be learnable in 5 minutes; depth is allowed behind them (progressive disclosure) |
| Core object | Cabinet (a box in a list) | **Line** (shared edges of panels) + **Section** (a volume between lines) |
| Color/material | Persistent, on every selection | A **phase**, near the end, customer-facing |
| Sandbox vs safety | Template rails | **Sandbox inside, gates at the exit** — user builds anything within corpus furniture; the engine's standards/physics/manufacturing gates have the last word |

---

## 1. The law: frequency determines distance

Every operation gets a frequency class, and frequency maps to a UI ring:

| Class | Meaning | Ring | Surface |
|---|---|---|---|
| **M** | Many times per hour (the core loop) | **Ring 0** | On the object: direct gesture, zero menus |
| **H** | Several times per project | **Ring 1** | Summoned context (one sheet/bar on selection) |
| **P** | Once or twice per project | **Ring 2** | Phase drawer (bottom bar entry) |
| **W** | Once per workshop, rarely revisited | **Ring 3** | Workshop profile (settings, outside the project) |
| **A** | Continuous, engine-owned | **Ambient** | Badges, counters, warnings — never asks, only informs |

A control placed closer than its frequency deserves is noise (the "+" mistake, the color mistake). A control placed farther than its frequency deserves is friction (Bazis's mistake).

---

## 2. The function inventory

### A. Project & context — Ring 2/3, bookend

| Operation | Freq | Ring | Control |
|---|---|---|---|
| Create/open project, customer info | P | 2 | Project screen |
| Room: walls, dims, obstacles (window/gas/sockets) | P | 2 | Setup flow (Phase A survives as-is) |
| Furniture type: kitchen run / wardrobe / shelving | P | 2 | Setup |
| Envelope: total width, height, depth defaults | P | 2 | Setup; re-enterable. **Wall pill removed from persistent chrome** |
| Workshop profile applied | W | 3 | Settings |

### B. Carcass structure — THE CORE LOOP, Ring 0

| Operation | Freq | Ring | Gesture / control |
|---|---|---|---|
| **Move a line** (shelf level, divider position) | **M** | **0** | Drag the line; detented steps with haptic tick; scope selector applies (§4) |
| **Split a section** (add shelf = horizontal line; add divider = vertical line) | M | 0 | Tap section → split affordance on the section itself (︱/—); this REPLACES the "+" button |
| Merge (remove line) | H | 0/1 | Drag line onto neighbor, or delete in context bar |
| Resize section width/height | M | 0 | Drag its bounding lines (same gesture as move-line — there is only one gesture) |
| **Depth change** | H | 1 | Context bar; **default scope = global**, local override available |
| **Align / symmetry / equalize spacing** | H | 1 | "Выровнять" in context bar when ≥2 lines/sections selected |
| Row-level edits (worktop height, upper row elevation) | H | 0 | Rows are lines too — same drag |
| Copy / mirror section | H | 1 | Context bar |
| **Multi-select sections** | H | 0 | Long-press starts multi-select; tap to add; then any Ring-1 action applies to the group |
| Precise numeric entry | H | 0→1 | **Double-tap any dimension label → numpad popup** (swipe for steps, popup for precision — locked per founder) |

### C. Section content — Ring 0/1

| Operation | Freq | Ring | Control |
|---|---|---|---|
| Assign content from library: shelves×N, drawer stack, door(s), open niche, rod, appliance housing, corner unit | M | 0 | **Swipe horizontally on a selected section cycles its library variants** (founder: "each section changed by click") |
| Open full library / search | H | 1 | Context bar → library sheet |
| **Save section to MY library** | H | 1 | Context bar; every user builds his own library (founder requirement) |
| Shelf count/spacing inside section | M | 0 | They are lines — drag |
| **Set section purpose** (dishes / cans / pots / books / boots / hanging) | H | 1 | Purpose chip in context bar → drives ergonomics + load intelligence (§7) |

### D. Fronts & opening — Ring 1

| Operation | Freq | Ring |
|---|---|---|
| Front type: hinged L/R, lift, drawers, sliding, open | H | 1 |
| Handle / push-to-open | H | 1 |
| Opening-direction & collision check | A | Ambient (warning badge) |

### E. Materials, thickness & sheets — Ring 2 phase + Ambient counter

| Operation | Freq | Ring | Control |
|---|---|---|---|
| Carcass material + thickness (16/18) | P | 2 | **«Материалы» phase drawer** |
| **Back panel: material/thickness/mounting** (4mm ХДФ, groove vs overlay) | P | 2 | Per-role row in the same drawer — founder: "not everywhere 16mm" |
| Per-role overrides: bottoms, drawer bottoms, internal shelves | P | 2 | Role list, global-first; per-panel exception via section dive |
| Facade decor / color | P | 2 | **End of flow, customer-facing. Never persistent.** |
| Edge banding rules (2mm visible / 0.4 hidden) | W→P | 3/2 | Default from workshop profile; project override |
| **Live sheet count** | A | **Ambient** | Counter next to price: «3.8 листа ЛДСП · 0.5 ХДФ» — the master's real currency; updates on every structural edit |

### F. Joinery & hardware — automatic core + expert ring

| Operation | Freq | Ring | Control |
|---|---|---|---|
| Joint auto-resolution (doc 16 engine) | A | Ambient | Silent; visible in X-ray |
| **Joint rules profile** ("my workshop uses confirmats, not cams") | W | 3 | **Workshop menu editing jointResolver ctx** — founder requirement; constrained to cited, gate-passing rule options only |
| Per-joint override / add / remove | H | 1 | **Section dive** (§H) — tap joint in X-ray → family picker + "why" |
| **Strengthening panels** (stiffeners, ribs) | H | 0+1 | **Multi-select sections → «Усилить»** — founder: "where he wants, not by menu, but not fully manual" |
| Hardware defaults (hinge/slide brand-series) | W | 3 | Workshop profile (what's in stock locally) |
| Per-section hardware override | H | 1 | Section dive |

### G. Intelligence & validation — Ambient, engine-owned

| Layer | Behavior |
|---|---|
| Physics gate (sag, tipping, joint capacity — doc 16 Grade 1) | Inline amber/red badge on the offending line/section; tap → reason + fix suggestion ("80kg на 900mm → 4.1mm прогиб → перегородка или 18mm") |
| **Ergonomics advisor** (NEW — doc 16 sibling) | Purpose tag + anthropometric tables → warnings: "консервы ниже 1400mm", reach zones, min shelf clearance. Needs R-U3 data |
| Collision/clearance (door swing, drawer vs handle) | Ambient badge |
| Manufacturing gate (min panel size, drilling validity) | Blocking at export only — sandbox inside, gates at the exit |
| "Why" explanations | Every auto decision tappable (doc 16 trust layer) |

### H. Views & inspection — persistent lens + Ring 1 dive

| Operation | Freq | Control |
|---|---|---|
| **Manual orbit/zoom** | M | **Two-finger orbit + pinch. CONSTITUTION AMENDMENT: the no-orbit rule dies with the consumer model.** NFS auto-framing remains as assist (auto-frame on selection, auto-return on deselect) — both coexist |
| Lenses: realistic / X-ray / фасад / план / разрез | M | Persistent lens control (kept) |
| **Section dive** | H | Pinch into a section or «Деталь»: isolate it, outer layers fade, joints become tappable (founder: "layers should disappear") |
| Cut layout view (раскрой) | P | Lens or output phase |
| Customer view | P | Clean showroom render + decor — where color lives |

### I. Output & commerce — bookend

| Operation | Freq | Control |
|---|---|---|
| Price (live) | A | Ambient, paired with sheet counter |
| Validate → export: cut maps, labels, DXF/SWJ008, hardware purchase list | O | Primary action; runs ALL gates; ceremony stays |
| Quote/render for customer, Telegram share | O | Output phase |

---

## 3. The structural model this demands from the engine

The UI above is impossible on a "list of cabinet boxes." Required model (engine contract work, not just UI):

1. **Line as a first-class entity**: id, axis, position, the panels it bounds, and **group membership** (lines aligned across sections/carcasses form a group; "the overall lines of the furniture" the founder described).
2. **Rows/zones**: base row, upper row, tall units — a composition layer above carcasses, so a structural edit can propagate across the wall (fixes "added bottom, top unchanged").
3. **Recursive sections**: a carcass is a volume split by lines into sections; sections split further. Content (shelves/drawers/door) attaches to sections.
4. **Scoped propagation** as an engine operation: `moveLine(lineId, delta, scope)` where scope ∈ local | line-group | row | global. The UI scope selector is a thin wrapper over this.
5. **Panel roles** (carcass side / back / bottom / facade / internal shelf) with per-role material+thickness resolution — already implied by doc 15/17; now load-bearing for the Материалы phase and the sheet counter.
6. Purpose tags on sections → load class → physics gate input (closes the loop with doc 16 §4).

**Supervisor note:** this is the real reason the skeleton failed — not styling. The interaction model exposed that the underlying object model was consumer-grade. Function map → engine contracts → then UI. Same constitutional order as always.

---

## 4. The scope selector (the heart of "global/group first")

Every dimensional gesture carries a scope, shown as a compact 4-state control in the context bar while dragging:

`Локально · Линия · Ряд · Все`

- **Default = Линия** (the line group) — the founder's "global/group is first priority" without the trap of accidental global edits.
- Depth edits default to **Все** (global), per founder.
- The selected scope highlights *in the scene* (affected lines glow) before release — you see what you're about to change.

---

## 5. Gesture grammar v0 (to be validated by R-U4/R-U5)

| Gesture | Meaning |
|---|---|
| Drag a line | Move it (detented steps, haptic tick per step, scope applies) |
| Double-tap a dimension label | Precise numpad popup |
| Tap a section | Select (context bar rises) |
| Swipe horizontally on selected section | Cycle library variants |
| Long-press | Multi-select mode |
| Pinch into a section | Section dive (layers fade) |
| Two-finger drag | Orbit (manual camera — new) |
| Tap empty space | Deselect; camera auto-returns |

One gesture = one meaning, everywhere. No gesture does two things (Nomad's rule, already in our research).

---

## 6. Persistent chrome v2 (replaces the v1.0 five elements)

1. Canvas (full-bleed — unchanged)
2. **Ambient readout**: price + sheet count, one corner
3. **Validation badge** (green/amber/red, tappable)
4. Lens control
5. Primary action («Проверить и вывести» at the end of flow; context-dependent earlier)

Removed from persistence: wall pill (→ setup), material button (→ phase drawer), variant counter (Phase B only).

---

## 7. New intelligence layer: Function & Ergonomics

Sibling of doc 16's joint intelligence. Purpose presets (посуда, консервы, кастрюли, книги, обувь, одежда-штанга, техника) each carry: recommended height band, depth band, shelf spacing, load class, reach-zone class. Sources: R-U3 (NKBA, EN 1116, ГОСТ anthropometrics) — every constant cited, same law as everything else. The advisor warns, never blocks (gates block only at export, and only for physics/manufacturing).

---

## 8. What the research must answer (→ RESEARCH_PROMPTS_UI.md)

1. R-U1: Do pro tools confirm the line/zone model? What operations exist that this map missed?
2. R-U2: The right mental model for user section libraries (component model, overrides, sharing).
3. R-U3: The ergonomics data tables (numbers + citations).
4. R-U4: Detented-drag and numeric-entry patterns proven on touch.
5. R-U5: Orbit + auto-framing coexistence patterns.
6. R-U6: Progressive disclosure that keeps the 5-minute learnability while hiding depth.
7. R-U7: Panel role/thickness conventions in CIS practice + sheet-count math (kerf, trim, usable %).
8. R-U8: How to surface gate violations without nagging.
9. **F1 (field, highest value): film 60 minutes of the constructor in Bazis; count operations → validate/correct every frequency in §2.**

---

## 9. Constitution amendments triggered (when this becomes legislation)

| Doc | Change |
|---|---|
| 10_UI_PRINCIPLES §1 | "Five primary inputs" retired — replaced by the ring model + frequency law |
| 10_UI_PRINCIPLES §2 | Nine verbs retired — replaced by gesture grammar (§5) |
| 10_UI_PRINCIPLES §5 | No-orbit rule amended: manual orbit + NFS auto-framing assists |
| 10_UI_PRINCIPLES §9 | "Free camera orbit" leaves the hard-no list; "persistent color/material control" enters it |
| HANDOVER_UI_V3 | Re-derived from this map after research returns (capability inventory survives; placement doesn't) |
| 13/15 engine docs | Line entities, rows, scoped propagation, purpose tags → new contracts before any UI build |

---

## Changelog
- v0.1 (June 12, 2026): First draft from founder's interaction-model correction + supervisor synthesis. Awaiting R-U pack + F1 field study.
