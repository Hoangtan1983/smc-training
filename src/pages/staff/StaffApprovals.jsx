import { useState, useEffect, useCallback } from 'react';
import { UserCheck, CheckCircle, XCircle, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const statusBadgeMap = {
  PENDING: 'badge-warning', pending: 'badge-warning',
  ACTIVE: 'badge-success', active: 'badge-success',
};

const statusLabels = {
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  ACTIVE: 'Hoạt động', active: 'Hoạt động',
};

export default function StaffApprovals() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  // Approve modal
  const [approveOpen, setApproveOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [approveForm, setApproveForm] = useState({ course_id: '', class_id: '', notes: '' });

  // Reject confirm
  const [rejectOpen, setRejectOpen] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, coursesRes, classesRes] = await Promise.all([
        api.getUsers({ status: 'PENDING' }),
        api.getCourses(),
        api.getClasses(),
      ]);

      setUsers(usersRes.data || usersRes.users || []);
      setCourses(coursesRes.data || coursesRes.courses || []);
      setClasses(classesRes.data || classesRes.classes || []);
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

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const name = (u.fullName || u.full_name || u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    return name.includes(s) || email.includes(s) || phone.includes(s);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  const openDetail = (user) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

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

  const openRejectModal = (user) => {
    setSelectedUser(user);
    setRejectOpen(true);
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await api.deleteUser(selectedUser.id);
      toast.success('Đã từ chối và xóa tài khoản.');
      setRejectOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối.');
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
      <PageHeader title="Duyệt tài khoản" subtitle="Xét duyệt các đơn đăng ký tài khoản mới" />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, email, số điện thoại..." />
      </div>

      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={UserCheck} title="Không có tài khoản nào đang chờ duyệt" description="Tất cả đơn đăng ký đã được xử lý" />
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
                {paginated.map(user => (
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
                        <button onClick={() => openDetail(user)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openApproveModal(user)} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Duyệt">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => openRejectModal(user)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Từ chối">
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết đơn đăng ký"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-full bg-smc-100 flex items-center justify-center text-lg font-bold text-smc-600">
                {(selectedUser.fullName || selectedUser.full_name || selectedUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedUser.fullName || selectedUser.full_name || selectedUser.name}
                </h3>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Số điện thoại:</span> <span className="font-medium">{selectedUser.phone || '-'}</span></div>
              <div><span className="text-gray-400">Ngày đăng ký:</span> <span className="font-medium">{formatDate(selectedUser.created_at || selectedUser.createdAt)}</span></div>
              <div className="col-span-2"><span className="text-gray-400">Khóa đăng ký:</span> <span className="font-medium">{selectedUser.course_name || selectedUser.courseName || selectedUser.course?.name || 'Chưa chọn'}</span></div>
              {selectedUser.address && (
                <div className="col-span-2"><span className="text-gray-400">Địa chỉ:</span> <span className="font-medium">{selectedUser.address}</span></div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={`Duyệt tài khoản: ${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}`}
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
