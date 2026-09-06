// LIFTING A MODULE OFF THE FLOOR.
//
// You could always slide a cabinet anywhere on the PLAN — the 2D drag and the 3D gizmo both write
// the same px/pz/rot transform. What you could never do is lift one: `mountY` meant "the bottom of
// the carcass" but only a WALL unit was allowed to have it, so a base or a tall was pinned to the
// floor with nothing that could say otherwise. That is the axis "I cannot put a cabinet exactly
// there" was actually about, and it is what «additional rows» needs.
//
// THE PLINTH IS THE THING A BASE STANDS ON. So the interesting cases here are not about the height
// at all: they are about what stops being true once a box is not standing on anything.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabBand, isFloating } from "../src/model/bands";
import { constructionOf } from "../src/model/construction";
import { GEOM } from "../src/model/layout";
import { projectFromCabs } from "../src/model/toProject";
import { hangingCount, groupCarcasses, DEFAULT_PRODUCTION } from "@mebelchi/pricing";

const base = (over: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, ...over });
const tall = (over: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "tall", x: 0, w: 600, h: 2100, run: 0, ...over });
const upper = (over: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "upper", x: 0, w: 800, h: 720, run: 0, ...over });

describe("what counts as lifted", () => {
  it("a floor module with a mount height is hung", () => {
    expect(isFloating(base({ mountY: 400 }))).toBe(true);
    expect(isFloating(tall({ mountY: 300 }))).toBe(true);
  });

  it("a floor module without one is standing", () => {
    expect(isFloating(base())).toBe(false);
  });

  it("a WALL unit is never «lifted» — hanging is all it ever does", () => {
    // it has always had a mountY; calling that floating would make every kitchen's uppers change
    expect(isFloating(upper({ mountY: 1520 }))).toBe(false);
  });
});

describe("where the box ends up", () => {
  it("puts a standing base on its plinth, exactly as before", () => {
    const b = cabBand(base());
    expect(b.y0).toBe(0);
    expect(b.carcass0).toBe(GEOM.plinth);
    expect(b.carcass1).toBe(GEOM.plinth + 720);
  });

  it("starts a lifted base AT its mount height, with nothing under it", () => {
    const b = cabBand(base({ mountY: 400 }));
    expect(b.y0).toBe(400); // the occupied band starts here — no plinth below
    expect(b.carcass0).toBe(400);
    expect(b.carcass1).toBe(400 + 720);
  });

  it("carries the worktop up with it", () => {
    expect(cabBand(base({ mountY: 400 })).y1).toBe(400 + 720 + GEOM.worktop);
  });

  it("lifts a tall the same way", () => {
    const b = cabBand(tall({ mountY: 300 }));
    expect(b.y0).toBe(300);
    expect(b.carcass1).toBe(300 + 2100);
  });

  it("leaves a wall unit's meaning untouched", () => {
    const b = cabBand(upper({ mountY: 1520 }));
    expect(b.y0).toBe(1520);
    expect(b.carcass0).toBe(1520);
  });
});

describe("what stops being true when it is not standing", () => {
  it("a hung box is not built on a plinth", () => {
    // the shop must not cut a toe-kick for a box with nothing under it
    expect(constructionOf(base({ mountY: 400 })).plinthMode).toBe("none");
  });

  it("a standing box keeps the shop's plinth", () => {
    expect(constructionOf(base()).plinthMode).not.toBe("none");
  });

  it("still lets the module override it by hand", () => {
    expect(constructionOf(base({ mountY: 400, plinthMode: "legs" })).plinthMode).toBe("legs");
  });
});

describe("what has to be bought instead", () => {
  const hangersFor = (c: Cabinet) => {
    const boxes = groupCarcasses(projectFromCabs([c]).run);
    return hangingCount(boxes[0], DEFAULT_PRODUCTION);
  };

  it("buys навесы for a base that hangs — nothing else is holding it up", () => {
    // quoting a wall-hung cabinet without brackets is quoting one nobody can fit
    expect(hangersFor(base({ mountY: 400 }))).toBeGreaterThan(0);
  });

  it("buys none for a base that stands on the floor", () => {
    expect(hangersFor(base())).toBe(0);
  });

  it("leaves a wall unit's hangers exactly as they were", () => {
    expect(hangersFor(upper())).toBeGreaterThan(0);
  });

  it("marks the module as hung so the quote can see it at all", () => {
    const [m] = projectFromCabs([base({ mountY: 400 })]).run;
    expect(m.hung).toBe(true);
    expect(projectFromCabs([base()]).run[0].hung).toBeUndefined();
  });
});
