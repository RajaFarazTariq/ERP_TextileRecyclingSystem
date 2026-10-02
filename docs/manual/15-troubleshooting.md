# Troubleshooting

This page lists problems people meet in daily use, why they happen and what to do. It is for administrators first. Parts marked **For developers** or that use the server's command line are for whoever runs the server.

Messages in quotation marks are the exact words the system shows. Where a message contains a number or a name, a sample value or *N* stands in for it.

## On this page

- [How the system reports a problem](#how-the-system-reports-a-problem)
- [Signing in](#signing-in)
- [Access, and being sent back to the home page](#access-and-being-sent-back-to-the-home-page)
- [Refusals shown by the system](#refusals-shown-by-the-system)
- [Stock figures](#stock-figures)
- [Finance](#finance)
- [Documents and uploads](#documents-and-uploads)
- [Notifications](#notifications)
- [Slow or unreachable system](#slow-or-unreachable-system)
- [After an update](#after-an-update)
- [For developers](#for-developers)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## How the system reports a problem

| Where you see it | What it means |
|---|---|
| Red text under a field in a form | That field has to be corrected. The form was not saved. |
| A red box at the top of a form | A problem that does not belong to one field. The form was not saved. |
| A red box inside a "Delete …?" question | The delete was refused. The record is still there. |
| A small message in the corner of the screen (a toast) | The result of an action: green for done, red for refused, amber for a warning. |
| A box in the middle of a page with a retry button | The page could not load its data. |
| The sign-in page appears | Your session has ended, or the page you asked for needs you to sign in. |
| The home page appears instead of the page you asked for | You do not have that page. |

The system refuses some things on purpose. A refusal always says why. Most of this page is about those messages.

## Signing in

| Symptom | Cause | Fix |
|---|---|---|
| "Invalid username/email or password." | The name, e-mail or password is wrong. The system does not say which. | Check for typing mistakes and Caps Lock. You can sign in with either the username or the e-mail address. If the password is forgotten, an Admin sets a new one. See [Admin guide](06-admin-guide.md#reset-a-password). |
| "This account is inactive. Contact your administrator." | An Admin deactivated the account. | An Admin opens Users → ⋯ → **Activate**. |
| "Too many sign-in attempts. Please wait a minute and try again." | More than 10 sign-in attempts in a minute came from the same address. | Wait a minute. If **everyone** gets this at the same time, see the row below. |
| Everyone is told "Too many sign-in attempts" although each person tried once | The server counts all users as one address, because it sees the address of the proxy in front of it and not the visitor's. | Whoever runs the server sets `NUM_PROXIES=1` for the backend. The Docker setup does this already. See [Configuration](11-configuration.md). |
| "Enter your username or email." / "Enter your password." | A field was left empty. | Fill it in. |
| "Could not sign in." | The web app could not get an answer from the API. | See [Slow or unreachable system](#slow-or-unreachable-system). |
| After signing in, the sign-in page comes straight back | The session cookies were not kept by the browser. The usual cause: the site is opened over plain `http://` while `SECURE_COOKIES` is set to `true`. | Open the site over `https://`, or set `SECURE_COOKIES=false` while the site is served without HTTPS. See [Deployment](12-deployment.md). |
| "Cross-site request blocked." | The request did not come from the site's own address. This happens when a reverse proxy in front of the system does not pass on the original host name. | Whoever runs the server makes the proxy pass the `Host` (or `X-Forwarded-Host`) header unchanged. |
| You are signed out while working | The session ended. A session lasts as long as the system is used at least once every 7 days. Signing out on purpose, or a change of the server's `SECRET_KEY`, also ends it. | Sign in again. You are taken back to the page you were on. |
| There is no "forgot password" link | It is not built. No password e-mails are sent. | An Admin sets a new password on the Users page. |
| The only Admin has forgotten their password | No other account can reset it. | Whoever runs the server sets a new password from the command line: `python manage.py changepassword <username>` (in Docker: `docker compose exec backend python manage.py changepassword <username>`). It asks for the new password twice and changes nothing else. |
| Someone may be guessing passwords | — | Reports → Audit log → action "login failed". Each failed attempt is kept with the name that was typed and the address it came from. |

## Access, and being sent back to the home page

How access works is explained in [Access control](05-access-control.md). This section covers the symptoms.

| Symptom | Cause | Fix |
|---|---|---|
| A page is missing from the menu. Typing its address sends you to the home page. | You do not hold that page. | Ask an Admin: Users → **Access**. The Admin gives the page to your role, or to you alone as an exception. |
| The page opens, but shows the badge **View only**. There are no add buttons, and the ⋯ menus offer only things that show something (Download, Statement, Print …). | You hold the page at the level View only. | If you need to change records there, ask an Admin for the level Full. |
| "You have view-only access here, so you can look but not change anything." | The same: a change was sent from a page you hold at View only. | As above. |
| "You do not have access to this part of the system. Ask an admin if you need it." | The page needed data from a part of the system your pages do not cover. | Ask an Admin for the page that owns that data. |
| An Admin changed someone's access, but the person still sees the old menu | A change applies from the person's next page load. An open browser tab also checks every minute and when it gets focus again. | The person opens another page or reloads. Signing in again is not needed. |
| You can open the page, but an action is refused with "Your role is not allowed to …" | The action needs a **duty** your role does not carry. Opening a page does not make someone an approver. | An Admin gives the duty to the role, or does the action. The messages are listed below. |
| A role was given a duty, but the button (for example **Approve**) still does not appear, or the action is refused | A duty only works for a role that also holds the duty's page at **Full**. The buttons also follow the user's session, which is refreshed within a minute. | Users → Access: check "Pages by role" for that page, then have the person reload. |
| On the Approvals page a button is there, but pressing it is refused | The Approvals page shows its buttons to everyone who can open it. The module behind the item checks the duty. | Give the role the duty, or leave that kind of item to someone who has it. |
| "You do not have permission to perform this action." | The action is for Admins only: quality standards, waste categories, sustainability targets, document categories. | An Admin does it. These cannot be handed to another role. |
| The search box (Ctrl + K) does not find a record you know exists | Search returns a kind of record only if you can open its page. It also needs at least two characters, and shows at most six results per kind. | Type more of the name or the full number (for example `PO-00042`). If the kind of record is never shown, you do not hold its page. |
| A section of the Traceability page says "Not available for your role" | The purchase order needs the Purchasing page, Drying needs the Drying page, Sales needs the Sales page. | Ask an Admin if you need to see it. |
| A document someone else can see is missing for you, or opening it answers "not found" | The document's category is not open to your role. | An Admin opens the category: Documents → Categories → ⋯ → Edit → "Who can see it". |
| The Users page cannot be given to a supervisor | By design. Whoever holds it could give themselves everything. | Make the person an Admin if they must manage users. |

Messages when a duty is missing:

| Message | Duty that is needed (Admin by default unless noted) |
|---|---|
| "Your role is not allowed to approve or reject purchases." | Approve purchases |
| "Your role is not allowed to record supplier payments." | Record supplier payments |
| "Your role can't record incoming inspections." (or "in-process", "finished") | Inspect incoming material / in-process material / finished goods. These start with the supervisors; see [Workflows](08-workflows.md#3-incoming-inspection-quarantine-and-release). |
| "Your role is not allowed to release material from quarantine." | Release quarantine |
| "Only someone who may release quarantine can change a failed inspection." | Release quarantine |
| "Your role is not allowed to plan production." | Plan production |
| "Only a production planner can change the planned materials." / "… can change how a step is planned." | Plan production |
| "Your role is not allowed to update production steps." | Run production stages (starts with the Sorting, Decolorization and Drying Supervisors) or Plan production |
| "Your role is not allowed to approve a batch." | Approve decolorization batches |
| "*Caustic soda* is restricted: your role is not allowed to issue it." | Issue restricted chemicals |
| "Your role is not allowed to approve or reject a return." | Approve sales returns |
| "Your role is not allowed to adjust stock." | Adjust stock |
| "Your role is not allowed to manage maintenance." | Manage maintenance (machines, schedules, spare parts, cancelling a work order) |
| "Your role is not allowed to remove parts from a work order." | Manage maintenance |
| "Only an admin can change this work order." / "… can assign a work order." / "… can create preventive work orders." / "… can move a work order to another machine." | Manage maintenance. The wording says "admin", but the check is the duty. |
| "This work order is assigned to someone else." | Manage maintenance, or be the assigned person |

Messages that really are Admin only:

| Message | Where |
|---|---|
| "Only an admin can delete quality records." | Quality |
| "Only an admin can delete maintenance records." | Maintenance (deleting a work order) |
| "Only an admin can delete this." | Sustainability (waste records, utility readings) |
| "You can only change entries you recorded yourself." | Sustainability |
| "Only an admin can delete documents." | Documents |
| "Only an admin can move a document to another category." | Documents |
| "Only an admin or the person who uploaded this document can change it." | Documents |
| "Only admins can create users." / "Only admins can update or delete users." / "Only admins can toggle user status." | Users |
| "Only an admin can manage access." | Users → Access |

## Refusals shown by the system

### In every module

| Message | Why | What to do |
|---|---|---|
| "This record cannot be deleted because other records depend on it: *fabric stocks, inspections*." | Other records point to this one. The message names the kinds. | Do not delete it. Mark it as not in use instead (suppliers, customers, chemicals, recipes, routings, categories and so on have an "In use" or "Status" field), or deactivate it (users), or set the status to Left (employees). |
| "This *fabric lot* is in quarantine after failing inspection *QC-00007* and can't be *sorted* until an admin releases it." | The lot, or the delivery it came from, failed an inspection that has not been released. | A user with the duty *Release quarantine* releases it on the Quality page or the Approvals page, with a reason. See [Workflows](08-workflows.md#3-incoming-inspection-quarantine-and-release). |
| "Output (*900.00* kg) plus waste (*150.00* kg) is more than the input (*1,000.00* kg)." | A session cannot produce more than went in. | Check the two weights. If the input was typed wrong, edit the session first. |
| "Must be greater than zero." / "Must be zero or more." / "Enter a valid number." | A weight or amount is missing, negative or not a number. | Type a number with up to two decimals. |
| "*Field* must be a number with up to 2 decimals." | Letters, a comma, or three decimals were typed. | Use a dot for decimals and no thousands separator, for example `1250.50`. |
| "Session already completed." | The session was completed before, perhaps by someone else or in another tab. | Reload the page. |

### Warehouse and Purchasing

| Message | What to do |
|---|---|
| "Weight must be greater than zero." | Enter the delivery's "Our weight". |
| "*PO-00042* is *draft*; goods can only be received against an approved order." | The order must be Approved or Partially Received. Have it approved first, or save the delivery without an order and link it later. |
| "*PO-00042* is from *Supplier A*, not *Supplier B*." | Choose the right vendor on the delivery, or another order. |
| "Add at least one material before submitting." / "Add at least one line before submitting." | Open the request or order and add a line. |
| "Only *draft or rejected* records can be *submitted*." (and the same pattern for approved, rejected, cancelled, closed) | The record is not in a status that allows this step. Reload the page; someone may have moved it on already. |
| "A *submitted* request can no longer be changed." | Only Draft and Rejected requests can be edited. Ask the approver to reject it with a reason, then edit and submit again. |
| "Say why the request is rejected." | Type a reason. |
| "Only an approved request can be turned into an order." | Have the request approved first. |
| "A *received* order can no longer be changed." | Received, Closed and Cancelled orders are final. Raise a new order. |
| "*Cotton*: *500.00* kg has already been received; the quantity can't be lower." | A line cannot go below what has arrived. Close the order instead if nothing more is coming. |
| "*Cotton* has deliveries and can't be removed." | Keep the line. |
| "Goods have been received; the supplier can't change." | Raise a new order for the other supplier. |
| "Goods have been received against this order; close it instead." | Use **Close order**, not Cancel. |
| "Approved orders can't be deleted; cancel or close them instead." | Cancel (no deliveries yet) or close the order. |
| "Only draft, rejected or cancelled requests can be deleted." | Cancel the request first. |
| "This supplier already has an invoice with this number." | The invoice was entered before. Find it on the Invoices tab. |
| "*PO-00042* is from *Supplier A*." | The invoice's supplier and the order's supplier differ. Correct one of them. |
| "Only Rs. *12,000.00* is outstanding on this invoice." | A payment cannot exceed what is owed. Enter the outstanding amount or less. |
| "The total can't be less than what has already been paid." | The invoice has payments. Do not reduce it below them. |
| "Only *250.00* kg of this delivery can still be returned." | Returns on one delivery cannot exceed its weight. |

### Sorting, Decolorization and Drying

| Message | What to do |
|---|---|
| "Initial quantity must be greater than zero." / "Quantity taken must be greater than zero." | Enter the weight. |
| "Only *320.00* kg of this fabric is left unsorted." | Sorted plus waste is more than the lot's remaining weight. Check the figures, or correct the lot's initial quantity if it was entered too low. |
| "More than this has already been sorted." | The lot's initial quantity cannot go below what sessions have used. |
| "Total stock must be greater than zero." | Enter the chemical's stock. |
| "*120.00* has already been issued; total stock cannot be lower than that." | Total stock cannot go below what was issued. |
| "Not enough stock. Available: *45.00*" | Receive a chemical lot first (Lots → **Receive lot**), or issue less. |
| "This session runs in another tank." | Choose the tank the batch is in. |
| "This can't be changed after the lot is received. Delete the lot and enter it again." | The chemical and quantity of a received lot are fixed. |
| "Only *30.00* *Liters* of this chemical is left, so part of this lot has already been issued. It can no longer be deleted." | Keep the lot. Correct stock with a new lot or by editing the chemical's total stock. |
| "Add at least one chemical." / "Each chemical can be listed once." | Correct the recipe's lines. |
| "Only Pending or On Hold sessions can be started." | The drying session is already running or finished. |
| "This batch is already approved." | Nothing to do. |

### Production

| Message | What to do |
|---|---|
| "Planned output can't be more than the input." / "The end date can't be before the start date." | Correct the order. |
| "This routing is no longer in use." | Choose another routing, or set the routing back to "In use" in Setup. |
| "The routing has no stages. Add stages to it first." | Edit the routing in Setup, then make the order again. An order copies its stages when it is created. |
| "The order is released: only its dates, priority and notes can still change." | Cancel the order and plan a new one if the plan itself must change. |
| "Finish or skip "*Sorting*" first." | Stages run in order. Complete the earlier stage, or have a planner skip it. |
| "Start the step before completing it." | Press **Start** first. |
| "Output plus waste (*950.00* kg) is more than the input (*900.00* kg)." | Check the three weights of the stage. |
| ""*Drying*" is not finished yet." | Complete or skip every stage before completing the order. |
| "No step was carried out; cancel the order instead." | Every stage was skipped. Cancel the order. |
| "A *completed* order can no longer be changed." / "A *cancelled* order can't be *released*." | Completed and Cancelled orders are final. |
| "Only draft or cancelled orders can be deleted." | Cancel the order first. |

### Sales

| Message | What to do |
|---|---|
| "Only *800.00* kg of dried stock is available for this fabric (*1,000.00* kg needed). Save the order as Draft until stock is ready." | There is not enough free dried stock on that lot. Keep the order as a Draft, lower the weight, choose another lot, or wait for more drying. See [Stock figures](#stock-figures). |
| "Confirm the order before dispatching it." | Use ⋯ → **Confirm** on the order first. |
| "Only *200.00* kg of this order is left to dispatch." | The dispatch is bigger than what remains on the order. |
| "Only *150.00* kg of dried stock is on hand for this order." | The stock is not physically there, although the order was confirmed. Usually an older order confirmed before stock was tracked, or a drying session changed afterwards. See [Stock figures](#stock-figures). |
| "*Customer* now owes Rs. *N*, which is over their credit limit of Rs. *M*." | A warning only. The order is confirmed anyway. Decide whether to collect payment first. |
| "Enter a buyer name or choose a customer." | Fill in the Buyer field. |
| "A customer with this name already exists." | Use the existing customer. Names are compared without regard to capitals or extra spaces. |
| "A quotation that is *accepted* can't be changed." | Only Draft and Sent quotations can be edited. |
| "The customer has to accept the quotation before it becomes an order." | Use **Customer accepted** first. |
| "Choose the fabric lot to sell from." | Pick the lot when making the order. |
| "This quotation became an order and can't be deleted." | Keep it. |
| "Nothing is left to invoice: dispatch goods first." | An invoice covers dispatched goods. Record the dispatch first. |
| "Only *500.00* kg has been dispatched and not yet invoiced." | Lower the invoice weight. |
| "Only *300.00* kg of this order has been dispatched and not already returned." | A return cannot exceed what went out. Rejected returns do not count. |
| "This return is already *approved* and can't be changed." / "An approved return has credited the customer and can't be deleted." | An approved return is final. |
| "Choose the customer to merge into." / "Cannot merge a customer into itself." | Pick a different customer as the target. |
| "The browser blocked the print window. Allow pop-ups for this site and try again." | Allow pop-ups for the site in the browser, then print again. |

### Quality

| Message | What to do |
|---|---|
| "Choose the delivery that was inspected." / "Choose the fabric lot that was inspected." | Incoming inspections need a delivery; the other stages need a lot. |
| "This standard is for *in-process* inspections." | Choose a standard made for the inspection's stage. |
| "Enter the measured value." / "Mark the check as passed or failed." | Fill in every line of the checklist. |
| "A check failed, so the result can't be Pass. Choose Conditional or Fail." | The result must match the checklist. |
| "Say why the material failed." / "Write the condition under which the material is accepted." | Fill in the reason or the condition. |
| "A released inspection can't be changed." | Record a new inspection if the material is tested again. |
| "Only material in quarantine can be released." | The inspection is not a failed, unreleased one. Reload the page. |
| "Say why the material is released (e.g. re-tested, returned to supplier)." | Type the reason. |
| "Give a measurement a minimum, a maximum or both." / "The minimum can't be above the maximum." / "Add at least one check." | Correct the standard. |
| "An action can't be moved to another inspection." | Delete the action (Admin) and add it to the right inspection. |

### Maintenance

| Message | What to do |
|---|---|
| "This machine is retired." | Choose another machine, or have whoever manages maintenance change the machine's status. |
| "Link a machine to a tank or a dryer, not both." | Choose one. |
| "Only an open work order can be started." | It is already in progress or finished. |
| "A work order that is *done* can't be changed." | Done and Cancelled work orders are final. Raise a new one. |
| "Describe the work that was done." / "Enter whole minutes." | Fill in the completion form. |
| "*WO-00021* is still open for this schedule." | Finish or cancel that work order first. One preventive work order per schedule at a time. |
| "This schedule is not in use." | Set the schedule's status back to in use. |
| "Only *3* *pcs* of *Bearing 6204* in stock." | A user with the duty *Manage maintenance* receives more stock (Spare parts → ⋯ → **Receive**), or use less. |
| "Use “Receive” to add stock." | A part's stock is not typed over. Use **Receive**. |
| "Enter the quantity received." | Type the quantity in the Receive form. |

### Workforce

| Message | What to do |
|---|---|
| "Attendance can't be marked for a future date." | Choose today or an earlier date. |
| "*Name* already has attendance for *12 Oct 2026*. Edit that record instead." | One record per person per day. Edit the existing one, or use the sheet. |
| "Enter the check-in time too." | A check-out needs a check-in. |
| "A record can't be moved to another employee." | Delete the record and add it for the right person. |
| "*Name* already has *approved* leave from *10 Oct 2026* to *12 Oct 2026*." | Leave cannot overlap pending or approved leave of the same person. |
| "This request is already *approved*." / "… and can't be changed." | A decided request is final. Record a new request. |
| "This login already belongs to *Name*." | One login can be linked to one employee. |
| "The leaving date can't be before the joining date." / "The end can't be the same as the start." | Correct the dates or times. |
| "An employee with attendance, leave or tasks can't be deleted. Set their status to “Left” instead." (in the delete question) | Edit the employee and set Status to **Left**. |

### Sustainability

| Message | What to do |
|---|---|
| "The date can't be in the future." | Choose today or earlier. |
| "This waste category is not in use." | Choose another category, or have an Admin switch it back on in Setup. |
| "There is already an active target for this figure. Edit it, or switch it off first." | One active target per figure. |

### Users and access

| Message | What to do |
|---|---|
| "You can't deactivate your own account." / "You can't change your own role." / "You can't delete your own account." | Another Admin does it. |
| "This is the only active admin. Make another user an admin first." | Create or promote a second Admin first. |
| "Choose one of the roles under Users, Access." | The role sent does not exist. Choose one from the list. |
| "An admin always has every page. Change the role to limit this user." | Exceptions cannot be set for an Admin. |
| "*Users* is for admins only." | The Users page cannot be given to other roles or people. |
| A password is refused when creating or editing a user | It must have at least 8 characters, must not be a common password, must not be all digits, and must not be too close to the username or e-mail. |

## Stock figures

Sellable stock is never typed in. It is the sum of the stock ledger's movements for each lot. See [Inventory](07-modules/inventory.md).

| Symptom | Cause | Fix |
|---|---|---|
| A lot shows less "available" than was dried | Part of it is **reserved**. Available = on hand − reserved. Orders that are Confirmed or Dispatched reserve the weight they have not dispatched yet. | Look at the lot's orders on the Sales page, or trace the lot. Cancel or reduce an order to free stock. |
| A drying session was done, but the lot has no stock | The session is not **Completed**, or it was completed with an output of 0. | Drying → Sessions → ⋯ → **Complete**, with the dried output. |
| A lot is missing from the Fabric list when adding a drying session | The list shows lots with the status "Sent to Decolorization". A lot gets that status when a decolorization session on it is completed. | Complete the decolorization session first. |
| The lot has stock, but an order cannot be confirmed | The free stock is too low, or the lot is in quarantine. | Read the message: it says which. |
| The bell shows "*Lot* has more reserved than on hand (*N* kg short)" | Orders reserve more than the ledger holds. Causes: a completed drying session was edited or deleted after orders were confirmed; a negative adjustment; orders confirmed before stock tracking existed. | Complete more drying on the lot, cancel or reduce an order, or correct the stock with an adjustment. |
| Stock on the screen differs from a physical count | Unrecorded loss, a weighing difference, or a session entered with the wrong output. | First correct wrong sessions or dispatches; the ledger follows them. If the records are right and the count still differs, post an adjustment (below). |
| Deleting a dispatch changed the stock | By design. The question on screen says: "… will be removed and its weight returned to stock." | — |
| The inventory valuation report shows no value | Value = kg on hand × cost per kg, and the cost per kg needs dried output in the chosen period. | Choose a period in which drying sessions were completed. |
| A lot's status reads "Sorted" although it has been dried and sold | The lot's status field is used loosely. Completing a drying session sets it to "Sorted". | Do not judge stock by the lot's status. Use the available figure, or the Traceability page. |
| A chemical's remaining stock looks wrong | Remaining = total − issued. Receiving a lot raises both total and remaining. Editing or deleting an issuance puts its quantity back. Editing the chemical's total stock moves remaining by the same amount. | Check the Issuances and Lots tabs for that chemical. |

### Correct stock by hand (an adjustment)

There is no screen for this. It is one API call, for a role with the duty *Adjust stock* (Admin by default).

**For developers:**

```
POST /api/v1/inventory/movements/adjust/
{ "fabric": 7, "quantity": "-25.50", "note": "Physical count 2026-10-01" }
```

| Field | Meaning |
|---|---|
| `fabric` | The lot's number. |
| `quantity` | Positive adds stock, negative removes it. |
| `note` | The reason. Required. |

| Refusal | Why |
|---|---|
| "A reason is required for stock adjustments." | `note` is empty. |
| "Adjustment would make on-hand stock negative." | The lot does not hold that much. |
| "Quantity cannot be zero." | — |
| "Fabric lot not found." | Wrong lot number. |

The adjustment is written to the audit log. One larger than 500 kg appears in the bell for 7 days (rule "Unusual stock adjustments").

### Check the ledger: `reconcile_inventory`

This command compares the stock ledger with the records it is built from. Whoever runs the server runs it.

```
docker compose exec backend python manage.py reconcile_inventory          # report only
docker compose exec backend python manage.py reconcile_inventory --fix    # also repair the ledger
```

Without Docker: `python manage.py reconcile_inventory` in the `backend/` folder.

It prints the number of lots checked and three checks:

| Line in the output | What it checked | What a finding means |
|---|---|---|
| "Ledger differs from source records" | For each lot: completed drying output − dispatches + approved restocked returns + adjustments, against the ledger's total. A finding reads "fabric #7: sources say 1,200.00 kg, ledger has 1,150.00 kg". | The ledger is out of step with the records. This should not happen in normal use; it points to records changed outside the application (for example directly in the database). `--fix` repairs it. |
| "Negative on-hand stock" | Lots whose ledger total is below zero. | More was dispatched or adjusted out than was ever dried. Find the wrong dispatch, session or adjustment. `--fix` does not change this. |
| "Reserved more than on hand (oversold)" | Lots where confirmed orders need more than is in stock. A finding reads "fabric #7: short by 50.00 kg". | The same condition as the bell's "More reserved than on hand". Dry more, or cancel or reduce an order. `--fix` does not change this. |

A check with nothing to report prints "✓ …: none".

What `--fix` does: when the first check found differences, it goes through every drying session, dispatch and sales return and posts the missing difference to the ledger. It then prints "Ledger re-synced with drying sessions, dispatches and returns." It never deletes movements and never touches adjustments.

Run the report once a week, and after restoring a backup. The deployment guide gives a cron line for it. See [Deployment](12-deployment.md).

## Finance

| Symptom | Cause | Fix |
|---|---|---|
| A sale is missing from the journal and the statements | A sale reaches the books when it is **invoiced**, not when it is ordered or dispatched. | Sales → order → ⋯ → **Raise invoice**. Then Finance → **Update books**. |
| A purchase is missing from the books | A purchase reaches the books when the **supplier's invoice** is entered. | Purchasing → **Record invoice**. Then **Update books**. |
| "Accounts receivable" differs from what the Sales page says customers owe | The Sales page counts every Confirmed, Dispatched and Completed order. The books count invoices. | Normal. The gap is orders not yet invoiced. |
| A change in Sales or Purchasing is not in the journal yet | The automatic entries are brought up to date by **Update books**, by opening a statement, and when an expense is saved. | Press **Update books**. |
| "*October 2026* is closed. Reopen the period or use a later date." | The date falls in a closed period. | Use a date in an open period, or reopen the period (Finance → Setup → ⋯ → **Reopen**), make the entry, and close it again. |
| "*N* change(s) fall in a closed period and were left as they are." | Sales or purchasing records dated in a closed period changed after closing. Their entries were not posted or changed. | If they must go into the books: reopen the period, press **Update books**, close again. |
| "The entry does not balance: debits Rs. *N*, credits Rs. *M*." / "Debits and credits must be equal." | The lines of a typed-in entry do not add up. | Correct the amounts. |
| "An entry needs at least two lines." / "Each line needs either a debit or a credit." / "Enter a debit or a credit, not both." | — | Correct the lines. |
| A journal entry cannot be edited or deleted | By design. | Reverse a typed-in entry: ⋯ → **Reverse**. |
| "This entry was posted from a *sales invoice*. Change that record instead." | Automatic entries follow their record. | Correct or delete the invoice, payment, return or expense, then **Update books**. |
| "This entry has already been reversed." / "This entry is itself a reversal." | — | Type a new entry if another correction is needed. |
| "Automatic postings use this account, so it can't be deleted." / "… so it stays active." | The account is one of the nine the automatic entries use (cash, bank, receivable, payable, sales, sales returns, sales tax, purchases, purchase tax). | Rename it if you wish. It cannot be deleted or switched off. |
| "This account has entries. Mark it as not in use instead." | — | Edit the account and set "In use" to No. |
| "The type can't change once the account has entries." | — | Create a new account of the right type. |
| "Only an asset account can be a cash or bank account." | — | Set the type to Asset, or "Cash or bank" to No. |
| "Choose an expense account." / "Choose a cash or bank account." | An expense needs an account of the type Expense, and must be paid from an account marked as cash or bank. | Choose the right accounts. |
| A customer payment landed in "Bank account" instead of "Cash in hand" | The method decides: **Cash** goes to Cash in hand; every other method goes to Bank account. | Correct the payment's method on the Sales page, then **Update books**. |
| "These dates overlap *October 2026*." | Periods cannot overlap. | Correct the dates. |
| "Reopen the period before changing it." / "… before deleting it." | A closed period is locked. | Reopen it first. |
| Costing shows no cost per kg | Cost per kg = total cost ÷ dried output of the period. No drying session was completed in it. | Choose a period with completed drying. |
| A statement shows the badge "Does not balance" | This should never happen: every entry is checked to balance before it is saved. | Tell whoever maintains the system, with the statement and its date. |
| The Finance page feels slow | Opening the dashboard or any statement first brings the books up to date, which reads every invoice, payment, return and expense. | Normal for large data sets. See [Slow or unreachable system](#slow-or-unreachable-system). |

## Documents and uploads

| Symptom | Cause | Fix |
|---|---|---|
| There is no **Upload document** button | No category that is in use is open to your role. | An Admin opens a category to your role: Documents → Categories → ⋯ → Edit. |
| "Choose a file to upload." | No file was picked. | Pick one. |
| "The file is too large. The limit is 10 MB." | The file is over the limit (10 MB unless the setting was changed). | Make the file smaller, or split it. To raise the limit, see the note below. |
| "The file is too large." (without a number) | The front server refused the upload before it reached the application. Its own limit is 20 MB. | As above. |
| "The file is empty." | The file has no content. | Check the file. |
| "This type of file is not allowed. Allowed types: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt." | Other types are refused. | Save or export the file as one of these types, for example as PDF. |
| "The content of this file is not a real .*pdf* file." | The file's name says one type, but its content is another. Often the file was only renamed. | Open the file in its real program and save it properly in an allowed type. |
| "Choose a category you have access to." / "This category is no longer in use." | — | Choose another category. |
| "The expiry date can't be before the issue date." / "Say which record this document belongs to." | — | Correct the form. |
| "You are signed out. Sign in again to upload." | The session ended while the form was open. | Sign in again and upload again. |
| "Only an admin or the person who uploaded this document can change it." | You can add a version or edit details only on your own documents. | Ask the uploader or an Admin. |
| A document still shows **Expired** after a new version was uploaded | The expiry date belongs to the document, not to a version. | ⋯ → **Edit details** → set the new "Expires on". |
| "The file of this document is missing from storage." | The record exists but the file is gone. Usually the database was restored without the uploaded files, or the files' volume was lost. | Restore the files backup that belongs to the database backup. See [Deployment](12-deployment.md). |
| "This version does not exist." | The link points to a version number the document does not have. | Open ⋯ → **Versions** and choose from the list. |
| A category cannot be deleted | It still holds documents. | Move or delete the documents first (Admin), or set the category to "not in use". |
| "Download failed (*N*)." | The download did not complete. | Try again. If it repeats, see [Slow or unreachable system](#slow-or-unreachable-system). |

To raise the upload limit: set `DOCUMENT_MAX_UPLOAD_MB` for the backend. If the new limit is above 20 MB, also raise `client_max_body_size` in `frontend/nginx.edge.conf`. See [Configuration](11-configuration.md).

Uploaded files are checked for type and size. They are not scanned for viruses.

## Notifications

| Symptom | Cause | Fix |
|---|---|---|
| A supervisor's bell is empty although problems exist | A role other than Admin sees an item only if the rule lists the role **and** the user can open the page the rule is about. | Approvals → Rules → ⋯ → Edit → "Who receives it". If the role is not offered there, it cannot open the page behind the rule; give it the page first. |
| "This can't be sent to: *sorting supervisor*. That role has no access to the records behind this rule." | The same. | Give the role the page, or leave the rule with the Admins. |
| An item does not go away after it was marked as read | By design. Marking as read only quiets the bell's counter. The item stays listed, dimmed, until the problem itself is solved. | Solve the problem (restock, release, pay, renew …). |
| Items marked as read are unread again on another computer | Read marks are kept in the browser, per user. | Mark them again there. |
| A problem that was solved is still listed | The list refreshes every minute and when the browser tab gets focus. | Wait a minute or reload. |
| An expected kind of alert never appears | The rule is switched off, or its threshold is not reached. "Low dried stock" starts switched off. | Approvals → Rules. |
| "Notifications could not be loaded." | The bell could not reach the server. | Press **Try again**. If it repeats, see [Slow or unreachable system](#slow-or-unreachable-system). |
| Threshold refused: "This rule has no number to set." / "Enter a number." / "The number can't be negative." / "A percentage can't be more than 100." | — | Correct the number. |
| No digest e-mail arrives | Nothing is sent by itself. The command `send_alert_digest` must be run by the server's scheduler. | See [Deployment](12-deployment.md). Then check the three rows below. |
| The digest command prints "MANAGEMENT_EMAIL is not set; nothing sent." | No recipient is set. | Set `MANAGEMENT_EMAIL` for the backend and restart it. |
| The digest command prints "Nothing to report; nothing sent." | No rule is marked "Send by e-mail", or the marked rules have no open items. | Approvals → Rules → Edit → "Send by e-mail" = Yes. |
| E-mails appear in the backend's log instead of being sent | `EMAIL_HOST_USER` is empty, so the system prints e-mails to the console. | Set the e-mail settings. See [Configuration](11-configuration.md). |
| The daily or monthly report prints "✗ Daily summary failed: MANAGEMENT_EMAIL is not set in .env; cannot send report." | No recipient is set. | As above. Reports → Report centre → "Scheduled e-mail reports" also says whether a recipient is set. |
| No e-mail for a low chemical | The e-mail is sent once, when an issuance first takes a chemical below 25% of its total. Later issuances do not repeat it. | The bell and the daily report list everything that is still low. |

## Slow or unreachable system

**For administrators:** note what you see (the exact message, the page, the time) and pass it to whoever runs the server. The steps below are for that person.

### Check the health endpoint

The API answers a small "is it up" check that shows nothing sensitive.

| Address | Answer when healthy | Answer when the database cannot be reached |
|---|---|---|
| `http://<server>:8080/api/health/` (Docker; the port is `APP_PORT`) | `200` with `{"status": "ok", "database": "ok"}` | `503` with `{"status": "error", "database": "unreachable"}` |
| `http://127.0.0.1:8000/api/health/` (without Docker) | the same | the same |

Open it in a browser, or run `curl -i http://localhost:8080/api/health/` on the server.

Docker uses the same check. `docker compose ps` shows the backend as `healthy` or `unhealthy`. It is checked every 30 seconds; five failures in a row mark it unhealthy. After a start it is given 40 seconds before failures count.

### Read the logs

| Command | What it shows |
|---|---|
| `docker compose ps` | Which of the four parts are running: `db`, `backend`, `app`, `app-edge`. |
| `docker compose logs -f backend` | The API: every request, errors with their details, and e-mails when they are printed instead of sent. |
| `docker compose logs -f app` | The web app. |
| `docker compose logs -f app-edge` | The front server: who requested what. |
| `docker compose logs -f db` | The database. |

The backend's detail level is set with `LOG_LEVEL` (default `INFO`). See [Audit and logging](14-audit-and-logging.md).

### Symptoms

| Symptom | Likely cause | Fix |
|---|---|---|
| The site does not open at all | A container is stopped, or the port is wrong or blocked. | `docker compose ps`. Start what is stopped with `docker compose up -d`. Check `APP_PORT` (default 8080) and the firewall. |
| The health check answers `503` | The API cannot reach the database. | `docker compose ps` and `docker compose logs db`. Check that the database password in the root `.env` (`POSTGRES_PASSWORD`) has not changed since the database was first created. |
| The health check answers `400` | The address used is not in `ALLOWED_HOSTS`. | Add the server's name to `ALLOWED_HOSTS` and restart. See [Configuration](11-configuration.md). |
| The backend keeps restarting | It stops on start-up. Common causes: `SECRET_KEY` is missing from `backend/.env`; the database is not ready or the password is wrong; a database migration failed. | `docker compose logs backend` shows the reason in its last lines. |
| The site opens but every page shows an error box | The web app cannot reach the API. | Check that `backend` is healthy. In Docker the app calls `http://backend:8000`; that name must be accepted by the API (`INTERNAL_HOSTS: backend` in `docker-compose.yml`). |
| One page shows "Request failed (500)." | An error inside the API. | `docker compose logs backend` at that time shows the error. Pass it to the developer. |
| A figure under "Business at a glance" shows "Not available" | That module's figures failed; the others are still shown. | The backend log has a line "Executive dashboard: the … figures failed" with the error. |
| "The trace could not be loaded." | The Traceability page got an unexpected error. | Press retry; then check the backend log. |
| Pages that list many records are slow | Lists are loaded whole. With years of data, the Dashboard, Sales and Warehouse pages read every delivery, session and order. | Use the date filters on the page. Check the server's memory and processor. The number of API workers is set with `GUNICORN_WORKERS` (default 3). |
| The Finance page and its statements are slow | Each one first brings the books up to date. | Normal with many records. Close past periods: their entries are then left alone. |
| Exports or reports are cut off before they finish | A very long request is stopped by the servers in front of the application (the front server waits at most 120 seconds). | Choose a shorter period. |
| The disk is full | The database, the uploaded documents and the backups all grow. | Free space. Backups keep the newest 14 of each kind by default. See [Deployment](12-deployment.md). |
| Times on the screen are off by some hours | The server works in the time zone `Asia/Karachi` (set in `backend/config/settings.py`). | A developer changes `TIME_ZONE` if the factory is elsewhere. |

## After an update

Updating is described in [Deployment](12-deployment.md). In short: take a backup, get the new version, run `docker compose up -d --build`, and check `docker compose ps`. Database changes are applied by the backend each time it starts.

| Symptom | Cause | Fix |
|---|---|---|
| The backend does not become `healthy` | A database change failed, or a new required setting is missing. | `docker compose logs backend`. Fix the cause and start again. |
| The screens look as before, or look broken | The browser still holds the old version of the pages. | Reload with Ctrl + F5. |
| Everyone has to sign in again | Sessions survive an update. They end only if `SECRET_KEY` was changed. | Keep `SECRET_KEY` the same across updates. |
| A new page is missing from the supervisors' menus | A new page starts with the access its release gives it, often Admin only. | Users → Access: give the page to the roles that need it. |
| Settings you changed (notification rules, document categories, accounts, stages) are still as you left them | The starting data is only added when it is missing. An update does not overwrite your changes. | Nothing to do. New rules or categories from the update appear beside yours. |
| Stock figures look wrong after an update or a restore | — | Run `reconcile_inventory` (see [Stock figures](#stock-figures)). |
| Documents cannot be downloaded after a restore | The database was restored without the files. | Restore the files backup too. |
| The new version must be taken back | A newer database does not always work with older code. | Check out the previous version, rebuild, and restore the backup taken before the update. |

After every update, check: the health endpoint answers "ok"; you can sign in; the Dashboard loads; one record can be saved; a document can be downloaded.

## For developers

How messages reach the screen:

| Step | Code |
|---|---|
| Rules raise `ValidationError` (HTTP 400) or `PermissionDenied` (403) with the message. | `backend/apps/<app>/services.py`, `serializers.py`, `views.py` |
| A blocked delete (`ProtectedError`) becomes a readable 409. | `backend/apps/core/exceptions.py` |
| Page access is checked before every view's own permissions. | `backend/apps/access/services.py` (`check_api_access`), hooked in `backend/apps/access/apps.py` |
| The browser client turns an error body into one sentence: the `detail` text, or all messages joined. A 401 sends the browser to `/login?next=…`. | `frontend/src/lib/api.ts` (`errorMessage`, `ApiError`) |
| Forms put a message under its field when the field name matches; the rest goes to the top of the form. | `frontend/src/lib/forms.ts` (`applyServerErrors`) |
| Delete questions keep the dialog open and show the refusal. | `frontend/src/components/common/confirm-dialog.tsx` |
| The route guard sends users without a page to `/`, and users without a session to `/login`. | `frontend/src/proxy.ts`, `frontend/src/config/access.ts` |
| The API proxy renews the session once on a 401, and blocks cross-site requests. | `frontend/src/app/api/django/[...path]/route.ts`, `frontend/src/lib/server/session.ts` |

Other references: the health view is `backend/apps/core/health.py` (route `api/health/` in `backend/config/urls.py`); the container health check and the service names are in `docker-compose.yml`; the front server's limits are in `frontend/nginx.edge.conf`; the reconcile command is `backend/apps/inventory/management/commands/reconcile_inventory.py`; logging is set up at the end of `backend/config/settings.py`.

To find a message in the code, search the repository for a few of its words. Messages built from parts (for example the quarantine message in `backend/apps/quality/services.py`) are best found by their fixed words, such as "is in quarantine after failing inspection".

## Keeping this page up to date

- **Messages:** search `backend/apps` for `ValidationError(`, `PermissionDenied(`, `NotFound(` and `message =`, and `frontend/src` for `toast.error(`, `setError(` and the `message:` texts in each `schemas.ts`. A quoted message on this page must match the code word for word.
- **Signing in and sessions:** `backend/apps/users/views.py`, `frontend/src/features/auth/login-form.tsx`, `frontend/src/lib/server/session.ts`, `frontend/src/proxy.ts`, and the `SIMPLE_JWT` and throttle settings in `backend/config/settings.py`.
- **Stock:** `backend/apps/inventory/services.py` and `backend/apps/inventory/management/commands/reconcile_inventory.py`.
- **Health, logs and limits:** `backend/apps/core/health.py`, `docker-compose.yml`, `frontend/nginx.edge.conf`, `backend/Dockerfile`.
- **Uploads:** `backend/apps/documents/services.py` (`validate_upload`, `CONTENT_TYPES`) and `frontend/src/features/documents/schemas.ts`.
