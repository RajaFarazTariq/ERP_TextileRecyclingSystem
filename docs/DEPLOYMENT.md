# Going live

How to put the ERP on a server, keep it safe, back it up and update it. It assumes the Docker setup in this repository (`docker-compose.yml`).

## 1. What runs

| Part | What it is |
|---|---|
| `db` | PostgreSQL 16. Data is kept in the `pgdata` volume. |
| `backend` | Django API (gunicorn). Uploaded documents are kept in the `media` volume. |
| `app` | The web app (Next.js). |
| `app-edge` | nginx in front. The only part that listens on a port (`APP_PORT`, default 8080). |

## 2. Before the first start

1. Install Docker and Docker Compose on the server.
2. Copy the project to the server.
3. Create `backend/.env` from `backend/.env.example` and set:
   - `SECRET_KEY`: a long random string. Never reuse the development one.
   - `DEBUG=False`
   - `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `MANAGEMENT_EMAIL` if alert e-mails should be sent. Leave `EMAIL_HOST_USER` empty to send none.
4. Create `.env` next to `docker-compose.yml` from `.env.docker.example` and set:
   - `POSTGRES_PASSWORD`: a strong password.
   - `ALLOWED_HOSTS`: the server's name, for example `erp.example.com`.
   - `CSRF_TRUSTED_ORIGINS`: the full address people will use, for example `https://erp.example.com`.
   - `APP_PORT`: the port nginx listens on.
5. Start it:
   ```bash
   docker compose up -d --build
   docker compose exec backend python setup_fresh.py     # first time only: creates the first admin
   ```
6. Log in, change the first admin's password, and create the real users under **Users**.

Do not run the `seed_*` commands on a live system. They are for demos and they wipe data.

## 3. HTTPS

Serve the site over HTTPS. The usual way is a reverse proxy in front of `app-edge` (for example Caddy, nginx with certbot, or the hosting provider's load balancer) that holds the certificate and forwards to `APP_PORT`.

Once HTTPS works, switch these on:

| File | Setting |
|---|---|
| `.env` | `SECURE_COOKIES=true` |
| `backend/.env` | `SECURE_COOKIES=True`, `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000` |

Set `SECURE_HSTS_SECONDS` only when you are sure the site will stay on HTTPS: browsers remember it.

## 4. Checklist before real use

- [ ] `DEBUG=False` and a new `SECRET_KEY`.
- [ ] A strong `POSTGRES_PASSWORD`.
- [ ] HTTPS on, and the three settings above switched on.
- [ ] The first admin's password changed; demo users not present.
- [ ] Every person has their own login with the right role, and Users → Access shows the pages each role should have.
- [ ] At least two people are admins, so access can still be managed if one is away.
- [ ] A backup has been taken **and restored once on a test machine** (section 5).
- [ ] The backup folder is copied off the server every night.
- [ ] `https://<your address>/api/health/` answers `{"status": "ok"}` and something checks it (section 6).
- [ ] Only the web port is open to the network. The database port is not published by the compose file; keep it that way.
- [ ] If Gmail is used for alerts, the app password is one made for this system. The one that was once in the Git history should be revoked.

## 5. Backups

Two things hold data: the database and the uploaded documents.

```bash
sh scripts/backup.sh /srv/erp-backups        # writes erp-db-<date>.sql.gz and erp-media-<date>.tar.gz
```

- It keeps the newest 14 of each (`KEEP=30 sh scripts/backup.sh ...` to keep more).
- Run it every night with cron, for example at 02:00:
  ```
  0 2 * * * cd /srv/erp && sh scripts/backup.sh /srv/erp-backups >> /var/log/erp-backup.log 2>&1
  ```
- Copy the backup folder to another machine or to cloud storage. A backup on the same disk does not protect against losing the server.

### Restoring

```bash
sh scripts/restore.sh /srv/erp-backups/erp-db-20261002-020000.sql.gz /srv/erp-backups/erp-media-20261002-020000.tar.gz
```

This replaces the current database and files, so it asks you to type `restore` first. After it finishes, open the site and check a few recent records.

**Do a restore drill** on a test machine before going live, and again every few months. A backup that has never been restored is only a hope.

## 6. Watching it

- **Health:** `GET /api/health/` returns 200 when the app can reach its database and 503 when it can't. Point an uptime monitor at it. Docker also uses it: `docker compose ps` shows the backend as `healthy` or `unhealthy`.
- **Logs:** `docker compose logs -f backend` (API and errors), `docker compose logs -f app`, `docker compose logs -f app-edge` (who requested what).
- **Disk:** watch free space; the database, the documents and the backups all grow.
- **Inside the app:** the bell shows alerts, **Approvals** shows what is waiting for a decision, and **Reports → Audit log** shows who changed what.

## 7. Updating

```bash
sh scripts/backup.sh /srv/erp-backups        # always back up first
git pull
docker compose up -d --build                 # rebuilds and applies database changes on start
docker compose ps                            # backend should become healthy
```

If the new version does not start, look at `docker compose logs backend`. To go back: check out the previous version, rebuild, and restore the backup taken before the update (a newer database does not always work with older code).

## 8. Scheduled jobs

Nothing runs on a timer by itself. If you want them, add cron lines on the server:

```
0 18 * * *  cd /srv/erp && docker compose exec -T backend python manage.py send_daily_report
0 8 1 * *   cd /srv/erp && docker compose exec -T backend python manage.py send_monthly_report
30 7 * * *  cd /srv/erp && docker compose exec -T backend python manage.py send_alert_digest
0 3 * * 0   cd /srv/erp && docker compose exec -T backend python manage.py reconcile_inventory
```

They send to `MANAGEMENT_EMAIL`. `reconcile_inventory` only reports; it changes nothing unless run with `--fix`.

## 9. What this system does not do

So nobody relies on something that is not there:

- No two-factor login and no password-reset e-mails; an admin resets passwords under **Users**.
- Uploaded files are checked for type and size but are not virus-scanned.
- Finance supports the business's own bookkeeping. It is not a certified statutory accounting or tax system.
- Sustainability figures are calculated from the factory's records. No environmental certification is implied.
- One factory and one stock location. No multi-warehouse transfers, barcode scanning or AI features.
