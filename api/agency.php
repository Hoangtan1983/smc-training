<?php
/**
 * SMC Training — Agency API v6 (MySQL Backend)
 * Endpoint: /api/agency.php
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth-lib.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://smc-training.com');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ──── Aliases ────
function jsonResponse($data, $code = 200) { alJsonResponse($data, $code); }
function jsonInput() { return alJsonInput(); }
function getClientIP() { return alGetClientIP(); }
function rateLimit($key, $max, $window, $msg) { return alRateLimit($key, $max, $window, $msg); }

// ──── Auth ────
$auth = alAuthenticate();

$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';
if (empty($path)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = strtok($uri, '?');
    if (preg_match('#^/api/(.+)$#', $uri, $m)) $path = $m[1];
}
$parts = array_values(array_filter(explode('/', $path)));

// ──── Helpers ────
function findAgencyById($id) {
    if (is_numeric($id)) return DB::selectOne("SELECT * FROM agents WHERE id=?", [(int)$id]);
    return DB::selectOne("SELECT * FROM agents WHERE agent_code=?", [$id]);
}

function findAgencyByUserId($userId) {
    // Tìm agent qua email của user (users.email = agents.email)
    $user = is_numeric($userId) ? DB::selectOne("SELECT email FROM users WHERE id=?", [(int)$userId]) : null;
    if ($user && !empty($user['email'])) {
        return DB::selectOne("SELECT * FROM agents WHERE email=? OR agent_code=? LIMIT 1", [$user['email'], $user['email']]);
    }
    return null;
}

function sanitizeAgency($a) {
    return [
        'id' => (string)$a['id'],
        'userId' => (string)($a['id'] ?? ''),
        'name' => $a['name'] ?? '',
        'code' => $a['agent_code'] ?? '',
        'contactPerson' => $a['contact_person'] ?? $a['name'] ?? '',
        'phone' => $a['phone'] ?? '',
        'email' => $a['email'] ?? '',
        'address' => $a['address'] ?? '',
        'taxCode' => $a['tax_code'] ?? '',
        'status' => $a['status'] ?? 'active',
        'discountPercent' => (float)($a['commission_rate'] ?? 0),
        'subjectType' => 'all',
        'allowedCourses' => [],
        'notes' => $a['notes'] ?? '',
        'createdAt' => $a['created_at'] ?? '',
        'createdBy' => '',
        'updatedAt' => $a['updated_at'] ?? '',
    ];
}

function getAgencyStudents($agencyId) {
    $rows = DB::select(
        "SELECT u.* FROM users u
         JOIN enrollments e ON e.student_id = u.id
         JOIN invoices i ON i.enrollment_id = e.id
         WHERE (i.agency_id = ? OR i.agency_name = (SELECT name FROM agents WHERE id=?))
         AND u.role = 'student'",
        [(string)$agencyId, (int)$agencyId]
    );
    return $rows;
}

// =====================================================================
// POST /api/agency/login
// =====================================================================
if ($method === 'POST' && ($parts[0] ?? '') === 'login') {
    $input = jsonInput();
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    if (!$email || !$password) jsonResponse(['error' => 'Vui lòng nhập email và mật khẩu'], 400);

    rateLimit('agency_login:' . getClientIP(), 5, 60, 'Quá nhiều lần đăng nhập');

    $user = DB::selectOne("SELECT * FROM users WHERE email=? OR phone=?", [$email, $email]);
    if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Email hoặc mật khẩu không đúng'], 401);
    }
    if (strtolower($user['role']) !== 'agency') jsonResponse(['error' => 'Tài khoản không phải Đại lý'], 403);
    if ($user['status'] !== 'active') jsonResponse(['error' => 'Tài khoản đại lý chưa được kích hoạt'], 403);

    $agency = findAgencyByUserId($user['id']);
    $token = alCreateToken([
        'id' => (string)$user['id'], 'email' => $user['email'] ?? '',
        'role' => $user['role'] ?? 'agency', 'userId' => $user['id'],
    ]);
    alSetTokenCookie($token);

    jsonResponse([
        'token' => $token,
        'user' => ['id' => (string)$user['id'], 'email' => $user['email'] ?? '', 'fullName' => $user['full_name'] ?? '', 'role' => strtoupper($user['role']), 'status' => strtoupper($user['status'])],
        'agency' => $agency ? sanitizeAgency($agency) : null,
    ]);
}

// =====================================================================
// GET /api/agency/me
// =====================================================================
if ($method === 'GET' && ($parts[0] ?? '') === 'me') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    // Tìm agency qua email của user
    $agency = DB::selectOne("SELECT * FROM agents WHERE email=? OR agent_code=?", [$auth['email'] ?? '', $auth['email'] ?? '']);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy thông tin đại lý'], 404);

    // Thống kê từ invoices trong MySQL
    $stats = DB::selectOne(
        "SELECT COUNT(DISTINCT e.student_id) AS student_count,
                COALESCE(SUM(e.total_amount),0) AS total_base_revenue,
                COALESCE(SUM(e.paid_amount),0) AS total_paid,
                COALESCE(SUM(e.remaining_amount),0) AS total_unpaid
         FROM enrollments e
         JOIN invoices i ON i.enrollment_id = e.id
         WHERE (i.agency_id = ? OR i.agency_name = ?)
           AND i.status NOT IN ('exempt','cancelled')",
        [(string)$agency['id'], $agency['name']]
    );

    $paidCount = (int)(DB::selectOne(
        "SELECT COUNT(*) AS c FROM invoices i
         WHERE (i.agency_id=? OR i.agency_name=?) AND i.status='paid'",
        [(string)$agency['id'], $agency['name']]
    )['c'] ?? 0);

    $result = sanitizeAgency($agency);
    $result['studentCount'] = (int)($stats['student_count'] ?? 0);
    $result['totalRevenue'] = (int)($stats['total_base_revenue'] ?? 0);
    $result['totalBaseRevenue'] = (int)($stats['total_base_revenue'] ?? 0);
    $result['totalPaidAmount'] = (int)($stats['total_paid'] ?? 0);
    $result['totalUnpaidAmount'] = (int)($stats['total_unpaid'] ?? 0);
    $result['paidCount'] = $paidCount;
    $result['unpaidCount'] = (int)($stats['student_count'] ?? 0) - $paidCount;
    $result['collectionRate'] = $result['totalBaseRevenue'] > 0 ? round($result['totalPaidAmount'] / $result['totalBaseRevenue'] * 100, 1) : 0;

    jsonResponse($result);
}

// =====================================================================
// GET /api/agency/list — Admin/Staff lấy danh sách đại lý
// =====================================================================
if ($method === 'GET' && ($parts[0] ?? '') === 'list') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array(strtolower($auth['role'] ?? ''), ['admin', 'staff', 'accountant'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $agencies = DB::select("SELECT * FROM agents ORDER BY name");
    $result = [];
    foreach ($agencies as $a) {
        $entry = sanitizeAgency($a);
        $studentCount = (int)(DB::selectOne(
            "SELECT COUNT(DISTINCT e.student_id) AS c FROM enrollments e
             JOIN invoices i ON i.enrollment_id=e.id
             WHERE (i.agency_id=? OR i.agency_name=?)",
            [(string)$a['id'], $a['name']]
        )['c'] ?? 0);
        $entry['studentCount'] = $studentCount;
        $entry['user'] = null; // Có thể JOIN sau nếu cần
        $result[] = $entry;
    }

    jsonResponse(['data' => $result, 'agencies' => $result]);
}

// =====================================================================
// GET /api/agency/get/{id} — Admin lấy chi tiết 1 đại lý
// =====================================================================
if ($method === 'GET' && ($parts[0] ?? '') === 'get' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array(strtolower($auth['role'] ?? ''), ['admin', 'staff'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $agency = findAgencyById($parts[1]);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    $result = sanitizeAgency($agency);
    $result['students'] = getAgencyStudents($agency['id']);

    // Thống kê học phí
    $tuitionStats = DB::selectOne(
        "SELECT COUNT(DISTINCT e.student_id) AS total_students,
                COALESCE(SUM(e.total_amount),0) AS total_tuition
         FROM enrollments e
         JOIN invoices i ON i.enrollment_id=e.id
         WHERE (i.agency_id=? OR i.agency_name=?)",
        [(string)$agency['id'], $agency['name']]
    );
    $result['stats'] = [
        'totalStudents' => (int)($tuitionStats['total_students'] ?? 0),
        'totalTuition' => (int)($tuitionStats['total_tuition'] ?? 0),
        'discountPercent' => (float)($agency['commission_rate'] ?? 0),
    ];

    jsonResponse(['agency' => $result]);
}

// =====================================================================
// POST /api/agency/create — Admin tạo đại lý mới
// =====================================================================
if ($method === 'POST' && ($parts[0] ?? '') === 'create') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (strtolower($auth['role'] ?? '') !== 'admin') jsonResponse(['error' => 'Forbidden - Chỉ ADMIN'], 403);

    $input = jsonInput();
    $name = trim($input['name'] ?? '');
    $code = trim($input['code'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $discountPercent = (float)($input['discountPercent'] ?? 0);

    if (!$name) jsonResponse(['error' => 'Tên đại lý không được để trống'], 400);
    if (!$email) jsonResponse(['error' => 'Email không được để trống'], 400);
    if ($discountPercent >= 100) jsonResponse(['error' => 'Chiết khấu phải nhỏ hơn 100%'], 400);

    $existingUser = DB::selectOne("SELECT id FROM users WHERE email=? OR phone=?", [$email, $email]);
    if ($existingUser) jsonResponse(['error' => 'Email đã được sử dụng'], 409);

    if ($code) {
        $existingCode = DB::selectOne("SELECT id FROM agents WHERE agent_code=?", [$code]);
        if ($existingCode) jsonResponse(['error' => 'Mã đại lý đã tồn tại'], 409);
    }

    DB::begin();
    try {
        // Tạo user account
        $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $userId = (int)DB::insert(
            "INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status) VALUES (?,?,?,?,?,?,'active')",
            [$userCode, $input['contactPerson'] ?? $name, $email, $input['phone'] ?? '', $hash, 'agency']
        );

        // Tạo agent
        $agentCode = $code ?: ('AG-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
        $agentId = (int)DB::insert(
            "INSERT INTO agents (agent_code, name, phone, email, address, commission_rate, status) VALUES (?,?,?,?,?,?,'active')",
            [$agentCode, $name, $input['phone'] ?? '', $email, $input['address'] ?? '', $discountPercent]
        );

        DB::commit();

        $agency = DB::selectOne("SELECT * FROM agents WHERE id=?", [$agentId]);
        jsonResponse(['agency' => sanitizeAgency($agency), 'userId' => (string)$userId], 201);
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }
}

// =====================================================================
// PUT /api/agency/update/{id} — Admin cập nhật đại lý
// =====================================================================
if ($method === 'PUT' && ($parts[0] ?? '') === 'update' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $isAdmin = strtolower($auth['role'] ?? '') === 'admin';
    $isAgency = strtolower($auth['role'] ?? '') === 'agency';
    if (!$isAdmin && !$isAgency) jsonResponse(['error' => 'Forbidden'], 403);

    $agency = findAgencyById($parts[1]);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    // Đại lý chỉ được sửa thông tin của CHÍNH MÌNH, không được sửa đại lý khác
    if ($isAgency) {
        $myAgency = DB::selectOne("SELECT id FROM agents WHERE email=? OR agent_code=?", [$auth['email'] ?? '', $auth['email'] ?? '']);
        if (!$myAgency || (string)$myAgency['id'] !== (string)$agency['id']) {
            jsonResponse(['error' => 'Bạn chỉ có thể sửa thông tin đại lý của mình'], 403);
        }
    }

    $input = jsonInput();
    // Đại lý KHÔNG được sửa chiết khấu (commission_rate) — chỉ Admin được sửa
    $commission = $isAgency ? $agency['commission_rate'] : (float)($input['discountPercent'] ?? $input['commission_rate'] ?? $agency['commission_rate']);
    DB::execute(
        "UPDATE agents SET agent_code=?, name=?, contact_person=?, phone=?, email=?, address=?, tax_code=?, notes=?, commission_rate=?, updated_at=NOW() WHERE id=?",
        [$input['code'] ?? $input['agent_code'] ?? $agency['agent_code'],
         $input['name'] ?? $agency['name'],
         $input['contactPerson'] ?? $input['contact_person'] ?? $agency['contact_person'],
         $input['phone'] ?? $agency['phone'],
         $input['email'] ?? $agency['email'],
         $input['address'] ?? $agency['address'],
         $input['taxCode'] ?? $input['tax_code'] ?? $agency['tax_code'],
         $input['notes'] ?? $agency['notes'],
         $commission, $agency['id']]
    );

    // Admin đổi mật khẩu tài khoản đăng nhập của đại lý
    if ($isAdmin && !empty($input['password'])) {
        $newPw = trim((string)$input['password']);
        if (strlen($newPw) < 6) jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);
        $agencyUser = DB::selectOne(
            "SELECT id FROM users WHERE role='agency' AND (email=? OR email=? OR phone=?)",
            [$agency['email'], $agency['agent_code'], $agency['email']]
        );
        if ($agencyUser) {
            DB::execute("UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?",
                [password_hash($newPw, PASSWORD_BCRYPT), (int)$agencyUser['id']]);
        }
    }

    $updated = DB::selectOne("SELECT * FROM agents WHERE id=?", [$agency['id']]);
    jsonResponse(['success' => true, 'agency' => sanitizeAgency($updated)]);
}

// =====================================================================
// DELETE /api/agency/delete/{id} — Admin xóa đại lý
// =====================================================================
if ($method === 'DELETE' && ($parts[0] ?? '') === 'delete' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (strtolower($auth['role'] ?? '') !== 'admin') jsonResponse(['error' => 'Forbidden - Chỉ ADMIN'], 403);

    $agency = findAgencyById($parts[1]);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    DB::execute("UPDATE agents SET status='inactive', updated_at=NOW() WHERE id=?", [$agency['id']]);
    jsonResponse(['success' => true, 'message' => 'Đã vô hiệu hóa đại lý']);
}

// =====================================================================
// GET /api/agency/my-students — Đại lý xem học viên của mình
// =====================================================================
if ($method === 'GET' && ($parts[0] ?? '') === 'my-students') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    $isAgencyRole = strtolower($auth['role'] ?? '') === 'agency';
    // Đại lý chỉ được xem học viên của CHÍNH MÌNH — bỏ qua agencyId từ query
    $agencyId = $isAgencyRole ? '' : ($_GET['agencyId'] ?? '');
    if (!$agencyId && strtolower($auth['role'] ?? '') === 'agency') {
        $agency = DB::selectOne("SELECT id FROM agents WHERE email=? OR agent_code=?", [$auth['email'] ?? '', $auth['email'] ?? '']);
        if ($agency) $agencyId = (string)$agency['id'];
    }

    if (!$agencyId) {
        if (in_array(strtolower($auth['role'] ?? ''), ['admin', 'staff'])) {
            $students = DB::select("SELECT u.* FROM users u WHERE u.role='student' ORDER BY u.full_name");
            jsonResponse(array_map(function($u) {
                return ['id'=>(string)$u['id'],'fullName'=>$u['full_name']??'','email'=>$u['email']??'','phone'=>$u['phone']??'','status'=>strtoupper($u['status'])];
            }, $students));
        }
        jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
    }

    $agency = findAgencyById($agencyId);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    $students = getAgencyStudents($agency['id']);
    jsonResponse(array_map(function($u) {
        return ['id'=>(string)$u['id'],'fullName'=>$u['full_name']??'','email'=>$u['email']??'','phone'=>$u['phone']??'','status'=>strtoupper($u['status'])];
    }, $students));
}

// =====================================================================
// POST /api/agency/assign-student — Gán học viên vào đại lý
// =====================================================================
if ($method === 'POST' && ($parts[0] ?? '') === 'assign-student') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array(strtolower($auth['role'] ?? ''), ['admin', 'staff'])) jsonResponse(['error' => 'Forbidden'], 403);

    $input = jsonInput();
    $studentId = (int)($input['studentId'] ?? 0);
    $agencyId = (string)($input['agencyId'] ?? '');

    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    $student = DB::selectOne("SELECT id FROM users WHERE id=?", [$studentId]);
    if (!$student) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    if ($agencyId !== '') {
        $agency = findAgencyById($agencyId);
        if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
        $agencyName = $agency['name'];
        $commission = (float)($agency['commission_rate'] ?? 0);
        $agencyIdValue = (string)$agency['id'];
    } else {
        // Gỡ học viên khỏi đại lý
        $agencyName = '';
        $commission = 0;
        $agencyIdValue = null;
    }

    // Cập nhật users.agency_id để danh sách học viên hiển thị đúng đại lý
    DB::execute("UPDATE users SET agency_id=?, updated_at=NOW() WHERE id=?",
        [$agencyIdValue, $studentId]);

    // Cập nhật tất cả invoices + tính lại final_price theo chiết khấu (base_price × (100 - commission)/100)
    DB::execute(
        "UPDATE invoices i JOIN enrollments e ON i.enrollment_id=e.id
         SET i.agency_id=?, i.agency_name=?, i.agency_discount_percent=?,
             i.discount_amount = ROUND(i.base_price * ? / 100, 0),
             i.final_price = ROUND(i.base_price * (100 - ?) / 100, 0),
             i.updated_at=NOW()
         WHERE e.student_id=?",
        [$agencyIdValue, $agencyName, $commission, $commission, $commission, $studentId]
    );

    jsonResponse(['success' => true, 'message' => $agencyIdValue ? 'Đã gán học viên vào đại lý' : 'Đã gỡ học viên khỏi đại lý']);
}

// =====================================================================
// POST /api/agency/import-students — Đại lý import học viên
// =====================================================================
if ($method === 'POST' && ($parts[0] ?? '') === 'import-students') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    // Tạm khóa chức năng nhập học viên của Đại lý (quy trình mới: Đại lý gửi danh sách, Nhân viên nhập)
    if (strtolower($auth['role'] ?? '') === 'agency') {
        jsonResponse(['error' => 'Chức năng nhập học viên tạm khóa. Vui lòng gửi danh sách học viên cho Nhân viên SMC để nhập lên hệ thống.'], 403);
    }

    $input = jsonInput();
    $students = $input['students'] ?? [];
    if (empty($students) || !is_array($students)) jsonResponse(['error' => 'Thiếu danh sách học viên'], 400);

    // Nhân viên/Admin nhập học viên cho đại lý: đọc agencyId từ input để gán vào đại lý tương ứng
    $agency = null;
    $agencyIdInput = (int)($input['agencyId'] ?? 0);
    if ($agencyIdInput > 0) {
        $agency = DB::selectOne("SELECT * FROM agents WHERE id=?", [$agencyIdInput]);
        if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
    }

    $imported = 0;
    $skipped = 0;
    DB::begin();
    try {
        foreach ($students as $s) {
            $email = trim($s['email'] ?? '');
            $phone = trim($s['phone'] ?? '');
            $fullName = trim($s['fullName'] ?? $s['name'] ?? '');
            if (!$fullName || (!$email && !$phone)) { $skipped++; continue; }

            // Kiểm tra trùng: chỉ so theo trường KHÁC RỖNG (tránh email=''/phone='' khớp nhầm)
            $existing = null;
            if ($email !== '' && $phone !== '') {
                $existing = DB::selectOne("SELECT id FROM users WHERE email=? OR phone=?", [$email, $phone]);
            } elseif ($email !== '') {
                $existing = DB::selectOne("SELECT id FROM users WHERE email=?", [$email]);
            } elseif ($phone !== '') {
                $existing = DB::selectOne("SELECT id FROM users WHERE phone=?", [$phone]);
            }
            if ($existing) { $skipped++; continue; }

            $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));

            // Xác định HẠNG THI (A/B) — KHÔNG gán khoá học (Nhân viên sắp xếp khoá/lớp sau)
            $rankRaw = strtoupper(trim($s['rank'] ?? $s['examRank'] ?? $s['hangThi'] ?? ''));
            $rank = '';
            if ($rankRaw !== '') {
                if (str_contains($rankRaw, 'B')) {
                    $rank = 'B';
                } elseif (str_contains($rankRaw, 'A')) {
                    $rank = 'A';
                }
            }

            // Học viên PENDING, mật khẩu mặc định 123456, chờ Nhân viên duyệt (Duyệt sẽ tạo hồ sơ học phí theo Hạng thi)
            $hash = password_hash('123456', PASSWORD_BCRYPT);
            $studentId = (int)DB::insert(
                "INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status, rank_group, agency_id) VALUES (?,?,?,?,?,?,'pending',?,?)",
                [$userCode, $fullName, $email ?: $phone, $phone ?: $email, $hash, 'student', $rank, $agency ? (int)$agency['id'] : null]
            );

            $imported++;
        }
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    jsonResponse(['success' => true, 'imported' => $imported, 'skipped' => $skipped]);
}

// =====================================================================
// POST /api/agency/update-student — Đại lý cập nhật SĐT/email học viên
// =====================================================================
if ($method === 'POST' && ($parts[0] ?? '') === 'update-student') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $role = strtolower($auth['role'] ?? '');
    if (!in_array($role, ['admin', 'agency'])) jsonResponse(['error' => 'Forbidden'], 403);

    $input = jsonInput();
    $studentId = (int)($input['studentId'] ?? 0);
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');
    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);
    if ($phone === '' && $email === '') jsonResponse(['error' => 'Không có dữ liệu cần cập nhật'], 400);

    // Nếu là đại lý, kiểm tra học viên thuộc đại lý của mình
    if ($role === 'agency') {
        $agency = DB::selectOne("SELECT id FROM agents WHERE email=? OR agent_code=?", [$auth['email'] ?? '', $auth['email'] ?? '']);
        if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
        $owned = DB::selectOne(
            "SELECT i.id FROM invoices i JOIN enrollments e ON i.enrollment_id=e.id
             WHERE e.student_id=? AND i.agency_id=? LIMIT 1",
            [$studentId, (string)$agency['id']]
        );
        if (!$owned) jsonResponse(['error' => 'Học viên không thuộc đại lý của bạn'], 403);
    }

    // Kiểm tra email trùng (nếu có cập nhật email)
    if ($email !== '') {
        $dup = DB::selectOne("SELECT id FROM users WHERE email=? AND id != ?", [$email, $studentId]);
        if ($dup) jsonResponse(['error' => 'Email đã được sử dụng bởi học viên khác'], 409);
    }

    DB::begin();
    try {
        $userFields = [];
        $userParams = [];
        if ($phone !== '') { $userFields[] = 'phone=?'; $userParams[] = $phone; }
        if ($email !== '') { $userFields[] = 'email=?'; $userParams[] = $email; }
        $userParams[] = $studentId;
        DB::execute("UPDATE users SET " . implode(', ', $userFields) . ", updated_at=NOW() WHERE id=?", $userParams);

        // Đồng bộ xuống invoices (denormalized)
        $invFields = [];
        $invParams = [];
        if ($phone !== '') { $invFields[] = 'i.student_phone=?'; $invParams[] = $phone; }
        if ($email !== '') { $invFields[] = 'i.student_email=?'; $invParams[] = $email; }
        if (!empty($invFields)) {
            $invParams[] = $studentId;
            DB::execute(
                "UPDATE invoices i JOIN enrollments e ON i.enrollment_id=e.id
                 SET " . implode(', ', $invFields) . ", i.updated_at=NOW()
                 WHERE e.student_id=?",
                $invParams
            );
        }

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    jsonResponse(['success' => true, 'message' => 'Đã cập nhật thông tin học viên']);
}

// Fallback
jsonResponse(['error' => 'Unknown action: ' . ($path ?: '(empty)')], 404);
