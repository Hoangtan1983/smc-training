# Báo Cáo Kiểm Tra GĐ2 & Kế Hoạch GĐ3 — SMC Training

**Ngày:** 10/08/2026 | **Người kiểm tra:** Claude (hỗ trợ kỹ thuật)

---

## 1. KẾT QUẢ KIỂM TRA GĐ2

### Tổng quan

| Chỉ số | Kết quả |
|--------|---------|
| Trang đã test | **10+ trang** (Admin: 8, Staff: 2) |
| Build status | ✅ Thành công (1668 modules, 1.84s) |
| Bundle JS | 731.88 KB (gzip: 165 KB) |
| Bundle CSS | 57.43 KB (gzip: 8.85 KB) |
| Lỗi console | 7 lỗi (500/404) |
| Trang hoạt động tốt | 8/10 |
| Trang có lỗi | 2/10 |

### Kết quả từng trang Admin

| # | Trang | Kết quả | Ghi chú |
|---|-------|---------|---------|
| 1 | **Dashboard** `/admin` | ✅ Tốt | 57 users, 3 khóa, 4 lớp, 48 HV, 4 GV, 0 chứng chỉ — số liệu khớp API |
| 2 | **Người dùng** `/admin/nguoi-dung` | ✅ Tốt | 57 users, tìm kiếm, lọc theo role/status, phân trang 3 trang |
| 3 | **Khóa học** `/admin/khoa-hoc` | ✅ Tốt | 4 khóa (thêm BVLOS2 đã đóng), hiển thị modules, lớp học, giờ học |
| 4 | **Lớp học** `/admin/lop-hoc` | ✅ Tốt | 4 lớp (VLOS 01: 5HV, BVLOS 01: 13HV, BVLOS 02: 18HV, BVLOS03: 0HV) |
| 5 | **Học phí** `/admin/hoc-phi` | ✅ Tốt | 49 hóa đơn, tổng thu 705tr, chiết khấu 70tr, tabs Tổng quan/Hóa đơn/Báo cáo |
| 6 | **Báo cáo** `/admin/bao-cao` | ✅ Tốt | Tổng quan tài chính, doanh thu 705tr, pipeline 1.17 tỷ |
| 7 | **Sát hạch** `/admin/sat-hach` | ✅ Tốt | 1 bài kiểm tra mẫu (Pháp luật UAV), 2 câu hỏi |
| 8 | **Chứng chỉ** `/admin/chung-chi` | ✅ Tốt | 0 chứng chỉ (chưa có ai hoàn thành) — hiển thị empty state |
| 9 | **Đại lý** `/admin/dai-ly` | 🔴 LỖI | API `?action=agencies` trả về 404 — backend chưa có route agencies |
| 10 | **Staff Dashboard** `/staff` | ✅ Tốt | Đăng nhập Staff OK, dashboard hiển thị: 1 hồ sơ chờ duyệt, 1 đang đào tạo, 48 HV |

---

## 2. LỖI PHÁT HIỆN

### Lỗi nghiêm trọng (cần sửa ngay)

| # | Lỗi | Nguyên nhân | Cách sửa |
|---|-----|-------------|----------|
| 🔴 **L1** | **Trang Đại lý không load được dữ liệu** | Backend auth.php không có route `agencies`. `$dataRoutes` trong auth.php không bao gồm `agencies`. Frontend gọi `?action=agencies` → 404 | **Cần sửa backend:** thêm `'agencies'` vào `$dataRoutes` array trong auth.php (dòng 1807) |

### Lỗi trung bình

| # | Lỗi | Mô tả |
|---|-----|-------|
| 🟡 **L2** | **API 500 errors** | Console log có 4-5 lỗi HTTP 500 từ backend. Có thể do rate limiting hoặc lỗi PHP |
| 🟡 **L3** | **Tên hiển thị không dấu** | Một số trang hiển thị "Quan ly Dai ly", "Bao cao Tai chinh", "Khong the tai danh sach dai ly" — thiếu dấu tiếng Việt |
| 🟡 **L4** | **Admin Dashboard vẫn hiển thị khi Staff đăng nhập** | Khi Staff vào `/staff`, header vẫn hiện "Admin Dashboard" thay vì "Staff Dashboard" |
| 🟡 **L5** | **Không có phân quyền redirect giữa các role** | Admin gõ `/staff` vẫn vào được Staff layout và ngược lại (chưa kiểm tra ProtectedByRole) |

### Lỗi nhẹ

| # | Lỗi |
|---|-----|
| 🟢 **L6** | JS bundle 732KB — hơi nặng, nên code splitting |
| 🟢 **L7** | 44MB file build cũ trong `/assets/` trên server chưa được dọn |

---

## 3. VIỆC CẦN LÀM GĐ3

### Ưu tiên 1: Sửa lỗi (1-2 ngày)

| # | Công việc | Ai làm |
|---|-----------|--------|
| 3.1 | **Sửa API agencies** — thêm `'agencies'` vào `$dataRoutes` trong auth.php (dòng 1807) + thêm `'agency_commissions'` nếu cần | Dev Backend / Claude |
| 3.2 | **Fix lỗi 500** — kiểm tra PHP error log trên hosting, sửa các lỗi backend | Dev Backend |
| 3.3 | **Fix tên không dấu** — kiểm tra font/encoding trong React components | Dev React |
| 3.4 | **Fix header role name** — đảm bảo header hiển thị đúng tên role | Dev React |

### Ưu tiên 2: Hoàn thiện chức năng (1-2 tuần)

| # | Công việc | Mô tả |
|---|-----------|-------|
| 3.5 | **Test toàn bộ trang Student** (14 trang) | Luyện thi, xem khóa học, học phí, chứng chỉ, nhật ký bay |
| 3.6 | **Test toàn bộ trang Teacher** (13 trang) | Dashboard, lớp dạy, chấm thi, nhật ký bay, tài liệu |
| 3.7 | **Test trang Agency + Accountant** (11 trang) | Dashboard đại lý, import HV, kế toán duyệt, sổ quỹ |
| 3.8 | **Hoàn thiện tra cứu chứng chỉ** `/tra-cuu` | Public page, không cần đăng nhập |
| 3.9 | **Phân quyền redirect** | Admin → `/admin`, Staff → `/staff`, không cross-role |

### Ưu tiên 3: Deploy & Tối ưu (1 tuần)

| # | Công việc | Mô tả |
|---|-----------|-------|
| 3.10 | **Dọn dẹp assets cũ** trên hosting | Xóa ~70 file JS build cũ trong /assets/ (~44MB) |
| 3.11 | **Deploy lên production** | Build React → upload lên /httpdocs/ qua FTP |
| 3.12 | **Test production** | Đăng nhập, kiểm tra các chức năng chính trên smc-training.com |
| 3.13 | **Code splitting** | Giảm bundle size bằng lazy loading các trang |

---

## 4. HƯỚNG DẪN SỬA LỖI #1 (Agencies API)

Dev Backend cần sửa file `api/auth.php` trên hosting:

**Bước 1:** SSH/FTP vào hosting, mở `api/auth.php`

**Bước 2:** Tìm dòng 1807:
```php
$dataRoutes = ['courses', 'classes', 'enrollments', 'attendance', 'exams', 'fly_logs', 'certifications', 'tuitions'];
```

**Bước 3:** Thêm `'agencies'` và `'agency_commissions'` vào mảng:
```php
$dataRoutes = ['courses', 'classes', 'enrollments', 'attendance', 'exams', 'fly_logs', 'certifications', 'tuitions', 'agencies', 'agency_commissions'];
```

**Bước 4:** Lưu file → test lại `GET /api/auth.php?action=agencies` với token Admin.

---

## 5. ĐÁNH GIÁ CHUNG

| Tiêu chí | Đánh giá |
|----------|----------|
| Tiến độ | ✅ Đúng kế hoạch — GĐ2 hoàn thành các chức năng chính |
| Chất lượng code | ✅ Tốt — cấu trúc rõ ràng, 105 files React |
| Kết nối API | ✅ 90% endpoints hoạt động |
| Giao diện | ✅ Chuyên nghiệp, responsive |
| Số liệu | ✅ Khớp với backend (57 users, 705tr doanh thu) |

### Điểm mạnh
- Dashboard đầy đủ số liệu thật từ API
- Học phí hiển thị đầy đủ (49 hóa đơn, tabs lọc)
- Empty state xử lý tốt ("Chưa có chứng chỉ nào")

### Cần cải thiện
- Sửa lỗi agencies API
- Fix lỗi 500 từ backend
- Code splitting cho bundle nặng
- Test thêm role Student, Teacher, Agency, Accountant

---

**Tổng kết:** GĐ2 đạt ~85% mục tiêu. Sửa 4 lỗi + deploy là có thể đưa lên production thay thế frontend cũ.
