// ПОЛИГОН · the bridge to раскрой.
//
// The nesting itself is NOT written here. `apps/app/src/model/nest.ts` already does it, has done
// it for a while, and does it properly: a guillotine free-rectangle packer, every cut edge to
// edge so the layout is valid for a panel saw as well as a CNC, grained fronts never rotated,
// the shop's own offcuts filled before a fresh sheet is opened. Rewriting that to live inside
// Полигон would be throwing away working code to make a diagram tidier.
//
// So this file is a translation and nothing else: a released `Part` becomes a `NestPanel`. The
// one thing that had to change in Полигон to make it possible is that a Part now carries TWO
// dimensions. A cut list with one number per part cannot be nested — you cannot lay 600mm on a
// sheet without knowing whether it is 560 or 300 wide.

import type { Part } from "./release";
import type { ThingIndex } from "./things";
import type { NestPanel } from "../../model/nest";

const ROLE_RU: Record<string, string> = {
  side: "Бок", top: "Крышка", bottom: "Дно", shelf: "Полка", back: "Задняя",
  front: "Фасад", plinth: "Цоколь", worktop: "Столешница", cornice: "Карниз", filler: "Добор",
};

const HAND_RU: Record<string, string> = { left: " лев.", right: " прав.", none: "" };

export interface SheetSpec {
  /** from the material Thing's own sheetLength × sheetWidth — never a number chosen here */
  W: number;
  H: number;
  material: string;
  decor: string;
}

/** The sheet this material actually comes on, read from its Thing. A material with no sheet size
 *  declared cannot be nested, and saying so is better than assuming 2800×2070. */
export function sheetFor(uid: string, catalog: ThingIndex): SheetSpec | undefined {
  const t = catalog.byUid.get(uid);
  if (!t) return undefined;
  const L = t.def.fields.sheetLength, W = t.def.fields.sheetWidth;
  const decor = t.def.fields.decor;
  if (L?.type !== "number" || W?.type !== "number") return undefined;
  return {
    W: L.value, H: W.value, material: uid,
    decor: decor?.type === "text" ? decor.value : (t.def.name.ru ?? t.def.id),
  };
}

/** A released part becomes a panel to place. The CUT plane is what goes on the sheet — that is
 *  the whole point of having three planes and then choosing the right one here. */
export function toNestPanels(parts: Part[], catalog: ThingIndex, moduleOf?: (p: Part) => string): NestPanel[] {
  // R76 — a laminated part goes to the saw as its BLANKS. Sending the 32mm monolith would ask the
  // nester to cut a thickness the shop does not stock, and it would place one rectangle where two
  // have to fit. Expanding here, once, keeps every downstream consumer honest.
  const flat = parts.flatMap((p): Part[] =>
    p.laminate
      ? p.laminate.blanks.map((bl, i) => ({
          ...p,
          id: `${p.id}#${bl.id}`,
          no: p.no,
          cutMm: bl.lengthMm,
          widthMm: bl.widthMm,
          thicknessMm: bl.thicknessMm,
          banding: bl.banding,
          role: i === 0 ? `${p.role}-лицо` : `${p.role}-подложка`,
          laminate: undefined,
        }))
      : [p]);

  return flat
    .filter((p) => p.widthMm > 0)
    .map((p) => {
      const mat = p.material ? catalog.byUid.get(p.material) : undefined;
      const decor = mat?.def.fields.decor;
      return {
        id: `p${p.no}`,
        w: p.cutMm,
        h: p.widthMm,
        part: `${p.role}-${p.no}`,
        partRu: `${ROLE_RU[p.role] ?? p.role}${HAND_RU[p.hand] ?? ""} №${p.no}`,
        module: moduleOf?.(p) ?? "—",
        group: `${p.material ?? "—"}|${p.thicknessMm}`,
        material: decor?.type === "text" ? decor.value : (mat?.def.name.ru ?? p.material ?? "—"),
        thickness: p.thicknessMm,
        // a grained decor cannot be turned 90°, or the wood runs across the door
        grain: p.grain !== "none",
      };
    });
}
