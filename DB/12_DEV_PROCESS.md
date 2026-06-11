# 12 — Development Process & Team Workflow

**Version:** 1.0
**Date:** May 2026

---

## The root cause of the "80–90% done" problem

The failed UI attempts were not the AI's fault, not the founder's fault, not the developer's fault. The cause was the **absence of a design source of truth**.

When AI is prompted with a vague description, it fills the unspecified 20% of decisions with guesses. Across 30 screens and three people prompting independently, this produces: three different blues, two button shapes, inconsistent spacing, components that almost-but-don't match, and the feeling that everything is 80–90% right but nothing is coherent — plus the constant temptation to rewrite from scratch.

**The fix is process, not tools: design before code, always.** The cost of changing a Figma frame is 5 minutes; a built screen, 5 hours; a built screen others depend on, 5 days.

---

## The professional workflow for a 3-person product team

### Step 1 — Lock the design system in Figma (~3 days, Oppoq)
- ~40 design tokens (colors, spacing scale, typography, radii, shadows)
- ~15 atomic components (button, input, card, toggle, segmented control, bottom sheet, modal, top bar, list row)
- patterns (wizard step, error state, loading state, confirmation)

### Step 2 — Build the component library in code, once (~5 days, Saidislom/brother)
- each component matches its Figma variant via props
- each has a Storybook page showing every state
- no business logic — pure presentation
- after this, nobody writes a Button or Card again; they compose

### Step 3 — Design every screen in Figma before building (Oppoq)
- every CJM step as a Figma frame using only library components
- auto-layout everything (components propagate automatically)
- annotate every state: empty, loading, error, success (most "80% done" gaps are missing states)

### Step 4 — Build screens by composition (week 2–3)
- now AI is excellent, because the prompt collapses to "build this exact Figma frame using only components from src/components, matching tokens in src/tokens.ts"
- creative space collapses → AI hits 95% → remaining 5% is real bugs, not taste mismatches

### Step 5 — PR-based review against Figma (continuous)
- every UI PR includes a screenshot + Figma frame link + checklist
- reviewer compares screenshot to frame; pass/fail is binary, "feels off" disappears

---

## Team split (locked)

| Person | Lane | Why |
|---|---|---|
| **Oppoq** | Designer + product owner. Owns Figma. Reviews every PR. Makes every "is this beautiful / is this right?" call. Writes some Python (DXF, labels, drilling primitives with AI assist). | Brand design is his strongest skill; founder-level call on what ships. |
| **Brother** | The hard custom frontend: 3D viewport (R3F canvas), gestures, custom rendering, Phase B & C. | Already deep in this code; 3D isn't amenable to component-library composition. |
| **Saidislom** | Component library + "boring" screens (wizards, forms, lists, settings) + all backend + CNC integration + the parametric solver. | Backend engineer who implements designs against a spec; doesn't make design decisions. |

Critical property: each person works independently for days without blocking the others. Sync only at PR review and weekly demo.

---

## "Move down coding" — the founder's literacy mandate

The right instinct, stated by the founder: use AI, but know what it's doing at the same time.

The spectrum:
- **Pure vibe coding** — "build me a kitchen screen," paste, hope. Produces 80% slop.
- **Pure manual coding** — refuse AI, write every line. Slow, wasteful.
- **The professional middle** — AI as a typing accelerator on top of human design and review.

The professional middle in practice:
1. Read and understand the code that exists; you don't write from scratch but you can tell whether output matches intent.
2. Specify precisely enough that AI output is predictable ("build this Figma frame with these components and props" — not "build a kitchen screen").
3. Review AI output like a junior developer's PR — catch bugs, taste issues, missing edge cases.
4. You are the architect; AI is the typist.

### Concrete literacy actions
1. **Use Claude Code** (the team has it). It reads the full codebase, so prompts carry rich constraints and output is far better than browser-chat AI. Feed it ONE layer at a time with the contract locked.
2. **Read the developer's code together for 2 hours** — not to debug, to understand. Trace "user enters width" → "DXF generated." Know where the cabinet model lives, where holes are computed, where export happens, what the JSON looks like at each step. This is the difference between a designer-founder who gets steamrolled and one who can hold the team accountable.
3. **Ship one small feature yourself with AI assist** — e.g. a Layer-1 drilling primitive: write the test first with hand-calculated coordinates, then have Claude Code write the function, review every line, make the test pass. Breaks the "founder can't code" psychology.

---

## Quality control (the three mechanisms)

1. **Tight constraints in prompts.** When AI has 5 degrees of freedom instead of 50, output is predictable. Reference the Figma frame, the component library, the design tokens, the contract.
2. **Acceptance criteria, not vibes.** Write the checklist before any work starts. AI generates against it; reviewer checks against it; pass/fail unambiguous.
3. **Visual regression testing** (Chromatic / Percy). Screenshots every component in every state automatically; flags unintended visual drift. Catches the subtle changes that make things feel "80% done."

---

## Tools

Non-negotiables: **Figma + Storybook + Claude Code (or Cursor).**

Optional: Penpot (open-source Figma), Builder.io / v0.dev (Figma-to-code AI), Maestro (mobile E2E), Spline (3D component prototyping).

For the engine specifically: Claude Code, fed one layer at a time, test-first. Example prompt shape: "Here's the `Operation` type. Write `hingeDrillPattern` for a Blum CLIP top hinge. Here are the manufacturer's drilling specs. Write the test first with these hand-calculated coordinates, then the function." Review every line.

---

## The standing risk to watch

A pattern across the project: a great deal of research and analysis, very few primary customer observations. Multiple documents (MVP review, CJM field-research gaps, Bazis teardown Part 7) list unknowns that only shop-floor observation resolves — none yet closed.

Every week of more research is a week the templated competitor closes the gap, and every screen designed without watching a real mebelchi may be subtly wrong. The advisors and AI can give sharp opinions; none have stood in a Tashkent shop watching a master quote and build a kitchen. The founder and factory friend have. **Primary observation is the highest-value unblocked activity.**

---

## This week's checklist

1. Create the seven-layer folder structure; empty files + READMEs describing each. (one afternoon)
2. Build and test ONE Layer-1 function end to end: `hingeDrillPattern` for a single Blum hinge. Hand-calculate expected coordinates from the datasheet, write the test, use Claude Code to write the function, make the test pass. This single proven function validates the entire method.
3. Get the real Blum/Boyard/Hettich drilling specs (mm offsets for cup holes, hinge plate screws, the 32mm system) from factory friend or distributor. Layer 1 is only as correct as this data.
4. In parallel, keep building Figma + reference screenshots (founder's lane, doesn't block engine work).

**Checkpoint:** show `hingeDrillPattern` and its passing test, with coordinates matching the datasheet to 0.1mm. That proof beats any amount of planning.
