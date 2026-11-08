# Server deployment: 108.181.203.204

The server pulls prebuilt `thewiseone/ufo-frontend` and `thewiseone/ufo-backend` images from Docker Hub and the official `mysql:8.4` image. Only the frontend publishes a port (10029 by default). Spring Boot has no public port. MySQL has no published ports and is attached only to an internal network shared with Spring Boot. Its files are bind-mounted from `/srv/ufo/mysql` on the server. The frontend cannot connect directly to MySQL.

## First deployment

Install Docker Engine and the Docker Compose plugin on the Linux server. These images target **linux/amd64**; verify the server reports `x86_64` with `uname -m`.

Copy these files to the same server directory, such as `/srv/ufo/app`:

- `compose.server.yml`
- `.env.server` (private, ignored by Git; prepared locally with the current credentials)

If creating configuration yourself, copy `.env.server.example` to `.env.server` and replace every placeholder. Set the Omada controller/client credentials, database and root passwords, bootstrap administrator account, image tag, public origin, and server data path. Do not copy the Windows MySQL relay or its local port settings.

Run on the server from the directory containing these files:

```sh
sudo mkdir -p /srv/ufo/mysql
chmod 600 .env.server
docker compose --env-file .env.server -f compose.server.yml config --quiet
docker compose --env-file .env.server -f compose.server.yml pull
docker compose --env-file .env.server -f compose.server.yml up -d --wait
docker compose --env-file .env.server -f compose.server.yml ps
```

Open `http://108.181.203.204:10029`. Allow incoming TCP 10029 in the server/provider firewall. Keep database ports 3306/3308 closed. Use HTTPS before sending production credentials over the internet; when a domain and TLS reverse proxy are configured, update `PUBLIC_ORIGIN` to the HTTPS URL and recreate the stack.

If Docker Hub repositories are private, run `docker login` on the server with a read-only access token before `pull`. Public repositories do not require login to pull, but Docker Hub pull limits still apply.

The new database starts empty: it creates the bootstrap administrator configured in `.env.server`. Existing local users, rules, and device history are not copied automatically; migrate them using a MySQL dump/restore if required. Changing bootstrap variables does not reset an account already in the database.

## Publish a new release from the development machine

Change `IMAGE_TAG` in `.env.server`, sign in to Docker Hub as the repository owner, then run:

```sh
docker login
docker compose --env-file .env.server -f compose.images.yml build
docker compose --env-file .env.server -f compose.images.yml push
```

Use a new version tag for each release. Both images are built from the current workspace; runtime passwords and Omada credentials are supplied by Compose and are not baked into the images.

On the server, set the same `IMAGE_TAG` in `.env.server`, then:

```sh
docker compose --env-file .env.server -f compose.server.yml pull
docker compose --env-file .env.server -f compose.server.yml up -d --wait
```

The server does not need source code, Maven, Node, or the build Compose file.

## Operations and data

```sh
docker compose --env-file .env.server -f compose.server.yml logs --tail=100 backend
docker compose --env-file .env.server -f compose.server.yml logs --tail=100 mysql
docker compose --env-file .env.server -f compose.server.yml down
```

Container replacement and `down` preserve `/srv/ufo/mysql`. Keep this folder and `.env.server` across deployments. Schedule database-aware backups; persistence on one server is not a backup. MySQL initialization passwords apply only to a new data directory; existing accounts require an SQL password change as well.

The root `compose.yml` remains the local development stack. Use `compose.server.yml` on this server to avoid publishing the development database port.
