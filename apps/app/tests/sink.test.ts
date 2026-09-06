// THE SINK, AND THE HOLE IT NEEDS.
//
// The app drew exactly one sink for its whole life: a rim sitting ON TOP of the worktop, which is
// what makes a sink накладная. So врезная, подстольная and integrated could not be expressed at
// all — a designer specifying an undermount stone sink got a drawing of the wrong sink.
//
// The mount is defined by how the bowl meets the CUT EDGE of the slab, so everything here is about
// that edge: how big the hole is, whether a rim covers it, and whether it fits in the cabinet at
// all. It is also a real machining operation, so the same derivation feeds the quote.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { constructionOf } from "../src/model/construction";
import {
  sinkOf,
  sinkHole,
  worktopCuts,
  cutContourMm,
  holePerimeter,
  isRimless,
  DEFAULT_SINK,
  SINK_RIM,
  SINK_RAIL,
  SINK_TAP_ZONE,
  SINK_BRIDGE,
  type SinkMount,
} from "../src/model/sink";

const sink = (over: Partial<Cabinet> = {}): Cabinet =>
  mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, appliance: "sink", fill: "open", ...over });

const withMount = (m: SinkMount, over: Partial<Cabinet> = {}) => sink({ sink: { mount: m }, ...over });

describe("reading the spec", () => {
  it("gives a sink cabinet the shop default when it has never been edited", () => {
    // a project saved before the spec existed still has a sink in it
    expect(sinkOf(sink())).toEqual(DEFAULT_SINK);
  });

  it("defaults to врезная, which is what a modern kitchen fits", () => {
    expect(DEFAULT_SINK.mount).toBe("inset");
  });

  it("lays the edit over the default rather than replacing it", () => {
    const s = sinkOf(sink({ sink: { mount: "undermount" } }))!;
    expect(s.mount).toBe("undermount");
    expect(s.w).toBe(DEFAULT_SINK.w); // untouched
  });

  it("says nothing about a module that is not a sink", () => {
    expect(sinkOf(mk({ kind: "base", x: 0, w: 800, h: 720, run: 0 }))).toBeNull();
    expect(sinkHole(mk({ kind: "base", x: 0, w: 800, h: 720, run: 0 }))).toBeNull();
  });
});

describe("the hole a rim covers, and the hole it does not", () => {
  it("cuts SMALLER than the bowl when a rim has to land on slab", () => {
    const h = sinkHole(withMount("inset"))!;
    expect(h.w).toBe(DEFAULT_SINK.w - 2 * SINK_RIM);
  });

  it("cuts the bowl EXACTLY when there is no rim to cover an overcut", () => {
    // подстольная shows the slab's own cut edge — an overcut is visible forever
    const h = sinkHole(withMount("undermount"))!;
    expect(h.w).toBe(DEFAULT_SINK.w);
  });

  it("treats integrated as rimless too", () => {
    expect(isRimless("integrated")).toBe(true);
    expect(isRimless("inset")).toBe(false);
    expect(sinkHole(withMount("integrated"))!.w).toBe(DEFAULT_SINK.w);
  });

  it("cuts one opening for a double bowl, not two holes", () => {
    // two wells under one opening is how a двойная мойка is actually made
    const one = sinkHole(sink({ w: 1200, sink: { bowls: 1, mount: "undermount" } }))!;
    const two = sinkHole(sink({ w: 1200, sink: { bowls: 2, mount: "undermount" } }))!;
    expect(two.w).toBe(one.w * 2 + SINK_BRIDGE);
  });
});

describe("making it fit the cabinet it is in", () => {
  it("leaves slab standing on both sides — a hole wider than the box is a box in two pieces", () => {
    const h = sinkHole(sink({ w: 450 }))!;
    expect(h.w).toBeLessThanOrEqual(450 - 2 * SINK_RAIL);
  });

  it("refuses to cut a cabinet too narrow to survive it", () => {
    expect(sinkHole(sink({ w: 150 }))).toBeNull();
  });

  it("leaves room BEHIND the bowl for the tap to stand in", () => {
    const h = sinkHole(sink())!;
    expect(h.cz - h.d / 2).toBeGreaterThanOrEqual(SINK_TAP_ZONE - 1);
  });

  it("keeps the front edge's lip", () => {
    const c = sink();
    const h = sinkHole(c)!;
    // 560 carcass + 20 overhang; the opening must not reach the front edge
    expect(h.cz + h.d / 2).toBeLessThan(560 + 20);
  });

  it("holds an offset bowl inside the rails instead of pushing it through the side", () => {
    // a drainer shoves the bowl sideways; asking for 400 in an 800 box cannot be granted
    const h = sinkHole(sink({ w: 800, sink: { offset: 400 } }))!;
    expect(Math.abs(h.cx) + h.w / 2).toBeLessThanOrEqual(800 / 2 - SINK_RAIL + 1);
  });

  it("honours an offset it CAN grant", () => {
    const h = sinkHole(sink({ w: 1000, sink: { offset: 80 } }))!;
    expect(h.cx).toBe(80);
  });
});

describe("what the shop has to cut", () => {
  it("bills the sink's opening as routed contour", () => {
    const cuts = worktopCuts([sink()]);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].kind).toBe("sink");
    expect(cutContourMm(cuts)).toBe(holePerimeter(sinkHole(sink())!));
  });

  it("counts a COOKTOP's opening too — it is the same operation", () => {
    // a kitchen quoted as though its hob sits on an uncut worktop is a kitchen quoted wrong
    const cuts = worktopCuts([mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, appliance: "cooktop" })]);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].kind).toBe("hob");
  });

  it("does not cut for an oven column — its glass is on the appliance, not in the slab", () => {
    expect(worktopCuts([mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, appliance: "hob" })])).toHaveLength(0);
  });

  it("cuts nothing for a plain cabinet", () => {
    expect(worktopCuts([mk({ kind: "base", x: 0, w: 800, h: 720, run: 0 })])).toHaveLength(0);
  });

  it("adds up across the run", () => {
    const cuts = worktopCuts([sink(), mk({ kind: "base", x: 800, w: 800, h: 720, run: 0, appliance: "cooktop" })]);
    expect(cuts).toHaveLength(2);
    expect(cutContourMm(cuts)).toBe(holePerimeter({ ...cuts[0], cx: 0, cz: 0 }) + holePerimeter({ ...cuts[1], cx: 0, cz: 0 }));
  });

  it("ignores free-standing furniture", () => {
    expect(worktopCuts([sink({ furniture: "table" })])).toHaveLength(0);
  });
});

describe("a box with a hole in its counter has no lid", () => {
  // THE BUG THIS PINS, found by looking at the render: the hole was cut in the worktop and the
  // carcass's full top board was still there under it, so you looked through a real opening at the
  // box's lid instead of into a basin. Fixed in `constructionOf` rather than in the 3D, because a
  // top board nobody can fit is also a board nobody should be CUTTING — the parts list was
  // ordering it too.

  it("builds a sink base on stretchers instead", () => {
    expect(constructionOf(sink()).topMode).toBe("stretchers");
  });

  it("does the same for a drop-in cooktop", () => {
    expect(constructionOf(mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, appliance: "cooktop" })).topMode).toBe(
      "stretchers",
    );
  });

  it("leaves an ordinary cabinet's top alone", () => {
    const plain = mk({ kind: "base", x: 0, w: 800, h: 720, run: 0 });
    expect(constructionOf(plain).topMode).not.toBe("stretchers");
  });

  it("still lets the module override it by hand", () => {
    // the shop standard is a default, not a rule — every other field here works this way
    expect(constructionOf(sink({ topMode: "none" })).topMode).toBe("none");
  });

  it("leaves an oven COLUMN alone — nothing is cut into its counter", () => {
    const oven = mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, appliance: "hob" });
    expect(constructionOf(oven).topMode).not.toBe("stretchers");
  });
});
