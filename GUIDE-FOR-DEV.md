# Hướng Dẫn Cho Dev React — Dự Án SMC Training

> **Dành cho:** Lập trình viên React tham gia dự án
> **Ngày:** 10/08/2026
> **Backend:** PHP có sẵn, đang chạy production tại https://smc-training.com

---

## 1. TỔNG QUAN DỰ ÁN

SMC Training là hệ thống quản lý đào tạo phi công UAV. 
- **Frontend:** React (Vite) — cần sửa/bổ sung
- **Backend:** PHP — đang chạy ổn định với ~30 API endpoints
- **Database:** JSON files (dự kiến migrate sang MySQL)
- **Hosting:** Mắt Bão Plesk — https://s88d71.cloudnetwork.vn:8443

### Trạng thái hiện tại

| Thành phần | Trạng thái |
|------------|------------|
| Backend API | ✅ Hoạt động đầy đủ |
| Database | ✅ 56 users, 3 khóa học có dữ liệu thật |
| Frontend React | 🔴 **Bị lỗi — trang trắng, cần sửa** |

---

## 2. BẮT ĐẦU NHANH

### Clone repo
```bash
git clone https://github.com/Hoangtan1983/smc-training.git
cd smc-training
```

### Cấu trúc thư mục
```
smc-training/
  ├── index.html              ← React SPA entry
  ├── .htaccess               ← Apache rewrite rules
  ├── api/                    ← PHP Backend (KHÔNG sửa nếu chưa có yêu cầu)
  │   ├── auth.php            ← Main router (3277 dòng)
  │   ├── db.php              ← MySQL wrapper
  │   ├── env.php             ← Config (KHÔNG commit)
  │   └── data/               ← JSON data files
  ├── assets/                 ← React build output (nhiều file cũ, cần dọn)
  ├── database/
  │   └── schema.sql          ← MySQL schema
  └── tai-lieu/               ← PDF tài liệu học
```

---

## 3. API CONTRACTS

### Base URL: `https://smc-training.com/api`

### Authentication
Tất cả request cần auth đều gửi token trong header:
```
Authorization: Bearer <token>
```

### 3.1. Auth

#### POST /api/login — Đăng nhập
```
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "u-student-abc123",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "phone": "0912345678",
    "role": "STUDENT",
    "status": "ACTIVE"
  }
}

Response 401:
{ "error": "Số điện thoại/Email hoặc mật khẩu không đúng" }

Response 403:
{ "error": "Tài khoản của bạn đang chờ nhân viên SMC duyệt..." }
```

#### POST /api/register — Đăng ký
```
Request:
{
  "email": "newuser@example.com",
  "password": "password123",    // tối thiểu 6 ký tự
  "fullName": "Nguyễn Văn B",
  "phone": "0987654321",
  "courseId": "c-8468783fde8fa5a4"  // optional
}

Response 201:
{
  "message": "Đăng ký thành công! Tài khoản của bạn đang chờ nhân viên SMC duyệt.",
  "user": { ... }
}

Response 400:
{ "error": "Vui lòng nhập đầy đủ: email, mật khẩu, họ tên" }

Response 409:
{ "error": "Email hoặc số điện thoại đã được sử dụng" }
```

#### GET /api/me — Thông tin user hiện tại
```
Headers: Authorization: Bearer <token>

Response 200:
{
  "user": {
    "id": "u-student-abc123",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A",
    "phone": "0912345678",
    "role": "STUDENT",
    "status": "ACTIVE",
    "courseId": "c-8468783fde8fa5a4"
  }
}
```

#### POST /api/logout — Đăng xuất
```
Headers: Authorization: Bearer <token>
Response 200: { "message": "Đã đăng xuất" }
```

#### POST /api/change-password — Đổi mật khẩu
```
Headers: Authorization: Bearer <token>

Request:
{
  "currentPassword": "oldpass",
  "newPassword": "newpass123"   // tối thiểu 6 ký tự
}

Response 200: { "message": "Đổi mật khẩu thành công" }
Response 400: { "error": "Mật khẩu hiện tại không đúng" }
```

#### POST /api/forgot-password — Quên mật khẩu
```
Request: { "email": "user@example.com" }
Response 200: { "message": "Hướng dẫn đặt lại mật khẩu đã được gửi qua email" }
```

---

### 3.2. Users (CRUD) — Admin/Staff

```
GET    /api/users          → Danh sách users (hỗ trợ ?role=STUDENT, ?status=ACTIVE, ?search=...)
GET    /api/users?id=xxx   → Chi tiết 1 user
POST   /api/users          → Tạo user mới
PUT    /api/users?id=xxx   → Cập nhật user
DELETE /api/users?id=xxx   → Xóa user + cascade (enrollments, tuitions, invoices, transactions)

Các role: ADMIN, STAFF, TEACHER, STUDENT, AGENCY
Các status: ACTIVE, PENDING, FROZEN, INACTIVE
```

**User object:**
```json
{
  "id": "u-student-abc123",
  "email": "user@example.com",
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "role": "STUDENT",
  "status": "ACTIVE",
  "courseId": "c-8468783fde8fa5a4",
  "createdAt": "2026-07-29T10:30:00+07:00"
}
```

---

### 3.3. Courses (CRUD)

```
GET    /api/courses          → Danh sách khóa học
GET    /api/courses?id=xxx   → Chi tiết 1 khóa
POST   /api/courses          → Tạo khóa mới
PUT    /api/courses?id=xxx   → Cập nhật khóa
DELETE /api/courses?id=xxx   → Xóa khóa
```

**Course object:**
```json
{
  "id": "c-8468783fde8fa5a4",
  "name": "SMC-VLOSK1",
  "hours": 140,
  "price": 15000000,
  "description": "",
  "status": "active",
  "legacy_id": "c001",
  "modules": [
    {
      "id": "m1",
      "name": "Pháp luật & Quy định về UAV",
      "hours_theory": 8,
      "hours_practice": 16
    }
  ],
  "total_hours_theory": 42,
  "total_hours_practice": 84,
  "total_hours_review": 14,
  "min_fly_hours": 20
}
```

---

### 3.4. Classes (CRUD)

```
GET    /api/classes           → Danh sách lớp
POST   /api/classes           → Tạo lớp mới
PUT    /api/classes?id=xxx    → Cập nhật lớp
DELETE /api/classes?id=xxx    → Xóa lớp
```

**Class object:**
```json
{
  "id": "c-b67c2ad53c0e9b02",
  "name": "VLOS 01",
  "course_id": "c-8468783fde8fa5a4",
  "teacher_ids": [],
  "max_students": 18,
  "start_date": "2026-07-23",
  "end_date": "2026-08-30",
  "schedule": [],
  "location": "",
  "type": "online",
  "student_ids": ["u-578674d288efb0c6", "u-1ad9b8647c2dd817"],
  "status": "active",
  "rank": "A"
}
```

---

### 3.5. Enrollments

```
GET    /api/enrollments           → Danh sách ghi danh (Admin/Staff)
POST   /api/enrollments           → Tạo ghi danh
PUT    /api/enrollments?id=xxx    → Cập nhật
GET    /api/my-enrollments        → Học viên xem khóa của mình (Student)
```

**Enrollment object:**
```json
{
  "id": "enr-abc123",
  "studentId": "u-student-abc",
  "studentName": "Nguyễn Văn A",
  "courseId": "c-8468783fde8fa5a4",
  "courseName": "SMC-VLOSK1",
  "classId": "c-b67c2ad53c0e9b02",
  "status": "active",
  "stage": "theory",
  "createdAt": "2026-07-29T10:30:00+07:00"
}
```

---

### 3.6. Học phí (Tuition) — Admin/Staff

```
GET  /api/admin/tuition-list      → Danh sách học phí
GET  /api/admin/tuition-config    → Cấu hình học phí
GET  /api/admin/tuition-students  → Học viên + học phí
GET  /api/admin/tuition-report    → Báo cáo doanh thu
POST /api/admin/tuition-add       → Thêm khoản thu
POST /api/admin/process-payment   → Xử lý thanh toán
POST /api/admin/approve-transaction → Duyệt giao dịch
POST /api/admin/tuition-activate   → Kích hoạt học viên
POST /api/admin/toggle-freeze      → Khóa/Mở tài khoản học viên
GET  /api/my-tuition               → Học viên xem học phí của mình
```

---

### 3.7. Thi cử & Chứng chỉ

```
GET    /api/exams              → Danh sách đề thi (cần auth)
POST   /api/exams              → Tạo đề thi (Admin/Teacher)

GET    /api/exam-results       → Kết quả thi (cần auth)
POST   /api/exam-results       → Nộp bài thi (Student)

GET    /api/question-bank      → Ngân hàng câu hỏi
POST   /api/question-bank      → Thêm câu hỏi (Admin/Teacher)

GET    /api/my-enrollments     → Học viên xem tiến độ + chứng chỉ
```

---

### 3.8. Các API khác

```
POST /api/assign-class       → Xếp lớp cho học viên (Staff)
POST /api/update-stage       → Cập nhật tiến độ học (Teacher/Staff)
GET  /api/registrations      → Đơn đăng ký online
POST /api/upload             → Upload file (multipart/form-data)
GET  /api/files              → Danh sách file đã upload
POST /api/fix-data           → Sửa chữa dữ liệu (Admin)
GET  /api/health             → Health check (không cần auth)
POST /api/admin/toggle-maintenance → Bảo trì hệ thống (Admin)
```

---

## 4. ROLE & PERMISSIONS

| Role | Quyền |
|------|-------|
| **ADMIN** | Toàn quyền: users, courses, classes, tài chính, bảo trì |
| **STAFF** | Quản lý users, courses, classes, học phí, duyệt đăng ký |
| **TEACHER** | Xem lớp của mình, cập nhật tiến độ học viên, chấm thi |
| **STUDENT** | Xem khóa học, làm bài thi, xem học phí của mình, xem chứng chỉ |
| **AGENCY** | Xem học viên do mình giới thiệu, hoa hồng |

**Cách kiểm tra role trong React:**
```js
const user = await api.get('/api/me');
// user.role: 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'AGENCY'
// Dùng để ẩn/hiện menu, chặn route
```

---

## 5. LƯU Ý KHI CODE REACT

### 5.1. Gọi API
```js
const API_BASE = 'https://smc-training.com/api';

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Lỗi không xác định');
  }

  return data;
}

// Ví dụ:
const { user, token } = await apiCall('/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
localStorage.setItem('token', token);
```

### 5.2. Routes trong React (đề xuất)
```
/                   → Landing page (public)
/dang-ky            → Form đăng ký (public)
/login              → Đăng nhập
/admin/dashboard    → Dashboard Admin
/admin/users        → Quản lý users
/admin/courses      → Quản lý khóa học
/admin/classes      → Quản lý lớp học
/admin/tuition      → Quản lý học phí
/admin/reports      → Báo cáo
/teacher/dashboard  → Dashboard giáo viên
/teacher/classes    → Lớp của tôi
/student/dashboard  → Dashboard học viên
/student/courses    → Khóa học của tôi
/student/exam       → Làm bài thi
/student/tuition    → Học phí của tôi
/tra-cuu            → Tra cứu chứng chỉ (public)
```

### 5.3. Các lỗi thường gặp
- `401 Unauthorized` → Token hết hạn → redirect về /login
- `403 Forbidden` → Không đủ quyền → hiển thị thông báo
- `503 Maintenance` → Hệ thống đang bảo trì
- `429 Too Many Requests` → Rate limit → chờ vài giây rồi thử lại

---

## 6. DEPLOY

### Deploy lên hosting Mắt Bão

```
FTP: s88d71.cloudnetwork.vn (port 21)
User: smc46189
Pass: YiJu#0PiKo@4KiTa
Thư mục: /httpdocs/

Chỉ upload:
  - index.html (entry point)
  - assets/ (build output: JS, CSS, ảnh)
  - Các file tĩnh khác

KHÔNG upload đè:
  - api/ (backend PHP)
  - .htaccess
```

### Build React
```bash
npm run build
# Upload thư mục dist/ hoặc build/ lên /httpdocs/
```

**Quan trọng:** Trước khi deploy, xóa các file build cũ trong /assets/ để tránh rác (~70 file JS cũ đang chiếm ~44MB).

---

## 7. VIỆC CẦN LÀM (ƯU TIÊN)

### Giai đoạn 1: Sửa lỗi & Khôi phục (3-5 ngày)
- [ ] Tìm/khôi phục React source code (có thể đã mất, cần viết lại)
- [ ] Fix lỗi trang trắng
- [ ] Xây dựng layout cơ bản + routing
- [ ] Trang Login/Register hoạt động thật với API

### Giai đoạn 2: Dashboard & CRUD (1-2 tuần)
- [ ] Dashboard theo role (Admin/Staff/Teacher/Student)
- [ ] Quản lý users (list, create, edit, delete)
- [ ] Quản lý khóa học + lớp học
- [ ] Xếp lớp + gán giáo viên

### Giai đoạn 3: E-Learning & Tài chính (2-3 tuần)
- [ ] Giao diện học tập (xem tài liệu PDF trong /tai-lieu/)
- [ ] Làm bài thi trắc nghiệm
- [ ] Quản lý học phí (Admin)
- [ ] Học viên xem học phí + thanh toán

### Giai đoạn 4: Chứng chỉ & Hoàn thiện (1-2 tuần)
- [ ] Tra cứu chứng chỉ công khai
- [ ] Dashboard nâng cao (biểu đồ, thống kê)
- [ ] Tối ưu hiệu năng (code splitting)

---

## 8. LIÊN HỆ HỖ TRỢ

- **Claude (trợ lý kỹ thuật):** Giải thích code backend, đề xuất giải pháp, review code
- **Anh Hoang Tan (chủ dự án):** Quyết định nghiệp vụ, duyệt giao diện
- **GitHub Issues:** Dùng để track bugs & tasks

---

*Cập nhật: 10/08/2026 — Backend đã verified hoạt động với 56 users thật.*
