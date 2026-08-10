import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, DollarSign, UserPlus } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
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

export default function AgencyDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    commissionThisMonth: 0,
    totalCommission: 0,
    newStudentsThisMonth: 0,
  });
  const [recentStudents, setRecentStudents] = useState([]);
  const [monthlyCommissions, setMonthlyCommissions] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agenciesRes, reportsRes] = await Promise.all([
        api.getAgencies(),
        api.getReports('agency'),
      ]);

      const agencies = agenciesRes.data || agenciesRes.agencies || [];
      const currentAgency = user
        ? agencies.find(
            (a) =>
              a.id === user.id ||
              a.user_id === user.id ||
              a.email === user.email ||
              a.name === user.fullName
          ) || agencies[0]
        : agencies[0];

      const reportData = reportsRes.data || reportsRes || {};

      setStats({
        totalStudents: currentAgency?.student_count || currentAgency?.students?.length || reportData?.total_students || 0,
        commissionThisMonth: reportData?.commission_this_month || reportData?.commissionThisMonth || 0,
        totalCommission: reportData?.total_commission || reportData?.totalCommission || currentAgency?.total_commission || 0,
        newStudentsThisMonth: reportData?.new_students_this_month || reportData?.newStudentsThisMonth || 0,
      });

      const students = currentAgency?.students || reportData?.recent_students || [];
      setRecentStudents(students.slice(0, 5));

      const commissions = reportData?.monthly_commissions || reportData?.monthlyCommissions || [];
      setMonthlyCommissions(commissions);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusBadgeMap = {
    STUDYING: 'badge-info', studying: 'badge-info',
    COMPLETED: 'badge-success', completed: 'badge-success',
    DROPPED: 'badge-danger', dropped: 'badge-danger',
    ACTIVE: 'badge-success', active: 'badge-success',
    PENDING: 'badge-warning', pending: 'badge-warning',
    INACTIVE: 'badge-danger', inactive: 'badge-danger',
  };

  const statusLabels = {
    STUDYING: 'Đang học', studying: 'Đang học',
    COMPLETED: 'Hoàn thành', completed: 'Hoàn thành',
    DROPPED: 'Bỏ học', dropped: 'Bỏ học',
    ACTIVE: 'Hoạt động', active: 'Hoạt động',
    PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
    INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
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
      <PageHeader title="Bảng điều khiển" subtitle={`Xin chào, ${user?.fullName || user?.name || 'Đại lý'}`} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Học viên đã giới thiệu" value={stats.totalStudents} color="smc" />
        <StatCard icon={DollarSign} label="Hoa hồng tháng này" value={formatVND(stats.commissionThisMonth)} color="green" />
        <StatCard icon={TrendingUp} label="Hoa hồng lũy kế" value={formatVND(stats.totalCommission)} color="orange" />
        <StatCard icon={UserPlus} label="Học viên mới tháng này" value={stats.newStudentsThisMonth} color="purple" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent students */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Học viên mới nhất</h3>
          </div>
          <div className="table-wrap">
            {recentStudents.length === 0 ? (
              <EmptyState icon={Users} title="Chưa có học viên nào" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Khóa học</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                            {(student.fullName || student.full_name || student.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {student.fullName || student.full_name || student.name}
                            </p>
                            <p className="text-xs text-gray-400">{student.email || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-gray-500">
                        {student.course_name || student.courseName || student.course?.name || '-'}
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeMap[student.status] || 'badge-neutral'}`}>
                          {statusLabels[student.status] || student.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Monthly commissions */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Hoa hồng theo tháng</h3>
          </div>
          <div className="table-wrap">
            {monthlyCommissions.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Chưa có dữ liệu hoa hồng" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Số học viên</th>
                    <th>Hoa hồng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyCommissions.map((item, idx) => {
                    const settled = item.status === 'settled' || item.status === 'SETTLED' || item.settled || item.is_settled;
                    return (
                      <tr key={idx}>
                        <td className="font-medium text-gray-900">{item.month || item.label || `T${idx + 1}`}</td>
                        <td className="text-sm text-gray-500">{item.student_count || item.count || 0}</td>
                        <td className="font-semibold text-green-600">
                          {formatVND(item.commission || item.amount || item.total || 0)}
                        </td>
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
    </div>
  );
}
