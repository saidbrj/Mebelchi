// ПОЛИГОН · физические инварианты — то, что мебель делает под собственным весом.
//
// Движок до сих пор проверял, СОБИРАЕТСЯ ли конструкция. Он ни разу не спрашивал, СТОИТ ли она
// через полгода. Два отказа живут здесь, и оба про то, чего не видно на чертеже.
//
// ПРОГИБ. ЛДСП ползёт. Полка 16 мм пролётом больше 800 мм под обычной посудой набирает
// необратимый провис за полгода — не ломается, а именно провисает, и обратно уже не выпрямляется.
// Мастера этого не видят при сборке и узнают от заказчика через год. Предел — в файле, потому что
// плита 18 держит дальше, а камень держит гораздо дальше.
//
// ПЕРЕКОС. Вот это опаснее, и именно об этом спросил основатель: «полки на полкодержателях, мастер
// сэкономил на отверстиях — не упадёт ли?». Упадёт. Полка на полкодержателях даёт НОЛЬ диагональной
// жёсткости: она просто лежит. Высокий шкаф без единой жёстко стянутой полки — это четыре доски,
// соединённые по углам, то есть механизм, а не рама. Толкните его вбок, и он сложится в
// параллелограмм. Тонкая задняя стенка на гвоздиках задерживает это, но не отменяет.
//
// Поэтому стяжная полка не предупреждение, а ДЕТАЛЬ: она выводится в раскрой, получает номер и
// кромку, и попадает в спецификацию. Предупреждение мастер закроет; деталь, которой нет в пачке,
// он заметит.

import { STRUCTURAL, TIE_SHELF } from "./settings";
import type { Board } from "./runs";
import type { Role } from "./roles";

export interface PhysicalProblem {
  law: string;
  detail: string;
  /** какая настройка это решает — Law E */
  setting: string;
  board?: string;
}

// ─── прогиб ───────────────────────────────────────────────────────────────────────────────────

export interface SpanCheck {
  id: string;
  role: Role | string;
  /** пролёт БЕЗ ОПОРЫ, не полная длина доски */
  freeSpanMm: number;
}

/** Предел для этой роли. Столешница толще и держит дальше полки. */
export function freeSpanLimitMm(role: string, s = STRUCTURAL): number {
  return role === "worktop" ? s.worktopFreeSpanMm : s.shelfFreeSpanMm;
}

export function checkDeflection(spans: SpanCheck[], s = STRUCTURAL): PhysicalProblem[] {
  return spans
    .filter((x) => x.freeSpanMm > freeSpanLimitMm(x.role, s))
    .map((x) => ({
      law: "PHYS-SAG",
      board: x.id,
      setting: x.role === "worktop" ? "structural.worktopFreeSpanMm" : "structural.shelfFreeSpanMm",
      detail:
        `${x.role} ${x.id}: пролёт без опоры ${Math.round(x.freeSpanMm)}мм при пределе ` +
        `${freeSpanLimitMm(x.role, s)}мм. ЛДСП ползёт — за полгода провис станет необратимым. ` +
        `Добавьте перегородку, или объявите другой материал.`,
    }));
}

// ─── перекос ──────────────────────────────────────────────────────────────────────────────────

export interface Carcass {
  id: string;
  heightMm: number;
  /** высоты жёстко стянутых горизонталей, мм от низа корпуса. Полкодержатели сюда не входят. */
  fixedShelvesMm: number[];
  /** есть ли жёсткая задняя стенка в паз — она тоже держит диагональ */
  rigidBack: boolean;
}

/** Где должна встать стяжная полка. Правило основателя: на уровне верха базового корпуса, а если
 *  шкаф до туда не достаёт — по середине. */
export function tieShelfAtMm(c: Carcass, t = TIE_SHELF): number {
  return t.atMm < c.heightMm ? t.atMm : Math.round(c.heightMm / 2);
}

export const needsTieShelf = (c: Carcass, t = TIE_SHELF): boolean => c.heightMm >= t.aboveMm;

export function checkRacking(carcasses: Carcass[], t = TIE_SHELF): PhysicalProblem[] {
  const out: PhysicalProblem[] = [];
  for (const c of carcasses) {
    if (!needsTieShelf(c, t)) continue;
    if (c.fixedShelvesMm.length > 0) continue;
    out.push({
      law: "PHYS-RACK",
      board: c.id,
      setting: "profile.tieShelfAboveMm",
      detail:
        `корпус ${c.id} высотой ${c.heightMm}мм не имеет ни одной жёстко стянутой полки` +
        (c.rigidBack ? " (задняя стенка в паз задерживает перекос, но не отменяет его)" : "") +
        `. Полкодержатели дают ноль диагональной жёсткости — шкаф сложится в параллелограмм. ` +
        `Нужна стяжная полка на ${tieShelfAtMm(c, t)}мм.`,
    });
  }
  return out;
}

// ─── стяжная полка как ДЕТАЛЬ, а не как предупреждение ────────────────────────────────────────

export interface TieShelf {
  carcass: string;
  atMm: number;
  /** пролёт, который она стягивает — она же обязана сама пройти проверку на прогиб */
  widthMm: number;
  role: Role;
  /** почему она здесь: мастер, увидевший это в спецификации, не выбросит её как лишнюю */
  reason: string;
}

/** Обязательные стяжные полки для набора корпусов. Выводятся, как всё остальное, и идут в раскрой
 *  наравне с авторскими полками — у них будет номер, кромка и место на листе. */
export function deriveTieShelves(
  carcasses: (Carcass & { widthMm: number })[], t = TIE_SHELF,
): TieShelf[] {
  return carcasses
    .filter((c) => needsTieShelf(c, t) && c.fixedShelvesMm.length === 0)
    .map((c) => ({
      carcass: c.id,
      atMm: tieShelfAtMm(c, t),
      widthMm: c.widthMm,
      role: "shelf" as Role,
      reason:
        `стяжная: корпус ${c.heightMm}мм, без неё перекос. Ставится на конфирматы или эксцентрики, ` +
        `НЕ на полкодержатели.`,
    }));
}

/** Полный физический разбор — оба отказа в одном списке, потому что чинят их по-разному, а
 *  смотрят вместе. */
export const checkPhysics = (
  spans: SpanCheck[], carcasses: Carcass[], s = STRUCTURAL, t = TIE_SHELF,
): PhysicalProblem[] => [...checkDeflection(spans, s), ...checkRacking(carcasses, t)];

/** Свободный пролёт доски по списку опор под ней — вход для проверки прогиба. */
export function freeSpanOf(board: Board, supportsMm: number[]): number {
  const inside = supportsMm.filter((x) => x > board.from && x < board.to).sort((a, b) => a - b);
  const points = [board.from, ...inside, board.to];
  return points.slice(1).reduce((max, p, i) => Math.max(max, p - points[i]!), 0);
}
