# Frequently asked questions

Forty short answers to the questions administrators and users ask most often. Each answer was checked against the code and links to the page that explains it in full. It is for everyone who uses the system.

## On this page

- [Signing in and getting around](#signing-in-and-getting-around)
- [Access and approvals](#access-and-approvals)
- [Material and stock](#material-and-stock)
- [Quality](#quality)
- [Purchasing](#purchasing)
- [Sales](#sales)
- [Finance](#finance)
- [Notifications and e-mail](#notifications-and-e-mail)
- [Documents](#documents)
- [People and the environment](#people-and-the-environment)
- [Records and history](#records-and-history)
- [Running the system](#running-the-system)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## Signing in and getting around

### 1. I forgot my password. What do I do?

Ask an Admin. There is no "forgot password" link and the system sends no password e-mails. The Admin opens Users, edits your account, types a new password and gives it to you. You cannot change your own password either; that is also done by an Admin. See [Admin guide: Reset a password](06-admin-guide.md#reset-a-password).

### 2. How do I find a record quickly?

Press Ctrl + K, or click "Search or jump to…" in the header, and type at least two characters. You can type a name or a number, with or without its prefix (`PO-00012`, `po-12` and `#15` all work). The search only returns kinds of record whose page you can open, and shows up to six results per kind. See [Search and traceability](07-modules/search-and-traceability.md).

### 3. Why am I sent back to the home page when I open a page?

You do not hold that page. The menu shows only your pages, and typing another page's address sends you home. Ask an Admin to give the page to your role or to you. See [Access control](05-access-control.md) and [Troubleshooting: Access](15-troubleshooting.md#access-and-being-sent-back-to-the-home-page).

### 4. What does the "View only" badge at the top of a page mean?

You hold the page at the level View only. You can look at everything on it, but the add buttons are gone and the row menus offer only things that show something, such as Download, Statement or Print. The server also refuses any change. See [Access control](05-access-control.md).

## Access and approvals

### 5. Why can a supervisor open a page but not approve anything on it?

Opening a page and approving are separate. Approving, releasing, paying and similar actions need a **duty**, and at the start only the Admin carries most duties. An Admin can give a duty to a role. See [Access control](05-access-control.md) and [Workflows: Approvals at a glance](08-workflows.md#approvals-at-a-glance).

### 6. Where do I see everything that is waiting for a decision?

On the **Approvals** page. It has one tab for each kind: purchase requests, purchase orders, quarantine, production orders, sales returns, decolorization batches and leave requests. Deciding there does the same as deciding on the module's own page. See [Admin guide: The Approvals inbox](06-admin-guide.md#the-approvals-inbox).

### 7. Can an approval need two people, or depend on the amount?

No. Every approval is one decision by one person, whatever the amount. Approval chains and amount limits are not built. See [System overview: What the system does not do](01-system-overview.md#what-the-system-does-not-do).

### 8. What can never be handed to anyone but an Admin?

The Users page (user accounts, roles and access), notification rules, merging customers, quality standards, waste categories and targets, document categories, and deleting inspections, work orders, waste records, utility readings and documents. The last active Admin can also not be demoted, deactivated or deleted. See [Admin guide: What only an Admin can do](06-admin-guide.md#what-only-an-admin-can-do).

## Material and stock

### 9. Why can't I sell material that has been sorted or decolorized?

Only dried output can be sold. Sellable stock comes from completed drying sessions and nowhere else. Complete the drying session with its dried output, and the lot will have stock. See [Workflows: Drying](08-workflows.md#6-drying-and-how-stock-becomes-sellable).

### 10. What is the difference between "on hand", "reserved" and "available"?

**On hand** is what the stock ledger holds for a lot. **Reserved** is the weight that Confirmed and Dispatched orders have not dispatched yet. **Available** is on hand minus reserved, and it is what a new order can be confirmed against. See [Inventory](07-modules/inventory.md).

### 11. What is a "lot", and how is it different from a delivery?

A delivery is one truckload received at the warehouse. A fabric lot is a quantity of one material made from a delivery on the Sorting page; one delivery can be split into several lots. The lot is what sessions, production orders, inspections and sales orders point to. A **chemical lot** is something else: a received batch of a chemical. See [System overview: Glossary](01-system-overview.md#glossary).

### 12. How do I correct stock after a physical count?

First correct any wrong session or dispatch; the stock ledger follows those records by itself. If the records are right and the count still differs, the correction is an **adjustment** with a required reason. It needs the duty *Adjust stock* (Admin by default) and has no screen: it is an API call. See [Troubleshooting: Stock figures](15-troubleshooting.md#stock-figures).

### 13. Does a production order move stock?

No. A production order is a plan and a cost record for one lot. The sorting, decolorization and drying sessions do the real work, and only a completed drying session adds sellable stock. See [Workflows: A production order](08-workflows.md#7-a-production-order-from-plan-to-completion).

## Quality

### 14. Does every delivery have to be inspected?

No. Material that was never inspected is not held and can be used as usual. Only a **Fail** result puts a delivery or lot in quarantine. See [Quality](07-modules/quality.md).

### 15. What does quarantine block?

A quarantined delivery cannot be made into a fabric lot. A quarantined lot cannot start a sorting, decolorization or drying session, cannot be released or worked on in a production order, and cannot be confirmed or dispatched on a sales order. A lot is also held when the delivery it came from is held. See [Workflows: Quarantine](08-workflows.md#3-incoming-inspection-quarantine-and-release).

### 16. Who can release material from quarantine?

A user whose role carries the duty *Release quarantine*, which is the Admin by default. A reason is required and is kept on the inspection. After the release the inspection can no longer be changed. See [Workflows: Quarantine](08-workflows.md#3-incoming-inspection-quarantine-and-release).

## Purchasing

### 17. Can I record a delivery without a purchase order?

Yes. The "Purchase order" field on a delivery is optional. When it is filled in, the order's status follows the weight received: Partially Received, then Received. See [Workflows: Receiving a delivery](08-workflows.md#2-receiving-a-delivery).

### 18. What happens when I change an approved purchase order?

It becomes an amendment. The revision number goes up by one, the order goes back to Submitted, and it needs approval again. Changing only the notes does not count. A line cannot be reduced below what has already been received. See [Purchasing](07-modules/purchasing.md).

## Sales

### 19. Does a customer's credit limit stop an order?

No. Going over the limit shows a warning when the order is entered and when it is confirmed, and the order is saved or confirmed anyway. Customers over their limit are also listed in the bell. See [Sales](07-modules/sales.md).

### 20. Why was my order refused with "Only … kg of dried stock is available"?

Confirming an order reserves its weight, and the lot does not have that much free. Free stock is what is on hand minus what other confirmed orders have reserved. Keep the order as a Draft until more is dried, lower the weight, or choose another lot. See [Troubleshooting: Stock figures](15-troubleshooting.md#stock-figures).

### 21. Why is my order still "Confirmed" after I dispatched it?

Dispatching takes the weight out of stock but does not change the order's status. The order becomes **Completed** when a dispatch is marked as delivered. Marking one dispatch as delivered completes the whole order, so for an order that goes out in parts, mark only the last one. See [Workflows: Sales](08-workflows.md#8-quotation-to-order-to-dispatch-to-invoice-to-payment).

### 22. Payments are recorded on the order. How does an invoice become "Paid"?

An order's payments, and its credits for approved returns, settle its invoices oldest first. Each invoice's status is worked out from that: Paid, Partial, Unpaid, or Overdue when it is not fully paid after its due date. The due date is the invoice date plus the customer's payment terms. See [Sales](07-modules/sales.md).

### 23. The same customer is in the list twice. How do I fix it?

Open Sales → Customers. A box "Possible duplicates" lists names that look alike. On the customer to remove, choose ⋯ → **Merge into…** and pick the one to keep; the orders and quotations move over and the first customer is removed. Only an Admin can merge. See [Sales](07-modules/sales.md).

### 24. What happens when a customer sends goods back?

Record a return on the order, with the weight, the reason, and whether the goods go back into sellable stock or are written off. Nothing changes until it is approved. Approval credits the customer at the order's price, updates the order's payment status and, if chosen, adds the weight back to stock. See [Workflows: A customer return](08-workflows.md#9-a-customer-return).

## Finance

### 25. Why is a sale missing from the profit and loss statement?

A sale reaches the books when it is **invoiced**, not when it is ordered or dispatched. Raise the invoice on the Sales page, then press **Update books** on the Finance page. For the same reason "Accounts receivable" can differ from what the Sales page says customers owe. See [Finance](07-modules/finance.md).

### 26. Can I edit or delete a journal entry?

No. A wrong typed-in entry is **reversed**, which posts its mirror image and keeps both. An automatic entry follows its record: correct the invoice, payment, return or expense, then press **Update books**. See [Workflows: Month-end](08-workflows.md#14-month-end-in-finance).

### 27. What does closing a period do, and can it be undone?

Closing locks every journal entry dated inside the period: none can be added, changed or removed. Records that change later are left out of the books and reported as skipped. A closed period can be reopened, and closed again afterwards. See [Admin guide: Close a financial period](06-admin-guide.md#close-a-financial-period).

### 28. Is this a statutory accounting or tax system?

No. Finance supports the business's own bookkeeping: a journal, statements and costing. Tax rates are a reference list; the tax % is typed on each order or invoice. Payroll is not part of the system. See [System overview: What the system does not do](01-system-overview.md#what-the-system-does-not-do).

## Notifications and e-mail

### 29. Why does a notification stay in the bell after I mark it as read?

Marking as read only quiets the counter on the bell. The item stays listed, dimmed, until the problem itself is solved, because notifications are worked out from live records. Read marks are kept in your browser, so another computer shows the item as unread again. See [Approvals and notifications](07-modules/approvals-and-notifications.md).

### 30. Why does a supervisor not see an alert the Admin sees?

An Admin sees every alert. Another role sees one only if the notification rule lists that role and the user can open the page the rule is about. Rules are set under Approvals → Rules. See [Admin guide: Notification rules](06-admin-guide.md#notification-rules).

### 31. Does the system send e-mails by itself?

Partly. When a management address is set, an e-mail is sent at once when a dispatch is given the status Dispatched, when an order becomes Completed, when a customer payment is recorded, and when a chemical first drops below 25% of its stock. The alert digest and the daily and monthly reports are commands that the server's scheduler must run. All e-mails go to that one management address; users get none personally. See [Configuration](11-configuration.md) and [Deployment](12-deployment.md).

## Documents

### 32. Which files can I upload, and how large?

pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv and txt, up to 10 MB unless the limit was changed. The system also checks that the content really is that type, so a renamed file is refused. Files are not scanned for viruses. See [Documents](07-modules/documents.md).

### 33. Who can see a document I upload?

Everyone whose role is listed on the document's category, and every Admin. A role that may not see a category does not see its documents anywhere, including search. Only you and Admins can add a new version or edit its details, and only an Admin can delete it. See [Documents](07-modules/documents.md).

### 34. Does uploading a new version replace the old file?

No. A new version is added beside the old ones, and every version stays downloadable under ⋯ → **Versions**. The expiry date belongs to the document, so set the new date with **Edit details** after renewing a certificate. See [Workflows: Documents](08-workflows.md#13-uploading-a-document-and-a-new-version).

## People and the environment

### 35. Does approving leave mark the person's attendance?

No. Approved leave makes the attendance sheet start that person as "Leave" on those days. Someone still has to save the sheet for the day. See [Workflows: Attendance and leave](08-workflows.md#11-attendance-and-leave).

### 36. Where do the recovery rate and the other sustainability percentages come from?

They are calculated from records the factory already keeps: sessions, deliveries, waste records, utility readings and chemical issuances. Nothing is typed in as a percentage. Short periods can read high or low, because material sorted in one month may be dried in the next. See [Sustainability](07-modules/sustainability.md).

## Records and history

### 37. Someone has left the company. Should I delete their account?

No. Deactivate it: Users → ⋯ → **Deactivate**. The person can no longer sign in, and their name stays on the work they recorded. A user who has recorded work cannot be deleted anyway. See [Admin guide: Deactivate someone who leaves](06-admin-guide.md#deactivate-someone-who-leaves).

### 38. Can a deleted record be brought back?

No. Deleting removes the record for good; there is no recycle bin. The audit log keeps a line that says who deleted it and when. Many records refuse deletion while other records depend on them, and the right step is then to mark them as not in use. See [Audit and logging](14-audit-and-logging.md).

### 39. How do I find out who changed a record, or follow a lot from supplier to customer?

For changes, open Reports → **Audit log** and filter by record type, action and dates, or search for the user or the record. Each line shows who, when and the old and new values. For a lot's whole history, open **Traceability** and search for the lot by number, material, supplier, order or invoice. See [Admin guide: Read the audit log](06-admin-guide.md#read-the-audit-log) and [Workflows: Tracing a lot](08-workflows.md#15-tracing-a-lot).

## Running the system

### 40. How do I check that the system is up, and is the data backed up?

Open `/api/health/` on the site's address: it answers `{"status": "ok", "database": "ok"}` when the application can reach its database, and an error with the code 503 when it cannot. Backups are not automatic. A backup script saves the database and the uploaded documents, but the server's scheduler must run it, and the backup folder should be copied to another machine. See [Troubleshooting: Slow or unreachable system](15-troubleshooting.md#slow-or-unreachable-system) and [Deployment](12-deployment.md).

## Keeping this page up to date

- Each answer summarises another page of the manual. When that page changes, check the answer that links to it.
- **Sign-in and accounts:** `backend/apps/users/views.py`, `frontend/src/features/auth/login-form.tsx`.
- **Stock and sales answers:** `backend/apps/inventory/services.py`, `backend/apps/sales/services.py`, `backend/apps/sales/views.py`.
- **Notifications and e-mail:** `backend/apps/alerts/rules.py`, `backend/apps/notifications/signals.py`, `backend/apps/notifications/tasks.py`.
- **Limits quoted here** (10 MB uploads, 25% chemical stock, six search results per kind): `backend/config/settings.py`, `backend/apps/documents/services.py`, `backend/apps/notifications/tasks.py`, `backend/apps/search/finder.py`.
