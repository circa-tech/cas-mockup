import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/cas-mockup/",
  plugins: [react(), VitePWA({
    registerType: "prompt",
    injectRegister: false,
    manifest: false,
    scope: "/cas-mockup/",
    includeAssets: ["mock/*.jpg"],
    workbox: {
      globPatterns: ["**/*.{js,css,html,woff2}"],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: "/cas-mockup/index.html",
      navigateFallbackAllowlist: [/^\/cas-mockup\//],
      cleanupOutdatedCaches: true,
      // Only the public app shell is cached here. Authenticated responses are
      // isolated by identity in IndexedDB; third-party tiles are never prefetched.
      runtimeCaching: [],
    },
  })],
});
