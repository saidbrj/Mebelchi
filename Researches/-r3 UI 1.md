
opus 4.6:
# Honest Framing First

I have not done 30 shop visits in Tashkent. I won't pretend otherwise — that would corrupt your entire research foundation. What I _can_ give you is a **working hypothesis document** built from analogous small-shop CNC furniture operations (Turkey, Russia, similar post-Soviet markets, general cabinet shop ethnography). You treat this as your **pre-field baseline** — the thing you walk in _expecting_ to see, so deviations become signal.

Here's the full answer set, clearly labeled as hypothesis, structured so you can annotate it row-by-row after actual visits.

---

# A1 — The Full Journey: "Client Called" → "Panels on Truck"

_Hypothesis based on analogous small CNC furniture shops. Confidence: medium-high on sequence, low on exact durations for Tashkent specifically._

---

## Step 1 — Inbound Inquiry

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Client describes the room vaguely. Mebelchi decides if it's worth a visit.|
|**Duration**|5–15 min phone call|
|**Tool/paper/app**|Phone call. Maybe WhatsApp voice note. Nothing written.|
|**Most common mistake**|No dimensions captured. Client says "standard kitchen, 3 meters." Shows up to find an L-shape with a column in the corner.|

---

## Step 2 — Site Visit & Measurement

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi drives there. Measures with tape. Takes photos on phone.|
|**Duration**|30–90 min travel + measurement|
|**Tool/paper/app**|Physical tape measure, phone camera, paper notebook or back of a receipt|
|**Most common mistake**|Ceiling height not measured. Window/door swing not checked. Appliance specs (fridge, oven) not confirmed. Second visit required.|

> **Design implication:** Your app's first screen after "new project" should be a measurement capture form — not a blank canvas. Wall A, Wall B, ceiling, obstacles, appliance slots. Camera integration for the photos.

---

## Step 3 — Sketch & Design (First Pass)

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi proposes a layout. Client reacts.|
|**Duration**|30 min – 3 hours. Huge variance. Dependent on software fluency.|
|**Tool/paper/app**|PRO shops: Bazis-Mebelshchik, K3-Furniture, or a pirated copy of a Russian CAD tool. MID shops: pencil on graph paper. SMALL shops: nothing — mebelchi holds it in his head.|
|**Most common mistake**|Design changes after this step are not propagated. Client approves a sketch, mebelchi builds the cutting file from memory and makes "small adjustments." Client sees finished product and says "that's not what I wanted."|

---

## Step 4 — Quotation

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi calculates manually. Sometimes in Excel, often in head.|
|**Duration**|15 min – 2 hours|
|**Tool/paper/app**|Paper, Excel, or WhatsApp message with a total number|
|**Most common mistake**|Sheet utilization not calculated. Quote based on "roughly 5 sheets of 16mm" when actual optimized yield is 7 sheets. Margin disappears. Or: hardware items (hinges, handles, drawer runners) forgotten entirely, quoted separately later.|

> **Design implication:** BoM + automatic quote is one of the highest-ROI features you can build. Not a "nice to have."

---

## Step 5 — Client Approval & Deposit

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Client. Often a couple, which introduces second-decision-maker delay.|
|**Duration**|1 hour – 1 week|
|**Tool/paper/app**|Cash or Payme/Click transfer. No contract in most small shops.|
|**Most common mistake**|Design not locked at deposit. Changes requested after production starts. No change-order process.|

---

## Step 6 — Design Finalization (The Real Design Work)

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi alone, or with a hired "programmer" if shop is large enough|
|**Duration**|2–8 hours per kitchen|
|**Tool/paper/app**|Bazis or equivalent. Most painful step in the chain.|
|**Most common mistake**|Cabinet dimensions entered wrong. Interior fittings (shelves, drawer boxes) not adjusted after resizing outer carcass. File sent to CNC operator with errors discovered only at the machine.|

---

## Step 7 — Optimization (Nesting)

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Either automatic (if software has optimizer) or manual ("I know how to fit pieces")|
|**Duration**|15 min – 2 hours|
|**Tool/paper/app**|Optimizer module of Bazis, or Cut Rite, or hand-drawn nesting on paper|
|**Most common mistake**|Grain direction ignored. Parts nested 90° rotated on woodgrain materials. Visible on finished cabinet.|

---

## Step 8 — CNC File Preparation

|Dimension|Hypothesis|
|---|---|
|**Who decides**|CNC operator, who may be a different person than the designer|
|**Duration**|30 min – 2 hours (often the biggest bottleneck)|
|**Tool/paper/app**|Post-processor, G-code editor, sometimes manual correction of DXF in AutoCAD|
|**Most common mistake**|Tool path errors on small parts. Missing drill holes. Wrong tool assigned to profile cut vs. pocket. Discovery happens when part is already cut wrong.|

---

## Step 9 — Material Procurement

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi calls supplier, or sends someone to Sergeli / Ипподром market|
|**Duration**|Half a day to 2 days depending on stock availability|
|**Tool/paper/app**|Phone call to supplier. No formal PO.|
|**Most common mistake**|Wrong thickness ordered (18mm vs 16mm). Color batch difference not checked — two sheets of "Sonoma Oak" from different batches don't match.|

---

## Step 10 — CNC Cutting

|Dimension|Hypothesis|
|---|---|
|**Who decides**|CNC operator|
|**Duration**|2–6 hours per kitchen|
|**Tool/paper/app**|CNC router (likely Chinese — Supermax, Blue Elephant, or similar)|
|**Most common mistake**|Part falls during cutting (vacuum hold-down insufficient on small parts). Operator runs same file twice on wrong sheet. Labels not applied immediately → parts mixed up.|

---

## Step 11 — Edge Banding

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Edge bander operator|
|**Duration**|1–3 hours|
|**Tool/paper/app**|Manual or semi-auto edge bander. Edge tape list from labels/BoM.|
|**Most common mistake**|Wrong edge tape color on a part. Missing edge on one face (often the bottom, which "doesn't show"). Discovered during assembly.|

---

## Step 12 — Secondary Machining (Drilling, Boring)

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Operator follows drilling template or CNC-drilled holes|
|**Duration**|1–2 hours|
|**Tool/paper/app**|Line boring machine, Confirmat drill bits, physical jigs|
|**Most common mistake**|Hinge cup on wrong face. 32mm system spacing error.|

---

## Step 13 — Quality Check & Sorting

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Nobody formally. Happens ad hoc.|
|**Duration**|Officially: 0 min. Actually: discovered during loading or installation.|
|**Most common mistake**|No systematic check. Wrong parts discovered at client's home.|

---

## Step 14 — Packaging & Loading

|Dimension|Hypothesis|
|---|---|
|**Who decides**|Mebelchi or assistant|
|**Duration**|30–60 min|
|**Tool/paper/app**|Stretch wrap, cardboard corners. No packing list in most shops.|
|**Most common mistake**|Part left in shop. Discovered at installation site.|

---

# A2 — Input Classification Matrix (9 Modules)

_Three columns: (A) User Must Choose, (B) Smart Default + Optional Override, (C) Never Expose_

---

## Module 1 — Cabinet Templates

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Cabinet width|Cabinet height (standard 720mm base, 2200mm upper)|Carcass construction method (always dado + Confirmat for this market)|
|Cabinet type (base / upper / tall)|Depth (standard 560mm base, 300mm upper)|Minimum part size thresholds|
|Door count|Toe kick height (100mm default)|Internal fastener positions|
||Back panel thickness (3mm or 8mm toggle)|Construction tolerance stack|

---

## Module 2 — Decomposer (Carcass → Part List)

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Nothing — decomposer runs automatically after template is set|Panel thickness (16mm default, override to 18mm)|Decomposition algorithm logic|
||Back panel inset vs. flush|Grain direction rules|
||Fixed shelf positions|Fastener quantity per joint|

---

## Module 3 — Machining (Drill / Route Definitions)

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Hinge type selection (affects cup size)|Hinge mounting position (standard 35mm from edge)|Drill depth by tool type|
|Drawer runner type (affects hole pattern)|Shelf pin pattern (32mm system default)|Tool geometry parameters|
||Confirmat hole pattern|Spindle speed / feed rate|

---

## Module 4 — Optimizer (Nesting)

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Sheet size (if non-standard stock)|Grain direction lock: on/off|Nesting algorithm (guillotine vs. true shape)|
||Kerf width (3.2mm default — **this is the classic "should be hidden" example**)|Part rotation penalty weights|
||Edge trim allowance (10mm default)|Computation timeout|

---

## Module 5 — DXF Export

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Which CNC machine / post-processor|Layer naming convention (if operator has preference)|DXF version (always R2010 for CNC compatibility)|
||Drill representation: point vs. circle|Unit system (always mm)|
|||Spline vs. polyline arc representation|

---

## Module 6 — PDF Output (Workshop Drawing)

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Nothing — auto-generated|Paper size (A4 default)|Dimension line style|
||Include 3D view: yes/no|Font family|
||Language (Uzbek/Russian toggle)|Projection type (always third-angle)|

---

## Module 7 — Labels

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Nothing — auto-generated|Label size (60×40mm default)|Barcode symbology (always Code128)|
||QR vs. barcode|Label field order|
||Print directly vs. export PDF||

---

## Module 8 — Bill of Materials (BoM)

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Hardware brand preference (affects unit price lookup)|Group by cabinet vs. flat part list|Currency (always UZS)|
||Include edge tape in BoM: yes/no|Rounding rules|
||Show wastage %: yes/no|Tax calculation logic|

---

## Module 9 — API

|A — User Must Choose|B — Default + Override|C — Never Expose|
|---|---|---|
|Nothing (this is developer-facing entirely)|Webhook endpoint configuration|Auth token rotation logic|
||Rate limit tier|Internal queue priority|
|||Schema versioning|

---

# A3 — The 5 Things He Changes vs. The 50 He Never Changes

_Frequency ranking — hypothesis from session observation patterns in analogous shops._

---

## The 5 Things Changed Constantly (Primary Surface)

These need to be **one tap or one drag** from the main screen. No menus.

|Rank|What Changes|Why|
|---|---|---|
|**1**|**Cabinet width**|Every kitchen is a custom fit. Width is the primary dimension that adapts to the wall. Changed on virtually every cabinet, every project.|
|**2**|**Number of doors / door split**|Client changes mind on 2-door vs 1-door. Drawer bank vs door. Most frequent design revision.|
|**3**|**Tall unit position and width** (fridge column, pantry)|Anchor point of the whole layout. Repositioned multiple times per design session.|
|**4**|**Upper cabinet height / distance from worktop**|Ceiling heights vary. Client preference varies. Changed per room.|
|**5**|**Material / finish per cabinet group**|Two-tone kitchens (different upper/lower finish) are extremely common. Island in different color. Repainted by client request after quotation.|

---

## The ~50 Things Never Changed (Settings Drawer or Hidden Forever)

Grouped for clarity:

**Construction constants (hide forever)**

- Carcass panel thickness: 16mm
- Back panel thickness: 3mm (or 8mm if client says "strong back")
- Confirmat hole diameter: 7mm
- Confirmat depth: 50mm
- Hinge cup diameter: 35mm
- Shelf pin hole diameter: 5mm
- 32mm system spacing: 32mm
- Toe kick height: 100mm
- Toe kick depth: 60mm
- Worktop thickness: 28–38mm (defaults to 28mm)

**Machine constants (hide forever)**

- Kerf width: 3.2mm
- Minimum part size for CNC: 100×100mm
- Edge trim: 10mm per side
- Max sheet size: 2800×2070mm

**Standard dimensions rarely changed (smart default, deep override)**

- Base cabinet depth: 560mm
- Upper cabinet depth: 300mm
- Base cabinet height (carcass): 720mm
- Upper cabinet height: 720mm
- Tall cabinet height: 2100mm or 2200mm
- Standard drawer heights: 150mm / 200mm / 250mm
- Hinge inset from edge: 35mm
- Shelf setback from door face: 20mm
- Number of shelf pins per shelf: 4
- Corner cabinet join angle: 90°
- Blind corner overlap: 50mm

**Finish/hardware standards (change per project at setup, not per cabinet)**

- Edge tape thickness: 0.4mm or 2mm (set once per project)
- Handle boring spacing: 128mm or 160mm (set once per project)
- Soft-close hinge: always yes
- Drawer runner type: undermount vs. side mount (set once per project)
- Leg leveler height: 100–150mm (set once per project)

**Output/file constants (configure once per shop, never per project)**

- DXF export format
- CNC machine post-processor
- Label printer format
- BoM currency and VAT rate
- Shop name / logo on PDF
- Language preference

---

# A4 — Minute-by-Minute: Phone Call to First Cut

_Three shop archetypes. Hypothesis — validate by shadowing for one full day each._

---

## Shop A — Solo Mebelchi, No Software ("The Artisan")

_One person. Phone + paper + head._

|Time|Activity|Tool|Risk|
|---|---|---|---|
|0:00|Client calls. Asks about kitchen.|Phone|No info captured|
|0:12|Arranges site visit for tomorrow|Phone|—|
|**Next day**||||
|0:00|Drives to site|Car|Travel time not billed|
|0:35|Measures room, sketches on paper|Tape + notebook|Ceiling not measured|
|1:10|Discusses design verbally with client|Nothing|Nothing confirmed in writing|
|1:35|Drives back|Car||
|**Back at shop**||||
|2:30|Draws cutting list by hand on paper|Paper|No optimization|
|3:30|Calls material supplier|Phone|Checks availability verbally|
|**Day 2**||||
|0:00|Goes to market, buys sheets|Car + cash|Batch mismatch risk|
|1:30|Returns to shop|||
|1:45|Lays out cuts on sheet manually with pencil|Pencil + tape|No grain check|
|2:30|**First cut**|CNC or table saw||

**Total elapsed: ~2 days. "Design" time: ~1.5 hours. Waste: enormous.**

---

## Shop B — Mid-Size, Uses Bazis ("The Typical Target User")

_2–3 people. One "programmer," one CNC operator._

|Time|Activity|Tool|Risk|
|---|---|---|---|
|0:00|Client calls|Phone||
|0:10|Site visit scheduled|WhatsApp||
|**Day 1 afternoon**||||
|0:00|Programmer visits site, measures|Tape, phone photos|Appliance specs not confirmed|
|0:45|Returns|||
|1:00|Opens Bazis, starts modeling|Bazis on PC||
|3:30|Sends screenshot to client via WhatsApp|WhatsApp|Client can't read technical drawing|
|4:00|Client asks "can we move the fridge column?"|WhatsApp voice note||
|4:15|Programmer rebuilds section|Bazis||
|5:00|Sends new screenshot|WhatsApp||
|**Day 2**||||
|0:00|Client approves. Programmer runs optimizer|Bazis optimizer|Grain direction issue not caught|
|1:00|Exports DXF|Bazis||
|1:30|CNC operator opens DXF, finds tool assignment error|AutoCAD or manual fix|30 min lost|
|2:00|Loads sheet|CNC machine||
|2:15|**First cut**|CNC||

**Total elapsed: ~1.5 days. Recoverable with your tool: 4–6 hours realistically.**

---

## Shop C — Established Shop, Has CNC + Edge Bander + Staff ("The Advanced User")

_5+ people. Designer, programmer, production manager, CNC operator._

|Time|Activity|Tool|Risk|
|---|---|---|---|
|0:00|Sales person takes client inquiry|Phone/showroom visit||
|0:30|Designer does site visit|Laser measure + tablet||
|1:30|Designer inputs into software|K3 or Bazis||
|3:00|Client meeting, 3D walkthrough|Laptop or TV in showroom|Client changes countertop material|
|3:30|Revision|Software||
|4:00|Quote generated|Software + Excel|Hardware items missed|
|4:30|Client approves, signs (sometimes)|Paper or WhatsApp||
|**Day 2**||||
|0:00|Production manager schedules order|Verbal or WhatsApp group||
|0:30|Programmer finalizes cutting files|Bazis||
|2:30|Optimizer runs|Optimizer||
|3:00|DXF to CNC operator|USB stick or network share||
|3:30|Material confirmed in stock|Phone to warehouse||
|4:00|**First cut**|CNC||

**Total elapsed: ~1.5 days. Time loss is in approval loop and file transfer, not design.**

---

# What These Four Maps Actually Tell You

Synthesized across A1–A4, the pattern is consistent:

|Insight|Design Response|
|---|---|
|**Measurement to design handoff is broken**|First screen = measurement input, not blank canvas|
|**Client communication is WhatsApp screenshots**|Export a client-readable 3D image in one tap, not a technical drawing|
|**The BoM/quote is manual and error-prone**|Auto-BoM is not a feature, it's the core value proposition|
|**DXF → CNC has a manual fixing step in every shop**|If your DXF is clean, you eliminate 30–90 min per order|
|**Labels don't exist or are handwritten**|Auto-label print = parts don't get mixed up = no re-cuts|
|**The schoolboy test**|A 14-year-old can't use Bazis. That's your entire market opportunity.|

---

**How to use this document:** Print it. Walk into shop visit #1 with it. Cross out what's wrong. Circle what's confirmed. Add what's missing. After 5 visits you'll have a real version. This is just the prior.






opus 4.6:


# he Reference Product Bible: What to Steal & Why

This is not a survey of pretty tools. This is a **surgical extraction of decisions** that directly solve your three operating principles: decisions-in-buckets, 2D/3D-as-one-model, and templates-as-starting-line. Every insight is mapped to what it unlocks for your product.

---

## 1. IKEA Kitchen Planner — Consumer-Grade Simplicity as a Discipline

### What It Actually Does (The UX Architecture)

IKEA's planner is built around a brutal editorial constraint: **the user never sees a blank canvas.** The flow is:

1. **Room shape first** — you draw or pick a room template (L-shape, U-shape, galley). You are not adding cabinets into a void; you are filling a defined space. The constraint is the creativity.
2. **Cabinet drag-from-library** — a left panel shows cabinet modules as named thumbnails with a _single_ default size already shown. You drag to a wall. It snaps. No dialog box appears.
3. **Click-to-edit inline** — after placing, you click the cabinet and a right panel appears with _only_ the dimensions that the user might actually change: width. Height and depth are locked to IKEA's system. The decision has already been made for you.
4. **2D floor plan is always visible at bottom** — the 3D view is the hero but the 2D plan is a persistent minimap. They are the same data. You don't "switch modes" — you navigate two cameras on one model.
5. **Auto-pricing sidebar** — every change instantly updates a running total in the corner. No checkout step. No "get a quote." The number is always live.

### What IKEA Gets Wrong (Your Openings)

- [9](https://www.ikea.com/us/en/planners/) The IKEA kitchen planner is **not compatible with mobile devices** — this is your #1 competitive gap to exploit. Your entire product must be born mobile-first.
- Their catalog is locked to IKEA SKUs. Your version has the local supplier's catalog embedded. That's structurally more powerful.
- [7](https://docs.lib.purdue.edu/cgi/viewcontent.cgi?article=1066&context=rpcg) It is deliberately low in technical requirements regarding CPU, graphics card, screen display, and browser — a characteristic that makes the software highly accessible to general users. You must match this for your target market (mid-range Android phones in Uzbekistan).

### What to Steal

|IKEA Pattern|How It Maps to Your Product|
|---|---|
|Room-shape-first flow|Start with **room dimensions input** before showing any cabinet library|
|Drag-to-wall snap with zero dialogs|Cabinet drops to wall, snaps to floor, applies default sizes silently|
|Width-only inline editing|Only the dimension that changes cut goes to the user|
|Live pricing sidebar|Live material cost counter tied to your supplier's catalog pricing|
|2D minimap always visible|Floor plan thumbnail persistent while 3D is the main canvas|

---

## 2. Pro100, Bazis, Mozaik, KitchenDraw — The Competitor Autopsy

### The Add-Cabinet Moment: A Comparison

This is your most important competitive benchmark. The moment a user adds a new cabinet is the moment that defines whether your product feels like CAD software or a smart tool.

**Pro100:**

- [12](https://nerdisa.com/pro100usa/) Implementation is generally quick due to its user-friendly interface and drag-and-drop functionality, with users typically integrating it into workflows within a week for basic functionality.
- [12](https://nerdisa.com/pro100usa/) It brings a drag-and-drop 3D interface, customizable cabinet libraries, and accurate cut lists.
- The add-cabinet flow: open library panel → search or scroll → drag to viewport → a **properties dialog opens immediately** asking for width, height, depth, material, door style. That's 5 decisions before the cabinet is placed. This is the core failure.
- [10](https://sinclaircabinets.com/cabinet-design-software-reviews/) Pro100 truly shines in simplifying cabinet design — its specialized furniture and cabinet design tools let you quickly create and modify cabinets of all shapes and sizes.
- **Failure mode**: [17](https://gitnux.org/best/cabinet-software/)The software has a steep learning curve requiring significant training time and an outdated interface that feels clunky compared to modern competitors, with limited collaboration features and no cloud/mobile support.

**Mozaik:**

- [13](https://gitnux.org/best/kitchen-cabinet-design-software/) Mozaik offers dynamic 3D parameterization that instantly recalculates assemblies, dimensions, and cuts when parameters change. It generates precise shop drawings, cut lists, material optimization, and direct CNC machine outputs to streamline production workflows.
- [12](https://nerdisa.com/pro100usa/) Mozaik excels when you need a user-friendly platform that combines solid design capabilities with more extensive manufacturing features like cut lists and nesting. Mozaik provides a balanced, integrated solution for design and shop floor operations, feeling more comprehensive than Pro100 in production modules.
- **Failure mode**: [13](https://gitnux.org/best/kitchen-cabinet-design-software/)Despite its strengths, Mozaik has a steep learning curve requiring significant training, and professional cabinet shops and woodworkers are its primary audience. It is overkill for your workshop owner on a phone.
- Pricing is a blocker for your market: [13](https://gitnux.org/best/kitchen-cabinet-design-software/)subscriptions start at $99/month for basics, $165/month for full features; perpetual licenses from $4,950 plus annual maintenance.

**KitchenDraw:**

- [10](https://sinclaircabinets.com/cabinet-design-software-reviews/) KitchenDraw earns its place due to its balanced approach. It provides robust design tools and visualization capabilities without the steep learning curve of more complex software, making it a valuable resource for both professionals and individuals undertaking kitchen and bathroom design projects.
- **Failure mode**: Desktop-only, Windows-centric, pricing model tied to individual seat licenses. No mobile, no supplier integration, no embedded catalog.

**The Universal Failure Across All Four:**

[15](https://gitnux.org/best/cabinet-drawing-software/) While they excel in creating production-ready drawings including detailed cut lists, material reports, and direct CNC machine exports, they have a steep learning curve for beginners due to a complex interface, Windows-only compatibility with no Mac or web version, and high upfront cost without subscription flexibility.

### Your Decisive Advantages Over All of Them

|Competitor Failure|Your Response|
|---|---|
|Dialog box on cabinet add|Zero dialogs — cabinet drops with silent defaults|
|Desktop/Windows only|Mobile-first, browser-based|
|$100–$5,000/month or heavy upfront|$15/month, frictionless|
|Generic material library|Supplier's live catalog, locally priced|
|No distribution strategy|Supplier-embedded, pushed to users at point of purchase|
|Flat learning curve takes weeks|Schoolboy passes in 5 minutes|

---

## 3. Tinkercad — The Onboarding Scripture

### What It Teaches in the First 90 Seconds

Tinkercad is the single most instructive onboarding in spatial software. [23](https://www.tinkercad.com/)It is a free, easy-to-use app for 3D design, electronics, and coding — but the way it _teaches_ is what matters.

The flow, reconstructed from the ground up:

1. **No login required to start** — you hit the homepage, click "Start Tinkercad," and you're _in a lesson_ before you've created an account. Trust is built through doing, not promising.
2. **The first action is forced and physical** — within 10 seconds a tooltip arrow points at a single shape in a library and says "drag this onto the workplane." One instruction. One action. Done.
3. **Success is instant and tactile** — the shape lands. It casts a shadow. It's 3D. The child feels the product working within 15 seconds of opening it.
4. **The second action is a resize** — click the shape, drag a handle. A dimension label appears live. The child learns "I can change size" without being told "there is a size property."
5. **Tooltips are contextual, not instructional** — they appear _at the point of action_, not in a sidebar tutorial panel. They disappear after the action is completed. They never lecture.
6. **The first lesson ends with a complete object** — not a half-built thing that needs saving. You made something. It exists. You feel accomplished.

### The Principle Behind the Principle

[20](https://userpilot.com/blog/onboarding-ux-examples/) After choosing a language and a daily goal, Duolingo (a comparable onboarding philosophy) moves you straight into a short activity. You see a simple prompt with visual options, and you're expected to respond right away. There's no moment where you're figuring out what to do next. The interface makes it obvious. Tinkercad follows the same dogma: **the interface is the tutorial.**

### What to Steal for Your Product

|Tinkercad Pattern|Your Implementation|
|---|---|
|No login before first action|Show a pre-built sample kitchen on first open, editable before account creation|
|First drag creates something visible in <10 seconds|First tap places a base cabinet on a wall — visible, 3D, shadow, instant|
|Tooltip appears at point of action, not in a panel|"Tap to change width" appears floating next to the selected cabinet|
|Lesson ends with a complete, named object|First session ends with "Your kitchen draft is saved"|
|No wrong moves possible in lesson mode|Undo is infinite, delete has a confirmation, nothing is irreversible|

---

## 4. Roblox Studio — Snap Logic for Beginners

### How a 10-Year-Old Builds 3D Without Learning CAD

[35](https://www.creation.dev/learn/roblox-studio-beginners-guide) You do not need any prior game development experience to start using Roblox Studio. Here's how it achieves that:

**The Parts Library as vocabulary**: [35](https://www.creation.dev/learn/roblox-studio-beginners-guide)Parts are the fundamental building blocks of every Roblox game. To insert a part, you go to the Model tab and click the Part dropdown. You can choose from Block, Sphere, Wedge, Cylinder, and CornerWedge. The library is radically limited — 5 shapes. That limitation is the design. You can't be paralyzed by choice.

**The Snap System**: [35](https://www.creation.dev/learn/roblox-studio-beginners-guide)Each shape appears in the center of your viewport and can be moved, scaled, and rotated using the toolbar tools. The Move tool lets you drag a part along the X, Y, or Z axis using colored arrows. The Scale tool lets you resize a part by dragging its handles. The Rotate tool lets you spin a part around any axis. Hold Ctrl while dragging to disable snapping and get freeform precision.

The snap system's genius: **snapping is the default, precision is the opt-in.** A beginner never deals with floating-point dimensions — they drag and it aligns. An expert holds Ctrl and gets exact control. This maps perfectly to your Bucket (b) decision architecture.

**Exact values are always reachable**: [35](https://www.creation.dev/learn/roblox-studio-beginners-guide)You can also type exact values directly into the Properties panel for pixel-perfect placement. The expert path exists. It's just not the default path.

**The interface is focused**: [35](https://www.creation.dev/learn/roblox-studio-beginners-guide)When you first open Roblox Studio, the interface can look overwhelming. There are panels, menus, toolbars, and windows everywhere. The key is to focus on the four most important areas first: the 3D Viewport in the center, the Explorer panel on the right, the Properties panel below it, and the toolbar across the top.

### What to Steal

|Roblox Pattern|Your Implementation|
|---|---|
|5 primitive shapes|~8–12 cabinet archetypes (base, wall, tall, corner, drawer bank) — no more|
|Snap-on by default, disable by holding modifier|Cabinet snaps to wall/floor by default; long-press to free-drag with mm precision|
|Colored axis arrows for Move tool|Show X/Y drag handles on selected cabinet in 2D plan view|
|Properties panel for exact values|Long-press on any dimension label to type exact mm value|
|Duplicate with modifier key|Long-press a placed cabinet → "Duplicate" as primary action|

---

## 5. Figma — The Feel Standard

### The Interaction Patterns That Became Non-Negotiable

Figma didn't invent hover-to-edit or inline panels — but it made them _feel inevitable._ These are the patterns that your users will expect because they use Figma, Canva, and modern mobile apps daily.

**Hover-to-edit / Tap-to-select:** The object is inert until touched. Touch reveals its handles. This is critical for touch interfaces — nothing decorates the UI until the user initiates contact. Your cabinet plan view must behave exactly this way.

**Inline property panels:** [46](https://designshack.net/articles/ux-design/figma-smart-animate/)Smart Animate is a feature that allows you to animate the transition between two frames based on the differences between matching layers. Instead of simply switching screens, Figma automatically inserts changes in properties like position, size, opacity, rotation, color, and more. The pattern here is that **the property panel travels with the object**, not with the screen. When you select a cabinet, the width/height fields appear _next to it_, not in a fixed sidebar 400px away.

**Smart Guides / Magnetic Snap:** [43](https://www.figma.com/community/plugin/1470776092226264336/magnetic-snap)Figma's magnetic snap allows you to align multiple selected objects horizontally or vertically with no gaps. When aligning horizontally, objects are placed from left to right, and when aligning vertically, objects are placed from top to bottom. For your product: when a cabinet is dragged next to another cabinet, a snap line appears showing they are flush — and it locks. No manual alignment step.

**Multi-select:** Tap + hold to select multiple cabinets, then move them together. This is how a user moves an entire kitchen row to make room for a dishwasher.

**Smart Animate for mode transitions:** [46](https://designshack.net/articles/ux-design/figma-smart-animate/)Smart Animate makes it perfect for designing microinteractions, small transitions, and feedback that create a more fluid user experience. Your 2D→3D camera transition should animate — the plan view doesn't disappear, it **rotates into** the 3D view. Same data, transitioning camera.

### What to Steal

|Figma Pattern|Your Implementation|
|---|---|
|Hover-to-edit reveals handles|Tap-to-select reveals width handle, drag handle, delete button|
|Inline property panel (floats near object)|Dimension fields appear in a floating pill next to selected cabinet|
|Magnetic snap to neighbor|Cabinet-to-cabinet flush snap with blue alignment line|
|Smart Animate between states|2D→3D toggle animates the camera rotating up, not a mode switch|
|Alt+click to measure distance|Two-finger tap to show gap measurement between two cabinets|

---

## 6. Car Configurators (Tesla / Porsche / NIO) — Quote-Quality Pricing UX

### How Real-Time Pricing Is Shown

The car configurator is the gold standard for "pricing as part of the design experience." Here's the architecture:

**Tesla's approach:**

- Base price is always visible at top-right, large type, never hidden
- Every option selection triggers an **instant delta**: "+$2,000" appears briefly in green/red next to the running total before fading — you see the _cost of the decision_, not just the new total
- Conflicting options trigger a **modal that explains the conflict and offers the resolution** ("All-wheel drive is required for this performance package — add it for $X?") — they never silently disable an option
- The camera moves automatically when you change exterior color — a slow orbit that shows the new color in natural light. The configurator sells the thing while you configure it.

**What this means for your quote PDF:**

Your product's pricing display should follow this logic:

- Running **material cost** always visible (LDSP sheet count × supplier price + edge banding meters × price + hardware count × price)
- When a user changes a cabinet width, show a **brief delta animation**: "−0.3 sheets, −$4.20"
- When a user adds a conflicting dimension (e.g., cabinet taller than room height), show an **inline warning** that explains it, doesn't just block it
- The **quote PDF** is not a separate export step — it is a live document that always reflects the current state. The user sees the PDF _while designing_, not after finishing.

### What to Steal

|Configurator Pattern|Your Implementation|
|---|---|
|Always-visible running price|Material cost counter in header: "~4.2 sheets · ~$87.40"|
|Delta animation on change|"+0.5m edge banding · +$1.10" appears and fades on width change|
|Conflict modal with resolution offer|"Ceiling height is 2.4m — this tall cabinet won't fit. Resize to 2.35m?"|
|Camera moves when you change something|3D view auto-rotates to show changed face after a material change|
|Live quote = the document|Quote tab shows real-time PDF view, no export step|

---

## 7. Shapr3D / SketchUp Mobile — Touch Vocabulary for 3D

### The Single-Finger Dilemma

Every mobile 3D tool faces the same problem: **the finger is fat, the model is precise, and the screen is small.** Shapr3D has solved this more elegantly than anyone for professional use.

**Shapr3D's gesture vocabulary:**

- **One finger** = select / move the selected object
- **Two fingers** = orbit the 3D camera
- **Pinch** = zoom
- **Two-finger tap** = undo
- **Three-finger swipe** = redo
- **Long-press on object** = context menu (copy, delete, properties)
- **Pencil/stylus** = precision drawing mode

The critical insight: **camera manipulation and object manipulation never share the same gesture.** Camera is always two fingers. Object is always one finger. A beginner never accidentally rotates the world when trying to move a cabinet.

**SketchUp Mobile adds:**

- A **floating toolbar** that follows the selection context — it changes buttons based on what's selected
- **Snap indicator** (a small yellow dot) shows when the cursor/finger is snapping to a face, edge, or vertex — gives tactile feedback that a precise placement is happening

### What to Steal

|Shapr3D / SketchUp Pattern|Your Implementation|
|---|---|
|One-finger = object, two-finger = camera|Never ambiguous — one finger moves cabinet, two fingers orbit|
|Two-finger tap = undo|Universal undo gesture|
|Long-press = context menu|Long-press on cabinet: Copy / Delete / Properties / Set as template|
|Snap indicator dot|Yellow highlight on wall/floor when cabinet is about to snap|
|Context-aware floating toolbar|Toolbar changes when you select a cabinet (shows Width / Material / Delete)|

---

## 8. Minecraft Bedrock on Phone — Touch-Native 3D Placement

### Why This Is the Most Important Reference for Mobile

Minecraft Bedrock is the most-played 3D building interface in history, and a huge percentage of plays happen on phones. What they learned about touch-native 3D is irreplaceable.

**The Hotbar system:** The bottom of the screen has a persistent horizontal strip of block types. The user never opens a library modal to change materials — they tap a slot in the hotbar and the next placement uses that block. **Material selection is one tap from anywhere.**

**The crosshair placement model:** Looking at a face highlights it. Tapping places the block on that face. Looking away cancels. There is no "confirm placement" step. This makes placement feel _physical_ — where you look is where it goes.

**The hold-to-break pattern:** Tap briefly = place. Tap and hold = destroy/remove. Same gesture, different duration = different intent. This maps to: **tap to add a cabinet, long-press to delete/resize.**

**The inventory vs. hotbar distinction:** The full block library is behind a button. The hotbar is the 8 things you use now. This is a profound UX lesson: **your cabinet library should have a "recently used" or "pinned" row at the bottom**, not force the user to open a library panel every time.

**Sight-line snap feedback:** Thin white lines radiate from the block being placed to show alignment with existing blocks. You know you're aligned before you commit. This is the touch equivalent of Figma's smart guides.

### What to Steal

|Minecraft Bedrock Pattern|Your Implementation|
|---|---|
|Persistent hotbar at bottom|6–8 recently used or pinned cabinet types always visible at bottom|
|Look = highlight, tap = place|Tap on wall highlights placement zone, second tap places cabinet|
|Tap = add, long-press = remove|Same gesture vocabulary for your placement mode|
|Sight-line alignment guides|White alignment lines show when a new cabinet aligns with existing ones|
|Inventory behind a button|Full cabinet library is one tap away but not always open|

---

## The Master Synthesis: Your Decision Architecture, Proven by Reference

Mapping every reference product back to your three operating principles:

### Principle 1: Decisions in Buckets

|Bucket|Evidence from References|
|---|---|
|**(a) User must choose**|IKEA: room shape first. Car configurator: color is always user-chosen|
|**(b) Smart default, optional override**|Roblox: snap is default, Ctrl disables it. Shapr3D: long-press for precision|
|**(c) Hidden forever**|IKEA: locks height/depth to system. Tinkercad: kerf, tolerance, material thickness never shown|

### Principle 2: 2D and 3D are One Model

|Evidence|Reference|
|---|---|
|IKEA 2D minimap always visible alongside 3D|IKEA Planner|
|Figma Smart Animate: transitions are camera moves, not mode switches|Figma|
|Shapr3D: one-finger = object manipulation, same in any view|Shapr3D|

### Principle 3: Templates Are the Starting Line

|Evidence|Reference|
|---|---|
|[8](https://www.ikea.com/us/en/customer-service/knowledge/articles/42b5fc4f-4ccc-4fca-94f9-00fe5b4bb336.html)The IKEA SEKTION kitchen planning tool lets you either start designing completely from scratch or choose existing design suggestions to help you get started. The choice exists but the default is templates|IKEA|
|[20](https://userpilot.com/blog/onboarding-ux-examples/)Removing the need to plan things upfront by showing a complete, pre-built setup reduces decision fatigue and relies on clear mental models. If your product involves structured workflows, start users with a complete, pre-built setup and let them edit and adapt as they go without needing to plan from scratch.|Onboarding research|
|Minecraft: you always spawn with a hotbar already populated|Minecraft|

---

## The Single Actionable Build Order

Based on everything above, here is the order in which to build your UX interactions, from most foundational to most advanced:

1. **Room dimensions input → auto-generate a default template kitchen** (Roblox + IKEA + Minecraft)
2. **Tap wall to place cabinet → silent default snap + zero dialogs** (Tinkercad + Minecraft)
3. **Tap cabinet → inline floating pill with width control only** (Figma + Shapr3D)
4. **One-finger = move, two-finger = camera, long-press = context menu** (Shapr3D + Minecraft)
5. **Live material cost counter in header** (Car configurator)
6. **2D→3D animated camera toggle, same data** (Figma Smart Animate + IKEA)
7. **Magnetic wall/floor/cabinet snap with alignment lines** (Figma + Minecraft)
8. **Hotbar of recently-used cabinet types at bottom** (Minecraft)
9. **Long-press on dimension label → type exact mm value** (Roblox Properties panel)
10. **Conflict warnings with resolution offers, not silent blocks** (Car configurator)

Every item on this list has been battle-tested by a product that has millions of users who don't read manuals. **Steal shamelessly. Attribute nothing. Ship fast.**



gpt 5.2:


## TL;DR (what this unlocks)

For a **mobile-first kitchen designer**, the “hard constraints” aren’t about fancy rendering—they’re about **load time, memory, and interaction clarity**:

- On low-end Android phones, you win by shipping **small assets** (glTF + compressed textures) and keeping **draw calls low** (mobile WebGL is draw-call-sensitive). [1](https://www.khronos.org/gltf)
- **Unity WebGL is structurally a bad fit for cheap phones** (Unity explicitly says WebGL doesn’t support mobile and warns about memory/power limits). [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
- “Rotate camera vs rotate object” becomes unconfusing when the app makes it **impossible to do both with the same gesture**: background drag = camera, gizmo/tool = object. Nomad + Shapr3D are basically case studies in this separation. [3](https://nomadsculpt.com/manual/camera)
- Minimum viable 3D for a quote is usually **“shape + scale + materials, no surprises”**. Texture realism helps, but _lighting cues_ (contact shadows + coherent lighting) do more for spatial trust than ray tracing. [4](https://www.mdpi.com/2313-433X/12/3/113)
- Best 2D/3D switching is not “two apps”—it’s **one selection + one tool state**, with the camera doing a smart transition (SketchUp camera projection; Onshape/Fusion sketch modes that “look at” the plane). [5](https://help.sketchup.com/article/3000106)

---

# F1) 3D engines on low-end Android (~$150 phones): performance ceiling + bundle size

## The key constraint: your “engine” choice is really (A) delivery model + (B) memory model

On cheap phones in Uzbekistan, you’re usually fighting:

- **network + cache** (first load must be small and resilient),
- **RAM / GPU memory** (textures dominate),
- and **driver overhead** (draw calls kill you faster than triangles on mobile WebGL). [6](https://wonderlandengine.com/about/webgl-performance/)

That means “engine performance” is often less about raw shader speed and more about:

- **how well you can constrain assets** (glTF + KTX2),
- **how modular the engine is** (tree-shaking),
- and whether you’re running **native** vs **browser**. [1](https://www.khronos.org/gltf)

---

## Comparison table (practical, not ideological)

|Option|Where it runs|Bundle / download reality|Performance ceiling on low-end Android|When it’s the right choice|
|---|---|---|---|---|
|**Three.js**|Mobile browser (WebGL)|`three.module.min.js` is ~**340KB** (raw) on unpkg/jsDelivr; Bundlephobia-style “min+gzip” is often quoted ~**168KB** for v0.175.0 (varies by build). [7](https://app.unpkg.com/three%400.180.0/files/build)|High enough for “cabinet-grade 3D” if you keep **draw calls low** and assets optimized. Your ceiling is mostly **assets + batching**, not the engine. [6](https://wonderlandengine.com/about/webgl-performance/)|Best fit for **PWA / web-first** kitchen design with tight initial load.|
|**Babylon.js (UMD “babylonjs” package)**|Mobile browser (WebGL)|The UMD file `babylon.js` is **very large** (e.g., **8.28MB** listed on unpkg for 9.7.0). This is before gzip/brotli and before you add assets. [8](https://app.unpkg.com/babylonjs%409.7.0)|Can run well, but you pay in **download + parse + memory** unless you go modular.|If you want an “engine-y” web stack (more built-in systems) and can accept more weight.|
|**Babylon.js (modular `@babylonjs/core`)**|Mobile browser (WebGL)|Can be much smaller with selective imports. A thesis experiment reports reducing Babylon from multi‑MB to **~962KB** by using core + selected modules. [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)|Similar rendering ceiling to Three.js for simple scenes; memory can differ. That same thesis measured **no FPS difference** in a minimal scene but **~46% higher memory use** for Babylon vs Three. (Small test; still a useful warning.) [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)|If you _need_ Babylon features but will be disciplined about modular imports + assets.|
|**Unity WebGL**|Mobile browser (WebAssembly + WebGL)|Build outputs are typically **WASM + data**; even “small” projects become multi‑MB, and Unity’s own docs frame mobile browser as problematic. Unity explicitly says WebGL **doesn’t support mobile devices** and shows a **warning** on mobile browsers. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)|On low-end phones, the ceiling is often “it loads at all.” Unity explains browser heap allocation/memory variability; mobile browsers are the worst case. [10](https://docs.unity3d.com/es/2018.3/Manual/webgl-memory.html)|Usually the wrong pick for a phone-first CAD-like editor. If you want Unity, ship **native**, not WebGL. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)|
|**Flutter “3D” (realistically: Flutter UI + embedded 3D)**|Native app|Flutter’s own FAQ: it **doesn’t support 3D using OpenGL ES or similar** directly. But plugins exist that embed native engines (e.g. Filament on Android, SceneKit on iOS) for glTF. [11](https://docs.flutter.dev/resources/faq?li_fat_id=7c88346a-6420-4c1c-8a85-bc6ecf31e693)|Native rendering (Filament/SceneKit) usually beats mobile WebGL for stability and power efficiency. Tradeoff is app install/update friction.|Best if you want **offline**, better perf, and “feels like a real app” on cheap Android.|

### Two non-obvious takeaways

1. **Unity WebGL is “anti-schoolboy” on cheap phones** because the kid’s first experience is often _waiting_ or _crashing_—and Unity itself basically warns you this will happen on mobile browsers. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
2. **Three.js is “small by default.” Babylon is “big unless disciplined.”** Even a lightweight academic comparison found Babylon needed care to get down near 1MB, while Three was tiny in their setup. [9](https://www.diva-portal.org/smash/get/diva2%3A1523176/FULLTEXT01.pdf)

---

## The real performance ceiling lever: asset pipeline (glTF + compressed textures)

If you want low-end phones to feel “instant,” treat geometry + textures like product, not output.

- Khronos positions **glTF** as designed for **efficient transmission/loading** and minimizing runtime processing (often described as “JPEG of 3D”). [1](https://www.khronos.org/gltf)
- Texture payload dominates. Khronos’ KTX guidance and the `KHR_texture_basisu` ecosystem are explicitly about reducing **download size** and **GPU memory**, across diverse devices. [12](https://www.khronos.org/ktx)
- Three.js’ `KTX2Loader` explicitly supports **Basis Universal** textures that can be transcoded to GPU-native formats. [13](https://threejs.org/docs/pages/KTX2Loader.html)

**Translation for your kitchen editor:** you can keep the engine choice flexible if your assets are already “phone-grade.”

---

# F2) “Rotate camera” vs “rotate object” (never confuse the user)

## The core rule: don’t let the same gesture do both

Confusion happens when:

- a drag sometimes orbits the camera,
- sometimes rotates a cabinet,
- and the user can’t tell which mode they’re in.

The best mobile 3D apps solve this by enforcing **gesture zoning + mode separation**:

### Nomad Sculpt: “background drag = camera; tools = object transform”

Nomad’s manual explicitly says you **rotate the camera** by dragging **one finger on the background**. [3](https://nomadsculpt.com/manual/camera)  
Nomad also has a “gesture menu” concept where you can assign finger vs stylus behavior (e.g., finger drag only moves the camera while stylus drag sculpts), and it warns that if the same gesture is chosen for two options, one will be disabled—this is basically “confusion prevention by design.” [14](https://nomadsculpt.com/manual/interface)  
When you want object-level changes, Nomad pushes you into **transform tools / gizmo** world (its tools documentation frames objects as node+vertices with a transform matrix, and provides dedicated gizmo/rotate/scale tools). [15](https://nomadsculpt.com/manual/tools)

**Pattern to steal:** camera navigation is “ambient,” object rotation is “explicit tool.”

---

### Shapr3D: navigation gestures for the view; explicit Transform tools for geometry

Shapr3D’s gesture/shortcut guide separates **Orbit (Rotate camera)** as navigation. [16](https://support.shapr3d.com/hc/en-us/articles/7873906073884-Keyboard-shortcuts-gestures-and-hotkeys)  
For rotating objects, Shapr3D provides a dedicated **Move/Rotate (3D)** tool under the Transform menu. [17](https://support.shapr3d.com/hc/en-us/sections/7768328803228-Transform-menu)

**Pattern to steal:** there is no ambiguity—rotation of parts happens because you invoked a Transform tool.

---

### Polycam: “orbit view” vs “first-person mode” (camera modes, not object modes)

Polycam’s Gamepad Mode article explicitly frames standard viewing as **orbital camera angles** and shows switching between an orbit icon and “gamepad” first-person navigation. [18](https://learn.poly.cam/hc/en-us/articles/29686097072532-How-to-Use-Gamepad-Mode)

Even though Polycam is a viewer more than an editor, it’s a great reference for _teaching the user what kind of camera they’re controlling_ by making the mode visible.

---

## Recommended “schoolboy-proof” scheme for your kitchen editor (mobile)

This is the simplest mapping that tends to stay unconfusing:

1. **One-finger drag on empty space = orbit camera** (3D mode only).
    
    - Copy Nomad’s “background drag rotates camera” clarity. [3](https://nomadsculpt.com/manual/camera)
2. **One-finger drag on selected object = move only** (not rotate).
    
    - Object rotation is _harder to predict_ than translation; don’t make it accidental.
3. **Rotate object only via a visible gizmo / handle**
    
    - Shapr3D/Nomad both push object rotation into explicit tools/gizmos. [17](https://support.shapr3d.com/hc/en-us/sections/7768328803228-Transform-menu)
4. Add an “Oh no I’m lost” camera affordance:
    
    - “Reset view” / “Zoom to fit” / “Look at selection” (common CAD survival moves).

---

# F3) Minimum viable 3D realism for a kitchen quote (recognizable + trustworthy)

## A useful “fidelity ladder” grounded in real tools

Polycam’s Render Mode is a great reference because it’s literally structured as three “truth levels”:

- **Scan (textured)**: described as a “realistic representation… ideal for presentations, client reviews, and final model assessments.” [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)
- **Mesh (wireframe)**: positioned for technical inspection (topology, polygon distribution). [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)
- **Clay (flat shaded)**: removes textures to focus on “shape, proportions… without visual distractions.” [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)

**Key insight:** even a pro capture tool distinguishes “client review mode” (textured) from “shape trust mode” (clay). That suggests your kitchen designer likely needs **both**—but not ray tracing.

---

## What actually makes people believe scale/space (often cheaper than photoreal)

A 2026 review of photorealism cues in architectural scenes notes that adding **plausible cast shadows** and **coherent lighting** can significantly improve viewers’ accuracy in estimating distances and understanding spatial arrangement. [4](https://www.mdpi.com/2313-433X/12/3/113)

So if you have a performance budget, spend it on:

- stable lighting,
- contact shadows / AO-ish grounding,
- and consistent material response  
    before you spend it on high-res textures everywhere.

---

## Trust comes from control + clarity, not just pixels

A study on 3D product presentations and e-shopping trust found effects from **graphical characteristics** (visual quality) and **visual control** (ability to manipulate the view), including interaction effects. [20](https://www.ccsenet.org/journal/index.php/ibr/article/view/35256)

Separately, research on **360° rotatable product images** shows interactivity can raise purchase intention versus static images (with caveats like cognitive load). [21](https://www.sciencedirect.com/science/article/pii/S0969698919310902)

**Translation for kitchens:** letting the customer orbit and inspect the design (and see key dimensions) can do more for “I trust this quote” than photoreal ray tracing.

---

## Photoreal can backfire (especially early)

Architectural Digest reports designers warning that photorealistic renderings too early can create “implied permanence” and make clients push back; sketches can keep collaboration open. [22](https://www.architecturaldigest.com/story/are-photorealistic-renderings-worth-it)

This is relevant to your “schoolboy test”: you want **fast edits** and low fear. Overly finished visuals can psychologically “lock” the design.

---

## A concrete “minimum viable 3D” spec (what I’d ship first)

If your goal is “recognizable enough to trust the quote,” the smallest effective stack tends to be:

**Level 0 (don’t ship as customer view):** wireframe/mesh

- Useful for debug and manufacturing inspection, but feels “technical,” not “my kitchen.” (Matches Polycam’s positioning.) [19](https://learn.poly.cam/hc/en-us/articles/28785257328276-How-to-Use-Render-Mode)

**Level 1 (minimum):** flat shaded “clay” + crisp edges + grounding shadow

- Customer can read volumes, door gaps, toe-kick, appliance voids.
- Shadow/light cues support depth understanding. [4](https://www.mdpi.com/2313-433X/12/3/113)

**Level 2 (recommended):** simple PBR-ish materials (not photo textures) + a few hero textures

- Color/material mapping for “white melamine vs oak vs matte black,” but keep textures sparse.

**Level 3 (often unnecessary on $150 phones):** full photoreal, heavy textures, ray tracing

- Expensive + raises expectation risk; not required for trust if dimensions and materials are clear. [22](https://www.architecturaldigest.com/story/are-photorealistic-renderings-worth-it)

---

# F4) 2D/3D mode switching: SketchUp vs Onshape vs Fusion 360 (and what to copy)

## The shared idea: switching is mostly camera + constraints, not data

All three treat 2D/3D as:

- the **same model**
- viewed through a different “camera/interaction contract.”

That’s exactly your principle (“two cameras, one model”).

---

## SketchUp: “2D mode” is basically camera projection + standard views

SketchUp’s Camera menu provides default views (top/bottom/left/right/front/back/iso). It also discusses **Parallel Projection** (orthographic) and recommends a standard view with parallel projection for export. [5](https://help.sketchup.com/article/3000106)

**What stays stable:** you’re still selecting geometry in the same model; you’ve just changed how the camera projects it (perspective vs orthographic).  
**What to copy:** the “2D plan view” can simply be **Top + orthographic** with different gesture expectations.

---

## Onshape: “2D” happens inside Sketch mode (plus guardrails to prevent accidental rotation)

Onshape’s View cube provides quick orientation changes (top/front/isometric, etc.). [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)  
The big mobile-first gem: **“If a sketch is open and an entity is selected, the 3D Rotate Lock turns on by default.”** [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)

That’s _exactly_ how you stop the classic phone-CAD failure mode: the kid tries to drag a line endpoint and the whole world rotates.

**What to copy:** auto-lock view rotation while editing 2D constraints, and make unlocking explicit.

---

## Fusion 360: “Edit sketch” is a contextual mode + camera looks at the plane (optionally automatic)

Fusion documentation calls out a “Look At” behavior: it **rotates the camera to look directly at the active sketch plane**. [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)  
Autodesk support content also references a preference: **“Auto look at sketch.”** [25](https://help.autodesk.com/view/fusion360/ENU/?caas=caas%2Fsfdcarticles%2Fsfdcarticles%2FCannot-snap-to-objects-when-sketching-in-Fusion-360.html)

**What to copy:** when entering 2D edit, animate the camera to normal-to-plane (and ideally remember it).

---

## A very usable 2D/3D switch recipe for your app

1. **Selection persists across modes** (same object ID, same highlights).
    
    - (This is a design recommendation; the docs above mainly justify the camera/mode mechanics.)
2. **Switching 3D → 2D**:
    
    - Camera animates to **orthographic normal-to-selected face/plane** (“Look At” behavior). [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)
    - Turn on **rotate lock** automatically while a 2D entity handle is active (Onshape-style). [23](https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm?Highlight=How+do+I+create+a+cube)
3. **Switching 2D → 3D**:
    
    - Return to last 3D orbit camera pose (so the user doesn’t feel “teleported”).
    - Keep the same selection and show the 3D affordances.
4. **Gesture remapping should be explicit, not subtle**
    
    - In 2D: prioritize pan/zoom and direct handle drags; de-emphasize orbit.
    - In 3D: orbit/pan/zoom are ambient; transforms are explicit tools.

---

# “Conventions.md” bullets (drop-in constraints)

- Prefer **Three.js** for web-first low-end phones; prefer **Flutter UI + embedded native 3D** if you need offline and smoother perf; avoid **Unity WebGL** for phone-first because Unity explicitly doesn’t support mobile WebGL. [2](https://docs.unity3d.com/cn/2021.2/Manual/webgl-browsercompatibility.html)
- Asset pipeline: **glTF + KTX2/Basis** for textures; keep GPU memory low. [1](https://www.khronos.org/gltf)
- Interaction: background drag rotates camera; object rotation only via **gizmo/tool**. [3](https://nomadsculpt.com/manual/camera)
- Mode switch: 2D is a camera + gesture contract; entering 2D auto “look at sketch plane” and lock orbit while editing (Fusion/Onshape pattern). [24](https://help.autodesk.com/view/fusion360/ENU/?contextId=SKT-3D-SKETCH)

If you treat these as hard constraints (not “nice to haves”), you end up with an editor that loads fast on cheap Android and never makes the user wonder “what am I rotating right now?”—which is basically the heart of the schoolboy test.



---



earnie 5.1:

# # Mobile-First 3D/2D Editing — Hard Constraints to Solve

Research organized by what each answer actually determines about your architecture.

---

## 1) 3D Engine Selection: What Runs on a $150 Android

This is an infrastructure decision that cannot be undone. Make it correctly once.

### The Core Tradeoff: Library vs. Engine

[3](https://blog.logrocket.com/three-js-vs-babylon-js/) Three.js focused on being a lightweight WebGL wrapper; Babylon.js went straight for the full-game engine route. That single sentence defines everything else.

|Property|Three.js|Babylon.js|
|---|---|---|
|**Philosophy**|[4](https://javascript.plainenglish.io/babylon-js-vs-three-js-which-should-you-choose-14faef9f7d78?gi=cf52ca1db04d)Low-level library — its core package is minimal, handling only the rendering itself.|[3](https://blog.logrocket.com/three-js-vs-babylon-js/)A complete 3D engine — comes with built-in systems for physics, animations, GUI, and most functionality right out of the box.|
|**Bundle size**|Smaller — bring only what you need|Larger — full engine ships together|
|**Mobile FPS**|[1](https://forum.babylonjs.com/t/how-to-imporve-performance-on-mobile-more-effectively/49593)Same GLTF run on Babylon.js and Three.js on Android/iOS — Three.js is smoother and gets higher FPS.|Slower on first frame — [2](https://forum.babylonjs.com/t/babylonjs-takes-longer-to-render-the-first-frame-on-mobile-compared-to-threejs/41213)rendering a .glb file with ~60 materials shows bad first-frame performance in mobile mode compared with Three.js or PlayCanvas.|
|**Production scene management**|Manual — [4](https://javascript.plainenglish.io/babylon-js-vs-three-js-which-should-you-choose-14faef9f7d78?gi=cf52ca1db04d)gives you full flexibility but also full responsibility; you must decide how to handle state, loaders, updates, and events.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Makes significant use of the CPU for scene management, frustum culling, and sophisticated internal state tracking — adds overhead but results in better predictable frame times when dealing with thousands of objects.|
|**glTF / mesh loading**|Slower, more manual — [7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)requires more manual intervention and configuration for complex glTF extensions and optimization features.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Offers exceptionally robust glTF parsing, including highly-optimized mesh merging and material handling.|
|**Debugging tools**|Limited|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Babylon.js's Inspector offers a live view of the scene graph, material properties, and performance metrics without stopping the render loop — this feature alone drastically cuts down debugging time.|
|**WebGPU readiness**|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Relies on its community to adapt its minimalist approach to WebGPU, often requiring foundational changes.|[7](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6)Was one of the first engines to provide a working, feature-complete WebGPU backend, designed to mirror its existing WebGL API structure — a major advantage for future-proofing.|

### The Verdict for Your Specific Case

Your kitchen has a **bounded, low-complexity scene**: 20–60 box meshes (cabinet panels), a few materials (wood grain, white lacquer, chrome), and no physics. This is exactly where Three.js wins:

- **Lower baseline memory** → survives on 2GB RAM devices (Redmi 9, Samsung A05)
- **Higher FPS on simple scenes** → raw render performance beats Babylon.js at low poly counts
- **Smaller initial bundle** → critical for Uzbekistan mobile data costs
- [8](https://rahijamil.medium.com/comparing-three-js-and-babylon-js-which-javascript-3d-library-is-right-for-you-7196ef21949e) Three.js is probably the best choice for simpler applications — and a grid of box meshes is a simple application

**Where you'd switch to Babylon.js**: if you add real-time AR (fitting the kitchen into a phone camera view), or if you need the built-in scene management for >1000 objects. Neither applies to you now.

### Flutter 3D / Unity WebGL — Why to Avoid Both

|Engine|Problem for You|
|---|---|
|**Flutter 3D**|No mature 3D scene graph. Flutter's rendering is 2D-first; 3D is bolted on via platform channels. No production kitchen app uses it.|
|**Unity WebGL**|Bundle size is prohibitive for mobile web — typically 20–50MB before your assets. Load time alone fails the schoolboy test on a 10Mbps connection.|

**Recommendation: Three.js with drei (React Three Fiber)** if your app is web/PWA, or **Three.js direct** if native Android. Keep the scene to box geometries + a single PBR material per surface type.

---

## 2) Camera Rotate vs. Object Rotate — The Hardest Confusion in Mobile 3D

This is arguably the most common source of user disorientation in 3D apps. Here's how the best tools solve it.

### The Core Problem: Two Things Can Spin

The user's mental model is: _I am moving around the kitchen_. But in code, you can either:

- **Move the camera** (world stays still, camera orbits) — correct mental model
- **Rotate the object** (camera stays still, kitchen spins) — feels wrong, disorienting

The best apps always pick **one** and never expose the ambiguity.

### How Nomad Sculpt Solves It (The Clearest Pattern)

Nomad's solution is elegant: **what your finger touches determines what moves.**

- [10](https://nomadsculpt.com/manual/camera) You rotate the camera by dragging one finger on the background. If you drag the finger on your model, it will instead start the sculpting operation.
- [10](https://nomadsculpt.com/manual/camera) You can put two fingers on the screen — as if you wanted to start a pan/zoom gesture — and then release one finger to rotate the camera even when the model fills the whole screen.
- [10](https://nomadsculpt.com/manual/camera) By moving two fingers, you can pan the camera. By using the pinch gesture you can zoom in/out. You can roll the view by rotating two fingers.

**The pivot point system** is the other half of Nomad's solution:

- [10](https://nomadsculpt.com/manual/camera) When you rotate the camera you can see a small pink dot — this is your camera pivot point. It's very important to understand where your pivot is so that you don't get lost or frustrated by the camera.
- [10](https://nomadsculpt.com/manual/camera) Double tap on the model to focus the picked point. If you double tap in the background, the camera will focus on the selected mesh instead.

### How Shapr3D Solves It (CAD-Style)

Shapr3D uses the **orientation cube** pattern instead of free gesture:

- [18](https://support.shapr3d.com/hc/en-us/articles/13079128172956-Control-the-view-of-your-modeling-environment) One of the most powerful parts of the interface is the orientation cube in the upper right-hand corner. You can click on individual faces to get orthographic views, and use the arrows to rotate the view.
- [18](https://support.shapr3d.com/hc/en-us/articles/13079128172956-Control-the-view-of-your-modeling-environment) On a touch screen, you can use one finger to rotate.
- [15](https://support.shapr3d.com/hc/en-us/articles/7873944390812-Views-and-Appearance) The "Rotate View" control rotates the camera view in fixed angle increments — preventing the disorientation of free rotation.

**Shapr3D's key insight**: for engineering/CAD users, _snapping to preset views_ (front, top, isometric) is safer than free-rotate. Users jump between canonical views rather than spinning freely.

### The Turntable vs. Trackball Problem

This is a real fork in your design:

|Mode|How it works|Good for|Bad for|
|---|---|---|---|
|**Turntable** (Nomad default)|[10](https://nomadsculpt.com/manual/camera)Camera uses only two degrees of freedom — more intuitive but less flexible.|Your kitchen — you never need to look at it upside down|Inspecting underside of objects|
|**Trackball**|[10](https://nomadsculpt.com/manual/camera)Lets you roll the view by rotating two fingers on the viewport.|Sculptors, freeform 3D|Confusing for non-3D users — kitchen can end up tilted 45° with no way back|
|**Constrained orbit** (Fusion/Onshape preferred)|Rotation locked to vertical axis — [29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate)rotation around an object doesn't cause it to tilt side to side — fixed to a vertical axis.|✅ Kitchen design — room is always upright||

### The "Object Flies Off Screen" Problem

[29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate) In Onshape, the focus fulcrum is at the center of a previous selection or mouse-over — not at the object — so the object is always flying off the screen. This is the most common complaint in 3D camera controls and must be avoided.

**Fix**: Always orbit around the **bounding box center of the selected cabinet**, not the world origin. When nothing is selected, orbit around the kitchen's center.

### Recommended Gesture Map for Your App

|Gesture|Action|Mental model|
|---|---|---|
|**1-finger drag on background**|Orbit camera (turntable)|"I'm walking around the kitchen"|
|**1-finger drag on cabinet**|Select / activate that cabinet|"I'm touching that unit"|
|**2-finger pinch**|Zoom in/out|Standard|
|**2-finger drag**|Pan camera|"I'm sliding sideways"|
|**Double tap on cabinet**|Focus orbit pivot on that cabinet|"Look at this one"|
|**Double tap on background**|Reset to full kitchen view|"Show me everything"|
|**Tap orientation cube face**|Snap to canonical view (front/top/iso)|"Look straight at it"|

**Never expose a "rotate object" control.** The camera always moves. The kitchen always stays still.

---

## 3) Minimum Viable 3D: The Trust Threshold

Your real question here is: **at which rendering quality does a customer in Tashkent say "yes, that's going to be my kitchen" and approve the quote?**

### The Four Levels — And Where Trust Kicks In

|Level|What it looks like|Customer reaction|GPU cost|
|---|---|---|---|
|**Wireframe**|Lines only, no surfaces|"Is this a blueprint?" — no spatial understanding|Near zero|
|**Flat-shaded**|Solid colors, no lighting|Understands shapes and layout — but "looks like a toy"|Very low|
|**Flat + ambient occlusion**|Soft shadows in corners|"OK I can see the depth" — functional trust begins here|Low-medium|
|**Textured (diffuse only)**|Wood grain, white lacquer, visible door handles|✅ **Trust threshold** — [21](https://arktek3d.com/blog/3d-visualization-for-restaurant-interiors-everything-a-designer-needs-to-know/)"using real textures in your renders creates trust — clients can clearly visualize upholstery, countertops, wood grains, and wall finishes."|Medium|
|**PBR / ray-traced**|Reflective surfaces, caustics, photorealistic|"Wow" — but overkill for quote approval|High → impossible on $150 Android|

### Why Textures Are the Threshold, Not Photoreal

[22](https://www.cadcrowd.com/blog/why-3d-rendering-is-essential-to-modern-kitchen-design-services-with-3d-visualization-firms/) A standard 2D floor plan does not adequately reflect the depth, texture, and illumination of a room. With 3D rendering, designers can show clients precisely how their kitchen will look on every side, down to the hue and feel of the countertops.

The key word is **hue and feel** — not photorealism. Customers need to answer two questions:

1. _Does this fit in my space?_ → Answered by **correct proportions + flat-shaded 3D**
2. _Do I like how it will look?_ → Answered by **diffuse textures (wood color, door style)**

[25](https://www.2020kitchendesign.com/how-3d-rendering-helps-kitchen-design/) Interactive 3D models allow clients to test different materials and layouts while evaluating multiple styles in real time. That "test different materials" moment — swapping oak grain for white lacquer — is worth more than photorealism.

### The "Recognizable Enough" Spec for Your App

For your schoolboy test — a customer in Uzbekistan approving a kitchen quote on a $150 phone — you need:

|Feature|Yes/No|Reason|
|---|---|---|
|**Correct box proportions**|✅ Required|Without this, spatial trust fails|
|**Diffuse wood/lacquer texture per panel**|✅ Required|This is the trust threshold|
|**Door style silhouette** (flat panel vs. shaker vs. glass)|✅ Required|Second-biggest visual differentiator|
|**Ambient occlusion (baked, not real-time)**|✅ Nice|Cheap depth cue — pre-bake it|
|**Real-time shadows**|❌ Skip|GPU cost too high on low-end Android|
|**Reflections**|❌ Skip|Unnecessary for quote approval|
|**Ray-tracing / PBR**|❌ Skip|Impossible on $150 devices at 60fps|
|**Handles / hardware detail**|⚠️ Optional|Swap between "no handle", "bar handle", "knob" silhouette sprites — no 3D mesh needed|

**The target visual**: Flat-shaded boxes with a 512×512 tiled diffuse texture (oak, white, grey, walnut) + baked AO + correct proportions. This is achievable at 60fps on a Snapdragon 460. Anything above this is polish for a future version.

**Texture atlas strategy**: 4 materials × 1 texture = one draw call for the whole kitchen. Critical for low-end Android.

---

## 4) 2D/3D Mode Switching: What the Best Tools Do and Where They Fail

### Fusion 360's Insight: There Is No Switch

This is the most important finding for your architecture:

[27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582) There is no difference between a 2D and 3D sketch in Fusion — all sketches are inherently 3D, but by default, all geometry will be created on the sketch plane.

Fusion's model: [27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582)take a 2D sketch, extrude it — which then automatically shifts the view from the 2D sketch view into the 3D view. The "switch" is not a mode change — it's a **camera position change triggered by the operation**.

[32](https://productdesignonline.com/fusion-360-tutorials/introduction-to-3d-sketching-in-fusion-360/) In a 2D sketch, geometry is constrained to the plane used to create the sketch. A 2D sketch plane can originate anywhere in 3D space — however, the selected plane restricts sketch geometry to that plane.

**The architectural implication**: Your app should store one model. The 2D view is just the camera looking straight down (orthographic, top view). The 3D view is the same camera pulled back and tilted to isometric. Same data. Same panels. Two camera presets.

### What Breaks During the Switch (The Hard Problems)

#### Problem 1: Gesture Remapping Confusion

Every 3D app has this problem — gestures mean different things in 2D vs. 3D:

|Gesture|In 2D (floor plan)|In 3D|
|---|---|---|
|1-finger drag|Pan the floor plan|Orbit the camera — **if same gesture, very jarring**|
|Pinch|Zoom|Zoom (same — OK)|
|2-finger drag|Pan|Pan (same — OK)|
|1-finger tap|Select panel|Select panel (same — OK)|

**Fix**: In 2D mode, disable orbit entirely. 1-finger drag = pan. The camera cannot leave the top-down plane. This removes all gesture ambiguity.

#### Problem 2: The "Object Flies Off Screen" on Switch

The camera transition from 2D to 3D must:

1. Animate from `(x, y, z_far, looking_down)` to `(x_iso, y_iso, z_iso, looking_at_center)`
2. Keep the **same focal point** — the center of the kitchen bounding box
3. Maintain the **same selection state** — if panel 3 was selected in 2D, it's still selected in 3D

This is what Onshape fails at: [29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate)the focus fulcrum rotates about some random point or origin, so the object is always flying off the screen.

**Implementation**: Store `kitchen.boundingBoxCenter` as the persistent orbit target. All camera transitions animate toward this point. Never reset to world origin.

#### Problem 3: What Onshape Gets Right — Constrained Rotation Preference

[29](https://forum.onshape.com/discussion/14842/how-do-i-make-the-camera-controls-not-awful-seriously-everything-shouldnt-tilt-on-camera-rotate) You can go to preferences, scroll down to mouse controls, and check the "Set default rotation behaviour to constrained rotate" box — this is a *user-settable* preference in Onshape. The lesson: **some users want free trackball, some want constrained turntable**. For your schoolboy, constrained is always correct. Make it the only option.

### Recommended 2D/3D Switch for Your App

|Property|Implementation|
|---|---|
|**Trigger**|Single button tap (or two-finger double-tap) — not a hidden mode|
|**Transition**|400ms animated camera move — spring curve, same focal point|
|**2D camera**|Orthographic, top-down, locked to XZ plane, no orbit|
|**3D camera**|Perspective, isometric starting angle, turntable orbit|
|**Gesture set**|Remaps silently on transition — user never sees a settings change|
|**Selection**|Preserved through switch — selected panel stays highlighted|
|**Dimensions**|Live mm overlay present in both modes|
|**What changes**|Camera position + FOV + gesture bindings only. Model data: unchanged.|

**Visual cue on the button**: Show a small floor plan icon (2D) or a cube icon (3D). Don't label it "mode" — label it with what you'll see, not what you're doing.

---

## Synthesis: The Schoolboy Test Scorecard

|Hard constraint|Decision|Rationale|
|---|---|---|
|**Engine**|Three.js|[1](https://forum.babylonjs.com/t/how-to-imporve-performance-on-mobile-more-effectively/49593)Three.js is smoother and gets higher FPS on low-end Android; simpler scenes don't need Babylon's overhead|
|**Camera paradigm**|Always move camera, never rotate object|Matches "I'm walking around my kitchen" mental model|
|**Rotation mode**|Constrained turntable (vertical axis locked)|Onshape's free trackball is confusing; Nomad's turntable default is right|
|**Pivot point**|Bounding box center of selected cabinet|Prevents "object flies off screen"|
|**Render quality**|Flat-shaded + diffuse texture (512px) + baked AO|[21](https://arktek3d.com/blog/3d-visualization-for-restaurant-interiors-everything-a-designer-needs-to-know/)Using real textures creates trust — textures are the threshold, not photoreal|
|**2D/3D**|One model, two camera presets|[27](https://forums.autodesk.com/t5/fusion-design-validate-document/rookie-q-how-to-switch-between-2d-amp-3d-sketching/td-p/10888582)All geometry is inherently 3D — the "switch" is just a camera move|
|**2D gesture**|1-finger = pan only (no orbit)|Removes gesture ambiguity entirely|
|**Switch transition**|400ms spring animation, same focal point|Prevents disorientation|

The single biggest mistake you can make in this section: **treating 2D and 3D as different data models**. Fusion's insight — everything is 3D, the plane is just a constraint — is the correct architecture. Build it once.