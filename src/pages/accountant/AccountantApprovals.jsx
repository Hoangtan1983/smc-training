import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const TABS = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Từ chối' },
];

const paymentStatusMap = {
  PAID: 'badge-success', paid: 'badge-success',
  UNPAID: 'badge-danger', unpaid: 'badge-danger',
  PARTIAL: 'badge-warning', partial: 'badge-warning',
  PENDING: 'badge-info', pending: 'badge-info',
};

const paymentLabels = {
  PAID: 'Đã thanh toán', paid: 'Đã thanh toán',
  UNPAID: 'Chưa thanh toán', unpaid: 'Chưa thanh toán',
  PARTIAL: 'Một phần', partial: 'Một phần',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
};

export default function AccountantApprovals() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTuitionList();
      const data = res.data || res.tuitions || res.list || [];
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu phiếu thu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = transactions.filter((item) => {
    const matchSearch = () => {
      const str = search.toLowerCase();
      const code = `#${item.id || item.code}`.toLowerCase();
      const studentName = (
        item.student_name ||
        item.studentName ||
        item.student?.fullName ||
        item.student?.full_name ||
        ''
      ).toLowerCase();
      return code.includes(str) || studentName.includes(str);
    };
    const matchTab = () => {
      const status = (item.approval_status || item.status || '').toLowerCase();
      if (activeTab === 'pending') return status === 'pending';
      if (activeTab === 'approved') return status === 'approved' || status === 'paid';
      if (activeTab === 'rejected') return status === 'rejected';
      return true;
    };
    return matchSearch() && matchTab();
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  const openDetail = (item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const openApprove = (item) => {
    setSelectedItem(item);
    setApproveNote('');
    setApproveOpen(true);
  };

  const openReject = (item) => {
    setSelectedItem(item);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await api.approveTransaction({
        tuition_id: selectedItem.id,
        notes: approveNote,
      });
      toast.success('Đã duyệt phiếu thu thành công.');
      setApproveOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt phiếu thu.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    setSaving(true);
    try {
      await api.processPayment({
        tuition_id: selectedItem.id,
        action: 'reject',
        reason: rejectReason,
      });
      toast.success('Đã từ chối phiếu thu.');
      setRejectOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối phiếu thu.');
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (item) => {
    return (
      item.student_name ||
      item.studentName ||
      item.student?.fullName ||
      item.student?.full_name ||
      item.student?.name ||
      '-'
    );
  };

  const getPaymentMethodLabel = (method) => {
    const map = {
      cash: 'Tiền mặt',
      bank_transfer: 'Chuyển khoản',
      credit_card: 'Thẻ tín dụng',
      momo: 'Ví MoMo',
      zalopay: 'ZaloPay',
    };
    return map[method?.toLowerCase()] || method || 'Tiền mặt';
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
      <PageHeader title="Duyệt phiếu thu" subtitle="Xét duyệt các phiếu thu học phí" />

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã phiếu, tên học viên..." />
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={Clock} title="Không có phiếu thu nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Học viên</th>
                  <th>Số tiền</th>
                  <th>Phương thức</th>
                  <th>Ngày</th>
                  <th>Người nộp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-xs text-smc-600">#{item.id || item.code || item.invoice_code}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-xs font-bold text-pink-600">
                          {(getStudentName(item) || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{getStudentName(item)}</span>
                      </div>
                    </td>
                    <td className="font-semibold">{formatVND(item.amount || item.total)}</td>
                    <td className="text-sm text-gray-500">
                      {getPaymentMethodLabel(item.payment_method || item.paymentMethod)}
                    </td>
                    <td className="text-sm text-gray-500">{formatDate(item.created_at || item.createdAt || item.date)}</td>
                    <td className="text-sm text-gray-500">
                      {item.payer_name || item.payerName || item.submitted_by || '-'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(item)}
                          className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {activeTab === 'pending' && (
                          <>
                            <button
                              onClick={() => openApprove(item)}
                              className="btn-ghost btn-sm px-2 text-xs text-green-600 hover:bg-green-50"
                              title="Duyệt"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Duyệt
                            </button>
                            <button
                              onClick={() => openReject(item)}
                              className="btn-ghost btn-sm px-2 text-xs text-red-600 hover:bg-red-50"
                              title="Từ chối"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Từ chối
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết phiếu thu" size="lg">
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Mã phiếu:</span>{' '}
                <span className="font-medium font-mono">
                  #{selectedItem.id || selectedItem.code || selectedItem.invoice_code}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Trạng thái:</span>{' '}
                <span className={`badge ${paymentStatusMap[selectedItem.status] || 'badge-neutral'}`}>
                  {paymentLabels[selectedItem.status] || selectedItem.approval_status || selectedItem.status}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Tổng tiền:</span>{' '}
                <span className="font-semibold">{formatVND(selectedItem.amount || selectedItem.total)}</span>
              </div>
              <div>
                <span className="text-gray-400">Phương thức:</span>{' '}
                <span className="font-medium">
                  {getPaymentMethodLabel(selectedItem.payment_method || selectedItem.paymentMethod)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Học viên:</span>{' '}
                <span className="font-medium">{getStudentName(selectedItem)}</span>
              </div>
              <div>
                <span className="text-gray-400">Người nộp:</span>{' '}
                <span className="font-medium">
                  {selectedItem.payer_name || selectedItem.payerName || selectedItem.submitted_by || '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Ngày tạo:</span>{' '}
                <span className="font-medium">{formatDate(selectedItem.created_at || selectedItem.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-400">Loại:</span>{' '}
                <span className="font-medium">{selectedItem.type || 'Học phí'}</span>
              </div>
            </div>

            {selectedItem.notes && (
              <div className="text-sm">
                <span className="text-gray-400">Ghi chú:</span> <span>{selectedItem.notes}</span>
              </div>
            )}

            {/* Attachment / receipt image */}
            {selectedItem.image_url || selectedItem.receipt_url || selectedItem.attachment ? (
              <div className="p-3 bg-gray-50 rounded-ios-xl">
                <p className="text-sm font-medium text-gray-700 mb-2">Chứng từ / Hình ảnh</p>
                <img
                  src={selectedItem.image_url || selectedItem.receipt_url || selectedItem.attachment}
                  alt="Chứng từ"
                  className="max-w-full max-h-64 rounded-ios-lg object-contain border"
                />
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-ios-xl text-center text-sm text-gray-400">
                Không có chứng từ đính kèm
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Duyệt phiếu thu">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Phiếu thu <strong>#{selectedItem?.id || selectedItem?.code}</strong> -{' '}
              <strong>{formatVND(selectedItem?.amount || 0)}</strong>
            </p>
          </div>
          <div>
            <label className="input-label">Ghi chú duyệt (không bắt buộc)</label>
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Nhập ghi chú nếu có..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setApproveOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleApprove} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Xác nhận duyệt'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Từ chối phiếu thu">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Phiếu thu <strong>#{selectedItem?.id || selectedItem?.code}</strong> -{' '}
              <strong>{formatVND(selectedItem?.amount || 0)}</strong>
            </p>
          </div>
          <div>
            <label className="input-label">Lý do từ chối <span className="text-red-500">*</span></label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Nhập lý do từ chối..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setRejectOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleReject} disabled={saving} className="btn-danger flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Từ chối'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
