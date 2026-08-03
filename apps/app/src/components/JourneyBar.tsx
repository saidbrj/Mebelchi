// The one top bar for every journey screen: ☰ · ← · project name · optional right slot.
//
// Before this, the journey wore three different heads. The canvas screens (room / constructor /
// render) each carried their own copy of this bar; «Раскладка» had a lone burger; and
// Инженерия / Смета / Передача had no bar at all — just a floating hamburger over the content,
// with their phase label sitting INSIDE the scrolling body so it scrolled away. Walking the
// journey meant watching the chrome rearrange itself twice.
//
// The forward CTA still lives in two places, and that part is deliberate: canvas screens put it
// in `right` because their bottom edge is taken by tool strips, and because on a screen where
// you're dragging cabinets the main action is editing, not advancing. Document screens leave
// `right` empty and let <Footer> own the primary button, where the thumb is.
import type { ReactNode } from "react";
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { ProjectTitle } from "./ProjectTitle";

export function JourneyBar({
  sub,
  right,
  className = "",
}: {
  /** second line under the project name — the constructor's live price ticker */
  sub?: ReactNode;
  /** trailing control: the step's Next on canvas screens, the gear on «Раскладка» */
  right?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const back = useStore((s) => s.back);
  const openMenu = useStore((s) => s.openMenu);

  return (
    <div className={`stepbar cfg-bar${className ? " " + className : ""}`}>
      <div className="cfg-bar-l">
        <button className="cfg-burger" onClick={openMenu} type="button" aria-label={t.menu.menu}>
          <span /><span />
        </button>
        <button className="cfg-back" onClick={back} type="button" aria-label={t.config.back}>←</button>
      </div>

      <ProjectTitle sub={sub} />

      <div className="cfg-bar-r">{right}</div>
    </div>
  );
}
