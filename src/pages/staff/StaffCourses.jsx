import { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Edit2, Trash2, Clock, Users, School } from 'lucide-react';
import { apiGetCourses, apiGetClasses, apiCreateCourse, apiUpdateCourse, apiDeleteCourse, emitDataChange, onDataChange } from '../../data/api';
import toast from 'react-hot-toast';

export default function StaffCourses() {
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', hours: 140, description: '', status: 'ACTIVE' });

  const loadCourses = async () => {
    try {
      const [courseData, classData] = await Promise.all([
        apiGetCourses(),
        apiGetClasses().catch(() => []),
      ]);
      setCourses(Array.isArray(courseData) ? courseData : (courseData.data || []));
      setClasses(Array.isArray(classData) ? classData : []);
    } catch { /* keep current state */ }
    setLoading(false);
  };

  useEffect(() => { loadCourses(); }, []);

  // Lấy danh sách lớp thuộc 1 khóa học
  const getClassesForCourse = (courseId) => classes.filter(c => c.course_id === courseId);

  // ── Subscribe to data changes ──
  useEffect(() => {
    return onDataChange('courses', () => { loadCourses(); });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      if (editing) {
        await apiUpdateCourse(editing, form);
        toast.success('Cập nhật thành công!');
      } else {
        await apiCreateCourse({ ...form, createdAt: new Date().toISOString() });
        toast.success('Tạo khóa học mới!');
      }
      await loadCourses();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối đến server'));
    }
    emitDataChange('courses', { action: editing ? 'updated' : 'created' });
    setShowForm(false);
    setEditing(null);
    setForm({ name: '', hours: 140, description: '', status: 'ACTIVE' });
  };

  const handleEdit = (course) => {
    setEditing(course.id);
    setForm({ name: course.name || '', hours: course.hours || course.totalHours || 140, description: course.description || '', status: course.status || 'ACTIVE' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa khóa học này?')) return;
    try {
      await apiDeleteCourse(id);
      await loadCourses();
      toast.success('Đã xóa!');
      emitDataChange('courses', { action: 'deleted', id });
    } catch (err) {
      toast.error('Lỗi khi xóa: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const filtered = courses.filter(c => {
    const mSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const mStatus = statusFilter === 'all' || c.status === statusFilter;
    return mSearch && mStatus;
  });

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Khóa học</h1>
          <p className="text-sm text-gray-500 mt-0.5">{courses.length} khóa học</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', hours: 140, description: '', status: 'ACTIVE' }); setShowForm(true); }} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tạo khóa học
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm khóa học..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang mở</option>
          <option value="INACTIVE">Đã đóng</option>
        </select>
      </div>

      {/* Courses List */}
      <div className="space-y-3">
        {filtered.map(course => {
          const courseClasses = getClassesForCourse(course.id);
          return (
          <div key={course.id} className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-smc-50 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-smc-500" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 flex items-center gap-2">
                  {course.name}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <Clock className="w-3 h-3" /> {course.hours}h
                  <span>•</span>
                  <span className={course.status === 'ACTIVE' ? 'text-green-600' : 'text-red-500'}>
                    {course.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><School className="w-3 h-3" /> {courseClasses.length} lớp</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleEdit(course)} className="btn-ghost p-2 text-gray-400 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(course.id)} className="btn-ghost p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            </div>
            {/* Danh sách lớp */}
            {courseClasses.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Lớp học ({courseClasses.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {courseClasses.map(cls => (
                    <span key={cls.id} className="badge bg-blue-50 text-blue-700 text-xs flex items-center gap-1.5">
                      <School className="w-3 h-3" /> {cls.name}
                      <span className="text-blue-400">•</span>
                      <Users className="w-3 h-3" /> {(cls.student_ids || []).length}/{cls.max_students || 20}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )})}
        {filtered.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Chưa có khóa học nào</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khóa học</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="VD: Chứng chỉ UAV Hạng A" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thời lượng (giờ)</label>
                <input type="number" value={form.hours} onChange={e => setForm({ ...form, hours: parseInt(e.target.value) || 0 })} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Mô tả ngắn về khóa học..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="ACTIVE">Đang mở</option>
                  <option value="INACTIVE">Đã đóng</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Hủy</button>
                <button type="submit" className="btn-primary flex-1">{editing ? 'Cập nhật' : 'Tạo mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
