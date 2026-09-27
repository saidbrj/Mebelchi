// ПОЛИГОН · R95 — пенал: тепло, вес, потолок.
//
// Пенал концентрирует в одном секторе три вещи, которых больше нигде нет: киловатты тепла от
// встроенной техники, двести килограммов на четырёх пластиковых ногах, и фасад, который при
// открывании уходит ВЫШЕ крыши шкафа.
//
// ВЕНТШАХТА. Холодильник и духовка греют. Глухой пенал — сгоревший компрессор через три месяца
// и аннулированная гарантия Bosch, Siemens, Miele, Liebherr. Воздух обязан идти снизу вверх
// непрерывно: решётка в цоколе → мимо УСЕЧЁННЫХ полок → выход наверху.
//
// И усечённая полка — это ДРУГАЯ деталь раскроя, а не пометка в чертеже: её задний торец
// становится видимым срезом над радиатором, где горячий влажный воздух за полгода разбухает
// ЛДСП. Значит там нужна кромка, и это единственное место, где кромка ставится на торец,
// который никто не увидит.

import { TALL } from "./settings";

export interface TallProblem {
  law: string;
  detail: string;
  setting: string;
}

// ─── вентшахта ────────────────────────────────────────────────────────────────────────────────

export interface Chimney {
  /** ширина корпуса — от неё считается живое сечение */
  widthMm: number;
  /** стоит ли в этом отсеке прибор НА полке — тогда её усекать нельзя */
  applianceOnShelf?: boolean;
  /** высота решётки в цоколе */
  plinthGrilleHeightMm: number;
  /** есть ли выход наверху */
  topExhaust: boolean;
  /** объявлена ли задняя стенка в отсеке техники */
  applianceBack: boolean;
  /** какие горизонтали усечены сзади */
  shelvesTruncated: boolean;
}

/** Живое сечение канала = ширина × высота, в см². */
export const chimneyAreaCm2 = (widthMm: number, heightMm: number): number =>
  Math.round((widthMm * heightMm) / 100) / 100 * 100 / 100;

export function checkChimney(c: Chimney, s = TALL): TallProblem[] {
  const out: TallProblem[] = [];
  const inlet = (c.widthMm * c.plinthGrilleHeightMm) / 100;   // мм² → см²

  if (inlet < s.chimneyAreaCm2) {
    out.push({
      law: "TALL-CHIMNEY",
      setting: "tables/tall.chimneyAreaCm2",
      detail:
        `решётка в цоколе даёт ${Math.round(inlet)} см² при минимуме ${s.chimneyAreaCm2}. ` +
        `Компрессор холодильника без протока перегревается: расход растёт, гарантия ` +
        `аннулируется. Ширина ${c.widthMm}мм требует высоты решётки от ` +
        `${Math.ceil((s.chimneyAreaCm2 * 100) / c.widthMm)}мм.`,
    });
  }

  if (!c.topExhaust) {
    out.push({
      law: "TALL-CHIMNEY",
      setting: "tables/tall.chimneyAreaCm2",
      detail:
        `вход в цоколе есть, выхода наверху нет. Воздух не течёт в закрытую трубу — ` +
        `нужен зазор под потолком или теневая щель, не меньше входа.`,
    });
  }

  if (c.applianceBack) {
    out.push({
      law: "TALL-CHIMNEY",
      setting: "tables/tall.chimneySetbackMm",
      detail:
        `в отсеке техники объявлена задняя стенка ХДФ. Она глушит шахту: конденсатор ` +
        `холодильника обязан выбрасывать тепло прямо в полость. В этом отсеке задней стенки ` +
        `не бывает.`,
    });
  }

  if (c.applianceOnShelf && c.shelvesTruncated) {
    out.push({
      law: "TALL-SHELF-RELIEF",
      setting: "tables/tall.chimneySetbackMm",
      detail:
        `в этом отсеке прибор стоит НА полке, а полка объявлена усечённой. Встраиваемый шкаф ` +
        `глубиной 550–565 опирается на неё почти всей длиной: срезать задние ` +
        `${s.chimneySetbackMm}мм значит оставить его висеть над шахтой. Полка остаётся полной, ` +
        `воздух идёт двумя угловыми вырезами у задней кромки — их берут на той же пиле.`,
    });
  } else if (!c.applianceOnShelf && !c.shelvesTruncated) {
    out.push({
      law: "TALL-CHIMNEY",
      setting: "tables/tall.chimneySetbackMm",
      detail:
        `полки идут во всю глубину и режут шахту поперёк. Каждая горизонталь за техникой ` +
        `усекается сзади на ${s.chimneySetbackMm}мм — это ДРУГОЙ размер детали, а не ` +
        `пометка в чертеже.`,
    });
  }

  return out;
}

/** Глубина усечённой полки и то, что её задний торец теперь ВИДЕН. */
export interface TruncatedShelf {
  /** полная глубина, как у обычной полки */
  fullDepthMm: number;
  /** глубина после усечения */
  cutDepthMm: number;
  /** задний торец над радиатором: горячий влажный воздух */
  rearEdgeBanded: boolean;
}

/**
 * R95.1 ИСПРАВЛЕНО — полка, НА КОТОРОЙ СТОИТ ПРИБОР, не усекается.
 *
 * Мой первый вариант резал сзади КАЖДУЮ горизонталь в шахте, включая ту, на которую встаёт
 * духовка. Встраиваемый шкаф глубиной 550–565 опирается на полку почти всей своей длиной; убрать
 * у неё задние 50 значит оставить прибор висеть задним краем над шахтой.
 *
 * Но и воздух этой полке нужен. Проход делается ДВУМЯ УГЛОВЫМИ ВЫРЕЗАМИ у задней кромки, а не
 * сквозным окном посередине: окно — это фрезеровка на обрабатывающем центре, а угол берётся на
 * той же форматно-раскроечной пиле, что и всё остальное. Цех без фрезера не должен упираться в
 * деталь, которую ему нечем сделать.
 *
 * Ширина выреза не назначена, а ВЫЧИСЛЕНА из требуемого сечения: два выреза глубиной
 * `chimneySetbackMm` обязаны вместе дать `chimneyAreaCm2`. Между ними остаётся полоса, на
 * которой прибор и стоит — если она уже объявленной, полка отказывается.
 */
export interface ReliefShelf {
  fullDepthMm: number;
  widthMm: number;
  /** глубина углового выреза от задней кромки */
  reliefDepthMm: number;
  /** ширина КАЖДОГО из двух вырезов */
  reliefWidthMm: number;
  /** полоса, оставшаяся между ними */
  keepMm: number;
  areaCm2: number;
  rearEdgeBanded: boolean;
}

export function reliefShelf(fullDepthMm: number, widthMm: number, s = TALL): ReliefShelf {
  const reliefDepthMm = s.chimneySetbackMm;
  // 2 · w · d = площадь → w = площадь / (2 · d)
  const reliefWidthMm = Math.ceil((s.chimneyAreaCm2 * 100) / (2 * reliefDepthMm));
  return {
    fullDepthMm, widthMm, reliefDepthMm, reliefWidthMm,
    keepMm: widthMm - 2 * reliefWidthMm,
    areaCm2: (2 * reliefWidthMm * reliefDepthMm) / 100,
    rearEdgeBanded: true,
  };
}

export function checkReliefShelf(r: ReliefShelf, s = TALL): TallProblem[] {
  const out: TallProblem[] = [];

  if (r.keepMm < s.reliefKeepMm) {
    out.push({
      law: "TALL-SHELF-RELIEF",
      setting: "tables/tall.reliefKeepMm",
      detail:
        `между угловыми вырезами остаётся ${r.keepMm}мм полки при минимуме ${s.reliefKeepMm}. ` +
        `Прибор стоит именно на этой полосе: вырезать сечение ${s.chimneyAreaCm2}см² в полке ` +
        `шириной ${r.widthMm} нечем. Тяга этого отсека идёт снизу и сверху, а не сквозь полку.`,
    });
  }

  if (!r.rearEdgeBanded) {
    out.push({
      law: "TALL-SHELF-REAR-EDGE",
      setting: "tables/fill.roleEdges",
      detail:
        `кромки угловых вырезов открыты. Они стоят в том же тёплом влажном потоке, что и задний ` +
        `срез усечённой полки, и разбухают так же.`,
    });
  }

  return out;
}

export function truncateShelf(fullDepthMm: number, s = TALL): TruncatedShelf {
  return {
    fullDepthMm,
    cutDepthMm: fullDepthMm - s.chimneySetbackMm,
    rearEdgeBanded: true,
  };
}

export function checkTruncatedShelf(t: TruncatedShelf): TallProblem[] {
  if (t.rearEdgeBanded) return [];
  return [{
    law: "TALL-SHELF-REAR-EDGE",
    setting: "tables/fill.roleEdges",
    detail:
      `задний срез усечённой полки не окромлён. Он стоит над радиатором: горячий влажный ` +
      `воздух за полгода разбухает открытый ЛДСП. Это единственный торец, который кромкуют ` +
      `не ради вида.`,
  }];
}

// ─── вес ──────────────────────────────────────────────────────────────────────────────────────

export interface TallLoad {
  widthMm: number;
  /** суммарный вес: корпус, техника, наполнение */
  totalKg: number;
  legs: number;
  /** насколько крайние ноги отстоят от боковин */
  outerLegOffsetMm: number;
}

export function checkLegs(t: TallLoad, s = TALL): TallProblem[] {
  const out: TallProblem[] = [];
  const need = t.totalKg >= s.heavyLoadKg ? s.legsHeavyCount : s.legsBaseCount;

  if (t.legs < need) {
    out.push({
      law: "TALL-LEGS",
      setting: "tables/tall.legsHeavyCount",
      detail:
        `${t.totalKg}кг на ${t.legs} ногах при требуемых ${need}. Четырёх ног хватает пустому ` +
        `шкафу; под духовкой и наполнением дно прогибается, а пластик лопается на сдвиг, когда ` +
        `шкаф двигают на место.`,
    });
  }

  if (t.outerLegOffsetMm > s.legUnderSideMm) {
    out.push({
      law: "TALL-LEGS",
      setting: "tables/tall.legUnderSideMm",
      detail:
        `крайние ноги отстоят от боковин на ${t.outerLegOffsetMm}мм при допустимых ` +
        `${s.legUnderSideMm}. Нога должна стоять ПОД боковиной и передавать вес прямо в пол; ` +
        `иначе он идёт через дно на изгиб.`,
    });
  }

  return out;
}

// ─── потолок ──────────────────────────────────────────────────────────────────────────────────

export interface LiftClearance {
  /** дуга механизма над крышей — ОБЪЯВЛЕНА В ФАЙЛЕ ПОДЪЁМНИКА, а не порогом */
  sweepMm: number;
  /** сколько есть от крыши до потолка в точке замера */
  availableMm: number;
  /** перепад потолка на длине кухни. Не задан — значит потолок не мерян */
  deviationMm?: number;
  /** объявлена ли доборная планка */
  fillerMm?: number;
}

/**
 * R95.3 — дуга подъёмника.
 *
 * Исследование даёт порог 45 мм и тут же пишет, что фасад поднимается на 40–80 над крышей. Если
 * дуга доходит до 80, сорок пять не спасают — текст спорит сам с собой.
 *
 * Поэтому дуга здесь не порог, а СВОЙСТВО МЕХАНИЗМА из его файла: у HF она 80, у HK меньше, и
 * одно число на все модели неверно по определению.
 */
export function checkLiftClearance(l: LiftClearance, s = TALL): TallProblem[] {
  // Потолок не плоский. На трёх-четырёх метрах кухни монолит или гипсокартон уходит на
  // сантиметр-два, и зазор, померенный в одной точке, к другому краю уже не тот. Считать надо
  // от ХУДШЕЙ точки; пока потолок не мерян, худшая берётся из файла и об этом говорится вслух.
  const measured = l.deviationMm !== undefined;
  const deviationMm = l.deviationMm ?? s.ceilingDeviationMm;
  const worstMm = l.availableMm - deviationMm + (l.fillerMm ?? 0);
  if (worstMm >= l.sweepMm) return [];
  return [{
    law: "TALL-LIFT-CEILING",
    setting: "things/lifts/",
    detail:
      `подъёмнику нужно ${l.sweepMm}мм над крышей. В худшей точке потолка есть ${worstMm}` +
      (l.fillerMm ? ` (включая доборную планку ${l.fillerMm})` : ``) +
      `мм: ${l.availableMm} минус перепад ${deviationMm}` +
      (measured ? ` по замеру` : ` — потолок НЕ МЕРЯН, взят перепад из файла`) +
      `. Фасад разобьёт гипсокартон или порвёт натяжной потолок при первом открывании. ` +
      `Дуга объявлена в файле механизма — у другой модели она другая.`,
  }];
}

/**
 * Заготовка доборной планки под потолок. Она пилится С ПРИПУСКОМ и подрезается по месту: планка,
 * отпиленная в номинал, на кривом потолке ляжет со щелью в сантиметр с одного края. Припуск
 * помечается в спецификации, иначе его снимут на раскрое как ошибку.
 */
export interface CeilingFiller {
  nominalMm: number;
  marginMm: number;
  /** что пилить */
  cutMm: number;
  trimOnSite: true;
}

export const ceilingFiller = (nominalMm: number, s = TALL): CeilingFiller => ({
  nominalMm, marginMm: s.scribeMarginMm,
  cutMm: nominalMm + s.scribeMarginMm, trimOnSite: true,
});

/** Пенал с техникой у стены: дверь холодильника должна открыться дальше 90°. */
export function checkApplianceScribe(gapMm: number, s = TALL): TallProblem[] {
  if (gapMm >= s.applianceScribeMm) return [];
  return [{
    law: "TALL-SCRIBE",
    setting: "tables/tall.applianceScribeMm",
    detail:
      `пенал с техникой стоит в ${gapMm}мм от стены при минимуме ${s.applianceScribeMm}. ` +
      `Дверь холодильника не откроется за 90°, и ящики с полками не вынуть для мытья.`,
  }];
}
