# -rU_0 — Research Pack Verdict & Locks

**Date:** June 12, 2026
**Input:** -r7_UI_01-02 / 03-04 / 05-06 / 07-08 (8 research outputs + 8 red-team reviews, ~500KB)
**Rule applied:** nothing enters our tables from a base document without its red-team corrections. The red-teams caught real, expensive errors — in several topics they are worth more than the base research.
**Status of 19_FUNCTION_MAP:** advanced to v0.2 by the locks below. v1.0 waits for imos screenshots + F1 field counts.

---

## 1. Per-topic verdict

| Topic | Base quality | Red-team value | Net result |
|---|---|---|---|
| R-U1 structural models | **Gold.** 8 systems, cited, two independent runs agree | n/a | Line/zone model confirmed universal; row-linking confirmed as industry gap |
| R-U2 libraries | **Gold.** Convergent across runs | n/a | 3-noun model + stretch map locked |
| R-U3 ergonomics | Data 80% good, container broken | **Critical** — caught misused standards, missing thickness, two docs conflicting | ГОСТ tables shippable after a merge/repair task |
| R-U4 gestures | Good survey, wrong conclusions | **Decisive** — reversed 3 core recommendations | Type-first inversion; 50mm not 32mm; toolbar multi-select |
| R-U5 camera | Good survey | **Decisive** — killed fixed 480ms, killed 4 profiles, found pivot-orphan gem | Pivot-retarget model locked; NFS demoted to explicit actions |
| R-U6 disclosure | Right shape, fabricated numbers | **Critical** — stripped fake metrics, found LMK session-recovery gem | Ring model survives with our own measurable targets |
| R-U7 materials | 85% right taxonomy | **Critical** — 400% stiffness error, missing assembly convention, missing grain | Production-ready after 5 field additions |
| R-U8 validation | Right architecture | **Critical** — killed persistent amber tier, auto-fix, YAML waivers; found rule-versioning gem | "Sandbox inside, gates at exit" confirmed with corrections |

Red-teams are fallible too (some of their own citations are weak). Every adopted number below still gets device/field validation. But every reversal they made was correct on engineering grounds.

---

## 2. LOCKED — interaction model

**L1. Type-first, drag-second (the inversion).** The master already knows his dimensions; he does not drag to discover them. First tap on a dimension chip → numpad opens immediately. Numpad supports expressions (`720-2*18`) — promoted to a headline feature. Drag is a coarse layout tool only: **50mm detents** (standard panel widths 150–600 are all 50mm increments), fine 1mm via second-finger-on-neutral-area escape. **The 32mm detent idea is a domain error** — System 32 governs hole pitch, never panel widths (consistent with our existing doc-15 distinction).
→ *Amends 19_FUNCTION_MAP §5: numpad is Ring-0 primary; drag demoted to coarse.*

**L2. Multi-select = persistent toolbar toggle, not long-press.** Long-press fails on rough workshop hands and Android gesture-arena races; Material 3 abandoned it for the same reason. Toggle on → taps add/remove; count badge ("3 секции"); dim the rest; bulk numeric edits go through a modal sheet showing the N-count before commit (no Figma "Mixed" inline field on mobile).

**L3. Dimension labels: active element only.** Always-on labels for hundreds of panels is unrenderable on Mali-class GPUs and unreadable anyway. Labels appear for the selected/dragged element; everything else silent.

**L4. Haptics = enhancement, never channel.** Budget-Android motors can't express three intensities. Primary detent feedback is **visual snap** (label jumps to value). Haptic tick fires in try/catch where supported.

---

## 3. LOCKED — camera (the decision that touches NFS)

Evidence from both the survey and red-team is unambiguous: **auto-flying the camera on every selection is the #1 documented "camera fought me" complaint** once manual orbit exists. Resolution that preserves the NFS soul:

- **Tap = select + silent pivot retarget. The camera body does not move.** The next orbit simply feels correct.
- **NFS flight becomes the explicit, rewarded action:** double-tap = cinematic fly-to-focus (~75% fill, angle preserved, one undo step); lens switches; the save ceremony. The signature moves live exactly where the user asks for them.
- **Flight duration is distance-scaled, not fixed:** short moves 300–500ms, long moves 700–1200ms, ease-in-out, slerp for orientation + spring for position. The constitutional fixed 480/540ms dies.
- **Pivot on deselect = camera-forward ray ∩ nearest surface** (the orphan-pivot gem; fallback to scene center). Never orbit around an invisible point.
- **Phone model = IKEA Kreativ:** canvas gestures belong to the camera; object editing lives in the bottom panel + on-element handles of the *selected* item. Turntable + horizon lock + pitch clamp ±80°, **one** constraint set (the four-profile idea dies), 2-finger double-tap = re-level only, undo is a button.
- **Hit-testing at touch-down = 2D screen-space bounding-box cache,** not a 3D raycast (Snapdragon-class stall otherwise); BVH only for async refinement.
→ *Amends 10_UI_PRINCIPLES §5 and the skeleton's camera contract.*

---

## 4. LOCKED — structure & libraries

**L5. Line/zone model is the industry's universal grammar** (zone/section + split + scope + equal-space + align, present in 5–8 of 8 systems). Our §2-B operations are the right set. Bazis vocabulary to mirror for familiarity: секция, сдвинуть панель, эластичность.

**L6. Row-linking is the differentiation target, confirmed.** Only W4I (skeleton) and PolyBoard (External Zones) structurally link base/upper/tall rows; everyone else fakes it with room proximity. The founder's "added bottom, top unchanged" complaint identifies a gap *desktop incumbents share*. Mobile + true row propagation = a claim nobody else can make.

**L7. Library = 3 nouns:** **Section Template → Section Instance (with overrides) → Construction Standard** (the workshop's "how we build" — exactly our Ring-3 workshop profile). Stretch map with four behaviors per sub-part: **Fixed / Stretch / Repeat / Lock**, resize algorithm in that order. Hardware offsets stored as **absolute mm from reference edges** (matches System 32), never percentages. Override badges + "reset to template"; "Save as new template" never mutates the original; version history on templates. **Resize = re-evaluate rules, never scale the mesh** — already our engine law, now confirmed as the industry's core lesson.

---

## 5. LOCKED — materials, sheets, validation (engine-grade gems)

**M1. `assembly_convention` field is mandatory** (Convention A "дно между боковинами" vs B "дно под боковинами"). ~30% of workshops differ; Bazis supports both; wrong convention = every cut wrong by 16–32mm. Lives in the Construction Standard. **Ask the factory which they use — field question #1.**

**M2. Back-panel cut formula:** `width = nominal − 2×side_thickness + 2×groove_depth` (e.g. 600−32+20=588). Plus groove setback from rear edge. Without it, backs are loose and racking. → doc-15 spec JSON.

**M3. Stiffness is a cube law:** 18mm vs 16mm = (18/16)³ ≈ **1.42×**, not "3–5%". Feeds physics Grade-1 span limits directly (δ=5qL⁴/384EI, L/300 visible-sag limit). The base doc cited Барташевич and ignored his own formula.

**M4. `grain_direction` on every visible role** (`locked_vertical` facades/sides, `locked_horizontal` worktops, `free` hidden) — otherwise the nesting optimizer rotates doors 90° for 5–15% yield and produces aesthetically wrong furniture.

**M5. Sheet counter math:** sizes 2750×1830 + 2800×2070 confirmed; kerf **user-configurable** (3.5 default; Chinese saws 4.0–4.2 — calibrate per workshop); waste_factor 1.20 **breaks on small decor groups** (3 accent parts = 1 full sheet at 12% utilization): `sheets = max(ceil(area×1.20/usable), ceil(max_part_area/usable×1.05))`, and groups < 0.4 sheet → bill 0.5 sheet minimum or flag for manual pricing. *This correction directly protects margin on premium accent decors — the founder's "сколько листов" instinct, now with teeth.*

**V1. Validation architecture confirmed:** hard gate at export only; live ambient = AABB overlap only; on-demand "Проверить" fills a problems panel; every violation tappable → rule, measured-vs-required, cited source, zoom. **Corrections:** no persistent amber halos (advice appears only in the selected object's context, fires once per session per finding — repetition, not false-positive rate, causes fatigue); **no auto-fix ever** (show the failing measurement + 3 ghost placements, user confirms); waivers = scene-JSON with 3 preset reasons, auto-expire on object move/SKU update (no YAML, no dates); flat 15% opacity error fill (no hatch shaders on Mali GPUs).

**V2. Rule versioning from day one (the gem).** When rules update, saved projects must distinguish Type A (violations known at last save — quiet) from Type B (new since — one-time "Новое требование" badge). Cannot be retrofitted. Slots into doc-17's pack-version provenance discipline.

---

## 6. LOCKED — disclosure & survival

**D1. Rings survive; the supporting statistics were fabricated** — replace with our own target: **≥60% of first-time users place and configure one cabinet in <5 minutes on a Snapdragon-4xx device, touch-only, no instructions.** Measured in hallway tests, not asserted.
**D2. Contextual disclosure = subtraction.** On selection, the toolset collapses to what applies; nothing new ever appears. Code-review gate: no new view inflation on selection events.
**D3. First mark redefined:** one section placed + one attribute set (not "a mark on canvas"). Starter project = bundled placeholder geometry in the APK, never dependent on catalog cache.
**D4. Session recovery is architecture, not polish (the gem).** Android LMK kills most sessions on 4GB devices mid-task. Full editor state (camera, selection, open sheet, ring progression) must survive kill+restore, offline. → doc-14 runtime requirement.
**D5. IKEA Kreativ replaces Procreate** as the Android Ring-0 reference.

---

## 7. Founder instincts vindicated by the data

1. "Color at the end" — confirmed (decor = per-project, customer-facing; persistent color control enters the hard-no list).
2. "Сколько листов" counter — confirmed as the master's currency, now with the small-group correction protecting exactly his high-margin custom jobs.
3. "Top didn't change" — not just our bug; an industry-wide structural gap and our differentiation target (L6).
4. System-32 ≠ width grid — our existing doc-15 distinction is what saved us from the 32mm detent error the base research made.

---

## 8. Repair tasks (data engineering, before rules ship)

1. **Ergonomics merge:** unify the two conflicting R-U3 docs into one `ergonomics_rules.json`: precedence field per row; relabel ISO 3055 citations as **1985** honestly; EN 14749 loads reclassified as *certification thresholds*, empirical loads as *design loads*; add `severity: structural|regulatory|ergonomic` (the gem) and `dimension_reference: nominal|interior|exterior`; add the thickness conversion; one rule-ID convention; `verifiable: true/false` per source. ГОСТ 13025.1-85 object tables ship as-is.
2. **materials_defaults.json v0:** R-U7 roles table + assembly_convention + grain_direction + groove formulas + configurable kerf + corrected sheet formula. All `verified:false` until factory cross-check.

## 9. Open questions → imos screenshots + field research

1. imos step-by-step: how zones/Construction Principles actually surface click-by-click (cross-check R-U1's imos rows; steal scope-switching UX if better than ours).
2. **F1 film:** operation frequency counts — my §2 frequency column is still hypothesis.
3. Factory: assembly convention (M1), saw kerf, back groove dims, 16 vs 18 usage, common widths (confirm the 50mm grid locally).
4. Floor device identification (doc 18) — also needed to test L1–L4 gesture corrections on real hardware.
