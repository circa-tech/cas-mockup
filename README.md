# cas-mockup

## Runtime configuration

Copy `.env.example` to `.env.local` for local development and set:

- `VITE_API_BASE_URL`: Cloud Run gateway URL
- `VITE_FIREBASE_*`: Firebase web app config for Google sign-in

If Firebase is not configured, the mockup keeps the local demo login and mock
station data.
