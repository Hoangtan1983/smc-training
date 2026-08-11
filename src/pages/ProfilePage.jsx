import { useState } from 'react';
import * as api from '../data/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Phone,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Save,
  Key,
  BadgeCheck,
} from 'lucide-react';

const INITIAL_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

const INITIAL_PASSWORD_ERRORS = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

const INITIAL_PROFILE_FORM = {
  fullName: '',
  phone: '',
};

const INITIAL_PROFILE_ERRORS = {
  fullName: '',
  phone: '',
};

export default function ProfilePage({ embedded = false }) {
  const { user, updateUser } = useAuth();

  // ─── Password form ────────────────────────────
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [passwordErrors, setPasswordErrors] = useState(INITIAL_PASSWORD_ERRORS);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handlePasswordChange = (field) => (e) => {
    setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePasswordForm = () => {
    const errors = { ...INITIAL_PASSWORD_ERRORS };
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
    }
    if (!passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'Mật khẩu xác nhận không khớp.';
    }
    return errors;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const errors = validatePasswordForm();
    const hasError = Object.values(errors).some(Boolean);
    if (hasError) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordErrors(INITIAL_PASSWORD_ERRORS);
    setPasswordLoading(true);

    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Đổi mật khẩu thành công!');
      setPasswordForm(INITIAL_PASSWORD_FORM);
    } catch (err) {
      const message = err.message || 'Đổi mật khẩu thất bại.';
      toast.error(message);
      setPasswordErrors((prev) => ({ ...prev, currentPassword: message }));
    } finally {
      setPasswordLoading(false);
    }
  };

  // ─── Profile form ────────────────────────────
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
  });
  const [profileErrors, setProfileErrors] = useState(INITIAL_PROFILE_ERRORS);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChanged, setProfileChanged] = useState(false);

  const handleProfileChange = (field) => (e) => {
    setProfileForm((prev) => {
      const updated = { ...prev, [field]: e.target.value };
      const originalFullName = user?.fullName || '';
      const originalPhone = user?.phone || '';
      setProfileChanged(
        updated.fullName !== originalFullName || updated.phone !== originalPhone
      );
      return updated;
    });
    if (profileErrors[field]) {
      setProfileErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateProfileForm = () => {
    const errors = { ...INITIAL_PROFILE_ERRORS };
    if (!profileForm.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên.';
    }
    if (!profileForm.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại.';
    } else if (!/^[0-9]{10,11}$/.test(profileForm.phone.trim())) {
      errors.phone = 'Số điện thoại không hợp lệ (10-11 chữ số).';
    }
    return errors;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const errors = validateProfileForm();
    const hasError = Object.values(errors).some(Boolean);
    if (hasError) {
      setProfileErrors(errors);
      return;
    }

    setProfileErrors(INITIAL_PROFILE_ERRORS);
    setProfileLoading(true);

    try {
      const updated = await api.updateUser(user.id, {
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone.trim(),
      });
      const updatedData = updated.user || updated.data?.user || updated.data || updated;
      updateUser(updatedData);
      toast.success('Cập nhật thông tin thành công!');
      setProfileChanged(false);
    } catch (err) {
      const message = err.message || 'Cập nhật thất bại.';
      toast.error(message);
    } finally {
      setProfileLoading(false);
    }
  };

  const roleLabels = {
    ADMIN: 'Quản trị viên',
    STAFF: 'Nhân viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học viên',
    AGENCY: 'Đại lý',
    ACCOUNTANT: 'Kế toán',
  };

  const Wrapper = embedded ? 'div' : 'div';
  const wrapperProps = embedded ? { className: '' } : { className: 'min-h-screen bg-gray-50 pt-20 pb-12' };

  const content = (
    <div className={embedded ? '' : 'page-container'}>
      {!embedded && (
        <div className="mb-6">
          <h1 className="page-title">Thông tin tài khoản</h1>
          <p className="page-subtitle">Quản lý thông tin cá nhân và bảo mật tài khoản</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User info card */}
        <div className="lg:col-span-1">
          <div className="card text-center">
            <div className="w-20 h-20 rounded-ios-2xl bg-gradient-to-br from-smc-400 to-smc-600 flex items-center justify-center mx-auto mb-4 shadow-ios-btn">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{user?.fullName || 'Người dùng'}</h2>
            <span className="badge badge-info mt-2">{roleLabels[user?.role] || user?.role || 'N/A'}</span>

            <div className="mt-6 space-y-3 text-left">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-ios-xl">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-700 truncate">{user?.email || 'Chưa cập nhật'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-ios-xl">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-700">{user?.phone || 'Chưa cập nhật'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-ios-xl">
                <BadgeCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Vai trò</p>
                  <p className="text-sm font-medium text-gray-700">{roleLabels[user?.role] || user?.role || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Update profile */}
          <div className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-ios-lg bg-smc-50 flex items-center justify-center">
                <User className="w-5 h-5 text-smc-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Cập nhật thông tin</h3>
                <p className="text-xs text-gray-400">Thay đổi thông tin cá nhân của bạn</p>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="profileFullName">Họ và tên</label>
                <input
                  id="profileFullName"
                  className={`input-field ${profileErrors.fullName ? '!border-ios-red !ring-ios-red/20' : ''}`}
                  type="text"
                  value={profileForm.fullName}
                  onChange={handleProfileChange('fullName')}
                  disabled={profileLoading}
                />
                {profileErrors.fullName && (
                  <p className="text-xs text-ios-red mt-1">{profileErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="input-label" htmlFor="profilePhone">Số điện thoại</label>
                <input
                  id="profilePhone"
                  className={`input-field ${profileErrors.phone ? '!border-ios-red !ring-ios-red/20' : ''}`}
                  type="tel"
                  value={profileForm.phone}
                  onChange={handleProfileChange('phone')}
                  disabled={profileLoading}
                />
                {profileErrors.phone && (
                  <p className="text-xs text-ios-red mt-1">{profileErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="input-label" htmlFor="profileEmail">Email</label>
                <input
                  id="profileEmail"
                  className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  disabled
                />
                <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi.</p>
              </div>

              <button
                type="submit"
                disabled={profileLoading || !profileChanged}
                className="btn-primary"
              >
                {profileLoading ? (
                  <div className="spinner spinner-sm" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-ios-lg bg-accent-50 flex items-center justify-center">
                <Key className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Đổi mật khẩu</h3>
                <p className="text-xs text-gray-400">Đảm bảo tài khoản của bạn luôn an toàn</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="currentPassword">Mật khẩu hiện tại</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="currentPassword"
                    className={`input-field pl-10 pr-11 ${passwordErrors.currentPassword ? '!border-ios-red !ring-ios-red/20' : ''}`}
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange('currentPassword')}
                    disabled={passwordLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    tabIndex={-1}
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-ios-red mt-1">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="input-label" htmlFor="newPassword">Mật khẩu mới</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="newPassword"
                    className={`input-field pl-10 pr-11 ${passwordErrors.newPassword ? '!border-ios-red !ring-ios-red/20' : ''}`}
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange('newPassword')}
                    disabled={passwordLoading}
                    placeholder="Ít nhất 6 ký tự"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    tabIndex={-1}
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-xs text-ios-red mt-1">{passwordErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="input-label" htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirmNewPassword"
                    className={`input-field pl-10 pr-11 ${passwordErrors.confirmNewPassword ? '!border-ios-red !ring-ios-red/20' : ''}`}
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmNewPassword}
                    onChange={handlePasswordChange('confirmNewPassword')}
                    disabled={passwordLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    tabIndex={-1}
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.confirmNewPassword && (
                  <p className="text-xs text-ios-red mt-1">{passwordErrors.confirmNewPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-primary"
              >
                {passwordLoading ? (
                  <div className="spinner spinner-sm" />
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Đổi mật khẩu
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <div className="min-h-screen bg-gray-50 pt-20 pb-12">{content}</div>;
}
