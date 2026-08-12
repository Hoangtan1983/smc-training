import { useState, useEffect } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiGetFlyLogs } from '../../data/api';

export default function StudentFlyLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await apiGetFlyLogs();
        const all = Array.isArray(data) ? data : [];
        setLogs(all.filter(l => l.student_id === user?.id));
      } catch { setLogs([]); }
      setLoading(false);
    };
    loadLogs();
  }, [user]);

  const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Nhật ký bay</h1><p className="text-sm text-gray-500 mt-1">Tổng: {totalHours} giờ bay</p></div>
      {logs.length === 0 ? <div className="card p-12 text-center text-gray-400"><ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có nhật ký bay</p></div> : <div className="space-y-3">{logs.map(l => <div key={l.id} className="card p-4"><div className="font-semibold">{l.date}</div><div className="text-xs text-gray-500">{l.hours}h • {l.uav_model} • Đánh giá: {l.performance}/10</div></div>)}</div>}
    </div>
  );
}
