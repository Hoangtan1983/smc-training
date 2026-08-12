import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Edit3, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';

/**
 * Quản lý người dùng cho Nhân viên (Staff)
 * Chỉ xem và sửa học viên (STUDENT). Không xóa, không tạo mới, không xem role khác.
 */
export default function StaffUserManager() {
  const { getAllUsers, updateUser, ROLE_LABELS } = useAuth();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const data = await getAllUsers();
    // Chỉ hiển thị học viên
    setUsers(data.filter(u => u.role === 'STUDENT'));
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ fullName: user.fullName, email: user.email, phone: user.phone || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) { toast.error('Vui lòng nhập đầy đủ họ tên và email'); return; }
    try {
      await updateUser(editingUser.id, { fullName: form.fullName, email: form.email, phone: form.phone });
      toast.success('Cập nhật học viên thành công!');
    } catch (err) { toast.error(err.message || 'Lỗi cập nhật'); return; }
    setShowModal(false); refresh();
  };

  const columns = [
    {
      key: 'user', label: 'Học viên',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div>
          <span className="text-sm font-medium text-gray-900">{u.fullName}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u) => <span className="text-sm text-gray-500">{u.email}</span> },
    { key: 'phone', label: 'SĐT', render: (u) => <span className="text-sm text-gray-500">{u.phone || '—'}</span> },
    {
      key: 'status', label: 'Trạng thái',
      render: (u) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
          {u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý học viên</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} học viên — Nhân viên có thể sửa thông tin (họ tên, email, SĐT)</p>
        </div>
      </div>

      <ExpandableDataTable
        data={users}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ statusFilter: true }}
        emptyIcon={Users}
        emptyText="Không tìm thấy học viên"
        renderExpanded={(u) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-medium text-gray-900">{u.fullName}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{u.email}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{u.phone || '—'}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-medium ${u.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">Ngày tạo</p><p className="text-sm text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '—'}</p></div>
            <div><p className="text-xs text-gray-400 uppercase font-semibold">ID</p><p className="text-xs text-gray-400 font-mono">{u.id}</p></div>
            <div className="flex items-end gap-2">
              <button onClick={() => openEdit(u)} className="btn-ghost text-xs flex items-center gap-1 text-blue-600"><Edit3 className="w-3.5 h-3.5" /> Sửa</button>
            </div>
          </div>
        )}
        actions={(u) => (
          <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Sửa"><Edit3 className="w-4 h-4" /></button>
        )}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b"><h3 className="text-lg font-bold text-gray-900">Chỉnh sửa học viên</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Lưu thay đổi</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
