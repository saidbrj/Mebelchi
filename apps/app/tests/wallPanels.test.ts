// ФАРТУК + the strip to the ceiling — the two flat panels that close a wall.
//
// Both are DERIVED (model/wallPanels.ts), so everything here asks the same question: given this
// kitchen, where does panel go and how tall is it? The cases that matter are the ones a real
// kitchen throws at it — a hood hanging lower than the wall units, a pantry column splitting the
// counter, a window in the splash zone, a low ceiling with one row of uppers.

import { describe, it, expect, vi } from "vitest";

// The 3D smoke test at the bottom builds a real THREE scene. PBR loads its textures through
// `document`, which does not exist in this (node) environment — so the textures are off here and
// the panels come out as flat materials. That changes their SURFACE, not their geometry, which is
// all these assertions are about.
vi.mock("../src/three/pbr", async (orig) => {
  const actual = await orig<typeof import("../src/three/pbr")>();
  return { ...actual, PBR: false, texturedMaterial: () => null };
});
// same story: the contact shadow is a canvas-painted decal
vi.mock("../src/three/contact", () => ({ contactShadow: () => {}, decalTexture: () => null, contactMaterial: () => null }));
import { mk, type Cabinet } from "../src/model/cabinet";
import { resolveLayout } from "../src/model/resolve";
import { HOOD_BOTTOM } from "../src/model/bands";
import { GEOM, effectiveStyle } from "../src/model/layout";
import {
  splashBands,
  closerBands,
  wallPanels,
  panelArea,
  DEFAULT_SPLASH,
  DEFAULT_CLOSER,
  DEFAULT_UNDERSIDE,
  undersideBands,
  type PanelBand,
} from "../src/model/wallPanels";
import { DEFAULT_REVEAL } from "../src/model/runPlan";
import { polygonBoundsMm, type Pt, type Fitting, type Opening } from "../src/model/room";
import { buildKitchen } from "../src/three/kitchen3d";
import { WALL_PAINT_OFFSET_M } from "../src/model/walls";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

const STYLE = { carcass: 0x111111, facade: 0x222222, worktop: 0x333333, handle: 0x444444, glassUppers: false };
const CEILING = 2700;
const room = { points: ROOM, waterWall: null, layout: "i" as const, openings: [] };

/** counter top = plinth + carcass + worktop */
const COUNTER = GEOM.plinth + 720 + GEOM.worktop; // 880

const base = (x: number, w: number, extra: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "base", x, w, h: 720, run: 0, ...extra });
const upper = (x: number, w: number, extra: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "upper", x, w, h: 720, mountY: GEOM.upperBottom, run: 0, ...extra });
/** a hood keeps its OWN mount height (HOOD_BOTTOM) — no mountY override */
const hood = (x: number, w: number): Cabinet =>
  mk({ kind: "upper", x, w, h: 720, run: 0, appliance: "hood" });

/** Run-local x → WALL x. A wall-to-wall run reserves the filler reveal at its start, so every
 *  module sits that much further along the wall than its own `x` says (model/resolve startOffset).
 *  Panels are derived in WALL space, so the expectations have to be too. */
const OFF = DEFAULT_REVEAL;
const wx = (runLocal: number) => runLocal + OFF;

const L = (cabs: Cabinet[]) => resolveLayout(cabs, room);
const splash = (cabs: Cabinet[], spec = DEFAULT_SPLASH, fittings: Fitting[] = []) =>
  splashBands(L(cabs), 0, spec, STYLE, CEILING, [], fittings);
const closer = (cabs: Cabinet[], ceiling = CEILING, spec = DEFAULT_CLOSER) =>
  closerBands(L(cabs), 0, ceiling, spec, STYLE);

/** The underside panel has its own describe block; the фартук / closer cases keep it off so their
 *  band counts stay about the thing they are testing. */
const OFF_UNDER = { ...DEFAULT_UNDERSIDE, on: false };
const under = (cabs: Cabinet[], spec = DEFAULT_UNDERSIDE) => undersideBands(L(cabs), 0, spec, STYLE);

const width = (b: PanelBand) => b.x1 - b.x0;
const height = (b: PanelBand) => b.y1 - b.y0;

describe("фартук — where the panel is", () => {
  it("runs from the worktop to the underside of the wall units", () => {
    const bands = splash([base(0, 800), upper(0, 800)]);
    expect(bands).toHaveLength(1);
    expect(bands[0].y0).toBe(COUNTER);
    expect(bands[0].y1).toBe(GEOM.upperBottom); // 1520 — no dead strip left above it
    expect(height(bands[0])).toBe(GEOM.upperBottom - COUNTER); // 640
  });

  it("is one panel across a row of cabinets, not one per cabinet", () => {
    const bands = splash([base(0, 600), base(600, 600), base(1200, 800), upper(0, 2000)]);
    expect(bands).toHaveLength(1);
    // 2000 of counter PLUS the scribe gap at the wall it reaches: the cabinets stop short of a side
    // wall, the panel does not (see reachWalls). Only the START here — the run is 4m, so the far end
    // is open wall, not a wall this counter butts.
    expect(width(bands[0])).toBe(2000 + OFF);
    expect(bands[0].x0).toBe(0);
  });

  it("falls back to the spec height where nothing hangs above", () => {
    const bands = splash([base(0, 800)]);
    expect(bands).toHaveLength(1);
    expect(height(bands[0])).toBe(DEFAULT_SPLASH.h); // 600
  });

  it("«fixed» keeps its height, but never runs into the cabinet above", () => {
    const spec = { ...DEFAULT_SPLASH, mode: "fixed" as const, h: 900 };
    // 900 of panel would reach 1780 — the wall unit hangs at 1520, so it stops there
    const bands = splash([base(0, 800), upper(0, 800)], spec);
    expect(bands[0].y1).toBe(GEOM.upperBottom);
    // with nothing above, the same spec gets its full 900
    expect(height(splash([base(0, 800)], spec)[0])).toBe(900);
  });

  it("emits nothing when it is switched off, or when there is no counter", () => {
    expect(splash([base(0, 800), upper(0, 800)], { ...DEFAULT_SPLASH, on: false })).toHaveLength(0);
    expect(splash([upper(0, 800)])).toHaveLength(0);
  });
});

describe("фартук — what breaks it up", () => {
  it("steps DOWN behind a hood and back up either side of it", () => {
    // the hood hangs at HOOD_BOTTOM, the wall units at 1520 — three panels, the middle one shorter
    const cabs = [
      base(0, 600),
      base(600, 600),
      base(1200, 600),
      upper(0, 600),
      hood(600, 600), // hangs at HOOD_BOTTOM, lower than the row
      upper(1200, 600),
    ];
    const bands = splash(cabs).sort((a, b) => a.x0 - b.x0);
    expect(bands).toHaveLength(3);
    // the first reaches the side wall across the scribe gap; the middle one is the hood's bay
    expect(bands.map(width)).toEqual([600 + OFF, 600, 600]);
    expect(bands[1].y1).toBeLessThan(bands[0].y1); // shorter behind the hood
    expect(bands[1].y1).toBe(HOOD_BOTTOM);
    expect(bands[0].y1).toBe(bands[2].y1);
  });

  it("holds ONE height across a gap in the wall units — it does not dip", () => {
    // uppers over the two ends, nothing over the middle. The панель must still be one straight
    // strip at the row's line: a фартук that steps down in the gap is not a thing any kitchen has.
    const cabs = [base(0, 600), base(600, 600), base(1200, 600), upper(0, 600), upper(1200, 600)];
    const bands = splash(cabs);
    expect(bands).toHaveLength(1);
    expect(bands[0].y1).toBe(GEOM.upperBottom);
    expect(width(bands[0])).toBe(1800 + OFF);
  });

  it("…but a hood, which really is lower, still steps it down", () => {
    const cabs = [base(0, 600), base(600, 600), base(1200, 600), upper(0, 600), hood(600, 600), upper(1200, 600)];
    const heights = splash(cabs).sort((a, b) => a.x0 - b.x0).map((b) => b.y1);
    expect(heights).toEqual([GEOM.upperBottom, HOOD_BOTTOM, GEOM.upperBottom]);
  });

  it("is cut in two by a floor-to-ceiling column", () => {
    const cabs = [
      base(0, 800),
      mk({ kind: "tall", x: 800, w: 600, h: 2100, run: 0 }),
      base(1400, 800),
      upper(0, 800),
      upper(1400, 800),
    ];
    const bands = splash(cabs).sort((a, b) => a.x0 - b.x0);
    expect(bands).toHaveLength(2);
    expect(bands[0].x1).toBeLessThanOrEqual(wx(800));
    expect(bands[1].x0).toBeGreaterThanOrEqual(wx(1400));
  });

  it("reaches BOTH side walls when the counter runs the whole wall", () => {
    // the cabinets give up a scribe gap at each end; the фартук takes it back, because nobody
    // fits a wall panel 50mm shy of the return wall
    const l = resolveLayout([base(0, 100)], room);
    const runLen = l.runs[0].len; // usable length, reveals already taken out
    const bands = splash([base(0, runLen), upper(0, runLen)]);
    expect(bands).toHaveLength(1);
    expect(bands[0].x0).toBe(0);
    expect(bands[0].x1).toBe(l.wallLen(0));
  });

  it("stops at a window instead of crossing the glass", () => {
    // a window sill at 900 sits in the splash zone — the panel must break around it
    const win: Opening = { id: "w1", kind: "window", wall: 0, t: 0.5, width: 1200, sill: 900, height: 1200, design: "twin", name: "Окно", desc: "" };
    const cabs = [base(0, 1000), base(1000, 1000), base(2000, 1000)];
    const l = resolveLayout(cabs, { ...room, openings: [win] });
    const bands = splashBands(l, 0, DEFAULT_SPLASH, STYLE, CEILING, [win], []).sort((a, b) => a.x0 - b.x0);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    // nothing overlaps the window's span
    const wallLen = l.wallLen(0);
    const wx0 = 0.5 * wallLen - 600;
    const wx1 = 0.5 * wallLen + 600;
    for (const b of bands) expect(Math.min(b.x1, wx1) - Math.max(b.x0, wx0)).toBeLessThanOrEqual(2);
  });
});

describe("фартук — sockets are cut out, not avoided", () => {
  const socket = (t: number): Fitting => ({ id: "s1", category: "electric", wall: 0, t, width: 90, kind: "socket", mountY: 1100 });

  it("punches a hole where a socket lands on the panel", () => {
    const cabs = [base(0, 2000), upper(0, 2000)];
    const bands = splash(cabs, DEFAULT_SPLASH, [socket(0.15)]);
    const withCut = bands.filter((b) => b.cuts.length > 0);
    expect(withCut).toHaveLength(1);
    const cut = withCut[0].cuts[0];
    expect(cut.w).toBeCloseTo(90, 0);
    expect(cut.h).toBeCloseTo(120, 0); // the electric default
    // panel-local, so it is inside the panel it belongs to
    expect(cut.x).toBeGreaterThanOrEqual(0);
    expect(cut.y).toBeGreaterThanOrEqual(0);
    expect(cut.y + cut.h).toBeLessThanOrEqual(height(withCut[0]) + 1);
  });

  it("does not split the panel — a socket is a hole, not a break", () => {
    const cabs = [base(0, 2000), upper(0, 2000)];
    expect(splash(cabs, DEFAULT_SPLASH, [socket(0.15)])).toHaveLength(1);
  });

  it("ignores a socket that sits above or below the panel", () => {
    const high: Fitting = { ...socket(0.15), mountY: 2400 };
    const bands = splash([base(0, 2000), upper(0, 2000)], DEFAULT_SPLASH, [high]);
    expect(bands.flatMap((b) => b.cuts)).toHaveLength(0);
  });
});

describe("до потолка — the closing panel", () => {
  it("closes the gap a single row of uppers leaves under a low ceiling", () => {
    // 2500 ceiling: uppers top out at 1520 + 720 = 2240 → a 260mm strip of dead wall
    const bands = closer([base(0, 800), upper(0, 800)], 2500);
    expect(bands).toHaveLength(1);
    expect(bands[0].y0).toBe(2240);
    expect(bands[0].y1).toBe(2500);
    expect(height(bands[0])).toBe(260);
  });

  it("emits nothing when the top row already meets the ceiling", () => {
    const tall = upper(0, 800, { h: CEILING - GEOM.upperBottom }); // reaches 2700 exactly
    expect(closer([base(0, 800), tall])).toHaveLength(0);
  });

  it("refuses a gap too big for a panel — that wall wants another ROW", () => {
    // 3600 ceiling, one row topping at 2240 → a 1360 gap, well past maxGap
    expect(closer([base(0, 800), upper(0, 800)], 3600)).toHaveLength(0);
  });

  it("still draws the small scribe gap the old render-only filler handled", () => {
    // an upper stopped 60mm short of the ceiling — the ≤120mm case that used to be the ONLY one
    const u = upper(0, 800, { h: CEILING - GEOM.upperBottom - 60 });
    const bands = closer([base(0, 800), u]);
    expect(bands).toHaveLength(1);
    expect(height(bands[0])).toBe(60);
  });

  it("takes the depth of the row under it, so a deep antresol gets a deep panel", () => {
    const deep = upper(0, 800, { depth: 560 });
    expect(closer([base(0, 800), deep], 2500)[0].depth).toBe(560);
    expect(closer([base(0, 800), upper(0, 800)], 2500)[0].depth).toBe(350);
  });

  it("steps with the row: a taller cabinet beside a shorter one gives two panels", () => {
    const cabs = [
      base(0, 600),
      base(600, 600),
      upper(0, 600, { h: 720 }), // tops at 2240
      upper(600, 600, { h: 900 }), // tops at 2420
    ];
    const bands = closer(cabs, 2600).sort((a, b) => a.x0 - b.x0);
    expect(bands).toHaveLength(2);
    expect(bands[0].y0).toBe(2240);
    expect(bands[1].y0).toBe(2420);
  });

  it("ignores the hood — it hangs at its own height and is not the top of the row", () => {
    const cabs = [base(0, 1200), upper(0, 600), hood(600, 600)];
    const bands = closer(cabs, 2500);
    // one panel, over the wall unit only; the hood's top is not a gap to close
    expect(bands).toHaveLength(1);
    expect(bands[0].y0).toBe(2240);
    expect(width(bands[0])).toBeLessThanOrEqual(600 + OFF + 4);
  });

  it("emits nothing when it is switched off", () => {
    expect(closer([base(0, 800), upper(0, 800)], 2500, { ...DEFAULT_CLOSER, on: false })).toHaveLength(0);
  });
});

describe("под навесными — one plane, not one box per cabinet", () => {
  it("is ONE panel across a row of wall units", () => {
    const bands = under([base(0, 1800), upper(0, 600), upper(600, 600), upper(1200, 600)]);
    expect(bands).toHaveLength(1);
    expect(width(bands[0])).toBe(1800 + OFF); // reaches the side wall, like the фартук
  });

  it("occupies exactly the space the bottom boards it replaces did", () => {
    const bands = under([upper(0, 1200)]);
    expect(bands[0].y0).toBe(GEOM.upperBottom);
    expect(bands[0].y1).toBe(GEOM.upperBottom + DEFAULT_UNDERSIDE.t);
  });

  it("gives a stacked antresol its OWN plane, at its own height", () => {
    const antresol = upper(0, 1200, { mountY: GEOM.upperBottom + 720, h: 400 });
    const bands = under([upper(0, 1200), antresol]).sort((a, b) => a.y0 - b.y0);
    expect(bands).toHaveLength(2);
    expect(bands[0].y0).toBe(GEOM.upperBottom);
    expect(bands[1].y0).toBe(GEOM.upperBottom + 720);
  });

  it("takes the row's depth, so a deep row gets a deep plane", () => {
    expect(under([upper(0, 1200, { depth: 560 })])[0].depth).toBe(560);
    expect(under([upper(0, 1200)])[0].depth).toBe(350);
  });

  it("breaks at a real hole in the row, but not at the joins", () => {
    // two units, then 900mm of nothing, then another — one plane each side, not one long one
    const bands = under([upper(0, 600), upper(600, 600), upper(2100, 600)]).sort((a, b) => a.x0 - b.x0);
    expect(bands).toHaveLength(2);
    expect(width(bands[0])).toBe(1200 + OFF);
    expect(bands[1].x0).toBeGreaterThanOrEqual(wx(2100) - 1);
  });

  it("ignores the hood — it has its own bottom at its own height", () => {
    const bands = under([upper(0, 600), hood(600, 600)]);
    expect(bands).toHaveLength(1);
    expect(width(bands[0])).toBeLessThanOrEqual(600 + OFF + 1);
  });

  it("takes the depth of the modules it is actually over, not the deepest in the row", () => {
    // a 350 row with one 560-deep unit in it: the plane steps, it does not wear 560 throughout —
    // that overhang stood a quarter of a metre out into the room
    const cabs = [upper(0, 600), upper(600, 600, { depth: 560 }), upper(1200, 600)];
    const bands = under(cabs).sort((a, b) => a.x0 - b.x0);
    expect(bands.map((b) => b.depth)).toEqual([350, 560, 350]);
  });

  it("leaves a CORNER unit alone — a flat plane cannot span a chamfered body", () => {
    // a corner upper's `depth` is its square's side (613), not the 350 of the row it butts, so
    // including it made the whole row's plane 613 deep and it stuck out of the corner
    const corner = mk({ kind: "upper", corner: true, px: 300, pz: 300, w: 613, depth: 613, h: 720, mountY: GEOM.upperBottom, run: 0 });
    const bands = under([upper(0, 1200), corner]);
    for (const b of bands) expect(b.depth).toBe(350);
  });

  it("emits nothing with no wall units, or switched off", () => {
    expect(under([base(0, 1200)])).toHaveLength(0);
    expect(under([upper(0, 1200)], OFF_UNDER)).toHaveLength(0);
  });
});

describe("wallPanels — the one call the 3D and the quote make", () => {
  it("returns both kinds across every run, with a real area to price", () => {
    const cabs = [base(0, 1200), upper(0, 1200)];
    const bands = wallPanels({
      L: resolveLayout(cabs, room),
      ceiling: 2500,
      specs: { splash: DEFAULT_SPLASH, closer: DEFAULT_CLOSER, underside: OFF_UNDER },
      style: STYLE,
    });
    expect(bands.some((b) => b.kind === "splash")).toBe(true);
    expect(bands.some((b) => b.kind === "closer")).toBe(true);
    for (const b of bands) {
      expect(panelArea(b)).toBeGreaterThan(0);
      expect(b.x1).toBeGreaterThan(b.x0);
      expect(b.y1).toBeGreaterThan(b.y0);
    }
    // 1.2m of counter, plus the scribe gap into the side wall, under 640mm of фартук
    const sp = bands.find((b) => b.kind === "splash")!;
    expect(panelArea(sp)).toBeCloseTo(((1200 + OFF) * (GEOM.upperBottom - COUNTER)) / 1e6, 4);
  });

  it("takes its decor from the style — «как столешница» by default", () => {
    const cabs = [base(0, 1200), upper(0, 1200)];
    const bands = wallPanels({
      L: resolveLayout(cabs, room),
      ceiling: 2500,
      specs: { splash: DEFAULT_SPLASH, closer: DEFAULT_CLOSER, underside: OFF_UNDER },
      style: STYLE,
    });
    expect(bands.find((b) => b.kind === "splash")!.color).toBe(STYLE.worktop);
    expect(bands.find((b) => b.kind === "closer")!.color).toBe(STYLE.facade);
  });
});

// ── THE 3D actually draws them ─────────────────────────────────────────────────────────────────
// The derivation being right is half the job; the other half is that buildKitchen puts a mesh
// where the band says. These check the seam between the two — a panel is drawn, it is drawn at the
// band's height, and switching the spec off draws nothing.

describe("buildKitchen draws the derived panels", () => {
  const build = (cabs: Cabinet[], ceiling: number, specs = { splash: DEFAULT_SPLASH, closer: DEFAULT_CLOSER, underside: OFF_UNDER }) => {
    const l = resolveLayout(cabs, room);
    const bands = wallPanels({ L: l, ceiling, specs, style: STYLE });
    const b = polygonBoundsMm(ROOM);
    const g = buildKitchen(
      cabs,
      l.runs.map((r) => ({ placement: r.placement, kind: r.kind, revealStart: r.revealStart, revealEnd: r.revealEnd })) as never,
      STYLE,
      { cx: b.cx, cy: b.cy },
      ceiling,
      bands,
    );
    // by their tag — the root also carries the side fillers («доборы»), which are not these
    return { bands, meshes: g.children.filter((o) => !!o.userData.panel) };
  };

  it("adds a mesh per band, centred on the band's height", () => {
    const cabs = [base(0, 1200), upper(0, 1200)];
    const { bands, meshes } = build(cabs, 2500);
    expect(bands.length).toBe(2); // one фартук, one closer
    expect(meshes.length).toBe(bands.length);
    for (const b of bands) {
      const y = (b.y0 + b.y1) / 2000;
      expect(meshes.some((m) => Math.abs(m.position.y - y) < 1e-6)).toBe(true);
    }
  });

  it("stands the фартук IN FRONT of the wall's paint, or it is never seen", () => {
    // The paint is a plane pushed WALL_PAINT_OFFSET_M into the room (it would z-fight with the wall
    // otherwise) and it is opaque and double-sided. A 6mm panel lying flat on the wall therefore
    // sat entirely BEHIND it: on a painted kitchen the splash zone showed the paint colour whatever
    // the panel was made of, and the toggle looked broken. This is that bug's headstone.
    const cabs = [base(0, 1200), upper(0, 1200)];
    const l = resolveLayout(cabs, room);
    const bands = wallPanels({
      L: l,
      ceiling: 2500,
      specs: { splash: DEFAULT_SPLASH, closer: { ...DEFAULT_CLOSER, on: false }, underside: OFF_UNDER },
      style: STYLE,
    });
    expect(bands).toHaveLength(1);
    const b = polygonBoundsMm(ROOM);
    const g = buildKitchen(
      cabs,
      l.runs.map((r) => ({ placement: r.placement, kind: r.kind, revealStart: r.revealStart, revealEnd: r.revealEnd })) as never,
      STYLE,
      { cx: b.cx, cy: b.cy },
      2500,
      bands,
    );
    const mesh = g.children.find((o) => o.userData.panel === "splash")!;
    expect(mesh).toBeTruthy();
    // how far the panel's CENTRE stands into the room, along the wall's inward normal
    const p = l.runs[bands[0].run].placement;
    const sC = (bands[0].x0 + bands[0].x1) / 2000;
    const into =
      (mesh.position.x - (p.ax + p.ux * sC)) * p.ix + (mesh.position.z - (p.az + p.uz * sC)) * p.iz;
    // its BACK face — centre less half its thickness — must clear the paint
    expect(into - DEFAULT_SPLASH.t / 2000).toBeGreaterThanOrEqual(WALL_PAINT_OFFSET_M - 1e-9);
  });

  it("draws nothing at all when both are switched off", () => {
    const cabs = [base(0, 1200), upper(0, 1200)];
    const { meshes } = build(cabs, 2500, {
      splash: { ...DEFAULT_SPLASH, on: false },
      closer: { ...DEFAULT_CLOSER, on: false },
      underside: OFF_UNDER,
    });
    expect(meshes).toHaveLength(0);
  });
});

// ── the panels wear what the CABINETS wear ──────────────────────────────────────────────────────
// «Применить ко всем» in the material picker writes a per-cabinet finish and never touches the
// run-wide style, so a kitchen can be all walnut while `style.facade` still says oak. A closing
// panel that took the style would then be visibly the wrong colour on every re-finished kitchen.

describe("effectiveStyle — what the kitchen is actually made of", () => {
  const finish = (c: Cabinet, part: "facade" | "carcass" | "worktop", v: number): Cabinet =>
    ({ ...c, finish: { ...c.finish, [part]: v } });

  it("follows the finish the cabinets actually carry", () => {
    const cabs = [finish(base(0, 600), "facade", 0x112233), finish(upper(0, 600), "facade", 0x112233)];
    expect(effectiveStyle(cabs, STYLE).facade).toBe(0x112233);
  });

  it("keeps the run style where nothing overrides it", () => {
    expect(effectiveStyle([base(0, 600)], STYLE).facade).toBe(STYLE.facade);
    expect(effectiveStyle([], STYLE)).toEqual(STYLE);
  });

  it("takes the MAJORITY, not the first — one odd door does not re-skin the kitchen", () => {
    const cabs = [
      finish(base(0, 600), "facade", 0xaaaaaa),
      finish(base(600, 600), "facade", 0xbbbbbb),
      finish(base(1200, 600), "facade", 0xbbbbbb),
    ];
    expect(effectiveStyle(cabs, STYLE).facade).toBe(0xbbbbbb);
  });

  it("ignores appliances — a fridge's steel panel is not a statement about the facade", () => {
    const fridge = { ...mk({ kind: "tall", x: 0, w: 600, h: 2100, run: 0, appliance: "fridge" }), finish: { facade: 0xd2d7da } } as unknown as Cabinet;
    const cabs = [finish(base(600, 600), "facade", 0xbbbbbb), fridge];
    expect(effectiveStyle(cabs, STYLE).facade).toBe(0xbbbbbb);
  });

  it("carries through to the panel colours", () => {
    const cabs = [finish(base(0, 1200), "worktop", 0x445566), finish(upper(0, 1200), "facade", 0x778899)];
    const eff = effectiveStyle(cabs, STYLE);
    const bands = wallPanels({
      L: resolveLayout(cabs, room),
      ceiling: 2500,
      specs: { splash: DEFAULT_SPLASH, closer: DEFAULT_CLOSER, underside: OFF_UNDER },
      style: eff,
    });
    expect(bands.find((b) => b.kind === "splash")!.color).toBe(0x445566);
    expect(bands.find((b) => b.kind === "closer")!.color).toBe(0x778899);
  });
});
