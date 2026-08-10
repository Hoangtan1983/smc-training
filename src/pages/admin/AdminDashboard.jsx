import { useState, useEffect } from 'react';
import { Users, BookOpen, School, GraduationCap, ArrowRight } from 'lucide-react';
import * as api from '../../data/api';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ users: 0, courses: 0, classes: 0, students: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [activeClasses, setActiveClasses] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, coursesRes, classesRes] = await Promise.all([
        api.getUsers(),
        api.getCourses(),
        api.getClasses(),
      ]);

      const users = usersRes.data || usersRes.users || [];
      const courses = coursesRes.data || coursesRes.courses || [];
      const classes = classesRes.data || classesRes.classes || [];

      const students = users.filter(u => u.role === 'STUDENT');

      setStats({
        users: users.length,
        courses: courses.length,
        classes: classes.length,
        students: students.length,
      });

      setRecentUsers(users.slice(-5).reverse());
      setActiveClasses(
        classes
          .filter(c => c.status === 'ACTIVE' || c.status === 'active')
          .slice(-5)
          .reverse()
      );
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu bảng điều khiển.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
          <button onClick={fetchData} className="btn-primary mt-4">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const roleBadge = (role) => {
    const map = {
      ADMIN: 'bg-purple-100 text-purple-700',
      STAFF: 'bg-blue-100 text-blue-700',
      TEACHER: 'bg-teal-100 text-teal-700',
      STUDENT: 'bg-green-100 text-green-700',
      AGENCY: 'bg-orange-100 text-orange-700',
      ACCOUNTANT: 'bg-pink-100 text-pink-700',
    };
    return map[role] || 'bg-gray-100 text-gray-600';
  };

  const statusBadge = (status) => {
    const map = {
      ACTIVE: 'badge-success',
      active: 'badge-success',
      PENDING: 'badge-warning',
      pending: 'badge-warning',
      FROZEN: 'badge-neutral',
      frozen: 'badge-neutral',
      INACTIVE: 'badge-danger',
      inactive: 'badge-danger',
    };
    return map[status] || 'badge-neutral';
  };

  const statusLabel = {
    ACTIVE: 'Hoạt động', active: 'Hoạt động',
    PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
    FROZEN: 'Đóng băng', frozen: 'Đóng băng',
    INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
  };

  return (
    <div className="page-container">
      <PageHeader title="Bảng điều khiển" subtitle="Tổng quan hệ thống SMC Training" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Tổng người dùng" value={stats.users} color="smc" />
        <StatCard icon={BookOpen} label="Tổng khóa học" value={stats.courses} color="green" />
        <StatCard icon={School} label="Tổng lớp học" value={stats.classes} color="orange" />
        <StatCard icon={GraduationCap} label="Tổng học viên" value={stats.students} color="purple" />
      </div>

      {/* Two-column tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Người dùng mới nhất</h3>
          </div>
          <div className="table-wrap">
            {recentUsers.length === 0 ? (
              <EmptyState icon={Users} title="Chưa có người dùng nào" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-smc-100 flex items-center justify-center text-sm font-bold text-smc-600">
                            {(user.fullName || user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.fullName || user.full_name || user.name}</p>
                            <p className="text-xs text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${roleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadge(user.status)}`}>
                          {statusLabel[user.status] || user.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Active classes */}
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Lớp học đang hoạt động</h3>
          </div>
          <div className="table-wrap">
            {activeClasses.length === 0 ? (
              <EmptyState icon={School} title="Chưa có lớp học nào đang hoạt động" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên lớp</th>
                    <th>Sĩ số</th>
                    <th>Bắt đầu</th>
                  </tr>
                </thead>
                <tbody>
                  {activeClasses.map(cls => (
                    <tr key={cls.id}>
                      <td>
                        <p className="font-medium text-gray-900">{cls.name || cls.class_name}</p>
                        <p className="text-xs text-gray-400">{cls.course_name || cls.courseName || cls.course?.name || '-'}</p>
                      </td>
                      <td>
                        <span className="text-sm">
                          {cls.current_students || cls.currentStudents || 0} / {cls.max_students || cls.maxStudents || 0}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {cls.start_date || cls.startDate || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
