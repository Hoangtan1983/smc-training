import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, CheckCircle, Eye, MessageSquare } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function TeacherExamGrading() {
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [gradingModalOpen, setGradingModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExamResults();
      const all = res.data || res.results || [];
      setExamResults(all);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách bài thi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openGradingModal = (result) => {
    setSelectedResult(result);
    const answers = result.answers || result.student_answers || [];
    const initialScores = {};
    answers.forEach((a, idx) => {
      initialScores[idx] = a.score ?? a.point ?? 0;
    });
    setScores(initialScores);
    setComment(result.comment || result.feedback || result.note || '');
    setGradingModalOpen(true);
  };

  const handleScoreChange = (index, value) => {
    setScores(prev => ({ ...prev, [index]: Number(value) }));
  };

  const totalScore = Object.values(scores).reduce((sum, s) => sum + (s || 0), 0);
  const maxScore = selectedResult
    ? (selectedResult.answers || selectedResult.student_answers || []).reduce((sum, a) => sum + (a.max_score || a.maxScore || a.point || 1), 0)
    : 0;

  const handleSubmitGrading = async () => {
    if (!selectedResult) return;
    setSaving(true);
    try {
      const answers = (selectedResult.answers || selectedResult.student_answers || []).map((a, idx) => ({
        ...a,
        score: scores[idx] || 0,
      }));
      await api.submitExam({
        result_id: selectedResult.id,
        scores,
        total_score: totalScore,
        comment,
        answers,
      });
      toast.success('Chấm bài thành công.');
      setGradingModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi chấm bài.');
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (r) => {
    return r.student_name || r.studentName || r.student?.fullName || r.student?.full_name || r.student?.name || '-';
  };

  const getExamName = (r) => {
    return r.exam_name || r.examName || r.exam?.name || r.exam?.exam_name || '-';
  };

  const getResultDate = (r) => {
    return r.submitted_at || r.submittedAt || r.date || r.exam_date || r.created_at || r.createdAt || '-';
  };

  const isGraded = (r) => {
    return r.score != null || r.total_score != null;
  };

  const getStatusBadge = (r) => {
    if (isGraded(r)) return 'badge-success';
    if (r.submitted_at || r.submittedAt) return 'badge-warning';
    return 'badge-neutral';
  };

  const getStatusLabel = (r) => {
    if (isGraded(r)) return 'Đã chấm';
    if (r.submitted_at || r.submittedAt) return 'Chờ chấm';
    return 'Chưa nộp';
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
      <PageHeader title="Chấm thi" subtitle="Chấm điểm bài thi của học viên" />

      {examResults.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Chưa có bài thi nào" description="Chưa có học viên nào nộp bài thi." />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Bài thi</th>
                  <th>Ngày nộp</th>
                  <th>Điểm</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {examResults.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="font-medium text-gray-900 text-sm">{getStudentName(r)}</span>
                    </td>
                    <td className="text-sm text-gray-500">{getExamName(r)}</td>
                    <td className="text-sm text-gray-500">{getResultDate(r)}</td>
                    <td className="text-sm font-semibold">
                      {isGraded(r) ? (r.score ?? r.total_score) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r)}`}>
                        {getStatusLabel(r)}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openGradingModal(r)}
                        className="btn-ghost btn-sm text-smc-600 hover:bg-smc-50"
                      >
                        {isGraded(r) ? (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Xem
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Chấm bài
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grading Modal */}
      <Modal
        open={gradingModalOpen}
        onClose={() => setGradingModalOpen(false)}
        title={`Chấm bài - ${getStudentName(selectedResult)}`}
        size="xl"
      >
        {selectedResult && (
          <div className="space-y-6">
            <div className="text-sm text-gray-500">
              <strong>Bài thi:</strong> {getExamName(selectedResult)}
              <span className="mx-2">|</span>
              <strong>Ngày nộp:</strong> {getResultDate(selectedResult)}
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {(selectedResult.answers || selectedResult.student_answers || []).map((answer, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-ios-xl">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Câu {idx + 1}: {answer.question || answer.question_text || answer.content || 'N/A'}
                      </p>
                      {answer.options && Array.isArray(answer.options) && (
                        <div className="space-y-1 mt-2">
                          {answer.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`text-sm px-3 py-1.5 rounded-ios-lg ${
                                answer.correct_answer === opt || answer.correctAnswer === opt
                                  ? 'bg-green-100 text-green-700'
                                  : answer.student_answer === opt || answer.studentAnswer === opt
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-white'
                              }`}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {!answer.options && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs">
                            <span className="text-green-600 font-medium">Đáp án đúng:</span>{' '}
                            {answer.correct_answer || answer.correctAnswer || '-'}
                          </p>
                          <p className="text-xs">
                            <span className="text-red-600 font-medium">Học viên trả lời:</span>{' '}
                            {answer.student_answer || answer.studentAnswer || '-'}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <label className="text-xs text-gray-500 mb-1 block">Điểm</label>
                      <input
                        type="number"
                        min="0"
                        max={answer.max_score || answer.maxScore || 10}
                        value={scores[idx] || 0}
                        onChange={e => handleScoreChange(idx, e.target.value)}
                        className="input-field w-20 text-center"
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">
                        / {answer.max_score || answer.maxScore || 1}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-smc-50 rounded-ios-xl">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-smc-500" />
                <span className="text-sm font-medium text-smc-700">Tổng điểm: {totalScore} / {maxScore}</span>
              </div>
              <span className="badge badge-info">
                {maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0}%
              </span>
            </div>

            <div>
              <label className="input-label">Nhận xét</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Nhập nhận xét cho học viên..."
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setGradingModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
              <button onClick={handleSubmitGrading} disabled={saving} className="btn-primary flex-1">
                {saving ? <span className="spinner spinner-sm" /> : 'Lưu điểm'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
