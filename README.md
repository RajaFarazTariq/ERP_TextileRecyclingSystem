## Overview

ERP Textile Recycling System is a web-based application designed to streamline and digitize textile recycling operations. It provides a centralized platform to efficiently manage inventory, suppliers, customers, and production workflows.

## Features

- Inventory Management (raw materials and recycled products)
- Supplier and Customer Management
- Production Workflow Tracking
- Reporting and Data Insights
- User-friendly Interface
- Advanced analytics dashboard
- Role-based access control

## Tech Stack

- Backend: Python, Django 5.2, Django REST Framework, SimpleJWT
- Frontend: React (JavaScript, Tailwind CSS)
- Database: PostgreSQL
- Version Control: Git & GitHub

## Images of the ERP System

<img width="973" height="602" alt="image" src="https://github.com/user-attachments/assets/7800aa93-0c2c-4721-8c3b-fdd3616ac96a" />
<img width="1363" height="627" alt="image" src="https://github.com/user-attachments/assets/54d8b728-1f7d-458a-bf1f-569760336ed2" />
<img width="1366" height="633" alt="image" src="https://github.com/user-attachments/assets/21895139-0289-4f2f-ac8c-1afbe2390173" />
<img width="369" height="143" alt="image" src="https://github.com/user-attachments/assets/4573e7bf-a825-47a4-9d31-49ddabc667f1" />
<img width="391" height="139" alt="image" src="https://github.com/user-attachments/assets/08435ea0-31a2-43ff-a497-35d828bd454c" />
<img width="559" height="156" alt="image" src="https://github.com/user-attachments/assets/bc5a7598-d98d-46d2-bbc6-62126d74a08f" />
<img width="396" height="134" alt="image" src="https://github.com/user-attachments/assets/fa83321e-3e2d-4b74-bb76-dc7a871deb46" />
<img width="407" height="141" alt="image" src="https://github.com/user-attachments/assets/71632fa7-03bb-4f3b-9e54-a0319affb239" />
<img width="602" height="237" alt="image" src="https://github.com/user-attachments/assets/b5ff6cb0-1f1a-4f66-8c7a-7c3eece42c7c" />
<img width="1363" height="229" alt="image" src="https://github.com/user-attachments/assets/8a76f5c5-952c-4ec1-af0c-7ae4d8ea5036" />

## Project Structure

```
backend/
  config/                 Django project: settings, root URLs, WSGI/ASGI
  apps/
    core/                 Shared permissions (RBAC), filters, seed commands
    users/                Custom user model, login, user management
    warehouse/            Vendors, factory units, incoming stock
    sorting/              Fabric stock and sorting sessions
    decolorization/       Chemicals, tanks, issuances, sessions
    drying/               Dryers and drying sessions
    sales/                Orders, dispatch, payments
    reports/              Report data and Excel exports
    audit/                Audit log (model, ViewSet mixin, API)
    notifications/        Email alerts (signals) and scheduled reports
  manage.py
  setup_fresh.py          Creates a fresh database with a Test_User admin
  requirements.txt
  .env.example
frontend/
  src/
    config/access.js      Which roles can open which routes (router + sidebar)
    services/api.js       Axios client (base URL from REACT_APP_API_URL)
    context/              Auth and dark-mode state
    routes/               ProtectedRoute
    components/           layout/ (MainLayout, Sidebar), common/ (shared UI)
    features/<module>/    One folder per module page
    utils/, styles/       Shared formatters, form classes, global CSS
docs/                     Upgrade audit and roadmap
```

## Run with Docker (recommended)

Runs PostgreSQL, the API and the web app together. Requires Docker Desktop.

```bash
copy backend\.env.example backend\.env        # set SECRET_KEY (and email settings if wanted)
copy .env.docker.example .env                  # set POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec backend python setup_fresh.py   # first time: creates Test_User / Test@1234
```

Open http://localhost:8080. Database data is kept in the `pgdata` Docker volume.

## Installation (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env            # then fill in SECRET_KEY, DB_PASSWORD, email settings
python manage.py migrate
python manage.py runserver
```

All secrets and environment settings live in `backend/.env` (never committed). Leave `EMAIL_HOST_USER` empty to print alert emails to the console instead of sending them.

Optional:

```bash
python setup_fresh.py             # fresh database with only Test_User / Test@1234
python manage.py seed_demo_data   # demo data (alert emails are not sent while seeding)
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env            # REACT_APP_API_URL, defaults to http://127.0.0.1:8000/api/
npm start
```

### Tests

```bash
cd backend
python manage.py test apps
```

GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests against PostgreSQL and builds the frontend on every push to `main` or `upgrade/**` and on every pull request.

## Usage
- Frontend: http://localhost:3000/ (http://localhost:8080/ with Docker)
- API: http://127.0.0.1:8000/api/ (also available under the versioned prefix `/api/v1/`)
- API documentation (Swagger): http://127.0.0.1:8000/api/docs/ (open when `DEBUG=True`; otherwise log in at `/admin/` as a staff user first)
- Admin panel: http://127.0.0.1:8000/admin/

List endpoints return plain arrays; add `?page=1` or `?page_size=50` to get paginated results.
Sessions use short-lived access tokens that the frontend renews automatically; logging out revokes the session.

## Future Improvements
- See [docs/UPGRADE_AUDIT.md](docs/UPGRADE_AUDIT.md) for the upgrade roadmap.

## Author
Raja Faraz Tariq
