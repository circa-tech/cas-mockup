import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "4173";
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `${origin}/cas-mockup/`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${origin}/cas-mockup/`,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: origin,
      VITE_FIREBASE_PROJECT_ID: "offline-test",
      VITE_FIREBASE_API_KEY: "offline-test-key",
      VITE_FIREBASE_AUTH_DOMAIN: "offline-test.firebaseapp.com",
      VITE_FIREBASE_APP_ID: "offline-test-app",
      VITE_FIREBASE_STORAGE_BUCKET: "offline-test.appspot.com",
    },
  },
});
