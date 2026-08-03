// Shared W/H/D/shelf dimension controls for a single module. Used by BOTH the "Размер" sheet in
// ConfigScreen and the V21 studio editor, so the two can never drift on clamps or store wiring.
//
// Width goes through the grid (gridSetCabW → neighbours slide) for a tiled module, or resizeCab for
// a free one; height + depth through patchCabDims (owns the clamps + «ко всему ряду» mode); shelves
// through patchCab by index. Live edits skip the undo stack — beginCabEdit snapshots once per gesture.

import React from "react";
import { useStore } from "../store";
import type { Cabinet } from "../model/cabinet";
import { cabDepth, maxCabH, MIN_H, D_MIN, D_MAX } from "../model/bands";

export const GlyphW = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M6 15L6.44494 15.4534L11.6225 20.5L12.5528 19.5932L8.48764 15.6308L21.5124 15.6308L17.4472 19.5932L18.3775 20.5L23.5551 15.4534L24 15L23.5551 14.5466L18.3775 9.5L17.4472 10.4068L21.5124 14.3692L8.48764 14.3692L12.5528 10.4068L11.6225 9.5L6.44494 14.5466L6 15Z" /></svg>);
export const GlyphH = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M14.5 6L14.0466 6.44494L9 11.6225L9.90681 12.5528L13.8692 8.48764L13.8692 21.5124L9.90681 17.4472L9 18.3775L14.0466 23.5551L14.5 24L14.9534 23.5551L20 18.3775L19.0932 17.4472L15.1308 21.5124L15.1308 8.48764L19.0932 12.5528L20 11.6225L14.9534 6.44494L14.5 6Z" /></svg>);
export const GlyphD = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M10.125 7.5L9.75 9H20.25L19.875 7.5H10.125ZM15 9.75L13.125 11.25H14.25V17.25H11.625L15 20.25L18.375 17.25H15.75V11.25H16.875L15 9.75ZM6.375 21L6 22.5H24L23.625 21H6.375Z" /></svg>);
export const GlyphShelf = () => (<svg width="20" height="20" viewBox="0 0 30 30" fill="currentColor" aria-hidden><path d="M6.5625 8.90625V10.2604H23.4375V8.90625H6.5625ZM6.5625 11.6146V12.9687H23.4375V11.6146H6.5625ZM6.5625 14.3229V15.6771H23.4375V14.3229H6.5625ZM6.5625 17.0312V18.3854H23.4375V17.0312H6.5625ZM6.5625 19.7396V21.0937H23.4375V19.7396H6.5625Z" /></svg>);

export function DimSlider(props: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number;
  unit?: string; onBegin?: () => void; onLive: (v: number) => void; onCommit: (v: number) => void;
}) {
  const { icon, label, value, min, max, step, unit = "мм", onBegin, onLive, onCommit } = props;
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <div className="dim-row">
      {icon && <span className="dim-ico" aria-hidden>{icon}</span>}
      <span className="dim-lbl">{label}</span>
      <input
        className="dim-slider" type="range" min={min} max={max} step={step} value={value}
        onPointerDown={onBegin}
        onChange={(e) => onLive(clamp(Number(e.target.value)))}
        onPointerUp={(e) => onCommit(clamp(Number((e.target as HTMLInputElement).value)))}
        onKeyUp={(e) => onCommit(clamp(Number((e.target as HTMLInputElement).value)))}
        onContextMenu={(e) => e.preventDefault()}
      />
      <input
        className="dim-num" type="number" inputMode="numeric" min={min} max={max} step={step}
        key={value} defaultValue={value}
        onFocus={onBegin}
        onBlur={(e) => { const v = clamp(Number(e.target.value)); if (v !== value) onCommit(v); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {unit && <span className="dim-unit">{unit}</span>}
    </div>
  );
}

/** The four dimension sliders for ONE module, wired to the store. Self-contained — reads the ceiling
 *  + resize actions itself, so a caller only supplies the cabinet. */
export function DimControls({ cab }: { cab: Cabinet }) {
  const cabs = useStore((s) => s.cabs);
  const ceiling = useStore((s) => s.ceiling);
  const beginCabEdit = useStore((s) => s.beginCabEdit);
  const gridSetCabW = useStore((s) => s.gridSetCabW);
  const resizeCab = useStore((s) => s.resizeCab);
  const resizeCabLive = useStore((s) => s.resizeCabLive);
  const patchCabDims = useStore((s) => s.patchCabDims);
  const patchCab = useStore((s) => s.patchCab);
  const patchCabLive = useStore((s) => s.patchCabLive);

  const idx = cabs.findIndex((c) => c.id === cab.id);
  // a module tiled into the wall sheet resizes its COLUMN (neighbours slide); a free one resizes alone
  const tiled = cab.cell != null && cab.px == null;
  const isOven = cab.appliance === "oven";

  return (
    <>
      <DimSlider icon={<GlyphW />} label="Ширина" value={cab.w} min={150} max={1200} step={50}
        onBegin={beginCabEdit}
        onLive={(v) => (tiled ? gridSetCabW(cab.id, v, "right", true) : resizeCabLive(cab.id, v))}
        onCommit={(v) => (tiled ? gridSetCabW(cab.id, v, "right", false) : resizeCab(cab.id, v))} />
      <DimSlider icon={<GlyphH />} label="Высота" value={cab.h} min={MIN_H} max={maxCabH(cab, ceiling)} step={10}
        onBegin={beginCabEdit}
        onLive={(v) => patchCabDims(cab.id, { h: v }, true)}
        onCommit={(v) => patchCabDims(cab.id, { h: v })} />
      <DimSlider icon={<GlyphD />} label="Глубина" value={cabDepth(cab)} min={D_MIN} max={D_MAX} step={10}
        onBegin={beginCabEdit}
        onLive={(v) => patchCabDims(cab.id, { depth: v }, true)}
        onCommit={(v) => patchCabDims(cab.id, { depth: v })} />
      {isOven && (
        <>
          <DimSlider icon={<GlyphH />} label="Высота духовки" value={cab.applianceH ?? 580} min={350} max={900} step={10}
            onBegin={beginCabEdit}
            onLive={(v) => { if (idx >= 0) patchCabLive(idx, { applianceH: v }); }}
            onCommit={(v) => { if (idx >= 0) patchCab(idx, { applianceH: v }); }} />
          <DimSlider icon={<GlyphH />} label="Высота от пола" value={cab.applianceY ?? 850} min={100} max={1600} step={10}
            onBegin={beginCabEdit}
            onLive={(v) => { if (idx >= 0) patchCabLive(idx, { applianceY: v }); }}
            onCommit={(v) => { if (idx >= 0) patchCab(idx, { applianceY: v }); }} />
        </>
      )}
      <DimSlider icon={<GlyphShelf />} label="Полок" value={cab.count ?? 0} min={0} max={8} step={1} unit=""
        onBegin={beginCabEdit}
        onLive={(v) => { if (idx >= 0) patchCabLive(idx, { count: v }); }}
        onCommit={(v) => { if (idx >= 0) patchCab(idx, { count: v }); }} />
    </>
  );
}
