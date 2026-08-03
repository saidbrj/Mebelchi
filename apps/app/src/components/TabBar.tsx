// Bottom tab bar for the app "hub" screens (Home / Projects / Settings / User). Replaces
// the floating hamburger on those screens. Features a prominent center green button for "+ Новый" project.
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { IconTabHome, IconTabProjects, IconTabSettings, IconTabUser, IconTabPlus } from "./icons";

export function TabBar() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const goTo = useStore((s) => s.goTo);
  const newProject = useStore((s) => s.newProject);

  return (
    <nav className="tabbar" aria-label={t.menu.menu}>
      {/* 1. Home */}
      <button
        className={`tab-item${screen === "home" ? " on" : ""}`}
        onClick={() => goTo("home")}
        type="button"
        aria-current={screen === "home" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabHome /></span>
        <span className="tab-lbl">{t.tabs.home}</span>
      </button>

      {/* 2. Projects */}
      <button
        className={`tab-item${screen === "projects" ? " on" : ""}`}
        onClick={() => goTo("projects")}
        type="button"
        aria-current={screen === "projects" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabProjects /></span>
        <span className="tab-lbl">{t.tabs.projects}</span>
      </button>

      {/* 3. Center CTA: Green Circle "+ Новый" */}
      <button
        className="tab-item tab-item-new"
        onClick={newProject}
        type="button"
        aria-label={t.tabs.new}
      >
        <span className="tab-ico tab-ico-new">
          <IconTabPlus />
        </span>
        <span className="tab-lbl tab-lbl-new">{t.tabs.new}</span>
      </button>

      {/* 4. Settings */}
      <button
        className={`tab-item${screen === "settings" ? " on" : ""}`}
        onClick={() => goTo("settings")}
        type="button"
        aria-current={screen === "settings" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabSettings /></span>
        <span className="tab-lbl">{t.tabs.settings}</span>
      </button>

      {/* 5. User / Profile */}
      <button
        className={`tab-item${screen === "user" ? " on" : ""}`}
        onClick={() => goTo("user")}
        type="button"
        aria-current={screen === "user" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabUser /></span>
        <span className="tab-lbl">{t.tabs.user}</span>
      </button>
    </nav>
  );
}

