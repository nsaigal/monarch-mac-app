# monarch-mac

Local backend scaffold for a native macOS wrapper around Monarch Money.

## Backend

The first pass is a small FastAPI service that wraps the `hammem/monarchmoney` Python client.

It currently provides:

- Health and auth status endpoints
- Login via Monarch token or email/password
- Optional MFA code handling
- Read endpoints for accounts, budgets, and transaction summary

The service does **not** persist Monarch sessions to disk. That is intentional for now because the upstream client uses a pickle-based session file by default.

## Setup

```bash
make install
cp backend/.env.example backend/.env
make run
```

## Environment

`backend/.env` supports optional startup login:

```bash
MONARCH_BASE_URL=https://api.monarch.com
MONARCH_CLIENT_VERSION=
MONARCH_TOKEN=
MONARCH_EMAIL=
MONARCH_PASSWORD=
MONARCH_MFA_SECRET_KEY=
```

If `MONARCH_CLIENT_VERSION` is blank, the backend will try to discover the current web app version from `https://app.monarch.com` and fall back to a known-good value.

If you leave those empty, the backend still starts and you can log in through the API.

## Run

The API defaults to `http://127.0.0.1:8000`.

Docs:

- `http://127.0.0.1:8000/docs`
- `http://127.0.0.1:8000/redoc`
- `http://127.0.0.1:8000/login`

Use `make run` for the plain server and `make run-dev` if you want auto-reload.

## Desktop

The first desktop shell is an Electron app that can:

- start the local Python backend if it is not already running
- authenticate to the backend with a Monarch token
- show account and summary data from the local API

Setup:

```bash
make desktop-install
make desktop-run
```

The desktop shell lives in `desktop/` and talks to the backend at `http://127.0.0.1:8000` by default.

## Build DMG

The DMG build now bundles the Python backend into the Electron app, so the packaged app does not depend on the repo-local `.venv`.

One-time setup:

```bash
make install
cd desktop
npm install
../.venv/bin/pip install pyinstaller
```

Build the frozen backend only:

```bash
cd desktop
npm run build:backend
```

Build the unsigned macOS DMG:

```bash
cd desktop
npm run dist:mac
```

Output:

- Backend binary: `desktop/dist/backend/monarch-backend`
- App + DMG: `desktop/dist/electron/`

Notes:

- The packaged app writes the persisted Monarch token under the app's user data directory instead of the app bundle.
- `MONARCH_BACKEND_URL` still works if you want the Electron shell to talk to an already-running backend instead of the bundled one.
- For distribution to other Macs, you still need Apple code signing and notarization; this setup only gets you an unsigned local DMG build.

## Manual update checks

The desktop app now supports a lightweight manual update flow for unsigned builds:

- it checks GitHub Releases on launch
- if a newer version exists, it shows an in-app update banner
- clicking `Download update` opens the latest release asset in the browser

To enable that for packaged builds, set the GitHub repo in `desktop/package.json`:

```json
"releaseRepository": "owner/repo"
```

The app expects GitHub Releases to contain a macOS DMG asset for each version.

For local testing without changing `package.json`, you can override the release source at runtime:

```bash
MONARCH_RELEASES_REPO=owner/repo make desktop-run
```

This is not true in-place auto-update. It is a manual download flow intended for unsigned direct-distribution builds.

## Example login

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password"}'
```

If Monarch requests MFA, retry with:

```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"your-password","mfa_code":"123456"}'
```
