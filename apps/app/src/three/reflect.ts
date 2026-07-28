// A REFLECTIVE FLOOR — because a real kitchen floor has the kitchen in it.
//
// This is a planar mirror, not a screen-space trick: three's `Reflector` renders the whole scene a
// second time from a camera mirrored through the floor plane, into a texture. So it reflects the actual
// cabinets, at the actual angle, including the ones off the edge of the screen — which screen-space
// reflection cannot do, and which is exactly the difference between "shiny" and "reflective".
//
// IT COSTS A SECOND SCENE RENDER. That is the whole price and there is no way around it, so it is only
// ever switched on for a SETTLED frame in the Рендер step (the same deal ambient occlusion gets): you
// orbit at full speed against a plain floor, and when you stop, the room appears in it.
//
// Two things `Reflector` does not do that we have to:
//   • Its shader hard-codes alpha to 1.0, so out of the box it REPLACES the floor rather than glazing
//     it — you get a mirror where the oak should be. We patch an opacity uniform in, so the wood stays
//     the floor and the reflection is a sheen over it.
//   • It writes depth. A mirror that occludes the boards under it would be an odd thing.

import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/** `?refl=0.5` — how mirrored the floor is. Taste, and only judgeable by looking. */
function strengthOverride(): number | null {
  if (typeof location === "undefined") return null;
  const v = Number.parseFloat(new URLSearchParams(location.search).get("refl") ?? "");
  return Number.isFinite(v) ? v : null;
}

export interface Mirror {
  /** the mesh — add it to the room group */
  mesh: THREE.Object3D;
  /** show the reflection (a settled frame) or hide it (mid-orbit) */
  setVisible: (v: boolean) => void;
  dispose: () => void;
}

/**
 * Glaze the room's floor. `floor` is the mesh tagged `userData.floor` by makeRoom — we borrow its
 * geometry and its place in the world, and float a millimetre above it.
 */
export function buildMirror(floor: THREE.Mesh, strength = 0.42): Mirror | null {
  if (!floor.geometry) return null;

  // THE ORIENTATION TRAP. three's `Reflector` hard-codes its mirror normal to local +Z. But makeRoom
  // BAKES the floor flat (`floorGeo.rotateX(π/2)`), so this geometry's surface faces local −Y with the
  // mesh un-rotated — hand it to the Reflector as-is and it mirrors a VERTICAL plane facing into the
  // room, which shows nothing on the floor. So un-bake the clone back to an XY plane (normal +Z, what
  // the Reflector wants) and lay the MESH flat instead, exactly the way the Reflector expects.
  const geo = floor.geometry.clone();
  geo.rotateX(-Math.PI / 2);

  const mirror = new Reflector(geo, {
    // half-resolution is plenty: a reflection in a matte-ish floor is a suggestion, not a second image,
    // and this texture is re-rendered from scratch every time it is drawn
    textureWidth: 512,
    textureHeight: 512,
    color: 0x8f979f,
  });
  mirror.rotation.x = -Math.PI / 2; // lay the +Z-facing plane flat, normal pointing up
  mirror.position.copy(floor.position);
  mirror.position.y += 0.002; // a hair above the boards, so it never z-fights the wood

  const mat = mirror.material as THREE.ShaderMaterial;
  const a = Math.max(0, Math.min(1, strengthOverride() ?? strength));
  mat.uniforms.opacity = { value: a };
  mat.fragmentShader = `uniform float opacity;\n${mat.fragmentShader}`.replace(
    "gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );",
    "gl_FragColor = vec4( blendOverlay( base.rgb, color ), opacity );",
  );
  mat.transparent = true;
  mat.depthWrite = false; // a sheen on the boards, not a slab over them
  mat.needsUpdate = true;

  mirror.renderOrder = 1;
  mirror.visible = false; // nothing reflects until the view settles — see the note at the top
  mirror.raycast = () => {}; // it must never steal a tap from the floor it is lying on

  return {
    mesh: mirror,
    setVisible: (v) => {
      mirror.visible = v;
    },
    dispose: () => {
      mirror.geometry.dispose();
      mat.dispose();
      (mirror as unknown as { getRenderTarget: () => THREE.WebGLRenderTarget }).getRenderTarget?.().dispose();
    },
  };
}
