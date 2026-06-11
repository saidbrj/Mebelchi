# 04 — Architecture

**Version:** 1.0

---

## The principle

Modular architecture with locked contracts. Each module has one job, one owner, one input contract, one output contract. Modules communicate through JSON. A module is replaceable without breaking others as long as it honors the contract.

The opposite is "vibe code": everything tangled, every bug requires a rebuild from scratch. We do not write vibe code.

---

## The 9 modules

| # | Module | Owner | Input | Output |
|---|---|---|---|---|
| 1 | **Cabinet Templates** | Oppoq | User-friendly dimensions (kitchen layout, cabinet count, sizes) | `CabinetSpec[]` |
| 2 | **Decomposer** | Saidislom | `CabinetSpec` | `RawParts[]` (panels with edges, grain, NO operations yet) |
| 3 | **Machining Engine** | Oppoq | `Cabinet + RawParts` | `MachinedParts[]` (panels with `operations[]`) + `HardwareBOM[]` |
| 4 | **Optimizer (Nesting)** | Saidislom | `MachinedParts + SheetSpec[]` | `CutLayout` (placements + transforms, respects grain) |
| 5 | **DXF Generator** | Oppoq (refactor of brother's prototype) | `MachinedParts + CutLayout` | DXF file with layered geometry |
| 6 | **PDF Cut Map Generator** | Brother | `CutLayout` | A4 PDF cut map for manual operators |
| 7 | **Label Generator** | Oppoq | `MachinedParts` | Thermal-printable label PDFs (QR + diagrams) |
| 8 | **BoM + Pricing** | Saidislom | `HardwareBOM + MachinedParts + materials.json` | Priced bill of materials, customer quote PDF |
| 9 | **API + Frontend** | Brother + Saidislom | HTTP requests | Frontend renders inputs/outputs; backend routes |

**Critical**: Modules 5, 6, 7, 8 are parallel outputs. They all consume the same upstream pipeline. Adding a new output (CSV for beam saws, ESC/POS for label printers, etc.) is a new module — never a change to upstream modules.

---

## Data flow

```
User input (Frontend)
        ↓
Module 1: Cabinet Templates
        ↓ CabinetSpec[]
Module 2: Decomposer
        ↓ RawParts[]
Module 3: Machining Engine
        ↓ MachinedParts[] + HardwareBOM[]
Module 4: Optimizer
        ↓ CutLayout
        ↓
   ┌────┴────┬────────┬─────────┐
   ↓         ↓        ↓         ↓
Module 5  Module 6  Module 7  Module 8
DXF       PDF map   Labels    BoM/Quote
```

The horizontal cut at the bottom — DXF, PDF, Labels, BoM/Quote — is the "contract bus." All four read the same `MachinedParts + CutLayout` data. None of them depend on each other.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Flutter | Cross-platform mobile + web from one codebase. Telegram Mini App later. |
| Backend API | Python FastAPI | Pairs naturally with optimization libraries. Easy to learn. |
| Database | PostgreSQL | Standard, reliable, supports JSON columns for flexible part data. |
| Optimization engine | Python + OR-Tools / rectpack | Open-source, well-documented, handles 2D bin packing + grain constraints. |
| CNC output | Python ezdxf library | Industry standard for DXF generation. Brother's prototype uses this. |
| Label printing | Python ReportLab (PDF) + python-escpos (direct thermal) | Standard libraries, low complexity. |
| Auth | Telegram OTP login | One-tap, no SMS cost, perfect for our audience. |
| Payments | Click + Payme integration | Standard Uzbekistan rails. Romchi CTO has done this — get the boilerplate. |
| Hosting | DigitalOcean droplet (start) → AWS/GCP later | Cheap to start ($6/month), easy to migrate when scale demands. |
| CI/CD | GitHub Actions | Free for small teams, runs schema validation on every commit. |

---

## The output strategy (locked)

Per `02_MARKET_AND_MACHINES.md`:

- **Manual saw users** → PDF cut map (Module 6)
- **Nesting CNC users (Excitech, KDT, Nanxing)** → DXF with drill layers (Module 5)
- **All users** → Thermal labels for traceability (Module 7)
- **Beam saw users (deferred to V1.5)** → CSV/XML cut list (new module)
- **Homag proprietary formats (.mpr, .saw)** → NEVER

We generate the universal language. Factory CAM software (NC Studio, GibLab) handles machine-specific translation.

---

## DXF layer convention (locked)

The DXF Generator outputs geometry on these layers. CAM software at the factory uses layer names to drive specific operations:

| Layer name | Geometry | Purpose |
|---|---|---|
| `OUTLINE` | Panel outline polylines | Cutting path |
| `DRILL_5MM` | Circles, diameter 5mm | Dowel holes |
| `DRILL_8MM` | Circles, diameter 8mm | Confirmat / Eurobolt holes |
| `DRILL_15MM` | Circles, diameter 15mm | Standard shelf supports |
| `DRILL_35MM` | Circles, diameter 35mm | Hinge cup holes |
| `GROOVE_4MM` | Polylines | Back panel grooves |
| `LABEL` | Text | Panel name, dimensions (printed for human reference) |

Any operation type added later (pockets, slot, miter) gets its own layer. Operators (and CAM software) read layers like a coloring book.

---

## Brother's prototype status

Brother already vibe-coded:
- A 3D preview component (Three.js / Flutter)
- A working DXF generator that produces a real file readable by FreeCAD

**Status**: Prototype, not done.

**Path to "done"**:
1. Refactor DXF generator to read `MachinedParts + CutLayout` from the locked schema (currently uses ad-hoc data structures)
2. Apply the transform pipeline correctly per `06_CONVENTIONS.md`
3. Pass 3 fixture tests
4. Pass the smoke test
5. Get a code review

Estimated effort: 1–2 weeks. Brother's code is the starting point. We do not throw it away.

The 3D preview stays in Frontend (Module 9) as a "preview-only" feature. It does NOT generate manufacturing geometry — see Frontend principle below.

---

## Frontend principle

The Frontend may contain **preview rendering logic** (fast 3D box/2D sketch using Three.js) so users see immediate feedback when they change dimensions. The preview reads input dimensions only.

The Frontend may NOT contain **manufacturing truth**: no edge banding math, no drill patterns, no nesting, no pricing rules, no operation generation. That all lives in the backend modules.

This is the line that prevents UX bugs from corrupting production output.

**Rule of thumb**: if the user can see it but the CNC machine can't act on it, it's preview. If a single millimeter wrong would cause a scrapped panel, it's production — and lives server-side.

---

## Versioning and migration

Every schema file carries `contract_version`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Part",
  "contract_version": "1.0.0",
  ...
}
```

Breaking changes require:
1. Major version bump (1.0.0 → 2.0.0)
2. Migration script in `/migrations/` that converts v1 fixtures to v2
3. All other modules updated within the same PR
4. CI passes on all fixtures, old and new

Non-breaking additions (new optional field) require minor bump (1.0.0 → 1.1.0). Backward-compatible. Old fixtures still validate.
