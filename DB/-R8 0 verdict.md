# -rR8_0 — Market Research Verdict & The 3D-First / Marketplace Ruling

**Date:** June 14, 2026
**Input:** -r8_Market_Home (data brief: macro/TAM + close-rate evidence) and -r8_Market_Debated (hostile red-teams of the macro thesis AND of mobile-first CAD).
**Founder direction to rule on:** (1) 3D-first, smoothest/most-advanced mobile 3D; (2) a **marketplace** of two kinds — user-built *sections* shared like watch faces, and one level down, user-built or sponsored *accessories* as a paid/sponsored leverage.
**Rule applied:** the red-team corrections override the optimistic brief wherever they're better-argued. They mostly are. But the mobile-CAD attack has a fatal tell (§4) we exploit.

---

## 1. The two things the research proves beyond doubt

**PROVEN 1 — The close-rate value is real and well-evidenced.** This underwrites the entire pitch. Convergent, multi-source, multiple industries:
- Cyncly/Cabinet Vision (n=340+): point-of-sale instant rendering vs render-after-quote → close **47% vs 34%**, time-to-order **11 vs 21 days**.
- KBB UK (n=156): ~22% close lift, cycle 28→19.5 days.
- Salesforce/Threekit automotive **A/B (randomized)** → **41% vs 29%**, the one true controlled study.
- megaplan.ru CRM (the CIS-local data): same-day quote+visual **42%** vs next-day office **23%** = **19-point** lift.
- Unit economics: speculative rendering = $56/closed deal; instant 3D = ~$0 marginal. Even a 5-point lift beats speculative.

**Founder's field number (5→9 of 10) is optimistic but directionally backed.** Defensible claim for the deck: *"instant point-of-sale 3D lifts close rates 15–20% (relative), compresses the sale from weeks to same-day; CIS retail data shows a 19-point swing."* Use the conservative figure; cite the 19-point megaplan datum as the local proof. Don't claim 5→9 as fact — claim it as the founder's field observation alongside the cited range.

**PROVEN 2 — Custom-build / eccentric is NOT the mass market.** The TAM red-team confirms -rF_4: the $200–300/m² segment is largely Chinese flat-pack + cash + informal, NOT the SaaS market. This is now triple-confirmed (Abzal, the masters, the red-team). Locks the two-customer split harder.

---

## 2. The TAM correction (use these numbers, retire the old ones)

The hostile review is right and we adopt its honesty. The headline housing→kitchen TAM is a **10-year ceiling**, not a near-term number. The funnel:

housing completions → minus investor-held empties, minus state pre-fitted (Arzon Uy ~18–22k/yr), minus 12–36mo occupancy delay, minus ~55% flat-pack choosers, minus ~50% cash-informal, minus non-digital → **~10,000–11,400 digitally-addressable kitchen events/year nationally** today.

**The only Year-1 metric that matters (adopt verbatim):** *number of Tashkent workshops with a registered entity + bank account + active Instagram, already pricing >$200/linear metre.* Estimated **800–1,400 today**; defensible platform scale at **3,000+**. This is the supply-side market. Every housing statistic above it is narrative.

→ Investment memo correction: lead with the **800–1,400 digitally-ready workshops** and the **close-rate value per workshop**, not the $240M. The honest GMV path (Y1–3) is single-digit millions, not tens. An operator-investor who knows Central Asia will respect the decomposition and distrust the $240M.

**Macro still survives as tailwind, not thesis:** propiska removal is irreversible; 10–15% annual growth in kitchen events is real and durable; premium + B2B/developer channels are platform-addressable *now*. The boom is the wind, not the boat.

---

## 3. The dangers the red-team surfaces (must be in the strategy, not hidden)

| Threat | Implication for us |
|---|---|
| **Chinese flat-pack owns the cheap segment** | Do NOT chase $200–300/m². It's commoditized, no intermediary, no app. Our mass-market user is the *master who sells against/above flat-pack with custom*, not the flat-pack buyer. |
| **Shadow economy / cash / tax-fear** | A *transaction* platform (take-rate, formal payments) will hit the informality wall — UrbanClap, Homzmart, Egypt all bled here. **Implication: we are a TOOL the master pays for (subscription), NOT a marketplace that intermediates his client payments.** This is decisive for the marketplace question — see §5. |
| **79% referral discovery** | Client-discovery marketplaces fail; the trust channel is the mahalla. So our "marketplace" must NOT be a lead-gen/discovery play. |
| **Comparable graveyards** | UrbanClap (vertically integrated, still unprofitable), Homzmart (pivoted to B2B), Planoplan/Astra/Woody mobile (viewers, not editors). Every transaction-marketplace-on-informal-trade died or pivoted. |

---

## 4. The mobile-CAD attack — where it's right, and its fatal tell

The "mobile-first CAD is a death trap" assault is the most useful document in the pack because **most of it is correct and we must obey it** — but its central conclusion contains a tell that is *our entire opening*.

**What the attack gets RIGHT (obey all of these — they're now engine/UI law):**
- **Real-time CSG on a budget phone is too slow** (180–420ms per hinge hole; 5s stutter for a cabinet). → We must **never do boolean geometry on device.** Confirmed by our own architecture: the engine works by *parametric rule evaluation*, not CSG, and drilling is *coordinates*, not cut meshes. The phone renders boxes + decals, never booleans. Doc-13 already mandates this; the attack just proved why it's existential.
- **Full geometry rebuild on every parametric tick kills FPS.** → Confirms `solvePreview`/`solveFull` split (doc 13) and the doc-18 budget (≤4ms gesture tick). The attack's "2-3s stutter" is exactly what those budgets exist to forbid. We don't rebuild meshes on width change — we move instanced parts.
- **Arbitrary numeric precision via fat-finger drag fails** (±6–8mm). → Confirms R-U4 **type-first** lock (numpad, expressions) and the 50mm detented drag. The attack independently re-derived our locked decision.
- **Photoreal path-traced rendering on device is impossible** (8–15 min, battery death). → We do **real-time PBR preview, not path-tracing.** Pre-baked lighting where needed. "Smoothest 3D" ≠ "photorealistic render" — see §6.

**The fatal tell:** the attack's benchmarks assume **Bazis's architecture ported to mobile** — runtime CSG, per-tick rebuilds, 70k-triangle scenes with 2K textures, on-device path-tracing. **That is the wrong architecture, and it's the one we deliberately rejected eighteen months ago.** Its own recommended "hybrid" (desktop Bazis + mobile viewer + discrete 100mm steps + server render) is a **confession**: it proves a *smooth, fast, parametric mobile experience is achievable* — it just assumes you must keep the desktop CAD and pre-bake everything because it can't imagine a phone-native parametric engine that avoids CSG.

**We are exactly that engine.** Our differentiator vs every product in the attack's graveyard:
1. We don't port desktop CAD; we built a phone-native rule engine (no CSG, no rebuild, instanced geometry, mm10 integers).
2. We don't do "discrete 100mm steps only" (the attack's mobile ceiling) — we do real parametric values via **type-first numpad** (precision the attack admits the numpad delivers at ±0mm) + **50mm detented drag** for coarse. We get *both* precision and touch-speed, because we separated them by gesture instead of forcing one input to do both.
3. We don't need a server to render or compute — but we *can* use one as an accelerator for the optional photoreal final render (the $17 render becomes a server job, only for closed deals), exactly as the attack's Tier 3 suggests.

**Net ruling on mobile-CAD:** the attack is a gift. **Adopt every performance constraint as binding law; reject the "therefore keep desktop CAD" conclusion** because it's predicated on the architecture we already abandoned. Our headless-engine-first discipline (the thing the founder insisted on) is precisely what immunizes us against the graveyard. We must *prove this on the floor device early* (doc 18) — if a real G-shape kitchen doesn't hold 30fps on a $150 Mali phone, the attack wins and we revisit. That on-device proof is now a **gate**, not an aspiration.

---

## 5. RULING on the marketplace vision (the hard one)

The founder wants two marketplaces: (A) shared user **sections** (watch-faces model), (B) per-**accessory** sharing + **sponsored** accessories as revenue leverage. The research says: **yes to both — but ONLY as a content/tool marketplace, NEVER as a transaction/discovery marketplace.** The distinction is the difference between a moat and a graveyard.

**Why the framing matters (from §3):** every furniture *transaction* marketplace on an informal, cash, referral-driven market died or pivoted (UrbanClap, Homzmart). The killers were: intermediating cash payments (tax-fear churn), and trying to displace the 79% referral channel (discovery doesn't work). **Our marketplaces touch neither.** They trade *design content between masters*, and *accessory exposure between brands and masters* — not client money, not client leads.

**A — Section marketplace (watch-faces model): STRONG YES.** This is a genuine moat the attack's graveyard never had:
- It's a **content network effect on the supply side** (masters), not a discovery play on the demand side (clients). Masters share/clone/sell section templates (the doc-17 §library, R-U2's 3-noun model already supports this — Section Template is already a first-class entity).
- It deepens lock-in: a master's own library + the community library makes switching cost real. This is what Figma's community plugins/components did — and it's defensible in a way "pretty 3D" is not.
- It directly attacks the "unprofessional market" pain (-rF_4 S3): curated, rated, tested community sections raise the floor for everyone.
- **Engine reality:** a shared section is *parametric rules + geometry*, the same data the engine already produces. Sharing it is cheap. It rides the existing architecture with zero new risk.
- **Guardrail (non-negotiable):** every shared section must pass the doc-20 invariants + manufacturing gate before it can be published or cut. A community section that drills through a panel is the same company-ending risk as any other output. **"Sandbox inside, gates at the exit" applies to the marketplace too** — anyone can build/share, nothing manufacturable ships ungated. This is also a *quality* differentiator: "every Mebelchi community section is verified-manufacturable" is a claim no open marketplace can make.

**B — Accessory layer + sponsorship: YES, and it's the cleaner revenue than subscription-only.** This is the doc-17 supplier-listing business, sharpened by the founder's instinct:
- Going "one level down" to per-accessory is correct: accessories (hinges, slides, lifts, handles, lights, organizers) are exactly where brands (GTV/Hettich/Blum/Boyard) *want* placement and where they publish CAD + media (doc-17 Amendment A: GTV B2B data API). The accessory slot is the natural ad unit.
- **"Show their advantages" is the honest, high-value form of sponsorship:** when a master designs a drawer, a sponsored Blum slide can *demonstrate* its soft-close/load advantage in the 3D view — that's product education, not a banner. This is native, useful, and the brand pays for *demonstrated capability*, not impressions.
- This monetizes the **mass-market 95%** without forcing eccentric on them or intermediating their client cash: the master uses free/cheap design+3D; the *accessory brands* pay for placement and demonstrated advantage. The take-rate comes from the **hardware supply chain** (whoever owns the fittings list owns the purchase order — doc-17 §4), not from the master's customer.
- **Guardrail:** sponsored ≠ default-distorting. A sponsored accessory may be *surfaced/demonstrated*, but the engine's correctness, the joint resolver, and the physics gate are never biased by sponsorship. Ad-integrity rule, written now: **sponsorship can change what's shown, never what's structurally chosen or how it's priced for manufacturing.**

**What the marketplace is NOT (write this in the constitution):**
- NOT a place clients discover masters (referral channel wins; discovery marketplaces died).
- NOT a payment intermediary between master and client (cash/tax-fear kills it).
- NOT a lead-gen take-rate on furniture sales (the Homzmart/UrbanClap grave).
It is: a **supply-side content marketplace** (sections, master-to-master) + a **hardware-brand placement marketplace** (accessories, brand-to-master). Both ride the existing engine; neither touches the informality wall.

---

## 6. "3D-first, smoothest, most advanced" — what that must and must NOT mean

The founder's 3D-first direction is correct and now *validated by the close-rate evidence* (the 3D view IS the product wedge). But the mobile-CAD attack defines the rails:

**MUST mean:**
- Instant, real-time, **butter-smooth interaction** (30fps+ on the $150 floor device) — achieved by no-CSG, instanced geometry, preview/full split, type-first input. Smoothness comes from *architecture*, not from a beefier phone.
- **Real-time PBR preview** that looks clean and professional (the "amazement" reaction) — good materials, baked/cheap lighting, LOD. Not blurry (the attack's "почему размыто?" failure), not path-traced.
- The 3D *is* the UI (the whole 10_UI_PRINCIPLES thesis), and the 3D *is* the sales instrument (close-rate evidence).

**MUST NOT mean:**
- Photorealistic on-device path-tracing (impossible; battery death). Photoreal = optional **server render** for the closed deal (the $17 render, now ~$0 marginal and only-on-close).
- Runtime CSG / boolean cutting on device (5s stutter). Holes are decals/coordinates, not mesh subtractions.
- Arbitrary precision by drag (±8mm). Precision = numpad; drag = coarse 50mm.

**The on-device performance proof is now a hard gate** (doc 18): buy two floor devices, prove a real G-shape kitchen holds the frame budget *before* committing the UI build. If it can't, the attack was right and we adjust scope. Everything rides on this being true — and our architecture was chosen precisely to make it true.

---

## 7. Amendments

| Doc | Change |
|---|---|
| 01_STRATEGY / investment memo | Replace $240M-near-term with: 800–1,400 digitally-ready workshops (Day-1 supply market), 3,000+ = scale; close-rate value (15–20%, 19-pt CIS datum) as the core unit; macro = tailwind not thesis |
| 01_STRATEGY | Positioning: NOT the cheap/flat-pack segment; the master who sells custom *above* flat-pack. Tool (subscription) + content marketplace + hardware-placement, NEVER transaction/discovery marketplace |
| NEW 21_MARKETPLACE.md | The two marketplaces (sections: supply-side content; accessories: brand placement + demonstrated-advantage sponsorship), with the gate guardrail and the ad-integrity rule |
| 17_CATALOG | Accessory layer = the ad unit; sponsored = surfaced/demonstrated, never structurally biasing; hardware-list ownership = the take-rate |
| 18_PERFORMANCE | On-device floor-device proof of a real G-shape kitchen at ≥30fps = a hard gate before UI build commit |
| 13/UI law | Reaffirm: no on-device CSG; holes = coordinates/decals; preview/full split; type-first precision — now justified by the mobile-CAD red-team |
| 10_UI_PRINCIPLES | Add: "3D-first" has a definition (smooth real-time PBR preview, not photoreal/CSG); photoreal is an optional server render on closed deals |
| 20_INVARIANTS | Marketplace sections must pass full invariant + manufacturing gate before publish/cut |

## 8. New research / validation queue
- **R-M7 (highest):** floor-device benchmark — build the doc-18 bench, prove a G-shape kitchen at ≥30fps on a real $150 Mali phone. This is the single gate the whole 3D-first bet rests on.
- R-M8: section-marketplace precedents that worked on supply-side content (Figma community, watch-face stores, Roblox UGC economics) — pricing/curation/revenue-share model.
- R-M9: hardware-brand placement economics — what GTV/Hettich/Blum pay for demonstrated placement; the GTV B2B API access path (doc-17 Amendment A).
- R-M10: the 800–1,400 number, verified — Uzexpocentre exhibitor list × Instagram cross-reference, to size Day-1 supply precisely.
