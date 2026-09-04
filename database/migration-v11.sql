-- ============================================================================
-- SMC Training — Migration v11: Đồng bộ "học viên thuộc lớp nào"
-- ============================================================================
-- VẤN ĐỀ: việc xếp lớp chỉ được lưu ở classes.student_ids (JSON),
-- trong khi các trang danh mục lại đọc enrollment.class_id (cột chưa tồn tại)
-- → học viên đã xếp lớp vẫn hiển thị "Chưa xếp lớp".
--
-- GIẢI PHÁP: thêm cột class_id vào enrollments làm nguồn chính xác duy nhất,
-- rồi backfill từ classes.student_ids cho dữ liệu hiện có.
-- ============================================================================

-- 1. Thêm cột class_id (khóa ngoại tới classes)
ALTER TABLE enrollments
  ADD COLUMN class_id BIGINT NULL AFTER course_id;

ALTER TABLE enrollments
  ADD INDEX idx_enr_class (class_id);

ALTER TABLE enrollments
  ADD CONSTRAINT fk_enr_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- 2. Backfill class_id từ classes.student_ids
-- Lưu ý: nếu một học viên nằm trong nhiều lớp (dữ liệu lỗi), câu lệnh sẽ gán một lớp.
-- Học viên chưa xếp lớp (không nằm trong student_ids của lớp nào) sẽ có class_id = NULL.
UPDATE enrollments e
JOIN classes c ON JSON_CONTAINS(c.student_ids, CONCAT('"', e.student_id, '"'))
SET e.class_id = c.id;

-- 3. (Tùy chọn) Kiểm tra học viên còn "chưa xếp lớp" sau backfill:
-- SELECT e.id, e.enrollment_code, u.full_name, u.phone
-- FROM enrollments e JOIN users u ON e.student_id = u.id
-- WHERE e.class_id IS NULL AND u.role = 'student';
