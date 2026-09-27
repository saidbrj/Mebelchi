// Стенд Round 1: один экран «Тумба» на настоящем ядре. Это эксперимент, а не продукт:
// вид нарочно простой. Вопрос один — понимает ли мастер, что трогать дальше, без объяснений.
//
// Архитектура I «Выбрал — сделал» (исследование Round 1: B и C отсеяны на бумаге):
//   касание только выбирает (доску или проём); что можно — в столбце справа;
//   добавить: проём → «Полка» (касание — по метке; ПЕРЕТАЩИТЬ слово на тумбу — куда отпустил);
//   доску можно тащить сразу, даже невыбранную: один палец на доске больше ничего не значит.
// Варианты B/C остались в коде журнала для старых записей, но из стенда не вызываются.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { run, start, undo, type Command, type Session } from "../kernel";
import { hitTest, type Hit, type Target } from "./hit";
import { journal, download, type Variant } from "./journal";
import { gapsOf, mm, openings, parts, sizeText, unitSize, whereText, type PartInfo } from "./model";
import { Scene } from "./scene";

type Sel = { kind: "part" | "space"; id: string } | null;
type Mark = { space: string; x: number; y: number } | null;          // карандашная метка, мм10
type Menu = { px: number; py: number; mark: NonNullable<Mark> } | null; // B/C: у пальца
type Pad = { field: "w" | "h" | "d" | "place"; text: string } | null;
interface Step { session: Session; label: string }

export const TASKS = [
  { say: "Сделай тумбу 600 на 720, глубина 560. Поставь полку. Передвинь её. Поставь перегородку внизу. Поставь вторую полку. Потом поставь что-нибудь не туда — и верни как было.", built: false },
  { say: "Новая тумба 400 на 720, глубина 560. Две полки.", built: false },
  { say: "Новая тумба 800 на 720, глубина 560. Перегородка посередине, слева полка.", built: false },
  { say: "Передвинь верхнюю полку.", built: true },
] as const;

const BUILT: Command[] = [
  { word: "CUBE", w: 600, h: 720, d: 560 },
  { word: "PATTERN", op: "create", space: "S1", axis: "y", gaps: [{ fixed: 300 }, "flex"], member: "shelf" },
  { word: "PATTERN", op: "create", space: "S2", axis: "x", gaps: [{ fixed: 276 }, "flex"], member: "divider" },
  { word: "PATTERN", op: "create", space: "S5", axis: "y", gaps: [{ fixed: 142 }, "flex"], member: "shelf" },
];

const LONG_MS = 500, MOVE_PX = 8, SNAP_PX = 10;

export function Bench({ task, variant, onEnd }: { task: number; variant: Variant; onEnd: () => void }) {
  const built = TASKS[task - 1]?.built ?? false;
  const [session, setSession] = useState<Session>(() => (built ? BUILT.reduce((s, c) => run(s, c).session, start()) : start()));
  const [history, setHistory] = useState<string[]>([]);        // подписи шагов для «Отменить»
  const [redo, setRedo] = useState<Step[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [mark, setMark] = useState<Mark>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [pad, setPad] = useState<Pad>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ session: Session; tag: string | null } | null>(null);
  const [vdrag, setVdrag] = useState<{ type: "shelf" | "divider"; mark: NonNullable<Mark> | null; px: number; py: number } | null>(null);
  const [, force] = useState(0);
  const unit = unitSize(session);
  const floor = built ? 0 : 1;                                   // «тумба» из эскиза не отменяется
  const canUndo = history.length > floor;
  const shown = preview?.session ?? session;

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const live = useRef({ session, sel, mark, menu, variant, pad, shown });
  live.current = { session, sel, mark, menu, variant, pad, shown };

  useEffect(() => { journal.begin(task, variant); return () => journal.end(); }, [task, variant]);

  // ── сцена ──
  useLayoutEffect(() => {
    if (!unit) return;
    const sc = new Scene(stageRef.current!);
    sceneRef.current = sc;
    sc.fit(unit);
    const ro = new ResizeObserver(() => { sc.resize(); sc.fit(unitSize(live.current.session)); force((n) => n + 1); });
    ro.observe(stageRef.current!);
    force((n) => n + 1);
    return () => { ro.disconnect(); sc.dispose(); sceneRef.current = null; };
  }, [!!unit]);
  useEffect(() => { sceneRef.current?.build(parts(shown), sel?.kind === "part" ? sel.id : null); }, [shown, sel]);

  // ── снимок экрана для хит-теста ──
  const targets = (s: Session): { parts: Target[]; spaces: Target[] } => {
    const sc = sceneRef.current!;
    return {
      parts: parts(s).map((p) => ({ id: p.id, poly: sc.front(p.box) })),
      spaces: openings(s).map((o) => ({ id: o.id, poly: sc.front(o.box) })),
    };
  };
  const unitRect = () => {
    const sc = sceneRef.current!, s = live.current.session;
    const u = s.state.graph.order.map((id) => s.state.evaluation.boxes[id]).find(Boolean);
    if (!u) return null;
    const q = sc.front(u);
    return { x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) };
  };
  /** Пиксели → мм10 на передней плоскости проёма: ищем точку грани, которая проецируется в палец. */
  const toMm10 = (spaceId: string, px: number, py: number) => {
    const b = live.current.session.state.evaluation.boxes[spaceId]!;
    const sc = sceneRef.current!;
    let fx = 0.5, fy = 0.5;
    for (let i = 0; i < 12; i++) {                    // простая итерация: грань почти плоская на экране
      const at = (u: number, v: number) => sc.project(b.min.x + u * (b.max.x - b.min.x), b.min.y + v * (b.max.y - b.min.y), b.min.z);
      const [x0, y0] = at(fx, fy), [x1] = at(fx + 0.01, fy), [, y1] = at(fx, fy + 0.01);
      fx += ((px - x0) / (x1 - x0)) * 0.01;
      fy += ((py - y0) / (y1 - y0)) * 0.01;
    }
    fx = Math.min(1, Math.max(0, fx)); fy = Math.min(1, Math.max(0, fy));
    return { x: b.min.x + fx * (b.max.x - b.min.x), y: b.min.y + fy * (b.max.y - b.min.y) };
  };

  // отладка стенда: где доски на экране и что в журнале (для проверки жестов, не для мастера)
  (window as unknown as { __bench: unknown }).__bench = {
    targets: () => (sceneRef.current ? targets(live.current.session) : null),
    stage: () => stageRef.current?.getBoundingClientRect(),
    session: () => live.current.session,
    journal: () => journal.all(),
  };

  // ── команды ──
  const commit = (next: Session, label: string) => {
    setSession(next); setHistory((h) => [...h, label]); setRedo([]); setMsg(null);
  };
  const newIds = (before: Session, after: Session) => parts(after).map((p) => p.id).filter((id) => !before.state.graph.nodes[id]);

  const add = (type: "shelf" | "divider", m: NonNullable<Mark>, how: string) => {
    const s = live.current.session;
    const b = s.state.evaluation.boxes[m.space]!;
    const axis = type === "shelf" ? "y" : "x";
    const room = mm(b.max[axis] - b.min[axis]);
    const first = Math.round(Math.min(Math.max(mm(m[axis] - b.min[axis]) - 8, 0), room - 16));
    const r = run(s, { word: "PATTERN", op: "create", space: m.space, axis, gaps: [{ fixed: first }, "flex"], member: type });
    const selBefore = live.current.sel?.id ?? null;
    if (!r.result.accepted) {
      setMsg("Здесь не помещается");
      journal.push({ gesture: how, hit: m.space, result: `REFUSED ADD_${type.toUpperCase()} ${r.result.findings[0]?.code ?? ""}`, selBefore });
      return;
    }
    const id = newIds(s, r.session)[0] ?? null;
    commit(r.session, `${type === "shelf" ? "полка" : "перегородка"} ${first}`);
    setSel(id ? { kind: "part", id } : null); setMark(null); setMenu(null);
    if (id) journal.created(id);
    journal.push({ gesture: how, hit: m.space, result: `ADD_${type.toUpperCase()} ${id} ${first}`, selBefore, selAfter: id });
  };

  const removePart = (p: PartInfo) => {
    const s = live.current.session;
    const n = s.state.graph.nodes[p.id]!;
    const cmd: Command = n.kind === "part" && n.position.kind === "member"
      ? { word: "PATTERN", op: "remove", member: p.id } : { word: "REPLACE", part: p.id, with: "nothing" };
    const r = run(s, cmd);
    journal.push({ gesture: "button", hit: p.id, result: r.result.accepted ? `REMOVE ${p.id}` : `REFUSED REMOVE ${r.result.findings[0]?.code}`, selBefore: p.id, selAfter: null });
    if (!r.result.accepted) return setMsg("Не получается убрать");
    commit(r.session, `убрал: ${p.name.toLowerCase()}`);
    setSel(null);
  };

  const doUndo = () => {
    const s = live.current.session;
    if (!canUndo || !s.previous) return;
    const prev = undo(s);
    const removed = parts(s).map((p) => p.id).filter((id) => !prev.state.graph.nodes[id]);
    journal.push({ gesture: "button", hit: null, result: `UNDO ${history[history.length - 1]}`, selBefore: live.current.sel?.id ?? null });
    journal.undone(removed);
    setRedo((r) => [...r, { session: s, label: history[history.length - 1]! }]);
    setHistory((h) => h.slice(0, -1));
    setSession(prev); setMsg(null); setMenu(null); setMark(null);
    if (live.current.sel && !prev.state.graph.nodes[live.current.sel.id]) setSel(null);
  };
  const doRedo = () => {
    const top = redo[redo.length - 1];
    if (!top) return;
    journal.push({ gesture: "button", hit: null, result: `REDO ${top.label}`, selBefore: live.current.sel?.id ?? null });
    setRedo((r) => r.slice(0, -1)); setHistory((h) => [...h, top.label]); setSession(top.session);
  };

  // ── жесты ──
  useEffect(() => {
    const el = stageRef.current;
    const sc = sceneRef.current;
    if (!el || !sc) return;
    const pts = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; t: number; hit: Hit; moved: boolean; long: boolean; timer: number } | null = null;
    let drag: null | {
      part: PartInfo; base: Session; x: number; y: number; ux: number; uy: number; pxPerMm: number;
      lo: number; hi: number; others: number[]; want: number; snap: string | null; lastX: number; lastY: number; raf: number;
    } = null;
    let cam: null | { yaw: number; pitch: number; zoom: number; mx: number; my: number; dist: number } = null;
    let camUsed = false;

    const local = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const mid = () => { const a = [...pts.values()]; return { x: (a[0]!.x + a[1]!.x) / 2, y: (a[0]!.y + a[1]!.y) / 2, d: Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y) }; };

    const act = (gesture: "tap" | "longpress", x: number, y: number, h: Hit) => {
      const { sel: selNow, variant: v, menu: menuNow } = live.current;
      const base = { gesture, hit: h.hit?.id ?? null, candidates: h.candidates, rule: h.rule, x: Math.round(x), y: Math.round(y), selBefore: selNow?.id ?? null };
      if (menuNow) {
        setMenu(null); setMark(null);
        return journal.push({ ...base, result: "MENU_CANCEL", selAfter: selNow?.id ?? null });
      }
      if (h.hit?.kind === "part") {
        setSel({ kind: "part", id: h.hit.id }); setMark(null); setMsg(null);
        return journal.push({ ...base, result: `SELECT ${h.hit.id}`, selAfter: h.hit.id });
      }
      if (h.hit?.kind === "space") {
        const m = { space: h.hit.id, ...toMm10(h.hit.id, x, y) };
        if (v === "A") {
          setSel({ kind: "space", id: h.hit.id }); setMark(m); setMsg(null);
          return journal.push({ ...base, result: `SELECT_SPACE ${h.hit.id}`, selAfter: h.hit.id });
        }
        if (gesture === "longpress") {
          setMenu({ px: x, py: y, mark: m }); setMark(m); setSel(null);
          return journal.push({ ...base, result: `MENU_OPEN ${h.hit.id}`, selAfter: null });
        }
        if (v === "C") return add("shelf", m, "tap");
        setSel(null); setMark(null);
        return journal.push({ ...base, result: "DESELECT", selAfter: null });
      }
      setSel(null); setMark(null); setMsg(null);
      journal.push({ ...base, result: "NOTHING", selAfter: null });
    };

    const startDrag = (p: PartInfo, x: number, y: number) => {
      const s = live.current.session;
      const g = gapsOf(s, p.id);
      const a = p.axis === "x" ? "x" : "y";
      const ax = sc.axisOnScreen(a, { x: p.box.min.x, y: p.box.min.y, z: p.box.min.z });
      const others = parts(s).filter((o) => o.id !== p.id && o.type === p.type && o.axis === p.axis).map((o) => mm(o.box.min[a]));
      drag = { part: p, base: s, x, y, ...ax, lo: g?.lo ?? 0, hi: g?.hi ?? 0, others, want: 0, snap: null, lastX: x, lastY: y, raf: 0 };
    };

    /** Куда встанет доска, если отпустить сейчас: сдвиг с видимой привязкой; упирается — ищем последнее место. */
    const resolve = (d: NonNullable<typeof drag>) => {
      const tryD = (v: number) => run(d.base, { word: "DRAG", target: "part", part: d.part.id, delta: v });
      let delta = d.want, tag = d.snap;
      let r = delta === 0 ? null : tryD(delta);
      if (r && !r.result.accepted) {
        let ok = 0, bad = delta;
        while (Math.abs(bad - ok) > 1) { const m = Math.trunc((ok + bad) / 2); if (tryD(m).result.accepted) ok = m; else bad = m; }
        r = ok === 0 ? null : tryD(ok);
        delta = ok; tag = "упёрлась";
      }
      return { delta, tag, session: r ? r.session : null };
    };

    const dragTo = (x: number, y: number) => {
      if (!drag) return;
      const d = drag;
      const raw = ((x - d.x) * d.ux + (y - d.y) * d.uy) / d.pxPerMm;
      let delta = Math.round(raw);
      let tag: string | null = null;
      const eq = (d.hi - d.lo) / 2;
      const pos = mm(d.part.box.min[d.part.axis === "x" ? "x" : "y"]);
      if (Math.abs(raw - eq) * d.pxPerMm < SNAP_PX) { delta = Math.round(eq * 10) / 10; tag = "= поровну"; }
      else {
        const line = d.others.find((o) => Math.abs(pos + raw - o) * d.pxPerMm < SNAP_PX);
        if (line !== undefined) { delta = Math.round((line - pos) * 10) / 10; tag = "в линию"; }
      }
      d.want = delta; d.snap = tag; d.lastX = x; d.lastY = y;
      cancelAnimationFrame(d.raf);
      d.raf = requestAnimationFrame(() => {
        const res = resolve(d);
        setPreview({ session: res.session ?? d.base, tag: res.tag });
      });
    };

    const endDrag = (x: number, y: number) => {
      if (!drag) return;
      const d = drag; drag = null;
      cancelAnimationFrame(d.raf);
      const u = unitRect();
      const outside = !u || x < u.x0 - 40 || x > u.x1 + 40 || y < u.y0 - 40 || y > u.y1 + 40;
      setPreview(null);
      const res = outside ? null : resolve(d);
      if (!res || res.delta === 0 || !res.session) {
        return journal.push({ gesture: "drag", hit: d.part.id, result: outside ? "DRAG_CANCEL" : res?.tag === "упёрлась" ? "DRAG_BLOCKED" : "DRAG_ZERO", selBefore: d.part.id, selAfter: d.part.id });
      }
      const g = gapsOf(res.session, d.part.id);
      commit(res.session, `${d.part.name.toLowerCase()} ${d.lo} → ${g?.lo ?? "?"}`);
      journal.push({ gesture: "drag", hit: d.part.id, result: `MOVE ${d.part.id} ${res.delta}${res.tag ? ` (${res.tag})` : ""}`, selBefore: d.part.id, selAfter: d.part.id });
    };

    const onDown = (e: PointerEvent) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* синтетическое событие */ }
      journal.touch();
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 2) {                 // два пальца — только смотреть
        if (down) clearTimeout(down.timer);
        if (drag) { cancelAnimationFrame(drag.raf); drag = null; setPreview(null); journal.push({ gesture: "drag", hit: null, result: "DRAG_CANCEL_TWO_FINGERS", selBefore: live.current.sel?.id ?? null }); }
        down = null;
        const m = mid();
        cam = { ...sc.view, mx: m.x, my: m.y, dist: m.d };
        return;
      }
      if (pts.size > 2) return;
      const t = targets(live.current.session);
      const h = hitTest(p.x, p.y, t.parts, t.spaces, live.current.sel?.kind === "part" ? live.current.sel.id : null);
      const timer = window.setTimeout(() => {
        if (!down || down.moved) return;
        down.long = true;
        act("longpress", down.x, down.y, down.hit);
      }, LONG_MS);
      down = { x: p.x, y: p.y, t: Date.now(), hit: h, moved: false, long: false, timer };
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (cam && pts.size === 2) {
        const m = mid();
        sc.view = {
          yaw: Math.max(-1.2, Math.min(1.2, cam.yaw - (m.x - cam.mx) * 0.006)),
          pitch: Math.max(-0.6, Math.min(1.0, cam.pitch + (m.y - cam.my) * 0.006)),
          zoom: Math.max(0.6, Math.min(3, cam.zoom * (m.d / Math.max(cam.dist, 1)))),
        };
        sc.resize(); camUsed = true; force((n) => n + 1);
        return;
      }
      if (drag) return dragTo(p.x, p.y);
      if (!down || down.long) return;
      if (!down.moved && Math.hypot(p.x - down.x, p.y - down.y) > MOVE_PX) {
        down.moved = true;
        clearTimeout(down.timer);
        const h = down.hit.hit;
        const selNow = live.current.sel;
        if (h?.kind === "part") {
          const part = parts(live.current.session).find((x) => x.id === h.id);
          const was = selNow?.kind === "part" && selNow.id === h.id;
          if (!was) {
            setSel({ kind: "part", id: h.id }); setMark(null); setMenu(null);
            journal.push({ gesture: "drag", hit: h.id, result: `SELECT ${h.id}`, selBefore: selNow?.id ?? null, selAfter: h.id, candidates: down.hit.candidates, rule: down.hit.rule, flag: "DRAG_UNSELECTED" });
          }
          if (part?.movable && (part.axis === "x" || part.axis === "y")) startDrag(part, down.x, down.y);
          else journal.push({ gesture: "drag", hit: h.id, result: "DRAG_LOCKED", selBefore: h.id });
        } else {
          journal.push({ gesture: "swipe", hit: h?.id ?? null, result: "NOTHING", selBefore: selNow?.id ?? null, flag: "ONE_FINGER_SWIPE" });
        }
        if (drag) dragTo(p.x, p.y);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.delete(e.pointerId);
      if (cam) {
        if (pts.size === 0) {
          if (camUsed) journal.push({ gesture: "twofinger", hit: null, result: "CAMERA", selBefore: live.current.sel?.id ?? null, flag: "CAMERA" });
          cam = null; camUsed = false;
        }
        return;
      }
      if (drag) return endDrag(p.x, p.y);
      if (!down) return;
      clearTimeout(down.timer);
      const d = down; down = null;
      if (!d.moved && !d.long) act("tap", d.x, d.y, d.hit);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [!!sceneRef.current, !!unit]);

  // ── скрытый конец задания: держать левый верхний угол 2 с (или Esc) ──
  const cornerTimer = useRef<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onEnd(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onEnd]);

  // ── числа ──
  const selPart = sel?.kind === "part" ? parts(shown).find((p) => p.id === sel.id) ?? null : null;
  const selSpace = sel?.kind === "space" ? openings(shown).find((o) => o.id === sel.id) ?? null : null;
  const placeWord = selPart?.axis === "x" ? "от левой" : "от дна";

  const padDone = () => {
    if (!pad) return;
    const v = Number(pad.text.replace(",", "."));
    journal.push({ gesture: "button", hit: pad.field, result: `NUMPAD ${pad.field} ${pad.text}`, selBefore: sel?.id ?? null });
    if (pad.field === "place" && selPart && Number.isFinite(v)) {
      const g = gapsOf(session, selPart.id);
      if (g) {
        const r = run(session, { word: "DRAG", target: "part", part: selPart.id, delta: Math.round((v - g.lo) * 10) / 10 });
        if (r.result.accepted) commit(r.session, `${selPart.name.toLowerCase()} ${g.lo} → ${v}`);
        else setMsg("Туда не встанет");
      }
    }
    setPad(null);
  };

  /** Слово из столбца: касание — поставить по метке; перетащить на тумбу — поставить, где отпустил. */
  const verbDown = (type: "shelf" | "divider", fallback: NonNullable<Mark>, e: React.PointerEvent) => {
    journal.touch();
    const sx = e.clientX, sy = e.clientY;
    let moved = false, last: NonNullable<Mark> | null = null;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < MOVE_PX) return;
      moved = true;
      const r = stageRef.current!.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const h = hitTest(x, y, [], targets(live.current.session).spaces, null);
      last = h.hit ? { space: h.hit.id, ...toMm10(h.hit.id, x, y) } : null;
      setVdrag({ type, mark: last, px: x, py: y });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setVdrag(null);
      if (!moved) return add(type, live.current.mark ?? fallback, "button");
      if (last) return add(type, last, "verbdrag");
      journal.push({ gesture: "verbdrag", hit: null, result: `VERB_DRAG_CANCEL ${type}`, selBefore: live.current.sel?.id ?? null });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  if (!unit) return <Sketch onDone={(w, h, d) => {
    const r = run(session, { word: "CUBE", w, h, d });
    journal.push({ gesture: "button", hit: null, result: r.result.accepted ? `CUBE ${w}×${h}×${d}` : `REFUSED CUBE`, selBefore: null });
    if (!r.result.accepted) return;
    commit(r.session, `тумба ${w} × ${h} × ${d}`);
    if (variant === "A") { const o = openings(r.session)[0]; if (o) setSel({ kind: "space", id: o.id }); }
  }} onCorner={onEnd} />;

  const sc = sceneRef.current;
  const g = selPart ? gapsOf(shown, selPart.id) : null;

  return (
    <div style={S.page}>
      <div style={S.top}>
        <Corner onEnd={onEnd} timer={cornerTimer} />
        <b style={{ fontSize: 24 }}>Тумба {unit.w} × {unit.h} × {unit.d}</b>
      </div>
      <div style={S.body}>
        <div style={S.stageWrap}>
          <div ref={stageRef} style={S.stage} />
          {sc && (
            <svg style={S.overlay} width={sc.w} height={sc.h}>
              {selSpace && <Poly sc={sc} b={selSpace.box} fill="rgba(232,89,12,0.12)" stroke="#e8590c" dash />}
              {mark && (() => {
                const b = shown.state.evaluation.boxes[mark.space];
                if (!b) return null;
                const [ax, ay] = sc.project(b.min.x, mark.y, 0), [bx] = sc.project(b.max.x, mark.y, 0);
                const [cx, cy0] = sc.project(mark.x, b.max.y, 0), [, cy1] = sc.project(mark.x, b.min.y, 0);
                const [px, py] = sc.project(mark.x, mark.y, 0);
                return (
                  <g stroke="#e8590c" strokeWidth={2.5} fill="none">
                    <line x1={ax} y1={ay} x2={bx} y2={ay} strokeDasharray="9 6" />
                    <line x1={cx} y1={cy0} x2={cx} y2={cy1} strokeDasharray="9 6" />
                    <circle cx={px} cy={py} r={9} />
                    <text x={ax + 8} y={ay - 8} fill="#e8590c" stroke="none" fontSize={16} fontWeight={700}>≈ {Math.round(mm(mark.y - b.min.y))}</text>
                    <text x={cx + 8} y={cy0 + 20} fill="#e8590c" stroke="none" fontSize={16} fontWeight={700}>≈ {Math.round(mm(mark.x - b.min.x))}</text>
                  </g>
                );
              })()}
              {vdrag?.mark && (() => {
                const b = shown.state.evaluation.boxes[vdrag.mark.space];
                if (!b) return null;
                const shelf = vdrag.type === "shelf";
                const [x1, y1] = shelf ? sc.project(b.min.x, vdrag.mark.y, 0) : sc.project(vdrag.mark.x, b.min.y, 0);
                const [x2, y2] = shelf ? sc.project(b.max.x, vdrag.mark.y, 0) : sc.project(vdrag.mark.x, b.max.y, 0);
                const gap = Math.max(0, Math.round(mm((shelf ? vdrag.mark.y - b.min.y : vdrag.mark.x - b.min.x)) - 8));
                return (
                  <g>
                    <Poly sc={sc} b={b} fill="rgba(232,89,12,0.10)" stroke="#e8590c" dash />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8590c" strokeOpacity={0.7} strokeWidth={12} strokeLinecap="round" />
                    <text x={shelf ? x1 + 10 : x1 + 14} y={shelf ? y1 - 14 : (y1 + y2) / 2} fontSize={22} fontWeight={800} fill="#e8590c">{gap} {shelf ? "от низа" : "от левой"}</text>
                  </g>
                );
              })()}
              {vdrag && (
                <g transform={`translate(${vdrag.px - 150} ${vdrag.py - 90})`}>
                  <rect width={130} height={48} rx={10} fill="#16191c" />
                  <text x={65} y={31} textAnchor="middle" fontSize={20} fontWeight={700} fill="#fff">{vdrag.type === "shelf" ? "Полка" : "Перегородка"}</text>
                </g>
              )}
              {selPart && g && <Chain sc={sc} part={selPart} g={g} big={!!preview} />}
              {selPart && selPart.movable && g && <Grip sc={sc} part={selPart} />}
              {preview?.tag && selPart && (() => {
                const [x, y] = sc.project(selPart.box.max.x, selPart.box.max.y, 0);
                const warn = preview.tag === "упёрлась";
                return <text x={x + 44} y={y - 16} fontSize={20} fontWeight={800} fill={warn ? "#c62828" : "#1e8449"}>{preview.tag}</text>;
              })()}
            </svg>
          )}
          {menu && (
            <div style={{ ...S.menu, left: Math.max(8, menu.px - 250), top: Math.max(8, menu.py - 170) }}>
              <Btn onClick={() => add("shelf", menu.mark, "menu")}>Полка</Btn>
              <Btn onClick={() => add("divider", menu.mark, "menu")}>Перегородка</Btn>
            </div>
          )}
          {sc && !sc.isDefaultView() && (
            <button style={S.front} onClick={() => { sc.resetView(); journal.push({ gesture: "button", hit: null, result: "VIEW_FRONT", selBefore: sel?.id ?? null }); force((n) => n + 1); }}>Спереди</button>
          )}
          <div style={S.undoRow}>
            <button style={{ ...S.undo, opacity: canUndo ? 1 : 0.35 }} disabled={!canUndo} onClick={doUndo}>
              ↶ Отменить<span style={S.undoSub}>{canUndo ? history[history.length - 1] : "нечего"}</span>
            </button>
            {redo.length > 0 && <button style={S.redo} onClick={doRedo}>Вернуть</button>}
          </div>
        </div>

        <aside style={S.col}>
          {pad ? (
            <Numpad title={pad.field === "place" ? placeWord : ""} text={pad.text} onChange={(t) => setPad({ ...pad, text: t })} onDone={padDone} />
          ) : selPart ? (
            <>
              <h2 style={S.h2}>{selPart.name}</h2>
              <div style={S.mono}>{sizeText(selPart)}</div>
              {selPart.movable && g && (
                <Row onClick={() => { setPad({ field: "place", text: "" }); journal.push({ gesture: "button", hit: selPart.id, result: "OPEN_PLACE", selBefore: selPart.id }); }}
                  label="Место" value={`${g.lo} ${placeWord}`} />
              )}
              {!selPart.movable && <p style={S.note}>Стоит вместе с корпусом</p>}
              <div style={{ flex: 1 }} />
              {selPart.movable && <Row onClick={() => removePart(selPart)} label="Убрать" danger />}
            </>
          ) : selSpace ? (
            <>
              <h2 style={S.h2}>Проём</h2>
              <div style={S.mono}>{mm(selSpace.box.max.x - selSpace.box.min.x)} × {mm(selSpace.box.max.y - selSpace.box.min.y)} в свету</div>
              <div style={S.note}>{whereText(shown, selSpace.box)}</div>
              <Verb label="Полка" icon="─" onDown={(e) => verbDown("shelf", centreOf(selSpace), e)} />
              <Verb label="Перегородка" icon="│" onDown={(e) => verbDown("divider", centreOf(selSpace), e)} />
            </>
          ) : (
            <>
              <h2 style={S.h2}>Тумба</h2>
              <div style={S.mono}>{unit.w} × {unit.h} × {unit.d}</div>
            </>
          )}
          {msg && <p style={S.msg}>{msg}</p>}
        </aside>
      </div>
    </div>
  );

  function centreOf(o: { id: string; box: { min: { x: number; y: number }; max: { x: number; y: number } } }) {
    return { space: o.id, x: (o.box.min.x + o.box.max.x) / 2, y: (o.box.min.y + o.box.max.y) / 2 };
  }
}

// ── мелкие части ──

function Poly({ sc, b, fill, stroke, dash }: { sc: Scene; b: PartInfo["box"]; fill: string; stroke: string; dash?: boolean }) {
  const p = [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.max.x, b.max.y], [b.min.x, b.max.y]].map(([x, y]) => sc.project(x!, y!, 0).join(",")).join(" ");
  return <polygon points={p} fill={fill} stroke={stroke} strokeWidth={2.5} strokeDasharray={dash ? "10 6" : undefined} />;
}

function Chain({ sc, part, g, big }: { sc: Scene; part: PartInfo; g: NonNullable<ReturnType<typeof gapsOf>>; big: boolean }) {
  const a = g.axis, z = part.box.min.z;
  const pt = (v: number) => (a === "y" ? sc.project(g.at, v, z) : sc.project(v, g.at, z));
  const segs: [number, number, number][] = [[g.loEdge, part.box.min[a], g.lo], [part.box.max[a], g.hiEdge, g.hi]];
  const fs = big ? 28 : 20;
  return (
    <g>
      {segs.map(([from, to, val], i) => {
        const [x1, y1] = pt(from), [x2, y2] = pt(to);
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const w = String(val).length * fs * 0.62 + 14;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#16191c" strokeWidth={1.8} />
            {[[x1, y1], [x2, y2]].map(([x, y], k) => <line key={k} x1={x! - 7} y1={y! + 7} x2={x! + 7} y2={y! - 7} stroke="#16191c" strokeWidth={2} />)}
            <rect x={cx - w / 2} y={cy - fs * 0.75} width={w} height={fs * 1.5} rx={6} fill="#fff" />
            <text x={cx} y={cy + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={700} fontFamily="ui-monospace, Menlo, monospace">{val}</text>
          </g>
        );
      })}
    </g>
  );
}

function Grip({ sc, part }: { sc: Scene; part: PartInfo }) {
  const b = part.box;
  const [x, y] = part.axis === "y"
    ? sc.project(b.max.x - 300, (b.min.y + b.max.y) / 2, b.min.z)
    : sc.project((b.min.x + b.max.x) / 2, b.min.y + 400, b.min.z);
  return (
    <g>
      <circle cx={x} cy={y} r={27} fill="#e8590c" stroke="#fff" strokeWidth={3} />
      {part.axis === "y"
        ? <path d={`M${x} ${y - 16} l-8 9 h16 z M${x} ${y + 16} l-8 -9 h16 z`} fill="#fff" />
        : <path d={`M${x - 16} ${y} l9 -8 v16 z M${x + 16} ${y} l-9 -8 v16 z`} fill="#fff" />}
    </g>
  );
}

function Row({ label, value, icon, danger, onClick }: { label: string; value?: string; icon?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button style={{ ...S.row, color: danger ? "#c62828" : "#16191c" }} onClick={onClick}>
      {icon && <span style={{ width: 34, fontSize: 26, fontWeight: 900 }}>{icon}</span>}
      <span style={{ flex: 1, textAlign: "left" }}>
        {label}
        {value && <span style={{ display: "block", fontSize: 16, color: "#5e666d", fontFamily: "ui-monospace, Menlo, monospace" }}>{value}</span>}
      </span>
    </button>
  );
}

function Verb({ label, icon, onDown }: { label: string; icon: string; onDown: (e: React.PointerEvent) => void }) {
  return (
    <button style={{ ...S.row, color: "#16191c", touchAction: "none" }} onPointerDown={onDown}>
      <span style={{ width: 34, fontSize: 26, fontWeight: 900 }}>{icon}</span>
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
    </button>
  );
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button style={S.menuBtn} onClick={onClick}>{children}</button>;
}

function Corner({ onEnd, timer }: { onEnd: () => void; timer: React.MutableRefObject<number | null> }) {
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return (
    <div style={S.corner}
      onPointerDown={() => { clear(); timer.current = window.setTimeout(onEnd, 2000); }}
      onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear} />
  );
}

export function Numpad({ title, text, onChange, onDone, done = "Готово" }: { title: string; text: string; onChange: (t: string) => void; onDone: () => void; done?: string }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];
  return (
    <div>
      <div style={{ fontSize: 20, color: "#5e666d", marginBottom: 6 }}>{title}</div>
      <div style={S.padField}>{text || " "}<span style={{ fontSize: 18, color: "#5e666d" }}> мм</span></div>
      <div style={S.keys}>
        {keys.map((k) => (
          <button key={k} style={S.key} onClick={() => onChange(k === "⌫" ? text.slice(0, -1) : (text + k).slice(0, 7))}>{k}</button>
        ))}
      </div>
      <button style={S.done} onClick={onDone}>{done}</button>
    </div>
  );
}

function Sketch({ onDone, onCorner }: { onDone: (w: number, h: number, d: number) => void; onCorner: () => void }) {
  const [v, setV] = useState({ w: "", h: "", d: "" });
  const [field, setField] = useState<"w" | "h" | "d">("w");
  const order = ["w", "h", "d"] as const;
  const word = { w: "ширина", h: "высота", d: "глубина" };
  const timer = useRef<number | null>(null);
  const next = order[order.indexOf(field) + 1];
  const box = (f: "w" | "h" | "d", style: CSSProperties) => (
    <button style={{ ...S.field, ...style, borderColor: field === f ? "#e8590c" : "#9aa1a6", background: field === f ? "#ffe8d9" : "#fff" }}
      onClick={() => { setField(f); journal.touch(); journal.push({ gesture: "tap", hit: `field ${f}`, result: `FIELD ${f}`, selBefore: null }); }}>
      {v[f] || <span style={{ color: "#9aa1a6", fontSize: 18 }}>{word[f]}</span>}
    </button>
  );
  const ready = order.every((f) => Number(v[f]) > 0);
  return (
    <div style={S.page}>
      <div style={S.top}><Corner onEnd={onCorner} timer={timer} /><b style={{ fontSize: 24 }}>Новая тумба</b></div>
      <div style={S.body}>
        <div style={{ ...S.stageWrap, display: "grid", placeItems: "center" }}>
          <div style={{ position: "relative", width: 360, height: 430 }}>
            <div style={{ position: "absolute", inset: 0, border: "3px dashed #5e666d", background: "#fbfbf9" }} />
            <div style={{ position: "absolute", left: 40, top: -40, width: 360, height: 40, borderTop: "3px dashed #9aa1a6", borderRight: "3px dashed #9aa1a6", transform: "skewX(-45deg)", transformOrigin: "bottom left" }} />
            {box("w", { left: 120, bottom: -86 })}
            {box("h", { left: -150, top: 185 })}
            {box("d", { right: -120, top: -80 })}
          </div>
        </div>
        <aside style={S.col}>
          <Numpad title={word[field]} text={v[field]}
            onChange={(t) => setV({ ...v, [field]: t.replace(",", "") })}
            done={next ? `Дальше: ${word[next]}` : "Готово"}
            onDone={() => {
              journal.touch();
              if (next) { setField(next); return; }
              if (ready) onDone(Number(v.w), Number(v.h), Number(v.d));
              else setField(order.find((f) => !(Number(v[f]) > 0)) ?? "w");
            }} />
        </aside>
      </div>
    </div>
  );
}

export function Setup({ onStart }: { onStart: (task: number, variant: Variant) => void }) {

  const [count, setCount] = useState(journal.all().length);
  return (
    <div style={{ ...S.page, padding: 24, overflow: "auto", display: "block" }}>
      <h1 style={{ margin: "0 0 4px" }}>Стенд · Round 1 — экран наблюдателя</h1>
      <p style={S.note}>Мастеру ничего не объяснять. Сказать только задание — и молчать. Задание заканчивается: держать левый верхний угол экрана 2 секунды (или Esc).</p>
      {TASKS.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #c9cec8" }}>
          <b style={{ width: 28, fontSize: 22 }}>{i + 1}</b>
          <span style={{ flex: 1, fontSize: 18 }}>«{t.say}»{t.built && <i style={{ color: "#5e666d" }}> — начинается с готовой тумбы</i>}</span>
          <button style={S.go} onClick={() => onStart(i + 1, "A")}>Начать</button>
        </div>
      ))}
      <p style={S.note}>Одна архитектура (I «Выбрал — сделал»): касание выбирает; «Полка»/«Перегородка» в столбце — касанием или перетаскиванием на тумбу; доску можно тащить сразу. Что проверяем — H1–H7 на странице исследования.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button style={S.go} onClick={() => download(`bench-journal-${new Date().toISOString().slice(0, 16)}.json`, journal.all())}>Скачать журнал ({count})</button>
        <button style={S.vbtn} onClick={() => { journal.clear(); setCount(0); }}>Очистить журнал</button>
      </div>
      <p style={S.note}>Журнал наблюдателя (пауза / ошибка / вопрос) — на телефоне: эта же страница с <code>?observer</code>. Журналы сводятся по часам.</p>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#eceeea", color: "#16191c", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", userSelect: "none", WebkitUserSelect: "none", touchAction: "none" },
  top: { height: 60, flex: "none", display: "flex", alignItems: "center", padding: "0 20px", background: "#fff", borderBottom: "1.5px solid #c9cec8", position: "relative" },
  corner: { position: "absolute", left: 0, top: 0, width: 90, height: 60, zIndex: 20 },
  body: { flex: 1, display: "flex", minHeight: 0 },
  stageWrap: { flex: 1, position: "relative", minWidth: 0 },
  stage: { position: "absolute", inset: 0, touchAction: "none" },
  overlay: { position: "absolute", inset: 0, pointerEvents: "none" },
  col: { width: 300, flex: "none", background: "#fff", borderLeft: "1.5px solid #c9cec8", padding: 20, display: "flex", flexDirection: "column", gap: 4 },
  h2: { fontSize: 32, margin: "4px 0 0", fontWeight: 800 },
  mono: { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 20, marginBottom: 10 },
  note: { color: "#5e666d", fontSize: 16, margin: "0 0 10px" },
  msg: { color: "#c62828", fontSize: 20, fontWeight: 700 },
  row: { display: "flex", alignItems: "center", minHeight: 74, fontSize: 23, fontWeight: 600, background: "none", border: "none", borderBottom: "1px solid #c9cec8", padding: "6px 4px", cursor: "pointer" },
  undoRow: { position: "absolute", left: 20, bottom: 20, display: "flex", gap: 12 },
  undo: { width: 230, height: 78, borderRadius: 14, border: "none", background: "#16191c", color: "#fff", fontSize: 23, fontWeight: 700, textAlign: "left", padding: "0 18px", display: "flex", flexDirection: "column", justifyContent: "center" },
  undoSub: { fontSize: 15, fontWeight: 400, opacity: 0.75 },
  redo: { height: 78, padding: "0 22px", borderRadius: 14, border: "2px solid #16191c", background: "#fff", fontSize: 20, fontWeight: 700 },
  front: { position: "absolute", left: 20, top: 20, height: 60, padding: "0 22px", borderRadius: 12, border: "2px solid #16191c", background: "#fff", fontSize: 20, fontWeight: 700 },
  menu: { position: "absolute", display: "flex", flexDirection: "column", gap: 8, padding: 10, background: "#fff", border: "2px solid #16191c", borderRadius: 14, zIndex: 10 },
  menuBtn: { width: 220, height: 66, fontSize: 23, fontWeight: 700, borderRadius: 10, border: "1.5px solid #c9cec8", background: "#f2f3ef" },
  padField: { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 40, fontWeight: 700, border: "3px solid #e8590c", background: "#ffe8d9", borderRadius: 12, padding: "8px 14px", marginBottom: 12 },
  keys: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  key: { height: 70, fontSize: 28, fontWeight: 600, borderRadius: 12, border: "1.5px solid #c9cec8", background: "#f2f3ef" },
  done: { marginTop: 12, width: "100%", height: 76, borderRadius: 14, border: "none", background: "#16191c", color: "#fff", fontSize: 21, fontWeight: 700 },
  field: { position: "absolute", width: 130, height: 64, borderRadius: 10, border: "3px solid", fontSize: 30, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" },
  vbtn: { height: 52, minWidth: 52, padding: "0 14px", borderRadius: 10, border: "2px solid #16191c", fontSize: 20, fontWeight: 700, background: "#fff" },
  go: { height: 52, padding: "0 20px", borderRadius: 10, border: "none", background: "#1e8449", color: "#fff", fontSize: 19, fontWeight: 700 },
};
