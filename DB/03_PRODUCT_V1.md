# 03 — Product V1 Specification

**Version:** 1.0

---

## V1 in one sentence

A mobile-first SaaS that takes kitchen cabinet dimensions, produces a cutting plan + CNC-ready DXF + customer quote PDF + thermal labels for part traceability, for $9–15 per month.

---

## V1 user flow

1. Master opens the app on phone or tablet
2. Picks a kitchen layout template (linear, L-shape, U-shape)
3. Adjusts dimensions per cabinet — 2 minutes total
4. Selects materials and hardware brand
5. App generates four outputs:
   - **DXF file** (for nesting CNC, with drill layers)
   - **PDF cut map** (for manual saw operators)
   - **Thermal labels** (one per panel, QR code + edge diagram + hardware summary)
   - **Customer quote PDF** (branded with the shop's logo)
6. Master prints labels, walks the DXF on a USB stick to the CNC, sends the quote to client on Telegram

End-to-end: under 5 minutes for a full kitchen. Replaces 2–3 hours of manual work and a $40+ trip to a factory.

---

## In scope for V1

### Cabinet types
- Base cabinets (single, double, with drawers, corner)
- Wall cabinets (single, double)
- Tall cabinets (pantry, oven housing)
- Drawer columns

All as parametric templates. The master adjusts dimensions; the templates do the panel decomposition.

### Materials
- LDSP 18mm (Egger, Kronospan, Kastamonu, local boards)
- LDSP 25mm
- MDF 16mm
- HDF 3mm (back panels)
- ABS edge banding 0.4mm and 2mm in standard colors

Catalog of ~20 SKUs at launch, with real Uzbekistan supplier prices baked in.

### Hardware
- Hinges: Blum-style cup hinges, Boyard standard hinges
- Drawer slides: ball-bearing, soft-close
- Connectors: Confirmat screws, eccentric (minifix) connectors
- Shelf supports
- Door handles (5 styles)

### Output formats (per Section 02_MARKET_AND_MACHINES)
- PDF cut map
- DXF with standard drill layers (`OUTLINE`, `DRILL_5MM`, `DRILL_8MM`, `GROOVE_4MM`, etc.)
- Thermal labels (PDF for any printer, ESC/POS for Zebra-style thermal printers)
- Customer quote PDF (branded)

---

## Out of scope for V1 (explicit list)

These are deferred. Hold the line.

- Wardrobes, dressers, custom freeform furniture (V2)
- Photorealistic 3D rendering (this is Davron's brother's lane; hard separation)
- ERP, accounting, customer CRM (V3+)
- Marketplace (Romchi tried, failed. Do not repeat.)
- Multi-master team accounts (V2)
- AI anything (resist this — adds 6 months and zero V1 value)
- Cross-border payments (V2, when KZ/KG expansion starts)
- Native iOS/Android (V1 is Flutter for cross-platform, plus Telegram Mini App)
- 6-sided CNC `.mpr` file generation (never; let factory CAM software handle it)

---

## The sticker traceability play

This is the strategic differentiator. Each cut panel gets a thermal-printed sticker immediately at the saw. The sticker carries:

- **QR code** containing `Part.id`
- **Cabinet name + position** (e.g., "Кухня Karimov / Низ-1 / Левый бок")
- **Final panel dimensions** (after edge banding)
- **Edge banding diagram** showing which edges get what tape
- **Hardware summary** (e.g., "2× Blum hinges, cup holes top-left and bottom-left")
- **Order ID**

### Flow at each station

1. **Cutting station**: Operator cuts. Tablet next to saw prints label per panel. Operator sticks it on immediately.
2. **Edge banding station**: Operator scans QR. App shows him exactly which edges to band, in what order, with what tape.
3. **Drilling station**: Operator scans QR. App shows the drill diagram (or, if CNC drill, loads the right program in V2).
4. **Assembly**: Operator scans QR. App shows which cabinet this belongs to and which other panels are needed.

### Why this is the moat

- Eliminates the #1 source of waste in small shops (mismarked panels)
- Creates real-time job progress tracking (every scan pings the backend)
- Enables productivity metrics per master
- Provides customer-traceable serial numbers
- This is ERP-level functionality at SaaS pricing
- Once a shop adopts this, switching cost is enormous

### Hardware required at the shop
- $80 thermal label printer (Zebra GK420 or Chinese clone)
- $30 USB barcode scanner OR phone camera
- One Android tablet ($100–200) at each station
- Total: ~$300 per shop to be fully equipped

---

## Pricing

### V1 launch (months 1–6)
- **$9/month** for first 500 shops — "founding customer" tier
- Free 14-day trial
- Pay via Click, Payme, or bank transfer

### Standard pricing (months 6+)
- **$15/month** per shop for new customers
- Founding cohort grandfathered at $9/month forever

### Supplier B2B listings
- **$300/month** entry tier (one listing, basic placement)
- **$500/month** premium tier (featured placement, hardware catalog inclusion)
- **$1,000/month** materials integration (real-time price sync, exclusive category sponsor)

### Future tiers (V2)
- **Pro**: $29/month — multi-master accounts, advanced analytics, dealer integrations
- **Factory**: $99/month — for mid-tier shops with 20+ employees

---

## Success metrics for V1 launch (first 6 months)

| Metric | Month 3 target | Month 6 target |
|---|---|---|
| Paid shops | 50 | 200 |
| MRR from shops | $450 | $1,800 |
| Active suppliers | 0 | 2 |
| MRR from suppliers | $0 | $500 |
| Total MRR | $450 | $2,300 |
| User-facing waste reduction | N/A | Median shop reports 8%+ savings |
| Sticker adoption | 30% of paid shops | 60% of paid shops |
| Customer support tickets per shop per month | <5 | <2 |

---

## The product principles

These guide every feature decision. When in doubt, return here.

1. **Big buttons, no training.** A 50-year-old mebelchi with a third-grade education must be able to use this with no instruction.
2. **Mobile-first, always.** Desktop is V1.5. The phone is on the shop floor; the laptop is not.
3. **Telegram-native.** Login via Telegram OTP. Quote PDFs share via Telegram. Customer follow-ups happen on Telegram.
4. **Russian and Uzbek bilingual on day one.** No exceptions.
5. **Show ROI math everywhere.** "Saved 3 hours today" / "Reduced waste 12% this week" / "Replaced $87 in factory raskroy fees this month."
6. **Brand presence is your moat.** Every label, every PDF, every quote has the shop's branding (and quietly, ours).
