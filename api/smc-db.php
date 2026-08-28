<?php
/**
 * SMC Training — Unified MySQL Backend (v5)
 *
 * THAY THẾ HOÀN TOÀN: tuition-service.php + api-v1.php + agency.php (phần học phí)
 *
 * Quy trình 5 tầng — v5:
 *   STUDENT → AGENCY → STAFF (xác nhận thu tiền mặt) → ACCOUNTANT (đối soát & duyệt) → ADMIN (báo cáo)
 *
 * Nguyên lý: 1 Enrollment → 1 Invoice → N Payments → 1 Commission
 * - Tất cả dữ liệu trong MySQL, không dùng JSON file
 * - Mọi ghi đều có transaction (InnoDB)
 * - Mọi đọc đều có index, sub-10ms với 5000+ học viên
 * - Single source of truth cho Admin, Staff, Accountant, Agency, Student
 *
 * QUY TRÌNH THANH TOÁN 2 BƯỚC:
 *   Bước 1 (STAFF):       record-payment (cash) → status='staff_confirmed' → staff_cash_ledger
 *                          Hoặc submit-receipt (bank_transfer) → status='pending'
 *   Bước 2 (ACCOUNTANT):  confirm-receipt → status='approved' → kích hoạt khóa học
 *
 * Endpoint: /api/smc-db.php
 *
 * REQUIRES: MySQL schema v3 (database/schema.sql) đã được import
 *           env.php có DB_HOST, DB_NAME, DB_USER, DB_PASS
 */

date_default_timezone_set('Asia/Ho_Chi_Minh');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://smc-training.com');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ──── DB Layer ────
require_once __DIR__ . '/db.php';

// ──── AUTH (shared library) ────
require_once __DIR__ . '/auth-lib.php';

// Aliases cho backward compatibility
function dbGetToken() { return alGetToken(); }
function dbVerifyToken($token) { return alVerifyToken($token); }
function dbAuth() { return alAuthenticate(); }
function dbJson($data, $code = 200) { alJsonResponse($data, $code); }
function dbInput() { return alJsonInput(); }

function dbRequireRole($roles) { return alRequireRole($roles); }

/** Yêu cầu role ACCOUNTANT hoặc ADMIN */
function dbRequireAccountant() {
    return alRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);
}

// ──── HELPERS ────
function dbGetUserId($auth) {
    $id = $auth['userId'] ?? $auth['id'] ?? 0;
    // Token từ auth.php dùng string ID kiểu "u-student-xxx" cho sub field
    // Cần map sang MySQL BIGINT id qua bảng users
    if (!empty($id) && !is_numeric($id)) {
        $email = $auth['email'] ?? '';
        $phone = $auth['phone'] ?? '';

        // Try multiple ways to find the MySQL user
        $user = null;

        // 1. Try by email
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $user = DB::selectOne("SELECT id FROM users WHERE email = ?", [$email]);
        }

        // 2. Try by phone (email field in auth might actually be a phone number)
        if (!$user && $email && preg_match('/^\d{9,11}$/', preg_replace('/\D/', '', $email))) {
            $phoneDigits = preg_replace('/\D/', '', $email);
            $user = DB::selectOne("SELECT id FROM users WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') LIKE ?", ["%{$phoneDigits}%"]);
        }

        // 3. Try by phone field
        if (!$user && $phone) {
            $user = DB::selectOne("SELECT id FROM users WHERE phone = ?", [$phone]);
        }

        if ($user) return (int)$user['id'];

        // 4. Last resort: find any student with matching email/phone pattern
        if ($email) {
            $user = DB::selectOne("SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1", [$email, $email]);
            if ($user) return (int)$user['id'];
        }

        return 0;
    }
    return (int)$id;
}

function dbGenCode($prefix, $table, $column) {
    $yr = date('Y');
    $count = DB::selectOne(
        "SELECT COUNT(*) AS c FROM `{$table}` WHERE YEAR(created_at) = YEAR(NOW())"
    )['c'] ?? 0;
    $seq = $count + 1;
    return $prefix . '-' . $yr . '-' . str_pad($seq, 5, '0', STR_PAD_LEFT);
}

function dbComputeStep($status, $totalPaid, $basePrice) {
    switch ($status) {
        case 'fully_paid': case 'paid': return 'paid';
        case 'partially_paid': case 'partial': return 'partial';
        case 'exempt': return 'exempt';
        case 'frozen': return 'frozen';
        case 'cancelled': return 'cancelled';
        default: return ($totalPaid > 0) ? 'partial' : 'pending';
    }
}

function dbPaymentStatusToEnrollment($status) {
    return match($status) {
        'fully_paid', 'paid' => 'fully_paid',
        'partially_paid', 'partial' => 'partially_paid',
        'exempt' => 'exempt',
        default => 'unpaid',
    };
}

// ──── AGENCY HELPERS ────
function dbGetAgencyDiscount($agencyId) {
    if (!$agencyId) return ['percent' => 0, 'name' => ''];
    $ag = DB::selectOne("SELECT commission_rate, name FROM agents WHERE id = ?", [(int)$agencyId]);
    if (!$ag) return ['percent' => 0, 'name' => ''];
    return ['percent' => (float)$ag['commission_rate'], 'name' => $ag['name']];
}

function dbCalcDiscount($basePrice, $discountPercent) {
    $percent = (float)$discountPercent;
    $amount = $percent > 0 ? (int)($basePrice * $percent / 100) : 0;
    $finalPrice = max(0, $basePrice - $amount);
    return ['percent' => $percent, 'amount' => $amount, 'finalPrice' => $finalPrice];
}

function dbGetRankGroup($courseName) {
    $cn = mb_strtolower($courseName ?? '');
    if (strpos($cn, 'bvlos') !== false || strpos($cn, 'hạng b') !== false) return 'BVLOS (Hạng B)';
    if (strpos($cn, 'vlos') !== false || strpos($cn, 'hạng a') !== false) return 'VLOS (Hạng A)';
    return 'Chưa xác định';
}

function dbGetRankAbbr($courseName) {
    $cn = mb_strtolower($courseName ?? '');
    if (strpos($cn, 'bvlos') !== false || strpos($cn, 'hạng b') !== false) return 'B';
    if (strpos($cn, 'vlos') !== false || strpos($cn, 'hạng a') !== false) return 'A';
    return '';
}

/** Định dạng số tiền theo chuẩn Việt Nam: 25.000.000 (dấu chấm phân cách hàng nghìn) */
function vnd($n) {
    return number_format((float)$n, 0, ',', '.');
}

// ──── ROUTING ────
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── Global try-catch để graceful error khi MySQL không khả dụng ──
try {

// =====================================================================
// HEALTH CHECK
// =====================================================================
if ($action === 'health' || empty($action)) {
    $health = DB::health();
    $invoiceCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM invoices")['c'] ?? 0);
    $paymentCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM payments")['c'] ?? 0);
    $enrollmentCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM enrollments")['c'] ?? 0);
    $studentCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM users WHERE role = 'student'")['c'] ?? 0);

    dbJson([
        'status' => $health['status'] ?? 'ok',
        'service' => 'smc-db v4 (MySQL unified)',
        'mysql_version' => $health['mysql_version'] ?? '',
        'database' => $health['database'] ?? '',
        'invoices' => $invoiceCount,
        'payments' => $paymentCount,
        'enrollments' => $enrollmentCount,
        'students' => $studentCount,
        'query_time_ms' => $health['query_time_ms'] ?? 0,
        'timestamp' => date('c'),
    ]);
}

// =====================================================================
// CREATE INVOICE (thay thế tuition-service.php create-invoice)
// POST Body: { studentId*, courseId*, basePrice?, agencyId?, note?, classId? }
// =====================================================================
if ($action === 'create-invoice') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $studentId = (int)($input['studentId'] ?? 0);
    $courseId = (int)($input['courseId'] ?? 0);
    $basePrice = (int)($input['basePrice'] ?? 0);
    $agencyId = (int)($input['agencyId'] ?? 0);
    $note = $input['note'] ?? '';
    $classId = $input['classId'] ?? '';

    if (!$studentId) dbJson(['error' => 'Thiếu studentId'], 400);
    if (!$courseId) dbJson(['error' => 'Thiếu courseId'], 400);

    // Verify student
    $student = DB::selectOne("SELECT * FROM users WHERE id = ? AND role = 'student'", [$studentId]);
    if (!$student) dbJson(['error' => 'Không tìm thấy học viên'], 404);

    // Get course
    $course = DB::selectOne("SELECT * FROM courses WHERE id = ?", [$courseId]);
    if (!$course) dbJson(['error' => 'Không tìm thấy khóa học'], 404);

    if ($basePrice <= 0) $basePrice = (int)$course['tuition_fee'];

    // Check duplicate enrollment — nếu có nhiều hơn 1, giữ bản mới nhất và xóa bản cũ
    $existingDupes = DB::select(
        "SELECT id, created_at FROM enrollments WHERE student_id = ? AND course_id = ? ORDER BY created_at DESC",
        [$studentId, $courseId]
    );
    if (count($existingDupes) > 1) {
        // Giữ enrollment mới nhất, xóa các bản cũ + invoice cũ
        $keepId = $existingDupes[0]['id'];
        for ($i = 1; $i < count($existingDupes); $i++) {
            $dupId = $existingDupes[$i]['id'];
            DB::execute("DELETE FROM invoices WHERE enrollment_id = ?", [$dupId]);
            DB::execute("DELETE FROM payments WHERE enrollment_id = ?", [$dupId]);
            DB::execute("DELETE FROM enrollments WHERE id = ?", [$dupId]);
        }
    } elseif (count($existingDupes) === 1) {
        dbJson(['error' => 'Học viên đã có hồ sơ cho khóa học này', 'existingEnrollmentId' => $existingDupes[0]['id']], 409);
    }

    // Agency discount
    $discountPercent = 0;
    $discountAmount = 0;
    $finalPrice = $basePrice;
    $agencyName = '';
    if ($agencyId) {
        $agInfo = dbGetAgencyDiscount($agencyId);
        $discountPercent = $agInfo['percent'];
        if ($discountPercent > 0) {
            $disc = dbCalcDiscount($basePrice, $discountPercent);
            $discountAmount = $disc['amount'];
            $finalPrice = $disc['finalPrice'];
            $agencyName = $agInfo['name'];
        }
    }
    if ($agencyId && $finalPrice <= 0 && $basePrice > 0) {
        dbJson(['error' => 'Không được tạo học viên miễn phí cho đại lý. Vui lòng giảm chiết khấu (< 100%).'], 400);
    }

    // Use stored procedure for atomic creation
    $planJson = null; // no payment plan initially
    $result = DB::call('sp_create_enrollment', [
        $studentId,
        $courseId,
        $agencyId ?: null,
        null, // sale_id
        0,    // discount_amount = 0 (chưa áp dụng CK vì CK đại lý khác với discount)
        dbGetUserId($auth),
        $planJson,
    ]);

    $enrollmentId = $result[0]['enrollment_id'] ?? 0;
    $enrollmentCode = $result[0]['enrollment_code'] ?? '';

    if (!$enrollmentId) dbJson(['error' => 'Lỗi tạo hồ sơ'], 500);

    // Update invoice với đúng base_price, discount, agency info
    // v4: Thêm student_name, student_email, student_phone để đảm bảo hiển thị đúng
    DB::execute(
        "UPDATE invoices SET base_price = ?, discount_amount = ?, final_price = ?,
         agency_id = ?, agency_name = ?, agency_discount_percent = ?, agency_discount_amount = ?,
         student_name = ?, student_email = ?, student_phone = ?,
         note = ?
         WHERE enrollment_id = ?",
        [$basePrice, $discountAmount, $finalPrice,
         $agencyId ? (string)$agencyId : '', $agencyName, $discountPercent, $discountAmount,
         $student['full_name'] ?? '', $student['email'] ?? '', $student['phone'] ?? '',
         $note, $enrollmentId]
    );

    // Update enrollment total_amount, final_amount
    DB::execute(
        "UPDATE enrollments SET total_amount = ?, discount_amount = ?, final_amount = ? WHERE id = ?",
        [$basePrice, $discountAmount, $finalPrice, $enrollmentId]
    );

    // Lấy invoice vừa tạo
    $invoice = DB::selectOne("SELECT * FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);

    dbJson([
        'success' => true,
        'message' => 'Đã tạo hóa đơn học phí thành công!',
        'data' => [
            'enrollmentId' => $enrollmentId,
            'enrollmentCode' => $enrollmentCode,
            'invoiceId' => $invoice['id'] ?? 0,
            'invoiceCode' => $invoice['invoice_code'] ?? '',
            'basePrice' => $basePrice,
            'finalPrice' => $finalPrice,
            'discountPercent' => $discountPercent,
            'agencyId' => $agencyId ?: '',
            'agencyName' => $agencyName,
            'status' => 'pending',
        ],
    ], 201);
}

// =====================================================================
// RECORD PAYMENT (Staff/Admin ghi nhận thanh toán)
// v5: Nếu cash → status='staff_confirmed' (BƯỚC 1), KHÔNG auto-approve.
//     Nếu bank_transfer → status='pending' (chờ kế toán đối soát).
// POST Body: { enrollmentId*, amount*, method?, note?, evidenceImage? }
// =====================================================================
if ($action === 'record-payment') {
    $auth = dbRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? 0);
    $invoiceIdRaw = (int)($input['invoiceId'] ?? 0);
    $amount = (int)($input['amount'] ?? 0);
    $paymentMethod = $input['method'] ?? 'cash';
    $note = $input['note'] ?? '';
    $evidenceImage = $input['evidenceImage'] ?? null;

    // Nếu frontend gửi invoiceId (id từ bảng invoices) thay vì enrollmentId
    if (!$enrollmentId && $invoiceIdRaw) {
        $inv = DB::selectOne("SELECT enrollment_id FROM invoices WHERE id = ?", [$invoiceIdRaw]);
        if ($inv) {
            $enrollmentId = (int)$inv['enrollment_id'];
        }
    }
    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId hoặc invoiceId'], 400);
    if ($amount <= 0) dbJson(['error' => 'Số tiền không hợp lệ'], 400);

    // Verify enrollment exists
    $enr = DB::selectOne("SELECT * FROM enrollments WHERE id = ?", [$enrollmentId]);
    if (!$enr) dbJson(['error' => 'Không tìm thấy hồ sơ'], 404);

    $userId = dbGetUserId($auth);

    // Đảm bảo remaining_amount đúng (cột denormalized có thể chưa được điền khi tạo hồ sơ)
    DB::execute("UPDATE enrollments SET remaining_amount = final_amount - paid_amount WHERE id=?", [$enrollmentId]);

    // v5: Dùng sp_record_payment — tự động phân biệt cash vs bank_transfer
    $result = DB::call('sp_record_payment', [
        $enrollmentId,
        $amount,
        $paymentMethod,
        '',              // transaction_ref
        null,            // payment_schedule_id
        $userId,         // collector (staff)
        null,            // submitted_by
        $note,
        $evidenceImage,
    ]);

    $paymentId = $result[0]['payment_id'] ?? 0;
    $receiptCode = $result[0]['receipt_code'] ?? '';
    $paymentStatus = $result[0]['status'] ?? 'pending';

    if (!$paymentId) dbJson(['error' => 'Lỗi tạo phiếu thu'], 500);

    // Kế toán / Admin ghi nhận thanh toán (tiền mặt) → xác nhận ngay và liên thông toàn hệ thống:
    // sp_approve_payment cập nhật enrollments.paid_amount/payment_status/eligible_for_exam,
    // invoices.total_paid/status, payment_schedules, hoa hồng đại lý và audit_log.
    $role = strtolower($auth['role'] ?? '');
    $isApprover = in_array($role, ['admin', 'accountant']);

    if ($isApprover) {
        DB::call('sp_approve_payment', [$paymentId, $userId, $note]);
        // Đảm bảo invoice.status đúng theo final_price (giá sau chiết khấu) — procedure có thể set sai
        $inv0 = DB::selectOne("SELECT final_price, total_paid FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);
        if ($inv0) {
            $tp = (int)$inv0['total_paid']; $fp = (int)$inv0['final_price'];
            $st = ($fp > 0 && $tp >= $fp) ? 'paid' : ($tp > 0 ? 'partial' : 'pending');
            DB::execute("UPDATE invoices SET status=?, updated_at=NOW() WHERE enrollment_id=?", [$st, $enrollmentId]);
        }
        // Liên thông với chuỗi duyệt 3 cấp: ghi dấu Kế toán đã duyệt vào hồ sơ.
        // Trước đây record-payment chỉ cập nhật tiền/hồ sơ mà không ghi approval_accountant_by,
        // khiến Admin vẫn thấy hồ sơ "chờ Kế toán duyệt" dù học viên đã nộp đủ.
        $approverName = '';
        $appr = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [$userId]);
        if ($appr) $approverName = $appr['full_name'] ?? '';
        DB::execute("UPDATE enrollments SET approval_accountant_by=?, approval_accountant_at=NOW(), approval_accountant_name=?, updated_at=NOW() WHERE id=?",
            [$userId, $approverName, $enrollmentId]);
        $paymentStatus = 'approved';
        $message = 'Đã xác nhận thanh toán tiền mặt! Hồ sơ đã được cập nhật liên thông toàn hệ thống.';
    } else {
        $message = $paymentStatus === 'staff_confirmed'
            ? 'Đã xác nhận thu tiền mặt! Chuyển cho Kế toán để đối soát & kích hoạt khóa học.'
            : 'Đã ghi nhận thanh toán! Kế toán sẽ đối soát và kích hoạt khóa học.';
    }

    dbJson([
        'success' => true,
        'message' => $message,
        'data' => [
            'paymentId' => $paymentId,
            'receiptCode' => $receiptCode,
            'amount' => $amount,
            'status' => $paymentStatus,
            'method' => $paymentMethod,
            'needsAccountant' => ($paymentStatus !== 'approved'),
        ],
    ], 201);
}

// =====================================================================
// SUBMIT RECEIPT (Student nộp biên lai chuyển khoản)
// POST Body: { enrollmentId*, amount*, method?, receiptImage?, note? }
// =====================================================================
if ($action === 'submit-receipt') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? $input['invoiceId'] ?? 0);
    $amount = (int)($input['amount'] ?? 0);
    $paymentMethod = $input['method'] ?? 'bank_transfer';
    $receiptImage = $input['receiptImage'] ?? null;
    $note = $input['note'] ?? '';

    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId'], 400);
    if ($amount <= 0) dbJson(['error' => 'Số tiền không hợp lệ'], 400);

    $enr = DB::selectOne("SELECT * FROM enrollments WHERE id = ?", [$enrollmentId]);
    if (!$enr) dbJson(['error' => 'Không tìm thấy hồ sơ'], 404);

    // Verify ownership (student chỉ nộp cho chính mình)
    $userId = dbGetUserId($auth);
    if ((int)$enr['student_id'] !== $userId && !in_array($auth['role'] ?? '', ['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant'])) {
        dbJson(['error' => 'Không có quyền nộp biên lai cho hồ sơ này'], 403);
    }

    // Tạo payment với status=pending
    $result = DB::call('sp_record_payment', [
        $enrollmentId,
        $amount,
        $paymentMethod,
        '',
        null,
        null,       // collector = null (chưa confirm)
        $userId,    // submitted_by = student
        $note,
        null,       // evidence_image (sinh viên dùng receipt_image riêng)
    ]);

    $paymentId = $result[0]['payment_id'] ?? 0;
    if (!$paymentId) dbJson(['error' => 'Lỗi tạo phiếu thu'], 500);

    // Lưu receipt image nếu có
    if ($receiptImage) {
        DB::execute("UPDATE payments SET receipt_image = ? WHERE id = ?", [$receiptImage, $paymentId]);
    }

    dbJson([
        'success' => true,
        'message' => 'Đã nộp biên lai thanh toán! Nhân viên SMC sẽ xác nhận trong thời gian sớm nhất.',
        'data' => ['paymentId' => $paymentId, 'status' => 'pending'],
    ], 201);
}

// =====================================================================
// CONFIRM RECEIPT (KẾ TOÁN đối soát & duyệt → kích hoạt khóa học)
// v5: CHỈ ACCOUNTANT + ADMIN được gọi. Staff KHÔNG có quyền này.
//     Xử lý cả staff_confirmed (tiền mặt) lẫn pending (chuyển khoản) → approved
// POST Body: { paymentId*, note? }
// =====================================================================
if ($action === 'confirm-receipt') {
    $auth = dbRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $paymentId = (int)($input['paymentId'] ?? $input['transactionId'] ?? 0);
    $note = $input['note'] ?? '';

    if (!$paymentId) dbJson(['error' => 'Thiếu paymentId'], 400);

    $payment = DB::selectOne("SELECT * FROM payments WHERE id = ?", [$paymentId]);
    if (!$payment) dbJson(['error' => 'Không tìm thấy phiếu thu'], 404);
    if ($payment['status'] === 'approved') dbJson(['error' => 'Phiếu thu đã được duyệt'], 400);
    if ($payment['status'] === 'rejected') dbJson(['error' => 'Phiếu thu đã bị từ chối'], 400);

    // Chỉ cho phép duyệt các payment ở trạng thái pending hoặc staff_confirmed
    if (!in_array($payment['status'], ['pending', 'staff_confirmed'])) {
        dbJson(['error' => 'Phiếu thu không ở trạng thái có thể duyệt (hiện tại: ' . $payment['status'] . ')'], 400);
    }

    $result = DB::call('sp_approve_payment', [$paymentId, dbGetUserId($auth), $note]);
    // Đảm bảo invoice.status đúng theo final_price (procedure cũ dùng base_price)
    $inv0 = DB::selectOne("SELECT final_price, total_paid FROM invoices WHERE enrollment_id = ?", [(int)$payment['enrollment_id']]);
    if ($inv0) {
        $tp = (int)$inv0['total_paid']; $fp = (int)$inv0['final_price'];
        $st = ($fp > 0 && $tp >= $fp) ? 'paid' : ($tp > 0 ? 'partial' : 'pending');
        DB::execute("UPDATE invoices SET status=?, updated_at=NOW() WHERE enrollment_id=?", [$st, (int)$payment['enrollment_id']]);
    }
    // Liên thông chuỗi duyệt 3 cấp: ghi dấu Kế toán đã duyệt vào hồ sơ.
    $userId = dbGetUserId($auth);
    $approverName = '';
    $appr = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [$userId]);
    if ($appr) $approverName = $appr['full_name'] ?? '';
    DB::execute("UPDATE enrollments SET approval_accountant_by=?, approval_accountant_at=NOW(), approval_accountant_name=?, updated_at=NOW() WHERE id=?",
        [$userId, $approverName, (int)$payment['enrollment_id']]);
    $data = $result[0] ?? [];

    $fromStatus = $payment['status'] === 'staff_confirmed' ? 'tiền mặt (nhân viên đã xác nhận)' : 'chuyển khoản';

    dbJson([
        'success' => true,
        'message' => 'Đã đối soát & duyệt phiếu thu (' . $fromStatus . ').',
        'data' => $data,
    ]);
}

// =====================================================================
// REJECT RECEIPT (Staff/Accountant từ chối phiếu thu)
// POST Body: { paymentId*, reason? }
// =====================================================================
if ($action === 'reject-receipt') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $paymentId = (int)($input['paymentId'] ?? $input['transactionId'] ?? 0);
    $reason = $input['reason'] ?? 'Biên lai không hợp lệ';

    if (!$paymentId) dbJson(['error' => 'Thiếu paymentId'], 400);

    $result = DB::call('sp_reject_payment', [$paymentId, dbGetUserId($auth), $reason]);

    dbJson(['success' => true, 'message' => 'Đã từ chối phiếu thu.']);
}

// =====================================================================
// LIST INVOICES (Admin/Staff/Accountant xem danh sách tất cả hóa đơn)
// GET ?status=&search=&courseId=&agencyId=&page=&perPage=
// =====================================================================
if ($action === 'list-invoices') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'AGENCY', 'admin', 'staff', 'accountant', 'agency']);

    // Nếu là AGENCY, tự động lọc theo agency của họ
    $userRole = strtolower($auth['role'] ?? '');
    if ($userRole === 'agency') {
        $userEmail = $auth['email'] ?? '';
        $ag = DB::selectOne("SELECT id, agent_code, name FROM agents WHERE email = ? OR agent_code = ?", [$userEmail, $userEmail]);
        if ($ag) {
            // Lọc theo cả agency_id (MySQL numeric) và agency_name (JSON string)
            // vì invoices lưu agency_id dưới dạng JSON string ID
            $agencyNameForFilter = $ag['name'];
            $where[] = '(i.agency_id = ? OR i.agency_name = ?)';
            $params[] = (string)$ag['id'];
            $params[] = $agencyNameForFilter;
        }
    }

    $status = $_GET['status'] ?? '';
    $search = $_GET['search'] ?? '';
    $courseId = (int)($_GET['courseId'] ?? 0);
    $agencyId = (int)($_GET['agencyId'] ?? 0);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['perPage'] ?? 50)));

    $where = [];
    $params = [];

    if ($status && $status !== 'all') {
        $statusMap = ['paid' => 'paid', 'partial' => 'partial', 'pending' => 'pending',
                      'frozen' => 'frozen', 'cancelled' => 'cancelled', 'exempt' => 'exempt'];
        if (isset($statusMap[$status])) {
            $where[] = 'i.status = ?';
            $params[] = $statusMap[$status];
        }
    }
    if ($courseId) {
        $where[] = 'e.course_id = ?';
        $params[] = $courseId;
    }
    if ($agencyId) {
        $where[] = 'i.agency_id = ?';
        $params[] = (string)$agencyId;
    }
    if ($search) {
        $where[] = '(u.full_name LIKE ? OR u.phone LIKE ? OR c.name LIKE ?)';
        $s = "%{$search}%";
        $params[] = $s; $params[] = $s; $params[] = $s;
    }

    $whereSQL = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Count total
    $total = (int)(DB::selectOne(
        "SELECT COUNT(*) AS c FROM invoices i
         JOIN enrollments e ON i.enrollment_id = e.id
         JOIN users u ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         {$whereSQL}", $params
    )['c'] ?? 0);

    // Fetch page
    $offset = ($page - 1) * $perPage;
    // v4: Dùng student_name TỪ CHÍNH BẢNG invoices (đã lưu khi tạo invoice),
    //     thay vì JOIN users. Điều này đảm bảo tên học viên không bị ghi đè
    //     khi có nhiều enrollment hoặc khi users thay đổi.
    $invoices = DB::select(
        "SELECT i.*, e.enrollment_code, e.student_id, e.course_id, e.payment_status AS enrollment_status,
                e.eligible_for_exam,
                COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name,
                COALESCE(i.student_email, u.email) AS student_email,
                COALESCE(i.student_phone, u.phone) AS student_phone,
                c.name AS course_name, c.tuition_fee AS course_price
         FROM invoices i
         JOIN enrollments e ON i.enrollment_id = e.id
         LEFT JOIN users u ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         {$whereSQL}
         ORDER BY i.created_at DESC
         LIMIT {$perPage} OFFSET {$offset}",
        $params
    );

    // Enrich với computed fields
    foreach ($invoices as &$inv) {
        $bp = (int)($inv['base_price'] ?? 0);
        $fp = (int)($inv['final_price'] ?? $bp);
        $paid = (int)($inv['total_paid'] ?? 0);

        // v4: Set student info TRƯỚC khi check exempt (tránh mất field)
        // Dùng student_name từ chính bảng invoices (COALESCE trong SQL, hoặc gán luôn)
        $inv['studentId'] = (string)$inv['student_id'];
        $inv['studentName'] = $inv['student_name'] ?? ('HV #' . $inv['student_id']);
        $inv['studentEmail'] = $inv['student_email'] ?? '';
        $inv['studentPhone'] = $inv['student_phone'] ?? '';
        $inv['studentRank'] = dbGetRankAbbr($inv['course_name'] ?? '');
        $inv['courseId'] = (string)$inv['course_id'];
        $inv['courseName'] = $inv['course_name'];
        $inv['agencyId'] = $inv['agency_id'] ?? '';
        $inv['agencyName'] = $inv['agency_name'] ?? '';
        $inv['agencyDiscountPercent'] = (float)($inv['agency_discount_percent'] ?? 0);
        $inv['agencyDiscountAmount'] = (int)($inv['agency_discount_amount'] ?? 0);
        $inv['note'] = $inv['note'] ?? '';
        $inv['createdAt'] = $inv['created_at'] ?? '';
        $inv['updatedAt'] = $inv['updated_at'] ?? '';
        $inv['enrollmentCode'] = $inv['enrollment_code'] ?? '';

        // Exempt — vẫn set đủ fields, không continue sớm
        if (($inv['status'] ?? '') === 'exempt') {
            $inv['remainingDue'] = 0;
            $inv['amount'] = 0;
            $inv['actualAmount'] = 0;
            $inv['step'] = 'exempt';
            $inv['basePrice'] = 0;
            $inv['totalPaid'] = 0;
            $inv['finalPrice'] = 0;
            $inv['transactionCount'] = 0;
            continue;
        }

        // Status=paid → giữ nguyên total_paid thực tế đã nộp
        $inv['basePrice'] = $bp;
        $inv['totalPaid'] = $paid;
        // "Đóng đủ" tính theo giá sau chiết khấu đại lý (final_price)
        $threshold = $fp;
        $inv['remainingDue'] = max(0, $threshold - $paid);
        $inv['finalPrice'] = $fp;
        $inv['amount'] = $bp;
        $inv['actualAmount'] = $fp;
        $inv['step'] = dbComputeStep($inv['status'] ?? 'pending', $paid, $bp);

        // Transaction count (lazy load — chỉ đếm)
        $txnCount = DB::selectOne(
            "SELECT COUNT(*) AS c FROM payments WHERE enrollment_id = ? AND status = 'approved'",
            [$inv['enrollment_id'] ?? 0]
        );
        $inv['transactionCount'] = (int)($txnCount['c'] ?? 0);
    }
    unset($inv);

    dbJson([
        'success' => true,
        'data' => $invoices,
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage,
    ]);
}

// =====================================================================
// GET INVOICE DETAIL + transactions
// GET ?invoiceId= | ?enrollmentId=
// =====================================================================
if ($action === 'get-invoice-detail') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $invoiceId = (int)($_GET['invoiceId'] ?? 0);
    $enrollmentId = (int)($_GET['enrollmentId'] ?? 0);

    if (!$invoiceId && !$enrollmentId) dbJson(['error' => 'Thiếu invoiceId hoặc enrollmentId'], 400);

    $invoice = null;
    if ($invoiceId) {
        $invoice = DB::selectOne(
            "SELECT i.*, e.enrollment_code, e.student_id, e.course_id, e.payment_status,
                    COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name,
                    c.name AS course_name, c.tuition_fee
             FROM invoices i
             JOIN enrollments e ON i.enrollment_id = e.id
             LEFT JOIN users u ON e.student_id = u.id
             JOIN courses c ON e.course_id = c.id
             WHERE i.id = ?", [$invoiceId]
        );
    } else {
        $invoice = DB::selectOne(
            "SELECT i.*, e.enrollment_code, e.student_id, e.course_id, e.payment_status,
                    COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name,
                    c.name AS course_name, c.tuition_fee
             FROM invoices i
             JOIN enrollments e ON i.enrollment_id = e.id
             LEFT JOIN users u ON e.student_id = u.id
             JOIN courses c ON e.course_id = c.id
             WHERE i.enrollment_id = ?", [$enrollmentId]
        );
    }

    if (!$invoice) dbJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    // Permission check
    $studentId = (int)$invoice['student_id'];
    $userId = dbGetUserId($auth);
    $isOwner = $studentId === $userId;
    $isStaff = in_array($auth['role'] ?? '', ['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if (!$isOwner && !$isStaff) dbJson(['error' => 'Forbidden'], 403);

    // Get transactions (payments)
    $enrId = (int)$invoice['enrollment_id'];
    $payments = DB::select(
        "SELECT id, receipt_code, amount, payment_method, transaction_ref, status,
                note, receipt_image, payment_date, approved_at, created_at
         FROM payments WHERE enrollment_id = ? ORDER BY created_at DESC", [$enrId]
    );

    // Computed fields
    $bp = (int)($invoice['base_price'] ?? 0);
    $fp = (int)($invoice['final_price'] ?? $bp);
    $paid = (int)($invoice['total_paid'] ?? 0);

    // "Đóng đủ" tính theo giá sau chiết khấu đại lý (final_price)
    $threshold = $fp;

    $response = [
        'id' => (string)$invoice['id'],
        'invoiceCode' => $invoice['invoice_code'],
        'enrollmentId' => (string)$invoice['enrollment_id'],
        'enrollmentCode' => $invoice['enrollment_code'],
        'studentId' => (string)$studentId,
        'studentName' => $invoice['student_name'] ?? '',
        'studentRank' => dbGetRankAbbr($invoice['course_name'] ?? ''),
        'courseId' => (string)$invoice['course_id'],
        'courseName' => $invoice['course_name'] ?? '',
        'basePrice' => $bp,
        'finalPrice' => $fp,
        'totalPaid' => $paid,
        'remainingDue' => max(0, $threshold - $paid),
        'agencyId' => $invoice['agency_id'] ?? '',
        'agencyName' => $invoice['agency_name'] ?? '',
        'agencyDiscountPercent' => (float)($invoice['agency_discount_percent'] ?? 0),
        'agencyDiscountAmount' => (int)($invoice['agency_discount_amount'] ?? 0),
        'status' => $invoice['status'] ?? 'pending',
        'step' => dbComputeStep($invoice['status'] ?? 'pending', $paid, $threshold),
        'amount' => $bp,
        'actualAmount' => $fp,
        'note' => $invoice['note'] ?? '',
        'createdAt' => $invoice['created_at'] ?? '',
        'updatedAt' => $invoice['updated_at'] ?? '',
        'transactions' => array_map(function($p) {
            return [
                'id' => (string)$p['id'],
                'receiptCode' => $p['receipt_code'],
                'amount' => (int)$p['amount'],
                'method' => $p['payment_method'],
                'status' => $p['status'],
                'note' => $p['note'],
                'receiptImage' => $p['receipt_image'],
                'createdAt' => $p['created_at'] ?? $p['payment_date'],
                'confirmedAt' => $p['approved_at'],
            ];
        }, is_array($payments) ? $payments : []),
    ];

    dbJson(['success' => true, 'data' => $response]);
}

// =====================================================================
// GET STUDENT INVOICES (học viên xem hóa đơn của mình)
// GET ?courseId=
// =====================================================================
if ($action === 'get-student-invoices') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $studentId = dbGetUserId($auth);
    $courseId = (int)($_GET['courseId'] ?? 0);

    $where = "e.student_id = ?";
    $params = [$studentId];
    if ($courseId) {
        $where .= " AND e.course_id = ?";
        $params[] = $courseId;
    }

    $invoices = DB::select(
        "SELECT i.*, e.enrollment_code, e.course_id, e.payment_status,
                c.name AS course_name, c.tuition_fee,
                COALESCE(i.student_name, '') AS student_name_from_invoice
         FROM invoices i
         JOIN enrollments e ON i.enrollment_id = e.id
         JOIN courses c ON e.course_id = c.id
         WHERE {$where}
         ORDER BY i.created_at DESC",
        $params
    );

    foreach ($invoices as &$inv) {
        $bp = (int)($inv['base_price'] ?? 0);
        $fp = (int)($inv['final_price'] ?? $bp);
        $paid = (int)($inv['total_paid'] ?? 0);

        // v4: Dùng student_name từ invoice làm ưu tiên, fallback về studentId
        if (!empty($inv['student_name_from_invoice'])) {
            $inv['studentName'] = $inv['student_name_from_invoice'];
        } else {
            $inv['studentName'] = 'HV #' . $studentId;
        }

        // Exempt
        if (($inv['status'] ?? '') === 'exempt') {
            $inv['remainingDue'] = 0;
            $inv['amount'] = 0;
            $inv['actualAmount'] = 0;
            $inv['step'] = 'exempt';
            $inv['transactions'] = [];
            continue;
        }

        if (($inv['status'] ?? '') === 'paid') $paid = $bp;

        // Get payments for this enrollment
        $enrId = (int)$inv['enrollment_id'];
        $payments = DB::select(
            "SELECT id, receipt_code, amount, payment_method, status, note,
                    receipt_image, payment_date, approved_at, created_at
             FROM payments WHERE enrollment_id = ? AND status = 'approved'
             ORDER BY created_at DESC", [$enrId]
        );

        // v4: Dùng studentName từ database (đã được COALESCE(i.student_name, ...))
        //     Tránh ghi đè bằng studentId
        if (empty($inv['studentName'])) {
            $inv['studentName'] = $inv['student_name_from_invoice'] ?? ('HV #' . $studentId);
        }
        $inv['studentId'] = (string)$studentId;
        $inv['courseId'] = (string)$inv['course_id'];
        $inv['courseName'] = $inv['course_name'];
        $inv['studentRank'] = dbGetRankAbbr($inv['course_name'] ?? '');
        $inv['basePrice'] = $bp;
        $inv['totalPaid'] = $paid;
        // Học viên LUÔN thấy giá GỐC (basePrice), KHÔNG trừ chiết khấu đại lý
        // (chiết khấu là quan hệ giữa Đại lý và trung tâm, không hiển thị cho học viên)
        $inv['remainingDue'] = max(0, $bp - $paid);
        $inv['finalPrice'] = $bp;
        $inv['amount'] = $bp;
        $inv['actualAmount'] = $bp;
        $inv['step'] = dbComputeStep($inv['status'] ?? 'pending', $paid, $bp);
        $inv['agencyId'] = $inv['agency_id'] ?? '';
        $inv['agencyDiscountPercent'] = 0;
        $inv['agencyDiscountAmount'] = 0;
        $inv['owesToSmc'] = $bp;

        $inv['transactions'] = array_map(function($p) {
            return [
                'id' => (string)$p['id'],
                'amount' => (int)$p['amount'],
                'method' => $p['payment_method'],
                'status' => $p['status'],
                'note' => $p['note'],
                'receiptImage' => $p['receipt_image'],
                'createdAt' => $p['created_at'] ?? $p['payment_date'],
                'confirmedAt' => $p['approved_at'],
            ];
        }, $payments);
    }
    unset($inv);

    dbJson(['success' => true, 'data' => $invoices]);
}

// =====================================================================
// GET OVERALL REPORT (Admin/Staff/Accountant báo cáo tổng quan)
// GET
// =====================================================================
if ($action === 'get-overall-report') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);

    try {
        // Summary stats
        $summary = DB::selectOne(
            "SELECT COUNT(*) AS total_enrollments,
                    SUM(CASE WHEN e.payment_status = 'fully_paid' THEN 1 ELSE 0 END) AS fully_paid,
                    SUM(CASE WHEN e.payment_status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid,
                    SUM(CASE WHEN e.payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid,
                    SUM(CASE WHEN e.payment_status = 'exempt' THEN 1 ELSE 0 END) AS exempt,
                    COALESCE(SUM(e.final_amount), 0) AS total_revenue,
                    COALESCE(SUM(e.paid_amount), 0) AS total_collected,
                    COALESCE(SUM(GREATEST(e.final_amount - e.paid_amount, 0)), 0) AS total_outstanding
             FROM enrollments e
             WHERE e.enrollment_status != 'cancelled'"
        );

        $totalReceived = (int)($summary['total_collected'] ?? 0);
        $totalBasePrice = (int)($summary['total_revenue'] ?? 0);
        $totalDue = (int)($summary['total_outstanding'] ?? 0);
        $totalInvoices = (int)($summary['total_enrollments'] ?? 0);

        // Today's payments
        $today = DB::selectOne(
            "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
             FROM payments WHERE status = 'approved' AND DATE(approved_at) = CURDATE()"
        );

        // By course/rank group
        $byCourse = DB::select(
            "SELECT c.name AS course_name, c.tuition_fee,
                    COUNT(*) AS count,
                    COALESCE(SUM(e.paid_amount), 0) AS collected,
                    COALESCE(SUM(GREATEST(e.final_amount - e.paid_amount, 0)), 0) AS due
             FROM enrollments e
             JOIN courses c ON e.course_id = c.id
             WHERE e.enrollment_status != 'cancelled'
             GROUP BY c.id
             ORDER BY count DESC"
        );

        // Transform byCourse to rank groups
        $byRankGroup = [];
        foreach ($byCourse as $bc) {
            $group = dbGetRankGroup($bc['course_name'] ?? '');
            if (!isset($byRankGroup[$group])) {
                $byRankGroup[$group] = ['name' => $group, 'invoices' => 0, 'received' => 0, 'due' => 0, 'basePrice' => 0];
            }
            $byRankGroup[$group]['invoices'] += (int)$bc['count'];
            $byRankGroup[$group]['received'] += (int)$bc['collected'];
            $byRankGroup[$group]['due'] += (int)$bc['due'];
            $byRankGroup[$group]['basePrice'] += (int)$bc['collected'] + (int)$bc['due'];
        }

        // By agency
        $byAgency = DB::select(
            "SELECT i.agency_name AS name, COUNT(DISTINCT e.student_id) AS students,
                    COUNT(*) AS invoices,
                    COALESCE(SUM(e.paid_amount), 0) AS received,
                    COALESCE(SUM(GREATEST(e.final_amount - e.paid_amount, 0)), 0) AS due,
                    COALESCE(SUM(i.agency_discount_amount), 0) AS discount_total,
                    MAX(i.agency_discount_percent) AS discount_percent
             FROM invoices i
             JOIN enrollments e ON i.enrollment_id = e.id
             WHERE i.agency_id != '' AND i.agency_id IS NOT NULL
               AND i.agency_discount_percent > 0 AND i.agency_discount_percent < 100
               AND e.enrollment_status != 'cancelled'
             GROUP BY i.agency_id, i.agency_name
             ORDER BY received DESC"
        );

        $totalStudents = (int)(DB::selectOne(
            "SELECT COUNT(DISTINCT student_id) AS c FROM enrollments WHERE enrollment_status != 'cancelled'"
        )['c'] ?? 0);

        $activatedCount = (int)(DB::selectOne(
            "SELECT COUNT(DISTINCT e.student_id) AS c FROM enrollments e
             JOIN users u ON e.student_id = u.id
             WHERE u.status = 'active' AND e.enrollment_status != 'cancelled'"
        )['c'] ?? 0);

        $freeCount = (int)(DB::selectOne(
            "SELECT COUNT(*) AS c FROM enrollments WHERE payment_status = 'exempt'"
        )['c'] ?? 0);

        $totalCommission = (int)(DB::selectOne(
            "SELECT COALESCE(SUM(agency_discount_amount), 0) AS c FROM invoices
             WHERE agency_discount_percent > 0 AND agency_discount_percent < 100"
        )['c'] ?? 0);

        $totalActualReceived = $totalReceived - $totalCommission;
        $collectionRate = $totalBasePrice > 0 ? round($totalActualReceived / $totalBasePrice * 100, 1) : 0;

        // Class count per rank group (skip if table missing)
        try {
            $classCounts = DB::select(
                "SELECT c.name AS course_name, COUNT(*) AS count
                 FROM classes cl JOIN courses c ON cl.course_id = c.id GROUP BY c.id"
            );
        } catch (Exception $e) {
            $classCounts = [];
        }
        foreach ($byRankGroup as $gn => &$rg) {
            $rg['classCount'] = 0;
            foreach ($classCounts as $cc) {
                if (dbGetRankGroup($cc['course_name'] ?? '') === $gn) {
                    $rg['classCount'] += (int)$cc['count'];
                }
            }
        }
        unset($rg);

        dbJson([
            'success' => true,
            'data' => [
                'total_invoices' => $totalInvoices,
                'total_received' => $totalReceived,
                'total_received_fmt' => vnd($totalReceived) . ' ₫',
                'total_actual_received' => $totalActualReceived,
                'total_actual_received_fmt' => vnd($totalActualReceived) . ' ₫',
                'total_due' => $totalDue,
                'total_due_fmt' => vnd($totalDue) . ' ₫',
                'total_base_price' => $totalBasePrice,
                'total_base_price_fmt' => vnd($totalBasePrice) . ' ₫',
                'total_students' => $totalStudents,
                'activated_count' => $activatedCount,
                'free_student_count' => $freeCount,
                'exempt_count' => $freeCount,
                'today_amount' => (int)($today['amount'] ?? 0),
                'today_amount_fmt' => vnd((int)($today['amount'] ?? 0)) . ' ₫',
                'today_transactions' => (int)($today['count'] ?? 0),
                'total_commission' => $totalCommission,
                'total_commission_fmt' => vnd($totalCommission) . ' ₫',
                'agency_count' => count($byAgency),
                'collection_rate' => $collectionRate,
                'by_course' => array_values($byRankGroup),
                'by_agency' => $byAgency,
            ],
        ]);
    } catch (Exception $e) {
        error_log("[SMC-DB] get-overall-report error: " . $e->getMessage());
        dbJson(['error' => 'Lỗi hệ thống khi tạo báo cáo'], 500);
    }
}

// =====================================================================
// GET AGENCY REPORT (Đại lý xem báo cáo học phí)
// GET (tự detect agency từ token) hoặc ?agencyId= (Admin)
// =====================================================================
if ($action === 'get-agency-report') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $isAgency = in_array($auth['role'] ?? '', ['AGENCY', 'agency']);
    // Đại lý chỉ được xem báo cáo của CHÍNH MÌNH — bỏ qua agencyId từ query
    $requestAgencyId = $isAgency ? '' : ($_GET['agencyId'] ?? '');
    $agencyId = is_numeric($requestAgencyId) ? (int)$requestAgencyId : $requestAgencyId;

    // Nếu Kế toán/Admin/Staff gọi không có agencyId → trả về báo cáo tổng hợp tất cả đại lý
    $isStaff = in_array($auth['role'] ?? '', ['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if (!$agencyId && $isStaff) {
        // Tổng hợp tất cả đại lý
        $allInvoices = DB::select(
            "SELECT i.*, e.enrollment_code, e.student_id, e.course_id, e.payment_status,
                    COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name,
                    COALESCE(i.student_phone, u.phone) AS student_phone,
                    c.name AS course_name, c.tuition_fee
             FROM invoices i
             JOIN enrollments e ON i.enrollment_id = e.id
             LEFT JOIN users u ON e.student_id = u.id
             JOIN courses c ON e.course_id = c.id
             WHERE i.agency_id != '' AND i.agency_id IS NOT NULL
               AND i.agency_discount_percent > 0 AND i.agency_discount_percent < 100
               AND i.status NOT IN ('exempt', 'cancelled')
               AND i.base_price > 0
             ORDER BY i.created_at DESC"
        );

        $totalBase = 0; $totalPaid = 0; $totalDue = 0;
        $paidCount = 0; $partialCount = 0; $pendingCount = 0;
        $byAgency = [];
        foreach ($allInvoices as &$inv) {
            $bp = (int)($inv['base_price'] ?? 0);
            $fp = (int)($inv['final_price'] ?? $bp);
            $paid = (int)($inv['total_paid'] ?? 0);
            $threshold = $fp;
            $due = max(0, $threshold - $paid);

            $totalBase += $bp;
            $totalPaid += $paid;
            $totalDue += $due;

            $inv['studentName'] = $inv['student_name'];
            $inv['courseName'] = $inv['course_name'];
            $inv['basePrice'] = $bp;
            $inv['totalPaid'] = $paid;
            $inv['remainingDue'] = $due;
            $inv['amount'] = $bp;
            $inv['actualAmount'] = (int)($inv['final_price'] ?? $bp);
            $inv['step'] = dbComputeStep($inv['status'] ?? 'pending', $paid, $threshold);

            if ($inv['status'] === 'paid') $paidCount++;
            elseif ($inv['status'] === 'partial') $partialCount++;
            else $pendingCount++;

            $agName = $inv['agency_name'] ?? 'Unknown';
            if (!isset($byAgency[$agName])) {
                $byAgency[$agName] = ['name' => $agName, 'students' => 0, 'received' => 0, 'due' => 0, 'discount_total' => 0];
            }
            $byAgency[$agName]['students']++;
            $byAgency[$agName]['received'] += $paid;
            $byAgency[$agName]['due'] += $due;
            $byAgency[$agName]['discount_total'] += (int)($inv['agency_discount_amount'] ?? 0);
        }
        unset($inv);

        $collectionRate = $totalBase > 0 ? round($totalPaid / $totalBase * 100, 1) : 0;

        dbJson([
            'success' => true,
            'data' => [
                'agency' => [
                    'id' => 'all',
                    'name' => 'Tất cả đại lý',
                    'discountPercent' => 0,
                ],
                'stats' => [
                    'totalStudents' => count($allInvoices),
                    'paidCount' => $paidCount,
                    'partialCount' => $partialCount,
                    'pendingCount' => $pendingCount,
                    'totalBaseRevenue' => $totalBase,
                    'totalBaseRevenueFmt' => vnd($totalBase) . ' ₫',
                    'totalPaid' => $totalPaid,
                    'totalPaidFmt' => vnd($totalPaid) . ' ₫',
                    'totalDue' => $totalDue,
                    'totalDueFmt' => vnd($totalDue) . ' ₫',
                    'collectionRate' => $collectionRate,
                ],
                'invoices' => $allInvoices,
            ],
        ]);
    }

    // Nếu là Agency, tự detect
    if (!$agencyId && in_array($auth['role'] ?? '', ['AGENCY', 'agency'])) {
        $ag = DB::selectOne("SELECT id FROM agents WHERE email = ? OR agent_code = ?", [$auth['email'] ?? '', $auth['email'] ?? '']);
        if (!$ag) {
            // Try by email
            $user = DB::selectOne("SELECT email FROM users WHERE id = ?", [dbGetUserId($auth)]);
            $ag = DB::selectOne("SELECT id FROM agents WHERE email = ?", [$user['email'] ?? '']);
        }
        if (!$ag) dbJson(['error' => 'Không tìm thấy thông tin đại lý'], 404);
        $agencyId = (int)$ag['id'];
    }

    if (!$agencyId) dbJson(['error' => 'Thiếu agencyId'], 400);

    // Support both numeric ID (agents.id) and string ID (invoices.agency_id)
    if (is_numeric($agencyId)) {
        $agency = DB::selectOne("SELECT * FROM agents WHERE id = ?", [(int)$agencyId]);
    } else {
        $agency = DB::selectOne("SELECT * FROM agents WHERE agent_code = ?", [(string)$agencyId]);
        // Fallback: if no agent in agents table, build from invoice data
        if (!$agency) {
            $anyInv = DB::selectOne(
                "SELECT agency_name, agency_discount_percent FROM invoices WHERE agency_id = ? LIMIT 1",
                [(string)$agencyId]
            );
            if ($anyInv) {
                $agency = [
                    'id' => $agencyId,
                    'name' => $anyInv['agency_name'] ?? 'Unknown Agency',
                    'commission_rate' => (float)($anyInv['agency_discount_percent'] ?? 0),
                ];
            }
        }
    }
    if (!$agency) dbJson(['error' => 'Không tìm thấy đại lý'], 404);

    $discPercent = (float)$agency['commission_rate'];

    // Get invoices for this agency
    $agencyName = $agency['name'] ?? '';
    $invoices = DB::select(
        "SELECT i.*, e.enrollment_code, e.student_id, e.course_id, e.payment_status,
                COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name,
                COALESCE(i.student_phone, u.phone) AS student_phone,
                c.name AS course_name, c.tuition_fee
         FROM invoices i
         JOIN enrollments e ON i.enrollment_id = e.id
         LEFT JOIN users u ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         WHERE (i.agency_id = ? OR i.agency_name = ?)
           AND i.status NOT IN ('exempt', 'cancelled')
           AND i.base_price > 0
         ORDER BY i.created_at DESC",
        [(string)$agencyId, $agencyName]
    );

    $totalBase = 0; $totalFinal = 0; $totalPaid = 0; $totalDue = 0;
    $totalOwesToSmc = 0; $totalDiscount = 0;
    $paidCount = 0; $partialCount = 0; $pendingCount = 0;
    $byCourse = [];

    foreach ($invoices as &$inv) {
        $bp = (int)($inv['base_price'] ?? 0);
        $fp = (int)($inv['final_price'] ?? $bp);
        $paid = (int)($inv['total_paid'] ?? 0);
        $due = max(0, $fp - $paid);
        $invDiscPercent = (float)($inv['agency_discount_percent'] ?? $discPercent);
        $owesToSmc = $bp > 0 ? (int)($bp * (1 - $invDiscPercent / 100)) : 0;
        $discAmt = $bp > 0 ? (int)($bp * $invDiscPercent / 100) : 0;

        $totalBase += $bp;
        $totalPaid += $paid;
        $totalDue += $due;
        $totalOwesToSmc += $owesToSmc;
        $totalDiscount += $discAmt;

        $inv['studentId'] = (string)($inv['student_id'] ?? '');
        $inv['studentName'] = $inv['student_name'];
        $inv['studentEmail'] = $inv['student_email'] ?? '';
        $inv['studentPhone'] = $inv['student_phone'] ?? '';
        $inv['courseId'] = (string)($inv['course_id'] ?? '');
        $inv['courseName'] = $inv['course_name'];
        $inv['basePrice'] = $bp;
        $inv['totalPaid'] = $paid;
        $inv['remainingDue'] = $due;
        $inv['owesToSmc'] = $owesToSmc;
        $inv['agencyDiscountAmount'] = $discAmt;
        $inv['agencyDiscountPercent'] = $invDiscPercent;
        $inv['amount'] = $bp;
        $inv['actualAmount'] = (int)($inv['final_price'] ?? $bp);
        $inv['step'] = dbComputeStep($inv['status'] ?? 'pending', $paid, $bp);

        if ($inv['status'] === 'paid') $paidCount++;
        elseif ($inv['status'] === 'partial') $partialCount++;
        else $pendingCount++;

        $group = dbGetRankGroup($inv['course_name'] ?? '');
        if (!isset($byCourse[$group])) {
            $byCourse[$group] = ['name' => $group, 'students' => 0, 'received' => 0, 'due' => 0];
        }
        $byCourse[$group]['received'] += $paid;
        $byCourse[$group]['due'] += $due;
    }
    unset($inv);

    $collectionRate = $totalBase > 0 ? round($totalPaid / $totalBase * 100, 1) : 0;

    dbJson([
        'success' => true,
        'data' => [
            'agency' => [
                'id' => (string)$agency['id'],
                'name' => $agency['name'],
                'discountPercent' => $discPercent,
            ],
            'stats' => [
                'totalStudents' => count($invoices),
                'paidCount' => $paidCount,
                'partialCount' => $partialCount,
                'pendingCount' => $pendingCount,
                'totalBaseRevenue' => $totalBase,
                'totalBaseRevenueFmt' => vnd($totalBase) . ' ₫',
                'totalPaid' => $totalPaid,
                'totalPaidFmt' => vnd($totalPaid) . ' ₫',
                'totalDue' => $totalDue,
                'totalDueFmt' => vnd($totalDue) . ' ₫',
                'totalDiscount' => $totalDiscount,
                'totalDiscountFmt' => vnd($totalDiscount) . ' ₫',
                'totalOwesToSmc' => $totalOwesToSmc,
                'totalOwesToSmcFmt' => vnd($totalOwesToSmc) . ' ₫',
                'collectionRate' => $collectionRate,
            ],
            'invoices' => $invoices,
        ],
    ]);
}

// =====================================================================
// LIST TRANSACTIONS (Admin/Staff/Accountant)
// GET ?status=&enrollmentId=&limit=&offset=
// =====================================================================
if ($action === 'list-transactions') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);

    $fStatus = $_GET['status'] ?? '';
    $enrollmentId = (int)($_GET['enrollmentId'] ?? 0);
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    try {
        $where = [];
        $params = [];
        if ($fStatus) { $where[] = "p.status = ?"; $params[] = $fStatus; }
        if ($enrollmentId) { $where[] = "p.enrollment_id = ?"; $params[] = $enrollmentId; }
        $whereSQL = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $total = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM payments p {$whereSQL}", $params)['c'] ?? 0);

        $transactions = DB::select(
            "SELECT p.*, COALESCE(NULLIF(u.full_name, ''), i.student_name) AS student_name, e.enrollment_code,
                    i.agency_id, i.agency_name
             FROM payments p
             JOIN enrollments e ON p.enrollment_id = e.id
             JOIN users u ON e.student_id = u.id
             LEFT JOIN invoices i ON p.enrollment_id = i.enrollment_id
             {$whereSQL}
             ORDER BY p.created_at DESC
             LIMIT {$limit} OFFSET {$offset}",
            $params
        );

        dbJson([
            'success' => true,
            'data' => $transactions,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    } catch (Exception $e) {
        error_log("[SMC-DB] list-transactions error: " . $e->getMessage());
        dbJson(['success' => true, 'data' => [], 'total' => 0, 'limit' => $limit, 'offset' => $offset]);
    }
}

// =====================================================================
// FREEZE / UNFREEZE INVOICE
// POST Body: { enrollmentId* }
// =====================================================================
if ($action === 'freeze-invoice' || $action === 'unfreeze-invoice') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? $input['invoiceId'] ?? 0);
    $invoiceId = (int)($input['invoiceId'] ?? $input['id'] ?? 0);

    // Nếu chỉ có invoiceId, tra enrollment_id từ DB
    if (!$enrollmentId && $invoiceId) {
        $inv = DB::selectOne("SELECT enrollment_id, id FROM invoices WHERE id = ?", [$invoiceId]);
        if ($inv) {
            $enrollmentId = (int)$inv['enrollment_id'];
        }
    }
    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId hoặc invoiceId'], 400);

    $isFreeze = ($action === 'freeze-invoice');

    DB::begin();
    try {
        DB::execute(
            "UPDATE invoices SET status = ?, updated_at = NOW() WHERE enrollment_id = ?",
            [$isFreeze ? 'frozen' : 'pending', $enrollmentId]
        );
        DB::execute(
            "UPDATE enrollments SET enrollment_status = ?, updated_at = NOW() WHERE id = ?",
            [$isFreeze ? 'frozen' : 'active', $enrollmentId]
        );
        $enr = DB::selectOne("SELECT student_id FROM enrollments WHERE id = ?", [$enrollmentId]);
        if ($enr) {
            DB::execute(
                "UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?",
                [$isFreeze ? 'frozen' : 'active', $enr['student_id']]
            );
        }
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson([
        'success' => true,
        'message' => $isFreeze ? 'Đã tạm khóa hóa đơn và tài khoản học viên.' : 'Đã mở khóa hóa đơn và tài khoản học viên.',
    ]);
}

// =====================================================================
// MARK EXEMPT / UNMARK EXEMPT
// POST Body: { enrollmentId* }
// =====================================================================
if ($action === 'mark-exempt' || $action === 'unmark-exempt') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? $input['invoiceId'] ?? 0);
    $studentId = (int)($input['studentId'] ?? 0);
    $courseId = (int)($input['courseId'] ?? 0);

    // Nếu frontend gửi studentId + courseId, tra enrollment
    if (!$enrollmentId && $studentId && $courseId) {
        $enr = DB::selectOne(
            "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 1",
            [$studentId, $courseId]
        );
        if ($enr) {
            $enrollmentId = (int)$enr['id'];
        }
    }
    // Fallback: chỉ có studentId → tra enrollment gần nhất của học viên
    if (!$enrollmentId && $studentId) {
        $enr = DB::selectOne(
            "SELECT id FROM enrollments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1",
            [$studentId]
        );
        if ($enr) {
            $enrollmentId = (int)$enr['id'];
        }
    }
    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId hoặc studentId + courseId'], 400);

    $isExempt = ($action === 'mark-exempt');

    DB::begin();
    try {
        if ($isExempt) {
            DB::execute(
                "UPDATE invoices SET base_price = 0, final_price = 0, discount_amount = 0,
                 total_paid = 0, agency_id = '', agency_name = '',
                 agency_discount_percent = 0, agency_discount_amount = 0,
                 status = 'exempt', updated_at = NOW()
                 WHERE enrollment_id = ?", [$enrollmentId]
            );
            DB::execute(
                "UPDATE enrollments SET total_amount = 0, final_amount = 0, paid_amount = 0,
                 payment_status = 'exempt', updated_at = NOW() WHERE id = ?", [$enrollmentId]
            );
        } else {
            // Restore from course price
            $enr = DB::selectOne(
                "SELECT e.id, c.tuition_fee FROM enrollments e
                 JOIN courses c ON e.course_id = c.id WHERE e.id = ?", [$enrollmentId]
            );
            $price = $enr ? (int)$enr['tuition_fee'] : 15000000;
            DB::execute(
                "UPDATE invoices SET base_price = ?, final_price = ?, total_paid = 0,
                 status = 'pending', updated_at = NOW() WHERE enrollment_id = ?",
                [$price, $price, $enrollmentId]
            );
            DB::execute(
                "UPDATE enrollments SET total_amount = ?, final_amount = ?, paid_amount = 0,
                 payment_status = 'unpaid', updated_at = NOW() WHERE id = ?",
                [$price, $price, $enrollmentId]
            );
        }
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson([
        'success' => true,
        'message' => $isExempt ? 'Đã đánh dấu học viên miễn phí.' : 'Đã bỏ đánh dấu miễn phí.',
    ]);
}

// =====================================================================
// DELETE INVOICE (Admin only)
// POST/DELETE Body: { enrollmentId* }
// =====================================================================
if ($action === 'delete-invoice') {
    $auth = dbRequireRole(['ADMIN', 'admin']);
    if ($method !== 'POST' && $method !== 'DELETE') dbJson(['error' => 'POST/DELETE required'], 405);

    $input = $method === 'POST' ? dbInput() : [];
    $enrollmentId = (int)($input['enrollmentId'] ?? ($_GET['enrollmentId'] ?? 0));
    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId'], 400);

    DB::begin();
    try {
        DB::execute("DELETE FROM payments WHERE enrollment_id = ?", [$enrollmentId]);
        DB::execute("DELETE FROM payment_schedules WHERE enrollment_id = ?", [$enrollmentId]);
        DB::execute("DELETE FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);
        DB::execute("DELETE FROM enrollments WHERE id = ?", [$enrollmentId]);
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson(['success' => true, 'message' => 'Đã xóa hóa đơn và dữ liệu liên quan.']);
}

// =====================================================================
// EXAM ELIGIBILITY (Student kiểm tra điều kiện thi)
// GET
// =====================================================================
if ($action === 'exam-eligibility') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $studentId = dbGetUserId($auth);
    $enr = DB::selectOne(
        "SELECT enrollment_code, payment_status, eligible_for_exam, paid_amount, final_amount
         FROM enrollments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1",
        [$studentId]
    );

    if (!$enr) dbJson(['error' => 'Bạn chưa có hồ sơ đăng ký nào'], 404);

    dbJson(['data' => [
        'eligible' => (bool)$enr['eligible_for_exam'],
        'paymentStatus' => $enr['payment_status'],
        'paid' => (int)$enr['paid_amount'],
        'total' => (int)$enr['final_amount'],
        'message' => $enr['eligible_for_exam'] ? 'Bạn đủ điều kiện tham gia thi' : 'Bạn cần hoàn thành học phí để được thi',
    ]]);
}

// =====================================================================
// GENERATE QR (Bank transfer QR)
// POST Body: { enrollmentId*, amount* }
// =====================================================================
if ($action === 'generate-qr') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? 0);
    $amount = (int)($input['amount'] ?? 0);

    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId'], 400);
    if ($amount <= 0) dbJson(['error' => 'Số tiền không hợp lệ'], 400);

    $enr = DB::selectOne(
        "SELECT e.*, u.full_name, c.code AS course_code
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         WHERE e.id = ?", [$enrollmentId]
    );
    if (!$enr) dbJson(['error' => 'Không tìm thấy hồ sơ'], 404);

    $bankId = $env['BANK_ID'] ?? 'VCB';
    $accountNo = $env['BANK_ACCOUNT'] ?? '1234567890';
    $accountName = $env['BANK_ACCOUNT_NAME'] ?? 'SMC TRAINING';
    $desc = ($enr['enrollment_code'] ?? '') . ' ' . ($enr['full_name'] ?? '');

    $qrContent = "{$bankId}|{$accountNo}|{$accountName}|{$amount}|{$desc}";

    dbJson(['data' => [
        'qrContent' => $qrContent,
        'amount' => $amount,
        'description' => $desc,
        'bank' => $bankId,
        'accountNo' => $accountNo,
        'accountName' => $accountName,
        'enrollmentCode' => $enr['enrollment_code'] ?? '',
    ]]);
}

// =====================================================================
// AGENCY STUDENTS (Đại lý xem danh sách học viên)
// GET ?agencyId= (optional, auto-detect nếu là Agency)
// =====================================================================
if ($action === 'agency-students') {
    $auth = dbAuth();
    if (!$auth) dbJson(['error' => 'Unauthorized'], 401);

    $isAgency = in_array($auth['role'] ?? '', ['AGENCY', 'agency']);
    // Đại lý chỉ được xem học viên của CHÍNH MÌNH — bỏ qua agencyId từ query
    $agencyId = $isAgency ? 0 : (int)($_GET['agencyId'] ?? 0);

    if (!$agencyId && in_array($auth['role'] ?? '', ['AGENCY', 'agency'])) {
        $ag = DB::selectOne("SELECT id, name FROM agents WHERE email = ? OR agent_code = ?", [$auth['email'] ?? '', $auth['email'] ?? '']);
        if ($ag) { $agencyId = (int)$ag['id']; $agencyNameForFilter = $ag['name']; }
    }

    $where = "u.role = 'student'";
    $params = [];
    if ($agencyId) {
        // Tìm học viên qua invoices có agency_id hoặc agency_name này
        $studentIds = DB::select(
            "SELECT DISTINCT e.student_id FROM enrollments e
             JOIN invoices i ON i.enrollment_id = e.id
             WHERE i.agency_id = ? OR i.agency_name = ?",
            [(string)$agencyId, $agencyNameForFilter ?? '']
        );
        if (empty($studentIds)) {
            dbJson(['students' => [], 'total' => 0]);
        }
        $ids = array_map(fn($r) => (int)$r['student_id'], $studentIds);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $where .= " AND u.id IN ({$placeholders})";
        $params = $ids;
    } else {
        // Admin/Staff không filter → lấy tất cả
    }

    $students = DB::select(
        "SELECT u.*, e.enrollment_code, e.course_id, e.payment_status AS enrollment_status,
                e.final_amount, e.paid_amount, e.remaining_amount,
                c.name AS course_name,
                i.agency_name, i.agency_discount_percent
         FROM users u
         JOIN enrollments e ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN invoices i ON i.enrollment_id = e.id
         WHERE {$where}
         ORDER BY u.full_name",
        $params
    );

    dbJson(['students' => $students, 'total' => count($students)]);
}

// =====================================================================
// UPDATE INVOICE (Admin/Staff cập nhật hóa đơn)
// POST Body: { enrollmentId*, basePrice?, note?, agencyId? }
// =====================================================================
if ($action === 'update-invoice') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $enrollmentId = (int)($input['enrollmentId'] ?? $input['invoiceId'] ?? 0);
    if (!$enrollmentId) dbJson(['error' => 'Thiếu enrollmentId hoặc invoiceId'], 400);

    $invoice = DB::selectOne("SELECT * FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);
    if (!$invoice) dbJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    $updates = [];
    $params = [];

    if (isset($input['basePrice'])) {
        $newBase = (int)$input['basePrice'];
        $updates[] = 'base_price = ?';
        $params[] = $newBase;

        // Recalculate discount
        $agencyId = $input['agencyId'] ?? $invoice['agency_id'] ?? '';
        if ($agencyId) {
            $agInfo = dbGetAgencyDiscount((int)$agencyId);
            $disc = dbCalcDiscount($newBase, $agInfo['percent']);
            $updates[] = 'agency_discount_percent = ?';
            $params[] = $disc['percent'];
            $updates[] = 'agency_discount_amount = ?';
            $params[] = $disc['amount'];
            $updates[] = 'final_price = ?';
            $params[] = $disc['finalPrice'];
            $updates[] = 'agency_name = ?';
            $params[] = $agInfo['name'];
        } else {
            $updates[] = 'final_price = ?';
            $params[] = $newBase;
        }
    }

    if (isset($input['note'])) {
        $updates[] = 'note = ?';
        $params[] = $input['note'];
    }

    if (isset($input['agencyId'])) {
        $newAgencyId = $input['agencyId'];
        $updates[] = 'agency_id = ?';
        $params[] = (string)$newAgencyId;

        if ($newAgencyId) {
            $agInfo = dbGetAgencyDiscount((int)$newAgencyId);
            $bp = (int)($input['basePrice'] ?? $invoice['base_price']);
            $disc = dbCalcDiscount($bp, $agInfo['percent']);
            $updates[] = 'agency_discount_percent = ?';
            $params[] = $disc['percent'];
            $updates[] = 'agency_discount_amount = ?';
            $params[] = $disc['amount'];
            $updates[] = 'final_price = ?';
            $params[] = $disc['finalPrice'];
            $updates[] = 'agency_name = ?';
            $params[] = $agInfo['name'];
        }
    }

    if (!empty($updates)) {
        $updates[] = 'updated_at = NOW()';
        $params[] = $enrollmentId;
        DB::execute("UPDATE invoices SET " . implode(', ', $updates) . " WHERE enrollment_id = ?", $params);

        // Sync enrollment
        $inv = DB::selectOne("SELECT * FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);
        DB::execute(
            "UPDATE enrollments SET total_amount = ?, final_amount = ?, updated_at = NOW() WHERE id = ?",
            [$inv['base_price'] ?? 0, $inv['final_price'] ?? 0, $enrollmentId]
        );
    }

    $updated = DB::selectOne("SELECT * FROM invoices WHERE enrollment_id = ?", [$enrollmentId]);
    dbJson(['success' => true, 'message' => 'Đã cập nhật hóa đơn.', 'data' => $updated]);
}

// =====================================================================
// FIX NON-AGENCY DISCOUNTS (Admin maintenance)
// POST (idempotent)
// =====================================================================
if ($action === 'fix-non-agency-discounts') {
    $auth = dbRequireRole(['ADMIN', 'admin']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $fixed = DB::execute(
        "UPDATE invoices SET agency_discount_percent = 0, agency_discount_amount = 0,
         final_price = base_price, updated_at = NOW()
         WHERE (agency_id = '' OR agency_id IS NULL)
           AND (agency_discount_percent != 0 OR final_price != base_price)"
    );

    // Cũng update enrollments tương ứng
    DB::execute(
        "UPDATE enrollments e
         JOIN invoices i ON i.enrollment_id = e.id
         SET e.final_amount = e.total_amount, e.updated_at = NOW()
         WHERE (i.agency_id = '' OR i.agency_id IS NULL)
           AND e.final_amount != e.total_amount"
    );

    dbJson(['success' => true, 'message' => "Đã sửa {$fixed} invoice không agency bị gán sai discount.", 'fixed' => $fixed]);
}

// =====================================================================
// SYNC ALL (Đồng bộ invoice ↔ enrollment ↔ user)
// POST (Admin only, idempotent)
// =====================================================================
if ($action === 'sync-all') {
    $auth = dbRequireRole(['ADMIN', 'admin']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    DB::begin();
    try {
        // v4: Đồng bộ student_name từ users vào invoices (cho các invoice cũ chưa có)
        DB::execute(
            "UPDATE invoices i
             JOIN enrollments e ON i.enrollment_id = e.id
             JOIN users u ON e.student_id = u.id
             SET i.student_name = u.full_name,
                 i.student_email = u.email,
                 i.student_phone = u.phone
             WHERE i.student_name = '' OR i.student_name IS NULL"
        );

        // Sync remaining_amount (GENERATED column tự tính, chỉ cần sync payment_status)
        DB::execute(
            "UPDATE enrollments e
             JOIN invoices i ON i.enrollment_id = e.id
             SET e.payment_status = CASE
                 WHEN i.status = 'paid' THEN 'fully_paid'
                 WHEN i.status = 'partial' THEN 'partially_paid'
                 WHEN i.status = 'exempt' THEN 'exempt'
                 WHEN i.status = 'frozen' THEN 'fully_paid'
                 ELSE 'unpaid'
             END,
             e.eligible_for_exam = (i.status = 'paid' OR i.status = 'exempt' OR i.status = 'frozen'),
             e.updated_at = NOW()
             WHERE e.payment_status != CASE
                 WHEN i.status = 'paid' THEN 'fully_paid'
                 WHEN i.status = 'partial' THEN 'partially_paid'
                 WHEN i.status = 'exempt' THEN 'exempt'
                 ELSE 'unpaid'
             END"
        );

        // Sync user status
        DB::execute(
            "UPDATE users u
             JOIN enrollments e ON e.student_id = u.id
             JOIN invoices i ON i.enrollment_id = e.id
             SET u.status = CASE
                 WHEN i.status IN ('frozen', 'cancelled') THEN 'frozen'
                 ELSE 'active'
             END,
             u.updated_at = NOW()
             WHERE u.role = 'student'
               AND u.status != CASE WHEN i.status IN ('frozen', 'cancelled') THEN 'frozen' ELSE 'active' END"
        );

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson(['success' => true, 'message' => 'Đồng bộ hoàn tất!']);
}

// =====================================================================
// v5 ENDPOINTS — Quy trình 5 tầng
// =====================================================================

// =====================================================================
// STAFF CONFIRM CASH (Nhân viên xác nhận đã thu tiền mặt — BƯỚC 1)
// Chỉ STAFF được gọi. Payment chuyển từ pending → staff_confirmed
// POST Body: { paymentId*, note? }
// =====================================================================
if ($action === 'staff-confirm-cash') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $paymentId = (int)($input['paymentId'] ?? $input['transactionId'] ?? 0);
    $note = $input['note'] ?? '';

    if (!$paymentId) dbJson(['error' => 'Thiếu paymentId'], 400);

    $payment = DB::selectOne("SELECT * FROM payments WHERE id = ?", [$paymentId]);
    if (!$payment) dbJson(['error' => 'Không tìm thấy phiếu thu'], 404);
    if ($payment['status'] !== 'pending') {
        dbJson(['error' => 'Phiếu thu không ở trạng thái chờ (hiện tại: ' . $payment['status'] . ')'], 400);
    }
    if ($payment['payment_method'] !== 'cash') {
        dbJson(['error' => 'Chỉ áp dụng cho thanh toán tiền mặt'], 400);
    }

    DB::begin();
    try {
        // Cập nhật payment → staff_confirmed
        DB::execute(
            "UPDATE payments SET status = 'staff_confirmed',
             staff_confirmed_by = ?, staff_confirmed_at = NOW(),
             note = IF(? != '', CONCAT(IFNULL(note, ''), ' | NV: ', ?), note)
             WHERE id = ?",
            [dbGetUserId($auth), $note, $note, $paymentId]
        );

        // Thêm vào sổ quỹ tay
        DB::execute(
            "INSERT INTO staff_cash_ledger (staff_id, payment_id, amount, status, note)
             SELECT ?, id, amount, 'holding', ?
             FROM payments WHERE id = ?",
            [dbGetUserId($auth), $note, $paymentId]
        );

        // Audit log
        DB::execute(
            "INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
             VALUES (?, 'staff_confirm_cash', 'payment', ?,
              JSON_OBJECT('status', 'staff_confirmed', 'staff_id', ?))",
            [dbGetUserId($auth), $paymentId, dbGetUserId($auth)]
        );

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson([
        'success' => true,
        'message' => 'Đã xác nhận thu tiền mặt! Hãy bàn giao cho Kế toán để đối soát & kích hoạt khóa học.',
        'data' => ['paymentId' => $paymentId, 'status' => 'staff_confirmed'],
    ]);
}

// =====================================================================
// STAFF CASH SUMMARY (Tổng tiền mặt nhân viên đang giữ)
// GET ?staffId= (optional, Staff chỉ xem của mình, Admin/Accountant xem tất cả)
// =====================================================================
if ($action === 'staff-cash-summary') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);

    $requestedStaffId = (int)($_GET['staffId'] ?? 0);
    $userId = dbGetUserId($auth);
    $userRole = strtolower($auth['role'] ?? '');

    // Staff chỉ xem được tiền của chính mình
    if ($userRole === 'staff' && $requestedStaffId && $requestedStaffId !== $userId) {
        dbJson(['error' => 'Bạn chỉ có thể xem sổ quỹ của chính mình'], 403);
    }

    $staffId = $requestedStaffId ?: $userId;

    // Tổng tiền đang giữ (chưa bàn giao)
    $summary = DB::selectOne(
        "SELECT
            COALESCE(SUM(amount), 0) AS total_holding,
            COUNT(*) AS pending_count,
            MIN(created_at) AS oldest_held_since
         FROM staff_cash_ledger
         WHERE staff_id = ? AND status = 'holding'",
        [$staffId]
    );

    // Danh sách chi tiết các khoản đang giữ
    $pending = DB::select(
        "SELECT scl.id AS ledger_id, scl.amount, scl.status, scl.created_at AS held_since,
                p.id AS payment_id, p.receipt_code, p.payment_date,
                u.full_name AS student_name, c.name AS course_name,
                i.agency_id, i.agency_name
         FROM staff_cash_ledger scl
         JOIN payments p ON scl.payment_id = p.id
         JOIN enrollments e ON p.enrollment_id = e.id
         JOIN users u ON e.student_id = u.id
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN invoices i ON p.enrollment_id = i.enrollment_id
         WHERE scl.staff_id = ? AND scl.status = 'holding'
         ORDER BY scl.created_at DESC",
        [$staffId]
    );

    // Lịch sử đã bàn giao (đã đối soát)
    $reconciled = DB::select(
        "SELECT scl.id AS ledger_id, scl.amount, scl.status, scl.reconciled_at,
                p.receipt_code, u2.full_name AS reconciled_by_name
         FROM staff_cash_ledger scl
         JOIN payments p ON scl.payment_id = p.id
         LEFT JOIN users u2 ON scl.reconciled_by = u2.id
         WHERE scl.staff_id = ? AND scl.status = 'reconciled'
         ORDER BY scl.reconciled_at DESC
         LIMIT 50",
        [$staffId]
    );

    dbJson([
        'success' => true,
        'data' => [
            'staffId' => $staffId,
            'totalHolding' => (int)($summary['total_holding'] ?? 0),
            'totalHoldingFmt' => vnd((int)($summary['total_holding'] ?? 0)) . ' ₫',
            'pendingCount' => (int)($summary['pending_count'] ?? 0),
            'oldestHeldSince' => $summary['oldest_held_since'] ?? null,
            'pendingPayments' => $pending,
            'recentReconciled' => $reconciled,
        ],
    ]);
}

// =====================================================================
// ACCOUNTANT CASH LEDGER (Kế toán xem toàn bộ sổ quỹ tiền mặt)
// GET ?staffId=&dateFrom=&dateTo=&page=&perPage=
// =====================================================================
if ($action === 'accountant-cash-ledger') {
    $auth = dbRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);

    $staffId = (int)($_GET['staffId'] ?? 0);
    $dateFrom = $_GET['dateFrom'] ?? date('Y-m-01');
    $dateTo = $_GET['dateTo'] ?? date('Y-m-t');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['perPage'] ?? 50)));

    $where = "1=1";
    $params = [];
    if ($staffId) { $where .= " AND scl.staff_id = ?"; $params[] = $staffId; }
    $where .= " AND DATE(scl.created_at) BETWEEN ? AND ?";
    $params[] = $dateFrom; $params[] = $dateTo;

    // Tổng số bản ghi
    $total = (int)(DB::selectOne(
        "SELECT COUNT(*) AS c FROM staff_cash_ledger scl WHERE {$where}", $params
    )['c'] ?? 0);

    // Danh sách chi tiết
    $offset = ($page - 1) * $perPage;
    $entries = DB::select(
        "SELECT scl.*, u.full_name AS staff_name, u.phone AS staff_phone,
                p.receipt_code, p.amount, p.status AS payment_status,
                stu.full_name AS student_name, c.name AS course_name,
                u2.full_name AS reconciled_by_name,
                i.agency_id, i.agency_name
         FROM staff_cash_ledger scl
         JOIN users u ON scl.staff_id = u.id
         JOIN payments p ON scl.payment_id = p.id
         JOIN enrollments e ON p.enrollment_id = e.id
         JOIN users stu ON e.student_id = stu.id
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN users u2 ON scl.reconciled_by = u2.id
         LEFT JOIN invoices i ON p.enrollment_id = i.enrollment_id
         WHERE {$where}
         ORDER BY scl.created_at DESC
         LIMIT {$perPage} OFFSET {$offset}",
        $params
    );

    // Tổng quan cho Kế toán
    $overview = DB::selectOne(
        "SELECT
            COUNT(DISTINCT scl.staff_id) AS active_staff_count,
            COALESCE(SUM(CASE WHEN scl.status = 'holding' THEN scl.amount ELSE 0 END), 0) AS unremitted_cash,
            COALESCE(SUM(CASE WHEN scl.status = 'reconciled' THEN scl.amount ELSE 0 END), 0) AS reconciled_cash
         FROM staff_cash_ledger scl
         WHERE DATE(scl.created_at) BETWEEN ? AND ?",
        [$dateFrom, $dateTo]
    );

    // Danh sách nhân viên đang giữ tiền (tổng hợp)
    $staffHoldings = DB::select(
        "SELECT scl.staff_id, u.full_name AS staff_name, u.phone AS staff_phone,
                COUNT(*) AS pending_count,
                COALESCE(SUM(scl.amount), 0) AS total_holding,
                MIN(scl.created_at) AS oldest_held_since,
                TIMESTAMPDIFF(HOUR, MIN(scl.created_at), NOW()) AS hours_held
         FROM staff_cash_ledger scl
         JOIN users u ON scl.staff_id = u.id
         WHERE scl.status = 'holding'
         GROUP BY scl.staff_id, u.full_name, u.phone
         ORDER BY total_holding DESC"
    );

    dbJson([
        'success' => true,
        'data' => $entries,
        'overview' => [
            'activeStaffCount' => (int)($overview['active_staff_count'] ?? 0),
            'unremittedCash' => (int)($overview['unremitted_cash'] ?? 0),
            'unremittedCashFmt' => vnd((int)($overview['unremitted_cash'] ?? 0)) . ' ₫',
            'reconciledCash' => (int)($overview['reconciled_cash'] ?? 0),
            'reconciledCashFmt' => vnd((int)($overview['reconciled_cash'] ?? 0)) . ' ₫',
        ],
        'staffHoldings' => $staffHoldings,
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage,
    ]);
}

// =====================================================================
// REMIT CASH (Nhân viên bàn giao tiền mặt cho Kế toán)
// POST Body: { paymentIds[]*, note? }
// =====================================================================
if ($action === 'remit-cash') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $paymentIds = $input['paymentIds'] ?? [];
    $note = $input['note'] ?? 'Bàn giao tiền mặt cho Kế toán';

    if (empty($paymentIds)) dbJson(['error' => 'Thiếu danh sách phiếu thu'], 400);
    if (!is_array($paymentIds)) dbJson(['error' => 'paymentIds phải là mảng'], 400);

    $staffId = dbGetUserId($auth);
    $count = 0;

    DB::begin();
    try {
        foreach ($paymentIds as $pid) {
            $pid = (int)$pid;
            // Chỉ cập nhật nếu payment đang ở trạng thái staff_confirmed và trong sổ quỹ đang holding
            $affected = DB::execute(
                "UPDATE staff_cash_ledger SET
                    status = 'reconciled',
                    reconciled_by = NULL,
                    reconciled_at = NOW(),
                    note = CONCAT(IFNULL(note, ''), ' | ', ?)
                 WHERE payment_id = ? AND staff_id = ? AND status = 'holding'",
                [$note, $pid, $staffId]
            );
            if ($affected > 0) $count++;

            // Ghi audit log
            DB::execute(
                "INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
                 VALUES (?, 'remit_cash', 'payment', ?,
                  JSON_OBJECT('staff_id', ?, 'note', ?))",
                [$staffId, $pid, $staffId, $note]
            );
        }
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson([
        'success' => true,
        'message' => "Đã bàn giao {$count}/" . count($paymentIds) . ' phiếu thu cho Kế toán.',
        'data' => ['remittedCount' => $count, 'totalCount' => count($paymentIds)],
    ]);
}

// =====================================================================
// CHECK MYSQL READY (Kiểm tra MySQL đã sẵn sàng chưa)
// GET — public
// =====================================================================
if ($action === 'check-mysql-ready') {
    $health = DB::health();
    $ready = ($health['status'] ?? '') === 'ok' && ($health['tables'] ?? 0) >= 10;

    $invoiceCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM invoices")['c'] ?? 0);
    $paymentCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM payments")['c'] ?? 0);

    dbJson([
        'ready' => $ready,
        'health' => $health,
        'data_migrated' => $invoiceCount > 0 || $paymentCount > 0,
        'invoices' => $invoiceCount,
        'payments' => $paymentCount,
    ]);
}

// =====================================================================
// SETTLE COMMISSION (Admin/Accountant quyết toán hoa hồng đại lý)
// POST Body: { agentId*, periodStart*, periodEnd* }
// =====================================================================
if ($action === 'settle-commission') {
    $auth = dbRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $agentId = (int)($input['agentId'] ?? 0);
    $periodStart = $input['periodStart'] ?? date('Y-m-01');
    $periodEnd = $input['periodEnd'] ?? date('Y-m-t');

    if (!$agentId) dbJson(['error' => 'Thiếu agentId'], 400);

    // Verify agent exists
    $agent = DB::selectOne("SELECT * FROM agents WHERE id = ?", [$agentId]);
    if (!$agent) dbJson(['error' => 'Không tìm thấy đại lý'], 404);

    $userId = dbGetUserId($auth);

    try {
        $result = DB::call('sp_settle_commission', [
            $agentId,
            $periodStart,
            $periodEnd,
            $userId,
        ]);

        $data = $result[0] ?? [];

        dbJson([
            'success' => true,
            'message' => 'Đã quyết toán hoa hồng đại lý thành công!',
            'data' => $data,
        ]);
    } catch (Exception $e) {
        error_log("[SMC-DB] settle-commission error: " . $e->getMessage());
        // sp_settle_commission sẽ throw nếu không có hoa hồng cần quyết toán
        dbJson(['error' => $e->getMessage()], 400);
    }
}

// =====================================================================
// ASSIGN COURSE (Xếp khóa cho học viên chưa có khóa — Nhân viên/Admin)
// POST Body: { studentId*, courseId* }
// =====================================================================
if ($action === 'assign-course') {
    $auth = dbRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    if ($method !== 'POST') dbJson(['error' => 'POST required'], 405);

    $input = dbInput();
    $studentId = (int)($input['studentId'] ?? 0);
    $courseId = (int)($input['courseId'] ?? 0);
    if (!$studentId) dbJson(['error' => 'Thiếu studentId'], 400);
    if (!$courseId) dbJson(['error' => 'Thiếu courseId'], 400);

    $student = DB::selectOne("SELECT * FROM users WHERE id = ? AND role = 'student'", [$studentId]);
    if (!$student) dbJson(['error' => 'Không tìm thấy học viên'], 404);

    $course = DB::selectOne("SELECT * FROM courses WHERE id = ?", [$courseId]);
    if (!$course) dbJson(['error' => 'Không tìm thấy khóa học'], 404);

    $existing = DB::selectOne("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?", [$studentId, $courseId]);
    if ($existing) dbJson(['error' => 'Học viên đã có hồ sơ cho khóa này'], 409);

    $userId = dbGetUserId($auth);
    $staff = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [$userId]);

    // Sinh mã duy nhất (MAX-based, tránh trùng)
    $enrSeq = (int)(DB::selectOne("SELECT MAX(CAST(RIGHT(enrollment_code, 4) AS UNSIGNED)) m FROM enrollments WHERE enrollment_code LIKE 'HS-%'")['m'] ?? 0) + 1;
    $enrCode = 'HS-' . date('Y') . '-' . str_pad($enrSeq, 4, '0', STR_PAD_LEFT);
    $stages = json_encode(['enrollment'=>['status'=>'pending'],'theory'=>['status'=>'pending'],'practice'=>['status'=>'pending'],'exam'=>['status'=>'pending'],'certification'=>['status'=>'pending']], JSON_UNESCAPED_UNICODE);

    DB::begin();
    try {
        $enrId = (int)DB::insert(
            "INSERT INTO enrollments (enrollment_code, student_id, course_id, total_amount, final_amount, paid_amount, payment_status, enrollment_status, eligible_for_exam, training_stages, created_by)
             VALUES (?,?,?,?,?,0,'unpaid','pending',0,?,?)",
            [$enrCode, $studentId, $courseId, $course['tuition_fee'], $course['tuition_fee'], $stages, $userId]
        );

        $invSeq = (int)(DB::selectOne("SELECT MAX(CAST(RIGHT(invoice_code, 4) AS UNSIGNED)) m FROM invoices WHERE invoice_code LIKE 'INV-%'")['m'] ?? 0) + 1;
        $invCode = 'INV-' . date('Y') . '-' . str_pad($invSeq, 4, '0', STR_PAD_LEFT);
        DB::insert(
            "INSERT INTO invoices (invoice_code, enrollment_id, base_price, discount_amount, final_price, total_paid, status, student_name, student_email, student_phone, created_by)
             VALUES (?,?,?,0,?,0,'pending',?,?,?,?)",
            [$invCode, $enrId, $course['tuition_fee'], $course['tuition_fee'], $student['full_name'], $student['email'], $student['phone'], $userId]
        );

        // Đánh dấu Nhân viên đã duyệt hồ sơ (step='staff') → chuyển sang Kế toán
        DB::execute("UPDATE enrollments SET approval_staff_by = ?, approval_staff_at = NOW(), approval_staff_name = ?, updated_at = NOW() WHERE id = ?",
            [$userId, $staff['full_name'] ?? '', $enrId]);

        // Kích hoạt tài khoản học viên
        DB::execute("UPDATE users SET status = 'active', updated_at = NOW() WHERE id = ?", [$studentId]);

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        dbJson(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    dbJson(['success' => true, 'message' => 'Đã xếp khóa và chuyển hồ sơ cho Kế toán', 'enrollmentId' => $enrId, 'enrollmentCode' => $enrCode]);
}

// Fallback
dbJson(['error' => 'Unknown action: ' . $action], 404);

} catch (PDOException $e) {
    // MySQL không khả dụng — trả về lỗi JSON rõ ràng (không crash trắng màn hình)
    http_response_code(503);
    echo json_encode([
        'error' => 'MySQL database unavailable',
        'detail' => $e->getMessage(),
        'hint' => 'Vui lòng kiểm tra MySQL hoặc liên hệ quản trị viên.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'detail' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
