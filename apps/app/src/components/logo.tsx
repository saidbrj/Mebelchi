// Mebely brand wordmark — single source of truth for the logo.
//  - <Logo/>       for the app chrome (home header, hamburger menu, auth/settings headers)
//  - logoGlyphs()  embeds the same wordmark into the hand-built SVG drawing sheets
//    (title block), scaled + centred and painted in the sheet's ink colour.
//
// TEMPORARY: this renders live <text> in Inter rather than baked vector outlines (the old
// Jihozla wordmark was traced paths). It depends on a system/loaded font, so a machine
// without Inter falls back to its default sans. `textLength` pins the drawn width to
// LOGO_W either way, so every caller's layout math stays exact. When the real Mebely.svg
// lands, swap the <text> in `Glyphs` for the traced <path>s and update LOGO_W/LOGO_H to
// the new viewBox — nothing outside this file needs to change.

export const LOGO_W = 58.8;
export const LOGO_H = 17.06;
export const LOGO_ASPECT = LOGO_W / LOGO_H;
export const BRAND_GREEN = "#00ac7a";

const WORDMARK = "Mebely";
const FONT_SIZE = 17;
const BASELINE = 12.9; // cap-height centred inside the LOGO_H box, room left for the 'y' tail

/** The letterforms alone, in the LOGO_W × LOGO_H box, painted in the inherited fill. */
function Glyphs() {
  return (
    <text
      x={0}
      y={BASELINE}
      fontFamily="Inter, system-ui, sans-serif"
      fontSize={FONT_SIZE}
      fontWeight={700}
      letterSpacing="-0.02em"
      textLength={LOGO_W}
      lengthAdjust="spacingAndGlyphs"
    >
      {WORDMARK}
    </text>
  );
}

/** The Mebely wordmark for app chrome. Height in CSS px; width follows the aspect. */
export function Logo({
  height = 22,
  color = BRAND_GREEN,
  className,
  title = "Mebely",
}: {
  height?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}
      height={height}
      width={height * LOGO_ASPECT}
      role="img"
      aria-label={title}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <Glyphs />
    </svg>
  );
}

/** The wordmark as a `<g>` for embedding in a hand-built SVG sheet: centred at (cx, cy),
 *  sized to `width` (user units), painted in `fill`. Returns an element to push into a list. */
export function logoGlyphs({
  cx,
  cy,
  width,
  fill,
  key,
}: {
  cx: number;
  cy: number;
  width: number;
  fill: string;
  key?: string;
}) {
  const s = width / LOGO_W;
  const tx = cx - width / 2;
  const ty = cy - (LOGO_H * s) / 2;
  return (
    <g key={key} transform={`translate(${tx} ${ty}) scale(${s})`} fill={fill}>
      <Glyphs />
    </g>
  );
}
