<?php
/**
 * SMC Training — RESTful API v1
 * Endpoint: /api/api-v1.php
 *
 * Chuẩn Response:
 * { "success": true, "message": "...", "data": {}, "errors": null, "timestamp": "..." }
 */

require_once __DIR__ . '/db.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://smc-training.com');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ─── Auth Helpers ───
$envFile = __DIR__ . '/env.php';
$env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];
$secretKey = $env['SECRET_KEY'] ?? getenv('SMC_SECRET_KEY') ?: 'fallback';

function apiGetToken() {
    if (!empty($_COOKIE['smc_token'])) return $_COOKIE['smc_token'];
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    return str_replace('Bearer ', '', $h);
}

function apiVerifyToken($token) {
    global $secretKey;
    $parts = explode('.', $token);
    if (count($parts) === 3) {
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
        if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
        $sig = hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secretKey, true);
        return hash_equals(base64_decode(strtr($parts[2], '-_', '+/')), $sig) ? $payload : null;
    }
    if (count($parts) === 2) {
        list($b64, $sig) = $parts;
        if (!hash_equals(hash_hmac('sha256', $b64, $secretKey), $sig)) return null;
        $payload = json_decode(base64_decode($b64), true);
        return (!$payload || ($payload['exp'] ?? 0) < time()) ? null : $payload;
    }
    return null;
}

function apiAuth() {
    $token = apiGetToken();
    return $token ? apiVerifyToken($token) : null;
}

function apiRequireRole($roles) {
    $auth = apiAuth();
    if (!$auth) apiJson(['success' => false, 'message' => 'Unauthorized', 'data' => null], 401);
    $roleMap = ['ADMIN' => 'admin', 'admin' => 'admin', 'STAFF' => 'staff', 'staff' => 'staff',
                'ACCOUNTANT' => 'accountant', 'accountant' => 'accountant', 'SALE' => 'sale', 'sale' => 'sale',
                'STUDENT' => 'student', 'student' => 'student', 'TEACHER' => 'teacher', 'teacher' => 'teacher'];
    $currentRole = $roleMap[$auth['role'] ?? ''] ?? strtolower($auth['role'] ?? '');
    if (!array_intersect((array)$roles, [$currentRole, $auth['role'] ?? ''])) {
        apiJson(['success' => false, 'message' => 'Forbidden', 'data' => null], 403);
    }
    return $auth;
}

function apiJson($data, $code = 200) {
    http_response_code($code);
    $response = [
        'success' => $code >= 200 && $code < 300,
        'message' => $data['message'] ?? ($code < 300 ? 'Thành công' : 'Lỗi'),
        'data' => $data['data'] ?? $data,
        'errors' => $data['errors'] ?? ($code >= 400 ? [$data['message'] ?? 'Lỗi'] : null),
        'timestamp' => date('c'),
    ];
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function apiInput() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

// ─── Routing ───
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$path = rtrim(str_replace('/api/api-v1.php', '', $path), '/');

// Parse path: /api/v1/enrollments, /api/v1/enrollments/123, /api/v1/enrollments/debts, etc.
$segments = array_values(array_filter(explode('/', $path)));
$resource = $segments[0] ?? '';
$subResource = $segments[1] ?? '';
$action = $segments[2] ?? '';
$id = is_numeric($subResource) ? $subResource : null;
// For paths like /api/v1/payments/123/approve → $id=123, $action=approve
if ($id === null && !is_numeric($subResource) && $subResource !== '') {
    // non-numeric sub-resource like "debts", "generate-qr", "my-tuition"
    $action = $subResource;
    $id = $segments[2] ?? null;
} elseif ($id !== null) {
    $action = $segments[2] ?? '';
}

$query = $_GET;

// =====================================================================
// HEALTH CHECK
// =====================================================================
if ($resource === 'health' || $resource === '') {
    apiJson(['data' => DB::health()]);
}

// =====================================================================
// 2.1 ENROLLMENTS (/api/v1/enrollments)
// =====================================================================
if ($resource === 'enrollments') {
    if ($action === 'debts') {
        // GET /api/v1/enrollments/debts → v_student_debts view
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff']);
        $debts = DB::select("SELECT * FROM v_student_debts ORDER BY remaining_amount DESC");
        apiJson(['data' => $debts]);
    }

    if ($method === 'GET' && $id) {
        // GET /api/v1/enrollments/{id}
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff', 'student']);
        $enr = DB::selectOne("SELECT e.*, c.name AS course_name, u.full_name AS student_name, u.phone AS student_phone,
                              ag.name AS agent_name, us.full_name AS sale_name
                              FROM enrollments e
                              JOIN courses c ON e.course_id = c.id
                              JOIN users u ON e.student_id = u.id
                              LEFT JOIN agents ag ON e.agent_id = ag.id
                              LEFT JOIN users us ON e.sale_id = us.id
                              WHERE e.id = ?", [(int)$id]);
        if (!$enr) apiJson(['success' => false, 'message' => 'Không tìm thấy hồ sơ'], 404);
        // Lấy payment schedules
        $enr['payment_schedules'] = DB::select("SELECT * FROM payment_schedules WHERE enrollment_id = ? ORDER BY installment_num", [$id]);
        // Lấy payment history
        $enr['payments'] = DB::select("SELECT * FROM payments WHERE enrollment_id = ? ORDER BY payment_date DESC", [$id]);
        apiJson(['data' => $enr]);
    }

    if ($method === 'GET') {
        // GET /api/v1/enrollments?payment_status=&agent_id=&search=
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff']);
        $where = [];
        $params = [];
        if (!empty($query['payment_status'])) {
            $where[] = 'e.payment_status = ?';
            $params[] = $query['payment_status'];
        }
        if (!empty($query['agent_id'])) {
            $where[] = 'e.agent_id = ?';
            $params[] = (int)$query['agent_id'];
        }
        if (!empty($query['sale_id'])) {
            $where[] = 'e.sale_id = ?';
            $params[] = (int)$query['sale_id'];
        }
        if (!empty($query['search'])) {
            $where[] = '(u.full_name LIKE ? OR u.phone LIKE ? OR e.enrollment_code LIKE ?)';
            $search = '%' . $query['search'] . '%';
            $params[] = $search; $params[] = $search; $params[] = $search;
        }
        $whereSQL = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $page = max(1, (int)($query['page'] ?? 1));
        $perPage = min(100, max(1, (int)($query['per_page'] ?? 20)));

        $total = (int)DB::selectOne("SELECT COUNT(*) AS c FROM enrollments e JOIN users u ON e.student_id = u.id {$whereSQL}", $params)['c'];
        $sql = "SELECT e.*, c.name AS course_name, u.full_name AS student_name, u.phone AS student_phone,
                ag.name AS agent_name, us.full_name AS sale_name
                FROM enrollments e
                JOIN courses c ON e.course_id = c.id
                JOIN users u ON e.student_id = u.id
                LEFT JOIN agents ag ON e.agent_id = ag.id
                LEFT JOIN users us ON e.sale_id = us.id
                {$whereSQL} ORDER BY e.created_at DESC " . DB::paginate($page, $perPage);
        $items = DB::select($sql, $params);

        apiJson(['data' => ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $perPage]]);
    }

    if ($method === 'POST') {
        // POST /api/v1/enrollments → sp_create_enrollment
        $auth = apiRequireRole(['admin', 'sale', 'staff']);
        $input = apiInput();
        $result = DB::call('sp_create_enrollment', [
            $input['student_id'] ?? 0,
            $input['course_id'] ?? 0,
            $input['agent_id'] ?? null,
            $input['sale_id'] ?? null,
            $input['discount_amount'] ?? 0,
            $auth['userId'] ?? $auth['id'] ?? 1,
            !empty($input['payment_plan']) ? json_encode($input['payment_plan']) : null,
        ]);
        apiJson(['data' => $result[0] ?? [], 'message' => 'Tạo hồ sơ thành công'], 201);
    }
}

// =====================================================================
// 2.2 PAYMENTS (/api/v1/payments)
// =====================================================================
if ($resource === 'payments') {
    if ($method === 'POST' && $action === 'generate-qr') {
        // POST /api/v1/payments/generate-qr → Sinh mã VietQR
        $auth = apiRequireRole(['admin', 'sale', 'staff', 'student']);
        $input = apiInput();
        $enrollmentId = $input['enrollment_id'] ?? 0;
        $amount = (int)($input['amount'] ?? 0);
        $enr = DB::selectOne("SELECT e.*, u.full_name, c.code AS course_code FROM enrollments e
                              JOIN users u ON e.student_id = u.id JOIN courses c ON e.course_id = c.id
                              WHERE e.id = ?", [(int)$enrollmentId]);
        if (!$enr) apiJson(['success' => false, 'message' => 'Không tìm thấy hồ sơ'], 404);

        // Tạo QR content theo chuẩn VietQR
        $bankId = 'VCB'; // Có thể cấu hình trong env
        $accountNo = $env['BANK_ACCOUNT'] ?? '1234567890';
        $accountName = $env['BANK_ACCOUNT_NAME'] ?? 'SMC TRAINING';
        $desc = "{$enr['enrollment_code']} {$enr['full_name']}";
        $qrContent = "{$bankId}|{$accountNo}|{$accountName}|{$amount}|{$desc}";

        apiJson(['data' => [
            'qr_content' => $qrContent,
            'amount' => $amount,
            'description' => $desc,
            'bank' => $bankId,
            'account_no' => $accountNo,
            'account_name' => $accountName,
            'enrollment_code' => $enr['enrollment_code'],
        ]]);
    }

    if (($method === 'PATCH' || $method === 'POST') && $action === 'approve') {
        // PATCH /api/v1/payments/{id}/approve
        $auth = apiRequireRole(['admin', 'accountant']);
        $input = apiInput();
        $result = DB::call('sp_approve_payment', [
            (int)$id,
            $auth['userId'] ?? $auth['id'] ?? 1,
            $input['note'] ?? '',
        ]);
        apiJson(['data' => $result[0] ?? [], 'message' => 'Duyệt phiếu thu thành công']);
    }

    if (($method === 'PATCH' || $method === 'POST') && $action === 'reject') {
        // PATCH /api/v1/payments/{id}/reject
        $auth = apiRequireRole(['admin', 'accountant']);
        $input = apiInput();
        $result = DB::call('sp_reject_payment', [
            (int)$id,
            $auth['userId'] ?? $auth['id'] ?? 1,
            $input['reason'] ?? 'Không có lý do',
        ]);
        apiJson(['data' => $result[0] ?? [], 'message' => 'Đã từ chối phiếu thu']);
    }

    if ($method === 'POST') {
        // POST /api/v1/payments → sp_record_payment
        $auth = apiRequireRole(['admin', 'sale', 'staff', 'accountant']);
        $input = apiInput();
        $result = DB::call('sp_record_payment', [
            $input['enrollment_id'] ?? 0,
            $input['amount'] ?? 0,
            $input['payment_method'] ?? 'cash',
            $input['transaction_ref'] ?? '',
            $input['payment_schedule_id'] ?? null,
            $auth['userId'] ?? $auth['id'] ?? 1,
            $input['submitted_by'] ?? null,
            $input['note'] ?? '',
        ]);
        apiJson(['data' => $result[0] ?? [], 'message' => 'Tạo phiếu thu thành công'], 201);
    }

    if ($method === 'GET') {
        // GET /api/v1/payments
        $auth = apiRequireRole(['admin', 'accountant', 'staff']);
        $where = [];
        $params = [];
        if (!empty($query['status'])) { $where[] = 'p.status = ?'; $params[] = $query['status']; }
        if (!empty($query['enrollment_id'])) { $where[] = 'p.enrollment_id = ?'; $params[] = (int)$query['enrollment_id']; }
        if (!empty($query['date_from'])) { $where[] = 'p.payment_date >= ?'; $params[] = $query['date_from']; }
        if (!empty($query['date_to'])) { $where[] = 'p.payment_date <= ?'; $params[] = $query['date_to'] . ' 23:59:59'; }
        $whereSQL = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $page = max(1, (int)($query['page'] ?? 1));
        $perPage = min(100, max(1, (int)($query['per_page'] ?? 20)));
        $total = (int)DB::selectOne("SELECT COUNT(*) AS c FROM payments p {$whereSQL}", $params)['c'];

        $sql = "SELECT p.*, e.enrollment_code, u.full_name AS student_name
                FROM payments p
                JOIN enrollments e ON p.enrollment_id = e.id
                JOIN users u ON e.student_id = u.id
                {$whereSQL} ORDER BY p.payment_date DESC " . DB::paginate($page, $perPage);
        $items = DB::select($sql, $params);
        apiJson(['data' => ['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $perPage]]);
    }
}

// =====================================================================
// 2.3 AGENTS (/api/v1/agents)
// =====================================================================
if ($resource === 'agents') {
    if ($method === 'GET' && $action === 'commissions') {
        // GET /api/v1/agents/{id}/commissions?month=2026-08
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff']);
        $agentId = (int)$id;
        $month = $query['month'] ?? date('Y-m');

        $ag = DB::selectOne("SELECT * FROM agents WHERE id = ?", [$agentId]);
        if (!$ag) apiJson(['success' => false, 'message' => 'Không tìm thấy đại lý'], 404);

        $data = DB::selectOne("SELECT COALESCE(SUM(cd.payment_amount), 0) AS total_collected,
                               COALESCE(SUM(cd.commission_amount), 0) AS commission_amount,
                               COUNT(DISTINCT cd.enrollment_id) AS total_students
                               FROM commission_details cd
                               JOIN payments p ON cd.payment_id = p.id
                               WHERE cd.agent_id = ? AND cd.period = ? AND p.status = 'approved'",
                               [$agentId, $month]);

        apiJson(['data' => [
            'agent_code' => $ag['agent_code'],
            'agent_name' => $ag['name'],
            'commission_rate' => (float)$ag['commission_rate'],
            'period' => $month,
            'total_students' => (int)($data['total_students'] ?? 0),
            'total_collected' => (int)($data['total_collected'] ?? 0),
            'commission_amount' => (int)($data['commission_amount'] ?? 0),
        ]]);
    }

    if ($method === 'POST' && $action === 'payouts') {
        // POST /api/v1/agents/{id}/payouts → sp_settle_commission
        $auth = apiRequireRole(['admin', 'accountant']);
        $input = apiInput();
        $periodStart = $input['period_start'] ?? date('Y-m-01');
        $periodEnd = $input['period_end'] ?? date('Y-m-t');
        $result = DB::call('sp_settle_commission', [
            (int)$id,
            $periodStart,
            $periodEnd,
            $auth['userId'] ?? $auth['id'] ?? 1,
        ]);
        apiJson(['data' => $result[0] ?? [], 'message' => 'Quyết toán hoa hồng thành công']);
    }

    if ($method === 'GET' && $id) {
        // GET /api/v1/agents/{id}
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff']);
        $ag = DB::selectOne("SELECT * FROM agents WHERE id = ?", [(int)$id]);
        if (!$ag) apiJson(['success' => false, 'message' => 'Không tìm thấy đại lý'], 404);
        // Kèm danh sách học viên
        $ag['students'] = DB::select("SELECT e.*, u.full_name AS student_name FROM enrollments e
                                      JOIN users u ON e.student_id = u.id WHERE e.agent_id = ? ORDER BY e.created_at DESC", [(int)$id]);
        apiJson(['data' => $ag]);
    }

    if ($method === 'GET') {
        // GET /api/v1/agents
        $auth = apiRequireRole(['admin', 'accountant', 'sale', 'staff']);
        $items = DB::select("SELECT * FROM agents WHERE status = 'active' ORDER BY name");
        apiJson(['data' => $items]);
    }

    if ($method === 'POST') {
        // POST /api/v1/agents → create
        $auth = apiRequireRole(['admin']);
        $input = apiInput();
        $code = $input['agent_code'] ?? ('DL-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
        $id = DB::insert("INSERT INTO agents (agent_code, name, phone, email, address, commission_rate) VALUES (?, ?, ?, ?, ?, ?)",
            [$code, $input['name'], $input['phone'] ?? '', $input['email'] ?? '', $input['address'] ?? '',
             (float)($input['commission_rate'] ?? 0)]);
        $ag = DB::selectOne("SELECT * FROM agents WHERE id = ?", [(int)$id]);
        apiJson(['data' => $ag, 'message' => 'Tạo đại lý thành công'], 201);
    }
}

// =====================================================================
// 2.4 STUDENT PORTAL (/api/v1/student-portal)
// =====================================================================
if ($resource === 'student-portal') {
    if ($action === 'exam-eligibility') {
        // GET /api/v1/student-portal/exam-eligibility
        $auth = apiRequireRole(['student']);
        $studentId = $auth['userId'] ?? $auth['id'] ?? 0;
        $enr = DB::selectOne("SELECT enrollment_code, payment_status, eligible_for_exam, paid_amount, final_amount
                              FROM enrollments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1", [(int)$studentId]);
        if (!$enr) apiJson(['success' => false, 'message' => 'Bạn chưa có hồ sơ đăng ký nào'], 404);
        apiJson(['data' => [
            'eligible' => (bool)$enr['eligible_for_exam'],
            'payment_status' => $enr['payment_status'],
            'paid' => (int)$enr['paid_amount'],
            'total' => (int)$enr['final_amount'],
            'message' => $enr['eligible_for_exam'] ? 'Bạn đủ điều kiện tham gia thi' : 'Bạn cần hoàn thành học phí để được thi',
        ]]);
    }

    if ($action === 'my-tuition') {
        // GET /api/v1/student-portal/my-tuition
        $auth = apiRequireRole(['student']);
        $studentId = $auth['userId'] ?? $auth['id'] ?? 0;
        $enrollments = DB::select("SELECT e.*, c.name AS course_name FROM enrollments e
                                   JOIN courses c ON e.course_id = c.id
                                   WHERE e.student_id = ? ORDER BY e.created_at DESC", [(int)$studentId]);

        foreach ($enrollments as &$enr) {
            $enr['schedules'] = DB::select("SELECT * FROM payment_schedules WHERE enrollment_id = ? ORDER BY installment_num", [$enr['id']]);
            $enr['payments'] = DB::select("SELECT * FROM payments WHERE enrollment_id = ? AND status = 'approved' ORDER BY payment_date DESC", [$enr['id']]);
            $enr['next_due'] = DB::selectOne("SELECT * FROM payment_schedules WHERE enrollment_id = ? AND status != 'completed' ORDER BY due_date LIMIT 1", [$enr['id']]);
        }

        apiJson(['data' => $enrollments]);
    }
}

// =====================================================================
// 2.5 BÁO CÁO (/api/v1/reports)
// =====================================================================
if ($resource === 'reports') {
    if ($action === 'revenue') {
        // GET /api/v1/reports/revenue
        $auth = apiRequireRole(['admin', 'accountant']);
        $rows = DB::select("SELECT * FROM v_revenue_report");
        $summary = DB::selectOne("SELECT COUNT(*) AS total_enrollments,
                                  SUM(CASE WHEN payment_status = 'fully_paid' THEN 1 ELSE 0 END) AS fully_paid,
                                  SUM(CASE WHEN payment_status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid,
                                  SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid,
                                  SUM(final_amount) AS pipeline_value,
                                  SUM(paid_amount) AS total_collected,
                                  SUM(remaining_amount) AS total_outstanding
                                  FROM enrollments WHERE payment_status != 'exempt'");
        apiJson(['data' => ['monthly' => $rows, 'summary' => $summary]]);
    }

    if ($action === 'agency') {
        // GET /api/v1/reports/agency
        $auth = apiRequireRole(['admin', 'accountant']);
        $rows = DB::select("SELECT * FROM v_agency_commissions");
        apiJson(['data' => $rows]);
    }

    if ($action === 'debts') {
        // GET /api/v1/reports/debts → phân loại theo Sale/Đại lý
        $auth = apiRequireRole(['admin', 'accountant', 'sale']);
        $bySale = DB::select("SELECT COALESCE(s.full_name, 'Không có sale') AS sale_name,
                              COUNT(*) AS count, SUM(e.remaining_amount) AS total_debt
                              FROM enrollments e LEFT JOIN users s ON e.sale_id = s.id
                              WHERE e.remaining_amount > 0 GROUP BY e.sale_id, s.full_name
                              ORDER BY total_debt DESC");
        $byAgent = DB::select("SELECT COALESCE(a.name, 'Không có đại lý') AS agent_name,
                               COUNT(*) AS count, SUM(e.remaining_amount) AS total_debt
                               FROM enrollments e LEFT JOIN agents a ON e.agent_id = a.id
                               WHERE e.remaining_amount > 0 GROUP BY e.agent_id, a.name
                               ORDER BY total_debt DESC");
        apiJson(['data' => ['by_sale' => $bySale, 'by_agent' => $byAgent]]);
    }
}

// =====================================================================
// 2.6 COURSES (/api/v1/courses)
// =====================================================================
if ($resource === 'courses') {
    if ($method === 'GET' && $id) {
        $auth = apiRequireRole(['admin', 'staff', 'teacher']);
        $c = DB::selectOne("SELECT * FROM courses WHERE id = ?", [(int)$id]);
        if (!$c) apiJson(['success' => false, 'message' => 'Không tìm thấy khóa học'], 404);
        apiJson(['data' => $c]);
    }
    if ($method === 'GET') {
        $auth = apiRequireRole(['admin', 'staff', 'teacher', 'student', 'sale']);
        $items = DB::select("SELECT * FROM courses WHERE status = 'active' ORDER BY name");
        apiJson(['data' => $items]);
    }
    if ($method === 'POST') {
        $auth = apiRequireRole(['admin']);
        $input = apiInput();
        $id = DB::insert("INSERT INTO courses (code, name, tuition_fee, description) VALUES (?, ?, ?, ?)",
            [$input['code'], $input['name'], (float)($input['tuition_fee'] ?? 0), $input['description'] ?? '']);
        apiJson(['data' => ['id' => $id], 'message' => 'Tạo khóa học thành công'], 201);
    }
}

// Fallback
apiJson(['success' => false, 'message' => "Unknown resource: {$resource}", 'data' => null], 404);
