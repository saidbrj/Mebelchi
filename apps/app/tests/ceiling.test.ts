// THE ROOM HAS A CEILING.
//
// It had five surfaces and a sky where the sixth should be — which is why no render could show a
// room's own lighting: the downlights had nothing to hang from and the bounce nothing to come off.
//
// The reason it can exist at all without ruining the 3/4 view is that it CULLS, the way a wall
// does — a wall by which side of it you are on, the ceiling by whether you are under it. These pin
// the surface and the rule; the cull itself lives in three/VariantScene (`updateCull`).

import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";

// the room builder pulls in the PBR/contact helpers through its module graph; both paint canvases
vi.mock("../src/three/pbr", async (orig) => {
  const actual = await orig<typeof import("../src/three/pbr")>();
  return { ...actual, PBR: false, texturedMaterial: () => null };
});
vi.mock("../src/three/contact", () => ({ contactShadow: () => {}, decalTexture: () => null, contactMaterial: () => null }));

import { makeRoom } from "../src/three/ThreeScene";

const SQUARE = [
  { x: -2, z: -1.5 },
  { x: 2, z: -1.5 },
  { x: 2, z: 1.5 },
  { x: -2, z: 1.5 },
];

const build = (ceilingM: number) =>
  makeRoom(SQUARE, SQUARE, ceilingM, new THREE.Texture(), [], [], [], {}, null, null, null, false);

const ceilingOf = (g: THREE.Group): THREE.Mesh | null => {
  let found: THREE.Mesh | null = null;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.userData.ceiling) found = o as THREE.Mesh;
  });
  return found;
};

describe("the room's ceiling", () => {
  it("exists, and is tagged so the cull can find it", () => {
    expect(ceilingOf(build(2.5).group)).not.toBeNull();
  });

  it("sits at the room's ceiling height, whatever that is", () => {
    for (const h of [2.4, 2.7, 3.2]) {
      const c = ceilingOf(build(h).group)!;
      c.geometry.computeBoundingBox();
      const box = c.geometry.boundingBox!;
      expect(box.min.y).toBeCloseTo(h, 5);
      expect(box.max.y).toBeCloseTo(h, 5);
    }
  });

  it("covers the room's whole footprint", () => {
    const c = ceilingOf(build(2.5).group)!;
    c.geometry.computeBoundingBox();
    const box = c.geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-2, 5);
    expect(box.max.x).toBeCloseTo(2, 5);
    expect(box.min.z).toBeCloseTo(-1.5, 5);
    expect(box.max.z).toBeCloseTo(1.5, 5);
  });

  it("is single-sided, facing DOWN — from above it must not exist at all", () => {
    const c = ceilingOf(build(2.5).group)!;
    const m = c.material as THREE.MeshStandardMaterial;
    expect(m.side).toBe(THREE.BackSide);
  });

  it("does not disturb the floor — they are two surfaces, not one flipped", () => {
    const g = build(2.5).group;
    let floor: THREE.Mesh | null = null;
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.userData.floor) floor = o as THREE.Mesh;
    });
    expect(floor).not.toBeNull();
    expect(floor).not.toBe(ceilingOf(g));
  });
});
