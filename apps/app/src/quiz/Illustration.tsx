// Quiz / space illustrations (ported verbatim from v7-journey.html `ill()`).
// Static SVG inner-markup keyed by `pic`; rendered into a shared <svg> frame.

const W = "#cfc7b7";
const D = "#9a917e";
const G = "#b8b0a0";
const ACC = "#c0883a";

const F: Record<string, string> = {
  oven_under: `<rect x="60" y="30" width="80" height="20" rx="3" fill="${G}"/><rect x="60" y="52" width="80" height="58" rx="3" fill="${W}" stroke="${D}"/><rect x="70" y="62" width="60" height="38" rx="3" fill="#3a362f"/>`,
  oven_tall: `<rect x="62" y="14" width="76" height="118" rx="4" fill="${W}" stroke="${D}"/><rect x="72" y="46" width="56" height="40" rx="3" fill="#3a362f"/>`,
  hood_integ: `<rect x="50" y="20" width="100" height="26" rx="3" fill="${W}" stroke="${D}"/><rect x="74" y="46" width="52" height="10" rx="2" fill="${G}"/><rect x="60" y="92" width="80" height="14" rx="2" fill="#3a362f"/>`,
  hood_dome: `<path d="M70 24 L130 24 L116 56 L84 56 Z" fill="${G}" stroke="${D}"/><rect x="92" y="14" width="16" height="14" fill="${G}"/><rect x="60" y="92" width="80" height="14" rx="2" fill="#3a362f"/>`,
  fridge_integ: `<rect x="74" y="14" width="52" height="118" rx="4" fill="${W}" stroke="${D}"/><line x1="100" y1="60" x2="100" y2="64" stroke="${D}"/>`,
  fridge_free: `<rect x="76" y="20" width="48" height="112" rx="5" fill="${G}" stroke="${D}"/><line x1="76" y1="70" x2="124" y2="70" stroke="${D}"/><rect x="115" y="36" width="4" height="14" fill="${D}"/>`,
  // WALL BANDS — shown as an elevation: the ceiling line, the wall units, the worktop.
  // single: one row with bare wall above it. tall: one row running up to the ceiling.
  // antresol: the standard row PLUS a second one seated on top, reaching the ceiling.
  wall_single: `<line x1="40" y1="16" x2="160" y2="16" stroke="${D}" stroke-width="3"/><rect x="46" y="44" width="108" height="34" fill="${W}" stroke="${D}"/><rect x="46" y="104" width="108" height="8" fill="${D}"/><rect x="46" y="112" width="108" height="20" fill="${W}" stroke="${D}"/>`,
  wall_tall: `<line x1="40" y1="16" x2="160" y2="16" stroke="${D}" stroke-width="3"/><rect x="46" y="18" width="108" height="60" fill="${W}" stroke="${D}"/><rect x="46" y="104" width="108" height="8" fill="${D}"/><rect x="46" y="112" width="108" height="20" fill="${W}" stroke="${D}"/>`,
  wall_antresol: `<line x1="40" y1="16" x2="160" y2="16" stroke="${D}" stroke-width="3"/><rect x="46" y="18" width="108" height="24" fill="${G}" stroke="${D}"/><rect x="46" y="42" width="108" height="36" fill="${W}" stroke="${D}"/><rect x="46" y="104" width="108" height="8" fill="${D}"/><rect x="46" y="112" width="108" height="20" fill="${W}" stroke="${D}"/>`,
  // the deep variant, drawn in SECTION so the overhang reads: the top box juts further into the
  // room than the wall units under it (base depth, 560 rather than 350)
  wall_antresol_deep: `<line x1="40" y1="16" x2="170" y2="16" stroke="${D}" stroke-width="3"/><rect x="46" y="18" width="124" height="30" fill="${ACC}" fill-opacity=".45" stroke="${D}"/><rect x="46" y="48" width="78" height="34" fill="${W}" stroke="${D}"/><rect x="46" y="104" width="124" height="8" fill="${D}"/><rect x="46" y="112" width="124" height="20" fill="${W}" stroke="${D}"/>`,
  // FRONTS — one door, drawn as the CNC would cut it: a bare blank, a routed frame, a frame with a
  // bevelled field (неоклассика), and a ribbed face at a fixed pitch.
  front_flat: `<rect x="64" y="24" width="72" height="104" rx="3" fill="${W}" stroke="${D}"/><rect x="124" y="66" width="5" height="20" rx="2" fill="${D}"/>`,
  front_shaker: `<rect x="64" y="24" width="72" height="104" rx="3" fill="${W}" stroke="${D}"/><rect x="76" y="36" width="48" height="80" fill="none" stroke="${D}"/><rect x="124" y="66" width="5" height="20" rx="2" fill="${D}"/>`,
  front_raised: `<rect x="64" y="24" width="72" height="104" rx="3" fill="${W}" stroke="${D}"/><rect x="76" y="36" width="48" height="80" fill="none" stroke="${D}"/><rect x="84" y="44" width="32" height="64" fill="${G}" stroke="${D}"/><rect x="124" y="66" width="5" height="20" rx="2" fill="${D}"/>`,
  front_fluted: `<rect x="64" y="24" width="72" height="104" rx="3" fill="${W}" stroke="${D}"/><line x1="76" y1="30" x2="76" y2="122" stroke="${D}"/><line x1="88" y1="30" x2="88" y2="122" stroke="${D}"/><line x1="100" y1="30" x2="100" y2="122" stroke="${D}"/><line x1="112" y1="30" x2="112" y2="122" stroke="${D}"/><line x1="124" y1="30" x2="124" y2="122" stroke="${D}"/>`,
  lay_i: `<rect x="46" y="58" width="108" height="14" fill="${D}"/><rect x="46" y="44" width="108" height="14" fill="${W}" stroke="${D}"/>`,
  lay_l: `<rect x="46" y="58" width="80" height="14" fill="${D}"/><rect x="126" y="40" width="14" height="60" fill="${D}"/><rect x="46" y="44" width="80" height="14" fill="${W}" stroke="${D}"/>`,
  // galley — two parallel runs
  lay_galley: `<rect x="46" y="40" width="108" height="14" fill="${D}"/><rect x="46" y="86" width="108" height="14" fill="${D}"/><rect x="46" y="54" width="108" height="6" fill="${G}"/><rect x="46" y="80" width="108" height="6" fill="${G}"/>`,
  // U — three connected sides, open at the bottom
  lay_u: `<rect x="46" y="40" width="108" height="14" fill="${D}"/><rect x="46" y="40" width="14" height="62" fill="${D}"/><rect x="140" y="40" width="14" height="62" fill="${D}"/>`,
  // peninsula — one run + a leg jutting into the room
  lay_peninsula: `<rect x="46" y="40" width="108" height="14" fill="${D}"/><rect x="124" y="54" width="14" height="50" fill="${D}"/><rect x="124" y="98" width="34" height="14" rx="2" fill="${G}"/>`,
  shape_i: `<rect x="30" y="40" width="140" height="60" fill="none" stroke="${D}" stroke-width="3"/><rect x="34" y="44" width="132" height="10" fill="${ACC}" opacity=".5"/>`,
  shape_l: `<path d="M30 40 H170 V100 H100 V72 H30 Z" fill="none" stroke="${D}" stroke-width="3"/>`,
};

export function Illustration({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 200 140" className="ill" dangerouslySetInnerHTML={{ __html: F[kind] ?? "" }} />
  );
}
