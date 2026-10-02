# Production

This page explains the Production module: production orders, their stages and materials, the schedule, material requirements, and the setup of process stages, routings and bills of materials. It is for production planners, floor supervisors, administrators, and developers who maintain the module.

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

A **production order** plans the processing of one fabric lot and then tracks what really happened. It compares planned and actual output, time, materials and cost. Orders are numbered MO-00001, MO-00002 and so on.

The module has three kinds of setup data:

- **Process stages**: the kinds of step your factory has, for example Sorting, Decolorization, Drying.
- **Routings**: an ordered list of stages. An order copies the stages of its routing.
- **Bills of materials**: what processing 100 kg of input needs. An order multiplies this by its planned input.

**Production orders move no stock.** They do not replace sorting, decolorization or drying sessions, they do not take chemicals out of stock, and they do not create sellable stock. Sellable stock still comes only from completed drying sessions (see [Drying](drying.md)). A production order is a plan and a cost record that sits beside those sessions.

## Who can use it

| Who | Starting access to the page |
|---|---|
| Admin | Full |
| Sorting, Decolorization and Drying Supervisors | Full |
| Warehouse Supervisor | No access |

What a user may do on the page depends on two duties:

| Duty | Starts with | Allows |
|---|---|---|
| *Plan production* | Admin only | Create, change and delete orders. Release and cancel orders. Skip a stage. Plan a stage (operator, machine, hours, cost). Maintain process stages, routings and bills of materials. Change planned materials |
| *Run production stages* | Sorting, Decolorization and Drying Supervisors (and Admin) | Start and complete stages. Complete an order. Record the quantity of material actually used |

A user with *Plan production* can also do everything *Run production stages* allows.

Everyone who can open the page can read all orders and setup data. With **View only** access nothing can be changed.

How access and duties are changed is explained in [Access control](../05-access-control.md).

## Screens

The page is at `/production`. Its title is **Production** and it has five tabs. For users with the duty *Plan production*, the button at the top right is **New order**, or **New routing** on the Setup tab. Other users see no button there.

### Dashboard tab

| Card | Shows |
|---|---|
| In progress | Orders In Progress, and the weight being processed |
| Waiting to start | Released orders, and the number of drafts to release |
| Late | Open orders past their planned end date |
| Completed, this month | Orders completed this month, and their output |
| Yield, completed orders | Output ÷ input of all completed orders, with planned output and waste |
| Cost per kg | Cost ÷ output of all completed orders, with spent and planned cost |
| Material shortages | Number of materials that open orders need more of than is in stock |
| Work in progress | Up to 6 orders In Progress with their progress and current stage. Click one to open it |
| Time per stage | Planned against actual hours of finished stages |

### Orders tab

A table of orders. Clicking an order number, or **Open** in the row menu, shows the order view in place of the table.

| Column | Shows |
|---|---|
| Order | Number, with "High" for high priority |
| Product | Product name, with the lot number and material |
| Input | Planned input |
| Planned | Planned start and end dates, with a warning mark when late |
| Progress | A progress bar and the current stage |
| Status | Draft, Released, In Progress, Completed or Cancelled |

Tools: search ("Search order, product, material…"), an **Order status** filter, **Columns**, **Export** (`production-orders-<date>.csv`).

Row actions:

| Action | When it is offered |
|---|---|
| **Open** | Always |
| **Release** | Draft orders, to planners |
| **Cancel order** | Draft, Released and In Progress orders, to planners |
| **Edit** | Orders that are not Completed or Cancelled, to planners |
| **Delete** | Draft and Cancelled orders, to planners |

#### The order view

| Part | Shows |
|---|---|
| Top buttons | **All orders** (back). **Release** (Draft, planners). **Complete order** (In Progress with every stage Done or Skipped, floor users). **Edit** and **Cancel order** (open orders, planners) |
| Header | Number, status, priority, a **Late** badge, product, lot, routing, unit, dates, progress |
| Figures | Input, Output (with yield), Time (with waste), Cost (with cost per kg), each beside its planned value |
| Stages | One row per stage with its operator, machine, hours and status. Buttons: **Start** (the next Pending stage only), **Complete** (a stage In Progress), a skip button (planners), a plan button (planners). A finished stage shows "… in → … out · … waste" and its cost |
| Materials | Each planned material with the quantity used so far. **Record use** or **Change** for floor users, on orders that are Released or In Progress |
| Lot activity | The latest 8 sorting, decolorization and drying sessions of the order's fabric lot |

### Schedule tab

Draft, Released and In Progress orders as bars on a date line, soonest first. A vertical line marks today. Late orders have a red outline. Click a bar to open the order.

### Materials tab

"What open orders still need, from their bills of materials, against the chemical stock on hand."

| Column | Shows |
|---|---|
| Material | Material or chemical name |
| Still needed | Planned quantity less what has been recorded as used, over all open orders |
| In stock | Remaining stock, for materials linked to a stocked chemical. Otherwise a dash |
| Short by | The shortage, or "Covered" |
| For orders | The order numbers |

### Setup tab

Three tables: **Routings**, **Bills of materials** and **Process stages**. Planners see **New routing** (top right), **New bill of materials** and **New stage**, and **Edit** and **Delete** in each row menu.

| Table | Columns |
|---|---|
| Routings | Routing, Stages (in order), Planned time, Orders, Status |
| Bills of materials | Bill of materials (with product), Per 100 kg of input, Orders, Status |
| Process stages | Position, Stage, Done in, Status |

## Records and fields

### Production order

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Product | What is being produced, e.g. "White recycled fibre" | Yes | Up to 255 characters |
| Fabric lot | The lot to process. Options read "#id · material · kg unsorted", with "· in quarantine" when held | Yes | |
| Routing | The stages the order goes through. Only routings In use are offered | Yes | |
| Bill of materials | "Optional: plans chemicals and other materials" | No | |
| Planned input (kg) | Weight going in | Yes | Greater than zero |
| Planned output (kg) | Weight expected out | Yes | Greater than zero, not more than the input |
| Planned start, Planned end | Dates | Yes | The end cannot be before the start |
| Priority | Low, Normal or High | Yes | Starts as Normal |
| Factory unit | A unit from the Warehouse list | No | "Any unit" leaves it empty |
| Notes | Free text | No | |
| Number | MO-00001 … | Automatic | |
| Status | See [Statuses](#statuses) | Automatic | |
| Created by, released by, released at, started at, completed at | Who and when | Automatic | |
| Actual output | Set when the order is completed | Automatic | |

Calculated figures on every order:

| Figure | How it is worked out |
|---|---|
| Progress | Stages Done or Skipped ÷ all stages |
| Current stage | The stage In Progress, or else the first Pending stage. Shown while the order is Released or In Progress |
| Planned hours | Sum of the stages' planned hours |
| Actual hours | Sum of the hours of stages that are Done |
| Actual input | Input of the first stage that is Done |
| Output | The order's actual output, or else the output of the last stage that is Done |
| Waste | Sum of the waste of stages that are Done |
| Yield | Output ÷ actual input. Shown once the order is Completed |
| Planned cost | Planned hours × cost per hour for each stage, plus planned quantity × unit cost for each material |
| Labour cost | Actual hours × cost per hour, for stages that are Done |
| Material cost | Quantity used × unit cost, for each material |
| Total cost | Labour cost + material cost |
| Cost per kg | Total cost ÷ output. Shown once the order is Completed |
| Late | The order is Draft, Released or In Progress and its planned end is before today |

### Order stage (step)

Stages are created with the order, copied from the routing.

| Field (label) | Meaning | Set by |
|---|---|---|
| Stage, position | Copied from the routing | Automatic |
| Operator | Who runs the stage. "Whoever starts it" by default | Planner (plan button). If empty, the user who starts the stage |
| Machine | Free text, e.g. "Tank T-03, Dryer D-01" | Planner |
| Planned hours | Copied from the routing; can be changed | Planner |
| Cost per hour (Rs.) | Copied from the routing; can be changed | Planner |
| Input (kg), Output (kg), Waste (kg) | What went in and came out | Floor user, on completion |
| Hours worked | "Leave empty to use the time since the step was started." | Floor user, on completion |
| Started at, finished at, status | | Automatic |

When completing a stage, the Input field is filled in with the output of the last finished stage (or the planned input for the first stage).

### Material use

Created with the order from the bill of materials: planned quantity = quantity per 100 kg × planned input ÷ 100.

| Field | Meaning | Set by |
|---|---|---|
| Material, unit, unit cost, linked chemical | Copied from the bill of materials | Automatic |
| Planned quantity | See above | Automatic |
| Quantity used | What was actually used | Floor user (**Record use**) |

The screen has no form to add or remove a material line on an order. That is possible only through the API, for planners.

### Process stage

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. "Baling" | Yes | Up to 100 characters. Unique |
| Usual position | "Lower numbers come first" | Yes | Whole number |
| Status | In use or Not in use | Yes | Only stages In use are offered for new routing rows |
| Done in | None, Sorting, Decolorization or Drying: "The module whose sessions do this work, if there is one" | No | For information only |

The system starts with eight stages: Sorting, Shredding, Fiber opening, Washing, Decolorization, Drying, Blending and Packaging.

### Routing

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. "Standard recycling" | Yes | Up to 150 characters. Unique |
| Status | In use or Not in use | Yes | |
| Stages, in order | One row per stage with Hours and Rs./h | At least one | "Add at least one stage." Hours and cost cannot be negative |
| Description | Free text | No | |

The system starts with one routing, "Standard recycling": Sorting (8 hours), Decolorization (24 hours), Drying (6 hours).

### Bill of materials

| Field (label) | Meaning | Required | Rules |
|---|---|---|---|
| Name | e.g. "Cotton bleaching" | Yes | Up to 150 characters. Unique |
| Status | In use or Not in use | Yes | |
| Product | "Optional: what this recipe makes" | No | |
| Materials per 100 kg of input | One row per material: stocked chemical (optional), Material, Quantity, Unit, Rs. per unit | At least one | "Add at least one material." Quantity greater than zero. Cost not negative |
| Notes | Free text | No | |

Choosing a stocked chemical on a row fills in the material name and unit. Only rows linked to a chemical can be compared with stock on the Materials tab.

## Statuses

### Production order

| Status | Meaning | How it is reached |
|---|---|---|
| Draft | Being planned. The whole plan can change | Every new order |
| Released | Approved for the floor. Stages can be started | **Release** (duty *Plan production*) |
| In Progress | Work has started | Automatically, when the first stage is started |
| Completed | Finished. Output and cost are final | **Complete order**, once every stage is Done or Skipped and at least one is Done |
| Cancelled | Stopped. Kept on record | **Cancel order** from Draft, Released or In Progress (duty *Plan production*) |

A Completed or Cancelled order can no longer be changed.

### Order stage

| Status | How it is reached |
|---|---|
| Pending | Every new stage. A stage In Progress goes back to Pending when the order is cancelled |
| In Progress | **Start**. Only when all earlier stages are Done or Skipped |
| Done | **Complete**, with input, output and waste |
| Skipped | The skip button, from Pending or In Progress (duty *Plan production*) |

### Setup records

Process stages, routings and bills of materials are In use or Not in use.

## How to

### Plan an order (planner)

1. Click **New order**.
2. Enter the **Product** and choose the **Fabric lot** and the **Routing**.
3. Optionally choose a **Bill of materials**.
4. Enter **Planned input (kg)** and **Planned output (kg)**, and the **Planned start** and **Planned end** dates.
5. Click **Save**. The order is a Draft with its stages and planned materials.

### Release an order (planner)

1. Open the order, or use its row menu, and click **Release**.
2. Confirm. The message "Order released to the floor." appears.

After release only the dates, priority, factory unit and notes can still change.

### Run the stages (floor)

1. Open the order on the **Orders** tab.
2. Click **Start** on the next stage. The message "Step started." appears. The order becomes In Progress.
3. When the stage is finished click **Complete**. Enter **Input (kg)**, **Output (kg)** and **Waste (kg)**. Optionally enter **Hours worked**. Click **Mark complete**.
4. Repeat for each stage.
5. Under **Materials**, click **Record use** and enter the quantity used.
6. When every stage is Done or Skipped, click **Complete order** and confirm. The message "Order completed." appears.

Remember to also record the real work in Sorting, Decolorization and Drying. Completing a production stage does not create those sessions.

### Assign an operator or machine to a stage (planner)

1. Open the order and click the plan (pencil) button on the stage.
2. Choose the **Operator**, enter the **Machine**, **Planned hours** and **Cost per hour (Rs.)**.
3. Click **Update**.

### Create a routing (planner)

1. Open the **Setup** tab and click **New routing**.
2. Enter the **Name**. Add the stages in order, with hours and cost per hour.
3. Click **Save**.

Changing a routing later affects new orders only. Existing orders keep the stages they copied.

### Check material shortages

1. Open the **Materials** tab.
2. Look at the **Short by** column. Receive or restock the chemical in [Decolorization](decolorization.md).

## Business rules

### Who may do what

| Rule | Message |
|---|---|
| Creating, changing or deleting orders, stages, routings and bills of materials needs the duty *Plan production* (Admin by default) | "Your role is not allowed to plan production." |
| Release, cancel and skip need the duty *Plan production* | Same message |
| Starting and completing a stage, and completing an order, need the duty *Run production stages* or *Plan production* | "Your role is not allowed to update production steps." |
| Changing a stage's operator, machine, hours or cost needs the duty *Plan production* | "Only a production planner can change how a step is planned." |
| Users without *Plan production* may only record the quantity used on an existing material line | "Only a production planner can change the planned materials." |

### Orders

| Rule | Message |
|---|---|
| Planned input and output must be greater than zero | "Must be greater than zero." |
| Planned output cannot be more than the input | "Planned output can't be more than the input." |
| The end date cannot be before the start date | "The end date can't be before the start date." |
| A new order, or a change of routing, needs a routing that is In use | "This routing is no longer in use." |
| A Completed or Cancelled order cannot be changed | "A completed order can no longer be changed." |
| After release only the dates, priority, factory unit and notes can change | "The order is released: only its dates, priority and notes can still change." |
| Only a Draft can be released | "A released order can't be released." (the status varies) |
| An order without stages cannot be released | "The routing has no stages. Add stages to it first." |
| An order for a lot in quarantine cannot be released | "This fabric lot is in quarantine after failing inspection QC-00001 and can't be processed until an admin releases it." |
| Only Draft, Released and In Progress orders can be cancelled | "A completed order can't be cancelled." |
| Cancelling puts stages that are In Progress back to Pending | (none) |
| Only an order In Progress can be completed | "A released order can't be completed." |
| Every stage must be Done or Skipped first | "\"Drying\" is not finished yet." |
| At least one stage must be Done | "No step was carried out; cancel the order instead." |
| The order's output is the output of the last Done stage, unless another figure is sent through the API. It must be between 0 and the input of the first Done stage | "Output must be between 0 and the 500.00 kg that went in." |
| Only Draft and Cancelled orders can be deleted | "Only draft or cancelled orders can be deleted." |
| While the order is a Draft, changing the routing rebuilds its stages, and changing the bill of materials or the planned input rebuilds its materials | (none) |

### Stages

| Rule | Message |
|---|---|
| Stages can be worked on only while the order is Released or In Progress | "A draft order can't be worked on." |
| Only a Pending stage can be started | "This step is already in progress." (or "done", "skipped") |
| Stages run in order | "Finish or skip \"Sorting\" first." |
| A stage cannot be started for a lot in quarantine | The quarantine message above |
| Starting a stage records the time, sets the operator if none is planned, and moves a Released order to In Progress | (none) |
| Only a stage In Progress can be completed | "Start the step before completing it." |
| Input must be greater than zero | "Must be greater than zero." |
| Output, waste and hours must be valid numbers, zero or more | "Enter a valid number." / "Must be zero or more." |
| Output plus waste cannot be more than the input | "Output plus waste (510.00 kg) is more than the input (500.00 kg)." |
| Without hours worked, the time since the stage was started is used | (none) |
| A stage that is Done or Skipped cannot be skipped | "This step is already done." |
| A stage of a Completed or Cancelled order cannot be changed | "A completed order can no longer be changed." |

### Setup

| Rule | Message |
|---|---|
| A routing needs at least one stage | "Add at least one stage." |
| A bill of materials needs at least one material | "Add at least one material." |
| Quantities must be greater than zero | "Quantity must be greater than zero." |
| Hours and costs cannot be negative | "Hours can't be negative." / "Cost can't be negative." / "Quantity can't be negative." |
| A material line cannot be moved to another order | "A material line can't be moved to another order." |
| A routing or bill of materials used by an order cannot be deleted. A process stage used by a routing or an order cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| Saving a routing or a bill of materials replaces all its rows. Orders keep the copies they were created with | (none) |

Every change, release, cancel, completion, stage action and delete is written to the audit log.

## Related data

| Module | How it relates |
|---|---|
| [Sorting](sorting.md) | An order names a fabric lot. Lot activity lists the lot's sorting sessions |
| [Decolorization](decolorization.md) | Lot activity lists the lot's decolorization sessions. Bill of materials rows can point to a stocked chemical, and the Materials tab compares needs with the chemical's remaining stock. Recording material use does not take chemical out of stock; issuances do |
| [Drying](drying.md) | Lot activity lists the lot's drying sessions. Sellable stock comes from those sessions, not from the order |
| [Quality](quality.md) | A quarantined lot blocks release and the start of a stage |
| [Warehouse](warehouse.md) | The optional factory unit comes from the Warehouse list |
| [Search and traceability](search-and-traceability.md) | Orders can be found and traced |
| [Approvals and notifications](approvals-and-notifications.md) | Draft orders appear in the approvals inbox with a Release action. Late orders raise an alert |

## For developers

**For developers.** Administrators can skip this section.

### Models

`backend/apps/production/models.py`

| Model | Notes |
|---|---|
| `ProcessStage` | `name` (unique), `sequence`, `module` (`''`, `sorting`, `decolorization`, `drying`), `is_active`. Defaults are created by migration `0002` |
| `Routing`, `RoutingStep` | A routing has ordered steps: `stage` (`PROTECT`), `sequence`, `planned_hours`, `hourly_cost` |
| `BillOfMaterials`, `BomLine` | A line has `material`, optional `chemical` (`decolorization.ChemicalStock`, `PROTECT`), `quantity_per_100kg`, `unit`, `unit_cost` |
| `ProductionOrder` | A `NumberedModel` with prefix `MO`. `fabric`, `routing`, `bom`, `unit` (all `PROTECT`), the plan fields, `status`, `actual_output_kg`, and the who-and-when fields. `OPEN_STATUSES` = Draft, Released, In Progress |
| `OrderStep` | `order` (`CASCADE`), `stage`, `sequence`, `status`, `operator`, `machine`, planned and actual hours, `hourly_cost`, `input_kg`, `output_kg`, `waste_kg`, `notes` |
| `MaterialUse` | `order` (`CASCADE`), `material`, optional `chemical`, `unit`, `planned_quantity`, `actual_quantity`, `unit_cost` |

### Services

`backend/apps/production/services.py`

| Function | Purpose |
|---|---|
| `build_steps(order)`, `build_materials(order)` | Copy the routing's stages and the bill of materials onto the order |
| `release`, `cancel`, `complete` | Order life cycle |
| `start_step`, `complete_step`, `skip_step` | Stage life cycle |
| `check_floor_user(user)` | Requires the duty `run_production` or `plan_production` |
| `figures(order)` | The calculated figures, added to every order by `ProductionOrderSerializer.to_representation` |

The constant `FLOOR_ROLES` in `services.py` is not used for permission checks; the duties are.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET, POST | `/api/v1/production/orders/` | List or create orders. Filters: `status` (comma-separated), `fabric`, and the shared period parameters on the planned start |
| GET, PUT, PATCH, DELETE | `/api/v1/production/orders/<id>/` | One order, with `steps`, `materials` and the figures |
| POST | `/api/v1/production/orders/<id>/release/` | Release |
| POST | `/api/v1/production/orders/<id>/cancel/` | Cancel |
| POST | `/api/v1/production/orders/<id>/complete/` | Complete. Optional body: `actual_output_kg` |
| GET | `/api/v1/production/orders/<id>/activity/` | Sessions of the order's lot |
| GET | `/api/v1/production/steps/` | List stages. Filters: `order`, `status` |
| GET, PUT, PATCH | `/api/v1/production/steps/<id>/` | One stage. Changes are the planning fields only |
| POST | `/api/v1/production/steps/<id>/start/` | Start |
| POST | `/api/v1/production/steps/<id>/complete/` | Complete. Body: `input_kg`, `output_kg`, `waste_kg`, optional `actual_hours` |
| POST | `/api/v1/production/steps/<id>/skip/` | Skip |
| GET, POST | `/api/v1/production/materials/` | List or add material lines. Filter: `order` |
| GET, PUT, PATCH, DELETE | `/api/v1/production/materials/<id>/` | One material line |
| GET, POST | `/api/v1/production/stages/` and `/<id>/` | Process stages |
| GET, POST | `/api/v1/production/routings/` and `/<id>/` | Routings, with `steps` |
| GET, POST | `/api/v1/production/boms/` and `/<id>/` | Bills of materials, with `lines` |
| GET | `/api/v1/production/summary/` | Dashboard figures |
| GET | `/api/v1/production/requirements/` | Material requirements of open orders against chemical stock |

Computed amounts are returned as strings with two decimals.

### Permissions

- Orders, stages (setup), routings and bills of materials use `IsPlannerForWrites`: anyone signed in reads, writes need the duty `plan_production`.
- `release`, `cancel` and `skip` use `IsAdminAction`, which checks `plan_production`.
- Stage `start` and `complete`, order `complete`, and material lines use `IsAnyRole` and then check the duty inside the action or serializer.
- The API gate requires the Production page (any level to read, Full to change). The page may also read the sorting, decolorization and warehouse APIs for its dropdowns.

### Frontend

| File | Contents |
|---|---|
| `frontend/src/app/(app)/production/page.tsx` | The route |
| `frontend/src/features/production/production-page.tsx` | Tabs, the order view (`OrderDetail`), the schedule (`Schedule`), tables |
| `frontend/src/features/production/production-forms.tsx` | Order, stage completion, stage planning, material use, routing, bill of materials and process stage forms; `PRODUCTION_LISTS` |
| `frontend/src/features/production/schemas.ts` | Form rules, `ORDER_STATUSES`, `PRIORITIES`, `STAGE_MODULES` |
| `frontend/src/types/api.ts` | `ProductionOrder`, `OrderStep`, `MaterialUse`, `Routing`, `Bom`, `ProcessStage`, `ProductionSummary`, `MaterialRequirement`, `LotActivity` |

### Tests

- Backend: `backend/apps/production/tests.py` covers the default stages and routing, who maintains planning data, building an order from its routing and bill of materials, plan checks, release rules, quarantine, stages running in order with actuals, requirements, the summary and lot activity.
- Browser: `frontend/e2e/production.mjs` covers a bill of materials, a refused plan, an order built from the routing, release, what a supervisor sees, starting only the next stage, a refused completion, the suggested input, completing the order with output, yield, cost and waste, the Materials tab, and a warehouse supervisor being sent home.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| No **New order** button | Your role lacks the duty *Plan production* | Ask an admin to plan the order or to give your role the duty |
| No **Start** button on a stage | The order is still a Draft, an earlier stage is not finished, or your role lacks the duty *Run production stages* | Release the order; finish or skip the earlier stage |
| "Finish or skip … first." | Stages run in order | Complete the earlier stage, or have a planner skip it |
| Fields are greyed out when editing an order | The order is released | Only dates, priority, unit and notes can change. Cancel it and plan a new order to change the rest |
| No **Complete order** button | A stage is still Pending or In Progress | Complete or skip every stage |
| "No step was carried out; cancel the order instead." | Every stage was skipped | Cancel the order |
| Sellable stock did not change after completing the order | Production orders move no stock | Complete the drying session in [Drying](drying.md) |
| Chemical stock did not change after **Record use** | Recording use is for the order's cost only | Issue the chemical in [Decolorization](decolorization.md) |
| A material shows a dash under In stock | Its bill of materials row is not linked to a stocked chemical | Edit the bill of materials and choose the chemical. It applies to new orders |
| A routing change did not reach an order | Orders copy their stages when created | For a Draft, choose another routing and then the right one again to rebuild its stages; otherwise plan a new order |

## Keeping this page up to date

- `backend/apps/production/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, life cycle, figures, messages and endpoints.
- `backend/apps/production/migrations/0002_*.py`: the default stages and routing.
- `frontend/src/features/production/`: tabs, buttons, labels and form rules.
- `backend/apps/access/services.py` (`DUTIES`, `DEFAULT_ROLE_DUTIES`): the duties *Plan production* and *Run production stages*.
- `backend/apps/quality/services.py`: the quarantine check used on release and stage start.
