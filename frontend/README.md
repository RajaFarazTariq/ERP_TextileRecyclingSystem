# Textile ERP — web app (Next.js)

The web interface for the ERP.

## Run

```bash
npm install
copy .env.example .env.local     # DJANGO_API_URL, SECURE_COOKIES
npm run dev -- -p 3001           # http://localhost:3001
```

Django must be running (see `../backend`). Set `NUM_PROXIES=1` in `backend/.env` so its login rate limit sees each user's own address.

## How it talks to Django

The browser never holds the login tokens. `src/app/api/auth/*` logs in against Django and stores the tokens in httpOnly cookies. `src/app/api/django/[...path]` forwards every API call to Django `/api/v1/`, adding the access token and renewing it with the refresh token when it expires. Pages call it through `src/lib/api.ts`.

## Layout

- `src/app/` — routes: `login`, `(app)/<module>` (signed-in pages), `api/` (session and proxy)
- `src/features/<module>/` — a module's page, forms and validation schemas
- `src/components/common/` — data table, form and confirm dialogs, states, filters
- `src/components/layout/` — sidebar and header; `src/components/ui/` — shadcn/ui
- `src/config/access.ts` — which roles may open which page, and the sidebar menu
- `src/proxy.ts` — route guard (login and role)

## Checks

```bash
npm run lint
npm run typecheck
npm run build
npm run e2e        # browser tests; see the header of e2e/run.mjs for setup
```
