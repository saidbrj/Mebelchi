// Bottom tab bar for the app "hub" screens (Home / Catalog / Settings / User). Replaces the
// floating hamburger on those screens. Features a prominent center green button for "+ Новый".
// «Проекты» used to hold slot 2 — Home is the deal list now, and Каталог took the slot.
import { useStore } from "../store";
import { useT } from "../i18n/useT";
import { IconTabHome, IconTabCatalog, IconTabSettings, IconTabUser, IconTabPlus } from "./icons";

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

      {/* 2. Catalog — the shop's own materials / hardware / saved cabinets */}
      <button
        className={`tab-item${screen === "catalog" ? " on" : ""}`}
        onClick={() => goTo("catalog")}
        type="button"
        aria-current={screen === "catalog" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabCatalog /></span>
        <span className="tab-lbl">{t.tabs.catalog}</span>
      </button>

      {/* 3. Center CTA: Green Circle "+ Новый" — dead centre of five slots */}
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

      {/* 3. Settings */}
      <button
        className={`tab-item${screen === "settings" ? " on" : ""}`}
        onClick={() => goTo("settings")}
        type="button"
        aria-current={screen === "settings" ? "page" : undefined}
      >
        <span className="tab-ico"><IconTabSettings /></span>
        <span className="tab-lbl">{t.tabs.settings}</span>
      </button>

      {/* 4. User / Profile */}
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

