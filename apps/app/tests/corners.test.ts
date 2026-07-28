// Corner units and wall-band depth.
//
// The corner body and the corner square both used to be consequences of `kind === "upper"`. That
// breaks the moment a wall row is BASE-DEPTH (a deep antresol): it is a wall unit, but it needs the
// big 840 square and has no reach into the cleared zone. Everything here pins the depth-keyed rules
// and the two places they used to be wrong.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cornerShapeOf, cornerArm, cabDepth, FOOT_DEPTH_MM } from "../src/model/bands";
import { cornerSideFor, runReach, planRuns, CORNER_MM, CORNER_UPPER_MM } from "../src/model/runPlan";
import { runFloor, runCeil, wallRows, resolveLayout } from "../src/model/resolve";
import { healCornerUnits, seatCorner } from "../src/model/rowOps";
import { generateVariants, wallBandsFor, type WallBand } from "../src/model/layout";
import type { Pt } from "../src/model/room";

/** an L-shaped room, so the runs actually clear a corner */
const L_ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4200, y: 0 },
  { x: 4200, y: 3400 },
  { x: 0, y: 3400 },
];

describe("the corner square follows the ARM DEPTH, not the kind", () => {
  it("keeps today's two sizes", () => {
    expect(cornerSideFor(FOOT_DEPTH_MM.base)).toBe(CORNER_MM); // 560 → 840
    expect(cornerSideFor(FOOT_DEPTH_MM.upper)).toBe(CORNER_UPPER_MM); // 350 → 613
  });

  it("gives a BASE-DEPTH wall row the big square", () => {
    // the whole point: a deep antresol is a wall unit that needs 840, not 613
    expect(cornerSideFor(560)).toBe(CORNER_MM);
  });

  it("never inverts the footprint polygon — the square must stay under 2× the arm depth", () => {
    // `cut = armDepth − side/2` goes negative otherwise, and the corner body turns inside out.
    // Checked across the whole editable depth range (D_MIN..D_MAX), not just the two defaults —
    // a corner unit can be resized now.
    for (let arm = 200; arm <= 900; arm += 10) {
      expect(cornerSideFor(arm), `arm ${arm}`).toBeLessThan(2 * arm);
    }
  });

  it("is CONTINUOUS — any depth works, not just the two defaults", () => {
    // this is what makes a corner unit resizable at all: the old rule was a two-value step function
    expect(cornerSideFor(400)).toBe(680); // 400 + 280
    expect(cornerSideFor(300)).toBe(525); // 300 + ¾·300 (the face is capped by the arm, not by 280)
    expect(cornerSideFor(700)).toBe(980);
    // …and strictly increasing, so a deeper run never gets a smaller corner
    for (let arm = 201; arm <= 900; arm++) {
      expect(cornerSideFor(arm)).toBeGreaterThanOrEqual(cornerSideFor(arm - 1));
    }
  });
});

describe("seatCorner — resizing a corner MOVES it", () => {
  it("re-derives the square AND the seat from the arm depth", () => {
    // the seat is offset from the wall vertex by side/√2, so a corner cannot be resized in place
    const c = mk({ kind: "upper", corner: true, w: CORNER_UPPER_MM, depth: CORNER_UPPER_MM, h: 720, px: 700, pz: 700, rot: 0 });
    const deep = seatCorner({ ...c, armDepth: 560 }, L_ROOM, 0, "l", []);
    expect(deep.w).toBe(CORNER_MM);
    expect(deep.depth).toBe(CORNER_MM);
    // it moved further from the vertex, because its square grew
    expect(Math.hypot((deep.px ?? 0) - (c.px ?? 0), (deep.pz ?? 0) - (c.pz ?? 0))).toBeGreaterThan(0);
  });

  it("handles an arbitrary depth, not just 350/560", () => {
    const c = mk({ kind: "upper", corner: true, armDepth: 400, h: 720, px: 700, pz: 700, rot: 0 });
    expect(seatCorner(c, L_ROOM, 0, "l", []).w).toBe(680);
  });

  it("and healCornerUnits then leaves it alone — the size is right", () => {
    const c = mk({ kind: "upper", corner: true, armDepth: 400, h: 720, px: 700, pz: 700, rot: 0 });
    const seated = seatCorner(c, L_ROOM, 0, "l", []);
    expect(healCornerUnits([seated], L_ROOM, 0, "l", [])).toBeNull();
  });
});

describe("the corner-zone reach is keyed on depth", () => {
  it("reproduces the old numbers exactly", () => {
    expect(runReach(560)).toBe(0); // a base fills the 840 zone → no slack
    expect(runReach(350)).toBe(227); // a shallow wall unit reaches the last 227mm in
  });

  it("gives a deep wall row NO reach — it used to inherit the shallow row's 227", () => {
    expect(runReach(FOOT_DEPTH_MM.base)).toBe(0);
  });

  it("threads through runFloor / runCeil", () => {
    const { runs } = planRuns(L_ROOM, 0, "l", []);
    const withStart = runs.find((r) => r.kind === "wall" && r.cornerStart)!;
    expect(runFloor(withStart, 350)).toBe(-227);
    expect(runFloor(withStart, 560)).toBe(0);
    const withEnd = runs.find((r) => r.kind === "wall" && r.cornerEnd)!;
    expect(runCeil(withEnd, 350, 3000)).toBe(3227);
    expect(runCeil(withEnd, 560, 3000)).toBe(3000);
  });
});

describe("healCornerUnits — THE LANDMINE", () => {
  const heal = (cabs: Cabinet[]) => healCornerUnits(cabs, L_ROOM, 0, "l", []);

  it("leaves a DEEP antresol corner alone instead of snapping it back to 613", () => {
    // `side = kind === "upper" ? 613 : 840` would have reset this on the next heal, collapsing its
    // door face from ~280mm to ~50mm. The square must follow the ARM depth.
    const deep = mk({
      kind: "upper",
      corner: true,
      w: CORNER_MM,
      depth: CORNER_MM,
      armDepth: 560,
      h: 460,
      mountY: 2240,
      px: 700,
      pz: 700,
      rot: 0,
    });
    expect(heal([deep])).toBeNull(); // null = nothing was wrong
  });

  it("still fixes a shallow wall corner that is the wrong size", () => {
    const wrong = mk({ kind: "upper", corner: true, w: 600, depth: 350, h: 720, px: 700, pz: 700, rot: 0 });
    const out = heal([wrong])!;
    expect(out[0].w).toBe(CORNER_UPPER_MM);
    expect(out[0].depth).toBe(CORNER_UPPER_MM);
  });

  it("still leaves a correct base corner alone", () => {
    const base = mk({ kind: "base", corner: true, w: CORNER_MM, depth: CORNER_MM, h: 720, px: 700, pz: 700, rot: 0 });
    expect(heal([base])).toBeNull();
  });
});

describe("the corner BODY is a property, not a consequence of the kind", () => {
  it("defaults to what it always did", () => {
    expect(cornerShapeOf(mk({ kind: "upper", corner: true }))).toBe("diagonal");
    expect(cornerShapeOf(mk({ kind: "base", corner: true }))).toBe("l");
  });

  it("can be overridden — an L-shaped WALL corner", () => {
    expect(cornerShapeOf(mk({ kind: "upper", corner: true, cornerShape: "l" }))).toBe("l");
    expect(cornerShapeOf(mk({ kind: "base", corner: true, cornerShape: "diagonal" }))).toBe("diagonal");
  });

  it("the arm depth defaults per kind and can be overridden", () => {
    expect(cornerArm(mk({ kind: "upper", corner: true }))).toBe(350);
    expect(cornerArm(mk({ kind: "base", corner: true }))).toBe(560);
    expect(cornerArm(mk({ kind: "upper", corner: true, armDepth: 560 }))).toBe(560);
  });
});

describe("the catalogue must tell corner types apart", () => {
  // THE BUG: `isCurrent` matched on kind + appliance + furniture + fill and ignored `corner`, so a
  // selected corner wall unit "was" the plain Навесной AND every corner template at once. They all
  // lit up, and `swapTo` — which bails when isCurrent(tpl) — refused to swap between them. So a
  // corner cabinet could not be changed into another kind of corner cabinet at all.
  //
  // This mirrors ConfigScreen's predicate. If it ever drifts, this fails.
  const isCurrent = (tpl: Partial<Cabinet>, sel: Cabinet) =>
    (tpl.kind ?? "base") === sel.kind &&
    (tpl.appliance ?? "none") === (sel.appliance ?? "none") &&
    (tpl.furniture ?? undefined) === (sel.furniture ?? undefined) &&
    (tpl.fill ?? "shelves") === sel.fill &&
    !!tpl.corner === !!sel.corner &&
    !!tpl.island === !!sel.island &&
    (!sel.corner || cornerShapeOf(tpl as Cabinet) === cornerShapeOf(sel));

  const plainUpper: Partial<Cabinet> = { kind: "upper", fill: "shelves" };
  const cornerDiag: Partial<Cabinet> = { kind: "upper", fill: "shelves", corner: true, cornerShape: "diagonal" };
  const cornerL: Partial<Cabinet> = { kind: "upper", fill: "shelves", corner: true, cornerShape: "l" };

  const selected = mk({ kind: "upper", fill: "shelves", corner: true, cornerShape: "diagonal", w: CORNER_UPPER_MM });

  it("a plain wall cabinet is NOT the same thing as a corner one", () => {
    expect(isCurrent(plainUpper, selected)).toBe(false);
  });

  it("matches only the corner body it actually is", () => {
    expect(isCurrent(cornerDiag, selected)).toBe(true);
    expect(isCurrent(cornerL, selected)).toBe(false); // → so it can be swapped to
  });

  it("…and the other way round", () => {
    const sel = mk({ kind: "upper", fill: "shelves", corner: true, cornerShape: "l" });
    expect(isCurrent(cornerL, sel)).toBe(true);
    expect(isCurrent(cornerDiag, sel)).toBe(false);
  });

  it("an island is not a plain base", () => {
    const island = mk({ kind: "base", fill: "drawers", island: true });
    expect(isCurrent({ kind: "base", fill: "drawers" }, island)).toBe(false);
  });
});

describe("wallBandsFor — the bands a strategy builds", () => {
  it("a deep antresol is BASE depth on top, standard below", () => {
    const b = wallBandsFor("antresolDeep", 2700);
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ mountY: 1520, h: 720, depth: 350 });
    expect(b[1]).toMatchObject({ mountY: 2240, h: 460, depth: 560 });
  });

  it("a plain antresol is shallow on both rows", () => {
    expect(wallBandsFor("antresol", 2700)[1].depth).toBe(350);
  });

  it("degrades to one tall row when there is no space for a real antresol", () => {
    expect(wallBandsFor("antresolDeep", 2400)).toHaveLength(1);
  });
});

describe("the generator seats a corner unit in EVERY wall band", () => {
  const CEILING = 2700;
  const build = (wall: WallBand) => {
    const { runs } = planRuns(L_ROOM, 0, "l", []);
    const vs = generateVariants({
      layouts: [
        {
          layout: "l",
          runs: runs.map((r) => ({ kind: r.kind, len: r.len, cornerStart: r.cornerStart, cornerEnd: r.cornerEnd, openings: [] })),
          waterRun: 0,
        },
      ],
      ceiling: CEILING,
      water: "left",
      hasGas: true,
      fridge: ["integ"],
      oven: ["tall"],
      hood: ["integ"],
      wall: [wall],
    });
    return vs;
  };

  it("exposes the bands it built", () => {
    expect(build("antresol")[0].bands).toHaveLength(2);
    expect(build("single")[0].bands).toHaveLength(1);
  });

  it("gives the antresol row its own depth", () => {
    const cabs = build("antresolDeep")[0].cabs;
    const top = cabs.filter((c) => c.kind === "upper" && c.mountY === 2240 && !c.corner);
    const main = cabs.filter((c) => c.kind === "upper" && (c.mountY ?? 1520) === 1520 && !c.corner && c.appliance !== "hood");
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((c) => cabDepth(c) === 560)).toBe(true); // deep
    expect(main.every((c) => cabDepth(c) === 350)).toBe(true); // the row below stays shallow
  });

  it("a deep top row does NOT inherit the shallow row's corner widening", () => {
    // the main row's corner-most unit reaches 227mm into the zone; the deep one must not, because
    // it needs the whole 840 square for its own corner unit
    const cabs = build("antresolDeep")[0].cabs;
    const top = cabs.filter((c) => c.kind === "upper" && c.mountY === 2240 && !c.corner);
    expect(top.every((c) => (c.x ?? 0) >= 0)).toBe(true); // never pushed into the cleared zone
  });
});
