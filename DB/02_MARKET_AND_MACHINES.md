# 02 — Market and Machines

**Version:** 1.0

This document is reference material. Read once thoroughly. Return to it whenever an output-format or hardware decision needs to be made.

---

## Segmentation: who we sell to

| Tier | Size | Volume/month | Tools today | V1 fit |
|---|---|---|---|---|
| **Solo master (Usta-1)** | 1–3 people, no fixed sex | 5–15 jobs | Notebook, head math, Telegram | Free tier later, not the V1 wedge |
| **Small shop (Sex)** | 4–15 people, owner + masters + admin, basic saw + edge bander | 20–80 jobs | Excel, paper, sometimes Word quote templates | **PRIMARY V1 TARGET** |
| **Mid-factory (Fabrika)** | 20–100+ people, CNC, in-house CAD designer | 100+ jobs | Bazis, K3-Mebel, Pro100, 1C-integrated | Skip for V1. Long sales cycle, legacy software, will not switch for $15/mo. |

The small shop is the only V1 target. The owner is the buyer, user, and decision-maker — same person. He has enough volume that 10% efficiency is real money but not enough volume to have already bought Russian desktop software.

---

## The three tiers of cutting machines

Every cutting decision in furniture happens at one of three machine tiers. Our software must understand which tier the user is on, because the output format differs entirely.

| Tier | Machine type | Common examples | What it eats | How it works |
|---|---|---|---|---|
| **Manual** | Sliding table saw | Altendorf F45, Filato, Woodfast, KDT | Paper PDF cut map | Operator pushes board through. Auto-adjust fence is possible, but human controls speed and sequence. Errors are operator-dependent. |
| **Automated (Beam)** | Beam saw / panel sizing | Homag SAWTEQ S-300, HPP 200, KDT KS-series | `.saw`, `.csv`, proprietary XML | Robotic pusher positions 3–4 sheets at a time. CNC. Operator just feeds raw sheets and removes cut parts. |
| **Nesting** | CNC router | Excitech E4, Excitech 1325, KDT, Nanxing | DXF or G-code | Fully CNC. Router bit cuts panels into puzzle pieces AND drills vertical holes simultaneously. No operator pushing. |

**Critical insight**: only the manual tier needs human-readable PDFs. The automated and nesting tiers need digital files. Our software must generate all three output formats, picked based on the user's machine.

---

## The three tiers of drilling (prisadka)

| Tier | Machine type | Common examples | How it works |
|---|---|---|---|
| **Manual** | Drill press + jigs | Various local | Operator measures with template. 32mm hole systems by pencil. ~1mm error rate. |
| **Boring system** | Multi-spindle drill | Maggi B21 | Multiple drills in one pass, human-positioned. Faster but still error-prone. |
| **6-sided CNC** | CNC drilling center | Homag drillteq V-200 (BHX 050/055), Excitech EP290 | Robotic clamps grab panel. Drills all 6 sides in one operation. Zero operator error. **This is why Eman's "prisadka" is untouchable.** |

The 6-sided CNC is the mathematical-precision threshold. Small masters pay Eman $2/m² because they cannot match this with hand-measured holes.

---

## Edge banding — the hidden failure point

Edge banding (kromka) is the **single most error-prone station** in any shop because it has no digital input.

- Each panel needs 0–4 passes depending on which edges get banded
- Banding tape comes in 0.4mm thin and 2mm thick variants, in dozens of colors
- One wrong edge = whole panel is scrap
- Modern edge banders (Homag, KDT KE-365) can read barcodes — but only if labels exist

**Our sticker traceability play directly addresses this**: scan the panel's QR code at the edge banding station, the app shows exactly which edges to band with which tape, in what order.

---

## Eman's hardware stack (the premium reference)

The largest auto-furniture factory in Uzbekistan. Reference for understanding what "the top" looks like.

| Machine | Function | Landed price in UZ | Market share UZ |
|---|---|---|---|
| Homag HPP 200 | Beam saw | $65K new / $35K used | <5% |
| Altendorf F45 | Sliding table saw (manual) | $35–45K new / $15K used | 10–15% |
| Homag Edgeteq S-300 | Edge bander | $70–80K new / $45K used | <5% |
| Excitech 1228 / 1325 | CNC router | $20–25K new | 25–30% |

**Why this mixed stack?** Eman buys German precision where mechanical/thermal failure is catastrophic (sizing, edge banding), and Chinese commodity tech where 2D routing is standardized. The pattern reveals where premium money goes.

**Why this matters to us**: Eman runs Bazis (parametric design) + GibLab (CAM translator for Homag-specific `.mpr` files). The factory's bottleneck isn't machine speed — it's the data pipeline between proprietary German formats and standard Chinese formats.

---

## Uzbekistan market alternatives (the actual machines our users have)

These are the machines our small-shop and mid-shop users actually own:

### Beam saws (automatic sizing)
- **KDT KS-series**: ~50% market share, $25–30K, the undisputed king
- **Nanxing**: ~30% market share

### Sliding table saws (manual)
- **Filato / KDT / Woodfast**: ~60% combined, $5–8K

### Edge banders
- **KDT KE-series** (KE-365 most common): ~55% market share, $15–20K
- **Nanxing**: ~25% market share

### CNC routers
- **Excitech + KDT combined**: ~60% market share, all use Syntec controllers and HSD spindles

**Implication for our output strategy**: the Chinese machines (Excitech, KDT, Nanxing) all accept standard DXF and G-code. The German machines (Homag) want proprietary `.mpr` / `.saw` files. We do not generate proprietary formats. We generate universal DXF and let factory CAM software handle translation.

---

## The Bazis + GibLab software hierarchy

Understanding this is essential because it defines our competitive position.

- **Bazis-Mebelshik (the brain)**: Parametric 3D design, hardware logic, generates raw cabinet data. Owned by Eman and similar fabrikas. $2,000 license.
- **GibLab (the translator / CAM)**: Ingests Bazis data, optimizes cutting maps for specific machines (Homag SAWTEQ), generates `.mpr` files for Homag DRILLTEQ. Required because Bazis doesn't output proprietary German formats natively.

Small masters can't afford either. They pay Eman $2/m² to run their designs through Bazis + GibLab and get a CNC-ready file plus cut materials. They are paying $2/m² to access $50,000+ worth of installed software.

**Our V1 wedge**: deliver 70% of what Bazis + GibLab does, at $15/month, mobile-first, no installation.

---

## What we will and will not generate

Locked decisions for V1:

| Output | Tier served | Status | Notes |
|---|---|---|---|
| PDF cut map | Manual saw users | YES — V1 | Visual map, readable by human operator |
| DXF (layered) | Nesting CNC users (Excitech, KDT, Nanxing) | YES — V1 | Outline + drill markers on standard layers (DRILL_5MM, DRILL_8MM, GROOVE, etc.). NC Studio or similar CAM software does the rest. |
| Thermal label (PDF or ESC/POS) | All users via station scanning | YES — V1 | QR code + cabinet ID + edge diagram + hardware summary |
| CSV / XML cut list | Beam saw users (KDT KS-series, Homag SAWTEQ) | V1.5 — defer | Generic format, machine-specific dialects come later |
| Homag `.mpr` | Homag drilling machines | NEVER | Proprietary, 12-month engineering effort. Let GibLab handle it. |
| Homag `.saw` | Homag beam saws | NEVER | Same reasoning |
| G-code | Direct CNC integration | V2 | After we know which CNC controller versions our users have |

---

## The "Paper Belt" expansion thesis

Uzbekistan first. Then Kazakhstan, Kyrgyzstan, Tajikistan, Turkey, Pakistan. These markets share:
- Manual or semi-automated labor (no robotic furniture lines)
- Same Chinese CNC machine ecosystem (Excitech, KDT)
- Same Russian-speaking master tier
- Same low BAZIS penetration
- Same Telegram-clustered operator culture

Our software is built once. Localization is Uzbek/Russian first, Turkish in V2, then beyond. Cross-border payments (Click → Payme → Kaspi → similar) is the technical hurdle for international expansion, identical to what Romchi is solving now for windows.
