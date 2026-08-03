// A tiny, dependency-light .xlsx (Office Open XML / SpreadsheetML) writer. An .xlsx is just a
// ZIP of XML parts, so we hand-roll the ~5 parts a spreadsheet needs and zip them with fflate
// (already in the tree — no SheetJS/exceljs bulk). Opens natively in Excel, Google Sheets and
// Numbers, unlike a CSV. Strings are written inline (t="inlineStr") so there's no shared-string
// table to maintain; numbers are written as real numeric cells so the shop can sum/sort them.
//
// Deliberately minimal: one bold style for headers, per-column widths, an optional frozen header
// and an optional autofilter. That's everything the CNC parts list needs and nothing it doesn't.

import { strToU8, zipSync } from "fflate";

/** A cell: a bare value, or a value flagged bold (used for header rows). */
export type XCell = string | number | { v: string | number; bold?: boolean };

export interface XSheet {
  /** tab name — sanitised to Excel's rules (≤31 chars, no []:*?/\) */
  name: string;
  /** row-major cells */
  rows: XCell[][];
  /** per-column width in Excel "character" units (index = column) */
  cols?: number[];
  /** freeze the top N rows so the header stays visible while scrolling */
  freezeRows?: number;
  /** 0-based row index of the header to attach an autofilter to (spans the used columns) */
  filterRow?: number;
}

const xml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 0 → A, 25 → Z, 26 → AA … (spreadsheet column letters). */
function colLetter(i: number): string {
  let s = "";
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function sheetName(name: string, fallback: string): string {
  const clean = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return clean || fallback;
}

function cellXml(c: XCell, ref: string): string {
  const bold = typeof c === "object" && c.bold ? ' s="1"' : "";
  const v = typeof c === "object" ? c.v : c;
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${bold}><v>${v}</v></c>`;
  return `<c r="${ref}"${bold} t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
}

function worksheetXml(s: XSheet): string {
  const colCount = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const rowsXml = s.rows
    .map((row, ri) => {
      const cells = row.map((c, ci) => cellXml(c, `${colLetter(ci)}${ri + 1}`)).join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");

  const views =
    s.freezeRows && s.freezeRows > 0
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${s.freezeRows}" topLeftCell="A${
          s.freezeRows + 1
        }" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : "";

  const cols =
    s.cols && s.cols.length
      ? `<cols>${s.cols
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join("")}</cols>`
      : "";

  const filter =
    s.filterRow != null && s.rows.length
      ? `<autoFilter ref="A${s.filterRow + 1}:${colLetter(Math.max(0, colCount - 1))}${s.rows.length}"/>`
      : "";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    views +
    cols +
    `<sheetData>${rowsXml}</sheetData>` +
    filter +
    `</worksheet>`
  );
}

export function buildXlsx(sheets: XSheet[]): Uint8Array {
  const named = sheets.map((s, i) => ({ ...s, name: sheetName(s.name, `Sheet${i + 1}`) }));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    named
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  // sheet rels are rId1..N; styles gets the next id so it never collides with a sheet
  const stylesRid = `rId${named.length + 1}`;
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    named.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    named
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
            i + 1
          }.xml"/>`,
      )
      .join("") +
    `<Relationship Id="${stylesRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  // two cell formats: index 0 = normal, index 1 = bold (used by header cells via s="1")
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(styles),
  };
  named.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(worksheetXml(s));
  });

  return zipSync(files, { level: 6 });
}
