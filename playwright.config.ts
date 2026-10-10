import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173/cas-mockup/",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/cas-mockup/",
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: "http://127.0.0.1:4173",
      VITE_FIREBASE_PROJECT_ID: "offline-test",
      VITE_FIREBASE_API_KEY: "offline-test-key",
      VITE_FIREBASE_AUTH_DOMAIN: "offline-test.firebaseapp.com",
      VITE_FIREBASE_APP_ID: "offline-test-app",
      VITE_FIREBASE_STORAGE_BUCKET: "offline-test.appspot.com",
    },
  },
});
