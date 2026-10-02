# Purchasing

This guide covers the Purchasing page: purchase requests, purchase orders, deliveries booked against orders, supplier invoices, supplier payments, returns to suppliers, supplier quotes and supplier performance. It is for the people who buy material and for administrators who approve and pay.

In the code the module is called `procurement`. On screen it is always called **Purchasing**.

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

Purchasing follows material from the moment someone asks for it until the supplier is paid:

1. A **purchase request** asks for material. It needs approval.
2. A **purchase order** is sent to a supplier. It needs approval too.
3. **Deliveries** are recorded on the Warehouse page and can be linked to an order line. The order's status follows the deliveries by itself.
4. A **supplier invoice** is recorded, with or without an order.
5. **Supplier payments** are recorded against an invoice. The invoice's status follows the payments by itself.

It also keeps **returns to suppliers** (a record only), **supplier quotes** for comparing prices, and a **supplier performance** table.

Suppliers are the same records as the Warehouse page's vendors. A delivery without a purchase order keeps working exactly as before; the link is optional.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full, with every duty |
| Warehouse Supervisor | Full access to the page, but no approval or payment duty |
| Sorting, Decolorization, Drying Supervisors | No access |

Duties used by this module:

| Action | Needs |
|---|---|
| Approve or reject a purchase request | The duty *Approve purchases* (Admin by default) |
| Approve a purchase order | The duty *Approve purchases* (Admin by default) |
| Close a purchase order | The duty *Approve purchases* (Admin by default) |
| Record, change or delete a supplier payment | The duty *Record supplier payments* (Admin by default) |
| Everything else (requests, orders, invoices, returns, quotes) | The Purchasing page at Full |

A user who holds the page at View only can look at every tab but cannot add, change or delete anything.

How access is changed is explained in [Access control](../05-access-control.md).

The screen follows the duties: **Approve**, **Reject** and **Close order** are shown only to users with *Approve purchases*, and **Record payment** (with Edit and Delete on payments) only to users with *Record supplier payments*. The server checks again whatever the screen shows.

## Screens

The page is at `/procurement`. Its title is **Purchasing**. It has seven tabs. The button at the top right changes with the tab.

| Tab | Top-right button |
|---|---|
| Dashboard | **New order** |
| Requests | **New request** |
| Orders | **New order** |
| Invoices | **Record invoice** |
| Payments | **Record payment** (needs the duty *Record supplier payments*) |
| Returns | **Record return** |
| Suppliers | **Add quote** |

Every table has a search box, a **Columns** chooser and an **Export** button that downloads the visible rows as a CSV file.

### Dashboard

Four cards:

| Card | Shows |
|---|---|
| Waiting for approval | Submitted requests plus submitted orders |
| Open orders | Orders that are Approved or Partially Received, and their total value |
| Late deliveries | Open orders past their expected date |
| Owed to suppliers | What is unpaid on supplier invoices. The hint shows the overdue amount, or what was spent this month |

Two lists:

- **Waiting for approval**: each submitted request and order. A user with the duty *Approve purchases* sees **Approve** (and **Reject** for requests). Others see "Your role can't approve these".
- **Open orders**: up to six open orders, soonest expected date first, with a bar showing how much has been received.

### Requests

Columns: Request, Requested by, Materials, Quantity, Needed by, Status. A rejected request shows its reason under the status. A request that became an order shows the order number.

Filter: **Request status**.

Row actions:

| Action | Shown when |
|---|---|
| Submit for approval | Status is Draft or Rejected |
| Approve | Status is Submitted, for users with the duty *Approve purchases* |
| Reject | Status is Submitted, for users with the same duty. Asks for a reason |
| Create order | Status is Approved. Opens the order form filled with the request's lines |
| Cancel request | Status is not Ordered or Cancelled |
| Edit | Status is Draft or Rejected |
| Delete | Status is Draft, Rejected or Cancelled |

### Orders

Columns: Order (with "Rev N" when it has been amended), Supplier, Ordered, Expected (red with a clock when late), Amount, Received (a bar), Status.

Filters: **Order status** and a period filter on the order date.

Row actions:

| Action | Shown when |
|---|---|
| Submit for approval | Status is Draft |
| Approve | Status is Submitted, for users with the duty *Approve purchases* |
| Record invoice | Status is not Draft or Cancelled. Opens the invoice form for this order |
| Close order | Status is Approved, Partially Received or Received, for users with the duty *Approve purchases* |
| Cancel order | Status is Draft or Submitted, or Approved with nothing received. Asks for confirmation |
| Edit | Status is Draft, Submitted, Approved or Partially Received |
| Delete | Status is Draft, Submitted or Cancelled |

### Invoices

Columns: Supplier, Invoice no. (with the order number), Date, Due (shows "overdue" in red), Total, Paid (a bar and the amount still due), Status.

Filter: **Invoice status**.

Row actions: **Record payment** (with the duty *Record supplier payments*, when the invoice is not Paid), **Edit**, **Delete** (only when nothing has been paid).

### Payments

Columns: Date, Supplier, Invoice, Amount, Method, Reference, Recorded by.

Row actions: **Edit** and **Delete**, for users with the duty *Record supplier payments*. Without it the tab says "Your role can't record supplier payments." when empty.

### Returns

Columns: Return, Supplier, Delivery (with the order number), Quantity, Reason, Date.

Row actions: **Edit**, **Delete**.

### Suppliers

Three parts:

- **Supplier performance**: one row per supplier. Columns: Supplier, Orders, Deliveries, Received, Rejected (%), On time (%), Avg price/kg, Payable. Row action: **Edit profile**, which opens the vendor form from the Warehouse page.
- **Price comparison**: for each material, every supplier's best valid quote or last order price, cheapest first. A box filters by material.
- **Supplier quotes**: the quotes on record. Columns: Supplier, Material, Price/kg, Quoted, Valid until ("Open" when there is no end date; struck through when expired). Row actions: **Edit**, **Delete**.

## Records and fields

### Purchase request

Number format: `PR-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| For unit | The factory unit the material is for | No | "Any unit" when empty |
| Needed by | Date the material is needed | No | |
| Materials | One or more rows of material and quantity (kg) | Yes, at least one | Quantity must be greater than zero |
| Notes | Free text | No | |
| Requested by | The user who created it | Set by the system | Cannot be chosen |
| Status | See [Statuses](#statuses) | Set by the system | |
| Decided by, decided at | Who approved or rejected it, and when | Set by the system | |
| Rejection reason | Why it was rejected | Required when rejecting | Cleared when the request is submitted again |

### Purchase order

Number format: `PO-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Supplier | The vendor | Yes | Only active suppliers are offered. Cannot change once goods have been received |
| From request | The approved request this order fulfils | No | Must be Approved or Ordered |
| Order date | Date of the order | Yes | Defaults to today |
| Expected delivery | Date the goods are expected | No | Not before the order date |
| Lines | Material, Quantity (kg), Price per kg | Yes, at least one | Quantity greater than zero. Price may be zero but not negative |
| Notes | Free text | No | Changing only the notes is not an amendment |
| Revision | Number of amendments | Set by the system | Starts at 0 |
| Created by, approved by, approved at | | Set by the system | |

Figures worked out for each order: total amount, ordered kg, received kg, invoiced amount. For each line: amount, received kg, rejected kg, returned kg, remaining kg.

### Supplier invoice

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Supplier | The vendor | Yes | |
| Purchase order | The order being invoiced | No | Must belong to the same supplier |
| Invoice no. | The supplier's own invoice number | Yes | Unique per supplier |
| Invoice date | | Yes | Defaults to today |
| Due date | | No | Not before the invoice date |
| Amount before tax (Rs.) | | Yes | Greater than zero |
| Tax (Rs.) | | No | Not negative. Defaults to 0 |
| Notes | | No | |
| Status | Unpaid, Partial or Paid | Set by the system | Follows the payments |

Total = amount + tax. When the form is opened from an order, the amount is filled with the order total less what has already been invoiced.

### Supplier payment

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Invoice | The invoice being paid | Yes | Only invoices that are not Paid are offered |
| Amount (Rs.) | | Yes | Greater than zero, and not more than what is outstanding |
| Payment date | | Yes | Defaults to today |
| Method | Cash, Bank Transfer, Cheque or Online Transfer | Yes | Defaults to Bank Transfer |
| Reference | Cheque or transfer number | No | |
| Paid by | The user who recorded it | Set by the system | The logged-in user, unless the API is given another user |

### Return to supplier

Number format: `RET-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Delivery | The warehouse delivery the material came from | Yes | The form lists the 200 most recent deliveries |
| Quantity (kg) | | Yes | Greater than zero, and not more than the delivery's weight less earlier returns |
| Return date | | Yes | Defaults to today |
| Reason | | Yes | |

A return is a record only. It does not change the delivery, the warehouse stock or the order's received weight.

### Supplier quote

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Supplier | | Yes | |
| Material | | Yes | |
| Price per kg (Rs.) | | Yes | Greater than zero |
| Minimum quantity (kg) | | No | |
| Quote date | | Yes | Defaults to today |
| Valid until | | No | Not before the quote date |
| Notes | | No | |

The model also has a link from a quote to a purchase request (`requisition`). The form does not offer it.

### Supplier profile

Suppliers are warehouse vendors. **Edit profile** opens the vendor form with: Vendor name, Contact, Address, and under "Supplier profile": Email, Category (Textile waste, Post-consumer, Pre-consumer, Chemicals, Packaging, Other), Materials supplied, Payment terms (days), and whether the supplier is active. Inactive suppliers are not offered in the order, invoice and quote forms.

## Statuses

### Purchase request

| Status | Meaning | How it gets there |
|---|---|---|
| Draft | Being prepared | Created; or a Rejected request was edited |
| Submitted | Waiting for approval | **Submit for approval** from Draft or Rejected |
| Approved | Can be turned into an order | **Approve** from Submitted |
| Rejected | Sent back with a reason | **Reject** from Submitted |
| Ordered | An order made from it was approved | Set when a linked purchase order is approved |
| Cancelled | No longer wanted | **Cancel request** from any status except Ordered and Cancelled |

### Purchase order

| Status | Meaning | How it gets there |
|---|---|---|
| Draft | Being prepared | Created |
| Submitted | Waiting for approval | **Submit for approval** from Draft; or an Approved or Partially Received order was changed (amendment) |
| Approved | Goods can be received | **Approve** from Submitted, when nothing has arrived yet |
| Partially Received | Some goods have arrived | A delivery was booked against a line; or an amendment with deliveries was approved again |
| Received | Every line has received its full quantity | Deliveries reached the ordered quantity on every line |
| Closed | No more deliveries are expected | **Close order** from Approved, Partially Received or Received |
| Cancelled | Withdrawn | **Cancel order** from Draft, Submitted or Approved, when nothing has been received |

Approved, Partially Received and Received follow the deliveries in both directions. Deleting a delivery can move a Received order back to Partially Received.

### Supplier invoice

| Status | Meaning |
|---|---|
| Unpaid | Nothing has been paid |
| Partial | Something has been paid, but less than the total |
| Paid | Payments reach the total |

An invoice is shown as **overdue** when it has a due date in the past and is not Paid. Overdue is a flag, not a status.

## How to

### Ask for material

1. Open **Purchasing** and the **Requests** tab.
2. Press **New request**.
3. Optionally choose **For unit** and **Needed by**.
4. Under **Materials**, type the material and the quantity in kg. Press **Add material** for more rows.
5. Press **Save**. The request is saved as a Draft.
6. In the row's menu choose **Submit for approval**.

### Approve or reject a request

1. Open the **Dashboard** tab (or the **Requests** tab, or the Approvals page).
2. Press **Approve**, or press **Reject** and type the reason.

The requester sees the reason. They can edit the request, which puts it back to Draft, and submit it again.

### Place an order

1. On the **Requests** tab, open the menu of an Approved request and choose **Create order**. Or press **New order** on the Orders tab to start without a request.
2. Choose the **Supplier**.
3. Check the dates and fill in **Price per kg** on each line. The form shows the total.
4. Press **Save**. The order is a Draft.
5. In the row's menu choose **Submit for approval**.
6. A user with the duty *Approve purchases* chooses **Approve**. If the order came from a request, the request becomes Ordered.

### Receive goods against an order

1. Open the **Warehouse** page and press **Add stock**.
2. Choose the **Vendor**. The field **Purchase order** appears when that supplier has open order lines.
3. Choose the order line. If the fabric type is empty it is filled with the line's material.
4. Fill in the rest of the delivery and press **Save**.

The order becomes Partially Received or Received by itself. A delivery whose status is Rejected does not count as received.

### Change an approved order

1. On the **Orders** tab choose **Edit**. The form warns: "This order is approved: saving a change makes it an amendment that needs approval again."
2. Change the lines, dates or supplier and press **Update**.
3. The order's revision goes up by one and its status returns to Submitted.
4. A user with the duty approves it again. It returns to Approved, Partially Received or Received, depending on what has arrived.

### Record an invoice and pay it

1. On the **Orders** tab choose **Record invoice** (or press **Record invoice** on the Invoices tab).
2. Type the supplier's **Invoice no.**, the amount and the tax. Press **Save**.
3. On the **Invoices** tab choose **Record payment**. The amount is filled with what is outstanding.
4. Choose the method and press **Save**. The invoice becomes Partial or Paid.

### Record a return to a supplier

1. Open the **Returns** tab and press **Record return**.
2. Choose the **Delivery**, type the **Quantity (kg)**, the **Return date** and the **Reason**.
3. Press **Save**.

### Compare prices

1. Open the **Suppliers** tab.
2. Press **Add quote** to record a price a supplier offered.
3. Under **Price comparison**, type a material in the filter box. The cheapest supplier is at the top with a green dot.

## Business rules

Every rule below is enforced by the server.

### Requests

| Rule | Message |
|---|---|
| A request needs at least one material | "Add at least one material." |
| A request with no lines cannot be submitted | "Add at least one material before submitting." |
| A line's quantity must be positive | "Quantity must be greater than zero." |
| Only Draft or Rejected requests can be submitted | "Only draft or rejected records can be submitted." |
| Only Submitted requests can be approved or rejected | "Only submitted records can be approved or rejected." |
| Rejecting needs a reason | "Say why the request is rejected." |
| Only Draft or Rejected requests can be edited | "A submitted request can no longer be changed." (the status in the message varies) |
| Editing a Rejected request puts it back to Draft | |
| An Ordered or Cancelled request cannot be cancelled | "A ordered request can't be cancelled." / "A cancelled request can't be cancelled." |
| Only Draft, Rejected or Cancelled requests can be deleted | "Only draft, rejected or cancelled requests can be deleted." |
| Approving or rejecting needs the duty *Approve purchases* | "Your role is not allowed to approve or reject purchases." |

### Orders

| Rule | Message |
|---|---|
| An order needs at least one line | "Add at least one line." |
| An order with no lines cannot be submitted | "Add at least one line before submitting." |
| Only a Draft order can be submitted | "Only draft records can be submitted." |
| Only a Submitted order can be approved | "Only submitted records can be approved." |
| A linked request must be Approved or Ordered | "Only an approved request can be turned into an order." |
| A price cannot be negative | "Price can't be negative." |
| The expected date cannot be before the order date | "Expected date can't be before the order date." |
| Received, Closed and Cancelled orders cannot be edited | "A closed order can no longer be changed." (the status varies) |
| Changing an Approved or Partially Received order is an amendment: revision + 1, status back to Submitted, approval cleared. Changing only the notes is not | |
| The supplier cannot change once goods have arrived | "Goods have been received; the supplier can't change." |
| A line's quantity cannot go below what has arrived | "\"Cotton White\": 300.00 kg has already been received; the quantity can't be lower." |
| A line with deliveries cannot be removed | "\"Cotton White\" has deliveries and can't be removed." |
| An order can be cancelled only from Draft, Submitted or Approved | "Only draft or submitted or approved records can be cancelled." |
| An order with deliveries cannot be cancelled | "Goods have been received against this order; close it instead." |
| Only Approved, Partially Received or Received orders can be closed | "Only approved or partially received or received records can be closed." |
| Only Draft, Submitted or Cancelled orders can be deleted | "Approved orders can't be deleted; cancel or close them instead." |
| Approving an order whose request is Approved sets the request to Ordered | |

### Deliveries against an order

These are checked when a delivery is saved on the Warehouse page.

| Rule | Message |
|---|---|
| Goods can be received only against an Approved or Partially Received order | "PO-00012 is closed; goods can only be received against an approved order." (the status varies) |
| The delivery's supplier must be the order's supplier | "PO-00012 is from Ali Traders, not Sindh Fabrics." |
| A delivery with status Rejected counts as rejected, not received | |
| A delivery can exceed the line's remaining quantity. The remaining quantity never goes below zero | |

### Invoices and payments

| Rule | Message |
|---|---|
| The amount must be positive | "Amount must be greater than zero." |
| Tax cannot be negative | "Tax can't be negative." |
| The order must belong to the invoice's supplier | "PO-00012 is from Ali Traders." |
| The due date cannot be before the invoice date | "Due date can't be before the invoice date." |
| A supplier's invoice number is used once | "This supplier already has an invoice with this number." |
| An invoice's total cannot be reduced below what was paid | "The total can't be less than what has already been paid." |
| A payment must be positive | "Must be greater than zero." |
| A payment cannot exceed what is outstanding | "Only Rs. 9,000.00 is outstanding on this invoice." |
| Recording, changing or deleting a payment needs the duty *Record supplier payments* | "Your role is not allowed to record supplier payments." |
| An invoice with payments cannot be deleted | The delete is refused with: "This record cannot be deleted because other records depend on it: …" |

### Returns and quotes

| Rule | Message |
|---|---|
| A return needs a reason | "Say why the material is returned." |
| The quantity must be positive | "Must be greater than zero." |
| Returns on one delivery cannot exceed its weight | "Only 40.00 kg of this delivery can still be returned." |
| A quote's price must be positive | "Price must be greater than zero." |
| A quote's valid-until date cannot be before the quote date | "Can't be before the quote date." |

### How the report figures are worked out

- **Late deliveries**: open orders (Approved or Partially Received) whose expected date is before today.
- **Spent this month**: the total of supplier invoices dated this month.
- **Supplier performance**:
  - Orders, ordered kg and spend count every order except Draft and Cancelled.
  - Received and rejected kg count every delivery from the supplier, with or without an order.
  - Rejected % = rejected kg ÷ (received + rejected kg).
  - On time % looks only at orders that are Received or Closed, have an expected date and have deliveries. An order is on time when its last delivery arrived on or before the expected date.
  - Avg price/kg = spend ÷ ordered kg.
  - Payable = what is outstanding on unpaid invoices.
- **Price comparison**: materials are matched ignoring upper and lower case and extra spaces. For each supplier it takes the lowest quote that is still valid, or else the price on the most recent order.

## Related data

| Module | What happens |
|---|---|
| [Warehouse](warehouse.md) | Suppliers are warehouse vendors. A delivery (`Stock`) can point to an order line through `po_line`. Saving or deleting a delivery refreshes the order's status |
| [Quality](quality.md) | Supplier performance reads incoming inspections to count passed and failed inspections per supplier (returned by the API; the table does not show it) |
| [Finance](finance.md) | Supplier invoices and supplier payments are posted to the journal when the books are updated. Unpaid invoices feed "We owe suppliers" and the costing report's raw material figure |
| [Approvals and notifications](approvals-and-notifications.md) | Submitted requests and orders appear in the Approvals inbox. Two notification rules read this module: purchases waiting for approval, and supplier invoices due or overdue |
| [Search and traceability](search-and-traceability.md) | Suppliers, purchase requests and purchase orders can be found from the search box (supplier invoices cannot). The trace of a lot shows the purchase order of its delivery |
| [Dashboard and reports](dashboard-and-reports.md) | "Business at a glance" shows pending and late purchase orders. The report centre has a *Supplier performance* report, and *Quality performance* lists incoming inspections by supplier |

## For developers

**Backend:** `backend/apps/procurement`.

| File | Contents |
|---|---|
| `models.py` | `NumberedModel` (abstract; sets `number` as `PREFIX-00001` on first save), `PurchaseRequisition`, `RequisitionLine`, `PurchaseOrder`, `PurchaseOrderLine`, `PurchaseReturn`, `SupplierQuotation`, `SupplierInvoice`, `SupplierPayment` |
| `services.py` | Status transitions, amendment rule (`mark_amended`), receipt check (`check_receipt`, called from `apps/warehouse/serializers.py`), payment and return checks |
| `signals.py` | `Stock` saved or deleted → `refresh_order_status`; `SupplierPayment` saved or deleted → `SupplierInvoice.refresh_status` |
| `serializers.py` | Nested lines, computed figures (returned as strings with two decimals) |
| `views.py` | View sets, the permission classes `IsProcurementUser`, `IsAdminForWrites` (duty `pay_suppliers`), `IsAdminAction` (duty `approve_purchases`), and the three report views |
| `demo.py` | Demo records for the `seed_module_data` command |
| `tests.py` | Rules above, as tests |

`NumberedModel` is reused by Sales, Finance and other modules.

**Endpoints** (all under `/api/v1/procurement/`):

| Method and path | Purpose |
|---|---|
| `GET, POST /requisitions/` | List (filters `status`, date parameters on `created_at`), create |
| `GET, PATCH, PUT, DELETE /requisitions/{id}/` | Read, change, delete |
| `POST /requisitions/{id}/submit/` | Draft or Rejected → Submitted |
| `POST /requisitions/{id}/approve/` | Submitted → Approved (duty) |
| `POST /requisitions/{id}/reject/` | Submitted → Rejected; body `{"reason": "…"}` (duty) |
| `POST /requisitions/{id}/cancel/` | → Cancelled |
| `GET, POST /orders/` | List (filters `status` as a comma-separated list, `vendor`, date parameters on `order_date`), create |
| `GET, PATCH, PUT, DELETE /orders/{id}/` | Read, change (may amend), delete |
| `POST /orders/{id}/submit/`, `/approve/`, `/cancel/`, `/close/` | Status changes (`approve` and `close` need the duty) |
| `GET /open-lines/` | Order lines that can still receive goods (filter `vendor`). Also readable with the Warehouse page |
| `GET, POST /returns/`, `/returns/{id}/` | Returns to suppliers (date parameters on `return_date`) |
| `GET, POST /quotations/`, `/quotations/{id}/` | Supplier quotes (filter `material`) |
| `GET, POST /invoices/`, `/invoices/{id}/` | Supplier invoices (filters `status`, `vendor`, date parameters on `invoice_date`) |
| `GET, POST /payments/`, `/payments/{id}/` | Supplier payments (writes need the duty; date parameters on `payment_date`) |
| `GET /summary/` | Dashboard figures |
| `GET /supplier-performance/` | One row per supplier |
| `GET /price-comparison/` | Offers per material (filter `material`) |

Reading needs the Purchasing page. The one exception is `/open-lines/`, which the Warehouse page can also read, so that a delivery can be booked against an order. Changing needs the Purchasing page at Full. Every status change is written to the audit log.

**Frontend:** `frontend/src/features/procurement/` (`procurement-page.tsx`, `procurement-forms.tsx`, `schemas.ts`). Route: `frontend/src/app/(app)/procurement/page.tsx`. Types: `frontend/src/types/api.ts`.

**Tests:** `backend/apps/procurement/tests.py`.

**Browser scenario:** `frontend/e2e/procurement.mjs`. It walks through request → approval → order → approval → delivery → amendment → invoice → payment → suppliers tab, and checks that a sorting supervisor cannot open the page.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| A supervisor sees no **Approve** or **Record payment** button | Their role does not hold the duty *Approve purchases* or *Record supplier payments* | Give the role the duty under Users → Access, or have an Admin do it |
| "PO-… is closed; goods can only be received against an approved order." | The order is not Approved or Partially Received | Approve the order, or record the delivery without an order |
| The **Purchase order** field does not appear on the delivery form | No vendor is chosen yet, or the vendor has no open order lines | Choose the vendor first; check the order is approved |
| An approved order went back to Submitted | It was edited, which is an amendment | Approve it again |
| "Goods have been received against this order; close it instead." | Cancel was tried on an order with deliveries | Use **Close order** |
| An invoice cannot be deleted | It has payments | Delete the payments first (needs the payment duty) |
| **Edit profile** fails to save for a user who has Purchasing but not Warehouse | Suppliers are saved through the Warehouse API, which needs the Warehouse page at Full | Give the user the Warehouse page, or have someone with it make the change |
| On time % shows "—" | The supplier has no Received or Closed order with an expected date | Fill in expected dates on orders |

## Keeping this page up to date

- `backend/apps/procurement/models.py`, `services.py`, `serializers.py`, `views.py`, `signals.py`, `urls.py`: records, rules, messages and endpoints.
- `backend/apps/warehouse/serializers.py` and `backend/apps/warehouse/models.py`: the delivery link (`po_line`) and the supplier profile.
- `frontend/src/features/procurement/*`: tabs, columns, row actions, form labels and client-side messages.
- `backend/apps/access/services.py`: the duties `approve_purchases` and `pay_suppliers`, and the starting access.
- `frontend/e2e/procurement.mjs`: the browser scenario described above.
