import { useState, useEffect, useCallback } from 'react';
import { School, Users, UserCheck, TrendingUp, Plane, Calendar } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function TeacherClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [studentDetail, setStudentDetail] = useState(null);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [stageForm, setStageForm] = useState({ studentId: '', stage: '', progress: 0, note: '' });
  const [saving, setSaving] = useState(false);
  const [flyLogsModalOpen, setFlyLogsModalOpen] = useState(false);
  const [flyLogs, setFlyLogs] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, usersRes] = await Promise.all([
        api.getClasses(),
        api.getUsers({ role: 'STUDENT' }),
      ]);
      const allClasses = classesRes.data || classesRes.classes || [];
      const allUsers = usersRes.data || usersRes.users || [];

      const myClasses = allClasses.filter(c => {
        const teacherIds = c.teacher_ids || c.teacherIds || [];
        return teacherIds.includes(user?.id) || teacherIds.includes(String(user?.id));
      });

      setClasses(myClasses);
      setAllStudents(allUsers);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách lớp học.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredClasses = classes.filter(c => {
    if (!search) return true;
    const name = (c.name || c.class_name || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const getClassStudents = (cls) => {
    const studentIds = (cls.student_ids || cls.studentIds || []).map(String);
    return allStudents.filter(s => studentIds.includes(String(s.id)));
  };

  const openDetailModal = (cls) => {
    setSelectedClass(cls);
    const classStudents = getClassStudents(cls);
    setStudents(classStudents);
    setDetailModalOpen(true);
  };

  const openStageModal = (student) => {
    setStudentDetail(student);
    setStageForm({
      studentId: student.id || '',
      stage: student.stage || student.training_stage || '',
      progress: student.progress || student.training_progress || 0,
      note: '',
    });
    setStageModalOpen(true);
  };

  const openFlyLogs = async (student) => {
    setStudentDetail(student);
    setFlyLogs([]);
    setFlyLogsModalOpen(true);
    try {
      const res = await api.getFlyLogs({ student_id: student.id });
      setFlyLogs(res.data || res.flyLogs || []);
    } catch {
      toast.error('Không thể tải nhật ký bay.');
    }
  };

  const handleStageUpdate = async () => {
    setSaving(true);
    try {
      await api.updateStage(stageForm);
      toast.success('Cập nhật tiến độ thành công.');
      setStageModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật tiến độ.');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      ACTIVE: 'badge-success', active: 'badge-success',
      PENDING: 'badge-warning', pending: 'badge-warning',
      INACTIVE: 'badge-neutral', inactive: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  const statusLabel = {
    ACTIVE: 'Hoạt động', active: 'Hoạt động',
    PENDING: 'Chờ khai giảng', pending: 'Chờ khai giảng',
    INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
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
      <PageHeader title="Lớp học của tôi" subtitle="Quản lý lớp học và học viên" />

      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm lớp học..." />
      </div>

      {filteredClasses.length === 0 ? (
        <EmptyState
          icon={School}
          title={search ? 'Không tìm thấy lớp học' : 'Chưa có lớp học nào'}
          description={search ? 'Thử lại với từ khóa khác.' : 'Bạn chưa được phân công lớp học nào.'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map(cls => (
            <div
              key={cls.id}
              className="card card-hover"
              onClick={() => openDetailModal(cls)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                  <School className="w-6 h-6 text-smc-600" />
                </div>
                <span className={`badge ${statusBadge(cls.status)}`}>
                  {statusLabel[cls.status] || cls.status || 'N/A'}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{cls.name || cls.class_name}</h3>
              <p className="text-sm text-gray-500 mb-3">{cls.course_name || cls.courseName || cls.course?.name || '-'}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {(cls.student_ids || cls.studentIds || []).length || cls.current_students || cls.currentStudents || 0} học viên
                </span>
                {cls.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {cls.start_date || cls.startDate}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Class Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedClass?.name || selectedClass?.class_name || 'Chi tiết lớp học'}
        size="xl"
      >
        {students.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Users} title="Chưa có học viên" description="Lớp học này chưa có học viên nào." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-smc-100 flex items-center justify-center text-sm font-bold text-smc-600">
                          {(s.fullName || s.full_name || s.name || 'H').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{s.fullName || s.full_name || s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-smc-500 h-2 rounded-full transition-all"
                            style={{ width: `${s.progress || s.training_progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{s.progress || s.training_progress || 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'ACTIVE' || s.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {s.status === 'ACTIVE' || s.status === 'active' ? 'Hoạt động' : s.status || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openStageModal(s); }}
                          className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50"
                          title="Cập nhật tiến độ"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openFlyLogs(s); }}
                          className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50"
                          title="Nhật ký bay"
                        >
                          <Plane className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Stage Update Modal */}
      <Modal
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        title="Cập nhật tiến độ"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Học viên: <span className="font-medium text-gray-900">{studentDetail?.fullName || studentDetail?.full_name || studentDetail?.name}</span>
          </p>
          <div>
            <label className="input-label">Giai đoạn</label>
            <select
              value={stageForm.stage}
              onChange={e => setStageForm(prev => ({ ...prev, stage: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn giai đoạn</option>
              <option value="Lý thuyết cơ bản">Lý thuyết cơ bản</option>
              <option value="Thực hành mô phỏng">Thực hành mô phỏng</option>
              <option value="Thực hành bay">Thực hành bay</option>
              <option value="Kiểm tra">Kiểm tra</option>
              <option value="Hoàn thành">Hoàn thành</option>
            </select>
          </div>
          <div>
            <label className="input-label">Tiến độ (%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={stageForm.progress}
              onChange={e => setStageForm(prev => ({ ...prev, progress: Number(e.target.value) }))}
              className="w-full"
            />
            <div className="text-center text-sm font-bold text-smc-600 mt-1">{stageForm.progress}%</div>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={stageForm.note}
              onChange={e => setStageForm(prev => ({ ...prev, note: e.target.value }))}
              className="input-field"
              rows={2}
              placeholder="Nhập ghi chú (nếu có)"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStageModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleStageUpdate} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Cập nhật'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Fly Logs Modal */}
      <Modal
        open={flyLogsModalOpen}
        onClose={() => setFlyLogsModalOpen(false)}
        title={`Nhật ký bay - ${studentDetail?.fullName || studentDetail?.full_name || studentDetail?.name || ''}`}
        size="lg"
      >
        {flyLogs.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Plane} title="Chưa có nhật ký bay" description="Học viên này chưa có nhật ký bay nào." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ bay</th>
                  <th>Loại bay</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {flyLogs.map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td className="text-sm">{log.date || log.log_date || '-'}</td>
                    <td className="text-sm font-medium">{log.hours || log.flight_hours || 0} giờ</td>
                    <td>
                      <span className="badge badge-info">{log.type || log.flight_type || '-'}</span>
                    </td>
                    <td className="text-sm text-gray-500">{log.note || log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
