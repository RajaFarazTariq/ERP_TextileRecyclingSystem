# Textile Recycling ERP: system manual

This manual explains the whole system: what it does, how to run it, how to use each module, and how it is built. It is written so that a new organisation, administrator or developer can work with the system from the manual alone.

## How to read it

Parts marked **For administrators** explain how to use and manage the system. No technical knowledge is needed.

Parts marked **For developers** explain code, data and servers. Administrators can skip them.

| If you are... | Start with |
|---|---|
| New to the system | [System overview](01-system-overview.md), then [Workflows](08-workflows.md) |
| An administrator setting up an organisation | [Admin guide](06-admin-guide.md), [Roles](04-roles-and-responsibilities.md), [Access control](05-access-control.md) |
| A user of one module | That module's guide under [Module guides](07-modules/README.md) |
| Installing or hosting the system | [Deployment](12-deployment.md), [Configuration](11-configuration.md), [Security](13-security.md) |
| A developer | [Architecture](02-architecture.md), [Database](09-database.md), [API](10-api.md), [Maintenance and changes](17-maintenance-and-changes.md) |
| Stuck | [Troubleshooting](15-troubleshooting.md), then the [FAQ](16-faq.md) |

## Contents

### Understanding the system

| # | Page | What it covers | For |
|---|---|---|---|
| 1 | [System overview](01-system-overview.md) | What the system is for, the flow of material, every module at a glance, glossary | Everyone |
| 2 | [Architecture](02-architecture.md) | The parts, how a request travels, sessions, code layout | Developers |
| 3 | [Technology stack](03-technology-stack.md) | Technologies and versions | Developers |

### People and access

| # | Page | What it covers | For |
|---|---|---|---|
| 4 | [Roles and responsibilities](04-roles-and-responsibilities.md) | The built-in roles, who does what, shaping your own roles | Administrators |
| 5 | [Access control](05-access-control.md) | Pages, levels, duties, exceptions, safeguards, how it is enforced | Administrators, developers |
| 6 | [Admin guide](06-admin-guide.md) | Day-to-day administration, first setup, checklists | Administrators |

### Using the system

| # | Page | What it covers | For |
|---|---|---|---|
| 7 | [Module guides](07-modules/README.md) | One guide per module: screens, fields, statuses, steps, rules, problems | Everyone |
| 8 | [Workflows](08-workflows.md) | End-to-end processes and every approval | Everyone |

The module guides:

| Group | Guides |
|---|---|
| Overview | [Dashboard and reports](07-modules/dashboard-and-reports.md) · [Approvals and notifications](07-modules/approvals-and-notifications.md) · [Search and traceability](07-modules/search-and-traceability.md) |
| Operations | [Warehouse](07-modules/warehouse.md) · [Sorting](07-modules/sorting.md) · [Decolorization](07-modules/decolorization.md) · [Drying](07-modules/drying.md) · [Quality](07-modules/quality.md) · [Production](07-modules/production.md) · [Maintenance](07-modules/maintenance.md) · [Sustainability](07-modules/sustainability.md) |
| Commercial | [Purchasing](07-modules/purchasing.md) · [Sales](07-modules/sales.md) · [Inventory](07-modules/inventory.md) · [Finance](07-modules/finance.md) |
| Administration | [Documents](07-modules/documents.md) · [Workforce](07-modules/workforce.md) · [Users](07-modules/users.md) |

### Technical reference

| # | Page | What it covers | For |
|---|---|---|---|
| 9 | [Database](09-database.md) | Every table and how they relate | Developers |
| 10 | [API](10-api.md) | Conventions and every endpoint | Developers |
| 11 | [Configuration](11-configuration.md) | Every setting and environment variable | Developers, installers |
| 12 | [Deployment](12-deployment.md) | Installing, HTTPS, backups, updates, scheduled jobs | Installers |
| 13 | [Security](13-security.md) | What is protected and what the administrator must do | Administrators, installers |
| 14 | [Audit and logging](14-audit-and-logging.md) | What is recorded and how to read it | Administrators, developers |

### Help and upkeep

| # | Page | What it covers | For |
|---|---|---|---|
| 15 | [Troubleshooting](15-troubleshooting.md) | Problems, causes and fixes | Everyone |
| 16 | [FAQ](16-faq.md) | Short answers to common questions | Everyone |
| 17 | [Maintenance and changes](17-maintenance-and-changes.md) | Extending the system and keeping this manual current | Developers |

## Conventions

- Words in **bold** inside steps are what you see on the screen: buttons, tabs, field labels.
- Text in "quotes" after "the system says" is an exact message.
- `Text like this` is a file, a command, a setting or an API path.
- "Admin" means a user whose role is Admin. "Administrator" means the person who looks after the system.
- Weights are in kilograms (kg) and money in rupees (Rs.), as on the screens.

## Other documents

- [`README.md`](../../README.md) at the top of the project: a short introduction with screenshots and quick-start commands.
- [`docs/USER_GUIDE.md`](../USER_GUIDE.md) and [`docs/DEPLOYMENT.md`](../DEPLOYMENT.md): shorter versions of the admin guide and the deployment page.

## Keeping the manual current

Every page ends with **Keeping this page up to date**, which lists the code that page describes. When that code changes, revise the page in the same change. The full routine is in [Maintenance and changes](17-maintenance-and-changes.md).
