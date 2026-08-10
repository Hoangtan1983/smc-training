<?php
/**
 * Debug: kiểm tra kết nối MySQL và tên database thực tế
 */
date_default_timezone_set('Asia/Ho_Chi_Minh');
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', 1);
error_reporting(E_ALL);

$envFile = __DIR__ . '/env.php';
$env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];

echo "=== MySQL Debug ===\n\n";
echo "env.php:\n";
echo "  DB_HOST: " . ($env['DB_HOST'] ?? 'not set') . "\n";
echo "  DB_NAME: " . ($env['DB_NAME'] ?? 'not set') . "\n";
echo "  DB_USER: " . ($env['DB_USER'] ?? 'not set') . "\n";
echo "  DB_PASS: " . (($env['DB_PASS'] ?? '') ? '*** (set)' : 'EMPTY') . "\n\n";

// Thử các database name phổ biến trên Plesk
$host = $env['DB_HOST'] ?? 'localhost';
$user = $env['DB_USER'] ?? '';
$pass = $env['DB_PASS'] ?? '';

$dbNames = [
    'smc_training',
    'smc46189_smc_training',
    'smc46189_training',
    $user . '_smc_training',
];

echo "Thử danh sách database...\n";
try {
    $pdo = new PDO("mysql:host={$host}", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $dbs = $pdo->query("SHOW DATABASES")->fetchAll(PDO::FETCH_COLUMN);
    echo "✅ Kết nối MySQL thành công!\n";
    echo "📊 Databases mà user này thấy được:\n";
    foreach ($dbs as $db) {
        echo "  - {$db}\n";
    }
    echo "\n";

    // Thử kết nối từng database
    foreach ($dbNames as $dbName) {
        try {
            $testPdo = new PDO("mysql:host={$host};dbname={$dbName}", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $tables = $testPdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            echo "✅ {$dbName} — OK, " . count($tables) . " tables: " . implode(', ', $tables) . "\n";
        } catch (Exception $e) {
            echo "❌ {$dbName} — " . $e->getMessage() . "\n";
        }
    }
} catch (Exception $e) {
    echo "❌ Kết nối MySQL thất bại: " . $e->getMessage() . "\n";
}
