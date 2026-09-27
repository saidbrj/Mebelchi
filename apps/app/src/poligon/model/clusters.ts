// ПОЛИГОН · R85 — кластеризация базы: как ряд из семи тумб перестаёт быть доской 4.5 метра.
//
// ЧТО СЛУЧИЛОСЬ. `deriveBoards` соединяет коллинеарные сегменты по непрерывности, и для дна
// ряда из семи тумб это дало ОДНУ деталь 4481 мм. Правило предела листа существовало — R71
// научил ему столешницу — и применялось не ко всему. Дно и цоколь остались сегментами стены.
//
// Доски 4481 мм не бывает. Три независимых предела, и каждый убивает её отдельно:
//   лист       ЛДСП варят до 2800 — такой плиты не существует в природе
//   транспорт  в лифт по диагонали влезает 2150, по лестнице девятиэтажки 2400
//   занос      жёсткий короб 4.5 м не наклонить в комнате с потолком 2.6
//
// ЧТО ДЕЛАЕТ ЦЕХ. Ряд собирают КЛАСТЕРАМИ по две-три тумбы, у каждого своё сплошное дно, и
// кластеры стыкуют на объекте. Это не компромисс и не деление пополам: это то, как мебель
// существует физически.
//
// И один случай, который спецификация называет прямо: под встроенной посудомойкой дна НЕТ
// ВООБЩЕ. Она стоит на полу. Секция ПММ разрывает ряд бесплатно — и это самое удобное место
// для границы кластера, если она есть.

import { STRUCTURAL } from "./settings";

/** Одна секция ряда: тумба со своей шириной и признаком, нужно ли ей дно. */
export interface RunSection {
  id: string;
  widthMm: number;
  /** false для встроенной техники, стоящей на полу */
  needsBottom: boolean;
}

export interface Cluster {
  /** секции, которые едут одной сборкой */
  sections: string[];
  fromMm: number;
  toMm: number;
  lengthMm: number;
  /** почему кластер кончился именно здесь */
  endedBy: "appliance" | "limit" | "end";
}

export interface ClusterPlan {
  clusters: Cluster[];
  /** секции без дна — они не в кластерах и деталей дна не дают */
  floorStanding: { id: string; fromMm: number; toMm: number }[];
  problems: { law: string; detail: string }[];
}

/**
 * R85 §1.2 — разложить ряд на кластеры сборки.
 *
 * Границы ставятся по двум причинам, и первая бесплатна: секция без дна (посудомойка) разрывает
 * ряд сама. Вторая — предел: набрали больше `clusterMaxMm`, закрываем кластер на предыдущей
 * секции. Делить ТУМБУ пополам нельзя никогда: граница кластера всегда проходит между тумбами,
 * над общей стойкой, где её есть чем держать.
 */
export function planClusters(
  sections: RunSection[], maxMm = STRUCTURAL.clusterMaxMm,
): ClusterPlan {
  const clusters: Cluster[] = [];
  const floorStanding: ClusterPlan["floorStanding"] = [];
  const problems: ClusterPlan["problems"] = [];

  let cur: { ids: string[]; from: number; len: number } | null = null;
  let x = 0;

  const close = (endedBy: Cluster["endedBy"]) => {
    if (!cur || cur.ids.length === 0) { cur = null; return; }
    clusters.push({
      sections: cur.ids, fromMm: cur.from, toMm: cur.from + cur.len,
      lengthMm: cur.len, endedBy,
    });
    cur = null;
  };

  for (const s of sections) {
    if (!s.needsBottom) {
      // техника на полу: дна нет, и ряд здесь разрывается бесплатно
      close("appliance");
      floorStanding.push({ id: s.id, fromMm: x, toMm: x + s.widthMm });
      x += s.widthMm;
      continue;
    }

    if (s.widthMm > maxMm) {
      // одна тумба шире предела — делить её нельзя, это отказ, а не повод разрезать корпус
      problems.push({
        law: "R85-CLUSTER",
        detail:
          `секция «${s.id}» шириной ${s.widthMm}мм сама длиннее предела сборки ${maxMm}мм. ` +
          `Границу кластера нельзя провести внутри тумбы — её нечем держать. Разделите тумбу стойкой.`,
      });
    }

    if (cur && cur.len + s.widthMm > maxMm) close("limit");
    if (!cur) cur = { ids: [], from: x, len: 0 };
    cur.ids.push(s.id);
    cur.len += s.widthMm;
    x += s.widthMm;
  }
  close("end");

  return { clusters, floorStanding, problems };
}

// ─── разбежка швов ────────────────────────────────────────────────────────────────────────────

export interface SeamSet {
  /** что за слой: дно, цоколь, столешница */
  layer: string;
  seamsMm: number[];
}

/**
 * R85 §1.4 — швы разных слоёв не должны совпадать.
 *
 * Если шов дна, шов цоколя и шов столешницы придутся на одно сечение, собранный ряд получает по
 * этой линии шарнир: ничто не держит его от складывания. Разносятся минимум на `seamStaggerMm`.
 */
export function checkSeamStagger(
  sets: SeamSet[], minMm = STRUCTURAL.seamStaggerMm,
): { law: string; detail: string }[] {
  const out: { law: string; detail: string }[] = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      for (const a of sets[i]!.seamsMm) {
        for (const b of sets[j]!.seamsMm) {
          const d = Math.abs(a - b);
          if (d >= minMm) continue;
          out.push({
            law: "R85-STAGGER",
            detail:
              `шов «${sets[i]!.layer}» на ${a}мм и шов «${sets[j]!.layer}» на ${b}мм разнесены ` +
              `на ${d}мм при минимуме ${minMm}мм. Совпавшие швы превращают ряд в шарнир — ` +
              `по этой линии он сложится.`,
          });
        }
      }
    }
  }
  return out;
}
