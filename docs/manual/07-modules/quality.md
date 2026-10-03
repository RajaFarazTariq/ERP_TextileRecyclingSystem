# Quality

This page explains the Quality module: quality standards, inspections of deliveries and fabric lots, quarantine of failed material, and corrective actions. It is for supervisors who inspect material, administrators, and developers who maintain the module.

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

The Quality module records whether material is good enough to use.

- A **standard** is a reusable checklist with limits, for one stage and (optionally) one material.
- An **inspection** records the result of checking a delivery or a fabric lot. It is numbered QC-00001, QC-00002 and so on.
- **Quarantine**: an inspection with the result Fail holds its delivery or lot. Held material cannot be processed or sold until someone releases it.
- A **corrective action** records what will be done about a problem, by whom and by when.

Material that was never inspected is not affected. Inspection is optional.

There are three stages of inspection:

| Stage | Label on screen | What is inspected |
|---|---|---|
| Incoming | Incoming material | A warehouse delivery |
| In-process | In-process | A fabric lot |
| Finished | Finished product | A fabric lot |

## Who can use it

| Who | Starting access to the page |
|---|---|
| Admin | Full |
| Every supervisor role | Full |

Opening the page is not enough to record anything. Each action needs a duty or the Admin role:

| Action | Needs |
|---|---|
| Record or change an incoming inspection, and its corrective actions | The duty *Inspect incoming material* (Warehouse Supervisor and Admin by default) |
| Record or change an in-process inspection, and its corrective actions | The duty *Inspect in-process material* (Sorting, Decolorization and Drying Supervisors and Admin by default) |
| Record or change a finished inspection, and its corrective actions | The duty *Inspect finished goods* (Drying Supervisor and Admin by default) |
| Release material from quarantine | The duty *Release quarantine* (Admin by default) |
| Change an inspection whose result is Fail | The duty *Release quarantine* (Admin by default), together with the duty for the stage |
| Create, change or delete a standard | Admin only |
| Delete an inspection or a corrective action | Admin only |

Everyone who can open the page can read all inspections, actions and standards.

With **View only** access the add button is replaced by a "View only" badge and row menus keep only **View details**.

How access and duties are changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/quality`. Its title is **Quality** and it has four tabs. The button at the top right depends on the tab and on what you may do:

| Tab | Button | Shown to |
|---|---|---|
| Dashboard, Inspections | Record inspection | Users who may inspect at least one stage |
| Actions | Add action | Users who may inspect at least one stage |
| Standards | New standard | Admin |

### Dashboard tab

| Part | Shows |
|---|---|
| Inspections, this month | Number of inspections this month, and the share accepted (Pass or Conditional) |
| In quarantine | Number of failed, unreleased inspections. "Blocked from processing and sales" |
| Failed, this month | Number of failed inspections this month, and the number of conditional acceptances |
| Open actions | Number of open corrective actions, and how many are overdue |
| In quarantine (list) | Each held delivery or lot with its inspection number and the reason. A **Release** button for users with the duty *Release quarantine*; others see a Quarantined badge and "Your role can't release material" |
| Inspection results by month | A bar chart of Pass, Conditional and Fail for the last 6 months |
| Defect analysis | The checks that failed most often in the last 6 months (up to 8) |
| Supplier quality | Incoming inspections accepted per supplier, lowest first (up to 8) |

### Inspections tab

| Column | Shows |
|---|---|
| Inspection | The number and the stage |
| Material | The material, with "Delivery #…" or "Lot #…" below it |
| Supplier | Vendor of the delivery, or of the delivery the lot came from |
| Inspector | Username |
| Date | Date inspected |
| Checks passed | "3 of 4", or a dash without a checklist |
| Result | Pass, Conditional or Fail, plus a **Quarantined** or **Released** badge |

Tools: search ("Search inspection, material, supplier…"), a **Stage** filter, a **Result** filter (Pass, Conditional, Fail, In quarantine), **Columns**, **Export** (`quality-inspections-<date>.csv`).

Row actions:

| Action | When it is offered |
|---|---|
| **View details** | Always. Opens a panel with the checklist, the reason, the release and the actions |
| **Release from quarantine** | The inspection is in quarantine and you hold the duty *Release quarantine* |
| **Add action** | You may inspect that stage |
| **Edit** | You may inspect that stage, the inspection is not released, and either it did not fail or you hold the duty *Release quarantine* |
| **Delete** | Admin |

### Actions tab

| Column | Shows |
|---|---|
| Inspection | Inspection number |
| Type | Corrective or Preventive |
| What has to be done | The description |
| Responsible | Username, or a dash |
| Due | Due date, with "· overdue" when it is past and the action is open |
| Status | Open or Done |

Row actions: **Mark as done** (open actions) or **Reopen** (done actions); **Edit** (open actions only); **Delete** (Admin).

### Standards tab

| Column | Shows |
|---|---|
| Standard | Name |
| Stage | The stage |
| Material | Material, or "Any" |
| Checks | Names of the checks. Hover to see the limits |
| Used | Number of inspections that used it |
| Status | In use or Not in use |

Row actions (Admin only): **Edit**, **Delete**.

## Records and fields

### Standard

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | Name, e.g. "Incoming cotton waste" | Yes | Up to 150 characters. Must be unique |
| Stage | Incoming material, In-process or Finished product | Yes | |
| Status | In use or Not in use | Yes | Only standards In use are offered in the inspection form |
| Material | The material it is for | No | "Leave empty to use it for any material" |
| Checks | The checklist, one row per check | At least one | "Add at least one check." |
| Notes | Free text | No | |

Each check has:

| Field | Meaning | Rules |
|---|---|---|
| Check | Name, e.g. "Moisture" | Required. Up to 150 characters. "Name the check." |
| Type | "Measured" or "Yes / no" | |
| Unit | Unit of the measurement, e.g. % | Measured checks only. Up to 20 characters |
| Min, Max | The limits | Measured checks need a minimum, a maximum or both. The minimum cannot be above the maximum |

### Inspection

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Stage | Only the stages you may inspect are offered | Yes | Changing the stage clears the checklist |
| Inspected on | Date | Yes | Starts as today |
| Delivery | For Incoming. Options read "#id · fabric type · vendor · weight" | Yes, for Incoming | "Choose the delivery that was inspected." |
| Fabric lot | For In-process and Finished. Options read "#id · material · vendor" | Yes, for those stages | "Choose the fabric lot that was inspected." |
| Standard | A standard of the same stage. "Fills in the checklist and its limits" | No | "No standard" is allowed |
| Sample (kg) | Size of the sample | No | Greater than zero |
| Composition found | e.g. "80% cotton / 20% polyester" | No | Up to 255 characters |
| Checklist | The checks. Loaded from the standard; your own can be added with **Add check** (these are Yes / no checks) | No | Measured checks need a value. Yes / no checks need Passed or Failed |
| Result | Pass, "Conditional (accepted with a condition)" or "Fail (quarantine)" | Yes | Starts as Pass. Cannot be Pass when a check failed |
| Why it failed | Shown when the result is Fail | Yes, for Fail | "Say why the material failed." |
| Notes / Condition | The label is **Condition** when the result is Conditional | Yes, for Conditional | "Write the condition under which the material is accepted." |
| Number | QC-00001 … | Automatic | |
| Inspector | The user who recorded it | Automatic | |
| Released by, released at, release note | The release from quarantine | Automatic | Set by **Release** |

Each checklist line stores its name, type, unit and limits as they were at the time, the measured value, and whether it passed. Later changes to a standard do not change past inspections.

### Corrective action

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Inspection | The inspection it belongs to. Only inspections of stages you may inspect are offered | Yes | Cannot be changed afterwards |
| Type | Corrective or Preventive. "Corrective fixes this case; preventive stops it happening again" | Yes | Starts as Corrective |
| What has to be done | Description | Yes | "Describe what has to be done." |
| Responsible | Any user | No | "Nobody yet" is allowed |
| Due date | Date | No | |
| Status | Open or Done | Automatic | |
| Completed at, completion note | Set when marked as done | Automatic | The screen sends no note |

## Statuses

### Inspection result

| Result | Meaning | Effect |
|---|---|---|
| Pass | Accepted | None |
| Conditional | Accepted with a written condition | None. Counted as accepted |
| Fail | Rejected | The delivery or lot goes into quarantine |

### Quarantine

| State | Meaning | How it is reached |
|---|---|---|
| Quarantined | The result is Fail and the inspection is not released | Saving an inspection with the result Fail |
| Released | The result is Fail and someone released it | **Release from quarantine**, with a reason |

Quarantine also ends when:

- the failed inspection is edited to Pass or Conditional (by someone with the duty *Release quarantine*), or
- the failed inspection is deleted (Admin).

A released inspection is final. It cannot be edited.

### Corrective action

| Status | How it is reached |
|---|---|
| Open | Every new action. **Reopen** on a done action |
| Done | **Mark as done** |

An open action with a due date in the past is shown as overdue.

### Standard

In use or Not in use, chosen in the form.

## How to

### Create a standard (Admin)

1. Open the **Standards** tab and click **New standard**.
2. Enter the **Name** and choose the **Stage**.
3. For each check enter its name and choose **Measured** or **Yes / no**. For a measured check give the unit and a Min, a Max or both.
4. Use **Add check** for more rows.
5. Click **Save**.

### Record an inspection

1. Click **Record inspection**.
2. Choose the **Stage**, then the **Delivery** or the **Fabric lot**.
3. Optionally choose a **Standard**. Its checks appear in the checklist.
4. Enter the measured value for each measured check, and Passed or Failed for each yes / no check. The form shows Pass or Fail beside each row.
5. Choose the **Result**. If any check failed, choose Conditional or Fail.
6. For Fail, fill in **Why it failed**. For Conditional, fill in **Condition**.
7. Click **Save**.

A Fail result puts the material in quarantine at once.

### Release material from quarantine

1. On the **Dashboard** tab click **Release** beside the item, or on the **Inspections** tab choose **Release from quarantine**.
2. Enter the **Reason for release**, for example "dried and re-tested".
3. Click **Release**. The message "Released from quarantine." appears.

### Add and close a corrective action

1. On the **Inspections** tab choose **Add action** on the inspection.
2. Describe **What has to be done**. Optionally choose who is **Responsible** and a **Due date**.
3. Click **Save**.
4. When the work is finished, open the **Actions** tab and choose **Mark as done**.

## Business rules

### Who may do what

| Rule | Message |
|---|---|
| Recording or changing an inspection needs the duty for its stage | "Your role can't record incoming inspections." (or "in-process", "finished") |
| The same duty is needed to add, change, complete or reopen a corrective action of that inspection | Same message |
| Changing a failed inspection needs the duty *Release quarantine* | "Only someone who may release quarantine can change a failed inspection." |
| Releasing needs the duty *Release quarantine* | "Your role is not allowed to release material from quarantine." |
| Deleting an inspection or an action is for Admin only | "Only an admin can delete quality records." |
| Changing standards is for Admin only | "You do not have permission to perform this action." |

### Inspections

| Rule | Message |
|---|---|
| An incoming inspection needs a delivery; the lot is cleared | "Choose the delivery that was inspected." |
| An in-process or finished inspection needs a fabric lot; the delivery is cleared | "Choose the fabric lot that was inspected." |
| The standard must be for the same stage | "This standard is for incoming inspections." |
| The sample must be greater than zero | "Must be greater than zero." |
| A measured check needs a value | "Enter the measured value." |
| A yes / no check must be marked | "Mark the check as passed or failed." |
| A measured check passes when its value is within the limits (limits included). The server decides this; what the screen sends is ignored | (none) |
| A limit's minimum cannot be above its maximum | "The minimum can't be above the maximum." |
| The result cannot be Pass when a check failed | "A check failed, so the result can't be Pass. Choose Conditional or Fail." |
| Fail needs a reason | "Say why the material failed." |
| Conditional needs a condition in the notes | "Write the condition under which the material is accepted." |
| When the result is not Fail, the rejection reason is cleared | (none) |
| A released inspection cannot be changed | "A released inspection can't be changed." |

### Quarantine

A delivery or lot is held while it has an inspection with the result Fail that has not been released. A lot is also held when the **delivery it came from** is held.

| What is blocked | Message |
|---|---|
| Making a new fabric lot from a held delivery | "This delivery is in quarantine after failing inspection QC-00001 and can't be sent to sorting until an admin releases it." |
| Starting a sorting session on a held lot | "This fabric lot is in quarantine after failing inspection QC-00001 and can't be sorted until an admin releases it." |
| Starting a decolorization session | "… and can't be decolorized until an admin releases it." |
| Creating a drying session | "… and can't be dried until an admin releases it." |
| Confirming a sales order, or dispatching, from a held lot | "… and can't be sold until an admin releases it." |
| Releasing a production order, or starting one of its steps, for a held lot | "… and can't be processed until an admin releases it." |

Notes:

- The checks run when a session is created or moved to another lot. Sessions that already exist can still be completed.
- The messages say "until an admin releases it". The release itself needs the duty *Release quarantine*, which only Admin holds by default.

| Release rule | Message |
|---|---|
| Only material in quarantine can be released | "Only material in quarantine can be released." |
| A reason is required | "Say why the material is released (e.g. re-tested, returned to supplier)." (the form shows "Say why the material is released.") |

### Standards and actions

| Rule | Message |
|---|---|
| A standard needs at least one check | "Add at least one check." |
| A measured check needs a limit | "Give a measurement a minimum, a maximum or both." |
| Saving a standard replaces its whole checklist. Past inspections keep their own copy | (none) |
| A standard used by an inspection cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| An action cannot be moved to another inspection | "An action can't be moved to another inspection." |
| An action that is done cannot be marked done again, and an open one cannot be reopened | "This action is already done." / "This action is already open." |
| Deleting an inspection also deletes its checklist and its actions, and frees any material it held | The delete dialog says so |

Every add, change, release and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Warehouse](warehouse.md) | Incoming inspections point to a delivery. The stock list shows a Quality column |
| [Sorting](sorting.md) | In-process and finished inspections point to a fabric lot. The lot list shows a Quarantined badge. Quarantine blocks new lots and sessions |
| [Decolorization](decolorization.md), [Drying](drying.md) | Quarantine blocks new sessions |
| [Sales](sales.md), [Inventory](inventory.md) | Quarantine blocks confirming and dispatching |
| [Production](production.md) | Quarantine blocks releasing an order and starting a step |
| [Purchasing](purchasing.md) | Supplier performance includes the number of incoming inspections and failures |
| [Approvals and notifications](approvals-and-notifications.md) | Quarantined material appears as an item to release. Quarantine and overdue actions raise alerts |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/quality/models.py`

| Model | Notes |
|---|---|
| `QualityStandard` | `name` (unique), `stage`, `material_type`, `is_active`, `notes` |
| `StandardCheck` | `standard` (`CASCADE`), `name`, `kind` (`Measure` or `Pass/Fail`), `unit`, `min_value`, `max_value` |
| `Inspection` | A `NumberedModel` with prefix `QC`. `stage`, `stock` or `fabric` (both `PROTECT`), `standard` (`PROTECT`), `inspector`, `inspected_on`, `sample_kg`, `composition`, `result`, `rejection_reason`, `notes`, `released_by`, `released_at`, `release_note`. Property `quarantined` = result is Fail and `released_at` is empty |
| `InspectionResult` | `inspection` (`CASCADE`), `name`, `kind`, `unit`, `min_value`, `max_value`, `value`, `passed`, `note` |
| `CorrectiveAction` | `inspection` (`CASCADE`), `kind`, `description`, `owner`, `due_date`, `status`, `completed_at`, `completion_note`, `created_by` |

### Services

`backend/apps/quality/services.py`

| Function | Purpose |
|---|---|
| `check_may_inspect(user, stage)` | Checks the duty for the stage (`STAGE_DUTIES`) |
| `judge(kind, value, min, max, passed)` | Decides whether one checklist line passes |
| `blocking_inspection(fabric, stock)` | The failed, unreleased inspection holding a lot or delivery |
| `quarantined_ids()` | The ids of held deliveries and lots, for list screens |
| `check_usable(fabric, stock, field, verb)` | Raises the quarantine error. Called by other apps |
| `check_lot_change(serializer, data, verb)` | The same check for session serializers, on create or when the lot changes |
| `release(inspection, user, note)` | Ends the quarantine |

Where quarantine is enforced:

| Place | File |
|---|---|
| New lot from a delivery | `backend/apps/sorting/serializers.py` (`FabricStockSerializer.validate`) |
| Sorting, decolorization and drying sessions | The session serializer in each app |
| Sales order reservation and dispatch | `backend/apps/inventory/services.py` (`check_order_reservation`, `check_dispatch`) |
| Production release and step start | `backend/apps/production/services.py` (`release`, `start_step`) |

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/quality/standards/` | List or add standards. Filter: `stage` |
| GET, PUT, PATCH, DELETE | `/api/v1/quality/standards/<id>/` | One standard, with its `checks` |
| GET, POST | `/api/v1/quality/inspections/` | List or record inspections. Filters: `stage`, `result`, `quarantined`, `stock`, `fabric`, and the shared period parameters on the inspection date |
| GET, PUT, PATCH, DELETE | `/api/v1/quality/inspections/<id>/` | One inspection, with its `results` and `actions` |
| POST | `/api/v1/quality/inspections/<id>/release/` | Release from quarantine. Body: `note` |
| GET, POST | `/api/v1/quality/actions/` | List or add corrective actions. Filters: `status`, `inspection` |
| GET, PUT, PATCH, DELETE | `/api/v1/quality/actions/<id>/` | One action |
| POST | `/api/v1/quality/actions/<id>/complete/` | Mark as done. Optional body: `note` |
| POST | `/api/v1/quality/actions/<id>/reopen/` | Reopen |
| GET | `/api/v1/quality/summary/` | Dashboard figures |

### Permissions

- `StandardViewSet` uses `SharedReadPermission`: any valid role reads, only the `admin` role writes.
- The other views use `IsQualityUser` (in `views.py`): any valid role may read and write, `DELETE` needs the `admin` role. The serializers then check the stage duty.
- `release` uses `IsAdminAction`, which checks the duty `release_quarantine`.
- The API gate allows changes only to users who hold the Quality page in Full. The Quality page may also read the warehouse and sorting APIs for its dropdowns.

The constant `STAGE_ROLES` in `services.py` is no longer used for permission checks; `STAGE_DUTIES` is. `STAGE_ROLES` is still used by the summary view to list the three stages.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/quality/page.tsx` | The route |
| `frontend/src/features/quality/quality-page.tsx` | Tabs, tables, dashboard, the details panel |
| `frontend/src/features/quality/quality-forms.tsx` | `InspectionDialog`, `ReleaseDialog`, `ActionDialog`, `StandardDialog`, `QUALITY_LISTS` |
| `frontend/src/features/quality/schemas.ts` | Form rules, `stagesFor`, `rowPassed`, `limitText` |
| `frontend/src/types/api.ts` | `Inspection`, `QualityStandard`, `CorrectiveAction`, `QualitySummary` |

The screen decides which buttons to show from the user's duties (`useDuties` in `frontend/src/features/auth/use-duty.ts`). The server checks every action again.

### Tests

- Backend: `backend/apps/quality/tests.py` covers standards, stage duties, judging of measurements, result rules, quarantine of deliveries and lots through sorting, processing and sales, release, corrective actions, the summary and the filters.
- Browser: `frontend/e2e/quality.mjs` covers a standard, a failed incoming inspection by the warehouse supervisor, the Quarantined badge in Warehouse, sorting refusing the delivery, release by the admin, the details panel, a corrective action, and what a sorting supervisor may inspect.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| No **Record inspection** button | Your role holds no inspection duty | Ask an admin to give your role the duty for the stage |
| The Stage list lacks a stage | Your role does not hold the duty for it | Same as above |
| "A check failed, so the result can't be Pass." | A measured value is outside its limits, or a yes / no check is marked Failed | Choose Conditional (with a condition) or Fail |
| No **Edit** on a failed inspection | Only users with the duty *Release quarantine* change failed inspections | Ask an admin |
| No **Edit** on a released inspection | A released inspection is final | Record a new inspection |
| A lot is blocked but has no failed inspection of its own | The delivery it came from failed an incoming inspection | Release that inspection |
| The Standard list in the inspection form is empty | No standard In use exists for that stage | An admin creates one, or add your own checks with **Add check** |
| A standard cannot be deleted | Inspections used it | Set it to Not in use |
| Material is still sellable after a failed inspection | Stock that was already dispatched is not recalled, and existing sessions can still be completed | Quarantine only blocks new steps |

## Keeping this page up to date

- `backend/apps/quality/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, rules, messages and endpoints.
- The callers of `check_usable` and `check_lot_change` in the sorting, decolorization, drying, inventory and production apps: what quarantine blocks.
- `frontend/src/features/quality/`: tabs, labels, form rules and which buttons each user sees.
- `backend/apps/access/services.py` (`DUTIES`, `DEFAULT_ROLE_DUTIES`): the inspection and release duties and who holds them at the start.
