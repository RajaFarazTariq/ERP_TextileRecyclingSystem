# Search and traceability

This guide covers the search box in the header (Ctrl+K) and the Traceability page, which shows everything recorded about one fabric lot from its delivery to the customer. It is for every user; the last sections are for developers.

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

**Search** finds pages, sections and records from one box. Type a few letters or a number such as `PO-12`, and the box lists matching records grouped by kind. Each user sees only the kinds of record their pages allow.

**Traceability** answers the question "where did this material come from and where did it go?". Pick a fabric lot and the page shows, in order: the delivery and supplier, sorting, decolorization (with the chemicals used), drying, production orders, quality inspections, sellable stock and sales. A strip at the top shows the weight at each step and the overall yield. The page can be printed.

Both only read. Nothing is stored by this module and nothing can be changed from it.

## Who can use it

| What | Who |
|---|---|
| The search box | Every signed-in user. Which records it finds depends on the user's pages |
| The Traceability page | Admin and every supervisor, to begin with |

No duty is involved. Traceability only shows things, so holding it at View only is the same as Full.

Some parts of a trace follow other pages:

| Part of the trace | Shown to |
|---|---|
| Delivery, lot, sorting, decolorization, production orders, quality inspections, sellable stock | Everyone who can open Traceability |
| The delivery's purchase order | Users who have the Purchasing page |
| Drying sessions | Users who have the Drying page |
| Sales (customers, orders, dispatches, invoices, returns) | Users who have the Sales page |

A part the user may not see says "Not available for your role".

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

### The search box

It is in the header of every page, labelled **Search or jump to…**. Press **Ctrl+K** (Cmd+K on a Mac) or click it. A panel opens with these groups:

| Group | Holds |
|---|---|
| Pages | The pages the user can open |
| Sections | The tabs inside those pages, for example "Supplier payments" or "Attendance". Choosing one opens its page |
| Theme | Light theme, Dark theme, Use system theme |
| Account | Sign out |
| Record groups | Records found on the server, once two or more characters are typed |

Typing filters the first four groups at once: every typed word must appear in the item. Records are fetched a quarter of a second after typing stops; "Searching records…" shows while that happens. "Nothing found." shows when there is no match at all.

Choosing a record opens the page it lives on (a lot opens its trace). It does not open the single record.

**What can be found**

| Group | Matches on | Opens | Needs the page |
|---|---|---|---|
| Fabric lots | Lot number, material, supplier name | The lot's trace | none |
| Deliveries | Delivery number, fabric type, supplier, vehicle, weight slip | Warehouse | Warehouse or Purchasing |
| Suppliers | Name, e-mail, materials supplied | Purchasing | Warehouse or Purchasing |
| Customers | Name, e-mail | Sales | Sales |
| Purchase requests | Number | Purchasing | Purchasing |
| Purchase orders | Number, supplier | Purchasing | Purchasing |
| Sales orders | Order number, buyer or customer name | Sales | Sales |
| Quotations | Number, customer | Sales | Sales |
| Invoices (sales) | Number, customer | Sales | Sales |
| Sales returns | Number, customer | Sales | Sales |
| Production orders | Number, product name | Production | Production |
| Inspections | Number | Quality | Quality |
| Chemicals | Name | Decolorization | Decolorization |
| Machines | Code, name | Maintenance | Maintenance |
| Work orders | Number, title, machine | Maintenance | Maintenance |
| Employees | Code, name | Workforce | Workforce |
| Documents | Number, title, reference number | Documents | Documents, and only documents in categories the user's role may see |

Supplier invoices, supplier payments, customer payments, journal entries, expenses and users are not searched.

### Traceability page

The page is at `/traceability`. At the top are a **Print** button and a box: **Find a lot: number, material, supplier, order or invoice…**. Until a lot is picked the page says "Pick a lot to trace".

The box lists only records that lead to a lot:

| Group | Finds a lot by | Needs the page |
|---|---|---|
| Fabric lots | Lot number, material, supplier | none |
| Deliveries | Delivery number, vehicle, weight slip | none |
| Purchase orders | Purchase order number | Purchasing |
| Production orders | Number, product name | none |
| Sales orders | Order number, customer | Sales |
| Invoices | Invoice number, customer | Sales |

Once a lot is picked the page shows:

1. **The lot card**: "Lot #N · material", its status, a Quarantined badge and a warning when a failed inspection holds it, and four facts: Supplier, Received, Lot weight, Still to sort.
2. **Yield**: five boxes (Weight in, Sorted, Decolorized, Dried, Sold), each with its kg and its share of the weight in. Below them: Overall yield, Waste, Returned, Recorded cost.
3. **From delivery to customer**: a timeline of eight stages.

| Stage | Shows |
|---|---|
| Delivery | Supplier, date received, delivery number and fabric type, status, our weight, unloading weight, vehicle, weight slip, factory unit, the purchase order (number, status, quantity ordered, price), and any incoming inspections |
| Sorting | Totals taken, sorted and waste; each session with its unit, supervisor, dates and figures |
| Decolorization | Totals in, out, waste and chemical cost; each session with tank and batch, supervisor, recipe, figures, temperature, duration, who approved it, and the chemicals issued with their cost |
| Drying | Totals in, out and waste; each session with dryer, supervisor, figures, temperature and duration |
| Production orders | Each order with planned and actual figures, yield, labour, material and total cost, and its stages |
| Quality inspections | In-process and finished inspections on the lot, with result, inspector, why it failed, release details and corrective actions |
| Sellable stock | On hand, reserved, available, and every stock movement |
| Sales | Totals sold, dispatched, returned and order value; each order with customer, status, payment status, weight, price, dispatches (with challan number), invoices and returns |

A stage the lot has not reached says so ("Not sorted yet.", "Not dried yet.", "Not sold yet." and so on).

When a delivery was split into several lots, a row of buttons lets the user switch between them.

## Records and fields

This module stores nothing. The figures in the yield strip are worked out as follows.

| Figure | Meaning |
|---|---|
| Weight in | The lot's initial quantity |
| Sorted | Total sorted in the lot's sorting sessions |
| Decolorized | Total output of the lot's decolorization sessions |
| Dried | Total output of the lot's drying sessions |
| Sold | Total weight of the lot's sales orders that are Confirmed, Dispatched or Completed |
| Overall yield | Dried ÷ weight in |
| Waste | Sorting waste + decolorization waste + drying waste |
| Returned | Weight of approved sales returns |
| Recorded cost | Cost of chemicals issued + total cost of the lot's production orders |

"Recorded cost" is only what was recorded against this lot. It is not the factory's cost per kg from Finance.

## Statuses

None of its own. The trace shows the statuses of the records it reads.

## How to

### Find a record

1. Press **Ctrl+K**.
2. Type part of a name, or a number. `PO-12`, `po 12` and `PO-00012` all find purchase order PO-00012. A bare number such as `15` or `#15` finds record 15 of every numbered kind.
3. Choose the result. The page it lives on opens. Use that page's own search box to bring up the record.

### Jump to a page or tab

1. Press **Ctrl+K**.
2. Type the name, for example "payments".
3. Choose the page or section.

### Trace a lot

1. Open **Traceability**.
2. Type the lot number, the material, the supplier, a purchase order number, a sales order number or an invoice number.
3. Choose the lot.

Or choose a lot from the header search box: lots open straight in Traceability.

### Trace from a sales order, a delivery or a production order

Use the box on the Traceability page, or open a link of this form:

| Link | Opens |
|---|---|
| `/traceability?lot=5` | Lot 5 |
| `/traceability?order=12` | The lot sales order 12 was sold from (needs the Sales page) |
| `/traceability?stock=8` | The lots made from delivery 8 |
| `/traceability?production=3` | The lot of production order 3 |

### Answer "which customers received material from this supplier's delivery?"

1. Trace the lot (find it by the delivery or the supplier).
2. Read the **Sales** stage: it lists every order, customer and dispatch for the lot.

### Print a trace

Press **Print**. The page prints on white, without the search box and buttons, with the date it was printed.

## Business rules

### Search

| Rule | Message |
|---|---|
| A search needs at least two characters. Shorter text returns nothing | |
| The text is cut to 100 characters, and extra spaces are removed | |
| Each group shows at most six results, newest first | |
| A number is read as an optional prefix of two to four letters and a record number. Leading zeros, a dash, a hash and spaces are ignored | |
| A prefix looks only in its own kind: `PO` purchase orders, `PR` purchase requests, `QT` quotations, `INV` invoices, `SR` sales returns, `SO` or `ORD` sales orders, `MO` production orders, `QC` inspections, `WO` work orders, `EMP` employees, `DOC` documents, `LOT` lots, `DEL` deliveries | |
| A bare number finds the record with that number in every numbered kind, listed first, as well as text matches | |
| Suppliers, customers, chemicals and machines are found by text only, never by number | |
| A group is left out entirely for a user who has none of its pages | |
| Documents follow the Documents module's category rule | |
| Searching needs a login | 401 |

### Traceability

| Rule | Message |
|---|---|
| A trace needs something to start from | "Give a fabric lot, sales order, delivery or production order." |
| The value must be a number | "This must be a number." |
| Nothing matching | "No fabric lot was found for this." (the page shows "Lot not found") |
| Tracing from a sales order needs the Sales page | "Only an admin can trace a sales order." |
| If several starting points are given, the first of lot, order, stock, production is used | |
| A delivery split into several lots traces the first and lists the others | |
| A section the user may not read is returned as restricted, never with partial data | The page shows "Not available for your role" |
| A summary figure is empty when its stage has not happened or the user may not read it | |
| For a user without the Drying page, "Dried" is taken from the stock movements of type Drying output, so the yield can still be shown; the drying sessions and drying waste stay hidden | |
| "Sold" counts orders that are Confirmed, Dispatched or Completed. Draft and Cancelled orders are listed under Sales but not counted | |
| "Returned" counts approved returns only | |

## Related data

Search and traceability read these modules and change none of them.

| Module | Used for |
|---|---|
| [Warehouse](warehouse.md) | Deliveries and suppliers; the start of every trace |
| [Sorting](sorting.md) | Fabric lots and sorting sessions |
| [Decolorization](decolorization.md) | Sessions, recipes, chemicals issued and their cost |
| [Drying](drying.md) | Drying sessions |
| [Production](production.md) | Production orders, stages and costs |
| [Quality](quality.md) | Inspections, quarantine and corrective actions |
| [Inventory](inventory.md) | Stock figures and movements |
| [Sales](sales.md) | Orders, dispatches, invoices, returns, customers, quotations |
| [Purchasing](purchasing.md) | Purchase requests and orders |
| [Maintenance](maintenance.md), [Workforce](workforce.md), [Documents](documents.md) | Machines and work orders, employees, documents (search only) |

## For developers

**Backend:** `backend/apps/search`. The app has no models.

| File | Contents |
|---|---|
| `finder.py` | One `find_*` function per kind of record; `GROUPS` (the header search) and `LOT_GROUPS` (the lot picker), each entry being (type, heading, pages, number prefixes, finder); `parse_number`; `search(user, query, lots_only)`; `LIMIT = 6`, `MIN_LENGTH = 2` |
| `trace.py` | `SECTION_PAGES` (which pages unlock which section), `resolve_lots` (reads `?lot=`, `?order=`, `?stock=`, `?production=`), one builder per section, `build(request, lot_id)` with the summary |
| `views.py` | `SearchView`, `TraceView` |
| `demo.py` | Demo records for the `seed_module_data` command |
| `tests.py` | What each role finds, how numbers are read, limits, the whole trace, restricted sections, and tests that the number of database queries does not grow with the number of results |

**Endpoints** (under `/api/v1/search/`):

| Method and path | Purpose | Needs |
|---|---|---|
| `GET /?q=<text>` | Search. Returns `query`, `groups` (each with `type`, `label`, `results`), `total` | Any signed-in user |
| `GET /?q=<text>&scope=lots` | Only records that lead to a lot; every result's `href` is the trace of that lot | Any signed-in user |
| `GET /trace/?lot=<id>` (or `order`, `stock`, `production`) | The full trace: `lot_id`, `source`, `lot`, `sorting`, `decolorization`, `drying`, `production`, `quality`, `stock`, `sales`, `summary`, `matches` | The Traceability page |

Each search result is `{type, id, label, detail, href, lot}`. A restricted trace section is `{"restricted": true}`.

To make a new kind of record searchable: write a `find_*` function in `finder.py`, add it to `GROUPS` with the pages that may see it, add the type to `SearchResultType` in `frontend/src/types/search.ts` and its icon to `RESULT_ICONS` in `command-menu.tsx`.

To add a tab name to the "Sections" group, edit `SECTIONS` in `frontend/src/components/layout/command-menu.tsx`. That list is typed by hand; it is not read from the pages.

**Frontend:** the search box is `frontend/src/components/layout/command-menu.tsx`. The Traceability page is `frontend/src/features/traceability/` (`traceability-page.tsx`, `trace-stages.tsx`). Route: `frontend/src/app/(app)/traceability/page.tsx`. Types: `frontend/src/types/search.ts`.

**Tests:** `backend/apps/search/tests.py`.

**Browser scenario:** `frontend/e2e/traceability.mjs`. Nothing is traced until a lot is picked → find a lot by material and by number → the eight stages and the yield strip → a link with a sales order → the search box finds a supplier and still jumps to pages → a sorting supervisor traces the same lot without sales or customer data.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| A record is not found | Fewer than two characters were typed; the kind is not searched; or the user lacks its page | Type more; see the table of what can be found; check the user's pages |
| Only six results show | Each group is limited to six | Type something more specific, or search on the module's own page |
| Choosing a result opens a page, not the record | Search opens the page the record lives on | Use that page's search box |
| "Not available for your role" in a trace | The user lacks the Sales, Drying or Purchasing page | Expected. Give the page if the user should see it |
| "Lot not found" | The link points to a number that has no lot, or a delivery not yet turned into a lot | Search for the lot again |
| "Not available for your role" for the whole page, with "Only an admin can trace a sales order." | A `?order=` link was opened by a user without the Sales page | Trace by the lot instead |
| A tab name in the search box no longer matches the page | The "Sections" list is kept by hand | Update `SECTIONS` in `command-menu.tsx` |
| Dried shows a figure but the Drying stage is hidden | The user has no Drying page; the dried weight comes from the stock ledger | Expected |

## Keeping this page up to date

- `backend/apps/search/finder.py`: what is searched, the prefixes, the page each group needs, the limits.
- `backend/apps/search/trace.py`: the trace's sections, who may see them, the summary figures and the messages.
- `frontend/src/components/layout/command-menu.tsx`: the search box, its groups and the hand-kept list of sections.
- `frontend/src/features/traceability/*`: the lot picker, the yield strip and the eight stages.
- `backend/apps/access/services.py`: `OPEN_READS` and `NOT_OPEN` (search is open to every user; the trace needs the Traceability page).
