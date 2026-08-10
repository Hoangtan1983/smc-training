import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Clock, CheckCircle, AlertCircle, TrendingUp, Wallet } from 'lucide-react';
import * as api from '../../data/api';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const barMax = (items) => Math.max(...(items || []).map((i) => i.revenue || i.total || i.value || 0), 1);

export default function AccountantDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingApprovals: 0,
    approved: 0,
    totalDebt: 0,
    agencyCommission: 0,
    cashBalance: 0,
  });
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, tuitionListRes, revenueRes] = await Promise.all([
        api.getTuitionReport(),
        api.getTuitionList(),
        api.getReports('revenue'),
      ]);

      const report = reportRes.data || reportRes || {};
      const tuitionList = tuitionListRes.data || tuitionListRes.tuitions || tuitionListRes.list || [];
      const revenueData = revenueRes.data || revenueRes || {};

      setStats({
        totalRevenue:
          report.total_revenue || report.totalRevenue || revenueData.revenue_this_month || revenueData.revenueThisMonth || 0,
        pendingApprovals:
          tuitionList.filter(
            (t) => t.status === 'PENDING' || t.status === 'pending' || t.approval_status === 'pending'
          ).length,
        approved:
          tuitionList.filter(
            (t) => t.status === 'PAID' || t.status === 'paid' || t.approval_status === 'approved'
          ).length,
        totalDebt: report.total_debt || report.totalDebt || revenueData.total_debt || 0,
        agencyCommission: report.agency_commission || report.agencyCommission || revenueData.agency_commission || 0,
        cashBalance: report.cash_balance || report.cashBalance || revenueData.cash_balance || 0,
      });

      const pending = tuitionList
        .filter(
          (t) => t.status === 'PENDING' || t.status === 'pending' || t.approval_status === 'pending'
        )
        .slice(0, 5);
      setPendingTransactions(pending);

      const revenue =
        revenueData.monthly || revenueData.monthly_revenue || revenueData.revenueByMonth || [];
      setMonthlyRevenue(revenue.slice(-6));
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <PageHeader title="Bảng điều khiển" subtitle="Tổng quan tài chính SMC Training" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={DollarSign} label="Tổng thu tháng này" value={formatVND(stats.totalRevenue)} color="green" />
        <StatCard icon={Clock} label="Chờ duyệt" value={stats.pendingApprovals} color="orange" />
        <StatCard icon={CheckCircle} label="Đã duyệt" value={stats.approved} color="smc" />
        <StatCard icon={AlertCircle} label="Tổng nợ" value={formatVND(stats.totalDebt)} color="red" />
        <StatCard icon={TrendingUp} label="Hoa hồng đại lý" value={formatVND(stats.agencyCommission)} color="purple" />
        <StatCard icon={Wallet} label="Sổ quỹ" value={formatVND(stats.cashBalance)} color="smc" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending transactions */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Giao dịch chờ duyệt</h3>
          </div>
          <div className="table-wrap">
            {pendingTransactions.length === 0 ? (
              <EmptyState icon={Clock} title="Không có giao dịch chờ duyệt" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Học viên</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTransactions.map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono text-xs text-smc-600">#{item.id || item.code}</td>
                      <td className="font-medium text-gray-900 text-sm">
                        {item.student_name || item.studentName || item.student?.fullName || item.student?.full_name || '-'}
                      </td>
                      <td className="font-semibold text-sm">{formatVND(item.amount || item.total)}</td>
                      <td>
                        <span className={`badge ${paymentStatusMap[item.status] || 'badge-neutral'}`}>
                          {paymentLabels[item.status] || item.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Revenue bar chart */}
        <div className="card">
          <h3 className="text-base font-bold text-gray-900 mb-4">Doanh thu 6 tháng gần nhất</h3>
          {monthlyRevenue.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Chưa có dữ liệu doanh thu" />
          ) : (
            <div className="flex items-end gap-3 h-48 px-2">
              {monthlyRevenue.map((item, idx) => {
                const val = item.revenue || item.total || item.value || 0;
                const maxVal = barMax(monthlyRevenue);
                const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-[40px]">
                    <span className="text-xs font-medium text-gray-600">
                      {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}K`}
                    </span>
                    <div
                      className="w-full rounded-t-ios bg-green-500 transition-all duration-500"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                    <span className="text-xs text-gray-400">{item.month || item.label || `T${idx + 1}`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
