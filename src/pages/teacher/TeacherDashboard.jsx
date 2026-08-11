import { useState, useEffect, useCallback } from 'react';
import { Users, BookOpen, ClipboardList, Plane, School } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ classes: 0, students: 0, pendingGrading: 0, flyHours: 0 });
  const [classes, setClasses] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);

  const roleLabels = {
    ADMIN: 'Quản trị viên',
    STAFF: 'Nhân viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học viên',
    AGENCY: 'Đại lý',
    ACCOUNTANT: 'Kế toán',
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, studentsRes, examResultsRes] = await Promise.all([
        api.getClasses(),
        api.getUsers({ role: 'STUDENT' }),
        api.getExamResults(),
      ]);

      const allClasses = classesRes.data || classesRes.classes || [];
      const allStudents = studentsRes.data || studentsRes.users || [];
      const allResults = examResultsRes.data || examResultsRes.results || [];

      const myClasses = allClasses.filter(c => {
        const teacherIds = c.teacher_ids || c.teacherIds || [];
        return teacherIds.includes(user?.id) || teacherIds.includes(String(user?.id));
      });

      const myStudentIds = new Set();
      myClasses.forEach(c => {
        const studentIds = c.student_ids || c.studentIds || [];
        studentIds.forEach(id => myStudentIds.add(String(id)));
      });

      const totalFlyHours = 0;

      const ungraded = allResults.filter(r => r.score == null && r.total_score == null);

      setStats({
        classes: myClasses.length,
        students: myStudentIds.size,
        pendingGrading: ungraded.length,
        flyHours: totalFlyHours,
      });

      setClasses(myClasses);

      const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long' });
      const scheduleToday = [];
      myClasses.forEach(c => {
        const schedule = c.schedule || [];
        if (Array.isArray(schedule)) {
          schedule.forEach(s => {
            if (s.day === today || s.day_of_week === today) {
              scheduleToday.push({ ...s, className: c.name || c.class_name, classId: c.id });
            }
          });
        }
      });
      setTodaySchedule(scheduleToday);
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

  const statusBadge = (status) => {
    const map = {
      ACTIVE: 'badge-success', active: 'badge-success',
      PENDING: 'badge-warning', pending: 'badge-warning',
      INACTIVE: 'badge-neutral', inactive: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  const statusLabel = {
    ACTIVE: 'Hoạt động', active: 'Hoạt động',
    PENDING: 'Chờ khai giảng', pending: 'Chờ khai giảng',
    INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Bảng điều khiển"
        subtitle={`Chào mừng, ${user?.fullName || user?.full_name || user?.name || roleLabels[user?.role] || ''}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={School} label="Lớp đang dạy" value={stats.classes} color="smc" />
        <StatCard icon={Users} label="Học viên" value={stats.students} color="green" />
        <StatCard icon={ClipboardList} label="Bài cần chấm" value={stats.pendingGrading} color="orange" />
        <StatCard icon={Plane} label="Giờ bay đã ghi nhận" value={stats.flyHours} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Lớp học của tôi</h3>
            <span className="badge badge-info">{classes.length} lớp</span>
          </div>
          <div className="table-wrap">
            {classes.length === 0 ? (
              <EmptyState icon={School} title="Chưa có lớp học nào" description="Bạn chưa được phân công lớp học nào." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên lớp</th>
                    <th>Khóa học</th>
                    <th>Sĩ số</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(cls => (
                    <tr key={cls.id}>
                      <td>
                        <p className="font-medium text-gray-900">{cls.name || cls.class_name}</p>
                      </td>
                      <td className="text-sm text-gray-500">
                        {cls.course_name || cls.courseName || cls.course?.name || '-'}
                      </td>
                      <td className="text-sm">
                        {(cls.student_ids || cls.studentIds || []).length || cls.current_students || cls.currentStudents || 0}
                      </td>
                      <td>
                        <span className={`badge ${statusBadge(cls.status)}`}>
                          {statusLabel[cls.status] || cls.status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Lịch dạy hôm nay</h3>
          </div>
          <div className="table-wrap">
            {todaySchedule.length === 0 ? (
              <EmptyState icon={BookOpen} title="Không có lịch dạy hôm nay" description="Hôm nay bạn không có buổi dạy nào." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Giờ</th>
                    <th>Lớp</th>
                    <th>Môn</th>
                    <th>Địa điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySchedule.map((s, idx) => (
                    <tr key={idx}>
                      <td className="text-sm font-medium">{s.time || s.start_time || '-'}</td>
                      <td className="text-sm text-gray-900">{s.className || s.class_name || '-'}</td>
                      <td className="text-sm text-gray-500">{s.subject || s.course_name || '-'}</td>
                      <td className="text-sm text-gray-500">{s.location || s.room || '-'}</td>
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
