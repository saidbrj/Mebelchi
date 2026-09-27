// ПОЛИГОН · R71 — горизонтальные пробеги: столешница, цоколь, карниз.
//
// ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ ОБЪЕКТ. Столешница не принадлежит ни одному шкафу. Она лежит поперёк
// четырёх и продолжается за них, покупается отдельной заготовкой, и режется по своим правилам.
// Пытаться выразить её сегментами стены — значит однажды поставить линию стыка на стене, и эта
// линия разрежет тумбы под ней. Стык столешницы не является координатой стены.
//
// Поэтому пробег ВЛАДЕЕТ своими стыками, а шкафы только УПОМИНАЮТСЯ им как опоры. Сдвинули
// перегородку — стык пересчитался к ближайшей доступной опоре. Не нашлось опоры в допуске —
// вот тогда отказ. Перегородка никогда не блокируется столешницей: слои независимы (L3).
//
// СТЫК ОБЯЗАН ЛЕЖАТЬ НА ОПОРЕ. Шов, висящий в воздухе над ящиком, стягивается винтами в пустоту:
// через год он расходится, влага заходит в срез, и плита разбухает по кромке шва. Приоритеты
// взяты из R71 §2.3, а расстояния — из файла, потому что это факты о материале, не о коде.

import { STRUCTURAL } from "./settings";

export type SpanElement = "worktop" | "plinth" | "cornice" | "pelmet";

/** Вырез под мойку или варочную панель — зона, где шва быть не может. */
export interface Cutout {
  kind: "sink" | "hob" | "other";
  /** вдоль пробега, мм от его начала */
  fromMm: number;
  toMm: number;
}

/** Опора: вертикальная перегородка под пробегом. */
export interface Support {
  /** мм от начала пробега */
  atMm: number;
  /** перегородка корпуса держит жёстче, чем царга или перекладина */
  kind: "partition" | "rail";
  /** что именно там стоит — для сообщения, не для геометрии */
  ref: string;
}

export interface JointPoint {
  atMm: number;
  /** на чём он лежит */
  on: Support;
  /** какой приоритет из R71 §2.3 сработал */
  priority: 1 | 2;
}

export interface SpanProblem {
  law: string;
  detail: string;
  atMm?: number;
}

export interface HorizontalSpan {
  id: string;
  element: SpanElement;
  /** слой L3: столешница лежит НАД каркасом, цоколь ПЕРЕД ним */
  layer: "above" | "front";
  lengthMm: number;
  depthMm: number;
  thicknessMm: number;
  /** длина заготовки, из файла материала */
  stockLengthMm: number;
  supports: Support[];
  cutouts: Cutout[];
}

export interface SpanPlan {
  joints: JointPoint[];
  /** ОТКАЗЫ: так резать нельзя */
  problems: SpanProblem[];
  /** ЗАМЕЧАНИЯ: так резать можно, но материала уйдёт больше. Отдельно от отказов, потому что
   *  список, где перемешаны «нельзя» и «дороже», перестают читать целиком. */
  notes: SpanProblem[];
  /** куски, на которые пробег распадётся — это и есть то, что закажут */
  pieces: { fromMm: number; toMm: number; lengthMm: number }[];
}

/** Запрещена ли точка: внутри выреза или ближе зазора к его краю. */
function nearCutout(atMm: number, cutouts: Cutout[], clearMm: number): Cutout | undefined {
  return cutouts.find((c) => atMm > c.fromMm - clearMm && atMm < c.toMm + clearMm);
}

/**
 * R71 §2.3 — разложить пробег на куски не длиннее заготовки, посадив каждый шов на опору.
 *
 * Идеальная точка шва — максимально далеко, но в пределах заготовки. Вокруг неё ищется опора в
 * радиусе из файла: сначала перегородка (приоритет 1), потом перекладина (приоритет 2). Опора
 * внутри выреза или рядом с ним не годится, какой бы близкой ни была.
 */
export function planSpan(span: HorizontalSpan, s = STRUCTURAL): SpanPlan {
  const problems: SpanProblem[] = [];
  const notes: SpanProblem[] = [];
  const joints: JointPoint[] = [];

  let cursor = 0;
  let guard = 0;
  while (span.lengthMm - cursor > span.stockLengthMm) {
    if (++guard > 64) break;                       // пробег длиной в квартал — не наш случай
    const ideal = cursor + span.stockLengthMm;

    // Любая опора, до которой кусок укладывается в заготовку, ГОДИТСЯ. Шов не обязан стоять на
    // максимуме — он обязан стоять там, где ни один кусок заготовку не превысит. Первая версия
    // требовала опору в радиусе 150 мм от идеальной точки и отказывала на самой обычной кухне:
    // ряд 4500 на тумбах по 900, идеал 3050, ближайшая перегородка 2700 — 350 мм мимо. Цех режет
    // такое каждый день, ставя шов на 2700.
    //
    // Поэтому: берём САМУЮ ДАЛЬНЮЮ годную опору (кусков будет меньше), перегородку вперёд
    // перекладины. Радиус поиска остаётся — но как мера РАСТОЧИТЕЛЬНОСТИ, а не законности.
    const usable = span.supports
      .filter((sp) => sp.atMm > cursor && sp.atMm <= ideal)
      .filter((sp) => !nearCutout(sp.atMm, span.cutouts, s.cutoutClearanceMm))
      .sort((a, b) =>
        (a.kind === b.kind ? b.atMm - a.atMm            // дальше = лучше
                           : a.kind === "partition" ? -1 : 1));

    const pick = usable[0];
    if (!pick) {
      const blocked = span.supports
        .filter((sp) => sp.atMm > cursor && sp.atMm <= ideal)
        .find((sp) => nearCutout(sp.atMm, span.cutouts, s.cutoutClearanceMm));
      problems.push({
        law: "R71-JOINT",
        atMm: ideal,
        detail: blocked
          ? `шов нужен около ${Math.round(ideal)}мм, и ближайшая опора на ${blocked.atMm}мм ` +
            `попадает в зону выреза (${s.cutoutClearanceMm}мм от края) — там шов разбухнет и лопнет. ` +
            `Сдвиньте перегородку или вырез.`
          : `шов нужен около ${Math.round(ideal)}мм, но в радиусе ${s.jointSearchRadiusMm}мм ` +
            `нет ни одной опоры — шов повиснет над ящиком и через год разойдётся. ` +
            `Добавьте перегородку или перекладину.`,
      });
      break;
    }

    joints.push({ atMm: pick.atMm, on: pick, priority: pick.kind === "partition" ? 1 : 2 });
    if (ideal - pick.atMm > s.jointSearchRadiusMm) {
      notes.push({
        law: "R71-WASTE", atMm: pick.atMm,
        detail:
          `шов на ${pick.atMm}мм при заготовке ${span.stockLengthMm}мм — ` +
          `${Math.round(ideal - pick.atMm)}мм длины уходит в обрезь. Ближе к ${Math.round(ideal)}мм ` +
          `опоры нет; это не ошибка, но материал считается по заготовкам.`,
      });
    }
    cursor = pick.atMm;
  }

  const cuts = [0, ...joints.map((j) => j.atMm), span.lengthMm];
  const pieces = cuts.slice(1).map((to, i) => ({
    fromMm: cuts[i]!, toMm: to, lengthMm: to - cuts[i]!,
  }));

  // и после раскладки — ни один кусок не должен превышать заготовку
  for (const p of pieces) {
    if (p.lengthMm > span.stockLengthMm) {
      problems.push({
        law: "R71-STOCK", atMm: p.fromMm,
        detail:
          `кусок ${Math.round(p.lengthMm)}мм длиннее заготовки ${span.stockLengthMm}мм — ` +
          `такой ${span.element} не купить целым.`,
      });
    }
  }

  return { joints, problems, notes, pieces };
}

/** Прямая проверка: не попал ли УЖЕ поставленный шов в вырез. Отдельно от планировщика, потому
 *  что шов может быть поставлен вручную. */
export function checkJointCutouts(span: HorizontalSpan, s = STRUCTURAL): SpanProblem[] {
  const out: SpanProblem[] = [];
  for (const c of span.cutouts) {
    for (const j of planSpan(span, s).joints) {
      if (!nearCutout(j.atMm, [c], s.cutoutClearanceMm)) continue;
      out.push({
        law: "R71-CUTOUT", atMm: j.atMm,
        detail:
          `шов на ${j.atMm}мм ближе ${s.cutoutClearanceMm}мм к вырезу под ${c.kind} ` +
          `(${c.fromMm}…${c.toMm}) — вода со среза зайдёт в шов, и плита вспучится.`,
      });
    }
  }
  return out;
}
