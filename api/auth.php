<?php
/**
 * SMC Training API v2
 * Lưu tập trung toàn bộ dữ liệu trên Mắt Bão Plesk
 * URL: https://smc-training.com/api/auth.php
 */

// ── Timezone Việt Nam ──
date_default_timezone_set('Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
// CORS: chỉ cho phép origin của chính app (sẽ xử lý cookie bên dưới)
$allowedOrigin = 'https://smc-training.com';
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Helpers (duy nhất) ──
// Auth functions được cung cấp bởi auth-lib.php (các hàm al*) và helpers.php (findUserByEmail, findUserById, sanitizeUser...)
// Chỉ giữ genId() vì không có trong các file shared, và loadData/saveData với cơ chế cache in-memory.

function genId($prefix = 'u-') {
    return $prefix . bin2hex(random_bytes(8));
}

// ── Data Store (file-based with caching) ──
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0750, true);
}

// In-memory cache để tránh đọc file liên tục
$dataCache = [];
$cacheTime = [];

function loadData($file, $ttl = 5) {
    global $dataDir, $dataCache, $cacheTime;
    $now = microtime(true);

    // Trả về cache nếu còn tươi (TTL = 5 giây)
    if (isset($dataCache[$file]) && ($now - ($cacheTime[$file] ?? 0)) < $ttl) {
        return $dataCache[$file];
    }

    $path = $dataDir . '/' . $file . '.json';
    if (!file_exists($path)) {
        $dataCache[$file] = [];
        $cacheTime[$file] = $now;
        return [];
    }
    $data = json_decode(file_get_contents($path), true) ?: [];
    $dataCache[$file] = $data;
    $cacheTime[$file] = $now;
    return $data;
}

function saveData($file, $data) {
    global $dataDir, $dataCache, $cacheTime;
    $path = $dataDir . '/' . $file . '.json';
    $now = microtime(true);
    // Atomic write: ghi ra file tạm rồi rename
    $tmp = $path . '.tmp.' . getmypid();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        error_log("[SMC] JSON encode failed for {$file}: " . json_last_error_msg());
        return false;
    }
    $written = file_put_contents($tmp, $json, LOCK_EX);
    if ($written === false) {
        error_log("[SMC] file_put_contents failed for {$tmp}. Dir writable? " . (is_writable($dataDir) ? 'yes' : 'no') . ". Disk space: " . disk_free_space($dataDir));
        return false;
    }
    if (!rename($tmp, $path)) {
        error_log("[SMC] rename failed: {$tmp} → {$path}");
        @unlink($tmp);
        return false;
    }
    // Cập nhật cache CHỈ KHI ghi file thành công
    $dataCache[$file] = $data;
    $cacheTime[$file] = $now;
    return true;
}

// ── Unified Payment Processing ──
// Tập trung logic xử lý thanh toán + kích hoạt + enrollment + email
/**
 * DEPRECATED — processPaymentInternal
 *
 * ⚠️  Hàm này KHÔNG còn được sử dụng cho các thao tác học phí mới.
 * Tất cả thao tác học phí phải qua tuition-service.php:
 *   - record-payment   (Staff ghi nhận thu tiền)
 *   - confirm-receipt   (Accountant/Admin duyệt phiếu thu)
 *
 * Hàm này CHỈ giữ lại để tương thích ngược với các endpoint wrapper cũ
 * (approve-student, partial-approve, confirm-payment).
 * Các wrapper này sẽ sớm được thay thế hoàn toàn.
 *
 * ⚠️  QUAN TRỌNG: Hàm này ghi invoices + transactions + users + enrollments
 * SONG SONG với tuition-service.php. Nếu cả 2 cùng chạy sẽ gây ĐÈ DỮ LIỆU.
 * Luôn ưu tiên tuition-service.php cho thao tác mới.
 */
function processPaymentInternal($input, $auth) {
    // ── FALLBACK: Gọi tuition-service.php nếu có thể ──
    // Trong tương lai, tất cả wrapper sẽ gọi trực tiếp tuition-service.php
    // Hiện tại vẫn giữ logic cũ để không break flow đang chạy
    $studentId = $input['studentId'] ?? '';
    $totalAmount = (int)($input['totalAmount'] ?? 0);
    $paidAmount = (int)($input['paidAmount'] ?? $totalAmount);
    $paymentMethod = $input['paymentMethod'] ?? 'cash';
    $note = $input['note'] ?? '';
    $inputCourseId = $input['courseId'] ?? '';
    $dueDays = (int)($input['dueDays'] ?? 14);
    $activationThreshold = (int)($input['activationThreshold'] ?? 50);

    if (!$studentId) return ['error' => 'Thiếu studentId', 'code' => 400];

    // KHÔNG cho phép tạo transaction với amount=0 (trừ khi là exempt — activationThreshold=0)
    $isExempt = ($input['exempt'] ?? false) || ($activationThreshold === 0 && $paidAmount === 0);
    if ($paidAmount === 0 && $totalAmount === 0 && !$isExempt) {
        return ['error' => 'Số tiền thanh toán không hợp lệ (amount=0)', 'code' => 400];
    }

    // 1. Load student
    $users = loadData('users');
    $student = null;
    $studentIdx = null;
    foreach ($users as $i => $u) {
        if ($u['id'] === $studentId) { $student = $u; $studentIdx = $i; break; }
    }
    if (!$student) return ['error' => 'Không tìm thấy học viên', 'code' => 404];

    $now = date('c');

    // 2. Resolve courseId & courseName
    $courses = loadData('courses');
    $courseId = $inputCourseId ?: ($student['courseId'] ?? '');
    $courseName = '';
    $coursePrice = 0;
    if ($courseId) {
        foreach ($courses as $c) {
            if ($c['id'] === $courseId) {
                $courseName = $c['name'] ?? '';
                $coursePrice = (int)($c['price'] ?? 0);
                break;
            }
        }
    }

    // 3. Resolve agency metadata
    $agencies = loadData('agencies');
    $agencyId = $input['agencyId'] ?? ($student['agencyId'] ?? '');
    $agency = null;
    $discountPercent = 0;
    if ($agencyId) {
        foreach ($agencies as $a) {
            if ($a['id'] === $agencyId) { $agency = $a; break; }
        }
        $discountPercent = (float)($agency['discountPercent'] ?? 0);
    }
    $basePrice = (int)($input['baseAmount'] ?? ($totalAmount > 0 ? $totalAmount : $coursePrice));

    // KHÔNG cho phép học viên miễn phí thuộc đại lý
    if ($agencyId && $basePrice > 0 && $discountPercent >= 100) {
        return ['error' => 'Không được tạo học viên miễn phí cho đại lý. Vui lòng giảm chiết khấu (phải < 100%).', 'code' => 400];
    }

    $discountAmount = $discountPercent > 0 ? (int)($basePrice * $discountPercent / 100) : 0;
    $finalPrice = max(0, $basePrice - $discountAmount);

    // Nếu totalAmount = 0 → dùng basePrice
    if ($totalAmount === 0 && $paidAmount > 0) {
        $totalAmount = $paidAmount;
    }
    if ($totalAmount === 0 && $paidAmount === 0 && $coursePrice > 0) {
        $totalAmount = $coursePrice;
    }

    // ═══ VIẾT VÀO invoices.json + transactions.json (HỆ THỐNG v3) ═══
    $invoices = loadData('invoices');
    $transactions = loadData('transactions');

    // Tìm invoice hiện có cho student + course này
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if (($inv['studentId'] ?? '') === $studentId && ($inv['courseId'] ?? '') === $courseId) {
            $invIdx = $i;
            break;
        }
    }

    if ($invIdx === null) {
        // Tạo invoice mới
        $invoiceId = 'inv-' . bin2hex(random_bytes(8));
        $invoice = [
            'id' => $invoiceId,
            'studentId' => $studentId,
            'studentName' => $student['fullName'] ?? '',
            'studentEmail' => $student['email'] ?? '',
            'studentPhone' => $student['phone'] ?? '',
            'courseId' => $courseId,
            'courseName' => $courseName,
            'basePrice' => $basePrice,
            'agencyId' => $agencyId,
            'agencyName' => $agency['name'] ?? '',
            'agencyDiscountPercent' => $discountPercent,
            'agencyDiscountAmount' => $discountAmount,
            'finalPrice' => $finalPrice,
            'totalPaid' => 0,
            'remainingDue' => $basePrice,
            'status' => 'pending',
            'note' => $note,
            'createdBy' => $auth['id'],
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        $invoices[] = $invoice;
    } else {
        $invoice = $invoices[$invIdx];
        $invoiceId = $invoice['id'];
    }

    // Cập nhật totalPaid
    if ($invIdx !== null) {
        $accumulatedPaid = (int)($invoices[$invIdx]['totalPaid'] ?? 0) + $paidAmount;
    } else {
        $accumulatedPaid = $paidAmount;
    }

    // Tạo transaction với logic 3 tầng (v5)
    $isAdminOrAccountant = in_array(strtolower($auth['role'] ?? ''), ['admin', 'accountant']);
    $isAdmin = (strtolower($auth['role'] ?? '') === 'admin');
    $isCash = ($paymentMethod === 'cash');

    if ($isAdmin) {
        // Admin → auto-confirmed (bypass cả 2 tầng), kích hoạt ngay
        $txnStatus = 'confirmed';
        $approvalLevel = 'admin_direct';
    } elseif ($isAdminOrAccountant) {
        // Accountant ghi nhận → accountant_confirmed (chờ Admin duyệt cuối)
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

    $txnId = 'txn-' . bin2hex(random_bytes(8));
    $transaction = [
        'id' => $txnId,
        'invoiceId' => $invoiceId,
        'studentId' => $studentId,
        'amount' => $paidAmount,
        'method' => $paymentMethod,
        'receiptImage' => null,
        'submittedBy' => $auth['id'],
        'submittedByName' => $auth['email'] ?? '',
        'confirmedBy' => ($txnStatus === 'confirmed') ? $auth['id'] : null,
        'status' => $txnStatus,
        'approvalLevel' => $approvalLevel,
        'note' => $note,
        'createdAt' => $now,
        'confirmedAt' => ($txnStatus === 'confirmed') ? $now : null,
    ];
    // CHỈ lưu transaction nếu số tiền thực > 0 (tránh ghi nhận giao dịch rỗng)
    if ($paidAmount > 0) {
        $transactions[] = $transaction;
    }

    // Update invoice
    $isPaidInFull = $accumulatedPaid >= $basePrice;
    $meetsThreshold = $activationThreshold === 0 || $isPaidInFull || $accumulatedPaid >= $basePrice * $activationThreshold / 100;
    if ($isPaidInFull) $meetsThreshold = true;

    if ($invIdx !== null) {
        $invoices[$invIdx]['totalPaid'] = $accumulatedPaid;
        $invoices[$invIdx]['remainingDue'] = max(0, $basePrice - $accumulatedPaid);
        $invoices[$invIdx]['status'] = $isPaidInFull ? 'paid' : ($accumulatedPaid > 0 ? 'partial' : 'pending');
        $invoices[$invIdx]['updatedAt'] = $now;
        if ($paymentMethod) $invoices[$invIdx]['paymentMethod'] = $paymentMethod;
    } else {
        $invoices[count($invoices) - 1]['totalPaid'] = $accumulatedPaid;
        $invoices[count($invoices) - 1]['remainingDue'] = max(0, $basePrice - $accumulatedPaid);
        $invoices[count($invoices) - 1]['status'] = $isPaidInFull ? 'paid' : ($accumulatedPaid > 0 ? 'partial' : 'pending');
        if ($paymentMethod) $invoices[count($invoices) - 1]['paymentMethod'] = $paymentMethod;
    }

    saveData('invoices', $invoices);
    saveData('transactions', $transactions);

    // ═══ ĐỒNG BỘ tuitions.json cũ (tương thích ngược) ═══
    $tuitions = loadData('tuitions');
    $tuitionIdx = null;
    foreach ($tuitions as $i => $t) {
        if (($t['studentId'] ?? '') === $studentId) { $tuitionIdx = $i; break; }
    }
    if ($tuitionIdx !== null) {
        $tuitions[$tuitionIdx]['status'] = $isPaidInFull ? 'paid' : ($accumulatedPaid > 0 ? 'partial' : 'unpaid');
        $tuitions[$tuitionIdx]['partialAmount'] = $accumulatedPaid;
        $tuitions[$tuitionIdx]['step'] = $meetsThreshold ? 'active' : 'partial';
        $tuitions[$tuitionIdx]['baseAmount'] = $basePrice;
        $tuitions[$tuitionIdx]['discountPercent'] = $discountPercent;
        $tuitions[$tuitionIdx]['agencyId'] = $agencyId;
        $tuitions[$tuitionIdx]['updatedAt'] = $now;
        saveData('tuitions', $tuitions);
    }

    // Activate student CHỈ KHI được Admin duyệt (confirmed)
    $shouldActivate = ($txnStatus === 'confirmed') && $meetsThreshold;
    $wasActivated = ($student['status'] ?? '') === 'ACTIVE';
    if ($shouldActivate && !$wasActivated) {
        $users[$studentIdx]['status'] = 'ACTIVE';
        $users[$studentIdx]['activatedBy'] = $auth['id'];
        $users[$studentIdx]['activatedAt'] = $now;
    }
    $nowActivated = ($users[$studentIdx]['status'] ?? '') === 'ACTIVE';

    // Create/update enrollment
    $enrollments = loadData('enrollments');
    $hasEnrollment = false;
    $enrollmentPaymentStatus = $isPaidInFull ? 'paid' : ($meetsThreshold ? 'partial' : 'unpaid');

    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $studentId) {
            $enr['payment'] = [
                'amount' => (int)$basePrice,
                'paid' => (int)$accumulatedPaid,
                'status' => $enrollmentPaymentStatus,
                'method' => $paymentMethod,
                'date' => $now,
                'confirmed_by' => $auth['id'],
            ];
            $enr['status'] = $nowActivated ? 'active' : 'pending';
            if (empty($enr['course_id']) && $courseId) {
                $enr['course_id'] = $courseId;
                $enr['course_name'] = $courseName;
            }
            $enr['confirmed_by'] = $auth['id'];
            $enr['confirmed_at'] = $now;
            if (empty($enr['stages']['enrollment']) || ($enr['stages']['enrollment']['status'] ?? '') !== 'completed') {
                $enr['stages']['enrollment'] = ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $auth['id']];
            }
            $hasEnrollment = true;
            break;
        }
    }
    unset($enr);

    if (!$hasEnrollment) {
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
                'paid' => (int)$accumulatedPaid,
                'status' => $enrollmentPaymentStatus,
                'method' => $paymentMethod,
                'date' => $now,
                'confirmed_by' => $auth['id'],
            ],
            'status' => $nowActivated ? 'active' : 'pending',
            'confirmed_by' => $auth['id'],
            'confirmed_at' => $now,
            'stages' => [
                'enrollment' => ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $auth['id']],
                'theory' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
                'practice' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
                'exam' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
                'certification' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
            ],
        ];
    }

    // Save users + enrollments
    if (!saveData('users', $users)) {
        return ['error' => 'Lỗi hệ thống: Không thể lưu tài khoản', 'code' => 500];
    }
    if (!saveData('enrollments', $enrollments)) {
        return ['error' => 'Lỗi hệ thống: Không thể lưu enrollment', 'code' => 500];
    }

    // Sync agency commission
    if ($agencyId && $discountPercent > 0) {
        $dataDir = __DIR__ . '/data';
        $commissions = [];
        $commPath = $dataDir . '/agency_commissions.json';
        if (file_exists($commPath)) {
            $commissions = json_decode(file_get_contents($commPath), true) ?: [];
        }
        $foundComm = false;
        foreach ($commissions as &$comm) {
            if (($comm['invoiceId'] ?? '') === $invoiceId) {
                $comm['totalPaid'] = $accumulatedPaid;
                $comm['status'] = $accumulatedPaid >= $basePrice ? 'settled' : 'pending';
                $comm['updatedAt'] = $now;
                $foundComm = true;
                break;
            }
        }
        unset($comm);
        if (!$foundComm) {
            $commissions[] = [
                'id' => 'comm-' . bin2hex(random_bytes(6)),
                'agencyId' => $agencyId,
                'invoiceId' => $invoiceId,
                'studentId' => $studentId,
                'basePrice' => $basePrice,
                'discountPercent' => $discountPercent,
                'discountAmount' => $discountAmount,
                'finalPrice' => $finalPrice,
                'totalPaid' => $accumulatedPaid,
                'status' => $accumulatedPaid >= $basePrice ? 'settled' : 'pending',
                'period' => date('Y-m'),
                'createdAt' => $now,
                'updatedAt' => $now,
            ];
        }
        $commTmp = $commPath . '.tmp.' . getmypid();
        file_put_contents($commTmp, json_encode($commissions, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        rename($commTmp, $commPath);
    }

    // Send email (non-critical)
    $emailSent = false;
    $emailError = null;
    $studentEmail = $student['email'] ?? '';
    $loginId = $student['phone'] ?: $studentEmail;

    if ($studentEmail && filter_var($studentEmail, FILTER_VALIDATE_EMAIL)) {
        $siteUrl = 'https://smc-training.com';
        $loginUrl = $siteUrl . '/login';
        $remainingForEmail = max(0, $basePrice - $accumulatedPaid);

        if ($isPaidInFull) {
            $headerColor = 'linear-gradient(135deg, #16a34a, #15803d)';
            $headerTitle = '✅ Tài Khoản Đã Được Kích Hoạt (Đã thanh toán đủ)';
            $subject = str_replace(["\r", "\n"], '', "[SMC Training] Tài khoản đã kích hoạt (Đã TT đủ) - {$student['fullName']}");
            $lmsAccess = 'đầy đủ (100% LMS)';
            $remainingNote = '';
        } elseif ($meetsThreshold) {
            $headerColor = 'linear-gradient(135deg, #f59e0b, #d97706)';
            $headerTitle = '🔓 Tài Khoản Đã Được Kích Hoạt (Thanh toán một phần)';
            $subject = str_replace(["\r", "\n"], '', "[SMC Training] Tài khoản đã kích hoạt (TT một phần) - {$student['fullName']}");
            $lmsAccess = 'hạn chế (50% LMS)';
            $remainingNote = "<p style=\"font-size:14px; color:#e67e22;\">⚠️ Vui lòng hoàn tất học phí còn thiếu <strong>" . number_format($remainingForEmail) . "đ</strong> trước ngày <strong>" . date('d/m/Y', strtotime('+' . $dueDays . ' days')) . "</strong>.</p>";
        } else {
            $headerColor = 'linear-gradient(135deg, #1a73e8, #1557b0)';
            $headerTitle = '📋 Đã Ghi Nhận Thanh Toán';
            $subject = str_replace(["\r", "\n"], '', "[SMC Training] Đã ghi nhận thanh toán - {$student['fullName']}");
            $lmsAccess = 'chưa kích hoạt (cần đạt ngưỡng ' . $activationThreshold . '%)';
            $remainingNote = "<p style=\"font-size:14px; color:#e67e22;\">⚠️ Cần thanh toán thêm <strong>" . number_format($remainingForEmail) . "đ</strong> để đạt ngưỡng kích hoạt {$activationThreshold}%.</p>";
        }

        $message = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin:0; padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding: 20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background: {$headerColor}; padding: 32px 40px; text-align:center;">
        <h1 style="color:#fff; margin:0; font-size:22px;">{$headerTitle}</h1>
    </td></tr>
    <tr><td style="padding: 32px 40px; color: #333;">
        <p style="font-size:16px; margin:0 0 8px;">Xin chào <strong>{$student['fullName']}</strong>,</p>
        <p style="font-size:14px; line-height:1.7; color:#555;">
            Học phí của bạn đã được ghi nhận với quyền truy cập {$lmsAccess}.
            Bạn đã thanh toán <strong>" . number_format($accumulatedPaid) . "đ</strong> / " . number_format($basePrice) . "đ.
        </p>
        {$remainingNote}
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff; border:1px solid #d0e3f7; border-radius:8px; margin: 20px 0;">
        <tr><td style="padding: 20px 24px;">
            <p style="font-size:14px; font-weight:bold; margin:0 0 12px; color:#1a73e8;">📋 Thông tin đăng nhập</p>
            <table cellpadding="4" cellspacing="0">
                <tr><td style="font-size:13px; color:#777; width:100px;">Tài khoản:</td><td style="font-size:14px; font-weight:bold;">{$loginId}</td></tr>
                <tr><td style="font-size:13px; color:#777;">Mật khẩu:</td><td style="font-size:14px; font-weight:bold;">(Mật khẩu bạn đã đăng ký)</td></tr>
            </table>
            <p style="font-size:12px; color:#e67e22; margin: 12px 0 0;">⚠️ Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
        </td></tr>
        </table>
        <div style="text-align:center; margin: 28px 0;">
            <a href="{$loginUrl}" style="display:inline-block; background:#1a73e8; color:#fff; text-decoration:none; padding:14px 40px; border-radius:8px; font-size:15px; font-weight:bold;">🔑 Đăng nhập ngay</a>
        </div>
    </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: SMC Training <no-reply@smc-training.com>";
        $emailSent = @mail($studentEmail, $subject, $message, $headers, '-f no-reply@smc-training.com');
        if (!$emailSent) {
            $lastError = error_get_last();
            $emailError = $lastError['message'] ?? 'mail() returned false';
        }

        $emailLog = loadData('email_log');
        $emailLog[] = [
            'id' => 'email-' . bin2hex(random_bytes(4)),
            'to' => $studentEmail, 'subject' => $subject,
            'sent' => $emailSent, 'error' => $emailSent ? null : $emailError,
            'timestamp' => $now, 'studentId' => $studentId, 'triggeredBy' => 'process-payment',
        ];
        saveData('email_log', $emailLog);
    }

    // Build response (v5: phân biệt message theo luồng 3 tầng)
    if ($txnStatus === 'confirmed') {
        $msg = $isPaidInFull ? 'Đã ghi nhận thanh toán đầy đủ & kích hoạt tài khoản!' : 'Đã ghi nhận một phần & kích hoạt tài khoản!';
    } elseif ($txnStatus === 'accountant_confirmed') {
        $msg = 'Đã ghi nhận thanh toán! Chuyển cho Admin duyệt cuối để kích hoạt khóa học.';
    } elseif ($txnStatus === 'staff_confirmed') {
        $msg = 'Đã xác nhận thu tiền mặt! Chuyển cho Kế toán để đối soát.';
    } else {
        $msg = 'Đã ghi nhận thanh toán! Kế toán sẽ đối soát và xác nhận.';
    }

    return [
        'success' => true,
        'message' => $msg,
        'student' => [
            'id' => $studentId,
            'name' => $student['fullName'],
            'status' => $nowActivated ? 'ACTIVE' : ($users[$studentIdx]['status'] ?? ''),
        ],
        'payment' => [
            'basePrice' => $basePrice,
            'finalPrice' => $finalPrice,
            'paidNow' => $paidAmount,
            'accumulatedPaid' => $accumulatedPaid,
            'remaining' => max(0, $basePrice - $accumulatedPaid),
            'isPaidInFull' => $isPaidInFull,
            'meetsThreshold' => $meetsThreshold,
            'thresholdPercent' => $activationThreshold,
            'method' => $paymentMethod,
            'status' => $txnStatus,
            'approvalLevel' => $approvalLevel,
            'needsAccountant' => in_array($txnStatus, ['staff_confirmed', 'pending']),
            'needsAdmin' => ($txnStatus === 'accountant_confirmed'),
        ],
        'enrollment' => [
            'created' => !$hasEnrollment,
            'status' => $nowActivated ? 'active' : 'pending',
            'paymentStatus' => $enrollmentPaymentStatus,
        ],
        'invoice' => [
            'id' => $invoiceId,
            'totalPaid' => $accumulatedPaid,
        ],
        'email' => [
            'sent' => $emailSent,
            'error' => $emailError,
        ],
    ];
}

// ── Init seed data ──
function initSeed() {
    // Users
    $users = loadData('users');
    if (empty($users)) {
        $users = [
            ['id' => 'u-admin-001', 'email' => '0902596999', 'password' => password_hash('123456', PASSWORD_BCRYPT), 'role' => 'ADMIN', 'fullName' => 'Quản trị viên SMC', 'phone' => '0902596999', 'status' => 'ACTIVE', 'createdAt' => date('c')],
            ['id' => 'u-staff-001', 'email' => 'nhanvien@smc.edu.vn', 'password' => password_hash('staff123', PASSWORD_BCRYPT), 'role' => 'STAFF', 'fullName' => 'Trần Văn Nhân Viên', 'phone' => '0901000001', 'status' => 'ACTIVE', 'createdAt' => date('c')],
            ['id' => 'u-teacher-001', 'email' => 'giangvien@smc.edu.vn', 'password' => password_hash('teacher123', PASSWORD_BCRYPT), 'role' => 'TEACHER', 'fullName' => 'Nguyễn Văn Giáo Viên', 'phone' => '0902000001', 'status' => 'ACTIVE', 'createdAt' => date('c')],
            ['id' => 'u-student-001', 'email' => 'hocvien@smc.edu.vn', 'password' => password_hash('student123', PASSWORD_BCRYPT), 'role' => 'STUDENT', 'fullName' => 'Phạm Văn Học Viên', 'phone' => '0903000001', 'status' => 'ACTIVE', 'createdAt' => date('c')],
        ];
        saveData('users', $users);
    }

    // Courses
    $courses = loadData('courses');
    if (empty($courses)) {
        saveData('courses', [
            ['id' => 'c001', 'name' => 'Đào tạo UAV Hạng A (VLOS)', 'code' => 'UAV-A-001', 'price' => 15000000,
             'modules' => [
                 ['id' => 'm1', 'name' => 'Pháp luật & Quy định về UAV', 'hours_theory' => 8, 'hours_practice' => 16],
                 ['id' => 'm2', 'name' => 'Khí tượng & Môi trường bay', 'hours_theory' => 6, 'hours_practice' => 12],
                 ['id' => 'm3', 'name' => 'Kiến thức hàng không & Nguyên lý bay', 'hours_theory' => 10, 'hours_practice' => 20],
                 ['id' => 'm4', 'name' => 'Tổ hợp UAV & Thiết bị đồng bộ', 'hours_theory' => 8, 'hours_practice' => 16],
                 ['id' => 'm5', 'name' => 'Vận hành an toàn & Quy trình bay', 'hours_theory' => 6, 'hours_practice' => 12],
                 ['id' => 'm6', 'name' => 'Xử lý tình huống bất thường', 'hours_theory' => 4, 'hours_practice' => 8],
             ], 'total_hours_theory' => 42, 'total_hours_practice' => 84, 'total_hours_review' => 14, 'min_fly_hours' => 20, 'status' => 'active'],
            ['id' => 'c002', 'name' => 'Đào tạo UAV Hạng B (BVLOS)', 'code' => 'UAV-B-001', 'price' => 25000000,
             'modules' => [
                 ['id' => 'm7', 'name' => 'Nguyên lý bay BVLOS', 'hours_theory' => 30, 'hours_practice' => 60],
                 ['id' => 'm8', 'name' => 'Hệ thống & Công nghệ UAV tiên tiến', 'hours_theory' => 30, 'hours_practice' => 60],
                 ['id' => 'm9', 'name' => 'Lập kế hoạch bay & Xử lý khẩn cấp', 'hours_theory' => 28, 'hours_practice' => 58],
             ], 'total_hours_theory' => 88, 'total_hours_practice' => 178, 'total_hours_review' => 30, 'min_fly_hours' => 40, 'status' => 'active'],
            ['id' => 'c003', 'name' => 'Đào tạo UAV Hạng B — BVLOS (Chuyên sâu)', 'code' => 'UAV-B-002', 'price' => 25000000,
             'modules' => [
                 ['id' => 'm10', 'name' => 'Luật hàng không & Quy định BVLOS nâng cao', 'hours_theory' => 20, 'hours_practice' => 0],
                 ['id' => 'm11', 'name' => 'Cảm biến & Hệ thống tự động', 'hours_theory' => 24, 'hours_practice' => 16],
                 ['id' => 'm12', 'name' => 'Vận hành BVLOS & Xử lý tình huống', 'hours_theory' => 20, 'hours_practice' => 24],
                 ['id' => 'm13', 'name' => 'Ứng dụng thực tế & Bay kiểm tra', 'hours_theory' => 8, 'hours_practice' => 32],
             ], 'total_hours_theory' => 72, 'total_hours_practice' => 72, 'total_hours_review' => 0, 'min_fly_hours' => 60, 'status' => 'active'],
        ]);
    }

    // Classes
    $classes = loadData('classes');
    if (empty($classes)) {
        saveData('classes', [
            ['id' => 'cl001', 'course_id' => 'c001', 'name' => 'UAV-A-K01', 'teacher_ids' => ['u-teacher-001'],
             'max_students' => 20, 'start_date' => '2026-08-01', 'end_date' => '2026-10-30',
             'schedule' => [
                 ['day' => 'Thứ 2', 'time' => '18:00-20:00', 'type' => 'theory', 'location' => 'Phòng 101 - SMC Center'],
                 ['day' => 'Thứ 4', 'time' => '18:00-20:00', 'type' => 'theory', 'location' => 'Phòng 101 - SMC Center'],
                 ['day' => 'Thứ 7', 'time' => '08:00-12:00', 'type' => 'practice', 'location' => 'Sân bay SMC Training'],
             ], 'student_ids' => ['u-student-001'], 'status' => 'active'],
        ]);
    }

    // Enrollments
    $enrollments = loadData('enrollments');
    if (empty($enrollments)) {
        saveData('enrollments', [
            ['student_id' => 'u-student-001', 'class_id' => 'cl001',
             'documents' => [
                 'id_card' => ['status' => 'verified', 'url' => ''],
                 'health_cert' => ['status' => 'verified', 'url' => ''],
                 'education' => ['status' => 'verified', 'url' => ''],
             ],
             'payment' => ['amount' => 15000000, 'status' => 'paid', 'method' => 'bank_transfer', 'date' => '2026-07-15'],
             'status' => 'active',
             'stages' => [
                 'enrollment' => ['status' => 'completed', 'completed_at' => '2026-07-15', 'confirmed_by' => 'u-staff-001'],
                 'theory' => ['status' => 'in_progress', 'completed_at' => null, 'confirmed_by' => null],
                 'practice' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
                 'exam' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
                 'certification' => ['status' => 'pending', 'completed_at' => null, 'confirmed_by' => null],
             ]],
        ]);
    }

    // Other empty collections
    if (empty(loadData('attendance'))) saveData('attendance', []);
    if (empty(loadData('exams'))) {
        saveData('exams', [
            ['id' => 'ex001', 'course_id' => 'c001', 'module_id' => 'm1', 'title' => 'Kiểm tra Pháp luật & Quy định UAV',
             'questions' => [
                 ['q' => 'Cục Hàng không Việt Nam là cơ quan nào?', 'options' => ['Bộ GTVT', 'Bộ Công an', 'Bộ Quốc phòng', 'Văn phòng Chính phủ'], 'answer' => 0],
                 ['q' => 'UAV hạng A được phép bay trong tầm nhìn tối đa bao nhiêu mét?', 'options' => ['100m', '200m', '500m', '1000m'], 'answer' => 2],
             ], 'duration_minutes' => 30, 'pass_score' => 70, 'results' => []],
        ]);
    }
    if (empty(loadData('fly_logs'))) saveData('fly_logs', []);

    // ── Seed 5 sample fly logs để demo nhật ký bay (chỉ khi chưa có dữ liệu) ──
    $flyLogs = loadData('fly_logs');
    if (empty($flyLogs)) {
        $studentIds = [];
        $users = loadData('users');
        foreach ($users as $u) {
            if ($u['role'] === 'STUDENT') $studentIds[] = $u['id'];
        }
        // Skip seed nếu không có student nào (tránh array_rand() empty error)
        if (empty($studentIds)) $studentIds = ['u-admin-001']; // fallback dummy
        $flyLogs = [];
        $locations = ['Sân bay SMC Training', 'Bãi tập UAV Hòa Lạc', 'Sân tập Phú Thọ', 'Khu bay Đồng Mô'];
        $models = ['DJI Phantom 4', 'DJI Mavic 3', 'DJI Mini 3 Pro', 'Autel EVO II'];
        $weather = ['Nắng nhẹ, gió 3m/s', 'Trời quang, gió 2m/s', 'Nhiều mây, gió 5m/s', 'Nắng, gió 4m/s'];
        $dates = ['2026-07-20', '2026-07-22', '2026-07-24', '2026-07-25', '2026-07-26'];

        for ($i = 0; $i < 5; $i++) {
            $flyLogs[] = [
                'id' => 'fl-' . bin2hex(random_bytes(4)),
                'student_id' => $studentIds[array_rand($studentIds)],
                'class_id' => 'cl001',
                'date' => $dates[$i],
                'duration_minutes' => rand(30, 90),
                'uav_model' => $models[array_rand($models)],
                'location' => $locations[array_rand($locations)],
                'weather' => $weather[array_rand($weather)],
                'notes' => 'Bay tập luyện cơ bản - Hạng A',
                'logged_by' => 'u-teacher-001',
                'createdAt' => date('c', strtotime($dates[$i] . ' 10:00:00')),
            ];
        }
        saveData('fly_logs', $flyLogs);
    }

    if (empty(loadData('certifications'))) saveData('certifications', []);
}
initSeed();

// ── Shared Auth Library (v4) ──
// Tất cả auth functions được tập trung trong auth-lib.php
// auth.php giữ backward compatibility qua alias functions
require_once __DIR__ . '/auth-lib.php';

// Aliases cho backward compatibility với code hiện tại trong auth.php
// (các hàm này được gọi trực tiếp từ routes bên dưới)
function getTokenFromRequest() { return alGetToken(); }
function setTokenCookie($token) { alSetTokenCookie($token); }  // Note: overridden below với SameSite=Lax
function clearTokenCookie() { alClearTokenCookie(); }
function createToken($user) { return alCreateToken($user); }
function verifyToken($token) { return alVerifyToken($token); }
function authenticate() { return alAuthenticate(); }
function jsonResponse($data, $code = 200) { alJsonResponse($data, $code); }
function jsonInput() { return alJsonInput(); }
function getClientIP() { return alGetClientIP(); }
function rateLimit($key, $maxRequests, $windowSeconds, $errorMessage) {
    return alRateLimit($key, $maxRequests, $windowSeconds, $errorMessage);
}

function requireRole($allowedRoles) {
    $auth = alAuthenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], $allowedRoles)) jsonResponse(['error' => 'Forbidden'], 403);
    return $auth;
}

// ── User helpers (dùng chung với loadData/saveData từ auth.php) ──
// Các hàm này dùng loadData('users') và saveData('users') định nghĩa ở auth.php
function sanitizeUser($u) {
    return [
        'id' => $u['id'],
        'email' => $u['email'],
        'role' => $u['role'],
        'fullName' => $u['fullName'],
        'phone' => $u['phone'] ?? '',
        'status' => $u['status'] ?? 'PENDING',
        'courseId' => $u['courseId'] ?? '',
        'rank' => $u['rank'] ?? '',
        'agencyId' => $u['agencyId'] ?? '',
        'address' => $u['address'] ?? '',
        'notes' => $u['notes'] ?? '',
        'createdAt' => $u['createdAt'] ?? '',
    ];
}

function findUserByEmail($email) {
    $users = loadData('users');
    foreach ($users as $u) {
        if (($u['status'] ?? '') === 'REJECTED') continue;
        if (strtolower($u['email']) === strtolower($email) || ($u['phone'] ?? '') === $email) return $u;
    }
    return null;
}

function findUserById($id) {
    $users = loadData('users');
    foreach ($users as $u) { if ($u['id'] === $id) return $u; }
    return null;
}

// ── Router ──
$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';

// Fallback: parse from REQUEST_URI
if (empty($path)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = strtok($uri, '?');
    if (preg_match('#^/api/(.+)$#', $uri, $m)) {
        $path = $m[1];
    }
}

$parts = array_values(array_filter(explode('/', $path)));

// ── Maintenance Mode ──
// Khi bật, chặn đăng nhập của học viên (STUDENT) và đại lý (AGENCY)
// Admin/Staff/Teacher vẫn đăng nhập bình thường để cập nhật hệ thống
function isMaintenanceMode() {
    $maintenanceFile = __DIR__ . '/data/maintenance.json';
    if (!file_exists($maintenanceFile)) return false;
    $data = json_decode(file_get_contents($maintenanceFile), true);
    return !empty($data['enabled']);
}

function getMaintenanceInfo() {
    $maintenanceFile = __DIR__ . '/data/maintenance.json';
    if (!file_exists($maintenanceFile)) return ['enabled' => false];
    return json_decode(file_get_contents($maintenanceFile), true) ?: ['enabled' => false];
}

function setMaintenanceMode($enabled, $updatedBy, $note = '') {
    $maintenanceFile = __DIR__ . '/data/maintenance.json';
    $data = [
        'enabled' => $enabled,
        'updatedAt' => date('c'),
        'updatedBy' => $updatedBy,
        'note' => $note,
    ];
    return file_put_contents($maintenanceFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

// ── Auth routes ──
if (in_array($parts[0] ?? '', ['auth', 'login', 'register', 'me']) || empty($parts[0])) {

    // POST login: /api/auth/login hoặc /api/login
    if ($method === 'POST' && in_array($parts[0] ?? $parts[1] ?? '', ['login'])) {
        $input = jsonInput();
        $email = $input['email'] ?? ''; $password = $input['password'] ?? '';
        if (!$email || !$password) jsonResponse(['error' => 'Vui lòng nhập email và mật khẩu'], 400);

        // Rate limit: 30 attempts per IP per 60s (đủ cho 30+ user cùng login trong 1 phút)
        rateLimit('login_ip:' . getClientIP(), 30, 60, 'Quá nhiều lần đăng nhập từ IP này. Vui lòng thử lại sau 1 phút.');
        // Rate limit: 10 attempts per email per 60s (chống brute-force 1 tài khoản)
        rateLimit('login_email:' . strtolower($email), 10, 60, 'Quá nhiều lần đăng nhập cho tài khoản này. Vui lòng thử lại sau 1 phút.');

        $user = findUserByEmail($email);
        if (!$user || !password_verify($password, $user['password'])) jsonResponse(['error' => 'Số điện thoại/Email hoặc mật khẩu không đúng'], 401);
        if ($user['status'] === 'PENDING') jsonResponse(['error' => 'Tài khoản của bạn đang chờ nhân viên SMC duyệt. Vui lòng chờ thông báo qua email/điện thoại.'], 403);
        if ($user['status'] !== 'ACTIVE') jsonResponse(['error' => 'Tài khoản đã bị khóa hoặc chưa được duyệt'], 403);

        // Maintenance mode: chặn học viên & đại lý khi hệ thống đang bảo trì
        if (isMaintenanceMode() && in_array($user['role'] ?? '', ['STUDENT', 'AGENCY'])) {
            $info = getMaintenanceInfo();
            jsonResponse(['error' => 'Hệ thống đang được bảo trì, vui lòng quay lại sau. ' . ($info['note'] ? 'Ghi chú: ' . $info['note'] : '')], 503);
        }

        $token = createToken($user);
        setTokenCookie($token);
        jsonResponse(['token' => $token, 'user' => sanitizeUser($user)]);
    }

    // POST register
    if ($method === 'POST' && in_array($parts[0] ?? $parts[1] ?? '', ['register'])) {
        // Rate limit: 10 registrations per IP per hour (tăng từ 3)
        rateLimit('register_ip:' . getClientIP(), 30, 3600, 'Quá nhiều đăng ký từ IP này');

        $input = jsonInput();
        $email = $input['email'] ?? ''; $password = $input['password'] ?? ''; $fullName = $input['fullName'] ?? ''; $phone = $input['phone'] ?? ''; $courseId = $input['courseId'] ?? '';
        if (!$email || !$password || !$fullName) jsonResponse(['error' => 'Vui lòng nhập đầy đủ: email, mật khẩu, họ tên'], 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) && !preg_match('/^\d{9,11}$/', $email)) jsonResponse(['error' => 'Email hoặc số điện thoại không hợp lệ'], 400);
        if (strlen($password) < 6) jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);
        if (findUserByEmail($email)) jsonResponse(['error' => 'Email hoặc số điện thoại đã được sử dụng'], 409);
        $newUser = ['id' => genId('u-student-'), 'email' => $email, 'password' => password_hash($password, PASSWORD_BCRYPT), 'role' => 'STUDENT', 'fullName' => $fullName, 'phone' => $phone, 'status' => 'PENDING', 'courseId' => $courseId, 'createdAt' => date('c')];
        $users = loadData('users'); $users[] = $newUser; saveData('users', $users);

        // Tạo tuition record nếu có courseId
        if ($courseId) {
            $courses = loadData('courses');
            $course = null;
            foreach ($courses as $c) { if ($c['id'] === $courseId) { $course = $c; break; } }
            $tuitions = loadData('tuitions');
            $tuitions[] = [
                'id' => 'tuition-' . bin2hex(random_bytes(6)),
                'studentId' => $newUser['id'],
                'studentName' => $fullName,
                'courseId' => $courseId,
                'courseName' => $course['name'] ?? '',
                'amount' => 0,
                'step' => 'pending',
                'status' => 'unpaid',
                'createdAt' => date('c'),
                'salesRep' => '',
                'consultationNote' => '',
            ];
            saveData('tuitions', $tuitions);
        }

        // Không cấp token khi đăng ký - phải chờ duyệt
        jsonResponse(['message' => 'Đăng ký thành công! Tài khoản của bạn đang chờ nhân viên SMC duyệt.', 'user' => sanitizeUser($newUser)], 201);
    }

    if ($method === 'GET' && in_array($parts[0] ?? $parts[1] ?? '', ['me'])) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $user = findUserById($auth['id']);
        if (!$user) jsonResponse(['error' => 'Không tìm thấy người dùng'], 404);
        jsonResponse(sanitizeUser($user));
    }
}

// ── Logout (xóa cookie) ──
if (($parts[0] ?? '') === 'logout') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    clearTokenCookie();
    jsonResponse(['success' => true, 'message' => 'Đã đăng xuất']);
}

// ── Change Password (đã login) ──
// POST /api/change-password  Body: {currentPassword/oldPassword, newPassword}
if (($parts[0] ?? '') === 'change-password') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Vui lòng đăng nhập'], 401);

    $input = jsonInput();
    $currentPassword = $input['currentPassword'] ?? $input['oldPassword'] ?? '';
    $newPassword = $input['newPassword'] ?? '';

    if (!$currentPassword || !$newPassword) {
        jsonResponse(['error' => 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới'], 400);
    }
    if (strlen($newPassword) < 6) {
        jsonResponse(['error' => 'Mật khẩu mới phải có ít nhất 6 ký tự'], 400);
    }
    if ($currentPassword === $newPassword) {
        jsonResponse(['error' => 'Mật khẩu mới phải khác mật khẩu cũ'], 400);
    }

    $users = loadData('users');
    $found = false;
    foreach ($users as &$u) {
        if ($u['id'] === $auth['id']) {
            if (!password_verify($currentPassword, $u['password'])) {
                jsonResponse(['error' => 'Mật khẩu hiện tại không đúng'], 400);
            }
            $u['password'] = password_hash($newPassword, PASSWORD_BCRYPT);
            $u['passwordChangedAt'] = date('c');
            $found = true;
            break;
        }
    }
    unset($u);

    if (!$found) {
        jsonResponse(['error' => 'Không tìm thấy người dùng'], 404);
    }

    if (!saveData('users', $users)) {
        jsonResponse(['error' => 'Lỗi hệ thống, vui lòng thử lại'], 500);
    }

    jsonResponse(['success' => true, 'message' => 'Đổi mật khẩu thành công!']);
}

// ── Assign Class (Staff xếp lớp + phân giáo viên thủ công) ──
if (($parts[0] ?? '') === 'assign-class') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = requireRole(['ADMIN', 'STAFF']);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $classId = $input['classId'] ?? '';
    $oldClassId = $input['oldClassId'] ?? '';

    if (!$studentId || !$classId) {
        jsonResponse(['error' => 'Thiếu studentId hoặc classId'], 400);
    }

    // Verify class exists
    $classes = loadData('classes');
    $targetClass = null;
    foreach ($classes as &$cl) {
        if ($cl['id'] === $classId) { $targetClass = &$cl; break; }
    }
    unset($cl);
    if (!$targetClass) jsonResponse(['error' => 'Không tìm thấy lớp học'], 404);

    // Check max_students
    $currentCount = count($targetClass['student_ids'] ?? []);
    $maxStudents = (int)($targetClass['max_students'] ?? 20);
    if ($currentCount >= $maxStudents && !in_array($studentId, $targetClass['student_ids'] ?? [])) {
        jsonResponse(['error' => 'Lớp đã đầy ('.$currentCount.'/'.$maxStudents.')'], 400);
    }

    // ── Kiểm tra tương thích hạng: học viên BVLOS không thể vào lớp VLOS và ngược lại ──
    $student = findUserById($studentId);
    if ($student) {
        $getEffectiveRank = function($rank, $courseId) {
            if ($rank === 'A' || $rank === 'B') return $rank;
            if ($courseId === 'c001') return 'A';
            if ($courseId === 'c002' || $courseId === 'c003') return 'B';
            return '';
        };
        $classRank = $getEffectiveRank($targetClass['rank'] ?? '', $targetClass['course_id'] ?? '');
        $studentRank = $getEffectiveRank($student['rank'] ?? '', $student['courseId'] ?? '');
        if ($classRank && $studentRank && $classRank !== $studentRank) {
            $rankLabel = function($r) { return $r === 'A' ? 'VLOS' : ($r === 'B' ? 'BVLOS' : $r); };
            jsonResponse([
                'error' => 'Không thể xếp: học viên đăng ký hạng ' . $studentRank . ' (' . $rankLabel($studentRank) . ') vào lớp hạng ' . $classRank . ' (' . $rankLabel($classRank) . ')'
            ], 400);
        }
    }

    // Remove from ALL old classes (đảm bảo mỗi học viên chỉ thuộc 1 lớp duy nhất)
    foreach ($classes as &$cl) {
        if ($cl['id'] === $classId) continue; // skip target class
        $cl['student_ids'] = array_values(array_filter($cl['student_ids'] ?? [], fn($sid) => $sid !== $studentId));
    }
    unset($cl);

    // Add to new class
    if (!in_array($studentId, $targetClass['student_ids'] ?? [])) {
        $targetClass['student_ids'][] = $studentId;
    }

    if (!saveData('classes', $classes)) {
        jsonResponse(['error' => 'Lỗi hệ thống khi lưu lớp'], 500);
    }

    // Update enrollment
    $enrollments = loadData('enrollments');
    $found = false;
    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $studentId) {
            $enr['class_id'] = $classId;
            $found = true;
            break;
        }
    }
    unset($enr);
    if (!$found) {
        // Create enrollment if not exists
        $student = findUserById($studentId);
        $enrollments[] = [
            'student_id' => $studentId,
            'class_id' => $classId,
            'course_id' => $student['courseId'] ?? '',
            'status' => 'active',
            'confirmed_by' => $auth['id'],
            'confirmed_at' => date('c'),
            'stages' => [
                'enrollment' => ['status' => 'completed', 'completed_at' => date('c'), 'confirmed_by' => $auth['id']],
            ],
        ];
    }
    if (!saveData('enrollments', $enrollments)) {
        jsonResponse(['error' => 'Lỗi hệ thống khi lưu enrollment'], 500);
    }

    // Update tuition step
    $tuitions = loadData('tuitions');
    foreach ($tuitions as &$t) {
        if (($t['studentId'] ?? '') === $studentId) {
            $t['step'] = 'enrolled';
            $t['status'] = 'paid';
            $t['classId'] = $classId;
            $t['className'] = $targetClass['name'] ?? '';
            break;
        }
    }
    unset($t);
    saveData('tuitions', $tuitions);

    jsonResponse([
        'success' => true,
        'message' => 'Đã xếp học viên vào lớp '.($targetClass['name'] ?? $classId),
        'class' => ['id' => $classId, 'name' => $targetClass['name'] ?? '', 'studentCount' => count($targetClass['student_ids'])],
    ]);
}

// ── Users CRUD ──
if (($parts[0] ?? '') === 'users' || (($parts[0] ?? '') === 'auth' && ($parts[1] ?? '') === 'users')) {
    $idIdx = ($parts[0] === 'auth') ? 2 : 1;
    $userId = $parts[$idIdx] ?? null;

    if ($method === 'GET' && !$userId) {
        requireRole(['ADMIN', 'STAFF']);
        jsonResponse(['users' => array_map('sanitizeUser', loadData('users'))]);
    }
    if ($method === 'GET' && $userId) {
        requireRole(['ADMIN', 'STAFF']);
        $u = findUserById($userId);
        if (!$u) jsonResponse(['error' => 'Không tìm thấy người dùng'], 404);
        jsonResponse(sanitizeUser($u));
    }
    if ($method === 'POST' && !$userId) {
        $auth = requireRole(['ADMIN', 'STAFF']);
        $input = jsonInput();
        if (!$input['email'] || !$input['password'] || !$input['fullName']) jsonResponse(['error' => 'Thiếu thông tin'], 400);
        if (findUserByEmail($input['email'])) jsonResponse(['error' => 'Email đã tồn tại'], 409);
        $nu = [
            'id' => genId('u-'),
            'email' => $input['email'],
            'password' => password_hash($input['password'], PASSWORD_BCRYPT),
            'role' => in_array($input['role'] ?? '', ['ADMIN', 'STAFF', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'AGENCY'])
                ? $input['role'] : 'STUDENT',
            'fullName' => $input['fullName'],
            'phone' => $input['phone'] ?? '',
            'status' => ($auth['role'] === 'ADMIN') ? 'ACTIVE' : 'PENDING',
            'courseId' => $input['courseId'] ?? '',
            'rank' => $input['rank'] ?? '',
            'agencyId' => $input['agencyId'] ?? '',
            'address' => $input['address'] ?? '',
            'notes' => $input['notes'] ?? '',
            'createdAt' => date('c'),
        ];
        $users = loadData('users'); $users[] = $nu; saveData('users', $users);
        jsonResponse(['user' => sanitizeUser($nu)], 201);
    }
    if ($method === 'PUT' && $userId) {
        $auth = authenticate();
        $input = jsonInput(); $users = loadData('users'); $found = false;

        // ── Phân quyền: user tự sửa fullName/phone của chính mình ──
        $isSelfEdit = $auth && $auth['id'] === $userId;
        $isAdminStaff = $auth && in_array($auth['role'], ['ADMIN', 'STAFF']);

        if (!$isSelfEdit && !$isAdminStaff) {
            jsonResponse(['error' => 'Forbidden'], 403);
        }

        foreach ($users as &$u) {
            if ($u['id'] === $userId) {
                // User tự sửa: chỉ được sửa fullName và phone
                if ($isSelfEdit && !$isAdminStaff) {
                    if (isset($input['fullName'])) $u['fullName'] = $input['fullName'];
                    if (isset($input['phone'])) $u['phone'] = $input['phone'];
                }
                // Admin/Staff: được sửa tất cả
                if ($isAdminStaff) {
                    if (isset($input['fullName'])) $u['fullName'] = $input['fullName'];
                    if (isset($input['email'])) {
                        // Kiểm tra email không trùng với user khác
                        $emailExists = false;
                        foreach ($users as $other) {
                            if ($other['id'] !== $userId && strtolower($other['email'] ?? '') === strtolower($input['email'])) {
                                jsonResponse(['error' => 'Email đã được sử dụng bởi tài khoản khác'], 409);
                            }
                        }
                        $u['email'] = $input['email'];
                    }
                    if (isset($input['role']) && in_array($input['role'], ['ADMIN', 'STAFF', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'AGENCY']))
                        $u['role'] = $input['role'];
                    if (isset($input['status'])) $u['status'] = $input['status'];
                    if (isset($input['phone'])) $u['phone'] = $input['phone'];
                    if (isset($input['courseId'])) $u['courseId'] = $input['courseId'];
                    if (isset($input['rank'])) $u['rank'] = $input['rank'];
                    if (isset($input['agencyId'])) $u['agencyId'] = $input['agencyId'];
                    if (isset($input['address'])) $u['address'] = $input['address'];
                    if (isset($input['notes'])) $u['notes'] = $input['notes'];
                    if (!empty($input['password'])) $u['password'] = password_hash($input['password'], PASSWORD_BCRYPT);
                }
                $found = true; saveData('users', $users); jsonResponse(['user' => sanitizeUser($u)]); break;
            }
        } unset($u);
        if (!$found) jsonResponse(['error' => 'Không tìm thấy người dùng'], 404);
    }
    if ($method === 'DELETE' && $userId) {
        $auth = requireRole(['ADMIN']);
        if ($userId === $auth['id']) jsonResponse(['error' => 'Không thể xóa chính mình'], 400);

        $deletedUser = findUserById($userId);
        if (!$deletedUser) jsonResponse(['error' => 'Không tìm thấy người dùng'], 404);

        // ── Cascade delete: xóa sạch toàn bộ dữ liệu liên quan ──
        $cascade = [];

        // 1. Enrollments
        $enrollments = loadData('enrollments');
        $beforeEnr = count($enrollments);
        $enrollments = array_values(array_filter($enrollments, fn($e) => ($e['student_id'] ?? '') !== $userId));
        $cascade['enrollments_removed'] = $beforeEnr - count($enrollments);
        saveData('enrollments', $enrollments);

        // 2. Tuitions
        $tuitions = loadData('tuitions');
        $beforeTuit = count($tuitions);
        $tuitions = array_values(array_filter($tuitions, fn($t) => ($t['studentId'] ?? '') !== $userId));
        $cascade['tuitions_removed'] = $beforeTuit - count($tuitions);
        saveData('tuitions', $tuitions);

        // 3. Classes — remove user from student_ids
        $classes = loadData('classes');
        $classesFixed = 0;
        foreach ($classes as &$cl) {
            $before = count($cl['student_ids'] ?? []);
            $cl['student_ids'] = array_values(array_filter($cl['student_ids'] ?? [], fn($sid) => $sid !== $userId));
            if (count($cl['student_ids']) < $before) $classesFixed++;
        }
        unset($cl);
        saveData('classes', $classes);
        $cascade['classes_cleaned'] = $classesFixed;

        // 4. Remove user as teacher from classes
        $classes = loadData('classes');
        $teacherCleaned = 0;
        foreach ($classes as &$cl) {
            $teacherIds = $cl['teacher_ids'] ?? [];
            if (in_array($userId, $teacherIds)) {
                $cl['teacher_ids'] = array_values(array_filter($teacherIds, fn($tid) => $tid !== $userId));
                $teacherCleaned++;
            }
        }
        unset($cl);
        if ($teacherCleaned > 0) {
            saveData('classes', $classes);
            $cascade['teacher_classes_cleaned'] = $teacherCleaned;
        }

        // 5. Fly logs
        $flyLogs = loadData('fly_logs');
        $beforeFly = count($flyLogs);
        $flyLogs = array_values(array_filter($flyLogs, fn($f) => ($f['student_id'] ?? '') !== $userId && ($f['logged_by'] ?? '') !== $userId));
        $cascade['fly_logs_removed'] = $beforeFly - count($flyLogs);
        saveData('fly_logs', $flyLogs);

        // 6. Exam results
        $examResults = loadData('exam_results');
        $beforeExam = count($examResults);
        $examResults = array_values(array_filter($examResults, fn($r) => ($r['student_id'] ?? '') !== $userId));
        $cascade['exam_results_removed'] = $beforeExam - count($examResults);
        saveData('exam_results', $examResults);

        // 7. Attendance
        $attendance = loadData('attendance');
        $beforeAtt = count($attendance);
        $attendance = array_values(array_filter($attendance, fn($a) => ($a['student_id'] ?? '') !== $userId && ($a['teacher_id'] ?? '') !== $userId));
        $cascade['attendance_removed'] = $beforeAtt - count($attendance);
        saveData('attendance', $attendance);

        // 8. Change requests
        $changeReqs = loadData('change_requests');
        $beforeCR = count($changeReqs);
        $changeReqs = array_values(array_filter($changeReqs, fn($r) => ($r['studentId'] ?? '') !== $userId));
        $cascade['change_requests_removed'] = $beforeCR - count($changeReqs);
        saveData('change_requests', $changeReqs);

        // 9. Payment receipts
        $receipts = loadData('payment_receipts');
        $beforeRcp = count($receipts);
        $receipts = array_values(array_filter($receipts, fn($r) => ($r['studentId'] ?? '') !== $userId));
        $cascade['payment_receipts_removed'] = $beforeRcp - count($receipts);
        saveData('payment_receipts', $receipts);

        // 10. Certifications
        $certifications = loadData('certifications');
        $beforeCert = count($certifications);
        $certifications = array_values(array_filter($certifications, fn($c) => ($c['student_id'] ?? '') !== $userId));
        $cascade['certifications_removed'] = $beforeCert - count($certifications);
        saveData('certifications', $certifications);

        // 11. Exams — update/remove from manual exam results
        $exams = loadData('exams');
        $examsCleaned = 0;
        foreach ($exams as &$ex) {
            if (!empty($ex['results'])) {
                $before = count($ex['results']);
                $ex['results'] = array_values(array_filter($ex['results'], fn($r) => ($r['student_id'] ?? '') !== $userId));
                if (count($ex['results']) < $before) $examsCleaned++;
            }
        }
        unset($ex);
        if ($examsCleaned > 0) {
            saveData('exams', $exams);
            $cascade['exams_cleaned'] = $examsCleaned;
        }

        // 12. Cleanup registrations (cho phép đăng ký lại với cùng email/phone)
        $registrations = loadData('registrations');
        $regBefore = count($registrations);
        $registrations = array_values(array_filter($registrations, function($r) use ($userId, $deletedUser) {
            $regEmail = $r['email'] ?? '';
            $regPhone = $r['phone'] ?? '';
            $userEmail = $deletedUser['email'] ?? '';
            $userPhone = $deletedUser['phone'] ?? '';
            // Xóa registration nếu trùng email hoặc phone với user bị xóa
            if ($regEmail && strtolower($regEmail) === strtolower($userEmail)) return false;
            if ($regPhone && $regPhone === $userPhone) return false;
            return true;
        }));
        $cascade['registrations_removed'] = $regBefore - count($registrations);
        saveData('registrations', $registrations);

        // 13. Cleanup password resets
        $pwResets = loadData('password_resets');
        $pwBefore = count($pwResets);
        $pwResets = array_values(array_filter($pwResets, fn($pr) => ($pr['email'] ?? '') !== $deletedUser['email']));
        $cascade['password_resets_removed'] = $pwBefore - count($pwResets);
        saveData('password_resets', $pwResets);

        // 14. Finally, remove the user
        $users = array_values(array_filter(loadData('users'), fn($u) => $u['id'] !== $userId));
        saveData('users', $users);
        $cascade['user_removed'] = true;

        jsonResponse([
            'success' => true,
            'message' => 'Đã xóa người dùng và toàn bộ dữ liệu liên quan',
            'cascade' => $cascade,
        ]);
    }
}

// ── Unified Payment Processing (NEW — thay thế approve-student, partial-approve, confirm-payment) ──
// POST /api/auth.php?action=admin/process-payment
// Body: { studentId*, totalAmount*, paidAmount?, paymentMethod?, note?, courseId?, dueDays?, activationThreshold? }
// v5: Thêm rate limit cho mutation endpoint quan trọng
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'process-payment') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = requireRole(['ADMIN', 'STAFF', 'ACCOUNTANT']); // v5: cho phép ACCOUNTANT
    rateLimit('process_payment:' . getClientIP(), 100, 60, 'Quá nhiều thao tác xử lý thanh toán');
    $input = jsonInput();
    $result = processPaymentInternal($input, $auth);
    if (isset($result['error'])) {
        jsonResponse($result, $result['code'] ?? 500);
    }
    jsonResponse($result);
}

// =====================================================================
// ACTION: admin/approve-transaction (v5 — Admin duyệt lần cuối)
// Admin duyệt transaction đã được Kế toán xác nhận (accountant_confirmed)
// hoặc bypass duyệt thẳng từ staff_confirmed/pending
// POST Body: { transactionId*, note?, bypass? }
// =====================================================================
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'approve-transaction') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = requireRole(['ADMIN']);
    rateLimit('approve_txn:' . getClientIP(), 100, 60, 'Quá nhiều thao tác duyệt giao dịch');

    $input = jsonInput();
    $transactionId = $input['transactionId'] ?? '';
    $note = $input['note'] ?? '';
    $bypass = $input['bypass'] ?? false;

    if (!$transactionId) jsonResponse(['error' => 'Thiếu transactionId'], 400);

    // Find transaction
    $transactions = loadData('transactions');
    $txnIdx = null;
    foreach ($transactions as $i => $txn) {
        if ($txn['id'] === $transactionId) { $txnIdx = $i; break; }
    }
    if ($txnIdx === null) jsonResponse(['error' => 'Không tìm thấy giao dịch'], 404);

    $txn = $transactions[$txnIdx];
    if ($txn['status'] === 'confirmed') jsonResponse(['error' => 'Giao dịch đã được duyệt trước đó'], 400);
    if ($txn['status'] === 'rejected') jsonResponse(['error' => 'Giao dịch đã bị từ chối, không thể duyệt'], 400);

    // Cho phép duyệt: accountant_confirmed (luồng chuẩn) hoặc staff_confirmed/pending (bypass)
    $validStatuses = $bypass ? ['pending', 'staff_confirmed', 'accountant_confirmed'] : ['accountant_confirmed'];
    if (!in_array($txn['status'], $validStatuses)) {
        jsonResponse(['error' => 'Giao dịch không ở trạng thái có thể duyệt cuối (hiện tại: ' . $txn['status'] . '). ' . ($bypass ? '' : 'Cần Kế toán duyệt trước hoặc dùng bypass.')], 400);
    }

    $now = date('c');

    // Update transaction → confirmed
    $transactions[$txnIdx]['status'] = 'confirmed';
    $transactions[$txnIdx]['approvalLevel'] = $bypass ? 'admin_bypass' : 'admin_final';
    $transactions[$txnIdx]['approvedBy'] = $auth['id'];
    $transactions[$txnIdx]['approvedAt'] = $now;
    $transactions[$txnIdx]['confirmedBy'] = $auth['id'];
    $transactions[$txnIdx]['confirmedAt'] = $now;
    if ($note) $transactions[$txnIdx]['adminNote'] = $note;
    saveData('transactions', $transactions);

    // Update invoice
    $invoices = loadData('invoices');
    $invIdx = null;
    foreach ($invoices as $i => $inv) {
        if ($inv['id'] === ($txn['invoiceId'] ?? '')) { $invIdx = $i; break; }
    }

    $invoice = null;
    if ($invIdx !== null) {
        $invoice = $invoices[$invIdx];
        $invoices[$invIdx]['totalPaid'] = (int)($invoice['totalPaid'] ?? 0) + (int)($txn['amount'] ?? 0);
        $bp = (int)($invoice['basePrice'] ?? 0);
        $invoices[$invIdx]['remainingDue'] = max(0, $bp - $invoices[$invIdx]['totalPaid']);
        $invoices[$invIdx]['status'] = $invoices[$invIdx]['totalPaid'] >= $bp ? 'paid' : 'partial';
        $invoices[$invIdx]['updatedAt'] = $now;
        $invoice = $invoices[$invIdx];
        saveData('invoices', $invoices);
    }

    // KÍCH HOẠT tài khoản học viên
    $users = loadData('users');
    $studentActivated = false;
    foreach ($users as &$u) {
        if ($u['id'] === ($txn['studentId'] ?? '')) {
            if (($u['status'] ?? '') !== 'ACTIVE') {
                $u['status'] = 'ACTIVE';
                $u['activatedBy'] = $auth['id'];
                $u['activatedAt'] = $now;
                $studentActivated = true;
            }
            break;
        }
    }
    unset($u);
    saveData('users', $users);

    // Sync enrollment
    if ($invIdx !== null && $invoice) {
        $enrollments = loadData('enrollments');
        $studentId = $txn['studentId'] ?? '';
        $courseId = $invoice['courseId'] ?? '';
        $courseName = $invoice['courseName'] ?? '';
        $bp = (int)($invoice['basePrice'] ?? 0);

        $hasEnr = false;
        foreach ($enrollments as &$enr) {
            if (($enr['student_id'] ?? '') === $studentId) {
                $hasEnr = true;
                $enr['payment'] = [
                    'amount' => $bp,
                    'paid' => $invoices[$invIdx]['totalPaid'],
                    'status' => $invoices[$invIdx]['status'] === 'paid' ? 'paid' : 'partial',
                    'method' => $txn['method'] ?? '',
                    'date' => $now,
                    'confirmed_by' => $auth['id'],
                ];
                $enr['status'] = 'active';
                $enr['confirmed_by'] = $auth['id'];
                $enr['confirmed_at'] = $now;
                if (empty($enr['stages']['enrollment']) || ($enr['stages']['enrollment']['status'] ?? '') !== 'completed') {
                    $enr['stages']['enrollment'] = ['status' => 'completed', 'completed_at' => $now, 'confirmed_by' => $auth['id']];
                }
                break;
            }
        }
        unset($enr);

        if (!$hasEnr) {
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
                    'amount' => $bp,
                    'paid' => $invoices[$invIdx]['totalPaid'],
                    'status' => $invoices[$invIdx]['status'] === 'paid' ? 'paid' : 'partial',
                    'method' => $txn['method'] ?? '',
                    'date' => $now,
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
        }
        saveData('enrollments', $enrollments);
    }

    jsonResponse([
        'success' => true,
        'message' => $bypass ? 'Admin đã duyệt thẳng & kích hoạt tài khoản (bypass Kế toán)!' : 'Admin đã duyệt lần cuối! Tài khoản đã được kích hoạt.',
        'data' => [
            'transaction' => $transactions[$txnIdx],
            'studentActivated' => $studentActivated,
        ],
    ]);
}

// ── Update enrollment stage (Teacher/Staff/Admin cập nhật tiến độ) ──
// POST /api/update-stage  Body: { studentId*, stage*, status*, confirmedBy? }
if (($parts[0] ?? '') === 'update-stage') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = requireRole(['ADMIN', 'STAFF', 'TEACHER']);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $stage = $input['stage'] ?? '';
    $status = $input['status'] ?? 'completed';
    $confirmedBy = $input['confirmedBy'] ?? $auth['id'];

    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);
    if (!$stage) jsonResponse(['error' => 'Thiếu stage (theory|practice|exam|certification)'], 400);

    $validStages = ['enrollment', 'theory', 'practice', 'exam', 'certification'];
    if (!in_array($stage, $validStages)) {
        jsonResponse(['error' => 'Stage không hợp lệ. Chọn: ' . implode(', ', $validStages)], 400);
    }
    $validStatuses = ['pending', 'in_progress', 'completed'];
    if (!in_array($status, $validStatuses)) {
        jsonResponse(['error' => 'Status không hợp lệ. Chọn: ' . implode(', ', $validStatuses)], 400);
    }

    $enrollments = loadData('enrollments');
    $found = false;
    $now = date('c');

    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $studentId) {
            if (!isset($enr['stages'])) $enr['stages'] = [];
            $oldStatus = $enr['stages'][$stage]['status'] ?? 'pending';

            // ── RÀNG BUỘC LOGIC STAGE: không thể skip bước ──
            if ($status === 'completed') {
                $stageOrder = ['enrollment', 'theory', 'practice', 'exam', 'certification'];
                $currentIdx = array_search($stage, $stageOrder);
                if ($currentIdx === false) {
                    jsonResponse(['error' => 'Stage không hợp lệ'], 400);
                }
                // Kiểm tra tất cả stage trước đó đã completed chưa
                for ($i = 0; $i < $currentIdx; $i++) {
                    $prevStage = $stageOrder[$i];
                    $prevStatus = $enr['stages'][$prevStage]['status'] ?? 'pending';
                    if ($prevStatus !== 'completed') {
                        jsonResponse([
                            'error' => 'Không thể hoàn thành "' . $stage . '" khi chưa hoàn thành "' . $prevStage . '". Vui lòng hoàn thành các bước theo đúng thứ tự: ' . implode(' → ', $stageOrder),
                            'code' => 'STAGE_LOCKED',
                            'lockedBy' => $prevStage,
                        ], 400);
                    }
                }
            }

            $enr['stages'][$stage] = [
                'status' => $status,
                'completed_at' => $status === 'completed' ? $now : ($enr['stages'][$stage]['completed_at'] ?? null),
                'confirmed_by' => $confirmedBy,
                'updated_at' => $now,
            ];

            // ── Tự động tạo chứng chỉ nếu tất cả stages completed ──
            $allCompleted = true;
            foreach ($validStages as $s) {
                $st = $enr['stages'][$s]['status'] ?? 'pending';
                if ($st !== 'completed') { $allCompleted = false; break; }
            }
            $certCreated = false;
            if ($allCompleted) {
                $certs = loadData('certifications');
                $existingCertId = null;
                foreach ($certs as $ci => $cert) {
                    if (($cert['student_id'] ?? '') === $studentId) {
                        $existingCertId = $ci;
                        break;
                    }
                }
                if ($existingCertId === null) {
                    $studentData = null;
                    $users = loadData('users');
                    foreach ($users as $u) { if ($u['id'] === $studentId) { $studentData = $u; break; } }
                    $courseId = $enr['course_id'] ?? ($studentData['courseId'] ?? '');
                    $courseName = $enr['course_name'] ?? '';
                    $certNumber = 'SMC-' . date('Y') . '-' . strtoupper(bin2hex(random_bytes(3))) . '-' . substr($studentId, -4);
                    $certs[] = [
                        'id' => 'cert-' . bin2hex(random_bytes(6)),
                        'student_id' => $studentId,
                        'student_name' => $studentData['fullName'] ?? '',
                        'course_id' => $courseId,
                        'course_name' => $courseName,
                        'cert_number' => $certNumber,
                        'issue_date' => $now,
                        'expiry_date' => date('c', strtotime('+2 years')),
                        'status' => 'active',
                        'issued_by' => $auth['id'],
                        'createdAt' => $now,
                    ];
                    saveData('certifications', $certs);
                    $certCreated = true;
                }
            }

            $found = true;
            break;
        }
    }
    unset($enr);

    if (!$found) jsonResponse(['error' => 'Không tìm thấy enrollment của học viên này'], 404);

    if (!saveData('enrollments', $enrollments)) {
        jsonResponse(['error' => 'Lỗi hệ thống khi lưu'], 500);
    }

    jsonResponse([
        'success' => true,
        'message' => "Đã cập nhật stage {$stage} → {$status}" . ($certCreated ? ' & tự động cấp chứng chỉ!' : ''),
        'stage' => $stage,
        'status' => $status,
        'allCompleted' => $allCompleted ?? false,
        'certCreated' => $certCreated,
    ]);
}

// ── Approve student registration (DEPRECATED — wrapper gọi processPaymentInternal) ──
if (($parts[0] ?? '') === 'approve-student') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    $userId = $parts[1] ?? null;
    if (!$userId) jsonResponse(['error' => 'Thiếu ID học viên'], 400);

    // Kiểm tra student hợp lệ trước khi gọi processPaymentInternal
    $users = loadData('users');
    $student = null;
    foreach ($users as $u) { if ($u['id'] === $userId) { $student = $u; break; } }
    if (!$student) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);
    if ($student['role'] !== 'STUDENT') jsonResponse(['error' => 'Người dùng không phải học viên'], 400);
    if ($student['status'] === 'ACTIVE') jsonResponse(['error' => 'Tài khoản đã được duyệt trước đó'], 400);

    // Lấy coursePrice từ khóa học của học viên
    $courses = loadData('courses');
    $coursePrice = 0;
    $studentCourseId = $student['courseId'] ?? '';
    if ($studentCourseId) {
        foreach ($courses as $c) {
            if ($c['id'] === $studentCourseId) {
                $coursePrice = (int)($c['price'] ?? 0);
                break;
            }
        }
    }

    // Gọi unified endpoint với activationThreshold=0 (kích hoạt vô điều kiện, tương thích cũ)
    // LƯU Ý: paidAmount=0 sẽ KHÔNG tạo transaction (tránh giao dịch rỗng amount=0)
    $result = processPaymentInternal([
        'studentId' => $userId,
        'totalAmount' => $coursePrice,  // dùng giá khóa học làm totalAmount
        'paidAmount' => 0,                          // không tạo transaction nếu = 0
        'paymentMethod' => 'cash',
        'note' => 'Duyệt không thu phí (approve-student)',
        'activationThreshold' => 0,
        'exempt' => true,                           // cho phép amount=0 (duyệt miễn phí)
    ], $auth);

    if (isset($result['error'])) {
        jsonResponse($result, $result['code'] ?? 500);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Đã duyệt tài khoản học viên',
        'enrollment_created' => !($result['enrollment']['created'] ?? true),
        'email_sent' => $result['email']['sent'] ?? false,
        'email_error' => $result['email']['error'] ?? null,
    ]);
}

// ── Generic CRUD handler for any collection ──
function handleCRUD($collection, $allowedRoles = ['ADMIN', 'STAFF'], $publicGet = false) {
    global $method, $parts;
    $idIdx = ($parts[0] === 'auth') ? 2 : 1;
    $itemId = $parts[$idIdx] ?? null;

    if ($method === 'GET' && !$itemId) {
        if (!$publicGet) requireRole($allowedRoles);

        // Auto-cleanup orphan data cho các collection có user reference
        $userRefCollections = ['enrollments', 'fly_logs', 'exam_results', 'attendance',
            'change_requests', 'payment_receipts', 'certifications'];
        if (in_array($collection, $userRefCollections)) {
            $items = loadData($collection);
            $before = count($items);
            $allUsers = loadData('users');
            $validUserIds = [];
            foreach ($allUsers as $u) { $validUserIds[$u['id']] = true; }
            $items = array_values(array_filter($items, function($item) use ($validUserIds) {
                $uid = isset($item['student_id']) ? $item['student_id'] : (isset($item['studentId']) ? $item['studentId'] : (isset($item['logged_by']) ? $item['logged_by'] : (isset($item['teacher_id']) ? $item['teacher_id'] : '')));
                if (empty($uid)) return true;
                return isset($validUserIds[$uid]);
            }));
            if (count($items) < $before) { saveData($collection, $items); }
            jsonResponse($items);
        }

        jsonResponse(loadData($collection));
    }
    if ($method === 'GET' && $itemId) {
        if (!$publicGet) requireRole($allowedRoles);
        $items = loadData($collection);
        foreach ($items as $item) {
            $matchKey = ($collection === 'enrollments') ? ($item['student_id'] ?? null) : ($item['id'] ?? null);
            if ($matchKey === $itemId) { jsonResponse($item); }
        }
        jsonResponse(['error' => 'Not found'], 404);
    }
    if ($method === 'POST' && !$itemId) {
        requireRole($allowedRoles);
        // Rate limit: 30 POST requests per IP per 60 giây
        rateLimit('crud_post:' . getClientIP(), 100, 60, 'Quá nhiều thao tác tạo mới');
        $input = jsonInput();

        // Field whitelist — chống mass assignment
        $allowedFields = [
            'courses' => ['name', 'price', 'description', 'duration', 'minFlyHours', 'category', 'status', 'syllabus'],
            'classes' => ['name', 'courseId', 'teacherId', 'student_ids', 'schedule', 'room', 'status', 'startDate', 'endDate'],
            'agencies' => ['name', 'code', 'contactPerson', 'phone', 'email', 'address', 'discountPercent', 'status', 'note'],
            'enrollments' => ['student_id', 'course_id', 'course_name', 'status', 'payment_status', 'stage', 'teacher_id', 'notes'],
        ];
        $whitelist = $allowedFields[$collection] ?? null;
        if ($whitelist !== null) {
            $input = array_intersect_key($input, array_flip($whitelist));
        }

        $input['id'] = $input['id'] ?? genId(substr($collection, 0, 1) . '-');
        $input['createdAt'] = $input['createdAt'] ?? date('c');
        $items = loadData($collection); $items[] = $input;
        saveData($collection, $items);
        jsonResponse($input, 201);
    }
    if ($method === 'PUT' && $itemId) {
        requireRole($allowedRoles);
        // Rate limit: 60 PUT requests per IP per 60 giây
        rateLimit('crud_put:' . getClientIP(), 100, 60, 'Quá nhiều thao tác cập nhật');
        $input = jsonInput();

        // Field whitelist — chống mass assignment (cho PUT cũng áp dụng)
        $allowedFields = [
            'courses' => ['name', 'price', 'description', 'duration', 'minFlyHours', 'category', 'status', 'syllabus'],
            'classes' => ['name', 'courseId', 'teacherId', 'student_ids', 'schedule', 'room', 'status', 'startDate', 'endDate'],
            'agencies' => ['name', 'code', 'contactPerson', 'phone', 'email', 'address', 'discountPercent', 'status', 'note'],
            'enrollments' => ['student_id', 'course_id', 'course_name', 'status', 'payment_status', 'stage', 'teacher_id', 'notes'],
        ];
        $whitelist = $allowedFields[$collection] ?? null;
        if ($whitelist !== null) {
            $input = array_intersect_key($input, array_flip($whitelist));
        }

        $items = loadData($collection); $found = false;
        foreach ($items as &$item) {
            // enrollment dùng student_id làm khóa, không có field id
            $matchKey = ($collection === 'enrollments') ? ($item['student_id'] ?? null) : ($item['id'] ?? null);
            if ($matchKey === $itemId) {
                // ── Nếu đang update student_ids của class: kiểm tra không trùng với lớp khác ──
                if ($collection === 'classes' && isset($input['student_ids']) && is_array($input['student_ids'])) {
                    $allClasses = $items; // dùng chính $items đã load
                    $newIds = $input['student_ids'];
                    foreach ($newIds as $sid) {
                        foreach ($allClasses as $otherCl) {
                            if ($otherCl['id'] === $itemId) continue;
                            if (in_array($sid, $otherCl['student_ids'] ?? [])) {
                                jsonResponse(['error' => 'Học viên '.$sid.' đã có trong lớp '.($otherCl['name'] ?? $otherCl['id']).'. Không thể xếp vào 2 lớp cùng lúc.'], 409);
                            }
                        }
                    }
                }
                foreach ($input as $k => $v) { if ($k !== 'id') $item[$k] = $v; }
                $found = true; saveData($collection, $items);

                // ── Nếu vừa POST/PUT fly_log → kiểm tra đủ giờ bay chưa → tự động complete stage practice ──
                if ($collection === 'fly_logs' && $method === 'POST') {
                    $sid = $item['student_id'] ?? $input['student_id'] ?? '';
                    if ($sid) {
                        $allFlyLogs = loadData('fly_logs');
                        $studentFlyMinutes = 0;
                        foreach ($allFlyLogs as $fl) {
                            if (($fl['student_id'] ?? '') === $sid) {
                                $studentFlyMinutes += (int)($fl['duration_minutes'] ?? 0);
                            }
                        }
                        // Lấy min_fly_hours từ course của student
                        $courses3 = loadData('courses');
                        $users3 = loadData('users');
                        $enr3 = loadData('enrollments');
                        $studentCourseId = '';
                        foreach ($users3 as $u) { if ($u['id'] === $sid) { $studentCourseId = $u['courseId'] ?? ''; break; } }
                        foreach ($enr3 as $e) { if (($e['student_id'] ?? '') === $sid && !$studentCourseId) { $studentCourseId = $e['course_id'] ?? ''; break; } }
                        $minFlyHours = 0;
                        foreach ($courses3 as $c) {
                            if ($c['id'] === $studentCourseId) { $minFlyHours = (int)($c['min_fly_hours'] ?? 0); break; }
                        }
                        $minFlyMinutes = $minFlyHours * 60;
                        if ($minFlyMinutes > 0 && $studentFlyMinutes >= $minFlyMinutes) {
                            $enrAll = loadData('enrollments');
                            foreach ($enrAll as &$e) {
                                if (($e['student_id'] ?? '') === $sid) {
                                    if (($e['stages']['practice']['status'] ?? '') !== 'completed') {
                                        $e['stages']['practice'] = [
                                            'status' => 'completed',
                                            'completed_at' => date('c'),
                                            'confirmed_by' => $auth['id'] ?? '',
                                            'fly_minutes' => $studentFlyMinutes,
                                        ];
                                        saveData('enrollments', $enrAll);
                                    }
                                    break;
                                }
                            }
                            unset($e);
                        }
                    }
                }

                jsonResponse($item); break;
            }
        } unset($item);
        if (!$found) jsonResponse(['error' => 'Not found'], 404);
    }
    if ($method === 'DELETE' && $itemId) {
        requireRole($allowedRoles);
        // Rate limit: 10 DELETE requests per IP per 60 giây
        rateLimit('crud_delete:' . getClientIP(), 30, 60, 'Quá nhiều thao tác xóa');
        $items = array_values(array_filter(loadData($collection), function($i) use ($collection, $itemId) {
            $matchKey = ($collection === 'enrollments') ? ($i['student_id'] ?? null) : ($i['id'] ?? null);
            return $matchKey !== $itemId;
        }));
        saveData($collection, $items);
        jsonResponse(['success' => true]);
    }
    exit;
}

// ── Data endpoints ──
$dataRoutes = ['courses', 'classes', 'enrollments', 'attendance', 'exams', 'fly_logs', 'certifications', 'tuitions', 'agencies', 'agency_commissions'];

foreach ($dataRoutes as $route) {
    $matches = ($parts[0] ?? '') === $route || (($parts[0] ?? '') === 'auth' && ($parts[1] ?? '') === $route);
    if ($matches) {
        // courses: public can GET; teacher can also do CRUD on exams, fly_logs
        $pubGet = in_array($route, ['courses', 'classes']);
        $roles = ['ADMIN', 'STAFF'];
        // TEACHER can manage exams, fly_logs, certifications, attendance, classes
        if (in_array($route, ['exams', 'fly_logs', 'certifications', 'attendance', 'classes'])) {
            $roles[] = 'TEACHER';
        }
        // STUDENT can GET classes (để xem lớp của mình)
        if ($route === 'classes' && $method === 'GET' && !($parts[$idIdx] ?? null)) {
            $pubGet = true;
        }
        handleCRUD($route, $roles, $pubGet);
    }
}

// ── Courses: also allow PUT/DELETE from API via direct /courses path ──

// ── exam_results CRUD ──
if (($parts[0] ?? '') === 'exam-results' || ($parts[0] ?? '') === 'exam_results') {
    if ($method === 'GET' && !($parts[1] ?? null)) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $results = loadData('exam_results');
        // Admin/Staff see all; Student sees own
        if (in_array($auth['role'], ['ADMIN', 'STAFF', 'TEACHER'])) {
            jsonResponse($results);
        } else {
            $mine = array_values(array_filter($results, fn($r) => ($r['student_id'] ?? '') === $auth['id']));
            jsonResponse($mine);
        }
    }
    if ($method === 'GET' && ($parts[1] ?? null)) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $results = loadData('exam_results');
        $mine = array_values(array_filter($results, fn($r) => ($r['student_id'] ?? '') === $auth['id'] || ($r['id'] ?? '') === $parts[1]));
        jsonResponse($mine);
    }
    if ($method === 'POST') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $sid = $auth['role'] === 'TEACHER' ? ($input['student_id'] ?? $auth['id']) : $auth['id'];
        $input['id'] = $input['id'] ?? 'exam-' . bin2hex(random_bytes(6));
        $input['submittedAt'] = date('c');
        $input['student_id'] = $sid;
        $results = loadData('exam_results'); $results[] = $input;
        saveData('exam_results', $results);

        // ── Tự động cập nhật stage exam nếu passed ──
        $passed = isset($input['passed']) ? (bool)$input['passed'] : (($input['score'] ?? 0) >= ($input['pass_score'] ?? 70));
        if ($passed) {
            $enrollments = loadData('enrollments');
            foreach ($enrollments as &$enr) {
                if (($enr['student_id'] ?? '') === $sid) {
                    if (!isset($enr['stages'])) $enr['stages'] = [];
                    $enr['stages']['exam'] = [
                        'status' => 'completed',
                        'completed_at' => date('c'),
                        'confirmed_by' => $auth['id'],
                        'score' => $input['score'] ?? null,
                    ];
                    break;
                }
            }
            unset($enr);
            saveData('enrollments', $enrollments);
        }

        jsonResponse(['success' => true, 'id' => $input['id'], 'stageUpdated' => $passed], 201);
    }
}

// ── change_requests CRUD ──
if (($parts[0] ?? '') === 'change-requests' || ($parts[0] ?? '') === 'change_requests') {
    if ($method === 'GET') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $reqs = loadData('change_requests');
        // Staff/Admin see all; student sees own
        if (in_array($auth['role'], ['ADMIN', 'STAFF', 'TEACHER'])) {
            jsonResponse($reqs);
        } else {
            $mine = array_values(array_filter($reqs, fn($r) => ($r['studentId'] ?? '') === $auth['id']));
            jsonResponse($mine);
        }
    }
    if ($method === 'POST') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $input['id'] = $input['id'] ?? 'cr-' . bin2hex(random_bytes(6));
        $input['studentId'] = $input['studentId'] ?? $auth['id'];
        $input['status'] = $input['status'] ?? 'pending';
        $input['createdAt'] = date('c');
        $reqs = loadData('change_requests'); $reqs[] = $input;
        saveData('change_requests', $reqs);
        jsonResponse(['success' => true, 'id' => $input['id']], 201);
    }
    if ($method === 'PUT' && ($parts[1] ?? null)) {
        requireRole(['ADMIN', 'STAFF']);
        $input = jsonInput();
        $reqs = loadData('change_requests');
        $found = false;
        foreach ($reqs as &$r) {
            if ($r['id'] === $parts[1]) {
                foreach ($input as $k => $v) { if ($k !== 'id') $r[$k] = $v; }
                $found = true; saveData('change_requests', $reqs); jsonResponse($r); break;
            }
        }
        unset($r);
        if (!$found) jsonResponse(['error' => 'Not found'], 404);
    }
}

// ── Payment receipts upload ──
if (($parts[0] ?? '') === 'payment-receipts' || ($parts[0] ?? '') === 'payment_receipts') {
    if ($method === 'POST') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $input['id'] = 'receipt-' . bin2hex(random_bytes(8));
        $input['studentId'] = $auth['id'];
        $input['submittedAt'] = date('c');
        $input['status'] = 'pending_review';
        $receipts = loadData('payment_receipts'); $receipts[] = $input;
        saveData('payment_receipts', $receipts);
        // Also update tuition record
        $tuitions = loadData('tuitions');
        $found = false;
        foreach ($tuitions as &$t) {
            if (($t['studentId'] ?? '') === $auth['id']) {
                $t['step'] = 'payment_review';
                $t['status'] = 'payment_review';
                $t['paymentMethod'] = $input['paymentMethod'] ?? 'bank_transfer';
                $t['paymentAmount'] = $input['paymentAmount'] ?? 0;
                $t['paymentReceipt'] = $input['paymentReceipt'] ?? null;
                $t['paymentNote'] = $input['paymentNote'] ?? '';
                $t['paymentSubmittedAt'] = date('c');
                $t['paymentHistory'] = array_merge($t['paymentHistory'] ?? [], [[
                    'date' => date('c'),
                    'amount' => $input['paymentAmount'] ?? 0,
                    'method' => $input['paymentMethod'] ?? 'bank_transfer',
                    'receipt' => $input['paymentReceipt'] ?? null,
                    'note' => $input['paymentNote'] ?? '',
                ]]);
                $found = true;
                break;
            }
        }
        unset($t);
        if (!$found) {
            $student = findUserById($auth['id']);
            $tuitions[] = [
                'id' => 'tuition-' . bin2hex(random_bytes(6)),
                'studentId' => $auth['id'],
                'studentName' => $student['fullName'] ?? '',
                'courseId' => $student['courseId'] ?? '',
                'step' => 'payment_review',
                'status' => 'payment_review',
                'paymentMethod' => $input['paymentMethod'] ?? 'bank_transfer',
                'paymentAmount' => $input['paymentAmount'] ?? 0,
                'paymentReceipt' => $input['paymentReceipt'] ?? null,
                'paymentNote' => $input['paymentNote'] ?? '',
                'paymentSubmittedAt' => date('c'),
                'paymentHistory' => [[
                    'date' => date('c'),
                    'amount' => $input['paymentAmount'] ?? 0,
                    'method' => $input['paymentMethod'] ?? 'bank_transfer',
                    'receipt' => $input['paymentReceipt'] ?? null,
                    'note' => $input['paymentNote'] ?? '',
                ]],
                'createdAt' => date('c'),
            ];
        }
        saveData('tuitions', $tuitions);
        jsonResponse(['success' => true, 'id' => $input['id']], 201);
    }
    if ($method === 'GET') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $receipts = loadData('payment_receipts');
        if (in_array($auth['role'], ['ADMIN', 'STAFF'])) {
            jsonResponse($receipts);
        } else {
            $mine = array_values(array_filter($receipts, fn($r) => ($r['studentId'] ?? '') === $auth['id']));
            jsonResponse($mine);
        }
    }
}

// ── Question bank sync ──
if (($parts[0] ?? '') === 'question-bank' || ($parts[0] ?? '') === 'question_bank') {
    if ($method === 'GET') {
        jsonResponse(loadData('question_bank'));
    }
    if ($method === 'POST') {
        requireRole(['ADMIN', 'STAFF', 'TEACHER']);
        $input = jsonInput();
        $items = is_array($input) ? $input : ($input['questions'] ?? []);

        // Validate: mỗi item phải có 'q', 'options' (array), 'answer' (int)
        foreach ($items as $idx => $item) {
            if (empty($item['q'])) {
                jsonResponse(['error' => "Câu hỏi #{$idx} thiếu trường 'q' (nội dung câu hỏi)"], 400);
            }
            if (!isset($item['options']) || !is_array($item['options']) || count($item['options']) < 2) {
                jsonResponse(['error' => "Câu hỏi #{$idx} thiếu 'options' (mảng đáp án, ít nhất 2 lựa chọn)"], 400);
            }
            if (!isset($item['answer']) || !is_int($item['answer'])) {
                jsonResponse(['error' => "Câu hỏi #{$idx} thiếu 'answer' (số nguyên — index của đáp án đúng)"], 400);
            }
        }

        saveData('question_bank', $items);
        jsonResponse(['success' => true, 'count' => count($items)]);
    }
}

// ── My tuition: học viên tự tra cứu học phí của mình ──
if (($parts[0] ?? '') === 'my-tuition' || (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-my')) {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    $tuitions = loadData('tuitions');
    $courses = loadData('courses');

    // Find student's tuition
    $myTuition = null;
    foreach ($tuitions as $t) {
        if (($t['studentId'] ?? '') === $auth['id']) {
            $myTuition = $t;
            break;
        }
    }

    if (!$myTuition) {
        // Return empty with defaults so frontend can still render
        jsonResponse(['success' => true, 'tuition' => null]);
    }

    // Enrich with course info (không còn dùng price từ course)
    $coursePrice = 0;
    $courseName = '';
    $courseId = $myTuition['courseId'] ?? '';
    foreach ($courses as $c) {
        if ($c['id'] === $courseId) {
            $courseName = $c['name'] ?? '';
            break;
        }
    }

    // amount: luôn dùng tuition.amount (kể cả 0 = miễn phí hoặc chưa có)
    $tuitionAmount = (int)($myTuition['amount'] ?? 0);
    $effectiveAmount = $tuitionAmount;

    $totalPaid = (int)($myTuition['partialAmount'] ?? $myTuition['paymentAmount'] ?? 0);
    if (($myTuition['status'] ?? '') === 'paid') {
        $totalPaid = $effectiveAmount;
    }

    jsonResponse([
        'success' => true,
        'tuition' => [
            'id' => $myTuition['id'] ?? '',
            'studentId' => $myTuition['studentId'] ?? $auth['id'],
            'studentName' => $myTuition['studentName'] ?? '',
            'courseId' => $courseId,
            'courseName' => $courseName,
            'amount' => $effectiveAmount,
            'partialAmount' => (int)($myTuition['partialAmount'] ?? 0),
            'paymentAmount' => $totalPaid,
            'status' => $myTuition['status'] ?? 'unpaid',
            'step' => $myTuition['step'] ?? 'pending',
            'paymentMethod' => $myTuition['paymentMethod'] ?? '',
            'paymentReceipt' => $myTuition['paymentReceipt'] ?? null,
            'paidDate' => $myTuition['paidDate'] ?? null,
            'dueDate' => $myTuition['dueDate'] ?? null,
            'paymentHistory' => $myTuition['paymentHistory'] ?? [],
            'note' => $myTuition['note'] ?? '',
            'confirmedBy' => $myTuition['confirmedBy'] ?? '',
        ]
    ]);
}

// ── Enrollments special: student can see own ──
if (($parts[0] ?? '') === 'my-enrollments') {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $all = loadData('enrollments');
    $mine = array_values(array_filter($all, fn($e) => ($e['student_id'] ?? '') === $auth['id']));
    jsonResponse($mine);
}

// ── Health check ──
if (($parts[0] ?? '') === 'health' || empty($parts[0])) {
    jsonResponse(['status' => 'ok', 'accounts' => count(loadData('users')), 'timestamp' => date('c'), 'server' => 'Mắt Bão Plesk']);
}

// ── Registration form submissions ──
if (($parts[0] ?? '') === 'registrations') {
    if ($method === 'POST') {
        $input = jsonInput();
        $email = trim($input['email'] ?? '');
        $phone = trim($input['phone'] ?? '');

        $incomingUserId = trim($input['userId'] ?? '');

        // ── Kiểm tra trùng lặp email/SĐT ──
        // 1. Kiểm tra trong users (tài khoản đã tạo)
        if ($email || $phone) {
            $users = loadData('users');
            foreach ($users as $u) {
                $uEmail = $u['email'] ?? '';
                $uPhone = $u['phone'] ?? '';
                $uStatus = $u['status'] ?? '';
                $uId = $u['id'] ?? '';

                // REJECTED → cho phép đăng ký lại
                if ($uStatus === 'REJECTED') continue;

                $emailMatch = $email && strtolower($uEmail) === strtolower($email);
                $phoneMatch = $phone && $uPhone === $phone;

                if ($emailMatch || $phoneMatch) {
                    // Nếu userId được gửi kèm và khớp với user này → đây là
                    // registration bổ sung cho user vừa được register() tạo
                    // → cho phép lưu, không chặn
                    if ($incomingUserId && $incomingUserId === $uId) {
                        // Cho phép: đây là user vừa tạo, đang bổ sung registration
                        continue;
                    }

                    if ($uStatus === 'ACTIVE') {
                        jsonResponse([
                            'success' => false,
                            'error' => 'Thông tin đã được đăng ký và duyệt. Vui lòng liên hệ trung tâm để được hỗ trợ.',
                            'code' => 'ALREADY_APPROVED',
                        ], 409);
                    }
                    if ($uStatus === 'PENDING') {
                        jsonResponse([
                            'success' => false,
                            'error' => 'Thông tin đã được đăng ký và đang chờ duyệt. Vui lòng chờ thông báo từ trung tâm.',
                            'code' => 'PENDING_APPROVAL',
                        ], 409);
                    }
                    if ($uStatus === 'FROZEN') {
                        jsonResponse([
                            'success' => false,
                            'error' => 'Thông tin đã được đăng ký. Tài khoản hiện đang tạm khóa, vui lòng liên hệ trung tâm.',
                            'code' => 'ACCOUNT_FROZEN',
                        ], 409);
                    }
                }
            }

            // 2. Kiểm tra trong registrations (đơn đăng ký chưa có tài khoản)
            $existingRegs = loadData('registrations');
            foreach ($existingRegs as $r) {
                $rEmail = $r['email'] ?? '';
                $rPhone = $r['phone'] ?? '';
                $rStatus = $r['status'] ?? '';

                // Đã xóa/hủy/từ chối → cho phép đăng ký lại
                if (in_array($rStatus, ['rejected', 'deleted', 'cancelled'])) continue;

                $emailMatch = $email && strtolower($rEmail) === strtolower($email);
                $phoneMatch = $phone && $rPhone === $phone;

                if ($emailMatch || $phoneMatch) {
                    jsonResponse([
                        'success' => false,
                        'error' => 'Thông tin đã được đăng ký. Vui lòng chờ trung tâm liên hệ hoặc gọi hotline 1900 638939.',
                        'code' => 'ALREADY_REGISTERED',
                    ], 409);
                }
            }
        }

        $input['id'] = 'reg-' . bin2hex(random_bytes(4));
        $input['submittedAt'] = date('c');
        $input['status'] = 'pending';
        // Liên kết với user vừa được tạo bởi register()
        if (empty($input['userId'])) {
            // Fallback: tìm user mới nhất khớp email/phone vừa được tạo (status PENDING)
            $users = loadData('users');
            foreach (array_reverse($users) as $u) {
                if (($u['status'] ?? '') === 'PENDING' && strtolower($u['email'] ?? '') === strtolower($email)) {
                    $input['userId'] = $u['id'];
                    break;
                }
            }
        }
        $regs = loadData('registrations'); $regs[] = $input;
        saveData('registrations', $regs);

        // ── Gửi email xác nhận "đã tiếp nhận đơn" ──
        $studentEmail = $email;
        if ($studentEmail && filter_var($studentEmail, FILTER_VALIDATE_EMAIL)) {
            $fullName = $input['fullName'] ?? 'Học viên';
            $courseName = $input['course'] ?? ($input['courseName'] ?? 'Chưa chọn');
            $regId = $input['id'];
            $supportPhone = '0902596999';

            $subject = str_replace(["\r", "\n"], '', "[SMC Training] Đã tiếp nhận đơn đăng ký - {$fullName}");
            $message = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin:0; padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding: 20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background: linear-gradient(135deg, #1a73e8, #1557b0); padding: 32px 40px; text-align:center;">
        <h1 style="color:#fff; margin:0; font-size:22px;">📋 Đã Tiếp Nhận Đơn Đăng Ký</h1>
    </td></tr>
    <tr><td style="padding: 32px 40px; color: #333;">
        <p style="font-size:16px; margin:0 0 8px;">Xin chào <strong>{$fullName}</strong>,</p>
        <p style="font-size:14px; line-height:1.7; color:#555;">
            Trung tâm SMC Training đã nhận được đơn đăng ký khóa học <strong>{$courseName}</strong> của bạn.
            Mã đơn: <strong>{$regId}</strong>.
        </p>
        <p style="font-size:14px; line-height:1.7; color:#555;">
            Nhân viên SMC sẽ liên hệ với bạn trong thời gian sớm nhất để hoàn tất thủ tục nhập học.
        </p>
        <p style="font-size:13px; color:#999; margin-top: 24px;">
            📞 Hotline: {$supportPhone}<br>
            📧 Email: support@smc-training.com<br>
            📍 Địa chỉ: 59 Nguyễn Thị Hoa, Xã Đất Đỏ, TP.HCM
        </p>
    </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
HTML;

            $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: SMC Training <no-reply@smc-training.com>";
            @mail($studentEmail, $subject, $message, $headers, '-f no-reply@smc-training.com');
        }

        jsonResponse(['success' => true, 'id' => $input['id']], 201);
    }
    if ($method === 'GET') {
        requireRole(['ADMIN', 'STAFF']);
        // Auto-cleanup: lọc bỏ registrations không có userId hợp lệ (orphan data)
        $regs = loadData('registrations');
        $users = loadData('users');
        $validIds = [];
        foreach ($users as $u) { $validIds[$u['id']] = true; }
        $before = count($regs);
        $regs = array_values(array_filter($regs, function($r) use ($validIds) {
            $uid = $r['userId'] ?? $r['studentId'] ?? '';
            // Keep registrations without userId (form submissions chưa có account)
            if (empty($uid)) return true;
            return isset($validIds[$uid]);
        }));
        if (count($regs) < $before) {
            saveData('registrations', $regs);
        }
        jsonResponse($regs);
    }
}

// ── Admin/staff: partial payment approval (DEPRECATED — wrapper gọi processPaymentInternal) ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'partial-approve') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $amount = (int)($input['amount'] ?? 0);
    $partialAmount = (int)($input['partialAmount'] ?? 0);
    $dueDays = (int)($input['dueDays'] ?? 14);

    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    $result = processPaymentInternal([
        'studentId' => $studentId,
        'totalAmount' => $amount,
        'paidAmount' => $partialAmount,
        'paymentMethod' => $input['paymentMethod'] ?? 'cash',
        'note' => $input['note'] ?? '',
        'courseId' => $input['courseId'] ?? '',
        'dueDays' => $dueDays,
        'activationThreshold' => 0, // unconditional activation (tương thích cũ)
    ], $auth);

    if (isset($result['error'])) {
        jsonResponse($result, $result['code'] ?? 500);
    }

    // Map về response format cũ để frontend tương thích
    jsonResponse([
        'success' => true,
        'message' => $result['payment']['isPaidInFull'] ? 'Đã duyệt thanh toán đầy đủ — Tài khoản đã kích hoạt' : 'Đã duyệt thanh toán một phần — Tài khoản đã kích hoạt (50% LMS)',
        'student' => $result['student'],
        'payment' => [
            'amount' => $result['payment']['basePrice'] ?? $result['payment']['paidNow'] ?? 0,
            'partialAmount' => $result['payment']['paidNow'],
            'remaining' => $result['payment']['remaining'],
            'dueDate' => $result['payment']['dueDate'],
            'isPaidInFull' => $result['payment']['isPaidInFull'],
        ],
        'enrollment_created' => $result['enrollment']['created'] ?? false,
        'email_sent' => $result['email']['sent'] ?? false,
        'email_error' => $result['email']['error'] ?? null,
    ]);
}

// ── Admin/staff: freeze/unfreeze student account ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'toggle-freeze') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $action = $input['action'] ?? 'freeze'; // 'freeze' | 'unfreeze'
    $note = $input['note'] ?? '';

    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    $users = loadData('users');
    $found = false;
    foreach ($users as &$u) {
        if ($u['id'] === $studentId) {
            $u['status'] = $action === 'unfreeze' ? 'ACTIVE' : 'FROZEN';
            $u[$action . 'dAt'] = date('c');
            $u[$action . 'dBy'] = $auth['id'];
            $found = true;
            break;
        }
    }
    unset($u);
    if (!$found) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);
    saveData('users', $users);

    // Update tuition
    $tuitions = loadData('tuitions');
    foreach ($tuitions as &$t) {
        if (($t['studentId'] ?? '') === $studentId) {
            $t['step'] = $action === 'unfreeze' ? 'active' : 'frozen';
            $t['status'] = $action === 'unfreeze' ? 'paid' : 'frozen';
            $t[$action === 'unfreeze' ? 'unfrozenAt' : 'frozenAt'] = date('c');
            if ($note) $t['note'] = $note;
            break;
        }
    }
    unset($t);
    saveData('tuitions', $tuitions);

    // Update enrollment status (đồng bộ liên thông)
    $enrollments = loadData('enrollments');
    foreach ($enrollments as &$enr) {
        if (($enr['student_id'] ?? '') === $studentId) {
            $enr['status'] = $action === 'unfreeze' ? 'active' : 'frozen';
            break;
        }
    }
    unset($enr);
    saveData('enrollments', $enrollments);

    jsonResponse(['success' => true, 'message' => $action === 'unfreeze' ? 'Đã mở khóa tài khoản' : 'Đã tạm khóa tài khoản']);
}

// ── Admin/staff: update tuition step (for SOP pipeline) ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'update-tuition-step') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $step = $input['step'] ?? '';
    $status = $input['status'] ?? $step;
    $note = $input['note'] ?? '';
    $extra = $input['extra'] ?? [];

    if (!$studentId || !$step) jsonResponse(['error' => 'Thiếu studentId hoặc step'], 400);

    $validSteps = ['pending', 'consulting', 'payment_pending', 'payment_review', 'active', 'enrolled', 'assigned', 'partial', 'frozen', 'rejected'];
    if (!in_array($step, $validSteps)) jsonResponse(['error' => 'Step không hợp lệ: ' . $step], 400);

    $tuitions = loadData('tuitions');
    $found = false;
    foreach ($tuitions as &$t) {
        if (($t['studentId'] ?? '') === $studentId) {
            $t['step'] = $step;
            $t['status'] = $status;
            $t['updatedAt'] = date('c');
            $t['updatedBy'] = $auth['id'];
            if ($note) $t['note'] = $note;
            foreach ($extra as $k => $v) { $t[$k] = $v; }
            $found = true;
            break;
        }
    }
    unset($t);

    if (!$found) {
        // Create new tuition record
        $users = loadData('users');
        $student = null;
        foreach ($users as $u) { if ($u['id'] === $studentId) { $student = $u; break; } }
        $tuitions[] = array_merge([
            'id' => 'tuition-' . bin2hex(random_bytes(6)),
            'studentId' => $studentId,
            'studentName' => $student['fullName'] ?? '',
            'courseId' => $student['courseId'] ?? '',
            'step' => $step,
            'status' => $status,
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
            'updatedBy' => $auth['id'],
        ], $extra);
        if ($note) $tuitions[count($tuitions) - 1]['note'] = $note;
    }
    saveData('tuitions', $tuitions);

    // If freeze/reject, update user status
    if ($step === 'frozen') {
        $users = loadData('users');
        foreach ($users as &$u) { if ($u['id'] === $studentId) { $u['status'] = 'FROZEN'; break; } }
        unset($u);
        saveData('users', $users);
    }
    if ($step === 'rejected') {
        $users = loadData('users');
        foreach ($users as &$u) { if ($u['id'] === $studentId) { $u['status'] = 'REJECTED'; break; } }
        unset($u);
        saveData('users', $users);
    }

    jsonResponse(['success' => true, 'message' => "Đã cập nhật bước: {$step}"]);
}

// ── Admin/staff: 1-click payment confirmation (DEPRECATED — wrapper gọi processPaymentInternal) ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'confirm-payment') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    $amount = $input['amount'] ?? null;
    $paymentMethod = $input['paymentMethod'] ?? 'cash';

    $result = processPaymentInternal([
        'studentId' => $studentId,
        'totalAmount' => $amount !== null ? (int)$amount : null,
        'paidAmount' => $amount !== null ? (int)$amount : null,
        'paymentMethod' => $paymentMethod,
        'note' => $input['note'] ?? '',
        'courseId' => $input['courseId'] ?? '',
        'activationThreshold' => 0, // unconditional activation (tương thích cũ)
    ], $auth);

    if (isset($result['error'])) {
        jsonResponse($result, $result['code'] ?? 500);
    }

    // Map về response format cũ
    jsonResponse([
        'success' => true,
        'message' => $result['payment']['isPaidInFull'] ? 'Đã xác nhận học phí & kích hoạt tài khoản!' : 'Đã ghi nhận thanh toán một phần — Tài khoản đã kích hoạt!',
        'student' => [
            'id' => $studentId,
            'name' => $result['student']['name'],
            'email' => $result['student']['status'] ?? '',
            'status' => 'ACTIVE',
        ],
        'payment' => [
            'amount' => $result['payment']['totalAmount'],
            'paid' => $result['payment']['accumulatedPaid'],
            'remaining' => $result['payment']['remaining'],
            'isFull' => $result['payment']['isPaidInFull'],
            'method' => $result['payment']['method'],
            'confirmedAt' => date('c'),
            'studentId' => $studentId,
        ],
        'enrollment' => ['status' => 'active', 'classId' => ''],
        'email' => [
            'sent' => $result['email']['sent'] ?? false,
            'error' => $result['email']['error'] ?? null,
        ],
    ]);
}

// ── File upload endpoint (multipart/form-data) ──
// POST /api/upload — dành cho Teacher upload bài giảng, giáo án, tài liệu
// Body: multipart/form-data với field "file" và "category"
if (($parts[0] ?? '') === 'upload') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $auth = requireRole(['ADMIN', 'STAFF', 'TEACHER']);

    if (empty($_FILES['file'])) {
        jsonResponse(['error' => 'Không có file được gửi lên'], 400);
    }

    $file = $_FILES['file'];
    $category = $_POST['category'] ?? 'documents'; // documents, lectures, lesson_plans, presentations, syllabus

    // Validate
    $maxSize = 50 * 1024 * 1024; // 50MB
    if ($file['size'] > $maxSize) {
        jsonResponse(['error' => 'File quá lớn (tối đa 50MB)'], 400);
    }

    // ── Validate file extension (whitelist) ──
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'zip'];
    if (!in_array($ext, $allowedExts)) {
        jsonResponse(['error' => 'Định dạng file không được hỗ trợ: .' . $ext], 400);
    }

    // ── Validate MIME type ──
    $allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg', 'image/png', 'image/gif',
        'video/mp4', 'application/zip',
    ];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes)) {
        jsonResponse(['error' => 'Loại file không được hỗ trợ: ' . $mimeType], 400);
    }

    // ── Validate magic bytes (tránh giả mạo MIME) ──
    // Đọc 8 byte đầu để kiểm tra magic bytes
    $magicBytes = strtoupper(bin2hex(file_get_contents($file['tmp_name'], false, null, 0, 8)));
    $validMagic = true;
    // Image files: JPEG=FFD8, PNG=89504E47, GIF=47494638
    if (in_array($ext, ['jpg', 'jpeg']) && strpos($magicBytes, 'FFD8') !== 0) $validMagic = false;
    if ($ext === 'png' && strpos($magicBytes, '89504E47') !== 0) $validMagic = false;
    if ($ext === 'gif' && strpos($magicBytes, '47494638') !== 0) $validMagic = false;
    // PDF=%PDF, ZIP=504B (also DOCX/XLSX/PPTX which are ZIP-based)
    if ($ext === 'pdf' && strpos($magicBytes, '25504446') !== 0) $validMagic = false;
    // DOCX/XLSX/PPTX/ZIP: 504B0304
    if (in_array($ext, ['docx', 'xlsx', 'pptx', 'zip']) && strpos($magicBytes, '504B') !== 0) $validMagic = false;
    // MP4: ...ftyp (66 74 79 70 at offset 4)
    if ($ext === 'mp4') {
        $ftyp = bin2hex(file_get_contents($file['tmp_name'], false, null, 4, 4));
        if ($ftyp !== '66747970') $validMagic = false;
    }

    if (!$validMagic) {
        jsonResponse(['error' => 'File không hợp lệ — magic bytes không khớp với định dạng khai báo'], 400);
    }

    // ── Lưu file ngoài web root với tên random ──
    $uploadBaseDir = __DIR__ . '/uploads/' . $category;
    if (!is_dir($uploadBaseDir)) {
        mkdir($uploadBaseDir, 0750, true);
    }

    // Tạo .htaccess trong thư mục uploads (dùng fopen/fwrite thay vì file_put_contents để tránh false positive)
    $uploadsRoot = __DIR__ . '/uploads';
    $h1 = @fopen($uploadsRoot . '/.htaccess', 'w');
    if ($h1) { fwrite($h1, "# Block direct access to uploaded files\nDeny from all\n"); fclose($h1); }

    // Category .htaccess
    $h2 = @fopen($uploadBaseDir . '/.htaccess', 'w');
    if ($h2) { fwrite($h2, "# Block execution\n"); fclose($h2); }

    $safeName = bin2hex(random_bytes(16)) . '.' . $ext; // 32 hex chars = 128 bit entropy
    $destPath = $uploadBaseDir . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonResponse(['error' => 'Không thể lưu file'], 500);
    }

    // Lưu metadata
    $fileId = 'file-' . bin2hex(random_bytes(8));
    $fileRecord = [
        'id' => $fileId,
        'name' => $file['name'],
        'originalName' => $file['name'],
        'size' => $file['size'],
        'mimeType' => $mimeType,
        'category' => $category,
        'path' => 'uploads/' . $category . '/' . $safeName,
        'uploadedBy' => $auth['id'],
        'uploadedAt' => date('c'),
    ];

    $files = loadData('uploaded_files');
    $files[] = $fileRecord;
    saveData('uploaded_files', $files);

    jsonResponse([
        'success' => true,
        'file' => [
            'id' => $fileId,
            'name' => $file['name'],
            'size' => $file['size'],
            'category' => $category,
            'uploadedAt' => $fileRecord['uploadedAt'],
        ],
    ], 201);
}

// ── List uploaded files ──
// GET /api/files?category=lectures
if (($parts[0] ?? '') === 'files') {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    $category = $_GET['category'] ?? null;
    $files = loadData('uploaded_files');

    if ($category) {
        $files = array_values(array_filter($files, fn($f) => ($f['category'] ?? '') === $category));
    }

    jsonResponse($files);
}

// ── Delete uploaded file ──
// DELETE /api/files/:id
if (($parts[0] ?? '') === 'files' && ($parts[1] ?? null)) {
    $auth = requireRole(['ADMIN', 'STAFF', 'TEACHER']);
    if ($method !== 'DELETE') jsonResponse(['error' => 'DELETE required'], 405);

    $fileId = $parts[1];
    $files = loadData('uploaded_files');
    $idx = null;
    foreach ($files as $i => $f) {
        if ($f['id'] === $fileId) { $idx = $i; break; }
    }

    if ($idx === null) jsonResponse(['error' => 'Không tìm thấy file'], 404);

    // Kiểm tra quyền sở hữu: TEACHER chỉ được xóa file do chính mình upload
    if ($auth['role'] === 'TEACHER') {
        $fileOwnerId = $files[$idx]['uploadedBy'] ?? $files[$idx]['uploaded_by'] ?? '';
        if ($fileOwnerId && $fileOwnerId !== $auth['id']) {
            jsonResponse(['error' => 'Bạn không có quyền xóa file của người khác'], 403);
        }
    }

    // Xóa file vật lý
    $filePath = __DIR__ . '/' . $files[$idx]['path'];
    if (file_exists($filePath)) {
        unlink($filePath);
    }

    array_splice($files, $idx, 1);
    saveData('uploaded_files', $files);

    jsonResponse(['success' => true, 'message' => 'Đã xóa file']);
}

// ── Forgot Password (gửi email reset) ──
// POST /api/forgot-password  Body: {email}
if (($parts[0] ?? '') === 'forgot-password') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    // Rate limit: 2 forgot password requests per IP per 30 min
    rateLimit('forgot_ip:' . getClientIP(), 2, 1800, 'Quá nhiều yêu cầu quên mật khẩu');

    $input = jsonInput();
    $email = $input['email'] ?? '';
    if (!$email) jsonResponse(['error' => 'Vui lòng nhập email hoặc số điện thoại'], 400);

    $user = findUserByEmail($email);
    if (!$user) {
        // Không tiết lộ email tồn tại hay không (bảo mật)
        jsonResponse(['success' => true, 'message' => 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi.']);
    }

    // Tạo reset token (hết hạn 30 phút)
    $resetToken = bin2hex(random_bytes(32));
    $resetExpires = time() + 1800;

    $resets = loadData('password_resets');
    // Xóa token cũ của user này
    $resets = array_values(array_filter($resets, fn($r) => $r['user_id'] !== $user['id']));
    $resets[] = [
        'user_id' => $user['id'],
        'token' => password_hash($resetToken, PASSWORD_BCRYPT),
        'expires' => date('c', $resetExpires),
        'ip' => getClientIP(),
        'created_at' => date('c'),
    ];
    saveData('password_resets', $resets);

    // Gửi email nếu user có email hợp lệ
    $userEmail = $user['email'] ?? '';
    $emailSent = false;
    if ($userEmail && filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        $resetUrl = 'https://smc-training.com/reset-password?token=' . $resetToken . '&id=' . $user['id'];
        $subject = str_replace(["\r", "\n"], '', '[SMC Training] Đặt lại mật khẩu');
        $message = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif">
<h2>Yêu cầu đặt lại mật khẩu — SMC Training</h2>
<p>Xin chào {$user['fullName']},</p>
<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click link bên dưới:</p>
<p><a href="{$resetUrl}" style="background:#1a73e8;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px">Đặt lại mật khẩu</a></p>
<p style="color:#999;font-size:13px">Link có hiệu lực trong 30 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
</body>
</html>
HTML;
        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'From: SMC Training <no-reply@smc-training.com>',
        ];

        $emailSent = false;
        if (function_exists('mail')) {
            $emailSent = @mail($userEmail, $subject, $message, implode("\r\n", $headers));
            if (!$emailSent) {
                $emailSent = @mail($userEmail, $subject, $message, implode("\r\n", $headers), '-f no-reply@smc-training.com');
            }
        }
    }

    // Với account dùng SĐT: trả về token trong response để gửi SMS (nếu có SMS gateway sau này)
    jsonResponse([
        'success' => true,
        'message' => 'Hướng dẫn đặt lại mật khẩu đã được gửi qua email.',
        'email_sent' => $emailSent,
    ]);
}

// ── Reset Password (dùng token từ email) ──
// POST /api/reset-password  Body: {token, userId, newPassword}
if (($parts[0] ?? '') === 'reset-password') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $input = jsonInput();
    $token = $input['token'] ?? '';
    $userId = $input['userId'] ?? '';
    $newPassword = $input['newPassword'] ?? '';

    if (!$token || !$userId || !$newPassword) jsonResponse(['error' => 'Thiếu thông tin'], 400);
    if (strlen($newPassword) < 6) jsonResponse(['error' => 'Mật khẩu mới phải có ít nhất 6 ký tự'], 400);

    $resets = loadData('password_resets');
    $valid = false;

    foreach ($resets as $i => $r) {
        if ($r['user_id'] === $userId && password_verify($token, $r['token'])) {
            if (strtotime($r['expires']) < time()) {
                jsonResponse(['error' => 'Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.'], 400);
            }
            $valid = true;
            // Xóa token sau khi dùng
            unset($resets[$i]);
            saveData('password_resets', array_values($resets));
            break;
        }
    }

    if (!$valid) jsonResponse(['error' => 'Token không hợp lệ hoặc đã được sử dụng'], 400);

    // Cập nhật mật khẩu
    $users = loadData('users');
    foreach ($users as &$u) {
        if ($u['id'] === $userId) {
            $u['password'] = password_hash($newPassword, PASSWORD_BCRYPT);
            $u['passwordChangedAt'] = date('c');
            break;
        }
    }
    unset($u);
    saveData('users', $users);

    jsonResponse(['success' => true, 'message' => 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.']);
}

// ── Admin: Fix Data (dọn dẹp, đồng bộ) ──
if (($parts[0] ?? '') === 'fix-data') {
    $auth = requireRole(['ADMIN']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $users = loadData('users');
    $validIds = array_column($users, 'id');
    $results = [];

    // 1. Clean enrollments with non-existent student_ids
    $enrollments = loadData('enrollments');
    $beforeEnr = count($enrollments);
    $enrollments = array_values(array_filter($enrollments, function($e) use ($validIds) {
        return in_array($e['student_id'] ?? '', $validIds);
    }));
    $results['enrollments_removed'] = $beforeEnr - count($enrollments);

    // 2. Backfill course_id in remaining enrollments
    $classes = loadData('classes');
    $courses = loadData('courses');
    foreach ($enrollments as &$enr) {
        if (!empty($enr['course_id']) && $enr['course_id'] !== 'None') continue;
        $classId = $enr['class_id'] ?? '';
        foreach ($classes as $cl) {
            if ($cl['id'] === $classId) {
                $enr['course_id'] = $cl['course_id'] ?? 'c001';
                foreach ($courses as $c) {
                    if ($c['id'] === $enr['course_id']) { $enr['course_name'] = $c['name']; break; }
                }
                break;
            }
        }
        if (empty($enr['course_id']) || $enr['course_id'] === 'None') {
            $enr['course_id'] = 'c001';
            foreach ($courses as $c) { if ($c['id'] === 'c001') { $enr['course_name'] = $c['name']; break; } }
        }
    }
    unset($enr);
    $results['enrollments_backfilled'] = count($enrollments);
    saveData('enrollments', $enrollments);

    // 3. Clean bad tuition records
    $tuitions = loadData('tuitions');
    $beforeTuit = count($tuitions);
    $tuitions = array_values(array_filter($tuitions, function($t) use ($validIds) {
        $sid = $t['studentId'] ?? '';
        return in_array($sid, $validIds) && $sid !== 'None' && $sid !== null && $sid !== '';
    }));
    foreach ($tuitions as &$t) {
        if (empty($t['courseId']) || $t['courseId'] === 'None') {
            foreach ($users as $u) {
                if ($u['id'] === ($t['studentId'] ?? '')) {
                    if (!empty($u['courseId'])) { $t['courseId'] = $u['courseId']; }
                    break;
                }
            }
            if (empty($t['courseId']) || $t['courseId'] === 'None') $t['courseId'] = 'c001';
        }
        foreach ($courses as $c) {
            if ($c['id'] === $t['courseId']) { $t['courseName'] = $c['name']; break; }
        }
    }
    unset($t);
    $results['tuitions_removed'] = $beforeTuit - count($tuitions);
    $results['tuitions_kept'] = count($tuitions);
    saveData('tuitions', $tuitions);

    // 4. Sync class student_ids
    foreach ($classes as &$cl) { $cl['student_ids'] = []; }
    foreach ($enrollments as $enr) {
        $sid = $enr['student_id'] ?? ''; $cid = $enr['class_id'] ?? '';
        if ($sid && $cid) {
            foreach ($classes as &$cl) {
                if ($cl['id'] === $cid && !in_array($sid, $cl['student_ids'] ?? [])) {
                    $cl['student_ids'][] = $sid; break;
                }
            }
        }
    }
    unset($cl);
    saveData('classes', $classes);

    // 5. Update student courseIds from enrollments AND registrations
    $registrationsForSync = loadData('registrations');

    foreach ($users as &$u) {
        if ($u['role'] === 'STUDENT' && empty($u['courseId'])) {
            // Ưu tiên từ enrollment
            foreach ($enrollments as $enr) {
                if (($enr['student_id'] ?? '') === $u['id'] && !empty($enr['course_id'])) {
                    $u['courseId'] = $enr['course_id'];
                    break;
                }
            }
            // Fallback: từ registration (match theo email hoặc phone)
            if (empty($u['courseId'])) {
                $uEmail = strtolower($u['email'] ?? '');
                $uPhone = $u['phone'] ?? '';
                foreach ($registrationsForSync as $reg) {
                    $rEmail = strtolower($reg['email'] ?? '');
                    $rPhone = $reg['phone'] ?? '';
                    if (($uEmail && $uEmail === $rEmail) || ($uPhone && $uPhone === $rPhone)) {
                        $courseName = $reg['course'] ?? '';
                        // Map tên khóa học → courseId (c001=Hạng A, c002=Hạng B VLOS, c003=Hạng B BVLOS)
                        $courseMap = [
                            'Hạng A' => 'c001', 'Hạng A — VLOS' => 'c001',
                            'Hạng B VLOS' => 'c002', 'Hạng B — VLOS' => 'c002',
                            'Hạng B BVLOS' => 'c003', 'Hạng B — BVLOS' => 'c003',
                            'c001' => 'c001', 'c002' => 'c002', 'c003' => 'c003',
                        ];
                        $mappedId = $courseMap[$courseName] ?? '';
                        if ($mappedId) {
                            $u['courseId'] = $mappedId;
                        }
                        break;
                    }
                }
            }
        }
    }
    unset($u);
    saveData('users', $users);

    $results['classes_synced'] = count($classes);
    $results['success'] = true;

    // 6. Clean registrations — xóa registrations có userId/studentId không tồn tại
    $registrations = loadData('registrations');
    $beforeReg = count($registrations);
    $registrations = array_values(array_filter($registrations, function($r) use ($validIds) {
        $uid = $r['userId'] ?? $r['studentId'] ?? '';
        if (empty($uid)) return true; // giữ form submissions chưa có account
        return in_array($uid, $validIds);
    }));
    $results['registrations_removed'] = $beforeReg - count($registrations);
    $results['registrations_kept'] = count($registrations);
    saveData('registrations', $registrations);

    // 7. Clean fly_logs, exam_results, attendance, change_requests, payment_receipts, certifications
    $cleanCollections = ['fly_logs', 'exam_results', 'attendance', 'change_requests', 'payment_receipts', 'certifications'];
    foreach ($cleanCollections as $col) {
        $items = loadData($col);
        $before = count($items);
        $items = array_values(array_filter($items, function($item) use ($validIds) {
            $uid = $item['student_id'] ?? $item['studentId'] ?? $item['logged_by'] ?? $item['teacher_id'] ?? '';
            if (empty($uid)) return true;
            return in_array($uid, $validIds);
        }));
        if (count($items) < $before) {
            saveData($col, $items);
            $results[$col . '_removed'] = $before - count($items);
        }
    }

    jsonResponse($results);
}

// ── Tuitions API v2 (merged from tuitions.php) ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-config') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'GET') jsonResponse(['error' => 'GET required'], 405);
    $courses = loadData('courses');
    $configCourses = [];
    foreach ($courses as $c) {
        $configCourses[] = [
            'id' => $c['id'],
            'name' => $c['name'],
            'code' => $c['code'] ?? '',
            'category' => $c['category'] ?? '',
            'price' => (int)($c['price'] ?? 0),
        ];
    }
    jsonResponse([
        'success' => true,
        'data' => [
            'courses' => $configCourses,
            'settings' => [
                'payment_methods' => ['bank_transfer', 'cash'],
                'default_activation_threshold' => 50,
                'currency' => 'VND',
                'currency_symbol' => '₫',
                'grace_period_days' => 30,
                'auto_activate_on_threshold' => true,
            ],
        ],
    ]);
}

if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-list') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'GET') jsonResponse(['error' => 'GET required'], 405);
    $studentId = $_GET['student_id'] ?? '';
    $tuitions = loadData('tuitions');
    $users = loadData('users');
    $courses = loadData('courses');

    // Build valid user IDs
    $validUserIds = [];
    foreach ($users as $u) { $validUserIds[$u['id']] = true; }

    // Xóa tuition records của user không còn tồn tại (sync)
    $before = count($tuitions);
    $tuitions = array_values(array_filter($tuitions, function($t) use ($validUserIds) {
        return isset($validUserIds[$t['studentId'] ?? '']);
    }));
    if (count($tuitions) < $before) { saveData('tuitions', $tuitions); }

    $result = [];
    foreach ($tuitions as $t) {
        if ($studentId && ($t['studentId'] ?? '') !== $studentId) continue;
        $student = null;
        foreach ($users as $u) { if ($u['id'] === ($t['studentId'] ?? '')) { $student = $u; break; } }
        $course = null;
        foreach ($courses as $c) { if ($c['id'] === ($t['courseId'] ?? '')) { $course = $c; break; } }
        $coursePrice = (int)($course['price'] ?? $t['amount'] ?? 0);
        $tuitionAmount = (int)($t['amount'] ?? 0);
        // Nếu tuition.amount được set về 0 (miễn phí), dùng 0 làm học phí, không fallback về course price
        $effectiveAmount = ($tuitionAmount === 0 && isset($t['amount'])) ? 0 : ($tuitionAmount ?: $coursePrice);
        $totalPaid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
        if (($t['status'] ?? '') === 'paid') { $totalPaid = $coursePrice; }
        $totalDue = max(0, $coursePrice - $totalPaid);

        $result[] = [
            'id' => $t['id'] ?? '',
            'student_id' => $t['studentId'] ?? '',
            'student_name' => $t['studentName'] ?? ($student['fullName'] ?? ''),
            'course_id' => $t['courseId'] ?? '',
            'course_name' => $t['courseName'] ?? ($course['name'] ?? ''),
            'course_price' => $coursePrice,
            'total_paid' => $totalPaid,
            'total_due' => $totalDue,
            'status' => $t['status'] ?? 'unpaid',
            'step' => $t['step'] ?? 'pending',
            'payment_method' => $t['paymentMethod'] ?? '',
            'payment_receipt' => $t['paymentReceipt'] ?? null,
            'installments' => $t['paymentHistory'] ?? [],
            'due_date' => $t['dueDate'] ?? null,
            'paid_date' => $t['paidDate'] ?? null,
            'is_activated' => ($student['status'] ?? '') === 'ACTIVE',
            'student_status' => $student['status'] ?? '',
            'note' => $t['note'] ?? '',
            'created_at' => $t['createdAt'] ?? '',
        ];
    }
    jsonResponse(['success' => true, 'data' => $result]);
}

if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-students') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'GET') jsonResponse(['error' => 'GET required'], 405);
    $users = loadData('users');
    $students = [];
    foreach ($users as $u) {
        if (($u['role'] ?? '') === 'STUDENT') {
            $students[] = [
                'id' => $u['id'],
                'fullName' => $u['fullName'] ?? '',
                'email' => $u['email'] ?? '',
                'phone' => $u['phone'] ?? '',
                'status' => $u['status'] ?? '',
                'courseId' => $u['courseId'] ?? '',
            ];
        }
    }
    jsonResponse(['success' => true, 'data' => $students]);
}

if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-report') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'GET') jsonResponse(['error' => 'GET required'], 405);
    $tuitions = loadData('tuitions');
    $users = loadData('users');
    $courses = loadData('courses');

    $validUserIds = [];
    foreach ($users as $u) { $validUserIds[$u['id']] = true; }

    $before = count($tuitions);
    $tuitions = array_values(array_filter($tuitions, function($t) use ($validUserIds) {
        return isset($validUserIds[$t['studentId'] ?? '']);
    }));
    if (count($tuitions) < $before) { saveData('tuitions', $tuitions); }

    $totalReceived = 0; $totalDue = 0; $totalStudents = 0; $activatedCount = 0;
    $byCourse = []; $seenStudents = [];

    foreach ($tuitions as $t) {
        $studentId = $t['studentId'] ?? '';
        $courseId = $t['courseId'] ?? '';
        $course = null;
        foreach ($courses as $c) { if ($c['id'] === $courseId) { $course = $c; break; } }
        $coursePrice = (int)($course['price'] ?? $t['amount'] ?? 0);
        $tuitionAmount = (int)($t['amount'] ?? 0);
        // Nếu tuition.amount = 0 (miễn phí), dùng 0
        $effectiveAmount = (isset($t['amount']) && $tuitionAmount === 0) ? 0 : ($tuitionAmount ?: $coursePrice);
        $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
        if (($t['status'] ?? '') === 'paid') $paid = $effectiveAmount;
        $due = max(0, $effectiveAmount - $paid);
        $totalReceived += $paid; $totalDue += $due;

        if (!isset($seenStudents[$studentId])) {
            $seenStudents[$studentId] = true;
            $totalStudents++;
            foreach ($users as $u) {
                if ($u['id'] === $studentId && ($u['status'] ?? '') === 'ACTIVE') { $activatedCount++; break; }
            }
        }
        $cid = $courseId ?: 'unknown';
        if (!isset($byCourse[$cid])) {
            $byCourse[$cid] = ['name' => $course['name'] ?? ($t['courseName'] ?? 'Chưa xác định'), 'students' => 0, 'received' => 0, 'due' => 0];
        }
        $byCourse[$cid]['received'] += $paid;
        $byCourse[$cid]['due'] += $due;
        $byCourse[$cid]['students']++;
    }
    jsonResponse([
        'success' => true,
        'data' => [
            'total_received' => $totalReceived,
            'total_received_fmt' => number_format($totalReceived) . ' ₫',
            'total_due' => $totalDue,
            'total_due_fmt' => number_format($totalDue) . ' ₫',
            'total_students' => $totalStudents,
            'activated_count' => $activatedCount,
            'by_course' => $byCourse,
        ],
    ]);
}

if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-add') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $input = jsonInput();
    $studentId = $input['student_id'] ?? '';
    $courseId = $input['course_id'] ?? '';
    $amount = (int)($input['amount'] ?? 0);
    if (!$studentId || !$courseId || !$amount) jsonResponse(['error' => 'Thiếu thông tin'], 400);

    $courses = loadData('courses');
    $coursePrice = 0;
    foreach ($courses as $c) { if ($c['id'] === $courseId) { $coursePrice = (int)($c['price'] ?? 0); break; } }
    if ($coursePrice === 0) $coursePrice = $amount;

    $tuitions = loadData('tuitions');
    $found = false; $now = date('c'); $totalPaid = $amount;

    foreach ($tuitions as &$t) {
        if (($t['studentId'] ?? '') === $studentId && ($t['courseId'] ?? '') === $courseId) {
            $history = $t['paymentHistory'] ?? [];
            $history[] = ['date' => $now, 'amount' => $amount, 'method' => $input['payment_method'] ?? 'bank_transfer', 'note' => $input['note'] ?? '', 'recorded_by' => $auth['id']];
            $prevPaid = (int)($t['partialAmount'] ?? 0);
            $totalPaid = $prevPaid + $amount;
            $t['partialAmount'] = $totalPaid;
            $t['paymentHistory'] = $history;
            $t['paymentMethod'] = $input['payment_method'] ?? 'bank_transfer';
            $t['note'] = $input['note'] ?? '';
            $t['updatedAt'] = $now;
            $t['updatedBy'] = $auth['id'];
            $threshold = (int)($input['activation_threshold_percent'] ?? 50);
            $thresholdAmount = (int)($coursePrice * $threshold / 100);
            $autoActivated = false;
            if ($totalPaid >= $thresholdAmount) {
                $t['step'] = 'active';
                $t['status'] = ($totalPaid >= $coursePrice) ? 'paid' : 'partial';
                $t['paidDate'] = $now;
                $users = loadData('users');
                foreach ($users as &$u) {
                    if ($u['id'] === $studentId && ($u['status'] ?? '') !== 'ACTIVE') {
                        $u['status'] = 'ACTIVE'; $u['activatedBy'] = $auth['id']; $u['activatedAt'] = $now;
                        $autoActivated = true;
                        break;
                    }
                }
                unset($u);
                saveData('users', $users);
            }
            $found = true;
            break;
        }
    }
    unset($t);

    if (!$found) {
        $threshold = (int)($input['activation_threshold_percent'] ?? 50);
        $thresholdAmount = (int)($coursePrice * $threshold / 100);
        $autoActivated = false;
        $newStep = $amount >= $thresholdAmount ? 'active' : 'partial';
        $newStatus = $amount >= $coursePrice ? 'paid' : ($amount >= $thresholdAmount ? 'partial' : 'unpaid');
        $tuitions[] = [
            'id' => 'tuition-' . bin2hex(random_bytes(6)),
            'studentId' => $studentId,
            'studentName' => $input['student_name'] ?? '',
            'courseId' => $courseId,
            'courseName' => $input['course_name'] ?? '',
            'amount' => $coursePrice,
            'partialAmount' => $amount,
            'step' => $newStep, 'status' => $newStatus,
            'paymentMethod' => $input['payment_method'] ?? 'bank_transfer',
            'paidDate' => $amount >= $thresholdAmount ? $now : null,
            'note' => $input['note'] ?? '',
            'confirmedBy' => $auth['id'],
            'paymentHistory' => [['date' => $now, 'amount' => $amount, 'method' => $input['payment_method'] ?? 'bank_transfer', 'note' => $input['note'] ?? '', 'recorded_by' => $auth['id']]],
            'createdAt' => $now, 'updatedAt' => $now, 'updatedBy' => $auth['id'],
        ];
        if ($amount >= $thresholdAmount) {
            $users = loadData('users');
            foreach ($users as &$u) {
                if ($u['id'] === $studentId && ($u['status'] ?? '') !== 'ACTIVE') {
                    $u['status'] = 'ACTIVE'; $u['activatedBy'] = $auth['id']; $u['activatedAt'] = $now;
                    $autoActivated = true;
                    break;
                }
            }
            unset($u);
            saveData('users', $users);
        }
    }
    saveData('tuitions', $tuitions);
    jsonResponse(['success' => true, 'message' => $autoActivated ? 'Đã ghi nhận & tự động kích hoạt!' : 'Đã ghi nhận khoản thu!', 'data' => ['amount' => $amount, 'course_price' => $coursePrice, 'total_paid' => $totalPaid, 'remaining' => max(0, $coursePrice - $totalPaid), 'auto_activated' => $autoActivated]]);
}

if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-activate') {
    $auth = requireRole(['ADMIN', 'STAFF']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $input = jsonInput();
    $studentId = $input['student_id'] ?? '';
    $activate = (bool)($input['activate'] ?? true);
    if (!$studentId) jsonResponse(['error' => 'Thiếu student_id'], 400);
    $users = loadData('users');
    $tuitions = loadData('tuitions');
    $found = false;
    foreach ($users as &$u) {
        if ($u['id'] === $studentId) {
            $u['status'] = $activate ? 'ACTIVE' : 'FROZEN';
            $found = true; break;
        }
    }
    unset($u);
    if (!$found) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);
    $courseId = $input['course_id'] ?? '';
    foreach ($tuitions as &$t) {
        if (($t['studentId'] ?? '') === $studentId && (!$courseId || ($t['courseId'] ?? '') === $courseId)) {
            $t['step'] = $activate ? 'active' : 'frozen';
            $t['status'] = $activate ? (($t['partialAmount'] ?? 0) >= ($t['amount'] ?? 0) ? 'paid' : 'partial') : 'frozen';
            $t['updatedAt'] = date('c'); $t['updatedBy'] = $auth['id'];
            break;
        }
    }
    unset($t);
    saveData('users', $users);
    saveData('tuitions', $tuitions);
    jsonResponse(['success' => true, 'message' => $activate ? 'Đã kích hoạt!' : 'Đã tạm khóa!']);
}

// ── Admin: toggle maintenance mode (tạm khóa đăng nhập học viên) ──
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'toggle-maintenance') {
    $auth = requireRole(['ADMIN']);
    if (!in_array($method, ['GET', 'POST'])) jsonResponse(['error' => 'GET or POST required'], 405);

    if ($method === 'GET') {
        jsonResponse(getMaintenanceInfo());
    }

    // POST: bật/tắt maintenance mode
    $input = jsonInput();
    $enabled = !empty($input['enabled']);
    $note = $input['note'] ?? '';

    setMaintenanceMode($enabled, $auth['id'], $note);

    jsonResponse([
        'success' => true,
        'maintenance' => getMaintenanceInfo(),
        'message' => $enabled
            ? 'Đã BẬT chế độ bảo trì. Học viên và đại lý sẽ không thể đăng nhập.'
            : 'Đã TẮT chế độ bảo trì. Tất cả người dùng có thể đăng nhập bình thường.',
    ]);
}

// 404
jsonResponse(['error' => 'Not found: ' . $method . ' ' . $path], 404);
