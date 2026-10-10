import { registerSW } from "virtual:pwa-register";
import { updateOfflineState } from "./state";

export function registerOfflineShell() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  registerSW({
    immediate: true,
    onOfflineReady: () => updateOfflineState({ shellReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration?.active) updateOfflineState({ shellReady: true });
    },
    onRegisterError: () => updateOfflineState({ shellReady: false }),
  });
}
