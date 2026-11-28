# CAS mockup agent instructions

## Local deployment
- When Diego asks to deploy CAS locally, use the AtacaFIC root `docker-compose.yml` to run the updated CAS containers. A host `npm run dev` process or this repository's standalone Compose file is not the requested deployment unless Diego explicitly says otherwise.
- Inspect the root Compose configuration, existing containers, volumes, ports, and intended checkouts before starting. Preserve PostgreSQL and Firestore data volumes and unrelated containers.
- The root Compose stack mounts its `./cas-mockup` checkout into the frontend container. If the requested changes live in another checkout, use a temporary Compose override for both the mockup build context and `/app` bind mount. Do not move or overwrite unrelated changes in the main checkout.
- Rebuild and recreate the relevant frontend and API containers, start their dependencies, and verify the running mockup uses the intended checkout. Confirm `http://localhost:5173/cas-mockup/` and the local API respond. Report any container that could not be rebuilt; do not claim a host development server is a Docker deployment.
