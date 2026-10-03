# Roles and responsibilities

This page describes the roles the system starts with, what each is responsible for, and how to shape roles for your own organisation. It is for administrators and managers.

## On this page

- [How roles work](#how-roles-work)
- [The built-in roles](#the-built-in-roles)
- [Who does what at the start](#who-does-what-at-the-start)
- [Shaping roles for your organisation](#shaping-roles-for-your-organisation)
- [Good practice](#good-practice)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## How roles work

- Every user has exactly **one role**.
- A role decides which **pages** the user can open and at what level (No access, View only, Full).
- A role also carries **duties**: approvals and other special actions.
- One person can be given **exceptions** on single pages.
- Administrators can **add roles** and change the pages and duties of any role except Admin.

The full explanation, with the starting tables, is in [Access control](05-access-control.md).

## The built-in roles

| Role | Responsible for | Starting pages |
|---|---|---|
| **Admin** | Everything. Manages users and access, approves, and sees every module. Cannot be limited. | All eighteen pages |
| **Warehouse Supervisor** | Receiving deliveries, weighing, suppliers, and raising purchase requests and orders. Inspects incoming material. | Warehouse, Purchasing, Quality, Maintenance, Sustainability, Documents, Traceability |
| **Sorting Supervisor** | Sorting sessions and the lots they produce. Inspects material in process. Runs production stages. | Sorting, Production, Quality, Maintenance, Sustainability, Documents, Traceability |
| **Decolorization Supervisor** | Tanks, chemicals, recipes and decolorization sessions. Inspects material in process. Runs production stages. | Decolorization, Production, Quality, Maintenance, Sustainability, Documents, Traceability |
| **Drying Supervisor** | Dryers and drying sessions; dried output becomes sellable stock. Inspects material in process and finished goods. Runs production stages. | Drying, Production, Quality, Maintenance, Sustainability, Documents, Traceability |

At the start, Dashboard, Approvals, Sales, Finance, Workforce, Reports and Users are open to Admin only.

## Who does what at the start

| Task | Who can do it at the start | Decided by |
|---|---|---|
| Record deliveries, suppliers, factory units | Admin, Warehouse Supervisor | Warehouse page |
| Raise purchase requests and orders, supplier invoices, returns | Admin, Warehouse Supervisor | Purchasing page |
| Approve or reject purchase requests and orders, close orders | Admin | Duty *Approve purchases* |
| Record supplier payments | Admin | Duty *Record supplier payments* |
| Record inspections of deliveries | Admin, Warehouse Supervisor | Duty *Inspect incoming material* |
| Record inspections of lots in process | Admin, Sorting, Decolorization and Drying Supervisors | Duty *Inspect in-process material* |
| Record inspections of finished lots | Admin, Drying Supervisor | Duty *Inspect finished goods* |
| Release material from quarantine | Admin | Duty *Release quarantine* |
| Run sorting, decolorization or drying sessions | Admin and the supervisor of that stage | The stage's page |
| Sign off a decolorization batch | Admin | Duty *Approve decolorization batches* |
| Issue a restricted chemical | Admin | Duty *Issue restricted chemicals* |
| Plan, release and cancel production orders; set up stages, routings, bills of materials | Admin | Duty *Plan production* |
| Start and complete production stages, record materials used | Admin, Sorting, Decolorization and Drying Supervisors | Duty *Run production stages* |
| Report a machine breakdown, work on a work order | Everyone with the Maintenance page | Maintenance page |
| Register machines, plan preventive work, keep spare parts, assign and cancel work orders | Admin | Duty *Manage maintenance* |
| Record waste and utility readings | Everyone with the Sustainability page | Sustainability page |
| Upload and read documents in categories opened to their role | Everyone with the Documents page | Documents page and the category |
| Quotations, sales orders, dispatches, invoices, customer payments | Admin | Sales page |
| Approve or reject customer returns | Admin | Duty *Approve sales returns* |
| Adjust sellable stock by hand | Admin | Duty *Adjust stock* |
| Finance, Workforce, Reports, Dashboard, Approvals inbox | Admin | Those pages |
| Users, roles, access, notification rules, document categories, quality standards | Admin | Admin only, always |

## Shaping roles for your organisation

The built-in roles suit a small factory where the owner or manager is the admin. A larger organisation usually wants more. Some examples, each built on the **Access** tab of the Users page:

| Need | How to set it up |
|---|---|
| An accountant | Add a role "Accountant". Give it Finance at Full, and Sales and Purchasing at View only. Add the duty *Record supplier payments* and set Purchasing to Full if they should record payments. |
| A sales team | Add a role "Sales Officer" with Sales at Full and Traceability. Keep *Approve sales returns* with the admin, or add a "Sales Manager" role that has it. |
| A purchase manager who approves | Add a role copied from Warehouse Supervisor, and add the duty *Approve purchases*. |
| A quality officer | Add a role with Quality at Full and the three inspection duties and *Release quarantine*. |
| A production planner | Add a role with Production at Full and the duty *Plan production*. |
| A maintenance head | Add a role with Maintenance at Full and the duty *Manage maintenance*. |
| An auditor or owner who only looks | Add a role with the pages they need at View only, plus Reports and Dashboard. |
| One supervisor who should also see Sales | Use an exception for that person: Sales at View only. |

## Good practice

- **Keep at least two active admins.** The system refuses to remove the last one, but a second admin also covers holidays and lost passwords.
- **Give the least that does the job.** Prefer View only when someone only needs to check figures.
- **Separate asking from approving.** The person who raises purchase orders should not usually hold *Approve purchases*.
- **Prefer roles to exceptions.** If three people need the same exception, make it a role.
- **Review access when someone changes job.** Change their role and clear old exceptions.
- **Deactivate leavers; do not delete them.** Their name stays on the records they made. See [Admin guide](06-admin-guide.md).

## Keeping this page up to date

- `backend/apps/access/services.py`: `DEFAULT_ROLE_PAGES`, `DUTIES`, `DEFAULT_ROLE_DUTIES`.
- `backend/apps/access/migrations/0004_roles_and_duties.py`: the built-in roles and their descriptions.
- Any place a rule moves between "Admin only" and a duty (search the backend for `has_duty(` and `is_admin(`).
