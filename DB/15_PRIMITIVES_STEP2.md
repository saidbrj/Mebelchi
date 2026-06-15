# 15 — Primitives (Step 2 Starter Pack)

**Version:** 1.0
**Date:** June 2026
**Purpose:** Build the first Layer-1 drilling primitives today with dummy specs, structured so tomorrow's real factory data slots in by editing `hardware_specs.dummy.json` only — never the functions.

---

## The one rule

**No drilling number is ever a literal in a primitive function.** Every diameter, depth, and offset comes from the spec object passed in. The function is pure geometry logic; the millimeters live in `hardware_specs.json`. This is what makes today's dummy values and tomorrow's verified values the same code.

If a code reviewer (or you) ever sees a number like `13` or `22.5` or `32` written directly inside a primitive, that is a bug — it must be a named field read from the spec.

---

## What the factory files already taught us (use these, not the research doc, where they conflict)

| Quantity | Real factory value | Research doc claim | Use |
|---|---|---|---|
| Cam seat (Ø15) depth | **11.0 and 12.5mm** | 15.5–16mm (WRONG) | factory value |
| Shelf pin (Ø5) depth | **11mm** | unspecified | factory value |
| Edge dowel (Ø8) depth | **34mm** | dowel length 30mm | factory value (drill depth ≠ dowel length) |
| Face dowel (Ø8) depth | **11mm** | — | factory value |
| Hinge cup (Ø35) | **no data** (no doors in this cabinet) | depth 13, edge 22.5 | UNVERIFIED — get a door export |

**Key lesson for the schema:** the same diameter has different depths in different operations (Ø8 is 34mm on an edge, 11mm on a face). Depth belongs to the *operation*, not the *diameter*. The spec is structured accordingly.

---

## The three primitive contracts (build today)

Each is a pure function: inputs + spec in, `Operation[]` out, in panel-local `mm10`. Zero imports from React/RN/Three. Each gets its own file and its own test.

```ts
// primitives/hingeCupPattern.ts
function hingeCupPattern(
  doorPanel: Panel,
  hingeSide: "left" | "right",
  hingePositionsY: mm10[],     // where along the door height each hinge sits
  spec: HingeSpec              // from hardware_specs.json — NO literals
): Operation[];
// produces, per hinge: 1 cup (Ø spec.cup.diameter, depth spec.cup.depth, face),
// + spec.mountingHoles.count screw holes positioned from cup center.
// cup center X = spec.cupCenterFromDoorEdge from the hinge edge.

// primitives/rastex15Pattern.ts
function rastex15Pattern(
  panelWithCam: Panel,         // panel that receives the Ø15 cam seat (face)
  panelWithDowel: Panel,       // mating panel that receives the Ø8 dowel (edge)
  jointPositions: mm10[],      // where along the joint each connector sits
  spec: ConnectorSpec
): { camOps: Operation[]; dowelOps: Operation[] };
// cam seat: Ø spec.camSeat.diameter, depth spec.camSeat.depth, on a face.
// dowel hole: Ø spec.dowelHole.diameter, depth spec.dowelHole.depth, on an edge.

// primitives/shelfPinPattern.ts
function shelfPinPattern(
  sidePanel: Panel,
  shelfHeightsY: mm10[],       // Y of each adjustable shelf
  spec: { pin: ShelfPinSpec; system32: System32Spec }
): Operation[];
// two columns (front + back row) of Ø spec.pin.diameter holes at spec.pin.depth,
// rows set back per system32 convention, on a face.
```

---

## How to prove a primitive is correct (the test that matters)

This is the leap from *fidelity* (echoing a real file) to *generation* (originating correct drilling). For each primitive:

1. Take a real factory panel you already have (e.g. `POLKA` for shelf pins / cam seats, `ORTA_BAK` for edge dowels + cam).
2. Feed the primitive the same panel dimensions and the positions, with the spec.
3. Compare the **generated** `Operation[]` against the **real** operations parsed from that panel's XML.
4. When generated == real (semantic compare, mm10), the primitive is proven against ground truth.

Until the real spec values are in, this test will diff on the dummy numbers — that's expected. The test exists today; it goes green tomorrow when the verified values land. **Write the test today against the real panel; let it fail loudly on the dummy values. That failing test is your to-do list for the factory visit.**

---

## Claude Code instruction (today)

> Build Layer-1 primitives per `15_PRIMITIVES_STEP2.md`: `hingeCupPattern`, `rastex15Pattern`, `shelfPinPattern`. All drilling numbers come from `hardware_specs.dummy.json` via a typed `HardwareSpec` loaded once — no numeric literals inside any primitive. Each primitive is a pure function returning `Operation[]` in panel-local mm10, its own file, its own test. For each, write a test that feeds a real factory panel's dimensions+positions and diffs the generated operations against that panel's parsed XML (semantic compare). Tests will fail on dummy values — that is intended; commit them failing with a clear `// UNVERIFIED SPEC` marker. Do not touch the engine entry point or any exporter. Report which tests fail and on exactly which field (diameter/depth/offset) so the factory visit has a precise checklist.

---

## Tomorrow at the factory — the exact data to bring back

For each item, you need the number AND its source (photo of datasheet, drilling card, or a Bazis export). Fill these into `hardware_specs.json` and flip `verified: true`.

**Hinge (get a real door panel export — this cabinet had none):**
- Cup diameter, cup depth
- Cup center distance from door edge (the "E" / overlay number)
- Mounting screw count, diameter, depth, spacing from cup center
- Which brand/SKU the shop actually buys (Boyard B-35H? Blum CLIP top?)

**Rastex/Minifix cam connector:**
- Which connector explains the Ø15 **11mm** holes vs the **12.5mm** holes (two depths seen — confirm why)
- Cam diameter, cam depth, dowel diameter, dowel depth
- The exact SKU on the shelf/in the purchase list

**System 32:**
- First-hole offset from edge (research says 37 — confirm)
- Confirm 32mm pitch
- The front-row and back-row setbacks from the panel edges

**One door + one drawer + one corner cabinet exported from Bazis** — these become golden fixtures 4–6 and prove the primitives against the geometry (hinges, slides, corners) the current 7 panels don't contain.

---

## The sequence

Today: build the three primitives + their failing tests against dummy specs. Tomorrow: get the four data groups above. Then: edit the JSON, flip verified, watch the tests go green. When a generated panel matches a real factory panel to 0.1mm, Step 2 is done and you have the parametric brain's first proven neuron.
