# Core Catalogue Doctrine — how the 70–100 are chosen

**Version:** 1.0 — June 2026
**Status:** Selection law for `packs/core_2026_06`. An item enters or leaves the core only by these criteria, with a written reason.

---

## 1. The requirements (the full list)

An item must satisfy ALL of R1–R8; R9–R13 break ties.

| # | Requirement | Test |
|---|---|---|
| **R1** | **Universal** | Works in 16/18mm ЛДСП/MDF panel construction across kitchen + wardrobe + shelf/office; not bound to one furniture style |
| **R2** | **Coverage** | Contributes to closing a row of the function matrix (§2). The SET must solve ≥99% of panel-furniture jobs; an item that duplicates an already-closed function needs a tier or price reason to exist |
| **R3** | **In the market** | Buyable in Tashkent today (GTV / Hettich / Blum confirmed present; Boyard/Samet pending shop visits). No "great but unobtainable" items |
| **R4** | **Replaceable** | ≥1 same-function substitute in another brand/tier, AND substitution must not change the panel drilling (standard interfaces: Ø35 cup, Ø15 cam + Ø8, System 32 rows, H45 slide envelope, Euro screw). If a master can't get item A on Tuesday, item B fits the same holes |
| **R5** | **Machine-compatible** | Drillable with the standard bit set (Ø35, Ø20, Ø15, Ø8, Ø7, Ø6.4(?), Ø5, Ø4.5, Ø3) and Types 1–4 machining the factory CNC already does. No exotic tooling, inserts, or special presses |
| **R6** | **Drilling-data verifiable** | Manufacturer publishes the pattern (technical sheet/manual exists) → there is a path to manufacturing grade. No pattern, no core slot |
| **R7** | **Longevity** | Catalogue stalwart, expected on sale in 5 years; System-32 compatible; not a fashion/decor SKU |
| **R8** | **B2C-explainable** | Function obvious to a non-professional from one image + one sentence. (Connectors hide inside; their "why" panel explains them — that's doc 16's job) |
| **R9** | Price-band coverage | Each function reachable in ≥2 tiers (core / upper / premium) |
| **R10** | Stock depth | High-runner the supplier keeps in stock (GTV declares 3-month stock on key products) |
| **R11** | Demountable where the function demands | Flat delivery + on-site assembly is the Tashkent reality; carcass joints must be KD (knock-down) by default |
| **R12** | Constructor-approved | Appears in real factory practice — validated against the mined XML dataset (the hundreds arriving from the factory) and shop visits. Mined evidence promotes/demotes items |
| **R13** | One default per function | The solver auto-picks exactly one item per function (progressive disclosure); everything else is an override or tier swap |

## 2. The function matrix (what "solve 99%" means)

Every piece of panel furniture decomposes into these 14 functions. The core closes every row; brands give the tier ladder. *(m)* = solved by machining, not hardware.

| Function | Default (core) | Upper | Premium | Also |
|---|---|---|---|---|
| F1 Carcass joint, KD | Ø15 cam + bolt kit (WK-CAM-15 + DOW63) | Hettich Rastex 15 + Rapid S/Twister | — | confirmat (WK-CF, budget/fast), Ø8 glued dowel (fixed) |
| F2 Shelf, fixed | cam+dowel (F1 set) | Rastex | — | confirmat |
| F3 Shelf, adjustable | Ø5 pins small (GTV p.246) | screw-mounted/glass supports | — | rafix-type eccentric (MM-FI20) for heavy/secured |
| F4 Back panel | groove 4×8mm *(m — Type 4, proven in SHKOF)* + rear stabilizer (wide cabinets) | — | — | screws |
| F5 Door, hinged | GTV Ø35 soft-close full/half/inset + plates | Hettich Sensys; Intermat (value) | Blum CLIP top BLUMOTION | 165°, 45°, 90° angle, spring-free (push), glass hinge |
| F6 Door, soft/push extras | MENSA magnetic catch; damper dots | BLUMOTION 971A add-on | Blum TIP-ON | — |
| F7 Drawer, sides+runner | VERSALITE H45 ball-bearing (+ soft-close GX/HK) | Hettich InnoTech Atira; KA 270 roller (budget) | Blum TANDEMBOX / LEGRABOX; METABOX (value classic) | concealed: Quadro V6 / MOVENTO |
| F8 Drawer box system | AXIS PRO | Atira / AvanTech YOU | TANDEMBOX/LEGRABOX | — |
| F9 Flap/lift | gas strut GAM050; MINILIFT | — | Blum AVENTOS HK top / HK-S / HF | — |
| F10 Wall hanging | cabinet hangers (GTV p.269) + mounting strip | Hettich hangers | — | corner brackets (auxiliary) |
| F11 Base/feet | adjustable plinth legs + clip | — | — | castors (mobile), decorative legs |
| F12 Wardrobe interior | rail + holders; bottom-running sliding | TopLine L sliding | — | pull-outs later (V1.1) |
| F13 Worktop & cabinet banking | threaded sleeves M4/M6 (SZ) | Hettich worktop connecting bolts | — | corner/angle brackets |
| F14 Open/grip | rail + bow handles 128/160/192, knobs | — | — | profile/gola later; handle = taste item, smallest defensible set |

Out of core (deliberately): aluminium frame doors, internal organizers, LED beyond basics, locks (office V1.1), exotic corner mechanisms (magic corner — premium niche). These are pack add-ons, not core.

## 3. Substitution law (R4 made concrete)

Items live in **substitution groups** per function row. Within a group: identical or adapter-free drilling. The solver stores the *group* in the project and resolves brand/tier at pricing time — so a Bazis-style "rebuild because supplier changed" never happens. Tier swap = price change, not re-engineering. This is also the supplier-listing pitch: being the default in a group is worth money; being a substitute is free distribution.

## 4. Current census vs target

63 family entries ≈ **130+ orderable SKUs** counting size/colour variants (within the 70–100 *items* target when counting families; variant explosion stays in data, not in UI). Census: GTV 31, Blum 17, Hettich 15 — hinges 18, drawers/slides 17, connectors/brackets 15, lifts 5, base/hanging/worktop 8, sliding 2, handles 3, other 5.

**Promotion/demotion queue (next 2 weeks):** validate F1 default (cam vs confirmat — what does the factory actually default to? the mined XMLs answer this), confirm Hettich overlay-type labels, pick Boyard/Samet budget substitutes at shop visits, and demote anything the constructor never uses.
