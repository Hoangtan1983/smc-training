<?php
/**
 * SMC Training — Posts API v6 (MySQL Backend)
 * Endpoint: /api/posts.php
 * Quản lý bài viết / tin tức / sự kiện / trang tĩnh cho trang web.
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

// ──── Helpers ────

/** Vệ sinh HTML người dùng soạn: chỉ giữ thẻ an toàn + gỡ thuộc tính nguy hiểm. */
function sanitizeHtml($html) {
    $html = (string)$html;
    $html = strip_tags($html, '<p><br><b><strong><i><em><u><h2><h3><h4><ul><ol><li><a><img><figure><figcaption><blockquote><pre><code><table><thead><tbody><tr><th><td>');
    // Loại bỏ mọi thuộc tính on* (onclick, onerror...) và các scheme javascript:
    $html = preg_replace('/\son\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);
    $html = preg_replace('/(href|src)\s*=\s*(["\']?)\s*javascript:[^"\'>\s]*\2/i', '$1=""', $html);
    // Chỉ cho phép src ảnh nội bộ (từ kho upload của hệ thống) hoặc cùng tên miền
    $html = preg_replace_callback('/<img\b[^>]*>/i', function ($m) {
        $tag = $m[0];
        if (preg_match('/\bsrc\s*=\s*"([^"]*)"/i', $tag, $s)) {
            $src = $s[1];
            $ok = (strpos($src, '/api/auth.php?action=file') === 0)
                || (strpos($src, 'https://smc-training.com/') === 0)
                || (strpos($src, 'https://www.smc-training.com/') === 0);
            if (!$ok) return '';
        }
        return $tag;
    }, $html);
    return trim($html);
}

/** Tạo slug thân thiện từ tiếng Việt (bỏ dấu). */
function slugify($text) {
    $text = (string)$text;
    $map = [
        'à'=>'a','á'=>'a','ả'=>'a','ã'=>'a','ạ'=>'a','ă'=>'a','ằ'=>'a','ắ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a','â'=>'a','ầ'=>'a','ấ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a',
        'è'=>'e','é'=>'e','ẻ'=>'e','ẽ'=>'e','ẹ'=>'e','ê'=>'e','ề'=>'e','ế'=>'e','ể'=>'e','ễ'=>'e','ệ'=>'e',
        'ì'=>'i','í'=>'i','ỉ'=>'i','ĩ'=>'i','ị'=>'i',
        'ò'=>'o','ó'=>'o','ỏ'=>'o','õ'=>'o','ọ'=>'o','ô'=>'o','ồ'=>'o','ố'=>'o','ổ'=>'o','ỗ'=>'o','ộ'=>'o','ơ'=>'o','ờ'=>'o','ớ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o',
        'ù'=>'u','ú'=>'u','ủ'=>'u','ũ'=>'u','ụ'=>'u','ư'=>'u','ừ'=>'u','ứ'=>'u','ử'=>'u','ữ'=>'u','ự'=>'u',
        'ỳ'=>'y','ý'=>'y','ỷ'=>'y','ỹ'=>'y','ỵ'=>'y','đ'=>'d',
        'À'=>'a','Á'=>'a','Ả'=>'a','Ã'=>'a','Ạ'=>'a','Ă'=>'a','Ằ'=>'a','Ắ'=>'a','Ẳ'=>'a','Ẵ'=>'a','Ặ'=>'a','Â'=>'a','Ầ'=>'a','Ấ'=>'a','Ẩ'=>'a','Ẫ'=>'a','Ậ'=>'a',
        'È'=>'e','É'=>'e','Ẻ'=>'e','Ẽ'=>'e','Ẹ'=>'e','Ê'=>'e','Ề'=>'e','Ế'=>'e','Ể'=>'e','Ễ'=>'e','Ệ'=>'e',
        'Ì'=>'i','Í'=>'i','Ỉ'=>'i','Ĩ'=>'i','Ị'=>'i',
        'Ò'=>'o','Ó'=>'o','Ỏ'=>'o','Õ'=>'o','Ọ'=>'o','Ô'=>'o','Ồ'=>'o','Ố'=>'o','Ổ'=>'o','Ỗ'=>'o','Ộ'=>'o','Ơ'=>'o','Ờ'=>'o','Ớ'=>'o','Ở'=>'o','Ỡ'=>'o','Ợ'=>'o',
        'Ù'=>'u','Ú'=>'u','Ủ'=>'u','Ũ'=>'u','Ụ'=>'u','Ư'=>'u','Ừ'=>'u','Ứ'=>'u','Ử'=>'u','Ữ'=>'u','Ự'=>'u',
        'Ỳ'=>'y','Ý'=>'y','Ỷ'=>'y','Ỹ'=>'y','Ỵ'=>'y','Đ'=>'d',
    ];
    $text = strtr($text, $map);
    $text = preg_replace('/[^a-zA-Z0-9]+/', '-', $text);
    $text = trim($text, '-');
    return strtolower($text) ?: ('post-' . time());
}

/** Ánh xạ bản ghi posts (snake_case) sang camelCase cho frontend. */
function mapPost($row) {
    if (!$row) return $row;
    return [
        'id' => (string)$row['id'],
        'type' => $row['type'] ?? 'article',
        'pageKey' => $row['page_key'] ?? null,
        'title' => $row['title'] ?? '',
        'slug' => $row['slug'] ?? '',
        'excerpt' => $row['excerpt'] ?? '',
        'content' => $row['content'] ?? '',
        'coverImage' => $row['cover_image'] ?? null,
        'status' => $row['status'] ?? 'draft',
        'eventDate' => $row['event_date'] ?? null,
        'authorId' => $row['author_id'] ?? null,
        'authorName' => $row['author_name'] ?? '',
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}

function isEditor($auth) {
    $role = strtolower($auth['role'] ?? '');
    return in_array($role, ['admin', 'staff'], true);
}

// ──── Routing ────
$method = $_SERVER['REQUEST_METHOD'];
$path = $_GET['action'] ?? '';
if (empty($path)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = strtok($uri, '?');
    if (preg_match('#^/api/posts(?:\.php)?/?(.*)$#', $uri, $m)) $path = trim($m[1], '/');
}
$parts = array_values(array_filter(explode('/', $path)));
$action = $parts[0] ?? 'list';
$auth = alAuthenticate();

// ──── LIST ────
if ($action === 'list' || $action === '') {
    $type = $_GET['type'] ?? '';
    $pageKey = $_GET['page_key'] ?? '';

    $sql = "SELECT * FROM posts";
    $where = [];
    $params = [];

    if ($pageKey !== '') {
        $where[] = "page_key = ?";
        $params[] = $pageKey;
    }
    if ($type !== '' && in_array($type, ['article', 'event', 'page'], true)) {
        $where[] = "type = ?";
        $params[] = $type;
    }

    if (!isEditor($auth)) {
        $where[] = "status = 'published'";
    }

    if ($where) $sql .= " WHERE " . implode(' AND ', $where);
    $sql .= " ORDER BY COALESCE(event_date, created_at) DESC, created_at DESC";

    $rows = DB::select($sql, $params);
    jsonResponse(array_map('mapPost', $rows));
}

// ──── DETAIL (theo slug hoặc id) ────
if ($action === 'detail') {
    $key = $parts[1] ?? $_GET['id'] ?? $_GET['slug'] ?? '';
    if (is_numeric($key)) {
        $row = DB::selectOne("SELECT * FROM posts WHERE id = ?", [(int)$key]);
    } else {
        $row = DB::selectOne("SELECT * FROM posts WHERE slug = ?", [$key]);
    }
    if (!$row) jsonResponse(['error' => 'Không tìm thấy bài viết'], 404);
    if ($row['status'] !== 'published' && !isEditor($auth)) jsonResponse(['error' => 'Không có quyền xem bài viết'], 403);
    jsonResponse(mapPost($row));
}

// ──── CREATE ────
if ($action === 'create') {
    if ($method !== 'POST') jsonResponse(['error' => 'POST required'], 405);
    $auth = alRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    $input = jsonInput();

    $title = trim($input['title'] ?? '');
    if ($title === '') jsonResponse(['error' => 'Thiếu tiêu đề'], 400);

    $type = in_array($input['type'] ?? '', ['article', 'event', 'page'], true) ? $input['type'] : 'article';
    $slug = slugify($input['slug'] ?? $title);
    $status = ($input['status'] ?? 'draft') === 'published' ? 'published' : 'draft';
    $eventDate = ($input['eventDate'] ?? null) ?: null;
    $pageKey = ($input['pageKey'] ?? null) ?: null;

    $authorName = '';
    $authorId = is_numeric($auth['id'] ?? null) ? (int)$auth['id'] : null;
    if ($authorId) {
        $u = DB::selectOne("SELECT full_name FROM users WHERE id = ?", [$authorId]);
        $authorName = $u['full_name'] ?? '';
    }

    $id = DB::insert(
        "INSERT INTO posts (type, page_key, title, slug, excerpt, content, cover_image, status, event_date, author_id, author_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [$type, $pageKey, $title, $slug, $input['excerpt'] ?? '', sanitizeHtml($input['content'] ?? ''),
         $input['coverImage'] ?? null, $status, $eventDate, $authorId, $authorName]
    );

    jsonResponse(['success' => true, 'post' => mapPost(DB::selectOne("SELECT * FROM posts WHERE id = ?", [(int)$id]))], 201);
}

// ──── UPDATE ────
if ($action === 'update') {
    if (!in_array($method, ['PUT', 'POST'], true)) jsonResponse(['error' => 'PUT required'], 405);
    $auth = alRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    $input = jsonInput();
    $id = (int)($parts[1] ?? $input['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Thiếu id'], 400);

    $row = DB::selectOne("SELECT * FROM posts WHERE id = ?", [$id]);
    if (!$row) jsonResponse(['error' => 'Không tìm thấy bài viết'], 404);

    $title = $input['title'] ?? $row['title'];
    $slug  = isset($input['slug']) ? slugify($input['slug']) : $row['slug'];
    $type  = in_array($input['type'] ?? '', ['article', 'event', 'page'], true) ? $input['type'] : $row['type'];
    $status = ($input['status'] ?? $row['status']) === 'published' ? 'published' : 'draft';
    $content = array_key_exists('content', $input) ? sanitizeHtml($input['content'] ?? '') : $row['content'];
    $excerpt = $input['excerpt'] ?? $row['excerpt'];
    $coverImage = $input['coverImage'] ?? $row['cover_image'];
    $eventDate = array_key_exists('eventDate', $input) ? ($input['eventDate'] ?: null) : $row['event_date'];
    $pageKey = array_key_exists('pageKey', $input) ? ($input['pageKey'] ?: null) : $row['page_key'];

    DB::execute(
        "UPDATE posts SET title=?, slug=?, type=?, status=?, content=?, excerpt=?, cover_image=?, event_date=?, page_key=? WHERE id=?",
        [$title, $slug, $type, $status, $content, $excerpt, $coverImage, $eventDate, $pageKey, $id]
    );

    jsonResponse(['success' => true, 'post' => mapPost(DB::selectOne("SELECT * FROM posts WHERE id = ?", [$id]))]);
}

// ──── DELETE ────
if ($action === 'delete') {
    $auth = alRequireRole(['ADMIN', 'STAFF', 'admin', 'staff']);
    $id = (int)($parts[1] ?? $_GET['id'] ?? 0);
    if (!$id) jsonResponse(['error' => 'Thiếu id'], 400);
    DB::execute("DELETE FROM posts WHERE id = ?", [$id]);
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Unknown action'], 404);
