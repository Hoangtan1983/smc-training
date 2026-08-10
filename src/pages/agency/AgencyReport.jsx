import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const MONTHS = [
  { value: 1, label: 'Tháng 1' }, { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' }, { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' }, { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' }, { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' }, { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' }, { value: 12, label: 'Tháng 12' },
];

export default function AgencyReport() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReports('agency');
      setReportData(res.data || res || {});
    } catch (err) {
      setError(err.message || 'Không thể tải báo cáo.');
      toast.error('Không thể tải dữ liệu báo cáo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const commissions = reportData?.monthly_commissions || reportData?.monthlyCommissions || [];

  const filteredCommissions = selectedMonth
    ? commissions.filter((item) => {
        const itemMonth = item.month ? parseInt(item.month.split('/')[0] || item.month.split('-')[0] || '0') : 0;
        const itemYear = item.month ? parseInt(item.month.split('/')[1] || item.month.split('-')[1] || `${selectedYear}`) : selectedYear;
        return itemMonth === selectedMonth && itemYear === selectedYear;
      })
    : commissions;

  const totalYearCommission = commissions
    .filter((item) => {
      const itemYear = item.month ? parseInt(item.month.split('/')[1] || item.month.split('-')[1] || '0') : 0;
      return itemYear === selectedYear;
    })
    .reduce((sum, item) => sum + (item.commission || item.amount || item.total || 0), 0);

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
      <PageHeader title="Báo cáo hoa hồng" subtitle="Theo dõi hoa hồng theo tháng và năm" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả tháng</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input-field w-full sm:w-32"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary card */}
      <div className="mb-6">
        <StatCard
          icon={DollarSign}
          label={`Tổng hoa hồng năm ${selectedYear}`}
          value={formatVND(totalYearCommission)}
          color="green"
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {commissions.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Chưa có dữ liệu hoa hồng" />
          ) : filteredCommissions.length === 0 ? (
            <EmptyState icon={TrendingUp} title={`Không có dữ liệu cho tháng ${selectedMonth}/${selectedYear}`} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Số học viên mới</th>
                  <th>Tổng thu</th>
                  <th>Tỷ lệ hoa hồng</th>
                  <th>Hoa hồng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map((item, idx) => {
                  const settled = item.status === 'settled' || item.status === 'SETTLED' || item.settled || item.is_settled;
                  return (
                    <tr key={idx}>
                      <td className="font-medium text-gray-900">{item.month || item.label || '-'}</td>
                      <td className="text-sm text-gray-500">{item.student_count || item.count || 0}</td>
                      <td className="font-semibold text-sm">{formatVND(item.total_revenue || item.totalRevenue || item.revenue || 0)}</td>
                      <td className="text-sm text-gray-500">{item.commission_rate || item.commissionRate || 10}%</td>
                      <td className="font-semibold text-green-600">{formatVND(item.commission || item.amount || item.total || 0)}</td>
                      <td>
                        <span className={`badge ${settled ? 'badge-success' : 'badge-warning'}`}>
                          {settled ? 'Đã quyết toán' : 'Chưa quyết toán'}
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
