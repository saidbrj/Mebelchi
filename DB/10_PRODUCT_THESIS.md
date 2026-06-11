# 10 — Product Thesis (LOCKED)

**Version:** 2.0
**Status:** SACRED — this supersedes all earlier "templated tool" framing. Modification requires team approval.
**Date:** May 2026

---

## The decision (on the record)

Mebelchi is a **parametric furniture CAD/CAM engine**: mobile-first, template-and-tweak, with true custom capability, that outputs verified CNC drilling files.

It is **not**:
- A price calculator (rejected — Uzbek pricing is simple per-meter, margins are 20–30%, no calculator needed)
- A ready-kitchen tool (rejected — that's the $100–150/m² commodity business, not ours)
- A consumer visualization toy (rejected — our user is the master, not the homeowner)
- A drawing tool with a hardware library bolted on (this is what the failed MVP attempt actually was)

It **is**:
- Path 2: "the imos iX of Central Asia"
- A parametric solver underneath a template-and-tweak UI
- Precise, mathematical, with very high standards of control
- A tool whose core deliverable is **correct, transparent, confidence-inspiring CNC drilling output**

---

## Why custom is non-negotiable

The Uzbek custom-furniture market commands a 10–30× price premium over ready-made:

| Tier | Price per meter | Notes |
|---|---|---|
| Ready-made kitchen | $100–150/m² | Commodity, mass produced |
| Custom kitchen (standard master) | ~$500/m² | What a normal custom master charges |
| Premium custom | up to $3,000/m² | High-end, signature work |

People pay the premium because there is no other option for custom — and because the master's signature reinforcements make the furniture stronger and more distinctive. A tool that can only do standard cabinets serves the commodity tier, which is the wrong, low-margin business. **Custom capability is the entire reason a master would pay for the tool.**

### The Bazis-refuser insight (critical)

A master who refuses to use Bazis said: *"I can't add my custom panels that differentiate me from others and make my furniture strong and stable."*

This is the exact wedge. Bazis makes custom hard. Mebelchi must make custom a first-class citizen with the same safety guarantees as the standard path. This master is describing the product — put him on the advisory list.

---

## Why drilling correctness is the company

The single biggest reason masters pay ~$20K for Bazis is **drilling (prisadka)**. It is the highest-value, highest-risk operation.

The founding constraint, in the founder's own words: *"Imagine one mistake and machine broken and no startup. One case is enough."*

This fear drives every architectural decision. A single wrong drilling coordinate sent to a $30–80K CNC machine can destroy a spindle ($1,500–3,000 repair) and halt production for days. One such event with a customer's machine ends the company's reputation and likely the company.

**Therefore drilling correctness is not a feature. It is the product's reason to exist and its primary risk surface.**

---

## What this decision changes

| Dimension | Old (templated tool) | New (parametric CAD/CAM) |
|---|---|---|
| Timeline to V1 | ~2 months | ~9–12 months |
| Core asset | UI + hardware library + exporter | Parametric solver + verified drilling primitives |
| Moat | Mobility, brand, supplier integration | All of those PLUS the calibrated solver and drilling correctness |
| Funding need | Small | Larger — this is a real engineering build |
| Competitor risk | Templated competitor ships first and wins | Templated competitor wins the commodity tier; we win the custom tier they can't reach |
| Pitch / valuation | Quoting tool multiple | CAD/CAM engine multiple (higher) |

---

## The UI model (locked)

**Template-and-tweak. Never a blank page.**

- User picks a base template (base cabinet, wall, tall, drawer, corner)
- Adjusts parameters (width, height, depth, shelf count, door config) with sliders / numeric input
- The solver fills in every internal detail (panel decomposition, hole positions, edge banding)
- Custom mode lets the master author panels and place operations by hand, using the same contracts and the same safety gates

Free-form finger-drawing at millimeter precision on a 6-inch screen is explicitly rejected as unusable. The product is parametric, not freehand.

---

## Reference materials, used correctly

- **Bazis library screenshots**: used to understand which hardware drilling patterns are real in the market, then encoded correctly into the drilling primitives. NOT copied; informs the rule data.
- **Popular kitchen app UI (Planner 5D, Coohom, IKEA)**: borrow their visual polish, NOT their workflow. They are consumer visualization tools optimized for pretty renders. Mebelchi's workflow optimizes for a master building a manufacturable cabinet in 5 minutes and trusting the drilling. The workflow comes from watching real mebelchi, not consumer apps.

---

## The world-class comparables (what we're measured against)

| Tool | What it is | Why we're not copying it wholesale |
|---|---|---|
| **imos iX** | German enterprise standard for panel furniture. SQL + AutoCAD + parametric solver mapped to CNC tooling. | Gold standard, but months of setup, desktop-only, $50K+. We take its parametric logic, package it in unbreakable mobile templates. |
| **TopSolid'Wood** | True 3D mechanical CAD/CAM, 5-axis, collision detection. | Overkill for box cabinets. |
| **Microvellum Toolbox** | Open-architecture parametric via Excel-like formulas inside AutoCAD. | Requires designers to be part-time programmers. Clunky. |
| **Cabinet Vision (Hexagon)** | Strong parametric engine, US/EU SMB. | 2000s desktop architecture, cannot move to mobile/cloud without full rewrite. |
| **WoodCAD/CAM (Homag)** | imos rebranded for Homag machines. | Locked to Homag ecosystem; useless for the Chinese Excitech/KDT machines that dominate Uzbekistan. **This is our opening.** |
| **bSolid/bSuite (Biesse)** | Excellent 3D machine simulation. | CAM not CAD; can't design a kitchen with a customer. |
| **Coohom/Kujiale** | Cloud interior design giant, browser-based, fast renders. | Pedigree is pretty design; manufacturing module fails on complex constructions, machines reject its G-code off the standard path. |

**The win mechanism**: don't copy all of imos. Copy its parametric drilling logic, package it in hard non-breaking templates, give it to the master in his pocket, friendly to the Chinese machines that dominate the local market. Competitors are too heavy to come down to mobile.

---

## The three systemic weaknesses of all competitors (our UTP)

| Competitor weakness | Mebelchi answer |
|---|---|
| Lethal complexity — imos/Cabinet Vision need a $1,500+/mo technologist 6 months to configure | Pre-configured presets for Uzbekistan-popular hardware (Blum, Samet, DTC, Boyard) and machines (Excitech). 15-minute setup. |
| PC lock-in — master in the shop or measurer on site can't open imos on a phone | Full cycle from measurement to XML-to-Excitech happens on a smartphone |
| License lock — thousands of euros per seat + annual subscription | SaaS model adapted to local market, $9–15/month |
