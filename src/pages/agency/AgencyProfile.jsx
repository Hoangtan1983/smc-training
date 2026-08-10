import { useState } from 'react';
import { User, Lock, Building2 } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function AgencyProfile() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || user?.name || '',
    agency_name: user?.agency_name || user?.agencyName || '',
    agent_code: user?.agent_code || user?.agentCode || user?.code || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    commission_rate: user?.commission_rate || user?.commissionRate || 10,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.fullName || !profileForm.email) {
      toast.error('Vui lòng nhập họ tên và email.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        fullName: profileForm.fullName,
        agency_name: profileForm.agency_name,
        email: profileForm.email,
        phone: profileForm.phone,
        address: profileForm.address,
      };
      await api.updateUser(user.id, data);
      updateUser(data);
      toast.success('Đã cập nhật thông tin đại lý.');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật thông tin.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error('Mật khẩu mới không khớp.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Đổi mật khẩu thành công.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="page-container max-w-2xl mx-auto">
      <PageHeader title="Thông tin đại lý" subtitle="Quản lý thông tin và bảo mật tài khoản" />

      {/* Profile Information */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Thông tin đại lý</h3>
            <p className="text-sm text-gray-400">Cập nhật thông tin đại lý của bạn</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="input-label">Tên đại lý</label>
            <input
              name="agency_name"
              value={profileForm.agency_name}
              onChange={handleProfileChange}
              className="input-field"
              placeholder="Nhập tên đại lý"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Mã đại lý</label>
              <input
                name="agent_code"
                value={profileForm.agent_code}
                className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
            <div>
              <label className="input-label">Tỷ lệ hoa hồng (%)</label>
              <input
                name="commission_rate"
                type="number"
                value={profileForm.commission_rate}
                className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
                readOnly
              />
            </div>
          </div>
          <div>
            <label className="input-label">Họ tên người đại diện</label>
            <input
              name="fullName"
              value={profileForm.fullName}
              onChange={handleProfileChange}
              className="input-field"
              placeholder="Nhập họ tên"
            />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input
              name="email"
              type="email"
              value={profileForm.email}
              onChange={handleProfileChange}
              className="input-field"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="input-label">Số điện thoại</label>
            <input
              name="phone"
              value={profileForm.phone}
              onChange={handleProfileChange}
              className="input-field"
              placeholder="0900000000"
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

          <div className="pt-2">
            <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
              {saving ? <span className="spinner spinner-sm mr-2" /> : <User className="w-4 h-4 mr-2" />}
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-smc-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-smc-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Đổi mật khẩu</h3>
            <p className="text-sm text-gray-400">Cập nhật mật khẩu để bảo vệ tài khoản</p>
          </div>
        </div>

        <div className="space-y-4">
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
              placeholder="Nhập mật khẩu mới"
            />
          </div>
          <div>
            <label className="input-label">Xác nhận mật khẩu mới</label>
            <input
              name="confirmNewPassword"
              type="password"
              value={passwordForm.confirmNewPassword}
              onChange={handlePasswordChange}
              className="input-field"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          <div className="pt-2">
            <button onClick={handleChangePassword} disabled={passwordSaving} className="btn-primary">
              {passwordSaving ? <span className="spinner spinner-sm mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
              Đổi mật khẩu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
