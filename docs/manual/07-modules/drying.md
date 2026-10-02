# Drying

This page explains the Drying module: dryers and drying sessions. Completed drying sessions are what create sellable stock. It is for drying supervisors, administrators, and developers who maintain the module.

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

Drying is the fourth step of the material flow. Wet fabric from decolorization goes into a dryer. The module keeps:

- **Dryers**: the machines, with their type, capacity and status.
- **Drying sessions**: one batch of one fabric lot in one dryer, with its input, dried output, waste, temperature and duration.

When a session is completed, its dried output is added to the sellable stock of the fabric lot. Only dried output can be sold. See [Inventory](inventory.md).

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| Drying Supervisor | Full |
| Other roles | No access to the page |

- With **View only** access the add button is replaced by a "View only" badge and the row menus are hidden. The server refuses any change.
- The Drying module needs no duty.
- The drying data can be read by users who hold the Drying page or the Dashboard page. The Maintenance page reads the list of dryers only.

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/drying`. Its title is **Drying** and it has three tabs. The button at the top right is **Add session** on the Dashboard and Sessions tabs and **Add dryer** on the Dryers tab.

### Dashboard tab

| Part | Shows |
|---|---|
| Sessions | Number of sessions, and how many are completed |
| Active sessions | Sessions In Progress, and the number of dryers Running |
| Dryers available | Dryers with status Available, out of all dryers |
| Total input | Sum of input of all sessions |
| Output efficiency | Output ÷ input, completed sessions only |
| Total dried output | Sum of output. "Becomes sellable stock" |
| Total waste | Sum of waste |
| Where the wet fabric went | A bar with the shares of dried output, waste and moisture lost, for completed sessions |
| Dryers | A card per dryer: name, type and capacity, status, the load of the batch In Progress in it, how long it has run, and the fabric and temperature of that batch. Without a batch it reads "No batch loaded" or "Under maintenance" |

With no sessions and no dryers the tab shows "No drying data yet".

### Sessions tab

| Column | Shows |
|---|---|
| # | Session number |
| Dryer | Dryer name |
| Fabric | Material of the lot |
| Supervisor | Username |
| Input | Input quantity |
| Output | Dried output |
| Waste | Waste |
| Efficiency | Output ÷ input, shown for completed sessions only |
| Temp | Temperature in °C |
| Duration | Duration in minutes |
| Status | Pending, In Progress, Completed, Failed or On Hold |

Tools: search ("Search dryer, fabric, supervisor…"), a **Status** filter, **Columns**, **Export** (`drying-sessions-<date>.csv`).

Row actions:

| Action | When it is offered |
|---|---|
| **Start** | While the session is Pending or On Hold |
| **Complete** | While the session is not Completed |
| **Edit**, **Delete** | Always (with Full access) |

### Dryers tab

| Column | Shows |
|---|---|
| Name | Dryer name |
| Type | Tumble, Conveyor or Chamber |
| Capacity | Capacity in kg |
| Status | Available, Running, Cooling or Maintenance |

Tools: search ("Search dryers…"), a **Dryer status** filter, **Columns**, **Export** (`dryers-<date>.csv`).

Row actions:

| Action | When it is offered |
|---|---|
| **Mark available** | While the dryer is not Available |
| **Send to maintenance** | While the dryer is not in Maintenance |
| **Edit**, **Delete** | Always (with Full access) |

### Forms

| Form | Save button |
|---|---|
| Add drying session / Edit drying session ("Wet fabric from decolorization going into a dryer.") | **Save** / **Update** |
| Complete drying session | **Mark complete** |
| Add dryer / Edit dryer | **Save** / **Update** |

## Records and fields

### Dryer

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Dryer name | Name, e.g. "Dryer D-01" | Yes | Up to 100 characters. "Enter the dryer name." |
| Type | Tumble dryer, Conveyor dryer or Chamber dryer | Yes | Starts as Tumble |
| Capacity (kg) | Kilograms per batch | Yes | Greater than zero |
| Status | See [Statuses](#statuses) | Yes | Starts as Available |
| Notes | Free text | No | |

### Drying session

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Dryer | The dryer used. Options read "name (status)". Every dryer is offered, whatever its status | Yes | "Choose a dryer." |
| Fabric (from decolorization) | The fabric lot. Only lots with status Sent to Decolorization are offered, shown as "material (remaining kg)". Without any, the field reads "No fabric ready for drying" | Yes | A quarantined lot is refused |
| Decolorization session | The batch the fabric came from. Only completed decolorization sessions not yet linked to a drying session are offered | No | "Optional: the batch this fabric came from" |
| Supervisor | Any active user | Yes | |
| Input quantity (kg) | Wet weight put in | Yes | Greater than zero |
| Temperature (°C) | Operating temperature | No | Up to 1 decimal |
| Duration (min) | Drying time | No | Whole number |
| Status | See [Statuses](#statuses) | Yes | Starts as Pending. Can be chosen by hand in the form |
| Notes | Free text | No | Can also be changed when completing |
| Dried output (kg) | Weight after drying. Entered when completing | On completion | Zero or more |
| Waste (kg) | Weight discarded. Entered when completing | On completion | Zero or more. Starts at 0 |
| Start date | When **Start** was used | Automatic | |
| End date | When it was completed | Automatic | |

Two figures are calculated for each session:

| Figure | How |
|---|---|
| Efficiency | Output ÷ input × 100, to one decimal |
| Moisture lost | Input − output − waste, never below zero. Zero while there is no output |

## Statuses

### Drying session

| Status | How it is reached |
|---|---|
| Pending | Every new session starts here, unless another status is chosen in the form |
| In Progress | **Start** on the row. It records the start date and sets the dryer to Running |
| Completed | **Complete** on the row. It records output, waste and the end date, sets the dryer to Cooling, and adds the output to sellable stock |
| Failed | Chosen by hand in the session form |
| On Hold | Chosen by hand in the session form. A session On Hold can be started again |

**Start** works only from Pending or On Hold. **Complete** works from any status except Completed, so a Pending session can be completed without being started.

Choosing a status by hand in the form changes only the session. It does not change the dryer, and it does not record a start or end date. Use **Start** and **Complete** for normal work.

### Dryer

| Status | How it is reached |
|---|---|
| Available | The default. **Mark available** on the row |
| Running | Set automatically when a session in the dryer is started |
| Cooling | Set automatically when a session in the dryer is completed |
| Maintenance | **Send to maintenance** on the row |

Any status can also be chosen by hand in the dryer form. A dryer does not return from Cooling to Available by itself: use **Mark available**.

The dryer status here is separate from the machine register in [Maintenance](maintenance.md). Maintenance work orders never change a dryer.

## How to

### Add a dryer

1. Open the **Dryers** tab and click **Add dryer**.
2. Enter the **Dryer name**, choose the **Type**, enter the **Capacity (kg)**.
3. Click **Save**.

### Dry a batch

1. Click **Add session**.
2. Choose the **Dryer** and the **Fabric (from decolorization)**.
3. Optionally choose the **Decolorization session** it came from.
4. Choose the **Supervisor** and enter the **Input quantity (kg)**.
5. Optionally enter **Temperature (°C)** and **Duration (min)**. Leave the **Status** as Pending.
6. Click **Save**.
7. When the dryer is loaded, open the "⋯" menu on the session and choose **Start**. The message "Drying started." appears and the dryer shows Running.
8. When drying is finished, choose **Complete**. Enter the **Dried output (kg)** and the **Waste (kg)**. Together they cannot be more than the input.
9. Click **Mark complete**. The message "Drying session completed. Output added to sellable stock." appears.
10. When the dryer has cooled, go to the **Dryers** tab and choose **Mark available**.

### Take a dryer out of use

1. On the **Dryers** tab choose **Send to maintenance** on the row.
2. When it is back, choose **Mark available**.

### Remove a session entered by mistake

1. On the **Sessions** tab choose **Delete** on the row.
2. Confirm. The dialog warns: "If it was completed, its output is taken back out of sellable stock."

## Business rules

| Rule | Message |
|---|---|
| A session cannot be created on, or moved to, a lot in quarantine | "This fabric lot is in quarantine after failing inspection QC-00001 and can't be dried until an admin releases it." |
| Only a Pending or On Hold session can be started | "Only Pending or On Hold sessions can be started." |
| A completed session cannot be completed again | "Session already completed." |
| Output and waste must be valid numbers, zero or more | "Enter a valid number." / "Must be zero or more." |
| Output plus waste cannot be more than the input | "Output (95.00 kg) plus waste (10.00 kg) is more than the input (100.00 kg)." |
| A dryer with sessions cannot be deleted | "This record cannot be deleted because other records depend on it: …" |

What **Start** does:

1. Sets the session to In Progress and records the start date.
2. Sets the dryer to Running.

What **Complete** does:

1. Saves the output, waste and notes, sets the session to Completed and records the end date.
2. Sets the dryer to Cooling.
3. Sets the fabric lot's status to Sorted.
4. Adds the dried output to the lot's sellable stock, as a "Drying output" stock movement.

How sellable stock follows a session:

- The stock ledger is kept equal to the session. A session counts only while its status is Completed and it has an output.
- If a completed session's output is changed, the ledger is corrected by the difference.
- If a completed session is deleted, or its status is changed away from Completed, its output is taken back out of sellable stock.
- The system does not check whether that stock has already been reserved or dispatched before taking it back out. Check the lot in [Inventory](inventory.md) before deleting or reopening a completed session.

Things the code does **not** do:

- The input quantity is not checked against the dryer's capacity, the lot's quantities or the output of the linked decolorization session.
- A session can be added to a dryer that is Running, Cooling or in Maintenance.
- Deleting a session does not change the dryer's status or the lot's status.

Every add, change, start, completion, status action and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Sorting](sorting.md) | A session works on a fabric lot. Completing it sets the lot's status to Sorted |
| [Decolorization](decolorization.md) | Lots become available for drying when a decolorization session on them is completed. A drying session can be linked to that decolorization session |
| [Inventory](inventory.md) | Completed sessions create "Drying output" stock movements. This is the only way stock enters the sellable ledger, apart from sales returns and manual adjustments |
| [Sales](sales.md) | Orders are confirmed and dispatched against the dried stock of a lot |
| [Quality](quality.md) | Quarantined lots cannot be dried. Finished inspections are recorded on the lot |
| [Production](production.md) | A production order shows the lot's drying sessions under "Lot activity" |
| [Maintenance](maintenance.md) | A machine in the register can be linked to a dryer, so its downtime is shown next to the drying batches |
| [Sustainability](sustainability.md) | Reads drying sessions for its figures |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/drying/models.py`

| Model | Notes |
|---|---|
| `Dryer` | `name`, `capacity`, `dryer_type` (`Tumble`, `Conveyor`, `Chamber`), `status`, `notes`, `created_at`. Ordered by name |
| `DryingSession` | `dryer`, `fabric`, `supervisor` (all `PROTECT`), `decolor_session` (`SET_NULL`), `input_quantity`, `output_quantity`, `waste_quantity`, `temperature_celsius`, `duration_minutes`, `status`, `start_date`, `end_date`, `notes`, `created_at`. Properties `moisture_loss_kg` and `output_efficiency_pct` |

There is no `services.py`. The rules are in `backend/apps/drying/views.py` (`start`, `complete`, `set_available`, `set_maintenance`) and `DryingSessionSerializer.validate` (quarantine).

The stock ledger is updated by signals, not by the drying app: `backend/apps/inventory/signals.py` calls `apps.inventory.services.sync_drying_session` after every save and delete of a `DryingSession`. That function posts the difference between what the session implies and what the ledger already holds, so it is safe however the session is saved (API, Django admin, seed commands).

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/drying/dryers/` | List or add dryers. Filter: `status` |
| GET, PUT, PATCH, DELETE | `/api/v1/drying/dryers/<id>/` | One dryer |
| POST | `/api/v1/drying/dryers/<id>/set_available/` | Set the dryer to Available |
| POST | `/api/v1/drying/dryers/<id>/set_maintenance/` | Set the dryer to Maintenance |
| GET, POST | `/api/v1/drying/sessions/` | List or add sessions. Filter: `status` |
| GET, PUT, PATCH, DELETE | `/api/v1/drying/sessions/<id>/` | One session |
| POST | `/api/v1/drying/sessions/<id>/start/` | Start a session |
| POST | `/api/v1/drying/sessions/<id>/complete/` | Complete. Body: `output_quantity`, `waste_quantity`, optional `notes` |
| GET | `/api/v1/drying/fabric-ready/` | Lots with status Sent to Decolorization: `id`, `material_type`, `status`, `remaining_quantity` |
| GET | `/api/v1/drying/decolor-sessions-done/` | Completed decolorization sessions not linked to a drying session |

The refusals from `start` and `complete` are returned under the key `error`, not `message` or `detail`.

### Permissions

- Every view uses `IsDryingSupervisor` (`backend/apps/core/permissions.py`). Despite its name it does not check the role: reading is allowed to any valid role and is decided by the API gate; changing needs the `drying` page in Full.
- The API gate (`PAGE_API` in `backend/apps/access/services.py`) lists Drying and Dashboard as readers of the drying API, and Maintenance as a reader of `drying/dryers` only. The Maintenance screen loads the dryer list for users with the duty *Manage maintenance*, for the machine form.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/drying/page.tsx` | The route |
| `frontend/src/features/drying/drying-page.tsx` | Tabs, tables and the dashboard |
| `frontend/src/features/drying/drying-forms.tsx` | `DryerDialog`, `SessionDialog`, `CompleteDialog` |
| `frontend/src/features/drying/schemas.ts` | Form rules, `DRYER_STATUSES`, `DRYER_TYPES`, `SESSION_STATUSES` |
| `frontend/src/types/api.ts` | `Dryer`, `DryingSession`, `FabricReadyOption`, `DecolorDoneOption` |

### Tests

- Backend: `backend/apps/drying/tests.py` (session lifecycle, efficiency fields, dryer status actions, dropdown endpoints, output plus waste check). The ledger is tested in `backend/apps/inventory/tests.py`.
- Browser: `frontend/e2e/drying.mjs` (a new session is Pending, start, the completion dialog, a refused output, the output arriving in sellable stock, delete taking it back out, dryer maintenance and availability). It needs dryers: run the `seed_drying_data` command after `seed_demo_data`.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| The fabric field reads "No fabric ready for drying" | No lot has the status Sent to Decolorization | Complete the decolorization session for the lot, or set the lot's status in [Sorting](sorting.md) |
| A lot disappears from the fabric list after its first drying session is completed | Completion sets the lot's status to Sorted | To dry more of the same lot, set its status back to Sent to Decolorization in Sorting |
| "Only Pending or On Hold sessions can be started." | The session is already In Progress, Completed or Failed | Nothing to start. Use **Complete** if the batch is finished |
| The dryer stays on Cooling | The system does not release it by itself | Use **Mark available** |
| Sellable stock did not rise after completing | The dried output entered was 0 | Delete the session and enter it again with the right output. The form has no field to correct the output afterwards |
| Sellable stock dropped unexpectedly | A completed session was deleted, or its status was changed away from Completed | Check the audit log, then re-enter the session |
| "This fabric lot is in quarantine …" | A quality inspection failed and has not been released | See [Quality](quality.md) |

## Keeping this page up to date

- `backend/apps/drying/models.py`, `serializers.py`, `views.py`, `urls.py`: fields, statuses, actions and endpoints.
- `backend/apps/inventory/signals.py` and `backend/apps/inventory/services.py` (`sync_drying_session`): how sessions feed sellable stock.
- `frontend/src/features/drying/`: screens, labels and messages.
- `backend/apps/core/permissions.py` (`IsDryingSupervisor`) and `backend/apps/access/services.py`: who can read and change drying data.
