// Во что попал палец. Правило одно и заранее (не решается во время теста):
//   1. деталь, которую палец накрыл прямо (видимая передняя грань); если таких несколько —
//      выбранная, иначе меньшая;
//   2. палец рядом, но не на детали: выбранная, если он в её зоне (чтобы взять тонкую полку);
//   3. иначе ближайшая деталь, в чью зону попал палец, — по расстоянию до её КРАЯ, не до осевой;
//   4. иначе проём (самый маленький, в который попал палец);
//   5. иначе — ничего.
// Видимое всегда сильнее выделенного: ткнул в полку — получил полку, даже если выбрана перегородка.
// Грань на экране — четырёхугольник (в ракурсе 3/4 горизонтальные доски идут наклонно), поэтому
// попадание считается по нему, а не по описанному прямоугольнику. Все соперники пишутся в журнал:
// потом видно, что было причиной — геометрия зоны, приоритет или ожидание мастера.

export type Pt = readonly [number, number];
export interface Target { id: string; poly: readonly Pt[] }
export type HitKind = "part" | "space";
export interface Candidate { id: string; kind: HitKind; distPx: number; why: "selected" | "direct" | "zone" | "space" }
export interface Hit { hit: { id: string; kind: HitKind } | null; rule: 1 | 2 | 3 | 4 | 5; candidates: Candidate[] }

/** Минимальная толщина зоны касания: 60 px (палец в перчатке ~15 мм). */
export const MIN_ZONE_PX = 60;
const BASE_PAD_PX = 6;

export const rectPoly = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function area(p: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

export function inside(p: readonly Pt[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c !== 0) { if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false; }
  }
  return true;
}

function segDist(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** Расстояние от точки до грани (0 — внутри). */
export function distTo(p: readonly Pt[], x: number, y: number): number {
  if (inside(p, x, y)) return 0;
  let d = Infinity;
  for (let i = 0; i < p.length; i++) d = Math.min(d, segDist(x, y, p[i]!, p[(i + 1) % p.length]!));
  return d;
}

/** Видимая толщина грани: короткая сторона четырёхугольника. */
const thickness = (p: readonly Pt[]) => {
  const len = (i: number) => Math.hypot(p[(i + 1) % p.length]![0] - p[i]![0], p[(i + 1) % p.length]![1] - p[i]![1]);
  return Math.min(len(0), len(1));
};
/** Насколько зона шире грани с каждой стороны: тонкая доска добирается до 60 px. */
export const padOf = (p: readonly Pt[]) => Math.max(BASE_PAD_PX, (MIN_ZONE_PX - thickness(p)) / 2);

export function hitTest(x: number, y: number, parts: Target[], spaces: Target[], selected: string | null): Hit {
  const candidates: Candidate[] = [];
  const zoned = parts
    .map((p) => ({ ...p, d: distTo(p.poly, x, y) }))
    .filter((p) => p.d <= padOf(p.poly));
  for (const p of zoned) {
    candidates.push({ id: p.id, kind: "part", distPx: Math.round(p.d), why: p.id === selected ? "selected" : p.d === 0 ? "direct" : "zone" });
  }
  const openings = spaces.filter((s) => inside(s.poly, x, y)).sort((a, b) => area(a.poly) - area(b.poly));
  for (const s of openings) candidates.push({ id: s.id, kind: "space", distPx: 0, why: "space" });

  const direct = zoned.filter((p) => p.d === 0);
  const pick = direct.find((p) => p.id === selected) ?? [...direct].sort((a, b) => area(a.poly) - area(b.poly))[0];
  if (pick) return { hit: { id: pick.id, kind: "part" }, rule: 1, candidates };
  const sel = zoned.find((p) => p.id === selected);
  if (sel) return { hit: { id: sel.id, kind: "part" }, rule: 2, candidates };
  const near = [...zoned].sort((a, b) => a.d - b.d)[0];
  if (near) return { hit: { id: near.id, kind: "part" }, rule: 3, candidates };
  if (openings[0]) return { hit: { id: openings[0].id, kind: "space" }, rule: 4, candidates };
  return { hit: null, rule: 5, candidates };
}
