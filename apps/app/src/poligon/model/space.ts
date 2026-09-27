// ПОЛИГОН · App 2 — примитивы вместо существительных.
//
// ПОЧЕМУ ЭТОТ ФАЙЛ. До него у App 2 было три модели одного и того же — и все три описывали мебель
// СУЩЕСТВИТЕЛЬНЫМИ:
//
//   контракт   NodeKind   = cabinet | shelf | divider | door | drawer | filler | rod | group | run | band
//   приложение Cell.front = "door" | "drawer", дверь на несколько ячеек — ДОЛЯМИ шкафа (fx0..fy1)
//   движок     FillKind   = door | false-front | appliance-door | drawers | shelves | open
//
// Список существительных закрыт по построению: следующая картинка с Pinterest — это существительное,
// которого в нём нет. Внутренний ящик, опущенная дверь, стойка в десять сантиметров, планка за
// укороченным фасадом — ни одно из них не отсутствующее существительное. Это СОЧЕТАНИЯ нескольких
// отношений. Костыль рождается ровно там, где кто-то встречает отсутствующее существительное и
// зашивает его: `boxD * 0.55` во внутреннем ящике, `DrawerVariant = "inner"`, дверь в долях шкафа.
//
// ─── ШЕСТЬ ПРИМИТИВОВ ─────────────────────────────────────────────────────────────────────────
//
//   Space      объём. Либо делится по оси на дочерние, либо лист, в который что-то поставлено.
//   Build      что занимает ГРАНИЦУ: ничего · одна плита · экземпляр компонента.
//              Третий вариант — открытая дверь: всё сложнее одной плиты есть компонент.
//              Поэтому стойка в 100 мм — не новый вид перегородки, а компонент на границе.
//   Front      закрывает набор ПРОСТРАНСТВ (не ячейку и не доли). Каждый край — отсчёт от проёма
//              плюс дельта. Опущенная дверь и укороченный фасад — один механизм с разным знаком.
//   Mount      как что-то крепится или движется. Поведение читается из ФАЙЛА Вещи (петля,
//              направляющая, проставка), а не из перечисления в данных проекта.
//   Attachment деталь, положение которой — ССЫЛКИ на грани других деталей. «Добавить панель куда
//              угодно»: планка, облицовка, карниз, ламели ТВ-стены.
//   Component  именованное поддерево с параметрами. Один формат на три галереи — компонент,
//              модуль, тип различаются тем, ЧТО они заполняют, а не устройством.
//
// ─── ЗАКОН ССЫЛОК ─────────────────────────────────────────────────────────────────────────────
//
// Каждое положение и каждый размер здесь — это либо правило деления (fixed/ratio/locked/flex,
// DB/32 §4), либо параметр компонента, либо ссылка на ГРАНЬ другой сущности плюс смещение. Не
// координата и не доля. Ссылка на грань, а не на осевую — поэтому смена плиты 16→18 не рвёт ничего:
// грань уехала на миллиметр, и всё, что на неё ссылается, уехало вместе с ней.
//
// DB/27 держится типами: в данных проекта нет поля под толщину, кромку, зазор направляющей или
// наложение петли. Всё это приходит в `Construction` — со стороны профиля и файлов Вещей. Дизайн
// хранит только ДЕЛЬТУ, которую выбрал автор: опустить дверь на 25 — дизайн; то, на сколько дверь
// по умолчанию наезжает на боковину, — профиль.
//
// ─── ОДИН ПРОХОД ──────────────────────────────────────────────────────────────────────────────
//
// Решателя нет. Порядок топологический и объявлен: сначала ДАННЫЕ о том, что чем закрыто, потом
// пространства сверху вниз, потом фасады, потом навески в порядке объявления. Ссылка вперёд —
// отказ, а не итерация до сходимости.

import { FILL, SYSTEM32, CONFIRMAT } from "./settings";
import { overlayNeeded } from "./system32";
import { slideLengthMm } from "./fill";
import type { Role } from "./roles";
import type { ThingKind } from "./things";

// ─── [0] геометрия ────────────────────────────────────────────────────────────────────────────

export type Axis = "x" | "y" | "z";

/** Шесть граней объёма. x — ширина слева направо, y — высота от пола, z — глубина ОТ ФАСАДА. */
export type FaceName = "left" | "right" | "bottom" | "top" | "front" | "back";

type End = "min" | "max";

export const FACE: Record<FaceName, { axis: Axis; end: End }> = {
  left: { axis: "x", end: "min" }, right: { axis: "x", end: "max" },
  bottom: { axis: "y", end: "min" }, top: { axis: "y", end: "max" },
  front: { axis: "z", end: "min" }, back: { axis: "z", end: "max" },
};

export const OPPOSITE: Record<FaceName, FaceName> = {
  left: "right", right: "left", bottom: "top", top: "bottom", front: "back", back: "front",
};

/** Грани в плоскости фасада — по ним считаются края двери. */
export const FRONT_EDGES: FaceName[] = ["left", "right", "bottom", "top"];

export interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

const copy = (b: Box): Box => ({ x: [b.x[0], b.x[1]], y: [b.y[0], b.y[1]], z: [b.z[0], b.z[1]] });
export const extentOf = (b: Box, a: Axis): number => b[a][1] - b[a][0];
const at = (e: End): 0 | 1 => (e === "min" ? 0 : 1);
export const faceCoord = (b: Box, f: FaceName): number => b[FACE[f].axis][at(FACE[f].end)];
/** наружу через эту грань — в сторону меньших координат или больших */
const outward = (f: FaceName): number => (FACE[f].end === "min" ? -1 : 1);

function setFace(b: Box, f: FaceName, v: number): void {
  b[FACE[f].axis][at(FACE[f].end)] = v;
}

// ─── [1] числа проекта: правило, параметр, дельта ─────────────────────────────────────────────

/** Длина в данных проекта — число, которое автор набрал, или ссылка на параметр компонента. */
export type Len = number | { param: string };

export type Params = Record<string, number>;

/** DB/32 §4, без изменений. Не изобретается заново — уже узаконено и уже в контракте. */
export type Rule =
  | { rule: "fixed"; mm: Len }
  | { rule: "locked"; mm: Len }
  | { rule: "ratio"; weight: number }
  | { rule: "flex" };

// ─── [2] примитивы ────────────────────────────────────────────────────────────────────────────

/** Что занимает границу. Закрыт намеренно: всё, что больше одной плиты, — компонент. */
export type Build =
  | { kind: "open" }
  | {
      kind: "board";
      /** какой слот палитры; толщина и материал приходят из профиля, не отсюда */
      slot: string;
      /** DB/35 §7.4: ламинирование — N деталей и клей, никогда одна толстая */
      layers?: number;
      /** ДИЗАЙН-отступ края от грани пространства, со стороны указанной грани */
      inset?: Partial<Record<FaceName, Len>>;
    }
  | { kind: "instance"; instance: Instance };

export const BUILD_KINDS = ["open", "board", "instance"] as const;

export interface Child { rule: Rule; space: Space }

/** Одинаковые члены с распределением: полки, ламели, ящики, ячейки. «Сдвинуть полки» —
 *  это один параметр (сколько или шаг), а не правка шести долей. */
export interface Repeat {
  count?: Len;
  pitch?: Len;
  member: Space;
  between: Build;
  /** правило для отдельного члена — то, во что превращается «потянуть одну полку» */
  at?: Record<number, Rule>;
}

export interface Split {
  axis: Axis;
  children?: Child[];
  /** границы между соседними детьми; не указана — открытая */
  between?: Build[];
  repeat?: Repeat;
}

export interface Space {
  id: string;
  faces?: Partial<Record<FaceName, Build>>;
  split?: Split;
  /** что поставлено в этот объём — ящик, органайзер, модуль в стене */
  contents?: Instance;
}

/** Крепление. Что оно ДЕЛАЕТ — написано в файле Вещи: петля, направляющая, проставка. */
export type Mount =
  | {
      thing: string;
      /** сторона петли; для направляющей не нужна */
      side?: FaceName;
      /** принадлежности крепления: проставки, адаптеры */
      with?: string[];
    }
  | { fixed: true };

export interface Front {
  id: string;
  /** закрываемые пространства; `$host` внутри компонента — объём, в который его поставили */
  covers: string[];
  slot: string;
  mount: Mount;
  /** ДИЗАЙН-дельта края: плюс — наружу за проём, минус — внутрь, оставляя щель */
  delta?: Partial<Record<FaceName, Len>>;
}

/** Ссылка на грань сущности: пространства, детали, фасада или ранее объявленной навески. */
export interface Ref { of: string; face: FaceName; offset?: Len }

export type Extent =
  | { from: Ref; to: Ref }
  | { from: Ref; size: Len }
  | { to: Ref; size: Len }
  /** только по оси толщины: толщина берётся из слота */
  | { from: Ref }
  | { to: Ref };

export interface Attachment {
  id: string;
  role: Role;
  slot: string;
  /** по какой оси деталь тонкая */
  thin: Axis;
  x: Extent;
  y: Extent;
  z: Extent;
  mount: Mount;
  /** повторить вдоль оси с шагом, пока член помещается до указанной грани */
  repeat?: { axis: Axis; pitch: Len; until: Ref };
}

export interface Override {
  node: string;
  rule?: Rule;
  build?: Build;
  delta?: Partial<Record<FaceName, Len>>;
}

/** Тело компонента — то, что описывает и библиотечная запись, и отвязанный экземпляр. */
export interface ComponentBody {
  params: ParamDef[];
  slots: string[];
  root: Space;
  fronts?: Front[];
  attachments?: Attachment[];
  /** сколько он занимает, когда стоит НА ГРАНИЦЕ — стойка между пролётами */
  thickness?: Len;
  /** что его наружные грани способны нести; не указано — всё, что несёт плита */
  accepts?: Partial<Record<FaceName, string[]>>;
}

export type Gallery = "component" | "module" | "type";

export interface ParamDef { name: string; min: number; max: number; value: number }

export interface ComponentDef extends ComponentBody {
  id: string;
  version: number;
  name: string;
  /** в какой галерее он лежит — различие по тому, что он заполняет, а не по устройству */
  gallery: Gallery;
}

/** Экземпляр. Привязан к библиотеке (`component`) — или отвязан и несёт тело сам (`inline`). */
export type Instance = {
  id: string;
  params?: Params;
  /** слот компонента → слот проекта */
  slots?: Record<string, string>;
  overrides?: Override[];
  mount?: Mount;
} & ({ component: string; version: number } | { inline: ComponentBody });

export interface Design {
  envelope: { w: number; h: number; d: number };
  root: Space;
  fronts?: Front[];
  attachments?: Attachment[];
}

// ─── [3] сторона конструкции — всё, чего в данных проекта быть не может ───────────────────────

export interface HardwareSpec {
  /** вид Вещи из её файла */
  kind: ThingKind;
  protrusionMm?: number;
  clearancePerSideMm?: number;
  lengthsMm?: number[];
  widthMm?: number;
  /** материал принадлежности — например, проставки */
  material?: string;
  /** что это крепление требует от грани, на которую ставится */
  requires?: string;
}

export interface Construction {
  slots: Record<string, { thicknessMm: number; material: string }>;
  hardware: Record<string, HardwareSpec>;
  library: Record<string, ComponentDef>;
  /** порядок граней: ранние идут во всю длину, поздние встают между ними (вкладное/накладное) */
  facePrecedence: FaceName[];
  revealMm: number;
  innerFrontInsetMm: number;
  drawerSideHeightMm: number;
  slideBackGapMm: number;
  /** ниже этого расстояния грани считаются соприкасающимися — порядок пропила, не математики */
  touchMm: number;
}

// ─── [4] результат ────────────────────────────────────────────────────────────────────────────

export interface Profile2D {
  kind: "rect" | "chamfer" | "fillet" | "notch" | "arc";
  radiusMm?: number;
  chamferMm?: number;
  notch?: { w: number; h: number; corner: "bottom-left" | "bottom-right" | "top-left" | "top-right" };
}

export interface Hole {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  face: "inner" | "outer" | "edge";
  purpose: "runner" | "hinge" | "confirmat" | "minifix" | "dowel" | "shelf_pin";
}

export interface ProjectedDrilling {
  boardId: string;
  holes: Hole[];
}

export interface Board {
  id: string;
  role: Role;
  slot: string;
  material: string;
  thicknessMm: number;
  thin: Axis;
  box: Box;
  /** узел проекта, который её породил */
  source: string;
  profile?: Profile2D;
}

export interface Joint {
  a: string;
  b: string;
  /** торец в пласть — нужен крепёж; пласть в пласть — клей; торец в торец — стык */
  kind: "edge-face" | "face-face" | "edge-edge";
  axis: Axis;
}

export interface Finding {
  law: string;
  at: string;
  detail: string;
  /** что движок предлагает поставить; решает мастер */
  suggest?: Attachment;
}

export interface Evaluated {
  spaces: Record<string, Box>;
  boards: Board[];
  joints: Joint[];
  drillings: ProjectedDrilling[];
  assemblyOrder: string[];
  bodyBox: Box;
  slotBox: Box;
  findings: Finding[];
}

// ─── [5] проход ───────────────────────────────────────────────────────────────────────────────

interface Scope {
  prefix: string;
  params: Params;
  host?: string;
  /** слот компонента → слот проекта */
  slots: Record<string, string>;
  body?: ComponentBody;
  instanceId?: string;
  /** корень компонента: грани его объёма — это «наружные грани» для `accepts` */
  rootId?: string;
}

interface QueuedFront { front: Front; scope: Scope }
interface QueuedAttachment { a: Attachment; scope: Scope }

interface Ctx {
  c: Construction;
  spaces: Record<string, Box>;
  parent: Record<string, string>;
  boards: Board[];
  boardById: Record<string, Board>;
  /** чья наружная грань — для проверки способности нести крепление */
  owner: Record<string, { body: ComponentBody; face: FaceName; instanceId: string }>;
  coveredBy: Record<string, QueuedFront[]>;
  fronts: QueuedFront[];
  attachments: QueuedAttachment[];
  findings: Finding[];
  /** фасад → прямоугольник проёма и края по умолчанию, для проверки открытого вида */
  frontInfo: Record<string, { opening: Box; inner: boolean; covers: string[]; defaults: Record<string, number> }>;
}

const scoped = (id: string, s: Scope): string => (id === "$host" && s.host ? s.host : s.prefix + id);

function lenOf(l: Len, s: Scope, at: string, ctx: Ctx): number {
  if (typeof l === "number") return l;
  const v = s.params[l.param];
  if (v === undefined) {
    ctx.findings.push({
      law: "APP2-REF", at,
      detail: `параметр «${l.param}» не объявлен у компонента — размер не из чего взять`,
    });
    return 0;
  }
  return v;
}

function slotOf(name: string, s: Scope, at: string, ctx: Ctx): { thicknessMm: number; material: string; slot: string } {
  const slot = s.slots[name] ?? name;
  const spec = ctx.c.slots[slot];
  if (!spec) {
    ctx.findings.push({
      law: "APP2-SLOT", at,
      detail: `слот «${slot}» не привязан к материалу палитры — толщину плиты взять неоткуда`,
    });
    return { thicknessMm: 0, material: "", slot };
  }
  return { ...spec, slot };
}

const roleOfFace: Record<FaceName, Role> = {
  left: "side", right: "side", bottom: "bottom", top: "top", back: "back",
  // Поперечная закрывающая плита спереди объёма: царга короба, передняя стенка ящика. В закрытом
  // словаре ролей её имени нет, как нет и `stretcher`, который есть в контракте. Отмечено в DB/56.
  front: "back",
};

const roleOfSplit: Record<Axis, Role> = { x: "side", y: "shelf", z: "side" };

function emitBoard(ctx: Ctx, b: Board): void {
  ctx.boards.push(b);
  ctx.boardById[b.id] = b;
}

function bodyOf(inst: Instance, ctx: Ctx, at: string): ComponentBody | undefined {
  if ("inline" in inst) return inst.inline;
  const def = ctx.c.library[inst.component];
  if (!def) {
    ctx.findings.push({ law: "APP2-REF", at, detail: `компонента «${inst.component}» нет в библиотеке` });
    return undefined;
  }
  return def;
}

function scopeFor(inst: Instance, body: ComponentBody, host: string, parent: Scope, ctx: Ctx): Scope {
  const params: Params = {};
  for (const p of body.params) {
    const v = inst.params?.[p.name] ?? p.value;
    if (v < p.min || v > p.max) {
      ctx.findings.push({
        law: "APP2-FIT", at: parent.prefix + inst.id,
        detail: `параметр «${p.name}» = ${v} вне диапазона ${p.min}..${p.max}, на котором компонент проверен`,
      });
    }
    params[p.name] = v;
  }
  const slots: Record<string, string> = {};
  for (const name of body.slots) slots[name] = parent.slots[inst.slots?.[name] ?? name] ?? inst.slots?.[name] ?? name;
  const prefix = `${parent.prefix}${inst.id}:`;
  return { prefix, params, host, slots, body, instanceId: parent.prefix + inst.id, rootId: prefix + body.root.id };
}

/** Переопределения экземпляра — по идентификатору узла внутри компонента. */
function applyOverrides(body: ComponentBody, overrides: Override[] | undefined): ComponentBody {
  if (!overrides?.length) return body;
  const clone: ComponentBody = JSON.parse(JSON.stringify(body));
  const walk = (s: Space): void => {
    for (const ch of s.split?.children ?? []) {
      const o = overrides.find((x) => x.node === ch.space.id && x.rule);
      if (o?.rule) ch.rule = o.rule;
      walk(ch.space);
    }
    for (const [face, b] of Object.entries(s.faces ?? {})) {
      const o = overrides.find((x) => x.node === `${s.id}/${face}` && x.build);
      if (o?.build && s.faces) s.faces[face as FaceName] = o.build;
      void b;
    }
    (s.split?.between ?? []).forEach((_, i) => {
      const o = overrides.find((x) => x.node === `${s.id}/between/${i}` && x.build);
      if (o?.build && s.split?.between) s.split.between[i] = o.build;
    });
    if (s.split?.repeat) walk(s.split.repeat.member);
  };
  walk(clone.root);
  for (const f of clone.fronts ?? []) {
    const o = overrides.find((x) => x.node === f.id && x.delta);
    if (o?.delta) f.delta = { ...f.delta, ...o.delta };
  }
  return clone;
}

function thicknessOf(b: Build, s: Scope, at: string, ctx: Ctx): number {
  if (b.kind === "open") return 0;
  if (b.kind === "board") return slotOf(b.slot, s, at, ctx).thicknessMm * (b.layers ?? 1);
  const body = bodyOf(b.instance, ctx, at);
  if (!body) return 0;
  if (body.thickness === undefined) {
    ctx.findings.push({
      law: "APP2-FIT", at,
      detail: `компонент стоит на границе, но не объявил, сколько он на ней занимает`,
    });
    return 0;
  }
  const inner = scopeFor(b.instance, body, at, s, ctx);
  return lenOf(body.thickness, inner, at, ctx);
}

function placeBuild(
  b: Build, box: Box, thin: Axis, role: Role, id: string, s: Scope, ctx: Ctx,
  face?: FaceName,
): void {
  if (b.kind === "open") return;

  if (b.kind === "instance") {
    const body = bodyOf(b.instance, ctx, id);
    if (!body) return;
    const inner = scopeFor(b.instance, applyOverrides(body, b.instance.overrides), id, s, ctx);
    instantiate(inner.body!, box, inner, ctx);
    return;
  }

  const spec = slotOf(b.slot, s, id, ctx);
  const placed = copy(box);
  for (const [edge, l] of Object.entries(b.inset ?? {}) as [FaceName, Len][]) {
    if (FACE[edge].axis === thin) continue;
    const v = lenOf(l, s, id, ctx);
    setFace(placed, edge, faceCoord(placed, edge) - outward(edge) * v);
  }
  const layers = b.layers ?? 1;
  for (let k = 0; k < layers; k++) {
    const layer = copy(placed);
    layer[thin] = [placed[thin][0] + k * spec.thicknessMm, placed[thin][0] + (k + 1) * spec.thicknessMm];
    const bid = layers > 1 ? `${id}#${k}` : id;
    emitBoard(ctx, {
      id: bid, role, slot: spec.slot, material: spec.material, thicknessMm: spec.thicknessMm,
      thin, box: layer, source: id,
      ...((b as unknown as { curve3D?: boolean }).curve3D ? { curve3D: true } : {}),
    });
    if (face && s.body && s.instanceId && id.startsWith(`${s.rootId}/`)) {
      ctx.owner[bid] = { body: s.body, face, instanceId: s.instanceId };
    }
  }
}

function layoutSpace(sp: Space, outer: Box, s: Scope, ctx: Ctx, parentId?: string): void {
  const id = s.prefix + sp.id;
  if (parentId) ctx.parent[id] = parentId;

  const inner = copy(outer);
  for (const face of ctx.c.facePrecedence) {
    const b = sp.faces?.[face];
    if (!b || b.kind === "open") continue;
    const bid = `${id}/${face}`;
    const t = thicknessOf(b, s, bid, ctx);
    const { axis, end } = FACE[face];
    const box = copy(inner);
    if (end === "min") {
      box[axis] = [inner[axis][0], inner[axis][0] + t];
      inner[axis][0] += t;
    } else {
      box[axis] = [inner[axis][1] - t, inner[axis][1]];
      inner[axis][1] -= t;
    }
    placeBuild(b, box, axis, roleOfFace[face], bid, s, ctx, face);
  }

  ctx.spaces[id] = inner;
  for (const a of ["x", "y", "z"] as Axis[]) {
    if (extentOf(inner, a) <= 0) {
      ctx.findings.push({
        law: "APP2-FIT", at: id,
        detail: `объём «${sp.id}» по оси ${a} получился ${Math.round(extentOf(inner, a))}мм — стенки съели его целиком`,
      });
      return;
    }
  }

  if (sp.split && sp.contents) {
    ctx.findings.push({
      law: "APP2-REF", at: id,
      detail: `объём одновременно делится и содержит компонент — одно из двух должно уйти внутрь компонента`,
    });
  }
  if (sp.split) layoutSplit(sp.split, inner, s, ctx, id);
  if (sp.contents) placeContents(sp.contents, inner, s, ctx, id);
}

function renamed(sp: Space, suffix: string): Space {
  const clone: Space = JSON.parse(JSON.stringify(sp));
  const walk = (x: Space): void => {
    x.id = `${x.id}${suffix}`;
    for (const ch of x.split?.children ?? []) walk(ch.space);
    if (x.split?.repeat) walk(x.split.repeat.member);
  };
  walk(clone);
  return clone;
}

function layoutSplit(sp: Split, inner: Box, s: Scope, ctx: Ctx, parentId: string): void {
  const axis = sp.axis;
  const total = extentOf(inner, axis);
  let children: Child[];
  let between: Build[];

  if (sp.repeat) {
    const r = sp.repeat;
    const count = r.count !== undefined
      ? Math.round(lenOf(r.count, s, parentId, ctx))
      : Math.max(1, Math.floor(total / lenOf(r.pitch ?? total, s, parentId, ctx)));
    children = Array.from({ length: count }, (_, i) => ({
      rule: r.at?.[i] ?? { rule: "ratio", weight: 1 },
      space: renamed(r.member, `[${i}]`),
    }));
    between = Array.from({ length: Math.max(0, count - 1) }, () => r.between);
  } else {
    children = sp.children ?? [];
    between = sp.between ?? [];
  }

  const bt = children.slice(0, -1).map((_, i) =>
    thicknessOf(between[i] ?? { kind: "open" }, s, `${parentId}/between/${i}`, ctx));
  const fixed = children.reduce((n, ch) =>
    n + (ch.rule.rule === "fixed" || ch.rule.rule === "locked" ? lenOf(ch.rule.mm, s, parentId, ctx) : 0), 0);
  const weights = children.reduce((n, ch) =>
    n + (ch.rule.rule === "ratio" ? ch.rule.weight : ch.rule.rule === "flex" ? 1 : 0), 0);
  const free = total - fixed - bt.reduce((n, t) => n + t, 0);

  if (free < -ctx.c.touchMm) {
    ctx.findings.push({
      law: "APP2-FIT", at: parentId,
      detail: `фиксированные доли и границы требуют ${Math.round(total - free)}мм при ${Math.round(total)}мм пролёта — не хватает ${Math.round(-free)}мм`,
    });
  } else if (weights === 0 && free > ctx.c.touchMm) {
    ctx.findings.push({
      law: "APP2-FIT", at: parentId,
      detail: `все доли фиксированы и остаётся ${Math.round(free)}мм, которые никому не принадлежат — поставьте одну долю «гибкой»`,
    });
  }

  let pos = inner[axis][0];
  children.forEach((ch, i) => {
    const size = ch.rule.rule === "fixed" || ch.rule.rule === "locked"
      ? lenOf(ch.rule.mm, s, parentId, ctx)
      : Math.max(0, free) * (ch.rule.rule === "ratio" ? ch.rule.weight : 1) / (weights || 1);
    const box = copy(inner);
    box[axis] = [pos, pos + size];
    pos += size;
    layoutSpace(ch.space, box, s, ctx, parentId);

    if (i < children.length - 1) {
      const t = bt[i]!;
      const bb = copy(inner);
      bb[axis] = [pos, pos + t];
      pos += t;
      const b = between[i] ?? { kind: "open" };
      placeBuild(b, bb, axis, roleOfSplit[axis], `${parentId}/between/${i}`, s, ctx);
    }
  });
}

/** Ближайший предок, закрытый распашным фасадом на петле. */
function hingedAncestor(spaceId: string, ctx: Ctx): { q: QueuedFront; covered: string } | undefined {
  let cur: string | undefined = spaceId;
  while (cur) {
    for (const q of ctx.coveredBy[cur] ?? []) {
      const m = q.front.mount;
      if ("thing" in m && ctx.c.hardware[m.thing]?.kind === "hinge") return { q, covered: cur };
    }
    cur = ctx.parent[cur];
  }
  return undefined;
}

function registerFronts(fronts: Front[] | undefined, s: Scope, ctx: Ctx): void {
  for (const f of fronts ?? []) {
    const q = { front: f, scope: s };
    ctx.fronts.push(q);
    for (const id of f.covers) (ctx.coveredBy[scoped(id, s)] ??= []).push(q);
  }
}

function instantiate(body: ComponentBody, env: Box, s: Scope, ctx: Ctx): void {
  registerFronts(body.fronts, s, ctx);
  layoutSpace(body.root, env, s, ctx, s.host);
  for (const a of body.attachments ?? []) ctx.attachments.push({ a, scope: s });
}

function placeContents(inst: Instance, host: Box, s: Scope, ctx: Ctx, hostId: string): void {
  const at = s.prefix + inst.id;
  const body = bodyOf(inst, ctx, at);
  if (!body) return;
  const inner = scopeFor(inst, applyOverrides(body, inst.overrides), hostId, s, ctx);
  const env = copy(host);
  const m = inst.mount;
  const hw = m && "thing" in m ? ctx.c.hardware[m.thing] : undefined;

  if (hw?.kind === "slide") {
    const door = hingedAncestor(hostId, ctx);
    const hingeSide = door && "thing" in door.q.front.mount ? door.q.front.mount.side : undefined;

    // проставки со стороны петель: деталь, и она же отодвигает короб
    for (const uid of m && "thing" in m ? m.with ?? [] : []) {
      const sp = ctx.c.hardware[uid];
      if (sp?.kind !== "spacer" || sp.widthMm === undefined) continue;
      if (!hingeSide) {
        ctx.findings.push({
          law: "APP2-MOUNT", at,
          detail: `проставка объявлена, но впереди нет распашной двери — ставить её не к чему`,
        });
        continue;
      }
      const slotName = Object.keys(ctx.c.slots).find((k) => ctx.c.slots[k]!.material === sp.material);
      if (!slotName) {
        ctx.findings.push({
          law: "APP2-SLOT", at,
          detail: `материал проставки не привязан ни к одному слоту палитры`,
        });
        continue;
      }
      const box = copy(env);
      const c = faceCoord(env, hingeSide);
      box[FACE[hingeSide].axis] = [c, c - outward(hingeSide) * sp.widthMm].sort((a, b) => a - b) as [number, number];
      setFace(env, hingeSide, c - outward(hingeSide) * sp.widthMm);
      emitBoard(ctx, {
        id: `${at}/spacer`, role: "filler", slot: slotName, material: sp.material ?? "",
        thicknessMm: sp.widthMm, thin: FACE[hingeSide].axis, box, source: at,
      });
    }

    const clr = hw.clearancePerSideMm ?? 0;
    env.x = [env.x[0] + clr, env.x[1] - clr];
    env.y = [env.y[0], Math.min(env.y[1], env.y[0] + ctx.c.drawerSideHeightMm)];
    const len = slideLengthMm(extentOf(host, "z"), hw.lengthsMm ?? [], {
      ...FILL, slideBackGapMm: ctx.c.slideBackGapMm,
    });
    if (len === undefined) {
      ctx.findings.push({
        law: "APP2-MOUNT", at,
        detail: `ни одна длина направляющей из файла не помещается в глубину ${Math.round(extentOf(host, "z"))}мм`,
      });
    } else {
      env.z = [env.z[0], env.z[0] + len];
    }

    // R75, посчитанный геометрией, а не флагом: открытая створка входит в проём на свой вылет
    if (door && hingeSide) {
      const protrusion = ctx.c.hardware["thing" in door.q.front.mount ? door.q.front.mount.thing : ""]?.protrusionMm ?? 0;
      const opening = ctx.spaces[door.covered]!;
      const clear = Math.abs(faceCoord(env, hingeSide) - faceCoord(opening, hingeSide));
      if (clear < protrusion) {
        const local = at.slice(at.lastIndexOf(":") + 1);
        const ref = (of: string, face: FaceName): Ref => ({ of, face });
        const suggest: Attachment = {
          id: `${local}-проставка-${hingeSide}`,
          role: "filler",
          slot: "carcass",
          thin: "x",
          x: { from: ref(door.covered, hingeSide), size: protrusion },
          y: { from: ref(door.covered, "bottom"), to: ref(door.covered, "top") },
          z: { from: ref(door.covered, "front"), to: ref(door.covered, "back") },
          mount: { fixed: true },
        };
        ctx.findings.push({
          law: "APP2-INNER-DOOR", at,
          detail:
            `ящик стоит за распашной дверью: створка входит в проём на ${protrusion}мм, а от проёма до ` +
            `короба со стороны петель ${Math.round(clear * 10) / 10}мм. Ящик ударит в неё при первом ` +
            `выезде. Выходы — петля без вхождения или проставка со стороны петель; оба лежат файлами.`,
          suggest,
        });
      }
    }
  }

  instantiate(inner.body!, env, inner, ctx);
}

// ─── [6] фасады ───────────────────────────────────────────────────────────────────────────────

function isInner(ids: string[], self: Front, ctx: Ctx): boolean {
  for (const id of ids) {
    let cur = ctx.parent[id];
    while (cur) {
      if ((ctx.coveredBy[cur] ?? []).some((q) => q.front !== self)) return true;
      cur = ctx.parent[cur];
    }
  }
  return false;
}

function isAncestor(a: string, b: string, ctx: Ctx): boolean {
  let cur = ctx.parent[b];
  while (cur) {
    if (cur === a) return true;
    cur = ctx.parent[cur];
  }
  return false;
}

const overlaps = (a: [number, number], b: [number, number], eps: number): boolean =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > eps;

function resolveFronts(ctx: Ctx): void {
  const eps = ctx.c.touchMm;
  // сначала прямоугольники проёмов всех фасадов: «общая ли стойка» зависит от соседнего фасада
  const openings = new Map<QueuedFront, { ids: string[]; box: Box }>();
  for (const q of ctx.fronts) {
    const ids = q.front.covers.map((id) => scoped(id, q.scope));
    const boxes = ids.map((id) => ctx.spaces[id]);
    if (boxes.some((b) => !b)) {
      ctx.findings.push({
        law: "APP2-REF", at: q.scope.prefix + q.front.id,
        detail: `фасад ссылается на пространство, которого нет: ${ids.filter((id) => !ctx.spaces[id]).join(", ")}`,
      });
      continue;
    }
    const box = copy(boxes[0]!);
    for (const b of boxes.slice(1)) {
      for (const a of ["x", "y", "z"] as Axis[]) box[a] = [Math.min(box[a][0], b![a][0]), Math.max(box[a][1], b![a][1])];
    }
    openings.set(q, { ids, box });
  }

  for (const [q, { ids, box: R }] of openings) {
    const f = q.front;
    const fid = q.scope.prefix + f.id;
    const spec = slotOf(f.slot, q.scope, fid, ctx);
    const inner = isInner(ids, f, ctx);

    // проём обязан быть прямоугольником: чужой объём внутри охвата — значит, дверь накрыла не своё
    for (const [sid, sb] of Object.entries(ctx.spaces)) {
      if (ids.includes(sid) || ids.some((id) => isAncestor(sid, id, ctx) || isAncestor(id, sid, ctx))) continue;
      if (overlaps(sb.x, R.x, eps) && overlaps(sb.y, R.y, eps) && overlaps(sb.z, R.z, eps)) {
        ctx.findings.push({
          law: "APP2-FRONT", at: fid,
          detail: `закрываемые пространства не складываются в прямоугольник: внутрь охвата попадает «${sid}»`,
        });
        break;
      }
    }

    const edges: Record<string, number> = {};
    const defaults: Record<string, number> = {};
    for (const e of FRONT_EDGES) {
      const coord = faceCoord(R, e);
      let def: number;
      if (inner) {
        def = coord - outward(e) * (ctx.c.revealMm / 2);
      } else {
        const { axis } = FACE[e];
        const other: Axis = axis === "x" ? "y" : "x";
        const board = ctx.boards.find((b) =>
          b.role !== "front" && b.thin === axis &&
          Math.abs(faceCoord(b.box, OPPOSITE[e]) - coord) <= eps &&
          overlaps(b.box[other], R[other], eps) &&
          b.box.z[0] <= R.z[0] + eps);
        if (board) {
          const far = faceCoord(board.box, e);
          const shared = [...openings].some(([g, o]) => g !== q &&
            Math.abs(faceCoord(o.box, OPPOSITE[e]) - far) <= eps &&
            overlaps(o.box[other], R[other], eps));
          def = coord + outward(e) * overlayNeeded(board.thicknessMm, shared, ctx.c.revealMm);
        } else {
          def = coord - outward(e) * (ctx.c.revealMm / 2);
        }
      }
      defaults[e] = def;
      const d = f.delta?.[e];
      edges[e] = def + outward(e) * (d === undefined ? 0 : lenOf(d, q.scope, fid, ctx));
    }

    const t = spec.thicknessMm;
    const z: [number, number] = inner
      ? [R.z[0] + ctx.c.innerFrontInsetMm, R.z[0] + ctx.c.innerFrontInsetMm + t]
      : [R.z[0] - t, R.z[0]];
    const box: Box = { x: [edges.left!, edges.right!], y: [edges.bottom!, edges.top!], z };
    emitBoard(ctx, {
      id: fid, role: "front", slot: spec.slot, material: spec.material, thicknessMm: t,
      thin: "z", box, source: fid,
    });
    ctx.frontInfo[fid] = { opening: R, inner, covers: ids, defaults };

    // способность нести: петля на грани, которая её не держит
    const m = f.mount;
    const need = "thing" in m ? ctx.c.hardware[m.thing]?.requires : undefined;
    if ("thing" in m && m.side && need) {
      const coord = faceCoord(R, m.side);
      const holder = ctx.boards.find((b) => ctx.owner[b.id] &&
        Math.abs(faceCoord(b.box, OPPOSITE[m.side!]) - coord) <= eps &&
        overlaps(b.box.y, R.y, eps));
      const o = holder ? ctx.owner[holder.id] : undefined;
      const accepts = o?.body.accepts?.[o.face];
      if (o && accepts && !accepts.includes(need)) {
        ctx.findings.push({
          law: "APP2-MOUNT", at: fid,
          detail:
            `петля требует «${need}», а грань «${o.face}» компонента ${o.instanceId} объявила только ` +
            `${accepts.map((x) => `«${x}»`).join(", ")}. Пустотелая стойка не держит планку петли без ` +
            `закладной — добавьте её в компонент или повесьте дверь на другую сторону.`,
        });
      }
    }
  }
}

// ─── [7] навески ──────────────────────────────────────────────────────────────────────────────

function refCoord(r: Ref, s: Scope, at: string, ctx: Ctx): number | undefined {
  const id = scoped(r.of, s);
  const box = ctx.boardById[id]?.box ?? ctx.spaces[id];
  if (!box) {
    ctx.findings.push({
      law: "APP2-REF", at,
      detail: `ссылка на «${id}», которого нет или который объявлен позже — навеска не может опираться на то, чего ещё нет`,
    });
    return undefined;
  }
  return faceCoord(box, r.face) + (r.offset === undefined ? 0 : lenOf(r.offset, s, at, ctx));
}

function resolveAttachments(ctx: Ctx): void {
  for (const { a, scope } of ctx.attachments) {
    const id = scope.prefix + a.id;
    const spec = slotOf(a.slot, scope, id, ctx);
    const box: Box = { x: [0, 0], y: [0, 0], z: [0, 0] };
    let ok = true;

    for (const axis of ["x", "y", "z"] as Axis[]) {
      const e = a[axis];
      const size = "size" in e ? lenOf(e.size, scope, id, ctx) : axis === a.thin ? spec.thicknessMm : undefined;
      const from = "from" in e ? refCoord(e.from, scope, id, ctx) : undefined;
      const to = "to" in e ? refCoord(e.to, scope, id, ctx) : undefined;
      if (("from" in e && from === undefined) || ("to" in e && to === undefined)) { ok = false; continue; }
      if (from !== undefined && to !== undefined) box[axis] = [Math.min(from, to), Math.max(from, to)];
      else if (from !== undefined && size !== undefined) box[axis] = [from, from + size];
      else if (to !== undefined && size !== undefined) box[axis] = [to - size, to];
      else {
        ok = false;
        ctx.findings.push({ law: "APP2-REF", at: id, detail: `по оси ${axis} не хватает второй ссылки или размера` });
      }
    }
    if (!ok) continue;

    const members: Box[] = [box];
    if (a.repeat) {
      const pitch = lenOf(a.repeat.pitch, scope, id, ctx);
      const until = refCoord(a.repeat.until, scope, id, ctx);
      const ax = a.repeat.axis;
      if (until !== undefined && pitch > 0) {
        for (let k = 1; box[ax][1] + k * pitch <= until + ctx.c.touchMm; k++) {
          const m = copy(box);
          m[ax] = [box[ax][0] + k * pitch, box[ax][1] + k * pitch];
          members.push(m);
        }
      }
    }
    members.forEach((m, k) => emitBoard(ctx, {
      id: members.length > 1 ? `${id}[${k}]` : id,
      role: a.role, slot: spec.slot, material: spec.material, thicknessMm: spec.thicknessMm,
      thin: a.thin, box: m, source: id,
      ...((a as unknown as { curve3D?: boolean }).curve3D ? { curve3D: true } : {}),
    }));
  }
}

// ─── [8] проверки, которые видны только целиком ───────────────────────────────────────────────

const intersects = (a: Box, b: Box, eps: number): boolean =>
  (["x", "y", "z"] as Axis[]).every((ax) => overlaps(a[ax], b[ax], eps));

/** Открытый вид: фасад отступил от проёма, и за щелью никого нет. */
function exposedOpenings(ctx: Ctx): void {
  const eps = ctx.c.touchMm;
  for (const [fid, info] of Object.entries(ctx.frontInfo)) {
    if (info.inner) continue;
    const front = ctx.boardById[fid]!;
    for (const e of FRONT_EDGES) {
      const actual = faceCoord(front.box, e);
      const edgeOfOpening = faceCoord(info.opening, e);
      // внутрь проёма дальше, чем половина шва между фасадами
      if ((edgeOfOpening - actual) * outward(e) <= ctx.c.revealMm / 2 + eps) continue;

      const { axis } = FACE[e];
      const other: Axis = axis === "x" ? "y" : "x";
      const strip: Box = copy(info.opening);
      strip[axis] = [Math.min(actual, edgeOfOpening), Math.max(actual, edgeOfOpening)];
      strip[other] = [Math.max(front.box[other][0], info.opening[other][0]), Math.min(front.box[other][1], info.opening[other][1])];

      const covered = ctx.boards.some((b) => b.id !== fid &&
        (b.role === "front" || b.role === "filler") &&
        b.box[axis][0] <= strip[axis][0] + eps && b.box[axis][1] >= strip[axis][1] - eps &&
        b.box[other][0] <= strip[other][0] + eps && b.box[other][1] >= strip[other][1] - eps);
      if (covered) continue;

      const coverId = info.covers.find((id) => Math.abs(faceCoord(ctx.spaces[id]!, e) - edgeOfOpening) <= eps)
        ?? info.covers[0]!;
      const gap = Math.round(Math.abs(edgeOfOpening - actual));
      const local = fid.slice(fid.lastIndexOf(":") + 1);
      const ref = (of: string, face: FaceName): Ref => ({ of, face });
      const along = { from: ref(local, e), to: ref(coverId, e) };
      const across = {
        from: ref(local, other === "x" ? "left" : "bottom"),
        to: ref(local, other === "x" ? "right" : "top"),
      };
      const suggest: Attachment = {
        id: `${local}-заглушка-${e}`, role: "filler", slot: front.slot, thin: "z",
        x: axis === "x" ? along : across,
        y: axis === "y" ? along : across,
        z: { from: ref(coverId, "front") },
        mount: { fixed: true },
      };

      ctx.findings.push({
        law: "APP2-OPEN-VIEW", at: fid,
        detail:
          `фасад отступил от проёма на ${gap}мм со стороны «${e}» — в щель видно внутренности шкафа, ` +
          `направляющие и содержимое. Мастер делает так ради захвата без ручки; тогда за щелью нужна ` +
          `планка-заглушка. Движок её предлагает, ставить или нет — решение мастера.`,
        suggest,
      });
    }
  }
}

function overlapsAndJoints(ctx: Ctx): Joint[] {
  const eps = ctx.c.touchMm;
  const joints: Joint[] = [];
  const bs = ctx.boards;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      if (a.source === b.source && a.id !== b.id && a.id.includes("#")) continue;   // слои одной ламинации
      if (intersects(a.box, b.box, eps)) {
        ctx.findings.push({
          law: "APP2-OVERLAP", at: a.id,
          detail: `детали «${a.id}» и «${b.id}» занимают один и тот же объём — одну из них не отпилить`,
        });
        continue;
      }
      for (const ax of ["x", "y", "z"] as Axis[]) {
        const touch = Math.abs(a.box[ax][1] - b.box[ax][0]) <= eps || Math.abs(b.box[ax][1] - a.box[ax][0]) <= eps;
        const rest = (["x", "y", "z"] as Axis[]).filter((o) => o !== ax);
        if (!touch || !rest.every((o) => overlaps(a.box[o], b.box[o], eps))) continue;
        const faces = Number(a.thin === ax) + Number(b.thin === ax);
        joints.push({
          a: a.id, b: b.id, axis: ax,
          kind: faces === 2 ? "face-face" : faces === 1 ? "edge-face" : "edge-edge",
        });
      }
    }
  }
  return joints;
}

function projectDrillings(boards: Board[], joints: Joint[], c: Construction): ProjectedDrilling[] {
  const map: Record<string, Hole[]> = {};
  const boardById = Object.fromEntries(boards.map((b) => [b.id, b]));

  for (const j of joints) {
    if (j.kind === "edge-face") {
      const a = boardById[j.a];
      const b = boardById[j.b];
      if (!a || !b) continue;

      const faceBoard = a.thin === j.axis ? a : b;
      const edgeBoard = a.thin === j.axis ? b : a;

      const ax = j.axis;
      const otherAxes = (["x", "y", "z"] as Axis[]).filter((x) => x !== ax);
      const depthAxis = otherAxes[1] ?? otherAxes[0]!;

      const depthExtent = extentOf(edgeBoard.box, depthAxis);
      const setback = Math.min(SYSTEM32.firstHoleMm, depthExtent / 2);
      const yPosInFace = (edgeBoard.box[ax][0] + edgeBoard.box[ax][1]) / 2 - faceBoard.box[ax][0];

      const fHoles = (map[faceBoard.id] ??= []);
      const eHoles = (map[edgeBoard.id] ??= []);

      fHoles.push(
        { x: setback, y: yPosInFace, diameter: CONFIRMAT.coreDiameterMm, depth: faceBoard.thicknessMm, face: "inner", purpose: "confirmat" },
        { x: Math.max(0, depthExtent - setback), y: yPosInFace, diameter: CONFIRMAT.coreDiameterMm, depth: faceBoard.thicknessMm, face: "inner", purpose: "confirmat" },
      );

      eHoles.push(
        { x: setback, y: edgeBoard.thicknessMm / 2, diameter: CONFIRMAT.coreDiameterMm, depth: CONFIRMAT.coreDepthMm, face: "edge", purpose: "confirmat" },
        { x: Math.max(0, depthExtent - setback), y: edgeBoard.thicknessMm / 2, diameter: CONFIRMAT.coreDiameterMm, depth: CONFIRMAT.coreDepthMm, face: "edge", purpose: "confirmat" },
      );
    }
  }

  return Object.entries(map).map(([boardId, holes]) => ({ boardId, holes }));
}

const ROLE_ORDER: Role[] = [
  "front", "filler", "shelf", "cornice", "worktop",
  "back", "top", "side", "bottom", "plinth",
];

function computeAssemblyOrder(boards: Board[]): string[] {
  const sorted = [...boards].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return sorted.map((b) => b.id).reverse();
}

// ─── [9] вход ─────────────────────────────────────────────────────────────────────────────────

export function evaluate(d: Design, c: Construction): Evaluated {
  const ctx: Ctx = {
    c, spaces: {}, parent: {}, boards: [], boardById: {}, owner: {}, coveredBy: {},
    fronts: [], attachments: [], findings: [], frontInfo: {},
  };
  const top: Scope = { prefix: "", params: {}, slots: {} };
  registerFronts(d.fronts, top, ctx);
  layoutSpace(d.root, { x: [0, d.envelope.w], y: [0, d.envelope.h], z: [0, d.envelope.d] }, top, ctx);
  for (const a of d.attachments ?? []) ctx.attachments.push({ a, scope: top });
  resolveFronts(ctx);
  resolveAttachments(ctx);
  exposedOpenings(ctx);
  const joints = overlapsAndJoints(ctx);

  // Проверка физического закона: жесткая плита не может гнуться в 3D
  for (const b of ctx.boards) {
    if ((b as unknown as { curve3D?: boolean }).curve3D) {
      ctx.findings.push({
        law: "REFUSAL: RIGID_SHEET_CANNOT_BEND",
        at: b.id,
        detail: `Деталь «${b.id}» не может быть согнута в 3D. Листовой материал жесткий. Примените Profile2D для 2D-фрезеровки контура или сегментируйте конструкцию.`,
      });
    }
  }

  // Расчет двух габаритов: Body Box (реальный рендер деталей со свесами) vs Slot Box (монтажный короб App 1)
  const xs = ctx.boards.flatMap((b) => b.box.x);
  const ys = ctx.boards.flatMap((b) => b.box.y);
  const zs = ctx.boards.flatMap((b) => b.box.z);
  const bodyBox: Box = {
    x: [xs.length ? Math.min(...xs) : 0, xs.length ? Math.max(...xs) : d.envelope.w],
    y: [ys.length ? Math.min(...ys) : 0, ys.length ? Math.max(...ys) : d.envelope.h],
    z: [zs.length ? Math.min(...zs) : 0, zs.length ? Math.max(...zs) : d.envelope.d],
  };
  const slotBox: Box = {
    x: [0, d.envelope.w],
    y: [0, d.envelope.h],
    z: [0, d.envelope.d],
  };

  const drillings = projectDrillings(ctx.boards, joints, c);
  const assemblyOrder = computeAssemblyOrder(ctx.boards);

  return {
    spaces: ctx.spaces,
    boards: ctx.boards,
    joints,
    drillings,
    assemblyOrder,
    bodyBox,
    slotBox,
    findings: ctx.findings,
  };
}

// ─── [10] жизнь компонента ────────────────────────────────────────────────────────────────────

function bake<T>(value: T, params: Params): T {
  return JSON.parse(JSON.stringify(value), (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 &&
    typeof v.param === "string" && params[v.param] !== undefined ? params[v.param] : v);
}

/**
 * Отвязать. Экземпляр остаётся на месте со своим креплением, но несёт тело сам: параметры
 * вписаны числами, переопределения применены, библиотека больше не отслеживается. Геометрия после
 * отвязки та же по построению — вычисляет её тот же проход, только без поиска в библиотеке.
 */
export function release(d: Design, instanceId: string, c: Construction): Design {
  const out: Design = JSON.parse(JSON.stringify(d));
  const detach = (inst: Instance): Instance => {
    if ("inline" in inst) return inst;
    const def = c.library[inst.component];
    if (!def) return inst;
    const params: Params = Object.fromEntries(def.params.map((p) => [p.name, inst.params?.[p.name] ?? p.value]));
    const body = bake(applyOverrides(def, inst.overrides), params);
    const { component: _c, version: _v, overrides: _o, params: _p, ...rest } = inst as Instance & { component: string; version: number };
    void _c; void _v; void _o; void _p;
    return { ...rest, inline: { ...body, params: [] } };
  };
  const walk = (s: Space): void => {
    if (s.contents?.id === instanceId) s.contents = detach(s.contents);
    for (const b of Object.values(s.faces ?? {})) if (b.kind === "instance" && b.instance.id === instanceId) b.instance = detach(b.instance);
    for (const b of s.split?.between ?? []) if (b.kind === "instance" && b.instance.id === instanceId) b.instance = detach(b.instance);
    for (const ch of s.split?.children ?? []) walk(ch.space);
    if (s.split?.repeat) walk(s.split.repeat.member);
    if (s.contents && "inline" in s.contents) walk(s.contents.inline.root);
  };
  walk(out.root);
  return out;
}

export interface Promote {
  /** узел внутри поддерева: пространство (правило его доли) или фасад (дельта края) */
  node: string;
  field: "rule.mm" | `delta.${FaceName}`;
  param: string;
  min: number;
  max: number;
}

/**
 * Создать компонент из ПОДДЕРЕВА — не из набора отмеченных плит. Набор плит не знает, что в нём
 * тянется при смене размера; поддерево знает, потому что знает свои правила деления.
 *
 * Отказ, если фасад или навеска поддерева ссылаются наружу: компонент, опирающийся на то, чего
 * в нём нет, в другом шкафу развалится.
 */
export function createComponent(
  d: Design, spaceId: string, meta: { id: string; name: string; gallery: Gallery },
  promote: Promote[] = [],
): { def: ComponentDef; design: Design; refused: string[] } {
  const out: Design = JSON.parse(JSON.stringify(d));
  const refused: string[] = [];
  let found: Space | undefined;

  const find = (s: Space): void => {
    if (s.id === spaceId) found = s;
    for (const ch of s.split?.children ?? []) find(ch.space);
  };
  find(out.root);
  if (!found) return { def: undefined as never, design: d, refused: [`пространства «${spaceId}» нет`] };

  const inside = new Set<string>();
  const collect = (s: Space): void => {
    inside.add(s.id);
    for (const f of Object.keys(s.faces ?? {})) inside.add(`${s.id}/${f}`);
    (s.split?.children ?? []).forEach((ch, i) => { inside.add(`${s.id}/between/${i}`); collect(ch.space); });
  };
  collect(found);

  const fronts = (out.fronts ?? []).filter((f) => f.covers.every((id) => inside.has(id)));
  const leaking = (out.fronts ?? []).filter((f) => f.covers.some((id) => inside.has(id)) && !fronts.includes(f));
  for (const f of leaking) refused.push(`фасад «${f.id}» закрывает и поддерево, и то, что снаружи`);
  for (const f of fronts) inside.add(f.id);

  const attachments: Attachment[] = [];
  for (const a of out.attachments ?? []) {
    const refs = (["x", "y", "z"] as Axis[]).flatMap((ax) => {
      const e = a[ax];
      return [..."from" in e ? [e.from] : [], ..."to" in e ? [e.to] : []];
    });
    if (a.repeat) refs.push(a.repeat.until);
    const own = refs.every((r) => inside.has(r.of) || attachments.some((x) => x.id === r.of));
    const touches = refs.some((r) => inside.has(r.of));
    if (own) { attachments.push(a); inside.add(a.id); } else if (touches) refused.push(`навеска «${a.id}» опирается на то, что снаружи поддерева`);
  }

  const params: ParamDef[] = [];
  const body = { root: JSON.parse(JSON.stringify(found)) as Space, fronts: JSON.parse(JSON.stringify(fronts)) as Front[] };
  for (const p of promote) {
    let value: number | undefined;
    if (p.field === "rule.mm") {
      const walk = (s: Space): void => {
        for (const ch of s.split?.children ?? []) {
          if (ch.space.id === p.node && (ch.rule.rule === "fixed" || ch.rule.rule === "locked") && typeof ch.rule.mm === "number") {
            value = ch.rule.mm;
            ch.rule = { ...ch.rule, mm: { param: p.param } };
          }
          walk(ch.space);
        }
      };
      walk(body.root);
    } else {
      const edge = p.field.slice(p.field.indexOf(".") + 1) as FaceName;
      const f = body.fronts.find((x) => x.id === p.node);
      const cur = f?.delta?.[edge];
      if (f && typeof cur === "number") { value = cur; f.delta = { ...f.delta, [edge]: { param: p.param } }; }
    }
    if (value === undefined) refused.push(`«${p.node}.${p.field}» не число, которое можно поднять в параметр`);
    else params.push({ name: p.param, min: p.min, max: p.max, value });
  }

  const slots = new Set<string>();
  JSON.stringify([body, attachments], (k, v) => { if (k === "slot" && typeof v === "string") slots.add(v); return v; });

  const def: ComponentDef = {
    ...meta, version: 1, params, slots: [...slots],
    root: body.root, fronts: body.fronts, attachments,
  };

  // на месте поддерева остаётся экземпляр: объём с той же долей в родителе, внутри — компонент
  const replace = (s: Space): void => {
    for (const ch of s.split?.children ?? []) {
      if (ch.space.id === spaceId) {
        ch.space = {
          id: spaceId,
          contents: {
            id: `${spaceId}-экз`, component: def.id, version: def.version,
            params: Object.fromEntries(params.map((p) => [p.name, p.value])),
          },
        };
      } else replace(ch.space);
    }
  };
  replace(out.root);
  out.fronts = (out.fronts ?? []).filter((f) => !fronts.some((x) => x.id === f.id));
  out.attachments = (out.attachments ?? []).filter((a) => !attachments.some((x) => x.id === a.id));
  return { def, design: out, refused };
}

/**
 * Создать компонент из ВЫДЕЛЕННЫХ СВОБОДНЫХ ДЕТАЛЕЙ (Решение Игры 13):
 * 1. Вычисляет общий Bounding Space вокруг выделенных деталей (лассо-выбор).
 * 2. Внутренние контакты и зазоры фиксируются как инварианты.
 * 3. Наружные грани Bounding Space становятся контактными портами.
 */
export function createComponentFromParts(
  d: Design,
  partIds: string[],
  meta: { id: string; name: string; gallery: Gallery },
  c: Construction,
): { def: ComponentDef; design: Design; refused: string[] } {
  const evalResult = evaluate(d, c);
  const targetBoards = evalResult.boards.filter((b) => partIds.includes(b.id));
  if (targetBoards.length === 0) {
    return { def: undefined as never, design: d, refused: ["Ни одной детали не найдено по указанным ID"] };
  }

  const xs = targetBoards.flatMap((b) => b.box.x);
  const ys = targetBoards.flatMap((b) => b.box.y);
  const zs = targetBoards.flatMap((b) => b.box.z);
  const bounds: Box = {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
    z: [Math.min(...zs), Math.max(...zs)],
  };

  const w = extentOf(bounds, "x");
  const h = extentOf(bounds, "y");
  const dMm = extentOf(bounds, "z");

  const rootSpace: Space = {
    id: `${meta.id}-root`,
    faces: {},
  };

  const def: ComponentDef = {
    ...meta,
    version: 1,
    params: [
      { name: "w", min: Math.max(1, w / 2), max: w * 2, value: w },
      { name: "h", min: Math.max(1, h / 2), max: h * 2, value: h },
      { name: "d", min: Math.max(1, dMm / 2), max: dMm * 2, value: dMm },
    ],
    slots: [...new Set(targetBoards.map((b) => b.slot))],
    root: rootSpace,
    thickness: w,
  };

  return { def, design: d, refused: [] };
}

