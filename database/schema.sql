-- ============================================================================
-- SMC Training — Hệ thống Quản lý Học phí Khép kín
-- MySQL Schema v2.0 — Thiết kế cho quy mô 3,000+ học viên
-- Created: 2026-08-05
-- Engine: InnoDB | Charset: utf8mb4
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smc_training
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smc_training;

-- ============================================================================
-- 1. BẢNG CORE
-- ============================================================================

CREATE TABLE courses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tuition_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE agents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_code VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255),
    role ENUM('student', 'sale', 'accountant', 'admin', 'teacher', 'staff') DEFAULT 'student',
    status ENUM('active', 'inactive', 'frozen') DEFAULT 'active',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_phone (phone)
) ENGINE=InnoDB;

-- ============================================================================
-- 2. BẢNG NGHIỆP VỤ CHÍNH
-- ============================================================================

CREATE TABLE enrollments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    enrollment_code VARCHAR(50) UNIQUE NOT NULL,
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    agent_id BIGINT NULL,
    sale_id BIGINT NULL,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    final_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(15,2) DEFAULT 0.00,
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (final_amount - paid_amount) STORED,
    payment_status ENUM('unpaid', 'partially_paid', 'fully_paid', 'exempt') DEFAULT 'unpaid',
    eligible_for_exam BOOLEAN DEFAULT FALSE,
    enrollment_status ENUM('pending', 'active', 'studying', 'completed', 'cancelled', 'frozen') DEFAULT 'pending',
    training_stages JSON,
    notes TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_enr_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    CONSTRAINT fk_enr_sale FOREIGN KEY (sale_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_enr_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_enr_code (enrollment_code),
    INDEX idx_enr_student (student_id),
    INDEX idx_enr_agent (agent_id),
    INDEX idx_enr_sale (sale_id),
    INDEX idx_enr_payment_status (payment_status),
    INDEX idx_enr_remaining (remaining_amount)
) ENGINE=InnoDB;

CREATE TABLE invoices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    invoice_code VARCHAR(50) UNIQUE NOT NULL,
    enrollment_id BIGINT NOT NULL,
    base_price DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0.00,
    final_price DECIMAL(15,2) NOT NULL,
    total_paid DECIMAL(15,2) DEFAULT 0.00,
    remaining_due DECIMAL(15,2) GENERATED ALWAYS AS (final_price - total_paid) STORED,
    agency_id VARCHAR(50),
    agency_name VARCHAR(255),
    agency_discount_percent DECIMAL(5,2) DEFAULT 0.00,
    agency_discount_amount DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('draft', 'pending', 'partial', 'paid', 'exempt', 'frozen', 'cancelled') DEFAULT 'pending',
    note TEXT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_inv_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_inv_code (invoice_code),
    INDEX idx_inv_enrollment (enrollment_id),
    INDEX idx_inv_status (status),
    INDEX idx_inv_agency (agency_id)
) ENGINE=InnoDB;

CREATE TABLE payment_schedules (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    enrollment_id BIGINT NOT NULL,
    installment_num INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    amount_due DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0.00,
    due_date DATE NOT NULL,
    status ENUM('pending', 'partially_paid', 'completed', 'overdue') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sched_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    INDEX idx_sched_enrollment (enrollment_id),
    INDEX idx_sched_due (due_date, status)
) ENGINE=InnoDB;

-- ============================================================================
-- 3. BẢNG GIAO DỊCH
-- ============================================================================

CREATE TABLE payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    receipt_code VARCHAR(50) UNIQUE NOT NULL,
    enrollment_id BIGINT NOT NULL,
    invoice_id BIGINT,
    payment_schedule_id BIGINT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'qr_code', 'pos', 'other') NOT NULL DEFAULT 'cash',
    transaction_ref VARCHAR(100),
    collector_id BIGINT NULL,
    submitted_by BIGINT NULL,
    approved_by BIGINT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    note TEXT,
    receipt_image VARCHAR(500),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_schedule FOREIGN KEY (payment_schedule_id) REFERENCES payment_schedules(id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_collector FOREIGN KEY (collector_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_submitter FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_pay_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_pay_receipt (receipt_code),
    INDEX idx_pay_enrollment (enrollment_id),
    INDEX idx_pay_status (status),
    INDEX idx_pay_date (payment_date)
) ENGINE=InnoDB;

CREATE TABLE refunds (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    refund_code VARCHAR(50) UNIQUE NOT NULL,
    payment_id BIGINT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    refund_method VARCHAR(50),
    transaction_ref VARCHAR(100),
    status ENUM('pending', 'approved', 'completed') DEFAULT 'pending',
    approved_by BIGINT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ref_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ref_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
    INDEX idx_ref_enrollment (enrollment_id),
    INDEX idx_ref_status (status)
) ENGINE=InnoDB;

CREATE TABLE commission_payouts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    payout_code VARCHAR(50) UNIQUE NOT NULL,
    agent_id BIGINT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_collected DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    payout_date DATE,
    payout_method VARCHAR(50),
    transaction_ref VARCHAR(100),
    status ENUM('calculated', 'approved', 'paid') DEFAULT 'calculated',
    approved_by BIGINT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_po_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_po_agent (agent_id),
    INDEX idx_po_period (period_start, period_end),
    INDEX idx_po_status (status)
) ENGINE=InnoDB;

CREATE TABLE commission_details (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    payout_id BIGINT,
    agent_id BIGINT NOT NULL,
    payment_id BIGINT NOT NULL,
    enrollment_id BIGINT NOT NULL,
    payment_amount DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(15,2) NOT NULL,
    period VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cd_payout FOREIGN KEY (payout_id) REFERENCES commission_payouts(id) ON DELETE SET NULL,
    CONSTRAINT fk_cd_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cd_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cd_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT,
    INDEX idx_cd_agent (agent_id),
    INDEX idx_cd_period (period),
    INDEX idx_cd_payout (payout_id)
) ENGINE=InnoDB;

-- ============================================================================
-- 4. BẢNG HỖ TRỢ
-- ============================================================================

CREATE TABLE audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    enrollment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    type ENUM('payment_reminder', 'payment_overdue', 'payment_received', 'payment_approved', 'payment_rejected', 'exam_eligible', 'general') NOT NULL,
    channel ENUM('sms', 'email', 'zalo_zns', 'in_app') NOT NULL,
    title VARCHAR(255),
    content TEXT,
    status ENUM('pending', 'sent', 'failed', 'read') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id, status),
    INDEX idx_notif_type (type),
    INDEX idx_notif_created (created_at)
) ENGINE=InnoDB;

-- ============================================================================
-- 5. STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- 5.1. Duyệt phiếu thu → auto-sync enrollment, invoice, commission
CREATE PROCEDURE sp_approve_payment(
    IN p_payment_id BIGINT,
    IN p_approved_by BIGINT,
    IN p_note VARCHAR(500)
)
BEGIN
    DECLARE v_enrollment_id BIGINT;
    DECLARE v_invoice_id BIGINT;
    DECLARE v_schedule_id BIGINT;
    DECLARE v_amount DECIMAL(15,2);
    DECLARE v_current_paid DECIMAL(15,2);
    DECLARE v_final_amount DECIMAL(15,2);
    DECLARE v_new_paid DECIMAL(15,2);
    DECLARE v_payment_status VARCHAR(20);
    DECLARE v_eligible BOOLEAN;
    DECLARE v_agent_id BIGINT;
    DECLARE v_commission_rate DECIMAL(5,2);
    DECLARE v_commission_amount DECIMAL(15,2);
    DECLARE v_old_paid DECIMAL(15,2);
    DECLARE v_old_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lỗi khi duyệt phiếu thu';
    END;

    START TRANSACTION;

    SELECT enrollment_id, invoice_id, payment_schedule_id, amount
    INTO v_enrollment_id, v_invoice_id, v_schedule_id, v_amount
    FROM payments WHERE id = p_payment_id;

    SELECT paid_amount, final_amount, payment_status
    INTO v_current_paid, v_final_amount, v_old_status
    FROM enrollments WHERE id = v_enrollment_id;

    SET v_old_paid = v_current_paid;
    SET v_new_paid = v_current_paid + v_amount;

    IF v_new_paid <= 0 THEN SET v_payment_status = 'unpaid'; SET v_eligible = FALSE;
    ELSEIF v_new_paid >= v_final_amount THEN SET v_payment_status = 'fully_paid'; SET v_eligible = TRUE;
    ELSE SET v_payment_status = 'partially_paid'; SET v_eligible = FALSE;
    END IF;

    UPDATE payments SET status = 'approved', approved_by = p_approved_by, approved_at = NOW(),
        note = IF(p_note != '', CONCAT(IFNULL(note, ''), ' | ', p_note), note)
    WHERE id = p_payment_id;

    UPDATE enrollments SET paid_amount = v_new_paid, payment_status = v_payment_status,
        eligible_for_exam = v_eligible, updated_at = NOW()
    WHERE id = v_enrollment_id;

    IF v_invoice_id IS NOT NULL THEN
        UPDATE invoices SET total_paid = total_paid + v_amount,
            status = CASE WHEN total_paid + v_amount >= final_price THEN 'paid'
                          WHEN total_paid + v_amount > 0 THEN 'partial' ELSE 'pending' END,
            updated_at = NOW()
        WHERE id = v_invoice_id;
    END IF;

    IF v_schedule_id IS NOT NULL THEN
        UPDATE payment_schedules SET amount_paid = amount_paid + v_amount,
            status = CASE WHEN amount_paid + v_amount >= amount_due THEN 'completed'
                          WHEN amount_paid + v_amount > 0 THEN 'partially_paid' ELSE 'pending' END,
            updated_at = NOW()
        WHERE id = v_schedule_id;
    END IF;

    SELECT agent_id INTO v_agent_id FROM enrollments WHERE id = v_enrollment_id;
    IF v_agent_id IS NOT NULL THEN
        SELECT commission_rate INTO v_commission_rate FROM agents WHERE id = v_agent_id;
        SET v_commission_amount = ROUND(v_amount * v_commission_rate / 100, 0);
        INSERT INTO commission_details (agent_id, payment_id, enrollment_id, payment_amount, commission_rate, commission_amount, period)
        VALUES (v_agent_id, p_payment_id, v_enrollment_id, v_amount, v_commission_rate, v_commission_amount, DATE_FORMAT(NOW(), '%Y-%m'));
    END IF;

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (p_approved_by, 'approve_payment', 'payment', p_payment_id,
            JSON_OBJECT('paid_amount', v_old_paid, 'status', v_old_status),
            JSON_OBJECT('paid_amount', v_new_paid, 'status', v_payment_status, 'exam_ok', v_eligible));

    COMMIT;

    SELECT v_enrollment_id AS enrollment_id, v_new_paid AS new_paid_amount,
           v_final_amount AS final_amount, v_payment_status AS payment_status,
           v_eligible AS eligible_for_exam, 'OK' AS message;
END //

-- 5.2. Từ chối phiếu thu
CREATE PROCEDURE sp_reject_payment(
    IN p_payment_id BIGINT,
    IN p_rejected_by BIGINT,
    IN p_reason VARCHAR(500)
)
BEGIN
    DECLARE v_old_status VARCHAR(20);
    START TRANSACTION;
    SELECT status INTO v_old_status FROM payments WHERE id = p_payment_id;
    UPDATE payments SET status = 'rejected', approved_by = p_rejected_by, rejection_reason = p_reason, approved_at = NOW()
    WHERE id = p_payment_id AND status = 'pending';
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (p_rejected_by, 'reject_payment', 'payment', p_payment_id,
            JSON_OBJECT('status', v_old_status), JSON_OBJECT('status', 'rejected', 'reason', p_reason));
    COMMIT;
    SELECT 'Payment rejected' AS message;
END //

-- 5.3. Tạo enrollment + invoice + payment_schedules
CREATE PROCEDURE sp_create_enrollment(
    IN p_student_id BIGINT,
    IN p_course_id BIGINT,
    IN p_agent_id BIGINT,
    IN p_sale_id BIGINT,
    IN p_discount_amount DECIMAL(15,2),
    IN p_created_by BIGINT,
    IN p_plan_json JSON
)
BEGIN
    DECLARE v_fee DECIMAL(15,2);
    DECLARE v_final DECIMAL(15,2);
    DECLARE v_enr_id BIGINT;
    DECLARE v_enr_code VARCHAR(50);
    DECLARE v_inv_code VARCHAR(50);
    DECLARE v_seq INT;
    DECLARE v_yr VARCHAR(4);
    DECLARE v_ag_pct DECIMAL(5,2);
    DECLARE v_ag_name VARCHAR(255);
    DECLARE i INT DEFAULT 0;
    DECLARE n INT;
    DECLARE v_num INT;
    DECLARE v_title VARCHAR(100);
    DECLARE v_due_amt DECIMAL(15,2);
    DECLARE v_due_date DATE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lỗi tạo hồ sơ'; END;
    START TRANSACTION;

    SELECT tuition_fee INTO v_fee FROM courses WHERE id = p_course_id;
    SET v_final = v_fee - IFNULL(p_discount_amount, 0);
    IF v_final < 0 THEN SET v_final = 0; END IF;

    SET v_yr = DATE_FORMAT(NOW(), '%Y');
    SELECT COUNT(*) + 1 INTO v_seq FROM enrollments WHERE YEAR(created_at) = YEAR(NOW());
    SET v_enr_code = CONCAT('HS-', v_yr, '-', LPAD(v_seq, 4, '0'));

    INSERT INTO enrollments (enrollment_code, student_id, course_id, agent_id, sale_id,
        total_amount, discount_amount, final_amount, payment_status, enrollment_status,
        training_stages, created_by)
    VALUES (v_enr_code, p_student_id, p_course_id, p_agent_id, p_sale_id,
        v_fee, IFNULL(p_discount_amount, 0), v_final, 'unpaid', 'pending',
        JSON_OBJECT('enrollment', JSON_OBJECT('status', 'pending'), 'theory', JSON_OBJECT('status', 'pending'),
                    'practice', JSON_OBJECT('status', 'pending'), 'exam', JSON_OBJECT('status', 'pending'),
                    'certification', JSON_OBJECT('status', 'pending')),
        p_created_by);
    SET v_enr_id = LAST_INSERT_ID();

    SELECT COUNT(*) + 1 INTO v_seq FROM invoices WHERE YEAR(created_at) = YEAR(NOW());
    SET v_inv_code = CONCAT('INV-', v_yr, '-', LPAD(v_seq, 4, '0'));

    IF p_agent_id IS NOT NULL THEN
        SELECT commission_rate, name INTO v_ag_pct, v_ag_name FROM agents WHERE id = p_agent_id;
    ELSE SET v_ag_pct = 0; SET v_ag_name = ''; END IF;

    INSERT INTO invoices (invoice_code, enrollment_id, base_price, discount_amount, final_price,
        agency_id, agency_name, agency_discount_percent, agency_discount_amount, status, created_by)
    VALUES (v_inv_code, v_enr_id, v_fee, IFNULL(p_discount_amount, 0), v_final,
        IFNULL(p_agent_id, ''), v_ag_name, v_ag_pct, ROUND(v_fee * v_ag_pct / 100, 0),
        'pending', p_created_by);

    IF p_plan_json IS NOT NULL THEN
        SET n = JSON_LENGTH(p_plan_json);
        WHILE i < n DO
            SET v_num = JSON_UNQUOTE(JSON_EXTRACT(p_plan_json, CONCAT('$[', i, '].installment_num')));
            SET v_title = JSON_UNQUOTE(JSON_EXTRACT(p_plan_json, CONCAT('$[', i, '].title')));
            SET v_due_amt = JSON_UNQUOTE(JSON_EXTRACT(p_plan_json, CONCAT('$[', i, '].amount_due')));
            SET v_due_date = JSON_UNQUOTE(JSON_EXTRACT(p_plan_json, CONCAT('$[', i, '].due_date')));
            INSERT INTO payment_schedules (enrollment_id, installment_num, title, amount_due, due_date)
            VALUES (v_enr_id, v_num, v_title, v_due_amt, v_due_date);
            SET i = i + 1;
        END WHILE;
    END IF;

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
    VALUES (p_created_by, 'create_enrollment', 'enrollment', v_enr_id,
        JSON_OBJECT('code', v_enr_code, 'student', p_student_id, 'course', p_course_id, 'final', v_final));

    COMMIT;
    SELECT v_enr_id AS enrollment_id, v_enr_code AS enrollment_code, v_inv_code AS invoice_code, v_final AS final_amount, 'OK' AS message;
END //

-- 5.4. Tạo phiếu thu
CREATE PROCEDURE sp_record_payment(
    IN p_enrollment_id BIGINT,
    IN p_amount DECIMAL(15,2),
    IN p_payment_method VARCHAR(20),
    IN p_transaction_ref VARCHAR(100),
    IN p_schedule_id BIGINT,
    IN p_collector_id BIGINT,
    IN p_submitted_by BIGINT,
    IN p_note TEXT
)
BEGIN
    DECLARE v_code VARCHAR(50);
    DECLARE v_seq INT;
    DECLARE v_pid BIGINT;
    DECLARE v_inv_id BIGINT;
    DECLARE v_rem DECIMAL(15,2);
    DECLARE v_fin DECIMAL(15,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lỗi tạo phiếu thu'; END;
    START TRANSACTION;

    SELECT remaining_amount, final_amount INTO v_rem, v_fin FROM enrollments WHERE id = p_enrollment_id;
    IF p_amount > v_rem AND v_fin > 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vượt quá số tiền còn nợ'; END IF;

    SELECT COUNT(*) + 1 INTO v_seq FROM payments WHERE YEAR(created_at) = YEAR(NOW());
    SET v_code = CONCAT('PT-', DATE_FORMAT(NOW(), '%Y'), '-', LPAD(v_seq, 5, '0'));
    SELECT id INTO v_inv_id FROM invoices WHERE enrollment_id = p_enrollment_id LIMIT 1;

    INSERT INTO payments (receipt_code, enrollment_id, invoice_id, payment_schedule_id,
        amount, payment_method, transaction_ref, collector_id, submitted_by, note, status)
    VALUES (v_code, p_enrollment_id, v_inv_id, p_schedule_id, p_amount, p_payment_method,
        p_transaction_ref, p_collector_id, p_submitted_by, p_note, 'pending');
    SET v_pid = LAST_INSERT_ID();

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
    VALUES (IFNULL(p_collector_id, p_submitted_by), 'record_payment', 'payment', v_pid,
        JSON_OBJECT('code', v_code, 'amount', p_amount, 'method', p_payment_method));

    COMMIT;
    SELECT v_pid AS payment_id, v_code AS receipt_code, 'OK' AS message;
END //

-- 5.5. Quyết toán hoa hồng đại lý
CREATE PROCEDURE sp_settle_commission(
    IN p_agent_id BIGINT,
    IN p_start DATE,
    IN p_end DATE,
    IN p_approved_by BIGINT
)
BEGIN
    DECLARE v_total DECIMAL(15,2);
    DECLARE v_rate DECIMAL(5,2);
    DECLARE v_comm DECIMAL(15,2);
    DECLARE v_code VARCHAR(50);
    DECLARE v_pid BIGINT;
    DECLARE v_seq INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lỗi quyết toán'; END;
    START TRANSACTION;

    SELECT COALESCE(SUM(cd.commission_amount), 0), COALESCE(SUM(cd.payment_amount), 0)
    INTO v_comm, v_total
    FROM commission_details cd JOIN payments p ON cd.payment_id = p.id
    WHERE cd.agent_id = p_agent_id AND cd.payout_id IS NULL AND p.status = 'approved'
      AND p.approved_at BETWEEN p_start AND CONCAT(p_end, ' 23:59:59');

    IF v_comm <= 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không có hoa hồng cần quyết toán'; END IF;

    SELECT commission_rate INTO v_rate FROM agents WHERE id = p_agent_id;
    SELECT COUNT(*) + 1 INTO v_seq FROM commission_payouts WHERE YEAR(created_at) = YEAR(NOW());
    SET v_code = CONCAT('PC-', DATE_FORMAT(NOW(), '%Y'), '-', LPAD(v_seq, 4, '0'));

    INSERT INTO commission_payouts (payout_code, agent_id, period_start, period_end,
        total_collected, commission_rate, commission_amount, status, approved_by)
    VALUES (v_code, p_agent_id, p_start, p_end, v_total, v_rate, v_comm, 'approved', p_approved_by);
    SET v_pid = LAST_INSERT_ID();

    UPDATE commission_details cd JOIN payments p ON cd.payment_id = p.id
    SET cd.payout_id = v_pid
    WHERE cd.agent_id = p_agent_id AND cd.payout_id IS NULL AND p.status = 'approved'
      AND p.approved_at BETWEEN p_start AND CONCAT(p_end, ' 23:59:59');

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
    VALUES (p_approved_by, 'settle_commission', 'commission', v_pid,
        JSON_OBJECT('code', v_code, 'agent', p_agent_id, 'period', CONCAT(p_start, '->', p_end), 'amount', v_comm));

    COMMIT;
    SELECT v_pid AS payout_id, v_code AS payout_code, v_total AS total_collected,
           v_rate AS commission_rate, v_comm AS commission_amount, 'OK' AS message;
END //

DELIMITER ;

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

CREATE VIEW v_student_debts AS
SELECT e.enrollment_code, u.full_name AS student_name, u.phone,
       c.name AS course_name, e.final_amount, e.paid_amount, e.remaining_amount,
       CASE WHEN e.payment_status = 'unpaid' THEN 'Chưa đóng'
            WHEN e.payment_status = 'partially_paid' THEN 'Đóng 1 phần'
            WHEN e.payment_status = 'exempt' THEN 'Miễn phí' END AS debt_status,
       COALESCE(s.full_name, 'N/A') AS sale_name, COALESCE(a.name, 'N/A') AS agent_name
FROM enrollments e
JOIN users u ON e.student_id = u.id
JOIN courses c ON e.course_id = c.id
LEFT JOIN users s ON e.sale_id = s.id
LEFT JOIN agents a ON e.agent_id = a.id
WHERE e.remaining_amount > 0 AND e.payment_status IN ('unpaid', 'partially_paid')
ORDER BY e.remaining_amount DESC;

CREATE VIEW v_revenue_report AS
SELECT DATE_FORMAT(p.payment_date, '%Y-%m') AS month,
       COUNT(*) AS txns, SUM(p.amount) AS revenue,
       SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) AS cash,
       SUM(CASE WHEN p.payment_method = 'bank_transfer' THEN p.amount ELSE 0 END) AS bank,
       SUM(CASE WHEN p.payment_method = 'qr_code' THEN p.amount ELSE 0 END) AS qr
FROM payments p WHERE p.status = 'approved'
GROUP BY month ORDER BY month DESC;

CREATE VIEW v_agency_commissions AS
SELECT a.agent_code, a.name AS agent_name, a.commission_rate,
       COUNT(DISTINCT cd.enrollment_id) AS student_count,
       COALESCE(SUM(cd.payment_amount), 0) AS total_collected,
       COALESCE(SUM(cd.commission_amount), 0) AS commission_earned,
       SUM(CASE WHEN cd.payout_id IS NULL THEN cd.commission_amount ELSE 0 END) AS unsettled,
       SUM(CASE WHEN cd.payout_id IS NOT NULL THEN cd.commission_amount ELSE 0 END) AS settled
FROM agents a
LEFT JOIN commission_details cd ON a.id = cd.agent_id
LEFT JOIN payments p ON cd.payment_id = p.id AND p.status = 'approved'
GROUP BY a.id ORDER BY commission_earned DESC;

-- ============================================================================
-- 7. SEED DATA
-- ============================================================================

INSERT INTO courses (code, name, tuition_fee, description) VALUES
('BANG_A', 'Đào tạo UAV Hạng A (VLOS)', 15000000, 'Chương trình UAV cơ bản - bay trong tầm nhìn'),
('BANG_B', 'Đào tạo UAV Hạng B — BVLOS', 25000000, 'Chương trình UAV nâng cao - bay ngoài tầm nhìn');

INSERT INTO users (user_code, full_name, email, phone, role, status) VALUES
('ADMIN-001', 'Quản trị viên', 'admin@smc-training.com', '0900000000', 'admin', 'active'),
('ACC-001', 'Kế toán trưởng', 'accountant@smc-training.com', '0900000001', 'accountant', 'active');
