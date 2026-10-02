# Users

This guide covers user accounts: creating and editing them, signing in and out, passwords, activating and deactivating, deleting, and the safeguard that keeps at least one active Admin. It is for administrators. Page access, roles and duties are managed on the same page's Access tab and are explained in [Access control](../05-access-control.md).

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

A **user** is an account that can sign in. Each user has a username, an optional e-mail address, a password and exactly one **role**. The role decides which pages the user can open and what they may do there.

The Users page lets an Admin:

- add a user, change a user's details, role or password;
- deactivate a user (they can no longer sign in, but their history stays) and activate them again;
- delete a user who has recorded nothing;
- manage roles, page access, duties and per-person exceptions, on the **Access** tab.

Users are not employees. People who work in the factory but never sign in are kept in [Workforce](workforce.md).

## Who can use it

| Who | Access |
|---|---|
| Admin | Full |
| Everyone else | No access, and it cannot be given. The Users page is the one page only Admins can ever have |

This is fixed so that nobody else can give themselves more access.

Two things are open to every signed-in user, because other pages need them:

- the list of user names (it fills the "supervisor", "received by" and similar dropdowns);
- their own account's details and access.

How access works is explained in [Access control](../05-access-control.md).

## Screens

### Sign-in page

The page is at `/login`. It asks for **Username or email** and **Password** (with a button to show or hide it) and has one button, **Sign in**.

Anyone who opens a page without being signed in is sent here, and returned to the page they wanted after signing in.

### Signing out

**Sign out** is in the account menu at the top right of every page (under the user's name), in the menu at the foot of the sidebar (**Log out**), and in the search box (Ctrl+K → Sign out). The account menu also shows the user's role and lets them choose the Light, Dark or System theme.

### Users page → Users tab

The page is at `/users`. The top-right button is **Add user**.

At the top is one card per role with the number of users who have it. Below is the table, with search and **Export** (CSV):

| Column | Shows |
|---|---|
| Username | With a "you" mark on your own account |
| Email | |
| Role | The role's name |
| Status | Active or Inactive |
| Last login | How long ago, or "Never" |

| Row action | Shown when |
|---|---|
| Deactivate / Activate | On every account except your own |
| Edit | Always |
| Delete | On every account except your own |

### Users page → Access tab

The Access tab has four cards:

| Card | What it is for |
|---|---|
| Roles | The list of roles; add a role, rename or delete a role you added |
| Pages by role | Which pages each role can open, and at which level (No access, View only, Full) |
| Duties by role | Which roles may approve purchases, release quarantine, and so on |
| Exceptions for one person | Give one user a page their role lacks, or take one away |

These are explained in [Access control](../05-access-control.md).

## Records and fields

### User

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Username | The name the user signs in with | Yes | Unique. Up to 150 characters; letters, digits and `@ . + - _` |
| Email | Can also be used to sign in | No | Must be a valid address |
| Password | | Yes for a new user | See the password rules below. When editing, leave blank to keep the current password |
| Role | One of the roles on the Access tab | Yes | You cannot change your own role |
| Account active (can sign in) | | Yes | Ticked for a new user. You cannot untick it on your own account |
| Last login | | Set by the system | Updated at each sign-in |

Passwords are stored as one-way hashes. Nobody, including an Admin, can read a user's password.

## Statuses

| Status | Meaning | How it gets there |
|---|---|---|
| Active | Can sign in | Created with the box ticked; **Activate**; or the box ticked in the edit form |
| Inactive | Cannot sign in. Everything the user recorded stays as it is | **Deactivate**; or the box unticked in the edit form |

Deactivating also stops a session the user already has open: their next request is refused.

## How to

### Add a user

1. Open **Users** and press **Add user**.
2. Type the **Username** and, if you have it, the **Email**.
3. Type a **Password** of at least 8 characters that is not a common one.
4. Choose the **Role**.
5. Press **Create user**. Give the user their username and password.

### Change a user's password

1. On the **Users** tab choose **Edit** in the user's row menu.
2. Type the new **Password** and press **Update**.

There is no "forgot password" link and no screen where users change their own password. An Admin sets it for them, including for their own account.

### Change a user's role

1. Choose **Edit** in the user's row menu.
2. Choose the new **Role** and press **Update**.

The change applies to the next page the user opens. They do not need to sign in again.

### Stop someone from signing in

Choose **Deactivate** in the user's row menu. Use this, not Delete, for anyone who has recorded work.

### Let them back in

Choose **Activate** in the row menu.

### Delete a user

1. Choose **Delete** in the user's row menu and confirm.
2. If the user has recorded anything (deliveries, sessions, orders and so on), the delete is refused. Deactivate them instead.

### Hand the Admin role to someone else

1. Make the other user an Admin first (Edit → Role → Admin).
2. Then change your own account: ask the other Admin to change your role, because you cannot change your own.

### Create the first Admin on a new installation

**For administrators.** On the server, in the `backend` folder:

```
python manage.py createsuperuser
```

An account created this way gets the Admin role. On a demonstration system loaded with the demo data, the demo logins listed in the project's `README.md` exist instead (for example `admin`); change or remove them before real use. See [Deployment](../12-deployment.md).

## Business rules

### Signing in

| Rule | Message |
|---|---|
| Both fields are needed | "Enter your username or email." / "Enter your password." (the server answers "Username/email and password are required.") |
| The username or the e-mail address can be used; upper and lower case do not matter | |
| A wrong name or password | "Invalid username/email or password." |
| An inactive account | "This account is inactive. Contact your administrator." |
| At most 10 sign-in attempts a minute from one address (configurable) | "Too many sign-in attempts. Please wait a minute and try again." |
| Every sign-in is written to the audit log as LOGIN, and every failed attempt as LOGIN FAILED, with the name typed and the address it came from | |
| A session lasts 7 days from the last sign-in or renewal. It is renewed silently while the user keeps working | |
| Signing out ends the session on the server as well as in the browser | |
| A user's pages, levels and duties are read again on every page load and every minute, so a change made by an Admin reaches an open session without signing in again | |

### Accounts

| Rule | Message |
|---|---|
| Only an Admin creates users | "Only admins can create users." |
| Only an Admin changes or deletes users | "Only admins can update or delete users." |
| Only an Admin activates or deactivates | "Only admins can toggle user status." |
| A new user needs a password | "Set a password for the new user." |
| A new user needs a role | "Choose a role." |
| The role must be one of the roles on the Access tab | "Choose one of the roles under Users, Access." |
| The username must be unique | "A user with that username already exists." |
| A blank password when editing keeps the current one | |
| A password is never written to the audit log; a change shows as `***` | |

### Passwords

A password is refused when it:

| Reason | Message |
|---|---|
| Is shorter than 8 characters | "This password is too short. It must contain at least 8 characters." |
| Is a commonly used password | "This password is too common." |
| Is made of digits only | "This password is entirely numeric." |
| Is too much like the username or e-mail | "The password is too similar to the username." |

### Safeguards against locking everyone out

| Rule | Message |
|---|---|
| You cannot deactivate your own account | "You can't deactivate your own account." |
| You cannot change your own role | "You can't change your own role." |
| You cannot delete your own account | "You can't delete your own account." |
| The last active Admin cannot be deactivated, deleted or given another role | "This is the only active admin. Make another user an admin first." |
| An Admin always has every page in full and every duty; this cannot be reduced | |
| The Users page cannot be given to any other role | |

### Deleting and deactivating

| Rule | Message |
|---|---|
| A user who is named on other records cannot be deleted | "This record cannot be deleted because other records depend on it: …" |
| Deactivating does not remove anything the user recorded | |
| A deactivated user cannot sign in, and every request from a session they still have open is refused, because the server checks that the account is active on each request | |
| Deleting a user who is linked to an employee removes the link, not the employee | |

## Related data

| Module | What happens |
|---|---|
| [Access control](../05-access-control.md) | The user's role decides pages, levels and duties; exceptions can be set per user |
| Every module | Records name the user who created, approved or supervised them. That is why a user with history cannot be deleted |
| [Workforce](workforce.md) | An employee can be linked to a user account |
| [Documents](documents.md), [Approvals and notifications](approvals-and-notifications.md) | Document categories and notification rules are opened to roles |
| [Audit and logging](../14-audit-and-logging.md) | Sign-ins, failed sign-ins and every change to a user are logged |

## For developers

**Backend:** `backend/apps/users`.

| File | Contents |
|---|---|
| `models.py` | `CustomUser` (Django's `AbstractUser` plus `role`, the key of an `apps.access.Role`); `create_superuser` sets the role to `admin` |
| `serializers.py` | `RegisterSerializer`, `UserSerializer` (with `role_label`, `last_login_display`); both check the role exists |
| `views.py` | `LoginView` (throttle scope `login`), `LogoutView`, `RegisterView`, `UserListView`, `UserDetailView`, `ToggleActiveView`, and `_keep_one_admin` |
| `tests.py` | Roles, sign-in by name or e-mail, passwords, sign-in logging and rate limit, token rotation and sign-out, self-lockout |

Roles, page access and duties live in `backend/apps/access`.

**Endpoints** (under `/api/v1/users/`):

| Method and path | Purpose | Who |
|---|---|---|
| `POST /login/` | Body `{"username": "<name or e-mail>", "password": "…"}`. Returns `token` (`access`, `refresh`) and `user` (`id`, `username`, `email`, `role`, `role_label`, `duties`, `pages`, `levels`) | Anyone |
| `POST /logout/` | Body `{"refresh": "…"}`. Revokes the refresh token. Always answers 205 | Anyone holding the token |
| `POST /token/refresh/` | Exchange a refresh token for a new pair. The old refresh token stops working | Anyone holding the token |
| `POST /register/` | Create a user: `username`, `email`, `password`, `role`, `is_active` | Admin |
| `GET /list/` | Every user: `id`, `username`, `email`, `role`, `role_label`, `is_active`, `last_login`, `last_login_display` | Any signed-in user |
| `GET /detail/{id}/` | One user | Any signed-in user |
| `PATCH, PUT /detail/{id}/` | Change a user; `password` is optional | Admin |
| `DELETE /detail/{id}/` | Delete a user | Admin |
| `POST /toggle-active/{id}/` | Switch between active and inactive | Admin |

**How the session works**

- The browser never sees the tokens. The web application's own routes `frontend/src/app/api/auth/login`, `logout` and `me` talk to Django and keep the session in three httpOnly cookies: `erp_access` (30 minutes), `erp_refresh` (7 days) and `erp_user` (the user's role, pages, levels and duties).
- Every API call from the browser goes to `/api/django/…`, which attaches the access token and renews it with the refresh token when needed.
- The route guard `frontend/src/proxy.ts` sends visitors without a session to `/login` and users without a page to the home page. It asks Django for the user's current access on each page load.
- `useSession()` (`frontend/src/features/auth/use-session.ts`) re-reads `/api/auth/me` every minute and when the window gets focus.
- Refresh tokens rotate and the used one is blacklisted.

Settings: `LOGIN_RATE_LIMIT` (default `10/min`), `ACCESS_TOKEN_MINUTES` (default 30), `NUM_PROXIES`, `SECURE_COOKIES`. See [Configuration](../11-configuration.md) and [Security](../13-security.md).

**Frontend:** `frontend/src/features/users/` (`users-page.tsx`, `access-panel.tsx`, `roles-panel.tsx`) and `frontend/src/features/auth/` (`login-form.tsx`, `use-session.ts`, `use-page-access.ts`, `use-duty.ts`, `use-roles.ts`). Routes: `frontend/src/app/(app)/users/page.tsx` and `frontend/src/app/login`.

**Tests:** `backend/apps/users/tests.py` and `backend/apps/access/tests.py`.

**Browser scenarios:** `frontend/e2e/users.mjs` (role counts → your own account can only be edited → a new user needs a password → a weak password is refused → deactivate, and the user cannot sign in → activate, and the user signs in and sees their module → delete) and `frontend/e2e/access.mjs` (the Access tab).

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| "This account is inactive. Contact your administrator." | The account was deactivated | An Admin chooses **Activate** |
| "Too many sign-in attempts." | More than 10 attempts in a minute from one address | Wait a minute. If everyone behind one office address is affected, see `NUM_PROXIES` and `LOGIN_RATE_LIMIT` in [Configuration](../11-configuration.md) |
| A user forgot their password | There is no self-service reset | An Admin sets a new one with **Edit** |
| The only Admin forgot their password | Nobody can edit the account | On the server run `python manage.py changepassword <username>` |
| "This is the only active admin. Make another user an admin first." | The change would leave no active Admin | Make another user an Admin first |
| A user cannot be deleted | They are named on other records | **Deactivate** them |
| A user signs in but sees no pages | Their role has no pages, or exceptions took them away | Check the Access tab |
| A user is sent back to the home page when opening a page | They do not have that page | Give the page on the Access tab |
| A user is signed out although the session should last a week | The session cookie was dropped: the site is served over plain HTTP while `SECURE_COOKIES` is on, or the browser cleared its cookies | Serve the site over HTTPS, or set `SECURE_COOKIES=false` on a plain-HTTP network |
| A deactivated user still sees a page that was already open | The page was loaded before the account was deactivated | Nothing to fix: their next request is refused and nothing more can be read or saved |

## Keeping this page up to date

- `backend/apps/users/models.py`, `serializers.py`, `views.py`, `urls.py`: accounts, sign-in, the safeguards and their messages.
- `backend/config/settings.py`: password validators, token lifetimes, the sign-in rate limit.
- `frontend/src/features/users/users-page.tsx` and `frontend/src/features/auth/login-form.tsx`: the screens and their labels.
- `frontend/src/lib/server/session.ts`, `frontend/src/proxy.ts`, `frontend/src/app/api/auth/*`: how the session is kept.
- `backend/apps/access/*`: roles and access, described in [Access control](../05-access-control.md).
