-- SMC Training — Migration v9: bảng đăng ký đào tạo lái xe (hạng A1 & A)
-- Tách biệt hoàn toàn với UAV: học viên lái xe KHÔNG vào bảng users.

CREATE TABLE IF NOT EXISTS laxe_registrations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) DEFAULT NULL,
    license_type VARCHAR(10) NOT NULL,          -- A1 | A
    status VARCHAR(20) NOT NULL DEFAULT 'new',   -- new | contacted | enrolled | cancelled
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_laxe_status (status),
    INDEX idx_laxe_license (license_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
