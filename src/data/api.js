import toast from 'react-hot-toast';

const BASE_URL = '/api/auth.php';
const TOKEN_KEY = 'smc-token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(method, path, body = null, params = {}) {
  // Build URL: /api/auth.php?action={path}
  const cleanPath = path.replace(/^\/+/, '');
  let url = BASE_URL + '?action=' + encodeURIComponent(cleanPath);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }
  }

  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers, credentials: 'include' };
  if (body) {
    opts.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    throw new Error('Không thể kết nối đến máy chủ');
  }

  if (res.status === 401) {
    setToken(null);
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
  }

  if (res.status === 403) {
    toast.error('Bạn không có quyền thực hiện hành động này.');
    throw new Error('Từ chối truy cập.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || `Lỗi HTTP ${res.status}`);
  }

  return data;
}

// ─── Auth ───────────────────────────────────────────
export function login(email, password) {
  return request('POST', 'login', { email, password });
}

export function register(data) {
  return request('POST', 'register', data);
}

export function logout() {
  return request('POST', 'logout');
}

export function getMe() {
  return request('GET', 'me');
}

export function changePassword(currentPassword, newPassword) {
  return request('POST', 'change-password', { currentPassword, newPassword });
}

export function forgotPassword(email) {
  return request('POST', 'forgot-password', { email });
}

// ─── Users ─────────────────────────────────────────
export function getUsers(params = {}) {
  return request('GET', 'users', null, params);
}

export function getUser(id) {
  return request('GET', `users/${id}`);
}

export function createUser(data) {
  return request('POST', 'users', data);
}

export function updateUser(id, data) {
  return request('PUT', `users/${id}`, data);
}

export function deleteUser(id) {
  return request('DELETE', `users/${id}`);
}

export function approveUser(id) {
  return request('POST', `approve-student/${id}`);
}

// ─── Courses ───────────────────────────────────────
export function getCourses() {
  return request('GET', 'courses');
}

export function getCourse(id) {
  return request('GET', `courses/${id}`);
}

export function createCourse(data) {
  return request('POST', 'courses', data);
}

export function updateCourse(id, data) {
  return request('PUT', `courses/${id}`, data);
}

export function deleteCourse(id) {
  return request('DELETE', `courses/${id}`);
}

// ─── Classes ───────────────────────────────────────
export function getClasses(params = {}) {
  return request('GET', 'classes', null, params);
}

export function createClass(data) {
  return request('POST', 'classes', data);
}

export function updateClass(id, data) {
  return request('PUT', `classes/${id}`, data);
}

export function deleteClass(id) {
  return request('DELETE', `classes/${id}`);
}

// ─── Enrollments ───────────────────────────────────
export function getEnrollments(params = {}) {
  return request('GET', 'enrollments', null, params);
}

export function createEnrollment(data) {
  return request('POST', 'enrollments', data);
}

export function updateEnrollment(id, data) {
  return request('PUT', `enrollments/${id}`, data);
}

// ─── Registrations ─────────────────────────────────
export function getRegistrations() {
  return request('GET', 'registrations');
}

export function approveRegistration(id) {
  return request('POST', `registrations/${id}`);
}

// ─── Exams ─────────────────────────────────────────
export function getExams() {
  return request('GET', 'exams');
}

export function createExam(data) {
  return request('POST', 'exams', data);
}

// ─── Exam Results ──────────────────────────────────
export function getExamResults(params = {}) {
  return request('GET', 'exam-results', null, params);
}

export function submitExam(data) {
  return request('POST', 'exam-results', data);
}

// ─── Certifications ────────────────────────────────
export function getCertifications() {
  return request('GET', 'certifications');
}

// ─── Question Bank ─────────────────────────────────
export function getQuestionBank() {
  return request('GET', 'question-bank');
}

// ─── Tuition ───────────────────────────────────────
export function getTuitionList() {
  return request('GET', 'admin/tuition-list');
}

export function getTuitionStudents() {
  return request('GET', 'admin/tuition-students');
}

export function getTuitionReport() {
  return request('GET', 'admin/tuition-report');
}

export function getMyTuition() {
  return request('GET', 'my-tuition');
}

export function addTuition(data) {
  return request('POST', 'admin/tuition-add', data);
}

export function processPayment(data) {
  return request('POST', 'admin/process-payment', data);
}

export function approveTransaction(data) {
  return request('POST', 'admin/approve-transaction', data);
}

// ─── My Enrollments ────────────────────────────────
export function getMyEnrollments() {
  return request('GET', 'my-enrollments');
}

// ─── Assign / Stage ────────────────────────────────
export function assignClass(data) {
  return request('POST', 'assign-class', data);
}

export function updateStage(data) {
  return request('POST', 'update-stage', data);
}

// ─── Fly Logs ──────────────────────────────────────
export function getFlyLogs(params = {}) {
  return request('GET', 'fly_logs', null, params);
}

export function updateFlyLog(id, data) {
  return request('PUT', `fly_logs/${id}`, data);
}

// ─── Agencies ──────────────────────────────────────
export function getAgencies() {
  return request('GET', 'agencies');
}

export function createAgency(data) {
  return request('POST', 'agencies', data);
}

export function updateAgency(id, data) {
  return request('PUT', `agencies/${id}`, data);
}

// ─── Change Requests ───────────────────────────────
export function getChangeRequests() {
  return request('GET', 'change-requests');
}

export function updateChangeRequest(id, data) {
  return request('PUT', `change-requests/${id}`, data);
}

// ─── Upload / Files ────────────────────────────────
export function uploadFile(formData) {
  return request('POST', 'upload', formData);
}

export function getFiles() {
  return request('GET', 'files');
}

// ─── Health ────────────────────────────────────────
export function healthCheck() {
  return request('GET', 'health');
}

// ─── Reports ───────────────────────────────────────
export function getReports(type) {
  return request('GET', 'reports', null, { type });
}

// ─── Settings ──────────────────────────────────────
export function getSettings() {
  return request('GET', 'settings');
}

export function updateSettings(data) {
  return request('PUT', 'settings', data);
}
