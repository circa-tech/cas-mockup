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
  sectors, the initial parcel, initial download date choices, and the first forum
  page where permitted. Other parcels, download selections and forum pages are
  saved when visited. It does not download the entire historical archive.
- All private responses are isolated by API environment, Firebase project, UID,
  role and permissions. Logout/account changes clear the saved copy. Firebase
  manages its own credentials; the application snapshot stores no tokens.
- Responses expire after seven days and the store is capped at 50 MiB, evicting
  older responses first. Browser eviction, private browsing, disabled storage,
  or quota failures can make preparation incomplete. Offline access cannot
  discover permission changes until an online session is revalidated.
- Mutations, administration and new image downloads require connectivity. No
  changes are queued for later submission. Map markers, boundaries and cached
  snow imagery work offline; external basemap tiles and YouTube videos do not.
- `src/offline/apiFetch.ts` caches an explicit allowlist of GET responses and
  falls back on transport failures. It never masks HTTP 401/403/404 with saved
  data. TanStack Query remains the in-memory UI cache; its query functions can
  read IndexedDB without waiting for a network connection.
- The service worker caches public build assets, including lazy tab chunks,
  under `/cas-mockup/`. It does not cache authenticated API traffic or prefetch
  third-party map tiles. Updates activate after existing app tabs close.

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
responses; it does not contact a live account. It covers preparation, an expired
token, offline reload, unvisited tabs, missing data, disabled writes, reconnect,
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
