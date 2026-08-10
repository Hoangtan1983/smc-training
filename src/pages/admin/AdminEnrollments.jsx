import { useState, useEffect, useCallback } from 'react';
import { UserCheck, UserX, Users, CheckCircle, XCircle, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'pending', label: 'Đơn đăng ký mới', icon: UserCheck },
  { key: 'approved', label: 'Đã duyệt', icon: CheckCircle },
];

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

export default function AdminEnrollments() {
  const [registrations, setRegistrations] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveForm, setApproveForm] = useState({ course_id: '', class_id: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [regRes, pendingRes, coursesRes, classesRes] = await Promise.all([
        api.getRegistrations(),
        api.getUsers({ status: 'PENDING' }),
        api.getCourses(),
        api.getClasses(),
      ]);

      setRegistrations(regRes.data || regRes.registrations || []);

      const allPending = pendingRes.data || pendingRes.users || [];
      setPendingUsers(allPending.filter(u => u.status === 'PENDING' || u.status === 'pending'));

      const approvedList = regRes.data || regRes.registrations || [];
      const approved = approvedList.filter(r => r.status === 'APPROVED' || r.status === 'approved');
      setApprovedUsers(approved);

      setCourses(coursesRes.data || coursesRes.courses || []);
      setClasses(classesRes.data || classesRes.classes || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu tuyển sinh.');
      toast.error('Không thể tải dữ liệu tuyển sinh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = (user) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const openApprove = (user) => {
    setSelectedUser(user);
    setApproveForm({ course_id: courses[0]?.id || '', class_id: '', notes: '' });
    setApproveOpen(true);
  };

  const handleApprove = async () => {
    if (!approveForm.course_id) {
      toast.error('Vui lòng chọn khóa học.');
      return;
    }
    setSaving(true);
    try {
      await api.approveRegistration(selectedUser.id);
      await api.approveUser(selectedUser.id);

      if (approveForm.class_id) {
        await api.createEnrollment({
          student_id: selectedUser.id,
          class_id: approveForm.class_id,
          notes: approveForm.notes,
        });
      } else {
        await api.createEnrollment({
          student_id: selectedUser.id,
          course_id: approveForm.course_id,
          notes: approveForm.notes,
        });
      }

      toast.success('Đã duyệt đơn đăng ký thành công.');
      setApproveOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt đơn đăng ký.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (user) => {
    setSaving(true);
    try {
      await api.updateUser(user.id, { status: 'INACTIVE' });
      toast.success('Đã từ chối đơn đăng ký.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối.');
    } finally {
      setSaving(false);
    }
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

  const pendingEnrollments = [...pendingUsers, ...registrations.filter(r => r.status === 'PENDING' || r.status === 'pending')];

  return (
    <div className="page-container">
      <PageHeader title="Quản lý tuyển sinh" subtitle="Duyệt và quản lý đơn đăng ký học viên" />

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
            {tab.key === 'pending' && pendingEnrollments.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-smc-500 text-white text-xs rounded-full">
                {pendingEnrollments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'pending' ? (
        <div className="table-container">
          <div className="table-wrap">
            {pendingEnrollments.length === 0 ? (
              <EmptyState icon={Users} title="Không có đơn đăng ký mới" description="Tất cả đơn đăng ký đã được xử lý" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Ngày đăng ký</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEnrollments.map((item, idx) => {
                    const user = item.user || item;
                    return (
                      <tr key={user.id || idx}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-600">
                              {(user.fullName || user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-900">
                              {user.fullName || user.full_name || user.name}
                            </span>
                          </div>
                        </td>
                        <td className="text-gray-500">{user.email}</td>
                        <td className="text-gray-500">{user.phone || '-'}</td>
                        <td className="text-sm text-gray-500">{formatDate(user.created_at || user.createdAt || item.created_at)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openDetail(user)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openApprove(user)} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Duyệt">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(user)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Từ chối">
                              <XCircle className="w-4 h-4" />
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
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            {approvedUsers.length === 0 ? (
              <EmptyState icon={CheckCircle} title="Chưa có đơn nào được duyệt" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Học viên</th>
                    <th>Khóa học</th>
                    <th>Lớp</th>
                    <th>Ngày duyệt</th>
                    <th>Người duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedUsers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium text-gray-900">
                          {item.student_name || item.studentName || item.student?.fullName || item.student?.full_name || item.student?.name || '-'}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {item.course_name || item.courseName || '-'}
                      </td>
                      <td className="text-sm text-gray-500">
                        {item.class_name || item.className || '-'}
                      </td>
                      <td className="text-sm text-gray-500">{formatDate(item.approved_at || item.approvedAt || item.updated_at)}</td>
                      <td className="text-sm text-gray-500">{item.approved_by || item.approvedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đơn đăng ký">
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center text-lg font-bold text-yellow-600">
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
              <div className="col-span-2"><span className="text-gray-400">Địa chỉ:</span> <span className="font-medium">{selectedUser.address || '-'}</span></div>
              {selectedUser.notes && (
                <div className="col-span-2"><span className="text-gray-400">Ghi chú:</span> <span className="font-medium">{selectedUser.notes}</span></div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title={`Duyệt đơn: ${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="input-label">Chọn khóa học</label>
            <select
              value={approveForm.course_id}
              onChange={e => setApproveForm(prev => ({ ...prev, course_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn khóa học...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Chọn lớp (không bắt buộc)</label>
            <select
              value={approveForm.class_id}
              onChange={e => setApproveForm(prev => ({ ...prev, class_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chưa chọn lớp</option>
              {classes.filter(c => c.status === 'active' || c.status === 'ACTIVE').map(c => (
                <option key={c.id} value={c.id}>{c.name || c.class_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={approveForm.notes}
              onChange={e => setApproveForm(prev => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Ghi chú duyệt đơn..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setApproveOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleApprove} disabled={saving} className="btn-success flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Duyệt đơn'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
