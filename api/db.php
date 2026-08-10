<?php
/**
 * SMC Training — Database Layer (MySQL v2)
 * PDO Singleton + Query helpers
 * Include: require_once __DIR__ . '/db.php';
 */

class DB {
    private static ?PDO $instance = null;
    private static array $queries = [];
    private static float $totalTime = 0;

    /** Get PDO instance (singleton) */
    public static function get(): PDO {
        if (self::$instance !== null) return self::$instance;

        $envFile = __DIR__ . '/env.php';
        $env = (file_exists($envFile) && is_array($cfg = include $envFile)) ? $cfg : [];

        $host = $env['DB_HOST'] ?? 'localhost';
        $name = $env['DB_NAME'] ?? 'smc_training';
        $user = $env['DB_USER'] ?? 'smc46189';
        $pass = $env['DB_PASS'] ?? '';

        self::$instance = new PDO(
            "mysql:host={$host};dbname={$name};charset=utf8mb4",
            $user, $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
            ]
        );

        return self::$instance;
    }

    /** Execute a SELECT query and return all rows */
    public static function select(string $sql, array $params = []): array {
        $start = microtime(true);
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetchAll();
        self::$totalTime += microtime(true) - $start;
        self::$queries[] = ['sql' => $sql, 'params' => $params, 'time' => round(microtime(true) - $start, 4)];
        return $result ?: [];
    }

    /** Execute a SELECT and return first row (or null) */
    public static function selectOne(string $sql, array $params = []): ?array {
        $rows = self::select($sql, $params);
        return $rows[0] ?? null;
    }

    /** Execute INSERT/UPDATE/DELETE and return affected rows */
    public static function execute(string $sql, array $params = []): int {
        $start = microtime(true);
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        self::$totalTime += microtime(true) - $start;
        self::$queries[] = ['sql' => $sql, 'params' => $params, 'time' => round(microtime(true) - $start, 4)];
        return $stmt->rowCount();
    }

    /** Execute INSERT and return last insert ID */
    public static function insert(string $sql, array $params = []): string {
        self::execute($sql, $params);
        return self::get()->lastInsertId();
    }

    /** Call a stored procedure and return result set */
    public static function call(string $proc, array $params = []): ?array {
        $placeholders = implode(',', array_fill(0, count($params), '?'));
        $sql = "CALL {$proc}({$placeholders})";

        $start = microtime(true);
        $stmt = self::get()->prepare($sql);
        $stmt->execute(array_values($params));
        $result = $stmt->fetchAll();
        self::$totalTime += microtime(true) - $start;
        self::$queries[] = ['sql' => $sql, 'params' => $params, 'time' => round(microtime(true) - $start, 4)];

        // Consume any other result sets from stored procedure
        while ($stmt->nextRowset()) {}

        return $result ?: null;
    }

    /** Begin transaction */
    public static function begin(): void {
        self::get()->beginTransaction();
    }

    /** Commit transaction */
    public static function commit(): void {
        self::get()->commit();
    }

    /** Rollback transaction */
    public static function rollback(): void {
        self::get()->rollBack();
    }

    /** Quote a value for safe SQL embedding (use params when possible) */
    public static function quote($value): string {
        return self::get()->quote($value);
    }

    /** Build WHERE clause from assoc array (supports =, LIKE, >, <, >=, <=, IN) */
    public static function buildWhere(array $filters, string $alias = ''): array {
        $conditions = [];
        $params = [];
        $prefix = $alias ? "{$alias}." : '';

        foreach ($filters as $key => $value) {
            if ($value === null || $value === '') continue;

            // Handle operators: key__op (e.g. status__in, amount__gte)
            $parts = explode('__', $key);
            $col = $parts[0];
            $op = $parts[1] ?? '=';

            switch ($op) {
                case 'like':
                    $conditions[] = "{$prefix}`{$col}` LIKE ?";
                    $params[] = "%{$value}%";
                    break;
                case 'in':
                    if (is_array($value)) {
                        $phs = implode(',', array_fill(0, count($value), '?'));
                        $conditions[] = "{$prefix}`{$col}` IN ({$phs})";
                        $params = array_merge($params, $value);
                    }
                    break;
                case 'gte':
                    $conditions[] = "{$prefix}`{$col}` >= ?";
                    $params[] = $value;
                    break;
                case 'lte':
                    $conditions[] = "{$prefix}`{$col}` <= ?";
                    $params[] = $value;
                    break;
                case 'gt':
                    $conditions[] = "{$prefix}`{$col}` > ?";
                    $params[] = $value;
                    break;
                case 'lt':
                    $conditions[] = "{$prefix}`{$col}` < ?";
                    $params[] = $value;
                    break;
                case 'ne':
                    $conditions[] = "{$prefix}`{$col}` != ?";
                    $params[] = $value;
                    break;
                default: // =
                    $conditions[] = "{$prefix}`{$col}` = ?";
                    $params[] = $value;
            }
        }

        $where = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
        return [$where, $params];
    }

    /** Get pagination LIMIT/OFFSET clause */
    public static function paginate(int $page = 1, int $perPage = 20): string {
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage)); // clamp 1-100
        $offset = ($page - 1) * $perPage;
        return "LIMIT {$perPage} OFFSET {$offset}";
    }

    /** Get all executed queries for debugging */
    public static function getQueries(): array {
        return self::$queries;
    }

    /** Get total query time */
    public static function getTotalTime(): float {
        return round(self::$totalTime, 4);
    }

    /**
     * Kiểm tra kết nối & phiên bản MySQL
     */
    public static function health(): array {
        try {
            $pdo = self::get();
            $version = $pdo->query("SELECT VERSION() AS v")->fetch()['v'];
            $dbName = $pdo->query("SELECT DATABASE() AS d")->fetch()['d'];
            $tableCount = (int)$pdo->query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = '{$dbName}'")->fetch()['c'];
            return [
                'status' => 'ok',
                'mysql_version' => $version,
                'database' => $dbName,
                'tables' => $tableCount,
                'queries' => count(self::$queries),
                'query_time_ms' => round(self::$totalTime * 1000, 2),
            ];
        } catch (PDOException $e) {
            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }
}
