# Sales

This guide covers the Sales page: customers, products and price lists, quotations, sales orders, dispatches, invoices, payments, returns, customer statements and the performance report. It is for the people who sell and for administrators.

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

Sales sells **dried stock**: the output of completed drying sessions, held per fabric lot. The usual path is:

1. Optionally, a **quotation** is made for a customer. When the customer accepts, it becomes a Draft order.
2. A **sales order** is created as a Draft. A Draft holds no stock.
3. **Confirm** reserves the ordered weight. It is refused when the lot does not have enough free dried stock.
4. One or more **dispatches** send the goods out. Each dispatch takes its weight out of stock.
5. An **invoice** is raised for dispatched weight.
6. **Payments** are recorded against the order. The order's payment status follows them.
7. **Mark delivered** on a dispatch completes the order.
8. If goods come back, a **return** is recorded. Once approved it credits the customer and, if chosen, puts the weight back into stock.

The stock figures and the rules that block overselling live in the inventory module. See [Inventory](inventory.md).

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full, with every duty |
| All supervisors | No access |

Duties used by this module:

| Action | Needs |
|---|---|
| Approve or reject a sales return | The duty *Approve sales returns* (Admin by default) |
| Adjust sellable stock by hand | The duty *Adjust stock* (Admin by default). There is no screen for this; see [Inventory](inventory.md) |
| Merge two customers | Admin only |
| Everything else | The Sales page at Full |

With the page at View only, a user can look at every tab, open a customer's statement and print invoices and challans, but cannot add, change or delete anything.

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/sales`. It has ten tabs. The button at the top right changes with the tab.

| Tab | Top-right button |
|---|---|
| Dashboard | **New order** |
| Quotations | **New quotation** |
| Orders | **New order** |
| Dispatches | **New dispatch** |
| Invoices | **New order** (invoices are raised from an order's row menu) |
| Payments | **Record payment** |
| Returns | **Record return** |
| Customers | **Add customer** |
| Products | **New product** |
| Performance | **New order** |

One period filter (All time, Today, This week, This month, This year, By year, By month, Custom range) is shared by the Quotations, Orders, Dispatches, Invoices, Payments and Returns tabs. Every table has search, a **Columns** chooser and **Export** (CSV).

### Dashboard

Four cards:

| Card | Shows |
|---|---|
| Total revenue | The total of every order's value, and the number of orders |
| Collected | The total of all payments, and the number of payments |
| Outstanding | Total revenue less collected, and the number of orders whose payment status is Pending |
| Paid orders | Orders whose payment status is Paid; the hint shows completed orders |

Then a chart **Order value by month** (last 6 months, cancelled orders left out) and a **Top customers** list (by order value, cancelled orders left out).

> The four cards count every order, including Draft and Cancelled ones. The chart and the top-customers list leave cancelled orders out. See [Business rules](#how-the-figures-are-worked-out).

### Quotations

Columns: Number, Customer, Item, Weight, Total, Valid until (a red "Expired" badge when past), Status (with the order number once converted).

Filters: **Quotation status**, period.

| Row action | Shown when |
|---|---|
| Mark as sent | Status is Draft |
| Customer accepted | Status is Draft or Sent |
| Customer declined | Status is Draft or Sent |
| Make order | Status is Accepted. Asks for the fabric lot |
| Edit | Status is Draft or Sent |
| Delete | Status is not Converted |

### Orders

Columns: #, Buyer, Fabric, Quality, Weight, Price/kg, Total, Payment (status and a bar of how much is paid), Status, Date.

Filters: **Order status**, **Payment status**, period.

| Row action | Shown when |
|---|---|
| Confirm | Status is Draft |
| Raise invoice | Some dispatched weight is not yet invoiced |
| Record return | Some dispatched weight is not already on a return |
| Dispatch | Status is Confirmed or Dispatched |
| Cancel order | Status is Confirmed |
| Edit | Always |
| Delete | Always (refused by the server when other records depend on the order) |

### Dispatches

Columns: #, Order, Vehicle, Driver, Weight, Status, Challan (`DC-00001`), Date.

Filters: **Dispatch status**, period.

| Row action | Shown when |
|---|---|
| Mark delivered | Status is not Delivered |
| Print challan | Always (also at View only) |
| Edit, Delete | Always |

### Invoices

Columns: Number, Order, Weight, Total, Still due, Date, Due, Status.

Filters: **Invoice status**, period.

Row actions: **Print invoice** (also at View only), **Delete**. There is no edit form on the screen.

### Payments

Columns: #, Order, Amount, Method, Reference, Received by, Date.

Filters: **Payment method**, period.

Row actions: **Edit**, **Delete**.

### Returns

Columns: Number, Order, Weight, Reason, Goods ("Back into stock" or "Written off"), Credit, Date, Status.

Filters: **Return status**, period.

| Row action | Shown when |
|---|---|
| Approve | Status is Requested, for users with the duty *Approve sales returns* |
| Reject | Status is Requested, for users with the same duty |
| Edit | Status is Requested |
| Delete | Status is not Approved |

### Customers

A yellow box **Possible duplicates** lists up to five pairs of customers whose names look alike, when there are any.

Columns: Name, Contact, Category, Orders, Owes (with a red **Over limit** badge), Since.

| Row action | What it does |
|---|---|
| Statement | Opens a side sheet with the customer's figures and every order, payment and return credit, oldest first, with a running balance |
| Merge into… | Moves this customer's orders and quotations to another customer and removes this one. Shown to Admins only |
| Edit, Delete | |

### Products

Columns: Product, Material, Grade, List price/kg, Category prices, Status (On sale / Not on sale).

Row actions: **Edit**, **Delete**.

### Performance

A report for a period (default: This year) over orders that are Confirmed, Dispatched or Completed.

- Cards: **Sales** (value and number of orders), **Weight sold** (and average price per kg), **Quotations won** (%), **Returned** (kg and credit).
- Chart: **Sales by month**.
- Tables: **By customer** and **By material**, each with Orders, Weight and Sales, and an Export button.

### Printed documents

**Print invoice** and **Print challan** open a new browser window with the document and the print dialog. The heading on both is "Textile Recycling ERP". If the browser blocks the window, the page says: "The browser blocked the print window. Allow pop-ups for this site and try again."

## Records and fields

### Customer

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | | Yes | Unique, ignoring case and extra spaces |
| Contact | Phone or contact person | No | |
| Email | | No | Must be a valid address |
| Category | Wholesaler, Manufacturer, Exporter, Retailer or Other | No | Decides which product price applies |
| Status | Active or Not active | Yes | Inactive customers are not offered in the quotation form |
| Credit limit (Rs.) | | No | Empty or 0 means no limit. Going over it warns; it never blocks |
| Payment terms, days | Days an invoice may stay unpaid | No | Sets the due date on invoices. Default 0 |
| Address, Notes | | No | |

Worked out: number of orders, **balance** (what the customer owes) and **over limit**.

### Product

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | | Yes | Unique |
| Material, Grade | | No | The grade is copied into an order's Quality when the product is chosen |
| List price per kg (Rs.) | | Yes | Greater than zero |
| Status | On sale or Not on sale | Yes | Products not on sale are not offered in forms |
| Specification | | No | |
| Prices by customer category | A price per category | No | One price per category; each greater than zero |

A product is optional on orders and quotations. Choosing one fills in the quality and the price for the customer's category (or the list price when the category has no price of its own). The price can still be typed over.

### Quotation

Number format: `QT-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Customer | | Yes | |
| Product | | No | |
| Fabric lot | The lot to sell from | No | Needed when the order is made |
| Quality | | Yes | |
| Weight (kg) | | Yes | Greater than zero |
| Price per kg (Rs.) | | Yes | Greater than zero |
| Discount, % and Tax, % | | No | 0 to 100 |
| Valid until | | No | A Draft or Sent quotation past this date is shown as Expired |
| Notes | | No | |
| Total | | Worked out | Weight × price, less discount, plus tax on the rest |

### Sales order

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Buyer | Customer name, picked from the list or typed | Yes | A typed name is linked to the matching customer, or creates one |
| Buyer contact | | No | |
| Product | | No | |
| Fabric lot | The lot the goods come from | Yes | The list shows each lot's free dried stock |
| Quality | | Yes | |
| Weight (kg) | | Yes | Greater than zero |
| Price per kg (Rs.) | | Yes | Greater than zero |
| Discount, % | | No | 0 to 100 |
| Tax, % | | No | 0 to 100; charged after the discount |
| Order status | See [Statuses](#statuses) | Yes | Defaults to Draft. Can be set by hand |
| Payment status | Pending, Partial or Paid | Yes | Defaults to Pending. Recalculated whenever a payment is added |
| Created by | | Set by the system | Always the logged-in user |
| Notes | | No | |

The model also holds a buyer address (`buyer_address`), filled from the customer when an order is made from a quotation. The order form has no field for it.

Worked out: total price, invoiced weight, returned weight, credited amount.

### Dispatch

Challan number: `DC-` plus the dispatch's id padded to five digits.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Order | | Yes | Only Confirmed or Dispatched orders are offered |
| Vehicle number | | Yes | |
| Weight (kg) | | Yes | Greater than zero; not more than what is left on the order |
| Driver name, Driver contact | | No | |
| Status | Pending, Loading, Dispatched or Delivered | Yes | Defaults to Pending |
| Dispatched by | | No | Leave empty to record yourself |
| Notes | | No | |
| Dispatch date | | Set by the system | The moment the dispatch is saved |
| Delivery date | | Set by the system | Set by **Mark delivered** |

### Invoice

Number format: `INV-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Weight (kg) | Weight being billed | Yes | Filled with the dispatched weight not yet invoiced; cannot be more |
| Invoice date | | Yes | Defaults to today |
| Notes | | No | |
| Due date | | Set by the system | Invoice date plus the customer's payment terms |
| Price per kg, subtotal, discount, tax, total | | Set by the system | Copied and calculated from the order when the invoice is raised, then fixed |

### Payment

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Order | | Yes | Cancelled orders are not offered |
| Amount (Rs.) | | Yes | Greater than zero (checked by the form) |
| Method | Cash, Bank Transfer, Cheque or Online Transfer | Yes | Defaults to Cash |
| Reference number | Cheque or transaction number | No | |
| Received by | | No | Leave empty to record yourself |
| Notes | | No | |
| Payment date | | Set by the system | The moment the payment is saved |

### Return

Number format: `SR-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Order | | Yes | Only orders with dispatched weight are offered |
| Weight (kg) | | Yes | Greater than zero; not more than dispatched weight less other returns that are not rejected |
| Return date | | Yes | Defaults to today |
| What happens to the goods | "Written off (not sellable)" or "Back into sellable stock" | Yes | Defaults to written off |
| Reason | | Yes | |
| Credit amount | | Set by the system | Worked out on approval from the order's price, discount and tax |

## Statuses

### Quotation

| Status | How it gets there |
|---|---|
| Draft | Created |
| Sent | **Mark as sent** from Draft |
| Accepted | **Customer accepted** from Draft or Sent |
| Rejected | **Customer declined** from Draft or Sent |
| Converted | **Make order** from Accepted. A Draft order is created with the quoted terms |

"Expired" is a flag on Draft and Sent quotations past their valid-until date. It does not block anything.

### Sales order

| Status | Meaning | How it gets there |
|---|---|---|
| Draft | Holds no stock | Created |
| Confirmed | The weight is reserved | **Confirm**, or saved with Order status set to Confirmed |
| Dispatched | Still reserving what has not been shipped | Only by choosing it in the order form. Recording a dispatch does not change the order's status |
| Completed | Delivered | **Mark delivered** on any of the order's dispatches |
| Cancelled | Reservation released | **Cancel order** |

### Payment status (on an order)

| Status | Meaning |
|---|---|
| Pending | Nothing paid |
| Partial | Something paid, less than what is due |
| Paid | Payments reach the order total less credits for approved returns |

### Dispatch

Pending, Loading, Dispatched, Delivered. The first three are chosen in the form and have no rules attached. **Mark delivered** sets Delivered, stamps the delivery date and completes the order.

### Invoice

The status is worked out each time it is shown; it is not stored.

| Status | Meaning |
|---|---|
| Unpaid | Nothing has reached this invoice, and it is not past due |
| Partial | Part paid, and not past due |
| Paid | Fully covered |
| Overdue | Not fully covered and the due date has passed |

An order's payments and approved return credits are applied to its invoices oldest first.

### Return

| Status | How it gets there |
|---|---|
| Requested | Created. Nothing has moved yet |
| Approved | **Approve**. The customer is credited; the weight is restocked if chosen |
| Rejected | **Reject**. Its weight is free to be returned again |

## How to

### Sell from stock

1. Open **Sales**, the **Orders** tab, and press **New order**.
2. Type or pick the **Buyer**.
3. Optionally choose a **Product** to fill in the quality and price.
4. Choose the **Fabric lot**. The hint shows how much dried stock is free.
5. Fill in **Quality**, **Weight (kg)** and **Price per kg (Rs.)**, and a discount or tax if any. The form shows the total.
6. Press **Save**. The order is a Draft.
7. In the row's menu choose **Confirm**. The page says "Order confirmed; stock reserved." If the customer is now over their credit limit, a warning appears for ten seconds; the order is confirmed anyway.

### Dispatch an order

1. On the **Orders** tab choose **Dispatch** in the row's menu.
2. The form shows how much is left to dispatch. Type the **Vehicle number** and the **Weight (kg)**.
3. Press **Save**. The weight leaves stock. An order can go out in several dispatches.
4. To print the delivery challan, open the **Dispatches** tab and choose **Print challan**.
5. When the goods arrive, choose **Mark delivered**. The order becomes Completed.

### Raise an invoice

1. On the **Orders** tab choose **Raise invoice**. It appears when dispatched weight is waiting to be invoiced.
2. Check the **Weight (kg)** and the **Invoice date**.
3. Press **Raise invoice**.
4. On the **Invoices** tab choose **Print invoice**.

### Record a payment

1. Open the **Payments** tab and press **Record payment**.
2. Choose the **Order**. The hint shows what has been received so far.
3. Type the **Amount (Rs.)**, choose the **Method** and press **Save**.

The order's payment status updates by itself.

### Record and approve a return

1. On the **Orders** tab choose **Record return** (or press **Record return** on the Returns tab).
2. Type the **Weight (kg)**, choose **What happens to the goods** and give the **Reason**. Press **Save**.
3. A user with the duty *Approve sales returns* opens the **Returns** tab (or the Approvals page) and chooses **Approve** or **Reject**.

Nothing changes until the return is approved.

### Make a quotation and turn it into an order

1. Open the **Quotations** tab and press **New quotation**.
2. Choose the **Customer**, fill in quality, weight and price, and press **Save**.
3. Choose **Mark as sent** when you have sent it.
4. When the customer answers, choose **Customer accepted** or **Customer declined**.
5. On an accepted quotation choose **Make order**, pick the **Fabric lot** and press **Create order**. A Draft order is created.

### Set up a price list

1. Open the **Products** tab and press **New product**.
2. Fill in the name and the **List price per kg (Rs.)**.
3. Under **Prices by customer category**, press **Add category price** for each category that pays a different price.
4. On the **Customers** tab, set each customer's **Category**.

### See what a customer owes

1. Open the **Customers** tab. The **Owes** column shows each balance.
2. Choose **Statement** in a row's menu for the full list with a running balance, the overdue amount and the credit limit.

### Merge duplicate customers

1. On the **Customers** tab, look at **Possible duplicates**.
2. On the customer to remove, choose **Merge into…** (Admins only).
3. Choose the customer to keep and press **Merge**.

The orders and quotations move to the customer you keep. The buyer names typed on the orders stay as they were.

## Business rules

### Customers

| Rule | Message |
|---|---|
| Customer names are unique, ignoring case and extra spaces | "A customer with this name already exists." |
| The credit limit cannot be negative | "Can't be negative." |
| An order needs a buyer name or a customer | "Enter a buyer name or choose a customer." |
| A typed buyer name finds the customer with the same name (ignoring case and spaces) or creates one. The name on the order is kept as typed | |
| Merging needs a target | "Choose the customer to merge into." |
| A customer cannot be merged into itself | "Cannot merge a customer into itself." |
| Merging is for Admins only | |
| A customer with orders or quotations cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| Possible duplicates are names at least 85% alike. Names that differ only in their numbers ("Store #1" and "Store #2") are not reported | |

### Orders

| Rule | Message |
|---|---|
| Weight must be positive | "Weight sold must be greater than zero." |
| Price must be positive | "Price per kg must be greater than zero." |
| Discount and tax are percentages | "Must be between 0 and 100." |
| Total = weight × price. With a discount or tax: less the discount, plus tax on the rest, rounded to two decimals | |
| Draft orders are not checked against stock | |
| A Confirmed or Dispatched order must be covered by free dried stock. Checked on **Confirm**, and when such an order is created or its lot or weight changes | "Only 300.00 kg of dried stock is available for this fabric (400.00 kg needed). Save the order as Draft until stock is ready." |
| A lot in quarantine cannot be sold | "This fabric lot is in quarantine after failing inspection QC-00007 and can't be sold until an admin releases it." |
| Going over the credit limit warns and never blocks | "Ali Traders now owes Rs. 10,000, which is over their credit limit of Rs. 6,000." |
| **Cancel order** sets the status to Cancelled, which releases the reservation. The server does not check the order's current status | |
| An order with dispatches, payments, invoices or returns cannot be deleted | "This record cannot be deleted because other records depend on it: …" |

### Dispatches

| Rule | Message |
|---|---|
| The order must be Confirmed or Dispatched | "Confirm the order before dispatching it." |
| The weight must be positive | "Must be greater than zero." |
| Dispatches cannot exceed the order's weight | "Only 30.00 kg of this order is left to dispatch." |
| The stock must be on hand | "Only 0.00 kg of dried stock is on hand for this order." |
| The lot must not be in quarantine | The quarantine message above |
| Saving a dispatch takes its weight out of stock. Editing adjusts stock by the difference. Deleting puts the weight back | |
| **Mark delivered** sets the dispatch to Delivered and the order to Completed, even when part of the order has not been dispatched | |

### Invoices

| Rule | Message |
|---|---|
| Only dispatched weight can be invoiced | "Nothing is left to invoice: dispatch goods first." |
| The weight must be positive | "Must be greater than zero." |
| An order cannot be invoiced for more than it has dispatched | "Only 60.00 kg has been dispatched and not yet invoiced." |
| The amounts are fixed when the invoice is raised: subtotal = weight × price; discount = subtotal × discount %; tax = (subtotal − discount) × tax % | |
| Due date = invoice date + the customer's payment terms | |
| The due date cannot be before the invoice date (when changed through the API) | "Can't be before the invoice date." |
| Invoices are never created directly; only from an order | |

### Payments

| Rule | Message |
|---|---|
| Adding a payment recalculates the order's payment status against the order total less approved return credits | |
| The server does not stop a payment that is larger than what is owed | |
| Changing or deleting a payment also recalculates the payment status, but against the full order total: return credits are not taken off in that case. They are taken off again the next time a payment is added or a return is approved | |

### Returns

| Rule | Message |
|---|---|
| The weight must be positive | "Must be greater than zero." |
| Returns cannot exceed dispatched weight. A Requested return already holds its weight | "Only 10.00 kg of this order has been dispatched and not already returned." |
| Only a Requested return can be changed | "This return is already approved and can't be changed." |
| Approving or rejecting needs the duty *Approve sales returns* | "Your role is not allowed to approve or reject a return." |
| A return is decided once | "This return is already approved." |
| On approval the credit = the returned weight at the order's price, discount and tax. The order's payment status is recalculated | |
| A return marked "Back into sellable stock" adds its weight to the lot's stock on approval. "Written off" leaves stock alone | |
| An approved return cannot be deleted | "An approved return has credited the customer and can't be deleted." |

### Quotations

| Rule | Message |
|---|---|
| Weight and price must be positive | "Must be greater than zero." |
| Discount and tax are percentages | "Must be between 0 and 100." |
| Only Draft or Sent quotations can be changed | "A quotation that is accepted can't be changed." |
| Only a Draft can be marked as sent | "A quotation that is sent can't be sent." |
| Only Draft or Sent can be accepted or rejected | "A quotation that is rejected can't be accepted." |
| Only an Accepted quotation becomes an order | "The customer has to accept the quotation before it becomes an order." |
| The order needs a fabric lot | "Choose the fabric lot to sell from." |
| A Converted quotation cannot be deleted | "This quotation became an order and can't be deleted." |

### Products

| Rule | Message |
|---|---|
| Prices must be positive | "Must be greater than zero." |
| One price per customer category | "Each customer category can have one price." |
| Saving a product's category prices replaces the whole list | |

### How the figures are worked out

- **What a customer owes** = orders that are Confirmed, Dispatched or Completed − payments − credits for approved returns. Draft and Cancelled orders are not owed.
- **Over limit** = the customer has a credit limit and owes more than it.
- **Statement → Overdue** = what is still unpaid on the customer's Overdue invoices.
- **Dashboard cards**: Total revenue adds up every order, whatever its status. Outstanding = Total revenue − all payments (never below zero).
- **Performance**: orders that are Confirmed, Dispatched or Completed and created in the period. "By material" groups by the lot's material type. **Quotations won** = (Accepted + Converted) ÷ (Accepted + Rejected + Converted). **Returned** counts approved returns dated in the period.

## Related data

| Module | What happens |
|---|---|
| [Inventory](inventory.md) | Holds the dried-stock ledger. Confirming checks free stock; dispatches and restocked returns post movements |
| [Sorting](sorting.md) | Orders are made against a fabric lot. The lot list shows each lot's free dried stock |
| [Drying](drying.md) | Completed drying sessions are what make stock sellable |
| [Quality](quality.md) | A lot in quarantine cannot be confirmed or dispatched |
| [Finance](finance.md) | Sales invoices, customer payments and approved returns are posted to the journal when the books are updated. Customer balances feed "Customers owe us" |
| [Approvals and notifications](approvals-and-notifications.md) | Requested returns appear in the Approvals inbox. Notification rules read overdue invoices, customers over their credit limit, returns waiting, oversold lots and large stock adjustments |
| [Search and traceability](search-and-traceability.md) | The trace of a lot shows its sales orders, dispatches, invoices and returns |
| [Dashboard and reports](dashboard-and-reports.md) | Sales figures appear on the dashboard and in the sales reports |

**For administrators:** if a management e-mail address is configured, the system sends an e-mail when an order becomes Completed, when a payment is recorded, and when a dispatch's status becomes Dispatched. See [Approvals and notifications](approvals-and-notifications.md).

## For developers

**Backend:** `backend/apps/sales`.

| File | Contents |
|---|---|
| `models.py` | `Customer` (with `normalized_name`), `Product`, `ProductPrice`, `SalesOrder`, `DispatchTracking`, `Payment`, `SalesQuotation`, `SalesInvoice`, `SalesReturn`; `order_total()` |
| `services.py` | `amounts`, `refresh_payment_status`, `customer_balances`, `credit_warning`, quotation transitions, `create_invoice`, `invoice_states`, `check_return`, `approve_return`, `reject_return` |
| `serializers.py` | Validation; calls `inventory.check_order_reservation` and `inventory.check_dispatch` |
| `views.py` | View sets, `customer_statement`, `find_similar_customers`, `SalesPerformanceView` |
| `management/commands/customer_duplicates.py` | `python manage.py customer_duplicates [--threshold 0.85]` lists look-alike customer names |
| `tests.py` | Rules above, as tests |

`SalesOrder.save()` always recalculates `total_price` and links a customer from the buyer name.

**Endpoints** (all under `/api/v1/sales/`). Reading needs the Sales page or the Dashboard page (the dashboard shows sales figures); changing needs the Sales page at Full.

| Method and path | Purpose |
|---|---|
| `GET, POST /customers/`, `/customers/{id}/` | Customers (filter `search`) |
| `GET /customers/{id}/statement/` | Statement with a running balance |
| `GET /customers/duplicates/` | Pairs of look-alike names |
| `POST /customers/{id}/merge/` | Body `{"into": <id>}`. Admin only |
| `GET, POST /orders/`, `/orders/{id}/` | Orders (filters `status`, `payment_status`, `buyer`, date parameters on `created_at`) |
| `POST /orders/{id}/confirm/` | Reserve stock; returns `credit_warning` |
| `POST /orders/{id}/cancel/` | Cancel |
| `POST /orders/{id}/invoice/` | Raise an invoice; body may hold `weight`, `invoice_date`, `notes` |
| `GET /orders/summary/` | Dashboard figures |
| `GET, POST /dispatch/`, `/dispatch/{id}/` | Dispatches (filter `status`, date parameters on `dispatch_date`) |
| `POST /dispatch/{id}/mark_delivered/` | Deliver and complete the order |
| `GET, POST /payments/`, `/payments/{id}/` | Payments (date parameters on `payment_date`) |
| `GET, POST /products/`, `/products/{id}/` | Products with nested `prices` |
| `GET, POST /quotations/`, `/quotations/{id}/` | Quotations (date parameters on `created_at`) |
| `POST /quotations/{id}/send/`, `/accept/`, `/reject/`, `/convert/` | Transitions. `reject` takes `reason`; `convert` takes `fabric` |
| `GET, PATCH, DELETE /invoices/`, `/invoices/{id}/` | Invoices (filter `order`, date parameters on `invoice_date`). No `POST` |
| `GET, POST /returns/`, `/returns/{id}/` | Returns (date parameters on `return_date`) |
| `POST /returns/{id}/approve/`, `/reject/` | Decide (duty). `reject` takes `reason` |
| `GET /performance/` | Performance report (date parameters) |

**Frontend:** `frontend/src/features/sales/` (`sales-page.tsx`, `sales-forms.tsx`, `sales-extras.tsx`, `sales-dashboard.tsx`, `schemas.ts`). Route: `frontend/src/app/(app)/sales/page.tsx`. Types: `frontend/src/types/api.ts`.

**Tests:** `backend/apps/sales/tests.py`; stock rules are tested in `backend/apps/inventory/tests.py`.

**Browser scenario:** `frontend/e2e/sales.mjs`. Draft order → confirm (stock reserved) → oversell refused → partial dispatch → over-dispatch refused → payment → mark delivered → invoice → return with restock → quotation to order → statement → performance → merge customers.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "Only … kg of dried stock is available for this fabric" | The lot does not have enough free dried stock | Save the order as Draft, or choose another lot, or wait for drying to complete |
| "Confirm the order before dispatching it." | The order is Draft, Completed or Cancelled | Confirm it. For a Completed order with weight still to ship, set **Order status** back to Confirmed in the order form first |
| An order is Completed although only part was dispatched | **Mark delivered** on any dispatch completes the order | Edit the order and set its status back to Confirmed to dispatch the rest |
| An order never shows "Dispatched" | Recording a dispatch does not change the order's status | Set it in the order form if you want to use that status |
| An order with an approved return went from Paid back to Partial after a payment was edited or deleted | That recalculation compares payments with the full order total and ignores return credits (`apps/notifications/tasks.py`, `auto_update_order_payment_status`) | Edit the order and set **Payment status** by hand; it is also corrected the next time a payment is added |
| A return has no **Approve** or **Reject** in its menu | The user's role lacks the duty *Approve sales returns* | Give the role the duty under Users → Access, or have an Admin approve |
| No **Merge into…** in a customer's menu | Merging is Admin only, and the action is shown to Admins only | Ask an Admin |
| The dashboard's Total revenue is higher than the Performance tab's Sales | The dashboard counts every order, including Draft and Cancelled | Use the Performance tab for sales figures |
| Print does nothing | The browser blocked the pop-up | Allow pop-ups for the site |
| An order cannot be deleted | It has dispatches, payments, invoices or returns | Cancel it instead |

## Keeping this page up to date

- `backend/apps/sales/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, rules, messages and endpoints.
- `backend/apps/inventory/services.py`: the stock rules and their messages (`check_order_reservation`, `check_dispatch`).
- `frontend/src/features/sales/*`: tabs, columns, row actions, form labels, printed documents.
- `backend/apps/access/services.py`: the duties `approve_sales_returns` and `adjust_stock`.
- `frontend/e2e/sales.mjs`: the browser scenario.
