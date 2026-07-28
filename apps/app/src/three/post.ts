// AMBIENT OCCLUSION — the real thing this time.
//
// A cabinet does not look like it is standing in a room until the crevices around it go dark: the
// gap between a wall unit and the wall, the shadow line where a plinth meets the floor, the corner
// where two runs meet. None of that comes from a lamp. It comes from ambient light being BLOCKED by
// nearby geometry — and analytic lights have no idea what "nearby geometry" is. That absence is what
// makes a render look like a drawing no matter how you tune the lights, and it is the thing we kept
// trying and failing to fix by moving numbers around in the light rig.
//
// So: GTAO (ground-truth ambient occlusion), a screen-space pass. It reads the depth and normal of
// every pixel, samples the neighbourhood, and darkens a pixel by how much of its sky is walled off.
//
// IT IS NOT FREE, and this is a phone. It costs a second render of the scene (for the normals) plus
// a per-pixel sample loop plus a denoise. That is exactly why `three/quality.ts` can switch it off:
// the LOW tier renders straight to the canvas with no composer at all, and the contact-shadow decals
// (three/contact.ts) come back to stand in for it.
//
// One subtlety that will silently ruin the colours if it is missed: three applies tone mapping in the
// material shader ONLY when drawing to the canvas (WebGLPrograms: `currentRenderTarget === null`).
// Inside a composer we are drawing into a render target, so the scene comes out LINEAR and un-mapped —
// which is correct, because the chain has to work in HDR — and `OutputPass` at the end is what applies
// the tone curve and the sRGB conversion. Drop OutputPass and the picture goes flat and dark.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";

/** `?ssao=0` forces it off, `?ssao=1` forces it on regardless of tier — for the device test. */
function forced(): boolean | null {
  if (typeof location === "undefined") return null;
  const v = new URLSearchParams(location.search).get("ssao");
  if (v == null) return null;
  return v !== "0" && v !== "false";
}

/** `?aor=0.4` — the occlusion radius in METRES. How far from a surface we look for something blocking
 *  it: small = a tight dark line in the crevices, large = broad soft shading. */
function radiusOverride(): number | null {
  if (typeof location === "undefined") return null;
  const v = Number.parseFloat(new URLSearchParams(location.search).get("aor") ?? "");
  return Number.isFinite(v) ? v : null;
}

export interface Post {
  /** draw the frame — through the AO chain if it is on, straight to the canvas if it is not */
  render: () => void;
  resize: (w: number, h: number) => void;
  /**
   * THE COMPOSER DOES NOT FOLLOW THE RENDERER'S PIXEL RATIO.
   *
   * `EffectComposer` reads it ONCE, in its constructor, and never looks again — so dropping the
   * renderer to 1.5× left the AO chain rendering at the full 2×, and the quality tier's whole
   * middle rung ("keep AO, halve the pixels") silently did nothing. Every place that changes the
   * renderer's pixel ratio has to change the composer's too, or the tier ladder has a broken step.
   */
  setPixelRatio: (r: number) => void;
  /** true while the AO chain is actually running */
  on: () => boolean;
  /** the quality tier turns it off when the device can't hold the budget */
  setEnabled: (v: boolean) => void;
  dispose: () => void;
}

export function buildPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  w: number,
  h: number,
  enabled: boolean,
): Post {
  const force = forced();
  let want = force ?? enabled;

  // THE RENDERER'S `antialias: true` DOES NOTHING INSIDE A COMPOSER — hardware MSAA only applies when
  // drawing to the canvas, and we are drawing into a render target. Left unhandled, the picture got
  // JAGGIER at the exact moment the shadows appeared (the dragging frames go straight to the canvas and
  // keep their MSAA; only the settled frame goes through here), and that difference reads as a glitch,
  // not as a refinement.
  //
  // Multisampling the target itself is the obvious answer and the wrong one on a phone: a 4×-sampled
  // half-float buffer, kept twice over, is tens of megabytes at this pixel density. So the anti-aliasing
  // is a PASS instead (SMAA) — a few fullscreen ops, no extra buffers, and this frame is a one-off
  // anyway.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, // the chain works in HDR — the tone curve is applied at the very end
  });
  const composer = new EffectComposer(renderer, rt);
  composer.setSize(w, h);

  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, w, h);
  gtao.output = GTAOPass.OUTPUT.Default; // blend the occlusion into the picture, don't replace it
  gtao.blendIntensity = 1;
  gtao.updateGtaoMaterial({
    // metres. A kitchen's crevices are centimetres and its alcoves are tens of them; ~35cm darkens
    // the plinth line and the underside of the wall units without smearing the whole room grey.
    radius: radiusOverride() ?? 0.35,
    distanceExponent: 1,
    thickness: 1,
    distanceFallOff: 1,
    scale: 1.1,
    samples: 8, // the phone budget lives here — 16 is the desktop default
    screenSpaceRadius: false,
  });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
  composer.addPass(gtao);

  // stands in for the hardware MSAA we lose inside the composer, so the settled frame is as crisp as
  // the ones you dragged to get to it
  const smaa = new SMAAPass(w, h); // composer.setSize keeps it in step from here
  composer.addPass(smaa);

  // WITHOUT THIS the whole picture is flat and dark — see the note at the top of the file
  composer.addPass(new OutputPass());

  const render = () => {
    if (want) composer.render();
    else renderer.render(scene, camera); // no composer at all: nothing to pay for
  };

  return {
    render,
    on: () => want,
    setEnabled: (v) => {
      if (force != null) return; // the URL wins, so a device test can't be undone by the auto-tier
      want = v;
    },
    resize: (nw, nh) => {
      composer.setSize(nw, nh);
    },
    setPixelRatio: (r) => {
      composer.setPixelRatio(r); // also re-sizes every target and every pass
    },
    dispose: () => {
      composer.dispose();
      gtao.dispose();
      smaa.dispose();
      rt.dispose();
    },
  };
}
