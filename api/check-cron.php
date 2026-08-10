<?php
/**
 * Kiểm tra cron jobs hiện tại trên server
 * Gọi: https://smc-training.com/api/check-cron.php?token=...
 */
// Token riêng cho Cron Check — derive từ BACKUP_TOKEN trong env.php
$envFile = __DIR__ . '/env.php';
$env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];
$masterBackupToken = $env['BACKUP_TOKEN'] ?? '';
define('CHECK_TOKEN', hash_hmac('sha256', 'check-cron', $masterBackupToken ?: 'fallback-cron-key'));

if (($_GET['token'] ?? '') !== CHECK_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Ho_Chi_Minh');

$results = [];

// 1. Kiểm tra crontab
if (function_exists('exec')) {
    exec('crontab -l 2>&1', $cronOut, $cronCode);
    $results['crontab'] = [
        'exit_code' => $cronCode,
        'lines' => $cronOut,
    ];
} else {
    $results['crontab'] = ['error' => 'exec() disabled'];
}

// 2. Kiểm tra Scheduled Tasks trong Plesk
if (function_exists('exec')) {
    // Plesk scheduled tasks thường lưu trong thư mục này
    $pleskCronDir = '/var/spool/cron/crontabs';
    if (is_dir($pleskCronDir)) {
        $cronFiles = glob($pleskCronDir . '/*');
        $results['plesk_cron_dir'] = ['path' => $pleskCronDir, 'files' => $cronFiles];
        foreach ($cronFiles as $cf) {
            $results['cron_file_' . basename($cf)] = file_get_contents($cf);
        }
    } else {
        $results['plesk_cron_dir'] = ['error' => 'Directory not found: ' . $pleskCronDir];
    }

    // Kiểm tra plesk bin
    $pleskBin = '/usr/local/psa/bin/site';
    if (file_exists($pleskBin) || file_exists('/opt/psa/bin/site')) {
        $binPath = file_exists($pleskBin) ? $pleskBin : '/opt/psa/bin/site';
        exec(escapeshellcmd($binPath) . ' -i smc-training.com 2>&1', $siteInfo, $siteCode);
        $results['plesk_site_info'] = [
            'bin' => $binPath,
            'exit_code' => $siteCode,
            'output' => $siteInfo,
        ];
    }
}

// 3. Kiểm tra thư mục backup và backup gần nhất
$backupDir = __DIR__ . '/backups';
$results['backup_dir'] = [
    'path' => $backupDir,
    'exists' => is_dir($backupDir),
    'writable' => is_writable($backupDir),
    'files' => [],
];

if (is_dir($backupDir)) {
    $backupFiles = glob($backupDir . '/smc-backup-*.zip');
    foreach ($backupFiles as $bf) {
        $results['backup_dir']['files'][] = [
            'name' => basename($bf),
            'size' => filesize($bf),
            'modified' => date('c', filemtime($bf)),
        ];
    }
    // Sắp xếp mới nhất trước
    usort($results['backup_dir']['files'], function($a, $b) {
        return strcmp($b['modified'], $a['modified']);
    });
}

// 4. Kiểm tra log cron nếu có
$cronLog = $backupDir . '/cron.log';
if (file_exists($cronLog)) {
    $results['cron_log'] = [
        'exists' => true,
        'size' => filesize($cronLog),
        'last_20_lines' => array_slice(file($cronLog), -20),
    ];
} else {
    $results['cron_log'] = ['exists' => false];
}

// 5. Hướng dẫn thiết lập nếu chưa có
$results['setup_guide'] = [
    'method_1_plesk_panel' => [
        'step_1' => 'Đăng nhập Plesk Panel: https://s88d71.cloudnetwork.vn:8443',
        'step_2' => 'Vào Websites & Domains > smc-training.com',
        'step_3' => 'Click "Scheduled Tasks" (Task đã lên lịch)',
        'step_4' => 'Add Task > Run a PHP script',
        'step_5' => 'Script path: httpdocs/api/backup.php',
        'step_6' => 'Schedule: Daily, 3:00 AM',
        'step_7' => 'Description: SMC Training Daily Backup',
    ],
    'method_2_ssh' => "echo '0 3 * * * /usr/bin/php /var/www/vhosts/smc-training.com/httpdocs/api/backup.php >> /var/www/vhosts/smc-training.com/httpdocs/api/backups/cron.log 2>&1' | crontab -",
];

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
