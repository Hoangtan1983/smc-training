import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, Search, Calendar, UserPlus, Edit3, Trash2, X, Plus, Check, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const { getAllUsers, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '' });

  useEffect(() => {
    getAllUsers().then(data => setUsers(data.filter(u => u.role === 'STUDENT')));
  }, []);

  const refreshUsers = async () => {
    const data = await getAllUsers();
    setUsers(data.filter(u => u.role === 'STUDENT'));
  };

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    return u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({ fullName: '', email: '', password: '', phone: '' });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({ fullName: user.fullName, email: user.email, password: '', phone: user.phone || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    if (editingUser) {
      await updateUser(editingUser.id, { fullName: form.fullName, phone: form.phone, ...(form.password ? { password: form.password } : {}) });
      toast.success('Cập nhật học viên thành công!');
    } else {
      if (!form.password) { toast.error('Vui lòng nhập mật khẩu'); return; }
      await createUser({ ...form, role: 'STUDENT' });
      toast.success('Thêm học viên thành công!');
    }
    setShowModal(false);
    refreshUsers();
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Xóa học viên "${user.fullName}"?`)) { await deleteUser(user.id); toast.success('Đã xóa học viên'); refreshUsers(); }
  };

  const handleToggleStatus = async (user) => {
    await updateUser(user.id, { status: user.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE' });
    toast.success(user.status === 'ACTIVE' ? 'Đã khóa tài khoản' : 'Đã mở khóa');
    refreshUsers();
  };

  const stats = { total: users.length, active: users.filter(s => s.status === 'ACTIVE').length, blocked: users.filter(s => s.status !== 'ACTIVE').length };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Học viên</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} học viên</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2"><UserPlus className="w-4 h-4" /> Thêm học viên</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><UserCheck className="w-5 h-5 text-blue-500" /></div><div><div className="text-xl font-bold">{stats.total}</div><div className="text-xs text-gray-500">Tổng học viên</div></div></div>
        <div className="card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Check className="w-5 h-5 text-green-500" /></div><div><div className="text-xl font-bold">{stats.active}</div><div className="text-xs text-gray-500">Hoạt động</div></div></div>
        <div className="card p-5 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><X className="w-5 h-5 text-red-500" /></div><div><div className="text-xl font-bold">{stats.blocked}</div><div className="text-xs text-gray-500">Đã khóa</div></div></div>
      </div>

      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm học viên..." /></div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Học viên</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">SĐT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Trạng thái</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-smc-400 to-smc-600 flex items-center justify-center text-white text-xs font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div><span className="text-sm font-medium text-gray-900">{u.fullName}</span></div></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.phone || '—'}</td>
                  <td className="px-4 py-3"><button onClick={() => handleToggleStatus(u)} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}><span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />{u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</button></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => openEditModal(u)} className="p-1.5 text-gray-400 hover:text-smc-500 hover:bg-smc-50 rounded-lg"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400"><UserCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />Không tìm thấy học viên nào</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingUser ? 'Chỉnh sửa học viên' : 'Thêm học viên mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Họ tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" disabled={!!editingUser} required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mật khẩu {!editingUser && '*'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder={editingUser ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1">{editingUser ? 'Lưu thay đổi' : 'Thêm học viên'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
