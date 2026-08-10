import { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, CheckCircle, XCircle, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const statusLabels = {
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  APPROVED: 'Đã duyệt', approved: 'Đã duyệt',
  REJECTED: 'Từ chối', rejected: 'Từ chối',
};

const statusBadgeMap = {
  PENDING: 'badge-warning', pending: 'badge-warning',
  APPROVED: 'badge-success', approved: 'badge-success',
  REJECTED: 'badge-danger', rejected: 'badge-danger',
};

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

export default function AdminChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getChangeRequests();
      setRequests(res.data || res.requests || res.change_requests || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách yêu cầu đổi lớp.');
      toast.error('Không thể tải danh sách yêu cầu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = (request) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  const handleApprove = async (request) => {
    setSaving(true);
    try {
      await api.updateChangeRequest(request.id, { status: 'approved' });
      toast.success('Đã phê duyệt yêu cầu.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi phê duyệt.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (request) => {
    setSaving(true);
    try {
      await api.updateChangeRequest(request.id, { status: 'rejected' });
      toast.success('Đã từ chối yêu cầu.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối yêu cầu.');
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (request) => {
    return request.student_name || request.studentName ||
      request.student?.fullName || request.student?.full_name || request.student?.name ||
      request.user?.fullName || request.user?.full_name || request.user?.name || '-';
  };

  const getCurrentClass = (request) => {
    return request.current_class || request.currentClassName ||
      request.from_class || request.fromClass || '-';
  };

  const getRequestedClass = (request) => {
    return request.requested_class || request.requestedClassName ||
      request.to_class || request.toClass || '-';
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
      <PageHeader title="Đổi lớp & Bảo lưu" subtitle="Quản lý yêu cầu đổi lớp và bảo lưu của học viên" />

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {requests.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title="Chưa có yêu cầu nào" description="Học viên sẽ gửi yêu cầu đổi lớp hoặc bảo lưu từ trang cá nhân" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Lớp hiện tại</th>
                  <th>Lớp yêu cầu</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Ngày gửi</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(request => {
                  const status = (request.status || '').toLowerCase();
                  const isPending = status === 'pending';
                  return (
                    <tr key={request.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                            {getStudentName(request).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{getStudentName(request)}</span>
                        </div>
                      </td>
                      <td className="text-sm text-gray-500">{getCurrentClass(request)}</td>
                      <td className="text-sm text-gray-500">{getRequestedClass(request)}</td>
                      <td className="text-sm text-gray-500 max-w-[200px]">
                        <span className="line-clamp-2">{request.reason || request.note || '-'}</span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeMap[request.status] || 'badge-neutral'}`}>
                          {statusLabels[request.status] || request.status}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">{formatDate(request.created_at || request.createdAt || request.date)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(request)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem">
                            <Eye className="w-4 h-4" />
                          </button>
                          {isPending && (
                            <>
                              <button onClick={() => handleApprove(request)} disabled={saving} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Phê duyệt">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleReject(request)} disabled={saving} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Từ chối">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
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

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết yêu cầu">
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold text-orange-600">
                {getStudentName(selectedRequest).charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{getStudentName(selectedRequest)}</h3>
                <span className={`badge mt-1 ${statusBadgeMap[selectedRequest.status] || 'badge-neutral'}`}>
                  {statusLabels[selectedRequest.status] || selectedRequest.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Lớp hiện tại:</span> <span className="font-medium">{getCurrentClass(selectedRequest)}</span></div>
              <div><span className="text-gray-400">Lớp yêu cầu:</span> <span className="font-medium">{getRequestedClass(selectedRequest)}</span></div>
              <div><span className="text-gray-400">Ngày gửi:</span> <span className="font-medium">{formatDate(selectedRequest.created_at || selectedRequest.createdAt)}</span></div>
              <div><span className="text-gray-400">Loại yêu cầu:</span> <span className="font-medium">{selectedRequest.type || selectedRequest.request_type || 'Đổi lớp'}</span></div>
            </div>
            {selectedRequest.reason && (
              <div>
                <label className="input-label">Lý do</label>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-ios-lg p-3">{selectedRequest.reason}</p>
              </div>
            )}
            {selectedRequest.admin_note && (
              <div>
                <label className="input-label">Ghi chú admin</label>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-ios-lg p-3">{selectedRequest.admin_note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
