import { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserPlus, CheckCircle, XCircle, Search } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'pending', label: 'Đơn đăng ký', icon: UserCheck },
  { key: 'enroll', label: 'Ghi danh mới', icon: UserPlus },
];

const statusBadgeMap = {
  PENDING: 'badge-warning', pending: 'badge-warning',
  ACTIVE: 'badge-success', active: 'badge-success',
};

const statusLabels = {
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  ACTIVE: 'Hoạt động', active: 'Hoạt động',
};

export default function StaffEnrollment() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Approve modal
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [approveForm, setApproveForm] = useState({ course_id: '', class_id: '', notes: '' });

  // Reject confirm
  const [rejectOpen, setRejectOpen] = useState(false);

  // Enroll form
  const [enrollForm, setEnrollForm] = useState({ student_id: '', course_id: '', class_id: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, studentsRes, coursesRes, classesRes] = await Promise.all([
        api.getUsers({ status: 'PENDING' }),
        api.getUsers({ role: 'STUDENT' }),
        api.getCourses(),
        api.getClasses(),
      ]);

      setPendingUsers(pendingRes.data || pendingRes.users || []);
      setStudents((studentsRes.data || studentsRes.users || []).filter(u => u.role === 'STUDENT'));
      setCourses(coursesRes.data || coursesRes.courses || []);
      setClasses(classesRes.data || classesRes.classes || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu tuyển sinh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPending = pendingUsers.filter(u => {
    const s = search.toLowerCase();
    const name = (u.fullName || u.full_name || u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(s) || email.includes(s);
  });

  const filteredStudents = students.filter(u => {
    const s = studentSearch.toLowerCase();
    const name = (u.fullName || u.full_name || u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(s) || email.includes(s);
  });

  // ─── Approve ───
  const openApproveModal = (user) => {
    setSelectedUser(user);
    setApproveForm({ course_id: '', class_id: '', notes: '' });
    setApproveOpen(true);
  };

  const handleApprove = async () => {
    if (!approveForm.course_id) {
      toast.error('Vui lòng chọn khóa học.');
      return;
    }
    setSaving(true);
    try {
      await api.approveUser(selectedUser.id);
      if (approveForm.class_id) {
        await api.createEnrollment({
          student_id: selectedUser.id,
          class_id: approveForm.class_id,
          course_id: approveForm.course_id,
        });
      }
      toast.success(`Đã duyệt học viên ${selectedUser.fullName || selectedUser.full_name || selectedUser.name}`);
      setApproveOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt học viên.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Reject ───
  const openRejectModal = (user) => {
    setSelectedUser(user);
    setRejectOpen(true);
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await api.deleteUser(selectedUser.id);
      toast.success('Đã từ chối đơn đăng ký.');
      setRejectOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Enroll ───
  const handleEnroll = async () => {
    if (!enrollForm.student_id || !enrollForm.course_id || !enrollForm.class_id) {
      toast.error('Vui lòng chọn đầy đủ học viên, khóa học và lớp học.');
      return;
    }
    setSaving(true);
    try {
      await api.createEnrollment({
        student_id: enrollForm.student_id,
        course_id: enrollForm.course_id,
        class_id: enrollForm.class_id,
      });
      toast.success('Ghi danh thành công.');
      setEnrollForm({ student_id: '', course_id: '', class_id: '' });
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi ghi danh.');
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
      <PageHeader title="Tuyển sinh" subtitle="Duyệt đơn đăng ký và ghi danh học viên mới" />

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Đơn đăng ký */}
      {activeTab === 'pending' && (
        <>
          <div className="mb-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, email..." />
          </div>
          <div className="table-container">
            <div className="table-wrap">
              {filteredPending.length === 0 ? (
                <EmptyState icon={UserCheck} title="Không có đơn đăng ký nào đang chờ duyệt" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Khóa đăng ký</th>
                      <th>Ngày đăng ký</th>
                      <th>Trạng thái</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-smc-100 flex items-center justify-center text-sm font-bold text-smc-600">
                              {(user.fullName || user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900">
                              {user.fullName || user.full_name || user.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-sm text-gray-500">{user.email}</td>
                        <td className="text-sm text-gray-500">{user.phone || '-'}</td>
                        <td className="text-sm text-gray-500">{user.course_name || user.courseName || user.course?.name || 'Chưa chọn'}</td>
                        <td className="text-sm text-gray-500">{formatDate(user.created_at || user.createdAt)}</td>
                        <td>
                          <span className={`badge ${statusBadgeMap[user.status] || 'badge-neutral'}`}>
                            {statusLabels[user.status] || user.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openApproveModal(user)}
                              className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50"
                              title="Duyệt"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openRejectModal(user)}
                              className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50"
                              title="Từ chối"
                            >
                              <XCircle className="w-4 h-4" />
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
        </>
      )}

      {/* Tab: Ghi danh mới */}
      {activeTab === 'enroll' && (
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-base font-bold text-gray-900 mb-4">Ghi danh học viên mới</h3>
          <div className="space-y-4">
            {/* Student search */}
            <div className="relative">
              <label className="input-label">Học viên</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={enrollForm.student_id ? (students.find(s => s.id === enrollForm.student_id)?.fullName || students.find(s => s.id === enrollForm.student_id)?.full_name || students.find(s => s.id === enrollForm.student_id)?.name || '') : studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentDropdown(true);
                    if (enrollForm.student_id) {
                      setEnrollForm(prev => ({ ...prev, student_id: '' }));
                    }
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                  onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                  className="input-field pl-10"
                  placeholder="Tìm học viên..."
                />
                {showStudentDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-ios-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400">Không tìm thấy học viên</p>
                    ) : (
                      filteredStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setEnrollForm(prev => ({ ...prev, student_id: s.id }));
                            setStudentSearch(s.fullName || s.full_name || s.name || '');
                            setShowStudentDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-3"
                        >
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                            {(s.fullName || s.full_name || s.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{s.fullName || s.full_name || s.name}</p>
                            <p className="text-xs text-gray-400">{s.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Course select */}
            <div>
              <label className="input-label">Khóa học</label>
              <select
                value={enrollForm.course_id}
                onChange={e => setEnrollForm(prev => ({ ...prev, course_id: e.target.value, class_id: '' }))}
                className="input-field"
              >
                <option value="">Chọn khóa học</option>
                {courses.filter(c => c.status === 'active' || c.status === 'ACTIVE').map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
                ))}
              </select>
            </div>

            {/* Class select */}
            <div>
              <label className="input-label">Lớp học</label>
              <select
                value={enrollForm.class_id}
                onChange={e => setEnrollForm(prev => ({ ...prev, class_id: e.target.value }))}
                className="input-field"
              >
                <option value="">Chọn lớp học</option>
                {classes
                  .filter(c => (c.status === 'active' || c.status === 'ACTIVE') && (!enrollForm.course_id || c.course_id === enrollForm.course_id || c.courseId === enrollForm.course_id))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.class_name} ({(c.current_students || c.currentStudents || 0)}/{(c.max_students || c.maxStudents || 0)})
                    </option>
                  ))}
              </select>
            </div>

            <button onClick={handleEnroll} disabled={saving} className="btn-primary w-full">
              {saving ? <span className="spinner spinner-sm" /> : 'Ghi danh'}
            </button>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={`Duyệt học viên: ${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Khóa học</label>
            <select
              value={approveForm.course_id}
              onChange={e => setApproveForm(prev => ({ ...prev, course_id: e.target.value, class_id: '' }))}
              className="input-field"
            >
              <option value="">Chọn khóa học</option>
              {courses.filter(c => c.status === 'active' || c.status === 'ACTIVE').map(c => (
                <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Lớp học</label>
            <select
              value={approveForm.class_id}
              onChange={e => setApproveForm(prev => ({ ...prev, class_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn lớp học</option>
              {classes
                .filter(c => (c.status === 'active' || c.status === 'ACTIVE') && (!approveForm.course_id || c.course_id === approveForm.course_id || c.courseId === approveForm.course_id))
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.class_name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={approveForm.notes}
              onChange={e => setApproveForm(prev => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Ghi chú duyệt..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setApproveOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleApprove} disabled={saving} className="btn-success flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Duyệt'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Confirm */}
      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Từ chối đơn đăng ký?"
        message={`Bạn có chắc chắn muốn từ chối đơn đăng ký của "${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}" không? Tài khoản sẽ bị xóa.`}
        confirmText="Từ chối"
        variant="danger"
      />
    </div>
  );
}
