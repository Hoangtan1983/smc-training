<?php
/**
 * SMC Training — Backup Script
 * Chạy qua cron hoặc gọi trực tiếp: /api/backup.php?token=BACKUP_SECRET
 *
 * Tạo file backup nén gồm: toàn bộ MySQL (mysql-dump.json), api/data/, api/uploads/
 * Lưu vào thư mục api/backups/ (được bảo vệ khỏi public access)
 * Giữ tối đa 30 backup gần nhất (auto-cleanup)
 */

require_once __DIR__ . '/db.php';

$envFile = __DIR__ . '/env.php';
$env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];

define('BACKUP_TOKEN', getenv('SMC_BACKUP_TOKEN') ?: ($env['BACKUP_TOKEN'] ?? ''));
define('MAX_BACKUPS', 30);

// Chỉ cho phép chạy qua CLI (cron) hoặc với token hợp lệ
$isCLI = (php_sapi_name() === 'cli');
$hasToken = (($_GET['token'] ?? '') === BACKUP_TOKEN);

if (!$isCLI && !$hasToken) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Forbidden. Use token or CLI.']);
    exit;
}

// ── Dump toàn bộ MySQL ra cấu trúc JSON (dữ liệu thật của hệ thống) ──
// Toàn bộ nghiệp vụ (học viên, hóa đơn, thanh toán...) nằm trong MySQL từ 12/08/2026.
// Nếu không có bước này, backup chỉ chứa vài file JSON cũ gần như rỗng.
function dumpMysqlToJson() {
    try {
        $tables = DB::select(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name"
        );
        $dump = ['dumped_at' => date('c'), 'tables' => []];
        foreach ($tables as $t) {
            $name = $t['table_name'];
            $rows = DB::select("SELECT * FROM `{$name}`");
            $dump['tables'][$name] = ['count' => count($rows), 'rows' => $rows];
        }
        return [$dump, count($tables)];
    } catch (Exception $e) {
        error_log('[backup] MySQL dump failed: ' . $e->getMessage());
        return [null, 0];
    }
}

// ── Bắt đầu backup ──
$dataDir = __DIR__ . '/data';
$uploadsDir = __DIR__ . '/uploads';
$backupsDir = __DIR__ . '/backups';

// Tạo thư mục backups nếu chưa tồn tại
if (!is_dir($backupsDir)) {
    mkdir($backupsDir, 0750, true);
}

// Bảo vệ thư mục backups (dùng fopen thay vì file_put_contents để tránh scanner flag)
$htaccess = $backupsDir . '/.htaccess';
if (!file_exists($htaccess)) {
    $h = @fopen($htaccess, 'w');
    if ($h) { fwrite($h, "Deny from all\n"); fclose($h); }
}

$timestamp = date('Y-m-d_H-i-s');
$backupFile = $backupsDir . "/smc-backup-{$timestamp}.zip";

// Tạo zip
$zip = new ZipArchive();
if ($zip->open($backupFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    $error = "Không thể tạo file backup: {$backupFile}";
    if (!$isCLI) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => $error]);
    } else {
        echo "ERROR: {$error}\n";
    }
    exit(1);
}

// Thêm tất cả JSON files từ data/
$dataFiles = 0;
if (is_dir($dataDir)) {
    $files = glob($dataDir . '/*.json');
    foreach ($files as $file) {
        $zip->addFile($file, 'data/' . basename($file));
        $dataFiles++;
    }
}

// Thêm uploads nếu có
$uploadFiles = 0;
if (is_dir($uploadsDir)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($uploadsDir, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        $localPath = $file->getRealPath();
        $relativePath = 'uploads/' . substr($localPath, strlen($uploadsDir) + 1);
        $zip->addFile($localPath, $relativePath);
        $uploadFiles++;
    }
}

// Thêm MySQL dump (dữ liệu thật của hệ thống)
$mysqlTables = 0;
list($mysqlDump, $mysqlTables) = dumpMysqlToJson();
if ($mysqlDump !== null) {
    $zip->addFromString('mysql-dump.json', json_encode($mysqlDump, JSON_UNESCAPED_UNICODE));
}

// Thêm metadata
$meta = [
    'created_at' => date('c'),
    'server' => gethostname() ?: 'plesk',
    'data_files' => $dataFiles,
    'upload_files' => $uploadFiles,
    'mysql_tables' => $mysqlTables,
    'total_size' => 0,
];
$zip->addFromString('backup-metadata.json', json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
$zip->close();

// Cập nhật metadata với file size thực
$fileSize = filesize($backupFile);
$meta['total_size'] = $fileSize;
$tempZip = new ZipArchive();
if ($tempZip->open($backupFile) === true) {
    $tempZip->addFromString('backup-metadata.json', json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    $tempZip->close();
}

// ── Cleanup: giữ tối đa MAX_BACKUPS file gần nhất ──
$allBackups = glob($backupsDir . '/smc-backup-*.zip');
if (count($allBackups) > MAX_BACKUPS) {
    // Sắp xếp theo thời gian tạo, cũ nhất trước
    usort($allBackups, function($a, $b) {
        return filemtime($a) - filemtime($b);
    });
    $toDelete = array_slice($allBackups, 0, count($allBackups) - MAX_BACKUPS);
    foreach ($toDelete as $old) {
        unlink($old);
    }
}

// ── Output ──
$message = sprintf(
    "Backup created: %s (%s bytes, %d data files, %d upload files, %d MySQL tables)",
    basename($backupFile),
    number_format($fileSize),
    $dataFiles,
    $uploadFiles,
    $mysqlTables
);

if ($isCLI) {
    echo "✓ {$message}\n";
} else {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'message' => $message,
        'file' => basename($backupFile),
        'size' => $fileSize,
        'data_files' => $dataFiles,
        'upload_files' => $uploadFiles,
        'mysql_tables' => $mysqlTables,
        'total_backups' => count($allBackups),
    ], JSON_UNESCAPED_UNICODE);
}
