# Phase 1 — Project Audit and Upgrade Roadmap

Audit date: 2026-09-30 · Commit audited: `e075c65`

This is the Phase 1 deliverable from `Upgradation.txt`. No application code was changed during the audit.

> **Note:** File paths below refer to the layout at `e075c65`. Since then, the project has been restructured: Django apps now live in `backend/apps/<app>/`, `ERP_Backend/` became `backend/config/`, and `erp-frontend/` became `frontend/`, with pages in `frontend/src/features/`.
>
> **Phase 1 (done):** a 59-test suite pins current behaviour (access matrix for every endpoint and role, workflows in every module), and GitHub Actions runs it on PostgreSQL.
>
> **Phase 2 (done):**
> - **Deletes:** CASCADE replaced by PROTECT (D1), and blocked deletes return a readable 409.
> - **Audit log:** every write and workflow action is recorded (F3, F4), including user management and failed logins.
> - **Recorded-by fields:** sales order `created_by` is always the logged-in user (S5); received/dispatched/issued-by default to the logged-in user.
> - **Logins:** rate limited (S6).
> - **Sessions:** 30-minute access tokens with rotating, revocable refresh tokens (S7, apart from moving them out of localStorage, which is planned for the Next.js frontend).
> - **Passwords:** changes from the Users page work and are validated (S9).
> - **Alerts:** a low-stock email goes out once, when a chemical crosses the threshold.
> - **API:** opt-in pagination and no N+1 queries on list endpoints; Swagger docs; the `/api/v1/` prefix.
> - **Deployment:** Docker Compose (PostgreSQL, gunicorn, nginx), and production security settings controlled by env.
>
> **Phase 4 (done):** a new Next.js + TypeScript app in `frontend/` replaced the classic React app, which has been removed.
> - **Login and API access:** the login is held in httpOnly cookies by the app's own server (the rest of S7), which forwards API calls to `/api/v1/`, renews the session, and blocks cross-site writes.
> - **Role-aware layout** and shared components: data table, dialogs, and loading, empty and error states.
> - **All pages moved:** Dashboard, Warehouse, Sorting, Decolorization, Drying, Sales, Users, Reports (with the audit log).
> - **Docker:** the site is served at port 8080; its front server also routes `/admin/` and `/api/docs/` to Django.
> - **Verified:** browser tests (`npm run e2e`, 86 checks across 7 scenarios) pass locally and against the Docker stack.
>
> **Phase 3 (done):** decisions made with the owner: dried output is sellable; overselling is blocked; stock is reserved at Confirm and deducted at Dispatch; customers are merged on exact name matches.
> - **Stock ledger** (`apps/inventory`) kept in sync with drying sessions and dispatches (D2). Reservations are computed, not stored. Stock checks lock the fabric row (tested with concurrent requests on PostgreSQL).
> - **Sales:** can no longer oversell, and dispatches need a confirmed order (D7).
> - **Chemicals:** issuance edits and deletes restore stock (D4). Stock figures on fabric lots and chemicals can't be typed in directly anymore (D3).
> - **Process steps:** sorting, decolorization and drying completions are validated (D5, D6).
> - **Customer list** with automatic linking, a duplicate report and admin merge (D10); order total widened (D12).
> - **Migrations:** rehearsed on a demo-data database. Existing rows are unchanged (checksum-verified), rollback and re-apply work, and backup/restore was tested.
> - **Seed commands:** re-seeding works with delete protection in place, and demo lots get a labelled "Demo opening stock" adjustment.
> - **Still open:** D8. The `FabricStock.status` values are unchanged; sellable stock now comes from the ledger rather than the status.
>
> **Phase 0:** done: S1 (moved to env), S2, S3 (partly), S4, S10, F1, F2 (safe handlers only), D9, and duplicate code from F5. One follow-up came out of connecting the signals in F2: the demo seed commands triggered hundreds of alert emails, one per chemical issuance or payment. Seed commands now capture email instead of sending it (`apps/core/management/base.py`). The per-event alerts themselves still need throttling before production.

---

## 1. Current architecture

```
React 19 SPA (Create React App)  ──HTTP/JSON, Bearer JWT──►  Django 5.2 + DRF 3.17  ──►  PostgreSQL (ERP_DB)
erp-frontend/                                               ERP_Backend/ + 10 apps
```

**Backend**: this is a single Django project (`ERP_Backend`). It uses SimpleJWT auth (8 h access token, 7 d refresh token) with `IsAuthenticated` as the default permission, and role checks come from `core/permissions.py`. Settings come partly from `python-decouple`: `SECRET_KEY` and `DEBUG` are read from env, but the database and email credentials are hardcoded in `settings.py`.

**Pipeline modelled**: Warehouse `Stock` (a truck delivery) → `FabricStock` (the sortable quantity) → `SortingSession` → Decolorization `Tank` / `DecolorizationSession` → `DryingSession` → `SalesOrder` → `DispatchTracking` / `Payment`.

**Frontend**: CRA (`react-scripts 5.0.1`, which is no longer maintained), plain JavaScript, Tailwind 3, and react-router 6. There is one large page component per module (360–720 lines each), and every page fetches data with `useEffect`. TanStack Query is installed but never used. The API base URL is hardcoded to `http://127.0.0.1:8000/api/`.

**Tests**: none. Every `tests.py` is an empty stub.

**Infrastructure**: none. There is no Docker setup, no CI, no deployment configuration and no backup tooling.

## 2. Existing modules and functionality

| App | Models | What works today |
|---|---|---|
| `users` | `CustomUser` (5 fixed roles) | Login by username or email, admin-only user CRUD, activate/deactivate |
| `warehouse` | `Vendor`, `FactoryUnit`, `Stock` | Record incoming truck deliveries (vendor, weights, vehicle, unit, status); date filters |
| `sorting` | `FabricStock`, `SortingSession` | Create fabric lots, run sorting sessions, complete with sorted and waste kg |
| `decolorization` | `ChemicalStock`, `Tank`, `ChemicalIssuance`, `DecolorizationSession` | Chemical stock, tank lifecycle, chemical issuance with stock deduction, sessions |
| `drying` | `Dryer`, `DryingSession` | Dryer status, drying sessions linked to decolorization output, efficiency % |
| `sales` | `SalesOrder`, `DispatchTracking`, `Payment` | Orders with auto total, confirm/cancel, dispatch and delivery, payments with auto payment status, summary |
| `reports` | — | Daily production, monthly sales and waste analysis as JSON plus Excel export |
| `audit` | `AuditLog`, `SoftDeleteMixin` | Field-level audit log through a viewset mixin; admin log viewer and Excel export |
| `notifications` | — | Email alert functions, scheduled-report commands, demo-data seeders |
| `core` | — | Central role-permission classes |

Frontend pages: Login, Home (animated landing page), Dashboard (admin), Warehouse, Sorting, Decolorization, Drying, Sales, Reports (including the audit log), Users. Dark mode is already implemented.

## 3. Bugs, security issues and technical limitations

Severity: **C** = critical, **H** = high, **M** = medium, **L** = low.

### 3.1 Security

| # | Sev | Finding | Location |
|---|---|---|---|
| S1 | **C** | A real Gmail address and **app password are committed** in source and are in public GitHub history | `ERP_Backend/settings.py:115-124` |
| S2 | **C** | DB password hardcoded in `settings.py` and committed again in `erp-frontend/.env`. A frontend `.env` is bundled into the browser build if it is ever prefixed `REACT_APP_` | `settings.py:69-78`, `erp-frontend/.env` |
| S3 | H | `ALLOWED_HOSTS = ['*']` and `DEBUG` defaults to `True`. No secure-cookie, HSTS or SSL settings | `settings.py:7-8` |
| S4 | H | New users **default to the `admin` role** at both model and serializer level, so omitting `role` creates an admin | `users/models.py:12`, `users/serializers.py:18` |
| S5 | H | Clients can set "who did it" fields (`created_by`, `received_by`, `dispatched_by`, `supervisor`, `issued_by`) because the frontend sends them from a user dropdown. Records can be attributed to anyone | `sales/serializers.py`, `Sales.jsx:537-590` |
| S6 | H | No login rate limiting or lockout. The login endpoint allows unlimited password guesses | `users/views.py:29` |
| S7 | M | JWT is stored in `localStorage` (readable by any XSS). The refresh token is stored but **never used**, so users are logged out after 8 h. No token blacklist, so logout doesn't revoke anything | `AuthContext.jsx`, `api/axios.js` |
| S8 | M | Every authenticated user can read every module, including all sales and payment data, full user list with emails, and all reports | `core/permissions.py` (the `SAFE_METHODS` branch), `reports/views.py` |
| S9 | M | The user-update endpoint lets an admin change `role` but silently ignores `password`, because `UserSerializer` has no password field, so password resets from the UI don't work | `users/views.py:131-141` |
| S10 | L | `.gitignore` is saved as **UTF-16**, which git can't parse, so it has no effect. 99 `__pycache__` files and `.idea/` are committed | `.gitignore` |

### 3.2 Correctness and data integrity

| # | Sev | Finding | Location |
|---|---|---|---|
| D1 | **C** | **`on_delete=CASCADE` everywhere**. Deleting one Vendor deletes all its Stock, FabricStock, sorting, decolorization and drying sessions, and sales orders with payments. Deleting a *user* deletes every sales order, payment and session they created | all `models.py` |
| D2 | H | **No inventory ledger.** Quantities are mutable fields (`remaining_quantity`, `remaining_stock`) edited in place, with no movement history, no transactions and no row locks. Two concurrent requests can double-deduct | `sorting/views.py:67-75`, `decolorization/views.py:87-93` |
| D3 | H | Clients can write `ChemicalStock.remaining_stock` and `FabricStock.remaining_quantity` directly through PUT, bypassing all stock logic | `decolorization/serializers.py`, `sorting/serializers.py` |
| D4 | H | Editing or deleting a `ChemicalIssuance` does not restore chemical stock, so stock drifts permanently | `decolorization/views.py:82` |
| D5 | H | Sorting: `quantity_sorted` isn't validated against `quantity_taken`, waste isn't deducted from remaining, and starting a session doesn't reserve quantity | `sorting/views.py:46-80` |
| D6 | H | Decolorization and drying `complete` save unvalidated strings. Output + waste can exceed input, and negative values are accepted | `decolorization/views.py:110`, `drying/views.py:80` |
| D7 | H | **Sales never deducts stock.** You can sell more kg than exist, and nothing checks overpayment or payments on cancelled orders | `sales/views.py` |
| D8 | M | The `FabricStock.status` meaning is overloaded. Decolorization completion sets it to `"Sent to Decolorization"`, and drying completion sets it back to `"Sorted"` ("ready to sell"). Status alone can't tell where material is | `decolorization/views.py:127`, `drying/views.py:97` |
| D9 | M | `validate()` indexes `data['field']` directly, so every PATCH that omits the field returns **HTTP 500** (KeyError) | all module `serializers.py` |
| D10 | M | Customers are free text (`buyer_name`), with no customer master, so duplicates and typos split balances | `sales/models.py:21` |
| D11 | M | `SortingSession.unit` is a free `CharField`, but `Stock.unit` is an FK to `FactoryUnit` | `sorting/models.py:46` |
| D12 | M | `total_price` is `max_digits=10` and is calculated twice, once in float in the view and once in Decimal in the model | `sales/views.py:88`, `sales/models.py:53` |

### 3.3 Silent failures

| # | Sev | Finding | Location |
|---|---|---|---|
| F1 | **C** | **A fresh install cannot start.** `openpyxl` is imported but not in `requirements.txt`, so `manage.py check` crashes. `psycopg2-binary==2.9.9` has no wheel for Python 3.14 and fails to install. *Both verified in a clean virtualenv on this machine.* | `requirements.txt` |
| F2 | H | **Notification signals are never connected.** `NotificationsConfig.ready()` doesn't import `signals.py`, so none of the email alerts or auto-status updates ever run | `notifications/apps.py` |
| F3 | H | **Audit logging is bypassed** for sales orders, stock, payments, chemical issuances and tanks, because those viewsets override `create`/`perform_create` without calling the audit mixin | `sales/views.py:84,290`, `warehouse/views.py:95`, `decolorization/views.py:40,87` |
| F4 | M | Custom actions (`confirm`, `cancel`, `complete`, `start`, `mark_delivered`, …) are never audited | all `views.py` |
| F5 | L | `notifications/views.py` (744 lines) is an unrouted copy of `reports/views.py`. `audit/urls.py` is broken and unused. `warehouse/`, `sales/` and `drying/permissions.py` duplicate `core/permissions.py` | — |
| F6 | L | Hardcoded thresholds: chemical low stock `< 50`, warehouse low stock `1000 kg`, chemical low `25 %` | `decolorization/views.py:23`, `notifications/tasks.py:37-38` |

### 3.4 Performance and architecture

- No pagination on any list endpoint except the audit log. Every page downloads full tables.
- Serializers read related names (`vendor.name`, `supervisor.username`), but querysets don't use `select_related`, so every list endpoint has N+1 queries.
- Date-filter code is copy-pasted four times (`warehouse/views.py`, and three times in `sales/views.py`).
- Business logic sits in views. There is no service layer, so workflow rules can't be reused or tested.
- Frontend: no TypeScript, no shared table or form components, no error handling beyond `alert()`, and `window.confirm` is used for deletes.

## 4. Proposed technology stack

| Layer | Recommendation | Compatibility notes |
|---|---|---|
| Python | 3.13 (3.12 minimum) | Supported by Django 5.2. Pin it in Docker so development and production match; this machine has 3.14 |
| Django | **5.2 LTS, latest patch** | Already on 5.2, so no breaking changes. LTS is supported until April 2028. Move to 6.x later as its own step, not together with the rest |
| DRF / SimpleJWT | DRF 3.17.x, SimpleJWT 5.5.x + `token_blacklist` | Already current. Enable refresh rotation and a blacklist |
| DB driver | `psycopg[binary]` 3.x | Replaces `psycopg2-binary` and fixes F1 |
| New backend libraries | `django-environ`, `drf-spectacular` (OpenAPI), `django-filter`, `django-celery-beat`, Celery + Redis, `django-simple-history` (optional), `pytest-django`, `factory-boy` | All stable. Channels deferred until real-time is needed; polling via TanStack Query is enough at first |
| Frontend | Next.js (latest stable App Router release, pinned at implementation time), TypeScript, Tailwind, shadcn/ui, TanStack Query + Table, React Hook Form + Zod, Recharts, Lucide | Built as a **new app next to the CRA app**, not a rewrite in place (see §8) |
| Infrastructure | Docker Compose (postgres, redis, api, worker, beat, web, nginx), Gunicorn, GitHub Actions (lint, test, build) | — |

## 5. Recommended business modules

In dependency order. Everything below extends existing tables where one exists.

1. **Master data**: units of measure, material categories and grades, and a Customer master. `Vendor` is extended into Supplier rather than duplicated.
2. **Inventory ledger**: warehouses and locations (extends `FactoryUnit`), batches and lots, and an immutable `StockMovement` ledger with reservations, transfers and adjustments. *Everything else depends on this.*
3. **Procurement**: requisition, PO, goods receipt (the existing `Stock` becomes the GRN), and supplier invoices.
4. **Quality control**: inspections at receipt, in process and on finished goods, plus quarantine.
5. **Production**: configurable process stages. Existing sorting, decolorization and drying become stages under a production order, with BOM and costing.
6. **Chemicals**: extends `ChemicalStock` with lots, versioned recipes and planned vs. actual consumption.
7. **Sales**: quotations, stock reservation and deduction, invoices and returns (extends `SalesOrder`).
8. **Finance**: chart of accounts, double-entry journal, AR/AP, and P&L / balance sheet.
9. **Maintenance**: machine registry. Existing `Tank` and `Dryer` link to a common `Machine`, which adds work orders and downtime tracking.
10. **HR** (basic), **Sustainability**, **Documents**, **Notifications and approvals**, **Reporting**, and **AI** (optional, last).

## 6. Prioritized implementation roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Emergency fixes** (small, safe) | Rotate the Gmail app password (S1). Move all secrets to env (S2, S3). Fix `requirements.txt` (F1) and `.gitignore` (S10). Remove the admin default role (S4). Connect signals (F2). Fix PATCH 500s (D9) | Fresh clone installs and starts from the README; no secrets in the tree |
| **1 — Safety net** | pytest setup, factories, and tests that pin current workflows (sorting complete, chemical issuance, payment status) before changing them. GitHub Actions CI | CI green on the current behaviour |
| **2 — Foundation** | Docker Compose, `django-environ`, drf-spectacular, `/api/v1/` alongside the current routes, pagination, filters, `select_related`, a service layer. Change `CASCADE` to `PROTECT` (D1). Server-set actor fields (S5), login throttling (S6), refresh rotation (S7). Fix the audit bypass (F3, F4) | API docs published; existing frontend still works unchanged |
| **3 — Core integrity** | Inventory ledger with backfill (D2–D7), status model cleanup (D8), Customer master (D10), transaction-safe stock services with row locks | Ledger balances match current quantities for every record |
| **4 — New frontend shell** | Next.js + TS app with design system, auth, layout, sidebar and permission-aware navigation. Migrate modules one at a time: Warehouse → Sorting → Decolorization → Drying → Sales → Users → Reports | Each migrated page reaches parity; CRA retired only after all pages are done |
| **5 — New modules** | In the order of §5, items 3–10 | Per-module tests and docs |
| **6 — Analytics and automation** | Executive dashboard, report centre, Celery-scheduled reports, approval workflows, traceability | — |
| **7 — AI (optional) and production readiness** | Security review, load tests, backup and restore drill, deployment guide | — |

## 7. Database changes and migration risks

| Change | Risk | Mitigation |
|---|---|---|
| `CASCADE` → `PROTECT` on all business FKs | Low. It changes the constraint, not the data. Deletes that used to cascade will now be refused | Soft delete (`SoftDeleteMixin` already exists) on business records |
| Remove `default='admin'` on `role` | None for existing rows | New default `None`, or the least-privileged role |
| New `Customer` table, backfilled from distinct `buyer_name` | **Medium.** Fuzzy duplicates ("Ali Traders" vs "Ali Traders ") | Exact-match backfill after trimming whitespace and ignoring case; a review report of possible duplicates for a human to merge. `buyer_name` stays untouched |
| New `StockMovement` ledger, backfilled from `Stock`, `SortingSession`, `ChemicalIssuance`, … | **High.** Current quantities have already drifted (D3, D4, D5) | Backfill creates an **opening-balance movement per record equal to its current quantity**, so no history is reconstructed or invented. A reconciliation report lists discrepancies |
| `FabricStock.status` overload (D8) | **Medium.** For `"Sorted"` rows, "sorted" and "dried, ready to sell" can't be told apart from the status | Derive the true stage from related sessions (a completed `DryingSession` exists → dried). Keep the old column until verified |
| `SortingSession.unit` text → FK | Low–medium. Values that don't match a `FactoryUnit` | Add a nullable FK next to the text column, map exact matches, report the rest |
| Role model → permission groups | Low | Map each of the 5 current roles to an equivalent group; users keep exactly their current access |
| `total_price` precision increase | None (widening only) | — |

Every schema change is additive first: add, backfill, verify, and only then deprecate. Nothing is dropped in the same release it is replaced. A `pg_dump` is taken before each migration batch, and each data migration gets a reverse function or a documented restore path.

## 8. How existing features and data are preserved

1. **No destructive migrations.** Columns and tables are never dropped or renamed in the same step that replaces them, and no data is rewritten without an explicit approval checkpoint.
2. **Tests before changes.** Phase 1 records current workflow behaviour as tests, so regressions show up.
3. **Versioned API.** Current routes stay working while `/api/v1/` is introduced. The existing React app keeps running against them until the new frontend reaches parity.
4. **Frontend strangler pattern.** The Next.js app is built next to `erp-frontend/` and pages move one by one. The old app is removed only after every page has been migrated and verified.
5. **Backups.** Every migration batch is preceded by a `pg_dump`, and the restore procedure is tested.
6. **Small checkpoints.** Each phase ends with the app runnable and a short summary of what changed.

---

## Decisions needed before Phase 0/1

1. **Existing data**: is there a real database with production records (the local `ERP_DB`, or a server)? The migration strategy in §7 depends on it.
2. **Credential rotation**: the Gmail app password in S1 is public on GitHub. It must be revoked in the Google account; removing it from the file does not remove it from git history.
3. **Git workflow**: work on a local branch, push to the GitHub repo, or push to a fork?
4. **Frontend approach**: confirm a parallel Next.js app (recommended) versus upgrading the CRA app in place.
