# Decolorization

This page explains the Decolorization module: tanks, chemical stock, chemical lots, recipes, chemical issuances, decolorization sessions (batches), and the chemical usage report. It is for decolorization supervisors, administrators, and developers who maintain the module.

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

Decolorization is the third step of the material flow. Sorted fabric is treated with chemicals in tanks to remove its colour. The module keeps:

- **Tanks**: the vessels, with their capacity, load and status.
- **Chemicals**: the stock of each chemical, with its cost and safety details.
- **Lots**: batches of a chemical received from a supplier. Receiving a lot adds to the chemical's stock.
- **Recipes**: the chemicals and settings for treating 100 kg of material. A recipe keeps every earlier version.
- **Issuances**: chemical taken out of stock for a tank.
- **Sessions**: one batch of fabric treated in one tank. A session is also called a batch on the screens.
- **Usage**: a report of chemical quantity and cost for a period.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full |
| Decolorization Supervisor | Full |
| Other roles | No access to the page |

Two actions need a duty on top of the page:

| Action | Needs |
|---|---|
| Issue a chemical marked as restricted | The duty *Issue restricted chemicals* (Admin by default) |
| Approve a batch | The duty *Approve decolorization batches* (Admin by default) |

With **View only** access the add button is replaced by a "View only" badge. Row menus keep only **Chemicals used**, and tank cards lose their menu. The server refuses any change.

How access and duties are changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/decolorization`. Its title is **Decolorization** and it has eight tabs. The button at the top right changes with the tab:

| Tab | Button |
|---|---|
| Dashboard | Start session |
| Tanks | Add tank |
| Chemicals | Add chemical |
| Lots | Receive lot |
| Recipes | New recipe |
| Issuances | Issue chemical |
| Sessions | Start session |
| Usage | Issue chemical |

Every table has a search box, **Columns** and **Export** (a CSV file).

### Dashboard tab

| Part | Shows |
|---|---|
| Low chemical stock warning | Appears when any chemical has less than 25% of its total stock left: "Low chemical stock: … — below 25% remaining. Restock by raising the chemical's total stock." |
| Tanks | Number of tanks, with how many are Processing and Completed |
| Tanks processing | Share of tanks with status Processing |
| Output efficiency | Output of completed sessions ÷ input of all sessions |
| Chemical issued | Sum of all issuance quantities, and the number of issuances |
| Tanks by status | A count for each tank status |
| Sessions | Total, Completed and In progress counts, and a bar of the output and waste shares of completed input |
| Chemical stock levels | A bar per chemical with the 25% reorder level marked |

### Tanks tab

Tanks are shown as cards, not as a table. Each card shows the tank name, "Batch" and its batch ID, the status, a fill bar (current load against capacity), the fabric assigned or "No fabric assigned", and how long it has been running when the status is Processing.

Tools: a search box ("Search tank, batch, fabric…"), a **Tank status** filter and a count ("3 of 8 tanks").

Card actions (the "⋯" menu): **Edit**, **Delete**.

### Chemicals tab

| Column | Shows |
|---|---|
| Chemical | Name, with a **Restricted** badge when restricted |
| Total | Total stock with its unit |
| Remaining | Remaining stock with its unit |
| Stock left | A bar and percentage; red below 25% |
| Cost per unit | Cost in Rs., or a dash |
| Safety | Hazard class, and the safety data sheet reference. A reference that starts with `http://` or `https://` is shown as a **Data sheet** link. Handling notes appear when you hover |

Row actions: **Edit**, **Delete**.

### Lots tab

| Column | Shows |
|---|---|
| Lot | Lot number |
| Chemical | Chemical name |
| Quantity | Quantity received |
| Cost per unit | Cost in Rs. |
| Supplier | Supplier name |
| Received | Date received |
| Expiry | Expiry date, or an **Expired** badge once the date has passed |
| Received by | The user who entered the lot |

Row actions: **Edit**, **Delete**.

### Recipes tab

| Column | Shows |
|---|---|
| Recipe | Name |
| Material | Material type, or "Any" |
| Version | The current version, e.g. "v2" |
| Chemicals per 100 kg | The chemicals and quantities of the current version |
| Process | Temperature, duration and water of the current version |
| Batches | Number of sessions that used any version |
| Status | In use or Not in use |

Row actions: **Edit** (the form also shows the version history), **Delete**.

### Issuances tab

| Column | Shows |
|---|---|
| Chemical | Chemical name |
| Tank | Tank name |
| Quantity | Quantity with the chemical's unit |
| Batch | The session the issuance is linked to, e.g. "#12", or a dash |
| Cost | Quantity × the cost per unit at the time of issue |
| Issued by | Username |
| Date | Date issued |

Row actions: **Edit**, **Delete**.

### Sessions tab

| Column | Shows |
|---|---|
| # | Session number |
| Tank | Tank name |
| Fabric | Material of the lot |
| Supervisor | Username |
| Input | Input quantity |
| Output | Output quantity |
| Waste | Waste quantity |
| Efficiency | Output ÷ input, shown for completed sessions only |
| Recipe | Recipe name and version, or a dash |
| Chemical cost | Cost of the issuances linked to the session |
| Status | In Progress, Completed, Failed or On Hold |
| Approved | Who approved the batch; hover for the date |

Tools: a **Status** filter and a **Period** filter (by start date).

Row actions:

| Action | When it is offered |
|---|---|
| **Complete** | While the session is not Completed |
| **Chemicals used** | Always, also on a view-only page |
| **Approve batch** | To users with the duty *Approve decolorization batches*, while the batch is not approved |
| **Edit**, **Delete** | Always (with Full access) |

**Chemicals used** opens a panel on the right titled "Chemicals used: session #…". It shows, for each chemical, the **Planned** quantity (from the recipe, scaled to the input weight), the quantity **Issued**, the **Difference** ("On plan", or + or −) and the **Cost**. Below the table it compares Chemical cost, Cost per kg treated, Temperature, Duration and Water with the recipe. Without a recipe it says "No recipe was chosen for this batch, so there is no plan to compare against."

### Usage tab

A period filter (it starts at This month) with the note "By the date the chemical was issued". Four cards and a table:

| Part | Shows |
|---|---|
| Chemical cost | Total cost of issuances in the period |
| Chemicals used | Number of different chemicals issued |
| Batches treated | Number of sessions that received issuances, and their total input weight |
| Cost per kg treated | Cost of issuances linked to a batch ÷ input weight of those batches |
| Table | Per chemical: Issued quantity, number of Issuances, Cost |

## Records and fields

### Tank

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Tank name | Name, e.g. "Tank A-01" | Yes | Up to 100 characters. "Enter the tank name." |
| Batch ID | An identifier for the tank's batch | Yes | Up to 100 characters. Must be unique across tanks. "Enter the batch ID." |
| Capacity (kg) | How much the tank holds | Yes | Greater than zero |
| Current load (kg) | Fabric in the tank now | Yes | Zero or more. Starts at 0 |
| Fabric | The fabric lot in the tank | No | "None" leaves it empty |
| Status | See [Statuses](#statuses) | Yes | Starts as Empty |

The tank record also has a supervisor, a start date, an expected completion, an actual completion and notes. The form does not show them. The actual completion is filled in when a session in the tank is completed.

### Chemical

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Chemical name | Name, e.g. "Hydrogen Peroxide" | Yes | Up to 255 characters |
| Total stock | All stock ever held | Yes | Greater than zero |
| Unit of measure | Liters, Kg or Grams | Yes | Starts as Liters |
| Cost per unit (Rs.) | Cost of one unit | No | Zero or more. Receiving a lot updates it |
| Usual supplier | A vendor from the Warehouse list | No | Only active vendors are offered, plus the one already chosen |
| Hazard class | Free text with suggestions: Corrosive, Oxidizer, Flammable, Toxic, Irritant, Environmental hazard | No | Up to 100 characters |
| Who may issue it | "Anyone on this page" or "Restricted (needs the duty)" | Yes | A restricted chemical needs the duty *Issue restricted chemicals* to issue |
| Safety data sheet | A link, or where the sheet is filed | No | Up to 255 characters. Text only; no file is uploaded here |
| Handling notes | Free text | No | |
| Remaining | Stock left | Automatic | Starts equal to Total stock. Goes down with issuances and up with lots |
| Issued | Total issued | Automatic | |

### Chemical lot

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Chemical | The chemical received | Yes | Cannot be changed after the lot is saved |
| Lot number | "As printed on the drum" | Yes | Up to 100 characters. Unique for the chemical |
| Quantity | Quantity received, in the chemical's unit | Yes | Greater than zero. Cannot be changed after the lot is saved |
| Cost per unit (Rs.) | Cost of one unit in this lot | No | Zero or more |
| Supplier | A vendor | No | |
| Received on | Date received | Yes | Starts as today |
| Expiry date | When the lot expires | No | Not before the received date |
| Notes | Free text | No | |
| Received by | The user who saved the lot | Automatic | |

### Recipe

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | Recipe name, e.g. "Cotton bleach" | Yes | Up to 150 characters. Must be unique |
| Material | The material it is for | No | "Leave empty to use it for any material" |
| Status | In use or Not in use | Yes | Only recipes In use are offered for new sessions |
| Chemicals per 100 kg | One line per chemical with a quantity | At least one | Each chemical once. Quantity greater than zero |
| Temperature, °C | Planned temperature | No | Up to 1 decimal |
| Duration, minutes | Planned duration | No | Whole number |
| Water, L per 100 kg | Planned water | No | Up to 2 decimals |
| What changed | A note kept with the new version | No | Shown only when editing |

A **recipe version** holds the chemicals and the process settings. It also records its number, who created it and when. Versions are never edited.

### Chemical issuance

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Chemical | What is issued. Options read "name — quantity left", with "(restricted)" when restricted | Yes | |
| Tank | The tank it is for | Yes | |
| Quantity | How much, in the chemical's unit | Yes | Greater than zero, not more than the remaining stock |
| Issued by | Who issued it | No | "Leave empty to record yourself" |
| Notes | Free text | No | |
| Batch | The session it was used on | Automatic | Set when the tank has exactly one session In Progress |
| Cost per unit | The chemical's cost when issued | Automatic | Kept so later price changes do not alter past batches |
| Date | When it was issued | Automatic | |

### Decolorization session

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Tank | The tank used | Yes | |
| Fabric lot | The lot treated. Every fabric lot is offered | Yes | A quarantined lot is refused |
| Supervisor | Any active user | Yes | |
| Input quantity (kg) | Fabric put in | Yes | Greater than zero |
| Recipe | A recipe version. The current version of each recipe In use is offered | No | "Sets the planned chemicals for this batch" |
| Temperature, °C | Actual temperature | No | Zero or more, up to 1 decimal |
| Duration, minutes | Actual duration | No | Whole number |
| Water, liters | Actual water used | No | Zero or more |
| Notes | Free text | No | |
| Output (kg) | Decolorized output. Entered when completing | On completion | Zero or more |
| Waste (kg) | Waste. Entered when completing | On completion | Zero or more. Starts at 0 |
| Approved by, approved at | The sign-off | Automatic | Set by **Approve batch** |
| Start date, end date | Creation and completion times | Automatic | |

## Statuses

### Tank

| Status | How it is reached |
|---|---|
| Empty | The default for a new tank |
| Filled | Chosen by hand in the tank form |
| Processing | Chosen by hand in the tank form |
| Completed | Set automatically when a session in the tank is completed. Can also be chosen by hand |
| Cleaning | Chosen by hand in the tank form |

Starting a session does not change the tank's status. Set it to Processing yourself if you want the dashboard to show the tank in use.

### Decolorization session

| Status | How it is reached |
|---|---|
| In Progress | Every new session starts here |
| Completed | **Complete** on the row |
| Failed | The status exists, but no control on the screen sets it. It can only be set through the API |
| On Hold | Same as Failed |

Approval is separate from the status. A session is either approved or not.

### Recipe

In use or Not in use, chosen in the form.

### Chemical lot

A lot has no status. It shows an **Expired** badge when its expiry date is before today. An expired lot does not block anything.

## How to

### Add a chemical

1. Open the **Chemicals** tab and click **Add chemical**.
2. Enter the **Chemical name**, the **Total stock** and the **Unit of measure**.
3. Optionally fill in the cost, the usual supplier and the Safety group.
4. Click **Save**. Remaining stock starts equal to the total.

### Receive a chemical lot

1. Open the **Lots** tab and click **Receive lot**.
2. Choose the **Chemical**. Enter the **Lot number** and the **Quantity**.
3. Optionally enter the **Cost per unit (Rs.)**, **Supplier**, **Expiry date** and **Notes**.
4. Click **Receive**.

The quantity is added to the chemical's total and remaining stock. If you entered a cost, it becomes the chemical's cost per unit.

### Restock without a lot

1. On the **Chemicals** tab choose **Edit** on the chemical.
2. Raise the **Total stock** and click **Update**. Remaining stock rises by the same amount.

### Create or change a recipe

1. Open the **Recipes** tab and click **New recipe**, or **Edit** on a recipe.
2. Enter the **Name**. Add each chemical with its quantity per 100 kg using **Add chemical**.
3. Optionally fill in the Process group.
4. When editing, describe the change under **What changed**.
5. Click **Save** or **Update**.

A new recipe starts at version 1. Changing the chemicals or the process saves the next version. Changing only the name, material or status does not.

### Start a session

1. Click **Start session**.
2. Choose the **Tank**, the **Fabric lot** and the **Supervisor**. Enter the **Input quantity (kg)**.
3. Optionally choose a **Recipe** and fill in the process fields.
4. Click **Start session**.

### Issue a chemical

1. Open the **Issuances** tab and click **Issue chemical**.
2. Choose the **Chemical** and the **Tank**. Enter the **Quantity**.
3. Click **Issue**.

The quantity leaves the chemical's remaining stock. If the tank has exactly one session In Progress, the issuance is linked to that batch.

### Complete a session

1. On the **Sessions** tab choose **Complete** on the row.
2. Enter the **Output (kg)** and the **Waste (kg)**. Together they cannot be more than the input.
3. Click **Mark complete**.

The tank's status becomes Completed and the fabric lot's status becomes Sent to Decolorization.

### Compare a batch with its recipe

1. On the **Sessions** tab choose **Chemicals used** on the row.
2. Read the Planned, Issued and Difference columns.

### Approve a batch

1. Sign in as a user with the duty *Approve decolorization batches* (Admin by default).
2. On the **Sessions** tab choose **Approve batch** on the row. The message "Batch approved." appears.

### Correct a wrong lot

The chemical and quantity of a lot cannot be edited. Delete the lot and enter it again. Deleting takes the quantity back out of stock.

## Business rules

### Chemicals

| Rule | Message |
|---|---|
| Total stock must be greater than zero | "Total stock must be greater than zero." |
| Cost cannot be negative | "Cost can't be negative." |
| Remaining stock cannot be typed in. It starts equal to the total and moves with issuances, lots and changes to the total | (none) |
| The total cannot be lowered below what has been issued | "30.00 has already been issued; total stock cannot be lower than that." |
| A chemical cannot be deleted while an issuance, a lot or a recipe line uses it | "This record cannot be deleted because other records depend on it: …" |

### Lots

| Rule | Message |
|---|---|
| Quantity must be greater than zero | "Must be greater than zero." |
| Cost cannot be negative | "Cost can't be negative." |
| Expiry cannot be before the received date | "Can't be before the date it was received." |
| A chemical cannot have two lots with the same lot number | A uniqueness error from the server |
| The chemical and quantity are fixed once the lot is saved | "This can't be changed after the lot is received. Delete the lot and enter it again." |
| Receiving a lot adds its quantity to the chemical's total and remaining stock, and sets the chemical's cost when the lot's cost is not zero | (none) |
| Deleting a lot takes its quantity back out. It is refused once the chemical has less left than the lot's quantity | "Only 40.00 Liters of this chemical is left, so part of this lot has already been issued. It can no longer be deleted." |

Issuances are not taken from a particular lot. Stock is counted per chemical.

### Recipes

| Rule | Message |
|---|---|
| A recipe needs at least one chemical | "Add at least one chemical." |
| A chemical can appear once in a recipe | "Each chemical can be listed once." |
| Each quantity must be greater than zero | "Quantity must be greater than zero." |
| Changing the chemicals or the process makes the next version. Sessions keep the version they used | (none) |
| A recipe cannot be deleted once a session has used one of its versions | "This record cannot be deleted because other records depend on it: …" |

### Issuances

| Rule | Message |
|---|---|
| Quantity must be greater than zero | "Must be greater than zero." |
| Quantity cannot be more than the remaining stock. When editing, the issuance's own quantity counts as available | "Not enough stock. Available: 70.00" |
| A restricted chemical needs the duty *Issue restricted chemicals* (Admin by default) | "Hydrogen Peroxide is restricted: your role is not allowed to issue it." |
| A session given by an API client must run in the same tank | "This session runs in another tank." |
| Creating an issuance takes the quantity out of remaining stock and adds it to issued | (none) |
| Editing an issuance returns the old quantity and takes the new one. If the chemical is changed, the cost is copied from the new chemical | (none) |
| Deleting an issuance returns its quantity to stock | The delete dialog says so |
| When an issuance takes a chemical from 25% or more of its total to below 25%, a low-stock email alert is sent once | See [Approvals and notifications](approvals-and-notifications.md) |

### Sessions

| Rule | Message |
|---|---|
| A session cannot be started on, or moved to, a lot in quarantine | "This fabric lot is in quarantine after failing inspection QC-00001 and can't be decolorized until an admin releases it." |
| Temperature and water cannot be negative | "Can't be negative." |
| A completed session cannot be completed again | "Session already completed." |
| Output and waste must be valid numbers, zero or more | "Enter a valid number." / "Must be zero or more." |
| Output plus waste cannot be more than the input | "Output (95.00 kg) plus waste (10.00 kg) is more than the input (100.00 kg)." |
| Completing sets the tank to Completed with its actual completion time, and the fabric lot to Sent to Decolorization | (none) |
| Approving needs the duty *Approve decolorization batches* (Admin by default) | "Your role is not allowed to approve a batch." |
| A batch can be approved once | "This batch is already approved." |

Things the code does **not** do:

- The input quantity is not checked against the tank's capacity or against the fabric lot's quantities.
- Starting a session does not change the tank or the lot.
- Approval is a sign-off only. It blocks nothing and can be given at any status.
- Decolorization does not add sellable stock. Only completed drying sessions do.

Every add, change, completion, approval and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Sorting](sorting.md) | Sessions and tanks point to a fabric lot. Completing a session sets the lot's status |
| [Quality](quality.md) | Quarantined lots cannot start a session |
| [Drying](drying.md) | A drying session can name the decolorization session its fabric came from. The Drying form offers lots with status Sent to Decolorization |
| [Warehouse](warehouse.md) | Chemicals and lots name a vendor as supplier. The module has its own supplier list endpoint that returns names only |
| [Production](production.md) | Reads decolorization data to show a lot's activity |
| [Maintenance](maintenance.md) | Reads tanks |
| [Approvals and notifications](approvals-and-notifications.md) | Completed batches that are not yet approved appear in the approvals inbox with an Approve action. Low chemical stock raises an alert and an email |
| [Documents](documents.md) | Safety data sheet files are not stored here; the chemical holds only a reference |
| [Users](users.md) | Supervisors and issuers are users |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/decolorization/models.py`

| Model | Notes |
|---|---|
| `ChemicalStock` | `chemical_name`, `total_stock`, `issued_quantity`, `remaining_stock`, `unit_of_measure`, `unit_cost`, `supplier` (`warehouse.Vendor`, `PROTECT`), `hazard_class`, `handling_notes`, `sds_reference`, `is_restricted`, `last_updated` |
| `ChemicalLot` | `chemical`, `lot_number` (unique with `chemical`), `supplier`, `received_on`, `quantity`, `unit_cost`, `expiry_date`, `notes`, `received_by` |
| `Recipe` | `name` (unique), `material_type`, `is_active` |
| `RecipeVersion` | `recipe`, `version` (unique with `recipe`), `temperature_c`, `duration_minutes`, `water_liters_per_100kg`, `notes`, `created_by` |
| `RecipeLine` | `version`, `chemical` (`PROTECT`), `quantity_per_100kg` |
| `Tank` | `name`, `capacity`, `fabric` (`SET_NULL`), `batch_id` (unique), `tank_status`, `fabric_quantity`, `start_date`, `expected_completion`, `actual_completion`, `supervisor`, `notes` |
| `ChemicalIssuance` | `chemical`, `tank`, `issued_by` (all `PROTECT`), `quantity`, `issued_at`, `notes`, `session` (`SET_NULL`), `unit_cost` (not editable) |
| `DecolorizationSession` | `tank`, `fabric`, `supervisor` (all `PROTECT`), `input_quantity`, `output_quantity`, `waste_quantity`, `status`, `start_date`, `end_date`, `notes`, `recipe_version` (`PROTECT`), `temperature_c`, `duration_minutes`, `water_liters`, `approved_by`, `approved_at` |

There is no `services.py`. The rules are in `backend/apps/decolorization/serializers.py` (validation, recipe versioning in `RecipeSerializer.create` and `update`) and `backend/apps/decolorization/views.py` (stock movements in `ChemicalIssuanceViewSet` and `ChemicalLotViewSet`, `complete`, `approve`, and the `consumption` function).

Computed decimals are returned as strings with two decimals (`_fixed`).

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/decolorization/chemicals/` | List or add chemicals |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/chemicals/<id>/` | One chemical |
| GET | `/api/v1/decolorization/chemicals/low_stock/` | Chemicals with remaining stock below 50 units. Not used by the screens, which use the 25% rule |
| GET, POST | `/api/v1/decolorization/tanks/` | List or add tanks. Filter: `status`. Accepts `current_load` as another name for `fabric_quantity` |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/tanks/<id>/` | One tank |
| POST | `/api/v1/decolorization/tanks/<id>/start/` | Set the tank to Processing with a start date. Not used by the screens |
| POST | `/api/v1/decolorization/tanks/<id>/complete/` | Set the tank to Completed. Not used by the screens |
| GET, POST | `/api/v1/decolorization/issuances/` | List or add issuances |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/issuances/<id>/` | One issuance |
| GET, POST | `/api/v1/decolorization/sessions/` | List or add sessions |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/sessions/<id>/` | One session |
| POST | `/api/v1/decolorization/sessions/<id>/complete/` | Complete. Body: `output_quantity`, `waste_quantity` |
| POST | `/api/v1/decolorization/sessions/<id>/approve/` | Approve the batch |
| GET | `/api/v1/decolorization/sessions/<id>/consumption/` | Planned against issued chemicals for one batch |
| GET, POST | `/api/v1/decolorization/lots/` | List or receive lots. Filter: `chemical` |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/lots/<id>/` | One lot |
| GET, POST | `/api/v1/decolorization/recipes/` | List or add recipes, each with all versions |
| GET, PUT, PATCH, DELETE | `/api/v1/decolorization/recipes/<id>/` | One recipe. Writes take `lines`, `temperature_c`, `duration_minutes`, `water_liters_per_100kg` and `change_note` at the top level |
| GET | `/api/v1/decolorization/fabric-stock/` | Fabric lots for the dropdowns: `id`, `material_type`, `status` |
| GET | `/api/v1/decolorization/suppliers/` | Vendors for the dropdowns: `id`, `name`, `is_active` |
| GET | `/api/v1/decolorization/usage/` | Usage report. Takes the shared period parameters, applied to the issue date |

The two dropdown endpoints exist because the Decolorization page may read only the decolorization API, not the sorting or warehouse APIs.

How the consumption figures are worked out (`consumption` in `views.py`):

- Planned quantity = recipe quantity per 100 kg × input ÷ 100.
- Planned cost uses each chemical's current cost. Actual cost uses the cost stored on each issuance.
- Cost per kg = actual cost ÷ input quantity.

### Permissions

- Every view uses `IsDecolorizationOrAdmin`: any valid role may read; a change needs the `decolorization` page in Full.
- The API gate (`check_api_access`) lets a user read the decolorization API if they hold one of: Decolorization, Dashboard, Production or Maintenance.
- Duties are checked with `has_duty`: `issue_restricted_chemicals` in `ChemicalIssuanceSerializer.validate`, `approve_batches` in `DecolorizationSessionViewSet.approve`.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/decolorization/page.tsx` | The route |
| `frontend/src/features/decolorization/decolorization-page.tsx` | Tabs, tables, tank cards |
| `frontend/src/features/decolorization/decolorization-dashboard.tsx` | Dashboard, `isLowStock`, `ChemicalLevel` |
| `frontend/src/features/decolorization/decolorization-forms.tsx` | Tank, chemical, issuance, session and completion forms |
| `frontend/src/features/decolorization/chemical-extras.tsx` | Lot and recipe forms, `ConsumptionSheet`, `UsagePanel` |
| `frontend/src/features/decolorization/schemas.ts` | Form rules, status lists, `LOW_STOCK_SHARE` (0.25) |
| `frontend/src/types/api.ts` | The record types |

The 25% low-stock level is defined twice: `LOW_STOCK_SHARE` in the frontend and `CHEMICAL_LOW_PCT` in `backend/apps/notifications/tasks.py`. Change both together.

### Tests

- Backend: `backend/apps/decolorization/tests.py` covers issuance stock movements, the low-stock endpoint, tank start and complete, session completion, corrections, lots, restricted chemicals, the automatic batch link, recipe versions, consumption, approval and the usage report.
- Browser: `frontend/e2e/decolorization.mjs` covers chemical levels, issuing and over-issuing, deleting an issuance, restocking, receiving and deleting a lot, recipe versions and history, the usage report, the hidden **Approve batch** item for a supervisor, the planned-against-issued panel, and the tank and session filters.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "Not enough stock. Available: …" | The quantity is more than the chemical's remaining stock | Receive a lot or raise the total stock first |
| "… is restricted: your role is not allowed to issue it." | The chemical is restricted and your role lacks the duty | Ask an admin to issue it, or to give your role the duty |
| An issuance shows no Batch | The tank had no session In Progress, or more than one, when the chemical was issued | Nothing links it afterwards on the screen. It still counts in the chemical cost of the period, but not in the cost per kg |
| A lot cannot be deleted | Part of it has been issued | Leave the lot. Correct stock by editing the chemical's total |
| The lot form will not let you change Chemical or Quantity | They are fixed once received | Delete the lot and enter it again |
| Editing a recipe did not make a new version | Only the name, material or status changed | Nothing to fix. Versions are made when the chemicals or the process change |
| A recipe is missing from the session form | The recipe is Not in use | Set it to In use |
| The tank still shows Empty while a session is running | Starting a session does not change the tank | Edit the tank and set the status to Processing |
| The low-stock warning stays after a restock | The chemical is still below 25% of its total | Raise the stock further |

## Keeping this page up to date

- `backend/apps/decolorization/models.py`, `serializers.py`, `views.py`, `urls.py`: fields, statuses, rules, messages and endpoints.
- `frontend/src/features/decolorization/`: tabs, columns, labels, form rules and the low-stock share.
- `backend/apps/notifications/tasks.py` (`alert_if_chemical_became_low`, `CHEMICAL_LOW_PCT`): the low-stock alert.
- `backend/apps/access/services.py` (`DUTIES`, `PAGE_API`): the duties and which pages may read this module.
- `backend/apps/quality/services.py`: the quarantine check and its message.
