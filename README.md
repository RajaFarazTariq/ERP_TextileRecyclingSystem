# ERP Textile Recycling System

A web-based ERP for textile recycling factories. It follows material from the supplier's truck to the customer's delivery: deliveries are weighed into the warehouse, then sorted, decolorized and dried, and the dried output is sold. Purchasing, stock, payments and reports sit alongside, all in one place, with role-based access for each department.

![Dashboard](docs/screenshots/dashboard.png)

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Run with Docker (recommended)](#run-with-docker-recommended)
- [Run without Docker](#run-without-docker)
- [Demo logins](#demo-logins)
- [Tests](#tests)
- [Usage and API](#usage-and-api)
- [Business rules](#business-rules)
- [Roadmap](#roadmap)

## Features

**Operations**
- **Warehouse:** suppliers, factory units and incoming deliveries (vendor slip, vehicle, our weight vs. unloading weight). Approve or reject deliveries, and optionally link one to a purchase order.
- **Sorting:** fabric lots and sorting sessions, with progress tracked against the weight taken.
- **Decolorization:** tanks, chemical stock and issues (over-issuing is blocked), process sessions and efficiency.
- **Drying:** dryers and drying sessions. Completed sessions add sellable stock.

- **Quality:** standards with limits, inspections of deliveries and fabric lots, quarantine of failed material, corrective actions, defect analysis and supplier quality.

**Commercial**
- **Purchasing:** purchase requests and orders with admin approval, amendments with revision numbers, deliveries against orders, supplier invoices with tax, payments, returns, quotations, price comparison and supplier performance.
- **Sales:** customers, orders with stock reservation, partial dispatches, payments, and oversell protection.
- **Inventory:** a ledger of every stock change, with reservations and admin adjustments.

**Administration**
- **Dashboard:** live material flow across the stages, period-over-period changes, trends, and a "needs attention" list.
- **Reports:** production, waste and sales reports, Excel exports, and the audit log of who changed what.
- **Users and roles:** admin plus one supervisor role per department. Each role sees only its own pages.
- **Email alerts and scheduled reports** (low chemicals, new orders, payments).

**Interface**
- "Industrial Eco-Tech" design with dark (default) and light themes.
- A command palette (Ctrl+K) for jumping to any page, section or action.
- Notifications, and sortable, filterable tables with CSV export and adjustable row density.
- Works on phones and tablets.

## Screenshots

| Dashboard (dark) | Dashboard (light) |
|---|---|
| ![Dashboard, dark theme](docs/screenshots/dashboard.png) | ![Dashboard, light theme](docs/screenshots/dashboard-light.png) |

| Warehouse | Sorting |
|---|---|
| ![Warehouse](docs/screenshots/warehouse.png) | ![Sorting](docs/screenshots/sorting.png) |

| Decolorization | Drying |
|---|---|
| ![Decolorization](docs/screenshots/decolorization.png) | ![Drying](docs/screenshots/drying.png) |

| Purchasing | Sales |
|---|---|
| ![Purchasing](docs/screenshots/purchasing.png) | ![Sales](docs/screenshots/sales.png) |

| Reports | Command palette (Ctrl+K) |
|---|---|
| ![Reports](docs/screenshots/reports.png) | ![Command palette](docs/screenshots/command-menu.png) |

| Sign in | Phone |
|---|---|
| ![Sign in](docs/screenshots/login.png) | <img src="docs/screenshots/mobile.png" alt="Dashboard on a phone" width="300"> |

The screenshots come from demo data. To retake them, run `node e2e/readme-shots.mjs` in `frontend/`, with the same setup as the [tests](#tests).

## Tech stack

| Part | Technology |
|---|---|
| Backend | Python, Django 5.2 LTS, Django REST Framework, SimpleJWT, drf-spectacular (API docs) |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query and Table, React Hook Form + Zod, Recharts |
| Database | PostgreSQL 16 |
| Deployment | Docker Compose (PostgreSQL, Django/Gunicorn, Next.js, nginx) |
| Testing and CI | Django test runner, Playwright browser tests, GitHub Actions |

## Project structure

```
backend/
  config/                 Django project: settings, root URLs, WSGI/ASGI
  apps/
    core/                 Shared permissions (roles), filters, seed commands
    users/                Custom user model, login, user management
    warehouse/            Suppliers, factory units, incoming deliveries
    procurement/          Requests, purchase orders, supplier invoices, payments, returns
    quality/              Standards, inspections, quarantine, corrective actions
    sorting/              Fabric lots and sorting sessions
    decolorization/       Chemicals, tanks, issues, sessions
    drying/               Dryers and drying sessions
    sales/                Customers, orders, dispatch, payments
    inventory/            Dried-stock ledger, reservations, adjustments
    reports/              Report data and Excel exports
    audit/                Audit log (model, ViewSet mixin, API)
    notifications/        Email alerts (signals) and scheduled reports
  manage.py
  setup_fresh.py          Creates a fresh database with a Test_User admin
  requirements.txt
  .env.example
frontend/                 Web app (Next.js + TypeScript)
  src/
    app/                  Routes: login, (app)/<module>, api/ (session + Django proxy)
    features/<module>/    Page, forms and schemas per module
    components/           common/ (tables, dialogs, charts, meters), layout/, ui/ (shadcn)
    lib/                  API client, data hooks, formatting; lib/server/ = session cookies
    config/access.ts      Role access per page and the sidebar menu
    proxy.ts              Route guard (login + role)
  e2e/                    Playwright browser tests and the README screenshot script
docs/
  UPGRADE_AUDIT.md        Upgrade audit and roadmap
  screenshots/            Images used in this README
docker-compose.yml        Full stack: db, backend, app, app-edge (nginx)
```

## Run with Docker (recommended)

This runs PostgreSQL, the API and the web app together. It needs Docker Desktop.

```bash
copy backend\.env.example backend\.env        # set SECRET_KEY (and email settings if wanted)
copy .env.docker.example .env                  # set POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec backend python setup_fresh.py         # first time: creates Test_User / Test@1234
docker compose exec backend python manage.py seed_demo_data   # optional: demo data
```

Open http://localhost:8080. The admin panel is at http://localhost:8080/admin/ and the API docs are at http://localhost:8080/api/docs/. To use a different port, set `APP_PORT` in `.env`. Database data is kept in the `pgdata` Docker volume.

## Run without Docker

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env            # then fill in SECRET_KEY, DB_PASSWORD, email settings
python manage.py migrate
python manage.py runserver
```

All secrets and environment settings live in `backend/.env`, which is never committed. Leave `EMAIL_HOST_USER` empty to print alert emails to the console instead of sending them.

Optional:

```bash
python setup_fresh.py             # fresh database with only Test_User / Test@1234
python manage.py seed_demo_data   # demo data (alert emails are not sent while seeding)
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local      # DJANGO_API_URL, SECURE_COOKIES
npm run dev -- -p 3001
```

Open http://localhost:3001.

The browser never talks to Django directly. The app's own server keeps the login in httpOnly cookies and forwards API calls to Django (`/api/django/...` → `/api/v1/...`), renewing the session when it expires. Set `NUM_PROXIES=1` in `backend/.env` so Django's login rate limit sees each user's real address.

## Demo logins

These logins exist after `python manage.py seed_demo_data`:

| Role | Username | Password | Sees |
|---|---|---|---|
| Admin | `admin` | `Admin@1234` | Everything |
| Warehouse supervisor | `warehouse_user` | `Demo@1234` | Warehouse, Purchasing, Quality |
| Sorting supervisor | `sorting_user` | `Demo@1234` | Sorting, Quality |
| Decolorization supervisor | `decolor_user` | `Demo@1234` | Decolorization, Quality |
| Drying supervisor | `drying_user` | `Demo@1234` | Drying, Quality |

Change these passwords, or don't seed demo data at all, on a real server.

## Tests

**Backend:**

```bash
cd backend
python manage.py test apps
```

**Frontend checks:**

```bash
cd frontend
npm run lint && npm run typecheck && npm run build
```

**Browser tests (Playwright):** these need Django on port 8000 with demo data, and the app running with `npm run build && npx next start -p 3001`. Install the browser once with `npx playwright install chromium`.

```bash
npm run e2e                  # all scenarios
npm run e2e -- sales         # only the named ones
```

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` or `upgrade/**` and on every pull request. It runs the backend tests against PostgreSQL, then lints, type-checks and builds the web app.

## Usage and API

| What | Local | Docker |
|---|---|---|
| Web app | http://localhost:3001/ | http://localhost:8080/ |
| API | http://127.0.0.1:8000/api/v1/ | via the app |
| API docs (Swagger) | http://127.0.0.1:8000/api/docs/ | http://localhost:8080/api/docs/ |
| Admin panel | http://127.0.0.1:8000/admin/ | http://localhost:8080/admin/ |

- The API docs are open when `DEBUG=True`. Otherwise, log in at `/admin/` as a staff user first.
- List endpoints return plain arrays. Add `?page=1` or `?page_size=50` to get paginated results.
- Sessions use short-lived access tokens that the app renews automatically. Logging out revokes the session.

## Business rules

### Stock

- **What can be sold:** only dried output. Completing a drying session adds its output weight (kg) to that fabric lot's stock.
- **Draft orders** aren't checked against stock.
- **Confirming** an order reserves its weight. It's refused if the lot doesn't have enough available (stock on hand minus what other confirmed orders have reserved).
- **Dispatches** take stock out. An order must be confirmed first. It can be dispatched in parts, but never more than was ordered. Cancelling an order releases whatever it still had reserved.
- **Ledger:** every stock change is a row in the ledger (`/api/v1/inventory/movements/`) that points to the drying session, dispatch or adjustment that caused it. Stock on hand is the sum of those rows. Editing or deleting a source record corrects the ledger automatically.
- **Corrections** (for example, after a physical count) are admin-only adjustments with a required reason: `POST /api/v1/inventory/movements/adjust/`.
- **Current figures per lot:** `/api/v1/inventory/movements/stock/`. The sales form's fabric list shows the available kg.
- **Customers:** buyers are kept as a customer list (`/api/v1/sales/customers/`). Typing a buyer name links the order to the matching customer, and a new name creates a new customer. Similar names can be reviewed with `python manage.py customer_duplicates` and merged by an admin.

### Purchasing

- **Flow:** purchase request → admin approval → purchase order → admin approval → deliveries → supplier invoice → payment.
- **Deliveries and orders:** a warehouse delivery can be booked against an open line of an approved order from the same supplier (the "Purchase order" field in the delivery form). Deliveries without an order work as before. The order becomes *Partially received* and then *Received* as weight arrives. Deliveries marked *Rejected* don't count.
- **Changes:** editing an approved order is an amendment. Its revision number goes up and it needs approval again. A line can't be reduced below what has already arrived.
- **Who does what:** admins and warehouse supervisors use Purchasing. Only admins approve, close orders and record supplier payments. A payment can't exceed what is still owed on the invoice.
- **API:** `/api/v1/procurement/` (requisitions, orders, open-lines, invoices, payments, returns, quotations, summary, supplier-performance, price-comparison).

### Quality

- **Standards:** an admin sets up checklists. Each check is either measured against a minimum and/or maximum (for example, moisture of at most 12%) or answered yes/no. A standard belongs to one stage and, optionally, one material.
- **Inspections:** deliveries are inspected as *Incoming*; fabric lots as *In-process* or *Finished*. The result is *Pass*, *Conditional* (accepted with a written condition) or *Fail* (with a reason). An inspection with a failed check can't be saved as Pass.
- **Quarantine:** a failed inspection holds its delivery or lot. Held material can't be sent to sorting, can't start a sorting, decolorization or drying session, and can't be confirmed or dispatched on a sales order. Material that was never inspected works as before.
- **Release:** only an admin releases material from quarantine, and must give a reason. A released inspection can't be changed afterwards.
- **Who inspects what:** warehouse supervisors inspect incoming material; sorting, decolorization and drying supervisors inspect in-process material; drying supervisors inspect finished product. Admins can do all of it. Only admins change a failed inspection or delete records.
- **Follow-up:** corrective and preventive actions can be added to an inspection, with a person responsible and a due date.
- **API:** `/api/v1/quality/` (standards, inspections, actions, summary).

### Consistency checks

```bash
python manage.py reconcile_inventory        # ledger vs. drying sessions/dispatches, negative stock, oversold orders
python manage.py customer_duplicates        # customers with near-identical names
```

## Roadmap

Production planning, finance, maintenance, HR, sustainability and document management are next. See [docs/UPGRADE_AUDIT.md](docs/UPGRADE_AUDIT.md) for the full roadmap and per-phase status.

## Author

Raja Faraz Tariq
