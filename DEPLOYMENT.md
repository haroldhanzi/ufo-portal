# Docker deployment

For the server at `108.181.203.204`, follow [docker/SERVER-DEPLOYMENT.md](docker/SERVER-DEPLOYMENT.md) and use `compose.server.yml`. It pulls prebuilt Docker Hub images, publishes only the frontend, and keeps MySQL on a private internal network with its data in `/srv/ufo/mysql`.

The root `compose.yml` is the local development stack: Nginx serves React and proxies `/backend-api` to Spring; Spring handles bearer authentication, users, site authorization, Omada, and monitoring; MySQL stores application data. The development stack additionally publishes MySQL on loopback for local tools. Use the server file above to deploy without any database host port.

## Start on a server

1. Install Docker Engine and the Compose plugin.
2. Copy `.env.example` to a private `.env.docker`. Set database/root passwords, bootstrap super-administrator email/password, and Omada controller/application credentials. Do not commit this file. The Omada application must be permitted to list and manage the required sites.
3. Set `MYSQL_DATA_DIR` to a local server folder, such as `/srv/ufo/mysql`, and create it. The default is `./data/mysql`. This is a **bind mount**, mapped to MySQL `/var/lib/mysql`; container replacement preserves the files.
4. Set `HTTP_PORT` and `PUBLIC_ORIGIN` for your deployment. Then run from the repository root:

```sh
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Open `http://localhost:8080` with the default port. Sign in with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`. The initial account is created only for an empty user table, and its role is SUPER_ADMIN. Changing bootstrap variables later does not reset its password.

The development stack launched from this workspace uses `admin@ufo.local`; its generated password is in the ignored `.env.docker` file. Its MySQL bind mount is `/home/hhanzi/ufo-data/mysql` inside the local Ubuntu WSL server. For another server, set `MYSQL_DATA_DIR` to that server's local filesystem path.

This Windows workspace uses the optional WSL relay at `http://localhost:8090`, forwarding to the Docker frontend on WSL port 8080. If needed, start it with `node docker/windows-wsl-forward.cjs` and set `PUBLIC_ORIGIN=http://localhost:8090`. `UFO_WSL_DISTRO`, `UFO_DOCKER_PORT`, and `UFO_WINDOWS_PORT` override the relay defaults. This relay is unnecessary on a normal Linux deployment server or a working Docker Desktop port mapping.

## Roles and site assignment

- **Super administrator:** creates/updates/disables accounts and sees hardware across all sites. Hardware Monitoring defaults to All sites and can filter by a site.
- **Portal partner:** uses WiFi, schedules, portals, vouchers, blacklists, and hardware monitoring for exactly its assigned Omada site. Partners can create, list, update, enable/disable, and reset passwords for portal partner users at that site. Their site is assigned automatically; they cannot grant super-administrator access, reassign sites, or retrieve the full site directory.

In Users, create a portal partner and choose **Assigned Omada site** from the dropdown. The backend fetches the paginated Omada site list, validates the selection against the synchronized site catalog, and stores the site ID/name on the account. Partners receive their site automatically at login. URL/query/body changes cannot grant access to another site; the backend also checks every device ID before exposing history, alerts, rules, updates, or reboot.

Site reassignment invalidates existing bearer sessions. Existing ADMIN accounts migrate to SUPER_ADMIN. Existing OPERATOR/VIEWER accounts migrate to disabled PORTAL_PARTNER accounts; assign a valid site and enable them in Users before use. The last enabled super administrator cannot be disabled or demoted.

## Operations and persistence

```sh
docker compose --env-file .env.docker logs --tail 100 backend
docker compose --env-file .env.docker restart backend
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d
```

`down` removes this application's containers/network, leaving the bind-mounted database folder. Back up MySQL using database-aware tools before upgrades; do not copy live InnoDB files as a logical backup. Keep the data folder and private environment file across redeployments. MySQL initialization passwords are used only for the first initialization; changing environment passwords after data already exists requires changing the database account as well.

Nginx's `/health` confirms frontend readiness. Spring `/actuator/health` is checked inside its container and includes MySQL connectivity. Compose waits for MySQL, then Spring, then the frontend. Image builds run frontend compilation and backend tests. Use HTTPS at the deployment ingress for credentials and bearer traffic.

Hardware discovery and status polling use the supplied @25 endpoint automatically across accessible sites. The @26 reboot endpoint is configured and uses a hyphenated MAC. Only recent connected hardware can be rebooted. Blank notification delivery configuration leaves alerts PENDING; configure your email/SMS delivery service to deliver them.
