import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { onDataChange, emitDataChange, apiGetClasses } from '../../data/api';
import { GraduationCap, Plus, Edit3, Trash2, X, Check, UserPlus, School, Users, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';

export default function StaffTeachers() {
  const { getAllUsers, createUser, updateUser, deleteUser } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: 'teacher123' });

  const loadAll = async () => {
    const [userData, classData] = await Promise.all([getAllUsers(), apiGetClasses().catch(() => [])]);
    setTeachers(userData.filter(u => u.role === 'TEACHER'));
    setClasses(Array.isArray(classData) ? classData : []);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { return onDataChange('users', () => { loadAll(); }); }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'users' || detail?.changed === 'classes') { loadAll(); }
    });
  }, []);

  const getTeacherClasses = (teacherId) => classes.filter(c => (c.teacher_ids || []).includes(teacherId));
  const getStudentCount = (teacherId) => getTeacherClasses(teacherId).reduce((sum, c) => sum + (c.student_ids || []).length, 0);

  const openCreate = () => { setEditingUser(null); setForm({ fullName: '', email: '', phone: '', password: 'teacher123' }); setShowModal(true); };
  const openEdit = (t) => { setEditingUser(t); setForm({ fullName: t.fullName || '', email: t.email || '', phone: t.phone || '', password: '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName) { toast.error('Vui lòng nhập họ tên'); return; }
    if (!form.email && !form.phone) { toast.error('Vui lòng nhập Email hoặc SĐT'); return; }
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { fullName: form.fullName, phone: form.phone, email: form.email, ...(form.password ? { password: form.password } : {}) });
        toast.success('Đã cập nhật giáo viên!');
      } else {
        await createUser({ fullName: form.fullName, email: form.email || `${form.phone}@teacher.smc.vn`, phone: form.phone, password: form.password || 'teacher123', role: 'TEACHER' });
        toast.success('Đã thêm giáo viên mới!');
      }
      emitDataChange('users', { action: editingUser ? 'updated' : 'created' });
      setShowModal(false); loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Xóa giáo viên "${t.fullName}"?`)) return;
    try { await deleteUser(t.id); toast.success('Đã xóa giáo viên'); loadAll(); }
    catch (err) { toast.error('Lỗi: ' + (err.message || 'Không thể xóa')); }
  };

  const columns = [
    {
      key: 'teacher', label: 'Giáo viên',
      render: (t) => (
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">{t.fullName?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div className="font-semibold text-gray-900">{t.fullName}</div>
            <div className="text-xs text-gray-500 flex items-center gap-3">
              {t.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{t.email}</span>}
              {t.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{t.phone}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'classes', label: 'Phụ trách',
      render: (t) => {
        const myClasses = getTeacherClasses(t.id);
        const count = getStudentCount(t.id);
        return (
          <div className="flex items-center gap-2">
            <span className="badge bg-blue-50 text-blue-700 text-xs flex items-center gap-1"><School className="w-3 h-3" /> {myClasses.length} lớp</span>
            <span className="badge bg-green-50 text-green-700 text-xs flex items-center gap-1"><Users className="w-3 h-3" /> {count} HV</span>
          </div>
        );
      },
    },
    {
      key: 'phone', label: 'SĐT',
      render: (t) => <span className="text-sm text-gray-500">{t.phone || '—'}</span>,
    },
    {
      key: 'status', label: 'Trạng thái',
      render: (t) => (
        <span className={`badge text-xs ${t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {t.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Giáo viên</h1>
          <p className="text-sm text-gray-500 mt-0.5">{teachers.length} giáo viên</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm"><UserPlus className="w-4 h-4" /> Thêm giáo viên</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-blue-600">{teachers.length}</div><div className="text-xs text-gray-500 mt-1">Tổng giáo viên</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-purple-600">{classes.length}</div><div className="text-xs text-gray-500 mt-1">Tổng lớp học</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-green-600">{teachers.reduce((sum, t) => sum + getStudentCount(t.id), 0)}</div><div className="text-xs text-gray-500 mt-1">Học viên đang dạy</div></div>
      </div>

      <ExpandableDataTable
        data={teachers}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ statusFilter: true, dateFilter: true, dateField: 'createdAt' }}
        emptyIcon={GraduationCap}
        emptyText="Không tìm thấy giáo viên"
        renderExpanded={(t) => {
          const myClasses = getTeacherClasses(t.id);
          return (
            <div>
              {myClasses.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lớp đang phụ trách ({myClasses.length})</h4>
                  <div className="space-y-2">
                    {myClasses.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border">
                        <div>
                          <span className="font-medium text-gray-800">{c.name}</span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-xs text-gray-500">{(c.student_ids || []).length} học viên</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('vi-VN') : '—'}
                          {' → '}
                          {c.end_date ? new Date(c.end_date).toLocaleDateString('vi-VN') : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chưa được phân công lớp nào</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-3 border-t">
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{t.email}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{t.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Ngày tạo</p><p className="text-sm text-gray-700">{t.createdAt ? new Date(t.createdAt).toLocaleString('vi-VN') : '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-medium ${t.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{t.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></div>
              </div>
            </div>
          );
        }}
        actions={(t) => (
          <>
            <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Sửa"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(t)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      />

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-blue-500" />{editingUser ? 'Sửa giáo viên' : 'Thêm giáo viên mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" placeholder="Nguyễn Văn A" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="09xxxxxxxx" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" placeholder="email@example.com" disabled={!!editingUser} /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mật khẩu {!editingUser && '(mặc định: teacher123)'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder={editingUser ? 'Để trống nếu không đổi' : 'teacher123'} /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">{saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : editingUser ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{saving ? 'Đang lưu...' : editingUser ? 'Lưu thay đổi' : 'Thêm giáo viên'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
