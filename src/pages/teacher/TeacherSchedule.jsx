import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiGetCourses, onDataChange } from '../../data/api';
import { loadData } from '../../data/store';
import {
  Calendar, Clock, MapPin, School, BookOpen, Monitor, Users,
  ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react';

export default function TeacherSchedule() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0);
  const [allClasses, setAllClasses] = useState([]);
  const [courses, setCourses] = useState([]);

  const load = useCallback(() => {
    Promise.all([
      apiGetClasses().catch(() => []),
      apiGetCourses().catch(() => []),
    ]).then(([classesData, coursesData]) => {
      setAllClasses(Array.isArray(classesData) ? classesData : []);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
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

  const getCourseName = (id) => courses.find(c => c.id === id)?.name || '';

  // Build all schedules
  const allSchedules = myClasses.flatMap(c =>
    (c.schedule || []).map(s => ({
      ...s,
      classId: c.id,
      className: c.name,
      courseName: getCourseName(c.course_id),
      studentCount: (c.student_ids || []).length,
      location: s.location || c.location || 'SMC Center',
    }))
  );

  const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  // Get today
  const today = new Date();
  const todayDayName = today.toLocaleDateString('vi-VN', { weekday: 'long' });

  // Tính ngày đầu tuần (dựa trên weekOffset)
  const getMonday = (offset = 0) => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    monday.setDate(monday.getDate() + offset * 7);
    return monday;
  };

  const weekMonday = getMonday(weekOffset);

  // Generate date strings for this week
  const weekDates = DAYS.map((day, i) => {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    return {
      dayName: day,
      date: d,
      dateStr: d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }),
      isToday: d.toDateString() === today.toDateString(),
    };
  });

  const formatWeekRange = () => {
    const start = weekDates[0].date;
    const end = weekDates[6].date;
    return `${start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })} — ${end.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })}`;
  };

  // Group schedule by day name for the current view
  const schedulesByDay = {};
  DAYS.forEach(day => { schedulesByDay[day] = allSchedules.filter(s => s.day === day); });

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Lịch giảng dạy</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {myClasses.length} lớp — {allSchedules.length} buổi dạy/tuần
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Tuần
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Tháng
          </button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="btn-ghost p-2"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-bold text-gray-700">
          {weekOffset === 0 ? 'Tuần này' : weekOffset === -1 ? 'Tuần trước' : weekOffset === 1 ? 'Tuần sau' : formatWeekRange()}
          <span className="text-xs text-gray-400 ml-2">{formatWeekRange()}</span>
        </h3>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="btn-ghost p-2"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Week view */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {DAYS.map((day, i) => {
            const dayScheds = schedulesByDay[day] || [];
            const dateInfo = weekDates[i];
            const isToday = dateInfo.isToday;

            return (
              <div
                key={day}
                className={`card p-4 ${isToday ? 'border-l-4 border-l-blue-500 bg-blue-50/20' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    isToday ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {dateInfo.dateStr}
                  </div>
                  <div>
                    <h3 className={`font-bold ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                      {day}
                    </h3>
                    {isToday && <span className="text-xs text-blue-500 font-semibold">Hôm nay</span>}
                  </div>
                </div>

                {dayScheds.length === 0 ? (
                  <p className="text-sm text-gray-400 pl-12">Không có lịch dạy</p>
                ) : (
                  <div className="space-y-2 pl-12">
                    {dayScheds.map((s, j) => (
                      <div key={j} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-12 rounded-full ${s.type === 'theory' ? 'bg-blue-500' : 'bg-green-500'}`} />
                          <div>
                            <div className="font-semibold text-sm">{s.className}</div>
                            <div className="text-xs text-gray-500">{s.courseName} — {s.studentCount} học viên</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-3.5 h-3.5" /> {s.time}
                          </span>
                          <span className="flex items-center gap-1 text-gray-400 text-xs">
                            <MapPin className="w-3 h-3" /> {s.location}
                          </span>
                          <span className={`badge text-xs ${
                            s.type === 'theory' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {s.type === 'theory' ? <BookOpen className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                            {' '}{s.type === 'theory' ? 'Lý thuyết' : 'Thực hành'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Month view - simplified */}
      {viewMode === 'month' && (
        <div className="card p-6">
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                {day}
              </div>
            ))}
            {/* Generate 4 weeks */}
            {Array.from({ length: 4 }, (_, week) =>
              DAYS.map((day, dayIdx) => {
                const dayScheds = schedulesByDay[day] || [];
                const hasSchedule = dayScheds.length > 0;
                const totalCount = dayScheds.length;

                return (
                  <div
                    key={`${week}-${dayIdx}`}
                    className={`min-h-[60px] p-1.5 rounded-lg border text-xs ${
                      hasSchedule ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="text-gray-400 text-[10px]">
                      {(() => {
                        const d = new Date(weekMonday);
                        d.setDate(d.getDate() + week * 7 + dayIdx);
                        return d.toLocaleDateString('vi-VN', { day: 'numeric' });
                      })()}
                    </div>
                    {hasSchedule && (
                      <div className="mt-0.5 space-y-0.5">
                        {dayScheds.map((s, j) => (
                          <div
                            key={j}
                            className={`px-1 py-0.5 rounded text-[10px] font-medium truncate ${
                              s.type === 'theory' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                            }`}
                            title={`${s.className} — ${s.time}`}
                          >
                            {s.time} {s.className}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4 mt-6 bg-gray-50/50">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Chú thích</h4>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" /> Lý thuyết
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" /> Thực hành
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-200" /> Lịch tháng — LT
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-200" /> Lịch tháng — TH
          </div>
        </div>
      </div>
    </div>
  );
}
