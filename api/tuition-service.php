<?php
/**
 * SMC Training — Tuition Service v4 (Unified + 2-Step Cash)
 *
 * THAY THẾ: tuitions.php + tất cả logic thanh toán trong auth.php
 *
 * Nguyên lý: 1 Invoice → N Transactions → 1 Agency Commission
 * - Mỗi học viên có 1 invoice cho 1 khóa học
 * - Mỗi lần nộp tiền là 1 transaction độc lập
 * - Chiết khấu đại lý được tính & lưu CỐ ĐỊNH khi tạo invoice
 * - Sau mỗi transaction confirmed → auto-sync: invoice, student status, enrollment
 *
 * QUY TRÌNH 5 TẦNG (v4):
 *   STUDENT → AGENCY → STAFF (xác nhận thu tiền mặt) → ACCOUNTANT (đối soát & duyệt) → ADMIN
 *
 * QUY TRÌNH TIỀN MẶT 2 BƯỚC:
 *   Bước 1 (STAFF):       record-payment (cash) → status='staff_confirmed'
 *   Bước 2 (ACCOUNTANT):  confirm-receipt → status='confirmed' → kích hoạt khóa học
 *
 * QUY TRÌNH CHUYỂN KHOẢN:
 *   Student:              submit-receipt → status='pending'
 *   Accountant:           confirm-receipt → status='confirmed' → kích hoạt
 *
 * Endpoint: /api/tuition-service.php
 *
 * QUAN TRỌNG: Chỉ invoice có agencyId mới có discountPercent > 0.
 * - dp=100% hoặc fp=0 chỉ dùng cho invoice có agency (miễn phí qua đại lý).
 * - Invoice không agency LUÔN có dp=0 và fp=bp.
 */

date_default_timezone_set('Asia/Ho_Chi_Minh');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://smc-training.com');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ──── AUTH (shared library) ────
require_once __DIR__ . '/auth-lib.php';

// Aliases cho backward compatibility với code cũ
function tsGetToken() { return alGetToken(); }
function tsVerifyToken($token) { return alVerifyToken($token); }
function tsAuth() { return alAuthenticate(); }
function tsJson($data, $code = 200) { alJsonResponse($data, $code); }
function tsInput() { return alJsonInput(); }

function tsRequireRole($roles) { return alRequireRole($roles); }

/**
 * Yêu cầu role ACCOUNTANT hoặc ADMIN (dùng cho bước duyệt cuối cùng).
 * Staff KHÔNG có quyền này.
 */
function tsRequireAccountant() {
    return alRequireRole(['ADMIN', 'ACCOUNTANT', 'admin', 'accountant']);
}

// ──── DATA STORE (atomic write) ────
$tsDataDir = __DIR__ . '/data';

function tsLoad($file) {
    global $tsDataDir;
    $path = $tsDataDir . '/' . $file . '.json';
    if (!file_exists($path)) return [];
    return json_decode(file_get_contents($path), true) ?: [];
}

function tsSave($file, $data) {
    global $tsDataDir;
    if (!is_dir($tsDataDir)) mkdir($tsDataDir, 0750, true);
    $path = $tsDataDir . '/' . $file . '.json';

    // ── AUTO-BACKUP: giữ 5 bản backup gần nhất trước khi ghi đè ──
    // Chỉ backup các file dữ liệu quan trọng, KHÔNG backup file tạm/log
    $criticalFiles = ['users', 'invoices', 'transactions', 'enrollments', 'tuitions',
                       'agencies', 'agency_commissions', 'courses', 'classes',
                       'change_requests', 'registrations', 'payment_receipts'];
    if (in_array($file, $criticalFiles) && file_exists($path)) {
        $backupDir = $tsDataDir . '/auto_backups';
        if (!is_dir($backupDir)) mkdir($backupDir, 0750, true);

        $backupName = $file . '_' . date('Ymd_His') . '.json';
        $backupPath = $backupDir . '/' . $backupName;

        // Giới hạn kích thước backup: bỏ qua nếu file > 5MB
        $fileSize = filesize($path);
        if ($fileSize < 5 * 1024 * 1024) {
            @copy($path, $backupPath);

            // Xóa backup cũ, chỉ giữ 5 bản gần nhất cho mỗi file
            $existingBackups = glob($backupDir . '/' . $file . '_*.json');
            if ($existingBackups && count($existingBackups) > 5) {
                usort($existingBackups, function($a, $b) { return filemtime($b) - filemtime($a); });
                foreach (array_slice($existingBackups, 5) as $old) {
                    @unlink($old);
                }
            }
        }
    }

    $tmp = $path . '.tmp.' . getmypid();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) return false;
    if (file_put_contents($tmp, $json, LOCK_EX) === false) return false;
    return rename($tmp, $path);
}

// ──── COMPUTED STEP HELPER ────
// Map trạng thái invoice → step (tương thích với frontend tuitions cũ)
function tsComputeStep($inv) {
    $status = $inv['status'] ?? 'pending';
    $bp = (int)($inv['basePrice'] ?? 0);
    $paid = (int)($inv['totalPaid'] ?? 0);

    switch ($status) {
        case 'paid': return 'active';
        case 'partial': return 'partial';
        case 'exempt': return 'active';       // miễn phí → active luôn
        case 'frozen': return 'frozen';
        case 'cancelled': return 'cancelled';
        case 'pending':
            return $paid > 0 ? 'partial' : 'pending';
        default: return 'pending';
    }
}

// ──── AGENCY DISCOUNT HELPER (luôn lookup từ agencies.json — không lưu cứng) ────
function tsGetAgencyDiscount($agencyId) {
    if (!$agencyId) return ['percent' => 0, 'amount' => 0, 'finalPrice' => 0, 'agencyName' => ''];
    $agencies = tsLoad('agencies');
    foreach ($agencies as $a) {
        if ($a['id'] === $agencyId) {
            return [
                'percent' => (float)($a['discountPercent'] ?? 0),
                'amount' => 0, // sẽ tính sau khi có basePrice
                'finalPrice' => 0,
                'agencyName' => $a['name'] ?? '',
            ];
        }
    }
    return ['percent' => 0, 'amount' => 0, 'finalPrice' => 0, 'agencyName' => ''];
}

function tsCalcDiscount($basePrice, $discountPercent) {
    $percent = (float)$discountPercent;
    $amount = $percent > 0 ? (int)($basePrice * $percent / 100) : 0;
    $finalPrice = max(0, $basePrice - $amount);
    return ['percent' => $percent, 'amount' => $amount, 'finalPrice' => $finalPrice];
}

function tsEnrichWithAgencyDiscount(&$inv) {
    $agencyId = $inv['agencyId'] ?? '';
    $bp = (int)($inv['basePrice'] ?? 0);
    $agInfo = tsGetAgencyDiscount($agencyId);
    $disc = tsCalcDiscount($bp, $agInfo['percent']);
    $inv['agencyDiscountPercent'] = $disc['percent'];
    $inv['agencyDiscountAmount'] = $disc['amount'];
    $inv['finalPrice'] = $disc['finalPrice'];
    $inv['agencyName'] = $agInfo['agencyName'];
    $inv['owesToSmc'] = $bp > 0 ? max(0, $bp - $disc['amount']) : 0;
    return $inv;
}

// ──── SYNC HELPERS (gọi mỗi khi transaction được confirm) ────
function tsSyncStudentStatus($studentId, $confirmedBy) {
    $users = tsLoad('users');
    foreach ($users as &$u) {
        if ($u['id'] === $studentId) {
            if (($u['status'] ?? '') !== 'ACTIVE') {
                $u['status'] = 'ACTIVE';
                $u['activatedBy'] = $confirmedBy;
                $u['activatedAt'] = date('c');
                tsSave('users', $users);
            }
            return $u;
        }
    }
    unset($u);
    return null;
}

function tsSyncEnrollment($studentId, $courseId, $courseName, $confirmedBy, $totalPaid, $basePrice, $paymentMethod) {
    $enrollments = tsLoad('enrollments');
    $now = date('c');
    $found = false;

    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $studentId) {
            $found = true;
            if (empty($enr['course_id']) && $courseId) {
                $enr['course_id'] = $courseId;
                $enr['course_name'] = $courseName;
            }
            $enr['payment'] = [
                'amount' => (int)$basePrice,
                'paid' => (int)$totalPaid,
                'status' => $totalPaid >= $basePrice ? 'paid' : 'partial',
                'method' => $paymentMethod,
                'date' => $now,
                'confirmed_by' => $confirmedBy,
            ];
            $enr['status'] = 'active';
            $enr['confirmed_by'] = $confirmedBy;
            $enr['confirmed_at'] = $now;
            if (empty($enr['stages']['enrollment']) || ($enr['stages']['enrollment']['status'] ?? '') !== 'completed') {
                $enr['stages']['enrollment'] = ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $confirmedBy];
            }
            break;
        }
    }
    unset($enr);

    if (!$found) {
        $enrollments[] = [
            'student_id' => $studentId,
            'class_id' => '',
            'course_id' => $courseId,
            'course_name' => $courseName,
            'documents' => [
                'id_card' => ['status' => 'pending', 'url' => ''],
                'health_cert' => ['status' => 'pending', 'url' => ''],
                'education' => ['status' => 'pending', 'url' => ''],
            ],
            'payment' => [
                'amount' => (int)$basePrice,
                'paid' => (int)$totalPaid,
                'status' => $totalPaid >= $basePrice ? 'paid' : 'partial',
                'method' => $paymentMethod,
                'date' => $now,
                'confirmed_by' => $confirmedBy,
            ],
            'status' => 'active',
            'confirmed_by' => $confirmedBy,
            'confirmed_at' => $now,
            'stages' => [
                'enrollment' => ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $confirmedBy],
                'theory' => ['status' => 'pending'],
                'practice' => ['status' => 'pending'],
                'exam' => ['status' => 'pending'],
                'certification' => ['status' => 'pending'],
            ],
        ];
    }
    tsSave('enrollments', $enrollments);
}

function tsSyncAgencyCommission($invoice, $agency) {
    if (!$invoice['agencyId'] || !$agency) return;

    $commissions = tsLoad('agency_commissions');

    // Check existing
    foreach ($commissions as &$comm) {
        if (($comm['invoiceId'] ?? '') === $invoice['id']) {
            $comm['totalPaid'] = (int)$invoice['totalPaid'];
            $comm['status'] = $invoice['totalPaid'] >= $invoice['basePrice'] ? 'settled' : 'pending';
            $comm['updatedAt'] = date('c');
            tsSave('agency_commissions', $commissions);
            return;
        }
    }
    unset($comm);

    // Create new
    $commissions[] = [
        'id' => 'comm-' . bin2hex(random_bytes(6)),
        'agencyId' => $invoice['agencyId'],
        'invoiceId' => $invoice['id'],
        'studentId' => $invoice['studentId'],
        'basePrice' => (int)$invoice['basePrice'],
        'discountPercent' => (float)$invoice['agencyDiscountPercent'],
        'discountAmount' => (int)$invoice['agencyDiscountAmount'],
        'finalPrice' => (int)$invoice['finalPrice'],
        'totalPaid' => (int)$invoice['totalPaid'],
        'status' => $invoice['totalPaid'] >= $invoice['basePrice'] ? 'settled' : 'pending',
        'period' => date('Y-m'),
        'createdAt' => date('c'),
        'updatedAt' => date('c'),
    ];
    tsSave('agency_commissions', $commissions);
}

// ──── ROUTING ────
$tsMethod = $_SERVER['REQUEST_METHOD'];
$tsAction = $_GET['action'] ?? '';

// =====================================================================
// ACTION: create-invoice
// Staff/Admin tạo hóa đơn học phí cho học viên (đã áp chiết khấu đại lý)
// POST Body: { studentId*, courseId*, basePrice?, agencyId?, note? }
// =====================================================================
if ($tsAction === 'create-invoice') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $studentId = $input['studentId'] ?? '';
    $courseId = $input['courseId'] ?? '';
    $basePrice = (int)($input['basePrice'] ?? 0);
    $agencyId = $input['agencyId'] ?? '';
    $note = $input['note'] ?? '';
    $classId = $input['classId'] ?? '';

    if (!$studentId) tsJson(['error' => 'Thiếu studentId'], 400);
    if (!$courseId) tsJson(['error' => 'Thiếu courseId'], 400);

    // Verify student
    $users = tsLoad('users');
    $student = null;
    foreach ($users as $u) {
        if ($u['id'] === $studentId) { $student = $u; break; }
    }
    if (!$student) tsJson(['error' => 'Không tìm thấy học viên'], 404);

    // Get course
    $courses = tsLoad('courses');
    $course = null;
    foreach ($courses as $c) {
        if ($c['id'] === $courseId) { $course = $c; break; }
    }
    if (!$course) tsJson(['error' => 'Không tìm thấy khóa học'], 404);

    // Price: ưu tiên basePrice input > course.price
    if ($basePrice <= 0) {
        $basePrice = (int)($course['price'] ?? 0);
    }

    // Check existing invoice for this student+course
    $invoices = tsLoad('invoices');
    $existingIdx = null;
    foreach ($invoices as $i => $inv) {
        if (($inv['studentId'] ?? '') === $studentId && ($inv['courseId'] ?? '') === $courseId) {
            tsJson(['error' => 'Học viên đã có hóa đơn cho khóa học này. Vui lòng cập nhật hóa đơn hiện tại.', 'existingInvoice' => $inv], 409);
        }
    }

    // Calculate agency discount (LUÔN lookup từ agencies.json, KHÔNG lưu cứng)
    $agency = null;
    $discountPercent = 0;
    $discountAmount = 0;
    $finalPrice = $basePrice;

    if ($agencyId) {
        $agInfo = tsGetAgencyDiscount($agencyId);
        $discountPercent = $agInfo['percent'];
        if ($discountPercent > 0) {
            $disc = tsCalcDiscount($basePrice, $discountPercent);
            $discountAmount = $disc['amount'];
            $finalPrice = $disc['finalPrice'];
            $agency = ['id' => $agencyId, 'name' => $agInfo['agencyName'], 'discountPercent' => $discountPercent];
        }
    }

    // KHÔNG cho phép học viên miễn phí thuộc đại lý (finalPrice = 0)
    if ($agencyId && $finalPrice <= 0 && $basePrice > 0) {
        tsJson(['error' => 'Không được tạo học viên miễn phí cho đại lý. Vui lòng giảm chiết khấu đại lý (phải < 100%).'], 400);
    }

    $now = date('c');
    $invoiceId = 'inv-' . bin2hex(random_bytes(8));

    // ── TỰ ĐỘNG XẾP LỚP nếu có chọn classId ──
    $autoClassId = $input['classId'] ?? '';
    $autoClassName = '';

    if ($autoClassId) {
        $classes = tsLoad('classes');
        foreach ($classes as &$cl) {
            if ($cl['id'] === $autoClassId) {
                // Kiểm tra đầy
                $currentCount = count($cl['student_ids'] ?? []);
                $maxStudents = (int)($cl['max_students'] ?? 20);
                if ($currentCount >= $maxStudents && !in_array($studentId, $cl['student_ids'] ?? [])) {
                    tsJson(['error' => 'Lớp đã đầy ('.$currentCount.'/'.$maxStudents.'). Không thể xếp thêm.'], 400);
                }
                // Thêm vào lớp
                if (!in_array($studentId, $cl['student_ids'] ?? [])) {
                    $cl['student_ids'][] = $studentId;
                }
                $autoClassName = $cl['name'] ?? '';
                break;
            }
        }
        unset($cl);
        if ($autoClassName) {
            tsSave('classes', $classes);

            // Cập nhật enrollment
            $enrollments = tsLoad('enrollments');
            $hasEnr = false;
            foreach ($enrollments as &$enr) {
                if (($enr['student_id'] ?? '') === $studentId) {
                    $enr['class_id'] = $autoClassId;
                    $enr['status'] = 'active';
                    $hasEnr = true;
                    break;
                }
            }
            unset($enr);
            if (!$hasEnr) {
                $enrollments[] = [
                    'student_id' => $studentId,
                    'class_id' => $autoClassId,
                    'course_id' => $courseId,
                    'course_name' => $course['name'] ?? '',
                    'documents' => [
                        'id_card' => ['status' => 'pending', 'url' => ''],
                        'health_cert' => ['status' => 'pending', 'url' => ''],
                        'education' => ['status' => 'pending', 'url' => ''],
                    ],
                    'payment' => [
                        'amount' => (int)$basePrice,
                        'paid' => 0,
                        'status' => 'unpaid',
                        'method' => '',
                        'date' => null,
                        'confirmed_by' => null,
                    ],
                    'status' => 'active',
                    'confirmed_by' => $auth['id'],
                    'confirmed_at' => $now,
                    'stages' => [
                        'enrollment' => ['status' => 'in_progress', 'completed_at' => null, 'confirmed_by' => null],
                        'theory' => ['status' => 'pending'],
                        'practice' => ['status' => 'pending'],
                        'exam' => ['status' => 'pending'],
                        'certification' => ['status' => 'pending'],
                    ],
                ];
            }
            tsSave('enrollments', $enrollments);
        }
    }

    $invoice = [
        'id' => $invoiceId,
        'studentId' => $studentId,
        'studentName' => $student['fullName'] ?? '',
        'studentEmail' => $student['email'] ?? '',
        'studentPhone' => $student['phone'] ?? '',
        'courseId' => $courseId,
        'courseName' => $course['name'] ?? '',
        'basePrice' => $basePrice,
        'agencyId' => $agencyId,
        'agencyName' => $agency['name'] ?? '',
        'agencyDiscountPercent' => $discountPercent,
        'agencyDiscountAmount' => $discountAmount,
        'finalPrice' => $finalPrice,
        'totalPaid' => 0,
        'remainingDue' => $basePrice,         // remainingDue = basePrice (học viên nộp giá gốc)
        'status' => 'pending',  // pending | partial | paid | frozen | cancelled
        'note' => $note,
        'createdBy' => $auth['id'],
        'createdAt' => $now,
        'updatedAt' => $now,
    ];

    $invoices[] = $invoice;
    tsSave('invoices', $invoices);

    // Nếu có agency → tạo commission record ngay
    if ($agency && $discountPercent > 0) {
        $commissions = tsLoad('agency_commissions');
        $commissions[] = [
            'id' => 'comm-' . bin2hex(random_bytes(6)),
            'agencyId' => $agencyId,
            'invoiceId' => $invoiceId,
            'studentId' => $studentId,
            'basePrice' => $basePrice,
            'discountPercent' => $discountPercent,
            'discountAmount' => $discountAmount,
            'finalPrice' => $finalPrice,
            'totalPaid' => 0,
            'status' => 'pending',
            'period' => date('Y-m'),
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        tsSave('agency_commissions', $commissions);
    }

    tsJson([
        'success' => true,
        'message' => 'Đã tạo hóa đơn học phí thành công!',
        'data' => $invoice,
    ], 201);
}

// =====================================================================
// ACTION: record-payment (v4 — Quy trình 2 bước cho tiền mặt)
// Staff/Admin ghi nhận 1 khoản thanh toán (học viên nộp trực tiếp)
//
// QUY TRÌNH MỚI (v4):
//   - Tiền mặt (cash) → status='staff_confirmed' — CHƯA kích hoạt, cần Kế toán duyệt
//   - Chuyển khoản (bank_transfer) → status='pending' — chờ Kế toán đối soát
//   - Admin/Accountant gọi → được phép bypass, status='confirmed' luôn
//
// POST Body: { invoiceId*, amount*, method?, note? }
// =====================================================================
if ($tsAction === 'record-payment') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT', 'admin', 'staff', 'accountant']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $invoiceId = $input['invoiceId'] ?? '';
    $amount = (int)($input['amount'] ?? 0);
    $method = $input['method'] ?? 'cash';
    $note = $input['note'] ?? '';

    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);
    if ($amount <= 0) tsJson(['error' => 'Số tiền không hợp lệ'], 400);

    // Find invoice
    $invoices = tsLoad('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === $invoiceId) { $invIdx = $i; break; }
    }
    if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    $invoice = $invoices[$invIdx];
    $now = date('c');

    // ── v5: Luồng 3 tầng (Nhân viên → Kế toán → Admin) ──
    $role = strtolower($auth['role'] ?? '');
    $isAdmin = ($role === 'admin');
    $isAccountant = ($role === 'accountant');
    $isCash = ($method === 'cash');

    if ($isAdmin) {
        // Admin → auto-confirmed (bypass cả 2 bước)
        $txnStatus = 'confirmed';
        $approvalLevel = 'admin_direct';
    } elseif ($isAccountant) {
        // Kế toán ghi nhận → accountant_confirmed (chờ Admin duyệt cuối)
        $txnStatus = 'accountant_confirmed';
        $approvalLevel = 'accountant';
    } elseif ($isCash) {
        // Staff thu tiền mặt → staff_confirmed (BƯỚC 1), chưa kích hoạt
        $txnStatus = 'staff_confirmed';
        $approvalLevel = 'staff';
    } else {
        // Bank transfer → pending (chờ đối soát)
        $txnStatus = 'pending';
        $approvalLevel = 'staff';
    }

    // Create transaction
    $transactions = tsLoad('transactions');
    $txnId = 'txn-' . bin2hex(random_bytes(8));
    $transaction = [
        'id' => $txnId,
        'invoiceId' => $invoiceId,
        'studentId' => $invoice['studentId'],
        'amount' => $amount,
        'method' => $method,
        'receiptImage' => null,
        'submittedBy' => $auth['id'],
        'submittedByName' => $auth['email'] ?? '',
        'confirmedBy' => $txnStatus === 'confirmed' ? $auth['id'] : null,
        'status' => $txnStatus,
        'approvalLevel' => $approvalLevel,
        'note' => $note,
        'createdAt' => $now,
        'confirmedAt' => $txnStatus === 'confirmed' ? $now : null,
    ];
    $transactions[] = $transaction;
    tsSave('transactions', $transactions);

    // CHỈ cập nhật invoice & kích hoạt nếu status = 'confirmed' (Admin duyệt cuối)
    if ($txnStatus === 'confirmed') {
        // Update invoice — dùng basePrice làm mốc
        $invoices[$invIdx]['totalPaid'] = (int)($invoice['totalPaid'] ?? 0) + $amount;
        $basePrice = (int)($invoice['basePrice'] ?? 0);
        $invoices[$invIdx]['remainingDue'] = max(0, $basePrice - $invoices[$invIdx]['totalPaid']);
        $invoices[$invIdx]['status'] = $invoices[$invIdx]['totalPaid'] >= $basePrice ? 'paid' : 'partial';
        $invoices[$invIdx]['updatedAt'] = $now;
        $invoice = $invoices[$invIdx];
        tsSave('invoices', $invoices);

        // Auto-sync: kích hoạt tài khoản + enrollment + commission
        tsSyncStudentStatus($invoice['studentId'], $auth['id']);
        tsSyncEnrollment($invoice['studentId'], $invoice['courseId'], $invoice['courseName'], $auth['id'], $invoice['totalPaid'], $basePrice, $method);

        if ($invoice['agencyId']) {
            $agInfo = tsGetAgencyDiscount($invoice['agencyId']);
            $disc = tsCalcDiscount($basePrice, $agInfo['percent']);
            $invoice['agencyDiscountPercent'] = $disc['percent'];
            $invoice['agencyDiscountAmount'] = $disc['amount'];
            $invoice['finalPrice'] = $disc['finalPrice'];
            $invoice['agencyName'] = $agInfo['agencyName'];
            tsSyncAgencyCommission($invoice, ['id' => $invoice['agencyId'], 'name' => $agInfo['agencyName'], 'discountPercent' => $disc['percent']]);
        }
    }
    // Nếu là staff_confirmed / pending / accountant_confirmed → KHÔNG cập nhật invoice, KHÔNG kích hoạt
    // Chỉ lưu transaction, chờ duyệt qua confirm-receipt (Kế toán) → admin-final-approve (Admin)

    // Build message
    if ($txnStatus === 'confirmed') {
        $msg = 'Đã ghi nhận & duyệt thanh toán thành công!';
    } elseif ($txnStatus === 'accountant_confirmed') {
        $msg = 'Đã ghi nhận & xác nhận thanh toán! Chuyển cho Admin duyệt cuối để kích hoạt khóa học.';
    } elseif ($txnStatus === 'staff_confirmed') {
        $msg = 'Đã xác nhận thu tiền mặt! Chuyển cho Kế toán để đối soát.';
    } else {
        $msg = 'Đã ghi nhận thanh toán! Kế toán sẽ đối soát và xác nhận.';
    }

    tsJson([
        'success' => true,
        'message' => $msg,
        'data' => [
            'transaction' => $transaction,
            'invoice' => $invoices[$invIdx] ?? $invoice,
            'needsAccountant' => ($txnStatus !== 'confirmed'),
        ],
    ], 201);
}

// =====================================================================
// ACTION: submit-receipt
// Student nộp biên lai chuyển khoản (cần Staff confirm)
// POST Body: { invoiceId*, amount*, method?, receiptImage?, note? }
// =====================================================================
if ($tsAction === 'submit-receipt') {
    $auth = tsAuth();
    if (!$auth) tsJson(['error' => 'Unauthorized'], 401);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $invoiceId = $input['invoiceId'] ?? '';
    $amount = (int)($input['amount'] ?? 0);
    $method = $input['method'] ?? 'bank_transfer';
    $receiptImage = $input['receiptImage'] ?? null;
    $note = $input['note'] ?? '';

    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);
    if ($amount <= 0) tsJson(['error' => 'Số tiền không hợp lệ'], 400);

    // Find invoice & verify ownership
    $invoices = tsLoad('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === $invoiceId) { $invIdx = $i; break; }
    }
    if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    $invoice = $invoices[$invIdx];
    if ($invoice['studentId'] !== $auth['id'] && !in_array($auth['role'], ['ADMIN', 'STAFF'])) {
        tsJson(['error' => 'Không có quyền nộp biên lai cho hóa đơn này'], 403);
    }

    $now = date('c');

    // Create transaction (pending confirmation)
    $transactions = tsLoad('transactions');
    $txnId = 'txn-' . bin2hex(random_bytes(8));
    $transaction = [
        'id' => $txnId,
        'invoiceId' => $invoiceId,
        'studentId' => $invoice['studentId'],
        'amount' => $amount,
        'method' => $method,
        'receiptImage' => $receiptImage,
        'submittedBy' => $auth['id'],
        'submittedByName' => $auth['email'] ?? '',
        'confirmedBy' => null,
        'status' => 'pending',
        'note' => $note,
        'createdAt' => $now,
        'confirmedAt' => null,
    ];
    $transactions[] = $transaction;
    tsSave('transactions', $transactions);

    // Update payment_receipts (legacy compatibility)
    $receipts = tsLoad('payment_receipts');
    $receipts[] = [
        'id' => 'receipt-' . bin2hex(random_bytes(8)),
        'studentId' => $auth['id'],
        'transactionId' => $txnId,
        'invoiceId' => $invoiceId,
        'paymentMethod' => $method,
        'paymentAmount' => $amount,
        'paymentReceipt' => $receiptImage,
        'paymentNote' => $note,
        'submittedAt' => $now,
        'status' => 'pending_review',
    ];
    tsSave('payment_receipts', $receipts);

    tsJson([
        'success' => true,
        'message' => 'Đã nộp biên lai thanh toán! Nhân viên SMC sẽ xác nhận trong thời gian sớm nhất.',
        'data' => ['transaction' => $transaction],
    ], 201);
}

// =====================================================================
// ACTION: confirm-receipt (v5 — CHỈ Accountant/Admin được duyệt)
// Kế toán đối soát & duyệt phiếu thu → chuyển trạng thái accountant_confirmed
// Admin duyệt → confirmed (kích hoạt khóa học)
//
// Xử lý cả staff_confirmed (tiền mặt — Staff đã xác nhận)
// và pending (chuyển khoản — Student đã nộp biên lai)
//
// v5: Accountant duyệt → accountant_confirmed (CHƯA kích hoạt)
//     Admin duyệt → confirmed (kích hoạt)
//
// POST Body: { transactionId*, note? }
// =====================================================================
if ($tsAction === 'confirm-receipt') {
    $auth = tsRequireAccountant(); // v5: Accountant/Admin
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $transactionId = $input['transactionId'] ?? '';
    $note = $input['note'] ?? '';

    if (!$transactionId) tsJson(['error' => 'Thiếu transactionId'], 400);

    // Find transaction
    $transactions = tsLoad('transactions');
    $txnIdx = null;
    foreach ($transactions as $i => $txn) {
        if ($txn['id'] === $transactionId) { $txnIdx = $i; break; }
    }
    if ($txnIdx === null) tsJson(['error' => 'Không tìm thấy giao dịch'], 404);

    $txn = $transactions[$txnIdx];
    if ($txn['status'] === 'confirmed') tsJson(['error' => 'Giao dịch đã được xác nhận trước đó'], 400);
    if ($txn['status'] === 'rejected') tsJson(['error' => 'Giao dịch đã bị từ chối'], 400);
    if ($txn['status'] === 'accountant_confirmed') tsJson(['error' => 'Giao dịch đã được Kế toán duyệt — cần Admin duyệt cuối'], 400);
    // v5: Cho phép duyệt pending (chuyển khoản) và staff_confirmed (tiền mặt)
    if (!in_array($txn['status'], ['pending', 'staff_confirmed'])) {
        tsJson(['error' => 'Giao dịch không ở trạng thái có thể duyệt (hiện tại: ' . $txn['status'] . ')'], 400);
    }

    $now = date('c');
    $role = strtolower($auth['role'] ?? '');

    // v5: Phân biệt Accountant vs Admin
    if ($role === 'admin') {
        // Admin → duyệt thẳng thành confirmed + kích hoạt
        $newStatus = 'confirmed';
        $newApprovalLevel = 'admin_direct';
    } else {
        // Accountant → accountant_confirmed, CHƯA kích hoạt (chờ Admin duyệt cuối)
        $newStatus = 'accountant_confirmed';
        $newApprovalLevel = 'accountant';
    }

    // Update transaction
    $transactions[$txnIdx]['status'] = $newStatus;
    $transactions[$txnIdx]['approvalLevel'] = $newApprovalLevel;
    $transactions[$txnIdx]['confirmedBy'] = $auth['id'];
    $transactions[$txnIdx]['confirmedAt'] = $now;
    if ($note) $transactions[$txnIdx]['note'] = $note;
    tsSave('transactions', $transactions);

    // Update payment_receipts
    $receipts = tsLoad('payment_receipts');
    foreach ($receipts as &$r) {
        if (($r['transactionId'] ?? '') === $transactionId) {
            $r['status'] = $newStatus === 'confirmed' ? 'confirmed' : 'accountant_reviewed';
            $r['confirmedBy'] = $auth['id'];
            $r['confirmedAt'] = $now;
            break;
        }
    }
    unset($r);
    tsSave('payment_receipts', $receipts);

    // CHỈ kích hoạt nếu Admin duyệt (confirmed)
    if ($newStatus === 'confirmed') {
        // Update invoice
        $invoices = tsLoad('invoices');
        $invIdx = null;
        foreach ($invoices as $i => $inv) {
            if ($inv['id'] === $txn['invoiceId']) { $invIdx = $i; break; }
        }
        if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn liên quan'], 404);

        $invoice = $invoices[$invIdx];
        $invoices[$invIdx]['totalPaid'] = (int)($invoice['totalPaid'] ?? 0) + (int)$txn['amount'];
        $basePrice = (int)($invoice['basePrice'] ?? 0);
        $invoices[$invIdx]['remainingDue'] = max(0, $basePrice - $invoices[$invIdx]['totalPaid']);
        $invoices[$invIdx]['status'] = $invoices[$invIdx]['totalPaid'] >= $basePrice ? 'paid' : 'partial';
        $invoices[$invIdx]['updatedAt'] = $now;
        $invoice = $invoices[$invIdx];
        tsSave('invoices', $invoices);

        // Auto-sync: kích hoạt tài khoản + enrollment + commission
        tsSyncStudentStatus($invoice['studentId'], $auth['id']);
        tsSyncEnrollment($invoice['studentId'], $invoice['courseId'], $invoice['courseName'], $auth['id'], $invoice['totalPaid'], $basePrice, $txn['method']);

        if ($invoice['agencyId']) {
            $agInfo = tsGetAgencyDiscount($invoice['agencyId']);
            $disc = tsCalcDiscount($basePrice, $agInfo['percent']);
            $invoice['agencyDiscountPercent'] = $disc['percent'];
            $invoice['agencyDiscountAmount'] = $disc['amount'];
            $invoice['finalPrice'] = $disc['finalPrice'];
            $invoice['agencyName'] = $agInfo['agencyName'];
            tsSyncAgencyCommission($invoice, ['id' => $invoice['agencyId'], 'name' => $agInfo['agencyName'], 'discountPercent' => $disc['percent']]);
        }

        $msg = 'Đã xác nhận & kích hoạt khóa học!';
    } else {
        $msg = 'Đã xác nhận phiếu thu! Chuyển cho Admin duyệt cuối để kích hoạt khóa học.';
    }

    tsJson([
        'success' => true,
        'message' => $msg,
        'data' => [
            'transaction' => $transactions[$txnIdx],
            'needsAdminApproval' => ($newStatus === 'accountant_confirmed'),
        ],
    ]);
}

// =====================================================================
// ACTION: reject-receipt
// Staff/Admin từ chối biên lai
// POST Body: { transactionId*, reason? }
// =====================================================================
if ($tsAction === 'reject-receipt') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $transactionId = $input['transactionId'] ?? '';
    $reason = $input['reason'] ?? 'Biên lai không hợp lệ';

    if (!$transactionId) tsJson(['error' => 'Thiếu transactionId'], 400);

    $transactions = tsLoad('transactions');
    $txnIdx = null;
    foreach ($transactions as $i => $txn) {
        if ($txn['id'] === $transactionId) { $txnIdx = $i; break; }
    }
    if ($txnIdx === null) tsJson(['error' => 'Không tìm thấy giao dịch'], 404);

    $transactions[$txnIdx]['status'] = 'rejected';
    $transactions[$txnIdx]['confirmedBy'] = $auth['id'];
    $transactions[$txnIdx]['confirmedAt'] = date('c');
    $transactions[$txnIdx]['note'] = ($transactions[$txnIdx]['note'] ?? '') . ' [Từ chối bởi ' . ($auth['role'] ?? '') . ': ' . $reason . ']';
    tsSave('transactions', $transactions);

    // Update payment_receipts
    $receipts = tsLoad('payment_receipts');
    foreach ($receipts as &$r) {
        if (($r['transactionId'] ?? '') === $transactionId) {
            $r['status'] = 'rejected';
            break;
        }
    }
    unset($r);
    tsSave('payment_receipts', $receipts);

    tsJson(['success' => true, 'message' => 'Đã từ chối phiếu thu.']);
}

// =====================================================================
// ACTION: admin-final-approve (v5 — CHỈ Admin được duyệt cuối)
// Admin duyệt cuối cùng → kích hoạt khóa học
// Nhận transaction đã được Kế toán duyệt (accountant_confirmed)
// hoặc bypass duyệt thẳng từ staff_confirmed/pending
//
// POST Body: { transactionId*, note?, bypass? }
//   bypass=true → duyệt thẳng từ staff_confirmed/pending (bỏ qua Kế toán)
// =====================================================================
if ($tsAction === 'admin-final-approve') {
    $auth = tsRequireRole(['ADMIN', 'admin']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $transactionId = $input['transactionId'] ?? '';
    $note = $input['note'] ?? '';
    $bypass = $input['bypass'] ?? false;

    if (!$transactionId) tsJson(['error' => 'Thiếu transactionId'], 400);

    // Find transaction
    $transactions = tsLoad('transactions');
    $txnIdx = null;
    foreach ($transactions as $i => $txn) {
        if ($txn['id'] === $transactionId) { $txnIdx = $i; break; }
    }
    if ($txnIdx === null) tsJson(['error' => 'Không tìm thấy giao dịch'], 404);

    $txn = $transactions[$txnIdx];
    if ($txn['status'] === 'confirmed') tsJson(['error' => 'Giao dịch đã được duyệt trước đó'], 400);
    if ($txn['status'] === 'rejected') tsJson(['error' => 'Giao dịch đã bị từ chối, không thể duyệt'], 400);

    // Cho phép duyệt: accountant_confirmed (luồng chuẩn) hoặc staff_confirmed/pending (bypass)
    $validStatuses = $bypass ? ['pending', 'staff_confirmed', 'accountant_confirmed'] : ['accountant_confirmed'];
    if (!in_array($txn['status'], $validStatuses)) {
        tsJson(['error' => 'Giao dịch không ở trạng thái có thể duyệt cuối (hiện tại: ' . $txn['status'] . '). ' . ($bypass ? '' : 'Cần Kế toán duyệt trước, hoặc dùng bypass.')], 400);
    }

    $now = date('c');

    // Update transaction → confirmed
    $transactions[$txnIdx]['status'] = 'confirmed';
    $transactions[$txnIdx]['approvalLevel'] = $bypass ? 'admin_bypass' : 'admin_final';
    $transactions[$txnIdx]['approvedBy'] = $auth['id'];
    $transactions[$txnIdx]['approvedAt'] = $now;
    if ($note) $transactions[$txnIdx]['note'] = ($transactions[$txnIdx]['note'] ?? '') . ' [Admin: ' . $note . ']';
    tsSave('transactions', $transactions);

    // Update invoice
    $invoices = tsLoad('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === $txn['invoiceId']) { $invIdx = $i; break; }
    }
    if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn liên quan'], 404);

    $invoice = $invoices[$invIdx];
    $invoices[$invIdx]['totalPaid'] = (int)($invoice['totalPaid'] ?? 0) + (int)$txn['amount'];
    $basePrice = (int)($invoice['basePrice'] ?? 0);
    $invoices[$invIdx]['remainingDue'] = max(0, $basePrice - $invoices[$invIdx]['totalPaid']);
    $invoices[$invIdx]['status'] = $invoices[$invIdx]['totalPaid'] >= $basePrice ? 'paid' : 'partial';
    $invoices[$invIdx]['updatedAt'] = $now;
    $invoice = $invoices[$invIdx];
    tsSave('invoices', $invoices);

    // KÍCH HOẠT tài khoản học viên
    tsSyncStudentStatus($invoice['studentId'], $auth['id']);
    tsSyncEnrollment($invoice['studentId'], $invoice['courseId'], $invoice['courseName'], $auth['id'], $invoice['totalPaid'], $basePrice, $txn['method']);

    // Sync commission
    if ($invoice['agencyId']) {
        $agInfo = tsGetAgencyDiscount($invoice['agencyId']);
        $disc = tsCalcDiscount($basePrice, $agInfo['percent']);
        $invoice['agencyDiscountPercent'] = $disc['percent'];
        $invoice['agencyDiscountAmount'] = $disc['amount'];
        $invoice['finalPrice'] = $disc['finalPrice'];
        $invoice['agencyName'] = $agInfo['agencyName'];
        tsSyncAgencyCommission($invoice, ['id' => $invoice['agencyId'], 'name' => $agInfo['agencyName'], 'discountPercent' => $disc['percent']]);
    }

    tsJson([
        'success' => true,
        'message' => $bypass ? 'Đã duyệt thẳng & kích hoạt khóa học (bypass Kế toán)!' : 'Đã duyệt cuối cùng & kích hoạt khóa học!',
        'data' => [
            'transaction' => $transactions[$txnIdx],
            'invoice' => $invoice,
            'studentActivated' => true,
        ],
    ]);
}

// =====================================================================
// ACTION: get-student-invoice
// Học viên xem hóa đơn + lịch sử giao dịch của mình
// GET ?courseId= (optional)
// =====================================================================
if ($tsAction === 'get-student-invoice') {
    $auth = tsAuth();
    if (!$auth) tsJson(['error' => 'Unauthorized'], 401);

    $studentId = $auth['id'];
    $courseId = $_GET['courseId'] ?? '';

    $invoices = tsLoad('invoices');
    $users = tsLoad('users');
    $userById = [];
    foreach ($users as $u) { $userById[$u['id']] = $u; }

    $studentInvoices = [];
    foreach ($invoices as $inv) {
        if ($inv['studentId'] === $studentId) {
            if ($courseId && $inv['courseId'] !== $courseId) continue;
            $sid = $inv['studentId'] ?? '';
            $student = $userById[$sid] ?? null;
            $inv['studentRank'] = $student['rank'] ?? '';
            $studentInvoices[] = $inv;
        }
    }

    // Get transactions for these invoices
    $transactions = tsLoad('transactions');
    foreach ($studentInvoices as &$inv) {
        $inv['transactions'] = [];
        foreach ($transactions as $txn) {
            if ($txn['invoiceId'] === $inv['id']) {
                $inv['transactions'][] = $txn;
            }
        }
        // Sort newest first
        usort($inv['transactions'], fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

        // Bỏ qua enrich nếu exempt (miễn phí)
        if (($inv['status'] ?? '') === 'exempt') {
            $inv['owesToSmc'] = 0;
            continue;
        }

        // Học viên: KHÔNG hiển thị chiết khấu đại lý — luôn thấy giá gốc
        // Admin/Staff/Agency/Kế toán: có enrich discount để tính toán
        $isStudent = ($auth['role'] ?? '') === 'STUDENT';
        if ($isStudent) {
            // Học viên thấy basePrice, không thấy finalPrice sau chiết khấu
            $inv['finalPrice'] = (int)($inv['basePrice'] ?? 0);
            $inv['agencyDiscountPercent'] = 0;
            $inv['agencyDiscountAmount'] = 0;
            $inv['owesToSmc'] = 0;
        } else {
            // LUÔN lookup discount từ agency (không dùng giá trị lưu cứng trong invoice)
            tsEnrichWithAgencyDiscount($inv);
        }
        // remainingDue LUÔN = basePrice - totalPaid (số thực nộp / số thực còn thiếu)
        $inv['remainingDue'] = max(0, (int)($inv['basePrice'] ?? 0) - (int)($inv['totalPaid'] ?? 0));
        $inv['amount'] = (int)($inv['basePrice'] ?? 0);
        $inv['actualAmount'] = (int)($inv['finalPrice'] ?? $inv['basePrice'] ?? 0);
        $inv['step'] = tsComputeStep($inv);
    }
    unset($inv);

    // If student has no invoices yet, check legacy tuitions + migrate
    if (empty($studentInvoices)) {
        $legacyTuitions = tsLoad('tuitions');
        $legacy = null;
        foreach ($legacyTuitions as $t) {
            if (($t['studentId'] ?? '') === $studentId) { $legacy = $t; break; }
        }
        if ($legacy) {
            $course = null;
            $courses = tsLoad('courses');
            foreach ($courses as $c) {
                if ($c['id'] === ($legacy['courseId'] ?? '')) { $course = $c; break; }
            }
            $basePrice = (int)($legacy['amount'] ?? ($course['price'] ?? 0));
            $totalPaid = (int)($legacy['partialAmount'] ?? $legacy['paymentAmount'] ?? 0);
            if (($legacy['status'] ?? '') === 'paid') $totalPaid = $basePrice;

            $studentInvoices[] = [
                'id' => $legacy['id'] ?? '',
                'studentId' => $studentId,
                'studentName' => $legacy['studentName'] ?? '',
                'courseId' => $legacy['courseId'] ?? '',
                'courseName' => $legacy['courseName'] ?? ($course['name'] ?? ''),
                'basePrice' => $basePrice,
                'agencyId' => $legacy['agencyId'] ?? '',
                'agencyName' => '',
                'agencyDiscountPercent' => 0,
                'agencyDiscountAmount' => 0,
                'finalPrice' => $basePrice,
                'totalPaid' => $totalPaid,
                'remainingDue' => max(0, ($legacy['finalPrice'] ?? $basePrice) - $totalPaid),
                'status' => $legacy['status'] === 'paid' ? 'paid' : ($totalPaid > 0 ? 'partial' : 'pending'),
                'note' => $legacy['note'] ?? '',
                'createdBy' => $legacy['confirmedBy'] ?? '',
                'createdAt' => $legacy['createdAt'] ?? '',
                'updatedAt' => $legacy['updatedAt'] ?? '',
                'transactions' => array_map(function($h) use ($studentId) {
                    return [
                        'id' => 'txn-legacy-' . ($h['date'] ?? ''),
                        'invoiceId' => 'legacy',
                        'studentId' => $studentId,
                        'amount' => (int)($h['amount'] ?? 0),
                        'method' => $h['method'] ?? '',
                        'receiptImage' => $h['receipt'] ?? null,
                        'submittedBy' => $h['recorded_by'] ?? '',
                        'confirmedBy' => $h['confirmedBy'] ?? ($h['recorded_by'] ?? ''),
                        'status' => 'confirmed',
                        'note' => $h['note'] ?? '',
                        'createdAt' => $h['date'] ?? '',
                        'confirmedAt' => $h['date'] ?? '',
                    ];
                }, $legacy['paymentHistory'] ?? []),
                '_legacy' => true,
            ];
        }
    }

    tsJson([
        'success' => true,
        'data' => $studentInvoices,
    ]);
}

// =====================================================================
// ACTION: list-invoices
// Admin/Staff xem danh sách tất cả hóa đơn (có filter)
// GET ?status= &?search= &?courseId= &?agencyId=
// =====================================================================
if ($tsAction === 'list-invoices') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);

    $status = $_GET['status'] ?? '';
    $search = $_GET['search'] ?? '';
    $courseId = $_GET['courseId'] ?? '';
    $agencyId = $_GET['agencyId'] ?? '';

    $invoices = tsLoad('invoices');
    $transactions = tsLoad('transactions');
    $users = tsLoad('users');

    // Build user lookup by id
    $userById = [];
    foreach ($users as $u) { $userById[$u['id']] = $u; }

    // Enrich invoices with student rank + agency discount (luôn lookup từ agencies.json)
    // FIX: Không dùng reference & để tránh PHP foreach reference bug
    // Thay vào đó dùng index để cập nhật trực tiếp
    foreach ($invoices as $idx => $inv) {
        $sid = $inv['studentId'] ?? '';
        $student = $userById[$sid] ?? null;
        $inv['studentRank'] = $student['rank'] ?? '';
        // LUÔN lookup discount từ agency (không dùng giá trị lưu cứng trong invoice)
        if (!empty($inv['agencyId'])) {
            tsEnrichWithAgencyDiscount($inv);
        }
    }
    unset($inv);

    $invIdx = null;
    // Map transactions to invoices
    $txnMap = [];
    foreach ($transactions as $txn) {
        $invId = $txn['invoiceId'] ?? '';
        if (!isset($txnMap[$invId])) $txnMap[$invId] = [];
        $txnMap[$invId][] = $txn;
    }

    // Recalc totalPaid from confirmed transactions for each invoice
    foreach ($invoices as &$inv) {
        // Bỏ qua invoice exempt (miễn phí)
        if (($inv['status'] ?? '') === 'exempt') {
            $inv['totalPaid'] = 0;
            $inv['remainingDue'] = 0;
            $inv['finalPrice'] = 0;
            $inv['agencyDiscountPercent'] = 0;
            $inv['agencyDiscountAmount'] = 0;
            $inv['owesToSmc'] = 0;
            continue;
        }

        $invTxn = $txnMap[$inv['id']] ?? [];
        $inv['transactionCount'] = count($invTxn);
        $inv['lastTransaction'] = !empty($invTxn) ? $invTxn[count($invTxn) - 1] : null;

        // Nếu status=paid, totalPaid phải = basePrice
        $bp = (int)($inv['basePrice'] ?? 0);
        if (($inv['status'] ?? '') === 'paid') {
            $inv['totalPaid'] = $bp;
        }
        // Recalc remainingDue = basePrice - totalPaid
        $inv['remainingDue'] = max(0, $bp - (int)($inv['totalPaid'] ?? 0));

        // ── COMPUTED FIELDS cho frontend tương thích với tuitions cũ ──
        $inv['amount'] = $bp;                          // = basePrice (giá gốc)
        $inv['actualAmount'] = (int)($inv['finalPrice'] ?? $bp);   // giá sau chiết khấu
        $inv['step'] = tsComputeStep($inv);            // step từ status
    }
    unset($inv);

    // After migration, invoices.json is the single source of truth.
    // Only merge legacy tuitions if invoices.json is still empty (fallback).
    if (empty($invoices)) {
        $legacyTuitions = tsLoad('tuitions');
        $courses = tsLoad('courses');
        $courseMap = [];
        foreach ($courses as $c) { $courseMap[$c['id'] ?? ''] = $c; }

        $agencies = tsLoad('agencies');
        $agencyMap = [];
        foreach ($agencies as $a) { $agencyMap[$a['id'] ?? ''] = $a; }

        foreach ($legacyTuitions as $t) {
            $sid = $t['studentId'] ?? '';
            $cid = $t['courseId'] ?? '';
            $baseP = (int)($t['amount'] ?? ($courseMap[$cid]['price'] ?? 0));
            $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
            if (($t['status'] ?? '') === 'paid') $paid = max($paid, $baseP);

            $agencyIdT = $t['agencyId'] ?? '';
            $agency = $agencyIdT ? ($agencyMap[$agencyIdT] ?? null) : null;
            $discP = (float)($agency['discountPercent'] ?? $t['discountPercent'] ?? 0);
            $discA = $discP > 0 ? (int)($baseP * $discP / 100) : 0;
            $finalP = $baseP - $discA;

            $invoices[] = [
                'id' => $t['id'] ?? ('legacy-' . $sid),
                'studentId' => $sid,
                'studentName' => $t['studentName'] ?? '',
                'studentEmail' => '',
                'studentPhone' => '',
                'courseId' => $cid,
                'courseName' => $t['courseName'] ?? ($courseMap[$cid]['name'] ?? ''),
                'basePrice' => $baseP,
                'agencyId' => $agencyIdT,
                'agencyName' => $agency['name'] ?? '',
                'agencyDiscountPercent' => $discP,
                'agencyDiscountAmount' => $discA,
                'finalPrice' => $finalP,
                'totalPaid' => $paid,
                'remainingDue' => max(0, $finalPrice - $paid),
                'status' => $paid >= $baseP ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
                'note' => $t['note'] ?? '',
                'createdBy' => $t['confirmedBy'] ?? '',
                'createdAt' => $t['createdAt'] ?? '',
                'updatedAt' => $t['updatedAt'] ?? '',
                'transactionCount' => count($t['paymentHistory'] ?? []),
                'lastTransaction' => null,
                '_legacy' => true,
            ];
        }
    }

    // Filter
    if ($status) {
        $invoices = array_values(array_filter($invoices, fn($inv) => $inv['status'] === $status));
    }
    if ($courseId) {
        $invoices = array_values(array_filter($invoices, fn($inv) => $inv['courseId'] === $courseId));
    }
    if ($agencyId) {
        $invoices = array_values(array_filter($invoices, fn($inv) => $inv['agencyId'] === $agencyId));
    }
    if ($search) {
        $s = mb_strtolower($search);
        $invoices = array_values(array_filter($invoices, fn($inv) =>
            strpos(mb_strtolower($inv['studentName'] ?? ''), $s) !== false ||
            strpos(mb_strtolower($inv['studentEmail'] ?? ''), $s) !== false ||
            strpos(mb_strtolower($inv['studentPhone'] ?? ''), $s) !== false ||
            strpos(mb_strtolower($inv['courseName'] ?? ''), $s) !== false
        ));
    }

    // Sort: newest first
    usort($invoices, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

    // ── Thêm computed fields cho tất cả invoices trước khi trả về ──
    foreach ($invoices as &$inv) {
        if (!isset($inv['amount'])) $inv['amount'] = (int)($inv['basePrice'] ?? 0);
        if (!isset($inv['actualAmount'])) $inv['actualAmount'] = (int)($inv['finalPrice'] ?? $inv['basePrice'] ?? 0);
        if (!isset($inv['step'])) $inv['step'] = tsComputeStep($inv);
    }
    unset($inv);

    tsJson(['success' => true, 'data' => array_values($invoices)]);
}

// =====================================================================
// ACTION: get-invoice-detail
// Lấy chi tiết 1 invoice + tất cả transactions
// GET ?invoiceId=
// =====================================================================
if ($tsAction === 'get-invoice-detail') {
    $auth = tsAuth();
    if (!$auth) tsJson(['error' => 'Unauthorized'], 401);

    $invoiceId = $_GET['invoiceId'] ?? '';
    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);

    $invoices = tsLoad('invoices');
    $invoice = null;
    foreach ($invoices as $inv) {
        if ($inv['id'] === $invoiceId) { $invoice = $inv; break; }
    }

    // Check legacy
    if (!$invoice) {
        $legacyTuitions = tsLoad('tuitions');
        foreach ($legacyTuitions as $t) {
            if (($t['id'] ?? '') === $invoiceId) {
                $courses = tsLoad('courses');
                $course = null;
                foreach ($courses as $c) { if ($c['id'] === ($t['courseId'] ?? '')) { $course = $c; break; } }
                $baseP = (int)($t['amount'] ?? ($course['price'] ?? 0));
                $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
                if (($t['status'] ?? '') === 'paid') $paid = $baseP;

                $invoice = [
                    'id' => $t['id'] ?? '',
                    'studentId' => $t['studentId'] ?? '',
                    'studentName' => $t['studentName'] ?? '',
                    'courseId' => $t['courseId'] ?? '',
                    'courseName' => $t['courseName'] ?? ($course['name'] ?? ''),
                    'basePrice' => $baseP,
                    'finalPrice' => $baseP,
                    'totalPaid' => $paid,
                    'remainingDue' => max(0, ($finalP ?: $baseP) - $paid),
                    'status' => $paid >= $baseP ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
                    '_legacy' => true,
                ];
                break;
            }
        }
    }

    if (!$invoice) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    // Permission check
    $isOwner = $invoice['studentId'] === $auth['id'];
    $isStaff = in_array($auth['role'], ['ADMIN', 'STAFF']);
    $isAgency = false;
    if ($auth['role'] === 'AGENCY') {
        $agencies = tsLoad('agencies');
        foreach ($agencies as $a) {
            if (($a['userId'] ?? '') === $auth['id'] || $a['id'] === ($invoice['agencyId'] ?? '')) {
                $isAgency = true; break;
            }
        }
    }
    if (!$isOwner && !$isStaff && !$isAgency) tsJson(['error' => 'Forbidden'], 403);

    // Get transactions
    $transactions = tsLoad('transactions');
    $invoiceTxns = [];
    foreach ($transactions as $txn) {
        if ($txn['invoiceId'] === $invoiceId) $invoiceTxns[] = $txn;
    }

    // Get legacy transactions from paymentHistory
    if ($invoice['_legacy'] ?? false) {
        $legacyTuitions = tsLoad('tuitions');
        foreach ($legacyTuitions as $t) {
            if (($t['id'] ?? '') === $invoiceId) {
                foreach ($t['paymentHistory'] ?? [] as $h) {
                    $invoiceTxns[] = [
                        'id' => 'txn-legacy-' . ($h['date'] ?? ''),
                        'invoiceId' => $invoiceId,
                        'studentId' => $invoice['studentId'],
                        'amount' => (int)($h['amount'] ?? 0),
                        'method' => $h['method'] ?? '',
                        'submittedBy' => $h['recorded_by'] ?? '',
                        'confirmedBy' => $h['confirmedBy'] ?? ($h['recorded_by'] ?? ''),
                        'status' => 'confirmed',
                        'note' => $h['note'] ?? '',
                        'createdAt' => $h['date'] ?? '',
                        'confirmedAt' => $h['date'] ?? '',
                    ];
                }
                break;
            }
        }
    }

    // Sort newest first
    usort($invoiceTxns, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

    $invoice['transactions'] = $invoiceTxns;

    // Enrich với agency discount từ agencies.json (luôn lookup, không dùng giá trị cũ)
    // Và bỏ qua nếu exempt
    if (($invoice['status'] ?? '') !== 'exempt' && !empty($invoice['agencyId'])) {
        tsEnrichWithAgencyDiscount($invoice);
    }

    // Đảm bảo remainingDue = basePrice - totalPaid (công thức thống nhất)
    $bp = (int)($invoice['basePrice'] ?? 0);
    $paid = (int)($invoice['totalPaid'] ?? 0);
    $invoice['remainingDue'] = max(0, $bp - $paid);

    // Computed fields cho frontend
    $invoice['amount'] = $bp;
    $invoice['actualAmount'] = (int)($invoice['finalPrice'] ?? $bp);
    $invoice['step'] = tsComputeStep($invoice);

    tsJson(['success' => true, 'data' => $invoice]);
}

// =====================================================================
// ACTION: get-agency-report
// Đại lý xem báo cáo học phí học viên của mình
// GET (tự động detect agency từ token)
// =====================================================================
if ($tsAction === 'get-agency-report') {
    $auth = tsAuth();
    if (!$auth) tsJson(['error' => 'Unauthorized'], 401);

    // Find agency from user
    $agencies = tsLoad('agencies');
    $agency = null;
    foreach ($agencies as $a) {
        if (($a['userId'] ?? '') === $auth['id']) { $agency = $a; break; }
    }
    if (!$agency && $auth['role'] === 'AGENCY') {
        // Try find by email
        foreach ($agencies as $a) {
            if (($a['email'] ?? '') === $auth['email']) { $agency = $a; break; }
        }
    }
    if (!$agency && !in_array($auth['role'], ['ADMIN', 'STAFF', 'ACCOUNTANT'])) {
        tsJson(['error' => 'Không tìm thấy thông tin đại lý'], 404);
    }

    $agencyId = $agency['id'] ?? ($_GET['agencyId'] ?? '');

    // Nếu ADMIN/STAFF gọi với agencyId, load thông tin agency để lấy discountPercent
    if (!$agency && !empty($_GET['agencyId'])) {
        foreach ($agencies as $a) {
            if (($a['id'] ?? '') === $_GET['agencyId']) {
                $agency = $a;
                break;
            }
        }
    }
    $discPercent = (float)($agency['discountPercent'] ?? 0);

    // Get invoices for this agency
    $invoices = tsLoad('invoices');
    $agencyInvoices = [];
    foreach ($invoices as $inv) {
        if ($inv['agencyId'] === $agencyId) {
            $bp = (int)($inv['basePrice'] ?? 0);
            // Bỏ qua nếu basePrice = 0 (invalid)
            if ($bp <= 0) continue;

            // LUÔN lookup discount từ agency (không dùng giá trị lưu cứng trong invoice)
            tsEnrichWithAgencyDiscount($inv);

            // Bỏ qua học viên miễn phí (finalPrice = 0) — không được có trong đại lý
            $fp = (int)($inv['finalPrice'] ?? 0);
            if ($fp <= 0 && $bp > 0) continue;

            // Chuẩn hóa: nếu status=paid thì totalPaid = basePrice
            if (($inv['status'] ?? '') === 'paid') {
                $inv['totalPaid'] = $bp;
            }
            $inv['remainingDue'] = max(0, $bp - (int)($inv['totalPaid'] ?? 0));
            $agencyInvoices[] = $inv;
        }
    }

    // Also check legacy tuitions
    $legacyTuitions = tsLoad('tuitions');
    $courses = tsLoad('courses');
    $courseMap = [];
    foreach ($courses as $c) { $courseMap[$c['id'] ?? ''] = $c; }
    $users = tsLoad('users');

    $existingIds = [];
    foreach ($agencyInvoices as $inv) {
        $existingIds[$inv['studentId'] . '_' . $inv['courseId']] = true;
        // Cũng đánh dấu studentId-only để tránh trùng lặp khi courseId khác format (cũ vs mới)
        $existingIds[$inv['studentId']] = true;
    }

    foreach ($legacyTuitions as $t) {
        $sid = $t['studentId'] ?? '';
        $cid = $t['courseId'] ?? '';
        if (isset($existingIds[$sid . '_' . $cid]) || isset($existingIds[$sid])) continue;
        $existingIds[$sid] = true; // tránh bị add nhiều lần

        // Check if student belongs to this agency
        $studentAgencyId = '';
        foreach ($users as $u) {
            if ($u['id'] === $sid) { $studentAgencyId = $u['agencyId'] ?? ''; break; }
        }
        if ($studentAgencyId !== $agencyId) continue;

        // FIX: Dùng baseAmount (giá gốc trước CK) thay vì amount (giá sau CK)
        $coursePrice = (int)($courseMap[$cid]['price'] ?? 0);
        $baseP = (int)($t['baseAmount'] ?? 0);
        if ($baseP <= 0) $baseP = $coursePrice;
        if ($baseP <= 0) $baseP = (int)($t['amount'] ?? 0);

        $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
        $discP = (float)($agency['discountPercent'] ?? 0);
        $discA = $discP > 0 ? (int)($baseP * $discP / 100) : 0;
        $finalP = $baseP - $discA;
        // Nếu status=paid thì học viên đã nộp đủ basePrice (giá gốc)
        if (($t['status'] ?? '') === 'paid') $paid = max($paid, $baseP);

        $agencyInvoices[] = [
            'id' => $t['id'] ?? ('legacy-' . $sid),
            'studentId' => $sid,
            'studentName' => $t['studentName'] ?? '',
            'courseId' => $cid,
            'courseName' => $t['courseName'] ?? ($courseMap[$cid]['name'] ?? ''),
            'basePrice' => $baseP,
            'agencyId' => $agencyId,
            'agencyDiscountPercent' => $discP,
            'agencyDiscountAmount' => $discA,
            'finalPrice' => $finalP,
            'totalPaid' => $paid,
            'remainingDue' => max(0, $baseP - $paid),   // FIX: remainingDue = basePrice - totalPaid (giá gốc mới đúng)
            'status' => $paid >= $baseP ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
            '_legacy' => true,
        ];
    }

    // Stats
    $totalBase = 0; $totalFinal = 0; $totalPaid = 0; $totalDue = 0;
    $totalOwesToSmc = 0;
    $paidCount = 0; $partialCount = 0; $pendingCount = 0;

    $discPercentForStats = (float)($agency['discountPercent'] ?? 0);
    foreach ($agencyInvoices as &$inv) {
        $base = (int)($inv['basePrice'] ?? 0);
        $final = (int)($inv['finalPrice'] ?? 0);
        $paid = (int)($inv['totalPaid'] ?? 0);
        $due = (int)($inv['remainingDue'] ?? 0);

        // owesToSmc = basePrice × (1 - discountPercent/100)
        $invDiscountPercent = (float)($inv['agencyDiscountPercent'] ?? $discPercentForStats);
        $owesToSmc = $base > 0 ? (int)($base * (1 - $invDiscountPercent / 100)) : 0;
        $inv['owesToSmc'] = $owesToSmc;

        // ── Computed fields cho frontend ──
        $inv['amount'] = $base;
        $inv['actualAmount'] = $final;
        $inv['step'] = tsComputeStep($inv);

        $totalBase += $base;
        $totalFinal += $final;
        $totalPaid += $paid;
        $totalDue += $due;
        $totalOwesToSmc += $owesToSmc;

        if ($inv['status'] === 'paid') $paidCount++;
        elseif ($inv['status'] === 'partial') $partialCount++;
        else $pendingCount++;
    }
    unset($inv);

    $collectionRate = $totalBase > 0 ? round(($totalPaid / $totalBase) * 100, 1) : 0;

    tsJson([
        'success' => true,
        'data' => [
            'agency' => $agency ? [
                'id' => $agency['id'],
                'name' => $agency['name'] ?? '',
                'discountPercent' => (float)($agency['discountPercent'] ?? 0),
            ] : null,
            'stats' => [
                'totalStudents' => count($agencyInvoices),
                'paidCount' => $paidCount,
                'partialCount' => $partialCount,
                'pendingCount' => $pendingCount,
                'totalBaseRevenue' => $totalBase,
                'totalBaseRevenueFmt' => number_format($totalBase) . ' ₫',
                'totalFinalRevenue' => $totalFinal,
                'totalFinalRevenueFmt' => number_format($totalFinal) . ' ₫',
                'totalDiscount' => $totalBase - $totalFinal,
                'totalDiscountFmt' => number_format($totalBase - $totalFinal) . ' ₫',
                'totalPaid' => $totalPaid,
                'totalPaidFmt' => number_format($totalPaid) . ' ₫',
                'totalDue' => $totalDue,
                'totalDueFmt' => number_format($totalDue) . ' ₫',
                'totalOwesToSmc' => $totalOwesToSmc,
                'totalOwesToSmcFmt' => number_format($totalOwesToSmc) . ' ₫',
                'collectionRate' => $collectionRate,
            ],
            'invoices' => $agencyInvoices,
        ],
    ]);
}

// =====================================================================
// ACTION: get-overall-report
// Admin/Staff xem báo cáo tổng quan toàn hệ thống
// GET
// =====================================================================
if ($tsAction === 'get-overall-report') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);

    $invoices = tsLoad('invoices');
    $transactions = tsLoad('transactions');
    $users = tsLoad('users');
    $courses = tsLoad('courses');

    // Build user lookup
    $userById = [];
    foreach ($users as $u) { $userById[$u['id']] = $u; }

    // Build course lookup (id + legacy_id)
    $courseById = []; $courseByLegacy = [];
    foreach ($courses as $c) {
        $courseById[$c['id'] ?? ''] = $c;
        if (!empty($c['legacy_id'])) $courseByLegacy[$c['legacy_id']] = $c;
    }

    // ── Hàm xác định hạng thi từ basePrice ──
    // 15M → A (VLOS), 25M → B (BVLOS)
    $getRankGroup = function($courseId, $courseName) use ($courseById, $courseByLegacy, $courses) {
        // 0. Ưu tiên suy từ basePrice qua course lookup
        $bp = 0;
        if ($courseId && isset($courseById[$courseId])) {
            $bp = (int)($courseById[$courseId]['price'] ?? 0);
        } elseif ($courseId && isset($courseByLegacy[$courseId])) {
            $bp = (int)($courseByLegacy[$courseId]['price'] ?? 0);
        }
        if ($bp <= 0) {
            // Fallback: tìm course theo name
            foreach ($courses as $c) {
                if (($c['id'] ?? '') === $courseId) { $bp = (int)($c['price'] ?? 0); break; }
            }
        }
        // Nếu có basePrice: 15M → A, 25M → B
        if ($bp === 15000000) return 'VLOS (Hạng A)';
        if ($bp === 25000000) return 'BVLOS (Hạng B)';

        // 1. Match by name
        $cn = mb_strtolower($courseName ?? '');
        if (strpos($cn, 'bvlos') !== false || strpos($cn, 'hạng b') !== false) return 'BVLOS (Hạng B)';
        if (strpos($cn, 'vlos') !== false || strpos($cn, 'hạng a') !== false) return 'VLOS (Hạng A)';

        return 'Chưa xác định';
    };

    // ── Hàm kiểm tra invoice có phải miễn phí (test/Staff) hay không ──
    $isFreeStudent = function($inv) use ($userById) {
        $fp = (int)($inv['finalPrice'] ?? 0);
        $bp = (int)($inv['basePrice'] ?? 0);
        $aid = $inv['agencyId'] ?? '';
        $status = $inv['status'] ?? '';
        // Miễn phí nếu status=exempt (đánh dấu chính thức)
        if ($status === 'exempt') return true;
        // Hoặc KHÔNG có đại lý + finalPrice = 0 + basePrice > 0 (test account)
        if (empty($aid) && $fp <= 0 && $bp > 0) return true;
        return false;
    };

    // invoices.json is the single source of truth after migration.
    // Only fallback to legacy if invoices.json is empty.
    if (empty($invoices)) {
        $legacyTuitions = tsLoad('tuitions');
        $courseMap = [];
        foreach ($courses as $c) { $courseMap[$c['id'] ?? ''] = $c; }

        foreach ($legacyTuitions as $t) {
            $sid = $t['studentId'] ?? '';
            $cid = $t['courseId'] ?? '';
            $baseP = (int)($t['baseAmount'] ?? ($courseMap[$cid]['price'] ?? 0));
            $actualAmount = (int)($t['amount'] ?? $baseP);
            if ($actualAmount === 0 && $baseP > 0) {
                $finalP = 0;
                $discP = 100;
                $discA = $baseP;
            } else {
                $discP = (float)($t['discountPercent'] ?? 0);
                $discA = $baseP - $actualAmount;
                $finalP = $actualAmount > 0 ? $actualAmount : $baseP;
            }
            $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
            if (($t['status'] ?? '') === 'paid') $paid = max($paid, $baseP);

            $invoices[] = [
                'studentId' => $sid, 'courseId' => $cid,
                'courseName' => $t['courseName'] ?? ($courseMap[$cid]['name'] ?? ''),
                'basePrice' => $baseP, 'finalPrice' => $finalP,
                'totalPaid' => $paid, 'remainingDue' => max(0, $baseP - $paid),
                'status' => $paid >= $baseP ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
                'agencyId' => $t['agencyId'] ?? '',
                'agencyName' => $t['agencyId'] ? 'AGCOM' : '',
                'agencyDiscountPercent' => $discP,
                'agencyDiscountAmount' => $discA,
            ];
        }
    }

    $totalReceived = 0;
    $totalDue = 0;
    $totalBasePrice = 0;
    $totalStudents = 0;
    $activatedCount = 0;
    $freeStudentCount = 0;
    $exemptCount = 0;
    $seenStudents = [];
    $byRankGroup = [];     // Gom theo hạng thi
    $byAgency = [];

    foreach ($invoices as &$inv) {
        // Đếm exempt
        if (($inv['status'] ?? '') === 'exempt') {
            $exemptCount++;
            continue; // exempt không tính vào doanh thu
        }

        // LUÔN lookup discount từ agency cho báo cáo (không dùng giá trị lưu cứng)
        if (!empty($inv['agencyId'])) {
            tsEnrichWithAgencyDiscount($inv);
        }
        $sid = $inv['studentId'] ?? '';
        $paid = (int)($inv['totalPaid'] ?? 0);
        $due = (int)($inv['remainingDue'] ?? 0);
        $bp = (int)($inv['basePrice'] ?? 0);
        $fp = (int)($inv['finalPrice'] ?? 0);
        $aid = $inv['agencyId'] ?? '';

        $totalReceived += $paid;
        $totalDue += $due;
        $totalBasePrice += $bp;

        // Đếm học viên unique
        if (!isset($seenStudents[$sid])) {
            $seenStudents[$sid] = true;
            $totalStudents++;
            foreach ($users as $u) {
                if ($u['id'] === $sid && ($u['status'] ?? '') === 'ACTIVE') { $activatedCount++; break; }
            }
        }

        // Đếm học viên miễn phí (exempt hoặc không agency + finalPrice=0)
        if ($isFreeStudent($inv)) {
            $freeStudentCount++;
        }

        // Gom theo hạng thi
        $rankGroup = $getRankGroup($inv['courseId'] ?? '', $inv['courseName'] ?? '');
        if (!isset($byRankGroup[$rankGroup])) {
            $byRankGroup[$rankGroup] = [
                'name' => $rankGroup,
                'students' => 0,
                'invoices' => 0,
                'received' => 0,
                'due' => 0,
                'basePrice' => 0,
                'freeCount' => 0,
                'paidStudentCount' => 0,      // HV đã đóng đủ
                'partialStudentCount' => 0,   // HV đóng 1 phần
                'unpaidStudentCount' => 0,    // HV chưa đóng
                'classCount' => 0,            // Số lớp thuộc hạng này
            ];
        }
        $byRankGroup[$rankGroup]['received'] += $paid;
        $byRankGroup[$rankGroup]['due'] += $due;
        $byRankGroup[$rankGroup]['basePrice'] += $bp;
        $byRankGroup[$rankGroup]['invoices']++;
        // Đếm trạng thái thanh toán
        $invStatus = $inv['status'] ?? 'pending';
        if ($invStatus === 'exempt') {
            $byRankGroup[$rankGroup]['exemptCount'] = ($byRankGroup[$rankGroup]['exemptCount'] ?? 0) + 1;
        } elseif ($invStatus === 'paid') {
            $byRankGroup[$rankGroup]['paidStudentCount']++;
        } elseif ($invStatus === 'partial') {
            $byRankGroup[$rankGroup]['partialStudentCount']++;
        } else {
            $byRankGroup[$rankGroup]['unpaidStudentCount']++;
        }
        if ($isFreeStudent($inv)) {
            $byRankGroup[$rankGroup]['freeCount']++;
        }

        // Agency stats (chỉ đại lý thực: CK > 0 và < 100%)
        $agencyName = $inv['agencyName'] ?? '';
        $discP = (float)($inv['agencyDiscountPercent'] ?? 0);
        if ($agencyName && $discP > 0 && $discP < 100) {
            if (!isset($byAgency[$agencyName])) {
                $byAgency[$agencyName] = ['name' => $agencyName, 'students' => 0, 'invoices' => 0, 'received' => 0, 'due' => 0, 'discountTotal' => 0];
            }
            $byAgency[$agencyName]['received'] += $paid;
            $byAgency[$agencyName]['due'] += $due;
            $byAgency[$agencyName]['discountTotal'] += (int)($inv['agencyDiscountAmount'] ?? 0);
            $byAgency[$agencyName]['invoices']++;

            // Đếm unique students per agency (gộp vào đây để tránh foreach reference bug)
            if (!isset($agencyStudents[$agencyName])) $agencyStudents[$agencyName] = [];
            $agencyStudents[$agencyName][$sid] = true;        }
    }

    // Đếm students per rank group (unique)
    $rankStudents = [];
    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        $rankGroup = $getRankGroup($inv['courseId'] ?? '', $inv['courseName'] ?? '');
        if (!isset($rankStudents[$rankGroup])) $rankStudents[$rankGroup] = [];
        $rankStudents[$rankGroup][$sid] = true;
    }
    foreach ($byRankGroup as $gn => &$rg) {
        $rg['students'] = isset($rankStudents[$gn]) ? count($rankStudents[$gn]) : $rg['invoices'];
    }
    unset($rg);

    // ── ĐẾM SỐ LỚP THEO HẠNG THI ──
    $classes = tsLoad('classes');
    foreach ($byRankGroup as $gn => &$rg) {
        $classCount = 0;
        foreach ($classes as $cl) {
            $courseId = $cl['course_id'] ?? '';
            $courseObj = $courseId ? ($courseById[$courseId] ?? $courseByLegacy[$courseId] ?? null) : null;
            if ($courseObj) {
                $clGroup = $getRankGroup($courseObj['id'] ?? '', $courseObj['name'] ?? '');
            } else {
                $clName = mb_strtolower($cl['name'] ?? '');
                if (strpos($clName, 'bvlos') !== false || strpos($clName, 'b') !== false) $clGroup = 'BVLOS (Hạng B)';
                elseif (strpos($clName, 'vlos') !== false || strpos($clName, 'a') !== false) $clGroup = 'VLOS (Hạng A)';
                else $clGroup = 'Chưa xác định';
            }
            if ($clGroup === $gn) $classCount++;
        }
        $rg['classCount'] = $classCount;
    }
    unset($rg);

    // FIX: unset reference sau foreach với & để tránh corrupt phần tử cuối mảng
    unset($inv);

    // Đếm students per agency (unique) — ĐÃ CHUYỂN VÀO VÒNG LẶP CHÍNH
    // $agencyStudents đã được tính trong vòng lặp chính ở trên, không cần vòng lặp thứ 2
    foreach ($byAgency as $an => &$ba) {
        $ba['students'] = isset($agencyStudents[$an]) ? count($agencyStudents[$an]) : $ba['invoices'];
    }
    unset($ba);

    $today = date('Y-m-d');
    $todayTxns = array_filter($transactions, function($txn) use ($today) {
        return strpos($txn['createdAt'] ?? '', $today) === 0 && ($txn['status'] ?? '') === 'confirmed';
    });
    $todayAmount = array_sum(array_map(fn($txn) => (int)($txn['amount'] ?? 0), $todayTxns));

    // Commission = only real agency (0% < discount < 100%)
    $totalCommission = 0;
    foreach ($invoices as $inv) {
        if (($inv['agencyDiscountPercent'] ?? 0) > 0 && ($inv['agencyDiscountPercent'] ?? 0) < 100) {
            $totalCommission += (int)($inv['agencyDiscountAmount'] ?? 0);
        }
    }

    // Tổng đã thu THỰC = totalReceived - totalCommission (trừ phần CK đại lý giữ lại)
    $totalActualReceived = $totalReceived - $totalCommission;
    $collectionRate = $totalBasePrice > 0 ? round($totalActualReceived / $totalBasePrice * 100, 1) : 0;

    tsJson([
        'success' => true,
        'data' => [
            'total_invoices' => count($invoices),
            'total_received' => $totalReceived,
            'total_received_fmt' => number_format($totalReceived) . ' ₫',
            'total_actual_received' => $totalActualReceived,
            'total_actual_received_fmt' => number_format($totalActualReceived) . ' ₫',
            'total_due' => $totalDue,
            'total_due_fmt' => number_format($totalDue) . ' ₫',
            'total_base_price' => $totalBasePrice,
            'total_base_price_fmt' => number_format($totalBasePrice) . ' ₫',
            'total_students' => $totalStudents,
            'activated_count' => $activatedCount,
            'free_student_count' => $freeStudentCount,
            'exempt_count' => $exemptCount,
            'today_amount' => $todayAmount,
            'today_amount_fmt' => number_format($todayAmount) . ' ₫',
            'today_transactions' => count($todayTxns),
            'total_commission' => $totalCommission,
            'total_commission_fmt' => number_format($totalCommission) . ' ₫',
            'agency_count' => count($byAgency),
            'collection_rate' => $collectionRate,
            'by_course' => array_values($byRankGroup),   // Gom theo hạng thi
            'by_agency' => array_values($byAgency),
        ],
    ]);
}

// =====================================================================
// ACTION: list-transactions// =====================================================================
// ACTION: list-transactions
// Lấy danh sách transactions (có filter)
// GET ?invoiceId=&status=&studentId=&limit=&offset=
// =====================================================================
if ($tsAction === 'list-transactions') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);

    $invoiceId = $_GET['invoiceId'] ?? '';
    $fStatus = $_GET['status'] ?? '';
    $studentId = $_GET['studentId'] ?? '';
    $limit = (int)($_GET['limit'] ?? 50);
    $offset = (int)($_GET['offset'] ?? 0);

    $transactions = tsLoad('transactions');

    if ($invoiceId) {
        $transactions = array_values(array_filter($transactions, fn($t) => $t['invoiceId'] === $invoiceId));
    }
    if ($fStatus) {
        $transactions = array_values(array_filter($transactions, fn($t) => $t['status'] === $fStatus));
    }
    if ($studentId) {
        $transactions = array_values(array_filter($transactions, fn($t) => $t['studentId'] === $studentId));
    }

    // Sort newest first
    usort($transactions, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

    // Also include legacy payment history items
    if (!$invoiceId || strpos($invoiceId, 'legacy') === 0) {
        $legacyTuitions = tsLoad('tuitions');
        foreach ($legacyTuitions as $t) {
            $sid = $t['studentId'] ?? '';
            if ($studentId && $sid !== $studentId) continue;
            if ($invoiceId && ($t['id'] ?? '') !== $invoiceId && ('legacy-' . $sid) !== $invoiceId) continue;

            foreach ($t['paymentHistory'] ?? [] as $h) {
                $status = $fStatus;
                $txnStatus = 'confirmed';
                if ($status && $txnStatus !== $status) continue;

                $transactions[] = [
                    'id' => 'txn-legacy-' . bin2hex(random_bytes(4)),
                    'invoiceId' => $t['id'] ?? ('legacy-' . $sid),
                    'studentId' => $sid,
                    'amount' => (int)($h['amount'] ?? 0),
                    'method' => $h['method'] ?? '',
                    'submittedBy' => $h['recorded_by'] ?? '',
                    'confirmedBy' => $h['confirmedBy'] ?? ($h['recorded_by'] ?? ''),
                    'status' => 'confirmed',
                    'note' => $h['note'] ?? '',
                    'createdAt' => $h['date'] ?? '',
                    'confirmedAt' => $h['date'] ?? '',
                ];
            }
        }
    }

    // Sort again after merge
    usort($transactions, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

    // Enrich với agency info từ invoices
    $allInvoices = tsLoad('invoices');
    $invoiceMap = [];
    foreach ($allInvoices as $inv) {
        $invoiceMap[$inv['id']] = $inv;
    }
    foreach ($transactions as &$txn) {
        $inv = $invoiceMap[$txn['invoiceId']] ?? null;
        $txn['agencyId'] = $inv['agencyId'] ?? '';
        $txn['agencyName'] = $inv['agencyName'] ?? '';
    }
    unset($txn);

    $total = count($transactions);
    $page = array_slice($transactions, $offset, $limit);

    tsJson([
        'success' => true,
        'data' => $page,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset,
    ]);
}

// =====================================================================
// ACTION: freeze-invoice / unfreeze-invoice
// Đóng băng / mở băng hóa đơn (tạm khóa học viên)
// POST Body: { invoiceId* }
// =====================================================================
if ($tsAction === 'freeze-invoice' || $tsAction === 'unfreeze-invoice') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $invoiceId = $input['invoiceId'] ?? '';
    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);

    $invoices = tsLoad('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === $invoiceId) { $invIdx = $i; break; }
    }
    if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    $isFreeze = ($tsAction === 'freeze-invoice');
    $invoices[$invIdx]['status'] = $isFreeze ? 'frozen' : (($invoices[$invIdx]['totalPaid'] ?? 0) >= ($invoices[$invIdx]['basePrice'] ?? 0) ? 'paid' : 'partial');
    $invoices[$invIdx]['updatedAt'] = date('c');
    $invoice = $invoices[$invIdx];
    tsSave('invoices', $invoices);

    // Sync user status
    $users = tsLoad('users');
    foreach ($users as &$u) {
        if ($u['id'] === $invoice['studentId']) {
            $u['status'] = $isFreeze ? 'FROZEN' : 'ACTIVE';
            if ($isFreeze) {
                $u['frozenAt'] = date('c');
                $u['frozenBy'] = $auth['id'];
            } else {
                $u['activatedAt'] = date('c');
                $u['activatedBy'] = $auth['id'];
            }
            break;
        }
    }
    unset($u);
    tsSave('users', $users);

    // Sync enrollment
    $enrollments = tsLoad('enrollments');
    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $invoice['studentId']) {
            $enr['status'] = $isFreeze ? 'frozen' : 'active';
            break;
        }
    }
    unset($enr);
    tsSave('enrollments', $enrollments);

    tsJson([
        'success' => true,
        'message' => $isFreeze ? 'Đã tạm khóa hóa đơn và tài khoản học viên.' : 'Đã mở khóa hóa đơn và tài khoản học viên.',
        'data' => $invoice,
    ]);
}

// =====================================================================
// ACTION: delete-invoice
// Admin xóa hóa đơn (kèm transactions)
// DELETE/POST Body: { invoiceId* }
// =====================================================================
if ($tsAction === 'delete-invoice') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST' && $tsMethod !== 'DELETE') tsJson(['error' => 'POST/DELETE required'], 405);

    $input = $tsMethod === 'POST' ? tsInput() : [];
    $invoiceId = $input['invoiceId'] ?? ($_GET['invoiceId'] ?? '');
    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);

    // Delete invoice
    $invoices = tsLoad('invoices');
    $before = count($invoices);
    $invoices = array_values(array_filter($invoices, fn($inv) => $inv['id'] !== $invoiceId));
    if (count($invoices) === $before) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);
    tsSave('invoices', $invoices);

    // Delete related transactions
    $transactions = tsLoad('transactions');
    $transactions = array_values(array_filter($transactions, fn($t) => $t['invoiceId'] !== $invoiceId));
    tsSave('transactions', $transactions);

    // Delete related commission
    $commissions = tsLoad('agency_commissions');
    $commissions = array_values(array_filter($commissions, fn($c) => $c['invoiceId'] !== $invoiceId));
    tsSave('agency_commissions', $commissions);

    tsJson(['success' => true, 'message' => 'Đã xóa hóa đơn và các giao dịch liên quan.']);
}

// =====================================================================
// ACTION: delete-transaction
// Admin xóa 1 transaction (dùng để sửa dữ liệu sai)
// POST Body: { transactionId* }
// =====================================================================
if ($tsAction === 'delete-transaction') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $transactionId = $input['transactionId'] ?? ($_GET['transactionId'] ?? '');
    if (!$transactionId) tsJson(['error' => 'Thiếu transactionId'], 400);

    $transactions = tsLoad('transactions');
    $before = count($transactions);
    $deletedTxn = null;
    $transactions = array_values(array_filter($transactions, function($t) use ($transactionId, &$deletedTxn) {
        if ($t['id'] === $transactionId) { $deletedTxn = $t; return false; }
        return true;
    }));
    if (count($transactions) === $before) tsJson(['error' => 'Không tìm thấy giao dịch'], 404);
    tsSave('transactions', $transactions);

    // Recalc invoice nếu có invoiceId trong transaction
    if ($deletedTxn && !empty($deletedTxn['invoiceId'])) {
        $invoiceId = $deletedTxn['invoiceId'];
        $invoices = tsLoad('invoices');
        foreach ($invoices as &$inv) {
            if ($inv['id'] === $invoiceId) {
                // Tính lại totalPaid từ các transaction còn lại
                $newTotalPaid = 0;
                foreach ($transactions as $txn) {
                    if (($txn['invoiceId'] ?? '') === $invoiceId && ($txn['status'] ?? '') === 'confirmed') {
                        $newTotalPaid += (int)($txn['amount'] ?? 0);
                    }
                }
                $inv['totalPaid'] = $newTotalPaid;
                $bp = (int)($inv['basePrice'] ?? 0);
                $inv['remainingDue'] = max(0, $bp - $newTotalPaid);
                $inv['status'] = $newTotalPaid >= $bp ? 'paid' : ($newTotalPaid > 0 ? 'partial' : 'pending');
                $inv['updatedAt'] = date('c');
                break;
            }
        }
        unset($inv);
        tsSave('invoices', $invoices);
    }

    tsJson(['success' => true, 'message' => 'Đã xóa giao dịch.', 'deleted' => $deletedTxn]);
}

// =====================================================================
// ACTION: update-invoice
// Cập nhật thông tin hóa đơn (giá, ghi chú)
// POST Body: { invoiceId*, basePrice?, finalPrice?, note?, agencyId? }
// =====================================================================
if ($tsAction === 'update-invoice') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $invoiceId = $input['invoiceId'] ?? '';
    if (!$invoiceId) tsJson(['error' => 'Thiếu invoiceId'], 400);

    $invoices = tsLoad('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === $invoiceId) { $invIdx = $i; break; }
    }
    if ($invIdx === null) tsJson(['error' => 'Không tìm thấy hóa đơn'], 404);

    $now = date('c');

    if (isset($input['basePrice'])) {
        $newBase = (int)$input['basePrice'];
        $invoices[$invIdx]['basePrice'] = $newBase;

        // Recalculate discount — LUÔN lookup từ agency (không dùng giá trị cũ)
        if (!empty($invoices[$invIdx]['agencyId'])) {
            $agInfo = tsGetAgencyDiscount($invoices[$invIdx]['agencyId']);
            $disc = tsCalcDiscount($newBase, $agInfo['percent']);
            $invoices[$invIdx]['agencyDiscountPercent'] = $disc['percent'];
            $invoices[$invIdx]['agencyDiscountAmount'] = $disc['amount'];
            $invoices[$invIdx]['finalPrice'] = $disc['finalPrice'];
            $invoices[$invIdx]['agencyName'] = $agInfo['agencyName'];
        } else {
            $invoices[$invIdx]['finalPrice'] = $newBase;
        }
        $invoices[$invIdx]['remainingDue'] = max(0, $newBase - (int)($invoices[$invIdx]['totalPaid'] ?? 0));
    }

    // Cho phép set trực tiếp totalPaid (dùng để sửa dữ liệu sai)
    if (isset($input['totalPaid'])) {
        $invoices[$invIdx]['totalPaid'] = (int)$input['totalPaid'];
        $invoices[$invIdx]['remainingDue'] = max(0, (int)($invoices[$invIdx]['basePrice'] ?? 0) - (int)$input['totalPaid']);
    }

    if (isset($input['finalPrice'])) {
        $invoices[$invIdx]['finalPrice'] = (int)$input['finalPrice'];
        $invoices[$invIdx]['remainingDue'] = max(0, (int)$input['basePrice'] - (int)($invoices[$invIdx]['totalPaid'] ?? 0));
    }

    if (isset($input['note'])) {
        $invoices[$invIdx]['note'] = $input['note'];
    }

    if (isset($input['agencyId'])) {
        $invoices[$invIdx]['agencyId'] = $input['agencyId'];
        // LUÔN lookup discount từ agency (không dùng giá trị cũ)
        $agInfo = tsGetAgencyDiscount($input['agencyId']);
        $newDiscP = $agInfo['percent'];
        $invoices[$invIdx]['agencyName'] = $agInfo['agencyName'];
        $invoices[$invIdx]['agencyDiscountPercent'] = $newDiscP;
        $disc = tsCalcDiscount((int)$invoices[$invIdx]['basePrice'], $newDiscP);
        $invoices[$invIdx]['agencyDiscountAmount'] = $disc['amount'];
        $invoices[$invIdx]['finalPrice'] = $disc['finalPrice'];
        // remainingDue = basePrice - totalPaid (học viên nộp theo giá gốc, không phải giá sau CK)
        $invoices[$invIdx]['remainingDue'] = max(0, (int)($invoices[$invIdx]['basePrice'] ?? 0) - (int)($invoices[$invIdx]['totalPaid'] ?? 0));
    }

    // Update status — tính theo basePrice
    $totalPaid = (int)$invoices[$invIdx]['totalPaid'];
    $basePrice = (int)($invoices[$invIdx]['basePrice'] ?? 0);
    $finalPrice = (int)($invoices[$invIdx]['finalPrice'] ?? 0);
    $hasAgency = !empty($invoices[$invIdx]['agencyId']);

    if ($hasAgency && $finalPrice <= 0 && $basePrice > 0) {
        tsJson(['error' => 'Không được để học phí thực thu = 0đ cho đại lý. Vui lòng giảm chiết khấu hoặc gỡ đại lý khỏi hóa đơn.'], 400);
    }

    $invoices[$invIdx]['status'] = $totalPaid >= $basePrice ? 'paid' : ($totalPaid > 0 ? 'partial' : 'pending');
    $invoices[$invIdx]['updatedAt'] = $now;

    tsSave('invoices', $invoices);
    $invoice = $invoices[$invIdx];

    // Sync commission
    if ($invoice['agencyId']) {
        $agInfo = tsGetAgencyDiscount($invoice['agencyId']);
        $disc = tsCalcDiscount($basePrice, $agInfo['percent']);
        tsSyncAgencyCommission($invoice, ['id' => $invoice['agencyId'], 'name' => $agInfo['agencyName'], 'discountPercent' => $disc['percent']]);
    }

    tsJson(['success' => true, 'message' => 'Đã cập nhật hóa đơn.', 'data' => $invoice]);
}

// =====================================================================
// ACTION: migrate-legacy
// Chạy migration tự động: tuitions cũ → invoices + transactions mới
// POST (Admin only)
// =====================================================================
if ($tsAction === 'migrate-legacy') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $legacyTuitions = tsLoad('tuitions');
    $invoices = tsLoad('invoices');
    $transactions = tsLoad('transactions');
    $courses = tsLoad('courses');
    $courseMap = [];
    foreach ($courses as $c) { $courseMap[$c['id'] ?? ''] = $c; }

    $migrated = 0;
    $skipped = 0;

    // Build existing map
    $existingKeys = [];
    foreach ($invoices as $inv) {
        $existingKeys[$inv['studentId'] . '_' . $inv['courseId']] = true;
    }

    foreach ($legacyTuitions as $t) {
        $sid = $t['studentId'] ?? '';
        $cid = $t['courseId'] ?? '';

        if (isset($existingKeys[$sid . '_' . $cid])) {
            $skipped++;
            continue;
        }

        $course = $courseMap[$cid] ?? null;
        // baseAmount = học phí gốc, amount = học phí thực thu (sau chiết khấu hoặc =0 nếu miễn phí)
        $baseP = (int)($t['baseAmount'] ?? ($course['price'] ?? 0));
        // Nếu baseAmount không có sẵn trong tuition, dùng course.price
        if ($baseP <= 0) $baseP = (int)($course['price'] ?? 25000000);
        $actualAmount = (int)($t['amount'] ?? $baseP);
        $discP = (float)($t['discountPercent'] ?? 0);

        // Nếu amount = 0 nhưng base > 0 → miễn phí (100% discount)
        if ($actualAmount === 0 && $baseP > 0) {
            $discP = 100;
            $finalP = 0;
            $discA = $baseP;
        } else {
            $discA = $discP > 0 ? ($baseP - $actualAmount) : 0;
            // Nếu discount_amount không được lưu, tính lại từ percent
            if ($discP > 0 && $discA <= 0) {
                $discA = (int)($baseP * $discP / 100);
            }
            $finalP = $actualAmount > 0 ? $actualAmount : $baseP;
        }
        $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
        if (($t['status'] ?? '') === 'paid') $paid = max($paid, $baseP);

        $invoiceId = 'inv-' . bin2hex(random_bytes(8));
        $now = date('c');

        $invoices[] = [
            'id' => $invoiceId,
            'studentId' => $sid,
            'studentName' => $t['studentName'] ?? '',
            'courseId' => $cid,
            'courseName' => $t['courseName'] ?? ($course['name'] ?? ''),
            'basePrice' => $baseP,
            'agencyId' => $t['agencyId'] ?? '',
            'agencyName' => $t['agency_name'] ?? ($t['agencyId'] ? 'AGCOM' : ''),
            'agencyDiscountPercent' => $finalP === 0 && $baseP > 0 ? 100 : $discP,
            'agencyDiscountAmount' => $finalP === 0 && $baseP > 0 ? $baseP : $discA,
            'finalPrice' => $finalP,
            'totalPaid' => $paid,
            'remainingDue' => max(0, $finalPrice - $paid),   // v5: legacy migration dùng finalPrice
            'status' => $paid >= $finalPrice ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
            'note' => $t['note'] ?? '',
            'createdBy' => $t['confirmedBy'] ?? '',
            'createdAt' => $t['createdAt'] ?? $now,
            'updatedAt' => $t['updatedAt'] ?? $now,
        ];

        // Migrate paymentHistory → transactions
        foreach ($t['paymentHistory'] ?? [] as $h) {
            $transactions[] = [
                'id' => 'txn-' . bin2hex(random_bytes(8)),
                'invoiceId' => $invoiceId,
                'studentId' => $sid,
                'amount' => (int)($h['amount'] ?? 0),
                'method' => $h['method'] ?? '',
                'receiptImage' => $h['receipt'] ?? null,
                'submittedBy' => $h['recorded_by'] ?? '',
                'confirmedBy' => $h['confirmedBy'] ?? ($h['recorded_by'] ?? ''),
                'status' => 'confirmed',
                'note' => $h['note'] ?? '',
                'createdAt' => $h['date'] ?? $now,
                'confirmedAt' => $h['date'] ?? $now,
            ];
        }

        $migrated++;
    }

    tsSave('invoices', $invoices);
    tsSave('transactions', $transactions);

    tsJson([
        'success' => true,
        'message' => "Migration hoàn tất! Đã chuyển {$migrated} hóa đơn, bỏ qua {$skipped} hóa đơn đã tồn tại.",
        'migrated' => $migrated,
        'skipped' => $skipped,
        'totalInvoices' => count($invoices),
        'totalTransactions' => count($transactions),
    ]);
}

// =====================================================================
// ACTION: sync-all
// Admin: Đồng bộ toàn bộ invoice ↔ enrollment ↔ user.status
// POST (idempotent — chạy được nhiều lần)
// =====================================================================
if ($tsAction === 'sync-all') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $invoices = tsLoad('invoices');
    $enrollments = tsLoad('enrollments');
    $users = tsLoad('users');
    $now = date('c');
    $results = ['synced' => 0, 'enrollments_updated' => 0, 'enrollments_created' => 0, 'users_activated' => 0];

    // Build quick lookup
    $userById = [];
    foreach ($users as $u) { $userById[$u['id']] = $u; }

    // Build invoice index by studentId
    $invoiceByStudent = [];
    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        // If multiple invoices for same student, keep the most recently updated one
        if (!isset($invoiceByStudent[$sid]) || strcmp($inv['updatedAt'] ?? '', $invoiceByStudent[$sid]['updatedAt'] ?? '') > 0) {
            $invoiceByStudent[$sid] = $inv;
        }
    }

    // Sync enrollment from invoices
    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        if (!$sid) continue;

        $basePrice = (int)($inv['basePrice'] ?? 0);
        $totalPaid = (int)($inv['totalPaid'] ?? 0);
        // FIX: Dùng basePrice (giá gốc) làm mốc, đồng bộ với record-payment và confirm-receipt
        $isPaid = $totalPaid >= $basePrice || ($inv['status'] === 'paid');
        if ($isPaid) $totalPaid = max($totalPaid, $basePrice);
        $paymentStatus = $isPaid ? 'paid' : ($totalPaid > 0 ? 'partial' : 'unpaid');

        // Find or create enrollment
        $found = false;
        foreach ($enrollments as &$enr) {
            if (($enr['student_id'] ?? '') === $sid) {
                $found = true;
                $enr['payment'] = [
                    'amount' => $basePrice,   // FIX: Dùng basePrice, không dùng finalPrice
                    'paid' => $totalPaid,
                    'status' => $paymentStatus,
                    'method' => $inv['paymentMethod'] ?? ($enr['payment']['method'] ?? ''),
                    'date' => $inv['paidDate'] ?? $now,
                    'confirmed_by' => $auth['id'],
                ];
                if (empty($enr['course_id']) || $enr['course_id'] === 'None') {
                    $enr['course_id'] = $inv['courseId'] ?? '';
                    $enr['course_name'] = $inv['courseName'] ?? '';
                }
                $enr['status'] = ($inv['status'] === 'frozen') ? 'frozen' : 'active';
                $results['enrollments_updated']++;
                break;
            }
        }
        unset($enr);

        if (!$found) {
            $enrollments[] = [
                'student_id' => $sid,
                'class_id' => '',
                'course_id' => $inv['courseId'] ?? '',
                'course_name' => $inv['courseName'] ?? '',
                'documents' => [
                    'id_card' => ['status' => 'pending', 'url' => ''],
                    'health_cert' => ['status' => 'pending', 'url' => ''],
                    'education' => ['status' => 'pending', 'url' => ''],
                ],
                'payment' => [
                    'amount' => $basePrice,   // FIX: Dùng basePrice
                    'paid' => $totalPaid,
                    'status' => $paymentStatus,
                    'method' => $inv['paymentMethod'] ?? '',
                    'date' => $inv['paidDate'] ?? $now,
                    'confirmed_by' => $auth['id'],
                ],
                'status' => 'active',
                'confirmed_by' => $auth['id'],
                'confirmed_at' => $now,
                'stages' => [
                    'enrollment' => ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $auth['id']],
                    'theory' => ['status' => 'pending'],
                    'practice' => ['status' => 'pending'],
                    'exam' => ['status' => 'pending'],
                    'certification' => ['status' => 'pending'],
                ],
            ];
            $results['enrollments_created']++;
        }

        $results['synced']++;
    }

    // Sync user status from invoice status
    foreach ($users as &$u) {
        $sid = $u['id'];
        if (($u['role'] ?? '') !== 'STUDENT') continue;
        if (!isset($invoiceByStudent[$sid])) continue;

        $inv = $invoiceByStudent[$sid];
        $shouldBeActive = !in_array($inv['status'], ['frozen', 'cancelled', 'pending']);
        $isActive = ($u['status'] ?? '') === 'ACTIVE';

        if ($shouldBeActive && !$isActive) {
            $u['status'] = 'ACTIVE';
            $u['activatedBy'] = $auth['id'];
            $u['activatedAt'] = $now;
            $results['users_activated']++;
        } elseif (!$shouldBeActive && $isActive && $inv['status'] === 'frozen') {
            $u['status'] = 'FROZEN';
            $u['frozenAt'] = $now;
            $u['frozenBy'] = $auth['id'];
            $results['users_frozen'] = ($results['users_frozen'] ?? 0) + 1;
        }
    }
    unset($u);

    tsSave('enrollments', $enrollments);
    tsSave('users', $users);

    // ── Sync tuitions.json (legacy compatibility) ──
    // tuitions.json được dùng bởi AdminStudents (cột "Học phí") và StaffPayments
    // Lấy nguồn từ invoices vì invoices là nguồn dữ liệu chính xác nhất (v3)
    $tuitions = tsLoad('tuitions');
    $tuitionsUpdated = 0;
    $tuitionsCreated = 0;

    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        if (!$sid) continue;

        $basePrice = (int)($inv['basePrice'] ?? 0);
        $totalPaid = (int)($inv['totalPaid'] ?? 0);
        $isPaid = $totalPaid >= $basePrice || ($inv['status'] === 'paid');
        if ($isPaid) $totalPaid = max($totalPaid, $basePrice);
        $paymentStatus = $isPaid ? 'paid' : ($totalPaid > 0 ? 'partial' : 'unpaid');
        $step = $isPaid ? 'paid' : ($totalPaid > 0 ? 'partial' : 'pending');

        // Calculate actual amount (after agency discount) for backward compatibility
        $actualAmount = $basePrice;
        if (!empty($inv['agencyId']) && ($inv['agencyDiscountPercent'] ?? 0) > 0 && ($inv['agencyDiscountPercent'] ?? 0) < 100) {
            $actualAmount = (int)($inv['finalPrice'] ?? $basePrice);
        }

        // Find existing tuition
        $found = false;
        foreach ($tuitions as &$t) {
            if (($t['studentId'] ?? '') === $sid) {
                $found = true;
                $t['amount'] = $actualAmount;
                $t['baseAmount'] = $basePrice;
                $t['partialAmount'] = $totalPaid;
                $t['paymentAmount'] = $totalPaid;
                $t['status'] = $paymentStatus;
                $t['step'] = $step;
                $t['paymentMethod'] = $inv['paymentMethod'] ?? ($t['paymentMethod'] ?? '');
                $t['paidDate'] = $inv['paidDate'] ?? $now;
                $t['confirmedBy'] = $auth['id'];
                $t['updatedAt'] = $now;
                if (!empty($inv['courseId'])) {
                    $t['courseId'] = $inv['courseId'];
                    $t['courseName'] = $inv['courseName'] ?? ($t['courseName'] ?? '');
                }
                if (!empty($inv['agencyId'])) {
                    $t['agencyId'] = $inv['agencyId'];
                    $t['discountPercent'] = $inv['agencyDiscountPercent'] ?? 0;
                }
                // Sync paymentHistory nếu có transaction gần nhất
                if (!empty($inv['lastTransaction'])) {
                    $lt = $inv['lastTransaction'];
                    $t['paymentHistory'] = [[
                        'date' => $lt['createdAt'] ?? $now,
                        'amount' => (int)($lt['amount'] ?? 0),
                        'method' => $lt['method'] ?? '',
                        'note' => $lt['note'] ?? '',
                        'confirmedBy' => $lt['confirmedBy'] ?? $auth['id'],
                    ]];
                }
                $tuitionsUpdated++;
                break;
            }
        }
        unset($t);

        if (!$found) {
            // Get student info
            $student = null;
            foreach ($users as $u) {
                if ($u['id'] === $sid) { $student = $u; break; }
            }
            $tuitions[] = [
                'id' => 'tuition-' . bin2hex(random_bytes(6)),
                'studentId' => $sid,
                'studentName' => $student['fullName'] ?? $inv['studentName'] ?? '',
                'courseId' => $inv['courseId'] ?? '',
                'courseName' => $inv['courseName'] ?? '',
                'amount' => $actualAmount,
                'baseAmount' => $basePrice,
                'partialAmount' => $totalPaid,
                'paymentAmount' => $totalPaid,
                'step' => $step,
                'status' => $paymentStatus,
                'paymentMethod' => $inv['paymentMethod'] ?? '',
                'paidDate' => $inv['paidDate'] ?? $now,
                'confirmedBy' => $auth['id'],
                'createdAt' => $now,
                'updatedAt' => $now,
                'agencyId' => $inv['agencyId'] ?? '',
                'discountPercent' => $inv['agencyDiscountPercent'] ?? 0,
                'paymentHistory' => !empty($inv['lastTransaction']) ? [[
                    'date' => $inv['lastTransaction']['createdAt'] ?? $now,
                    'amount' => (int)($inv['lastTransaction']['amount'] ?? 0),
                    'method' => $inv['lastTransaction']['method'] ?? '',
                    'note' => $inv['lastTransaction']['note'] ?? '',
                    'confirmedBy' => $inv['lastTransaction']['confirmedBy'] ?? $auth['id'],
                ]] : [],
            ];
            $tuitionsCreated++;
        }
    }
    tsSave('tuitions', $tuitions);

    $results['tuitions_updated'] = $tuitionsUpdated;
    $results['tuitions_created'] = $tuitionsCreated;
    // ── End sync tuitions.json ──

    $results['success'] = true;
    $results['total_invoices'] = count($invoices);
    $results['total_users'] = count($userById);
    tsJson($results);
}

// =====================================================================
// ACTION: cleanup-free-agency-invoices
// Admin: Xóa tất cả invoice có finalPrice=0 thuộc đại lý (học viên miễn phí)
// POST (Admin only, cần xác nhận)
// =====================================================================
if ($tsAction === 'cleanup-free-agency-invoices') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $invoices = tsLoad('invoices');
    $transactions = tsLoad('transactions');
    $commissions = tsLoad('agency_commissions');
    $users = tsLoad('users');
    $enrollments = tsLoad('enrollments');

    $toDelete = [];
    $kept = [];
    $deletedUserIds = [];

    foreach ($invoices as $inv) {
        $aid = $inv['agencyId'] ?? '';
        $fp = (int)($inv['finalPrice'] ?? 0);
        $bp = (int)($inv['basePrice'] ?? 0);

        // Chỉ xóa invoice có agency + finalPrice = 0 (miễn phí)
        if (!empty($aid) && $fp <= 0 && $bp > 0) {
            $toDelete[] = $inv['id'];
            $deletedUserIds[] = $inv['studentId'] ?? '';
        } else {
            $kept[] = $inv;
        }
    }

    $count = count($toDelete);
    if ($count === 0) {
        tsJson(['success' => true, 'message' => 'Không tìm thấy học viên miễn phí nào thuộc đại lý.', 'deleted' => 0]);
    }

    // Xóa transactions liên quan đến invoice bị xóa
    $transactions = array_values(array_filter($transactions, fn($t) => !in_array($t['invoiceId'] ?? '', $toDelete)));

    // Xóa commissions liên quan
    $commissions = array_values(array_filter($commissions, fn($c) => !in_array($c['invoiceId'] ?? '', $toDelete)));

    // Gỡ agencyId khỏi học viên có invoice bị xóa
    $userIdSet = array_flip($deletedUserIds);
    foreach ($users as &$u) {
        if (isset($userIdSet[$u['id']])) {
            unset($u['agencyId']);
        }
    }
    unset($u);

    // Xóa enrollments của học viên bị xóa
    $enrollments = array_values(array_filter($enrollments, fn($e) => !isset($userIdSet[$e['student_id'] ?? ''])));

    tsSave('invoices', $kept);
    tsSave('transactions', $transactions);
    tsSave('agency_commissions', $commissions);
    tsSave('users', $users);
    tsSave('enrollments', $enrollments);

    tsJson([
        'success' => true,
        'message' => "Đã xóa {$count} học viên miễn phí thuộc đại lý (invoice, transaction, commission, enrollment).",
        'deleted' => $count,
        'studentIds' => $deletedUserIds,
    ]);
}

// =====================================================================
// ACTION: health
// =====================================================================
if ($tsAction === 'health' || empty($tsAction)) {
    $invoices = tsLoad('invoices');
    $transactions = tsLoad('transactions');
    $commissions = tsLoad('agency_commissions');
    $legacy = tsLoad('tuitions');

    tsJson([
        'status' => 'ok',
        'service' => 'tuition-service v3',
        'invoices' => count($invoices),
        'transactions' => count($transactions),
        'commissions' => count($commissions),
        'legacy_tuitions' => count($legacy),
        'timestamp' => date('c'),
    ]);
}

// =====================================================================
// ACTION: mark-exempt
// Admin đánh dấu học viên miễn phí → set invoice về exempt hoặc tạo mới
// POST Body: { studentId*, courseId? }
// =====================================================================
if ($tsAction === 'mark-exempt') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $studentId = $input['studentId'] ?? '';
    $courseId = $input['courseId'] ?? '';
    if (!$studentId) tsJson(['error' => 'Thiếu studentId'], 400);

    // Verify student exists
    $users = tsLoad('users');
    $student = null;
    foreach ($users as $u) {
        if ($u['id'] === $studentId) { $student = $u; break; }
    }
    if (!$student) tsJson(['error' => 'Không tìm thấy học viên'], 404);

    $invoices = tsLoad('invoices');
    $now = date('c');

    // Find existing invoice for this student
    $found = false;
    foreach ($invoices as &$inv) {
        if ($inv['studentId'] === $studentId && (!$courseId || $inv['courseId'] === $courseId)) {
            $inv['basePrice'] = 0;
            $inv['finalPrice'] = 0;
            $inv['totalPaid'] = 0;
            $inv['remainingDue'] = 0;
            $inv['agencyId'] = '';
            $inv['agencyName'] = '';
            $inv['agencyDiscountPercent'] = 0;
            $inv['agencyDiscountAmount'] = 0;
            $inv['status'] = 'exempt';
            $inv['note'] = ($inv['note'] ?? '') . ' [Đã đánh dấu miễn phí bởi ' . ($auth['email'] ?? $auth['id']) . ']';
            $inv['updatedAt'] = $now;
            $found = true;
            break;
        }
    }
    unset($inv);

    if (!$found) {
        // Tạo invoice exempt mới nếu chưa có
        $invoiceId = 'inv-' . bin2hex(random_bytes(8));
        $invoices[] = [
            'id' => $invoiceId,
            'studentId' => $studentId,
            'studentName' => $student['fullName'] ?? '',
            'studentEmail' => $student['email'] ?? '',
            'studentPhone' => $student['phone'] ?? '',
            'courseId' => $courseId,
            'courseName' => '',
            'basePrice' => 0,
            'agencyId' => '',
            'agencyName' => '',
            'agencyDiscountPercent' => 0,
            'agencyDiscountAmount' => 0,
            'finalPrice' => 0,
            'totalPaid' => 0,
            'remainingDue' => 0,
            'status' => 'exempt',
            'note' => 'Học viên miễn phí — ' . ($auth['email'] ?? $auth['id']),
            'createdBy' => $auth['id'],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
    }

    tsSave('invoices', $invoices);

    // Xóa agency_commissions liên quan
    $commissions = tsLoad('agency_commissions');
    $commissions = array_values(array_filter($commissions, fn($c) => $c['studentId'] !== $studentId));
    tsSave('agency_commissions', $commissions);

    // Xóa transactions liên quan đến invoice cũ
    $transactions = tsLoad('transactions');
    $transactions = array_values(array_filter($transactions, fn($t) => $t['studentId'] !== $studentId));
    tsSave('transactions', $transactions);

    tsJson([
        'success' => true,
        'message' => 'Đã đánh dấu học viên miễn phí. Invoice, transactions, commission đã được dọn sạch.',
        'studentId' => $studentId,
        'studentName' => $student['fullName'] ?? '',
    ]);
}

// =====================================================================
// ACTION: unmark-exempt
// Admin bỏ đánh dấu miễn phí → chuyển invoice về pending, khôi phục học phí
// POST Body: { studentId* }
// =====================================================================
if ($tsAction === 'unmark-exempt') {
    $auth = tsRequireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $input = tsInput();
    $studentId = $input['studentId'] ?? '';
    if (!$studentId) tsJson(['error' => 'Thiếu studentId'], 400);

    $users = tsLoad('users');
    $student = null;
    foreach ($users as $u) {
        if ($u['id'] === $studentId) { $student = $u; break; }
    }
    if (!$student) tsJson(['error' => 'Không tìm thấy học viên'], 404);

    $invoices = tsLoad('invoices');
    $now = date('c');
    $found = false;

    foreach ($invoices as &$inv) {
        if ($inv['studentId'] === $studentId && ($inv['status'] ?? '') === 'exempt') {
            // Khôi phục học phí từ course
            $courseId = $inv['courseId'] ?? '';
            $coursePrice = 0;
            $courseName = '';
            if ($courseId) {
                $courses = tsLoad('courses');
                foreach ($courses as $c) {
                    if ($c['id'] === $courseId) {
                        $coursePrice = (int)($c['price'] ?? 0);
                        $courseName = $c['name'] ?? '';
                        break;
                    }
                }
            }
            // Nếu không tìm thấy course, dùng giá mặc định
            if ($coursePrice <= 0) $coursePrice = 15000000;

            $inv['basePrice'] = $coursePrice;
            $inv['finalPrice'] = $coursePrice;
            $inv['totalPaid'] = 0;
            $inv['remainingDue'] = $coursePrice;
            $inv['agencyId'] = '';
            $inv['agencyName'] = '';
            $inv['agencyDiscountPercent'] = 0;
            $inv['agencyDiscountAmount'] = 0;
            $inv['status'] = 'pending';
            $inv['note'] = ($inv['note'] ?? '') . ' [Đã bỏ miễn phí bởi ' . ($auth['email'] ?? $auth['id']) . ']';
            $inv['updatedAt'] = $now;
            if ($courseName) $inv['courseName'] = $courseName;
            $found = true;
            break;
        }
    }
    unset($inv);

    if (!$found) tsJson(['error' => 'Không tìm thấy invoice exempt cho học viên này'], 404);

    tsSave('invoices', $invoices);

    tsJson([
        'success' => true,
        'message' => 'Đã bỏ đánh dấu miễn phí. Học viên chuyển về trạng thái Chưa thanh toán.',
        'studentId' => $studentId,
        'studentName' => $student['fullName'] ?? '',
    ]);
}

// Fallback
// =====================================================================
// ACTION: fix-non-agency-discounts
// Admin: Sửa invoice không có agency nhưng dp=100% hoặc fp!=bp
// POST (Admin only, idempotent)
// =====================================================================
if ($tsAction === 'fix-non-agency-discounts') {
    $auth = tsRequireRole(['ADMIN']);
    if ($tsMethod !== 'POST') tsJson(['error' => 'POST required'], 405);

    $invoices = tsLoad('invoices');
    $fixed = 0;
    $now = date('c');

    foreach ($invoices as &$inv) {
        $hasAgency = !empty($inv['agencyId']);
        $dp = (float)($inv['agencyDiscountPercent'] ?? 0);
        $bp = (int)($inv['basePrice'] ?? 0);
        $fp = (int)($inv['finalPrice'] ?? 0);

        // Invoice không agency: xóa discount
        if (!$hasAgency) {
            if ($dp != 0 || $fp != $bp) {
                $inv['agencyDiscountPercent'] = 0;
                $inv['agencyDiscountAmount'] = 0;
                $inv['finalPrice'] = $bp;
                $inv['remainingDue'] = max(0, $bp - (int)($inv['totalPaid'] ?? 0));
                $inv['updatedAt'] = $now;
                $fixed++;
            }
        }
    }
    unset($inv);

    tsSave('invoices', $invoices);

    // Cũng xóa agency_commissions cho invoice không agency
    $commissions = tsLoad('agency_commissions');
    $commissions = array_values(array_filter($commissions, function($c) use ($invoices) {
        foreach ($invoices as $inv) {
            if ($inv['id'] === ($c['invoiceId'] ?? '')) {
                return !empty($inv['agencyId']); // giữ nếu có agency
            }
        }
        return false; // xóa nếu không tìm thấy invoice
    }));
    tsSave('agency_commissions', $commissions);

    tsJson([
        'success' => true,
        'message' => "Đã sửa {$fixed} invoice không agency bị gán sai discount.",
        'fixed' => $fixed,
    ]);
}
