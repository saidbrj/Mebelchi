# -rF_4 — The Market Reframe (Field Research, 14 Jun 2026)

**Date:** June 14, 2026
**Source:** Founder field interviews with masters + market-structure observation.
**Status:** Strategic. This shifts sequencing and positioning. It does NOT change the architecture — and that distinction is the whole point (see §6, the trap).

---

## 1. The macro picture (why now)

Capital in Uzbekistan rotated: cars (the old store of value, ~20% liquid returns, 1-yr-used > official price) → **real estate**, after the president removed the Tashkent propiska restriction. Result: a **construction/new-housing boom** → a structural surge in demand for new kitchens and furniture. The market timing is real and exogenous — we didn't create it, we're positioning into it.

→ This is the macro slide of the deck: *«Деньги переехали из машин в недвижимость. Каждая новая квартира — это кухня.»*

## 2. The market shape (corrected)

| Old assumption | Field reality |
|---|---|
| Custom/eccentric is the volume market | **Mass market = "cheap tickets", $200–300/m². ~95% euro-assembly (no hole-cutting). Only ~5% eccentric.** |
| Masters need a better build tool | Masters build fine the old way; **eccentric drilling DOUBLES build time (1 day → 2 days)** — they actively avoid it |
| Price accuracy is a feature | Margins are high; masters **prefer to negotiate by hand**. Precise auto-pricing is not a draw — it can even remove their negotiating room |
| The bottleneck is design labor | The bottleneck is **the 3D view, at the table, right now** |

## 3. The real wedge: instant 3D at the client table

The single most important sentence from the field: **"If we had 3D view right away, we'd close 9–10 of 10 instead of 5 of 10."**

The mechanism:
- Clients **ask** for 3D to imagine the kitchen. Masters can't produce it live.
- Each render costs **200,000 сум (~$17)** and, more importantly, **time** — so it's economically irrational to render for a deal that isn't closed yet. Chicken-and-egg: can't close without 3D, can't justify 3D before closing.
- Masters do the whole design **on paper**, at the client's home. They've tried various software — **none satisfied** them.
- Clients are **visibly amazed** that masters can't show 3D instantly. It reads as unprofessional.

**So the product that wins is not "the imos of Central Asia for building." It's "the master pulls out a phone, draws the kitchen in 5 minutes while sitting with the client, and the client sees it in 3D — instantly, free, every time."** Closing rate is the value metric, not design time and not price accuracy. A master who closes 9/10 instead of 5/10 nearly doubles revenue — that is a number they feel, and it dwarfs a $10/month fee.

→ **The schoolboy test was right for the wrong reason.** We built "5-minute kitchen" for ease-of-use. Its real value is **"5-minute kitchen *in front of the client*"** — it's a sales-closing instrument, not a design convenience. Reframe everything around the live table moment.

## 4. The two-customer split (this resolves the eccentric tension)

The field data looks contradictory — "masters don't need eccentric" AND "eccentric is our biggest leverage" — until you split the customer:

| | **Master** (mass market, 95%) | **Client / upper market (5%, growing)** |
|---|---|---|
| Pays for | Closing deals → instant 3D | Precision, trust, professionalism |
| Wants from us | Live 3D, fast, free, professional-looking | Cut-ready files, eccentric, verified build |
| Eccentric drilling | **Avoids it** (doubles build time) | **The differentiator** (factory/CNC, premium) |
| Price | Negotiates by hand | Wants accuracy/transparency |
| Build skill | Already excellent, old-way | Needs the engine to guarantee correctness |

**Both are true. They're different buyers.** The mass-market master buys the **front of the product** (3D + speed + professionalism at the table). The upper-market / CNC-factory buyer buys the **back of the product** (verified eccentric output, passports, cut files). One product, two value propositions, sold to two segments at two price points.

## 5. Locked strategic implications

**S1 — Sequence flips at the *surface*, not the *foundation*. The visible V1 is the 3D-design-and-present loop.** Room → generate/place → live 3D the client can see → save/share. The closing instrument ships first and ships beautiful. This is what gets masters paying.

**S2 — The engine (eccentric, joints, passports, cut files) is NOT cut — it's repositioned as the upper-market/premium tier and the moat.** It keeps building underneath on the slow-is-smooth schedule. Reasons it must not be dropped:
1. It's the 5% premium segment and the CNC-dealer partnership (doc 17 / -r1_2) — higher ARPA, the real money.
2. It's the **moat**: anyone can build a 3D toy; the verified-CNC-from-a-phone combination is what no competitor retrofits (doc 16 §5).
3. The market is moving toward it (housing boom → more factories → more CNC). 5% today, more tomorrow.
4. Founder's own MVP bar — the custom G-shape shelf with real cut files — is the upper-tier proof, and it's non-negotiable per the project's core thesis.

**S3 — Professionalism is a feature, and it's cheap to ship.** "Clients suffer from unprofessionals; the market is unclear." Three low-cost trust signals:
- **Instant 3D itself** is the #1 professionalism signal (the amazement reaction).
- **Laser-measure integration** — masters explicitly said laser rules look professional and help close. Worth a research prompt (R-M4): a laser distance meter feeding wall dimensions into the room step, live, at the table.
- **The detailed PDF / Article Passport** (the imos frame-20 doc) — already planned; it's the trust artifact for the client side.
- Possible future: the **"Mebelchi Certified Master"** program (already in strategy) gains a new meaning — a registry that fixes the "unclear market / unprofessionals" pain for clients.

**S4 — Pricing posture: 3D is free and instant; accuracy is opt-in.** Don't force precise pricing on masters who negotiate by hand. Show an approximate range, let them override/hide it. Precise costing + cut files = the upper-tier/CNC feature. (Confirms F2's late-binding price and the per-cabinet cost table as a *premium* output, not a default.)

**S5 — Kromka 1mm is the 99% default** (confirms Abzal: 2mm is premium). Lock `edge_visible_mm: 1.0` as the default; 0.4/0.6 economy; 2.0 premium.

## 6. THE TRAP (supervisor warning — read twice)

The field data will tempt a violent over-correction: *"Masters don't need eccentric → rip out the engine, ship a 3D toy, done."* **Do not.** Three reasons this kills the company:

1. **The 3D toy is not defensible.** Plan-My-Kitchen, Moblo, IKEA, a dozen others do pretty 3D. If V1 is only a presentation toy, the moat is zero and the first well-funded copycat wins. The verified-CNC engine is the *only* thing they can't clone — and the field just confirmed it's also the upper-market revenue. Shipping the toy without the engine underneath is shipping a body with no skeleton.

2. **"Slow is smooth" still holds.** The reframe changes which face the user sees first (3D-present), not the order of construction underneath (engine-first, proven headless). The founder's stated rule — *"I hate redo, I lost what was working"* — applies exactly here: do not tear up the locked architecture because the go-to-market emphasis shifted. The architecture was built precisely so the UI/surface can change without touching the engine. This reframe is the first real test of that separation, and the system passes: **we change the surface, the engine is untouched.**

3. **The two markets share one model.** A 3D view that is *real geometry* (panels, thicknesses, the line/zone model) is the same data that produces cut files. If you build a fake 3D toy now, you throw away the geometry and have to rebuild for the upper tier later — the redo the founder forbade. Build the real model; *render* it for the master, *cut* it for the factory. **Same engine, two outputs.** That is the whole bet, and the field data just made it sharper, not wrong.

**Net:** the reframe is a **positioning and sequencing win, not an architecture change.** Lead with the 3D closing instrument (mass market, the wedge), keep the verified engine building underneath (upper market, the moat). The schoolboy test gets a sharper purpose: *close the deal at the table.*

## 7. Function-map / doc amendments

| Doc | Change |
|---|---|
| 01_STRATEGY / memo | New macro framing (cars→real estate→kitchens); closing-rate (5→9 of 10) as the headline value metric; two-customer split |
| 19_FUNCTION_MAP north-star | Add: *"5-min kitchen IN FRONT OF THE CLIENT"* — live-present mode is a first-class surface, not just edit mode |
| 19_FUNCTION_MAP §2 | New "Present to client" lightweight state (clean 3D, swipe views, hide all editing chrome) — the close moment |
| Pricing | Approximate-range default, hide/override for masters; precise costing = premium/CNC tier (S4) |
| Materials | edge_visible_mm default 1.0 (S5) |
| Roadmap | V1 surface = design+present loop; engine continues headless; eccentric/passports/cut = premium tier gating the CNC partnership |
| 17_CATALOG / -r1_2 | Eccentric/CNC explicitly = upper-market + dealer channel, not mass-market feature |

## 8. New research needed → RESEARCH_PROMPTS_MARKET.md
R-M1 macro (capital rotation, housing starts, kitchen TAM), R-M2 the closing-rate economics, R-M3 competitor 3D-presentation tools in CIS, R-M4 laser-measure integration, R-M5 the "unprofessional market" trust gap + certification models, R-M6 mass vs upper market sizing.
