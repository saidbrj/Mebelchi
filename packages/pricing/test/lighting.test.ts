// THE LIGHT BUILT INTO THE CABINETRY, in the quote.
//
// LED is standard on a modern kitchen and it is a real invoice line — strip off a reel, the
// aluminium profile it sits in, a driver sized to the load, and a sensor if the client wants one.
// Until now the rate table could not even express it: `HardwareRate` had a price per UNIT and
// nothing else, so anything sold by the metre had no way to be quoted.
//
// The engine does not know where a cabinet is and must not learn. The app derives the strips from
// the layout (apps/app model/ledStrips.ts) and hands METRES down — the same split the flat panels
// use, for the same reason.

import { describe, it, expect } from "vitest";
import type { Project, ProjectLighting } from "../../schema/src/index.js";
import { priceProject, buildBom, seedRateTable, DEFAULT_HARDWARE_SKUS } from "../src/index.js";

const LDSP = "cca8dc43-3ec6-4c8c-980d-05bf4625cc16";
const MDF = "1d2c7bbe-c4c8-4f08-a1b7-85a55823c545";
const WORKTOP = "e8b5f6db-2fec-4e55-a3e0-8205087a2ad9";
const EDGE_2MM = "3f5c7d17-561b-4d84-bb87-4367cfcb769d";
const EDGE_04MM = "ea86c841-0136-43ea-b06e-8fa8f5977408";

const kitchen = (lighting?: ProjectLighting): Project => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "one base cabinet",
  ownerId: "00000000-0000-4000-8000-0000000000aa",
  units: "mm",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  schemaVersion: 1,
  space: { source: "manual", shape: "i", wallLength: 3000, ceilingHeight: 2500, waterWall: "left", constraints: [] },
  run: [
    {
      id: "mod-1",
      kind: "base",
      w: 600,
      h: 720,
      d: 560,
      fill: "shelves",
      count: 1,
      dividers: 0,
      door: { style: "flat" },
      handle: { type: "bar" },
    },
  ],
  ...(lighting ? { lighting } : {}),
  materials: { carcassId: LDSP, facadeId: MDF, worktopId: WORKTOP, edgeVisibleId: EDGE_2MM, edgeHiddenId: EDGE_04MM },
  pricing: { rateTableId: seedRateTable.id, snapshotAt: "2026-08-30T00:00:00.000Z" },
});

const lit = (over: Partial<ProjectLighting> = {}): ProjectLighting => ({
  metres: 3.2,
  profileM: 3.2,
  psu: 1,
  sensors: 0,
  ...over,
});

const line = (p: Project, ref: string) => buildBom(p).find((l) => l.kind === "hardware" && l.ref === ref);
const priced = (p: Project, ref: string) =>
  priceProject(p, seedRateTable).lines.find((l) => l.kind === "hardware" && l.ref === ref);

describe("a project with no lighting prices exactly as before", () => {
  it("adds no lines and moves no total", () => {
    const bare = priceProject(kitchen(), seedRateTable);
    const dark = priceProject(kitchen(lit({ metres: 0, profileM: 0, psu: 0 })), seedRateTable);
    expect(dark.total).toBe(bare.total);
    expect(dark.lines.length).toBe(bare.lines.length);
  });
});

describe("the strip is billed by the METRE", () => {
  it("carries the metres as its quantity, not a piece count", () => {
    const l = line(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledStrip);
    expect(l).toMatchObject({ qty: 3.2, unit: "m" });
  });

  it("reads the per-metre rate, not the per-unit one", () => {
    // THE SCHEMA CHANGE THIS FEATURE NEEDED. A hinge is priced per hinge; a reel is priced per
    // metre. Reusing one field for both would make the quote's own unit column a lie.
    const rate = Object.values(seedRateTable.hardware).find((h) => h.sku === DEFAULT_HARDWARE_SKUS.ledStrip)!;
    expect(rate.pricePerM).toBeGreaterThan(0);
    expect(priced(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledStrip)!.rate).toBe(rate.pricePerM);
  });

  it("charges metres × the per-metre rate", () => {
    const rate = Object.values(seedRateTable.hardware).find((h) => h.sku === DEFAULT_HARDWARE_SKUS.ledStrip)!;
    expect(priced(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledStrip)!.amount).toBeCloseTo(3.2 * rate.pricePerM!, 6);
  });

  it("bills the profile by the metre too", () => {
    expect(line(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledProfile)).toMatchObject({ qty: 3.2, unit: "m" });
  });

  it("leaves a per-unit item reading its per-unit price", () => {
    // the change must not leak: a hinge is still a hinge
    const hinge = priceProject(kitchen(lit()), seedRateTable).lines.find(
      (l) => l.kind === "hardware" && l.ref === DEFAULT_HARDWARE_SKUS.hinge,
    );
    const rate = Object.values(seedRateTable.hardware).find((h) => h.sku === DEFAULT_HARDWARE_SKUS.hinge)!;
    expect(hinge!.rate).toBe(rate.pricePerUnit);
  });
});

describe("the electronics", () => {
  it("quotes the drivers it was handed", () => {
    expect(line(kitchen(lit({ psu: 2 })), DEFAULT_HARDWARE_SKUS.ledPsu)).toMatchObject({ qty: 2, unit: "unit" });
  });

  it("quotes a sensor only when there is one", () => {
    expect(line(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledSensor)).toBeUndefined();
    expect(line(kitchen(lit({ sensors: 2 })), DEFAULT_HARDWARE_SKUS.ledSensor)).toMatchObject({ qty: 2 });
  });

  it("skips the profile when the strip is fitted without one", () => {
    expect(line(kitchen(lit({ profileM: 0 })), DEFAULT_HARDWARE_SKUS.ledProfile)).toBeUndefined();
    expect(line(kitchen(lit({ profileM: 0 })), DEFAULT_HARDWARE_SKUS.ledStrip)).toBeTruthy();
  });
});

describe("it lands in the hardware group", () => {
  it("groups with the hinges and slides, not with the boards", () => {
    const l = priced(kitchen(lit()), DEFAULT_HARDWARE_SKUS.ledStrip);
    expect(l!.group).toBe("hardware");
  });

  it("moves the total by exactly what it costs", () => {
    const bare = priceProject(kitchen(), seedRateTable).total;
    const withLed = priceProject(kitchen(lit({ metres: 4, profileM: 4, psu: 1, sensors: 1 })), seedRateTable);
    const added = withLed.lines
      .filter((l) => l.ref.startsWith("LED-"))
      .reduce((sum, l) => sum + l.amount, 0);
    expect(added).toBeGreaterThan(0);
    expect(withLed.total - bare).toBeCloseTo(added, 6);
  });
});
