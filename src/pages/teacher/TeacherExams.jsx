import { useState, useEffect } from 'react';
import { apiGetExams } from '../../data/api';
import { PenTool } from 'lucide-react';

export default function TeacherExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExams = async () => {
      try {
        const data = await apiGetExams();
        const list = Array.isArray(data) ? data : (data.exams || data.data || []);
        setExams(list);
      } catch { setExams([]); }
      setLoading(false);
    };
    loadExams();
  }, []);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-extrabold text-gray-900">Bài kiểm tra</h1><p className="text-sm text-gray-500 mt-0.5">{exams.length} bài kiểm tra</p></div><button className="btn-primary">Tạo bài kiểm tra</button></div>
      <div className="space-y-4">
        {exams.map(ex => (
          <div key={ex.id} className="card p-6">
            <div className="flex items-start gap-3 mb-3"><div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><PenTool className="w-5 h-5 text-purple-500" /></div><div><h3 className="font-bold">{ex.title}</h3><p className="text-xs text-gray-500">{ex.questions?.length || 0} câu • {ex.duration_minutes} phút • Đỗ: {ex.pass_score}%</p></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
