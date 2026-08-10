import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, MapPin, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function TeacherSchedule() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getClasses();
      const allClasses = res.data || res.classes || [];
      const myClasses = allClasses.filter(c => {
        const teacherIds = c.teacher_ids || c.teacherIds || [];
        return teacherIds.includes(user?.id) || teacherIds.includes(String(user?.id));
      });

      const allSchedule = [];
      myClasses.forEach(c => {
        const classSchedule = c.schedule || [];
        if (Array.isArray(classSchedule)) {
          classSchedule.forEach(s => {
            allSchedule.push({
              ...s,
              className: c.name || c.class_name,
              courseName: c.course_name || c.courseName || c.course?.name || '-',
            });
          });
        }
      });

      setSchedule(allSchedule);
    } catch (err) {
      setError(err.message || 'Không thể tải lịch dạy.');
      toast.error('Không thể tải lịch dạy.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const weekDays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const formatDate = (date) => {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const prevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const getSessionsForDay = (dayName) => {
    return schedule.filter(s => {
      const sDay = (s.day || s.day_of_week || '').toLowerCase();
      return sDay === dayName;
    }).sort((a, b) => {
      const timeA = a.time || a.start_time || '';
      const timeB = b.time || b.start_time || '';
      return timeA.localeCompare(timeB);
    });
  };

  const weekLabel = `Tuần từ ${formatDate(weekDates[0])} đến ${formatDate(weekDates[6])} tháng ${weekDates[6].getMonth() + 1}/${weekDates[6].getFullYear()}`;

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
      <PageHeader title="Lịch dạy" subtitle="Lịch giảng dạy theo tuần" />

      {/* Week navigation */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <button onClick={prevWeek} className="btn-ghost btn-sm">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="font-bold text-gray-900">{weekLabel}</p>
            <button onClick={goToCurrentWeek} className="text-xs text-smc-600 hover:underline mt-1">
              Về tuần hiện tại
            </button>
          </div>
          <button onClick={nextWeek} className="btn-ghost btn-sm">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {weekDays.map((dayLabel, idx) => {
          const sessions = getSessionsForDay(dayNames[idx]);
          const date = weekDates[idx];

          return (
            <div
              key={dayLabel}
              className={`card min-h-[200px] ${isToday(date) ? 'ring-2 ring-smc-200' : ''}`}
            >
              <div className={`text-center pb-3 mb-3 border-b ${isToday(date) ? 'border-smc-200' : 'border-gray-100'}`}>
                <p className={`text-sm font-bold ${isToday(date) ? 'text-smc-600' : 'text-gray-700'}`}>
                  {dayLabel}
                </p>
                <p className={`text-xs ${isToday(date) ? 'text-smc-500 font-medium' : 'text-gray-400'}`}>
                  {formatDate(date)}
                </p>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-gray-300">Không có lịch</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s, sIdx) => (
                    <div key={sIdx} className="p-2 bg-smc-50 rounded-ios-lg text-xs">
                      <div className="flex items-center gap-1 text-smc-700 font-medium mb-1">
                        <Clock className="w-3 h-3" />
                        {s.time || s.start_time || '--:--'}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 mb-0.5">
                        <BookOpen className="w-3 h-3" />
                        <span className="truncate">{s.className || s.class_name || '-'}</span>
                      </div>
                      {s.subject && (
                        <div className="text-gray-500 truncate">{s.subject}</div>
                      )}
                      {(s.location || s.room) && (
                        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{s.location || s.room}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
