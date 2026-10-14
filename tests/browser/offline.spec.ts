import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const uid = "offline-alice";
const threadId = "b22f6858-e52a-4b33-91c7-8f0caf878682";
const secondThreadId = "cdf4cfed-8a0a-473b-a5e3-f109f311e510";
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

async function mockServices(context: BrowserContext, isOffline: () => boolean, failFirstSummary = false, missingWeather = false) {
  const attempted = new Set<string>();
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
    if ((failFirstSummary && ["weather-stations/snapshot", "et-lat/serie-et"].includes(path) && !attempted.has(path)) || (missingWeather && path === "weather-stations/snapshot")) {
      attempted.add(path);
      return route.abort("failed");
    }
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
    let data: unknown;
    if (path === "weather-stations/snapshot") data = { generatedAt: "2026-10-09", stations: [{ id: "station-1", name: "Estación guardada", lat: -27.3, lng: -70.5, lastUpdate: "2026-10-09T12:00:00Z", temperatureValue: 23, measurements: [{ measurementName: "Air Temperature", portNumber: 1, recordedAt: "2026-10-09T12:00:00Z", sensorName: "ATMOS 41", unit: "°C", value: 23 }] }] };
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

    else if (["et-lat/history", "modis-snow/history"].includes(path)) {
      const params = new URL(route.request().url()).searchParams;
      const snow = path.startsWith("modis-snow");
      const monthly = params.get("start_date") === "2021-01-01";
      const values = snow ? { coverage: 42 } : { etr: 1.2, etmax: 2.4 };
      data = { series_id: snow ? `snow_${params.get("area")}` : "et_all", start_date: params.get("start_date"), end_date: params.get("end_date"),
        available_from: "2021-01-01", available_to: "2026-10-09", generated_at: "2026-10-09T12:00:00Z", version: "history-test-v1", resolution: monthly ? "monthly" : "native",
        points: (monthly ? ["2021-01-01", "2021-02-01", "2021-03-01"] : ["2026-10-01", "2026-10-09"]).map((fecha) => ({ fecha, values, minimum: values, maximum: values, count: snow ? { coverage: 20 } : { etr: 20, etmax: 20 } })) };
    }
    else if (path === "modis-snow/coverage-series") data = Object.fromEntries(["ae", "jorquera", "pulido", "manflas"].map((basin) => [basin, [{ fecha: "2026-10-09", esteano: 12, anopar: 10 }]]));
    else if (path === "modis-snow/basins-geojson") data = map(1, { name: "ae" });
    else if (path === "modis-snow/latest-image") {
      return route.fulfill({ contentType: "image/png", headers: { "X-Image-Date": "2026-10-09", "X-Image-CRS": "EPSG:4326", "X-Image-Bounds": '{"south":-28,"north":-27,"west":-71,"east":-69}' }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWoUAAAAASUVORK5CYII=", "base64") });
    } else if (path === "forum/threads") data = { items: pageNumber === 1 ? [thread] : [{ ...thread, id: secondThreadId, title: "Otro tema guardado" }], page: pageNumber, page_size: 20, total: 21 };
    else if (path === `forum/threads/${secondThreadId}`) data = { ...thread, id: secondThreadId, title: "Otro tema guardado" };
    else if (path === `forum/threads/${secondThreadId}/posts`) data = { items: [], page: 1, page_size: 20, total: 0 };
    else if (path === `forum/threads/${threadId}`) data = thread;
    else if (path === `forum/threads/${threadId}/posts`) data = { items: [{ id: `post-${pageNumber}`, thread_id: threadId, author_name: "Alice", body: pageNumber === 1 ? "Medición guardada del terreno" : "Respuesta guardada de la segunda página", is_initial: pageNumber === 1, created_at: "2026-10-09T12:00:00Z", updated_at: null, deleted_at: null, quote: null, likes: 0, dislikes: 0, my_reaction: null, can_edit: false, can_delete: false }], page: pageNumber, page_size: 20, total: 21 };
    else throw new Error(`Unexpected request: ${path}`);
    return route.fulfill({ json: data });
  });
}

async function signIn(page: Page, waitForReady = true) {
  await page.goto("./");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await page.getByLabel("Correo electrónico").fill("alice@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("offline-test-password");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  if (waitForReady) await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible({ timeout: 30_000 });
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
  await expect(page.locator(".overview-card").first().locator(".recharts-line-curve")).toHaveCount(2);
  await expect(page.locator(".overview-card").last()).toContainText("23,0 °C");
  await page.getByRole("button", { name: "Clima", exact: true }).click();
  await expect(page.getByText("Estación guardada").first()).toBeVisible();
  await page.getByRole("button", { name: "Pozos", exact: true }).click();
  await expect(page.getByText("Pozo guardado").first()).toBeVisible();
  await expect(page.locator(".leaflet-regional-basemap-pane canvas")).toBeVisible();
  await expect.poll(() => page.locator(".leaflet-regional-basemap-pane canvas").evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted++;
    return painted;
  })).toBeGreaterThan(1000);
  await expect(page.getByText("Copiapó", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/offline-wells.png", fullPage: true, animations: "disabled" });
  await expect(page.getByRole("tab", { name: "Agregar medición" })).toHaveCount(0);
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  await expect(page.getByText("1,4 mm/día", { exact: true })).toBeVisible();
  await expect(page.getByText("Mapa regional · Calles, ríos y localidades · Satélite requiere internet")).toBeVisible();
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
  await expect(page.getByText("Medición guardada del terreno", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).first().click();
  await expect(page.getByText("Respuesta guardada de la segunda página", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/offline-forum.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Volver a los temas" }).click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).first().click();
  await page.getByRole("button", { name: "Otro tema guardado" }).click();
  await expect(page.getByRole("heading", { name: "Otro tema guardado" })).toBeVisible();
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await expect(page.getByText("Video no disponible sin conexión", { exact: true })).toHaveCount(3);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.screenshot({ path: "test-results/offline-videos.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Foro", exact: true }).click();
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


test("initial summary failures recover on the home page during preparation", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline, true);
  let release!: () => void;
  const slowMap = new Promise<void>((resolve) => { release = resolve; });
  await context.route("**/api/v1/et-lat/mapa-cult", async (route) => { await slowMap; await route.fallback(); });
  await signIn(page, false);
  await expect(page.locator(".overview-card").first().locator(".recharts-line-curve")).toHaveCount(2);
  await expect(page.locator(".overview-card").last()).toContainText("23,0 °C");
  await expect(page.locator(".overview-card").last()).toContainText("guardada");
  await expect(page.getByLabel("Disponibilidad sin conexión")).toContainText("Preparando datos sin conexión");
  await page.screenshot({ path: "test-results/summary-during-preparation.png", fullPage: true, animations: "disabled" });
  release();
  await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  offline = true;
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "Clima", exact: true }).click();
  await expect(page.getByText("Estación guardada").first()).toBeVisible();
  await expect(page.getByText("Presión Sin datos hPa")).toBeVisible();
});

test("missing climate data is reported as a partial copy", async ({ page, context }) => {
  await mockServices(context, () => false, false, true);
  await signIn(page, false);
  await expect(page.getByLabel("Disponibilidad sin conexión")).toContainText("Falta guardar: Clima", { timeout: 30_000 });
  await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Disponibilidad sin conexión")).toContainText("Copia parcial");
});

test("summary loading states do not display demo dates or stale-data warnings", async ({ page, context }) => {
  await mockServices(context, () => false);
  let release!: () => void;
  const pendingData = new Promise<void>((resolve) => { release = resolve; });
  await context.route("**/api/v1/**", async (route) => {
    await pendingData;
    await route.fallback();
  });
  await signIn(page, false);
  const cards = page.locator(".overview-card");
  try {
    await expect(cards).toHaveCount(4);
    await expect(cards.locator(".status-pill.is-neutral")).toHaveText(Array(4).fill("Cargando…"));
    await expect(cards.locator("small")).toHaveText(Array(4).fill("Consultando fecha de actualización…"));
    await expect(page.getByLabel("Disponibilidad sin conexión")).toContainText("Preparando datos sin conexión");
    await expect(page.getByLabel("Disponibilidad sin conexión")).not.toContainText("Copia parcial");
    await page.screenshot({ path: "test-results/summary-loading.png", fullPage: true, animations: "disabled" });
  } finally {
    release();
  }
  await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible();
  await expect(cards.locator("small")).toHaveText(Array(4).fill(/Última actualización:.*2026/));
  await expect(cards.last()).toContainText("23,0 °C promedio de 1 estación");
  await expect(cards.last()).toContainText("1 estación monitoreada");
});

test("empty sector datasets are explained after preparation, online and offline", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline);
  await context.route("**/api/v1/et-lat/mapa-sectores", (route) => route.fulfill({
    json: {
      type: "FeatureCollection",
      features: [
        ...map(19, { sector_id: 19, nombre: "Sector guardado" }).features,
        ...map(2, { sector_id: 2, nombre: "Sector sin mediciones" }).features,
      ],
    },
  }));
  await context.route(/\/api\/v1\/et-lat\/(serie-et|et-cult)\?sector_id=2$/, (route) => route.fulfill({ json: [] }));
  await context.route("**/api/v1/et-lat/history?**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("sector_id") !== "2") return route.fallback();
    return route.fulfill({ json: { series_id: "et_sector_2", start_date: params.get("start_date"), end_date: params.get("end_date"),
      available_from: null, available_to: null, generated_at: "2026-10-09", version: "empty", resolution: "native", points: [] } });
  });
  await signIn(page);
  offline = true;
  await context.setOffline(true);
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  await page.locator(".etr-map path.leaflet-interactive").nth(1).dispatchEvent("click");
  const emptyCharts = page.getByText("No hay mediciones para esta selección", { exact: true });
  await expect(emptyCharts).toHaveCount(1);
  await expect(page.getByText("Sin mediciones en este período", { exact: true })).toBeVisible();
  await expect(page.locator(".data-state.is-error")).toHaveCount(0);
  await page.screenshot({ path: "test-results/empty-sector-offline.png", fullPage: true, animations: "disabled" });
  offline = false;
  await context.setOffline(false);
  await expect(page.getByText("Sin conexión · Solo lectura", { exact: true })).toHaveCount(0);
  await expect(emptyCharts).toHaveCount(1);
  await expect(page.getByText("Sin mediciones en este período", { exact: true })).toBeVisible();
});


test("ET and snow history support presets, custom periods, zoom and saved ranges", async ({ page, context }) => {
  let offline = false;
  await mockServices(context, () => offline);
  const errors: string[] = [];
  const requests: URL[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/history?")) requests.push(new URL(request.url()));
  });
  await signIn(page);
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  const chart = page.locator(".historical-series").first();
  await expect(chart.locator('[data-resolution="native"]')).toBeVisible();
  await chart.getByRole("button", { name: "Todo (desde 2021)", exact: true }).click();
  await expect(chart.locator('[data-resolution="monthly"]')).toBeVisible();
  expect(requests.at(-1)?.searchParams.get("start_date")).toBe("2021-01-01");
  await page.screenshot({ path: "test-results/history-et-all.png", fullPage: true, animations: "disabled" });
  const traveller = chart.locator(".recharts-brush-traveller").first();
  await traveller.scrollIntoViewIfNeeded();
  const box = await traveller.boundingBox();
  const lastBox = await chart.locator(".recharts-brush-traveller").last().boundingBox();
  if (!box || !lastBox) throw new Error("Missing zoom control");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move((box.x + lastBox.x) / 2 + box.width, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(chart.getByRole("button", { name: "Aplicar zoom seleccionado" })).toBeEnabled();
  await chart.getByRole("button", { name: "Aplicar zoom seleccionado" }).click();
  await expect(chart.locator('[data-resolution="native"]')).toBeVisible();
  await chart.getByLabel("Desde", { exact: true }).fill("2022-01-01");
  await chart.getByLabel("Hasta", { exact: true }).fill("2022-12-31");
  await chart.getByRole("button", { name: "Aplicar período" }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get("end_date")).toBe("2022-12-31");
  await expect(chart.locator('[data-resolution="native"]')).toBeVisible();
  await page.getByRole("button", { name: "Nieve", exact: true }).click();
  await expect(page.locator('.historical-series [data-resolution="native"]')).toHaveCount(4);
  await page.locator(".historical-series").first().getByRole("button", { name: "Todo (desde 2021)", exact: true }).click();
  await expect(page.locator('.historical-series [data-resolution="monthly"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/history-snow.png", fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/history-mobile.png", fullPage: true, animations: "disabled" });
  const chartWidths = await page.locator(".historical-series").evaluateAll((elements) => elements.map((element) => ({ width: element.clientWidth, scroll: element.scrollWidth })));
  expect(chartWidths.every(({ width, scroll }) => scroll <= width + 1)).toBe(true);
  offline = true;
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.locator(".historical-series").first().getByRole("button", { name: "1 año", exact: true }).click();
  await expect(page.locator('.historical-series [data-resolution="native"]')).toHaveCount(4);
  await page.locator(".historical-series").first().getByRole("button", { name: "2 años", exact: true }).click();
  await expect(page.getByText("Período no guardado", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved history presets survive a next-day offline reload and refresh on reconnect", async ({ page, context }) => {
  const savedDay = new Date();
  const nextDay = new Date(savedDay.getTime() + 24 * 60 * 60 * 1000);
  const savedEnd = savedDay.toISOString().slice(0, 10);
  const nextEnd = nextDay.toISOString().slice(0, 10);
  let offline = false;
  await mockServices(context, () => offline);
  await page.clock.setFixedTime(savedDay);
  await signIn(page);
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  const chart = page.locator(".historical-series").first();
  await chart.getByRole("button", { name: "Todo (desde 2021)", exact: true }).click();
  await expect(chart.locator('[data-resolution="monthly"]')).toBeVisible();
  offline = true;
  await context.setOffline(true);
  await page.clock.setFixedTime(nextDay);
  await page.reload();
  await expect(page.getByText("Sin conexión · Solo lectura", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Evapotranspiración", exact: true }).click();
  await expect(chart.locator('[data-resolution="native"]')).toBeVisible();
  await expect(chart.getByLabel("Hasta", { exact: true })).toHaveValue(savedEnd);
  await expect(chart.getByText(/Mostrando el período guardado/)).toBeVisible();
  await expect(page.getByLabel("Disponibilidad sin conexión")).toContainText("Copia principal completa.");
  await chart.getByRole("button", { name: "Todo (desde 2021)", exact: true }).click();
  await expect(chart.locator('[data-resolution="monthly"]')).toBeVisible();
  await expect(chart.getByLabel("Hasta", { exact: true })).toHaveValue(savedEnd);
  await chart.getByRole("button", { name: "2 años", exact: true }).click();
  await expect(chart.getByText("Período no guardado", { exact: true })).toBeVisible();
  // An explicit custom range must never silently substitute different dates.
  await chart.getByLabel("Desde", { exact: true }).fill("2021-01-01");
  await chart.getByLabel("Hasta", { exact: true }).fill(nextEnd);
  await chart.getByRole("button", { name: "Aplicar período" }).click();
  await expect(chart.getByText("Período no guardado", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Por parcela", exact: true }).click();
  await expect(chart.locator('[data-resolution="native"]')).toBeVisible();
  await expect(chart.getByLabel("Hasta", { exact: true })).toHaveValue(savedEnd);
  await page.getByRole("button", { name: "Nieve", exact: true }).click();
  await expect(page.locator('.historical-series [data-resolution="native"]')).toHaveCount(4);
  await expect(page.locator('.historical-series input[type="date"]').nth(1)).toHaveValue(savedEnd);
  // Reconnection must also work when the first query runs before Firebase
  // restores the expired credential, rather than relying on request timing.
  let restoreCredential!: () => void;
  const pendingCredential = new Promise<void>((resolve) => { restoreCredential = resolve; });
  await context.route("https://securetoken.googleapis.com/**", async (route) => {
    await pendingCredential;
    await route.fallback();
  });
  const refreshRequest = page.waitForRequest("https://securetoken.googleapis.com/**");
  offline = false;
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  try {
    await refreshRequest;
    await expect(chart.getByText(/Mostrando el período guardado/)).toBeVisible();
    await expect(chart.getByLabel("Hasta", { exact: true })).toHaveValue(savedEnd);
  } finally {
    restoreCredential();
  }
  await expect(page.getByText("Datos principales disponibles sin conexión", { exact: true })).toBeVisible();
  await expect(chart.getByText(/Mostrando el período guardado/)).toHaveCount(0);
  await expect(chart.getByLabel("Hasta", { exact: true })).toHaveValue(nextEnd);
});
