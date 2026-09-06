// PIPES, AND THE NOTCHES THEY FORCE INTO A CARCASS.
//
// A riser running up the face of the wall does not stop the kitchen going in — the shop cuts the
// back of the box around it. This app could not say that at all: a pipe was either a radiator
// (which blocks the wall) or nothing, and the notch travelled to the factory by phone call.
//
// The notch is DERIVED from the clash, so nothing is stored and nothing can go stale — the same
// doctrine as the фартук's socket holes.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { resolveLayout } from "../src/model/resolve";
import { backCutouts, cutoutsByCab, contourMm, PIPE_CLEARANCE } from "../src/model/cutouts";
import { GEOM } from "../src/model/layout";
import { DEFAULT_REVEAL } from "../src/model/runPlan";
import { pipeDiameter, pipeLength, pipePathOf, pipeSegments, type Pt, type Fitting } from "../src/model/room";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room = { points: ROOM, waterWall: null, layout: "i" as const, openings: [] };
/** run-local x → WALL x: a wall-to-wall run reserves the scribe reveal at its start */
const wx = (runLocal: number) => runLocal + DEFAULT_REVEAL;

const base = (x: number, w: number, extra: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "base", x, w, h: 720, run: 0, ...extra });

const pipe = (t: number, over: Partial<Fitting> = {}): Fitting => ({
  id: "pipe1",
  category: "plumbing",
  wall: 0,
  t,
  width: 110,
  kind: "riser-sewer",
  ...over,
});

const L = (cabs: Cabinet[]) => resolveLayout(cabs, room);
const cut = (cabs: Cabinet[], fittings: Fitting[]) => backCutouts(L(cabs), fittings);

/** the t that puts a fitting's centre at a given WALL x */
const tAt = (cabs: Cabinet[], wallX: number) => wallX / L(cabs).wallLen(0);

describe("a pipe notches the cabinet it stands behind", () => {
  it("cuts the box whose span it crosses, and only that one", () => {
    const cabs = [base(0, 800), base(800, 800), base(1600, 800)];
    // dead centre of the middle box (run-local 1200 → wall 1250)
    const got = cut(cabs, [pipe(tAt(cabs, wx(1200)))]);
    expect(got).toHaveLength(1);
    expect(got[0].cabId).toBe(cabs[1].id);
  });

  it("puts the notch where the pipe is, in the PANEL's own frame", () => {
    const cabs = [base(0, 800)];
    // centre of the box: run-local 400 → wall 450
    const got = cut(cabs, [pipe(tAt(cabs, wx(400)))]);
    const c = got[0].cuts[0];
    // 110 wide + 10 clearance a side = 130, centred on 400 → starts at 335
    expect(c.w).toBe(110 + 2 * PIPE_CLEARANCE);
    expect(c.x).toBe(400 - c.w / 2);
    expect(c.x + c.w).toBeLessThanOrEqual(got[0].panelW);
  });

  it("measures the panel as the CARCASS, not the module — a base's worktop is not cut", () => {
    const cabs = [base(0, 800)];
    const got = cut(cabs, [pipe(tAt(cabs, wx(400)))]);
    // plinth..carcass top, i.e. the box itself
    expect(got[0].panelH).toBe(720);
    const c = got[0].cuts[0];
    expect(c.y).toBe(0); // a floor riser starts below the box and is clipped to it
    expect(c.y + c.h).toBeLessThanOrEqual(got[0].panelH);
  });

  it("gives every box the pipe crosses its own notch", () => {
    const cabs = [base(0, 800), base(800, 800)];
    // straddle the joint: the pipe sits on run-local 800 → wall 850
    const got = cut(cabs, [pipe(tAt(cabs, wx(800)))]).sort((a, b) => (a.cabId < b.cabId ? -1 : 1));
    expect(got).toHaveLength(2);
    for (const g of got) expect(g.cuts).toHaveLength(1);
    // between them they account for the pipe's full width plus its clearance
    const total = got.reduce((w, g) => w + g.cuts[0].w, 0);
    expect(total).toBe(110 + 2 * PIPE_CLEARANCE);
  });

  it("leaves a clearance round the pipe — a notch cut to size does not go on", () => {
    const cabs = [base(0, 800)];
    const got = cut(cabs, [pipe(tAt(cabs, wx(400)), { width: 32 })]);
    expect(got[0].cuts[0].w).toBe(32 + 2 * PIPE_CLEARANCE);
  });

  it("names it, so the drawing says what the hole is for", () => {
    const cabs = [base(0, 800)];
    expect(cut(cabs, [pipe(tAt(cabs, wx(400)))])[0].cuts[0].label).toMatch(/стояк|Канализационный/i);
  });
});

describe("what does NOT cut a cabinet", () => {
  const cabs = [base(0, 800)];
  const at = tAt(cabs, wx(400));

  it("a socket — it sits behind the box; it is the фартук that gets the hole", () => {
    const socket: Fitting = { id: "s", category: "electric", wall: 0, t: at, width: 90, kind: "socket" };
    expect(cut(cabs, [socket])).toHaveLength(0);
  });

  it("a radiator — it blocks the wall rather than being built around", () => {
    const rad: Fitting = { id: "r", category: "heating", wall: 0, t: at, width: 600, kind: "rad-panel" };
    expect(cut(cabs, [rad])).toHaveLength(0);
  });

  it("a pipe on another wall", () => {
    expect(cut(cabs, [pipe(at, { wall: 2 })])).toHaveLength(0);
  });

  it("a pipe past the end of the run", () => {
    expect(cut(cabs, [pipe(tAt(cabs, wx(2000)))])).toHaveLength(0);
  });

  it("a WALL UNIT the riser stops below", () => {
    // a pipe boxed in at 900 high never reaches a cabinet hanging at 1520
    const upper = mk({ kind: "upper", x: 0, w: 800, h: 720, mountY: GEOM.upperBottom, run: 0 });
    const low = pipe(tAt([upper], wx(400)), { mountY: 450, height: 900 });
    expect(cut([upper], [low])).toHaveLength(0);
  });
});

describe("the helpers the consumers use", () => {
  it("indexes by module, so a renderer can just ask", () => {
    const cabs = [base(0, 800), base(800, 800)];
    const idx = cutoutsByCab(cut(cabs, [pipe(tAt(cabs, wx(400)))]));
    expect(idx.get(cabs[0].id)?.cuts).toHaveLength(1);
    expect(idx.get(cabs[1].id)).toBeUndefined();
  });

  it("totals the routed contour the quote bills", () => {
    expect(contourMm([{ x: 0, y: 0, w: 130, h: 720 }])).toBe(2 * (130 + 720));
    expect(contourMm([])).toBe(0);
  });
});

// ── A PIPE THAT IS NOT A FULL-HEIGHT RISER ─────────────────────────────────────────────────────
// Real flats have branches: a run that starts a metre up and stops, and pipes that lie ALONG the
// wall rather than climbing it. `width` is always the extent along the wall and `height` the extent
// up it, so both are the same rectangle read the other way round — which is what lets the notch
// derivation stay one piece of code.


describe("a pipe that runs part of the wall", () => {
  it("cuts only the height it actually occupies", () => {
    const cabs = [base(0, 800)];
    // a branch from 200 to 500 above the floor: 300 long, centred at 350
    const branch = pipe(tAt(cabs, wx(400)), { width: 32, height: 300, mountY: 350 });
    const got = cut(cabs, [branch]);
    const c = got[0].cuts[0];
    // 200..500 grown by the clearance is 190..510, and the panel's own zero is the plinth top
    expect(c.y).toBe(200 - PIPE_CLEARANCE - GEOM.plinth);
    expect(c.y + c.h).toBe(500 + PIPE_CLEARANCE - GEOM.plinth);
    // it is a window in the middle of the back, not a notch off its edge
    expect(c.y).toBeGreaterThan(0);
    expect(c.h).toBeLessThan(got[0].panelH);
  });

  it("misses a box it stops short of", () => {
    const cabs = [base(0, 800)];
    // a stub in the plinth zone only — below the carcass entirely
    const stub = pipe(tAt(cabs, wx(400)), { width: 32, height: 80, mountY: 40 });
    expect(cut(cabs, [stub])).toHaveLength(0);
  });
});

describe("a pipe laid ALONG the wall", () => {
  const horiz = (cabs: Cabinet[], at: number) =>
    pipe(at, { orient: "h", width: 1200, height: 50, mountY: 300 });

  it("cuts a wide, shallow notch instead of a tall narrow one", () => {
    const cabs = [base(0, 1600)];
    const got = cut(cabs, [horiz(cabs, tAt(cabs, wx(800)))]);
    const c = got[0].cuts[0];
    expect(c.w).toBe(1200 + 2 * PIPE_CLEARANCE);
    expect(c.h).toBe(50 + 2 * PIPE_CLEARANCE);
    expect(c.w).toBeGreaterThan(c.h);
  });

  it("reads its diameter and its run off the same two numbers", () => {
    const v = pipe(0.5, { width: 110, height: 2500 });
    expect(pipeDiameter(v)).toBe(110);
    expect(pipeLength(v)).toBe(2500);
    const h = pipe(0.5, { orient: "h", width: 1200, height: 50 });
    expect(pipeDiameter(h)).toBe(50);
    expect(pipeLength(h)).toBe(1200);
  });
});

// ── A BENT PIPE ────────────────────────────────────────────────────────────────────────────────
// A pipe comes up out of the floor, turns, and runs along under the counter. It is a PATH, and a
// plain riser is just a two-point one — which is what lets every consumer keep taking rectangles:
// a bend is not new geometry, it is one more segment.

describe("a pipe drawn as a path", () => {
  const bent = (over: Partial<Fitting> = {}): Fitting =>
    pipe(0, {
      width: 50,
      // up out of the floor at 600, turn at 400 high (inside a base carcass), run along to 2000
      path: [{ a: 600, y: 0 }, { a: 600, y: 400 }, { a: 2000, y: 400 }],
      ...over,
    });

  it("cuts a notch for EACH leg of the bend", () => {
    // one box wide enough to catch both legs
    const cabs = [base(0, 2400)];
    const got = cut(cabs, [bent()]);
    expect(got).toHaveLength(1);
    expect(got[0].cuts).toHaveLength(2);
  });

  it("makes the upright leg tall and narrow, and the run flat and wide", () => {
    const cabs = [base(0, 2400)];
    const [upright, along] = cut(cabs, [bent()])[0].cuts.sort((a, b) => a.w - b.w);
    expect(upright.w).toBe(50 + 2 * PIPE_CLEARANCE);
    expect(along.h).toBe(50 + 2 * PIPE_CLEARANCE);
    expect(along.w).toBeGreaterThan(upright.w);
    expect(upright.h).toBeGreaterThan(along.h);
  });

  it("does not lengthen a leg by its own diameter", () => {
    // the barrel's ends are FLAT and sit on the path's points — growing the box along the axis
    // would cut the cabinet for pipe that is not there
    const cabs = [base(0, 2400)];
    const along = cut(cabs, [bent()])[0].cuts.sort((a, b) => b.w - a.w)[0];
    expect(along.w).toBe(2000 - 600 + 2 * PIPE_CLEARANCE);
  });

  it("splits its legs across the boxes each one crosses", () => {
    const cabs = [base(0, 800), base(800, 800), base(1600, 800)];
    const got = cut(cabs, [bent()]);
    // the upright is in box 1; the horizontal run crosses all three
    expect(got.length).toBe(3);
    expect(got.reduce((n, g) => n + g.cuts.length, 0)).toBeGreaterThanOrEqual(4);
  });

  it("reads a straight pipe as the two-point path it always was", () => {
    const cabs = [base(0, 800)];
    const straight = cut(cabs, [pipe(tAt(cabs, wx(400)))]);
    expect(straight).toHaveLength(1);
    expect(straight[0].cuts).toHaveLength(1);
    expect(straight[0].cuts[0].w).toBe(110 + 2 * PIPE_CLEARANCE);
  });
});

// ── A PATH SUBSUMES THE STRAIGHT PIPE ──────────────────────────────────────────────────────────
// Pipes became paths after some were already saved as straight runs. `pipePathOf` is the one place
// that difference exists: everything downstream reads paths, so there is no second behaviour to
// keep in step and no migration to run.

describe("pipePathOf", () => {
  const WALL = 4000;

  it("turns a legacy vertical run into the two-point path it always was", () => {
    const riser = pipe(0.5, { width: 110, height: 2400, mountY: 1200 });
    expect(pipePathOf(riser, WALL)).toEqual([
      { a: 2000, y: 0 },
      { a: 2000, y: 2400 },
    ]);
  });

  it("turns a legacy horizontal run the other way", () => {
    const run = pipe(0.5, { orient: "h", width: 1200, height: 50, mountY: 300 });
    expect(pipePathOf(run, WALL)).toEqual([
      { a: 1400, y: 300 },
      { a: 2600, y: 300 },
    ]);
  });

  it("hands back a real path untouched", () => {
    const pts = [{ a: 100, y: 0 }, { a: 100, y: 800 }, { a: 900, y: 800 }];
    expect(pipePathOf(pipe(0.5, { path: pts }), WALL)).toBe(pts);
  });

  it("ignores a path too short to be one", () => {
    const one = pipe(0.5, { width: 110, height: 2400, mountY: 1200, path: [{ a: 5, y: 5 }] });
    expect(pipePathOf(one, WALL)).toHaveLength(2);
  });

  it("counts one segment per leg", () => {
    expect(pipeSegments(pipe(0.5, { path: [{ a: 0, y: 0 }, { a: 0, y: 500 }, { a: 800, y: 500 }] }), WALL)).toHaveLength(2);
    expect(pipeSegments(pipe(0.5, { width: 110, height: 2400, mountY: 1200 }), WALL)).toHaveLength(1);
  });
});
