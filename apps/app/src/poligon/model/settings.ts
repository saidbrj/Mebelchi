// ПОЛИГОН · settings come from FILES, not from literals in the engine.
//
// This file exists because I broke the golden rule and had to be told. T8 built the Thing loader
// and then `sheet.ts` still carried `DEFAULT_PROFILE = { boardMm: 16, minInterior: {...} }` and
// `release.ts` carried `DEFAULT_SHOP = { kerfMm: 3.2 }`. Those are settings, hardcoded — exactly
// what DB/52 forbids, and the reason a question got asked that should have been answered by
// opening a file.
//
//   > GOLDEN RULE — every setting and every physical thing is its own file, editable locally,
//   > and visible in the app's settings with a picture.
//
// So the numbers now live in `things/profiles/qorasu/`, `things/machines/qorasu-saw/` and
// `things/tables/vocabulary/`, each a real folder with a def, a diagram showing its datum, and
// domains on every value. This module only READS them.
//
// Imported as JSON rather than read with `fs`, so the same code path works in the browser, in
// vitest and on a phone — and the file stays a file the founder can edit without a build step.

import profileDef from "../things/profiles/qorasu/def.json";
import machineDef from "../things/machines/qorasu-saw/def.json";
import vocabularyDef from "../things/tables/vocabulary/def.json";
import rankDef from "../things/tables/junction-rank/def.json";
import structuralDef from "../things/tables/structural/def.json";
import fillDef from "../things/tables/fill/def.json";
import cornerDef from "../things/tables/corner/def.json";
import islandDef from "../things/tables/island/def.json";
import tallDef from "../things/tables/tall/def.json";
import grainDef from "../things/tables/grain/def.json";
import system32Def from "../things/tables/system32/def.json";
import dropinDef from "../things/tables/dropin/def.json";
import confirmatDef from "../things/joints/confirmat-7x50/def.json";
import hingeDef from "../things/hinges/blum-clip-top-110/def.json";
import namingDef from "../things/tables/naming/def.json";
import edgeThinDef from "../things/edges/abs-1mm/def.json";
import materialDef from "../things/materials/ldsp-16-white/def.json";
import edgeThickDef from "../things/edges/abs-2mm/def.json";
import type { ResidualPolicy, SheetProfile } from "./sheet";
import type { BandingConvention, ShopConvention } from "./release";
import type { Rule } from "./cascade";

type NumField = { type: "number"; value: number; unit: string };
type AlgField = { type: "algorithm"; value: string; of: string[] };
type AnyField = { type: string; value: unknown };

const num = (def: { fields: Record<string, AnyField> }, key: string): number =>
  (def.fields[key] as NumField).value;
const alg = (def: { fields: Record<string, AnyField> }, key: string): string =>
  (def.fields[key] as AlgField).value;
/** a Thing reference — the catalog uid, kept as the uid because that is what a lock verifies */
const ref = (def: { fields: Record<string, AnyField> }, key: string): string =>
  String((def.fields[key] as { type: "ref"; value: string }).value);

/** The shop's standards, read from `things/profiles/qorasu/def.json`.
 *
 *  Founder's actual numbers, not my guesses: 16mm carcass (99% of work), 1mm kromka (99.5%),
 *  3mm back, transport limit 2400mm. Change the file, and every derivation downstream changes
 *  with it — there is no second copy of any of these values anywhere in the engine. */
export const SHOP_PROFILE: SheetProfile = {
  boardMm: num(profileDef, "carcassThicknessMm"),
  minInterior: {
    block: num(profileDef, "minCarcassMm"),
    void: 0,
    reserved: num(profileDef, "minReservedMm"),
  },
  residual: alg(profileDef, "residualPolicy") as ResidualPolicy,
  epsilonMm: num(profileDef, "epsilonMm"),
};

/** The saw, read from `things/machines/qorasu-saw/def.json`. The banding convention lives HERE
 *  and not in the design, because two workshops cutting the same file cut it differently — that
 *  is the whole reason `53` §1 makes it a shop setting. */
export const SHOP_MACHINE: ShopConvention = {
  banding: alg(machineDef, "bandingConvention") as BandingConvention,
  kerfMm: num(machineDef, "kerfMm"),
  stepMm: num(machineDef, "partStepMm") as 0.1 | 1,
};

export const TRANSPORT_MAX_MM = num(profileDef, "transportMaxMm");

/** Длина листа ЛДСП по умолчанию — из материала цеха. Конвейеру нужен предел на КАЖДУЮ доску,
 *  и доска без объявленного материала берёт этот. */
export const SHEET_LENGTH_MM = num(materialDef, "sheetLength");
export const BACK_THICKNESS_MM = num(profileDef, "backThicknessMm");

/** Which thickness changes are a free cascade and which are a Migration (`51` D5). Read from the
 *  profile, so a shop that stocks something else says so in its own file rather than in our code. */
export const THICKNESS_CLASSES: number[] =
  String((profileDef.fields as Record<string, AnyField>).thicknessClasses.value)
    .split(",").map((s) => Number.parseFloat(s.trim())).filter((n) => Number.isFinite(n));

/** V-VOCAB, the law the verdict said was missing — now a FILE rather than a policy in someone's
 *  head. Founder's ruling: a new Type stays private until three separate jobs use it, and only
 *  then may it be published. */
export const VOCABULARY = {
  promoteAfterUses: num(vocabularyDef, "promoteAfterUses"),
  policy: alg(vocabularyDef, "vocabularyPolicy"),
  maxTypes: num(vocabularyDef, "maxTypes"),
};

/** The shop's BASELINE cascade — the system layer, which must be total or resolution has nothing
 *  to fall back on (`CASCADE-TOTAL`). Every value here is read out of a Thing folder: the two
 *  kromka thicknesses come from `things/edges/`, the carcass thickness from the profile. Nothing
 *  in this list is a number I chose.
 *
 *  Founder's ruling, and the reason the thin edge is the default: *"99.5% кромка 1мм"*. The 2mm
 *  edge is not a preference, it is what an exposed edge gets — so it is a project-layer rule on a
 *  predicate, never a selection somebody has to remember to make. */
/** Carcass depth per height band, read from the profile. */
export const BAND_DEPTHS: { band: string; mm: number }[] = String(
  (profileDef.fields as Record<string, AnyField>).bandDepths.value,
).split(",").map((e) => {
  const [band, mm] = e.trim().split(":");
  return { band: band!, mm: Number.parseFloat(mm!) };
});

export const SHOP_RULES: Rule[] = [
  { id: "sys-kromka", layer: "system", property: "kromka", value: String(num(edgeThinDef, "thickness")), where: {} },
  { id: "sys-thickness", layer: "system", property: "thickness", value: num(profileDef, "carcassThicknessMm"), where: {} },
  { id: "sys-texture", layer: "system", property: "texture", value: "none", where: {} },
  { id: "sys-color", layer: "system", property: "color", value: "белый", where: {} },
  // the carcass material is a REF to a Thing, carried as its uid — a name is a label, a uid is
  // what a project lock (MS-LOCK) can actually verify against the catalog it was cut from
  { id: "sys-material", layer: "system", property: "material", value: ref(profileDef, "carcassMaterial"), where: {} },
  {
    id: "band-exposed", layer: "project", property: "kromka",
    value: String(num(edgeThickDef, "thickness")), where: { edgeExposure: "exposed" },
  },

  // L-DEPTH — the sheet is a FRONT view, so depth is not in it and never can be. It is a block
  // attribute resolved through the cascade, defaulted per zone from the profile file. Deriving it
  // from sheet geometry is impossible; inventing it in code would be a hidden setting.
  //
  // Zone is a Tier-0 facet, which is why a GEOMETRIC property is allowed to match it at all —
  // depth keyed on length would be the E1 cycle the stratification check refuses.
  // R70 §2 — one depth rule per declared band, generated from the profile file. There is no
  // list of zone names in this module: whatever bands the profile declares, these follow.
  ...BAND_DEPTHS.map((b) => ({
    id: `sys-depth-${b.band}`, layer: "system" as const, property: "depth" as const,
    value: b.mm, where: { zone: b.band },
  })),
  // A worktop overhangs the carcass it sits on — a real, separate number. It sits one layer ABOVE
  // the band defaults, and that is not a detail: at `system` it collided with the base rule on
  // every worktop in a base zone, and the cascade refused outright (CASCADE-CONFLICT) rather than
  // picking one. The refusal named both rules and said "move one to a different layer".
  { id: "cat-depth-worktop", layer: "catalog", property: "depth", value: num(profileDef, "worktopDepthMm"), where: { role: "worktop" } },
];

/** How much shallower a shelf is than the carcass it sits in (back panel + finger room). */
export const SHELF_SETBACK_MM = num(profileDef, "shelfSetbackMm");

/** R70 §2.2 — the wall's height bands, ordinal and PROFILE-DECLARED.
 *
 *  This replaces `span > 1500 → tall, lo < 900 → base, else upper`, which was three magic numbers
 *  sitting in the engine after I had already written the law forbidding exactly that. They were
 *  Russian/IKEA convention, wrong for any other ceiling height, and invisible to anyone who did
 *  not read facets.ts.
 *
 *  `mount` says how a module whose BOTTOM edge lands in a band is classified:
 *    below   — it belongs to this band (the default)
 *    above   — nothing is mounted IN this band, so it belongs to the band above. The plinth is a
 *              toe-kick void; the worktop gap is the splash zone, and a cabinet whose bottom edge
 *              is there is an upper, not a splash.
 *    ceiling — it hangs from above, so resolve from the TOP edge instead (антресоль, короб). */
export interface HeightBand {
  id: string;
  /** top edge, mm from floor. undefined = to the ceiling, and only the last band may be so. */
  hi?: number;
  mount: "below" | "above" | "ceiling";
}

/** Граница полосы может быть ССЫЛКОЙ на поле профиля: `plinth:@plinthHeightMm:above`. Так высота
 *  цоколя живёт одним полем с доменом (100–150), а не цифрой, зашитой в строку полос. Имя поля
 *  здесь не написано — любое `@поле` разрешается одинаково. */
const bandEdge = (raw: string): number =>
  raw.startsWith("@") ? num(profileDef, raw.slice(1)) : Number.parseFloat(raw);

export const HEIGHT_BANDS: HeightBand[] = String(
  (profileDef.fields as Record<string, AnyField>).heightBands.value,
)
  .split(",")
  .map((entry) => {
    const [id, hi, mount] = entry.trim().split(":");
    return {
      id: id!,
      ...(hi ? { hi: bandEdge(hi) } : {}),
      mount: (mount as HeightBand["mount"]) ?? "below",
    };
  });

/** Высота цоколя — переменная профиля (решение основателя 2026-09-17: диапазон 100–150). */
export const PLINTH_HEIGHT_MM = num(profileDef, "plinthHeightMm");

/** Как крепится задняя стенка. Стратегия цеха, а не свойство типа шкафа: от неё зависят ширина
 *  ХДФ и глубина каждой полки. Карасу: внахлёст на задние торцы, без паза. */
export type BackMode = "overlay" | "groove" | "none";
export const BACK = {
  mode: alg(profileDef, "backMode") as BackMode,
  /** внахлёст: полка не доходит до заднего торца на столько */
  overlayShelfGapMm: num(profileDef, "backOverlayShelfGapMm"),
  /** в паз: где паз, какой он, и насколько полка стоит перед ним */
  grooveOffsetMm: num(profileDef, "backGrooveOffsetMm"),
  grooveWidthMm: num(profileDef, "backGrooveWidthMm"),
  grooveDepthMm: num(profileDef, "backGrooveDepthMm"),
  grooveShelfGapMm: num(profileDef, "backGrooveShelfGapMm"),
};

/** DB/48 §2 — WHICH BOARD RUNS THROUGH at a crossing. The single most construction-bearing table
 *  in the engine: it decides whether the worktop passes over the sides or butts between them, and
 *  therefore what gets cut. It sat in `roles.ts` as a literal until the settings guard caught it —
 *  and the law's own refusal had been saying "rank them in the profile" the whole time, to a
 *  profile that could not hold a rank. */
export const RANK: Record<string, number> = Object.fromEntries(
  String((rankDef.fields as Record<string, AnyField>).rank.value)
    .split(",").map((e) => {
      const [role, n] = e.trim().split(":");
      return [role!, Number.parseFloat(n!)] as const;
    }),
);

/** The shop's minimum stagger between confirmats on opposite faces of one shared panel. */
export const CONFIRMAT_STAGGER_MM = num(rankDef, "confirmatStaggerMm");

/** R71 §3 + физика. Пределы прочности и правила стыка — свойства МАТЕРИАЛА и цеха, а не кода.
 *  Шкаф из 18-й плиты держит дальше; каменная столешница держит гораздо дальше. Меняется файл —
 *  меняется каждая проверка. */
export const STRUCTURAL = {
  /** дальше этого столешница без опоры прогнётся */
  worktopFreeSpanMm: num(structuralDef, "worktopFreeSpanMm"),
  /** дальше этого полка 16 мм даст необратимый провис */
  shelfFreeSpanMm: num(structuralDef, "shelfFreeSpanMm"),
  /** стык ближе этого к краю выреза мойки или варочной — разбухнет */
  cutoutClearanceMm: num(structuralDef, "cutoutClearanceMm"),
  /** насколько далеко от идеальной точки стыка движок ищет опору */
  jointSearchRadiusMm: num(structuralDef, "jointSearchRadiusMm"),
  /** запретная зона вокруг углового еврозапила */
  cornerMitreClearMm: num(structuralDef, "cornerMitreClearMm"),
  /** R85 — длиннее этого сборку не поднять по лестнице и не занести в комнату */
  clusterMaxMm: num(structuralDef, "clusterMaxMm"),
  /** R85 — швы дна, цоколя и столешницы не должны совпасть: ряд сложится по этой линии */
  seamStaggerMm: num(structuralDef, "seamStaggerMm"),
};

/** Шкаф выше этого обязан иметь жёсткую стяжную полку, иначе сложится в параллелограмм. */
export const TIE_SHELF = {
  aboveMm: num(profileDef, "tieShelfAboveMm"),
  atMm: num(profileDef, "tieShelfAtMm"),
};

/** R86 — правила наполнения. Числа, из которых получаются фасады, ящики и задние стенки. */
export const FILL = {
  /** зазор между соседними фасадами, одинаковый по всей стене */
  frontGapMm: num(fillDef, "frontGapMm"),
  /** зазор по НАРУЖНОМУ краю группы фасадов (Q20): у соседних шкафов 1.5 + 1.5 дают один зазор */
  frontEdgeMarginMm: num(fillDef, "frontEdgeMarginMm"),
  /** ХДФ задней стенки и дна ящика. Читается из ПРОФИЛЯ: MS-OWNER поймал, что я объявил эту
   *  толщину второй раз в таблице наполнения, да ещё и другим числом — 4 против founder'ских 3.
   *  Одна величина, один хозяин; таблица наполнения на неё ссылается. */
  backThicknessMm: num(profileDef, "backThicknessMm"),
  /** паз под дно ящика, с каждой стороны */
  drawerGrooveMm: num(fillDef, "drawerGrooveMm"),
  /** высота борта короба. Стояла в коде числом 100 и прошла мимо стража: сотня была в списке
   *  исключений как «перевод доли в проценты». Число из белого списка всё равно остаётся
   *  настройкой, если стоит в размерном поле — это дыра в самом страже, см. ниже. */
  drawerSideHeightMm: num(fillDef, "drawerSideHeightMm"),
  /** сколько направляющая не доходит до задней стенки */
  slideBackGapMm: num(fillDef, "slideBackGapMm"),
  /** накладка фасада на ОБЩУЮ стойку: половина, потому что стойка одна на два шкафа */
  crankSharedMm: num(fillDef, "crankSharedMm"),
};

/** Как кромкуется ОДИН торец детали: виден (толстая), скрыт (тонкая), или не кромкуется вовсе. */
export type EdgeBanding = "exposed" | "hidden" | "none";

/** R86 — по торцу на роль. Порядок как в `Facets.edgeExposure`: низ/лево · верх/право ·
 *  фасадный · к стене. `1` виден, `0` скрыт, `-` не кромкуется.
 *
 *  Третье состояние — не придирка: задняя стенка и дно ящика сидят В ПАЗУ, паз закрывает торец,
 *  и кромка там не нужна вообще. Без него ХДФ приезжала с кромкой по всем четырём сторонам.
 *
 *  Здесь объявлена только ВИДИМОСТЬ. Толщину решает то же правило каскада, что и для каркаса,
 *  поэтому второго источника правды не возникает: поменяете кромку в правиле — поменяется и
 *  у наполнения. */
export const ROLE_EDGES: Record<string, EdgeBanding[]> = Object.fromEntries(
  String((fillDef.fields as Record<string, AnyField>).roleEdges.value)
    .split(",").map((e) => {
      const [role, mask] = e.trim().split(":");
      return [role!, [...mask!].map((c): EdgeBanding =>
        c === "1" ? "exposed" : c === "0" ? "hidden" : "none")] as const;
    }),
);

/** Сколько петель на фасад по его высоте: «до 900 — две, до 1600 — три, дальше четыре». */
export const HINGE_STEPS: { upToMm: number; count: number }[] = String(
  (fillDef.fields as Record<string, AnyField>).hingeSteps.value,
).split(",").map((e) => {
  const [upTo, n] = e.trim().split(":");
  return { upToMm: Number.parseFloat(upTo!), count: Number.parseInt(n!, 10) };
});

export const hingeCount = (heightMm: number): number =>
  HINGE_STEPS.find((s) => heightMm < s.upToMm)?.count ?? HINGE_STEPS[HINGE_STEPS.length - 1]!.count;

/** R87 — угол: из чего складывается ширина доборного бруска и как режется еврозапил. */
export const CORNER = {
  /** насколько ручка торчит из фасада — это она и бьёт по ящику соседней стены */
  handleProtrusionMm: num(cornerDef, "handleProtrusionMm"),
  /** запас, чтобы «впритык» не означало «задевает» */
  clearanceMm: num(cornerDef, "cornerClearanceMm"),
  /** для безручечных фасадов добор может быть уже: бить нечему */
  golaFillerMm: num(cornerDef, "golaFillerMm"),
  /** длина скоса еврозапила по передней кромке */
  miterBevelMm: num(cornerDef, "miterBevelMm"),
  drawBoltCount: num(cornerDef, "drawBoltCount"),
  alignDowelCount: num(cornerDef, "alignDowelCount"),
  frontThicknessMm: num(cornerDef, "frontThicknessMm"),
  /** П-образная: два ряда смотрят друг на друга. Меньше — не пройти между открытыми ящиками. */
  minPassageMm: num(cornerDef, "minPassageMm"),
  /** и меньше этого вдвоём на кухне уже тесно */
  comfortPassageMm: num(cornerDef, "comfortPassageMm"),
};

/** R88 §2.2 — направление волокна по РОЛИ, когда материал текстурный.
 *  `lengthwise` — вдоль длины детали; `free` — деталь невидима, крутить можно. */
export const ROLE_GRAIN: Record<string, "lengthwise" | "free"> = Object.fromEntries(
  String((grainDef.fields as Record<string, AnyField>).roleGrain.value)
    .split(",").map((e) => {
      const [role, dir] = e.trim().split(":");
      return [role!, dir as "lengthwise" | "free"] as const;
    }),
);

/** R88 §2.4 — чего стоит текстура на листе. Цифры цеха, не догадки. */
export const YIELD_PCT = {
  free: num(grainDef, "freeYieldPct"),
  locked: num(grainDef, "lockedYieldPct"),
  cluster: num(grainDef, "clusterYieldPct"),
};

/** Двуязычная роль: латиница для станка, кириллица для сборщика. */
export interface RoleName { code: string; ru: string; }

/** Станки Biesse, Homag и SCM не принимают кириллицу в именах управляющих программ, а сборщик не
 *  читает `drawer-side`. Поэтому у каждой роли два имени, и оба объявлены в одном файле — иначе
 *  они разойдутся при первом же добавлении роли. */
export const ROLE_NAMES: Record<string, RoleName> = Object.fromEntries(
  String((namingDef.fields as Record<string, AnyField>).roleNames.value)
    .split(",").map((e) => {
      const [role, code, ru] = e.trim().split(":");
      return [role!, { code: code!, ru: ru! }] as const;
    }),
);

export const HAND_SUFFIX: Record<string, RoleName> = Object.fromEntries(
  String((namingDef.fields as Record<string, AnyField>).handSuffix.value)
    .split(",").map((e) => {
      const [hand, code, ru] = e.trim().split(":");
      return [hand!, { code: code!, ru: ru! }] as const;
    }),
);

/** R91–R93 — остров. Числа отдельной таблицей: у стены они не нужны вовсе. */
export const ISLAND = {
  /** дальше этого свес требует опоры в пол, а не кронштейнов */
  endPostMm: num(islandDef, "overhangEndPostMm"),
  /** шаг стальных кронштейнов под свесом */
  bracketPitchMm: num(islandDef, "bracketPitchMm"),
  /** во сколько раз удерживающий момент должен превышать опрокидывающий */
  tipSafety: num(islandDef, "tipSafetyFactor"),
  /** вес, который может встать на открытый ящик */
  childLoadKg: num(islandDef, "childLoadKg"),
  /** минимальная толщина декоративной облицовки задней стороны */
  claddingMinMm: num(islandDef, "claddingMinMm"),
  /** теневой зазор снизу — съедает неровность пола */
  shadowGapMm: num(islandDef, "shadowGapMm"),
  /** R94 — зазор между двумя рядами под трубы и кабель */
  chaseMinMm: num(islandDef, "chaseMinMm"),
  /** продольная перегородка, связывающая два ряда в коробчатую балку */
  spineThicknessMm: num(islandDef, "spineThicknessMm"),
  /** мелкий ряд со стороны гостиной */
  diningDepthMm: num(islandDef, "diningDepthMm"),
  /** заказная широкоформатная плита, когда постформинг не подходит */
  jumboLengthMm: num(islandDef, "jumboLengthMm"),
  jumboWidthMm: num(islandDef, "jumboWidthMm"),
};

/** Предел свеса БЕЗ опор, по материалу столешницы. */
export const OVERHANG_LIMIT_MM: Record<string, number> = Object.fromEntries(
  String((islandDef.fields as Record<string, AnyField>).overhangLimits.value)
    .split(",").map((e) => {
      const [mat, mm] = e.trim().split(":");
      return [mat!, Number.parseFloat(mm!)] as const;
    }),
);

/** R95 — пенал: вентшахта, вес, отступы. */
export const TALL = {
  /** живое сечение вентканала: вход в цоколе и выход наверху, каждое не меньше */
  chimneyAreaCm2: num(tallDef, "chimneyAreaCm2"),
  /** насколько полки и дно усекаются сзади, чтобы шахта была сквозной */
  chimneySetbackMm: num(tallDef, "chimneySetbackMm"),
  legsBaseCount: num(tallDef, "legsBaseCount"),
  legsHeavyCount: num(tallDef, "legsHeavyCount"),
  /** вес, с которого четырёх ног мало */
  heavyLoadKg: num(tallDef, "heavyLoadKg"),
  /** насколько крайняя нога может отойти от боковины */
  legUnderSideMm: num(tallDef, "legUnderSideMm"),
  /** отступ от стены для пенала с техникой: дверь должна открыться за 90° */
  applianceScribeMm: num(tallDef, "applianceScribeMm"),
  /** полоса полки, обязанная остаться между угловыми вырезами — на ней стоит прибор */
  reliefKeepMm: num(tallDef, "reliefKeepMm"),
  /** перепад потолка на длине кухни, принимаемый ПОКА ОН НЕ ИЗМЕРЕН */
  ceilingDeviationMm: num(tallDef, "ceilingDeviationMm"),
  /** припуск доборной планки на подрезку по месту */
  scribeMarginMm: num(tallDef, "scribeMarginMm"),
};

/** R96 — растр Системы 32. Шаг не «примерно тридцать два»: многошпиндельная голова станка
 *  физически имеет патроны через 32, и позиция мимо растра — это отдельный плунж на каждую
 *  дырку, то есть другая цена и другое время. */
export const SYSTEM32 = {
  pitchMm: num(system32Def, "pitchMm"),
  /** отступ линии отверстий от переднего и заднего торца */
  firstHoleMm: num(system32Def, "firstHoleMm"),
  /** ось винта направляющей стоит НЕ в отверстии растра, а на этом смещении над ним */
  slideAxisOffsetMm: num(system32Def, "slideAxisOffsetMm"),
  /** насколько движок вправе подвинуть позицию, чтобы попасть на растр */
  maxSnapMm: num(system32Def, "maxSnapMm"),
};

/** R98.2 — конфирмат. Диаметры и глубина — свойства ВИНТА, а не плиты. */
export const CONFIRMAT = {
  faceDiameterMm: num(confirmatDef, "faceDiameterMm"),
  coreDiameterMm: num(confirmatDef, "coreDiameterMm"),
  coreDepthMm: num(confirmatDef, "coreDepthMm"),
  /** сколько плиты обязано остаться между стенкой отверстия и пластью */
  minWallMm: num(confirmatDef, "minWallMm"),
};

/** R98.1 — кинематика петли: D = C + K − H. Константы — свойства МЕХАНИЗМА. */
export const HINGE = {
  /** C — плечо петли */
  armConstantMm: num(hingeDef, "armConstantMm"),
  /** H — ряд ответных планок */
  plateHeightsMm: String((hingeDef.fields as Record<string, AnyField>).plateHeightsMm.value)
    .split(",").map(Number),
  /** K — допустимый диапазон сверления чашки от края фасада */
  cupMinMm: num(hingeDef, "cupDistanceMinMm"),
  cupMaxMm: num(hingeDef, "cupDistanceMaxMm"),
  /** ± на регулировочном винте: сколько ошибки петля ещё вытянет */
  adjustRangeMm: num(hingeDef, "adjustRangeMm"),
  /** зазор между соседними фасадами, объявленный петлёй */
  revealMm: num(hingeDef, "reveal"),
};

/** R97 — врезка. Числа отдельной таблицей: они про технику, а не про шкаф. */
export const DROPIN = {
  /** чаша мойки ниже нижней плоскости столешницы */
  sinkDropMm: num(dropinDef, "sinkDropMm"),
  /** выпуск, перелив и гидрозатвор — они глубже чаши и уже её */
  plumbingDropMm: num(dropinDef, "sinkPlumbingDropMm"),
  plumbingWidthMm: num(dropinDef, "sinkPlumbingWidthMm"),
  /** корпус варочной панели */
  hobDropMm: num(dropinDef, "hobDropMm"),
  /** воздух под панелью: индукции нужен приток на охлаждение силовых ключей */
  hobVentGapMm: num(dropinDef, "hobVentGapMm"),
  /** от края выреза до ближайшей вертикальной стойки */
  toPartitionMm: num(dropinDef, "toPartitionMm"),
  /** узкая царга, которой заменяется стяжная полка под чашей */
  railWidthMm: num(dropinDef, "railWidthMm"),
};
