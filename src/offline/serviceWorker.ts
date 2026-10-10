import { registerSW } from "virtual:pwa-register";
import { getOfflineState, updateOfflineState } from "./state";

let activateUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
export const updateOfflineShell = () => activateUpdate?.(true);

export function registerOfflineShell() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const controlled = () => updateOfflineState({ shellReady: Boolean(navigator.serviceWorker.controller) && !getOfflineState().shellUpdateAvailable });
  navigator.serviceWorker.addEventListener("controllerchange", controlled);
  activateUpdate = registerSW({
    immediate: true,
    onOfflineReady: controlled,
    onRegisteredSW: controlled,
    onNeedRefresh: () => updateOfflineState({ shellReady: false, shellUpdateAvailable: true }),
    onRegisterError: () => updateOfflineState({ shellReady: false }),
  });
}
