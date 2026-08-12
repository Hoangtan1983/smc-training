import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { apiGetExams } from '../../data/api';

export default function StudentExams() {
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
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Kiểm tra</h1><p className="text-sm text-gray-500 mt-1">Làm bài và xem điểm</p></div>
      {exams.length === 0 ? <div className="card p-12 text-center text-gray-400"><Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có bài kiểm tra</p></div> :
        <div className="space-y-4">{exams.map(ex => <div key={ex.id} className="card p-6"><h3 className="font-bold mb-2">{ex.title}</h3><div className="text-sm text-gray-500">{ex.questions?.length || 0} câu • {ex.duration_minutes} phút</div><button className="btn-primary mt-3 text-sm">Vào thi</button></div>)}</div>
      }
    </div>
  );
}
