import { useState, useEffect } from 'react';
import { genId } from '../../data/store';
import { apiGetCourses, apiCreateCourse, apiUpdateCourse, apiDeleteCourse, apiGetClasses } from '../../data/api';
import { Plus, Edit3, Trash2, X, Search, BookOpen, School, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', total_hours_theory: 0, total_hours_practice: 0, min_fly_hours: 20, tuition_fee: 0, rank: 'A', status: 'active' });

  const loadAll = async () => {
    try {
      const [courseData, classData] = await Promise.all([
        apiGetCourses(),
        apiGetClasses().catch(() => []),
      ]);
      setCourses(Array.isArray(courseData) ? courseData : (courseData.data || []));
      setClasses(Array.isArray(classData) ? classData : []);
    } catch (e) {
      toast.error('Không thể tải dữ liệu từ server');
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // Lấy danh sách lớp thuộc 1 khóa học
  const getClassesForCourse = (courseId) => classes.filter(c => c.course_id === courseId);

  const filtered = courses.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', total_hours_theory: 0, total_hours_practice: 0, min_fly_hours: 20, tuition_fee: 0, rank: 'A', status: 'active' }); setShowModal(true); };
  const openEdit = c => { setEditing(c); setForm({ ...c }); setShowModal(true); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name) { toast.error('Vui lòng nhập tên khóa học'); return; }
    try {
      if (editing) {
        await apiUpdateCourse(editing.id, form);
        toast.success('Cập nhật thành công!');
      } else {
        await apiCreateCourse({ ...form, id: genId('c'), modules: [], price: form.tuition_fee, tuition_fee: form.tuition_fee });
        toast.success('Thêm khóa học mới!');
      }
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối đến server'));
    }
    setShowModal(false);
  };

  const handleDelete = async c => {
    if (window.confirm(`Xóa "${c.name}"?`)) {
      try {
        await apiDeleteCourse(c.id);
        await loadAll();
        toast.success('Đã xóa');
      } catch (err) {
        toast.error('Lỗi khi xóa: ' + (err.message || 'Không thể kết nối'));
      }
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Quản lý khóa học</h1><p className="text-sm text-gray-500 mt-0.5">{courses.length} khóa học</p></div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Thêm khóa học</button>
      </div>
      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm khóa học..." /></div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(c => {
          const courseClasses = getClassesForCourse(c.id);
          return (
          <div key={c.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-500" /></div><div><h3 className="font-bold text-gray-900">{c.name}</h3><p className="text-xs text-gray-500">{c.code}</p></div></div>
              <span className={`badge text-xs ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status === 'active' ? 'Đang mở' : 'Đã đóng'}</span>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.total_hours_theory + c.total_hours_practice}h</div><div className="text-xs text-gray-400">Tổng giờ</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.min_fly_hours}h</div><div className="text-xs text-gray-400">Bay tối thiểu</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{(c.tuition_fee || c.price || 0).toLocaleString('vi-VN')}đ</div><div className="text-xs text-gray-400">Học phí</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{c.modules?.length || 0}</div><div className="text-xs text-gray-400">Học phần</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-sm font-bold">{courseClasses.length}</div><div className="text-xs text-gray-400">Lớp</div></div>
            </div>
            {/* Danh sách lớp thuộc khóa */}
            {courseClasses.length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1 flex items-center gap-1"><School className="w-3 h-3" /> Lớp học ({courseClasses.length})</p>
                {courseClasses.map(cls => (
                  <div key={cls.id} className="flex items-center justify-between bg-blue-50/50 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-medium text-gray-700">{cls.name}</span>
                    <span className="text-gray-400 flex items-center gap-1"><Users className="w-3 h-3" /> {(cls.student_ids || []).length}/{cls.max_students || 20}</span>
                  </div>
                ))}
              </div>
            )}
            {courseClasses.length === 0 && (
              <p className="text-xs text-gray-400 mb-4 italic flex items-center gap-1"><School className="w-3 h-3" /> Chưa có lớp học nào</p>
            )}
            <div className="flex items-center justify-between"><span className="text-sm font-semibold">{c.total_hours_theory + c.total_hours_practice}h</span><div className="flex gap-1"><button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button></div></div>
          </div>
        )})}
        {filtered.length === 0 && <div className="md:col-span-2 text-center py-12 text-gray-400"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />Không tìm thấy khóa học</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><h3 className="text-lg font-bold">{editing ? 'Sửa khóa học' : 'Thêm khóa học'}</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Tên khóa học *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mã khóa</label><input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Học phí (VNĐ)</label><input type="number" value={form.tuition_fee} onChange={e => setForm({...form, tuition_fee: +e.target.value})} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Hạng thi</label><select value={form.rank} onChange={e => setForm({...form, rank: e.target.value})} className="input-field"><option value="A">VLOS (Hạng A)</option><option value="B">BVLOS (Hạng B)</option></select></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Bay tối thiểu</label><input type="number" value={form.min_fly_hours} onChange={e => setForm({...form, min_fly_hours: +e.target.value})} className="input-field" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Giờ lý thuyết</label><input type="number" value={form.total_hours_theory} onChange={e => setForm({...form, total_hours_theory: +e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Giờ thực hành</label><input type="number" value={form.total_hours_practice} onChange={e => setForm({...form, total_hours_practice: +e.target.value})} className="input-field" /></div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field"><option value="active">Đang mở</option><option value="inactive">Đã đóng</option></select>
              </div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1">{editing ? 'Lưu thay đổi' : 'Thêm khóa học'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
