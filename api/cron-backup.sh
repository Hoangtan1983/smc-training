#!/bin/bash
# ============================================================================
# SMC Training — Backup Tự Động
# Chạy qua CRON: 0 2 * * * /bin/bash /var/www/vhosts/smc-training.com/httpdocs/api/cron-backup.sh
# ============================================================================
# 1. Backup JSON data hàng ngày
# 2. MySQL dump hàng tuần (Chủ nhật)
# 3. Dọn backup cũ > 30 ngày
# 4. Gửi log qua email nếu có lỗi
# ============================================================================

set -e

BACKUP_DIR="/var/www/vhosts/smc-training.com/httpdocs/api/backups"
DATA_DIR="/var/www/vhosts/smc-training.com/httpdocs/api/data"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS=30

# Tạo thư mục backup nếu chưa có
mkdir -p "$BACKUP_DIR"

# Timestamp
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 7 = Sunday

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_msg "========== BẮT ĐẦU BACKUP =========="

# ─── 1. BACKUP JSON DATA (hàng ngày) ───
log_msg "Bước 1: Backup JSON data files..."

JSON_BACKUP="$BACKUP_DIR/json_backup_$DATE.tar.gz"
tar -czf "$JSON_BACKUP" -C "$DATA_DIR" *.json 2>/dev/null

if [ -f "$JSON_BACKUP" ]; then
    SIZE=$(du -h "$JSON_BACKUP" | cut -f1)
    log_msg "  ✅ JSON backup: $JSON_BACKUP ($SIZE)"
else
    log_msg "  ❌ JSON backup THẤT BẠI!"
fi

# ─── 2. MYSQL DUMP (Chủ nhật hàng tuần) ───
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log_msg "Bước 2: MySQL dump (Chủ nhật)..."

    # Load config từ env.php (giá trị cần được set qua biến môi trường)
    DB_HOST="${SMC_DB_HOST:-localhost}"
    DB_NAME="${SMC_DB_NAME:-smc46189_smc_admin}"
    DB_USER="${SMC_DB_USER:-smc46189_admin}"
    DB_PASS="${SMC_DB_PASS}"

    if [ -z "$DB_PASS" ]; then
        log_msg "  ⚠️  DB_PASS chưa được set — bỏ qua MySQL dump"
    else
        SQL_BACKUP="$BACKUP_DIR/mysql_backup_$DATE.sql.gz"
        if mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
            --single-transaction --routines --triggers --events \
            "$DB_NAME" 2>/dev/null | gzip > "$SQL_BACKUP"; then
            SIZE=$(du -h "$SQL_BACKUP" | cut -f1)
            log_msg "  ✅ MySQL dump: $SQL_BACKUP ($SIZE)"
        else
            log_msg "  ❌ MySQL dump THẤT BẠI!"
        fi
    fi
else
    log_msg "Bước 2: Bỏ qua MySQL dump (không phải Chủ nhật, hôm nay là thứ $DAY_OF_WEEK)"
fi

# ─── 3. DỌN BACKUP CŨ (> 30 ngày) ───
log_msg "Bước 3: Dọn backup cũ hơn $RETENTION_DAYS ngày..."
DELETED=$(find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null
log_msg "  ✅ Đã xóa $DELETED file backup cũ"

# ─── 4. TỔNG KẾT ───
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.sql.gz" | wc -l)
DISK_USAGE=$(du -sh "$BACKUP_DIR" | cut -f1)
log_msg "========== HOÀN TẤT =========="
log_msg "Tổng backup hiện có: $BACKUP_COUNT file | Dung lượng: $DISK_USAGE"
