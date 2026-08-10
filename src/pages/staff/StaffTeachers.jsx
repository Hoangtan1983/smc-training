import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Mail, Phone, BookOpen } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const statusBadgeMap = {
  ACTIVE: 'badge-success', active: 'badge-success',
  INACTIVE: 'badge-danger', inactive: 'badge-danger',
  BUSY: 'badge-warning', busy: 'badge-warning',
};

const statusLabels = {
  ACTIVE: 'Hoạt động', active: 'Hoạt động',
  INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
  BUSY: 'Bận', busy: 'Bận',
};

export default function StaffTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ class_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachersRes, classesRes] = await Promise.all([
        api.getUsers({ role: 'TEACHER' }),
        api.getClasses(),
      ]);

      const teacherList = (teachersRes.data || teachersRes.users || []).filter(
        u => u.role === 'TEACHER'
      );
      setTeachers(teacherList);
      setClasses(classesRes.data || classesRes.classes || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu giảng viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTeacherClasses = (teacherId) => {
    return classes.filter(c => {
      const ids = c.teacher_ids || c.teacherIds || (c.teacher_id ? [c.teacher_id] : []);
      return ids.includes(teacherId);
    });
  };

  const openDetail = (teacher) => {
    setSelectedTeacher(teacher);
    setDetailOpen(true);
  };

  const openAssignModal = (teacher) => {
    setSelectedTeacher(teacher);
    setAssignForm({ class_id: '' });
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignForm.class_id) {
      toast.error('Vui lòng chọn lớp.');
      return;
    }
    setSaving(true);
    try {
      const cls = classes.find(c => c.id === assignForm.class_id || c.id === Number(assignForm.class_id));
      const existingTeachers = cls?.teacher_ids || cls?.teacherIds || (cls?.teacher_id ? [cls.teacher_id] : []) || [];
      await api.updateClass(assignForm.class_id, {
        teacher_ids: [...existingTeachers, selectedTeacher.id],
      });
      toast.success('Đã phân công giảng viên vào lớp.');
      setAssignOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phân công.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (teacher) => {
    const name = teacher.fullName || teacher.full_name || teacher.name || 'T';
    return name.charAt(0).toUpperCase();
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
      <PageHeader title="Quản lý giảng viên" subtitle="Danh sách và phân công giảng viên" />

      {teachers.length === 0 ? (
        <EmptyState icon={UserPlus} title="Chưa có giảng viên nào" description="Thêm giảng viên từ mục Quản lý người dùng" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {teachers.map(teacher => {
            const teacherClasses = getTeacherClasses(teacher.id);
            return (
              <div
                key={teacher.id}
                className="card-hover text-center cursor-pointer"
                onClick={() => openDetail(teacher)}
              >
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-teal-600">{getInitials(teacher)}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">
                  {teacher.fullName || teacher.full_name || teacher.name}
                </h3>
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-1">
                  <Mail className="w-3 h-3" /> {teacher.email}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-2">
                  <Phone className="w-3 h-3" /> {teacher.phone || '-'}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <div className="text-lg font-bold text-teal-600">{teacherClasses.length}</div>
                    <div className="text-xs text-gray-400">lớp đang dạy</div>
                  </div>
                  <span className={`badge ${statusBadgeMap[teacher.status] || 'badge-neutral'}`}>
                    {statusLabels[teacher.status] || teacher.status}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openAssignModal(teacher); }}
                  className="btn-primary btn-sm mt-3 w-full"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  Phân công lớp
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết giảng viên"
        size="lg"
      >
        {selectedTeacher && (() => {
          const teacherClasses = getTeacherClasses(selectedTeacher.id);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-xl font-bold text-teal-600">
                  {getInitials(selectedTeacher)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedTeacher.fullName || selectedTeacher.full_name || selectedTeacher.name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedTeacher.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Số điện thoại:</span> <span className="font-medium">{selectedTeacher.phone || '-'}</span></div>
                <div><span className="text-gray-400">Trạng thái:</span> <span className="font-medium">{statusLabels[selectedTeacher.status] || selectedTeacher.status}</span></div>
                <div><span className="text-gray-400">Số lớp đang dạy:</span> <span className="font-medium">{teacherClasses.length}</span></div>
                <div><span className="text-gray-400">Kinh nghiệm:</span> <span className="font-medium">{selectedTeacher.experience || '-'}</span></div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Danh sách lớp đang dạy</h4>
                <div className="bg-gray-50 rounded-ios-lg p-3">
                  {teacherClasses.length === 0 ? (
                    <p className="text-sm text-gray-400">Chưa được phân công lớp nào.</p>
                  ) : (
                    <div className="space-y-2">
                      {teacherClasses.map(cls => (
                        <div key={cls.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cls.name || cls.class_name}</span>
                          <span className="text-gray-400">
                            {cls.current_students || cls.currentStudents || 0} học viên
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Assign Modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Phân công lớp cho: ${selectedTeacher?.fullName || selectedTeacher?.full_name || selectedTeacher?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Chọn lớp</label>
            <select
              value={assignForm.class_id}
              onChange={e => setAssignForm(prev => ({ ...prev, class_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn lớp...</option>
              {classes.filter(c => c.status === 'active' || c.status === 'ACTIVE').map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.class_name} ({c.type || 'offline'})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAssignOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleAssign} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Phân công'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
