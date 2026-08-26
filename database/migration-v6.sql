-- ============================================================================
-- SMC Training — Migration v6: JSON → MySQL Complete
-- Tạo 11 bảng cho các domain còn thiếu trong schema v2
-- ============================================================================

-- 1. Lớp học (classes)
CREATE TABLE IF NOT EXISTS classes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    class_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    course_id BIGINT NOT NULL,
    teacher_id BIGINT NULL,
    max_students INT DEFAULT 20,
    start_date DATE,
    end_date DATE,
    schedule JSON,
    location VARCHAR(255),
    type VARCHAR(50) DEFAULT 'offline',
    student_ids JSON,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cls_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_cls_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cls_course (course_id),
    INDEX idx_cls_status (status)
) ENGINE=InnoDB;

-- 2. Kỳ thi (exams)
CREATE TABLE IF NOT EXISTS exams (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    exam_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    course_id BIGINT,
    rank_group VARCHAR(50),
    total_questions INT DEFAULT 0,
    time_limit INT DEFAULT 30 COMMENT 'Thời gian thi (phút)',
    pass_score INT DEFAULT 70,
    questions JSON COMMENT 'Danh sách câu hỏi [{id, question, options, answer, type}]',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_exam_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    INDEX idx_exam_course (course_id),
    INDEX idx_exam_rank (rank_group)
) ENGINE=InnoDB;

-- 3. Kết quả thi (exam_results)
CREATE TABLE IF NOT EXISTS exam_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    exam_id BIGINT,
    exam_type VARCHAR(100),
    exam_number VARCHAR(50),
    exam_date TIMESTAMP NULL,
    total_questions INT DEFAULT 0,
    answered INT DEFAULT 0,
    correct INT DEFAULT 0,
    score DECIMAL(5,2),
    passed BOOLEAN DEFAULT FALSE,
    duration_minutes INT DEFAULT 0,
    questions JSON COMMENT 'Danh sách câu hỏi kèm câu trả lời của học viên',
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_er_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_er_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
    INDEX idx_er_student (student_id),
    INDEX idx_er_exam (exam_id),
    INDEX idx_er_passed (passed),
    INDEX idx_er_date (exam_date)
) ENGINE=InnoDB;

-- 4. Điểm danh (attendance)
CREATE TABLE IF NOT EXISTS attendance (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    class_id BIGINT,
    attendance_date DATE NOT NULL,
    status ENUM('present','absent','late','excused') DEFAULT 'present',
    logged_by BIGINT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    CONSTRAINT fk_att_logger FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_att_student (student_id),
    INDEX idx_att_class (class_id),
    INDEX idx_att_date (attendance_date),
    UNIQUE KEY uk_attendance (student_id, class_id, attendance_date)
) ENGINE=InnoDB;

-- 5. Chứng chỉ (certifications)
CREATE TABLE IF NOT EXISTS certifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cert_code VARCHAR(50) UNIQUE,
    student_id BIGINT NOT NULL,
    enrollment_id BIGINT,
    course_name VARCHAR(255),
    rank_group VARCHAR(50),
    issued_date DATE,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'issued',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cert_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cert_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
    INDEX idx_cert_student (student_id),
    INDEX idx_cert_code (cert_code),
    INDEX idx_cert_status (status)
) ENGINE=InnoDB;

-- 6. Nhật ký bay (fly_logs)
CREATE TABLE IF NOT EXISTS fly_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    class_id BIGINT,
    flight_date DATE NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    uav_model VARCHAR(100),
    location VARCHAR(255),
    weather VARCHAR(255),
    instructor VARCHAR(255),
    notes TEXT,
    logged_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fl_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fl_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    CONSTRAINT fk_fl_logger FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_fl_student (student_id),
    INDEX idx_fl_date (flight_date),
    INDEX idx_fl_class (class_id)
) ENGINE=InnoDB;

-- 7. Yêu cầu thay đổi (change_requests)
CREATE TABLE IF NOT EXISTS change_requests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    student_name VARCHAR(255),
    request_type VARCHAR(50) NOT NULL COMMENT 'change_class, change_course, update_info, other',
    from_class_id BIGINT,
    to_class_id BIGINT,
    from_value VARCHAR(255),
    to_value VARCHAR(255),
    reason TEXT,
    amount DECIMAL(15,2) DEFAULT 0.00,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_by VARCHAR(100),
    reviewed_by BIGINT,
    review_note TEXT,
    history JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cr_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cr_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cr_student (student_id),
    INDEX idx_cr_status (status),
    INDEX idx_cr_type (request_type)
) ENGINE=InnoDB;

-- 8. Ngân hàng câu hỏi (question_bank)
CREATE TABLE IF NOT EXISTS question_bank (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    question_code VARCHAR(50) UNIQUE,
    question_text TEXT NOT NULL,
    options JSON NOT NULL COMMENT 'Mảng các lựa chọn',
    correct_answer INT NOT NULL COMMENT 'Index của đáp án đúng (0-based)',
    question_type VARCHAR(50) DEFAULT 'true_false',
    module_id VARCHAR(20),
    module_name VARCHAR(255),
    category VARCHAR(100),
    difficulty VARCHAR(50),
    rank_group VARCHAR(50) COMMENT 'Hạng A, Hạng B, hoặc Cả A và B',
    course_id BIGINT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_qb_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    INDEX idx_qb_module (module_id),
    INDEX idx_qb_rank (rank_group),
    INDEX idx_qb_difficulty (difficulty),
    INDEX idx_qb_category (category)
) ENGINE=InnoDB;

-- 9. Nhật ký email (email_log)
CREATE TABLE IF NOT EXISTS email_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT,
    status ENUM('pending','sent','failed') DEFAULT 'pending',
    error_message TEXT,
    student_id BIGINT,
    triggered_by VARCHAR(100),
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_el_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_el_email (recipient_email),
    INDEX idx_el_status (status),
    INDEX idx_el_created (created_at)
) ENGINE=InnoDB;

-- 10. File tải lên (uploaded_files)
CREATE TABLE IF NOT EXISTS uploaded_files (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500),
    stored_path VARCHAR(1000) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    mime_type VARCHAR(100),
    size_bytes BIGINT DEFAULT 0,
    category VARCHAR(100),
    uploaded_by BIGINT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uf_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_uf_category (category),
    INDEX idx_uf_user (uploaded_by)
) ENGINE=InnoDB;

-- 11. Đặt lại mật khẩu (password_resets)
CREATE TABLE IF NOT EXISTS password_resets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash của token',
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pr_email (email),
    INDEX idx_pr_token (token_hash(64)),
    INDEX idx_pr_expires (expires_at)
) ENGINE=InnoDB;
