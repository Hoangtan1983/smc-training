-- SMC Training — Migration v7: bảng bài viết / tin tức / sự kiện / trang tĩnh
-- Chạy một lần trên production (phpMyAdmin) trước khi dùng tính năng "Bài viết".

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    type VARCHAR(20) NOT NULL DEFAULT 'article',      -- article | event | page
    page_key VARCHAR(100) DEFAULT NULL,                -- slug trang tĩnh: gioi-thieu, lich-thi
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) DEFAULT NULL,                    -- URL thân thiện
    excerpt VARCHAR(1000) DEFAULT NULL,                -- mô tả ngắn cho danh sách
    content MEDIUMTEXT,                                -- HTML đã qua vệ sinh
    cover_image VARCHAR(1000) DEFAULT NULL,            -- URL ảnh bìa
    status VARCHAR(20) NOT NULL DEFAULT 'draft',       -- draft | published
    event_date DATE DEFAULT NULL,                      -- cho loại event
    author_id BIGINT DEFAULT NULL,
    author_name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_posts_type (type),
    INDEX idx_posts_slug (slug),
    INDEX idx_posts_page (page_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
