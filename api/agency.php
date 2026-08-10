<?php
/**
 * SMC Training — Agency API (Đại lý)
 * Quản lý đại lý: tạo, sửa, xóa, phân quyền, chiết khấu
 * Đại lý: import học viên, xem học viên của mình
 * Endpoint: /api/agency.php
 */

require_once __DIR__ . '/helpers.php';

smcCorsHeaders();

// ── Auth check ──
$auth = authenticate();

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

// =====================================================================
// AGENCY HELPER FUNCTIONS
// =====================================================================

function loadAgencies() {
    return loadData('agencies');
}

function saveAgencies($data) {
    return saveData('agencies', $data);
}

function findAgencyById($id) {
    $agencies = loadAgencies();
    foreach ($agencies as $a) {
        if ($a['id'] === $id) return $a;
    }
    return null;
}

function findAgencyByUserId($userId) {
    $agencies = loadAgencies();
    foreach ($agencies as $a) {
        if ($a['userId'] === $userId) return $a;
    }
    return null;
}

function sanitizeAgency($a) {
    return [
        'id' => $a['id'],
        'userId' => $a['userId'] ?? '',
        'name' => $a['name'] ?? '',
        'code' => $a['code'] ?? '',
        'contactPerson' => $a['contactPerson'] ?? '',
        'phone' => $a['phone'] ?? '',
        'email' => $a['email'] ?? '',
        'address' => $a['address'] ?? '',
        'taxCode' => $a['taxCode'] ?? '',
        'status' => $a['status'] ?? 'active',
        'discountPercent' => (float)($a['discountPercent'] ?? 0),
        'subjectType' => $a['subjectType'] ?? 'all',       // 'all' | 'vlos' | 'bvlos' | ['c001','c002']
        'allowedCourses' => $a['allowedCourses'] ?? [],      // mảng courseId được phép
        'notes' => $a['notes'] ?? '',
        'createdAt' => $a['createdAt'] ?? '',
        'createdBy' => $a['createdBy'] ?? '',
        'updatedAt' => $a['updatedAt'] ?? '',
    ];
}

/**
 * Tính học phí thực thu = học phí gốc - chiết khấu đại lý
 */
function calcActualTuition($basePrice, $agency) {
    $discount = (float)($agency['discountPercent'] ?? 0);
    if ($discount <= 0) return $basePrice;
    return max(0, $basePrice - ($basePrice * $discount / 100));
}

/**
 * Lấy danh sách học viên thuộc đại lý
 */
function getAgencyStudents($agencyId) {
    $users = loadData('users');
    return array_values(array_filter($users, function($u) use ($agencyId) {
        return ($u['agencyId'] ?? '') === $agencyId;
    }));
}

// =====================================================================
// SEED: Tạo dữ liệu mẫu nếu chưa có
// =====================================================================
function seedAgencies() {
    $agencies = loadAgencies();
    if (empty($agencies)) {
        saveAgencies([]);
    }
}
seedAgencies();

// =====================================================================
// ROUTE: Đăng nhập cho đại lý
// =====================================================================
// POST /api/agency/login
if ($method === 'POST' && ($parts[0] ?? '') === 'login') {
    $input = jsonInput();
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    if (!$email || !$password) {
        jsonResponse(['error' => 'Vui lòng nhập email và mật khẩu'], 400);
    }

    rateLimit('agency_login:' . getClientIP(), 5, 60, 'Quá nhiều lần đăng nhập');

    // Tìm user có role AGENCY
    $user = findUserByEmail($email);
    if (!$user || !password_verify($password, $user['password'])) {
        jsonResponse(['error' => 'Email hoặc mật khẩu không đúng'], 401);
    }
    if ($user['role'] !== 'AGENCY') {
        jsonResponse(['error' => 'Tài khoản không phải Đại lý'], 403);
    }
    if ($user['status'] !== 'ACTIVE') {
        jsonResponse(['error' => 'Tài khoản đại lý chưa được kích hoạt'], 403);
    }

    // Lấy thông tin đại lý
    $agency = findAgencyByUserId($user['id']);

    $token = createToken($user);
    setTokenCookie($token);

    jsonResponse([
        'token' => $token,
        'user' => sanitizeUser($user),
        'agency' => $agency ? sanitizeAgency($agency) : null,
    ]);
}

// =====================================================================
// ROUTE: Lấy thông tin đại lý của user hiện tại
// =====================================================================
// GET /api/agency/me
if ($method === 'GET' && ($parts[0] ?? '') === 'me') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    $agency = findAgencyByUserId($auth['id']);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy thông tin đại lý'], 404);

    // FIX: Đọc cả invoices.json (v3) và tuitions.json (cũ)
    $myStudents = getAgencyStudents($agency['id']);
    $tuitions = loadData('tuitions');
    $invoices = loadData('invoices');
    $courses = loadData('courses');
    $totalRevenue = 0;
    $totalBaseRevenue = 0;
    $totalPaidAmount = 0;
    $totalUnpaidAmount = 0;
    $paidCount = 0;
    $unpaidCount = 0;

    $courseById = [];
    foreach ($courses as $c) { $courseById[$c['id'] ?? ''] = $c; }

    // Tập hợp các student_id đã được xử lý qua invoices
    $seenStudents = [];

    // Ưu tiên invoices.json (v3)
    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        if (($inv['agencyId'] ?? '') !== $agency['id']) continue;
        if (in_array($sid, $seenStudents)) continue;

        // Bỏ qua học viên miễn phí (finalPrice = 0)
        $fpVal = (int)($inv['finalPrice'] ?? 0);
        $bpVal = (int)($inv['basePrice'] ?? 0);
        if ($fpVal <= 0 && $bpVal > 0) continue;

        $seenStudents[] = $sid;

        $baseAmount = (int)($inv['basePrice'] ?? 0);
        $totalPaid = (int)($inv['totalPaid'] ?? 0);
        if (($inv['status'] ?? '') === 'paid') $totalPaid = max($totalPaid, $baseAmount);
        $unpaid = max(0, $baseAmount - $totalPaid);

        $totalBaseRevenue += $baseAmount;
        $totalRevenue += (int)($inv['finalPrice'] ?? $baseAmount);
        $totalPaidAmount += $totalPaid;
        $totalUnpaidAmount += $unpaid;

        if (($inv['status'] ?? '') === 'paid') $paidCount++;
        else $unpaidCount++;
    }

    // Fallback: tuitions.json cho học viên chưa có invoice
    foreach ($myStudents as $s) {
        if (in_array($s['id'], $seenStudents)) continue;

        $studentTuition = null;
        foreach ($tuitions as $t) {
            if (($t['studentId'] ?? '') === $s['id']) {
                $studentTuition = $t;
                break;
            }
        }
        if ($studentTuition) {
            $baseAmount = (int)($studentTuition['baseAmount'] ?? $studentTuition['amount'] ?? 0);
            $actualAmount = (int)($studentTuition['amount'] ?? 0);
            $paid = (int)($studentTuition['partialAmount'] ?? $studentTuition['paymentAmount'] ?? 0);
            if (($studentTuition['status'] ?? '') === 'paid') $paid = $actualAmount;
            $unpaid = max(0, $actualAmount - $paid);

            $totalBaseRevenue += $baseAmount;
            $totalRevenue += $actualAmount;
            $totalPaidAmount += $paid;
            $totalUnpaidAmount += $unpaid;

            if (($studentTuition['status'] ?? '') === 'paid') $paidCount++;
            else $unpaidCount++;
        }
    }

    $result = sanitizeAgency($agency);
    $result['studentCount'] = count($myStudents);
    $result['totalRevenue'] = $totalRevenue;
    $result['totalBaseRevenue'] = $totalBaseRevenue;
    $result['totalPaidAmount'] = $totalPaidAmount;
    $result['totalUnpaidAmount'] = $totalUnpaidAmount;
    $result['paidCount'] = $paidCount;
    $result['unpaidCount'] = $unpaidCount;
    $result['collectionRate'] = $totalBaseRevenue > 0 ? round($totalPaidAmount / $totalBaseRevenue * 100, 1) : 0;

    jsonResponse($result);
}

// =====================================================================
// ROUTE: ADMIN - CRUD Đại lý
// =====================================================================

// GET /api/agency/list — Admin lấy danh sách tất cả đại lý
if ($method === 'GET' && ($parts[0] ?? '') === 'list') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN', 'STAFF'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $agencies = loadAgencies();
    $users = loadData('users');

    // Enrich với thông tin user + thống kê
    $result = [];
    foreach ($agencies as $a) {
        $entry = sanitizeAgency($a);
        // Tìm user account của đại lý
        $agencyUser = null;
        foreach ($users as $u) {
            if ($u['id'] === $a['userId']) {
                $agencyUser = sanitizeUser($u);
                break;
            }
        }
        $entry['user'] = $agencyUser;
        // Thống kê học viên
        $myStudents = getAgencyStudents($a['id']);
        $entry['studentCount'] = count($myStudents);

        $result[] = $entry;
    }

    jsonResponse(['agencies' => $result]);
}

// GET /api/agency/get/{id} — Admin lấy chi tiết 1 đại lý
if ($method === 'GET' && ($parts[0] ?? '') === 'get' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN', 'STAFF'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $agencyId = $parts[1];
    $agency = findAgencyById($agencyId);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    $result = sanitizeAgency($agency);
    $result['students'] = array_map('sanitizeUser', getAgencyStudents($agencyId));

    // Thêm thống kê học phí
    $tuitions = loadData('tuitions');
    $totalTuition = 0;
    $totalActual = 0;
    foreach ($result['students'] as $s) {
        foreach ($tuitions as $t) {
            if (($t['studentId'] ?? '') === $s['id']) {
                $totalTuition += (int)($t['amount'] ?? 0);
                $totalActual += calcActualTuition((int)($t['amount'] ?? 0), $agency);
            }
        }
    }
    $result['stats'] = [
        'totalStudents' => count($result['students']),
        'totalTuition' => $totalTuition,
        'totalActualTuition' => $totalActual,
        'discountPercent' => (float)($agency['discountPercent'] ?? 0),
    ];

    jsonResponse(['agency' => $result]);
}

// POST /api/agency/create — Admin tạo đại lý mới
if ($method === 'POST' && ($parts[0] ?? '') === 'create') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN'])) {
        jsonResponse(['error' => 'Forbidden - Chỉ ADMIN được tạo đại lý'], 403);
    }

    $input = jsonInput();
    $name = trim($input['name'] ?? '');
    $code = trim($input['code'] ?? '');
    $contactPerson = trim($input['contactPerson'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $discountPercent = (float)($input['discountPercent'] ?? 0);
    $address = trim($input['address'] ?? '');
    $taxCode = trim($input['taxCode'] ?? '');
    $subjectType = $input['subjectType'] ?? 'all';
    $allowedCourses = $input['allowedCourses'] ?? [];
    $notes = trim($input['notes'] ?? '');

    // Validate
    if (!$name) jsonResponse(['error' => 'Tên đại lý không được để trống'], 400);
    if (!$email) jsonResponse(['error' => 'Email đại lý không được để trống'], 400);
    if (!$password || strlen($password) < 6) {
        jsonResponse(['error' => 'Mật khẩu phải có ít nhất 6 ký tự'], 400);
    }
    if ($discountPercent >= 100) {
        jsonResponse(['error' => 'Chiết khấu đại lý phải nhỏ hơn 100%. Không được tạo học viên miễn phí.'], 400);
    }

    // Kiểm tra trùng email
    $existingUser = findUserByEmail($email);
    if ($existingUser) {
        jsonResponse(['error' => 'Email đã được sử dụng bởi tài khoản khác'], 409);
    }

    // Kiểm tra trùng code
    $agencies = loadAgencies();
    foreach ($agencies as $a) {
        if ($code && $a['code'] === $code) {
            jsonResponse(['error' => 'Mã đại lý đã tồn tại'], 409);
        }
    }

    $now = date('c');

    // Tạo user account cho đại lý
    $newUserId = genId('u-agency-');
    $users = loadData('users');
    $newUser = [
        'id' => $newUserId,
        'email' => $email,
        'password' => password_hash($password, PASSWORD_BCRYPT),
        'role' => 'AGENCY',
        'fullName' => $contactPerson ?: $name,
        'phone' => $phone,
        'status' => 'ACTIVE',
        'createdAt' => $now,
    ];
    $users[] = $newUser;
    saveData('users', $users);

    // Tạo agency record
    $agencyId = genId('ag-');
    $newAgency = [
        'id' => $agencyId,
        'userId' => $newUserId,
        'name' => $name,
        'code' => $code ?: 'DL-' . strtoupper(bin2hex(random_bytes(3))),
        'contactPerson' => $contactPerson,
        'phone' => $phone,
        'email' => $email,
        'address' => $address,
        'taxCode' => $taxCode,
        'status' => 'active',
        'discountPercent' => $discountPercent,
        'subjectType' => $subjectType,
        'allowedCourses' => $allowedCourses,
        'notes' => $notes,
        'createdAt' => $now,
        'createdBy' => $auth['id'],
        'updatedAt' => $now,
    ];
    $agencies[] = $newAgency;
    saveAgencies($agencies);

    jsonResponse([
        'success' => true,
        'message' => 'Đã tạo đại lý thành công',
        'agency' => sanitizeAgency($newAgency),
        'user' => sanitizeUser($newUser),
    ], 201);
}

// PUT /api/agency/update/{id} — Admin cập nhật đại lý
if ($method === 'PUT' && ($parts[0] ?? '') === 'update' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN'])) {
        jsonResponse(['error' => 'Forbidden - Chỉ ADMIN được sửa đại lý'], 403);
    }

    $agencyId = $parts[1];
    $agencies = loadAgencies();
    $found = false;

    $input = jsonInput();
    $now = date('c');

    foreach ($agencies as &$a) {
        if ($a['id'] === $agencyId) {
            if (isset($input['name'])) $a['name'] = trim($input['name']);
            if (isset($input['contactPerson'])) $a['contactPerson'] = trim($input['contactPerson']);
            if (isset($input['phone'])) $a['phone'] = trim($input['phone']);
            if (isset($input['email'])) $a['email'] = trim($input['email']);
            if (isset($input['address'])) $a['address'] = trim($input['address']);
            if (isset($input['taxCode'])) $a['taxCode'] = trim($input['taxCode']);
            if (isset($input['discountPercent'])) {
                $disc = (float)$input['discountPercent'];
                if ($disc >= 100) jsonResponse(['error' => 'Chiết khấu đại lý phải nhỏ hơn 100%. Không được tạo học viên miễn phí.'], 400);
                $a['discountPercent'] = $disc;
            }
            if (isset($input['subjectType'])) $a['subjectType'] = $input['subjectType'];
            if (isset($input['allowedCourses'])) $a['allowedCourses'] = $input['allowedCourses'];
            if (isset($input['notes'])) $a['notes'] = trim($input['notes']);
            if (isset($input['status'])) $a['status'] = $input['status'];
            $a['updatedAt'] = $now;

            // Nếu email thay đổi, cập nhật cả user account
            if (isset($input['email']) && !empty($a['userId'])) {
                $users = loadData('users');
                foreach ($users as &$u) {
                    if ($u['id'] === $a['userId']) {
                        $u['email'] = trim($input['email']);
                        if (isset($input['contactPerson'])) $u['fullName'] = trim($input['contactPerson']);
                        if (isset($input['phone'])) $u['phone'] = trim($input['phone']);
                        if (!empty($input['password'])) {
                            $u['password'] = password_hash($input['password'], PASSWORD_BCRYPT);
                        }
                        break;
                    }
                }
                unset($u);
                saveData('users', $users);
            }

            $found = true;
            $updatedAgency = $a;
            break;
        }
    }
    unset($a);

    if (!$found) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    saveAgencies($agencies);
    jsonResponse(['success' => true, 'message' => 'Đã cập nhật đại lý', 'agency' => sanitizeAgency($updatedAgency)]);
}

// DELETE /api/agency/delete/{id} — Admin xóa đại lý
if ($method === 'DELETE' && ($parts[0] ?? '') === 'delete' && !empty($parts[1])) {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN'])) {
        jsonResponse(['error' => 'Forbidden - Chỉ ADMIN được xóa đại lý'], 403);
    }

    $agencyId = $parts[1];
    $agencies = loadAgencies();
    $targetAgency = null;

    foreach ($agencies as $a) {
        if ($a['id'] === $agencyId) {
            $targetAgency = $a;
            break;
        }
    }

    if (!$targetAgency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    // Xóa user account của đại lý
    $users = loadData('users');
    $users = array_values(array_filter($users, fn($u) => $u['id'] !== $targetAgency['userId']));
    saveData('users', $users);

    // Gỡ agencyId khỏi học viên của đại lý (học viên vẫn giữ, chỉ mất liên kết đại lý)
    $allUsers = loadData('users');
    $updatedUsers = false;
    foreach ($allUsers as &$u) {
        if (($u['agencyId'] ?? '') === $agencyId) {
            unset($u['agencyId']);
            $updatedUsers = true;
        }
    }
    unset($u);
    if ($updatedUsers) saveData('users', $allUsers);

    // Xóa agency
    $agencies = array_values(array_filter($agencies, fn($a) => $a['id'] !== $agencyId));
    saveAgencies($agencies);

    jsonResponse(['success' => true, 'message' => 'Đã xóa đại lý và tài khoản liên quan']);
}

// =====================================================================
// ROUTE: ĐẠI LÝ — Import học viên
// =====================================================================
// POST /api/agency/import-students
if ($method === 'POST' && ($parts[0] ?? '') === 'import-students') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if ($auth['role'] !== 'AGENCY') {
        jsonResponse(['error' => 'Forbidden - Chỉ Đại lý mới được import học viên'], 403);
    }

    $agency = findAgencyByUserId($auth['id']);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy thông tin đại lý'], 404);
    if ($agency['status'] !== 'active') jsonResponse(['error' => 'Đại lý đã bị khóa'], 403);

    rateLimit('agency_import:' . $auth['id'], 5, 600, 'Quá nhiều lần import. Vui lòng thử lại sau 20 phút.');

    // Parse data từ JSON body hoặc file upload
    $rows = [];
    $importMode = '';

    if (!empty($_FILES['file'])) {
        $file = $_FILES['file'];
        $tmpName = $file['tmp_name'];
        $fileName = $file['name'];
        $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

        if ($ext === 'csv') {
            $text = file_get_contents($tmpName);
            $rows = parseCsvStringGeneric($text);
            $importMode = 'csv_upload';
        } elseif (in_array($ext, ['xlsx', 'xls'])) {
            $rows = parseXlsxFile($tmpName);
            $importMode = 'xlsx_upload';
        } else {
            jsonResponse(['error' => 'Định dạng file không được hỗ trợ. Vui lòng upload file .csv, .xlsx hoặc .xls'], 400);
        }
    } else {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $rows = is_array($data) ? $data : ($data['students'] ?? $data['data'] ?? []);
        $importMode = 'json_input';
    }

    if (empty($rows)) {
        jsonResponse(['error' => 'Không có dữ liệu học viên. Vui lòng kiểm tra file và thử lại.'], 400);
    }

    // Xử lý import
    $users = loadData('users');
    $courses = loadData('courses');
    $tuitions = loadData('tuitions');
    $enrollments = loadData('enrollments');
    $invoices = loadData('invoices');        // <-- Thêm: tạo invoice để liên kết Admin/Staff
    $transactions = loadData('transactions'); // <-- Thêm: lưu transaction cho luồng duyệt

    $now = date('c');
    $results = [
        'success' => true,
        'imported' => 0,
        'skipped' => 0,
        'errors' => [],
        'details' => [],
    ];

    // Map course
    $courseMap = [];
    foreach ($courses as $c) {
        $name = mb_strtolower($c['name'] ?? '');
        $code = mb_strtolower($c['code'] ?? '');
        $cat = mb_strtolower($c['category'] ?? '');

        $courseMap[$c['id']] = $c['id'];
        if ($name) $courseMap[$name] = $c['id'];
        if ($code) $courseMap[$code] = $c['id'];
        if ($cat === 'a') {
            $courseMap['a'] = $courseMap['a-vlos'] = $courseMap['hạng a'] = $courseMap['hang a'] = $c['id'];
        }
        if ($cat === 'b') {
            $courseMap['b'] = $courseMap['b-bvlos'] = $courseMap['hạng b'] = $courseMap['hang b'] = $courseMap['bvlos'] = $c['id'];
        }
    }

    // Kiểm tra subjectType của đại lý
    $subjectType = $agency['subjectType'] ?? 'all';
    $allowedCourses = $agency['allowedCourses'] ?? [];

    foreach ($rows as $index => $row) {
        $lineNum = $index + 2;

        $fullName = trim($row['Họ tên'] ?? $row['Họ và tên'] ?? $row['fullName'] ?? $row['hoten'] ?? $row['name'] ?? '');
        $phone = trim($row['Số điện thoại'] ?? $row['SĐT'] ?? $row['phone'] ?? $row['sdt'] ?? $row['dienthoai'] ?? '');
        $email = trim($row['Email'] ?? $row['email'] ?? $row['mail'] ?? '');

        if (empty($fullName)) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: Thiếu họ tên";
            continue;
        }

        if (empty($phone) && empty($email)) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: Thiếu SĐT hoặc Email cho {$fullName}";
            continue;
        }

        // Kiểm tra trùng
        $isDuplicate = false;
        foreach ($users as $u) {
            $uEmail = $u['email'] ?? '';
            $uPhone = $u['phone'] ?? '';
            if (($email && strtolower($uEmail) === strtolower($email)) ||
                ($phone && $uPhone === $phone)) {
                $isDuplicate = true;
                break;
            }
        }

        if ($isDuplicate) {
            $results['skipped']++;
            $results['details'][] = "⏭ {$fullName}: Đã tồn tại (trùng email/SĐT)";
            continue;
        }

        // Xác định khóa học
        $courseRaw = trim($row['Khóa học'] ?? $row['Khoa hoc'] ?? $row['course'] ?? $row['khoahoc'] ?? '');
        $courseId = '';
        if ($courseRaw) {
            $courseKey = mb_strtolower($courseRaw);
            if (isset($courseMap[$courseKey])) {
                $courseId = $courseMap[$courseKey];
            } else {
                // fuzzy match
                foreach ($courseMap as $ck => $cid) {
                    if (strpos($courseKey, $ck) !== false || strpos($ck, $courseKey) !== false) {
                        $courseId = $cid;
                        break;
                    }
                }
            }
        }

        // Kiểm tra đại lý có được phép tạo học viên khóa này không
        if ($subjectType === 'vlos' && $courseId && !in_array($courseId, ['c001'])) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: {$fullName} - Khóa học không thuộc phạm vi VLOS của đại lý";
            continue;
        }
        if ($subjectType === 'bvlos' && $courseId && in_array($courseId, ['c001'])) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: {$fullName} - Khóa học VLOS không thuộc phạm vi BVLOS của đại lý";
            continue;
        }
        if (!empty($allowedCourses) && $courseId && !in_array($courseId, $allowedCourses)) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: {$fullName} - Khóa học không được phép cho đại lý này";
            continue;
        }

        if (!$courseId && !empty($courses)) {
            $courseId = $courses[0]['id'];
        }

        $courseObj = null;
        if ($courseId) {
            foreach ($courses as $c) {
                if ($c['id'] === $courseId) { $courseObj = $c; break; }
            }
        }

        // Tính học phí: Ưu tiên dùng giá trị từ file import (cột "Học phí" / "tuition" / "price")
        $tuitionFromImport = trim($row['Học phí'] ?? $row['Hoc phi'] ?? $row['tuition'] ?? $row['price'] ?? $row['hocphi'] ?? '');
        if ($tuitionFromImport !== '') {
            // Parse số từ chuỗi (bỏ dấu phân cách, chấp nhận cả số nguyên và số có ký hiệu)
            $tuitionFromImport = (int)preg_replace('/[^0-9]/', '', $tuitionFromImport);
        }
        $basePrice = $tuitionFromImport > 0 ? $tuitionFromImport : (int)($courseObj['price'] ?? 0);
        $actualPrice = calcActualTuition($basePrice, $agency);

        // Đã nộp ban đầu: từ cột "Đã nộp" / "paid" / "danop"
        $paidFromImport = trim($row['Đã nộp'] ?? $row['Da nop'] ?? $row['paid'] ?? $row['danop'] ?? '');
        $initialPaid = 0;
        if ($paidFromImport !== '') {
            $initialPaid = (int)preg_replace('/[^0-9]/', '', $paidFromImport);
        }
        $initialPaid = min($initialPaid, $basePrice); // Không thể nộp nhiều hơn học phí
        $remainingDue = max(0, $basePrice - $initialPaid);

        // KHÔNG cho phép học viên miễn phí cho đại lý
        if ($actualPrice <= 0 && $basePrice > 0) {
            $results['skipped']++;
            $results['errors'][] = "Dòng {$lineNum}: {$fullName} - Học phí sau chiết khấu = 0đ (miễn phí). Không được phép tạo học viên miễn phí cho đại lý.";
            continue;
        }

        $loginEmail = $email ?: ($phone ?: 'import-' . bin2hex(random_bytes(4)) . '@smc.edu.vn');
        $defaultPassword = generateSecurePassword(12);
        $newUserId = genId('u-student-');

        $newUser = [
            'id' => $newUserId,
            'email' => $loginEmail,
            'password' => password_hash($defaultPassword, PASSWORD_BCRYPT),
            'role' => 'STUDENT',
            'fullName' => $fullName,
            'phone' => $phone,
            'status' => 'PENDING',                  // Cần Staff duyệt tài khoản
            'courseId' => $courseId,
            'agencyId' => $agency['id'],          // Gán vào đại lý hiện tại
            'address' => trim($row['Địa chỉ'] ?? $row['Dia chi'] ?? $row['address'] ?? ''),
            'notes' => trim($row['Ghi chú'] ?? $row['Ghi chu'] ?? $row['note'] ?? $row['notes'] ?? ''),
            'importedFrom' => 'agency/' . $importMode,
            'importedAt' => $now,
            'importedBy' => $auth['id'],
            'createdAt' => $now,
        ];
        $users[] = $newUser;

        // Xác định trạng thái dựa trên số tiền đã nộp
        $invoiceStatus = 'pending';
        if ($initialPaid >= $basePrice) {
            $invoiceStatus = 'paid';
        } elseif ($initialPaid > 0) {
            $invoiceStatus = 'partial';
        }

        // ── TẠO GIAO DỊCH (transaction) nếu có tiền đã nộp ──
        // Khi đại lý khai báo học viên đã nộp tiền, tạo transaction pending
        // để Staff/Kế toán kiểm tra & duyệt → minh bạch luồng tiền
        $txnId = null;
        if ($initialPaid > 0) {
            $txnId = 'txn-' . bin2hex(random_bytes(8));
            $transactions[] = [
                'id' => $txnId,
                'invoiceId' => $invoiceId,
                'studentId' => $newUserId,
                'amount' => $initialPaid,
                'method' => 'cash',               // Đại lý thu tiền mặt
                'receiptImage' => null,
                'submittedBy' => $auth['id'],
                'submittedByName' => $auth['email'] ?? '',
                'confirmedBy' => null,
                'status' => 'staff_confirmed',     // Đại lý đã xác nhận thu → Staff/Accountant duyệt
                'note' => 'Đại lý ' . ($agency['name'] ?? '') . ' xác nhận đã thu — chờ Staff/Kế toán duyệt',
                'createdAt' => $now,
                'confirmedAt' => null,
            ];
        }

        // Tạo invoice với totalPaid = initialPaid nhưng status cần Staff duyệt
        // Nếu đã nộp đủ → invoice status = 'paid' NHƯNG transaction ở trạng thái staff_confirmed
        // (chưa kích hoạt khóa học cho đến khi Kế toán duyệt)

        // Tạo tuition với học phí thực thu (giữ lại tương thích với code cũ)
        $tuitions[] = [
            'id' => 'tuition-' . bin2hex(random_bytes(6)),
            'studentId' => $newUserId,
            'studentName' => $fullName,
            'courseId' => $courseId,
            'courseName' => $courseObj['name'] ?? '',
            'amount' => $actualPrice,              // Học phí sau chiết khấu
            'baseAmount' => $basePrice,             // Học phí gốc
            'discountPercent' => (float)($agency['discountPercent'] ?? 0),
            'agencyId' => $agency['id'],
            'partialAmount' => $initialPaid,
            'step' => $invoiceStatus === 'paid' ? 'active' : ($initialPaid > 0 ? 'partial' : 'pending'),
            'status' => $invoiceStatus,
            'createdAt' => $now,
        ];

        // ── TẠO INVOICE TRONG invoices.json ── (liên kết với Admin/Staff quản lý)
        $invoiceId = 'inv-' . bin2hex(random_bytes(8));
        $discountPercentVal = (float)($agency['discountPercent'] ?? 0);
        $discountAmountVal = $discountPercentVal > 0 ? (int)($basePrice * $discountPercentVal / 100) : 0;
        $finalPriceVal = max(0, $basePrice - $discountAmountVal);

        $invoices[] = [
            'id' => $invoiceId,
            'studentId' => $newUserId,
            'studentName' => $fullName,
            'studentEmail' => $loginEmail,
            'studentPhone' => $phone,
            'courseId' => $courseId,
            'courseName' => $courseObj['name'] ?? '',
            'basePrice' => $basePrice,
            'agencyId' => $agency['id'],
            'agencyName' => $agency['name'] ?? '',
            'agencyDiscountPercent' => $discountPercentVal,
            'agencyDiscountAmount' => $discountAmountVal,
            'finalPrice' => $finalPriceVal,
            'totalPaid' => $initialPaid,
            'remainingDue' => $remainingDue,
            'status' => $invoiceStatus,
            'step' => $invoiceStatus === 'paid' ? 'active' : ($initialPaid > 0 ? 'partial' : 'pending'),
            'note' => 'Nhập bởi Đại lý: ' . ($agency['name'] ?? '') . ' (' . $importMode . ')',
            'createdBy' => $auth['id'],
            'createdAt' => $now,
            'updatedAt' => $now,
            '_source' => 'agency_import',          // Đánh dấu nguồn gốc từ đại lý
        ];

        // Tạo enrollment
        $enrollments[] = [
            'student_id' => $newUserId,
            'class_id' => '',
            'course_id' => $courseId,
            'course_name' => $courseObj['name'] ?? '',
            'agency_id' => $agency['id'],
            'documents' => [
                'id_card' => ['status' => 'pending', 'url' => ''],
                'health_cert' => ['status' => 'pending', 'url' => ''],
                'education' => ['status' => 'pending', 'url' => ''],
            ],
            'payment' => ['amount' => $basePrice, 'paid' => 0, 'status' => 'pending', 'method' => '', 'date' => null, 'confirmed_by' => null],  // Chưa kích hoạt, chờ Kế toán duyệt
            'status' => 'pending_review',          // Chờ Staff duyệt tài khoản + Kế toán duyệt phiếu thu
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

        $results['imported']++;
        $courseLabel = $courseObj['name'] ?? $courseId ?: 'Chưa có khóa học';
        $discountLabel = $agency['discountPercent'] > 0 ? " (CK {$agency['discountPercent']}%)" : '';
        $paidInfo = $initialPaid > 0 ? " — Đã nộp: " . number_format($initialPaid) . "đ" : '';
        $dueInfo = $remainingDue > 0 ? " — Còn: " . number_format($remainingDue) . "đ" : " — Đã nộp đủ ✅";
        $results['details'][] = "✅ {$fullName} — {$courseLabel}{$discountLabel} — HP: " . number_format($basePrice) . "đ{$paidInfo}{$dueInfo}";

        // Gửi email thông báo nếu có email
        if ($email && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $loginUrl = 'https://smc-training.com/login';
            $agencyName = $agency['name'];
            $subject = "[SMC Training] Tài khoản học viên đã được tạo - {$fullName}";
            $message = <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin:0; padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding: 20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <tr><td style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px 40px; text-align:center;">
        <h1 style="color:#fff; margin:0; font-size:22px;">🎓 Tài Khoản Học Viên Đã Được Tạo</h1>
    </td></tr>
    <tr><td style="padding: 32px 40px; color: #333;">
        <p style="font-size:16px;">Xin chào <strong>{$fullName}</strong>,</p>
        <p style="font-size:14px; line-height:1.7; color:#555;">
            Tài khoản học viên của bạn đã được tạo bởi Đại lý <strong>{$agencyName}</strong>.
        </p>
        <p style="font-size:14px; color:#555;">Khóa học: <strong>{$courseLabel}</strong></p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff; border:1px solid #d0e3f7; border-radius:8px; margin: 20px 0;">
        <tr><td style="padding: 20px 24px;">
            <p style="font-size:14px; font-weight:bold; margin:0 0 12px; color:#1a73e8;">📋 Thông tin đăng nhập</p>
            <table cellpadding="4" cellspacing="0">
                <tr><td style="font-size:13px; color:#777; width:100px;">Tài khoản:</td><td style="font-size:14px; font-weight:bold;">{$email}</td></tr>
                <tr><td style="font-size:13px; color:#777;">Mật khẩu:</td><td style="font-size:14px; font-weight:bold;">{$defaultPassword}</td></tr>
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
            @mail($email, $subject, $message, $headers, '-f no-reply@smc-training.com');
        }
    }

    // Save all (bao gồm invoices để Admin/Staff xem được)
    saveData('users', $users);
    saveData('tuitions', $tuitions);
    saveData('enrollments', $enrollments);
    saveData('invoices', $invoices);
    if (!empty($transactions)) {
        saveData('transactions', $transactions);
    }

    jsonResponse([
        'success' => true,
        'message' => "Đã nhập thành công {$results['imported']}/" . count($rows) . " học viên",
        'imported' => $results['imported'],
        'skipped' => $results['skipped'],
        'total' => count($rows),
        'errors' => $results['errors'],
        'details' => $results['details'],
    ], 201);
}

// =====================================================================
// ROUTE: ĐẠI LÝ — Xem danh sách học viên của mình
// =====================================================================
// GET /api/agency/my-students
if ($method === 'GET' && ($parts[0] ?? '') === 'my-students') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN', 'STAFF', 'AGENCY'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $agencyId = null;

    if ($auth['role'] === 'AGENCY') {
        $agency = findAgencyByUserId($auth['id']);
        if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
        $agencyId = $agency['id'];
    } else {
        // Admin/Staff có thể filter theo agency
        $agencyId = $_GET['agencyId'] ?? null;
    }

    $allUsers = loadData('users');
    $allTuitions = loadData('tuitions');
    $allCourses = loadData('courses');
    $allClasses = loadData('classes');
    $allEnrollments = loadData('enrollments');
    $invoices = loadData('invoices');   // Load invoices.json để đồng bộ

    // Build course lookup
    $courseById = []; $courseByLegacy = [];
    foreach ($allCourses as $c) {
        $courseById[$c['id'] ?? ''] = $c;
        if (!empty($c['legacy_id'])) $courseByLegacy[$c['legacy_id']] = $c;
    }

    // Build class lookup
    $classById = [];
    foreach ($allClasses as $cl) { $classById[$cl['id'] ?? ''] = $cl; }

    $students = [];
    foreach ($allUsers as $u) {
        if ($u['role'] !== 'STUDENT') continue;
        if ($agencyId && ($u['agencyId'] ?? '') !== $agencyId) continue;
        if (!$agencyId && ($u['agencyId'] ?? '')) continue; // chỉ lấy học viên có đại lý

        $student = sanitizeUser($u);
        $student['agencyId'] = $u['agencyId'] ?? '';

        // Tìm enrollment
        $enrollment = null;
        foreach ($allEnrollments as $e) {
            if (($e['student_id'] ?? '') === $u['id']) {
                $enrollment = $e;
                break;
            }
        }

        // Tìm class từ enrollment
        $classId = $enrollment['class_id'] ?? '';
        $foundClass = $classId ? ($classById[$classId] ?? null) : null;
        // Fallback: tìm class có student_ids chứa user id
        if (!$foundClass) {
            foreach ($allClasses as $cl) {
                if (in_array($u['id'], $cl['student_ids'] ?? [])) {
                    $foundClass = $cl;
                    break;
                }
            }
        }

        // Tìm course từ enrollment > class > user.courseId
        $courseId = $enrollment['course_id'] ?? $foundClass['course_id'] ?? $u['courseId'] ?? '';
        $foundCourse = null;
        if ($courseId && isset($courseById[$courseId])) {
            $foundCourse = $courseById[$courseId];
        } elseif ($courseId && isset($courseByLegacy[$courseId])) {
            $foundCourse = $courseByLegacy[$courseId];
        }

        $student['class'] = $foundClass ? [
            'id' => $foundClass['id'] ?? '',
            'name' => $foundClass['name'] ?? '',
            'rank' => $foundClass['rank'] ?? '',
            'start_date' => $foundClass['start_date'] ?? '',
            'end_date' => $foundClass['end_date'] ?? '',
            'studentCount' => count($foundClass['student_ids'] ?? []),
            'maxStudents' => $foundClass['max_students'] ?? 20,
            'teacherCount' => count($foundClass['teacher_ids'] ?? []),
        ] : null;

        $student['course'] = $foundCourse ? [
            'id' => $foundCourse['id'] ?? '',
            'name' => $foundCourse['name'] ?? '',
            'code' => $foundCourse['code'] ?? '',
            'price' => (int)($foundCourse['price'] ?? 0),
        ] : null;

        $student['courseId'] = $u['courseId'] ?? $courseId;
        $student['courseName'] = $foundCourse['name'] ?? ($enrollment['course_name'] ?? '');

        // Tìm tuition (ưu tiên invoices.json mới)
        $tuition = null;
        $invoice = null;
        // Ưu tiên đọc từ invoices.json (hệ thống v3)
        foreach ($invoices as $inv) {
            if (($inv['studentId'] ?? '') === $u['id']) {
                $invoice = $inv;
                break;
            }
        }
        // Fallback: tuitions.json cũ
        foreach ($allTuitions as $t) {
            if (($t['studentId'] ?? '') === $u['id']) {
                $tuition = $t;
                break;
            }
        }

        // Tính toán học phí chi tiết
        // Logic: Học viên nộp học phí gốc (basePrice), đại lý hưởng chiết khấu
        if ($invoice) {
            $tBaseAmount = (int)($invoice['basePrice'] ?? 0);
            $tAmount = (int)($invoice['finalPrice'] ?? $tBaseAmount);
            $tTotalPaid = (int)($invoice['totalPaid'] ?? 0);
            if (($invoice['status'] ?? '') === 'paid') $tTotalPaid = $tBaseAmount;
            $tRemainingDue = max(0, $tBaseAmount - $tTotalPaid);
            $tDiscountPercent = (float)($invoice['agencyDiscountPercent'] ?? 0);
            $tOwesToSmc = $tBaseAmount > 0 ? (int)($tBaseAmount * (1 - $tDiscountPercent / 100)) : 0;
            $tStatus = $invoice['status'] ?? 'unpaid';
            $tId = $invoice['id'] ?? '';
        } else {
            $tBaseAmount = (int)($tuition['baseAmount'] ?? $tuition['amount'] ?? 0);
            $tAmount = (int)($tuition['amount'] ?? $tBaseAmount);
            $tTotalPaid = (int)($tuition['partialAmount'] ?? $tuition['paymentAmount'] ?? 0);
            if (($tuition['status'] ?? '') === 'paid') $tTotalPaid = $tBaseAmount;
            $tRemainingDue = max(0, $tBaseAmount - $tTotalPaid);
            $tDiscountPercent = (float)($tuition['discountPercent'] ?? 0);
            $tOwesToSmc = $tBaseAmount > 0 ? (int)($tBaseAmount * (1 - $tDiscountPercent / 100)) : 0;
            $tStatus = $tuition['status'] ?? 'unpaid';
            $tId = $tuition['id'] ?? '';
        }

        $student['tuition'] = ($invoice || $tuition) ? [
            'id' => $tId,
            'amount' => $tBaseAmount,        // Hiển thị học phí gốc làm số chính
            'baseAmount' => $tBaseAmount,     // Học phí gốc (đồng bộ với Admin)
            'discountPercent' => $tDiscountPercent,
            'totalPaid' => $tTotalPaid,
            'remainingDue' => $tRemainingDue,
            'owesToSmc' => $tOwesToSmc,       // SMC thực nhận (tham khảo)
            'status' => $tStatus,
            'step' => $tuition['step'] ?? 'pending',
            'paidDate' => $tuition['paidDate'] ?? null,
        ] : null;

        $student['enrollmentStatus'] = $enrollment['status'] ?? '';
        $student['stageProgress'] = $enrollment['stages'] ?? [];

        $students[] = $student;
    }

    jsonResponse([
        'students' => $students,
        'total' => count($students),
    ]);
}

// =====================================================================
// ROUTE: ADMIN — Gán học viên vào đại lý
// =====================================================================
// POST /api/agency/assign-student
if ($method === 'POST' && ($parts[0] ?? '') === 'assign-student') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);
    if (!in_array($auth['role'], ['ADMIN', 'STAFF'])) {
        jsonResponse(['error' => 'Forbidden'], 403);
    }

    $input = jsonInput();
    $studentId = $input['studentId'] ?? '';
    $agencyId = $input['agencyId'] ?? '';

    if (!$studentId) jsonResponse(['error' => 'Thiếu studentId'], 400);

    // Nếu agencyId rỗng -> gỡ học viên khỏi đại lý
    $users = loadData('users');
    $found = false;

    // Kiểm tra agency tồn tại nếu có agencyId
    if ($agencyId && !findAgencyById($agencyId)) {
        jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
    }

    foreach ($users as &$u) {
        if ($u['id'] === $studentId) {
            if ($u['role'] !== 'STUDENT') {
                jsonResponse(['error' => 'Người dùng không phải học viên'], 400);
            }
            if ($agencyId) {
                $u['agencyId'] = $agencyId;
            } else {
                unset($u['agencyId']);
            }
            $found = true;
            $updatedStudent = $u;
            break;
        }
    }
    unset($u);

    if (!$found) jsonResponse(['error' => 'Không tìm thấy học viên'], 404);

    saveData('users', $users);

    // Cập nhật tuition nếu có
    if ($agencyId) {
        $agency = findAgencyById($agencyId);
        $tuitions = loadData('tuitions');
        foreach ($tuitions as &$t) {
            if (($t['studentId'] ?? '') === $studentId) {
                $t['agencyId'] = $agencyId;
                // Tính lại học phí nếu có chiết khấu
                $baseAmount = (int)($t['baseAmount'] ?? $t['amount'] ?? 0);
                if ($baseAmount === 0) $baseAmount = (int)($t['amount'] ?? 0);
                $t['baseAmount'] = $baseAmount;
                $t['amount'] = calcActualTuition($baseAmount, $agency);
                $t['discountPercent'] = (float)($agency['discountPercent'] ?? 0);
                break;
            }
        }
        unset($t);
        saveData('tuitions', $tuitions);
    }

    jsonResponse([
        'success' => true,
        'message' => $agencyId ? 'Đã gán học viên vào đại lý' : 'Đã gỡ học viên khỏi đại lý',
        'student' => sanitizeUser($updatedStudent),
    ]);
}

// =====================================================================
// ROUTE: ĐẠI LÝ — Xem báo cáo doanh thu
// =====================================================================
// GET /api/agency/report
if ($method === 'GET' && ($parts[0] ?? '') === 'report') {
    if (!$auth) jsonResponse(['error' => 'Unauthorized'], 401);

    $agencyId = null;
    if ($auth['role'] === 'AGENCY') {
        $agency = findAgencyByUserId($auth['id']);
        if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);
        $agencyId = $agency['id'];
    } else {
        $agencyId = $_GET['agencyId'] ?? null;
    }

    if (!$agencyId) jsonResponse(['error' => 'Thiếu agencyId'], 400);

    $agency = findAgencyById($agencyId);
    if (!$agency) jsonResponse(['error' => 'Không tìm thấy đại lý'], 404);

    $agencyDiscountPercent = (float)($agency['discountPercent'] ?? 0);

    $allUsers = loadData('users');
    $allTuitions = loadData('tuitions');
    $courses = loadData('courses');
    // FIX: Đọc invoices.json mới (hệ thống v3) để đồng bộ số liệu
    $invoices = loadData('invoices');
    $transactions = loadData('transactions');

    // Build course lookup
    $courseById = []; $courseByLegacy = [];
    foreach ($courses as $c) {
        $courseById[$c['id'] ?? ''] = $c;
        if (!empty($c['legacy_id'])) $courseByLegacy[$c['legacy_id']] = $c;
    }

    // Resolve course — tìm course từ courseId hoặc courseName
    $resolveCourse = function($t) use ($courseById, $courseByLegacy, $courses) {
        $cid = $t['courseId'] ?? '';
        $cname = mb_strtolower(trim($t['courseName'] ?? ''));

        // 1. Match by ID trong courseById
        if ($cid && isset($courseById[$cid])) return $courseById[$cid];
        // 2. Match by legacy_id
        if ($cid && isset($courseByLegacy[$cid])) return $courseByLegacy[$cid];
        // 3. Match by keywords trong courseName: VLOS/BVLOS/Hạng A/Hạng B
        if ($cname) {
            foreach ($courses as $c) {
                $cn = mb_strtolower(trim($c['name'] ?? ''));
                // Exact match
                if ($cn === $cname) return $c;
            }
            foreach ($courses as $c) {
                $cn = mb_strtolower(trim($c['name'] ?? ''));
                // Match by keyword: nếu invoice có "VLOS" và course có "vlos" (hoặc ngược lại)
                $isVlos = (strpos($cname, 'vlos') !== false || strpos($cname, 'hạng a') !== false);
                $isBvlos = (strpos($cname, 'bvlos') !== false || strpos($cname, 'hạng b') !== false);
                $cIsVlos = (strpos($cn, 'vlos') !== false && strpos($cn, 'bvlos') === false);
                $cIsBvlos = (strpos($cn, 'bvlos') !== false);
                if ($isVlos && $cIsVlos) return $c;
                if ($isBvlos && $cIsBvlos) return $c;
                // Fallback: fuzzy contains
                if (strpos($cn, $cname) !== false || strpos($cname, $cn) !== false) return $c;
            }
        }
        return null;
    };

    // Get rank group: "Hạng A (VLOS)" | "Hạng B (BVLOS)"
    $getRankGroup = function($course) {
        if (!$course) return 'Chưa xác định';
        $n = mb_strtolower($course['name'] ?? '');
        if (strpos($n, 'bvlos') !== false || strpos($n, 'hạng b') !== false) return 'Hạng B (BVLOS)';
        if (strpos($n, 'vlos') !== false || strpos($n, 'hạng a') !== false) return 'Hạng A (VLOS)';
        return $course['name'] ?? 'Khóa học';
    };

    // Map student_id => student info
    $myStudents = [];
    // FIX: Cũng map từ invoices nếu student không có agencyId trong users
    foreach ($allUsers as $u) {
        if (($u['agencyId'] ?? '') === $agencyId) {
            $myStudents[$u['id']] = $u;
        }
    }

    // ── Tính toán chi tiết ──
    $totalBaseAmount = 0;       // Tổng thu theo giá gốc (trước CK)
    $totalActualAmount = 0;     // Tổng thực thu từ học viên (sau CK)
    $totalPaid = 0;             // Đã thu thực tế
    $totalUnpaid = 0;           // Chưa thu
    $totalDiscount = 0;         // Tổng chiết khấu = base - actual
    $totalOweToSmc = 0;         // Phải nộp cho SMC = basePrice × (1 - CK%)
    $paidCount = 0;
    $unpaidCount = 0;
    $byCourse = [];             // key = hạng thi
    $detailList = [];           // Chi tiết từng học viên
    $seenStudentCourse = [];    // Tránh trùng lặp giữa invoices và tuitions

    // ── ƯU TIÊN invoices.json (hệ thống mới v3) ──
    foreach ($invoices as $inv) {
        $sid = $inv['studentId'] ?? '';
        if (($inv['agencyId'] ?? '') !== $agencyId && !isset($myStudents[$sid])) continue;

        // Bỏ qua học viên miễn phí (finalPrice = 0)
        $fp = (int)($inv['finalPrice'] ?? 0);
        $bp = (int)($inv['basePrice'] ?? 0);
        if ($fp <= 0 && $bp > 0) continue;

        // Nếu không có trong myStudents, thêm vào
        if (!isset($myStudents[$sid])) {
            foreach ($allUsers as $u) {
                if ($u['id'] === $sid) { $myStudents[$sid] = $u; break; }
            }
        }
        if (!isset($myStudents[$sid])) continue;

        $cid = $inv['courseId'] ?? '';
        $student = $myStudents[$sid];
        // Dùng resolveCourse thay vì chỉ lookup $courseById
        $course = $resolveCourse(['courseId' => $cid, 'courseName' => $inv['courseName'] ?? '']);
        $groupName = $getRankGroup($course);

        $baseAmount = (int)($inv['basePrice'] ?? 0);
        $actualAmount = (int)($inv['finalPrice'] ?? $baseAmount);
        $discAmount = (int)($inv['agencyDiscountAmount'] ?? 0);
        $paid = (int)($inv['totalPaid'] ?? 0);
        if (($inv['status'] ?? '') === 'paid') $paid = max($paid, $baseAmount);
        $unpaid = max(0, $baseAmount - $paid);  // FIX: dùng baseAmount làm mốc

        // FIX: Phải nộp SMC = basePrice × (1 - CK%) — đồng bộ với Admin
        $discPct = (float)($inv['agencyDiscountPercent'] ?? $agencyDiscountPercent);
        $oweToSmc = $baseAmount > 0 ? (int)($baseAmount * (1 - $discPct / 100)) : 0;

        $seenKey = $sid . '_' . $cid;
        if (isset($seenStudentCourse[$seenKey])) continue;
        $seenStudentCourse[$seenKey] = true;

        $totalBaseAmount += $baseAmount;
        $totalActualAmount += $baseAmount;          // Dùng baseAmount làm mốc chính
        $totalDiscount += $discAmount;
        $totalPaid += $paid;
        $totalUnpaid += $unpaid;
        $totalOweToSmc += $oweToSmc;

        if (($inv['status'] ?? '') === 'paid') $paidCount++;
        else $unpaidCount++;

        // Per course group
        if (!isset($byCourse[$groupName])) {
            $byCourse[$groupName] = [
                'name' => $groupName,
                'students' => 0,
                'tuitionTotal' => 0,
                'paidToSmc' => 0,
                'owingToSmc' => 0,
                'discount' => 0,
                'received' => 0,
                'due' => 0,
            ];
        }
        $byCourse[$groupName]['tuitionTotal'] += $baseAmount;   // Giá gốc
        $byCourse[$groupName]['paidToSmc'] += $oweToSmc;
        $byCourse[$groupName]['owingToSmc'] += max(0, $baseAmount - $oweToSmc);
        $byCourse[$groupName]['discount'] += $discAmount;
        $byCourse[$groupName]['received'] += $paid;
        $byCourse[$groupName]['due'] += $unpaid;

        $detailList[] = [
            'studentName' => $student['fullName'] ?? $inv['studentName'] ?? '',
            'courseName' => $course['name'] ?? ($inv['courseName'] ?? ''),
            'rankGroup' => $groupName,
            'basePrice' => $baseAmount,        // Học phí gốc
            'actualPrice' => $baseAmount,       // = basePrice (học viên nộp theo giá gốc)
            'discount' => $discAmount,          // CK đại lý (tham khảo)
            'discountPercent' => $discPct,
            'paid' => $paid,                    // Đã nộp = basePrice - remainingDue
            'unpaid' => $unpaid,                // Còn phải nộp = basePrice - paid
            'paidToSmc' => $oweToSmc,           // SMC thực nhận sau CK (tham khảo)
            'status' => $inv['status'] ?? 'unpaid',
        ];
    }

    // ── FALLBACK: đọc tuitions.json cũ cho những học viên chưa có invoice ──
    foreach ($allTuitions as $t) {
        $sid = $t['studentId'] ?? '';
        if (!isset($myStudents[$sid])) continue;
        $cid = $t['courseId'] ?? '';
        $seenKey = $sid . '_' . $cid;
        if (isset($seenStudentCourse[$seenKey])) continue;  // Đã có trong invoices
        $seenStudentCourse[$seenKey] = true;

        $student = $myStudents[$sid];
        $course = $resolveCourse($t);
        $groupName = $getRankGroup($course);

        $coursePrice = (int)($course['price'] ?? $t['amount'] ?? 0);
        $baseAmount = (int)($t['baseAmount'] ?? $coursePrice);
        $actualAmount = (int)($t['amount'] ?? $coursePrice);
        $discountAmount = $baseAmount - $actualAmount;
        $paid = (int)($t['partialAmount'] ?? $t['paymentAmount'] ?? 0);
        if (($t['status'] ?? '') === 'paid') $paid = $actualAmount;
        $unpaid = max(0, $actualAmount - $paid);
        $oweToSmc = ($t['status'] ?? '') === 'paid' ? $actualAmount : $paid;

        $totalBaseAmount += $baseAmount;
        $totalActualAmount += $actualAmount;
        $totalDiscount += $discountAmount;
        $totalPaid += $paid;
        $totalUnpaid += $unpaid;
        $totalOweToSmc += $oweToSmc;

        if (($t['status'] ?? '') === 'paid') $paidCount++;
        else $unpaidCount++;

        if (!isset($byCourse[$groupName])) {
            $byCourse[$groupName] = [
                'name' => $groupName,
                'students' => 0,
                'tuitionTotal' => 0,
                'paidToSmc' => 0,
                'owingToSmc' => 0,
                'discount' => 0,
                'received' => 0,
                'due' => 0,
            ];
        }
        $byCourse[$groupName]['tuitionTotal'] += $baseAmount;   // Giá gốc
        $byCourse[$groupName]['paidToSmc'] += $oweToSmc;
        $byCourse[$groupName]['owingToSmc'] += ($actualAmount - $oweToSmc);
        $byCourse[$groupName]['discount'] += $discountAmount;
        $byCourse[$groupName]['received'] += $paid;
        $byCourse[$groupName]['due'] += $unpaid;

        $detailList[] = [
            'studentName' => $student['fullName'] ?? '',
            'courseName' => $course['name'] ?? ($t['courseName'] ?? ''),
            'rankGroup' => $groupName,
            'basePrice' => $baseAmount,
            'actualPrice' => $actualAmount,
            'discount' => $discountAmount,
            'discountPercent' => $agencyDiscountPercent,
            'paid' => $paid,
            'unpaid' => $unpaid,
            'paidToSmc' => $oweToSmc,
            'status' => $t['status'] ?? 'unpaid',
        ];
    }

    // Dedup student count per course group
    $courseStudents = [];
    foreach ($seenStudentCourse as $key => $_) {
        list($sid, $cid) = explode('_', $key . '_');
        $course = $courseById[$cid] ?? null;
        $groupName = $getRankGroup($course);
        if (!isset($courseStudents[$groupName])) $courseStudents[$groupName] = [];
        $courseStudents[$groupName][$sid] = true;
    }
    // Fallback từ tuitions
    foreach ($allTuitions as $t) {
        $sid = $t['studentId'] ?? '';
        if (!isset($myStudents[$sid])) continue;
        $course = $resolveCourse($t);
        $groupName = $getRankGroup($course);
        if (!isset($courseStudents[$groupName])) $courseStudents[$groupName] = [];
        $courseStudents[$groupName][$sid] = true;
    }
    foreach ($byCourse as $gn => &$bc) {
        $bc['students'] = isset($courseStudents[$gn]) ? count($courseStudents[$gn]) : 0;
    }
    unset($bc);

    // Sắp xếp detail theo tên
    usort($detailList, fn($a, $b) => strcmp($a['studentName'], $b['studentName']));

    jsonResponse([
        'agency' => sanitizeAgency($agency),
        'report' => [
            'totalStudents' => count($myStudents),
            'discountPercent' => $agencyDiscountPercent,
            // Tổng thu (học viên nộp cho đại lý)
            'totalBaseAmount' => $totalBaseAmount,         // Giá gốc SMC
            'totalActualAmount' => $totalActualAmount,      // Giá sau CK (HV nộp cho ĐL)
            'totalDiscount' => $totalDiscount,              // Tổng chiết khấu ĐL được hưởng
            // Đã thu / Chưa thu từ học viên
            'totalPaid' => $totalPaid,
            'totalUnpaid' => $totalUnpaid,
            'collectionRate' => $totalBaseAmount > 0 ? round($totalPaid / $totalBaseAmount * 100, 1) : 0,
            // Phải nộp cho SMC (sau chiết khấu) — thông tin tham khảo
            'totalOweToSmc' => $totalOweToSmc,
            'smcCollectionRate' => $totalBaseAmount > 0 ? round($totalOweToSmc / $totalBaseAmount * 100, 1) : 0,
            // Stats
            'paidCount' => $paidCount,
            'unpaidCount' => $unpaidCount,
            // Phân theo hạng thi
            'byCourse' => $byCourse,
            // Chi tiết từng học viên
            'details' => $detailList,
        ],
    ]);
}

// =====================================================================
// FALLBACK: route không tồn tại
// =====================================================================
jsonResponse(['error' => 'Route not found: ' . $path], 404);

// Removed parseCsvStringAgency — now using parseCsvStringGeneric from helpers.php
