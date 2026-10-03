# Workforce

This guide covers the Workforce page: departments, job roles, shifts, employees, daily attendance, leave requests, task assignments and the productivity report. It is for administrators and whoever looks after staff records.

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

Workforce keeps a register of the people who work in the factory and what they did:

- **Employees**, with their department, job role, usual shift and contact details.
- **Attendance**: one record per employee per day, marked for everyone at once on a daily sheet.
- **Leave requests**, which wait for a decision.
- **Tasks** given to employees, with the hours spent and the kg produced.
- A **productivity** report built from attendance and finished tasks.

What it does not do:

- It does not handle pay.
- An employee is not a user. Most floor workers have no login. An employee can be linked to a login, but that link changes nothing about what the user may do.
- Tasks are notes for the workforce records. They do not start sorting, decolorization or drying sessions and move no stock.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| All supervisors | No access |

Employee data is personal, so both reading and changing need the Workforce page. No duty is involved: anyone who holds the page at Full can do everything on it, including approving leave. With the page at View only, a user can look but not change.

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/workforce`. It has seven tabs.

| Tab | Top-right button |
|---|---|
| Dashboard | **Add employee** |
| Employees | **Add employee** |
| Attendance | **Add one record** |
| Leave | **New leave request** |
| Tasks | **Assign task** |
| Productivity | none |
| Setup | none (each section has its own button) |

### Dashboard

| Card | Shows |
|---|---|
| Active employees | Employees with status Active. The hint says how many more are on long leave, or the number of departments |
| Present today | Present, Half day and Late today. The hint shows late, absent and not marked |
| On leave today | Employees with approved leave covering today. The hint counts requests waiting for a decision |
| Hours worked, this month | Hours from this month's attendance, with overtime and open tasks in the hint |

Then:

- A chart **Attendance** for the last 7 days, stacked by status.
- **Employees by department** (people who have left are not counted).
- **Leave requests waiting**: up to six pending requests, each with **Reject** and **Approve**.

### Employees

Columns: Employee (name and code), Department, Job role, Shift, Type, Phone, Joined, Status.

Filter: employee status. Row actions: **Edit**, **Delete**.

### Attendance

Two parts.

**The daily sheet** lists every current employee for one date. Choose the **Date** (not in the future) and optionally a **Shift**. Each row has a status, a check-in time, a check-out time and the hours worked out from them. Under each name the sheet says "Not saved yet" or "On sick leave" where that applies. A search box filters the rows, and badges count each status. **Save attendance** saves the whole list in one step.

- A row with a saved record shows that record.
- A row for someone with approved leave on that date starts as **Leave**.
- Any other row starts as **Present** with the shift's start and end times.
- With a shift chosen, the sheet lists that shift's people, people with no fixed shift, and anyone already recorded on that shift for the day.

**Attendance records** is a table of saved records for a period (default: This week). Columns: Date, Employee, Shift, Status, In, Out, Hours, Overtime, Notes. Row actions: **Edit**, **Delete**.

### Leave

Columns: Employee, Type, From, To, Days, Reason, Status (with who decided).

Filter: leave status.

| Row action | Shown when |
|---|---|
| Approve | Status is Pending |
| Reject | Status is Pending. Asks for an optional reason |
| Edit | Status is Pending |
| Delete | Always |

### Tasks

Columns: Task (with its reference), Employee, Date, Area, Hours, Output, Status.

Filter: task status.

| Row action | Shown when |
|---|---|
| Start | Status is Assigned |
| Mark as done | Status is not Done |
| Edit, Delete | Always |

### Productivity

For a period (default: This month):

- Cards: **Hours worked**, **Absences**, **Tasks done**, **Output**.
- A table per employee: Days present, Absences, Late days, Hours worked, Overtime, Tasks done, Output, Kg per hour. It has an **Export** button.
- A table **By department** with the same figures.

### Setup

Three lists, each with its own add button: **Departments** (**New department**), **Job roles** (**New job role**) and **Shifts** (**New shift**). Each row has **Edit** and **Delete**.

## Records and fields

### Department

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. Sorting | Yes | Unique |
| Status | In use or Not in use | Yes | Departments not in use are not offered for new employees |
| Description | | No | |

### Job role

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Title | e.g. Tank operator | Yes | Unique |
| Department | The department the role belongs to | No | Empty means a role found in every department |
| Description | | No | |

A job role is a job title. It has nothing to do with the access roles under Users.

### Shift

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. Morning | Yes | Unique |
| Starts, Ends | Times | Yes | Cannot be the same. An end before the start means the shift ends the next day |
| Status | In use or Not in use | Yes | |

The length in hours is worked out and shown.

### Employee

Code format: `EMP-00001`, given when the employee is saved.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Full name | | Yes | |
| Department | | Yes | |
| Job role | | Yes | The list shows roles of the chosen department and roles with no department |
| Usual shift | | No | "No fixed shift" when empty |
| Employment type | Permanent, Contract or Daily wage | Yes | Defaults to Permanent |
| Joined on | | Yes | Defaults to today |
| Status | Active, On leave or Left | Yes | Defaults to Active |
| Left on | Shown when status is Left | No | Empty uses today. Not before the joining date |
| Phone | | No | |
| CNIC / national ID | | No | |
| Address | | No | |
| Emergency contact | Name, relation and phone | No | |
| Login | The user account, for staff who sign in | No | A login belongs to one employee |
| Notes | | No | |

### Attendance

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Employee | | Yes | Cannot be changed on an existing record |
| Date | | Yes | Not in the future. One record per employee per day |
| Status | Present, Late, Half day, Absent or Leave | Yes | Defaults to Present |
| Shift | | No | On the sheet, a new record takes the chosen shift, or else the employee's usual shift |
| Check-in, Check-out | Times | No | A check-out needs a check-in |
| Hours worked | | No | Worked out from the times unless typed. 0 to 24 |
| Overtime hours | | No | 0 to 24 |
| Notes | | No | Up to 255 characters |
| Recorded by | | Set by the system | |

### Leave request

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Employee | | Yes | |
| Leave type | Annual, Sick, Casual or Unpaid | Yes | Defaults to Annual |
| First day, Last day | | Yes | Last day not before the first. Both days count |
| Reason | | No | |
| Days | | Worked out | |
| Status, decided by, decided at, decision note | | Set by the system | |

### Task

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Employee | | Yes | |
| Task | A short title | Yes | Up to 150 characters |
| Date | | Yes | Defaults to today |
| Status | Assigned, In progress or Done | Yes | Defaults to Assigned |
| Area | Warehouse, Sorting, Decolorization, Drying, Maintenance or Other | No | |
| Reference | What the task is about, e.g. "Tank A-01" | No | Free text |
| Hours spent | | No | Not negative |
| Output (kg) | | No | Not negative |
| Details | | No | |
| Assigned by | | Set by the system | |

## Statuses

### Employee

| Status | Meaning |
|---|---|
| Active | Working |
| On leave | Away for a long time but still on the books. Still listed on the attendance sheet |
| Left | No longer employed. Not listed on the sheet or offered in forms. Records are kept |

The status is set by hand in the employee form. Approving a leave request does not change it.

### Attendance

Present, Late, Half day, Absent, Leave. Present, Late and Half day count as "came to work". Absent and Leave keep no times and no hours.

### Leave request

| Status | How it gets there |
|---|---|
| Pending | Created |
| Approved | **Approve** |
| Rejected | **Reject** |

### Task

| Status | How it gets there |
|---|---|
| Assigned | Created |
| In progress | **Start**, or chosen in the form |
| Done | **Mark as done**, or chosen in the form |

Any status can be chosen in the task form at any time.

## How to

### Set up before adding people

1. Open **Workforce** and the **Setup** tab.
2. Add the **Departments** (for example Warehouse, Sorting, Drying).
3. Add the **Job roles** (for example Sorter, Tank operator).
4. Add the **Shifts** (for example Morning, 06:00 to 14:00).

### Add an employee

1. Press **Add employee**.
2. Fill in the name, department and job role. Choose the usual shift if there is one.
3. Add contact details if you have them.
4. Choose a **Login** only if this person signs in to the system.
5. Press **Save**. The employee code is given by the system.

### Mark attendance for the day

1. Open the **Attendance** tab.
2. Check the **Date**. Choose a **Shift** to mark one shift at a time.
3. Change the status and times of anyone who was late, absent or on a half day. Everyone else is already Present for the shift's hours.
4. Press **Save attendance**.

Saving again on the same date updates the records; it does not create second ones. The save includes rows hidden by the search box.

### Correct one attendance record

1. In **Attendance records**, choose **Edit** on the row.
2. Change the status, times, hours or overtime and press **Update**.

To type the hours by hand (for example to take off a break), type them in **Hours worked**. Typed hours are kept until the times are changed.

### Record and decide a leave request

1. Open the **Leave** tab and press **New leave request**.
2. Choose the employee, the type and the first and last day. Press **Save**.
3. Choose **Approve** or **Reject** in the row menu, on the Dashboard tab, or on the Approvals page.

Approved leave is suggested as "Leave" on the attendance sheet for those days. It is not saved as attendance until the sheet is saved.

### Assign a task and record the work

1. Open the **Tasks** tab and press **Assign task**.
2. Choose the employee, say what has to be done, and set the date and area.
3. When the work starts choose **Start**; when it is finished choose **Mark as done**.
4. Choose **Edit** to fill in **Hours spent** and **Output (kg)**. These feed the productivity report.

### When someone leaves

Edit the employee and set **Status** to Left. Do not delete them: their attendance, leave and tasks stay on record.

## Business rules

### Setup

| Rule | Message |
|---|---|
| Department names, job role titles and shift names are unique | A message from the server such as "department with this name already exists." |
| A shift's end cannot be the same as its start | "The end can't be the same as the start." |
| A shift that ends at or before its start ends the next day; 22:00 to 06:00 is 8 hours | |
| A department or job role in use cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| Deleting a shift clears it from the employees and attendance records that used it | |

### Employees

| Rule | Message |
|---|---|
| The employee code is set by the system and cannot be chosen | |
| A login belongs to one employee | "This login already belongs to Bilal Ahmed." |
| Setting the status to Left with no leaving date uses today | |
| The leaving date cannot be before the joining date | "The leaving date can't be before the joining date." |
| Any status other than Left clears the leaving date | |
| An employee with attendance, leave or tasks cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| Deleting the linked user account removes the link, not the employee | |

### Attendance

| Rule | Message |
|---|---|
| One record per employee per day | "Ali Raza already has attendance for 03 Oct 2026. Edit that record instead." |
| Attendance cannot be marked for a future date | "Attendance can't be marked for a future date." |
| A record cannot be moved to another employee | "A record can't be moved to another employee." |
| A check-out needs a check-in | "Enter the check-in time too." |
| Absent and Leave clear the times and set hours and overtime to zero | |
| Hours worked follow the check-in and check-out times, across midnight if needed | |
| Hours typed by hand are kept when other fields change. When the times change, the hours follow the times again | |
| Hours and overtime are between 0 and 24 | The form says "Hours worked can't be more than 24." |
| The sheet needs at least one row | "Mark at least one employee." |
| Each employee appears once on a sheet | "Give each employee once." |
| If one row of the sheet is wrong, nothing is saved. The message names the employee | "Sara Khan: Enter the check-in time too." |
| The sheet lists employees who had joined by that date and have not left | |
| A bad date is refused | "Enter a date as YYYY-MM-DD." |

### Leave

| Rule | Message |
|---|---|
| The last day cannot be before the first | "The last day can't be before the first day." |
| Days = last day − first day + 1 | |
| A request cannot overlap the same employee's Pending or Approved leave. Rejected leave does not block | "Ali Raza already has approved leave from 04 Oct 2026 to 06 Oct 2026." |
| The status cannot be set directly; a new request is always Pending | |
| Only a Pending request can be changed | "This request is already approved and can't be changed." |
| A request is decided once | "This request is already approved." |
| Approving leave writes no attendance | |
| A leave request can be deleted in any status | |

### Tasks

| Rule | Message |
|---|---|
| The area must be one of the listed areas | A message from the server such as "\"Kitchen\" is not a valid choice." |
| Hours and output cannot be negative | A message from the server |

### How the figures are worked out

- **Present today** on the dashboard = Present + Half day + Late.
- **On leave today** = current employees with approved leave covering today.
- **Not marked today** = current employees with no attendance record today.
- **Productivity**, per employee, for attendance and finished tasks dated in the period:
  - Days present counts Present, Late and Half day.
  - Tasks done and Output count tasks with status Done.
  - **Kg per hour** = output ÷ hours, over finished tasks that have **both** an output and hours. Tasks missing either are left out of the rate.
  - Current staff are always listed. People who have left are listed only when they have figures in the period.

## Related data

| Module | What happens |
|---|---|
| [Users](users.md) | An employee can be linked to a user account. The link is for reference only |
| [Approvals and notifications](approvals-and-notifications.md) | Pending leave requests appear in the Approvals inbox, and in the notification rule "leave requests waiting" |
| [Dashboard and reports](dashboard-and-reports.md) | "Business at a glance" shows "People present today" and "On leave today". The report centre has no workforce report; use the Productivity tab |
| [Search and traceability](search-and-traceability.md) | Employees can be found from the search box by users who have the Workforce page |
| [Documents](documents.md) | The category "Employee documents" (Admin only by default) holds contracts and identity papers. A document can name an employee as the record it belongs to |

Workforce does not read or change production, stock or finance records. Wages recorded as expenses in Finance are not linked to attendance.

## For developers

**Backend:** `backend/apps/workforce`.

| File | Contents |
|---|---|
| `models.py` | `Department`, `JobRole`, `Shift`, `Employee`, `Attendance` (unique per employee and date), `LeaveRequest` (`days` set in `save()`), `TaskAssignment` |
| `services.py` | `hours_between`, `check_leave`, `decide_leave`, `on_leave_ids`, `summary`, `productivity` |
| `serializers.py` | Validation: leaving date, one attendance per day, hours from times, leave overlap |
| `views.py` | View sets, `AttendanceViewSet.sheet` and `.mark`, `WorkforceSummaryView`, `ProductivityView` |
| `demo.py` | Demo records for the `seed_module_data` command |
| `tests.py` | Rules above, as tests |

Every view uses `HasPage('workforce')`: reading needs the page, changing needs it at Full.

**Endpoints** (under `/api/v1/workforce/`):

| Method and path | Purpose |
|---|---|
| `GET, POST /departments/`, `/departments/{id}/` | Departments, each with its count of current employees |
| `GET, POST /job-roles/`, `/job-roles/{id}/` | Job roles |
| `GET, POST /shifts/`, `/shifts/{id}/` | Shifts, each with its `hours` |
| `GET, POST /employees/`, `/employees/{id}/` | Employees (filters `status`, `department`) |
| `GET, POST /attendance/`, `/attendance/{id}/` | Attendance (filters `employee`, `status`, `date`, and the date parameters) |
| `GET /attendance/sheet/?date=` | Current staff for one day, with saved records and approved leave |
| `POST /attendance/mark/` | Save a whole sheet: `{"date": "…", "shift": <id or null>, "records": [{"employee": 1, "status": "Present", "check_in": "06:00", "check_out": "14:00"}]}`. All or nothing |
| `GET, POST /leave/`, `/leave/{id}/` | Leave requests (filters `status`, `employee`) |
| `POST /leave/{id}/approve/`, `/reject/` | Decide; optional `note` |
| `GET, POST /tasks/`, `/tasks/{id}/` | Tasks (filters `status`, `employee`, `area`, date parameters) |
| `GET /summary/` | Dashboard figures |
| `GET /productivity/` | Productivity report (date parameters) |

**Frontend:** `frontend/src/features/workforce/` (`workforce-page.tsx`, `workforce-forms.tsx`, `attendance-sheet.tsx`, `productivity-panel.tsx`, `schemas.ts`). Route: `frontend/src/app/(app)/workforce/page.tsx`. Types: `frontend/src/types/workforce.ts`.

**Tests:** `backend/apps/workforce/tests.py`.

**Browser scenario:** `frontend/e2e/workforce.mjs`. Setup (department, job role, night shift) → an employee with a server-given code → leave requested and approved, overlap refused → the sheet suggests Leave and starts from the shift's times → hours across midnight → one record per day → a finished task → productivity → a supervisor has no Workforce menu and the API refuses them.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| An employee is missing from the attendance sheet | Their status is Left, their joining date is after the sheet's date, or a shift is chosen that is not theirs | Check the employee's status, joining date and usual shift; set the sheet's shift to "All shifts" |
| "… already has attendance for …. Edit that record instead." | **Add one record** was used for a day that already has a record | Edit the existing record, or use the sheet |
| The whole sheet fails to save | One row is wrong, and the sheet saves all rows or none | Read the message; it names the employee. Fix that row and save again |
| Typed hours went back to the calculated value | The check-in or check-out time was changed afterwards | Type the hours again after changing the times |
| "… already has approved leave from … to …." | The new request overlaps an existing one | Change the dates, or edit the pending request instead |
| An employee cannot be deleted | They have attendance, leave or tasks | Set their status to Left |
| An employee on approved leave shows as "not marked" | Approving leave writes no attendance | Save the sheet for that day; the row is already set to Leave |
| Kg per hour shows "—" | No finished task has both hours and output | Fill in both on the finished tasks |
| A login is not offered in the employee form | It is already linked to another employee | Unlink it from the other employee first |

## Keeping this page up to date

- `backend/apps/workforce/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, rules, messages and endpoints.
- `frontend/src/features/workforce/*`: tabs, columns, row actions, labels and the attendance sheet's behaviour.
- `backend/apps/alerts/approvals.py` and `rules.py`: how leave requests appear in the Approvals inbox and the notifications.
- `frontend/e2e/workforce.mjs`: the browser scenario.
