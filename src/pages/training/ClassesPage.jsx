import { useState, useEffect } from 'react';
import { School, Plus, Edit3, Trash2, X, Check, Search, Users, Calendar, Clock } from 'lucide-react';
import { apiGetClasses, apiCreateClass, apiUpdateClass, apiDeleteClass, apiGetCourses } from '../../data/api';
import toast from 'react-hot-toast';

export default function ClassesPage() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', course: '', teacher: '', schedule: '', maxStudents: 20, status: 'ACTIVE', startDate: '' });

  const loadClasses = async () => {
    try {
      const data = await apiGetClasses();
      const list = Array.isArray(data) ? data : [];
      const mapped = list.map(c => ({
        id: c.id, name: c.name || '', course: c.course?.name || '—',
        teacher: c.instructor?.fullName || '—', schedule: c.schedule || '—',
        students: (c.student_ids || c._enrollments || []).length, maxStudents: c.maxStudents || 20,
        status: c.status === 'open' ? 'ACTIVE' : c.status || 'ACTIVE',
        startDate: c.startDate || '',
        course_id: c.courseId || c.course_id || '',
        teacher_ids: c.instructorIds || c.teacher_ids || [],
      }));
      setClasses(mapped);
    } catch {
      try { setClasses(JSON.parse(localStorage.getItem('smc-classes') || '[]')); } catch {}
    }
    setLoading(false);
  };

  useEffect(() => { loadClasses(); }, []);

  const filtered = classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.course.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditing(null); setForm({ name: '', course: '', teacher: '', schedule: '', maxStudents: 20, status: 'ACTIVE', startDate: '' }); setShowModal(true); };
  const openEdit = (cls) => { setEditing(cls); setForm({ ...cls }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.course) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    try {
      if (editing) {
        await apiUpdateClass(editing.id, form);
        toast.success('Cập nhật lớp học!');
      } else {
        await apiCreateClass({ name: form.name, courseId: form.course_id || '', instructorIds: form.teacher_ids || [], schedule: form.schedule, maxStudents: form.maxStudents, status: form.status === 'ACTIVE' ? 'open' : 'closed', startDate: form.startDate || new Date().toISOString() });
        toast.success('Thêm lớp học mới!');
      }
      await loadClasses();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
    setShowModal(false);
  };

  const handleDelete = async (cls) => {
    if (!window.confirm(`Xóa lớp "${cls.name}"?`)) return;
    try {
      await apiDeleteClass(cls.id);
      toast.success('Đã xóa!');
      await loadClasses();
    } catch (err) {
      toast.error('Lỗi khi xóa: ' + (err.message || 'Không thể kết nối'));
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Lớp học</h1><p className="text-sm text-gray-500 mt-0.5">{classes.length} lớp học</p></div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Thêm lớp học</button>
      </div>

      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm lớp học..." /></div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(cls => (
          <div key={cls.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><School className="w-5 h-5 text-amber-600" /></div>
                <div><h3 className="font-bold text-gray-900">{cls.name}</h3><p className="text-xs text-gray-500 mt-0.5">{cls.course}</p></div>
              </div>
              <span className={`badge text-xs ${cls.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cls.status === 'ACTIVE' ? 'Đang học' : 'Đã kết thúc'}</span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600"><Users className="w-4 h-4 text-gray-400" />{cls.students}/{cls.maxStudents} học viên</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4 text-gray-400" />{cls.schedule}</div>
              <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar className="w-4 h-4 text-gray-400" />Bắt đầu: {cls.startDate ? new Date(cls.startDate).toLocaleDateString('vi-VN') : '—'}</div>
            </div>
            <div className="flex justify-end gap-1">
              <button onClick={() => openEdit(cls)} className="p-1.5 text-gray-400 hover:text-smc-500 hover:bg-smc-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(cls)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="md:col-span-2 text-center py-12 text-gray-400"><School className="w-8 h-8 mx-auto mb-2 opacity-50" />Không tìm thấy lớp học nào</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-bold">{editing ? 'Chỉnh sửa lớp học' : 'Thêm lớp học mới'}</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tên lớp *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="VD: UAV-A-K01" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Khóa học *</label><input type="text" value={form.course} onChange={e => setForm({...form, course: e.target.value})} className="input-field" placeholder="VD: UAV Hạng A (VLOS)" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Giáo viên</label><input type="text" value={form.teacher} onChange={e => setForm({...form, teacher: e.target.value})} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Lịch học</label><input type="text" value={form.schedule} onChange={e => setForm({...form, schedule: e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Sĩ số tối đa</label><input type="number" value={form.maxStudents} onChange={e => setForm({...form, maxStudents: parseInt(e.target.value)})} className="input-field" min={1} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Ngày bắt đầu</label><input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Trạng thái</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field"><option value="ACTIVE">Đang học</option><option value="CLOSED">Đã kết thúc</option></select></div>
              </div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1">{editing ? 'Lưu thay đổi' : 'Thêm lớp học'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
