# UFO Partner Portal

React/TypeScript frontend with a Spring Boot security, user-management, Omada proxy, and hardware-monitoring backend. MySQL stores users, bearer sessions, monitored devices, rules, and history.

## Docker stack

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full React + Spring Boot + MySQL stack, local database-folder persistence, super-administrator bootstrap, and site-scoped partner accounts.

## Local setup

1. Provision MySQL and configure Spring using [backend/.env.example](backend/.env.example). See [backend/README.md](backend/README.md) for database/administrator setup and Docker Compose.
2. Run Spring: `cd backend` then `.\mvnw.cmd spring-boot:run` (Windows) or `sh mvnw spring-boot:run` (Linux/macOS).
3. At the repository root, run `npm install` then `npm run dev`.
4. Open `http://localhost:5173` and sign in with your user email and password. No Omada setup dialog or token input is required.

Vite forwards `/backend-api/*` to `http://localhost:8080/api/*`; override the upstream with `BACKEND_URL` in the root `.env`. That file is ignored by Git. Spring reads environment variables directly; it does not automatically load `.env` when launched with Maven.

All Omada credentials, controller ID, site ID/name, and upstream URLs are configured on Spring Boot. No `VITE_OMADA_*` credentials are used. Spring obtains an Omada token on the first resource request, retains it in the authenticated user's server-side bearer session, and renews it when necessary. The browser stores only the application bearer token for its tab session.

## Deployment

For the server at `108.181.203.204`, use [docker/SERVER-DEPLOYMENT.md](docker/SERVER-DEPLOYMENT.md): `compose.server.yml` pulls versioned Docker Hub images and keeps MySQL private with persistent storage. `compose.images.yml` builds and publishes the React and Java images. Copy the private `.env.server` separately; it is ignored by Git.

Deploy Spring Boot as a separate JVM service connected to MySQL. For Vercel, set the server-only `BACKEND_URL` to the HTTPS origin of that service (for example `https://backend.example.com`). The included serverless route forwards `/backend-api/*` to Spring `/api/*`, preserving bearer headers and multipart uploads. The old direct-to-Omada proxy was removed. Configure secrets in the Spring runtime, not Vite or Vercel frontend variables.

Alternatively use a same-origin reverse proxy or set `VITE_BACKEND_BASE_URL` to the backend `/api` URL and configure Spring's allowed frontend origin. Serve `index.html` as the SPA fallback. Use HTTPS for login and bearer traffic.

## Validation

`npm run build`, `npm test`, and `npm run lint`; backend: `cd backend` then `.\mvnw.cmd verify` (or `sh mvnw verify`). Tests use isolated H2 databases in MySQL compatibility mode; runtime uses MySQL. Install dependencies separately on Windows and Linux rather than sharing platform-specific `node_modules`.
