import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Save, Phone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentProfile() {
  const { user, updateUser, changePassword, ROLE_LABELS } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' });

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
    if (!form.phone.trim()) {
      toast.error('Vui lòng nhập số điện thoại');
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.id, { fullName: form.fullName, phone: form.phone });
      toast.success('Đã cập nhật hồ sơ!');
      setEditing(false);
    } catch (err) {
      toast.error('Lỗi khi lưu: ' + (err.message || 'Không thể kết nối'));
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
      toast.success('Đổi mật khẩu thành công!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Hồ sơ cá nhân</h1></div>
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-10">
          <div className="flex items-center gap-5"><div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white/20">{user?.fullName?.charAt(0)?.toUpperCase()}</div><div className="text-white"><h2 className="text-xl font-bold">{user?.fullName}</h2><div className="flex items-center gap-2 mt-1"><span className="badge bg-white/20 text-white">{ROLE_LABELS[user?.role]?.label || user?.role}</span></div></div></div>
        </div>
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</label>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Số điện thoại</label>
              {editing ? (
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="Nhập số điện thoại" />
              ) : (
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{user?.phone || 'Chưa cập nhật'}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Họ và tên</label>
              {editing ? (
                <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" />
              ) : (
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{user?.fullName}</p>
              )}
            </div>
          </div>
        </div>
        <div className="border-t px-6 sm:px-8 py-4 flex justify-end gap-3">
          {editing ? (<>
            <button onClick={() => { setEditing(false); setForm({ fullName: user?.fullName || '', phone: user?.phone || '' }); }} className="btn-ghost">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </>) : (
            <button onClick={() => setEditing(true)} className="btn-primary">Chỉnh sửa</button>
          )}
        </div>

        {/* ── Đổi mật khẩu ── */}
        <div className="border-t px-6 sm:px-8 py-4">
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
    </div>
  );
}
