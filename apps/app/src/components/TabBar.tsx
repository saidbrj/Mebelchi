// Bottom tab bar for the app "hub" screens (Home / Projects / Settings / User). Replaces
// the floating hamburger on those screens (the hamburger stays on the journey screens).
// The active tab tints accent (icons use currentColor). Navigates via store.goTo.
import { useStore, type Screen } from "../store";
import { useT } from "../i18n/useT";
import { IconTabHome, IconTabProjects, IconTabSettings, IconTabUser } from "./icons";

const TABS: { screen: Screen; Icon: () => JSX.Element; key: "home" | "projects" | "settings" | "user" }[] = [
  { screen: "home", Icon: IconTabHome, key: "home" },
  { screen: "projects", Icon: IconTabProjects, key: "projects" },
  { screen: "settings", Icon: IconTabSettings, key: "settings" },
  { screen: "user", Icon: IconTabUser, key: "user" },
];

export function TabBar() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const goTo = useStore((s) => s.goTo);

  return (
    <nav className="tabbar" aria-label={t.menu.menu}>
      {TABS.map(({ screen: s, Icon, key }) => (
        <button
          key={s}
          className={`tab-item${screen === s ? " on" : ""}`}
          onClick={() => goTo(s)}
          type="button"
          aria-current={screen === s ? "page" : undefined}
        >
          <span className="tab-ico"><Icon /></span>
          <span className="tab-lbl">{t.tabs[key]}</span>
        </button>
      ))}
    </nav>
  );
}
