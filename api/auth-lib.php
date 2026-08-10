<?php
// OPcache refresh: 1786170190

/**
 * SMC Training — Shared Authentication Library
 *
 * File duy nhất xử lý: token, JWT, cookie, auth, role check
 * TẤT CẢ các backend (auth.php, tuition-service.php, smc-db.php, agency.php)
 * đều require file này — không tự implement auth nữa.
 *
 * Hỗ trợ cả token 2-part (legacy) và 3-part (JWT chuẩn)
 *
 * Cách dùng:
 *   require_once __DIR__ . '/auth-lib.php';
 *   $auth = alRequireRole(['ADMIN', 'STAFF']);
 */

// ──── Load Secret Key (1 lần duy nhất) ────
$_alEnvFile = __DIR__ . '/env.php';
$_alEnv = [];
if (file_exists($_alEnvFile)) {
    $cfg = include $_alEnvFile;
    if (is_array($cfg)) $_alEnv = $cfg;
}
define('AL_SECRET_KEY', $_alEnv['SECRET_KEY'] ?? getenv('SMC_SECRET_KEY') ?: '');

// KHÔNG fallback key cứng — nếu không có SECRET_KEY thì crash
if (empty(AL_SECRET_KEY)) {
    error_log('[AUTH-LIB] CRITICAL: SECRET_KEY not configured.');
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error: SECRET_KEY not set']);
    exit;
}

// ──── Token Helpers ────

/** Đọc token từ HttpOnly cookie (ưu tiên) hoặc Authorization header */
function alGetToken() {
    if (!empty($_COOKIE['smc_token'])) {
        return $_COOKIE['smc_token'];
    }
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    return str_replace('Bearer ', '', $header);
}

/** Set HttpOnly cookie chứa JWT token — SameSite=Lax hỗ trợ email links */
function alSetTokenCookie($token) {
    setcookie('smc_token', $token, [
        'expires'  => time() + 86400,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Xóa token cookie (logout) */
function alClearTokenCookie() {
    setcookie('smc_token', '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'domain'   => '',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

// ──── JWT Helpers ────

/**
 * Tạo JWT token (HMAC-SHA256)
 */
function alCreateToken($user) {
    $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = [
        'sub'   => $user['id'],
        'email' => $user['email'] ?? '',
        'role'  => $user['role'] ?? '',
        'iat'   => time(),
        'exp'   => time() + 86400,
    ];

    $b64h = rtrim(strtr(base64_encode(json_encode($header)), '+/', '-_'), '=');
    $b64p = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');

    $signingInput = $b64h . '.' . $b64p;
    $signature    = hash_hmac('sha256', $signingInput, AL_SECRET_KEY, true);
    $b64s         = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

    return $b64h . '.' . $b64p . '.' . $b64s;
}

/**
 * Verify JWT token. Hỗ trợ cả 2 định dạng:
 *   - 3-part JWT chuẩn (header.payload.signature)
 *   - 2-part legacy (payload.signature)
 *
 * @return array|null  ['id'=>..., 'email'=>..., 'role'=>...] hoặc null
 */
function alVerifyToken($token) {
    $parts = explode('.', $token);

    // ── Legacy 2-part token ──
    if (count($parts) === 2) {
        list($b64, $sig) = $parts;
        if (!hash_equals(hash_hmac('sha256', $b64, AL_SECRET_KEY), $sig)) return null;
        $payload = json_decode(base64_decode($b64), true);
        if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
        return [
            'id'    => $payload['sub'] ?? $payload['id'] ?? '',
            'email' => $payload['email'] ?? '',
            'role'  => $payload['role'] ?? '',
        ];
    }

    // ── Standard 3-part JWT ──
    if (count($parts) !== 3) return null;

    list($headerB64, $payloadB64, $sigB64) = $parts;

    $signingInput = $headerB64 . '.' . $payloadB64;
    $sigDecoded   = base64_decode(strtr($sigB64, '-_', '+/'));
    if ($sigDecoded === false) return null;

    $expected = hash_hmac('sha256', $signingInput, AL_SECRET_KEY, true);
    if (!hash_equals($expected, $sigDecoded)) return null;

    $payloadJson = base64_decode(strtr($payloadB64, '-_', '+/'));
    if ($payloadJson === false) return null;
    $payload = json_decode($payloadJson, true);
    if (!$payload) return null;

    $exp = $payload['exp'] ?? 0;
    if ($exp > 0 && $exp < time()) return null;

    return [
        'id'    => $payload['sub'] ?? $payload['id'] ?? '',
        'email' => $payload['email'] ?? '',
        'role'  => $payload['role'] ?? '',
    ];
}

// ──── Auth Middleware ────

/** Xác thực request hiện tại. Trả về user info hoặc null. */
function alAuthenticate() {
    $token = alGetToken();
    if (!$token) return null;
    return alVerifyToken($token);
}

/**
 * Yêu cầu role cụ thể. Nếu không có quyền → JSON lỗi và exit.
 * Hỗ trợ cả 'ADMIN' và 'admin'.
 */
function alRequireRole($allowedRoles) {
    $auth = alAuthenticate();
    if (!$auth) alJsonResponse(['error' => 'Unauthorized'], 401);

    $currentRole = $auth['role'] ?? '';
    $normalizedCurrent = strtolower($currentRole);
    $normalizedAllowed = array_map('strtolower', $allowedRoles);

    if (!in_array($normalizedCurrent, $normalizedAllowed) && !in_array($currentRole, $allowedRoles)) {
        alJsonResponse(['error' => 'Forbidden'], 403);
    }
    return $auth;
}

// ──── Response Helpers ────

function alJsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function alJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

// ──── IP Helper ────

function alGetClientIP() {
    $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'];
    foreach ($headers as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = trim(explode(',', $_SERVER[$h])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '127.0.0.1';
}

// ──── Rate Limiting (file-based) ────

/**
 * Rate limiter dùng chung cho tất cả backend.
 */
function alRateLimit($key, $maxRequests, $windowSeconds, $errorMessage) {
    // Dùng shared file duy nhất per key hash prefix (2 ký tự đầu)
    // để giảm số lượng file, tránh race condition khi nhiều user truy cập cùng lúc.
    // Mỗi shared file chứa nhiều key, not just 1.
    $rateDir = __DIR__ . '/data/ratelimit';
    if (!is_dir($rateDir)) {
        mkdir($rateDir, 0750, true);
    }

    $keyHash = md5($key);
    // Gom nhóm: 256 file thay vì hàng ngàn file riêng lẻ
    $bucket = substr($keyHash, 0, 2);
    $file = $rateDir . '/bucket_' . $bucket . '.json';
    $now = time();

    // Đọc shared bucket với exclusive lock
    $fp = @fopen($file, 'c+');
    if (!$fp) {
        // Fallback: tạo file mới nếu không mở được
        $fp = @fopen($file, 'w+');
        if (!$fp) {
            // Không thể tạo file → bỏ qua rate limit
            error_log("[SMC] Rate limit bucket $bucket inaccessible, skipping");
            return 0;
        }
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        error_log("[SMC] Rate limit lock failed for bucket $bucket");
        return 0;
    }

    $content = '';
    while (!feof($fp)) { $content .= fread($fp, 8192); }
    $bucket_data = json_decode($content, true) ?: [];

    // Lấy entry của key cụ thể
    $entry = $bucket_data[$keyHash] ?? ['hits' => [], 'blocked_until' => 0];

    // Cleanup hits cũ
    $entry['hits'] = array_values(array_filter(
        $entry['hits'],
        function($t) use ($now, $windowSeconds) {
            return $t > ($now - $windowSeconds);
        }
    ));

    // Kiểm tra blocked
    if (($entry['blocked_until'] ?? 0) > $now) {
        flock($fp, LOCK_UN);
        fclose($fp);
        alJsonResponse([
            'error' => $errorMessage . '. Vui lòng thử lại sau ' . ($entry['blocked_until'] - $now) . ' giây.'
        ], 429);
    }

    $entry['hits'][] = $now;
    $hitCount = count($entry['hits']);

    if ($hitCount > $maxRequests) {
        $entry['blocked_until'] = $now + $windowSeconds; // Block 1 window, không phải 2x
        $bucket_data[$keyHash] = $entry;

        // Write
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($bucket_data));
        flock($fp, LOCK_UN);
        fclose($fp);

        alJsonResponse([
            'error' => $errorMessage . '. Vui lòng thử lại sau ' . $windowSeconds . ' giây.'
        ], 429);
    }

    $bucket_data[$keyHash] = $entry;

    // Định kỳ cleanup: xóa entries quá hạn (> 1 giờ)
    if (rand(1, 100) <= 5) { // 5% chance mỗi request
        $bucket_data = array_filter($bucket_data, function($e) use ($now) {
            $lastHit = !empty($e['hits']) ? max($e['hits']) : 0;
            return ($now - $lastHit) < 3600;
        });
    }

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($bucket_data));
    flock($fp, LOCK_UN);
    fclose($fp);

    return $hitCount;
}
