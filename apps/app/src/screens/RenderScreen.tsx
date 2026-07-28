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
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { VariantScene, type SceneApi } from "../three/VariantScene";
import { RENDER_PRESETS, LAMP_COUNTS, DEFAULT_SUN, clampEl, type LightPreset } from "../three/lighting";
import { FLOOR_COVERINGS } from "../model/floors";
import { AI_RENDER } from "../config";
import { shareOrDownload, dataUrlToBlob } from "../lib/shareFile";

/** the long edge of a snapshot (px). 2K is a picture you can send a client; 4K is the factory export. */
const SNAP_EDGE = 2048;
/** how many shots the strip remembers. Session-only: a 2K PNG is megabytes, and localStorage caps at ~5. */
const MAX_SHOTS = 8;

const HALF_PI = Math.PI / 2;
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
function Lightbox({ shots, index, onIndex, onClose, onSave, saveLabel }: {
  shots: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
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

      <button className="lb-save" onClick={onSave} type="button">{saveLabel} ↓</button>
    </div>
  );
}

/**
 * THE SUN DIAL — a top-down map of the sky.
 *
 * The angle round the circle is the bearing the light comes FROM; the distance from the centre is how
 * high it stands, with the centre being straight overhead and the rim being the horizon. One drag sets
 * both, which is exactly the widget every 3D application uses, and it is legible in a way two sliders
 * never are: you are looking at a plan of the room with the sun in it.
 */
function SunDial({ azimuth, elevation, onChange }: { azimuth: number; elevation: number; onChange: (az: number, el: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const R = 40; // the horizon
  const C = 48; // centre of the 96×96 box

  // elevation → radius. Overhead sits at the centre, the horizon at the rim.
  const r = (1 - Math.min(1, Math.max(0, elevation / HALF_PI))) * R;
  // the scene's +z reads as DOWN on a plan, so the knob's screen offset is (sin az, cos az)
  const kx = C + Math.sin(azimuth) * r;
  const ky = C + Math.cos(azimuth) * r;

  const aim = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const dx = ((clientX - box.left) / box.width) * 96 - C;
    const dy = ((clientY - box.top) / box.height) * 96 - C;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return; // dead centre has no bearing — keep the one we have
    onChange(Math.atan2(dx, dy), clampEl((1 - Math.min(1, d / R)) * HALF_PI));
  };

  return (
    <svg
      ref={ref}
      className="sun-dial"
      viewBox="0 0 96 96"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        aim(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons === 1 && aim(e.clientX, e.clientY)}
    >
      <circle className="sd-sky" cx={C} cy={C} r={R} />
      <circle className="sd-ring" cx={C} cy={C} r={R * 0.5} />
      <line className="sd-cross" x1={C} y1={C - R} x2={C} y2={C + R} />
      <line className="sd-cross" x1={C - R} y1={C} x2={C + R} y2={C} />
      {/* the ray, so you can see WHICH WAY the light travels — from the sun, across the room */}
      <line className="sd-ray" x1={kx} y1={ky} x2={C} y2={C} />
      <circle className="sd-sun" cx={kx} cy={ky} r={7} />
    </svg>
  );
}

export function RenderScreen() {
  const t = useT();
  const points = useStore((s) => s.roomPoints);
  const ceiling = useStore((s) => s.ceiling);
  const reveal = useStore((s) => s.reveal);
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
  const back = useStore((s) => s.back);
  const next = useStore((s) => s.next);
  const openMenu = useStore((s) => s.openMenu);
  const coveringColor = FLOOR_COVERINGS[floorCovering]?.color ?? "#ecd9b4";

  const apiRef = useRef<SceneApi | null>(null);
  const onApi = useCallback((api: SceneApi | null) => { apiRef.current = api; }, []);

  const [light, setLight] = useState<LightPreset>("day");
  // Starts exactly where the constructor's sun stands, so stepping into Рендер changes the QUALITY of
  // the picture and nothing about its lighting — then the dial is yours.
  const [sun, setSun] = useState(DEFAULT_SUN);
  const [panel, setPanel] = useState(false); // the light controls, folded away by default
  const [lampCount, setLampCount] = useState(4); // how many ceiling halogens — «Вечер» is lit BY them
  const [reflect, setReflect] = useState(true); // a reflective floor, on the settled frame
  const [shots, setShots] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState(-1); // which shot is being looked at, full-screen

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
      new File([blob], `jihozla-render-${shots.length - i}.png`, { type: "image/png" }),
      { ok: t.render.saved, fail: t.render.saveFail },
      flash,
      blob,
    );
  };

  return (
    <div className="roomscene">
      <div className="stepbar cfg-bar">
        <div className="cfg-bar-l">
          <button className="cfg-burger" onClick={openMenu} type="button" aria-label={t.menu.menu}>
            <span /><span />
          </button>
          <button className="cfg-back" onClick={back} type="button" aria-label={t.config.back}>←</button>
        </div>
        <div className="cfg-title">{t.render.title}</div>
        <button className="step-next" onClick={next} type="button">{t.config.next}</button>
      </div>

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
          light={light}
          sun={sun}
          lampCount={lampCount}
          reflect={reflect}
          ao
          quality="high"
          shadowPx={2048}
          sheet="off"
          onApi={onApi}
        />

        {/* the light controls — folded away, because the scene is the point */}
        <button className={`rnd-fab rnd-fab-l${panel ? " on" : ""}`} onClick={() => setPanel((v) => !v)} type="button" aria-label={t.render.lighting}>
          ☀
        </button>

        {/* IMG2IMG — it eats this screen's render, which is why it lives here. Held until the key can
            live server-side (config.ts), so for now it is a promise with a badge on it. */}
        <button className="rnd-ai-fab" type="button" disabled={!AI_RENDER}>
          ✨ {t.render.ai}
          {!AI_RENDER && <span className="soon-tag">{t.render.soon}</span>}
        </button>

        {panel && (
          <div className="rnd-panel rnd-panel-l pop-anim">
            <div className="rnd-sec">{t.render.sun}</div>
            <SunDial azimuth={sun.azimuth} elevation={sun.elevation} onChange={(azimuth, elevation) => setSun({ azimuth, elevation })} />
            <div className="rnd-hint">{t.render.sunHint}</div>

            <div className="rnd-sec">{t.render.lighting}</div>
            <div className="pillrow">
              {RENDER_PRESETS.map((p) => (
                <button key={p} className={`chip${light === p ? " sel" : ""}`} onClick={() => setLight(p)} type="button">
                  {t.labels.lights[p]}
                </button>
              ))}
            </div>

            {/* «Вечер» is lit BY the ceiling lamps, so this is where you CHOOSE THEM — a fixture layout,
                not a dimmer: each lamp is its own pool of light and its own soft shadow. «День»/«Витрина»
                have no lamps burning, so the picker would be a control over nothing. */}
            {light === "evening" && (
              <>
                <div className="rnd-sec">{t.render.lamps}</div>
                <div className="pillrow">
                  {LAMP_COUNTS.map((n) => (
                    <button key={n} className={`chip${lampCount === n ? " sel" : ""}`} onClick={() => setLampCount(n)} type="button">
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="rnd-row">
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

        <div className="rnd-actions">
          <button className="rnd-snap" onClick={snap} type="button">◉ {t.render.snap}</button>
          <button className="rnd-save" onClick={() => void save(0)} type="button" disabled={!shots.length}>
            {t.render.save} ↓
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
          saveLabel={t.render.save}
        />
      )}
    </div>
  );
}
