# MEBELCHI — Investment Memo

**Audience**: Strategic partner / first capital
**Ask**: $30,000 for dedicated CNC drilling machine
**Stage**: Pre-revenue, MVP shipped, technical validation in progress
**Date**: May 2026

---

# PAGE 1 — THE OPPORTUNITY

## $558M market. 7,500 workshops. Zero modern tools.

**The Uzbekistan furniture market is large, fragmented, and underserved.**

- **$558M** annual furniture production (2023, Presidential press office, stat.uz)
- **7,500** registered furniture enterprises across Uzbekistan
- **920** new enterprises launched in 2023 alone — **12% YoY growth in business unit count**
- **25–30%** of furniture still produced in informal household conditions
- **NEW**: Government just legalized 5-worker informal workshops as a formal business unit (presidential resolution, 2023)

**The wedge: 4,850 small-to-mid workshops (4–15 employees) are stuck between two bad options.**

| Option | Reality |
|---|---|
| Bazis (the dominant CAD/CAM) | $2,000 license, desktop-only Windows, multi-day learning curve, owned by factories |
| Free tools (SketchUp, AutoCAD pirated, paper + Excel) | No CNC output, no quoting, no supplier integration |
| **Pay a factory like Eman for raskroy** | **$2/m² × ~100 m²/month = ~$200/month per workshop** |

**A 4,850-shop market × $200/month in waste = $11.6M annual addressable pain.**

---

# PAGE 2 — PRODUCT + TECHNICAL BREAKTHROUGH

## Mobile SaaS that speaks directly to the CNC machines small workshops actually own.

### The product (MVP shipped, working today)
- Cross-platform mobile app: room design, parametric cabinet builder, hardware library (Blum, Hettich, Boyard, Salice — 114 SKUs verified)
- Multi-format CNC export: **SWJ008 XML** (Excitech/KDT/Nanxing), DXF, CSV, MPR, CIX
- Customer quote PDF with shop branding
- Bill of materials with supplier prices baked in

### The breakthrough (verified May 2026)
**SWJ008 is the open API to ~80% of small-shop CNC drilling machines in Uzbekistan.**

Previously failed competitors tried to generate raw G-code — risky, machine-breaking, brand-specific. Mebelchi reverse-engineered the parametric XML format that the Excitech CAM shell already accepts from Bazis. The machine's own software handles motor commands safely; Mebelchi just declares the geometry.

**Cost of a failed test: $0. The CAM shell rejects malformed XML; motors never move.**

### Defensible vs every alternative

| Solution | Mebelchi vs… |
|---|---|
| **Bazis** | $12/mo vs $2,000 license. Mobile vs desktop. Zero training vs days. |
| **Free tools** | Real CNC output. Real quoting. Real supplier prices. |
| **Pay-the-factory** | $12/mo vs $200/mo. Customer keeps margin and design IP. |
| **A competitor copying** | Hardware library, supplier integrations, sticker traceability — moat compounds with users. |

---

# PAGE 3 — TEAM + TRACTION + ROMCHI PRECEDENT

## Why us, why now.

### Team
- **Oppoq** (founder, brand designer) — inside Romchi from day one, active participant in President Tech Award 2025 ($100K win, $25K MRR proof point)
- **Brother** (frontend, 3D, MVP shipped) — built the working iOS/Android app currently demoing
- **Said** (backend, CNC integration) — engineered the SWJ008 generator and the multi-format export layer
- **Romchi CTO** (mentor, weekly review) — direct technical transfer from the playbook that hit $25K MRR
- **Factory partner** (advisor, vesting) — operating mebel factory, industry credibility, real-shop access

### Traction
- ✅ Working mobile MVP on iOS + Android (Expo, three.js, four export formats)
- ✅ SWJ008 format reverse-engineered, validated against real factory output
- ✅ 30+ workshop surveys conducted, willingness-to-pay at $10–15/month validated
- ✅ Factory partner committed, advisor agreement signed
- ⏳ 0 paying customers (by design — completing CNC validation before launch)

### Romchi precedent (the closest analog)
Romchi is the same playbook in the adjacent window-manufacturer vertical:
- 8,000 connected shops, ~5,000 paying at $6/month = **$30K MRR**
- Won President Tech Award 2025, $100K prize, Aloqa Ventures investment
- Operating across Uzbekistan, Kyrgyzstan, expanding to Kazakhstan

**Mebelchi modeled against Romchi at maturity (5-year conservative):**

| Metric | Romchi (actual) | Mebelchi (modeled) |
|---|---|---|
| Connected shops | 8,000 | 7,500 UZ + Paper Belt → 30K+ |
| Paying shops | 5,000 | 5,000–8,000 |
| ARPU | $6/month | $12/month (larger pain, higher willingness to pay) |
| MRR | $30K | $60–96K |
| Supplier B2B revenue | growing | +$4K MRR (8 suppliers × $500) |
| **Total MRR** | **$30K** | **$64–100K** |
| **Implied valuation (13× MRR)** | **$5M** | **$10–15M** |

Same playbook. 10× larger market. 2× pricing power. Result: 2–3× larger outcome.

---

# PAGE 4 — THE ASK

## $30,000 for a dedicated CNC drilling machine. Here's why and what you get.

### The bottleneck
The SWJ008 breakthrough is validated on one factory's machine. To scale to Excitech, KDT, and Nanxing variants across the market — and to ship features faster than the competing factory-owner founder hunting for a CTO — we need a dedicated test machine.

Factory partners are (correctly) protective of production machines: a single mis-tested file means $1,500–3,000 in repair and 3–10 days of downtime. **A dedicated drilling center removes this constraint permanently.**

### What $30K buys
- One used Excitech or KDT 6-sided drilling center (Syntec controller — covers ~70% of small-shop CNCs in Uzbekistan)
- 60-day validated SWJ008 pipeline across multiple controller variants
- 6 months saved on CNC validation work
- Ability to pre-sell a premium tier ($25/month) based on validated CNC integration
- Asset that retains $15–20K residual value at end of 24 months

### Recommended structure: Lease + advisor equity (Option C)
- You buy the machine for $30K. **You own the asset.**
- Mebelchi leases it from you at $400/month for 24 months ($9,600 returned)
- You receive 2% advisor equity vesting over 24 months
- At month 24, Mebelchi has option to purchase machine at $12–15K residual
- Total exposure: $30K capital, ~$10–15K net at-risk after lease and residual

### Your projected return (5-year, conservative $15M outcome)
- 2% equity → $300,000
- Plus machine residual ($15K) and lease income ($9.6K)
- **Total return: ~$325K on $30K capital. 11× multiple. Hard-asset protected downside.**

### What we commit
- Monthly written update to you on traction, MRR, technical milestones
- Weekly access to the machine for your factory's own R&D (your team can use it on weekends)
- Equity vesting tied to milestones, not just time, so you're protected if Mebelchi pivots
- Right of first refusal on the next funding round if you want to participate

### Alternative structures available
If you prefer simpler ownership: 5–7% equity for $30K cash at $400–550K pre-money valuation (Option A). If you prefer deferred valuation: $30K convertible note at $1M cap with 20% discount (Option B).

---

## Why now

Three factors converge in the next 6 months:
1. A factory-owner competitor with $50K capital is actively recruiting a CTO. His MVP lands in September. Ours is shipped now.
2. The 7,500-enterprise Uzbek market is unwon. Bazis dominates fabrikas but cannot serve small shops at $12/month.
3. Romchi just proved the same playbook works in an adjacent vertical with one-tenth the market.

The window to capture the small-shop tier closes when the competitor ships. We have 6 months of head start. This $30K converts that head start into a permanent technical moat.

---

**Contact**: Oppoq — [phone] — [Telegram]
**Demo available**: Live MVP on iOS + Android, 15-minute walkthrough scheduled at your convenience
**References**: Davron (Romchi founder), [Factory partner name], Romchi CTO
