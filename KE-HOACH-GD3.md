# Kế Hoạch Giai Đoạn 3 — SMC Training

**Ngày:** 10/08/2026 | **Trạng thái:** GĐ1 ✅ GĐ2 ✅ → Bắt đầu GĐ3

---

## Tóm tắt GĐ1 & GĐ2

| Giai đoạn | Kết quả |
|-----------|---------|
| GĐ1 | ✅ Môi trường dev, login, dashboard Admin hoạt động |
| GĐ2 | ✅ 8/10 trang Admin test OK, sửa lỗi agencies, build 732KB |

**Đã test:** Admin (dashboard, users, courses, classes, tuition, reports, exams, certificates) + Staff (dashboard)
**Chưa test:** Student, Teacher, Agency, Accountant

---

## GĐ3: TEST & HOÀN THIỆN CÁC ROLE CÒN LẠI (2-3 tuần)

### Mục tiêu
Từng role phải đăng nhập được, xem đúng dữ liệu, thao tác được các chức năng chính.

---

## TUẦN 1: STUDENT (14 trang) — 🔴 ƯU TIÊN CAO NHẤT

Học viên là đối tượng sử dụng chính. Cần test kỹ.

| # | Trang | Route | Cần kiểm tra |
|---|-------|-------|--------------|
| 3.1 | **Dashboard** | `/student` | Hiển thị khóa học đã đăng ký, tiến độ, thông báo |
| 3.2 | **Lớp học của tôi** | `/student/lop-hoc` | Danh sách lớp, giáo viên, lịch học |
| 3.3 | **Tài liệu học** | `/student/tai-lieu` | Xem PDF tài liệu trong `/tai-lieu/` |
| 3.4 | **Ôn luyện** | `/student/on-luyen` | Câu hỏi trắc nghiệm từ question-bank |
| 3.5 | **Luyện thi** | `/student/luyen-thi` | Danh sách bộ đề, chọn đề để thi |
| 3.6 | **Làm bài thi** | `/student/luyen-thi/:id` | Giao diện thi: câu hỏi, đồng hồ, nộp bài |
| 3.7 | **Kết quả thi** | `/student/ket-qua/:id` | Xem điểm, đáp án đúng/sai |
| 3.8 | **Lịch sử thi** | `/student/lich-su-thi` | Danh sách các lần thi đã làm |
| 3.9 | **Ôn luyện vấn đáp** | `/student/on-luyen-van-dap` | Câu hỏi vấn đáp từ oral-questions.json |
| 3.10 | **Kiểm tra** | `/student/kiem-tra` | Bài kiểm tra giữa kỳ |
| 3.11 | **Nhật ký bay** | `/student/nhat-ky-bay` | Danh sách giờ bay, tiến độ thực hành |
| 3.12 | **Chứng chỉ** | `/student/chung-chi` | Xem chứng chỉ (nếu đã được cấp) |
| 3.13 | **Học phí** | `/student/hoc-phi` | Xem hóa đơn, lịch sử thanh toán, số tiền còn nợ |
| 3.14 | **Hồ sơ** | `/student/ho-so` | Xem/sửa thông tin cá nhân |

**Dữ liệu test:** Email học viên thật + password `123456`

---

## TUẦN 2: TEACHER (13 trang) + AGENCY (5 trang)

### Teacher

| # | Trang | Route | Cần kiểm tra |
|---|-------|-------|--------------|
| 3.15 | **Dashboard** | `/teacher` | Lớp đang dạy, số học viên, lịch dạy |
| 3.16 | **Lớp học** | `/teacher/lop-hoc` | Danh sách lớp được phân công |
| 3.17 | **Học viên** | `/teacher/hoc-vien` | Danh sách học viên trong lớp |
| 3.18 | **Tài liệu** | `/teacher/tai-lieu` | Upload/xem tài liệu giảng dạy |
| 3.19 | **Bài giảng** | `/teacher/bai-giang` | Quản lý bài giảng |
| 3.20 | **Giáo án** | `/teacher/giao-an` | Soạn giáo án |
| 3.21 | **Giáo trình** | `/teacher/giao-trinh` | Quản lý giáo trình |
| 3.22 | **Thuyết trình** | `/teacher/thuyet-trinh` | Slide bài giảng |
| 3.23 | **Kiểm tra** | `/teacher/kiem-tra` | Tạo đề kiểm tra |
| 3.24 | **Nhật ký bay** | `/teacher/nhat-ky-bay` | Xem & cập nhật nhật ký bay học viên |
| 3.25 | **Sát hạch** | `/teacher/sat-hach` | Chấm thi, nhập điểm |
| 3.26 | **Lịch dạy** | `/teacher/lich-day` | Lịch giảng dạy |
| 3.27 | **Quản lý file** | `/teacher/files` | Upload file (FileManager) |

### Agency

| # | Trang | Route | Cần kiểm tra |
|---|-------|-------|--------------|
| 3.28 | **Dashboard** | `/agency` | Học viên của đại lý, hoa hồng |
| 3.29 | **Học viên** | `/agency/students` | Danh sách học viên do đại lý giới thiệu |
| 3.30 | **Báo cáo** | `/agency/report` | Báo cáo hoa hồng, doanh thu |
| 3.31 | **Import học viên** | `/agency/import` | Upload CSV import học viên |
| 3.32 | **Hồ sơ** | `/agency/profile` | Thông tin đại lý |

---

## TUẦN 3: ACCOUNTANT (6 trang) + PUBLIC + DEPLOY

### Accountant

| # | Trang | Route | Cần kiểm tra |
|---|-------|-------|--------------|
| 3.33 | **Dashboard** | `/accountant` | Tổng quan tài chính |
| 3.34 | **Duyệt thanh toán** | `/accountant/approvals` | Duyệt phiếu thu, xác nhận thanh toán |
| 3.35 | **Sổ quỹ** | `/accountant/cash-ledger` | Thu/chi tiền mặt |
| 3.36 | **Báo cáo** | `/accountant/reports` | Báo cáo tài chính |
| 3.37 | **Học phí** | `/accountant/tuition` | Quản lý học phí góc nhìn kế toán |
| 3.38 | **Đại lý** | `/accountant/agencies` | Hoa hồng đại lý |

### Public

| # | Trang | Route | Cần kiểm tra |
|---|-------|-------|--------------|
| 3.39 | **Tra cứu chứng chỉ** | `/tra-cuu` | Nhập mã số/CCCD → hiện chứng chỉ |
| 3.40 | **Trang chủ** | `/` | Landing page responsive |
| 3.41 | **Đăng ký online** | `/register` | Form đăng ký → API registrations |

### Deploy & Tối ưu

| # | Công việc |
|---|-----------|
| 3.42 | **Dọn assets cũ** trên hosting (~70 file build cũ, ~44MB) |
| 3.43 | **Build production** — `npm run build` |
| 3.44 | **Upload lên hosting** — qua FTP, thay thế frontend cũ |
| 3.45 | **Test production** — đăng nhập, kiểm tra các chức năng chính |
| 3.46 | **Code splitting** — giảm bundle 732KB bằng lazy loading |

---

## LỖI ĐÃ BIẾT CẦN SỬA TRONG GĐ3

| # | Lỗi | Ai sửa |
|---|-----|--------|
| 🔴 | Một số tên hiển thị không dấu ("Quan ly Dai ly", "Bao cao Tai chinh") | Dev React |
| 🟡 | Header vẫn hiện "Admin Dashboard" khi vào role khác | Dev React |
| 🟡 | API 500 errors từ backend (cần kiểm tra PHP error log) | Dev Backend |
| 🟢 | Bundle JS 732KB — code splitting | Dev React |

---

## TÓM TẮT CHO ANH

| Tuần | Việc | Ai làm |
|-------|------|--------|
| **Tuần 1** | Test 14 trang Student — quan trọng nhất vì là học viên | Dev React test, tôi hỗ trợ |
| **Tuần 2** | Test 13 trang Teacher + 5 trang Agency | Dev React test |
| **Tuần 3** | Test Accountant + Public + Deploy lên production | Dev React deploy |

**Sau GĐ3:** Hệ thống hoàn chỉnh, thay thế frontend cũ đang bị lỗi trên smc-training.com.

---

## VIỆC DEV REACT CẦN LÀM NGAY

1. **Lấy token Student** — đăng nhập bằng 1 email học viên thật trong users.json + password `123456`
2. **Vào `/student`** → kiểm tra dashboard có hiện khóa học không
3. **Vào `/student/luyen-thi`** → kiểm tra có hiện danh sách bộ đề không
4. **Báo cáo lỗi** → tôi sẽ giúp debug API hoặc sửa code
