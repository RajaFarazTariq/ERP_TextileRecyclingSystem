# Sorting

This page explains the Sorting module: fabric lots and the sorting sessions that work on them. It is for sorting supervisors, administrators, and developers who maintain the module.

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

Sorting is the second step of the material flow. It keeps two kinds of record:

- A **fabric lot** is an amount of one material, taken from one warehouse delivery. The lot is the record that follows the material through the rest of the system: decolorization, drying, quality, production and sales all point to a fabric lot.
- A **sorting session** is one piece of sorting work on a lot. It records how much was taken, how much came out sorted, and how much was waste.

Completing a session moves weight on the lot from "remaining" to "sorted". The module also shows efficiency and waste figures.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| Sorting Supervisor | Full |
| Other roles | No access to the page |

- With **View only** access the add button is replaced by a "View only" badge and the row menus are hidden. The server refuses any change.
- The Sorting module needs no duty.
- Other pages read fabric lots without the user holding the Sorting page (Quality, Production, Sustainability, Sales and the Dashboard).

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/sorting`. Its title is **Sorting** and it has three tabs. The button at the top right is **Start session** on the Dashboard and Sessions tabs, and **Add fabric lot** on the Fabric lots tab.

### Dashboard tab

All figures are worked out from every sorting session.

| Part | Shows |
|---|---|
| Total input | Sum of quantity taken |
| Total sorted | Sum of quantity sorted |
| Total waste | Sum of waste |
| Best session | The completed session with the highest efficiency |
| Output efficiency | Sorted ÷ input, all sessions |
| Waste rate | Waste ÷ input, all sessions |
| Sessions completed | Completed sessions as a share of all sessions |
| Where the fabric went | A bar showing the sorted and waste shares of the input |
| Recent sessions | A bar chart of input, sorted and waste for the last 8 sessions |

With no sessions the tab shows "No sorting sessions yet".

### Sessions tab

A table of sessions, newest first.

| Column | Shows |
|---|---|
| # | Session number |
| Fabric | Material of the lot |
| Supervisor | Username of the supervisor |
| Unit | Factory unit name |
| Input | Quantity taken |
| Sorted | Quantity sorted |
| Waste | Waste quantity |
| Efficiency | Sorted ÷ input as a percentage, shown for completed sessions only |
| Status | In Progress, Completed or On Hold |

Tools: search ("Search fabric, supervisor, unit…"), a **Status** filter, **Columns**, and **Export** (`sorting-sessions-<date>.csv`).

Row actions: **Complete** (only while the session is not Completed), **Edit**, **Delete**.

### Fabric lots tab

| Column | Shows |
|---|---|
| Material | Material type |
| Vendor | Vendor of the delivery the lot came from |
| Initial | Initial quantity |
| Sorted | Quantity sorted so far |
| Remaining | Quantity still unsorted |
| Status | The lot status, plus a **Quarantined** badge when a failed quality inspection holds the lot or its delivery |

Tools: search ("Search material, vendor…"), a **Status** filter, **Columns**, and **Export** (`fabric-lots-<date>.csv`).

Row actions: **Edit**, **Delete**.

### Forms

| Form | Opened by | Save button |
|---|---|---|
| Start sorting session | **Start session** | **Start session** |
| Edit sorting session | **Edit** on a session | **Update** |
| Complete sorting session | **Complete** on a session | **Mark complete** |
| Add fabric lot | **Add fabric lot** | **Save** |
| Edit fabric lot | **Edit** on a lot | **Update** |

## Records and fields

### Fabric lot

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Warehouse delivery | The delivery the material came from. Options read "fabric type — vendor, weight" | Yes | "Choose the warehouse delivery." A quarantined delivery is refused |
| Material type | Name of the material, e.g. "Cotton White Grade A" | Yes | Up to 255 characters. "Enter the material type." |
| Initial quantity (kg) | How much the lot started with | Yes | Greater than zero, up to 2 decimals |
| Status | See [Statuses](#statuses) | Yes | Starts as In Warehouse |
| Sorted | Total sorted so far | Automatic | Changed only by completing sessions |
| Remaining | Still unsorted | Automatic | Starts equal to the initial quantity. Changed by completing sessions and by editing the initial quantity |
| Quarantined | Whether a failed, unreleased inspection holds the lot or its delivery | Automatic | Shown as a badge |

The list also carries a calculated figure, the sellable dried stock of the lot (`dried_available_kg`). The Sorting screen does not show it; Sales uses it.

### Sorting session

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Fabric lot | The lot being sorted. Options read "material — kg left" | Yes | "Choose a fabric lot." A quarantined lot is refused |
| Supervisor | The person in charge. The list holds every active user, shown as "username (role)" | Yes | "Choose a supervisor." |
| Unit | Where the work is done. The list comes from the Warehouse factory units | Yes | "Choose a unit." Stored as text, up to 50 characters |
| Quantity taken (kg) | How much was taken from the lot | Yes | Greater than zero, up to 2 decimals |
| Notes | Free text | No | |
| Quantity sorted (kg) | Good output. Entered when completing | On completion | Zero or more |
| Waste (kg) | Rejected material. Entered when completing | On completion | Zero or more. Starts at 0 |
| Start date | When the session was created | Automatic | |
| End date | When it was completed | Automatic | |
| Status | See [Statuses](#statuses) | Automatic | |

## Statuses

### Sorting session

| Status | Meaning | How it is reached |
|---|---|---|
| In Progress | Work is under way | Every new session starts here |
| Completed | Finished, with sorted and waste quantities | **Complete** on the row |
| On Hold | Paused | The status exists, but no control on the screen sets it. It can only be set through the API |

A completed session cannot be completed again.

### Fabric lot

| Status | Meaning | How it is reached |
|---|---|---|
| In Warehouse | Not yet worked on | The default for a new lot |
| In Sorting | Being sorted | Set by hand in the lot form. The system never sets it |
| Sorted | Fully sorted, or dried | Set automatically when a completed sorting session brings the remaining quantity to zero. Also set automatically when a drying session on the lot is completed |
| Sent to Decolorization | Has been through decolorization | Set automatically when a decolorization session on the lot is completed. The Drying form offers only lots with this status |

The status can also be changed by hand in the lot form at any time. Starting a sorting session does not change the lot's status.

Note that the status does not say whether the lot can be sold. Sellable stock comes from completed drying sessions, see [Inventory](inventory.md).

## How to

### Create a fabric lot from a delivery

1. Open **Sorting** and go to the **Fabric lots** tab.
2. Click **Add fabric lot**.
3. Choose the **Warehouse delivery**.
4. Enter the **Material type** and the **Initial quantity (kg)**.
5. Leave the **Status** as In Warehouse, or choose another.
6. Click **Save**.

### Start a sorting session

1. Click **Start session**.
2. Choose the **Fabric lot**, the **Supervisor** and the **Unit**.
3. Enter the **Quantity taken (kg)** and, if you wish, **Notes**.
4. Click **Start session**. The message "Sorting session added." appears and the session is listed as In Progress.

### Complete a sorting session

1. On the **Sessions** tab, open the "⋯" menu on the session and choose **Complete**.
2. Enter the **Quantity sorted (kg)** and the **Waste (kg)**. Together they cannot be more than the quantity taken.
3. Click **Mark complete**. The message "Sorting session completed." appears.

The lot's Sorted figure goes up by the sorted quantity. Its Remaining figure goes down by sorted plus waste.

### Correct a lot's initial quantity

1. On the **Fabric lots** tab, choose **Edit** on the lot.
2. Change the **Initial quantity (kg)** and click **Update**.

The Remaining figure moves by the same amount. The form explains this: "Remaining … changes through sorting sessions; changing the initial quantity adjusts it by the same amount."

## Business rules

| Rule | Message |
|---|---|
| Quantity taken must be greater than zero | "Quantity taken must be greater than zero." |
| A session cannot be started on, or moved to, a lot in quarantine | "This fabric lot is in quarantine after failing inspection QC-00001 and can't be sorted until an admin releases it." |
| A completed session cannot be completed again | "Session already completed." |
| Sorted and waste quantities must be numbers | "Enter a valid number." |
| Sorted and waste quantities cannot be negative | "Must be zero or more." |
| Sorted plus waste cannot be more than the quantity taken | "Output (9.00 kg) plus waste (5.00 kg) is more than the input (10.00 kg)." |
| Sorted plus waste cannot be more than the lot has left unsorted | "Only 195.00 kg of this fabric is left unsorted." |
| A lot's initial quantity must be greater than zero | "Initial quantity must be greater than zero." |
| A lot's initial quantity cannot be lowered below what has already left the unsorted pool | "More than this has already been sorted." |
| A new lot cannot be made from a delivery in quarantine, and a lot cannot be moved to one | "This delivery is in quarantine after failing inspection QC-00001 and can't be sent to sorting until an admin releases it." |
| A lot cannot be deleted while sessions, inspections, production orders, sales records or stock movements use it. A user chosen as supervisor cannot be deleted either | "This record cannot be deleted because other records depend on it: …" |

The quarantine messages always say "until an admin releases it". The release itself needs the duty *Release quarantine* (Admin by default), see [Quality](quality.md).

What completing a session does:

1. Saves the sorted and waste quantities, sets the status to Completed and records the end date.
2. Adds the sorted quantity to the lot's Sorted figure.
3. Takes sorted plus waste off the lot's Remaining figure.
4. Sets the lot's status to Sorted if nothing remains.

Things the code does **not** do, which are worth knowing:

- Starting a session does not reserve the quantity taken and does not check it against what the lot has left. The check happens when the session is completed.
- Remaining and Sorted cannot be typed in. The server ignores them.
- Deleting or editing a completed session does not put its quantities back on the lot. Correct the lot's initial quantity if you need to.
- Every add, change, completion and delete is written to the audit log, including the change to the lot.

## Related data

| Module | How it relates |
|---|---|
| [Warehouse](warehouse.md) | A lot comes from a delivery. Unit names come from the factory units |
| [Quality](quality.md) | A failed inspection on a lot, or on its delivery, quarantines the lot. Quarantine blocks new sorting sessions and new lots |
| [Decolorization](decolorization.md) | Sessions work on a lot. Completing one sets the lot to Sent to Decolorization |
| [Drying](drying.md) | Sessions work on a lot. Completing one sets the lot to Sorted and adds the dried output to sellable stock |
| [Inventory](inventory.md) | Sellable stock is counted per fabric lot |
| [Sales](sales.md) | Orders and quotations name a fabric lot |
| [Production](production.md) | A production order names a fabric lot and lists its sorting sessions under "Lot activity" |
| [Sustainability](sustainability.md) | Uses completed sorting sessions for its figures. A waste record can name a fabric lot |
| [Users](users.md) | The supervisor is a user |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/sorting/models.py`

| Model | Notes |
|---|---|
| `FabricStock` | The fabric lot. `stock` (`PROTECT`, related name `fabric_stocks`), `material_type`, `initial_quantity`, `sorted_quantity`, `remaining_quantity`, `status`, `created_at`, `updated_at` |
| `SortingSession` | `fabric` and `supervisor` (both `PROTECT`), `unit` (text), `quantity_taken`, `quantity_sorted`, `waste_quantity`, `start_date` (set on creation), `end_date`, `status`, `notes` |

There is no `services.py`. The rules are in:

- `backend/apps/sorting/serializers.py`: `FabricStockSerializer.validate` (quarantine of the delivery, initial and remaining quantity) and `SortingSessionSerializer.validate` (quantity taken, quarantine of the lot through `apps.quality.services.check_lot_change`).
- `backend/apps/sorting/views.py`: `SortingSessionViewSet.complete`, which locks the lot row (`select_for_update`) so two sessions cannot process the same weight at once.
- `backend/apps/core/quantities.py`: `parse_kg` and `check_not_more_than_input`, shared with decolorization and drying.

`FabricStockSerializer` adds the read-only fields `stock_fabric_type`, `stock_vendor`, `dried_available_kg` (from `apps.inventory.services`) and `quarantined` (from `apps.quality.services.quarantined_ids`).

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/sorting/fabric-stock/` | List or add fabric lots. Filter: `status` |
| GET, PUT, PATCH, DELETE | `/api/v1/sorting/fabric-stock/<id>/` | One lot |
| GET, POST | `/api/v1/sorting/sessions/` | List or add sessions. Filters: `status`, `unit` |
| GET, PUT, PATCH, DELETE | `/api/v1/sorting/sessions/<id>/` | One session |
| POST | `/api/v1/sorting/sessions/<id>/complete/` | Complete a session. Body: `quantity_sorted`, `waste_quantity` |

The screen filters by status in the browser; the `status` and `unit` query parameters are available to other clients.

### Permissions

- Both viewsets use `IsSortingOrAdmin`: any valid role may read; a change needs the `sorting` page in Full.
- The API gate (`check_api_access` in `backend/apps/access/services.py`) lets a user read the sorting API if they hold one of: Sorting, Dashboard, Quality, Production, Sustainability or Sales.
- The Sorting page itself reads `sorting`, `warehouse` (deliveries and units) and the open list `users/list`.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/sorting/page.tsx` | The route |
| `frontend/src/features/sorting/sorting-page.tsx` | Tabs and tables |
| `frontend/src/features/sorting/sorting-dashboard.tsx` | `sortingKpis` and the dashboard |
| `frontend/src/features/sorting/sorting-forms.tsx` | `SessionDialog`, `CompleteDialog`, `FabricDialog` |
| `frontend/src/features/sorting/schemas.ts` | Form rules, `SESSION_STATUSES`, `FABRIC_STATUSES` |
| `frontend/src/types/api.ts` | `FabricLot`, `SortingSession` |

### Tests

- Backend: `backend/apps/sorting/tests.py` (create, quantity check, partial and full completion, completion validation, no double completion, filters). Quarantine is tested in `backend/apps/quality/tests.py`.
- Browser: `frontend/e2e/sorting.mjs` (dashboard, start a session, a refused completion, a valid completion showing 90.0% efficiency, delete, the lot edit explanation, the role-aware menu).

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "Only … kg of this fabric is left unsorted." | Sorted plus waste is more than the lot's Remaining figure | Enter smaller figures, or correct the lot's initial quantity |
| "Output … plus waste … is more than the input …" | Sorted plus waste is more than the quantity taken | Correct the figures, or edit the session's quantity taken first |
| "This fabric lot is in quarantine …" | A quality inspection of the lot or its delivery failed and has not been released | Have the material released in [Quality](quality.md) |
| The lot still shows In Warehouse after a session | The status only changes to Sorted when nothing remains | Nothing to fix. Change the status by hand if you want to show In Sorting |
| A deleted session's weight is still counted on the lot | Deleting a completed session does not reverse it | Edit the lot's initial quantity to correct Remaining |
| The Unit list is empty | No factory units exist | Add units in [Warehouse](warehouse.md) |
| A lot cannot be deleted | Other records use it | Leave it in place |

## Keeping this page up to date

- `backend/apps/sorting/models.py`, `serializers.py`, `views.py`, `urls.py`: fields, statuses, rules and endpoints.
- `backend/apps/core/quantities.py` and `backend/apps/quality/services.py`: the shared quantity and quarantine checks and their messages.
- `backend/apps/decolorization/views.py` and `backend/apps/drying/views.py`: they change the lot's status on completion.
- `frontend/src/features/sorting/`: screens, labels and form messages.
