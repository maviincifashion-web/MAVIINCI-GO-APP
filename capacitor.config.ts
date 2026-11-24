import type { CapacitorConfig } from "@capacitor/cli";

// The farm's phone bridge is plain HTTP on the office LAN (http://<studio PC>:7861), so the app page is served as
// http://localhost and cleartext traffic is allowed.
const config: CapacitorConfig = {
  appId: "in.maviinci.farm",
  appName: "MAVIINCI FARM",
  webDir: "dist",
  backgroundColor: "#0a0a0b",
  server: { androidScheme: "http", cleartext: true },
  android: { allowMixedContent: true },
};

export default config;
