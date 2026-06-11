# Mebelchi — Strategic Memo

**Audience:** Anyone who needs to understand Mebelchi in 5 minutes — investor partner, factory friend, Davron (Romchi CTO mentor), advisors.
**Author:** Oppoq
**Date:** June 2026
**Length:** Two pages. If it doesn't fit, it's lying.

---

## What Mebelchi is

A parametric furniture CAD/CAM engine, mobile-first, with verified CNC drilling output. For the 4–15 person furniture workshops of Tashkent and the Central Asian "Paper Belt." Replacement for Bazis ($2,000–$20,000 desktop incumbent) at $10–15/month.

**The product is the solver and the drilling output.** The UI is template-and-tweak on top, with custom panels as a first-class citizen. One bad drilling file ends the company; the architecture is built around that fear.

---

## The wedge

Bazis is desktop-only, 30 years of feature accretion, Russian-only, costs years of license fees, and treats every cabinet edit as starting-from-blank. Russian mebelchi forums document the pattern: weeks of training, yearly license shakedowns, no customer co-presence, no mobile.

Mebelchi inverts six of those.

| | Bazis | Mebelchi |
|---|---|---|
| Platform | Desktop Windows | Mobile-first |
| Pricing | $2K–$20K per workshop | $10–15/month |
| Learning curve | Weeks | Schoolboy test: 5 minutes |
| Customer presence | Showroom only | At the customer's kitchen table |
| Pricing during design | Post-design Estima module | Real-time, every keystroke |
| Master's craft identity | Forced into Bazis templates | Personal hardening panels with preset slots |

The mobile/desktop split is the moat. Bazis cannot become Mebelchi without rewriting their entire product as a cloud-mobile app — which would force them to abandon their existing customer base. They will not.

---

## What's built

After two months of iteration with Saidislom (backend), brother (frontend), Davron (CTO mentor), and the factory-friend advisor:

- **30-step Customer Journey Map** locked across 6 phases (Discovery → Layout → Configuration → Engineering → Cost → Manufacture Handoff)
- **9 atomic interaction verbs** locked in `10_UI_PRINCIPLES.md`
- **7-layer engine architecture** locked in `11_ENGINE_ARCHITECTURE.md`, with drilling primitives as the safety-critical layer
- **15-SKU hardware catalog** spec, cross-verified against Blum/Hettich/Salice/Boyard/Grass/Samet datasheets
- **DXF / MPR / CIX / SWJ008 export pipeline** functional in Saidislom's existing codebase (114 hardware items, manufacturer-correct drilling)
- **Working mobile app prototype** deployed at saidislomsaidazimovv.github.io/DXF/app
- **Competitive teardown of Bazis** (5,666 words, 8 sections) with claim/defer per feature
- **Research synthesis from imos iX** (the German CAD/CAM gold standard) — 25 engineering primitives mapped to our architecture
- **Research synthesis from Moblo + Plan My Kitchen + Cabinetry** — 18 mobile interaction patterns mapped to our principles

---

## What ships in the next 4 weeks

A demo-quality V1 covering the full 6-phase pipeline. **Most importantly: this is the first version where the mebelchi can walk from "customer just called" to "DXF on the CNC" in under 30 minutes without leaving the phone.**

- Phase A: room sketch + constraints (window, gas line, drain stack, outlets)
- Phase B: 4 generated layouts to swipe between, customer confirmation with audit screenshot
- Phase C: per-cabinet configuration (door style, handle, material, drawers, appliance sizes)
- Phase D: X-ray engineering view with custom hardening panels, Moblo-style 3D manipulation, multiple view modes (3D iso / front / top / section / X-ray / nested cut layout)
- Phase E: real-time cost breakdown + smart material advisor ("split facade and carcass materials — save 340K сум")
- Phase F: pre-flight checklist, CNC export ceremony, provenance footer, Telegram share

---

## What's open

Three categories of unknowns that block V1.1 (not V1).

**Field validation (factory friend + 5 shop visits):**
1. Which 15 hardware SKUs actually dominate Tashkent kitchens (Hettich-DT400 vs Blum-LEGRABOX vs Boyard?)
2. Default kromka thickness pattern (universal 2mm visible / 0.4mm hidden, or workshop variation?)
3. How mebelchi currently confirm layout with customers — paper signature, WhatsApp photo, verbal?

**Distribution:**
4. The supplier-as-distributor playbook from Romchi (8 paying suppliers at $25K MRR precedent) — sequence the first three Tashkent supplier conversations
5. Telegram-native referral mechanics (apprenticeship-culture Tarbiyachi/Mentor framing vs cash bounties)

**Capital:**
6. The CNC machine partnership — $30K dedicated drilling machine via lease + advisor equity + buyback. Deck v05 in `MEBELCHI_INVESTMENT_MEMO.md`.

---

## The next two milestones

**Milestone 1 — Working V1 demo (4 weeks):** Saidislom completes the 15-day build plan. Demo runs end-to-end on a real Android phone in under 8 minutes. First 5 Tashkent mebelchi test it. We learn what's wrong before we add features.

**Milestone 2 — First paid pilot (12 weeks):** Factory friend's network puts 3 paying workshops on the product at $10/month. They build one real kitchen each. The DXF cuts on a real CNC without engineer intervention. That's the unlock.

If both milestones land, the supplier-listing partnerships and the President Tech Award 2027 application are the next two parallel workstreams.

---

## What I need from advisors right now

Not opinions on the UI. Not opinions on the pricing. Specifically these:

1. **From factory friend:** 30 minutes of shop floor observation, on tape if possible. What does the mebelchi do *before* they touch any software, and what does the customer ask in the first 60 seconds.
2. **From Davron:** review of the engine architecture's 3-gate safety system (collision check + SWJ008 sandboxing + air-cutting simulation). If any of those three gates has a hole, name it.
3. **From investor partner:** introduction to one Tashkent supplier of Imkon / Egger UZ / Kronospan UZ scale who would consider being the first paid catalog listing partner.

That's the memo.
