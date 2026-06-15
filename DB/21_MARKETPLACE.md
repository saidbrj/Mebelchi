# 21 — Marketplace (Sections & Accessories)

**Version:** 1.0
**Date:** June 2026
**Status:** Legislation (strategic). The two marketplaces are content/placement networks, NOT a transaction or discovery marketplace. That distinction is the whole document.
**Origin:** Founder direction (3D-first + two marketplaces, watch-faces model) ruled on against the R8 market red-team (-rR8_0). The red-team killed transaction/discovery marketplaces on informal markets (UrbanClap, Homzmart, Egypt) — these two avoid that grave entirely.

---

## 0. The one rule that separates moat from graveyard

Every furniture **transaction** or **discovery** marketplace on an informal, cash, referral-driven market has died or pivoted. The killers, named: intermediating the client's cash payment (tax-fear → maker churn), and trying to displace the ~79% personal-referral discovery channel.

**Our marketplaces touch neither client money nor client discovery.** They trade:
1. **Design content between masters** (sections) — a supply-side network effect.
2. **Accessory exposure between hardware brands and masters** (accessories) — a brand-placement channel.

The end-customer's purchase, payment, and discovery stay exactly where they already are — in the master's hands, in cash, through the mahalla. We never sit in that flow. This is the line that must never be crossed:

> **Mebelchi is a tool the master pays for + two content/placement marketplaces. It is NEVER a payment intermediary or a lead-generation take-rate on furniture sales.**

---

## 1. Marketplace A — Sections (the watch-faces model)

### 1.1 What it is
Masters build section templates (a configured cabinet-internal arrangement: shelf bays, drawer stacks, door logic, corner solutions, organizers) and **share, clone, rate, and sell** them. Every user grows a personal library; the community library sits alongside it. This is the doc-17 library + R-U2's three-noun model (Section Template → Instance → Construction Standard) already in the architecture — the marketplace is distribution on top of an entity that already exists.

### 1.2 Why it's a moat (not a feature)
- **Supply-side content network effect.** Value compounds with every master who contributes — like Figma community components, watch-face stores, Roblox UGC. Pretty 3D is copyable; a living library of verified, rated, master-built sections is not.
- **Switching cost.** A master's own library + reliance on community sections makes leaving expensive. This is the lock-in "a 3D toy" never has.
- **Attacks the "unprofessional market" pain** (-rF_4 S3): curated, rated, gate-passing community sections raise the floor for every maker and reassure clients.

### 1.3 The non-negotiable guardrail (sandbox inside, gate at the exit — applied to UGC)
A shared section is parametric rules + geometry — the same data the engine already produces, so sharing is cheap. **But:**

> **No section may be published to the marketplace, or cut, until it passes the full doc-20 invariant set and the manufacturing gate.** A community section that drills through a panel is the same company-ending risk as any other output.

This guardrail is also the product's marketing weapon: **"every Mebelchi community section is verified-manufacturable"** — a claim no open marketplace (Sketchfab, generic UGC) can make. Publishing runs the gates server-side; a section that fails is rejected with the failing invariant named (never silently downgraded).

### 1.4 Economics (light, supply-side)
- Free sharing builds the network; **paid premium sections** and **revenue-share to top contributors** monetize the best work (model TBD via R-M8 — Figma/watch-face/Roblox precedents).
- This is NOT where the main revenue is (that's accessories, §2, and subscription). Sections are the **lock-in and quality engine**, monetized lightly.
- Curation: rating, usage count, "verified-manufacturable" badge, and a featured/editorial tier. Trust signals, not lead-gen.

### 1.5 What it is NOT
- Not a place clients browse or discover masters.
- Not a channel where a client buys a finished kitchen.
- Just masters trading the building blocks of their craft, gated for safety.

---

## 2. Marketplace B — Accessories (brand placement + demonstrated advantage)

### 2.1 What it is
The "one level down" the founder named: per-**accessory** exposure (hinges, slides, lifts, handles, legs, lighting, organizers, sink/appliance fittings). This is the doc-17 supplier-listing business, sharpened: the **accessory slot is the native ad unit**, and hardware brands (GTV, Hettich, Blum, Boyard, Samet) pay for placement and — the high-value form — **demonstrated capability**.

### 2.2 Why accessories are the right ad unit
- Brands already *want* placement here and already publish the assets (CAD models, media, technical PDFs — doc-17 Amendment A: GTV operates a B2B data API). The content cost is borne by the partner.
- It monetizes the **mass-market 95%** (the masters who avoid eccentric and negotiate price by hand) **without** forcing custom/CNC on them and **without** touching their client's cash. The master designs free/cheap; the *brands* pay.
- The take-rate lives in the **hardware supply chain**: whoever owns the fittings list owns the purchase order (doc-17 §4). Commission on hardware orders dwarfs subscription fees.

### 2.3 "Show their advantages" — sponsorship as product education
The honest, native, high-value form of sponsorship: when a master designs a drawer, a **sponsored Blum slide can demonstrate its soft-close / load rating / motion in the live 3D** — the brand pays for *demonstrated capability*, not an impression or a banner. This is useful to the master (he learns the real difference), useful to the client (sees the quality), and worth more to the brand than display ads. Sponsored items may be surfaced, featured, or animated to show advantage.

### 2.4 The ad-integrity rule (binding, written now)
> **Sponsorship can change what is SHOWN. It can NEVER change what is structurally CHOSEN, or how anything is priced for manufacturing.**

Concretely:
- The joint resolver (doc 16), the physics gate, the manufacturing gate, and the cut/drill output are **never** biased by sponsorship. A sponsored slide that doesn't fit the load case is not selected; it's flagged like any other.
- Sponsored placement affects discovery/surfacing/demonstration in the catalog and the design surface — not the engine's correctness decisions.
- A sponsored accessory still carries its real spec; if its drilling is manufacturing-grade it's `verified` like any SKU (doc-17 grades), if not it's browse-grade and cannot drive output.
- This rule is what keeps the product trustworthy to the master, which is what keeps the master using it, which is what makes the placement valuable to the brand. Breaking it kills all three.

### 2.5 Grades carry over (doc-17)
- **Browse-grade** sponsored accessory: shown, priced into a quote, demonstrated — cannot drive drilling.
- **Manufacturing-grade** sponsored accessory: same, plus drives verified drilling output (upper-tier / CNC users).
Both sides pay for the same data differently (doc-17 §4): browse-grade is marketing for the brand; manufacturing-grade is value for the upper-tier user.

---

## 3. How the two marketplaces ride the existing architecture (zero new structural risk)

| Marketplace | Underlying entity (already exists) | New work |
|---|---|---|
| Sections | Section Template (doc-17 library, R-U2 three-noun model) | Distribution, rating, gate-on-publish, revenue-share |
| Accessories | Catalog SKU + grades (doc-17), catalog compiler | Placement/sponsorship layer, demonstration hooks in 3D, brand data-partner intake (GTV API) |

Neither requires a new engine. Sections are parametric data the solver already emits; accessories are catalog records the solver already resolves by key. The marketplace is a *layer*, not a foundation change — consistent with the "surface changes, engine untouched" discipline proven in -rF_4.

---

## 4. Revenue shape (the three lines, none touching client cash)

1. **Subscription** — the master pays for the tool (design + instant 3D + output). The close-rate value (15–20% lift, -rR8_0) justifies it.
2. **Accessory placement + sponsorship + hardware-order take-rate** — brands pay; the fittings-list purchase order is the big one (doc-17 §4). The primary revenue.
3. **Section marketplace** — light: premium sections + top-contributor revenue-share. The lock-in/quality engine.

All three avoid the informality wall that killed the transaction-marketplace graveyard, because none of them intermediate the end-customer's payment or discovery.

---

## 5. Guardrails summary (the constitution lines)
1. Never a payment intermediary between master and client.
2. Never a discovery/lead-gen take-rate on furniture sales.
3. Every published/cut section passes the full invariant + manufacturing gate (doc 20). No exceptions for UGC.
4. Sponsorship changes what is shown, never what is structurally chosen or priced for manufacturing (the ad-integrity rule).
5. Both marketplaces are layers on existing entities; neither alters the engine.

---

## 6. Sequence (after the wedge ships, not before)
The marketplaces are **V2+**, not V1. V1 is the closing instrument (design + instant 3D + the master paying for the tool) and the engine underneath. Order:
1. Ship V1 (3D-first design+present loop) and prove the floor-device 30fps gate (doc 18 / R-M7).
2. Ship the personal library (already in the architecture) — the seed of Marketplace A, single-user first.
3. Open Marketplace A (sections) once there's a base of masters and the gate-on-publish pipeline is built.
4. Open Marketplace B (accessories/sponsorship) with the first hardware-brand data partner (GTV B2B API — doc-17 Amendment A, R-M9), starting with browse-grade demonstration before manufacturing-grade.

## 7. Open research
- R-M8: supply-side content-marketplace economics (Figma community, watch-face stores, Roblox UGC) — curation, pricing, revenue-share model for sections.
- R-M9: hardware-brand placement economics — what GTV/Hettich/Blum pay for demonstrated placement; GTV B2B API access path.
- R-M10: verify the 800–1,400 digitally-ready-workshop figure (Day-1 supply base) precisely.

## Changelog
- v1.0 (June 2026): Created from founder marketplace direction + -rR8_0 ruling. Two content/placement marketplaces; never transaction/discovery; gate-on-publish + ad-integrity rule as the non-negotiables.
