# PRD – Wedding Photo Delivery Platform

Version 2.0 · Product Requirements, Architecture, Database, Security and Project Plan

A private photo-delivery platform for one wedding photographer: the admin manages clients, photos, categories, storage and watermark settings; the public site shows three watermarked photos per client; and each client gets the full set through a 'Get my image' page that emails a ZIP link valid for 7 days.

## 1. Overview

### 1.1 Problem

A wedding photographer shoots thousands of photos per event, often 10 to 50 GB per wedding. Sharing them by WhatsApp, Drive or pen drive is slow, unbranded, hard to track and insecure. The photographer needs one place to store client photos, show the best work publicly, and hand each client their full set safely.

### 1.2 Vision

A branded website running on the photographer's own server. Photos are uploaded once, three watermarked samples per client feed the public portfolio, and clients unlock their own photos with their names and a passkey.

### 1.3 Goals

- One admin panel for clients, photos, categories, storage and settings.
- Public portfolio that shows only 3 watermarked photos per client.
- Clients preview their photos and receive a ZIP link by email, valid for 7 days.
- Admin can re-send a link in one click, to the saved email or a new one.
- Run on the photographer's laptop using its local disk (about 400 GB of photos on a 2 TB drive), with no paid storage.
- Stay portable: the app can later move to a bigger server or S3-style storage without a rewrite.

### 1.4 Non-Goals (v1)

- Online payments or print sales.
- Video streaming (video files can be delivered inside the ZIP only).
- Per-photo download, favorites, comments and album selection by clients (later release).
- Face recognition or AI tagging.
- Native mobile apps (responsive web first).
- Multiple photographers or staff roles.

### 1.5 Success Metrics

| Metric | Target |
| --- | --- |
| Public page load on mobile 4G | under 3 s |
| Client time from passkey to link request | under 2 min |
| Link emails reaching the inbox (test accounts) | over 95% |
| Admin hands-on time to create a client and upload 500 photos | under 10 min |
| Clicks for admin to re-send a link | 3 or fewer |
| Photos processed without error | over 99% |

## 2. Key Decisions

| Area | Decision |
| --- | --- |
| Backend | Django + Django REST Framework, JWT auth |
| Frontend | React with Vite (JavaScript) |
| Database | PostgreSQL |
| Background jobs | Celery + Redis (thumbnails, watermark, ZIP parts, email, cleanup) |
| Hosting | Coolify with Docker Compose on the photographer's Ubuntu laptop |
| Private access | Tailscale for admin tools (Coolify dashboard, SSH) |
| Public access | To confirm: Cloudflare Tunnel with an own domain (recommended) or Tailscale Funnel (testing only) |
| Photo storage | Local disk on the laptop (about 400 GB on a 2 TB drive), mounted into the containers; no paid storage |
| File serving | nginx gateway with X-Accel-Redirect; Django only decides who may access a file |
| Storage code | Django storage API, so S3-style storage can be added later by configuration |
| Client model | A Client is the gallery: photos, passkey and delivery settings live on the client record |
| Client delivery | 'Get my image' page (names + passkey), preview, email, 7-day ZIP link |
| Email | SMTP service with a free tier (provider to be chosen) |

## 3. Users and Roles

| Role | Who | Access |
| --- | --- | --- |
| Admin | The photographer | Full control through the admin panel |
| Client | Couple or family | Verified by names + passkey; sees only their own preview and download link |
| Public visitor | Prospective client | Public site: showcase, about, contact |

A staff or editor role is a future option and is not part of v1.

## 4. Feature Modules

Priority: **P0** = MVP, **P1** = after launch, **P2** = future.

### 4.1 Admin Login

- P0: email and password login, JWT with refresh, logout, change password.
- P1: 2FA (TOTP), lockout after repeated failures, active session list.

### 4.2 Dashboard (P0)

| Card | Shows |
| --- | --- |
| Total clients | Count and new this month |
| Total photos | Count |
| Categories | Count, with clients per category |
| Storage used | Used space and free disk, warning above 80% |
| Pending work | Photos still processing or failed, ZIPs being built |
| Download links | Active links and links expiring within 7 days |
| Recent clients | Last 5 with status |
| Recent activity | Last 10 actions (uploads, sends, deletes) |
| Chart | Clients added per month |

### 4.3 Clients

**Client list (P0)** columns:

| Column | Notes |
| --- | --- |
| Cover thumbnail | First showcase or first photo |
| Names | Groom and bride names |
| Event date | Sortable |
| Category | Filterable |
| Photos | Count |
| Storage | Space used by this client |
| Status | Draft, Published, Archived |
| Link status | None, Active (expiry date), Expired |
| Created | Date |
| Actions | View, Edit, Delete, Send |

List tools: search by names, filter by category, status and date, sort by column, pagination. Bulk delete is P1.

**Create and edit form (P0):** groom name, bride name, event date, category, phone, linked email (optional), notes, status. The passkey is generated automatically, shown once with a copy button, and can be regenerated. Photos are added by drag and drop with a progress bar and per-photo processing status.

**Client detail page (P0):** client info, photo grid (reorder, hide, delete), showcase picker (choose up to 3 public photos), passkey regenerate, link history, storage used.

**Delete (P0):** confirmation dialog, then soft delete to a trash for 30 days; files are removed after that.

**Import (P0):** a management command moves existing photos from a server folder into a client (the 400 GB backlog), so nothing is uploaded through the browser.

### 4.4 Categories (P0)

Create, edit, reorder and delete categories (for example Wedding, Pre-wedding, Engagement, Haldi, Reception). Fields: name, slug, order, visible on public site. A category that still has clients cannot be deleted until they are reassigned. Each client has one category in v1.

### 4.5 Storage (P0)

- Total space used by photos, plus disk total and free space.
- Breakdown: originals, previews, thumbnails, showcase images, ZIP files.
- Per-client usage table, sortable.
- Warning banner above 80% disk usage.
- P1 tools: clear expired ZIPs, retry failed photos, recalculate usage.

### 4.6 Settings (P0)

| Group | Options |
| --- | --- |
| Watermark | On or off, text or logo image, position, opacity, size, live preview, apply to client preview images (default off) |
| Branding | Studio name, logo, phone, WhatsApp, email, social links |
| Delivery | Link validity (7 days), max downloads per link (10), ZIP part size (about 1.5 GB), revoke older links on send (on) |
| Email | Sender name, sender address, reply-to |
| Account | Change password, 2FA (P1) |

Changing watermark settings regenerates the showcase images only (3 per client).

### 4.7 Send Link Action (P0)

Each client row and the client detail page has a **Send** button that opens a dialog:

- The email field is pre-filled with the client's linked email. If none is saved it is empty and required.
- Admin can edit the email. A checkbox 'Save as the client's email' appears when it was changed.
- The dialog shows the last sent date, the current link expiry and its status.
- 'Revoke previous links' is ticked by default.
- Send creates a new 7-day link and emails it at once. Every send is logged.

### 4.8 Public Website

- P0: Home, Portfolio, About, Contact, and a 'Get my image' menu item.
- P0: the portfolio shows only 3 watermarked photos per client, with category filter tabs.
- The 3 showcase photos default to the first 3 photos unless the admin picks others.
- P1: contact form with email notification, testimonials, packages and pricing, SEO basics.

### 4.9 Get My Image: Client Delivery (P0)

| Page | What happens |
| --- | --- |
| /get-my-image | Form with groom name, bride name and passkey |
| /get-my-image/preview | After a match: paginated, lazy-loaded photo previews, an email field and a 'Send me the download link' button |
| Email | Message with the download button and the expiry date |
| /d/{token} | Download page listing the ZIP part(s), expiry countdown and download buttons |
| Expired link | Friendly message and a contact button (phone or WhatsApp) |

Rules:

- Names are matched ignoring capitals, extra spaces and order. The passkey must also match.
- The first email a client submits is saved as the linked email and locked. Only the admin can change it.
- A link is valid for 7 days and allows a limited number of downloads (default 10 per part) so a broken download can be retried.
- After expiry the client contacts the admin, who re-sends from the Send button to the linked email.
- Wrong attempts return one generic error and are rate-limited.

### 4.10 Email and Notifications

- P0: download link email to the client (names, expiry date, button).
- P1: email to admin when a client requests a link; reminder to the client 2 days before expiry.
- P2: WhatsApp share of the link.

## 5. Workflows

### 5.1 Admin Workflow

1. Log in to the admin panel.
2. Create a category if needed.
3. Create a client (names, date, category, phone or email). The system generates the passkey; copy it.
4. Upload the client's photos, or import them from a server folder, and wait for processing to finish.
5. Optionally pick the 3 showcase photos, then set the client to Published.
6. Give the passkey to the client (WhatsApp or phone) and tell them to use the 'Get my image' page.
7. Watch the dashboard. Use Send to re-send a link whenever needed.

### 5.2 Client Workflow

1. Open the 'Get my image' page.
2. Enter groom name, bride name and passkey.
3. Look through the photo preview.
4. Enter an email and submit.
5. Open the email and click the link.
6. Download the ZIP part(s) within 7 days.

### 5.3 Expired Link Workflow

1. The client opens an expired link and sees the expiry message with a contact button.
2. The client contacts the admin.
3. Admin opens Clients, clicks Send; the linked email is pre-filled; clicks Send.
4. The client receives a new link, valid for 7 days. The previous link is revoked.

## 6. System Architecture

```
Admin ---(Tailscale)---> Coolify dashboard and SSH (private)
Visitors and clients ---(Cloudflare Tunnel + domain)---> Coolify proxy
                                                           |
                                                    gateway (nginx)
                    +--------------------+------------------+----------------------+
                    |                    |                                         |
              /  -> frontend        /api/ -> backend                /protected/ -> photo folder
              (React build)         (Django + gunicorn)             (internal, read-only,
                                           |                          only after Django approves)
                                  postgres, redis
                                           |
                         worker + beat (Celery) ---> photo folder (/media)
```

### 6.1 Components

| Component | Responsibility |
| --- | --- |
| Frontend (React + Vite) | Admin panel, public site, Get my image pages |
| Backend (Django + DRF) | Auth, CRUD, permission checks, link and token logic, settings |
| PostgreSQL | All structured data |
| Redis | Celery queue and rate-limit counters |
| Celery worker | Thumbnails, previews, watermark, ZIP parts, emails, imports |
| Celery beat | Expiry, cleanup, reminders, storage recalculation |
| nginx gateway | Routing, static files, protected file delivery (X-Accel-Redirect) |
| Photo folder | Local disk, bind-mounted into backend, worker and gateway |

### 6.2 Docker Compose Services

Services: `db`, `redis`, `backend`, `worker` (concurrency 2), `beat`, `frontend`, `gateway`. The domain is set on the gateway service in Coolify, secrets are Coolify environment variables, and no host ports are published. Backend and worker mount the photo folder read-write; the gateway mounts it read-only.

### 6.3 Host Setup

- Ubuntu on the laptop, with sleep and lid-close suspend disabled; wired network preferred.
- Photo drive mounted by UUID in fstab with the nofail option, owned by the container user.
- Coolify on the laptop; its dashboard reachable only through Tailscale.
- Public traffic enters through the chosen public route (see Open Decisions).
- Disk and health alerts through smartmontools and Uptime Kuma.

## 7. Data Flow

### 7.1 Upload and Processing

1. Admin selects photos on the client page. P0 uses multi-file upload with per-file progress; P1 adds resumable chunked upload.
2. Django validates type and size, saves the original under originals/{client\_id}/, creates a Photo with status processing, and adds its size to the client's storage\_bytes.
3. The Celery worker reads EXIF, creates a thumbnail (400 px) and a preview (1600 px), stores the variants, and sets the photo to ready.
4. Failures are retried 3 times, then marked failed and shown on the dashboard.

### 7.2 Showcase and Watermark

1. Admin picks up to 3 showcase photos per client (default: the first 3).
2. The worker creates a 1600 px image with the watermark burned into the pixels, using the current Settings.
3. The public API returns only these showcase images, never originals or unwatermarked previews.
4. When watermark settings change, the worker regenerates showcase images for all clients (3 per client).
5. If 'apply to client preview images' is on, previews are also watermarked and regenerated in the background in batches.

### 7.3 Public Portfolio View

The browser requests the showcase list (optionally filtered by category). Django returns, for each published client, the 3 watermarked image URLs and the category. nginx serves the files with long cache headers.

### 7.4 Get My Image: Verify and Preview

1. The client submits groom name, bride name and passkey.
2. Django normalizes the names, finds the client by name\_key, compares the passkey hash in constant time, checks the rate limit, and requires the client to be Published.
3. On success it returns a short-lived session (30 minutes) tied to that one client.
4. The preview endpoint returns a page of preview URLs. Each file request is checked by Django and streamed by nginx.

### 7.5 Link Request and Email

1. The client enters an email. If the client has no linked email, it is saved and locked. If one exists, the link goes to the saved email and the page shows it masked (for example a\*\*\*@gmail.com).
2. Django makes sure a ZIP bundle exists (queueing a build if not) and creates a download link: random token stored only as a hash, expiry in 7 days.
3. The worker sends the email through SMTP and logs the result.

### 7.6 Download

1. The client opens /d/{token}. Django checks the token hash, expiry, revocation and download limit.
2. The page lists the ZIP parts, or shows 'Preparing your photos' while the bundle is still building.
3. A part request increments the counter, writes a download log, and Django answers with X-Accel-Redirect so nginx streams the file.

### 7.7 Admin Send

1. Admin clicks Send. The API returns the linked email and the current link status.
2. Admin confirms or edits the email, optionally saving it as the client's email.
3. Django revokes older links (if ticked), creates a new link, queues the email, and writes the email log and activity log.

### 7.8 Expiry and Cleanup (daily jobs)

- Mark expired links and delete ZIP bundles that no active link uses.
- Send expiry reminders (P1).
- Purge clients in the trash for more than 30 days, including their files.
- Remove incomplete uploads and recalculate storage usage.

### 7.9 Storage Numbers

Every saved file adds its size to the client's storage\_bytes. The Storage page sums these, and disk total and free space come from the operating system. A nightly job recounts from disk to correct any drift.

## 8. Database Schema (PostgreSQL)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  twofa_enabled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A client is the gallery
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groom_name TEXT NOT NULL,
  bride_name TEXT NOT NULL,
  name_key TEXT NOT NULL,            -- normalized, sorted names used for matching
  passkey_hash TEXT NOT NULL,
  linked_email TEXT,
  email_locked BOOLEAN DEFAULT FALSE,
  phone TEXT,
  event_date DATE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  notes TEXT,
  photo_count INT DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  deleted_at TIMESTAMPTZ,            -- soft delete (30-day trash)
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_clients_name_key ON clients(name_key);
CREATE INDEX idx_clients_category ON clients(category_id);

CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  width INT, height INT,
  taken_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('uploading','processing','ready','failed')),
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  showcase_order SMALLINT CHECK (showcase_order BETWEEN 1 AND 3),   -- NULL = not public
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_photos_client ON photos(client_id, sort_order);
CREATE UNIQUE INDEX uq_photos_showcase ON photos(client_id, showcase_order) WHERE showcase_order IS NOT NULL;

CREATE TABLE photo_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('thumb','preview','showcase')),
  storage_key TEXT NOT NULL,
  width INT, height INT,
  size_bytes BIGINT DEFAULT 0,
  UNIQUE (photo_id, kind)
);

CREATE TABLE zip_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','building','ready','failed')),
  parts JSONB DEFAULT '[]',          -- [{part, storage_key, size_bytes, photo_count}]
  photo_count INT DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  built_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE download_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES zip_bundles(id) ON DELETE SET NULL,
  token_hash TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  max_downloads INT DEFAULT 10,
  download_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),      -- NULL = requested by the client
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES download_links(id) ON DELETE CASCADE,
  part_no INT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  link_id UUID REFERENCES download_links(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  kind TEXT NOT NULL,                -- link, reminder, admin_notice
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE access_attempts (         -- rate limiting for Get my image
  id BIGSERIAL PRIMARY KEY,
  ip_address INET,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inquiries (                -- public contact form (P1)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, email TEXT, phone TEXT,
  event_date DATE, message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 8.1 Relationships

```
categories 1---* clients 1---* photos 1---* photo_variants
clients 1---* zip_bundles 1---* download_links 1---* download_logs
clients 1---* email_logs, access_attempts
users 1---* clients (created_by), activity_logs
site_settings: key/value (watermark, branding, delivery, email)
```

At most 3 showcase photos per client is enforced by the database: showcase\_order is limited to 1 to 3 and unique per client.

### 8.2 Settings Keys

| Key | Fields |
| --- | --- |
| watermark | enabled, type (text or image), text, image\_key, position, opacity, scale, apply\_to\_client\_preview |
| branding | studio\_name, logo\_key, phone, whatsapp, email, social\_links |
| delivery | link\_valid\_days (7), max\_downloads (10), zip\_part\_mb (1500), revoke\_on\_send (true) |
| email | from\_name, from\_address, reply\_to |

## 9. Storage and Image Pipeline

### 9.1 Folder Layout

```
/mnt/photos/                 (mounted as /media inside the containers)
  originals/{client_id}/{photo_id}.{ext}
  thumbs/{client_id}/{photo_id}_400.webp
  previews/{client_id}/{photo_id}_1600.webp
  showcase/{client_id}/{photo_id}_wm.jpg
  zips/{client_id}/{bundle_id}/part_01.zip
  branding/                  logo and watermark image
  import/                    drop folder for the existing photo backlog
```

### 9.2 Image Versions

| Version | Specification | Used for |
| --- | --- | --- |
| Original | Untouched file | Inside ZIP parts only; never served directly |
| Thumbnail | 400 px long edge, WebP | Admin grids, preview page grid |
| Preview | 1600 px long edge, WebP or JPEG; watermark optional (Settings) | Admin lightbox, client preview |
| Showcase | 1600 px long edge, JPEG; watermark burned in when enabled | Public portfolio |
| ZIP part | About 1.5 GB each, stored without compression | Client downloads; built once per client and reused |

GPS data is removed from every derived image. Tool: `pyvips` (or Pillow) in the Celery worker.

### 9.3 Space Budget (about 400 GB of photos on a 2 TB drive)

| Item | Approximate size |
| --- | --- |
| Originals | 400 GB |
| Thumbnails, previews, showcase | 12 to 20 GB |
| ZIP parts | Temporary; about the size of each client's photos while their link is active |
| Database, Docker images, OS | 30 to 60 GB |
| Free space target | At least 20% of the drive |

ZIP space depends on how many clients request links in the same week. The Storage page shows it, and expired bundles are deleted by the daily job.

### 9.4 Importing Existing Photos

A management command, for example `import_client --client <id> --path /mnt/photos/import/<folder>`, moves the files (a move on the same disk is instant and does not double space), creates the Photo rows, and queues processing.

### 9.5 Portability

All file access goes through Django's storage API. Moving to a bigger disk is a path change; moving to S3-style storage later is a settings change plus a file copy.

## 10. API Overview (REST)

### 10.1 Admin (JWT required)

| Area | Endpoints |
| --- | --- |
| Auth | POST /api/auth/login, /refresh, /logout; POST /api/admin/password |
| Dashboard | GET /api/admin/dashboard |
| Clients | GET, POST /api/admin/clients; GET, PATCH, DELETE /api/admin/clients/{id}; POST /api/admin/clients/{id}/regenerate-passkey; POST /api/admin/clients/{id}/restore |
| Photos | POST /api/admin/clients/{id}/photos (upload); PATCH, DELETE /api/admin/photos/{id}; POST /api/admin/clients/{id}/photos/reorder; PUT /api/admin/clients/{id}/showcase (up to 3 photo ids) |
| Links | POST /api/admin/clients/{id}/send-link (email, save\_email, revoke\_previous); GET /api/admin/clients/{id}/links; POST /api/admin/links/{id}/revoke |
| Categories | GET, POST /api/admin/categories; PATCH, DELETE /api/admin/categories/{id} |
| Storage | GET /api/admin/storage; POST /api/admin/storage/recalculate; POST /api/admin/storage/clear-zips |
| Settings | GET, PUT /api/admin/settings; POST /api/admin/settings/watermark-image |

### 10.2 Public and Client Delivery

| Endpoint | Purpose |
| --- | --- |
| GET /api/public/showcase?category= | 3 watermarked photos per published client |
| GET /api/public/categories | Visible categories for filter tabs |
| POST /api/public/inquiries | Contact form (P1) |
| POST /api/public/get-my-image/verify | Names + passkey, returns a 30-minute session |
| GET /api/public/get-my-image/photos?page= | Preview list for the verified client |
| POST /api/public/get-my-image/request-link | Email in, link created, email queued |
| GET /api/d/{token} | Link status and ZIP part list |
| GET /api/d/{token}/part/{n} | Download one ZIP part |
| GET /files/{kind}/{photo\_id} | Permission-checked file delivery through nginx |

## 11. Role-Based Access Control

| Action | Admin | Verified client | Public visitor |
| --- | --- | --- | --- |
| Manage clients, categories, settings | Yes | No | No |
| Upload and manage photos | Yes | No | No |
| Send links, view logs | Yes | No | No |
| View dashboard and storage | Yes | No | No |
| See the showcase (3 watermarked photos per client) | Yes | Yes | Yes |
| Preview photos | Yes | Own photos only | No |
| Request a download link | Yes (Send button) | Own client only | No |
| Download ZIP parts | Yes | Link holder | Link holder |

### 11.1 How It Is Enforced

- Admin: JWT on every /api/admin route, with a permission class.
- Verified client: a short-lived signed session that carries one client\_id; every query is filtered by it.
- Download link: the token is checked on every request (hash, expiry, revoked, download count).
- Originals are never served to public or client sessions except as ZIP parts through a valid link.

## 12. Security Requirements

| Area | Requirement |
| --- | --- |
| Passkey | Auto-generated, 8 to 10 random characters from an unambiguous set (for example K7M2-9QXA); shown once; stored hashed; can be regenerated |
| Brute force | 5 failed attempts lock that client and IP for 15 minutes; CAPTCHA (Cloudflare Turnstile) on the verify form; one generic error message |
| Name matching | Normalized (case, spaces, order); the passkey is always required as well |
| Email control | First client email is saved and locked; links go only to the linked email; only the admin can change it |
| Download tokens | Long random value, stored only as a hash, expiry, revocation, download cap |
| Admin login | Strong password hashing, short-lived JWT with refresh, lockout; 2FA in P1 |
| File access | No public folder; nginx internal location; Django checks every file request |
| Uploads | Validate type and size on the server; accept images only for photos; reject executables |
| Web security | HTTPS and HSTS, secure cookies, restricted CORS, CSP headers, no-referrer on download pages, noindex on private pages |
| Network | Coolify dashboard and SSH only through Tailscale; no router ports opened; no published Docker ports; keep OS and Docker updated |
| Privacy | GPS removed from derived images; IP addresses kept only for security logs |
| Secrets | Coolify environment variables, never in git |
| Audit | Activity log for logins, sends, deletes and settings changes |

## 13. Non-Functional Requirements

- **Performance:** public pages under 3 s on mobile 4G; thumbnails under 100 KB; 50 to 100 photos per preview page with lazy loading; cache headers on all image files.
- **Home-server limits:** client download speed equals the home upload speed, so ZIPs are split into parts of about 1.5 GB and a failed download repeats only one part; Celery concurrency is capped at 2 so the laptop stays responsive.
- **Scalability:** sized for 400 GB now and 1 to 2 TB on the same drive; the storage API allows a later move to another server or S3-style storage.
- **Availability:** best effort on a laptop (target 99%, excluding power and internet outages); health checks restart containers; uptime alerts by email or Telegram.
- **Compatibility:** current Chrome, Safari, Firefox and Edge, plus iOS Safari and Android Chrome.
- **Accessibility:** keyboard navigation, alt text, sufficient contrast.
- **Maintainability:** automated tests, database migrations, linting, and a README with restore steps.

## 14. Project Management Plan

### 14.1 Phases and Timeline (solo developer, approximate)

| Phase | Scope | Duration |
| --- | --- | --- |
| 0. Planning | Verify this PRD, wireframes, branding | 1 week |
| 1. Foundation | Repo, Dockerfiles, compose file, first deploy on Coolify, admin auth | 1 to 2 weeks |
| 2. Admin core | Clients, categories, settings, passkey generation, soft delete | 2 weeks |
| 3. Photo pipeline | Upload, import command, thumbnails, previews, protected file serving | 2 weeks |
| 4. Public site | Portfolio with 3 watermarked photos, showcase picker, watermark settings | 1 to 2 weeks |
| 5. Get my image | Verify page, preview page, rate limiting, link request | 2 weeks |
| 6. Delivery | ZIP parts, email, Send button, download page, expiry jobs | 2 weeks |
| 7. Dashboard and storage | Dashboard cards, Storage page, logs | 1 week |
| 8. Hardening | Security review, load test, backups, bug fixing | 1 to 2 weeks |
| 9. Launch | Domain and public route, monitoring, first real client | 1 week |

Total: about 14 to 18 weeks solo. Phases 1 to 3 plus a basic version of 5 and 6 give a usable first release sooner.

### 14.2 MVP Definition (Release 1)

Admin login, clients with categories, photo upload and import, thumbnails and previews, public portfolio with 3 watermarked photos, watermark on and off in Settings, Get my image (verify, preview, email link), ZIP parts with a 7-day link, Send button, Storage page, dashboard basics.

### 14.3 Release Plan

| Release | Contents |
| --- | --- |
| R1 (MVP) | Everything in 14.2 |
| R2 | 2FA, resumable chunked uploads, bulk delete, link reminders, admin notification emails, contact form |
| R3 | Testimonials, packages, SEO, client single-photo download and favorites, activity log views |
| R4 | Payments for prints or extensions, PWA, WhatsApp delivery |

### 14.4 Epics and Sample User Stories

| Epic | Example story |
| --- | --- |
| Auth | As the admin I can log in securely and change my password. |
| Clients | As the admin I can create a client, assign a category and get a passkey to share. |
| Photos | As the admin I can upload or import hundreds of photos and see their processing status. |
| Showcase | As the admin I can choose 3 photos per client for the public page. |
| Watermark | As the admin I can turn the watermark on or off in Settings. |
| Get my image | As a client I can enter our names and passkey and preview our photos. |
| Delivery | As a client I get an email with a ZIP link that works for 7 days. |
| Re-send | As the admin I can click Send, check or edit the email, and send a new link. |
| Storage | As the admin I can see how much space photos use and which clients use the most. |

### 14.5 Definition of Done

Feature works on desktop and mobile, permissions tested, errors handled, no console errors, code reviewed (or self-reviewed against a checklist), deployed to staging, documented in the README.

### 14.6 Environments and Workflow

- Environments: local (Docker Compose) and production on the laptop through Coolify; a staging copy only if the laptop has spare capacity.
- Git: `main` for production, feature branches, pull requests; auto-deploy from GitHub on merge.
- Task tracking: a board with Backlog, To Do, In Progress, Review, Done.
- Weekly rhythm: plan on Monday, demo to the photographer on Friday.

### 14.7 Testing Strategy

| Type | Coverage |
| --- | --- |
| Unit | Name normalization, passkey checks, token expiry, showcase limit |
| Integration | API routes with a test database, permission checks |
| End to end | Verify names and passkey, request link, open link, download part, admin Send |
| Security | Wrong passkey lockout, expired and revoked links, access to another client's files, path traversal on file serving |
| Load | 1,000-photo client, large ZIP build, several simultaneous downloads over the home connection |
| Email | Delivery test to Gmail and Outlook inboxes, spam folder check |
| Device | iPhone Safari, Android Chrome, desktop browsers |

### 14.8 Monitoring, Backups and Operations

- Uptime Kuma for site checks; smartmontools for disk health; alert at 80% disk usage.
- Docker and Coolify set to start on boot; health checks on every service.
- Database: scheduled Coolify backups, copied to a second drive.
- Photos: nightly sync (`rsync` or `restic`) to a spare external drive. Keep the original camera cards or other existing copies until a second copy exists, because one disk failure would otherwise lose all client photos.
- Offsite copy: add later when a budget exists, since free cloud tiers are too small for 400 GB.
- Restore test: restore the database and a sample client from backup once before launch.

### 14.9 Estimated Cost

| Item | Cost |
| --- | --- |
| Photo storage | None (laptop drive) |
| Hosting software (Coolify, Docker, Tailscale personal use) | Free |
| Cloudflare Tunnel and DNS | Free; requires an own domain |
| Domain | Small yearly fee (check current price) |
| Email sending | Free tier of an SMTP provider, within its daily limit |
| Electricity and internet | Existing laptop and connection |

### 14.10 Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Disk failure on the laptop | Loss of all client photos | Second-drive nightly backup, keep source copies, SMART alerts |
| Slow home upload speed | Slow client downloads | ZIP parts of 1.5 GB, retry-friendly limits, Celery and gateway tuned for few simultaneous users |
| Power or internet outage | Site down | UPS or stable power, health checks, tell clients to retry later |
| Laptop sleeping or overheating | Site down | Disable sleep, ventilation, ethernet, monitoring |
| Home ISP blocks inbound connections | Site unreachable | Outbound tunnel (Cloudflare Tunnel) instead of port forwarding |
| Link emails land in spam | Clients never receive links | Reputable SMTP provider, sender domain records (SPF, DKIM), inbox tests, admin can copy the link and share it by WhatsApp |
| Passkey guessed or leaked | Unauthorized preview and link request | Strong random passkeys, lockouts, CAPTCHA, locked email, regenerate passkey |
| Disk fills up | Uploads and ZIPs fail | 80% alert, ZIP cleanup, Storage page |
| Scope creep | Delay | Strict MVP, backlog for later releases |
| Single developer | Continuity | README, simple managed pieces, Docker-based setup |

## 15. Future Enhancements

- Client single-photo download, favorites, comments and album selection.
- Resumable chunked uploads (tus) and bulk actions in admin.
- Online payments for print sales or paid link extensions.
- Move photos to a larger disk, NAS or S3-style storage.
- WhatsApp delivery of links.
- AI features: best-photo suggestions, face search for guests.
- Staff or editor role.
- Native or installable mobile app (PWA).

## 16. Open Decisions to Verify

| # | Question | Assumption in this PRD |
| --- | --- | --- |
| 1 | Can a client belong to more than one category? | One category per client |
| 2 | Watermark type: text, logo image, or both? | Both supported in Settings |
| 3 | What happens when a public showcase photo is clicked? | Opens a lightbox; no client page |
| 4 | Public access route: Cloudflare Tunnel with an own domain, or Tailscale Funnel? | Cloudflare Tunnel with a domain (Funnel for testing only) |
| 5 | Should clients download single photos or favorite photos in v1? | No; preview, then ZIP by email |
| 6 | Labels for the two names: Groom and Bride, or neutral labels? | Groom and Bride |
| 7 | Watermark on the client preview images? | Off by default, switchable |
| 8 | Link rules: 7 days, 10 downloads per part, older links revoked on send? | Yes, all configurable in Settings |
| 9 | Which SMTP provider will send the emails? | To be chosen (free tier) |
| 10 | Trash period for deleted clients? | 30 days |
| 11 | Should the public page show couple names, or only photos and category? | Photos and category only |
| 12 | If a linked email already exists, should the client be able to enter a different one? | No; the link always goes to the saved email, only the admin can change it |
