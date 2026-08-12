<?php
/**
 * Fix invoices: Đồng bộ từ enrollments → invoices
 *
 * Vấn đề: sync-all cũ đồng bộ invoices → enrollments (sai hướng),
 * dẫn đến invoice bị ghi sai totalPaid (chỉ tính từ transactions).
 *
 * Fix này đồng bộ ngược lại: enrollment → invoice
 * - Enrollment fully_paid → invoice paid đủ
 * - 4 Agcom partially_paid → giữ nguyên (đúng)
 * - Enrollment không có → giữ nguyên invoice
 */

require_once __DIR__ . '/auth-lib.php';

// Xác thực admin
$token = $_GET['token'] ?? '';
if ($token !== 'fix-invoices-20260811') {
    header('HTTP/1.1 403 Forbidden');
    die(json_encode(['error' => 'Invalid token']));
}

$invoices = json_decode(file_get_contents(__DIR__ . '/data/invoices.json'), true) ?: [];
$enrollments = json_decode(file_get_contents(__DIR__ . '/data/enrollments.json'), true) ?: [];

// Backup invoices trước khi sửa
$backupDir = __DIR__ . '/data/backups';
if (!is_dir($backupDir)) mkdir($backupDir, 0750, true);
copy(
    __DIR__ . '/data/invoices.json',
    $backupDir . '/invoices-before-fix-' . date('Ymd-His') . '.json'
);

$results = [
    'total_invoices' => count($invoices),
    'fixed' => 0,
    'skipped_no_enrollment' => 0,
    'skipped_partially_paid' => 0,
    'details' => [],
];

foreach ($invoices as &$inv) {
    $sid = $inv['studentId'] ?? '';
    if (!$sid) continue;

    // Tìm enrollment tương ứng
    $enr = null;
    foreach ($enrollments as $e) {
        if (($e['student_id'] ?? '') === $sid) {
            $enr = $e;
            break;
        }
    }

    if (!$enr) {
        $results['skipped_no_enrollment']++;
        continue;
    }

    $enrPaymentStatus = $enr['payment_status'] ?? '';
    $enrPaid = (int)($enr['paid_amount'] ?? 0);
    $invBasePrice = (int)($inv['basePrice'] ?? 0);

    if ($enrPaymentStatus === 'fully_paid') {
        $oldPaid = $inv['totalPaid'];
        $oldDue = $inv['remainingDue'];

        // Đồng bộ invoice từ enrollment
        $inv['totalPaid'] = max($enrPaid, $invBasePrice);
        $inv['remainingDue'] = 0;
        $inv['status'] = 'paid';
        $inv['step'] = 'paid';
        $inv['updatedAt'] = date('c');
        $inv['note'] = 'Đã sửa: đồng bộ từ enrollment (fully_paid)';

        $results['fixed']++;
        $results['details'][] = [
            'studentId' => $sid,
            'studentName' => $inv['studentName'] ?? '?',
            'old_totalPaid' => $oldPaid,
            'new_totalPaid' => $inv['totalPaid'],
            'old_remainingDue' => $oldDue,
            'new_remainingDue' => 0,
            'basePrice' => $invBasePrice,
        ];
    } elseif ($enrPaymentStatus === 'partially_paid') {
        // Giữ nguyên — đây là 4 học viên Agcom đúng
        $results['skipped_partially_paid']++;
    }
    // Các trạng thái khác (unpaid, pending...) giữ nguyên
}
unset($inv);

// Ghi file
$json = json_encode($invoices, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
file_put_contents(__DIR__ . '/data/invoices.json', $json);

// Cập nhật cache nếu auth.php đang chạy
if (function_exists('opcache_invalidate')) {
    opcache_invalidate(__DIR__ . '/data/invoices.json', true);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
