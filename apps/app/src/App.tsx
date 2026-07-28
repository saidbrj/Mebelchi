import { useStore } from "./store";
import { MenuButton } from "./components/MenuButton";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";
import { Menu } from "./components/Menu";
import { RoomScene } from "./screens/RoomScene";
import { VariantsScreen } from "./screens/VariantsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
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
import { isSupabaseConfigured } from "./lib/supabase";

export default function App() {
  const screen = useStore((s) => s.screen);
  const authReady = useStore((s) => s.authReady);
  const recovery = useStore((s) => s.recovery);

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
        <LoginNudge />
      </div>
    );
  }

  // the app HUB — home / projects / settings / user — a bottom TAB BAR (no hamburger, no
  // settings popup; settings is a full screen here). The hamburger + settings popup stay on
  // the journey screens below.
  if (screen === "home" || screen === "projects" || screen === "settings" || screen === "user") {
    return (
      <div className="app">
        <main className="body body-tabbed">
          {screen === "home" ? <HomeScreen /> : screen === "projects" ? <ProjectsScreen /> : screen === "settings" ? <SettingsScreen /> : <UserScreen />}
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
      {/* Variants carries its own in-bar menu button; engineering/cost/handoff use the floating one */}
      {screen !== "variants" && <MenuButton />}
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
      <Footer />
      <Toast />
      <Menu />
      <SettingsModal />
    </div>
  );
}
