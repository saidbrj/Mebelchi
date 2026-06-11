# 05 — Contracts and Schemas

**Version:** 1.0
**Sacred file:** This is the contract between modules. Do not modify without team approval and migration plan.

---

## The principle

Every data object that crosses a module boundary has a locked JSON schema. Modules read inputs against the schema. Modules produce outputs that validate against the schema. CI checks this on every commit.

Schemas live in `/contracts/*.schema.json` as JSON Schema (draft-07) files. This document is the human-readable companion.

---

## CabinetSpec

User-level description of one cabinet, before any production processing.

```json
{
  "id": "cab_kitchen1_base_001",
  "kitchen_id": "kitchen_karimov_2026_03",
  "type": "base",
  "subtype": "drawer_column",
  "position": "Низ-1",
  "width_mm": 600,
  "height_mm": 850,
  "depth_mm": 600,
  "shelves": 0,
  "drawers": 3,
  "doors": 0,
  "facade_material_id": "ldsp_18_white",
  "body_material_id": "ldsp_18_white",
  "back_material_id": "hdf_3_white",
  "edge_color_id": "edge_white_2mm",
  "hardware_style": "blum_standard"
}
```

Valid `type`: `"base"`, `"wall"`, `"tall"`, `"corner"`
Valid `subtype` depends on type. See `/contracts/cabinet_subtypes.md`.

---

## Part (the most important schema)

A single panel as it will be manufactured. Owned by the Machining Engine. Contains ALL operations needed to produce the final part.

**Critical rule**: If a feature is not in `Part.operations[]`, the CNC machine never sees it. There is no other route.

```json
{
  "id": "part_a8f3",
  "cabinet_id": "cab_kitchen1_base_001",
  "role": "left_side",
  "material_id": "ldsp_18_white",
  "thickness_mm": 18,
  "shape": {
    "type": "rect",
    "w_mm": 600.0,
    "h_mm": 850.0
  },
  "edge_banding": {
    "top": "2mm",
    "bottom": "0.4mm",
    "left": "none",
    "right": "2mm"
  },
  "grain": {
    "required_axis": "Y"
  },
  "operations": [
    {
      "op": "drill",
      "id": "op_1",
      "face": "A",
      "x_mm": 37.0,
      "y_mm": 100.0,
      "diameter_mm": 5.0,
      "depth_mm": 13.0
    },
    {
      "op": "groove",
      "id": "op_2",
      "face": "B",
      "axis": "Y",
      "offset_mm": 16.0,
      "width_mm": 4.0,
      "depth_mm": 8.0
    }
  ]
}
```

### Notes
- `role` valid values: `"left_side"`, `"right_side"`, `"top"`, `"bottom"`, `"back"`, `"shelf"`, `"door"`, `"drawer_front"`, `"drawer_side"`, `"drawer_bottom"`, `"facade"`
- `shape.w_mm` and `shape.h_mm` are the **final panel size** (after edge banding is applied). The DXF Generator subtracts banding thickness from each banded edge when drawing the cut outline.
- `grain.required_axis` valid values: `"X"`, `"Y"`, `"ANY"`. If not "ANY", the Optimizer must respect orientation when placing on a sheet with grain.
- `operations[]` coordinates are always in part-local space. Origin = bottom-left of Face A. See `06_CONVENTIONS.md`.

---

## Operation

A single machining action on a part. Multiple operations live in `Part.operations[]`.

### Drill (round hole)
```json
{
  "op": "drill",
  "id": "op_unique",
  "face": "A",
  "x_mm": 37.0,
  "y_mm": 100.0,
  "diameter_mm": 5.0,
  "depth_mm": 13.0,
  "through": false
}
```

### Groove (slot)
```json
{
  "op": "groove",
  "id": "op_unique",
  "face": "A",
  "axis": "X",
  "start_mm": 50.0,
  "end_mm": 550.0,
  "offset_from_edge_mm": 16.0,
  "width_mm": 4.0,
  "depth_mm": 8.0
}
```

### Pocket (rectangular cutout)
```json
{
  "op": "pocket",
  "id": "op_unique",
  "face": "A",
  "x_mm": 100.0,
  "y_mm": 100.0,
  "w_mm": 50.0,
  "h_mm": 50.0,
  "depth_mm": 10.0
}
```

### Cutout (through cut, for non-rectangular panels)
```json
{
  "op": "cutout",
  "id": "op_unique",
  "polygon": [[x1, y1], [x2, y2], ...]
}
```

---

## SheetSpec

Physical specification of a material sheet from the catalog.

```json
{
  "id": "sheet_ldsp_18_white_2750x1830",
  "material_id": "ldsp_18_white",
  "w_mm": 2750.0,
  "h_mm": 1830.0,
  "thickness_mm": 18,
  "kerf_mm": 3.2,
  "grain": {
    "axis": "Y"
  },
  "price_per_sheet": 45.00,
  "supplier_id": "imkon"
}
```

If `grain.axis` is set and a part's `grain.required_axis` is not `"ANY"`, the Optimizer enforces matching orientation.

---

## Placement

Result of the Optimizer placing one part on one sheet. Contains the transform that downstream generators apply to outline AND every operation.

```json
{
  "part_id": "part_a8f3",
  "sheet_instance_id": "sheet_A_01",
  "transform": {
    "x_mm": 120.0,
    "y_mm": 40.0,
    "rot_deg": 90,
    "mirror": false
  }
}
```

### Transform application order (LOCKED)
1. Apply rotation `rot_deg` counterclockwise around part origin `(0, 0)`
2. Apply translation `(x_mm, y_mm)` — this is the position of part origin on the sheet
3. Mirror is reserved for V2 (`false` for V1)

See `06_CONVENTIONS.md` for the worked example.

---

## CutLayout

Complete output of the Optimizer. Consumed by DXF, PDF, and Label generators.

```json
{
  "layout_id": "layout_kitchen_karimov_2026_03",
  "sheets": [
    {
      "sheet_instance_id": "sheet_A_01",
      "spec_sheet_id": "sheet_ldsp_18_white_2750x1830",
      "placements": [
        { "part_id": "part_a8f3", "transform": { "x_mm": 120, "y_mm": 40, "rot_deg": 90, "mirror": false } }
      ]
    }
  ],
  "waste_percent": 12.4,
  "total_sheets_used": {
    "sheet_ldsp_18_white_2750x1830": 3,
    "sheet_hdf_3_white_2750x1830": 1
  }
}
```

---

## HardwareBOM

Bill of hardware materials. NOT the same as machined operations on parts. Hardware is purchased; operations are performed on panels.

```json
{
  "items": [
    {
      "item_id": "hinge_blum_standard_110",
      "display_name": "Петля Blum Standard 110°",
      "qty": 4,
      "unit_price": 1.20,
      "total_price": 4.80,
      "supplier_id": "blum_distributor_tashkent",
      "linked_operation_ids": ["op_3", "op_4", "op_15", "op_16"]
    },
    {
      "item_id": "screw_confirmat_50mm",
      "display_name": "Шуруп Конфирмат 50мм",
      "qty": 32,
      "unit_price": 0.05,
      "total_price": 1.60,
      "supplier_id": "kreps_tashkent"
    }
  ]
}
```

`linked_operation_ids` is optional but useful — links a hardware item to the drill holes it mounts into.

---

## MaterialCatalog (data, not contract)

Single source of truth for materials. Lives in `/data/materials.json`. Read by every module that needs material data.

```json
{
  "ldsp_18_white": {
    "display_name": "ЛДСП 18мм Белый",
    "thickness_mm": 18,
    "kerf_mm": 3.2,
    "has_grain": true,
    "sheet_w_mm": 2750,
    "sheet_h_mm": 1830,
    "price_per_sheet": 45.00,
    "supplier_id": "imkon"
  },
  "hdf_3_white": {
    "display_name": "ХДФ 3мм Белый",
    "thickness_mm": 3,
    "kerf_mm": 2.0,
    "has_grain": false,
    "sheet_w_mm": 2750,
    "sheet_h_mm": 1830,
    "price_per_sheet": 18.00,
    "supplier_id": "egger_tashkent"
  }
}
```

Each module reads this file but does not own its data. Prices change → one file edit, no module code changes.

---

## Label

Generated by the Label Generator from `Part` + `Cabinet` data. Printed as PDF or sent to thermal printer.

```json
{
  "label_id": "lbl_a8f3",
  "part_id": "part_a8f3",
  "qr_payload": "https://app.mebelchi.uz/p/a8f3",
  "human_id": "К1-Низ1-ЛБ",
  "cabinet_summary": "Кухня Karimov / Низ-1 / Левый бок",
  "dimensions_label": "600 × 850 × 18мм",
  "edge_diagram": {
    "top": "2mm white",
    "bottom": "0.4mm white",
    "left": "none",
    "right": "2mm white"
  },
  "hardware_summary": [
    "2× Blum hinges (cup holes top-left, bottom-left)",
    "1× shelf support (left side, 350mm from bottom)"
  ],
  "order_id": "ord_karimov_2026_03"
}
```

The QR code payload resolves to a URL. Scanning opens the app to the part's station status page.

---

## Validation rule

CI runs JSON Schema validation on every commit:

1. Every file in `/tests/fixtures/` is validated against its declared schema.
2. Every module's output, when run on a fixture input, is validated against the output schema.
3. If ANY validation fails, the build fails. The PR cannot merge.

No exceptions. This is the rule that prevents contract drift in three-developer parallel work.
