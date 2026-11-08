# Cloudflare Tunnel Configuration Guide for Coolify

This guide explains how to expose your **Wedding Photo Platform** and **MinIO S3 Storage (4–5 TB SSD)** running on your Ubuntu laptop/server to your custom domain (e.g. `yourdomain.com`) using **Cloudflare Tunnel** (`cloudflared`).

---

## 🌟 Why Cloudflare Tunnel?

- **No Public IP Needed**: Works behind CGNAT, home broadband, or dynamic ISP connections.
- **No Port Forwarding**: You do not need to open ports 80/443 on your home router.
- **Automatic Free SSL / DDoS Protection**: Cloudflare terminates HTTPS and protects against attacks.
- **Direct 4–5 TB S3 Storage Access**: Clients and photographers upload straight to your laptop's SSD.

---

## Architecture Overview

```
[ Photographers / Guests ]
           │
           ▼ (HTTPS / Custom Domain)
[ Cloudflare Edge Network ]
   ├─ photos.yourdomain.com
   ├─ s3.yourdomain.com
   └─ console.yourdomain.com
           │
           ▼ (Encrypted Outbound Tunnel)
[ Ubuntu Laptop: cloudflared ]
           │
           ├─► localhost:80   ──► Coolify Traefik ──► wedding_gateway (App & API)
           ├─► localhost:80   ──► Coolify Traefik ──► wedding_minio (S3 Storage)
           └─► localhost:9001 ──► wedding_minio (Visual Admin Console)
```

---

## Step 1: Create the Tunnel in Cloudflare Zero Trust

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. On the left sidebar, click **Zero Trust**.
3. Inside Zero Trust, go to **Networks** → **Tunnels**.
4. Click **Create a tunnel** (or **Add a tunnel**).
5. Select **Cloudflared** and click **Next**.
6. Name your tunnel: `wedding-laptop` and click **Save tunnel**.
7. Cloudflare will display installation commands for **Debian 64-bit**. Copy the **Tunnel Token** (the long string following `--token`).

---

## Step 2: Install `cloudflared` on Your Ubuntu Laptop

Open your Ubuntu laptop terminal and install `cloudflared` as an automatic system service:

```bash
# Download latest cloudflared package
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install package
sudo dpkg -i cloudflared.deb

# Install and start tunnel service (replace <TUNNEL_TOKEN> with your token)
sudo cloudflared service install <TUNNEL_TOKEN>

# Verify tunnel status
sudo systemctl status cloudflared
```

*In your Cloudflare dashboard, the tunnel status will turn **Healthy (GREEN)**.*

---

## Step 3: Configure Public Hostnames in Cloudflare Tunnel

In the Cloudflare Zero Trust dashboard, go to your tunnel's **Public Hostname** tab and add the following 3 routes:

### Route 1: Main Wedding App (Frontend + Backend API)
- **Subdomain**: `photos`
- **Domain**: `yourdomain.com`
- **Path**: *(leave empty)*
- **Type**: `HTTP`
- **URL**: `localhost:80`
- **Additional Settings (under HTTP Settings)**:
  - *HTTP Host Header*: `photos.yourdomain.com`

---

### Route 2: MinIO S3 Object Storage API (File Uploads / Downloads)
- **Subdomain**: `s3`
- **Domain**: `yourdomain.com`
- **Path**: *(leave empty)*
- **Type**: `HTTP`
- **URL**: `localhost:80`
- **Additional Settings (under HTTP Settings)**:
  - *HTTP Host Header*: `s3.yourdomain.com`

---

### Route 3: MinIO S3 Visual Admin Console (Optional)
- **Subdomain**: `console`
- **Domain**: `yourdomain.com`
- **Path**: *(leave empty)*
- **Type**: `HTTP`
- **URL**: `localhost:9001`

---

### Route 4: Coolify Dashboard (Optional, to manage Coolify remotely)
- **Subdomain**: `coolify`
- **Domain**: `yourdomain.com`
- **Path**: *(leave empty)*
- **Type**: `HTTP`
- **URL**: `localhost:8000`

---

## Step 4: Configure Cloudflare SSL/TLS Settings

In your standard [Cloudflare Dashboard](https://dash.cloudflare.com/) for `yourdomain.com`:

1. Go to **SSL/TLS** → **Overview**.
2. Set encryption mode to **Full** (or **Flexible**).
3. Go to **SSL/TLS** → **Edge Certificates**:
   - Turn **Always Use HTTPS** → `ON`
   - Set **Minimum TLS Version** → `TLS 1.2`
   - Turn **Opportunistic Encryption** → `ON`
4. Go to **Network**:
   - Turn **WebSockets** → `ON` (default is ON).

---

## Step 5: Coolify Application Environment Variables

In your Coolify application dashboard, navigate to **Environment Variables** and set the following configuration (replace `yourdomain.com` with your actual domain):

```env
# ========================================================
# 1. PUBLIC DOMAINS (Routed via Cloudflare Tunnel)
# ========================================================
SERVICE_FQDN_APP=https://photos.yourdomain.com
SERVICE_FQDN_MINIO=https://s3.yourdomain.com
SERVICE_FQDN_MINIO_CONSOLE=https://console.yourdomain.com

# ========================================================
# 2. PHYSICAL STORAGE (4–5 TB SSD on Ubuntu)
# ========================================================
HOST_STORAGE_PATH=/mnt/wedding_storage
HOST_MEDIA_PATH=/mnt/wedding_storage/media_data

# ========================================================
# 3. DJANGO SECURITY & CLOUDFLARE SSL
# ========================================================
DJANGO_SECRET_KEY=generate-a-strong-random-64-character-secret
DEBUG=False
DJANGO_SETTINGS_MODULE=config.settings.prod
ALLOWED_HOSTS=photos.yourdomain.com,s3.yourdomain.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://photos.yourdomain.com,https://s3.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://photos.yourdomain.com

# ========================================================
# 4. DATABASE & REDIS
# ========================================================
POSTGRES_DB=wedding_platform
POSTGRES_USER=wedding_user
POSTGRES_PASSWORD=generate-a-secure-db-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
REDIS_URL=redis://redis:6379/0

# ========================================================
# 5. S3 / MINIO CONFIGURATION
# ========================================================
MINIO_ROOT_USER=studio_s3_admin
MINIO_ROOT_PASSWORD=generate-a-secure-minio-password
S3_ENDPOINT_URL=http://minio:9000
S3_PUBLIC_URL=https://s3.yourdomain.com
S3_ACCESS_KEY_ID=studio_s3_admin
S3_SECRET_ACCESS_KEY=generate-a-secure-minio-password
S3_BUCKET_NAME=wedding-storage
S3_REGION=us-east-1
GARAGE_S3_USE_LOCAL_MOCK=false

# ========================================================
# 6. INITIAL ADMIN USER (Auto-created on first boot)
# ========================================================
ADMIN_NAME="Studio Admin"
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
```

Click **Save** and **Redeploy** in Coolify.

---

## ⚡ Handling Large 10–30 GB Files Over Cloudflare

### Why Cloudflare's 100 MB Limit Is NOT an Issue:
- Cloudflare Free and Pro plans limit **individual HTTP requests** to 100 MB.
- This platform's uploader ([S3UploadModal.jsx](file:///frontend/src/components/S3UploadModal.jsx)) automatically uses **S3 Multipart Chunked Uploading** via `@uppy/aws-s3`.
- Files larger than 20 MB are automatically sliced into **5 MB chunks**.
- Because every chunk transmitted over the Cloudflare Tunnel is only 5 MB, you can upload **5 GB, 20 GB, or 100 GB** wedding galleries without ever triggering Cloudflare's `413 Payload Too Large` error!

---

## 🛡️ Cloudflare WAF Tip (Avoid False Bot Blocks)

MinIO S3 multipart uploads send parallel HTTP PUT requests. To ensure Cloudflare doesn't block high-speed batch uploads:

1. In Cloudflare Dashboard, go to **Security** → **WAF** → **Custom Rules**.
2. Click **Create rule**:
   - Rule Name: `Allow S3 Uploads`
   - Field: `Hostname`
   - Operator: `equals`
   - Value: `s3.yourdomain.com`
   - Action: **Skip** (Select *All remaining Security Rules*).
3. Click **Deploy**.

---

## 🚀 Verification Checklist

1. Open `https://photos.yourdomain.com` in your browser:
   - Green padlock (HTTPS) provided by Cloudflare.
   - Wedding photo login / gallery UI loads cleanly.
2. Open `https://console.yourdomain.com`:
   - MinIO console loads; sign in with `MINIO_ROOT_USER` & `MINIO_ROOT_PASSWORD`.
   - You should see `wedding-storage` bucket with your 4–5 TB capacity available.
3. Upload a test 4K photo or zip file:
   - Progress bar uploads chunks to `s3.yourdomain.com`.
   - File appears immediately on your Ubuntu SSD under `/mnt/wedding_storage`.

