# 08 — Execution Plan (30 Days + First Sprint)

**Version:** 1.0

---

## The principle

The first 30 days are NOT for building code. They are for closing the founder-market fit gap, pre-selling, and locking the architectural foundation. Code starts on day 31 — not day 1.

The exception: Brother's existing DXF and 3D prototypes are kept as-is. They become input for the proper build, not throwaway work.

---

## Days 1–7: Field immersion and team lock

### Oppoq
- Visit at least 10 small mebel shops in Sergeli, Yangiobod, Korzinka mebel area
- Use the three survey questions (workflow / money lost / current tools + channels)
- Record sessions when permitted
- By day 7: written summary of universal pains, willingness-to-pay numbers, channel patterns
- Lock brand name candidate and run by team

### Saidislom + Brother
- Set up the repository skeleton
- Create empty folders: `/contracts`, `/data`, `/tests/fixtures`, `/migrations`, `/modules`
- Set up CI on GitHub Actions (schema validation only at first)
- Set up DigitalOcean droplet ($6/month)

### All three
- Telegram group `mebelchi_general` activated
- Daily 5-minute check-in (just text, no calls unless blocked)

**End-of-week deliverable**: Field notes (Oppoq), repo skeleton with CI green (Saidislom + Brother), one-paragraph hypothesis revision based on field data.

---

## Days 8–15: Co-founder candidate, supplier pre-sale, conventions lock

### Oppoq
- From the 10 shop visits, identify 1–2 mebelchi who could become co-founder candidates
- Have a coffee with each. Test commitment, listen for energy, gauge curiosity about tech
- Do NOT offer equity yet — set up the 6-month advisor period instead
- Get the 5 Bazis sample files from factory friend
- Visit 1 CNC machine, document workflow (per Section 02 reference)
- Lock `06_CONVENTIONS.md` v1.0 with team

### Saidislom
- Implement schema validation script
- Wire it into CI
- Begin draft of `Part.schema.json`, `Operation.schema.json`, `SheetSpec.schema.json` based on Oppoq's notes from Bazis files

### Brother
- Refactor existing 3D preview prototype to be controlled by `CabinetSpec` inputs
- Refactor existing DXF prototype to consume the draft `Part.schema.json`
- This is the start of his "promotion from prototype to V1"

**End-of-week deliverable**: Lockable CONVENTIONS.md, 3 draft schemas, refactored brother prototypes that pass schema validation.

---

## Days 16–22: Supplier pre-sale, MaterialCatalog, fixtures

### Oppoq
- Visit 3 LDSP/MDF distributors in Tashkent: Imkon, Egger regional dealer, Kronospan
- Pitch the supplier listing offer: $5,000/year for branded listing + 100 free seats for VIP dealers
- Goal: one signed letter of intent (cash or commitment letter)
- This proves the B2B revenue model independent of customer SaaS revenue

### Saidislom
- Build `/data/materials.json` from supplier visits + factory friend catalog
- Implement Decomposer skeleton (Module 2)
- Generate first 3 fixtures: simple base cabinet, base cabinet with door, base cabinet with drawers

### Brother
- Complete refactored DXF generator
- It must consume `MachinedParts + CutLayout` (mock data is fine for now)
- It must respect transform application order from `CONVENTIONS.md`
- Pass first round of fixture tests

**End-of-week deliverable**: One signed/verbal-committed supplier letter of intent. `materials.json` populated with 10+ real materials. DXF generator passes 3 fixture tests.

---

## Days 23–30: Brand lock, advisor agreement, sprint zero kickoff

### Oppoq
- Lock final brand name, wordmark, color palette, three core screen mockups in Figma
- Sign factory friend as advisor with written agreement (1–2% equity, 24-month vest)
- Schedule kickoff call with Romchi CTO
- Pay Romchi CTO first month retainer ($200)

### Saidislom
- Build Optimizer skeleton (Module 4) using rectpack
- Wire it through to DXF generator
- First end-to-end smoke test passes: one cabinet input → one DXF file output

### Brother
- Build first proper input form in Flutter
- Connect to Saidislom's API
- Display the output from Optimizer as cut sheet visualization
- This is the V1 user-facing slice

**End-of-week deliverable**: First true vertical slice works. Brand identity locked. Advisor signed. CTO mentor engaged.

---

## Day 31 onward: Sprint 1 (the proper build)

### Sprint 1 scope (2 weeks: days 31–45)
Goal: V0.1 demo to factory friend. One cabinet (kitchen base 60×60×85) end-to-end through all 9 modules.

#### Module-by-module deliverables
| Module | Owner | Target by day 45 |
|---|---|---|
| 1 — Cabinet Templates | Oppoq | 1 template (base) with 3 dimension variants |
| 2 — Decomposer | Saidislom | Produces 6 panels for a base cabinet, schema validates |
| 3 — Machining Engine | Oppoq | Adds 4 hinge cup holes for one door, in `Part.operations[]` |
| 4 — Optimizer | Saidislom | rectpack-based, respects grain lock |
| 5 — DXF Generator | Oppoq | Outputs valid DXF with `OUTLINE` + `DRILL_35MM` layers |
| 6 — PDF Cut Map | Brother | One A4 PDF with cut sheet visualization |
| 7 — Label Generator | Oppoq | Six thermal-printable labels per cabinet (one per part) |
| 8 — BoM + Pricing | Saidislom | Total cost in soum, itemized |
| 9 — API + Frontend | Brother + Saidislom | Input form → API → all four outputs download |

### Sprint 1 demo day (day 45)

Three of you sit in a room with factory friend present. Brother's app runs on a tablet. He types dimensions. Hits "Generate." The full pipeline runs. Four files come out. He walks the DXF to a real CNC machine. It cuts a real left-side panel. He sticks the label on. He scans the QR with his phone. The app shows the panel's status.

That demo is your factory friend's "yes." After that, you sign him as full advisor with confidence (already signed at day 30, but now with reduced abstract doubt).

---

## Sprint 2 (days 46–60): Cabinet variety + supplier demo

- Add wall cabinet, drawer column, corner cabinet templates
- Pre-sale demo to one supplier — show real DXF, real labels, real customer quote
- First 5 paid early customers signed at $9/month (founding tier)

## Sprint 3 (days 61–90): Full kitchen workflow

- Linear / L-shape / U-shape kitchen layouts
- Multi-cabinet projects
- Customer quote PDF with branded shop logo
- Sticker printing flow end-to-end at a real shop
- Onboard 20 paid early customers

## Month 6 target

- V1 publicly available
- 200 paid shops
- $1,800 MRR from shops + $500 MRR from suppliers
- 60%+ of paid shops using sticker traceability
- Median shop reports 8%+ savings vs prior workflow

---

## What goes wrong if you skip days 1–30

If you start coding on day 1 without the field immersion and supplier pre-sale:

- The product is built without real input from shops → 50/50 chance of wrong wedge feature
- No founder-market fit signal → your factory friend has weaker reason to advocate for you
- No supplier pre-sale → you build the B2B side blindly, no validated buyer
- Brand and conventions are still drafts → first month of code accumulates technical debt against unstable foundations

The 30-day cost looks expensive. The cost of skipping it is two months of wrong-direction code that needs rebuilding.

---

## Money in the first 90 days

### Inflows
- Supplier pre-sale: $3,000–8,000 cash (target by day 22)
- First 20 paid customers at $9: ~$180/month MRR by day 90
- Romchi CTO retainer: paid out, not in
- Founder savings: assumed available

### Outflows
- Romchi CTO retainer: $200/month
- DigitalOcean hosting: $6/month
- Thermal printer for testing: $80
- Tablet for prototype demos: $200
- Travel for field visits: ~$50/month
- Factory friend dinner / non / chai expenses: budget $300 total
- Domain + brand assets: $100

Total outflow first 90 days: ~$1,400.
Total inflow (target): $5,000+.

Net positive cash position from day 1. This is the discipline that protected Romchi's organic ascent — and it should protect ours.
