import { useState, useEffect, useCallback } from 'react';
import { BookOpen, TrendingUp, Plane, CalendarClock, School, Clock } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/ui/StatCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ courses: 0, progress: 0, flyHours: 0, nextExams: 0 });
  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [enrRes, classesRes, flyRes, examRes] = await Promise.all([
        api.getMyEnrollments(),
        api.getClasses(),
        api.getFlyLogs(),
        api.getExams(),
      ]);

      const myEnrollments = enrRes.data || enrRes.enrollments || [];
      const allClasses = classesRes.data || classesRes.classes || [];
      const myFlyLogs = flyRes.data || flyRes.flyLogs || [];
      const allExams = examRes.data || examRes.exams || [];

      const totalFlyHours = myFlyLogs.reduce((sum, log) => sum + (Number(log.hours || log.flight_hours) || 0), 0);

      const myClassIds = myEnrollments.map(e => String(e.class_id || e.classId));
      const myClasses = allClasses.filter(c => myClassIds.includes(String(c.id)));

      const avgProgress = myEnrollments.length > 0
        ? Math.round(myEnrollments.reduce((sum, e) => sum + (e.progress || e.training_progress || 0), 0) / myEnrollments.length)
        : 0;

      setStats({
        courses: myEnrollments.length,
        progress: avgProgress,
        flyHours: totalFlyHours,
        nextExams: allExams.length,
      });

      setEnrollments(myEnrollments);
      setClasses(myClasses);

      const allSchedule = [];
      myClasses.forEach(c => {
        const sched = c.schedule || [];
        if (Array.isArray(sched)) {
          sched.forEach(s => allSchedule.push({ ...s, className: c.name || c.class_name }));
        }
      });
      setSchedule(allSchedule.slice(0, 5));

      setUpcomingExams(allExams.slice(0, 5));

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
        title="Bảng điều khiển"
        subtitle={`Chào mừng, ${user?.fullName || user?.full_name || user?.name || 'Học viên'}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Khóa học đang học" value={stats.courses} color="smc" />
        <StatCard icon={TrendingUp} label="Tiến độ trung bình" value={`${stats.progress}%`} color="green" />
        <StatCard icon={Plane} label="Giờ bay đã ghi nhận" value={`${stats.flyHours}h`} color="orange" />
        <StatCard icon={CalendarClock} label="Kỳ thi" value={stats.nextExams} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Lịch học</h3>
          </div>
          <div className="table-wrap">
            {schedule.length === 0 ? (
              <EmptyState icon={School} title="Chưa có lịch học" description="Bạn chưa có lịch học nào." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Thứ/Ngày</th>
                    <th>Giờ</th>
                    <th>Lớp</th>
                    <th>Môn</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((s, idx) => (
                    <tr key={idx}>
                      <td className="text-sm">{s.day || s.day_of_week || '-'}</td>
                      <td className="text-sm">{s.time || s.start_time || '-'}</td>
                      <td className="text-sm text-gray-500">{s.className || s.class_name || '-'}</td>
                      <td className="text-sm text-gray-500">{s.subject || s.course_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="table-container">
          <div className="table-header">
            <h3 className="text-base font-bold text-gray-900">Bài kiểm tra sắp tới</h3>
          </div>
          <div className="table-wrap">
            {upcomingExams.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Chưa có bài kiểm tra" description="Bạn chưa có bài kiểm tra nào." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên bài kiểm tra</th>
                    <th>Thời gian</th>
                    <th>Điểm đậu</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingExams.map(exam => (
                    <tr key={exam.id}>
                      <td className="text-sm font-medium text-gray-900">{exam.name || exam.exam_name}</td>
                      <td className="text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {exam.time_limit || exam.timeLimit || 60} phút
                        </span>
                      </td>
                      <td className="text-sm font-medium">
                        {exam.pass_score || exam.passScore || 70}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {enrollments.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">Tổng quan khóa học</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.slice(0, 3).map(enr => (
              <div key={enr.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-smc-600" />
                  </div>
                  <span className="badge badge-info">{enr.progress || enr.training_progress || 0}%</span>
                </div>
                <h4 className="font-bold text-gray-900">{enr.course_name || enr.courseName || enr.course?.name || '-'}</h4>
                <p className="text-sm text-gray-500">{enr.class_name || enr.className || enr.class?.name || '-'}</p>
                <div className="mt-3 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-smc-500 h-2 rounded-full"
                    style={{ width: `${enr.progress || enr.training_progress || 0}%` }}
                  />
                </div>
                {(enr.start_date || enr.end_date) && (
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>{enr.start_date || enr.startDate || '-'}</span>
                    <span>{enr.end_date || enr.endDate || '-'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
