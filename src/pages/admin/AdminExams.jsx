import { useState, useEffect } from 'react';
import { Award, Users, FileText } from 'lucide-react';
import { apiGetExams, apiGetCourses } from '../../data/api';

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [examData, courseData] = await Promise.all([
          apiGetExams().catch(() => []),
          apiGetCourses().catch(() => []),
        ]);
        setExams(Array.isArray(examData) ? examData : (examData.exams || examData.data || []));
        setCourses(Array.isArray(courseData) ? courseData : (courseData.data || []));
      } catch {}
      setLoading(false);
    };
    loadAll();
  }, []);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Quản lý sát hạch</h1><p className="text-sm text-gray-500 mt-0.5">Tổ chức thi, hội đồng sát hạch</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        {exams.map(ex => (
          <div key={ex.id} className="card p-6">
            <div className="flex items-start gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><Award className="w-5 h-5 text-purple-500" /></div><div><h3 className="font-bold text-gray-900">{ex.title}</h3><p className="text-xs text-gray-500">{courses.find(c => c.id === ex.course_id)?.name || '—'} • {ex.duration_minutes} phút • Đỗ: {ex.pass_score}%</p></div></div>
            <div className="flex gap-4 text-sm text-gray-500 mb-4"><span>{ex.questions?.length || 0} câu hỏi</span><span>{ex.results?.length || 0} học viên đã thi</span></div>
            <div className="flex justify-between items-center"><span className="badge bg-blue-50 text-blue-700">{ex.results?.filter(r => r.passed)?.length || 0} đạt</span><span className="text-xs text-gray-400">ID: {ex.id}</span></div>
          </div>
        ))}
        {exams.length === 0 && <div className="md:col-span-2 text-center py-12 text-gray-400"><Award className="w-8 h-8 mx-auto mb-2 opacity-50" />Chưa có bài kiểm tra nào</div>}
      </div>
    </div>
  );
}
