import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserCog, Edit3, Trash2, Plus, X, Check, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';

export default function AdminUserManager() {
  const { getAllUsers, createUser, updateUser, deleteUser, ROLE_LABELS } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'STUDENT', phone: '' });

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const data = await getAllUsers();
    setUsers(data);
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ fullName: '', email: '', password: '', role: 'STUDENT', phone: '' });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ fullName: user.fullName, email: user.email, password: '', role: user.role, phone: user.phone || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) { toast.error('Vui lòng nhập đầy đủ họ tên và email'); return; }
    if (editingUser) {
      try {
        await updateUser(editingUser.id, { fullName: form.fullName, email: form.email, role: form.role, phone: form.phone, ...(form.password ? { password: form.password } : {}) });
        toast.success('Cập nhật người dùng thành công!');
      } catch (err) { toast.error(err.message || 'Lỗi cập nhật'); return; }
    } else {
      if (!form.password) { toast.error('Vui lòng nhập mật khẩu'); return; }
      try { await createUser(form); toast.success('Tạo người dùng mới thành công!'); }
      catch (err) { toast.error(err.message || 'Lỗi tạo người dùng'); return; }
    }
    setShowModal(false); refresh();
  };

  const handleDelete = async (user) => {
    const adminCount = users.filter(u => u.role === 'ADMIN').length;
    if (user.role === 'ADMIN' && adminCount <= 1) { toast.error('Không thể xóa Admin cuối cùng'); return; }
    const accountantCount = users.filter(u => u.role === 'ACCOUNTANT').length;
    if (user.role === 'ACCOUNTANT' && accountantCount <= 1) { toast.error('Không thể xóa Kế toán cuối cùng'); return; }
    if (window.confirm(`Bạn có chắc muốn xóa "${user.fullName}"?`)) {
      await deleteUser(user.id); toast.success('Đã xóa người dùng'); refresh();
    }
  };

  const handleToggleStatus = async (user) => {
    // PENDING → ACTIVE (kích hoạt); ACTIVE ↔ FROZEN (khóa/mở khóa)
    let newStatus;
    if (user.status === 'PENDING') {
      newStatus = 'ACTIVE';
    } else {
      newStatus = user.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';
    }
    await updateUser(user.id, { status: newStatus });
    if (user.status === 'PENDING') toast.success('Đã kích hoạt tài khoản');
    else toast.success(newStatus === 'ACTIVE' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
    refresh();
  };

  const roles = ['ADMIN', 'STAFF', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'AGENCY'];
  const roleLabelMap = {};
  roles.forEach(r => { roleLabelMap[r] = ROLE_LABELS[r]?.label || r; });

  const columns = [
    {
      key: 'user', label: 'Người dùng',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div>
          <span className="text-sm font-medium text-gray-900">{u.fullName}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u) => <span className="text-sm text-gray-500">{u.email}</span> },
    { key: 'phone', label: 'SĐT', render: (u) => <span className="text-sm text-gray-500">{u.phone || '—'}</span> },
    { key: 'role', label: 'Vai trò', render: (u) => <span className={`badge ${ROLE_LABELS[u.role]?.badge || 'badge-student'}`}>{roleLabelMap[u.role]}</span> },
    {
      key: 'status', label: 'Trạng thái',
      render: (u) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(u); }}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : u.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-500' : u.status === 'PENDING' ? 'bg-amber-500' : 'bg-red-500'}`} />
          {u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'PENDING' ? 'Chờ duyệt' : 'Đã khóa'}
        </button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý người dùng</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} người dùng</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openCreate} className="btn-primary flex items-center gap-2"><UserPlus className="w-4 h-4" /> Tạo người dùng</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {roles.map(role => (
          <div key={role} className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-blue-600">{users.filter(u => u.role === role).length}</div>
            <div className="text-xs text-gray-500 mt-1">{roleLabelMap[role]}</div>
          </div>
        ))}
      </div>

      <ExpandableDataTable
        data={users}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ roleFilter: true, statusFilter: true, dateFilter: true, dateField: 'createdAt' }}
        roleOptions={roles}
        roleLabelMap={roleLabelMap}
        emptyIcon={UserCog}
        emptyText="Không tìm thấy người dùng"
        renderExpanded={(u) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-medium text-gray-900">{u.fullName}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{u.email}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{u.phone || '—'}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Vai trò</p><span className={`badge ${ROLE_LABELS[u.role]?.badge || 'badge-student'}`}>{roleLabelMap[u.role]}</span></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-medium ${u.status === 'ACTIVE' ? 'text-green-600' : u.status === 'PENDING' ? 'text-amber-600' : 'text-red-600'}`}>{u.status === 'ACTIVE' ? 'Hoạt động' : u.status === 'PENDING' ? 'Chờ duyệt' : 'Đã khóa'}</span></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Ngày tạo</p><p className="text-sm text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '—'}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">ID</p><p className="text-xs text-gray-400 font-mono">{u.id}</p></div>
            <div className="flex items-end gap-2">
              <button onClick={() => openEdit(u)} className="btn-ghost text-xs flex items-center gap-1 text-blue-600"><Edit3 className="w-3.5 h-3.5" /> Sửa</button>
              <button onClick={() => handleToggleStatus(u)} className={`btn-ghost text-xs flex items-center gap-1 ${u.status === 'ACTIVE' ? 'text-red-600' : 'text-green-600'}`}>{u.status === 'ACTIVE' ? 'Khóa' : u.status === 'PENDING' ? 'Kích hoạt' : 'Mở khóa'}</button>
            </div>
          </div>
        )}
        actions={(u) => (
          <>
            <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Sửa"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b"><h3 className="text-lg font-bold text-gray-900">{editingUser ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mật khẩu {!editingUser && '*'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder={editingUser ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'} /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Vai trò</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input-field">{roles.map(r => <option key={r} value={r}>{roleLabelMap[r]}</option>)}</select></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">{editingUser ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editingUser ? 'Lưu thay đổi' : 'Tạo người dùng'}</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
