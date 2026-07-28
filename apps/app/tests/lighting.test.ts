// THE SUN (three/lighting.ts). The one part of the rig that is arithmetic rather than GPU state, and
// the one that has broken three times — so it is the one worth pinning.
//
// The bug this file exists to prevent: deriving the sun's whole POSITION from the window pinned it to
// the window's own height, which put it ~29° above the horizon. A sun that low throws its shadows
// sideways onto the far wall, so a wall unit cast nothing onto the counter below it and the render read
// as flat no matter how the intensities were tuned. `keyLightFor` now returns a BEARING only; how high
// the sun stands is the preset's business, or the user's.

import { describe, it, expect } from "vitest";
import { keyLightFor, clampEl, SUN_MIN_EL, SUN_MAX_EL, RENDER_PRESETS } from "../src/three/lighting";
import type { Opening, Pt } from "../src/model/room";

/** a 4 × 3 m room, corner at the origin. Walls: 0 = south (y=0), 1 = east, 2 = north, 3 = west. */
const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

const win = (o: Partial<Opening> = {}): Opening => ({
  id: "w",
  wall: 0,
  kind: "window",
  t: 0.5,
  width: 1200,
  height: 1400,
  design: "",
  name: "",
  desc: "",
  ...o,
});

/** the compass bearing, as a unit vector on the floor — easier to assert about than an angle */
const dir = (azimuth: number) => ({ x: Math.sin(azimuth), z: Math.cos(azimuth) });

describe("keyLightFor — which way the daylight comes from", () => {
  it("puts the sun on the window's side of the room", () => {
    // wall 0 runs along y = 0. The room's centre is (2000, 1500), so that wall — and its window — is on
    // the −z side: the sun must shine FROM −z.
    const { x, z } = dir(keyLightFor(ROOM, [win({ wall: 0 })]).azimuth);
    expect(z).toBeLessThan(-0.9);
    expect(Math.abs(x)).toBeLessThan(0.2);
  });

  it("follows the window to another wall", () => {
    // wall 1 is the east wall (x = 4000) → the sun comes from +x
    const { x, z } = dir(keyLightFor(ROOM, [win({ wall: 1 })]).azimuth);
    expect(x).toBeGreaterThan(0.9);
    expect(Math.abs(z)).toBeLessThan(0.2);
  });

  it("picks the widest window — the one letting the most light in", () => {
    const a = keyLightFor(ROOM, [win({ id: "a", wall: 0, width: 600 }), win({ id: "b", wall: 1, width: 2400 })]);
    expect(dir(a.azimuth).x).toBeGreaterThan(0.9); // the big east window won
  });

  it("falls back to the historic (4, 8, 6) bearing when there is no window", () => {
    const historic = Math.atan2(4, 6);
    expect(keyLightFor(ROOM, []).azimuth).toBeCloseTo(historic, 6);
    expect(keyLightFor(ROOM, [win({ kind: "door" })]).azimuth).toBeCloseTo(historic, 6);
    expect(keyLightFor([], [win()]).azimuth).toBeCloseTo(historic, 6); // no room either
  });

  it("cuts the shadow frustum to the room — a big room used to fall outside it", () => {
    // the frustum was once hardcoded at ±4m, so anything past that silently lost its shadow
    const small = keyLightFor(ROOM, [win()]);
    const big = keyLightFor(
      [{ x: 0, y: 0 }, { x: 12000, y: 0 }, { x: 12000, y: 9000 }, { x: 0, y: 9000 }],
      [win()],
    );
    expect(small.radius).toBeLessThan(4);
    expect(big.radius).toBeGreaterThan(7); // half the diagonal of a 12 × 9 m room
  });

  it("returns a bearing and nothing else — the sun's HEIGHT is not the window's business", () => {
    // this is the regression that mattered: a sun placed at the window sits ~29° up and shadows nothing
    // you can see. Height belongs to the preset (and to the user's dial).
    expect(Object.keys(keyLightFor(ROOM, [win()])).sort()).toEqual(["azimuth", "radius"]);
  });
});

describe("the sun never lies down", () => {
  it("clamps the dial away from the horizon", () => {
    expect(clampEl(0)).toBe(SUN_MIN_EL); // a sun at 0° lights nothing and shadows everything
    expect(clampEl(Math.PI)).toBe(SUN_MAX_EL);
    expect(clampEl(45 * (Math.PI / 180))).toBeCloseTo(45 * (Math.PI / 180), 6);
  });

  it("keeps the minimum high enough to throw a shadow under a wall unit", () => {
    // a wall unit is ~350mm deep and hangs ~660mm above the counter. For its shadow to land ON the
    // counter rather than only on the wall behind it, the sun has to be steeper than atan(660/350) —
    // and comfortably so.
    expect(SUN_MIN_EL).toBeGreaterThan(15 * (Math.PI / 180));
  });
});

describe("the render presets", () => {
  it("offers the three looks the picker shows — and `editor` is not one of them", () => {
    expect(RENDER_PRESETS).toEqual(["day", "evening", "studio"]);
    expect(RENDER_PRESETS).not.toContain("editor"); // the workbench is not a look
  });
});
