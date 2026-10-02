# Approvals and notifications

This guide covers the notification bell, the notification rules behind it, the Approvals page, the e-mail digest (`send_alert_digest`), and the older e-mail alerts and scheduled reports. It is for administrators; the last sections are for developers.

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

There are four separate things here.

1. **Notifications (the bell).** Seventeen fixed rules each look at the live records of another module and list what needs attention right now: low stock, material in quarantine, overdue invoices, things waiting for approval and so on. Nothing is stored per notification. An item disappears by itself once the problem is solved.
2. **The Approvals page.** One inbox of everything waiting for a decision, read from the modules that own it. Nothing is decided here: each button calls the owning module, and that module's own rules apply.
3. **The e-mail digest.** A command that e-mails the open items of the rules marked "Send by e-mail" to the management address. Nothing sends it by itself; it has to be run or scheduled.
4. **The older e-mail alerts and reports.** E-mails sent at the moment something happens (an order completed, a payment received, a dispatch sent out, a chemical running low), and two scheduled reports with an Excel attachment (daily production, monthly sales).

The code for 1 to 3 is the `alerts` app. The code for 4 is the `notifications` app. They are independent of each other.

## Who can use it

| What | Who |
|---|---|
| The bell | Every signed-in user. Each user sees only the rules sent to their role, and only for pages they have |
| The dashboard's "Needs attention" panel | The same list, for users who have the Dashboard page |
| The Approvals page | Admin by default. It can be given to other roles; see [Access control](../05-access-control.md) |
| Changing notification rules | Admin only. This cannot be given to another role |
| Running the digest and the scheduled reports | Whoever has access to the server's command line |

**Deciding an item** on the Approvals page needs whatever the owning module needs:

| Kind | Decision | Needs |
|---|---|---|
| Purchase requests | Approve, Reject | The Purchasing page at Full and the duty *Approve purchases* (Admin by default) |
| Purchase orders | Approve | The Purchasing page at Full and the duty *Approve purchases* |
| Quarantine | Release | The Quality page at Full and the duty *Release quarantine* (Admin by default) |
| Production orders | Release | The Production page at Full and the duty *Plan production* (Admin by default) |
| Sales returns | Approve, Reject | The Sales page at Full and the duty *Approve sales returns* (Admin by default) |
| Decolorization batches | Approve | The Decolorization page at Full and the duty *Approve decolorization batches* (Admin by default) |
| Leave requests | Approve, Reject | The Workforce page at Full |

So a role that is given the Approvals page sees the whole inbox, but can decide only the kinds its other pages and duties allow. The other buttons answer with the owning module's refusal.

## Screens

### The bell

The bell is in the header of every page. A badge shows the number of unread items, in the colour of the most serious one.

Pressing it opens a list titled **Needs attention**, with the line "N open · N unread". Items are grouped:

| Section | Holds |
|---|---|
| Escalated | Items open longer than their rule allows |
| Urgent | Severity "danger" |
| Warnings | Severity "warning" |
| For information | Severity "info" |

Each item reads as one sentence (for example "Caustic soda is below 25% (200 Liters left)"), may show a bar of the share left, an **Escalated** badge and "Since" a date. Pressing an item opens the page where it can be dealt with and marks it as read. The tick marks it as read without opening it. **Mark all as read** quiets the bell.

Marking as read only quiets the badge. The item stays listed, dimmed, until the problem is solved. A problem that comes back counts as new. Read marks are kept in the browser, per user name, so they do not follow the user to another computer.

The list refreshes every minute and when the browser window gets focus.

### Dashboard → Needs attention

The same items, with the link text of each rule (for example **Restock**, **Review**, **Pay**, **Renew**). See [Dashboard and reports](dashboard-and-reports.md).

### Approvals page

The page is at `/approvals`. Four cards:

| Card | Shows |
|---|---|
| Waiting for a decision | Total items, and in how many lists |
| Oldest item | How long the oldest item has waited |
| Waiting over a week | Items waiting 7 days or more |
| Notification rules on | Rules switched on, of the total. Users who are not Admins see "—" here |

Then one tab per kind, each with its count, and a **Rules** tab (shown to Admins only):

| Tab | Lists | Buttons |
|---|---|---|
| Purchase requests | Requests with status Submitted | **Approve**, **Reject** (reason required) |
| Purchase orders | Orders with status Submitted, including amendments | **Approve** |
| Quarantine | Failed inspections not yet released | **Release** (reason required) |
| Production orders | Orders with status Draft | **Release** |
| Sales returns | Returns with status Requested | **Approve**, **Reject** (note optional) |
| Decolorization batches | Completed sessions not yet signed off | **Approve** |
| Leave requests | Requests with status Pending | **Approve** (note optional), **Reject** (note optional) |

Columns: Number (a link to the owning page), a title and detail line, Amount / weight, who asked, and Waiting since (red from 7 days). Every table has search and **Export**.

A button opens a confirmation. Where the owning module takes a reason, the confirmation has a **Reason** or **Note** box. If the module refuses, its message is shown and nothing changes.

The inbox refreshes every minute.

### Approvals page → Rules

This tab is shown to Admins only. One row per notification rule. Columns: Rule (title and description), Status (On / Off), Threshold, Sent to, E-mail, Escalates.

Row actions: **Switch off** / **Switch on**, and **Edit**, which opens the rule's settings.

## Records and fields

### Notification rule

The seventeen rules are fixed. They cannot be added, removed or renamed. An Admin changes their settings:

| Field | Meaning | Rules |
|---|---|---|
| Switched on | Whether the rule lists anything | |
| Threshold | A number whose meaning depends on the rule; the form's label says what it counts | Only rules that have one. Required for those; not negative; for the chemical rule not more than 100 |
| Who receives it | Yes or No for each role that may receive the rule | Admins always receive it. Only roles that have the rule's page can be chosen |
| Send by e-mail | Adds the rule's items to the e-mail digest | Off for every rule to begin with |
| Escalate after days | An item open this many days is marked escalated and listed first | Whole days; empty means never |

**The rules, with their starting settings**

| Rule | Lists | Starts | Threshold (what it counts) | Sent to (besides Admin) | Page it belongs to |
|---|---|---|---|---|---|
| Low chemical stock | A chemical with less left than this share of its total stock | On | 25 (percent of total stock) | Decolorization Supervisor | Decolorization |
| Spare parts to reorder | A spare part at or below its reorder level | On | — | All four supervisors | Maintenance |
| Low dried stock | A lot with less dried stock free to sell than this weight | **Off** | 100 (kg free to sell per lot) | Drying Supervisor | Drying |
| More reserved than on hand | A lot whose orders reserve more than is in stock | On | — | — | Sales |
| Purchases waiting for approval | Submitted purchase requests and purchase orders | On | — | — | Purchasing |
| Delayed production orders | A production order past its planned end and not finished | On | 0 (days late before it is listed) | Sorting, Decolorization, Drying Supervisors | Production |
| Material in quarantine | A failed inspection not yet released | On | — | All four supervisors | Quality |
| Overdue corrective actions | An open corrective action past its due date | On | — | All four supervisors | Quality |
| Machine breakdowns | A breakdown work order still open | On | — | All four supervisors | Maintenance |
| Overdue preventive maintenance | A scheduled task past its due date | On | 0 (days overdue before it is listed) | All four supervisors | Maintenance |
| Overdue customer invoices | A customer invoice unpaid after its due date | On | 0 (days overdue before it is listed) | — | Sales |
| Customers over their credit limit | A customer who owes more than their limit | On | — | — | Sales |
| Supplier invoices to pay | An unpaid supplier invoice that is overdue or due soon | On | 7 (days before the due date) | — | Purchasing |
| Documents expiring | A document that has expired or expires soon | On | 30 (days before the expiry date) | All four supervisors | Documents |
| Unusual stock adjustments | A manual stock correction in the last 7 days larger than this weight | On | 500 (kg adjusted in one correction) | — | Sales |
| Sales returns waiting for approval | A customer return with status Requested | On | — | — | Sales |
| Leave requests waiting | A leave request with status Pending | On | — | — | Workforce |

"—" under "Sent to" means Admins only to begin with.

### A notification (not stored)

| Field | Meaning |
|---|---|
| Title and message | Read together as one sentence |
| Severity | danger, warning or info |
| Link | The page where it can be dealt with. For items waiting for approval, Admins are sent to the Approvals page and other roles to the owning module |
| Created | The day the problem started, when the rule knows it |
| Escalated | True when the rule has "Escalate after days" and the item is at least that old |
| Action | The link text on the dashboard: View, Restock, Reorder, Review, Pay or Renew |

### An approval item (not stored)

Number, title, detail, amount, weight, who asked, the date it has waited since, its age in days, the page it belongs to, and the decisions on offer.

## Statuses

Rules are **On** or **Off**. Notifications and approval items have no status: they exist while the condition holds.

**How severity is decided**

| Rule | Severity |
|---|---|
| Low chemical stock | Warning; danger when below 40% of the threshold (below 10% of stock with the default threshold of 25) |
| Spare parts to reorder | Warning; danger when the stock is zero |
| Low dried stock | Warning |
| More reserved than on hand | Danger |
| Purchases waiting for approval | Info |
| Delayed production orders | Warning; danger from 7 days late |
| Material in quarantine | Danger |
| Overdue corrective actions | Warning |
| Machine breakdowns | Danger |
| Overdue preventive maintenance | Warning |
| Overdue customer invoices | Danger |
| Customers over their credit limit | Warning |
| Supplier invoices to pay | Warning when due soon; danger when overdue |
| Documents expiring | Warning when expiring; danger when expired |
| Unusual stock adjustments | Warning |
| Sales returns waiting | Info |
| Leave requests waiting | Info |

**Order of the list:** escalated items first, then by severity (danger, warning, info), then oldest first.

## How to

### Decide something that is waiting

1. Open **Approvals**. The first tab with something waiting opens.
2. Press the number to open the record's own page if you need to look at it first.
3. Press the decision button, type the reason if asked, and confirm.

### Switch a rule off or on

1. Open **Approvals** and the **Rules** tab.
2. In the rule's row menu choose **Switch off** or **Switch on**.

A rule that is off lists nothing, for anyone, and is left out of the digest.

### Change what counts as "low" or "soon"

1. On the **Rules** tab choose **Edit** on the rule.
2. Change the number. The field's label says what it counts.
3. Press **Update**.

### Send a rule to another role

1. On the **Rules** tab choose **Edit** on the rule.
2. Under **Who receives it**, set the role to Yes.

Only roles that have the rule's page are offered, including roles you added. If no role is offered, the form says: "Admins only. The records behind this rule are not open to other roles." Give the role the page first (see [Access control](../05-access-control.md)).

### Make old items stand out

1. Edit the rule and type a number in **Escalate after days**.
2. Items open that long are marked **Escalated** and listed first, in the bell and in the digest.

Escalation works only for rules whose items carry a start date: purchases waiting, delayed production orders, quarantine, overdue corrective actions, breakdowns, overdue maintenance, overdue customer invoices, overdue supplier invoices, expired documents, stock adjustments, returns waiting and leave waiting.

### Set up the e-mail digest

**For administrators.**

1. Set `MANAGEMENT_EMAIL` and the e-mail settings in the server's environment. See [Configuration](../11-configuration.md).
2. On the **Rules** tab, edit each rule that should be included and set **Send by e-mail** to Yes.
3. On the server, in the `backend` folder, run:

   ```
   python manage.py send_alert_digest
   ```

4. To send it regularly, add that command to the server's scheduler (cron on Linux, Task Scheduler on Windows). The application has no scheduler of its own.

The command prints one of: "Digest sent with N item(s).", "Nothing to report; nothing sent." or "MANAGEMENT_EMAIL is not set; nothing sent."

### Send the daily and monthly reports

**For administrators.** Two more commands, also run by hand or from a scheduler:

```
python manage.py send_daily_report
python manage.py send_monthly_report
```

- `send_daily_report` e-mails **today's** production summary with an Excel file (sheets: Summary, Sorting Sessions, Decolorization Sessions), then e-mails a list of chemicals below 25% of their stock, if there are any.
- `send_monthly_report` e-mails the **previous calendar month's** sales summary with an Excel file (sheets: Summary, Sales Orders, Payments).

Both go to `MANAGEMENT_EMAIL`. Suggested times in the code are 18:00 every day and 08:00 on the first of the month.

## Business rules

### Notifications

| Rule | Message |
|---|---|
| Admins receive every rule that is on | |
| Another role receives a rule only when the rule lists the role **and** the user has the rule's page | |
| The documents rule also follows the document categories: a user is told only about documents in categories their role may see | |
| A rule can be sent only to roles that have its page | "This can't be sent to: sorting supervisor. That role has no access to the records behind this rule." |
| A rule with no number refuses one | "This rule has no number to set." |
| A rule with a number needs one | "Enter a number." |
| The number cannot be negative | "The number can't be negative." |
| The chemical rule's number is a percentage | "A percentage can't be more than 100." |
| "Escalate after days" takes whole days | The form says "Enter whole days, or leave it empty." |
| Rules cannot be added or deleted, and their title, description and threshold label cannot be changed | The request is refused (405), or the change is ignored |
| Only Admins read or change the rules | 403 |
| Saving a record never sends a digest e-mail | |
| The unusual-adjustments rule looks back 7 days. This window is fixed | |
| The low-dried-stock rule lists only lots that have stock on hand and whose free stock is between zero and the threshold | |

### The digest

- It contains only rules that are on **and** marked "Send by e-mail" **and** have something to report.
- It lists what an Admin would see.
- Subject: "[ERP] N item(s) need attention". The body groups items by rule; escalated items are marked.
- It goes to one address, `MANAGEMENT_EMAIL`. Without it, nothing is sent.
- If there is nothing to report, nothing is sent.

### The Approvals inbox

- It needs the Approvals page.
- It lists items for everyone who can open it, whatever they may decide.
- Each decision is made by the owning module at its own endpoint. The owning module checks the page, the duty and its own rules, and writes the audit log entry.
- Within a tab, the oldest item is first.
- "Waiting since" is: for a purchase request, purchase order, production order, sales return or leave request, the day it was created; for quarantine, the inspection date; for a decolorization batch, the day the session ended.
- A sales return's amount is the credit the customer gets if it is approved.

### The older e-mail alerts

These are sent at once, to `MANAGEMENT_EMAIL`, by the `notifications` app. They cannot be switched on or off from a screen. With no address set, they are skipped.

| When | Subject |
|---|---|
| A sales order's status becomes Completed | "[ERP] Order #12 Completed — Ali Traders" |
| A payment is recorded (not when one is edited) | "[ERP] Payment Received — Rs. 1,000 (Ali Traders)" |
| A dispatch's status becomes Dispatched | "[ERP] Order #12 Dispatched — Ali Traders" |
| A chemical issuance takes a chemical from 25% or more of its stock to below 25% | "[ERP] Low Chemical Stock — Caustic soda" |
| `send_daily_report` finds chemicals below 25% | "[ERP] Low Chemical Stock — N item(s)" |

The 25% in these e-mails is fixed in the code. It is not the threshold of the notification rule "Low chemical stock".

If an e-mail cannot be sent, the failure is written to the log and the record is still saved.

The same app also recalculates a sales order's payment status whenever a payment is saved or deleted. See [Sales](sales.md).

## Related data

Notifications and the inbox only read other modules. They change nothing themselves.

| Module | Read by |
|---|---|
| [Decolorization](decolorization.md) | Low chemical stock; batches waiting for sign-off |
| [Maintenance](maintenance.md) | Spare parts, breakdowns, overdue schedules |
| [Inventory](inventory.md) | Low dried stock, oversold lots, large adjustments |
| [Purchasing](purchasing.md) | Requests and orders waiting; supplier invoices to pay |
| [Production](production.md) | Delayed orders; Draft orders waiting for release |
| [Quality](quality.md) | Quarantine; overdue corrective actions |
| [Sales](sales.md) | Overdue invoices, credit limits, returns waiting |
| [Documents](documents.md) | Expired and expiring documents |
| [Workforce](workforce.md) | Leave requests waiting |
| [Dashboard and reports](dashboard-and-reports.md) | The dashboard shows the same notification list |

## For developers

### The `alerts` app

`backend/apps/alerts`:

| File | Contents |
|---|---|
| `models.py` | `NotificationRule` (settings only: `key`, `is_enabled`, `threshold`, `roles`, `send_email`, `escalate_after_days`) |
| `rules.py` | One collector function per rule (`COLLECTORS`), `RULE_PAGES` (the page behind each rule), `Context` (who is asking), `current_items(user)`, `digest()` |
| `approvals.py` | One generator per kind (`KINDS`), `pending()` |
| `digest.py` | `send_digest()` builds and sends the e-mail |
| `management/commands/send_alert_digest.py` | The command |
| `migrations/0002_default_rules.py` | Creates the seventeen rules with their starting settings |
| `tests.py` | Every rule, the audience rules, the settings, the inbox and the digest |

Design points:

- Nothing is stored per notification. Each request runs the collectors against live data. Each collector uses a fixed, small number of queries however many records there are (there is a test for this).
- An item's `id` is `<rule key>:<record id>` and stays the same while the problem lasts. The browser uses it to remember what was read.
- To add a rule: write a collector in `rules.py`, add it to `COLLECTORS` and `RULE_PAGES`, and create its `NotificationRule` row in a data migration.
- To add a kind of approval: write a generator in `approvals.py`, add it to `KINDS`, and add its column headings to `KINDS` in `frontend/src/features/approvals/schemas.ts` and its name to `ApprovalKind` in `frontend/src/types/alerts.ts`.

**Endpoints** (under `/api/v1/alerts/`):

| Method and path | Purpose | Needs |
|---|---|---|
| `GET /notifications/` | The caller's open items, in order | Any signed-in user with a role |
| `GET /approvals/` | The inbox: `total`, `oldest_days`, `groups` | The Approvals page |
| `GET /rules/`, `GET /rules/{id}/` | The rules with `allowed_roles` | Admin only |
| `PATCH /rules/{id}/` | Change `is_enabled`, `threshold`, `roles`, `send_email`, `escalate_after_days` | Admin only |

Each approval item carries `actions`: a list of `{name, label, path, success, reason_field, reason_required}`. The page posts to `path` (for example `sales/returns/4/approve`) with `{reason_field: "<text>"}` when there is a reason field.

**Frontend:** `frontend/src/features/approvals/` (`approvals-page.tsx`, `approvals-forms.tsx`, `schemas.ts`); the bell is `frontend/src/components/layout/notifications.tsx`; the shared query is `frontend/src/features/dashboard/use-attention.ts`. Route: `frontend/src/app/(app)/approvals/page.tsx`. Types: `frontend/src/types/alerts.ts`. Read marks are kept in `localStorage` under `erp.notifications-read.<username>`.

**Tests:** `backend/apps/alerts/tests.py`.

**Browser scenario:** `frontend/e2e/approvals.mjs`. The inbox and its tabs → approve a decolorization batch → a release that needs a reason → switch a rule off and on, and the rule form → the bell, "Mark all as read" → a supervisor has no Approvals page and is not told about money or staff matters.

### The `notifications` app

`backend/apps/notifications`:

| File | Contents |
|---|---|
| `signals.py` | Handlers on `sales.SalesOrder`, `sales.Payment` and `sales.DispatchTracking` that send the alerts and recalculate the payment status |
| `tasks.py` | The e-mail builders, the Excel builders, `send_daily_production_summary`, `send_monthly_sales_summary`, `check_chemical_stock_alerts`, `alert_if_chemical_became_low` (called from `apps/decolorization/views.py`) |
| `management/commands/send_daily_report.py`, `send_monthly_report.py` | The commands |
| `apps.py` | Connects the signals in `ready()` |
| `tests.py` | Signal wiring |

It has no models, no endpoints and no screen.

Notes:

- `tasks.py` reads `MANAGEMENT_EMAIL` once, when the module is loaded. The `alerts` digest reads it each time it runs.
- `tasks.py` holds two helpers, `auto_update_fabric_status` and `auto_update_tank_status`, that are deliberately **not** connected to any signal, because they would overwrite statuses set by the workflow actions. `check_warehouse_stock_alerts` is also defined but never called.
- The Excel styling helpers in `tasks.py` are a copy of the ones in `apps/reports/views.py`.
- The demo seed commands switch e-mail to an in-memory backend while they run, so seeding sends nothing (`apps/core/management/base.py`).

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| The bell is empty for a supervisor although things are wrong | The rule is not sent to their role, or the role lacks the rule's page | Edit the rule on the Rules tab; give the role the page |
| A role is not offered under "Who receives it" | The role does not have the rule's page | Give the page under Users → Access first |
| An item was marked as read but is still listed | Read only quiets the badge | Solve the problem; the item then disappears |
| Read marks are gone on another computer | They are kept in the browser | Nothing to fix |
| A decision on the Approvals page is refused | The user lacks the owning module's page or duty, or the owning module's rule refuses it | Read the message; decide it in the owning module, or have an Admin do it |
| A non-Admin who was given the Approvals page sees no Rules tab, and "—" on the card "Notification rules on" | Rules are Admin only, so the tab is hidden and the rules are not loaded | Expected; the inbox tabs still work |
| No digest arrives | No rule is marked "Send by e-mail", `MANAGEMENT_EMAIL` is empty, the command is not scheduled, or there was nothing to report | Check each in turn; run the command by hand and read what it prints |
| No e-mail of any kind arrives | The e-mail settings are missing, so messages are printed to the server's console instead of being sent | Set the e-mail settings; see [Configuration](../11-configuration.md) |
| The low-chemical e-mail and the bell disagree | The e-mail uses a fixed 25%; the bell uses the rule's threshold | Keep the rule at 25, or ignore the e-mail |
| "Low dried stock" never appears | The rule starts switched off | Switch it on |
| Test or demo work sends real e-mails | The real e-mail settings are active | Use a console or in-memory e-mail backend and an empty `MANAGEMENT_EMAIL` while testing |

## Keeping this page up to date

- `backend/apps/alerts/rules.py` and `migrations/0002_default_rules.py`: the rules, their wording, severities, pages and starting settings.
- `backend/apps/alerts/approvals.py`: the kinds of approval and the decisions offered.
- `backend/apps/alerts/digest.py`, `views.py`, `serializers.py`: the digest, endpoints and settings checks.
- `backend/apps/notifications/signals.py` and `tasks.py`: the older e-mail alerts and the two scheduled reports.
- `frontend/src/features/approvals/*`, `frontend/src/components/layout/notifications.tsx`, `frontend/src/features/dashboard/use-attention.ts`: the screens.
