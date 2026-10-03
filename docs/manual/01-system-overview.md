# System overview

This page explains what the system is for, how material moves through it, what each module does, and what the system does not do. It is for anyone new to the system: owners, administrators, supervisors and developers.

## On this page

- [What the system is for](#what-the-system-is-for)
- [The material flow](#the-material-flow)
- [What runs alongside the flow](#what-runs-alongside-the-flow)
- [Modules at a glance](#modules-at-a-glance)
- [Parts without a page of their own](#parts-without-a-page-of-their-own)
- [Record numbers](#record-numbers)
- [What the system does not do](#what-the-system-does-not-do)
- [Glossary](#glossary)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## What the system is for

The system is a web application for a textile recycling factory. It follows waste fabric from the supplier's truck to the customer's delivery, and keeps the records a factory needs around that: purchasing, quality, production planning, maintenance, sales, finance, people, environmental figures and documents.

It is built for one factory with one stock of sellable material. People sign in with their own account. What each person can open and change depends on their role. See [Roles and responsibilities](04-roles-and-responsibilities.md) and [Access control](05-access-control.md).

The screens are in English. Money is shown in rupees ("Rs."). Weights are in kilograms.

## The material flow

Material moves through seven steps. Each step is done on its own page.

```
Supplier
   │
   ▼
1. Delivery            Warehouse page    a "stock entry" with the weights
   │
   ▼
2. Incoming inspection Quality page      Pass, Conditional or Fail (Fail = quarantine)
   │
   ▼
3. Sorting             Sorting page      a "fabric lot" is made from the delivery,
   │                                     then sorted in sessions
   ▼
4. Decolorization      Decolorization    a session (batch) in a tank, with chemicals
   │
   ▼
5. Drying              Drying page       a session on a dryer
   │
   ▼
6. Sellable stock      (stock ledger)    dried output is the only stock that can be sold
   │
   ▼
7. Sales               Sales page        quotation → order → dispatch → invoice → payment
   │
   ▼
Customer
```

| Step | What is recorded | What the system does |
|---|---|---|
| 1. Delivery | Supplier (vendor), fabric type, the supplier's weight slip, vehicle number, our weight, unloading weight, factory unit, status. Optionally the purchase order line it belongs to. | If a purchase order line is chosen, the order's status follows the weight received. |
| 2. Incoming inspection | An inspection of the delivery, with an optional checklist (a quality standard). | A **Fail** result puts the delivery in quarantine. It cannot be sent to sorting until it is released. A delivery that was never inspected is not held. |
| 3. Sorting | A fabric lot made from a delivery. Sorting sessions take weight from the lot; completing a session records the sorted weight and the waste. | The lot's **Remaining** weight goes down. When nothing remains, the lot's status becomes **Sorted**. |
| 4. Decolorization | A session in a tank for a lot, with input weight. Chemicals are issued to the tank. A recipe can be chosen. Completing records output and waste. | Issued chemicals leave chemical stock and are added to the batch running in that tank. On completion the tank becomes **Completed** and the lot's status becomes **Sent to Decolorization**. |
| 5. Drying | A session on a dryer for a lot, with input weight. It is started, then completed with dried output and waste. | Completing adds the dried output to the stock ledger for that lot. The dryer becomes **Cooling**. |
| 6. Sellable stock | Nothing is typed in. | Stock on hand is the sum of the ledger's movements: drying output, dispatches, restocked returns and adjustments. |
| 7. Sales | Quotation (optional), order, dispatch, invoice, payment, return. | Confirming an order reserves stock. A dispatch takes stock out. An approved return can put stock back. |

The full steps, with who does each one and the status after it, are in [Workflows](08-workflows.md).

Two points are worth knowing from the start:

- **Only dried output can be sold.** The stock ledger holds dried stock only. Raw deliveries, sorted material and decolorized material are tracked by their own records (deliveries, lots and sessions), not by the ledger.
- **A lot is the thread.** The same fabric lot is used in sorting, decolorization, drying, production orders, quality inspections and sales orders. The Traceability page follows one lot through all of them.

## What runs alongside the flow

| Area | What it adds to the flow |
|---|---|
| Purchasing | Purchase requests and orders before a delivery arrives; supplier invoices and payments after it. |
| Quality | Inspections at three stages (incoming, in-process, finished), quarantine, and corrective actions. |
| Production | A production order plans the processing of one lot through a list of stages, and compares planned with actual output, time and cost. It moves no stock. |
| Maintenance | Machines, breakdowns, preventive schedules, work orders and spare parts. |
| Finance | A double-entry journal fed by sales invoices, customer payments, approved returns, supplier invoices, supplier payments and expenses. |
| Sustainability | Waste records and utility readings; recovery, waste, water, energy and chemical figures worked out from the factory's records. |
| Workforce | Employees, attendance, leave and tasks. |
| Documents | Uploaded files with categories, versions and expiry dates. |

## Modules at a glance

"Who uses it at the start" is the starting access, before an administrator changes anything. Admins always have every page. How access can be changed is explained in [Access control](05-access-control.md).

| Page (menu group) | What it is for | Who uses it at the start | Guide |
|---|---|---|---|
| Dashboard (Overview) | Live material flow, period comparisons, a "Needs attention" list, "Business at a glance" figures from every module, recent activity. | Admin | [Dashboard and reports](07-modules/dashboard-and-reports.md) |
| Approvals (Overview) | One inbox for everything waiting for a decision, and the notification rules. | Admin | [Approvals and notifications](07-modules/approvals-and-notifications.md) |
| Traceability (Overview) | The whole history of one fabric lot on one page. | Admin and every supervisor | [Search and traceability](07-modules/search-and-traceability.md) |
| Warehouse (Operations) | Deliveries (stock entries), vendors and factory units. | Admin, Warehouse Supervisor | [Warehouse](07-modules/warehouse.md) |
| Sorting (Operations) | Fabric lots and sorting sessions. | Admin, Sorting Supervisor | [Sorting](07-modules/sorting.md) |
| Decolorization (Operations) | Tanks, chemicals, chemical lots, recipes, issuances, sessions and chemical usage. | Admin, Decolorization Supervisor | [Decolorization](07-modules/decolorization.md) |
| Drying (Operations) | Dryers and drying sessions. Completed output becomes sellable stock. | Admin, Drying Supervisor | [Drying](07-modules/drying.md) |
| Quality (Operations) | Standards, inspections, quarantine and corrective actions. | Admin and every supervisor. Each role inspects its own stage. | [Quality](07-modules/quality.md) |
| Production (Operations) | Production orders, schedule, material needs, routings, bills of materials and process stages. | Admin plans. Sorting, Decolorization and Drying Supervisors run the stages. | [Production](07-modules/production.md) |
| Maintenance (Operations) | Machines, work orders, preventive schedules, spare parts and a performance report. | Admin and every supervisor | [Maintenance](07-modules/maintenance.md) |
| Sustainability (Operations) | Waste records, utility readings, targets and an environmental report. | Admin and every supervisor | [Sustainability](07-modules/sustainability.md) |
| Purchasing (Commercial) | Purchase requests, purchase orders, supplier invoices, payments, returns, quotes and supplier performance. | Admin, Warehouse Supervisor | [Purchasing](07-modules/purchasing.md) |
| Sales (Commercial) | Quotations, orders, dispatches, invoices, payments, returns, customers, products and a performance report. | Admin | [Sales](07-modules/sales.md) |
| Finance (Commercial) | Chart of accounts, journal, expenses, balances, statements, costing, periods and tax rates. | Admin | [Finance](07-modules/finance.md) |
| Documents (Administration) | Uploaded files by category, with versions and expiry dates. | Admin and every supervisor. Each role sees the categories opened to it. | [Documents](07-modules/documents.md) |
| Workforce (Administration) | Employees, departments, job roles, shifts, attendance, leave, tasks and productivity. | Admin | [Workforce](07-modules/workforce.md) |
| Reports (Administration) | Daily production, monthly sales and waste analysis reports, the report centre and the audit log. | Admin | [Dashboard and reports](07-modules/dashboard-and-reports.md) |
| Users (Administration) | User accounts, and page access for roles and for single people. | Admin only. This page can never be given to another role. | [Users](07-modules/users.md) |

The home page (the first page after signing in) is open to every signed-in user. It lists the pages that user can open.

## Parts without a page of their own

| Part | Where you meet it | Guide |
|---|---|---|
| Stock ledger (inventory) | The "available" figures on the Sales order form, the Dashboard's "Sellable stock", the Traceability page and the stock reports. | [Inventory](07-modules/inventory.md) |
| Notifications | The bell in the header and the Dashboard's "Needs attention" list. | [Approvals and notifications](07-modules/approvals-and-notifications.md) |
| Search | The "Search or jump to…" box in the header (Ctrl + K). | [Search and traceability](07-modules/search-and-traceability.md) |
| Audit log | A tab on the Reports page. | [Audit and logging](14-audit-and-logging.md) |
| Access | A tab on the Users page. | [Access control](05-access-control.md) |

## Record numbers

Most records get a number when they are first saved. The number is a prefix and the record's id, padded to five digits (for example `PO-00042`).

| Prefix | Record | Module |
|---|---|---|
| `PR-` | Purchase request (requisition) | Purchasing |
| `PO-` | Purchase order | Purchasing |
| `RET-` | Return to supplier | Purchasing |
| `QC-` | Quality inspection | Quality |
| `MO-` | Production order | Production |
| `QT-` | Sales quotation | Sales |
| `INV-` | Sales invoice | Sales |
| `SR-` | Sales return | Sales |
| `DC-` | Delivery challan (one per dispatch) | Sales |
| `WO-` | Maintenance work order | Maintenance |
| `JV-` | Journal entry | Finance |
| `EXP-` | Expense | Finance |
| `EMP-` | Employee | Workforce |
| `DOC-` | Document | Documents |

Deliveries, fabric lots, sessions, sales orders, dispatches and payments have no prefix. They are shown with their plain number, for example "Order #15" or "Lot #7".

**For developers:** numbered records inherit `NumberedModel` in `backend/apps/procurement/models.py`. The challan number is not stored; it is built from the dispatch id in `backend/apps/sales/serializers.py`.

## What the system does not do

These things are **not built**. Each one was checked against the code, so nobody should rely on it being there.

### Signing in and accounts

| Not there | What exists instead |
|---|---|
| Two-factor sign-in. | Sign-in is by username or e-mail and a password. Sign-in attempts are rate limited (10 per minute by default). |
| Password-reset e-mails ("forgot my password"). | An Admin types a new password for the user on the Users page. See [Admin guide](06-admin-guide.md). |
| A screen where a user changes their own password. | Only an Admin can change a password, on the Users page. |
| A "deleted items" bin. | Deleting a record removes it for good. The audit log keeps a line saying who deleted it. Many records refuse deletion when other records depend on them. |

### Stock and production

| Not there | What exists instead |
|---|---|
| Several warehouses, stock locations, or transfers between them. | One stock of dried material, kept per fabric lot. Factory units are labels on deliveries, purchase requests, sorting sessions and production orders. |
| Barcode or QR code scanning. | Records are found by typing in the search box. |
| A stock ledger for raw, sorted or decolorized material. | Only dried output is in the ledger. Earlier stages are followed through deliveries, lots and sessions. |
| A screen for manual stock adjustments. | The adjustment exists only as an API call (`POST /api/v1/inventory/movements/adjust/`), for a role with the duty *Adjust stock* (Admin by default). See [Inventory](07-modules/inventory.md). |
| Stock movement from production orders. | A production order is a plan and a cost record. Sorting, decolorization and drying sessions do the real work, and drying output feeds the ledger. |
| Stock changes from returns to suppliers. | A return to a supplier is a record only. It does not change the delivery or any stock. |

### Approvals and notifications

| Not there | What exists instead |
|---|---|
| Approval chains with several approvers in sequence, or amount limits. | Every approval is one decision by one person. |
| Notifications stored per person, or sent to each user by e-mail. | Notifications are worked out from live records each time. "Read" marks are kept in the user's browser. E-mails go to one management address (`MANAGEMENT_EMAIL`). |
| A scheduler inside the application. | The daily report, monthly report, alert digest and stock check are commands. The server's own scheduler (cron) must run them. See [Deployment](12-deployment.md). |

### Money and people

| Not there | What exists instead |
|---|---|
| Certified statutory accounting or tax filing. | Finance supports the business's own bookkeeping. |
| Automatic tax calculation from a tax table. | Tax rates are a reference list. The tax % is typed on each order, quotation or invoice. |
| Several currencies. | All amounts are in rupees. |
| Payroll. | Workforce holds employees, attendance, leave and tasks. Pay is not handled. |
| Attendance written automatically from approved leave. | The attendance sheet suggests "Leave" for people on approved leave. Someone still saves the sheet. |

### Documents and other

| Not there | What exists instead |
|---|---|
| Virus scanning of uploaded files. | Uploads are checked for size, file type and that the content matches the type. |
| Files attached directly to a record's own screen. | A document can name the record it belongs to ("Belongs to"), as text. |
| Environmental certification. | Sustainability figures are calculated from the factory's records. No certification is claimed. |
| Automatic forecasts, suggestions or a chat assistant. | None. Every figure is worked out from the records by fixed rules. |
| Languages other than English, or a choice of time zone per user. | The screens are in English. The server's time zone is set once (`Asia/Karachi` in `backend/config/settings.py`). |

## Glossary

The words below are the ones the screens use. Each was checked against the code.

### Material and stock

| Term | Meaning |
|---|---|
| **Vendor / Supplier** | The same record. The Warehouse page calls it a vendor; Purchasing and Quality call it a supplier. |
| **Factory unit** | A named part of the factory (for example "Unit 1"). Chosen on deliveries, purchase requests, sorting sessions and production orders. |
| **Delivery / Stock entry** | One truckload received at the warehouse. Its statuses are Received, Pending, Approved and Rejected. A rejected delivery does not count towards a purchase order. |
| **Our weight / Unloading weight** | Two weights kept on a delivery. "Our weight" is the factory's own weighbridge figure and is the one used in reports and purchase order receipts. |
| **Fabric lot (lot)** | A quantity of one material made from a delivery, on the Sorting page. It carries an initial quantity, a sorted quantity and a remaining quantity. The lot is what later stages, production orders and sales orders point to. |
| **Session** | One run of work on a lot: a sorting session, a decolorization session or a drying session. A session has an input weight and, once completed, an output weight and a waste weight. |
| **Batch** | Another word for a decolorization session ("Approve batch", "Batch #12"). A tank also has a "Batch ID" field, which is a label typed when the tank is set up. |
| **Tank** | Equipment for decolorization. Statuses: Empty, Filled, Processing, Completed, Cleaning. |
| **Dryer** | Equipment for drying. Statuses: Available, Running, Cooling, Maintenance. |
| **Efficiency** | Output divided by input of a completed session, as a percentage. |
| **Sellable stock / Dried stock** | The output of completed drying sessions. The only stock that can be sold. |
| **Stock ledger / Movement** | The list of every change to sellable stock. Kinds: Drying output, Dispatch, Sales return, Adjustment. |
| **On hand** | The sum of a lot's ledger movements. |
| **Reservation / Reserved** | Weight held for orders that are Confirmed or Dispatched and not yet fully dispatched. |
| **Available** | On hand minus reserved. An order can only be confirmed if this covers it. |
| **Adjustment** | A manual correction to sellable stock, with a required reason. |

### Chemicals

| Term | Meaning |
|---|---|
| **Chemical** | A stock item on the Decolorization page with total stock, remaining stock, a cost per unit and safety details. |
| **Chemical lot** | One received batch of a chemical. Receiving it adds its quantity to the chemical's stock and sets the chemical's cost. Not the same thing as a fabric lot. |
| **Issuance** | Chemical taken out of stock for a tank. It keeps the cost per unit at that moment. |
| **Restricted chemical** | A chemical that can only be issued by a role with the duty *Issue restricted chemicals*. |
| **Recipe / Version** | A list of chemicals per 100 kg, with temperature, duration and water. Changing the chemicals or the process saves a new version; old versions stay. |
| **Chemicals used** | A view on a session that compares what the recipe planned with what was issued. |

### Quality

| Term | Meaning |
|---|---|
| **Standard** | A reusable checklist with limits, for one stage and optionally one material. |
| **Check** | One line of a checklist. Either a measurement judged against a minimum and/or maximum, or a pass/fail answer. |
| **Inspection** | A quality record for a delivery (stage "Incoming material") or a fabric lot ("In-process" or "Finished product"). Result: Pass, Conditional or Fail. |
| **Conditional** | Accepted with a written condition. |
| **Quarantine** | The state of a delivery or lot that has a failed inspection which has not been released. Quarantined material cannot go to sorting, start a session, be released into production, or be confirmed or dispatched on a sales order. |
| **Release** | Ending a quarantine, with a reason. A released inspection can no longer be changed. |
| **Corrective action / Preventive action** | A follow-up task on an inspection, with a person responsible and a due date. Statuses: Open, Done. |

### Purchasing

| Term | Meaning |
|---|---|
| **Purchase request (requisition)** | A request to buy material. "Requisition" is the word in the code and in the API; the screens say "request". Statuses: Draft, Submitted, Approved, Rejected, Ordered, Cancelled. |
| **Purchase order** | An order to a supplier. Statuses: Draft, Submitted, Approved, Partially Received, Received, Closed, Cancelled. |
| **Amendment / Revision** | Changing an approved order. Its revision number goes up by one and it goes back to Submitted for a new approval. |
| **Supplier invoice** | The supplier's bill. Its status (Unpaid, Partial, Paid) follows the payments. |
| **Supplier quote** | A price a supplier offered, kept for comparison. |
| **Return to supplier** | A record of material sent back from a delivery. |

### Sales

| Term | Meaning |
|---|---|
| **Customer / Buyer** | A customer record. Typing a buyer name on an order links it to the matching customer, or creates one. |
| **Product** | An item on the price list, with a list price per kg and optional prices per customer category. |
| **Quotation** | An offer to a customer. Statuses: Draft, Sent, Accepted, Rejected, Converted. |
| **Sales order** | Statuses: Draft, Confirmed, Dispatched, Completed, Cancelled. Payment status: Pending, Partial, Paid. |
| **Confirm** | The action that reserves stock for an order. |
| **Dispatch** | A shipment against an order. It takes its weight out of the stock ledger. Statuses: Pending, Loading, Dispatched, Delivered. |
| **Challan (delivery challan)** | The printable delivery note of one dispatch, numbered `DC-…`. |
| **Invoice** | The bill for dispatched goods. Its amounts are fixed when it is raised. Status: Unpaid, Partial, Paid or Overdue, worked out from the order's payments. |
| **Credit limit** | An optional limit on what a customer may owe. Going over it shows a warning; it never blocks. |
| **Statement** | A customer's orders, payments and return credits in date order with a running balance. |
| **Sales return** | Goods a customer sends back. Statuses: Requested, Approved, Rejected. An approved return credits the customer. |
| **Restock / Write off** | The choice on a return: put the weight back into sellable stock, or not. |

### Production and maintenance

| Term | Meaning |
|---|---|
| **Process stage** | A kind of processing step (Sorting, Shredding, Washing and so on). The list can be changed. |
| **Routing** | An ordered list of stages, each with planned hours and a cost per hour. |
| **Bill of materials** | What processing 100 kg of input needs. |
| **Production order** | A plan to process one lot. Statuses: Draft, Released, In Progress, Completed, Cancelled. |
| **Release** (production) | Sending a draft order to the floor. After release only its dates, priority, unit and notes can change. |
| **Step** | One stage of one order. Statuses: Pending, In Progress, Done, Skipped. |
| **Machine** | An entry in the maintenance register. Statuses: Running, Idle, Under maintenance, Broken down, Retired. |
| **Work order** | A maintenance job. Type: Preventive or Corrective. Statuses: Open, In progress, Done, Cancelled. |
| **Breakdown** | A work order marked "Machine stopped". While it is open the machine shows as Broken down. |
| **Schedule** | A preventive task repeated every so many days on one machine. |
| **Downtime** | Minutes a machine was stopped, recorded when a work order is completed. |
| **Spare part** | A stocked part with a reorder level. Using a part on a work order takes it out of stock. |

### Finance

| Term | Meaning |
|---|---|
| **Account / Chart of accounts** | The list of accounts. Types: Asset, Liability, Equity, Income, Expense. |
| **Journal entry** | A balanced set of debit and credit lines. Entries are never edited or deleted. |
| **Reverse** | Cancelling a typed-in entry by posting its mirror image. |
| **Update books** | The button that brings the automatic entries in line with the sales, purchasing and expense records. |
| **Period** | A date range that can be closed. Closing locks every entry dated inside it. |
| **Expense** | Money paid out that is not a supplier invoice. |
| **Part of the factory (cost centre)** | The area an expense belongs to, used in costing. |
| **Ledger** (of an account) | Every line on one account with a running balance. |
| **Costing** | Production cost for a period, in total and per kg of dried output. |

### Access, alerts and records

| Term | Meaning |
|---|---|
| **Role** | The job a user account has. Each user has one role. |
| **Page** | One entry of the menu. Access is given per page. |
| **Page level** | How far a role or person goes on a page: No access, View only, or Full. |
| **Exception** | One person's own level for a page, different from their role's. |
| **Duty** | Something a role may do beyond opening a page, such as approving purchases. |
| **Approval** | A record waiting for a decision. All of them are listed on the Approvals page. |
| **Notification rule** | A rule that decides which problems appear in the bell. It can be switched on or off and given a threshold. |
| **Escalated** | A notification that has been open longer than its rule allows. It is listed first. |
| **Digest** | One e-mail that lists the open items of every rule marked "Send by e-mail". |
| **Audit log** | The record of who created, changed or deleted what, plus sign-ins, failed sign-ins and downloads. |
| **Document category** | A group of documents. The category decides which roles can see its documents. |
| **Version** (document) | Each uploaded file of a document. Older versions stay downloadable. |
| **Expiry status** | Valid, Expiring soon (within 30 days), Expired, or No expiry. |
| **Waste record** | Waste that was weighed and disposed of. Process loss is not entered here; it is worked out from sessions. |
| **Utility reading** | Water, electricity, gas, steam or diesel used. |
| **Recovery rate** | Dried output of completed drying sessions divided by the weight taken into completed sorting sessions, in the same period. |
| **Target** | A goal for one calculated sustainability figure. |

## Keeping this page up to date

- **Modules and menu:** `frontend/src/config/access.ts` (the `NAV` list) and `backend/apps/access/services.py` (`PAGES`, `DEFAULT_ROLE_PAGES`). Revise the modules table when a page is added, renamed or its starting access changes.
- **Material flow and statuses:** the `models.py` and `views.py` of `backend/apps/warehouse`, `sorting`, `decolorization`, `drying`, `inventory` and `sales`.
- **Record numbers:** every class with a `PREFIX` (search for `PREFIX =` in `backend/apps`).
- **What the system does not do:** recheck the list whenever a feature is added. The sources are the "Roadmap" in `README.md`, section 9 of `docs/DEPLOYMENT.md`, and the code itself.
- **Glossary:** status lists live in each module's `models.py` and in `frontend/src/features/<module>/schemas.ts`.
