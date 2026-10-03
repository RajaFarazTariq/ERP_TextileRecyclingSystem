# Dashboard and reports

This guide covers the Dashboard page (including "Business at a glance") and the Reports page: the three original reports, the report centre with its Excel and CSV exports, and, briefly, the audit-log tab. It is for administrators and managers; the last sections are for developers.

## On this page

- [What it does](#what-it-does)
- [Who can use it](#who-can-use-it)
- [Screens](#screens)
- [Records and fields](#records-and-fields)
- [Statuses](#statuses)
- [How to](#how-to)
- [Business rules](#business-rules)
- [Related data](#related-data)
- [For developers](#for-developers)
- [Common problems](#common-problems)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## What it does

**The Dashboard** is one screen of live figures: how much material moved through each stage, what is in sellable stock, sales and payments, a block of key figures from every module, what needs attention, and the latest activity.

**The Reports page** has five tabs:

- three reports that have been in the system from the start: **Daily production**, **Monthly sales** and **Waste analysis**, each with an Excel export;
- the **Report centre**: thirteen reports in one layout, each with a chart, a table, an explanation of how its figures are worked out, and Excel and CSV exports;
- the **Audit log**.

Both pages only read. They store nothing and change nothing. Each figure is worked out by the module that owns it, so a number here equals the number on that module's own page.

## Who can use it

| Page | Starting access |
|---|---|
| Dashboard | Admin only |
| Reports | Admin only |

No duty is involved. Both pages only show things, so holding them at View only is the same as Full.

How access is changed is explained in [Access control](../05-access-control.md).

**For administrators: before giving these pages to another role, note two things.**

- "Business at a glance" and the report centre show money, sales and staff figures to whoever can open the page, whatever other pages that person has. Only the document counts follow the document categories.
- The Dashboard page is enough to load the Dashboard. It reads the deliveries, sessions, sales orders, chemicals and stock it shows, for reading only, even when the user has no other page.

Every signed-in user also has a **home page** at `/` with a greeting and a card for each page they can open. That is not the Dashboard.

## Screens

### Dashboard

The page is at `/dashboard`. At the top right are a period filter (default: This month), a **Refresh** button, and the time the figures were last updated.

**Material flow** is a strip of five stages, each linking to its page:

| Stage | Figure | Small line |
|---|---|---|
| Warehouse | Kg received in the period, and the number of deliveries | Deliveries with status Pending ("N pending approval") |
| Sorting | Kg sorted in the period | Sessions in progress |
| Decolorization | Output of sessions completed in the period | Sessions in progress |
| Drying | Output of sessions completed in the period | Sessions in progress |
| Sellable stock | Kg free to sell now | Kg reserved |

**First row of cards**

| Card | Shows |
|---|---|
| Received, *period* | Kg received, with the change against the previous period and the number of deliveries |
| Sorted, *period* | Kg sorted, the change, and the share of the kg taken |
| Sellable stock | Kg on hand, split into reserved and free |
| Orders, *period* | Number of sales orders (cancelled left out), the change in their value, and the value |

**Second row of cards**

| Card | Shows |
|---|---|
| Collected (all time) | All customer payments, and how many |
| Outstanding | The value of all orders less all payments, and the number of orders with payment status Pending |
| Completed orders | Completed orders, of all orders |
| Chemicals | Number of chemicals; "N running low" or "All above 25%" |

**Business at a glance** is a block of nineteen figures, each a link to its module:

| Figure | Meaning | Links to |
|---|---|---|
| Cash and bank | Balance of the cash and bank accounts in use | Finance |
| Customers owe us | Total of customer balances | Finance |
| We owe suppliers | Total unpaid on supplier invoices | Finance |
| Profit this month | Income less expenses this month (highlighted when negative) | Finance |
| Open sales orders | Orders that are Confirmed or Dispatched, and their value | Sales |
| Overdue invoices | Customer invoices with status Overdue, and the amount unpaid | Sales |
| Pending purchase orders | Orders waiting for approval or for delivery; the hint shows how many to approve and how many are late | Purchasing |
| Production in progress | Production orders In Progress | Production |
| Production orders late | Open production orders past their planned end | Production |
| In quarantine | Failed inspections not released | Quality |
| Corrective actions open | Open corrective actions; the hint shows how many are overdue | Quality |
| Machines broken down | Machines with status Broken down | Maintenance |
| Maintenance overdue | Active schedules past their due date | Maintenance |
| Recovery rate | This month's recovery rate | Sustainability |
| Waste to landfill | This month's kg to landfill, of the waste handled | Sustainability |
| Documents expired | Documents past their expiry date | Documents |
| Documents expiring | Documents expiring within 30 days | Documents |
| People present today | Present, Half day and Late today, of all current employees | Workforce |
| On leave today | Employees with approved leave today | Workforce |

A figure shows "—" and "Not available" when its module's figures could not be worked out. The other figures still show.

**Order value by month** is a bar chart for the last 6 or 12 months, cancelled orders left out.

**Needs attention** lists the open notifications, most urgent first, each with a link (**Restock**, **Review**, **Pay**, **Renew**, **View** and so on). It is the same list as the bell. See [Approvals and notifications](approvals-and-notifications.md).

**Recent activity** shows the eight latest entries from the audit log, with a link **Full audit log** to the Reports page.

### Reports → Daily production

Choose a **Date** (default: today). Shows:

- **Warehouse**: stock entries and total weight received that day.
- **Sorting** and **Decolorization**: sessions, input, output, waste and efficiency, with a gauge.

Buttons: **Print**, **Export Excel**. The Excel file has four sheets: Summary, Warehouse Receipts, Sorting Sessions, Decolorization Sessions.

### Reports → Monthly sales

Choose a **Month** and a **Year** (the last six years are offered). Shows:

- Cards: Orders (and dispatches), Revenue (and kg sold), Collected, Outstanding (and average price per kg).
- **Orders by status** and **Payments by method**.

Buttons: **Print**, **Export Excel**. The Excel file has four sheets: Summary, Sales Orders, Payments, Dispatch.

### Reports → Waste analysis

Choose **From** and **To** (default: the last 30 days). Shows:

- Cards: Total input, Total waste, Waste rate, Sessions.
- A chart **Waste by fabric** (the eight fabrics with the most waste) and a table **By fabric**.

Buttons: **Print**, **Export Excel**. The Excel file has four sheets: Waste Summary, Waste by Fabric, Sorting Detail, Decolorization Detail.

### Reports → Report centre

On the left is the list of reports in groups. On the right are a period filter (default: This year), **Print**, **Export CSV** and **Export Excel**, and then the chosen report:

1. Its title, group, description, period and the time it was generated.
2. Summary figures, when the report has them.
3. A chart (bar charts show at most the first twelve rows).
4. The table, with a totals row. The first cell of each row links to the module page.
5. **How these figures are worked out**: notes in plain words.

**The reports**

| Group | Report | Shows |
|---|---|---|
| Stock | Inventory valuation | Sellable stock per lot: on hand, reserved, available, and its value at production cost |
| Stock | Stock movement | What went into and out of sellable stock, by lot and kind of movement |
| Production | Material recovery and waste | Input, output, loss and yield of each stage, and the overall recovery rate |
| Production | Sorting performance | Kg taken, sorted and wasted per supervisor and unit, with efficiency |
| Production | Production efficiency | Production orders: planned against actual output, hours and cost |
| Production | Chemical consumption | Quantity and cost of each chemical issued |
| Quality | Quality performance | Inspections passed, conditional and failed, by stage and by supplier |
| Commercial | Supplier performance | Orders, delivered and rejected weight, on-time delivery, prices and what is owed |
| Commercial | Customer sales | Orders, weight and value by customer, by material and by month |
| Finance | Production costing | What production cost, by kind of cost, and per kg of dried output |
| Finance | Profit and loss | Income and expenses by account, and the net profit |
| Sustainability | Waste and sustainability | Waste handled by disposal method, category and stage; landfill share, water and energy per kg |
| Maintenance | Machine utilisation | Availability, downtime, breakdowns and maintenance cost per machine |

Below the report is **Scheduled e-mail reports**. It describes the two reports the system can send by e-mail (the daily production summary and the monthly sales summary), the command that sends each, a suggested time, and whether a management e-mail address is set. It is information only: the system has no timer of its own. See [Approvals and notifications](approvals-and-notifications.md).

### Reports → Audit log

Four cards (All entries, Today, Last 7 days, Last 30 days), then filters (search, record type, action, From and To), an **Export (500 rows)** button, and a paged table: When, User, Action, Record, Changes, IP. An Admin sees every entry; other users see only their own.

The audit log is explained in [Audit and logging](../14-audit-and-logging.md).

## Records and fields

Nothing is stored. Every report in the report centre has the same shape:

| Part | Meaning |
|---|---|
| Title, group, description | From the catalogue |
| Period | First day, last day and a label such as "01 Jan 2026 to 31 Dec 2026" or "All time" |
| Generated at | When it was built |
| Columns | Each with a label and a kind: text, number, kg, money, percent or date |
| Rows | The table |
| Totals | One totals row |
| Notes | How the figures are worked out |
| Summary | A few headline figures (not every report) |
| Chart | A bar or line chart built from the rows (not every report) |

## Statuses

None.

## How to

### See how the factory is doing today

1. Open **Dashboard**.
2. Set the period to **Today**. The material flow, the first row of cards and their changes follow the period.
3. Press **Refresh** to reload the figures.

The second row of cards, "Business at a glance", "Needs attention" and "Recent activity" do not follow the period filter.

### Get the production figures for a day

1. Open **Reports**. The **Daily production** tab is open.
2. Choose the **Date**.
3. Press **Export Excel** for a file, or **Print**.

### Get the sales figures for a month

1. Open **Reports** and the **Monthly sales** tab.
2. Choose the **Month** and **Year**.
3. Press **Export Excel** or **Print**.

### Run a report in the report centre

1. Open **Reports** and the **Report centre** tab.
2. Choose a report on the left.
3. Choose the period. For **Custom range**, the start must be on or before the end.
4. Read "How these figures are worked out" under the table.
5. Press **Export Excel**, **Export CSV** or **Print**.

### Value the stock

1. In the report centre choose **Inventory valuation**.
2. Choose a period in which drying sessions were completed. The cost per kg comes from that period.
3. Read the **Stock value** figure and the Value column.

### Find who changed a record

Open **Reports** and the **Audit log** tab. See [Audit and logging](../14-audit-and-logging.md).

## Business rules

### Dashboard

- **Period figures** (Received, Sorted, Orders, decolorized and dried output) count records dated in the chosen period. The change is against the period just before it (the previous day, week, month and so on).
- **Received** uses each delivery's own weight ("our weight"), by the day it was recorded.
- **Sorted** counts sessions by their start date.
- **Decolorized** and **Dried** count only Completed sessions, by their end date.
- **Orders** leaves out cancelled orders.
- **Sellable stock** is now: on hand, reserved and free across all lots. See [Inventory](inventory.md).
- **Collected**, **Outstanding** and **Completed orders** are all-time figures over every order, including Draft and Cancelled ones. See [Sales](sales.md).
- **Chemicals → running low** counts the open "low chemical stock" notifications.
- **Business at a glance**:
  - If one module's figures fail, that module shows "Not available" and the rest still show.
  - The finance figures bring the books up to date first.
  - The document counts follow the user's document categories. The other figures do not follow the user's pages.

### The three original reports

| Report | Rules |
|---|---|
| Daily production | Warehouse counts deliveries recorded that day, using the unloading weight. Sorting and decolorization count sessions that **started or ended** that day, whatever their status. Efficiency = output ÷ input. Figures are rounded to whole kg |
| Monthly sales | Counts every order created in the month, whatever its status, including Draft and Cancelled. Collected counts payments dated in the month. Outstanding = revenue − collected, never below zero. Average price is the plain average of the orders' prices per kg |
| Waste analysis | Counts only Completed sorting and decolorization sessions that ended in the period. Drying is not included. "By fabric" covers sorting only. Waste rate = waste ÷ input |

Messages: a bad date answers "Invalid date format. Use YYYY-MM-DD." (daily production) or "Invalid date format." (waste analysis); a bad month or year answers "Invalid year/month."; on screen an inverted range says "Choose a start date on or before the end date."

These three reports are older than the report centre and use slightly different rules from it. For example, the report centre's *Material recovery and waste* includes drying and uses the Sustainability module's definitions. When two figures differ, read each report's rules.

### Report centre

| Rule | Message |
|---|---|
| An unknown report | "There is no report with this name." |
| The format must be json, xlsx or csv | "Choose json, xlsx or csv." |
| Dates are YYYY-MM-DD | "Enter a date as YYYY-MM-DD." |
| The end cannot be before the start | "Can't be before the start date." |
| No period means all time | |
| Weeks start on Monday | |

How the periods work: "This week" is Monday to Sunday of the current week; "This month" and "This year" are the whole month and year, including days still to come.

Reports with their own period rules:

| Report | Rule |
|---|---|
| Inventory valuation | The stock figures are as they stand **now**, whatever the period. The period only decides the cost per kg. Value = kg on hand × production cost per kg, one rate for the whole factory. When nothing was dried in the period, there is no rate and the value is empty |
| Supplier performance | Always covers all time. The date filter does not change it; the page says "This report always covers all time." |
| Machine utilisation | Always covers a set number of days. With no period it uses the last 90 days, and it never runs past today |
| Production efficiency | Lists production orders whose planned start is in the period; cancelled orders are left out. The total yield covers completed orders only |
| Sorting performance | Counts sessions completed in the period, by the day they were completed |
| Customer sales | The same orders are listed three ways (by customer, by material, by month); the total counts each order once |
| Waste and sustainability | The same waste records are listed four ways; the total counts each record once |
| Quality performance | Pass rate = inspections that did not fail ÷ all inspections. The total counts each inspection once |

**Exports**

- The Excel file has one sheet with a title, the period, the date it was generated, the table, the totals row and the notes. Numbers are stored as numbers and dates as dates.
- The CSV file has the header row, the rows and the totals row. Column headers carry their unit: "(kg)", "(Rs.)" or "(%)".
- File names follow the pattern `customer_sales_2026-01-01_to_2026-12-31.xlsx`; with no period the name ends in `all_time`.
- The table's own **Export** buttons elsewhere in the application are different: they save what is on screen as CSV in the browser.

## Related data

The Dashboard and the reports read almost every module:

| Module | Used for |
|---|---|
| [Warehouse](warehouse.md), [Sorting](sorting.md), [Decolorization](decolorization.md), [Drying](drying.md) | Material flow; daily production; waste analysis; sorting performance; chemical consumption |
| [Inventory](inventory.md) | Sellable stock; inventory valuation; stock movement |
| [Sales](sales.md) | Orders and payments; monthly sales; customer sales; open orders and overdue invoices |
| [Purchasing](purchasing.md) | Pending and late purchase orders; supplier performance |
| [Finance](finance.md) | Cash, receivable, payable, profit; production costing; profit and loss; the cost per kg used to value stock |
| [Production](production.md) | Orders in progress and late; production efficiency |
| [Quality](quality.md) | Quarantine and corrective actions; quality performance |
| [Maintenance](maintenance.md) | Breakdowns and overdue schedules; machine utilisation |
| [Sustainability](sustainability.md) | Recovery rate and landfill; material recovery; waste and sustainability |
| [Documents](documents.md) | Expired and expiring documents |
| [Workforce](workforce.md) | People present and on leave today |
| [Approvals and notifications](approvals-and-notifications.md) | "Needs attention"; the scheduled e-mail reports |

Running or exporting a report is not written to the audit log (downloads of documents are; see [Documents](documents.md)).

## For developers

**Backend:** `backend/apps/reports`. The app has no models.

| File | Contents |
|---|---|
| `views.py` | The three original reports as function views (`daily_production_report`, `monthly_sales_report`, `waste_analysis_report` and their `_export` twins), and the shared Excel styling helpers |
| `services.py` | `Period` and `period_from`; one function per report centre report; `REPORTS` (the catalogue); `run`; `schedules`; the executive blocks (`EXECUTIVE_BLOCKS`, `executive`) |
| `centre.py` | `CatalogueView`, `RunReportView`, `SchedulesView`, `ExecutiveView` |
| `exports.py` | `xlsx_response`, `csv_response` |
| `tests.py` | The original reports, the catalogue, every report's numbers, and the executive figures |

Design points:

- A report function takes `(period, user)` and returns `columns`, `rows`, `totals`, `notes`, and optionally `summary` and `chart`. `run()` adds the title, group, period and time.
- Figures come from the owning module's service functions. Three reports (chemical consumption, supplier performance, customer sales) call the owning module's report **view** through `_module_view`, because the calculation lives in that view. That view checks the user's permission as usual, so a user without access to the module gets an error for that report.
- A row may carry `_href`; the screen turns the first cell into a link.
- To add a report: write the function, add it to `REPORTS` with a key, group, title and description (and `'dated': False` if the period does not apply). The screen needs no change. Add a new group name to `GROUPS` if needed.
- To add a figure to "Business at a glance": add a block to `EXECUTIVE_BLOCKS`, extend `ExecutiveSummary` in `frontend/src/types/reports.ts`, and add the item in `glanceItems()` in `dashboard-page.tsx`. Each block runs in its own transaction, so one failure does not spoil the others.

**Endpoints** (under `/api/v1/reports/`). All need the Reports page or the Dashboard page.

| Method and path | Purpose |
|---|---|
| `GET /daily-production/?date=YYYY-MM-DD` | Daily production figures |
| `GET /daily-production/export/?date=` | The same as Excel |
| `GET /monthly-sales/?year=&month=` | Monthly sales figures |
| `GET /monthly-sales/export/?year=&month=` | The same as Excel |
| `GET /waste-analysis/?start=&end=` | Waste analysis figures (default: the last 30 days) |
| `GET /waste-analysis/export/?start=&end=` | The same as Excel |
| `GET /catalogue/` | `groups` and `reports` (key, title, description, group, dated) |
| `GET /run/{key}/` | One report as JSON. Takes the date parameters (`date_filter`, `year`, `month`, or `start` and `end`) |
| `GET /run/{key}/?format=xlsx` or `?format=csv` | The same report as a file |
| `GET /schedules/` | The scheduled e-mail reports and whether a recipient is set |
| `GET /executive/` | "Business at a glance": `as_of` and one block per module, or `null` for a block that failed |

The Dashboard also reads `warehouse/stock`, `sales/orders`, `sales/orders/summary`, `sorting/sessions`, `decolorization/sessions`, `drying/sessions`, `decolorization/chemicals`, `inventory/movements/stock`, `alerts/notifications` and `audit/logs`.

**Frontend:**

- Dashboard: `frontend/src/features/dashboard/` (`dashboard-page.tsx`, `use-attention.ts`). Route: `frontend/src/app/(app)/dashboard/page.tsx`.
- Reports: `frontend/src/features/reports/` (`reports-page.tsx`, `report-sections.tsx`, `report-centre.tsx`, `audit-log.tsx`). Route: `frontend/src/app/(app)/reports/page.tsx`.
- Home page: `frontend/src/app/(app)/page.tsx`.
- Types: `frontend/src/types/reports.ts` and `frontend/src/types/api.ts`.

The period figures on the Dashboard are worked out in the browser from the full lists (`figures()` in `dashboard-page.tsx`), not by the server.

**Tests:** `backend/apps/reports/tests.py`.

**Browser scenario:** `frontend/e2e/reports.mjs`. Dashboard figures, the attention panel, recent activity and the nineteen glance figures → the three reports and their Excel exports → an inverted date range → the audit log (filter, paging, export) → the report centre (thirteen reports, a second report, the date filter, Excel and CSV exports, the scheduled-reports card).

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| A "Business at a glance" figure says "Not available" | That module's figures failed; the reason is in the server log ("Executive dashboard: the … figures failed") | Read the log; the other figures are not affected |
| Outstanding on the Dashboard looks too high | It is the value of every order, including Draft and Cancelled, less all payments | Use Finance → Balances for what customers owe |
| Monthly sales revenue differs from the report centre's Customer sales | Monthly sales counts every order created in the month; Customer sales counts only Confirmed, Dispatched and Completed orders | Use Customer sales for sales figures |
| Waste analysis differs from "Material recovery and waste" | Waste analysis leaves drying out and counts only recorded waste of completed sorting and decolorization sessions | Use the one whose rules match the question |
| Inventory valuation shows no value | No drying session was completed in the chosen period, so there is no cost per kg | Choose a period with dried output |
| Supplier performance does not change with the period | That report always covers all time | Expected |
| A report in the report centre shows an error for a non-Admin | The report is built by a module the user cannot open | Give the module's page, or have an Admin run it |
| An export downloads nothing | The browser blocked the download, or the session has ended | Allow downloads for the site; sign in again |
| "Scheduled e-mail reports" says no address is set | `MANAGEMENT_EMAIL` is empty | Set it; see [Configuration](../11-configuration.md) |

## Keeping this page up to date

- `backend/apps/reports/services.py`: the report centre's catalogue, each report's columns and notes, the period rules, the executive blocks.
- `backend/apps/reports/views.py`: the three original reports and their Excel sheets.
- `backend/apps/reports/centre.py` and `exports.py`: endpoints, permission and file formats.
- `frontend/src/features/dashboard/dashboard-page.tsx` and `use-attention.ts`: the Dashboard's cards, the glance items and what each needs to load.
- `frontend/src/features/reports/*`: the Reports page's tabs, filters and buttons.
