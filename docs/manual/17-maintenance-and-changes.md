# Maintenance and changes

This page is for developers. It explains how to extend the system the way the existing code does it: how to add a module, a duty, a notification rule or a report, how to run the tests and checks, how to handle database changes, and how to keep this manual correct. Administrators only need the last section.

## On this page

- [Before you change anything](#before-you-change-anything)
- [Run the tests and checks](#run-the-tests-and-checks)
- [Add a module](#add-a-module)
- [Add a duty](#add-a-duty)
- [Add a notification rule](#add-a-notification-rule)
- [Add a report](#add-a-report)
- [Database changes](#database-changes)
- [Conventions in the code](#conventions-in-the-code)
- [Keeping this manual up to date](#keeping-this-manual-up-to-date)

## Before you change anything

**For developers.** Read [Architecture](02-architecture.md) first. Three things in it matter for every change:

- Every rule lives in the API. The web app only shows and hides controls.
- Four mechanisms run by themselves: the page access check, the stock ledger signals, the finance journal sync and the purchasing and e-mail signals. A change to a model they watch changes their behaviour.
- A module's API is reachable only through a page listed in `PAGE_API` in `backend/apps/access/services.py`.

Set up a development copy as described in [Deployment](12-deployment.md) ("Running without Docker"). Never test against a database with real data: the seed commands delete records, and alert e-mails are real when a mailbox is configured.

## Run the tests and checks

**For developers.** Run all of these before handing in a change. CI (`.github/workflows/ci.yml`) runs the backend checks and the three frontend checks on every push and pull request. The browser tests and the layout audit are run by hand.

### Backend

From `backend/`, with the virtual environment active:

| Command | What it checks |
|---|---|
| `python manage.py check` | Django's system checks. |
| `python manage.py makemigrations --check --dry-run` | That no model change is missing its migration. |
| `python manage.py test apps` | Every test: each app's `tests.py`, plus `backend/apps/core/test_foundation.py`. |
| `python manage.py test apps.sales` | One app's tests. |

Tests create their own empty database. For a quick local run without PostgreSQL, set these environment variables for the command: `DB_ENGINE=sqlite`, `EMAIL_BACKEND=django.core.mail.backends.locmem.EmailBackend` and `MANAGEMENT_EMAIL=` (empty). The in-memory e-mail backend matters: several actions send alert e-mails, and a test run must never send real ones. CI runs the tests on PostgreSQL 16.

Shared test helpers are in `backend/apps/core/testing.py`: `make_user(role)`, `client_for(user)`, `make_stock`, `make_fabric`, `make_sorting_session`, `make_chemical`, `make_tank`, `make_decolor_session`, `make_dryer`, `make_drying_session`, `make_order`, `make_dried_stock`.

### Frontend

From `frontend/`:

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint with the Next.js rules. |
| `npm run typecheck` | Generates the route types, then runs the TypeScript compiler without output. |
| `npm run build` | The production build. |

### Browser tests

`npm run e2e` runs one scenario per module in Chromium with Playwright (`frontend/e2e/run.mjs`). The scenarios are: `warehouse`, `sorting`, `decolorization`, `drying`, `sales`, `users`, `access`, `reports`, `procurement`, `quality`, `production`, `finance`, `maintenance`, `workforce`, `sustainability`, `documents`, `traceability`, `approvals`.

What they need:

1. The API on port 8000 with demo data: `seed_demo_data`, then `seed_drying_data`, then `seed_module_data` (see [Deployment](12-deployment.md)).
2. The web app running on port 3001: `npm run build`, then `npx next start -p 3001`. The dev server (`npm run dev -- -p 3001`) also works.
3. Once per machine: `npx playwright install chromium`.

| Command | Effect |
|---|---|
| `npm run e2e` | All scenarios. |
| `npm run e2e -- sales quality` | Only the named ones. |
| `BASE=http://host:port npm run e2e` | Against another address. The default is `http://localhost:3001`. |
| `SHOTS=<folder> npm run e2e` | Where screenshots go. The default is `frontend/e2e/screenshots/`. |

Each scenario prints lines that start with `PASS` or `FAIL`. Any `FAIL` makes the command exit with an error. The scenarios change data, so run them on a demo database only, and reseed when they start failing because of leftovers.

### Layout audit

`npm run audit:ui` (`frontend/e2e/ui-audit.mjs`) opens every page, tab and form at several screen sizes in both themes. It reports controls that overlap, content wider than the screen, controls that leave their dialog, and text cut off without an ellipsis. It exits with an error when it finds a problem. It needs the same setup as the browser tests.

| Command | Effect |
|---|---|
| `npm run audit:ui` | Every page. |
| `node e2e/ui-audit.mjs sorting sales` | Only these pages. |
| `RUN=phone-dark node e2e/ui-audit.mjs sales` | Only one size and theme. The runs are `desktop-dark`, `phone-dark`, `laptop-light`, `tablet-light`, `phone-light`, `desktop-light`. |

Screenshots go to `frontend/e2e/screenshots/audit/`.

## Add a module

**For developers.** Copy the shape of an existing module. `procurement` is a good model for a module with workflows; `sustainability` for a simpler one. The steps below name every place that must know about the new module. The example module is called `example`, with the page key and route `example`.

### Backend

1. **Create the app** in `backend/apps/example/` with `__init__.py`, `apps.py` (`name = 'apps.example'`), `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `tests.py`, `admin.py` and `migrations/__init__.py`.
2. **Register it** in `INSTALLED_APPS` in `backend/config/settings.py` as `'apps.example'`.
3. **Mount its URLs** in `api_patterns` in `backend/config/urls.py`: `path('example/', include('apps.example.urls'))`. It is then served at both `/api/v1/example/` and `/api/example/`.
4. **Add the page** in `backend/apps/access/services.py`:
   - a line in `PAGES`: `('example', 'Example', '<menu group>', False)`. The last value is `True` only for a page that must stay with admins.
   - an entry in `PAGE_API`: `'example': {'read': {'example', ...}, 'write': {'example'}}`. List under `read` every module whose endpoints the page calls, including other modules' lists used in its dropdowns. List under `write` the modules it changes. A target with a slash, such as `'procurement/open-lines'`, gives only the endpoints under that path.

   Without this entry every call to the module is refused with a 403, for admins too. The test `test_every_api_has_a_page_that_reads_it` in `backend/apps/access/tests.py` fails when a mounted module has no page that reads it.
5. **Decide who starts with the page.** New pages start with admins only. `DEFAULT_ROLE_PAGES` records the starting pages of the built-in roles, but an existing database is not changed by editing it: the rows were written by a migration. To give a built-in role the page on existing installations, add a data migration in `backend/apps/access/migrations/` that creates the `RolePage` rows, or let an admin grant it under **Users** → **Access**. See [Access control](05-access-control.md).
6. **Write the models.** Use `NumberedModel` from `backend/apps/procurement/models.py` for records that need a number: set `PREFIX`. Choose each `on_delete` on purpose: `PROTECT` for history that must not disappear, `CASCADE` for lines that belong to a parent, `SET_NULL` for optional links.
7. **Write the rules in `services.py`.** Raise `rest_framework.exceptions.ValidationError` with a plain sentence the user can act on, keyed by field where it belongs to one.
8. **Write the views.**
   - Put `AuditedModelMixin` (`backend/apps/audit/middleware.py`) first in every viewset that changes data: `class ThingViewSet(AuditedModelMixin, viewsets.ModelViewSet)`.
   - In status actions, wrap the change with `before = self.snapshot(obj)` and `self.log_change(obj, before)`, or call `log_action` with the old and new status.
   - Pick the permission from `backend/apps/core/permissions.py`: `HasPage('example')` when the page alone decides; `HasDuty('some_duty')` or `has_duty(user, 'some_duty')` for an action that needs a duty; `is_admin(user)` only where the rule really is "admins only".
   - Use `filter_by_date_params(queryset, request.query_params, '<field>')` for lists that the period picker filters.
   - Return calculated amounts as strings with two decimals (the `_fixed` helpers), like the other modules.
9. **Add extension points, if they apply:**
   - search results: a finder and an entry in `GROUPS` in `backend/apps/search/finder.py`;
   - notifications: see [Add a notification rule](#add-a-notification-rule);
   - the approvals inbox: a collector and an entry in `KINDS` in `backend/apps/alerts/approvals.py`;
   - the executive figures: a block in `EXECUTIVE_BLOCKS` in `backend/apps/reports/services.py`;
   - demo data: `backend/apps/example/demo.py` with `add_demo_example(admin)` and `wipe_demo_example()`, and the name in `MODULES` in `backend/apps/core/management/commands/seed_module_data.py`.
10. **Create the migration:** `python manage.py makemigrations example`. Put default rows in a second migration with `RunPython` (see [Database changes](#database-changes)).
11. **Write tests** in `backend/apps/example/tests.py`: the rules, each status change, and who is refused. Use the helpers in `backend/apps/core/testing.py`.

### Frontend

1. **Types:** add the API shapes to `frontend/src/types/api.ts` or a new file in `frontend/src/types/`.
2. **Menu:** in `frontend/src/config/access.ts`, add the icon name to the `NavIcon` type and an item to the right group in `NAV`: `{ title: "Example", href: "/example", icon: "example" }`. The page key is the first part of the path, and it must equal the key in the backend's `PAGES`.
3. **Icon:** map the name to a Lucide icon in `ICONS` in `frontend/src/components/layout/nav-icon.tsx`.
4. **Colour:** every place below is typed against `NavIcon` or `Tone`, so the type check tells you when one is missing.
   - `NAV_TONES` in `frontend/src/config/nav-tones.ts`;
   - for a new stage colour: the `StageTone` type, `TONE` and `TONE_VAR` in `frontend/src/lib/tones.ts`;
   - the colour itself in `frontend/src/app/globals.css`: `--stage-example` for the light and the dark theme, and `--color-stage-example: var(--stage-example)` in the `@theme` block.
5. **Home page text:** a line in `DESCRIPTIONS` in `frontend/src/app/(app)/page.tsx`.
6. **Command menu:** the page's sections in `SECTIONS` in `frontend/src/components/layout/command-menu.tsx`.
7. **Feature folder:** `frontend/src/features/example/` with `schemas.ts` (Zod form rules and their messages), `example-forms.tsx` and `example-page.tsx`. Build on the shared parts: `PageHeader`, `DataTable`, `FormDialog`, `ConfirmDialog`, `StatCard`, `StatusBadge`, and the hooks `useList`, `useSave`, `useAction`, `useDelete` from `frontend/src/lib/crud.ts`. Use `usePageAccess()` and hide add, edit and delete controls when `readOnly` is true.
8. **Route:** `frontend/src/app/(app)/example/page.tsx`, a thin file that sets `metadata.title` and renders the page component. Copy `frontend/src/app/(app)/sales/page.tsx`.
9. **Audit log filter (optional):** add the model names to `MODELS` in `frontend/src/features/reports/audit-log.tsx` so they can be picked in the record type list.

### Tests, audit and documents

1. **Browser scenario:** `frontend/e2e/example.mjs` exporting `exampleScenario(browser)`, built like the others with `createReport`, `login` and `choose` from `frontend/e2e/helpers.mjs`. Register it in the `scenarios` object in `frontend/e2e/run.mjs`.
2. **Layout audit:** add `'example'` to `PAGES` in `frontend/e2e/ui-audit.mjs`, then run `node e2e/ui-audit.mjs example`.
3. **Manual:** see [Keeping this manual up to date](#keeping-this-manual-up-to-date).

### Checklist

- [ ] `INSTALLED_APPS` and `api_patterns` have the app.
- [ ] `PAGES` and `PAGE_API` have the page; the access tests pass.
- [ ] Every viewset that changes data uses `AuditedModelMixin`.
- [ ] Migrations exist; `makemigrations --check --dry-run` is clean.
- [ ] Backend tests cover the rules and the refusals.
- [ ] The page appears in the menu for an admin, and not for a role without it.
- [ ] A user who holds the page as view only sees no add, edit or delete controls, and the API refuses a change.
- [ ] Lint, type check and build pass.
- [ ] The browser scenario passes and the layout audit reports no problems.
- [ ] The manual has the module's guide and the updated tables.

## Add a duty

**For developers.** A duty is something a role may do beyond opening a page. What duties are and how admins assign them is in [Access control](05-access-control.md). The code places are:

1. **Define it** in `DUTIES` in `backend/apps/access/services.py`:
   ```python
   'close_books': ('Close the books', 'Close and reopen financial periods.', 'finance'),
   ```
   The three values are the title, what it allows, and the page it is done on. The duty then appears in the duties grid under **Users** → **Access**, because the screen reads the list from `access/duties/`.
2. **Starting holders.** Admins carry every duty without any row. `DEFAULT_ROLE_DUTIES` records which built-in roles started with which duties; editing it does not change an existing database. To give a role the duty on existing installations, add a data migration in `backend/apps/access/migrations/` that creates the `RoleDuty` rows, or let an admin tick it on screen.
3. **Enforce it** where the action happens:
   - on a whole view or action: `permission_classes=[IsAuthenticated, HasDuty('close_books', message='Your role is not allowed to close the books.')]`;
   - inside a view, serializer or service: `if not has_duty(user, 'close_books'): raise PermissionDenied('...')`.

   Both are in `backend/apps/core/permissions.py`. `has_duty` accepts several keys and is true when the role carries any of them.
4. **Frontend.** Add the key to the `Duty` type in `frontend/src/types/api.ts`. The signed-in user's duties are in the session (`duties`); `useDuties()` in `frontend/src/features/auth/use-duty.ts` returns a function that tells whether the user carries one. Use it to hide a button. The API still decides.
5. **Tests.** Test that a role without the duty is refused and a role with it is allowed. See `backend/apps/access/tests.py` for examples.
6. **Manual.** Update the duty list in [Access control](05-access-control.md) and [Roles and responsibilities](04-roles-and-responsibilities.md), and the "Extra rule" column in [API](10-api.md).

## Add a notification rule

**For developers.** Notifications are not stored. Each rule has a function that reads live records and returns what needs attention now. Everything is in `backend/apps/alerts/`.

1. **Write the collector** in `rules.py`. It takes `(rule, ctx)` and yields items built with `item(rule, pk, title, message, severity, href, created=None, action='View')`:
   - `title` and `message` read as one sentence, for example "Caustic soda" + "is below 25%".
   - `severity` is `'danger'`, `'warning'` or `'info'`.
   - `href` is the page the item opens, for example `'/sales'`.
   - `created` is the date the problem started. Escalation is worked out from it, so a rule without `created` never escalates.
   - Read the rule's number with `number_of(rule, <default>)`.
   - Keep to a fixed, small number of queries.
2. **Register it** in `COLLECTORS` under a new key, for example `'example-overdue'`.
3. **Name its page** in `RULE_PAGES`: `'example-overdue': 'example'`. A user other than an admin receives the rule's items only when their role is listed on the rule **and** they have this page. The roles an admin can choose for the rule are the roles that have the page.
4. **Create the rule row** with a data migration in `backend/apps/alerts/migrations/`, like `0002_default_rules.py`: `key`, `title`, `description`, `is_enabled`, `threshold`, `threshold_label`, `roles`, `sort_order`. Rules cannot be created through the API or on screen. Leave `threshold_label` empty for a rule without a number; the API then refuses a threshold for it.
5. **Nothing to do on the frontend.** The bell, the dashboard list and the **Rules** tab read the rules and items from the API. The e-mail digest (`digest.py`) includes the rule when an admin marks it for e-mail.
6. **Tests** in `backend/apps/alerts/tests.py`: the item appears when the condition holds, disappears when it is solved, and reaches only the right users.
7. **Manual.** Update [Approvals and notifications](07-modules/approvals-and-notifications.md) and the count of starting rows in [Database](09-database.md).

To add a kind of item to the **Approvals** inbox instead, write a collector in `backend/apps/alerts/approvals.py` and add it to `KINDS`. Each item names the owning module's own endpoints in `actions`; the inbox decides nothing itself.

## Add a report

**For developers.** A report in the report centre is one function that returns a table. Everything is in `backend/apps/reports/services.py`.

1. **Write the builder.** It takes `(period, user)` and returns a dictionary:
   | Key | Content |
   |---|---|
   | `columns` | A list of `_col(key, label, kind)`. `kind` is `text`, `number`, `kg`, `money`, `percent` or `date`. |
   | `rows` | A list of dictionaries, one value per column key. |
   | `totals` | One dictionary for the total row. |
   | `notes` | A list of sentences that say how the figures are defined. |
   | `summary` (optional) | Figures shown above the table: `{'label', 'value', 'kind'}`. |
   | `chart` (optional) | `{'type': 'bar', 'x': <column key>, 'kind': ..., 'series': [{'key', 'label'}]}`. |

   Use `period.filter(queryset, '<date field>')`, `period.params` or `period.bounds()` to apply the period.
2. **Take the figures from the owning module.** Call that module's service function, or its report view through `_module_view(view_class, user, params)`, so the number in the report equals the number on the module's page. If a figure is defined only in the report, say so in `notes`.
3. **Register it** in `REPORTS`:
   ```python
   {'key': 'example-summary', 'group': 'Production', 'title': 'Example summary', 'build': example_summary,
    'description': 'One sentence saying what the report shows.'},
   ```
   `group` must be one of `GROUPS`. Add `'dated': False` for a report that has no period.
4. **Nothing else is needed.** The report centre reads the list from `reports/catalogue/` and the table from `reports/run/<key>/`. The Excel and CSV exports are built from the same table by `backend/apps/reports/exports.py`.
5. **Tests** in `backend/apps/reports/tests.py`: the report runs, its totals are right, and it agrees with the module's own figure.
6. **Manual.** Update [Dashboard and reports](07-modules/dashboard-and-reports.md) and the key list in [API](10-api.md).

The three older reports (daily production, monthly sales, waste analysis) are separate functions in `backend/apps/reports/views.py`, each with its own Excel export. New reports belong in the report centre.

## Database changes

**For developers.**

| Task | How |
|---|---|
| Change a model | Edit `models.py`, then `python manage.py makemigrations <app>`. Commit the migration with the change. |
| Check nothing is missing | `python manage.py makemigrations --check --dry-run`. CI fails when it reports a change. |
| Apply | `python manage.py migrate`. In Docker the API runs `migrate --noinput` every time it starts, so an update applies its migrations by itself. |
| Add default rows | A separate migration with `migrations.RunPython(add_defaults, migrations.RunPython.noop)`. Use `apps.get_model(...)` and `get_or_create`, so running it on a database that already has the rows changes nothing. Examples: `backend/apps/finance/migrations/0002_default_accounts.py`, `backend/apps/alerts/migrations/0002_default_rules.py`. |
| Move existing data | A `RunPython` migration with a real reverse function where possible. Example: `backend/apps/sales/migrations/0004_backfill_customers.py`. |

Rules to follow:

- Never edit a migration that has been applied on a live system. Add a new one.
- A new required field needs a default, or a data migration that fills existing rows.
- Take a backup before applying a migration that removes or rewrites data on a live system. See [Deployment](12-deployment.md).
- After changing a model watched by signals (`DryingSession`, `DispatchTracking`, `SalesOrder`, `SalesReturn`, `Stock`, `SupplierPayment`, `Payment`), run the inventory, sales and procurement tests, and `python manage.py reconcile_inventory` on a demo database.
- After changing a record that finance posts from (sales invoices, customer payments, sales returns, supplier invoices, supplier payments, expenses), check `_wanted` in `backend/apps/finance/services.py` and run the finance tests.

## Conventions in the code

**For developers.** These are the patterns the existing code follows. Keep to them so the code stays one piece.

### Backend

- **Rules live in `services.py`,** not in views. Views read the request, call a service and return the answer.
- **Money and weights are `Decimal`,** never floats. Calculated figures are returned as strings with two decimals.
- **Messages are plain sentences** a user can act on, for example "Only 120.00 kg of dried stock is available for this fabric (150.00 kg needed). Save the order as Draft until stock is ready."
- **Stock checks and saves happen in one transaction.** See `transaction.atomic()` and `lock_fabric` in `backend/apps/inventory/services.py`.
- **Status changes are actions,** not field edits: `POST <resource>/<id>/<action>/`.
- **History is protected.** Links that carry history use `PROTECT`. Records that must not be rewritten are replaced instead: a recipe change makes a new version, a wrong journal entry is reversed.
- **Values are copied when they must not change later:** the chemical's cost on an issuance, the limits on an inspection result, the amounts on a sales invoice, the part's cost on a part use.
- **Cross-app model references use strings** (`'sorting.FabricStock'`) or imports inside functions, to avoid import cycles.
- **Lists avoid one query per row:** `select_related` and `prefetch_related` in `get_queryset`, and maps such as `availability_map()`.
- **Access is checked with pages and duties,** through the helpers in `backend/apps/core/permissions.py`. New code does not compare role names.
- **Every change is audited** with `AuditedModelMixin` or `log_action`.

### Frontend

- **One folder per module** in `src/features/`, with `schemas.ts`, a forms file and a page file. Route files in `src/app/(app)/` stay thin.
- **All API calls go through `api()`** in `src/lib/api.ts` and the hooks in `src/lib/crud.ts`. Nothing calls Django directly from the browser.
- **Forms use React Hook Form with a Zod schema.** The schema holds the messages. API field errors are shown next to their fields through `ApiError.fieldErrors`.
- **The web app does no business calculation.** It shows what the API returns.
- **Shared look comes from shared parts:** `src/components/common/` and the colour map in `src/lib/tones.ts`. A layout problem is fixed in the shared part, not on one page.
- **TypeScript is strict** and imports use the `@/` alias for `src/`.
- **Lint must pass without new exceptions.** The code has five `eslint-disable-next-line` comments: two for a deliberate full page reload (`src/lib/api.ts`, `src/features/auth/use-session.ts`) and three for the generic row type of the table (`src/components/common/data-table.tsx`). Do not add others; fix the cause.
- **Charts do not animate** (`isAnimationActive={false}`). Figures count up (`src/hooks/use-count-up.ts`) but jump straight to their value when the browser asks for reduced motion, which is how the browser tests run, so they can read figures at once.

### Browser tests

- A scenario signs in with a demo login, does the module's main tasks, and records each check with `report.check(label, ok)`.
- Use exact labels (`{ exact: true }`) or `.first()` when a label appears more than once on a page.
- Requests that fail on purpose with 400 or 409 are expected; anything else in the browser console fails the scenario (`finish` in `frontend/e2e/helpers.mjs`).

## Keeping this manual up to date

**For administrators and developers.** The manual describes the code as it is. It is only useful while that stays true. Each manual page ends with a section naming the code files it describes. The table below is the other direction: for a kind of change, the pages to revise.

| When you change | Revise |
|---|---|
| A module's screens, forms, statuses, rules or messages (`frontend/src/features/<module>/`, `backend/apps/<app>/services.py`, serializers) | That module's guide in `07-modules/`. Also [Workflows](08-workflows.md) when a status flow or an approval changes. |
| A model: new, removed, a field, an `on_delete`, a uniqueness rule, a number prefix (`backend/apps/*/models.py`) | [Database](09-database.md) and the "Records and fields" table of the module's guide. |
| A data migration with default rows | [Database](09-database.md), section "Tables filled with starting rows". |
| An endpoint, an `@action`, a filter, a permission on a view (`urls.py`, `views.py`) | [API](10-api.md) and the "For developers" part of the module's guide. |
| Pages, levels, duties, roles, the access check (`backend/apps/access/`, `backend/apps/core/permissions.py`) | [Access control](05-access-control.md), [Roles and responsibilities](04-roles-and-responsibilities.md), and the "Who may call what" table in [API](10-api.md). |
| A setting or environment variable (`backend/config/settings.py`, the `.env.example` files, `docker-compose.yml`, `frontend/nginx.edge.conf`) | [Configuration](11-configuration.md). |
| Docker files, the backup and restore scripts, a management command, the seed commands | [Deployment](12-deployment.md). |
| Sign-in, sessions, cookies, the proxy, the route guard | [Architecture](02-architecture.md) and [Security](13-security.md). |
| What is audited or logged (`backend/apps/audit/`, a view's use of `AuditedModelMixin` or `log_action`, `LOGGING`) | [Audit and logging](14-audit-and-logging.md). |
| A dependency or its version (`backend/requirements.txt`, `frontend/package.json`, the Dockerfiles, CI) | [Technology stack](03-technology-stack.md). |
| A notification rule or an approvals kind | [Approvals and notifications](07-modules/approvals-and-notifications.md). |
| A report | [Dashboard and reports](07-modules/dashboard-and-reports.md). |
| A new module | A new guide in `07-modules/` using the module guide headings, a line in `07-modules/README.md`, and the tables in [System overview](01-system-overview.md), [Architecture](02-architecture.md), [Database](09-database.md), [API](10-api.md) and [Access control](05-access-control.md). |
| A new app, folder or shared building block | [Architecture](02-architecture.md) and this page. |
| A fix for a problem users report often | [Troubleshooting](15-troubleshooting.md) or [FAQ](16-faq.md). |

Rules for writing in the manual:

- Write only what the code does. Read the code before each statement. If something is partly built, say exactly what is there and what is not.
- Use the exact words of the screen: button labels, tab names, status names and messages, quoted exactly.
- Keep it plain and short. Prefer a table to a paragraph when listing things.
- Mark technical parts with **For developers**, so an administrator can skip them.
- Change the manual in the same commit as the code.

## Keeping this page up to date

- Revise "Run the tests and checks" when `.github/workflows/ci.yml`, the scripts in `frontend/package.json`, `frontend/e2e/run.mjs`, `frontend/e2e/ui-audit.mjs` or `backend/apps/core/testing.py` change.
- Revise "Add a module" when one of the places it lists moves: `backend/config/settings.py`, `backend/config/urls.py`, `backend/apps/access/services.py`, `frontend/src/config/access.ts`, `nav-icon.tsx`, `nav-tones.ts`, `lib/tones.ts`, `globals.css`, `command-menu.tsx`, `app/(app)/page.tsx`.
- Revise "Add a duty" when `DUTIES`, `has_duty` or `HasDuty` change, "Add a notification rule" when `backend/apps/alerts/rules.py` changes its structure, and "Add a report" when `REPORTS` or the shape a builder returns changes in `backend/apps/reports/services.py`.
- Revise the mapping table when a manual file is added, renamed or removed.
