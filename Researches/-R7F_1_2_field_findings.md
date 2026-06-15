# -rF_1_2 — Field Findings: Constructor Speed & The Decor Decoupling

**Date:** June 13, 2026
**Sources:** F1 — founder observed the constructor working in Bazis; throughput data from Eman Materials. F2 — Eman Materials decor consultation process, showroom of 1000s of facades.

---

## F1 — The bottleneck, quantified

| Metric | Value |
|---|---|
| Bazis, kitchen with client | **0.5–1 working day** ("almost hand drawing, everything by hand") |
| Constructor throughput (Eman Materials) | **1 client per day** |
| Waitlist | **1.5 months** |
| Theoretical fastest in Bazis | ~2 hours |
| imos iX, same kitchen | **~25 minutes** |
| **Mebelchi target (standard kitchen)** | **≤5 min room → confirmed layout (schoolboy test, already locked) · ≤15 min → cut files + passports, same sitting** |

### Interpretation

**I1. The market's constraint is design throughput, not demand and not CNC capacity.** A 1.5-month waitlist is deferred revenue sitting in a queue behind one human. This reframes the entire pitch — to factories, dealers, and investors: *«Спрос есть. Станки есть. Узкое место — конструктор.»* Mebelchi doesn't make the constructor faster; it removes the constructor from the standard 80% of orders entirely — the master designs at the client's home during the measurement visit and closes the same day. → This number goes into MEBELCHI_STRATEGIC_MEMO and the dealer deck.

**I2. Why we are faster than imos (the mechanism, not bravado):**
1. **Generation replaces placement.** imos is still unit-by-unit placement (founder's own screenshots 5–6: one article at a time, typed coordinates). Phase A→B generates 4 complete manufacturable kitchens from room + constraints; the user confirms, not assembles.
2. **Defaults replace decisions.** Joint intelligence (doc 16), auto-fillers, auto-continuous elements (plinth/worktop), ergonomic defaults — every decision the engine makes is a minute the user doesn't spend. imos asks; we decide with override.
3. **Decor leaves the critical path entirely** (see F2). The 2-hour facade consultation no longer blocks design completion.

**Caveats (honesty discipline):** imos's 25 min is a trained operator; our ≤15 min claim is for the *standard* kitchen by the *master himself* — different and better category, but it remains a target, not a fact, until Types 3–4 round-trip and the joint resolver replays ≥95%. Custom master-tier work will and should take longer.

**I3. "Learn nothing from Bazis" — with one protection.** Agreed in full on UX: nothing to copy. But keep the two things Bazis still gives us: (a) **the constructor's decisions** — his historical exports remain doc-16 Source A gold; the tool is a nightmare, the decisions inside the files are the brain we're mining; (b) **the vocabulary** (секция, сдвинуть панель) for familiarity. Also a flag for our research hygiene: R-U1 documented Bazis-Шкаф's parametric *capability*; F1 shows the constructor's *practice* is largely manual Мебельщик drawing. Incumbent capability ≠ incumbent practice — the practice is even weaker than the datasheet, which widens our opening.

---

## F2 — Decor is a separate business process. Decouple it.

**Field facts:** facade/decor selection at Eman Materials is a dedicated **2-hour consultation** with a specialist, in a **showroom of 1000s of facades**, and it is fundamentally a **price negotiation** ("the golden ratio" of look vs cost). It happens with physical samples — a phone screen cannot honestly render 1000 decors, and shouldn't try.

### Locked decisions

**D1 — Decor is late-binding. Geometry first, paint later.**
- V1 facades = **slab fronts only**, basic palette (~6 colors) serving visualization + approximate pricing. imos's 12-front-type chooser (screenshot 4) is exactly what we do NOT put in front of the user.
- The project's carcass and cut data are decor-independent; facade material is a **slot bound later** without touching geometry. Price ticker shows state honestly: exact for carcass + hardware + work, facades marked «фасады: базовые» until bound; binding updates the price.
- Constitution addition to the hard-no list: front-type and decor pickers in the design flow.

**D2 — NEW output artifact: «Лист фасадов» (Facade Schedule).**
The bridge to the existing showroom process: per-front list (count, W×H, m², edge meters, handle positions) the client takes to the decor consultant. The consultant binds the decor; the price finalizes. We don't replace their 2-hour ritual in V1 — we hand it a perfect input document and stay the system of record. Nearly free from engine data, same family as the Article Passport.

**D3 — Appliances ARE the layout. They move to Phase A constraints.**
The choices that genuinely change geometry and price, each with отдельно/встроенный fork (integrated is significantly more expensive in UZ — both options mandatory):
1. Холодильник — отдельностоящий (default, market-dominant) / встроенный (housing unit)
2. Варочная панель + духовка — отдельная плита / встроенные
3. Вытяжка — купольная / встроенная в верхний шкаф (affects upper row)
4. Микроволновка — на столешнице / в нише / встроенная
5. Посудомойка — нет / 45 / 60 (встройка)
Each answer = generated-variant consequence (housing units, gaps, upper-row breaks) + visible price delta hint. Defaults = the cheap freestanding configuration; integrated as explicit upgrade.

**D4 — The decor catalog is V2, and it's already designed.** The consultant's 2-hour "golden ratio" search is a filter-by-budget UX over a decor catalog with live supplier prices — exactly doc 17's supplier-listing business. Park it: V1 integrates with the showroom (D2); V2 compresses the consultation in-app with Egger/Kronospan/local packs. Do not build now; the catalog architecture already accommodates it.

---

## Function map amendments (v0.21 → v0.22)

| § | Change |
|---|---|
| §2-A | Phase A constraints = room + **appliance set with отдельно/встроенный forks** (D3); decor explicitly OUT of setup |
| §2-E | Decor = late-binding slot; price ticker carries «фасады: базовые» state; front type fixed to slab in V1 (D1) |
| §2-I | **NEW output: Facade Schedule** alongside Article Passport (D2); per-article cost table already locked |
| §6 hard-no | + persistent or in-flow decor/front-type pickers |
| North-star metrics | Schoolboy ≤5 min (unchanged) · **standard kitchen → files ≤15 min** (F1) |

## Open

Confirm the appliance list with the factory friend (anything else that bends layout — стиральная машина в кухне? газ vs индукция clearances?). The 1.5-month-waitlist figure: get permission to cite Eman Materials in the memo, or anonymize as «крупный салон в Ташкенте».
