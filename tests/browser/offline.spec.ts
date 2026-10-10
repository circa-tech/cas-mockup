import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const uid = "offline-alice";
const threadId = "b22f6858-e52a-4b33-91c7-8f0caf878682";
const token = () => {
  const now = Math.floor(Date.now() / 1000);
  return [
    { alg: "none", typ: "JWT" },
    { sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, role: "cas_user", permissions: ["et:download"], firebase: { sign_in_provider: "password" } },
  ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature";
};
const geometry = { type: "Polygon", coordinates: [[[-70.6, -27.4], [-70.4, -27.4], [-70.4, -27.2], [-70.6, -27.2], [-70.6, -27.4]]] };
const map = (id: number, properties: Record<string, unknown>) => ({ type: "FeatureCollection", features: [{ type: "Feature", id, properties, geometry }] });
const etSeries = [{ fecha: "2026-10-01", etr: 1.2, etmax: 2.4 }, { fecha: "2026-10-09", etr: 1.4, etmax: 2.6 }];
const thread = { id: threadId, title: "Datos de terreno", author_name: "Alice", created_at: "2026-10-09T10:00:00Z", last_activity_at: "2026-10-09T10:00:00Z", reply_count: 0, can_edit: true, can_delete: true };

async function mockServices(context: BrowserContext, isOffline: () => boolean) {
  await context.route("https://**/*", async (route) => {
    if (isOffline()) return route.abort("internetdisconnected");
    const url = route.request().url();
    if (url.includes("identitytoolkit.googleapis.com")) {
      if (url.includes("accounts:lookup")) {
        return route.fulfill({ json: { users: [{ localId: uid, email: "alice@example.test", displayName: "Alice Offline", emailVerified: true, providerUserInfo: [{ providerId: "password", email: "alice@example.test", federatedId: "alice@example.test" }] }] } });
      }
      return route.fulfill({ json: { localId: uid, email: "alice@example.test", displayName: "Alice Offline", idToken: token(), refreshToken: "test-refresh", expiresIn: "3600", registered: true } });
    }
    if (url.includes("securetoken.googleapis.com")) {
      return route.fulfill({ json: { access_token: token(), id_token: token(), refresh_token: "test-refresh", expires_in: "3600", user_id: uid, token_type: "Bearer", project_id: "offline-test" } });
    }
    // No test makes requests to real third-party map/video/font services.
    return route.abort();
  });
  await context.route("**/api/v1/**", async (route) => {
    if (isOffline()) return route.abort("internetdisconnected");
    const path = new URL(route.request().url()).pathname.replace("/api/v1/", "");
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers().authorization).toContain("Bearer ");
    let data: unknown;
    if (path === "weather-stations/snapshot") data = { generatedAt: "2026-10-09", stations: [{ id: "station-1", name: "Estación guardada", lat: -27.3, lng: -70.5, lastUpdate: "2026-10-09T12:00:00Z", humidityValue: 41, pressureValue: 1010, temperatureValue: 23, windValue: 5 }] };
    else if (path === "wells/groundwater-measurements") data = [{ wellId: "well-1", name: "Pozo guardado", lat: -27.3, lng: -70.5, groundwaterMeasurement: { measurementDate: "2026-10-09", measurementTime: "12:00:00", waterTableDepth: 22, flowRate: 3, source: "manual" } }];
    else if (path === "wells/admin/me") data = { canViewWells: true, canAddMeasurements: true, canManageCas: false, canCreateWells: true };
    else if (path.startsWith("wells/registry")) data = [];
    else if (path === "wells/writable") data = [];
    else if (path === "et-lat/std-ae") data = { fecha: "2026-10-09", etr: 1.4, etmax: 2.6 };
    else if (["et-lat/serie-et", "et-lat/et-poly"].includes(path)) data = etSeries;
    else if (path === "et-lat/et-cult") data = [{ cultivo: "Parronales", etr: 1.4, etmax: 2.6 }];
    else if (path === "et-lat/mapa-sectores") data = map(19, { sector_id: 19, nombre: "Sector guardado" });
    else if (path === "et-lat/mapa-cult") data = map(855, { uso_id: 855, cultivo: "Parronales", fecha: "2026-10-09", etr: 14, etmax: 26 });
    else if (path === "et-lat/mapa-cuadrantes") data = map(273, { id: 273 });
    else if (path === "et-lat/kc-poly") data = [{ fecha: "2026-10-09", kc: .6 }];
    else if (path === "et-lat/lai-poly") data = [{ fecha: "2026-10-09", lai: 2.1 }];
    else if (path === "et-lat/data-cuad") data = { anos: [2026], meses: [10], dias: [9] };
    else if (path === "modis-snow/coverage-series") data = Object.fromEntries(["ae", "jorquera", "pulido", "manflas"].map((basin) => [basin, [{ fecha: "2026-10-09", esteano: 12, anopar: 10 }]]));
    else if (path === "modis-snow/basins-geojson") data = map(1, { name: "ae" });
    else if (path === "modis-snow/latest-image") {
      return route.fulfill({ contentType: "image/png", headers: { "X-Image-Date": "2026-10-09", "X-Image-CRS": "EPSG:4326", "X-Image-Bounds": '{"south":-28,"north":-27,"west":-71,"east":-69}' }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWoUAAAAASUVORK5CYII=", "base64") });
    } else if (path === "forum/threads") data = { items: [thread], page: 1, page_size: 20, total: 1 };
    else if (path === `forum/threads/${threadId}`) data = thread;
    else if (path === `forum/threads/${threadId}/posts`) data = { items: [], page: 1, page_size: 20, total: 0 };
    else throw new Error(`Unexpected request: ${path}`);
    return route.fulfill({ json: data });
  });
}

async function signIn(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.getByLabel("Correo electrónico").fill("alice@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("offline-test-password");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible({ timeout: 30_000 });
}

test("prepared data and lazy tab assets survive an offline reload with an expired token", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  // Expire Firebase's persisted token before restarting. No credentials are
  // inserted into the application's offline database.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("firebaseLocalStorageDb");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("firebaseLocalStorage", "readwrite");
      const store = tx.objectStore("firebaseLocalStorage");
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (cursor.value.value?.stsTokenManager) {
          const record = cursor.value;
          record.value.stsTokenManager.expirationTime = 0;
          cursor.update(record);
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Sin conexión · Solo lectura", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clima", exact: true }).click();
  await expect(page.getByText("Estación guardada").first()).toBeVisible();
  await page.getByRole("button", { name: "Pozos", exact: true }).click();
  await expect(page.getByText("Pozo guardado").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Agregar medición" })).toHaveCount(0);
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  await expect(page.getByText("1,4 mm/día", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin mapa base · Puedes explorar los datos guardados")).toBeVisible();
  await page.getByRole("tab", { name: "Por parcela", exact: true }).click();
  await expect(page.getByText("1.4 mm/día", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Descargar imágenes", exact: true }).click();
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
  await page.getByRole("button", { name: "Nieve", exact: true }).click();
  await expect(page.locator("img.leaflet-image-layer")).toBeVisible();
  await expect.poll(() => page.locator("img.leaflet-image-layer").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Foro", exact: true }).click();
  await expect(page.getByRole("button", { name: "Nuevo tema" })).toBeDisabled();
  await page.getByRole("button", { name: "Datos de terreno" }).click();
  await expect(page.getByText(/Estos datos aún no están disponibles sin conexión/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/offline-forum.png", fullPage: true });
  expect(errors).toEqual([]);
  offline = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("button", { name: "Publicar respuesta" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
  const savedCount = await page.evaluate(async () => {
    const names = await indexedDB.databases();
    const name = names.find((item) => item.name?.startsWith("cas-offline-v1:"))!.name!;
    return new Promise<number>((resolve) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        const count = request.result.transaction("responses").objectStore("responses").count();
        count.onsuccess = () => { resolve(count.result); request.result.close(); };
      };
    });
  });
  expect(savedCount).toBe(0);
});

test("a previously opened app without a saved login explains that offline access is unavailable", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline);
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Network emulation in some Chrome releases does not update navigator.onLine
  // after a service-worker navigation. Also exercise the OS offline signal.
  await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false }));
  offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Conéctate para iniciar sesión", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("offline logout propagates to another tab and removes saved data", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline);
  await signIn(page);
  const second = await context.newPage();
  await second.goto("./");
  await expect(second.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible();
  offline = true;
  await context.setOffline(true);
  for (const tab of [page, second]) {
    await tab.evaluate(() => window.dispatchEvent(new Event("offline")));
  }
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByText("Conéctate para iniciar sesión", { exact: true })).toBeVisible();
  await expect(second.getByText("Conéctate para iniciar sesión", { exact: true })).toBeVisible({ timeout: 15_000 });
});
