<?php
/**
 * SMC Training — Shared Helpers
 * Dùng chung cho auth.php, tuitions.php, import.php, backup.php, setup-db.php
 * Include: require_once __DIR__ . '/helpers.php';
 */

// ── Timezone ──
date_default_timezone_set('Asia/Ho_Chi_Minh');

// ── CORS Headers ──
function smcCorsHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: https://smc-training.com');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ── Token helpers ──
function getTokenFromRequest() {
    if (!empty($_COOKIE['smc_token'])) {
        return $_COOKIE['smc_token'];
    }
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    return str_replace('Bearer ', '', $header);
}

function jsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function genId($prefix = 'u-') {
    return $prefix . bin2hex(random_bytes(8));
}

// ── Data Store (file-based) ──
function smcDataDir() {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    return $dir;
}

$smcDataCache = [];
$smcCacheTime = [];

function loadData($file, $ttl = 5) {
    global $smcDataCache, $smcCacheTime;
    $dataDir = smcDataDir();
    $now = microtime(true);

    if (isset($smcDataCache[$file]) && ($now - ($smcCacheTime[$file] ?? 0)) < $ttl) {
        return $smcDataCache[$file];
    }

    $path = $dataDir . '/' . $file . '.json';
    if (!file_exists($path)) {
        $smcDataCache[$file] = [];
        $smcCacheTime[$file] = $now;
        return [];
    }
    $data = json_decode(file_get_contents($path), true) ?: [];
    $smcDataCache[$file] = $data;
    $smcCacheTime[$file] = $now;
    return $data;
}

function saveData($file, $data) {
    global $smcDataCache, $smcCacheTime;
    $dataDir = smcDataDir();
    $path = $dataDir . '/' . $file . '.json';
    $now = microtime(true);

    // ── AUTO-BACKUP: giữ 5 bản backup gần nhất trước khi ghi đè ──
    $criticalFiles = ['users', 'invoices', 'transactions', 'enrollments', 'tuitions',
                       'agencies', 'agency_commissions', 'courses', 'classes',
                       'change_requests', 'registrations', 'payment_receipts'];
    if (in_array($file, $criticalFiles) && file_exists($path)) {
        $backupDir = $dataDir . '/auto_backups';
        if (!is_dir($backupDir)) mkdir($backupDir, 0750, true);
        $backupName = $file . '_' . date('Ymd_His') . '.json';
        $backupPath = $backupDir . '/' . $backupName;
        $fileSize = filesize($path);
        if ($fileSize < 5 * 1024 * 1024) {
            @copy($path, $backupPath);
            $existingBackups = glob($backupDir . '/' . $file . '_*.json');
            if ($existingBackups && count($existingBackups) > 5) {
                usort($existingBackups, function($a, $b) { return filemtime($b) - filemtime($a); });
                foreach (array_slice($existingBackups, 5) as $old) @unlink($old);
            }
        }
    }

    $tmp = $path . '.tmp.' . getmypid();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false) {
        error_log("[SMC] JSON encode failed for {$file}: " . json_last_error_msg());
        return false;
    }
    $written = file_put_contents($tmp, $json, LOCK_EX);
    if ($written === false) {
        error_log("[SMC] file_put_contents failed for {$tmp}. Dir writable? " . (is_writable($dataDir) ? 'yes' : 'no'));
        return false;
    }
    if (!rename($tmp, $path)) {
        error_log("[SMC] rename failed: {$tmp} → {$path}");
        @unlink($tmp);
        return false;
    }
    $smcDataCache[$file] = $data;
    $smcCacheTime[$file] = $now;
    return true;
}

// ── Auth ──
function smcSecretKey() {
    $envFile = __DIR__ . '/env.php';
    $env = [];
    if (file_exists($envFile)) {
        $env = (include $envFile);
        if (!is_array($env)) $env = [];
    }
    $key = $env['SECRET_KEY'] ?? getenv('SMC_SECRET_KEY');
    if (empty($key)) {
        http_response_code(500);
        echo json_encode(['error' => 'Server configuration error: SECRET_KEY not set']);
        exit;
    }
    return $key;
}

// ── JWT Helper (base64url encode/decode) ──
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function createToken($user) {
    $secretKey = smcSecretKey();
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = [
        'sub' => $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + 86400,
    ];
    $segments = [];
    $segments[] = base64url_encode(json_encode($header, JSON_UNESCAPED_UNICODE));
    $segments[] = base64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $signingInput = implode('.', $segments);
    $signature = hash_hmac('sha256', $signingInput, $secretKey, true);
    $segments[] = base64url_encode($signature);
    return implode('.', $segments);
}

function verifyToken($token) {
    $secretKey = smcSecretKey();
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        // Fallback: thử định dạng token cũ (2 phần) để tương thích ngược
        if (count($parts) === 2) {
            return verifyLegacyToken($token, $secretKey);
        }
        return null;
    }
    list($headerB64, $payloadB64, $sigB64) = $parts;
    $signingInput = $headerB64 . '.' . $payloadB64;
    $signature = base64url_decode($sigB64);
    if ($signature === false) return null;
    $expected = hash_hmac('sha256', $signingInput, $secretKey, true);
    if (!hash_equals($expected, $signature)) return null;
    $payload = json_decode(base64url_decode($payloadB64), true);
    if (!$payload) return null;
    // Kiểm tra hết hạn: tương thích cả 'exp' (JWT chuẩn) và payload cũ
    $exp = $payload['exp'] ?? 0;
    if ($exp > 0 && $exp < time()) return null;
    return [
        'id' => $payload['sub'] ?? $payload['id'] ?? '',
        'email' => $payload['email'] ?? '',
        'role' => $payload['role'] ?? '',
    ];
}

// Tương thích ngược với token định dạng cũ (2 phần: base64_payload.hmac)
function verifyLegacyToken($token, $secretKey) {
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;
    list($b64, $sig) = $parts;
    if (!hash_equals(hash_hmac('sha256', $b64, $secretKey), $sig)) return null;
    $payload = json_decode(base64_decode($b64), true);
    if (!$payload || ($payload['exp'] ?? 0) < time()) return null;
    return $payload;
}

function authenticate() {
    $token = getTokenFromRequest();
    if (!$token) return null;
    return verifyToken($token);
}

function requireRole($allowedRoles) {
    $auth = authenticate();
    if (!$auth) jsonResponse(['error' => 'Unauthorized - Vui lòng đăng nhập'], 401);
    if (!in_array($auth['role'], $allowedRoles)) jsonResponse(['error' => 'Forbidden'], 403);
    return $auth;
}

// ── Rate Limiting ──
function rateLimit($key, $maxRequests, $windowSeconds, $errorMessage) {
    // Dùng shared bucket file (giống auth-lib.php)
    $rateDir = __DIR__ . '/data/ratelimit';
    if (!is_dir($rateDir)) {
        mkdir($rateDir, 0777, true);
    }
    $keyHash = md5($key);
    $bucket = substr($keyHash, 0, 2);
    $file = $rateDir . '/bucket_' . $bucket . '.json';
    $now = time();

    $fp = @fopen($file, 'c+');
    if (!$fp) { $fp = @fopen($file, 'w+'); }
    if (!$fp) { error_log("[SMC] Rate limit bucket $bucket inaccessible"); return 0; }
    if (!flock($fp, LOCK_EX)) { fclose($fp); return 0; }

    $content = '';
    while (!feof($fp)) { $content .= fread($fp, 8192); }
    $bucket_data = json_decode($content, true) ?: [];
    $entry = $bucket_data[$keyHash] ?? ['hits' => [], 'blocked_until' => 0];

    $entry['hits'] = array_values(array_filter($entry['hits'] ?? [], function($t) use ($now, $windowSeconds) {
        return $t > ($now - $windowSeconds);
    }));

    if (($entry['blocked_until'] ?? 0) > $now) {
        flock($fp, LOCK_UN); fclose($fp);
        jsonResponse(['error' => $errorMessage . '. Vui lòng thử lại sau ' . ($entry['blocked_until'] - $now) . ' giây.'], 429);
    }

    $entry['hits'][] = $now;
    if (count($entry['hits']) > $maxRequests) {
        $entry['blocked_until'] = $now + $windowSeconds;
        $bucket_data[$keyHash] = $entry;
        ftruncate($fp, 0); rewind($fp);
        fwrite($fp, json_encode($bucket_data));
        flock($fp, LOCK_UN); fclose($fp);
        jsonResponse(['error' => $errorMessage . '. Vui lòng thử lại sau ' . $windowSeconds . ' giây.'], 429);
    }

    $bucket_data[$keyHash] = $entry;

    if (rand(1, 100) <= 5) {
        $bucket_data = array_filter($bucket_data, function($e) use ($now) {
            $lastHit = !empty($e['hits']) ? max($e['hits']) : 0;
            return ($now - $lastHit) < 3600;
        });
    }

    ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($bucket_data));
    flock($fp, LOCK_UN); fclose($fp);
    return count($entry['hits']);
}

function getClientIP() {
    $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'];
    foreach ($headers as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = trim(explode(',', $_SERVER[$h])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '127.0.0.1';
}

// ── User helpers ──
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
    // Normalize input: trim + Unicode NFC
    $email = trim($email);
    if (class_exists('Normalizer')) {
        $email = Normalizer::normalize($email, Normalizer::FORM_C);
    }

    // Normalize phone number: strip all non-digit chars, keep leading 0
    $emailDigits = preg_replace('/\D/', '', $email);
    $isPhoneInput = preg_match('/^\d{9,11}$/', $emailDigits);

    foreach ($users as $u) {
        if (($u['status'] ?? '') === 'REJECTED') continue;

        $uEmail = $u['email'] ?? '';
        if (class_exists('Normalizer')) {
            $uEmail = Normalizer::normalize($uEmail, Normalizer::FORM_C);
        }

        if (strtolower($uEmail) === strtolower($email)) return $u;

        // Phone comparison: normalize both sides (strip non-digits)
        if ($isPhoneInput) {
            $uPhoneDigits = preg_replace('/\D/', '', $u['phone'] ?? '');
            if ($uPhoneDigits && $uPhoneDigits === $emailDigits) return $u;
        } else {
            if (($u['phone'] ?? '') === $email) return $u;
        }
    }
    return null;
}

function findUserById($id) {
    $users = loadData('users');
    foreach ($users as $u) { if ($u['id'] === $id) return $u; }
    return null;
}

// ── Cookie helpers ──
function setTokenCookie($token) {
    setcookie('smc_token', $token, [
        'expires' => time() + 86400,
        'path' => '/',
        'domain' => '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function clearTokenCookie() {
    setcookie('smc_token', '', [
        'expires' => time() - 3600,
        'path' => '/',
        'domain' => '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

// ── Password Generator ──
// Sinh mật khẩu ngẫu nhiên an toàn, 12 ký tự gồm: chữ hoa, chữ thường, số, ký tự đặc biệt
// Tránh ký tự dễ nhầm (0/O, 1/l/I)
function generateSecurePassword($length = 12) {
    $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';       // Không có O
    $lower = 'abcdefghjkmnpqrstuvwxyz';         // Không có i, l, o
    $digits = '23456789';                        // Không có 0, 1
    $symbols = '!@#$%&*_-';
    $all = $upper . $lower . $digits . $symbols;

    // Đảm bảo có ít nhất 1 ký tự mỗi loại
    $pwd = $upper[random_int(0, strlen($upper) - 1)]
         . $lower[random_int(0, strlen($lower) - 1)]
         . $digits[random_int(0, strlen($digits) - 1)]
         . $symbols[random_int(0, strlen($symbols) - 1)];

    $max = strlen($all) - 1;
    for ($i = 4; $i < $length; $i++) {
        $pwd .= $all[random_int(0, $max)];
    }
    // Xáo trộn thứ tự
    return str_shuffle($pwd);
}

// ── XLSX Parser (dùng chung cho import.php và agency.php) ──
// Parse file .xlsx sử dụng ZipArchive + SimpleXML
// Trả về mảng các row dạng assoc array với header từ dòng đầu tiên
function parseXlsxFile($filePath) {
    if (!class_exists('ZipArchive')) {
        $text = @file_get_contents($filePath);
        if ($text) {
            return parseCsvStringGeneric($text);
        }
        return [];
    }

    $zip = new ZipArchive();
    if ($zip->open($filePath) !== true) {
        return [];
    }

    $sharedStrings = [];
    $ssContent = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssContent) {
        $ssXml = simplexml_load_string($ssContent);
        if ($ssXml) {
            $ns = $ssXml->getNamespaces(true)[''] ?? '';
            foreach ($ssXml->children($ns) as $si) {
                if ($si->getName() !== 'si') continue;
                $text = '';
                foreach ($si->children($ns) as $tNode) {
                    if ($tNode->getName() === 't') $text .= (string)$tNode;
                }
                $sharedStrings[] = $text;
            }
        }
    }

    $sheetContent = $zip->getFromName('xl/worksheets/sheet1.xml');
    if (!$sheetContent) {
        $zip->close();
        return [];
    }

    $sheetXml = simplexml_load_string($sheetContent);
    if (!$sheetXml) {
        $zip->close();
        return [];
    }

    $ns = $sheetXml->getNamespaces(true)[''] ?? '';
    $sheetData = $sheetXml->sheetData;
    if (!$sheetData) {
        $zip->close();
        return [];
    }

    $rows = [];
    $allHeaders = [];

    foreach ($sheetData->children($ns) as $rowEl) {
        if ($rowEl->getName() !== 'row') continue;

        $rowData = [];
        foreach ($rowEl->children($ns) as $cell) {
            if ($cell->getName() !== 'c') continue;

            $cellAttrs = [];
            foreach ($cell->attributes() as $a => $v) { $cellAttrs[$a] = (string)$v; }

            $cellRef = $cellAttrs['r'] ?? '';
            $colLetter = preg_replace('/[0-9]/', '', $cellRef);
            $colIndex = 0;
            $len = strlen($colLetter);
            for ($i = 0; $i < $len; $i++) {
                $colIndex = $colIndex * 26 + (ord($colLetter[$i]) - ord('A') + 1);
            }
            $colIndex -= 1;

            $cellType = $cellAttrs['t'] ?? '';
            $value = '';

            if ($cellType === 'inlineStr') {
                foreach ($cell->children($ns) as $is) {
                    if ($is->getName() === 'is') {
                        foreach ($is->children($ns) as $tn) {
                            if ($tn->getName() === 't') $value .= (string)$tn;
                        }
                    }
                }
            } elseif ($cellType === 's') {
                foreach ($cell->children($ns) as $vNode) {
                    if ($vNode->getName() === 'v') {
                        $idx = (int)(string)$vNode;
                        $value = $sharedStrings[$idx] ?? '';
                        break;
                    }
                }
            } else {
                foreach ($cell->children($ns) as $vNode) {
                    if ($vNode->getName() === 'v') {
                        $value = (string)$vNode;
                        break;
                    }
                }
            }

            $rowData[$colIndex] = $value;
        }

        $maxCol = !empty($rowData) ? max(array_keys($rowData)) : 0;
        for ($i = 0; $i <= $maxCol; $i++) {
            if (!isset($rowData[$i])) { $rowData[$i] = ''; }
        }
        ksort($rowData);

        if (empty($allHeaders)) {
            $allHeaders = $rowData;
        } else {
            $assoc = [];
            foreach ($allHeaders as $idx => $header) {
                $assoc[trim($header)] = isset($rowData[$idx]) ? trim($rowData[$idx]) : '';
            }
            if (count(array_filter($assoc, fn($v) => $v !== '')) > 0) {
                $rows[] = $assoc;
            }
        }
    }

    $zip->close();
    return $rows;
}

// Parse CSV string thành mảng assoc rows (dùng chung)
function parseCsvStringGeneric($text) {
    $lines = explode("\n", trim($text));
    if (count($lines) < 2) return [];

    $lines[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lines[0]);

    $headers = str_getcsv(array_shift($lines));
    $rows = [];

    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        $values = str_getcsv($line);
        if (count($values) < 1) continue;
        $row = [];
        foreach ($headers as $i => $h) {
            $row[trim($h)] = isset($values[$i]) ? trim($values[$i]) : '';
        }
        $rows[] = $row;
    }
    return $rows;
}
