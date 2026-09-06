// A DRAGGED PIPE LANDS ON 90° OR 45°.
//
// Pipes are made of straight lengths and elbows, and the elbows come in two angles. A run left at
// 88° is not a run anybody can build — it is a drawing of one. So a leg that lands near plumb,
// level or 45° is pulled onto it exactly, and the exactness is the point: «almost vertical» is a
// dimension the fitter has to argue with, and it reaches them through the notch this pipe cuts in
// the cabinet back (model/cutouts.ts).
//
// A magnet, not a constraint — an angle that is genuinely meant is still drawable.

import { describe, it, expect } from "vitest";
import { snapPipePoint, PIPE_SNAP_RAD, type PipePoint } from "../src/model/room";

const A: PipePoint = { a: 900, y: 0 };
/** the angle of the leg from `A`, in degrees */
const legDeg = (p: { a: number; y: number }) =>
  (Math.atan2(p.y - A.y, p.a - A.a) * 180) / Math.PI;

describe("pulling a near-miss onto the angle", () => {
  it("snaps a nearly-plumb leg to exactly plumb", () => {
    const p = snapPipePoint([A], 940, 900);
    expect(p.a).toBe(900);
    expect(p.snapped).toBe(true);
  });

  it("snaps a nearly-level leg to exactly level", () => {
    expect(snapPipePoint([{ a: 0, y: 1200 }], 1500, 1240).y).toBe(1200);
  });

  it("snaps a near-45 leg to exactly 45", () => {
    expect(legDeg(snapPipePoint([A], 1800, 850))).toBeCloseTo(45, 6);
  });

  it("holds the angle exactly, not just closely — the 10mm grid must not break it", () => {
    // both offsets round together, so a 45° stays 45° rather than becoming 44.7°
    for (const [a, y] of [[1797, 843], [913, 1655], [214, 703]]) {
      const p = snapPipePoint([A], a, y);
      expect(Math.abs(legDeg(p)) % 45).toBeCloseTo(0, 6);
    }
  });

  it("lands on the 10mm grid", () => {
    const p = snapPipePoint([A], 1803, 847);
    expect(p.a % 10).toBe(0);
    expect(p.y % 10).toBe(0);
  });

  it("keeps roughly the length the drag asked for", () => {
    // snapping rotates the leg onto the angle; it must not also stretch it
    const p = snapPipePoint([A], 940, 900);
    expect(Math.hypot(p.a - A.a, p.y - A.y)).toBeCloseTo(Math.hypot(40, 900), -1);
  });
});

describe("leaving a deliberate angle alone", () => {
  it("does not touch a leg that is nowhere near one", () => {
    const p = snapPipePoint([A], 1500, 900); // ~34°, between 0 and 45
    expect(p).toMatchObject({ a: 1500, y: 900, snapped: false });
  });

  it("snaps just inside the tolerance and not just outside it", () => {
    const len = 1000;
    const at = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      return snapPipePoint([A], A.a + Math.cos(r) * len, A.y + Math.sin(r) * len);
    };
    const tol = (PIPE_SNAP_RAD * 180) / Math.PI;
    expect(at(90 - tol + 1).snapped).toBe(true);
    expect(at(90 - tol - 1).snapped).toBe(false);
  });

  it("ignores an anchor it is sitting on top of", () => {
    // a leg 5mm long has no direction worth respecting; snapping it would fling the point
    expect(snapPipePoint([A], 903, 4).snapped).toBe(false);
  });

  it("passes the point through untouched when there is no anchor at all", () => {
    expect(snapPipePoint([], 1234, 567)).toMatchObject({ a: 1234, y: 567, snapped: false });
  });
});

describe("a bend, which has a leg on each side", () => {
  const prev: PipePoint = { a: 900, y: 0 };
  const next: PipePoint = { a: 2400, y: 900 };

  it("squares up against whichever leg it is closer to aligning", () => {
    // only ONE leg is near an angle here: too far along to be plumb above `prev`, but nearly
    // level with `next` — so that is the one that resolves, and the other is left as drawn
    const p = snapPipePoint([prev, next], 1400, 940);
    expect(p.y).toBe(900);
    expect(p.a).toBe(1400);
  });

  it("closes an L exactly, so both legs are true at once", () => {
    // the corner of an L: plumb above `prev` AND level with `next`
    const p = snapPipePoint([prev, next], 940, 890);
    expect(p.a).toBe(900);
    expect(p.y).toBe(900);
  });
});
