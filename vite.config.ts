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
    includeAssets: ["mock/*.jpg", "offline/*.geojson", "offline/*.txt"],
    workbox: {
      globPatterns: ["**/*.{js,css,html,woff2}"],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      navigateFallback: "/cas-mockup/index.html",
      navigateFallbackAllowlist: [/^\/cas-mockup\//],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      // Public assets include the bundled OSM regional basemap. Authenticated
      // responses stay in IndexedDB; external tile services are not prefetched.
      runtimeCaching: [],
    },
  })],
});
