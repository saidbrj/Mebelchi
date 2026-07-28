// Cutting map (IKEA/SketchCut style): one nested board with its parts packed on it. Parts
// are coloured by SIZE (identical parts share a colour — the saw operator batches them) and
// labelled with the CABINET number + part + size, so you can tell which cabinet each part
// belongs to. Unused board shows as red diagonal hatching (waste). Pure SVG in mm;
// PNG/PDF-exportable via svgId.

import type { NestedSheet } from "../model/nest";

const INK = "#222";
const DIM = "#555";
const SW = 6;
const PAD = 150; // margin around the board (for dims)
const HEAD = 210; // header strip

/** Deterministic soft fill per PART SIZE — identical parts (either orientation) share it. */
function sizeColor(w: number, h: number): string {
  const key = `${Math.min(w, h)}x${Math.max(w, h)}`;
  let hsh = 0;
  for (let i = 0; i < key.length; i++) hsh = (hsh * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${hsh} 60% 83%)`;
}

/** The leading cabinet number from a module label like "3. Напольный 600" → "3". */
function cabNo(module: string): string {
  return module.match(/^\s*(\d+)/)?.[1] ?? "";
}

interface Props {
  sheet: NestedSheet;
  title: string; // e.g. "Лист 1"
  remainLabel: string; // "остаток" badge text
  svgId?: string;
}

export function CutMap({ sheet, title, remainLabel, svgId }: Props) {
  const W = sheet.W + PAD * 2;
  const H = sheet.H + PAD * 2 + HEAD;
  const ox = PAD;
  const oy = PAD + HEAD;
  const hatchId = `waste-${sheet.n}`;
  const els: React.ReactNode[] = [];

  // ---- header ----
  els.push(<text key="ht" x={PAD} y={110} fontSize={104} fontWeight={700} fill={INK} fontFamily="Inter, sans-serif">{title}</text>);
  els.push(
    <text key="hm" x={PAD} y={186} fontSize={68} fill={DIM} fontFamily="Inter, sans-serif">
      {sheet.material} · {sheet.W}×{sheet.H}
    </text>,
  );
  if (sheet.isRemain) {
    els.push(<rect key="rb" x={W - PAD - 430} y={44} width={430} height={92} rx={20} fill="#e8f6ef" stroke="#2f9e6f" strokeWidth={4} />);
    els.push(<text key="rbt" x={W - PAD - 215} y={106} fontSize={62} fill="#227a53" textAnchor="middle" fontWeight={600} fontFamily="Inter, sans-serif">{remainLabel}</text>);
  }

  // ---- board ----
  els.push(<rect key="board" x={ox} y={oy} width={sheet.W} height={sheet.H} fill="#fff" stroke={INK} strokeWidth={SW} />);

  // ---- leftovers: green dashed = keepable remnant, red hatch = true waste ----
  sheet.leftovers.forEach((lf, i) => {
    const x = ox + lf.x;
    const y = oy + lf.y;
    if (lf.usable) {
      els.push(<rect key={`lf${i}`} x={x} y={y} width={lf.w} height={lf.h} fill="#eef6f0" stroke="#8fc4a8" strokeWidth={SW * 0.5} strokeDasharray="20 14" />);
      const fs = Math.max(0, Math.min(54, Math.min(lf.w / (remainLabel.length * 0.62), lf.h / 3)));
      if (fs >= 18) {
        els.push(<text key={`lft${i}`} x={x + lf.w / 2} y={y + lf.h / 2 - 4} fontSize={fs} fill="#4b8a68" textAnchor="middle" fontFamily="Inter, sans-serif">{remainLabel}</text>);
        els.push(<text key={`lfs${i}`} x={x + lf.w / 2} y={y + lf.h / 2 + fs} fontSize={fs * 0.85} fill="#6aa588" textAnchor="middle" fontFamily="Inter, sans-serif">{Math.round(lf.w)}×{Math.round(lf.h)}</text>);
      }
    } else {
      els.push(<rect key={`lf${i}`} x={x} y={y} width={lf.w} height={lf.h} fill={`url(#${hatchId})`} />);
    }
  });

  // ---- parts ----
  sheet.placed.forEach((p, i) => {
    const x = ox + p.x;
    const y = oy + p.y;
    els.push(<rect key={`r${i}`} x={x} y={y} width={p.w} height={p.h} fill={sizeColor(p.panel.w, p.panel.h)} stroke={INK} strokeWidth={SW * 0.6} />);
    // label: cabinet number + part + size (only when the part is big enough to hold it)
    const cab = cabNo(p.panel.module);
    const l1 = (cab ? `#${cab} ` : "") + p.panel.partRu + (p.rot ? " ⟳" : "");
    const l2 = `${Math.round(p.panel.w)}×${Math.round(p.panel.h)}`;
    const fit = Math.min(p.w / (Math.max(l1.length, l2.length) * 0.6), p.h / 2.6);
    const fs = Math.max(0, Math.min(60, fit));
    if (fs >= 20) {
      els.push(<text key={`c${i}`} x={x + p.w / 2} y={y + p.h / 2 - 6} fontSize={fs} fill={INK} textAnchor="middle" fontFamily="Inter, sans-serif">{l1}</text>);
      els.push(<text key={`s${i}`} x={x + p.w / 2} y={y + p.h / 2 + fs} fontSize={fs * 0.85} fill={DIM} textAnchor="middle" fontFamily="Inter, sans-serif">{l2}</text>);
    }
  });

  // ---- sheet dims: width along the top, height down the left ----
  const wy = oy - 60;
  els.push(<line key="wd" x1={ox} y1={wy} x2={ox + sheet.W} y2={wy} stroke={DIM} strokeWidth={SW * 0.6} />);
  [0, sheet.W].forEach((x) => els.push(<line key={`wt${x}`} x1={ox + x} y1={wy - 24} x2={ox + x} y2={wy + 24} stroke={DIM} strokeWidth={SW * 0.6} />));
  els.push(<text key="wl" x={ox + sheet.W / 2} y={wy - 24} fontSize={72} fill={DIM} fontWeight={600} textAnchor="middle" fontFamily="Inter, sans-serif">{sheet.W}</text>);
  const hx = ox - 60;
  els.push(<line key="hd" x1={hx} y1={oy} x2={hx} y2={oy + sheet.H} stroke={DIM} strokeWidth={SW * 0.6} />);
  [0, sheet.H].forEach((y) => els.push(<line key={`ht${y}`} x1={hx - 24} y1={oy + y} x2={hx + 24} y2={oy + y} stroke={DIM} strokeWidth={SW * 0.6} />));
  els.push(<text key="hl" x={hx - 30} y={oy + sheet.H / 2} fontSize={72} fill={DIM} fontWeight={600} textAnchor="middle" transform={`rotate(-90 ${hx - 30} ${oy + sheet.H / 2})`} fontFamily="Inter, sans-serif">{sheet.H}</text>);

  return (
    <svg id={svgId} viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg" style={{ background: "#fff", display: "block" }}>
      <defs>
        <pattern id={hatchId} width={40} height={40} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width={40} height={40} fill="#fdeeec" />
          <line x1={0} y1={0} x2={0} y2={40} stroke="#e2a69c" strokeWidth={10} />
        </pattern>
      </defs>
      {els}
    </svg>
  );
}
