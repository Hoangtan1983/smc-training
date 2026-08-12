const API_BASE = '/api/auth.php';

// Luôn đọc token từ localStorage — không cache biến module-level
function getAuthToken() {
  return localStorage.getItem('smc-token') || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('smc-token', token);
  } else {
    localStorage.removeItem('smc-token');
  }
}

export function getToken() {
  return getAuthToken();
}

// Map of API base paths to short action names (không dùng dấu / trong action)
const pathMap = {
  '/auth/login': 'login',
  '/auth/register': 'register',
  '/auth/me': 'me',
  '/users': 'users',
  '/courses': 'courses',
  '/classes': 'classes',
  '/enrollments': 'enrollments',
  '/attendance': 'attendance',
  '/exams': 'exams',
  '/exam-results': 'exam-results',
  '/fly_logs': 'fly_logs',
  '/certifications': 'certifications',
  '/registrations': 'registrations',
  '/change-requests': 'change-requests',
  '/payment-receipts': 'payment-receipts',
  '/agencies': 'agencies',
  '/my-enrollments': 'my-enrollments',
  '/tuitions': 'tuitions',
  '/my-tuition': 'my-tuition',
  '/question-bank': 'question-bank',
  '/admin/tuition-my': 'admin/tuition-my',
  '/admin/tuition-config': 'admin/tuition-config',
  '/admin/tuition-list': 'admin/tuition-list',
  '/admin/tuition-students': 'admin/tuition-students',
  '/admin/tuition-report': 'admin/tuition-report',
  '/admin/tuition-add': 'admin/tuition-add',
  '/admin/tuition-activate': 'admin/tuition-activate',
  '/admin/process-payment': 'admin/process-payment',  // Unified payment endpoint (NEW)
  '/admin/confirm-payment': 'admin/confirm-payment',  // @deprecated — wrapper
  '/admin/partial-approve': 'admin/partial-approve',  // @deprecated — wrapper
  '/admin/toggle-freeze': 'admin/toggle-freeze',
  '/admin/update-tuition-step': 'admin/update-tuition-step',
  '/health': 'health',
};

async function request(method, path, body = null) {
  // Strip leading/trailing slashes, split into segments
  const segments = path.replace(/^\/|\/$/g, '').split('/');

  // Build base path for pathMap lookup: '/users' for 2-seg path, '/auth/login' for 2-seg
  // For paths with ID: /users/{id} has 2 segments => base = '/users'
  // For paths like /auth/login: has 2 segments => base = '/auth/login'
  const base = '/' + segments.slice(0, 2).join('/');

  // Try exact match first, then try first segment only for paths with IDs
  let action = pathMap[path]     // exact match
    || pathMap[base]             // match base (e.g. /users, /auth/login)
    || (segments.length === 2 ? pathMap['/' + segments[0]] : null)  // match /users from /users/id
    || path.replace(/^\//, '').replace(/\//g, '-');  // fallback

  // Append ID segment(s) if present (> 2 means has ID for /auth/xx/id, === 2 with no exact match means /users/id)
  const hasId = (segments.length > 2) || (segments.length === 2 && !pathMap[path] && !pathMap[base] && pathMap['/' + segments[0]]);
  if (hasId) {
    action = action + '/' + segments[segments.length - 1];
  }

  const url = API_BASE + '?action=' + encodeURIComponent(action);
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers, credentials: 'include' };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Không thể kết nối đến máy chủ');
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Lỗi máy chủ: ' + text.substring(0, 200));
  }

  if (!res.ok) {
    // Auto-logout on 401 (token expired)
    if (res.status === 401) {
      localStorage.removeItem('smc-token');
      localStorage.removeItem('smc-session');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || `Lỗi ${res.status}`);
  }

  return data;
}

// Auth
export function apiLogin(email, password) {
  return request('POST', '/auth/login', { email, password });
}

export function apiRegister(userData) {
  return request('POST', '/auth/register', userData);
}

export function apiGetMe() {
  return request('GET', '/auth/me');
}

// Users
export function apiGetUsers() {
  return request('GET', '/users');
}

export function apiGetUser(id) {
  return request('GET', `/users/${id}`);
}

export function apiCreateUser(userData) {
  return request('POST', '/users', userData);
}

export function apiUpdateUser(id, updates) {
  return request('PUT', `/users/${id}`, updates);
}

export function apiDeleteUser(id) {
  return request('DELETE', `/users/${id}`);
}

// Courses
export function apiGetCourses() {
  return request('GET', '/courses');
}

export function apiGetCourse(id) {
  return request('GET', `/courses/${id}`);
}

export function apiCreateCourse(data) {
  return request('POST', '/courses', data);
}

export function apiUpdateCourse(id, data) {
  return request('PUT', `/courses/${id}`, data);
}

export function apiDeleteCourse(id) {
  return request('DELETE', `/courses/${id}`);
}

// Classes
export function apiGetClasses() {
  return request('GET', '/classes');
}

export function apiGetClass(id) {
  return request('GET', `/classes/${id}`);
}

export function apiCreateClass(data) {
  return request('POST', '/classes', data);
}

export function apiUpdateClass(id, data) {
  return request('PUT', `/classes/${id}`, data);
}

export function apiDeleteClass(id) {
  return request('DELETE', `/classes/${id}`);
}

// Enrollments
export function apiGetEnrollments() {
  return request('GET', '/enrollments');
}

export function apiGetEnrollment(id) {
  return request('GET', `/enrollments/${id}`);
}

export function apiCreateEnrollment(data) {
  return request('POST', '/enrollments', data);
}

export function apiUpdateEnrollment(id, data) {
  return request('PUT', `/enrollments/${id}`, data);
}

export function apiDeleteEnrollment(id) {
  return request('DELETE', `/enrollments/${id}`);
}

export function apiGetMyEnrollments() {
  return request('GET', '/my-enrollments');
}

// Attendance
export function apiGetAttendance() {
  return request('GET', '/attendance');
}

export function apiCreateAttendance(data) {
  return request('POST', '/attendance', data);
}

export function apiUpdateAttendance(id, data) {
  return request('PUT', `/attendance/${id}`, data);
}

// Exams
export function apiGetExams() {
  return request('GET', '/exams');
}

export function apiGetExam(id) {
  return request('GET', `/exams/${id}`);
}

export function apiCreateExam(data) {
  return request('POST', '/exams', data);
}

export function apiUpdateExam(id, data) {
  return request('PUT', `/exams/${id}`, data);
}

export function apiDeleteExam(id) {
  return request('DELETE', `/exams/${id}`);
}

// Fly Logs
export function apiGetFlyLogs() {
  return request('GET', '/fly_logs');
}

export function apiCreateFlyLog(data) {
  return request('POST', '/fly_logs', data);
}

export function apiUpdateFlyLog(id, data) {
  return request('PUT', `/fly_logs/${id}`, data);
}

export function apiDeleteFlyLog(id) {
  return request('DELETE', `/fly_logs/${id}`);
}

// Certifications
export function apiGetCertifications() {
  return request('GET', '/certifications');
}

export function apiCreateCertification(data) {
  return request('POST', '/certifications', data);
}

export function apiUpdateCertification(id, data) {
  return request('PUT', `/certifications/${id}`, data);
}

export function apiDeleteCertification(id) {
  return request('DELETE', `/certifications/${id}`);
}

// Registrations
export function apiSubmitRegistration(regData) {
  return request('POST', '/registrations', regData);
}

export function apiGetRegistrations() {
  return request('GET', '/registrations');
}

// Tuitions (legacy - via auth.php)
export function apiGetTuitions() {
  return request('GET', '/tuitions');
}

export function apiCreateTuition(data) {
  return request('POST', '/tuitions', data);
}

// My tuition — student tự tra cứu học phí (không cần quyền admin/staff)
export function apiGetMyTuition() {
  return request('GET', '/my-tuition');
}

// ═══════════════════════════════════════════════════════════════
// TUITION SERVICE v3 (Unified — via tuition-service.php)
// Nguyên lý: 1 Invoice → N Transactions → 1 Agency Commission
// ═══════════════════════════════════════════════════════════════
const TUI_SVC = '/api/tuition-service.php';

// v4: Alias — tuitionRequest trỏ về tuiRequest (tuition-service.php)
// Tránh nhầm lẫn với legacy tuitions.php
async function tuiRequest(action, method = 'GET', body = null, extraParams = {}) {
  let url = TUI_SVC + '?action=' + encodeURIComponent(action);
  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null && v !== '') url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }
  const headers = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Không thể kết nối đến máy chủ');
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

// v4: Alias — dùng chung tuiRequest cho tuition-service.php
// Đảm bảo các hàm fallback gọi đúng tuition-service.php (JSON backend)
async function tuitionRequest(action, method = 'GET', body = null, extraParams = {}) {
  return tuiRequest(action, method, body, extraParams);
}

// ═══════════════════════════════════════════════════════════════
// SMC UNIFIED API (MySQL Backend — via smc-db.php)
// THAY THẾ: tuition-service.php + api-v1.php + agency.php
// Single source of truth cho mọi role
// ═══════════════════════════════════════════════════════════════
const SMC_API = '/api/smc-db.php';

async function smcRequest(action, method = 'GET', body = null, params = {}) {
  let url = SMC_API + '?action=' + encodeURIComponent(action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }
  const headers = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Không thể kết nối đến máy chủ');
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('smc-token');
      localStorage.removeItem('smc-session');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw new Error(data.error || `Lỗi ${res.status}`);
  }
  return data;
}

// ── Invoices (MySQL — smc-db.php with fallback to JSON) ──
export function apiCreateInvoice(payload) {
  if (USE_MYSQL) {
    return smcRequest('create-invoice', 'POST', payload).catch(() => {
      return tuitionRequest('create-invoice', 'POST', payload);
    });
  }
  return tuitionRequest('create-invoice', 'POST', payload);
}
export function apiListInvoices(filters = {}) {
  // v4: Ưu tiên MySQL, fallback về JSON (tuition-service.php) nếu lỗi
  // Sau khi chạy fix-mysql-enrollments.php?confirm=yes, MySQL sẽ có dữ liệu đúng
  if (USE_MYSQL) {
    return smcRequest('list-invoices', 'GET', null, filters).catch(() => {
      return tuitionRequest('list-invoices', 'GET', null, filters).catch(() => ({ data: [] }));
    });
  }
  return tuitionRequest('list-invoices', 'GET', null, filters).catch(() => ({ data: [] }));
}
export function apiGetOverallReport() {
  // v4: Thêm fallback về JSON nếu MySQL không khả dụng
  if (USE_MYSQL) {
    return smcRequest('get-overall-report').catch(() => {
      return tuitionRequest('get-overall-report', 'GET').catch(() => ({ data: {} }));
    });
  }
  return tuitionRequest('get-overall-report', 'GET').catch(() => ({ data: {} }));
}
export function apiGetInvoiceDetail(invoiceId) {
  // v4: Hỗ trợ cả invoiceId dạng string (JSON) và number (MySQL)
  if (USE_MYSQL) {
    return smcRequest('get-invoice-detail', 'GET', null, { invoiceId }).catch(() => {
      return tuitionRequest('get-invoice-detail', 'GET', null, { invoiceId });
    });
  }
  return tuitionRequest('get-invoice-detail', 'GET', null, { invoiceId });
}
export function apiFreezeInvoice(invoiceId) {
  if (USE_MYSQL) {
    return smcRequest('freeze-invoice', 'POST', { invoiceId }).catch(() => {
      return tuitionRequest('freeze-invoice', 'POST', { invoiceId });
    });
  }
  return tuitionRequest('freeze-invoice', 'POST', { invoiceId });
}
export function apiUnfreezeInvoice(invoiceId) {
  if (USE_MYSQL) {
    return smcRequest('unfreeze-invoice', 'POST', { invoiceId }).catch(() => {
      return tuitionRequest('unfreeze-invoice', 'POST', { invoiceId });
    });
  }
  return tuitionRequest('unfreeze-invoice', 'POST', { invoiceId });
}
export function apiUpdateInvoice(payload) {
  if (USE_MYSQL) {
    return smcRequest('update-invoice', 'POST', payload).catch(() => {
      return tuitionRequest('update-invoice', 'POST', payload);
    });
  }
  return tuitionRequest('update-invoice', 'POST', payload);
}
export function apiDeleteInvoice(invoiceId) {
  if (USE_MYSQL) {
    return smcRequest('delete-invoice', 'POST', { invoiceId }).catch(() => {
      return tuitionRequest('delete-invoice', 'POST', { invoiceId });
    });
  }
  return tuitionRequest('delete-invoice', 'POST', { invoiceId });
}

// ── Transactions (MySQL — smc-db.php with fallback to tuition-service.php) ──
export function apiRecordPayment(payload) {
  if (USE_MYSQL) {
    return smcRequest('record-payment', 'POST', payload).catch(() => {
      return tuitionRequest('record-payment', 'POST', payload);
    });
  }
  return tuitionRequest('record-payment', 'POST', payload);
}
export function apiSubmitReceipt(payload) {
  if (USE_MYSQL) {
    return smcRequest('submit-receipt', 'POST', payload).catch(() => {
      return tuitionRequest('submit-receipt', 'POST', payload);
    });
  }
  return tuitionRequest('submit-receipt', 'POST', payload);
}
export function apiConfirmReceipt(payload) {
  if (USE_MYSQL) {
    return smcRequest('confirm-receipt', 'POST', payload).catch(() => {
      return tuitionRequest('confirm-receipt', 'POST', payload);
    });
  }
  return tuitionRequest('confirm-receipt', 'POST', payload);
}
export function apiRejectReceipt(payload) {
  if (USE_MYSQL) {
    return smcRequest('reject-receipt', 'POST', payload).catch(() => {
      return tuitionRequest('reject-receipt', 'POST', payload);
    });
  }
  return tuitionRequest('reject-receipt', 'POST', payload);
}
export function apiListTransactions(filters = {}) {
  if (USE_MYSQL) {
    return smcRequest('list-transactions', 'GET', null, filters).catch(() => {
      return tuitionRequest('list-transactions', 'GET', null, filters);
    });
  }
  return tuitionRequest('list-transactions', 'GET', null, filters);
}

// v5: Admin duyệt transaction lần cuối (3-tier approval flow)
export function apiAdminApproveTransaction(payload) {
  return request('POST', '/admin/approve-transaction', payload);
}

// v5: Admin duyệt cuối qua tuition-service
export function apiAdminFinalApprove(payload) {
  if (USE_MYSQL) {
    return smcRequest('admin-final-approve', 'POST', payload).catch(() => {
      return tuitionRequest('admin-final-approve', 'POST', payload);
    });
  }
  return tuitionRequest('admin-final-approve', 'POST', payload);
}

// ── Student (MySQL — smc-db.php, fallback tuition-service.php) ──
export async function apiGetStudentInvoices(courseId = '') {
  if (USE_MYSQL) {
    try {
      const res = await smcRequest('get-student-invoices', 'GET', null, { courseId });
      const data = res?.data || [];
      if (data.length > 0) return res;
      console.warn('[api] smc-db returned empty invoices, falling back to JSON');
    } catch (e) {
      console.warn('[api] smc-db failed, falling back to JSON:', e.message);
    }
  }
  // Fallback: tuition-service.php (dùng file JSON)
  return await tuiRequest('get-student-invoice', 'GET', null, { courseId });
}

// ── Agency Report (MySQL — smc-db.php, fallback tuition-service.php) ──
export async function apiGetAgencyReport(agencyId = '') {
  if (USE_MYSQL) {
    try {
      return await smcRequest('get-agency-report', 'GET', null, { agencyId });
    } catch (e) {
      console.warn('[api] smc-db agency report failed, falling back to JSON:', e.message);
    }
  }
  // Fallback: tuition-service.php (dùng file JSON)
  return await tuiRequest('get-agency-report', 'GET', null, { agencyId });
}

// ── Admin Report (tuition-service.php with fallback to smc-db) ──
// NOTE: Removed duplicate — use unified version at line ~610
export function smcGetOverallReportDirect() {
  if (USE_MYSQL) {
    return smcRequest('get-overall-report').catch(() => {
      return tuitionRequest('get-overall-report', 'GET');
    });
  }
  return tuitionRequest('get-overall-report', 'GET');
}

// ── Freeze/Unfreeze (MySQL — smc-db.php) ──
// NOTE: Removed duplicate apiFreezeInvoice/apiUnfreezeInvoice — use version at line 423 above

// ── Health ──
export function apiTuitionServiceHealth() {
  if (USE_MYSQL) {
    return smcRequest('health').catch(() => {
      return tuitionRequest('health', 'GET');
    });
  }
  return tuitionRequest('health', 'GET');
}

// ── Sync All (Admin: đồng bộ invoice ↔ enrollment ↔ user) ──
export function apiSyncAllTuitions() {
  if (USE_MYSQL) {
    return smcRequest('sync-all', 'POST').catch(() => {
      return tuitionRequest('sync-all', 'POST');
    });
  }
  return tuitionRequest('sync-all', 'POST');
}

// ── Cleanup học viên miễn phí thuộc đại lý (Admin) ──
export function apiCleanupFreeAgencyInvoices() {
  if (USE_MYSQL) {
    return smcRequest('cleanup-free-agency-invoices', 'POST').catch(() => {
      return tuitionRequest('cleanup-free-agency-invoices', 'POST');
    });
  }
  return tuitionRequest('cleanup-free-agency-invoices', 'POST');
}

// ── Đánh dấu / bỏ đánh dấu học viên miễn phí (tuition-service.php with MySQL fallback) ──
export function apiMarkExempt(studentId, courseId = '') {
  if (USE_MYSQL) {
    return smcRequest('mark-exempt', 'POST', { studentId, courseId }).catch(() => {
      return tuitionRequest('mark-exempt', 'POST', { studentId, courseId });
    });
  }
  return tuitionRequest('mark-exempt', 'POST', { studentId, courseId });
}
export function apiUnmarkExempt(studentId) {
  if (USE_MYSQL) {
    return smcRequest('unmark-exempt', 'POST', { studentId }).catch(() => {
      return tuitionRequest('unmark-exempt', 'POST', { studentId });
    });
  }
  return tuitionRequest('unmark-exempt', 'POST', { studentId });
}

// ── Exam Eligibility (tuition-service.php with MySQL fallback) ──
export function apiExamEligibility() {
  if (USE_MYSQL) {
    return smcRequest('exam-eligibility').catch(() => {
      return tuitionRequest('exam-eligibility', 'GET');
    });
  }
  return tuitionRequest('exam-eligibility', 'GET');
}

// ── Agency Students (tuition-service.php with MySQL fallback) ──
export function apiAgencyStudents(agencyId = '') {
  if (USE_MYSQL) {
    return smcRequest('agency-students', 'GET', null, { agencyId }).catch(() => {
      return tuitionRequest('agency-students', 'GET', null, { agencyId });
    });
  }
  return tuitionRequest('agency-students', 'GET', null, { agencyId });
}

// ── Staff Cash (tuition-service.php with MySQL fallback) ──
export function apiStaffConfirmCash(payload) {
  if (USE_MYSQL) {
    return smcRequest('staff-confirm-cash', 'POST', payload).catch(() => {
      return tuitionRequest('staff-confirm-cash', 'POST', payload);
    });
  }
  return tuitionRequest('staff-confirm-cash', 'POST', payload);
}
export function apiStaffCashSummary(staffId = '') {
  if (USE_MYSQL) {
    return smcRequest('staff-cash-summary', 'GET', null, { staffId }).catch(() => {
      return tuitionRequest('staff-cash-summary', 'GET', null, { staffId });
    });
  }
  return tuitionRequest('staff-cash-summary', 'GET', null, { staffId });
}

// ── Accountant (tuition-service.php with MySQL fallback) ──
export function apiAccountantCashLedger(filters = {}) {
  if (USE_MYSQL) {
    return smcRequest('accountant-cash-ledger', 'GET', null, filters).catch(() => {
      return tuitionRequest('accountant-cash-ledger', 'GET', null, filters);
    });
  }
  return tuitionRequest('accountant-cash-ledger', 'GET', null, filters);
}
export function apiRemitCash(payload) {
  return smcRequest('remit-cash', 'POST', payload);
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED API (MySQL — smc-db.php)
// Các hàm này sẽ thay thế TẤT CẢ apiV1* + tuition-service + agency.php
// khi MySQL được kích hoạt. Hiện tại fallback về tuition-service.php
// ═══════════════════════════════════════════════════════════════

// Flag: MySQL luôn được dùng làm nguồn dữ liệu chính
let USE_MYSQL = true; // Mặc định dùng MySQL — single source of truth. Fallback sang JSON nếu MySQL lỗi.

// Tự động kiểm tra MySQL readiness khi app khởi động
setTimeout(async () => {
  try {
    const res = await fetch('/api/smc-db.php?action=check-mysql-ready', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.ready) {
        USE_MYSQL = true;
        console.debug('[SMC] MySQL active! Invoices:', data.invoices, 'Payments:', data.payments);
      } else {
        USE_MYSQL = false;
        console.warn('[SMC] MySQL not ready, falling back to JSON');
      }
    }
  } catch (e) {
    USE_MYSQL = false;
    console.warn('[SMC] MySQL check failed, using JSON fallback');
  }
}, 500);

export function enableMySQL() { USE_MYSQL = true; }
export function disableMySQL() { USE_MYSQL = false; }
export function isMySQLEnabled() { return USE_MYSQL; }

// Unified: list-invoices (thay thế apiListInvoices + apiV1GetEnrollments)
export function apiListInvoicesUnified(filters = {}) {
  if (USE_MYSQL) return smcRequest('list-invoices', 'GET', null, filters);
  return apiListInvoices(filters);
}

// Unified: record-payment (thay thế apiRecordPayment + apiV1CreatePayment)
export function apiRecordPaymentUnified(payload) {
  if (USE_MYSQL) return smcRequest('record-payment', 'POST', payload);
  return apiRecordPayment(payload);
}

// Unified: confirm-receipt (thay thế apiConfirmReceipt + apiV1ApprovePayment)
export function apiConfirmReceiptUnified(payload) {
  if (USE_MYSQL) return smcRequest('confirm-receipt', 'POST', payload);
  return apiConfirmReceipt(payload);
}

// Unified: reject-receipt (thay thế apiRejectReceipt + apiV1RejectPayment)
export function apiRejectReceiptUnified(payload) {
  if (USE_MYSQL) return smcRequest('reject-receipt', 'POST', payload);
  return apiRejectReceipt(payload);
}

// Unified: overall-report (thay thế apiGetOverallReport + apiV1RevenueReport)
export function apiGetOverallReportUnified() {
  if (USE_MYSQL) return smcRequest('get-overall-report');
  return apiGetOverallReport();
}

// Unified: agency-report (thay thế apiGetAgencyReport + apiV1AgencyReport)
export function apiGetAgencyReportUnified(agencyId = '') {
  if (USE_MYSQL) return smcRequest('get-agency-report', 'GET', null, { agencyId });
  return apiGetAgencyReport(agencyId);
}

// Unified: student-invoices (thay thế apiGetStudentInvoices + apiV1MyTuition)
export function apiGetStudentInvoicesUnified(courseId = '') {
  if (USE_MYSQL) return smcRequest('get-student-invoices', 'GET', null, { courseId });
  return apiGetStudentInvoices(courseId);
}

// Unified: exam-eligibility (thay thế apiV1ExamEligibility)
export async function apiExamEligibilityUnified() {
  if (USE_MYSQL) return smcRequest('exam-eligibility');
  return v1Request('GET', '/student-portal/exam-eligibility');
}

// Unified: generate-qr (thay thế apiV1GenerateQR)
export function apiGenerateQRUnified(payload) {
  if (USE_MYSQL) return smcRequest('generate-qr', 'POST', payload);
  return apiV1GenerateQR(payload);
}

// Unified: submit-receipt (giữ nguyên nhưng route qua MySQL khi sẵn sàng)
export function apiSubmitReceiptUnified(payload) {
  if (USE_MYSQL) return smcRequest('submit-receipt', 'POST', payload);
  return apiSubmitReceipt(payload);
}

// Unified: agency-students
export function apiAgencyStudentsUnified(agencyId = '') {
  if (USE_MYSQL) return smcRequest('agency-students', 'GET', null, { agencyId });
  // Fallback: fetch từ agency.php
  return fetch('/api/agency.php?action=my-students' + (agencyId ? '&agencyId=' + agencyId : ''), {
    headers: { 'Authorization': `Bearer ${getAuthToken()}` },
    credentials: 'include',
  }).then(r => r.json());
}

// Unified: overall health
export function apiHealthUnified() {
  if (USE_MYSQL) return smcRequest('health');
  return apiTuitionServiceHealth();
}

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY — giữ lại để không break code cũ
// ═══════════════════════════════════════════════════════════════
// NOTE: Các hàm apiTuition* dưới đây đều gọi tuitionRequest() đã được định nghĩa ở trên
// TUITION_API/2nd tuitionRequest bị comment để tránh duplicate

// @deprecated — use apiRecordPayment / apiCreateInvoice
export function apiConfirmPayment(data) { return request('POST', '/admin/confirm-payment', data); }
export function apiPartialApprove(data) { return request('POST', '/admin/partial-approve', data); }
export function apiProcessPayment(data) { return request('POST', '/admin/process-payment', data); }
export function apiToggleFreeze(data) { return request('POST', '/admin/toggle-freeze', data); }
export function apiUpdateTuitionStep(data) { return request('POST', '/admin/update-tuition-step', data); }

// Health
export function apiHealth() {
  return request('GET', '/health');
}

// Exam Results
export function apiGetExamResults() {
  return request('GET', '/exam-results');
}

export function apiSubmitExamResult(data) {
  return request('POST', '/exam-results', data);
}

export function apiGetMyExamResults() {
  return request('GET', '/exam-results');
}

// Change Requests
export function apiGetChangeRequests() {
  return request('GET', '/change-requests');
}

export function apiCreateChangeRequest(data) {
  return request('POST', '/change-requests', data);
}

export function apiUpdateChangeRequest(id, data) {
  return request('PUT', `/change-requests/${id}`, data);
}

// Payment Receipts
export function apiSubmitPaymentReceipt(data) {
  return request('POST', '/payment-receipts', data);
}

export function apiGetPaymentReceipts() {
  return request('GET', '/payment-receipts');
}

// Question Bank
export function apiGetQuestionBank() {
  return request('GET', '/question-bank');
}

export function apiSaveQuestionBank(questions) {
  return request('POST', '/question-bank', { questions });
}

// Change Password
export function apiChangePassword(currentPassword, newPassword) {
  return request('POST', '/change-password', { currentPassword, newPassword });
}

// Assign Class (Staff xếp lớp + phân giáo viên thủ công)
export function apiAssignClass(studentId, classId, oldClassId = '') {
  return request('POST', '/assign-class', { studentId, classId, oldClassId });
}

// Agencies
export function apiGetAgencies() {
  return request('GET', '/agencies');
}

// File Upload (multipart/form-data)
const API_UPLOAD = '/api/auth.php';

export async function apiUploadFile(file, category = 'documents') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const url = API_BASE + '?action=upload';
  const headers = {};
  const token3 = getAuthToken();
  if (token3) {
    headers['Authorization'] = `Bearer ${token3}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

export async function apiGetFiles(category = null) {
  const path = category ? `/files/${encodeURIComponent(category)}` : '/files';
  return request('GET', path);
}

export async function apiDeleteFile(id) {
  return request('DELETE', `/files/${id}`);
}

// Sync: load all data at once
export async function apiSyncAll() {
  const [courses, classes, enrollments, attendance, exams, fly_logs, certifications, tuitions] = await Promise.all([
    apiGetCourses().catch(() => []),
    apiGetClasses().catch(() => []),
    apiGetEnrollments().catch(() => []),
    apiGetAttendance().catch(() => []),
    apiGetExams().catch(() => []),
    apiGetFlyLogs().catch(() => []),
    apiGetCertifications().catch(() => []),
    apiGetTuitions().catch(() => []),
  ]);
  return { courses, classes, enrollments, attendance, exams, fly_logs, certifications, tuitions };
}

// ── Event Bus: Đồng bộ tức thời giữa các trang ──
const SMC_EVENT_PREFIX = 'smc_data_change_';

export function emitDataChange(resource, detail = {}) {
  const event = new CustomEvent(SMC_EVENT_PREFIX + resource, {
    detail: { ...detail, timestamp: Date.now(), source: window.location.pathname },
  });
  window.dispatchEvent(event);
  if (resource !== 'all') {
    emitDataChange('all', { changed: resource, ...detail });
  }
}

export function onDataChange(resource, callback) {
  const handler = (event) => {
    if (event.detail?.source === window.location.pathname) return;
    callback(event.detail);
  };
  window.addEventListener(SMC_EVENT_PREFIX + resource, handler);
  return () => window.removeEventListener(SMC_EVENT_PREFIX + resource, handler);
}

// ── Import học viên từ Excel/CSV ──
const API_IMPORT = '/api/import.php';

export async function apiImportStudents(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  for (const [k, v] of Object.entries(options)) {
    formData.append(k, v);
  }

  const headers = {};
  const token4 = getAuthToken();
  if (token4) {
    headers['Authorization'] = `Bearer ${token4}`;
  }

  const res = await fetch(API_IMPORT, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

export async function apiImportStudentsJson(students) {
  const headers = { 'Content-Type': 'application/json' };
  const token5 = getAuthToken();
  if (token5) {
    headers['Authorization'] = `Bearer ${token5}`;
  }

  const res = await fetch(API_IMPORT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ students }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

// ═══════════════════════════════════════════════════════════════
// API v1 — RESTful MySQL Backend (api-v1.php)
// Endpoints chuẩn: /api/api-v1.php/{resource}
// ═══════════════════════════════════════════════════════════════
const API_V1 = '/api/api-v1.php';

async function v1Request(method, path, body = null, params = {}) {
  let url = API_V1 + path;
  const queryStr = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  if (queryStr) url += '?' + queryStr;

  const headers = { 'Content-Type': 'application/json' };
  const t = getAuthToken();
  if (t) headers['Authorization'] = `Bearer ${t}`;

  const opts = { method, headers, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Không thể kết nối đến máy chủ');
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.errors?.[0] || `Lỗi ${res.status}`);
  }
  return data;
}

// ── Enrollments ──
export function apiV1GetEnrollments(filters = {}) {
  return v1Request('GET', '/enrollments', null, filters);
}
export function apiV1GetEnrollment(id) {
  return v1Request('GET', `/enrollments/${id}`);
}
export function apiV1CreateEnrollment(payload) {
  return v1Request('POST', '/enrollments', payload);
}
export function apiV1GetDebts() {
  return v1Request('GET', '/enrollments/debts');
}

// ── Payments ──
export function apiV1GetPayments(filters = {}) {
  return v1Request('GET', '/payments', null, filters);
}
export function apiV1CreatePayment(payload) {
  return v1Request('POST', '/payments', payload);
}
export function apiV1ApprovePayment(id, note = '') {
  return v1Request('PATCH', `/payments/${id}/approve`, { note });
}
export function apiV1RejectPayment(id, reason = '') {
  return v1Request('PATCH', `/payments/${id}/reject`, { reason });
}
export function apiV1GenerateQR(payload) {
  return v1Request('POST', '/payments/generate-qr', payload);
}

// ── Agents ──
export function apiV1GetAgents() {
  // Ưu tiên MySQL, fallback về JSON (auth.php) nếu MySQL chưa sẵn sàng
  return v1Request('GET', '/agents').catch(() => {
    return request('GET', '/agencies');
  });
}
export function apiV1CreateAgent(payload) {
  // Ưu tiên MySQL, fallback về JSON (auth.php) nếu MySQL chưa sẵn sàng
  return v1Request('POST', '/agents', payload).catch(() => {
    return request('POST', '/agencies', payload);
  });
}
export function apiV1GetAgentCommissions(agentId, month = '') {
  return v1Request('GET', `/agents/${agentId}/commissions`, null, { month });
}
export function apiV1SettleCommission(agentId, periodStart, periodEnd) {
  return v1Request('POST', `/agents/${agentId}/payouts`, { period_start: periodStart, period_end: periodEnd });
}

// ── Courses ──
export function apiV1GetCourses() {
  return v1Request('GET', '/courses');
}
export function apiV1CreateCourse(payload) {
  return v1Request('POST', '/courses', payload);
}

// ── Student Portal ──
export function apiV1MyTuition() {
  return v1Request('GET', '/student-portal/my-tuition');
}
export function apiV1ExamEligibility() {
  return v1Request('GET', '/student-portal/exam-eligibility');
}

// ── Reports ──
export function apiV1RevenueReport() {
  return v1Request('GET', '/reports/revenue');
}
export function apiV1AgencyReport() {
  return v1Request('GET', '/reports/agency');
}
export function apiV1DebtsReport() {
  return v1Request('GET', '/reports/debts');
}

// ═══════════════════════════════════════════════════════════════
// v5: Quy trình 5 tầng — Staff confirm cash + Accountant endpoints
// ═══════════════════════════════════════════════════════════════

// Staff xác nhận thu tiền mặt (BƯỚC 1 của quy trình 2 bước)
export function apiStaffConfirmCashUnified(payload) {
  if (USE_MYSQL) return smcRequest('staff-confirm-cash', 'POST', payload);
  return tuiRequest('staff-confirm-cash', 'POST', payload);
}

// Staff xem sổ quỹ của mình (tổng tiền mặt đang giữ)
export function apiStaffCashSummaryUnified(staffId = '') {
  if (USE_MYSQL) return smcRequest('staff-cash-summary', 'GET', null, { staffId });
  return { data: { totalHolding: 0, totalRemitted: 0, pendingCount: 0, pendingPayments: [] } };
}

// Accountant xem toàn bộ sổ quỹ tiền mặt tất cả nhân viên
export function apiAccountantCashLedgerUnified(filters = {}) {
  if (USE_MYSQL) return smcRequest('accountant-cash-ledger', 'GET', null, filters);
  return { success: false, data: [], overview: {}, staffHoldings: [], total: 0 };
}

// Nhân viên bàn giao tiền mặt cho Kế toán
export function apiRemitCashUnified(payload) {
  if (USE_MYSQL) return smcRequest('remit-cash', 'POST', payload);
  return tuiRequest('remit-cash', 'POST', payload);
}

// Kiểm tra MySQL đã sẵn sàng chưa
export async function apiCheckMySQLReady() {
  try {
    const res = await fetch('/api/smc-db.php?action=check-mysql-ready', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.ready) {
        enableMySQL();
        console.debug('[SMC] MySQL activated:', data);
      }
      return data;
    }
  } catch (e) {
    console.debug('[SMC] MySQL not ready, using JSON fallback');
  }
  return { ready: false };
}
