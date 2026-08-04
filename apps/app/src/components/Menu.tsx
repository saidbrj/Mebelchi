// The navbar hamburger drawer: shows the journey PROGRESS (tap a visited step to
// jump back) plus app navigation to the home / projects / settings screens.
import type { ReactNode } from "react";
import { useStore, type Screen } from "../store";
import { useT } from "../i18n/useT";
import { Logo } from "./logo";
import { IconTabHome, IconTabCatalog, IconTabSettings, IconTabUser } from "./icons";

// phase → its label key in t.menu.phases; label resolved at render (language-aware)
const PHASES: { key: keyof ReturnType<typeof useT>["menu"]["phases"]; target: Screen; members: Screen[] }[] = [
  // the «Комната» step IS the room editor now (the standalone quiz + shape picker are retired);
  // "space" stays in `members` only so a legacy project resuming on it still lights this step.
  { key: "space", target: "details", members: ["space", "details"] },
  { key: "variants", target: "variants", members: ["variants"] },
  { key: "configure", target: "configure", members: ["configure"] },
  { key: "preview", target: "preview", members: ["preview"] }, // «Рендер»
  { key: "engineering", target: "engineering", members: ["engineering"] },
  { key: "cost", target: "cost", members: ["cost"] },
  { key: "handoff", target: "handoff", members: ["handoff"] },
];

export function Menu() {
  const t = useT();
  const open = useStore((s) => s.menuOpen);
  const screen = useStore((s) => s.screen);
  const closeMenu = useStore((s) => s.closeMenu);
  const goTo = useStore((s) => s.goTo);
  const openSettings = useStore((s) => s.openSettings);
  const openCatalog = useStore((s) => s.openCatalog);
  const showPricing = useStore((s) => s.settings.showPricing);

  if (!open) return null;

  // the Смета step is part of the journey only when the seller shows pricing
  const phases = showPricing ? PHASES : PHASES.filter((p) => p.key !== "cost");
  const cur = Math.max(0, phases.findIndex((p) => p.members.includes(screen)));
  const jump = (i: number) => {
    if (i > cur) return; // can't jump ahead of where you are
    goTo(phases[i].target);
    closeMenu();
  };
  const nav = (to: () => void) => {
    to();
    closeMenu();
  };
  const ITEMS: { label: string; icon: ReactNode; onClick: () => void }[] = [
    // «Мои проекты» used to sit here too — it now goes to the same place as «На главную»,
    // since Home holds the deal list. Two entries, one destination, is just a dead row.
    { label: t.menu.home, icon: <IconTabHome />, onClick: () => nav(() => goTo("home")) },
    // Каталог and Настройки open as POPUPS, not routes — the journey screens have no tab bar,
    // and jumping to either as a screen would unmount the design being edited. Same order as
    // the hub's <TabBar> so the two navigations agree.
    { label: t.menu.catalog, icon: <IconTabCatalog />, onClick: openCatalog },
    { label: t.menu.settings, icon: <IconTabSettings />, onClick: openSettings },
  ];

  return (
    <>
      <div className="menu-backdrop" onClick={closeMenu} />
      <aside className="menu-drawer">
        <div className="menu-head">
          {/* the wordmark is the way home — the same thing it does in most apps */}
          <button className="brand menu-brand" onClick={() => nav(() => goTo("home"))} type="button" aria-label={t.menu.home}>
            <Logo height={22} />
          </button>
          <button className="menu-x" onClick={closeMenu} aria-label={t.menu.close} type="button">
            ✕
          </button>
        </div>

        <div className="menu-sec-title">{t.menu.progress}</div>
        <div className="menu-steps">
          {phases.map((p, i) => {
            const state = i < cur ? "done" : i === cur ? "current" : "locked";
            return (
              <button key={p.target} className={`menu-step ${state}`} disabled={i > cur} onClick={() => jump(i)} type="button">
                <span className="menu-step-dot">{i < cur ? "✓" : i + 1}</span>
                <span className="menu-step-lbl">{t.menu.phases[p.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="menu-sec-title">{t.menu.menu}</div>
        <div className="menu-items">
          {ITEMS.map((it) => (
            <button key={it.label} className="menu-item" onClick={it.onClick} type="button">
              <span className="menu-item-ic">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>

        {/* Профиль sits apart at the foot of the drawer — it's the account, not another place in
            the app. It replaces the old «Войти» / «Выйти» pair: the Профиль screen carries the
            sign-out for a signed-in seller and embeds the whole sign-in form for a guest, so one
            entry serves both and the menu stops changing shape depending on who's looking. */}
        <div className="menu-foot">
          <button className="menu-item" onClick={() => nav(() => goTo("user"))} type="button">
            <span className="menu-item-ic"><IconTabUser /></span>
            {t.menu.profile}
          </button>
        </div>
      </aside>
    </>
  );
}
