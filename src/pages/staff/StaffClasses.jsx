import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Users, Calendar, MapPin } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = ['online', 'offline'];
const RANK_OPTIONS = ['A', 'B', 'C'];
const STATUS_OPTIONS = ['active', 'inactive'];

const statusLabels = { active: 'Hoạt động', inactive: 'Không hoạt động' };
const typeLabels = { online: 'Online', offline: 'Offline' };
const rankColors = { A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700', C: 'bg-gray-100 text-gray-600' };

export default function StaffClasses() {
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', course_id: '', teacher_ids: [], max_students: 30,
    start_date: '', end_date: '', schedule: '', type: 'offline',
    rank: 'B', status: 'active',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, coursesRes, teachersRes] = await Promise.all([
        api.getClasses(),
        api.getCourses(),
        api.getUsers({ role: 'TEACHER' }),
      ]);

      setClasses(classesRes.data || classesRes.classes || []);
      setCourses(coursesRes.data || coursesRes.courses || []);
      setTeachers(
        (teachersRes.data || teachersRes.users || []).filter(u => u.role === 'TEACHER')
      );
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setSelectedClass(null);
    setForm({
      name: '', course_id: courses[0]?.id || '', teacher_ids: [], max_students: 30,
      start_date: '', end_date: '', schedule: '', type: 'offline',
      rank: 'B', status: 'active',
    });
    setModalOpen(true);
  };

  const openEditModal = (cls) => {
    setSelectedClass(cls);
    setForm({
      name: cls.name || cls.class_name || '',
      course_id: cls.course_id || cls.courseId || courses[0]?.id || '',
      teacher_ids: cls.teacher_ids || cls.teacherIds || (cls.teacher_id ? [cls.teacher_id] : []),
      max_students: cls.max_students || cls.maxStudents || 30,
      start_date: cls.start_date || cls.startDate || '',
      end_date: cls.end_date || cls.endDate || '',
      schedule: cls.schedule || '',
      type: cls.type || 'offline',
      rank: cls.rank || 'B',
      status: cls.status || 'active',
    });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'max_students' ? Number(value) : value }));
  };

  const toggleTeacher = (teacherId) => {
    setForm(prev => ({
      ...prev,
      teacher_ids: prev.teacher_ids.includes(teacherId)
        ? prev.teacher_ids.filter(id => id !== teacherId)
        : [...prev.teacher_ids, teacherId],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.course_id) {
      toast.error('Vui lòng nhập tên lớp và chọn khóa học.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (selectedClass) {
        await api.updateClass(selectedClass.id, payload);
        toast.success('Cập nhật lớp học thành công.');
      } else {
        await api.createClass(payload);
        toast.success('Tạo lớp học thành công.');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu lớp học.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      await api.deleteClass(selectedClass.id);
      toast.success('Đã xóa lớp học.');
      setConfirmOpen(false);
      setSelectedClass(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa lớp học.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (cls) => {
    setSelectedClass(cls);
    setConfirmOpen(true);
  };

  const getTeacherName = (cls) => {
    if (cls.teacher_name || cls.teacherName) return cls.teacher_name || cls.teacherName;
    if (cls.teacher) return cls.teacher.fullName || cls.teacher.full_name || cls.teacher.name;
    if (cls.teachers && cls.teachers.length > 0) {
      return cls.teachers.map(t => t.fullName || t.full_name || t.name).join(', ');
    }
    return '-';
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Quản lý lớp học"
        subtitle="Tạo và quản lý các lớp đào tạo"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Tạo lớp học
          </button>
        }
      />

      <div className="table-container">
        <div className="table-wrap">
          {classes.length === 0 ? (
            <EmptyState icon={Users} title="Chưa có lớp học nào" description="Nhấn 'Tạo lớp học' để bắt đầu" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên lớp</th>
                  <th>Khóa học</th>
                  <th>Giảng viên</th>
                  <th>Sĩ số</th>
                  <th>Ngày bắt đầu</th>
                  <th>Ngày kết thúc</th>
                  <th>Loại</th>
                  <th>Xếp loại</th>
                  <th>Trạng thái</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map(cls => (
                  <tr key={cls.id}>
                    <td>
                      <span className="font-medium text-gray-900">{cls.name || cls.class_name}</span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {cls.course_name || cls.courseName || cls.course?.name || '-'}
                    </td>
                    <td className="text-gray-500 text-sm">{getTeacherName(cls)}</td>
                    <td>
                      <span className="text-sm">
                        {cls.current_students || cls.currentStudents || 0} / {cls.max_students || cls.maxStudents || 0}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{formatDate(cls.start_date || cls.startDate)}</td>
                    <td className="text-sm text-gray-500">{formatDate(cls.end_date || cls.endDate)}</td>
                    <td>
                      <span className="badge badge-info">{typeLabels[cls.type] || cls.type || '-'}</span>
                    </td>
                    <td>
                      <span className={`badge ${rankColors[cls.rank] || 'badge-neutral'}`}>{cls.rank || '-'}</span>
                    </td>
                    <td>
                      <span className={`badge ${cls.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {statusLabels[cls.status] || cls.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(cls)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => promptDelete(cls)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedClass ? 'Sửa lớp học' : 'Tạo lớp học'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tên lớp</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập tên lớp"
            />
          </div>
          <div>
            <label className="input-label">Khóa học</label>
            <select name="course_id" value={form.course_id} onChange={handleFormChange} className="input-field">
              <option value="">Chọn khóa học</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Giảng viên</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-ios-lg min-h-[44px]">
              {teachers.length === 0 && <span className="text-sm text-gray-400">Không có giảng viên nào</span>}
              {teachers.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeacher(t.id)}
                  className={`badge cursor-pointer transition-all ${
                    form.teacher_ids.includes(t.id)
                      ? 'bg-smc-100 text-smc-700 ring-2 ring-smc-300'
                      : 'badge-neutral'
                  }`}
                >
                  {t.fullName || t.full_name || t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Sĩ số tối đa</label>
              <input
                name="max_students"
                type="number"
                value={form.max_students}
                onChange={handleFormChange}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Xếp loại</label>
              <select name="rank" value={form.rank} onChange={handleFormChange} className="input-field">
                {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Ngày bắt đầu</label>
              <input
                name="start_date" type="date" value={form.start_date}
                onChange={handleFormChange} className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Ngày kết thúc</label>
              <input
                name="end_date" type="date" value={form.end_date}
                onChange={handleFormChange} className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Lịch học</label>
            <input
              name="schedule"
              value={form.schedule}
              onChange={handleFormChange}
              className="input-field"
              placeholder="VD: Thứ 2-4-6, 18:00-20:00"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Loại lớp</label>
              <select name="type" value={form.type} onChange={handleFormChange} className="input-field">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Trạng thái</label>
              <select name="status" value={form.status} onChange={handleFormChange} className="input-field">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>
            </div>
          </div>

          {/* Students in class (edit mode) */}
          {selectedClass && (selectedClass.students || selectedClass.enrollments) && (
            <div>
              <label className="input-label">Học viên trong lớp</label>
              <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-ios-lg p-3">
                {(selectedClass.students || selectedClass.enrollments || []).length === 0 ? (
                  <p className="text-sm text-gray-400">Chưa có học viên nào.</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedClass.students || selectedClass.enrollments || []).map((s, idx) => {
                      const student = s.student || s.user || s;
                      return (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                            {(student.fullName || student.full_name || student.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span>{student.fullName || student.full_name || student.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedClass ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa lớp học?"
        message={`Bạn có chắc chắn muốn xóa lớp "${selectedClass?.name || selectedClass?.class_name}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
