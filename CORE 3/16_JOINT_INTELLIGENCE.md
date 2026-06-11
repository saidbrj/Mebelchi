# 16 — Joint Intelligence (Beating the Constructor)

**Version:** 1.0
**Date:** June 2026
**Origin:** Factory visit (June 10) — the constructor uses ~50–70 connector SKUs, chosen per situation. Bazis makes the human choose; Mebelchi must choose correctly *for* the user, because B2C users cannot.
**Status:** Strategy. Becomes legislation after the first mined dataset proves the approach.

---

## 1. First, fix the vocabulary (the "thousands of joints" confusion)

Three different things were being called "joints" at the factory:

| Level | Count | Example | Who owns it |
|---|---|---|---|
| **Joint families** | ~8–12 | dowel, cam+dowel (Rastex/Minifix), confirmat, screw, shelf pin, hinge, slide, rafix/shelf support | Engine taxonomy (fixed, rarely grows) |
| **Connector SKUs** | 50–70 per workshop, thousands per brand | Rastex 15/18, Minifix 12, VB 35/36 | Catalog data (doc 17) |
| **Joint instances** | thousands per kitchen | each Ø15 cam at each position | Solver output (already works — the XML exports) |

The constructor's skill is two decisions: **family selection** (which kind of joint for this panel pair) and **SKU + placement** (which exact connector, how many, where). Both are functions. Functions can be learned, encoded, and tested.

```ts
jointResolver(partA, partB, ctx): { family, sku, positions: mm10[], reason: RuleRef }
// ctx = { roles, material, thickness, loadClass, visibility, demountable, machinePark, costMode }
```

This is exactly the rules-engine shape doc 13 already mandates: **data tables + small selection functions, no DSL.** Nothing new architecturally — what's new is how we fill the tables.

---

## 2. The knowledge acquisition loop (how we learn it)

Four sources, each feeding the same rule tables. Every table row carries a `source` field — that is your discoverability requirement satisfied: every rule is traceable to a factory project, an interview, a book page, or a standard clause.

**Source A — Mine the factory's own exports (the gold mine).**
Every Bazis project the factory ever made is a *labeled training example* of the constructor's decisions. We already parse SWJ008. Build a **joint extractor**: parse a full project's panel set, match mating hole patterns across panels (Ø15 face cam + Ø8 edge dowel at the same joint line = cam+dowel; paired Ø8/34mm = dowel; Ø4.5 pilots = screw...), and reconstruct *which family he chose for which panel pair in which situation*. We did this by hand for Fixture 0–3; now automate it. Ask your friend for **50–200 historical project exports** (kitchens + shelves, doors + drawers + corners included). Output: a `joint_decisions.dataset.json` — the constructor's brain, serialized.

**Source B — Structured interviews with the constructor.**
Not "tell me about joints." Show him mined pairs and ask *why this and not that* — only where the dataset is ambiguous or contradictory. Capture answers as table rows, never prose. One hour of his time per session, recorded.

**Source C — Books and standards (the normative layer).**
Books give the *why* and the boundary conditions the dataset can't show (he never builds wrong furniture, so the dataset contains no negative examples). See `BOOKS_AND_SOURCES.md`. Rules mined from books get `source: {book, page}`.

**Source D — AI agents, offline only.**
LLM agents (not on device, in the dev loop) read books/datasheets and *propose* table rows. Hard rule: **a proposed rule enters the catalog only with (a) a source citation and (b) a passing test against the mined dataset or a standard's acceptance criterion.** Agents draft; tests decide. No un-cited rule ships.

---

## 3. How we prove "golden standard" (and then beat him)

**Stage 1 — Match him.** Replay metric: run `jointResolver` over every project in the mined dataset; target ≥95% agreement with the constructor's actual choices. Every disagreement is either a bug (fix) or a documented justified divergence (he satisficed; we found better). This becomes a CI test like the golden suite — catalog edits can never silently change joint behavior.

**Stage 2 — Exceed him.** A human satisfices; a solver optimizes. Where several families pass the physics gate (§4), score them on: hardware cost, drilling time (machine ops count), strength margin, demountability, visibility. The constructor cannot evaluate five objectives across 40 joints in his head. We can — and we show the reason: every joint in the X-ray view gets a "why" tap (`reason: RuleRef` → human-readable, cited). Trust through explainability is the B2C unlock.

**Stage 3 — Out-of-distribution honesty.** When a configuration falls outside the dataset and the rules (weird material, 3m span), the resolver flags it for review rather than guessing. Silence is how one bad drilling file happens.

---

## 4. The physics engine (load checks, not game physics)

"Holds a 150kg man" is a *load case*, and load cases are exactly what furniture test standards define ([EN 16121 for non-domestic storage](https://hem.com/en-us/certifications/strength-and-stability), [ANSI/BIFMA X5.9, EN 1022/16122 et al.](https://www.eurofins.com/toys-hardlines/resources/articles/ensuring-furniture-durability-strength-and-load-bearing-tests-explained/)). We don't simulate a man; we check the cases.

**Grade 1 (V1.x) — closed-form checks, pure functions, phone-cheap:**
- **Shelf sag:** classical beam deflection (5wL⁴/384EI) with E per material from a `materials_physics.json` (ЛДСП/MDF/plywood values from the Wood Handbook + Bartashevich). Acceptance: span/200 or standard-specified.
- **Fastener withdrawal & shear in particleboard:** Eckelman's published equations — this is precisely what his Purdue textbook covers ("Design of Furniture Joints" chapter).
- **Tipping/stability:** moment balance with open drawers/doors per the standard's worst case.
- **Joint moment capacity:** per-family capacity tables (cited), checked against the load path.

Same architecture as drilling: **no number is a literal; every constant lives in a spec JSON with `source` and `verified`.** Output is a gate report like the safety gates: pass / fail / fix suggestion ("80kg books on 900mm shelf → 4.1mm sag → add mid-partition or go 18mm").

**Grade 2 (later) — frame matrix analysis.** Eckelman literally wrote [CODOFF — Computer Design of Furniture Frames](https://ag.purdue.edu/news/department/fnr/2023/02/tales-from-fnr-with-professor-emeritus-carl-eckelman.html) in the 1970s on hardware weaker than any phone. A small stiffness-matrix solver over the cabinet's beam skeleton runs fine inside `solveFull`. This is the "could hold 200kg without joint restriction" question — it computes margins, not just pass/fail.

**Marketing truth discipline:** until we physically test, the app says "passes EN-16121-style load case (calculated)" — never "certified."

---

## 5. Do we / can we be the most advanced mobile furniture CAD?

Honest answer: in the niche that matters — **mobile-first parametric design with verified CNC output** — nothing public combines it today. Moblo is design-only (no machining). imos/Cabinet Vision/Bazis are desktop. The moat is not any one feature; it is the *combination* plus the verification culture (goldens, mm10, cited rules) that desktop incumbents structurally can't retrofit. "Most advanced in the world" overall — not yet, and we don't need it to be true yet. Joint intelligence + physics gate + explainable "why" is the credible claim no competitor can make on a phone.

---

## 6. Sequence (slow is smooth)

1. Build the **joint extractor** over existing XMLs (we have 7 panels; it must work on full multi-panel projects).
2. Get **50–200 historical exports** from the factory (one USB stick — ask for door/drawer/corner projects explicitly; we still need the Ø35 hinge ground truth from doc 15).
3. Mine → `joint_decisions.dataset.json` → first replay metric run with a naive resolver.
4. Interviews only where the dataset is ambiguous.
5. Books arrive (see `BOOKS_AND_SOURCES.md`) → normative rules + physics constants, cited.
6. Physics Grade 1 as a fourth safety gate.
7. Replay ≥95% → multi-objective scoring → "why" UI.
