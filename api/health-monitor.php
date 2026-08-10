<?php
/**
 * SMC Training — Health Monitor
 *
 * Script giám sát tự động, kiểm tra:
 * 1. File PHP quan trọng có bị zeroed không
 * 2. Database JSON files có nguyên vẹn không
 * 3. API có trả về response hợp lệ không
 * 4. Dung lượng ổ đĩa còn đủ không
 *
 * Gọi qua cron mỗi 5 phút:
 *   php /var/www/vhosts/smc-training.com/httpdocs/api/health-monitor.php
 *
 * Gọi qua URL (với token):
 *   https://smc-training.com/api/health-monitor.php?token=...
 */

// Token riêng cho Health Monitor — derive từ BACKUP_TOKEN trong env.php
$envFile = __DIR__ . '/env.php';
$env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];
$masterBackupToken = $env['BACKUP_TOKEN'] ?? '';
define('MONITOR_TOKEN', hash_hmac('sha256', 'health-monitor', $masterBackupToken ?: 'fallback-monitor-key'));

$isCLI = php_sapi_name() === 'cli';
if (!$isCLI) {
    if (($_GET['token'] ?? '') !== MONITOR_TOKEN && ($_SERVER['HTTP_X_MONITOR_TOKEN'] ?? '') !== MONITOR_TOKEN) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
}

date_default_timezone_set('Asia/Ho_Chi_Minh');
$now = date('c');
$alerts = [];
$status = 'healthy';

// ── 1. Kiểm tra file PHP quan trọng không bị zeroed ──
$criticalFiles = [
    'auth.php' => 50000,      // Min bytes (phải > 50KB)
    'helpers.php' => 5000,    // Min bytes (phải > 5KB)
    'tuitions.php' => 10000,  // Min bytes
    'tuition-service.php' => 30000,
    'import.php' => 5000,
    'agency.php' => 30000,
];

foreach ($criticalFiles as $file => $minBytes) {
    $path = __DIR__ . '/' . $file;
    if (!file_exists($path)) {
        $alerts[] = ['level' => 'critical', 'file' => $file, 'issue' => 'File missing'];
        $status = 'critical';
    } else {
        $size = filesize($path);
        if ($size === 0) {
            $alerts[] = ['level' => 'critical', 'file' => $file, 'issue' => 'File zeroed (0 bytes)', 'size' => $size];
            $status = 'critical';
        } elseif ($size < $minBytes) {
            $alerts[] = ['level' => 'warning', 'file' => $file, 'issue' => "File smaller than expected ({$size} < {$minBytes})", 'size' => $size];
            if ($status === 'healthy') $status = 'warning';
        }
    }
}

// ── 2. Kiểm tra data JSON files ──
$dataDir = __DIR__ . '/data';
$criticalDataFiles = ['users.json', 'enrollments.json', 'tuitions.json', 'courses.json'];
foreach ($criticalDataFiles as $df) {
    $path = $dataDir . '/' . $df;
    if (!file_exists($path)) {
        $alerts[] = ['level' => 'critical', 'data_file' => $df, 'issue' => 'Data file missing'];
        $status = 'critical';
        continue;
    }
    $content = @file_get_contents($path);
    if ($content === false || strlen($content) < 10) {
        $alerts[] = ['level' => 'critical', 'data_file' => $df, 'issue' => 'Data file empty or unreadable'];
        $status = 'critical';
        continue;
    }
    $data = @json_decode($content, true);
    if ($data === null) {
        $alerts[] = ['level' => 'critical', 'data_file' => $df, 'issue' => 'Data file corrupted (invalid JSON): ' . json_last_error_msg()];
        $status = 'critical';
    }
}

// ── 3. Kiểm tra API tự gọi (self-test) ──
$apiUrl = 'https://smc-training.com/api/health';
$ctx = stream_context_create([
    'http' => ['timeout' => 5],
    'ssl' => ['verify_peer' => true],
]);
$apiResponse = @file_get_contents($apiUrl, false, $ctx);
if ($apiResponse === false) {
    $alerts[] = ['level' => 'critical', 'api' => '/api/health', 'issue' => 'API unreachable'];
    $status = 'critical';
} else {
    $apiData = @json_decode($apiResponse, true);
    if (!$apiData || !isset($apiData['status']) || $apiData['status'] !== 'ok') {
        $alerts[] = ['level' => 'warning', 'api' => '/api/health', 'issue' => 'API returned unexpected response', 'response' => substr($apiResponse, 0, 200)];
        if ($status === 'healthy') $status = 'warning';
    }
}

// ── 4. Kiểm tra dung lượng ổ đĩa ──
$freeSpace = disk_free_space(__DIR__);
$totalSpace = disk_total_space(__DIR__);
$freePercent = round($freeSpace / $totalSpace * 100, 1);
$freeMB = round($freeSpace / 1024 / 1024);

if ($freeMB < 100) {
    $alerts[] = ['level' => 'critical', 'disk' => "Only {$freeMB}MB free ({$freePercent}%)"];
    $status = 'critical';
} elseif ($freeMB < 500) {
    $alerts[] = ['level' => 'warning', 'disk' => "Low disk space: {$freeMB}MB free ({$freePercent}%)"];
    if ($status === 'healthy') $status = 'warning';
}

// ── 5. Log kết quả ──
// Ghi log để theo dõi lịch sử
$logDir = __DIR__ . '/data';
$logFile = $logDir . '/health-monitor.log';
$logEntry = [
    'timestamp' => $now,
    'status' => $status,
    'alerts' => count($alerts),
    'files_checked' => count($criticalFiles),
    'data_files_checked' => count($criticalDataFiles),
    'disk_free_mb' => $freeMB,
    'disk_free_percent' => $freePercent,
    'alerts_detail' => $alerts,
];

// Giới hạn log file 1000 dòng
$logs = [];
if (file_exists($logFile)) {
    $logs = json_decode(file_get_contents($logFile), true) ?: [];
}
$logs[] = $logEntry;
if (count($logs) > 1000) {
    $logs = array_slice($logs, -1000);
}
file_put_contents($logFile, json_encode($logs, JSON_UNESCAPED_UNICODE), LOCK_EX);

// ── 6. Gửi email nếu critical ──
if ($status === 'critical') {
    $adminEmail = '0902596999@smc-training.com';
    $subject = "[SMC ALERT] Health Monitor: {$status} — " . date('H:i:s d/m/Y');
    $message = "SMC Training Health Monitor báo động:\n\n";
    $message .= "Status: {$status}\n";
    $message .= "Time: {$now}\n\n";
    foreach ($alerts as $alert) {
        $message .= "- [{$alert['level']}] {$alert['issue']}\n";
    }
    $message .= "\nChi tiết: https://smc-training.com/api/health-monitor.php?token=" . MONITOR_TOKEN;
    @mail($adminEmail, $subject, $message, "From: SMC Monitor <no-reply@smc-training.com>");
}

// ── Output ──
$result = [
    'status' => $status,
    'timestamp' => $now,
    'checks' => [
        'php_files' => count($criticalFiles),
        'data_files' => count($criticalDataFiles),
        'api_self_test' => $apiResponse !== false,
        'disk_free_mb' => $freeMB,
        'disk_free_percent' => $freePercent,
    ],
    'alerts' => $alerts,
];

if ($isCLI) {
    echo "SMC Health Monitor: {$status}\n";
    echo str_repeat('-', 50) . "\n";
    foreach ($alerts as $a) {
        echo "[{$a['level']}] {$a['issue']}\n";
    }
    if (empty($alerts)) echo "All systems OK ✅\n";
} else {
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
