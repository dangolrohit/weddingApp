# Wedding Photo Delivery Platform

A private, self-hosted, production-ready photo delivery and portfolio platform built specifically for wedding photographers. Upload high-resolution client photos, showcase a curated public portfolio (maximum 3 watermarked photos per client), allow couples to securely preview their galleries with smart name & passkey verification, and deliver full-resolution images via multi-part uncompressed ZIP links valid for 7 days.

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [Architecture & Data Flow](#architecture--data-flow)
- [Project Phases (0–9 Complete)](#project-phases-09-complete)
- [Quickstart (Docker Compose)](#quickstart-docker-compose)
- [Production Deployment (Coolify & Cloudflare)](#production-deployment-coolify--cloudflare)
- [Security Hardening](#security-hardening)
- [Disaster Recovery & Backups](#disaster-recovery--backups)
- [Health Monitoring (Uptime Kuma)](#health-monitoring-uptime-kuma)
- [Automated Testing](#automated-testing)
- [Directory Structure](#directory-structure)

---

## Tech Stack

- **Backend**: Python 3.11, Django 5, Django REST Framework, SimpleJWT, Celery, Redis, Pillow / pyvips
- **Database**: PostgreSQL 16
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Headless UI
- **Gateway & Streaming**: Nginx reverse proxy with `X-Accel-Redirect` for internal-only file delivery
- **Deployment**: Docker Compose, Coolify-ready, Zero exposed host ports via Cloudflare Tunnel

---

## Architecture & Data Flow

```
Visitor / Client / Admin (HTTPS via Cloudflare Tunnel)
                    │
                    ▼
          Nginx Gateway (:80)
   ├── /                  ──> Frontend (React SPA on Nginx)
   ├── /api/              ──> Backend API (Django + Gunicorn :8000)
   ├── /files/            ──> Backend Auth Validation ──> Nginx X-Accel-Redirect
   └── /protected/        ──> Internal alias to /media/ (never publicly routable)
                    │
   PostgreSQL 16 (Relational data) + Redis (Celery task queue & rate limiting)
                    │
   Celery Worker (Concurrency 2: 400px thumbs, 1600px previews, watermarks, ZIP partitioning)
   Celery Beat   (Daily cleanup: expired ZIP pruning, link invalidation, storage recalculation)
```

---

## Project Phases (0–9 Complete)

| Phase | Description | Status |
|---|---|---|
| **Phase 0: Planning & Architecture** | Single-source PRD specification, database schema, and data flows. | ✅ Complete |
| **Phase 1: Foundation & Infrastructure** | Docker Compose orchestration, PostgreSQL 16, Redis, Celery, User model, JWT auth. | ✅ Complete |
| **Phase 2: Admin Core** | Category taxonomy, Client CRUD, soft delete (30-day trash), passkey hasher, site settings. | ✅ Complete |
| **Phase 3: Photo Pipeline** | Multi-file upload dropzone, Celery variant generation, EXIF GPS stripping, watermark engine, protected streaming. | ✅ Complete |
| **Phase 4: Public Site & Showcase** | Responsive portfolio UI, category filtering, lightbox, max 3 photos per client, inquiry form. | ✅ Complete |
| **Phase 5: Get My Image** | Name normalization, constant-time passkey verification, rate limiting, session-gated previews. | ✅ Complete |
| **Phase 6: Delivery & ZIP Packaging** | Multi-part uncompressed ZIP bundler (1.5 GB chunks), tokenized 7-day download portal, Celery Beat pruning. | ✅ Complete |
| **Phase 7: Dashboard & Storage** | Admin analytics dashboard, host disk quota tracking (80% warning banner), manual recalculation & cache clearing. | ✅ Complete |
| **Phase 8: Hardening & Testing** | Path traversal mitigations, HTTP security headers, 1,000-photo load benchmarks, automated backup & restore scripts. | ✅ Complete |
| **Phase 9: Production Launch** | Coolify deployment configuration, zero-open-port Cloudflare Tunnel guide, deep health checks, and monitoring. | ✅ Complete |

---

## Quickstart (Docker Compose)

### 1. Configure Environment
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
```bash
docker compose up -d --build
```

On first boot:
- PostgreSQL and Redis initialize and pass health checks.
- Django runs database migrations automatically.
- Static assets are collected.
- Default administrator account is seeded automatically from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Frontend compiles into production static assets.
- Nginx gateway begins proxying traffic.

### 3. Access the Application
- **Public Site**: [http://localhost](http://localhost)
- **Admin Portal**: [http://localhost/admin/login](http://localhost/admin/login)
  - Default Email: `admin@weddingstudio.com`
  - Default Password: `AdminSecurePassword123!`
- **Health Check API**: [http://localhost/api/health](http://localhost/api/health)

---

## Production Deployment (Coolify & Cloudflare)

### Coolify Setup
1. In Coolify, create a new project and select **Docker Compose**.
2. Connect your Git repository (branch `main`).
3. Set the Environment Variables under the Coolify application settings matching `.env.example`.
4. Ensure `HOST_MEDIA_PATH` points to your dedicated persistent photo drive (e.g. `/mnt/photos` or `/home/user/wedding_media`).
5. Coolify will manage container lifecycle, automatically utilizing docker health checks (`db`, `redis`, `backend`, `worker`, `beat`, `frontend`, `gateway`).

### Zero-Open-Port Security with Cloudflare Tunnel
For home-server deployments without static public IPs or open router ports:
1. Install `cloudflared` on the host:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```
2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create wedding-photos
   ```
3. Route your domain to the local Nginx gateway:
   ```yaml
   # ~/.cloudflared/config.yml
   tunnel: <TUNNEL_UUID>
   credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
   ingress:
     - hostname: photos.yourdomain.com
       service: http://localhost:80
     - service: http_status:404
   ```
4. Start the tunnel service:
   ```bash
   sudo cloudflared service install
   sudo systemctl start cloudflared
   ```
*Result*: All traffic is routed over an encrypted outbound tunnel with Cloudflare DDoS protection, automatic TLS/SSL, and zero open inbound firewall ports.

---

## Security Hardening

- **Path Traversal Protection**: All file-serving routes (`ProtectedFileServeView`, `PublicDownloadPartView`, `PublicBrandingView`) enforce strict filesystem boundary checks using Python's `pathlib.Path.resolve().is_relative_to(settings.MEDIA_ROOT)`. Requests containing `..` or pointing outside `MEDIA_ROOT` are rejected with HTTP 404.
- **Protected File Streaming**: Original client photos are stored in private volumes and are never exposed directly by web servers. Requests must pass Django authentication/session verification before receiving an internal `X-Accel-Redirect` header served via Nginx `/protected/`.
- **HTTP Security Headers**: Gateway responses enforce:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Brute Force Protection**: The `AccessAttempt` audit table records every "Get My Image" verification attempt. 5 failed attempts from any IP or client record triggers a 15-minute temporary lockout.
- **Constant-Time Passkey Verification**: Passkey matching uses `hmac.compare_digest` to prevent timing attacks.
- **Single-Email Lock**: Once a client submits their email address to request a download link, the client record is permanently bound to that email address. Only the photographer in the Admin Portal can re-assign or edit it.
- **Privacy & EXIF Scrubbing**: Derived variants (previews and thumbnails) have all EXIF metadata (specifically GPS coordinates and camera serial numbers) stripped to protect client privacy.

---

## Disaster Recovery & Backups

Two production-grade bash scripts are included in `scripts/`:

### Automated Backup (`scripts/backup.sh`)
- Creates a gzipped dump of the PostgreSQL database (`pg_dump | gzip`).
- Archives the media filesystem (`media_archive.tar.gz`), excluding temporary ZIP bundles.
- Automatically prunes backup archives older than 7 days.

Run manually or schedule via nightly cron:
```bash
# Add to crontab (runs every night at 2:00 AM)
0 2 * * * /bin/bash /path/to/weddingApp/scripts/backup.sh >> /var/log/wedding_backup.log 2>&1
```

### Complete Disaster Recovery (`scripts/restore.sh`)
Restores the database and media assets from any designated backup snapshot:
```bash
./scripts/restore.sh ./backups/20261106_120000
```
This script will:
1. Restore the PostgreSQL database schema and records.
2. Unpack the media files into `MEDIA_DIR`.
3. Apply any pending database migrations.
4. Trigger an immediate background storage quota recalculation.

---

## Health Monitoring (Uptime Kuma)

A comprehensive health check endpoint is provided at `/api/health`.

### Response Payload:
```json
{
  "status": "ok",
  "checks": {
    "database": true,
    "redis": true
  },
  "app": "wedding-photo-platform"
}
```
If either PostgreSQL or Redis connectivity drops, the endpoint returns `503 Service Unavailable` with `"status": "degraded"`.

### Uptime Kuma Setup:
1. Create a **HTTP(s) - Keyword Monitor** in Uptime Kuma.
2. URL: `https://photos.yourdomain.com/api/health`
3. Heartbeat: `60 seconds`
4. Keyword: `"status":"ok"`
5. Set alert notifications via Telegram, Discord, or Email.

---

## Automated Testing

The platform includes 44 automated backend unit, integration, security, and load tests:

### Run All Backend Tests
```bash
python backend/manage.py test tests
```

### Run Security Hardening Suite
Verifies path traversal resistance, cross-client isolation, and unauthorized file access:
```bash
python backend/manage.py test tests.test_security_hardening
```

### Run Load & Stress Suite
Verifies 1,000-photo client creation, sub-second pagination benchmarks, and multi-part 2.5 GB ZIP partitioning:
```bash
python backend/manage.py test tests.test_load_stress
```

### Build Frontend Production Assets
```bash
npm --prefix frontend run build
```

---

## Directory Structure

```
.
├── PRD.md                   # Single source of truth product specification
├── README.md                # Comprehensive documentation and runbook
├── docker-compose.yml       # Production Docker Compose orchestration
├── .env.example             # Template environment configuration
├── .gitignore
├── nginx/
│   └── nginx.conf           # Gateway reverse proxy with X-Accel-Redirect & security headers
├── scripts/
│   ├── backup.sh            # Nightly database dump & media archiver
│   └── restore.sh           # Disaster recovery restoration script
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh        # Startup script (db wait, migrate, collectstatic, admin seed)
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/              # Django settings, Celery, URLs, WSGI
│   ├── apps/
│   │   ├── core/            # Permissions, pagination, name normalization, hashing, activity logs
│   │   ├── accounts/        # Custom User, JWT login, admin password
│   │   ├── categories/      # Category taxonomy
│   │   ├── clients/         # Client galleries, passkeys, soft delete (30-day trash)
│   │   ├── photos/          # Photo upload, variants, watermark engine, protected streaming
│   │   ├── delivery/        # Get My Image verification, ZIP bundling (1.5GB parts), email links
│   │   ├── site_settings/   # Branding, watermark, delivery rules
│   │   ├── public_site/     # Public showcase endpoints & contact inquiry form
│   │   └── storage_stats/   # Disk quota calculation, variant breakdown, ZIP clearing
│   └── tests/               # 44 automated unit, security, and load test suites
└── frontend/
    ├── Dockerfile           # Multi-stage Vite build + Nginx static server
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── api/             # Axios client with JWT refresh interceptors
        ├── hooks/           # useAuth context hook
        ├── layouts/         # AdminLayout (sidebar) & PublicLayout
        ├── pages/           # Admin, public showcase, and delivery download views
        └── routes/          # App routing with ProtectedRoute
```
