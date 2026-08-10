import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Users, GraduationCap, TrendingUp } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { key: 'revenue', label: 'Doanh thu', icon: DollarSign },
  { key: 'students', label: 'Học viên', icon: Users },
  { key: 'teachers', label: 'Giảng viên', icon: GraduationCap },
];

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [reportData, setReportData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReports(activeTab);
      setReportData(res.data || res);
    } catch (err) {
      setError(err.message || 'Không thể tải báo cáo.');
      toast.error('Không thể tải dữ liệu báo cáo.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const barMax = (items) => Math.max(...(items || []).map(i => i.value || i.count || i.total || 0), 1);

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
      <PageHeader title="Báo cáo & Thống kê" subtitle="Phân tích dữ liệu hệ thống" />

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Doanh thu tháng này" value={formatVND(reportData?.revenue_this_month || reportData?.revenue?.thisMonth || 0)} color="green" />
            <StatCard icon={Users} label="Học viên mới" value={reportData?.new_students || reportData?.students?.new || 0} color="smc" />
            <StatCard icon={GraduationCap} label="Chứng chỉ đã cấp" value={reportData?.certificates_issued || reportData?.certificates?.total || 0} color="purple" />
            <StatCard icon={TrendingUp} label="Tỉ lệ hoàn thành" value={`${reportData?.completion_rate || reportData?.completionRate || 0}%`} color="orange" />
          </div>

          {/* CSS Bar chart for revenue by month */}
          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">Doanh thu theo tháng</h3>
            {reportData?.revenue_by_month || reportData?.revenueByMonth ? (
              <div className="flex items-end gap-3 h-48 px-2">
                {(reportData?.revenue_by_month || reportData?.revenueByMonth || []).map((item, idx) => {
                  const val = item.revenue || item.total || item.value || 0;
                  const heightPct = barMax(reportData?.revenue_by_month || reportData?.revenueByMonth || []) > 0
                    ? (val / barMax(reportData?.revenue_by_month || reportData?.revenueByMonth || [])) * 100
                    : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-[40px]">
                      <span className="text-xs font-medium text-gray-600">
                        {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}K`}
                      </span>
                      <div className="w-full rounded-t-ios bg-smc-500 transition-all duration-500" style={{ height: `${Math.max(heightPct, 4)}%` }} />
                      <span className="text-xs text-gray-400">{item.month || item.label || `T${idx + 1}`}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Chưa có dữ liệu doanh thu" />
            )}
          </div>

          {/* Summary */}
          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">Tổng quan hệ thống</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-extrabold text-gray-900">{reportData?.total_users || reportData?.users?.total || 0}</div>
                <div className="text-sm text-gray-500">Người dùng</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-gray-900">{reportData?.total_courses || reportData?.courses?.total || 0}</div>
                <div className="text-sm text-gray-500">Khóa học</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-gray-900">{reportData?.total_classes || reportData?.classes?.total || 0}</div>
                <div className="text-sm text-gray-500">Lớp học</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-gray-900">{reportData?.total_enrollments || reportData?.enrollments?.total || 0}</div>
                <div className="text-sm text-gray-500">Tuyển sinh</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="table-container">
          <div className="table-wrap">
            {!reportData?.revenue_data && !reportData?.monthly && !reportData?.data ? (
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
                  {(reportData?.revenue_data || reportData?.monthly || reportData?.data || []).map((item, idx) => (
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
      )}

      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">Học viên theo khóa học</h3>
            {reportData?.by_course || reportData?.studentsByCourse ? (
              <div className="space-y-3">
                {(reportData?.by_course || reportData?.studentsByCourse || []).map((item, idx) => {
                  const maxVal = barMax(reportData?.by_course || reportData?.studentsByCourse || []);
                  const val = item.count || item.total || item.students || 0;
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 w-32 truncate">{item.course_name || item.name || `Khóa ${idx + 1}`}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="h-full bg-smc-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-10 text-right">{val}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Chưa có dữ liệu theo khóa học" />
            )}
          </div>

          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">Học viên theo trạng thái</h3>
            {reportData?.by_status || reportData?.studentsByStatus ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                {(reportData?.by_status || reportData?.studentsByStatus || []).map((item, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-ios-xl">
                    <div className="text-2xl font-extrabold text-gray-900">{item.count || item.total || 0}</div>
                    <div className="text-sm text-gray-500">{item.status || item.label || '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có dữ liệu theo trạng thái" />
            )}
          </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="table-container">
          <div className="table-wrap">
            {!reportData?.teachers && !reportData?.data ? (
              <EmptyState icon={GraduationCap} title="Chưa có dữ liệu giảng viên" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Giảng viên</th>
                    <th>Số lớp</th>
                    <th>Số học viên</th>
                    <th>Tỉ lệ hoàn thành</th>
                    <th>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData?.teachers || reportData?.data || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-medium">{item.name || item.teacher_name || '-'}</td>
                      <td className="text-sm">{item.classes || item.class_count || 0}</td>
                      <td className="text-sm">{item.students || item.student_count || 0}</td>
                      <td className="text-sm">{item.completion_rate || item.completionRate || 0}%</td>
                      <td className="text-sm">{item.rating || '-'} / 5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
