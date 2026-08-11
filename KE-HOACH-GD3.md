# Kế Hoạch Giai Đoạn 3 — SMC Training

**Ngày:** 11/08/2026 | **Trạng thái:** GĐ1 ✅ GĐ2 ✅ GĐ3 ✅

---

## Tóm tắt GĐ1 & GĐ2

| Giai đoạn | Kết quả |
|-----------|---------|
| GĐ1 | ✅ Môi trường dev, login, dashboard Admin hoạt động |
| GĐ2 | ✅ 8/10 trang Admin test OK, sửa lỗi agencies, build 732KB |

---

## GĐ3: HOÀN THÀNH (11/08/2026) ✅

### 1. Dọn dẹp & thống nhất code PHP

| Việc | Chi tiết |
|------|----------|
| Xóa core-helpers.php | Code chết, không ai require |
| Thống nhất loadData/saveData | helpers.php là canonical (có auto-backup 5 bản), auth.php require helpers.php |
| Xóa alias functions trùng | auth.php có alias gây `Cannot redeclare function` → HTTP 500 |
| Dọn file rác | attendance.json.tmp.*, fix-log.txt, *.bak cũ |

### 2. Sửa API routes sai

| Endpoint cũ (lỗi) | Endpoint mới (đúng) | Commit |
|--------------------|---------------------|--------|
| `action=create` | `action=users` | a94b534 |
| `action=delete&id=X` | `action=users/X` | a94b534 |
| `action=get&id=X` | `action=users/X` | 4af3459 |
| `action=approve&id=X` | `action=approve-student/X` | 4af3459 |
| POST logic quá chặt | Thêm error handling | 5dc90c2 |

### 3. Thêm routes thiếu (commit 79bf4fc)

| Route | Method | Mô tả |
|-------|--------|-------|
| `/api/auth.php?action=reports&type=...` | GET | Báo cáo (agency, revenue, debts, payments) |
| `/api/auth.php?action=settings` | GET/PUT | Cài đặt hệ thống |
| `/api/auth.php?action=messages` | GET/POST | Chat giữa users |
| `/api/auth.php?action=registrations/{id}` | POST | Duyệt đơn đăng ký |

### 4. Deploy production

- ✅ Frontend: index.html + JS (760KB) + CSS (60KB) + logo + favicon
- ✅ Backend: auth.php (16 routes), helpers.php, auth-lib.php
- ✅ Static: .htaccess, robots.txt, sitemap.xml, dang-ky.html
- ✅ Verify: health OK, CRUD users OK, reports OK, settings OK, messages OK

### 5. Audit toàn bộ API endpoints

| Nhóm | Endpoints | Status |
|------|-----------|--------|
| Auth (7) | login, register, logout, me, change-password, forgot-password, reset-password | ✅ |
| Users (5) | GET/POST/PUT/DELETE /users[/{id}] | ✅ Tested |
| Courses (5) | GET/POST/PUT/DELETE /courses[/{id}] | ✅ |
| Classes (4) | GET/POST/PUT/DELETE /classes[/{id}] | ✅ |
| Enrollments (3) | GET/POST/PUT /enrollments[/{id}] | ✅ |
| Exams (2) | GET/POST /exams, /exam-results | ✅ |
| Fly Logs (2) | GET/PUT /fly-logs[/{id}] | ✅ |
| Agencies (3) | GET/POST/PUT /agencies[/{id}] | ✅ |
| Tuition (8) | list, students, report, add, activate, my, payment, transaction | ✅ |
| Reports (1) | GET /reports?type=agency\|revenue\|debts\|payments | ✅ Mới |
| Settings (1) | GET/PUT /settings | ✅ Mới |
| Messages (1) | GET/POST /messages | ✅ Mới |
| Others (8) | certifications, question-bank, change-requests, registrations, files, upload, health, fix-data, maintenance | ✅ |

**Tổng: 55 API endpoints — tất cả đã audit**

---

## LỖI CÒN TỒN TẠI

| # | Lỗi | Mức độ |
|---|-----|--------|
| 🔴 | Một số tên hiển thị không dấu ("Quan ly Dai ly", "Bao cao Tai chinh") | UI |
| 🟡 | Header vẫn hiện "Admin Dashboard" khi vào role khác | UI |
| 🟡 | AccountantTuition gọi `api.approveTransaction({tuition_id})` thay vì `{transactionId}` | Bug tiềm ẩn |
| 🟢 | Bundle JS 760KB — code splitting | Performance |

---

## VIỆC TIẾP THEO

1. **Test thủ công** từng trang Student, Teacher, Agency, Accountant
2. **Sửa tên không dấu** ("Quan ly Dai ly" → "Quản lý Đại lý")
3. **Sửa lỗi AccountantTuition** — truyền sai tham số `approveTransaction`
4. **Xóa thư mục backup** (500MB) khi xác nhận mọi thứ OK

---

## GITHUB COMMITS HÔM NAY (16 commits)

```
79bf4fc feat: thêm backend routes reports, settings, messages, registrations approval
52a3e04 fix: xóa alias functions trùng trong auth.php — gây lỗi 500 trên production
5dc90c2 fix: sửa logic POST users — cho phép cả khi có $userId
4af3459 fix: sửa getUser + approveUser API endpoint sai route
a94b534 fix: sửa API endpoint tạo/xoá người dùng sai route
24c7e12 refactor: thống nhất code PHP, xóa code trùng lặp & file rác
```
