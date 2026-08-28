-- SMC Training — Migration v10: hoa hồng đại lý tính trên GIÁ GỐC (đã áp dụng 28/08/2026)
-- Lý do: trước đây sp_approve_payment tính hoa hồng = số tiền đã nộp × tỷ lệ %.
-- Với học viên đại lý (đã chiết khấu), số đã nộp < giá gốc nên hoa hồng bị tính THIẾU.
-- Quy tắc đúng: hoa hồng = GIÁ GỐC (base_price) × tỷ lệ %, là SỐ NGUYÊN,
-- ghi MỘT lần khi học viên nộp ĐỦ (payment_status = fully_paid).
-- Đồng thời đã backfill lại toàn bộ commission_details.

DELIMITER //

DROP PROCEDURE IF EXISTS `sp_approve_payment`//

CREATE DEFINER=`smc46189_admin`@`%` PROCEDURE `sp_approve_payment`(
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
        DECLARE v_base_price DECIMAL(15,2);
        DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
        START TRANSACTION;
        SELECT enrollment_id, invoice_id, payment_schedule_id, amount INTO v_enrollment_id, v_invoice_id, v_schedule_id, v_amount FROM payments WHERE id = p_payment_id;
        SELECT paid_amount, final_amount, payment_status INTO v_current_paid, v_final_amount, v_old_status FROM enrollments WHERE id = v_enrollment_id;
        SET v_old_paid = v_current_paid;
        SET v_new_paid = v_current_paid + v_amount;
        IF v_new_paid <= 0 THEN SET v_payment_status = 'unpaid'; SET v_eligible = FALSE;
        ELSEIF v_new_paid >= v_final_amount THEN SET v_payment_status = 'fully_paid'; SET v_eligible = TRUE;
        ELSE SET v_payment_status = 'partially_paid'; SET v_eligible = FALSE;
        END IF;
        UPDATE payments SET status = 'approved', approved_by = p_approved_by, approved_at = NOW(), note = IF(p_note != '', CONCAT(IFNULL(note, ''), ' | ', p_note), note) WHERE id = p_payment_id;
        UPDATE enrollments SET paid_amount = v_new_paid, payment_status = v_payment_status, eligible_for_exam = v_eligible, updated_at = NOW() WHERE id = v_enrollment_id;
        IF v_invoice_id IS NOT NULL THEN
            UPDATE invoices SET total_paid = total_paid + v_amount, status = CASE WHEN total_paid + v_amount >= final_price THEN 'paid' WHEN total_paid + v_amount > 0 THEN 'partial' ELSE 'pending' END, updated_at = NOW() WHERE id = v_invoice_id;
        END IF;
        IF v_schedule_id IS NOT NULL THEN
            UPDATE payment_schedules SET amount_paid = amount_paid + v_amount, status = CASE WHEN amount_paid + v_amount >= amount_due THEN 'completed' WHEN amount_paid + v_amount > 0 THEN 'partially_paid' ELSE 'pending' END, updated_at = NOW() WHERE id = v_schedule_id;
        END IF;
        SELECT agent_id INTO v_agent_id FROM enrollments WHERE id = v_enrollment_id;
        IF v_agent_id IS NULL AND v_invoice_id IS NOT NULL THEN
            SELECT CAST(agency_id AS UNSIGNED) INTO v_agent_id FROM invoices WHERE id = v_invoice_id AND agency_id <> '' AND agency_id IS NOT NULL AND agency_id REGEXP '^[0-9]+$' LIMIT 1;
        END IF;
        IF v_agent_id IS NOT NULL THEN
            SELECT commission_rate INTO v_commission_rate FROM agents WHERE id = v_agent_id;
            SET v_base_price = 0;
            IF v_invoice_id IS NOT NULL THEN
                SELECT base_price INTO v_base_price FROM invoices WHERE id = v_invoice_id;
            END IF;
            IF v_base_price <= 0 THEN SET v_base_price = v_final_amount; END IF;
            IF v_new_paid >= v_final_amount AND v_base_price > 0 THEN
                SET v_commission_amount = ROUND(v_base_price * v_commission_rate / 100, 0);
                INSERT INTO commission_details (agent_id, payment_id, enrollment_id, payment_amount, commission_rate, commission_amount, period) VALUES (v_agent_id, p_payment_id, v_enrollment_id, v_amount, v_commission_rate, v_commission_amount, DATE_FORMAT(NOW(), '%Y-%m'));
            END IF;
        END IF;
        INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (p_approved_by, 'approve_payment', 'payment', p_payment_id, JSON_OBJECT('paid_amount', v_old_paid, 'status', v_old_status), JSON_OBJECT('paid_amount', v_new_paid, 'status', v_payment_status, 'exam_ok', v_eligible));
        COMMIT;
        SELECT v_enrollment_id AS enrollment_id, v_new_paid AS new_paid_amount, v_final_amount AS final_amount, v_payment_status AS payment_status, v_eligible AS eligible_for_exam, 'OK' AS message;
    END//

DELIMITER ;
