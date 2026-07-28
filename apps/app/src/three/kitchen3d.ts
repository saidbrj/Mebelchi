// Builds a 3D kitchen run from the solver's Cabinet[] and seats it against the
// room wall(s) / a free-standing island. Product-level geometry (boxes per module
// + simple appliance shapes), NOT the engine's full panel/hardware decomposition.
// Honours onboarding (built-in vs free fridge, oven tower, dome hood) and the
// per-variant finish (KitchenStyle colours). Metres, room-centred. One run ref
// (placement + kind) per Cabinet.run.

import * as THREE from "three";
import { CARCASS_THICKNESS_MM } from "@mebelchi/pricing";
import type { Placement } from "../model/runPlan";
import type { KitchenStyle } from "../model/layout";
import { cabinetLayout, cellSizes, isLeaf, frontOf, type Cabinet, type Cell, type HandlePos, type DoorOpening, type FrontProfile } from "../model/cabinet";
import { cabBand, cabDepth } from "../model/resolve";
import { cornerShapeOf, cornerArm } from "../model/bands";
import { chamferRing } from "../model/outerCorner";
import { frontFace, hasBody, makeGlassMat } from "./frontFace";
import { contactShadow } from "./contact";
import { PBR, texturedMaterial, planarUV } from "./pbr";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { catalogByColor } from "../model/materials";

// Vertical geometry + depth come from the CANONICAL layout model (model/resolve.ts) — this
// file used to redeclare its own metre constants and a 4th copy of the depth table, which is
// how the 3D drifted from the front view (a resized tall didn't move here; the hood sat 80mm
// off). PLINTH/WORKTOP below are just GEOM's plinth/worktop expressed in metres.
const PLINTH = 0.1;
const WORKTOP = 0.04;

/** HOW FAR BEHIND ITS FOOTPRINT CENTRE a free module's group origin sits (m), measured along its
 *  facing. An ordinary module is built forward from its BACK face (→ half its depth); a CORNER unit
 *  is built around its CENTRE (the corner ring is centred there), so it is zero.
 *
 *  Exported because the 3D move gizmo re-places the group directly while the finger is down and has
 *  to use the ORIGIN THIS FILE WILL USE on the rebuild. When the two disagreed, a dragged corner
 *  unit sat half a depth off the moment the finger lifted — it looked like it slid off sideways. */
export function groupBackOffM(c: Cabinet): number {
  return c.corner ? 0 : cabDepth(c) / 2000;
}

/** the standard counter's top surface (m) — what a wall unit's contact shadow lands on */
const WORKTOP_TOP = 0.86;

const STEEL = 0xd2d7da;
const STEEL_DARK = 0x2f3338;
// THE panel thickness, from the one place that defines it. This used to be a local 0.018 while
// pricing cut at 0.016 — the kitchen on screen was not the kitchen in the cut list, and every
// interior width was 4mm out. Read the constant; do not retype it.
const CARCASS_T = CARCASS_THICKNESS_MM / 1000;
// («витрина» glass now lives with the rest of the front's body — three/frontFace.ts)

/** One run for the renderer: where it sits + whether it's a free-standing piece. `revealStart` /
 *  `revealEnd` are the reserved filler gaps (mm) at each end of a wall run (see model/runPlan), which
 *  buildKitchen draws as a scribe panel. */
export interface RunRef {
  placement: Placement;
  kind: "wall" | "peninsula" | "island";
  revealStart?: number;
  revealEnd?: number;
}

/** Every material ONE module needs — each built at most once. */
interface Mats {
  facade: () => THREE.Material;
  carcass: () => THREE.Material;
  worktop: () => THREE.Material;
  handle: () => THREE.Material;
  steel: () => THREE.Material;
  /** the pale interior of a drawer box */
  box: () => THREE.Material;
  /** translucent «витрина» pane */
  glass: () => THREE.Material;
  /** anything else, by colour — appliance steel, toe-kick, burners… */
  flat: (color: number, opts?: THREE.MeshStandardMaterialParameters) => THREE.Material;
}

/**
 * The module's material set, memoised.
 *
 * PER MODULE, deliberately NOT kitchen-wide: the selection highlight (VariantScene's `tintCab`) tints
 * a module by setting `emissive` on its meshes' materials, so one material shared between two cabinets
 * would light both of them up. Per module is safe — and it is also what makes `mergeShell` possible,
 * since a merge needs all its meshes to agree on one material.
 *
 * `flat` keys on colour + roughness + metalness, which is every option this file actually passes.
 */
function makeMats(fin: Cabinet["finish"], style: KitchenStyle): Mats {
  const cache = new Map<string, THREE.Material>();
  const once = (k: string, make: () => THREE.Material): THREE.Material => {
    let m = cache.get(k);
    if (!m) {
      m = make();
      cache.set(k, m);
    }
    return m;
  };
  const flat: Mats["flat"] = (color, opts = {}) =>
    once(
      `f${color}|${opts.roughness ?? ""}|${opts.metalness ?? ""}`,
      () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }),
    );
  return {
    flat,
    steel: () => flat(STEEL, { metalness: 0.4, roughness: 0.35 }),
    carcass: () => flat(fin?.carcass ?? style.carcass),
    handle: () => flat(fin?.handle ?? style.handle, { metalness: 0.5, roughness: 0.4 }),
    box: () => flat(0xcfc7b8, { roughness: 0.9 }),
    glass: () => once("glass", makeGlassMat),
    // facade: a picked catalog material with a PBR texture (wood) → its real grain;
    // painted/gloss fronts (no texture) stay flat colour
    facade: () =>
      once("facade", () => {
        const col = fin?.facade ?? style.facade;
        if (PBR) {
          const key = catalogByColor(col, "facade")?.tex;
          const m = key ? texturedMaterial(key, col) : null;
          if (m) return m;
        }
        return flat(col);
      }),
    // worktop: the picked worktop material's texture (marble / oak butcher-block), tinted
    // by the colour where the texture is tintable; defaults to marble
    worktop: () =>
      once("worktop", () => {
        const col = fin?.worktop ?? style.worktop;
        if (!PBR) return flat(col, { roughness: 0.55 });
        const key = catalogByColor(col, "worktop")?.tex ?? "marble";
        return texturedMaterial(key, col) ?? flat(col, { roughness: 0.55 });
      }),
  };
}

/**
 * SEAT A FINISHED MODULE — merging its static shell on the way in.
 *
 * Everything sitting directly on the module group (carcass panels, shelves, dividers, the plinth, the
 * worktop, appliance bodies) is one immovable object, so it has no business being one draw call per
 * panel: a plain base cabinet was eleven. Group those meshes by material — which is exactly what the
 * per-module `Mats` cache above makes possible — and merge each bucket into a single geometry.
 *
 * The openable subgroups (doors, drawers) are deliberately left alone: they animate, they pivot on
 * their own hinge, and they are what `applyOpen` and the raycast walk. `userData.cabId` stays on the
 * group, so selection is untouched. A bucket whose geometries disagree on attributes merges to null —
 * we keep the separate meshes rather than lose them.
 */
function seatModule(root: THREE.Group, g: THREE.Group): void {
  mergeIn(g);
  root.add(g);
}

/** Merge one group's own meshes by material, then recurse. Every group here is internally RIGID — a
 *  door swings as a whole, a drawer slides as a whole — so baking each mesh's transform into its
 *  vertices and handing the group one mesh per material changes nothing you can see. */
function mergeIn(g: THREE.Object3D): void {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  for (const ch of g.children) {
    const m = ch as THREE.Mesh;
    if (!m.isMesh || !m.geometry || Array.isArray(m.material)) continue;
    const list = byMat.get(m.material as THREE.Material);
    if (list) list.push(m);
    else byMat.set(m.material as THREE.Material, [m]);
  }
  for (const [material, meshes] of byMat) {
    if (meshes.length < 2) continue; // nothing to gain
    const parts: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      const gc = m.geometry.clone().applyMatrix4(m.matrix); // bake the mesh's transform into the vertices
      // mergeGeometries refuses a bucket where some parts are indexed and some are not (an extruded
      // shaker/fluted front is indexed, a Box panel is too, but a hand-built BufferGeometry may not
      // be). Drop every part to non-indexed so the bucket is always mergeable — otherwise a whole
      // module's shell stays unmerged (extra draw calls) and THREE logs a red console error.
      if (gc.index) {
        const ni = gc.toNonIndexed();
        gc.dispose();
        parts.push(ni);
      } else parts.push(gc);
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) continue; // mismatched attributes — leave this bucket as it was
    for (const m of meshes) {
      g.remove(m);
      m.geometry.dispose();
    }
    const one = new THREE.Mesh(merged, material);
    one.castShadow = true;
    one.receiveShadow = true;
    g.add(one);
  }
  // the subgroups: doors, drawers, the corner's swinging leaves. A 5-mesh shaker front and a drawer's
  // four box walls collapse the same way — and the group keeps its pivot, its openable data and its
  // transform, because we never touch those.
  for (const ch of [...g.children]) if (!(ch as THREE.Mesh).isMesh) mergeIn(ch);
}

/** Build the run(s) as a THREE.Group, using one RunRef per Cabinet.run.
 *  `roomCenter` (mm) lets modules with a free plan transform (px/pz/rot) be placed
 *  in the same centred-metre space as the run placements. */
export function buildKitchen(cabs: Cabinet[], runs: RunRef[], style: KitchenStyle, roomCenter?: { cx: number; cy: number }, ceiling?: number): THREE.Group {
  const root = new THREE.Group();

  // WHICH BAY OF WHICH BOX. Modules sharing a `carcassGroup` are built as ONE carcass, so each of
  // them is a bay of it rather than a box of its own — and only the end bays carry an outer side.
  // Ordered by position along the wall, because "first" and "last" are structural: they are the
  // bays the outer sides belong to.
  const bays = new Map<string, Bay>();
  {
    const groups = new Map<string, Cabinet[]>();
    for (const c of cabs) {
      if (!c.carcassGroup) continue;
      const g = groups.get(c.carcassGroup) ?? [];
      g.push(c);
      groups.set(c.carcassGroup, g);
    }
    for (const members of groups.values()) {
      if (members.length < 2) continue; // a box of one is just a cabinet
      const ordered = [...members].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      ordered.forEach((c, i) => bays.set(c.id, { first: i === 0, last: i === ordered.length - 1 }));
    }
  }

  const cursor: Record<string, number> = {};
  for (const c of cabs) {
    if (c.appliance === "filler") continue;
    const bay = bays.get(c.id);
    const run = c.run ?? 0;
    const ref = runs[run] ?? runs[0];
    if (!ref) continue;
    const p = ref.placement;
    const freestanding = ref.kind !== "wall" || !!c.island; // island/peninsula run OR a free island module → seating side

    const key = `${run}:${c.kind}`;
    const xMm = c.x ?? cursor[key] ?? 0;
    cursor[key] = xMm + c.w;

    const wM = c.w / 1000;
    const dM = cabDepth(c) / 1000;
    // THE vertical extent of this module (mm → m). Honours c.h for talls and c.mountY for
    // hoods — both of which this file used to ignore.
    const band = cabBand(c);
    const bandY0 = band.y0 / 1000;
    const carcassBot = band.carcass0 / 1000;
    const carcassTop = band.carcass1 / 1000;
    const sCenter = p.startS + (xMm + c.w / 2) / 1000;

    const g = new THREE.Group();
    g.userData.cabId = c.id; // raycast target → selects this module

    // per-module finish: each present override wins over the kitchen-wide style
    const fin = c.finish;
    // EVERY MATERIAL THIS MODULE NEEDS, BUILT AT MOST ONCE. These used to be plain factories that
    // constructed a fresh MeshStandardMaterial on every call — `hollowCarcass` alone made five
    // identical ones for one box, and a 14-module kitchen ended up with ~160 materials.
    const M = makeMats(fin, style);
    const facadeMat = M.facade;
    const carcassMat = M.carcass;
    const mat = M.flat;
    const steelMat = M.steel;
    const worktopMat = M.worktop;
    const handleMat = M.handle;

    // diagonal corner unit (Phase 1): a FULL wall-aligned square so its two sides are
    // the full run depth (flush with the runs); the diagonal door sits ACROSS the room
    // corner (doesn't cut the sides).
    if (c.corner && c.px != null && c.pz != null && roomCenter) {
      const rotRad = ((c.rot ?? 0) * Math.PI) / 180;
      g.rotation.y = -rotRad; // local axes aligned with the two walls
      g.position.set((c.px - roomCenter.cx) / 1000, 0, (c.pz - roomCenter.cy) / 1000);
      const half = c.w / 2000; // half side of the corner square (m)
      // An ANGLED END UNIT cuts the corner its stored `cornerFace` points at (the run's exposed end);
      // an INNER corner opens toward the room centre — either way it's the same world→local sign
      // math, so the 2D plan and this agree.
      const outer = cornerShapeOf(c) === "outer";
      const faceX = outer && c.cornerFace ? c.cornerFace.x : roomCenter.cx;
      const faceY = outer && c.cornerFace ? c.cornerFace.y : roomCenter.cy;
      let wdx = faceX - c.px;
      let wdz = faceY - c.pz;
      const wl = Math.hypot(wdx, wdz) || 1;
      wdx /= wl; wdz /= wl;
      const ldx = wdx * Math.cos(rotRad) + wdz * Math.sin(rotRad); // world → local
      const ldz = -wdx * Math.sin(rotRad) + wdz * Math.cos(rotRad);
      const sx = ldx >= 0 ? 1 : -1;
      const sz = ldz >= 0 ? 1 : -1;
      const isUpper = c.kind === "upper";
      // the angled end unit's footprint ring (local mm), shared with the 2D plan; null for inner
      // corners. Its depth is the RUN's (cabDepth), its width its own — it is not a square.
      const oRing = outer ? chamferRing(c.w, cabDepth(c), c.chamfer ?? Infinity, sx) : null;
      // THE BODY: a 45° chamfer or an L-shaped notch. This used to be a consequence of the kind — a
      // wall unit was always diagonal, a base one always L — which is simply untrue of real
      // kitchens. Now it's a property of the module (the old behaviour is still the default).
      const diagonal = cornerShapeOf(c) === "diagonal";
      // the depth of the RUNS this corner butts into — NOT its own depth, which is the square's
      // side. Also a field now: a base-depth top row needs 560 here even though it's a wall unit.
      const armD = cornerArm(c) / 1000;
      const cut = armD - half; // how far the run-butt edge sits past centre (m)
      // Footprint local (x,z), shape Y = −z. Two full sides sit against the walls; the
      // adjacent runs butt the two run-depth sides. The ROOM-FACING corner is removed:
      // BASE → via the inner notch corner (an L-shape with an L-door); UPPER → a single
      // 45° chamfer (a pentagon with a diagonal door, ≈ a regular door wide).
      // `ov` pushes the room-facing (door) edges outward — +ov for the worktop overhang,
      // −ov to recess the toe-kick — while the run-butt/wall edges stay put so neighbours
      // still butt flush.
      const footPts = (ov = 0): [number, number][] => {
        // OUTER: the shared ring (local mm → m). `ov` is ignored — an open end cap has a uniform
        // worktop lip, not the inner corner's run-butt overhang.
        if (oRing) return oRing.ring.map((p) => [p.along / 1000, p.into / 1000] as [number, number]);
        const base: [number, number][] = [
          [-sx * half, -sz * half], // back corner (wall vertex)
          [sx * half, -sz * half], // along wall A
          [sx * half, sz * (cut + ov)], // run-A butt edge ends here (+overhang)
        ];
        const tail: [number, number][] = [
          [sx * (cut + ov), sz * half], // run-B butt edge starts here (+overhang)
          [-sx * half, sz * half], // along wall B
        ];
        // diagonal → the room corner is one straight chamfer; L → it is notched out
        return diagonal ? [...base, ...tail] : [...base, [sx * (cut + ov), sz * (cut + ov)], ...tail];
      };
      const prism = (height: number, yBase: number, m: THREE.Material, ov = 0) => {
        const s = new THREE.Shape();
        footPts(ov).forEach(([x, z], i) => (i === 0 ? s.moveTo(x, -z) : s.lineTo(x, -z)));
        s.closePath();
        const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false });
        geo.rotateX(-Math.PI / 2); // extrude axis Z → Y up; shape Y → −Z
        geo.translate(0, yBase, 0);
        const mesh = new THREE.Mesh(geo, m);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
      };
      // A corner front is a front: it gets the module's profile (shaker, fluted, витрина…) from the
      // SAME generator as every other door, so a neoclassic kitchen's corner doesn't stay a flat slab
      // while its neighbours grow frames. One facade + one glass material for the whole unit.
      const cornerProfile = frontOf(c);
      const cornerFacade = M.facade();
      const cornerGlass = M.glass();
      // a door leaf facing direction (nx,nz), centred on the face midpoint, added to `target`
      // (a swinging subgroup for the openable leaf, else `g`). The leaf is a GROUP — it is
      // oriented, then the profile's meshes are built inside it in plain front-local coords.
      const panel = (cx: number, cz: number, width: number, nx: number, nz: number, yc: number, height: number, target: THREE.Object3D) => {
        const leaf = new THREE.Group();
        leaf.position.set(cx, 0, cz);
        leaf.rotation.y = Math.atan2(nx, nz); // local +Z → the face normal
        frontFace(cornerProfile, width, height - 0.03, 0, yc, 0.011, cornerFacade, leaf, cornerGlass);
        target.add(leaf);
      };
      // ONE handle on the door, by type (c.handle index into HANDLES): 3 Без = none,
      // 2 Кнопка = knob (sphere), else a vertical bar pull — added to `target` so it
      // swings WITH the door; reacts to the handle picker / "apply to all" like regular cabinets.
      const cornerHandle = (px: number, pz: number, nx: number, nz: number, yc: number, len: number, target: THREE.Object3D) => {
        const HT = c.handle ?? 0;
        if (HT === 3) return; // none
        if (HT === 2) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 10), handleMat());
          cap.position.set(px + nx * 0.03, yc, pz + nz * 0.03);
          target.add(cap);
          return;
        }
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 10), handleMat());
        b.position.set(px + nx * 0.024, yc, pz + nz * 0.024);
        target.add(b);
      };
      // build the swinging leaf as a subgroup pivoted on its hinge edge (hx,hz), tagged
      // openable so VariantScene's applyOpen hinges it like a normal cabinet door
      const swingDoor = (hx: number, hz: number, rad: number, build: (door: THREE.Group) => void) => {
        const door = new THREE.Group();
        build(door);
        pivotGroup(door, hx, hz);
        // explicit signed 90° swing so the corner door opens OUTWARD into the room (the sign
        // depends on which room-corner this is + which end hinges — see `rad` below)
        door.userData.openable = { kind: "door", rad };
        g.add(door);
      };
      const doors = (yc: number, height: number) => {
        const face = half - cut; // length of each run-butt face / door arm
        const len = Math.min(0.22, height * 0.5);
        // Opening direction is EDITABLE (Ручка → Редактировать → Открывание): left/top hinges
        // at arm-A's outer end, right/bottom at arm-B's. The swing sign flips with the hinge
        // AND with this room-corner (sx·sz) so the leaf ALWAYS opens out toward the room —
        // `sx*sz*RAD` opens the arm-A hinge outward; the arm-B hinge is the mirror (−).
        // A DIAGONAL corner also supports a HYDRAULIC lift (Открывание = top/bottom): the single
        // diagonal door hinges on its horizontal TOP (lift-up) or BOTTOM edge and rotates on the
        // chamfer's horizontal axis. That's a property of the CHAMFER, not of being a wall unit —
        // an L-shaped body has no single face to lift, so it stays side-hinged.
        if (diagonal && (c.opening === "top" || c.opening === "bottom")) {
          const top = c.opening === "top";
          const cx = (sx * (half + cut)) / 2, cz = (sz * (half + cut)) / 2; // chamfer centre (XZ)
          const orient = new THREE.Group(); // local +Z faces the chamfer normal, +X along it
          orient.rotation.y = Math.atan2(sx, sz);
          orient.position.set(cx, 0, cz);
          const lift = new THREE.Group();
          frontFace(cornerProfile, face * Math.SQRT2, height - 0.03, 0, yc, 0.011, cornerFacade, lift, cornerGlass);
          cornerHandle(0, 0, 0, 1, top ? yc - height * 0.35 : yc + height * 0.35, len, lift); // near free edge, on +Z face
          const edgeY = top ? yc + height / 2 : yc - height / 2; // hinge = top or bottom edge
          for (const ch of lift.children) ch.position.y -= edgeY;
          lift.position.y = edgeY;
          lift.userData.openable = { kind: "door", axis: "x", rad: top ? -DOOR_OPEN_RAD : DOOR_OPEN_RAD };
          orient.add(lift);
          g.add(orient);
          return;
        }
        const hingeRight = c.opening === "right" || c.opening === "bottom";
        const hx = hingeRight ? sx * cut : sx * half;
        const hz = hingeRight ? sz * half : sz * cut;
        const rad = (hingeRight ? -1 : 1) * sx * sz * DOOR_OPEN_RAD;
        if (diagonal) {
          // single diagonal door across the chamfer (run-butt-A ↔ run-butt-B)
          swingDoor(hx, hz, rad, (door) => {
            panel((sx * (half + cut)) / 2, (sz * (half + cut)) / 2, face * Math.SQRT2, sx, sz, yc, height, door);
            // handle on the diagonal door surface, offset toward the FREE end (opposite hinge)
            const dn = 1 / Math.SQRT2;
            const off = (hingeRight ? -1 : 1) * face * 0.35;
            cornerHandle((sx * (half + cut)) / 2 - sx * dn * off, (sz * (half + cut)) / 2 + sz * dn * off, sx * dn, sz * dn, yc, len, door);
          });
        } else {
          // L-door: BOTH arms are ONE L-shaped leaf hinged at one outer edge, handle at the
          // other (free) outer end; swings open like a regular but L-shaped door.
          swingDoor(hx, hz, rad, (door) => {
            panel((sx * (half + cut)) / 2, sz * cut, face, 0, sz, yc, height, door); // arm A (∥ wall A)
            panel(sx * cut, (sz * (half + cut)) / 2, face, sx, 0, yc, height, door); // arm B (∥ wall B)
            if (hingeRight) cornerHandle(sx * (half - 0.06), sz * cut, 0, sz, yc, len, door); // free end = arm-A
            else cornerHandle(sx * cut, sz * (half - 0.06), sx, 0, yc, len, door); // free end = arm-B
          });
        }
      };
      // a thin vertical carcass panel along the edge (ax,az)→(bx,bz), centred on it
      const sidePanel = (ax: number, az: number, bx: number, bz: number, yBase: number, hh: number) => {
        const L = Math.hypot(bx - ax, bz - az);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(L, hh, CARCASS_T), carcassMat());
        mesh.position.set((ax + bx) / 2, yBase + hh / 2, (az + bz) / 2);
        mesh.rotation.y = -Math.atan2(bz - az, bx - ax);
        mesh.castShadow = mesh.receiveShadow = true;
        g.add(mesh);
      };
      // HOLLOW body: thin bottom + top + shelves + side/back walls (open ONLY at the door
      // face) — so the door reveals an interior with separations + the shelves are enclosed
      // by real side panels instead of floating. Walls on every footprint edge EXCEPT the
      // two door-face edges; same 4 edges for base (L) and upper (chamfer).
      const hollowBody = (yBase: number, hh: number) => {
        prism(CARCASS_T, yBase, carcassMat()); // bottom panel
        prism(CARCASS_T, yBase + hh - CARCASS_T, carcassMat()); // top panel
        // interior shelves — count from the editor's shelf stepper (c.count), spread evenly
        const nShelves = Math.max(0, c.count ?? 0);
        for (let i = 1; i <= nShelves; i++) prism(CARCASS_T, yBase + (hh * i) / (nShelves + 1), carcassMat());
        // OUTER (reverse-L): a side panel on every ring edge EXCEPT the two room-facing open faces,
        // so the shelves show through where the L opens onto the room.
        if (oRing) {
          const pts = oRing.ring.map((p) => [p.along / 1000, p.into / 1000] as [number, number]);
          for (let i = 0; i < pts.length; i++) {
            if (oRing.openEdges.includes(i)) continue;
            const a = pts[i], b = pts[(i + 1) % pts.length];
            sidePanel(a[0], a[1], b[0], b[1], yBase, hh);
          }
          return;
        }
        const Vx = -sx * half, Vz = -sz * half; // back wall vertex
        const Ax = sx * half, Az = -sz * half; // end of the wall-A side
        const bAx = sx * half, bAz = sz * cut; // run-butt-A
        const bBx = sx * cut, bBz = sz * half; // run-butt-B
        const Bx = -sx * half, Bz = sz * half; // end of the wall-B side
        sidePanel(Vx, Vz, Ax, Az, yBase, hh); // back, against wall A
        sidePanel(Ax, Az, bAx, bAz, yBase, hh); // side at the run-A butt
        sidePanel(bBx, bBz, Bx, Bz, yBase, hh); // side at the run-B butt
        sidePanel(Bx, Bz, Vx, Vz, yBase, hh); // back, against wall B
      };
      if (isUpper) {
        const h = carcassTop - carcassBot;
        hollowBody(carcassBot, h);
        if (!outer) doors(carcassBot + h / 2, h); // outer = open display, no door
      } else {
        const baseTop = carcassTop; // = plinth + c.h, from the canonical band
        const h = baseTop - PLINTH;
        prism(PLINTH, 0, mat(STEEL_DARK), -0.02); // toe-kick (recessed, like regular bases)
        hollowBody(PLINTH, h);
        prism(WORKTOP, baseTop, worktopMat(), 0.03); // worktop with the same front overhang
        if (!outer) doors(PLINTH + h / 2, h);
      }
      // the footprint on the floor: an inner corner is a square (w × w), an end unit is w × the run depth
      if (!isUpper) contactShadow(g, wM, outer ? cabDepth(c) / 1000 : wM, { centred: true });
      seatModule(root, g);
      continue;
    }

    if (c.px != null && c.pz != null && roomCenter) {
      // free plan transform: place the footprint centre, rotate to match the plan.
      // group origin is the module's BACK face, so back-off by half depth along +z.
      const rotRad = ((c.rot ?? 0) * Math.PI) / 180;
      g.rotation.y = -rotRad;
      const fwdX = -Math.sin(rotRad); // local +z in world after rotation.y = -rotRad
      const fwdZ = Math.cos(rotRad);
      const vx = (c.px - roomCenter.cx) / 1000;
      const vz = (c.pz - roomCenter.cy) / 1000;
      const back = groupBackOffM(c);
      g.position.set(vx - fwdX * back, 0, vz - fwdZ * back);
    } else {
      g.position.set(p.ax + p.ux * sCenter, 0, p.az + p.uz * sCenter);
      const baseAngle = -Math.atan2(p.uz, p.ux);
      const localZIsInward = -p.uz * p.ix + p.ux * p.iz > 0;
      g.rotation.y = localZIsInward ? baseAngle : baseAngle + Math.PI;
    }

    const add = (w: number, h: number, d: number, lx: number, ly: number, lz: number, m: THREE.Material, target: THREE.Object3D = g) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(lx, ly, lz);
      target.add(mesh);
      return mesh;
    };
    // a rounded handle bar (cylinder); `vertical` = along Y, else along the wall (X).
    // used for appliance handles (always a bar).
    const bar = (length: number, vertical: boolean, lx: number, ly: number, lz: number, target: THREE.Object3D = g) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, length, 10), handleMat());
      m.position.set(lx, ly, lz);
      if (!vertical) m.rotation.z = Math.PI / 2;
      target.add(m);
    };
    // cabinet handle by TYPE (c.handle index into HANDLES): 0 Скоба = bar pull,
    // 1 Профиль = slim near-flush edge pull, 2 Кнопка = round knob, 3 Без = none.
    // Same call signature as `bar` so it drops into facade() unchanged.
    const handle: BarFn = (length, vertical, lx, ly, lz, target = g) => {
      const type = c.handle ?? 0;
      if (type === 3) return; // none
      if (type === 2) {
        // knob: a round cap on a short stem, protruding from the front face
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.02, 10), handleMat());
        stem.rotation.x = Math.PI / 2;
        stem.position.set(lx, ly, lz + 0.01);
        target.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), handleMat());
        cap.position.set(lx, ly, lz + 0.024);
        target.add(cap);
        return;
      }
      if (type === 1) {
        // profile: a slim flat edge pull, sitting almost flush
        const strip = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 0.014 : length, vertical ? length : 0.014, 0.008), handleMat());
        strip.position.set(lx, ly, lz - 0.004);
        target.add(strip);
        return;
      }
      bar(length, vertical, lx, ly, lz, target); // 0 = bar pull
    };

    // free-standing furniture (dining table / chair) — built where a cabinet body would
    // sit (g is already placed by the free branch, origin = back face), so the piece is
    // centred at local z = dM/2 and the move gizmo's back-off matches with no jump.
    if (c.furniture) {
      const woodMat = () => mat(fin?.facade ?? 0xc79a64, { roughness: 0.6 });
      const zc = dM / 2;
      const Ht = c.h / 1000;
      const legT = 0.06;
      const legsAt = (lh: number, inset: number, t: number, m: THREE.Material) => {
        const lx = wM / 2 - inset;
        const lz = dM / 2 - inset;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(t, lh, t, sx * lx, lh / 2, zc + sz * lz, m);
      };
      const steel = () => steelMat();
      if (c.furniture === "table") {
        const topT = 0.04;
        add(wM, topT, dM, 0, Ht - topT / 2, zc, woodMat()); // tabletop slab
        legsAt(Ht - topT, 0.07, legT, woodMat());
      } else if (c.furniture === "chair") {
        const seatY = 0.45;
        const seatT = 0.045;
        add(wM, seatT, dM, 0, seatY - seatT / 2, zc, woodMat()); // seat
        legsAt(seatY - seatT, 0.04, 0.042, woodMat());
        const backH = 0.45; // backrest rising from the rear edge
        add(wM, backH, seatT, 0, seatY + backH / 2, zc - dM / 2 + seatT / 2, woodMat());
      } else if (c.furniture === "stool") {
        const seatY = Ht; // bar height
        const seatT = 0.05;
        add(wM, seatT, dM, 0, seatY - seatT / 2, zc, woodMat()); // seat
        legsAt(seatY - seatT, 0.04, 0.04, steel());
        add(wM - 0.06, 0.025, 0.025, 0, seatY * 0.32, zc + dM / 2 - 0.04, steel()); // footrest bar
      } else if (c.furniture === "trolley") {
        const topT = 0.035;
        add(wM, topT, dM, 0, Ht - topT / 2, zc, woodMat()); // top
        add(wM - 0.06, 0.03, dM - 0.06, 0, Ht * 0.42, zc, woodMat()); // lower shelf
        legsAt(Ht, 0.035, 0.04, steel());
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // castor wheels
          const wheel = add(0.05, 0.05, 0.05, sx * (wM / 2 - 0.035), 0.025, zc + sz * (dM / 2 - 0.035), mat(0x222222));
          wheel.scale.set(1, 1, 1);
        }
      } else if (c.furniture === "shelf") {
        // open wall shelf — a plank mounted at height, two brackets underneath
        const yShelf = c.mountY != null ? c.mountY / 1000 : 1.45;
        const plankT = 0.03;
        add(wM, plankT, dM, 0, yShelf, zc, woodMat());
        for (const sx of [-1, 1]) add(0.02, 0.14, dM * 0.8, sx * (wM / 2 - 0.06), yShelf - 0.08, zc, steel()); // brackets
      } else {
        // free-standing waste bin — a tapered-ish body + a lid
        const bodyH = Ht - 0.04;
        add(wM, bodyH, dM, 0, bodyH / 2, zc, mat(0x9a9ea2, { metalness: 0.3, roughness: 0.5 }));
        add(wM + 0.01, 0.04, dM + 0.01, 0, bodyH + 0.02, zc, mat(0x70747a, { metalness: 0.4, roughness: 0.4 })); // lid
      }
      seatModule(root, g);
      continue;
    }

    if (c.kind === "upper") {
      if (c.appliance === "hood") {
        // canopy sits ON the band bottom (honours mountY — used to be pinned at 1.5m), with
        // the flue rising above it
        add(wM * 0.62, 0.16, dM, 0, bandY0 + 0.08, dM * 0.6, steelMat());
        add(0.22, 0.55, 0.12, 0, bandY0 + 0.46, dM * 0.42, steelMat());
        seatModule(root, g);
        continue;
      }
      const h = carcassTop - carcassBot;
      const bottom = carcassBot;
      const yc = bottom + h / 2;
      hollowCarcass(add, wM, h, dM, yc, carcassMat, bay);
      buildModuleInterior(add, handle, c, wM, h, dM, yc, style, M, true, g);
    // the shade a wall unit throws on the counter — only for a row hanging at the normal height
    // (an antresol sits above a column, and there is no counter under it to darken)
    if (bandY0 < 1.8) contactShadow(g, wM, dM, { y: WORKTOP_TOP, opacity: 0.4 });
      seatModule(root, g);
      continue;
    }

    if (c.kind === "tall") {
      // was pinned to a hardcoded 2.2m top and IGNORED c.h — resizing a tall moved it in the
      // front view and did nothing here. Now it follows the canonical band.
      const tallTop = carcassTop;
      const h = tallTop - PLINTH;
      const yc = (tallTop + PLINTH) / 2;
      add(wM, PLINTH, dM * 0.85, 0, PLINTH / 2, dM * 0.55, mat(STEEL_DARK));
      if (c.appliance === "fridge" && !c.builtin) {
        add(wM, h, dM, 0, yc, dM / 2, mat(0xdde2e5, { metalness: 0.45, roughness: 0.3 }));
        add(wM + 0.002, 0.012, 0.01, 0, PLINTH + h * 0.62, dM + 0.006, mat(STEEL_DARK));
        bar(h * 0.34, true, wM / 2 - 0.05, PLINTH + h * 0.8, dM + 0.02);
        bar(h * 0.3, true, wM / 2 - 0.05, PLINTH + h * 0.3, dM + 0.02);
      } else if (c.appliance === "fridge") {
        add(wM, h, dM, 0, yc, dM / 2, carcassMat());
        // 62% bottom (fridge) / 38% top (freezer) — same split as the front-view elevation
        const GAP = 0.02;
        const botH = h * 0.62 - GAP / 2;
        const topH = h * 0.38 - GAP / 2;
        const botY = PLINTH + botH / 2;             // bottom door: flush with plinth at the base
        const topY = PLINTH + h * 0.62 + GAP / 2 + topH / 2; // top door: flush with tallTop at the top
        add(wM - 0.04, botH, 0.02, 0, botY, dM + 0.011, facadeMat());
        add(wM - 0.04, topH, 0.02, 0, topY, dM + 0.011, facadeMat());
        bar(h * 0.22, true, wM / 2 - 0.06, botY, dM + 0.02);
      } else if (c.appliance === "oven") {
        add(wM, h, dM, 0, yc, dM / 2, carcassMat());
        const ovY = 1.55;
        add(wM - 0.04, 0.58, 0.02, 0, ovY, dM + 0.011, steelMat());
        add(wM - 0.16, 0.34, 0.012, 0, ovY + 0.02, dM + 0.02, mat(STEEL_DARK));
        bar(wM - 0.18, false, 0, ovY + 0.32, dM + 0.02);
        add(wM - 0.04, h - 1.18, 0.02, 0, PLINTH + (h - 1.18) / 2, dM + 0.011, facadeMat());
        add(wM - 0.04, 0.32, 0.02, 0, tallTop - 0.2, dM + 0.011, facadeMat());
      } else {
        hollowCarcass(add, wM, h, dM, yc, carcassMat, bay);
        buildModuleInterior(add, handle, c, wM, h, dM, yc, style, M, false, g);
      }
    contactShadow(g, wM, dM); // a column, on the floor
      seatModule(root, g);
      continue;
    }

    // base ---------------------------------------------------------------------
    // body height = the module's OWN `c.h` (custom counter height — the editor keeps ALL base
    // cabinets the SAME so the worktop stays level); everything sits on this `baseTop`.
    // Straight from the canonical band; the RENDERER no longer clamps (the editor does).
    const baseTop = carcassTop;
    const h = baseTop - PLINTH;
    const yc = (baseTop + PLINTH) / 2;

    // plinth / toe-kick — full width `wM` so adjacent cabinets touch with zero seam gaps;
    // extends across reveal gaps to the wall on end cabinets.
    let plinthW = wM;
    let plinthLx = 0;
    if (!c.corner && ref.kind === "wall") {
      const onRunBases = cabs.filter(
        (oc) => (oc.run ?? 0) === run && oc.px == null && oc.appliance !== "filler" && !oc.furniture && !oc.corner && oc.kind === "base",
      );
      if (onRunBases.length > 0) {
        const isLeftmost = c.id === onRunBases.reduce((leftmost, oc) => (oc.x ?? 0) < (leftmost.x ?? 0) ? oc : leftmost).id;
        const isRightmost = c.id === onRunBases.reduce((rightmost, oc) => (oc.x ?? 0) > (rightmost.x ?? 0) ? oc : rightmost).id;
        const revS = ref.revealStart ?? 0;
        const revE = ref.revealEnd ?? 0;
        if (isLeftmost && revS > 0) {
          const ext = revS / 1000;
          plinthW += ext;
          plinthLx -= ext / 2;
        }
        if (isRightmost && revE > 0) {
          const ext = revE / 1000;
          plinthW += ext;
          plinthLx += ext / 2;
        }
      }
    }
    add(plinthW, PLINTH, dM * 0.85, plinthLx, PLINTH / 2, dM * 0.55, mat(STEEL_DARK));
    hollowCarcass(add, wM, h, dM, yc, carcassMat, bay);

    // worktop with a front overhang (bigger on the seating side of an island)
    const front = freestanding ? 0.26 : 0.03;
    const wtDepth = dM + 0.02 + front;

    let wtW = wM;
    let wtLx = 0;
    if (c.kind === "base" && !c.corner) {
      const onRunBases = cabs.filter(
        (oc) => (oc.run ?? 0) === run && oc.px == null && oc.appliance !== "filler" && !oc.furniture && !oc.corner && oc.kind === "base",
      );
      if (onRunBases.length > 0) {
        const isLeftmost = c.id === onRunBases.reduce((leftmost, oc) => (oc.x ?? 0) < (leftmost.x ?? 0) ? oc : leftmost).id;
        const isRightmost = c.id === onRunBases.reduce((rightmost, oc) => (oc.x ?? 0) > (rightmost.x ?? 0) ? oc : rightmost).id;
        const revS = ref.revealStart ?? 0;
        const revE = ref.revealEnd ?? 0;
        if (isLeftmost && revS > 0) {
          const ext = revS / 1000;
          wtW += ext;
          wtLx -= ext / 2;
        }
        if (isRightmost && revE > 0) {
          const ext = revE / 1000;
          wtW += ext;
          wtLx += ext / 2;
        }
      }
    }

    const wt = add(wtW, WORKTOP, wtDepth, wtLx, baseTop + WORKTOP / 2, dM / 2 - 0.01 + front / 2, worktopMat());
    // map the marble in run space (offset by the cabinet's position along the run) so the
    // worktops flow into one continuous slab instead of per-cabinet blocks
    if (PBR) planarUV(wt.geometry, 1.4, sCenter + wtLx, 0);

    if (c.appliance === "sink") {
      facade(add, handle, { ...c, fill: "shelves" } as Cabinet, wM, h, yc, dM, style, M, g);
      add(wM * 0.55, 0.05, dM * 0.6, 0, baseTop - 0.01, dM * 0.5, mat(STEEL_DARK)); // basin well
      add(wM * 0.55, 0.015, dM * 0.6, 0, baseTop + WORKTOP - 0.005, dM * 0.5, steelMat()); // rim
      // gooseneck faucet: column + forward spout
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.22, 10), steelMat());
      col.position.set(wM * 0.2, baseTop + WORKTOP + 0.11, dM * 0.16);
      g.add(col);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 10), steelMat());
      spout.position.set(wM * 0.2, baseTop + WORKTOP + 0.21, dM * 0.3);
      spout.rotation.x = Math.PI / 2;
      g.add(spout);
    } else if (c.appliance === "hob" || c.appliance === "cooktop") {
      if (c.appliance === "hob") {
        add(wM - 0.06, h - 0.14, 0.02, 0, yc, dM + 0.01, steelMat()); // oven front
        add(wM - 0.16, h - 0.34, 0.012, 0, yc + 0.02, dM + 0.02, mat(STEEL_DARK)); // window
        bar(wM - 0.18, false, 0, baseTop - 0.06, dM + 0.02); // oven handle
      } else {
        facade(add, handle, c, wM, h, yc, dM, style, M, g); // drawers below cooktop
      }
      const topY = baseTop + WORKTOP + 0.006;
      add(wM * 0.92, 0.012, dM * 0.8, 0, topY, dM * 0.5, mat(STEEL_DARK)); // hob glass
      for (const [a, b2] of [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]] as const) {
        const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16), mat(0x111417));
        burner.position.set(wM * a, topY + 0.006, dM * (0.5 + b2));
        g.add(burner);
      }
    } else if (c.appliance === "dishwasher") {
      add(wM - 0.02, h - 0.02, 0.02, 0, yc, dM + 0.01, facadeMat());
      add(wM - 0.06, 0.03, 0.02, 0, baseTop - 0.06, dM + 0.02, steelMat());
    } else if (c.appliance === "washer") {
      // front-loader: a white steel front (or a matching facade when integrated) with a
      // round porthole door — the tell-tale washing-machine detail.
      add(wM - 0.02, h - 0.02, 0.02, 0, yc, dM + 0.01, c.builtin ? facadeMat() : mat(0xf2f2f0));
      const door = new THREE.Mesh(new THREE.CylinderGeometry(wM * 0.34, wM * 0.34, 0.03, 24), mat(STEEL_DARK));
      door.rotation.x = Math.PI / 2;
      door.position.set(0, yc + 0.03, dM + 0.02);
      g.add(door);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(wM * 0.24, wM * 0.24, 0.02, 24), mat(0x1a1d20));
      glass.rotation.x = Math.PI / 2;
      glass.position.set(0, yc + 0.03, dM + 0.03);
      g.add(glass);
      add(wM - 0.08, 0.05, 0.02, 0, baseTop - 0.07, dM + 0.02, steelMat()); // detergent drawer / control strip
    } else {
      buildModuleInterior(add, handle, c, wM, h, dM, yc, style, M, false, g);
    }

    // bar stools tucked under a free-standing island/peninsula
    if (freestanding && c.w >= 400) {
      const sz = dM + front - 0.12; // under the overhang, on the room side
      const seatMat = mat(0x4a4640, { roughness: 0.7 });
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), seatMat);
      seat.position.set(0, 0.6, sz);
      g.add(seat);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.56, 10), steelMat());
      post.position.set(0, 0.3, sz);
      g.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), steelMat());
      foot.position.set(0, 0.02, sz);
      g.add(foot);
    }

    // the base cabinet SITS on the floor — say so
    contactShadow(g, wM, dM);
    seatModule(root, g);
  }

  // ── FILLER PANELS ("доборы") ──────────────────────────────────────────────────────────────────
  // A scribe strip at each run end that butts a perpendicular wall (keeps a door off the wall +
  // absorbs an out-of-true wall) and, on a floor-to-ceiling run, a horizontal strip closing the gap
  // to the ceiling. Drawn straight from the run geometry + reserved reveal, so they sit exactly in
  // the dead zone the layout already left empty and can never drift from it.
  {
    const ceilM = (ceiling ?? 0) / 1000;
    // the doors sit ~15mm proud of the carcass front (facades are built at dM+0.011..0.02), so a
    // carcass-depth panel looks recessed — reach the door face so the filler is flush with the fronts.
    const FRONT_PROUD = 0.016;
    // a thin facade panel of run-length `wRun`, `hh` tall from `yBase`, `dep` deep, centred at run-metre
    // `sC` with its BACK at the wall (like a module) and its FRONT flush with the door faces.
    const panelAt = (p: Placement, sC: number, wRun: number, yBase: number, hh: number, dep: number, fin?: Cabinet["finish"]) => {
      if (wRun <= 0.001 || hh <= 0.001) return;
      const d = dep + FRONT_PROUD;
      const fillerMat = makeMats(fin, style).facade();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wRun, hh, d), fillerMat);
      mesh.position.set(p.ax + p.ux * sC + p.ix * (d / 2), yBase + hh / 2, p.az + p.uz * sC + p.iz * (d / 2));
      mesh.rotation.y = -Math.atan2(p.uz, p.ux);
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
    };
    runs.forEach((ref, r) => {
      if (ref.kind !== "wall") return;
      const revS = ref.revealStart ?? 0;
      const revE = ref.revealEnd ?? 0;
      const p = ref.placement;
      const onRun = cabs.filter(
        (c) => (c.run ?? 0) === r && c.px == null && c.appliance !== "filler" && !c.furniture && !c.corner,
      );
      if (!onRun.length) return;
      const talls = onRun.filter((c) => c.kind === "tall");
      const uppers = onRun.filter((c) => c.kind === "upper" && c.appliance !== "hood");
      const topOf = (arr: Cabinet[]) => (arr.length ? Math.max(...arr.map((c) => cabBand(c).y1)) / 1000 : 0);
      const depthOf = (arr: Cabinet[], fb: number) => (arr.length ? cabDepth(arr[0]) / 1000 : fb);
      // the module NEAREST this end (start = smallest x, end = largest x+w). Uses the run-local x the
      // grid writes; the filler then matches exactly what stands beside it instead of the run's tallest.
      const edge = (pool: Cabinet[], atStart: boolean): Cabinet | null => {
        if (!pool.length) return null;
        const key = (c: Cabinet) => (atStart ? (c.x ?? 0) : -((c.x ?? 0) + c.w));
        return pool.reduce((b, c) => (key(c) < key(b) ? c : b));
      };
      const asPanel = (sC: number, wRun: number, c: Cabinet) => {
        const b = cabBand(c);
        // Align with carcass heights to avoid plinth and countertop overlaps
        panelAt(p, sC, wRun, b.carcass0 / 1000, (b.carcass1 - b.carcass0) / 1000, cabDepth(c) / 1000, c.finish);
      };

      // vertical side filler — MATCH THE MODULE AT THIS END: a full-height column gives one strip; a
      // base+upper end gives a base strip and an upper strip with the backsplash gap left open between.
      // Supports arbitrary rows (e.g. base + row 2 uppers + row 3 antresol).
      const drawSide = (sC: number, wRun: number, atStart: boolean) => {
        const levels = new Map<number, Cabinet[]>();
        for (const c of onRun) {
          const b = cabBand(c);
          const list = levels.get(b.carcass0) ?? [];
          list.push(c);
          levels.set(b.carcass0, list);
        }
        for (const pool of levels.values()) {
          const outer = edge(pool, atStart);
          if (outer) asPanel(sC, wRun, outer);
        }
      };
      if (revS > 0) drawSide(revS / 2000, revS / 1000, true); // start band, flush to the wall (no corner here)
      if (revE > 0) drawSide(p.lenM - revE / 2000, revE / 1000, false); // end band

      // horizontal TOP filler: a floor-to-ceiling run whose tallest column intentionally stops a
      // reveal short of the ceiling (see the solver) gets a scribe strip closing that small gap.
      // Spans wall-to-wall and matches the depth of the top-row modules (e.g. 3rd row antresol).
      const colTop = Math.max(topOf(talls), topOf(uppers));
      const gap = ceilM - colTop;
      if (ceilM > 0 && colTop > 0 && gap > 0.002 && gap <= 0.12) {
        const topCabs = onRun.filter((c) => Math.abs(cabBand(c).y1 / 1000 - colTop) < 0.01);
        const dep = topCabs.length
          ? Math.max(...topCabs.map(cabDepth)) / 1000
          : (talls.length ? depthOf(talls, 0.56) : depthOf(uppers, 0.35));
        const s0 = 0;
        const s1 = p.lenM;
        const topCab = edge(topCabs.length ? topCabs : onRun.filter((c) => c.kind === "tall" || c.kind === "upper"), true);
        panelAt(p, (s0 + s1) / 2, s1 - s0, colTop, gap, dep, topCab?.finish);
      }
    });
  }
  return root;
}

type AddFn = (w: number, h: number, d: number, lx: number, ly: number, lz: number, m: THREE.Material, target?: THREE.Object3D) => void;
type BarFn = (length: number, vertical: boolean, lx: number, ly: number, lz: number, target?: THREE.Object3D) => void;

// re-pivot a group around (px, _, pz) by shifting its children the opposite way, so
// rotating/sliding the group hinges at that point while staying visually put at rest
function pivotGroup(group: THREE.Group, px: number, pz: number) {
  for (const ch of group.children) {
    ch.position.x -= px;
    ch.position.z -= pz;
  }
  group.position.set(px, 0, pz);
}
// same, but around a HORIZONTAL edge (py, _, pz) → rotating on X lifts/flaps the group
function pivotGroupY(group: THREE.Group, py: number, pz: number) {
  for (const ch of group.children) {
    ch.position.y -= py;
    ch.position.z -= pz;
  }
  group.position.set(0, py, pz);
}

const DOOR_OPEN_RAD = Math.PI / 2; // exactly 90° swing

/** One BAY of a shared carcass. Absent → an ordinary standalone cabinet, sealed on both sides. */
interface Bay {
  /** the leftmost bay draws the box's outer left side; the others open into their neighbour */
  first: boolean;
  /** the rightmost bay draws the box's outer right side; the others end in a SHARED STILE */
  last: boolean;
}

// a hollow carcass — 2 sides, top, bottom, back (open front) — so an open door/
// drawer reveals a real interior instead of a solid block.
//
// MERGED ROWS DRAW WHAT THE SHOP BUILDS. Four cabinets in one box are not four boxes: there is ONE
// panel at each internal boundary, straddling it, not two side panels back to back. So a bay draws
// its left side only if it is the first in the box, and its right panel is a shared stile (centred
// on the boundary) unless it is the last. Four bays → 1 + 4 = 5 verticals, exactly the 5 the cut
// list bills. Rendering it any other way would put the seller's 3D and the factory's DXF at odds.
function hollowCarcass(add: AddFn, wM: number, h: number, dM: number, yc: number, m: () => THREE.Material, bay?: Bay) {
  const t = CARCASS_T;
  if (!bay || bay.first) add(t, h, dM, -wM / 2 + t / 2, yc, dM / 2, m()); // outer left
  const stile = bay ? !bay.last : false;
  add(t, h, dM, stile ? wM / 2 : wM / 2 - t / 2, yc, dM / 2, m()); // shared stile, or outer right
  add(wM, t, dM, 0, yc - h / 2 + t / 2, dM / 2, m()); // bottom — butts into the next bay's
  add(wM, t, dM, 0, yc + h / 2 - t / 2, dM / 2, m()); // top — ditto, so the box reads as one slab
  // a merged box has ONE back running the whole width; inset each bay's and you'd see gaps of bare
  // wall at every boundary
  add(bay ? wM : wM - t * 2, h - t * 2, t, 0, yc, t / 2, m());
}

// ── HYBRID INTERIOR (cell tree) ────────────────────────────────────────────────
// A cell occupies an interior sub-rect in fractions [fx0..fx1]×[fy0..fy1] (x across the
// width from the left, y up from the bottom). A split builds carcass dividers at the child
// boundaries + recurses; a leaf builds its own front (door / drawers / open) + shelves.
interface Rect { fx0: number; fy0: number; fx1: number; fy1: number; }

// place a handle bar/knob on the chosen edge of a front (vertical bar for left/right)
function placeHandle(handle: BarFn, pos: HandlePos, xL: number, xR: number, yB: number, yT: number, z: number, target: THREE.Object3D) {
  const wL = xR - xL, hL = yT - yB, xC = (xL + xR) / 2, yC = (yB + yT) / 2, m = 0.05, zz = z + 0.012;
  if (pos === "none") return; // handleless — push-to-open latch (no visible pull)
  if (pos === "center") handle(0.05, false, xC, yC, zz, target); // central knob
  else if (pos === "top") handle(Math.min(0.22, wL * 0.4), false, xC, yT - m, zz, target);
  else if (pos === "bottom") handle(Math.min(0.22, wL * 0.4), false, xC, yB + m, zz, target);
  else if (pos === "left") handle(Math.min(0.22, hL * 0.4), true, xL + m, yC, zz, target);
  else handle(Math.min(0.22, hL * 0.4), true, xR - m, yC, zz, target);
}

// organizer (cutlery-tray) dividers inside a drawer box, from a top-down cell tree in the
// width(X) × depth(Z) plane. "cols" splits width → a panel spanning depth; "rows" splits
// depth → a panel spanning width. Panels are `panelH` tall (= the drawer wall height).
function addOrganizer(add: AddFn, cell: Cell, xC: number, fwInner: number, floorY: number, panelH: number, cz: number, boxD: number, m: THREE.Material, drw: THREE.Group, r: Rect) {
  if (isLeaf(cell)) return;
  const sizes = cellSizes(cell), orgT = 0.006, yc = floorY + panelH / 2;
  const xAt = (ufx: number) => xC - fwInner / 2 + fwInner * ufx;
  const zAt = (ufz: number) => cz - boxD / 2 + boxD * ufz;
  let acc = 0;
  for (let i = 0; i < cell.children!.length; i++) {
    const f = sizes[i];
    const sub: Rect = cell.split === "rows"
      ? { fx0: r.fx0, fy0: r.fy0 + (r.fy1 - r.fy0) * acc, fx1: r.fx1, fy1: r.fy0 + (r.fy1 - r.fy0) * (acc + f) }
      : { fx0: r.fx0 + (r.fx1 - r.fx0) * acc, fy0: r.fy0, fx1: r.fx0 + (r.fx1 - r.fx0) * (acc + f), fy1: r.fy1 };
    addOrganizer(add, cell.children![i], xC, fwInner, floorY, panelH, cz, boxD, m, drw, sub);
    acc += f;
    if (i < cell.children!.length - 1) {
      if (cell.split === "rows") add(fwInner * (r.fx1 - r.fx0) * 0.98, panelH, orgT, xAt((r.fx0 + r.fx1) / 2), yc, zAt(r.fy0 + (r.fy1 - r.fy0) * acc), m, drw);
      else add(orgT, panelH, boxD * (r.fy1 - r.fy0) * 0.98, xAt(r.fx0 + (r.fx1 - r.fx0) * acc), yc, zAt((r.fy0 + r.fy1) / 2), m, drw);
    }
  }
}

// a door / drawer front covering a sub-rect (door: opening side + handle placement). Used
// for both a cell's own front and a combined-door overlay (any rectangle of cells).
function buildFront(add: AddFn, handle: BarFn, kind: "door" | "drawer", opening: DoorOpening | undefined, handlePos: HandlePos | undefined, organizer: Cell | undefined, wM: number, h: number, dM: number, yc: number, style: KitchenStyle, M: Mats, isUpper: boolean, profile: FrontProfile, g: THREE.Group, r: Rect) {
  const t = CARCASS_T, iw = wM - 2 * t, ih = h - 2 * t;
  const REVEAL = 0.0025; // ~2.5 mm gap between adjacent overlay fronts
  // OVERLAY extent: cover the carcass out to the MODULE edge at an outer boundary, and meet
  // near the divider centre at an interior boundary — so only a thin reveal shows (a real
  // overlay front, not a small panel inset inside the box exposing the carcass).
  const outerL = r.fx0 <= 0.001, outerR = r.fx1 >= 0.999, outerB = r.fy0 <= 0.001, outerT = r.fy1 >= 0.999;
  const xL = (outerL ? -wM / 2 : -wM / 2 + t + iw * r.fx0) + (outerL ? REVEAL : REVEAL / 2);
  const xR = (outerR ? wM / 2 : -wM / 2 + t + iw * r.fx1) - (outerR ? REVEAL : REVEAL / 2);
  const yB = (outerB ? yc - h / 2 : yc - h / 2 + t + ih * r.fy0) + (outerB ? REVEAL : REVEAL / 2);
  const yT = (outerT ? yc + h / 2 : yc - h / 2 + t + ih * r.fy1) - (outerT ? REVEAL : REVEAL / 2);
  const xC = (xL + xR) / 2, yC2 = (yB + yT) / 2, z = dM + 0.01;
  const fw = xR - xL, fh = yT - yB;

  // ONE material for the whole front — and it is the module's, so a 5-mesh shaker front and the
  // carcass behind it share exactly one facade material.
  const fmat = M.facade();

  if (kind === "drawer") {
    const drw = new THREE.Group();
    // a drawer face is a front like any other — it gets the module's profile, which is exactly how
    // the fluted kitchens in the photos are built (ribbed drawer banks under a ribbed door)
    frontFace(profile, fw, fh, xC, yC2, z, fmat, drw, M.glass());
    if (hasBody(profile)) placeHandle(handle, handlePos ?? "top", xL, xR, yB, yT, z, drw);
    const boxMat = M.box();
    const boxD = dM * 0.85, sideH = Math.min(fh * 0.5, 0.12), bt = 0.012, cz = z - boxD / 2 - 0.006, fy0 = yB + 0.02;
    add(fw - 0.04, bt, boxD, xC, fy0 + 0.02, cz, boxMat, drw);
    add(bt, sideH, boxD, xC - (fw / 2 - bt), fy0 + sideH / 2 + 0.02, cz, boxMat, drw);
    add(bt, sideH, boxD, xC + (fw / 2 - bt), fy0 + sideH / 2 + 0.02, cz, boxMat, drw);
    add(fw - 0.02, sideH, bt, xC, fy0 + sideH / 2 + 0.02, z - boxD, boxMat, drw);
    // organizer (cutlery-tray) dividers — same height as the drawer walls (sideH)
    if (organizer) addOrganizer(add, organizer, xC, fw - 2 * bt, fy0 + 0.02, sideH, cz, boxD - 2 * bt, boxMat, drw, { fx0: 0, fy0: 0, fx1: 1, fy1: 1 });
    drw.userData.openable = { kind: "drawer", maxZ: dM * 0.6 };
    g.add(drw);
    return;
  }

  // door: the profile's BODY (three/frontFace) + handle (placement) + hinge (opening side;
  // top/bottom = hydraulic lift). The front style is per-module and AUTHORITATIVE — a kitchen-wide
  // style flag never overrides it, so a variant's glass uppers survive because those uppers ARE
  // generated glass, not because a preset says so.
  //
  // «Без» (none) really means none: no leaf, no handle, no hinge — just the open carcass. This path
  // used to draw a door anyway (only the legacy sink/cooktop facade() honoured it), which is also
  // what pricing has always done — cutFronts bills nothing for a "none" module.
  if (!hasBody(profile)) return;
  const door = new THREE.Group();
  frontFace(profile, fw, fh, xC, yC2, z, fmat, door, M.glass());
  const opn = opening ?? "left";
  const hpos: HandlePos = handlePos ?? (opn === "left" ? "right" : opn === "right" ? "left" : opn === "top" ? "bottom" : "top");
  placeHandle(handle, hpos, xL, xR, yB, yT, z, door);
  // hinge on the DOOR's own edge (xL/xR/yB/yT) at the carcass front (hz=dM), NOT proud of
  // the box — otherwise an open door floats with a gap. top/bottom rotate on X and must
  // swing OUT (+z): top lifts up (−rad), bottom flaps down (+rad).
  const hz = dM;
  if (opn === "left") { pivotGroup(door, xL, hz); door.userData.openable = { kind: "door", axis: "y", rad: -DOOR_OPEN_RAD }; }
  else if (opn === "right") { pivotGroup(door, xR, hz); door.userData.openable = { kind: "door", axis: "y", rad: DOOR_OPEN_RAD }; }
  else if (opn === "top") { pivotGroupY(door, yT, hz); door.userData.openable = { kind: "door", axis: "x", rad: -DOOR_OPEN_RAD }; }
  else { pivotGroupY(door, yB, hz); door.userData.openable = { kind: "door", axis: "x", rad: DOOR_OPEN_RAD }; }
  g.add(door);
}

// interior structure BEHIND a front (a combined door) — split dividers only, no sub-fronts
function buildInterior(add: AddFn, cell: Cell, wM: number, h: number, dM: number, yc: number, carcassMat: () => THREE.Material, r: Rect) {
  if (isLeaf(cell)) return;
  const t = CARCASS_T, iw = wM - 2 * t, ih = h - 2 * t, x0 = -wM / 2 + t, yb = yc - h / 2 + t, zc = dM / 2 + t / 2, zd = dM - t - 0.03;
  const sizes = cellSizes(cell);
  let acc = 0;
  for (let i = 0; i < cell.children!.length; i++) {
    const f = sizes[i];
    const sub: Rect = cell.split === "rows"
      ? { fx0: r.fx0, fy0: r.fy0 + (r.fy1 - r.fy0) * acc, fx1: r.fx1, fy1: r.fy0 + (r.fy1 - r.fy0) * (acc + f) }
      : { fx0: r.fx0 + (r.fx1 - r.fx0) * acc, fy0: r.fy0, fx1: r.fx0 + (r.fx1 - r.fx0) * (acc + f), fy1: r.fy1 };
    buildInterior(add, cell.children![i], wM, h, dM, yc, carcassMat, sub);
    acc += f;
    if (i < cell.children!.length - 1) {
      if (cell.split === "rows") add(iw * (r.fx1 - r.fx0), t, zd, x0 + iw * (r.fx0 + r.fx1) / 2, yb + ih * (r.fy0 + (r.fy1 - r.fy0) * acc), zc, carcassMat());
      else add(t, ih * (r.fy1 - r.fy0), zd, x0 + iw * (r.fx0 + (r.fx1 - r.fx0) * acc), yb + ih * (r.fy0 + r.fy1) / 2, zc, carcassMat());
    }
  }
}

// recurse the cell tree: a node with a `front` gets ONE front over its whole rect (+ its
// children rendered as the interior behind it); an un-fronted split recurses into cells.
function buildCells(add: AddFn, handle: BarFn, cell: Cell, wM: number, h: number, dM: number, yc: number, style: KitchenStyle, M: Mats, isUpper: boolean, profile: FrontProfile, g: THREE.Group, r: Rect = { fx0: 0, fy0: 0, fx1: 1, fy1: 1 }) {
  if (cell.front) {
    buildFront(add, handle, cell.front, cell.opening, cell.handle, cell.organizer, wM, h, dM, yc, style, M, isUpper, profile, g, r);
    if (cell.children && cell.children.length) buildInterior(add, cell, wM, h, dM, yc, M.carcass, r);
    return;
  }
  if (isLeaf(cell)) return; // open compartment — the hollow carcass shows through
  const t = CARCASS_T, iw = wM - 2 * t, ih = h - 2 * t, x0 = -wM / 2 + t, yb = yc - h / 2 + t, zc = dM / 2 + t / 2, zd = dM - t - 0.03;
  const sizes = cellSizes(cell);
  let acc = 0;
  for (let i = 0; i < cell.children!.length; i++) {
    const f = sizes[i];
    const sub: Rect = cell.split === "rows"
      ? { fx0: r.fx0, fy0: r.fy0 + (r.fy1 - r.fy0) * acc, fx1: r.fx1, fy1: r.fy0 + (r.fy1 - r.fy0) * (acc + f) }
      : { fx0: r.fx0 + (r.fx1 - r.fx0) * acc, fy0: r.fy0, fx1: r.fx0 + (r.fx1 - r.fx0) * (acc + f), fy1: r.fy1 };
    buildCells(add, handle, cell.children![i], wM, h, dM, yc, style, M, isUpper, profile, g, sub);
    acc += f;
    if (i < cell.children!.length - 1) {
      if (cell.split === "rows") add(iw * (r.fx1 - r.fx0), t, zd, x0 + iw * (r.fx0 + r.fx1) / 2, yb + ih * (r.fy0 + (r.fy1 - r.fy0) * acc), zc, M.carcass());
      else add(t, ih * (r.fy1 - r.fy0), zd, x0 + iw * (r.fx0 + (r.fx1 - r.fx0) * acc), yb + ih * (r.fy0 + r.fy1) / 2, zc, M.carcass());
    }
  }
}

// the whole module interior: the cell tree (structure + per-cell fronts) + any combined-door
// overlays (one door over a rectangle of cells; the cells behind it show as interior shelves)
function buildModuleInterior(add: AddFn, handle: BarFn, c: Cabinet, wM: number, h: number, dM: number, yc: number, style: KitchenStyle, M: Mats, isUpper: boolean, g: THREE.Group) {
  const profile = frontOf(c); // flat / shaker / raised / fluted / glass / grid / none — per module
  buildCells(add, handle, cabinetLayout(c), wM, h, dM, yc, style, M, isUpper, profile, g);
  for (const cd of c.combinedDoors ?? [])
    buildFront(add, handle, "door", cd.opening, cd.handle, undefined, wM, h, dM, yc, style, M, isUpper, profile, g, { fx0: cd.fx0, fy0: cd.fy0, fx1: cd.fx1, fy1: cd.fy1 });
}

/** Carve a facade onto the front of a carcass: drawers / a (glass) door / open.
 *  Doors + drawers are built as `userData.openable` subgroups so the 3D view can
 *  animate them (door hinges on its handle-opposite edge; drawer slides forward). */
function facade(add: AddFn, bar: BarFn, c: Cabinet, wM: number, h: number, yc: number, dM: number, style: KitchenStyle, M: Mats, g: THREE.Group) {
  const z = dM + 0.011;
  const inset = 0.02;
  const bottom = yc - h / 2;
  const profile = frontOf(c); // the same body the cell-tree path builds — one generator, no drift
  const fmat = M.facade();

  // no door: an explicit "Без" facade OR an "Открытый" (open) module → open front
  if ((!hasBody(profile) || c.fill === "open") && c.fill !== "drawers") {
    add(wM - inset * 2, h - inset * 2, 0.01, 0, yc, dM * 0.15, M.flat(0xcfc7b8, { roughness: 0.95 }));
    return;
  }

  if (c.fill === "drawers" && c.count > 0) {
    const n = c.count;
    const gap = 0.012;
    const fh = (h - inset * 2 - gap * (n - 1)) / n;
    const boxMat = M.box();
    const fwD = wM - inset * 2; // drawer width
    const boxD = dM * 0.85; // box depth (stays partly inside when pulled → no float)
    const sideH = Math.min(fh * 0.55, 0.12); // low box walls
    const t = 0.012;
    for (let i = 0; i < n; i++) {
      const fy = bottom + inset + fh / 2 + i * (fh + gap);
      const drw = new THREE.Group();
      frontFace(profile, fwD, fh, 0, fy, z, fmat, drw, M.glass()); // front
      bar(wM * 0.4, false, 0, fy + fh / 2 - 0.03, z + 0.012, drw); // handle
      // open-top box behind the front (floor + 2 sides + back) so it reads as a real drawer
      const cz = z - boxD / 2 - 0.006; // box centre z
      const fy0 = fy - fh / 2; // drawer-front bottom
      add(fwD - 0.02, t, boxD, 0, fy0 + 0.02, cz, boxMat, drw); // floor
      add(t, sideH, boxD, -(fwD / 2 - t), fy0 + sideH / 2 + 0.02, cz, boxMat, drw); // left wall
      add(t, sideH, boxD, fwD / 2 - t, fy0 + sideH / 2 + 0.02, cz, boxMat, drw); // right wall
      add(fwD - 0.02, sideH, t, 0, fy0 + sideH / 2 + 0.02, z - boxD, boxMat, drw); // back wall
      // staggered open: lower drawers out less, top drawer most (IKEA-style cascade)
      const frac = n > 1 ? 0.45 + 0.32 * (i / (n - 1)) : 0.62;
      drw.userData.openable = { kind: "drawer", maxZ: dM * frac };
      g.add(drw);
    }
    return;
  }

  const fw = wM - inset * 2;
  const door = new THREE.Group();
  frontFace(profile, fw, h - inset * 2, 0, yc, z, fmat, door, M.glass()); // door panel
  bar(Math.min(0.22, h * 0.3), true, wM / 2 - 0.05, yc, z + 0.012, door); // handle (right) → hinge left
  pivotGroup(door, -fw / 2, z); // hinge on the front-left vertical edge
  door.userData.openable = { kind: "door", maxRad: DOOR_OPEN_RAD };
  g.add(door);
}
