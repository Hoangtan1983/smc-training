# Kế Hoạch Giai Đoạn 2 — SMC Training

**Ngày:** 10/08/2026 | **Trạng thái:** GĐ1 ✅ Hoàn thành → Bắt đầu GĐ2

---

## GĐ1 — ĐÃ HOÀN THÀNH ✅

| Hạng mục | Kết quả |
|----------|---------|
| Môi trường dev | ✅ Vite + React chạy, proxy /api → production |
| Build | ✅ Thành công (1673 modules, ~1 phút 44 giây) |
| Source code | ✅ 105 file (.jsx/.js), 66 pages, đầy đủ 6 role |
| Login/Register | ✅ Hoạt động với API thật |
| Admin Dashboard | ✅ Hiển thị số liệu (57 users, 3 khóa, 4 lớp...) |
| GitHub | ✅ Code React đã push lên repo |

---

## Hiện trạng code GĐ1

### Đã có (66 pages)

| Role | Số trang | Trạng thái |
|------|----------|------------|
| Admin | 14 | Cơ bản hoạt động |
| Staff | 15 | Cần kiểm tra |
| Teacher | 12 | Cần kiểm tra |
| Student | 14 | Cần kiểm tra |
| Agency | 5 | Cần kiểm tra |
| Accountant | 6 | Cần kiểm tra |
| Public | 5 | Có (Home, About, Gallery, ExamSchedule, CertLookup) |

### API integration
- File `src/data/api.js`: Đã kết nối đầy đủ với API backend qua `?action=` parameter
- 55+ API path mappings đã định nghĩa
- Token JWT lưu trong localStorage (`smc-token`)

---

## GĐ2: KIỂM TRA & HOÀN THIỆN CHỨC NĂNG (2-3 tuần)

### Mục tiêu
Từng trang cho từng role phải hoạt động thật với dữ liệu thật từ API.

### Tuần 1: Admin + Staff

| # | Công việc | Ưu tiên | Mô tả | Cách kiểm tra |
|---|-----------|---------|-------|---------------|
| 2.1 | **Admin - Quản lý người dùng** `/admin/nguoi-dung` | 🔴 Cao | Hiển thị danh sách 57 users, tìm kiếm, thêm/sửa/xóa | Tạo user mới → hiện trong danh sách → sửa → xóa |
| 2.2 | **Admin - Quản lý khóa học** `/admin/khoa-hoc` | 🔴 Cao | CRUD khóa học + modules. Hiện có 3 khóa VLOS, BVLOS | Thêm khóa mới → sửa giá → xóa |
| 2.3 | **Admin - Quản lý lớp học** `/admin/lop-hoc` | 🔴 Cao | Tạo lớp, gán giáo viên, thêm học viên vào lớp | Tạo lớp mới → gán giáo viên → thêm 3 học viên |
| 2.4 | **Admin - Quản lý học viên** `/admin/hoc-vien` | 🔴 Cao | Danh sách học viên, trạng thái, khóa học | Xem danh sách 48 học viên → lọc theo khóa |
| 2.5 | **Admin - Quản lý giáo viên** `/admin/giang-vien` | 🟡 TB | Danh sách giáo viên, phân công lớp | Xem 4 giáo viên → gán vào lớp |
| 2.6 | **Admin - Học phí** `/admin/hoc-phi` | 🔴 Cao | Dashboard học phí, invoices, thanh toán | Xem danh sách invoices → thêm khoản thu |
| 2.7 | **Admin - Tuyển sinh** `/admin/tuyen-sinh` | 🟡 TB | Duyệt đơn đăng ký mới, gán khóa học | Duyệt 1 đơn đăng ký → user chuyển ACTIVE |
| 2.8 | **Staff - Dashboard + Duyệt** `/staff/*` | 🔴 Cao | Staff có đủ quyền: duyệt tk, xem học phí, quản lý học viên | Đăng nhập Staff → kiểm tra từng menu |

### Tuần 2: Teacher + Student

| # | Công việc | Ưu tiên | Mô tả |
|---|-----------|---------|-------|
| 2.9 | **Teacher - Dashboard** `/teacher/*` | 🔴 Cao | Xem lớp dạy, học viên, lịch dạy |
| 2.10 | **Teacher - Nhật ký bay** `/teacher/nhat-ky-bay` | 🟡 TB | Xem & cập nhật nhật ký bay học viên |
| 2.11 | **Teacher - Chấm thi** `/teacher/sat-hach` | 🟡 TB | Xem bài thi, chấm điểm |
| 2.12 | **Student - Khóa học của tôi** `/student/lop-hoc` | 🔴 Cao | Học viên xem lớp đã đăng ký, tiến độ |
| 2.13 | **Student - Luyện thi** `/student/luyen-thi` | 🔴 Cao | Làm bài thi trắc nghiệm, xem kết quả |
| 2.14 | **Student - Ôn luyện vấn đáp** `/student/on-luyen-van-dap` | 🟡 TB | Dùng oral-questions.json |
| 2.15 | **Student - Học phí** `/student/hoc-phi` | 🟡 TB | Xem học phí, lịch sử thanh toán |
| 2.16 | **Student - Chứng chỉ** `/student/chung-chi` | 🟡 TB | Xem chứng chỉ (nếu đã có) |

### Tuần 3: Agency + Accountant + Public

| # | Công việc | Ưu tiên | Mô tả |
|---|-----------|---------|-------|
| 2.17 | **Agency - Dashboard** `/agency/*` | 🟡 TB | Đại lý xem học viên, hoa hồng, báo cáo |
| 2.18 | **Agency - Import học viên** | 🟢 Thấp | Upload CSV import học viên |
| 2.19 | **Accountant - Dashboard** `/accountant/*` | 🟡 TB | Kế toán duyệt thanh toán, sổ quỹ |
| 2.20 | **Public - Tra cứu chứng chỉ** `/tra-cuu` | 🔴 Cao | Không cần đăng nhập, tra theo mã số |
| 2.21 | **Public - Trang chủ** `/` | 🟡 TB | Landing page giới thiệu trung tâm |

---

## GĐ3: E-LEARNING & HOÀN THIỆN (3-4 tuần) — Làm sau GĐ2

| # | Công việc | Mô tả |
|---|-----------|-------|
| 3.1 | **Bài giảng online** — upload video, hiển thị trong Student | Backend: thêm API upload/view |
| 3.2 | **Thi thử tự động** — ngân hàng câu hỏi, random đề, chấm điểm tự động | Backend đã có question-bank, exams API |
| 3.3 | **Chứng chỉ PDF** — tự động sinh PDF khi hoàn thành | Cần tích hợp thư viện tạo PDF |
| 3.4 | **Email thông báo** — gửi email khi duyệt tk, khi đỗ, nhắc lịch học | Backend có email-helper.php |
| 3.5 | **Tối ưu hiệu năng** — code splitting, lazy loading | Giảm bundle size từ 2.2MB |
| 3.6 | **Deploy lên production** — thay thế frontend cũ | Build + upload qua FTP |

---

## Danh sách lỗi tiềm năng cần dev kiểm tra ngay

1. **Import thiếu**: App.jsx import `StaffEnrollment`, `StaffStudents`, `StaffTeachers`, `StaffReports`, `StaffPayments`, `StudentPayment` nhưng file không tồn tại trong thư mục tương ứng → sẽ gây lỗi build
2. **Route `/student/hoc-phi`**: App.jsx có route nhưng chưa thấy file `StudentPayment.jsx` trong pages/student/
3. **Teacher pages thiếu import**: `TeacherPresentations`, `TeacherLectures`, `TeacherLessonPlans`, `TeacherSyllabus` — cần kiểm tra file có tồn tại không

---

## Hướng dẫn dev kiểm tra GĐ2

### Cách test 1 trang:
```
1. Mở browser → http://localhost:3000
2. Đăng nhập với tài khoản test
3. Bấm vào từng menu bên sidebar
4. Kiểm tra:
   - Có hiển thị dữ liệu không? (không trắng, không loading mãi)
   - Có lỗi console không? (F12 → Console)
   - Có lỗi API không? (F12 → Network → tìm request đỏ)
   - Thêm/sửa/xóa có hoạt động không?
5. Ghi lại lỗi → sửa → test lại
```

### Tài khoản test:
| Role | Phone/Email | Password |
|------|-------------|----------|
| Admin | 0902596999 | 123456 |
| Staff | tanhvsg@gmail.com | 123456 |
| Accountant | phungphan112358@gmail.com | 123456 |
| Agency | nhabeagri@gmail.com | 123456 |
| Student | (xem users.json) | 123456 |

---

## Cập nhật memory

- **Admin password**: 0902596999 / **123456** (không phải admin@123 như memory cũ ghi)
- **57 tài khoản** (tăng từ 56)
- **Backend health**: `{"status":"ok","accounts":57}` — đang chạy ổn định
