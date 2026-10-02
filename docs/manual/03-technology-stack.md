# Technology stack

This page lists every technology the system is built on, with its version and what it is used for here. It is for administrators who need to know what runs on the server, and for developers who maintain the code.

## On this page

- [At a glance](#at-a-glance)
- [Backend](#backend)
- [Frontend](#frontend)
- [Frontend build and test tools](#frontend-build-and-test-tools)
- [Servers and containers](#servers-and-containers)
- [Automatic checks (CI)](#automatic-checks-ci)
- [What is not used](#what-is-not-used)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## At a glance

**For administrators.**

| Layer | Technology | Version |
|---|---|---|
| Database | PostgreSQL | 16 |
| API | Python with Django and Django REST Framework | Python 3.13, Django 5.2.17 |
| Web app | Node.js with Next.js and React | Node 24, Next.js 16.3.8, React 19.2.8 |
| Front server | nginx | 1.27 |
| Packaging | Docker Compose | four services, see [Deployment](12-deployment.md) |

All backend versions are pinned exactly in `backend/requirements.txt`. The frontend versions are recorded exactly in `frontend/package-lock.json`.

## Backend

**For developers.** From `backend/requirements.txt`. Every package below is imported or configured in the code.

| Package | Version | Used for | Where |
|---|---|---|---|
| Django | 5.2.17 | The web framework: models, migrations, admin panel, e-mail, management commands. | `backend/config/settings.py`, every app |
| djangorestframework | 3.17.0 | The API: viewsets, serializers, permissions, throttling. | every `views.py` and `serializers.py` |
| djangorestframework-simplejwt | 5.5.0 | Sign-in tokens. The `token_blacklist` app is installed, so used and signed-out refresh tokens are revoked. | `SIMPLE_JWT` in settings, `backend/apps/users/views.py`, `backend/apps/users/urls.py` |
| psycopg[binary] | 3.3.6 | The PostgreSQL driver. | `DATABASES` in settings |
| django-cors-headers | 4.9.0 | Allows listed origins to call the API from a browser. The web app does not need it, because it calls the API from its own server. | `corsheaders` in `INSTALLED_APPS` and `MIDDLEWARE`, `CORS_ALLOWED_ORIGINS` |
| python-decouple | 3.8 | Reads settings from environment variables or a `.env` file. | `config(...)` calls in settings |
| openpyxl | 3.1.5 | Builds Excel files. | `backend/apps/reports/views.py`, `backend/apps/reports/exports.py`, `backend/apps/audit/views.py`, `backend/apps/notifications/tasks.py` |
| drf-spectacular | 0.30.0 | Builds the API description and the Swagger page. | `/api/schema/` and `/api/docs/` in `backend/config/urls.py`, `@extend_schema` in views |
| whitenoise | 6.12.0 | Serves the static files of the admin panel and the API pages. | `WhiteNoiseMiddleware` in `MIDDLEWARE`, `collectstatic` in `backend/Dockerfile` |
| gunicorn | 26.2.0 | The production server process for Django. | the `CMD` in `backend/Dockerfile` |

Python itself:

| Where | Version |
|---|---|
| Docker image | `python:3.13-slim` (`backend/Dockerfile`) |
| CI | 3.13 (`.github/workflows/ci.yml`) |

CSV files (report centre) are written with Python's standard library, not an extra package.

## Frontend

**For developers.** From `dependencies` in `frontend/package.json`. The "Installed" column is the version in `frontend/package-lock.json`.

| Package | In package.json | Installed | Used for | Where |
|---|---|---|---|---|
| next | 16.3.8 | 16.3.8 | The web framework: routing (App Router), server routes, the route guard, the production server. | `src/app/`, `src/proxy.ts`, `next.config.ts` |
| react, react-dom | 19.2.8 | 19.2.8 | The UI library. | everywhere |
| @tanstack/react-query | ^5.104.0 | 5.104.0 | Loads data from the API, caches it, and refreshes lists after a change. | `src/lib/crud.ts`, `src/providers/app-providers.tsx` |
| @tanstack/react-table | ^9.2.4 | 9.2.4 | Sorting, filtering and paging inside tables. | `src/components/common/data-table.tsx` |
| react-hook-form | ^7.89.0 | 7.89.0 | Form state. | the forms in `src/features/*` |
| zod | ^4.6.5 | 4.6.5 | Form rules and their messages. | `src/features/*/schemas.ts` |
| @hookform/resolvers | ^5.9.1 | 5.9.1 | Connects Zod rules to React Hook Form. | the forms in `src/features/*` |
| recharts | ^3.10.1 | 3.10.1 | Charts. | `src/components/common/chart.tsx`, dashboards |
| radix-ui | ^1.6.7 | 1.6.7 | Accessible base parts (dialog, select, tabs, dropdown menu and others). | `src/components/ui/*` |
| shadcn | ^4.21.0 | 4.21.0 | Base styles for the UI components (`shadcn/tailwind.css`). The component files themselves are in the repository. | `src/app/globals.css`, `components.json` |
| class-variance-authority | ^0.7.1 | 0.7.1 | Component style variants (for example button sizes). | `src/components/ui/button.tsx`, `badge.tsx` and others |
| cn | ^0.4.0 | 0.4.0 | Joins CSS class names. | `src/lib/utils.ts`, `src/components/ui/*` |
| cmdk | ^1.1.1 | 1.1.1 | The command menu (search box). | `src/components/ui/command.tsx` |
| lucide-react | ^1.49.0 | 1.49.0 | Icons. | `src/components/layout/nav-icon.tsx` and most pages |
| next-themes | ^0.4.6 | 0.4.6 | Light and dark theme. | `src/providers/app-providers.tsx`, `src/components/layout/theme-toggle.tsx` |
| sonner | ^2.0.8 | 2.0.8 | Toast messages. | `src/components/ui/sonner.tsx`, `src/lib/crud.ts` |
| tw-animate-css | ^1.4.0 | 1.4.0 | Animation classes for Tailwind. | `src/app/globals.css` |
| server-only | ^0.0.1 | 0.0.1 | Stops server code (the session code) from being bundled for the browser. | `src/lib/server/session.ts`, `src/lib/server/forward.ts` |

Fonts: Inter, Manrope and Geist Mono are loaded with `next/font/google` in `src/app/layout.tsx`.

## Frontend build and test tools

**For developers.** From `devDependencies` in `frontend/package.json`.

| Package | In package.json | Installed | Used for |
|---|---|---|---|
| typescript | ^5 | 5.9.3 | Type checking (`npm run typecheck`). Strict mode is on in `tsconfig.json`. |
| tailwindcss | ^4 | 4.3.3 | Styling. The theme tokens are in `src/app/globals.css`. |
| @tailwindcss/postcss | ^4 | 4.3.3 | Runs Tailwind in the build (`postcss.config.mjs`). |
| eslint | ^9 | 9.39.5 | Lint (`npm run lint`). |
| eslint-config-next | 16.3.8 | 16.3.8 | The lint rules: `core-web-vitals` and `typescript` (`eslint.config.mjs`). |
| playwright | ^1.63.0 | 1.63.0 | Browser tests (`npm run e2e`) and the layout audit (`npm run audit:ui`). Both use Chromium. |
| @types/node, @types/react, @types/react-dom | ^20, ^19, ^19 | 20.19.43, 19.3.0, 19.3.0 | Type definitions. |

The npm scripts:

| Script | Command it runs |
|---|---|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `eslint` |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run e2e` | `node e2e/run.mjs` |
| `npm run audit:ui` | `node e2e/ui-audit.mjs` |

## Servers and containers

**For administrators.** From `docker-compose.yml` and the two Dockerfiles.

| Service | Image | Notes |
|---|---|---|
| `db` | `postgres:16` | Database `erp`, user `erp`. Data in the `pgdata` volume. Has a health check (`pg_isready`). |
| `backend` | built from `backend/Dockerfile` on `python:3.13-slim` | Runs as a non-root user. On start it applies database migrations, then starts gunicorn on port 8000 with 3 workers by default. Has a health check that calls `/api/health/`. Uploaded files in the `media` volume. |
| `app` | built from `frontend/Dockerfile` on `node:24-alpine` | A three-stage build: install, build, run. Runs the Next.js standalone server (`node server.js`) on port 3000 as a non-root user. |
| `app-edge` | `nginx:1.27-alpine` | Uses `frontend/nginx.edge.conf`. The only service with a published port. |

All four services use `restart: unless-stopped`.

## Automatic checks (CI)

**For developers.** `.github/workflows/ci.yml` runs on every push to `main` or to a branch named `upgrade/...`, and on every pull request. It has two jobs, both on `ubuntu-latest`.

| Job | Tools | Steps |
|---|---|---|
| `backend` | Python 3.13, a `postgres:16` service, `actions/checkout@v4`, `actions/setup-python@v5` | `pip install -r requirements.txt`, `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py test apps` |
| `frontend` | Node 24, `actions/checkout@v4`, `actions/setup-node@v4` | `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` |

The backend job sets `EMAIL_BACKEND` to the in-memory backend, so tests send no e-mail. The browser tests and the layout audit are not part of CI; they are run by hand (see [Maintenance and changes](17-maintenance-and-changes.md)).

## What is not used

So that nobody looks for something that is not there:

- No task queue and no built-in scheduler. Scheduled jobs are management commands that the server's own scheduler must run. See [Deployment](12-deployment.md).
- No cache server and no search server. Search runs as database queries.
- No separate file storage service. Uploaded files are kept on disk under `MEDIA_ROOT`.
- SQLite is supported only for local tests (`DB_ENGINE=sqlite`). PostgreSQL is the real database.

## Keeping this page up to date

- Revise the backend table when `backend/requirements.txt` changes.
- Revise the frontend tables when `frontend/package.json` or `frontend/package-lock.json` change. Check that a new package is really imported before listing its use.
- Revise the server table when `docker-compose.yml`, `backend/Dockerfile` or `frontend/Dockerfile` change.
- Revise the CI section when `.github/workflows/ci.yml` changes.
