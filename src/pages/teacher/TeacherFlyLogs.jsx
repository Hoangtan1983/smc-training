import { useState, useEffect } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { apiGetFlyLogs } from '../../data/api';

export default function TeacherFlyLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await apiGetFlyLogs();
        setLogs(Array.isArray(data) ? data : []);
      } catch { setLogs([]); }
      setLoading(false);
    };
    loadLogs();
  }, []);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-extrabold text-gray-900">Nhật ký bay</h1><p className="text-sm text-gray-500 mt-0.5">{logs.length} bản ghi</p></div><button className="btn-primary">Ghi nhật ký bay</button></div>
      {logs.length === 0 ? <div className="card p-12 text-center text-gray-400"><ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có nhật ký bay</p></div> : <div className="space-y-3">{logs.map(l => <div key={l.id} className="card p-4"><div className="font-semibold">{l.student_id}</div><div className="text-xs text-gray-500">{l.date} • {l.hours}h • {l.uav_model}</div></div>)}</div>}
    </div>
  );
}
