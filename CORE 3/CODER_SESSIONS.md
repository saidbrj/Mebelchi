# Claude Code sessions — factory dump prep (run sequentially, one task each)

Gate logic: Session 1 is 30 minutes of measurement and must run BEFORE the engine grows. Session 2 is the only hard blocker for dump day. Session 3 makes dump day productive the same afternoon. Don't combine sessions.

Before starting: ensure the repo is committed clean. Each session ends with its own commit.

---

## Session 1 — bench baseline (run FIRST, before any engine change)

> Add `npm run bench`: benchmark SWJ008 parse, canonicalization, export, and `solveFull` over the full golden suite, output a timing table (median + p95 over ≥20 runs after warmup). Create `PERF_LEDGER.md` with today's numbers as the first baseline entries — columns: operation, median ms, p95 ms, Node version, machine, date, commit hash. Measurement only — no optimization, no code changes to the engine. This baseline is captured BEFORE Types 3–4 support lands, so the next ledger entry can show what that support cost. Report the baseline table.

Context to give: docs 14, 18; the repo. Nothing else.

---

## Session 2 — Types 3–4 coverage (the blocker)

> Extend the engine's SWJ008 parse/export coverage to machining Types 3 (contour mill) and 4 (saw groove), per the two SHKOF panels in `XML output examples/SHKOF/`.
>
> Type 3 specifics: `Lines` children where `Angle="0"` is a straight segment and **`Angle≠0` is an arc segment with that sweep in degrees** (the SHKOF panels contain -90° arcs = 16mm and 25mm corner radii, and one straight scribe line at 5mm depth on Face 6). `ToolOffset` carries CJK tokens (`右` = right, `左` = left): **preserve these tokens byte-exactly through parse → canonical → export**, and verify the encoding path explicitly — the SWJ008 charset constant must not mangle non-Latin tool-offset values. Add an encoding round-trip test for this token specifically.
>
> Type 4 specifics: saw grooves with `X/Y → EndX/EndY`, `Width`, `Depth` (SHKOF shows 4mm wide × 5mm and 8mm deep back-panel dados).
>
> Also add the new hole classes as data (no primitive changes): Ø3×1mm face marking, Ø8×14mm face drill.
>
> Tolerate-and-flag rule (critical for the incoming dump of hundreds of files): the parser must NEVER silently drop or crash on content outside current coverage. Non-empty `<Outline>`, non-empty `Face5ID`/`Face6ID`, multi-panel project files, unknown Machining types or attributes → parse what is known, attach explicit machine-readable flags for the rest, and surface flags in the result. Add tests: a synthetic file with an unknown Type and a non-empty Outline parses with flags, no exception.
>
> Add canonical representations for Types 3–4 to `MachiningPlan` following the existing `05_CONTRACTS.md` style, evolve by addition only (no renames/removals). Add both SHKOF panels as new golden fixtures with semantic round-trip tests (parse → canonical → export → re-parse → zero diff), same harness as Fixture 0. All coordinates `mm10`. Do not touch primitives, solver logic, exporter safety gates, or any UI. Report when `npm test` shows the new fixtures green alongside all existing ones, plus one PERF_LEDGER entry for what Types 3–4 support cost vs the Session-1 baseline.

Context to give: docs 05, 06, 11, 14, the SHKOF XMLs, PERF_LEDGER.md. Nothing else.

---

## Session 3 — joint extractor v0 (makes dump day productive immediately)

> Build `tools/joint_extractor.py`, a read-only sibling of `tools/swj008_inventory.py`. Input: a folder of SWJ008 XMLs belonging to ONE project/cabinet (project identity comes from the folder, not the XML — the files carry `Project Name=""` and panel-local coordinates only; there is no assembly placement in the data).
>
> Method: with panel-local coordinates only, v0 matches joints by **spacing-signature correlation** — e.g., a pair of Ø15 face cam seats on panel A whose spacing along the joint line equals the spacing of a pair of Ø8 edge dowel holes on panel B → `cam_dowel` candidate. This is correlation, not geometry solving; confidence scores will be honest but modest at first. That is expected — flags are the product on day one.
>
> Known-pattern list (classify these; anything else goes to UNMATCHED, never guessed):
> - `cam_dowel`: Ø15 face seat (two depth classes exist: 12.5mm and 11mm — record which) paired with Ø8 edge ~34mm on the mating panel
> - `dowel`: Ø8 edge ~34mm pairs with no cam counterpart
> - `confirmat`: Ø7 face ~17mm + Ø4.5 edge pilot alignment
> - `shelf_pin`: Ø5×11mm front/back column pairs
> - `hinge_cup`: Ø35 face cup + nearby Ø8×11 (or screw-pilot) pair — the dump includes door panels; capture every Ø35 occurrence with its full satellite pattern, this is the missing doc-15 hinge ground truth
> - `slide_row`: Ø4.5×10 screw rows at 32mm pitch (slide/plate mounting)
> - `marking`: Ø3×1mm — positional marks, not joints
> - `groove_joint`: Type 4 grooves as back-panel joints (record groove + which panels' thickness matches its width)
> - `rafix_20`: Ø20 face seats if they appear (none seen yet)
>
> Output: `joint_decisions.json` rows `{project, panelA, panelB, family, positions_mm10, depth_class, confidence}` plus an UNMATCHED report listing every hole not assigned, grouped by hole class with counts. Never guess: ambiguous → flags, not rows.
>
> Validate against the 9 panels on hand (treat them as one project): the known Fixture 0–3 joints must all be found — the manual matching in `tests/fixtures/*.ts` is ground truth. Report matched joints, unmatched holes, and confidence distribution.

Context to give: doc 16 §1–2 only, `tools/swj008_inventory.py`, the 9 XMLs, `tests/fixtures/`. Do not give docs 17–18 or any UI/strategy material.

---

## Optional Session 4 (only if 1–3 are green and time remains)

> Catalog schema extension, doc 17 sequence step 1: add `grade`, `source`, `verified`, `media`, `packVersion` fields to the existing catalog schema types. Additive only, no behavior change, with type tests. No UI.

---

## Dump-day hygiene (you, not the coder agent)

1. Copy the raw dump to a read-only folder (`factory_dump_RAW_<date>/`) before any tool touches it; tools read from a working copy. Record provenance: date, Bazis version, which machine exported.
2. Ask the friend for **one folder per cabinet/project** (or a strict naming convention with the Bazis project name) — without grouping, cross-panel joint matching is impossible.
3. Explicitly request **door, drawer, and corner cabinet projects** (Ø35 hinge ground truth is still missing — doc 15) and the **hardware purchase list** (promotes/demotes core catalogue defaults, doctrine R12).
4. Flow: `swj008_inventory.py` → read flags → `joint_extractor.py` per project folder → first `joint_decisions.dataset.json` the same afternoon.
