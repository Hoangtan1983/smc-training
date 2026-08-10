import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, ArrowRightLeft, TrendingUp } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;
const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'VLOS', label: 'VLOS' },
  { key: 'BVLOS', label: 'BVLOS' },
];

const statusBadgeMap = {
  ACTIVE: 'badge-success', active: 'badge-success',
  PENDING: 'badge-warning', pending: 'badge-warning',
  FROZEN: 'badge-neutral', frozen: 'badge-neutral',
  INACTIVE: 'badge-danger', inactive: 'badge-danger',
  STUDYING: 'badge-info', studying: 'badge-info',
  COMPLETED: 'badge-success', completed: 'badge-success',
  DROPPED: 'badge-danger', dropped: 'badge-danger',
};

const statusLabels = {
  ACTIVE: 'Hoạt động', active: 'Hoạt động',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  FROZEN: 'Đóng băng', frozen: 'Đóng băng',
  INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
  STUDYING: 'Đang học', studying: 'Đang học',
  COMPLETED: 'Hoàn thành', completed: 'Hoàn thành',
  DROPPED: 'Bỏ học', dropped: 'Bỏ học',
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ class_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, classesRes, enrollmentsRes] = await Promise.all([
        api.getUsers({ role: 'STUDENT' }),
        api.getClasses(),
        api.getEnrollments(),
      ]);

      const studentList = (studentsRes.data || studentsRes.users || []).filter(
        u => u.role === 'STUDENT'
      );
      setStudents(studentList);
      setClasses(classesRes.data || classesRes.classes || []);
      setEnrollments(enrollmentsRes.data || enrollmentsRes.enrollments || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu học viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStudentClass = (studentId) => {
    const enrollment = enrollments.find(
      e => e.student_id === studentId || e.user_id === studentId
    );
    if (!enrollment) return null;
    const cls = classes.find(c => c.id === enrollment.class_id || c.id === enrollment.classId);
    return cls;
  };

  const filtered = students.filter(s => {
    const matchSearch = () => {
      const str = search.toLowerCase();
      const name = (s.fullName || s.full_name || s.name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      return name.includes(str) || email.includes(str);
    };
    const matchStatus = () => !statusFilter || s.status === statusFilter;
    const matchTab = () => {
      if (activeTab === 'all') return true;
      const cls = getStudentClass(s.id);
      if (!cls) return false;
      return cls.name?.toUpperCase().includes(activeTab) || cls.rank === activeTab;
    };
    return matchSearch() && matchStatus() && matchTab();
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, activeTab]);

  const openDetail = (student) => {
    setSelectedStudent(student);
    setDetailOpen(true);
  };

  const openAssign = (student) => {
    setSelectedStudent(student);
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
      await api.assignClass({
        student_id: selectedStudent.id,
        class_id: assignForm.class_id,
      });
      toast.success('Đã xếp lớp cho học viên.');
      setAssignOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xếp lớp.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStage = async (student) => {
    const stages = ['Đăng ký', 'Nhập học', 'Lý thuyết', 'Thực hành', 'Bay thử', 'Sát hạch', 'Hoàn thành'];
    const current = student.stage || student.training_stage || stages[0];
    const currentIdx = stages.indexOf(current);
    const nextIdx = currentIdx >= 0 && currentIdx < stages.length - 1 ? currentIdx + 1 : -1;
    if (nextIdx === -1) {
      toast.error('Học viên đã hoàn thành tất cả các giai đoạn.');
      return;
    }
    setSaving(true);
    try {
      await api.updateStage({
        student_id: student.id,
        stage: stages[nextIdx],
      });
      toast.success(`Đã cập nhật tiến độ: ${stages[nextIdx]}`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật tiến độ.');
    } finally {
      setSaving(false);
    }
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
      <PageHeader title="Quản lý học viên" subtitle="Theo dõi và quản lý học viên" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, email..." />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="FROZEN">Đóng băng</option>
          <option value="INACTIVE">Không hoạt động</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState title="Không tìm thấy học viên nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Khóa học</th>
                  <th>Lớp</th>
                  <th>Trạng thái</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(student => {
                  const cls = getStudentClass(student.id);
                  const courseName = cls?.course_name || cls?.courseName || cls?.course?.name || '-';
                  return (
                    <tr key={student.id}>
                      <td className="text-gray-400 text-xs">{student.id}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                            {(student.fullName || student.full_name || student.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">
                            {student.fullName || student.full_name || student.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-gray-500">{student.email}</td>
                      <td className="text-gray-500">{student.phone || '-'}</td>
                      <td className="text-sm text-gray-500">{courseName}</td>
                      <td className="text-sm text-gray-500">{cls?.name || cls?.class_name || 'Chưa xếp lớp'}</td>
                      <td>
                        <span className={`badge ${statusBadgeMap[student.status] || 'badge-neutral'}`}>
                          {statusLabels[student.status] || student.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(student)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem chi tiết">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openAssign(student)} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Xếp lớp">
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleUpdateStage(student)} className="btn-ghost btn-sm p-1.5 text-orange-600 hover:bg-orange-50" title="Cập nhật tiến độ">
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết học viên"
        size="lg"
      >
        {selectedStudent && (() => {
          const cls = getStudentClass(selectedStudent.id);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-600">
                  {(selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Số điện thoại:</span> <span className="font-medium">{selectedStudent.phone || '-'}</span></div>
                <div><span className="text-gray-400">Trạng thái:</span> <span className="font-medium">{statusLabels[selectedStudent.status] || selectedStudent.status}</span></div>
                <div><span className="text-gray-400">Ngày đăng ký:</span> <span className="font-medium">{formatDate(selectedStudent.created_at || selectedStudent.createdAt)}</span></div>
                <div><span className="text-gray-400">Lớp hiện tại:</span> <span className="font-medium">{cls?.name || cls?.class_name || 'Chưa có'}</span></div>
                <div><span className="text-gray-400">Khóa học:</span> <span className="font-medium">{cls?.course_name || cls?.courseName || cls?.course?.name || '-'}</span></div>
                <div><span className="text-gray-400">Giai đoạn:</span> <span className="font-medium">{selectedStudent.stage || selectedStudent.training_stage || 'Đăng ký'}</span></div>
              </div>
              {selectedStudent.address && (
                <div className="text-sm"><span className="text-gray-400">Địa chỉ:</span> <span className="font-medium">{selectedStudent.address}</span></div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Assign Class Modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Xếp lớp cho: ${selectedStudent?.fullName || selectedStudent?.full_name || selectedStudent?.name}`}
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
                  {c.name || c.class_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAssignOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleAssign} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Xếp lớp'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
