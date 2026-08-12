import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Save, User as UserIcon, Shield, Phone, Mail, Edit3, Lock, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage({ embedded = false }) {
  const { user, updateUser, changePassword, ROLE_LABELS } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  // ── Đổi mật khẩu ──
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    setForm({ fullName: user?.fullName || '', phone: user?.phone || '' });
  }, [user]);

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error('Họ tên không được để trống');
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.id, { fullName: form.fullName, phone: form.phone });
      toast.success('Cập nhật thông tin thành công!');
      setEditing(false);
    } catch (err) {
      toast.error('Có lỗi xảy ra: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!pwForm.newPassword || pwForm.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50 pt-20 pb-12'}>
      <div className={embedded ? 'animate-fade-in' : 'page-container max-w-2xl'}>
        {!embedded && <h1 className="text-2xl font-extrabold text-gray-900 mb-8">Tài khoản của tôi</h1>}

        <div className="card overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-smc-500 to-smc-600 px-8 py-10">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white/20">
                {user?.fullName?.charAt(0)?.toUpperCase()}
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">{user?.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge text-white/90 ${ROLE_LABELS?.[user?.role]?.badge || 'badge-student'}`}>
                    {ROLE_LABELS?.[user?.role]?.label || user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Thông tin cá nhân
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <div className="flex items-center text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                    {user?.email}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Số điện thoại
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="input-field"
                      placeholder="Nhập số điện thoại"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 flex-1">
                        {user?.phone || 'Chưa cập nhật'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5" /> Họ và tên
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="input-field"
                      placeholder="Nhập họ tên"
                    />
                  ) : (
                    <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{user?.fullName}</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Thông tin hệ thống
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                  <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 truncate">{user?.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Ngày tham gia</label>
                  <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                    {new Date(user?.createdAt || Date.now()).toLocaleDateString('vi-VN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Đổi mật khẩu ── */}
            <div>
              <button
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Lock className="w-4 h-4" />
                {showPasswordSection ? 'Ẩn' : 'Đổi mật khẩu'}
              </button>

              {showPasswordSection && (
                <div className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-4 animate-slide-up">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mật khẩu hiện tại</label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={pwForm.currentPassword}
                        onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                        className="input-field pr-10"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Mật khẩu mới</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={pwForm.newPassword}
                        onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                        className="input-field pr-10"
                        placeholder="Tối thiểu 6 ký tự"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      className="input-field"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving}
                    className="btn-primary flex items-center gap-2 w-full justify-center"
                  >
                    {pwSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {pwSaving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 px-6 sm:px-8 py-4 flex justify-end gap-3">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setForm({ fullName: user?.fullName || '', phone: user?.phone || '' });
                  }}
                  className="btn-ghost"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="btn-primary flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" /> Chỉnh sửa thông tin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
