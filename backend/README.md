# Spring Boot backend

Java 21 / Spring Boot 3.5.16 / Spring Security / MySQL. Implements application authentication, user management, Omada access, and the hardware-monitoring requirements in `docs/additional`.

## Start

Create a MySQL database named `ufo_portal`, grant a dedicated user access, and set the variables in `.env.example`. From `backend`:

```powershell
$env:DATABASE_USERNAME = 'ufo'
$env:DATABASE_PASSWORD = 'your-database-password'
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = 'your-12-or-more-character-password'
$env:OMADA_CONTROLLER_ID = 'your-controller-id'
$env:OMADA_SITE_ID = 'your-site-id'
$env:OMADA_SITE_NAME = 'Your location'
$env:OMADA_CLIENT_ID = 'your-client-id'
$env:OMADA_CLIENT_SECRET = 'your-client-secret'
.\mvnw.cmd spring-boot:run
```

The default URL is `jdbc:mysql://localhost:3306/ufo_portal?connectionTimeZone=UTC`; override `DATABASE_URL` if needed. Flyway migrates the schema and Hibernate validates it. Maven does not automatically load `.env`. Alternatively use the root Compose stack described in [DEPLOYMENT.md](../DEPLOYMENT.md). It provisions the React frontend, Spring Boot, and MySQL 8.4 with a local bind mount. The initial administrator is created only when no users exist. No default password is provided.

Health: `GET /actuator/health`. Validate/package: `.\mvnw.cmd verify`. Run packaged app: `java -jar target/hardware-monitoring-1.0.0.jar`. Linux/macOS: use `sh mvnw`. H2 is a test-only dependency; it is not a runtime database option.

## Bearer authentication and Omada sessions

`POST /api/auth/login` with `{ "email": "...", "password": "..." }` returns:

```json
{"accessToken":"opaque-random-token","tokenType":"Bearer","expiresAt":"...","user":{"id":1,"name":"Administrator","email":"...","role":"ADMIN","enabled":true}}
```

Send `Authorization: Bearer <accessToken>` to every protected API. Tokens are cryptographically random (256-bit); only SHA-256 hashes are stored in MySQL. This is a revocable opaque bearer session, not a JWT. Default expiry is eight hours (`USER_SESSION_SECONDS`). Spring Security is stateless at the HTTP layer: cookies cannot authenticate and no CSRF token is needed. MySQL holds the bearer-session record.

Login and `/api/auth/config` do **not** request an Omada token. The first `/api/omada/*` request obtains a client-credentials token, stores it and its expiry in that user's session, and reuses it until near expiry. Session row locking prevents concurrent first requests from generating duplicate tokens. Omada `-44112` or HTTP 401 renews and retries once. Upstream Omada 401 is mapped to 502 so it cannot invalidate the user's application login. Logout revokes the bearer and clears its Omada token. Disabled users and password changes invalidate existing bearer sessions; re-enabling requires a fresh login. Current roles are rechecked on every request.

The browser receives neither Omada credentials nor Omada tokens. In production use HTTPS and restrict database access; Omada access tokens reside in the server-side session table. Expired/revoked session rows are retained; arrange retention cleanup for long-running deployments.

Roles: SUPER_ADMIN manages users and monitors all sites; PORTAL_PARTNER manages Omada resources, hardware, and portal partner users only at the assigned site. User lists/searches are scoped in the database; all user-ID operations reject users at other sites and super administrators. Partners create only PORTAL_PARTNER accounts and cannot change site assignments. The backend checks the assigned site on every request and every device ID. The super administrator loads the Omada site directory using GET /api/sites and selects a site when creating a partner. Site changes revoke existing sessions.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Obtain application bearer |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/config` | Server-configured site ID/name |
| POST | `/api/auth/logout` | Revoke current bearer session |
| GET / POST | `/api/users` | List/search/paginate or create (all sites for SUPER_ADMIN; own-site partners for PORTAL_PARTNER) |
| GET / PUT | `/api/users/{id}` | Read/update name, email, role (all sites for SUPER_ADMIN; own-site partners for PORTAL_PARTNER) |
| PATCH | `/api/users/{id}/enabled` | `{ "enabled": false }` (all sites for SUPER_ADMIN; own-site partners for PORTAL_PARTNER) |
| PUT | `/api/users/{id}/password` | `{ "password": "..." }` (all sites for SUPER_ADMIN; own-site partners for PORTAL_PARTNER) |
| GET / POST / PUT / PATCH / DELETE | `/api/omada/v1/sites/{siteId}/{resource}` | Authenticated Omada proxy, v2 also supported |

Create user: `{ "name":"...", "email":"...", "password":"...", "role":"PORTAL_PARTNER", "siteId":"..." }`. Passwords are BCrypt-hashed, minimum 12 characters. Password hashes are excluded from responses. Last enabled administrator cannot be disabled/demoted. Pagination is zero-based, size 1–200; responses contain `content` and `page` metadata.

Monitoring prefix `/api/monitoring`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/devices?siteId=...` | Inventory |
| POST | `/devices` | Register monitoring record |
| GET / PUT | `/devices/{id}` | Read/edit metadata |
| POST | `/devices/{id}/observations` | Trusted telemetry ingestion |
| GET | `/devices/{id}/history` | State changes |
| GET / POST | `/devices/{id}/rules` | List/create rules |
| DELETE | `/devices/{id}/rules/{ruleId}` | Disable rule while retaining history |
| GET | `/devices/{id}/notifications?kind=ESCALATION` | Notification/escalation history |
| POST | `/devices/{id}/reboot` | Reboot recently observed connected device |

Registration: `{ "siteId":"...", "mac":"AA:BB:CC:DD:EE:01", "deviceNumber":"AP-001", "name":"Library AP", "location":"Library" }`. Observation: `{ "state":"DISCONNECTED", "observedAt":"current ISO UTC time" }`. Device states are CONNECTED/DISCONNECTED/UNKNOWN; registration does not adopt/provision hardware. Out-of-order observations are ignored. Stale observations become UNKNOWN and do not create false disconnection alerts. Optional `MONITORING_API_KEY` supports trusted machines on monitoring endpoints only, not the Omada proxy or user-management APIs.

Example alert rule:

```json
{"kind":"ESCALATION","method":"EMAIL","triggerType":"PERIOD_IN_STATE","targetState":"DISCONNECTED","minimumSeconds":3600,"repeatSeconds":3600,"maximumCount":3,"startTime":"08:00:00","endTime":"18:00:00","zoneId":"Africa/Harare","overrideMac":null,"recipients":[{"name":"Support","email":"support@example.com","mobile":null}]}
```

Maximum zero disables the rule; counters reset on state transition. STATE/PERIOD_IN_STATE repeat after the minimum delay; STATE_CHANGE fires once per confirmed transition. Equal window endpoints mean all day, overnight windows work, end time is exclusive. Assumed override semantics: another registered device at the same site suppresses dependent alerts while UNKNOWN/DISCONNECTED. Confirm this interpretation with the requirements owner.

## Scheduled monitoring and message delivery

Monitoring uses the supplied @25 device list: GET `/openapi/v1/{omadacId}/sites/{siteId}/devices?page=1&pageSize=100`, following `result.data` and `totalRows` across pages. Scheduled discovery enumerates the Omada site directory and imports hardware automatically; later polls preserve locally edited names, device numbers, locations, and alert rules. Status 1 is CONNECTED, 0 is DISCONNECTED; Pending (2), Heartbeat Missed (3), Isolated (4), and unrecognized statuses are UNKNOWN. Missing/stale devices become UNKNOWN rather than generating false disconnection alerts. @26 reboot is a bodyless POST to `/openapi/v1/{omadacId}/sites/{siteId}/devices/{deviceMac}/reboot` with a hyphenated MAC. Reboot requires a recent connected observation and reports the documented upgrading/provisioning/reboot conflicts. Interactive reboot uses the logged-in bearer session's cached Omada token. Scheduled jobs use a separate lazy backend token cache, independent of logged-in users.

Without `NOTIFICATION_DELIVERY_URL`, notices remain PENDING. The HTTP adapter posts `{ "id":1, "kind":"ESCALATION", "method":"BOTH", "recipients":[...], "message":"..." }` with bearer `NOTIFICATION_DELIVERY_TOKEN` and `Idempotency-Key: ufo-monitoring-<id>`. The delivery service must honor that key and deliver both channels for BOTH. Failures retry with backoff up to five attempts, then FAILED; 2xx means DELIVERED. Previously queued events are retained even if the device recovers. Run one monitoring/dispatcher instance per database; distributed job claiming is not implemented.

## Frontend / deployment

The existing React app signs in once and uses bearer headers for all Spring/Omada requests. No Omada startup input is required. Vite `/backend-api` proxies to Spring `/api`. For Vercel set server-side `BACKEND_URL` to the Spring HTTPS origin. Alternatively configure a same-origin reverse proxy or `VITE_BACKEND_BASE_URL` and the allowed frontend origin (`MONITORING_CORS_ORIGIN`). Spring is deployed as a separate service connected to MySQL.
