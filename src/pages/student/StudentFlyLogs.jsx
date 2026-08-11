import { useState, useEffect, useCallback } from 'react';
import { Plane, Clock } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentFlyLogs() {
  const [flyLogs, setFlyLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFlyLogs();
      // API có thể trả về array trực tiếp hoặc wrapped trong data/flyLogs
      const data = Array.isArray(res) ? res : (res.data || res.flyLogs || []);
      setFlyLogs(data);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải nhật ký bay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tính giờ bay: dữ liệu lưu duration_minutes, đổi sang giờ
  const totalMinutes = flyLogs.reduce((sum, log) => sum + (Number(log.duration_minutes || log.hours || log.flight_hours) || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const typeLabel = {
    training: 'Huấn luyện',
    solo: 'Bay đơn',
    exam: 'Thi',
  };

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
      <PageHeader
        title="Nhật ký bay"
        subtitle="Lịch sử giờ bay của bạn"
      />

      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-ios-xl bg-smc-100 flex items-center justify-center">
            <Plane className="w-7 h-7 text-smc-600" />
          </div>
          <div>
            <p className="text-gray-500 text-sm">Tổng giờ bay đã ghi nhận</p>
            <p className="text-3xl font-bold text-gray-900">{totalHours} <span className="text-lg font-normal text-gray-500">giờ</span></p>
          </div>
        </div>
      </div>

      {flyLogs.length === 0 ? (
        <EmptyState icon={Plane} title="Chưa có nhật ký bay" description="Bạn chưa có giờ bay nào được ghi nhận." />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Số giờ</th>
                  <th>Loại bay</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {flyLogs.map(log => (
                  <tr key={log.id}>
                    <td className="text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {log.date || log.log_date || '-'}
                      </span>
                    </td>
                    <td className="text-sm font-semibold">
                      {((Number(log.duration_minutes || log.hours || log.flight_hours) || 0) / 60).toFixed(1)} giờ
                    </td>
                    <td>
                      <span className={`badge ${log.type === 'exam' ? 'badge-warning' : log.type === 'solo' ? 'badge-success' : 'badge-info'}`}>
                        {typeLabel[log.type || log.flight_type] || log.type || log.flight_type || '-'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500 max-w-[200px] truncate">{log.note || log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
