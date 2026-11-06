# Wedding Photo Delivery Platform

A private, self-hosted photo delivery and portfolio platform built for wedding photographers. Upload high-resolution client photos, display a curated watermarked showcase (max 3 per client) publicly, and let verified clients preview and download their photos via multi-part uncompressed ZIP links valid for 7 days.

---

## Tech Stack

- **Backend**: Python 3.11, Django 5, Django REST Framework, SimpleJWT, Celery, Redis, Pillow / pyvips
- **Database**: PostgreSQL 16
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Web & Gateway**: Nginx gateway with `X-Accel-Redirect` for protected file streaming
- **Deployment**: Docker Compose, Coolify-ready, no open host ports needed in production

---

## Architecture Overview

```
Visitor / Client / Admin
         │
         ▼
    nginx gateway (:80)
   ├── /                 ──> Frontend (React SPA on Nginx)
   ├── /api/             ──> Backend API (Django + Gunicorn :8000)
   ├── /files/           ──> Backend Auth Check ──> Nginx X-Accel-Redirect
   └── /protected/       ──> Internal alias to /media/ (never public)
         │
   PostgreSQL 16 (Structured data) + Redis (Celery queue & rate limiting)
         │
   Celery Worker (Concurrency 2: thumbnails, previews, watermarks, ZIP parts)
   Celery Beat (Daily cleanup, link expiration, storage recalculation)
```

---

## Quickstart (Docker Compose)

### 1. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

Review or customize values in `.env`:
- `ADMIN_NAME`: Initial admin display name (default: `"Studio Admin"`)
- `ADMIN_EMAIL`: Initial admin login email (default: `admin@weddingstudio.com`)
- `ADMIN_PASSWORD`: Initial admin password (default: `AdminSecurePassword123!`)
- `POSTGRES_PASSWORD`: Database password
- `GATEWAY_PORT`: HTTP port exposed on the host (default: `80`)

### 2. Start Services
Run Docker Compose to build and start all containers:
```bash
docker compose up -d --build
```

On first boot:
- PostgreSQL and Redis initialize and become healthy.
- Django applies migrations automatically.
- Static assets are collected.
- Default administrator account is seeded automatically from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Frontend compiles and serves through Nginx.
- Nginx gateway begins proxying traffic.

### 3. Access the Application
- **Public Site**: [http://localhost](http://localhost)
- **Admin Portal**: [http://localhost/admin/login](http://localhost/admin/login)
  - Email: `admin@weddingstudio.com`
  - Password: `AdminSecurePassword123!`
- **Health Check API**: [http://localhost/api/health](http://localhost/api/health)

---

## Running Backend Tests

To run the automated test suite inside the backend container:
```bash
docker compose exec backend python manage.py test tests
```

---

## Directory Structure

```
.
├── PRD.md                   # Single source of truth product specification
├── README.md                # Documentation and quickstart
├── docker-compose.yml       # Production/local multi-service compose file
├── .env.example             # Example environment configuration
├── .gitignore
├── nginx/
│   └── nginx.conf           # Gateway reverse proxy configuration
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh        # Startup script (wait-for-db, migrate, collectstatic, initadmin)
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/              # Django settings, Celery, URLs, WSGI
│   ├── apps/
│   │   ├── core/            # Permissions, pagination, name normalization, hashing
│   │   ├── accounts/        # Custom User, JWT login, admin password
│   │   ├── categories/      # Category taxonomy
│   │   ├── clients/         # Client galleries, passkeys, soft delete
│   │   ├── photos/          # Photo upload, variants, watermark pipeline
│   │   ├── delivery/        # Get My Image verification, ZIP bundling, email sending
│   │   ├── site_settings/   # Branding, watermark, delivery rules
│   │   ├── public_site/     # Showcase endpoints & inquiries
│   │   └── storage_stats/   # Disk quotas & recalculation
│   └── tests/               # Automated test suite
└── frontend/
    ├── Dockerfile           # Multi-stage Vite build + Nginx static server
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── api/             # Axios client with JWT refresh interceptors
        ├── hooks/           # useAuth context hook
        ├── layouts/         # AdminLayout (sidebar) & PublicLayout
        ├── pages/           # Admin, public, and delivery views
        └── routes/          # App routing with ProtectedRoute
```

