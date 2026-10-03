# Module guides

This is the index of the module guides: one guide for each part of the system. It is for anyone who needs to know how a page works, and for developers who need to find the code behind it.

## On this page

- [How the guides are organised](#how-the-guides-are-organised)
- [Overview](#overview)
- [Operations](#operations)
- [Commercial](#commercial)
- [Administration](#administration)
- [Reading a guide](#reading-a-guide)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## How the guides are organised

The guides are grouped the same way as the sidebar in the application: **Overview**, **Operations**, **Commercial** and **Administration**. There are eighteen guides.

Most guides cover one page. Four are different:

- **Dashboard and reports** covers two pages: Dashboard (under Overview) and Reports (under Administration). It is listed in both groups.
- **Approvals and notifications** covers the Approvals page and the notification bell, which is on every page.
- **Search and traceability** covers the Traceability page and the search box, which is on every page.
- **Inventory** has no page of its own. It is the stock ledger behind the Sales page and the Dashboard. It is listed under Commercial.

For how the modules fit together, read [System overview](../01-system-overview.md) and [Workflows](../08-workflows.md) first.

## Overview

| Guide | Page | What it covers |
|---|---|---|
| [Dashboard and reports](dashboard-and-reports.md) | Dashboard | Live figures for the whole factory: material flow, sellable stock, sales, "Business at a glance", what needs attention and recent activity |
| [Approvals and notifications](approvals-and-notifications.md) | Approvals, and the bell | Everything waiting for a decision in one inbox; the notification rules behind the bell; the e-mail digest and the older e-mail alerts and scheduled reports |
| [Search and traceability](search-and-traceability.md) | Traceability, and the search box | Finding any record with Ctrl+K; following one fabric lot from its delivery to the customer |

## Operations

| Guide | Page | What it covers |
|---|---|---|
| [Warehouse](warehouse.md) | Warehouse | Recording deliveries of waste fabric, the vendors that supply it and the factory units |
| [Sorting](sorting.md) | Sorting | Fabric lots made from deliveries, and the sorting sessions that process them |
| [Decolorization](decolorization.md) | Decolorization | Tanks, chemical stock and lots, recipes, chemical issuances and decolorization batches |
| [Drying](drying.md) | Drying | Dryers and drying sessions; completed output becomes sellable stock |
| [Quality](quality.md) | Quality | Quality standards, inspections, quarantine of failed material and corrective actions |
| [Production](production.md) | Production | Production orders, routings, bills of materials, the schedule and planned against actual figures |
| [Maintenance](maintenance.md) | Maintenance | Machines, preventive schedules, work orders, breakdowns, spare parts and downtime |
| [Sustainability](sustainability.md) | Sustainability | Waste records, disposal, recovery rates, water and energy use and the environmental report |

## Commercial

| Guide | Page | What it covers |
|---|---|---|
| [Purchasing](purchasing.md) | Purchasing | Purchase requests, purchase orders, deliveries against orders, supplier invoices and payments, returns, quotes and supplier performance |
| [Sales](sales.md) | Sales | Customers, products and prices, quotations, orders, dispatches, invoices, payments, returns, statements and sales performance |
| [Inventory](inventory.md) | No page of its own | The ledger of dried, sellable stock: on hand, reserved and available; manual adjustments; the `reconcile_inventory` command |
| [Finance](finance.md) | Finance | Chart of accounts, journal, expenses, who owes what, financial statements, production costing, periods and tax rates |

## Administration

| Guide | Page | What it covers |
|---|---|---|
| [Documents](documents.md) | Documents | Certificates, test reports and other files, with categories that decide who sees them, versions and expiry dates |
| [Workforce](workforce.md) | Workforce | Employees, departments, job roles, shifts, daily attendance, leave, tasks and productivity |
| [Dashboard and reports](dashboard-and-reports.md) | Reports | Daily production, monthly sales and waste analysis; the report centre with Excel and CSV exports; the audit-log tab |
| [Users](users.md) | Users | Accounts, signing in, passwords, activating and deactivating, and the last-admin safeguard. The Access tab is explained in [Access control](../05-access-control.md) |

## Reading a guide

Every guide has the same sections, in the same order:

| Section | What you find there |
|---|---|
| What it does | The module in a few paragraphs |
| Who can use it | The starting access, and the duties it needs. How access is changed is in [Access control](../05-access-control.md) |
| Screens | Each tab, its buttons and its row actions |
| Records and fields | A table for each kind of record: every field, whether it is required, and its rules |
| Statuses | Each status and what moves a record from one to the next |
| How to | Numbered steps for the common tasks |
| Business rules | Every rule the system enforces, with the exact message it shows |
| Related data | The other modules it reads or changes |
| For developers | Models, services, endpoints, tests and the browser test scenario |
| Common problems | Symptom, cause and fix |
| Keeping this page up to date | The code files the guide describes |

Two labels mark the technical parts. **For administrators** marks things done on the server or in settings. **For developers** marks code-level detail; an administrator can skip those parts.

Words in **bold** inside steps are the exact labels on the screen. Text in "quotes" in the rules tables is the exact message the system shows.

## Keeping this page up to date

- `frontend/src/config/access.ts` (`NAV`): the sidebar's groups and page names. If a page is added, renamed or moved, update this index.
- `backend/apps/access/services.py` (`PAGES`): the same list on the server side.
- `backend/config/urls.py`: the list of backend modules. A new module needs a new guide and a line here.
- Each guide's own "Keeping this page up to date" section lists the files it describes.
