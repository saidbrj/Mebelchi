// The one-row edit bar for a single selected module — width, finish, and a way into the rest.
//
// WHY. Changing a cabinet's width used to be: tap the module → tap «Размер» on the left rail →
// drag a slider → close the sheet. Four actions, and the sheet covered ~70% of the screen
// INCLUDING the cabinet you were resizing, so you couldn't see the thing you were changing while
// you changed it. Width and finish are the two edits a seller makes constantly; they belong in
// reach, not behind a panel.
//
// It is the toolbar's TOP ROW, taking the place of the «Добавить шкаф» heading while a module is
// selected. The row below it — the five band chips — stays put in both states, so the toolbar is
// one fixed height and the 3D canvas above never resizes under your finger.
//
// The width path is COPIED FROM DimControls on purpose — a tiled module resizes its column
// (neighbours slide), a free one resizes alone. Two ways to set a width that disagree is how the
// front view and the 3D drifted apart before.

import { useStore } from "../store";
import { useT } from "../i18n/useT";
import type { Cabinet, FinishKey } from "../model/cabinet";
import type { KitchenStyle } from "../model/layout";
import { cornerShapeOf } from "../model/bands";
import { catalogByColor } from "../model/catalog";
import { matSwatchStyle } from "../three/pbr";

const W_MIN = 150;
const W_MAX = 1200;
const W_STEP = 50;

export function QuickEditBar({
  cab,
  style,
  onStyle,
  onMore,
}: {
  cab: Cabinet;
  /** the kitchen-wide finish — the swatch falls back to it when the module has no override */
  style: KitchenStyle;
  /** open the full «Стиль» panel (the swatch is a shortcut to it, not a picker of its own) */
  onStyle: () => void;
  /** open the full «Размер» panel — height, depth, shelves, конструкция */
  onMore: () => void;
}) {
  const t = useT();
  const beginCabEdit = useStore((s) => s.beginCabEdit);
  const gridSetCabW = useStore((s) => s.gridSetCabW);
  const resizeCab = useStore((s) => s.resizeCab);

  // a module tiled into the wall sheet resizes its COLUMN; a free-standing one resizes alone
  const tiled = cab.cell != null && cab.px == null;
  const setW = (v: number) => {
    const w = Math.max(W_MIN, Math.min(W_MAX, Math.round(v)));
    if (w === cab.w) return;
    beginCabEdit();
    if (tiled) gridSetCabW(cab.id, w, "right", false);
    else resizeCab(cab.id, w);
  };

  // An INNER corner's width is its arm length, driven by the depth of the runs it butts into —
  // stepping it here would fight that. Its own panel explains the relationship; this bar doesn't.
  const canWidth = !cab.corner || cornerShapeOf(cab) === "outer";

  // the front finish, as the seller sees it: this module's override, else the kitchen's
  const key: FinishKey = "facade";
  const col = cab.finish?.[key] ?? (style as unknown as Record<string, number>)[key];
  const hex = col != null ? `#${(col >>> 0).toString(16).padStart(6, "0")}` : "#d9d6cf";
  const swatch = matSwatchStyle(hex, catalogByColor(col, "facade")?.tex);

  return (
    <div className="quick-bar">
      {canWidth && (
        <div className="qb-w">
          <button className="qb-step" type="button" onClick={() => setW(cab.w - W_STEP)} disabled={cab.w <= W_MIN} aria-label={`−${W_STEP} мм`}>−</button>
          {/* keyed on the value so an edit from the 3D handles or the panel re-seeds the field */}
          <input
            className="qb-num"
            inputMode="numeric"
            key={cab.w}
            defaultValue={cab.w}
            aria-label={t.fe.width}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => setW(Number(e.target.value) || cab.w)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
          <span className="qb-unit">{t.config.mm}</span>
          <button className="qb-step" type="button" onClick={() => setW(cab.w + W_STEP)} disabled={cab.w >= W_MAX} aria-label={`+${W_STEP} мм`}>+</button>
        </div>
      )}
      <button className="qb-swatch" type="button" onClick={onStyle} aria-label={t.fe.style} style={swatch} />
      <button className="qb-more" type="button" onClick={onMore} aria-label={t.config.more}>⋯</button>
    </div>
  );
}
