# UFO Partner Portal

React/TypeScript management portal for TP-Link Omada Northbound APIs.

## Local setup

1. Copy `.env.example` to `.env` and update the controller, site, location, and optional test client-credential values. `.env` is excluded from source control.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open **API access** in the header. Request a token with an Omada client ID and secret, or paste an existing AccessToken. The client secret is discarded after the request; only the token is stored in session storage.

## Validation

Run `npm run build` and `npm run lint` before deployment. A web server must serve `index.html` as the fallback for unknown routes so browser refreshes work with React Router.

Dependencies include platform-specific binaries. If switching between Windows and WSL/Linux, remove `node_modules` in the environment you intend to use and run `npm install` there. Do not reuse a Windows-installed `node_modules` directory from WSL.

## API coverage

- SSID list/detail/create/password update/schedule assignment/delete
- Time-range profile list/create
- Portal list/create/SSID association update/delete
- Voucher-group paginated list/search/create

Client management and user management are not included in the supplied API collection.
