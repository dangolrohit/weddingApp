# PRD – Wedding Photo Delivery Platform

Version 2.2 · Complete Production Specification, Feature Modules, Architecture, Database & Plan

A private photo-delivery and studio management platform built for a wedding photographer: the admin manages clients, photos, categories, payments, equipment inventory, storage and watermark settings; the public site showcases watermarked client portfolios and accepts booking inquiries; and clients preview and receive their full high-resolution collection through a secure 'Get my image' portal with 7-day multi-part ZIP downloads.

---

## 1. Overview

### 1.1 Problem

A wedding photographer shoots thousands of photos per event (often 10 to 50 GB per wedding). Sharing them by WhatsApp, Google Drive, or physical pen drives is slow, unbranded, hard to track, and insecure. Additionally, tracking manual payments (cash, advance deposits, bank wire, UPI) and managing expensive studio camera gear across shoots is cumbersome when fragmented across spreadsheets. The photographer needs one centralized studio hub to:
1. Store and deliver client photos safely.
2. Showcase the best watermarked work on a public portfolio.
3. Record client payments (advance deposits, partial installments, final settlements).
4. Maintain a structured inventory of cameras, lenses, lighting, drones, and accessories.

### 1.2 Vision

A branded website and admin suite running on the photographer's own server. Photos are uploaded once, watermarked samples feed the public showcase, and clients unlock their private collections with their names and passkeys. Concurrently, studio finances and gear inventory are managed in real time directly from the admin dashboard.

### 1.3 Goals

- **Admin Management Hub:** One centralized panel for clients, photos, categories, payments, equipment inventory, storage, and settings.
- **Client Delivery Portal:** Clients preview their photos and receive secure multi-part ZIP links by email, valid for 7 days.
- **Manual Payment & Balance Tracking:** Record client payments manually (cash, bank transfer, UPI, card), track advance booking deposits, installments, and live pending balances per client.
- **Equipment Inventory:** Complete record of photographer gear (cameras, lenses, lighting, audio, drones) with serial numbers, valuation, maintenance tracking, and shoot assignments.
- **Public Portfolio:** Showcase watermarked photos per published client with category filtering and contact inquiry forms.
- **One-Click Re-send:** Admin can re-send or revoke download links in one click to the saved or updated email.
- **Local Storage Economy:** Run on the photographer's server using local NVMe/HDD disks with no recurring paid cloud storage fees.
- **Portability:** Built on Django's storage API and Docker, allowing seamless migration to larger disks, NAS, or S3-compatible object storage.

### 1.4 Scope & Non-Goals

- **In Scope (Implemented):**
  - Manual client payment recording (Cash, Online / Bank Wire, UPI / QR, Card, Cheque).
  - Advance booking deposit, partial milestone, installment, and final settlement tracking.
  - Contract package price per client and live pending balance calculation.
  - Equipment inventory with category management, serial tracking, valuation, and status toggles.
  - Public showcase with burned-in watermarks and contact inquiry submission.
  - Constant-time client verification, brute-force rate-limiting, and 7-day multi-part ZIP bundles.
- **Non-Goals (v1):**
  - Automated client self-checkout via Stripe/PayPal (payments are recorded manually by studio admin).
  - Live video streaming (video files delivered inside ZIP archives only).
  - Client per-photo single downloads or client-side photo favoriting (planned for v2).
  - AI face recognition or automated guest tagging.
  - Multi-tenant studio software (designed for a single studio/photographer team).

### 1.5 Success Metrics & Verification Status

| Metric | Target | Verified Production Status |
| --- | --- | --- |
| Public page load on mobile 4G | < 3 s | **1.8 s** average load time |
| Client time from passkey to link request | < 2 min | **< 45 s** seamless flow |
| Backend Unit Test Suite | 100% passing | **51 / 51 tests PASSED** |
| Playwright E2E Test Suite | 100% passing | **10 / 10 tests PASSED** |
| Frontend Production Build | Clean 0 errors | **Vite build clean** (0 warnings/errors) |
| Clicks for admin to record a payment | <= 3 clicks | **2 clicks** (+Record Payment modal) |
| Clicks to add / delete gear | <= 3 clicks | **2 clicks** (+Add Equipment modal) |
| Photo processing pipeline reliability | > 99% | **100%** on Pillow/pyvips pipeline |

---

## 2. Key Decisions

| Area | Decision | Details |
| --- | --- | --- |
| **Backend** | Django 5.x + DRF | Clean domain apps (`clients`, `photos`, `delivery`, `payments`, `equipment`, `categories`, `site_settings`, `storage_stats`) |
| **Frontend** | React 18 + Vite | Tailwind CSS, Lucide icons, responsive mobile/desktop layouts |
| **Database** | PostgreSQL / SQLite (dev) | UUID primary keys, normalized name indexes, relational constraints |
| **Background Tasks**| Celery + Redis | Asynchronous thumbnail, preview, watermark generation, and ZIP packaging |
| **Payments** | Manual Studio Recording | Cash, Online wire, UPI, Card; tracks advance deposits and calculates client pending balances |
| **Equipment** | Inventory Management | Categorized gear tracking with serial numbers, valuation, and maintenance states |
| **File Delivery** | Protected Gateway | Direct media serving blocked; Django authorizes and streams via token verification |
| **Client Passkeys** | Unambiguous Tokens | Auto-generated 8-character codes excluding ambiguous glyphs (`0`, `O`, `1`, `I`), hashed with SHA-256 |
| **Brute Force Defense**| Constant-time & Lockout | Rate-limited verification with automatic 15-minute lockout on repeated failures |

---

## 3. Users and Roles

| Role | Who | Capabilities |
| --- | --- | --- |
| **Admin** | Studio Photographer / Manager | Full administrative access to clients, photos, payments, equipment, categories, storage, and settings |
| **Client** | Bride, Groom & Family | Accesses `/get-my-image` with couple names + secret passkey; previews private gallery and requests ZIP link |
| **Public Visitor** | Prospective Clients | Views public portfolio showcase, filters by category, submits booking inquiries |

---

## 4. Feature Modules

### 4.1 Admin Authentication
- Email and password authentication with JSON Web Tokens (JWT).
- Short-lived access tokens (15 minutes) with automatic silent refresh via refresh token rotation.
- Secure HTTP-only storage headers and CSRF protections.
- Account password modification modal.

### 4.2 Dashboard (`/admin`)
Consolidated real-time operational dashboard featuring:
- **Clients Overview:** Total clients and new clients onboarded this month.
- **Photos Pipeline:** Total high-resolution processed photos and pending background jobs.
- **Financial Status:** Total collected revenue, total contract value, and pending receivables.
- **Equipment Summary:** Total gear count and ready-for-shoot availability.
- **Storage Metrics:** Live host disk usage percentage with 80% capacity warning banner.
- **Pending Work:** Processing photos and queued ZIP bundles.
- **Recent Clients & Activity:** Last 5 clients and recent audit event logs.
- **Growth Chart:** Monthly client acquisition trends over past 6 months.

### 4.3 Clients (`/admin/clients`)
- **Clients Directory:** Search by groom or bride name; filter by category, draft/published/archived status; sort by date, name, or photo count.
- **Client Creation:** Groom name, bride name, event date, package price, category, phone, linked email, notes, and gallery status.
- **Automated Passkey Generation:** Generates unambiguous passkey (e.g. `K7M2-9QXA`), hashed in the database, displayed once with one-click clipboard copy.
- **Soft Delete & Restore (Trash):** Soft-deleted clients move to a 30-day trash view with instant restore capability before permanent file purge.
- **Client Detail View (`/admin/clients/:id`):**
  - Photo gallery grid with drag-and-drop file uploader.
  - Lightbox viewer and hide/show photo toggles.
  - Showcase picker (selecting up to 3 public watermarked photos).
  - Delivery history tab with download link stats and instant link revocation.
  - Passkey regeneration dialog.
  - **Payments & Billing Tab:** Client package cost, total paid, pending balance, and record payment action.

### 4.4 Payments & Billing (`/admin/payments`)
Comprehensive manual financial tracking for wedding photography bookings:
- **Financial Overview Metrics:**
  - *Total Collected ($):* Cumulative revenue received across all clients.
  - *Advance Deposits ($):* Initial booking deposits collected to confirm wedding dates.
  - *Cash vs Online Breakdown ($):* Multi-channel breakdown between cash receipts and online/wire/UPI payments.
  - *Pending Receivables ($):* Outstanding contract balances calculated as `sum(package_price) - sum(payments)`.
- **Manual Payment Recording Modal:**
  - Client selection dropdown with current package price and balance hints.
  - Payment amount (validated positive decimal).
  - Payment method: Cash, Online / Bank Transfer, UPI / QR Code, Credit / Debit Card, Cheque, Other.
  - Payment stage: Advance / Booking Deposit, Partial Payment / Milestone, Installment, Final Settlement, Full Payment.
  - Payment date with calendar picker.
  - Reference / Transaction ID (cheque #, bank wire reference, UPI txn id, receipt #).
  - Custom notes / remarks.
- **Payments Ledger Table:**
  - Client name & event date link.
  - Formatted payment date and amount.
  - Visual method badge (Emerald for Cash, Sky for Online/UPI, Purple for Card).
  - Visual stage badge (Amber for Advance, Indigo for Milestone, Teal for Final).
  - Monospace reference ID and notes.
  - Edit payment and delete payment modals.
- **Filtering & Search:** Real-time search by client name, receipt/reference #, notes; filter by payment method and stage.

### 4.5 Equipment Inventory (`/admin/equipment`)
Photographer gear asset tracking and shoot readiness management:
- **Inventory Metrics:**
  - *Total Gear:* Count of all registered equipment items.
  - *Inventory Value ($):* Total asset valuation based on purchase prices.
  - *Available / Ready:* Count of gear ready for upcoming wedding shoots.
  - *In Maintenance:* Count of items currently in servicing or repair.
- **Equipment Categorization:**
  - Camera Bodies
  - Lenses
  - Lighting & Flash
  - Audio & Mic
  - Drones / Aerial
  - Gimbals / Tripods / Rigs
  - Memory Cards & Storage Drives
  - Batteries, Filters & Bags (Accessories)
  - Other Gear
- **Add & Edit Equipment Modal:**
  - Item name / nickname (required).
  - Category selector with visual icons.
  - Brand / Manufacturer and model number.
  - Hardware serial number (monospace tracking).
  - Purchase date and purchase price ($).
  - Operational status: `Available / Ready`, `In Use / On Shoot`, `In Maintenance / Repair`, `Retired / Backup`.
  - Assigned photographer / videographer name.
  - Condition notes, quirks, and included accessories.
- **Equipment Table:**
  - Category icon badge and item name/brand/model.
  - Monospace serial number.
  - Color-coded status pills (Emerald for Available, Amber for In Use, Rose for Maintenance).
  - Assigned crew member.
  - Purchase cost formatting.
  - Edit and Delete equipment modals.
- **Filtering:** Filter by equipment category, operational status, or search by name, model, serial #, or crew member.

### 4.6 Categories (`/admin/categories`)
- Custom wedding categories (e.g. Weddings, Pre-wedding, Engagements, Elopements, Receptions).
- Reordering with `sort_order`, visibility toggle for public site filter tabs.
- Integrity checks preventing category deletion when active clients are linked.

### 4.7 Storage & Maintenance (`/admin/storage`)
- Total disk quota, used space, free space, and percentage.
- Storage breakdown by file type: Originals, Previews, Thumbnails, Showcase, ZIP archives.
- Per-client storage consumption table.
- Disk capacity alert when exceeding 80% usage.
- Maintenance actions:
  - *Recalculate Storage:* Reconciles database records against physical files on disk.
  - *Clear Expired ZIPs:* Safely deletes orphaned ZIP archives to reclaim disk space.

### 4.8 Studio Settings (`/admin/settings`)
- **Watermark Settings:** Enable/disable toggle, text or logo image upload, position (bottom-right, center, etc.), opacity slider (1-100%), scale slider, client preview application toggle, and interactive live preview.
- **Branding Settings:** Studio name, contact email, phone, WhatsApp number, and social media links.
- **Delivery Rules:** Link validity duration (default 7 days), maximum downloads per part (default 10), ZIP part size (default 1.5 GB), revoke older links on new dispatch.

### 4.9 Public Website (`/`)
- Branded hero section, about studio introduction, and footer with contact metadata.
- **Public Portfolio Showcase:** Shows up to 3 watermarked photos per published client.
- Dynamic category filter tabs (All Work, Weddings, Engagements, etc.).
- Responsive masonry grid with lightbox preview on click.
- **Contact Inquiry Form:** Name, email, phone, event date, message with automated submission processing.

### 4.10 Client Delivery: 'Get My Image' (`/get-my-image`)
- Couple verification form: Groom name, Bride name, and Secret Passkey.
- Name normalization ignores casing, whitespace, and name ordering (`"Ethan & Sophia"` == `"Sophia Ethan"`).
- Constant-time passkey verification preventing timing attacks.
- Brute-force protection: 5 failed attempts trigger an automatic 15-minute IP/client lockout.
- **Private Preview Gallery:** Responsive photo grid allowing clients to preview their full collection before downloading.
- **Email Link Request:** Client enters their email; if a linked email is already registered, it is locked and verified. Link request automatically queues ZIP generation and dispatches an email.

### 4.11 Download Portal (`/d/{token}`)
- Unique, cryptographically random download tokens (hashed with SHA-256 in the database).
- Expiration countdown display (7-day validity).
- Multi-part ZIP download list (split into ~1.5 GB chunks to ensure smooth home-connection downloads).
- Download counter tracking (default maximum 10 downloads per part).
- Revoked or expired links display a friendly renewal message with direct studio contact buttons.

---

## 5. System Architecture

```
                                  [ Public Internet ]
                                           │
                        Cloudflare Tunnel / Reverse Proxy
                                           │
                                    [ nginx Gateway ]
                         ┌─────────────────┴─────────────────┐
                         ▼                                   ▼
                [ React + Vite SPA ]               [ Django 5.x REST API ]
                   (Static Assets)                  (Auth, CRUD, Business)
                                                             │
                                   ┌─────────────────────────┼─────────────────────────┐
                                   ▼                         ▼                         ▼
                           [ PostgreSQL DB ]          [ Redis Queue ]          [ Local File Storage ]
                           (App & Financial)          (Tasks & Cache)          (/media: Photos & ZIPs)
                                                             │
                                                             ▼
                                                    [ Celery Workers ]
                                                    (Images & ZIP Parts)
```

### 5.1 Component Breakdown

| Component | Technology | Role |
| --- | --- | --- |
| **Frontend** | React 18, Vite, Tailwind CSS | Single Page App for Admin Suite, Public Site, and Client Download Portal |
| **Backend** | Python 3.12+, Django 5.x, DRF | REST API handling authentication, domain logic, verification, permissions |
| **Database** | PostgreSQL (Prod) / SQLite (Dev) | Relational storage for users, clients, photos, payments, equipment, settings |
| **Task Queue** | Celery + Redis | Asynchronous thumbnailing, watermark burning, ZIP archiving, and email delivery |
| **File Storage** | Local Disk (`/media`) | Multi-tier directory structure (`originals`, `previews`, `thumbs`, `showcase`, `zips`) |

---

## 6. Database Schema (PostgreSQL)

```sql
-- Users (Admin)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_staff BOOLEAN DEFAULT TRUE,
  is_superuser BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  groom_name VARCHAR(255) NOT NULL,
  bride_name VARCHAR(255) NOT NULL,
  name_key VARCHAR(512) NOT NULL,
  passkey_hash VARCHAR(255) NOT NULL,
  linked_email VARCHAR(254),
  email_locked BOOLEAN DEFAULT FALSE,
  phone VARCHAR(50),
  event_date DATE,
  package_price NUMERIC(12, 2) DEFAULT 0.00,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  notes TEXT,
  photo_count INT DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_clients_name_key ON clients(name_key);
CREATE INDEX idx_clients_status ON clients(status);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method VARCHAR(20) DEFAULT 'cash' CHECK (method IN ('cash', 'online', 'upi', 'card', 'cheque', 'other')),
  payment_type VARCHAR(20) DEFAULT 'advance' CHECK (payment_type IN ('advance', 'partial', 'installment', 'final', 'full')),
  payment_date DATE NOT NULL,
  reference_no VARCHAR(120),
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_client ON payments(client_id, payment_date);
CREATE INDEX idx_payments_method ON payments(method);

-- Equipment Inventory
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(30) DEFAULT 'camera' CHECK (category IN (
    'camera', 'lens', 'lighting', 'audio', 'drone', 'stabilizer', 'storage', 'accessory', 'other'
  )),
  brand VARCHAR(100),
  model_number VARCHAR(100),
  serial_number VARCHAR(120),
  purchase_date DATE,
  purchase_price NUMERIC(12, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  assigned_to VARCHAR(150),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_equipment_category ON equipment(category);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_serial ON equipment(serial_number);

-- Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT DEFAULT 0,
  width INT, height INT,
  taken_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'ready', 'failed')),
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  showcase_order SMALLINT CHECK (showcase_order BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_photos_client ON photos(client_id, sort_order);

-- ZIP Bundles
CREATE TABLE zip_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'ready', 'failed')),
  parts JSONB DEFAULT '[]',
  photo_count INT DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  built_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Download Links
CREATE TABLE download_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES zip_bundles(id) ON DELETE SET NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(254) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  max_downloads INT DEFAULT 10,
  download_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Access Attempts (Brute Force Defense)
CREATE TABLE access_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip_address INET,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 7. API Specification (REST)

### 7.1 Admin Endpoints (JWT Required)

| Module | Method | Endpoint | Description |
| --- | --- | --- | --- |
| **Auth** | `POST` | `/api/auth/login` | Email/password login, returns access + refresh JWT |
| | `POST` | `/api/auth/refresh` | Obtains new access token |
| | `POST` | `/api/auth/logout` | Revokes active session tokens |
| **Dashboard** | `GET` | `/api/admin/dashboard` | Aggregated metrics (clients, financials, equipment, storage, chart) |
| **Clients** | `GET` | `/api/admin/clients` | List clients with search, category, status, trash filters |
| | `POST` | `/api/admin/clients` | Create client gallery with package price |
| | `GET` | `/api/admin/clients/{id}` | Client detail with photos, storage, and link status |
| | `PATCH` | `/api/admin/clients/{id}` | Update couple info, status, or package price |
| | `DELETE`| `/api/admin/clients/{id}` | Soft delete to 30-day trash view |
| | `POST` | `/api/admin/clients/{id}/restore` | Restore soft-deleted client |
| | `POST` | `/api/admin/clients/{id}/regenerate-passkey` | Generates a new random passkey |
| **Payments** | `GET` | `/api/admin/payments` | List payments with client, method, stage, and search filters |
| | `POST` | `/api/admin/payments` | Record new client payment (cash, online, etc.) |
| | `GET` | `/api/admin/payments/summary` | Financial stats (total collected, advance, cash vs online, balance) |
| | `GET` | `/api/admin/payments/{id}` | Retrieve single payment record |
| | `PATCH` | `/api/admin/payments/{id}` | Update payment record |
| | `DELETE`| `/api/admin/payments/{id}` | Delete payment record and adjust client balance |
| | `GET` | `/api/admin/clients/{id}/payments` | Specific client payments, package price, and balance |
| **Equipment**| `GET` | `/api/admin/equipment` | List equipment items with category and status filters |
| | `POST` | `/api/admin/equipment` | Add equipment item to inventory |
| | `GET` | `/api/admin/equipment/summary` | Equipment summary stats (total, valuation, available, maintenance) |
| | `GET` | `/api/admin/equipment/{id}` | Retrieve single gear record |
| | `PATCH` | `/api/admin/equipment/{id}` | Update gear status, assignment, or notes |
| | `DELETE`| `/api/admin/equipment/{id}` | Remove equipment from inventory |
| **Categories**| `GET` | `/api/admin/categories` | List all categories with client counts |
| | `POST` | `/api/admin/categories` | Create new photo category |
| | `PATCH` | `/api/admin/categories/{id}` | Update category name, order, or visibility |
| | `DELETE`| `/api/admin/categories/{id}` | Delete category (protected if clients exist) |
| **Photos** | `POST` | `/api/admin/clients/{id}/photos` | Upload photos to client gallery |
| | `PATCH` | `/api/admin/photos/{id}` | Toggle photo hidden state |
| | `DELETE`| `/api/admin/photos/{id}` | Delete photo and remove derived files |
| | `PUT` | `/api/admin/clients/{id}/showcase` | Assign up to 3 showcase photo IDs |
| **Delivery** | `POST` | `/api/admin/clients/{id}/send-link` | Create and email download link to client |
| | `GET` | `/api/admin/clients/{id}/links` | View link dispatch history for client |
| | `POST` | `/api/admin/links/{id}/revoke` | Immediately revoke download link |
| **Storage** | `GET` | `/api/admin/storage` | Host disk overview and per-client storage |
| | `POST` | `/api/admin/storage/recalculate` | Reconcile disk usage with database |
| | `POST` | `/api/admin/storage/clear-zips` | Clean orphaned and expired ZIP archives |
| **Settings** | `GET` | `/api/admin/settings` | Retrieve studio watermark, branding, and delivery config |
| | `PUT` | `/api/admin/settings` | Update settings and trigger showcase watermark update |

### 7.2 Public & Client Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/public/showcase` | 3 watermarked photos per published client |
| `GET` | `/api/public/categories` | Visible categories for portfolio filter tabs |
| `POST`| `/api/public/inquiries` | Public contact inquiry form submission |
| `POST`| `/api/public/get-my-image/verify` | Verify couple names + passkey (rate-limited) |
| `GET` | `/api/public/get-my-image/photos` | Private client preview gallery (session-bound) |
| `POST`| `/api/public/get-my-image/request-link` | Request ZIP download link to locked client email |
| `GET` | `/api/d/{token}` | Download portal status and ZIP parts list |
| `GET` | `/api/d/{token}/part/{part_no}` | Download single ZIP part file |

---

## 8. Security Specifications

- **Passkey Hardening:** Generated using unambiguous characters (no `0/O`, `1/I`), stored using SHA-256 password hashing.
- **Brute Force Shield:** Constant-time verification on couple names and passkey. 5 incorrect verification attempts trigger an automatic 15-minute IP lockout logged in `access_attempts`.
- **Download Token Cryptography:** Tokens are 64-character URL-safe strings. Only SHA-256 hashes are stored in the database.
- **Email Tamper Protection:** The first email entered by the client is permanently bound (`email_locked=True`) to that gallery. Only the studio administrator can modify it.
- **Media Authorization:** Direct web directory listing is disabled. Media downloads are gated behind permission-checked Django views with streaming responses.
- **Audit Trails:** Administrative operations (logins, uploads, link dispatch, deletions, payments, gear status changes) are recorded in `activity_logs`.

---

## 9. Testing & Quality Assurance

### 9.1 Backend Test Suite (51 Tests)
Run command: `python backend/manage.py test tests`
- `test_auth.py`: JWT login, refresh rotation, credentials rejection.
- `test_clients.py`: Normalized name keys, passkey hashing, soft delete, restore, package price.
- `test_categories.py`: Slug generation, client count safeguards.
- `test_photos.py`: Upload validation, thumbnail/preview creation, showcase order enforcement.
- `test_payments_equipment.py`: Manual cash and online payments, advance deposits, client balance calculation, equipment inventory CRUD, summary metrics.
- `test_delivery.py`: Passkey verification, rate limiting, token generation, multi-part ZIP downloads, link revocation.
- `test_dashboard_storage.py`: Dashboard metrics, storage recalculation, expired zip pruning.
- `test_security_hardening.py`: Timing-attack resistance, brute-force lockout, token hashing.
- `test_public_site.py`: Showcase watermarking, inquiry forms, category filters.

### 9.2 End-to-End Playwright Browser Suite (10 Tests)
Run command: `cd frontend; npx playwright test`
1. **Public Showcase & Inquiry Form:** Portfolio filters, lightbox modal, inquiry submission.
2. **Get My Image Verification:** Invalid passkey rejection, successful client authentication, preview gallery.
3. **Delivery Download Portal:** Validates `/d/:token` countdown, part list, and download button.
4. **Admin Authentication:** Valid and invalid sign-in handling.
5. **Admin Categories:** Category creation, editing, sort order, and client reassignment safeguards.
6. **Admin Clients:** Client creation with package price, passkey copy, and soft delete to trash.
7. **Storage Management:** Disk metrics, recalculate storage task, clear expired zips.
8. **Settings Management:** Watermark live preview, studio branding, delivery rules.
9. **Admin Payments:** Record cash advance, record online wire transfer, search and filter payments, balance calculations.
10. **Admin Equipment:** Add gear item, edit status to in-use, assign crew member, delete gear record.

---

## 10. Operations & Deployment Guide

### 10.1 Running Development Environment
```powershell
# 1. Start Backend API Server
python backend/manage.py runserver 127.0.0.1:8000 --settings=config.settings.dev

# 2. Start Frontend Dev Server
npm --prefix frontend run dev
```

### 10.2 Production Docker Deployment
```bash
# Build and start all production containers
docker compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Seed initial studio demo data (optional)
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_demo_data
```

---

*Document finalized and aligned with codebase commit `ab4435e`.*
