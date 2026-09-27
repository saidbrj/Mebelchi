// Контракт App 1 → App 2 (SPEC R60–R65). App 2 не знает слова «модуль»: он видит юнит и чужие
// детали «только для чтения». Пока App 1 нет, его заменяют фикстуры в конце файла.
import type { Mm10 } from "../../0-base/units/units";
import type { Axis, Face } from "../model/model";

/** Разделитель, который ядро в своих uid не использует НИКОГДА: так чужое не спутать со своим. */
export const FOREIGN = ":";

export interface ExternalPart {
  /** `M4:P7` — чей и какой: владелец за пределами юнита */
  id: string;
  /** с какой стороны юнита стоит эта чужая деталь */
  side: Face;
  thickness: Mm10;
  /** тип детали, чтобы можно было сделать стык: «боковина», «дно» */
  type: string;
}

export type SupportKind = "floor" | "plinth" | "wall" | "frame";

export interface Neighbour {
  side: Face;
  kind: "unit" | "wall" | "free";
  /** зазор до соседа, если он есть */
  gap?: Mm10;
}

export interface Wall {
  side: Face;
  distance: Mm10;
}

export interface UnitContext {
  unit: { id: string; size: Record<Axis, Mm10>; type: string };
  profile: string;
  external: ExternalPart[];
  support: SupportKind;
  neighbours: Neighbour[];
  walls: Wall[];
}

export const isForeign = (id: string): boolean => id.includes(FOREIGN);

/** Внешняя деталь с этой стороны, если App 1 её объявил. */
export const externalAt = (ctx: UnitContext, side: Face): ExternalPart | undefined =>
  ctx.external.find((e) => e.side === side);
