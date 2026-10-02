# Workflows

This page describes the complete workflows of the system, step by step: who does each step, the status after it, and what the system checks. It ends with a table of every approval. It is for supervisors and administrators who need to know how work moves from one person to the next, and for developers who need the rules in one place.

## On this page

- [How to read this page](#how-to-read-this-page)
- [1. Purchase request to supplier payment](#1-purchase-request-to-supplier-payment)
- [2. Receiving a delivery](#2-receiving-a-delivery)
- [3. Incoming inspection, quarantine and release](#3-incoming-inspection-quarantine-and-release)
- [4. Sorting](#4-sorting)
- [5. Decolorization with chemicals and recipes](#5-decolorization-with-chemicals-and-recipes)
- [6. Drying, and how stock becomes sellable](#6-drying-and-how-stock-becomes-sellable)
- [7. A production order from plan to completion](#7-a-production-order-from-plan-to-completion)
- [8. Quotation to order to dispatch to invoice to payment](#8-quotation-to-order-to-dispatch-to-invoice-to-payment)
- [9. A customer return](#9-a-customer-return)
- [10. A machine breakdown and a preventive job](#10-a-machine-breakdown-and-a-preventive-job)
- [11. Attendance and leave](#11-attendance-and-leave)
- [12. Recording waste and utilities](#12-recording-waste-and-utilities)
- [13. Uploading a document and a new version](#13-uploading-a-document-and-a-new-version)
- [14. Month-end in finance](#14-month-end-in-finance)
- [15. Tracing a lot](#15-tracing-a-lot)
- [Approvals at a glance](#approvals-at-a-glance)
- [For developers](#for-developers)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## How to read this page

- **Who** names the access a step needs, not a person's job title:
  - "the *X* page at Full" means any user who holds that page at the level Full;
  - "the duty *X* (Admin by default)" means a role that carries that duty. At the start only the Admin does;
  - "Admin only" means the check is on the Admin role itself.

  How pages, levels and duties are given is explained in [Access control](05-access-control.md). The starting access of each role is in [Roles and responsibilities](04-roles-and-responsibilities.md).
- **Status** is the status of the record after the step, written exactly as the screen shows it.
- Messages in quotation marks are the exact words the system uses. Where a message contains a number or a name, it is shown as *N*, *X* or a sample value.
- **A note on the screens.** A button that needs a duty is shown only to users whose role carries that duty. The server checks the duty again when the action is sent. The Approvals page shows its buttons to everyone who can open it; an action the user's role may not take is refused there with a message. A duty only works together with the duty's page at Full.
- Every step that changes a record is written to the audit log. See [Audit and logging](14-audit-and-logging.md).

## 1. Purchase request to supplier payment

Page: **Purchasing**. Module guide: [Purchasing](07-modules/purchasing.md).

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Purchasing page at Full | **Requests** tab → **New request**. Fill in "For unit", "Needed by", at least one material with its quantity in kg, and notes. | Request: **Draft**. It gets a number, for example `PR-00012`. | "Add at least one material." Each quantity must be greater than zero. |
| 2 | Purchasing page at Full | Row menu ⋯ → **Submit for approval**. | Request: **Submitted**. It appears on the Approvals page. | Only a Draft or Rejected request can be submitted. "Add at least one material before submitting." |
| 3 | The duty *Approve purchases* (Admin by default) | **Approve**, or **Reject** with a reason. | **Approved** or **Rejected**. The approver and time are kept. | Only a Submitted request can be decided. A rejection needs a reason: "Say why the request is rejected." |
| 4 | Purchasing page at Full | On the approved request: ⋯ → **Create order**. Or **Orders** tab → **New order** and choose the request under "From request". Fill in Supplier, Order date, Expected delivery, and lines (material, quantity, price per kg). | Order: **Draft**, for example `PO-00042`. | "Only an approved request can be turned into an order." "Add at least one line." "Expected date can't be before the order date." |
| 5 | Purchasing page at Full | ⋯ → **Submit for approval**. | Order: **Submitted**. | Only a Draft order can be submitted. "Add at least one line before submitting." |
| 6 | The duty *Approve purchases* (Admin by default) | **Approve**. | Order: **Approved**. The request it came from becomes **Ordered**. | Only a Submitted order can be approved. |
| 7 | Warehouse page at Full | Record each delivery on the Warehouse page and choose the order line under "Purchase order". See [workflow 2](#2-receiving-a-delivery). | Order: **Partially Received** once any accepted weight has arrived; **Received** once every line has received at least its ordered weight. | The order must be Approved or Partially Received, and from the same supplier as the delivery. Deliveries with the status Rejected do not count. |
| 8 | Purchasing page at Full | On the order: ⋯ → **Record invoice**. Or **Invoices** tab → **Record invoice**. Fill in Supplier, Purchase order (optional), Invoice no., Invoice date, Due date, Amount before tax and Tax. | Invoice: **Unpaid**. | "This supplier already has an invoice with this number." The order must be from the same supplier. "Due date can't be before the invoice date." The amount must be greater than zero. |
| 9 | The duty *Record supplier payments* (Admin by default) | **Invoices** tab → ⋯ → **Record payment**. Fill in Amount, Payment date, Method and Reference. | Invoice: **Partial**, then **Paid** when the payments reach the total (amount plus tax). | "Only Rs. *N* is outstanding on this invoice." The amount must be greater than zero. |
| 10 | The duty *Approve purchases* (Admin by default) | Optional: ⋯ → **Close order** when no more deliveries are expected. | Order: **Closed**. No more deliveries can be booked against it. | Only an Approved, Partially Received or Received order can be closed. |
| 11 | Finance page at Full | **Finance** → **Update books** (or open any statement). | The supplier invoice and each payment have a journal entry. | Entries dated in a closed period are left out. See [workflow 14](#14-month-end-in-finance). |

### Side paths

| Situation | What happens |
|---|---|
| A rejected request is edited. | It goes back to **Draft** and can be submitted again. |
| A request is no longer needed. | ⋯ → **Cancel request** → **Cancelled**. Not possible once it is Ordered or already Cancelled. |
| An Approved or Partially Received order is edited (supplier, dates or lines). | This is an **amendment**: the revision number goes up by one ("Rev 1"), the status goes back to **Submitted**, and it needs approval again. Changing only the notes is not an amendment. After the new approval, an order that already has deliveries goes straight back to Partially Received or Received. |
| A line is reduced below what has arrived. | Refused: "*material*: *N* kg has already been received; the quantity can't be lower." |
| A line with deliveries is removed. | Refused: "*material* has deliveries and can't be removed." |
| The supplier of an order with deliveries is changed. | Refused: "Goods have been received; the supplier can't change." |
| An order is cancelled. | ⋯ → **Cancel order** → **Cancelled**. Only for Draft, Submitted or Approved orders without deliveries. Otherwise: "Goods have been received against this order; close it instead." |
| Material is sent back to the supplier. | **Returns** tab → **Record return**: Delivery, Quantity, Return date, Reason. It gets a number (`RET-…`). It is a record only: the delivery and stock do not change. "Only *N* kg of this delivery can still be returned." |
| A Received or Closed order is edited. | Refused: "A received order can no longer be changed." |

### What can be deleted

| Record | Rule |
|---|---|
| Request | Only Draft, Rejected or Cancelled: "Only draft, rejected or cancelled requests can be deleted." |
| Order | Only Draft, Submitted or Cancelled: "Approved orders can't be deleted; cancel or close them instead." |
| Invoice | The Delete action is offered only while nothing has been paid. |
| Payment | Needs the duty *Record supplier payments*. The invoice's status is worked out again. |

## 2. Receiving a delivery

Page: **Warehouse**. Module guide: [Warehouse](07-modules/warehouse.md).

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Warehouse page at Full | **Stock entries** tab → **Add stock**. Fill in Vendor, Fabric type, Vendor weight slip, Vehicle no., Our weight, Unloading weight, Factory unit and Status. | Delivery saved. The status is the one chosen in the form: **Received**, **Pending**, **Approved** or **Rejected**. | "Weight must be greater than zero." (our weight). Every field except the purchase order is required. |
| 2 | Warehouse page at Full | Optional, in the same form: choose a line under **Purchase order**. The list shows open lines of approved orders from the chosen supplier. | The order's status is worked out again at once. | "*PO-00042* is *draft*; goods can only be received against an approved order." "*PO-00042* is from *Supplier A*, not *Supplier B*." |
| 3 | Warehouse page at Full | Later: ⋯ → **Edit** and change the **Status**, for example from Pending to Approved or Rejected. | The chosen status. | None. There is no separate approve action for deliveries; the status is a field. |
| 4 | — | The delivery is now available to Quality (incoming inspection) and to Sorting (to make a fabric lot). | — | — |

What the delivery status changes:

| Status | Effect |
|---|---|
| Received, Pending, Approved | The weight counts towards the purchase order line and towards "Material in" in the Sustainability figures. The "Pending approval" figure on the Warehouse page and Dashboard counts deliveries with the status Pending. |
| Rejected | The weight does **not** count towards the purchase order, and is left out of "Material in". In supplier performance it counts as rejected weight. |

The status does not stop a fabric lot from being made from the delivery. Only quarantine does that. See the next workflow.

Deleting a delivery is refused when a fabric lot, an inspection or a return to supplier depends on it: "This record cannot be deleted because other records depend on it: …".

## 3. Incoming inspection, quarantine and release

Page: **Quality**. Module guide: [Quality](07-modules/quality.md).

Inspections exist for three stages. This workflow follows an incoming inspection of a delivery. In-process and finished inspections work the same way, but point to a fabric lot.

| Stage | Inspects | Needs the duty | Starts with |
|---|---|---|---|
| Incoming material | A delivery | *Inspect incoming material* | Warehouse Supervisor, Admin |
| In-process | A fabric lot | *Inspect in-process material* | Sorting, Decolorization and Drying Supervisors, Admin |
| Finished product | A fabric lot | *Inspect finished goods* | Drying Supervisor, Admin |

### Record the inspection

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | The duty for the stage | **Quality** → **Record inspection**. Choose the Stage, the date, and the Delivery (or the Fabric lot for the other stages). | — | "Your role can't record incoming inspections." (or in-process / finished). "Choose the delivery that was inspected." / "Choose the fabric lot that was inspected." |
| 2 | Same person | Optional: choose a **Standard**. It fills in the checklist with its limits. Enter each measured value, or mark each check as passed or failed. | — | "This standard is for *in-process* inspections." "Enter the measured value." "Mark the check as passed or failed." A measurement is judged against its minimum and maximum by the system. |
| 3 | Same person | Choose the **Result** and save. | Inspection saved with a number, for example `QC-00007`, and the result **Pass**, **Conditional** or **Fail**. | "A check failed, so the result can't be Pass. Choose Conditional or Fail." For Fail: "Say why the material failed." For Conditional: "Write the condition under which the material is accepted." |

### What each result means

| Result | Effect |
|---|---|
| Pass | Nothing is held. |
| Conditional | The material is accepted under the written condition. Nothing is held. |
| Fail | The delivery or lot is **in quarantine** until it is released. It shows the badge "Quarantined". |

A delivery or lot that was never inspected is not held.

### What quarantine blocks

A lot is in quarantine when it has a failed, unreleased inspection of its own, **or** when the delivery it came from has one.

| Action | Message |
|---|---|
| Making a fabric lot from a quarantined delivery | "This delivery is in quarantine after failing inspection *QC-00007* and can't be sent to sorting until an admin releases it." |
| Starting a sorting session on the lot | "This fabric lot is in quarantine after failing inspection *QC-00007* and can't be sorted until an admin releases it." |
| Starting a decolorization session | "… can't be decolorized until an admin releases it." |
| Adding a drying session | "… can't be dried until an admin releases it." |
| Releasing a production order, or starting one of its stages | "… can't be processed until an admin releases it." |
| Confirming a sales order, or dispatching | "… can't be sold until an admin releases it." |

The check is made when a session is created (or moved to another lot), when a production order is released or a stage is started, and when a sales order is confirmed or dispatched. A session that was already running when the inspection failed can still be completed.

### Follow up and release

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 4 | The duty for the inspection's stage | Optional: on the inspection, ⋯ → **Add action**. Choose Corrective or Preventive, describe what has to be done, and set who is responsible and a due date. Later: **Mark as done** (or **Reopen**). | Action: **Open**, then **Done**. | "This action is already done." An open action past its due date appears in the bell. |
| 5 | The duty *Release quarantine* (Admin by default) | When the problem is solved: Quality dashboard → "In quarantine" → **Release**; or Inspections tab → ⋯ → **Release from quarantine**; or Approvals → **Quarantine** → **Release**. Give the reason. | The inspection keeps the result Fail and gains the badge **Released**. The material can be used again. | "Only material in quarantine can be released." "Say why the material is released (e.g. re-tested, returned to supplier)." "Your role is not allowed to release material from quarantine." |
| 6 | — | After release the inspection is final. | — | "A released inspection can't be changed." |

Two other things end a quarantine:

- A user with the duty *Release quarantine* edits the failed inspection and changes its result. Others get: "Only someone who may release quarantine can change a failed inspection."
- An Admin deletes the inspection. The question on screen warns: "If it holds material in quarantine, that material is freed." Only an Admin can delete quality records.

## 4. Sorting

Page: **Sorting**. Module guide: [Sorting](07-modules/sorting.md).

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Sorting page at Full | **Fabric lots** tab → **Add fabric lot**. Choose the Warehouse delivery, type the Material type and the Initial quantity. | Lot: **In Warehouse** (the default in the form). Remaining = initial quantity. | The delivery must not be in quarantine. "Initial quantity must be greater than zero." |
| 2 | Sorting page at Full | **Start session**. Choose the Fabric lot, Supervisor and Unit, and type the Quantity taken. | Session: **In Progress**. | "Quantity taken must be greater than zero." The lot must not be in quarantine. |
| 3 | Sorting page at Full | On the session: ⋯ → **Complete**. Type the Quantity sorted and the Waste. Press **Mark complete**. | Session: **Completed**, with an end time. | "Output (*x* kg) plus waste (*y* kg) is more than the input (*z* kg)." "Only *N* kg of this fabric is left unsorted." "Session already completed." |
| 4 | — | The system updates the lot: Sorted goes up by the sorted weight; Remaining goes down by sorted plus waste. | Lot: **Sorted** once nothing remains. Otherwise unchanged. | — |

Things to know:

- **Several lots can be made from one delivery**, for example one per material. The system does not compare a lot's weight with the delivery's weight.
- The quantity taken is not checked against the lot when the session starts. The check comes at completion.
- Editing a lot's initial quantity moves its remaining quantity by the same amount. It is refused when it would go below zero: "More than this has already been sorted."
- The lot statuses are **In Warehouse**, **In Sorting**, **Sorted** and **Sent to Decolorization**. The system sets Sorted and Sent to Decolorization by itself. In Sorting is only set by hand in the lot form.
- The session status **On Hold** exists and can be filtered, but the session form has no field to set it.

## 5. Decolorization with chemicals and recipes

Page: **Decolorization**. Module guide: [Decolorization](07-modules/decolorization.md).

### Before the first batch

| What | Where | Rules |
|---|---|---|
| Tanks | **Tanks** tab → **Add tank** | The Batch ID must be unique. |
| Chemicals | **Chemicals** tab → **Add chemical** | "Total stock must be greater than zero." "Cost can't be negative." |
| Chemical lots (receiving stock) | **Lots** tab → **Receive lot** | Adds the quantity to the chemical's total and remaining stock. A cost given here becomes the chemical's current cost. A lot number can be used once per chemical. The expiry date "Can't be before the date it was received." |
| Recipes | **Recipes** tab → **New recipe** | "Add at least one chemical." "Each chemical can be listed once." |

### Run a batch

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Decolorization page at Full | **Start session**. Choose the Tank, Fabric lot and Supervisor, and type the Input quantity. Optional under "Process": Recipe, Temperature, Duration, Water. | Session (batch): **In Progress**. | The lot must not be in quarantine. Temperature and water "Can't be negative." |
| 2 | Decolorization page at Full | **Issuances** tab → **Issue chemical**. Choose the Chemical and the Tank, type the Quantity. "Issued by" is you unless you choose someone. | The chemical's remaining stock goes down. The issuance is tied to the batch running in that tank, if exactly one is In Progress there. The chemical's cost per unit at this moment is kept on the issuance. | "Not enough stock. Available: *N*" "Must be greater than zero." For a restricted chemical the user needs the duty *Issue restricted chemicals* (Admin by default): "*Caustic soda* is restricted: your role is not allowed to issue it." |
| 3 | Decolorization page at Full | On the session: ⋯ → **Complete**. Type the Output and the Waste. Press **Mark complete**. | Session: **Completed**. Tank: **Completed**. Lot: **Sent to Decolorization**. | "Output (*x* kg) plus waste (*y* kg) is more than the input (*z* kg)." "Session already completed." |
| 4 | Anyone who can open the page | ⋯ → **Chemicals used**. | — | Shows the recipe's planned quantities (per 100 kg × the input weight) against what was issued, with cost and cost per kg. |
| 5 | The duty *Approve decolorization batches* (Admin by default) | ⋯ → **Approve batch**, or Approvals → **Decolorization batches** → **Approve**. | The batch shows who approved it and when. | "This batch is already approved." "Your role is not allowed to approve a batch." |

Things to know:

- **Approval is a sign-off only.** Nothing is blocked while a batch is unapproved. The lot can go to drying at once.
- **Starting a session does not change the tank's status.** Completing sets it to Completed. Other tank statuses are set by editing the tank.
- **Editing or deleting an issuance puts the stock back.** The question on screen says: "… will be removed and its quantity returned to chemical stock."
- **Recipe versions.** Saving a recipe with changed chemicals or changed temperature, duration or water creates the next version (v2, v3 …). A batch keeps the version it was started with.
- **Chemical lots.** The chemical and quantity of a received lot cannot be edited: "This can't be changed after the lot is received. Delete the lot and enter it again." Deleting a lot takes its quantity out again, and is refused when that stock has been issued: "Only *N* *Liters* of this chemical is left, so part of this lot has already been issued. It can no longer be deleted."
- **Low stock.** A chemical below 25% of its total stock appears in the bell (rule "Low chemical stock"). An e-mail is sent to the management address the first time an issuance takes a chemical below 25%.
- The session statuses **Failed** and **On Hold** exist and can be filtered, but the session form has no field to set them.

## 6. Drying, and how stock becomes sellable

Page: **Drying**. Module guide: [Drying](07-modules/drying.md). Stock rules: [Inventory](07-modules/inventory.md).

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Drying page at Full | **Dryers** tab → **Add dryer** (once per dryer). | Dryer: **Available** (the default). | — |
| 2 | Drying page at Full | **Add session**. Choose the Dryer, the Fabric ("from decolorization"), the Supervisor, and type the Input quantity. Optional: the Decolorization session it came from, Temperature, Duration. | Session: **Pending** (the default in the form). | The lot must not be in quarantine. The Fabric list shows lots with the status Sent to Decolorization. The session list shows completed decolorization sessions not yet linked to a drying session. |
| 3 | Drying page at Full | ⋯ → **Start**. | Session: **In Progress**. Dryer: **Running**. | "Only Pending or On Hold sessions can be started." |
| 4 | Drying page at Full | ⋯ → **Complete**. Type the Dried output and the Waste. Press **Mark complete**. | Session: **Completed**. Dryer: **Cooling**. Lot status: **Sorted**. | "Output (*x* kg) plus waste (*y* kg) is more than the input (*z* kg)." "Session already completed." |
| 5 | — | The system adds a movement "Drying output" of the dried weight to the stock ledger for that lot. | The lot now has sellable stock. | — |
| 6 | Drying page at Full | When the dryer has cooled: **Dryers** tab → ⋯ → **Mark available**. To take a dryer out of use: **Send to maintenance**. | Dryer: **Available** or **Maintenance**. | — |

How sellable stock is worked out:

| Figure | Meaning |
|---|---|
| On hand | The sum of the lot's ledger movements: drying output, minus dispatches, plus restocked returns, plus or minus adjustments. |
| Reserved | For orders that are Confirmed or Dispatched: the ordered weight that has not been dispatched yet. |
| Available | On hand minus reserved. This is what the Sales order form shows as "*N* kg available". |

Things to know:

- **The ledger follows the session.** If a completed drying session is edited or deleted, the ledger is corrected by the difference. Deleting warns: "If it was completed, its output is taken back out of sellable stock."
- Nobody types stock in. A correction after a physical count is an **adjustment**, which needs the duty *Adjust stock* (Admin by default) and a reason. There is no screen for it. See [Inventory](07-modules/inventory.md).
- The weight lost to moisture (input minus output minus waste) is shown on the Drying dashboard as "Moisture lost". It is not waste.
- The system does not compare the input with the dryer's capacity or with the decolorization output.

## 7. A production order from plan to completion

Page: **Production**. Module guide: [Production](07-modules/production.md).

A production order plans the processing of one fabric lot and records planned against actual figures. **It moves no stock.** The sessions in workflows 4 to 6 still do the real work.

### Before the first order

Production → **Setup** tab: process stages, routings and bills of materials. A routing lists stages in order with planned hours and a cost per hour. A bill of materials lists what 100 kg of input needs. All three need the duty *Plan production* (Admin by default). The system starts with eight stages and the routing "Standard recycling".

### The order

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | The duty *Plan production* (Admin by default) | **New order**. Fill in Product, Fabric lot, Routing, Bill of materials (optional), Planned input, Planned output, Planned start, Planned end, Priority and Factory unit. | Order: **Draft**, for example `MO-00003`. Its stages are copied from the routing and its materials from the bill of materials (quantity per 100 kg × planned input ÷ 100). It appears on the Approvals page. | "Planned output can't be more than the input." "The end date can't be before the start date." "This routing is no longer in use." Planned input and output "Must be greater than zero." |
| 2 | The duty *Plan production* (Admin by default) | ⋯ → **Release**, or Approvals → **Production orders** → **Release**. | Order: **Released**. | "The routing has no stages. Add stages to it first." The lot must not be in quarantine. Only a Draft order can be released. |
| 3 | The duty *Run production stages* or *Plan production* | Open the order. On the next stage press **Start**. | Stage: **In Progress**. Order: **In Progress** (on the first start). The person who starts becomes the operator, unless one was planned. | "Finish or skip "*Sorting*" first." (stages run in order). The lot must not be in quarantine. "This step is already *done*." |
| 4 | Same | **Complete** the stage. Type Input, Output, Waste and, if you wish, Hours worked. | Stage: **Done**. | "Start the step before completing it." Input "Must be greater than zero." "Output plus waste (*x* kg) is more than the input (*y* kg)." If hours are left empty, they are counted from start to finish. |
| 5 | The duty *Plan production* (Admin by default) | Optional: **Skip** a stage that will not be done, or plan a stage (operator, machine, planned hours, cost per hour). | Stage: **Skipped**. | "This step is already *done*." "Only a production planner can change how a step is planned." |
| 6 | The duty *Run production stages* or *Plan production* | Under "Materials": **Record use** and type the quantity actually used. | — | Without the duty *Plan production*, only the actual quantity can be changed: "Only a production planner can change the planned materials." |
| 7 | The duty *Run production stages* or *Plan production* | When every stage is Done or Skipped: **Complete order**. | Order: **Completed**. The output of the last finished stage becomes the order's output. Yield and cost per kg are now shown. | ""*Drying*" is not finished yet." "No step was carried out; cancel the order instead." |

### Side paths

| Situation | What happens |
|---|---|
| A released order is edited. | Only the dates, priority, unit and notes can change: "The order is released: only its dates, priority and notes can still change." |
| An order is cancelled (duty *Plan production*). | ⋯ → **Cancel order** → **Cancelled**. Possible for Draft, Released and In Progress orders. A stage that was In Progress goes back to Pending. |
| A Completed or Cancelled order is edited. | Refused: "A completed order can no longer be changed." |
| An order is deleted. | "Only draft or cancelled orders can be deleted." |
| An order is past its planned end and not finished. | It is marked **Late** and appears in the bell (rule "Delayed production orders"). |

Figures on an order: cost = hours on finished stages × the stage's cost per hour, plus materials used × their unit cost. "Lot activity" on the order lists the lot's real sorting, decolorization and drying sessions.

## 8. Quotation to order to dispatch to invoice to payment

Page: **Sales**. Module guide: [Sales](07-modules/sales.md). Every step needs the Sales page at Full, which only the Admin has at the start.

A quotation is optional. An order can be entered directly at step 4.

| # | Step | Status after | What the system checks |
|---|---|---|---|
| 1 | **Quotations** tab → **New quotation**. Fill in Customer, Product (optional), Fabric lot (optional for now), Quality, Weight, Price per kg, Discount %, Tax %, Valid until. | Quotation: **Draft**, for example `QT-00005`. | Weight and price "Must be greater than zero." Discount and tax "Must be between 0 and 100." |
| 2 | ⋯ → **Mark as sent**. | **Sent**. | Only a Draft quotation can be sent. |
| 3 | ⋯ → **Customer accepted**, or **Customer declined**. | **Accepted** or **Rejected**. | Possible from Draft or Sent. After this the quotation can no longer be edited: "A quotation that is *accepted* can't be changed." |
| 4 | On the accepted quotation: ⋯ → **Make order**. Choose the fabric lot if none was chosen before. Press **Create order**. Or, without a quotation: **Orders** tab → **New order**. | Quotation: **Converted** (it can no longer be changed or deleted). A new sales order: **Draft**, with the quoted terms. | "The customer has to accept the quotation before it becomes an order." "Choose the fabric lot to sell from." On a direct order: "Enter a buyer name or choose a customer." |
| 5 | On the order: ⋯ → **Confirm**. | Order: **Confirmed**. The weight is now reserved. | "Only *N* kg of dried stock is available for this fabric (*M* kg needed). Save the order as Draft until stock is ready." The lot must not be in quarantine. If the customer is over their credit limit, a warning is shown and the order is confirmed anyway: "*Customer* now owes Rs. *N*, which is over their credit limit of Rs. *M*." |
| 6 | ⋯ → **Dispatch** (or **Dispatches** tab → **New dispatch**). Fill in Vehicle number, Weight, driver details and Status. | A dispatch with a challan number, for example `DC-00012`. The ledger gets a movement "Dispatch" of minus the weight. An order can go out in several dispatches. | "Confirm the order before dispatching it." "Only *N* kg of this order is left to dispatch." "Only *N* kg of dried stock is on hand for this order." The lot must not be in quarantine. |
| 7 | On the dispatch: ⋯ → **Print challan**. | — | If nothing opens: "The browser blocked the print window. Allow pop-ups for this site and try again." |
| 8 | When the goods have arrived: on the dispatch, ⋯ → **Mark delivered**. | Dispatch: **Delivered**. Order: **Completed**. | — |
| 9 | On the order: ⋯ → **Raise invoice**. The weight defaults to everything dispatched and not yet invoiced. Press **Raise invoice**. | Invoice, for example `INV-00009`. Its status is **Unpaid** unless the order already has payments that cover it. The due date is the invoice date plus the customer's payment terms in days. | "Nothing is left to invoice: dispatch goods first." "Only *N* kg has been dispatched and not yet invoiced." |
| 10 | **Invoices** tab → ⋯ → **Print invoice**. | — | — |
| 11 | **Payments** tab → **Record payment**. Choose the Order, type the Amount, Method and Reference number. | Order payment status: **Partial**, then **Paid** when payments reach the order total less credits for approved returns. | — |
| 12 | **Finance** → **Update books**. | The invoice, the payment and any approved return have journal entries. | See [workflow 14](#14-month-end-in-finance). |

Things to know:

- **Draft orders do not hold stock.** Confirming does. Cancelling releases what is still reserved: ⋯ → **Cancel order** (offered on Confirmed orders) → **Cancelled**.
- **Dispatching does not change the order's status.** The order stays Confirmed until a dispatch is marked delivered, which sets it to Completed. The status **Dispatched** is only set by hand, in the order form's "Order status" field.
- **"Mark delivered" completes the whole order**, even if only part of it has been dispatched. For an order that goes out in several dispatches, mark delivered only on the last one.
- **Payments belong to the order, not to an invoice.** An order's payments and return credits settle its invoices oldest first. That gives each invoice its status: **Paid**, **Partial**, **Unpaid**, or **Overdue** when it is not fully paid after its due date.
- **The system does not compare a customer payment with what is still owed.** Check the amount before saving.
- **An invoice's amounts are fixed** when it is raised. On the screen an invoice can be printed or deleted; it cannot be edited. To correct one, delete it and raise it again.
- **What a customer owes** = orders that are Confirmed, Dispatched or Completed, less payments, less credits for approved returns. Sales → Customers → ⋯ → **Statement** lists these with a running balance.
- **E-mails.** When a dispatch is saved with the status Dispatched, when an order becomes Completed, and when a payment is recorded, an e-mail goes to the management address, if one is set. See [Configuration](11-configuration.md).

## 9. A customer return

Page: **Sales** → **Returns** tab. Module guide: [Sales](07-modules/sales.md).

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Sales page at Full | On the order: ⋯ → **Record return**. Or **Returns** tab → **Record return**. Fill in the Order, Weight, Return date, "What happens to the goods" (Written off, or Back into sellable stock) and the Reason. | Return: **Requested**, for example `SR-00004`. Nothing else changes yet. It appears on the Approvals page. | "Only *N* kg of this order has been dispatched and not already returned." The weight "Must be greater than zero." "Say why the goods came back." |
| 2 | The duty *Approve sales returns* (Admin by default) | **Returns** tab → ⋯ → **Approve**, or Approvals → **Sales returns** → **Approve**. | Return: **Approved**. The customer is credited: the returned weight at the order's price, less the order's discount, plus its tax. The order's payment status is worked out again. If "Back into sellable stock" was chosen, the ledger gets a movement "Sales return" of plus the weight. | "This return is already *approved*." "Your role is not allowed to approve or reject a return." The weight is checked once more against what was dispatched. |
| 2b | Same | Or **Reject** (a reason is optional). | Return: **Rejected**. Nothing else changes. | — |
| 3 | Finance page at Full | **Finance** → **Update books**. | A journal entry: debit Sales returns, credit Accounts receivable, dated the day of approval. | — |

After approval the return is final: "This return is already approved and can't be changed." and "An approved return has credited the customer and can't be deleted." A Requested or Rejected return can be deleted.

## 10. A machine breakdown and a preventive job

Page: **Maintenance**. Module guide: [Maintenance](07-modules/maintenance.md).

Machines, schedules and spare parts are kept by users with the duty *Manage maintenance* (Admin by default). Reporting and doing the work is open to everyone who holds the Maintenance page at Full. Deleting a work order is Admin only.

### A breakdown

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | Maintenance page at Full | **Report breakdown** (a user with the duty *Manage maintenance* sees **New work order**). Choose the Machine, say what is wrong, set the Priority and set "Machine stopped" to yes. | Work order: **Open**, for example `WO-00021`, type Corrective. Machine: **Broken down**. It appears in the bell (rule "Machine breakdowns"). | "This machine is retired." Without the duty *Manage maintenance*: "Only an admin can create preventive work orders." and "Only an admin can assign a work order." |
| 2 | The duty *Manage maintenance* (Admin by default) | Optional: ⋯ → **Edit** → set "Assigned to". | — | Left empty, anyone can pick the job up. |
| 3 | The assigned person; or anyone, when nobody is assigned; or the duty *Manage maintenance* | ⋯ → **Start**. | Work order: **In progress**. | "Only an open work order can be started." "This work order is assigned to someone else." |
| 4 | Same | ⋯ → **Parts used** → "Use a part": choose the Part and the Quantity, press **Add part**. | The part's stock goes down. The use keeps the part's cost of that day. | "Only *N* *pcs* of *Bearing* in stock." "Parts can't be added to a work order that is *done*." |
| 5 | Same | ⋯ → **Complete**. Describe the Work done. Type the Downtime in minutes, Labour hours, Labour cost and Other cost. | Work order: **Done**. Machine: back to **Running**, unless another breakdown or job in progress remains on it. | "Describe the work that was done." "Enter whole minutes." Costs "Can't be negative." |
| 5b | The duty *Manage maintenance* (Admin by default) | Or ⋯ → **Cancel**. | Work order: **Cancelled**. The machine's status is worked out again. | "A work order that is *done* can't be changed." |

How a machine's status follows its work orders:

| Unfinished work orders on the machine | Machine status |
|---|---|
| At least one marked "Machine stopped" | Broken down |
| None stopped, at least one In progress | Under maintenance |
| None of these, and the machine was Broken down or Under maintenance | Running |
| The machine is Retired | Never changed |

A work order can be completed straight from Open; starting it first is not required.

### A preventive job

| # | Who | Step | Status after | What the system checks |
|---|---|---|---|---|
| 1 | The duty *Manage maintenance* (Admin by default) | **Schedules** tab → **New schedule**. Choose the Machine, name the Task, set "Every (days)" and "First due on". Instructions are copied into each work order. | Schedule: **On schedule**. Next due = the first due date until the task has been done once. | "Must be at least 1 day." |
| 2 | — | When the date passes, the schedule shows **Overdue** and appears in the bell (rule "Overdue preventive maintenance") and on the Maintenance dashboard. | — | — |
| 3 | The duty *Manage maintenance* (Admin by default) | On the schedule: ⋯ → **Create work order**. | A work order of the type Preventive: **Open**. The schedule shows "Work order open". | One at a time: "*WO-00021* is still open for this schedule." "This schedule is not in use." |
| 4 | The duty *Manage maintenance* (Admin by default) | Assign the work order (⋯ → **Edit**). | — | — |
| 5 | The assigned person, or as in the breakdown above | **Start**, record parts, **Complete**. | Work order: **In progress**, then **Done**. Machine: **Under maintenance** while in progress, then **Running**. | As above. |
| 6 | — | On completion the schedule's "Last done" becomes that day. | Next due = last done + the number of days. | — |

Spare parts: a user with the duty *Manage maintenance* adds stock with **Spare parts** tab → ⋯ → **Receive**. A part's stock cannot be typed over: "Use “Receive” to add stock." The same duty is needed to remove a part from an unfinished work order; the quantity then goes back into stock. Without it: "Your role is not allowed to remove parts from a work order."

## 11. Attendance and leave

Page: **Workforce**. Module guide: [Workforce](07-modules/workforce.md). Every step needs the Workforce page at Full, which only the Admin has at the start.

### Daily attendance

| # | Step | Result | What the system checks |
|---|---|---|---|
| 1 | **Attendance** tab. Choose the **Date** and, if you wish, a **Shift**. | The sheet lists every current employee who had joined by that date. With a shift chosen, it lists that shift's people, people with no fixed shift, and anyone already recorded on it. | The date cannot be in the future. |
| 2 | Each row starts as: the saved record, if there is one; **Leave**, if the person has approved leave that day; otherwise **Present** with the shift's start and end times. Change the Status, Check-in and Check-out where needed. | — | — |
| 3 | Press **Save attendance**. | Missing records are added and existing ones updated in one go. "Attendance saved for *N* employees." | "Attendance can't be marked for a future date." "Enter the check-in time too." If one row is wrong, nothing is saved and the problems are listed by name. |

Rules for a record:

- One record per employee per day: "*Name* already has attendance for *12 Oct 2026*. Edit that record instead."
- Statuses: **Present**, **Late**, **Half day**, **Absent**, **Leave**.
- Hours come from the check-in and check-out times. A check-out at or before the check-in counts as the next day. Hours typed by hand are kept.
- For Absent and Leave, times and hours are cleared.
- A single record can be added with **Add one record**, and any record can be edited or deleted in the "Attendance records" table.

### A leave request

| # | Step | Status after | What the system checks |
|---|---|---|---|
| 1 | **Leave** tab → **New leave request**. Choose the Employee, the Leave type (Annual, Sick, Casual, Unpaid), the First day and the Last day. | **Pending**. The number of days counts both ends. It appears on the Approvals page and in the bell (rule "Leave requests waiting"). | "The last day can't be before the first day." It cannot overlap another pending or approved leave: "*Name* already has *approved* leave from *10 Oct 2026* to *12 Oct 2026*." |
| 2 | **Approve** or **Reject**: on the Leave tab (⋯), on the Workforce dashboard, or on Approvals → **Leave requests**. A note is optional. | **Approved** or **Rejected**. The decider and time are kept. | "This request is already *approved*." |
| 3 | On the days of approved leave, the attendance sheet starts that person as **Leave**. | — | Approving does not write attendance. Someone still saves the sheet. |

A decided request cannot be edited: "This request is already approved and can't be changed."

Leave approval needs the Workforce page at Full. It is not a duty.

## 12. Recording waste and utilities

Page: **Sustainability**. Module guide: [Sustainability](07-modules/sustainability.md).

Everyone who holds the page at Full can add records. A user changes only their own entries. Deleting, and the Setup tab, are Admin only.

### A waste record

| # | Who | Step | What the system checks |
|---|---|---|---|
| 1 | Sustainability page at Full | **Add waste record**. Fill in Date, Weight, Waste category, "Where it came from" (Warehouse, Sorting, Decolorization, Drying, Other), the Fabric lot (optional), the Disposal method, "Taken by", Disposal cost, "Sold for", and the manifest or gate pass number. | The weight "Must be greater than zero." "The date can't be in the future." "This waste category is not in use." Cost and income "Can't be negative." |
| 2 | The person who recorded it, or an Admin | ⋯ → **Edit**. | "You can only change entries you recorded yourself." |
| 3 | Admin only | ⋯ → **Delete**. | "Only an admin can delete this." |

Enter only waste that was physically weighed and disposed of. Process loss (input minus output of a session) is worked out from the sessions; do not enter it here.

Every disposal method except **Landfill** counts as "diverted from landfill".

### A utility reading

| # | Who | Step | What the system checks |
|---|---|---|---|
| 1 | Sustainability page at Full | **Utilities** tab → **Add reading**. Choose the Utility, the Date, the Quantity used, the Cost, the Area (empty means the whole factory) and the meter or bill number. | The quantity "Must be greater than zero." "The date can't be in the future." |

Each utility has one fixed unit: Water m3, Electricity kWh, Gas m3, Steam kg, Diesel litres. Enter what was used since the last reading, not the meter's total.

### What the figures do with them

The Dashboard and the **Environmental report** tab work out, for the chosen period: recovery rate, process loss per stage, waste handled, share diverted from landfill, water per kg, energy per kg, and chemical cost per kg. Nothing is typed in as a percentage. The page shows how each figure is worked out under "How these are calculated".

Targets (Setup tab, Admin only) compare one figure with a goal. Only one active target per figure is allowed: "There is already an active target for this figure. Edit it, or switch it off first."

## 13. Uploading a document and a new version

Page: **Documents**. Module guide: [Documents](07-modules/documents.md).

A category decides which roles can see its documents. A role that may not see a category does not see its documents anywhere; opening one answers "not found".

### Upload

| # | Who | Step | Result | What the system checks |
|---|---|---|---|---|
| 1 | Documents page at Full, and a category the role can see | **Upload document**. Choose the File, type the Title, choose the Category. Optional: Reference number, Issued on, Expires on, "Belongs to" (the kind of record and its name or number), Description. | A document with a number, for example `DOC-00031`, at **Version 1**. | See the table below. |
| 2 | — | The expiry status is worked out from "Expires on". | **Valid**, **Expiring soon** (within 30 days), **Expired**, or **No expiry**. | Documents that expire appear on the **Expiring** tab and in the bell (rule "Documents expiring"). |

Upload checks:

| Check | Message |
|---|---|
| A file is chosen | "Choose a file to upload." |
| Size (10 MB unless changed in the settings) | "The file is too large. The limit is 10 MB." |
| Not empty | "The file is empty." |
| Allowed type | "This type of file is not allowed. Allowed types: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt." |
| The content really is that type | "The content of this file is not a real .pdf file." |
| The category is open to the user's role | "Choose a category you have access to." |
| The category is in use | "This category is no longer in use." |
| Dates | "The expiry date can't be before the issue date." |
| "Belongs to" is complete | "Say which record this document belongs to." |

### A new version

| # | Who | Step | Result | What the system checks |
|---|---|---|---|---|
| 1 | The person who uploaded the document, or an Admin | On the document: ⋯ → **New version**. Choose the File and say what changed. Press **Upload**. | The document is at the next version (Version 2, 3 …). "Version *N* added." | The same file checks as above. "Only an admin or the person who uploaded this document can change it." |
| 2 | Anyone who can see the document | ⋯ → **Versions** lists every version with who uploaded it and when. Each can be downloaded. | Older versions stay. | — |
| 3 | Anyone who can see the document | ⋯ → **Download**. | The current file is saved to your computer. | Every download is written to the audit log (action EXPORT). |

Other rules:

- **Edit details** (⋯) changes the title, dates and so on. It does not replace the file; use **New version** for that.
- Moving a document to another category changes who can see it. Admin only: "Only an admin can move a document to another category."
- Deleting a document is Admin only and removes all its versions and files for good.
- Files are checked for type and size. They are **not** scanned for viruses.

## 14. Month-end in finance

Page: **Finance**. Module guide: [Finance](07-modules/finance.md). Every step needs the Finance page at Full, which only the Admin has at the start.

### Where journal entries come from

| Record | Debit | Credit | Dated |
|---|---|---|---|
| Sales invoice | Accounts receivable | Sales; Sales tax payable | The invoice date |
| Customer payment | Cash in hand (method Cash) or Bank account (any other method) | Accounts receivable | The payment day |
| Approved sales return | Sales returns | Accounts receivable | The day it was approved |
| Supplier invoice | Raw material purchases; Purchase tax recoverable | Accounts payable | The invoice date |
| Supplier payment | Accounts payable | Cash in hand or Bank account, by method | The payment date |
| Expense | The expense account | The account it was paid from | The expense date |
| Typed in by hand | As entered | As entered | As entered |

A sale reaches the books when it is **invoiced**, and a purchase when the **supplier's invoice** is entered. So "Accounts receivable" here can differ from the Sales page's "Owes" figure, which counts confirmed orders.

### The steps

| # | Step | Result | What the system checks |
|---|---|---|---|
| 1 | Make sure the month's records are complete: supplier invoices and payments (Purchasing), sales invoices, payments and returns (Sales). | — | — |
| 2 | Record the month's expenses: **Record expense**. Fill in Date, Amount, "What was paid for", Expense account, "Paid from", "Part of the factory", "Paid to", voucher number. | An expense with a number, for example `EXP-00018`, and its journal entry, saved together. | "Choose an expense account." "Choose a cash or bank account." The amount "Must be greater than zero." The date must not be in a closed period. |
| 3 | Type any other entries by hand: **Journal** tab → **New entry** → **Post entry**. For example depreciation, a loan, the owner's capital. | An entry with a number, for example `JV-00240`, marked "Typed in". | "An entry needs at least two lines." "Each line needs either a debit or a credit." "The entry does not balance: debits Rs. *N*, credits Rs. *M*." An account that is not in use is refused. |
| 4 | Press **Update books**. | "Books updated: *N* posted, *N* corrected, *N* removed." or "The books are already up to date." | Entries whose record changed are replaced; entries whose record was deleted are removed. Running it twice changes nothing. |
| 5 | Review: **Statements** tab (Profit and loss, Balance sheet, Trial balance, Cash flow), **Balances** tab (who owes what), **Costing** tab (cost per kg). | The trial balance and the balance sheet show whether they balance. | Opening a statement also brings the books up to date first. |
| 6 | Correct mistakes. A wrong typed-in entry: ⋯ → **Reverse**. A wrong automatic entry: correct the record it came from (the invoice, payment, return or expense), then **Update books**. | A reversal is a new entry that mirrors the old one. Both stay. | "This entry has already been reversed." "This entry is itself a reversal." "This entry was posted from a *sales invoice*. Change that record instead." |
| 7 | **Setup** tab → **New period** (if it does not exist) → ⋯ → **Close period**. | Period: **Closed**. "Period closed; its entries are locked." | "These dates overlap *October 2026*." Closing runs "Update books" first. |

### After closing

- No entry dated in the period can be added, changed or removed: "*October 2026* is closed. Reopen the period or use a later date."
- If a sales or purchasing record dated in the period changes later, the record is saved but the books are not touched. **Update books** then says: "*N* change(s) fall in a closed period and were left as they are."
- To let such changes in: ⋯ → **Reopen**, press **Update books**, and close the period again.

Journal entries are never edited or deleted by a user. That is why a wrong entry is reversed rather than changed.

## 15. Tracing a lot

Page: **Traceability**. Module guide: [Search and traceability](07-modules/search-and-traceability.md). Every role has this page at the start.

| # | Step | Result |
|---|---|---|
| 1 | Open **Traceability**. Type at least two characters in "Find a lot: number, material, supplier, order or invoice…". | Matching lots are listed in groups: Fabric lots, Deliveries, Purchase orders, Production orders, Sales orders, Invoices. A group is only shown if you can open its page. |
| 2 | Click a result. | The page shows the lot. Its address ends with `?lot=` and the lot's number, so the page can be bookmarked or sent to a colleague. |
| 3 | Read the lot card. | Material, status, supplier, date received, lot weight, weight still to sort. If the lot is held: "Held in quarantine by inspection *QC-00007*. It can't be processed or sold until an admin releases it." |
| 4 | Read the **Yield** strip. | Weight in → Sorted → Decolorized → Dried → Sold, each as a share of the weight in. Below: Overall yield, Waste, Returned, Recorded cost. A stage that has not happened says so, for example "Not dried yet". |
| 5 | Read **From delivery to customer**. | Sections in order: Delivery (with the purchase order and incoming inspections), Sorting, Decolorization (with the chemicals issued to each batch), Drying, Production orders, Quality inspections, Sellable stock (every ledger movement), Sales (orders, dispatches, invoices, returns). |
| 6 | Press **Print**. | The page prints on white paper. Choose "Save as PDF" in the print window to keep a copy. |

Things to know:

- **Sections follow access.** The purchase order needs the Purchasing page, Drying needs the Drying page and Sales needs the Sales page. A section you may not read shows "Not available for your role".
- **Other ways in.** The search box in the header (Ctrl + K) finds lots too; choosing one opens its trace. The address can also point at a delivery (`?stock=`), a production order (`?production=`) or a sales order (`?order=`). Tracing by sales order needs the Sales page; otherwise: "Only an admin can trace a sales order."
- **A delivery split into several lots** lists them: "This delivery was split into *N* lots", with a button for each.
- **Overall yield** = dried output ÷ the lot's initial weight.
- **Recorded cost** = the cost of chemicals issued to the lot's batches plus the cost recorded on its production orders. It is not a full product cost.
- If the link points to nothing: "Lot not found".

## Approvals at a glance

Every approval is **one decision by one person**. There are no chains and no amount limits. All seven kinds are listed on the **Approvals** page, and each can also be decided on its own module page. Both places call the same action, so the same rules apply.

| Approval | Who starts it | Who decides it | Where it is decided | What approving unlocks | If it is refused |
|---|---|---|---|---|---|
| **Purchase request** | A user with the Purchasing page at Full submits a request. | The duty *Approve purchases* (Admin by default) | Approvals → Purchase requests; Purchasing → Dashboard or Requests | A purchase order can be created from the request. | **Reject** needs a reason. The request becomes Rejected; it can be edited (back to Draft) and submitted again. |
| **Purchase order** (new or amended) | A user with the Purchasing page at Full submits an order. Editing an approved order submits it again by itself. | The duty *Approve purchases* (Admin by default) | Approvals → Purchase orders; Purchasing → Dashboard or Orders | Deliveries can be booked against the order's lines. The linked request becomes Ordered. | There is no reject action for orders. The order stays Submitted until it is approved, edited, cancelled or deleted. |
| **Quarantine release** | An inspection is saved with the result Fail. | The duty *Release quarantine* (Admin by default) | Approvals → Quarantine; Quality → Dashboard or Inspections | The delivery or lot can again go to sorting, sessions, production and sales. A reason is required. | Nothing to refuse: the material stays in quarantine until it is released. |
| **Production order release** | A user with the duty *Plan production* creates an order. Every Draft order waits here. | The duty *Plan production* (Admin by default) | Approvals → Production orders; Production → Orders | The floor can start the order's stages. The plan is frozen except for dates, priority, unit and notes. | There is no reject action. A draft that should not run is cancelled or deleted. |
| **Sales return** | A user with the Sales page at Full records a return. | The duty *Approve sales returns* (Admin by default) | Approvals → Sales returns; Sales → Returns | The customer is credited, the order's payment status is updated, and the weight goes back into sellable stock if that was chosen. | **Reject** with an optional reason. The return becomes Rejected and nothing else changes. |
| **Decolorization batch** | A decolorization session is completed. | The duty *Approve decolorization batches* (Admin by default) | Approvals → Decolorization batches; Decolorization → Sessions | Nothing. It is a sign-off on the batch record: who approved it and when. | There is no reject action. An unapproved batch blocks nothing. |
| **Leave request** | A user with the Workforce page at Full records a request for an employee. | The Workforce page at Full (Admin by default). Not a duty. | Approvals → Leave requests; Workforce → Dashboard or Leave | The attendance sheet suggests "Leave" for the person on those days. | **Reject** with an optional note. The request becomes Rejected. |

Who is told that something is waiting:

| Approval | Notification rule | Who receives it at the start |
|---|---|---|
| Purchase requests and orders | Purchases waiting for approval | Admin |
| Quarantine | Material in quarantine | Admin and every supervisor |
| Sales returns | Sales returns waiting for approval | Admin |
| Leave requests | Leave requests waiting | Admin |
| Production orders, decolorization batches | None. They are listed on the Approvals page only. | — |

Things that look like approvals but are not:

| Thing | What it really is |
|---|---|
| A delivery's status "Approved" | A value of the Status field in the delivery form. Anyone with the Warehouse page at Full can set it. |
| A quotation's "Customer accepted" | A record of the customer's answer, entered by whoever handles the quotation. |
| Closing a purchase order | An action that needs the duty *Approve purchases*, but nothing waits for it. |
| Closing a financial period | An action on the Finance page. Nothing waits for it. |

## For developers

| Workflow | Rules live in |
|---|---|
| Purchasing | `backend/apps/procurement/services.py`, `serializers.py`, `views.py`, `signals.py` |
| Delivery | `backend/apps/warehouse/serializers.py`, `views.py` |
| Inspection and quarantine | `backend/apps/quality/services.py` (`check_may_inspect`, `check_usable`, `check_lot_change`, `release`), `serializers.py`, `views.py` |
| Sorting | `backend/apps/sorting/serializers.py`, `views.py` (`complete`) |
| Decolorization | `backend/apps/decolorization/serializers.py`, `views.py` |
| Drying and the ledger | `backend/apps/drying/views.py`, `backend/apps/inventory/services.py`, `backend/apps/inventory/signals.py` |
| Production | `backend/apps/production/services.py`, `serializers.py`, `views.py` |
| Sales and returns | `backend/apps/sales/services.py`, `serializers.py`, `views.py`; stock checks in `backend/apps/inventory/services.py` (`check_order_reservation`, `check_dispatch`) |
| Maintenance | `backend/apps/maintenance/services.py`, `serializers.py`, `views.py` |
| Attendance and leave | `backend/apps/workforce/services.py`, `serializers.py`, `views.py` |
| Waste and utilities | `backend/apps/sustainability/serializers.py`, `views.py`, `services.py` |
| Documents | `backend/apps/documents/services.py`, `serializers.py`, `views.py` |
| Finance | `backend/apps/finance/services.py`, `views.py` |
| Traceability | `backend/apps/search/trace.py`, `finder.py` |
| Approvals inbox | `backend/apps/alerts/approvals.py` |
| Weight checks shared by all "complete" actions | `backend/apps/core/quantities.py` |

Actions are `POST` calls on the record, for example `/api/v1/procurement/orders/<id>/approve/`, `/api/v1/quality/inspections/<id>/release/`, `/api/v1/production/steps/<id>/complete/`, `/api/v1/sales/orders/<id>/confirm/`, `/api/v1/sales/returns/<id>/approve/`, `/api/v1/finance/periods/<id>/close/`. The full list is in [API](10-api.md).

## Keeping this page up to date

- **Statuses and transitions:** each module's `models.py` (the `STATUS_CHOICES`) and `services.py`. When a status or a transition changes, update the workflow table and the glossary in [System overview](01-system-overview.md).
- **Messages:** search the backend for `ValidationError(` and `PermissionDenied(`. Quoted messages on this page must match the code word for word.
- **Who does each step:** search for `has_duty(`, `HasDuty(`, `HasPage(`, `is_admin(` and `SharedReadPermission` in the module's `views.py`, `serializers.py` and `services.py`.
- **Approvals at a glance:** the `KINDS` list in `backend/apps/alerts/approvals.py` and `RULE_PAGES` in `backend/apps/alerts/rules.py`.
- **Button and tab names:** `frontend/src/features/<module>/*-page.tsx` and `*-forms.tsx`.
