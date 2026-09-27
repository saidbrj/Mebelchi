// «Рендер» — the payoff step, and the answer to a problem we could not solve any other way.
//
// The constructor is an EDITOR: you drag a cabinet and you want the picture back this frame. This screen
// is a VIEWER: nobody is dragging anything, so it can spend a second producing something you would
// actually show a client. Trying to serve both from one render loop is what produced a bad version of
// each — realism that got in the way of editing, and an editor too slow to be photographic.
//
// So everything photographic lives here: ambient occlusion (always on), the light moods, and the SUN
// DIAL — a light-direction control, like a 3D application, because the direction of the one light that
// casts shadows is the single thing that decides whether a kitchen looks real. Point it high and to the
// side and every wall unit lays a shadow across the counter.
//
// The AI photoreal pass shares this screen because it is IMG2IMG: it takes our render as its input, so a
// better base render is literally a better AI result. It stays behind `AI_RENDER` (the key must not ship
// — see config.ts) and wears a «Скоро» badge until it doesn't.

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, usePanelSpecs } from "../store";
import { useT } from "../i18n/useT";
import { VariantScene, type SceneApi } from "../three/VariantScene";
import { DEFAULT_SUN } from "../three/lighting";
import { FLOOR_COVERINGS } from "../model/floors";
import { AI_RENDER } from "../config";
import { shareOrDownload, dataUrlToBlob } from "../lib/shareFile";
import { JourneyBar } from "../components/JourneyBar";
import { IconShare, IconSun, IconSparkle, IconCamera, IconDownload } from "../components/icons";
import { SunDial } from "../components/SunDial";

/** the long edge of a snapshot (px). 2K is a picture you can send a client; 4K is the factory export. */
const SNAP_EDGE = 2048;
/** how many shots the strip remembers. Session-only: a 2K PNG is megabytes, and localStorage caps at ~5. */
const MAX_SHOTS = 8;

const MAX_ZOOM = 4;

/**
 * THE SNAPSHOT VIEWER — and the reason it is a real overlay rather than an image laid on the canvas.
 *
 * The first version simply drew the shot over the scene, and you could not tell whether you were
 * looking at a photograph or at the live 3D: the picture is OF the thing behind it. So this one is
 * unmistakably a viewer — the room goes dark behind it, there is a close button where a close button
 * goes, and the shot floats. You are looking at something you took, not at the kitchen.
 *
 * Pinch to zoom, drag to pan, double-tap to snap between fit and 2.5×. The pointer bookkeeping is done
 * by hand because a photo viewer that cannot be pinched feels broken on a phone, and CSS alone will not
 * give us that inside a fixed overlay.
 */
function Lightbox({ shots, index, onIndex, onClose, onSave, onShare, saveLabel, shareLabel }: {
  shots: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onSave: () => void;
  onShare: () => void;
  saveLabel: string;
  shareLabel: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ dist: number; zoom: number; cx: number; cy: number; pan: { x: number; y: number } } | null>(null);
  const lastTap = useRef(0);

  // a new picture always starts fitted — carrying the previous shot's zoom over would be baffling
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < shots.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, shots.length, onClose, onIndex]);

  const clampPan = (p: { x: number; y: number }, z: number) => {
    const lim = 160 * (z - 1); // roughly how far a zoomed image can travel before it leaves the frame
    return { x: Math.max(-lim, Math.min(lim, p.x)), y: Math.max(-lim, Math.min(lim, p.y)) };
  };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      start.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        pan,
      };
    } else {
      start.current = { dist: 0, zoom, cx: e.clientX, cy: e.clientY, pan };
      const now = Date.now();
      if (now - lastTap.current < 280) {
        setZoom((z) => (z > 1.05 ? 1 : 2.5));
        setPan({ x: 0, y: 0 });
      }
      lastTap.current = now;
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !start.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = start.current;

    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (s.dist > 0) setZoom(Math.max(1, Math.min(MAX_ZOOM, (s.zoom * d) / s.dist)));
      return;
    }
    if (zoom <= 1.02) return; // fitted: a drag is not a pan, it is a stray finger
    setPan(clampPan({ x: s.pan.x + (e.clientX - s.cx), y: s.pan.y + (e.clientY - s.cy) }, zoom));
  };

  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) start.current = null;
    if (zoom <= 1.02) setPan({ x: 0, y: 0 });
  };

  return (
    <div className="lb" role="dialog" aria-modal="true">
      <div className="lb-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img
          className="lb-img"
          src={shots[index]}
          alt=""
          draggable={false}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        />
      </div>

      <button className="lb-close" onClick={onClose} type="button" aria-label="✕">✕</button>

      {shots.length > 1 && (
        <>
          <button className="lb-nav lb-prev" onClick={() => onIndex(index - 1)} disabled={index === 0} type="button" aria-label="‹">‹</button>
          <button className="lb-nav lb-next" onClick={() => onIndex(index + 1)} disabled={index === shots.length - 1} type="button" aria-label="›">›</button>
          <div className="lb-count">{index + 1} / {shots.length}</div>
        </>
      )}

      <div className="lb-actions">
        <button className="lb-save" onClick={onSave} type="button">{saveLabel} ↓</button>
        <button className="lb-share" onClick={onShare} type="button">
          <IconShare /> {shareLabel}
        </button>
      </div>
    </div>
  );
}

export function RenderScreen() {
  const t = useT();
  const points = useStore((s) => s.roomPoints);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
  const panelSpecs = usePanelSpecs();
  const led = useStore((s) => s.led);
  const setLed = useStore((s) => s.setLed);
  const goTo = useStore((s) => s.goTo);
  const openings = useStore((s) => s.openings);
  const interiorWalls = useStore((s) => s.interiorWalls);
  const fittings = useStore((s) => s.fittings);
  const wallSurfaces = useStore((s) => s.wallSurfaces);
  const waterWall = useStore((s) => s.waterWall);
  const runLayout = useStore((s) => s.runLayout);
  const runStyle = useStore((s) => s.runStyle);
  const cabs = useStore((s) => s.cabs);
  const floorCovering = useStore((s) => s.floorCovering);
  const flash = useStore((s) => s.flash);
  const coveringColor = FLOOR_COVERINGS[floorCovering]?.color ?? "#ecd9b4";

  const apiRef = useRef<SceneApi | null>(null);
  const onApi = useCallback((api: SceneApi | null) => { apiRef.current = api; }, []);

  const quality = useStore((s) => s.settings.quality);
  const [panel, setPanel] = useState(false); // the light controls, folded away by default
  const [lightingTab, setLightingTab] = useState<"sun" | "fixtures">("sun");
  const [lampSpread, setLampSpread] = useState(0.34);
  const [reflect, setReflect] = useState(true); // a reflective floor, on the settled frame
  const [shots, setShots] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState(-1); // which shot is being looked at, full-screen

  const isFixtures = (led.lightingMode ?? lightingTab) === "fixtures";

  // TAP A DOOR, IT OPENS. Each key names ONE front (`cabId#n`), so tapping a drawer pulls out that
  // drawer rather than the whole bank — which is what "tap to open" has to mean if it is going to feel
  // like touching the kitchen rather than operating it.
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const toggleFront = useCallback((key: string) => {
    setOpenKeys((k) => (k.includes(key) ? k.filter((x) => x !== key) : [...k, key]));
  }, []);
  const closeAll = () => setOpenKeys([]);

  const snap = () => {
    // `keepLook` — the snapshot must be of the kitchen you are LOOKING at. Forcing the neutral export
    // look here handed you a daylight photo when you had chosen «Вечер», which is simply a lie.
    const url = apiRef.current?.captureHiRes(SNAP_EDGE, true);
    if (!url) { flash(t.render.snapFail); return; }
    setShots((s) => [url, ...s].slice(0, MAX_SHOTS));
    flash(t.render.snapped);
  };

  const save = async (i: number) => {
    const url = shots[i];
    if (!url) return;
    const blob = await dataUrlToBlob(url);
    await shareOrDownload(
      new File([blob], `mebely-render-${shots.length - i}.png`, { type: "image/png" }),
      { ok: t.render.saved, fail: t.render.saveFail },
      flash,
      blob,
    );
  };

  return (
    <div className="roomscene">
      <JourneyBar
        right={
          <button className="step-next" onClick={() => goTo("handoff")} type="button">
            <span>Сдача</span>
            <span>→</span>
          </button>
        }
      />

      <div
        className="scene-area"
        onPointerDownCapture={(e) => {
          // tap on the 3D itself (the canvas) → fold the panel away. Taps on the panel, the dial, the
          // FABs and the bar are on their own elements and never reach here as the canvas.
          if (panel && (e.target as HTMLElement).tagName === "CANVAS") setPanel(false);
        }}
      >
        <VariantScene
          points={points}
          ceiling={ceiling}
          reveal={reveal}
          panels={panelSpecs}
          led={led}
          openings={openings}
          coveringColor={coveringColor}
          floorId={FLOOR_COVERINGS[floorCovering]?.id}
          interiorWalls={interiorWalls}
          fittings={fittings}
          wallSurfaces={wallSurfaces}
          waterWall={waterWall}
          layout={runLayout}
          style={runStyle}
          cabs={cabs}
          mode="real"
          nav
          openIds={openKeys}
          onOpenFront={toggleFront}
          light={led.preset ?? "evening"}
          sun={{
            azimuth: led.sunAzimuth ?? DEFAULT_SUN.azimuth,
            elevation: led.sunElevation ?? DEFAULT_SUN.elevation,
          }}
          lampCount={isFixtures ? (led.ceilingCount ?? 4) : 0}
          lampKind={led.ceilingKind ?? "spot"}
          lampSpread={lampSpread}
          lampTemp={led.temp ?? 4000}
          lampOffsetMm={led.ceilingOffsetMm ?? 800}
          customPositions={led.customPositions}
          ceilingPerimeter={false}
          reflect={reflect}
          ao
          // The seller's preference, NOT a pinned "high". `auto` is what turns on the adaptive
          // ladder in three/quality.ts (pixel ratio → AO → shadow map), and pinning this to "high"
          // disabled it: autoTier() only steps down when quality === "auto", so a mid-range Android
          // stayed at 2× pixel ratio with AO and a 2048 shadow map and simply chugged.
          quality={quality}
          // The INTERACTIVE shadow map. The snapshot is unaffected — captureHiRes() calls
          // rig.beginCapture(2048), which overrides this for the frame it exports. So 1024 here is
          // a quarter of the shadow-pass texels while you orbit, and the picture you hand a client
          // is identical.
          shadowPx={1024}
          sheet="off"
          onApi={onApi}
        />

        {/* Back to Design step button at the bottom right */}
        <button
          className="btn-rnd-back"
          onClick={() => goTo("configure")}
          type="button"
          title="Вернуться в конструктор"
        >
          <span>‹</span>
          <span>Дизайн</span>
        </button>

        {panel && (
          <div className="rnd-panel rnd-panel-l pop-anim">
            {/* Two tabs: ☀️ Солнце и тени / 💡 Светильники */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                className={`chip${(led.lightingMode ?? lightingTab) === "sun" ? " sel" : ""}`}
                onClick={() => {
                  setLightingTab("sun");
                  setLed({ lightingMode: "sun" });
                }}
                type="button"
                style={{ flex: 1, justifyContent: "center" }}
              >
                ☀️ Солнце и тени
              </button>
              <button
                className={`chip${(led.lightingMode ?? lightingTab) === "fixtures" ? " sel" : ""}`}
                onClick={() => {
                  setLightingTab("fixtures");
                  setLed({ lightingMode: "fixtures" });
                }}
                type="button"
                style={{ flex: 1, justifyContent: "center" }}
              >
                💡 Светильники
              </button>
            </div>

            {(led.lightingMode ?? lightingTab) === "sun" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    Атмосфера комнаты
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { id: "day", label: "День", icon: "☀️" },
                      { id: "evening", label: "Вечер", icon: "🌙" },
                      { id: "studio", label: "Студия", icon: "💡" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        className={`style-profile${(led.preset ?? "evening") === p.id ? " on" : ""}`}
                        onClick={() => setLed({ preset: p.id as any })}
                        type="button"
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px" }}
                      >
                        <span style={{ fontSize: 14 }}>{p.icon}</span>
                        <span style={{ fontSize: 11 }}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Направление солнца
                    </span>
                    {(led.sunAzimuth != null || led.sunElevation != null) && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setLed({ sunAzimuth: DEFAULT_SUN.azimuth, sunElevation: DEFAULT_SUN.elevation })}
                        style={{ fontSize: 11, padding: "2px 6px" }}
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                  <SunDial
                    azimuth={led.sunAzimuth ?? DEFAULT_SUN.azimuth}
                    elevation={led.sunElevation ?? DEFAULT_SUN.elevation}
                    onChange={(azimuth, elevation) => setLed({ sunAzimuth: azimuth, sunElevation: elevation })}
                  />
                  <div className="rnd-hint" style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "var(--text-dim)" }}>
                    {t.render.sunHint}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    Время суток
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button
                      className={`style-profile${(led.preset ?? "evening") === "day" ? " on" : ""}`}
                      onClick={() => setLed({ preset: "day" })}
                      type="button"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px" }}
                    >
                      <span style={{ fontSize: 15 }}>☀️</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>День</span>
                    </button>
                    <button
                      className={`style-profile${(led.preset ?? "evening") === "evening" ? " on" : ""}`}
                      onClick={() => setLed({ preset: "evening" })}
                      type="button"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px" }}
                    >
                      <span style={{ fontSize: 15 }}>🌙</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Ночь</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    Тип светильников
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {[
                      { id: "spot", label: "Точечные", icon: "⬤" },
                      { id: "linear", label: "Линейные", icon: "▬" },
                      { id: "track", label: "Трековые", icon: "⚬-⚬" },
                    ].map((k) => (
                      <button
                        key={k.id}
                        className={`style-profile${(led.ceilingKind ?? "spot") === k.id ? " on" : ""}`}
                        onClick={() => setLed({ ceilingKind: k.id as any, customPositions: undefined })}
                        type="button"
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px" }}
                      >
                        <span style={{ fontSize: 14 }}>{k.icon}</span>
                        <span style={{ fontSize: 11 }}>{k.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    Количество светильников
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[
                      { cnt: 0, label: "Выкл" },
                      { cnt: 2, label: "2 шт" },
                      { cnt: 4, label: "4 шт" },
                      { cnt: 6, label: "6 шт" },
                    ].map((item) => (
                      <button
                        key={item.cnt}
                        className={`style-profile${(led.ceilingCount ?? 4) === item.cnt ? " on" : ""}`}
                        onClick={() => setLed({ ceilingCount: item.cnt, customPositions: undefined })}
                        type="button"
                        style={{ padding: "8px 4px", fontSize: 12, fontWeight: 600, textAlign: "center" }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Отступ от стен
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                      {led.ceilingOffsetMm ?? 800} мм
                    </span>
                  </div>
                  <input
                    type="range"
                    min={300}
                    max={1800}
                    step={50}
                    value={led.ceilingOffsetMm ?? 800}
                    onChange={(e) => setLed({ ceilingOffsetMm: Number(e.target.value), customPositions: undefined })}
                    style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                </div>

                {led.customPositions && led.customPositions.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--panel-bg, rgba(255,255,255,0.05))", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      📍 Индивидуальная расстановка в 3D
                    </span>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setLed({ customPositions: undefined })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      Сбросить к сетке
                    </button>
                  </div>
                ) : null}

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    Цветовая температура
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[
                      { k: 2700, label: "2700K", sub: "Теплый" },
                      { k: 3000, label: "3000K", sub: "Мягкий" },
                      { k: 4000, label: "4000K", sub: "Нейтральный" },
                      { k: 5000, label: "5000K", sub: "Холодный" },
                    ].map((tItem) => (
                      <button
                        key={tItem.k}
                        className={`style-profile${led.temp === tItem.k ? " on" : ""}`}
                        onClick={() => setLed({ temp: tItem.k as any })}
                        type="button"
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 2px" }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 11 }}>{tItem.label}</span>
                        <span style={{ fontSize: 9, color: "var(--text-dim)" }}>{tItem.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>
                    {t.render.lampSpread}
                  </div>
                  <input
                    className="dim-slider"
                    type="range"
                    min={5}
                    max={48}
                    step={1}
                    value={Math.round(lampSpread * 100)}
                    onChange={(e) => setLampSpread(Number(e.target.value) / 100)}
                    style={{ width: "100%", accentColor: "var(--accent)" }}
                  />
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--line, #e5e7eb)", margin: "12px 0 10px" }} />

            <div className="rnd-row" style={{ marginBottom: 10 }}>
              <span>{t.render.reflect}</span>
              <button className={`switch${reflect ? " on" : ""}`} onClick={() => setReflect((v) => !v)} type="button" aria-pressed={reflect}><span className="knob" /></button>
            </div>

            <div className="rnd-sec">{t.render.doors}</div>
            <div className="rnd-hint">{t.render.doorsHint}</div>
            <button className="rnd-close-all" onClick={closeAll} type="button" disabled={!openKeys.length}>
              {t.render.closeAll}
            </button>
          </div>
        )}
      </div>

      <div className="rnd-bar">
        {/* the shots taken this session. Session-only on purpose: a 2K PNG is megabytes, and the place
            for one you want to keep is your phone's photo library — that is what «Сохранить» is for. */}
        {shots.length > 0 && (
          <div className="rnd-strip">
            {shots.map((s, i) => (
              <button key={i} className="rnd-thumb" onClick={() => setLightbox(i)} type="button">
                <img src={s} alt="" draggable={false} />
              </button>
            ))}
          </div>
        )}

        {/* Five actions, laid out like the hub's tab bar — icon over label, «Снимок» raised in the
            middle as the green primary. Five buttons of different widths and weights in two rows
            read as clutter; one row of equal columns reads as a toolbar, and it's the pattern the
            seller already knows from the home screen. */}
        <div className="rnd-tabbar">
          <button className={`rnd-tab${panel ? " on" : ""}`} onClick={() => setPanel((v) => !v)} type="button">
            <span className="rnd-tab-ico"><IconSun /></span>
            <span className="rnd-tab-lbl">{t.render.lighting}</span>
          </button>

          {/* IMG2IMG — it eats this screen's render, which is why it lives here. Held until the key
              can live server-side (config.ts), so for now it is a promise with a badge on it. */}
          <button className="rnd-tab rnd-tab-ai" type="button" disabled={!AI_RENDER}>
            <span className="rnd-tab-ico"><IconSparkle /></span>
            <span className="rnd-tab-lbl">{t.render.ai}</span>
            {!AI_RENDER && <span className="rnd-tab-soon">{t.render.soon}</span>}
          </button>

          <button className="rnd-tab rnd-tab-snap" onClick={snap} type="button">
            <span className="rnd-tab-ico rnd-tab-ico-snap"><IconCamera /></span>
            <span className="rnd-tab-lbl">{t.render.snap}</span>
          </button>

          <button className="rnd-tab" onClick={() => void save(0)} type="button" disabled={!shots.length}>
            <span className="rnd-tab-ico"><IconDownload /></span>
            <span className="rnd-tab-lbl">{t.render.save}</span>
          </button>

          <button className="rnd-tab" onClick={() => void save(0)} type="button" disabled={!shots.length}>
            <span className="rnd-tab-ico"><IconShare /></span>
            <span className="rnd-tab-lbl">{t.render.share}</span>
          </button>
        </div>
      </div>

      {lightbox >= 0 && shots[lightbox] && (
        <Lightbox
          shots={shots}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(-1)}
          onSave={() => void save(lightbox)}
          onShare={() => void save(lightbox)}
          saveLabel={t.render.save}
          shareLabel={t.render.share}
        />
      )}
    </div>
  );
}
