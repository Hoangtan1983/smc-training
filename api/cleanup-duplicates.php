<?php
/**
 * Cleanup: Xóa users trùng lặp trong MySQL + JSON
 * Giữ lại 1 bản ghi gốc cho mỗi học viên, xóa các bản duplicate
 */
date_default_timezone_set('Asia/Ho_Chi_Minh');
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

echo "=== CLEANUP DUPLICATE USERS ===\n\n";

// 1. Tìm các email trùng trong MySQL
echo "1. Kiểm tra email trùng trong MySQL...\n";
$dupes = DB::select(
    "SELECT email, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
     FROM users
     GROUP BY email
     HAVING cnt > 1"
);
echo "   Tìm thấy " . count($dupes) . " email bị trùng\n";

if (!empty($dupes)) {
    foreach ($dupes as $d) {
        $ids = explode(',', $d['ids']);
        // Giữ ID thấp nhất (record gốc), xóa các ID còn lại
        $keepId = $ids[0];
        $deleteIds = array_slice($ids, 1);

        echo "   Email: {$d['email']} (giữ ID={$keepId}, xoá IDs=" . implode(',', $deleteIds) . ")\n";

        foreach ($deleteIds as $did) {
            try {
                DB::begin();
                // Xóa các FK references trước
                DB::execute("DELETE FROM staff_cash_ledger WHERE staff_id = ?", [(int)$did]);
                DB::execute("DELETE FROM staff_cash_ledger WHERE reconciled_by = ?", [(int)$did]);
                DB::execute("UPDATE payments SET staff_confirmed_by = NULL WHERE staff_confirmed_by = ?", [(int)$did]);
                DB::execute("UPDATE payments SET collector_id = NULL WHERE collector_id = ?", [(int)$did]);
                DB::execute("UPDATE payments SET submitted_by = NULL WHERE submitted_by = ?", [(int)$did]);
                DB::execute("UPDATE payments SET approved_by = NULL WHERE approved_by = ?", [(int)$did]);
                DB::execute("UPDATE enrollments SET sale_id = NULL WHERE sale_id = ?", [(int)$did]);
                DB::execute("UPDATE enrollments SET created_by = NULL WHERE created_by = ?", [(int)$did]);
                DB::execute("UPDATE invoices SET created_by = NULL WHERE created_by = ?", [(int)$did]);
                DB::execute("DELETE FROM notifications WHERE user_id = ?", [(int)$did]);
                DB::execute("DELETE FROM audit_log WHERE user_id = ?", [(int)$did]);
                DB::execute("DELETE FROM users WHERE id = ?", [(int)$did]);
                DB::commit();
                echo "     ✅ Đã xoá user ID={$did}\n";
            } catch (Exception $e) {
                DB::rollback();
                echo "     ❌ Lỗi xoá ID={$did}: " . $e->getMessage() . "\n";
            }
        }
    }
}

// 2. Tìm các name + phone trùng (cùng 1 người nhưng email khác)
echo "\n2. Kiểm tra trùng tên + phone...\n";
$nameDupes = DB::select(
    "SELECT full_name, phone, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
     FROM users WHERE role = 'student'
     GROUP BY full_name, phone
     HAVING cnt > 1"
);
echo "   Tìm thấy " . count($nameDupes) . " người trùng tên + phone\n";

if (!empty($nameDupes)) {
    foreach ($nameDupes as $d) {
        $ids = explode(',', $d['ids']);
        // Giữ ID thấp nhất, merge enrollment data nếu cần
        $keepId = $ids[0];
        $deleteIds = array_slice($ids, 1);

        echo "   {$d['full_name']} (phone: {$d['phone']}): giữ ID={$keepId}, xoá IDs=" . implode(',', $deleteIds) . "\n";

        foreach ($deleteIds as $did) {
            try {
                // Cập nhật enrollments từ user xóa → user giữ
                DB::execute("UPDATE enrollments SET student_id = ? WHERE student_id = ?", [(int)$keepId, (int)$did]);
                DB::execute("DELETE FROM notifications WHERE user_id = ?", [(int)$did]);
                DB::execute("DELETE FROM users WHERE id = ?", [(int)$did]);
                echo "     ✅ Đã merge + xoá user ID={$did} → ID={$keepId}\n";
            } catch (Exception $e) {
                echo "     ❌ Lỗi: " . $e->getMessage() . "\n";
            }
        }
    }
}

// 3. Đếm lại
$totalUsers = DB::selectOne("SELECT COUNT(*) as c FROM users")['c'];
$totalStudents = DB::selectOne("SELECT COUNT(*) as c FROM users WHERE role = 'student'")['c'];
$totalEnrollments = DB::selectOne("SELECT COUNT(*) as c FROM enrollments")['c'];

echo "\n=== KẾT QUẢ SAU CLEANUP ===\n";
echo "📊 Users: {$totalUsers} (students: {$totalStudents})\n";
echo "📊 Enrollments: {$totalEnrollments}\n";
echo "✅ Hoàn tất!\n";

// 4. Sync lại users.json
echo "\n=== SYNC USERS.JSON ===\n";
// Đọc users.json hiện tại
$jsonPath = __DIR__ . '/data/users.json';
$existingUsers = file_exists($jsonPath) ? json_decode(file_get_contents($jsonPath), true) : [];

// Đọc tất cả users từ MySQL
$mysqlUsers = DB::select("SELECT * FROM users ORDER BY id");

// Build set các email từ MySQL
$mysqlEmails = [];
foreach ($mysqlUsers as $mu) {
    $mysqlEmails[$mu['email'] ?? ''] = true;
}

// Xóa khỏi JSON các user không còn trong MySQL
$filtered = array_filter($existingUsers, function($u) use ($mysqlEmails) {
    $email = $u['email'] ?? '';
    return isset($mysqlEmails[$email]);
});

echo "   JSON trước: " . count($existingUsers) . " users\n";
echo "   JSON sau: " . count($filtered) . " users\n";

// Lưu lại
$tmp = $jsonPath . '.tmp.' . getmypid();
$json = json_encode(array_values($filtered), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
file_put_contents($tmp, $json, LOCK_EX);
rename($tmp, $jsonPath);

echo "✅ Đã đồng bộ users.json với MySQL\n";
