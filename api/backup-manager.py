#!/usr/bin/env python3
"""
SMC Training — Backup Manager
Có thể chạy local (macOS/Linux) hoặc trên Plesk server.

Cách dùng:
  python3 api/backup-manager.py [daily|weekly|cleanup]

CRON setup (Plesk):
  0 2 * * * cd /var/www/vhosts/smc-training.com/httpdocs && python3 api/backup-manager.py daily
  0 3 * * 0 cd /var/www/vhosts/smc-training.com/httpdocs && python3 api/backup-manager.py weekly
  0 4 * * * cd /var/www/vhosts/smc-training.com/httpdocs && python3 api/backup-manager.py cleanup

CRON setup (Local macOS):
  0 2 * * * cd /Users/hoangtan/Desktop/Phần\ mềm/smc-training && python3 api/backup-manager.py daily
"""

import json
import os
import sys
import shutil
import tarfile
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'api', 'data')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
RETENTION_DAYS = 30

os.makedirs(BACKUP_DIR, exist_ok=True)

def log(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {msg}")
    # Also append to log file
    log_file = os.path.join(BACKUP_DIR, 'backup.log')
    with open(log_file, 'a') as f:
        f.write(f"[{timestamp}] {msg}\n")

def daily_backup():
    """Backup JSON data files hàng ngày"""
    log("========== DAILY BACKUP ==========")
    date_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"smc-backup-{date_str}.tar.gz"
    backup_path = os.path.join(BACKUP_DIR, backup_name)

    # Backup all JSON data files
    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json') and not f.startswith('.')]

    with tarfile.open(backup_path, 'w:gz') as tar:
        for f in json_files:
            file_path = os.path.join(DATA_DIR, f)
            tar.add(file_path, arcname=f)

    size_mb = os.path.getsize(backup_path) / (1024 * 1024)
    log(f"  ✅ Backup: {backup_name} ({size_mb:.1f} MB) — {len(json_files)} files")

    return backup_path

def weekly_backup():
    """Backup hàng tuần: full data + audit snapshot"""
    log("========== WEEKLY BACKUP (FULL) ==========")
    date_str = datetime.now().strftime('%Y%m%d')

    # 1. Full JSON backup
    json_backup_name = f"smc-weekly-json-{date_str}.tar.gz"
    json_backup_path = os.path.join(BACKUP_DIR, json_backup_name)

    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json') and not f.startswith('.')]
    with tarfile.open(json_backup_path, 'w:gz') as tar:
        for f in json_files:
            file_path = os.path.join(DATA_DIR, f)
            tar.add(file_path, arcname=f)

    size_mb = os.path.getsize(json_backup_path) / (1024 * 1024)
    log(f"  ✅ JSON full backup: {json_backup_name} ({size_mb:.1f} MB)")

    # 2. Data snapshot report
    snapshot = {
        "date": date_str,
        "files": {},
        "totals": {}
    }

    for f in sorted(json_files):
        file_path = os.path.join(DATA_DIR, f)
        try:
            with open(file_path, 'r') as fh:
                data = json.load(fh)
            count = len(data) if isinstance(data, list) else len(data.keys()) if isinstance(data, dict) else 1
            size_kb = os.path.getsize(file_path) / 1024
            snapshot["files"][f] = {"records": count, "size_kb": round(size_kb, 1)}
        except Exception as e:
            snapshot["files"][f] = {"error": str(e)}

    snapshot_path = os.path.join(BACKUP_DIR, f"snapshot-{date_str}.json")
    with open(snapshot_path, 'w') as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)
    log(f"  ✅ Snapshot: snapshot-{date_str}.json")

    return json_backup_path

def cleanup():
    """Xóa backup cũ hơn RETENTION_DAYS"""
    log("========== CLEANUP OLD BACKUPS ==========")
    cutoff = datetime.now() - timedelta(days=RETENTION_DAYS)
    deleted = 0
    freed = 0

    for f in os.listdir(BACKUP_DIR):
        file_path = os.path.join(BACKUP_DIR, f)
        if not os.path.isfile(file_path):
            continue
        if f in ['backup.log', '.gitkeep']:
            continue
        if f.startswith('snapshot-') and f.endswith('.json'):
            continue

        mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
        if mtime < cutoff:
            size = os.path.getsize(file_path)
            os.remove(file_path)
            deleted += 1
            freed += size
            log(f"  🗑  Đã xóa: {f} ({size/(1024*1024):.1f} MB)")

    freed_mb = freed / (1024 * 1024)
    log(f"  ✅ Đã xóa {deleted} file cũ, giải phóng {freed_mb:.1f} MB")

def status():
    """Hiển thị trạng thái backup hiện tại"""
    log("========== BACKUP STATUS ==========")
    if not os.path.isdir(BACKUP_DIR):
        log("  ❌ Thư mục backup chưa tồn tại")
        return

    backups = [f for f in os.listdir(BACKUP_DIR)
               if os.path.isfile(os.path.join(BACKUP_DIR, f))
               and f not in ['backup.log', '.gitkeep']]

    total_size = sum(os.path.getsize(os.path.join(BACKUP_DIR, f)) for f in backups)

    log(f"  Thư mục: {BACKUP_DIR}")
    log(f"  Tổng file backup: {len(backups)}")
    log(f"  Tổng dung lượng: {total_size/(1024*1024):.1f} MB")
    log(f"  Retention: {RETENTION_DAYS} ngày")

    for b in sorted(backups, reverse=True)[:5]:
        bp = os.path.join(BACKUP_DIR, b)
        mtime = datetime.fromtimestamp(os.path.getmtime(bp))
        age = (datetime.now() - mtime).days
        size_mb = os.path.getsize(bp) / (1024 * 1024)
        log(f"    {b} — {size_mb:.1f} MB — {age} ngày trước")

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'

    if cmd == 'daily':
        daily_backup()
        cleanup()
    elif cmd == 'weekly':
        weekly_backup()
        cleanup()
    elif cmd == 'cleanup':
        cleanup()
    elif cmd == 'status':
        status()
    else:
        print(f"Usage: python3 backup-manager.py [daily|weekly|cleanup|status]")
        print(f"  daily   — Backup JSON data files")
        print(f"  weekly  — Full backup + snapshot report")
        print(f"  cleanup — Delete backups older than {RETENTION_DAYS} days")
        print(f"  status  — Show backup status")
        sys.exit(1)
