# 07 — Team, Roles, and Definition of Done

**Version:** 1.0

---

## The team

### Oppoq — Founder, Orchestrator, Architecture, Brand
**Responsibility**: Everything. Final accountability for product, team, money.
**Hands-on work**: Modules 1 (Cabinet Templates), 3 (Machining Engine), 5 (DXF Generator), 7 (Label Generator). Brand identity, brand assets, customer-facing PDFs.
**Mode**: Architect-orchestrator. Writes Python where needed (especially DXF generation and label design). Reviews all schemas before merge. Owns the relationship with the Romchi CTO mentor.

### Saidislom — Backend Engineer
**Responsibility**: API plumbing, database, optimization, BoM/pricing.
**Hands-on work**: Modules 2 (Decomposer), 4 (Optimizer), 8 (BoM + Pricing), and API layer of Module 9.
**Stack**: Python FastAPI, PostgreSQL, OR-Tools / rectpack.

### Brother — Frontend Engineer
**Responsibility**: Everything users see and touch.
**Hands-on work**: Module 6 (PDF Cut Map), all of Module 9's frontend, the 3D preview, the input forms, the station-scan UI for operators.
**Stack**: Flutter (mobile + web), Three.js for 3D preview.
**Existing work**: 3D preview prototype + working DXF generator prototype. Both stay outside "done" pile until they read/write locked contracts.

### Romchi CTO — Mentor (paid weekly)
**Responsibility**: Architecture review, technical mentorship, hard-problem unblocking.
**Engagement**: Weekly 1-hour call ($200 retainer). Specific topics per `01_STRATEGY.md`: supplier B2B playbook, Telegram growth, payments infrastructure, data model, marketplace failure post-mortem, server stickiness, cross-border payments.
**Bonus engagement**: Weekly code review with Brother and Saidislom for first 3 months.

### Factory friend — Advisor (after 30-day evaluation)
**Responsibility**: Domain authority, master interviews, sample Bazis files, supplier introductions.
**Engagement**: 1–2% advisor equity vesting over 24 months. Test for 6 months. Upgrade to co-founder territory only if commitment and value demonstrated.

---

## Definition of Done (THE DISCIPLINE)

A module is **done** only when ALL five conditions are true. Until they are, the module is a "prototype" and cannot be relied on by other modules.

### The five conditions

1. **Schema published** in `/contracts/*.schema.json`. Both input and output shapes specified.
2. **Fixtures saved** in `/tests/fixtures/<module>/`. Minimum 3 known-good input/output pairs as JSON files.
3. **Unit tests passing.** A test file (`tests/test_<module>.py`) that runs each fixture through the module and verifies the output matches the saved expected output.
4. **Smoke test passing.** The end-to-end pipeline (Module 1 → Module 9, full output set) runs cleanly on at least 1 sample cabinet.
5. **Code reviewed** by one other team member. Minimum 10-minute Telegram screen-share. Catches 80% of "future bugs" before they exist.

### Why the discipline matters

Without it, three people working in parallel produces:
- Saidislom finishes Module 4 with one assumption about coordinate origin
- Oppoq finishes Module 5 with a different assumption
- The bug doesn't surface until the DXF goes to a CNC machine in month 4
- Time to fix: a week, including emergency calls and Telegram fights
- Time to prevent with DoD: 30 minutes of review

The Definition of Done is the single most important agreement on this team.

---

## The smoke test (the heartbeat)

`tests/smoke_test.py` runs the complete pipeline on one fixture cabinet and verifies all outputs.

### What it tests
1. Cabinet template → CabinetSpec produced
2. Decomposer → RawParts produced, schema validates
3. Machining Engine → MachinedParts with operations, schema validates
4. Optimizer → CutLayout with placements, schema validates, waste < 30%
5. DXF Generator → DXF file produced, opens in FreeCAD (or `ezdxf.readfile` succeeds without errors)
6. PDF Generator → PDF produced, page count correct
7. Label Generator → labels produced, count equals part count
8. BoM Generator → priced BoM produced, total > 0

### When it runs
- On every commit (CI)
- Before any merge to main
- Before any demo

### When it fails
- All work stops until it passes again
- One day of broken smoke test = acceptable
- One week = code emergency
- One month = team is vibe-coding, escalate to architecture review

---

## Daily and weekly workflow

### Daily
- Each developer commits at least once per day
- Each commit triggers CI: schema validation + smoke test
- Failed CI = stop, fix, then continue

### Weekly (Friday demo)
- Each team member shows what they shipped this week
- Smoke test runs live during the demo
- Factory friend invited to demo if relevant deliverable was shipped
- Next week's deliverables locked at end of demo

### Monthly (architecture review)
- Romchi CTO joins
- Review: what worked, what didn't, what needs schema changes
- Any proposed CONVENTIONS.md changes voted here

---

## Communication conventions

### Telegram channels
- `mebelchi_general`: All team, all discussion
- `mebelchi_commits`: CI bot posts every commit + smoke test status
- `mebelchi_escalation`: Only for things that block production or partners

### Decision protocol
- Architecture decisions: documented in `/decisions/YYYY-MM-DD_<topic>.md` (ADR format)
- Contract changes: per protocol in `06_CONVENTIONS.md`
- Hires, equity, money: Oppoq decides, communicates after

### Code review
- Every PR needs one reviewer's approval
- For modules touching `06_CONVENTIONS.md` content: two approvals
- Reviews can be async on GitHub or live on Telegram screen-share

---

## Equity (placeholder — finalize with lawyer)

Working assumptions to be formalized:

| Role | Equity |
|---|---|
| Oppoq (founder, full-time) | 60–65% |
| Saidislom (early engineer, full-time) | 8–12% |
| Brother (early engineer, full-time) | 8–12% |
| Factory friend (advisor, ramping to co-founder) | 1–2% advisor, can rise to 5–10% if upgrade |
| Romchi CTO mentor | 0.5–1% |
| Future hires pool | 10% |

All equity subject to 4-year vesting with 1-year cliff. Founder included.

Lock these numbers in a written agreement before month 3.

---

## What every team member must own

- **Their module's schema** — they wrote it, they defend it
- **Their module's fixtures** — they cover their own edge cases
- **Their module's failure modes** — they know what can go wrong, they handle errors gracefully
- **Their module's documentation** — README in the module folder, kept current
- **Their commits** — atomic, with clear messages, reviewed before merge

What nobody owns alone:
- `CONVENTIONS.md` — shared sacred file
- Smoke test — shared, breaks everyone equally
- Production deployment — Oppoq coordinates, all team approves

---

## The first hire (after V1 ships)

The first non-founder hire should be a **mebelchi domain expert**, not another engineer. Specifically:

- 5–10 years running a furniture shop in Tashkent or Samarkand
- Bilingual Uzbek + Russian
- Comfortable with Telegram and basic tablet usage
- Hired to run customer success, supplier outreach, and demo training
- Salary: $1,500–2,500/month + 1–2% equity

This person is the link between the product and the market. Without this hire by month 6, founder-market fit erodes.
