import { useState, useEffect, useCallback } from 'react';
import { DollarSign, CreditCard, Wallet, Calendar, CheckCircle, Clock, AlertCircle, Banknote } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

export default function StudentPayment() {
  const [tuition, setTuition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyTuition();
      const data = res.data || res.tuition || res || {};
      setTuition(data);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải thông tin học phí.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalAmount = tuition?.total_amount || tuition?.totalAmount || tuition?.total || 0;
  const paidAmount = tuition?.paid_amount || tuition?.paidAmount || tuition?.paid || 0;
  const remainingAmount = totalAmount - paidAmount;
  const payments = tuition?.payments || tuition?.transactions || [];
  const schedule = tuition?.schedule || tuition?.payment_schedule || tuition?.paymentSchedule || [];

  const getPaymentStatusBadge = (p) => {
    const status = p.status || p.payment_status || 'pending';
    if (status === 'completed' || status === 'paid' || status === 'COMPLETED') return 'badge-success';
    if (status === 'pending' || status === 'PENDING') return 'badge-warning';
    if (status === 'failed' || status === 'FAILED') return 'badge-danger';
    return 'badge-neutral';
  };

  const getPaymentStatusLabel = (p) => {
    const status = p.status || p.payment_status || 'pending';
    const map = {
      completed: 'Thành công', paid: 'Đã thanh toán', COMPLETED: 'Thành công',
      pending: 'Đang xử lý', PENDING: 'Đang xử lý',
      failed: 'Thất bại', FAILED: 'Thất bại',
    };
    return map[status] || status;
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
      <PageHeader title="Học phí" subtitle="Thông tin học phí và thanh toán" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-smc-100 flex items-center justify-center mx-auto mb-3">
            <Banknote className="w-5 h-5 text-smc-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatVND(totalAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">Tổng học phí</div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-ios-lg bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">{formatVND(paidAmount)}</div>
          <div className="text-xs text-gray-500 mt-1">Đã thanh toán</div>
        </div>
        <div className="card text-center">
          <div className={`w-10 h-10 rounded-ios-lg flex items-center justify-center mx-auto mb-3 ${
            remainingAmount > 0 ? 'bg-red-100' : 'bg-green-100'
          }`}>
            {remainingAmount > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className={`text-2xl font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {formatVND(remainingAmount)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Còn lại</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment history */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Lịch sử thanh toán</h3>
          </div>
          <div className="table-wrap">
            {payments.length === 0 ? (
              <EmptyState icon={CreditCard} title="Chưa có khoản thanh toán nào" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr key={p.id || idx}>
                      <td className="text-sm">{p.date || p.payment_date || p.created_at || p.createdAt || '-'}</td>
                      <td className="text-sm font-semibold">{formatVND(p.amount || p.payment_amount || 0)}</td>
                      <td className="text-sm text-gray-500">{p.method || p.payment_method || '-'}</td>
                      <td>
                        <span className={`badge ${getPaymentStatusBadge(p)}`}>
                          {getPaymentStatusLabel(p)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payment schedule */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Kế hoạch thanh toán</h3>
          </div>
          <div className="table-wrap">
            {schedule.length === 0 ? (
              <EmptyState icon={Calendar} title="Chưa có kế hoạch thanh toán" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Đợt</th>
                    <th>Số tiền</th>
                    <th>Hạn thanh toán</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((s, idx) => (
                    <tr key={s.id || idx}>
                      <td className="text-sm font-medium">{s.name || s.phase || `Đợt ${idx + 1}`}</td>
                      <td className="text-sm font-semibold">{formatVND(s.amount || s.payment_amount || 0)}</td>
                      <td className="text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {s.due_date || s.dueDate || '-'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.paid || s.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                          {s.paid || s.status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Payment CTA */}
      {remainingAmount > 0 && (
        <div className="card mt-6 text-center">
          <div className="w-16 h-16 rounded-full bg-smc-100 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-smc-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Bạn còn {formatVND(remainingAmount)} cần thanh toán
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Vui lòng liên hệ trung tâm hoặc chuyển khoản theo hướng dẫn để hoàn tất học phí.
          </p>
          <button className="btn-primary">
            <DollarSign className="w-4 h-4 mr-2" />
            Hướng dẫn thanh toán
          </button>
        </div>
      )}
    </div>
  );
}
