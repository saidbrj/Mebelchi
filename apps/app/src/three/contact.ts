// THE DARKNESS UNDER THE FURNITURE.
//
// Ambient light — the environment map, the hemisphere — arrives from every direction equally, so it
// reaches under a cabinet exactly as easily as it reaches the middle of the floor. Nothing is ever
// occluded, so nothing ever looks like it is SITTING on anything: the cabinets float, and the room
// reads like a drawing. That absence is what makes a bright scene feel fake, and it is why turning the
// ambient down (the obvious fix) just makes it a dim drawing instead.
//
// The honest fix is ambient occlusion, which means a full-screen depth pass (SSAO) — real money on a
// phone, and it would eat the frame budget we just clawed back. So: a soft shadow DECAL under each
// module. One draw call, no lighting maths at all, and it puts the darkness exactly where the eye
// looks for it. Every real-time room planner does this.

import * as THREE from "three";

/** how far the soft edge bleeds past the module's own footprint (m) */
export const CONTACT_BLEED = 0.09;

let tex: THREE.Texture | null = null;

/**
 * A soft-edged black rectangle, as an alpha texture — built once, shared by every decal.
 *
 * Drawn by hand into an ImageData rather than with `ctx.filter = "blur()"`: canvas filters are a late
 * arrival in Safari/WKWebView, which is exactly where this app runs.
 */
function decalTexture(): THREE.Texture {
  if (tex) return tex;
  const N = 64;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  // smoothstep from fully dark in the middle to nothing at the edge, on each axis independently —
  // the product of the two gives a rectangle with soft sides AND softly rounded corners
  const fall = (v: number) => {
    const t = Math.min(1, Math.max(0, (1 - Math.abs(v)) / 0.42)); // 0 at the edge, 1 by 42% in
    return t * t * (3 - 2 * t); // smoothstep
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const a = fall((x / (N - 1)) * 2 - 1) * fall((y / (N - 1)) * 2 - 1);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0; // black
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** `?ao=0.7` scales every contact shadow — the same tuning back door the light presets have, because
 *  how dark this should be is a matter of taste and you can only judge it by looking. */
function aoScale(): number {
  if (typeof location === "undefined") return 1;
  const v = Number.parseFloat(new URLSearchParams(location.search).get("ao") ?? "");
  return Number.isFinite(v) ? v : 1;
}

/** The decal's material. NOT shared across modules: `applyMode` (wireframe / x-ray) mutates whatever
 *  materials it finds, and a kitchen-wide one would keep those mutations forever. */
export function contactMaterial(opacity = 0.5): THREE.Material {
  return new THREE.MeshBasicMaterial({
    map: decalTexture(),
    transparent: true,
    opacity: Math.min(1, Math.max(0, opacity * aoScale())),
    depthWrite: false, // it is a stain on the floor, not an object above it
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * Lay a contact shadow on the floor under a module, in the module's own local frame.
 *
 * `w` × `d` is the footprint; a regular module spans z ∈ [0, d] (the wall is at z = 0), a corner unit
 * is a square centred on its origin. `y` is the surface it lands on — the floor for anything standing
 * on it.
 */
export function contactShadow(g: THREE.Group, w: number, d: number, opts: { centred?: boolean; y?: number; opacity?: number } = {}): void {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 2 * CONTACT_BLEED, d + 2 * CONTACT_BLEED),
    contactMaterial(opts.opacity),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, (opts.y ?? 0) + 0.003, opts.centred ? 0 : d / 2);
  mesh.renderOrder = 2;
  mesh.raycast = () => {}; // never steal a tap from the module it belongs to
  // seen by BOTH the merge (it has its own material, so it stays its own mesh) and by the scene's
  // shadow/render-mode passes, which have to leave it alone — a shadow that casts a shadow, or a
  // wireframe stain, is nonsense
  mesh.userData.decal = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  g.add(mesh);
}
