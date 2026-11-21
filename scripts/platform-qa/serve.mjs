import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = 4948;
const root = resolve("dist");
const uid = "offline-alice";
const now = Math.floor(Date.now() / 1000);
const token = [
  { alg: "none", typ: "JWT" },
  { sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    role: "cas_user", firebase: { sign_in_provider: "password" } },
].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature";

const date = "2026-10-09";
const station = {
  wellId: "well-1", name: "Pozo de prueba", lat: -27.3, lng: -70.5,
  groundwaterMeasurement: { measurementDate: date, measurementTime: "12:00:00", waterTableDepth: 22, source: "api" },
};
const readings = Array.from({ length: 6 }, (_, index) => {
  const day = index + 1;
  const measured = `2026-10-0${day}`;
  return {
    measurement_id: String(day), measurement_date: measured, measured_at: `${measured}T15:00:00Z`,
    source: "api", water_level_condition: "dynamic",
    values: { water_table_depth: [1, 4, 6].includes(day) ? day * 10 : null, flow_rate: day === 2 ? 0 : day },
  };
});
const api = new Map([
  ["/api/v1/wells/admin/me", { canViewWells: true, canAddMeasurements: false, canCreateWells: false }],
  ["/api/v1/wells/groundwater-measurements", [station]],
  ["/api/v1/wells/groundwater-measurements/history",
    { well_id: "well-1", resolution: "daily", points: readings }],
  ["/api/v1/weather-stations/snapshot", { generatedAt: date, stations: [] }],
  ["/api/v1/forum/threads", { items: [], page: 1, page_size: 20, total: 0 }],
  ["/api/v1/et-lat/std-ae", { fecha: date, etr: 1.4, etmax: 2.6 }],
  ["/api/v1/modis-snow/coverage-series", {}],
  ["/api/v1/et-lat/data-cuad", { anos: [2026], meses: [10], dias: [9] }],
]);

// Install the isolated fake authentication transport before Firebase initializes.
const bootstrap = `<script>
(() => {
  const token = ${JSON.stringify(token)};
  const uid = ${JSON.stringify(uid)};
  const user = { localId: uid, email: "alice@example.test", displayName: "Alice QA", emailVerified: true,
    providerUserInfo: [{ providerId: "password", email: "alice@example.test", federatedId: "alice@example.test" }] };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.hostname === "identitytoolkit.googleapis.com") {
      return Promise.resolve(Response.json(url.pathname.includes("accounts:lookup") ? {users: [user]} :
        {...user, idToken: token, refreshToken: "test-refresh", expiresIn: "3600", registered: true}));
    }
    if (url.hostname === "securetoken.googleapis.com") {
      return Promise.resolve(Response.json({ access_token: token, id_token: token, refresh_token: "test-refresh",
        expires_in: "3600", user_id: uid, token_type: "Bearer", project_id: "offline-test" }));
    }
    return nativeFetch(input, options);
  };
  const createUrl = URL.createObjectURL.bind(URL);
  const click = HTMLAnchorElement.prototype.click;
  const workbookBlobs = new Map();
  URL.createObjectURL = (blob) => {
    const url = createUrl(blob);
    if (blob.type.includes("spreadsheetml")) workbookBlobs.set(url, blob);
    return url;
  };
  HTMLAnchorElement.prototype.click = function () {
    const workbook = workbookBlobs.get(this.href);
    if (workbook && this.download) {
      const reader = new FileReader();
      const filename = this.download;
      reader.onload = () => { window.platformExport = { filename, data: reader.result.split(",")[1] }; };
      reader.readAsDataURL(workbook);
      workbookBlobs.delete(this.href);
    }
    return click.call(this);
  };
})();
</script>`;

const types = {
  ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff": "font/woff", ".woff2": "font/woff2", ".json": "application/json",
  ".geojson": "application/geo+json",
};
createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  if (pathname.startsWith("/api/v1/")) {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(api.get(pathname) ?? []));
    return;
  }
  const path = pathname === "/cas-mockup/" ? "index.html" : pathname.replace(/^\/cas-mockup\//, "");
  const file = resolve(root, path);
  if (!file.startsWith(root + sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "Content-Security-Policy": "connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'" });
    response.end(path === "index.html" ? bytes.toString().replace("</head>", bootstrap + "</head>") : bytes);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, host, () => console.log(`Fixture running at http://${host}:${port}/cas-mockup/`));
