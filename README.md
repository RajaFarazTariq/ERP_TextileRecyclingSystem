# ERP Textile Recycling System

A web-based ERP for textile recycling factories. It follows material from the supplier's truck to the customer's delivery: deliveries are weighed into the warehouse, inspected, sorted, decolorized and dried, and the dried output is sold. Purchasing, production planning, quality, maintenance, finance, people, sustainability figures and documents sit alongside, all in one place, with role-based access for each department.

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
- [Going live and daily use](#going-live-and-daily-use)
- [Roadmap](#roadmap)

## Features

**Operations**
- **Warehouse:** suppliers, factory units and incoming deliveries (vendor slip, vehicle, our weight vs. unloading weight). Approve or reject deliveries, and optionally link one to a purchase order.
- **Sorting:** fabric lots and sorting sessions, with progress tracked against the weight taken.
- **Decolorization:** tanks, chemical stock and issues (over-issuing is blocked), process sessions and efficiency. Chemicals carry cost and safety data, arrive in lots, and are planned with versioned recipes; each batch shows planned against issued chemicals and its cost.
- **Drying:** dryers and drying sessions. Completed sessions add sellable stock.
- **Quality:** standards with limits, inspections of deliveries and fabric lots, quarantine of failed material, corrective actions, defect analysis and supplier quality.
- **Production:** production orders with configurable stages and routings, bills of materials, a schedule, material needs against stock, and planned against actual output, time, waste and cost.
- **Maintenance:** machines, preventive schedules, work orders and breakdowns, spare parts, downtime and a performance report.
- **Sustainability:** waste records, utility readings, targets, and recovery, waste, water, energy and chemical figures worked out from the production records.

**Commercial**
- **Purchasing:** purchase requests and orders with admin approval, amendments with revision numbers, deliveries against orders, supplier invoices with tax, payments, returns, quotations, price comparison and supplier performance.
- **Sales:** quotations that become orders, orders with stock reservation, partial dispatches with printable delivery challans, printable invoices, payments, returns with credit, customer profiles with credit limits and statements, a product price list, and a sales performance report.
- **Inventory:** a ledger of every stock change, with reservations and admin adjustments.
- **Finance:** chart of accounts, a double-entry journal fed by sales, purchasing and expenses, period closing, trial balance, profit and loss, balance sheet, cash flow, customer and supplier balances, and production costing.

**Management**
- **Dashboard:** live material flow across the stages, period-over-period changes, trends, a "needs attention" list, and a "Business at a glance" section with a figure from every module.
- **Approvals:** one inbox for everything waiting for an admin's decision.
- **Notifications:** alerts worked out on the server from configurable rules (stock, approvals, delays, quarantine, breakdowns, overdue invoices, expiring documents and more), shown in the bell and optionally e-mailed as a digest.
- **Traceability:** one page that follows a lot from the supplier's delivery through every stage to the customer.
- **Report centre:** thirteen reports with a date range, chart, totals, and Excel, CSV and print output, next to the daily production, monthly sales and waste reports.

**Administration**
- **Documents:** uploaded files by category with versions, expiry dates, role-based access and checked, authenticated downloads.
- **Workforce:** employees, departments, shifts, a daily attendance sheet, leave, tasks and a productivity report (admins only).
- **Users and access:** five built-in roles plus any roles you add. Admins decide, per role and per person, which pages are open and whether they are view only or full, and which roles carry duties such as approving purchases. The API enforces the same rules.
- **Audit log:** who changed what, and when.
- **Email alerts and reports** (low chemicals, new orders, payments, daily and monthly reports).

**Interface**
- "Industrial Eco-Tech" design with dark (default) and light themes.
- Search (Ctrl + K) for jumping to any page or section, and for finding records by name or number within what your role may see.
- Notifications that can be marked as read, and sortable, filterable tables with CSV export and adjustable row density.
- Works on phones and tablets.

## Screenshots

| Dashboard (dark) | Dashboard (light) |
|---|---|
| ![Dashboard, dark theme](docs/screenshots/dashboard.png) | ![Dashboard, light theme](docs/screenshots/dashboard-light.png) |

**Operations**

| Warehouse | Sorting |
|---|---|
| ![Warehouse](docs/screenshots/warehouse.png) | ![Sorting](docs/screenshots/sorting.png) |

| Decolorization | Drying |
|---|---|
| ![Decolorization](docs/screenshots/decolorization.png) | ![Drying](docs/screenshots/drying.png) |

| Quality | Production |
|---|---|
| ![Quality](docs/screenshots/quality.png) | ![Production](docs/screenshots/production.png) |

| Maintenance | Sustainability |
|---|---|
| ![Maintenance](docs/screenshots/maintenance.png) | ![Sustainability](docs/screenshots/sustainability.png) |

**Commercial**

| Purchasing | Sales |
|---|---|
| ![Purchasing](docs/screenshots/purchasing.png) | ![Sales](docs/screenshots/sales.png) |

| Finance | Journal |
|---|---|
| ![Finance](docs/screenshots/finance.png) | ![Journal](docs/screenshots/finance-journal.png) |

**Management**

| Approvals | Traceability |
|---|---|
| ![Approvals](docs/screenshots/approvals.png) | ![Traceability](docs/screenshots/traceability.png) |

| Reports | Report centre |
|---|---|
| ![Reports](docs/screenshots/reports.png) | ![Report centre](docs/screenshots/report-centre.png) |

**Administration and interface**

| Documents | Workforce |
|---|---|
| ![Documents](docs/screenshots/documents.png) | ![Workforce](docs/screenshots/workforce.png) |

| Search (Ctrl + K) | Notifications |
|---|---|
| ![Search](docs/screenshots/command-menu.png) | ![Notifications](docs/screenshots/notifications.png) |

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
    core/                 Shared permissions (roles), filters, health check, seed commands
    users/                Custom user model, login, user management
    warehouse/            Suppliers, factory units, incoming deliveries
    procurement/          Requests, purchase orders, supplier invoices, payments, returns
    quality/              Standards, inspections, quarantine, corrective actions
    production/           Stages, routings, bills of materials, production orders
    sorting/              Fabric lots and sorting sessions
    decolorization/       Chemicals, lots, recipes, tanks, issues, sessions
    drying/               Dryers and drying sessions
    sales/                Customers, products, quotations, orders, dispatch, invoices, payments, returns
    inventory/            Dried-stock ledger, reservations, adjustments
    finance/              Accounts, journal, expenses, periods, statements, costing
    maintenance/          Machines, schedules, work orders, spare parts
    workforce/            Employees, shifts, attendance, leave, tasks
    sustainability/       Waste records, utility readings, targets, calculated figures
    documents/            Categories, documents, versions, checked uploads
    alerts/               Notification rules, the approvals inbox, the e-mail digest
    search/               Global search and lot traceability
    reports/              Report centre, executive figures and Excel exports
    access/               Page access per role and per person, and the check in front of every API call
    audit/                Audit log (model, ViewSet mixin, API)
    notifications/        Email alerts (signals) and the daily and monthly reports
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
    types/                API types (api.ts, plus one file per newer module)
    config/access.ts      Role access per page and the sidebar menu
    proxy.ts              Route guard (login + role)
  e2e/                    Playwright browser tests, the layout audit and the README screenshot script
scripts/
  backup.sh, restore.sh   Back up and restore the database and uploaded documents (Docker)
docs/
  DEPLOYMENT.md           Going live: setup, HTTPS, checklist, backups, monitoring, updates
  USER_GUIDE.md           How to do the daily work, by task
  UPGRADE_AUDIT.md        Upgrade audit and per-phase status
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
docker compose exec backend python manage.py seed_drying_data  # optional: dryers and drying sessions
docker compose exec backend python manage.py seed_module_data  # optional: finance, maintenance, workforce, sustainability, documents
```

Open http://localhost:8080. The admin panel is at http://localhost:8080/admin/ and the API docs are at http://localhost:8080/api/docs/. To use a different port, set `APP_PORT` in `.env`. Database data is kept in the `pgdata` Docker volume and uploaded documents in the `media` volume. For a real server, follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

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
python manage.py seed_drying_data  # dryers and drying sessions
python manage.py seed_module_data  # finance, maintenance, workforce, sustainability, documents
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

| Role | Username | Password | Own pages |
|---|---|---|---|
| Admin | `admin` | `Admin@1234` | Everything, including Dashboard, Approvals, Sales, Finance, Workforce, Reports and Users |
| Warehouse supervisor | `warehouse_user` | `Demo@1234` | Warehouse, Purchasing |
| Sorting supervisor | `sorting_user` | `Demo@1234` | Sorting, Production |
| Decolorization supervisor | `decolor_user` | `Demo@1234` | Decolorization, Production |
| Drying supervisor | `drying_user` | `Demo@1234` | Drying, Production |

Every role also opens Quality, Maintenance, Sustainability, Documents and Traceability, where it sees and does what its role allows.

This is the starting access. An admin can change it under **Users → Access**, and add roles of their own.

The full system manual is in [docs/manual](docs/manual/README.md).

Change these passwords, or don't seed demo data at all, on a real server.

## Tests

**Backend** (about 400 tests):

```bash
cd backend
python manage.py test apps
```

**Frontend checks:**

```bash
cd frontend
npm run lint && npm run typecheck && npm run build
```

**Browser tests (Playwright):** 17 scenarios, one per module, about 300 checks. They need Django on port 8000 with demo data (`seed_demo_data`, `seed_drying_data`, `seed_module_data`), and the app running with `npm run build && npx next start -p 3001`. Install the browser once with `npx playwright install chromium`.

```bash
npm run e2e                  # all scenarios
npm run e2e -- sales         # only the named ones
```

**Layout audit:** with the same setup, `npm run audit:ui` opens every page, tab and form at phone, tablet, laptop and desktop sizes in both themes. It reports overlapping controls, content wider than the screen, and clipped text, and saves screenshots to `e2e/screenshots/audit/`.

On a slow machine, run these one after another: several heavy jobs at once make pages time out.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` or `upgrade/**` and on every pull request. It runs the backend tests against PostgreSQL, then lints, type-checks and builds the web app.

## Usage and API

| What | Local | Docker |
|---|---|---|
| Web app | http://localhost:3001/ | http://localhost:8080/ |
| API | http://127.0.0.1:8000/api/v1/ | via the app |
| API docs (Swagger) | http://127.0.0.1:8000/api/docs/ | http://localhost:8080/api/docs/ |
| Admin panel | http://127.0.0.1:8000/admin/ | http://localhost:8080/admin/ |
| Health check | http://127.0.0.1:8000/api/health/ | http://localhost:8080/api/health/ |

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

### Production

- **Setup (admin):** process stages (sorting, shredding, washing and so on) can be added, renamed or switched off. A *routing* lists the stages an order goes through, with planned hours and a cost per hour. A *bill of materials* lists what 100 kg of input needs.
- **Orders:** a production order plans the processing of one fabric lot: planned input and output, dates and priority. It copies its stages from the routing and its materials from the bill of materials, so later changes to those affect new orders only.
- **Flow:** Draft → an admin releases it → supervisors start and complete the stages in order → the order is completed. After release only the dates, priority, unit and notes can change. An order whose lot is in quarantine can't be released or worked on.
- **Stages:** completing a stage records input, output, waste and hours. Output plus waste can't exceed the input. An admin can skip a stage and set its operator, machine and hourly cost.
- **Figures:** each order shows planned against actual input, output, time, waste and cost. Cost is hours × hourly cost plus materials used × unit cost.
- **Stock is not moved by production orders.** Sorting, decolorization and drying sessions, chemical issuances and the dried-stock ledger work as before; an order's material use is a record for its cost.
- **Material needs:** the Materials tab adds up what open orders still need and compares it with the chemical stock on hand.
- **Who does what:** admins plan, release and cancel. Sorting, decolorization and drying supervisors run stages, record materials and complete orders.
- **API:** `/api/v1/production/` (stages, routings, boms, orders, steps, materials, summary, requirements).

### Chemicals and recipes

- **Chemical record:** besides stock, a chemical has a cost per unit, a usual supplier, a hazard class, handling notes and a reference to its safety data sheet (a link, or where the sheet is filed).
- **Restricted chemicals:** a chemical marked "admins only" can be issued by an admin only.
- **Lots:** receiving a lot (lot number, quantity, cost, supplier, expiry date) adds its quantity to the chemical's stock and makes its cost the chemical's current cost. The chemical and quantity of a lot can't be edited afterwards. Deleting a lot takes the quantity back out, and is refused once that stock has been issued.
- **Recipes:** a recipe lists chemicals per 100 kg of material, with temperature, duration and water. Changing the chemicals or the process saves a new version; the old versions stay, and each batch keeps the version it ran.
- **Batches:** a decolorization session can record its recipe, temperature, duration and water. All of these are optional, so sessions work as before without them.
- **Issuances and cost:** an issuance is tied to the batch running in its tank (when exactly one is running) and keeps the cost per unit at that moment, so later price changes don't rewrite past batches.
- **Planned against actual:** "Chemicals used" on a session compares the recipe, scaled to the batch's input weight, with what was issued, and shows the cost and the cost per kg.
- **Approval:** an admin can approve a batch record. It is a sign-off only; nothing is blocked while a batch is unapproved.
- **Usage report:** the Usage tab totals quantity and cost per chemical for a period. Cost per kg treated counts only issuances tied to a batch.
- **API:** `/api/v1/decolorization/` (`lots`, `recipes`, `sessions/<id>/consumption`, `sessions/<id>/approve`, `usage`).

### Sales: quotations, invoices and returns

- **Flow:** quotation → the customer accepts → sales order (Draft) → confirm (reserves stock) → dispatch → invoice → payment. A quotation is optional: orders can still be entered directly, as before.
- **Customers:** a customer has a category (wholesaler, manufacturer, exporter, retailer, other), payment terms in days, and an optional credit limit. The Customers tab shows what each one owes.
- **What a customer owes:** confirmed, dispatched and completed orders, less payments received, less credits for approved returns. "Statement" on a customer lists these with a running balance.
- **Credit limit:** going over it shows a warning when the order is entered and when it is confirmed. It never blocks the order.
- **Products and prices:** a product has a list price per kg and can have a different price per customer category. Choosing a product on an order or quotation fills in the grade and the price for that customer; both can still be changed.
- **Discount and tax:** an order or quotation can have a discount % and a tax %. The total is weight × price, less the discount, plus tax on the rest. With neither, the total is weight × price as before.
- **Quotations:** Draft → Sent → Accepted or Rejected. An accepted quotation is turned into a Draft order with the same terms; the fabric lot is chosen then if it wasn't before. A converted quotation can't be changed or deleted.
- **Invoices:** an invoice is raised from an order for goods that have been dispatched and not yet invoiced, so partial deliveries are invoiced one by one. Its amounts are fixed when it is raised, and the due date comes from the customer's payment terms. Payments stay recorded against the order; they settle its invoices oldest first, which gives each invoice its status (Unpaid, Partial, Paid, Overdue).
- **Delivery challans:** each dispatch has a challan number (DC-00012) and can be printed, as can each invoice.
- **Returns:** a return records the weight sent back (never more than was dispatched), the reason, and whether the goods go back into sellable stock or are written off. Nothing changes until an admin approves it. Approval credits the customer at the order's price, updates the order's payment status, and, if chosen, adds the weight back to the stock ledger. An approved return can't be deleted.
- **Performance:** the Performance tab shows sales, weight, average price, quotations won and returns for a period, by month, customer and material.
- **API:** `/api/v1/sales/` (`products`, `quotations`, `invoices`, `returns`, `orders/<id>/invoice`, `customers/<id>/statement`, `performance`).

### Finance

- **Admins only.** No other role can open the page or call its API.
- **Journal:** every entry balances (debits equal credits) and has at least two lines. Entries are never edited or deleted; a wrong one is reversed, which posts its mirror image and keeps both.
- **Where entries come from:** typed in, made by recording an expense, or posted from the sales and purchasing records:

  | Record | Debit | Credit |
  |---|---|---|
  | Sales invoice | Accounts receivable | Sales, Sales tax payable |
  | Customer payment | Cash or Bank | Accounts receivable |
  | Approved sales return | Sales returns | Accounts receivable |
  | Supplier invoice | Raw material purchases, Purchase tax recoverable | Accounts payable |
  | Supplier payment | Accounts payable | Cash or Bank |
  | Expense | The expense account | The cash or bank account it was paid from |

- **Keeping the books in step:** "Update books" (and opening any statement) posts what is missing, corrects what changed and removes entries whose record was deleted. Running it twice changes nothing.
- **Timing:** a sale reaches the books when it is invoiced, and a purchase when the supplier's invoice is entered. So "Accounts receivable" can differ from the Sales page's "owes" figure, which counts confirmed orders.
- **Periods:** closing a period locks every entry dated inside it. Later changes to those records are left out and reported as skipped. A period can be reopened.
- **Accounts:** a starting chart of accounts is created. Accounts used by the automatic postings can be renamed but not deleted; an account with entries can't be deleted or change type.
- **Statements:** trial balance, profit and loss, balance sheet (profit to date is shown as "Profit kept in the business") and cash flow by kind of transaction. Each account has a ledger with a running balance.
- **Costing:** for a period: raw material (supplier invoices), chemicals (issued quantity × cost when issued), labour and machine time (hours on production stages × hourly cost) and expenses by account, in total and per kg of dried output, with the production orders' estimated cost against actual.
- **Tax rates** are a reference list; the tax % is entered on each order or invoice.
- This supports the business's own bookkeeping. It is not a certified statutory accounting system.
- **API:** `/api/v1/finance/` (`accounts`, `journal`, `expenses`, `periods`, `tax-rates`, `summary`, `trial-balance`, `profit-and-loss`, `balance-sheet`, `cash-flow`, `balances`, `costing`).

### Maintenance

- **Machines** have a status: Running, Idle, Under maintenance, Broken down or Retired. A machine can be linked to a tank or a dryer.
- **Work orders** (WO-00012) are Preventive or Corrective. Open → In progress → Done, or Cancelled by an admin. Completing one needs a note of the work done and records downtime, labour hours and costs. A finished or cancelled order can't be changed.
- **Machine status follows its open work orders:** an open breakdown makes it Broken down, work in progress makes it Under maintenance, and it returns to Running when they are closed.
- **Schedules:** a preventive task repeats every N days. "Create work order" makes its work order (one at a time); completing it moves the next due date forward.
- **Spare parts:** using a part on a work order takes it out of stock (never more than is there) and deleting the use puts it back. "Receive" adds stock.
- **Performance:** per machine: breakdowns, downtime, cost, days between failures and availability, plus the downtime of tank and dryer machines next to the sessions they ran.
- **Who does what:** every role can report a breakdown and work on an order that is theirs or unassigned. The duty *Manage maintenance* (admins by default) covers machines, schedules, parts, assignments and cancellations.
- **API:** `/api/v1/maintenance/`.

### Workforce

- **Admins only**, because it holds personal data.
- **Employees** (EMP-00012) belong to a department and job role and can be linked to a login. An employee with attendance, leave or tasks can't be deleted; mark them as Left.
- **Attendance:** one record per person per day. The attendance sheet marks everyone for a date in one save. Hours come from the check-in and check-out times (shifts may cross midnight) unless typed.
- **Leave:** requests can't overlap another pending or approved leave of the same person. An admin approves or rejects. People on approved leave start as "Leave" on that day's sheet.
- **Productivity:** per person and department: days present, absences, late days, hours, overtime, tasks done and kg per hour.
- Payroll is not part of this module.
- **API:** `/api/v1/workforce/`.

### Sustainability

- **Every figure is calculated** from records already in the system; rates are never typed in. The page shows how each one is worked out.
- **Recovery rate:** dried output of completed drying sessions divided by the weight taken into completed sorting sessions in the same period. Short periods can read high or low, because a lot sorted in one month may be dried in the next.
- **Waste records** hold waste that is physically handled: category, classification (recyclable, reusable, hazardous, general), stage, weight, how and where it was disposed of, cost or revenue.
- **Diverted from landfill:** everything not disposed of as Landfill.
- **Utilities:** water, electricity, gas, steam and diesel readings. Water and electricity are also shown per kg of dried output.
- **Chemicals:** quantity and cost of chemicals issued.
- **Targets:** one active target per measure, shown as on or off target.
- **Who does what:** everyone reads. Any role adds records and edits their own; admins delete and manage categories and targets.
- No certification or regulatory compliance is claimed.
- **API:** `/api/v1/sustainability/`.

### Documents

- **Files are checked on upload:** size (10 MB by default, `DOCUMENT_MAX_UPLOAD_MB`), type (pdf, images, Word, Excel, csv, txt) and that the content really is that type.
- **Storage:** files are kept outside the web root under a generated name (`MEDIA_ROOT`) and are only reachable through the API after a permission check. Downloads are always sent as attachments. In Docker they live in the `media` volume.
- **Access by category:** each category lists the roles that may see it. A role that may not see a category doesn't see its documents anywhere, and gets "not found" for them. Employee documents are for admins only.
- **Versions:** a new version is added beside the old ones, which stay downloadable.
- **Expiry:** a document is Valid, Expiring soon (within 30 days), Expired or has No expiry. The Expiring tab is the reminder list.
- **Who does what:** any role uploads into categories it can see and adds versions to its own documents. Admins delete, manage categories and access.
- Downloads are written to the audit log.
- **API:** `/api/v1/documents/`.

### Notifications and approvals

- **Rules:** each kind of alert is a rule that an admin can switch on or off, give a threshold (for example "25% of total" or "7 days ahead"), assign to roles, and mark for e-mail and escalation. Rules are edited on **Approvals → Rules**.
- **Who sees what:** admins see every alert. Another role sees an alert only if the rule lists the role *and* the role can open the page the alert is about. Customer debts, credit limits, returns and leave are for admins only.
- **Escalation:** an item older than the rule's escalation days is marked "Escalated" and listed first.
- **Read state** is kept per user in the browser; ticking an item only hides it for you.
- **E-mail:** nothing is sent by itself. `python manage.py send_alert_digest` sends one digest of the rules marked for e-mail to `MANAGEMENT_EMAIL` (see the deployment guide for running it daily).
- **Approvals inbox (admin):** purchase requests and orders, quarantine releases, production orders waiting for release, sales returns, decolorization batches waiting for sign-off, and leave requests. Approving or rejecting there calls the same action as on the module's own page, so the same rules apply.
- Custom approval chains (several approvers in sequence) are not built: each approval is one admin decision.
- **API:** `/api/v1/alerts/` (`notifications`, `rules`, `approvals`).

### Search and traceability

- **Search:** type two or more characters in the Ctrl + K box. Numbers work with or without their prefix (`PO-00012`, `po-12`, `INV-3`, `#15`). A result opens the page the record lives on.
- **What is searched depends on the role:** a group of results is returned only to roles that can open its page. Customers, sales records and employees are found by admins only; documents follow the documents access rules.
- **Traceability:** pick a lot (or find it by supplier, purchase order, sales order or invoice) to see its delivery and incoming inspection, sorting, decolorization with the chemicals issued, drying, production orders, quality checks, stock movements and sales, with the weight at each stage and the overall yield.
- **Sections follow permissions:** a stage your role cannot read is shown as "Not available for your role". Sales is shown to admins only.
- **API:** `/api/v1/search/?q=` and `/api/v1/search/trace/?lot=` (also `order`, `stock`, `production`).

### Report centre

- **Reports → Report centre** lists the reports by group: stock (inventory valuation, stock movement), production (material recovery, sorting performance, production efficiency, chemical consumption), quality, commercial (supplier performance, customer sales), finance (production costing, profit and loss), sustainability and maintenance (machine utilisation).
- **Same numbers as the modules:** each report calls the module's own calculation, and shows a note on how its figures are worked out.
- **Inventory value** is kg on hand × the factory's production cost per kg for the chosen period (from Finance costing). It is one rate for the whole factory, not a cost per lot, and it is empty when nothing was dried in the period. Selling prices are never used.
- **Supplier performance** covers all time; the purchasing calculation has no period.
- **Output:** Excel, CSV and Print (use the browser's "Save as PDF").
- **Scheduled reports:** the daily and monthly e-mail reports are management commands; nothing runs on a timer inside the app.
- Admins only.
- **API:** `/api/v1/reports/` (`catalogue`, `run/<key>`, `executive`, `schedules`).

### Roles, page access and duties

- **Where:** Users → Access (admins only). Four cards: Roles, Pages by role, Duties by role, Exceptions for one person.
- **Roles:** five are built in (Admin and one supervisor per department). Admins add their own (Accountant, Store Keeper, ...), optionally copying the pages and duties of an existing role. Each person has one role. Built-in roles can't be renamed or deleted; a role people still have can't be deleted.
- **Page levels:** each role holds each page at *No access*, *View only* or *Full*. View only shows everything and hides the add, edit and delete controls; the API refuses changes with "You have view-only access here, so you can look but not change anything."
- **Duties:** what a role may do beyond opening a page: approve purchases, record supplier payments, inspect incoming / in-process / finished material, release quarantine, plan production, run production stages, approve decolorization batches, issue restricted chemicals, approve sales returns, adjust stock, manage maintenance. A duty only works for a role that also has its page in full.
- **Exceptions:** one person can be given a page their role lacks, lose one it has, or hold it at another level.
- **Starting point:** each role begins with the pages and duties it had before this became configurable (see [Demo logins](#demo-logins)). Sales, Finance, Workforce, Reports, Dashboard, Approvals and Users start as admin only, and so do all approvals. "Original access" and "Original duties" restore this for the built-in roles.
- **Enforced on the server.** Every API call is checked against the pages that use that part of the system, whatever the screen shows. A change applies from the person's next request, with no need to sign in again.
- **Reading and changing are separate.** A page gives access to what it shows. For example the Sorting page reads deliveries, but only the Warehouse page can change them.
- **Business rules are not affected.** Quarantine, stock checks, closed periods and the like apply to everyone. Deleting inspections, work orders and documents, quality standards, document categories, notification rules and the Users page stay with admins.
- **Safeguards:** admins always have every page and duty. The Users page can't be given to any other role or person. The last active admin can't be demoted, deactivated or deleted. Every change to roles, pages and duties is written to the audit log.
- **API:** `/api/v1/access/` (`me`, `role-names`, `roles`, `matrix`, `duties`, `users/<id>`).
- **More:** [docs/manual/05-access-control.md](docs/manual/05-access-control.md).

### Consistency checks

```bash
python manage.py reconcile_inventory        # ledger vs. drying sessions/dispatches, negative stock, oversold orders
python manage.py customer_duplicates        # customers with near-identical names
```

## Going live and daily use

- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md):** server setup, HTTPS, the go-live checklist, backups and restore, monitoring and updates.
- **[docs/USER_GUIDE.md](docs/USER_GUIDE.md):** how to do the daily work, by task.
- **Backups:** `sh scripts/backup.sh` saves the database and the uploaded documents; `sh scripts/restore.sh` puts them back.
- **Health check:** `GET /api/health/` answers 200 when the API can reach its database.

## Roadmap

All planned modules are built. Not built, and listed so nobody relies on them: two-factor login and password-reset e-mails, multi-warehouse transfers, barcode and QR scanning, virus scanning of uploads, a report scheduler inside the app (cron lines are in the deployment guide), configurable approval chains, and the optional AI features. See [docs/UPGRADE_AUDIT.md](docs/UPGRADE_AUDIT.md) for the per-phase status.

## Author

Raja Faraz Tariq
