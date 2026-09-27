// Gidlab CSV (14-column cutting optimizer) and SWJ008 CNC XML Exporter
// Translates Evaluated parametric board tree into factory production deliverables.

import type { Evaluated, Construction, Board, Hole } from "../poligon/model/space";

export interface GidlabRow {
  partName: string;
  material: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  qty: number;
  grain: boolean;
  edgeTop?: string;
  edgeBottom?: string;
  edgeLeft?: string;
  edgeRight?: string;
  groove?: string;
  cnc?: string;
  notes?: string;
}

/**
 * Converts evaluated parametric boards into Gidlab cutting rows.
 */
export function toGidlabRows(
  evaluated: Evaluated,
  construction?: Construction,
): GidlabRow[] {
  const rows: GidlabRow[] = [];

  const roleLabels: Record<string, string> = {
    side_l: "Боковина левая",
    side_r: "Боковина правая",
    bottom: "Дно",
    top: "Крышка",
    shelf: "Полка вкладная",
    partition: "Стойка внутренняя",
    back: "Задняя стенка (ХДФ)",
    front: "Фасад",
    drawer_front: "Фасад ящика",
    drawer_side: "Боковина ящика",
    drawer_bottom: "Дно ящика",
    drawer_back: "Задник ящика",
    plinth: "Цоколь",
  };

  const getDimensionLengths = (board: Board): [number, number, number] => {
    const dx = Math.round(Math.abs(board.box.x[1] - board.box.x[0]));
    const dy = Math.round(Math.abs(board.box.y[1] - board.box.y[0]));
    const dz = Math.round(Math.abs(board.box.z[1] - board.box.z[0]));

    const sorted = [dx, dy, dz].sort((a, b) => b - a);
    return [sorted[0]!, sorted[1]!, board.thicknessMm || sorted[2]!];
  };

  // Build a fast lookup for drillings by boardId
  const holesByBoard = new Map<string, Hole[]>();
  if (evaluated.drillings) {
    for (const d of evaluated.drillings) {
      holesByBoard.set(d.boardId, d.holes);
    }
  }

  for (const board of evaluated.boards) {
    const [lengthMm, widthMm, thicknessMm] = getDimensionLengths(board);
    const partName = roleLabels[board.role] || board.role || board.id;

    const isFront = board.role.includes("front");
    const isBack = board.role === "back";

    // Edge banding defaults
    const edgeBand = isFront ? "1.0 мм" : isBack ? "—" : "0.4 мм";
    const holes = holesByBoard.get(board.id);

    rows.push({
      partName,
      material: board.material || "ЛДСП 16мм",
      lengthMm,
      widthMm,
      thicknessMm,
      qty: 1,
      grain: true,
      edgeTop: isBack ? "—" : edgeBand,
      edgeBottom: isBack ? "—" : edgeBand,
      edgeLeft: isBack ? "—" : edgeBand,
      edgeRight: isBack ? "—" : edgeBand,
      groove: isBack ? "Паз 4мм" : "—",
      cnc: holes && holes.length > 0 ? `Отверстий: ${holes.length}` : "—",
      notes: board.id,
    });
  }

  return rows;
}

/**
 * Serializes Gidlab rows into standard 14-column CSV with UTF-8 BOM.
 */
export function toGidlabCsv(rows: GidlabRow[]): string {
  const headers = [
    "Деталь",
    "Материал",
    "Длина",
    "Ширина",
    "Толщина",
    "Количество",
    "Текстура",
    "Кромка Верх",
    "Кромка Низ",
    "Кромка Лево",
    "Кромка Право",
    "Паз",
    "ЧПУ",
    "Примечание",
  ];

  const escapeCell = (val: string | number | boolean | undefined): string => {
    if (val === undefined || val === null) return "";
    const str = String(val);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(";"),
    ...rows.map((r) =>
      [
        escapeCell(r.partName),
        escapeCell(r.material),
        r.lengthMm,
        r.widthMm,
        r.thicknessMm,
        r.qty,
        r.grain ? "Да" : "Нет",
        escapeCell(r.edgeTop),
        escapeCell(r.edgeBottom),
        escapeCell(r.edgeLeft),
        escapeCell(r.edgeRight),
        escapeCell(r.groove),
        escapeCell(r.cnc),
        escapeCell(r.notes),
      ].join(";"),
    ),
  ];

  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Generates SWJ008 XML format for CNC drilling/milling centers (KDT, Nanxing, Biesse).
 */
export function toSWJ008Xml(evaluated: Evaluated): string {
  const nl = "\r\n";
  const indent = "  ";

  let xml = `<?xml version="1.0" encoding="utf-8"?>${nl}`;
  xml += `<Project Name="Mebelchi_App2_Export" Version="1.0">${nl}`;
  xml += `${indent}<Panels Count="${evaluated.boards.length}">${nl}`;

  const holesByBoard = new Map<string, Hole[]>();
  if (evaluated.drillings) {
    for (const d of evaluated.drillings) {
      holesByBoard.set(d.boardId, d.holes);
    }
  }

  for (let i = 0; i < evaluated.boards.length; i++) {
    const board = evaluated.boards[i]!;
    const dx = Math.round(Math.abs(board.box.x[1] - board.box.x[0]));
    const dy = Math.round(Math.abs(board.box.y[1] - board.box.y[0]));
    const dz = Math.round(Math.abs(board.box.z[1] - board.box.z[0]));
    const dims = [dx, dy, dz].sort((a, b) => b - a);

    xml += `${indent}${indent}<Panel ID="${board.id}" Index="${i + 1}" Role="${board.role}" Length="${dims[0]}" Width="${dims[1]}" Thickness="${board.thicknessMm || dims[2]}">${nl}`;

    const holes = holesByBoard.get(board.id);
    if (holes && holes.length > 0) {
      xml += `${indent}${indent}${indent}<Machinings Count="${holes.length}">${nl}`;
      holes.forEach((hole, hIdx) => {
        xml += `${indent}${indent}${indent}${indent}<Drill ID="${1000 + hIdx * 10}" Face="${hole.face}" Purpose="${hole.purpose}" Diameter="${hole.diameter}" Depth="${hole.depth}" X="${hole.x}" Y="${hole.y}" />${nl}`;
      });
      xml += `${indent}${indent}${indent}</Machinings>${nl}`;
    }

    xml += `${indent}${indent}</Panel>${nl}`;
  }

  xml += `${indent}</Panels>${nl}`;
  xml += `</Project>${nl}`;

  return xml;
}
