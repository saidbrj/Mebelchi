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
import { ledColor } from "../model/ledStrips";

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

/** WHAT HANGS FROM THE CEILING. A round downlight drops a pool; a linear luminaire washes a strip;
 *  a track system runs spot heads along a modern rail. */
export type CeilingLightKind = "spot" | "linear" | "track";
export const LAMP_KINDS: CeilingLightKind[] = ["spot", "linear", "track"];
/** …of which this many cast shadows, and only when the preset says so («Вечер»). Each caster is another
 *  depth pass, so the rest merely light. */
const CASTING_SPOTS = 2;

const RAD = Math.PI / 180;
export const HALF_PI = Math.PI / 2;
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
    exposure: 0.88, env: 0.20,
    sun: 2.1, sunColor: 0xfff3e2, elevation: 54 * RAD,
    hemi: 0.18, hemiSky: 0xdcecff, hemiGround: 0xb8ac9a,
    fill: 0.26, fillColor: 0xfff6ec, rim: 0,
    spotLm: 0, spotColor: 0xffd9a8, spotCast: false,
  },
  // EVENING / NIGHT — the ceiling lights ARE the light: they hang from the ceiling, they CAST, and the room
  // falls into warm pools with real falloff between them while the sun drops to a dim blue dusk.
  evening: {
    exposure: 0.84, env: 0.08,
    sun: 0.04, sunColor: 0x5a7ca8, elevation: 22 * RAD,
    hemi: 0.06, hemiSky: 0x6b7a94, hemiGround: 0x5a4a38,
    fill: 0.16, fillColor: 0xffd6a8, rim: 0,
    spotLm: 130, spotColor: 0xffd8b0, spotCast: true,
  },
  // STUDIO — the CATALOGUE shot, and it has to earn its place
  studio: {
    exposure: 0.88, env: 0.45,
    sun: 0.8, sunColor: 0xffffff, elevation: 72 * RAD,
    hemi: 0.28, hemiSky: 0xffffff, hemiGround: 0xe6e6e6,
    fill: 0.95, fillColor: 0xffffff, rim: 0.7,
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
  // DEV ONLY. `import.meta.env.DEV` is replaced by `false` in a production build, so this
  // whole branch — and the URL read with it — is dropped from the shipped bundle. An app store
  // reviewer must not be able to change how the app behaves with a query string.
  if (!import.meta.env.DEV || typeof location === "undefined") return {};
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
  /** ROUND DOWNLIGHTS, LINEAR luminaires, or TRACK systems. */
  setLampKind: (k: CeilingLightKind) => void;
  /** How far across the room the fixtures spread, 0..1 of the span. Tight keeps them over the
   *  middle of the floor; wide walks them out toward the runs. */
  setLampSpread: (v: number) => void;
  /** Color temperature in Kelvin (2700K - 5000K). */
  setLampTemp: (k: number) => void;
  /** Offset distance from room walls (in mm). */
  setWallOffset: (offsetMm: number) => void;
  /** User-dragged custom 3D lamp positions. */
  setCustomPositions: (pos: { x: number; z: number }[] | null) => void;
  /** Force fixtures and their illumination to remain visible permanently even when camera orbits above ceiling. */
  setForceFixturesVisible: (force: boolean) => void;
  /** Toggle interactive positioning guides (translucent light cones and floor discs). */
  setShowGuides: (show: boolean) => void;
  /** Perimeter LED cove lighting ribbon. */
  setPerimeterLed: (on: boolean, points?: Pt[], ceilingY?: number) => void;
  /** Access fixture 3D groups for raycasting/interaction. */
  getFixtures: () => THREE.Group[];
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
  let lampKind: CeilingLightKind = "spot";
  /** how far across the room the fixture grid reaches, as a fraction of the span (see placeLamps) */
  let lampSpread = 0.34;
  let lampTemp = 4000;
  let wallOffsetMm = 800;
  let customPositions: { x: number; z: number }[] | null = null;
  let forceFixturesVisible = false;
  let showGuides = false;
  let perimeterLedOn = false;
  let perimeterGroup: THREE.Group | null = null;
  let roomPointsRef: Pt[] = [];
  let roomBounds = { w: 4000, h: 3000 }; // mm — updated by aim()
  let ceilingY = 2.5; // m — updated by aim()

  // THE EXPOSURE CURVE. Without one, every light we add simply clips to white.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // THE INDIRECT TERM — one cubemap fetch per fragment standing in for light arriving from every
  // direction.
  scene.environment = environmentFor(renderer);

  // ── THE SUN ─────────────────────────────────────────────────────────────────────────────────────
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 1, 0);
  sun.target = sunTarget;
  scene.add(sun, sunTarget);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
  }
  let sunAz = DEFAULT_SUN.azimuth;
  let sunEl = SPEC[preset].elevation;
  let sunSet = false;
  let radius = 4;

  const placeSun = () => {
    const D = radius * 2 + 6;
    const c = Math.cos(sunEl);
    sun.position.set(Math.sin(sunAz) * c * D, Math.sin(sunEl) * D + 1, Math.cos(sunAz) * c * D);
    sunTarget.updateMatrixWorld();
    if (!shadows) return;
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
  const fill = new THREE.DirectionalLight(0xffffff, 0);
  const fillTarget = new THREE.Object3D();
  fill.target = fillTarget;
  scene.add(fill, fillTarget);

  const rim = new THREE.DirectionalLight(0xffffff, 0);
  const rimTarget = new THREE.Object3D();
  rim.target = rimTarget;
  scene.add(rim, rimTarget);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc8c8c8, 0);
  scene.add(hemi);

  // Ceiling spots
  const spots: THREE.SpotLight[] = [];
  for (let i = 0; i < SPOTS; i++) {
    const s = new THREE.SpotLight(0xffffff, 0, 0, 54 * RAD, 0.9, 2);
    s.target.position.set(0, 0, 0);
    scene.add(s, s.target);
    if (shadows && i < CASTING_SPOTS) {
      s.shadow.mapSize.set(512, 512);
      s.shadow.bias = -0.001;
      s.shadow.normalBias = 0.02;
    }
    spots.push(s);
  }

  // ── FIXTURES & 3D VISIBILITY ───────────────────────────────────────────────────────────────────
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.5, metalness: 0.15 });
  const trackRailMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.35, metalness: 0.75 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff4e2, emissive: 0xffd9a8, emissiveIntensity: 0 });
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });

  const fixtureGeos: THREE.BufferGeometry[] = [];
  const fixtures: THREE.Group[] = [];
  for (let i = 0; i < SPOTS; i++) {
    const f = new THREE.Group();
    f.visible = false;
    scene.add(f);
    fixtures.push(f);
  }

  const barLen = () => Math.max(0.6, Math.min(2.4, (roomBounds.h / 1000) * 0.55));
  let litBodies = 0;

  const buildFixtureBodies = () => {
    for (const g of fixtureGeos) g.dispose();
    fixtureGeos.length = 0;
    const isLinear = lampKind === "linear";
    const isTrack = lampKind === "track";
    const len = barLen();

    let trimGeo: THREE.BufferGeometry;
    let lensGeo: THREE.BufferGeometry;

    if (isLinear) {
      trimGeo = new THREE.BoxGeometry(0.068, 0.02, len);
      lensGeo = new THREE.BoxGeometry(0.052, 0.008, len - 0.03);
    } else if (isTrack) {
      // Slim dark magnetic track channel
      trimGeo = new THREE.BoxGeometry(0.034, 0.024, len);
      lensGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.048, 16);
    } else {
      trimGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.016, 20);
      lensGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.006, 20);
    }

    const haloGeo = isLinear
      ? new THREE.PlaneGeometry(0.08, len)
      : isTrack
      ? new THREE.PlaneGeometry(0.034, len)
      : new THREE.RingGeometry(0.045, 0.075, 20);
    const coneGeo = new THREE.CylinderGeometry(0.045, 0.42, 2.0, 16, 1, true);
    const discGeo = new THREE.CircleGeometry(0.36, 24);

    // Track-specific geometry: individual spot canisters, stems, spot cones, and floor puddle discs
    const trackStemGeo = new THREE.BoxGeometry(0.016, 0.012, 0.022);
    const trackHeadLensGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.004, 16);
    const trackConeGeo = new THREE.CylinderGeometry(0.02, 0.22, 2.0, 16, 1, true);
    const trackDiscGeo = new THREE.CircleGeometry(0.24, 20);
    const trackSpotHaloGeo = new THREE.RingGeometry(0.02, 0.045, 16);

    fixtureGeos.push(
      trimGeo,
      lensGeo,
      haloGeo,
      coneGeo,
      discGeo,
      trackStemGeo,
      trackHeadLensGeo,
      trackConeGeo,
      trackDiscGeo,
      trackSpotHaloGeo,
    );

    for (let i = 0; i < fixtures.length; i++) {
      const f = fixtures[i];
      for (const ch of [...f.children]) f.remove(ch);

      if (isTrack) {
        // Track rail channel in matte dark metal
        const rail = new THREE.Mesh(trimGeo, trackRailMat);
        rail.userData.lampIndex = i;
        f.add(rail);

        // Ceiling track halo indicator
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.012;
        halo.name = "halo";
        halo.userData.lampIndex = i;
        f.add(halo);

        // Discrete spotlight canisters along track rail (3 distinct spot heads with independent beams)
        const headOffsets = [-len * 0.32, 0, len * 0.32];
        for (const zo of headOffsets) {
          // Mounting stem / bracket from track
          const stem = new THREE.Mesh(trackStemGeo, trackRailMat);
          stem.position.set(0, -0.014, zo);
          stem.userData.lampIndex = i;
          f.add(stem);

          // Cylindrical spotlight body
          const head = new THREE.Mesh(lensGeo, trackRailMat);
          head.position.set(0, -0.038, zo);
          head.userData.lampIndex = i;
          f.add(head);

          // Glowing recessed lens face
          const hl = new THREE.Mesh(trackHeadLensGeo, lensMat);
          hl.position.set(0, -0.062, zo);
          hl.userData.lampIndex = i;
          f.add(hl);

          // Spot halo ring on the ceiling
          const sh = new THREE.Mesh(trackSpotHaloGeo, haloMat);
          sh.rotation.x = -Math.PI / 2;
          sh.position.set(0, 0.014, zo);
          sh.userData.lampIndex = i;
          f.add(sh);

          // Individual downward spotlight cone
          const sc = new THREE.Mesh(trackConeGeo, coneMat);
          sc.position.set(0, -1.0, zo);
          sc.name = "cone";
          sc.userData.lampIndex = i;
          f.add(sc);

          // Individual floor puddle disc under each spot head
          const sd = new THREE.Mesh(trackDiscGeo, discMat);
          sd.rotation.x = -Math.PI / 2;
          sd.position.set(0, -ceilingY + 0.02, zo);
          sd.name = "disc";
          sd.userData.lampIndex = i;
          f.add(sd);
        }
      } else {
        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.userData.lampIndex = i;
        f.add(trim);

        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.y = isLinear ? -0.012 : -0.006;
        lens.userData.lampIndex = i;
        f.add(lens);

        // Overhead halo indicator for top-down visibility
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.012;
        halo.name = "halo";
        halo.userData.lampIndex = i;
        f.add(halo);

        // Downward projection light guide cone
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = -1.0;
        cone.name = "cone";
        cone.userData.lampIndex = i;
        f.add(cone);

        // Floor puddle disc
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = -ceilingY + 0.02;
        disc.name = "disc";
        disc.userData.lampIndex = i;
        f.add(disc);
      }

      f.userData.lampIndex = i;
    }
  };

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
    if (!sunSet) sunEl = s.elevation;

    hemi.intensity = s.hemi;
    hemi.color.setHex(s.hemiSky);
    hemi.groundColor.setHex(s.hemiGround);

    fill.intensity = s.fill;
    fill.color.setHex(s.fillColor);
    rim.intensity = s.rim;

    const spotColor = ledColor(lampTemp);

    // Active lumens for ceiling fixtures:
    // When preset is evening / night: spots shine at 130lm (warm, soft, no scorching).
    // When preset is day: spots cast gentle 75lm daylight accent fill.
    // When preset is studio: clean 90lm fill.
    const baseLm = preset === "evening" ? (s.spotLm || 130) : preset === "day" ? 75 : 90;
    const lm = tier === "low" || !useSpots ? 0 : baseLm;

    spots.forEach((p, i) => {
      const lit = i < lampCount;
      p.power = lit ? lm : 0;
      p.color.setHex(spotColor);
      p.castShadow = shadows && (s.spotCast || preset === "evening") && lit && lm > 0 && i < CASTING_SPOTS && tier !== "low";
    });

    lensMat.emissive.setHex(spotColor);
    lensMat.emissiveIntensity = lm > 0 ? 1.2 : (forceFixturesVisible ? 1.0 : 0);
    haloMat.color.setHex(spotColor);
    haloMat.opacity = showGuides ? 0.85 : (forceFixturesVisible ? 0.35 : 0);
    coneMat.color.setHex(spotColor);
    coneMat.visible = showGuides && lm > 0;
    discMat.color.setHex(spotColor);
    discMat.visible = showGuides && lm > 0;

    if (shadows) {
      const size = shadowSize();
      sun.castShadow = size > 0 && s.sun > 0.2;
      if (size > 0 && sun.shadow.mapSize.width !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    }
    placeSun();
  };

  const aim = (room: RoomLight) => {
    radius = keyLightFor(room.points, room.openings).radius;
    roomPointsRef = room.points;
    const b = polygonBoundsMm(room.points);
    roomBounds = { w: b.w, h: b.h };
    ceilingY = room.ceiling / 1000;
    buildFixtureBodies();
    placeLamps();
    if (perimeterLedOn) {
      buildPerimeterLed();
    }
    applyPreset();
  };

  const placeLamps = () => {
    const y = ceilingY - 0.12;

    if (customPositions && customPositions.length > 0) {
      litBodies = Math.min(lampCount, customPositions.length);
      for (let i = 0; i < fixtures.length; i++) {
        if (i < customPositions.length) {
          const cp = customPositions[i];
          spots[i].position.set(cp.x, y, cp.z);
          spots[i].target.position.set(cp.x, 0, cp.z);
          spots[i].target.updateMatrixWorld();
          spots[i].distance = y * 2.6;
          fixtures[i].position.set(cp.x, ceilingY - 0.008, cp.z);
          fixtures[i].userData.lampIndex = i;
          fixtures[i].visible = (cameraUnderCeiling || forceFixturesVisible) && i < litBodies;
        } else {
          fixtures[i].visible = false;
        }
      }
      return;
    }

    if (lampKind === "linear" || lampKind === "track") {
      const bars = lampCount <= 2 ? 1 : lampCount <= 4 ? 2 : 3;
      const per = Math.max(1, Math.ceil(lampCount / bars));
      const len = barLen();
      const insetX = Math.min((roomBounds.w / 1000) * 0.42, Math.max(0.3, wallOffsetMm / 1000));
      const spanX = Math.max(0.2, (roomBounds.w / 1000) / 2 - insetX);
      const barX = (b: number) => (bars > 1 ? (b / (bars - 1)) * 2 - 1 : 0) * spanX;
      spots.forEach((p, i) => {
        const x = barX(Math.floor(i / per));
        const slot = i % per;
        const z = (per > 1 ? (slot + 0.5) / per - 0.5 : 0) * len;
        p.position.set(x, y, z);
        p.target.position.set(x, 0, z);
        p.target.updateMatrixWorld();
        p.distance = y * 2.6;
      });
      for (let b = 0; b < fixtures.length; b++) {
        const bx = barX(b < bars ? b : bars - 1);
        fixtures[b].position.set(bx, ceilingY - 0.008, 0);
        fixtures[b].userData.lampIndex = b;
        fixtures[b].visible = (cameraUnderCeiling || forceFixturesVisible) && b < bars;
      }
      litBodies = bars;
      return;
    }

    // Spotlights grid
    const [cols, rows] = lampCount <= 2 ? [lampCount, 1] : lampCount <= 4 ? [2, 2] : [3, 2];
    litBodies = lampCount;
    const insetX = Math.min((roomBounds.w / 1000) * 0.42, Math.max(0.25, wallOffsetMm / 1000));
    const insetZ = Math.min((roomBounds.h / 1000) * 0.42, Math.max(0.25, wallOffsetMm / 1000));
    const spanX = Math.max(0.2, (roomBounds.w / 1000) / 2 - insetX);
    const spanZ = Math.max(0.2, (roomBounds.h / 1000) / 2 - insetZ);
    spots.forEach((p, i) => {
      const cx = cols > 1 ? ((i % cols) / (cols - 1)) * 2 - 1 : 0;
      const cz = rows > 1 ? (Math.floor(i / cols) / (rows - 1)) * 2 - 1 : 0;
      const x = cx * spanX;
      const z = cz * spanZ;
      p.position.set(x, y, z);
      p.target.position.set(x, 0, z);
      p.target.updateMatrixWorld();
      p.distance = y * 2.6;
      fixtures[i].position.set(x, ceilingY - 0.008, z);
      fixtures[i].userData.lampIndex = i;
      fixtures[i].visible = (cameraUnderCeiling || forceFixturesVisible) && i < litBodies;
    });
  };

  const buildPerimeterLed = () => {
    if (perimeterGroup) {
      scene.remove(perimeterGroup);
      perimeterGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      });
      perimeterGroup = null;
    }
    if (!perimeterLedOn || roomPointsRef.length < 3) return;
    const y = ceilingY - 0.02;
    const gr = new THREE.Group();
    const col = ledColor(lampTemp);
    const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
    const b0 = polygonBoundsMm(roomPointsRef);
    const n = roomPointsRef.length;
    for (let i = 0; i < n; i++) {
      const p1 = roomPointsRef[i];
      const p2 = roomPointsRef[(i + 1) % n];
      const x1 = (p1.x - b0.cx) / 1000;
      const z1 = (p1.y - b0.cy) / 1000;
      const x2 = (p2.x - b0.cx) / 1000;
      const z2 = (p2.y - b0.cy) / 1000;
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const stripGeo = new THREE.BoxGeometry(0.016, 0.016, len);
      const m = new THREE.Mesh(stripGeo, mat);
      m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      m.rotation.y = Math.atan2(dx, dz);
      gr.add(m);
    }
    scene.add(gr);
    perimeterGroup = gr;
  };

  const away = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let cameraUnderCeiling = false;

  const follow = (camera: THREE.Camera, target: THREE.Vector3) => {
    cameraUnderCeiling = camera.position.y < ceilingY - 0.05;
    const show = (cameraUnderCeiling || forceFixturesVisible) && useSpots;
    for (let i = 0; i < fixtures.length; i++) {
      fixtures[i].visible = show && i < litBodies;
    }

    away.subVectors(camera.position, target);
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
      placeLamps();
      applyPreset();
    },
    setLampKind: (k) => {
      if (k === lampKind) return;
      lampKind = k;
      buildFixtureBodies();
      placeLamps();
      applyPreset();
    },
    setLampSpread: (v) => {
      lampSpread = Math.max(0.05, Math.min(0.48, v));
      placeLamps();
    },
    setLampTemp: (k) => {
      lampTemp = k;
      applyPreset();
      if (perimeterLedOn) buildPerimeterLed();
    },
    setWallOffset: (offsetMm) => {
      wallOffsetMm = offsetMm;
      placeLamps();
    },
    setCustomPositions: (pos) => {
      customPositions = pos;
      placeLamps();
    },
    setForceFixturesVisible: (force) => {
      forceFixturesVisible = force;
      applyPreset();
      for (let i = 0; i < fixtures.length; i++) {
        fixtures[i].visible = (cameraUnderCeiling || force) && i < litBodies;
      }
    },
    setShowGuides: (show) => {
      showGuides = show;
      applyPreset();
    },
    setPerimeterLed: (on, points, ceilY) => {
      perimeterLedOn = on;
      if (points) roomPointsRef = points;
      if (ceilY) ceilingY = ceilY;
      buildPerimeterLed();
    },
    getFixtures: () => fixtures,
    setTier: (t) => {
      tier = t;
      applyPreset();
    },
    beginCapture: (shadowPx, keepPreset) => {
      const wasPreset = preset;
      const wasOverride = mapOverride;
      if (!keepPreset) preset = "studio";
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
      for (const f of fixtures) scene.remove(f);
      for (const g of fixtureGeos) g.dispose();
      trimMat.dispose();
      trackRailMat.dispose();
      lensMat.dispose();
      haloMat.dispose();
      coneMat.dispose();
      discMat.dispose();
      if (perimeterGroup) {
        scene.remove(perimeterGroup);
        perimeterGroup.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose?.();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        });
        perimeterGroup = null;
      }
      scene.remove(sun, sunTarget, fill, fillTarget, rim, rimTarget, hemi, ...spots);
    },
  };
}
