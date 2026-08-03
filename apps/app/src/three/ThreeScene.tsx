// Live 3D room (three.js setup adapted from spike-3d.html: capped DPR,
// render-on-demand, OrbitControls, explicit dispose). Wood floor + light walls,
// with WALL CULLING — walls between the camera and the interior are hidden so you
// can see inside; they reappear as the camera orbits past them.
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { polygonBoundsMm, offsetPolygon, defaultOpeningSill, defaultOpeningHeight, openingSpan, wallSegments, openingFinish, type Pt, type Opening, type Fitting } from "../model/room";
import { leafRects, coveringColor, defaultSurface, type Surface } from "../model/walls";
import { PBR, applyPbrFloor, onTexturesReady, texturedMaterial } from "./pbr";
import { buildRig } from "./lighting";

export type SceneView = "3d" | "plan" | "front";

export interface WallInfo {
  mesh: THREE.Object3D;
  nx: number; // outward normal (xz)
  nz: number;
  mx: number; // midpoint (xz)
  mz: number;
}

function darken(hex: string, f: number, a = 1): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * f);
  return `rgba(${r},${g},${b},${a})`;
}

function segAngle(x0: number, y0: number, x1: number, y1: number): number {
  let a = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  return a;
}

function arrowScale(spanPx: number): number {
  return Math.max(0.45, Math.min(1.15, spanPx / 170));
}

export function makeWoodTexture(base: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    const y = i * 32;
    ctx.fillStyle = i % 2 ? darken(base, 0.95) : base;
    ctx.fillRect(0, y, 256, 32);
    ctx.strokeStyle = darken(base, 0.7, 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(256, y + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace; // render covering colours accurately
  return tex;
}

// fills the opening void with a (procedurally detailed) window or door, centred in
// the hole. A bare wall opening fills NOTHING — it's a true cut-through hole.
const WIN_GRID: Record<string, [number, number]> = { single: [1, 1], twin: [2, 1], grid: [2, 2], triple: [3, 1], pano: [1, 1], balcony: [2, 1] };

function makeOpening(
  C0: { x: number; z: number },
  C1: { x: number; z: number },
  t: number,
  widthM: number,
  heightM: number,
  kind: "window" | "door" | "opening",
  design: string,
  sillM: number,
  finishId?: string,
): THREE.Object3D[] {
  if (kind === "opening") return [];
  // resolve the chosen frame/leaf finish (colour or wood texture); a wood finish uses a
  // PBR material, a colour finish a flat one, undefined keeps the per-kind default
  const fin = openingFinish(finishId);
  const finMat = (fallback: number, rough: number) => {
    if (!fin) return new THREE.MeshStandardMaterial({ color: fallback, roughness: rough });
    if (fin.tex) {
      const m = texturedMaterial(fin.tex, parseInt(fin.color.slice(1), 16));
      if (m) return m;
    }
    return new THREE.MeshStandardMaterial({ color: fin.color, roughness: rough });
  };
  const shade = (hex: string, mul: number) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * mul));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * mul));
    const b = Math.min(255, Math.round((n & 255) * mul));
    return (r << 16) | (g << 8) | b;
  };
  const cx = C0.x + (C1.x - C0.x) * t;
  const cz = C0.z + (C1.z - C0.z) * t;
  const angle = Math.atan2(C1.z - C0.z, C1.x - C0.x);
  const w = widthM;

  const grp = new THREE.Group();
  grp.position.set(cx, 0, cz);
  grp.rotation.y = -angle;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    grp.add(m);
  };
  const box = (a: number, b: number, c: number) => new THREE.BoxGeometry(a, b, c);

  if (kind === "window") {
    const sill = sillM; // bottom above floor (m)
    const h = heightM > 0 ? heightM : 1.2;
    const fw = design === "pano" ? 0.045 : 0.06;
    const top = sill + h;
    const yc = (sill + top) / 2;
    const frameMat = finMat(0xf4f4f4, 0.6);
    // the casing lip overlaps the wall/paint at nearly the same depth → z-fight ("glitch")
    // once it's a colour; a polygon-offset biases the frame in front so it always wins
    frameMat.polygonOffset = true;
    frameMat.polygonOffsetFactor = -2;
    frameMat.polygonOffsetUnits = -2;
    const glass = new THREE.MeshStandardMaterial({ color: 0xaedcf0, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.1 });
    const mull = fin ? finMat(0xeaeaea, 0.6) : new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.6 });
    // frame stands PROUD of the wall (depth 0.14 > wall 0.1) so its faces never sit
    // coplanar with the wall/paint — that co-planarity z-fights ("glitches"), which only
    // shows once the frame is a non-white colour
    const fd = 0.14;
    add(box(w, h, 0.02), glass, 0, yc, 0); // glass
    add(box(w + 2 * fw, fw, fd), frameMat, 0, top + fw / 2, 0); // top
    add(box(w + 2 * fw, fw, fd), frameMat, 0, sill - fw / 2, 0); // bottom
    add(box(fw, h + 2 * fw, fd), frameMat, -w / 2 - fw / 2, yc, 0); // left
    add(box(fw, h + 2 * fw, fd), frameMat, w / 2 + fw / 2, yc, 0); // right
    const [cols, rows] = WIN_GRID[design] ?? [2, 1];
    for (let k = 1; k < cols; k++) add(box(0.04, h, 0.06), mull, -w / 2 + (k * w) / cols, yc, 0.01);
    for (let k = 1; k < rows; k++) add(box(w, 0.04, 0.06), mull, 0, sill + (k * h) / rows, 0.01);
    add(box(w + 2 * fw, 0.05, 0.16), frameMat, 0, sill - fw, 0.03); // sill ledge
    return [grp];
  }

  // door
  const h = heightM > 0 ? heightM : 2.05;
  const fw = 0.07; // casing width
  const yc = h / 2;
  const caseMat = fin ? finMat(0xcdbfa6, 0.8) : new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.8 });
  // the casing lip overlaps the wall/paint at near-equal depth → z-fight ("glitch") at the
  // door corners; bias it forward so it always wins (same fix as the window frame)
  caseMat.polygonOffset = true;
  caseMat.polygonOffsetFactor = -2;
  caseMat.polygonOffsetUnits = -2;
  const leafMat = finMat(0xd8cbb2, 0.85);
  const panelMat = fin ? new THREE.MeshStandardMaterial({ color: shade(fin.color, 0.88), roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: 0xc3b496, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xaedcf0, transparent: true, opacity: 0.4, roughness: 0.1 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.4, metalness: 0.6 });
  const leaves = design === "double" ? 2 : 1;
  const lw = (w - (leaves - 1) * 0.02) / leaves; // per-leaf width
  add(box(fw, h + fw, 0.14), caseMat, -w / 2 - fw / 2, yc, 0); // left casing
  add(box(fw, h + fw, 0.14), caseMat, w / 2 + fw / 2, yc, 0); // right casing
  add(box(w + 2 * fw, fw, 0.14), caseMat, 0, h + fw / 2, 0); // head casing
  for (let li = 0; li < leaves; li++) {
    const lx = -w / 2 + lw / 2 + li * (lw + 0.02);
    add(box(lw - 0.02, h - 0.03, 0.05), leafMat, lx, yc, 0); // leaf
    if (design === "glazed") {
      add(box(lw * 0.7, h * 0.42, 0.02), glassMat, lx, yc + h * 0.2, 0.03); // glass upper
      add(box(lw * 0.7, h * 0.26, 0.02), panelMat, lx, yc - h * 0.26, 0.03); // panel lower
    } else if (design !== "solid") {
      add(box(lw * 0.66, h * 0.34, 0.02), panelMat, lx, yc + h * 0.22, 0.03); // upper panel
      add(box(lw * 0.66, h * 0.34, 0.02), panelMat, lx, yc - h * 0.22, 0.03); // lower panel
    }
    const hx = leaves === 2 ? (li === 0 ? lx + lw / 2 - 0.08 : lx - lw / 2 + 0.08) : lx + lw / 2 - 0.1;
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), handleMat, hx, yc, 0.06); // handle
  }
  return [grp];
}

// a wall fitting (socket/switch, radiator, vent) on the inner face at fraction `t`
function makeFitting(
  I0: { x: number; z: number },
  I1: { x: number; z: number },
  fit: Fitting,
  inwardX: number,
  inwardZ: number,
  ceilingM: number,
): THREE.Mesh[] {
  const cx = I0.x + (I1.x - I0.x) * fit.t;
  const cz = I0.z + (I1.z - I0.z) * fit.t;
  const angle = Math.atan2(I1.z - I0.z, I1.x - I0.x);
  const widthM = fit.width / 1000;

  let w: number;
  let h: number;
  let depth: number;
  let yc: number;
  let color: number;
  if (fit.category === "heating") {
    w = Math.max(widthM, 0.5);
    h = 0.5;
    depth = 0.09;
    yc = 0.4; // sits low on the wall
    color = 0xf2efe8;
  } else if (fit.category === "vent") {
    w = Math.max(widthM, 0.2);
    h = w;
    depth = 0.05;
    yc = ceilingM - 0.45; // near the ceiling
    color = 0xd0d0d0;
  } else {
    w = 0.12; // socket / switch plate
    h = 0.12;
    depth = 0.035;
    yc = fit.kind.startsWith("switch") ? 1.25 : 1.05;
    color = 0xf4f4f4;
  }
  if (fit.height != null && fit.category !== "electric") h = Math.max(0.1, fit.height / 1000);
  if (fit.mountY != null) yc = Math.max(h / 2, Math.min(ceilingM - h / 2, fit.mountY / 1000));

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  const meshes = [plate];
  // a darker inset face so it reads against the wall
  if (fit.category === "electric") {
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.55, h * 0.55, depth + 0.01),
      new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.7 }),
    );
    meshes.push(face);
  }
  for (const m of meshes) {
    m.position.set(cx + inwardX * (depth / 2 + 0.01), yc, cz + inwardZ * (depth / 2 + 0.01));
    m.rotation.y = -angle;
    m.userData.fitting = fit.id; // raycast target → selects/drags this item
  }
  return meshes;
}

export function makeRoom(
  outer: { x: number; z: number }[],
  inner: { x: number; z: number }[],
  ceilingM: number,
  wood: THREE.Texture,
  openings: Opening[],
  interior: { x: number; z: number }[][],
  fittings: Fitting[],
  wallSurfaces: Record<number, Surface>,
  selected: number | null,
  selectedFit: string | null,
  selectedOpen: string | null,
  floorSel: boolean,
): { group: THREE.Group; walls: WallInfo[] } {
  const g = new THREE.Group();

  // floor (UVs are in metres → wood tiles ~1 plank-set per metre)
  const floorShape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.z)));
  const floorGeo = new THREE.ShapeGeometry(floorShape);
  floorGeo.rotateX(Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.95, side: THREE.DoubleSide });
  if (floorSel) {
    floorMat.emissive = new THREE.Color(0x00ac7a);
    floorMat.emissiveIntensity = 0.18;
  }
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.userData.floor = true; // raycast target → selects the floor
  g.add(floor);

  const cx = outer.reduce((s, p) => s + p.x, 0) / outer.length;
  const cz = outer.reduce((s, p) => s + p.z, 0) / outer.length;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 1 });
  const walls: WallInfo[] = [];
  const wallNormals: { nx: number; nz: number; mx: number; mz: number }[] = []; // per room wall
  const n = outer.length;
  const T3 = 0.1; // wall thickness (m)
  // wall centreline (between outer and inner faces) — openings are placed/cut here
  const centerline = outer.map((p, i) => ({ x: (p.x + inner[i].x) / 2, z: (p.z + inner[i].z) / 2 }));
  for (let i = 0; i < n; i++) {
    const O0 = outer[i];
    const O1 = outer[(i + 1) % n];
    const I0 = inner[i];
    const I1 = inner[(i + 1) % n];
    // outward normal + midpoint (every piece of this wall culls together)
    const dx = O1.x - O0.x;
    const dz = O1.z - O0.z;
    const mx = (O0.x + O1.x) / 2;
    const mz = (O0.z + O1.z) / 2;
    let nx = dz;
    let nz = -dx;
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    wallNormals[i] = { nx, nz, mx, mz };
    const addCull = (mesh: THREE.Mesh) => {
      mesh.userData.wall = i; // raycast target → selects this wall
      g.add(mesh);
      walls.push({ mesh, nx, nz, mx, mz });
    };

    const wallOps = openings.filter((o) => o.wall === i).sort((a, b) => a.t - b.t);
    if (wallOps.length === 0) {
      // solid wall — extruded footprint quad (keeps mitred corners)
      const shape = new THREE.Shape([
        new THREE.Vector2(O0.x, -O0.z),
        new THREE.Vector2(O1.x, -O1.z),
        new THREE.Vector2(I1.x, -I1.z),
        new THREE.Vector2(I0.x, -I0.z),
      ]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: ceilingM, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      addCull(new THREE.Mesh(geo, wallMat));
      continue;
    }
    // wall with openings → pillars + lintels (+ window sills) leave a real hole
    const C0 = centerline[i];
    const C1 = centerline[(i + 1) % n];
    const L = Math.hypot(C1.x - C0.x, C1.z - C0.z) || 1;
    const u = { x: (C1.x - C0.x) / L, z: (C1.z - C0.z) / L };
    const angY = -Math.atan2(u.z, u.x);
    const piece = (s0: number, s1: number, h0: number, h1: number) => {
      const len = s1 - s0;
      const ht = h1 - h0;
      if (len <= 0.002 || ht <= 0.002) return;
      const ms = (s0 + s1) / 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, ht, T3), wallMat);
      box.position.set(C0.x + u.x * ms, (h0 + h1) / 2, C0.z + u.z * ms);
      box.rotation.y = angY;
      addCull(box);
    };
    let cursor = 0;
    for (const op of wallOps) {
      const c = op.t * L;
      const hw = Math.min(op.width / 1000, L) / 2;
      const sill = (op.sill ?? defaultOpeningSill(op.kind, op.design)) / 1000;
      const oh = (op.height ?? 0) / 1000 || (op.kind === "window" ? 1.2 : 2.05);
      const top = Math.min(ceilingM, sill + oh);
      const a = Math.max(cursor, c - hw);
      const b = Math.min(L, c + hw);
      if (a > cursor) piece(cursor, a, 0, ceilingM); // pillar before the hole
      if (top < ceilingM) piece(a, b, top, ceilingM); // lintel above
      if (sill > 0) piece(a, b, 0, sill); // sill below (windows)
      cursor = Math.max(cursor, b);
    }
    if (cursor < L) piece(cursor, L, 0, ceilingM); // final pillar
  }

  // paint surfaces + selection highlight on the inner face of each room wall
  for (let i = 0; i < n; i++) {
    const wn = wallNormals[i];
    if (!wn) continue;
    const I0 = inner[i];
    const I1 = inner[(i + 1) % n];
    const L = Math.hypot(I1.x - I0.x, I1.z - I0.z) || 1;
    const u = { x: (I1.x - I0.x) / L, z: (I1.z - I0.z) / L };
    const inward = { x: -wn.nx, z: -wn.nz }; // into the room
    const rotY = Math.atan2(-u.z, u.x);
    // openings on this wall in face coords (along 0..L, up 0..ceiling) — cut from paint
    const faceOpenings = openings
      .filter((o) => o.wall === i)
      .map((o) => {
        const half = Math.min(o.width / 1000, L) / 2;
        const c = o.t * L;
        const sill = (o.sill ?? defaultOpeningSill(o.kind, o.design)) / 1000;
        const oh = (o.height ?? 0) / 1000 || (o.kind === "window" ? 1.2 : 2.05);
        return { a0: Math.max(0, c - half), a1: Math.min(L, c + half), b0: sill, b1: Math.min(ceilingM, sill + oh) };
      });
    const facePlane = (x0: number, x1: number, y0: number, y1: number, off: number, mat: THREE.Material) => {
      const a0 = x0 * L;
      const a1 = x1 * L;
      const b0 = y0 * ceilingM;
      const b1 = y1 * ceilingM;
      const w = a1 - a0;
      const h = b1 - b0;
      if (w <= 0.001 || h <= 0.001) return;
      const ac = (a0 + a1) / 2;
      const bc = (b0 + b1) / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.closePath();
      for (const fo of faceOpenings) {
        const ha0 = Math.max(a0, fo.a0);
        const ha1 = Math.min(a1, fo.a1);
        const hb0 = Math.max(b0, fo.b0);
        const hb1 = Math.min(b1, fo.b1);
        if (ha1 - ha0 > 0.01 && hb1 - hb0 > 0.01) {
          const hole = new THREE.Path();
          hole.moveTo(ha0 - ac, hb0 - bc);
          hole.lineTo(ha1 - ac, hb0 - bc);
          hole.lineTo(ha1 - ac, hb1 - bc);
          hole.lineTo(ha0 - ac, hb1 - bc);
          hole.closePath();
          shape.holes.push(hole);
        }
      }
      const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      plane.position.set(I0.x + u.x * ac + inward.x * off, bc, I0.z + u.z * ac + inward.z * off);
      plane.rotation.y = rotY;
      plane.userData.wall = i;
      g.add(plane);
      walls.push({ mesh: plane, nx: wn.nx, nz: wn.nz, mx: wn.mx, mz: wn.mz });
    };
    const surf = wallSurfaces[i] ?? defaultSurface();
    for (const lr of leafRects(surf)) {
      const col = coveringColor(lr.c);
      if (!col) continue;
      facePlane(lr.x0, lr.x1, lr.y0, lr.y1, 0.012, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide }));
    }
    if (selected === i) {
      facePlane(0, 1, 0, 1, 0.02, new THREE.MeshStandardMaterial({ color: 0x00ac7a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    }
  }

  // flat list of interior-wall segments (same order/index as model wallSegments)
  const interiorSegs: { a: { x: number; z: number }; b: { x: number; z: number } }[] = [];
  for (const poly of interior) for (let i = 0; i < poly.length - 1; i++) interiorSegs.push({ a: poly[i], b: poly[i + 1] });

  // interior (free-drawn) walls — full height, not culled; segmented around their
  // openings exactly like room walls so drawn-wall openings are true cut-throughs
  const IWT = 0.1; // drawn wall thickness (m)
  interiorSegs.forEach((seg, idx) => {
    const gi = n + idx;
    const dx = seg.b.x - seg.a.x;
    const dz = seg.b.z - seg.a.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.02) return;
    const u = { x: dx / L, z: dz / L };
    const angY = -Math.atan2(dz, dx);
    const iwPiece = (s0: number, s1: number, h0: number, h1: number) => {
      const len = s1 - s0;
      const ht = h1 - h0;
      if (len <= 0.002 || ht <= 0.002) return;
      const ms = (s0 + s1) / 2;
      const box = new THREE.Mesh(new THREE.BoxGeometry(len, ht, IWT), wallMat);
      box.position.set(seg.a.x + u.x * ms, (h0 + h1) / 2, seg.a.z + u.z * ms);
      box.rotation.y = angY;
      g.add(box);
    };
    const segOps = openings.filter((o) => o.wall === gi).sort((p, q) => p.t - q.t);
    if (segOps.length === 0) {
      iwPiece(0, L, 0, ceilingM);
      return;
    }
    let cursor = 0;
    for (const op of segOps) {
      const c = op.t * L;
      const hw = Math.min(op.width / 1000, L) / 2;
      const sill = (op.sill ?? defaultOpeningSill(op.kind, op.design)) / 1000;
      const oh = (op.height ?? 0) / 1000 || (op.kind === "window" ? 1.2 : 2.05);
      const top = Math.min(ceilingM, sill + oh);
      const pa = Math.max(cursor, c - hw);
      const pb = Math.min(L, c + hw);
      if (pa > cursor) iwPiece(cursor, pa, 0, ceilingM);
      if (top < ceilingM) iwPiece(pa, pb, top, ceilingM);
      if (sill > 0) iwPiece(pa, pb, 0, sill);
      cursor = Math.max(cursor, pb);
    }
    if (cursor < L) iwPiece(cursor, L, 0, ceilingM);
  });
  // fill the corner joints of multi-segment drawn walls so segments fully intersect
  for (const poly of interior) {
    const k = poly.length;
    const closed = k > 3 && Math.hypot(poly[0].x - poly[k - 1].x, poly[0].z - poly[k - 1].z) < 0.05;
    for (let i = 0; i < k; i++) {
      const joint = (i > 0 && i < k - 1) || (closed && i === 0);
      if (!joint) continue;
      const p = poly[i];
      const box = new THREE.Mesh(new THREE.BoxGeometry(IWT, ceilingM, IWT), wallMat);
      box.position.set(p.x, ceilingM / 2, p.z);
      g.add(box);
    }
  }
  const perp = (seg: { a: { x: number; z: number }; b: { x: number; z: number } }) => {
    const dx = seg.b.x - seg.a.x;
    const dz = seg.b.z - seg.a.z;
    const L = Math.hypot(dx, dz) || 1;
    return { x: -dz / L, z: dx / L };
  };

  // opening fills (glass / door leaf) seated in the hole; the bare wall opening
  // fills nothing. Room-wall fills cull with their wall; drawn-wall fills stay.
  const tagOpening = (o: THREE.Object3D, id: string) => {
    o.userData.opening = id; // raycast target → selects this opening
    if (id === selectedOpen) {
      o.traverse((c) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (mat && "emissive" in mat) {
          mat.emissive = new THREE.Color(0x00ac7a);
          mat.emissiveIntensity = 0.55;
        }
      });
    }
    return o;
  };
  for (const op of openings) {
    if (op.wall < n) {
      const wi = wallNormals[op.wall];
      if (!wi) continue;
      const meshes = makeOpening(centerline[op.wall], centerline[(op.wall + 1) % n], op.t, op.width / 1000, (op.height ?? 0) / 1000, op.kind, op.design, (op.sill ?? defaultOpeningSill(op.kind, op.design)) / 1000, op.finish);
      for (const m of meshes) {
        g.add(tagOpening(m, op.id));
        walls.push({ mesh: m, nx: wi.nx, nz: wi.nz, mx: wi.mx, mz: wi.mz });
      }
    } else {
      const seg = interiorSegs[op.wall - n];
      if (!seg) continue;
      for (const m of makeOpening(seg.a, seg.b, op.t, op.width / 1000, (op.height ?? 0) / 1000, op.kind, op.design, (op.sill ?? defaultOpeningSill(op.kind, op.design)) / 1000, op.finish)) g.add(tagOpening(m, op.id));
    }
  }

  // wall fittings — room walls cull, drawn-wall fittings stay visible
  const litFit = (m: THREE.Mesh) => {
    if (m.userData.fitting === selectedFit) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(0x00ac7a);
      mat.emissiveIntensity = 0.5;
    }
    return m;
  };
  for (const fit of fittings) {
    if (fit.wall < n) {
      const wi = wallNormals[fit.wall];
      if (!wi) continue;
      const meshes = makeFitting(inner[fit.wall], inner[(fit.wall + 1) % n], fit, -wi.nx, -wi.nz, ceilingM);
      for (const m of meshes) {
        g.add(litFit(m));
        walls.push({ mesh: m, nx: wi.nx, nz: wi.nz, mx: wi.mx, mz: wi.mz });
      }
    } else {
      const seg = interiorSegs[fit.wall - n];
      if (!seg) continue;
      const pn = perp(seg);
      for (const m of makeFitting(seg.a, seg.b, fit, pn.x, pn.z, ceilingM)) g.add(litFit(m));
    }
  }

  // crisp floor outline
  const loop = outer.map((p) => new THREE.Vector3(p.x, 0.004, p.z));
  loop.push(loop[0].clone());
  g.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(loop),
      new THREE.LineBasicMaterial({ color: 0x9a9a9a }),
    ),
  );
  return { group: g, walls };
}

interface Api {
  setView: (v: SceneView) => void;
  rebuild: (points: Pt[], ceilingMm: number, openings: Opening[], color: string, floor: string | undefined, interior: Pt[][], fittings: Fitting[], wallSurfaces: Record<number, Surface>, selected: number | null, selectedFit: string | null, selectedOpen: string | null, floorSel: boolean) => void;
  /** room-mm point under a screen pointer, on the floor plane (null if the ray misses it). Lets the
   *  resizer drag a corner/wall 1:1 with the finger instead of guessing from a screen-space delta. */
  floorMm: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** freeze the room's auto-centring during a drag. Without it, moving a corner shifts the polygon's
   *  bounds centre, the whole room re-centres in view and slides out from under the grab — which is
   *  what made resizing feel like it moved the wrong thing. */
  lockCenter: (on: boolean) => void;
  /** zoom the scene by a wheel delta — lets a pinch that lands on the measurement overlay zoom the 3D
   *  (like pinching bare canvas would) instead of doing nothing, now that page-zoom is blocked. */
  zoomBy: (deltaY: number, clientX: number, clientY: number) => void;
  /** the WALL point under a pointer: room-mm floor x/y + world-height (mm). Drives the opening gizmo's
   *  move/resize handles the way `floorMm` drives the room resizer. Null if the ray misses a wall. */
  wallHit: (clientX: number, clientY: number) => { x: number; y: number; height: number } | null;
  /** the point under a pointer on the VERTICAL PLANE through wall segment a→b — used by the opening
   *  gizmo so a drag reads the opening's own wall, not the glass/door-leaf/far wall a mesh ray would
   *  pass through. Returns room-mm floor x/y + world-height (mm). */
  wallPlaneHit: (clientX: number, clientY: number, ax: number, ay: number, bx: number, by: number) => { x: number; y: number; height: number } | null;
  dispose: () => void;
}

interface ProjectedDim {
  id: string;
  wallIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  label: string;
  type: "wall" | "height";
}

/** The selected door/window's transform gizmo, projected to screen: the four face corners + centre,
 *  plus its live dimensions for the labels. Screen px unless noted. */
interface ItemGizmo {
  id: string;
  bl: { x: number; y: number };
  br: { x: number; y: number };
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  cx: number;
  cy: number;
  width: number; // mm
  height: number; // mm
  isDoor: boolean; // a door sits on the floor → no bottom (sill) handle
  // POSITION dims: where it sits — gap to the left/right wall ends, and the sill above the floor
  wallA: { x: number; y: number }; // left wall corner, at sill height (screen)
  wallB: { x: number; y: number }; // right wall corner, at sill height
  blFloor: { x: number; y: number }; // the left jamb dropped to the floor (screen)
  leftGap: number; // mm
  rightGap: number; // mm
  sill: number; // mm
}

export function ThreeScene({
  points,
  ceiling,
  view,
  openings,
  coveringColor,
  floorId,
  interiorWalls,
  fittings,
  wallSurfaces,
  selectedWall3D,
  selectedFit3D,
  selectedOpen3D,
  floorSel3D,
  onWallClick,
  onFittingClick,
  onFittingDrag,
  onOpeningClick,
  onFloorClick,
  onSetWallLength,
  onSetCeilingValue,
  onEditNumber,
  onMoveCorner,
  onMoveWall,
  onBeginEdit,
  onOpeningDrag,
  onSetOpeningWidth,
  onSetOpeningHeight,
  onSetOpeningSill,
}: {
  points: Pt[];
  ceiling: number;
  view: SceneView;
  openings: Opening[];
  coveringColor: string;
  floorId?: string;
  interiorWalls: Pt[][];
  fittings: Fitting[];
  wallSurfaces: Record<number, Surface>;
  selectedWall3D: number | null;
  selectedFit3D: string | null;
  selectedOpen3D: string | null;
  floorSel3D: boolean;
  onWallClick: (wall: number | null) => void;
  onFittingClick: (id: string) => void;
  onFittingDrag: (id: string, x: number, y: number, heightMm: number) => void;
  onOpeningClick: (id: string) => void;
  onFloorClick: () => void;
  onSetWallLength?: (i: number, len: number, endpoint: "a" | "b") => void;
  onSetCeilingValue?: (val: number) => void;
  onEditNumber?: (x: number, y: number, value: number, apply: (v: number) => void) => void;
  /** drag a corner (point `i`) to an exact room-mm position — the two walls sharing it follow */
  onMoveCorner?: (i: number, x: number, y: number) => void;
  /** slide a whole wall (both endpoints of wall `i`) — used when the wall LINE is dragged */
  onMoveWall?: (i: number, a: Pt, b: Pt) => void;
  /** snapshot for undo before a drag gesture starts */
  onBeginEdit?: () => void;
  /** drag a door/window/opening to a room-mm point — it hops to the nearest wall there (like fittings) */
  onOpeningDrag?: (id: string, x: number, y: number) => void;
  /** resize handles on the opening gizmo */
  onSetOpeningWidth?: (id: string, width: number) => void;
  onSetOpeningHeight?: (id: string, height: number) => void;
  onSetOpeningSill?: (id: string, sill: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cbRef = useRef({ onWallClick, onFittingClick, onFittingDrag, onOpeningClick, onFloorClick, onSetWallLength, onSetCeilingValue, onMoveCorner, onMoveWall, onBeginEdit, onOpeningDrag, onSetOpeningWidth, onSetOpeningHeight, onSetOpeningSill });
  cbRef.current = { onWallClick, onFittingClick, onFittingDrag, onOpeningClick, onFloorClick, onSetWallLength, onSetCeilingValue, onMoveCorner, onMoveWall, onBeginEdit, onOpeningDrag, onSetOpeningWidth, onSetOpeningHeight, onSetOpeningSill };

  // latest inputs, read by the (stable) projection so it never draws the overlay off STALE points, and
  // the room CENTRE it is projected against — the same one `rebuild` last used (frozen during a drag).
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const ceilingRef = useRef(ceiling);
  ceilingRef.current = ceiling;
  const selWallRef = useRef(selectedWall3D);
  selWallRef.current = selectedWall3D;
  const centerRef = useRef({ cx: 0, cy: 0 });
  // the selected door/window's gizmo reads these live
  const openingsRef = useRef(openings);
  openingsRef.current = openings;
  const interiorWallsRef = useRef(interiorWalls);
  interiorWallsRef.current = interiorWalls;
  const selOpenRef = useRef(selectedOpen3D);
  selOpenRef.current = selectedOpen3D;

  const [dims, setDims] = useState<ProjectedDim[]>([]);
  const [gizmo, setGizmo] = useState<ItemGizmo | null>(null);

  const updateDims = useCallback(() => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    const points = pointsRef.current;
    const ceiling = ceilingRef.current;
    if (!mount || !camera || !points.length) return;
    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 480;
    // project against the SAME centre the room was last built with (frozen mid-drag) so the overlay
    // sits exactly on the walls instead of drifting as the polygon's bounds shift.
    const cx = centerRef.current.cx;
    const cy = centerRef.current.cy;

    const result: ProjectedDim[] = [];
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const pA = points[i];
      const pB = points[(i + 1) % n];
      const len = Math.round(Math.hypot(pB.x - pA.x, pB.y - pA.y));
      if (len < 400) continue;

      const vecA = new THREE.Vector3((pA.x - cx) / 1000, 0.08, (pA.y - cy) / 1000);
      const vecB = new THREE.Vector3((pB.x - cx) / 1000, 0.08, (pB.y - cy) / 1000);

      vecA.project(camera);
      vecB.project(camera);

      if (vecA.z < 1.0 && vecB.z < 1.0) {
        const x1 = (vecA.x * 0.5 + 0.5) * width;
        const y1 = (-vecA.y * 0.5 + 0.5) * height;
        const x2 = (vecB.x * 0.5 + 0.5) * width;
        const y2 = (-vecB.y * 0.5 + 0.5) * height;
        const lineLen = Math.hypot(x2 - x1, y2 - y1);

        if (lineLen > 30) {
          result.push({
            id: `wall-${i}`,
            wallIndex: i,
            x1, y1, x2, y2,
            length: len,
            label: `${len} мм`,
            type: "wall",
          });
        }
      }
    }

    if (points.length > 0) {
      const p0 = points[0];
      const vBtm = new THREE.Vector3((p0.x - cx) / 1000, 0.05, (p0.y - cy) / 1000);
      const vTop = new THREE.Vector3((p0.x - cx) / 1000, ceiling / 1000, (p0.y - cy) / 1000);

      vBtm.project(camera);
      vTop.project(camera);

      if (vBtm.z < 1.0 && vTop.z < 1.0) {
        const x1 = (vBtm.x * 0.5 + 0.5) * width;
        const y1 = (-vBtm.y * 0.5 + 0.5) * height;
        const x2 = (vTop.x * 0.5 + 0.5) * width;
        const y2 = (-vTop.y * 0.5 + 0.5) * height;
        const lineLen = Math.hypot(x2 - x1, y2 - y1);

        if (lineLen > 30) {
          result.push({
            id: "ceiling-h",
            wallIndex: -1,
            x1, y1, x2, y2,
            length: ceiling,
            label: `${ceiling} мм`,
            type: "height",
          });
        }
      }
    }

    setDims(result);

    // ── the selected door/window's transform gizmo: its face corners + centre, projected to screen ──
    let g: ItemGizmo | null = null;
    const selId = selOpenRef.current;
    if (selId) {
      const o = openingsRef.current.find((x) => x.id === selId);
      const seg = o ? wallSegments(points, interiorWallsRef.current)[o.wall] : null;
      if (o && seg) {
        const sp = openingSpan(seg.a, seg.b, o.t, o.width);
        const sill = o.sill ?? defaultOpeningSill(o.kind, o.design);
        const h = o.height ?? defaultOpeningHeight(o.kind);
        const proj = (fx: number, fy: number, hy: number) => {
          const v = new THREE.Vector3((fx - cx) / 1000, hy / 1000, (fy - cy) / 1000);
          v.project(camera);
          return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, z: v.z };
        };
        const bl = proj(sp.p1.x, sp.p1.y, sill);
        const br = proj(sp.p2.x, sp.p2.y, sill);
        const tl = proj(sp.p1.x, sp.p1.y, sill + h);
        const tr = proj(sp.p2.x, sp.p2.y, sill + h);
        const ctr = proj(sp.cx, sp.cy, sill + h / 2);
        const wallA = proj(seg.a.x, seg.a.y, sill);
        const wallB = proj(seg.b.x, seg.b.y, sill);
        const blFloor = proj(sp.p1.x, sp.p1.y, 0);
        if (bl.z < 1 && br.z < 1 && tl.z < 1 && tr.z < 1) {
          g = {
            id: o.id, bl, br, tl, tr, cx: ctr.x, cy: ctr.y, width: o.width, height: h, isDoor: o.kind !== "window",
            wallA, wallB, blFloor,
            leftGap: Math.round(o.t * sp.wl - o.width / 2),
            rightGap: Math.round(sp.wl - o.t * sp.wl - o.width / 2),
            sill: Math.round(sill),
          };
        }
      }
    }
    setGizmo(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const w0 = mount.clientWidth || 320;
    const h0 = mount.clientHeight || 480;
    renderer.setSize(w0, h0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.05, 100);
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 1.5;
    controls.maxDistance = 20;
    const center = new THREE.Vector3(0, 0, 0);
    controls.target.copy(center);

    const rig = buildRig(scene, renderer, { shadows: false, preset: "day" });

    let wood: THREE.Texture | null = null;

    let needs = true;
    const invalidate = () => {
      needs = true;
    };
    // Re-projecting the overlay on EVERY damped orbit event floods React with setState and janks the
    // whole scene. Coalesce to one recompute per animation frame instead.
    let dimsRaf = 0;
    const scheduleDims = () => {
      if (dimsRaf) return;
      dimsRaf = requestAnimationFrame(() => { dimsRaf = 0; updateDims(); });
    };
    const onControlsChange = () => {
      invalidate();
      scheduleDims();
    };
    controls.addEventListener("change", onControlsChange);
    const offTextures = PBR ? onTexturesReady(invalidate) : null;

    let room: THREE.Group | null = null;
    let walls: WallInfo[] = [];
    let woodColor = "";
    const bounds = { cx: 0, cy: 0 };
    // while a resize drag holds this, `rebuild` keeps the room centred where it was when the drag began
    // (see Api.lockCenter) — otherwise the model slides out from under the grabbed corner.
    let lockedCenter: { cx: number; cy: number } | null = null;
    const disposeGroup = (gr: THREE.Group) => {
      gr.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    };
    const rebuild = (pts: Pt[], ceilMm: number, ops: Opening[], color: string, floor: string | undefined, interior: Pt[][], fits: Fitting[], surfaces: Record<number, Surface>, selected: number | null, selectedFit: string | null, selectedOpen: string | null, floorSel: boolean) => {
      if (room) {
        scene.remove(room);
        disposeGroup(room);
      }
      if (!wood || woodColor !== color) {
        wood?.dispose();
        wood = makeWoodTexture(color);
        woodColor = color;
      }
      const b = polygonBoundsMm(pts);
      // a drag pins the centre so the room doesn't slide; otherwise track the polygon's bounds centre
      bounds.cx = lockedCenter ? lockedCenter.cx : b.cx;
      bounds.cy = lockedCenter ? lockedCenter.cy : b.cy;
      centerRef.current = { cx: bounds.cx, cy: bounds.cy }; // the overlay projects against this same centre
      const innerMm = offsetPolygon(pts, 100);
      const toM = (p: Pt) => ({ x: (p.x - bounds.cx) / 1000, z: (p.y - bounds.cy) / 1000 });
      rig.aim({ points: pts, openings: ops, ceiling: ceilMm });
      const built = makeRoom(
        pts.map(toM),
        innerMm.map(toM),
        ceilMm / 1000,
        wood,
        ops,
        interior.map((poly) => poly.map(toM)),
        fits,
        surfaces,
        selected,
        selectedFit,
        selectedOpen,
        floorSel,
      );
      room = built.group;
      walls = built.walls;
      applyPbrFloor(room, color, floor);
      scene.add(room);
      invalidate();
    };

    const fit = () => {
      const b = polygonBoundsMm(points);
      return Math.max(b.w, b.h) / 1000;
    };
    const setView = (v: SceneView) => {
      const d = fit();
      if (v === "plan") {
        camera.position.set(0, d * 2.2, 0.001);
        controls.enableRotate = false;
      } else if (v === "front") {
        camera.position.set(0, d * 0.45, d * 1.7);
        controls.enableRotate = false;
      } else {
        camera.position.set(d * 1.1, d * 0.95, d * 1.1);
        controls.enableRotate = true;
      }
      controls.target.copy(center);
      camera.lookAt(center);
      controls.update();
      invalidate();
      updateDims();
    };

    const updateCull = () => {
      for (const wll of walls) {
        const dot = (camera.position.x - wll.mx) * wll.nx + (camera.position.z - wll.mz) * wll.nz;
        wll.mesh.visible = dot <= 0.001;
      }
    };

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        invalidate();
        updateDims();
      }
    });
    ro.observe(mount);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      if (needs) {
        rig.follow(camera, controls.target);
        updateCull();
        renderer.render(scene, camera);
        needs = false;
      }
    };
    raf = requestAnimationFrame(loop);

    const raycaster = new THREE.Raycaster();
    const downXY = { x: 0, y: 0 };
    // a fitting OR a door/window being dragged along the walls
    let dragItem: { kind: "fitting" | "opening"; id: string } | null = null;
    const ndcOf = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };

    // the floor plane (y = 0) the resizer drags against, and the room-mm point under a screen pointer
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPt = new THREE.Vector3();
    const floorMm = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(floorPlane, hitPt)) return null;
      return { x: hitPt.x * 1000 + bounds.cx, y: hitPt.z * 1000 + bounds.cy };
    };
    const lockCenter = (on: boolean) => {
      lockedCenter = on ? { cx: bounds.cx, cy: bounds.cy } : null;
    };
    // re-play a wheel onto the canvas so OrbitControls dollies exactly as if the pinch had landed there
    const zoomBy = (deltaY: number, clientX: number, clientY: number) => {
      renderer.domElement.dispatchEvent(new WheelEvent("wheel", { deltaY, clientX, clientY, bubbles: false, cancelable: true }));
    };

    type Target = { kind: "fitting" | "opening" | "wall" | "floor"; id?: string; wall?: number };
    const targetOf = (obj: THREE.Object3D | null): Target | null => {
      let o: THREE.Object3D | null = obj;
      while (o) {
        if (o.userData.fitting != null) return { kind: "fitting", id: o.userData.fitting as string };
        if (o.userData.opening != null) return { kind: "opening", id: o.userData.opening as string };
        if (o.userData.floor) return { kind: "floor" };
        if (o.userData.wall != null) return { kind: "wall", wall: o.userData.wall as number };
        o = o.parent;
      }
      return null;
    };
    const nearestTarget = (e: PointerEvent): Target | null => {
      if (!room) return null;
      raycaster.setFromCamera(ndcOf(e), camera);
      const hits = raycaster.intersectObjects(room.children, true).filter((h) => h.object.visible);
      return hits.length ? targetOf(hits[0].object) : null;
    };
    // the WALL point (room-mm floor + world height) under a screen pointer — for the opening gizmo
    const wallHit = (clientX: number, clientY: number): { x: number; y: number; height: number } | null => {
      if (!room) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(room.children, true).filter((h) => h.object.visible && targetOf(h.object)?.kind === "wall")[0];
      if (!hit) return null;
      return { x: hit.point.x * 1000 + bounds.cx, y: hit.point.z * 1000 + bounds.cy, height: hit.point.y * 1000 };
    };
    // like wallHit, but against the (infinite, vertical) PLANE through a→b — so an opening's drag reads
    // its OWN wall, never punching through the glass/door-leaf to whatever mesh is behind it.
    const planePt = new THREE.Vector3();
    const wallPlaneHit = (clientX: number, clientY: number, ax: number, ay: number, bx: number, by: number) => {
      const c = centerRef.current;
      const A = new THREE.Vector3((ax - c.cx) / 1000, 0, (ay - c.cy) / 1000);
      const dir = new THREE.Vector3(bx - ax, 0, by - ay).normalize(); // wall direction in world x–z
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(dir.z, 0, -dir.x), A);
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, planePt)) return null;
      return { x: planePt.x * 1000 + c.cx, y: planePt.z * 1000 + c.cy, height: planePt.y * 1000 };
    };
    const onDown = (e: PointerEvent) => {
      downXY.x = e.clientX;
      downXY.y = e.clientY;
      const t = nearestTarget(e);
      // Fittings drag by their body. A door/window is moved from its GIZMO's centre handle instead
      // (like a cabinet in the Construction step) — tapping its body just selects it — so grabbing the
      // opening body here would fight orbit, and we don't.
      if (t?.kind === "fitting" && t.id) {
        dragItem = { kind: t.kind, id: t.id };
        controls.enabled = false;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragItem || !room) return;
      raycaster.setFromCamera(ndcOf(e), camera);
      const hit = raycaster.intersectObjects(room.children, true).filter((h) => h.object.visible && targetOf(h.object)?.kind === "wall")[0];
      if (!hit) return;
      const b = polygonBoundsMm(pointsRef.current);
      cbRef.current.onFittingDrag(dragItem.id, hit.point.x * 1000 + b.cx, hit.point.z * 1000 + b.cy, hit.point.y * 1000);
    };
    const onPick = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y);
      if (dragItem) {
        const it = dragItem;
        dragItem = null;
        controls.enabled = true;
        if (moved <= 6) cbRef.current.onFittingClick(it.id); // a tap is a select, not a move
        return;
      }
      if (moved > 6 || !room) return;
      const t = nearestTarget(e);
      if (t?.kind === "fitting") cbRef.current.onFittingClick(t.id!);
      else if (t?.kind === "opening") cbRef.current.onOpeningClick(t.id!);
      else if (t?.kind === "floor") cbRef.current.onFloorClick();
      else cbRef.current.onWallClick(t?.kind === "wall" ? t.wall! : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onPick);

    rebuild(points, ceiling, openings, coveringColor, floorId, interiorWalls, fittings, wallSurfaces, selectedWall3D, selectedFit3D, selectedOpen3D, floorSel3D);
    setView(view);

    apiRef.current = {
      setView,
      rebuild,
      floorMm,
      lockCenter,
      zoomBy,
      wallHit,
      wallPlaneHit,
      dispose: () => {
        cancelAnimationFrame(raf);
        if (dimsRaf) cancelAnimationFrame(dimsRaf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onPick);
        controls.removeEventListener("change", onControlsChange);
        offTextures?.();
        controls.dispose();
        if (room) disposeGroup(room);
        rig.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      },
    };

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.rebuild(points, ceiling, openings, coveringColor, floorId, interiorWalls, fittings, wallSurfaces, selectedWall3D, selectedFit3D, selectedOpen3D, floorSel3D);
    updateDims();
  }, [points, ceiling, openings, coveringColor, floorId, interiorWalls, fittings, wallSurfaces, selectedWall3D, selectedFit3D, selectedOpen3D, floorSel3D, updateDims]);

  useEffect(() => {
    apiRef.current?.setView(view);
    updateDims();
  }, [view, updateDims]);

  // What the grab does: move ONE corner (1:1 on the floor), slide a whole WALL perpendicular, or pull
  // the ceiling HEIGHT (vertical — no floor point, so it keeps a screen-space delta).
  type Grab = { kind: "corner"; corner: number } | { kind: "wall" } | { kind: "height" };
  const beginDrag = (dim: ProjectedDim, e: React.PointerEvent, grab: Grab) => {
    e.preventDefault();
    e.stopPropagation();
    const api = apiRef.current;
    const controls = controlsRef.current;
    if (controls) controls.enabled = false; // don't orbit while dragging a handle

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    // wall-line geometry (mm), fixed at grab time: the original endpoints + the wall's outward normal
    const pts = pointsRef.current;
    const n = pts.length;
    const a0 = grab.kind === "wall" ? pts[dim.wallIndex] : null;
    const b0 = grab.kind === "wall" ? pts[(dim.wallIndex + 1) % n] : null;
    let nx = 0, ny = 0;
    if (a0 && b0) {
      const l = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1;
      nx = (b0.y - a0.y) / l;
      ny = -(b0.x - a0.x) / l;
    }
    // height keeps the screen-space projection (a vertical line has no floor point)
    const initLen = dim.length;
    const ll = Math.hypot(dim.x2 - dim.x1, dim.y2 - dim.y1) || 1;
    const uxl = (dim.x2 - dim.x1) / ll;
    const uyl = (dim.y2 - dim.y1) / ll;

    let began = false; // lazy: snapshot for undo + freeze the centre only once the finger MOVES
    let startMm: { x: number; y: number } | null = null;
    let grabOff = { x: 0, y: 0 }; // corner − pointer at grab, so the corner tracks the finger with no jump
    let lastKey = "";
    const ensureBegin = (ev: PointerEvent) => {
      if (began) return;
      began = true;
      cbRef.current.onBeginEdit?.();
      api?.lockCenter(true); // pin the room so it can't slide out from under the grab
      startMm = grab.kind === "height" ? null : api?.floorMm(ev.clientX, ev.clientY) ?? null;
      if (grab.kind === "corner" && startMm) grabOff = { x: pts[grab.corner].x - startMm.x, y: pts[grab.corner].y - startMm.y };
      if (grab.kind !== "height") cbRef.current.onWallClick(dim.wallIndex); // light the wall green
    };

    const onMove = (ev: PointerEvent) => {
      if (!began && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) <= 4) return; // still a tap
      ensureBegin(ev);

      if (grab.kind === "height") {
        const projDist = (ev.clientX - startClientX) * uxl + (ev.clientY - startClientY) * uyl;
        const v = Math.max(2000, Math.min(4000, Math.round((initLen + projDist * (initLen / Math.max(30, ll))) / 50) * 50));
        if (String(v) !== lastKey) { lastKey = String(v); cbRef.current.onSetCeilingValue?.(v); }
        return;
      }

      const mm = api?.floorMm(ev.clientX, ev.clientY);
      if (!mm) return;

      if (grab.kind === "corner") {
        // drop the corner under the finger, holding the grab offset (moveCorner snaps to 100mm; only
        // commit on a change so we don't rebuild the room on every pixel)
        const tx = mm.x + grabOff.x;
        const ty = mm.y + grabOff.y;
        const key = `${Math.round(tx / 100)},${Math.round(ty / 100)}`;
        if (key !== lastKey) { lastKey = key; cbRef.current.onMoveCorner?.(grab.corner, tx, ty); }
      } else if (a0 && b0 && startMm) {
        // slide the whole wall by the finger's travel along the wall's normal
        const disp = (mm.x - startMm.x) * nx + (mm.y - startMm.y) * ny;
        const key = String(Math.round(disp / 100));
        if (key !== lastKey) {
          lastKey = key;
          cbRef.current.onMoveWall?.(dim.wallIndex, { x: a0.x + nx * disp, y: a0.y + ny * disp }, { x: b0.x + nx * disp, y: b0.y + ny * disp });
        }
      }
    };

    const onUp = () => {
      if (controls) controls.enabled = true;
      api?.lockCenter(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!began && grab.kind !== "height") cbRef.current.onWallClick(dim.wallIndex); // a tap → just select it
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // The opening gizmo: MOVE the door/window along the walls, or resize its WIDTH (symmetric about its
  // centre), HEIGHT (top edge, sill held) or SILL (bottom edge, top held — windows only). All 1:1 off a
  // wall raycast, snapped to 10mm, committed only on a change so the room isn't rebuilt every pixel.
  const beginItemDrag = (gz: ItemGizmo, e: React.PointerEvent, mode: "move" | "width" | "top" | "bottom") => {
    e.preventDefault();
    e.stopPropagation();
    const api = apiRef.current;
    const controls = controlsRef.current;
    if (controls) controls.enabled = false;
    const o = openings.find((x) => x.id === gz.id);
    const seg = o ? wallSegments(points, interiorWalls)[o.wall] : null;
    if (!o || !seg) return;
    const sp0 = openingSpan(seg.a, seg.b, o.t, o.width);
    const sill0 = o.sill ?? defaultOpeningSill(o.kind, o.design);
    const top0 = sill0 + (o.height ?? defaultOpeningHeight(o.kind));
    const startClientX = e.clientX, startClientY = e.clientY;
    let began = false, lastKey = "";
    const ensureBegin = () => { if (began) return; began = true; cbRef.current.onBeginEdit?.(); };

    const onMove = (ev: PointerEvent) => {
      if (!began && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) <= 4) return;
      ensureBegin();
      // read against THIS opening's wall plane, so the ray can't punch through the glass/leaf to a
      // wall behind it (which made the window unresizable and a widened door impossible to grab again)
      const hit = api?.wallPlaneHit(ev.clientX, ev.clientY, seg.a.x, seg.a.y, seg.b.x, seg.b.y);
      if (!hit) return;
      if (mode === "move") {
        const key = `${Math.round(hit.x / 10)},${Math.round(hit.y / 10)},${Math.round(hit.height / 10)}`;
        if (key !== lastKey) {
          lastKey = key;
          cbRef.current.onOpeningDrag?.(gz.id, hit.x, hit.y); // horizontal: slide along the wall
          if (!gz.isDoor) {
            // a window also moves UP/DOWN: keep its height, shift the sill so its centre tracks the finger
            const h0 = top0 - sill0;
            const sill = Math.max(0, Math.min(ceiling - h0, Math.round((hit.height - h0 / 2) / 10) * 10));
            cbRef.current.onSetOpeningSill?.(gz.id, sill);
          }
        }
      } else if (mode === "width") {
        const along = (hit.x - sp0.cx) * sp0.ux + (hit.y - sp0.cy) * sp0.uy; // signed dist from centre
        const w = Math.max(200, Math.min(4000, Math.round((Math.abs(along) * 2) / 10) * 10));
        if (String(w) !== lastKey) { lastKey = String(w); cbRef.current.onSetOpeningWidth?.(gz.id, w); }
      } else if (mode === "top") {
        const hgt = Math.max(300, Math.min(3000, Math.round((hit.height - sill0) / 10) * 10)); // sill held
        if (String(hgt) !== lastKey) { lastKey = String(hgt); cbRef.current.onSetOpeningHeight?.(gz.id, hgt); }
      } else {
        const sill = Math.max(0, Math.min(top0 - 300, Math.round(hit.height / 10) * 10)); // top held
        if (String(sill) !== lastKey) {
          lastKey = String(sill);
          cbRef.current.onSetOpeningSill?.(gz.id, sill);
          cbRef.current.onSetOpeningHeight?.(gz.id, Math.max(300, top0 - sill));
        }
      }
    };
    const onUp = () => {
      if (controls) controls.enabled = true;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleChipClick = (dim: ProjectedDim, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const midX = (dim.x1 + dim.x2) / 2;
    const midY = (dim.y1 + dim.y2) / 2;
    if (cbRef.current.onSetWallLength || cbRef.current.onSetCeilingValue) {
      onEditNumber?.(midX, midY, dim.length, (v) => {
        if (dim.type === "wall" && cbRef.current.onSetWallLength) {
          cbRef.current.onSetWallLength(dim.wallIndex, v, "b");
        } else if (dim.type === "height" && cbRef.current.onSetCeilingValue) {
          cbRef.current.onSetCeilingValue(v);
        }
      });
    }
  };

  return (
    <div ref={mountRef} className="scene-canvas" style={{ position: "relative" }}>
      {/* Clean Line + Circle Dot Resizer Overlay */}
      <svg
        className="scene-dim-overlay"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 10,
          width: "100%",
          height: "100%",
        }}
        // a wheel/pinch that lands on a handle or chip bubbles here — forward it so the 3D zooms
        // instead of being swallowed (page-zoom itself is blocked globally in main.tsx)
        onWheel={(e) => apiRef.current?.zoomBy(e.deltaY, e.clientX, e.clientY)}
      >
        {/* the measurements + resize handles are an EDIT tool, not scene furniture: show them only once
            the room is being edited — a wall or the floor is selected — and keep the scene clean otherwise */}
        {(selectedWall3D != null || floorSel3D) && dims.map((dim: ProjectedDim) => {
          const mx = (dim.x1 + dim.x2) / 2;
          const my = (dim.y1 + dim.y2) / 2;
          const angle = segAngle(dim.x1, dim.y1, dim.x2, dim.y2);
          const linePx = Math.hypot(dim.x2 - dim.x1, dim.y2 - dim.y1);
          const sc = arrowScale(linePx);
          const isWall = dim.type === "wall";
          const n = points.length;
          const isSel = isWall && selectedWall3D === dim.wallIndex;
          // black outline by default, green when this wall is selected — the 2D floor plan's look
          const strokeColor = isSel ? "#00AC7A" : "#1a1a1a";
          const dotFill = isSel ? "#00AC7A" : "#ffffff";
          const dotStroke = isSel ? "#ffffff" : "#1a1a1a";
          const lineGrab: Grab = isWall ? { kind: "wall" } : { kind: "height" };

          const chipTransform = `translate(${mx.toFixed(1)}, ${my.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${sc.toFixed(2)}) translate(0, -18)`;

          return (
            <g key={dim.id} className="room-dim-group" style={{ pointerEvents: "all" }}>
              {/* Hit line for wide grab area — tap selects the wall, drag slides it */}
              <line
                x1={dim.x1}
                y1={dim.y1}
                x2={dim.x2}
                y2={dim.y2}
                stroke="transparent"
                strokeWidth={Math.max(20, 24 * sc)}
                style={{ cursor: "grab", pointerEvents: "all" }}
                onPointerDown={(e) => beginDrag(dim, e, lineGrab)}
              />
              {/* Clean dimension line (solid for walls, dashed for height) */}
              <line
                x1={dim.x1}
                y1={dim.y1}
                x2={dim.x2}
                y2={dim.y2}
                stroke={strokeColor}
                strokeWidth={(isSel ? 3.5 : 2.5) * sc}
                strokeDasharray={dim.type === "height" ? `${4 * sc} ${3 * sc}` : undefined}
                style={{ pointerEvents: "none" }}
              />
              {/* Endpoint 1 Circle Handle Dot — drags THIS corner */}
              <circle
                cx={dim.x1}
                cy={dim.y1}
                r={7 * sc}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth={2 * sc}
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.25))"
                style={{ cursor: "grab", pointerEvents: "all" }}
                onPointerDown={(e) => beginDrag(dim, e, isWall ? { kind: "corner", corner: dim.wallIndex } : { kind: "height" })}
              />
              {/* Endpoint 2 Circle Handle Dot — drags the NEXT corner */}
              <circle
                cx={dim.x2}
                cy={dim.y2}
                r={7 * sc}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth={2 * sc}
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.25))"
                style={{ cursor: "grab", pointerEvents: "all" }}
                onPointerDown={(e) => beginDrag(dim, e, isWall ? { kind: "corner", corner: (dim.wallIndex + 1) % n } : { kind: "height" })}
              />
              {/* Measurement Chip sitting clear of line, rotated & scaled */}
              <g
                transform={chipTransform}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onClick={(e) => handleChipClick(dim, e)}
              >
                <rect
                  x={-34}
                  y={-13}
                  width={68}
                  height={26}
                  rx={13}
                  fill="#ffffff"
                  stroke="#00AC7A"
                  strokeWidth={1.5}
                  filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#000000"
                  fontSize={11}
                  fontWeight={700}
                  fontFamily="var(--sans)"
                >
                  {dim.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* ── SELECTED DOOR / WINDOW GIZMO ── highlight + side measurement arrows + centre move handle ── */}
        {gizmo && (() => {
          const gz = gizmo;
          const GREEN = "#00AC7A";
          const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          const leftMid = mid(gz.bl, gz.tl), rightMid = mid(gz.br, gz.tr), topMid = mid(gz.tl, gz.tr), botMid = mid(gz.bl, gz.br);
          const away = (p: { x: number; y: number }, amt: number) => {
            const dx = p.x - gz.cx, dy = p.y - gz.cy, l = Math.hypot(dx, dy) || 1;
            return { x: p.x + (dx / l) * amt, y: p.y + (dy / l) * amt };
          };
          const dot = (p: { x: number; y: number }, mode: "width" | "top" | "bottom", key: string) => (
            <circle key={key} cx={p.x} cy={p.y} r={8} fill="#fff" stroke={GREEN} strokeWidth={3}
              filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.25))" style={{ cursor: "grab", pointerEvents: "all" }}
              onPointerDown={(e) => beginItemDrag(gz, e, mode)} />
          );
          const label = (p: { x: number; y: number }, text: string, key: string) => (
            <g key={key} pointerEvents="none">
              <rect x={p.x - 28} y={p.y - 12} width={56} height={24} rx={12} fill="#fff" stroke={GREEN} strokeWidth={1.5} filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={12} fontWeight={700} fill={GREEN}>{text}</text>
            </g>
          );
          const wl = away(botMid, 24), hl = away(rightMid, 32);
          // POSITION dimension: a thin grey line a→b with the distance at its midpoint
          const GREY = "#8b929c";
          const posDim = (a: { x: number; y: number }, b: { x: number; y: number }, text: string, key: string) => (
            <g key={key} pointerEvents="none">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GREY} strokeWidth={1.5} strokeDasharray="5 4" />
              <circle cx={a.x} cy={a.y} r={2.5} fill={GREY} />
              <circle cx={b.x} cy={b.y} r={2.5} fill={GREY} />
              <g transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}>
                <rect x={-24} y={-10} width={48} height={20} rx={10} fill="#fff" stroke={GREY} strokeWidth={1} />
                <text x={0} y={4} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize={11} fontWeight={600} fill={GREY}>{text}</text>
              </g>
            </g>
          );
          return (
            <g>
              {/* where it sits: gap to the left/right wall, and sill above the floor */}
              {posDim(gz.wallA, gz.bl, `${gz.leftGap}`, "pd-l")}
              {posDim(gz.br, gz.wallB, `${gz.rightGap}`, "pd-r")}
              {!gz.isDoor && posDim(gz.blFloor, gz.bl, `${gz.sill}`, "pd-s")}
              <polygon points={`${gz.bl.x},${gz.bl.y} ${gz.br.x},${gz.br.y} ${gz.tr.x},${gz.tr.y} ${gz.tl.x},${gz.tl.y}`}
                fill="rgba(0,172,122,0.12)" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />
              {dot(leftMid, "width", "gw-l")}
              {dot(rightMid, "width", "gw-r")}
              {dot(topMid, "top", "gh-t")}
              {!gz.isDoor && dot(botMid, "bottom", "gh-b")}
              {label(wl, `${gz.width}`, "gw-lbl")}
              {label(hl, `${gz.height}`, "gh-lbl")}
              {/* centre free-move handle */}
              <g style={{ cursor: "grab", pointerEvents: "all" }} onPointerDown={(e) => beginItemDrag(gz, e, "move")}>
                <circle cx={gz.cx} cy={gz.cy} r={17} fill="#fff" stroke={GREEN} strokeWidth={2.5} filter="drop-shadow(0px 2px 5px rgba(0,0,0,0.3))" />
                <g stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <line x1={gz.cx - 9} y1={gz.cy} x2={gz.cx + 9} y2={gz.cy} />
                  <line x1={gz.cx} y1={gz.cy - 9} x2={gz.cx} y2={gz.cy + 9} />
                  <path d={`M${gz.cx - 9} ${gz.cy} l3 -3 M${gz.cx - 9} ${gz.cy} l3 3`} />
                  <path d={`M${gz.cx + 9} ${gz.cy} l-3 -3 M${gz.cx + 9} ${gz.cy} l-3 3`} />
                  <path d={`M${gz.cx} ${gz.cy - 9} l-3 3 M${gz.cx} ${gz.cy - 9} l3 3`} />
                  <path d={`M${gz.cx} ${gz.cy + 9} l-3 -3 M${gz.cx} ${gz.cy + 9} l3 -3`} />
                </g>
              </g>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
