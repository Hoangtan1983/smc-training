#!/bin/bash
# SMC Training - Quick Deploy Script
# Upload dist files to Mắt Bão Plesk via curl FTP
# Usage: bash deploy-now.sh

FTP_HOST="s88d71.cloudnetwork.vn"
FTP_USER="smc46189"
FTP_PASS="YiJu#0PiKo@4KiTa"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== SMC Training Deploy ==="
echo "Server: $FTP_HOST"
echo ""

upload_file() {
    local local_path="$1"
    local remote_path="$2"
    echo -n "Uploading $remote_path ... "
    curl -s -u "${FTP_USER}:${FTP_PASS}" --ftp-ssl \
        -T "$local_path" \
        "ftp://${FTP_HOST}/httpdocs/${remote_path}" \
        --connect-timeout 10 -m 60 2>&1
    if [ $? -eq 0 ]; then
        echo "✅"
    else
        echo "❌ (retrying...)"
        sleep 5
        curl -s -u "${FTP_USER}:${FTP_PASS}" --ftp-ssl \
            -T "$local_path" \
            "ftp://${FTP_HOST}/httpdocs/${remote_path}" \
            --connect-timeout 10 -m 60 2>&1
        [ $? -eq 0 ] && echo "✅" || echo "❌ FAILED"
    fi
}

# 1. index.html
upload_file "$LOCAL_DIR/dist/index.html" "index.html"

# 2. Assets
for f in "$LOCAL_DIR/dist/assets/"*; do
    fn=$(basename "$f")
    upload_file "$f" "assets/$fn"
    sleep 2
done

# 3. API files
for f in auth.php auth-lib.php helpers.php agency.php tuition-service.php; do
    upload_file "$LOCAL_DIR/api/$f" "api/$f"
    sleep 2
done

echo ""
echo "=== Done ==="
echo "Verify: https://smc-training.com"
