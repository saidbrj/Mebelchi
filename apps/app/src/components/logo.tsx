// Mebely brand wordmark — single source of truth for the logo.
// Uses vector paths from mebely_wordmark2.svg.
//  - <Logo/>       for the app chrome (home header, hamburger menu, auth/settings headers)
//  - logoGlyphs()  embeds the same wordmark into the hand-built SVG drawing sheets
//    (title block), scaled + centred and painted in the sheet's ink colour.

export const LOGO_W = 465.4;
export const LOGO_H = 55.56;
export const LOGO_ASPECT = LOGO_W / LOGO_H;
export const BRAND_GREEN = "#00ac7a";

/** The letterforms from mebely_wordmark2.svg in the LOGO_W × LOGO_H box, painted in the inherited fill. */
function Glyphs() {
  return (
    <g>
      <path d="M11.41,12.26v43.29H0V0h11.33c4.32,0,6.2,2.19,7.91,4.3l23.15,28.35,23.15-28.35c1.71-2.11,3.59-4.3,7.91-4.3h11.33v55.56h-11.41V12.26l-26.5,31.84h-8.97L11.41,12.26Z" />
      <path d="M121.68,11.05c-10.92,0-14.19,4.14-15,11.53h58.21v10.4h-58.21c.81,7.39,4.08,11.45,15,11.45h44.19v11.13h-44.19c-19.97,0-26.9-9.5-26.9-27.78S101.7,0,121.68,0h44.19v11.05h-44.19Z" />
      <path d="M236.59,27.21c7.66,2.19,11.01,6.99,11.01,13.32,0,8.77-6.36,15.03-21.77,15.03h-48.84V0h47.69c20.14,0,21.44,10.56,21.44,14.7,0,6.99-3.83,10.72-9.54,12.51ZM225.42,22.17c6.36,0,9.38-2.03,9.38-5.85,0-3.57-2.61-6.09-8.56-6.09h-37.99v11.94h37.18ZM188.24,32.08v13.08h38.81c6.85,0,9.05-3.09,9.05-6.17s-2.2-6.9-9.87-6.9h-37.99Z" />
      <path d="M281.38,11.05c-10.92,0-14.19,4.14-15,11.53h58.21v10.4h-58.21c.81,7.39,4.08,11.45,15,11.45h44.19v11.13h-44.19c-19.97,0-26.9-9.5-26.9-27.78s6.93-27.78,26.9-27.78h44.19v11.05h-44.19Z" />
      <path d="M347.45,0v32.57c0,9.1,3.51,11.61,15.25,11.61h37.18v11.37h-37.18c-18.43,0-26.9-6.34-26.9-22.99V0h11.66Z" />
      <path d="M403.03,0l17.12,20.55c1.71,2.11,3.91,4.22,5.54,7.07,1.63-2.84,3.83-4.95,5.63-7.07L448.44,0h16.96l-27.56,29.97c-1.79,1.95-6.28,6.34-6.28,9.67v15.92h-11.66v-15.92c0-3.41-4.57-7.8-6.28-9.67L386.08,0h16.96Z" />
    </g>
  );
}

/** The Mebely wordmark for app chrome. Height in CSS px; width follows the aspect. */
export function Logo({
  height = 14,
  color = "#000",
  className,
  title = "Mebely",
}: {
  height?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  // No «BETA» badge. App Review reads a beta/demo/trial label in a submitted build as "this is not
  // the finished product" (guideline 2.2 — beta versions belong on TestFlight), and this app is
  // already carrying a 5.6 flag. Put it back after approval if you want it.
  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg
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
    </div>
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
