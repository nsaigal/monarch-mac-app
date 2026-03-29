# Backend

FastAPI wrapper around [`hammem/monarchmoney`](https://github.com/hammem/monarchmoney).

## Endpoints

- `GET /login`
- `GET /healthz`
- `GET /auth/status`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /accounts`
- `GET /budgets`
- `GET /transactions/summary`

## Notes

- The upstream Monarch client supports session persistence with a pickle file. This backend disables that path and keeps auth in memory for now.
- Startup auth can be configured with `backend/.env`.
- A small local browser UI is available at `/login`.
- The backend overrides the legacy `api.monarchmoney.com` base URL and uses `https://api.monarch.com`.
- The backend also sends current-style Monarch web client metadata on auth and GraphQL requests so login is not rejected as an outdated client.
