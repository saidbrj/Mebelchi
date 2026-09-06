// A LINEAR LUMINAIRE HAS TO LIGHT LIKE A LINE.
//
// The bug this pins, reported from use: switching «Тип» to «Линейные» changed the fixture you could
// see into a bar, and changed nothing at all about the light. The bar was 2.4m long and lit the room
// from a single point at its centre — so a linear kitchen was lit exactly like a row of downlights,
// which is the one difference a client can actually see.
//
// The rig's light COUNT is fixed for the life of the scene on purpose: adding or removing one
// recompiles every material in it (three/lighting.ts). So a line source is made by SAMPLING it with
// the lamps that already exist — which is also what a linear luminaire physically is, a row of
// diodes behind a diffuser.

import { describe, it, expect, vi } from "vitest";

// The rig builds an IBL environment through `PMREMGenerator`, which renders a cube and so wants a
// real WebGL context. Same story as the PBR textures in wallPanels.test.ts: stub the thing that
// needs a browser, keep everything else real. It changes how surfaces are SHADED, which is not what
// a single assertion here is about — they are all about where the lamps ended up.
vi.mock("three", async (orig) => {
  const actual = await orig<typeof import("three")>();
  class FakePMREM {
    fromScene() {
      return { texture: new actual.Texture() };
    }
    dispose() {}
  }
  return { ...actual, PMREMGenerator: FakePMREM };
});

import * as THREE from "three";
import { buildRig, type Rig } from "../src/three/lighting";

/** The rig only ever touches these three. A real WebGL context needs a canvas we do not have here. */
const stubRenderer = () =>
  ({
    toneMapping: 0,
    toneMappingExposure: 1,
    shadowMap: { needsUpdate: false },
  }) as unknown as THREE.WebGLRenderer;

const ROOM = {
  points: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ],
  ceiling: 2700,
  openings: [],
};

const rigFor = (kind: "spot" | "linear", lamps = 6): { scene: THREE.Scene; rig: Rig } => {
  const scene = new THREE.Scene();
  const rig = buildRig(scene, stubRenderer(), { preset: "evening", shadows: false });
  rig.aim(ROOM);
  rig.setLampKind(kind);
  rig.setLampCount(lamps);
  return { scene, rig };
};

/** The lamps that are actually burning — power is what `applyPreset` sets from the lit count. */
const litLamps = (scene: THREE.Scene) => {
  const out: THREE.SpotLight[] = [];
  scene.traverse((o) => {
    const l = o as THREE.SpotLight;
    if (l.isSpotLight && l.power > 0) out.push(l);
  });
  return out;
};

const spread = (vals: number[]) => Math.max(...vals) - Math.min(...vals);

describe("a linear luminaire is a LINE of light", () => {
  it("spreads its lamps ALONG the bar, not all at its centre", () => {
    // THE WHOLE BUG. Every lit lamp sat at z = 0 — one point, however long the fixture looked.
    const { scene } = rigFor("linear");
    const z = litLamps(scene).map((l) => l.position.z);
    expect(spread(z)).toBeGreaterThan(0.5);
  });

  it("keeps the samples INSIDE the bar it is meant to be", () => {
    // past the diffuser they would light where the fixture is not
    const { scene } = rigFor("linear");
    const len = Math.max(0.6, Math.min(2.4, (3000 / 1000) * 0.55));
    for (const l of litLamps(scene)) expect(Math.abs(l.position.z)).toBeLessThanOrEqual(len / 2);
  });

  it("still lights every lamp the count asked for", () => {
    // sampling a bar must not quietly cost the room half its light
    expect(litLamps(rigFor("linear", 6).scene)).toHaveLength(6);
    expect(litLamps(rigFor("linear", 2).scene)).toHaveLength(2);
  });

  it("shows ONE fixture body per bar, not one per lamp", () => {
    // six bodies for six samples would stack six 2.4m luminaires on top of each other
    const { scene, rig } = rigFor("linear", 6);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 4); // under the ceiling, so the fixtures are allowed to show
    rig.follow(camera, new THREE.Vector3(0, 1, 0));
    const bodies = scene.children.filter((o) => o.type === "Group" && o.visible);
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.length).toBeLessThan(6);
  });

  it("puts each bar's body at the centre of its own samples", () => {
    const { scene, rig } = rigFor("linear", 6);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 4);
    rig.follow(camera, new THREE.Vector3(0, 1, 0));
    const bodyX = scene.children.filter((o) => o.type === "Group" && o.visible).map((o) => o.position.x);
    const lampX = new Set(litLamps(scene).map((l) => +l.position.x.toFixed(4)));
    for (const x of bodyX) expect(lampX.has(+x.toFixed(4))).toBe(true);
  });
});

describe("round downlights are unchanged", () => {
  it("lays them out as a grid, each its own pool", () => {
    // the fix must not turn the default fixture into a line
    const { scene } = rigFor("spot", 6);
    const lamps = litLamps(scene);
    expect(lamps).toHaveLength(6);
    // a grid varies in BOTH axes; the linear layout deliberately does not
    expect(spread(lamps.map((l) => l.position.x))).toBeGreaterThan(0);
    expect(spread(lamps.map((l) => l.position.z))).toBeGreaterThan(0);
  });

  it("shows one body per lit lamp", () => {
    const { scene, rig } = rigFor("spot", 4);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 4);
    rig.follow(camera, new THREE.Vector3(0, 1, 0));
    expect(scene.children.filter((o) => o.type === "Group" && o.visible)).toHaveLength(4);
  });
});

describe("switching between them", () => {
  it("re-lays the lamps out, rather than leaving the old positions", () => {
    const scene = new THREE.Scene();
    const rig = buildRig(scene, stubRenderer(), { preset: "evening", shadows: false });
    rig.aim(ROOM);
    rig.setLampCount(6);
    const gridZ = litLamps(scene).map((l) => l.position.z).join();
    rig.setLampKind("linear");
    const lineZ = litLamps(scene).map((l) => l.position.z).join();
    expect(lineZ).not.toBe(gridZ);
    rig.setLampKind("spot");
    expect(litLamps(scene).map((l) => l.position.z).join()).toBe(gridZ);
  });
});
