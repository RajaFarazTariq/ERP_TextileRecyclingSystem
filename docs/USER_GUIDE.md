# User guide

A short guide to doing the daily work in the ERP. The business rules behind each step are in the README.

## Getting around

- **Sidebar:** the pages your role can open.
- **Search (Ctrl + K):** jump to a page or a tab, or type a name or number (a supplier, a customer, `PO-00012`) to find a record.
- **Bell:** things that need attention. Tick an item, or "Mark all as read".
- **Sun / moon:** light or dark theme.
- **Tables:** search box, column sorting, "Columns" to show or hide, "Export" to download. The "⋯" at the end of a row holds its actions.
- **Forms** open on the right. A red message under a field says what to fix.

## Who does what

| Role | Pages |
|---|---|
| Admin | Everything, plus approvals, sales, finance, workforce, reports and users |
| Warehouse supervisor | Warehouse, Purchasing, Quality, Maintenance, Sustainability, Documents, Traceability |
| Sorting supervisor | Sorting, Production, Quality, Maintenance, Sustainability, Documents, Traceability |
| Decolorization supervisor | Decolorization, Production, Quality, Maintenance, Sustainability, Documents, Traceability |
| Drying supervisor | Drying, Production, Quality, Maintenance, Sustainability, Documents, Traceability |

These are the pages each role starts with. An admin can change them, for a role or for one person, under **Users → Access**.

## The flow of material

**Buy → receive → inspect → sort → decolorize → dry → sell.**

1. **Purchasing** (warehouse, admin). Raise a *request*; an admin approves it; raise a *purchase order* from it; an admin approves the order.
2. **Warehouse.** When the truck arrives, add a *stock entry* with the weights and, if there is one, the purchase order. The order's status updates by itself.
3. **Quality.** Record an *incoming inspection* on the delivery. If it fails, the delivery is in *quarantine* and can't be used until an admin releases it with a reason.
4. **Sorting.** Create a *fabric lot* from the delivery, start a *session*, and complete it with the sorted and waste weights.
5. **Decolorization.** Start a *session* in a tank; pick a *recipe* if there is one. *Issue chemicals* to the tank: they come out of stock and are added to the running batch. Complete the session with output and waste. "Chemicals used" on the session shows planned against issued, and the cost.
6. **Drying.** Start a *session* on a dryer from a decolorized batch and complete it. The dried output becomes stock that can be sold.
7. **Sales** (admin). Optional *quotation* → the customer accepts → *order* (Draft). *Confirm* reserves the stock. *Dispatch* ships it (in parts if needed) and prints a delivery challan. *Raise invoice* for what was dispatched. *Record payment*. If goods come back, *Record return*; an admin approves it.

**Production orders** (Production page) plan this journey for a lot: an admin plans and releases the order, supervisors start and complete its stages, and the order shows planned against actual output, time and cost. Production orders don't move stock; the sessions above do.

**Traceability** shows the whole journey of one lot on a single page, from the supplier to the customer.

## Common tasks

### Something is waiting for approval (admin)
Open **Approvals**. Each tab lists one kind: purchase requests and orders, quarantine releases, production orders, sales returns, batches, leave. Approve or reject there.

### A machine broke down (anyone)
**Maintenance → Report breakdown.** Pick the machine and describe the problem. Whoever fixes it presses *Start*, then *Complete* with the work done, the time the machine was stopped and the cost. Parts used come out of the spare-parts stock.

### Mark attendance (admin)
**Workforce → Attendance.** Pick the date and shift, set each person's status and times, then *Save attendance*. People on approved leave already show as "Leave".

### Record an expense (admin)
**Finance → Record expense.** Choose the expense account, what it was paid from, and the part of the factory it belongs to. The journal entry is made for you. Supplier invoices and customer payments are not entered here: they come from Purchasing and Sales.

### See the money position (admin)
**Finance → Dashboard** for cash, who owes what and this month's result. **Statements** for profit and loss, balance sheet, trial balance and cash flow. **Costing** for cost per kg. Press *Update books* if you have just changed sales or purchase records.

### Close a month (admin)
**Finance → Setup → New period**, then *Close period*. Entries dated in a closed period can no longer change. *Reopen* undoes it.

### Record waste or a meter reading
**Sustainability → Add waste record** or **Utilities → Add reading.** The recovery and waste rates on the dashboard are calculated from the sessions; nobody types them in.

### Keep a certificate or data sheet
**Documents → Upload document.** Choose the category (it decides who can see the file), and the expiry date if it has one. *New version* replaces the file but keeps the old one. The **Expiring** tab lists what runs out soon.

### Print something
Sales: *Print challan* on a dispatch and *Print invoice* on an invoice. Reports and Traceability have a *Print* button. Use the browser's "Save as PDF" to keep a copy.

### Give someone access to a page (admin)
**Users → Access.** To change a whole role, tick or untick the page in the grid and press *Save changes*. To change one person, choose them under "Exceptions for one person", set the page to *Give access* or *Take away*, and press *Save exceptions*. It applies from that person's next page; they don't need to sign in again. A page lets someone use that part of the system, but approvals stay with admins.

### Find out who changed a record (admin)
**Reports → Audit log.** Filter by person, module or date.

## When something is refused

The system stops a few things on purpose and says why:

- **"Only … kg of dried stock is available"**: the order is bigger than the sellable stock. Save it as a Draft until more is dried.
- **Quarantine**: the material failed inspection. An admin releases it on the Quality page.
- **"Not enough stock"** when issuing a chemical or using a spare part: receive more first.
- **"… is closed"** in Finance: the date falls in a closed period. Use a later date or reopen the period.
- **"Records that depend on it can't be deleted"**: the record is used elsewhere. Mark it as not in use instead.
- **You can't see a page, or you are sent back to the home page**: you don't have that page. Ask an admin (Users → Access).
