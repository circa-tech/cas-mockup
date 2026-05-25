# cas-mockup

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and set:

- `VITE_API_BASE_URL`: Cloud Run gateway URL
- `VITE_FIREBASE_*`: Firebase web app config for Google sign-in

If Firebase is not configured, the mockup keeps the local demo login and mock
station data.

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
