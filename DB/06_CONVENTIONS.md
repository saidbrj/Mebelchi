# 06 — CONVENTIONS (SACRED)

**Version:** 1.0
**Status:** SACRED. Modifications require all 3 team members to approve in writing.

---

## Why this document exists

This file defines the physical and mathematical conventions every module must obey. Without these locked, three developers building in parallel will use three different reference frames — and the bug will not surface until the first DXF goes to a real CNC machine in week 5.

If you change anything in this file without coordinating, you will silently break the entire pipeline.

---

## 1. Coordinate system

### Part local coordinates
- Origin `(0, 0)` is the **bottom-left corner of Face A**, viewed from outside the cabinet
- X-axis points right (width direction)
- Y-axis points up (height direction)
- All coordinates in millimeters

### Face A / Face B definition (LOCKED)
- **Face A** = visible/exterior side of the cabinet (лицевая сторона)
- **Face B** = hidden/interior side (внутренняя сторона)

For panels with no clear "exterior" (shelves, dividers), pick the face whose grain direction is more important to display. Document this in the cabinet template.

### Sheet coordinates
- Origin `(0, 0)` is the bottom-left corner of the sheet
- X-axis points right
- Y-axis points up
- Sheet dimensions stored as `w_mm` (width, X-direction) and `h_mm` (height, Y-direction)

---

## 2. Transform application order (LOCKED)

When a part is placed on a sheet with `transform: { x_mm, y_mm, rot_deg, mirror }`:

1. **First, rotate** by `rot_deg` counterclockwise around the part's origin `(0, 0)`
2. **Then, translate** to `(x_mm, y_mm)` on the sheet — this is where the part's origin ends up on the sheet
3. **Mirror** is reserved for V2; always `false` in V1

### Worked example

A drill at part-local coordinates `(37, 100)` with `transform: { x_mm: 200, y_mm: 50, rot_deg: 90 }`:

```
x_rotated = 37 * cos(90°) - 100 * sin(90°) = -100
y_rotated = 37 * sin(90°) + 100 * cos(90°) = 37

x_global = 200 + (-100) = 100
y_global = 50 + 37 = 87
```

The drill appears at sheet coordinates `(100, 87)`.

**Test this**: There is a fixture `tests/fixtures/05_transform_drill_check/` with a part containing one drill at known coordinates. Apply each rotation (0, 90, 180, 270). Expected global coordinates are hand-calculated and stored. CI runs this on every commit.

---

## 3. Valid rotation values (LOCKED for V1)

`rot_deg` must be one of: `0`, `90`, `180`, `270`

Arbitrary rotation (e.g., 45°) is not supported in V1. Most real cabinet panels are rectangular and only need orthogonal rotations.

V2 may add 45° and arbitrary angles for diagonal cuts.

---

## 4. Units and precision (LOCKED)

- All linear dimensions: **floats in millimeters**
- Round to **0.1mm** at module boundaries (when JSON crosses between modules)
- Within a single module, work in full precision (no early rounding)
- All angles: **integers in degrees**
- Test comparisons use a **0.05mm tolerance** (i.e., 600.04 and 600.06 are equal in tests)

### Why floats and not integers?
The Optimizer can produce sub-millimeter values from packing math. Forcing everything to integers would lose precision. Rounding only at the boundary keeps modules clean and test-comparable.

---

## 5. Edge banding (LOCKED behavior)

### Storage convention
`Part.shape.w_mm` and `Part.shape.h_mm` are the **final panel size after edge banding is applied**.

### Cut size calculation
For each edge with banding:
- 0.4mm banding → subtract 0.4mm from that edge's dimension
- 2mm banding → subtract 2mm from that edge's dimension
- "none" → no subtraction

### Where the subtraction happens
- **DXF Generator** applies the subtraction when drawing the cut outline
- **Decomposer and Machining Engine** work in final-panel coordinates only

### Worked example
A door panel:
- Final size: `600 × 850 mm`
- Banding: top 2mm, bottom 0.4mm, left 2mm, right 2mm
- Cut size: width = 600 - 2 - 2 = `596 mm`; height = 850 - 2 - 0.4 = `847.6 mm`

The DXF shows the 596 × 847.6 mm rectangle (the actual cut), but the customer quote shows 600 × 850 mm (the delivered panel).

---

## 6. Mirror handling for left/right pairs (LOCKED)

A cabinet has a `left_side` panel and a `right_side` panel. They are mirror images, not copies.

### Decision: **Mirror at the Decomposer**

The Decomposer outputs two distinct Parts. The `right_side` Part's `operations[]` are already mirrored coordinates of the `left_side` Part's operations.

Downstream modules (Optimizer, DXF Generator) treat both parts as independent rectangles with their own operation lists. They never apply mirror logic at draw time. `Placement.mirror` stays `false` in V1.

### Why this way
Each Part becomes a complete, self-contained physical object. Generators stay dumb. The complexity lives in one place: the cabinet template definition.

---

## 7. Material reference (LOCKED)

All references to materials use a string ID that exists in `/data/materials.json`. Examples:

- `"ldsp_18_white"`
- `"mdf_16_natural"`
- `"hdf_3_white"`

No module duplicates material data. No module hardcodes prices or sheet sizes. Every module reads `materials.json` for material details.

Tests use `/tests/fixtures/materials_test.json` with fixed values to isolate from production catalog changes.

---

## 8. ID generation (LOCKED format)

| Object type | ID format | Example |
|---|---|---|
| Cabinet | `cab_<kitchen-slug>_<type>_<seq>` | `cab_karimov2603_base_001` |
| Part | `part_<8 hex chars>` | `part_a8f3c1d2` |
| Operation | `op_<8 hex chars>` | `op_b14fe2a9` |
| Sheet instance | `sheet_<sheet-spec>_<seq>` | `sheet_ldsp_18_white_01` |
| Order | `ord_<customer-slug>_<yyyymm>` | `ord_karimov_202603` |
| Label | `lbl_<part-id-suffix>` | `lbl_a8f3c1d2` |

IDs are generated by the module that creates the object. Once assigned, an ID never changes.

---

## 9. Time and date (LOCKED)

- All timestamps in ISO 8601 with timezone offset: `2026-05-12T14:30:00+05:00`
- Default timezone for Uzbekistan operations: `+05:00` (UTC+5)
- Database stores timestamps as UTC; presentation layer converts

---

## 10. Language and localization (LOCKED)

- User-facing strings stored as i18n keys in `/locales/<lang>.json`
- Default language: Russian (`ru`)
- Required at launch: Russian, Uzbek (Latin script — `uz_Latn`)
- Hardware/material display names are bilingual at minimum

---

## 11. Failure handling (LOCKED policy)

When a module fails (invalid input, optimization timeout, unsupported feature):

- **Never silently degrade.** Return an explicit error.
- **Error format**: `{ "error": { "code": "OPTIMIZER_GRAIN_INFEASIBLE", "message_ru": "...", "message_uz": "...", "details": {...} } }`
- **Error codes** are uppercase snake_case, namespaced by module: `DECOMPOSER_*`, `MACHINING_*`, `OPTIMIZER_*`, `DXF_*`, etc.
- **Frontend shows the user-facing message** in their language; backend logs the full error with stack trace.

---

## 12. Schema versioning (LOCKED)

Per `04_ARCHITECTURE.md`:

- Every schema carries `contract_version` field at top level
- Major version bump on breaking changes
- Minor version bump on backward-compatible additions
- Patch version bump on clarifications without data shape change
- All changes require migration script in `/migrations/`

---

## Modification protocol

This document is sacred. To change anything in it:

1. Open a Telegram message to the team: "Proposing change to CONVENTIONS.md, section N: [reason]"
2. Get explicit "yes" from at least two other team members
3. Update the document, increment its version number
4. Append change note at the bottom of this file
5. Update all affected schemas, fixtures, and code in the same PR
6. CI must pass before merge

If you skip these steps and break a convention silently, the entire pipeline can fail in production. There is no good reason to skip these steps.

---

## Change log

- v1.0 — Initial lock. May 2026.
