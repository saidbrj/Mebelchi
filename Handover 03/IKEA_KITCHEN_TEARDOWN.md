# IKEA Kitchen Planner — Teardown & Borrow Map

**Audience:** Oppoq, Saidislom, Davron, advisors
**Author:** Oppoq (with Claude)
**Date:** June 2026
**Subject:** IKEA's free web kitchen planner, mapped to the Mebelchi 6-phase CJM as borrow / adapt / avoid.
**Companion docs:** `HANDOVER_UI_V3.md`, `MEBELCHI_STRATEGIC_MEMO.md`, `00_CJM_V1.md`, `IMOS_FEATURE_MAP.md`

---

## Why this teardown

IKEA's planner is the most polished consumer-grade version of the exact flow Mebelchi needs: a non-expert walks from "empty room" to "priced, buildable kitchen" without training. It is the clearest existing proof that the onboarding-quiz → auto-variant → refine → handoff sequence works on real users at scale.

It is also a trap if copied wholesale. IKEA solves an **easier problem** than Mebelchi: a finite, pre-validated catalog (METOD) sold to a nervous homeowner. Mebelchi solves parametric custom furniture, made by a professional, cut on a CNC, where one bad drilling file ends the company. The skill is taking IKEA's *interaction model* without inheriting its *catalog-locked, consumer-simplified* assumptions.

The single most important sentence in this doc: **borrow the onboarding feel and the constraint-driven variant generation; leave the "pick from our boxes" mental model behind.**

---

## The flow we observed

1. **Preference quiz** — 5 image-card questions (oven placement, extractor hood type, fridge type, layout shape, summary). Tap a picture; "select none or all" to express no preference.
2. **Define your space** — room shape picker (enclosed / open variants), dimensioned floor plan, openings (windows/doors), water-supply wall, ceiling height. Running price starts at £0.
3. **Choose a favourite** — 8 auto-generated, priced kitchen suggestions to flip through ("built on your preferences and room size").
4. **Make it yours** — 3D direct editing: select a cabinet, modify door/handle/cornice/cover panels, duplicate, reposition; a *Design tips / Recommendations* panel flags issues (e.g. red highlight: "place items next to each other, no space between them," with *Show in 3D*).
5. **Make it happen** — review screen, 3D render, 2D plans + elevations, dimensioned TopPlan with numbered items, itemised price breakdown, print / share / proceed.

This is a near one-to-one match with the Mebelchi CJM phases A–F.

---

## Borrow / Adapt / Avoid — by CJM phase

### Phase A — Discovery & Measurement

**BORROW**
- The **5-question image-card quiz** as the front door. It is painless for the customer *and* it is the constraint payload that drives variant generation. This is the literal embodiment of the "schoolboy test, 5 minutes" promise.
- **Constraint capture before generation**: room shape → dimensions → openings → water-supply wall. The "select the wall of your water supply to determine sink placement" step is especially smart — it eliminates a whole class of impossible layouts before any furniture exists.
- "**Select none or all = no preference**" as an explicit, low-pressure answer. Removes the anxiety of forced choice.

**ADAPT**
- IKEA's quiz is consumer-framed (oven/hood/fridge aesthetics). Mebelchi's equivalent should capture **constraints that matter to a custom build** — gas line, drain stack, outlets, immovable structure — framed in mebelchi vocabulary, not homeowner vocabulary.
- Desktop side-panels and dropdown menus → **phone bottom-sheets** (`@gorhom/bottom-sheet`, already in the stack). Copy the *order* of decisions, not the spatial layout.

**AVOID**
- Don't over-simplify to consumer level. The mebelchi knows more than an IKEA homeowner; the quiz should be fast but not condescending, and must allow precise manual entry (exact mm) at every step.

---

### Phase B — Layout / Variant Generation

**BORROW**
- **Auto-generate priced variants to flip through.** This is the "automatic furniture placement with variations" idea — and it works *because* Phase A captured constraints first.
- **Always-visible running price** on every variant. Matches the "price during design" principle directly.

**ADAPT**
- IKEA shows **8**; ship **4 deliberately** (already the call in `HANDOVER_UI_V3`). Fewer, more confident options read as curation, not an algorithm dump.
- Generation must happen **within Mebelchi's parametric grammar**, not by snapping to a fixed catalog. Scope the promise honestly: *generate constrained variants → customer confirms one → mebelchi refines precisely.* Do not promise full auto-placement of arbitrary custom carcasses — that is a far harder problem than the one IKEA solved with a finite parts list.

**AVOID**
- The catalog-locked assumption. IKEA's placement is "easy" because the solution space is small and pre-validated. Mebelchi's whole wedge (custom panels, arbitrary dimensions) is the thing IKEA structurally cannot do — don't inherit the constraint that makes their problem easy.

---

### Phase C — Configuration

**BORROW**
- **Per-item editing surfaced contextually**: select an element → Modify / Open / Position / Duplicate / Remove, plus swappable sub-parts (Door, Handle, Deco strip, Cornice, cover panels) with Style/Colour. Clean, discoverable, fast.

**ADAPT**
- IKEA swaps between fixed SKUs (VEDDINGE door, BAGGANÄS handle). Mebelchi swaps within a **supplier-grade catalog** (RAL, decor SKUs alongside friendly names) *and* allows true custom parameters. Keep the friendly-name front, expose the precise SKU/parameter behind it.

**AVOID**
- Reducing configuration to "choose from our doors." The personal **hardening panels with preset slots** are the sacred differentiator (`HANDOVER_UI_V3` §0). That has no IKEA equivalent and must not be flattened into a catalog picker.

---

### Phase D — Engineering

**BORROW**
- The **Design tips / Recommendations** pattern: non-blocking, friendly, with a *Show in 3D* jump to the problem. Good UX for surfacing issues without nagging.
- **Multi-view toggle** (floor / 3D / elevation) and **direct 3D manipulation** with an on-object gizmo. Confirms your v6-3d and Moblo-style direct-manipulation direction is the right baseline.

**ADAPT**
- IKEA's recommendation ("no gap between items") is **cosmetic**. Mebelchi's validation is **engineering-critical** — collision, drilling, the 3-gate safety system. Reuse the calm, non-blocking *presentation*, but the underlying severity is categorically higher: a Mebelchi warning can mean an unbuildable or dangerous part, not an ugly one.

**AVOID**
- Treating the X-ray / engineering view as optional polish. For Mebelchi it is the core of the professional value and the safety story.

---

### Phase E — Cost

**BORROW**
- The **itemised breakdown** (furniture & fittings, worktops, appliances, lighting) and the finance line. Clear, scannable, trustworthy.

**ADAPT / EXTEND — biggest opportunity to beat IKEA**
- IKEA only shows a *total and a breakdown*. It has **nothing** like the **smart material advisor** ("split facade and carcass materials — save 340K сум"). Real-time cost *intelligence*, not just a cost *number*, is a place Mebelchi can clearly out-perform, not merely match.

---

### Phase F — Manufacture Handoff

**BORROW**
- The handoff bundle: **3D render + 2D elevations + dimensioned TopPlan with numbered items**, plus print / share. This is essentially the Phase F handoff doc, already designed.
- The customer-confirmation review screen as a deliberate, ceremonial step.

**ADAPT**
- IKEA's output is a **shopping list / order**. Mebelchi's output is **CNC drilling files (DXF / SWJ008)** where correctness is existential. The handoff "ceremony" must carry the pre-flight checklist, provenance footer, and the safety-gate sign-off — far beyond IKEA's print button.
- Add **Telegram share** (native to the Tashkent distribution playbook) where IKEA has generic print/share.

**AVOID**
- Stopping at a pretty plan. The plan must be a *manufacturable* artifact, gated by validation, not a marketing render.

---

## Cross-cutting lessons

| Theme | IKEA | Mebelchi takeaway |
|---|---|---|
| Audience | Nervous homeowner | Professional mebelchi — fast *and* precise; Client vs Constructor modes (v6-3d) is the right split |
| Catalog | Locked (METOD, fixed SKUs) | Parametric + custom; auto-variation within grammar, not catalog snap |
| Platform | Desktop-first wide panels | Phone-first; copy IA, convert panels → bottom sheets |
| Validation | Cosmetic ("no gap") | Engineering-critical (collision + drilling + 3-gate); same calm UX, far higher stakes |
| Output | Shopping list | CNC files; "one bad file ends the company" |
| Cost | Total + breakdown | Cost *intelligence* (material advisor) — clear win over IKEA |

---

## Recommended next actions

1. **Lift the quiz pattern into Phase A** as the canonical onboarding — image cards, "none/all," constraint-first ordering. Tighten to mebelchi-relevant constraints.
2. **Confirm the 4-variant Phase B** generation scope as *constrained generate → confirm → refine*, and write down explicitly what is auto-placed vs. left to the pro, so the engineering promise stays honest.
3. **Reuse the Recommendations UX shell** in Phase D, wired to the real safety gate rather than cosmetic rules.
4. **Spec the material advisor** in Phase E as the deliberate point of superiority over IKEA.
5. Keep **hardening panels** and the **CNC-grade handoff** firmly out of any consumer-simplification borrowed from IKEA.

The headline, again: borrow the onboarding feel and constraint-driven variant generation; keep IKEA's catalog-locked, consumer assumptions out of the import.
