// Объявления → коробки в mm10 (SPEC O02) с происхождением каждого числа (G13).
import { divide, type Mm10, type ResidualPolicy, toMm } from "../../0-base/units/units";
import { finding, type Finding } from "../../0-base/findings/findings";
import {
  AXES, FACE, facesOf, type Axis, type Face, type GroupNode, type JointNode, type PatternNode, type Graph, type Node, type PartNode, type PlaneRef,
  type SpaceNode, type Span, type Thickness,
} from "../model/model";

export interface Box {
  min: Record<Axis, Mm10>;
  max: Record<Axis, Mm10>;
}

export interface Trace {
  quantity: string;
  value: Mm10;
  from: string;
}

/** То, что граф получает от слоя настроек (реализует 2-settings). */
export interface Env {
  profileName: string;
  thickness(t: Thickness): { mm10: Mm10; from: string };
  residualPolicy: ResidualPolicy;
  /** отступ детали этого типа от этой грани (SPEC R24); применяется только к пролёту «по месту» */
  inset(type: string, face: Face): { mm10: Mm10; from: string };
}

export interface Evaluation {
  boxes: Readonly<Record<string, Box>>;
  trace: Readonly<Record<string, Trace[]>>;
  problems: Finding[];
}

interface Layout {
  gaps: [Mm10, Mm10][];
  members: [Mm10, Mm10][];
  thickness: Mm10;
  /** у фасадного паттерна: поперечный размер ячейки после полей по краям */
  across?: [Mm10, Mm10];
}

export const extent = (b: Box, a: Axis): Mm10 => b.max[a] - b.min[a];

export function evaluate(g: Graph, env: Env): Evaluation {
  const boxes: Record<string, Box> = {};
  const layouts: Record<string, Layout> = {};
  const trace: Record<string, Trace[]> = {};
  const problems: Finding[] = [];
  const failed = new Set<string>();
  const visiting = new Set<string>();

  const note = (id: string, t: Trace) => (trace[id] ??= []).push(t);
  const fail = (id: string, f?: Finding): undefined => {
    failed.add(id);
    if (f) problems.push(f);
    return undefined;
  };

  function nodeBox(id: string): Box | undefined {
    if (boxes[id]) return boxes[id];
    if (failed.has(id)) return undefined;
    const n: Node | undefined = g.nodes[id];
    if (!n) return fail(id, finding("REF-MISSING-REF", [id], id));
    if (visiting.has(id)) return fail(id, finding("REF-CYCLE", [id], `${id} зависит сам от себя`));
    // у паттерна нет своей коробки: он только раскладывает промежутки хозяина
    if (n.kind === "pattern") return layout(n) ? nodeBox(n.host) : fail(id);
    // у стыка и группы нет тела: это переопределение и список
    if (n.kind === "joint" || n.kind === "group") return undefined;
    visiting.add(id);
    const b = build(n);
    visiting.delete(id);
    if (!b) return fail(id);
    boxes[id] = b;
    return b;
  }

  function coord(p: PlaneRef): Mm10 | undefined {
    const b = nodeBox(p.node);
    if (!b) return undefined;
    const { axis, side } = FACE[p.face];
    return side < 0 ? b.min[axis] : b.max[axis];
  }

  function build(n: Exclude<Node, PatternNode | JointNode | GroupNode>): Box | undefined {
    if (n.kind === "unit") return { min: { x: 0, y: 0, z: 0 }, max: { ...n.size } };
    const b = n.kind === "space" ? spaceBox(n) : partBox(n);
    if (!b) return undefined;
    for (const a of AXES) {
      if (extent(b, a) <= 0) {
        return fail(n.id, finding("REF-NO-ROOM", [n.id], `${n.id}: размер по ${a} = ${toMm(extent(b, a))} мм`));
      }
    }
    return b;
  }

  function spaceBox(s: SpaceNode): Box | undefined {
    if (s.shape.kind === "cell") {
      const { division, index } = s.shape;
      const d = g.nodes[division] as PatternNode | undefined;
      const lay = d && layout(d);
      const host = d && nodeBox(d.host);
      if (!d || !lay || !host) return undefined;
      const gap = lay.gaps[index]!;
      return { min: { ...host.min, [d.axis]: gap[0] }, max: { ...host.max, [d.axis]: gap[1] } };
    }
    const min = {} as Record<Axis, Mm10>;
    const max = {} as Record<Axis, Mm10>;
    for (const [face, ref] of Object.entries(s.shape.bounds) as [keyof typeof FACE, PlaneRef][]) {
      const c = coord(ref);
      if (c === undefined) return undefined;
      const { axis, side } = FACE[face];
      if (side < 0) min[axis] = c;
      else max[axis] = c;
    }
    return { min, max };
  }

  function span(s: Span): [Mm10, Mm10] | undefined {
    const from = coord(s.from);
    if (from === undefined) return undefined;
    if (s.kind === "sized") return [from + s.offset, from + s.offset + s.size];
    const to = coord(s.to);
    return to === undefined ? undefined : [from, to];
  }

  function partBox(p: PartNode): Box | undefined {
    const t = env.thickness(p.thickness);
    note(p.id, { quantity: "толщина", value: t.mm10, from: t.from });
    let normal: [Mm10, Mm10];
    if (p.position.kind === "plane") {
      const c = coord(p.position.plane);
      if (c === undefined) return undefined;
      const base = c + p.position.dir * p.position.offset;
      normal = p.position.dir > 0 ? [base, base + t.mm10] : [base - t.mm10, base];
    } else if (p.position.kind === "fill") {
      return fillBox(p, p.position);
    } else {
      const d = g.nodes[p.position.division] as PatternNode | undefined;
      const lay = d && layout(d);
      if (!lay) return undefined;
      normal = lay.members[p.position.index]!;
    }
    const min = { [p.normal]: normal[0] } as Record<Axis, Mm10>;
    const max = { [p.normal]: normal[1] } as Record<Axis, Mm10>;
    for (const a of AXES) {
      if (a === p.normal) continue;
      const s = p.spans[a];
      if (!s) return fail(p.id, finding("REF-AMBIGUOUS", [p.id], `у ${p.id} не объявлен пролёт по ${a}`));
      const r = span(s);
      if (!r) return undefined;
      [min[a], max[a]] = r;
      if (s.kind === "between") {
        // пролёт «по месту»: тип детали может отступать от грани (R24). Объявленный числом — нет.
        const near = env.inset(p.type, s.from.face);
        const far = env.inset(p.type, s.to.face);
        if (near.mm10) { min[a] += near.mm10; note(p.id, { quantity: `отступ ${s.from.face}`, value: near.mm10, from: near.from }); }
        if (far.mm10) { max[a] -= far.mm10; note(p.id, { quantity: `отступ ${s.to.face}`, value: far.mm10, from: far.from }); }
      }
    }
    return { min, max };
  }

  /** Фасад: ячейка паттерна по своей оси, поле по краям поперёк, толщина наружу от грани. */
  function fillBox(p: PartNode, pos: { pattern: string; index: number }): Box | undefined {
    const d = g.nodes[pos.pattern] as PatternNode | undefined;
    const lay = d && layout(d);
    const host = d && nodeBox(d.host);
    if (!d || !d.fill || !lay || !host || !lay.across) return undefined;
    const t = env.thickness(d.fill.thickness);
    note(p.id, { quantity: "толщина", value: t.mm10, from: t.from });
    const face = FACE[d.fill.face];
    const base = face.side < 0 ? host.min[face.axis] : host.max[face.axis];
    const [lo, hi] = face.side < 0 ? [base - t.mm10, base] : [base, base + t.mm10];
    const cell = lay.gaps[pos.index]!;
    const across = AXES.find((a) => a !== d.axis && a !== face.axis)!;
    const min = { [face.axis]: lo, [d.axis]: cell[0], [across]: lay.across[0] } as Record<Axis, Mm10>;
    const max = { [face.axis]: hi, [d.axis]: cell[1], [across]: lay.across[1] } as Record<Axis, Mm10>;
    return { min, max };
  }

  /** Половина общей стойки с каждой стороны оси: только там, где App 1 объявил соседа-юнита. */
  function sharedHalf(d: PatternNode, axis: Axis = d.axis): { lo: Mm10; hi: Mm10 } {
    const unit = g.nodes[d.host];
    if (!unit || unit.kind !== "unit" || !unit.neighbours || !d.fill) return { lo: 0, hi: 0 };
    const half = Math.floor(env.thickness(d.fill.thickness).mm10 / 2);
    const [lo, hi] = facesOf(axis);
    return {
      lo: unit.neighbours[lo] === "unit" ? half : 0,
      hi: unit.neighbours[hi] === "unit" ? half : 0,
    };
  }

  function layout(d: PatternNode): Layout | undefined {
    if (layouts[d.id]) return layouts[d.id];
    const host = nodeBox(d.host);
    if (!host) return undefined;
    // у фасадного паттерна «толщина» между ячейками — это зазор воздуха, а не доска
    const t = d.fill ? env.thickness(d.fill.spacing) : d.member ? env.thickness(d.member.thickness) : { mm10: 0, from: "без досок" };
    const margin = d.fill ? env.thickness(d.fill.margin).mm10 : 0;
    // где сосед-юнит, стойка общая: фасаду принадлежит половина её толщины (R60)
    const share = d.fill ? sharedHalf(d) : { lo: 0, hi: 0 };
    const length = extent(host, d.axis) - 2 * margin - share.lo - share.hi;
    const boards = (d.gaps.length - 1) * t.mm10;
    const fixed = d.gaps.reduce((a, c) => a + (c.kind === "fixed" ? c.size : 0), 0);
    const rest = length - boards - fixed;
    const shared = d.gaps.map((c) => (c.kind === "ratio" ? c.weight : c.kind === "flex" ? 1 : 0));
    const hasShare = shared.some((w) => w > 0);
    if (rest < 0 || (hasShare && rest === 0)) {
      return fail(d.id, finding("REF-NO-ROOM", [d.id, d.host],
        `${d.id}: по ${d.axis} есть ${toMm(length)} мм, доски ${toMm(boards)} + постоянные ячейки ${toMm(fixed)}`,
        ["уменьшить постоянные ячейки", "меньше ячеек", "увеличить хозяина"]));
    }
    if (!hasShare && rest !== 0) {
      return fail(d.id, finding("REF-AMBIGUOUS", [d.id],
        `${d.id}: постоянные ячейки не заполняют ${toMm(rest)} мм, и неизвестно, какая их возьмёт`,
        ["сделать одну ячейку долей или flex"]));
    }
    const sharedIdx = shared.flatMap((w, i) => (w > 0 ? [i] : []));
    const pieces = divide(rest, sharedIdx.map((i) => shared[i]!), env.residualPolicy);
    const total = shared.reduce((a, w) => a + w, 0);
    const sizes = d.gaps.map((c) => (c.kind === "fixed" ? c.size : 0));
    sharedIdx.forEach((i, k) => (sizes[i] = pieces[k]!));

    const gaps: [Mm10, Mm10][] = [];
    const members: [Mm10, Mm10][] = [];
    let at = host.min[d.axis] + margin + share.lo;
    sizes.forEach((size, i) => {
      gaps.push([at, at + size]);
      const cellId = d.gapIds[i];
      if (cellId) {
        const c = d.gaps[i]!;
        note(cellId, {
          quantity: "ячейка", value: size,
          from: c.kind === "fixed" ? "постоянная, объявлена"
            : `доля ${shared[i]} из ${total} от остатка ${toMm(rest)} мм (${d.id})`,
        });
      }
      at += size;
      if (i < sizes.length - 1) {
        members.push([at, at + t.mm10]);
        at += t.mm10;
      }
    });
    const fill = d.fill;
    const acrossAxis = fill ? AXES.find((a) => a !== d.axis && a !== FACE[fill.face].axis) : undefined;
    const acrossShare = acrossAxis ? sharedHalf(d, acrossAxis) : { lo: 0, hi: 0 };
    const across: [Mm10, Mm10] | undefined = acrossAxis
      ? [host.min[acrossAxis] + margin + acrossShare.lo, host.max[acrossAxis] - margin - acrossShare.hi]
      : undefined;
    return (layouts[d.id] = { gaps, members, thickness: t.mm10, ...(across ? { across } : {}) });
  }

  for (const id of g.order) nodeBox(id);
  return { boxes, trace, problems };
}
