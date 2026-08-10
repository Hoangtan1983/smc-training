import { useState } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Lock, Save, KeyRound } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function StudentProfile() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || user?.full_name || user?.name || '',
    phone: user?.phone || '',
    dob: user?.dob || user?.birthDate || user?.birth_date || '',
    address: user?.address || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateUser(user.id, profileForm);
      updateUser(profileForm);
      toast.success('Cập nhật hồ sơ thành công.');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Mật khẩu mới không khớp.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setChangingPassword(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Đổi mật khẩu thành công.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Hồ sơ cá nhân" subtitle="Quản lý thông tin cá nhân" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile form */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-smc-500" />
            Thông tin cá nhân
          </h3>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="input-label">Họ và tên</label>
              <input
                name="fullName"
                value={profileForm.fullName}
                onChange={handleProfileChange}
                className="input-field"
                placeholder="Nhập họ và tên"
              />
            </div>
            <div>
              <label className="input-label">Email</label>
              <input
                value={user?.email || ''}
                className="input-field bg-gray-100 text-gray-500"
                disabled
                readOnly
              />
              <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi.</p>
            </div>
            <div>
              <label className="input-label">Số điện thoại</label>
              <input
                name="phone"
                value={profileForm.phone}
                onChange={handleProfileChange}
                className="input-field"
                placeholder="Nhập số điện thoại"
              />
            </div>
            <div>
              <label className="input-label">Ngày sinh</label>
              <input
                name="dob"
                type="date"
                value={profileForm.dob}
                onChange={handleProfileChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Địa chỉ</label>
              <input
                name="address"
                value={profileForm.address}
                onChange={handleProfileChange}
                className="input-field"
                placeholder="Nhập địa chỉ"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? <span className="spinner spinner-sm" /> : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </form>
        </div>

        {/* Password change form */}
        <div className="card">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-smc-500" />
            Đổi mật khẩu
          </h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="input-label">Mật khẩu hiện tại</label>
              <input
                name="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                className="input-field"
                placeholder="Nhập mật khẩu hiện tại"
              />
            </div>
            <div>
              <label className="input-label">Mật khẩu mới</label>
              <input
                name="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                className="input-field"
                placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
              />
            </div>
            <div>
              <label className="input-label">Xác nhận mật khẩu mới</label>
              <input
                name="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                className="input-field"
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>
            <button type="submit" disabled={changingPassword} className="btn-primary w-full">
              {changingPassword ? <span className="spinner spinner-sm" /> : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Đổi mật khẩu
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
