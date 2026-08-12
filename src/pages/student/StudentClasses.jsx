import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiGetCourses, apiGetEnrollments } from '../../data/api';
import { School, Users, Calendar, MapPin, Clock } from 'lucide-react';

export default function StudentClasses() {
  const { user } = useAuth();
  const [myClass, setMyClass] = useState(null);
  const [course, setCourse] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getAllUsers } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      try {
        const [allClasses, coursesData, enrollmentsData] = await Promise.all([
          apiGetClasses().catch(() => []),
          apiGetCourses().catch(() => []),
          apiGetEnrollments().catch(() => []),
        ]);
        const classes = Array.isArray(allClasses) ? allClasses : [];
        const courses = Array.isArray(coursesData) ? coursesData : [];
        const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

        // Tìm enrollment của học viên này
        const myEnr = enrollments.find(e => e.student_id === user.id);
        const classId = myEnr?.class_id || '';

        // Tìm lớp: ưu tiên enrollment.class_id > student_ids trong class
        let foundClass = null;
        if (classId) {
          foundClass = classes.find(c => c.id === classId);
        }
        if (!foundClass) {
          foundClass = classes.find(c => (c.student_ids || []).includes(user.id)) || null;
        }
        setMyClass(foundClass || null);

        if (foundClass) {
          const foundCourse = courses.find(c => c.id === foundClass.course_id);
          setCourse(foundCourse || null);
        }

        // Load teachers
        getAllUsers().then(data => {
          const allTeachers = data.filter(u => u.role === 'TEACHER');
          if (foundClass) {
            setTeachers(allTeachers.filter(t => (foundClass.teacher_ids || []).includes(t.id)));
          }
        });
      } catch (e) {
        console.error('Lỗi tải lớp học:', e);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  if (!myClass) return <div className="p-8"><div className="card p-12 text-center text-gray-400"><School className="w-16 h-16 mx-auto mb-4 opacity-20" /><h2 className="text-lg font-semibold mb-2">Bạn chưa được xếp lớp</h2><p className="text-sm">Vui lòng liên hệ trung tâm để được xếp lớp học.</p></div></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Lớp học của tôi</h1></div>
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{myClass.name}</h2>
          <span className="badge bg-green-100 text-green-700 text-sm px-3 py-1">Hạng {myClass.rank || 'A'}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2"><School className="w-4 h-4 text-gray-400" />Khóa: <span className="font-medium">{course?.name || '—'}</span></div>
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />GV: <span className="font-medium">{teachers.length > 0 ? teachers.map(t => t.fullName).join(', ') : 'Chưa phân công'}</span></div>
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{myClass.start_date ? new Date(myClass.start_date).toLocaleDateString('vi-VN') : '—'} → {myClass.end_date ? new Date(myClass.end_date).toLocaleDateString('vi-VN') : '—'}</div>
          <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />Sĩ số: <span className="font-medium">{(myClass.student_ids || []).length}/{myClass.max_students || 20}</span></div>
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />Hình thức: <span className="font-medium">{myClass.type === 'online' ? 'Online' : myClass.type === 'hybrid' ? 'Hybrid' : 'Offline'}</span></div>
          {myClass.location && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />Địa điểm: <span className="font-medium">{myClass.location}</span></div>}
        </div>
      </div>
      {myClass.schedule && myClass.schedule.length > 0 && (
        <div className="card p-6"><h3 className="font-bold mb-4">Lịch học</h3>
          {myClass.schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b last:border-b-0 text-sm">
              <div className="font-medium w-20">{s.day}</div>
              <div className="text-gray-600">{s.time}</div>
              <div className="text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</div>
              <span className="badge bg-blue-50 text-blue-700 text-xs">{s.type === 'theory' ? 'Lý thuyết' : 'Thực hành'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
