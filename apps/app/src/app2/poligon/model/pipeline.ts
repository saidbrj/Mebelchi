// ПОЛИГОН · R84 — один проход, и почему тип важнее проверки.
//
// ЧТО СЛУЧИЛОСЬ. `planSpan` нашёл, что шов столешницы на 3000 упирается в мойку, и перенёс его
// на 1800. `release` об этом не узнал никогда: он читает `deriveBoards`, а тот читает сырую линию
// стены длиной 4513. Оба слоя покрыты тестами. Оба зелёные. Между ними ничего.
//
// Проверкой это не чинится. Проверку можно забыть добавить в новом месте, а через полгода
// появится второй `release`, и всё повторится. Чинится ТИПОМ: раскрой принимает только доску,
// которая уже прошла предел листа, и неразрезанная туда физически не попадает — не потому что
// её ловят, а потому что её нельзя передать.
//
//   [1] стена .mebl
//        ↓ resolveMacroRuns      — сырые непрерывные прогоны
//   [2] MacroRun                 ← НЕ принимается раскроем
//        ↓ applyStockLimits      — режет по листу и кластерам, сажает швы на стойки
//   [3] StockSplitBoard          ← только это раскрой и принимает
//        ↓ compileRelease
//   [4] спецификация
//
// Метка `__stockChecked` не поле данных, а доказательство прохождения. Собрать её вручную можно
// ровно одним способом — вызвав `applyStockLimits`, и это единственная функция, которая её ставит.

import type { Board } from "./runs";
import { STRUCTURAL } from "./settings";

/** Сырой непрерывный прогон, как его вывел `deriveBoards`. Может быть 4481 мм. */
export interface MacroRun {
  readonly __brand: "MacroRun";
  board: Board;
  lengthMm: number;
}

/** Доска, прошедшая предел листа. Раскрой принимает ТОЛЬКО это. */
export interface StockSplitBoard {
  readonly __stockChecked: "passed";
  /** id исходной доски плюс номер куска, когда кусков больше одного */
  id: string;
  sourceId: string;
  role: string;
  cutLengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** где кусок начинается вдоль прогона */
  fromMm: number;
  /** на чём лежит шов в начале куска; undefined у первого */
  seamOn?: string;
}

export const asMacroRun = (board: Board): MacroRun =>
  ({ __brand: "MacroRun", board, lengthMm: board.lengthMm });

export interface StockLimitInput {
  runs: MacroRun[];
  /** предел заготовки для материала этой доски */
  stockLengthMm: (role: string, material?: string) => number;
  /** координаты опор вдоль прогона — швы садятся только на них */
  supportsMm: (run: MacroRun) => number[];
  widthMm: (run: MacroRun) => number;
}

export interface StockLimitResult {
  boards: StockSplitBoard[];
  problems: { law: string; detail: string; where?: { board?: string } }[];
}

/**
 * R84 §2.2, шаг [3] — единственное место, где рождается `StockSplitBoard`.
 *
 * Кусок длиннее предела режется на опоре. Нет опоры — кусок остаётся длинным, и это ОТКАЗ, а не
 * тихий проход: доска без шва на опоре повиснет, а доска длиннее листа не существует.
 */
export function applyStockLimits(input: StockLimitInput): StockLimitResult {
  const boards: StockSplitBoard[] = [];
  const problems: StockLimitResult["problems"] = [];

  for (const run of input.runs) {
    const limit = Math.min(
      input.stockLengthMm(run.board.role, run.board.material),
      STRUCTURAL.clusterMaxMm,
    );
    const width = input.widthMm(run);
    const supports = [...input.supportsMm(run)].sort((a, b) => a - b);

    const make = (from: number, to: number, i: number, seamOn?: string): StockSplitBoard => ({
      __stockChecked: "passed",
      id: i === 0 && to - from === run.lengthMm ? run.board.id : `${run.board.id}/${i + 1}`,
      sourceId: run.board.id,
      role: run.board.role,
      cutLengthMm: Math.round((to - from) * 10) / 10,
      widthMm: width,
      thicknessMm: run.board.thicknessMm,
      fromMm: from,
      ...(seamOn ? { seamOn } : {}),
    });

    if (run.lengthMm <= limit) { boards.push(make(0, run.lengthMm, 0)); continue; }

    let cursor = 0, piece = 0, guard = 0;
    while (run.lengthMm - cursor > limit) {
      if (++guard > 64) break;
      const ideal = cursor + limit;
      const cut = supports.filter((s) => s > cursor && s <= ideal).sort((a, b) => b - a)[0];
      if (cut === undefined) {
        problems.push({
          law: "R85-CLUSTER",
          where: { board: run.board.id },
          detail:
            `${run.board.role} ${run.board.id}: нужен шов около ${Math.round(ideal)}мм, а опоры ` +
            `до неё нет. Доска ${Math.round(run.lengthMm)}мм при пределе ${limit}мм — её не ` +
            `выпилить и не занести. Добавьте стойку.`,
        });
        // Кусок ВСЁ РАВНО выпускается — длинным и неправильным. Молчаливо пропавшая деталь
        // хуже неправильной: неправильную поймает P6 и увидит человек, а пропавшую не увидит
        // никто, пока на объекте не окажется, что дна нет. (Первая версия делала break и
        // теряла остаток прогона целиком — поймано при включении конвейера.)
        boards.push(make(cursor, run.lengthMm, piece, piece === 0 ? undefined : `@${cursor}`));
        cursor = run.lengthMm;
        break;
      }
      boards.push(make(cursor, cut, piece, piece === 0 ? undefined : `@${cursor}`));
      cursor = cut; piece++;
    }
    if (cursor < run.lengthMm && run.lengthMm - cursor <= limit) {
      boards.push(make(cursor, run.lengthMm, piece, piece === 0 ? undefined : `@${cursor}`));
    }
  }

  return { boards, problems };
}

/** Проверка на самих себе: ни одна выпущенная доска не длиннее предела. */
export const overLimit = (boards: StockSplitBoard[], limitMm: number): StockSplitBoard[] =>
  boards.filter((b) => b.cutLengthMm > limitMm);

// ─── ZIR ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Zero-Intervention Rate — метрика, которую основатель поставил вместо счёта законов.
 *
 * «Сто законов» говорит, сколько мы всего проверяем. ZIR говорит, какая доля заказов уходит на
 * пилу без ручной правки. У Kitchen #1 он был НОЛЬ при ста доказанных законах, и эти два числа
 * не противоречат друг другу: законы работали, кухня всё равно не годилась в производство.
 */
export interface ZirInput {
  jobId: string;
  /** отказы, требующие вмешательства человека до запуска */
  blocking: { law: string }[];
}

export const zirOf = (jobs: ZirInput[]): number =>
  jobs.length === 0 ? 0 : jobs.filter((j) => j.blocking.length === 0).length / jobs.length;

export function zirReport(jobs: ZirInput[]): string {
  const clean = jobs.filter((j) => j.blocking.length === 0).length;
  const byLaw = new Map<string, number>();
  for (const j of jobs) for (const b of j.blocking) byLaw.set(b.law, (byLaw.get(b.law) ?? 0) + 1);
  const worst = [...byLaw].sort((a, b) => b[1] - a[1]);
  return [
    `ZIR ${Math.round(zirOf(jobs) * 100)}%  (${clean} из ${jobs.length} работ без вмешательства)`,
    ...worst.map(([law, n]) => `   ${law}: ${n}`),
  ].join("\n");
}


// ─── [6] единственная точка сборки ────────────────────────────────────────────────────────────
//
// R84 §2.2 — весь путь от стены до спецификации одним вызовом. Не удобство: пока путей два,
// один из них рано или поздно забудут обновить, и слои снова разойдутся. Здесь он один.

import { deriveBoards } from "./runs";
import { resolveJunctions } from "./junctions";
import { deriveFacets } from "./facets";
import { release, type Release, type ReleaseInput } from "./release";
import { expandAll, type CabinetFill, type FillContext, type FillPart } from "./fill";
import { resolvePositions, type Sheet } from "./sheet";

export interface CompileInput
  extends Omit<ReleaseInput, "boards" | "split" | "facets" | "fillParts"> {
  sheet: Sheet;
  /** предел заготовки для материала доски */
  stockLengthMm: (role: string, material?: string) => number;
  /** наполнение шкафов, если объявлено */
  cabinets?: CabinetFill[];
  fillContext?: FillContext;
  /**
   * Детали, которых НЕТ в фасадной проекции: хребет острова, боковина во всю глубину, закладная
   * под кронштейн. Лист — это фасад; всё, что лежит поперёк него, вывести из листа нельзя.
   *
   * Но объявить деталь и обойти ею шлюз — разные вещи, и в Kitchen #4 это разошлось: три
   * объявленные детали шли прямо в раскрой, минуя P6. Предел заготовки, транспортный предел и
   * текстура их не касались вовсе. Хребет длиной 3200 прошёл бы молча — не потому, что проверки
   * нет, а потому что мимо неё был проложен путь. Теперь пути два не бывает.
   */
  declared?: FillPart[];
}

export interface Compiled {
  release: Release;
  /** отказы предела листа — доска, которой не нашлось опоры под шов */
  stockProblems: StockLimitResult["problems"];
}

/** Стена → доски → предел листа → наполнение → спецификация. */
export function compile(input: CompileInput): Compiled {
  const { sheet, profile } = input;
  const { junctions } = resolveJunctions(sheet, sheet.junctionOverrides ?? []);
  const boards = deriveBoards(sheet, profile, junctions);
  const facets = deriveFacets(sheet, boards);
  const mm = resolvePositions(sheet).mm;

  // опоры под горизонталью — перпендикулярные линии, несущие доску
  const supportsFor = (run: MacroRun): number[] => {
    const axis = run.board.axis === "h" ? "v" : "h";
    return boards
      .filter((b) => b.axis === axis)
      .map((b) => mm.get(b.line) ?? 0)
      .filter((x) => x > run.board.from && x < run.board.to)
      .sort((a, b) => a - b)
      .map((x) => x - run.board.from);
  };

  const { boards: split, problems } = applyStockLimits({
    runs: boards.map(asMacroRun),
    stockLengthMm: input.stockLengthMm,
    supportsMm: supportsFor,
    // Ширину (глубину) решает каскад внутри release — это свойство `depth`, а не доски.
    // Дублировать её тут значило бы завести второй ответ на тот же вопрос, и они бы разошлись.
    // Бренду ширина не нужна: он про ДЛИНУ и предел заготовки.
    widthMm: () => 0,
  });

  const fillParts = [
    ...(input.cabinets && input.fillContext
      ? expandAll(input.cabinets, input.fillContext).parts : []),
    ...(input.declared ?? []),
  ];

  return {
    release: release({ ...input, boards, facets, split, fillParts }),
    stockProblems: problems,
  };
}
