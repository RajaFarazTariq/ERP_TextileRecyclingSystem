# Documents

This guide covers the Documents page: uploading files, categories that decide who may see them, versions, downloads and expiry dates. It is for everyone who stores or looks up certificates, test reports, safety data sheets and other papers, and for administrators who set up the categories.

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

Documents is one place for the factory's files. Each document:

- belongs to a **category**, and the category decides which roles may see it;
- keeps every uploaded file as a **version**; older versions stay downloadable;
- may have an **expiry date**, so that expired and soon-to-expire papers stand out;
- may say which record it **belongs to** (a supplier, a purchase order, an employee and so on).

Files are never shown inside the browser. They are always downloaded, after a permission check.

## Who can use it

| Who | Starting access |
|---|---|
| Admin | Full. Sees every category and every document |
| Every supervisor | Full access to the page, but sees only the categories opened to their role |

Two things decide what a user sees: the **Documents page** (see [Access control](../05-access-control.md)) and the **category's list of roles** (set on the Categories tab).

| Action | Who may do it |
|---|---|
| See and download a document | Anyone with the Documents page whose role is on the document's category. Admins always |
| Upload a document | Anyone with the page at Full, into a category their role may see |
| Edit a document's details, add a new version | The person who uploaded it, or an Admin |
| Move a document to another category | Admin only |
| Delete a document | Admin only |
| Add, change or delete a category | Admin only |

No duty is involved. With the page at View only, a user can look, open the version list and download, but not upload or change.

**Starting categories and who sees them**

| Category | Roles (besides Admin) |
|---|---|
| Supplier documents | Warehouse Supervisor |
| Purchase documents | Warehouse Supervisor |
| Production batch documents | All four supervisors |
| Quality certificates | All four supervisors |
| Material test reports | All four supervisors |
| Safety data sheets | All four supervisors |
| Customer documents | Admin only |
| Invoices and delivery challans | Admin only |
| Employee documents | Admin only |

## Screens

The page is at `/documents`. It has four tabs. The top-right button is **Upload document** on the first three tabs (when the user can see at least one category that is in use) and **New category** on the Categories tab (Admin only).

### Dashboard

| Card | Shows |
|---|---|
| Documents | Number of documents the user can see, and how many categories they are in |
| Expiring soon | Documents expiring within 30 days |
| Expired | Documents past their expiry date |
| Added, this month | Documents added this month; the hint counts those without an expiry date |

Two lists:

- **Expires next**: up to eight expired or soon-to-expire documents, soonest first, each with a **Download** button.
- **By category**: the number of documents in each category the user can see.

### Documents

Columns: Document (title, number and reference number), Category, Belongs to, File (name, version, size), Expires (with "in 12 days" or "5 days ago"), Status, Uploaded by.

Filters: category and status. Search covers the title, number, file name and linked record. **Export** downloads the list as CSV.

| Row action | Shown when |
|---|---|
| Download | Always. Downloads the current version |
| New version | The user uploaded the document, or is an Admin |
| Versions | Always. Opens a side sheet with every version, who uploaded it, when, the note, and a **Download** button for each |
| Edit details | The user uploaded the document, or is an Admin |
| Delete | Admin only |

### Expiring

The same table, holding only documents that have expired or expire within 30 days, soonest first.

### Categories

Columns: Category (with its description), Who can see it ("Admin only", "All roles", or the list), Documents, Status (In use / Not in use).

Row actions (Admin only): **Edit**, **Delete**. A user who is not an Admin sees only the categories opened to their role.

## Records and fields

### Document

Number format: `DOC-00001`.

| Field | Meaning | Required | Rules |
|---|---|---|---|
| File | The file to store | Yes, when uploading | See [upload rules](#uploads) |
| Title | | Yes | Up to 200 characters |
| Category | Decides who can see it | Yes | Must be in use, and one the user's role may see. Only an Admin can change it later |
| Reference number | The number printed on the document, e.g. a certificate number | No | |
| Issued on | | No | |
| Expires on | Leave empty if it never expires | No | Not before the issue date |
| Linked to | The kind of record it belongs to: Supplier, Purchase order, Customer, Sales order, Invoice, Fabric lot, Production order, Inspection, Chemical, Employee, Machine or Other | No | |
| Record | The record's name or number, typed in | Yes, when "Linked to" is chosen | Free text, up to 200 characters |
| Description | | No | |
| Uploaded by | | Set by the system | |

The link to a record is a typed label. The system does not check that the record exists and does not make it a clickable link. The API also accepts a record id (`linked_id`); the form does not use it.

### Version

| Field | Meaning |
|---|---|
| Version | 1, 2, 3 … |
| File name | The name the file had when it was uploaded. Used only as the suggested name of a download |
| Type and size | The file's extension and size |
| What changed | An optional note, up to 255 characters |
| Uploaded by, uploaded at | |
| SHA-256 | A fingerprint of the file's content, kept so that a file can be checked later |

### Category

| Field | Meaning | Required | Rules |
|---|---|---|---|
| Name | | Yes | Unique |
| Description | | No | |
| Who can see it | Yes or No for each role except Admin, including roles an Admin has added | | Admins always see everything |
| Status | In use or Not in use | Yes | A category that is not in use keeps its documents but takes no new ones |

## Statuses

A document's status is worked out from its expiry date each time it is shown.

| Status | Meaning |
|---|---|
| No expiry | No expiry date |
| Valid | Expires more than 30 days from today |
| Expiring soon | Expires today or within the next 30 days |
| Expired | The expiry date has passed |

## How to

### Upload a document

1. Open **Documents** and press **Upload document**.
2. Choose the **File**. The hint under the field lists the allowed types and the size limit.
3. Type a **Title** and choose the **Category**. The category decides who can see the document.
4. Optionally fill in the reference number, the issue and expiry dates, and what the document belongs to.
5. Press **Upload**.

### Replace a file with a newer one

1. On the **Documents** tab, open the row's menu and choose **New version**.
2. Choose the file and say **What changed**.
3. Press **Upload**.

The new file becomes the current version. The old one stays in the version list.

If the paper was renewed, also choose **Edit details** and set the new **Expires on** date. Uploading a version does not change the expiry date.

### Get an older version

1. Choose **Versions** in the row's menu.
2. Press **Download** next to the version you want.

### Find what is about to expire

Open the **Expiring** tab, or look at **Expires next** on the Dashboard tab. Expiring documents also appear in the notification bell when the rule "documents expired or expiring" is on.

### Open a category to a role

**For administrators.**

1. Open the **Categories** tab.
2. Choose **Edit** on the category (or press **New category**).
3. Under **Who can see it**, set each role to Yes or No.
4. Press **Update** (or **Save**).

Taking a role off a category hides all of its documents from that role at once, including documents its own users uploaded.

### Move a document to another category

**For administrators.** Choose **Edit details** and change the **Category**. This changes who can see the document.

## Business rules

### Who sees what

| Rule | Message |
|---|---|
| A user sees a document only when their role is on its category. Admins see everything | |
| A document the user may not see answers "not found" everywhere: in lists, searches, filters, the version list and downloads | 404 |
| The dashboard figures and the category list count only what the user may see | |
| A new document must go into a category the user may see | "Choose a category you have access to." |
| A new document cannot go into a category that is not in use | "This category is no longer in use." |
| Only the uploader or an Admin can edit details or add a version | "Only an admin or the person who uploaded this document can change it." |
| Only an Admin can move a document to another category | "Only an admin can move a document to another category." |
| Only an Admin can delete a document | "Only an admin can delete documents." |
| Only Admins add, change or delete categories | "You do not have permission to perform this action." |
| A category can be opened only to roles that exist | "Unknown role: director." |
| A category that holds documents cannot be deleted | "This record cannot be deleted because other records depend on it: …" |

### Uploads

| Rule | Message |
|---|---|
| A file is required | "Choose a file to upload." |
| The file cannot be larger than the limit (10 MB unless changed) | "The file is too large. The limit is 10 MB." |
| The file cannot be empty | "The file is empty." |
| Allowed types: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt | "This type of file is not allowed. Allowed types: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx, csv, txt." |
| The content must match the type. A program renamed to `.pdf` is refused | "The content of this file is not a real .pdf file." |
| A new version is checked in the same way | |
| Editing a document's details never replaces its file. A file sent with an edit is ignored | |
| Deleting a document removes the stored files of all its versions | |

### Dates and links

| Rule | Message |
|---|---|
| The expiry date cannot be before the issue date | "The expiry date can't be before the issue date." |
| When "Linked to" is chosen, the record must be named | "Say which record this document belongs to." |
| Clearing "Linked to" clears the record too | |

### Downloads

- Every download is sent as an attachment, with headers that stop the browser from guessing another type. A text file can never be shown as a web page.
- The suggested file name is built from the original name, with unsafe characters replaced.
- Every download is written to the audit log (action Export), with the version and file name.
- If the stored file is missing, the answer is: "The file of this document is missing from storage."

## Related data

| Module | What happens |
|---|---|
| [Approvals and notifications](approvals-and-notifications.md) | The rule "documents expired or expiring" lists documents whose expiry date is within its number of days. Each user sees only documents in categories their role may see |
| [Dashboard and reports](dashboard-and-reports.md) | "Business at a glance" shows "Documents expired" and "Documents expiring" |
| [Search and traceability](search-and-traceability.md) | Documents can be found from the search box, limited to what the user may see |
| [Users](users.md) | Categories are opened to roles, including roles an Admin has added |

Documents does not read or change any other module's records. The "Belongs to" link is a label only.

## For developers

**Backend:** `backend/apps/documents`.

| File | Contents |
|---|---|
| `models.py` | `DocumentCategory` (`allowed_roles` as a JSON list of role keys), `Document`, `DocumentVersion`, `upload_path` (a generated name: `documents/<32 hex characters>.bin`), and a `post_delete` handler that removes the stored file once the deletion is committed |
| `services.py` | `visible_categories`, `visible_documents`, `may_change`, `check_category`, `status_of`, `filter_status`, `validate_upload` (size, extension, content check, SHA-256), `add_version`, `CONTENT_TYPES`, `DEFAULT_CATEGORIES`, `EXPIRING_DAYS = 30` |
| `serializers.py` | `DocumentSerializer` (with write-only `file` and `note`), `VersionSerializer`, `CategorySerializer` |
| `views.py` | `CategoryViewSet`, `DocumentViewSet` (with `versions`, `download`, `download_version`), `ExpiringView`, `DocumentSummaryView`, `send_file` |
| `migrations/0002_default_categories.py` | Creates the nine starting categories |
| `demo.py` | Demo documents for the `seed_module_data` command |
| `tests.py` | Uploads, access, downloads, versions, expiry |

How uploads are stored: under `MEDIA_ROOT/documents/` with a generated name. The name the user gave is never part of the path. Files are served only through the API. The content check reads the first bytes of the file (and, for `.docx` and `.xlsx`, looks inside the zip archive).

Settings: `MEDIA_ROOT` (where files are kept) and `DOCUMENT_MAX_UPLOAD_MB` (default 10). See [Configuration](../11-configuration.md). In Docker, `MEDIA_ROOT` must be on a volume or the files are lost when the container is replaced; see [Deployment](../12-deployment.md).

**Endpoints** (under `/api/v1/documents/`):

| Method and path | Purpose |
|---|---|
| `GET /categories/`, `GET /categories/{id}/` | Categories the user may see |
| `POST /categories/`, `PATCH, PUT, DELETE /categories/{id}/` | Admin only |
| `GET /documents/` | Documents the user may see. Filters: `category`, `status`, `linked_type`, `linked_id`, `search` |
| `POST /documents/` | Upload (multipart form): `file`, `title`, `category`, and optional `note`, `reference_number`, `issued_on`, `expires_on`, `linked_type`, `linked_id`, `linked_label`, `description` |
| `GET, PATCH /documents/{id}/` | Read, change details. No `PUT` |
| `DELETE /documents/{id}/` | Admin only |
| `GET /documents/{id}/versions/` | Version list |
| `POST /documents/{id}/versions/` | Upload the next version (multipart form): `file`, optional `note` |
| `GET /documents/{id}/download/` | Download the current version |
| `GET /documents/{id}/versions/{number}/download/` | Download an earlier version |
| `GET /expiring/?days=30` | Expired and soon-to-expire documents, soonest first (`days` up to 3650) |
| `GET /summary/` | Dashboard figures, plus `max_upload_mb` and `allowed_extensions` for the upload form |

**Frontend:** `frontend/src/features/documents/` (`documents-page.tsx`, `documents-forms.tsx`, `schemas.ts`). Route: `frontend/src/app/(app)/documents/page.tsx`. Types: `frontend/src/types/documents.ts`. Uploads use `upload()` in `schemas.ts` (a multipart `fetch`), because the shared `api()` helper sends JSON only. Downloads use `frontend/src/lib/download.ts`.

**Tests:** `backend/apps/documents/tests.py`.

**Browser scenario:** `frontend/e2e/documents.mjs`. A file is required → a wrong type is refused → a program renamed to `.pdf` is refused by the server → upload → new version → version list and download of an old version → download headers → Expiring tab → a category opened to one role → a sorting supervisor sees shared documents only and gets 404 for hidden ones → an Admin deletes.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| There is no **Upload document** button | The user sees no category that is in use, or holds the page at View only | An Admin opens a category to the role, or gives the page at Full |
| A supervisor cannot find a document | Its category is not open to their role | An Admin opens the category, or moves the document |
| "The content of this file is not a real .pdf file." | The file's content does not match its extension | Save the file again in the right format |
| "The file is too large." with no limit shown | The web server in front of the application refused the upload before the application saw it | Raise the web server's upload limit as well as `DOCUMENT_MAX_UPLOAD_MB` |
| "The file of this document is missing from storage." | The file is no longer under `MEDIA_ROOT` (for example the folder was not kept when the server was replaced) | Restore the folder from a backup |
| A renewed certificate still shows as Expired | A new version was uploaded but the expiry date was not changed | **Edit details** and set the new date |
| A category cannot be deleted | It still holds documents | Move or delete the documents, or set the category to Not in use |
| A supervisor cannot add a version to a colleague's document | Only the uploader or an Admin can change a document | Ask the uploader or an Admin |

## Keeping this page up to date

- `backend/apps/documents/models.py`, `services.py`, `serializers.py`, `views.py`, `urls.py`: records, access rules, upload checks, messages and endpoints.
- `backend/apps/documents/services.py` → `DEFAULT_CATEGORIES`, `CONTENT_TYPES`, `EXPIRING_DAYS`: the starting categories, the allowed file types and the 30-day window.
- `backend/config/settings.py`: `MEDIA_ROOT` and `DOCUMENT_MAX_UPLOAD_MB`.
- `frontend/src/features/documents/*`: tabs, columns, row actions, labels and client-side messages.
- `frontend/e2e/documents.mjs`: the browser scenario.
