# ROADMAP — what makes this a professional tool

The gap between "a good kitchen visualiser" and something a designer uses instead of Bazis or
Pro100. Written down so the list survives a break in the work.

Each item says **what is missing**, **where in the code it lands**, and **what it depends on**.
Status is one of `DONE`, `PARTIAL`, `TODO`. Keep it honest — a half-built feature is `PARTIAL`,
not `DONE`.

---

## Done

### 1. Фартук — the wall panel between counter and wall units · `DONE` (29 Aug 2026)
A real derived element, not a texture. `apps/app/src/model/wallPanels.ts` computes the bands from
the resolved layout on every render; the 3D draws them, the quote prices them.

- decor follows the counter by default, mapped in the same run space, so the veining runs off the
  worktop and up the wall as one slab (`three/pbr.ts wallUV`)
- holds one height across gaps in the wall units; steps down only for the hood
- breaks at a pantry column, stops at a window, reaches the side wall across the scribe gap
- sockets are punched **through** it as real holes (`PanelBand.cuts`)
- priced: a `worktop`-decor фартук bills the counter's running-metre rate; sheet stocks per m²

### 2. Floor-to-ceiling — the closing panel above the top row · `DONE` (29 Aug 2026)
Same derivation. The old code only drew a scribe when the gap happened to be ≤120mm, so the
commonest low-ceiling case (one row of uppers, ~300mm of dead wall) was never closed. Now a real
panel with a `maxGap` limit — past it, the wall wants another ROW, and the UI says so.

---

## Next up

### 3. LED lighting · `DONE` (30 Aug 2026)
`model/ledStrips.ts` — four zones (`under` / `plinth` / `cornice` / `interior`), derived from the
resolved layout, never stored. A strip's length is nobody's typed number: it is the length of the
row it is screwed to, so moving a cabinet re-measures the strip, the driver and the price with it.

THE UNDER-CABINET STRIP AND THE UNDERSIDE PANEL SHARE `hungSpans`. That helper was pulled out of
`undersideBands` rather than copied, because a light that hangs off the end of the panel it is
screwed to is the kind of drawing that gets built wrong. A test pins the two together.

**3D**: an emissive bar plus a painted falloff — NO light is added to the rig. The light count is
fixed for the life of the scene on purpose (adding one recompiles every material), and a kitchen
carries up to eight strips. What you read as light is a `DataTexture` alpha ramp; at this scale
nobody can tell, because a bright line with a falloff under it is what light looks like.

THE WASH HAS TO CLEAR THE ФАРТУК. A gradient laid on the wall is drawn INSIDE the splashback
standing off it, so the light vanishes on exactly the kitchens that have one — the same trap the
фартук itself fell into against the paint. It stands off past the thickest panel on the run.

**Also drawn in the front elevation**, deliberately: that is the surface a seller works on, and the
фартук already taught that a switch whose effect is only visible in another view reads as broken.

**pricing**: `HardwareRate` gained an optional `pricePerM` — a hinge is priced per hinge and a reel
per metre, and reusing one field for both would make the quote's own unit column a lie. Four SKUs
(strip, profile, PSU, sensor), seeded with real UZS rates. The driver is SIZED to the load rather
than counted per run, which is why a 6m kitchen quotes two and a 2m kitchen quotes one.

CORNER UNITS ARE LIT (fixed 30 Aug, reported from use). `hungSpans` excludes them, which is right
for a flat PANEL — a rectangle across a chamfered prism is the wrong shape and stands into the room
— and wrong for a strip, which has no shape to get wrong. Reusing a filter whose justification does
not transfer is exactly how the corner came out dark under lit neighbours. A corner takes its own
length of profile (its front meets its neighbours' at an angle) and, because it belongs to the zone
BOTH adjacent runs exclude, it shows in two elevations — so it is deduped by cabinet id. Two strips
would cross under one box and bill its length twice.

AND IT FOLLOWS THE CORNER'S OWN FRONT (second report, same day). The first fix emitted the strip in
one run's WALL space — a straight bar spanning the whole 613 corner square, which came out hanging
past the cabinet into the room. A corner's face is never a straight length parallel to a wall: it
is a 45° chamfer (`diagonal`, an upper's default, matching its diagonal door) or an L that turns a
right angle (`l`, a base's default). So the model measures the real front — `w − arm` reached
once across the hypotenuse or twice around the L — and the 3D builds it in the CABINET's own group
off the same `footPts` the body is extruded from, which is what makes it impossible for the light
and the box to disagree about where the front is. Verified live: 372mm at −45° under a 613 chamfer,
where it used to be 613mm parallel to a wall.

AND IT LIGHTS SOMETHING (third report). The corner got a bar and no WASH, so the фартук's light ran
the length of each wall and stopped dead at the corner with a lit strip visible above the dark
patch. The corner unit's two back sides are against the two walls, so it now washes both — which is
exactly the gap between where one wall's wash ends and the next begins.

That report also turned up a defect affecting EVERY strip: `three/VariantScene.tsx` re-walks the
finished kitchen and turns shadows on for every mesh it does not recognise, overriding what
`buildKitchen` set. So every wash plane was casting a shadow — an additive plane painting a dark
rectangle over the exact patch it exists to brighten. LED meshes now carry `userData.led` and are
skipped there, the same way painted-on contact shadows already were.

AND ONE WALL OF THE CORNER STILL WENT DARK (fourth report, diagnosed correctly by the user as the
light sitting behind the фартук). The corner's two quads were placed exactly ON the splashback's
front face while the straight runs cleared it by 4mm — flush is a z-fight, and a z-fight resolves
per surface and per viewing angle, so one wall won and the other lost with nothing in the code to
tell them apart. Both now use one `LED_WASH_CLEAR` constant so they cannot drift again.

Default: `under` on, the rest off. A kitchen without task light is not one anybody specs today; the
other three are design choices with a real cost and are asked for rather than billed by surprise.

### 4. Built-in / undermount sink · `DONE` (31 Aug 2026)
`model/sink.ts` — `SinkSpec` (mount / bowls / size / offset), read through `sinkOf(c)`, with only
the EDITS stored on the cabinet so a spec that grows a field migrates nothing.

**THE HOLE IS THE POINT.** A sink's MOUNT is defined by how its bowl meets the slab's CUT EDGE, so
the opening had to become real geometry: hide it under a rim and подстольная / integrated cannot be
drawn at all. The slab is now one extruded shape with a hole — the same thing the notched backs and
the socket-cut фартук already do — which keeps it one mesh and one UV.

The four mounts differ in exactly one place, which is the one place a client looks: `overmount`
stands its rim proud, `inset` lies almost flush, `undermount` has no rim so the slab's own cut edge
shows, and `integrated` is cut from the counter's own material.

**A rimmed mount cuts SMALLER than the bowl** (the rim has to land on slab); a rimless one cuts it
exactly, because there is nothing to cover an overcut with. Then it is made to fit: rails keep the
slab in one piece, and the tap zone keeps the tap out of the bowl.

**A BOX WITH A HOLE IN ITS COUNTER HAS NO LID** — found by looking at the render, where the opening
was real and you saw the carcass's top board through it. Fixed in `constructionOf` (topMode →
`stretchers`) rather than in the 3D, because a top board nobody can fit is also a board nobody
should be CUTTING: the parts list was ordering it too.

**Pricing**: `Project.worktopCuts` → `millPerM` contour. A cooktop's opening counts for free — it
is the same operation, and a kitchen quoted as though its hob sits on an uncut slab is quoted
wrong. Derived inside `projectFromCabs`, so every pricing path gets it without asking.

Default `inset`, which is what a modern kitchen fits. It changes how an existing project LOOKS but
not what it costs — `millPerM` is seeded at 0 until the seller sets their rate.

UI: a «Мойка» tab in Стиль, shown only for a sink module, with a readout of the derived opening.

Still missing: the opening does not reach the DXF (the counter is bought by the metre, so it is not
a nested part), and there is no drainer board.

### 5. First-class panel model + arbitrary cutouts · `PARTIAL` (31 Aug 2026)

**THE CUT-OUT was made first-class on 30 Aug; the PANEL now has a ROLE and per-role overrides.**

Every panel in a box has always been derived from the module (`packages/pricing/src/parts.ts`
`carcassPanels`) and every one of them took the carcass's own depth. That is right for a side and
wrong for a shelf: shops routinely cut shelves shallower so a door closes clean over the front edge,
and there was no way to say so — the cut list ordered a full-depth board and the 3D drew one. It is
the thing the user asked for by name after the GOLA work.

- **`PanelPart` (schema)** names the vocabulary that already existed as a cut-list naming convention
  («shelf-2», «side-left», «stile-1») and was re-parsed from strings by everyone who needed it.
  `DerivedPanel.part` carries it, typed, so nobody parses a name again.
- **`Module.panels: Partial<Record<PanelPart, PanelOverride>>`** — keyed by ROLE, deliberately not
  by individual panel. A shop decides that SHELVES are 500, not that this one is. Per-panel control
  is a much larger feature and this is not it.
- **`panelDepth(m, part)`** in pricing and **`panelDepthOf(c, part)`** in the app are the twin
  accessors, and a test asserts they agree — the 3D must draw the board the cut list orders.
- Clamped to the box both sides: a shelf deeper than its carcass does not go in, so an override
  saying so is a mistake rather than a preference. Setting it back to the full depth CLEARS the
  override rather than storing it, or a later resize would leave the shelf frozen at today's number.

UI: «Глубина полок» + «Глубина перегородок» in `DimControls`, beside W/H/D.

THE BUG WORTH REMEMBERING: a fronted cabinet's shelves are drawn by `buildInterior` (the interior
BEHIND a door), which is a second copy of the same loop as `buildCells`. The first cut updated only
one of them, so a shallow shelf priced at 300 and rendered at 560. No screenshot could catch it —
from any ordinary camera you cannot look inside a base cabinet — so `tests/shelfDepth3d.test.ts`
asserts on the built GEOMETRY instead.

**PER-ROLE EDGE BANDING landed on top of it the same day**, and closing it found a real hole in the
quote: **shelves and dividers were banded by nobody.** The visible tape was the fronts' perimeter,
the hidden tape was the box's front frame, and the boards between them fell through the gap — while
every shop bands an interior board's front edge, because raw chipboard inside a cabinet swells and
looks unfinished. `PanelOverride.banding` («none» / «front» / «all») with `front` as the default for
shelf and divider, `none` for everything else — the shell's frame is billed once per BOX (which is
where merging shows its saving) and the fronts are already walked, so counting either again would
bill it twice.

THIS MOVES EXISTING QUOTES UP, and that is the point: they were short. The hand-worked total in
`priceProject.test.ts` moved by exactly that kitchen's one shelf edge — 0.568m at 5500/m = 3124 —
and its derivation was re-worked rather than the number bumped.

**What is still open here:** per-role MATERIAL, GOLA notches are still special-cased, and there is
still no per-individual-panel control.

### 5b. The old item 5 note, for reference · `TODO`
**There is no panel entity.** Panels are derived on the fly into `DerivedPanel` at pricing time
(`packages/pricing/src/parts.ts`) and drawn separately in 3D, so a cutout has nowhere to live.
`model/gola.ts` already admits this in a comment: *"Per-panel manual cuts (a divider shallower than
the carcass, an arbitrary notch) are a later, separate feature on a first-class panel model."*

- **model**: `PanelSpec { role, w, h, t, cutouts[] }`, cutout = rect | circle | notch in panel-local
  mm. Derived ONCE and consumed by 3D, parts list, DXF and drilling
- **pipes**: `Fitting` already carries wall / position / width / height / mountY. Add a `plumbing`
  category and derive the back-panel notch from the clash between fitting and cabinet — place the
  pipe once, the cabinets notch themselves, and the notch reaches the cut list because it lives on
  a real panel
- **also unlocks**: GOLA notches become a special case; the sink cutout (item 4); the фартук's
  socket holes stop being a private `PanelBand.cuts` array
- **depends on**: nothing, but everything else leans on it.

### 6. Free placement + the cabinet editor that persists · `PARTIAL` (31 Aug 2026)

**THE VERTICAL AXIS IS DONE.** Horizontal free placement already existed and was easy to miss: the
2D plan drag and the 3D move/rotate gizmo both write the same `px/pz/rot` transform, so a module
could already go anywhere on the floor. What nothing could do was LIFT one — `mountY` meant "the
bottom of the carcass" but only a WALL unit was allowed to have it, so a base or a tall was pinned
to the floor. That is the axis «additional rows» needs, and it is what was actually missing.

`mountY` now means the same thing for every kind (`model/bands.ts` `isFloating` + `cabBand`), and a
floor module that has one is HUNG. That is not cosmetic:

- **no plinth.** The plinth is the thing a base stands on; one that is not standing has none.
  `constructionOf` returns `plinthMode: "none"` (a new member of that union), the 3D skips the
  toe-kick, and the elevation stops drawing a band of it INSIDE the box.
- **навесы instead.** `hangingCount` used to test `kind === "upper"`; it now asks what CARRIES the
  box (`carcassHangs`), because a hung base is held by brackets exactly like a wall unit is.
  Quoting one without them is quoting a cabinet nobody can fit. Module gained `hung?: boolean`.
- the carcass, the doors and the worktop all ride up with it — the 3D read `PLINTH` directly in
  three places where it should have been reading the canonical band's `carcass0`.

UI: an «На весу» switch + «От пола» slider in `DimControls`, so it appears in the Размер sheet AND
the studio without either one drifting. Verified live: the box floats, keeps its counter, drops its
toe-kick, and the ticker moves by exactly the brackets. `tests/floating.test.ts` (15).

**AND IT IS DRAGGED, NOT TYPED** (31 Aug 2026). The slider shipped first and was the wrong shape:
the recorded lesson from the pipe work is that placement wants direct manipulation. The vertical
handle already EXISTED — the whole drag path, live guide, magnet and mm readout — and was simply
gated to wall units. Opening it to floor modules was three gates and a commit rule:

- the handle shows for a floor module whether it is tiled or free. For a WALL unit the row owns the
  height, which is why a gridded one is left alone; the sheet owns a floor module's COLUMN, not its
  elevation, so there is no such reason there.
- the drag's floor is 0 for a floor module (a wall unit still cannot come below the counter), and
  the live readout measures to the FLOOR — the thing it is no longer standing on — not the counter.
- **dragging it back down makes it STAND**, which is the absence of a `mountY`, not a `mountY` of
  120. Committing the raw number would leave a box that looks seated and is priced as hung.

Verified live end to end: the ⇕ handle appears beside the move handle on a base, dragging up gives
`mountY 812 / floating / plinthMode none`, dragging back down gives `mountY null / standing /
plinthMode box`.

**THE TWO RISKS I NAMED ARE CLOSED** (31 Aug 2026), and closing them found one real bug.

- the SHEET was fine. A lift changes an ELEVATION and the sheet owns COLUMNS, so a tiled module
  keeps its cell, its lift survives the next reconcile, and nothing is dropped or duplicated. That
  was the reasoning the ⇕ handle was opened on; it is now four tests rather than an argument.
- the ФАРТУК was fine too, and better than expected: the splash already takes its start line per
  STRETCH rather than from a project constant, so it follows the lifted counter up and leaves the
  neighbours' panel exactly where it was. A box lifted above the wall units simply gets no panel.
- **the PLINTH LED strip was drawing under a box with no plinth.** A plinth strip lives in the
  toe-kick recess; a hung box has no recess, so it hung in open air lighting the floor from
  nowhere — and was billed for. Now excluded, and the run BREAKS at the lifted box instead of
  running straight through the gap under it.
- the painted CONTACT SHADOW was doing the same thing in the 3D — a decal that says «this touches
  the floor here», under a box clearly above it. Suppressed for base, tall and corner alike.

The shape to remember: everything derived from «what is standing there» has to ask whether it still
IS. `tests/liftRisks.test.ts` (10) exists to catch the next one.

**What is still open here:**
- the studio's Phase 3 (persist joints + per-role edges onto the module, wire to pricing/CNC) —
  see the `custom-furniture-editor` memory for the locked plan
- item 5's stored panel entity, which per-panel manual control still waits on

---

## Second list (30 Aug 2026)

### 7. One continuous panel under the wall units · `DONE`
A third `PanelBand` kind (`underside`) in `model/wallPanels.ts`: one plane per ROW of wall units,
merging across the joins between cabinets but not across a real hole in the row, and reaching the
side wall like the фартук does. The 3D SUPPRESSES the per-cabinet bottom board wherever the plane
covers it (`hollowCarcass(..., noBottom)`) — it replaces those boards rather than sitting under
them, so it is the same material drawn as the one surface it looks like, and it is deliberately
**not** priced as an extra panel. Merging the actual CUT into one long board is a different and
cheaper thing, and this app already has it: that is what `carcassGroup` does.

### 8. Wood grain — direction and slab matching · `DONE`
Fronts were plain boxes with 0..1 UVs, so the grain restarted at every door edge and a 300mm drawer
face showed as many rings as a 900mm one. `three/pbr.ts slabUV` maps them from their position ON
THE WALL instead — metres along the run, metres above the floor — so a bank of fronts reads as one
board. Direction is `KitchenStyle.grainHorizontal` (store `setGrain`), applied through `Mats.grain`
so it reaches every front builder without a new parameter on each.

### 9. Socket blocks · `DONE`
`ELECTRIC_CATALOG` gained 3-gang, 4-gang and a mixed sockets+switch block. The 3D plate now takes
the fitting's REAL width with one inset face per gang — it was a fixed 120mm square whatever the
catalog said, which would have put a 300mm hole in the фартук behind a 120mm plate. The auto-cut
itself came with item 1.

### 10. Corner cabinet with two doors · `DONE`
`Cabinet.cornerDoors: "single" | "pair"`. A pair puts one leaf on each arm, hinged at its own outer
end, opening opposite ways and meeting at the notch — the two hinge points are exactly the two the
single L-door chooses between. Priced as two leaves and two hinge sets via a two-column cell tree
in `toProject.cornerPairLayout`.

### 11b. A linear luminaire lights like a LINE · `DONE` (30 Aug 2026)
Reported from use: switching «Тип» to «Линейные» changed the fixture you could SEE into a bar and
changed nothing about the light. The bar was 2.4m long and lit the room from a single point at its
centre, so a linear kitchen was lit exactly like a row of downlights — the one difference a client
can actually see, and it was not there.

The rig's light count is fixed for the life of the scene (adding one recompiles every material), so
the fix is to SAMPLE the bar with the lamps that already exist: the lit ones spread along its
length and their pools overlap into a wash down the room. Which is what a linear luminaire is — a
row of diodes behind a diffuser. `lampCount` therefore means "how many samples" under this kind,
and the number of BARS is derived from it; one fixture BODY per bar, not one per lamp, or the
samples would each draw their own 2.4m luminaire stacked on the last.

Pinned by `tests/lampLayout.test.ts`, which drives a real rig with a stubbed renderer.

### 11. The ceiling · `DONE`
`makeRoom` builds one, single-sided and facing down, and it culls on the same principle as a wall —
a wall by which side of it you are on, the ceiling by whether you are under it
(`VariantScene.updateCull`). The downlights got visible fixtures (trim + lens) that hang from it,
glow when their lamp is lit, and cull with it.

---

### 12. The panels reach the shop · `DONE` (30 Aug 2026)
The фартук, the ceiling closer and their socket holes were drawn and priced and then stopped — the
cut list, the nest, the machine file and the drawing sheets knew nothing about them. You could sell
a kitchen whose quote included a 2.4m splashback and hand the factory a package that never mentioned
it. `production()` (model/cncExport.ts) is the single seam — the CNC parts list, the sheet nest and
the DXF all read it — so the panels go in there and reach all three at once.

- the cut list row says WHERE it goes (`Стена 2`) and WHAT it is (`Фартук`), because the cut map has
  no cabinet number to borrow and a bare `1400×640` tells a sawyer nothing
- the cut-outs travel as real rectangles with positions (`Вырезы: 1 × 230×120@341,110`) — «2
  cut-outs» is not enough to cut one. `FlatPanel.cutouts` replaced the scalar `cutoutMm`; the quote
  derives the routed contour from them
- the material column names the DECOR the designer picked («Мрамор белый»), falling back to the
  stock — and never carries the SLAB's thickness, because «Столешница постформинг 38мм» beside a
  6мм thickness column is a contradiction the shop has to guess its way out of
- the PDF elevation draws them, hatched so they don't read as cabinets, with the holes punched.
  It measures from the RUN's zero rather than the wall's, so `runLocalBands` converts

**Deliberately not done: the 2D plan.** A 6mm panel is ~0.1mm at plan scale, and the plan draws
footprints — a wall panel has none worth drawing. The closer and the underside sit inside the wall
units' own outline, which the plan already shows. Adding them would be clutter, not information.

---

### 14. A pipe is a PATH, with handles · `DONE` (30 Aug 2026)
Rebuilt after the first attempt (numeric fields + measurement chains) turned out to be the wrong
shape: what was wanted was direct manipulation, like the cabinets have.

A pipe is a polyline in wall space (`Fitting.path`, points as mm-along × mm-up), so a bend is not
new geometry — it is one more segment, and every consumer already takes rectangles:

- **`wallFeatures` emits one rect per SEGMENT**, so the notch derivation, the "+"-cell blocking and
  the elevation all handle an L with no new code
- **the 3D draws a chain of barrels with an elbow sphere at each bend**
- **amber grab points at every end and bend** — drag one to lengthen or re-shape (a path has no
  separate width to pull, so the points ARE the resizer). Each carries its own `along · up` label
- **⊕ between two points adds a bend; double-click a bend straightens it**
- the rotate control turns the PATH a quarter turn about its own centre, so an L stays an L
- `pipePathOf` resolves a legacy straight run to the two-point path it always was — one place that
  difference exists, no migration

**A pipe is DIMENSIONED like a drawing, not labelled like a data row.** The first attempt put a
pair of numbers in one chip at each point («2160 · 2700»), which cannot say which is which. Now
each number sits on the arrow that measures it: one to the wall's corner and one down to the floor
locate where the run starts, and every leg carries its own length along itself, offset clear of the
barrel. The four whole-item chains stay suppressed for pipes — they measure to ONE centre, and a
bent run has no such point.

The arrowheads still shrink on a short line so they don't swamp it, but the NUMBER holds a readable
size: a 900mm dimension rendered at 0.45 scale is a measurement nobody can read, which is the same
as no measurement.

**A DRAGGED LEG SNAPS TO 90° / 45°** (`snapPipePoint`, model/room.ts, tested in
tests/pipeSnap.test.ts). Those are the elbows that exist, so a leg that lands within 9° of one is
pulled onto it exactly — a magnet, not a constraint: an angle that is meant is still drawable by
moving further. When BOTH legs of a bend snap, the corner goes where the two lines cross, so an L
comes out square in one gesture instead of needing each leg nudged in turn. The snapped point is
placed by its offset from the anchor on the 10mm grid, which is what keeps a right angle exactly
right and a 45° exactly 45°: «almost plumb» is a dimension the fitter has to argue with, and it
reaches them through the notch this pipe cuts in the cabinet back.

### 13. Measuring a wall item · `DONE` (30 Aug 2026)
Select any socket, radiator, vent or pipe and the 3D draws four read-only chains: to each end of
its wall, and to the floor and the ceiling. Arrowheads both ends, the number in a pill — the way a
shop drawing states a position. Measured to the item's CENTRE so the number on screen is the same
number the editor's «От угла стены» / «От пола» fields hold; two readings of one position is worse
than none. `fittingCentreY` (model/room) is now the single definition of how high an item hangs,
shared by the wall features, the 3D and the chains.

Two things fell out of building it:
- **plan and 3D kept SEPARATE selections** (`selectedFitting` vs `fit3D`), and only a 3D tap ever
  set the second — so placing a pipe left the 3D showing nothing selected, with no gizmo and no
  measurements. One selection now.
- **switching plan ⇄ 3D threw the selection away.** Place a pipe, look at it in 3D, and it was
  gone. The wall/floor selections still clear (those are view-specific edit targets); the ITEM
  stays.

## Fixed after the first pass (30 Aug 2026)

Everything below was reported broken and is now fixed — kept here because each one names a trap.

- **the underside plane stuck out of the cabinets.** Its depth was one `Math.max` over the whole
  row, and a corner unit's `depth` is its SQUARE's side (613 / 840), not the 350 of the row it
  butts — so one corner made the entire row's plane 613 deep. The depth is swept along the row now,
  and corner units are excluded from every flat panel: a straight rectangle can never span a
  chamfered body. Same fix applied to the ceiling closer.
- **the grain direction was inverted.** The wood scans run their grain along U, so the straight
  mapping lays the board on its SIDE — «Вертикально» was drawing horizontal. `slabUV` swaps for
  vertical (the default) and leaves horizontal alone.
- **corner units had no slab mapping at all** — their leaves are rotated into the corner, so they
  need their own projection. They get one (per-arm, along whichever wall that arm faces).
- **the фартук could only echo another part.** Changing a material appeared to do nothing to it
  because every decor option was "same as the counter / fronts / carcass". There is a «Свой»
  option with a real material grid now — a фартук is often a decor of its own (скинали).
- **the two-door corner was unfindable.** It is a kitchen-wide default in «Отделка» now (a shop
  builds all its corners the same way), with the per-module override still in Стиль → Фасад.
- **the фартук "did nothing" — in the FRONT VIEW.** It was drawn in the 3D and priced, but the
  elevation (`components/ElevationGrid.tsx`) never drew it, and the elevation is where a seller
  does most of the editing. Toggling the panel there changed the price and nothing else on screen.
  The elevation now draws all three panel kinds from the same derivation, with the socket cutouts
  punched through them.
- **THE ФАРТУК WAS DRAWN BEHIND THE WALL PAINT.** A wall's covering is a separate opaque plane
  pushed 12mm into the room (coplanar with the wall it would z-fight); the фартук is 6mm and lay
  flat on the wall, so it was entirely behind the paint. On a PAINTED kitchen you saw the paint
  colour in the splash zone whatever the panel was made of — the toggle moved the price and the
  elevation and nothing in the 3D. `WALL_PAINT_OFFSET_M` lives in `model/walls.ts` now and both
  renderers read it; the panel is placed on top of the paint, which is also where a стеновая панель
  really goes. Pinned by a test that fails without the offset.
  **The lesson**: none of my own test kitchens had painted walls, so every screenshot I took was of
  the one case where the bug is invisible.
- **picking a material for the фартук changed its COLOUR but not its MATERIAL.** The texture was
  looked up with `catalogByColor(colour, "worktop")` — worktop-part decors only — so an oak or a
  walnut chosen in «Свой» found nothing and fell back to tinted marble. `catalogByColorAny` resolves
  a colour against the whole catalog now, preferring the kind's natural part.
- **a copied socket moved the pipe.** Wall-item ids came from a bare module counter, which restarts
  at 0 on every page load — while the project you just reopened still held `f1`, `f2`, `f3`. The
  next item added or duplicated was handed `f1` again, and every action maps `e.id === id`, so one
  drag moved both. Cabinets hit this exact bug years earlier and were fixed with a per-session tag
  plus a heal on load (`model/cabinet` uid/dedupeIds); wall items never were. Now they are, and
  `openProject` repairs a project already saved with a collision.
- **the ceiling sat over the room editor as a lid.** `ThreeScene` has its own `updateCull` and only
  ever culled walls. It culls the ceiling too now, on the same rule as the constructor.

---

## Known gaps in what IS done

- the LED wash does not know the light PRESET, so it reads the same in daylight as at night. It is
  subtle in a bright scene, which is what real under-cabinet light does — but a night render should
  push it much harder, and the preset does not reach `buildKitchen`
- the Смета shows LED inside the «Фурнитура» group total rather than as its own line. Same as the
  hinges and slides, but a seller defending a lighting package would want it itemised
- an `interior` strip is derived for every glazed unit at once; you cannot light one and not another
- **ceiling lights cannot be PLACED individually.** You choose the fixture kind (round downlight or
  linear luminaire), the count and how far they spread; where each one lands is still the rig's
  automatic grid. Free placement needs a model (a list of luminaires with position, rotation, kind
  and length), a drag interaction on the ceiling plane, and the light rig following that list
  instead of laying out its own. Worth doing — it is what a designer actually specs.
- the panels do not appear in the **AI render prompt** (model/renderPrompt.ts) — the photoreal pass
  will not know there is a splashback
- a part the nester ROTATED 90° to make it fit does not get its holes drawn in the cut-plan DXF —
  they would have to turn with it. Skipped rather than drawn in the wrong place
- only the BACK is notched. A pipe in a corner may also want the side panel, the plinth (a floor
  riser passes through the toe-kick) or the worktop cut — none of those are derived yet
- a pipe bends in the plane of ONE wall. A run that turns a room corner onto the next wall is two
  pipes, and a boxed-in riser (короб) is still drawn as bare barrels
- there is no free-draw tool yet: a pipe is placed straight and then bent with ⊕ and the handles.
  Tapping a path onto the wall point by point would be quicker for a complicated run
- the back notch's routed contour is **not billed**. `FlatPanel` cut-outs are; a carcass notch never
  reaches `buildBom`. Costs nothing today because `millPerM` is seeded at 0, but it is a real gap
- grain matching is per RUN: a row that turns a corner onto the next wall restarts its board, and a
  corner unit's leaves get the same board but cannot line up across the 45°
- **corner units get no ceiling closer**, so a floor-to-ceiling kitchen has a small gap above the
  corner. Closing it needs a prism on the corner footprint, not a flat panel
- the underside plane and the ceiling closer take one decor for the whole kitchen; per-run
  overrides are not exposed
- a two-door corner is priced as two leaves on a rectangular box; corner geometry has always been
  an approximation in pricing, and this does not change that
