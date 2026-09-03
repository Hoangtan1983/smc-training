<?php
/**
 * SMC Training API v6 — MySQL Backend
 * TẤT CẢ dữ liệu trong MySQL, không dùng JSON file.
 * URL: https://smc-training.com/api/auth.php
 */

date_default_timezone_set('Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
$allowedOrigin = 'https://smc-training.com';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && (str_ends_with($origin, '//smc-training.com') || str_ends_with($origin, '//www.smc-training.com'))) {
    $allowedOrigin = $origin;
}
header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ──── Shared Libraries ────
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth-lib.php';

// ──── Aliases for auth.php's own functions ────
function createToken($user) { return alCreateToken($user); }
function setTokenCookie($token) { alSetTokenCookie($token); }
function clearTokenCookie() { alClearTokenCookie(); }
function getTokenFromRequest() { return alGetToken(); }
function authenticate() { return alAuthenticate(); }
function requireRole($roles) { return alRequireRole($roles); }
function jsonResponse($data, $code = 200) { alJsonResponse($data, $code); }
function jsonInput() { return alJsonInput(); }
function getClientIP() { return alGetClientIP(); }
function rateLimit($key, $max, $window, $msg) { return alRateLimit($key, $max, $window, $msg); }

// ──── User Helpers (MySQL) ────
function findUserByEmail($email) {
    if (empty($email)) return null;
    $user = DB::selectOne("SELECT * FROM users WHERE email = ? OR phone = ?", [$email, $email]);
    if (!$user) return null;
    return mapDbUser($user);
}

function findUserById($id) {
    if (is_numeric($id)) {
        $user = DB::selectOne("SELECT * FROM users WHERE id = ?", [(int)$id]);
    } else {
        $user = DB::selectOne("SELECT * FROM users WHERE user_code = ?", [$id]);
    }
    if (!$user) return null;
    return mapDbUser($user);
}

function sanitizeUser($user) {
    // Hỗ trợ cả snake_case (raw MySQL từ DB::select) lẫn camelCase (đầu ra của mapDbUser)
    // vì login/register/me/users/{id} gọi findUserByEmail/findUserById → mapDbUser (camelCase),
    // trong khi users list gọi DB::select trực tiếp (snake_case).
    return [
        'id' => (string)($user['id'] ?? ''),
        'email' => $user['email'] ?? '',
        'phone' => $user['phone'] ?? '',
        'fullName' => $user['full_name'] ?? $user['fullName'] ?? '',
        'role' => strtoupper($user['role'] ?? 'student'),
        'status' => strtoupper($user['status'] ?? 'active'),
        'courseId' => $user['course_id'] ?? $user['courseId'] ?? '',
        'rank' => $user['rank_group'] ?? $user['rank'] ?? '',
        'agencyId' => $user['agency_id'] ?? $user['agencyId'] ?? '',
        'address' => $user['address'] ?? '',
        'notes' => $user['notes'] ?? '',
        'avatarUrl' => $user['avatar_url'] ?? $user['avatarUrl'] ?? '',
        'createdAt' => $user['created_at'] ?? $user['createdAt'] ?? '',
    ];
}

/** Map MySQL user row → legacy format */
function mapDbUser($row) {
    return [
        'id' => (string)$row['id'],
        'email' => $row['email'] ?? '',
        'phone' => $row['phone'] ?? '',
        'fullName' => $row['full_name'] ?? '',
        'password' => $row['password_hash'] ?? '',
        'role' => strtoupper($row['role'] ?? 'student'),
        'status' => strtoupper($row['status'] ?? 'active'),
        'courseId' => $row['course_id'] ?? '',
        'rank' => $row['rank_group'] ?? '',
        'agencyId' => $row['agency_id'] ?? '',
        'address' => $row['address'] ?? '',
        'notes' => $row['notes'] ?? '',
        'createdAt' => $row['created_at'] ?? '',
    ];
}

/** Map MySQL row → frontend format cho từng collection */
function mapDbRow($row, string $collection): array {
    switch ($collection) {
        case 'courses':
            return [
                'id' => (string)$row['id'],
                'code' => $row['code'] ?? '',
                'name' => $row['name'] ?? '',
                'price' => (float)($row['tuition_fee'] ?? 0),
                'description' => $row['description'] ?? '',
                'status' => $row['status'] ?? 'active',
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        case 'classes':
            $studentIds = array_map('strval', json_decode($row['student_ids'] ?? '[]', true) ?: []);
            $teacherIds = array_map('strval', json_decode($row['teacher_ids'] ?? '[]', true) ?: []);
            return [
                'id' => (string)$row['id'],
                'name' => $row['name'] ?? '',
                'course_id' => (string)$row['course_id'],
                'courseId' => (string)$row['course_id'],
                'teacherId' => (string)($row['teacher_id'] ?? ''),
                'teacher_ids' => $teacherIds,
                'max_students' => (int)($row['max_students'] ?? 20),
                'start_date' => $row['start_date'] ?? '',
                'end_date' => $row['end_date'] ?? '',
                'schedule' => json_decode($row['schedule'] ?? '[]', true) ?: [],
                'location' => $row['location'] ?? '',
                'type' => $row['type'] ?? 'offline',
                'rank' => $row['rank'] ?? 'A',
                'student_ids' => $studentIds,
                'status' => $row['status'] ?? 'active',
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        case 'exams':
            return [
                'id' => (string)$row['id'],
                'exam_code' => $row['exam_code'] ?? '',
                'name' => $row['name'] ?? '',
                'courseId' => (string)($row['course_id'] ?? ''),
                'rank' => $row['rank_group'] ?? '',
                'totalQuestions' => (int)($row['total_questions'] ?? 0),
                'timeLimit' => (int)($row['time_limit'] ?? 30),
                'passScore' => (int)($row['pass_score'] ?? 70),
                'questions' => json_decode($row['questions'] ?? '[]', true) ?: [],
                'status' => $row['status'] ?? 'active',
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        case 'fly_logs':
            return [
                'id' => (string)$row['id'],
                'student_id' => (string)$row['student_id'],
                'class_id' => (string)($row['class_id'] ?? ''),
                'date' => $row['flight_date'] ?? '',
                'duration_minutes' => (int)($row['duration_minutes'] ?? 0),
                'uav_model' => $row['uav_model'] ?? '',
                'location' => $row['location'] ?? '',
                'weather' => $row['weather'] ?? '',
                'notes' => $row['notes'] ?? '',
                'instructor' => $row['instructor'] ?? '',
                'logged_by' => (string)($row['logged_by'] ?? ''),
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        case 'attendance':
            return [
                'id' => (string)$row['id'],
                'student_id' => (string)$row['student_id'],
                'class_id' => (string)($row['class_id'] ?? ''),
                'date' => $row['attendance_date'] ?? '',
                'status' => $row['status'] ?? 'present',
                'logged_by' => (string)($row['logged_by'] ?? ''),
                'note' => $row['note'] ?? '',
                'createdAt' => $row['created_at'] ?? '',
            ];
        case 'certifications':
            return [
                'id' => (string)$row['id'],
                'cert_code' => $row['cert_code'] ?? '',
                'student_id' => (string)$row['student_id'],
                'enrollment_id' => (string)($row['enrollment_id'] ?? ''),
                'course_name' => $row['course_name'] ?? '',
                'issued_date' => $row['issued_date'] ?? '',
                'expiry_date' => $row['expiry_date'] ?? '',
                'status' => $row['status'] ?? 'issued',
                'notes' => $row['notes'] ?? '',
                'createdAt' => $row['created_at'] ?? '',
            ];
        case 'agencies':
            return [
                'id' => (string)$row['id'],
                'code' => $row['agent_code'] ?? '',
                'name' => $row['name'] ?? '',
                'contactPerson' => $row['contact_person'] ?? '',
                'phone' => $row['phone'] ?? '',
                'email' => $row['email'] ?? '',
                'address' => $row['address'] ?? '',
                'discountPercent' => (float)($row['commission_rate'] ?? 0),
                'taxCode' => $row['tax_code'] ?? '',
                'notes' => $row['notes'] ?? '',
                'status' => $row['status'] ?? 'active',
                'createdAt' => $row['created_at'] ?? '',
            ];
        case 'tuitions':
            return [
                'id' => (string)$row['id'],
                'studentId' => (string)$row['student_id'],
                'studentName' => $row['student_name'] ?? $row['full_name'] ?? '',
                'courseId' => (string)$row['course_id'],
                'courseName' => $row['course_name'] ?? '',
                'amount' => (float)($row['final_amount'] ?? $row['total_amount'] ?? 0),
                'baseAmount' => (float)($row['total_amount'] ?? 0),
                'paidAmount' => (float)($row['paid_amount'] ?? 0),
                'step' => ($row['payment_status'] ?? '') === 'fully_paid' ? 'paid' : (($row['paid_amount'] ?? 0) > 0 ? 'partial' : 'pending'),
                'status' => $row['payment_status'] ?? 'unpaid',
                'enrollment_status' => $row['enrollment_status'] ?? 'pending',
                'course_name' => $row['course_name'] ?? '',
                'student_name' => $row['student_name'] ?? '',
                'payment_status' => $row['payment_status'] ?? 'unpaid',
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        case 'enrollments':
            return [
                'id' => (string)$row['id'],
                'enrollment_code' => $row['enrollment_code'] ?? '',
                'student_id' => (string)$row['student_id'],
                'course_id' => (string)$row['course_id'],
                'course_name' => $row['course_name'] ?? '',
                'student_name' => $row['student_name'] ?? '',
                'total_amount' => (float)($row['total_amount'] ?? 0),
                'final_amount' => (float)($row['final_amount'] ?? 0),
                'paid_amount' => (float)($row['paid_amount'] ?? 0),
                'remaining_amount' => (float)($row['remaining_amount'] ?? 0),
                'payment_status' => $row['payment_status'] ?? 'unpaid',
                'enrollment_status' => $row['enrollment_status'] ?? 'pending',
                'status' => $row['enrollment_status'] ?? 'pending',
                'training_stages' => json_decode($row['training_stages'] ?? '{}', true) ?: [],
                'eligible_for_exam' => (bool)($row['eligible_for_exam'] ?? false),
                'approval_staff_by' => $row['approval_staff_by'] ?? null,
                'approval_staff_name' => $row['approval_staff_name'] ?? null,
                'approval_staff_at' => $row['approval_staff_at'] ?? null,
                'approval_staff_note' => $row['approval_staff_note'] ?? null,
                'approval_accountant_by' => $row['approval_accountant_by'] ?? null,
                'approval_accountant_name' => $row['approval_accountant_name'] ?? null,
                'approval_accountant_at' => $row['approval_accountant_at'] ?? null,
                'approval_accountant_note' => $row['approval_accountant_note'] ?? null,
                'approval_admin_by' => $row['approval_admin_by'] ?? null,
                'approval_admin_name' => $row['approval_admin_name'] ?? null,
                'approval_admin_at' => $row['approval_admin_at'] ?? null,
                'approval_admin_note' => $row['approval_admin_note'] ?? null,
                'createdAt' => $row['created_at'] ?? '',
                'updatedAt' => $row['updated_at'] ?? '',
            ];
        default:
            return $row;
    }
}

// ──── Maintenance Mode (giữ JSON file nhỏ — quá đơn giản để cần MySQL) ────
function isMaintenanceMode() {
    $f = __DIR__ . '/data/maintenance.json';
    if (!file_exists($f)) return false;
    $d = json_decode(file_get_contents($f), true);
    return !empty($d['enabled']);
}
function getMaintenanceInfo() {
    $f = __DIR__ . '/data/maintenance.json';
    if (!file_exists($f)) return ['enabled' => false];
    return json_decode(file_get_contents($f), true) ?: ['enabled' => false];
}
function setMaintenanceMode($enabled, $updatedBy, $note = '') {
    $f = __DIR__ . '/data/maintenance.json';
    $data = ['enabled' => $enabled, 'updatedAt' => date('c'), 'updatedBy' => $updatedBy, 'note' => $note];
    return file_put_contents($f, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

// ──── Router ────
$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';
if (empty($path)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = strtok($uri, '?');
    if (preg_match('#^/api/(.+)$#', $uri, $m)) $path = $m[1];
}
$parts = array_values(array_filter(explode('/', $path)));

// =====================================================================
// AUTH ROUTES
// =====================================================================
if (in_array($parts[0] ?? '', ['auth', 'login', 'register', 'me']) || empty($parts[0])) {

    // POST login
    if ($method === 'POST' && in_array($parts[0] ?? $parts[1] ?? '', ['login'])) {
        $input = jsonInput();
        $email = $input['email'] ?? ''; $password = $input['password'] ?? '';
        if (!$email || !$password) jsonResponse(['error' => 'Vui lòng nhập email và mật khẩu'], 400);

        rateLimit('login_ip:' . getClientIP(), 30, 60, 'Quá nhiều lần đăng nhập từ IP này.');
        rateLimit('login_email:' . strtolower($email), 10, 60, 'Quá nhiều lần đăng nhập cho tài khoản này.');

        $user = findUserByEmail($email);
        if (!$user || empty($user['password']) || !password_verify($password, $user['password'])) {
            jsonResponse(['error' => 'Số điện thoại/Email hoặc mật khẩu không đúng'], 401);
        }
        if ($user['status'] === 'PENDING') jsonResponse(['error' => 'Tài khoản đang chờ duyệt.'], 403);
        if ($user['status'] !== 'ACTIVE') jsonResponse(['error' => 'Tài khoản đã bị khóa.'], 403);

        if (isMaintenanceMode() && in_array($user['role'] ?? '', ['STUDENT', 'AGENCY'])) {
            $info = getMaintenanceInfo();
            jsonResponse(['error' => 'Hệ thống đang bảo trì. ' . ($info['note'] ?? '')], 503);
        }

        $token = createToken($user);
        setTokenCookie($token);
        jsonResponse(['token' => $token, 'user' => sanitizeUser($user)]);
    }

    // POST register
    // Đăng ký công khai: tạo tài khoản PENDING + Hạng thi (A/B).
    // KHÔNG kích hoạt, KHÔNG tự tạo hồ sơ học phí — hồ sơ do Nhân viên duyệt (approve-student),
    // Kế toán ghi nhận tiền, Admin duyệt cuối mới chuyển ACTIVE.
    if ($method === 'POST' && in_array($parts[0] ?? $parts[1] ?? '', ['register'])) {
        rateLimit('register_ip:' . getClientIP(), 30, 3600, 'Quá nhiều đăng ký từ IP này');

        $input = jsonInput();
        $email = $input['email'] ?? ''; $password = $input['password'] ?? '';
        $fullName = $input['fullName'] ?? ''; $phone = $input['phone'] ?? '';

        // Khóa học / Hạng thi BẮT BUỘC — xác định Hạng A/B để đồng bộ học phí khi Nhân viên duyệt
        $courseVal = strtoupper(trim((string)($input['rank'] ?? $input['course'] ?? $input['courseId'] ?? '')));
        $rank = '';
        if ($courseVal === 'A' || $courseVal === 'B') {
            $rank = $courseVal;
        } elseif ($courseVal === 'C001') {
            $rank = 'A'; // giá trị khóa cũ của form đăng ký
        } elseif ($courseVal === 'C002' || $courseVal === 'C003') {
            $rank = 'B'; // giá trị khóa cũ của form đăng ký
        } elseif ($courseVal !== '') {
            if (str_contains($courseVal, 'B')) $rank = 'B';
            elseif (str_contains($courseVal, 'A')) $rank = 'A';
        }

        if (!$email || !$password || !$fullName) jsonResponse(['error' => 'Vui lòng nhập đầy đủ thông tin'], 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) && !preg_match('/^\d{9,11}$/', $email)) jsonResponse(['error' => 'Email hoặc số điện thoại không hợp lệ'], 400);
        if (strlen($password) < 6) jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);
        if ($rank !== 'A' && $rank !== 'B') jsonResponse(['error' => 'Vui lòng chọn khóa học (Hạng A — VLOS hoặc Hạng B — BVLOS)'], 400);
        if (findUserByEmail($email)) jsonResponse(['error' => 'Email hoặc số điện thoại đã được sử dụng'], 409);

        $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $userId = (int)DB::insert(
            "INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status, rank_group) VALUES (?,?,?,?,?,?,'pending',?)",
            [$userCode, $fullName, $email, $phone ?: $email, $hash, 'student', $rank]
        );

        $user = findUserByEmail($email);
        jsonResponse([
            'success' => true,
            'message' => 'Đăng ký thành công! Tài khoản đang chờ Nhân viên duyệt.',
            'user' => sanitizeUser($user),
        ], 201);
    }

    // GET me
    if ($method === 'GET' && in_array($parts[0] ?? $parts[1] ?? '', ['me'])) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $user = findUserById($auth['id']);
        if (!$user) jsonResponse(['error' => 'User not found'], 404);
        jsonResponse(sanitizeUser($user));
    }
}

// POST logout
if (($parts[0] ?? '') === 'logout') {
    clearTokenCookie();
    jsonResponse(['success' => true]);
}

// POST change-password
if (($parts[0] ?? '') === 'change-password') {
    $auth = requireRole(['ADMIN','STAFF','TEACHER','STUDENT','AGENCY','admin','staff','teacher','student','agency']);
    $input = jsonInput();
    $current = $input['currentPassword'] ?? '';
    $newPw = $input['newPassword'] ?? '';
    if (!$current || !$newPw) jsonResponse(['error' => 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới'], 400);
    if (strlen($newPw) < 6) jsonResponse(['error' => 'Mật khẩu mới phải có ít nhất 6 ký tự'], 400);

    $user = findUserById($auth['id']);
    if (!$user || !password_verify($current, $user['password'])) {
        jsonResponse(['error' => 'Mật khẩu hiện tại không đúng'], 403);
    }
    DB::execute("UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?", [password_hash($newPw, PASSWORD_BCRYPT), (int)$user['id']]);
    jsonResponse(['success' => true, 'message' => 'Đổi mật khẩu thành công']);
}

// POST forgot-password
if (($parts[0] ?? '') === 'forgot-password') {
    rateLimit('forgot_pw:' . getClientIP(), 2, 1800, 'Quá nhiều yêu cầu reset mật khẩu');

    $input = jsonInput();
    $email = $input['email'] ?? '';
    if (!$email) jsonResponse(['error' => 'Vui lòng nhập email'], 400);

    $user = findUserByEmail($email);
    if ($user) {
        $token = bin2hex(random_bytes(32));
        $tokenHash = password_hash($token, PASSWORD_BCRYPT);
        DB::insert(
            "INSERT INTO password_resets (email, token_hash, expires_at, ip_address) VALUES (?,?,?,?)",
            [$email, $tokenHash, date('Y-m-d H:i:s', time() + 1800), getClientIP()]
        );
        // Gửi email reset (dùng mail() đơn giản hoặc SMTP)
        $resetLink = 'https://smc-training.com/reset-password?token=' . urlencode($token) . '&email=' . urlencode($email);
        @mail($email, '[SMC Training] Đặt lại mật khẩu', "Link đặt lại mật khẩu: $resetLink\nLink có hiệu lực trong 30 phút.");
    }
    jsonResponse(['success' => true, 'message' => 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu.']);
}

// POST reset-password
if (($parts[0] ?? '') === 'reset-password') {
    $input = jsonInput();
    $email = $input['email'] ?? '';
    $token = $input['token'] ?? '';
    $newPw = $input['newPassword'] ?? '';
    if (!$email || !$token || !$newPw) jsonResponse(['error' => 'Thiếu thông tin'], 400);
    if (strlen($newPw) < 6) jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);

    $resets = DB::select(
        "SELECT * FROM password_resets WHERE email=? AND used=0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [$email]
    );
    $valid = false;
    foreach ($resets as $r) {
        if (password_verify($token, $r['token_hash'])) { $valid = true; break; }
    }
    if (!$valid) jsonResponse(['error' => 'Token không hợp lệ hoặc đã hết hạn'], 400);

    DB::begin();
    try {
        DB::execute("UPDATE users SET password_hash=?, updated_at=NOW() WHERE email=?", [password_hash($newPw, PASSWORD_BCRYPT), $email]);
        DB::execute("UPDATE password_resets SET used=1 WHERE email=? AND used=0", [$email]);
        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }
    jsonResponse(['success' => true, 'message' => 'Đặt lại mật khẩu thành công']);
}

// POST assign-class
if (($parts[0] ?? '') === 'assign-class') {
    $auth = requireRole(['ADMIN','STAFF','admin','staff']);
    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $classId = $input['classId'] ?? '';
    $oldClassId = $input['oldClassId'] ?? '';

    if (!$studentId || !$classId) jsonResponse(['error' => 'Thiếu studentId hoặc classId'], 400);

    $student = findUserById($studentId);
    if (!$student) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    DB::begin();
    try {
        // Remove from old class
        if ($oldClassId) {
            $oldClass = DB::selectOne("SELECT * FROM classes WHERE id=?", [(int)$oldClassId]);
            if ($oldClass) {
                $oldStudentIds = json_decode($oldClass['student_ids'] ?? '[]', true) ?: [];
                $oldStudentIds = array_values(array_filter($oldStudentIds, fn($s) => (string)$s !== (string)$studentId));
                DB::execute("UPDATE classes SET student_ids=?, updated_at=NOW() WHERE id=?", [json_encode($oldStudentIds), (int)$oldClassId]);
            }
        }

        // Add to new class
        $newClass = DB::selectOne("SELECT * FROM classes WHERE id=?", [(int)$classId]);
        if (!$newClass) jsonResponse(['error' => 'Không tìm thấy lớp học'], 404);

        $newStudentIds = json_decode($newClass['student_ids'] ?? '[]', true) ?: [];
        if (in_array((string)$studentId, array_map('strval', $newStudentIds))) {
            DB::commit();
            jsonResponse(['success' => true, 'message' => 'Học viên đã có trong lớp này']);
        }
        if (count($newStudentIds) >= (int)($newClass['max_students'] ?? 999)) {
            DB::rollback();
            jsonResponse(['error' => 'Lớp đã đầy (tối đa ' . $newClass['max_students'] . ' học viên)'], 400);
        }
        $newStudentIds[] = (string)$studentId;
        DB::execute("UPDATE classes SET student_ids=?, updated_at=NOW() WHERE id=?", [json_encode($newStudentIds), (int)$classId]);

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }
    jsonResponse(['success' => true, 'message' => 'Đã xếp lớp thành công']);
}

// POST update-stage
if (($parts[0] ?? '') === 'update-stage') {
    $auth = requireRole(['ADMIN','STAFF','TEACHER','admin','staff','teacher']);
    $input = jsonInput();
    $studentId = $input['studentId'] ?? $input['student_id'] ?? '';
    $stage = $input['stage'] ?? '';
    $status = $input['status'] ?? 'completed';

    if (!$studentId || !$stage) jsonResponse(['error' => 'Thiếu studentId hoặc stage'], 400);

    $mysqlStudentId = is_numeric($studentId) ? (int)$studentId : (int)(findUserById($studentId)['id'] ?? 0);
    if (!$mysqlStudentId) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    $enr = DB::selectOne("SELECT * FROM enrollments WHERE student_id=? ORDER BY created_at DESC LIMIT 1", [$mysqlStudentId]);
    if (!$enr) jsonResponse(['error' => 'Không tìm thấy hồ sơ đăng ký'], 404);

    $stages = json_decode($enr['training_stages'] ?? '{}', true) ?: [];
    $stages[$stage] = [
        'status' => $status,
        'completed_at' => date('c'),
        'confirmed_by' => $auth['id'],
    ];

    DB::execute("UPDATE enrollments SET training_stages=?, updated_at=NOW() WHERE id=?",
        [json_encode($stages), $enr['id']]);

    // Auto-certify nếu tất cả stages completed
    if ($status === 'completed') {
        $allDone = true;
        foreach (['enrollment','theory','practice','exam','certification'] as $s) {
            if (($stages[$s]['status'] ?? '') !== 'completed') { $allDone = false; break; }
        }
        if ($allDone) {
            $certCode = 'CERT-' . date('Y') . '-' . str_pad($mysqlStudentId, 4, '0', STR_PAD_LEFT);
            $course = DB::selectOne("SELECT * FROM courses WHERE id=?", [(int)$enr['course_id']]);
            DB::insert(
                "INSERT INTO certifications (cert_code, student_id, enrollment_id, course_name, rank_group, issued_date, status) VALUES (?,?,?,?,?,CURDATE(),'issued')",
                [$certCode, $mysqlStudentId, $enr['id'], $course['name'] ?? '', '']
            );
        }
    }

    jsonResponse(['success' => true, 'stage' => $stage, 'status' => $status]);
}

// ──── APPROVE STUDENT ────
// Duyệt tài khoản PENDING: kích hoạt + tạo hồ sơ học phí theo Hạng thi (A→VLOS, B→BVLOS) → chuyển Kế toán
if (($parts[0] ?? '') === 'approve-student') {
    $auth = requireRole(['ADMIN','STAFF','admin','staff']);
    $studentId = $parts[1] ?? ($_GET['studentId'] ?? '');
    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    $mysqlId = is_numeric($studentId) ? (int)$studentId : (int)(findUserById($studentId)['id'] ?? 0);
    if (!$mysqlId) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    $student = DB::selectOne("SELECT * FROM users WHERE id = ?", [$mysqlId]);
    if (!$student) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    $input = jsonInput();
    $rank = strtoupper(trim($student['rank_group'] ?? ''));
    $inputRank = strtoupper(trim($input['rank'] ?? ''));

    // Nếu học viên chưa có Hạng nhưng Nhân viên chọn Hạng khi duyệt → lưu lại và dùng
    if (($rank !== 'A' && $rank !== 'B') && ($inputRank === 'A' || $inputRank === 'B')) {
        $rank = $inputRank;
        DB::execute("UPDATE users SET rank_group=?, updated_at=NOW() WHERE id=?", [$rank, $mysqlId]);
    }

    // Vẫn chưa có Hạng thi → chưa tạo hồ sơ, nhắc bổ sung (không kích hoạt tài khoản)
    if ($rank !== 'A' && $rank !== 'B') {
        jsonResponse([
            'success' => true,
            'warning' => 'Học viên chưa có Hạng thi (A/B) nên chưa tạo hồ sơ học phí; vui lòng bổ sung Hạng thi cho học viên.',
            'needRank' => true,
        ]);
    }

    $courseCode = ($rank === 'B') ? 'BVLOS' : 'VLOS';
    $course = DB::selectOne("SELECT * FROM courses WHERE code = ?", [$courseCode]);
    if (!$course) jsonResponse(['success' => true, 'warning' => 'Không tìm thấy khóa học cho Hạng ' . $rank]);

    // Nếu đã có hồ sơ cho khóa này thì không tạo trùng
    $existing = DB::selectOne("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?", [$mysqlId, (int)$course['id']]);
    if ($existing) {
        jsonResponse(['success' => true, 'message' => 'Học viên đã có hồ sơ học phí', 'enrollmentId' => (string)$existing['id']]);
    }

    $userId = (int)$auth['id'];
    $staff = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [$userId]);

    // Xác định đại lý (nếu học viên do đại lý nhập) → gán agent_id + áp chiết khấu đại lý
    $agencyId = (int)($student['agency_id'] ?? 0);
    $discountPercent = 0; $discountAmount = 0; $agencyName = '';
    $basePrice = (int)$course['tuition_fee'];
    $finalPrice = $basePrice;
    if ($agencyId > 0) {
        $ag = DB::selectOne("SELECT commission_rate, name FROM agents WHERE id = ?", [$agencyId]);
        if ($ag) {
            $discountPercent = (float)$ag['commission_rate'];
            if ($discountPercent > 0 && $discountPercent < 100) {
                $discountAmount = (int)round($basePrice * $discountPercent / 100);
                $finalPrice = max(0, $basePrice - $discountAmount);
            }
            $agencyName = $ag['name'];
        }
    }

    // Sinh mã hồ sơ / hóa đơn duy nhất (MAX-based, khớp pattern assign-course)
    $enrSeq = (int)(DB::selectOne("SELECT MAX(CAST(RIGHT(enrollment_code, 4) AS UNSIGNED)) m FROM enrollments WHERE enrollment_code LIKE 'HS-%'")['m'] ?? 0) + 1;
    $enrCode = 'HS-' . date('Y') . '-' . str_pad($enrSeq, 4, '0', STR_PAD_LEFT);
    $stages = json_encode(['enrollment'=>['status'=>'pending'],'theory'=>['status'=>'pending'],'practice'=>['status'=>'pending'],'exam'=>['status'=>'pending'],'certification'=>['status'=>'pending']], JSON_UNESCAPED_UNICODE);

    DB::begin();
    try {
        $enrId = (int)DB::insert(
            "INSERT INTO enrollments (enrollment_code, student_id, course_id, agent_id, total_amount, discount_amount, final_amount, paid_amount, payment_status, enrollment_status, eligible_for_exam, training_stages, created_by)
             VALUES (?,?,?,?,?,?,?,0,'unpaid','pending',0,?,?)",
            [$enrCode, $mysqlId, (int)$course['id'], $agencyId ?: null, $basePrice, $discountAmount, $finalPrice, $stages, $userId]
        );

        $invSeq = (int)(DB::selectOne("SELECT MAX(CAST(RIGHT(invoice_code, 4) AS UNSIGNED)) m FROM invoices WHERE invoice_code LIKE 'INV-%'")['m'] ?? 0) + 1;
        $invCode = 'INV-' . date('Y') . '-' . str_pad($invSeq, 4, '0', STR_PAD_LEFT);
        DB::insert(
            "INSERT INTO invoices (invoice_code, enrollment_id, base_price, discount_amount, final_price, total_paid, status, agency_id, agency_name, agency_discount_percent, agency_discount_amount, student_name, student_email, student_phone, created_by)
             VALUES (?,?,?,?,?,0,'pending',?,?,?,?,?,?,?,?)",
            [$invCode, $enrId, $basePrice, $discountAmount, $finalPrice, $agencyId ? (string)$agencyId : '', $agencyName, $discountPercent, $discountAmount, $student['full_name'], $student['email'], $student['phone'], $userId]
        );

        // Đánh dấu Nhân viên đã duyệt hồ sơ (step='staff') → chuyển sang Kế toán
        DB::execute("UPDATE enrollments SET approval_staff_by = ?, approval_staff_at = NOW(), approval_staff_name = ?, updated_at = NOW() WHERE id = ?",
            [$userId, $staff['full_name'] ?? '', $enrId]);

        DB::commit();
    } catch (Exception $e) {
        DB::rollback();
        jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
    }

    jsonResponse(['success' => true, 'message' => 'Đã duyệt tài khoản và tạo hồ sơ học phí, chuyển cho Kế toán', 'enrollmentId' => (string)$enrId, 'enrollmentCode' => $enrCode]);
}

// ──── APPROVE / REJECT ENROLLMENT ────
if (($parts[0] ?? '') === 'approve-enrollment') {
    $auth = requireRole(['ADMIN','STAFF','ACCOUNTANT','admin','staff','accountant']);
    $input = jsonInput();
    $enrId = (int)($input['enrollmentId'] ?? $input['id'] ?? 0);
    if (!$enrId) jsonResponse(['error' => 'Thiếu enrollmentId'], 400);

    $step = $input['step'] ?? 'staff';
    $note = $input['note'] ?? '';
    $field = match($step) {
        'staff' => ['approval_staff_by','approval_staff_at','approval_staff_name'],
        'accountant' => ['approval_accountant_by','approval_accountant_at','approval_accountant_name'],
        'admin' => ['approval_admin_by','approval_admin_at','approval_admin_name'],
        default => [null, null, null]
    };
    if (!$field[0]) jsonResponse(['error' => 'Step không hợp lệ'], 400);

    // Mỗi bước duyệt chỉ đúng vai trò đó được làm. Không có kiểm tra này thì
    // Nhân viên hoặc Kế toán tự gửi step='admin' là kích hoạt được tài khoản,
    // phá vỡ quy trình ba cấp. ADMIN làm được mọi bước để gỡ hồ sơ kẹt.
    $callerRole = strtolower($auth['role'] ?? '');
    $allowedForStep = match($step) {
        'staff'      => ['staff', 'admin'],
        'accountant' => ['accountant', 'admin'],
        'admin'      => ['admin'],
        default      => []
    };
    if (!in_array($callerRole, $allowedForStep, true)) {
        jsonResponse(['error' => 'Không có quyền thực hiện bước duyệt này'], 403);
    }

    $paymentInfo = null;

    // Kế toán duyệt + nhập số tiền đã nộp → ghi nhận thanh toán (đủ/thiếu)
    if ($step === 'accountant') {
        $amount = (int)($input['amount'] ?? 0);
        if ($amount > 0) {
            $enr = DB::selectOne("SELECT * FROM enrollments WHERE id = ?", [$enrId]);
            if ($enr) {
                $final = (int)($enr['final_amount'] ?? 0);
                $curPaid = (int)($enr['paid_amount'] ?? 0);
                $newPaid = $curPaid + $amount;
                if ($final > 0 && $amount > $final - $curPaid) {
                    jsonResponse(['error' => 'Số tiền nộp vượt quá số tiền còn nợ'], 400);
                }

                $paySeq = (int)(DB::selectOne("SELECT COALESCE(MAX(id), 0) m FROM payments")['m'] ?? 0) + 1;
                $receiptCode = 'PT-' . date('Y') . '-' . str_pad($paySeq, 5, '0', STR_PAD_LEFT);
                $invRow = DB::selectOne("SELECT id FROM invoices WHERE enrollment_id = ? LIMIT 1", [$enrId]);
                $invoiceId = $invRow['id'] ?? null;

                $status = ($final > 0 && $newPaid >= $final) ? 'fully_paid' : (($newPaid > 0) ? 'partially_paid' : 'unpaid');
                $eligible = ($final > 0 && $newPaid >= $final) ? 1 : 0;

                DB::begin();
                try {
                    DB::insert(
                        "INSERT INTO payments (receipt_code, enrollment_id, invoice_id, amount, payment_method, collector_id, approved_by, status, note, approved_at)
                         VALUES (?,?,?,?,'cash',?,?,'approved',?,NOW())",
                        [$receiptCode, $enrId, $invoiceId, $amount, (int)$auth['id'], (int)$auth['id'], $note]
                    );

                    DB::execute("UPDATE enrollments SET paid_amount=?, payment_status=?, eligible_for_exam=?, updated_at=NOW() WHERE id=?",
                        [$newPaid, $status, $eligible, $enrId]);

                    if ($invoiceId) {
                        DB::execute("UPDATE invoices SET total_paid = total_paid + ?, updated_at = NOW() WHERE id=?",
                            [$amount, $invoiceId]);
                        // Set status theo final_amount (ngưỡng đóng đủ = giá sau chiết khấu), không phụ thuộc cột final_price
                        $st = ($final > 0 && $newPaid >= $final) ? 'paid' : ($newPaid > 0 ? 'partial' : 'pending');
                        DB::execute("UPDATE invoices SET status=? WHERE id=?", [$st, $invoiceId]);
                    }

                    DB::commit();

                    $paymentInfo = [
                        'paid' => $newPaid,
                        'final' => $final,
                        'remaining' => max(0, $final - $newPaid),
                        'paymentStatus' => $status,
                    ];
                } catch (Exception $e) {
                    DB::rollback();
                    jsonResponse(['error' => 'Lỗi ghi nhận thanh toán: ' . $e->getMessage()], 500);
                }
            }
        }
    }

    $approverName = '';
    $approver = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [(int)$auth['id']]);
    if ($approver) $approverName = $approver['full_name'] ?? '';

    DB::execute("UPDATE enrollments SET {$field[0]}=?, {$field[1]}=NOW(), {$field[2]}=?, updated_at=NOW() WHERE id=?",
        [$auth['id'], $approverName, $enrId]);

    if ($step === 'admin') {
        $enr = DB::selectOne("SELECT student_id FROM enrollments WHERE id=?", [$enrId]);
        if ($enr) {
            DB::execute("UPDATE users SET status='active', updated_at=NOW() WHERE id=?", [(int)$enr['student_id']]);
            // Kết thúc luồng duyệt 3 bước → hồ sơ chuyển sang 'active' (không còn 'pending')
            DB::execute("UPDATE enrollments SET enrollment_status='active', updated_at=NOW() WHERE id=?", [$enrId]);
        }
    }

    $resp = ['success' => true, 'message' => 'Đã duyệt hồ sơ'];
    if ($paymentInfo) $resp['payment'] = $paymentInfo;
    jsonResponse($resp);
}

if (($parts[0] ?? '') === 'reject-enrollment') {
    $auth = requireRole(['ADMIN','STAFF','admin','staff']);
    $input = jsonInput();
    $enrId = (int)($input['enrollmentId'] ?? 0);
    $reason = $input['reason'] ?? '';
    if (!$enrId) jsonResponse(['error' => 'Thiếu enrollmentId'], 400);
    DB::execute("UPDATE enrollments SET enrollment_status='cancelled', notes=CONCAT(IFNULL(notes,''), ' | Từ chối: ', ?), updated_at=NOW() WHERE id=?", [$reason, $enrId]);
    jsonResponse(['success' => true, 'message' => 'Đã từ chối hồ sơ']);
}

// =====================================================================
// handleCRUD — MySQL version
// =====================================================================
function handleCRUD($collection, $allowedRoles = ['ADMIN', 'STAFF'], $publicGet = false) {
    global $method, $parts;
    $idIdx = ($parts[0] === 'auth') ? 2 : 1;
    $itemId = $parts[$idIdx] ?? null;

    // Map collection → MySQL table
    $tableMap = [
        'courses' => 'courses', 'classes' => 'classes', 'enrollments' => 'enrollments',
        'attendance' => 'attendance', 'exams' => 'exams', 'fly_logs' => 'fly_logs',
        'certifications' => 'certifications', 'tuitions' => 'enrollments',
        'agencies' => 'agents', 'transactions' => 'payments',
    ];
    $table = $tableMap[$collection] ?? $collection;

    // GET collection
    if ($method === 'GET' && !$itemId) {
        if (!$publicGet) { $auth = requireRole($allowedRoles); } else { $auth = authenticate(); }

        if ($collection === 'enrollments') {
            $rows = DB::select(
                "SELECT e.*, c.name AS course_name, u.full_name AS student_name
                 FROM enrollments e JOIN courses c ON e.course_id=c.id
                 JOIN users u ON e.student_id=u.id ORDER BY e.created_at DESC"
            );
        } elseif ($collection === 'tuitions') {
            $rows = DB::select(
                "SELECT e.*, c.name AS course_name, c.tuition_fee, u.full_name AS student_name,
                 COALESCE(i.total_paid,0) AS invoice_total_paid, i.status AS invoice_status
                 FROM enrollments e JOIN courses c ON e.course_id=c.id
                 JOIN users u ON e.student_id=u.id
                 LEFT JOIN invoices i ON i.enrollment_id=e.id
                 ORDER BY e.created_at DESC"
            );
        } elseif ($collection === 'agencies') {
            $rows = DB::select("SELECT * FROM agents ORDER BY name");
        } elseif ($collection === 'transactions') {
            $rows = DB::select("SELECT p.*, u.full_name AS student_name FROM payments p JOIN enrollments e ON p.enrollment_id=e.id JOIN users u ON e.student_id=u.id ORDER BY p.created_at DESC");
        } else {
            $rows = DB::select("SELECT * FROM `{$table}` ORDER BY created_at DESC");
        }

        // STUDENT filter — chỉ lọc các collection thuộc sở hữu cá nhân;
        // classes/courses là dữ liệu dùng chung nên trả toàn bộ cho học viên
        if ($auth && strtoupper($auth['role'] ?? '') === 'STUDENT' && !in_array($collection, ['classes', 'courses'], true)) {
            $sid = $auth['id'];
            $rows = array_values(array_filter($rows, function($r) use ($sid, $collection) {
                $itemSid = $r['student_id'] ?? $r['studentId'] ?? '';
                $loggedBy = $r['logged_by'] ?? $r['loggedBy'] ?? '';
                return (string)$itemSid === (string)$sid || (string)$loggedBy === (string)$sid;
            }));
        }

        $mapped = array_map(fn($r) => mapDbRow($r, $collection), $rows);
        jsonResponse($mapped);
    }

    // GET by ID
    if ($method === 'GET' && $itemId) {
        if (!$publicGet) requireRole($allowedRoles);
        if ($collection === 'enrollments') {
            $row = DB::selectOne("SELECT e.*, c.name AS course_name, u.full_name AS student_name FROM enrollments e JOIN courses c ON e.course_id=c.id JOIN users u ON e.student_id=u.id WHERE e.student_id=? OR e.id=?", [$itemId, is_numeric($itemId) ? (int)$itemId : 0]);
        } elseif ($collection === 'enrollments' && !is_numeric($itemId)) {
            $row = DB::selectOne("SELECT e.*, c.name AS course_name, u.full_name AS student_name FROM enrollments e JOIN courses c ON e.course_id=c.id JOIN users u ON e.student_id=u.id WHERE e.student_id=?", [$itemId]);
        } else {
            $row = DB::selectOne("SELECT * FROM `{$table}` WHERE id=?", [is_numeric($itemId) ? (int)$itemId : 0]);
        }
        if (!$row) jsonResponse(['error' => 'Not found'], 404);
        jsonResponse(mapDbRow($row, $collection));
    }

    // POST create
    if ($method === 'POST' && !$itemId) {
        requireRole($allowedRoles);
        rateLimit('crud_post:' . getClientIP(), 100, 60, 'Quá nhiều thao tác');

        $input = jsonInput();
        switch ($collection) {
            case 'courses':
                $code = $input['code'] ?? ('CRS-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
                DB::insert("INSERT INTO courses (code, name, tuition_fee, description, status) VALUES (?,?,?,?,'active')",
                    [$code, $input['name'] ?? '', (float)($input['price'] ?? 0), $input['description'] ?? '']);
                break;
            case 'classes':
                $code = 'CLS-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
                $courseId = is_numeric($input['courseId'] ?? '') ? (int)$input['courseId'] : null;
                $teacherIds = $input['teacher_ids'] ?? (isset($input['teacherId']) && $input['teacherId'] !== '' ? [$input['teacherId']] : []);
                $teacherIds = is_array($teacherIds) ? array_values(array_unique(array_map('strval', $teacherIds))) : [];
                // Tự suy Hạng thi từ khóa học (VLOS→A, BVLOS→B) để không lệch rank với khóa
                $courseRank = '';
                if ($courseId) {
                    $cr = DB::selectOne("SELECT code FROM courses WHERE id = ?", [$courseId]);
                    if ($cr) {
                        $cc = strtoupper($cr['code'] ?? '');
                        if (str_contains($cc, 'B')) $courseRank = 'B';
                        elseif (str_contains($cc, 'A') || str_contains($cc, 'VLOS')) $courseRank = 'A';
                    }
                }
                $rank = $courseRank !== '' ? $courseRank : ($input['rank'] ?? 'A');
                DB::insert(
                    "INSERT INTO classes (class_code, name, course_id, teacher_id, max_students, start_date, end_date, schedule, location, type, student_ids, status, rank, teacher_ids)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?)",
                    [$code, $input['name'] ?? '', $courseId, !empty($teacherIds) ? (int)$teacherIds[0] : null,
                     (int)($input['max_students'] ?? 20), $input['startDate'] ?? null, $input['endDate'] ?? null,
                     json_encode($input['schedule'] ?? []), $input['room'] ?? $input['location'] ?? '',
                     $input['type'] ?? 'offline', json_encode([]), $rank, json_encode($teacherIds)]
                );
                break;
            case 'agencies':
                $name = trim($input['name'] ?? '');
                $email = trim($input['email'] ?? '');
                if (!$name || !$email) jsonResponse(['error' => 'Tên và email là bắt buộc'], 400);
                if (DB::selectOne("SELECT id FROM users WHERE email=? OR phone=?", [$email, $email])) jsonResponse(['error' => 'Email đã được sử dụng'], 409);
                $code = $input['code'] ?? ('AG-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
                $password = $input['password'] ?? '123456';
                $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
                $hash = password_hash($password, PASSWORD_BCRYPT);
                DB::insert("INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status) VALUES (?,?,?,?,?,?,'active')",
                    [$userCode, trim($input['contactPerson'] ?? '') ?: $name, $email, $input['phone'] ?? '', $hash, 'agency']);
                DB::insert(
                    "INSERT INTO agents (agent_code, name, phone, email, address, commission_rate, status) VALUES (?,?,?,?,?,?,'active')",
                    [$code, $name, $input['phone'] ?? '', $email, $input['address'] ?? '', (float)($input['discountPercent'] ?? 0)]
                );
                break;
            case 'exams':
                DB::insert(
                    "INSERT INTO exams (exam_code, name, course_id, rank_group, total_questions, time_limit, pass_score, questions, status)
                     VALUES (?,?,?,?,?,?,?,?,'active')",
                    [$input['id'] ?? ('EX-' . uniqid()), $input['name'] ?? '', null,
                     $input['rank'] ?? '', (int)($input['totalQuestions'] ?? 0),
                     (int)($input['timeLimit'] ?? 30), (int)($input['passScore'] ?? 70),
                     json_encode($input['questions'] ?? [])]
                );
                break;
            case 'fly_logs':
                DB::insert(
                    "INSERT INTO fly_logs (student_id, class_id, flight_date, duration_minutes, uav_model, location, weather, notes, instructor, logged_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?)",
                    [!empty($input['student_id']) ? (int)$input['student_id'] : null,
                     !empty($input['class_id']) ? (int)$input['class_id'] : null,
                     $input['date'] ?? date('Y-m-d'), (int)($input['duration_minutes'] ?? 0),
                     $input['uav_model'] ?? '', $input['location'] ?? '', $input['weather'] ?? '',
                     $input['notes'] ?? '', $input['instructor'] ?? '', (int)($GLOBALS['auth']['id'] ?? 0)]
                );
                // Check min fly hours → auto-complete practice stage
                $sid = (int)($input['student_id'] ?? 0);
                if ($sid) {
                    $totalMin = (int)(DB::selectOne("SELECT COALESCE(SUM(duration_minutes),0) AS c FROM fly_logs WHERE student_id=?", [$sid])['c'] ?? 0);
                    $enr = DB::selectOne("SELECT e.*, c.code FROM enrollments e JOIN courses c ON e.course_id=c.id WHERE e.student_id=? ORDER BY e.created_at DESC LIMIT 1", [$sid]);
                    if ($enr) {
                        $minFlyHours = (int)(DB::selectOne("SELECT COALESCE(MAX(tuition_fee/1000000*1), 0) AS h FROM courses WHERE id=?", [(int)$enr['course_id']])['h'] ?? 0);
                        $minFlyMin = $minFlyHours * 60;
                        if ($minFlyMin > 0 && $totalMin >= $minFlyMin) {
                            $stages = json_decode($enr['training_stages'] ?? '{}', true) ?: [];
                            if (($stages['practice']['status'] ?? '') !== 'completed') {
                                $stages['practice'] = ['status' => 'completed', 'completed_at' => date('c'), 'fly_minutes' => $totalMin];
                                DB::execute("UPDATE enrollments SET training_stages=?, updated_at=NOW() WHERE id=?", [json_encode($stages), $enr['id']]);
                            }
                        }
                    }
                }
                break;
            case 'attendance':
                DB::insert(
                    "INSERT INTO attendance (student_id, class_id, attendance_date, status, logged_by, note)
                     VALUES (?,?,?,?,?,?)",
                    [(int)($input['student_id'] ?? 0), !empty($input['class_id']) ? (int)$input['class_id'] : null,
                     $input['date'] ?? date('Y-m-d'), $input['status'] ?? 'present',
                     (int)($GLOBALS['auth']['id'] ?? 0), $input['note'] ?? '']
                );
                break;
            case 'certifications':
                DB::insert(
                    "INSERT INTO certifications (cert_code, student_id, enrollment_id, course_name, issued_date, status)
                     VALUES (?,?,?,?,CURDATE(),'issued')",
                    ['CERT-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4)),
                     (int)($input['student_id'] ?? 0), !empty($input['enrollment_id']) ? (int)$input['enrollment_id'] : null,
                     $input['course_name'] ?? '']
                );
                break;
            case 'enrollments':
                $studentId = (int)($input['student_id'] ?? 0);
                $courseId = (int)($input['course_id'] ?? 0);
                if (!$studentId || !$courseId) jsonResponse(['error' => 'Thiếu student_id hoặc course_id'], 400);
                $course = DB::selectOne("SELECT * FROM courses WHERE id=?", [$courseId]);
                if (!$course) jsonResponse(['error' => 'Không tìm thấy khóa học'], 404);
                $enrCode = 'HS-' . date('Y') . '-' . str_pad($studentId, 4, '0', STR_PAD_LEFT);
                DB::insert(
                    "INSERT INTO enrollments (enrollment_code, student_id, course_id, total_amount, final_amount, payment_status, enrollment_status, training_stages)
                     VALUES (?,?,?,?,?,'unpaid','pending',?)",
                    [$enrCode, $studentId, $courseId, $course['tuition_fee'], $course['tuition_fee'],
                     json_encode(['enrollment'=>['status'=>'pending'],'theory'=>['status'=>'pending'],'practice'=>['status'=>'pending'],'exam'=>['status'=>'pending'],'certification'=>['status'=>'pending']])]
                );
                break;
            default:
                jsonResponse(['error' => 'POST not supported for ' . $collection], 400);
        }
        jsonResponse(['success' => true], 201);
    }

    // PUT update
    if ($method === 'PUT' && $itemId) {
        requireRole($allowedRoles);
        rateLimit('crud_put:' . getClientIP(), 100, 60, 'Quá nhiều thao tác');
        $input = jsonInput();
        $id = is_numeric($itemId) ? (int)$itemId : 0;
        $row = DB::selectOne("SELECT * FROM `{$table}` WHERE id=?", [$id]);
        if (!$row) jsonResponse(['error' => 'Not found'], 404);

        switch ($collection) {
            case 'courses':
                DB::execute("UPDATE courses SET name=?, code=?, tuition_fee=?, description=?, status=?, updated_at=NOW() WHERE id=?",
                    [$input['name'] ?? $row['name'], $input['code'] ?? $row['code'],
                     (float)($input['tuition_fee'] ?? $input['price'] ?? $row['tuition_fee']),
                     $input['description'] ?? $row['description'], $input['status'] ?? $row['status'], $id]);
                break;
            case 'classes':
                $studentIds = $input['student_ids'] ?? json_decode($row['student_ids'] ?? '[]', true);
                $teacherIds = $input['teacher_ids'] ?? json_decode($row['teacher_ids'] ?? '[]', true);
                $teacherIds = is_array($teacherIds) ? array_values(array_unique(array_map('strval', $teacherIds))) : [];
                $schedule = $input['schedule'] ?? json_decode($row['schedule'] ?? '[]', true);
                // Hỗ trợ cả snake_case (frontend cũ) lẫn camelCase để không bỏ sót field
                $courseId = $input['courseId'] ?? $input['course_id'] ?? $row['course_id'];
                $startDate = $input['startDate'] ?? $input['start_date'] ?? $row['start_date'];
                $endDate = $input['endDate'] ?? $input['end_date'] ?? $row['end_date'];
                $location = $input['location'] ?? $input['room'] ?? $row['location'];
                // Tự suy Hạng thi từ khóa học (VLOS→A, BVLOS→B) để không lệch rank với khóa
                $courseRank = '';
                if (!empty($courseId)) {
                    $cr = DB::selectOne("SELECT code FROM courses WHERE id = ?", [(int)$courseId]);
                    if ($cr) {
                        $cc = strtoupper($cr['code'] ?? '');
                        if (str_contains($cc, 'B')) $courseRank = 'B';
                        elseif (str_contains($cc, 'A') || str_contains($cc, 'VLOS')) $courseRank = 'A';
                    }
                }
                $rank = $courseRank !== '' ? $courseRank : ($input['rank'] ?? $row['rank']);
                DB::execute(
                    "UPDATE classes SET name=?, course_id=?, teacher_id=?, max_students=?, start_date=?, end_date=?, schedule=?, location=?, type=?, student_ids=?, rank=?, teacher_ids=?, status=?, updated_at=NOW() WHERE id=?",
                    [$input['name'] ?? $row['name'], !empty($courseId) ? (int)$courseId : $row['course_id'],
                     !empty($teacherIds) ? (int)$teacherIds[0] : $row['teacher_id'],
                     (int)($input['max_students'] ?? $row['max_students']), $startDate,
                     $endDate, json_encode($schedule),
                     $location, $input['type'] ?? $row['type'],
                     json_encode($studentIds), $rank, json_encode($teacherIds),
                     $input['status'] ?? $row['status'], $id]
                );
                break;
            case 'agencies':
                DB::execute(
                    "UPDATE agents SET name=?, phone=?, email=?, address=?, commission_rate=?, updated_at=NOW() WHERE id=?",
                    [$input['name'] ?? $row['name'], $input['phone'] ?? $row['phone'],
                     $input['email'] ?? $row['email'], $input['address'] ?? $row['address'],
                     (float)($input['discountPercent'] ?? $row['commission_rate']), $id]
                );
                break;
            case 'exams':
                DB::execute(
                    "UPDATE exams SET name=?, total_questions=?, time_limit=?, pass_score=?, questions=?, updated_at=NOW() WHERE id=?",
                    [$input['name'] ?? $row['name'], (int)($input['totalQuestions'] ?? $row['total_questions']),
                     (int)($input['timeLimit'] ?? $row['time_limit']), (int)($input['passScore'] ?? $row['pass_score']),
                     json_encode($input['questions'] ?? []), $id]
                );
                break;
            case 'fly_logs':
                DB::execute(
                    "UPDATE fly_logs SET flight_date=?, duration_minutes=?, uav_model=?, location=?, weather=?, notes=?, updated_at=NOW() WHERE id=?",
                    [$input['date'] ?? $row['flight_date'], (int)($input['duration_minutes'] ?? $row['duration_minutes']),
                     $input['uav_model'] ?? $row['uav_model'], $input['location'] ?? $row['location'],
                     $input['weather'] ?? $row['weather'], $input['notes'] ?? $row['notes'], $id]
                );
                break;
            case 'attendance':
                DB::execute("UPDATE attendance SET status=?, note=?, updated_at=NOW() WHERE id=?",
                    [$input['status'] ?? $row['status'], $input['note'] ?? $row['note'], $id]);
                break;
            case 'certifications':
                DB::execute("UPDATE certifications SET status=?, notes=?, updated_at=NOW() WHERE id=?",
                    [$input['status'] ?? $row['status'], $input['notes'] ?? $row['notes'], $id]);
                break;
            case 'enrollments':
                $mergedStages = [];
                if (!empty($row['training_stages'])) {
                    $decoded = json_decode($row['training_stages'], true);
                    if (is_array($decoded)) $mergedStages = $decoded;
                }
                if (isset($input['training_stages']) && is_array($input['training_stages'])) {
                    $mergedStages = array_merge($mergedStages, $input['training_stages']);
                }
                DB::execute(
                    "UPDATE enrollments SET payment_status=?, enrollment_status=?, training_stages=?, notes=?, updated_at=NOW() WHERE id=?",
                    [$input['payment_status'] ?? $row['payment_status'], $input['status'] ?? $row['enrollment_status'],
                     json_encode($mergedStages),
                     $input['notes'] ?? $row['notes'], $id]
                );
                break;
            case 'transactions':
                DB::execute("UPDATE payments SET status=?, note=?, updated_at=NOW() WHERE id=?",
                    [$input['status'] ?? $row['status'], $input['note'] ?? $row['note'], $id]);
                break;
        }
        jsonResponse(['success' => true]);
    }

    // DELETE
    if ($method === 'DELETE' && $itemId) {
        requireRole($allowedRoles);
        rateLimit('crud_delete:' . getClientIP(), 30, 60, 'Quá nhiều thao tác xóa');
        $id = is_numeric($itemId) ? (int)$itemId : 0;
        if ($collection === 'users') {
            $studentId = $id;
            DB::begin();
            try {
                DB::execute("DELETE FROM payments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)", [$studentId]);
                DB::execute("DELETE FROM invoices WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)", [$studentId]);
                DB::execute("DELETE FROM exam_results WHERE student_id=?", [$studentId]);
                DB::execute("DELETE FROM fly_logs WHERE student_id=?", [$studentId]);
                DB::execute("DELETE FROM attendance WHERE student_id=?", [$studentId]);
                DB::execute("DELETE FROM change_requests WHERE student_id=?", [$studentId]);
                DB::execute("DELETE FROM certifications WHERE student_id=?", [$studentId]);
                DB::execute("DELETE FROM enrollments WHERE student_id=?", [$studentId]);
                // Dọn tham chiếu học viên khỏi student_ids của mọi lớp (tránh "unknown" ghost)
                foreach (DB::select("SELECT id, student_ids FROM classes") as $gc) {
                    $gcIds = json_decode($gc['student_ids'] ?? '[]', true) ?: [];
                    if (in_array((string)$studentId, array_map('strval', $gcIds))) {
                        $gcIds = array_values(array_filter($gcIds, fn($s) => (string)$s !== (string)$studentId));
                        DB::execute("UPDATE classes SET student_ids=?, updated_at=NOW() WHERE id=?", [json_encode($gcIds), (int)$gc['id']]);
                    }
                }
                DB::execute("DELETE FROM users WHERE id=?", [$studentId]);
                DB::commit();
            } catch (Exception $e) {
                DB::rollback();
                jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
            }
        } else {
            DB::execute("DELETE FROM `{$table}` WHERE id=?", [$id]);
        }
        jsonResponse(['success' => true]);
    }
    exit;
}

// ──── Data routes ────
$dataRoutes = ['courses', 'classes', 'enrollments', 'attendance', 'exams', 'fly_logs', 'certifications', 'tuitions', 'agencies', 'transactions'];

// Alias: fly-logs → fly_logs
if (($parts[0] ?? '') === 'fly-logs') {
    $_GET['action'] = 'fly_logs' . (isset($parts[1]) ? '/' . $parts[1] : '');
    $path = $_GET['action'];
    $parts = array_values(array_filter(explode('/', $path)));
}

foreach ($dataRoutes as $route) {
    $matches = ($parts[0] ?? '') === $route || (($parts[0] ?? '') === 'auth' && ($parts[1] ?? '') === $route);
    if ($matches) {
        $pubGet = in_array($route, ['courses', 'classes']);
        $roles = ['ADMIN', 'STAFF'];
        if (in_array($route, ['exams', 'fly_logs', 'certifications', 'attendance', 'classes'])) $roles[] = 'TEACHER';
        if (in_array($route, ['enrollments', 'tuitions']) && $method === 'GET') $roles[] = 'ACCOUNTANT';
        if (in_array($route, ['agencies', 'transactions']) && $method === 'GET') $roles[] = 'ACCOUNTANT';
        if ($route === 'classes' && $method === 'GET' && !($parts[$idIdx] ?? null)) $pubGet = true;
        if (in_array($route, ['exams', 'fly_logs', 'certifications', 'attendance']) && $method === 'GET') $roles[] = 'STUDENT';
        handleCRUD($route, $roles, $pubGet);
    }
}

// ──── USERS CRUD ────
if (($parts[0] ?? '') === 'users' || (($parts[0] ?? '') === 'auth' && ($parts[1] ?? '') === 'users')) {
    $idIdx = ($parts[0] === 'auth') ? 2 : 1;
    $userId = $parts[$idIdx] ?? null;

    if ($method === 'GET' && !$userId) {
        $auth = requireRole(['ADMIN','STAFF','STUDENT','admin','staff','student']);
        $users = DB::select("SELECT * FROM users ORDER BY full_name");
        // Học viên chỉ cần danh sách GIÁO VIÊN (id + tên) để hiển thị giáo viên phụ trách lớp mình
        if (strtoupper($auth['role'] ?? '') === 'STUDENT') {
            $teachers = array_values(array_filter($users, fn($u) => strtolower($u['role'] ?? '') === 'teacher'));
            jsonResponse(array_map(fn($u) => ['id' => (string)$u['id'], 'fullName' => $u['full_name'] ?? '', 'role' => 'TEACHER'], $teachers));
        }
        jsonResponse(array_map('sanitizeUser', $users));
    }
    if ($method === 'GET' && $userId) {
        $auth = requireRole(['ADMIN','STAFF','admin','staff']);
        $user = findUserById($userId);
        if (!$user) jsonResponse(['error' => 'Not found'], 404);
        jsonResponse(sanitizeUser($user));
    }
    if ($method === 'POST' && !$userId) {
        $auth = requireRole(['ADMIN','STAFF','admin','staff']);
        $input = jsonInput();
        $email = $input['email'] ?? '';
        $fullName = $input['fullName'] ?? '';
        $phone = $input['phone'] ?? $email;
        $role = strtolower($input['role'] ?? 'student');
        $password = $input['password'] ?? '';

        if (!$email || !$fullName) jsonResponse(['error' => 'Thiếu email hoặc họ tên'], 400);
        if (findUserByEmail($email)) jsonResponse(['error' => 'Email đã tồn tại'], 409);

        $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        $hash = $password ? password_hash($password, PASSWORD_BCRYPT) : null;
        $newId = (int)DB::insert(
            "INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status) VALUES (?,?,?,?,?,?,'active')",
            [$userCode, $fullName, $email, $phone, $hash, $role]
        );

        // Auto-create enrollment nếu có courseId
        $courseId = $input['courseId'] ?? '';
        if ($courseId) {
            $course = is_numeric($courseId) ? DB::selectOne("SELECT * FROM courses WHERE id=?", [(int)$courseId])
                : DB::selectOne("SELECT * FROM courses WHERE code=?", [$courseId]);
            if ($course) {
                $enrCode = 'HS-' . date('Y') . '-' . str_pad($newId, 4, '0', STR_PAD_LEFT);
                $enrId = (int)DB::insert(
                    "INSERT INTO enrollments (enrollment_code, student_id, course_id, total_amount, final_amount, payment_status, enrollment_status, training_stages)
                     VALUES (?,?,?,?,?,'unpaid','pending',?)",
                    [$enrCode, $newId, $course['id'], $course['tuition_fee'], $course['tuition_fee'],
                     json_encode(['enrollment'=>['status'=>'pending'],'theory'=>['status'=>'pending'],'practice'=>['status'=>'pending'],'exam'=>['status'=>'pending'],'certification'=>['status'=>'pending']])]
                );
                $invCode = 'INV-' . date('Y') . '-' . str_pad($enrId, 4, '0', STR_PAD_LEFT);
                DB::insert(
                    "INSERT INTO invoices (invoice_code, enrollment_id, base_price, final_price, student_name, student_email, student_phone, status)
                     VALUES (?,?,?,?,?,?,?,'pending')",
                    [$invCode, $enrId, $course['tuition_fee'], $course['tuition_fee'], $fullName, $email, $phone]
                );
            }
        }

        jsonResponse(sanitizeUser(findUserById((string)$newId)), 201);
    }
    if ($method === 'PUT' && $userId) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $mysqlId = is_numeric($userId) ? (int)$userId : (int)(findUserById($userId)['id'] ?? 0);

        $isAdmin = in_array(strtolower($auth['role'] ?? ''), ['admin', 'staff']);
        $isSelf = (string)$auth['id'] === (string)$mysqlId;

        if (!$isAdmin && !$isSelf) jsonResponse(['error' => 'Forbidden'], 403);

        $current = DB::selectOne("SELECT full_name, email, phone, role, status, rank_group FROM users WHERE id=?", [$mysqlId]);
        if (!$current) jsonResponse(['error' => 'Not found'], 404);

        $newEmail = trim($input['email'] ?? $current['email']);
        $newPhone = trim($input['phone'] ?? $current['phone']);
        $newName = trim($input['fullName'] ?? $current['full_name']);
        $newPassword = trim((string)($input['password'] ?? ''));

        // Kiểm tra độ dài mật khẩu mới nếu có gửi kèm
        if ($newPassword !== '' && strlen($newPassword) < 6) {
            jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);
        }

        // Kiểm tra email trùng (nếu có đổi email)
        if ($newEmail !== '' && strtolower($newEmail) !== strtolower($current['email'])) {
            $dup = DB::selectOne("SELECT id FROM users WHERE email=? AND id != ?", [$newEmail, $mysqlId]);
            if ($dup) jsonResponse(['error' => 'Email đã được sử dụng bởi tài khoản khác'], 409);
        }

        DB::begin();
        try {
            if ($isAdmin) {
                DB::execute(
                    "UPDATE users SET full_name=?, email=?, phone=?, role=?, status=?, rank_group=?, updated_at=NOW() WHERE id=?",
                    [$newName, $newEmail, $newPhone,
                     strtolower($input['role'] ?? $current['role']), strtolower($input['status'] ?? $current['status']),
                     ($input['rank'] ?? $input['rank_group'] ?? $current['rank_group']), $mysqlId]
                );
                // Đổi mật khẩu khi admin/staff gửi password mới
                if ($newPassword !== '') {
                    DB::execute(
                        "UPDATE users SET password_hash=?, updated_at=NOW() WHERE id=?",
                        [password_hash($newPassword, PASSWORD_BCRYPT), $mysqlId]
                    );
                }
            } else {
                // Self-update: cho đổi full_name, phone, email
                DB::execute(
                    "UPDATE users SET full_name=?, phone=?, email=?, updated_at=NOW() WHERE id=?",
                    [$newName, $newPhone, $newEmail, $mysqlId]
                );
            }

            // Đồng bộ tên/email/phone xuống invoices (denormalized) nếu có thay đổi
            $invFields = [];
            $invParams = [];
            if ($newName !== '' && $newName !== $current['full_name']) { $invFields[] = 'i.student_name=?'; $invParams[] = $newName; }
            if ($newEmail !== '' && strtolower($newEmail) !== strtolower($current['email'])) { $invFields[] = 'i.student_email=?'; $invParams[] = $newEmail; }
            if ($newPhone !== '' && $newPhone !== $current['phone']) { $invFields[] = 'i.student_phone=?'; $invParams[] = $newPhone; }
            if (!empty($invFields)) {
                $invParams[] = $mysqlId;
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
        jsonResponse(['success' => true]);
    }
    if ($method === 'DELETE' && $userId) {
        requireRole(['ADMIN','admin']);
        $mysqlId = is_numeric($userId) ? (int)$userId : (int)(findUserById($userId)['id'] ?? 0);
        DB::begin();
        try {
            DB::execute("DELETE FROM payments WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)", [$mysqlId]);
            DB::execute("DELETE FROM invoices WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id=?)", [$mysqlId]);
            DB::execute("DELETE FROM exam_results WHERE student_id=?", [$mysqlId]);
            DB::execute("DELETE FROM fly_logs WHERE student_id=?", [$mysqlId]);
            DB::execute("DELETE FROM attendance WHERE student_id=?", [$mysqlId]);
            DB::execute("DELETE FROM change_requests WHERE student_id=?", [$mysqlId]);
            DB::execute("DELETE FROM certifications WHERE student_id=?", [$mysqlId]);
            DB::execute("DELETE FROM enrollments WHERE student_id=?", [$mysqlId]);
            // Dọn tham chiếu học viên khỏi student_ids của mọi lớp (tránh "unknown" ghost)
            foreach (DB::select("SELECT id, student_ids FROM classes") as $gc) {
                $gcIds = json_decode($gc['student_ids'] ?? '[]', true) ?: [];
                if (in_array((string)$mysqlId, array_map('strval', $gcIds))) {
                    $gcIds = array_values(array_filter($gcIds, fn($s) => (string)$s !== (string)$mysqlId));
                    DB::execute("UPDATE classes SET student_ids=?, updated_at=NOW() WHERE id=?", [json_encode($gcIds), (int)$gc['id']]);
                }
            }
            DB::execute("DELETE FROM users WHERE id=?", [$mysqlId]);
            DB::commit();
        } catch (Exception $e) {
            DB::rollback();
            jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
        }
        jsonResponse(['success' => true]);
    }
}

// ──── EXAM RESULTS ────
if (($parts[0] ?? '') === 'exam-results' || ($parts[0] ?? '') === 'exam_results') {
    if ($method === 'GET' && !($parts[1] ?? null)) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        if (in_array($auth['role'], ['ADMIN','STAFF','TEACHER'])) {
            $rows = DB::select("SELECT er.*, u.full_name AS student_name FROM exam_results er JOIN users u ON er.student_id=u.id ORDER BY er.submitted_at DESC");
            jsonResponse($rows);
        } else {
            $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
            $rows = DB::select("SELECT * FROM exam_results WHERE student_id=? ORDER BY submitted_at DESC", [$mysqlId]);
            jsonResponse($rows);
        }
    }
    if ($method === 'GET' && ($parts[1] ?? null)) {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $requestedId = is_numeric($parts[1]) ? (int)$parts[1] : 0;
        if (in_array($auth['role'], ['ADMIN','STAFF','TEACHER'])) {
            $rows = DB::select("SELECT * FROM exam_results WHERE id=?", [$requestedId]);
        } else {
            // Học viên/Đại lý chỉ được xem kết quả thi của CHÍNH MÌNH
            $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
            $rows = DB::select("SELECT * FROM exam_results WHERE student_id=? AND id=?", [$mysqlId, $requestedId]);
        }
        jsonResponse($rows);
    }
    if ($method === 'POST') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $sid = $auth['role'] === 'TEACHER' ? ($input['student_id'] ?? $auth['id']) : $auth['id'];
        $mysqlSid = is_numeric($sid) ? (int)$sid : 0;

        $total = (int)($input['total'] ?? $input['totalQuestions'] ?? 0);
        $correct = (int)($input['correct'] ?? 0);
        $passed = $total > 0 && ($correct / $total) >= 0.7;

        DB::insert(
            "INSERT INTO exam_results (student_id, exam_type, exam_number, exam_date, total_questions, answered, correct, score, passed, duration_minutes, questions, submitted_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [$mysqlSid, $input['exam_type'] ?? '', $input['exam_number'] ?? '',
             $input['date'] ?? $input['submittedAt'] ?? null,
             $total, (int)($input['answered'] ?? 0), $correct,
             $total > 0 ? round($correct / $total * 100, 2) : 0,
             $passed ? 1 : 0, (int)($input['duration_minutes'] ?? 0),
             json_encode($input['questions'] ?? []), $input['submittedAt'] ?? $input['date'] ?? null]
        );

        // Auto-complete exam stage if passed
        if ($passed) {
            $enr = DB::selectOne("SELECT * FROM enrollments WHERE student_id=? ORDER BY created_at DESC LIMIT 1", [$mysqlSid]);
            if ($enr) {
                $stages = json_decode($enr['training_stages'] ?? '{}', true) ?: [];
                $stages['exam'] = ['status' => 'completed', 'completed_at' => date('c'), 'score' => $input['score'] ?? null];
                DB::execute("UPDATE enrollments SET training_stages=?, updated_at=NOW() WHERE id=?", [json_encode($stages), $enr['id']]);
            }
        }

        jsonResponse(['success' => true, 'passed' => $passed], 201);
    }
}

// ──── CHANGE REQUESTS ────
if (($parts[0] ?? '') === 'change-requests' || ($parts[0] ?? '') === 'change_requests') {
    if ($method === 'GET') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        if (in_array($auth['role'], ['ADMIN','STAFF','TEACHER'])) {
            $rows = DB::select("SELECT * FROM change_requests ORDER BY created_at DESC");
        } else {
            $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
            $rows = DB::select("SELECT * FROM change_requests WHERE student_id=? ORDER BY created_at DESC", [$mysqlId]);
        }
        // Tra tên người duyệt (reviewed_by lưu id người dùng)
        $nameMap = [];
        foreach (DB::select("SELECT id, full_name FROM users") as $u) {
            $nameMap[(int)$u['id']] = $u['full_name'] ?? '';
        }
        // Map snake_case (raw MySQL) → camelCase để khớp frontend
        $out = [];
        foreach ($rows as $r) {
            $decoded = json_decode($r['history'] ?? '[]', true);
            $reviewedBy = $r['reviewed_by'] ?? null;
            $reviewerName = ($reviewedBy !== null && $reviewedBy !== '') ? ($nameMap[(int)$reviewedBy] ?? $reviewedBy) : '';
            $out[] = [
                'id' => $r['id'],
                'studentId' => $r['student_id'],
                'studentName' => $r['student_name'],
                'type' => ($r['request_type'] === 'class_change') ? 'change_class' : $r['request_type'],
                'fromClassId' => $r['from_class_id'],
                'toClassId' => $r['to_class_id'],
                'fromClassName' => $r['from_value'],
                'toClassName' => $r['to_value'],
                'reason' => $r['reason'],
                'amount' => (float)($r['amount'] ?? 0),
                'status' => $r['status'],
                'createdBy' => $r['created_by'],
                'createdAt' => $r['created_at'],
                'reviewedBy' => $reviewerName,
                'approvedBy' => $r['status'] === 'approved' ? $reviewerName : '',
                'rejectedBy' => $r['status'] === 'rejected' ? $reviewerName : '',
                'rejectReason' => $r['review_note'] ?? '',
                'reviewNote' => $r['review_note'] ?? '',
                'history' => is_array($decoded) ? $decoded : [],
            ];
        }
        jsonResponse($out);
    }
    if ($method === 'POST') {
        $auth = authenticate();
        if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $input = jsonInput();
        $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
        DB::insert(
            "INSERT INTO change_requests (student_id, student_name, request_type, from_value, to_value, reason, status, created_by, history)
             VALUES (?,?,?,?,?,?,'pending',?,?)",
            [$mysqlId, $input['studentName'] ?? '', $input['type'] ?? 'other',
             $input['fromClassName'] ?? $input['fromClassId'] ?? '',
             $input['toClassName'] ?? $input['toClassId'] ?? '',
             $input['reason'] ?? '', $auth['role'] ?? 'student',
             json_encode([['action'=>'created','date'=>date('c'),'by'=>$auth['role']??'student']])]
        );
        jsonResponse(['success' => true], 201);
    }
    if ($method === 'PUT' && ($parts[1] ?? null)) {
        $auth = requireRole(['ADMIN','STAFF','admin','staff']);
        $input = jsonInput();
        $id = is_numeric($parts[1]) ? (int)$parts[1] : 0;
        $row = DB::selectOne("SELECT history FROM change_requests WHERE id=?", [$id]);
        if (!$row) jsonResponse(['error' => 'Not found'], 404);

        $status = $input['status'] ?? 'approved';
        $note = $input['reviewNote'] ?? $input['note'] ?? $input['rejectReason'] ?? '';

        // history: dùng input nếu có (frontend đã append), ngược lại tự append theo status
        $history = [];
        if (!empty($row['history'])) {
            $decoded = json_decode($row['history'], true);
            if (is_array($decoded)) $history = $decoded;
        }
        if (isset($input['history']) && is_array($input['history'])) {
            $history = $input['history'];
        } else {
            $adminName = (string)$auth['id'];
            $u = DB::selectOne("SELECT full_name FROM users WHERE id=?", [(int)$auth['id']]);
            if ($u && !empty($u['full_name'])) $adminName = $u['full_name'];
            $history[] = [
                'action' => $status,
                'date' => date('c'),
                'by' => $adminName,
                'note' => $note,
            ];
        }

        DB::execute(
            "UPDATE change_requests SET status=?, reviewed_by=?, review_note=?, history=?, updated_at=NOW() WHERE id=?",
            [$status, $auth['id'], $note, json_encode($history), $id]
        );
        jsonResponse(['success' => true]);
    }
}

// ──── PAYMENT RECEIPTS ────
if (($parts[0] ?? '') === 'payment-receipts' || ($parts[0] ?? '') === 'payment_receipts') {
    jsonResponse(['data' => [], 'message' => 'Vui lòng sử dụng /api/smc-db.php cho thanh toán']);
}

// ──── QUESTION BANK ────
if (($parts[0] ?? '') === 'question-bank' || ($parts[0] ?? '') === 'question_bank') {
    if ($method === 'GET') {
        jsonResponse(DB::select("SELECT * FROM question_bank ORDER BY module_id, id"));
    }
    if ($method === 'POST') {
        $auth = requireRole(['ADMIN','STAFF','TEACHER','admin','staff','teacher']);
        $input = jsonInput();
        $questions = $input['questions'] ?? $input;
        if (!is_array($questions)) jsonResponse(['error' => 'Invalid data'], 400);

        DB::begin();
        try {
            DB::execute("DELETE FROM question_bank");
            foreach ($questions as $q) {
                if (empty($q['question'] ?? '')) continue;
                DB::insert(
                    "INSERT INTO question_bank (question_code, question_text, options, correct_answer, question_type, module_id, module_name, difficulty, rank_group)
                     VALUES (?,?,?,?,?,?,?,?,?)",
                    [$q['id'] ?? $q['question_code'] ?? '', $q['question'], json_encode($q['options'] ?? []),
                     (int)($q['answer'] ?? 0), $q['type'] ?? 'true_false',
                     $q['module_id'] ?? '', $q['module_name'] ?? '', $q['difficulty'] ?? '', $q['rank'] ?? '']
                );
            }
            DB::commit();
        } catch (Exception $e) {
            DB::rollback();
            jsonResponse(['error' => 'Lỗi: ' . $e->getMessage()], 500);
        }
        jsonResponse(['success' => true]);
    }
}

// ──── MY TUITION (student) ────
if (($parts[0] ?? '') === 'my-tuition' || (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'tuition-my')) {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;

    $rows = DB::select(
        "SELECT e.*, c.name AS course_name, c.tuition_fee,
         COALESCE(i.total_paid,0) AS invoice_paid, i.status AS invoice_status,
         i.base_price, i.final_price, i.agency_name, i.agency_discount_percent
         FROM enrollments e JOIN courses c ON e.course_id=c.id
         LEFT JOIN invoices i ON i.enrollment_id=e.id
         WHERE e.student_id=? ORDER BY e.created_at DESC", [$mysqlId]
    );

    $result = array_map(function($r) {
        $paid = (float)($r['paid_amount'] ?? 0);
        // Học viên LUÔN thấy giá GỐC (final_amount), KHÔNG trừ chiết khấu đại lý
        // (chiết khấu là quan hệ giữa Đại lý và trung tâm, không hiển thị cho học viên)
        $total = (float)($r['final_amount'] ?? $r['total_amount'] ?? 0);
        return [
            'id' => (string)$r['id'],
            'enrollmentCode' => $r['enrollment_code'],
            'courseId' => (string)$r['course_id'],
            'courseName' => $r['course_name'] ?? '',
            'amount' => $total,
            'paid' => $paid,
            'remaining' => max(0, $total - $paid),
            'status' => $r['payment_status'] ?? 'unpaid',
            'step' => $r['payment_status'] === 'fully_paid' ? 'paid' : ($paid > 0 ? 'partial' : 'pending'),
        ];
    }, $rows);
    jsonResponse($result);
}

// ──── MY ENROLLMENTS (student) ────
if (($parts[0] ?? '') === 'my-enrollments') {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
    $rows = DB::select(
        "SELECT e.*, c.name AS course_name FROM enrollments e JOIN courses c ON e.course_id=c.id WHERE e.student_id=? ORDER BY e.created_at DESC",
        [$mysqlId]
    );
    jsonResponse(array_map(fn($r) => mapDbRow($r, 'enrollments'), $rows));
}

// ──── REGISTRATIONS ────
if (($parts[0] ?? '') === 'registrations') {
    if ($method === 'POST') {
        $input = jsonInput();
        // Lưu vào bảng users với status pending
        $email = $input['email'] ?? '';
        $phone = $input['phone'] ?? '';
        if (!$email && !$phone) jsonResponse(['error' => 'Thiếu email hoặc số điện thoại'], 400);
        if (findUserByEmail($email) || findUserByEmail($phone)) jsonResponse(['error' => 'Email/SĐT đã tồn tại'], 409);

        // Xác định Hạng thi (A/B) từ khóa học đã chọn: "Hạng A — VLOS", "Hạng B — VLOS", "Hạng B — BVLOS"
        $course = strtoupper(trim($input['course'] ?? ''));
        $rank = '';
        if (str_contains($course, 'B')) $rank = 'B';
        elseif (str_contains($course, 'A')) $rank = 'A';

        $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        DB::insert(
            "INSERT INTO users (user_code, full_name, email, phone, role, status, rank_group) VALUES (?,?,?,?,?,'pending',?)",
            [$userCode, $input['fullName'] ?? '', $email ?: $phone, $phone ?: $email, 'student', $rank]
        );
        jsonResponse(['success' => true, 'message' => 'Đăng ký thành công! Nhân viên SMC sẽ liên hệ với bạn.'], 201);
    }
    if ($method === 'GET') {
        requireRole(['ADMIN','STAFF','admin','staff']);
        $rows = DB::select("SELECT * FROM users WHERE status='pending' AND role='student' ORDER BY created_at DESC LIMIT 100");
        jsonResponse(array_map('sanitizeUser', $rows));
    }
}

// ──── SYNC VERSION (polling đồng bộ liên tài khoản) ────
if (($parts[0] ?? '') === 'sync-version') {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $versions = [];
    // Các bảng có cột updated_at — dùng COUNT + MAX(updated_at) + MAX(id)
    foreach (['courses', 'classes', 'users', 'enrollments', 'invoices'] as $t) {
        $row = DB::selectOne("SELECT COUNT(*) AS c, MAX(updated_at) AS m, MAX(id) AS mx FROM `{$t}`");
        $versions[$t] = md5($t . ':' . (int)($row['c'] ?? 0) . ':' . ($row['m'] ?? '') . ':' . (int)($row['mx'] ?? 0));
    }
    // payments KHÔNG có cột updated_at → key 'transactions' (khớp tên event-bus frontend),
    // dùng COUNT + MAX(id) + MAX(approved_at) + MAX(created_at) để bắt tạo mới / duyệt / từ chối.
    $p = DB::selectOne("SELECT COUNT(*) AS c, MAX(id) AS mx, MAX(approved_at) AS ma, MAX(created_at) AS mc FROM payments");
    $versions['transactions'] = md5('transactions:' . (int)($p['c'] ?? 0) . ':' . (int)($p['mx'] ?? 0) . ':' . ($p['ma'] ?? '') . ':' . ($p['mc'] ?? ''));
    jsonResponse(['versions' => $versions, 'ts' => time()]);
}

// ──── HEALTH ────
if (($parts[0] ?? '') === 'health' || empty($parts[0])) {
    $userCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM users")['c'] ?? 0);
    $courseCount = (int)(DB::selectOne("SELECT COUNT(*) AS c FROM courses")['c'] ?? 0);
    jsonResponse([
        'status' => 'ok',
        'service' => 'SMC Training API v6 (MySQL)',
        'accounts' => $userCount,
        'courses' => $courseCount,
        'timestamp' => date('c'),
    ]);
}

// ──── UPLOAD / FILES / FILE (tài liệu & tư liệu) ────

define('UPLOAD_MAX_BYTES', 20 * 1024 * 1024); // 20MB — vượt quá giới hạn PHP ini vẫn sẽ bị chặn trước đó

// Đường dẫn web gốc (thư mục chứa index.html). api/ nằm ngay dưới thư mục này.
define('WEB_ROOT_DIR', dirname(__DIR__));

// Category lưu ra ngoài api/uploads (công khai, truy cập không cần đăng nhập)
function isPublicCategory($category) {
    return in_array($category, ['public-images', 'shared', 'videos'], true);
}

// Ánh xạ bản ghi uploaded_files (snake_case) sang cả dạng camelCase để frontend
// các trang giáo viên vẫn đọc được (trước đây đọc sai tên trường).
function mapUploadedFile($row) {
    if (!$row) return $row;
    $row['name']       = $row['original_name'] ?? '';
    $row['title']      = $row['title'] ?? ($row['original_name'] ?? '');
    $row['description']= $row['description'] ?? '';
    $row['size']       = (int)($row['size_bytes'] ?? 0);
    $row['path']       = $row['stored_path'] ?? '';
    $row['category']   = $row['category'] ?? '';
    $row['uploadedAt'] = $row['uploaded_at'] ?? null;
    $row['url']        = '/api/auth.php?action=file&id=' . ($row['id'] ?? '');
    return $row;
}

function resolveStoredFile($storedPath) {
    $abs = WEB_ROOT_DIR . '/' . ltrim($storedPath, '/');
    if (is_file($abs)) return $abs;
    // Đường dẫn cũ ghi tương đối so với api/ (ví dụ uploads/x/...) — tìm trong api/
    $legacy = __DIR__ . '/' . ltrim($storedPath, '/');
    if (is_file($legacy)) return $legacy;
    return null;
}

function canViewFile($row, $auth) {
    $category = $row['category'] ?? '';
    if (isPublicCategory($category)) return true;
    if (!$auth) return false;
    $role = strtolower($auth['role'] ?? '');
    // Nội bộ (admin/staff/accountant/teacher) xem được mọi thứ riêng tư
    if (in_array($role, ['admin', 'staff', 'accountant', 'teacher'], true)) return true;
    if ($role === 'student') {
        $user = DB::selectOne("SELECT rank_group FROM users WHERE id = ?", [$auth['id'] ?? $auth['userId'] ?? '']);
        $rank = strtoupper(trim((string)($user['rank_group'] ?? '')));
        if (($category === 'material-a' && $rank === 'A') || ($category === 'material-b' && $rank === 'B')) return true;
        return false;
    }
    return false;
}

if (($parts[0] ?? '') === 'upload') {
    $auth = requireRole(['ADMIN','STAFF','TEACHER','admin','staff','teacher']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $category = $_POST['category'] ?? 'documents';
    // Chặn path traversal: category chỉ gồm chữ cái/số/gạch ngang/gạch dưới (không chứa '/', '..', v.v.)
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $category)) {
        jsonResponse(['error' => 'Danh mục không hợp lệ'], 400);
    }
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) jsonResponse(['error' => 'File upload failed'], 400);
    if ($file['size'] > UPLOAD_MAX_BYTES) jsonResponse(['error' => 'File vượt quá 20MB'], 400);

    // Công khai → public-uploads/ ngoài đường chặn api/uploads/; riêng tư → api/uploads/
    if (isPublicCategory($category)) {
        $storedRel = 'public-uploads/' . $category;
    } else {
        $storedRel = 'api/uploads/' . $category;
    }
    $uploadDir = WEB_ROOT_DIR . '/' . $storedRel;
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $originalName = $file['name'];
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $storedPath = $storedRel . '/' . $storedName;

    $allowedExts = ['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png','gif','mp4','zip','rar','csv','txt'];
    if (!in_array($ext, $allowedExts)) jsonResponse(['error' => 'Định dạng file không được hỗ trợ: .' . $ext], 400);

    if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $storedName)) {
        jsonResponse(['error' => 'Lỗi lưu file'], 500);
    }

    $mysqlId = is_numeric($auth['id']) ? (int)$auth['id'] : 0;
    $newFileId = DB::insert(
        "INSERT INTO uploaded_files (original_name, stored_name, stored_path, title, description, mime_type, size_bytes, category, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?)",
        [$originalName, $storedName, $storedPath, $_POST['title'] ?? $originalName,
         $_POST['description'] ?? '', $file['type'] ?? '', $file['size'] ?? 0, $category, $mysqlId]
    );

    jsonResponse(['success' => true, 'id' => $newFileId, 'path' => $storedPath, 'name' => $originalName], 201);
}

// ──── FILES (danh sách / sửa / xoá) ────
if (($parts[0] ?? '') === 'files') {
    $auth = authenticate();

    if ($method === 'GET') {
        $category = $_GET['category'] ?? '';
        if ($category && !preg_match('/^[a-zA-Z0-9_-]+$/', $category)) {
            jsonResponse(['error' => 'Danh mục không hợp lệ'], 400);
        }
        // Danh sách ảnh công khai không cần đăng nhập (trang "Hình ảnh hoạt động")
        if (!isPublicCategory($category) && !$auth) jsonResponse(['error' => 'Unauthorized'], 401);
        $role = $auth ? strtolower($auth['role'] ?? '') : '';

        if ($category) {
            $rows = DB::select("SELECT * FROM uploaded_files WHERE category=? ORDER BY uploaded_at DESC", [$category]);
        } elseif ($role === 'student') {
            $user = DB::selectOne("SELECT rank_group FROM users WHERE id = ?", [$auth['id'] ?? $auth['userId'] ?? '']);
            $rank = strtoupper(trim((string)($user['rank_group'] ?? '')));
            if ($rank === 'A' || $rank === 'B') {
                $rows = DB::select("SELECT * FROM uploaded_files WHERE category=? ORDER BY uploaded_at DESC", ['material-' . strtolower($rank)]);
            } else {
                $rows = [];
            }
        } else {
            $rows = DB::select("SELECT * FROM uploaded_files ORDER BY uploaded_at DESC");
        }

        jsonResponse(array_map('mapUploadedFile', $rows));
    }

    if ($method === 'DELETE' && ($parts[1] ?? null)) {
        $auth = requireRole(['ADMIN','STAFF','TEACHER','admin','staff','teacher']);
        $id = (int)$parts[1];
        $file = DB::selectOne("SELECT * FROM uploaded_files WHERE id=?", [$id]);
        if (!$file) jsonResponse(['error' => 'Not found'], 404);
        $abs = resolveStoredFile($file['stored_path']);
        if ($abs) @unlink($abs);
        DB::execute("DELETE FROM uploaded_files WHERE id=?", [$id]);
        jsonResponse(['success' => true]);
    }

    if ($method === 'PUT' && ($parts[1] ?? null)) {
        $auth = requireRole(['ADMIN','STAFF','TEACHER','admin','staff','teacher']);
        $id = (int)$parts[1];
        $input = jsonInput();
        $file = DB::selectOne("SELECT * FROM uploaded_files WHERE id=?", [$id]);
        if (!$file) jsonResponse(['error' => 'Not found'], 404);
        $title = $input['title'] ?? null;
        $desc  = $input['description'] ?? null;
        if ($title !== null || $desc !== null) {
            DB::execute(
                "UPDATE uploaded_files SET title = COALESCE(?, title), description = COALESCE(?, description) WHERE id = ?",
                [$title, $desc, $id]
            );
        }
        jsonResponse(['success' => true, 'file' => mapUploadedFile(DB::selectOne("SELECT * FROM uploaded_files WHERE id=?", [$id]))]);
    }
}

// ──── FILE (tải xuống / xem, phát trực tiếp kèm phân quyền) ────
if (($parts[0] ?? '') === 'file') {
    $id = (int)($_GET['id'] ?? ($parts[1] ?? 0));
    if (!$id) jsonResponse(['error' => 'Thiếu id'], 400);

    $auth = authenticate();
    $row = DB::selectOne("SELECT * FROM uploaded_files WHERE id=?", [$id]);
    if (!$row) jsonResponse(['error' => 'Không tìm thấy file'], 404);
    if (!canViewFile($row, $auth)) jsonResponse(['error' => 'Không có quyền xem file'], 403);

    $abs = resolveStoredFile($row['stored_path']);
    if (!$abs) jsonResponse(['error' => 'File không tồn tại trên máy chủ'], 404);

    $mime = $row['mime_type'] ?? '';
    if ((!$mime || $mime === 'application/octet-stream') && function_exists('mime_content_type')) {
        $mime = mime_content_type($abs) ?: 'application/octet-stream';
    }
    if (!$mime) $mime = 'application/octet-stream';
    $ext = strtolower(pathinfo($row['stored_path'], PATHINFO_EXTENSION));
    $inline = in_array($ext, ['jpg','jpeg','png','gif','pdf','mp4','txt','csv'], true);

    header('Content-Type: ' . $mime);
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($abs));
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . addslashes($row['original_name'] ?? 'file') . '"');
    readfile($abs);
    exit;
}

// ──── STUDENT-MATERIALS (tài liệu học tập theo hạng của học viên) ────
if (($parts[0] ?? '') === 'student-materials') {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    $user = DB::selectOne("SELECT rank_group FROM users WHERE id = ?", [$auth['id'] ?? $auth['userId'] ?? '']);
    $rank = strtoupper(trim((string)($user['rank_group'] ?? '')));
    if ($rank !== 'A' && $rank !== 'B') jsonResponse([]);
    $rows = DB::select("SELECT * FROM uploaded_files WHERE category=? ORDER BY uploaded_at DESC", ['material-' . strtolower($rank)]);
    jsonResponse(array_map('mapUploadedFile', $rows));
}

// ──── DEPRECATED ADMIN TUITION ENDPOINTS → forward to smc-db.php ────
$deprecatedActions = [
    'admin/process-payment', 'admin/approve-transaction', 'admin/confirm-payment',
    'admin/partial-approve', 'admin/toggle-freeze', 'admin/update-tuition-step',
    'admin/tuition-config', 'admin/tuition-list', 'admin/tuition-students',
    'admin/tuition-report', 'admin/tuition-add', 'admin/tuition-activate'
];
if (in_array($path, $deprecatedActions)) {
    jsonResponse([
        'success' => false,
        'error' => 'DEPRECATED: Vui lòng sử dụng /api/smc-db.php cho tất cả thao tác học phí.',
        'redirectTo' => '/api/smc-db.php'
    ], 410);
}

// ──── TOGGLE MAINTENANCE ────
if (($parts[0] ?? '') === 'admin' && ($parts[1] ?? '') === 'toggle-maintenance') {
    $auth = requireRole(['ADMIN','admin']);
    if ($method === 'GET') {
        jsonResponse(getMaintenanceInfo());
    }
    if ($method === 'POST') {
        $input = jsonInput();
        $enabled = (bool)($input['enabled'] ?? false);
        setMaintenanceMode($enabled, $auth['id'], $input['note'] ?? '');
        jsonResponse(['success' => true, 'enabled' => $enabled]);
    }
}

// ──── FIX DATA (Admin maintenance) ────
if (($parts[0] ?? '') === 'fix-data') {
    $auth = requireRole(['ADMIN','admin']);
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);

    $results = [];
    // Sync payment_status từ invoices sang enrollments
    $c1 = DB::execute(
        "UPDATE enrollments e JOIN invoices i ON i.enrollment_id=e.id
         SET e.payment_status = CASE
             WHEN i.status='paid' THEN 'fully_paid'
             WHEN i.status='partial' THEN 'partially_paid'
             WHEN i.status='exempt' THEN 'exempt'
             WHEN i.status='frozen' THEN 'fully_paid'
             ELSE 'unpaid' END,
         e.eligible_for_exam = (i.status IN ('paid','exempt','frozen')),
         e.updated_at = NOW()
         WHERE e.payment_status != CASE
             WHEN i.status='paid' THEN 'fully_paid'
             WHEN i.status='partial' THEN 'partially_paid'
             WHEN i.status='exempt' THEN 'exempt'
             ELSE 'unpaid' END"
    );
    $results[] = "Đồng bộ payment_status: $c1 enrollments";

    // Sync student names vào invoices
    $c2 = DB::execute(
        "UPDATE invoices i JOIN enrollments e ON i.enrollment_id=e.id JOIN users u ON e.student_id=u.id
         SET i.student_name=u.full_name, i.student_email=u.email, i.student_phone=u.phone
         WHERE i.student_name='' OR i.student_name IS NULL"
    );
    $results[] = "Đồng bộ student_name: $c2 invoices";

    jsonResponse(['success' => true, 'results' => $results]);
}

// ──── Unknown action ────
jsonResponse(['error' => 'Unknown action: ' . ($path ?: '(empty)')], 404);
