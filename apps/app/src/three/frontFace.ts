// THE FRONT'S BODY, in 3D. One generator, every profile.
//
// Until now every door and every drawer face in this app was a single flat BoxGeometry — one line of
// kitchen3d — with one crude glass branch bolted on. That is why the app could not draw the kitchens
// in the reference photos: a neoclassic raised panel, a shaker frame and a fluted front are not
// colours, they are geometry.
//
// The manufacturing model this mirrors (confirmed with the shop): a profiled front is ONE piece of
// MDF with its shape routed in, then painted — not an assembled frame. So these meshes are a picture
// of a single blank, and @mebelchi/pricing bills exactly that: one panel + machine time. Both read
// the same fronts.ts helpers (innerRect / mullionsFor), so a door cannot be drawn one way and billed
// another.
//
// Metres. The face is centred at (xC,yC) and its slab is CENTRED on z with thickness FRONT_T —
// i.e. exactly the box the flat slab used to be, so every caller's existing z math still holds.

import * as THREE from "three";
import { innerRect, mullionsFor, FLUTE_PITCH_MM, MULLION_MM } from "@mebelchi/pricing";
import type { FrontProfile } from "../model/cabinet";

/** Front thickness (m) — an 18mm blank, drawn at 20mm as it always was. */
export const FRONT_T = 0.02;

/** Depth of the routed recess on a framed front (m). */
const RECESS = 0.008;
/** Depth of a flute's rib (m). */
const RIB = 0.004;
/** Glass pane thickness (m). */
const PANE_T = 0.004;

/** Translucent "витрина" glass — shared by regular, corner and appliance fronts. */
export const makeGlassMat = () =>
  new THREE.MeshStandardMaterial({ color: 0xbfe0ee, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.1 });

/** Does the front carry a swinging leaf at all? `none` is a carcass with an open face. */
export const hasBody = (p: FrontProfile): boolean => p !== "none";

/**
 * Build one front's meshes into `target`.
 *
 * `facade` is ONE material for the whole front, not one per mesh: a shaker front is 5 boxes and a
 * grid front more, and kitchen3d's facadeMat() constructs a fresh MeshStandardMaterial on every
 * call — so a per-mesh material would multiply materials by 6 and break the selection highlight,
 * which expects a front to share one.
 *
 * The caller owns the group: every mesh must land inside the one THREE.Group that carries
 * `userData.openable`, and before pivotGroup runs (it shifts the children).
 */
export function frontFace(
  profile: FrontProfile,
  fw: number,
  fh: number,
  xC: number,
  yC: number,
  z: number,
  facade: THREE.Material,
  target: THREE.Object3D,
  glass?: THREE.Material,
): void {
  if (!hasBody(profile) || fw <= 0 || fh <= 0) return;

  const box = (w: number, h: number, d: number, x: number, y: number, zz: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, zz);
    mesh.castShadow = true;
    target.add(mesh);
    return mesh;
  };

  const zF = z + FRONT_T / 2; // the face the room sees
  const zB = z - FRONT_T / 2; // the face against the carcass

  if (profile === "flat") {
    box(fw, fh, FRONT_T, xC, yC, z, facade);
    return;
  }

  if (profile === "fluted") {
    target.add(new THREE.Mesh(flutedGeometry(fw, fh, xC, yC, zB), facade));
    return;
  }

  // --- framed profiles (shaker / raised / glass / grid) ---------------------------------------
  // The frame width is the SAME rule pricing uses (innerRect), so the picture and the price agree.
  const inner = innerRect(fw * 1000, fh * 1000);
  const iw = inner.w / 1000, ih = inner.h / 1000;
  if (iw <= 0 || ih <= 0) {
    box(fw, fh, FRONT_T, xC, yC, z, facade); // door too small to frame → it is a flat blank
    return;
  }
  const fr = (fw - iw) / 2; // rail / stile width

  const glazed = profile === "glass" || profile === "grid";
  // The frame: 4 rails at full thickness on a glazed front (the middle is routed clean THROUGH), and
  // on a solid one the RECESS-deep cap left standing over the plate the router bottomed out on.
  const railT = glazed ? FRONT_T : RECESS;
  const railZ = glazed ? z : zF - railT / 2;
  box(fw, fr, railT, xC, yC + fh / 2 - fr / 2, railZ, facade); // top rail
  box(fw, fr, railT, xC, yC - fh / 2 + fr / 2, railZ, facade); // bottom rail
  box(fr, ih, railT, xC - fw / 2 + fr / 2, yC, railZ, facade); // left stile
  box(fr, ih, railT, xC + fw / 2 - fr / 2, yC, railZ, facade); // right stile

  if (!glazed) {
    // the material the router bottomed out on — the rest of the one-piece blank
    const plateT = FRONT_T - RECESS;
    box(fw, fh, plateT, xC, yC, zB + plateT / 2, facade);
    if (profile === "raised") {
      // the неоклассика centre field: a bevelled panel rising out of the recess, stopping just shy
      // of the rail face. ExtrudeGeometry's bevel IS the profile — it is what the router cuts.
      target.add(new THREE.Mesh(raisedGeometry(iw, ih, xC, yC, zB + plateT), facade));
    }
    return;
  }

  // --- glazed ---------------------------------------------------------------------------------
  const gmat = glass ?? makeGlassMat();
  box(iw, ih, PANE_T, xC, yC, z, gmat); // the pane, mid-thickness inside the frame
  if (profile === "grid") {
    // раскладка: the bars sit on the ROOM side of the pane, their faces flush with the frame
    const bw = MULLION_MM / 1000;
    const barT = FRONT_T / 2;
    const barZ = zF - barT / 2;
    const { cols, rows } = mullionsFor(fw * 1000, fh * 1000);
    for (let i = 1; i < cols; i++) box(bw, ih, barT, xC - iw / 2 + (iw * i) / cols, yC, barZ, facade);
    for (let j = 1; j < rows; j++) box(iw, bw, barT, xC, yC - ih / 2 + (ih * j) / rows, barZ, facade);
  }
}

/**
 * A fluted face as ONE mesh: the extrusion of a scalloped cross-section.
 *
 * The ribs run vertically, so the shape varies across x and is CONSTANT up y — which is precisely an
 * extrusion. The two obvious alternatives are both traps: N separate rib meshes would put ~30 meshes
 * on every fluted door in the kitchen, and a normal map would ride the box's default UVs (0..1 per
 * face), so the rib pitch would stretch with the door's width instead of staying at a fixed mm — the
 * one thing a real fluted front never does.
 */
function flutedGeometry(fw: number, fh: number, xC: number, yC: number, zB: number): THREE.BufferGeometry {
  const pitch = FLUTE_PITCH_MM / 1000;
  const n = Math.max(3, Math.round(fw / pitch)); // whole ribs only — a half rib at the edge reads wrong
  const p = fw / n;
  const valley = FRONT_T - RIB; // between two ribs
  const ctrl = FRONT_T + RIB; // Bezier control height whose midpoint lands exactly on FRONT_T

  // shape coords: x across the door's width, y its THICKNESS
  const s = new THREE.Shape();
  s.moveTo(-fw / 2, 0);
  s.lineTo(fw / 2, 0); // back face
  s.lineTo(fw / 2, valley);
  for (let i = n - 1; i >= 0; i--) {
    const x1 = -fw / 2 + (i + 1) * p, x0 = -fw / 2 + i * p;
    s.quadraticCurveTo((x0 + x1) / 2, ctrl, x0, valley); // one rib
  }
  s.lineTo(-fw / 2, 0);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, { depth: fh, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(Math.PI / 2); // extrude axis Z → −Y, shape Y (thickness) → +Z (out of the carcass)
  geo.translate(xC, yC + fh / 2, zB);
  geo.computeVertexNormals();
  return geo;
}

/** The bevelled centre panel of a raised (neoclassic) front — the bevel is the routed profile. */
function raisedGeometry(iw: number, ih: number, xC: number, yC: number, zFloor: number): THREE.BufferGeometry {
  const bevel = Math.min(0.012, iw / 4, ih / 4);
  const rise = 0.003;
  const w = iw - 2 * bevel, h = ih - 2 * bevel;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: rise,
    bevelEnabled: true,
    bevelThickness: rise,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  });
  // the extrusion spans −rise … 2·rise on Z, widest (the full inner rect) at 0 — so seating local 0
  // on the recess floor buries the back bevel in the plate and leaves the field standing 6mm proud,
  // just under the rail face. No gap, no z-fight.
  geo.translate(xC, yC, zFloor);
  geo.computeVertexNormals();
  return geo;
}
