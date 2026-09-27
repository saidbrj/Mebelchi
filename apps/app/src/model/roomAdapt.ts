// Adapts cabinet placements and dimensions when room geometry changes
// (wall lengths, room width/depth, corner moves, shape changes).
// Ensures corner units track their corners, wall-run cabinets fit within
// their walls without sticking out or breaking, and mid-room items stay inside the room.

import type { Cabinet } from "./cabinet";
import type { Grids } from "./sheet";
import {
  planRuns,
  cornerUnits,
  outerEndSeats,
  cornerSideFor,
  DEFAULT_REVEAL,
  type KitchenLayout,
  type PlannedRun,
} from "./runPlan";
import { cornerArm } from "./bands";
import { polygonBoundsMm, type Pt, type Opening } from "./room";

const MIN_CAB_W = 150;
const MAX_CAB_W = 1200;

export function adaptCabinetsToRoom(
  cabs: Cabinet[],
  oldPoints: Pt[],
  newPoints: Pt[],
  waterWall: number | null,
  layout: KitchenLayout,
  openings: Opening[] = [],
  reveal: number = DEFAULT_REVEAL,
): { cabs: Cabinet[]; grids: Grids } {
  if (!cabs || cabs.length === 0) {
    return { cabs: [], grids: {} };
  }

  const oldRuns = planRuns(oldPoints, waterWall, layout, openings, cabs, reveal).runs;
  const newRuns = planRuns(newPoints, waterWall, layout, openings, cabs, reveal).runs;

  const oldB = polygonBoundsMm(oldPoints);
  const newB = polygonBoundsMm(newPoints);

  // Clone cabinets to avoid mutating arguments
  const adapted: Cabinet[] = cabs.map((c) => ({ ...c }));

  // 1. Adapt corner units & outer corner units
  for (let i = 0; i < adapted.length; i++) {
    const c = adapted[i];
    if (!c.corner) continue;

    if (c.cornerShape === "outer") {
      const depth = cornerArm(c);
      const w = c.w || depth;
      const outerSeats = outerEndSeats(newPoints, w, depth);
      if (outerSeats.length > 0) {
        // Find seat closest to where this cabinet was
        let best = outerSeats[0];
        let bestDist = Infinity;
        for (const s of outerSeats) {
          const d = Math.hypot(s.px - (c.px ?? 0), s.pz - (c.pz ?? 0));
          if (d < bestDist) {
            bestDist = d;
            best = s;
          }
        }
        adapted[i] = {
          ...c,
          px: best.px,
          pz: best.pz,
          rot: best.rot,
          cornerFace: best.face,
          w,
          depth,
        };
      }
    } else {
      // Standard inside corner unit (diagonal or L-shaped)
      const side = cornerSideFor(cornerArm(c));
      const seats = cornerUnits(newPoints, waterWall, layout, openings, side);
      if (seats.length > 0) {
        // Find which corner vertex in oldPoints was closest to old c.px/c.pz
        let bestVIdx = 0;
        let minVDist = Infinity;
        for (let v = 0; v < oldPoints.length; v++) {
          const d = Math.hypot(oldPoints[v].x - (c.px ?? 0), oldPoints[v].y - (c.pz ?? 0));
          if (d < minVDist) {
            minVDist = d;
            bestVIdx = v;
          }
        }

        // Target new corner vertex
        const targetV = newPoints[bestVIdx % newPoints.length];

        // Find the new seat closest to this new corner vertex
        let bestSeat = seats[0];
        let minSeatDist = Infinity;
        for (const s of seats) {
          const d = Math.hypot(s.px - targetV.x, s.pz - targetV.y);
          if (d < minSeatDist) {
            minSeatDist = d;
            bestSeat = s;
          }
        }

        adapted[i] = {
          ...c,
          px: bestSeat.px,
          pz: bestSeat.pz,
          rot: bestSeat.rot,
          w: side,
          depth: side,
        };
      }
    }
  }

  // 2. Adapt free-standing items (islands, tables)
  for (let i = 0; i < adapted.length; i++) {
    const c = adapted[i];
    if (c.px == null || c.corner) continue;

    if (oldB.w > 100 && oldB.h > 100 && newB.w > 100 && newB.h > 100) {
      const relX = (c.px - oldB.cx) / (oldB.w / 2);
      const relZ = (c.pz! - oldB.cy) / (oldB.h / 2);
      const newPx = Math.round(newB.cx + relX * (newB.w / 2) * 0.9);
      const newPz = Math.round(newB.cy + relZ * (newB.h / 2) * 0.9);
      adapted[i] = {
        ...c,
        px: newPx,
        pz: newPz,
      };
    }
  }

  // 3. Adapt wall-run cabinets
  // Collect all runs present in newRuns
  const keptCabs: Cabinet[] = [];
  // First keep corner and free cabinets
  for (const c of adapted) {
    if (c.corner || c.px != null) {
      keptCabs.push(c);
    }
  }

  for (let r = 0; r < newRuns.length; r++) {
    const newRun = newRuns[r];
    if (!newRun || newRun.kind !== "wall") continue;

    const oldRun: PlannedRun | undefined = oldRuns[r];
    const newRunLen = Math.max(300, newRun.len);
    const oldRunLen = oldRun && oldRun.kind === "wall" ? Math.max(300, oldRun.len) : newRunLen;

    const runCabs = adapted.filter((c) => (c.run ?? 0) === r && c.px == null && !c.corner);
    if (runCabs.length === 0) continue;

    // Group by row/band: base/tall on floor, uppers by mountY
    const rowGroups = new Map<string, Cabinet[]>();
    for (const c of runCabs) {
      const key = c.kind === "upper" ? `upper_${Math.round(c.mountY ?? 1420)}` : "floor";
      const g = rowGroups.get(key) ?? [];
      g.push(c);
      rowGroups.set(key, g);
    }

    for (const row of rowGroups.values()) {
      row.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      const totalW = row.reduce((sum, c) => sum + c.w, 0);
      const wasFullWall = totalW >= oldRunLen - 150;

      // Target available width for this row
      const targetW = wasFullWall ? newRunLen : Math.min(newRunLen, totalW);

      // Ensure all cabinets can fit with at least MIN_CAB_W
      while (row.length > 1 && row.length * MIN_CAB_W > targetW) {
        // Drop overflow cabinets from the end, favoring plain cabinets over appliances
        let dropIdx = -1;
        for (let i = row.length - 1; i >= 0; i--) {
          const c = row[i];
          if (!c.appliance || c.appliance === "none") {
            dropIdx = i;
            break;
          }
        }
        if (dropIdx >= 0) {
          row.splice(dropIdx, 1);
        } else {
          row.pop();
        }
      }

      const plain = row.filter((c) => !c.appliance || c.appliance === "none");
      const appliance = row.filter((c) => c.appliance && c.appliance !== "none");
      const applianceTotalW = appliance.reduce((s, c) => s + c.w, 0);

      if (plain.length > 0 && targetW - applianceTotalW >= plain.length * MIN_CAB_W) {
        // Appliances keep their standard widths; plain cabinets scale to fill the rest
        const plainTarget = targetW - applianceTotalW;
        const plainOldW = plain.reduce((s, c) => s + c.w, 0) || 1;
        let rem = plainTarget;
        plain.forEach((c, idx) => {
          if (idx === plain.length - 1) {
            c.w = Math.max(MIN_CAB_W, Math.min(MAX_CAB_W, rem));
          } else {
            const w = Math.max(MIN_CAB_W, Math.min(MAX_CAB_W, Math.round(((c.w / plainOldW) * plainTarget) / 50) * 50));
            c.w = w;
            rem -= w;
          }
        });
      } else {
        // Scale all cabinets proportionally
        const oldTotal = row.reduce((s, c) => s + c.w, 0) || 1;
        let rem = targetW;
        row.forEach((c, idx) => {
          if (idx === row.length - 1) {
            c.w = Math.max(MIN_CAB_W, Math.min(MAX_CAB_W, rem));
          } else {
            const w = Math.max(MIN_CAB_W, Math.min(MAX_CAB_W, Math.round(((c.w / oldTotal) * targetW) / 50) * 50));
            c.w = w;
            rem -= w;
          }
        });
      }

      // Re-assign consecutive run-local x coordinates
      let cx = 0;
      for (const c of row) {
        c.x = cx;
        c.cell = undefined; // clear stale cell so sheet rebuilds fresh
        cx += c.w;
        keptCabs.push(c);
      }
    }
  }

  return { cabs: keptCabs, grids: {} };
}
