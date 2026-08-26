import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GraduationCap, Edit3, Trash2, Plus, X, Check, School, Users, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';
import { onDataChange } from '../../data/api';

export default function AdminTeachers() {
  const { getAllUsers, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });

  const loadAll = useCallback(async () => {
    const data = await getAllUsers();
    setUsers(data.filter(u => u.role === 'TEACHER'));
    try {
      const { apiGetClasses } = await import('../../data/api');
      const clsData = await apiGetClasses().catch(() => []);
      setClasses(Array.isArray(clsData) ? clsData : []);
    } catch { setClasses([]); }
  }, [getAllUsers]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Đồng bộ liên tài khoản
  useEffect(() => {
    const unsub1 = onDataChange('classes', () => loadAll());
    const unsub2 = onDataChange('all', (d) => { if (['classes', 'users'].includes(d?.changed)) loadAll(); });
    return () => { unsub1(); unsub2(); };
  }, [loadAll]);

  const getTeacherClasses = (teacherId) => classes.filter(c => (c.teacher_ids || []).includes(teacherId));
  const getStudentCount = (teacherId) => getTeacherClasses(teacherId).reduce((sum, c) => sum + (c.student_ids || []).length, 0);

  const openCreate = () => { setEditingUser(null); setForm({ fullName: '', email: '', phone: '', password: '' }); setShowModal(true); };
  const openEdit = u => { setEditingUser(u); setForm({ fullName: u.fullName, email: u.email, phone: u.phone || '', password: '' }); setShowModal(true); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.fullName || !form.email) { toast.error('Vui lòng điền đủ thông tin'); return; }
    if (editingUser) {
      try { await updateUser(editingUser.id, { fullName: form.fullName, phone: form.phone, ...(form.password ? { password: form.password } : {}) }); toast.success('Cập nhật giáo viên!'); }
      catch (err) { toast.error(err.message || 'Lỗi cập nhật'); return; }
    } else {
      if (!form.password) { toast.error('Vui lòng nhập mật khẩu'); return; }
      try { await createUser({ ...form, role: 'TEACHER' }); toast.success('Thêm giáo viên!'); }
      catch (err) { toast.error(err.message || 'Lỗi tạo giáo viên'); return; }
    }
    setShowModal(false); loadAll();
  };

  const handleDelete = async u => { if (window.confirm(`Xóa "${u.fullName}"?`)) { await deleteUser(u.id); toast.success('Đã xóa'); loadAll(); } };

  const columns = [
    {
      key: 'teacher', label: 'Giáo viên',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div className="text-sm font-medium text-gray-900">{u.fullName}</div>
            <div className="text-xs text-gray-400">{u.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'SĐT', render: (u) => <span className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{u.phone || '—'}</span> },
    {
      key: 'classes', label: 'Lớp phụ trách',
      render: (u) => {
        const myClasses = getTeacherClasses(u.id);
        const count = getStudentCount(u.id);
        return (
          <div className="flex items-center gap-2">
            <span className="badge bg-blue-50 text-blue-700 text-xs flex items-center gap-1"><School className="w-3 h-3" /> {myClasses.length} lớp</span>
            <span className="badge bg-green-50 text-green-700 text-xs flex items-center gap-1"><Users className="w-3 h-3" /> {count} HV</span>
          </div>
        );
      },
    },
    {
      key: 'createdAt', label: 'Ngày tạo',
      render: (u) => <span className="text-xs text-gray-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</span>,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Quản lý giáo viên</h1><p className="text-sm text-gray-500 mt-0.5">{users.length} giáo viên</p></div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Thêm giáo viên</button>
      </div>

      <ExpandableDataTable
        data={users}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ dateFilter: true, dateField: 'createdAt', statusFilter: true }}
        emptyIcon={GraduationCap}
        emptyText="Không tìm thấy giáo viên"
        renderExpanded={(u) => {
          const myClasses = getTeacherClasses(u.id);
          return (
            <div>
              {myClasses.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lớp đang phụ trách ({myClasses.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {myClasses.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border">
                        <div>
                          <p className="font-medium text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-400">{(c.student_ids || []).length} học viên</p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('vi-VN') : '—'} → {c.end_date ? new Date(c.end_date).toLocaleDateString('vi-VN') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chưa được phân công lớp nào</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-3 border-t">
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{u.email}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{u.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Ngày tạo</p><p className="text-sm text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-medium ${u.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{u.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></div>
              </div>
            </div>
          );
        }}
        actions={(u) => (
          <>
            <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b"><h3 className="text-lg font-bold">{editingUser ? 'Sửa giáo viên' : 'Thêm giáo viên'}</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" disabled={!!editingUser} required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mật khẩu {!editingUser && '*'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder={editingUser ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'} /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1">{editingUser ? 'Lưu thay đổi' : 'Thêm giáo viên'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
