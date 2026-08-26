import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiGetCourses, onDataChange } from '../../data/api';
import { loadData } from '../../data/store';
import {
  BookOpen, Calendar, Clock, Users, School, GraduationCap,
  MapPin, Monitor, ClipboardCheck, ChevronRight, Play,
  PenTool, FileText, CheckCircle, AlertTriangle
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [allClasses, setAllClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      apiGetClasses().catch(() => []),
      apiGetCourses().catch(() => []),
    ]).then(([classesData, coursesData]) => {
      setAllClasses(Array.isArray(classesData) ? classesData : []);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Đồng bộ liên tài khoản
  useEffect(() => {
    const unsub1 = onDataChange('classes', () => load());
    const unsub2 = onDataChange('all', (d) => { if (['classes', 'courses', 'users'].includes(d?.changed)) load(); });
    return () => { unsub1(); unsub2(); };
  }, [load]);

  const myClasses = allClasses.filter(c => (c.teacher_ids || []).includes(user?.id));
  const allUsers = loadData('users', []);
  const tuitions = loadData('tuitions', []);
  const enrollments = loadData('enrollments', []);

  // All students in teacher's classes
  const allStudentIds = [...new Set(myClasses.flatMap(c => c.student_ids || []))];
  const myStudents = allUsers.filter(u => allStudentIds.includes(u.id));

  // Today's schedule
  const todayVN = new Date().toLocaleDateString('vi-VN', { weekday: 'long' });
  const todaySchedule = myClasses.flatMap(c =>
    (c.schedule || [])
      .filter(s => s.day === todayVN)
      .map(s => ({ ...s, className: c.name, classId: c.id, location: s.location || c.location || 'SMC Center' }))
  );

  // Upcoming classes
  const allSchedules = myClasses.flatMap(c =>
    (c.schedule || []).map(s => ({
      ...s, className: c.name, classId: c.id,
      courseName: courses.find(co => co.id === c.course_id)?.name || '',
      studentCount: (c.student_ids || []).length,
    }))
  );

  return (
    <div className="animate-fade-in">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Xin chào, Thầy/Cô {user?.fullName}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Portal Giảng viên SMC Training — {myClasses.length} lớp đang phụ trách
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{myClasses.length}</div>
              <div className="text-xs text-gray-500">Lớp đang dạy</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{myStudents.length}</div>
              <div className="text-xs text-gray-500">Tổng học viên</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-sm font-bold">{todayVN}</div>
              <div className="text-xs text-gray-500">{todaySchedule.length} buổi hôm nay</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-xl font-bold">{allSchedules.length}</div>
              <div className="text-xs text-gray-500">Tổng buổi dạy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b pb-2">
        {[
          { id: 'overview', label: '📋 Hôm nay' },
          { id: 'classes', label: '🏫 Lớp học' },
          { id: 'schedule', label: '📅 Toàn bộ lịch' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-sm px-4 py-2 rounded-t-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white border border-b-white -mb-px font-semibold text-smc-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Today */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {todaySchedule.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Không có lịch dạy hôm nay</p>
              <p className="text-sm mt-1">Hãy kiểm tra lịch dạy đầy đủ</p>
            </div>
          ) : (
            todaySchedule.map((s, i) => (
              <div key={i} className="card p-4 border-l-4 border-l-blue-500">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      s.type === 'theory' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {s.type === 'theory'
                        ? <BookOpen className="w-6 h-6 text-blue-600" />
                        : <Monitor className="w-6 h-6 text-green-600" />
                      }
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{s.className}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                        <Clock className="w-3.5 h-3.5" /> {s.time}
                        <span className="text-gray-300">|</span>
                        <MapPin className="w-3.5 h-3.5" /> {s.location}
                      </div>
                      <span className={`badge text-xs mt-1 ${s.type === 'theory' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {s.type === 'theory' ? 'Lý thuyết' : 'Thực hành'}
                      </span>
                    </div>
                  </div>
                  <Link to={`/teacher/lop-hoc`} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                    Chi tiết <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))
          )}

          {/* Quick actions */}
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            <Link to="/teacher/bai-giang" className="card p-4 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Play className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="font-medium text-sm">Bài giảng</div>
                <div className="text-xs text-gray-500">Quản lý bài giảng</div>
              </div>
            </Link>
            <Link to="/teacher/kiem-tra" className="card p-4 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="font-medium text-sm">Bài kiểm tra</div>
                <div className="text-xs text-gray-500">Tạo & chấm bài</div>
              </div>
            </Link>
            <Link to="/teacher/nhat-ky-bay" className="card p-4 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-teal-500" />
              </div>
              <div>
                <div className="font-medium text-sm">Nhật ký bay</div>
                <div className="text-xs text-gray-500">Ghi nhận giờ bay</div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Tab: Classes */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {myClasses.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <School className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa được phân công lớp nào</p>
              <p className="text-sm mt-1">Vui lòng liên hệ Quản lý Đào tạo</p>
            </div>
          ) : (
            myClasses.map(cls => {
              const course = courses.find(c => c.id === cls.course_id);
              const studentCount = (cls.student_ids || []).length;
              const classStudents = allUsers.filter(u => (cls.student_ids || []).includes(u.id));
              const scheduleCount = (cls.schedule || []).length;

              return (
                <div key={cls.id} className="card p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <School className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{cls.name}</h3>
                          <p className="text-sm text-gray-500">{course?.name || '—'}</p>
                        </div>
                        <div className="flex gap-1">
                          <span className={`badge text-xs ${studentCount >= (cls.max_students || 20) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {studentCount}/{cls.max_students || 20} HV
                          </span>
                          <span className="badge text-xs bg-blue-100 text-blue-700 capitalize">{cls.type || 'offline'}</span>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-500 mt-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {cls.start_date || '—'} → {cls.end_date || '—'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {scheduleCount} buổi/tuần
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {cls.location || 'SMC Center'}
                        </div>
                      </div>

                      {/* Schedule preview */}
                      {cls.schedule && cls.schedule.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cls.schedule.map((s, i) => (
                            <span key={i} className={`badge text-xs ${
                              s.type === 'theory' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {s.day} {s.time}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Student list */}
                      {classStudents.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {classStudents.slice(0, 10).map(s => (
                            <span key={s.id} className="badge bg-gray-100 text-gray-600 text-xs">
                              {s.fullName}
                            </span>
                          ))}
                          {classStudents.length > 10 && (
                            <span className="badge bg-gray-100 text-gray-400 text-xs">
                              +{classStudents.length - 10} HV
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link to="/teacher/hoc-vien" className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3" /> DS Học viên
                      </Link>
                      <Link to="/teacher/lich-day" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Lịch dạy
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Full Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {allSchedules.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa có lịch dạy</p>
            </div>
          ) : (
            <>
              {/* Group by day */}
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map(day => {
                const dayScheds = allSchedules.filter(s => s.day === day);
                if (dayScheds.length === 0) return null;
                const isToday = day === todayVN;

                return (
                  <div key={day} className={`card p-4 ${isToday ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-bold text-sm ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                        {day}
                      </h3>
                      {isToday && <span className="badge bg-blue-100 text-blue-700 text-xs">Hôm nay</span>}
                    </div>
                    <div className="space-y-2">
                      {dayScheds.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-10 rounded-full ${s.type === 'theory' ? 'bg-blue-500' : 'bg-green-500'}`} />
                            <div>
                              <div className="font-medium text-sm">{s.className}</div>
                              <div className="text-xs text-gray-500">{s.courseName} ({s.studentCount} HV)</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="flex items-center gap-1 text-gray-600">
                              <Clock className="w-3.5 h-3.5" /> {s.time}
                            </span>
                            <span className="flex items-center gap-1 text-gray-400 text-xs">
                              <MapPin className="w-3 h-3" /> {s.location}
                            </span>
                            <span className={`badge text-xs ${s.type === 'theory' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {s.type === 'theory' ? 'LT' : 'TH'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
