# 🪵 The Physics of the Box: A Parametric Logic Engine for Cabinet Structural Integrity

This is a deep technical brief — organized as a spec document your software can actually enforce. Let's go layer by layer.

---

## PART 1: The Bending Shelf — Material Physics of LDSP (Chipboard)

### 1.1 Why Chipboard Bends: The MOE Problem

LDSP (Laminated Chipboard / Particleboard) is fundamentally weaker than solid wood or plywood because it has no continuous wood grain running its length. Its structural resistance to bending is defined by its **Modulus of Elasticity (MOE)**, which for standard 700–750 kg/m³ particleboard sits at roughly **1,500–1,800 MPa** — compared to ~9,000 MPa for pine and ~12,000 MPa for plywood. This is the most important number in your logic engine.

[4](https://woodbin.com/calcs/sagulator/) The Sagulator tool calculates shelf deflection given shelf material, load, load distribution, dimensions, and method of attachment. Your parametric engine must replicate this logic.

### 1.2 The Deflection Formula (The Core Math)

For a simply supported beam (a shelf pinned at both ends, which is the worst-case assumption), the midpoint deflection formula is:

text

```
δ = (5 × w × L⁴) / (384 × E × I)
```

Where:

- **δ** = midpoint deflection (mm) — your output value
- **w** = uniformly distributed load (N/mm) — load per unit length
- **L** = unsupported span (mm) — the critical input
- **E** = Modulus of Elasticity (MPa) — material constant
- **I** = Second Moment of Area = (b × h³) / 12 — geometry constant
    - **b** = shelf depth (mm)
    - **h** = shelf thickness (mm)

**Second Moment of Area for your two materials:**

|Thickness|Depth 300mm|Depth 400mm|Depth 600mm|
|---|---|---|---|
|16mm LDSP|I = 6,144,000 mm⁴|I = 8,192,000 mm⁴|I = 12,288,000 mm⁴|
|18mm LDSP|I = 8,748,000 mm⁴|I = 11,664,000 mm⁴|I = 17,496,000 mm⁴|

_(Formula: I = 300 × 16³ / 12 = 102,400 × 60 = 6,144,000 mm⁴)_

### 1.3 The Allowable Deflection Limit (Your Pass/Fail Threshold)

[2](https://www.ukworkshop.co.uk/threads/shelf-sag.103670/) Any deflection under 3mm is generally considered acceptable for commercial work. This is your **hard ceiling**. For a parametric engine, use a tiered system:

|Deflection|Status Flag|Action|
|---|---|---|
|δ ≤ 1.5mm|✅ PASS — Excellent|Allow|
|1.5mm < δ ≤ 3.0mm|⚠️ WARN — Acceptable|Allow with warning|
|δ > 3.0mm|❌ FAIL — Structural Risk|Block or require mid-support|

### 1.4 Maximum Span Lookup Table (Pre-computed for your engine)

Using E = 1,600 MPa (conservative chipboard), depth = 300mm, load = 15 kg/m (150 N/m = 0.15 N/mm), δ_max = 3mm:

|Material|Safe Max Span|Heavy Load (dishes, 25kg/m)|
|---|---|---|
|**16mm LDSP**|~580–620mm|~450mm|
|**18mm LDSP**|~700–750mm|~550mm|

[7](https://www.virmdf.com/blog/mdf-shelf-span-guide-how-to-prevent-sagging-with-simple-rule-of-thumb-table) Thinner 16mm suits short spans (under 500mm), but you should test screw hold near edges. [7](https://www.virmdf.com/blog/mdf-shelf-span-guide-how-to-prevent-sagging-with-simple-rule-of-thumb-table) For standard wardrobes with a 300mm deep shelf and light loads, 18mm thickness works for spans up to 650mm, balancing cost and strength in dry interiors. [7](https://www.virmdf.com/blog/mdf-shelf-span-guide-how-to-prevent-sagging-with-simple-rule-of-thumb-table) For spans that exceed 500mm or loads that include kitchenware, choose 18–25mm thickness.

**Your Engine's Enforcement Rule #1:**

text

```
IF span > 700mm AND thickness == 18mm AND load_type == "heavy_dishes"
  → FLAG: "Add mid-panel support or upgrade to 25mm"
IF span > 580mm AND thickness == 16mm
  → FLAG: "Critical: span exceeds 16mm chipboard limit. Insert vertical divider."
```

### 1.5 The End Fixation Multiplier (Critical Modifier)

This is a massive structural variable most apps miss. [3](https://woodweb.com/knowledge_base/Span_Limits_for_Plywood_Shelving.html)One key aspect of reducing shelf deflection is end fixation. By routing a 3/8" deep slot in the side panel, deflection is reduced to 1/3 of the deflection of pinned (free-rotating) shelves.

[3](https://woodweb.com/knowledge_base/Span_Limits_for_Plywood_Shelving.html) The slot depth needs to be at least 50% of the shelf thickness in order to prevent end rotation.

**Your Engine's Enforcement Rule #2:**

text

```
IF joint_type == "dado_slot" AND slot_depth >= (thickness * 0.5)
  → APPLY deflection_multiplier = 0.33 (i.e., span limit increases ~44%)
IF joint_type == "shelf_pin" OR joint_type == "cam_lock"
  → APPLY deflection_multiplier = 1.0 (worst case / simply supported)
```

This means an 18mm shelf in a dado joint can safely span up to ~1,000mm for light loads — a fact your competitors' software almost certainly ignores.

### 1.6 The Creep Factor (Long-Term Load)

Chipboard creeps — it continues to deform under sustained load over months and years. [5](https://www.diynot.com/diy/threads/18mm-ply-shelf-strength.478571/)Under fixed-end conditions, deflection may be 0.5mm; under floating ends, 2.5mm — and you should double that estimate over time under sustained 10kg/foot loading.

**Practical Rule for your engine:** Multiply calculated δ × 1.5 to 2.0 for sustained heavy loads (kitchen dishes, books). If the result still passes 3mm, flag as "long-term safe."

---

## PART 2: The Joint — Three Fastener Systems, Three Structural Personalities

### 2.1 The Confirmat Screw — The Structural Workhorse

[15](https://www.finehomebuilding.com/2008/06/27/whats-the-difference-cabinet-assembly-screws) Confirmat fasteners differ from standard wood screws in two key ways: a shank size roughly double that of a typical wood screw, and a thread style that allows the screw to be backed out and reinserted dozens of times without loss of joint strength. [15](https://www.finehomebuilding.com/2008/06/27/whats-the-difference-cabinet-assembly-screws) The heavy upper part of the shank essentially turns a Confirmat fastener into a removable metal dowel, and the threads are designed to compress material, which allows a Confirmat to be reinserted into the same hole without cutting new threads. [11](https://woodweb.com/knowledge_base/Cabinet_Carcase_Fastening_Method_Debate.html) Confirmats are designed to be used without glue. The larger diameter improves joint strength because it allows the threads to bite into the denser outer edges of particleboard, and it is more rigid than an assembly screw.

**Structural Profile:**

- ✅ High pull-out strength
- ✅ High racking resistance (equal to dowels)
- ✅ No clamping required during assembly
- ❌ Visible screw head (requires cover cap)
- ✅ Reversible / disassemblable (30–40 cycles in particleboard)

[15](https://www.finehomebuilding.com/2008/06/27/whats-the-difference-cabinet-assembly-screws) Confirmats are available in lengths of 40mm, 50mm, or 70mm, and in shank sizes of 5mm, 6.3mm, or 7mm.

**Standard Sizing Rule for 16/18mm LDSP:**

- Face board: drill clearance hole = shank diameter (6.3mm typical)
- End board: drill pilot hole = 5mm (thread engagement)
- Minimum edge distance: **≥ 50mm (2")** from panel edge

[9](https://festoolownersgroup.com/threads/cabinet-construction-confirmat-screws-vs-staples.71531/) Both major trade association studies concluded that no fastener should be closer than 2" from the edges of the panel, likely because you need that space to prevent the panel from splitting open.

### 2.2 The Minifix Cam Lock — The Flat-Pack King

[10](https://www.furnitureconnector.com/news/how-to-choose-the-right-minifix-cam-lock-239372.html) The Minifix has a spiral track or "cam" on the inside and a screwdriver slot on its face. When turned, the internal cam engages the head of the connecting dowel and pulls it in, creating a tight, secure joint between two furniture panels. [10](https://www.furnitureconnector.com/news/how-to-choose-the-right-minifix-cam-lock-239372.html) Together, the cam and dowel form a hidden joint that is incredibly strong and easy to assemble, making them the industry standard for cabinets, shelving, office furniture, and modular constructions.

**Structural Profile:**

- ✅ Completely hidden joint (no visible hardware on face)
- ✅ Excellent for repeated assembly/disassembly
- ⚠️ Lower racking strength than Confirmat or glued dowel
- ✅ Self-aligning (some play allows fit adjustment)
- ⚠️ Requires 15mm diameter pocket + cross-bore — precision drilling mandatory

[9](https://festoolownersgroup.com/threads/cabinet-construction-confirmat-screws-vs-staples.71531/) In testing, cam and cam lock screws came in second-to-last for overall strength. Pull-out strength was acceptable, but racking strength was lacking. [12](https://www.woodweb.com/knowledge_base/Dowel_and_Confirmat_Combination.html) The Minifix gives some play for alignment, but in most cases dowels will still be necessary, and that eliminates the ability to adjust.

**Critical Drilling Spec your engine must enforce:**

[10](https://www.furnitureconnector.com/news/how-to-choose-the-right-minifix-cam-lock-239372.html) The single most important factor in selecting a Minifix is the panel thickness. The diameter of the main hole (for the cam) and the distance of the cross-drilled hole (for the dowel) are critical for a perfect fit.

text

```
Standard Minifix Pocket:  Ø15mm × 13.5mm deep
Dowel Cross-Bore Center:  9.5mm from face for 16mm panel
                          10.5mm from face for 18mm panel
Minimum Edge Distance:    37mm from panel end to cam center
```

### 2.3 Wooden Dowels — The Precision Standard

[9](https://festoolownersgroup.com/threads/cabinet-construction-confirmat-screws-vs-staples.71531/) Dowels had the highest racking strength of all tested fastener types and can be kept completely hidden, but require clamping during assembly.

**Structural Profile:**

- ✅ Highest racking resistance of all three systems
- ✅ Fully hidden
- ❌ Requires case clamp + precise CNC boring — no field adjustment
- ❌ Glue required = **permanent joint** (not demountable)
- ✅ Cheapest per-joint hardware cost

**Standard Sizing Rule for 16/18mm LDSP:**

text

```
Dowel diameter:    8mm (standard) or 10mm (heavy duty)
Dowel length:      30–40mm (15–20mm engagement per side)
Hole depth:        ≥ half dowel length + 2mm clearance per side
Hole tolerance:    ±0.1mm (must be CNC bored, not hand-drilled)
Min edge distance: ≥ 2× dowel diameter from panel edge
```

### 2.4 Head-to-Head Comparison Matrix

|Property|Confirmat|Minifix Cam|Dowel (glued)|
|---|---|---|---|
|Racking Strength|⭐⭐⭐⭐|⭐⭐|⭐⭐⭐⭐⭐|
|Pull-Out Strength|⭐⭐⭐⭐|⭐⭐⭐|⭐⭐⭐⭐|
|Disassembly|✅ Many times|✅ Many times|❌ Permanent|
|Visibility|❌ Capped screw|✅ Hidden|✅ Hidden|
|Clamping Required|❌ No|❌ No|✅ Yes|
|Precision Drilling|⭐⭐|⭐⭐⭐⭐⭐|⭐⭐⭐⭐|
|Flat-Pack Viable|✅ Yes|✅ Yes|❌ No|

---

## PART 3: Joint Choice → Shipping Mode (The Flat-Pack Decision Tree)

This is the structural logic that directly governs your delivery/manufacturing module.

### 3.1 Why Joint Type is the Gating Variable

[20](https://castacabinetry.com/post/flat-pack-cabinets/) Flat pack cabinets are designed to be assembled by the consumer; unlike pre-assembled furniture, flat pack items are packaged in compact boxes with all necessary components, making transportation easier and reducing shipping costs.

The joint determines whether a cabinet can ship flat:

|Joint Type|Flat-Pack?|Why|
|---|---|---|
|**Minifix Cam Lock**|✅ Yes — ideal|Tool-free or single screwdriver. Hardware pre-installed in panels. Zero glue.|
|**Confirmat Screw**|✅ Yes — viable|Requires step-drill bit. Screws ship separately. Can be re-done on site.|
|**Glued Dowels**|❌ No|Glue creates permanent bond. Assembly requires case clamp. Cannot be undone.|
|**Dado + Glue**|❌ No|[9](https://festoolownersgroup.com/threads/cabinet-construction-confirmat-screws-vs-staples.71531/)In testing, dadoes without glue failed at a load too low to measure, and fared worst of all tested joints. With glue = permanent.|

### 3.2 The Flat-Pack Structural Trade-off Your Engine Must Model

[20](https://castacabinetry.com/post/flat-pack-cabinets/) Flat pack furniture often utilizes innovative engineering techniques to ensure sturdy construction despite its disassembled state.

However, there is a genuine structural cost: a Minifix cam joint, while convenient, has ~40–50% lower racking resistance than a glued-dowel joint. Your engine must compensate for this in two ways:

**Compensation Rule #1 — The Back Panel as a Structural Diaphragm:**

[16](http://objectguerilla.com/blog/2014/1/29/flat-pack-design-methods-and-materials) The back panel acts as a diaphragm that stiffens the whole cabinet carcass and keeps it from racking, but is prone to loosening over time.

text

```
IF joint_type == "minifix" OR joint_type == "confirmat"
  → ENFORCE: back panel required (min 6mm HDF or 8mm LDSP)
  → ENFORCE: back panel must be glued AND screwed/stapled perimeter
  → FLAG if back panel omitted: "Cabinet will rack. Structural failure risk."
```

**Compensation Rule #2 — Minimum Fastener Count Per Joint:**

[9](https://festoolownersgroup.com/threads/cabinet-construction-confirmat-screws-vs-staples.71531/) On a base cabinet, use three Confirmats per joint (no glue) as a minimum.

text

```
Base cabinet (h > 700mm):  min 3 fasteners per vertical joint
Wall cabinet (h ≤ 700mm):  min 2 fasteners per vertical joint
Shelf-to-side joint:        min 2 fasteners per side (4 total)
Minimum edge distance:      50mm from panel end
Maximum fastener spacing:   ≤ 150mm center-to-center
```

### 3.3 The Moisture Variable — A Hidden Structural Failure Mode

[20](https://castacabinetry.com/post/flat-pack-cabinets/) Cabinets made from particleboard are particularly susceptible to damage from moisture and heavy use. Over time, structural integrity degrades, leading to sagging shelves, loose hinges, or warping. In high-moisture environments like kitchens or bathrooms, particleboard may be prone to swelling or delamination.

**Your Engine's Moisture Flag:**

text

```
IF location == "kitchen" OR location == "bathroom"
  AND material == "standard_LDSP"
  → FLAG: "Use moisture-resistant (MR) grade LDSP. Standard chipboard will 
           swell at joints and delaminate within 2–3 years in this environment."
IF location == "kitchen"
  AND joint_type == "wooden_dowel_glued"
  → WARN: "Steam exposure will weaken PVA glue bond over time."
```

---

## PART 4: The Complete Rule Set — Your Parametric Engine Enforcement Table

text

```
╔══════════════════════════════════════════════════════════════════╗
║           CABINET PARAMETRIC LOGIC ENGINE — RULE TABLE           ║
╠══════════╦══════════════════════════════╦════════════════════════╣
║ RULE ID  ║ TRIGGER CONDITION            ║ ACTION                 ║
╠══════════╬══════════════════════════════╬════════════════════════╣
║ SH-01    ║ 16mm, span > 580mm, heavy    ║ BLOCK + suggest divider║
║ SH-02    ║ 18mm, span > 750mm, heavy    ║ BLOCK + suggest divider║
║ SH-03    ║ 18mm, span > 1000mm, light   ║ BLOCK always           ║
║ SH-04    ║ Any shelf, cantilever        ║ Limit to 400mm max     ║
║ SH-05    ║ Dado joint, slot < 50% h     ║ Remove deflection bonus║
╠══════════╬══════════════════════════════╬════════════════════════╣
║ JT-01    ║ Glued dowel selected         ║ Disable flat-pack mode ║
║ JT-02    ║ Minifix selected             ║ Enforce back panel rule║
║ JT-03    ║ Any joint, edge dist < 50mm  ║ BLOCK — split risk     ║
║ JT-04    ║ Base cab, Confirmat count<3  ║ WARN — add fastener    ║
║ JT-05    ║ Dado, no glue                ║ BLOCK — structurally   ║
║          ║                              ║ unacceptable alone     ║
╠══════════╬══════════════════════════════╬════════════════════════╣
║ MT-01    ║ Kitchen/bath + std LDSP      ║ WARN — use MR grade    ║
║ MT-02    ║ δ_calculated > 3.0mm         ║ FAIL — hard block      ║
║ MT-03    ║ δ × 2.0 (creep) > 3.0mm     ║ WARN — long-term risk  ║
║ MT-04    ║ Back panel omitted           ║ BLOCK — racking danger ║
╚══════════╩══════════════════════════════╩════════════════════════╝
```

---

## Summary for Your Dev Team

The three structural laws your engine must encode are:

1. **Span is cubic, not linear.** Double the span and you get 16× the deflection (L⁴ relationship). This is why the jump from 600mm to 900mm is catastrophic for chipboard. Your UI must calculate this in real-time.
    
2. **The joint type sets the delivery contract.** Glued dowels = assembled only. Minifix/Confirmat = flat-pack viable. The software must lock the shipping mode to the joint selection.
    
3. **The back panel is structural, not decorative.** Omitting or thinning it in a cam-lock cabinet removes the primary racking resistance. It must be enforced as a non-optional element in any flat-pack carcass.



# The Mathematics of the Sheet: A Deep Technical Breakdown

## Part 1: From 3D Model to 2D Cutting Map — The Translation Engine

### The Decomposition Pipeline

A cabinet is a 3D object. A CNC router cuts flat sheets. The bridge between them is a **part decomposition engine** — the most critical, unglamorous piece of software your app needs.

text

```
3D Cabinet Model
       │
       ▼
┌─────────────────────────────────────┐
│  PART EXTRACTION LAYER              │
│  • Identify each unique panel       │
│  • Record: L × W × T (thickness)   │
│  • Tag: material, grain, quantity   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  PART NORMALIZATION LAYER           │
│  • Strip 3D geometry                │
│  • Convert to 2D rectangles         │
│  • Group by: material + thickness   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  NESTING ENGINE                     │
│  • Apply kerf offsets               │
│  • Apply grain constraints          │
│  • Pack parts into sheets           │
│  • Minimize sheet count             │
└─────────────────────────────────────┘
       │
       ▼
   2D Cutting Maps (one per sheet)
```

### Real Cabinet → Real Parts Example

A standard 600mm base cabinet decomposes into approximately:

|Part|Qty|Raw Dimension (L×W)|Grain Direction|
|---|---|---|---|
|Side Panel|2|720 × 560mm|Vertical (↕)|
|Bottom Panel|1|568 × 560mm|Horizontal (↔)|
|Top Rail|2|568 × 96mm|Horizontal (↔)|
|Back Panel|1|720 × 568mm|Vertical (↕)|
|Shelf|1|562 × 554mm|Horizontal (↔)|
|Door|1|716 × 396mm|Vertical (↕)|

> **The key insight:** A 3D model stores relationships. Your engine must convert relationships into **absolute dimensions** before nesting can begin.

---

## Part 2: Kerf — The Invisible Tax on Every Cut

### What Kerf Actually Is

Kerf is the width of material **destroyed** by the cutting tool. On a CNC router with a standard 3.175mm (⅛") spiral upcut bit, the kerf is the diameter of that bit.

text

```
BEFORE CUT:          AFTER CUT:
┌────────────────┐   ┌──────────┐  ┌──────────┐
│                │   │          │  │          │
│   One piece    │   │  Part A  │  │  Part B  │
│                │   │          │  │          │
└────────────────┘   └──────────┘  └──────────┘
 ←── 600mm ────→      ←295mm→  ←3mm→  ←302mm→
                                ↑
                           GONE FOREVER
                           (kerf = ~3mm)
```

### The Compound Kerf Problem

This is where most manual planners fail. Kerf compounds across **every cut**, not just between parts:

text

```
Sheet Width: 2800mm
Kerf: 3.2mm

If you nest 9 parts horizontally:
  9 parts × avg 300mm    = 2700mm of parts
  8 internal kerfs × 3.2 = 25.6mm
  2 edge margins × 10mm  = 20mm
  ─────────────────────────────────────
  Total consumed:          2745.6mm ✓ (fits)

If you nest 10 parts:
  10 parts × avg 300mm   = 3000mm  ✗ (already over!)
```

### Kerf in Your Database

Every material profile must store:

JavaScript

```
material: {
  id: "egger_18mm_white",
  sheet_length: 2800,
  sheet_width: 2070,
  kerf: 3.2,          // mm — CRITICAL field
  edge_margin: 10,    // safe distance from sheet edge
  grain_sensitive: true,
  cost_per_sheet: 40.00
}
```

---

## Part 3: Grain Direction — The Constraint That Kills Efficiency

### Why Grain Exists

Melamine-faced boards (like Egger) have a **directional wood grain pattern** in the facing. Rotating a panel 90° makes the grain run the wrong way — instantly visible and professionally unacceptable.

text

```
CORRECT:                    WRONG:
Cabinet door                Cabinet door
(grain vertical)            (grain horizontal)

│ │ │ │ │ │                 ─ ─ ─ ─ ─ ─
│ │ │ │ │ │                 ─ ─ ─ ─ ─ ─
│ │ │ │ │ │                 ─ ─ ─ ─ ─ ─
│ │ │ │ │ │                 ─ ─ ─ ─ ─ ─
│ │ │ │ │ │       ✓         ─ ─ ─ ─ ─ ─       ✗
```

### The Three Grain Rules

|Rule|Meaning|Impact on Nesting|
|---|---|---|
|**Grain-Matched**|Grain must run in one specific direction|0° rotation only — hardest to nest|
|**Grain-Free**|No grain (e.g., solid colour, MDF)|0° OR 90° rotation allowed — best nesting|
|**Grain-Paired**|Grain must match an adjacent panel|Parts must be cut from same sheet region|

### How Grain Direction Kills Your Sheet Utilization

This is the most important concept for your "Save a Board" feature:

text

```
Sheet: 2800mm (length) × 2070mm (width)
Grain runs along the LENGTH (2800mm direction)

Part A: 800mm × 600mm (grain = vertical = along 800mm)
  → Can only be placed with 800mm parallel to sheet length
  → Part occupies: 800mm of length × 600mm of width

Part A rotated 90°: 600mm × 800mm
  → Grain would be horizontal = REJECTED

// For a grain-free part:
Part B: 800mm × 600mm (grain-free)
  → Can be placed either way
  → Nesting engine CHOOSES whichever orientation wastes less space
```

---

## Part 4: The Nesting Algorithm — How Parts Pack Into Sheets

### The Core Algorithm (Simplified First-Fit Decreasing)

text

```
STEP 1: SORT
  Sort all parts by area, largest → smallest
  (Big parts are hardest to place; commit them first)

STEP 2: INITIALIZE
  Open Sheet #1 (empty 2800 × 2070mm)

STEP 3: PLACE (for each part)
  FOR each unplaced part:
    FOR each open sheet:
      Try position: next available slot
      Check: Does it fit within sheet bounds? (with kerf)
      Check: Does grain direction permit this orientation?
      IF fits → place it, record X/Y coordinates
      IF doesn't fit → try 90° rotation (grain-free only)
      IF still doesn't fit → try next sheet
      IF no sheets work → open new sheet

STEP 4: OUTPUT
  Sheet count, utilization %, cutting coordinates per part
```

### The "Skyline" Packing Method (What Good Software Actually Uses)

text

```
Sheet view (side profile of used space):

  2070mm width
  ├──────────────────────────────────────────┤
  │ ████████████████  │  ██████████████████  │ ← Row 1 (height = tallest part in row)
  │ ████████████████  │  ██████████████████  │
  ├──────────────────────────────────────────┤ ← "Skyline" (current fill level)
  │ ████████████  │  ██████  │               │ ← Row 2
  │ ████████████  │  ██████  │               │
  ├──────────────────────────────────────────┤
  │                                          │ ← EMPTY SPACE (target for next parts)
  │                                          │
  └──────────────────────────────────────────┘

The algorithm tracks the "skyline" — the irregular top edge of placed parts
and tries to fill valleys before creating new rows.
```

---

## Part 5: The "Save a Board" UX Logic — The Killer Feature in Detail

### The Core Mathematical Insight

The feature works by running the nesting algorithm **in reverse** — instead of asking "how many sheets do I need?", it asks:

> _"How much space is wasted on the last sheet, and what dimensional changes would reclaim it?"_

### The Full Logic Flow

text

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: BASELINE NESTING RUN                                  │
│                                                                 │
│  Run standard nesting on all parts                              │
│  → Result: 3 sheets used                                        │
│  → Sheet 3 utilization: 34% (66% WASTED)                       │
│  → Wasted area: 3,809,880 mm² = ~3.8 sheet-equivalents         │
│                                                                 │
│  KEY METRIC: "Overflow Volume" =                                │
│  total part area that forced a new sheet to open                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: OVERFLOW PART IDENTIFICATION                          │
│                                                                 │
│  Identify the FIRST part placed on Sheet 3                      │
│  → This is the "trigger part" — the part that caused            │
│    Sheet 3 to open                                              │
│                                                                 │
│  Also identify the LAST parts placed on Sheet 2                 │
│  → These left insufficient space for the trigger part           │
│                                                                 │
│  Measure: "Deficit" = how much space was missing                │
│  e.g., Trigger part = 600×400mm                                 │
│        Available gap on Sheet 2 = 550×400mm                     │
│        Deficit = 50mm in LENGTH dimension                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: SENSITIVITY ANALYSIS                                  │
│                                                                 │
│  For the trigger part, run parametric tests:                    │
│                                                                 │
│  LOOP: reduce trigger part length by 1mm increments            │
│    → Re-run nesting (fast approximation, not full solve)        │
│    → Check: does Sheet 3 become unnecessary?                    │
│    → Record minimum reduction needed                            │
│                                                                 │
│  Result: "If [Part Name] is reduced by 52mm,                    │
│           all parts fit on 2 sheets"                            │
│                                                                 │
│  Then: Trace 52mm back to 3D model                              │
│  → Which cabinet dimension does this reduction map to?          │
│  → e.g., Cabinet width: 600mm → 548mm                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: HUMAN-READABLE ALERT GENERATION                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💡 SAVE A SHEET — Save $40.00                         │   │
│  │                                                         │   │
│  │  Currently using 3 sheets. Sheet 3 is only 34% used.   │   │
│  │                                                         │   │
│  │  If you reduce Cabinet B width by 52mm                  │   │
│  │  (600mm → 548mm), all parts fit on 2 sheets.           │   │
│  │                                                         │   │
│  │  ✓ No structural impact detected                        │   │
│  │  ✓ Still within standard carcase tolerances             │   │
│  │  ✓ Run fits: 96.2% utilization on 2 sheets             │   │
│  │                                                         │   │
│  │  [Apply Change]  [See Nesting Preview]  [Dismiss]       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### The Reverse Mapping Problem (Hardest Engineering Challenge)

This is where 90% of teams give up. You must trace from **cut part → cabinet panel → cabinet dimension → user-facing label**:

text

```
Nesting Engine says:
  "Part ID: cab_B_left_side needs to shrink by 52mm"
                    │
                    ▼
Part Registry says:
  "cab_B_left_side width = cabinet_B.interior_width + (2 × panel_thickness)"
                    │
                    ▼
Constraint Solver says:
  "cabinet_B.interior_width must decrease by 52mm"
  "This means cabinet_B.overall_width = 600 → 548mm"
                    │
                    ▼
UI Layer says:
  "Cabinet B overall width: reduce by 52mm"
```

---

## Part 6: The Full Calculation Architecture

### Sheet Utilization Formula

text

```
                    Sum of all part areas (incl. kerf allowance)
Utilization % =  ──────────────────────────────────────────────── × 100
                    Number of sheets used × Sheet area

Where:
  Part area with kerf = (part_L + kerf) × (part_W + kerf)
  Sheet area = 2800 × 2070 = 5,796,000 mm²
```

### The "Tweak Efficiency Score"

To prioritize _which_ tweak to suggest first, score each candidate:

text

```
                   Money saved (sheets eliminated × cost/sheet)
Tweak Score =  ──────────────────────────────────────────────────
                   Dimensional change (mm) × design impact factor

Design impact factor:
  Width change = 1.0   (most acceptable)
  Height change = 1.2  (affects standard heights, penalized)
  Depth change = 1.5   (affects countertop overhang, most penalized)

→ Suggest the tweak with the HIGHEST score first
```

---

## Summary: What Makes This Feature Actually Work

|Component|What It Does|Why It's Hard|
|---|---|---|
|**Part Decomposer**|3D model → flat part list|Needs parametric awareness|
|**Kerf Engine**|Applies tool diameter to every gap|Compounds in non-obvious ways|
|**Grain Constraint Map**|Restricts part rotation|Reduces nesting freedom significantly|
|**Nesting Solver**|Packs parts into minimum sheets|NP-hard problem — needs heuristics|
|**Overflow Detector**|Finds the "trigger part" for last sheet|Requires part-level sheet tracking|
|**Sensitivity Analyser**|Finds minimum tweak to eliminate sheet|Requires fast re-nesting loop|
|**Reverse Mapper**|Links cut part → cabinet dimension|Requires parametric model structure|
|**Alert Generator**|Human-readable, actionable notification|Requires UX polish|

The magic isn't in any single component — it's in the **chain**. A cabinet maker doesn't care about nesting algorithms. They care that your app just saved them **$40 and 20 minutes** with one tap.



---



## Executive summary (what your “Save a Board” mechanic must do)

To reliably tell a cabinetmaker “make this cabinet **30 mm narrower** and you’ll save **one whole 2800×2070 sheet**,” your software has to:

1. **Flatten the 3D cabinet model into a manufacturing cut list** (rectangles/polygons) with _real_ shop allowances (edge trim, part spacing, tool kerf/bit diameter, labels, clamp zones).
2. **Nest those 2D parts onto sheets** under constraints (especially **grain direction**, which forbids arbitrary rotation).
3. Detect when the current job is **just barely spilling onto an extra sheet**.
4. Run a fast **“what-if” sensitivity search** on _editable 3D parameters_ (cabinet width/height/depth, toe-kick height, stretcher width, etc.) to find the **minimum tweak** that makes the nest feasible on one fewer sheet.
5. Convert that tweak into a **clear UX action**: show _what changes_, _which parts shrink_, _why it saves a sheet_, and _how much money/time_ that saves.

Below is the mechanics + a concrete UX logic flow that’s implementable.

---

## 1) From 3D cabinet → 2D parts: what “flattening” actually means

### 1.1 The 3D model is not the manufacturing truth; the part graph is

A cabinet in 3D typically contains:

- Panels (left/right gables, top/bottom, shelves, back, stretcher/rails, doors, drawer parts)
- Joinery features (dados, rabbets, dowels/confirmat holes)
- Finishing intent (visible grain direction, door swing, mirrored gables)
- Material assignments (Egger MFC/MDF/etc., thickness, décor direction)

To manufacture, you must convert that into a **part graph** where each part has:

- **Geometry**: 2D outline (usually a rectangle; sometimes notched for toe-kicks, service voids, etc.)
- **Thickness** (drives tool choice and sometimes kerf/feeds)
- **Quantity**
- **Material / décor**
- **Edge banding map** (which edges get banded)
- **Grain direction constraint** (more on this below)
- **Process plan**: drill → pockets/dados → profile cut, etc.

> Why this matters for nesting: nesting optimizes _2D outlines_ on a sheet, not the 3D assembly. True-shape nesting uses the actual outline (including notches/holes) rather than a bounding box, which can improve utilization when parts aren’t purely rectangular. [1](https://lapas.io/glossary/true-shape-nesting/)

### 1.2 Shop allowances you must apply before nesting (or your math lies)

Even in cabinet shops, “part size” usually needs adjustments before nesting:

**A) Sheet trim / edge cleanup (sheet-level)** Many shops trim a few mm off factory edges for squareness/chipout, or to remove damage. Model this as:

- `sheet_margin_left/right/top/bottom` (e.g., 5–15 mm each)

**B) Part-to-part spacing (nest-level)** You need clearance so:

- saw/router kerf doesn’t collide,
- tabs/bridges can exist (CNC),
- vacuum hold-down remains stable,
- labels can be applied.

This is usually a single parameter: `part_spacing_mm`.

**C) Process-specific offsets**

- **Beam saw / panel saw**: kerf is literal blade kerf.
- **CNC router**: “kerf” behaves like **tool diameter** + required clearance, because the toolpath is offset by the tool radius and you must avoid overlapping toolpaths.

Autodesk’s fabrication docs describe kerf as the _allowance required to compensate for tool width_ and note that CAM often offsets the toolpath by **½ kerf** (tool radius logic) to hit final dimensions. [2](https://help.autodesk.com/cloudhelp/ENU/Fabrication-UsersGuide/files/GUID-CE86DE56-0431-48C2-811F-3BD40A3EAFD6.htm)

---

## 2) The sheet model: 2800×2070 mm and what’s actually usable

Egger décor boards commonly appear in **2800 × 2070 mm** formats in various product/brochure listings (and many suppliers sell/cut-to-size in that nominal size). [3](https://www.egger.com/get_download/2af31a26-55b3-45c6-9a0e-27d963dcabdd/Product_Decors_and_Services_Brochure.pdf)

In nesting, you never use the full rectangle. Define:

- `SheetW = 2070`
- `SheetL = 2800`
- `usableW = SheetW - marginLeft - marginRight`
- `usableL = SheetL - marginTop - marginBottom`

Example: margins 10 mm each side  
→ `usableW = 2070 - 20 = 2050`, `usableL = 2800 - 20 = 2780`

This _usable_ rectangle is what your nesting algorithm packs into.

---

## 3) Kerf (blade thickness) and why it changes both accuracy _and_ yield

### 3.1 Kerf definition (practical)

**Kerf** is the width of material removed by the cutting tool—the slot left behind—and it must be accounted for in measurement and layout. [4](https://en.wikipedia.org/wiki/Saw)

### 3.2 Two different “kerf” concepts you must separate in the UI

**(1) Dimensional kerf compensation** (accuracy)

- CAM/controller offsets the cut line so the _finished part_ is correct.
- Example logic: to cut an outside profile, toolpath is offset outward by tool radius; for an inside hole, offset inward. [2](https://help.autodesk.com/cloudhelp/ENU/Fabrication-UsersGuide/files/GUID-CE86DE56-0431-48C2-811F-3BD40A3EAFD6.htm)

**(2) Nest spacing** (feasibility) Even if the machine compensates dimensions perfectly, if you nest parts “touching,” the toolpaths overlap. So you enforce:

- `part_spacing >= tool_diameter (router)` _or_ `part_spacing >= kerf (saw)` plus a safety buffer

In many nesting systems and optimizers, this is treated as “minimum spacing between parts” after nesting. [5](https://support.thinksai.com/hc/en-us/articles/8694482873748-True-Shape-Nesting)

**Implementation tip:** model **one parameter** in the nesting engine:

- `gap = part_spacing_mm` …and keep **kerf/tool compensation** in CAM post-processing. That keeps mental models clean.

---

## 4) Grain direction: the rotation handcuff that makes nesting hard (and realistic)

### 4.1 What grain direction constraint means in nesting

For a directional décor (woodgrain melamine, veneer, etc.), parts often must be oriented so the “grain” runs consistently (e.g., vertical on gables and doors). That usually means a part can only be placed at:

- **0° / 180°** (same grain direction, flipped end-to-end), not 90°.

Commercial nesting systems explicitly support this by restricting allowed orientations for “grain parts.” For example, PEP describes “Standard Grain” as limiting nesting orientations to **0 and 180 degrees**. [6](https://www.peptechnology.com/resource/grain-faq-mastering-grain-control-for-optimal-nesting/)  
Vectric’s VCarve manual also calls out that keeping shapes oriented can matter “in regard to the material grain.” [7](https://manualzz.com/doc/47252491/vectric-v9.0-vcarve-pro-user-manual)

### 4.2 UX implication: grain isn’t binary; it’s a per-part rule

You want per material + per part:

- **Non-directional** décor: allow 0/90/180/270
- **Directional** décor: allow 0/180 only
- **Hard-locked** parts (e.g., pre-drilled mirrored gables): allow 0 only (some systems call this “hard grain”) [6](https://www.peptechnology.com/resource/grain-faq-mastering-grain-control-for-optimal-nesting/)

Also: many cabinets have _mixed_ requirements:

- Visible ends/doors: strict grain
- Shelves/hidden stretchers: can often rotate freely (higher yield)

Your “Save a Board” feature gets dramatically stronger if it can say:

> “Keep grain on visibles, but rotate hidden stretchers 90° and you drop a sheet.”

---

## 5) Nesting mechanics: translating parts into a 2D cutting map

### 5.1 What the nesting problem really is (so you design around it)

For rectangular cabinet parts, this is essentially a constrained **2D bin packing / cutting stock** problem:

- bins = sheets (2800×2070 usable area)
- items = rectangles/polygons (parts)
- constraints = grain rotation limits, minimum gap, sometimes guillotine cutting rules

These packing problems are famously hard in the general case, so production systems rely on **heuristics** (fast “good enough” solutions) + multiple seeds/strategies rather than “perfect” optimality. (Even guillotine variants are studied separately in research and industry because cut sequencing matters.) [8](https://arxiv.org/abs/2105.02827)

### 5.2 Two common layout paradigms you should support

**A) CNC router nesting (true-shape / irregular nesting)**

- Can place parts anywhere, not necessarily edge-to-edge cuts.
- True-shape nesting uses the actual outline and can interlock shapes better than rectangle-only methods. [1](https://lapas.io/glossary/true-shape-nesting/)

**B) Panel saw optimization (guillotine / staged cuts)**

- Cuts are often constrained to “edge-to-edge” straight cuts.
- Guillotine patterns are a known category and show up in industrial optimizers. [9](https://en.wikipedia.org/wiki/Guillotine_cutting)

**Practical product takeaway:** your app can have _one_ part extraction pipeline, but **two nesting modes** (CNC vs saw). The “Save a Board” mechanic should work in both, but will suggest different tweaks because the feasible packings differ.

---

## 6) The “Mathematics of the Sheet”: how to compute “30 mm narrower saves a sheet”

There are two levels:

### Level 1 (fast intuition): row/column thresholds

A huge share of “save a board” wins happen when a part crosses a _packing threshold_ like “3 across instead of 2 across.”

Let:

- `usableW` be usable sheet width (after margins)
- `gap` be minimum spacing between parts
- `w` be the part dimension you’re packing across width

Max parts across width (for simple grid packing) is approximately:

n=⌊usableW+gapw+gap⌋n=⌊w+gapusableW+gap​⌋

(That formula captures that between n parts you have n−1 gaps; algebraic rearrangements vary, but this is a common, practical estimate.)

**Threshold width for 3-across:**

w≤usableW+gap3−gapw≤3usableW+gap​−gap

**Concrete example (matches your “30 mm” story):**

- Egger sheet width `SheetW = 2070`
- margins left/right = 10 mm → `usableW = 2050`
- gap = 4 mm (kerf/clearance combined)

Then 3-across requires:

w≤2050+43−4=680.7 mmw≤32050+4​−4=680.7 mm

So if a cabinet width parameter makes several parts **700 mm wide**, they will pack **2 across** (wasteful). If you reduce those parts to **680 mm**, they pack **3 across**, and that can easily remove the need for a whole extra sheet when quantities are high.

This is the _math you surface in UX_ because it’s explainable and builds trust.

### Level 2 (the real answer): re-nest feasibility, not area %

Area utilization alone lies because geometry + grain constraints matter. The only reliable statement “one fewer sheet” comes from:

> “All parts can be placed on N−1 sheets under constraints.”

So your engine must attempt a nest into `N-1` sheets (or prove it can’t).

---

## 7) Designing the “Material Utilization Optimization” + “Save a Board” UX logic flow

### 7.1 Core UX objects (what the user sees)

**Material Utilization Panel** (always visible when modeling)

- Sheets needed: `N`
- Total material cost: `N × sheet_cost`
- Utilization: overall %, plus **per-sheet utilization**
- Last sheet “spill” indicator: e.g., “Sheet 3 is only 18% used”

**Optimization button (two-stage)**

- “Quick Optimize” (fast heuristic, instant feedback)
- “Pro Optimize” (slower, multi-seed, tries harder)

**Save-a-Board Alert Card** (only appears when conditions met)

- Headline: “Save 1 sheet by reducing Cabinet Width by 30 mm”
- Confidence: High/Medium/Low (based on solver robustness)
- Explains _which parts change_ (top/bottom/shelves/back/doors)
- Shows _why it works_ (e.g., “backs become 680 mm → 3-across”)
- One-click actions:
    - “Apply change”
    - “Try alternatives” (e.g., toe-kick height, stretcher width, back split)
    - “Lock grain on visibles only” (if that’s the lever)

### 7.2 When to trigger the “Save a Board” search (don’t do it on every keystroke)

Trigger conditions (fast checks):

1. User ran an optimize, and got `N` sheets.
2. The last sheet utilization is below a threshold (e.g., `< 35%`) **OR** the last sheet contains only a small family of parts (often the “overflow” family).
3. There exists at least one **tweakable parameter** connected to those overflow parts.

Then launch a background job: `find_sheet_saving_tweak()`.

### 7.3 The actual algorithm: “find the minimum tweak that makes N−1 sheets feasible”

You need a parameter-aware search, not a generic “optimize more.”

**Step A — Build dependency mapping (3D param → parts)** Example:

- `cabinet_width` affects:
    - top/bottom: `(W - 2*t) × D`
    - shelves: `(W - 2*t - clearance) × D`
    - back: `W × H` (or within grooves)
    - doors: depends on overlay/inset rules

This mapping is what makes your feature feel “magic,” because the software knows what the user can change.

**Step B — Identify the overflow set** From the `N`-sheet nest, extract:

- parts on last sheet (and/or parts that are “hard to place” across all sheets)
- group by “driven-by parameter” (e.g., width-driven)

**Step C — Attempt to pack into N−1 sheets with a controlled tweak** For each candidate parameter `p` (ranked by likelihood + user permissibility):

1. Define search direction(s): typically “reduce width” is the money saver.
2. Use a bounded search:
    - coarse scan: −5 mm, −10, −15… until success or until limit
    - then binary search around the best interval for minimum delta
3. For each delta:
    - regenerate only affected part sizes
    - run a _fast but consistent_ nesting attempt into `N−1` sheets with the same constraints (grain, gap, margins)
    - if success → record candidate `(p, delta, explanation)` and stop early if it’s “small enough”

Pseudo:

text

```
N = nest(parts, constraints).sheet_count
if N <= 1: return none

target = N - 1

overflow = parts_on_sheet(N)   // from current solution

candidates = rank_parameters_by_influence(overflow)

best = none
for p in candidates:
  deltas = [-5, -10, -15, ... -max_allowed(p)]
  for d in deltas:
     parts2 = apply_param_delta(parts, p, d)
     if quick_nest(parts2, constraints, max_sheets=target).success:
         d_min = binary_search_min_delta(p, d)
         best = pick_better(best, (p, d_min))
         break
return best
```

**Important:** “max_sheets=target” turns the nesting solver into a feasibility checker. It stops as soon as it finds _any_ packing that fits in N−1 sheets.

### 7.4 How to generate the human explanation (so the alert is trusted)

When you find a winning tweak, generate:

- “Changed parameter”: `Cabinet Width 700 → 670 (−30)`
- “Affected parts (count + new sizes)”
- “Packing reason”:
    - **threshold explanation** when applicable:
        - “Back panels now fit 3 across sheet width (680 mm threshold with 10 mm margins + 4 mm spacing).”
    - otherwise, show a small “before/after” mini-nest preview (two thumbnails)

This is where you explicitly connect to grain restrictions:

- “Grain locked: parts only allowed 0°/180° (no 90° rotation).” [6](https://www.peptechnology.com/resource/grain-faq-mastering-grain-control-for-optimal-nesting/)

---

## 8) Production-grade gotchas (the stuff that breaks “save a sheet” in the real world)

### 8.1 Grain on visibles vs non-visibles

If the user marks everything “grain critical,” you may miss savings. Support a rule set like:

- Doors + exposed ends: grain locked
- Shelves, stretchers, nailers: grain optional

(And show the tradeoff explicitly: better yield vs aesthetic consistency.)

### 8.2 Saw vs CNC differences (your solver must match the shop’s process)

- Panel saw optimization may require guillotine/staged cut patterns. [10](https://learn.otimizenesting.com/articles/stage-guillotine-cut.html)
- CNC nesting can place arbitrary shapes and benefit from true-shape nesting. [1](https://lapas.io/glossary/true-shape-nesting/)

If your “Save a Board” suggestion is computed in CNC mode but the shop cuts on a beam saw, you’ll create false promises. So the UX must clearly show the active mode: “Optimizing for: CNC Nesting” vs “Beam Saw (Guillotine)”.

### 8.3 Kerf vs spacing confusion

Users often think kerf is “just blade thickness,” but practically kerf is the _cut width_ and can vary with set/wobble/tool behavior. [4](https://en.wikipedia.org/wiki/Saw)  
So: store kerf as a **measured shop setting** per machine/material, and treat nesting gap as “kerf + safety.”

---

## 9) The killer UX moment: how the alert should feel

When the user changes cabinet width, your UI should do this in under ~1–2 seconds (quick estimate), then refine (proof).

**Real-time microcopy idea (what earns loyalty):**

- Status bar: “Currently: **3 sheets** (last sheet 22% used)”
- After background search:  
    **“Save 1 sheet:** reduce _Cabinet Width_ by **30 mm** (700 → 670). Saves **$40** Egger MFC + ~X min machine time.”

Then provide:

- “Preview before/after nests”
- “Apply change” (one click)
- “Keep cabinet size; try other tweaks” (toe-kick, split back, rotate non-visible parts)

This makes the app feel like a senior operator standing next to them—exactly the “never use another tool” effect you’re aiming for.

---

### Practical value-add: one metric that makes this feature even stronger

Add a computed **“Sheet Threshold Dashboard”** for the top 3 driving dimensions:

- “Back panel width threshold for 3-across: **≤ 680.7 mm**”
- “Shelf depth threshold for 4-along-length: **≤ …**”
- “Door height threshold for …”

This turns nesting from “black box” into learnable shop math—and helps users design _toward_ efficiency rather than discovering it at the end.

If you want, I can also provide:

- a recommended **data model** (Part, Sheet, Material, GrainRule, MachineProfile),
- a **nesting heuristic stack** suitable for rectangles-with-constraints (fast skyline + best-fit + multi-seed),
- and the exact UI event/state machine for “Quick Optimize → Verified Optimize → Save-a-Board Suggestion → Apply/Undo.”


----


## The 12-Slot Tetris — Standards, Constraints, and the Slot Game Design

Before diving in, one important clarification: your prompt conflates two different European standards that are often discussed together but operate on different layers. Getting this distinction right is what separates a working Tetris UI from one that produces unmanufacturable parts.

||**System 32**|**The width grid (50/100/150mm)**|
|---|---|---|
|What it standardizes|Where holes get drilled in cabinet sides for hinges, drawer slides, shelf pins|The width of the cabinet itself|
|Layer in your stack|Backend — your `Part.operations[]` array|Frontend — the Tetris slot UI|
|What enforces it|The Machining Engine module|The drag-and-drop snap grid|
|Origin|German hardware makers (Hettich), 1960s–70s|Evolved from appliance and ergonomic standards|

System 32 is about hardware. The 50mm grid is about cabinet sizing. Both matter, but they don't drive each other directly. The 32 mm cabinetmaking system (colloquially called system 32) is a set of principles that has evolved for the production of ready-to-assemble and European-style, frameless construction custom cabinets and other furniture ... Characteristic are the columns of 5-millimetre (0.20 in) holes with centres at 32-millimetre (1.3 in) intervals. [Wikipedia](https://en.wikipedia.org/wiki/32_mm_cabinetmaking_system)

The user-facing grid in your Tetris UI is the **width grid**, not System 32. Let me cover both, then map to your UI.

---

### 1. The Width Grid — Why 50/100mm, not 150mm specifically

Your prompt assumes "multiples of 150mm." This is partly right but mostly wrong, and the nuance matters for your UI design.

The actual European standard rhythm is **multiples of 50mm, with most cabinets falling on 100mm steps, with 150mm-multiples (300/450/600/900) being the highest-density "core" subset.** Specifically:

|Cabinet width|Common?|Multiple of 50?|Multiple of 100?|Multiple of 150?|
|---|---|---|---|---|
|150mm|Niche (filler, spice rack)|✓|—|✓|
|300mm|**Common**|✓|✓|✓|
|400mm|**Common**|✓|✓|—|
|450mm|**Common**|✓|—|✓|
|500mm|Common|✓|✓|—|
|600mm|**Most common**|✓|✓|✓|
|800mm|**Common**|✓|✓|—|
|900mm|**Common (sink)**|✓|✓|✓|
|1000mm|Common|✓|✓|—|
|1200mm|Less common|✓|✓|—|

The published lists confirm this: Height = 720mm Depth = 560-600mm Widths = 150, 300, 350, 400, 450, 500, 600, 800, 900, 1000, 1200mm Plinth height = 150mm. UK guidance is even broader: Width options: 150mm, 300mm, 400mm, 450mm, 500mm, 600mm, 800mm, 900mm, 1000mm, 1200mm. [Kitchen Insider](https://kitchinsider.com/standard-kitchen-cabinet-dimensions/)[Top Tradespeople](https://www.toptradespeople.co.uk/advice/kitchen-unit-sizes-guide)

**Why the 50mm grid?** Three converging forces:

1. **Appliance widths.** Built-in dishwashers, ovens, and cooktops are made in **600mm and 450mm** widths. Every other cabinet has to align with these so the worktop sits flush. This is the deepest driver. As one source explains: Appliances dictate certain fixed cabinet sizes since built-in ovens, dishwashers, fridges require exact cutouts ensuring proper ventilation & function. [Kitchling!](https://kitchling.com/what-are-the-standard-sizes-of-kitchen-units/)
2. **Sheet yield.** A standard 2750×1830 ЛДСП sheet divides cleanly with these widths. A 300mm cabinet + a 600mm cabinet from one strip wastes nothing.
3. **The "useful door" constraint.** Cabinet doors below ~250mm wide are uncomfortable to use (your fingers don't fit the door pull). Doors above ~600mm sag, twist, and need two hinges minimum. So the practical comfortable door range is ~300–600mm, which forces the most common cabinet widths into that range.

**Your UI implication:** The Tetris snap grid should be **50mm**, not 150mm. But the **default options shown to the user when adding a new cabinet** should be a curated list: 300 / 400 / 450 / 500 / 600 / 800 / 900. Power users can long-press and type custom widths in 50mm increments. This is exactly the Linear "atomic opinion" pattern — opinionated defaults, escape hatch for the 5% case.

---

### 2. Cabinet Height — Why 720mm Carcass + 100/150mm Plinth

The 720mm + plinth math is anthropometric and is one of the few numbers in furniture that has held for ~70 years across all of Europe (and CIS).

The total worktop height equation:

```
720mm  (cabinet carcass)
+ 100–150mm  (plinth / цоколь / toe kick)
+ 28–40mm  (countertop / столешница)
= 848–910mm  (final working surface)
```

The target is **~900mm** because that's where the average European/CIS adult's elbow falls relative to a useful working surface: The standard worktop height is around 900mm (including cabinets and worktop), but it can vary between 870mm to 1000mm depending on your needs. And: the standard kitchen worktop height is generally set at around 900mm (90cm) or 36 inches from the floor, a measurement that has become the norm in most countries worldwide. This height is designed to accommodate the average person, typically someone who stands between 5'5" to 5'10" tall. [Imperial Worktops](https://imperialworktops.co.uk/kitchen-worktops-height-depth-layout-guide/)[Hanexsolidsurface](https://hanexsolidsurface.co.uk/kitchen-worktop-height-everything-you-need-to-know/)

The ergonomic rule is precise: the most popular way is to have your worktops height made so that it is level with your wrist. This will ensure you have the most ergonomic worktop height, preventing slouching or straining while you prepare and cook your meals. [Paramount Stone](https://www.paramountstone.co.uk/kitchen-worktop-height/)

**Why split it 720 + plinth + countertop rather than just making one 900mm carcass?**

This is the mechanical reason your prompt is asking for — and it's the genuinely clever part:

|Function|Why it exists|
|---|---|
|**720mm carcass**|This is the height where 4 standard drawer banks (≈170mm each + reveals) fit cleanly, OR a door cabinet with one internal shelf at usable height. Also matches built-in dishwasher height (820mm fits under 900mm worktop with toe-kick clearance) and full-height oven housing math.|
|**Plinth (100–150mm)**|(a) Adjustable feet underneath allow leveling on uneven floors (universal in CIS apartments). (b) The toe-kick recess (~70mm deep) lets the user stand close without their toes hitting the cabinet — adds ~70mm of effective reach. (c) Plumbing/electrical can run behind it.|
|**Countertop (28–40mm)**|Replaceable. If you blow out the countertop with a hot pot, the cabinet underneath is fine. If the plinth held the worktop directly, the whole carcass would be the wear surface.|

Your factory friend will confirm Tashkent uses 100mm plinth predominantly (CIS standard), while UK/EU often uses 150mm. The math still works out to ~900mm worktop height because Russian-tradition countertops are usually 28mm vs. UK 40mm.

**UI implication:** The user never touches the 720mm or the plinth height. These go in `conventions.md` permanently. The user only sees the _result_ — "the worktop will be at 900mm" — and only if they ask. This is the cleanest example in the entire kitchen of a decision that should be invisible.

---

### 3. Cabinet Depth — Why 560mm Carcass and 600mm Worktop

Three converging constraints lock this. None of them are arbitrary:

1. **The dishwasher constraint.** Standard built-in dishwashers and washing machines are 600mm wide × ~580mm deep. Cabinet carcasses need to match this so a dishwasher slots in flush with adjacent cabinet sides. The standard depth of kitchen base units is 560mm; full depth with door is around 600mm. [Better Kitchens](https://www.betterkitchens.co.uk/blog/kitchen-buying-tips-and-advice-4/kitchen-cabinet-dimensions-guide-for-standard-upper-cabinets-75)
2. **The reach constraint.** Обычно она составляет 55­–57 сантиметров, и именно на такой показатель рассчитано большинство кухонных механизмов, облегчающих доступ к содержимому шкафов. Впрочем, такая глубина позволяет человеку среднего роста дотянуться до задней стенки без использования специальных приспособлений: она меньше, чем длина его рук — i.e., 560mm is the maximum depth a person of average height can reach to the back of without leaning over the worktop. [Marya](https://www.marya.ru/kuhni-sovety/razmery-kuhni/)
3. **The countertop overhang.** A 560mm carcass + a ~20–40mm front overhang = 600mm worktop. The overhang protects cabinet doors and drawer faces from water dripping down the front (especially important at the sink), and gives a finger gap for opening doors without pulls.

So the canonical stack is:

- **Cabinet carcass depth:** 560mm
- **Countertop depth:** 600mm (creating a ~40mm front overhang)
- **Upper cabinet depth:** 300mm (so the user can stand at the worktop without hitting their head)

For your UI, the user **never picks depth.** Base = 560mm. Upper = 300mm. Tall = 560mm. Period. The only override is "deep upper" (350–400mm) which is a long-press option for non-cooking zones.

---

### 4. Sink Hard Constraints (the UI must enforce)

A sink is not "a cabinet." It is **a cabinet with a list of physical constraints that, if violated, the kitchen won't work.** Your Tetris drag-and-drop must enforce these. Here are the hard rules from the research:

|Constraint|Rule|Why|
|---|---|---|
|**Minimum cabinet width**|600mm absolute minimum; 800mm normal; 900mm for double-bowl|The bowl + plumbing + mounting clips need this much horizontal space. From the cabinet drawings below you can see that the cabinet size you require for under-mounting is 900mm whereas for top-mounting, you require 800mm [Olif](https://www.olif.co.uk/blogs/how-to/how-to-choose-the-right-sink-to-suit-your-kitchen-cabinet-width)|
|**No drawers**|Sink base cabinets are door-only (or top fake-drawer + door)|Plumbing fills the upper vertical space inside the cabinet|
|**No bottom shelf above floor of cabinet**|Only one floor (the cabinet bottom)|Water access, P-trap clearance|
|**Position relative to wall**|Should be adjacent to plumbing wall, OR within ~2m of one with floor routing|Limits where in the kitchen layout the sink can go|
|**Adjacent cabinet rule**|Should NOT be adjacent to a hob (water + flame separation)|KBA design rule; also burn safety|
|**Window alignment**|Optionally aligns with window|Aesthetic, not enforced|

The dominant sink module width in Russian/CIS tradition is **800mm**, matching a single ~600×500mm top-mount sink with ~100mm margins on each side. Your factory friend will likely confirm this.

**UI implication:** When the user drags a "Sink" tile, it should:

- Auto-snap to 800mm width (default), with 600/900 as long-press alternatives
- Visually disable drawer options for that cabinet
- If dragged adjacent to a Hob tile, show a warning ("Раковина рядом с плитой — не рекомендуется")
- Be limited to one per kitchen by default (override possible)

---

### 5. Hob/Cooktop Hard Constraints

The hob is the most constraint-heavy item in the kitchen. Get this right and you've solved 30% of the manufacturability problem.

|Constraint|Rule|Source|
|---|---|---|
|**Cabinet width**|600mm standard for 4-burner hob; 800mm for 5-burner; 300mm for domino hob|Generally speaking, you have a choice between 30-in. and 36-in. cooktops [Natural Handyman](https://www.naturalhandyman.com/iip/infapplianceinstallation/infgas_cooktop_installation.html) — i.e., 600mm or 900mm equivalents|
|**Cabinet under hob**|Has a cutout in countertop; lower cabinet usually drawer or door, but no top drawer collision|The hob extends ~50–80mm below the worktop|
|**Vertical clearance to upper cabinet**|**Gas: 760mm minimum**; Electric/induction: 650mm minimum; if cooker hood present, follow hood spec|You need to have anything directly above the gas hob at least 760mm off the worktop but wall units inline with the edge of the hob but 460mm above the worktops are OK [DIYnot](https://www.diynot.com/diy/threads/gas-regulations-regarding-hob-to-kitchen-wall-unit-spacing.363534/) and A general guide is 650mm for electric and 750 for gas [Kitchen Insider](https://kitchinsider.com/induction-hob-clearance-regulations/)|
|**Side wall clearance**|Minimum 50mm to combustible side cabinet, or non-combustible side panel required|Fire code; also discoloration over time|
|**Upper above hob must be hood, not cabinet**|If there's anything in that vertical column, it must be a hood (or a non-combustible specialized unit), not a normal cabinet|Household cooking appliances shall have a vertical clearance above the cooking top of not less than 30 inches (760 mm) to combustible material and metal cabinets [MikeHolt](https://forums.mikeholt.com/threads/range-hood-in-cabinet.127969/)|
|**Adjacent to refrigerator**|NOT allowed (heat damages compressor; also opening fridge while cooking is dangerous)|KBA rule|
|**Outlet required**|Even gas hobs need an electrical outlet (for ignition); induction needs heavy 32A line|Electrical|

**UI implication:** When the user drops a "Hob" tile, the slot above it should automatically:

- Either render as "Hood" (default) with no cabinet option, OR
- Show a warning if the user manually places a cabinet there
- The upper cabinets to the left and right of the hood must be reduced in width compared to base (because the hood needs to be at least as wide as the hob, often slightly wider)
- Display a "gas line required" badge if user selected gas, "32A circuit required" if induction

The vertical clearance is a particularly good example of a derived constraint that should auto-compute. The user picks "Gas hob" and the system silently sets the gap between worktop and upper cabinet to 760mm in that one column (vs. 600mm everywhere else). The user never sees the number unless they hit a constraint violation.

---

### 6. Corner Units — The Three Patterns

Corner cabinets are where the Tetris game gets hard. Two perpendicular cabinet runs meet at a 90° angle, and the corner space has to be solved. There are exactly three patterns in use, with very different cost/complexity profiles:

#### Pattern A: Blind Corner (slepoy ugol / слепой угол)

A straight cabinet on one wall extends _past_ the corner; the perpendicular wall cabinet butts into the side of the first. The space behind the second cabinet is the "blind" space.

When you have an L-shape of cabinetry coming together in a corner, the corner where these two perpendicular lines of cabinets meet is a very difficult-to-access space. If you were to use regular cabinets, you would end up with dead space in the corner. We call this space the blind corner or inaccessible space. [Erin Zubot Design](https://erinzubotdesign.com/blind-corner-kitchen-cabinet-ideas/)

- Construction complexity: **Lowest.** Two normal rectangular cabinets. No special parts.
- Manufacturable on every machine tier you support.
- Default option for budget kitchens.
- Usually requires a small **filler strip** (50–100mm) between cabinets to prevent door collision.

#### Pattern B: L-Shaped (or "Pie-Cut" / Square Corner)

A single cabinet that's actually L-shaped, with doors that hinge together. Two doors that open as one unit.

The standard square corner wall cabinet also requires 24" out of each corner and typically has two doors that are hinged together and open as one. Square corner wall cabinets create an almost L-shaped interior allowing for easier visibility than found in the diagonal corner. [Dura Supreme](https://www.durasupreme.com/blog/how-choose-corner-wall-cabinet-style-your-kitchen/)

- Construction complexity: **High.** Requires non-rectangular bottom and back panels (this is your `op: cutout` operation with a polygon, not a `rect` shape).
- Requires bi-fold hinges (specialized hardware).
- Higher value — the customer feels they're getting "more cabinet."

#### Pattern C: Diagonal Corner (срезанный угол)

The cabinet face is cut diagonally across the corner at 45°. Single angled door.

These cabinets cut diagonally across the corner and typically measure 36″ x 36″ along each wall. The angled door provides a wide front opening, offering better reach and visibility without complex internal hardware. [georgecabinetry](https://georgecabinetry.com/blog/choose-the-perfect-kitchen-corner-base-cabinet/)

- Construction complexity: **Medium.** Requires 45° cuts on some panels. This is **outside your V1 LOCKED constraint** — your `06_CONVENTIONS.md` §3 explicitly says `rot_deg ∈ {0, 90, 180, 270}` and explicitly defers arbitrary rotation to V2.
- Common in older CIS kitchens but going out of style.
- Often paired with a Lazy Susan (rotating shelves).

#### Recommendation for Mebelchi V1

Support **only Pattern A (Blind Corner)** in V1. Pattern B requires polygon cutouts (you have the schema for it but it's complex). Pattern C requires 45° cuts which you've already deferred to V2.

This is the single highest-leverage scope cut available to you. By restricting the UI to blind corners only, you eliminate:

- Bi-fold hinge hardware support
- Non-rectangular part shapes
- 45° rotation support
- Lazy Susan hardware support
- Most door-collision math

L-shaped kitchens are still buildable — you just solve the corner with a blind unit + filler, which is what 80%+ of Uzbek workshops already do. The factory friend almost certainly confirms this; ask him "когда L-кухня, как угол делаешь?" and listen for "глухой ящик с заполнителем" (blind cabinet with filler).

---

### 7. Putting It All Together — The 12-Slot Tetris Game Design

Here's how all of the above maps to a mobile-first drag-and-drop UI that a 14-year-old can use:

#### Slot dimensions (the visual grid)

- **One "slot" = 100mm of wall width.** A 600mm cabinet = 6 slots wide. This gives clean visual math and snap-to-100mm-grid by default.
- Long-press a slot edge → drag to snap to 50mm.
- The wall is shown as a 1D strip of slots. A linear 2.4m kitchen = 24 slots. An L-kitchen = two strips joined at a corner block.

#### The cabinet tile palette (the "Tetris pieces")

Six tile types, no more in V1:

|Tile|Default width|Snap-resize options|Notes|
|---|---|---|---|
|Base / drawer|6 slots (600mm)|3, 4, 5, 6, 8, 9, 10|Most common piece|
|Base / door|4 slots (400mm)|3, 4, 5, 6|Single door narrower than drawer|
|Sink base|8 slots (800mm)|6, 8, 9|Door-only; auto-disables drawer option|
|Hob|6 slots (600mm)|6, 8, 9|Hood auto-placed above; clearance enforced|
|Blind corner|9 slots (900mm)|Fixed 9|Always at L-junction; non-resizable in V1|
|Tall / pantry|6 slots (600mm)|6|Goes from floor to upper-cabinet top; blocks the upper row above it|

The upper row is implicit — it auto-mirrors the base row except above the hob (which becomes hood) and above the sink (which becomes a smaller upper or a window placeholder).

#### The schoolboy test, mechanized

The user opens the app and sees:

```
[Tall pantry][Drawer 600][Hob 600][Drawer 600][Sink 800][Drawer 600]
   6 slots    6 slots     6 slots  6 slots    8 slots   6 slots
```

That's a 38-slot (3.8m) linear kitchen. Pre-populated. The user:

1. Drags off the tall pantry (apartment doesn't have room for it).
2. Drags the sink to the end (their plumbing is on that wall).
3. Long-presses the second Drawer 600 and resizes to 800.
4. Hits "Done."

That's it. Five minutes max. Zero settings. Zero numerical input. The DXF generator and the optimizer behind the scenes apply the 720mm height, the 100mm plinth, the 28mm countertop, the 16mm or 18mm material thickness, the 3.2mm kerf, the 760mm hob-to-hood clearance, the 50mm side-wall clearance, the System 32 hole pattern for hinges, and a hundred other things the user never sees.

This is the most important architectural payoff of your `06_CONVENTIONS.md` and `materials.json` discipline. **The conventions file is what makes the Tetris game possible.** Every constraint locked there is a class of mistake that becomes physically impossible in the UI.

---

### 8. One thing to flag before you build

The corner cabinet handling intersects directly with your existing `Placement.mirror = false` decision in `05_CONTRACTS.md` and the `rot_deg ∈ {0, 90, 180, 270}` lock in `06_CONVENTIONS.md`. Those are fine for everything _except_ future support of diagonal corners. If you ever support Pattern C (diagonal), you'll need either to introduce 45° rotations OR to handle the angled panel as a `cutout` with a polygon shape. I'd recommend deferring this decision explicitly — write a one-paragraph note in `04_ARCHITECTURE.md` under "V2 scope" saying "diagonal corner cabinets require either 45° rotation support in 06_CONVENTIONS §3 OR polygonal `shape.type: 'polygon'` in the Part schema. Decision deferred to V2 design review."

Locking that note now prevents Saidislom or your brother from "just adding" diagonal support and silently breaking the DXF generator in three weeks.




---



# -r1_8 — The Blueprint & The NFS Zoom (High-Tech 2D Mode)

**Version:** 1.0 **Status:** Research synthesis. Pure presentation-layer design — no contract changes required. Sits alongside `-r1_6_community_moat.md` and `-r1_7_dealer_channels.md`. Implementation guidance is for Brother.

---

## The thesis in one sentence

Mebelchi's technical 2D mode steals ISO 128 line grammar (which Bazis already obeys, and which every CAD-literate mebelchi has been trained on for 20 years) but applies it with three mobile-first deviations: edge banding becomes a color-coded outer strip (not microscopic line geometry), layer toggles collapse from 30 into 5–7, and hardware-to-operation linkages surface as floating callout cards on tap-zoom (replacing the desktop hover state). Everything else is standard CAD. Don't invent new conventions — speak the universal language, make it slick.

---

## Part 1 — What you're competing against (the Bazis/GibLab visual baseline)

Bazis-Mebelschik is the reference for "real factory CAD" in this market. Per public sources, Bazis-Center has been shipping since 2002, has 1,500+ furniture manufacturers as customers, and ships modules including Bazis-Mebelshchik, Bazis-Cabinet, Bazis-Cutting, Bazis-CNC, **Bazis-View 2D** (the technical drawing module specifically), Bazis-Barcode Scanner, Bazis-Print, Bazis-Tag, plus hardware libraries from Grass, Hettich, Samet, BOYARD.

Their machining vocabulary, used in their MPR file output and visible in their 2D view, breaks down to four operation types:

|Bazis term|Meaning|Mebelchi equivalent (`05_CONTRACTS.md`)|
|---|---|---|
|VD — Vertical Drilling|Drill perpendicular to panel face|`drill` with `face: "A"` or `"B"`|
|HD — Horizontal Drilling|Drill into panel edge|(V2 — not in current schema)|
|GR — Grooving|Slot along panel|`groove`|
|MI — Milling|Pocket / cutout|`pocket`, `cutout`|

Their visual aesthetic in Bazis-View 2D is white background, thin black lines, ISO-conformant dimensions everywhere, no color in the technical view, AutoCAD-style. Designed for a 19" monitor in 2002.

**What to steal from them:**

- Line discipline (ISO 128 — they obey it religiously)
- Dimension chain layout (baseline-style chains running along the bottom and left edges)
- Drill hole callouts (⌀5 × 13 format — the universal CNC convention)
- Hardware library naming (mirror their Russian names so reps see familiar terminology)

**What to NOT copy:**

- The dated white-paper aesthetic — Mebelchi is a 2026 mobile-first product, not a 2002 Russian desktop CAD
- The assumption that the drawing is going to be printed on A3 paper
- The lack of color coding for drill purpose and edge banding
- The hover-only interaction model

The point of matching their conventions is credibility, not nostalgia. A mebelchi who has seen Bazis files for 10 years should recognize the line types and dimension format instantly — but he should also recognize, within 5 seconds, that this is a fundamentally newer thing.

---

## Part 2 — The universal language: ISO 128 line conventions

ISO 128 is the international standard governing CAD line types and weights. Every CAD program in the world follows it because it's the universal grammar of technical drawings. Bazis follows it. GibLab follows it. Mebelchi follows it. This is non-negotiable for credibility.

The complete line table Mebelchi uses:

|Element|Line type|Display weight|Pattern|Per ISO 128|
|---|---|---|---|---|
|Visible panel outline (Face A)|Continuous thick|2px @ 1× zoom, scales linearly|solid|Type A|
|Hidden geometry (Face B through Face A)|Dashed thin|1px|3mm dash, 1.5mm gap|Type E/F|
|Drill hole centerlines (32mm grid)|Chain thin|0.5px|long-dash short-dash|Type G|
|Dimension/extension lines|Continuous thin|0.5px|solid|Type B|
|Future-state / mating piece ghost|Phantom|0.5px|long-short-short-long|Type H|
|Cutting plane lines (if used)|Chain thick|2px|long-short, arrowed ends|Type H thick|
|Edge banding strip|Color band|fixed 6px regardless of zoom|solid color|Mebelchi extension|
|Drill hole symbol|Solid circle + cross|varies by zoom|solid|Type A circle + Type G cross|

**Precedence rule when lines overlap** (per ANSI/ISO):

```
Object line  >  Hidden line  >  Center line  >  Cutting plane
```

That is: if a visible panel outline crosses a hidden Face B drill at the same coordinate, the visible outline wins. The hidden line stops at the visible line. This rule applies automatically in standard CAD; Brother needs to implement it in the rendering pipeline (not just draw both lines on top of each other).

---

## Part 3 — The X-ray toggle spec (what becomes dashed when 3D collapses to 2D)

This is the core of the technical mode. The user is looking at a 3D cabinet rendering. They tap "Technical View" (or equivalent). The view collapses to a flat orthographic projection of a chosen panel — default Face A, with toggle to Face B. The following rendering rules apply:

### Visible (solid thick — Type A)

- Panel outline (drawn at final-panel size from `Part.shape`, with edge banding strips drawn outside this outline as annotation — see Part 4)
- Drill holes located on Face A: solid circle at actual diameter + center cross (chain thin)
- Grooves on Face A: solid polyline rectangle showing groove footprint
- Pockets on Face A: solid rectangle outline with diagonal hatch fill
- Hardware mounting shadows (where a hinge or drawer slide will be installed): solid outline at actual hardware footprint, in a distinct color

### Hidden (dashed thin — Type E)

- Edges of Face B (rear face) showing through the panel, where the panel meets perpendicular panels on the other side
- Drill holes on Face B: dashed circles, 60% opacity, smaller visual weight than Face A drills
- Grooves on Face B: dashed parallel lines (the two long sides of the groove)
- Pockets on Face B: dashed rectangle outlines
- Adjacent cabinet structure visible "through" the panel — when looking at a side panel, the bottom panel and top panel show as dashed horizontal lines at their attachment points

### Center / Reference (chain thin — Type G)

- **32mm system grid** (toggleable layer, OFF by default, ON when the master taps the grid icon): chain-thin grid lines spaced 32mm in both directions, originating from the front edge + 37mm offset per Blum/industry convention
- Panel centerline (X/Y axes through midpoint): used as a reference when verifying symmetric drilling (e.g., shelf pin rows that should mirror)
- Hardware mounting reference lines (the 37mm setback line from the front edge): visible when zoomed near a hinge or drawer slide

### Phantom (long-short-short — Type H)

- Hardware that will be installed but isn't physically there yet: ghosted at correct position with phantom-line outline
- **The "mating piece" ghost** (see Part 6 below — this is the killer feature): when zoomed on a hinge cup on a door, the corresponding hinge plate on the cabinet side panel appears as a phantom outline with an arrow indicating the connection
- Alternative drill positions (when the user is exploring alternates before committing)

### Color (separate from line weight — Mebelchi extension)

The color encoding is layered ON TOP of the ISO line system, not a replacement for it. Color carries semantic information (what kind of drill, what thickness of banding) while line type carries structural information (visible vs hidden vs centerline).

|Element|Color (day mode)|Color (night mode)|
|---|---|---|
|⌀5 dowel hole|Neutral gray (#666)|Light gray (#A0A0A0)|
|⌀8 confirmat hole|Orange (#F26B1F)|Light orange (#FFA666)|
|⌀15 shelf support|Green (#3AAA64)|Light green (#7DCC9B)|
|⌀35 hinge cup|Blue (#1E6BD9)|Light blue (#6FA9F0)|
|Groove (4mm)|Purple (#8E47C2)|Light purple (#B98EE0)|
|Pocket / cutout|Red (#D14545) low-opacity fill|Light red (#F39595) low-opacity fill|
|Edge banding 0.4mm|Pale blue-gray (#A8B8C2) strip|Same|
|Edge banding 2mm|Dark blue (#1E4F8A) strip|Same|
|Edge banding "none"|No strip rendered|Same|
|Hardware shadow|Same color as primary mounting drill, 40% opacity|Same|

---

## Part 4 — Edge banding visual: the 0.4mm vs 2mm problem

This is the single hardest visual problem in the technical mode. Physical reality vs visual scale conflict directly.

**The problem:** A typical kitchen panel is 600mm wide. Shown at 600px wide on a phone screen (which is generous), 1mm = 1px. Edge banding at 0.4mm = less than 1 pixel. Edge banding at 2mm = 2 pixels. Both are visually invisible.

Three approaches considered:

### Option A — Literal scale (rejected)

Draw the banding strip at proportional thickness. The 0.4mm strip is 0.7px. The 2mm strip is 3.3px. Neither is legibly distinguishable. The strip is functionally invisible on mobile.

**Why rejected:** Useless. The whole point of showing the banding is to make it instantly visible to the operator at the edge banding station.

### Option B — Color-coded thick strip with thickness label (RECOMMENDED)

Each banded edge gets a color strip of FIXED visual width (6px) regardless of actual zoom level. The strip is drawn OUTSIDE the panel outline (i.e., the panel outline draws at final-panel dimensions per `06_CONVENTIONS.md`, and the banding strip is an annotation overlay that visually sits beyond the outline).

The color encodes both physical thickness AND material:

- 0.4mm white PVC → pale blue-gray strip
- 2mm white PVC → dark blue strip
- 2mm oak ABS → dark brown strip
- "none" → no strip rendered at all (so the operator instantly sees raw edges as gaps in the perimeter color)

A text label on each strip shows the spec: "T: 2mm white" / "L: none" / "R: 0.4mm white" / "B: 2mm white". On overview zoom, the label collapses to "2mm" / "—" / "0.4" / "2mm". On corner zoom, full spec: "TOP: 2mm WHITE PVC, hot-melt EVA".

**The dimension dance:** Per `06_CONVENTIONS.md`, `shape.w_mm` and `shape.h_mm` are final-panel dimensions (delivered to customer). The DXF generator subtracts banding thickness from cut size invisibly. But when the operator at the saw needs to cut to the right dimension, he needs to see BOTH numbers. The technical view handles this with a tap interaction:

- Default state: label shows delivered dimension ("600mm width")
- Tap the edge: label expands to show both ("Delivered: 600mm | Cut: 596mm | Banding: 2mm × 2 sides")

This means the same drawing serves both the customer-facing quote view AND the shop-floor cut view, switched by tap.

### Option C — Hatching pattern (rejected)

Different hatch density per thickness. Looks like serious CAD. Clutters mobile screens at small zoom levels. The information density-to-pixel-cost ratio is worse than color encoding.

**Why rejected for V1:** Wait until V2 when print/export PDF view is built. In a printed A3 sheet, hatching reads better than color (because the PDF may be black-and-white printed). Until then, color strips win on mobile.

### Implementation note

The banding strip is rendered as a separate annotation layer, not as panel geometry. This means it does NOT enter the DXF output (which uses only the panel outline and operations). The strip is purely a presentation-layer visual aid. Brother should treat the `Part.edge_banding` field as a render-time annotation source, not as input to the cut path.

---

## Part 5 — Drill hole coordinate display on the flat drawing

For every drill operation on the visible panel, the rendering pipeline produces:

### Always visible (no zoom needed)

- A circle at the exact (x_mm, y_mm) location from `Part.operations[].x_mm` / `y_mm`
- Circle diameter renders at actual physical diameter scaled to current zoom
- Color-coded by drill purpose (per the table in Part 3)
- A small dot or cross at the center for hairline precision reference
- Face A drills: solid circle. Face B drills: dashed circle at 60% opacity. (Per X-ray toggle rules.)

### Visible at moderate zoom (the master is reading the drawing carefully)

- Chain-thin centerline crosses extending 32mm in each direction from the hole center
- Coordinate label adjacent to the hole: "(37, 100)" — meaning 37mm right of left edge, 100mm above bottom edge (always in part-local space per `06_CONVENTIONS.md`, never sheet-global)
- Diameter and depth callout in standard ISO format: "⌀5 ↧13" for 5mm diameter, 13mm depth, or "⌀5 × 13" without the depth symbol (both acceptable)
- Through holes: "⌀5 THRU" instead of "↧13"

### Visible at close zoom (NFS corner-zoom — see Part 6)

- Full floating callout card with hardware linkage
- Sequence-of-operations indicator

### Dimension chains

A baseline-style dimension chain runs along the bottom edge of the panel marking X-positions of every drill hole in the panel. A second chain runs along the left edge marking Y-positions.

For 32mm-system rows (multiple holes spaced 32mm apart), the chain collapses to compressed notation: "5× @32" instead of five individual measurements. This is the same convention CNC operators see in Cabinet Vision and Microvellum outputs. Tap any single hole in the row to expand its individual position.

### Through holes vs blind holes

- **Through holes** (per `operations[].through: true`): solid circle outline + small "TH" badge. No depth shown (because through holes don't need a depth callout — they go all the way).
- **Blind holes** (per `operations[].through: false`): solid circle outline + depth label "↧13".

This matches the universal CNC blueprint convention from the Protolabs / industry standards research — the ⌀ symbol for diameter, ↧ symbol for depth, "THRU" or "TH" for through holes.

---

## Part 6 — The NFS corner-joint zoom: what data floats on screen

Critical pushback before the design: on mobile, this can't be a continuous real-time camera zoom with hover-state callouts. That's a desktop interaction pattern. The mobile-native interaction is:

1. User pinch-zooms or double-taps a corner of the panel
2. View locks to that corner at a fixed zoom level (~200×200mm region fills the screen)
3. Floating callout cards animate in, anchored to operation positions
4. User taps a callout card to expand it; tap-elsewhere collapses it
5. User pinch-zooms out (or taps a back button) to return to overview

Within this constraint, here's what floats on screen at the corner zoom.

### Primary callout (always visible, large)

The dominant element: the **hardware item** to be installed at this corner.

Format:

- Small isometric icon of the hardware (rendered once, cached)
- Name: "Blum Standard 110° Hinge" (sourced from `HardwareBOM.items[].display_name`)
- Quantity at this location: "1×"
- Linked drill operations summary (collapsed by default): "3 holes (1× cup, 2× mounting)"

This card draws the operator's eye to the _purpose_ of these holes — not just "drill three holes" but "drill these three holes because a hinge mounts here."

### Secondary callouts (one tap to expand)

Each drill operation as its own small card, anchored by a leader line to its hole position:

- Operation ID + type: "OP_3: drill"
- Diameter and depth: "⌀35 × 13mm"
- Position from panel origin: "(37, 100)"
- Position from nearest edges: "37 from LEFT, 100 from BOTTOM"
- Purpose tag: "Hinge cup hole"
- Through / blind status

These cards are stacked at the screen's right edge with leader lines to the actual hole positions, so the operator can read all specs at once without occluding the panel view.

### Reference overlays (toggleable, OFF by default)

- 32mm grid lines extending from hole positions to panel edges (only the relevant grid lines, not the full panel grid)
- Edge banding thickness labels on each visible edge in the corner zoom
- Material thickness reminder ("18mm LDSP White") in a corner badge

### The killer feature: mating-piece ghost overlay

When zoomed on a hinge cup hole on a door panel, a **phantom-line outline** appears at the corresponding location on the cabinet side panel — showing where the OTHER HALF of this hinge will mount. The connection between the cup hole and the side-panel hinge plate is drawn as a phantom-line curve (long-short-short pattern).

Tap the phantom ghost and the view smoothly animates to that other panel at a matching zoom, showing the cabinet-side hardware specs. This is the operationally killer interaction because it answers the question every assembler asks: "what does this connect to, and what do I need to drill on the other side?"

This works because `HardwareBOM.items[].linked_operation_ids` already links a single hardware item to multiple drill operations across multiple panels (per `05_CONTRACTS.md`). One Blum hinge links to a cup hole on the door + a hinge plate location on the side panel. The mating-piece ghost is just a visual surfacing of this existing data linkage.

### Sequence-of-operations indicator

Small numbered badges near each drill: "1, 2, 3" showing the order to drill (largest diameter first is the industry convention — drill the ⌀35 cup before the ⌀5 mounting holes, to prevent panel splitting from radial stress).

For V1, this can be a simple "drill diameter descending" auto-sort. For V2, more sophisticated sequencing per hardware-specific install procedures.

### Hardware spec link (the supplier upsell moment)

A small "i" badge near the hardware callout. Tapping it surfaces:

- Supplier name (from `HardwareBOM.items[].supplier_id` cross-referenced to supplier directory)
- SKU
- Current price (from `HardwareBOM` total)
- Inventory status if integrated with a supplier API
- "Order now" button linking to the supplier's catalog or generating a quote request

This is where the supplier-marketplace value per `09_QA_PLAYBOOK.md` becomes operationally useful — at the exact moment the master is reading the spec, he can order from a paying supplier in one tap. This is the cleanest possible supplier-marketplace moment because it's contextual (right hardware, right quantity, right shop), not interruptive.

---

## Part 7 — Visual hierarchy when zoomed: what fades, what brightens

Desktop CAD uses opacity and z-order to manage information density. Mobile needs more aggressive prioritization because the screen is small and the user can't see everything at once.

When zoomed to a corner, the system follows this priority order:

1. **Primary (100% opacity, full detail):** the corner being zoomed and its hardware/operations
2. **Secondary (60% opacity, line weights preserved):** the rest of the visible panel outline so the operator keeps spatial context
3. **Tertiary (30% opacity, faded):** dimension chains and ungrouped reference lines outside the zoomed region
4. **Hidden (not rendered until toggled):** unrelated Face B operations, mating-piece references for non-zoomed corners, 32mm grid for non-zoomed regions

When the user un-zooms back to overview:

- All elements return to default opacity
- Callouts collapse back to icons
- Any toggleable overlays the user enabled (32mm grid, etc.) stay on; default-hidden ones (mating ghosts) stay off

### Animation timing

- Zoom-in: 240ms ease-out
- Callout cards appear: staggered 60ms delay between cards, 180ms ease-out fade-in each
- Zoom-out: 200ms ease-in
- These numbers feel "NFS-tight" without being so fast they feel jittery on lower-end Android devices common in the target market

---

## Part 8 — Mobile-first opinions (where Mebelchi diverges from Bazis)

Bazis was designed for a 19" monitor and a mouse. Mebelchi is designed for a 6.5" phone and a finger. This forces specific divergences:

|Bazis convention|Mebelchi convention|Why we diverge|
|---|---|---|
|Hover-state info|Tap-and-hold info, explicit dismissal|No hover on touch screens|
|Scroll-wheel zoom|Two-finger pinch|Native mobile gesture|
|30 layer toggles in side panel|5–7 toggles in bottom drawer|Screen real estate; cognitive load|
|Show all dimensions by default|Show outline + colored drills; surface dimensions on tap|Mobile screens become unreadable at full dim density|
|Line weight distinguishes drill purposes|Color distinguishes drill purposes (line weight does ISO structural job only)|0.3px vs 0.6px difference is 1 pixel — invisible on mobile; color is more discriminable|
|White-paper aesthetic|Day mode (light) + Night mode (dark), tokenized|Workshop floor + edge bander stations have variable lighting|
|Drawing-is-printed assumption|Drawing-is-screen-first, printable PDF is separate export|Operators read on phones, not paper, most of the time|

### The 5–7 toggle drawer (vs Bazis' 30)

A bottom-drawer panel exposes these critical toggles only:

- **32mm grid:** OFF by default; the master toggles ON when verifying shelf pin alignment
- **Face B operations:** ON by default; toggle OFF to focus only on Face A work
- **Dimension chains:** ON by default; toggle OFF for cleaner overview
- **Edge banding strips:** ON by default; toggle OFF only when not relevant to current station
- **Hardware shadows:** ON by default; show where hardware will be mounted
- **Centerlines:** OFF by default; toggle ON for symmetry verification
- **Mating-piece ghosts:** OFF by default; toggle ON in corner zoom for assembly checking

Everything else lives inside the operations themselves (tap-to-expand), not as a top-level toggle.

---

## Part 9 — The dark mode question

Bazis is white-background, black-line. Standard CAD aesthetic from 2002.

Mebelchi's actual usage contexts:

- Workshop floor, midday sun through skylights → white BG washes out the screen
- Edge banding station, sawdust constantly settling → white BG hides sawdust ON the screen blending with the BG of the panel boundary
- Late-evening quote prep, master on his couch → dark BG more comfortable, doesn't blast him with white light
- Outdoor measuring at a construction site → either mode could fail, but dark mode preserves more contrast in direct sun

**Recommendation:** dual-mode rendering with automatic switching based on system preferences or manual toggle.

||Day mode (default)|Night mode|
|---|---|---|
|Background|Off-white #F8F8F5|Near-black #0F1115|
|Primary lines|Dark gray #1A1A1A|Light gray #E5E5E5|
|Hidden lines|Medium gray #5A5A5A (dashed)|Medium gray #8A8A8A (dashed)|
|Drill colors|Saturated|Pastel-shifted (less saturated, more lightness)|
|Edge banding strips|Saturated|Slightly desaturated|
|Callout cards|White background, dark text|Dark gray background, light text|

Both modes use IDENTICAL line weight hierarchy and identical layer logic. Only the color palette differs.

This is also a differentiation play: Bazis only has light mode. Dark mode positions Mebelchi as a modern, designed tool at first-glance impression — a 2-second credibility win in every screenshot, every demo, every Telegram share.

---

## Part 10 — What Brother needs to build

Per the architecture in `04_ARCHITECTURE.md`, Brother already has a 3D preview component (Three.js / Flutter) and a working DXF generator. The technical 2D mode is a NEW VIEW, not a new module. It consumes the same `MachinedParts + CutLayout` from the contract bus that DXF and PDF generators consume.

Concrete components needed:

1. **`PanelTechnicalView` (Flutter widget)**
    
    - Inputs: a single `Part` + `Cabinet` reference
    - Renders Face A outline + all operations + edge banding strips
    - Handles layer toggle state
    - Tap targets for each operation surface callouts
2. **`CornerZoomController`**
    
    - Wraps `PanelTechnicalView`
    - Handles pinch + double-tap → enter corner zoom mode
    - Manages callout card lifecycle (appearance, dismissal, expansion)
    - Drives animations (transitions, opacity changes)
3. **`EdgeBandingStrip` widget**
    
    - Per-edge, renders the color strip outside the panel boundary
    - Color and label sourced from `Part.edge_banding[side]`
    - Tap expands to full spec including cut-vs-delivered dimension
4. **`DrillHoleSymbol` widget**
    
    - Renders one drill operation
    - Color from drill purpose (diameter-based lookup table)
    - Centerlines visible at moderate zoom
    - Solid (Face A) or dashed (Face B) per the operation's `face` field
    - Tap surfaces the operation's spec card
5. **`HardwareCalloutCard` widget**
    
    - Reads `HardwareBOM` entries whose `linked_operation_ids` intersect the drills in the current zoomed corner
    - Renders the floating card UI with icon + name + quantity + linked operations
    - "i" badge expands to supplier/SKU/price info
6. **`MatingPieceGhost` widget**
    
    - For a given hardware item with `linked_operation_ids` spanning multiple parts, renders the phantom outline on the current view showing where the other half mounts
    - On tap, triggers view navigation to the other part with matching zoom

The contract between these components and the upstream pipeline is **read-only against existing schemas**. No new schema work, no contract drift risk. This is the cleanest possible addition — pure presentation layer.

---

## Part 11 — Implementation order for Brother's next sprint

Don't build all of this at once. Order of operations:

|Step|Scope|Estimated time|
|---|---|---|
|1|`PanelTechnicalView` with outline + drill dots only, no colors, no callouts, no zoom|1 week|
|2|Color coding by drill purpose (diameter-based lookup)|1 day|
|3|Edge banding color strips with simple labels|3 days|
|4|Corner zoom interaction (pinch + double-tap, basic callout)|1 week|
|5|Hardware → drill operation linking surfaces in callout|4 days|
|6|Layer toggle drawer with the 5–7 toggles|3 days|
|7|Dark mode (tokenize colors, theme switch)|2 days|
|8|Mating-piece ghost overlay|1 week|
|9|Print/export PDF view (separate code path using `ReportLab` per `04_ARCHITECTURE.md`)|1 week|

Total: roughly 5–6 weeks of solo Brother time. Can run in parallel with the rest of V1 because it's pure presentation, no contract changes, no Saidislom blockers.

The Step 1 milestone — outline + drill dots only — is itself useful enough to ship internally as a debug view. It validates the rendering pipeline against the JSON contract before any UI polish work begins. This is the discipline-checkpoint per `04_ARCHITECTURE.md` philosophy of modular incremental builds.

---

## Part 12 — SACRED watch-outs (Face A/B coordinate frame)

Per `06_CONVENTIONS.md` SECTION 1: origin is bottom-left of Face A. All `operations[].x_mm` and `y_mm` are in this single part-local coordinate system, regardless of which `face` the operation targets.

This means: a drill on Face B at `(x_mm: 37, y_mm: 100)` is located 37mm from the LEFT edge of the panel as viewed from Face A. When the user toggles to look at the back side (Face B), that same drill appears 37mm from their RIGHT edge — because Face B's view is mirrored relative to Face A's view.

**The implementation watch-outs:**

- When rendering Face A view: render Face B drills at their stored (x, y) coordinates, but as dashed circles (visually indicating they're on the other side)
- When rendering Face B view: render Face B drills with x-coordinate flipped: `(panel_width - x_mm, y_mm)`. This is the standard mirror transform when flipping a panel about the vertical axis
- Never let the user write to Face B view coordinates directly without the flip — that would corrupt the contract because operations always live in Face A reference frame
- The X-ray toggle should always operate from a single canonical orientation (Face A view) by default; Face B view is a separate user-initiated flip, not a continuous spectrum

This is a real bug class. Get the mirror direction wrong and you ship drill holes on the wrong side of real panels in real shops. Brother needs a unit test in `tests/fixtures/` that places one drill on each face at known coordinates, renders both Face A view and Face B view, and verifies the rendered positions match hand-calculated expected values. This belongs in the same fixture directory as the transform-rotation test from `06_CONVENTIONS.md`.

### Other watch-outs

- **Don't conflate technical mode rendering with DXF generation.** The technical view is what the user looks at. The DXF that goes to the CNC is generated separately by Module 5. These are independent rendering paths. Never let the technical view's render code drive the DXF output, or vice versa.
- **Respect the edge banding annotation rule.** Edge banding strips are visual annotations, drawn OUTSIDE the panel outline. They do NOT enter the DXF. The DXF gets the panel outline at cut dimensions (final size minus banding per-edge), produced by the DXF generator independently per `06_CONVENTIONS.md` SECTION 5.
- **Coordinate system parity with PDF cut map.** Module 6 (PDF Cut Map) and the technical view should use identical coordinate rendering rules. If a drill renders at position X on the technical view, it should render at the same position X (scaled to the PDF page) on the printed cut map. This means both consume the same `MachinedParts` data via the same rendering primitives. Don't reimplement coordinate handling separately for each view.

---

## The bottom line

The visual language of Mebelchi's technical 2D mode is ISO 128 with three specific mobile-first deviations:

1. **Edge banding is a color-coded outer strip** (not microscopic line geometry inside the panel), because 0.4mm vs 2mm is invisible at mobile scale and the operator at the edge bander needs to see the banding pattern from across the room.
2. **Layer information collapses into a 5–7 toggle drawer** (not exposed as 30 individual layers), because mobile cognitive load is the binding constraint.
3. **Hardware-to-operation linkages surface as floating callout cards on tap-zoom** (replacing the desktop hover state), enabling the mating-piece ghost overlay that no Bazis user has ever seen.

Everything else — line weights, hidden line dashes, drill hole symbols, dimension chains, callout format — is standard ISO 128. This gives the user Bazis-level technical credibility (anyone who's used CAD recognizes the conventions) without having to clone Bazis' 2002-era aesthetic.

The "Need for Speed" feel comes from the transitions and interactions — smooth pinch zoom (240ms), animated callout cards (staggered fade-in), color-coded drill purposes, the mating-piece ghost overlay revealing how the door hinge connects to the side panel hinge plate — not from inventing new visual conventions.

Don't invent new conventions. Standard CAD is the universal language every mebelchi who has ever opened a Bazis file already speaks. Speak that language. Make it slick.