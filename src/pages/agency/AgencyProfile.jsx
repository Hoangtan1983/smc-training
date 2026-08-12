import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Save, User, Shield, Phone, Mail, Edit3, Lock, Eye, EyeOff, Building2, MapPin } from 'lucide-react';

export default function AgencyProfile() {
  const { user, updateUser, changePassword, ROLE_LABELS } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState(null);

  // Profile form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    contactPerson: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);

  // Password form
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { fetchAgencyInfo(); }, []);

  const fetchAgencyInfo = async () => {
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.error) {
        setAgency(data);
        setForm({
          fullName: user?.fullName || '',
          phone: user?.phone || '',
          contactPerson: data.contactPerson || '',
          address: data.address || '',
        });
      }
    } catch {} finally { setLoading(false); }
  };

  const handleSaveProfile = async () => {
    if (!form.fullName.trim()) { toast.error('Họ tên không được để trống'); return; }
    setSaving(true);
    try {
      // Cập nhật user profile
      await updateUser(user.id, { fullName: form.fullName, phone: form.phone });

      // Cập nhật agency info
      if (agency?.id) {
        const token = localStorage.getItem('smc-token');
        const res = await fetch(`/api/agency.php?action=update/${agency.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            contactPerson: form.contactPerson,
            phone: form.phone,
            address: form.address,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
      }

      toast.success('Cập nhật thông tin thành công!');
      setEditing(false);
      fetchAgencyInfo();
    } catch (err) {
      toast.error('Có lỗi: ' + (err.message || 'Không thể cập nhật'));
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword) { toast.error('Vui lòng nhập mật khẩu hiện tại'); return; }
    if (!pwForm.newPassword || pwForm.newPassword.length < 6) { toast.error('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Mật khẩu xác nhận không khớp'); return; }
    setPwSaving(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      toast.success('Đổi mật khẩu thành công!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err) {
      toast.error(err.message || 'Đổi mật khẩu thất bại');
    } finally { setPwSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Quản lý tài khoản</h1>
        <p className="text-slate-500 mt-1">Thông tin đại lý và tài khoản đăng nhập</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold ring-4 ring-white/20">
              {user?.fullName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{user?.fullName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge bg-white/20 text-white">
                  <Building2 size={12} className="mr-1 inline" />
                  {ROLE_LABELS?.[user?.role]?.label || 'Đại lý'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Thông tin đại lý */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              <Building2 size={14} className="inline mr-1" /> Thông tin đại lý
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Tên đại lý</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 font-medium">
                  {agency?.name || '---'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mã đại lý</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 font-mono">
                  {agency?.code || '---'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Chiết khấu</label>
                <div className="text-sm font-bold text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                  {agency?.discountPercent || 0}%
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Chủ thể</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  {agency?.subjectType === 'all' ? 'Tất cả' : agency?.subjectType === 'vlos' ? 'VLOS (Hạng A)' : 'BVLOS (Hạng B)'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mã số thuế</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  {agency?.taxCode || '---'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Trạng thái</label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  <span className={`badge ${agency?.status === 'active' ? 'badge-emerald' : 'badge-red'}`}>
                    {agency?.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Thông tin cá nhân */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              <User size={14} className="inline mr-1" /> Thông tin cá nhân
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email đăng nhập
                </label>
                <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  {user?.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Số điện thoại
                </label>
                {editing ? (
                  <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="input-field" placeholder="Nhập số điện thoại" />
                ) : (
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{user?.phone || 'Chưa cập nhật'}</div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Người liên hệ
                </label>
                {editing ? (
                  <input type="text" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})}
                    className="input-field" placeholder="Tên người liên hệ" />
                ) : (
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{agency?.contactPerson || user?.fullName}</div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Địa chỉ
                </label>
                {editing ? (
                  <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    className="input-field" placeholder="Địa chỉ đại lý" />
                ) : (
                  <div className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">{agency?.address || 'Chưa cập nhật'}</div>
                )}
              </div>
            </div>
          </div>

          {/* Thông tin hệ thống */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              <Shield size={14} className="inline mr-1" /> Thông tin hệ thống
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 truncate">{user?.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Ngày tạo</label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }) : '---'}
                </p>
              </div>
            </div>
          </div>

          {/* Đổi mật khẩu */}
          <div>
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors"
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
                      onChange={e => setPwForm({...pwForm, currentPassword: e.target.value})}
                      className="input-field pr-10" placeholder="Nhập mật khẩu hiện tại"
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                      onChange={e => setPwForm({...pwForm, newPassword: e.target.value})}
                      className="input-field pr-10" placeholder="Tối thiểu 6 ký tự"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Xác nhận mật khẩu mới</label>
                  <input
                    type="password" value={pwForm.confirmPassword}
                    onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})}
                    className="input-field" placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
                <button
                  onClick={handleChangePassword} disabled={pwSaving}
                  className="btn-primary flex items-center gap-2 w-full justify-center"
                >
                  {pwSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Lock className="w-4 h-4" />}
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
                  fetchAgencyInfo();
                }}
                className="btn-ghost"
              >
                Hủy
              </button>
              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-primary flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" /> Chỉnh sửa thông tin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
