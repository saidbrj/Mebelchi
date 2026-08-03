// Bazis-style joint-hardware OVERLAY for the isolated cabinet studio.
//
// This draws the visible fasteners (confirmat heads / minifix cams + dowels / plain dowels) at the
// carcass-shell joints and Ø35 hinge cups on a hinged door. It is a decorative layer laid ON TOP of
// the unified geometry from `buildCabinetSolo` — deliberately NOT its own cabinet builder, so it can
// never disagree with the body the way the retired `createIsolatedCabinetMesh` did.
//
// Coordinates are the SOLO build's LOCAL space (before buildCabinetSolo re-centres the group):
// x across the width, centred (−wM/2 … +wM/2); y up from the floor; z from the BACK face (0) to the
// FRONT face (dM). Positions here must match hollowCarcass's board placement.
//
// PHASE-1 SCOPE: carcass-shell joints (bottom↔side, top↔side) + hinge cups only. Per-shelf and
// per-cell holes are deferred until the drilling solver understands the cell tree — today
// model/machining.ts `canDrill` refuses any custom-interior module, so there is no real hole data to
// drive them from. When that lands, this overlay should read the solved DrillOps instead of dims.

import * as THREE from "three";

export type JointFamily = "confirmat" | "minifix" | "dowel";

export interface HardwareOverlayOpts {
  /** fastener family for the carcass joints (Settings → jointFamily). Default confirmat. */
  family?: JointFamily;
  /** distance of each joint from the front / back edge of a board (mm). Default 65. */
  setbackMm?: number;
}

/** The carcass geometry the overlay needs — supplied by buildCabinetSolo, which already knows it. */
export interface CarcassGeom {
  wM: number;
  dM: number;
  /** board thickness (m) */
  t: number;
  /** y of the bottom of the carcass (m) — bottom board is centred at yBottom + t/2 */
  yBottom: number;
  /** y of the top of the carcass (m) — top board is centred at yTop − t/2 */
  yTop: number;
  /** a hinged door exists (→ draw Ø35 cups on the left inner face) */
  hasDoor: boolean;
}

/** Add the fastener overlay to `group` in solo-local coordinates. */
export function addCabinetHardware(group: THREE.Group, geom: CarcassGeom, opts: HardwareOverlayOpts = {}): void {
  const { wM, dM, t, yBottom, yTop, hasDoor } = geom;
  const family = opts.family ?? "confirmat";
  // clamp the setback so a shallow box still gets two joints instead of them crossing over
  const setback = Math.min((opts.setbackMm ?? 65) / 1000, dM * 0.4);
  const zFront = dM - setback;
  const zBack = setback;

  const steel = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.8, roughness: 0.2 });
  const cam = new THREE.MeshStandardMaterial({ color: 0x8e9499, metalness: 0.85, roughness: 0.3 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.7 });

  // one joint of the chosen family at a board face (yBoard) on a given side (sign = ±1) and z
  const joint = (yBoard: number, sign: number, z: number) => {
    if (family === "confirmat") {
      // Ø7×50 screw head, flush on the OUTER side face, axis along X
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 16), steel);
      head.rotation.z = Math.PI / 2;
      head.position.set(sign * (wM / 2 - 0.001), yBoard, z);
      group.add(head);
    } else if (family === "minifix") {
      // Ø15 cam sunk into the board face + a Ø8 dowel alongside it
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.0125, 16), cam);
      c.position.set(sign * (wM / 2 - t - 0.035), yBoard - t / 2 - 0.006, z);
      group.add(c);
      const dowel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), wood);
      dowel.rotation.z = Math.PI / 2;
      dowel.position.set(sign * (wM / 2 - t / 2), yBoard, z + 0.032);
      group.add(dowel);
    } else {
      // plain Ø8 dowel through the side into the board edge, axis along X
      const dowel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), wood);
      dowel.rotation.z = Math.PI / 2;
      dowel.position.set(sign * (wM / 2 - t / 2), yBoard, z);
      group.add(dowel);
    }
  };

  const yBottomBoard = yBottom + t / 2;
  const yTopBoard = yTop - t / 2;
  for (const yBoard of [yBottomBoard, yTopBoard]) {
    for (const sign of [-1, 1]) {
      joint(yBoard, sign, zFront);
      joint(yBoard, sign, zBack);
    }
  }

  // Ø35 hinge cups on the inner face of a left-hinged door, near the top and bottom
  if (hasDoor) {
    const cupGeo = new THREE.CylinderGeometry(0.0175, 0.0175, 0.013, 16);
    const cupX = -wM / 2 + t + 0.0215; // left-hinged
    const cupZ = dM - 0.006; // just behind the front face
    for (const y of [yTopBoard - 0.1, yBottomBoard + 0.1]) {
      const cup = new THREE.Mesh(cupGeo, cam);
      cup.rotation.x = Math.PI / 2;
      cup.position.set(cupX, y, cupZ);
      group.add(cup);
    }
  }
}
