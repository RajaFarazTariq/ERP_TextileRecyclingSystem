# Architecture

This page explains how the system is put together: the four running parts, how a click in the browser reaches the database and comes back, how sign-in works, and where the code lives. The first three sections are for administrators. The rest is for developers.

## On this page

- [The four parts](#the-four-parts)
- [How a request travels](#how-a-request-travels)
- [Sign-in and sessions](#sign-in-and-sessions)
- [Backend layout](#backend-layout)
- [Frontend layout](#frontend-layout)
- [Shared building blocks](#shared-building-blocks)
- [Things that run by themselves on a request](#things-that-run-by-themselves-on-a-request)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## The four parts

**For administrators.** The system is four programs that run side by side. With Docker, each one is a "service" in `docker-compose.yml`.

| Part | Service name | What it does | Keeps data? |
|---|---|---|---|
| Front server (nginx) | `app-edge` | The only part that listens on a network port. It passes each request to the web app or to the API. | No |
| Web app (Next.js) | `app` | Draws the screens. It also holds each person's sign-in and passes their requests to the API. | No |
| API (Django) | `backend` | Holds every rule and calculation. Reads and writes the database. Stores uploaded files. | Uploaded files, in the `media` volume |
| Database (PostgreSQL) | `db` | Stores all records. | Yes, in the `pgdata` volume |

Two facts follow from this layout:

- The browser never talks to the API directly. Every data request goes through the web app, which adds the person's sign-in to it.
- Every rule is checked in the API. The web app hides buttons a person may not use, but the API refuses the action whatever the screen shows.

```
                      Browser
                         |
                         v
        +----------------------------------+
        |  app-edge  (nginx, port 8080)    |
        +----------------------------------+
           |                          |
           | everything else          | /admin/  /api/docs/  /api/schema/
           v                          | /api/health/  and their static files
  +-------------------+               |
  |  app (Next.js)    |               |
  |  port 3000        |               |
  +-------------------+               |
           |                          |
           | /api/django/<path>       |
           | becomes /api/v1/<path>/  |
           v                          v
        +----------------------------------+
        |  backend (Django + gunicorn)     |-----> media volume
        |  port 8000                       |       (uploaded documents)
        +----------------------------------+
                         |
                         v
        +----------------------------------+
        |  db (PostgreSQL 16)              |-----> pgdata volume
        +----------------------------------+
```

The port `8080` is the default. It is set by `APP_PORT` (see [Configuration](11-configuration.md)). Ports 3000, 8000 and the database port are only reachable inside Docker.

## How a request travels

**For administrators.** Here is what happens when someone presses **Save** on a form.

1. The browser sends the form to the web app, at an address that starts with `/api/django/`.
2. nginx receives it and hands it to the web app. nginx also notes the visitor's real network address, so the login limit and the audit log can use it.
3. The web app checks that the request came from its own pages. It reads the sign-in from the browser's cookies and adds it to the request.
4. The web app forwards the request to the API at `/api/v1/...`.
5. The API checks, in this order: who is signed in, whether that person's pages allow this request, and the rule of this particular action (for example, a duty).
6. The API checks the data, saves it to the database, and writes an audit log entry.
7. The answer travels back the same way. The screen shows a short message such as "Order updated." or the error text the API returned.

**For developers.** The same path with file names:

| Step | Where |
|---|---|
| Browser call | `frontend/src/lib/api.ts` `api()` fetches `/api/django/<path>`. The hooks in `frontend/src/lib/crud.ts` wrap it. |
| Edge routing | `frontend/nginx.edge.conf`. One `location` sends `/admin/`, `/api/docs/`, `/api/schema/`, `/api/health/` and `/static/(admin|rest_framework|drf_spectacular_sidecar)/` to `backend:8000`. Everything else goes to `app:3000`. `X-Forwarded-For` is overwritten with the visitor's address. |
| Proxy to Django | `frontend/src/app/api/django/[...path]/route.ts`. Refuses cross-site requests (`isSameOrigin`), refuses paths containing `..` or `\`, builds `DJANGO_API_URL + path + "/" + query`, and sends `Authorization: Bearer <access token>`. |
| Headers passed on | `frontend/src/lib/server/forward.ts`: the last `X-Forwarded-For` entry and the `User-Agent`. |
| Django middleware | `MIDDLEWARE` in `backend/config/settings.py`. The last one, `apps.audit.middleware.AuditMiddleware`, keeps the current request where other code can find it. |
| URL routing | `backend/config/urls.py`. The same module URLs are mounted at `/api/v1/` and at `/api/`. |
| Authentication | `rest_framework_simplejwt.authentication.JWTAuthentication` (the default in `REST_FRAMEWORK`). |
| Page access check | `apps.access.services.check_api_access`, hooked in by `backend/apps/access/apps.py`. |
| The view's own rule | `permission_classes` on the view, plus checks in the serializer or service. |
| Saving and audit | `AuditedModelMixin` in `backend/apps/audit/middleware.py`. |
| Errors | `backend/apps/core/exceptions.py`. |
| Response headers passed back | `content-type`, `content-disposition` and `cache-control` only (enough for Excel and file downloads). |

```
Browser            app (Next.js)                      backend (Django)
   |                    |                                    |
   |-- /api/django/x -->|                                    |
   |                    | same-origin check                  |
   |                    | read erp_access cookie             |
   |                    |-- /api/v1/x/  + Bearer token ----->|
   |                    |                                    | authenticate (JWT)
   |                    |                                    | page access check
   |                    |                                    | view permission
   |                    |                                    | validate, save, audit
   |                    |<----------- answer ----------------|
   |                    | if 401: renew token once, retry    |
   |<----- answer ------|                                    |
```

## Sign-in and sessions

**For administrators.** What a person experiences:

- They sign in with their username or their e-mail address, and their password.
- They stay signed in while they keep using the system. After seven days without any use, they must sign in again.
- **Sign out** ends the session at once, on the server too.
- Too many sign-in attempts from one network address are refused for a short time. The default limit is 10 per minute.
- If an admin changes what a person may open, the change applies on the next page that person opens. An open tab also checks again every minute.

There is no password-reset e-mail and no two-step sign-in. An admin sets a new password under **Users**. See [Users](07-modules/users.md) and [Security](13-security.md).

**For developers.** The session uses two JSON Web Tokens issued by Django and kept in cookies that browser scripts cannot read.

| Cookie | Holds | Lifetime | Set in |
|---|---|---|---|
| `erp_access` | Access token. Sent to Django as `Authorization: Bearer`. | 30 minutes | `frontend/src/lib/server/session.ts` |
| `erp_refresh` | Refresh token. Used to get a new access token. | 7 days | same |
| `erp_user` | The user as JSON: id, username, email, role, role label, duties, pages and levels. Used to draw the menu and guard routes. | 7 days | same, and `frontend/src/proxy.ts` |

All three are `httpOnly`, `SameSite=Lax`, path `/`, and `Secure` when `SECURE_COOKIES=true`.

Token settings are in `SIMPLE_JWT` in `backend/config/settings.py`:

| Setting | Value |
|---|---|
| `ACCESS_TOKEN_LIFETIME` | `ACCESS_TOKEN_MINUTES` minutes, default 30 |
| `REFRESH_TOKEN_LIFETIME` | 7 days (fixed in code) |
| `ROTATE_REFRESH_TOKENS` | `True`: each renewal returns a new refresh token |
| `BLACKLIST_AFTER_ROTATION` | `True`: the old refresh token stops working |

The steps:

1. **Sign in.** The login form posts to `/api/auth/login` (`frontend/src/app/api/auth/login/route.ts`). The route forwards the body to Django `users/login/` with the visitor's address.
2. **Django checks.** `LoginView` in `backend/apps/users/views.py` finds the user by username or e-mail, ignoring case. It checks the password and that the account is active. It writes a `LOGIN` or `LOGIN_FAILED` audit entry. It is rate limited with the throttle scope `login`.
3. **Answer.** Django returns `token` (access and refresh) and `user` (id, username, email, role, `role_label`, `duties`, `pages`, `levels`). The route stores them in the three cookies and returns only `user` to the browser.
4. **Each API call.** The proxy route adds the access token. If the access cookie has expired, it first renews the tokens with the refresh token. If Django answers 401, it renews once and retries. If that fails, it clears the cookies and returns 401. `api()` then sends the browser to `/login?next=<page>`.
5. **Each page load.** `frontend/src/proxy.ts` is the route guard. With no refresh cookie it redirects to `/login?next=...`. Otherwise it asks Django `access/me/` for the user's pages (with a 2.5 second limit), compares them with the cookie, updates the cookie if they changed, and redirects to `/` when the user may not open the page. Link prefetches use the cookie only.
6. **Open tabs.** `useSession` (`frontend/src/features/auth/use-session.ts`) calls `/api/auth/me` every 60 seconds and when the window gets focus. `AccessSync` (`frontend/src/components/layout/access-sync.tsx`) redraws the menu, or leaves a page the user may no longer open.
7. **Sign out.** `/api/auth/logout` posts the refresh token to Django `users/logout/`, which blacklists it, and clears the cookies.

Cross-site protection: the routes under `frontend/src/app/api/` reject any request that changes data unless its `Origin` header matches the site's own host (`isSameOrigin` in `session.ts`).

What pages, levels and duties mean, and how they are changed, is explained in [Access control](05-access-control.md).

## Backend layout

**For developers.** The backend is one Django project.

```
backend/
  manage.py
  setup_fresh.py        creates the first admin on a new database
  requirements.txt
  Dockerfile
  config/               project settings
    settings.py         every setting; values come from the environment
    urls.py             URL table
    wsgi.py, asgi.py    entry points (gunicorn uses wsgi)
  apps/                 one folder per app
  media/                uploaded documents (not in Git)
```

Each app follows the same shape where it applies: `models.py`, `serializers.py`, `views.py`, `urls.py`, `services.py` (the rules), `tests.py`, `admin.py`, `migrations/`, and `demo.py` (demo records for `seed_module_data`).

| App | URL prefix | What it is for |
|---|---|---|
| `users` | `users/` | The user model (`CustomUser` with a `role`), sign-in, sign-out, token renewal, user management. |
| `access` | `access/` | Roles, each role's pages and levels, per-person exceptions, duties, and the check that runs before every API view. |
| `warehouse` | `warehouse/` | Suppliers (`Vendor`), factory units, deliveries (`Stock`). |
| `sorting` | `sorting/` | Fabric lots (`FabricStock`) and sorting sessions. |
| `decolorization` | `decolorization/` | Chemicals, chemical lots, recipes, tanks, issuances, decolorization sessions. |
| `drying` | `drying/` | Dryers and drying sessions. |
| `inventory` | `inventory/` | The ledger of sellable (dried) stock, its rules, and the `reconcile_inventory` command. |
| `sales` | `sales/` | Customers, products, quotations, orders, dispatches, invoices, payments, returns. |
| `procurement` | `procurement/` | Purchase requests, purchase orders, supplier quotations, invoices, payments, returns. Also defines `NumberedModel`. |
| `quality` | `quality/` | Standards, inspections, quarantine, corrective actions. |
| `production` | `production/` | Stages, routings, bills of materials, production orders and their steps. |
| `finance` | `finance/` | Accounts, periods, tax rates, the journal, expenses, statements. |
| `maintenance` | `maintenance/` | Machines, preventive schedules, work orders, spare parts. |
| `sustainability` | `sustainability/` | Waste records, utility readings, targets. |
| `workforce` | `workforce/` | Departments, job roles, shifts, employees, attendance, leave, tasks. |
| `documents` | `documents/` | Document categories, documents and their file versions. |
| `search` | `search/` | Search across modules and the trace of a fabric lot. It has no tables of its own. |
| `alerts` | `alerts/` | Notification rules, the notification list, the approvals inbox, the e-mail digest. |
| `reports` | `reports/` | The three older reports with Excel export, the report centre, the executive figures. It has no tables. |
| `audit` | `audit/logs/` | The audit log table, the mixin that writes it, and its read-only API. |
| `notifications` | none | E-mail alerts and the daily and monthly report e-mails. It has no tables and no URLs. |
| `core` | none | Shared code: permissions, pagination, date filters, error format, health check, test helpers, seed commands. |

`backend/config/urls.py` also serves `/admin/` (the Django admin panel), `/api/health/`, `/api/schema/` and `/api/docs/`.

## Frontend layout

**For developers.** The web app is a Next.js project that uses the App Router.

```
frontend/
  package.json, next.config.ts, tsconfig.json, eslint.config.mjs
  nginx.edge.conf       config of the front server
  Dockerfile
  e2e/                  browser tests and the layout audit
  src/
    proxy.ts            route guard
    app/                routes
    features/           one folder per module
    components/         shared components
    lib/                helpers
    config/             menu and colours
    types/              TypeScript types of API data
    providers/          app-wide providers
    hooks/              small shared hooks
```

| Folder | What is in it |
|---|---|
| `src/app/layout.tsx` | The root layout: fonts and `AppProviders`. |
| `src/app/login/` | The sign-in page. |
| `src/app/(app)/` | Signed-in pages. `layout.tsx` draws the sidebar and header. `page.tsx` is the home page. Each `<route>/page.tsx` is a thin file that sets the page title and renders the feature's page component. |
| `src/app/api/auth/` | `login`, `logout` and `me` routes: the session. |
| `src/app/api/django/[...path]/` | The proxy to the Django API. |
| `src/features/<module>/` | The module's page component, its forms, and `schemas.ts` (Zod form rules). `features/auth` holds the login form and the session hooks. |
| `src/components/common/` | Shared building blocks (see below). |
| `src/components/layout/` | Sidebar, header, command menu, notifications bell, theme toggle, `nav-icon.tsx`, `access-sync.tsx`. |
| `src/components/ui/` | Base controls from shadcn/ui (button, input, select, sheet, table, tabs and so on). |
| `src/lib/` | `api.ts` (API client), `crud.ts` (data hooks), `download.ts` (file downloads), `format.ts`, `forms.ts`, `series.ts`, `tones.ts` (colour classes), `utils.ts` (`cn`). `lib/server/` holds server-only code: `session.ts` and `forward.ts`. |
| `src/config/` | `access.ts` (the menu `NAV`, `canAccess`, `navFor`) and `nav-tones.ts` (each module's colour). |
| `src/types/` | `api.ts` plus one file each for alerts, documents, finance, maintenance, reports, search, sustainability and workforce. |
| `src/providers/app-providers.tsx` | Theme (dark by default), TanStack Query client, tooltips, toasts. A 403 from any change is shown as a toast. |
| `src/hooks/` | `use-count-up.ts`, `use-mobile.ts`. |

The routes under `src/app/(app)/` are: `dashboard`, `approvals`, `traceability`, `warehouse`, `sorting`, `decolorization`, `drying`, `quality`, `production`, `maintenance`, `sustainability`, `procurement`, `sales`, `finance`, `documents`, `workforce`, `reports`, `users`.

## Shared building blocks

**For developers.**

### Backend

| Building block | File | What it gives you |
|---|---|---|
| `AuditedModelMixin` | `backend/apps/audit/middleware.py` | Add it in front of a DRF viewset. Create, update and delete are then written to the audit log inside the same transaction. `snapshot()` and `log_change()` log changes made in custom actions. `perform_create` and `perform_update` accept extra keyword arguments that are passed to `serializer.save()`. |
| `log_action` | `backend/apps/audit/models.py` | Writes one audit entry by hand, for views that do not use the mixin. |
| `AuditMiddleware`, `get_current_request` | `backend/apps/audit/middleware.py` | Keeps the current request in thread-local storage. The access check uses it as a per-request cache. The stock ledger uses it to record who caused a movement. |
| Permissions | `backend/apps/core/permissions.py` | `is_admin`, `has_duty`, `HasDuty(...)`, `has_page`, `can_edit`, `page_allows`, `HasPage(...)`, `SharedReadPermission`, and the per-module classes such as `IsWarehouseOrAdmin`. |
| `OptionalPageNumberPagination` | `backend/apps/core/pagination.py` | Lists are plain arrays unless the caller sends `page` or `page_size`. |
| `filter_by_date_params` | `backend/apps/core/filters.py` | One function for the date filter parameters used by many lists. |
| `api_exception_handler` | `backend/apps/core/exceptions.py` | Turns a blocked delete into a readable 409 answer. |
| `parse_kg`, `check_not_more_than_input` | `backend/apps/core/quantities.py` | Read a weight from request data, and check that output plus waste is not more than input. |
| `health` | `backend/apps/core/health.py` | The `/api/health/` check. |
| Test factories | `backend/apps/core/testing.py` | `make_user`, `client_for`, `make_stock`, `make_fabric`, `make_order`, `make_dried_stock` and others. |
| `SeedCommand` | `backend/apps/core/management/base.py` | Base class for the demo seed commands. It keeps alert e-mails in memory while seeding. |
| `NumberedModel` | `backend/apps/procurement/models.py` | An abstract model with a `number` field. On first save it sets `number` to `<PREFIX>-<id padded to 5 digits>`, for example `PO-00042`. Used by purchasing, quality, production, sales, finance, maintenance, workforce and documents. |

### Frontend

| Building block | File | What it gives you |
|---|---|---|
| `api`, `ApiError`, `errorMessage` | `src/lib/api.ts` | One fetch function for all API calls. `ApiError.fieldErrors` maps API errors to form fields. |
| `useList`, `useSave`, `useAction`, `useDelete` | `src/lib/crud.ts` | List a resource, create or update (POST or PATCH), run a workflow action (`POST <resource>/<id>/<action>`), delete. They refresh the affected lists and show a toast. |
| `DataTable` | `src/components/common/data-table.tsx` | The table used on every list, built on TanStack Table. |
| `FormDialog` | `src/components/common/form-dialog.tsx` | The form sheet that opens from the right. |
| `ConfirmDialog` | `src/components/common/confirm-dialog.tsx` | The delete confirmation. It shows the API's message when a delete is refused. |
| `DateFilter` | `src/components/common/date-filter.tsx` | The period picker that produces the date filter parameters. |
| `StatCard`, `Figure`, meters, `chart.tsx` | `src/components/common/` | Dashboard figures and charts. |
| `StatusBadge`, `RowActions`, `SelectField`, `PageHeader`, `SectionTitle`, `states.tsx` | `src/components/common/` | Status labels, row menus, select inputs, page headings, and the loading, empty and error states. |
| `identity.tsx`, `machine-card.tsx`, `pipeline-strip.tsx` | `src/components/common/` | Avatars, tank and dryer cards, the process strip. |
| `usePageAccess` | `src/features/auth/use-page-access.ts` | Tells a page whether the user holds it as view only, so it can hide add, edit and delete controls. |

## Things that run by themselves on a request

**For developers.** Four mechanisms act without the view asking for them. Know them before you change a model they watch.

### Page access check

`AccessConfig.ready()` in `backend/apps/access/apps.py` wraps `APIView.check_permissions` once, at start-up. Every DRF view then calls `check_api_access(request)` before its own permission classes. Because it is hooked in one place, a new module cannot forget it.

`check_api_access` in `backend/apps/access/services.py` does this:

1. If nobody is signed in, it does nothing. The view's own rules answer.
2. It reads the module from the path: `/api/v1/sales/orders/5/` is module `sales`. Paths under `health`, `docs` and `schema` are skipped.
3. It lets through the paths that every signed-in user may use (`OPEN_ANY`, and `OPEN_READS` for reading).
4. It looks up which pages use that module, in `PAGE_API`.
5. Reading needs one of those pages at any level. Changing needs one of them in full.
6. Otherwise it raises a 403 with one of two messages: "You have view-only access here, so you can look but not change anything." or "You do not have access to this part of the system. Ask an admin if you need it."

The view's own rules still apply after this check. The full explanation is in [Access control](05-access-control.md).

### Stock ledger

Sellable stock is never typed in. It is the sum of the rows in `inventory.StockMovement`. The signal handlers in `backend/apps/inventory/signals.py` keep those rows equal to their source records, however a record is saved (API, admin panel or seed command):

| When this is saved or deleted | The ledger gets |
|---|---|
| `drying.DryingSession` | Plus its output, once the session is `Completed`. |
| `sales.DispatchTracking` | Minus the dispatched weight. |
| `sales.SalesReturn` | Plus its weight, when it is `Approved` and marked to restock. |
| `sales.SalesOrder` (changed, not created) | Its dispatches and returns are synced again, in case the order moved to another lot. |

Each handler calls a `sync_*` function in `backend/apps/inventory/services.py`. The function compares what the source record implies with what is already posted for it and posts only the difference. So editing or deleting a source record corrects the ledger with a new row; old rows are not changed. Manual corrections go through `post_adjustment`. `python manage.py reconcile_inventory` checks the ledger against its sources (see [Deployment](12-deployment.md)).

### Finance journal sync

Finance does not use signals. `sync_operations` in `backend/apps/finance/services.py` rebuilds the automatic journal entries from their source records when one of these happens:

- any finance statement or summary is opened (`ReportView.get` in `backend/apps/finance/views.py`);
- `POST finance/journal/sync/` is called;
- an expense is created, changed or deleted;
- a period is closed;
- the executive figures are built (`backend/apps/reports/services.py`).

It posts what is missing, replaces what changed, and removes entries whose source record is gone. Entries dated in a closed period are left as they are and counted as `skipped_closed`.

| Source record | Journal entry |
|---|---|
| Sales invoice | Debit Receivable. Credit Sales and Sales tax. |
| Customer payment | Debit Cash or Bank. Credit Receivable. |
| Approved sales return | Debit Sales returns. Credit Receivable. |
| Supplier invoice | Debit Purchases and Purchase tax. Credit Payable. |
| Supplier payment | Debit Payable. Credit Cash or Bank. |
| Expense | Debit the expense account. Credit the account it was paid from. |

A payment with the method `Cash` uses the cash account; every other method uses the bank account. The accounts are found by their `system_key`. See [Finance](07-modules/finance.md).

### Other signals

| File | What it does |
|---|---|
| `backend/apps/procurement/signals.py` | When a delivery (`Stock`) is saved or deleted, the status of its purchase order is refreshed. When a supplier payment is saved or deleted, the invoice status is refreshed. |
| `backend/apps/notifications/signals.py` | Sends an e-mail to `MANAGEMENT_EMAIL` when a sales order becomes `Completed`, when a dispatch becomes `Dispatched`, and when a customer payment is recorded. It also recalculates the order's payment status when a payment is saved or deleted. |
| `backend/apps/documents/models.py` | Removes the stored file after a document version is deleted. |

## Keeping this page up to date

- Revise the parts and the request path when `docker-compose.yml`, `frontend/nginx.edge.conf` or `frontend/src/app/api/django/[...path]/route.ts` change.
- Revise the sign-in section when `frontend/src/lib/server/session.ts`, `frontend/src/proxy.ts`, `frontend/src/app/api/auth/*`, `backend/apps/users/views.py` or `SIMPLE_JWT` in `backend/config/settings.py` change.
- Revise the app table when an app is added to `INSTALLED_APPS` or `backend/config/urls.py`, and the frontend tables when a folder is added under `frontend/src/`.
- Revise the last section when `backend/apps/access/apps.py`, `backend/apps/access/services.py`, `backend/apps/inventory/signals.py`, `backend/apps/finance/services.py` or any `signals.py` change.
