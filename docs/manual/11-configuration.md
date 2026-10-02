# Configuration

This page lists every setting an operator can change without touching the code: what it is called, where it is set, its default, what it does and when to change it. It is for the administrator who installs and runs the system. A short section at the end is for developers.

## On this page

- [Where settings live](#where-settings-live)
- [Which file wins in Docker](#which-file-wins-in-docker)
- [Core settings](#core-settings)
- [Database](#database)
- [Security and sign-in](#security-and-sign-in)
- [E-mail](#e-mail)
- [Uploaded documents](#uploaded-documents)
- [Logging and server](#logging-and-server)
- [Web app](#web-app)
- [Front server (nginx)](#front-server-nginx)
- [Backup and restore scripts](#backup-and-restore-scripts)
- [Settings changed on screen](#settings-changed-on-screen)
- [Settings fixed in the code](#settings-fixed-in-the-code)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## Where settings live

**For administrators.** Settings are plain text lines of the form `NAME=value`. They live in up to three files. None of these files is in Git, because they hold secrets. Each has an example file to copy from.

| File | Copy it from | Used by | Holds |
|---|---|---|---|
| `backend/.env` | `backend/.env.example` | The API (Django) | The secret key, e-mail settings, security switches. Without Docker, also the database settings. |
| `.env` (next to `docker-compose.yml`) | `.env.docker.example` | Docker Compose | The database password, the site's address, the port. |
| `frontend/.env.local` | `frontend/.env.example` | The web app, when run without Docker | Where the API is, and the cookie switch. |

After changing a setting, restart the part that reads it. With Docker: `docker compose up -d` (it recreates the services whose settings changed).

Never share these files, and never put real values in the example files.

## Which file wins in Docker

**For administrators.** In the Docker setup, some API settings are set by `docker-compose.yml` itself. For those, the value in `backend/.env` is ignored.

| Setting | In Docker it comes from |
|---|---|
| `DEBUG`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` | The root `.env` (or the default written in `docker-compose.yml`) |
| `DB_PASSWORD` | `POSTGRES_PASSWORD` in the root `.env` |
| `DB_ENGINE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `NUM_PROXIES`, `INTERNAL_HOSTS` | Fixed in `docker-compose.yml` |
| Everything else in the tables below | `backend/.env` |

`SECURE_COOKIES` exists twice: the root `.env` sets it for the web app, and `backend/.env` sets it for the API. Set both.

## Core settings

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `SECRET_KEY` | `backend/.env` | None. The API does not start without it. | Signs sign-in tokens and cookies. | Set a long random string before the first start. Use a different one on every installation. Changing it later signs everyone out. |
| `DEBUG` | Docker: root `.env`. Otherwise `backend/.env`. | `False` | `True` shows detailed error pages and opens the API documentation to everyone. | Keep `False` on a live system. `True` only on a developer's machine. |
| `ALLOWED_HOSTS` | Docker: root `.env`. Otherwise `backend/.env`. | `localhost,127.0.0.1` | The host names the API answers to. Comma separated. | Add the name or address people type to reach the site, for example `erp.example.com`. |
| `INTERNAL_HOSTS` | `docker-compose.yml` | Empty. Docker sets `backend`. | Extra host names, added to `ALLOWED_HOSTS`, that other services use inside a private network. | Only if you rename the `backend` service. |
| `APP_PORT` | Root `.env` | `8080` | The port the front server listens on. | When 8080 is taken, or to use 80. |

## Database

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `POSTGRES_PASSWORD` | Root `.env` | `erp_local_password` | The password of the database in Docker. It is given to both the database and the API. | Always set a strong one before the first start. Changing it after the database has been created does not change the stored password; see [Deployment](12-deployment.md). |
| `DB_ENGINE` | `backend/.env` (without Docker) | `postgresql` | `sqlite` uses a local file `backend/db.sqlite3` instead. | `sqlite` only for local tests. |
| `DB_NAME` | `backend/.env` (without Docker) | `ERP_DB` | Database name. Docker uses `erp`. | To match your PostgreSQL. |
| `DB_USER` | `backend/.env` (without Docker) | `postgres` | Database user. Docker uses `erp`. | To match your PostgreSQL. |
| `DB_PASSWORD` | `backend/.env` (without Docker) | None. Required with PostgreSQL. | Database password. | To match your PostgreSQL. |
| `DB_HOST` | `backend/.env` (without Docker) | `localhost` | Database server. Docker uses `db`. | To match your PostgreSQL. |
| `DB_PORT` | `backend/.env` (without Docker) | `5432` | Database port. | To match your PostgreSQL. |

## Security and sign-in

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `SECURE_COOKIES` | Root `.env` and `backend/.env` (Docker). `frontend/.env.local` and `backend/.env` (without Docker). | `false` | Marks cookies as HTTPS only. For the web app these are the sign-in cookies. For the API these are the admin panel's cookies. | Set to `true` once the site is served over HTTPS. Leave `false` on plain HTTP (for example a factory network address), or browsers drop the sign-in cookie and nobody can sign in. |
| `CSRF_TRUSTED_ORIGINS` | Docker: root `.env`. Otherwise `backend/.env`. | Docker: `http://localhost:8080`. Otherwise empty. | The full addresses from which the admin panel accepts forms. Comma separated. | Set to the exact address people use, with `http://` or `https://` and the port if it is not the usual one. |
| `SECURE_SSL_REDIRECT` | `backend/.env` | `False` | Makes the API redirect every plain-HTTP request to HTTPS. | See the warning below before turning it on. |
| `SECURE_HSTS_SECONDS` | `backend/.env` | `0` | Tells browsers to use HTTPS only, for this many seconds. The API adds it only to answers it recognises as HTTPS. | See the warning below. |
| `LOGIN_RATE_LIMIT` | `backend/.env` | `10/min` | How many sign-in attempts one network address may make. Format: number, slash, `sec`, `min`, `hour` or `day`. | Lower it if you see password guessing. Raise it if many people share one address and get blocked. |
| `NUM_PROXIES` | `backend/.env` (without Docker). Docker sets `1`. | `0` | How many trusted servers stand in front of the API. With `1`, the sign-in limit counts the visitor's own address, not the web app's. | Set to `1` whenever the API is reached through the web app or nginx, which is the normal case. |
| `ACCESS_TOKEN_MINUTES` | `backend/.env` | `30` | How long an access token lasts before it is renewed in the background. | Rarely. The web app keeps its access cookie for 30 minutes whatever this is set to, so a larger value gives no benefit there. |
| `CORS_ALLOWED_ORIGINS` | `backend/.env` | `http://localhost:3000` | Web addresses whose pages may call the API directly from a browser. | Only if another browser application calls the API directly. The web app does not need it. |

**Warning about `SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS` in the Docker setup.** The API decides that a request is HTTPS by the header `X-Forwarded-Proto: https` (`SECURE_PROXY_SSL_HEADER` in `backend/config/settings.py`). In the Docker setup:

- the web app calls the API inside Docker over plain HTTP and does not send that header (`frontend/src/lib/server/forward.ts`);
- the Docker health check calls `http://localhost:8000/api/health/` the same way;
- the front server sets the header to its own scheme, which is `http`, because it listens on port 80 (`frontend/nginx.edge.conf`).

Reading the code, turning `SECURE_SSL_REDIRECT` on would therefore redirect those internal calls as well, and `SECURE_HSTS_SECONDS` would have no effect. The safe arrangement is to leave both at their defaults and let the HTTPS server in front of the system do the redirect to HTTPS and add the HSTS header. If you want to use these two settings, try them on a test machine first.

## E-mail

The system sends e-mail for alerts and scheduled reports. All of it goes to one address, `MANAGEMENT_EMAIL`. See [Approvals and notifications](07-modules/approvals-and-notifications.md).

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `EMAIL_HOST_USER` | `backend/.env` | Empty | The mailbox the system signs in to. When it is empty, e-mails are printed in the API's log and not sent. | Set it to send real e-mail. |
| `EMAIL_HOST_PASSWORD` | `backend/.env` | Empty | The password of that mailbox. With Gmail, an app password made for this system. | With `EMAIL_HOST_USER`. |
| `MANAGEMENT_EMAIL` | `backend/.env` | Empty | The address that receives every alert, the digest and the scheduled reports. When it is empty, alerts are skipped and the report commands fail with a message. | Set it to the person or group that should receive them. Leave empty to send nothing. |
| `EMAIL_HOST` | `backend/.env` | `smtp.gmail.com` | The mail server. | If you do not use Gmail. |
| `EMAIL_PORT` | `backend/.env` | `587` | The mail server's port. | If your mail server uses another. |
| `EMAIL_USE_TLS` | `backend/.env` | `True` | Encrypts the connection to the mail server. | If your mail server requires otherwise. |
| `DEFAULT_FROM_EMAIL` | `backend/.env` | `Textile ERP <EMAIL_HOST_USER>`, or `Textile ERP <noreply@localhost>` when no mailbox is set | The sender shown on e-mails. | To show another sender name or address. |
| `EMAIL_BACKEND` | `backend/.env` | SMTP when `EMAIL_HOST_USER` is set, otherwise the console | How e-mail is delivered. | For testing: `django.core.mail.backends.console.EmailBackend` prints e-mails to the log; `django.core.mail.backends.locmem.EmailBackend` keeps them in memory. |

Once a mailbox and `MANAGEMENT_EMAIL` are set, these e-mails are sent as things happen, without a schedule: a sales order becomes Completed, a dispatch becomes Dispatched, a customer payment is recorded, and a chemical first drops below 25% of its total stock. The digest and the daily and monthly reports are sent only when their command is run (see [Deployment](12-deployment.md)).

## Uploaded documents

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `MEDIA_ROOT` | `backend/.env` | `backend/media` (in Docker: `/app/media`, which is the `media` volume) | The folder where uploaded files are stored. | Without Docker, to store files on another disk. In Docker, leave it: the volume is mounted at `/app/media`. |
| `DOCUMENT_MAX_UPLOAD_MB` | `backend/.env` | `10` | The largest file that can be uploaded, in megabytes. | To allow larger files. The front server accepts at most 20 MB (see below), so raise that too if you go above 20. |

## Logging and server

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `LOG_LEVEL` | `backend/.env` | `INFO` | How much the API writes to its log: `DEBUG`, `INFO`, `WARNING`, `ERROR`. | `DEBUG` while investigating a problem; back to `INFO` afterwards. |
| `GUNICORN_WORKERS` | `backend/.env` (Docker) | `3` | How many API worker processes run. | Raise it on a server with more processor cores and many users. |

## Web app

| Name | Where | Default | What it does | When to change |
|---|---|---|---|---|
| `DJANGO_API_URL` | Docker: fixed in `docker-compose.yml` as `http://backend:8000/api/v1/`. Otherwise `frontend/.env.local`. | `http://127.0.0.1:8000/api/v1/` | Where the web app's server finds the API. The browser never uses this address. | Without Docker, when the API runs on another machine or port. |
| `SECURE_COOKIES` | Docker: root `.env`. Otherwise `frontend/.env.local`. | `false` | See [Security and sign-in](#security-and-sign-in). | With HTTPS. |

## Front server (nginx)

The front server's settings are in `frontend/nginx.edge.conf`. Changing them means editing that file and restarting the service: `docker compose restart app-edge`.

| Setting | Value | What it does | When to change |
|---|---|---|---|
| `listen` | `80` | The port inside the container. `APP_PORT` maps it to the outside. | Not needed; change `APP_PORT` instead. |
| `client_max_body_size` | `20m` | The largest request it accepts. This caps file uploads. | When `DOCUMENT_MAX_UPLOAD_MB` goes above 20. |
| `proxy_read_timeout` | `120s` | How long it waits for an answer from the web app or the API. | If long reports time out. |
| First `location` | `/admin/`, `/api/docs/`, `/api/schema/`, `/api/health/`, and the static files of the admin panel and the API pages | Sent to the API. | If you do not want the admin panel or the API documentation reachable from outside, remove them from this pattern. |
| Second `location` | `/` | Everything else is sent to the web app. | Not needed. |
| `X-Forwarded-For` | Set to the visitor's address | Lets the sign-in limit and the audit log see who is calling. It is overwritten, so a visitor cannot fake it. | Only if another proxy stands in front; then the address seen is that proxy's, unless you change this line to pass on the real one. |

## Backup and restore scripts

| Name | Used by | Default | What it does |
|---|---|---|---|
| First argument | `scripts/backup.sh` | `./backups` | The folder backups are written to. |
| `KEEP` | `scripts/backup.sh` | `14` | How many backups of each kind are kept. Older ones are deleted. |
| `YES` | `scripts/restore.sh` | `0` | `YES=1` skips the question "Type "restore" to continue". Use it only in scripts you trust. |

See [Deployment](12-deployment.md).

## Settings changed on screen

Some settings are records, changed in the web app by an admin, not in a file:

| Setting | Where on screen | Manual page |
|---|---|---|
| Roles, pages, levels, duties, per-person exceptions | **Users** → **Access** | [Access control](05-access-control.md) |
| Notification rules: on or off, thresholds, roles, e-mail digest, escalation | **Approvals** → **Rules** | [Approvals and notifications](07-modules/approvals-and-notifications.md) |
| Document categories and who may see them | **Documents** → **Categories** | [Documents](07-modules/documents.md) |
| Chart of accounts, periods, tax rates | **Finance** → **Accounts** and **Setup** | [Finance](07-modules/finance.md) |
| Process stages, routings, bills of materials | **Production** → **Setup** | [Production](07-modules/production.md) |
| Quality standards | **Quality** → **Standards** | [Quality](07-modules/quality.md) |
| Waste categories and targets | **Sustainability** → **Setup** | [Sustainability](07-modules/sustainability.md) |

## Settings fixed in the code

**For developers.** These values are not read from the environment. Changing one is a code change.

| Value | Where | Current value |
|---|---|---|
| Time zone | `TIME_ZONE` in `backend/config/settings.py` | `Asia/Karachi` |
| Language | `LANGUAGE_CODE` in settings | `en-us` |
| Refresh token lifetime | `SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']` in settings | 7 days |
| Cookie lifetimes | `ACCESS_MAX_AGE`, `REFRESH_MAX_AGE` in `frontend/src/lib/server/session.ts` | 30 minutes, 7 days |
| Cookie names | `COOKIE` in `session.ts`, and the same names in `frontend/src/proxy.ts` | `erp_access`, `erp_refresh`, `erp_user` |
| Password rules | `AUTH_PASSWORD_VALIDATORS` in settings | Django's four standard validators (not similar to the user's details, minimum length, not a common password, not only digits) |
| Default page size | `backend/apps/core/pagination.py` | 50, at most 500 |
| Audit page size and export limit | `backend/apps/audit/views.py` | 50, at most 200; export 500 rows |
| Allowed upload file types | `CONTENT_TYPES` in `backend/apps/documents/services.py` | pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt |
| "Expiring soon" window for documents | `EXPIRING_DAYS` in `backend/apps/documents/services.py` | 30 days |
| Low-chemical threshold of the instant e-mail alert | `CHEMICAL_LOW_PCT` in `backend/apps/notifications/tasks.py` | 25% |
| Session check interval in an open tab | `refetchInterval` in `frontend/src/features/auth/use-session.ts` | 60 seconds |
| Security headers on pages | `frontend/next.config.ts` | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

Settings are read with `config(...)` from python-decouple. An environment variable wins over a line in `backend/.env`.

## Keeping this page up to date

- Revise the tables when a `config('NAME', ...)` call is added, removed or given a new default in `backend/config/settings.py`.
- Revise them when `backend/.env.example`, `.env.docker.example` or `frontend/.env.example` change. Keep the example files and this page in step.
- Revise "Which file wins in Docker" when the `environment` blocks in `docker-compose.yml` change.
- Revise the nginx table when `frontend/nginx.edge.conf` changes, and the script table when `scripts/backup.sh` or `scripts/restore.sh` change.
