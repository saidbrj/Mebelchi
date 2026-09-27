// Сверка с корпусом (SPEC T07): тот же шкаф, собранный ядром, против деталей Полигона.
import { expandCabinet, type CabinetFill, type FillContext, type FillKind, type FillPart } from "../../../poligon/model/fill";

/** Наружная ширина юнита: Полигон меряет по осям стоек, шкафу принадлежит половина каждой. */
export const outerWidthMm = (c: CabinetFill): number => c.widthMm + c.sideMm.left / 2 + c.sideMm.right / 2;

const kinds = (c: CabinetFill): FillKind[] =>
  (Array.isArray(c.fill) ? c.fill.map((s) => s.what) : [c.fill]);

/** Сколько полок в этом шкафу. */
export const shelfCount = (c: CabinetFill): number =>
  kinds(c).reduce((n, k) => n + (k.kind === "shelves" ? k.count : 0), 0);

/** Сколько створок у распашного фасада этого шкафа; 0 — распашного фасада нет. */
export const doorLeaves = (c: CabinetFill): number =>
  kinds(c).reduce((n, k) => (k.kind === "door" ? n + k.leaves : n), 0);

/** Наполнения, которых ядро пока не умеет: ящики, фальш-панели, техника. Пусто — шкаф выразим целиком. */
export const unsupported = (c: CabinetFill): string[] =>
  kinds(c).map((k) => k.kind).filter((k) => !["shelves", "open", "door"].includes(k));

/** Детали, которые Полигон выпускает для этого шкафа. */
export const poligonParts = (c: CabinetFill, ctx: FillContext): FillPart[] => expandCabinet(c, ctx).parts;

export interface RowDiff {
  what: string;
  kernel?: string;
  poligon?: string;
}

const show = (p: FillPart): string => `${p.lengthMm} × ${p.widthMm} × ${p.thicknessMm}`;

/**
 * Сверка деталь за деталью по одной роли. Сравниваются размеры, а не примечания: имя детали у
 * слоёв своё, а размер обязан быть один (P04).
 */
export function compareRole(role: string, kernel: FillPart[], poligon: FillPart[]): RowDiff[] {
  const ours = kernel.filter((p) => p.role === role).map(show).sort();
  const theirs = poligon.filter((p) => p.role === role).map(show).sort();
  const out: RowDiff[] = [];
  const n = Math.max(ours.length, theirs.length);
  for (let i = 0; i < n; i++) {
    if (ours[i] !== theirs[i]) out.push({ what: `${role} ${i + 1}`, kernel: ours[i], poligon: theirs[i] });
  }
  return out;
}
