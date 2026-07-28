// Render ONE cabinet to a transparent 200×200 PNG thumbnail (3/4 perspective, cabinet only)
// for the "My cabinets" library. Builds an offscreen Three.js scene with the same builder +
// framing as the fill-editor preview (CabinetPreview3D), captures, downscales, tears down.
import * as THREE from "three";
import { buildKitchen, type RunRef } from "../three/kitchen3d";
import { buildRig } from "../three/lighting";
import type { KitchenStyle } from "../model/layout";
import type { Cabinet } from "../model/cabinet";

const RUN: RunRef = { placement: { ax: 0, az: 0, ux: 1, uz: 0, ix: 0, iz: 1, startS: 0, lenM: 5 }, kind: "wall" };

function disposeGroup(gr: THREE.Object3D) {
  gr.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Rendered thumbnails, by cache key. A catalogue list re-mounts constantly (every sheet open, every
 *  swap-strip rebuild) and each miss costs a WebGL context, so a template is rendered ONCE. */
const cache = new Map<string, string | null>();

/** The catalogue thumbnail for a template that has no PNG in /furniture — rendered from the module
 *  itself, exactly the way «Сохранить» renders a saved cabinet, so a hand-made entry and a stock one
 *  look like they came from the same catalogue. Cached; `null` when the render fails (→ the glyph).
 *
 *  Keyed on the FINISH as well as the id: these are drawn in the kitchen's own colours, so a template
 *  must not keep a thumbnail from a previous style. */
export function templateThumbnail(id: string, cab: Cabinet, style: KitchenStyle): string | null {
  const key = `${id}|${style.facade}|${style.carcass}|${style.worktop}|${style.handle}|${style.glassUppers ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const url = captureCabinetThumbnail(cab, style);
  cache.set(key, url);
  return url;
}

/** A transparent 200×200 PNG data-URL of the cabinet alone (isometric-ish 3/4 view), or null. */
export function captureCabinetThumbnail(cab: Cabinet, style: KitchenStyle): string | null {
  const SS = 440; // supersample, then downscale to 200 for clean edges
  let renderer: THREE.WebGLRenderer | null = null;
  let group: THREE.Group | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SS, SS);
    renderer.setClearColor(0x000000, 0); // fully transparent background

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 40);
    // the same rig every other scene uses (three/lighting.ts): a catalogue thumbnail must look like
    // the thing it stands for. No room → no shadows, no ceiling spots.
    const rig = buildRig(scene, renderer, { shadows: false, spots: false, preset: "studio" });

    // strip placement so it renders centred at the origin (like the fill-editor preview)
    const preview: Cabinet = { ...cab, px: 0, pz: 0, rot: 0, run: 0, mountY: cab.kind === "upper" ? 0 : cab.mountY };
    group = buildKitchen([preview], [RUN], style, { cx: 0, cy: 0 });
    scene.add(group);
    group.updateMatrixWorld(true);

    // frame the cabinet in a 3/4 perspective (same angle as CabinetPreview3D)
    const box = new THREE.Box3().setFromObject(group);
    const ctr = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dist = (Math.max(size.x, size.y, size.z, 0.3) / (2 * Math.tan((camera.fov * Math.PI) / 360))) * 2.0;
    camera.position.set(ctr.x + dist * 0.62, ctr.y + dist * 0.5, ctr.z + dist * 0.92);
    camera.lookAt(ctr);

    rig.follow(camera, ctr); // the fill sits over the camera's shoulder — same rig as the room
    renderer.render(scene, camera);

    // TIGHT square crop around the cabinet's PROJECTED bounding box, so the cabinet fills the
    // frame like the catalog PNGs (framing to the full render left too much margin → it read
    // smaller than the templates). Project all 8 box corners → pixel bbox → square + padding.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).project(camera);
      const px = (v.x * 0.5 + 0.5) * SS, py = (-v.y * 0.5 + 0.5) * SS;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const side = Math.min(SS, Math.max(maxX - minX, maxY - minY) * 1.1); // ~5% margin each side
    const sx0 = Math.max(0, Math.min(SS - side, cx - side / 2));
    const sy0 = Math.max(0, Math.min(SS - side, cy - side / 2));

    const out = document.createElement("canvas");
    out.width = 200;
    out.height = 200;
    const ctx = out.getContext("2d");
    const url = ctx
      ? (ctx.drawImage(renderer.domElement, sx0, sy0, side, side, 0, 0, 200, 200), out.toDataURL("image/png"))
      : renderer.domElement.toDataURL("image/png");
    return url;
  } catch {
    return null;
  } finally {
    if (group) disposeGroup(group);
    renderer?.dispose();
    renderer?.forceContextLoss?.();
  }
}
