# Database

This page describes every table the system keeps: what each record is, its main fields, how records point to each other, and what happens when one is deleted. The first three sections are for administrators. The tables per app are mainly for developers.

## On this page

- [How to read this page](#how-to-read-this-page)
- [Why a delete is sometimes refused](#why-a-delete-is-sometimes-refused)
- [Generated numbers](#generated-numbers)
- [Tables filled with starting rows](#tables-filled-with-starting-rows)
- [Users and access](#users-and-access)
- [Warehouse](#warehouse)
- [Sorting](#sorting)
- [Decolorization](#decolorization)
- [Drying](#drying)
- [Inventory](#inventory)
- [Sales](#sales)
- [Purchasing](#purchasing)
- [Quality](#quality)
- [Production](#production)
- [Finance](#finance)
- [Maintenance](#maintenance)
- [Sustainability](#sustainability)
- [Workforce](#workforce)
- [Documents](#documents)
- [Notification rules](#notification-rules)
- [Audit log](#audit-log)
- [Apps without tables](#apps-without-tables)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## How to read this page

Each record type is a "model" in the code and one table in PostgreSQL. Models live in `backend/apps/<app>/models.py`.

A link from one record to another is a foreign key. For every link this page says what happens to the record when the record it points to is deleted:

| Word used here | Meaning | In the code |
|---|---|---|
| **Protect** | The linked record cannot be deleted while this record exists. | `on_delete=models.PROTECT` |
| **Cascade** | This record is deleted together with the linked record. | `on_delete=models.CASCADE` |
| **Set empty** | The link is cleared; this record stays. | `on_delete=models.SET_NULL` |

In the diagrams, `A --< B` means "one A has many B". `A --- B` means one to one.

Weights are stored in kg and money in rupees, both with two decimal places.

## Why a delete is sometimes refused

**For administrators.** Most links are **Protect** links. They stop a record from being deleted while other records still depend on it. For example, a supplier cannot be deleted while a delivery from that supplier exists, and a fabric lot cannot be deleted while it has sessions or orders.

When this happens the system shows this message and changes nothing:

> This record cannot be deleted because other records depend on it: *(the kinds of record)*.

What to do:

1. Read which kinds of record are named.
2. Decide whether the record should really go. Usually it should not: history depends on it.
3. If the record can be marked as no longer active (suppliers, customers, products, recipes, accounts, categories and others have an `is_active` setting), do that instead. History stays intact. The module guides in [07-modules](07-modules/README.md) say how each screen shows this setting.
4. Only if the dependent records are themselves mistakes, delete those first, then the record.

Deleting is permanent. No record type in this system is "soft deleted" and there is no recycle bin. The audit log keeps an entry saying who deleted what and when (see [Audit and logging](14-audit-and-logging.md)).

**For developers.** The 409 answer is built in `backend/apps/core/exceptions.py`. `AuditedModelMixin.perform_destroy` writes the audit entry and deletes inside one transaction, so a blocked delete leaves no audit entry. `SoftDeleteMixin` exists in `backend/apps/audit/models.py`, but no model uses it.

## Generated numbers

Some records get a readable number the first time they are saved. The number is the prefix, a dash, and the record's database id padded to five digits, for example `PO-00042`. It cannot be edited. This comes from `NumberedModel` in `backend/apps/procurement/models.py`.

| Prefix | Record | App |
|---|---|---|
| `PR-` | Purchase request | procurement |
| `PO-` | Purchase order | procurement |
| `RET-` | Purchase return | procurement |
| `QC-` | Inspection | quality |
| `MO-` | Production order | production |
| `QT-` | Sales quotation | sales |
| `INV-` | Sales invoice | sales |
| `SR-` | Sales return | sales |
| `JV-` | Journal entry | finance |
| `EXP-` | Expense | finance |
| `WO-` | Work order | maintenance |
| `EMP-` | Employee | workforce |
| `DOC-` | Document | documents |

Records without a generated number are shown by their id (for example "Order #12") or by a number the user types (a supplier's invoice number, a chemical lot number, a tank's batch id, a machine code, an account code).

Because the number is built from the id, numbers are not guaranteed to be gap-free: a deleted record leaves a gap.

## Tables filled with starting rows

Some tables are filled by a data migration when the database is first created. These rows are real settings, not demo data. They exist on every installation.

| App and migration | Rows added |
|---|---|
| `access` `0002_default_access`, `0003_access_levels` | The pages each built-in supervisor role starts with. Added only when the table is empty. |
| `access` `0004_roles_and_duties` | The five built-in roles (marked as system roles) and their starting duties. |
| `alerts` `0002_default_rules` | The 17 notification rules, with their starting thresholds and roles. |
| `documents` `0002_default_categories` | Nine document categories and the roles that may see each. |
| `finance` `0002_default_accounts` | A starting chart of 22 accounts. Nine of them carry a system key and are used by the automatic postings. |
| `production` `0002_default_stages` | Eight process stages, and the routing "Standard recycling" (Sorting 8 hours, Decolorization 24 hours, Drying 6 hours). |
| `sustainability` `0002_default_waste_categories` | Six waste categories. |

Two more migrations fill tables from records that already existed when the feature was added. On a new, empty database they add nothing:

| App and migration | What it did |
|---|---|
| `sales` `0004_backfill_customers` | Created customers from the buyer names on existing orders. |
| `inventory` `0002_backfill_movements` | Built the stock ledger from existing completed drying sessions and dispatches. |

The meaning of the access rows is explained in [Access control](05-access-control.md).

---

**For developers.** The rest of this page lists the models app by app.

## Users and access

Files: `backend/apps/users/models.py`, `backend/apps/access/models.py`.

```
Role (key) . . . . CustomUser.role          (matched by key, not a database link)
Role (key) . . . . RolePage.role, RoleDuty.role
CustomUser --< UserPageOverride
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `CustomUser` | A person who can sign in. Extends Django's user. | `username`, `email`, `password` (hashed), `is_active`, `last_login`, `role` (the key of a role) | None of its own. Most records that point to a user **protect** it, so a user with history cannot be deleted; deactivate instead. | `username` |
| `Role` | A job in the organisation. | `key`, `name`, `description`, `is_system` | None | `key`, `name` |
| `RolePage` | A role holds a page at a level. | `role` (key), `page` (key), `level` (`view` or `full`) | None (plain keys) | `role` + `page` |
| `RoleDuty` | A role carries a duty. | `role` (key), `duty` (key) | None (plain keys) | `role` + `duty` |
| `UserPageOverride` | One person's exception for one page. | `page`, `level` (`none`, `view`, `full`) | `user`: **Cascade** | `user` + `page` |

Admins have no rows in `RolePage` and `RoleDuty`: the code gives them everything. Page keys and duty keys are defined in code, in `backend/apps/access/services.py`. See [Access control](05-access-control.md).

The sign-in token tables (`token_blacklist_outstandingtoken`, `token_blacklist_blacklistedtoken`) come from the `rest_framework_simplejwt.token_blacklist` app. They hold issued and revoked refresh tokens.

## Warehouse

File: `backend/apps/warehouse/models.py`.

```
Vendor --< Stock >-- FactoryUnit
                Stock >-- PurchaseOrderLine   (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Vendor` | A supplier. Also used by Purchasing and by chemicals. | `name`, `contact`, `address`, `email`, `category`, `specialties`, `payment_terms_days`, `is_active` | None | None |
| `FactoryUnit` | A unit of the factory. | `name` | None | None |
| `Stock` | One delivery of fabric. | `fabric_type`, `vendor_weight_slip`, `vehicle_no`, `our_weight`, `unloading_weight`, `status` (`Received`, `Pending`, `Approved`, `Rejected`) | `vendor`: **Protect**. `unit`: **Protect**. `po_line` (optional): **Protect**. | None |

## Sorting

File: `backend/apps/sorting/models.py`.

```
Stock --< FabricStock --< SortingSession >-- CustomUser
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `FabricStock` | A fabric lot. The record the rest of the process follows. | `material_type`, `initial_quantity`, `sorted_quantity`, `remaining_quantity`, `status` (`In Warehouse`, `In Sorting`, `Sorted`, `Sent to Decolorization`) | `stock` (the delivery): **Protect** | None |
| `SortingSession` | One sorting job on a lot. | `unit` (text), `quantity_taken`, `quantity_sorted`, `waste_quantity`, `start_date`, `end_date`, `status` (`In Progress`, `Completed`, `On Hold`), `notes` | `fabric`: **Protect**. `supervisor`: **Protect**. | None |

`SortingSession.unit` is the unit's name as text, not a link to `FactoryUnit`.

## Decolorization

File: `backend/apps/decolorization/models.py`.

```
ChemicalStock --< ChemicalLot
ChemicalStock --< ChemicalIssuance >-- Tank
ChemicalStock --< RecipeLine >-- RecipeVersion >-- Recipe
Tank --< DecolorizationSession >-- FabricStock
DecolorizationSession --< ChemicalIssuance      (optional)
RecipeVersion --< DecolorizationSession         (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `ChemicalStock` | One chemical and how much is left. | `chemical_name`, `total_stock`, `issued_quantity`, `remaining_stock`, `unit_of_measure`, `unit_cost`, `hazard_class`, `handling_notes`, `sds_reference`, `is_restricted` | `supplier` (optional): **Protect** | None |
| `ChemicalLot` | A received batch of a chemical. | `lot_number`, `received_on`, `quantity`, `unit_cost`, `expiry_date`, `notes` | `chemical`: **Protect**. `supplier` (optional): **Protect**. `received_by`: **Protect**. | `chemical` + `lot_number` |
| `Recipe` | A named formulation. | `name`, `material_type`, `is_active` | None | `name` |
| `RecipeVersion` | One revision of a recipe. Never edited. | `version`, `temperature_c`, `duration_minutes`, `water_liters_per_100kg`, `notes` | `recipe`: **Cascade**. `created_by`: **Protect**. | `recipe` + `version` |
| `RecipeLine` | One chemical in a recipe version. | `quantity_per_100kg` | `version`: **Cascade**. `chemical`: **Protect**. | None |
| `Tank` | A decolorization tank. | `name`, `capacity`, `batch_id`, `tank_status` (`Empty`, `Filled`, `Processing`, `Completed`, `Cleaning`), `fabric_quantity`, `start_date`, `expected_completion`, `actual_completion` | `fabric` (optional): **Set empty**. `supervisor` (optional): **Set empty**. | `batch_id` |
| `ChemicalIssuance` | Chemical taken from stock for a tank. | `quantity`, `issued_at`, `notes`, `unit_cost` (copied when issued) | `chemical`: **Protect**. `tank`: **Protect**. `issued_by`: **Protect**. `session` (optional): **Set empty**. | None |
| `DecolorizationSession` | One batch in a tank. | `input_quantity`, `output_quantity`, `waste_quantity`, `status` (`In Progress`, `Completed`, `Failed`, `On Hold`), `start_date`, `end_date`, `temperature_c`, `duration_minutes`, `water_liters`, `approved_at` | `tank`: **Protect**. `fabric`: **Protect**. `supervisor`: **Protect**. `recipe_version` (optional): **Protect**. `approved_by` (optional): **Protect**. | None |

Deleting a recipe deletes its versions and lines, unless a session used one of the versions; then the delete is refused.

## Drying

File: `backend/apps/drying/models.py`.

```
Dryer --< DryingSession >-- FabricStock
DecolorizationSession --< DryingSession   (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Dryer` | A drying machine. | `name`, `capacity`, `dryer_type` (`Tumble`, `Conveyor`, `Chamber`), `status` (`Available`, `Running`, `Cooling`, `Maintenance`), `notes` | None | None |
| `DryingSession` | One drying batch. Its output becomes sellable stock. | `input_quantity`, `output_quantity`, `waste_quantity`, `temperature_celsius`, `duration_minutes`, `status` (`Pending`, `In Progress`, `Completed`, `Failed`, `On Hold`), `start_date`, `end_date` | `dryer`: **Protect**. `fabric`: **Protect**. `supervisor`: **Protect**. `decolor_session` (optional): **Set empty**. | None |

## Inventory

File: `backend/apps/inventory/models.py`.

```
FabricStock --< StockMovement
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `StockMovement` | One change to the sellable stock of a lot. Stock on hand is the sum of these rows. | `movement_type` (`DRYING_OUTPUT`, `DISPATCH`, `ADJUSTMENT`, `SALES_RETURN`), `quantity` (signed: plus adds, minus removes), `source_type` and `source_id` (the record that caused it), `note`, `created_at` | `fabric`: **Protect**. `created_by` (optional): **Set empty**. | None. Indexed on `fabric` + `created_at` and on `source_type` + `source_id`. |

`source_type` and `source_id` are plain values, not database links. Rows are written by `backend/apps/inventory/services.py` and are never edited through the API. See [Architecture](02-architecture.md).

## Sales

File: `backend/apps/sales/models.py`.

```
Customer --< SalesOrder >-- FabricStock
Customer --< SalesQuotation --- SalesOrder      (one quotation, one order)
Product  --< ProductPrice
Product  --< SalesOrder, SalesQuotation         (optional)
SalesOrder --< DispatchTracking
SalesOrder --< Payment
SalesOrder --< SalesInvoice
SalesOrder --< SalesReturn
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Customer` | A buyer. | `name`, `normalized_name` (the name in lower case with single spaces, set on save), `contact`, `address`, `notes`, `email`, `category`, `credit_limit` (0 means no limit), `payment_terms_days`, `is_active` | None | `normalized_name` |
| `Product` | A sellable product. | `name`, `material_type`, `grade`, `specification`, `price_per_kg`, `is_active` | None | `name` |
| `ProductPrice` | A product's price for one customer category. | `customer_category`, `price_per_kg` | `product`: **Cascade** | `product` + `customer_category` |
| `SalesOrder` | A sale from one fabric lot. | `buyer_name` (as typed), `buyer_contact`, `buyer_address`, `fabric_quality`, `weight_sold`, `price_per_kg`, `discount_pct`, `tax_pct`, `total_price` (calculated on save), `status` (`Draft`, `Confirmed`, `Dispatched`, `Completed`, `Cancelled`), `payment_status` (`Pending`, `Partial`, `Paid`) | `customer` (optional): **Protect**. `fabric`: **Protect**. `product` (optional): **Protect**. `created_by`: **Protect**. | None |
| `DispatchTracking` | Goods sent for an order. | `vehicle_number`, `driver_name`, `driver_contact`, `dispatched_weight`, `dispatch_status` (`Pending`, `Loading`, `Dispatched`, `Delivered`), `dispatch_date`, `delivery_date` | `sales_order`: **Protect**. `dispatched_by`: **Protect**. | None |
| `Payment` | Money received for an order. | `amount`, `payment_method` (`Cash`, `Bank Transfer`, `Cheque`, `Online Transfer`), `payment_date`, `reference_number`, `notes` | `sales_order`: **Protect**. `received_by`: **Protect**. | None |
| `SalesQuotation` | An offer to a customer. Number `QT-`. | `fabric_quality`, `weight`, `price_per_kg`, `discount_pct`, `tax_pct`, `total` (calculated on save), `valid_until`, `status` (`Draft`, `Sent`, `Accepted`, `Rejected`, `Converted`), `rejection_reason`, `decided_at` | `customer`: **Protect**. `product` (optional): **Protect**. `fabric` (optional): **Protect**. `order` (optional, one to one): **Set empty**. `created_by`: **Protect**. | One quotation per order |
| `SalesInvoice` | The bill for dispatched goods. Number `INV-`. Amounts are fixed when it is raised. | `invoice_date`, `due_date`, `weight`, `price_per_kg`, `subtotal`, `discount_amount`, `tax_amount`, `total`, `notes` | `order`: **Protect**. `created_by`: **Protect**. | None |
| `SalesReturn` | Goods a customer sends back. Number `SR-`. | `return_date`, `weight`, `reason`, `restock`, `status` (`Requested`, `Approved`, `Rejected`), `credit_amount`, `rejection_reason`, `decided_at` | `order`: **Protect**. `decided_by` (optional): **Protect**. `created_by`: **Protect**. | None |

Notes:

- Saving a `SalesOrder` with a buyer name and no customer finds the customer with the same normalized name, or creates one.
- `total_price` is weight times price when discount and tax are both zero. Otherwise it is the discounted amount plus tax, rounded to two decimals (`order_total`).
- Payments belong to an order, not to an invoice. An invoice's paid state is worked out from the order's payments.

## Purchasing

File: `backend/apps/procurement/models.py`.

```
PurchaseRequisition --< RequisitionLine
PurchaseRequisition --< PurchaseOrder >-- Vendor
PurchaseOrder --< PurchaseOrderLine --< Stock (deliveries) --< PurchaseReturn
Vendor --< SupplierQuotation
Vendor --< SupplierInvoice --< SupplierPayment
PurchaseOrder --< SupplierInvoice               (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `PurchaseRequisition` | A request to buy. Number `PR-`. | `needed_by`, `status` (`Draft`, `Submitted`, `Approved`, `Rejected`, `Ordered`, `Cancelled`), `notes`, `decided_at`, `rejection_reason` | `requested_by`: **Protect**. `unit` (optional): **Protect**. `decided_by` (optional): **Protect**. | None |
| `RequisitionLine` | One material on a request. | `material`, `quantity_kg`, `notes` | `requisition`: **Cascade** | None |
| `PurchaseOrder` | An order to a supplier. Number `PO-`. | `order_date`, `expected_date`, `status` (`Draft`, `Submitted`, `Approved`, `Partially Received`, `Received`, `Closed`, `Cancelled`), `revision`, `notes`, `approved_at` | `vendor`: **Protect**. `requisition` (optional): **Protect**. `created_by`: **Protect**. `approved_by` (optional): **Protect**. | None |
| `PurchaseOrderLine` | One material on an order. | `material`, `quantity_kg`, `unit_price` (Rs. per kg) | `order`: **Cascade** | None |
| `PurchaseReturn` | Material sent back from a delivery. Number `RET-`. A record only. | `quantity_kg`, `reason`, `return_date` | `receipt` (the delivery): **Protect**. `created_by`: **Protect**. | None |
| `SupplierQuotation` | A price a supplier offered. | `material`, `price_per_kg`, `min_quantity_kg`, `quoted_on`, `valid_until`, `notes` | `vendor`: **Protect**. `requisition` (optional): **Set empty**. | None |
| `SupplierInvoice` | A supplier's bill. | `invoice_number` (the supplier's), `invoice_date`, `due_date`, `amount` (before tax), `tax_amount`, `status` (`Unpaid`, `Partial`, `Paid`; set from payments), `notes` | `vendor`: **Protect**. `purchase_order` (optional): **Protect**. | `vendor` + `invoice_number` |
| `SupplierPayment` | Money paid against a supplier invoice. | `amount`, `method` (`Cash`, `Bank Transfer`, `Cheque`, `Online Transfer`), `payment_date`, `reference` | `invoice`: **Protect**. `paid_by`: **Protect**. | None |

A delivery is linked to an order line through `Stock.po_line`. Deleting an order deletes its lines, but an order line with deliveries is protected, so the order cannot be deleted either.

## Quality

File: `backend/apps/quality/models.py`.

```
QualityStandard --< StandardCheck
QualityStandard --< Inspection --< InspectionResult
                    Inspection --< CorrectiveAction
Stock --< Inspection        (incoming inspections)
FabricStock --< Inspection  (in-process and finished inspections)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `QualityStandard` | A reusable checklist with limits. | `name`, `stage` (`Incoming`, `In-process`, `Finished`), `material_type`, `is_active`, `notes` | None | `name` |
| `StandardCheck` | One line of a checklist. | `name`, `kind` (`Measure` or `Pass/Fail`), `unit`, `min_value`, `max_value` | `standard`: **Cascade** | None |
| `Inspection` | One inspection. Number `QC-`. | `stage`, `inspected_on`, `sample_kg`, `composition`, `result` (`Pass`, `Conditional`, `Fail`), `rejection_reason`, `notes`, `released_at`, `release_note` | `stock` (optional): **Protect**. `fabric` (optional): **Protect**. `standard` (optional): **Protect**. `inspector`: **Protect**. `released_by` (optional): **Protect**. | None. Indexed on `result` + `released_at`. |
| `InspectionResult` | One checklist line as measured. The limits are copied in. | `name`, `kind`, `unit`, `min_value`, `max_value`, `value`, `passed`, `note` | `inspection`: **Cascade** | None |
| `CorrectiveAction` | A corrective or preventive action. | `kind` (`Corrective`, `Preventive`), `description`, `due_date`, `status` (`Open`, `Done`), `completed_at`, `completion_note` | `inspection`: **Cascade**. `owner` (optional): **Protect**. `created_by`: **Protect**. | None |

An inspection is "in quarantine" when its result is `Fail` and `released_at` is empty. This is calculated, not stored.

## Production

File: `backend/apps/production/models.py`.

```
ProcessStage --< RoutingStep >-- Routing
BillOfMaterials --< BomLine >-- ChemicalStock   (optional)
Routing --< ProductionOrder >-- FabricStock
BillOfMaterials --< ProductionOrder             (optional)
ProductionOrder --< OrderStep >-- ProcessStage
ProductionOrder --< MaterialUse >-- ChemicalStock (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `ProcessStage` | A kind of processing step. | `name`, `sequence`, `module` (empty, `sorting`, `decolorization` or `drying`), `is_active` | None | `name` |
| `Routing` | An ordered list of stages. | `name`, `description`, `is_active` | None | `name` |
| `RoutingStep` | One stage in a routing. | `sequence`, `planned_hours`, `hourly_cost` | `routing`: **Cascade**. `stage`: **Protect**. | None |
| `BillOfMaterials` | What 100 kg of input needs. | `name`, `product_name`, `is_active`, `notes` | None | `name` |
| `BomLine` | One material in a bill. | `material`, `quantity_per_100kg`, `unit`, `unit_cost` | `bom`: **Cascade**. `chemical` (optional): **Protect**. | None |
| `ProductionOrder` | A plan to process one lot. Number `MO-`. | `product_name`, `planned_input_kg`, `planned_output_kg`, `planned_start`, `planned_end`, `priority` (`Low`, `Normal`, `High`), `status` (`Draft`, `Released`, `In Progress`, `Completed`, `Cancelled`), `actual_output_kg`, `released_at`, `started_at`, `completed_at` | `fabric`: **Protect**. `unit` (optional): **Protect**. `routing`: **Protect**. `bom` (optional): **Protect**. `created_by`: **Protect**. `released_by` (optional): **Protect**. | None |
| `OrderStep` | One stage of one order. | `sequence`, `status` (`Pending`, `In Progress`, `Done`, `Skipped`), `machine` (text), `planned_hours`, `hourly_cost`, `started_at`, `finished_at`, `actual_hours`, `input_kg`, `output_kg`, `waste_kg` | `order`: **Cascade**. `stage`: **Protect**. `operator` (optional): **Protect**. | None |
| `MaterialUse` | Planned and actual use of one material. A record only. | `material`, `unit`, `planned_quantity`, `actual_quantity`, `unit_cost` | `order`: **Cascade**. `chemical` (optional): **Protect**. | None |

Production orders move no stock. Stock moves through sessions, issuances and the ledger.

## Finance

File: `backend/apps/finance/models.py`.

```
Account --< JournalLine >-- JournalEntry
JournalEntry --- JournalEntry        (a reversal points to the entry it reverses)
Account --< Expense                  (twice: the expense account and the account paid from)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Account` | One account in the chart of accounts. | `code`, `name`, `type` (`Asset`, `Liability`, `Equity`, `Income`, `Expense`), `is_cash`, `system_key`, `description`, `is_active` | None | `code`; `system_key` |
| `FinancialPeriod` | A bookkeeping period that can be closed. | `name`, `start_date`, `end_date`, `is_closed`, `closed_at` | `closed_by` (optional): **Protect** | `name` |
| `TaxRate` | A named tax percentage. | `name`, `rate`, `is_active` | None | `name` |
| `JournalEntry` | One balanced entry. Number `JV-`. | `date`, `memo`, `source` (`Manual`, `Expense`, `Sales invoice`, `Customer payment`, `Sales return`, `Supplier invoice`, `Supplier payment`), `source_id`, `reference` | `reverses` (optional, one to one): **Protect**. `created_by` (optional): **Protect**. | One reversal per entry. Indexed on `source` + `source_id`. |
| `JournalLine` | One debit or credit. | `debit`, `credit`, `description` | `entry`: **Cascade**. `account`: **Protect**. | None |
| `Expense` | Money spent that is not a supplier invoice. Number `EXP-`. | `date`, `amount`, `payee`, `description`, `cost_centre` (`General`, `Warehouse`, `Sorting`, `Decolorization`, `Drying`, `Maintenance`, `Sales`), `reference` | `account`: **Protect**. `paid_from`: **Protect**. `created_by`: **Protect**. | None |

`source` and `source_id` on a journal entry are plain values, not database links. The system keys used by the automatic postings are `cash`, `bank`, `receivable`, `purchase_tax`, `payable`, `sales_tax`, `sales`, `sales_returns` and `purchases`.

## Maintenance

File: `backend/apps/maintenance/models.py`.

```
Machine --< MaintenanceSchedule --< WorkOrder   (optional link)
Machine --< WorkOrder --< PartUse >-- SparePart
Machine >-- Tank, Dryer                         (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Machine` | A machine in the register. | `code`, `name`, `category`, `location`, `manufacturer`, `model`, `serial_number`, `specifications`, `installed_on`, `status` (`Running`, `Idle`, `Under maintenance`, `Broken down`, `Retired`), `hourly_operating_cost` | `tank` (optional): **Set empty**. `dryer` (optional): **Set empty**. | `code` |
| `MaintenanceSchedule` | A preventive task repeated every N days. | `task`, `every_days`, `start_date`, `last_done_on`, `next_due_on` (calculated on save), `instructions`, `is_active` | `machine`: **Cascade** | None |
| `WorkOrder` | A maintenance job. Number `WO-`. | `kind` (`Preventive`, `Corrective`), `title`, `description`, `priority` (`Low`, `Normal`, `High`, `Urgent`), `status` (`Open`, `In progress`, `Done`, `Cancelled`), `is_breakdown`, `reported_at`, `started_at`, `completed_at`, `downtime_minutes`, `labour_hours`, `labour_cost`, `other_cost`, `work_done` | `machine`: **Protect**. `schedule` (optional): **Set empty**. `reported_by`: **Protect**. `assigned_to` (optional): **Protect**. | None. Indexed on `status` + `reported_at`. |
| `SparePart` | A spare part and its stock. | `code`, `name`, `unit`, `stock_quantity`, `reorder_level`, `unit_cost`, `location` | None | `code` |
| `PartUse` | Parts taken for a work order. | `quantity`, `unit_cost` (as on that day) | `work_order`: **Protect**. `part`: **Protect**. `used_by`: **Protect**. | None |

`next_due_on` is `last_done_on` plus `every_days`, or `start_date` until the task has been done once.

## Sustainability

File: `backend/apps/sustainability/models.py`.

```
WasteCategory --< WasteRecord >-- FabricStock   (optional)
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `WasteCategory` | A kind of waste. | `name`, `classification` (`Recyclable`, `Reusable`, `Hazardous`, `General`), `description`, `is_active` | None | `name` |
| `WasteRecord` | Waste that was weighed and disposed of. | `date`, `stage` (`Warehouse`, `Sorting`, `Decolorization`, `Drying`, `Other`), `quantity_kg`, `disposal_method`, `disposed_to`, `disposal_cost`, `revenue`, `disposal_reference`, `notes` | `category`: **Protect**. `fabric` (optional): **Set empty**. `recorded_by`: **Protect**. | None |
| `UtilityReading` | Water, power or fuel used. | `date`, `utility` (`Water`, `Electricity`, `Gas`, `Steam`, `Diesel`), `quantity`, `unit` (set from the utility: m3, kWh, m3, kg, litres), `cost`, `stage`, `meter_reference`, `notes` | `recorded_by`: **Protect** | None |
| `SustainabilityTarget` | A goal for one calculated figure. | `metric` (`recovery_rate`, `landfill_share`, `water_per_kg`, `energy_per_kg`, `chemical_per_kg`), `target_value`, `direction` (`At least`, `At most`), `period`, `is_active` | None | None |

## Workforce

File: `backend/apps/workforce/models.py`.

```
Department --< JobRole
Department --< Employee >-- JobRole
Shift --< Employee
Employee --- CustomUser            (optional login)
Employee --< Attendance
Employee --< LeaveRequest
Employee --< TaskAssignment
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `Department` | A department. | `name`, `description`, `is_active` | None | `name` |
| `JobRole` | A job title. Not the same as an access role. | `title`, `description` | `department` (optional): **Protect** | `title` |
| `Shift` | A working shift. | `name`, `start_time`, `end_time`, `is_active` | None | `name` |
| `Employee` | A person who works at the factory. Number `EMP-`. | `full_name`, `phone`, `cnic`, `address`, `emergency_contact`, `joined_on`, `employment_type` (`Permanent`, `Contract`, `Daily wage`), `status` (`Active`, `On leave`, `Left`), `left_on`, `notes` | `department`: **Protect**. `job_role`: **Protect**. `shift` (optional): **Set empty**. `user` (optional, one to one): **Set empty**. | One employee per login |
| `Attendance` | One record per employee per day. | `date`, `status` (`Present`, `Absent`, `Late`, `Half day`, `Leave`), `check_in`, `check_out`, `hours_worked`, `overtime_hours`, `notes` | `employee`: **Protect**. `shift` (optional): **Set empty**. `recorded_by` (optional): **Set empty**. | `employee` + `date` |
| `LeaveRequest` | A request for leave. | `leave_type` (`Annual`, `Sick`, `Casual`, `Unpaid`), `start_date`, `end_date`, `days` (calculated, both ends count), `reason`, `status` (`Pending`, `Approved`, `Rejected`), `decided_at`, `decision_note` | `employee`: **Protect**. `decided_by` (optional): **Protect**. | None |
| `TaskAssignment` | A task given to an employee. | `title`, `description`, `date`, `area`, `reference`, `status` (`Assigned`, `In progress`, `Done`), `hours_spent`, `output_kg` | `employee`: **Protect**. `assigned_by` (optional): **Set empty**. | None |

## Documents

File: `backend/apps/documents/models.py`.

```
DocumentCategory --< Document --< DocumentVersion
```

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `DocumentCategory` | A category, with the roles that may see its documents. | `name`, `description`, `allowed_roles` (a list of role keys), `is_active` | None | `name` |
| `Document` | A document. Number `DOC-`. | `title`, `description`, `reference_number`, `issued_on`, `expires_on`, `linked_type`, `linked_id`, `linked_label`, `current_version` | `category`: **Protect**. `created_by`: **Protect**. | None. Indexed on `linked_type` + `linked_id` and on `expires_on`. |
| `DocumentVersion` | One uploaded file. | `version`, `file` (stored under `documents/` with a generated name), `original_name`, `extension`, `size_bytes`, `content_type`, `sha256`, `note`, `uploaded_at` | `document`: **Cascade**. `uploaded_by`: **Protect**. | `document` + `version` |

The link to a record in another module (`linked_type`, `linked_id`, `linked_label`) is stored as plain values, so deleting that record does not affect the document. When a version is deleted, its file is removed from disk after the transaction commits.

## Notification rules

File: `backend/apps/alerts/models.py`.

| Model | Purpose | Key fields | Links | Uniqueness |
|---|---|---|---|---|
| `NotificationRule` | The settings of one kind of alert. | `key`, `title`, `description`, `is_enabled`, `threshold`, `threshold_label`, `roles` (a list of role keys), `send_email`, `escalate_after_days`, `sort_order` | None | `key` |

Notifications themselves are not stored. Each rule reads the live records of another module every time the list is asked for.

## Audit log

File: `backend/apps/audit/models.py`.

| Model | Purpose | Key fields | Links and delete behaviour | Uniqueness |
|---|---|---|---|---|
| `AuditLog` | One recorded action. | `username`, `user_role`, `action`, `model_name`, `object_id`, `object_repr`, `changes` (JSON), `ip_address`, `user_agent`, `endpoint`, `timestamp` | `user` (optional): **Set empty**. The `username` and role are also stored as text, so the entry stays readable after the user is deleted. | None. Indexed on `model_name` + `object_id`, `user` + `timestamp`, `action` + `timestamp`. |

`model_name` and `object_id` are plain values. See [Audit and logging](14-audit-and-logging.md).

## Apps without tables

`search`, `reports`, `notifications` and `core` define no models. They read the tables above.

## Keeping this page up to date

- Revise an app's table and diagram when its `backend/apps/<app>/models.py` changes: a new model, a new or removed field, a changed `on_delete`, or a new uniqueness rule.
- Revise "Generated numbers" when a model starts or stops using `NumberedModel` or its `PREFIX` changes.
- Revise "Tables filled with starting rows" when a migration with `RunPython` is added (search `backend/apps/*/migrations/` for `RunPython`).
- Revise "Why a delete is sometimes refused" when `backend/apps/core/exceptions.py` or `AuditedModelMixin.perform_destroy` changes.
