// CabinetEditor — self-contained Three.js cabinet editor powered by the kernel.
// Follows bench's architecture (Scene / model / hit) but with proper React state
// and the research-validated "Chose → Did" interaction model.
//
// Features:
// - Interactive 1-finger 3D Drag & Snap: slide shelves/dividers with live snap (= поровну, в линию, упёрлась)
// - Responsive layout: 100% full-viewport 3D on mobile + floating action cards + bottom sheet for layers
// - Desktop: side-by-side 3D stage + right properties/layers panel
// - Kernel is the single source of truth: no arithmetic in UI

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  run,
  undo as kernelUndo,
  joints,
  cutList as kernelCutList,
  type Session,
  type Command,
  type Joint,
  type FillPart,
} from "../kernel";
import { CutlistView } from "./CutlistView";
import {
  parts,
  openings,
  unitSize,
  gapsOf,
  sizeText,
  whereText,
  mm,
  type PartInfo,
} from "../bench/model";
import {
  hitTest,
  type Hit,
  type Target,
} from "../bench/hit";
import { Scene as KernelScene, type CameraPreset } from "../bench/scene";
import { computeDrillMarks, type DrillMark } from "../bench/drillMarks";

// ── Constants & Types ────────────────────────────────────────────────────────

const CAMERA_PRESETS: { id: CameraPreset; label: string; icon: string; desc: string }[] = [
  { id: "iso", label: "3D Изо", icon: "🧊", desc: "Свободный 3D обзор" },
  { id: "front", label: "Фасад", icon: "🚪", desc: "Спереди · Выравнивание" },
  { id: "top", label: "План", icon: "📐", desc: "Сверху · Глубины и зазоры" },
  { id: "side", label: "Разрез", icon: "◫", desc: "Сбоку · Высоты полок" },
  { id: "xray", label: "Рентген", icon: "✨", desc: "X-Ray · Прозрачный каркас" },
];

const MOVE_PX = 8;
const SNAP_PX = 12;

const JOINT_METHODS = [
  { id: "confirmat-7x50", name: "Конфирмат 7×50" },
  { id: "eccentric", name: "Эксцентрик (Rastex)" },
  { id: "шкант-8", name: "Шканты 8×30" },
];

interface Selection {
  kind: "part" | "space";
  id: string;
}

interface DragState {
  part: PartInfo;
  base: Session;
  x: number;
  y: number;
  ux: number;
  uy: number;
  pxPerMm: number;
  lo: number;
  hi: number;
  others: number[];
  want: number;
  snap: string | null;
  raf: number;
}

interface CabinetEditorProps {
  /** Initial kernel session (from bridge.cabinetToSession). */
  initialSession: Session;
  /** Called when the user exits the editor. `session` is null if they discarded. */
  onExit: (session: Session | null) => void;
  cabTitle?: string;
  cabSubtitle?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CabinetEditor({ initialSession, onExit, cabTitle, cabSubtitle }: CabinetEditorProps) {
  const [session, setSession] = useState<Session>(initialSession);
  const [preview, setPreview] = useState<{ session: Session; tag: string | null; delta: number; partId: string } | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ space: string; x: number; y: number } | null>(null);
  const [showLayersSheet, setShowLayersSheet] = useState(false);
  const [hasRotated, setHasRotated] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"layout" | "joints" | "cutlist">("layout");
  const [jointIdx, setJointIdx] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("iso");
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showDrillMarks, setShowDrillMarks] = useState(false);

  // Responsive mobile detection (< 768px)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      const mob = window.innerWidth < 768;
      setIsMobile(mob);
      if (sceneRef.current) {
        sceneRef.current.resize();
        sceneRef.current.fit(unitSize(live.current.session));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<KernelScene | null>(null);
  const live = useRef({ session, sel, menu });
  live.current = { session, sel, menu };
  const [, force] = useState(0);

  const activeSession = preview?.session ?? session;
  const canUndo = !!session.previous;
  const unit = unitSize(activeSession);
  const allParts = parts(activeSession);
  const allOpenings = openings(activeSession);
  const frontParts = allParts.filter((p) => p.type === "front");
  const frontCount = frontParts.length;

  const backPart = allParts.find((p) => p.type === "back");
  const backMount: "groove" | "overlay" | "none" = useMemo(() => {
    if (!backPart) return "none";
    const n = activeSession.state.graph.nodes[backPart.id];
    if (n && n.kind === "part" && n.position.kind === "plane") {
      return n.position.offset === 0 ? "overlay" : "groove";
    }
    return "groove";
  }, [backPart, activeSession]);

  const jointList = useMemo(() => joints(activeSession), [activeSession]);
  const safeJointIdx = Math.max(0, Math.min(Math.max(0, jointList.length - 1), jointIdx));
  const currentJoint = jointList[safeJointIdx] ?? null;

  // Kernel cutList: parts as segments sliced by joints, ready for nesting & export
  const cutListParts = useMemo(() => kernelCutList(activeSession), [activeSession]);

  // 3D hardware fastener drill points (System 32)
  const drillMarks = useMemo(() => {
    const sc = sceneRef.current;
    const angle = sc ? sc.getDoorAngle() : (doorsOpen ? 1.65 : 0);
    return computeDrillMarks(allParts, jointList, angle);
  }, [allParts, jointList, doorsOpen]);

  // ── Three.js scene ──
  useLayoutEffect(() => {
    if (!unit || !stageRef.current) return;
    const sc = new KernelScene(stageRef.current);
    sceneRef.current = sc;
    sc.fit(unit);
    const ro = new ResizeObserver(() => {
      sc.resize();
      sc.fit(unitSize(live.current.session));
      force((n) => n + 1);
    });
    ro.observe(stageRef.current);
    force((n) => n + 1);
    return () => {
      ro.disconnect();
      sc.dispose();
      sceneRef.current = null;
    };
  }, [!!unit]);

  // Smoothly swing doors open or closed
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const targetAngle = doorsOpen ? 1.62 : 0;
    const startAngle = sc.getDoorAngle();
    if (Math.abs(targetAngle - startAngle) < 0.01) return;

    let rafId: number;
    const startTime = performance.now();
    const duration = 360; // ms

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const angle = startAngle + (targetAngle - startAngle) * ease;
      sc.setDoorAngle(angle);

      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [doorsOpen]);

  // Rebuild meshes on state / selection / preview change (layout mode)
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (viewMode === "joints") return; // Handled by joint focus effect
    sc.build(
      parts(activeSession),
      sel?.kind === "part" ? sel.id : null,
      sc.getDoorAngle(),
      null,
      cameraPreset === "xray" || showDrillMarks,
    );
  }, [activeSession, sel, viewMode, cameraPreset, showDrillMarks]);

  // Focus camera and highlight joint in 3D when in joints mode
  useEffect(() => {
    if (viewMode !== "joints") return;
    const sc = sceneRef.current;
    if (!sc || !currentJoint) return;

    const partA = allParts.find((p) => p.id === currentJoint.a);
    const partB = allParts.find((p) => p.id === currentJoint.b);
    if (partA && partB) {
      sc.focusJoint(partA.box, partB.box, unit);
      sc.build(
        allParts,
        null,
        sc.getDoorAngle(),
        [currentJoint.a, currentJoint.b],
        cameraPreset === "xray" || showDrillMarks,
      );
    }
  }, [viewMode, safeJointIdx, currentJoint?.id, activeSession, cameraPreset, showDrillMarks]);

  const handleSelectPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    setShowViewDropdown(false);
    setHasRotated(true);
    const sc = sceneRef.current;
    if (!sc) return;
    sc.setViewPreset(preset, unit);
    sc.build(
      allParts,
      sel?.kind === "part" ? sel.id : null,
      sc.getDoorAngle(),
      viewMode === "joints" && currentJoint ? [currentJoint.a, currentJoint.b] : null,
      preset === "xray" || showDrillMarks,
    );
  };

  // Render 3D hardware fastener drill marks
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    const isVisible = showDrillMarks || cameraPreset === "xray" || viewMode === "joints";
    sc.renderDrillMarks(
      drillMarks,
      isVisible,
      viewMode === "joints" && currentJoint ? currentJoint.id : null,
    );
  }, [drillMarks, showDrillMarks, cameraPreset, viewMode, currentJoint?.id]);

  // Keyboard navigation for joints mode (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (viewMode !== "joints" || jointList.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setJointIdx((i) => (i > 0 ? i - 1 : jointList.length - 1));
      } else if (e.key === "ArrowRight") {
        setJointIdx((i) => (i < jointList.length - 1 ? i + 1 : 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, jointList.length]);

  const handleModeChange = (mode: "layout" | "joints" | "cutlist") => {
    setViewMode(mode);
    setMenu(null);
    if (mode === "joints") {
      setSel(null);
      if (!doorsOpen && frontCount > 0) {
        setDoorsOpen(true);
      }
    } else {
      sceneRef.current?.clearJoint(unit);
      if (mode === "cutlist") {
        setSel(null);
      }
    }
  };

  // ── Hit test helpers ──
  const targets = useCallback(
    (s: Session): { parts: Target[]; spaces: Target[] } => {
      const sc = sceneRef.current!;
      return {
        parts: parts(s).map((p) => ({ id: p.id, poly: sc.front(p.box) })),
        spaces: openings(s).map((o) => ({ id: o.id, poly: sc.front(o.box) })),
      };
    },
    [],
  );

  // ── Commands ──
  const commit = useCallback(
    (next: Session, label: string) => {
      setSession(next);
      setHistory((h) => [...h, label]);
      setMsg(null);
    },
    [],
  );

  const updateJointThrough = useCallback(
    (joint: Joint, throughPartId: string) => {
      const s = live.current.session;
      const r = run(s, {
        word: "SCOPE",
        joint: [joint.a, joint.b],
        key: "through",
        value: throughPartId,
      });
      if (r.result.accepted) {
        commit(r.session, "Сквозная деталь");
      } else {
        setMsg(r.result.findings[0]?.text ?? "Не удалось изменить сквозность");
      }
    },
    [commit],
  );

  const updateJointMethod = useCallback(
    (joint: Joint, method: string) => {
      const s = live.current.session;
      const r = run(s, {
        word: "SCOPE",
        joint: [joint.a, joint.b],
        key: "method",
        value: method,
      });
      if (r.result.accepted) {
        commit(r.session, "Крепёж стыка");
      } else {
        setMsg(r.result.findings[0]?.text ?? "Не удалось изменить крепёж");
      }
    },
    [commit],
  );

  const addPart = useCallback(
    (type: "shelf" | "divider", spaceId: string) => {
      const s = live.current.session;
      const axis = type === "shelf" ? "y" : "x";

      const r = run(s, {
        word: "PATTERN",
        op: "create",
        space: spaceId,
        axis,
        gaps: [{ ratio: 1 }, { ratio: 1 }],
        member: type,
      });

      if (!r.result.accepted) {
        setMsg(r.result.findings[0]?.text ?? "Не получается добавить");
        return;
      }

      const newParts = parts(r.session)
        .map((p) => p.id)
        .filter((id) => !s.state.graph.nodes[id]);
      const newId = newParts[0] ?? null;

      commit(r.session, type === "shelf" ? "Полка" : "Перегородка");
      if (newId) setSel({ kind: "part", id: newId });
      setMenu(null);
    },
    [commit],
  );

  const removePart = useCallback(
    (partId: string) => {
      const s = live.current.session;
      const n = s.state.graph.nodes[partId];
      if (!n) return;
      const cmd: Command =
        n.kind === "part" && (n as any).position?.kind === "member"
          ? { word: "PATTERN", op: "remove", member: partId }
          : { word: "REPLACE", part: partId, with: "nothing" };

      const r = run(s, cmd);
      if (!r.result.accepted) {
        setMsg("Не получается убрать");
        return;
      }
      commit(r.session, "Убрал");
      setSel(null);
    },
    [commit],
  );

  const setDoorCount = useCallback(
    (count: number) => {
      const s = live.current.session;
      const existingFrontPatternId = Object.keys(s.state.graph.nodes).find((id) => {
        const n = s.state.graph.nodes[id];
        return n?.kind === "pattern" && (n as any).fill?.type === "front";
      });

      let cur = s;
      if (existingFrontPatternId) {
        const r = run(cur, { word: "PATTERN", op: "dissolve", pattern: existingFrontPatternId });
        if (r.result.accepted) {
          cur = r.session;
        }
      }

      if (count > 0) {
        const r = run(cur, {
          word: "PATTERN",
          op: "create",
          space: "U1",
          axis: "x",
          gaps: Array.from({ length: count }, () => ({ ratio: 1 })),
          member: null,
          fill: { type: "front", face: "front" },
        });
        if (!r.result.accepted) {
          setMsg(r.result.findings[0]?.text ?? "Не удалось изменить створки");
          return;
        }
        cur = r.session;
      }

      commit(
        cur,
        count === 0 ? "Без фасада" : count === 1 ? "1 створка" : `${count} створки`,
      );
    },
    [commit],
  );

  const setBackMount = useCallback(
    (mode: "groove" | "overlay" | "none") => {
      const s = live.current.session;
      const existingBack = parts(s).find((p) => p.type === "back");

      let cur = s;
      if (existingBack) {
        const r = run(cur, { word: "REPLACE", part: existingBack.id, with: "nothing" });
        if (r.result.accepted) {
          cur = r.session;
        } else {
          setMsg(r.result.findings[0]?.text ?? "Не удалось снять задник");
          return;
        }
      }

      if (mode === "groove") {
        const r = run(cur, {
          word: "PLACE",
          host: "S1",
          type: "back",
          thickness: 4,
          spans: { x: "full", y: "full" },
          relation: {
            kind: "on",
            plane: { node: "S1", face: "back" },
            side: "inside",
            offset: 10,
          },
        });
        if (!r.result.accepted) {
          setMsg(r.result.findings[0]?.text ?? "Не удалось установить задник в паз");
          return;
        }
        cur = r.session;
      } else if (mode === "overlay") {
        const r = run(cur, {
          word: "PLACE",
          host: "U1",
          type: "back",
          thickness: 4,
          spans: { x: "full", y: "full" },
          relation: {
            kind: "on",
            plane: { node: "U1", face: "back" },
            side: "outside",
            offset: 0,
          },
        });
        if (!r.result.accepted) {
          setMsg(r.result.findings[0]?.text ?? "Не удалось установить накладной задник");
          return;
        }
        cur = r.session;
      }

      commit(
        cur,
        mode === "groove"
          ? "Задник: в паз"
          : mode === "overlay"
          ? "Задник: накладной"
          : "Без задника",
      );
    },
    [commit],
  );

  const doUndo = useCallback(() => {
    const s = live.current.session;
    if (!s.previous) return;
    const prev = kernelUndo(s);
    setSession(prev);
    setHistory((h) => h.slice(0, -1));
    setMsg(null);
    setMenu(null);
    if (live.current.sel && !prev.state.graph.nodes[live.current.sel.id]) {
      setSel(null);
    }
  }, []);

  const handleAddShelfQuick = useCallback(() => {
    const targetSpace = sel?.kind === "space"
      ? allOpenings.find((o) => o.id === sel.id)
      : allOpenings.slice().sort((a, b) => (b.box.max[1] - b.box.min[1]) - (a.box.max[1] - a.box.min[1]))[0];
    if (targetSpace) {
      addPart("shelf", targetSpace.id);
    } else {
      setMsg("Нет свободного пространства для полки");
    }
  }, [allOpenings, sel, addPart]);

  const handleAddDividerQuick = useCallback(() => {
    const targetSpace = sel?.kind === "space"
      ? allOpenings.find((o) => o.id === sel.id)
      : allOpenings.slice().sort((a, b) => (b.box.max[0] - b.box.min[0]) - (a.box.max[0] - a.box.min[0]))[0];
    if (targetSpace) {
      addPart("divider", targetSpace.id);
    } else {
      setMsg("Нет свободного пространства для перегородки");
    }
  }, [allOpenings, sel, addPart]);

  const handleCycleBackMount = useCallback(() => {
    const next = backMount === "groove" ? "overlay" : backMount === "overlay" ? "none" : "groove";
    setBackMount(next);
  }, [backMount, setBackMount]);

  const handleCycleDoors = useCallback(() => {
    const next = frontCount === 0 ? 1 : frontCount === 1 ? 2 : 0;
    setDoorCount(next);
  }, [frontCount, setDoorCount]);

  // ── Pointer handling with 1-finger 3D Drag & Snap ──
  useEffect(() => {
    const el = stageRef.current;
    const sc = sceneRef.current;
    if (!el || !sc) return;

    const pts = new Map<number, { x: number; y: number }>();
    let down: {
      x: number;
      y: number;
      lastX: number;
      lastY: number;
      t: number;
      hit: Hit;
      moved: boolean;
      orbiting: boolean;
    } | null = null;
    let drag: DragState | null = null;
    let cam: { yaw: number; pitch: number; zoom: number; mx: number; my: number; dist: number } | null = null;

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const mid = () => {
      const a = [...pts.values()];
      return {
        x: (a[0]!.x + a[1]!.x) / 2,
        y: (a[0]!.y + a[1]!.y) / 2,
        d: Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y),
      };
    };

    const startDrag = (p: PartInfo, x: number, y: number) => {
      const s = live.current.session;
      const g = gapsOf(s, p.id);
      const a = p.axis === "x" ? "x" : "y";
      const ax = sc.axisOnScreen(a, { x: p.box.min.x, y: p.box.min.y, z: p.box.min.z });
      const others = parts(s)
        .filter((o) => o.id !== p.id && o.type === p.type && o.axis === p.axis)
        .map((o) => mm(o.box.min[a]));
      drag = {
        part: p,
        base: s,
        x,
        y,
        ...ax,
        lo: g?.lo ?? 0,
        hi: g?.hi ?? 0,
        others,
        want: 0,
        snap: null,
        raf: 0,
      };
    };

    const resolveDrag = (d: DragState) => {
      const tryD = (v: number) =>
        run(d.base, { word: "DRAG", target: "part", part: d.part.id, delta: v });
      let delta = d.want;
      let tag = d.snap;
      let r = delta === 0 ? null : tryD(delta);
      if (r && !r.result.accepted) {
        let ok = 0;
        let bad = delta;
        while (Math.abs(bad - ok) > 1) {
          const m = Math.trunc((ok + bad) / 2);
          if (tryD(m).result.accepted) ok = m;
          else bad = m;
        }
        r = ok === 0 ? null : tryD(ok);
        delta = ok;
        tag = "упёрлась";
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

      // Snap logic: "= поровну" or align with other parts
      if (Math.abs(raw - eq) * d.pxPerMm < SNAP_PX) {
        delta = Math.round(eq * 10) / 10;
        tag = "= поровну";
      } else {
        const line = d.others.find((o) => Math.abs(pos + raw - o) * d.pxPerMm < SNAP_PX);
        if (line !== undefined) {
          delta = Math.round((line - pos) * 10) / 10;
          tag = "в линию";
        }
      }

      d.want = delta;
      d.snap = tag;

      cancelAnimationFrame(d.raf);
      d.raf = requestAnimationFrame(() => {
        const res = resolveDrag(d);
        setPreview({
          session: res.session ?? d.base,
          tag: res.tag,
          delta: res.delta,
          partId: d.part.id,
        });
      });
    };

    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      cancelAnimationFrame(d.raf);
      const res = resolveDrag(d);
      setPreview(null);

      if (res && res.delta !== 0 && res.session) {
        const g = gapsOf(res.session, d.part.id);
        const name = d.part.name.toLowerCase();
        commit(res.session, `${name}: ${res.delta > 0 ? "+" : ""}${res.delta} мм${res.tag ? ` (${res.tag})` : ""}`);
        setSel({ kind: "part", id: d.part.id });
      }
    };

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName !== "CANVAS") {
        return;
      }

      const p = local(e);
      pts.set(e.pointerId, p);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture fails
      }

      if (pts.size === 2) {
        // Two-finger → camera orbit/zoom
        if (drag) {
          cancelAnimationFrame(drag.raf);
          drag = null;
          setPreview(null);
        }
        const m = mid();
        cam = { ...sc.view, mx: m.x, my: m.y, dist: m.d };
        down = null;
        setHasRotated(true);
        return;
      }
      if (pts.size > 2) return;

      const t = targets(live.current.session);
      const h = hitTest(p.x, p.y, t.parts, t.spaces, live.current.sel?.id ?? null);

      // Enhance hit detection with Three.js raycasting — pixel-perfect for 3D meshes.
      // The 2D polygon test misses thin shelves seen at an angle; the raycaster doesn't.
      const rayPartId = sc.pick(p.x, p.y);
      let finalHit = h;
      if (rayPartId && (!h.hit || h.hit.kind !== "part" || h.hit.id !== rayPartId)) {
        // Raycaster found a part that the 2D polygon test missed or disagreed on — prefer raycast
        finalHit = { hit: { id: rayPartId, kind: "part" as const }, rule: 1 as const, candidates: h.candidates };
      }

      down = { ...p, lastX: p.x, lastY: p.y, t: Date.now(), hit: finalHit, moved: false, orbiting: false };
    };

    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);

      if (cam && pts.size === 2) {
        const m = mid();
        const dx = m.x - cam.mx;
        const dy = m.y - cam.my;
        sc.view.yaw = cam.yaw - dx * 0.005;
        sc.view.pitch = Math.max(-0.85, Math.min(1.25, cam.pitch + dy * 0.005));
        sc.view.zoom = Math.max(0.3, Math.min(4.0, cam.zoom * (m.d / cam.dist)));
        sc.place();
        setHasRotated(true);
        return;
      }

      if (drag) {
        return dragTo(p.x, p.y);
      }

      if (!down) return;

      if (down.orbiting) {
        const dx = p.x - down.lastX;
        const dy = p.y - down.lastY;
        down.lastX = p.x;
        down.lastY = p.y;
        sc.orbit(-dx * 0.005, dy * 0.005);
        setHasRotated(true);
        return;
      }

      // Check if finger / mouse moved beyond threshold
      const dist = Math.hypot(p.x - down.x, p.y - down.y);
      if (!down.moved && dist > MOVE_PX) {
        down.moved = true;
        const hit = down.hit.hit;
        if (hit?.kind === "part") {
          const part = parts(live.current.session).find((x) => x.id === hit.id);
          if (part?.movable && (part.axis === "x" || part.axis === "y")) {
            setSel({ kind: "part", id: hit.id });
            setMenu(null);
            startDrag(part, down.x, down.y);
            dragTo(p.x, p.y);
            return;
          }
        }
        // Not dragging a movable shelf → 1-finger / mouse camera orbit!
        down.orbiting = true;
        down.lastX = p.x;
        down.lastY = p.y;
        const dx = p.x - down.x;
        const dy = p.y - down.y;
        sc.orbit(-dx * 0.005, dy * 0.005);
        setHasRotated(true);
      }
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) cam = null;

      if (drag) {
        endDrag();
        down = null;
        return;
      }

      if (down && pts.size === 0) {
        const p = local(e);
        const dur = Date.now() - down.t;
        const totalDist = Math.hypot(p.x - down.x, p.y - down.y);

        // Treat as a TAP if:
        //  - barely moved (< MOVE_PX), OR
        //  - moved slightly but it was a quick, short gesture (< 20px within 400ms)
        //    — this catches trackpad/touch "taps" that jitter a few pixels
        const isTap = !down.moved || (totalDist < 20 && dur < 400);

        if (isTap && dur < 500) {
          // Re-run hit test at the DOWN position for accuracy
          const h = down.hit;
          if (live.current.menu) {
            setMenu(null);
          } else if (h.hit?.kind === "part") {
            setSel({ kind: "part", id: h.hit.id });
            setMsg(null);
          } else if (h.hit?.kind === "space") {
            setMenu({ space: h.hit.id, x: p.x, y: p.y });
            setSel({ kind: "space", id: h.hit.id });
          } else {
            setSel(null);
            setMenu(null);
          }
          // If orbit happened during this "tap", reset the view back
          if (down.orbiting) {
            // Don't reset — the tiny rotation is negligible
          }
        }
        down = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Mouse wheel or trackpad pinch
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      sc.zoomBy(factor);
      setHasRotated(true);
      force((n) => n + 1);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [targets]);

  // ── Selected part info ──
  const selPart = sel?.kind === "part" ? allParts.find((p) => p.id === sel.id) ?? null : null;
  const selGaps = selPart ? gapsOf(activeSession, selPart.id) : null;
  const selSpace = sel?.kind === "space" ? allOpenings.find((o) => o.id === sel.id) ?? null : null;

  // ── Render ──
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#f5f3ee",
        color: "#1c1f22",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          minHeight: isMobile ? 48 : 52,
          padding: isMobile
            ? "max(6px, env(safe-area-inset-top, 6px)) 12px 6px 12px"
            : "0 16px",
          background: "#fff",
          borderBottom: "1px solid #e5e3de",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 50,
          userSelect: "none",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          gap: 8,
        }}
      >
        {/* Left: Back / Done Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onExit(session)}
            style={{
              background: "#1c1f22",
              color: "#fff",
              border: "none",
              borderRadius: isMobile ? 20 : 8,
              padding: isMobile ? "7px 13px" : "8px 16px",
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              WebkitTapHighlightColor: "transparent",
              minHeight: 36,
            }}
          >
            <span style={{ fontSize: 13 }}>←</span>
            <span>Готово</span>
          </button>

          {!isMobile && (
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1c1f22",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cabTitle ?? "Редактор шкафа"}
              </span>
              {unit && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#777",
                    fontFamily: "ui-monospace, monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {unit.w} × {unit.h} × {unit.d} мм{cabSubtitle ? ` · ${cabSubtitle}` : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mobile Center: Title & Dimensions Badge */}
        {isMobile && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
              flex: 1,
              padding: "0 4px",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#1c1f22",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 180,
              }}
            >
              {cabTitle ?? "Редактор шкафа"}
            </span>
            {unit && (
              <span
                style={{
                  fontSize: 10,
                  color: "#777",
                  fontFamily: "ui-monospace, monospace",
                  whiteSpace: "nowrap",
                }}
              >
                {unit.w} × {unit.h} × {unit.d} мм
              </span>
            )}
          </div>
        )}

        {/* Desktop Center: Mode Switcher (only shown in header on desktop) */}
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#f0ede6",
              padding: 3,
              borderRadius: 9,
              border: "1px solid #e2ded5",
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => handleModeChange("layout")}
              style={{
                background: viewMode === "layout" ? "#fff" : "transparent",
                color: viewMode === "layout" ? "#1c1f22" : "#666",
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: viewMode === "layout" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "layout" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Конструкция
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("joints")}
              style={{
                background: viewMode === "joints" ? "#e8590c" : "transparent",
                color: viewMode === "joints" ? "#fff" : "#666",
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: viewMode === "joints" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "joints" ? "0 1px 2px rgba(232,89,12,0.3)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <span>Стыки</span>
              <span
                style={{
                  background: viewMode === "joints" ? "rgba(255,255,255,0.25)" : "#e2ded5",
                  color: viewMode === "joints" ? "#fff" : "#444",
                  borderRadius: 10,
                  padding: "1px 5px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {jointList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("cutlist")}
              style={{
                background: viewMode === "cutlist" ? "#0284c7" : "transparent",
                color: viewMode === "cutlist" ? "#fff" : "#666",
                border: "none",
                borderRadius: 7,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: viewMode === "cutlist" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "cutlist" ? "0 1px 2px rgba(2,132,199,0.3)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <span>Раскрой</span>
              <span
                style={{
                  background: viewMode === "cutlist" ? "rgba(255,255,255,0.25)" : "#e2ded5",
                  color: viewMode === "cutlist" ? "#fff" : "#444",
                  borderRadius: 10,
                  padding: "1px 5px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {cutListParts.length}
              </span>
            </button>
          </div>
        )}

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isMobile && history.length > 0 && (
            <button
              type="button"
              onClick={doUndo}
              style={{
                background: "#f0ede6",
                border: "1px solid #d9d5cc",
                borderRadius: 18,
                width: 36,
                height: 36,
                color: "#1c1f22",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                WebkitTapHighlightColor: "transparent",
              }}
              title="Отменить действие"
            >
              ↺
            </button>
          )}

          {!isMobile && frontCount > 0 && (
            <button
              type="button"
              onClick={() => setDoorsOpen((v) => !v)}
              style={{
                background: doorsOpen ? "#fef3c7" : "#f0ede6",
                border: `1px solid ${doorsOpen ? "#f59e0b" : "#d9d5cc"}`,
                borderRadius: 8,
                padding: "7px 12px",
                color: doorsOpen ? "#92400e" : "#1c1f22",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
              title={doorsOpen ? "Закрыть створки" : "Открыть створки"}
            >
              <span>{doorsOpen ? "🚪 Закрыть" : "🚪 Открыть"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onExit(null)}
            style={{
              background: "transparent",
              border: "1px solid #d9d5cc",
              borderRadius: isMobile ? 18 : 8,
              padding: isMobile ? "6px 11px" : "7px 14px",
              color: "#888",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              WebkitTapHighlightColor: "transparent",
            }}
            title="Отменить всё"
          >
            {isMobile ? "✕" : "Отменить всё"}
          </button>
        </div>
      </header>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* ── Mobile Floating Mode Switcher (Always accessible on top of 3D and Cutlist) ── */}
        {isMobile && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.94)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              padding: 3,
              borderRadius: 24,
              border: "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
              zIndex: 50,
              gap: 3,
              pointerEvents: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => handleModeChange("layout")}
              style={{
                background: viewMode === "layout" ? "#1c1f22" : "transparent",
                color: viewMode === "layout" ? "#fff" : "#666",
                border: "none",
                borderRadius: 20,
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: viewMode === "layout" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "layout" ? "0 2px 6px rgba(0,0,0,0.15)" : "none",
                transition: "all 0.15s ease",
                minHeight: 32,
                display: "flex",
                alignItems: "center",
              }}
            >
              Конструкция
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("joints")}
              style={{
                background: viewMode === "joints" ? "#e8590c" : "transparent",
                color: viewMode === "joints" ? "#fff" : "#666",
                border: "none",
                borderRadius: 20,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: viewMode === "joints" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "joints" ? "0 2px 6px rgba(232,89,12,0.3)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
                minHeight: 32,
              }}
            >
              <span>Стыки</span>
              <span
                style={{
                  background: viewMode === "joints" ? "rgba(255,255,255,0.3)" : "#e2ded5",
                  color: viewMode === "joints" ? "#fff" : "#444",
                  borderRadius: 10,
                  padding: "1px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {jointList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("cutlist")}
              style={{
                background: viewMode === "cutlist" ? "#0284c7" : "transparent",
                color: viewMode === "cutlist" ? "#fff" : "#666",
                border: "none",
                borderRadius: 20,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: viewMode === "cutlist" ? 700 : 500,
                cursor: "pointer",
                boxShadow: viewMode === "cutlist" ? "0 2px 6px rgba(2,132,199,0.3)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
                minHeight: 32,
              }}
            >
              <span>Раскрой</span>
              <span
                style={{
                  background: viewMode === "cutlist" ? "rgba(255,255,255,0.3)" : "#e2ded5",
                  color: viewMode === "cutlist" ? "#fff" : "#444",
                  borderRadius: 10,
                  padding: "1px 5px",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {cutListParts.length}
              </span>
            </button>
          </div>
        )}
        {/* ── Cutlist & Nesting Workshop ── */}
        {viewMode === "cutlist" && (
          <CutlistView
            parts={cutListParts}
            unit={unit}
            slots={activeSession.slots}
            onClose={() => handleModeChange("layout")}
            isMobile={isMobile}
          />
        )}

        {/* 3D Stage (takes 100% on mobile, left flex column on desktop) */}
        <div
          ref={stageRef}
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            position: "relative",
            touchAction: "none",
            cursor: "default",
            display: viewMode === "cutlist" ? "none" : "block",
          }}
        />

        {/* ── Floating Overlays (Decoupled from canvas pointer capture) ── */}
        {viewMode !== "cutlist" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            {/* Real-time Drag & Snap Feedback Badge */}
          {preview && (
            <div
              style={{
                pointerEvents: "none",
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                background: preview.tag === "упёрлась" ? "#dc2626" : preview.tag ? "#16a34a" : "#1c1f22",
                color: "#fff",
                borderRadius: 24,
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 700,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                animation: "fadeIn 0.12s ease",
              }}
            >
              <span>{preview.tag ?? `Сдвиг ${preview.delta > 0 ? "+" : ""}${preview.delta} мм`}</span>
              {selGaps && (
                <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 500, marginLeft: 4 }}>
                  (↑ {selGaps.hi} мм · ↓ {selGaps.lo} мм)
                </span>
              )}
            </div>
          )}

          {/* Undo pill (hidden during active drag) */}
          {canUndo && !preview && (
            <button
              type="button"
              onClick={doUndo}
              style={{
                pointerEvents: "auto",
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
                border: "1px solid #d9d5cc",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                color: "#1c1f22",
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                maxWidth: "85%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ fontSize: 14 }}>↩</span>
              <span>Отменить: {history[history.length - 1] ?? "—"}</span>
            </button>
          )}

          {/* Gesture Hint (Mobile only, fades after interaction) */}
          {isMobile && !hasRotated && !preview && (
            <div
              style={{
                position: "absolute",
                top: 54,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(0, 0, 0, 0.65)",
                color: "#fff",
                borderRadius: 16,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 500,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✋ Тяните полку пальцем · ✌️ 2 пальца: зум</span>
            </div>
          )}

          {/* Message toast */}
          {msg && (
            <div
              style={{
                position: "absolute",
                bottom: isMobile ? 120 : 20,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#ff6b35",
                color: "#fff",
                borderRadius: 12,
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(255,107,53,0.3)",
                maxWidth: "90%",
                textAlign: "center",
                pointerEvents: "auto",
              }}
            >
              {msg}
            </div>
          )}

          {/* Context menu (on space tap, clamped inside viewport) */}
          {menu && !preview && (
            <div
              style={{
                pointerEvents: "auto",
                position: "absolute",
                left: Math.max(90, Math.min((stageRef.current?.clientWidth ?? 300) - 90, menu.x)),
                top: Math.max(70, menu.y),
                transform: "translate(-50%, -100%) translateY(-10px)",
                background: "#fff",
                borderRadius: 12,
                padding: 4,
                boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
                border: "1px solid #e5e3de",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 150,
              }}
            >
              <button
                type="button"
                onClick={() => addPart("shelf", menu.space)}
                style={menuBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ee")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 16, color: "#e8590c" }}>━</span>
                <span>+ Полка</span>
              </button>
              <button
                type="button"
                onClick={() => addPart("divider", menu.space)}
                style={menuBtnStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ee")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 16, color: "#e8590c" }}>┃</span>
                <span>+ Перегородка</span>
              </button>
            </div>
          )}

          {/* Camera controls: View Selector (3D / Фасад / План / Разрез / Рентген), Zoom In, Zoom Out, Reset */}
          <div
            style={{
              position: "absolute",
              bottom: isMobile ? (selPart || selSpace ? 185 : 90) : 16,
              right: isMobile ? 12 : 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              pointerEvents: "auto",
              zIndex: 30,
              transition: "bottom 0.2s ease",
            }}
          >
            {/* View Selector Pill with Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowViewDropdown((v) => !v)}
                style={{
                  background: cameraPreset === "xray" ? "#0284c7" : "rgba(255, 255, 255, 0.94)",
                  color: cameraPreset === "xray" ? "#fff" : "#1c1f22",
                  border: `1px solid ${cameraPreset === "xray" ? "#0284c7" : "#d9d5cc"}`,
                  borderRadius: 20,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitTapHighlightColor: "transparent",
                  transition: "all 0.15s ease",
                }}
                title="Переключить проекцию камеры"
              >
                <span>{CAMERA_PRESETS.find((p) => p.id === cameraPreset)?.icon ?? "🧊"}</span>
                <span>{CAMERA_PRESETS.find((p) => p.id === cameraPreset)?.label ?? "3D Изо"}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
              </button>

              {/* Dropdown Menu */}
              {showViewDropdown && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 40,
                    background: "rgba(255, 255, 255, 0.98)",
                    border: "1px solid #e2ded5",
                    borderRadius: 14,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    padding: 4,
                    width: 215,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    zIndex: 40,
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#999",
                      textTransform: "uppercase",
                      padding: "6px 10px 4px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Проекции камеры
                  </div>
                  {CAMERA_PRESETS.map((item) => {
                    const isActive = cameraPreset === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPreset(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "none",
                          background: isActive ? (item.id === "xray" ? "#f0f9ff" : "#fff7ed") : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.12s ease",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = "#f5f3ee";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isActive ? 700 : 600,
                              color: isActive ? (item.id === "xray" ? "#0284c7" : "#c2410c") : "#1c1f22",
                            }}
                          >
                            {item.label}
                          </span>
                          <span style={{ fontSize: 10, color: "#888" }}>{item.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drill Marks (Hardware) Toggle Button */}
            <button
              type="button"
              onClick={() => setShowDrillMarks((v) => !v)}
              style={{
                background:
                  showDrillMarks || cameraPreset === "xray" || viewMode === "joints"
                    ? "#f59e0b"
                    : "rgba(255, 255, 255, 0.94)",
                color:
                  showDrillMarks || cameraPreset === "xray" || viewMode === "joints"
                    ? "#fff"
                    : "#1c1f22",
                border: `1px solid ${
                  showDrillMarks || cameraPreset === "xray" || viewMode === "joints"
                    ? "#f59e0b"
                    : "#d9d5cc"
                }`,
                borderRadius: 20,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                height: 32,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                backdropFilter: "blur(12px)",
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.15s ease",
              }}
              title="Показать / скрыть точки сверловки и крепежа (System 32)"
            >
              <span>🔩</span>
              <span>Присадка</span>
              {drillMarks.length > 0 && (
                <span
                  style={{
                    background:
                      showDrillMarks || cameraPreset === "xray" || viewMode === "joints"
                        ? "rgba(255,255,255,0.25)"
                        : "#e2ded5",
                    color:
                      showDrillMarks || cameraPreset === "xray" || viewMode === "joints"
                        ? "#fff"
                        : "#444",
                    borderRadius: 10,
                    padding: "1px 5px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {drillMarks.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sceneRef.current?.zoomBy(1.15);
                setHasRotated(true);
                force((n) => n + 1);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.92)",
                border: "1px solid #d9d5cc",
                color: "#333",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}
              title="Приблизить (+)"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                sceneRef.current?.zoomBy(0.87);
                setHasRotated(true);
                force((n) => n + 1);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.92)",
                border: "1px solid #d9d5cc",
                color: "#333",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              }}
              title="Отдалить (−)"
            >
              −
            </button>
            {sceneRef.current && !sceneRef.current.isDefaultView() && !preview && (
              <button
                type="button"
                onClick={() => {
                  sceneRef.current?.resetView();
                  force((n) => n + 1);
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.92)",
                  border: "1px solid #d9d5cc",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#666",
                  cursor: "pointer",
                  height: 32,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                }}
              >
                ↻ Вид
              </button>
            )}
          </div>

          {/* ── Mobile Floating Inspector Cards ── */}
          {isMobile && !preview && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: "max(12px, env(safe-area-inset-bottom, 12px))",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* ── Joint Walkthrough Mobile Card ── */}
              {viewMode === "joints" && currentJoint && (() => {
                const partA = allParts.find((p) => p.id === currentJoint.a);
                const partB = allParts.find((p) => p.id === currentJoint.b);
                const nameA = partA ? partA.name : currentJoint.a;
                const nameB = partB ? partB.name : currentJoint.b;
                return (
                  <div
                    style={{
                      pointerEvents: "auto",
                      background: "rgba(255, 255, 255, 0.98)",
                      backdropFilter: "blur(14px)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
                      border: "1px solid rgba(232,89,12,0.25)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      animation: "fadeIn 0.2s ease",
                    }}
                  >
                    {/* Stepper Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button
                        type="button"
                        onClick={() => setJointIdx((i) => (i > 0 ? i - 1 : jointList.length - 1))}
                        style={{
                          background: "#f0ede6",
                          border: "1px solid #d9d5cc",
                          borderRadius: 8,
                          width: 34,
                          height: 34,
                          fontSize: 18,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        ‹
                      </button>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1f22" }}>
                          Стык {safeJointIdx + 1} из {jointList.length}
                        </div>
                        <div style={{ fontSize: 11, color: "#e8590c", fontWeight: 600 }}>
                          {nameA} × {nameB}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setJointIdx((i) => (i < jointList.length - 1 ? i + 1 : 0))}
                        style={{
                          background: "#f0ede6",
                          border: "1px solid #d9d5cc",
                          borderRadius: 8,
                          width: 34,
                          height: 34,
                          fontSize: 18,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        ›
                      </button>
                    </div>

                    {/* Area & Details */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#666", padding: "0 2px" }}>
                      <span>Площадь контакта: <strong style={{ color: "#1c1f22" }}>{currentJoint.areaMm2} мм²</strong></span>
                      <span style={{
                        background: currentJoint.overridden ? "#fff7ed" : "#f0ede6",
                        color: currentJoint.overridden ? "#c2410c" : "#666",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        {currentJoint.overridden ? "Изменено" : "По умолчанию"}
                      </span>
                    </div>

                    {/* Through Selector */}
                    <div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Кто идёт насквозь:</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => updateJointThrough(currentJoint, currentJoint.a)}
                          style={{
                            flex: 1,
                            padding: "7px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: currentJoint.through === currentJoint.a ? "#1c1f22" : "#f5f3ee",
                            color: currentJoint.through === currentJoint.a ? "#fff" : "#444",
                            border: currentJoint.through === currentJoint.a ? "1px solid #1c1f22" : "1px solid #e0ddd5",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          {nameA}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateJointThrough(currentJoint, currentJoint.b)}
                          style={{
                            flex: 1,
                            padding: "7px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: currentJoint.through === currentJoint.b ? "#1c1f22" : "#f5f3ee",
                            color: currentJoint.through === currentJoint.b ? "#fff" : "#444",
                            border: currentJoint.through === currentJoint.b ? "1px solid #1c1f22" : "1px solid #e0ddd5",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          {nameB}
                        </button>
                      </div>
                    </div>

                    {/* Method Selector */}
                    <div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Способ крепления:</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {JOINT_METHODS.map((m) => {
                          const active = currentJoint.method === m.id || (m.id === "confirmat-7x50" && currentJoint.method === "конфирмат-7x50");
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateJointMethod(currentJoint, m.id)}
                              style={{
                                flex: 1,
                                padding: "6px 4px",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: active ? 700 : 500,
                                cursor: "pointer",
                                background: active ? "#e8590c" : "#f5f3ee",
                                color: active ? "#fff" : "#333",
                                border: active ? "1px solid #e8590c" : "1px solid #e0ddd5",
                                textAlign: "center",
                                WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              {m.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Selected Part Floating Card */}
              {viewMode === "layout" && selPart && (
                <div
                  style={{
                    pointerEvents: "auto",
                    background: "rgba(255, 255, 255, 0.96)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 16,
                    padding: "12px 14px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: "#e8590c",
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1c1f22" }}>
                        {selPart.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#777",
                          fontFamily: "ui-monospace, monospace",
                          background: "#f0ede6",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {sizeText(selPart)} мм
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSel(null)}
                      style={{
                        background: "#f0ede6",
                        border: "none",
                        borderRadius: 16,
                        width: 30,
                        height: 30,
                        fontSize: 14,
                        color: "#666",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {selGaps && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        background: "#f7f6f2",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#666",
                        fontWeight: 500,
                      }}
                    >
                      <span>↑ Сверху: <strong>{selGaps.hi} мм</strong></span>
                      <span>↓ Снизу: <strong>{selGaps.lo} мм</strong></span>
                    </div>
                  )}

                  {selPart.movable && (
                    <div style={{ fontSize: 11, color: "#888", textAlign: "center" }}>
                      💡 Тяните деталь пальцем в 3D чтобы переместить
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    {selPart.movable && (
                      <button
                        type="button"
                        onClick={() => removePart(selPart.id)}
                        style={{
                          flex: 1,
                          background: "#fff1f0",
                          border: "1px solid #ffccc7",
                          color: "#cf1322",
                          borderRadius: 12,
                          padding: "10px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          minHeight: 42,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <span>🗑</span>
                        <span>Убрать деталь</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowLayersSheet(true)}
                      style={{
                        flex: 1,
                        background: "#f0ede6",
                        border: "1px solid #d9d5cc",
                        color: "#333",
                        borderRadius: 12,
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        minHeight: 42,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span>📑</span>
                      <span>Все детали ({allParts.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Space Floating Card */}
              {viewMode === "layout" && selSpace && !selPart && (
                <div
                  style={{
                    pointerEvents: "auto",
                    background: "rgba(255, 255, 255, 0.96)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 16,
                    padding: "12px 14px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1f22" }}>
                        Выбран проём
                      </div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {whereText(activeSession, selSpace.box)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSel(null);
                        setMenu(null);
                      }}
                      style={{
                        background: "#f0ede6",
                        border: "none",
                        borderRadius: 16,
                        width: 30,
                        height: 30,
                        fontSize: 14,
                        color: "#666",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => addPart("shelf", selSpace.id)}
                      style={{
                        flex: 1,
                        background: "#e8590c",
                        color: "#fff",
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minHeight: 44,
                        boxShadow: "0 2px 8px rgba(232,89,12,0.25)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span>━</span>
                      <span>+ Полка</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addPart("divider", selSpace.id)}
                      style={{
                        flex: 1,
                        background: "#1c1f22",
                        color: "#fff",
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        minHeight: 44,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span>┃</span>
                      <span>+ Перегородка</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Default Floating Quick Action Deck when nothing is selected */}
              {viewMode === "layout" && !selPart && !selSpace && (
                <div
                  style={{
                    pointerEvents: "auto",
                    background: "rgba(255, 255, 255, 0.96)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderRadius: 22,
                    padding: "10px 12px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  {/* Quick Action Chips Row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      overflowX: "auto",
                      WebkitOverflowScrolling: "touch",
                      paddingBottom: 2,
                    }}
                  >
                    {/* + Полка */}
                    <button
                      type="button"
                      onClick={handleAddShelfQuick}
                      style={{
                        flex: "1 0 auto",
                        background: "#fff",
                        border: "1px solid #d9d5cc",
                        borderRadius: 14,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#1c1f22",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        minHeight: 42,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span style={{ color: "#e8590c", fontSize: 14, fontWeight: 700 }}>━</span>
                      <span>+ Полка</span>
                    </button>

                    {/* + Стойка */}
                    <button
                      type="button"
                      onClick={handleAddDividerQuick}
                      style={{
                        flex: "1 0 auto",
                        background: "#fff",
                        border: "1px solid #d9d5cc",
                        borderRadius: 14,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#1c1f22",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        minHeight: 42,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span style={{ color: "#e8590c", fontSize: 14, fontWeight: 700 }}>┃</span>
                      <span>+ Стойка</span>
                    </button>

                    {/* 🚪 Фасад */}
                    <button
                      type="button"
                      onClick={handleCycleDoors}
                      style={{
                        flex: "1 0 auto",
                        background: frontCount > 0 ? "#fff7ed" : "#fff",
                        border: `1px solid ${frontCount > 0 ? "#fdba74" : "#d9d5cc"}`,
                        borderRadius: 14,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: frontCount > 0 ? "#c2410c" : "#1c1f22",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        minHeight: 42,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                      title="Переключить створки (0 / 1 / 2)"
                    >
                      <span>🚪</span>
                      <span>{frontCount === 0 ? "Без фасада" : frontCount === 1 ? "1 створка" : "2 створки"}</span>
                    </button>

                    {/* 📐 Задник */}
                    <button
                      type="button"
                      onClick={handleCycleBackMount}
                      style={{
                        flex: "1 0 auto",
                        background: backMount !== "none" ? "#f0fdf4" : "#fff",
                        border: `1px solid ${backMount !== "none" ? "#86efac" : "#d9d5cc"}`,
                        borderRadius: 14,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: backMount !== "none" ? "#166534" : "#666",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        minHeight: 42,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                      title="Переключить тип задней стенки"
                    >
                      <span>📐</span>
                      <span>{backMount === "groove" ? "В паз" : backMount === "overlay" ? "Накладной" : "Без задника"}</span>
                    </button>

                    {/* 📑 Слои */}
                    <button
                      type="button"
                      onClick={() => setShowLayersSheet(true)}
                      style={{
                        flex: "0 0 auto",
                        background: "#1c1f22",
                        color: "#fff",
                        border: "none",
                        borderRadius: 14,
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        minHeight: 42,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span>📑</span>
                      <span>{allParts.length}</span>
                    </button>
                  </div>

                  {/* Secondary Row if doors exist */}
                  {frontCount > 0 && (
                    <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
                      <button
                        type="button"
                        onClick={() => setDoorsOpen((v) => !v)}
                        style={{
                          flex: 1,
                          background: doorsOpen ? "#fef3c7" : "#f8f7f4",
                          border: `1px solid ${doorsOpen ? "#f59e0b" : "#e5e3de"}`,
                          borderRadius: 12,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: doorsOpen ? "#92400e" : "#444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          minHeight: 38,
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <span>{doorsOpen ? "🚪 Закрыть створки" : "🚪 Распахнуть створки"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

        {/* ── Desktop Properties & Layers Sidebar (Hidden on Mobile and Cutlist) ── */}
        {!isMobile && viewMode !== "cutlist" && (
          <div
            style={{
              width: viewMode === "joints" ? 280 : 260,
              background: "#fff",
              borderLeft: "1px solid #e5e3de",
              overflow: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              fontSize: 13,
              zIndex: 10,
            }}
          >
            {viewMode === "joints" ? (
              <>
                {/* Joints Walkthrough Header */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1c1f22" }}>Обход стыков</span>
                    <span
                      style={{
                        background: "#fff7ed",
                        color: "#c2410c",
                        border: "1px solid #fed7aa",
                        borderRadius: 12,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {safeJointIdx + 1} / {jointList.length}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
                    Камера наводится на каждый стык. Настройки сохраняются в ядре.
                  </div>
                </div>

                {/* Stepper Buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setJointIdx((i) => (i > 0 ? i - 1 : jointList.length - 1))}
                    style={{
                      flex: 1,
                      background: "#f5f3ee",
                      border: "1px solid #e2ded5",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#333",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <span>‹</span>
                    <span>Предыдущий</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setJointIdx((i) => (i < jointList.length - 1 ? i + 1 : 0))}
                    style={{
                      flex: 1,
                      background: "#e8590c",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      boxShadow: "0 2px 6px rgba(232,89,12,0.25)",
                    }}
                  >
                    <span>Следующий</span>
                    <span>›</span>
                  </button>
                </div>

                {/* Current Joint Inspector */}
                {currentJoint && (() => {
                  const partA = allParts.find((p) => p.id === currentJoint.a);
                  const partB = allParts.find((p) => p.id === currentJoint.b);
                  const nameA = partA ? partA.name : currentJoint.a;
                  const nameB = partB ? partB.name : currentJoint.b;
                  return (
                    <div
                      style={{
                        background: "#fafaf8",
                        border: "1px solid #e8e5dc",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                          Сопрягаемые детали
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1f22" }}>
                          {nameA} <span style={{ color: "#e8590c" }}>×</span> {nameB}
                        </div>
                        <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
                          Площадь: <strong>{currentJoint.areaMm2} мм²</strong> · {currentJoint.kind === "touch" ? "встык" : "врезка"}
                        </div>
                      </div>

                      {/* Who runs through */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 6 }}>
                          Кто идёт насквозь:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => updateJointThrough(currentJoint, currentJoint.a)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: currentJoint.through === currentJoint.a ? 700 : 500,
                              cursor: "pointer",
                              textAlign: "left",
                              background: currentJoint.through === currentJoint.a ? "#1c1f22" : "#fff",
                              color: currentJoint.through === currentJoint.a ? "#fff" : "#333",
                              border: currentJoint.through === currentJoint.a ? "1px solid #1c1f22" : "1px solid #d9d5cc",
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>{nameA}</span>
                            {currentJoint.through === currentJoint.a && <span>✓ насквозь</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateJointThrough(currentJoint, currentJoint.b)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: currentJoint.through === currentJoint.b ? 700 : 500,
                              cursor: "pointer",
                              textAlign: "left",
                              background: currentJoint.through === currentJoint.b ? "#1c1f22" : "#fff",
                              color: currentJoint.through === currentJoint.b ? "#fff" : "#333",
                              border: currentJoint.through === currentJoint.b ? "1px solid #1c1f22" : "1px solid #d9d5cc",
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>{nameB}</span>
                            {currentJoint.through === currentJoint.b && <span>✓ насквозь</span>}
                          </button>
                        </div>
                      </div>

                      {/* Hardware / Joint method */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 6 }}>
                          Крепёж стыка:
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {JOINT_METHODS.map((m) => {
                            const active = currentJoint.method === m.id || (m.id === "confirmat-7x50" && currentJoint.method === "конфирмат-7x50");
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => updateJointMethod(currentJoint, m.id)}
                                style={{
                                  padding: "7px 10px",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: active ? 700 : 500,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  background: active ? "#fff7ed" : "#fff",
                                  color: active ? "#c2410c" : "#333",
                                  border: active ? "1px solid #fdba74" : "1px solid #d9d5cc",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span>{m.name}</span>
                                {active && <span style={{ fontSize: 11, fontWeight: 700 }}>●</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ fontSize: 10, color: "#999", lineHeight: 1.4 }}>
                        {currentJoint.overridden
                          ? "✓ Способ переопределён мастером для этого стыка"
                          : "Правило цеха: способ из заводского профиля"}
                      </div>
                    </div>
                  );
                })()}

                {/* All joints list in sidebar */}
                <div style={{ marginTop: "auto", borderTop: "1px solid #f0ede6", paddingTop: 14 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 11,
                      color: "#999",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Все стыки ({jointList.length})</span>
                    <span style={{ fontSize: 10, color: "#bbb" }}>клавиши ← →</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
                    {jointList.map((j, idx) => {
                      const pA = allParts.find((p) => p.id === j.a);
                      const pB = allParts.find((p) => p.id === j.b);
                      const isCur = idx === safeJointIdx;
                      return (
                        <div
                          key={j.id}
                          onClick={() => setJointIdx(idx)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            background: isCur ? "#fff7ed" : "transparent",
                            border: isCur ? "1px solid #fed7aa" : "1px solid transparent",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 11,
                            transition: "all 0.1s ease",
                          }}
                        >
                          <span style={{ fontWeight: isCur ? 700 : 400, color: isCur ? "#e8590c" : "#444" }}>
                            {pA?.name ?? j.a} × {pB?.name ?? j.b}
                          </span>
                          <span style={{ color: "#aaa", fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                            {j.areaMm2} мм²
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {selPart && (
              <>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#e8590c",
                      marginBottom: 4,
                    }}
                  >
                    {selPart.name}
                  </div>
                  <div style={{ color: "#888", fontSize: 12 }}>
                    {sizeText(selPart)} мм
                  </div>
                </div>

                {selGaps && (
                  <div
                    style={{
                      background: "#fafaf8",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, color: "#888" }}>
                      Зазоры
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>↑ {selGaps.hi} мм</span>
                      <span>↓ {selGaps.lo} мм</span>
                    </div>
                  </div>
                )}

                {selPart.movable && (
                  <div style={{ fontSize: 11, color: "#888" }}>
                    💡 Тяните деталь мышью в 3D чтобы переместить
                  </div>
                )}

                {selPart.movable && (
                  <button
                    type="button"
                    onClick={() => removePart(selPart.id)}
                    style={{
                      background: "#fff5f5",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: "8px 14px",
                      color: "#dc2626",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    Убрать
                  </button>
                )}
              </>
            )}

            {!selPart && !selSpace && (
              <div style={{ color: "#bbb", fontSize: 12, textAlign: "center", marginTop: 20 }}>
                Нажмите на деталь чтобы выбрать
                <br />
                <br />
                Тяните полку мышью чтобы двигать
                <br />
                <br />
                Нажмите на проём чтобы добавить полку или перегородку
              </div>
            )}

            {selSpace && !selPart && (
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#555",
                    marginBottom: 4,
                  }}
                >
                  Проём
                </div>
                <div style={{ color: "#888", fontSize: 12 }}>
                  {whereText(activeSession, selSpace.box)}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => addPart("shelf", selSpace.id)}
                    style={panelBtnStyle}
                  >
                    + Полка
                  </button>
                  <button
                    type="button"
                    onClick={() => addPart("divider", selSpace.id)}
                    style={panelBtnStyle}
                  >
                    + Перегородка
                  </button>
                </div>
              </div>
            )}

            {/* Facade & Doors Configuration */}
            <div
              style={{
                background: "#fafaf8",
                borderRadius: 10,
                padding: 12,
                border: "1px solid #eee",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#555",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Фасад и створки</span>
                {frontCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: doorsOpen ? "#d97706" : "#64748b",
                      fontWeight: 500,
                    }}
                  >
                    {doorsOpen ? "Распахнут" : "Закрыт"}
                  </span>
                )}
              </div>

              {/* 3 options: 0 (Без фасада), 1 створка, 2 створки */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "Без фасада", count: 0 },
                  { label: "1 створка", count: 1 },
                  { label: "2 створки", count: 2 },
                ].map((opt) => {
                  const active = frontCount === opt.count;
                  return (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => setDoorCount(opt.count)}
                      style={{
                        padding: "6px 4px",
                        borderRadius: 6,
                        border: active ? "1px solid #e8590c" : "1px solid #d9d5cc",
                        background: active ? "#fff7ed" : "#fff",
                        color: active ? "#e8590c" : "#444",
                        fontWeight: active ? 700 : 500,
                        fontSize: 11,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {frontCount > 0 && (
                <button
                  type="button"
                  onClick={() => setDoorsOpen((v) => !v)}
                  style={{
                    background: doorsOpen ? "#fef3c7" : "#fff",
                    border: `1px solid ${doorsOpen ? "#f59e0b" : "#d9d5cc"}`,
                    color: doorsOpen ? "#92400e" : "#1c1f22",
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{doorsOpen ? "🚪 Закрыть створки" : "🚪 Распахнуть створки"}</span>
                </button>
              )}
            </div>

            {/* ── Задняя стенка (Back panel) ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "10px 12px",
                background: "#fdfbf7",
                borderRadius: 8,
                border: "1px solid #e2ddd5",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#555",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Задняя стенка</span>
                <span
                  style={{
                    fontSize: 11,
                    color: backMount === "none" ? "#94a3b8" : "#e8590c",
                    fontWeight: 500,
                  }}
                >
                  {backMount === "groove"
                    ? "ХДФ 4мм в паз"
                    : backMount === "overlay"
                    ? "ХДФ 4мм накладной"
                    : "Открыт"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "В паз", mode: "groove" as const },
                  { label: "Накладной", mode: "overlay" as const },
                  { label: "Без задника", mode: "none" as const },
                ].map((opt) => {
                  const active = backMount === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => setBackMount(opt.mode)}
                      style={{
                        padding: "6px 4px",
                        borderRadius: 6,
                        border: active ? "1px solid #e8590c" : "1px solid #d9d5cc",
                        background: active ? "#fff7ed" : "#fff",
                        color: active ? "#e8590c" : "#444",
                        fontWeight: active ? 700 : 500,
                        fontSize: 11,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Parts list (Photoshop Layers style) */}
            <div style={{ marginTop: "auto", borderTop: "1px solid #f0ede6", paddingTop: 14 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 11,
                  color: "#999",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Слои деталей</span>
                <span>({allParts.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" }}>
                {allParts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSel({ kind: "part", id: p.id })}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: sel?.id === p.id ? "#fff7ed" : "transparent",
                      border: sel?.id === p.id ? "1px solid #fed7aa" : "1px solid transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                      transition: "all 0.1s ease",
                    }}
                  >
                    <span style={{ fontWeight: sel?.id === p.id ? 600 : 400, color: sel?.id === p.id ? "#e8590c" : "#444" }}>
                      {p.name}
                    </span>
                    <span style={{ color: "#aaa", fontSize: 11, fontFamily: "ui-monospace, monospace" }}>
                      {sizeText(p)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )}
  </div>

      {/* ── Mobile Bottom Sheet for Layers (Photoshop Layers drawer on mobile) ── */}
      {isMobile && showLayersSheet && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setShowLayersSheet(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              backdropFilter: "blur(2px)",
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: "relative",
              background: "#fff",
              borderRadius: "28px 28px 0 0",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
              padding: "14px 18px max(18px, env(safe-area-inset-bottom, 18px)) 18px",
              maxHeight: "75vh",
              display: "flex",
              flexDirection: "column",
              zIndex: 1,
            }}
          >
            {/* Grab handle */}
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                background: "#d1cfc7",
                margin: "0 auto 12px auto",
              }}
            />

            {/* Sheet Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 10,
                borderBottom: "1px solid #f0ede6",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1c1f22" }}>
                  Детали шкафа (слои)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#f0ede6",
                    color: "#666",
                    padding: "2px 8px",
                    borderRadius: 12,
                  }}
                >
                  {allParts.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLayersSheet(false)}
                style={{
                  background: "#f0ede6",
                  border: "none",
                  borderRadius: 16,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#666",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                ✕
              </button>
            </div>

            {/* Facade & Doors Configuration inside Mobile Sheet */}
            <div
              style={{
                background: "#fafaf8",
                borderRadius: 14,
                padding: 12,
                marginTop: 10,
                border: "1px solid #f0ede6",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#555",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Фасад и створки</span>
                {frontCount > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: doorsOpen ? "#d97706" : "#64748b",
                      fontWeight: 500,
                    }}
                  >
                    {doorsOpen ? "Распахнуты" : "Закрыты"}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "Без фасада", count: 0 },
                  { label: "1 створка", count: 1 },
                  { label: "2 створки", count: 2 },
                ].map((opt) => {
                  const active = frontCount === opt.count;
                  return (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => setDoorCount(opt.count)}
                      style={{
                        padding: "9px 4px",
                        borderRadius: 8,
                        border: active ? "1px solid #e8590c" : "1px solid #d9d5cc",
                        background: active ? "#fff7ed" : "#fff",
                        color: active ? "#e8590c" : "#444",
                        fontWeight: active ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "center",
                        minHeight: 38,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {frontCount > 0 && (
                <button
                  type="button"
                  onClick={() => setDoorsOpen((v) => !v)}
                  style={{
                    background: doorsOpen ? "#fef3c7" : "#fff",
                    border: `1px solid ${doorsOpen ? "#f59e0b" : "#d9d5cc"}`,
                    color: doorsOpen ? "#92400e" : "#1c1f22",
                    borderRadius: 8,
                    padding: "9px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    minHeight: 38,
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span>{doorsOpen ? "🚪 Закрыть створки" : "🚪 Распахнуть створки"}</span>
                </button>
              )}
            </div>

            {/* Back Panel Configuration inside Mobile Sheet */}
            <div
              style={{
                background: "#fafaf8",
                borderRadius: 14,
                padding: 12,
                marginTop: 10,
                border: "1px solid #f0ede6",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#555",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Задняя стенка</span>
                <span
                  style={{
                    fontSize: 11,
                    color: backMount === "none" ? "#94a3b8" : "#e8590c",
                    fontWeight: 500,
                  }}
                >
                  {backMount === "groove"
                    ? "ХДФ 4мм в паз"
                    : backMount === "overlay"
                    ? "ХДФ 4мм накладной"
                    : "Открыт"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[
                  { label: "В паз", mode: "groove" as const },
                  { label: "Накладной", mode: "overlay" as const },
                  { label: "Без задника", mode: "none" as const },
                ].map((opt) => {
                  const active = backMount === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => setBackMount(opt.mode)}
                      style={{
                        padding: "9px 4px",
                        borderRadius: 8,
                        border: active ? "1px solid #e8590c" : "1px solid #d9d5cc",
                        background: active ? "#fff7ed" : "#fff",
                        color: active ? "#e8590c" : "#444",
                        fontWeight: active ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "center",
                        minHeight: 38,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parts List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingBottom: 8,
              }}
            >
              {allParts.map((p) => {
                const isSelected = sel?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSel({ kind: "part", id: p.id });
                      setShowLayersSheet(false);
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: isSelected ? "#fff7ed" : "#fafaf8",
                      border: isSelected ? "1px solid #fdba74" : "1px solid #f0ede6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, color: isSelected ? "#e8590c" : "#888" }}>
                        {p.type === "shelf" ? "━" : p.type === "divider" ? "┃" : "▫"}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#e8590c" : "#1c1f22",
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#888",
                            fontFamily: "ui-monospace, monospace",
                          }}
                        >
                          {sizeText(p)} мм
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.movable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePart(p.id);
                          }}
                          style={{
                            background: "#fff1f0",
                            border: "1px solid #ffccc7",
                            color: "#cf1322",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Убрать
                        </button>
                      )}
                      <span style={{ fontSize: 12, color: "#ccc" }}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──

const menuBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#1c1f22",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  transition: "background 0.1s ease",
  WebkitTapHighlightColor: "transparent",
};

const panelBtnStyle: React.CSSProperties = {
  background: "#f5f3ee",
  border: "1px solid #e5e3de",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#555",
  cursor: "pointer",
  flex: 1,
  textAlign: "center",
  transition: "all 0.15s ease",
};
