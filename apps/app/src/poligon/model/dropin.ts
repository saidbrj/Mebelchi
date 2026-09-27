// ПОЛИГОН · R97 — врезка падает ВНИЗ. Восходящая проекция отчуждения.
//
// В `spans.ts` вырез сегодня — отрезок на пробеге: он умеет запретить шов столешницы и больше
// ничего. Физически он не отрезок. Чаша мойки опускается на 200 мм НИЖЕ столешницы, а выпуск с
// сифоном — ещё на полтора раза глубже, и всё это происходит внутри тумбы, о которой вырез не
// знает. Отсюда классическая картинка сборки: корпус собран, столешница легла, и сифон упирается
// в ящик, который выпиливают лобзиком по месту.
//
// ─── ЧТО Я ВЗЯЛ ИЗ ИССЛЕДОВАНИЯ И ЧТО ПЕРЕДЕЛАЛ ──────────────────────────────────────────────
//
// Взял: вырез получает третье измерение и проецируется вниз; зона сифона отдельно от зоны чаши;
// индукции нужен приток воздуха.
//
// Переделал три вещи.
//
//   1. «Поворот царги на ребро освобождает 64 мм просвета» — неверно по оси. Царга плашмя
//      занимает 16 мм ПО ВЫСОТЕ и 80 мм В ГЛУБИНУ; на ребре — наоборот. Поворот выигрывает
//      глубину, а высоту как раз ТЕРЯЕТ: на ребре царга свисает на 80 вниз и съедает проём.
//      Здесь считается то, что происходит на самом деле, и цена поворота называется вслух.
//
//   2. «Чаша пересекла стойку → жёсткий REFUSAL» — это барьер, а не ответ. Мойка, вставшая на
//      две тумбы, означает ровно одно: под ней должна быть ОДНА тумба. Шов между ними уже умеет
//      быть открытым (`applySeams`, состояние `open`), и движок называет этот шов и ширину
//      объединённого корпуса. Отказ остаётся там, где физика: если объединённый корпус не лезет
//      в транспортный предел, дальше действительно нельзя.
//
//   3. Числа. В исследовании они в тексте — 200, 350, 75, 50. Здесь они в
//      `things/tables/dropin/`, потому что мойка у другого поставщика будет другой.
//
// ─── ЧЕГО ЗДЕСЬ НЕТ ──────────────────────────────────────────────────────────────────────────
//
// Движок не моделирует царги как детали каркаса: базовый корпус закрывается стяжной полкой
// (`physics.ts`). Поэтому под чашей заменяется именно она, и замена выдаёт ДЕТАЛИ, а не
// предупреждение — как усечённая полка в R95.

import { DROPIN, TRANSPORT_MAX_MM } from "./settings";
import type { Role } from "./roles";

export interface DropInProblem {
  law: string;
  detail: string;
  setting: string;
  at?: string;
}

export interface DropIn {
  id: string;
  kind: "sink" | "hob";
  /** вдоль пробега, мм от его начала — края выреза */
  fromMm: number;
  toMm: number;
  /** от переднего края столешницы вглубь */
  frontSetbackMm: number;
  depthMm: number;
}

/** Объём отчуждения. Их у одной мойки два, и вложены они не концентрически. */
export interface KeepOut {
  of: string;
  kind: DropIn["kind"];
  /** `body` — габарит самой техники; у мойки это чаша, у панели её корпус */
  zone: "body" | "plumbing" | "vent";
  fromMm: number;
  toMm: number;
  /** от переднего края столешницы */
  frontMm: number;
  backMm: number;
  /** насколько ниже НИЖНЕЙ плоскости столешницы */
  dropMm: number;
}

/**
 * Чаша — габарит раковины. Сифон — узкий столб по центру чаши, но глубже её в полтора раза.
 * Варочная опускается неглубоко, зато требует воздуха под собой, и это отдельная зона: в неё
 * нельзя ставить глухое дно, но можно пустить трубу.
 */
export function keepOutsOf(d: DropIn, s = DROPIN): KeepOut[] {
  const base = { of: d.id, kind: d.kind, fromMm: d.fromMm, toMm: d.toMm,
                 frontMm: d.frontSetbackMm, backMm: d.frontSetbackMm + d.depthMm };

  if (d.kind === "hob") {
    return [
      { ...base, zone: "body", dropMm: s.hobDropMm },
      { ...base, zone: "vent", dropMm: s.hobVentGapMm },
    ];
  }

  const centre = (d.fromMm + d.toMm) / 2;
  const half = s.plumbingWidthMm / 2;
  return [
    { ...base, zone: "body", dropMm: s.sinkDropMm },
    {
      of: d.id, kind: d.kind, zone: "plumbing",
      fromMm: centre - half, toMm: centre + half,
      frontMm: d.frontSetbackMm, backMm: d.frontSetbackMm + d.depthMm,
      dropMm: s.plumbingDropMm,
    },
  ];
}

// ─── что стоит под столешницей ────────────────────────────────────────────────────────────────

export interface Partition {
  atMm: number;
  thicknessMm: number;
  ref: string;
  /** имя шва — движок назовёт его, когда шов придётся открыть */
  seam?: string;
}

export interface UnderShelf {
  /** стяжная полка или авторская — важно только то, что она горизонтальна и сплошная */
  id: string;
  fromMm: number;
  toMm: number;
  /** насколько ниже столешницы её верхняя плоскость */
  belowMm: number;
  kind: "tie" | "shelf" | "drawer-box";
}

export interface UnderCarcass {
  partitions: Partition[];
  shelves: UnderShelf[];
  /** глубина корпуса под столешницей */
  depthMm: number;
  /** ширина проёма, которая получится, если открыть шов под вырезом */
  mergedWidthMm?: number;
}

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

/**
 * Что делать. Решает ЗОНА, а не деталь: под варочной панелью короб ящика чинится не так, как под
 * мойкой, хотя это один и тот же короб. Порядок ветвей — от самого частного к общему.
 */
function fixFor(z: KeepOut, sh: UnderShelf, s = DROPIN): string {
  if (z.kind === "hob") {
    return `Панель физически встанет на неё — опустите горизонталь ниже ${z.dropMm}мм.`;
  }
  if (sh.kind === "tie") {
    return `Стяжку под чашей заменяют две узкие царги ${s.railWidthMm} спереди и сзади — ` +
      `это ДРУГИЕ детали, а не укороченная полка.`;
  }
  if (sh.kind === "drawer-box") {
    return `Нужен П-образный короб с вырезом под сифон — ящик не отменяется, он другой.`;
  }
  return `Полку опускают ниже ${z.dropMm}мм или снимают.`;
}

// ─── проекция вниз ────────────────────────────────────────────────────────────────────────────

/**
 * R97.1 — вырез проецируется вниз и встречает каркас.
 *
 * Порядок находок не случаен: сначала то, что меняет СОСТАВ деталей (стойка, полка), потом то,
 * что меняет их размер. Разбираться в обратном порядке значит пересчитывать дважды.
 */
export function projectDown(
  cutouts: DropIn[], c: UnderCarcass, s = DROPIN, transportMaxMm = TRANSPORT_MAX_MM,
): DropInProblem[] {
  const out: DropInProblem[] = [];

  for (const d of cutouts) {
    const zones = keepOutsOf(d, s);
    const body = zones.find((z) => z.zone === "body")!;

    // ── глубина: чаша глубже корпуса — дальше считать нечего ────────────────────────────────
    if (body.backMm > c.depthMm) {
      out.push({
        law: "ASCENDING-KEEPOUT", at: d.id,
        setting: "tables/dropin.sinkDropMm",
        detail:
          `вырез ${d.id} уходит на ${body.backMm}мм вглубь при корпусе ${c.depthMm}мм. ` +
          `Задняя кромка чаши повиснет за задней стенкой — либо мойка меньше, либо тумба глубже.`,
      });
    }

    // ── стойка внутри выреза: это не отказ, это ОДНА тумба ──────────────────────────────────
    for (const p of c.partitions) {
      const lo = p.atMm - p.thicknessMm / 2, hi = p.atMm + p.thicknessMm / 2;

      if (overlaps(lo, hi, body.fromMm, body.toMm)) {
        const merged = c.mergedWidthMm;
        out.push({
          law: "ASCENDING-KEEPOUT", at: d.id,
          setting: "tables/dropin.toPartitionMm",
          detail:
            `чаша ${d.id} перерезает стойку ${p.ref} на отметке ${p.atMm}мм. Мойка стоит в ОДНОЙ ` +
            `тумбе — шов${p.seam ? ` «${p.seam}»` : ""} под вырезом обязан стать открытым` +
            (merged ? `, и тумба выйдет шириной ${merged}мм` : ``) + `.`,
        });
        if (merged !== undefined && merged > transportMaxMm) {
          out.push({
            law: "ASCENDING-KEEPOUT", at: d.id,
            setting: "profile.transportMaxMm",
            detail:
              `объединённая тумба ${merged}мм не проходит транспортный предел ${transportMaxMm}. ` +
              `Здесь шов открыть уже нельзя — двигайте мойку внутрь одной из секций.`,
          });
        }
        continue;
      }

      // ── стойка рядом: столешнице не на чём лежать по краю выреза ──────────────────────────
      const gap = Math.min(Math.abs(p.atMm - body.fromMm), Math.abs(p.atMm - body.toMm));
      if (gap < s.toPartitionMm) {
        out.push({
          law: "ASCENDING-KEEPOUT", at: d.id,
          setting: "tables/dropin.toPartitionMm",
          detail:
            `край выреза ${d.id} проходит в ${Math.round(gap)}мм от стойки ${p.ref} при минимуме ` +
            `${s.toPartitionMm}. Между вырезом и стойкой не остаётся плиты: столешницу не на чём ` +
            `держать, и по этой перемычке она треснет от первой же горячей кастрюли.`,
        });
      }
    }

    // ── горизонтали: полки, стяжки, короба ящиков ──────────────────────────────────────────
    //
    // Одна горизонталь — одна находка. Стяжка под чашей попадает и в зону чаши, и в зону сифона,
    // потому что столб сифона стоит внутри габарита чаши; чинится это один раз, и писать об этом
    // дважды значит заставить мастера искать вторую причину, которой нет. Зоны перебираются от
    // мелкой к глубокой, и первая же остановка — та, о которой стоит говорить.
    for (const sh of c.shelves) {
      for (const z of zones) {
        if (!overlaps(sh.fromMm, sh.toMm, z.fromMm, z.toMm)) continue;
        if (sh.belowMm >= z.dropMm) continue;

        if (z.zone === "vent") {
          out.push({
            law: "ASCENDING-KEEPOUT", at: d.id,
            setting: "tables/dropin.hobVentGapMm",
            detail:
              `под варочной ${d.id} глухая горизонталь ${sh.id} стоит в ${sh.belowMm}мм от ` +
              `столешницы при нужных ${z.dropMm}. Индукции нужен приток на охлаждение силовых ` +
              `ключей: без него панель уходит в аварийную блокировку, и это гарантийный случай.`,
          });
          break;
        }

        const what = sh.kind === "tie" ? "стяжная полка"
          : sh.kind === "drawer-box" ? "короб ящика" : "полка";
        out.push({
          law: "ASCENDING-KEEPOUT", at: d.id,
          setting: z.zone === "body" ? "tables/dropin.sinkDropMm" : "tables/dropin.sinkPlumbingDropMm",
          detail:
            `${what} ${sh.id} на ${sh.belowMm}мм ниже столешницы попадает в зону ` +
            (z.zone === "plumbing" ? `выпуска и сифона (${z.dropMm}мм)`
              : z.kind === "hob" ? `корпуса варочной панели (${z.dropMm}мм)`
              : `чаши (${z.dropMm}мм)`) +
            `. ` + fixFor(z, sh, s),
        });
        break;
      }
    }
  }

  return out;
}

// ─── замена стяжной полки ─────────────────────────────────────────────────────────────────────

export interface Rail {
  id: string;
  role: Role;
  /** длина вдоль стены */
  lengthMm: number;
  /** ширина заготовки */
  widthMm: number;
  /** плашмя или на ребро */
  lay: "flat" | "on-edge";
  /** сколько она съедает у проёма по высоте */
  eatsOpeningMm: number;
  reason: string;
}

/**
 * R97.2 — стяжная полка под мойкой превращается в две царги.
 *
 * ПЕРЕДНЯЯ ставится НА РЕБРО. Плашмя она уходит на `railWidthMm` вглубь и попадает прямо под
 * переднюю кромку чаши; на ребре занимает вглубь одну толщину. Цена поворота честная и здесь
 * названа: на ребре царга свисает вниз на всю свою ширину и ровно на столько же уменьшает
 * чистый проём под фасад. Задняя остаётся плашмя — там чаше ничего не мешает, а плашмя она ещё
 * и поверхность, в которую снизу тянут столешницу.
 */
export function railsForCutout(
  carcassId: string, widthMm: number, thicknessMm: number, d: DropIn, s = DROPIN,
): Rail[] {
  const frontOnEdge = d.frontSetbackMm < s.railWidthMm;
  return [
    {
      id: `${carcassId}-царга-перед`, role: "top", lengthMm: widthMm,
      widthMm: s.railWidthMm, lay: frontOnEdge ? "on-edge" : "flat",
      eatsOpeningMm: frontOnEdge ? s.railWidthMm : thicknessMm,
      reason: frontOnEdge
        ? `на ребро: плашмя она уходит на ${s.railWidthMm} вглубь и встаёт под кромку чаши, ` +
          `которая начинается с ${d.frontSetbackMm}. Съедает ${s.railWidthMm} чистого проёма.`
        : `плашмя: чаша начинается с ${d.frontSetbackMm}, места хватает.`,
    },
    {
      id: `${carcassId}-царга-зад`, role: "top", lengthMm: widthMm,
      widthMm: s.railWidthMm, lay: "flat", eatsOpeningMm: thicknessMm,
      reason: `плашмя: сзади чаше ничто не мешает, а плашмя царга ещё и поверхность, ` +
        `в которую снизу тянут столешницу.`,
    },
  ];
}

/** Проём, оставшийся под фасад после того, как царги встали. */
export function openingAfterRails(
  clearHeightMm: number, rails: Rail[], declaredFrontMm: number,
): DropInProblem[] {
  const left = clearHeightMm - rails.reduce((n, r) => n + r.eatsOpeningMm, 0);
  if (left >= declaredFrontMm) return [];
  return [{
    law: "ASCENDING-KEEPOUT",
    setting: "tables/dropin.railWidthMm",
    detail:
      `после царг под проём остаётся ${left}мм, а объявленный фасад ${declaredFrontMm}. ` +
      `Передняя царга на ребре — плата за чашу: она свисает на ${rails[0]?.eatsOpeningMm ?? 0}. ` +
      `Либо мойка мельче и царга ложится плашмя, либо фасад ниже.`,
  }];
}
