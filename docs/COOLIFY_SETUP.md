# Coolify Deployment Guide: Wedding Photo Platform & 4–5 TB Private S3 Storage

This guide explains how to deploy the entire wedding photo platform onto your Ubuntu laptop/server using **Coolify**, leveraging Coolify's built-in features:
- **1-Click SSL / HTTPS** via Coolify's Traefik reverse proxy
- **Direct 10–30 GB browser uploads** directly to your 4–5 TB SSD storage (without buffering in server RAM or passing through the Django website backend)
- **Visual S3 Dashboard** (MinIO Console) to browse buckets and inspect uploaded wedding files
- **Automated Database Backups** and zero-downtime Git push deployments

---

## 1. Physical SSD Setup on Ubuntu (4–5 TB Storage)

Before deploying in Coolify, ensure your 4–5 TB SSD is persistently mounted to a fixed path on Ubuntu.

### Step 1.1: Identify Your Drive UUID
Open your Ubuntu terminal and run:
```bash
lsblk -f
```
Find your SSD device (e.g. `/dev/nvme0n1p1` or `/dev/sdb1`) and note its `UUID` and filesystem (e.g., `ext4`).

### Step 1.2: Create Persistent Mount Point
```bash
sudo mkdir -p /mnt/wedding_storage
```

Add an entry to `/etc/fstab` so the drive mounts automatically on system boot:
```bash
sudo nano /etc/fstab
```
Add the following line (replace `<YOUR-SSD-UUID>` with your actual UUID from `lsblk`):
```text
UUID=<YOUR-SSD-UUID>  /mnt/wedding_storage  ext4  defaults,noatime,nofail  0  2
```

Mount it and verify:
```bash
sudo mount -a
df -h /mnt/wedding_storage
```
*You should see approximately 4–5 TB available.*

### Step 1.3: Ensure Read/Write Permissions
```bash
sudo chown -R 1000:1000 /mnt/wedding_storage
sudo chmod -R 775 /mnt/wedding_storage
```

---

## 2. Deploying via Coolify

### Step 2.1: Add Project in Coolify
1. In your Coolify dashboard, select your **Project** and **Environment** (e.g., `Production`).
2. Click **+ New Resource** → **Git Repository** (GitHub or Private Git).
3. Select your repository `weddingApp` and set the branch to `main`.
4. Choose **Docker Compose** as the build pack (Coolify will detect the `docker-compose.yml` in the root).

---

### Step 2.2: Configure Environment Variables in Coolify
In the Coolify project settings under **Environment Variables**, paste the following configuration:

```env
# Domain & SSL Settings (Coolify Traefik will automatically provision HTTPS certificates)
SERVICE_FQDN_APP=https://photos.yourdomain.com
SERVICE_FQDN_MINIO=https://s3.yourdomain.com
SERVICE_FQDN_MINIO_CONSOLE=https://console.yourdomain.com

# Physical SSD Path on Ubuntu
HOST_STORAGE_PATH=/mnt/wedding_storage
HOST_MEDIA_PATH=/mnt/wedding_storage/media_data

# Django Core & Security
DJANGO_SECRET_KEY=generate-a-strong-random-64-character-secret
DEBUG=False
DJANGO_SETTINGS_MODULE=config.settings.prod
ALLOWED_HOSTS=photos.yourdomain.com,s3.yourdomain.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://photos.yourdomain.com,https://s3.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://photos.yourdomain.com

# PostgreSQL Database
POSTGRES_DB=wedding_platform
POSTGRES_USER=wedding_user
POSTGRES_PASSWORD=use-a-strong-secure-password
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://redis:6379/0

# Coolify S3 / MinIO Storage Credentials
MINIO_ROOT_USER=studio_s3_admin
MINIO_ROOT_PASSWORD=use-a-strong-minio-password
S3_ENDPOINT_URL=http://minio:9000
S3_PUBLIC_URL=https://s3.yourdomain.com
S3_ACCESS_KEY_ID=studio_s3_admin
S3_SECRET_ACCESS_KEY=use-a-strong-minio-password
S3_BUCKET_NAME=wedding-storage
S3_REGION=us-east-1
GARAGE_S3_USE_LOCAL_MOCK=false

# Initial Admin Account (Auto-created on first startup)
ADMIN_NAME="Studio Admin"
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourAdminSecurePassword123!

# Email Delivery (e.g., Brevo, Resend, or SendGrid)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=notifications@yourdomain.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL="Wedding Studio <notifications@yourdomain.com>"
```

---

## 3. How Coolify Optimizations Work

### 3.1 Direct Streaming for 10–30 GB Files (No Buffering)
Coolify’s Traefik reverse proxy is pre-configured with streaming labels in `docker-compose.yml`:
```yaml
traefik.http.middlewares.minio-stream.buffering.maxRequestBodyBytes: 0
traefik.http.middlewares.minio-stream.buffering.memRequestBodyBytes: 0
```
- **What this does**: It tells Traefik **not to buffer request bodies in memory**.
- **Result**: When you upload a 30 GB wedding collection, the bytes stream directly from the photographer's browser over HTTPS straight onto your SSD in chunks. The Ubuntu laptop's RAM usage remains under 100 MB!

### 3.2 Automated Bucket & CORS Provisioning (`minio_setup`)
The `docker-compose.yml` includes an automatic 1-shot provisioner container (`minio_setup`) that runs `mc` (MinIO Client):
- Auto-creates the `wedding-storage` bucket if it doesn't already exist.
- Sets anonymous download policies and CORS so browser uploads from `https://photos.yourdomain.com` work seamlessly with zero manual CLI commands.

### 3.3 Visual Storage Dashboard
Access **`https://console.yourdomain.com`** in your browser and log in with your `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`.
From here, you can:
- See real-time storage metrics (e.g., 2.4 TB used / 4.8 TB free).
- View all album folders and photo thumbnails directly.
- Monitor active read/write speeds.

---

## 4. Activating Coolify's Built-In Superpowers

### 4.1 Automated Daily Database Backups
1. In Coolify, navigate to your **`wedding_db`** (PostgreSQL) container.
2. Go to the **Backups** tab.
3. Toggle **Enable Automated Backups**.
4. Set Cron schedule to `0 2 * * *` (runs every night at 2:00 AM).
5. Set retention (e.g., keep the last 14 days of backups).
*Backups can be saved to your local disk or sent to an off-site S3 bucket.*

### 4.2 Auto-Deploy on Git Push
In Coolify, under **Webhooks**, copy the GitHub Webhook URL and paste it into your GitHub repository settings under **Settings → Webhooks**.
- Every time you push a bug fix or feature to `main`, Coolify automatically runs:
  1. Build frontend & backend containers
  2. Runs migrations automatically (`python manage.py migrate`)
  3. Collects static assets
  4. Swaps containers with zero downtime!

---

## 5. Summary of Architecture in Coolify

```mermaid
flowchart TD
    Client["Client / Admin Browser"]
    Traefik["Coolify Traefik Edge Proxy\n(Automatic Let's Encrypt SSL)"]
    Gateway["Nginx Gateway\n(SPA & X-Accel-Redirect)"]
    Frontend["Vite React Frontend"]
    Backend["Django REST API"]
    MinIO["MinIO S3 Object Storage\n(Zero-Buffering Stream)"]
    SSD["Ubuntu 4-5 TB SSD Mount\n(/mnt/wedding_storage)"]
    DB[(PostgreSQL 16)]
    Redis[(Redis 7)]
    Worker["Celery Worker"]

    Client -->|"1. Web UI & Login (HTTPS)"| Traefik
    Traefik --> Gateway
    Gateway --> Frontend
    Gateway --> Backend
    Backend --> DB
    Backend --> Redis
    Worker --> Redis

    Client ==="2. Direct 10-30 GB Uploads & Downloads (Presigned S3)"===> Traefik
    Traefik ==="Zero-Buffer Stream"===> MinIO
    MinIO ==="Direct High-Speed I/O"===> SSD
```
