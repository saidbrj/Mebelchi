// Всё, что стенд читает из ядра. Ни одного размера стенд не придумывает: коробки, проёмы и зазоры —
// из evaluation.boxes. Здесь только перевод в слова мастера и измерение зазоров «в свету».
import type { Box, Session } from "../kernel";

type Axis = "x" | "y" | "z";
export const mm = (v: number) => Math.round(v) / 10;

const NAME: Record<string, string> = {
  side: "Боковина", top: "Крышка", bottom: "Дно", shelf: "Полка", divider: "Перегородка", rail: "Царга", spacer: "Проставка", front: "Створка", back: "Задняя стенка",
};

export interface PartInfo { id: string; type: string; name: string; axis: Axis; movable: boolean; box: Box }

export function parts(s: Session): PartInfo[] {
  const { nodes, order } = s.state.graph;
  const out: PartInfo[] = [];
  for (const id of order) {
    const n = nodes[id]!;
    const box = s.state.evaluation.boxes[id];
    if (n.kind !== "part" || !box) continue;
    const frame = n.position.kind === "plane" && n.position.relation === "frame";
    out.push({ id, type: n.type, name: NAME[n.type] ?? n.type, axis: n.normal, movable: !frame, box });
  }
  return out;
}

/** Проём = пространство, внутри которого нет ни паттерна, ни других пространств. */
export function openings(s: Session): { id: string; box: Box }[] {
  const { nodes, order } = s.state.graph;
  const hosts = new Set<string>();
  for (const id of order) {
    const n = nodes[id]!;
    if (n.kind === "pattern") hosts.add(n.host);
    if (n.kind === "space" && n.host) hosts.add(n.host);
  }
  return order
    .filter((id) => nodes[id]!.kind === "space" && !hosts.has(id) && s.state.evaluation.boxes[id])
    .map((id) => ({ id, box: s.state.evaluation.boxes[id]! }));
}

export function unitSize(s: Session): { w: number; h: number; d: number } | null {
  const u = s.state.graph.order.map((id) => s.state.graph.nodes[id]!).find((n) => n.kind === "unit");
  return u && u.kind === "unit" ? { w: mm(u.size.x), h: mm(u.size.y), d: mm(u.size.z) } : null;
}

export const dimsOf = (b: Box) => (["x", "y", "z"] as const).map((a) => mm(b.max[a] - b.min[a]));

/** Размер детали словами мастера: длина × ширина (толщину не пишем — она из материала). */
export function sizeText(p: PartInfo): string {
  const [x, y, z] = dimsOf(p.box);
  if (p.axis === "y") return `${x} × ${z}`;
  if (p.axis === "x") return `${y} × ${z}`;
  return `${x} × ${y}`;
}

/**
 * Зазоры «в свету» по оси детали, измеренные на линии, где мастер их видит: у полки — у левого
 * конца (ручка справа), у перегородки — у верхнего конца (ручка снизу).
 */
export interface Gaps { axis: "x" | "y"; at: number; lo: number; hi: number; loEdge: number; hiEdge: number }
export function gapsOf(s: Session, id: string): Gaps | null {
  const all = parts(s);
  const me = all.find((p) => p.id === id);
  if (!me || (me.axis !== "x" && me.axis !== "y")) return null;
  const a = me.axis;
  const o: "x" | "y" = a === "y" ? "x" : "y";
  const at = a === "y" ? me.box.min.x + 400 : me.box.max.y - 400; // 40 мм от конца (mm10)
  let lo = -Infinity, hi = Infinity;
  for (const p of all) {
    if (p.id === id || p.box.min[o] > at || p.box.max[o] < at) continue;
    if (p.box.max[a] <= me.box.min[a]) lo = Math.max(lo, p.box.max[a]);
    if (p.box.min[a] >= me.box.max[a]) hi = Math.min(hi, p.box.min[a]);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { axis: a, at, lo: mm(me.box.min[a] - lo), hi: mm(hi - me.box.max[a]), loEdge: lo, hiEdge: hi };
}

/** Где проём по-человечески: «сверху», «слева внизу»… (по центру проёма относительно юнита). */
export function whereText(s: Session, b: Box): string {
  const u = unitSize(s);
  if (!u) return "";
  const cx = (b.min.x + b.max.x) / 20 / u.w, cy = (b.min.y + b.max.y) / 20 / u.h;
  const full = mm(b.max.x - b.min.x) > u.w * 0.8;
  const v = cy > 0.62 ? "вверху" : cy < 0.38 ? "внизу" : "посередине";
  if (full) return v === "вверху" ? "сверху" : v === "внизу" ? "снизу" : "посередине";
  return `${cx < 0.45 ? "слева" : cx > 0.55 ? "справа" : "по центру"} ${v}`;
}
