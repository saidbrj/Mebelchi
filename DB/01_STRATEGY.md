# 01 — Strategy

**Version:** 1.0

---

## The thesis in one sentence

We are building **Bazis for masters who can't afford Bazis**: a mobile-first SaaS that generates CNC-ready files, optimized cutting plans, and full part traceability for small and mid-sized furniture shops in Uzbekistan and the broader Paper Belt, at $9–15 per month.

---

## Why mebel, and not something else

Romchi (windows) proved the playbook: niche SME trade with daily manual math pain, material waste over 5%, suppliers willing to pay B2B listing fees, mobile-first Telegram-clustered users, ROI math the user can do in their head. Mebel has the same structural pattern with ~10× the TAM.

| Metric | Windows (Romchi) | Mebel (us) |
|---|---|---|
| Enterprises in Uzbekistan | ~8,000 active shops | ~6,094 furniture enterprises (stat.uz, 2022) |
| Market size | ~$100M | $1B+ (industry estimate) |
| Material waste profile | 15% manual → 2.5% optimized | 8–15% manual → 2–4% optimized |
| Current best tool for small shops | Pen + paper | Pen + paper, OR pay a factory $2/m² to use Bazis |

The pain in mebel is **larger and more measurable** than in windows. A small shop loses ~$200/month paying factories for raskroy services they could do themselves with a $15 tool.

---

## Market positioning

We are not Romchi for furniture. The positioning is sharper:

> **Stop paying Eman $2/m² for raskroy. Generate your own CNC files for $15/month.**

This is concrete and undeniable. The mebelchi doesn't have to imagine value — he can do the math on his current monthly invoice from the factory and see savings immediately.

---

## Differentiation from competitors

### Vs. Bazis (the dominant desktop software)
- Bazis: $2,000 one-time license, desktop Windows only, multi-day learning curve, owned by factory tier
- Us: $9–15/month, mobile-first, Uzbek/Russian bilingual, zero training, accessible to any shop

### Vs. global cabinet CAD (Pro100, Mozaik, CabBuilder, Microvellum)
- They are desktop Windows, English-only, $50–200/month, CNC-shop oriented with steep learning curves
- We target the manual and mid-tier shops they ignore, in the language and form factor they use

### Vs. Davron's AI renovation product (brother)
- Davron's product: B2C, demand-side, consumer uploads room photo and chooses furniture
- Ours: B2B, supply-side, shop runs production
- These do not compete. They are opposite ends of the same value chain. Long term they could integrate (Davron's user picks a kitchen → routed to shop using our tool). For now, hard separation.

### Vs. the $50K competitor (factory owner hunting for a CTO)
- He has capital, factory access, no shipping product
- We have a working DXF prototype, Romchi's CTO as mentor, brand design as a moat, a faster start
- Window of opportunity: 6 months to ship V1 before he closes the gap

### Vs. Romchi expansion
- Romchi is going vertical in windows: ERP, dealer integration, accessories, 9 products, 2% of market turnover
- They will not enter furniture. We are not a competitor to them — which is why Davron's CTO can mentor us guilt-free

---

## The strategic moat: part traceability

The single feature that makes this hard to copy is **sticker-driven traceability**. Every panel gets a QR code label at the cutting station. Every machine (edge bander, drill, assembly) scans the label and knows exactly what to do. This is what big factories pay $50K+ ERP systems for. We deliver 70% of that value at $15/month.

The sticker is also a sentence the mebelchi will repeat to other mebelchi: *"The sticker that travels with every panel from saw to delivery."* That is organic distribution.

---

## Pricing strategy

- **Months 1–6**: $9/month "founding customer" pricing for first 500 shops. Removes friction on installation. Locks in early loyalty.
- **Months 6–12**: $15/month for new shops. Founding cohort stays at $9.
- **Year 2+**: Tiered pricing — basic at $15, pro at $29 (multi-master accounts, advanced reports, dealer integrations).
- **Supplier B2B listings**: $300–500/month per branded listing in the materials catalog. Target: 8 paying suppliers by month 12 (Romchi has this number on windows).

---

## Revenue targets

Conservative, mirroring Romchi's actual ramp:

| Month | Paid shops | MRR (shops) | MRR (suppliers) | Total MRR |
|---|---|---|---|---|
| 3 | 50 | $450 | $0 | $450 |
| 6 | 200 | $1,800 | $500 | $2,300 |
| 9 | 500 | $4,500 | $1,500 | $6,000 |
| 12 | 1,000 | $9,000 | $3,000 | $12,000 |
| 18 | 2,500 | $25,000 | $5,000 | $30,000 |

Romchi reached $25K MRR in ~18 months on windows with a smaller TAM. With a known playbook, faster CTO mentorship, and a larger market, hitting the same number on the same timeline is conservative.

---

## What can kill us

In order of likelihood:

1. **Founder-market fit gap.** Oppoq is a brand designer, not a mebelchi. Mitigation: factory friend as advisor (and possible co-founder after 6-month test), 30-day field immersion before code.
2. **Building too much too fast.** Trying to ship a clone of Bazis instead of a focused wedge. Mitigation: V1 is kitchens only, parametric only, three machine output formats only. No AI rendering, no marketplace, no ERP.
3. **The $50K competitor ships first.** He is hiring; we have a head start. Mitigation: ship V1 prototype demo by Friday end-of-week-2, V1 live by month 6.
4. **Contract drift in the codebase.** Three people building in parallel without locked schemas. Mitigation: `06_CONVENTIONS.md` is sacred, CI validates schemas on every commit.
5. **Supplier B2B model fails to land.** Mebelchi pay $9 happily but suppliers don't pay $500. Mitigation: secure one pre-sale by day 22 of the 30-day plan before any code is written.

---

## What success looks like at 18 months

- 2,500+ paying shops, $30K MRR
- 8+ paying suppliers
- Operating in Uzbekistan, Kyrgyzstan, Kazakhstan, Tajikistan
- Working CNC integration with all three Chinese machine brands common in the region (Excitech, KDT, Nanxing)
- President Tech Award 2027 nomination as Micro-SaaS category candidate
- Factory friend as full co-founder with vested equity
- One acquisition conversation initiated, declined to stay independent
