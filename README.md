# cas-mockup

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and set:

- `VITE_API_BASE_URL`: Cloud Run gateway URL
- `VITE_FIREBASE_*`: Firebase web app config for Google sign-in

If Firebase is not configured, the mockup keeps the local demo login and mock
station data.

## ET and snow historical series

Authenticated ET charts (whole valley, sector and parcel) and the four snow areas
offer 1 year, 2 years, all available data since 2021, custom inclusive dates and
a draggable zoom selector. Applying a zoom queries the selected interval again
so monthly overviews can resolve into original observations. Monthly tooltips
show the mean, minimum, maximum and observation count. Missing values remain
gaps. Actual available dates are displayed; selecting 2021 does not imply the
source has measurements for every date.

This requires the new `cas-service-platform` history endpoints and the
`cas-etl/pipelines/history` publication. Deploy the API, publish/audit the source
history, then deploy this UI. Existing seasonal summary cards and Kc/LAI access
are preserved. No browser connects to PostgreSQL or Firestore directly.

The offline copy includes the default one-year ET interval for the overview,
supported sectors and initial parcel, plus the snow histories used for comparing
seasons. Other ET periods require a connection. A saved preset keeps its actual
dates when the calendar advances.

## Offline browsing

Online requests load the current data from the API. To prepare for fieldwork,
open the signed-in user menu, choose **Datos sin conexión** and select
**Guardar copia ahora**. The panel shows the date, unavailable sections, and
**Eliminar copia**. A saved identity can reopen the app offline, including after
its Firebase token expires. First sign-in requires a connection.

- The copy covers weather, supported well monitoring and registry data, the snow
  image and history, ET-LAT overview/maps, up to 24 supported sectors, the initial
  parcel and initial download date choices when permitted. Kc and LAI series for
  the initial parcel are included for general administrators. The forum download
  follows available topic and reply pages up to 300 requests. Additional parcel
  selections, periods, and generated downloads require connection.
- Each saved copy has a manifest of the enrolled resources and its original
  timestamp. The panel reports missing resources from their actual availability.
  If a replacement cannot complete, the previous copy remains usable. Permission
  denials or removed resources still invalidate the affected saved content.
- IndexedDB isolates private data by browser origin, API environment, Firebase
  project, UID, role and permissions. Logout and identity changes clear the copy.
  The copy contains no credentials. Rows expire after seven days and are subject
  to a 50 MiB application cap and the browser's storage policy.
- Online API requests use the server. Saved reads run only when the browser
  reports it is offline. The public app shell, lazy chunks and regional basemap
  are cached by the production service worker independently of the private copy.
  Mutations are blocked offline. Satellite imagery, video, administration and
  generated downloads require connection.

For CIRCA-208, test each HTTPS origin independently. Sign in on the new host,
save a copy, disconnect, reload, and open Evapotranspiración and Nieve. Reconnect
and verify current server data, then delete the local copy and repeat the
offline reload. The browser stores the old origin's copy separately, so users
must save again on the new host. Keep the app-shell scope aligned with the
actual hosting path (currently /cas-mockup/).

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
responses. It covers manual preparation, live data on reconnect, failed
replacement and deletion, incomplete-copy reporting, legacy storage migration,
an expired token, next-day histories, offline reload, unvisited tabs, the
bundled regional map, forum replies, video placeholders, and logout cleanup. Run `npm run build` again for a build using your normal
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
