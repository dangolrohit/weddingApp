# Lightweight Private Wedding Photo/Video Storage Setup

This guide details the complete deployment of **Garage S3** on an Ubuntu server, configuring persistent multi-SSD storage pooling (~4 TB), provisioning S3 keys and buckets, setting up CORS, and routing public traffic via reverse proxy (Nginx / Coolify) at `https://cloud.abcd.com`.

---

## 1. Storage Topology & Requirements

- **Metadata Drive:** Fast internal NVMe or SATA SSD (mount: `/var/lib/garage/meta`).
- **Data Drives (2x 2 TB SSDs = ~4 TB total):**
  - SSD 1: Persistent mount at `/mnt/ssd1/garage-data`
  - SSD 2: Persistent mount at `/mnt/ssd2/garage-data`
- **Single-Node Layout:**
  > [!IMPORTANT]
  > A single-node configuration has **no independent node redundancy**. Multiple data disks provide capacity pooling and load distribution across drives, but they **are not backups**. If an unmirrored drive suffers physical failure, data blocks residing on that drive are lost. Maintain offline backups of your master camera cards or external archive drives.

---

## 2. Disk Mounts by UUID (Ubuntu Server)

Never rely on volatile device names like `/dev/sdb` or `/dev/sdc`, as device order can change across reboots. Always mount disks by their filesystem UUID.

### Step 2.1: Identify Disk UUIDs
Run the following command on Ubuntu:
```bash
sudo blkid
```
Example output:
```text
/dev/nvme0n1p2: UUID="a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d" TYPE="ext4" (System / Metadata)
/dev/sda1:      UUID="11111111-2222-3333-4444-555555555555" TYPE="ext4" (SSD 1 - 2 TB)
/dev/sdb1:      UUID="66666666-7777-8888-9999-aaaaaaaaaaaa" TYPE="ext4" (SSD 2 - 2 TB)
```

### Step 2.2: Create Verified Mount Points
```bash
# Create mount points on the host system
sudo mkdir -p /mnt/ssd1/garage-data
sudo mkdir -p /mnt/ssd2/garage-data
sudo mkdir -p /var/lib/garage/meta

# Set permissions for container access
sudo chmod -R 750 /mnt/ssd1/garage-data /mnt/ssd2/garage-data /var/lib/garage/meta
```

### Step 2.3: Configure `/etc/fstab` with `nofail`
Edit `/etc/fstab`:
```bash
sudo nano /etc/fstab
```
Add the persistent mount entries (replace with your actual UUIDs):
```text
# Dedicated Garage SSD 1 (2 TB)
UUID=11111111-2222-3333-4444-555555555555 /mnt/ssd1/garage-data ext4 defaults,noatime,nofail 0 2

# Dedicated Garage SSD 2 (2 TB)
UUID=66666666-7777-8888-9999-aaaaaaaaaaaa /mnt/ssd2/garage-data ext4 defaults,noatime,nofail 0 2
```
Mount and test:
```bash
sudo mount -a
df -h /mnt/ssd1/garage-data /mnt/ssd2/garage-data /var/lib/garage/meta
```

### Step 2.4: Mount Verification Guard (Preventing Writes to Root Disk)
To prevent accidental writes into empty root mount-point directories if an SSD is disconnected, place a `.mounted` sentinel file inside the root of each drive:
```bash
sudo touch /mnt/ssd1/garage-data/.mounted
sudo touch /mnt/ssd2/garage-data/.mounted
```
Verify before launching Garage:
```bash
if [ -f /mnt/ssd1/garage-data/.mounted ] && [ -f /mnt/ssd2/garage-data/.mounted ]; then
    echo "Storage mounts verified. Safe to start Garage."
else
    echo "ERROR: One or more SSDs are not mounted! Aborting startup to protect root partition." >&2
    exit 1
fi
```

---

## 3. Provisioning Garage Configuration

### Step 3.1: Generate Cryptographic Secrets
Run on the server:
```bash
# 32-byte RPC Secret
RPC_SECRET=$(openssl rand -hex 32)
echo "RPC Secret: $RPC_SECRET"

# 16-byte Admin Token
ADMIN_TOKEN=$(openssl rand -hex 16)
echo "Admin Token: $ADMIN_TOKEN"
```

### Step 3.2: Configure `garage.toml`
Copy `deploy/storage/garage.toml.example` to `deploy/storage/garage.toml`:
```bash
cp deploy/storage/garage.toml.example deploy/storage/garage.toml
```
Update the generated tokens and public domain:
- `rpc_secret = "<YOUR_RPC_SECRET>"`
- `admin_token = "<YOUR_ADMIN_TOKEN>"`
- `s3_endpoint = "https://cloud.abcd.com"`

---

## 4. Starting the Garage Container

Start Garage using Docker Compose:
```bash
cd deploy/storage
docker compose up -d
```
Check container logs and health:
```bash
docker compose logs -f garage
```

---

## 5. Garage Cluster Layout, Keys, and Bucket Provisioning

Run these commands inside the running container (or using the `garage` CLI):

### Step 5.1: Initialize Single-Node Layout
```bash
# 1. Get Node ID
docker compose exec garage /garage status

# Example output shows node ID: e.g. 9b8a7c6d5e4f3a2b1c0d...
NODE_ID=$(docker compose exec garage /garage status | awk '/=== HEALTHY NODES ===/{getline; print $1}')

# 2. Assign capacity (4T total across SSDs) in zone dc1
docker compose exec garage /garage layout assign -z dc1 -c 4T $NODE_ID

# 3. Preview layout
docker compose exec garage /garage layout show

# 4. Apply layout
docker compose exec garage /garage layout apply --version 1
```

### Step 5.2: Create S3 Access Key
```bash
docker compose exec garage /garage key create wedding-app-key
```
Garage outputs:
```text
Key name: wedding-app-key
Key ID:   GKxxxxxxxxxxxxxxxxxxxxxx
Secret:   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Copy these credentials into your Django `.env`:
```text
GARAGE_S3_ACCESS_KEY_ID=GKxxxxxxxxxxxxxxxxxxxxxx
GARAGE_S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GARAGE_S3_BUCKET_NAME=wedding-storage
GARAGE_S3_ENDPOINT_URL=http://127.0.0.1:3900
GARAGE_S3_PUBLIC_URL=https://cloud.abcd.com
GARAGE_S3_REGION=garage
```

### Step 5.3: Create Bucket and Grant Permissions
```bash
# Create the storage bucket
docker compose exec garage /garage bucket create wedding-storage

# Allow read and write permissions for the application key
docker compose exec garage /garage bucket allow wedding-storage --read --write --key wedding-app-key
```

### Step 5.4: Apply Bucket CORS Configuration
Using the AWS CLI configured with the Garage credentials:
```bash
AWS_ACCESS_KEY_ID=GKxxxxxxxxxxxxxxxxxxxxxx \
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
aws --endpoint-url http://127.0.0.1:3900 s3api put-bucket-cors \
  --bucket wedding-storage \
  --cors-configuration file://cors.json
```
Verify CORS:
```bash
AWS_ACCESS_KEY_ID=GKxxxxxxxxxxxxxxxxxxxxxx \
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
aws --endpoint-url http://127.0.0.1:3900 s3api get-bucket-cors \
  --bucket wedding-storage
```

---

## 6. Public HTTPS Reverse Proxy (`cloud.abcd.com`)

Expose **only** the S3 API port (3900) to the public domain `cloud.abcd.com`. Keep the admin port (3903) and RPC port (3901) private.

### Nginx Reverse Proxy Configuration
```nginx
server {
    server_name cloud.abcd.com;

    # SSL configuration (Let's Encrypt / Certbot)
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/cloud.abcd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.abcd.com/privkey.pem;

    # Maximum upload size for large wedding video/photo files (50 GB)
    client_max_body_size 50G;

    # Prevent proxy buffering of large direct-to-S3 uploads and downloads
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_http_version 1.1;

    # Proxy to Garage S3 API (Port 3900)
    location / {
        proxy_pass http://127.0.0.1:3900;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for large file streams
        proxy_connect_timeout 300s;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

---

## 7. Storage Capacity & Overhead Planning

| Storage Tier | Assigned Disks | Capacity | Expected Overhead | Usable Capacity |
| :--- | :--- | :--- | :--- | :--- |
| **Metadata** | Internal NVMe | 20–50 GB | ~1–2% of total data | Fast LMDB index |
| **Data SSD 1** | External/Internal SSD | 2 TB | ~2–3% block headers | ~1.94 TB |
| **Data SSD 2** | External/Internal SSD | 2 TB | ~2–3% block headers | ~1.94 TB |
| **Total** | Multi-SSD Pool | **4 TB** | ~80 GB metadata/indexing | **~3.88 TB Usable** |

Direct browser transfers ensure that 10–30 GB client albums upload straight from the photographer's browser to the storage server without touching Python/Django worker memory.

