<?php
/**
 * SMC Training — JSON → MySQL Full Sync Engine
 *
 * Đồng bộ TẤT CẢ 24 file JSON sang MySQL.
 * Chạy 1 lần duy nhất sau khi migrate.
 *
 * Usage:
 *   php sync-all-json-to-mysql.php              # dry-run
 *   php sync-all-json-to-mysql.php --sync       # thực hiện đồng bộ
 *   php sync-all-json-to-mysql.php --force      # xóa hết & sync lại
 *
 * Endpoint HTTP: /api/sync-all-json-to-mysql.php?token=CRON_TOKEN&mode=sync
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth-lib.php';

date_default_timezone_set('Asia/Ho_Chi_Minh');

$isCLI = (php_sapi_name() === 'cli');
$isHTTP = !$isCLI;

if ($isHTTP) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: https://smc-training.com');

    $envFile = __DIR__ . '/env.php';
    $env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];
    $cronToken = $env['CRON_TOKEN'] ?? getenv('SMC_CRON_TOKEN') ?: '';
    $providedToken = $_GET['token'] ?? '';

    if (empty($cronToken) || !hash_equals($cronToken, $providedToken)) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid token']);
        exit;
    }
}

$mode = 'dry-run';
if ($isCLI) {
    $mode = in_array('--sync', $argv ?? []) ? 'sync' : (in_array('--force', $argv ?? []) ? 'force' : 'dry-run');
} else {
    $mode = ($_GET['mode'] ?? '') === 'force' ? 'force' : (($_GET['mode'] ?? '') === 'sync' ? 'sync' : 'dry-run');
}

function log_msg(string $msg): void {
    global $isCLI;
    echo ($isCLI ? $msg . "\n" : '');
}

// ============================================================================
// DATA LOADER
// ============================================================================
function loadJson(string $file): array {
    $path = __DIR__ . '/data/' . $file . '.json';
    if (!file_exists($path)) return [];
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

// Nếu data là object dạng {"questions": [...]} hoặc {"users": [...]}
function loadJsonArray(string $file, string $key = ''): array {
    $data = loadJson($file);
    if (empty($key)) return $data;
    return $data[$key] ?? [];
}

// ============================================================================
// ID MAPPING: JSON string ID → MySQL BIGINT ID
// ============================================================================
$idMap = [
    'users' => [],       // "u-xxx" → BIGINT
    'courses' => [],     // "c-xxx" → BIGINT
    'enrollments' => [], // "enr-xxx" → BIGINT
    'classes' => [],     // "c-xxx" → BIGINT
    'agents' => [],      // "ag-xxx" → BIGINT
];

function mapId(string $type, string $jsonId): ?int {
    global $idMap;
    return $idMap[$type][$jsonId] ?? null;
}

function setMapId(string $type, string $jsonId, int $mysqlId): void {
    global $idMap;
    $idMap[$type][$jsonId] = $mysqlId;
}

// ============================================================================
// STATS
// ============================================================================
$stats = ['synced' => 0, 'skipped' => 0, 'errors' => 0, 'deleted' => 0];
$details = [];

function addStat(string $type, string $entity, int $count, string $detail = ''): void {
    global $stats, $details;
    $stats[$type] += $count;
    if ($detail) $details[] = "[$type] $entity: $detail";
}

// ============================================================================
// MAIN SYNC LOGIC
// ============================================================================

log_msg(str_repeat('=', 60));
log_msg('SMC Training — JSON → MySQL Full Sync');
log_msg('Mode: ' . strtoupper($mode));
log_msg('Time: ' . date('Y-m-d H:i:s'));
log_msg(str_repeat('=', 60));

if ($mode === 'force') {
    log_msg("\n🧹 Force mode: xóa dữ liệu cũ...");
    $tables = ['exam_results','attendance','fly_logs','certifications','change_requests',
               'email_log','uploaded_files','password_resets','question_bank',
               'exams','classes','payments','invoices','commission_details',
               'commission_payouts','payment_schedules','refunds','enrollments',
               'users','agents','courses'];
    DB::begin();
    try {
        foreach ($tables as $t) {
            try {
                $c = DB::execute("DELETE FROM `{$t}`");
                addStat('deleted', $t, $c);
            } catch (\Exception $e) {
                // Bảng có thể chưa tồn tại
            }
        }
        DB::commit();
        log_msg("   Đã xóa dữ liệu cũ.");
    } catch (\Exception $e) {
        DB::rollback();
        log_msg("   Lỗi: " . $e->getMessage());
    }
}

// ========================================================================
// 1. SYNC COURSES (phải sync trước vì các bảng khác FK đến courses)
// ========================================================================
log_msg("\n📚 [1/12] Syncing courses...");
$jsonCourses = loadJson('courses');
$syncedC = 0; $skippedC = 0;

foreach ($jsonCourses as $c) {
    $code = $c['code'] ?? $c['id'] ?? '';
    $name = $c['name'] ?? '';
    $price = (float)($c['price'] ?? 0);
    $jsonId = $c['id'] ?? '';

    if (empty($name)) { $skippedC++; continue; }

    $existing = DB::selectOne("SELECT id FROM courses WHERE code = ?", [$code]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            DB::execute("UPDATE courses SET name=?, tuition_fee=?, description=?, updated_at=NOW() WHERE id=?",
                [$name, $price, $c['description'] ?? '', $existing['id']]);
        }
        setMapId('courses', $jsonId, (int)$existing['id']);
        $syncedC++;
    } else {
        if ($mode !== 'dry-run') {
            $newId = (int)DB::insert(
                "INSERT INTO courses (code, name, tuition_fee, description, status) VALUES (?,?,?,?,'active')",
                [$code, $name, $price, $c['description'] ?? '']
            );
            setMapId('courses', $jsonId, $newId);
        }
        $syncedC++;
    }
}
addStat('synced', 'courses', $syncedC);
addStat('skipped', 'courses', $skippedC);
log_msg("   ✅ $syncedC synced, $skippedC skipped");

// ========================================================================
// 2. SYNC AGENTS (agencies → agents)
// ========================================================================
log_msg("\n🏢 [2/12] Syncing agencies → agents...");
$jsonAgencies = loadJson('agencies');
$syncedA = 0; $skippedA = 0;

foreach ($jsonAgencies as $a) {
    $code = $a['code'] ?? '';
    $name = $a['name'] ?? '';
    $jsonId = $a['id'] ?? '';
    $email = $a['email'] ?? '';

    if (empty($code) && empty($name)) { $skippedA++; continue; }

    $existing = DB::selectOne("SELECT id FROM agents WHERE agent_code = ? OR (email = ? AND email != '')",
        [$code, $email]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            DB::execute("UPDATE agents SET name=?, phone=?, email=?, address=?,
                commission_rate=?, updated_at=NOW() WHERE id=?",
                [$name, $a['phone'] ?? '', $email, $a['address'] ?? '',
                 (float)($a['discountPercent'] ?? 0), $existing['id']]);
        }
        setMapId('agents', $jsonId, (int)$existing['id']);
        $syncedA++;
    } else {
        if ($mode !== 'dry-run') {
            $newId = (int)DB::insert(
                "INSERT INTO agents (agent_code, name, phone, email, address, commission_rate, status) VALUES (?,?,?,?,?,?,'active')",
                [$code ?: ('AG-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6))),
                 $name, $a['phone'] ?? '', $email, $a['address'] ?? '',
                 (float)($a['discountPercent'] ?? 0)]
            );
            setMapId('agents', $jsonId, $newId);
        }
        $syncedA++;
    }
}
addStat('synced', 'agents', $syncedA);
addStat('skipped', 'agents', $skippedA);
log_msg("   ✅ $syncedA synced, $skippedA skipped");

// ========================================================================
// 3. SYNC USERS
// ========================================================================
log_msg("\n👥 [3/12] Syncing users...");
$jsonUsers = loadJson('users');
$syncedU = 0; $skippedU = 0;

// Admin mặc định nếu chưa có
$adminExists = DB::selectOne("SELECT id FROM users WHERE email = ? OR user_code = ?", ['admin@smc-training.com', 'ADMIN-001']);
if (!$adminExists && $mode !== 'dry-run') {
    DB::insert("INSERT INTO users (user_code, full_name, email, phone, role, status) VALUES ('ADMIN-001','Quản trị viên','admin@smc-training.com','0900000000','admin','active')");
}

foreach ($jsonUsers as $u) {
    $email = $u['email'] ?? '';
    $phone = $u['phone'] ?? $email;
    $fullName = $u['fullName'] ?? '';
    $jsonId = $u['id'] ?? '';
    $role = strtolower($u['role'] ?? 'student');
    $status = match(strtoupper($u['status'] ?? 'ACTIVE')) {
        'ACTIVE' => 'active', 'PENDING' => 'active', 'FROZEN' => 'frozen',
        'INACTIVE' => 'inactive', default => 'active'
    };
    $passwordHash = $u['password'] ?? null;

    if (empty($email) && empty($phone)) { $skippedU++; continue; }

    $existing = DB::selectOne("SELECT id FROM users WHERE email = ? OR phone = ?", [$email, $phone]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            DB::execute(
                "UPDATE users SET full_name=?, role=?, status=?, password_hash=COALESCE(?,password_hash), updated_at=NOW() WHERE id=?",
                [$fullName, $role, $status, $passwordHash, $existing['id']]
            );
        }
        setMapId('users', $jsonId, (int)$existing['id']);
        $syncedU++;
    } else {
        if ($mode !== 'dry-run') {
            $userCode = 'USR-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
            $newId = (int)DB::insert(
                "INSERT INTO users (user_code, full_name, email, phone, password_hash, role, status) VALUES (?,?,?,?,?,?,?)",
                [$userCode, $fullName, $email, $phone, $passwordHash, $role, $status]
            );
            setMapId('users', $jsonId, $newId);
        }
        $syncedU++;
    }
}
addStat('synced', 'users', $syncedU);
addStat('skipped', 'users', $skippedU);
log_msg("   ✅ $syncedU synced, $skippedU skipped");

// ========================================================================
// 4. SYNC ENROLLMENTS
// ========================================================================
log_msg("\n📝 [4/12] Syncing enrollments...");
$jsonEnrollments = loadJson('enrollments');
$syncedE = 0; $skippedE = 0;

foreach ($jsonEnrollments as $e) {
    $jsonStudentId = $e['student_id'] ?? '';
    $jsonCourseId = $e['course_id'] ?? '';
    $enrCode = $e['enrollment_code'] ?? ('ENR-' . date('Y') . '-' . rand(1000, 9999));

    $mysqlStudentId = mapId('users', $jsonStudentId);
    $mysqlCourseId = mapId('courses', $jsonCourseId);
    if (!$mysqlStudentId || !$mysqlCourseId) { $skippedE++; continue; }

    $existing = DB::selectOne("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?",
        [$mysqlStudentId, $mysqlCourseId]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            $totalAmt = (float)($e['total_amount'] ?? 0);
            $paidAmt = (float)($e['paid_amount'] ?? 0);
            $payStatus = match($e['payment_status'] ?? 'unpaid') {
                'fully_paid' => 'fully_paid', 'partially_paid' => 'partially_paid',
                'exempt' => 'exempt', default => 'unpaid'
            };
            $enrStatus = ($e['status'] ?? $e['enrollment_status'] ?? '') === 'active' ? 'active' : 'pending';
            DB::execute(
                "UPDATE enrollments SET total_amount=?, paid_amount=?, payment_status=?, enrollment_status=?,
                 training_stages=?, updated_at=NOW() WHERE id=?",
                [$totalAmt, $paidAmt, $payStatus, $enrStatus,
                 json_encode($e['training_stages'] ?? []), $existing['id']]
            );
            setMapId('enrollments', $e['id'] ?? '', (int)$existing['id']);
        }
        $syncedE++;
    } else {
        if ($mode !== 'dry-run') {
            $totalAmt = (float)($e['total_amount'] ?? 0);
            $paidAmt = (float)($e['paid_amount'] ?? 0);
            $payStatus = match($e['payment_status'] ?? 'unpaid') {
                'fully_paid' => 'fully_paid', 'partially_paid' => 'partially_paid',
                'exempt' => 'exempt', default => 'unpaid'
            };
            $enrStatus = ($e['status'] ?? $e['enrollment_status'] ?? '') === 'active' ? 'active' : 'pending';
            $newId = (int)DB::insert(
                "INSERT INTO enrollments (enrollment_code, student_id, course_id, total_amount, paid_amount,
                 payment_status, enrollment_status, training_stages, eligible_for_exam, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)",
                [$enrCode, $mysqlStudentId, $mysqlCourseId, $totalAmt, $paidAmt,
                 $payStatus, $enrStatus, json_encode($e['training_stages'] ?? []),
                 (bool)($e['eligible_for_exam'] ?? false), $e['created_at'] ?? date('Y-m-d H:i:s')]
            );
            setMapId('enrollments', $e['id'] ?? '', $newId);
        }
        $syncedE++;
    }
}
addStat('synced', 'enrollments', $syncedE);
addStat('skipped', 'enrollments', $skippedE);
log_msg("   ✅ $syncedE synced, $skippedE skipped");

// ========================================================================
// 5. SYNC CLASSES
// ========================================================================
log_msg("\n🏫 [5/12] Syncing classes...");
$jsonClasses = loadJson('classes');
$syncedCl = 0; $skippedCl = 0;

foreach ($jsonClasses as $cl) {
    $name = $cl['name'] ?? '';
    $jsonCourseId = $cl['course_id'] ?? '';
    $mysqlCourseId = mapId('courses', $jsonCourseId);
    $jsonId = $cl['id'] ?? '';

    if (empty($name)) { $skippedCl++; continue; }

    // Map student_ids từ JSON string sang MySQL BIGINT
    $studentIds = $cl['student_ids'] ?? [];
    $mappedStudentIds = [];
    foreach ($studentIds as $sid) {
        $mid = mapId('users', $sid);
        if ($mid) $mappedStudentIds[] = $mid;
    }

    $existing = DB::selectOne("SELECT id FROM classes WHERE name = ?", [$name]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            DB::execute(
                "UPDATE classes SET course_id=?, max_students=?, start_date=?, end_date=?,
                 location=?, type=?, student_ids=?, status=?, updated_at=NOW() WHERE id=?",
                [$mysqlCourseId, (int)($cl['max_students'] ?? 20),
                 $cl['start_date'] ?? null, $cl['end_date'] ?? null,
                 $cl['location'] ?? '', $cl['type'] ?? 'offline',
                 json_encode($mappedStudentIds), $cl['status'] ?? 'active',
                 $existing['id']]
            );
        }
        setMapId('classes', $jsonId, (int)$existing['id']);
        $syncedCl++;
    } else {
        if ($mode !== 'dry-run') {
            $classCode = 'CLS-' . date('Y') . '-' . str_pad($syncedCl + 1, 3, '0', STR_PAD_LEFT);
            $newId = (int)DB::insert(
                "INSERT INTO classes (class_code, name, course_id, max_students, start_date, end_date,
                 schedule, location, type, student_ids, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                [$classCode, $name, $mysqlCourseId, (int)($cl['max_students'] ?? 20),
                 $cl['start_date'] ?? null, $cl['end_date'] ?? null,
                 json_encode($cl['schedule'] ?? []), $cl['location'] ?? '',
                 $cl['type'] ?? 'offline', json_encode($mappedStudentIds),
                 $cl['status'] ?? 'active']
            );
            setMapId('classes', $jsonId, $newId);
        }
        $syncedCl++;
    }
}
addStat('synced', 'classes', $syncedCl);
addStat('skipped', 'classes', $skippedCl);
log_msg("   ✅ $syncedCl synced, $skippedCl skipped");

// ========================================================================
// 6. SYNC EXAMS
// ========================================================================
log_msg("\n📋 [6/12] Syncing exams...");
$jsonExams = loadJson('exams');
$syncedEx = 0; $skippedEx = 0;

foreach ($jsonExams as $ex) {
    $name = $ex['name'] ?? '';
    $jsonId = $ex['id'] ?? '';

    if (empty($name)) { $skippedEx++; continue; }

    $existing = DB::selectOne("SELECT id FROM exams WHERE name = ?", [$name]);
    if ($existing) {
        if ($mode !== 'dry-run') {
            DB::execute(
                "UPDATE exams SET total_questions=?, time_limit=?, pass_score=?,
                 questions=?, rank_group=?, updated_at=NOW() WHERE id=?",
                [(int)($ex['totalQuestions'] ?? 0), (int)($ex['timeLimit'] ?? 30),
                 (int)($ex['passScore'] ?? 70), json_encode($ex['questions'] ?? []),
                 $ex['rank'] ?? '', $existing['id']]
            );
        }
        $syncedEx++;
    } else {
        if ($mode !== 'dry-run') {
            DB::insert(
                "INSERT INTO exams (exam_code, name, rank_group, total_questions, time_limit, pass_score, questions, status)
                 VALUES (?,?,?,?,?,?,?,'active')",
                [$jsonId, $name, $ex['rank'] ?? '', (int)($ex['totalQuestions'] ?? 0),
                 (int)($ex['timeLimit'] ?? 30), (int)($ex['passScore'] ?? 70),
                 json_encode($ex['questions'] ?? [])]
            );
        }
        $syncedEx++;
    }
}
addStat('synced', 'exams', $syncedEx);
addStat('skipped', 'exams', $skippedEx);
log_msg("   ✅ $syncedEx synced, $skippedEx skipped");

// ========================================================================
// 7. SYNC EXAM RESULTS
// ========================================================================
log_msg("\n📊 [7/12] Syncing exam_results...");
$jsonExamResults = loadJson('exam_results');
$syncedER = 0; $skippedER = 0;

foreach ($jsonExamResults as $er) {
    $jsonStudentId = $er['student_id'] ?? '';
    $mysqlStudentId = mapId('users', $jsonStudentId);
    if (!$mysqlStudentId) { $skippedER++; continue; }

    if ($mode !== 'dry-run') {
        $total = (int)($er['total'] ?? $er['totalQuestions'] ?? 0);
        $correct = (int)($er['correct'] ?? 0);
        DB::insert(
            "INSERT INTO exam_results (student_id, exam_type, exam_number, exam_date,
             total_questions, answered, correct, score, passed, duration_minutes, questions, submitted_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            [$mysqlStudentId, $er['exam_type'] ?? '', $er['exam_number'] ?? '',
             $er['date'] ?? $er['submittedAt'] ?? null,
             $total, (int)($er['answered'] ?? 0), $correct,
             $total > 0 ? round($correct / $total * 100, 2) : 0,
             ($correct >= ($total * 0.7)) ? 1 : 0,
             (int)($er['duration_minutes'] ?? 0),
             json_encode($er['questions'] ?? []),
             $er['submittedAt'] ?? $er['date'] ?? null]
        );
    }
    $syncedER++;
}
addStat('synced', 'exam_results', $syncedER);
addStat('skipped', 'exam_results', $skippedER);
log_msg("   ✅ $syncedER synced, $skippedER skipped");

// ========================================================================
// 8. SYNC FLY LOGS
// ========================================================================
log_msg("\n✈️  [8/12] Syncing fly_logs...");
$jsonFlyLogs = loadJson('fly_logs');
$syncedFL = 0; $skippedFL = 0;

foreach ($jsonFlyLogs as $fl) {
    $jsonStudentId = $fl['student_id'] ?? '';
    $mysqlStudentId = mapId('users', $jsonStudentId);
    if (!$mysqlStudentId) { $skippedFL++; continue; }

    if ($mode !== 'dry-run') {
        DB::insert(
            "INSERT INTO fly_logs (student_id, flight_date, duration_minutes, uav_model, location, weather, notes, logged_by, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)",
            [$mysqlStudentId, $fl['date'] ?? null, (int)($fl['duration_minutes'] ?? 0),
             $fl['uav_model'] ?? '', $fl['location'] ?? '', $fl['weather'] ?? '',
             $fl['notes'] ?? '', mapId('users', $fl['logged_by'] ?? ''),
             $fl['createdAt'] ?? date('Y-m-d H:i:s')]
        );
    }
    $syncedFL++;
}
addStat('synced', 'fly_logs', $syncedFL);
addStat('skipped', 'fly_logs', $skippedFL);
log_msg("   ✅ $syncedFL synced, $skippedFL skipped");

// ========================================================================
// 9. SYNC CHANGE REQUESTS
// ========================================================================
log_msg("\n🔄 [9/12] Syncing change_requests...");
$jsonCR = loadJson('change_requests');
$syncedCR = 0; $skippedCR = 0;

foreach ($jsonCR as $cr) {
    $jsonStudentId = $cr['studentId'] ?? '';
    $mysqlStudentId = mapId('users', $jsonStudentId);
    if (!$mysqlStudentId) { $skippedCR++; continue; }

    if ($mode !== 'dry-run') {
        DB::insert(
            "INSERT INTO change_requests (student_id, student_name, request_type,
             from_value, to_value, reason, amount, status, created_by, history, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())",
            [$mysqlStudentId, $cr['studentName'] ?? '',
             $cr['type'] ?? 'other',
             $cr['fromClassName'] ?? $cr['fromClassId'] ?? '',
             $cr['toClassName'] ?? $cr['toClassId'] ?? '',
             $cr['reason'] ?? '', (float)($cr['amount'] ?? 0),
             $cr['status'] ?? 'pending', $cr['createdBy'] ?? '',
             json_encode($cr['history'] ?? []), $cr['createdAt'] ?? date('Y-m-d H:i:s')]
        );
    }
    $syncedCR++;
}
addStat('synced', 'change_requests', $syncedCR);
addStat('skipped', 'change_requests', $skippedCR);
log_msg("   ✅ $syncedCR synced, $skippedCR skipped");

// ========================================================================
// 10. SYNC QUESTION BANK
// ========================================================================
log_msg("\n❓ [10/12] Syncing question_bank...");
$jsonQB = loadJsonArray('question_bank', 'questions');
$syncedQB = 0; $skippedQB = 0;

foreach ($jsonQB as $q) {
    if (empty($q['question'] ?? '')) { $skippedQB++; continue; }

    if ($mode !== 'dry-run') {
        $qid = $q['id'] ?? $q['question_code'] ?? '';
        $existing = $qid ? DB::selectOne("SELECT id FROM question_bank WHERE question_code = ?", [$qid]) : null;
        if ($existing) {
            DB::execute(
                "UPDATE question_bank SET question_text=?, options=?, correct_answer=?,
                 question_type=?, module_id=?, module_name=?, difficulty=?, rank_group=?, updated_at=NOW() WHERE id=?",
                [$q['question'], json_encode($q['options'] ?? []), (int)($q['answer'] ?? 0),
                 $q['type'] ?? 'true_false', $q['module_id'] ?? '', $q['module_name'] ?? '',
                 $q['difficulty'] ?? '', $q['rank'] ?? '', $existing['id']]
            );
        } else {
            DB::insert(
                "INSERT INTO question_bank (question_code, question_text, options, correct_answer,
                 question_type, module_id, module_name, difficulty, rank_group)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [$qid, $q['question'], json_encode($q['options'] ?? []), (int)($q['answer'] ?? 0),
                 $q['type'] ?? 'true_false', $q['module_id'] ?? '', $q['module_name'] ?? '',
                 $q['difficulty'] ?? '', $q['rank'] ?? '']
            );
        }
    }
    $syncedQB++;
}
addStat('synced', 'question_bank', $syncedQB);
addStat('skipped', 'question_bank', $skippedQB);
log_msg("   ✅ $syncedQB synced, $skippedQB skipped");

// ========================================================================
// 11. SYNC EMAIL LOG
// ========================================================================
log_msg("\n📧 [11/12] Syncing email_log...");
$jsonEmailLog = loadJson('email_log');
$syncedEL = 0; $skippedEL = 0;

foreach ($jsonEmailLog as $el) {
    if (empty($el['to'] ?? '')) { $skippedEL++; continue; }

    if ($mode !== 'dry-run') {
        $jsonStudentId = $el['studentId'] ?? '';
        $mysqlStudentId = $jsonStudentId ? mapId('users', $jsonStudentId) : null;
        DB::insert(
            "INSERT INTO email_log (recipient_email, subject, status, error_message, student_id, triggered_by, sent_at, created_at)
             VALUES (?,?,?,?,?,?,?,?)",
            [$el['to'], $el['subject'] ?? '',
             ($el['sent'] ?? false) ? 'sent' : 'failed',
             $el['error'] ?? '', $mysqlStudentId,
             $el['triggeredBy'] ?? '',
             ($el['sent'] ?? false) ? ($el['timestamp'] ?? null) : null,
             $el['timestamp'] ?? date('Y-m-d H:i:s')]
        );
    }
    $syncedEL++;
}
addStat('synced', 'email_log', $syncedEL);
addStat('skipped', 'email_log', $skippedEL);
log_msg("   ✅ $syncedEL synced, $skippedEL skipped");

// ========================================================================
// 12. SYNC PASSWORD RESETS & UPLOADED FILES (nhỏ, sync cuối)
// ========================================================================
log_msg("\n🔐 [12/12] Syncing password_resets + uploaded_files + registrations...");
$syncedMisc = 0;

// Password resets
$jsonPR = loadJson('password_resets');
foreach ($jsonPR as $pr) {
    if ($mode !== 'dry-run') {
        DB::insert(
            "INSERT INTO password_resets (email, token_hash, expires_at, ip_address, created_at) VALUES (?,?,?,?,?)",
            [$pr['user_id'] ?? '', $pr['token'] ?? '', $pr['expires'] ?? date('Y-m-d H:i:s', time() + 1800),
             $pr['ip'] ?? '', $pr['created_at'] ?? date('Y-m-d H:i:s')]
        );
    }
    $syncedMisc++;
}

// Uploaded files
$jsonUF = loadJson('uploaded_files');
foreach ($jsonUF as $uf) {
    if ($mode !== 'dry-run') {
        DB::insert(
            "INSERT INTO uploaded_files (original_name, stored_name, stored_path, title, description, mime_type, size_bytes, category, uploaded_by, uploaded_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)",
            [$uf['originalName'] ?? $uf['name'] ?? '', $uf['name'] ?? '',
             $uf['path'] ?? '', $uf['title'] ?? '', $uf['description'] ?? '',
             $uf['mimeType'] ?? '', (int)($uf['size'] ?? 0),
             $uf['category'] ?? '', mapId('users', $uf['uploadedBy'] ?? ''),
             $uf['uploadedAt'] ?? date('Y-m-d H:i:s')]
        );
    }
    $syncedMisc++;
}

// Certifications (empty but sync anyway)
$jsonCerts = loadJson('certifications');
foreach ($jsonCerts as $cert) {
    if ($mode !== 'dry-run') {
        $jsonStudentId = $cert['student_id'] ?? $cert['studentId'] ?? '';
        DB::insert(
            "INSERT INTO certifications (cert_code, student_id, enrollment_id, course_name, issued_date, status)
             VALUES (?,?,?,?,?,?)",
            [$cert['id'] ?? $cert['cert_code'] ?? ('CERT-' . uniqid()),
             mapId('users', $jsonStudentId),
             null, $cert['course_name'] ?? $cert['courseName'] ?? '',
             $cert['issued_date'] ?? $cert['issuedDate'] ?? date('Y-m-d'),
             $cert['status'] ?? 'issued']
        );
    }
    $syncedMisc++;
}

addStat('synced', 'misc', $syncedMisc);
log_msg("   ✅ $syncedMisc miscellaneous records synced");

// ========================================================================
// REPORT
// ========================================================================
log_msg("\n" . str_repeat('=', 60));
log_msg('📊 SYNC REPORT');
log_msg(str_repeat('=', 60));
log_msg("   Synced:  {$stats['synced']}");
log_msg("   Skipped: {$stats['skipped']}");
log_msg("   Errors:  {$stats['errors']}");
log_msg("   Deleted: {$stats['deleted']}");
log_msg(str_repeat('=', 60));

if ($mode === 'dry-run') {
    log_msg("\n⚠️  DRY RUN — không có thay đổi nào được thực hiện.");
    log_msg("   Chạy với --sync để thực hiện đồng bộ.");
} else {
    log_msg("\n✅ Đồng bộ hoàn tất!");
}

// In chi tiết nếu có lỗi
if (!empty($details)) {
    log_msg("\n📋 Details:");
    foreach ($details as $d) log_msg("   $d");
}

// HTTP response
if ($isHTTP) {
    echo json_encode([
        'success' => true,
        'mode' => $mode,
        'stats' => $stats,
        'details' => $details,
    ], JSON_UNESCAPED_UNICODE);
}
