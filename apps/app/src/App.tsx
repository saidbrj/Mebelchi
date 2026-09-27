import { useEffect } from "react";
import { useStore } from "./store";
import { useT } from "./i18n/useT";
import { JourneyBar } from "./components/JourneyBar";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";
import { Menu } from "./components/Menu";
import { RoomScene } from "./screens/RoomScene";
import { VariantsScreen } from "./screens/VariantsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { CatalogScreen } from "./screens/CatalogScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { UserScreen } from "./screens/UserScreen";
import { TabBar } from "./components/TabBar";
import { ConfigScreen } from "./screens/ConfigScreen";
import { RenderScreen } from "./screens/RenderScreen";
import { EngineeringScreen } from "./screens/EngineeringScreen";
import { CostScreen } from "./screens/CostScreen";
import { HandoffScreen } from "./screens/HandoffScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { SetPasswordScreen } from "./screens/SetPasswordScreen";
import { SyncIndicator } from "./components/SyncIndicator";
import { LoginNudge } from "./components/LoginNudge";
import { SettingsModal } from "./components/SettingsModal";
import { CatalogModal } from "./components/CatalogModal";
import { isSupabaseConfigured } from "./lib/supabase";
import { App2Screen } from "./app2/App2Screen";

export default function App() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const authReady = useStore((s) => s.authReady);
  const recovery = useStore((s) => s.recovery);
  const next = useStore((s) => s.next);
  const goTo = useStore((s) => s.goTo);
  const showPricing = useStore((s) => s.settings.showPricing);

  useEffect(() => {
    if (window.location.search.includes("app2") || window.location.hash.includes("app2")) {
      goTo("app2");
    }
  }, [goTo]);

  // What the shared bar carries on the right, per document screen:
  //   Инженерия — its forward CTA, moved up out of the footer (the screen has no footer at all now)
  //   Передача  — a way HOME. It's the end of the journey, and until now finishing a kitchen left
  //               you on the last step with only the hamburger to get out. Secondary styling: the
  //               export in the footer is still the primary action here.
  const barRight =
    screen === "engineering" ? (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          className="step-next"
          onClick={() => goTo("handoff")}
          type="button"
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#ffffff",
            border: "none",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
            cursor: "pointer",
          }}
          title="Заказ на распил: Eman XLSX и Карта раскроя PDF"
        >
          <span>⚡</span>
          <span>Распил</span>
        </button>
        <button className="step-next" onClick={next} type="button">
          {showPricing ? t.footer.toCostShort : t.footer.toHandoffShort}
        </button>
      </div>
    ) : screen === "handoff" ? (
      <button className="step-next step-home" onClick={() => goTo("home")} type="button">
        {t.menu.home}
      </button>
    ) : null;

  // GUEST-FIRST: no login wall. While Supabase checks for an existing session, show a brief
  // splash; a password-recovery link still forces the "set a new password" screen. Otherwise
  // the app runs for guests (localStorage) — sign in from the menu / the nudge to sync.
  if (isSupabaseConfigured) {
    if (!authReady) {
      return (
        <div className="app">
          <main className="body">
            <div className="auth-splash">Загрузка…</div>
          </main>
        </div>
      );
    }
    if (recovery) {
      return (
        <div className="app">
          <main className="body">
            <SetPasswordScreen />
          </main>
        </div>
      );
    }
  }

  if (screen === "app2") {
    return (
      <App2Screen
        onBack={() => {
          useStore.getState().exitApp2(false);
          if (window.location.search.includes("app2") || window.location.hash.includes("app2")) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }}
      />
    );
  }

  // login / registration — reachable from the menu (or the soft nudge), not forced
  if (screen === "auth") {
    return (
      <div className="app">
        <main className="body">
          <AuthScreen />
        </main>
        <Toast />
      </div>
    );
  }

  // the room scene + constructor carry their own chrome (step/price bar + toolbar),
  // no standard footer
  if (screen === "details" || screen === "configure" || screen === "preview") {
    return (
      <div className="app">
        {/* all three (room editor / constructor / render) now carry the menu button INSIDE their own
            top bar, in order — so no floating one here */}
        {screen === "details" ? <RoomScene /> : screen === "configure" ? <ConfigScreen /> : <RenderScreen />}
        <SyncIndicator />
        <Toast />
        <Menu />
        <SettingsModal />
        <CatalogModal />
        <LoginNudge />
      </div>
    );
  }

  // the app HUB — home / catalog / settings / user — a bottom TAB BAR (no hamburger, no
  // settings popup; settings is a full screen here). The hamburger + settings popup stay on
  // the journey screens below. Home absorbed the old «Проекты» screen — it is the deal list.
  if (screen === "home" || screen === "catalog" || screen === "settings" || screen === "user") {
    return (
      <div className="app">
        <main className="body body-tabbed">
          {screen === "home" ? <HomeScreen /> : screen === "catalog" ? <CatalogScreen /> : screen === "settings" ? <SettingsScreen /> : <UserScreen />}
        </main>
        <TabBar />
        <SyncIndicator />
        <Toast />
        <LoginNudge />
      </div>
    );
  }

  return (
    <div className="app">
      {/* The SAME bar the canvas screens carry — these three used to have none at all, just a
          floating hamburger over the content. Variants renders its own (its trailing slot holds
          the options gear, which is its local state). */}
      {screen !== "variants" && <JourneyBar right={barRight} />}
      <main className="body">
        {/* No "quiz" or "space" route any more — the journey starts on the ROOM EDITOR (which carries
            the shape choice inline), and the layout questions live in a sheet on the Variants screen,
            next to the kitchens they change. */}
        {screen === "variants" ? (
          <VariantsScreen />
        ) : screen === "engineering" ? (
          <EngineeringScreen />
        ) : screen === "cost" ? (
          <CostScreen />
        ) : screen === "handoff" ? (
          <HandoffScreen />
        ) : null}
      </main>
      {/* Раскладка and Инженерия carry their CTA in the bar, so they render no footer */}
      {screen !== "engineering" && screen !== "variants" && <Footer />}
      <Toast />
      <Menu />
      <SettingsModal />
      <CatalogModal />
    </div>
  );
}
