# Finance

This guide covers the Finance page: the chart of accounts, the journal, expenses, who owes what, the financial statements, production costing, periods and tax rates. It is for administrators and for whoever keeps the books.

Finance supports the business's own bookkeeping. It is not a certified statutory accounting system.

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

Finance keeps a **double-entry journal**: every entry has debits and credits that are equal. The statements are built from the journal.

Entries come from three places:

1. **Typed in by hand** (a journal entry), for example the owner putting money into the business.
2. **Recording an expense**: money paid out that is not a supplier invoice. The journal entry is made for you.
3. **Posted from Sales and Purchasing**: customer invoices, customer payments, approved sales returns, supplier invoices and supplier payments.

The third kind is posted by **Update books**. It posts what is missing, corrects what changed and removes entries whose source record was deleted. Opening any statement, the dashboard, the Balances tab or the Costing tab updates the books first, so the figures are current.

A sale reaches the books when it is **invoiced**. A purchase reaches the books when the **supplier's invoice** is entered.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| All supervisors | No access |

No duty is involved. Everything on the page needs the Finance page: at any level to look, at Full to change anything (including **Update books**, closing a period and reversing an entry).

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/finance`. Two buttons sit at the top right: **Update books**, and an add button that changes with the tab.

| Tab | Add button |
|---|---|
| Dashboard | **Record expense** |
| Journal | **New entry** |
| Expenses | **Record expense** |
| Accounts | **New account** |
| Balances | **Record expense** |
| Statements | **New entry** |
| Costing | **Record expense** |
| Setup | **New period** |

### Dashboard

| Card | Shows |
|---|---|
| Cash and bank | The total balance of the cash and bank accounts that are in use, and each account's balance |
| Customers owe us | Total owed by customers |
| We owe suppliers | Total unpaid on supplier invoices |
| Profit, this month (or "Loss, this month") | Income less expenses this month, with both figures in the hint |

Then a chart **Income and expenses** for the last six months, and a list **Largest expenses, this month** (up to six expense accounts) with the year-to-date profit or loss.

### Journal

Columns: Number, Date, For (the purpose, and the accounts debited and credited), From (where the entry came from; "Typed in" for manual entries; badges "Reversed by …" and "Reverses …"), Amount.

Filters: where the entry came from (All entries, Typed in, Expense, Sales invoice, Customer payment, Sales return, Supplier invoice, Supplier payment) and a period (default: This month).

Pressing an entry's number, or **Show lines** in the row menu, opens a card under the table with each line's account, debit and credit.

| Row action | Shown when |
|---|---|
| Show lines / Hide lines | Always |
| Reverse | The entry was typed in, is not itself a reversal, and has not been reversed |

There is no Edit or Delete for a journal entry.

### Expenses

Columns: Number, Date, Paid for (and the payee), Account, Part of factory, Paid from, Amount.

Filter: period. Row actions: **Edit**, **Delete**.

### Accounts

Columns: Code, Account (with badges "Cash or bank" and "Not in use"), Type, Balance.

Filter: account type.

| Row action | What it does |
|---|---|
| Ledger | Opens a side sheet with every line on the account and a running balance |
| Edit | Opens the account form |
| Delete | Not offered for the accounts the automatic postings use |

### Balances

Two lists, both read from Sales and Purchasing rather than from the journal:

- **Customers owe us**: each customer with a balance, largest first, with an "Over limit" badge.
- **We owe suppliers**: each supplier with unpaid invoices, largest first, with the overdue amount as a badge.

### Statements

Choose a statement and its dates:

| Statement | Dates | Shows |
|---|---|---|
| Profit and loss | From, To (default: 1 January to today) | Income accounts, expense accounts, totals, and Net profit or Net loss |
| Balance sheet | As of | Assets, liabilities, equity (including "Profit kept in the business"), and a check "Assets equal liabilities plus equity" |
| Trial balance | As of | Every account with a net debit or credit, totals, and a check "Debits equal credits" |
| Cash flow | From, To | Opening balance of cash and bank, money in and out grouped by where the entry came from, net change, closing balance |

If a statement does not balance, a red badge "Does not balance" is shown.

### Costing

For a period (default: 1 January to today):

| Card | Shows |
|---|---|
| Production cost | The total of all cost rows |
| Dried output | Kg of output from drying sessions completed in the period |
| Cost per kg | Production cost ÷ dried output ("—" when nothing was dried) |
| Orders: actual vs estimate | Actual cost of production orders planned to start in the period, against their estimate |

A table **Cost by kind** lists each cost with what it is taken from and its share. A list **Expenses by part of the factory** totals the expenses by cost centre.

### Setup

- **Periods**: Period, Dates, Status (Open or Closed). Row actions: **Close period** or **Reopen**; **Edit** and **Delete** only while open.
- **Tax rates**: Tax, Rate, Status (In use or Not in use). Row actions: **Edit**, **Delete**.

## Records and fields

### Account

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Code | Short code, e.g. 5330 | Yes | Unique |
| Name | | Yes | |
| Type | Asset, Liability, Equity, Income or Expense | Yes | Cannot change once the account has entries |
| Cash or bank | Money is paid from and into it | Yes | Only an Asset account |
| In use | | Yes | Accounts used by automatic postings stay in use |
| Description | | No | |

The balance is shown on the account's natural side: assets and expenses as debit less credit, the others as credit less debit.

**The starting chart of accounts**

| Code | Name | Type | Used by automatic postings |
|---|---|---|---|
| 1000 | Cash in hand | Asset (cash) | Yes |
| 1010 | Bank account | Asset (cash) | Yes |
| 1100 | Accounts receivable | Asset | Yes |
| 1200 | Purchase tax recoverable | Asset | Yes |
| 1500 | Machinery and equipment | Asset | |
| 2000 | Accounts payable | Liability | Yes |
| 2100 | Sales tax payable | Liability | Yes |
| 2500 | Loans | Liability | |
| 3000 | Owner's capital | Equity | |
| 4000 | Sales | Income | Yes |
| 4010 | Sales returns | Income | Yes |
| 4900 | Other income | Income | |
| 5000 | Raw material purchases | Expense | Yes |
| 5100 | Chemicals and consumables | Expense | |
| 5200 | Wages and labour | Expense | |
| 5300 | Electricity | Expense | |
| 5310 | Gas and fuel | Expense | |
| 5320 | Water | Expense | |
| 5400 | Repairs and maintenance | Expense | |
| 5500 | Packaging | Expense | |
| 5600 | Transport | Expense | |
| 5900 | Other expenses | Expense | |

Accounts marked "Yes" can be renamed but not deleted or switched off.

### Journal entry

Number format: `JV-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Date | | Yes | Not inside a closed period |
| Reference | | No | |
| What it is for | | Yes | |
| Lines | Account, Debit, Credit | At least two | Each line has a debit or a credit, not both. Debits must equal credits. Only accounts in use |
| Source | Where the entry came from | Set by the system | Manual, Expense, Sales invoice, Customer payment, Sales return, Supplier invoice or Supplier payment |
| Reverses / reversed by | Links between an entry and its reversal | Set by the system | |

### Expense

Number format: `EXP-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Date | | Yes | Not inside a closed period |
| Amount (Rs.) | | Yes | Greater than zero |
| What was paid for | | Yes | |
| Expense account | | Yes | Must be an Expense account |
| Paid from | | Yes | Must be a cash or bank account. Filled in when there is only one |
| Part of the factory | General, Warehouse, Sorting, Decolorization, Drying, Maintenance or Sales | Yes | Defaults to General. Used in costing |
| Paid to | | No | |
| Voucher or receipt number | | No | |

### Period

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. October 2026 | Yes | Unique |
| From, To | | Yes | To not before From. Periods cannot overlap |
| Closed, closed by, closed at | | Set by the system | |

### Tax rate

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. Sales tax | Yes | Unique |
| Rate, % | | Yes | 0 to 100 |
| In use | | Yes | |

Tax rates are a reference list only. Nothing reads them: the tax on an order or invoice is typed in on that record.

## Statuses

### Period

| Status | Meaning | How it gets there |
|---|---|---|
| Open | Entries can be dated inside it | Created; or **Reopen** |
| Closed | No entry dated inside it can be added, changed or removed | **Close period**. The books are updated first, so everything up to that moment is included |

Dates that fall in no period at all are always open.

### Journal entry

An entry has no status. It may carry one of two marks: "Reversed by JV-…" or "Reverses JV-…".

## How to

### Record an expense

1. Open **Finance** and press **Record expense**.
2. Fill in the **Date**, the **Amount (Rs.)** and **What was paid for**.
3. Choose the **Expense account** and the account it was **Paid from**.
4. Choose the **Part of the factory** the cost belongs to.
5. Press **Save**. The journal entry is posted at once.

### Type in a journal entry

1. Open the **Journal** tab and press **New entry**.
2. Fill in the **Date** and **What it is for**.
3. On each line choose an account and type a debit or a credit. Press **Add line** for more.
4. Watch the line under the entry: it shows the totals, "Out by Rs. …" while they differ, and "Balanced" when they agree.
5. Press **Post entry**.

### Correct a wrong entry

- **Typed in:** choose **Reverse** in the row menu. A mirror-image entry dated today is posted and the two are linked. Then type the correct entry.
- **From an expense:** edit or delete the expense on the Expenses tab. Its entry follows.
- **From Sales or Purchasing:** change the invoice, payment or return in that module, then press **Update books**.

### Bring the books up to date

Press **Update books**. The page reports, for example, "Books updated: 4 posted, 0 corrected, 0 removed." or "The books are already up to date." If a change falls in a closed period it says so and leaves that entry as it is.

### Close a period

1. Open the **Setup** tab and press **New period**. Give it a name and its dates.
2. When the period's work is finished, choose **Close period** in its row menu.
3. To change something inside it later, choose **Reopen**, make the change, and close it again.

### Read a statement

1. Open the **Statements** tab.
2. Choose the statement and its dates.

### See an account's history

1. Open the **Accounts** tab.
2. Choose **Ledger** in the account's row menu.

### Add an account

1. Open the **Accounts** tab and press **New account**.
2. Give it a code, a name and a type. Set **Cash or bank** to Yes only for an Asset account that holds money.
3. Press **Save**.

## Business rules

### Entries

| Rule | Message |
|---|---|
| An entry needs at least two lines | "An entry needs at least two lines." |
| Amounts cannot be negative | "Amounts can't be negative." |
| Each line has a debit or a credit, not both and not neither | "Each line needs either a debit or a credit." (the form says "Enter a debit or a credit, not both.") |
| Debits must equal credits | "The entry does not balance: debits Rs. 100.00, credits Rs. 90.00." (the form says "Debits and credits must be equal.") |
| An entry can use only accounts that are in use | "5300 Electricity is not in use." |
| An entry cannot be dated in a closed period | "October 2026 is closed. Reopen the period or use a later date." |
| Entries are never edited or deleted through the API | The request is refused (405) |
| A reversal cannot be reversed | "This entry is itself a reversal." |
| An entry is reversed once | "This entry has already been reversed." |
| Only typed-in entries can be reversed | "This entry was posted from a supplier invoice. Change that record instead." (the source varies) |
| A reversal is dated today unless a date is given, and that date must be in an open period | |

### Expenses

| Rule | Message |
|---|---|
| The amount must be positive | "Must be greater than zero." |
| The account must be an expense account | "Choose an expense account." |
| The paid-from account must be cash or bank | "Choose a cash or bank account." |
| The date (old and new) must be in an open period | "… is closed. Reopen the period or use a later date." |
| Saving, changing or deleting an expense updates the books in the same step, so its entry always matches | |

### Accounts

| Rule | Message |
|---|---|
| Only an asset account can be cash or bank | "Only an asset account can be a cash or bank account." |
| The type cannot change once the account has entries | "The type can't change once the account has entries." |
| Accounts used by automatic postings stay in use | "Automatic postings use this account, so it stays active." |
| Accounts used by automatic postings cannot be deleted | "Automatic postings use this account, so it can't be deleted." |
| An account with entries cannot be deleted | "This account has entries. Mark it as not in use instead." |

### Periods and tax rates

| Rule | Message |
|---|---|
| The end date cannot be before the start date | "Can't be before the start date." |
| Periods cannot overlap | "These dates overlap October 2026." |
| A closed period cannot be changed | "Reopen the period before changing it." |
| A closed period cannot be deleted | "Reopen the period before deleting it." |
| Closing or reopening twice is refused | "This period is already closed." / "This period is already open." |
| A tax rate is a percentage | "Must be between 0 and 100." |

### Postings from Sales and Purchasing

| Source record | Debit | Credit | Dated |
|---|---|---|---|
| Sales invoice | Accounts receivable (total) | Sales (subtotal less discount); Sales tax payable (tax) | Invoice date |
| Customer payment | Cash in hand (method Cash) or Bank account (any other method) | Accounts receivable | Payment date |
| Sales return (Approved) | Sales returns | Accounts receivable | The day it was approved |
| Supplier invoice | Raw material purchases (amount); Purchase tax recoverable (tax) | Accounts payable (total) | Invoice date |
| Supplier payment | Accounts payable | Cash in hand (method Cash) or Bank account (any other method) | Payment date |
| Expense | The expense account | The account it was paid from | Expense date |

Rules for **Update books**:

- A record with no entry gets one ("posted").
- An entry whose date, purpose or lines no longer match its record is replaced ("corrected").
- An entry whose record was deleted is removed ("removed").
- An entry dated in a closed period, or one that would move into a closed period, is left exactly as it is ("left as they are"). The page warns: "N change(s) fall in a closed period and were left as they are."
- Running it again with nothing changed does nothing.

### How the figures are worked out

- **Customers owe us** and **We owe suppliers** (dashboard cards and the Balances tab) come from the Sales and Purchasing records, not from the journal. A customer's balance counts **confirmed orders**, less payments and return credits. The journal's Accounts receivable counts **invoices**. The two can differ when goods are ordered but not yet invoiced.
- **Balance sheet**: income less expenses to date is shown under equity as "Profit kept in the business".
- **Cash flow**: the opening balance is the cash and bank balance on the day before the period. Each entry that touches a cash or bank account counts as money in or out, grouped by where the entry came from.
- **Costing**:
  - Raw material = supplier invoices dated in the period, before tax.
  - Chemicals and consumables = chemicals issued in the period × their cost when issued.
  - Direct labour and machine time = hours recorded on production stages finished in the period × the stage's hourly cost.
  - Every expense account with expenses in the period is a row of its own.
  - Cost per kg = total ÷ output of drying sessions completed in the period. It is one rate for the whole factory.
  - "Orders: actual vs estimate" covers production orders whose planned start is in the period, except cancelled ones.

## Related data

| Module | What happens |
|---|---|
| [Sales](sales.md) | Invoices, payments and approved returns are posted. Customer balances feed the dashboard and the Balances tab |
| [Purchasing](purchasing.md) | Supplier invoices and payments are posted. Unpaid invoices feed "We owe suppliers" and the raw material cost |
| [Decolorization](decolorization.md) | Chemical issuances and their cost feed the costing report |
| [Production](production.md) | Stage hours and planned costs feed the costing report |
| [Drying](drying.md) | Dried output is the divisor of cost per kg |
| [Dashboard and reports](dashboard-and-reports.md) | "Business at a glance" shows cash, receivable, payable and this month's profit. The *Inventory valuation* report uses the cost per kg |

Finance never changes a Sales or Purchasing record. It only reads them.

## For developers

**Backend:** `backend/apps/finance`.

| File | Contents |
|---|---|
| `models.py` | `Account` (`system_key` marks the accounts automatic postings use), `FinancialPeriod`, `TaxRate`, `JournalEntry` (`source`, `source_id`, `reverses`), `JournalLine`, `Expense` |
| `services.py` | `check_open`, `check_lines`, `post`, `reverse`, `check_expense`, `sync_operations` (with `_wanted` and `_same`), the statements (`trial_balance`, `profit_and_loss`, `balance_sheet`, `cash_flow`, `ledger`), `balances`, `production_cost` |
| `serializers.py` | Validation for accounts, periods, tax rates, entries and expenses |
| `views.py` | View sets and the report views. `ReportView.get` calls `sync_operations` before building |
| `migrations/0002_default_accounts.py` | The starting chart of accounts |
| `demo.py` | Demo records for the `seed_module_data` command |
| `tests.py` | Rules above, as tests |

`sync_operations` is not driven by signals. It runs when a report is opened, when an expense is saved or deleted, when a period is closed, and on `POST /journal/sync/`. To add a new kind of automatic posting, add the source to `JournalEntry.SOURCE_CHOICES`, add its rows to `_wanted()`, and add a `system_key` account in a data migration if a new account is needed.

**Endpoints** (under `/api/v1/finance/`):

| Method and path | Purpose |
|---|---|
| `GET, POST /accounts/`, `GET, PATCH, PUT, DELETE /accounts/{id}/` | Chart of accounts, each with its `balance` and `is_system` |
| `GET /accounts/{id}/ledger/` | Lines with a running balance (`start`, `end`) |
| `GET, POST /periods/`, `/periods/{id}/` | Periods |
| `POST /periods/{id}/close/`, `/reopen/` | Lock and unlock |
| `GET, POST /tax-rates/`, `/tax-rates/{id}/` | Tax rates |
| `GET, POST /journal/`, `GET /journal/{id}/` | Entries (filters `source`, `account`, date parameters on `date`). No update or delete |
| `POST /journal/{id}/reverse/` | Post the mirror image; optional `date` |
| `POST /journal/sync/` | Update the books; returns `posted`, `updated`, `removed`, `skipped_closed` |
| `GET, POST /expenses/`, `/expenses/{id}/` | Expenses (date parameters on `date`) |
| `GET /summary/` | Dashboard figures |
| `GET /trial-balance/?as_of=` | Trial balance |
| `GET /profit-and-loss/?start=&end=` | Profit and loss |
| `GET /balance-sheet/?as_of=` | Balance sheet |
| `GET /cash-flow/?start=&end=` | Cash flow |
| `GET /balances/` | Who owes what |
| `GET /costing/?start=&end=` | Production costing |

Dates are `YYYY-MM-DD`. A bad date answers "Enter a date as YYYY-MM-DD."; an end before the start answers "Can't be before the start date." Without dates, ranges default to 1 January of this year to today and `as_of` defaults to today.

All of these use the permission `HasPage('finance')`: reading needs the Finance page, changing needs it at Full.

**Frontend:** `frontend/src/features/finance/` (`finance-page.tsx`, `finance-forms.tsx`, `finance-reports.tsx`, `schemas.ts`). Route: `frontend/src/app/(app)/finance/page.tsx`. Types: `frontend/src/types/finance.ts`.

**Tests:** `backend/apps/finance/tests.py`.

**Browser scenario:** `frontend/e2e/finance.mjs`. Dashboard → an unbalanced entry is refused → a balanced entry is posted → an expense posts its own entry → the three statements → reversing an entry → deleting the expense removes its entry → costing → a warehouse supervisor has no Finance menu and the API refuses them.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "… is closed. Reopen the period or use a later date." | The date falls in a closed period | Reopen the period on the Setup tab, or use another date |
| "N change(s) fall in a closed period and were left as they are." | A Sales or Purchasing record dated in a closed period was changed or deleted | Reopen the period, press **Update books**, close it again |
| "Customers owe us" differs from Accounts receivable on the balance sheet | The first counts confirmed orders, the second counts invoices | Raise invoices for dispatched goods |
| A sale does not show in profit and loss | It has not been invoiced | Raise the invoice on the Sales page |
| A customer payment went to Bank but was paid in cash | The payment's method is not Cash | Change the payment's method on the Sales page and press **Update books** |
| **Reverse** is missing on an entry | The entry came from an expense, Sales or Purchasing, or is already reversed | Change the source record instead |
| An account cannot be deleted | It has entries, or automatic postings use it | Set **In use** to No (not possible for accounts used by automatic postings) |
| Cost per kg shows "—" | No drying session was completed in the period | Choose a period with dried output |
| A red "Does not balance" badge | Should not happen: every entry balances | Report it; check the journal for entries changed directly in the database |

## Keeping this page up to date

- `backend/apps/finance/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, rules, messages, postings and endpoints.
- `backend/apps/finance/migrations/0002_default_accounts.py`: the starting chart of accounts.
- `frontend/src/features/finance/*`: tabs, columns, row actions, labels and client-side messages.
- `backend/apps/sales/models.py` and `backend/apps/procurement/models.py`: the records the automatic postings read.
- `frontend/e2e/finance.mjs`: the browser scenario.
