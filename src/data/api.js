import toast from 'react-hot-toast';

const BASE_URL = '/api';
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

async function apiCall(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Fix: loại bỏ /api prefix nếu có vì BASE_URL đã có /api
  let cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint;
  if (!cleanEndpoint.startsWith('/')) cleanEndpoint = '/' + cleanEndpoint;
  const url = `${BASE_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      setToken(null);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }

    if (response.status === 403) {
      toast.error('Bạn không có quyền thực hiện hành động này.');
      throw new Error('Từ chối truy cập.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `Lỗi HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.message.includes('Phiên đăng nhập') || error.message.includes('Từ chối')) {
      throw error;
    }
    throw new Error(error.message || 'Lỗi kết nối máy chủ.');
  }
}

// ─── Auth ───────────────────────────────────────────
export function login(email, password) {
  return apiCall('/api/auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(data) {
  return apiCall('/api/auth.php?action=register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function logout() {
  return apiCall('/api/auth.php?action=logout', { method: 'POST' });
}

export function getMe() {
  return apiCall('/api/auth.php?action=me');
}

export function changePassword(currentPassword, newPassword) {
  return apiCall('/api/auth.php?action=change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function forgotPassword(email) {
  return apiCall('/api/auth.php?action=forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// ─── Users ─────────────────────────────────────────
export function getUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall(`/api/auth.php?action=users${qs ? '&' + qs : ''}`);
}

export function getUser(id) {
  return apiCall(`/api/auth.php?action=get&id=${id}`);
}

export function createUser(data) {
  return apiCall('/api/auth.php?action=users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateUser(id, data) {
  return apiCall(`/api/auth.php?action=users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteUser(id) {
  return apiCall(`/api/auth.php?action=users/${id}`, {
    method: 'DELETE',
  });
}

export function approveUser(id) {
  return apiCall(`/api/auth.php?action=approve&id=${id}`, {
    method: 'POST',
  });
}

// ─── Courses ───────────────────────────────────────
export function getCourses() {
  return apiCall('/api/auth.php?action=courses');
}

export function getCourse(id) {
  return apiCall(`/api/auth.php?action=courses&id=${id}`);
}

export function createCourse(data) {
  return apiCall('/api/auth.php?action=courses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCourse(id, data) {
  return apiCall(`/api/auth.php?action=courses&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCourse(id) {
  return apiCall(`/api/auth.php?action=courses&id=${id}`, {
    method: 'DELETE',
  });
}

// ─── Classes ───────────────────────────────────────
export function getClasses(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall(`/api/auth.php?action=classes${qs ? '&' + qs : ''}`);
}

export function createClass(data) {
  return apiCall('/api/auth.php?action=classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateClass(id, data) {
  return apiCall(`/api/auth.php?action=classes&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteClass(id) {
  return apiCall(`/api/auth.php?action=classes&id=${id}`, {
    method: 'DELETE',
  });
}

// ─── Enrollments ───────────────────────────────────
export function getEnrollments(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall(`/api/auth.php?action=enrollments${qs ? '&' + qs : ''}`);
}

export function createEnrollment(data) {
  return apiCall('/api/auth.php?action=enrollments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEnrollment(id, data) {
  return apiCall(`/api/auth.php?action=enrollments&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Registrations ─────────────────────────────────
export function getRegistrations() {
  return apiCall('/api/auth.php?action=registrations');
}

export function approveRegistration(id) {
  return apiCall(`/api/auth.php?action=registrations&id=${id}`, {
    method: 'POST',
  });
}

// ─── Exams ─────────────────────────────────────────
export function getExams() {
  return apiCall('/api/auth.php?action=exams');
}

export function createExam(data) {
  return apiCall('/api/auth.php?action=exams', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Exam Results ──────────────────────────────────
export function getExamResults(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall(`/api/auth.php?action=exam-results${qs ? '&' + qs : ''}`);
}

export function submitExam(data) {
  return apiCall('/api/auth.php?action=exam-results', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Certifications ────────────────────────────────
export function getCertifications() {
  return apiCall('/api/auth.php?action=certifications');
}

// ─── Question Bank ─────────────────────────────────
export function getQuestionBank() {
  return apiCall('/api/auth.php?action=question-bank');
}

// ─── Tuition ───────────────────────────────────────
export function getTuitionList() {
  return apiCall('/api/admin/tuition-list');
}

export function getTuitionStudents() {
  return apiCall('/api/admin/tuition-students');
}

export function getTuitionReport() {
  return apiCall('/api/admin/tuition-report');
}

export function getMyTuition() {
  return apiCall('/api/my-tuition');
}

export function addTuition(data) {
  return apiCall('/api/admin/tuition-add', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function processPayment(data) {
  return apiCall('/api/admin/process-payment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function approveTransaction(data) {
  return apiCall('/api/admin/approve-transaction', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── My Enrollments ────────────────────────────────
export function getMyEnrollments() {
  return apiCall('/api/my-enrollments');
}

// ─── Assign / Stage ────────────────────────────────
export function assignClass(data) {
  return apiCall('/api/assign-class', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateStage(data) {
  return apiCall('/api/update-stage', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Fly Logs ──────────────────────────────────────
export function getFlyLogs(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall(`/api/auth.php?action=fly-logs${qs ? '&' + qs : ''}`);
}

export function updateFlyLog(id, data) {
  return apiCall(`/api/auth.php?action=fly-logs&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Agencies ──────────────────────────────────────
export function getAgencies() {
  return apiCall('/api/auth.php?action=agencies');
}

export function createAgency(data) {
  return apiCall('/api/auth.php?action=agencies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAgency(id, data) {
  return apiCall(`/api/auth.php?action=agencies&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Chat / Messages ───────────────────────────────
export function getChatMessages(userId) {
  return apiCall(`/api/auth.php?action=messages&user=${userId}`);
}

export function sendMessage(data) {
  return apiCall('/api/auth.php?action=messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Upload / Files ────────────────────────────────
export function uploadFile(formData) {
  return apiCall('/api/upload', {
    method: 'POST',
    body: formData,
  });
}

export function getFiles() {
  return apiCall('/api/files');
}

// ─── Health ────────────────────────────────────────
export function healthCheck() {
  return apiCall('/api/health');
}

// ─── Reports ───────────────────────────────────────
export function getReports(type) {
  return apiCall(`/api/auth.php?action=reports&type=${type}`);
}

// ─── Change Requests ───────────────────────────────
export function getChangeRequests() {
  return apiCall('/api/auth.php?action=change-requests');
}

export function updateChangeRequest(id, data) {
  return apiCall(`/api/auth.php?action=change-requests&id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Settings ──────────────────────────────────────
export function getSettings() {
  return apiCall('/api/auth.php?action=settings');
}

export function updateSettings(data) {
  return apiCall('/api/auth.php?action=settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
