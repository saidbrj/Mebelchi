# Mebelchi Project Knowledge Base

**Version:** 1.0
**Last updated:** May 2026
**Owner:** Oppoq

---

## What this is

The single source of truth for the Mebelchi project — a mobile-first SaaS that gives small furniture masters in Uzbekistan and the broader "Paper Belt" the same cutting-plan and CNC-file output that Bazis gives big factories, at 1% of the cost.

This is a living project knowledge base. Every strategic and architectural decision lives here. If a decision is not in these documents, it has not been made.

---

## Documents

| File | What it answers |
|---|---|
| `01_STRATEGY.md` | Why mebel, why now, how we win |
| `02_MARKET_AND_MACHINES.md` | The hardware landscape, the Bazis/GibLab dynamic, segmentation |
| `03_PRODUCT_V1.md` | What V1 ships with, what it doesn't, pricing, the sticker traceability play |
| `04_ARCHITECTURE.md` | The 9 modules, data flow, output strategy |
| `05_CONTRACTS.md` | JSON schemas for every data object that crosses module boundaries |
| `06_CONVENTIONS.md` | The sacred rules: Face A/B, transform order, units, tolerance. Never edit without team approval. |
| `07_TEAM_AND_DOD.md` | Roles, Definition of Done, smoke test discipline |
| `08_EXECUTION_30D.md` | The 30-day pre-build plan and first sprint |
| `09_QA_PLAYBOOK.md` | Anticipated investor and operator questions, answered |

---

## How to use this knowledge base

**For Oppoq (orchestration):** Re-read `06_CONVENTIONS.md` before every architectural conversation. It's the file that prevents week-5 disasters.

**For Saidislom (backend):** `04_ARCHITECTURE.md` + `05_CONTRACTS.md` are your daily references. Never modify a schema without bumping its version.

**For Brother (frontend):** `03_PRODUCT_V1.md` defines what users see. `05_CONTRACTS.md` defines what data your forms produce and consume.

**For everyone:** `07_TEAM_AND_DOD.md` is pinned in the team Telegram. Every module must pass the 5-point Definition of Done before being called "done."

---

## Versioning rule

Each document carries a version at the top. Breaking changes (schema edits, contract changes, convention modifications) require:

1. Telegram message to all team members
2. Written approval from at least two of three
3. Version bump
4. Migration notes appended at the bottom of the affected document

This is non-negotiable. Contract drift is how teams end up rebuilding from scratch.
