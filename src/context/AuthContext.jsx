import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, apiGetMe, apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiChangePassword, apiGetSyncVersion, setToken, getToken } from '../data/api';
import { seedFromAPI } from '../data/seedData';

const AuthContext = createContext(null);

const ROLE_LABELS = {
  ADMIN: { label: 'Quản trị viên', badge: 'badge-admin', color: 'purple' },
  STAFF: { label: 'Nhân viên', badge: 'badge-staff', color: 'amber' },
  ACCOUNTANT: { label: 'Kế toán', badge: 'badge-accountant', color: 'emerald' },
  TEACHER: { label: 'Giáo viên', badge: 'badge-instructor', color: 'blue' },
  STUDENT: { label: 'Học viên', badge: 'badge-student', color: 'emerald' },
  AGENCY: { label: 'Đại lý', badge: 'badge-agency', color: 'orange' },
};

export const PERMISSIONS = {
  ADMIN: ['view_all_students','create_course','assign_teacher','approve_enrollment','upload_materials','create_exam','grade_theory','log_fly_hours','organize_exam','grade_practice','print_cert','lookup_cert','view_materials','view_progress','take_exam','view_schedule','create_user','delete_user','manage_permissions','view_reports','manage_settings','manage_agencies'],
  STAFF: ['view_all_students','create_course','assign_teacher','approve_enrollment','upload_materials','log_fly_hours','organize_exam','print_cert','lookup_cert','view_materials','view_progress','view_schedule','view_reports','manage_agencies','confirm_cash_collection'],
  ACCOUNTANT: ['view_all_students','approve_payments','reject_payments','view_cash_ledger','reconcile_bank','activate_courses','view_reports','manage_agencies','settle_commission','view_materials'],
  TEACHER: ['view_class_students','upload_materials','create_exam','grade_theory','log_fly_hours','organize_exam','grade_practice','lookup_cert','view_materials','view_class_progress','view_schedule','take_attendance'],
  STUDENT: ['lookup_cert','view_own_materials','view_own_progress','take_exam','view_own_schedule','view_own_fly_logs','view_own_cert'],
  AGENCY: ['view_agency_students','import_agency_students','view_agency_report'],
};

export function hasPermission(role, permission) {
  return PERMISSIONS[role]?.includes(permission) || role === 'ADMIN';
}

let usersCache = [];

async function loadUsersFromAPI() {
  try {
    const data = await apiGetUsers();
    // API mới (MySQL) trả về array trực tiếp, API cũ trả về {users: [...]}
    usersCache = Array.isArray(data) ? data : (data.users || []);
  } catch { /* giữ cache cũ */ }
  return usersCache;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const storedToken = getToken();
      const storedSession = localStorage.getItem('smc-session');

      if (storedToken) {
        try {
          const me = await apiGetMe();
          // API trả về user trực tiếp
          setUser(me);
          localStorage.setItem('smc-session', JSON.stringify(me));
          // Load users + seed data từ API
          await loadUsersFromAPI();
          await seedFromAPI(storedToken).catch(() => {});
        } catch {
          setToken(null);
          localStorage.removeItem('smc-session');
        }
      } else if (storedSession) {
        localStorage.removeItem('smc-session');
      }
      setDataReady(true);
      setLoading(false);
    };
    init();
  }, []);

  // ── Polling đồng bộ liên tài khoản (khoá học, lớp học, users, enrollments) ──
  useEffect(() => {
    if (!user) return;
    let lastVersions = null;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const data = await apiGetSyncVersion();
        const versions = data?.versions || {};
        if (lastVersions) {
          const changed = Object.keys(versions).filter((k) => versions[k] !== lastVersions[k]);
          if (changed.length > 0) {
            const { emitDataChange } = await import('../data/api');
            changed.forEach((res) => emitDataChange(res, {}, 'remote-sync'));
          }
        }
        lastVersions = versions;
      } catch { /* bỏ qua lỗi polling */ }
      if (!cancelled) timer = setTimeout(poll, 4000);
    };

    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user]);

  const getAllUsers = useCallback(async () => {
    await loadUsersFromAPI();
    return usersCache;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    setToken(data.token);
    localStorage.setItem('smc-session', JSON.stringify(data.user));
    setUser(data.user);
    await loadUsersFromAPI();
    await seedFromAPI(data.token).catch(() => {});
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('smc-session');
    setUser(null);
    usersCache = [];
  }, []);

  const register = useCallback(async (formData) => {
    const result = await apiRegister({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone || '',
      courseId: formData.courseId || '',
    });
    // API trả về token (kích hoạt ngay) hoặc message + user PENDING (chờ duyệt)
    if (result.token) {
      setToken(result.token);
      localStorage.setItem('smc-session', JSON.stringify(result.user));
      setUser(result.user);
      await loadUsersFromAPI();
    }
    // Không load users khi tài khoản PENDING (chưa có token → tránh 401 tự chuyển /login)
    // Trả về cả user và message để frontend xử lý
    return { ...result.user, message: result.message, status: result.user?.status };
  }, []);

  const createUser = useCallback(async (formData) => {
    const result = await apiCreateUser(formData);
    await loadUsersFromAPI();
    const { emitDataChange } = await import('../data/api');
    // API mới trả về user trực tiếp, API cũ trả về {user: {...}}
    const newUser = result.user || result;
    emitDataChange('users', { action: 'created', userId: newUser?.id });
    return newUser;
  }, []);

  const updateUser = useCallback(async (id, updates) => {
    const result = await apiUpdateUser(id, updates);
    await loadUsersFromAPI();
    // API mới trả về {success: true}, cần load lại user từ cache
    if (user?.id === id || String(user?.id) === String(id)) {
      const freshUsers = usersCache;
      const updatedUser = freshUsers.find(u => String(u.id) === String(id));
      if (updatedUser) {
        const cleanUser = { ...updatedUser, password: undefined };
        setUser(cleanUser);
        localStorage.setItem('smc-session', JSON.stringify(cleanUser));
      }
    }
    const { emitDataChange } = await import('../data/api');
    emitDataChange('users', { action: 'updated', userId: id });
    return result.user || result;
  }, [user]);

  const deleteUser = useCallback(async (id) => {
    const result = await apiDeleteUser(id);
    await loadUsersFromAPI();
    // Emit data change để các trang tài chính, lớp học, enrollments... tự refresh
    const { emitDataChange } = await import('../data/api');
    emitDataChange('users', { action: 'delete', userId: id });
    emitDataChange('tuitions', { action: 'cascade', userId: id });
    emitDataChange('enrollments', { action: 'cascade', userId: id });
    emitDataChange('classes', { action: 'cascade', userId: id });
    // Broadcast to all listeners
    emitDataChange('all', { action: 'delete_user', userId: id });
    return result;
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const result = await apiChangePassword(currentPassword, newPassword);
    return result;
  }, []);

  const value = {
    user, loading, dataReady, login, logout, register,
    getAllUsers, createUser, updateUser, deleteUser, changePassword,
    ROLE_LABELS, PERMISSIONS, hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
