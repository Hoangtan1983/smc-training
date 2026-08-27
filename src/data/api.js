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
  '/approve-student': 'approve-student',
  '/files': 'files',
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

async function request(method, path, body = null, query = '') {
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

  const url = API_BASE + '?action=' + encodeURIComponent(action) + (query ? '&' + query : '');
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

export async function apiListEnrollments(role = '') {
  const data = await apiGetEnrollments().catch(() => []);
  const list = Array.isArray(data) ? data : [];
  if (role === 'staff') {
    // Hồ sơ chờ Kế toán duyệt: Nhân viên đã duyệt (approval_staff_by có), Kế toán chưa duyệt (approval_accountant_by trống)
    return { data: list.filter(e => e.approval_staff_by && !e.approval_accountant_by) };
  }
  if (role === 'accountant') {
    // Hồ sơ chờ Admin kích hoạt: Kế toán đã duyệt, Admin chưa
    return { data: list.filter(e => e.approval_accountant_by && !e.approval_admin_by) };
  }
  return { data: list };
}

export function apiApproveEnrollment(payload) {
  return request('POST', '/approve-enrollment', payload);
}

export function apiRejectEnrollment(payload) {
  return request('POST', '/reject-enrollment', payload);
}

export function apiApproveStudentV2(id, note = '', rank = '') {
  return request('POST', `/approve-student/${id}`, { note, rank });
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
// TUITION API — MySQL Backend (smc-db.php)
// Tất cả thao tác học phí qua MySQL. Không còn JSON fallback.
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

// ── Invoices ──
export function apiCreateInvoice(payload) { return smcRequest('create-invoice', 'POST', payload); }
export function apiAssignCourse(payload) { return smcRequest('assign-course', 'POST', payload); }
export function apiListInvoices(filters = {}) { return smcRequest('list-invoices', 'GET', null, filters).catch(() => ({ data: [] })); }
export function apiGetOverallReport() { return smcRequest('get-overall-report').catch(() => ({ data: {} })); }
export function apiGetInvoiceDetail(invoiceId) { return smcRequest('get-invoice-detail', 'GET', null, { invoiceId }); }
export function apiGetStudentInvoices(courseId = '') { return smcRequest('get-student-invoices', 'GET', null, { courseId }); }
export function apiUpdateInvoice(payload) { return smcRequest('update-invoice', 'POST', payload); }
export function apiDeleteInvoice(invoiceId) { return smcRequest('delete-invoice', 'POST', { enrollmentId: invoiceId }); }
export function apiFreezeInvoice(invoiceId) { return smcRequest('freeze-invoice', 'POST', { enrollmentId: invoiceId }); }
export function apiUnfreezeInvoice(invoiceId) { return smcRequest('unfreeze-invoice', 'POST', { enrollmentId: invoiceId }); }

// ── Payments ──
export function apiRecordPayment(payload) { return smcRequest('record-payment', 'POST', payload); }
export function apiSubmitReceipt(payload) { return smcRequest('submit-receipt', 'POST', payload); }
export function apiConfirmReceipt(payload) { return smcRequest('confirm-receipt', 'POST', payload); }
export function apiRejectReceipt(payload) { return smcRequest('reject-receipt', 'POST', payload); }
export function apiListTransactions(filters = {}) { return smcRequest('list-transactions', 'GET', null, filters); }
export function apiAdminApproveTransaction(payload) { return smcRequest('confirm-receipt', 'POST', payload); }
export function apiAdminFinalApprove(payload) { return smcRequest('confirm-receipt', 'POST', payload); }

// ── Reports ──
export function apiGetAgencyReport(agencyId = '') { return smcRequest('get-agency-report', 'GET', null, { agencyId }); }
export function apiAgencyStudents(agencyId = '') { return smcRequest('agency-students', 'GET', null, { agencyId }); }

// ── Staff Cash ──
export function apiStaffConfirmCash(payload) { return smcRequest('staff-confirm-cash', 'POST', payload); }
export function apiStaffCashSummary(staffId = '') { return smcRequest('staff-cash-summary', 'GET', null, { staffId }); }
export function apiAccountantCashLedger(filters = {}) { return smcRequest('accountant-cash-ledger', 'GET', null, filters); }
export function apiRemitCash(payload) { return smcRequest('remit-cash', 'POST', payload); }

// ── Admin ──
export function apiMarkExempt(studentId, courseId) { return smcRequest('mark-exempt', 'POST', { studentId, courseId }); }
export function apiUnmarkExempt(studentId, courseId = '') { return smcRequest('unmark-exempt', 'POST', { studentId, courseId }); }
export function apiExamEligibility() { return smcRequest('exam-eligibility'); }
export function apiGenerateQR(payload) { return smcRequest('generate-qr', 'POST', payload); }
export function apiTuitionServiceHealth() { return smcRequest('health'); }
export function apiSyncAllTuitions() { return smcRequest('sync-all', 'POST'); }
export function apiCleanupFreeAgencyInvoices() { return smcRequest('fix-non-agency-discounts', 'POST'); }

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY — giữ lại để không break code cũ
// ═══════════════════════════════════════════════════════════════
// ── Legacy deprecated tuition actions (forward to smc-db.php) ──

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

// Sync version — polling đồng bộ liên tài khoản (trả version theo từng tài nguyên)
export function apiGetSyncVersion() {
  return request('GET', '/sync-version');
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
  return request('GET', '/files', null, category ? `category=${encodeURIComponent(category)}` : '');
}

export async function apiDeleteFile(id) {
  return request('DELETE', `/files/${id}`);
}

export async function apiUpdateFile(id, { title, description } = {}) {
  return request('PUT', `/files/${id}`, { title, description });
}

export function apiFileUrl(id) {
  return `${API_BASE}?action=file&id=${encodeURIComponent(id)}`;
}

export async function apiGetStudentMaterials() {
  return request('GET', '/student-materials');
}

// ──── Bài viết / tin tức / sự kiện / trang tĩnh (api/posts.php) ────
const POSTS_BASE = '/api/posts.php';

async function postsRequest(action, method = 'GET', body = null, query = '') {
  const url = POSTS_BASE + '?action=' + encodeURIComponent(action) + (query ? '&' + query : '');
  const headers = {};
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers, credentials: 'include' };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Lỗi máy chủ: ' + text.substring(0, 200)); }
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

export function apiGetPosts({ type = '', pageKey = '', includeDraft = false } = {}) {
  const q = [];
  if (type) q.push(`type=${encodeURIComponent(type)}`);
  if (pageKey) q.push(`page_key=${encodeURIComponent(pageKey)}`);
  return postsRequest('list', 'GET', null, q.join('&'));
}

export function apiGetPostBySlug(slug) {
  return postsRequest(`detail/${encodeURIComponent(slug)}`);
}

export function apiCreatePost(payload) {
  return postsRequest('create', 'POST', payload);
}

export function apiUpdatePost(id, payload) {
  return postsRequest(`update/${id}`, 'PUT', payload);
}

export function apiDeletePost(id) {
  return postsRequest(`delete/${id}`, 'DELETE');
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

export function emitDataChange(resource, detail = {}, sourceOverride = null) {
  const event = new CustomEvent(SMC_EVENT_PREFIX + resource, {
    detail: { ...detail, timestamp: Date.now(), source: sourceOverride || window.location.pathname },
  });
  window.dispatchEvent(event);
  if (resource !== 'all') {
    emitDataChange('all', { changed: resource, ...detail }, sourceOverride);
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
// UPLOAD & IMPORT
// ═══════════════════════════════════════════════════════════════
export function testNewFunction() { return "NEW_CODE_2026"; }
