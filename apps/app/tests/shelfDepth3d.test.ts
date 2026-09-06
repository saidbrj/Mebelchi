// THE 3D DRAWS THE BOARD THE CUT LIST ORDERS.
//
// A per-role depth that only reaches pricing is worse than none: the client is shown a full-depth
// shelf and the shop cuts a shallow one. This asserts on the built GEOMETRY rather than on a
// screenshot, because the module's carcass merges into one mesh and a camera can miss a board
// entirely — which is exactly how the first version of this passed review and drew nothing.

import { describe, it, expect, vi } from "vitest";

vi.mock("../src/three/pbr", async (orig) => {
  const actual = await orig<typeof import("../src/three/pbr")>();
  return { ...actual, PBR: false, texturedMaterial: () => null };
});
vi.mock("../src/three/contact", () => ({ contactShadow: () => {}, decalTexture: () => null, contactMaterial: () => null }));

import * as THREE from "three";
import { mk, type Cabinet } from "../src/model/cabinet";
import { buildKitchen } from "../src/three/kitchen3d";
import { resolveLayout } from "../src/model/resolve";
import type { Pt } from "../src/model/room";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room = { points: ROOM, waterWall: null, layout: "i" as const, openings: [] };
const STYLE = { carcass: 0x111111, facade: 0x222222, worktop: 0x333333, handle: 0x444444, glassUppers: false };

/** every vertex z in the built kitchen, rounded — the shape of the boards, in one comparable list */
function zProfile(cabs: Cabinet[]): string {
  const L = resolveLayout(cabs, room);
  const runs = L.runs.map((r) => ({ placement: r.placement, kind: r.kind, revealStart: r.revealStart, revealEnd: r.revealEnd }));
  const g = buildKitchen(cabs, runs, STYLE, { cx: 2000, cy: 1500 }, 2700);
  const zs: number[] = [];
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) zs.push(Math.round(p.getZ(i) * 1000));
  });
  return zs.sort((a, b) => a - b).join(",");
}

const shelved = (over: Partial<Cabinet> = {}) =>
  mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, fill: "shelves", count: 2, ...over });

describe("a shallower shelf is actually drawn shallower", () => {
  it("changes the built geometry", () => {
    // THE ASSERTION THAT MATTERS, and it covers the path that WAS broken: a fronted cabinet's
    // shelves are drawn by `buildInterior` (the interior behind a door), which computed the
    // shortened depth and then drew with the old one — so the shelf priced at 300 and rendered at
    // 560. A screenshot could not see it: from any ordinary camera you cannot look inside a base.
    const full = zProfile([shelved()]);
    const shallow = zProfile([shelved({ panels: { shelf: { depthMm: 300 } } })]);
    expect(shallow).not.toBe(full);
  });

  it("moves the FRONT edge back and leaves the back where it was", () => {
    // that is where the depth comes off in the shop — the board still meets the back
    const zOf = (c: Cabinet) => zProfile([c]).split(",").map(Number);
    const full = zOf(shelved());
    const shallow = zOf(shelved({ panels: { shelf: { depthMm: 300 } } }));
    expect(Math.min(...shallow)).toBe(Math.min(...full)); // nothing moved backwards
    expect(Math.max(...shallow)).toBe(Math.max(...full)); // the box itself is unchanged
  });

  it("leaves a cabinet with no override byte-identical", () => {
    expect(zProfile([shelved({ panels: {} })])).toBe(zProfile([shelved()]));
  });

  it("overrides dividers independently", () => {
    // an explicit COLUMN split, rather than the legacy `div` flag: the Cabinet's field is `div`
    // while the layout deriver reads the Module's `dividers`, and a test should not lean on that
    const twoBays = { split: "cols" as const, children: [{}, {}] };
    const a = zProfile([shelved({ layout: twoBays })]);
    const b = zProfile([shelved({ layout: twoBays, panels: { divider: { depthMm: 300 } } })]);
    expect(b).not.toBe(a);
  });
});
