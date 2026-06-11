# 11 — Engine Architecture (The Seven Layers)

**Version:** 1.0
**Status:** SACRED — this is the safety system, not just an org chart.
**Date:** May 2026

---

## The governing principle: fail-safe, not fail-functional

The founding fear — "one mistake and a machine is broken and there is no startup" — drives this entire architecture.

You do not achieve "I will never break a machine" by being careful. Careful fails eventually. You achieve it by making a wrong number **structurally impossible** to reach the machine:

1. Every drilling coordinate is computed by one function, in one place, never duplicated.
2. Every coordinate is validated against the panel boundary before it can be written to a file.
3. The output is SWJ008 XML (declarative geometry the machine sandboxes), never raw motor code.
4. Every drill operation has a test fixture with hand-calculated expected coordinates.
5. Nothing reaches a real machine until it passes air-cutting simulation first.

The separation below IS the safety system. When hole-placement logic lives in one tiny tested function, you can **prove** it correct. When it is scattered across screens, you can only hope.

---

## The seven layers

Each layer talks only to the layer below it, through a locked data contract. Each piece is small enough to test and prove.

### Layer 0 — Catalogs (pure data, no logic)

JSON files. Single source of truth. Read by everything, owned by no function.

- `materials.catalog.json` — ЛДСП, МДФ, ХДФ: thickness, kerf, grain, sheet size, price
- `hardware.catalog.json` — the 12 starting SKUs, each with its exact drilling pattern
- `panels.catalog.json` — panel roles and default properties
- `templates.catalog.json` — base cabinet templates (base, wall, tall, drawer, corner)

### Layer 1 — Hardware drilling primitives (the tiniest functions)

The atomized "function that puts holes." Each is a pure function: hardware item in, drill operations out, in panel-local coordinates. Each ~20–40 lines. Each has its own test file with hand-calculated coordinates. **These are the heart of the company.**

- `hingeDrillPattern(hinge, doorPanel, position) → Operation[]`
- `slideDrillPattern(slide, drawerSide, position) → Operation[]`
- `shelfPinPattern(support, sidePanel, shelfHeights) → Operation[]`
- `dowelPattern(panelA, panelB, joint) → Operation[]`
- `confirmatPattern(panelA, panelB, joint) → Operation[]`
- `eccentricCamPattern(connector, panelA, panelB) → Operation[]`
- `backGroovePattern(panel, backThickness) → Operation[]`

These are small enough to prove correct, test exhaustively, and never touch again once verified.

### Layer 2 — Parametric solver (the rules engine)

The imos-style engine. Takes a template + tweaked parameters, decides which hardware goes where, calls Layer 1 for the actual holes.

- `hingeCountRule(doorHeight) → number` — e.g. "door over 1600mm needs 4 hinges" — stored as DATA, not IF/ELSE
- `hingeSpacingRule(doorHeight, hingeCount) → positions[]`
- `shelfRule(cabinetHeight, shelfCount) → shelfHeights[]`
- `panelDecomposition(cabinet) → Part[]`
- `jointResolver(partA, partB) → jointType` — dowel vs confirmat vs cam
- `collisionCheck(operations[], panel) → valid | conflict[]` — **the safety gate; nothing passes without this**

Rules live in a JSON rule table, not in code. Adding "door over 2100mm needs 5 hinges" is a data edit. This is what stops the system collapsing when corner kitchens arrive.

### Layer 3 — Custom layer (the non-negotiable)

The master's signature panels. Lives separately so custom never destabilizes the standard path.

- `customPanel(dimensions, edges, grain) → Part`
- `customOperation(part, position, type, diameter, depth) → Operation`
- `hardeningPreset(master) → Part[]` — saved signature reinforcements, the master's craft identity
- `customValidation(part, operations[]) → valid | warning[]` — same collision gate as standard

**Design rule:** custom uses the EXACT same `Part` and `Operation` contracts as the standard path. A custom panel is just a Part the user authored instead of the solver. Full custom freedom, zero codebase fork.

### Layer 4 — Universal model (the locked contract)

Already designed in `05_CONTRACTS.md`. Everything above produces this; everything below consumes it. Machine-independent.

- `Part` — panel + operations + edges + grain
- `CutLayout` — placements + transforms
- `Project` — cabinets + parts + materials + customer

### Layer 5 — Post-processors (the translators, isolated)

One small module per output. Consumes Layer 4, emits one format. Adding a machine = adding a module, never touching anything above.

- `exportSWJ008(project) → XML` — Excitech/KDT (V1 target)
- `exportDXF(project) → DXF` — universal nesting CNC
- `exportPDF(project) → PDF` — manual saw cut map
- `exportLabels(project) → PDF` — thermal stickers
- `exportMPR(project) → MPR` — Homag (future)

### Layer 6 — Solver-to-screen bridge

The UI never computes geometry. It calls the solver and renders the result.

- `useProject()` — state hook, reads/writes the Project model
- `usePreview()` — fast 3D preview from parameters (no drilling math)
- `useSolverResult()` — calls the solver, gets Parts back, renders them

### Layer 7 — Screens (template-and-tweak UI)

Built from Figma. Pure composition. No logic. The phases from the CJM.

---

## The three safety gates (why the architecture guarantees safety)

Trace the worst case: a master makes a custom panel and places a hole. Can it break a machine?

1. The hole is created by `customOperation()` — one function, panel-local coordinates.
2. Before saving, `customValidation()` runs the same `collisionCheck()` the standard path uses. Hole outside panel or overlapping → rejected with warning. **GATE 1.**
3. On export, `exportSWJ008()` writes declarative geometry. The Excitech CAM shell reads it, validates against panel bounds again, refuses malformed geometry. **GATE 2.**
4. Before any real cut, the file runs air-cutting simulation. **GATE 3.**

Three independent gates. A wrong number must pass all three to reach a spinning drill. That is how "I will never break a machine" is achieved — not by being careful, but by building three walls. And because drilling lives in seven tiny tested functions (Layer 1), each can be **proven** correct, not hoped correct.

---

## Folder structure

```
/catalogs              (Layer 0 — JSON data)
/primitives            (Layer 1 — one file + one test per drilling function)
/solver                (Layer 2 — rules engine + rule tables)
/custom                (Layer 3 — custom authoring + validation)
/contracts             (Layer 4 — Part, CutLayout, Project schemas)
/postprocessors        (Layer 5 — one module per output format)
/bridge                (Layer 6 — hooks connecting solver to UI)
/app                   (Layer 7 — screens, built from Figma)
/tests/fixtures        (hand-calculated expected outputs per primitive)
```

Each Layer-1 function gets its own file and its own test. This is the "super logic organization" requirement.
