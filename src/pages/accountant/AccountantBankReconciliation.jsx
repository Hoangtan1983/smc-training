import { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle, XCircle, Clock, Building, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }); } catch { return d; }
};

export default function AccountantBankReconciliation() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tuitionRes, paymentRes] = await Promise.all([
        api.getTuitionList().catch(() => ({ data: [] })),
        api.getReports('payments').catch(() => ({ data: {} })),
      ]);

      const tuitionData = tuitionRes.data || tuitionRes.tuitions || [];
      const paymentData = paymentRes.data || paymentRes || {};

      const bankTxns = paymentData.bank_transactions || paymentData.transactions || [];
      const allTxns = [...bankTxns];

      if (allTxns.length === 0 && Array.isArray(tuitionData)) {
        tuitionData.forEach((t) => {
          const payments = t.payments || t.transactions || [];
          payments.forEach((p) => {
            if (p.method === 'bank_transfer' || p.method === 'chuyen_khoan' || p.payment_method === 'bank_transfer') {
              allTxns.push({
                ...p,
                student_name: t.student_name || t.studentName || '-',
                course_name: t.course_name || t.courseName || '-',
              });
            }
          });
        });
      }

      setTransactions(allTxns);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu đối chiếu.');
      toast.error('Không thể tải dữ liệu đối chiếu ngân hàng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const getTxnDate = (txn) => {
    return txn.date || txn.transaction_date || txn.payment_date || txn.created_at || txn.createdAt || '';
  };

  const filtered = transactions.filter((txn) => {
    const matchSearch =
      !search ||
      ((txn.student_name || txn.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
        (txn.reference || txn.bank_ref || txn.transaction_id || '').toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    const txnDate = getTxnDate(txn);
    if (txnDate && (selectedMonth || selectedYear)) {
      try {
        const d = new Date(txnDate);
        if (selectedMonth && d.getMonth() + 1 !== selectedMonth) return false;
        if (selectedYear && d.getFullYear() !== selectedYear) return false;
      } catch { /* keep if date is invalid */ }
    }

    if (filterStatus) {
      const status = (txn.status || txn.reconciliation_status || 'pending').toLowerCase();
      if (status !== filterStatus.toLowerCase()) return false;
    }

    return true;
  });

  const totalMatched = filtered.filter((t) => {
    const status = (t.status || t.reconciliation_status || '').toLowerCase();
    return status === 'matched' || status === 'reconciled' || status === 'completed';
  }).length;
  const totalUnmatched = filtered.filter((t) => {
    const status = (t.status || t.reconciliation_status || '').toLowerCase();
    return status === 'pending' || status === 'unmatched';
  }).length;

  const matchedAmount = filtered
    .filter((t) => {
      const status = (t.status || t.reconciliation_status || '').toLowerCase();
      return status === 'matched' || status === 'reconciled' || status === 'completed';
    })
    .reduce((sum, t) => sum + (Number(t.amount || t.payment_amount || 0)), 0);

  const unmatchedAmount = filtered
    .filter((t) => {
      const status = (t.status || t.reconciliation_status || '').toLowerCase();
      return status === 'pending' || status === 'unmatched';
    })
    .reduce((sum, t) => sum + (Number(t.amount || t.payment_amount || 0)), 0);

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
      <PageHeader title="Đối chiếu ngân hàng" subtitle="Đối chiếu giao dịch chuyển khoản với hệ thống" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-smc-100 flex items-center justify-center mx-auto mb-3">
            <Building className="w-5 h-5 text-smc-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{filtered.length}</div>
          <div className="text-xs text-gray-500 mt-1">Tổng giao dịch</div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{totalMatched}</div>
          <div className="text-xs text-gray-500 mt-1">Đã khớp</div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-orange-100 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{totalUnmatched}</div>
          <div className="text-xs text-gray-500 mt-1">Chưa khớp</div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <ArrowDownLeft className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-600">{formatVND(matchedAmount + unmatchedAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">Tổng giá trị</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Tìm theo tên học viên hoặc mã tham chiếu..."
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="matched">Đã khớp</option>
          <option value="pending">Chưa khớp</option>
          <option value="unmatched">Không khớp</option>
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="input-field w-full sm:w-36"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input-field w-full sm:w-28"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Building}
              title={search || filterStatus ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch chuyển khoản nào'}
              description={search || filterStatus ? 'Thử lại với bộ lọc khác.' : 'Chưa có giao dịch chuyển khoản nào cần đối chiếu.'}
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Mã tham chiếu</th>
                  <th>Học viên</th>
                  <th>Số tiền</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn, idx) => {
                  const status = (txn.status || txn.reconciliation_status || 'pending').toLowerCase();
                  const isReconciled = status === 'matched' || status === 'reconciled' || status === 'completed';
                  const isType = txn.type || txn.direction || 'in';
                  return (
                    <tr key={txn.id || idx}>
                      <td className="text-sm text-gray-500">{formatDate(getTxnDate(txn))}</td>
                      <td className="text-sm font-mono text-gray-600">
                        {txn.reference || txn.bank_ref || txn.transaction_id || '-'}
                      </td>
                      <td className="text-sm font-medium text-gray-900">
                        {txn.student_name || txn.studentName || txn.student?.fullName || txn.student?.full_name || '-'}
                      </td>
                      <td className="text-sm font-semibold">
                        <span className="flex items-center gap-1">
                          {isType === 'out' || isType === 'debit' ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
                          )}
                          <span className={isType === 'out' || isType === 'debit' ? 'text-red-600' : 'text-green-600'}>
                            {formatVND(txn.amount || txn.payment_amount || 0)}
                          </span>
                        </span>
                      </td>
                      <td className="text-sm text-gray-500 max-w-[200px] truncate">
                        {txn.description || txn.note || txn.content || '-'}
                      </td>
                      <td>
                        <span className={`badge ${isReconciled ? 'badge-success' : txn.status === 'unmatched' ? 'badge-danger' : 'badge-warning'}`}>
                          {isReconciled ? 'Đã khớp' : status === 'unmatched' ? 'Không khớp' : 'Chưa khớp'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
