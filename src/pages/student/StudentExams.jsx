import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, Target, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsRes, resultsRes] = await Promise.all([
        api.getExams(),
        api.getExamResults(),
      ]);
      setExams(examsRes.data || examsRes.exams || []);
      setExamResults(resultsRes.data || resultsRes.results || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách bài kiểm tra.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getResultForExam = (examId) => {
    return examResults.find(r =>
      String(r.exam_id || r.examId) === String(examId)
    );
  };

  const getStatusBadge = (result) => {
    if (!result) return 'badge-neutral';
    if (result.score != null || result.total_score != null) return 'badge-success';
    if (result.submitted_at || result.submittedAt) return 'badge-warning';
    return 'badge-neutral';
  };

  const getStatusLabel = (result) => {
    if (!result) return 'Chưa làm';
    if (result.score != null || result.total_score != null) return 'Đã chấm';
    if (result.submitted_at || result.submittedAt) return 'Đã nộp';
    return 'Chưa làm';
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
      <PageHeader title="Kiểm tra" subtitle="Danh sách bài kiểm tra" />

      {exams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Chưa có bài kiểm tra nào" description="Không có bài kiểm tra nào được giao." />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên bài kiểm tra</th>
                  <th>Môn</th>
                  <th>Thời gian</th>
                  <th>Điểm</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => {
                  const result = getResultForExam(exam.id);
                  return (
                    <tr key={exam.id}>
                      <td>
                        <span className="font-medium text-gray-900 text-sm">{exam.name || exam.exam_name}</span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {exam.course_name || exam.courseName || exam.course?.name || '-'}
                      </td>
                      <td className="text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {exam.time_limit || exam.timeLimit || 60} phút
                        </span>
                      </td>
                      <td className="text-sm font-semibold">
                        {result?.score ?? result?.total_score ?? '-'}
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(result)}`}>
                          {getStatusLabel(result)}
                        </span>
                      </td>
                      <td>
                        {result ? (
                          <button
                            onClick={() => navigate(`/student/ket-qua/${result.id}`)}
                            className="btn-ghost btn-sm text-smc-600 hover:bg-smc-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Xem kết quả
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/student/luyen-thi/${exam.id}`)}
                            className="btn-primary btn-sm"
                          >
                            <Target className="w-4 h-4 mr-1" />
                            Làm bài
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
