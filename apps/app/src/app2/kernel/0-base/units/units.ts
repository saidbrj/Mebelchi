// mm10: целые десятые доли миллиметра (SPEC 03_UNITS). Единственное место ядра, где живёт масштаб.

/** Длина в десятых долях миллиметра, всегда целое. */
export type Mm10 = number;

/** Масштаб mm → mm10. Не настройка: это определение единицы (U01). */
const PER_MM = 10;

/** Как профиль распределяет остаток деления (`residualPolicy` в things/profiles). */
export type ResidualPolicy = "leftmost-absorbs" | "last-absorbs";

/** мм → mm10. `null`, если ввод точнее 0.1 мм (U06: не округлять молча). */
export function fromMm(mm: number): Mm10 | null {
  if (!Number.isFinite(mm)) return null;
  const scaled = mm * PER_MM;
  const whole = Math.round(scaled);
  // сравнение с плавающей погрешностью ввода, а не допуск ядра: 0.1 * 10 = 1.0000000000000002
  return Math.abs(scaled - whole) < Number.EPSILON * PER_MM * Math.max(1, Math.abs(scaled)) ? whole : null;
}

/** mm10 → мм, точно до 0.1 (U05). */
export const toMm = (v: Mm10): number => v / PER_MM;

/** Целое ли значение в mm10 (инвариант графа). */
export const isMm10 = (v: number): boolean => Number.isInteger(v);

/**
 * Делит целое на части по весам. Части — целые, их сумма ТОЧНО равна `total` (U03).
 * Остаток от округления вниз целиком получает первая или последняя часть по `policy`.
 */
export function divide(total: Mm10, weights: readonly number[], policy: ResidualPolicy): Mm10[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, w) => a + w, 0);
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  const residual = total - parts.reduce((a, p) => a + p, 0);
  const at = policy === "last-absorbs" ? parts.length - 1 : 0;
  parts[at] = parts[at]! + residual;
  return parts;
}
