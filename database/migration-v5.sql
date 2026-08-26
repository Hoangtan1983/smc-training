-- Migration v5 for MariaDB 10.6
ALTER TABLE invoices ADD COLUMN student_name VARCHAR(255) DEFAULT '' AFTER remaining_due;
ALTER TABLE invoices ADD COLUMN student_email VARCHAR(100) DEFAULT '' AFTER student_name;
ALTER TABLE invoices ADD COLUMN student_phone VARCHAR(20) DEFAULT '' AFTER student_email;
ALTER TABLE payments ADD COLUMN evidence_image VARCHAR(500) DEFAULT NULL AFTER receipt_image;
ALTER TABLE payments ADD COLUMN staff_confirmed_by BIGINT NULL AFTER approved_by;
ALTER TABLE payments ADD COLUMN staff_confirmed_at TIMESTAMP NULL AFTER approved_at;
CREATE TABLE IF NOT EXISTS staff_cash_ledger (id BIGINT PRIMARY KEY AUTO_INCREMENT, staff_id BIGINT NOT NULL, payment_id BIGINT NOT NULL, amount DECIMAL(15,2) NOT NULL, status ENUM('holding','reconciled') DEFAULT 'holding', reconciled_by BIGINT NULL, reconciled_at TIMESTAMP NULL, note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_scl_staff (staff_id), INDEX idx_scl_payment (payment_id), INDEX idx_scl_status (status)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_log (id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NULL, action VARCHAR(100) NOT NULL, entity_type VARCHAR(50) NOT NULL, entity_id BIGINT NOT NULL, old_values JSON NULL, new_values JSON NULL, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_audit_entity (entity_type, entity_id), INDEX idx_audit_action (action), INDEX idx_audit_user (user_id), INDEX idx_audit_created (created_at)) ENGINE=InnoDB;
