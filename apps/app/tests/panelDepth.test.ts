// A SHELF CUT SHALLOWER THAN ITS BOX.
//
// The app-side half of the per-role panel model. The pricing package has its own suite for the
// decomposition; what matters here is that the two AGREE — the 3D must draw the board the cut list
// orders, and «read it through the accessor, never the field» is the rule that keeps them together.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabDepth, panelDepthOf } from "../src/model/bands";
import { projectFromCabs } from "../src/model/toProject";
import { modulePanels, panelDepth, panelBanding } from "@mebelchi/pricing";

const MATS = {
  carcassId: "carcass",
  facadeId: "facade",
  worktopId: "worktop",
  edgeVisibleId: "e2",
  edgeHiddenId: "e04",
};
const base = (over: Partial<Cabinet> = {}) =>
  mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, fill: "shelves", count: 2, ...over });

describe("reading a role's depth", () => {
  it("is the carcass's own depth when nothing says otherwise", () => {
    expect(panelDepthOf(base(), "shelf")).toBe(cabDepth(base()));
  });

  it("takes the override when there is one", () => {
    expect(panelDepthOf(base({ panels: { shelf: { depthMm: 500 } } }), "shelf")).toBe(500);
  });

  it("holds a role that was never overridden at the full depth", () => {
    const c = base({ panels: { shelf: { depthMm: 500 } } });
    expect(panelDepthOf(c, "divider")).toBe(cabDepth(c));
  });

  it("refuses a board deeper than the box it lives in", () => {
    expect(panelDepthOf(base({ panels: { shelf: { depthMm: 900 } } }), "shelf")).toBe(cabDepth(base()));
  });

  it("follows the carcass when the CABINET's depth changes", () => {
    // the override is a depth, not a fraction — but it can never exceed the box, so a shallower
    // cabinet drags it down with it rather than leaving a shelf sticking out of the front
    const shallow = base({ depth: 400, panels: { shelf: { depthMm: 500 } } });
    expect(panelDepthOf(shallow, "shelf")).toBe(400);
  });
});

describe("the drawing and the cut list agree", () => {
  // THE WHOLE POINT of one accessor per side. If these two ever disagree, the shop cuts a board the
  // client was never shown.
  it("gives the engine the same number the 3D reads", () => {
    const c = base({ panels: { shelf: { depthMm: 480 } } });
    const [m] = projectFromCabs([c]).run;
    expect(panelDepth(m, "shelf")).toBe(panelDepthOf(c, "shelf"));
  });

  it("puts the shallow shelf on the cut list", () => {
    const c = base({ panels: { shelf: { depthMm: 480 } } });
    const [m] = projectFromCabs([c]).run;
    const shelves = modulePanels(m, MATS).filter((p) => p.part === "shelf");
    expect(shelves.length).toBeGreaterThan(0);
    expect(shelves.every((p) => p.widthMm === 480)).toBe(true);
  });

  it("carries nothing to the engine when nothing was overridden", () => {
    expect(projectFromCabs([base()]).run[0].panels).toBeUndefined();
  });
});

describe("banding reaches the engine", () => {
  it("carries a banding choice through to the module", () => {
    const c = base({ panels: { shelf: { banding: "none" } } });
    expect(projectFromCabs([c]).run[0].panels?.shelf?.banding).toBe("none");
  });

  it("bands a shelf's front edge by default, without storing anything", () => {
    // the default is the ENGINE's, not a value the app writes — an untouched cabinet stays clean
    expect(projectFromCabs([base()]).run[0].panels).toBeUndefined();
    expect(panelBanding(projectFromCabs([base()]).run[0], "shelf")).toBe("front");
  });
});
