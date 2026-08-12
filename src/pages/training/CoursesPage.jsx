import { useState, useEffect } from 'react';
import { GraduationCap, Plus, Edit3, Trash2, X, Check, Search, BookOpen } from 'lucide-react';
import { apiGetCourses, apiCreateCourse, apiUpdateCourse, apiDeleteCourse } from '../../data/api';
import toast from 'react-hot-toast';

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', duration: '', modules: 1, level: 'Cơ bản', status: 'ACTIVE', price: '' });

  const loadCourses = async () => {
    try {
      const data = await apiGetCourses();
      const list = Array.isArray(data) ? data : (data.data || []);
      const mapped = list.map(c => ({
        id: c.id, title: c.name || '', description: c.description || '',
        duration: c.totalHours || ((c.total_hours_theory || 0) + (c.total_hours_practice || 0) + (c.total_hours_review || 0)) + ' giờ', modules: c.modules?.length || 0, level: c.licenseTypeCode || 'Cơ bản',
        status: c.status === 'active' ? 'ACTIVE' : c.status || 'ACTIVE',
        price: '—',
        students: 0,
      }));
      setCourses(mapped);
    } catch {
      // fallback to localStorage cache
      try { setCourses(JSON.parse(localStorage.getItem('smc-courses') || '[]')); } catch {}
    }
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);

  const filtered = courses.filter(c => (c.title || '').toLowerCase().includes(search.toLowerCase()) || (c.description || '').toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditing(null); setForm({ title: '', description: '', duration: '', modules: 1, level: 'Cơ bản', status: 'ACTIVE', price: '' }); setShowModal(true); };
  const openEdit = (course) => { setEditing(course); setForm({ ...course }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    try {
      if (editing) {
        await apiUpdateCourse(editing.id, form);
        toast.success('Cập nhật khóa học!');
      } else {
        await apiCreateCourse({ name: form.title, description: form.description, price: parseInt((form.price || '0').replace(/[^0-9]/g, '')), licenseTypeCode: form.level, status: form.status === 'ACTIVE' ? 'active' : 'inactive' });
        toast.success('Thêm khóa học mới!');
      }
      await loadCourses();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối đến server'));
    }
    setShowModal(false);
  };

  const handleDelete = async (course) => {
    if (!window.confirm(`Xóa khóa học "${course.title}"?`)) return;
    try {
      await apiDeleteCourse(course.id);
      toast.success('Đã xóa!');
      await loadCourses();
    } catch (err) {
      toast.error('Lỗi khi xóa: ' + (err.message || 'Không thể kết nối'));
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Khóa học</h1>
          <p className="text-sm text-gray-500 mt-0.5">{courses.length} khóa học</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Thêm khóa học</button>
      </div>

      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm khóa học..." /></div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-smc-50 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-smc-500" /></div>
                <div><h3 className="font-bold text-gray-900">{c.title}</h3><p className="text-xs text-gray-500 mt-0.5">{c.description}</p></div>
              </div>
              <span className={`badge text-xs ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.duration}</div><div className="text-xs text-gray-400">Thời lượng</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.modules} học phần</div><div className="text-xs text-gray-400">Module</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.level}</div><div className="text-xs text-gray-400">Cấp độ</div></div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{c.price}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-smc-500 hover:bg-smc-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="md:col-span-2 text-center py-12 text-gray-400"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />Không tìm thấy khóa học nào</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-bold">{editing ? 'Chỉnh sửa khóa học' : 'Thêm khóa học mới'}</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tên khóa học *</label><input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Mô tả *</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" rows={2} required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Thời lượng</label><input type="text" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Học phần</label><input type="number" value={form.modules} onChange={e => setForm({...form, modules: parseInt(e.target.value)})} className="input-field" min={1} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Cấp độ</label><select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="input-field"><option>Cơ bản</option><option>Trung cấp</option><option>Nâng cao</option></select></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Học phí</label><input type="text" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Trạng thái</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field"><option value="ACTIVE">Đang mở</option><option value="CLOSED">Đã đóng</option></select></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1">{editing ? 'Lưu thay đổi' : 'Thêm khóa học'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
