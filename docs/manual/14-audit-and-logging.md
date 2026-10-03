# Audit and logging

This page explains what the system records about who did what: the audit log inside the application, and the technical logs on the server. It says what is recorded, what an entry contains, who can see it, and, just as important, what is **not** recorded. It is for administrators. Short parts for developers are marked.

## On this page

- [Two kinds of record](#two-kinds-of-record)
- [What the audit log records](#what-the-audit-log-records)
- [What an entry contains](#what-an-entry-contains)
- [Who can see the audit log](#who-can-see-the-audit-log)
- [The Audit log screen](#the-audit-log-screen)
- [Exporting](#exporting)
- [Sign-ins and failed sign-ins](#sign-ins-and-failed-sign-ins)
- [How long entries are kept](#how-long-entries-are-kept)
- [Server logs in Docker](#server-logs-in-docker)
- [What is not logged](#what-is-not-logged)
- [For developers: how entries are written](#for-developers-how-entries-are-written)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## Two kinds of record

| | Audit log | Server logs |
|---|---|---|
| Answers | Who added, changed or deleted which record, and who signed in. | Is the system running, which requests arrived, what errors happened. |
| Where | In the database. Shown under **Reports** → **Audit log**. | In Docker's log of each service. Read with `docker compose logs`. |
| Kept | Until someone removes rows from the database. | As long as Docker keeps them. |
| Backed up | Yes, with the database. | No. |

## What the audit log records

**For administrators.** An entry is written each time a signed-in person does one of these through the system:

| Action | Shown as | Written when |
|---|---|---|
| `CREATE` | create | A record is added. |
| `UPDATE` | update | A record is changed, or moved to another status (confirm, approve, complete, cancel and so on). |
| `DELETE` | delete | A record is deleted. |
| `LOGIN` | login | Someone signs in. |
| `LOGIN_FAILED` | login failed | A sign-in is refused: wrong username, wrong password, or an inactive account. |
| `EXPORT` | export | A document file is downloaded from **Documents**. |

This covers the records of every module: warehouse, sorting, decolorization, drying, sales, purchasing, quality, production, finance, maintenance, sustainability, workforce and documents, the notification rules, and users.

Some actions are worth knowing in detail:

| What happened | How it appears |
|---|---|
| A password was changed | An update on the user with the field `password` shown as `***` → `***`. The password itself is never stored in the log. |
| A user was activated or deactivated | An update on the user, field `is_active`. |
| A role's pages were changed | An update described as "Page access of *role*", with the old and new level of each page. |
| A role's duties were changed | An update described as "Duties of *role*", with the duties added and removed. |
| A person's exceptions were changed | An update on that user, with fields named `page:<page>`. |
| A role was added, renamed or deleted | A create, update or delete on the role. |
| Sellable stock was adjusted by hand | A create on a stock movement, with the quantity and the reason. |
| Two customers were merged | A delete on the customer that was removed, with `merged_into` and the number of orders moved. |
| Material was released from quarantine | An update on the inspection, field `quarantine`: "In quarantine" → "Released". |
| A new version of a document was uploaded | An update on the document, field `current_version`. |
| A document was downloaded | An export on the document, saying which version and file. |

A change and its audit entry are saved together. If a change is refused, for example a delete that is blocked because other records depend on the record, no entry is written.

## What an entry contains

| Part | Meaning |
|---|---|
| When | The date and time. |
| User | The username. It is stored as text as well as a link, so it stays readable after the user is deleted. For a failed sign-in it is what was typed in the username box. |
| Role | The user's role key at that moment, for example `warehouse_supervisor`. |
| Action | One of the six actions above. |
| Record type | The technical name of the kind of record, for example `SalesOrder`, `PurchaseOrder`, `CustomUser`. |
| Record number | The record's internal id. |
| Description | A short text naming the record, as it was at that moment. |
| Changes | For an update: each changed field with its old and new value. For a create or a plain delete: empty. |
| IP | The network address the request came from. |
| Browser | The browser's identification text. It is stored but not shown on the screen or in the export. |
| Address called | The API path that was used. It is returned by the API but not shown on the screen. |

Three things to keep in mind when reading entries:

- **Field names are technical.** Changes use the database's field names, for example `weight_sold` or `vendor_id`. A linked record appears as its id, not its name.
- **A create entry does not list the values entered,** and a delete entry does not keep a copy of the deleted record. The entry says that it happened, to which record, by whom and when.
- **Times are shown in UTC,** not in local time. Pakistan time is five hours ahead. The same applies to the export.

## Who can see the audit log

| Who | Sees |
|---|---|
| Admin | Every entry. |
| Any other signed-in user | Only their own entries, and only through the API. The screen is on the **Reports** page, which starts as Admin only. If an admin gives a role the Reports page, people with that role see their own entries there. |

The four summary figures at the top of the screen are for admins only.

The **Dashboard** also shows the eight most recent entries.

Nobody can change or delete an entry through the system. There is no screen and no API call for it, and the audit log is not in the admin panel at `/admin/`. Entries can only be altered by someone with direct access to the database.

How the Reports page is given to a role is explained in [Access control](05-access-control.md).

## The Audit log screen

Open **Reports**, then the tab **Audit log**.

At the top are four figures: **All entries**, **Today**, **Last 7 days** and **Last 30 days**.

Below them are the filters:

| Control | What it does |
|---|---|
| Search box ("Search user, record…") | Finds entries whose username, record type, description or action contains the text. |
| Record type ("All record types") | Shows one kind of record. The list offers: SalesOrder, Payment, DispatchTracking, Customer, Stock, Vendor, FactoryUnit, FabricStock, SortingSession, Tank, ChemicalStock, ChemicalIssuance, DecolorizationSession, Dryer, DryingSession, StockMovement, CustomUser. |
| Action ("All actions") | Shows one action: create, update, delete, login, login failed, export. |
| **From** and **To** | The period. It starts as the last 30 days. |
| **Export (500 rows)** | Downloads the filtered entries as an Excel file. |

The table has the columns **When**, **User**, **Action**, **Record**, **Changes** and **IP**. It shows 25 entries per page, newest first, with buttons for the previous and next page. The **Changes** column shows the first three changed fields and then "(+N more)". The complete list of changed fields of an entry is available through the API (`audit/logs/<id>/`). When nothing matches, the table says "No entries match these filters."

To find entries of a record type that is not in the list (for example purchase orders), type its name in the search box: `PurchaseOrder`.

### How to answer common questions

1. **Who changed this order?** Type the order's description or `SalesOrder` in the search box, set the period, and read the **Changes** column.
2. **What did this person do last week?** Type the username in the search box and set **From** and **To**.
3. **Who deleted records this month?** Set **Action** to delete and the period to this month.
4. **Is someone guessing passwords?** Set **Action** to login failed. Look for many entries from one IP, or for one username.

## Exporting

**Export (500 rows)** downloads an Excel file named `audit_log_<date>.xlsx`. It uses the filters set on the screen.

- It holds at most 500 entries, the newest first. For more, narrow the period and export several times.
- Columns: #, Timestamp, User, Role, Action, Model, Record ID, Description (the first 80 characters).
- The changed fields and the IP address are **not** in the file. To keep those, use the screen or the API.

Exporting the audit log is itself not recorded.

## Sign-ins and failed sign-ins

Every sign-in writes a `LOGIN` entry with the user, the IP and the time.

Every refused sign-in writes a `LOGIN_FAILED` entry:

- The description is `Failed login for "<what was typed>"`.
- If the username or e-mail belongs to an account, the entry is linked to that account. This covers both a wrong password and an inactive account.
- If no such account exists, only the typed text is kept.

Attempts that are stopped by the sign-in limit (10 per minute from one address by default) are refused before this point and leave no audit entry. They appear in the server log of `app-edge` and `backend` as requests answered with `429`.

Signing out is not recorded.

For the IP column to show each visitor's own address, the system must be set up as described in [Deployment](12-deployment.md) (see "Visitor addresses").

## How long entries are kept

Entries are never removed by the system. The table grows with use. There is no setting for a retention period. If it must be trimmed, that is a database task for a developer, and a backup should be taken first.

When a user is deleted, their entries stay. The link to the user is cleared and the username text remains.

## Server logs in Docker

Each service writes to Docker's log. See [Deployment](12-deployment.md) for the commands.

| Service | What its log holds |
|---|---|
| `backend` | One line per request to the API (method, path, status, size). Errors with their technical details. Messages about e-mails: "Alert sent: …", "MANAGEMENT_EMAIL not set; skipping alert …", "Alert failed …", "Alert digest sent with N item(s)". An error when one block of the executive figures could not be worked out. The database changes applied at start. |
| `app` | The web app's server messages and errors. |
| `app-edge` | One line per request to the site, with the visitor's address. |
| `db` | Database start-up, connections and errors. |

When no mailbox is configured, e-mails are printed in the `backend` log and not sent.

The amount of detail in the `backend` log is set by `LOG_LEVEL` (see [Configuration](11-configuration.md)).

These logs are not part of the backup and are not shown anywhere inside the application.

## What is not logged

So that nobody relies on a record that does not exist:

| Not recorded in the audit log | Note |
|---|---|
| Looking at records | Opening a page, a list, a statement or a customer's details leaves no entry. |
| Running or exporting reports | The report centre, the Excel and CSV exports of reports, and the audit export leave no entry. Only document downloads are logged as an export. |
| Signing out, and the background renewal of a session | |
| Refused actions | An action refused for lack of access, or by a business rule, leaves no entry. Only refused sign-ins do. |
| The values of a new record, and a copy of a deleted one | See [What an entry contains](#what-an-entry-contains). |
| Lines inside a record | Changes to the lines of a purchase order, a requisition, a recipe, a routing, a bill of materials or a quality standard are saved with the record, but the entry lists only the changed fields of the record itself. |
| Changes the system makes by itself | Stock ledger rows posted from drying sessions, dispatches and returns; journal entries posted from sales, purchasing and expenses; a purchase order's or invoice's status following deliveries and payments; a sales order's payment status following payments; a machine's status following its work orders. The action that caused them is logged; the automatic follow-up is not. |
| Changes made in the admin panel (`/admin/`) | Django keeps its own short history for the admin panel, visible there. It is separate from the audit log. |
| Commands run on the server | The seed commands, `reconcile_inventory --fix`, `setup_fresh.py`, and anything done directly in the database. |
| E-mails sent | They appear only in the `backend` server log. |
| Passwords | Never, in any log. |

The action `RESTORE` exists in the code but nothing writes it: no record type can be restored after deletion.

## For developers: how entries are written

**For developers.**

| Piece | File | Role |
|---|---|---|
| `AuditLog` | `backend/apps/audit/models.py` | The table. Ordered newest first. Indexed on `model_name` + `object_id`, `user` + `timestamp`, `action` + `timestamp`. |
| `log_action(user, action, instance, changes=None, request=None, extra_repr='')` | `backend/apps/audit/models.py` | Writes one entry. `model_name` is the instance's class name. The IP is the first entry of `X-Forwarded-For`, or `REMOTE_ADDR`. |
| `AuditedModelMixin` | `backend/apps/audit/middleware.py` | Put in front of a DRF viewset. `perform_create`, `perform_update` and `perform_destroy` write the entry in the same transaction as the change. An update's `changes` is the difference between the record's own fields before and after; dates become ISO text and decimals become numbers. |
| `snapshot(instance)` and `log_change(instance, before)` | same | For changes made outside `serializer.save()`, such as a status action. An entry is written only when something changed. |
| `AuditMiddleware` | same | Keeps the current request for the length of the request. |
| `AuditLogViewSet`, `audit_summary` | `backend/apps/audit/views.py` | The read-only API, the filters, the Excel export and the summary. |
| Screen | `frontend/src/features/reports/audit-log.tsx` | The filters, the table and the list of record types. |

Where entries are written by hand with `log_action` instead of the mixin: `backend/apps/users/views.py` (sign-in, failed sign-in, user changes), `backend/apps/access/views.py`, `backend/apps/inventory/views.py` (adjustments), `backend/apps/sales/views.py` (merge, invoice, quotation conversion), `backend/apps/procurement/views.py` and `backend/apps/production/views.py` (status changes), `backend/apps/quality/views.py` (release), `backend/apps/documents/views.py` (upload and download).

Three viewsets do not use the mixin because they change nothing: `AuditLogViewSet`, `StockMovementViewSet` (its `adjust` action logs by hand) and `OpenLineViewSet`.

Details that differ from what the names suggest:

- The label of `DELETE` in the model's choices is "Delete (Soft)", and `perform_destroy` has a branch for models with an `is_deleted` field. No model has that field, so every delete is a real delete.
- `perform_update` writes an `UPDATE` entry even when no field changed; `changes` is then empty.
- `timestamp_display` in the serializer, and the Timestamp column of the export, format the stored time without converting it to the local time zone.
- The record type list on the screen is a fixed list in `audit-log.tsx` (`MODELS`). It is not read from the API.
- A user counts as an admin here when their role is `admin` or they have Django's staff flag (`get_queryset` and `audit_summary`).

The API endpoints are listed in [API](10-api.md).

## Keeping this page up to date

- Revise "What the audit log records" when a view starts or stops using `AuditedModelMixin` or `log_action`, or when an action constant is added in `backend/apps/audit/models.py`.
- Revise "What an entry contains" and "Exporting" when `AuditLog`, `AuditLogSerializer` or `export_excel` in `backend/apps/audit/views.py` change.
- Revise "The Audit log screen" when `frontend/src/features/reports/audit-log.tsx` changes: labels, filters, the record type list, the page size.
- Revise "Sign-ins and failed sign-ins" when `LoginView` or `_log_failed_login` in `backend/apps/users/views.py` change.
- Revise "Server logs" when `LOGGING` in `backend/config/settings.py`, the gunicorn command in `backend/Dockerfile`, or a `logger.` call's wording changes.
