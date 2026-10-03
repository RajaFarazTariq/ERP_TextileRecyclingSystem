# Deployment

This page explains how to put the system on a server, start it for the first time, make it safe, back it up, watch it and update it. It is for the administrator who runs the server. The last sections are for developers who run the system on their own machine.

## On this page

- [What you are installing](#what-you-are-installing)
- [What you need](#what-you-need)
- [First start](#first-start)
- [The first admin](#the-first-admin)
- [HTTPS](#https)
- [Go-live checklist](#go-live-checklist)
- [Backups](#backups)
- [Restoring a backup](#restoring-a-backup)
- [Health check](#health-check)
- [Logs](#logs)
- [Updating](#updating)
- [Stopping and starting](#stopping-and-starting)
- [Scheduled jobs](#scheduled-jobs)
- [Running without Docker (development)](#running-without-docker-development)
- [Demo data](#demo-data)
- [What this system does not do](#what-this-system-does-not-do)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## What you are installing

**For administrators.** The production setup is the Docker Compose file in the project folder, `docker-compose.yml`. It runs four services:

| Service | What it is | Data it keeps |
|---|---|---|
| `db` | PostgreSQL 16 | All records, in the Docker volume `pgdata` |
| `backend` | The API (Django, served by gunicorn) | Uploaded documents, in the Docker volume `media` |
| `app` | The web app (Next.js) | Nothing |
| `app-edge` | The front server (nginx). The only service that listens on a network port. | Nothing |

Only the port of `app-edge` is published (`APP_PORT`, default 8080). The database port is not published. Keep it that way.

How the parts work together is explained in [Architecture](02-architecture.md). Every setting is listed in [Configuration](11-configuration.md).

## What you need

- A server with Docker and Docker Compose.
- The project folder on the server (for example by `git clone`).
- A shell that can run `sh` scripts, for the backup and restore scripts. On Linux this is there already.
- For real use: a domain name and an HTTPS server in front (see [HTTPS](#https)).

## First start

**For administrators.** Run every command from the project folder, the one that contains `docker-compose.yml`.

1. Create the API's settings file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Edit `backend/.env`:
   - `SECRET_KEY`: a long random string. Never reuse one from another installation.
   - `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `MANAGEMENT_EMAIL`: fill these only if the system should send alert e-mails. Leave `EMAIL_HOST_USER` empty to send none.

   The file must exist. Docker Compose refuses to start without it.

2. Create the Docker settings file:
   ```bash
   cp .env.docker.example .env
   ```
   Edit `.env`:
   - `POSTGRES_PASSWORD`: a strong password. Set it **before** the first start. The database stores it when it is first created; changing this line later does not change the stored password.
   - `DEBUG=False`
   - `ALLOWED_HOSTS`: the name or address people will type, for example `erp.example.com`.
   - `CSRF_TRUSTED_ORIGINS`: the full address, for example `https://erp.example.com`.
   - `APP_PORT`: the port the front server listens on.
   - `SECURE_COOKIES`: leave `false` until HTTPS works.

   In Docker, `DEBUG`, `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` are read from this file, not from `backend/.env`.

3. Build and start:
   ```bash
   docker compose up -d --build
   ```
   The API applies all database changes ("migrations") by itself each time it starts. On the first start this creates every table and the starting rows described in [Database](09-database.md).

4. Check that everything is up:
   ```bash
   docker compose ps
   ```
   `db` and `backend` should show `healthy`. The backend can take up to a minute.

5. Create the first admin (next section), then open `http://<server>:<APP_PORT>/`.

## The first admin

A new database has no users. There are two ways to create the first one.

**Option A: the setup script.**

```bash
docker compose exec backend python setup_fresh.py
```

It creates a user named `Test_User` with the Admin role and prints its password. This password is written in `backend/setup_fresh.py`, so it is known to anyone who has the code. Use it only to get in:

1. Sign in as `Test_User`.
2. Open **Users** and create the real admin accounts, each with its own strong password.
3. Sign in as one of them, then change the password of `Test_User` or deactivate it.

Do not run `setup_fresh.py` again on a live system. If `Test_User` exists, the script sets its password back to the printed one, makes it active again and gives it the Admin role.

**Option B: Django's own command.**

```bash
docker compose exec backend python manage.py createsuperuser
```

It asks for a username, an e-mail address and a password. The user gets the Admin role (`CustomUserManager.create_superuser` in `backend/apps/users/models.py`). No known password is involved.

Users made in either way can also open the admin panel at `/admin/` and, in production, the API documentation at `/api/docs/`. Users created later on the **Users** page cannot, even as Admin; see [API](10-api.md).

Have at least two active admins. The system refuses to remove or deactivate the last one, but a second admin is what helps when the first is away.

## HTTPS

**For administrators.** The front server in this project speaks plain HTTP. To serve the site over HTTPS, put an HTTPS server in front of it. Common choices are Caddy, nginx with a certificate tool, or a hosting provider's load balancer. It holds the certificate and forwards requests to `APP_PORT`.

Once the site opens over HTTPS:

| File | Setting | Why |
|---|---|---|
| `.env` | `SECURE_COOKIES=true` | The web app's sign-in cookies are then sent over HTTPS only. |
| `backend/.env` | `SECURE_COOKIES=True` | The same for the admin panel's cookies. |
| `.env` | `CSRF_TRUSTED_ORIGINS=https://<your address>` | The admin panel accepts forms from this address. |
| `.env` | `ALLOWED_HOSTS=<your host name>` | The API answers to this name. |

Then apply them: `docker compose up -d`.

Do not set `SECURE_COOKIES` to true while the site is still on plain HTTP. Browsers would drop the sign-in cookie and nobody could sign in.

Three more points:

- **Redirect to HTTPS and HSTS.** Do these on the HTTPS server in front. The two API settings for them, `SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS`, do not fit the Docker layout as it stands; the reason is in [Configuration](11-configuration.md). Leave them at their defaults unless you have tested them.
- **Visitor addresses.** The front server records the address of whoever connects to it. With another server in front, that is the other server's address. The sign-in limit then counts all visitors together, and the audit log shows one address for everyone. To keep them apart, change the `X-Forwarded-For` lines in `frontend/nginx.edge.conf` to pass on the address your HTTPS server reports, and restart `app-edge`.
- **Upload size.** If your HTTPS server has its own upload limit, make it at least as large as the limits in [Configuration](11-configuration.md).

## Go-live checklist

- [ ] `SECRET_KEY` is new, long and random.
- [ ] `DEBUG=False` in the root `.env`.
- [ ] `POSTGRES_PASSWORD` is strong and was set before the first start.
- [ ] The site opens over HTTPS, and `SECURE_COOKIES` is true in both files.
- [ ] `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` hold the real address.
- [ ] `Test_User` has a new password or is deactivated. No demo users exist (`admin`, `warehouse_user`, `sorting_user`, `decolor_user`, `drying_user`, `erp_admin`, `wh_user`, `sort_user`).
- [ ] No demo data was seeded into this database.
- [ ] Every person has their own account with the right role. **Users** → **Access** shows the pages and duties each role should have. See [Access control](05-access-control.md).
- [ ] At least two people are active admins.
- [ ] A backup has been taken **and restored once on a test machine**.
- [ ] A nightly backup is scheduled, and the backup folder is copied off the server.
- [ ] `/api/health/` answers `{"status": "ok", "database": "ok"}` and something checks it regularly.
- [ ] Only the web port is open to the network.
- [ ] If e-mail is used: the mailbox password was made for this system, and `MANAGEMENT_EMAIL` is the right address.
- [ ] The scheduled jobs you want are set up (see [Scheduled jobs](#scheduled-jobs)).
- [ ] If you do not want the admin panel and API documentation reachable from outside, they are removed from `frontend/nginx.edge.conf` or blocked on the HTTPS server.

## Backups

**For administrators.** Two things hold data: the database and the uploaded documents. One script backs up both.

```bash
sh scripts/backup.sh /srv/erp-backups
```

Run it from the project folder, while the system is running. It writes two files into the folder you name (default `./backups`):

| File | Contents |
|---|---|
| `erp-db-<date>-<time>.sql.gz` | The whole database |
| `erp-media-<date>-<time>.tar.gz` | The uploaded documents |

What else it does:

- It keeps the newest 14 of each kind and deletes older ones. To keep more: `KEEP=30 sh scripts/backup.sh /srv/erp-backups`.
- If the database file is smaller than 1000 bytes it stops with: "The database backup is only *N* bytes. Check that the stack is running."

To run it every night at 02:00, add a line to the server's cron table (adjust the paths):

```
0 2 * * * cd /srv/erp && sh scripts/backup.sh /srv/erp-backups >> /var/log/erp-backup.log 2>&1
```

Copy the backup folder to another machine or to cloud storage every day. A backup on the same disk does not protect against losing the server.

The settings files (`backend/.env` and `.env`) are not in the backup. Keep a copy of them in a safe place too. Without `SECRET_KEY` everyone must sign in again, which is harmless, but without the files you must set everything up again.

## Restoring a backup

```bash
sh scripts/restore.sh /srv/erp-backups/erp-db-20261002-020000.sql.gz /srv/erp-backups/erp-media-20261002-020000.tar.gz
```

The first file is required. The second is optional; without it the uploaded files are left as they are.

This **replaces** the current database, and the current files when the second file is given. The steps the script takes:

1. It asks: `This replaces the current database with <file>. Type "restore" to continue:`. Type `restore`. Anything else cancels.
2. It stops the API and the web app, so nothing is written during the restore.
3. It deletes the database, creates an empty one and loads the backup into it.
4. It starts the API again.
5. If a files backup was given, it empties the upload folder and unpacks the backup into it.
6. It starts the web app and prints: "Restored. Open the site and check a few records."

After a restore, open the site, sign in and check a few recent records and one uploaded document.

Restore a backup made with the same version of the system, or an older one. When the API starts after the restore, it applies any newer database changes by itself. A backup from a newer version does not always work with older code.

**Do a restore drill** on a test machine before going live and again every few months. A backup that has never been restored is not yet proven.

## Health check

`GET /api/health/` needs no sign-in and shows nothing sensitive.

| Answer | Meaning |
|---|---|
| `200` `{"status": "ok", "database": "ok"}` | The API is up and can reach the database. |
| `503` `{"status": "error", "database": "unreachable"}` | The API is up but cannot reach the database. |
| No answer | The API, the front server or the network is down. |

Point an uptime monitor at `https://<your address>/api/health/`. Docker uses the same check: `docker compose ps` shows `backend` as `healthy` or `unhealthy`.

## Logs

Every service writes its log to Docker. Nothing is written to log files inside the containers.

| Command | What you see |
|---|---|
| `docker compose logs -f backend` | The API: each request (gunicorn's access log), errors with their details, warnings such as a skipped e-mail alert, and the database changes applied at start. |
| `docker compose logs -f app` | The web app's server. |
| `docker compose logs -f app-edge` | The front server: every request with the visitor's address. |
| `docker compose logs -f db` | The database. |

Add `--since 1h` to see the last hour, or `--tail 200` for the last 200 lines. To see more detail from the API, set `LOG_LEVEL=DEBUG` in `backend/.env` and run `docker compose up -d`; set it back afterwards.

Docker keeps these logs on the server's disk. Watch free disk space: the database, the documents, the backups and the logs all grow.

Who did what inside the system is not in these logs. It is in the audit log; see [Audit and logging](14-audit-and-logging.md).

## Updating

1. Back up first:
   ```bash
   sh scripts/backup.sh /srv/erp-backups
   ```
2. Get the new version:
   ```bash
   git pull
   ```
3. Rebuild and restart:
   ```bash
   docker compose up -d --build
   ```
   The API applies database changes when it starts.
4. Check:
   ```bash
   docker compose ps
   ```
   `backend` should become `healthy`. Then sign in and open a few pages.

If the new version does not start, read `docker compose logs backend`. To go back: check out the previous version, rebuild, and restore the backup from step 1.

Compare `backend/.env.example` and `.env.docker.example` with your own files after each update. A new setting appears there first.

## Stopping and starting

| Command | Effect |
|---|---|
| `docker compose stop` | Stops the services. Data is kept. |
| `docker compose start` | Starts them again. |
| `docker compose restart backend` | Restarts one service. |
| `docker compose up -d` | Starts the system, and applies changed settings. |
| `docker compose down` | Stops and removes the containers. The two data volumes are kept. |

**Never add `-v` to `docker compose down` on a live system.** `docker compose down -v` deletes the `pgdata` and `media` volumes: every record and every uploaded file.

All services restart by themselves after a crash or a server reboot (`restart: unless-stopped`), unless you stopped them yourself.

## Scheduled jobs

**For administrators.** Nothing in the system runs on a timer by itself. The jobs below are commands. Each runs only when someone, or the server's scheduler, runs it.

| Command | What it does | Changes data? |
|---|---|---|
| `python manage.py send_daily_report` | E-mails today's production summary with an Excel file to `MANAGEMENT_EMAIL`. Then checks chemical stock and e-mails a low-stock alert when any chemical is below 25% of its total. | No |
| `python manage.py send_monthly_report` | E-mails last calendar month's sales summary with an Excel file. | No |
| `python manage.py send_alert_digest` | E-mails one digest of the open items of every notification rule marked for e-mail. Prints "Nothing to report; nothing sent." when there are none, and "MANAGEMENT_EMAIL is not set; nothing sent." when no address is set. | No |
| `python manage.py reconcile_inventory` | Compares the sellable stock ledger with its source records and prints three lists: lots where they differ, lots with negative stock, and lots with more reserved than on hand. | No |
| `python manage.py reconcile_inventory --fix` | The same, and re-syncs the ledger with drying sessions, dispatches and returns when a difference was found. | Yes, the ledger |
| `python manage.py customer_duplicates` | Lists customers with similar names for a person to review. Optional: `--threshold 0.85`. | No |

In Docker, put `docker compose exec -T backend` in front. Example cron lines (adjust the folder):

```
0 18 * * *  cd /srv/erp && docker compose exec -T backend python manage.py send_daily_report
0 8 1 * *   cd /srv/erp && docker compose exec -T backend python manage.py send_monthly_report
30 7 * * *  cd /srv/erp && docker compose exec -T backend python manage.py send_alert_digest
0 3 * * 0   cd /srv/erp && docker compose exec -T backend python manage.py reconcile_inventory
```

The three e-mail commands need a mailbox and `MANAGEMENT_EMAIL` in `backend/.env`. Which rules go into the digest is set on screen; see [Approvals and notifications](07-modules/approvals-and-notifications.md).

Some e-mails do not need a schedule. They are sent when the event happens: an order completed, an order dispatched, a payment received, a chemical dropping below 25%. See [Configuration](11-configuration.md).

**For developers.** The commands are in `backend/apps/notifications/management/commands/`, `backend/apps/alerts/management/commands/`, `backend/apps/inventory/management/commands/` and `backend/apps/sales/management/commands/`.

## Running without Docker (development)

**For developers.** You need Python 3.13, Node 24 and either PostgreSQL or the SQLite option.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows. On macOS or Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # Windows. On macOS or Linux: cp .env.example .env
```

Edit `backend/.env`:

- `SECRET_KEY`: any long string.
- The `DB_*` lines for your PostgreSQL. Or set `DB_ENGINE=sqlite` to use a local file, `backend/db.sqlite3`. SQLite is for local work and tests only.
- `NUM_PROXIES=1`, so the sign-in limit sees each user's own address through the web app.
- Leave `EMAIL_HOST_USER` empty, so e-mails are printed in the console and not sent.

Then:

```bash
python manage.py migrate
python setup_fresh.py             # creates Test_User with the Admin role and prints its password
python manage.py runserver        # http://127.0.0.1:8000
```

With `DEBUG=True` the API documentation is open at `http://127.0.0.1:8000/api/docs/`.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env.local      # Windows. On macOS or Linux: cp .env.example .env.local
npm run dev -- -p 3001            # http://localhost:3001
```

`frontend/.env.local` holds `DJANGO_API_URL` (default `http://127.0.0.1:8000/api/v1/`) and `SECURE_COOKIES=false`.

To run the production build locally: `npm run build`, then `npx next start -p 3001`.

How to run the tests and checks is in [Maintenance and changes](17-maintenance-and-changes.md).

## Demo data

**Do not run any `seed_*` command on a database with real data. They delete records.** They exist for demonstrations, training and tests.

| Command | What it does | What it deletes first |
|---|---|---|
| `python manage.py seed_demo_data` | Creates demo history from April 2024 to today across warehouse, sorting, decolorization, sales, purchasing, quality and production. Creates the demo users. | Deliveries, lots, sessions, chemicals, tanks, recipes, sales and purchasing records, customers, products, suppliers, factory units, inspections, standards, production orders, the stock ledger, the four demo supervisor users, and everything `seed_module_data` covers. With `--keep` it deletes nothing and only adds what is missing. |
| `python manage.py seed_drying_data` | Adds dryers and drying sessions linked to the existing decolorization sessions. Creates `drying_user` if missing. | Nothing |
| `python manage.py seed_module_data` | Adds demo records for purchasing, finance, maintenance, workforce, sustainability and documents. Run it last. | All purchasing records, journal entries, expenses, periods, tax rates, machines, schedules, work orders, spare parts, employees and all workforce records, and every document with its files and categories (the default categories are put back). |
| `python manage.py seed_demo_2days` | A small two-day demo. Creates its own demo users. | With `--flush`: operational records, much like `seed_demo_data`. |

The usual order for a demo database:

```bash
python manage.py seed_demo_data
python manage.py seed_drying_data
python manage.py seed_module_data
```

In Docker, put `docker compose exec backend` in front of each.

Demo logins after `seed_demo_data` (they are demo accounts; never leave them on a live system):

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@1234` | Admin (created only when no admin exists yet) |
| `warehouse_user` | `Demo@1234` | Warehouse Supervisor |
| `sorting_user` | `Demo@1234` | Sorting Supervisor |
| `decolor_user` | `Demo@1234` | Decolorization Supervisor |
| `drying_user` | `Demo@1234` | Drying Supervisor |

Notes:

- The seed commands do not send e-mail. Alert e-mails raised while seeding are kept in memory (`SeedCommand` in `backend/apps/core/management/base.py`).
- The demo history sells more than it dries, so the seed adds a stock adjustment to each lot with the note "Demo opening stock".
- The seed commands print symbols. On a Windows console, set `PYTHONIOENCODING=utf-8` first if they fail with an encoding error.

## What this system does not do

So that nobody relies on something that is not there:

- No built-in timer. Scheduled jobs need the server's scheduler.
- No password-reset e-mail and no two-step sign-in. An admin sets a new password under **Users**.
- No HTTPS by itself. It needs an HTTPS server in front.
- Uploaded files are checked for type and size. They are not scanned for viruses.
- The backup script does not copy backups off the server and does not back up the settings files.

## Keeping this page up to date

- Revise the first-start, stop and update sections when `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` or `backend/setup_fresh.py` change.
- Revise the backup and restore sections when `scripts/backup.sh` or `scripts/restore.sh` change. Quote their messages exactly.
- Revise "Scheduled jobs" and "Demo data" when a file is added or changed under `backend/apps/*/management/commands/`, or when a `demo.py` changes what it deletes.
- Revise "Health check" when `backend/apps/core/health.py` changes, and "Logs" when `LOGGING` in `backend/config/settings.py` or the gunicorn command changes.
- Keep this page and `docs/DEPLOYMENT.md` in step, or replace that file with a link to this one.
