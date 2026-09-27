import { describe, it, expect } from "vitest";
import { start, run, joints } from "../kernel";
import { computeDrillMarks } from "./drillMarks";
import { parts } from "./model";

describe("drill marks with different joint methods", () => {
  it("computes drill marks for confirmat, minifix (eccentric), and dowel", () => {
    let s = start();
    s = run(s, { word: "CUBE", w: 600, h: 720, d: 350 }).session;
    s = run(s, {
      word: "PATTERN",
      op: "create",
      space: "S1",
      axis: "y",
      gaps: [{ ratio: 1 }, { ratio: 1 }],
      member: "shelf",
    }).session;

    // Test default confirmat
    const allParts = parts(s);
    const jointList1 = joints(s);
    const drills1 = computeDrillMarks(allParts, jointList1, 0);
    expect(drills1.length).toBeGreaterThan(0);
    expect(drills1.some((d) => d.type === "confirmat")).toBe(true);

    // Switch one joint to eccentric (minifix)
    const shelfJoint = jointList1.find((j) => j.id.includes("P5"))!;
    const r1 = run(s, {
      word: "SCOPE",
      joint: [shelfJoint.a, shelfJoint.b],
      key: "method",
      value: "eccentric",
    });
    expect(r1.result.accepted).toBe(true);

    const jointList2 = joints(r1.session);
    const drills2 = computeDrillMarks(allParts, jointList2, 0);
    expect(drills2.some((d) => d.type === "minifix")).toBe(true);
    expect(drills2.some((d) => d.type === "dowel" && d.label.includes("Шток"))).toBe(true);

    // Switch to dowel
    const r2 = run(r1.session, {
      word: "SCOPE",
      joint: [shelfJoint.a, shelfJoint.b],
      key: "method",
      value: "шкант-8",
    });
    expect(r2.result.accepted).toBe(true);

    const jointList3 = joints(r2.session);
    const drills3 = computeDrillMarks(allParts, jointList3, 0);
    expect(drills3.some((d) => d.type === "dowel" && d.label.includes("Шкант"))).toBe(true);

    // Switch top joint (P1×P4) to eccentric and toggle through to P4
    const topJoint = jointList1.find((j) => j.id === "P1×P4")!;
    const r3 = run(s, { word: "SCOPE", joint: [topJoint.a, topJoint.b], key: "method", value: "eccentric" });
    const r4 = run(r3.session, { word: "SCOPE", joint: [topJoint.a, topJoint.b], key: "through", value: "P4" });
    const drills4 = computeDrillMarks(allParts, joints(r4.session), 0);
    const topCams = drills4.filter((d) => d.jointId === "P1×P4" && d.type === "minifix");
    expect(topCams.length).toBe(2);
    // Cams must be inside the cabinet (x > 16 mm, not negative)
    for (const cam of topCams) {
      expect(cam.x).toBeGreaterThan(16);
      expect(cam.x).toBeLessThan(500);
    }
  });
});
