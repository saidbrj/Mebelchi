// The CNC parts list as a real .xlsx — the file the cutting shop loads into its nesting optimiser.
// Two sheets: «Детали» (the cut list: one row per size with a summed Qty, finished dimensions, no
// kerf) and «Фурнитура» (the hardware totals). A short spec block at the top carries the project +
// hardware grade so the file is self-describing. Pure; HandoffScreen downloads the bytes.

import { buildXlsx, type XCell, type XSheet } from "./xlsx";
import type { PartsList } from "./partsList";

export interface PartsXlsxLabels {
  sheetParts: string;
  sheetHw: string;
  title: string;
  from: string;
  project: string;
  grade: string;
  reinforce: string;
  yes: string;
  no: string;
  totalParts: string;
  boardM2: string;
  note: string;
  colNo: string;
  colModule: string;
  colPart: string;
  colMat: string;
  colThk: string;
  colLen: string;
  colWid: string;
  colQty: string;
  colGrain: string;
  colEdge: string;
  colProfile: string;
  colHwName: string;
  colHwQty: string;
  grainYes: string;
}

export interface PartsXlsxMeta {
  project: string;
  fromLine: string;
  gradeLabel: string;
  reinforced: boolean;
}

export function partsXlsx(pl: PartsList, meta: PartsXlsxMeta, L: PartsXlsxLabels): Uint8Array {
  const b = (v: string | number): XCell => ({ v, bold: true });

  // spec block — 2-column label/value rows above the table
  const head: XCell[][] = [[b(L.title)], [b(L.project), meta.project]];
  if (meta.fromLine) head.push([b(L.from), meta.fromLine]);
  head.push([b(L.grade), meta.gradeLabel]);
  head.push([b(L.reinforce), meta.reinforced ? L.yes : L.no]);
  head.push([b(L.totalParts), pl.totalParts]);
  head.push([b(L.boardM2), pl.boardM2]);
  head.push([L.note]);
  head.push([]); // spacer

  const header: XCell[] = [
    b(L.colNo), b(L.colModule), b(L.colPart), b(L.colMat), b(L.colThk),
    b(L.colLen), b(L.colWid), b(L.colQty), b(L.colGrain), b(L.colEdge), b(L.colProfile),
  ];
  const headerRow = head.length; // 0-based index of the header row within the sheet

  const dataRows: XCell[][] = pl.lines.map((l) => [
    l.no, l.module, l.part, l.material, l.thicknessMm,
    l.lengthMm, l.widthMm, l.qty, l.grain ? L.grainYes : "—", l.edge, l.profile || "—",
  ]);

  const partsSheet: XSheet = {
    name: L.sheetParts,
    rows: [...head, header, ...dataRows],
    cols: [5, 28, 20, 24, 11, 11, 11, 8, 10, 13, 24],
    freezeRows: headerRow + 1,
    filterRow: headerRow,
  };

  const hwSheet: XSheet = {
    name: L.sheetHw,
    rows: [[b(L.colHwName), b(L.colHwQty)], ...pl.hardware.map((h) => [h.name, h.qty] as XCell[])],
    cols: [44, 10],
    freezeRows: 1,
    filterRow: 0,
  };

  return buildXlsx([partsSheet, hwSheet]);
}
