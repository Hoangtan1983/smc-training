<?php
class SMC_DB {
    private static $instance = null;
    private static string $backend = 'sqlite';
    
    public static function get(): PDO {
        if (self::$instance !== null) return self::$instance;
        
        $envFile = __DIR__ . '/env.php';
        $env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];
        $mysqlPass = $env['DB_PASS'] ?? '';
        if (!empty($mysqlPass)) {
            try {
                $host = $env['DB_HOST'] ?? 'localhost';
                $name = $env['DB_NAME'] ?? 'smc_training';
                $user = $env['DB_USER'] ?? 'smc46189';
                self::$instance = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $mysqlPass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
                self::$backend = 'mysql';
                return self::$instance;
            } catch (PDOException $e) {}
        }
        
        $dbDir = __DIR__ . '/data';
        if (!is_dir($dbDir)) mkdir($dbDir, 0777, true);
        $dbPath = $dbDir . '/smc_training.sqlite';
        
        self::$instance = new PDO("sqlite:{$dbPath}", null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        self::$instance->exec("PRAGMA journal_mode=WAL");
        self::$instance->exec("PRAGMA foreign_keys=ON");
        self::$backend = 'sqlite';
        self::initTables();
        return self::$instance;
    }
    
    private static function initTables() {
        $pdo = self::$instance;
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user_code TEXT UNIQUE, full_name TEXT NOT NULL, email TEXT UNIQUE, phone TEXT, password_hash TEXT, role TEXT DEFAULT 'student', status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, tuition_fee REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS agents (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, commission_rate REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, enrollment_code TEXT UNIQUE NOT NULL, student_id INTEGER NOT NULL, course_id INTEGER NOT NULL, agent_id INTEGER, total_amount REAL DEFAULT 0, final_amount REAL DEFAULT 0, paid_amount REAL DEFAULT 0, payment_status TEXT DEFAULT 'unpaid', eligible_for_exam INTEGER DEFAULT 0, enrollment_status TEXT DEFAULT 'pending', training_stages TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(student_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_code TEXT UNIQUE NOT NULL, enrollment_id INTEGER NOT NULL, base_price REAL DEFAULT 0, final_price REAL DEFAULT 0, total_paid REAL DEFAULT 0, agency_id TEXT, agency_name TEXT, agency_discount_percent REAL DEFAULT 0, agency_discount_amount REAL DEFAULT 0, status TEXT DEFAULT 'pending', note TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(enrollment_id) REFERENCES enrollments(id))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_code TEXT UNIQUE NOT NULL, enrollment_id INTEGER NOT NULL, amount REAL NOT NULL, payment_method TEXT DEFAULT 'cash', status TEXT DEFAULT 'pending', note TEXT, receipt_image TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(enrollment_id) REFERENCES enrollments(id))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS agency_commissions (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER NOT NULL, payment_id INTEGER NOT NULL, enrollment_id INTEGER NOT NULL, payment_amount REAL, commission_rate REAL, commission_amount REAL, period TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(agent_id) REFERENCES agents(id), FOREIGN KEY(payment_id) REFERENCES payments(id), FOREIGN KEY(enrollment_id) REFERENCES enrollments(id))");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_enr_student ON enrollments(student_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_enr_status ON enrollments(payment_status)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inv_enrollment ON invoices(enrollment_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pay_enrollment ON payments(enrollment_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status)");
    }
    
    public static function backend(): string { if (self::$instance === null) self::get(); return self::$backend; }
    public static function select(string $sql, array $params = []): array { $stmt = self::get()->prepare($sql); $stmt->execute($params); return $stmt->fetchAll() ?: []; }
    public static function selectOne(string $sql, array $params = []): ?array { $rows = self::select($sql, $params); return $rows[0] ?? null; }
    public static function execute(string $sql, array $params = []): int { $stmt = self::get()->prepare($sql); $stmt->execute($params); return $stmt->rowCount(); }
    public static function insert(string $sql, array $params = []): string { self::execute($sql, $params); return self::get()->lastInsertId(); }
    public static function begin(): void { self::get()->beginTransaction(); }
    public static function commit(): void { self::get()->commit(); }
    public static function rollback(): void { self::get()->rollBack(); }
}
