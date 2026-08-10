<?php
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/db.php';

echo "=== DEBUG AGENCY USERS ===\n\n";

// Kiểm tra trực tiếp
$users = DB::select("SELECT id, email, role, CHAR_LENGTH(role) AS role_len, HEX(role) AS role_hex FROM users WHERE email IN ('nhabeagri@gmail.com', 'ag1@ag.com')");
foreach ($users as $u) {
    echo "email={$u['email']}\n";
    echo "  id={$u['id']}\n";
    echo "  role='{$u['role']}'\n";
    echo "  role_len={$u['role_len']}\n";
    echo "  role_hex={$u['role_hex']}\n\n";
}

// Thử UPDATE trực tiếp
echo "=== DIRECT UPDATE ===\n";
$stmt = DB::get()->prepare("UPDATE users SET role = 'agency' WHERE email = ?");
$stmt->execute(['nhabeagri@gmail.com']);
echo "Update 1: " . $stmt->rowCount() . " rows\n";

$stmt = DB::get()->prepare("UPDATE users SET role = 'agency' WHERE email = ?");
$stmt->execute(['ag1@ag.com']);
echo "Update 2: " . $stmt->rowCount() . " rows\n";

// Kiểm tra lại
$users = DB::select("SELECT email, role FROM users WHERE email IN ('nhabeagri@gmail.com', 'ag1@ag.com')");
foreach ($users as $u) {
    echo "  AFTER: {$u['email']}: role='{$u['role']}'\n";
}

echo "\n=== ALSO CHECK SCHEMA ===\n";
$cols = DB::select("SHOW COLUMNS FROM users LIKE 'role'");
foreach ($cols as $c) {
    echo "  Field: {$c['Field']}, Type: {$c['Type']}, Null: {$c['Null']}, Default: {$c['Default']}\n";
}

echo "\n✅ Done!\n";
