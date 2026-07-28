// THE LIGHT. One rig, one exposure curve, one environment — for every scene in the app.
//
// THE RULE THIS FILE IS BUILT AROUND, learned the hard way:
//
//   THE LIGHT THAT LIGHTS A SURFACE MUST ALSO BE THE LIGHT THAT SHADOWS IT.
//
// The previous version broke that rule and every complaint followed from it. The shadow-caster was a
// key coming through the window, sitting ~29° above the horizon — so its shadows shot sideways onto the
// far wall instead of down onto the counter, and a wall unit threw no visible shadow at all. Meanwhile
// the light doing the actual lighting was a camera-relative fill that was STRONGER than the key and cast
// nothing. So the room was lit by a shadowless lamp and shadowed by one that barely lit anything, which
// leaves ambient occlusion as the only darkness in the picture — and AO on its own reads as a Photoshop
// drop shadow, not as a render. The old rig everyone preferred had its sun at (4, 8, 6): 48° up. That
// one number was the whole difference.
//
// So now: ONE sun. It leads, it casts, and its direction is a first-class control (`setSun`) that the
// Render step hands to the user on a dial, exactly like a 3D application. Everything else is support.
//
// Two more things that will silently ruin this if forgotten:
//   • TONE MAPPING IS NOT OPTIONAL. Without a curve, any light above 1.0 clips to white and the picture
//     goes flat — which is what made the earlier environment map look like "over-brightening".
//   • THE LIGHT COUNT NEVER CHANGES AT RUNTIME. Adding or removing a light recompiles every material in
//     the scene and shows up as a hitch, so presets DIM lights; they never add or remove them.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { polygonBoundsMm, type Opening, type Pt } from "../model/room";

/** How the room is lit. A viewing preference — never a property of the project. */
export type LightPreset = "day" | "evening" | "studio";

/** the looks the Render step offers — and the constructor simply runs «День» with the occlusion off. */
export const RENDER_PRESETS: LightPreset[] = ["day", "evening", "studio"];

/** How hard we're willing to make the GPU work. See `three/quality.ts`. */
export type QualityTier = "high" | "med" | "low";

/** How many ceiling spots (галогены) EXIST in the scene — the maximum a room can carry. The light
 *  COUNT never changes at runtime (that would recompile every material), so all six are always present;
 *  `lampCount` decides how many are lit. */
const SPOTS = 6;
/** The lamp-count choices «Вечер» offers — a fixture layout, not a dimmer: each lit lamp is its own
 *  pool of light and its own soft shadow, which is how a kitchen is actually lit. */
export const LAMP_COUNTS = [2, 4, 6] as const;
/** …of which this many cast shadows, and only when the preset says so («Вечер»). Each caster is another
 *  depth pass, so the rest merely light. */
const CASTING_SPOTS = 2;

const RAD = Math.PI / 180;
/** The sun can be dragged anywhere between these. Never let it near the horizon: a sun at 5° throws
 *  shadows the length of the room and lights nothing you are looking at. */
export const SUN_MIN_EL = 18 * RAD;
export const SUN_MAX_EL = 88 * RAD;

/**
 * How far round from the camera the FILL sits (radians).
 *
 * Not zero. A light coming from exactly where you stand is the beginner's "headlight": every surface
 * facing you takes the same value, which is a flat picture with extra steps. Swung to the side, a
 * cabinet's front, its edge and its recessed panel each catch a different amount — and that difference
 * is the only thing the eye reads as three-dimensional.
 */
const FILL_YAW = 36 * RAD;
/** the rim sits behind the subject, on the other side — it separates the kitchen from the wall */
const RIM_YAW = 150 * RAD;

interface PresetSpec {
  /** the one exposure knob — what keeps many lights from clipping to white */
  exposure: number;
  /** scene.environmentIntensity — the indirect term: what every roughness map reflects */
  env: number;

  /** THE SUN. The lead, and the only directional that casts. */
  sun: number;
  sunColor: number;
  /** where this look puts it by default (radians above the horizon) — the user can drag it */
  elevation: number;

  hemi: number;
  hemiSky: number;
  hemiGround: number;

  /** camera-relative fill: support, never the lead. If this ever out-shines `sun`, the picture flattens. */
  fill: number;
  fillColor: number;
  /** camera-relative rim, from behind — studio only */
  rim: number;

  /** ceiling spots, LUMENS each (see `.power` below — not intensity) */
  spotLm: number;
  spotColor: number;
  /** do the spots cast shadows? «Вечер» says yes, because there they ARE the light. */
  spotCast: boolean;
}

/**
 * The four looks — and they differ STRUCTURALLY, not by tint.
 *
 * The last version of this table was three copies of one rig with the colour changed, which is exactly
 * what it looked like: «Вечер» was «День» in orange. A preset has to change WHERE THE LIGHT COMES FROM
 * and WHAT CASTS, or it is a filter.
 */
const SPEC: Record<LightPreset, PresetSpec> = {
  // MIDDAY — one hard sun, high, coming from the window's side of the room. Long crisp shadows across
  // the floor and a clean dark line under every wall unit. The sun leads by a mile; everything else is
  // there to keep the shadow side readable.
  day: {
    exposure: 0.95, env: 0.24,
    sun: 2.7, sunColor: 0xfff3e2, elevation: 54 * RAD,
    hemi: 0.22, hemiSky: 0xdcecff, hemiGround: 0xb8ac9a,
    fill: 0.35, fillColor: 0xfff6ec, rim: 0,
    spotLm: 0, spotColor: 0xffd9a8, spotCast: false,
  },
  // EVENING — the ceiling lights ARE the light: they hang from the ceiling, they CAST, and the room
  // falls into warm pools with real falloff between them while the sun drops to a dim blue dusk.
  //
  // But a downlight points DOWN, so it rakes a cabinet's front at a grazing angle and barely touches
  // it. In a real kitchen those fronts are rescued entirely by light bouncing off the floor and the
  // counter — and we have no bounce. Starve the ambient here and the verticals go black while the floor
  // glows, which is exactly what happened: a dark room with a lit puddle in it. So the warm ambient and
  // the camera fill are deliberately NOT small: they are standing in for the bounce, and without them
  // «Вечер» is not moody, it is just broken.
  evening: {
    exposure: 1.0, env: 0.16,
    sun: 0.14, sunColor: 0x7f9ad0, elevation: 22 * RAD,
    hemi: 0.12, hemiSky: 0x6b7a94, hemiGround: 0x6a5a44,
    fill: 0.5, fillColor: 0xffd6a8, rim: 0,
    spotLm: 300, spotColor: 0xffd8b0, spotCast: true,
  },
  // STUDIO — the CATALOGUE shot, and it has to earn its place: a first pass at this was just «День»
  // with the numbers nudged, and it read as «День». So it is built the other way round on purpose.
  //
  // «День» is a sunny room: one hard light, deep shadows, drama. This is a photographer's table: the
  // sun drops to a soft key almost straight overhead, the fill and the rim do most of the work, and the
  // ambient comes up — so the shadows go SHALLOW and every face of every cabinet is legible. That is
  // what a product photo is for, and it is why the exports, the thumbnails and the AI render's input
  // frame all use it: nobody wants a sunbeam across half the cut list.
  //
  // No ceiling lights. A studio is three directional lights and a backdrop — a photographer does not
  // leave the room's own downlights burning in the shot.
  studio: {
    exposure: 0.9, env: 0.55,
    sun: 0.9, sunColor: 0xffffff, elevation: 72 * RAD,
    hemi: 0.35, hemiSky: 0xffffff, hemiGround: 0xe6e6e6,
    fill: 1.35, fillColor: 0xffffff, rim: 0.95,
    spotLm: 0, spotColor: 0xfff2e0, spotCast: false,
  },
};

/**
 * A TUNING BACK DOOR: `?exp=0.9&env=0.2&sun=2.4&fill=0.4&hemi=0.2&spot=400` overrides whichever preset
 * is showing. Light is the one thing you cannot get right by reasoning about it — you have to look at
 * it — and this turns "change a number, rebuild, look" into "drag a number in the URL bar". Absent from
 * normal use; whatever wins here gets written back into SPEC above.
 */
function urlTune(): Partial<PresetSpec> {
  if (typeof location === "undefined") return {};
  const q = new URLSearchParams(location.search);
  const n = (k: string): number | undefined => {
    const v = q.get(k);
    if (v == null) return undefined;
    const f = Number.parseFloat(v);
    return Number.isFinite(f) ? f : undefined;
  };
  const out: Partial<PresetSpec> = {};
  const pairs: [string, keyof PresetSpec][] = [
    ["exp", "exposure"], ["env", "env"], ["sun", "sun"], ["fill", "fill"],
    ["hemi", "hemi"], ["spot", "spotLm"], ["rim", "rim"],
  ];
  for (const [q1, k] of pairs) {
    const v = n(q1);
    if (v != null) (out as Record<string, number>)[k] = v;
  }
  const el = n("el");
  if (el != null) out.elevation = el * RAD;
  return out;
}

/** The room, as the light needs to see it — mm, absolute; the scene is centred on its bounding box. */
export interface RoomLight {
  points: Pt[];
  openings: Opening[];
  /** mm */
  ceiling: number;
}

/** Where the sun should come from, and how much room its shadow has to cover. */
export interface SunAim {
  /** compass bearing the light comes FROM, radians (0 = +z, turning toward +x) */
  azimuth: number;
  /** half-size of the shadow frustum (m) — big enough for the room, no bigger */
  radius: number;
}

/** The bearing of the historic (4, 8, 6) sun — the one the app shipped with, and the one people liked. */
const FALLBACK_AZ = Math.atan2(4, 6);

/**
 * WHERE THE SUN STANDS UNLESS SOMEONE MOVES IT — and every screen starts here, deliberately.
 *
 * NOT the window's bearing, and that is the correction. Daylight through the real window sounds right
 * and looks wrong: the window is in the wall BEHIND the run, so every wall cabinet throws its shadow
 * forward, across the floor, toward the viewer — big detached dark patches in the middle of the room
 * with nothing obvious casting them. Over the viewer's shoulder, the same shadows fall back onto the
 * walls where the eye expects them and the floor stays clean.
 *
 * (`keyLightFor` still knows the window's bearing. It is what the Render step's dial could be seeded
 * from if we ever want "afternoon light through your actual window" as an explicit choice — but it is
 * a choice, not a default.)
 */
export const DEFAULT_SUN = { azimuth: FALLBACK_AZ, elevation: 54 * RAD };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clampEl = (el: number) => Math.max(SUN_MIN_EL, Math.min(SUN_MAX_EL, el));

/**
 * WHICH WAY THE DAYLIGHT COMES FROM: the room's own window.
 *
 * It returns a BEARING, not a position — which is the correction. Deriving the sun's whole position
 * from the window pinned it to the window's own height, i.e. barely above the sill, i.e. a sun so low
 * it cast its shadows out of frame. Daylight comes from the window's *side* of the room; how high the
 * sun is, is a separate question, and one the preset (or the user's dial) answers.
 *
 * Pure. The widest window wins — it is the one letting the most light in. No window → the historic sun.
 */
export function keyLightFor(points: Pt[], openings: Opening[]): SunAim {
  const n = points.length;
  const radius = n >= 3 ? Math.max(2, Math.hypot(polygonBoundsMm(points).w, polygonBoundsMm(points).h) / 2000 + 0.8) : 4;
  if (n < 3) return { azimuth: FALLBACK_AZ, radius };

  const windows = openings.filter((o) => o.kind === "window" && o.wall >= 0 && o.wall < n);
  if (!windows.length) return { azimuth: FALLBACK_AZ, radius };
  const win = windows.reduce((a, b) => (b.width > a.width ? b : a));

  // the scene is centred on the room's BOUNDING-BOX centre — the same polygonBoundsMm every other
  // consumer builds it from. Using the polygon's centroid instead would offset the light from the
  // geometry it is meant to be shining through.
  const b0 = polygonBoundsMm(points);
  const a = points[win.wall];
  const b = points[(win.wall + 1) % n];
  const wx = (lerp(a.x, b.x, win.t) - b0.cx) / 1000; // the window's centre, in scene metres
  const wz = (lerp(a.y, b.y, win.t) - b0.cy) / 1000;
  if (Math.hypot(wx, wz) < 0.2) return { azimuth: FALLBACK_AZ, radius }; // degenerate: window at the centre

  return { azimuth: Math.atan2(wx, wz), radius }; // the sun stands out beyond the glass
}

/** The PMREM environment, once PER RENDERER (a render-target texture belongs to the GL context that
 *  built it — this app has four). */
const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

function environmentFor(renderer: THREE.WebGLRenderer): THREE.Texture {
  const hit = envCache.get(renderer);
  if (hit) return hit;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  env.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  envCache.set(renderer, tex);
  return tex;
}

export interface Rig {
  /** re-aim the sun at the room's window and fit its shadow frustum to the walls */
  aim: (room: RoomLight) => void;
  /**
   * POINT THE SUN — the Render step's dial, and the fix for "the shadows aren't visible".
   *
   * `azimuth` is the bearing it shines from; `elevation` is how high it stands (clamped, because a sun
   * on the horizon shadows nothing you can see). Once set by hand it sticks: `aim()` will not drag it
   * back to the window.
   */
  setSun: (azimuth: number, elevation: number) => void;
  /** what the dial should be showing */
  sun: () => { azimuth: number; elevation: number };
  /**
   * Keep the fill (and the rim) over the viewer's shoulder. Call once per frame, BEFORE rendering.
   *
   * Cheap: it moves lights that cast no shadow, so the depth pass stays frozen.
   */
  follow: (camera: THREE.Camera, target: THREE.Vector3) => void;
  setPreset: (p: LightPreset) => void;
  /** HOW MANY ceiling lamps are lit (2 / 4 / 6). «Вечер» is lit BY them — this is a fixture layout, not
   *  a dimmer: more lamps mean more pools of light, brighter overall, and more soft shadows. The sun
   *  dial, correctly, does almost nothing at night, which is exactly why this control exists. */
  setLampCount: (n: number) => void;
  setTier: (t: QualityTier) => void;
  preset: () => LightPreset;
  /**
   * Enter the EXPORT look — «Студия» at a crisp shadow map — and hand back the undo.
   *
   * A workshop drawing, a thumbnail and the AI render's input frame all want the flat, honest view
   * whatever the seller happens to be looking at. A SNAPSHOT is the opposite: they chose «Вечер»
   * because they want a picture of the kitchen at evening, and handing them a daylight shot instead is
   * simply a bug. So `keepPreset` leaves the mood alone and only sharpens the depth map.
   */
  beginCapture: (shadowPx?: number, keepPreset?: boolean) => () => void;
  dispose: () => void;
}

export interface RigOpts {
  /** false for the small previews/thumbnails — they get the sun and the fill, but no depth pass */
  shadows?: boolean;
  /** false for a scene with NO ROOM (a single cabinet on a backdrop): with no walls to aim against,
   *  ceiling spots would sit at the origin — i.e. inside the cabinet, lighting it from within. */
  spots?: boolean;
  preset?: LightPreset;
  tier?: QualityTier;
  /** the Render step can afford a sharper depth map than the editor — its frames are stills */
  shadowPx?: number;
}

/** Build the rig into a scene. Call ONCE per scene. */
export function buildRig(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: RigOpts = {}): Rig {
  const shadows = opts.shadows ?? true;
  const useSpots = opts.spots ?? true;
  const baseShadowPx = opts.shadowPx ?? 1024;
  let preset: LightPreset = opts.preset ?? "day";
  let tier: QualityTier = opts.tier ?? "high";
  let lampCount = 4; // how many of the SPOTS lamps are lit
  let roomBounds = { w: 4000, h: 3000 }; // mm — updated by aim()
  let ceilingY = 2.5; // m — updated by aim()

  // THE EXPOSURE CURVE. Without one, every light we add simply clips to white.
  //
  // ACES over Neutral: Neutral is the "correct" product-viewer curve — it protects the base colour and
  // does almost nothing else — but doing almost nothing else is the problem. It has no shoulder and no
  // toe, so a bright room comes out FLAT. ACES puts an S-curve on it: the shadows gain depth and the
  // highlights roll off instead of piling up at white.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // THE INDIRECT TERM — one cubemap fetch per fragment standing in for light arriving from every
  // direction. It is what a roughness map has to modulate (without it, marble and matte MDF render
  // identically), and it is cheaper than the fill lights it replaces. No `scene.background`: the
  // capture path renders on `alpha: true` and composites the app's own backdrop underneath.
  scene.environment = environmentFor(renderer);

  // ── THE SUN ─────────────────────────────────────────────────────────────────────────────────────
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 1, 0); // the room's middle, at about counter height
  sun.target = sunTarget;
  scene.add(sun, sunTarget);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
  }
  let sunAz = DEFAULT_SUN.azimuth;
  let sunEl = SPEC[preset].elevation;
  let sunSet = false; // has anyone aimed it by hand? then `aim()` must not overrule them
  let radius = 4;

  const placeSun = () => {
    // stand it well outside the room so the shadow frustum's near plane is never inside the geometry
    const D = radius * 2 + 6;
    const c = Math.cos(sunEl);
    sun.position.set(Math.sin(sunAz) * c * D, Math.sin(sunEl) * D + 1, Math.cos(sunAz) * c * D);
    sunTarget.updateMatrixWorld();
    if (!shadows) return;
    // The shadow camera is an ORTHOGRAPHIC box centred on the light's own axis, so it must be sized to
    // the room — it was once hardcoded to ±4m, and a bigger room silently lost its shadows outside that
    // box (three clamps to the edge texel out there, which paints a large fake shadow across the floor).
    const cam = sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = 2 * D + 4 * radius;
    cam.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  };

  // ── SUPPORT ─────────────────────────────────────────────────────────────────────────────────────
  // The fill rides with the camera (see `follow`) because the fronts you look at are usually turned
  // away from the sun, and without bounce light (we have none) they would go dead. It casts nothing:
  // a shadow that swung around every time you orbited would give the trick away instantly.
  const fill = new THREE.DirectionalLight(0xffffff, 0);
  const fillTarget = new THREE.Object3D();
  fill.target = fillTarget;
  scene.add(fill, fillTarget);

  // the rim comes from behind the subject and lifts it off the wall — the third point of a studio rig
  const rim = new THREE.DirectionalLight(0xffffff, 0);
  const rimTarget = new THREE.Object3D();
  rim.target = rimTarget;
  scene.add(rim, rimTarget);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8c8c8, 0);
  scene.add(hemi);

  // Ceiling spots. PHYSICALLY-CORRECT LIGHTS (three r155+): intensity is candela and decays with
  // distance, so `intensity = 1` is very nearly black — these are driven by `.power`, in LUMENS, like a
  // real bulb, which is also how a seller thinks about them. SpotLights rather than points, because a
  // downlight has a cone: that is what produces a pool of light on the counter instead of a uniform
  // orange wash over the whole room.
  const spots: THREE.SpotLight[] = [];
  for (let i = 0; i < SPOTS; i++) {
    const s = new THREE.SpotLight(0xffffff, 0, 0, 52 * RAD, 0.9, 2);
    s.target.position.set(0, 0, 0);
    scene.add(s, s.target);
    if (shadows && i < CASTING_SPOTS) {
      s.shadow.mapSize.set(512, 512);
      s.shadow.bias = -0.001;
      s.shadow.normalBias = 0.02;
    }
    spots.push(s);
  }

  /** a capture temporarily overrides the tier's shadow resolution */
  let mapOverride: number | null = null;
  const shadowSize = () =>
    mapOverride ?? (tier === "high" ? baseShadowPx : tier === "med" ? Math.max(512, baseShadowPx / 2) : 0);

  const tuned = urlTune();

  const applyPreset = () => {
    const s = { ...SPEC[preset], ...tuned };
    renderer.toneMappingExposure = s.exposure;
    scene.environmentIntensity = s.env;

    sun.intensity = s.sun;
    sun.color.setHex(s.sunColor);
    if (!sunSet) sunEl = s.elevation; // each look has its own sun height — until the user takes the dial

    hemi.intensity = s.hemi;
    hemi.color.setHex(s.hemiSky);
    hemi.groundColor.setHex(s.hemiGround);

    fill.intensity = s.fill;
    fill.color.setHex(s.fillColor);
    rim.intensity = s.rim;

    // low tier: the spots are the first thing to give up — each is per-fragment work on every pixel of
    // every surface, and a caster is a whole extra depth pass. Dimmed to zero, never removed.
    // each LIT lamp burns at the preset's full power (this is a fixture count, not a shared budget —
    // six lamps is a brighter room than two, as it should be); the rest are dark but still present.
    const lm = tier === "low" || !useSpots ? 0 : s.spotLm;
    spots.forEach((p, i) => {
      const lit = i < lampCount;
      p.power = lit ? lm : 0;
      p.color.setHex(s.spotColor);
      p.castShadow = shadows && s.spotCast && lit && lm > 0 && i < CASTING_SPOTS && tier !== "low";
    });

    if (shadows) {
      const size = shadowSize();
      sun.castShadow = size > 0 && s.sun > 0.2; // a dusk sun at 0.14 has no shadow worth a depth pass
      if (size > 0 && sun.shadow.mapSize.width !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null as unknown as THREE.WebGLRenderTarget; // three rebuilds it at the new size
      }
    }
    placeSun();
  };

  const aim = (room: RoomLight) => {
    // The room only tells us how much ground the shadow frustum has to cover. It does NOT get to
    // place the sun: aiming daylight through the real window threw every wall unit's shadow forward
    // across the floor (see DEFAULT_SUN).
    radius = keyLightFor(room.points, room.openings).radius;

    // THE CEILING DOWNLIGHTS — over the FLOOR, and nowhere near the cabinets.
    //
    // They used to be spread at ±42% of the room's bounds, which puts them directly above the RUNS. A
    // downlight a few centimetres above a wall unit's top, with physically-correct inverse-square
    // falloff, delivers an irradiance in the hundreds: a blown-out white puddle sitting on the cabinet.
    // (Which is why only the presets WITH spots showed it, and «День» — which has none — looked right.)
    //
    const b = polygonBoundsMm(room.points);
    roomBounds = { w: b.w, h: b.h };
    ceilingY = room.ceiling / 1000;
    placeLamps();
    applyPreset();
  };

  /**
   * Lay out the LIT lamps over the open floor, evenly.
   *
   * The cabinets hug the walls, so the middle of the room is the clear floor — put the downlights
   * there. They used to sit at ±42% of the room's bounds, directly over the RUNS, which with
   * inverse-square falloff dropped a blown-out white puddle on top of whatever cabinet was beneath.
   * Arranged as `rows × cols` chosen from the count, spread comfortably inside the runs.
   */
  const placeLamps = () => {
    const [cols, rows] = lampCount <= 2 ? [lampCount, 1] : lampCount <= 4 ? [2, 2] : [3, 2];
    const y = ceilingY - 0.12;
    const SPREAD = 0.34; // how far across the room the lamp grid reaches (fraction of the span)
    spots.forEach((p, i) => {
      // even grid cell centres in −1..1, then scaled into the room
      const cx = cols > 1 ? ((i % cols) / (cols - 1)) * 2 - 1 : 0;
      const cz = rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 2 - 1 : 0;
      const x = (cx * SPREAD * roomBounds.w) / 1000;
      const z = (cz * SPREAD * roomBounds.h) / 1000;
      p.position.set(x, y, z);
      p.target.position.set(x, 0, z);
      p.target.updateMatrixWorld();
      p.distance = y * 2.6; // where the cone gives out — keeps its cost bounded
    });
  };

  // scratch — `follow` runs every frame, and allocating in a render loop is how you earn a GC stutter
  const away = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const follow = (camera: THREE.Camera, target: THREE.Vector3) => {
    away.subVectors(camera.position, target); // from what you are looking at, back toward you
    away.y = 0;
    const dist = away.length();
    if (dist < 0.01) return;
    away.normalize();

    const place = (light: THREE.DirectionalLight, tgt: THREE.Object3D, yaw: number, lift: number) => {
      const v = away.clone().applyAxisAngle(UP, yaw);
      light.position.set(target.x + v.x * dist, target.y + lift, target.z + v.z * dist);
      tgt.position.copy(target);
      tgt.updateMatrixWorld();
    };
    place(fill, fillTarget, FILL_YAW, Math.max(2.2, dist * 0.75));
    place(rim, rimTarget, RIM_YAW, Math.max(1.8, dist * 0.5));
  };

  applyPreset();

  return {
    aim,
    follow,
    preset: () => preset,
    sun: () => ({ azimuth: sunAz, elevation: sunEl }),
    setSun: (azimuth, elevation) => {
      sunAz = azimuth;
      sunEl = clampEl(elevation);
      sunSet = true;
      placeSun();
    },
    setPreset: (p) => {
      preset = p;
      applyPreset();
    },
    setLampCount: (n) => {
      lampCount = Math.max(0, Math.min(SPOTS, Math.round(n)));
      placeLamps(); // the layout changes with the count, not just which ones are lit
      applyPreset();
    },
    setTier: (t) => {
      tier = t;
      applyPreset();
    },
    beginCapture: (shadowPx, keepPreset) => {
      const wasPreset = preset;
      const wasOverride = mapOverride;
      if (!keepPreset) preset = "studio";
      // no size given → keep the tier's map (a 400px thumbnail does not need a crisper one)
      mapOverride = shadows && shadowPx ? shadowPx : null;
      applyPreset();
      return () => {
        preset = wasPreset;
        mapOverride = wasOverride;
        applyPreset();
      };
    },
    dispose: () => {
      sun.shadow.map?.dispose();
      for (const p of spots) p.shadow.map?.dispose();
      scene.remove(sun, sunTarget, fill, fillTarget, rim, rimTarget, hemi, ...spots);
      // the environment texture is cached per renderer and outlives the scene on purpose — it is the
      // same PMREM for every rebuild, and regenerating it is the expensive part
    },
  };
}
