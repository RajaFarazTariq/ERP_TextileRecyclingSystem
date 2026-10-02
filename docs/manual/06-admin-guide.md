# Admin guide

**For administrators.** This page explains the day-to-day work of an administrator: user accounts, access, approvals, notification rules, the master data a new organisation must enter before it starts, closing a financial period, the audit log, exports, and a checklist of routine work. Every step was checked against the screens.

## On this page

- [First sign-in](#first-sign-in)
- [Users](#users)
  - [Add a user](#add-a-user)
  - [Edit a user](#edit-a-user)
  - [Reset a password](#reset-a-password)
  - [Deactivate someone who leaves](#deactivate-someone-who-leaves)
  - [Change a role](#change-a-role)
  - [Delete a user](#delete-a-user)
  - [Safeguards on user accounts](#safeguards-on-user-accounts)
- [Where to manage access](#where-to-manage-access)
- [The Approvals inbox](#the-approvals-inbox)
- [Notification rules](#notification-rules)
- [Master data for a new organisation](#master-data-for-a-new-organisation)
- [Close a financial period](#close-a-financial-period)
- [Read the audit log](#read-the-audit-log)
- [Export data](#export-data)
- [Daily, weekly and monthly checklist](#daily-weekly-and-monthly-checklist)
- [What only an Admin can do](#what-only-an-admin-can-do)
- [For developers](#for-developers)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## First sign-in

A fresh installation is prepared with `python setup_fresh.py` (see [Deployment](12-deployment.md)). That script creates one account with the Admin role:

| Username | Password |
|---|---|
| `Test_User` | `Test@1234` |

These are well-known starting values. Change them before anyone else uses the system.

1. Open the site and sign in with the account above. You can type the username or the e-mail address.
2. Open **Users** in the menu (group "Administration").
3. Find your own row. It is marked **you**. Open the **⋯** menu at the end of the row and choose **Edit**.
4. Type a new **Password**. If you wish, change the **Username** and **Email** too. Press **Update**.
5. Press **Add user** and create a second account with the role **Admin** for another trusted person. With two Admins, access can still be managed when one is away.
6. Create an account for every person who will use the system. See [Add a user](#add-a-user).
7. Go through [Master data for a new organisation](#master-data-for-a-new-organisation).
8. Open **Approvals → Rules** and check the notification rules. See [Notification rules](#notification-rules).

What to know about the first account:

- It is the only account that can open the Django admin panel at `/admin/`. Accounts created on the Users page cannot, even with the Admin role. Keep this account, and keep its password safe.
- You cannot deactivate your own account or change your own role. The system refuses with "You can't deactivate your own account." and "You can't change your own role."
- If the installation was seeded with demo data, it also has the demo accounts `admin`, `warehouse_user`, `sorting_user`, `decolor_user` and `drying_user`. Never run the seed commands on a live system: `seed_demo_data` deletes the existing deliveries, lots, sessions, orders, suppliers and customers before it adds its own. A system meant for real use should start from a clean database.

## Users

The Users page has two tabs: **Users** and **Access**. The Users tab shows a count of accounts per role and a table with the columns Username, Email, Role, Status and Last login.

### Add a user

1. Open **Users**.
2. Press **Add user**.
3. Fill in the form:

   | Field | Required | Rules |
   |---|---|---|
   | Username | Yes | "Enter a username." Up to 150 characters. Must not already exist. |
   | Email | No | Must be a valid address if given. A user can also sign in with it. |
   | Password | Yes | "Set a password for the new user." The hint says "At least 8 characters, not too common". The server also refuses a password that is all digits or too close to the username or e-mail. |
   | Role | Yes | "Choose a role." The list holds every role under Users → Access, including roles you added. |
   | Account active (can sign in) | — | Ticked by default. |

4. Press **Create user**. The message "User created." appears.
5. Tell the person their username and password yourself. The system sends no e-mail.

The new user can sign in at once. What they can open comes from their role. See [Where to manage access](#where-to-manage-access).

### Edit a user

1. Open **Users**.
2. Open the **⋯** menu of the row and choose **Edit**.
3. Change the username, e-mail, role or the "Account active" tick.
4. Leave **Password** empty to keep the current password. The hint says "Leave blank to keep the current password".
5. Press **Update**. The message "User updated." appears.

### Reset a password

There is no "forgot my password" link and no reset e-mail. An Admin sets a new password.

1. Open **Users**.
2. Open the **⋯** menu of the person's row and choose **Edit**.
3. Type the new password in **Password**.
4. Press **Update**.
5. Give the new password to the person in a safe way.

The audit log records that the password was changed. It never records the password itself.

Users cannot change their own password. If someone wants a new one, an Admin does the steps above.

### Deactivate someone who leaves

Deactivate, do not delete. The person's history (sessions, orders, inspections) stays linked to their name.

1. Open **Users**.
2. Open the **⋯** menu of the row and choose **Deactivate**. The message "<username> deactivated." appears and the Status column shows **Inactive**.

To let the person in again, choose **Activate** from the same menu.

A deactivated user who tries to sign in sees: "This account is inactive. Contact your administrator."

If the person is also an employee in Workforce, open **Workforce → Employees**, edit the employee and set **Status** to **Left**. The two records are separate: the user account is the login, the employee record is the person.

### Change a role

1. Open **Users**.
2. Open the **⋯** menu of the row and choose **Edit**.
3. Choose the new **Role**.
4. Press **Update**.

The change applies from the person's next page or request. They do not need to sign in again.

Before you change a role, check two things:

- **Exceptions.** A person can have their own page levels on top of their role (Users → Access → "Exceptions for one person"). They are kept when the role changes. Review them.
- **Notification rules and document categories** list roles, not people. The person now receives what the new role receives.

### Delete a user

1. Open **Users**.
2. Open the **⋯** menu of the row and choose **Delete**.
3. Read the question. It says: "Users who have recorded work can't be deleted; deactivate them instead so their history stays."
4. Press **Delete**.

If the user has recorded anything, the system refuses with "This record cannot be deleted because other records depend on it: …" and lists the kinds of record. Deactivate the user instead.

### Safeguards on user accounts

| Rule | Message |
|---|---|
| You cannot deactivate your own account. | "You can't deactivate your own account." |
| You cannot change your own role. | "You can't change your own role." |
| You cannot delete your own account. | "You can't delete your own account." |
| The last active Admin cannot be demoted, deactivated or deleted. | "This is the only active admin. Make another user an admin first." |
| Only an Admin creates, changes or deletes users. | "Only admins can create users." / "Only admins can update or delete users." / "Only admins can toggle user status." |

## Where to manage access

Access is managed under **Users → Access**. Only an Admin can open the Users page, and that cannot be changed.

The Access tab has four parts, from top to bottom:

| Part | What it is for | Buttons |
|---|---|---|
| Roles | The list of roles, with the number of users in each. Built-in roles carry the badge "Built-in". | **Add role**; ⋯ → Edit or Delete on roles you added |
| Pages by role | The level each role holds on each page. | **Original access**, **Discard**, **Save changes** |
| Duties by role | Which role may approve, release, pay and so on. | **Original duties**, **Discard**, **Save duties** |
| Exceptions for one person | One person's own level on a page. | **Same as role**, **Discard**, **Save exceptions** |

In short:

- Each role holds each page at a level: **No access**, **View only** or **Full**.
- One person can be given more or less than their role on a page ("Exceptions for one person").
- Admins always have every page in full.
- **Duties** decide who may approve, release, pay and so on. Opening a page does not make someone an approver. A duty only works for a role that also holds the duty's page at Full.
- Admins can add roles of their own. The built-in roles cannot be renamed or deleted, but their pages and duties can be changed. A role that people still have cannot be deleted.
- A change applies from each user's next page. Nobody has to sign in again.
- Every change to access is written to the audit log.

The mechanics, the starting access of each role, duties and custom roles are explained in [Access control](05-access-control.md). The roles themselves are described in [Roles and responsibilities](04-roles-and-responsibilities.md).

## The Approvals inbox

The **Approvals** page lists everything that waits for a decision. It starts as an Admin-only page.

At the top are four figures: **Waiting for a decision**, **Oldest item**, **Waiting over a week** and **Notification rules on**. Below are the tabs, each with a count:

| Tab | What waits there | Buttons |
|---|---|---|
| Purchase requests | Requests with the status Submitted. | Approve, Reject (a reason is required) |
| Purchase orders | Orders with the status Submitted, including amended orders. | Approve |
| Quarantine | Failed inspections that have not been released. | Release (a reason is required) |
| Production orders | Orders with the status Draft. | Release |
| Sales returns | Returns with the status Requested. | Approve, Reject (a note is optional) |
| Decolorization batches | Completed sessions that have not been signed off. | Approve |
| Leave requests | Requests with the status Pending. | Approve, Reject (a note is optional on both) |
| Rules (Admins only) | The notification rules. See the next section. | — |

To decide an item:

1. Open **Approvals**.
2. Open the tab. The page opens on the first tab that has something waiting. Items waiting 7 days or more show their age in red.
3. To look at the record first, click its **Number**. It opens the page the record lives on.
4. Press the button on the row, for example **Approve**.
5. A panel opens with the title "Approve PR-00012?" (or the matching action and number).
   - If a reason is required, type it in **Reason**. Without it the panel says "Say why you reject it." or "Say why you release it."
   - If the field is called **Note**, it is optional.
   - If there is no field, the panel says "This is recorded under your name."
6. Press the button in the panel to confirm.

What to know:

- The inbox decides nothing itself. It calls the same action as the button on the module's own page, so the same rules and the same refusals apply. If the module refuses, its message is shown in the panel.
- The list refreshes by itself every minute and when you return to the browser tab.
- Every table can be searched and exported with **Export**.
- What each approval unlocks is listed in [Workflows → Approvals at a glance](08-workflows.md#approvals-at-a-glance).

## Notification rules

The bell in the header and the Dashboard's "Needs attention" list are driven by rules. Nothing is stored per notification: each rule looks at live records, so an item disappears by itself once the problem is solved.

Only an Admin can change the rules, and the **Rules** tab is shown to Admins only. Rules cannot be added or deleted.

### Change a rule

1. Open **Approvals** and the **Rules** tab.
2. Open the **⋯** menu of the rule and choose **Edit**. To only switch it, choose **Switch off** or **Switch on**.
3. In the panel, set:

   | Field | Meaning |
   |---|---|
   | Switched on | Yes or No. |
   | (the threshold) | Shown only for rules that have a number. Its label says what the number means, for example "Percent of total stock". |
   | Who receives it | Admins always receive it. Choose Yes or No for each other role. Only roles that can open the page behind the rule are listed. If none can, the panel says "Admins only. The records behind this rule are not open to other roles." |
   | Send by e-mail | Adds the rule's items to the e-mail digest. |
   | Escalate after days | An item open this long is marked "Escalated" and listed first. Empty means never. |

4. Press **Update**.

### The rules and their starting settings

| Rule | Starts | Number (meaning) | Also sent to (besides Admin) | Page it is about |
|---|---|---|---|---|
| Low chemical stock | On | 25 (percent of total stock) | Decolorization Supervisor | Decolorization |
| Spare parts to reorder | On | — | Every supervisor | Maintenance |
| Low dried stock | **Off** | 100 (kg free to sell per lot) | Drying Supervisor | Drying |
| More reserved than on hand | On | — | — | Sales |
| Purchases waiting for approval | On | — | — | Purchasing |
| Delayed production orders | On | 0 (days late before it is listed) | Sorting, Decolorization, Drying Supervisors | Production |
| Material in quarantine | On | — | Every supervisor | Quality |
| Overdue corrective actions | On | — | Every supervisor | Quality |
| Machine breakdowns | On | — | Every supervisor | Maintenance |
| Overdue preventive maintenance | On | 0 (days overdue before it is listed) | Every supervisor | Maintenance |
| Overdue customer invoices | On | 0 (days overdue before it is listed) | — | Sales |
| Customers over their credit limit | On | — | — | Sales |
| Supplier invoices to pay | On | 7 (days before the due date) | — | Purchasing |
| Documents expiring | On | 30 (days before the expiry date) | Every supervisor | Documents |
| Unusual stock adjustments | On | 500 (kg adjusted in one correction, within the last 7 days) | — | Sales |
| Sales returns waiting for approval | On | — | — | Sales |
| Leave requests waiting | On | — | — | Workforce |

Who sees an item:

- An Admin sees every item of every rule that is switched on.
- Another role sees an item only if the rule lists the role **and** the user can open the page the rule is about. A role listed on a rule but without the page sees nothing.
- For "Documents expiring", a role only sees documents in the categories opened to it.

### The e-mail digest

No e-mail is sent by itself. The command `python manage.py send_alert_digest` sends one e-mail that lists the open items of every rule marked "Send by e-mail". It goes to the address in `MANAGEMENT_EMAIL`. To send it every day, the server's scheduler must run the command. See [Deployment](12-deployment.md) and [Configuration](11-configuration.md).

## Master data for a new organisation

Before the first delivery is recorded, enter the master data below, in this order. The order matters because later records point to earlier ones.

Some lists are filled in when the system is installed. Check them and change them to fit the factory.

| # | What | Where it is entered | Needed before | Already filled in? | Who can enter it |
|---|---|---|---|---|---|
| 1 | Users | Users → **Add user** | Everything: sessions, inspections and work orders name a user. | One Admin account. | Admin only |
| 2 | Factory units | Warehouse → tab **Factory units** → **Add unit** | Deliveries, purchase requests, sorting sessions. | No | Warehouse page at Full |
| 3 | Suppliers (vendors) | Warehouse → tab **Vendors** → **Add vendor**. The profile can also be edited from Purchasing → **Suppliers** → ⋯ → **Edit profile**. | Deliveries, purchase orders, supplier invoices, chemical lots. | No | Warehouse page at Full |
| 4 | Tanks | Decolorization → tab **Tanks** → **Add tank** | Decolorization sessions, chemical issuances. | No | Decolorization page at Full |
| 5 | Dryers | Drying → tab **Dryers** → **Add dryer** | Drying sessions. | No | Drying page at Full |
| 6 | Chemicals | Decolorization → tab **Chemicals** → **Add chemical** | Chemical lots, recipes, issuances, bill of materials lines. | No | Decolorization page at Full |
| 7 | Chemical lots (opening stock) | Decolorization → tab **Lots** → **Receive lot** | — (adds to the chemical's stock and sets its cost) | No | Decolorization page at Full |
| 8 | Recipes | Decolorization → tab **Recipes** → **New recipe** | Optional on sessions. | No | Decolorization page at Full |
| 9 | Quality standards | Quality → tab **Standards** → **New standard** | Optional on inspections. | No | Admin only |
| 10 | Process stages | Production → tab **Setup** → section "Process stages" → **New stage** | Routings. | Yes: Sorting, Shredding, Fiber opening, Washing, Decolorization, Drying, Blending, Packaging | The duty *Plan production* (Admin by default) |
| 11 | Routings | Production → tab **Setup** → **New routing** | Production orders. | Yes: "Standard recycling" (Sorting 8 h, Decolorization 24 h, Drying 6 h) | The duty *Plan production* (Admin by default) |
| 12 | Bills of materials | Production → tab **Setup** → **New bill of materials** | Optional on production orders. | No | The duty *Plan production* (Admin by default) |
| 13 | Products and prices | Sales → tab **Products** → **New product** | Optional on quotations and orders. | No | Sales page at Full |
| 14 | Customers | Sales → tab **Customers** → **Add customer** | Quotations. Orders can also create a customer from a typed buyer name. | No | Sales page at Full |
| 15 | Chart of accounts | Finance → tab **Accounts** → **New account** | Expenses, journal entries. | Yes: 22 accounts (see below) | Finance page at Full |
| 16 | Financial periods | Finance → tab **Setup** → **New period** | Only needed to close and lock a month. | No | Finance page at Full |
| 17 | Tax rates | Finance → tab **Setup** → **New tax rate** | Nothing. A reference list only. | No | Finance page at Full |
| 18 | Document categories | Documents → tab **Categories** → **New category** | Uploading documents. | Yes: 9 categories (see below) | Admin only |
| 19 | Departments | Workforce → tab **Setup** → **New department** | Employees. | No | Workforce page at Full |
| 20 | Job roles | Workforce → tab **Setup** → **New job role** | Employees. | No | Workforce page at Full |
| 21 | Shifts | Workforce → tab **Setup** → **New shift** | Optional on employees; used by the attendance sheet. | No | Workforce page at Full |
| 22 | Employees | Workforce → tab **Employees** → **Add employee** | Attendance, leave, tasks. | No | Workforce page at Full |
| 23 | Machines | Maintenance → tab **Machines** → **Add machine** | Work orders, schedules. Link a machine to its tank or dryer here. | No | The duty *Manage maintenance* (Admin by default) |
| 24 | Preventive schedules | Maintenance → tab **Schedules** → **New schedule** | Preventive work orders. | No | The duty *Manage maintenance* (Admin by default) |
| 25 | Spare parts | Maintenance → tab **Spare parts** → **Add spare part** | Recording parts used on work orders. | No | The duty *Manage maintenance* (Admin by default) |
| 26 | Waste categories | Sustainability → tab **Setup** → **New category** | Waste records. | Yes: Fibre dust, Offcuts, Contaminated fabric, Chemical sludge, Wastewater sludge, Packaging | Admin only |
| 27 | Sustainability targets | Sustainability → tab **Setup** → **New target** | Nothing. Shown on the Sustainability dashboard. | No | Admin only |
| 28 | Notification rules | Approvals → tab **Rules** | — | Yes: 17 rules | Admin only |

"Page at Full" means any user who holds that page at the level Full. At the start that is the Admin plus the supervisor named in [System overview](01-system-overview.md#modules-at-a-glance). See [Access control](05-access-control.md).

Notes on some of the rows:

- **Suppliers.** A new supplier can only be added on the Warehouse page. Purchasing lists suppliers and lets you edit a profile, but has no "add supplier" button.
- **Tanks.** The **Batch ID** must be different for every tank.
- **Chemicals.** The first **Total stock** you type becomes the remaining stock. After that, stock goes up by receiving lots and down by issuances. Mark dangerous chemicals under "Who may issue it" so only a role with the duty *Issue restricted chemicals* can issue them.
- **Quality standards.** A standard belongs to one stage: Incoming material, In-process or Finished product. Each needs at least one check. A measurement check needs a minimum, a maximum or both.
- **Routings.** A routing must be "In use" to be chosen on a new production order. Changing a routing later affects new orders only.
- **Machines.** A machine can be linked to a tank or a dryer, not both. Set up tanks and dryers first.
- **Employees.** The **Login** field links an employee to a user account. It is optional; most floor workers have no login. One login can belong to one employee only.
- **Shifts.** A shift may end on the next day, for example 22:00 to 06:00.

### The starting chart of accounts

| Code | Account | Type | Used by automatic entries |
|---|---|---|---|
| 1000 | Cash in hand | Asset (cash) | Yes |
| 1010 | Bank account | Asset (bank) | Yes |
| 1100 | Accounts receivable | Asset | Yes |
| 1200 | Purchase tax recoverable | Asset | Yes |
| 1500 | Machinery and equipment | Asset | No |
| 2000 | Accounts payable | Liability | Yes |
| 2100 | Sales tax payable | Liability | Yes |
| 2500 | Loans | Liability | No |
| 3000 | Owner's capital | Equity | No |
| 4000 | Sales | Income | Yes |
| 4010 | Sales returns | Income | Yes |
| 4900 | Other income | Income | No |
| 5000 | Raw material purchases | Expense | Yes |
| 5100 | Chemicals and consumables | Expense | No |
| 5200 | Wages and labour | Expense | No |
| 5300 | Electricity | Expense | No |
| 5310 | Gas and fuel | Expense | No |
| 5320 | Water | Expense | No |
| 5400 | Repairs and maintenance | Expense | No |
| 5500 | Packaging | Expense | No |
| 5600 | Transport | Expense | No |
| 5900 | Other expenses | Expense | No |

The accounts marked "Yes" can be renamed but not deleted or switched off. An account that has entries cannot be deleted and cannot change type.

Opening balances (cash in hand, bank balance, loans, capital) are entered as a typed journal entry: Finance → tab **Journal** → **New entry**. See [Finance](07-modules/finance.md).

### The starting document categories

| Category | Who can see it at the start |
|---|---|
| Supplier documents | Admin, Warehouse Supervisor |
| Purchase documents | Admin, Warehouse Supervisor |
| Production batch documents | Admin and every supervisor |
| Quality certificates | Admin and every supervisor |
| Material test reports | Admin and every supervisor |
| Safety data sheets | Admin and every supervisor |
| Customer documents | Admin only |
| Invoices and delivery challans | Admin only |
| Employee documents | Admin only |

To change who sees a category: Documents → tab **Categories** → ⋯ → **Edit** → "Who can see it".

## Close a financial period

Closing a period locks every journal entry dated inside it. Do this once the month's records are complete.

### Before closing

1. Check that the month's supplier invoices are entered (Purchasing → Invoices) and its sales invoices are raised (Sales → Invoices).
2. Check that the month's expenses are recorded (Finance → Expenses).
3. Open **Finance** and press **Update books**. The message says how many entries were posted, corrected or removed, or "The books are already up to date."
4. Look at the statements for the month (Finance → **Statements**) and at **Balances**.

### Close

1. Open **Finance** and the **Setup** tab.
2. If the period does not exist yet, press **New period**. Fill in **Name** (for example "October 2026"), **From** and **To**. Press the button to save. Periods cannot overlap; the system refuses with "These dates overlap <period name>."
3. In the Periods table, open the **⋯** menu of the period and choose **Close period**.
4. The message "Period closed; its entries are locked." appears, and the Status column shows **Closed**.

Closing brings the books up to date once more before it locks them.

### What a closed period means

| Action dated inside the closed period | Result |
|---|---|
| Typing a new journal entry | Refused: "<period name> is closed. Reopen the period or use a later date." |
| Recording, changing or deleting an expense | Refused with the same message. |
| Reversing a typed-in entry | The original stays as it is. The reversal is posted with today's date, so it works as long as today is not inside a closed period. |
| A sales or purchasing record that changes afterwards (for example a late supplier invoice dated in that month) | The record itself is saved. Its journal entry is **not** posted or changed. **Update books** reports "N change(s) fall in a closed period and were left as they are." |
| Editing or deleting the period itself | Refused: "Reopen the period before changing it." / "Reopen the period before deleting it." |

### Reopen

1. Finance → **Setup** → Periods table → **⋯** → **Reopen**. The message "Period reopened." appears.
2. Press **Update books** so the changes that were left out are posted.
3. Close the period again when you are done.

Closing and reopening are written to the audit log.

## Read the audit log

The audit log shows who created, changed or deleted a record, and when. It also holds sign-ins, failed sign-ins and file downloads.

1. Open **Reports** and the **Audit log** tab.
2. The four figures at the top show the number of entries in total, today, in the last 7 days and in the last 30 days.
3. Narrow the list:

   | Filter | What it does |
   |---|---|
   | Search user, record… | Searches the username, the record type, the record's description and the action. |
   | All record types | Picks one record type from a short list (for example SalesOrder, Payment, Stock, CustomUser). For a type that is not in the list, use the search box. |
   | All actions | create, update, delete, login, login failed, export. |
   | From / To | The dates. The page opens on the last 30 days. |

4. Read a row:

   | Column | Meaning |
   |---|---|
   | When | Date and time. |
   | User | The username and the role at that time. For a failed sign-in, the name that was typed. "System" when there was no signed-in user. |
   | Action | CREATE, UPDATE, DELETE, LOGIN, LOGIN FAILED or EXPORT. |
   | Record | The record type and number, with its description. |
   | Changes | Up to three changed fields as "field: old → new", then "(+N more)". Hover to see the full text. |
   | IP | The address the request came from. |

5. Move between pages with the arrows. Each page holds 25 entries.
6. Press **Export (500 rows)** to download the newest 500 entries as an Excel file. The export follows the record type, action and date filters. It does not follow the search box.

Useful searches:

| Question | How to find it |
|---|---|
| Who changed this order? | Record type "SalesOrder", then search the order's buyer name. |
| Did someone try to break into an account? | Action "login failed". Look at the username and IP columns. |
| Who downloaded a document? | Action "export", then search the document's title. |
| Who changed access? | Search "Page access" (a role's pages) or the username (a person's exceptions). |
| Who released a quarantine? | Search the inspection number, for example "QC-00007". |

What the log does not hold: changes made directly in the database, in the Django admin panel, or by management commands. More detail is in [Audit and logging](14-audit-and-logging.md).

## Export data

| What you need | Where | Format |
|---|---|---|
| Any table on any page | The **Export** button above the table. It exports the rows that match the current search and filters, and the columns that are shown. | CSV, named `<table>-<date>.csv` |
| Daily production, monthly sales, waste analysis | Reports → the first three tabs → **Export Excel** | Excel |
| The thirteen report-centre reports | Reports → **Report centre** → **Export CSV** or **Export Excel** | CSV or Excel |
| A printed or PDF copy of a report | **Print** on the Reports tabs and on Traceability. Choose "Save as PDF" in the browser's print window. | Paper or PDF |
| A delivery challan | Sales → Dispatches → ⋯ → **Print challan** | Print window |
| A sales invoice | Sales → Invoices → ⋯ → **Print invoice** | Print window |
| A customer statement | Sales → Customers → ⋯ → **Statement** | On screen |
| The audit log | Reports → Audit log → **Export (500 rows)** | Excel |
| An uploaded document | Documents → ⋯ → **Download** (or **Versions** for an older file) | The original file |
| Everything (a full copy) | A backup. See [Deployment](12-deployment.md). | Database dump and files |

Notes:

- If the print window does not open, the browser blocked it. The message is "The browser blocked the print window. Allow pop-ups for this site and try again."
- The table export contains what is loaded on the screen. Use the filters first to get the period you want.
- Report-centre exports end with a section "How these figures are worked out" in the Excel file.

## Daily, weekly and monthly checklist

### Every day

- [ ] Open **Approvals**. Decide what is waiting, oldest first.
- [ ] Open the bell. Deal with items under "Escalated" and "Urgent" first.
- [ ] Look at the **Dashboard**: "Needs attention", and the alert-coloured figures under "Business at a glance" (overdue invoices, late orders, quarantine, broken-down machines, expired documents).
- [ ] Workforce → **Attendance**: check that today's sheet has been saved.
- [ ] Quality: check **In quarantine**. Release material only when the problem is solved.

### Every week

- [ ] Purchasing → Dashboard: "Late deliveries" and "Owed to suppliers". Pay or plan the invoices that are due.
- [ ] Sales → Invoices: filter the status **Overdue** and follow up.
- [ ] Sales → Customers: read the "Possible duplicates" box and merge real duplicates.
- [ ] Maintenance → Schedules: create work orders for tasks that are due.
- [ ] Decolorization → Chemicals: reorder what is running low. Lots: check expiry dates.
- [ ] Documents → **Expiring**: renew what runs out soon.
- [ ] Reports → Audit log: filter the action "login failed" and look for repeated attempts.
- [ ] Users: deactivate accounts of people who have left.
- [ ] Check that backups ran and were copied off the server. See [Deployment](12-deployment.md).

### Every month

- [ ] Finance: **Update books**, review the statements, then close the month. See [Close a financial period](#close-a-financial-period).
- [ ] Finance → **Costing**: review the cost per kg for the month.
- [ ] Reports → **Report centre**: export the reports management needs.
- [ ] Sustainability → **Environmental report**: review the month, and check targets on the dashboard.
- [ ] Users → **Access**: review the page levels of each role and the exceptions for single people.
- [ ] Approvals → **Rules**: review thresholds and who receives each rule.
- [ ] Ask whoever runs the server to run `python manage.py reconcile_inventory` and send you the result. See [Troubleshooting](15-troubleshooting.md#stock-figures).

## What only an Admin can do

There are three kinds of "admin only". They behave differently when access is changed, so they are listed separately.

### 1. Fixed to the Admin role

These checks look at the role itself. They cannot be handed to another role.

| What | Where |
|---|---|
| Create, edit, deactivate, activate and delete users; reset passwords | Users |
| Manage page access, exceptions, roles and duties | Users → Access |
| Open the Users page at all | — |
| Change notification rules | Approvals → Rules |
| Merge two customers | Sales → Customers → ⋯ → Merge into… |
| Create, edit and delete quality standards | Quality → Standards |
| Delete any quality record (inspection, action, standard) | Quality |
| Delete a work order | Maintenance |
| Create, edit and delete waste categories and sustainability targets | Sustainability → Setup |
| Delete waste records and utility readings; change entries recorded by someone else | Sustainability |
| Create, edit and delete document categories; decide which roles see a category | Documents → Categories |
| Delete documents; change a document uploaded by someone else; move a document to another category | Documents |
| See every document category | Documents |
| See everyone's entries in the audit log (other roles see only their own) | Reports → Audit log |
| See every notification, whatever the rule's role list says | The bell |

### 2. Duties (Admin by default)

These need a duty. An Admin carries every duty. At the start no other role carries the ones below. They can be given to a role; see [Access control](05-access-control.md).

| Duty | What it allows |
|---|---|
| Approve purchases | Approve or reject purchase requests, approve purchase orders, close orders. |
| Record supplier payments | Record, change and delete payments to suppliers. |
| Release quarantine | Release failed material, and change a failed inspection. |
| Plan production | Create, change, release and cancel production orders; skip a stage; maintain stages, routings and bills of materials. |
| Approve decolorization batches | Sign off a completed batch. |
| Issue restricted chemicals | Issue chemicals marked as restricted. |
| Approve sales returns | Approve or reject customer returns. |
| Adjust stock | Correct sellable stock by hand. |
| Manage maintenance | Register, edit and delete machines, preventive schedules and spare parts; create a work order from a schedule; receive spare parts; assign, change and cancel work orders; work on an order assigned to someone else; remove a part from a work order. |

> **Note on the screens.** On the module pages, the buttons for these actions are shown only to users whose role carries the duty. The server checks the duty again when the action is sent. The Approvals page shows its buttons to everyone who can open that page; an action the user's role may not take is refused there with a message.

### 3. Pages that start as Admin only

Dashboard, Approvals, Sales, Finance, Workforce and Reports start with the Admin alone. Everything on them is therefore "admin only" until the page is given to a role or a person. That includes approving leave: it needs the Workforce page at Full, not a duty.

## For developers

| Topic | Code |
|---|---|
| User accounts, sign-in, the "last admin" rule | `backend/apps/users/views.py` |
| Users page and form | `frontend/src/features/users/users-page.tsx` |
| Access screen | `frontend/src/features/users/access-panel.tsx`, `frontend/src/features/users/roles-panel.tsx`, `backend/apps/access/` |
| Approvals inbox | `backend/apps/alerts/approvals.py`, `frontend/src/features/approvals/` |
| Notification rules | `backend/apps/alerts/rules.py`, `backend/apps/alerts/migrations/0002_default_rules.py` |
| Starting master data | `backend/apps/finance/migrations/0002_default_accounts.py`, `backend/apps/production/migrations/0002_default_stages.py`, `backend/apps/documents/migrations/0002_default_categories.py`, `backend/apps/sustainability/migrations/0002_default_waste_categories.py` |
| Period closing | `backend/apps/finance/views.py` (`PeriodViewSet`), `backend/apps/finance/services.py` (`check_open`, `sync_operations`) |
| Audit log | `backend/apps/audit/`, `frontend/src/features/reports/audit-log.tsx` |
| Table export | `frontend/src/components/common/data-table.tsx` (`exportCsv`) |
| First account | `backend/setup_fresh.py` |

API paths used on this page: `/api/v1/users/register/`, `/api/v1/users/detail/<id>/`, `/api/v1/users/toggle-active/<id>/`, `/api/v1/alerts/approvals/`, `/api/v1/alerts/rules/<id>/`, `/api/v1/finance/periods/<id>/close/`, `/api/v1/finance/periods/<id>/reopen/`, `/api/v1/finance/journal/sync/`, `/api/v1/audit/logs/`, `/api/v1/audit/logs/export/`.

## Keeping this page up to date

- **Users and safeguards:** `backend/apps/users/views.py`, `backend/apps/users/serializers.py`, `frontend/src/features/users/users-page.tsx`.
- **Approvals and rules:** `backend/apps/alerts/approvals.py` (the `KINDS` list), `backend/apps/alerts/rules.py`, `backend/apps/alerts/migrations/0002_default_rules.py`, `frontend/src/features/approvals/`.
- **Master data table:** each module's `*-page.tsx` (tab names and button labels) and `views.py` (who may write). Recheck the "Who can enter it" column when a permission class changes.
- **What only an Admin can do:** search the backend for `is_admin(`, `IsAdminUser`, `SharedReadPermission`, `has_duty(` and `HasDuty(`. The duty list is `DUTIES` in `backend/apps/access/services.py`.
- **Period closing and exports:** `backend/apps/finance/views.py`, `backend/apps/finance/services.py`, `frontend/src/features/reports/`.
