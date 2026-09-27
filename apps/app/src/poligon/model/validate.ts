// ПОЛИГОН · D11 — the two validation phases, and why they are two.
//
//   P5  MODEL validity   minimums, per-layer collisions, material domains.
//                        "Is this a coherent design?"
//   P6  FEASIBILITY      does this material exist, does it fit on a sheet, will it leave the shop.
//                        "Can this actually be made, here, with what we have?"
//
// Keeping them apart matters because they fail differently. A P5 failure is a design that cannot
// be built by anyone — the interior is 40mm wide, two blocks claim the same cell. A P6 failure is
// a design that is perfectly sound and that THIS shop cannot make today: a 2900mm part when the
// sheet is 2800, a decor nobody stocks. The first is a bug in the drawing; the second is a
// purchase order, a different material, or a different shop — and telling someone to "fix" it is
// the wrong instruction.
//
// D11's last clause is the one that makes either useful: EVERY REFUSAL NAMES ITS RULE. A finding
// with no law on it is a dead end for whoever reads it.

import { checkInvariants, resolvePositions, type Sheet, type SheetProfile } from "./sheet";
import { resolve, type Property, type Rule } from "./cascade";
import type { Facets } from "./facets";
import type { Board } from "./runs";
import type { Part, ShopConvention } from "./release";
import type { ThingIndex } from "./things";

export interface Finding {
  phase: "P5" | "P6";
  /** какая настройка снимает отказ — см. Violation.setting */
  setting?: string;
  /** D11 — never blank. A finding nobody can look up is a dead end. */
  law: string;
  detail: string;
  where?: { board?: string; block?: string; part?: number };
}

// ─── P5 · is this a coherent design? ──────────────────────────────────────────────────────────

export function validateP5(
  sheet: Sheet, profile: SheetProfile, facets: Map<string, Facets>, rules: Rule[],
): Finding[] {
  const out: Finding[] = [];

  // minimums, fullness, face ordering, block rectangles — the sheet's own invariants
  for (const v of checkInvariants(sheet, profile)) {
    out.push({ phase: "P5", law: v.law, detail: v.detail, where: { block: v.where?.block } });
  }

  // per-LAYER collisions. Two blocks may overlap across layers — a fasad sits in front of a
  // carcass on purpose — and may never overlap within one.
  const { mm } = resolvePositions(sheet);
  const span = (b: Sheet["blocks"][number]) => ({
    x0: mm.get(b.bounds.v0) ?? 0, x1: mm.get(b.bounds.v1) ?? 0,
    y0: mm.get(b.bounds.h0) ?? 0, y1: mm.get(b.bounds.h1) ?? 0,
  });
  for (let i = 0; i < sheet.blocks.length; i++) {
    for (let j = i + 1; j < sheet.blocks.length; j++) {
      const a = sheet.blocks[i]!, b = sheet.blocks[j]!;
      if (a.layer !== b.layer) continue;
      const p = span(a), q = span(b);
      const overlap = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 0
                   && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 0;
      if (overlap) {
        out.push({
          phase: "P5", law: "D11",
          detail: `blocks "${a.id}" and "${b.id}" overlap on layer "${a.layer}" — a cell belongs to one block per layer`,
          where: { block: a.id },
        });
      }
    }
  }

  // material domains — a resolved value must be one the rules can actually deliver
  for (const [id, f] of facets) {
    for (const property of ["material", "thickness"] as Property[]) {
      try { resolve(id, f, property, rules); }
      catch (e) {
        out.push({ phase: "P5", law: "D11", detail: (e as Error).message, where: { board: id } });
      }
    }
  }
  return out;
}

// ─── P6 · can this shop make it? ──────────────────────────────────────────────────────────────

export interface FeasibilityInput {
  parts: Part[];
  /** Сырые прогоны — ТОЛЬКО для справки. Транспорт считается по ДЕТАЛЯМ: после конвейера прогон
   *  4500 существует как понятие, а увозят куски. Проверять прогон значило бы отказывать в том,
   *  что уже починено. */
  boards: Board[];
  catalog: ThingIndex;
  shop: ShopConvention;
  transportMaxMm: number;
}

export function validateP6(input: FeasibilityInput): Finding[] {
  const { parts, boards, catalog, shop, transportMaxMm } = input;
  const out: Finding[] = [];

  for (const part of parts) {
    // A part with NO material declared used to fall straight through both checks below, silently.
    // That is worse than a wrong material: an undeclared one cannot be bought, cannot be nested,
    // and cannot be checked against a sheet — and it said nothing at all. Found when the kitchen
    // was actually laid out on sheets.
    if (!part.material) {
      out.push({
        phase: "P6", law: "D11",
        detail: `part ${part.no} has no material declared — it cannot be bought, nested or checked against a sheet`,
        where: { part: part.no },
      });
      continue;
    }
    // the material has to be a Thing that exists — a uid that resolves to nothing is not a
    // "different" design, it is one nobody can buy
    if (!catalog.byUid.has(part.material)) {
      out.push({
        phase: "P6", law: "MS-UID",
        detail: `part ${part.no} names material ${part.material}, which is not in the catalog`,
        where: { part: part.no },
      });
      continue;
    }

    // and it has to fit on a sheet of that material, at the cut size, with the blade's width
    const mat = catalog.byUid.get(part.material);
    // ОБА габарита, а не один. Длину проверяли с самого начала; ШИРИНУ — нет, и деталь 1000мм
    // спокойно проходила на постформинге шириной 600. На кухнях у стены это не всплывало:
    // столешница там 600 и ровно влезает. Остров глубиной метр обнаружил бы это в цехе, когда
    // заготовку уже привезли.
    //
    // Поворот учитывается: деталь можно положить поперёк, если материал это позволяет. У
    // постформинга нельзя — нос закруглён вдоль полосы, — но решать это по флагу материала,
    // а не запретом здесь.
    const L = mat?.def.fields.sheetLength;
    const W = mat?.def.fields.sheetWidth;
    const stockL = L?.type === "number" ? L.value : undefined;
    const stockW = W?.type === "number" ? W.value : undefined;
    const k = shop.kerfMm;

    if (stockL !== undefined && stockW !== undefined) {
      const asIs = part.cutMm + k <= stockL && part.widthMm + k <= stockW;
      const turned = part.cutMm + k <= stockW && part.widthMm + k <= stockL;
      const canTurn = (mat?.def.fields.grain as { value?: string } | undefined)?.value === "none";

      if (!asIs && !(turned && canTurn)) {
        out.push({
          phase: "P6", law: "D11",
          setting: "things/materials/",
          detail:
            `part ${part.no} is ${part.cutMm}×${part.widthMm}mm and the stock is ` +
            `${stockL}×${stockW}mm — it cannot be cut from this material at any yield` +
            (turned && !canTurn
              ? `. It would fit turned, but this material has a run direction and cannot be turned`
              : ``),
          where: { part: part.no },
        });
      }
    } else if (stockL !== undefined && part.cutMm + k > stockL) {
      out.push({
        phase: "P6", law: "D11",
        detail:
          `part ${part.no} is ${part.cutMm}mm and the sheet is ${stockL}mm — ` +
          `it cannot be cut from this material at any yield`,
        where: { part: part.no },
      });
    }
  }

  for (const p of parts) {
    if (p.cutMm > transportMaxMm) {
      out.push({
        phase: "P6", law: "L-TRANSPORT",
        setting: "profile.transportMaxMm",
        detail:
          `part ${p.no} (${p.role}) is ${p.cutMm}mm, over the ${transportMaxMm}mm transport ` +
          `limit — it will not leave the shop assembled`,
        where: { part: p.no },
      });
    }
  }
  return out;
}

/** Both phases, in order, stopping at neither: a design can be incoherent AND infeasible, and
 *  showing one list of both is more useful than making someone fix them in two rounds. */
export const validateAll = (
  sheet: Sheet, profile: SheetProfile, facets: Map<string, Facets>, rules: Rule[],
  feasibility: FeasibilityInput,
): Finding[] => [...validateP5(sheet, profile, facets, rules), ...validateP6(feasibility)];
