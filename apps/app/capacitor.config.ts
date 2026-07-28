import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor 7 (Node 20). Platforms are added with `npm run cap:add:ios` /
// `cap:add:android` (needs Xcode / Android SDK), then `npm run build && cap sync`.
const config: CapacitorConfig = {
  appId: "uz.jihozla.app",
  appName: "Jihozla",
  webDir: "dist",
};

export default config;
