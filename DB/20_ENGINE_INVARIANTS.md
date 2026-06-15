# 20 — Engine Invariants & The Physical Test

**Version:** 1.0
**Date:** June 2026
**Status:** Legislation. These are the rules the engine checks on EVERY output before it is allowed to exist. A violated invariant = the engine refuses to export and names the failing part. This is the bottom, widest layer of the trust ladder — the safety net under everything.
**Principle:** "One CNC machine error ends the company." An invariant is a fact that must be true of every output no matter how strange the input. Software tests verify the engine against our *description* of reality; the physical test (§4) verifies it against reality itself.

---

## 1. How invariants work (simple)

An invariant is a checkable truth with no exceptions. The engine runs every invariant in this document against every generated output (preview-cheap ones on each solve; full set as the final export gate). Output is classified:

- **PASS** — all invariants hold → output may proceed (subject to the higher ladder layers).
- **FAIL** — an invariant is violated → export is **blocked**, the failing part + invariant + measured-vs-required values are shown. Never auto-fixed (the user decides — doc 16/R-U8). Never silently shipped.

Every invariant has an ID, a plain statement, the measured rule, and severity. Severity tiers:

| Tier | Meaning | On violation |
|---|---|---|
| **CE — Company-Ending** | Could destroy a panel, break a tool, or crash the spindle | HARD BLOCK at export, always |
| **GEO — Geometry** | Furniture is wrong/unbuildable but not machine-dangerous | Block at export |
| **CONS — Conservation** | Data integrity (lost/duplicated/orphaned parts, wrong sums) | Block at export |
| **DET — Determinism** | Engine must be reproducible | CI failure (caught in tests, never reaches a user) |

---

## 2. The invariant catalog

### CE — Company-Ending (the spindle-protection set)

- **CE-1 Drill depth < panel thickness.** No drilling operation's depth ≥ the thickness of the panel it enters (with a safety margin, e.g. depth ≤ thickness − 1mm for blind holes). *Drilling through = ruined panel, possibly broken bit.* The single most important rule in the system.
- **CE-2 Hole on-panel.** Every hole's center, plus its radius, lies inside the panel outline (minus a min edge-distance). No hole hangs off an edge.
- **CE-3 No hole collision.** No two holes on the same panel overlap (center distance ≥ sum of radii + min web). Overlapping bores = blowout.
- **CE-4 Known tools only.** Every diameter, every depth, every groove width is in the workshop's declared tool set. No phantom Ø13.7 the machine can't make.
- **CE-5 Groove depth < thickness.** Every saw groove (Type 4, e.g. the 4mm-wide back-panel groove) has depth < panel thickness − margin. Same logic as CE-1 for grooves.
- **CE-6 Contour inside panel.** Every Type-3 contour mill stays within the panel outline; tool offset accounted for.
- **CE-7 Min part size.** No panel smaller than the machine/edgebander can safely hold (workshop-declared minimum). Tiny parts fly off CNC beds.
- **CE-8 Coordinates within sheet/bed.** Every operation's coordinates fall within the panel, and every panel within a real sheet (links to GEO-4).

### GEO — Geometry (buildable-furniture set)

- **GEO-1 No interpenetration.** No two panels occupy the same physical space (beyond declared joint overlap).
- **GEO-2 Mating panels touch.** Panels that should join actually meet — no floating gaps, no impossible overhangs.
- **GEO-3 Widths sum exactly.** Sum of section widths = carcass internal width; sum of carcass widths + fillers = run length. No lost or gained millimeters (catches kerf/convention errors before the saw does).
- **GEO-4 Fits a real sheet.** Every panel fits within at least one declared sheet size (1830×2750 / 1830×2500 / 2070×2800 / acrylic 1220×2440…), accounting for grain lock.
- **GEO-5 Fronts cover openings.** Each door/drawer front covers its opening within tolerance; reveals/gaps within spec.
- **GEO-6 Assembly convention consistent.** Each carcass's bottom/top placement (between vs under, per Abzal's load-aware rule) is internally consistent — a panel isn't simultaneously inside and under.
- **GEO-7 Back-panel math.** Back panel size = internal dims + 2×groove_depth (groove method) or correct overlay size; setback honored.

### CONS — Conservation (data-integrity set)

- **CONS-1 Model ↔ cut list parity.** Every panel in the 3D model appears exactly once in the cut list, and vice versa. No orphans, no duplicates, no vanishing parts.
- **CONS-2 Model ↔ hardware parity.** Every fitting in the model appears in the hardware list and vice versa (feeds the Article Passport).
- **CONS-3 Area sanity.** Total cut area ≈ furniture surface area within a sane waste band — catches a panel silently doubling or disappearing.
- **CONS-4 Sheet count sanity.** Computed sheet count ≥ ceil(total area / usable) and ≥ the largest single part — never undercounts (protects margin; R-U0 §M5 small-group rule).
- **CONS-5 Price monotonic & positive.** Price > 0; a strictly larger cabinet costs ≥ a smaller identical-spec one. Catches pricing-logic inversions.
- **CONS-6 Every panel has a material + edges resolved.** No panel ships with an unresolved material/thickness/edge role.

### DET — Determinism (reproducibility set, CI-enforced)

- **DET-1 Byte-identical output.** Same input → identical canonical model and identical export, every run. No randomness, no time-dependence, no float drift (mm10 integer discipline).
- **DET-2 Mirror symmetry.** Mirroring a kitchen produces a mirrored output with identical part count and mirrored hole positions (catches face-A/B coordinate bugs — the documented risk class).
- **DET-3 Metamorphic width.** Increasing a cabinet width by Δ changes only the predictable parts (the stretched panels, repeated shelves per stretch rules); fixed parts (e.g. a fixed-width drawer box) are byte-identical. Catches unintended global side effects.
- **DET-4 Order independence.** Building the same kitchen by adding cabinets in a different order yields the same final model.

---

## 3. How invariants are enforced (the machinery)

1. **On every solve** (cheap subset: CE-1..5, GEO-3): the health light is green only if they hold. Cheap enough for the gesture path.
2. **At export** (full catalog): the hard gate. Any CE/GEO/CONS failure blocks the file. This is the spindle gate.
3. **In CI** (DET set + full catalog over the golden suite + the fuzzer corpus): every commit. A change that breaks an invariant fails the build, exactly like a wrong hole.
4. **The fuzzer feeds this:** thousands of random valid kitchens overnight, full catalog on each. Any FAIL is saved with its seed → a new permanent golden. Reality and chaos both become regression tests.

---

## 4. The physical cut-and-assemble test (top of the ladder)

**What it is:** take one engine-designed cabinet, send its real cut files to a real CNC, cut the panels, assemble. The only test that checks the engine against reality instead of our description of reality. Most expensive, most rare, most decisive.

**The four checks, in priority order:**
1. **Holes line up.** Cam bolt meets cam hole; shelf pins meet their rows. Proves System-32 math, hole positions, and face-A/B mirroring in the real world. No software test can prove this.
2. **Panels fit the volume.** A 600mm cabinet assembles to 600mm. Validates kerf compensation, assembly convention (between vs under), and the back-groove math — i.e. flips Abzal's `verified:false` numbers to `true`.
3. **It holds.** Load the shelf; push the carcass. Does real sag match the physics gate's prediction? Does it rack?
4. **A normal person can build it.** Hand the parts + Article Passport to an assembler, say nothing, watch. Hesitation = a labeling/passport failure, not theirs. Silently tests the output documents.

**Discipline:**
- **Don't cut until software is green** (joint resolver replays clean, Types 3–4 round-trip). Cutting before then burns sheets confirming known bugs.
- **Cut what teaches most:** first Type-3/4 round-trip cabinet, the corner unit, the least-certain joint family. Each cut retires a named risk.
- **The feedback loop is the point:** every physical failure → find the cause → fix the constant → turn that exact failure into a new golden/invariant so it can never recur. Reality finds a bug once; the cheap layers guard it forever. Use the slow test to *teach* the fast tests.

**Marketing-truth discipline (binding):** until a cabinet is physically cut and assembled, output is *"CNC-ready (calculated)"*, never *"verified"* or *"certified."* The saw earns the second word. (Consistent with doc 16 §4.)

---

## 5. The founder dashboard (how you know, day to day)

One screen, refreshed every commit, traffic lights — you never read logs:

| Light | Question | Source |
|---|---|---|
| Invariants | All CE/GEO/CONS passing on the golden + fuzzer corpus? | §3 CI run |
| Goldens | Known files still round-trip identical? | golden suite |
| Fuzzer | Anything break overnight? (count + worst seed) | §3.4 |
| Replay | Constructor agreement still ≥95%? | doc 16 |
| Speed | All budgets under the floor-device line? | doc 18 `npm run bench` |
| Physical | Latest cut cabinet: pass/fail + date | §4 log |

Green across the board = safe to put in front of a machine. One red = stop. That is the entire answer to "is the engine good?"

---

## 6. Sequence
1. Encode the CE set first (the spindle gate) — it's the definition of "safe" and costs only thinking.
2. Wire the full catalog into the export gate + CI over the golden suite (harness exists).
3. Add GEO/CONS as the engine grows the line/zone model.
4. Build the fuzzer once Types 3–4 round-trip; pipe FAILs to new goldens.
5. First physical cut when replay is clean — the highest-value event in the project, and the best demo.
