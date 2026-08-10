import { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, CheckCircle, XCircle, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const statusBadgeMap = {
  PENDING: 'badge-warning', pending: 'badge-warning',
  APPROVED: 'badge-success', approved: 'badge-success',
  REJECTED: 'badge-danger', rejected: 'badge-danger',
};

const statusLabels = {
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  APPROVED: 'Đã duyệt', approved: 'Đã duyệt',
  REJECTED: 'Từ chối', rejected: 'Từ chối',
};

export default function StaffChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Approve/Reject confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getChangeRequests();
      setRequests(res.data || res.requests || res.changeRequests || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách yêu cầu.');
      toast.error('Không thể tải danh sách yêu cầu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(requests.length / ITEMS_PER_PAGE);
  const paginated = requests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const openDetail = (request) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  const handleAction = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      await api.updateChangeRequest(selectedRequest.id, {
        status: confirmAction === 'approve' ? 'approved' : 'rejected',
      });
      toast.success(confirmAction === 'approve' ? 'Đã phê duyệt yêu cầu.' : 'Đã từ chối yêu cầu.');
      setConfirmOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xử lý yêu cầu.');
    } finally {
      setSaving(false);
    }
  };

  const promptConfirm = (request, action) => {
    setSelectedRequest(request);
    setConfirmAction(action);
    setConfirmOpen(true);
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
      <PageHeader title="Đổi lớp & Bảo lưu" subtitle="Xử lý yêu cầu đổi lớp và bảo lưu của học viên" />

      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title="Không có yêu cầu nào" description="Chưa có yêu cầu đổi lớp hoặc bảo lưu" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Lớp hiện tại</th>
                  <th>Yêu cầu</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                  <th>Ngày</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(request => (
                  <tr key={request.id}>
                    <td>
                      <span className="font-medium text-gray-900">
                        {request.student_name || request.studentName || request.student?.fullName || request.student?.full_name || request.student?.name || '-'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {request.current_class || request.currentClass || request.from_class || request.fromClass || '-'}
                    </td>
                    <td className="text-sm text-gray-500">
                      {request.type === 'change_class' || request.type === 'doi-lop' ? 'Đổi lớp' :
                       request.type === 'reserve' || request.type === 'bao-luu' ? 'Bảo lưu' :
                       request.to_class || request.toClass ? `Đổi sang: ${request.to_class || request.toClass}` :
                       request.request_type || request.requestType || 'Yêu cầu'}
                    </td>
                    <td className="text-sm text-gray-500 max-w-[200px] truncate">
                      {request.reason || request.note || request.description || '-'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeMap[request.status] || 'badge-neutral'}`}>
                        {statusLabels[request.status] || request.status || '-'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{formatDate(request.created_at || request.createdAt || request.date)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(request)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
                        {(request.status === 'PENDING' || request.status === 'pending') && (
                          <>
                            <button onClick={() => promptConfirm(request, 'approve')} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Phê duyệt">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => promptConfirm(request, 'reject')} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Từ chối">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
        title="Chi tiết yêu cầu"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                <ArrowRightLeft className="w-7 h-7 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedRequest.student_name || selectedRequest.studentName || selectedRequest.student?.fullName || '-'}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedRequest.type === 'change_class' || selectedRequest.type === 'doi-lop' ? 'Yêu cầu đổi lớp' : 'Yêu cầu bảo lưu'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Lớp hiện tại:</span> <span className="font-medium">{selectedRequest.current_class || selectedRequest.currentClass || selectedRequest.from_class || '-'}</span></div>
              <div><span className="text-gray-400">Lớp yêu cầu:</span> <span className="font-medium">{selectedRequest.to_class || selectedRequest.toClass || '-'}</span></div>
              <div><span className="text-gray-400">Trạng thái:</span> <span className="font-medium">{statusLabels[selectedRequest.status] || selectedRequest.status}</span></div>
              <div><span className="text-gray-400">Ngày:</span> <span className="font-medium">{formatDate(selectedRequest.created_at || selectedRequest.createdAt || selectedRequest.date)}</span></div>
              <div className="col-span-2">
                <span className="text-gray-400">Lý do:</span>{' '}
                <span className="font-medium">{selectedRequest.reason || selectedRequest.note || selectedRequest.description || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve/Reject Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleAction}
        title={confirmAction === 'approve' ? 'Phê duyệt yêu cầu?' : 'Từ chối yêu cầu?'}
        message={
          confirmAction === 'approve'
            ? `Phê duyệt yêu cầu của học viên ${selectedRequest?.student_name || selectedRequest?.studentName || '...'}?`
            : `Từ chối yêu cầu của học viên ${selectedRequest?.student_name || selectedRequest?.studentName || '...'}?`
        }
        confirmText={confirmAction === 'approve' ? 'Phê duyệt' : 'Từ chối'}
        variant={confirmAction === 'approve' ? 'success' : 'danger'}
      />
    </div>
  );
}
