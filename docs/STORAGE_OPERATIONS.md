# Storage Operations & Maintenance Guide

This manual covers day-to-day operations, multi-disk management, disk addition and planned removal, backup and recovery procedures, and troubleshooting for the **Garage S3** private wedding storage system.

---

## 1. Core Architectural Characteristics

### 1.1 Single-Node Reality: No Independent Node Redundancy
> [!WARNING]
> This deployment operates as a **single-node instance**.
> Although Garage uses multiple SSD data directories (`/mnt/ssd1/garage-data`, `/mnt/ssd2/garage-data`), this is purely for **capacity pooling** (~4 TB total) and I/O parallelism. It is **NOT** a backup system and provides no independent hardware fault tolerance.
>
> If a physical drive fails in a single-node configuration, any object blocks stored on that drive cannot be reconstructed automatically. **Always maintain an external or off-site secondary copy** of critical wedding archives and camera masters.

### 1.2 Internal Object Block Storage
Garage does **not** create a standard readable filesystem directory hierarchy of original photos and videos. Instead:
- Uploaded media objects are split into encrypted/hashed content-addressed data blocks stored inside the `data_dir` slices.
- File metadata, names, MIME types, and chunk offsets are indexed inside `metadata_dir` (using LMDB).
- Existing external photo collections **cannot** be dropped into the data folder via filesystem copy; they must be ingested through the S3 API.

---

## 2. Multi-Disk Management

### 2.1 Supported Disk Addition Procedure
When your studio archives grow and you want to expand storage with an additional SSD (e.g. SSD 3 - 2 TB):

1. **Format and Identify New Disk:**
   ```bash
   sudo mkfs.ext4 -L garage-ssd3 /dev/sdX1
   sudo blkid /dev/sdX1 # Note the UUID
   ```

2. **Create Persistent Mount Point:**
   ```bash
   sudo mkdir -p /mnt/ssd3/garage-data
   sudo touch /mnt/ssd3/garage-data/.mounted
   ```

3. **Add Entry to `/etc/fstab`:**
   ```text
   UUID=<NEW_DISK_UUID> /mnt/ssd3/garage-data ext4 defaults,noatime,nofail 0 2
   ```
   Mount the drive:
   ```bash
   sudo mount -a
   ```

4. **Update `compose.yaml` Bind-Mounts:**
   In `deploy/storage/compose.yaml`, add:
   ```yaml
   volumes:
     - /mnt/ssd3/garage-data:/var/lib/garage/data/disk3
   ```

5. **Update `garage.toml` Data Directories:**
   In `deploy/storage/garage.toml`:
   ```toml
   data_dir = [
     { path = "/var/lib/garage/data/disk1", capacity = "2T" },
     { path = "/var/lib/garage/data/disk2", capacity = "2T" },
     { path = "/var/lib/garage/data/disk3", capacity = "2T" } # Added disk
   ]
   ```

6. **Restart Garage Container:**
   ```bash
   docker compose down
   docker compose up -d
   ```

7. **Update Cluster Layout & Rebalance:**
   ```bash
   NODE_ID=$(docker compose exec garage /garage status | awk '/=== HEALTHY NODES ===/{getline; print $1}')
   # Update total capacity to 6T
   docker compose exec garage /garage layout assign -z dc1 -c 6T $NODE_ID
   docker compose exec garage /garage layout apply --version 2

   # Rebalance blocks across the newly added storage
   docker compose exec garage /garage repair rebalance
   ```

---

### 2.2 Planned Disk Removal / Decommissioning Procedure
Never unplug an active drive ("hot-unplugging"). To safely decommission an SSD (e.g., replacing SSD 1):

1. **Mark Disk as Read-Only in `garage.toml`:**
   ```toml
   data_dir = [
     { path = "/var/lib/garage/data/disk1", capacity = "2T", read_only = true },
     { path = "/var/lib/garage/data/disk2", capacity = "2T" },
     { path = "/var/lib/garage/data/disk3", capacity = "2T" }
   ]
   ```
2. **Restart Garage:**
   ```bash
   docker compose restart garage
   ```
3. **Rebalance Blocks Off the Retiring Disk:**
   ```bash
   docker compose exec garage /garage repair rebalance
   ```
4. **Verify Disk Emptied & Remove:**
   Once all blocks have migrated to the remaining disks:
   - Remove the path from `garage.toml` and `compose.yaml`.
   - Update layout capacity with `garage layout assign` and `garage layout apply`.
   - Safely unmount `/mnt/ssd1/garage-data` and update `/etc/fstab`.

---

## 3. Abandoned Upload Cleanup

Large multipart uploads (e.g. 20–30 GB video collections) interrupted by network failure or browser closure leave uncompleted part chunks stored in the S3 bucket until explicitly aborted.

The platform includes a scheduled cleanup management command:
```bash
python backend/manage.py cleanup_abandoned_uploads --hours 24
```

### What this command does:
1. Identifies any `UploadSession` records in `initiated` or `uploading` state older than the threshold (default: 24 hours).
2. Issues an S3 `abort_multipart_upload` request to Garage for each abandoned upload ID.
3. Garage immediately frees the orphaned disk blocks on the SSDs.
4. Marks the upload session as `expired` and cleans up pending media records.

**Recommended Cron / Systemd Timer on Ubuntu:**
```bash
# Run daily at 04:00 AM UTC
0 4 * * * cd /home/ubuntu/weddingApp/backend && python manage.py cleanup_abandoned_uploads --hours 24 >> /var/log/wedding_cleanup.log 2>&1
```

---

## 4. Backup & Disaster Recovery

A complete backup comprises two components:
1. **The Application Database:** Stores client metadata, album structure, object keys, and access tokens.
2. **Garage Storage:** Stores the metadata database and object data blocks.

### Step 4.1: Database Backup
```bash
# PostgreSQL
pg_dump -U wedding_user -d wedding_db -Fc > /backup/wedding_db_$(date +%Y%m%d).dump

# SQLite (Development)
sqlite3 backend/db.sqlite3 ".backup '/backup/db_$(date +%Y%m%d).sqlite3'"
```

### Step 4.2: Garage Metadata Backup
Stop writes or take an automatic snapshot:
```bash
docker compose exec garage /garage admin snapshot
# Copy metadata directory
rsync -a /var/lib/garage/meta/ /backup/garage_meta/
```

### Step 4.3: Disaster Recovery Restore Test
To restore the storage cluster onto a new server:
1. Re-mount your persistent SSD data drives.
2. Restore the metadata folder to `/var/lib/garage/meta`.
3. Restore the application database.
4. Start the Garage container:
   ```bash
   docker compose up -d
   docker compose exec garage /garage status
   ```
5. Verify object accessibility using the AWS CLI or website gallery.

---

## 5. Troubleshooting & Diagnostics

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **CORS error on browser upload** | Bucket CORS policy missing or wrong origin | Check `deploy/storage/cors.json` and re-apply via `aws s3api put-bucket-cors`. Ensure website origin is included. |
| **SignatureDoesNotMatch** | Presigned URL generated with wrong hostname or clock skew | Ensure server system clock is synced with NTP (`timedatectl`). Check that `GARAGE_S3_PUBLIC_URL` matches the exact browser URL (`https://cloud.abcd.com`). |
| **Storage Temporarily Unavailable (503)** | Garage container stopped or proxy port misconfigured | Verify container status: `docker compose ps`. Test local S3 endpoint: `curl -I http://127.0.0.1:3900`. |
| **Disk fill warning** | Abandoned multipart parts consuming space | Run `python backend/manage.py cleanup_abandoned_uploads --hours 1`. |
