import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiGetCourses, onDataChange } from '../../data/api';
import { School, Users, Calendar } from 'lucide-react';

export default function TeacherClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);

  const load = useCallback(() => {
    Promise.all([
      apiGetClasses().catch(() => []),
      apiGetCourses().catch(() => []),
    ]).then(([classesData, coursesData]) => {
      const allClasses = Array.isArray(classesData) ? classesData : [];
      const allCourses = Array.isArray(coursesData) ? coursesData : [];
      setClasses(allClasses.filter(c => (c.teacher_ids || []).includes(user?.id)));
      setCourses(allCourses);
    });
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Đồng bộ liên tài khoản
  useEffect(() => {
    const unsub1 = onDataChange('classes', () => load());
    const unsub2 = onDataChange('all', (d) => { if (['classes', 'courses', 'users'].includes(d?.changed)) load(); });
    return () => { unsub1(); unsub2(); };
  }, [load]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Lớp học của tôi</h1><p className="text-sm text-gray-500 mt-0.5">{classes.length} lớp</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        {classes.map(c => (
          <div key={c.id} className="card p-6">
            <div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><School className="w-5 h-5 text-blue-500" /></div><div><h3 className="font-bold">{c.name}</h3><p className="text-xs text-gray-500">{courses.find(co => co.id === c.course_id)?.name || '—'}</p></div></div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />{c.student_ids?.length || 0}/{c.max_students} học viên</div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" />{c.start_date} → {c.end_date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
