import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Eye, DollarSign } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const statusBadgeMap = {
  PAID: 'badge-success', paid: 'badge-success',
  PENDING: 'badge-warning', pending: 'badge-warning',
  CANCELLED: 'badge-danger', cancelled: 'badge-danger',
  APPROVED: 'badge-success', approved: 'badge-success',
};

const statusLabels = {
  PAID: 'Đã thanh toán', paid: 'Đã thanh toán',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  CANCELLED: 'Đã hủy', cancelled: 'Đã hủy',
  APPROVED: 'Đã duyệt', approved: 'Đã duyệt',
};

const PAYMENT_METHODS = ['Chuyển khoản', 'Tiền mặt', 'Ví điện tử'];

export default function StaffPayments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  // Create receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    student_id: '', amount: 0, method: 'Chuyển khoản', description: '',
  });

  // Approve/Reject confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paymentsRes, studentsRes] = await Promise.all([
        api.getTuitionReport(),
        api.getUsers({ role: 'STUDENT' }),
      ]);

      const paymentData = paymentsRes.data || paymentsRes.payments || paymentsRes.transactions || [];
      setPayments(Array.isArray(paymentData) ? paymentData : []);
      setStudents((studentsRes.data || studentsRes.users || []).filter(u => u.role === 'STUDENT'));
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu thanh toán.');
      toast.error('Không thể tải dữ liệu thanh toán.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = payments.filter(p => {
    const s = search.toLowerCase();
    const code = (p.id || p.transaction_id || p.transactionId || '').toString().toLowerCase();
    const studentName = (p.student_name || p.studentName || p.student?.fullName || p.student?.full_name || '').toLowerCase();
    return code.includes(s) || studentName.includes(s);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  const handleCreateReceipt = async () => {
    if (!receiptForm.student_id || !receiptForm.amount) {
      toast.error('Vui lòng chọn học viên và nhập số tiền.');
      return;
    }
    setSaving(true);
    try {
      await api.processPayment({
        student_id: receiptForm.student_id,
        amount: receiptForm.amount,
        method: receiptForm.method,
        description: receiptForm.description,
      });
      toast.success('Đã tạo phiếu thu thành công.');
      setReceiptOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo phiếu thu.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await api.approveTransaction({ transaction_id: selectedPayment.id || selectedPayment.transaction_id });
      toast.success('Đã duyệt giao dịch.');
      setConfirmOpen(false);
      setSelectedPayment(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await api.approveTransaction({
        transaction_id: selectedPayment.id || selectedPayment.transaction_id,
        status: 'cancelled',
      });
      toast.success('Đã từ chối giao dịch.');
      setConfirmOpen(false);
      setSelectedPayment(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối.');
    } finally {
      setSaving(false);
    }
  };

  const promptConfirm = (payment, action) => {
    setSelectedPayment(payment);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const openDetail = (payment) => {
    setSelectedPayment(payment);
    setDetailOpen(true);
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
        title="Quản lý thanh toán"
        subtitle="Theo dõi và duyệt các giao dịch thanh toán"
        action={
          <button onClick={() => {
            setReceiptForm({ student_id: '', amount: 0, method: 'Chuyển khoản', description: '' });
            setReceiptOpen(true);
          }} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Tạo phiếu thu
          </button>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã giao dịch, tên học viên..." />
      </div>

      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={DollarSign} title="Chưa có giao dịch thanh toán nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã GD</th>
                  <th>Học viên</th>
                  <th>Số tiền</th>
                  <th>Phương thức</th>
                  <th>Trạng thái</th>
                  <th>Ngày</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(payment => (
                  <tr key={payment.id || payment.transaction_id}>
                    <td>
                      <span className="font-mono text-xs text-smc-600">
                        {payment.id || payment.transaction_id || payment.transactionId || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-gray-900">
                        {payment.student_name || payment.studentName || payment.student?.fullName || payment.student?.full_name || '-'}
                      </span>
                    </td>
                    <td className="font-semibold text-smc-600">{formatVND(payment.amount)}</td>
                    <td className="text-sm text-gray-500">{payment.method || payment.payment_method || '-'}</td>
                    <td>
                      <span className={`badge ${statusBadgeMap[payment.status] || 'badge-neutral'}`}>
                        {statusLabels[payment.status] || payment.status || '-'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{formatDate(payment.created_at || payment.createdAt || payment.date)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(payment)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
                        {(payment.status === 'PENDING' || payment.status === 'pending') && (
                          <>
                            <button onClick={() => promptConfirm(payment, 'approve')} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Duyệt">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => promptConfirm(payment, 'reject')} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Từ chối">
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

      {/* Create Receipt Modal */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Tạo phiếu thu"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Học viên</label>
            <select
              value={receiptForm.student_id}
              onChange={e => setReceiptForm(prev => ({ ...prev, student_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn học viên...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.full_name || s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Số tiền (VND)</label>
            <input
              type="number"
              value={receiptForm.amount}
              onChange={e => setReceiptForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="input-label">Phương thức</label>
            <select
              value={receiptForm.method}
              onChange={e => setReceiptForm(prev => ({ ...prev, method: e.target.value }))}
              className="input-field"
            >
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Mô tả</label>
            <textarea
              value={receiptForm.description}
              onChange={e => setReceiptForm(prev => ({ ...prev, description: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Mô tả giao dịch..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setReceiptOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleCreateReceipt} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Tạo phiếu thu'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết giao dịch"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-smc-100 flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-smc-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Mã GD:</span> <span className="font-medium font-mono">{selectedPayment.id || selectedPayment.transaction_id || '-'}</span></div>
              <div><span className="text-gray-400">Số tiền:</span> <span className="font-semibold text-smc-600">{formatVND(selectedPayment.amount)}</span></div>
              <div><span className="text-gray-400">Phương thức:</span> <span className="font-medium">{selectedPayment.method || selectedPayment.payment_method || '-'}</span></div>
              <div><span className="text-gray-400">Trạng thái:</span> <span className="font-medium">{statusLabels[selectedPayment.status] || selectedPayment.status}</span></div>
              <div className="col-span-2"><span className="text-gray-400">Học viên:</span> <span className="font-medium">{selectedPayment.student_name || selectedPayment.studentName || selectedPayment.student?.fullName || '-'}</span></div>
              <div className="col-span-2"><span className="text-gray-400">Ngày:</span> <span className="font-medium">{formatDate(selectedPayment.created_at || selectedPayment.createdAt || selectedPayment.date)}</span></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve/Reject Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmAction === 'approve' ? handleApprove : handleReject}
        title={confirmAction === 'approve' ? 'Duyệt giao dịch?' : 'Từ chối giao dịch?'}
        message={
          confirmAction === 'approve'
            ? `Duyệt giao dịch ${formatVND(selectedPayment?.amount || 0)} của học viên ${selectedPayment?.student_name || selectedPayment?.studentName || '...'}?`
            : `Từ chối giao dịch ${formatVND(selectedPayment?.amount || 0)} của học viên ${selectedPayment?.student_name || selectedPayment?.studentName || '...'}?`
        }
        confirmText={confirmAction === 'approve' ? 'Duyệt' : 'Từ chối'}
        variant={confirmAction === 'approve' ? 'success' : 'danger'}
      />
    </div>
  );
}
