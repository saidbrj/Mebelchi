// ПОЛИГОН · the law registry.
//
// THE PROBLEM THIS SOLVES: we have written ~60 laws across DB/48–53 and the R58–R68 verdict.
// Nobody can hold them in their head, and "did we remember everything?" is not a question a
// person should be answering from memory while writing an engine.
//
// So every law is listed here with exactly one of three statuses, and NO FOURTH STATE:
//
//   enforced — a test proves it. The test carries [id] in its title, and the checker greps for it.
//   typed    — violating it does not compile. Names the file and symbol that makes it impossible.
//   deferred — not yet built. Names the blocker. Never a blank, never a TODO.
//
// `poligon_laws.test.ts` walks this list and FAILS THE BUILD if any law's proof does not exist.
// A law marked `enforced` whose test was deleted turns the build red. That is the whole point:
// coverage stops being a memory exercise and becomes a number.
//
// This is the same mechanism the project already trusts twice over — the settings-manifest
// bijection test, and the Пульт drift test — pointed at the laws themselves.
//
// ADDING A LAW: add the entry, then either write its test (tagging the title with [id]), name the
// type that makes it impossible, or write an honest blocker. There is no way to add a law and
// leave it unaccounted for.

export type LawStatus = "enforced" | "typed" | "deferred";

export interface Law {
  /** stable, short, never reused — this id appears in test titles */
  id: string;
  /** where it is defined, e.g. "48 §1" */
  source: string;
  /** one line, in the imperative */
  statement: string;
  status: LawStatus;
  /** enforced: the test file(s) carrying `[law:id]` in a title. A list when a law has two halves
   *  proven in different places — L8's occupant-minimums live with the sheet, its refusal-naming
   *  with the ops. Naming only one of them would be the same half-proof the registry exists to
   *  catch (see L4). Every file listed must carry the tag. */
  test?: string | string[];
  /** typed: the file and symbol that make violation fail to compile */
  typedBy?: { file: string; symbol: string };
  /** deferred: what has to happen first. Roadmap task ids (T1…T16) where they apply. */
  blocker?: string;
}

export const LAWS: Law[] = [
  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/48 — Sheet Logic
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "L0", source: "48 §1", status: "enforced",
    statement: "Invariants hold between operations, not during them; every op is one atomic named transaction.",
    test: "poligon_ops.test.ts",
  },
  {
    id: "L1", source: "48 §1", status: "enforced",
    statement: "Face ordering, not sum-of-widths: rightFace(Li) + minimum ≤ leftFace(Li+1).",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L2", source: "48 §1", status: "enforced",
    statement: "Positions are authored; a block has no width of its own, only bounding lines.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L3", source: "48 §1", status: "enforced",
    statement: "Fullness is per layer; only the carcass layer must be full.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L4", source: "48 §1", status: "enforced",
    statement: "Blocks are rectangles of whole cells; modules are not required to be rectangles.",
    // Honesty note: the module half of this IS proven (see L-MODULE). The block half is not —
    // a block cannot yet span several cells, so "rectangle of whole cells" has nothing to assert
    // against. Marking the whole law enforced on half a proof is exactly what this registry exists
    // to prevent.
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L-MODULE", source: "48 §0", status: "enforced",
    statement: "A module is derived from shared seams — a maximal set of cells not separated by a 32 segment — never authored.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "NAME-BILINGUAL", source: "founder 2026-09-12", status: "enforced",
    statement: "Every part carries two names from one file: clean Latin for the CNC file (Biesse, Homag and SCM reject Cyrillic in program names) and Russian for the assembler's label, with the hand appended in both. A through-board belongs to the WALL and names the modules it spans, never repeating its role in the module column. An unknown Cyrillic role is TRANSLITERATED, never stripped — a stripped name is an empty filename.",
    test: "poligon_naming_ports.test.ts",
  },
  {
    id: "SEAM-FREEDOM", source: "founder 2026-09-12", status: "enforced",
    statement: "Independence is a property of the SEAM, not of the cabinet. A vertical seam is shared, split or open; a horizontal at a crossing is uncut or cut — and they are decided separately, so split sides under a continuous worktop is one design, not an accident. Automation defaults to saving board; a master's tap overrides any seam either way, every decision carries its reason, and the cost of overriding is reported in boards.",
    test: "poligon_seams.test.ts",
  },
  {
    id: "PORT-LIFECYCLE", source: "founder 2026-09-12", status: "enforced",
    statement: "App 2 declares a CAPABILITY (`canShare`), App 1 makes the DECISION, because only the wall sees neighbours. No neighbour means FIXED and the cabinet makes its own panel — a cabinet placed first in the run can never arrive with an open side. A master's tap on a seam outranks both, either way.",
    test: "poligon_naming_ports.test.ts",
  },
  {
    id: "R88-GRAIN", source: "R88 §2.2", status: "enforced",
    statement: "Grain is locked in three tiers, first match wins: a material without grain frees everything; otherwise the role decides — fronts and visible sides strictly lengthwise, hidden parts free; a collection may override. A role with no declared direction REFUSES: the optimiser would rotate it 90° for three percent of a sheet and the batch arrives with mismatched fronts.",
    test: "kitchen2_outputs.test.ts",
  },
  {
    id: "CORNER-HANDLE", source: "R87 §1.2", status: "enforced",
    statement: "The corner filler post between two orthogonal runs is at least the front thickness plus the handle protrusion plus clearance — every number from the file. Below that, a drawer on the follower wall strikes the handle on the leader wall the first time it opens. Handleless fronts take the declared narrower post; none at all still refuses.",
    test: "poligon_corner.test.ts",
  },
  {
    id: "CORNER-BIND", source: "R87 §1.3", status: "enforced",
    statement: "Two walls stay FLAT 2D sheets and know exactly one thing about each other: how much of the follower's edge the leader's depth took. No volume, no boolean, no coordinate of the neighbour's cabinets — so every drag, snap and face-ordering rule keeps working unchanged.",
    test: "poligon_corner.test.ts",
  },
  {
    id: "ISLAND-ANTI-TIP", source: "R93 §3.1, пересчитано", status: "enforced",
    statement: "Tipping is COMPUTED from declared weight, drawer load and extension about the front edge of the plinth — not taken from a depth threshold. The research's blanket rule (anchor required below 900mm depth) rested on a 0.65m lever arm that does not follow from its own stated 500mm extension; recomputed honestly, a heavy stone-topped island of the same depth stands on its own and a light one tips at 900. A recessed plinth moves the fulcrum back and COSTS stability, and the refusal says so — as it says that anchoring into a heated screed needs a thermal scan first.",
    test: "poligon_island.test.ts",
  },
  {
    id: "ISLAND-OVERHANG", source: "R92 §2.2", status: "enforced",
    statement: "A material's unsupported overhang limit REQUIRES SUPPORT, it does not forbid the overhang: past the limit the engine names how many steel brackets at what pitch, and a declared bracket makes it legal. The one real refusal is past the end-post distance, where brackets do not hold whatever their thickness. A material missing from the table is reported as a GAP IN THE TABLE, never as an unsupported type.",
    test: "poligon_island.test.ts",
  },
  {
    id: "ISLAND-BACK", source: "R91 §1.1", status: "enforced",
    statement: "The back of a free-standing island faces the room. Raw HDF with staples outward is the single real refusal; cladding of at least the declared thickness, shallow cabinets back to back, and deliberately open shelving are all legal answers.",
    test: "poligon_island.test.ts",
  },
  {
    id: "ISLAND-SPINE", source: "R94 §1", status: "enforced",
    statement: "Back to back is not two cabinets touching: between the working row and the dining row runs a chase, and the engine states what lives in it — the sink drain, the hob's power line, the flat duct. Below the declared minimum it refuses with that list, because the number is a consequence of those three and not a style preference. A twin row without a spine partition is refused separately: with nothing down the middle a drawer on one side pushes the carcass into the other, and the run walks out of square.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "ISLAND-TOP-STOCK", source: "R94 §2", status: "enforced",
    statement: "Postforming comes on a 600mm strip, so an island top is checked in BOTH dimensions. When the width does not fit, the refusal offers the two real ways out rather than stopping: a jumbo slab at its declared size, or a longitudinal glue joint — and if the master takes the joint the engine accepts it and only asks that the seam not land under the sink. Past two strips even the joint fails, and that is said plainly.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-CHIMNEY", source: "R95 §1", status: "enforced",
    statement: "A fridge housing is a chimney: air enters at the plinth grille and leaves at the top, and the engine checks the whole path, not one hole. The grille's free area is computed from the cabinet's own width and refused against the declared minimum with the height it would actually need. An HDF back in the appliance bay, or a shelf at full depth, each block the column and are refused by name — the shelf with the fix that a truncated shelf is a DIFFERENT PART SIZE, not a shortened one.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-SHELF-REAR-EDGE", source: "R95 §1.2", status: "enforced",
    statement: "The shelf that was cut short to clear the chimney now has a rear edge standing in the warm, damp updraft from the condenser. That edge is banded. Banding here is not appearance — an unbanded chipboard edge in that airflow swells — so the engine refuses the part, not the drawing.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-SHELF-RELIEF", source: "R95.1, ревизия после цеховой критики", status: "enforced",
    statement: "The shelf an appliance STANDS ON is not truncated. The first version of this law cut 50mm off the back of every horizontal in the chimney, the oven's own shelf included — a built-in 550-565mm deep bears on that shelf along most of its length, and taking the back off leaves it hanging over the shaft. Air for that bay comes from two corner reliefs at the rear edge, not a slot through the middle: a slot is a routing operation on a machining centre and a corner is the same panel saw that cut everything else, so a shop without a router does not hit a part it cannot make. The relief width is COMPUTED from the required free area, not named; when the strip left between them is narrower than declared, the shelf refuses and says the bay must breathe from below and above instead.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-LEGS", source: "R95 §2", status: "enforced",
    statement: "Leg count follows the load, not the cabinet type: past the declared heavy threshold four plastic legs are refused for six, because plastic fails in shear and a loaded pantry is a shear load. A leg set inboard of the side panel is refused too — it puts the bottom panel in bending instead of passing the load straight down the side.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-LIFT-CEILING", source: "R95 §3, с расхождением + ревизия по кривизне", status: "enforced",
    statement: "The clearance a lift needs above the cabinet is a PROPERTY OF THE MECHANISM, read from its Thing file, not a single number in the engine. The research states a 45mm threshold and in the same paragraph says the front rises 40-80mm above the top; if the sweep reaches 80, 45 does not save the ceiling, so the flat threshold is not implementable as written. Aventos HF declares 80. And the ceiling is not flat: over three or four metres a concrete or plasterboard ceiling wanders a centimetre or two, so the clearance is measured at the WORST point, not where the tape happened to land. An unmeasured ceiling takes the declared deviation and the refusal says so out loud rather than pretending it was measured. The filler above the cabinet is cut OVERSIZE and trimmed on site, and the allowance is marked in the spec — cut to nominal it leaves a visible wedge at one end.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "TALL-SCRIBE", source: "R95 §4", status: "enforced",
    statement: "A tall unit holding an appliance needs a scribe strip against the return wall, or the appliance door cannot swing the 90 degrees its own shelves need to come out. The refusal is about the door's arc, not about a gap looking tidy.",
    test: "poligon_tall.test.ts",
  },
  {
    id: "ASCENDING-KEEPOUT", source: "R97, с тремя правками", status: "enforced",
    statement: "A cutout is a VOLUME and it falls downward into the carcass nobody told it about. A sink bowl drops 200mm below the worktop and its waste and trap drop half again as far in a narrower column, so the engine projects both and meets what is actually under there. Three deliberate departures from the research: a rail rotated onto its edge gains DEPTH and loses HEIGHT, not the other way round, so the cost of the rotation is stated instead of being sold as free clearance; a bowl crossing a partition is not a flat refusal but a statement that the sink stands in ONE cabinet and names the seam that must open — the refusal reappears only where physics puts it, when the merged cabinet will not pass the transport limit; and the numbers live in things/tables/dropin, because the next supplier's sink is a different sink. An induction hob's vent zone is DEEPER than the hob body itself: the appliance clears the shelf and still overheats.",
    test: "poligon_dropin.test.ts",
  },
  {
    id: "SYSTEM-32-RASTER", source: "R96, DIN 68858", status: "enforced",
    statement: "Shelf pins and slide screws land on the 32mm raster because the machine's multi-spindle head physically has its chucks 32mm apart: a position off the raster is a separate plunge per hole, which is a different price and a different time — not an error. So the engine snaps, declares how far it moved, and refuses to move further than the declared limit without a human saying so. The datum is the TOP FACE OF THE BOTTOM PANEL, never the floor and never the side's lower edge: measuring from the wrong one shifts every hole by exactly one board thickness.",
    test: "poligon_system32.test.ts",
  },
  {
    id: "SYSTEM-32-CENTERLINE", source: "R98.2", status: "enforced",
    statement: "The boring axis into a panel's END is half its thickness, computed — never a number carried over from the last order. The catalogue's 8.0 and 9.0 fall out of T/2, and so does 11.0 for a 22mm board no catalogue lists. Drilling an 18mm board with a 16mm program leaves 5.5mm of wall instead of 6.5: a confirmat expands the end from inside, and thin wall does not crack, it lifts the laminate in a blister — visible only on the assembled carcass, after the part was cut, banded and bored.",
    test: "poligon_system32.test.ts",
  },
  {
    id: "HINGE-K-SHIFT", source: "R98.1", status: "enforced",
    statement: "A hinge does not HAVE an overlay. It has an arm; the overlay follows from the arm, the mounting plate and where the cup was bored — D = C + K − H. While the overlay sits in the hinge file as a finished number, changing the carcass thickness silently breaks the door, and the shop profile already declares both 16 and 18. Moving 16→18 shifts the cup from 3.5 to 5.5; keeping the old program leaves 2mm of bare side per door and opens the reveal from 3 to 7mm, which the hinge's ±2 adjustment cannot pull back. When no declared plate brings the cup inside the mechanism's range, the refusal says by how much it misses.",
    test: "poligon_system32.test.ts",
  },
  {
    id: "CORNER-PASSAGE", source: "П-образная, 2026-09-12", status: "enforced",
    statement: "In a U the two side runs face each other, and the gap between them is measured between FRONTS, not between walls — depth eats it from both sides. Below the declared minimum it refuses; between minimum and comfort it notes and lets the customer decide. Two facing drawers that cannot both open is a separate finding with a separate fix, because one is solved by the wall and the other by the slides.",
    test: "kitchen3_ushape.test.ts",
  },
  {
    id: "CORNER-MITER", source: "R87 §1.1", status: "enforced",
    statement: "A postforming worktop corner is cut at 45° over the declared bevel where the nose is rounded, then straight across the rest; a plain butt leaves a triangular void at the nose. The joint must sit over a support — draw bolts pull two slabs together and sag the seam where nothing carries it.",
    test: "poligon_corner.test.ts",
  },
  {
    id: "R86-SIZES", source: "R86 §2.3", status: "enforced",
    statement: "Four widths, and confusing them is a whole wall wrong: the column is centre to centre; the clear opening subtracts HALF of each partition, because the other half belongs to the neighbour; the front is WIDER than the opening — it covers the partition, column less one gap; the drawer box is NARROWER — the opening less slide clearance both sides, and its HDF bottom less two grooves.",
    test: "poligon_fill.test.ts",
  },
  {
    id: "R86-EXPLODE", source: "R86 §2.2", status: "enforced",
    statement: "A drawer is five parts, not one line: front, two sides, back, and an HDF bottom in a groove. Completeness is checked by cardinality conservation — expected from the declarations against emitted from the geometry — so a loss is found WITHOUT knowing the right answer in advance. An appliance door yields hardware and no cut part.",
    test: "poligon_fill.test.ts",
  },
  {
    id: "R86-HARDWARE", source: "R86 §2.4", status: "enforced",
    statement: "Hardware counts are derived from geometry, never entered: hinges from front height by the profile's declared steps, doubled per leaf; slides one set per drawer, length the carcass depth less the back gap rounded DOWN to a declared length, refusing when none fits; the crank onto a SHARED partition is half, because the partition serves two cabinets.",
    test: "poligon_fill.test.ts",
  },
  {
    id: "R85-CLUSTER", source: "R85 §1.2", status: "enforced",
    statement: "A base run is assembled in CLUSTERS no longer than the profile's limit, and a cluster boundary always falls between cabinets, over a partition — never inside one. Floor-standing built-in appliances carry no carcass bottom and break the run for free. A cabinet wider than the limit refuses rather than being cut in half.",
    test: ["poligon_clusters.test.ts"],
  },
  {
    id: "R85-STAGGER", source: "R85 §1.4", status: "enforced",
    statement: "Seams in different layers — bottom, plinth, worktop — must be staggered by at least the declared distance in EVERY pair. Coincident seams turn the assembled run into a hinge along that line.",
    test: "poligon_clusters.test.ts",
  },
  {
    id: "R84-PIPELINE", source: "R84 §2.2", status: "enforced",
    statement: "The cut list accepts only a board that has passed the stock limit: the proof is a brand that exactly one function issues, so an unsplit run cannot be handed to release at all — not caught there, but unrepresentable. `compile()` is the single assembly point; a refused run still emits its piece, because a silently missing part is worse than a wrong one. ZIR, not law count, is the project metric.",
    test: "poligon_clusters.test.ts",
  },
  {
    id: "R71-JOINT", source: "R71 §2.3", status: "enforced",
    statement: "A slab joint must land on a support — a partition before a rail. Any support that keeps every piece within stock length qualifies; the engine takes the furthest such support, and reports the shortfall as waste rather than refusing it. No support in reach is a refusal, never a joint hanging over a drawer.",
    test: "poligon_spans.test.ts",
  },
  {
    id: "R71-CUTOUT", source: "R71 §2.3", status: "enforced",
    statement: "A joint may never fall within the declared clearance of a sink or hob cutout — water reaches the seam and the board swells. A support inside that zone is not a candidate however close it is to the ideal break.",
    test: "poligon_spans.test.ts",
  },
  {
    id: "R71-STOCK", source: "R71 §3.1", status: "enforced",
    statement: "No piece of a horizontal span may exceed the stock length declared by its material; the span's own plan reports any that does.",
    test: "poligon_spans.test.ts",
  },
  {
    id: "PHYS-SAG", source: "физика", status: "enforced",
    statement: "Free span — the longest unsupported stretch, not the board's length — is limited per role from the structural file. Chipboard creeps: past the limit the sag becomes permanent within months, and the refusal names the setting that would change it.",
    test: "poligon_spans.test.ts",
  },
  {
    id: "PHYS-RACK", source: "физика", status: "enforced",
    statement: "A carcass at or above the profile's height threshold must carry at least one rigidly fixed shelf: shelf pins give zero diagonal stiffness and the cabinet racks into a parallelogram. The tie shelf is DERIVED AS A PART, not raised as a warning — a warning gets dismissed, a part missing from the bundle gets noticed.",
    test: "poligon_spans.test.ts",
  },
  {
    id: "GOLDEN-RULE", source: "52 §0", status: "enforced",
    statement: "No construction setting lives in engine code. The engine source is scanned for numeric literals with comments and strings stripped; every exemption is listed by name with a written reason, and the exemption list is itself checked. Values are verified to come from Thing files rather than from constants declared next to them.",
    test: "poligon_settings_guard.test.ts",
  },
  {
    id: "R75-DOORHIT", source: "R75", status: "enforced",
    statement: "An inner drawer behind a swing door is refused unless the door's declared protrusion is cleared — by a zero-protrusion hinge or by a hinge-side spacer at least as wide. The refusal names both routes and the folders holding them; a spacer on the handle side or narrower than the protrusion does not count.",
    test: "poligon_drawers.test.ts",
  },
  {
    id: "R75-SLIDE", source: "R75", status: "enforced",
    statement: "A drawer box is the opening less the slide clearance on both sides and the one-sided spacer; the slide is the longest declared length not exceeding the opening depth, and a shallower opening or a sub-minimum remainder refuses rather than being fitted. Every number comes from the slide, spacer and profile files.",
    test: "poligon_drawers.test.ts",
  },
  {
    id: "R76-SPLIT", source: "R76 §1", status: "enforced",
    statement: "`boards` is TOPOLOGY — the seam between modules — and `lamination` is FABRICATION. Both make 32mm of material and they mean opposite things: a glued panel is one module with one shared seam; two boards back to back are two modules. Layers multiply thickness and never touch topology.",
    test: "poligon_laminate.test.ts",
  },
  {
    id: "R76-BLANKS", source: "R76 §2/§3", status: "enforced",
    statement: "A laminated panel decomposes into a full-depth face blank and shorter backings, flush at the front so the step falls at the back. One band of layers×thickness crosses the glued front seam; the backings' front edges take none, being inside it. The release carries both the monolith and the blanks, and the nester receives the blanks.",
    test: "poligon_laminate.test.ts",
  },
  {
    id: "R76-NOTHROUGH", source: "R76 §4", status: "enforced",
    statement: "The show face is never drilled from inside: an interior hole lives in the backing blank alone, and anything deeper than the backing less its glue margin is refused by name — it blisters the one part the customer looks at, after cutting, banding, gluing and drilling.",
    test: "poligon_laminate.test.ts",
  },
  {
    id: "R69-ISOLATION", source: "R69 §3", status: "enforced",
    statement: "A local segment with no portBinding is permanently invisible to the host layout engine: filling a cabinet with shelves adds zero global lines to the wall, and the host's track count follows envelopes and arbitrated panels only.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "R69-PORT", source: "R69 §4", status: "enforced",
    statement: "A Type exposes an Envelope and five Ports and nothing else. SHARED × SHARED yields ONE panel owned by the HOST — the shared board belongs to the wall, not to either cabinet — and each side is handed one inset per face. FIXED × FIXED is legal and reported, never silent.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "R69-CORNER", source: "R69/R72 correction 1", status: "enforced",
    statement: "A corner reservation is per height band, from the depth that band actually uses — a staircase, not a rectangle. One column at base depth for the full height leaves an unfillable hole at the upper tier. A band nothing stands in reserves nothing.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "R69-BOREHOLE", source: "R69 correction 2", status: "enforced",
    statement: "Encapsulation holds for layout and breaks, in exactly one function, for drilling: a shared panel aggregates both neighbours' hole maps and refuses opposed holes that leave less than the minimum material, any through hole meeting another, and confirmats staggered less than the shop's minimum.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "R69-OVERLAY", source: "R69 correction 3", status: "enforced",
    statement: "A front's overhang is local to the front layer and generates no line on the host track; the cut size is the cell plus the overhang. A front hanging into an obstacle below is refused with the gap named.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "R69-CLEARANCE", source: "R69 correction 3", status: "enforced",
    statement: "A front hanging past its carcass is checked against what is below it; too small a gap is refused with the measured gap and the minimum both named.",
    test: "poligon_ports.test.ts",
  },
  {
    id: "L-STACK", source: "R70 §1", status: "enforced",
    statement: "The Symmetrical Stacking Law: a horizontal segment with boards:1 is a fixed shelf that MERGES the cells above and below into one module; boards:2 is a top+bottom pair and keeps two carcasses apart. Exactly the transpose of the vertical rule, and merging closes transitively in both directions.",
    test: "poligon_stacking.test.ts",
  },
  {
    id: "L-ZONE", source: "R70 §2", status: "enforced",
    statement: "Height bands are declared in the profile as an ordered list; the engine names none of them and holds no threshold. A module resolves to ONE band from its bottom edge, except where the band declares mount 'above' (nothing is mounted there) or 'ceiling' (it hangs, so resolve from the top edge). A height above every band refuses.",
    test: "poligon_stacking.test.ts",
  },
  {
    id: "L5", source: "48 §1", status: "enforced",
    statement: "Vertical lines are global and unbroken; a block may span a line.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L5a", source: "48 §1", status: "enforced",
    statement: "A line's position is meaningful only in the spans where a board sits on it or a board terminates on it; termination is read from derived runs, never from segment boundaries.",
    test: "poligon_runs.test.ts",
  },
  {
    id: "L5b", source: "48 §1", status: "enforced",
    statement: "Two lines closer than ε (model space, 1mm) are the same line; snapping clusters against committed positions only, never chained.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L6", source: "48 §1", status: "enforced",
    statement: "A board is a maximal run of collinear segments joined at through-junctions; a change of thickness, material or grain terminates the run.",
    test: "poligon_runs.test.ts",
  },
  {
    id: "L7", source: "48 §1", status: "enforced",
    statement: "Horizontals are lines with per-segment thickness, not rows; panel-rows do not exist.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L8", source: "48 §1", status: "enforced",
    statement: "An edit breaching a minimum is refused whole and names the rule; minimums belong to occupants, not columns.",
    test: ["poligon_sheet.test.ts", "poligon_ops.test.ts"],
  },
  {
    id: "L9", source: "48 §1", status: "enforced",
    statement: "Delete produces an explicit Void (or Reserved), never a hole; 'close the gap' exists only as an explicit Absorb command.",
    test: ["poligon_sheet.test.ts", "poligon_ops.test.ts"],
  },
  {
    id: "L10", source: "48 §1", status: "enforced",
    statement: "Automatic normalization is permitted only if it provably cannot change the part list, and is idempotent.",
    test: "poligon_ops.test.ts",
  },
  {
    id: "L11", source: "48 §1", status: "enforced",
    statement: "A drag shows its legal range during the gesture; resizing takes from the neighbour, per row, only where both sides terminate.",
    test: "poligon_ops.test.ts",
  },
  {
    id: "L12", source: "48 §1", status: "enforced",
    statement: "Parts are derived from the sheet; nothing is stored that could disagree with it.",
    test: "poligon_runs.test.ts",
  },
  {
    id: "L13", source: "48 §1", status: "enforced",
    statement: "Every operation reports its legal domain before it is attempted, without mutating.",
    test: "poligon_ops.test.ts",
  },
  {
    id: "L14", source: "48 §1", status: "enforced",
    statement: "Wall length is an input, not an invariant; a change is a declared, named, refusable redistribution.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L15", source: "48 §1", status: "enforced",
    statement: "Wall extents are declared: the wall is an opening, outer faces bound it, each end is free | into-corner | against-wall.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L16", source: "48 §1", status: "enforced",
    statement: "Positions are integers in mm; every division names a deterministic residual policy.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L-JUNCT-RANK", source: "48 §2", status: "enforced",
    statement: "At a junction the higher-ranked role runs through; ties are refused, never defaulted silently.",
    test: "poligon_junctions.test.ts",
  },
  {
    id: "L-JUNCT-BOTH", source: "48 §2", status: "enforced",
    statement: "A junction state of `both` is physically impossible and refused at commit.",
    test: "poligon_junctions.test.ts",
  },
  {
    id: "L-JUNCT-SPAN", source: "48 §2", status: "enforced",
    statement: "A high-rank horizontal crossing a block that spans that height produces no board inside it.",
    test: "poligon_junctions.test.ts",
  },
  {
    id: "L-DERIVED", source: "48 §3", status: "enforced",
    statement: "Every position is derived until it is touched; touching it pins it, visibly.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "L-DEPTH", source: "48 §4", status: "enforced",
    statement: "Depth is a cascadable attribute defaulted per zone from the profile file, never derived from sheet geometry; it is GEOMETRIC, so its rules may match Tier-0 facets only.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "L-STROKE", source: "48 §5", status: "enforced",
    statement: "Design view floors a board at a minimum screen thickness and outlines it with a non-scaling stroke; the parts view is true scale with no floor and no outline. Exaggeration is a question anything that dimensions can ask.",
    test: "poligon_render.test.ts",
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/50 — Auto-grouping
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "A", source: "50 Law A", status: "enforced",
    statement: "A group is a predicate, never a list; membership is computed at resolve time and never stored.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "A-SELECTOR", source: "50 §2", status: "typed",
    statement: "A selector is declarative data, not a function, so a Theme can be serialised, shipped and diffed.",
    typedBy: { file: "src/poligon/model/cascade.ts", symbol: "Selector" },
  },
  {
    id: "B", source: "50 Law B", status: "enforced",
    statement: "A facet driving a property is single-valued for the whole part; the canonical failure (a pantry door spanning two zones) is made impossible by deriving zone at block level.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "C", source: "50 Law C", status: "enforced",
    statement: "Pins attach to part identity, are per-property, orphan visibly, and are countable.",
    test: "poligon_pins.test.ts",
  },
  {
    id: "C-STAMP", source: "59 §3.1", status: "enforced",
    statement: "A pin records the facet values that held when it was set; drift is surfaced at resolve, never auto-corrected.",
    test: "poligon_pins.test.ts",
  },
  {
    id: "D", source: "50 Law D / 51", status: "typed",
    statement: "Rules supply parameters (thickness, setback, overlay) and never write an authored number: no member of Property names a line position, and moving a line requires an Op that resolve() cannot return.",
    typedBy: { file: "src/poligon/model/cascade.ts", symbol: "Property" },
  },
  {
    id: "E", source: "50 Law E", status: "enforced",
    statement: "Nothing is inferred: every value reaching an output names the layer and the editable rule that declared it, and an undeclared property refuses rather than defaulting.",
    test: "poligon_pins.test.ts",
  },
  {
    id: "E-DIAGRAM", source: "50 Law E", status: "enforced",
    statement: "Every dimensional parameter ships a diagram (datum, direction, sign, two states); no diagram, no publication.",
    test: "poligon_things.test.ts",
  },
  {
    id: "CASCADE-LAYER", source: "50 §2", status: "enforced",
    statement: "The highest matching layer wins outright; a narrower predicate never beats a higher layer.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "CASCADE-CONFLICT", source: "50 §2", status: "enforced",
    statement: "Two rules disagreeing within one layer is a Conflict that names both — never a tiebreak by source order.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "CASCADE-TOTAL", source: "50 §2", status: "enforced",
    statement: "The system layer is total; resolution can never return nothing.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "CASCADE-TAGS", source: "50 §1", status: "enforced",
    statement: "Tags live on blocks and modules, never on parts; a rule matches a part through its block's tags.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "FACET-TIER", source: "50 §5", status: "enforced",
    statement: "Tier-0 facets are knowable from topology; a rule setting a geometric parameter may match Tier-0 only.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "BLAST", source: "50 §6", status: "enforced",
    statement: "A rule editor answers 'what would this change' — and what it would NOT change — without mutating.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "THEME-ATOMIC", source: "50 §4", status: "enforced",
    statement: "Theme install is atomic: entirely, or not at all, with a full diff computed first. One bad rule refuses the whole pack.",
    test: "poligon_themes.test.ts",
  },
  {
    id: "THEME-CONTRACT", source: "50 §4", status: "enforced",
    statement: "A Theme declares the facets it needs and fails visibly at install if the project lacks them — it never matches nothing silently.",
    test: "poligon_themes.test.ts",
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/51 — Law D under stress
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "D1", source: "51 §3", status: "enforced",
    statement: "Authored numbers are line positions on lines with stable IDs; everything else is derived.",
    test: "poligon_sheet.test.ts",
  },
  {
    id: "D2", source: "51 §3", status: "enforced",
    statement: "Rules set only declared parameters — refused at load, naming what is declared — and cannot invent parts, since only the closed Op union creates a board.",
    test: "poligon_things.test.ts",
  },
  {
    id: "D3", source: "51 §3", status: "enforced",
    statement: "Every placing parameter declares its frame: the part, the datum face, the direction, the inward-positive sign and the composition mode. Without one it cannot publish.",
    test: "poligon_things.test.ts",
  },
  {
    id: "D4", source: "51 §3", status: "enforced",
    statement: "Resolve is pure and never moves a line; anything that must move a line is a Migration — explicit, previewed, atomic, refusable.",
    test: "poligon_migration.test.ts",
  },
  {
    id: "D5", source: "51 §3", status: "enforced",
    statement: "Thickness is a geometric material property; a rule may change material within a thickness class, crossing one is a Migration. The classes are read from the profile file.",
    test: "poligon_migration.test.ts",
  },
  {
    id: "D6", source: "51 §3", status: "enforced",
    statement: "Hardware declares its geometric consequences (overlay, gap, reveal, clearancePerSide) as parameters or it cannot publish; the engine holds none of them as constants.",
    test: "poligon_things.test.ts",
  },
  {
    id: "D7", source: "51 §3", status: "enforced",
    statement: "Quantised parameters declare their allowed set; the system presents legal members and never picks one.",
    test: "poligon_things.test.ts",
  },
  {
    id: "D8", source: "51 §3", status: "enforced",
    statement: "Stratification: no property may be matched by a predicate over a facet downstream of that property — checked at rule-authoring time.",
    test: "poligon_cascade.test.ts",
  },
  {
    id: "D9", source: "51 §3", status: "enforced",
    statement: "Parameters contribute constraints that are checked, never solved; outside its declared domain a rule does not match and falls through.",
    test: "poligon_things.test.ts",
  },
  {
    id: "D10", source: "51 §3", status: "enforced",
    statement: "Application is atomic — one refused op refuses the whole migration; a domain miss is reported as a finding with the accepting range beside it, never thrown.",
    test: "poligon_migration.test.ts",
  },
  {
    id: "D11", source: "51 §3", status: "enforced",
    statement: "P5 validates minimums, per-layer collisions and material domains; P6 validates feasibility — material, sheet size, transport. Every finding names its law.",
    test: "poligon_governance.test.ts",
  },
  {
    id: "D12", source: "51 §3", status: "enforced",
    statement: "Three dimension planes — nominal, model, cut. Banding, kerf and tolerance exist only in Cut, which is terminal.",
    test: "poligon_release.test.ts",
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/52 — Magic Separation
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "MS-BOUNDARY", source: "52 §1", status: "enforced",
    statement: "Policies, tables and catalogs are data; invariants are code. If editing it can produce a model that is wrong rather than merely different, it is code.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-FOLDER", source: "52 §2", status: "enforced",
    statement: "A Thing is a folder: def.json + a REQUIRED diagram + examples/ that must pass to publish.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-UID", source: "52 §4", status: "enforced",
    statement: "Things are referenced by uid, never by filename; renaming a file never breaks a project.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-FORK", source: "52 §4", status: "enforced",
    statement: "Editing a downloaded Thing forks it; a publisher update never overwrites a fork.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-RETIRE", source: "52 §4", status: "enforced",
    statement: "Things are retired, never deleted; retired Things still resolve for old projects.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-LOCK", source: "52 §5", status: "enforced",
    statement: "Every saved project embeds a lock of (uid, version, content-hash) over each Thing's fields; a mismatch refuses to produce a cut list.",
    test: "poligon_lock.test.ts",
  },
  {
    id: "MS-OWNER", source: "52 §6", status: "enforced",
    statement: "Each parameter has exactly one owning kind; a Thing writing a field it does not own is rejected at publish.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-DECLARATIVE", source: "52 §7", status: "enforced",
    statement: "Thing files contain values, enums and references only; computation names an algorithm from an enum implemented in code.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-ACYCLIC", source: "52 §10", status: "enforced",
    statement: "The reference graph is acyclic, checked at publish, never discovered when a customer opens a file.",
    test: "poligon_things.test.ts",
  },
  {
    id: "MS-REVERSE", source: "52 §9", status: "enforced",
    statement: "Editing a shared Thing computes its blast radius across projects first, and a commit whose acknowledged count does not match the current radius is refused.",
    test: "poligon_lock.test.ts",
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/53 — Release and Parts
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "REL-PLANE", source: "53 §1", status: "enforced",
    statement: "A part carries three planes — NOMINAL (centreline, what was drawn), FINISHED (assembled, after junctions) and CUT (the saw, after banding) — all three always shown, the choice of which to work in left to the user. They are three measurements of one board, not a descending chain: finished may exceed nominal where a board runs through its end boundary. The kerf is charged against sheet yield, never subtracted from a part.",
    test: "poligon_release.test.ts",
  },
  {
    id: "REL-IMMUTABLE", source: "53 §2", status: "enforced",
    statement: "Parts are always derived; a Release is a signed, numbered, immutable snapshot. Changing the design makes Release 2, never mutates Release 1.",
    test: "poligon_release.test.ts",
  },
  {
    id: "REL-NUMBERS", source: "53 §2", status: "enforced",
    statement: "Part numbers are assigned at release and never reused within a job; renumbering is scrap, not a UI annoyance.",
    test: "poligon_release.test.ts",
  },
  {
    id: "REL-NODELETE", source: "53 §3", status: "enforced",
    statement: "There is no delete-part operation; deletion is setting a segment to no board, so the sheet stays the single source of truth.",
    test: "poligon_migration.test.ts",
  },
  {
    id: "REL-OVERRIDE", source: "53 §4", status: "enforced",
    statement: "Overrides are keyed to part identity, numeric ones default to deltas, and a drifted or orphaned override surfaces as a conflict.",
    test: "poligon_release.test.ts",
  },
  {
    id: "REL-HANDED", source: "53 §5", status: "enforced",
    statement: "Handedness and grain direction are required attributes at release, not optional.",
    test: "poligon_release.test.ts",
  },
  {
    id: "REL-PREFLIGHT", source: "53 §1", status: "enforced",
    statement: "Release runs a pre-flight completeness check, including refusing or loudly warning on a wall still marked estimated rather than measured.",
    test: "poligon_release.test.ts",
  },

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // DB/59 — verdict amendments and permanent conditions
  // ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "V-NOSOLVER", source: "59 §2", status: "enforced",
    statement: "Every feature passes the two-part test: phase fixed at authoring time, and every cross-number computation a closed pre-inverted enum member.",
    test: "poligon_ops.test.ts",
  },
  {
    id: "V-FENCE", source: "59 §2, §6.1", status: "enforced",
    statement: "The legality oracle may never be repurposed into a search over the constraint space ('suggest a fix' is where the no-solver law breaks first).",
    test: "poligon_ops.test.ts",
  },
  {
    id: "V-ROUNDTRIP", source: "59 §2", status: "enforced",
    statement: "Both surfaces stay authoritative only while all three hold: one shared legal-domain function (this module has no mutator), zero escape hatches, and truly canonical printing — print→parse→print is byte-identical and input order does not survive.",
    test: "poligon_fdl.test.ts",
  },
  {
    id: "V-GRAMMAR-PIN", source: "59 §2", status: "enforced",
    statement: "The grammar version is pinned in the document's first line; non-conforming syntax is refused mechanically with no override flag, and a new construct is a breaking change needing a named migration.",
    test: "poligon_fdl.test.ts",
  },
  {
    id: "V-PROVENANCE", source: "59 §3.2", status: "enforced",
    statement: "Provenance at selection: for each property, the value, the layer, the rule that set it, and whether a pin has drifted.",
    test: "poligon_pins.test.ts",
  },
  {
    id: "V-CORPUS", source: "59 §3.3", status: "enforced",
    statement: "Реальные раскроенные стены — независимые ворота проверки: приём только человеком, только настоящие работы, не больше десяти в квартал, и replay сверяет движок с тем, что цех реально отпилил. Kitchen #1 (R74 §4) в корпусе — и на первой же работе вскрыл три производственных дефекта: дно и цоколь идут доской 4.5 м, шов столешницы посчитан но до раскроя не доходит, 18 деталей вместо 70-100. Закон о том, что ворота РАБОТАЮТ, а не о том, что кухня готова.",
    test: ["kitchen1_golden.test.ts", "poligon_corpus.test.ts"],
  },
  {
    id: "V-AUTOAPPROVE", source: "59 §3.3", status: "enforced",
    statement: "Auto-approval is permitted only for a change touching neither a law nor the legality oracle; anything else routes to a person.",
    test: "poligon_governance.test.ts",
  },
  {
    id: "V-REPRINT", source: "59 §3.4", status: "enforced",
    statement: "Reprints are unconditional forever: every Release is archived, signed, hash-verifiable and exported into the customer's own possession, needing no engine and no vendor.",
    test: "poligon_release.test.ts",
  },
  {
    id: "V-AI-TIER", source: "59 §3.5", status: "enforced",
    statement: "A model authors Tier 1–2 only; Tier-3 topology is proposed, never committed; catalog IDs, junctions, the Cut plane and self-approval are permanently off-limits with no setting that permits them.",
    test: "poligon_governance.test.ts",
  },
  {
    id: "V-VOCAB", source: "59 §3.6", status: "enforced",
    statement: "A Type stays private until the file's threshold of separate JOBS has used it, and the live count may not pass the declared cap; both numbers are read from the vocabulary table.",
    test: "poligon_governance.test.ts",
  },
];
