# Sustainability

This page explains the Sustainability module: waste records, utility readings, targets, the dashboard figures and the environmental report. It is for supervisors who record waste and utilities, administrators, and developers who maintain the module.

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

The module shows the environmental performance of the factory: how much material is recovered, how much waste is handled and where it goes, and how much water, energy and chemical is used per kilogram of output.

Only two things are typed in here:

- **Waste records**: waste or rejected material that was weighed and disposed of.
- **Utility readings**: water, electricity, gas, steam or diesel used, from a meter or a bill.

Everything else is calculated from records the factory already keeps: deliveries, sorting, decolorization and drying sessions, and chemical issuances. No rate or percentage is typed in.

Admins also keep two setup lists: **waste categories** and **targets**.

## Who can use it

| Who | Starting access to the page |
|---|---|
| Admin | Full |
| Every supervisor role | Full |

The module needs no duty. What a user may do depends on the Admin role and on who recorded an entry:

| Action | Who |
|---|---|
| Read everything | Anyone who can open the page |
| Add a waste record or a utility reading | Anyone with Full access to the page |
| Change a waste record or a utility reading | The person who recorded it, or an Admin |
| Delete a waste record or a utility reading | Admin only |
| Create, change or delete waste categories and targets | Admin only |

With **View only** access the add button is replaced by a "View only" badge and the row menus are hidden.

How access is changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/sustainability`. Its title is **Sustainability** and it has five tabs. The button at the top right is **Add waste record** on the Dashboard and Waste records tabs and **Add reading** on the Utilities tab. The other two tabs have no button there.

### Dashboard tab

A period filter at the top. It starts at This month.

| Part | Shows |
|---|---|
| Recovery rate | Dried output ÷ weight taken into sorting, for the period |
| Waste handled | Total weight of waste records, with the hazardous weight or the number of records |
| Diverted from landfill | Share of waste handled that did not go to landfill |
| Water per kg | Litres of water per kg of dried output |
| Energy per kg | kWh of electricity per kg of dried output |
| Material sorted and dried by month | A bar chart for the last 12 months. The tooltip adds recovery, waste, water and power for the month. This chart does not follow the period filter |
| Targets | Each active target with its goal, the value now, and **On target**, **Off target** or **No data** |
| How these are calculated | A plain explanation of every figure |

### Waste records tab

| Column | Shows |
|---|---|
| Date | Date of the record |
| Waste | Category, with its classification |
| From | The stage it came from, and the fabric lot if one was chosen |
| Weight | Weight in kg |
| Disposal | Disposal method, and who took it |
| Reference | Manifest or gate pass number |
| Cost / sold for | Disposal cost and the amount it was sold for |
| Recorded by | Username |

Tools: search ("Search waste, disposal, reference…"), a **Period** filter, a **Classification** filter, a **Source stage** filter, **Columns**, **Export** (`waste-records-<date>.csv`).

Row actions: **Edit** (your own records, or any record for an Admin), **Delete** (Admin). A supervisor sees no menu on someone else's record.

### Utilities tab

| Column | Shows |
|---|---|
| Date | Date of the reading |
| Utility | Water, Electricity, Gas, Steam or Diesel |
| Used | Quantity with the utility's unit |
| Cost | Cost in Rs. |
| Area | The stage, or "Whole factory" |
| Meter or bill | Reference |
| Recorded by | Username |

Tools: search ("Search utility, area, meter…"), a **Period** filter, a **Utility** filter, **Columns**, **Export** (`utility-readings-<date>.csv`).

Row actions: the same as for waste records.

### Environmental report tab

A period filter (it starts at This month) and an **Export CSV** button. The file is named `environmental-report-<date>.csv` and contains every table below plus the explanations.

| Section | Shows |
|---|---|
| Material balance | Cards: Material received, Dried output, Recovery rate (with "Stage yields combined"), Process loss for all stages. A table per stage (Sorting, Decolorization, Drying): Sessions, Input, Output, Loss, Loss %, Recorded waste, Other loss |
| Waste handled | Totals, then tables by Classification, by Disposal method and by Source stage, each with Weight and Share |
| Utilities | Per utility: Used, Readings, Cost. Then water and energy per kg of output, and the water written on decolorization sessions |
| Chemicals | Per chemical: Issued, Issuances, Cost. Then chemical cost per kg of output |

### Setup tab

Two tables. Admins see **New category** and **New target**, and **Edit** and **Delete** in each row menu.

| Table | Columns |
|---|---|
| Waste categories | Category, Classification, Description, Used (number of records), Status |
| Targets | Figure, Target, Period, Status |

## Records and fields

### Waste record

"Waste or rejected material that was weighed and disposed of. Process loss is worked out from the sessions, so don't enter it here."

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Date | When the waste was handled | Yes | Not in the future. Starts as today |
| Weight (kg) | Weight | Yes | Greater than zero |
| Waste category | A category In use. Options read "name · classification" | Yes | |
| Where it came from | Warehouse, Sorting, Decolorization, Drying or Other | Yes | Starts as Other |
| Fabric lot | The lot it came from | No | |
| Disposal method | Recycled internally, Sold as by-product, Sent to recycler, Reused, Landfill, Incinerated or Treated | Yes | "Choose how it was disposed of." |
| Taken by | "Recycler, buyer or contractor" | No | Up to 255 characters |
| Disposal cost (Rs.) | What disposal cost | No | Zero or more |
| Sold for (Rs.) | Money received when sold as a by-product | No | Zero or more |
| Manifest or gate pass no. | Reference | No | Up to 100 characters |
| Notes | Free text | No | |
| Recorded by | The user who saved it | Automatic | |

### Utility reading

"How much was used since the last reading, from the meter or the bill."

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Utility | Water (m3), Electricity (kWh), Gas (m3), Steam (kg) or Diesel (litres) | Yes | |
| Date | Date of the reading | Yes | Not in the future |
| Quantity used | The amount used, in the utility's unit | Yes | Greater than zero. Enter the amount used, not the meter's counter |
| Cost (Rs.) | Cost | No | Zero or more |
| Area | A stage, or "Whole factory" | No | |
| Meter or bill no. | Reference | No | Up to 100 characters |
| Notes | Free text | No | |
| Unit | Set from the utility | Automatic | Each utility always uses one unit, so readings can be added up |
| Recorded by | The user who saved it | Automatic | |

### Waste category

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. "Fibre dust" | Yes | Up to 100 characters. Unique |
| Classification | Recyclable, Reusable, Hazardous or General / landfill | Yes | Starts as General. Decides how records are grouped in the report |
| Status | In use or Not in use | Yes | |
| Description | Free text | No | |

The system starts with six categories:

| Category | Classification |
|---|---|
| Fibre dust | Recyclable |
| Offcuts | Reusable |
| Contaminated fabric | General / landfill |
| Chemical sludge | Hazardous |
| Wastewater sludge | Hazardous |
| Packaging | Recyclable |

### Target

"A goal for one calculated figure. The dashboard shows whether the chosen period meets it."

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Figure | Recovery rate %, Waste to landfill %, Water per kg (litres), Energy per kg (kWh) or Chemical cost per kg (Rs.) | Yes | |
| Should be | At least or At most | Yes | |
| Target | The goal, in the unit of the figure | Yes | Zero or more |
| Period | A label, e.g. the year | No | Up to 50 characters. It is only a label: the target is measured over the period chosen on the dashboard |
| Status | In use or Not in use | Yes | One target In use per figure |

## Statuses

The records of this module have no workflow. Three states are shown:

| Record | States | Meaning |
|---|---|---|
| Waste category | In use / Not in use | A category Not in use is no longer offered for new waste records |
| Target | In use / Not in use | Only targets In use appear on the dashboard |
| Target result (dashboard) | On target / Off target / No data | "At least" is met when the value is equal or higher; "At most" when it is equal or lower. No data means the figure cannot be calculated for the period |

## How to

### Record waste

1. Click **Add waste record**.
2. Enter the **Date** and the **Weight (kg)**.
3. Choose the **Waste category** and **Where it came from**. Optionally choose the **Fabric lot**.
4. Under Disposal choose the **Disposal method**. Optionally fill in who took it, the cost, the amount it was sold for and the reference.
5. Click **Save**. The message "Waste record added." appears.

Do not enter process loss (the difference between a session's input and output). It is calculated from the sessions.

### Enter a utility reading

1. Open the **Utilities** tab and click **Add reading**.
2. Choose the **Utility** and the **Date**.
3. Enter the **Quantity used** in the unit shown under the field.
4. Optionally enter the cost, the area and the meter or bill number.
5. Click **Save**.

### Set a target (Admin)

1. Open the **Setup** tab and click **New target**.
2. Choose the **Figure**, then **At least** or **At most**, and enter the **Target**.
3. Click **Save**. The target appears on the dashboard.

### Produce the environmental report

1. Open the **Environmental report** tab.
2. Choose the period.
3. Click **Export CSV** to download it.

## Business rules

### Entries

| Rule | Message |
|---|---|
| Weight and quantity used must be greater than zero | "Must be greater than zero." |
| Costs and the sold-for amount cannot be negative | "Can't be negative." |
| The date cannot be in the future | "The date can't be in the future." |
| A new record cannot use a category that is Not in use. A record that already has it may keep it | "This waste category is not in use." |
| The person who records an entry is set by the server | (none) |
| A supervisor can change only their own entries | "You can only change entries you recorded yourself." |
| Only an Admin deletes entries | "Only an admin can delete this." |
| A utility's unit is set by the server from the utility | (none) |

### Setup

| Rule | Message |
|---|---|
| Only an Admin changes categories and targets | "You do not have permission to perform this action." |
| A category with waste records cannot be deleted | "This record cannot be deleted because other records depend on it: …" Switch it to Not in use instead |
| A target value cannot be negative | "Can't be negative." |
| One active target per figure | "There is already an active target for this figure. Edit it, or switch it off first." |

### How the figures are calculated

Each source counts in the period by its own date:

| Source | Counted by |
|---|---|
| Deliveries | The day received. Rejected deliveries are left out |
| Sorting, decolorization and drying sessions | The day they were completed. Only completed sessions count |
| Waste records | Their date |
| Utility readings | Their date |
| Chemical issuances | The day issued |

| Figure | Definition |
|---|---|
| Material in | Our weight of the deliveries received in the period |
| Process loss | For each stage: input minus output of the sessions completed in the period, in kg and as a share of the input. "Recorded waste" is the waste entered on those sessions. "Other loss" is the rest: moisture, dust and weighing differences |
| Recovery rate | Dried output of the drying sessions completed in the period ÷ the weight taken into the sorting sessions completed in the period. Material sorted in one period can be dried in the next, so short periods can read high or low; a year gives the truest figure |
| Stage yields combined | Sorting yield × decolorization yield × drying yield for the period |
| Waste handled | Total weight of the waste records in the period |
| Diverted from landfill | Share of waste handled whose disposal method is not Landfill. Incinerated and Treated count as diverted |
| Hazardous | Weight of waste records whose category is classified Hazardous |
| Water per kg | Water readings (m3 × 1000 = litres) ÷ dried output in kg. The water written on decolorization sessions is shown beside it and is not added in |
| Energy per kg | Electricity readings in kWh ÷ dried output in kg. Gas, steam and diesel are listed in their own units and are not converted |
| Chemicals | Quantity per chemical, and cost as quantity × the unit cost kept on each issuance. Chemical cost per kg = that cost ÷ dried output in kg |

When there is nothing to divide by, a figure shows a dash, not zero.

Period defaults: the Dashboard and the report screen both start at This month. Called without any period, the summary endpoint uses this month and the report endpoint uses all time.

Every add, change and delete is written to the audit log.

## Related data

The module only reads other modules. It never changes them.

| Module | What it reads |
|---|---|
| [Warehouse](warehouse.md) | Weight of deliveries that are not Rejected |
| [Sorting](sorting.md) | Completed sorting sessions. A waste record can name a fabric lot |
| [Decolorization](decolorization.md) | Completed sessions (including the water recorded on them) and chemical issuances with their cost |
| [Drying](drying.md) | Completed drying sessions; their output is the "dried output" used in most rates |
| [Users](users.md) | Who recorded each entry |

Waste records here are separate from the waste quantities entered when completing a session. Both appear in the report, in different sections.

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/sustainability/models.py`

| Model | Notes |
|---|---|
| `WasteCategory` | `name` (unique), `classification` (`Recyclable`, `Reusable`, `Hazardous`, `General`), `description`, `is_active`. Defaults come from migration `0002_default_waste_categories` |
| `WasteRecord` | `date`, `category` (`PROTECT`), `stage`, `quantity_kg`, `fabric` (`sorting.FabricStock`, `SET_NULL`), `disposal_method`, `disposed_to`, `disposal_cost`, `revenue`, `disposal_reference`, `notes`, `recorded_by` |
| `UtilityReading` | `date`, `utility`, `quantity`, `unit` (set in `save()` from `UNITS`), `cost`, `stage`, `meter_reference`, `notes`, `recorded_by` |
| `SustainabilityTarget` | `metric`, `target_value`, `direction`, `period`, `is_active` |

### Services

`backend/apps/sustainability/services.py`

| Function | Purpose |
|---|---|
| `figures(params)` | Everything the report shows for a period: `material_in`, `stages`, `recovery`, `waste`, `utilities`, `chemicals`, `targets`, `definitions` |
| `trend(months)` | One row per month: input to sorting, dried output, recovery, waste, water, electricity |
| `targets(actuals)` | Each active target with the calculated value and `met` (true, false or null) |
| `with_default_period(params)` | "This month" when no period was sent |
| `DEFINITIONS` | The explanations shown on the dashboard and exported with the report |

All figures are returned as strings with two decimals, or null.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/sustainability/waste-records/` | List or add. Filters: `classification`, `stage`, `category`, `disposal_method`, and the shared period parameters on `date` |
| GET, PUT, PATCH, DELETE | `/api/v1/sustainability/waste-records/<id>/` | One record |
| GET, POST | `/api/v1/sustainability/utility-readings/` | List or add. Filters: `utility`, `stage`, and the period parameters |
| GET, PUT, PATCH, DELETE | `/api/v1/sustainability/utility-readings/<id>/` | One reading |
| GET, POST | `/api/v1/sustainability/waste-categories/` and `/<id>/` | Waste categories |
| GET, POST | `/api/v1/sustainability/targets/` and `/<id>/` | Targets |
| GET | `/api/v1/sustainability/summary/` | Figures for a period (this month by default) plus `trend`. `months=6` shortens the trend from 12 to 6 months |
| GET | `/api/v1/sustainability/report/` | Figures for a period (all time by default) |

The screens send `date_filter=all` for "All time". The server ignores an unknown `date_filter` value, which gives all time and stops the summary from falling back to this month.

### Permissions

- Waste records and utility readings use `IsRecorder` (in `views.py`): any valid role reads and adds; `DELETE` needs the `admin` role; changing an object needs the `admin` role or `recorded_by` to be the user.
- Categories, targets, the summary and the report use `SharedReadPermission`: any valid role reads, only the `admin` role writes.
- The API gate requires the Sustainability page (any level to read, Full to change). The page may also read the sorting API for the fabric lot dropdown. The figures themselves are computed on the server, so the user does not need access to the warehouse, decolorization or drying APIs.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/sustainability/page.tsx` | The route |
| `frontend/src/features/sustainability/sustainability-page.tsx` | Tabs, tables, the dashboard |
| `frontend/src/features/sustainability/environmental-report.tsx` | The report, `periodParams`, the CSV export |
| `frontend/src/features/sustainability/sustainability-forms.tsx` | Waste record, utility reading, category and target forms |
| `frontend/src/features/sustainability/schemas.ts` | Form rules and the lists of classifications, stages, methods, utilities, units and metrics |
| `frontend/src/types/sustainability.ts` | The record and report types |

The lists of units, methods and metrics exist on both sides (`schemas.ts` and `models.py`). Change both together.

### Tests

- Backend: `backend/apps/sustainability/tests.py` covers the default categories, who manages categories and targets, value checks, own-entry editing, protected categories, filters, the material balance, the recovery rate, waste by classification and method, water, energy and chemicals per kg, targets, the trend, the default periods and empty data.
- Browser: `frontend/e2e/sustainability.mjs` covers the dashboard and its explanations, a category, a waste record by a supervisor, the classification filter, a utility reading, the figures growing by what was entered, the report and its CSV export, another supervisor being unable to change the record, and an admin deleting it.

`backend/apps/sustainability/demo.py` adds and removes demonstration data; it is used by the `seed_module_data` management command, not by the screens.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Recovery rate shows a dash | No sorting session was completed in the period | Choose a longer period |
| Recovery rate is above 100% or very low | Material sorted in one period was dried in another | Use a longer period, such as This year, or read "Stage yields combined" |
| Water per kg or Energy per kg shows a dash | No drying session was completed in the period, so there is no dried output | Choose a longer period |
| A target shows "No data" | Its figure cannot be calculated for the period | Same as above |
| "There is already an active target for this figure." | Another target for the figure is In use | Edit that one, or set it to Not in use first |
| No menu on a waste record or reading | Someone else recorded it and you are not an Admin | Ask the person who recorded it, or an Admin |
| No **Delete** in the menu | Only Admins delete entries | Ask an Admin |
| A category is missing from the waste form | It is Not in use | An Admin sets it to In use |
| A delivery is missing from Material received | Its warehouse status is Rejected | Nothing to fix; rejected deliveries are left out on purpose |
| The dashboard chart does not change with the period | The monthly chart always shows the last 12 months | Nothing to fix |

## Keeping this page up to date

- `backend/apps/sustainability/models.py`, `serializers.py`, `views.py`, `urls.py`: records, choices, rules, permissions and endpoints.
- `backend/apps/sustainability/services.py`: every calculation and the `DEFINITIONS` text. If a formula changes, update "How the figures are calculated".
- `backend/apps/sustainability/migrations/0002_default_waste_categories.py`: the starting categories.
- `frontend/src/features/sustainability/`: tabs, columns, labels, form rules and the CSV export.
