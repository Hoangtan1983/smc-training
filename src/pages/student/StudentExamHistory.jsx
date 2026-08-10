import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Eye, Trophy } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentExamHistory() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExamResults();
      setResults(res.data || res.results || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải lịch sử thi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (r) => {
    const score = r.score ?? r.total_score;
    if (score == null) return 'badge-neutral';
    const passScore = r.pass_score || r.passScore || 70;
    return score >= passScore ? 'badge-success' : 'badge-danger';
  };

  const getStatusLabel = (r) => {
    const score = r.score ?? r.total_score;
    if (score == null) return 'Đã nộp';
    const passScore = r.pass_score || r.passScore || 70;
    return score >= passScore ? 'Đậu' : 'Trượt';
  };

  const getExamName = (r) => {
    return r.exam_name || r.examName || r.exam?.name || r.exam?.exam_name || '-';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
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
      <PageHeader title="Lịch sử thi" subtitle="Kết quả các bài thi đã làm" />

      {results.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Chưa có lịch sử thi"
          description="Bạn chưa tham gia bài thi nào."
        />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày thi</th>
                  <th>Đề thi</th>
                  <th>Điểm</th>
                  <th>Kết quả</th>
                  <th>Thời gian</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td className="text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(r.date || r.exam_date || r.created_at || r.createdAt)}
                      </span>
                    </td>
                    <td className="text-sm font-medium text-gray-900">
                      {getExamName(r)}
                    </td>
                    <td className="text-sm font-semibold">
                      {r.score ?? r.total_score ?? '-'}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r)}`}>
                        {getStatusLabel(r)}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {r.time_spent || r.timeSpent
                          ? `${Math.round((r.time_spent || r.timeSpent) / 60)} phút`
                          : '-'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/student/ket-qua/${r.id}`)}
                        className="btn-ghost btn-sm text-smc-600 hover:bg-smc-50"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Xem chi tiết
                      </button>
                    </td>
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
