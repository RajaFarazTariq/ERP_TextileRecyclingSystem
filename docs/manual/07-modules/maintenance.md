# Maintenance

This page explains the Maintenance module: the machine register, work orders for breakdowns and planned upkeep, preventive schedules, spare parts, and the performance report. It is for anyone who reports or repairs breakdowns, for whoever manages maintenance, for administrators, and for developers who maintain the module.

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

The module keeps the factory's equipment in order.

- **Machines**: a register of every machine, with its status.
- **Work orders**: one job on one machine. A work order is either **Corrective** (a repair) or **Preventive** (planned upkeep). Work orders are numbered WO-00001, WO-00002 and so on.
- **Schedules**: a preventive task repeated every so many days on one machine.
- **Spare parts**: a small parts store with stock, reorder levels and costs.
- **Performance**: breakdowns, downtime, cost and availability per machine.

A work order changes the status of its machine while the machine is being repaired. A machine can be linked to a decolorization tank or a dryer so that its downtime is shown beside the batches run on that equipment. Maintenance never changes the tank or the dryer itself.

## Who can use it

| Who | Starting access to the page |
|---|---|
| Admin | Full |
| Every supervisor role | Full |

What a user may do depends on the duty *Manage maintenance*, which only Admin holds at the start. This page calls a user with that duty a **manager**.

| Action | Who |
|---|---|
| Read everything | Anyone who can open the page |
| Report a breakdown (a corrective work order) | Anyone with Full access to the page |
| Start and complete a work order, and use parts on it | A manager; or anyone, if the work order is assigned to them or to nobody |
| Correct a work order they reported, while it is Open | The person who reported it |
| Change any unfinished work order, assign it, move it to another machine | Needs the duty *Manage maintenance* (Admin by default) |
| Create a preventive work order | Needs the duty *Manage maintenance* |
| Cancel a work order | Needs the duty *Manage maintenance* |
| Add, change and delete machines, schedules and spare parts; receive spare parts | Needs the duty *Manage maintenance* |
| Remove a part from a work order | The duty *Manage maintenance* (Admin by default) |
| Delete a work order | Admin only |

With **View only** access the add buttons are replaced by a "View only" badge and row menus keep only **Parts used**.

How access and duties are changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/maintenance`. Its title is **Maintenance** and it has six tabs.

Buttons at the top right:

| Tab | Managers see | Others see |
|---|---|---|
| Dashboard, Work orders, Performance | New work order | Report breakdown |
| Machines | Add machine, New work order | Report breakdown |
| Schedules | New schedule, New work order | Report breakdown |
| Spare parts | Add spare part, New work order | Report breakdown |

### Dashboard tab

| Part | Shows |
|---|---|
| Machines running | Running machines out of all machines that are not Retired, with the number broken down or under maintenance |
| Open work orders | Work orders Open or In progress, with how many are in progress and how many are urgent |
| Downtime, this month | Hours of downtime on work orders reported this month, and the number of breakdowns |
| Maintenance cost, this month | Labour, parts and other costs of work orders reported this month |
| Work in hand | Up to 6 unfinished work orders. Click one to open it |
| Machines by status | A bar with the count per status |
| Overdue preventive work | Up to 5 overdue schedules, or "Nothing is overdue" with the number due in the next 7 days |
| Parts to reorder | Up to 5 parts at or below their reorder level |

Cancelled work orders are left out of the monthly figures.

### Machines tab

| Column | Shows |
|---|---|
| Machine | Code and name |
| Category | Category |
| Location | Location |
| Make and model | Manufacturer and model. Hover for the specifications |
| Linked to | "Tank: …" or "Dryer: …" |
| Open jobs | Number of unfinished work orders |
| Status | Running, Idle, Under maintenance, Broken down or Retired |

Tools: search ("Search machine, category, location…"), **Columns**, **Export** (`machines-<date>.csv`). Row actions (managers): **Edit**, **Delete**.

### Work orders tab

| Column | Shows |
|---|---|
| Work order | Number and type |
| Machine | Code and name |
| Job | The title, with a **Breakdown** badge |
| Priority | Low, Normal, High or Urgent |
| Assigned to | Username, or "Nobody yet" |
| Reported | Date reported |
| Cost | Total cost |
| Status | Open, In progress, Done or Cancelled |

Tools: search ("Search work order, machine, job…"), a **Status** filter (All statuses, Not finished, or one status; it starts at Not finished), a **Type** filter, **Columns**, **Export** (`work-orders-<date>.csv`).

Row actions:

| Action | When it is offered |
|---|---|
| **Parts used** | Always. Opens the work order panel |
| **Start** | The work order is Open and you may work on it |
| **Complete** | The work order is not finished and you may work on it |
| **Cancel** | The work order is not finished and you are a manager |
| **Edit** | The work order is not finished and you are a manager, or it is Open and you reported it |
| **Delete** | Admin |

"You may work on it" means: you are a manager, or the work order is assigned to you or to nobody.

The **work order panel** ("Work order WO-…") shows the status, priority, title and details, the type, who reported it and when, who it is assigned to, the start and completion dates, downtime, labour, other cost, parts cost and total cost, the work done, and the list of parts used. While the work order is not finished, a **Use a part** form lets you add parts.

### Schedules tab

| Column | Shows |
|---|---|
| Task | Task name. Hover for the instructions |
| Machine | Code and name |
| Every | Interval in days |
| Last done | Date, or "Never" |
| Next due | Date, with "Due in 5 days", "Due today" or "12 days overdue" |
| Status | Not in use, Work order open (with its number), Overdue or On schedule |

Tools: search ("Search task or machine…"), **Columns**, **Export** (`maintenance-schedules-<date>.csv`). Row actions (managers): **Create work order** (the schedule is In use and has no unfinished work order), **Edit**, **Delete**.

### Spare parts tab

| Column | Shows |
|---|---|
| Code | Part code |
| Part | Name |
| In stock | Quantity and unit, with a **Low stock** badge at or below the reorder level |
| Reorder at | Reorder level |
| Cost per unit | Current cost |
| Stock value | In stock × cost per unit |
| Location | Store location |

Tools: search ("Search code, part, location…"), **Columns**, **Export** (`spare-parts-<date>.csv`). Row actions (managers): **Receive**, **Edit**, **Delete**.

### Performance tab

A period filter. With "All time" the report covers the last 90 days, and the screen says so.

| Part | Shows |
|---|---|
| Availability | "Time the machines were not stopped for repair", over all machines |
| Breakdowns | Number, "By the date they were reported" |
| Downtime | Hours, "Recorded on work orders" |
| Maintenance cost | "Labour, parts and other costs" |
| Table | Per machine: Breakdowns, Downtime, Availability, Time between failures, Maintenance cost, Cost of downtime. Export: `machine-performance-<date>.csv` |
| Effect on production | For each machine linked to a tank or dryer: its downtime and breakdowns beside the number of decolorization or drying batches run on that equipment in the period |

## Records and fields

### Machine

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Code | Short code, e.g. "SH-01" | Yes | Up to 30 characters. Unique |
| Name | e.g. "Fabric shredder" | Yes | Up to 150 characters |
| Category | Free text with suggestions: Sorting line, Tank, Dryer, Baler, Shredder, Utility | No | Up to 60 characters |
| Location | e.g. "Sorting hall" | No | Up to 120 characters |
| Status | See [Statuses](#statuses) | Yes | Starts as Running |
| Running cost per hour (Rs.) | Used to value downtime | No | Zero or more |
| Linked tank or dryer | "Shows the machine's downtime next to the batches run on it" | No | A tank or a dryer, not both. The list holds every tank and every dryer |
| Manufacturer, Model, Serial number | Details | No | Up to 120 characters each |
| Installed on | Date | No | |
| Specifications | "Capacity, power, sizes" | No | |
| Notes | Free text | No | |

### Work order

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Machine | The machine. Retired machines are not offered | Yes | |
| Job (managers) / What is wrong (others) | A short title | Yes | Up to 200 characters. "Say what is wrong or what has to be done." |
| Details | "What you saw or heard, and since when" | No | |
| Type | "Corrective (repair)" or "Preventive (planned)". Shown to managers only | Yes | Others always create Corrective work orders |
| Priority | Low, Normal, High or Urgent | Yes | Starts as Normal for managers and High for others |
| Machine stopped | Yes or No. Shown for Corrective work orders | Yes | Yes marks the work order as a breakdown. Starts as Yes for non-managers and No for managers |
| Assigned to | An active user. Shown to managers only | No | "Leave empty to let anyone pick it up" |
| Number | WO-00001 … | Automatic | |
| Reported by, reported at | Who and when | Automatic | |
| Started at, completed at | When | Automatic | |

Entered when completing:

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Work done | "What was repaired, replaced or checked" | Yes | "Describe the work that was done." |
| Downtime, minutes | "How long the machine was stopped" | No | Whole minutes, zero or more |
| Labour hours | Hours worked | No | Zero or more |
| Labour cost (Rs.) | Cost of labour | No | Zero or more |
| Other cost (Rs.) | "Outside services, transport" | No | Zero or more |

Calculated: **Parts cost** = sum of the parts used; **Total cost** = labour cost + other cost + parts cost.

### Part used

| Field (label) | Meaning | Rules |
|---|---|---|
| Part | A spare part. Options read "name (quantity in stock)" | Required |
| Quantity | How many | Greater than zero, not more than is in stock |
| Cost per unit | The part's cost on that day | Automatic. Later price changes do not alter it |
| Used by | The user who added it | Automatic |

### Schedule

"Preventive work repeated every few days. The next due date is counted from the last time it was done."

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Machine | The machine | Yes | |
| Task | e.g. "Grease conveyor bearings" | Yes | Up to 150 characters. "Name the task." |
| Every (days) | The interval | Yes | 1 or more. Starts as 30 |
| Status | In use or Not in use | Yes | |
| First due on | "Used until the task is done once" | Yes | Starts as today |
| Last done on | When it was last done | No | Set automatically when its work order is completed |
| Instructions | "Copied into each work order" | No | |
| Next due | Last done + interval, or the first due date if never done | Automatic | |

### Spare part

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Code | e.g. "BRG-6205" | Yes | Up to 30 characters. Unique |
| Unit | "pcs, L, set" | Yes | Up to 20 characters. Starts as pcs |
| Name | e.g. "Bearing 6205-2RS" | Yes | Up to 150 characters |
| In stock | Opening stock | No | Can be typed in only when the part is created. Zero or more |
| Reorder level | "Flagged when stock is at or below this" | No | Zero or more |
| Cost per unit (Rs.) | Current cost | No | Zero or more |
| Store location | e.g. "Rack A2" | No | Up to 120 characters |

The **Receive** form has **Quantity received** (required, greater than zero) and **New cost per unit (Rs.)** (optional; leave empty to keep the current cost).

## Statuses

### Machine

| Status | Meaning |
|---|---|
| Running | In normal use. The default |
| Idle | Not in use, but nothing wrong |
| Under maintenance | A work order on it is In progress |
| Broken down | It has an unfinished work order marked as a breakdown |
| Retired | No longer in service |

The status can be chosen by hand in the machine form. It is also set automatically whenever a work order on the machine is created, changed, started, completed, cancelled or deleted:

1. A Retired machine is never changed.
2. If any unfinished work order is a breakdown, the machine becomes **Broken down**.
3. Otherwise, if any work order is In progress, it becomes **Under maintenance**.
4. Otherwise, if it was Broken down or Under maintenance, it goes back to **Running**.
5. Otherwise it is left as it is (so an Idle machine stays Idle).

### Work order

| Status | How it is reached |
|---|---|
| Open | Every new work order |
| In progress | **Start**, from Open |
| Done | **Complete**, from Open or In progress, with the work done |
| Cancelled | **Cancel**, from Open or In progress (managers) |

A work order that is Done or Cancelled cannot be changed, and its parts cannot be changed.

### Schedule

The Status column is worked out, in this order:

| Shown | When |
|---|---|
| Not in use | The schedule is switched off |
| Work order open | It has an unfinished work order |
| Overdue | It is In use and its next due date is before today |
| On schedule | Otherwise |

### Spare part

A part shows **Low stock** when its stock is at or below its reorder level.

## How to

### Report a breakdown

1. Click **Report breakdown**.
2. Choose the **Machine** and say **What is wrong**. Add **Details** if you can.
3. Choose the **Priority**. Leave **Machine stopped** as Yes if the machine cannot run.
4. Click **Report**.

The machine is marked Broken down until the work is done.

### Carry out a work order

1. On the **Work orders** tab, choose **Start** on the row. The message "Work started." appears.
2. Choose **Parts used**. In the panel, under **Use a part**, choose the part and the quantity and click **Add part**. The quantity leaves the spare parts stock.
3. When the job is finished choose **Complete**.
4. Describe the **Work done**. Enter the downtime, labour hours and costs if you have them.
5. Click **Complete**. The message "Work order completed." appears and the machine goes back to Running.

Add all parts before completing. They cannot be changed afterwards.

### Register a machine (manager)

1. Open the **Machines** tab and click **Add machine**.
2. Enter the **Code** and the **Name**. Fill in what else you know.
3. Optionally choose the **Linked tank or dryer**.
4. Click **Save**.

### Plan preventive work (manager)

1. Open the **Schedules** tab and click **New schedule**.
2. Choose the **Machine**, enter the **Task** and the interval under **Every (days)**.
3. Set **First due on**. Add **Instructions** if useful.
4. Click **Save**.
5. When the task is due, choose **Create work order** on the row. The message "Work order created." appears. The work order takes the task as its title and the instructions as its details.
6. When that work order is completed, the schedule's "Last done" becomes the completion date and the next due date moves forward.

### Add and receive spare parts (manager)

1. Open the **Spare parts** tab and click **Add spare part**. Enter the code, unit, name, opening stock, reorder level and cost. Click **Save**.
2. When more arrive, choose **Receive** on the row. Enter the **Quantity received** and, if the price changed, the **New cost per unit (Rs.)**. Click **Receive**. The message "Stock received." appears.

### Cancel a work order (manager)

1. Choose **Cancel** on the row.
2. Confirm with **Cancel work order**. "The work order is closed without being done, and the machine goes back to its normal status. Parts already used stay on it."

## Business rules

### Who may do what

| Rule | Message |
|---|---|
| Machines, schedules and spare parts are changed only with the duty *Manage maintenance* (Admin by default) | "Your role is not allowed to manage maintenance." |
| Cancelling a work order needs the same duty | Same message |
| Without the duty, a user may create only Corrective work orders | "Only an admin can create preventive work orders." |
| Without the duty, a user may not assign a work order | "Only an admin can assign a work order." |
| Without the duty, a user may change a work order only if they reported it and it is still Open | "Only an admin can change this work order." |
| Without the duty, a user may not move a work order to another machine | "Only an admin can move a work order to another machine." |
| Starting, completing and using parts on a work order assigned to someone else needs the duty | "This work order is assigned to someone else." |
| Deleting a work order is for the Admin role only | "Only an admin can delete maintenance records." |
| Removing a part from a work order needs the duty *Manage maintenance* | "Your role is not allowed to remove parts from a work order." |

Several messages say "Only an admin" although the server checks the duty *Manage maintenance*. A custom role that holds the duty is allowed.

### Work orders

| Rule | Message |
|---|---|
| A work order cannot be raised on a retired machine, or moved to one | "This machine is retired." |
| A finished work order cannot be changed | "A work order that is done can't be changed." (or "cancelled") |
| Only an Open work order can be started | "Only an open work order can be started." |
| Completing needs a description of the work | "Describe the work that was done." |
| Downtime must be whole minutes | "Enter whole minutes." |
| Hours and costs must be numbers, zero or more | "Enter a number." / "Can't be negative." |
| Completing a work order that was never started sets its start time to the completion time | (none) |
| Completing a work order raised from a schedule sets the schedule's "Last done" to the completion date | (none) |
| Cancelling a work order raised from a schedule leaves the schedule due | (none) |
| A machine with work orders cannot be deleted. A work order with parts used cannot be deleted | "This record cannot be deleted because other records depend on it: …" |

### Schedules

| Rule | Message |
|---|---|
| The interval must be at least 1 day | "Must be at least 1 day." |
| A schedule that is Not in use raises no work order | "This schedule is not in use." |
| A schedule has one unfinished work order at a time | "WO-00012 is still open for this schedule." |
| Deleting a machine also deletes its schedules | (none) |

### Spare parts

| Rule | Message |
|---|---|
| Stock, reorder level and cost cannot be negative | "Can't be negative." |
| After a part exists, its stock changes only by receiving and by use on work orders | "Use “Receive” to add stock." |
| Receiving needs a quantity | "Enter the quantity received." |
| A cost given when receiving becomes the part's current cost | (none) |
| Parts cannot be added to a finished work order | "Parts can't be added to a work order that is done." |
| The quantity used must be greater than zero | "Must be greater than zero." |
| More than is in stock cannot be used | "Only 3 pcs of Bearing 6205-2RS in stock." |
| Using a part takes it out of stock and keeps the cost of that day on the work order | (none) |
| Removing a part from a work order puts the quantity back into stock | (none) |
| Parts cannot be removed from a finished work order | "Parts can't be removed from a work order that is done." |
| A part that has been used cannot be deleted | "This record cannot be deleted because other records depend on it: …" |

### Machines

| Rule | Message |
|---|---|
| The code must be unique | A uniqueness error from the server |
| A machine links to a tank or a dryer, not both | "Link a machine to a tank or a dryer, not both." |
| The running cost cannot be negative | "Can't be negative." |

### How the performance figures are worked out

- The report covers work orders **reported** in the period. Cancelled work orders are left out.
- With no period, the last 90 days are used. A period never runs past today.

| Figure | Definition |
|---|---|
| Breakdowns | Work orders in the period marked as a breakdown |
| Downtime | Sum of the downtime minutes on the work orders, in hours |
| Availability | (Hours in the period − downtime) ÷ hours in the period. Hours in the period are 24 per day. The headline figure uses all machines together |
| Time between failures | Days from the first to the last breakdown ÷ (breakdowns − 1). Needs at least two breakdowns |
| Maintenance cost | Total cost of the work orders |
| Cost of downtime | Downtime hours × the machine's running cost per hour |
| Effect on production | For a machine linked to a tank: decolorization sessions started in the period in that tank. For a dryer: drying sessions created in the period in that dryer |

Every add, change, start, completion, cancel, receipt and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Decolorization](decolorization.md) | A machine can be linked to a tank. The performance report counts the tank's sessions. Maintenance never changes the tank |
| [Drying](drying.md) | A machine can be linked to a dryer. The dryer has its own "Maintenance" status, which is separate from the machine status here and is not changed by work orders |
| [Approvals and notifications](approvals-and-notifications.md) | Breakdowns, overdue preventive work and low spare parts raise alerts |
| [Search and traceability](search-and-traceability.md) | Machines and work orders can be found by search |
| [Users](users.md) | Reporters, assignees and the people who used parts are users |

Spare parts are a separate store. They are not connected to Purchasing, Inventory or Finance.

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/maintenance/models.py`

| Model | Notes |
|---|---|
| `Machine` | `code` (unique), `name`, `category`, `location`, `manufacturer`, `model`, `serial_number`, `specifications`, `installed_on`, `status`, `hourly_operating_cost`, `notes`, `tank` and `dryer` (both `SET_NULL`) |
| `MaintenanceSchedule` | `machine` (`CASCADE`), `task`, `every_days`, `start_date`, `last_done_on`, `next_due_on` (set in `save()`), `instructions`, `is_active` |
| `WorkOrder` | A `NumberedModel` with prefix `WO`. `machine` (`PROTECT`), `kind`, `schedule` (`SET_NULL`), `title`, `description`, `priority`, `status`, `is_breakdown`, `reported_by`, `assigned_to`, `reported_at`, `started_at`, `completed_at`, `downtime_minutes`, `labour_hours`, `labour_cost`, `other_cost`, `work_done`. Properties `closed`, `parts_cost`, `total_cost` |
| `SparePart` | `code` (unique), `name`, `unit`, `stock_quantity`, `reorder_level`, `unit_cost`, `location`. Property `low` |
| `PartUse` | `work_order` and `part` (both `PROTECT`), `quantity`, `unit_cost`, `used_by`. Property `cost` |

### Services

`backend/apps/maintenance/services.py`

| Function | Purpose |
|---|---|
| `refresh_machine(machine)` | Sets the machine status from its unfinished work orders |
| `check_may_work(user, order)`, `check_open(order)` | Who may work on an order; closed orders are fixed |
| `start`, `complete`, `cancel` | Work order steps |
| `create_preventive(schedule, user)` | Raises the work order for a schedule |
| `use_part`, `return_part`, `receive` | Spare part stock movements. They lock the part row |
| `period(params)`, `orders_between`, `performance(params)` | The performance report |

Work figures (`downtime_minutes`, `labour_hours`, `labour_cost`, `other_cost`, `work_done`) are read-only on the work order serializer. They are recorded only by the `complete` action.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/maintenance/machines/` and `/<id>/` | Machines. Filter: `status` |
| GET, POST | `/api/v1/maintenance/schedules/` and `/<id>/` | Schedules. Filter: `machine` |
| POST | `/api/v1/maintenance/schedules/<id>/create-work-order/` | Raise the preventive work order |
| GET, POST | `/api/v1/maintenance/work-orders/` and `/<id>/` | Work orders, each with its `parts`. Filters: `status`, `kind`, `machine` |
| POST | `/api/v1/maintenance/work-orders/<id>/start/` | Start |
| POST | `/api/v1/maintenance/work-orders/<id>/complete/` | Complete. Body: `work_done`, optional `downtime_minutes`, `labour_hours`, `labour_cost`, `other_cost` |
| POST | `/api/v1/maintenance/work-orders/<id>/cancel/` | Cancel |
| GET, POST | `/api/v1/maintenance/parts/` and `/<id>/` | Spare parts |
| POST | `/api/v1/maintenance/parts/<id>/receive/` | Receive stock. Body: `quantity`, optional `unit_cost` |
| GET, POST | `/api/v1/maintenance/part-uses/` | List or add parts used. Filter: `work_order` |
| GET, DELETE | `/api/v1/maintenance/part-uses/<id>/` | One part use. There is no update: remove it and enter it again |
| GET | `/api/v1/maintenance/summary/` | Dashboard figures |
| GET | `/api/v1/maintenance/performance/` | Performance report. Takes the shared period parameters |

### Permissions

Defined in `backend/apps/maintenance/views.py`:

| Class | Used by | Rule |
|---|---|---|
| `IsManagerForWrites` | Machines, schedules, spare parts | Any valid role reads; writes need the duty `manage_maintenance` |
| `IsMaintenanceUser` | Work orders, summary, performance | Any valid role reads and writes; `DELETE` needs the `admin` role (`is_admin`) |
| `IsPartUser` | Part uses | Any valid role reads and adds; `DELETE` needs the duty `manage_maintenance` |
| `IsAdminAction` | Work order `cancel` | Needs the duty `manage_maintenance` |

The finer rules for work orders are in `WorkOrderSerializer.validate` and `services.check_may_work`.

The API gate requires the Maintenance page (any level to read, Full to change). `PAGE_API` lets the page read the decolorization API and the dryer list (`drying/dryers`) for the machine form. The screen asks for tanks and dryers only when the user is a manager.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/maintenance/page.tsx` | The route |
| `frontend/src/features/maintenance/maintenance-page.tsx` | Tabs, tables and the dashboard |
| `frontend/src/features/maintenance/maintenance-forms.tsx` | Machine, schedule, work order, completion, spare part and receive forms; `WorkOrderSheet`; `MAINTENANCE_LISTS` |
| `frontend/src/features/maintenance/performance-panel.tsx` | The Performance tab |
| `frontend/src/features/maintenance/schemas.ts` | Form rules, status lists, `minutesText`, `dueText` |
| `frontend/src/types/maintenance.ts` | The record and report types |

In the forms, the property named `admin` means "holds the duty *Manage maintenance*", not the Admin role.

### Tests

- Backend: `backend/apps/maintenance/tests.py` covers machines, who reports and plans, machine status through start, complete, breakdown and cancel, retired machines, assigned orders, closed orders, who edits and deletes, schedules and their due dates, spare part stock and costs, the summary and the performance report, and the demo data.
- Browser: `frontend/e2e/maintenance.mjs` covers adding a machine and a part, the Low stock flag, receiving, an overdue schedule and its work order, what a supervisor sees, reporting a breakdown, starting, using parts, completing with costs, the schedule moving forward, and the performance table.

`backend/apps/maintenance/demo.py` adds and removes demonstration data for the `seed_module_data` management command.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "This work order is assigned to someone else." | The work order is assigned to another user | Ask a manager to reassign it or to clear "Assigned to" |
| No **Start** or **Complete** on a row | Same cause | Same fix |
| The machine still shows Broken down after a job was completed | Another unfinished work order on it is marked as a breakdown | Complete or cancel that work order too |
| The machine did not go back to Idle | After repair a machine returns to Running | Set it to Idle by hand in the machine form |
| "… is still open for this schedule." | The schedule already has an unfinished work order | Complete or cancel it first |
| The In stock field is greyed out when editing a part | Stock changes only by receiving and by use | Use **Receive**. To lower stock, record the use on a work order |
| The "Linked tank or dryer" list is empty | No tank or dryer has been added yet | Add the tank on the Decolorization page or the dryer on the Drying page, then set the link |
| A machine cannot be deleted | It has work orders | Set its status to Retired |
| The Performance tab shows only 90 days under "All time" | By design | Choose By year or a Custom range for a longer period |

## Keeping this page up to date

- `backend/apps/maintenance/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, statuses, rules, messages, permissions and endpoints.
- `frontend/src/features/maintenance/`: tabs, columns, buttons, labels and which actions each user sees.
- `backend/apps/access/services.py` (`DUTIES`, `PAGE_API`): the duty *Manage maintenance*, and what the page reads from other modules.
