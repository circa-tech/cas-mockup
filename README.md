# cas-mockup

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and set:

- `VITE_API_BASE_URL`: Cloud Run gateway URL
- `VITE_FIREBASE_*`: Firebase web app config for Google sign-in

If Firebase is not configured, the mockup keeps the local demo login and mock
station data.

## Offline browsing

After an online sign-in, the app prepares a read-only copy in the background.
The banner reports completion only after the responses have committed to
IndexedDB and the production service worker has cached the app shell. Users can
reopen the app offline with their existing Firebase identity, including when its
token needs refreshing. A first sign-in still requires a connection.

- Preparation covers weather, well monitoring and registry data, snow coverage,
  basin boundaries and image bytes, ET-LAT overview/maps, up to 24 supported
  sectors, the initial parcel, initial download date choices, and forum topics,
  their bodies and paginated replies where permitted. Forum preparation follows
  pagination up to 300 requests; an explicit partial-copy notice appears for
  larger archives. Other parcels and download selections are saved when visited.
  It does not download the entire ET historical archive.
- Summary requests run first. When a background download recovers a failed home
  query, the home chart/table refreshes without navigation or a reload. Partial
  copies name the missing sections; a saved timestamp alone never means all
  sections were downloaded. Climate stations retain available measurements even
  when other sensors are missing (shown as “Sin datos”, never invented zeros).
- All private responses are isolated by API environment, Firebase project, UID,
  role and permissions. Logout/account changes clear the saved copy. Firebase
  manages its own credentials; the application snapshot stores no tokens.
- Responses expire after seven days and the store is capped at 50 MiB, evicting
  older responses first. Browser eviction, private browsing, disabled storage,
  or quota failures can make preparation incomplete. Offline access cannot
  discover permission changes until an online session is revalidated.
- Mutations, administration and new image downloads require connectivity. No
  changes are queued for later submission. Map markers, boundaries and cached
  snow imagery work offline. YouTube videos remain online-only, with a readable
  explanation in each video card when disconnected.
- `src/offline/apiFetch.ts` caches an explicit allowlist of GET responses and
  falls back on transport failures. It never masks HTTP 401/403/404 with saved
  data. TanStack Query remains the in-memory UI cache; its query functions can
  read IndexedDB without waiting for a network connection.
- The service worker caches public build assets, including lazy tab chunks,
  under `/cas-mockup/`, including the bundled regional basemap. It does not cache
  authenticated API traffic or prefetch third-party map tiles. Updates activate
  after existing app tabs close or the user chooses “Actualizar aplicación”.
  A fresh install claims the current tab; readiness waits for that control so
  first-visit offline navigation works without a reload.

### Regional offline basemap

All map views can use the bundled Copiapó regional map: roads, rivers, water
polygons, agricultural/urban areas and place names. It covers 71.15°W–68.85°W,
28.85°S–26.85°S (including the displayed valley sectors and snow basins), and is
available after the first app-shell download without opening each map. It is
about 5.6 MiB in the browser cache, separate from the 50 MiB private-data budget.
The layer selector also makes it available online. This is a regional vector
reference map; **satellite imagery still requires internet**. Source coverage
can be incomplete, especially minor paths and land-use polygons.

The data is a simplified OSM extract distributed under ODbL 1.0 with attribution
in the map and `public/offline/ATTRIBUTION.txt`. Regenerate manually with
`scripts/build-offline-basemap.py` and a Geofabrik Chile `.osm.pbf` extract; no
third-party calls or map-processing dependency are added to the app build.
[OSM public tiles prohibit bulk offline downloads](https://operations.osmfoundation.org/policies/tiles/).
A full offline satellite layer requires a separately licensed/export-enabled
source; the existing public Esri tile URL is not used for bulk downloads.

Offline reloads require a production build (`npm run build` followed by
`npm run preview`), served over HTTPS or localhost. Vite development mode does
not register the service worker.

## Verification

`npm test` runs the data isolation, persistence, expiry, mutation and navigation
tests. `npm run build` checks TypeScript and generates the offline app shell.

`npm run test:offline` builds with isolated test Firebase settings and runs a
Playwright production-browser scenario. Install its browser with
`npx playwright install chromium`, or use an installed Chrome with
`PLAYWRIGHT_CHANNEL=chrome npm run test:offline`. The test mocks Firebase and API
responses; it does not contact a live account. It covers preparation, failed
initial-summary recovery, partial weather readings, incomplete-copy reporting,
an expired token, offline reload, unvisited tabs, the real bundled regional map,
forum replies/pagination, video placeholders, disabled writes, reconnect,
and logout cleanup. Run `npm run build` again for a build using your normal
environment after running this test.

## GitHub Pages deploy

The GitHub Actions deploy requires these Actions variables before building:

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_ID`

Configure them either as repository variables or in the `github-pages`
environment. If any variable is missing, the deploy workflow fails before
publishing so GitHub Pages does not ship a mock-only build.
