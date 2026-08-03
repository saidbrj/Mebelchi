// The GOLA side-panel shop drawing — the notched outline the factory cuts (cf. the sample drawing:
// a rectangle with a stepped notch at the front edge at each profile). Derived from model/gola.ts,
// so it always matches the 3D + the profile placement. Front edge = right; back = left; bottom = 0.

import { golaSpec } from "../model/gola";
import { cabDepth } from "../model/bands";
import { cabBand } from "../model/resolve";
import type { Cabinet } from "../model/cabinet";

export function GolaSidePanel({ cab }: { cab: Cabinet }) {
  const spec = golaSpec(cab);
  if (!spec) return null;

  const depth = Math.round(cabDepth(cab)); // panel width in the drawing (front-to-back, mm)
  const band = cabBand(cab);
  const height = Math.max(1, Math.round(band.carcass1 - band.carcass0)); // panel height (mm)
  const nd = spec.depthMm, nh = spec.heightMm;

  // notch Y-bands (mm from the bottom), clamped + sorted — same rule the 3D notches the side by
  const bands = spec.profileFractions
    .map((f) => { const cy = f * height; return { lo: Math.max(0, cy - nh / 2), hi: Math.min(height, cy + nh / 2) }; })
    .sort((a, b) => a.lo - b.lo);

  // outline in mm (x: 0 back → depth front; y: 0 bottom → height top), clockwise from back-bottom
  const pts: [number, number][] = [[0, 0], [depth, 0]];
  let cur = 0;
  for (const b of bands) {
    if (b.lo > cur) pts.push([depth, b.lo]);
    pts.push([depth - nd, b.lo], [depth - nd, b.hi], [depth, b.hi]);
    cur = b.hi;
  }
  if (cur < height) pts.push([depth, height]);
  pts.push([0, height]);

  // SVG space: 1 mm = 1 unit, y flipped, with padding for the dimension lines
  const PAD = 90;
  const vbW = depth + PAD * 2, vbH = height + PAD * 2;
  const X = (mm: number) => PAD + mm;
  const Y = (mm: number) => PAD + (height - mm); // flip
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x)} ${Y(y)}`).join(" ") + " Z";

  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, vertical = false) => (
    <g stroke="#94a3b8" strokeWidth={1.4} fontFamily="Inter, sans-serif">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1 - 4} y1={y1 - (vertical ? 0 : 4)} x2={x1 + (vertical ? 4 : 0)} y2={y1 + 4} />
      <line x1={x2 - 4} y1={y2 - (vertical ? 0 : 4)} x2={x2 + (vertical ? 4 : 0)} y2={y2 + 4} />
      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2} fill="#334155" stroke="none" fontSize={26}
        textAnchor="middle" dominantBaseline="central"
        transform={vertical ? `rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2})` : undefined}>{label}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ maxHeight: "34vh", display: "block", margin: "0 auto" }} xmlns="http://www.w3.org/2000/svg">
      <path d={path} fill="#eef2f6" stroke="#1e293b" strokeWidth={3} strokeLinejoin="miter" />
      {/* depth across the top, height down the left */}
      {dim(X(0), PAD - 34, X(depth), PAD - 34, String(depth))}
      {dim(PAD - 34, Y(0), PAD - 34, Y(height), String(height), true)}
      {/* notch depth callout on the topmost band */}
      {bands.length > 0 && dim(X(depth - nd), Y(bands[bands.length - 1].hi) - 28, X(depth), Y(bands[bands.length - 1].hi) - 28, String(nd))}
    </svg>
  );
}
