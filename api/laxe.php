<?php
/**
 * SMC Training — Lái xe API (MySQL Backend)
 * Endpoint: /api/laxe.php
 * Quản lý đăng ký đào tạo sát hạch lái xe hạng A1 & A — tách biệt hoàn toàn với UAV.
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

function jsonResponse($data, $code = 200) { alJsonResponse($data, $code); }
function jsonInput() { return alJsonInput(); }
function getClientIP() { return alGetClientIP(); }
function rateLimit($key, $max, $window, $msg) { return alRateLimit($key, $max, $window, $msg); }

$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';
if (empty($path)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = strtok($uri, '?');
    if (preg_match('#^/api/laxe(?:\.php)?/?(.*)$#', $uri, $m)) $path = trim($m[1], '/');
}
$parts = array_values(array_filter(explode('/', $path)));
$action = $parts[0] ?? '';

$VALID_STATUS = ['new', 'contacted', 'enrolled', 'cancelled'];
$VALID_LICENSE = ['A1', 'A'];

// ──── REGISTER (công khai) ────
if ($action === 'register') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    rateLimit('laxe_reg_ip:' . getClientIP(), 10, 3600, 'Bạn gửi quá nhiều lần, vui lòng thử lại sau.');

    $input = jsonInput();
    $fullName = trim($input['fullName'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');
    $license = strtoupper(trim($input['licenseType'] ?? ''));

    if ($fullName === '' || $phone === '') jsonResponse(['error' => 'Vui lòng nhập họ tên và số điện thoại'], 400);
    if (!in_array($license, $VALID_LICENSE, true)) jsonResponse(['error' => 'Hạng bằng không hợp lệ'], 400);

    $id = DB::insert(
        "INSERT INTO laxe_registrations (full_name, phone, email, license_type) VALUES (?,?,?,?)",
        [$fullName, $phone, $email, $license]
    );

    jsonResponse(['success' => true, 'id' => $id], 201);
}

// ──── LIST (quản trị) ────
if ($action === 'list' || $action === '') {
    if ($method !== 'GET') jsonResponse(['error' => 'GET required'], 405);
    alRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);

    $sql = "SELECT * FROM laxe_registrations";
    $where = [];
    $params = [];

    $status = $_GET['status'] ?? '';
    if ($status !== '' && in_array($status, $VALID_STATUS, true)) {
        $where[] = "status = ?";
        $params[] = $status;
    }
    $license = $_GET['license'] ?? '';
    if ($license !== '' && in_array(strtoupper($license), $VALID_LICENSE, true)) {
        $where[] = "license_type = ?";
        $params[] = strtoupper($license);
    }

    if ($where) $sql .= " WHERE " . implode(' AND ', $where);
    $sql .= " ORDER BY created_at DESC, id DESC";

    $rows = DB::select($sql, $params);
    $out = array_map(function ($r) {
        return [
            'id' => (string)$r['id'],
            'fullName' => $r['full_name'],
            'phone' => $r['phone'],
            'email' => $r['email'] ?? '',
            'licenseType' => $r['license_type'],
            'status' => $r['status'],
            'note' => $r['note'] ?? '',
            'createdAt' => $r['created_at'],
            'updatedAt' => $r['updated_at'],
        ];
    }, $rows);
    jsonResponse($out);
}

// ──── UPDATE (quản trị) ────
if ($action === 'update') {
    if (!in_array($method, ['PUT', 'POST'], true)) jsonResponse(['error' => 'PUT required'], 405);
    alRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);

    $input = jsonInput();
    $id = (int)($parts[1] ?? $input['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Thiếu id'], 400);

    $row = DB::selectOne("SELECT * FROM laxe_registrations WHERE id = ?", [$id]);
    if (!$row) jsonResponse(['error' => 'Không tìm thấy đăng ký'], 404);

    $status = $input['status'] ?? $row['status'];
    if (!in_array($status, $VALID_STATUS, true)) jsonResponse(['error' => 'Trạng thái không hợp lệ'], 400);
    $note = array_key_exists('note', $input) ? $input['note'] : $row['note'];

    DB::execute("UPDATE laxe_registrations SET status = ?, note = ? WHERE id = ?", [$status, $note, $id]);
    jsonResponse(['success' => true]);
}

// ──── DELETE (quản trị) ────
if ($action === 'delete') {
    $auth = alRequireRole(['ADMIN', 'admin']);
    $id = (int)($parts[1] ?? $_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Thiếu id'], 400);
    DB::execute("DELETE FROM laxe_registrations WHERE id = ?", [$id]);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Unknown action'], 404);
