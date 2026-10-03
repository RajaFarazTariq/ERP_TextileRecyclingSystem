# Access control

This page explains how the system decides what each person can open and do, and how an administrator changes it. The first part is for administrators; the last part is for developers.

## On this page

- [The four ideas](#the-four-ideas)
- [Roles](#roles)
- [Pages and levels](#pages-and-levels)
- [Duties](#duties)
- [Exceptions for one person](#exceptions-for-one-person)
- [Starting access](#starting-access)
- [How to change access](#how-to-change-access)
- [When a change takes effect](#when-a-change-takes-effect)
- [Safeguards](#safeguards)
- [Rules that access does not change](#rules-that-access-does-not-change)
- [For developers](#for-developers)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## The four ideas

| Idea | What it answers | Where it is set |
|---|---|---|
| **Role** | What is this person's job? | Users → Users (the Role field of a user) |
| **Page level** | Which pages can the role open, and can it change things there? | Users → Access → Pages by role |
| **Duty** | Which approvals and other special actions may the role do? | Users → Access → Duties by role |
| **Exception** | Does one person need more or less than their role? | Users → Access → Exceptions for one person |

Each person has **one role**. A person's access is: the pages of their role, adjusted by their own exceptions, plus the duties of their role.

Only admins can open the Users page, so only admins manage access.

## Roles

A role is a job in the organisation.

- **Built-in roles** (five): Admin, Warehouse Supervisor, Sorting Supervisor, Decolorization Supervisor, Drying Supervisor. They cannot be renamed or deleted. Their pages and duties can be changed, except for Admin.
- **Roles you add**: for example Accountant, Store Keeper, Quality Officer. A new role starts with no pages and no duties, unless you copy them from an existing role when you add it.

The **Admin** role is fixed: every page in full, every duty, always. It cannot be reduced.

See [Roles and responsibilities](04-roles-and-responsibilities.md) for what each built-in role is for.

## Pages and levels

A page is one entry of the side menu. There are eighteen: Dashboard, Approvals, Traceability, Warehouse, Sorting, Decolorization, Drying, Quality, Production, Maintenance, Sustainability, Purchasing, Sales, Finance, Documents, Workforce, Reports, Users.

A role holds each page at one of three levels:

| Level | In the menu | Can look | Can add, edit, delete |
|---|---|---|---|
| **No access** | Hidden | No | No |
| **View only** | Shown | Yes | No |
| **Full** | Shown | Yes | Yes |

What **View only** looks like for the user:

- The page header shows a "View only" badge.
- The buttons that add records are hidden.
- Row menus offer only actions that look at something (for example opening a statement or printing).
- If the user tries to change something anyway, the system refuses with: "You have view-only access here, so you can look but not change anything."

Three pages only show information and have nothing to change: **Dashboard**, **Traceability** and **Reports**. For these the choice is "No access" or "Can open".

The **Users** page is for admins only. It cannot be given to another role or person. The grid shows it as locked.

A page also brings the data it needs from other modules, for reading only. For example, the Sorting page reads the warehouse deliveries it sorts from, and the Quality page reads deliveries and lots to inspect. Giving a role a page never lets it *change* another module's records.

## Duties

Opening a page is not the same as being allowed to approve. Duties cover the special actions:

| Duty | What it allows | Used on page |
|---|---|---|
| Approve purchases | Approve or reject purchase requests and orders, and close orders | Purchasing |
| Record supplier payments | Record, change and delete payments to suppliers | Purchasing |
| Inspect incoming material | Record quality inspections of deliveries | Quality |
| Inspect in-process material | Record quality inspections of lots being processed | Quality |
| Inspect finished goods | Record quality inspections of finished lots | Quality |
| Release quarantine | Release failed material, and change a failed inspection | Quality |
| Plan production | Create, change, release and cancel production orders; maintain stages, routings and bills of materials | Production |
| Run production stages | Start and complete the stages of a production order and record materials used | Production |
| Approve decolorization batches | Sign off a completed decolorization batch | Decolorization |
| Issue restricted chemicals | Issue chemicals marked as restricted | Decolorization |
| Approve sales returns | Approve or reject goods returned by customers | Sales |
| Adjust stock | Correct sellable stock by hand, with a reason | Sales |
| Manage maintenance | Register machines, plan preventive work, manage spare parts, assign or cancel work orders | Maintenance |

Two things to remember:

1. **A duty needs its page.** A duty only works for a role that also has the duty's page at **Full**. A role with the duty *Approve purchases* but no Purchasing page cannot approve anything.
2. **Admins have every duty.** This cannot be changed, so there is always someone who can approve.

Duties belong to roles. There are no per-person duties: if one person needs a duty the rest of their role should not have, add a role for them (copy their current role, then add the duty).

## Exceptions for one person

Use an exception when one person needs more or less than their role on a page, and it is not worth a new role.

- For each page you choose **As the role**, **No access**, **View only** or **Full**.
- "As the role" removes the exception.
- An exception can give a page the role lacks, take away a page the role has, or change the level.
- Admins cannot have exceptions: an admin always has everything. To limit an admin, change their role.
- Exceptions stay with the person if their role changes. Review them when you change someone's role.

The card shows how many people have exceptions.

## Starting access

This is what the system is installed with. It matches what each role could do before access became configurable.

**Pages** (all at Full):

| Page | Admin | Warehouse Sup. | Sorting Sup. | Decolorization Sup. | Drying Sup. |
|---|---|---|---|---|---|
| Dashboard | Yes | – | – | – | – |
| Approvals | Yes | – | – | – | – |
| Traceability | Yes | Yes | Yes | Yes | Yes |
| Warehouse | Yes | Yes | – | – | – |
| Sorting | Yes | – | Yes | – | – |
| Decolorization | Yes | – | – | Yes | – |
| Drying | Yes | – | – | – | Yes |
| Quality | Yes | Yes | Yes | Yes | Yes |
| Production | Yes | – | Yes | Yes | Yes |
| Maintenance | Yes | Yes | Yes | Yes | Yes |
| Sustainability | Yes | Yes | Yes | Yes | Yes |
| Purchasing | Yes | Yes | – | – | – |
| Sales | Yes | – | – | – | – |
| Finance | Yes | – | – | – | – |
| Documents | Yes | Yes | Yes | Yes | Yes |
| Workforce | Yes | – | – | – | – |
| Reports | Yes | – | – | – | – |
| Users | Yes | never | never | never | never |

**Duties:**

| Duty | Admin | Warehouse Sup. | Sorting Sup. | Decolorization Sup. | Drying Sup. |
|---|---|---|---|---|---|
| Inspect incoming material | Yes | Yes | – | – | – |
| Inspect in-process material | Yes | – | Yes | Yes | Yes |
| Inspect finished goods | Yes | – | – | – | Yes |
| Run production stages | Yes | – | Yes | Yes | Yes |
| All other duties | Yes | – | – | – | – |

The buttons **Original access** and **Original duties** put the built-in roles back to these tables. They do not touch roles you added.

## How to change access

**For administrators.** Open **Users**, then the **Access** tab. The tab has four cards.

### Add a role

1. In the **Roles** card choose **Add role**.
2. Enter a **Name** and, if you like, **What the role is for**.
3. Under **Start with the pages and duties of**, pick a role to copy, or leave "Nothing (start empty)". Admin cannot be copied.
4. Choose **Add role**. The role gets its own column in both grids.
5. Give the role to people on the **Users** tab (edit the user, change **Role**).

To rename or delete a role you added, use the menu on its row. A role that people still have cannot be deleted: "N user(s) have this role. Give them another role first."

### Change the pages of a role

1. In **Pages by role**, find the row of the page and the column of the role.
2. Choose **No access**, **View only** or **Full**.
3. Repeat for other cells. The card says "You have unsaved changes."
4. Choose **Save changes**. **Discard** drops unsaved changes.

### Change the duties of a role

1. In **Duties by role**, tick or untick the box for the duty and the role.
2. Choose **Save duties**.
3. Check the role also has the duty's page at Full.

### Make an exception for one person

1. In **Exceptions for one person**, choose the **User**.
2. For each page choose a level, or **As the role**.
3. Choose **Save exceptions**. **Same as role** clears all of the person's exceptions.

## When a change takes effect

- **On the server: immediately.** The next request the person makes is checked against the new access.
- **In the person's browser: on the next page they open.** Their menu is rebuilt and a typed address is checked again.
- **In a tab that is left open:** within about a minute, or when the window gets focus. If the person is on a page they have just lost, they are sent to the home page.

Nobody has to sign out and in again.

## Safeguards

| Safeguard | What it prevents |
|---|---|
| Admin always has every page and duty | An admin locking admins out by mistake |
| The Users page cannot be given away | Someone else giving themselves everything |
| "This is the only active admin. Make another user an admin first." | Deleting, deactivating or changing the role of the last active admin |
| "You can't change your own role." | An admin demoting themselves by mistake |
| An admin cannot be given exceptions | A hidden limit on an admin |
| A role in use cannot be deleted | Users left with a role that no longer exists |
| A user whose role is unknown gets no pages | Access by accident |
| Unknown pages, levels, roles and duties are refused | Bad data in the access tables |
| Every change is written to the audit log | Changes nobody can explain later |

Changes to page access appear in the audit log as "Page access of *role*", changes to duties as "Duties of *role*", with what was added and removed. See [Audit and logging](14-audit-and-logging.md).

## Rules that access does not change

Giving someone a page or a duty never switches off a business rule. For example:

- A failed inspection still quarantines material until someone with the duty *Release quarantine* releases it.
- Overselling is still blocked, whoever confirms the order.
- A closed financial period still refuses postings.
- Some things stay with admins whatever the duties: deleting inspections, corrective actions, maintenance work orders, waste and utility records and documents; quality standards; document categories; notification rules; and everything on the Users page.
- Documents are also limited by category: a role sees a document only if its category is opened to that role. See [Documents](07-modules/documents.md).
- Notifications reach a role only if the rule lists the role **and** the role has the page the rule is about. See [Approvals and notifications](07-modules/approvals-and-notifications.md).

## For developers

Everything lives in `backend/apps/access/`.

| Piece | Where | What it does |
|---|---|---|
| `Role`, `RoleDuty` | `models.py` | Roles (`key`, `name`, `description`, `is_system`) and the duties each role carries |
| `RolePage` | `models.py` | One row per role and page, with `level` (`view` or `full`) |
| `UserPageOverride` | `models.py` | One row per user and page, with `level` (`none`, `view`, `full`) |
| `PAGES`, `DEFAULT_ROLE_PAGES` | `services.py` | The page catalogue and the starting pages |
| `DUTIES`, `DEFAULT_ROLE_DUTIES` | `services.py` | The duty catalogue and the starting duties |
| `PAGE_API` | `services.py` | Which API modules each page reads and writes. An entry with a slash (`procurement/open-lines`) is one endpoint |
| `levels_for(user)`, `has_page`, `can_edit`, `has_duty` | `services.py` | The answers the rest of the code asks for |
| `check_api_access(request)` | `services.py` | The gate, described below |
| `AccessConfig.ready()` | `apps.py` | Wraps DRF's `APIView.check_permissions` so the gate runs before every view's own permissions |

`users.CustomUser.role` holds the role's key as plain text. It is validated against the `Role` table in the user serializers.

**The gate.** For every authenticated API request, `check_api_access` works out which pages use the requested module (`READERS` for GET/HEAD/OPTIONS, `WRITERS` for everything else). A read needs one of those pages at any level; a write needs one of them at `full`. Otherwise the request gets 403 with "You do not have access to this part of the system. Ask an admin if you need it." or the view-only message. A few reads are open to every signed-in user (`OPEN_READS`: the user list for name pickers, the caller's own access, role names, the notification bell, the search box, the audit log, which itself limits non-admins to their own entries). `search/trace` is excluded from that (`NOT_OPEN`).

**After the gate**, each view's own permission classes still run. The module ownership classes in `backend/apps/core/permissions.py` (`IsWarehouseOrAdmin`, `HasPage`, ...) follow pages; `HasDuty` and `has_duty` follow duties.

**Caching.** Access is computed once per request and kept on the request object (through the audit middleware's current request). Nothing is cached between requests, which is why changes apply at once.

**Endpoints** (under `/api/v1/access/`):

| Method | Path | Who | What |
|---|---|---|---|
| GET | `me/` | Any signed-in user | Own role, role name, pages, levels and duties |
| GET | `role-names/` | Any signed-in user | Key and name of every role |
| GET, PUT | `matrix/` | Admin | Page levels of every role; PUT `{roles: {role: {page: level}}}` |
| GET, PUT | `duties/` | Admin | Duties of every role; PUT `{roles: {role: [duty]}}` |
| GET, POST | `roles/` | Admin | List roles with user counts; POST `{name, description, copy_from}` |
| PATCH, DELETE | `roles/<id>/` | Admin | Rename or delete a role that was added |
| GET, PUT | `users/<id>/` | Admin | One user's exceptions; PUT `{overrides: {page: level}}` |

**Web app.** The sign-in response and `access/me` carry `pages`, `levels`, `duties` and `role_label`. They are stored in the `erp_user` cookie. `frontend/src/proxy.ts` asks Django for the current values on every page load and redirects away from pages the user lacks. `frontend/src/config/access.ts` builds the menu from the pages. `usePageAccess()` (`features/auth/use-page-access.ts`) gives `readOnly`; `PageHeader` and `RowActions` hide change controls when it is true. `useDuties()` (`features/auth/use-duty.ts`) decides which approval buttons are shown. The screens are `features/users/access-panel.tsx` and `features/users/roles-panel.tsx`. The web app only hides things; the server is what enforces.

**Migrations.** `access/0001`–`0002` create the tables and seed the starting pages; `0003` adds levels; `0004` adds roles and duties and seeds the five built-in roles and the starting duties; `users/0003` lets a user's role be any role key.

**Tests.** `backend/apps/access/tests.py`; browser scenario `frontend/e2e/access.mjs`.

To add a page or a duty, see [Maintenance and changes](17-maintenance-and-changes.md).

## Keeping this page up to date

- `backend/apps/access/services.py`: `PAGES`, `DUTIES`, the defaults, `PAGE_API`, `OPEN_READS` and the gate's messages.
- `backend/apps/access/views.py` and `urls.py`: endpoints and validation messages.
- `backend/apps/users/views.py`: the last-admin and own-role safeguards.
- `frontend/src/features/users/access-panel.tsx` and `roles-panel.tsx`: card names, button labels and messages.
