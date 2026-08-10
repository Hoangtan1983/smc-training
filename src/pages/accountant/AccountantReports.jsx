import { useState, useEffect, useCallback } from 'react';
import { Building, DollarSign, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const TABS = [
  { key: 'bank', label: 'Đối chiếu ngân hàng' },
  { key: 'revenue', label: 'Doanh thu' },
  { key: 'debts', label: 'Công nợ' },
];

const barMax = (items) => Math.max(...(items || []).map((i) => i.revenue || i.total || i.value || 0), 1);

export default function AccountantReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('bank');
  const [bankData, setBankData] = useState([]);
  const [revenueData, setRevenueData] = useState(null);
  const [debtData, setDebtData] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenueRes, debtsRes] = await Promise.all([
        api.getReports('revenue'),
        api.getReports('debts'),
      ]);

      const rev = revenueRes.data || revenueRes || {};
      const debts = debtsRes.data || debtsRes || {};

      setBankData(rev.bank_transactions || rev.bankTransactions || rev.bank_reconciliation || []);
      setRevenueData(rev);
      setDebtData(debts.students || debts.data || debts.debtors || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu báo cáo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const matchStatus = (item) => {
    if (item.matched) return 'badge-success';
    if (item.reconciled) return 'badge-success';
    if (item.status === 'matched') return 'badge-success';
    return 'badge-warning';
  };

  const matchLabel = (item) => {
    if (item.matched || item.reconciled || item.status === 'matched') return 'Đã khớp';
    return 'Chưa khớp';
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
      <PageHeader title="Báo cáo & Đối chiếu" subtitle="Báo cáo tài chính và đối chiếu ngân hàng" />

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex flex-wrap">
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

      {/* Tab: Bank Reconciliation */}
      {activeTab === 'bank' && (
        <div className="space-y-6">
          <div className="table-container">
            <div className="table-header">
              <h3 className="text-base font-bold text-gray-900">Đối chiếu giao dịch ngân hàng</h3>
            </div>
            <div className="table-wrap">
              {bankData.length === 0 ? (
                <EmptyState icon={Building} title="Chưa có dữ liệu đối chiếu ngân hàng" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày GD ngân hàng</th>
                      <th>Mô tả</th>
                      <th>Số tiền NH</th>
                      <th>Mã GD hệ thống</th>
                      <th>Số tiền HT</th>
                      <th>Chênh lệch</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankData.map((item, idx) => {
                      const bankAmount = item.bank_amount || item.bankAmount || item.amount || 0;
                      const sysAmount = item.system_amount || item.systemAmount || item.tuition_amount || 0;
                      const diff = bankAmount - sysAmount;
                      return (
                        <tr key={item.id || idx}>
                          <td className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(item.bank_date || item.date || item.bankDate)}
                          </td>
                          <td className="text-sm text-gray-900">
                            {item.description || item.desc || item.bank_description || '-'}
                          </td>
                          <td className="font-semibold text-sm">{formatVND(bankAmount)}</td>
                          <td className="font-mono text-xs text-smc-600">
                            {item.system_ref || item.systemRef || item.tuition_code || item.ref || `#${item.id}`}
                          </td>
                          <td className="font-semibold text-sm">{formatVND(sysAmount)}</td>
                          <td className="text-sm">
                            {diff === 0 ? (
                              <span className="text-green-600 font-medium">0đ</span>
                            ) : (
                              <span className={diff > 0 ? 'text-red-500 font-medium' : 'text-orange-500 font-medium'}>
                                {diff > 0 ? '+' : ''}{formatVND(diff)}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${matchStatus(item)}`}>
                              {matchLabel(item)}
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
      )}

      {/* Tab: Revenue */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Bar chart */}
          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">Doanh thu theo tháng</h3>
            {revenueData?.monthly || revenueData?.monthly_revenue || revenueData?.revenueByMonth ? (
              <div className="flex items-end gap-3 h-56 px-2">
                {(revenueData?.monthly || revenueData?.monthly_revenue || revenueData?.revenueByMonth || []).map((item, idx) => {
                  const val = item.revenue || item.total || item.value || 0;
                  const maxVal = barMax(revenueData?.monthly || revenueData?.monthly_revenue || revenueData?.revenueByMonth || []);
                  const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-[40px]">
                      <span className="text-xs font-medium text-gray-600">
                        {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}K`}
                      </span>
                      <div
                        className="w-full rounded-t-ios bg-smc-500 transition-all duration-500"
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                      <span className="text-xs text-gray-400">{item.month || item.label || `T${idx + 1}`}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title="Chưa có dữ liệu doanh thu" />
            )}
          </div>

          {/* Revenue table */}
          <div className="table-container">
            <div className="table-header">
              <h3 className="text-base font-bold text-gray-900">Chi tiết doanh thu</h3>
            </div>
            <div className="table-wrap">
              {!revenueData?.monthly && !revenueData?.monthly_revenue && !revenueData?.revenueByMonth ? (
                <EmptyState icon={DollarSign} title="Chưa có dữ liệu doanh thu" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tháng</th>
                      <th>Doanh thu</th>
                      <th>Số giao dịch</th>
                      <th>Đã thanh toán</th>
                      <th>Chưa thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revenueData?.monthly || revenueData?.monthly_revenue || revenueData?.revenueByMonth || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="font-medium">{item.month || item.label || `T${idx + 1}`}</td>
                        <td className="font-semibold text-smc-600">{formatVND(item.revenue || item.total || 0)}</td>
                        <td className="text-sm">{item.transactions || item.count || 0}</td>
                        <td className="text-sm text-green-600">{formatVND(item.paid || item.completed || 0)}</td>
                        <td className="text-sm text-red-500">{formatVND(item.unpaid || item.pending || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Debts */}
      {activeTab === 'debts' && (
        <div className="space-y-6">
          <div className="table-container">
            <div className="table-header">
              <h3 className="text-base font-bold text-gray-900">Danh sách học viên còn nợ</h3>
            </div>
            <div className="table-wrap">
              {debtData.length === 0 ? (
                <EmptyState icon={AlertCircle} title="Không có học viên nào còn nợ" />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Học viên</th>
                      <th>Email</th>
                      <th>Khóa học</th>
                      <th>Tổng học phí</th>
                      <th>Đã trả</th>
                      <th>Còn nợ</th>
                      <th>Ngày hết hạn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtData.map((item, idx) => {
                      const remaining = (item.total || item.amount || 0) - (item.paid || item.paidAmount || 0);
                      return (
                        <tr key={item.id || idx}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                                {(item.student_name || item.studentName || item.name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-900">
                                {item.student_name || item.studentName || item.name || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="text-sm text-gray-500">{item.email || '-'}</td>
                          <td className="text-sm text-gray-500">{item.course_name || item.courseName || '-'}</td>
                          <td className="font-semibold text-sm">{formatVND(item.total || item.amount || 0)}</td>
                          <td className="text-sm text-green-600">{formatVND(item.paid || item.paidAmount || 0)}</td>
                          <td className="font-semibold text-sm text-red-500">{formatVND(remaining)}</td>
                          <td className="text-sm text-gray-500">{formatDate(item.due_date || item.dueDate)}</td>
                          <td>
                            {remaining > 0 ? (
                              <span className="badge badge-danger">Còn nợ</span>
                            ) : (
                              <span className="badge badge-success">Đã xong</span>
                            )}
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
      )}
    </div>
  );
}
