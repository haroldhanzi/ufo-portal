# UFO Partner Portal

React/TypeScript management portal for TP-Link Omada Northbound APIs.

## Local setup

1. The shared test environment works with the included test configuration. To override it, copy `.env.example` to `.env` and change the desired values. `.env` is excluded from source control.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open **API access** in the header. Request a token with an Omada client ID and secret, or paste an existing AccessToken. The client secret is discarded after the request; only the token is stored in session storage.

## Vercel configuration

The shared development deployment includes test defaults and does not require Vercel environment variables. To override those defaults for another environment, configure the following variables and redeploy so Vite can include them in the build:

```env
VITE_OMADA_BASE_URL=https://euw1-omada-northbound.tplinkcloud.com
VITE_OMADA_ID=caaaa331cf6e876e8fea7403e00e7ff6
VITE_OMADA_SITE_ID=6a4eb57c543849228eba7341
VITE_OMADA_CLIENT_ID=f39dc9be33dd464cb7fce8a7a5756fd7
VITE_OMADA_CLIENT_SECRET=9719d73c0d4c493997ec55d781ef1d7b
VITE_LOCATION_NAME=UFO Test Location
```

The serverless proxy also accepts `OMADA_BASE_URL`; when it is not set it uses `VITE_OMADA_BASE_URL`. Do not commit a populated `.env` file.

## Validation

Run `npm run build` and `npm run lint` before deployment. A web server must serve `index.html` as the fallback for unknown routes so browser refreshes work with React Router.

Dependencies include platform-specific binaries. If switching between Windows and WSL/Linux, remove `node_modules` in the environment you intend to use and run `npm install` there. Do not reuse a Windows-installed `node_modules` directory from WSL.

## API coverage

- SSID list/detail/create/password update/schedule assignment/delete
- Time-range profile list/create
- Portal list/create/SSID association update/delete
- Voucher-group paginated list/search/create

Client management and user management are not included in the supplied API collection.
