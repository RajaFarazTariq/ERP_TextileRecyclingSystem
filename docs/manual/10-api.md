# API

This page describes the rules every API endpoint follows and lists the endpoints of each app. It is for developers and for anyone connecting another program to the system. Administrators only need the first section.

## On this page

- [What the API is](#what-the-api-is)
- [Base paths](#base-paths)
- [Authentication](#authentication)
- [Who may call what](#who-may-call-what)
- [Lists and pagination](#lists-and-pagination)
- [Date filter parameters](#date-filter-parameters)
- [Numbers and dates](#numbers-and-dates)
- [Errors](#errors)
- [Interactive documentation](#interactive-documentation)
- [Endpoints](#endpoints)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## What the API is

**For administrators.** The API is the part of the system that holds the data and the rules. The web app is one user of it. Everything a person does on a screen is a call to the API, and the API checks every call again. Nothing can be done through the web app that the API does not allow, and nothing extra can be done by calling the API directly.

**For developers.** The API is built with Django REST Framework. Routes are defined in `backend/config/urls.py` and in each app's `urls.py`. Most resources are viewsets registered on a router.

## Base paths

| Path | What is there |
|---|---|
| `/api/v1/` | Every module endpoint. The web app uses this. |
| `/api/` | The same endpoints again, for older clients. |
| `/api/health/` | The health check. No sign-in needed. |
| `/api/schema/` | The OpenAPI description. |
| `/api/docs/` | The Swagger page. |
| `/admin/` | The Django admin panel. |

In this page, endpoint paths are written without the base, for example `sales/orders/`. The full path is `/api/v1/sales/orders/`.

Every path ends with a slash.

In the Docker setup, only `/admin/`, `/api/docs/`, `/api/schema/` and `/api/health/` reach Django from outside. Other programs cannot call `/api/v1/` through the front server; that path belongs to the web app, which serves its own proxy at `/api/django/<path>` for signed-in browsers. To call the API directly from another program, that program must be able to reach the `backend` service itself. See [Architecture](02-architecture.md).

## Authentication

The API uses JSON Web Tokens (`rest_framework_simplejwt`).

1. `POST users/login/` with `{"username": "...", "password": "..."}`. The username field also accepts the e-mail address.
2. The answer contains `token.access`, `token.refresh` and `user`.
3. Send `Authorization: Bearer <access token>` with every call.
4. The access token lasts 30 minutes by default (`ACCESS_TOKEN_MINUTES`). Get a new pair with `POST users/token/refresh/` and `{"refresh": "..."}`. The refresh token lasts 7 days. Each renewal returns a new refresh token and the old one stops working.
5. `POST users/logout/` with `{"refresh": "..."}` revokes the refresh token.

Sign-in is rate limited per client address: 10 attempts per minute by default (`LOGIN_RATE_LIMIT`). Over the limit the answer is `429`.

Every endpoint needs a signed-in user, except `users/login/`, `users/logout/`, `users/token/refresh/` and `/api/health/`.

## Who may call what

Two checks run on every call from a signed-in user.

**1. The page check.** A module's endpoints belong to the pages that use them. Reading needs one of those pages at any level. Changing needs one of them in full. Admins have every page in full. This check is in `backend/apps/access/services.py` (`PAGE_API`, `check_api_access`). How pages, levels and exceptions work is explained in [Access control](05-access-control.md).

| Endpoints under | Pages that may read | Pages that may change |
|---|---|---|
| `warehouse/` | Warehouse, Sorting, Quality, Production, Purchasing, Dashboard | Warehouse |
| `sorting/` | Sorting, Quality, Production, Sustainability, Sales, Dashboard | Sorting |
| `decolorization/` | Decolorization, Production, Maintenance, Dashboard | Decolorization |
| `drying/` | Drying, Dashboard | Drying |
| `drying/dryers/` | Drying, Dashboard, Maintenance | Drying |
| `sales/` | Sales, Dashboard | Sales |
| `inventory/` | Sales, Dashboard | Sales |
| `procurement/` | Purchasing | Purchasing |
| `procurement/open-lines/` | Purchasing, Warehouse | (read only) |
| `quality/` | Quality | Quality |
| `production/` | Production | Production |
| `finance/` | Finance | Finance |
| `maintenance/` | Maintenance | Maintenance |
| `sustainability/` | Sustainability | Sustainability |
| `workforce/` | Workforce | Workforce |
| `documents/` | Documents | Documents |
| `search/trace/` | Traceability | (read only) |
| `alerts/` | Approvals, Dashboard | Approvals |
| `reports/` | Reports, Dashboard | (read only) |
| `audit/` | Reports, Dashboard | (read only) |
| `users/`, `access/` | Users | Users |

These reads are open to every signed-in user, whatever their pages: `users/list/`, `users/detail/<id>/`, `access/me/`, `access/role-names/`, `alerts/notifications/`, `search/`, and `audit/logs/`. The notifications, the search and the audit log limit what they return to what the user may see.

**2. The endpoint's own rule.** After the page check, the view applies its own rule. In the tables below this is the column "Extra rule". "None" means the page check is the only rule. A duty is written as *Approve purchases* and so on; duties and who carries them at the start are explained in [Access control](05-access-control.md). "Admin only" means the code checks for the Admin role itself.

A refused call returns `403` with a `detail` message.

## Lists and pagination

List endpoints return a plain JSON array of every record by default. Paging is optional (`backend/apps/core/pagination.py`):

| Parameter | Effect |
|---|---|
| `page=<n>` | Turns paging on and returns page `n`. |
| `page_size=<n>` | Turns paging on. Default size is 50, the largest allowed is 500. |

A paged answer has the shape `{"count": ..., "next": ..., "previous": ..., "results": [...]}`.

Exceptions:

- `audit/logs/` is always paged: 50 per page by default, 200 at most.
- `sales/invoices/` always returns a plain array.

## Date filter parameters

Many lists and reports accept the same period parameters (`backend/apps/core/filters.py`). The tables below mark these endpoints with "date filter" and name the field the filter applies to.

| Parameter | Example | Meaning |
|---|---|---|
| `date_filter` | `today`, `this_week`, `this_month`, `this_year` | A named period. `this_week` starts on Monday. |
| `year` | `2026` | The whole year. |
| `month` | `2026-03` | The whole month. |
| `start` | `2026-01-01` | From this day. |
| `end` | `2026-03-31` | Up to and including this day. |

Parameters can be combined. On list endpoints a value that cannot be read is ignored without an error. The report centre and the finance statements are stricter: a bad date returns `400` with "Enter a date as YYYY-MM-DD.".

## Numbers and dates

- Decimal fields of a record (weights, prices, amounts) are returned as strings, for example `"1250.00"`. Send them as strings or numbers.
- Calculated amounts are also returned as strings with two decimals in the newer modules (purchasing figures on records, quality, production, finance, maintenance, sustainability, workforce, documents, sales statements, report centre).
- A few older summary endpoints return plain numbers: `sales/orders/summary/`, the three reports under `reports/daily-production/`, `reports/monthly-sales/` and `reports/waste-analysis/`, and the purchasing and production dashboard summaries.
- Dates are `YYYY-MM-DD`. Date-times are ISO 8601. The server's time zone is `Asia/Karachi`.

## Errors

| Status | When | Body |
|---|---|---|
| `400` | The data is not valid, or a business rule refuses the action. | Field errors: `{"field": ["message"]}`. Errors not tied to a field: `{"non_field_errors": ["message"]}` or a list of messages. |
| `401` | Not signed in, or the access token has expired. | `{"detail": "..."}` |
| `403` | Signed in but not allowed. | `{"detail": "..."}` |
| `404` | The record does not exist, or the user may not see it. | `{"detail": "..."}` |
| `409` | A delete is blocked because other records depend on the record. | `{"detail": "This record cannot be deleted because other records depend on it: <kinds>."}` |
| `429` | Too many sign-in attempts. | `{"detail": "..."}` |

The `409` answer comes from `backend/apps/core/exceptions.py`. Everything else is Django REST Framework's standard format.

A few older views use other keys: `{"error": "..."}` (for example the three older reports, `users/register/`, `users/toggle-active/`, `audit/logs/summary/`, the drying actions) or `{"message": "..."}` (for example "Session already completed."). A client should read `detail` first, then the other keys. The web app does this in `errorMessage` in `frontend/src/lib/api.ts`.

## Interactive documentation

`/api/docs/` shows every endpoint with its fields and lets you try calls. `/api/schema/` returns the same description as an OpenAPI file. Both are built by drf-spectacular from the code, so they are always current.

Who can open them (`SPECTACULAR_SETTINGS` in `backend/config/settings.py`):

| Setting | Who |
|---|---|
| `DEBUG=True` (development) | Anyone. |
| `DEBUG=False` (production) | Only users with Django's "staff" flag. Sign in at `/admin/` first, then open `/api/docs/`. |

The Swagger page loads its scripts from a public address (`cdn.jsdelivr.net`, the library's default), so the browser needs internet access to show it.

The staff flag is not the same as the Admin role. The first admin made by `setup_fresh.py` has it. Users created on the **Users** page do not, even with the Admin role. The flag can be set in the admin panel at `/admin/`.

## Endpoints

"Standard set" means the five usual calls on a resource:

| Method | Path | Does |
|---|---|---|
| `GET` | `<resource>/` | List |
| `POST` | `<resource>/` | Create |
| `GET` | `<resource>/<id>/` | Read one |
| `PUT`, `PATCH` | `<resource>/<id>/` | Change |
| `DELETE` | `<resource>/<id>/` | Delete |

Workflow actions are `POST <resource>/<id>/<action>/`.

### Users (`users/`)

File: `backend/apps/users/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `POST` | `users/login/` | Sign in. Returns tokens and the user with role, duties, pages and levels. | Open. Rate limited. |
| `POST` | `users/logout/` | Revoke a refresh token. Always answers `205`. | Open. |
| `POST` | `users/token/refresh/` | Exchange a refresh token for a new pair. | Open. |
| `POST` | `users/register/` | Create a user. The password must pass Django's password rules. | Admin only. |
| `GET` | `users/list/` | List all users (id, username, email, role, role label, active, last login). | Any signed-in user with a known role. |
| `GET` | `users/detail/<id>/` | Read one user. | Any signed-in user. |
| `PUT`, `PATCH` | `users/detail/<id>/` | Change a user. A blank password keeps the current one. | Admin only. Refused: deactivating yourself, changing your own role, removing the last active admin. |
| `DELETE` | `users/detail/<id>/` | Delete a user. | Admin only. Refused: deleting yourself, deleting the last active admin. |
| `POST` | `users/toggle-active/<id>/` | Switch a user between active and inactive. | Admin only. Same refusals. |

### Access (`access/`)

File: `backend/apps/access/views.py`. See [Access control](05-access-control.md).

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `access/me/` | The caller's id, username, email, role, role label, duties, pages and levels. | Any signed-in user. |
| `GET` | `access/role-names/` | The key and name of every role, so screens can show a role by its name. | Any signed-in user. |
| `GET` | `access/matrix/` | The pages, the roles, each role's level per page, the defaults, and how many users have exceptions. | Admin only. |
| `PUT` | `access/matrix/` | Replace role levels. Body: `{"roles": {"<role>": {"<page>": "view" or "full"}}}`. | Admin only. |
| `GET` | `access/duties/` | The duties, the roles, and which role carries which duty. | Admin only. |
| `PUT` | `access/duties/` | Replace role duties. Body: `{"roles": {"<role>": ["<duty>", ...]}}`. | Admin only. |
| `GET` | `access/roles/` | Every role with the number of users who have it. | Admin only. |
| `POST` | `access/roles/` | Add a role. Body: `name`, `description`, `copy_from`. | Admin only. |
| `PATCH` | `access/roles/<id>/` | Rename a role or change its description. Built-in roles are refused. | Admin only. |
| `DELETE` | `access/roles/<id>/` | Delete a role nobody has. Built-in roles are refused. | Admin only. |
| `GET` | `access/users/<id>/` | One user's role levels, exceptions and the result. | Admin only. |
| `PUT` | `access/users/<id>/` | Replace one user's exceptions. Body: `{"overrides": {"<page>": "none", "view" or "full"}}`. | Admin only. |

### Warehouse (`warehouse/`)

File: `backend/apps/warehouse/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `warehouse/vendors/` | Suppliers. | None |
| Standard set | `warehouse/units/` | Factory units. | None |
| Standard set | `warehouse/stock/` | Deliveries. Filters: `status`, `vendor`, `unit`, date filter on `created_at`. | None |

### Sorting (`sorting/`)

File: `backend/apps/sorting/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `sorting/fabric-stock/` | Fabric lots, with their sellable stock figures. Filter: `status`. | None |
| Standard set | `sorting/sessions/` | Sorting sessions. Filters: `status`, `unit`. | None |
| `POST` | `sorting/sessions/<id>/complete/` | Complete a session. Body: `quantity_sorted`, `waste_quantity`. Updates the lot. | None |

### Decolorization (`decolorization/`)

File: `backend/apps/decolorization/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `decolorization/chemicals/` | Chemicals. | None |
| `GET` | `decolorization/chemicals/low_stock/` | Chemicals with less than 50 units left. | None |
| Standard set | `decolorization/tanks/` | Tanks. Filter: `status`. | None |
| `POST` | `decolorization/tanks/<id>/start/` | Mark the tank as Processing. | None |
| `POST` | `decolorization/tanks/<id>/complete/` | Mark the tank as Completed. | None |
| Standard set | `decolorization/issuances/` | Chemical issuances. Creating, changing or deleting one adjusts the chemical's stock. | Issuing a chemical marked as restricted needs the duty *Issue restricted chemicals* (Admin by default). |
| Standard set | `decolorization/sessions/` | Decolorization sessions (batches). | None |
| `POST` | `decolorization/sessions/<id>/complete/` | Complete a batch. Body: `output_quantity`, `waste_quantity`. | None |
| `POST` | `decolorization/sessions/<id>/approve/` | Sign off a batch. | Needs the duty *Approve decolorization batches* (Admin by default). |
| `GET` | `decolorization/sessions/<id>/consumption/` | Chemicals planned by the recipe against what was issued. | None |
| Standard set | `decolorization/lots/` | Chemical lots. Creating one adds to the chemical's stock; deleting takes it out. Filter: `chemical`. | None |
| Standard set | `decolorization/recipes/` | Recipes with their versions. | None |
| `GET` | `decolorization/fabric-stock/` | A short list of fabric lots for the forms. | None |
| `GET` | `decolorization/suppliers/` | Supplier names for the forms. | None |
| `GET` | `decolorization/usage/` | Chemical usage and cost for a period. Date filter on the issue date. | None |

### Drying (`drying/`)

File: `backend/apps/drying/views.py`. Reading is decided by the page check alone. Every change needs the Drying page itself in full (`IsDryingSupervisor`).

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `drying/dryers/` | Dryers. Filter: `status`. | Changing needs the Drying page in full |
| `POST` | `drying/dryers/<id>/set_available/` | Mark the dryer as Available. | The Drying page in full |
| `POST` | `drying/dryers/<id>/set_maintenance/` | Mark the dryer as Maintenance. | The Drying page in full |
| Standard set | `drying/sessions/` | Drying sessions. Filter: `status`. | Changing needs the Drying page in full |
| `POST` | `drying/sessions/<id>/start/` | Start a Pending or On Hold session. The dryer becomes Running. | The Drying page in full |
| `POST` | `drying/sessions/<id>/complete/` | Complete a session. Body: `output_quantity`, `waste_quantity`, `notes`. The output is posted to the stock ledger. | The Drying page in full |
| `GET` | `drying/fabric-ready/` | Lots that came out of decolorization. | None |
| `GET` | `drying/decolor-sessions-done/` | Completed decolorization sessions not yet linked to a drying session. | None |

### Inventory (`inventory/`)

File: `backend/apps/inventory/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `inventory/movements/` | The stock ledger. Filters: `fabric`, `movement_type`. | None |
| `GET` | `inventory/movements/<id>/` | One movement. | None |
| `GET` | `inventory/movements/stock/` | On hand, reserved and available kg per lot. | None |
| `POST` | `inventory/movements/adjust/` | A manual correction. Body: `fabric`, `quantity` (signed), `note` (required). | Needs the duty *Adjust stock* (Admin by default). |

Movements cannot be created, changed or deleted in any other way.

### Sales (`sales/`)

File: `backend/apps/sales/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `sales/customers/` | Customers, with balances in the list. Filter: `search`. | None |
| `GET` | `sales/customers/<id>/statement/` | Everything billed, paid and credited, with a running balance. | None |
| `GET` | `sales/customers/duplicates/` | Pairs of customers with similar names. | None |
| `POST` | `sales/customers/<id>/merge/` | Move this customer's orders and quotations to another customer (`into`) and delete this one. | Admin only. |
| Standard set | `sales/orders/` | Sales orders. Filters: `status`, `payment_status`, `buyer`, date filter on `created_at`. | None |
| `POST` | `sales/orders/<id>/confirm/` | Confirm an order. Checks stock. Returns a `credit_warning` when the customer is over the limit. | None |
| `POST` | `sales/orders/<id>/cancel/` | Cancel an order. | None |
| `POST` | `sales/orders/<id>/invoice/` | Raise an invoice for dispatched goods. Body (optional): `weight`, `invoice_date`, `notes`. | None |
| `GET` | `sales/orders/summary/` | Totals for the dashboard. | None |
| Standard set | `sales/dispatch/` | Dispatches. Filters: `status`, date filter on `dispatch_date`. | None |
| `POST` | `sales/dispatch/<id>/mark_delivered/` | Mark as delivered and complete the order. | None |
| Standard set | `sales/payments/` | Customer payments. Date filter on `payment_date`. | None |
| Standard set | `sales/products/` | Products and their category prices. | None |
| Standard set | `sales/quotations/` | Quotations. Date filter on `created_at`. A converted quotation cannot be deleted. | None |
| `POST` | `sales/quotations/<id>/send/`, `accept/`, `reject/` | Move a quotation through its statuses. `reject` takes `reason`. | None |
| `POST` | `sales/quotations/<id>/convert/` | Make a Draft order from an accepted quotation. Body (optional): `fabric`. | None |
| `GET`, `PATCH`, `DELETE` | `sales/invoices/`, `sales/invoices/<id>/` | List, change and delete invoices. There is no create here: invoices are raised from an order. Filters: `order`, date filter on `invoice_date`. | None |
| Standard set | `sales/returns/` | Sales returns. Date filter on `return_date`. An approved return cannot be deleted. | None |
| `POST` | `sales/returns/<id>/approve/`, `reject/` | Decide a return. `reject` takes `reason`. | Needs the duty *Approve sales returns* (Admin by default). |
| `GET` | `sales/performance/` | Sales by customer, material and month. Date filter. | None |

### Purchasing (`procurement/`)

File: `backend/apps/procurement/views.py`. A user with only the Warehouse page can read `procurement/open-lines/` and nothing else here.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `procurement/requisitions/` | Purchase requests. Filters: `status`, date filter on `created_at`. Only Draft, Rejected or Cancelled requests can be deleted. | None |
| `POST` | `procurement/requisitions/<id>/submit/`, `cancel/` | Submit or cancel a request. | None |
| `POST` | `procurement/requisitions/<id>/approve/`, `reject/` | Decide a request. `reject` takes `reason`. | Needs the duty *Approve purchases* (Admin by default). |
| Standard set | `procurement/orders/` | Purchase orders. Filters: `status` (comma separated), `vendor`, date filter on `order_date`. Only Draft, Submitted or Cancelled orders can be deleted. | None |
| `POST` | `procurement/orders/<id>/submit/`, `cancel/` | Submit or cancel an order. | None |
| `POST` | `procurement/orders/<id>/approve/`, `close/` | Approve or close an order. | Needs the duty *Approve purchases* (Admin by default). |
| `GET` | `procurement/open-lines/` | Order lines that can still receive goods. Filter: `vendor`. | None |
| Standard set | `procurement/returns/` | Purchase returns. Date filter on `return_date`. | None |
| Standard set | `procurement/quotations/` | Supplier quotations. Filter: `material`. | None |
| Standard set | `procurement/invoices/` | Supplier invoices. Filters: `status`, `vendor`, date filter on `invoice_date`. | None |
| Standard set | `procurement/payments/` | Supplier payments. Date filter on `payment_date`. | Creating, changing or deleting needs the duty *Record supplier payments* (Admin by default). |
| `GET` | `procurement/summary/` | Dashboard figures. | None |
| `GET` | `procurement/supplier-performance/` | Figures per supplier. | None |
| `GET` | `procurement/price-comparison/` | Quoted and ordered prices per material. Filter: `material`. | None |

### Quality (`quality/`)

File: `backend/apps/quality/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `quality/standards/` | Standards with their checks. Filter: `stage`. | Changing is Admin only. |
| Standard set | `quality/inspections/` | Inspections with their results and actions. Filters: `stage`, `result`, `quarantined`, `stock`, `fabric`, date filter on `inspected_on`. | Recording needs the inspect duty of the stage: *Inspect incoming material*, *Inspect in-process material* or *Inspect finished goods*. Changing a failed inspection needs *Release quarantine* (Admin by default). Deleting is Admin only. |
| `POST` | `quality/inspections/<id>/release/` | End the quarantine. Body: `note`. | Needs the duty *Release quarantine* (Admin by default). |
| Standard set | `quality/actions/` | Corrective actions. Filters: `status`, `inspection`. | Adding or changing needs the inspect duty of the inspection's stage. Deleting is Admin only. |
| `POST` | `quality/actions/<id>/complete/`, `reopen/` | Mark an action as done or open again. `complete` takes `note`. | Needs the inspect duty of the inspection's stage. |
| `GET` | `quality/summary/` | Dashboard figures. | None |

### Production (`production/`)

File: `backend/apps/production/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `production/stages/`, `production/routings/`, `production/boms/` | Planning data. | Changing needs the duty *Plan production* (Admin by default). |
| Standard set | `production/orders/` | Production orders. Filters: `status` (comma separated), `fabric`, date filter on `planned_start`. Only Draft or Cancelled orders can be deleted. | Changing needs *Plan production*. |
| `POST` | `production/orders/<id>/release/`, `cancel/` | Release or cancel an order. | Needs *Plan production*. |
| `POST` | `production/orders/<id>/complete/` | Complete an order. Body (optional): `actual_output_kg`. | Needs *Run production stages* or *Plan production*. |
| `GET` | `production/orders/<id>/activity/` | The sorting, decolorization and drying sessions of the order's lot. | None |
| `GET`, `PUT`, `PATCH` | `production/steps/`, `production/steps/<id>/` | The steps of orders. Steps are created with their order; there is no create or delete. Filters: `order`, `status`. | Changing needs *Plan production*. |
| `POST` | `production/steps/<id>/start/` | Start a step. | Needs *Run production stages* or *Plan production*. |
| `POST` | `production/steps/<id>/complete/` | Complete a step. Body: `input_kg`, `output_kg`, `waste_kg`, `actual_hours`. | Needs *Run production stages* or *Plan production*. |
| `POST` | `production/steps/<id>/skip/` | Skip a step. | Needs *Plan production*. |
| Standard set | `production/materials/` | Planned and actual material use. Filter: `order`. | Adding, deleting, or changing anything but `actual_quantity` needs *Plan production*. Recording `actual_quantity` needs *Run production stages*. |
| `GET` | `production/requirements/` | What open orders still need, against chemical stock. | None |
| `GET` | `production/summary/` | Dashboard figures. | None |

### Finance (`finance/`)

File: `backend/apps/finance/views.py`. Every endpoint needs the Finance page: any level to read, full to change (`HasPage('finance')`). The statements bring the journal up to date before answering.

| Method | Path | What it does |
|---|---|---|
| Standard set | `finance/accounts/` | The chart of accounts. An account with a system key or with entries cannot be deleted. |
| `GET` | `finance/accounts/<id>/ledger/` | Every line on the account with a running balance. Parameters: `start`, `end`. |
| Standard set | `finance/periods/` | Periods. A closed period cannot be deleted. |
| `POST` | `finance/periods/<id>/close/`, `reopen/` | Close or reopen a period. |
| Standard set | `finance/tax-rates/` | Tax rates. |
| `GET`, `POST` | `finance/journal/`, `finance/journal/<id>/` | List, read and create journal entries. Entries cannot be changed or deleted. Filters: `source`, `account`, date filter on `date`. |
| `POST` | `finance/journal/<id>/reverse/` | Post the reversal of a manual entry. Body (optional): `date`. |
| `POST` | `finance/journal/sync/` | Bring the automatic entries in line with sales, purchasing and expenses. Returns counts: `posted`, `updated`, `removed`, `skipped_closed`. |
| Standard set | `finance/expenses/` | Expenses. Each save also updates the journal. Date filter on `date`. |
| `GET` | `finance/summary/` | Dashboard figures. |
| `GET` | `finance/trial-balance/` | Trial balance. Parameter: `as_of`. |
| `GET` | `finance/profit-and-loss/` | Profit and loss. Parameters: `start`, `end` (default: this year to date). |
| `GET` | `finance/balance-sheet/` | Balance sheet. Parameter: `as_of`. |
| `GET` | `finance/cash-flow/` | Cash flow. Parameters: `start`, `end`. |
| `GET` | `finance/balances/` | Who owes the business and whom it owes. |
| `GET` | `finance/costing/` | Production cost for a period. Parameters: `start`, `end`. |

### Maintenance (`maintenance/`)

File: `backend/apps/maintenance/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `maintenance/machines/` | The machine register. Filter: `status`. | Changing needs the duty *Manage maintenance* (Admin by default). |
| Standard set | `maintenance/schedules/` | Preventive schedules. Filter: `machine`. | Changing needs *Manage maintenance*. |
| `POST` | `maintenance/schedules/<id>/create-work-order/` | Raise the preventive work order for a schedule. | Needs *Manage maintenance*. |
| Standard set | `maintenance/work-orders/` | Work orders. Filters: `status`, `kind`, `machine`. | Without the duty *Manage maintenance* (Admin by default) a user can only report corrective work, cannot assign people, and can change only their own order while it is Open. Deleting is Admin only. |
| `POST` | `maintenance/work-orders/<id>/start/`, `complete/` | Start or complete a work order. `complete` takes `work_done`, `downtime_minutes`, `labour_hours`, `labour_cost`, `other_cost`. | The assigned person, anyone when nobody is assigned, or a user with *Manage maintenance*. |
| `POST` | `maintenance/work-orders/<id>/cancel/` | Cancel a work order. | Needs *Manage maintenance*. |
| Standard set | `maintenance/parts/` | Spare parts. | Changing needs *Manage maintenance*. |
| `POST` | `maintenance/parts/<id>/receive/` | Add received stock. Body: `quantity`, `unit_cost`. | Needs *Manage maintenance*. |
| `GET`, `POST`, `DELETE` | `maintenance/part-uses/`, `maintenance/part-uses/<id>/` | Parts taken for a work order. No change: remove and enter again. Filter: `work_order`. | Maintenance page. Deleting needs the duty *Manage maintenance*. |
| `GET` | `maintenance/summary/` | Dashboard figures. | None |
| `GET` | `maintenance/performance/` | Breakdowns, downtime, cost and availability per machine for a period. | None |

### Sustainability (`sustainability/`)

File: `backend/apps/sustainability/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `sustainability/waste-categories/` | Waste categories. | Changing is Admin only. |
| Standard set | `sustainability/waste-records/` | Waste records. Filters: `classification`, `stage`, `category`, `disposal_method`, date filter on `date`. | A user who is not an admin can change only entries they recorded. Deleting is Admin only. |
| Standard set | `sustainability/utility-readings/` | Utility readings. Filters: `utility`, `stage`, date filter on `date`. | Same as waste records. |
| Standard set | `sustainability/targets/` | Targets. | Changing is Admin only. |
| `GET` | `sustainability/summary/` | Dashboard figures for a period (this month by default) and the trend. Parameter: `months` (`6`, otherwise 12). | None |
| `GET` | `sustainability/report/` | The environmental report for a period (all time by default). | None |

### Workforce (`workforce/`)

File: `backend/apps/workforce/views.py`. Every endpoint needs the Workforce page: any level to read, full to change (`HasPage('workforce')`).

| Method | Path | What it does |
|---|---|---|
| Standard set | `workforce/departments/`, `workforce/job-roles/`, `workforce/shifts/` | Set-up lists. |
| Standard set | `workforce/employees/` | Employees. Filters: `status`, `department`. |
| Standard set | `workforce/attendance/` | Attendance records. Filters: `employee`, `status`, `date`, date filter on `date`. |
| `GET` | `workforce/attendance/sheet/` | Current staff for one day (`date`), with what is recorded and who is on approved leave. |
| `POST` | `workforce/attendance/mark/` | Mark a whole list for one date. Body: `date`, `shift` (optional), `records`. |
| Standard set | `workforce/leave/` | Leave requests. Filters: `status`, `employee`. |
| `POST` | `workforce/leave/<id>/approve/`, `reject/` | Decide a request. Body: `note`. |
| Standard set | `workforce/tasks/` | Task assignments. Filters: `status`, `employee`, `area`, date filter on `date`. |
| `GET` | `workforce/summary/` | Dashboard figures. |
| `GET` | `workforce/productivity/` | Attendance and finished work per employee for a period. Date filter. |

### Documents (`documents/`)

File: `backend/apps/documents/views.py`. A user who is not an admin sees only the categories that list their role, and the documents in them. A document outside those categories answers `404`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| Standard set | `documents/categories/` | Categories. | Changing is Admin only. |
| `GET`, `POST`, `PATCH`, `DELETE` | `documents/documents/`, `documents/documents/<id>/` | Documents. Create is a multipart upload with a `file`. There is no `PUT`. Filters: `category`, `status`, `linked_type`, `linked_id`, `search`. | Changing: an admin or the person who uploaded it. Moving to another category: Admin only. Deleting: Admin only. |
| `GET` | `documents/documents/<id>/versions/` | List the versions. | None |
| `POST` | `documents/documents/<id>/versions/` | Upload a file as the next version. Body: `file`, `note`. | An admin or the person who uploaded the document. |
| `GET` | `documents/documents/<id>/download/` | Download the current version. | None |
| `GET` | `documents/documents/<id>/versions/<number>/download/` | Download an earlier version. | None |
| `GET` | `documents/expiring/` | Documents that have expired or expire within `days` (default 30). | None |
| `GET` | `documents/summary/` | Dashboard figures, the upload size limit and the allowed file types. | None |

### Search and traceability (`search/`)

File: `backend/apps/search/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `search/` | Find records across modules. Parameters: `q` (two or more characters), `scope=lots`. Each kind of record is searched only when the user has its page. | Any signed-in user with a known role. |
| `GET` | `search/trace/` | The history of a fabric lot. One of: `lot`, `order`, `stock`, `production`. Sections the user's pages do not cover are left out. | The Traceability page. |

### Notifications and approvals (`alerts/`)

File: `backend/apps/alerts/views.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `alerts/notifications/` | What needs the caller's attention now. | Any signed-in user with a known role. |
| `GET` | `alerts/approvals/` | Everything waiting for a decision, grouped by kind, with the endpoint each action must be sent to. | The Approvals page. |
| `GET` | `alerts/rules/`, `alerts/rules/<id>/` | The notification rules. | Admin only. |
| `PATCH` | `alerts/rules/<id>/` | Change a rule's settings: `is_enabled`, `threshold`, `roles`, `send_email`, `escalate_after_days`. | Admin only. |

Rules cannot be created or deleted through the API.

### Reports (`reports/`)

Files: `backend/apps/reports/urls.py`, `views.py`, `centre.py`.

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `reports/catalogue/` | The list of reports in the report centre. | The Reports or Dashboard page. |
| `GET` | `reports/run/<key>/` | One report as a table. Date filter. `format=xlsx` or `format=csv` returns a file. | The Reports or Dashboard page. |
| `GET` | `reports/schedules/` | The scheduled e-mail reports and how they are run. | The Reports or Dashboard page. |
| `GET` | `reports/executive/` | Key figures of every module. | The Reports or Dashboard page. |
| `GET` | `reports/daily-production/` | Production figures for one day. Parameter: `date`. | None |
| `GET` | `reports/monthly-sales/` | Sales figures for one month. Parameters: `year`, `month` (a number). | None |
| `GET` | `reports/waste-analysis/` | Waste figures for a period. Parameters: `start`, `end` (default: the last 30 days). | None |
| `GET` | `reports/daily-production/export/`, `reports/monthly-sales/export/`, `reports/waste-analysis/export/` | The same three reports as Excel files. | None |

The report keys are: `inventory-valuation`, `stock-movement`, `material-recovery`, `sorting-performance`, `production-efficiency`, `chemical-consumption`, `quality-performance`, `supplier-performance`, `customer-sales`, `production-costing`, `profit-and-loss`, `waste-sustainability`, `machine-utilisation`.

### Audit log (`audit/`)

File: `backend/apps/audit/views.py`. See [Audit and logging](14-audit-and-logging.md).

| Method | Path | What it does | Extra rule |
|---|---|---|---|
| `GET` | `audit/logs/` | Audit entries, newest first, always paged. Filters: `model`, `user`, `action`, `start`, `end`, `search`, `ordering`. | Admins see everything. Other users see only their own entries. |
| `GET` | `audit/logs/<id>/` | One entry. | Same. |
| `GET` | `audit/logs/export/` | The filtered entries as an Excel file, 500 rows at most. | Same. |
| `GET` | `audit/logs/summary/` | Counts for the audit screen. | Admin only. |

### Health (`/api/health/`)

File: `backend/apps/core/health.py`.

| Method | Path | What it does | Rule |
|---|---|---|---|
| `GET` | `/api/health/` | `200` with `{"status": "ok", "database": "ok"}` when the database answers. `503` with `{"status": "error", "database": "unreachable"}` when it does not. | Open. |

## Keeping this page up to date

- Revise an app's endpoint table when its `backend/apps/<app>/urls.py` changes, or when a viewset in its `views.py` gains or loses an `@action`, a filter, or a `permission_classes` entry.
- Revise "Who may call what" when `PAGE_API`, `OPEN_READS`, `NOT_OPEN` or `OPEN_ANY` in `backend/apps/access/services.py` change.
- Revise the conventions when `backend/apps/core/pagination.py`, `backend/apps/core/filters.py`, `backend/apps/core/exceptions.py`, or `REST_FRAMEWORK`, `SIMPLE_JWT` and `SPECTACULAR_SETTINGS` in `backend/config/settings.py` change.
- Revise the base paths when `backend/config/urls.py` or `frontend/nginx.edge.conf` change.
- `/api/docs/` is always generated from the code. When this page and the Swagger page disagree, the Swagger page is right; correct this page.
