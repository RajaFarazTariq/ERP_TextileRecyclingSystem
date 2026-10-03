# Security

This page lists the security rules the system enforces and what an administrator must do to keep an installation safe. Each section says who it is for.

## On this page

- [Summary](#summary)
- [Signing in and sessions](#signing-in-and-sessions)
- [Passwords](#passwords)
- [Who can do what](#who-can-do-what)
- [Protection of the web app](#protection-of-the-web-app)
- [Uploaded files](#uploaded-files)
- [Secrets and settings](#secrets-and-settings)
- [What an administrator must do](#what-an-administrator-must-do)
- [What the system does not do](#what-the-system-does-not-do)
- [Keeping this page up to date](#keeping-this-page-up-to-date)

## Summary

| Area | Rule |
|---|---|
| Sign-in | Username or e-mail, plus password. Failed attempts are rate limited and logged. |
| Session | Kept in cookies the browser's scripts cannot read. Ends after 7 days without use, or at sign-out. |
| Access | Checked on the server for every request: page, level, duty, then the module's own rules. |
| Changes | Written to the audit log with who, when and what changed. |
| Files | Type and size checked on upload; served only after an access check. |
| Transport | HTTPS is switched on by settings; the installer must do this for any system reachable from outside. |

## Signing in and sessions

**For administrators**

- A user signs in with their username or e-mail address and their password.
- A wrong password and an unknown user give the same message: "Invalid username/email or password." This avoids telling an attacker which names exist.
- A deactivated account is refused: "This account is inactive. Contact your administrator."
- Sign-in attempts are limited to 10 per minute from one address (setting `LOGIN_RATE_LIMIT`).
- Every failed attempt is recorded in the audit log as "Login failed", with the name that was typed, the address and the browser.
- A session lasts as long as it is used. If the person does not use the system for 7 days, they must sign in again.
- **Log out** ends the session on the server too, so a copied session cannot be reused.
- Deactivating a user stops their access at their next request, even if they are signed in.

**For developers**

- Django issues JSON Web Tokens (`rest_framework_simplejwt`): an access token valid for 30 minutes (`ACCESS_TOKEN_MINUTES`) and a refresh token valid for 7 days. Refresh tokens rotate on every use and the old one is blacklisted (`ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`). Sign-out blacklists the refresh token.
- The browser never sees the tokens. The Next.js server stores them in `httpOnly`, `SameSite=Lax` cookies (`erp_access`, `erp_refresh`, `erp_user`) and adds the access token when it forwards a request to Django (`frontend/src/app/api/django/[...path]/route.ts`, `frontend/src/lib/server/session.ts`). See [Architecture](02-architecture.md).
- The cookies get the `Secure` flag when `SECURE_COOKIES=true`.

## Passwords

- Passwords are stored hashed by Django; nobody can read them, including administrators.
- A new password must pass Django's four validators: not too similar to the username or e-mail, at least 8 characters, not a common password, not only digits.
- Only an admin sets or resets a password (Users → edit the user → Password). There is no "forgot password" e-mail. See [Admin guide](06-admin-guide.md).
- Change the demo passwords before real use, or better, do not load the demo data on a live system.

## Who can do what

The full model is in [Access control](05-access-control.md). The security-relevant points:

- The server checks **every** API request. Hiding a menu entry or a button is only for convenience.
- Checks run in this order: signed in → the page (at View only for reading, Full for changing) → the duty, where the action needs one → the module's own business rules.
- Admin is the only role that can manage users, roles and access. The Users page cannot be given to anyone else.
- The last active admin cannot be deleted, deactivated or given another role.
- A user cannot change their own role or deactivate themselves.
- A user whose role no longer exists has no pages.

## Protection of the web app

**For developers**

| Protection | How |
|---|---|
| Cross-site request forgery | Session cookies are `SameSite=Lax`, and the Next.js proxy rejects any changing request whose `Origin` is not the site itself (`isSameOrigin` in `frontend/src/lib/server/session.ts`). |
| Token theft by script | Tokens are in `httpOnly` cookies only. |
| Clickjacking | `X_FRAME_OPTIONS = 'DENY'`. |
| Content sniffing | `SECURE_CONTENT_TYPE_NOSNIFF = True`. |
| HTTPS | `SECURE_COOKIES` and `CSRF_TRUSTED_ORIGINS` are set from the environment. `SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS` exist but do not fit the Docker layout: see [Deployment](12-deployment.md). `SECURE_PROXY_SSL_HEADER` trusts `X-Forwarded-Proto` from nginx. |
| Host header attacks | `ALLOWED_HOSTS` (plus `INTERNAL_HOSTS` for the Docker network). |
| Cross-origin API use | `CORS_ALLOWED_ORIGINS` lists the origins that may call the API directly. |
| SQL injection | All database access goes through the Django ORM. |
| API documentation | `/api/docs/` is open only when `DEBUG` is on; otherwise it needs a staff sign-in at `/admin/`. |
| Error details | With `DEBUG=False`, an unexpected error returns a plain error response, not a stack trace. Refusals use one format, set in `backend/apps/core/exceptions.py`. |
| Request size | nginx limits a request to 20 MB (`client_max_body_size` in `frontend/nginx.edge.conf`). |

## Uploaded files

Documents are the only uploads. See [Documents](07-modules/documents.md).

- Only these types are accepted: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt.
- The size limit is 10 MB by default (`DOCUMENT_MAX_UPLOAD_MB`).
- The file's first bytes must match its extension. A program renamed to `.pdf` is refused.
- Files are stored outside the web root (`MEDIA_ROOT`) and are never served directly. A download goes through the API, which first checks the page, and that the document's category is open to the user's role.
- Each stored version keeps a SHA-256 checksum.

## Secrets and settings

**For administrators and developers**

- Secrets live in environment files that are **not** in the code repository: `backend/.env` for development, `.env.docker` for Docker. The repository holds only examples (`backend/.env.example`, `.env.docker.example`).
- The secrets are: `SECRET_KEY`, the database password, and the e-mail account password.
- `SECRET_KEY` has no default. The server does not start without it.
- `DEBUG` is off unless it is switched on. Never run a live system with `DEBUG=True`.
- All settings are listed in [Configuration](11-configuration.md).

## What an administrator must do

1. Use a long random `SECRET_KEY` and a strong database password that are used nowhere else.
2. Keep `DEBUG=False`.
3. Serve the system over HTTPS if it can be reached from outside the building, and then set `SECURE_COOKIES=true`. Do the redirect to HTTPS and HSTS on the HTTPS server in front, not with the API's own settings. Steps and the reason are in [Deployment](12-deployment.md).
4. Set `ALLOWED_HOSTS` to the real address of the system.
5. Give each person their own account. Do not share accounts: the audit log is only useful when a name means one person.
6. Keep at least two active admins, and no more admins than needed.
7. Deactivate an account the day someone leaves.
8. Review **Users → Access** when jobs change, and look at the audit log for "Login failed" entries now and then.
9. Take backups and test a restore. See [Deployment](12-deployment.md).
10. Keep the environment files and the backups where only trusted people can read them.

## What the system does not do

These are not built. Plan around them.

- No two-step sign-in (one-time codes).
- No self-service password reset by e-mail.
- No forced password change after a period, and no account lock after repeated failures (attempts are rate limited and logged instead).
- No single sign-on with other systems.
- No virus scan of uploaded files (only type, size and content-signature checks).
- No encryption of the database or of stored files by the application itself. Use disk encryption on the server if you need it.
- No limit on sign-in by address or by time of day.

## Keeping this page up to date

- `backend/config/settings.py`: token lifetimes, throttling, password validators, security headers.
- `backend/apps/users/views.py`: sign-in messages, failed-login logging, the safeguards on admins.
- `frontend/src/lib/server/session.ts` and `frontend/src/app/api/django/[...path]/route.ts`: cookies and the same-origin check.
- `backend/apps/documents/services.py`: allowed file types and content checks.
- `frontend/nginx.edge.conf`: request size and which paths reach Django directly.
