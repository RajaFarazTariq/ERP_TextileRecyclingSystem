# Inventory (sellable stock)

This guide covers the inventory module: the ledger of dried, sellable stock, how stock is reserved for orders, manual adjustments and the `reconcile_inventory` command. It is for administrators and developers. The module has no page of its own; this guide also says where its figures appear.

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

Only **dried output** can be sold. The inventory module keeps a ledger of every change to that sellable stock, per fabric lot. Nobody types a stock figure: stock on hand is always the sum of the ledger's movements.

Three figures are worked out for each lot:

| Figure | Meaning |
|---|---|
| On hand | The sum of the lot's movements |
| Reserved | For Confirmed and Dispatched sales orders on the lot: the ordered kg that has not been dispatched yet |
| Available (also called "free") | On hand less reserved |

Stock goes **in** when a drying session is completed (its output) and when an approved sales return is restocked. Stock goes **out** when a dispatch is recorded. A manual **adjustment** can add or remove stock, with a reason.

The ledger follows its source records by itself. If a drying session's output is corrected, a dispatch is edited or deleted, or an order is moved to another lot, the ledger posts the difference. Movements are never edited or deleted.

This module covers sellable dried stock only. Raw material in the warehouse, material being sorted, chemicals and spare parts are kept by their own modules.

## Who can use it

There is no Inventory page, so there is no page to give access to. The figures follow the pages that show them.

| What | Needs |
|---|---|
| See stock figures | The Sales page or the Dashboard page (both start as Admin only) |
| Adjust stock by hand | The Sales page at Full **and** the duty *Adjust stock* (Admin by default) |
| Run `reconcile_inventory` | Access to the server's command line |

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The module has no screen. Its figures appear in these places:

| Where | What is shown |
|---|---|
| **Dashboard** → Material flow strip, last stage "Sellable stock" | Kg free to sell now (on hand less reserved, all lots), and the kg reserved |
| **Dashboard** → card "Sellable stock" | Kg on hand, with reserved and free shown as a bar |
| **Sales** → order form, **Fabric lot** list | Each lot with "… kg available"; the hint under the field repeats it for the chosen lot |
| **Sales** → quotation form and "Make order" form | The same list |
| **Sales** → error messages | The refusals listed under [Business rules](#business-rules) |
| **Traceability** → a lot's trace | On hand, reserved and available for that lot, and every movement of the lot |
| **Reports** → report centre → *Inventory valuation* | On hand, reserved and available per lot, with a value at production cost |
| **Reports** → report centre → *Stock movement* | What went into and out of stock, by lot and kind of movement |
| **Bell and Dashboard → Needs attention** | Three notification rules: low dried stock, more reserved than on hand, and large stock adjustments |

There is **no screen for the movement ledger or for making an adjustment**. An adjustment is made through the API (see [How to](#how-to)). The ledger can also be read, but not changed, in the Django admin site under "Stock movements".

## Records and fields

### Stock movement

| Field | Meaning | Rules |
|---|---|---|
| `fabric` | The fabric lot | Required |
| `movement_type` | Drying output, Dispatch, Adjustment or Sales return | Set by the system |
| `quantity` | Signed kg. Positive adds stock, negative removes it | Never zero |
| `source_type`, `source_id` | The record that caused the movement: `DryingSession`, `DispatchTracking`, `SalesReturn` or `Adjustment` | For an adjustment the source id is the movement's own id |
| `note` | For automatic movements, a description such as "Drying session #12". For an adjustment, the reason | Required for adjustments; at most 255 characters |
| `created_by` | The logged-in user whose action caused it | Empty when posted outside a request (a command, a migration) |
| `created_at` | When it was posted | Set by the system |

### Adjustment request

| Field | Meaning | Required | Rules |
|---|---|---|---|
| `fabric` | Id of the fabric lot | Yes | Must exist |
| `quantity` | Kg to add (positive) or remove (negative) | Yes | Not zero; cannot take on-hand stock below zero |
| `note` | The reason, e.g. "Physical count 2026-10-01" | Yes | Not blank |

## Statuses

Movements have no status. They have a type:

| Type | Sign | Posted when |
|---|---|---|
| Drying output (`DRYING_OUTPUT`) | + | A drying session is Completed with an output quantity |
| Dispatch (`DISPATCH`) | − | A dispatch is saved for a sales order |
| Sales return (`SALES_RETURN`) | + | A sales return is Approved and marked "Back into sellable stock" |
| Adjustment (`ADJUSTMENT`) | + or − | A user with the duty posts a manual correction |

Reservation depends on the **sales order's** status: only Confirmed and Dispatched orders reserve stock. Draft, Completed and Cancelled orders reserve nothing.

## How to

### See how much of a lot can be sold

- On the **Sales** page, open **New order** and look at the **Fabric lot** list.
- Or open **Traceability**, find the lot, and read its stock figures and movements.
- Or open **Reports**, the report centre, and run *Inventory valuation*.

### Correct stock after a physical count

**For administrators.** There is no form for this. Send a request to the API while signed in as a user who has the Sales page at Full and the duty *Adjust stock*:

```
POST /api/v1/inventory/movements/adjust/
{"fabric": 12, "quantity": "-5.00", "note": "Physical count 2026-10-01"}
```

The adjustment is written to the audit log with the quantity and the reason. A large adjustment (more than 500 kg either way, by default) appears in the notifications for seven days.

### Check that the ledger is correct

**For administrators.** On the server, in the `backend` folder:

```
python manage.py reconcile_inventory
```

It prints the number of lots checked and three lists:

| Line | Meaning |
|---|---|
| "Ledger differs from source records" | The ledger's on-hand figure is not what the drying sessions, dispatches, restocked returns and adjustments add up to |
| "Negative on-hand stock" | A lot's on-hand figure is below zero |
| "Reserved more than on hand (oversold)" | Confirmed orders on a lot need more than it has |

To repair the first list:

```
python manage.py reconcile_inventory --fix
```

`--fix` re-reads every drying session, dispatch and sales return and posts the missing differences. It never deletes a movement and never touches adjustments. It does nothing about negative or oversold lots: those need a business decision (an adjustment, or changing the orders).

## Business rules

| Rule | Message |
|---|---|
| On hand = the sum of the lot's movements | |
| Reserved = for each Confirmed or Dispatched order on the lot, ordered kg less dispatched kg (never below zero) | |
| Available = on hand − reserved | |
| Draft orders are not checked against stock | |
| A Confirmed or Dispatched order must be covered by available stock. The check runs on **Confirm**, when an order is created in that status, and when such an order's lot or weight changes | "Only 300.00 kg of dried stock is available for this fabric (400.00 kg needed). Save the order as Draft until stock is ready." |
| Editing other fields of an order that is already reserving (for example its notes) does not repeat the check, so orders confirmed before stock tracking existed can still be edited | |
| A lot in quarantine cannot be reserved or dispatched | "This fabric lot is in quarantine after failing inspection QC-00007 and can't be sold until an admin releases it." |
| A dispatch needs a Confirmed or Dispatched order | "Confirm the order before dispatching it." |
| Dispatches cannot exceed the order's weight | "Only 30.00 kg of this order is left to dispatch." |
| The stock must be on hand for this order, after what other orders have reserved | "Only 0.00 kg of dried stock is on hand for this order." |
| A dispatch does not change "available": the weight moves from reserved to shipped | |
| Cancelling or completing an order ends its reservation | |
| A drying session posts stock only while it is Completed and has an output quantity. Changing the output, the lot, or the status re-posts the difference; deleting the session takes the stock back | |
| An approved return posts stock only when it is marked to be restocked | |
| An adjustment needs a reason | "A reason is required for stock adjustments." |
| An adjustment cannot be zero | "Quantity cannot be zero." |
| The lot must exist | "Fabric lot not found." |
| An adjustment cannot make on-hand stock negative | "Adjustment would make on-hand stock negative." |
| Adjusting needs the duty *Adjust stock* | "Your role is not allowed to adjust stock." |
| Movements are append-only: there is no way to edit or delete one, in the API or in the admin site | |
| On PostgreSQL, stock checks on one lot are done one at a time (a row lock on the lot), so two people confirming at the same moment cannot oversell. SQLite has no such lock | |

## Related data

| Module | What happens |
|---|---|
| [Drying](drying.md) | Completed sessions post Drying output movements |
| [Sales](sales.md) | Orders reserve stock; dispatches and restocked returns post movements; the forms show available stock |
| [Sorting](sorting.md) | Movements belong to a fabric lot. The lot list returns each lot's `dried_available_kg` |
| [Quality](quality.md) | A quarantined lot is refused by the reservation and dispatch checks |
| [Approvals and notifications](approvals-and-notifications.md) | Rules "low dried stock", "more reserved than on hand" and "large stock adjustment" read this module |
| [Search and traceability](search-and-traceability.md) | A lot's trace shows its stock figures and movements |
| [Dashboard and reports](dashboard-and-reports.md) | Dashboard cards; the *Inventory valuation* and *Stock movement* reports |

The demo seed commands add an adjustment labelled "Demo opening stock" to each lot, so that demo orders can be confirmed.

## For developers

**Backend:** `backend/apps/inventory`.

| File | Contents |
|---|---|
| `models.py` | `StockMovement` |
| `services.py` | Figures (`on_hand`, `reserved`, `available`, `availability_map`), rules (`check_order_reservation`, `check_dispatch`), `lock_fabric`, ledger sync (`sync_drying_session`, `sync_dispatch`, `sync_sales_return`), `post_adjustment` |
| `signals.py` | `post_save` and `post_delete` on `drying.DryingSession`, `sales.DispatchTracking`, `sales.SalesReturn`; `post_save` on `sales.SalesOrder` (re-syncs the order's dispatches and returns, for when an order moves to another lot) |
| `views.py` | `StockMovementViewSet` (read-only) with the `adjust` and `stock` actions |
| `management/commands/reconcile_inventory.py` | The check and repair command |
| `migrations/0002_backfill_movements.py` | Built the ledger from existing drying sessions and dispatches when the module was introduced |
| `admin.py` | Read-only listing in the admin site |
| `tests.py` | Ledger sync, reservations, dispatch rules, adjustments, the backfill, and a PostgreSQL-only test that two simultaneous confirms cannot oversell |

How the sync works: each `sync_*` function works out what the source record should have posted, compares it with what is already in the ledger for that source, and posts only the difference. So a correction to a drying session's output creates a second movement for the difference; the first one stays.

`availability_map()` returns the figures for all lots, or the lots given, in a fixed number of queries. Use it instead of calling `available()` in a loop.

**Endpoints** (under `/api/v1/inventory/`):

| Method and path | Purpose | Needs |
|---|---|---|
| `GET /movements/` | The ledger, newest first. Filters: `fabric`, `movement_type` | Sales or Dashboard page |
| `GET /movements/{id}/` | One movement | Sales or Dashboard page |
| `GET /movements/stock/` | On hand, reserved and available per lot, for lots with any activity | Sales or Dashboard page |
| `POST /movements/adjust/` | Manual adjustment: `fabric`, `quantity`, `note` | Sales page at Full and the duty `adjust_stock` |

Other modules read the same figures through their own endpoints: `/api/v1/sorting/fabric-stock/` returns `dried_available_kg` per lot, and `/api/v1/search/trace/` returns a lot's stock block.

**Frontend:** no feature folder. The figures are read in `frontend/src/features/dashboard/use-attention.ts` (dashboard) and `frontend/src/features/sales/sales-forms.tsx` and `sales-extras.tsx` (lot lists).

**Tests:** `backend/apps/inventory/tests.py`. There is no separate browser scenario; `frontend/e2e/sales.mjs` checks that confirming reserves stock, dispatching removes it and an approved return restores it.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| A lot shows 0 kg available although drying is finished | The drying session is not Completed, or has no output quantity | Complete the session with its output |
| "Only … kg of dried stock is available" on Confirm | Other confirmed orders have reserved the stock | Cancel or reduce another order, wait for more drying output, or adjust stock if the count is wrong |
| "Only … kg of dried stock is on hand for this order." on Dispatch | The order was confirmed before stock tracking existed, or stock was adjusted down afterwards | Check the lot's movements in Traceability; adjust if a count shows the stock is there |
| `reconcile_inventory` lists "Ledger differs from source records" | A record was changed in a way that skipped the signals (for example a bulk database update) | Run it again with `--fix` |
| `reconcile_inventory` lists a lot as oversold | Confirmed orders exceed the stock, usually old orders or a downward adjustment | Decide which order to cancel or reduce, or adjust the stock |
| The adjustment request answers 403 with "You do not have access to this part of the system. Ask an admin if you need it." | The user does not have the Sales page | Give the page and the duty, or have an Admin post it |
| A mistaken adjustment needs undoing | Movements cannot be edited or deleted | Post a second adjustment with the opposite quantity and a reason |

## Keeping this page up to date

- `backend/apps/inventory/models.py`, `services.py`, `signals.py`, `views.py`, `serializers.py`: the ledger, the rules and their messages.
- `backend/apps/inventory/management/commands/reconcile_inventory.py`: the command's output and what `--fix` does.
- `backend/apps/sales/serializers.py` and `views.py`: where the reservation and dispatch checks are called.
- `backend/apps/access/services.py`: which pages may read and change the inventory API (`PAGE_API`) and the duty `adjust_stock`.
- `frontend/src/features/dashboard/dashboard-page.tsx` and `frontend/src/features/sales/sales-forms.tsx`: where the figures are shown.
