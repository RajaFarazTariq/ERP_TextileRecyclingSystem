# Warehouse

This page explains the Warehouse module: recording deliveries of waste fabric, and keeping the lists of vendors and factory units. It is for warehouse staff, administrators, and developers who maintain the module.

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

The Warehouse is the first step of the material flow. Every lorry of waste fabric that arrives is recorded as a **stock entry** (also called a delivery). The entry says who sent it, what it is, how much it weighed, and which factory unit received it.

The module also keeps two lists that other modules use:

- **Vendors**: the suppliers you receive fabric from. Purchasing uses the same list as its suppliers.
- **Factory units**: the parts of the factory that receive material, for example "Unit 1".

A stock entry does not move any sellable stock. It is the starting record that Sorting, Quality and Purchasing refer to.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| Warehouse Supervisor | Full |
| Other roles | No access to the page |

- With **View only** access, the page shows a "View only" badge instead of the add button, and the row menus (Edit, Delete) are hidden. The server also refuses any change.
- The Warehouse module needs no duty. Anyone holding the page in Full can add, edit and delete its records.
- Other pages read warehouse data without the user holding the Warehouse page. For example, Sorting reads deliveries and factory units, and Quality reads deliveries.

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/warehouse`. Its title is **Warehouse** and it has three tabs. The button at the top right changes with the tab: **Add stock**, **Add vendor** or **Add unit**.

Above the tabs, four cards summarise the stock entries currently listed (they follow the status and period filters):

| Card | Shows |
|---|---|
| Deliveries | Number of stock entries listed, with the period |
| Weight received | Sum of "Our weight" of the listed entries |
| Pending approval | Number of listed entries with status Pending |
| Vendors | Number of vendors, and how many of them delivered in the listed entries |

### Stock entries tab

A table of deliveries, newest first, 20 rows per page.

| Column | Shows |
|---|---|
| Vendor | Vendor name |
| Fabric type | Fabric type, with the purchase order number below it if the delivery is booked against an order |
| Vehicle no. | Vehicle number |
| Weight | Our weight in kg |
| Unit | Factory unit |
| Status | Received, Pending, Approved or Rejected |
| Quality | The latest quality result: Pass, Conditional, Quarantined or Released. A dash means not inspected |
| Date | Date the entry was created |

Tools above the table:

- **Search** ("Search vendor, fabric, vehicle…").
- **Status** filter (All statuses, or one status). The server does this filtering.
- **Period** filter: All time, Today, This week, This month, This year, By year, By month, Custom range.
- **Columns** to show or hide columns, and **Export** to download the listed rows as a CSV file named `stock-entries-<date>.csv`.

Row actions (the "⋯" menu): **Edit**, **Delete**.

### Vendors tab

| Column | Shows |
|---|---|
| Name | Vendor name |
| Category | Supplier category, or a dash |
| Contact | Contact text |
| Address | Address |
| Status | Active or Inactive |

Search ("Search vendors…"), Columns and Export (`vendors-<date>.csv`) are available. Row actions: **Edit**, **Delete**.

### Factory units tab

One column, **Unit name**. Row actions: **Edit**, **Delete**.

### Forms

All forms open as a panel on the right. The save button reads **Save** for a new record and **Update** for an existing one.

- **Add stock entry / Edit stock entry**: "A delivery of fabric received at a factory unit."
- **Add vendor / Edit vendor**, with a "Supplier profile" group.
- **Add factory unit / Edit factory unit**.

## Records and fields

### Stock entry (delivery)

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Vendor | Who delivered it | Yes | "Choose a vendor." |
| Purchase order | An open purchase order line from this vendor. Shown only after a vendor is chosen and only if that vendor has open order lines. Each option reads "PO number · material · kg still due" | No | See [Business rules](#business-rules). Choosing one fills an empty Fabric type with the line's material |
| Fabric type | What the material is, e.g. "Cotton White" | Yes | Up to 100 characters. "Enter the fabric type." |
| Vendor weight slip | The vendor's weight slip number | Yes | Up to 100 characters. "Enter the vendor's weight slip number." |
| Vehicle no. | Vehicle registration | Yes | Up to 50 characters. "Enter the vehicle number." |
| Our weight (kg) | Weight on your own weighbridge | Yes | Greater than zero, up to 2 decimals |
| Unloading weight (kg) | Weight after unloading | Yes | Zero or more, up to 2 decimals |
| Factory unit | Where it was received | Yes | "Choose a factory unit." |
| Status | See [Statuses](#statuses) | Yes | Starts as Received |
| Date | When the entry was created | Automatic | Cannot be edited |
| Quality | Result of the latest quality inspection | Automatic | Calculated, see below |

How the **Quality** value is worked out from the delivery's inspections:

| Value | When |
|---|---|
| (empty) | The delivery has no inspection |
| Quarantined | Any inspection of the delivery failed and has not been released |
| Released | The latest inspection failed and was released |
| Pass / Conditional | The result of the latest inspection |

### Vendor

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Vendor name | Name | Yes | Up to 255 characters. "Enter the vendor name." |
| Contact | Phone or contact person | No | Up to 100 characters |
| Address | Address | No | |
| Email | Email address | No | "Enter a valid email address." |
| Category | Textile waste, Post-consumer, Pre-consumer, Chemicals, Packaging, Other | No | "Not set" leaves it empty |
| Materials supplied | Free text, e.g. "cotton, denim, polyester" | No | Up to 255 characters |
| Payment terms (days) | Days allowed for payment | No | Whole number, up to 3 digits. "Enter a number of days." |
| Active supplier (offered in new purchase orders) | Tick box | Yes | Ticked by default |

### Factory unit

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Unit name | Name, e.g. "Unit 1" | Yes | Up to 50 characters. "Enter the unit name." |

## Statuses

A stock entry has one of four statuses.

| Status | Meaning |
|---|---|
| Received | The default for a new entry |
| Pending | Waiting to be checked. Counted on the "Pending approval" card |
| Approved | Accepted |
| Rejected | Not accepted. Rejected deliveries are left out of the Sustainability figures |

The status is chosen by hand in the stock entry form. The system never changes it by itself, and no status blocks any later step. Blocking is done by quality quarantine, not by this status (see [Quality](quality.md)).

A vendor is **Active** or **Inactive** (the tick box). Inactive vendors stay on all existing records.

## How to

### Record a delivery

1. Open **Warehouse**. Stay on the **Stock entries** tab.
2. Click **Add stock**.
3. Choose the **Vendor**. If the list is empty it reads "Add a vendor first".
4. If a **Purchase order** field appears and the delivery belongs to an order, choose the order line. Otherwise leave "No purchase order".
5. Fill in **Fabric type**, **Vendor weight slip**, **Vehicle no.**, **Our weight (kg)** and **Unloading weight (kg)**.
6. Choose the **Factory unit** and the **Status**.
7. Click **Save**. The message "Stock entry added." appears.

### Correct a delivery

1. Find the row. Use the search box or the filters.
2. Open the "⋯" menu and choose **Edit**.
3. Change the fields and click **Update**.

### Add a vendor

1. Open the **Vendors** tab and click **Add vendor**.
2. Enter the **Vendor name**. The other fields are optional.
3. Click **Save**. The message "Vendor added." appears.

### Stop using a vendor

1. Open the **Vendors** tab, then **Edit** on the vendor.
2. Untick **Active supplier (offered in new purchase orders)** and click **Update**.

Use this instead of deleting a vendor that already has records.

### Add a factory unit

1. Open the **Factory units** tab and click **Add unit**.
2. Enter the **Unit name** and click **Save**.

### Delete a record

1. Open the "⋯" menu on the row and choose **Delete**.
2. Confirm. The dialog says "Records that depend on it can't be deleted."
3. If other records use it, the dialog shows the reason and nothing is deleted.

## Business rules

| Rule | Message |
|---|---|
| Our weight must be greater than zero | "Weight must be greater than zero." |
| A delivery can only be booked against a purchase order that is Approved or Partially Received. An entry that is already linked keeps its line when edited | "PO-00001 is closed; goods can only be received against an approved order." (the order number and its status, in lower case, vary) |
| The purchase order must be from the same vendor as the delivery | "PO-00001 is from Vendor A, not Vendor B." |
| A vendor cannot be deleted while a delivery, chemical, chemical lot or purchasing record uses it | "This record cannot be deleted because other records depend on it: …" |
| A factory unit cannot be deleted while a delivery uses it | Same message |
| A delivery cannot be deleted while a fabric lot, a quality inspection or a purchase return uses it | Same message |

Other things the code does:

- Saving, moving or deleting a delivery that is linked to a purchase order line refreshes that order's status (for example to Partially Received or Received).
- The Status of a stock entry is not checked anywhere else in the code, except that Sustainability leaves out Rejected deliveries.
- Every add, change and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Purchasing](purchasing.md) | Shares the vendor list. A delivery can be booked against an open purchase order line, which updates the order's received weight and status. Purchase returns point to a delivery |
| [Sorting](sorting.md) | A fabric lot is created from a delivery. Sorting sessions take their unit names from the factory units list |
| [Quality](quality.md) | Incoming inspections point to a delivery. A failed inspection puts the delivery in quarantine, and a quarantined delivery cannot be made into a new fabric lot |
| [Decolorization](decolorization.md) | Chemicals and chemical lots can name a vendor as supplier |
| [Sustainability](sustainability.md) | Uses the weight of deliveries that are not Rejected |
| [Search and traceability](search-and-traceability.md) | Deliveries and vendors can be found and traced |
| [Dashboard and reports](dashboard-and-reports.md) | Reports count stock entries and received weight |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/warehouse/models.py`

| Model | Notes |
|---|---|
| `Vendor` | `name`, `contact`, `address`, `email`, `category`, `specialties`, `payment_terms_days`, `is_active`, `created_at` |
| `FactoryUnit` | `name` only |
| `Stock` | `vendor` and `unit` (both `PROTECT`), `fabric_type`, `vendor_weight_slip`, `vehicle_no`, `our_weight`, `unloading_weight`, `status`, `po_line` (optional link to `procurement.PurchaseOrderLine`, related name `receipts`), `created_at` |

There is no `services.py`. The rules are in `StockSerializer.validate` (`backend/apps/warehouse/serializers.py`), which calls `apps.procurement.services.check_receipt`. `StockSerializer` adds the read-only fields `vendor_name`, `unit_name`, `po_number`, `po_material` and `qc_status`.

`backend/apps/procurement/signals.py` listens to `Stock` saves and deletes and calls `refresh_order_status` for the linked purchase order.

### Endpoints

All paths are under `/api/v1/warehouse/`. The same paths also answer under `/api/` for older clients.

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/warehouse/stock/` | List or add deliveries |
| GET, PUT, PATCH, DELETE | `/api/v1/warehouse/stock/<id>/` | One delivery |
| GET, POST | `/api/v1/warehouse/vendors/` | List or add vendors |
| GET, PUT, PATCH, DELETE | `/api/v1/warehouse/vendors/<id>/` | One vendor |
| GET, POST | `/api/v1/warehouse/units/` | List or add factory units |
| GET, PUT, PATCH, DELETE | `/api/v1/warehouse/units/<id>/` | One factory unit |
| GET | `/api/v1/procurement/open-lines/?vendor=<id>` | Open purchase order lines for the delivery form (owned by Purchasing) |

Query parameters on the stock list: `status`, `vendor`, `unit`, and the shared period parameters `date_filter` (`today`, `this_week`, `this_month`, `this_year`), `year`, `month` (`YYYY-MM`), `start`, `end`. Invalid values are ignored. The period applies to `created_at`.

A successful POST to `stock/` answers `{"message": "Stock added successfully!", "data": {...}}` with status 201, not the bare record.

### Permissions

- All three viewsets use `IsWarehouseOrAdmin` (`backend/apps/core/permissions.py`): any valid role may read; a change needs the `warehouse` page in Full.
- Before that, the API gate in `backend/apps/access/services.py` (`check_api_access`) lets a user read the warehouse API only if they hold one of the pages that use it: Warehouse, Dashboard, Sorting, Quality, Production or Purchasing. Changes need the Warehouse page in Full.
- The Warehouse page may also read `procurement/open-lines`, and nothing else from Purchasing.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/warehouse/page.tsx` | The route |
| `frontend/src/features/warehouse/warehouse-page.tsx` | Tabs, tables, cards, delete dialog |
| `frontend/src/features/warehouse/warehouse-forms.tsx` | `StockDialog`, `VendorDialog`, `UnitDialog` |
| `frontend/src/features/warehouse/schemas.ts` | Form rules, `STOCK_STATUSES`, `SUPPLIER_CATEGORIES` |
| `frontend/src/types/api.ts` | `StockEntry`, `Vendor`, `FactoryUnit`, `OpenPoLine` |

### Tests

- Backend: `backend/apps/warehouse/tests.py` (create, weight check, filters, newest-first order). Purchase order links are tested in `backend/apps/procurement/tests.py`.
- Browser: `frontend/e2e/warehouse.mjs`. It also covers the app shell: redirect to login, a wrong password, the table (search, status filter, sorting), form validation, adding and deleting a vendor, a blocked delete, the role-aware menu, dark mode, the phone layout and sign-out.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| The Vendor list in the stock form reads "Add a vendor first" | No vendors exist | Add one on the Vendors tab |
| No "Purchase order" field in the stock form | No vendor is chosen yet, or the vendor has no order that is Approved or Partially Received | Choose the vendor first. If the order is still a draft or waiting for approval, have it approved in Purchasing |
| "… is closed; goods can only be received against an approved order." | The order is no longer open | Leave the purchase order empty, or reopen the matter in Purchasing |
| Delete shows "This record cannot be deleted because other records depend on it" | The vendor, unit or delivery is used by other records | Leave it. For a vendor, untick Active supplier instead |
| No add button, and a "View only" badge | You hold the page as View only | Ask an admin for Full access |
| The Quality column shows Quarantined | An inspection of the delivery failed | See [Quality](quality.md). The delivery cannot be made into a new fabric lot until it is released |
| The cards show smaller numbers than expected | The cards follow the status and period filters | Clear the filters |

## Keeping this page up to date

- `backend/apps/warehouse/models.py`, `serializers.py`, `views.py`, `urls.py`: fields, statuses, rules and endpoints.
- `backend/apps/procurement/services.py` (`check_receipt`) and `backend/apps/procurement/signals.py`: the purchase order link.
- `frontend/src/features/warehouse/`: screens, labels, form rules and messages.
- `backend/apps/access/services.py` (`PAGE_API`, `DEFAULT_ROLE_PAGES`): who can read and change warehouse data.
