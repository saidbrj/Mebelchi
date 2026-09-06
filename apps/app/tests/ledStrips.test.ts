// THE LIGHT BUILT INTO THE FURNITURE.
//
// A strip's length is nobody's typed number — it is the length of the run it is screwed to. So
// every case here asks the same question the derivation does: given this kitchen, where is the
// light, how much of it is there, and what does it take to power it.
//
// The one that matters most: the under-cabinet strip and the underside panel are fixed to each
// other, so they must agree about where the row starts and stops. They share `hungSpans` for
// exactly that reason, and there is a test below that would fail if anyone copied it apart again.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { resolveLayout } from "../src/model/resolve";
import { GEOM } from "../src/model/layout";
import { DEFAULT_UNDERSIDE, undersideBands } from "../src/model/wallPanels";
import {
  ledStrips,
  ledMetres,
  psuCount,
  ledColor,
  stripLen,
  DEFAULT_LED,
  LED_WATTS_PER_M,
  PSU_WATTS,
  type LedSpec,
  type LedStrip,
} from "../src/model/ledStrips";
import type { Pt } from "../src/model/room";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const STYLE = { carcass: 0x111111, facade: 0x222222, worktop: 0x333333, handle: 0x444444, glassUppers: false };
const room = { points: ROOM, waterWall: null, layout: "i" as const, openings: [] };

const base = (x: number, w: number, extra: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "base", x, w, h: 720, run: 0, ...extra });
const upper = (x: number, w: number, extra: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "upper", x, w, h: 720, mountY: GEOM.upperBottom, run: 0, ...extra });

const L = (cabs: Cabinet[]) => resolveLayout(cabs, room);
/** every zone lit, so a case can assert on the one it is about without four fixtures */
const ALL: LedSpec = { ...DEFAULT_LED, under: true, plinth: true, cornice: true, interior: true };
const only = (zone: LedStrip["zone"], cabs: Cabinet[], spec: LedSpec = ALL) =>
  ledStrips(L(cabs), spec).filter((s) => s.zone === zone);

const KITCHEN = [base(0, 800), base(800, 800), upper(0, 800), upper(800, 800)];

describe("what gets lit", () => {
  it("runs one strip under a row of wall units", () => {
    const s = only("under", KITCHEN);
    expect(s).toHaveLength(1);
    expect(stripLen(s[0])).toBe(1600);
  });

  it("sits at the underside of the boxes, throwing down", () => {
    const [s] = only("under", KITCHEN);
    expect(s.y).toBe(GEOM.upperBottom);
    expect(s.dir).toBe("down");
  });

  it("lights nothing where there are no wall units", () => {
    expect(only("under", [base(0, 800), base(800, 800)])).toHaveLength(0);
  });

  it("breaks where the row breaks — a window is two strips, not one long one", () => {
    // a metre of clear wall between the two groups: no cabinet there to screw a profile to
    const s = only("under", [upper(0, 800), upper(1800, 800)]);
    expect(s).toHaveLength(2);
    expect(s.map(stripLen)).toEqual([800, 800]);
  });

  it("bridges a filler-width join — that is one continuous strip", () => {
    const s = only("under", [upper(0, 800), upper(850, 800)]);
    expect(s).toHaveLength(1);
    expect(stripLen(s[0])).toBe(1650);
  });
});

describe("agreeing with the panel it is screwed to", () => {
  it("starts and stops where the underside plane does", () => {
    // THE COUPLING: both read `hungSpans`. If someone copies that logic apart, the light ends up
    // hanging past the end of its own panel and this is what catches it.
    const cabs = [upper(0, 800), upper(800, 600), upper(2000, 800)];
    const strips = only("under", cabs).sort((a, b) => a.x0 - b.x0);
    const panels = undersideBands(L(cabs), 0, DEFAULT_UNDERSIDE, STYLE).sort((a, b) => a.x0 - b.x0);
    expect(strips).toHaveLength(2);
    // the panel reaches the side wall across the scribe; the strip stops at the real cabinets, so
    // compare the INNER edges — the join both of them have to agree about
    expect(strips[0].x1).toBe(panels[0].x1);
    expect(strips[1].x0).toBe(panels[panels.length - 1].x0);
  });

  it("is lit even when the underside PANEL is switched off", () => {
    // they share a line, not a switch: a shop that leaves the boxes' own bottom boards showing
    // still fits the light under them
    expect(only("under", KITCHEN, { ...ALL, under: true })).toHaveLength(1);
  });
});

describe("the other three zones", () => {
  it("puts the cornice strip on TOP of the wall units, throwing up", () => {
    const [s] = only("cornice", KITCHEN);
    expect(s.y).toBe(GEOM.upperBottom + 720);
    expect(s.dir).toBe("up");
  });

  it("lights only the TOP row — a strip under the row above it lights nothing", () => {
    const twoRows = [upper(0, 800), upper(0, 800, { mountY: GEOM.upperBottom + 760 })];
    const s = only("cornice", twoRows);
    expect(s).toHaveLength(1);
    expect(s[0].y).toBe(GEOM.upperBottom + 760 + 720);
  });

  it("runs the plinth strip along the toe-kick of what stands on the floor", () => {
    const s = only("plinth", KITCHEN);
    expect(s).toHaveLength(1);
    expect(stripLen(s[0])).toBe(1600);
    expect(s[0].y).toBe(GEOM.plinth);
    expect(s[0].dir).toBe("down");
  });

  it("does not put a plinth strip under a WALL unit", () => {
    expect(only("plinth", [upper(0, 800)])).toHaveLength(0);
  });

  it("lights the inside of a glazed unit, and only that unit", () => {
    const s = only("interior", [upper(0, 800, { front: "glass" }), upper(800, 800)]);
    expect(s).toHaveLength(1);
    expect(s[0].cabId).toBeTruthy();
    // inside the sides, not across them
    expect(stripLen(s[0])).toBeLessThan(800);
  });

  it("does not light the inside of a solid door", () => {
    expect(only("interior", KITCHEN)).toHaveLength(0);
  });

  it("does not light the inside of an appliance modelled `fill: open`", () => {
    // the sink base is `fill: "open"` and carries a real facade — it is not an open shelf
    expect(only("interior", [base(0, 800, { fill: "open", appliance: "sink" })])).toHaveLength(0);
  });
});

describe("the corner unit", () => {
  // THE BUG THIS PINS, reported from use: corner units got no light. `hungSpans` excludes them,
  // which is right for a flat PANEL — a rectangle across a chamfered prism is the wrong shape and
  // stands into the room — and wrong for a strip, which has no shape to get wrong. Reusing a filter
  // whose justification does not transfer is how the corner ended up dark under lit neighbours.
  // A corner unit is FREE-PLACED (px/pz) and sits in the zone both adjacent runs exclude — anchoring
  // one with `x`/`run` the way a straight unit is anchored produces a cabinet that is on no wall at
  // all, which is what the first version of this fixture did.
  const CORNER_ROOM = { points: ROOM, waterWall: null, layout: "l" as const, openings: [] };
  const cornerL = (): Cabinet[] => [
    mk({ kind: "upper", w: 613, h: 720, mountY: GEOM.upperBottom, run: 0, corner: true, px: 306, pz: 306 }),
    mk({ kind: "upper", x: 700, w: 800, h: 720, mountY: GEOM.upperBottom, run: 0 }),
  ];
  const cornerStrips = (zone: LedStrip["zone"]) =>
    ledStrips(resolveLayout(cornerL(), CORNER_ROOM), ALL)
      .filter((s) => s.zone === zone && s.run === 0)
      .sort((a, b) => a.x0 - b.x0);

  it("lights a corner wall unit", () => {
    expect(cornerStrips("under")).toHaveLength(2);
  });

  it("follows the unit's OWN front, not a line along the wall", () => {
    // THE SECOND BUG, also reported from use: the corner's strip was emitted in one run's wall
    // space, so it came out as a single straight bar hanging past the cabinet into the room. A
    // corner's face is a chamfer or an L; the flag is what tells the 3D to build it off the
    // cabinet's own footprint instead.
    const s = cornerStrips("under").find((x) => x.corner);
    expect(s).toBeTruthy();
    expect(s!.cabId).toBeTruthy();
  });

  it("measures the chamfer across the diagonal, not along the wall", () => {
    // an upper corner defaults to a 45° chamfer. Its reach is the square's side less the run depth
    // that butts it, and the face is the hypotenuse of that.
    const s = cornerStrips("under").find((x) => x.corner)!;
    expect(s.corner).toBe("diagonal");
    const reach = 613 - 350; // w − the 350 upper run butting it
    expect(stripLen(s)).toBeCloseTo(reach * Math.SQRT2, 0);
  });

  it("measures an L-shaped corner as BOTH of its arms", () => {
    const cabs = cornerL().map((c) => (c.corner ? { ...c, cornerShape: "l" as const } : c));
    const s = ledStrips(resolveLayout(cabs, CORNER_ROOM), ALL).find((x) => x.corner)!;
    expect(s.corner).toBe("l");
    expect(stripLen(s)).toBeCloseTo(2 * (613 - 350), 0);
  });

  it("is shorter than the cabinet is wide — the front is not the full square", () => {
    // the old wall-space version spanned the whole 613 square, which is why it stuck out
    const s = cornerStrips("under").find((x) => x.corner)!;
    expect(stripLen(s)).toBeLessThan(613);
  });

  it("puts a cornice strip on it too", () => {
    expect(cornerStrips("cornice")).toHaveLength(2);
  });

  it("lights ONE corner cabinet once, not once per wall it shows on", () => {
    // A corner unit belongs to the zone BOTH adjacent runs exclude, so it appears in two
    // elevations. Two strips would cross under one box and bill its length twice. A U kitchen is
    // where this actually happens — in an L the second run has nowhere to see it from.
    const U_ROOM = { points: ROOM, waterWall: null, layout: "u" as const, openings: [] };
    const cabs: Cabinet[] = [
      mk({ kind: "upper", w: 613, h: 720, mountY: GEOM.upperBottom, run: 0, corner: true, px: 306, pz: 306 }),
      upper(700, 800),
      mk({ kind: "upper", x: 700, w: 800, h: 720, mountY: GEOM.upperBottom, run: 1 }),
      mk({ kind: "upper", x: 700, w: 800, h: 720, mountY: GEOM.upperBottom, run: 2 }),
    ];
    const L2 = resolveLayout(cabs, U_ROOM);
    const id = cabs[0].id;
    const slots = L2.runs.filter((_, r) => L2.elevation(r).some((rc) => rc.id === id)).length;
    expect(slots).toBeGreaterThan(1); // the premise — if this stops holding, the dedupe is moot

    const lit = ledStrips(L2, ALL).filter((s) => s.zone === "under" && s.corner);
    expect(lit).toHaveLength(1);
  });

  it("still keeps corners OUT of the flat panels", () => {
    // the exclusion that is right stays right — the strip fix must not undo it
    const bands = undersideBands(resolveLayout(cornerL(), CORNER_ROOM), 0, DEFAULT_UNDERSIDE, STYLE);
    const lit = cornerStrips("under")[0];
    expect(bands.every((b) => b.x0 >= lit.x1 - 1)).toBe(true);
  });
});

describe("switching a zone off", () => {
  it("draws nothing at all when every zone is off", () => {
    const dark = { ...ALL, under: false, plinth: false, cornice: false, interior: false };
    expect(ledStrips(L(KITCHEN), dark)).toHaveLength(0);
  });

  it("defaults to the task light and nothing else", () => {
    const zones = new Set(ledStrips(L(KITCHEN), DEFAULT_LED).map((s) => s.zone));
    expect([...zones]).toEqual(["under"]);
  });
});

describe("what it takes to power it", () => {
  it("measures the reel in metres", () => {
    expect(ledMetres(only("under", KITCHEN))).toBeCloseTo(1.6, 6);
  });

  it("sizes the supply to the LOAD, so a long kitchen quotes more than one", () => {
    // a driver is rated in watts; you fit as many as the strip draws
    const perPsu = PSU_WATTS / LED_WATTS_PER_M; // metres one supply carries
    expect(psuCount(perPsu - 0.1)).toBe(1);
    expect(psuCount(perPsu + 0.1)).toBe(2);
  });

  it("quotes no supply for no strip", () => {
    expect(psuCount(0)).toBe(0);
  });

  it("always quotes one for any strip at all", () => {
    expect(psuCount(0.3)).toBe(1);
  });
});

describe("the colour on screen", () => {
  it("reads warm at 2700K and near-white at 5000K", () => {
    const blue = (c: number) => c & 0xff;
    expect(blue(ledColor(2700))).toBeLessThan(blue(ledColor(5000)));
  });

  it("walks between the anchors rather than jumping", () => {
    const b = (t: number) => ledColor(t) & 0xff;
    expect(b(3500)).toBeGreaterThan(b(3000));
    expect(b(3500)).toBeLessThan(b(4000));
  });

  it("holds at the ends instead of running off the table", () => {
    expect(ledColor(1000)).toBe(ledColor(2700));
    expect(ledColor(9000)).toBe(ledColor(6500));
  });
});

describe("strips too short to be worth fitting", () => {
  it("skips a sliver — it would still want its own profile and supply", () => {
    expect(only("under", [upper(0, 100)])).toHaveLength(0);
  });
});
