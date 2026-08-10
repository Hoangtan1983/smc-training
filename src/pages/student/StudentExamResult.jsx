import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, RotateCcw, ArrowLeft, Trophy } from 'lucide-react';
import * as api from '../../data/api';
import toast from 'react-hot-toast';

export default function StudentExamResult() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchResult = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExamResults();
      const allResults = res.data || res.results || [];
      const found = allResults.find(r => String(r.id) === String(resultId));
      if (!found) {
        setError('Không tìm thấy kết quả thi.');
        toast.error('Không tìm thấy kết quả thi.');
        return;
      }
      setResult(found);
    } catch (err) {
      setError(err.message || 'Không thể tải kết quả.');
      toast.error('Không thể tải kết quả thi.');
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error || 'Không tìm thấy kết quả.'}</p>
          <button onClick={() => navigate('/student/luyen-thi')} className="btn-primary mt-4">Quay lại</button>
        </div>
      </div>
    );
  }

  const totalScore = result.score ?? result.total_score ?? 0;
  const passScore = result.pass_score || result.passScore || 70;
  const isPassed = totalScore >= passScore;
  const answers = result.answers || result.student_answers || [];
  const totalQuestions = answers.length;
  const correctCount = answers.filter(a => {
    const studentAnswer = a.student_answer || a.studentAnswer;
    const correctAnswer = a.correct_answer || a.correctAnswer;
    return studentAnswer === correctAnswer;
  }).length;

  return (
    <div className="page-container">
      {/* Score header */}
      <div className={`card text-center mb-6 ${isPassed ? 'border-2 border-green-200' : 'border-2 border-red-200'}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isPassed ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isPassed ? (
            <Trophy className="w-10 h-10 text-green-600" />
          ) : (
            <XCircle className="w-10 h-10 text-red-500" />
          )}
        </div>
        <div className={`text-5xl font-bold mb-2 ${isPassed ? 'text-green-600' : 'text-red-500'}`}>
          {totalScore}
        </div>
        <p className="text-gray-500">trên {passScore} điểm</p>
        <span className={`badge mt-3 text-sm ${isPassed ? 'badge-success' : 'badge-danger'}`}>
          {isPassed ? 'ĐẬU' : 'TRƯỢT'}
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900">{correctCount}/{totalQuestions}</div>
          <div className="text-xs text-gray-500 mt-1">Câu trả lời đúng</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900">
            {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Tỉ lệ đúng</div>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1 text-gray-900">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-bold">
              {result.time_spent || result.timeSpent
                ? Math.round((result.time_spent || result.timeSpent) / 60)
                : '-'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Phút làm bài</div>
        </div>
      </div>

      {/* Review questions */}
      {answers.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Chi tiết bài làm</h3>
          <div className="space-y-4">
            {answers.map((a, idx) => {
              const isCorrect = (a.student_answer || a.studentAnswer) === (a.correct_answer || a.correctAnswer);
              return (
                <div
                  key={idx}
                  className={`card border-2 ${
                    isCorrect ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isCorrect ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        Câu {idx + 1}: {a.question || a.question_text || a.content || 'N/A'}
                      </p>

                      {a.options && Array.isArray(a.options) ? (
                        <div className="space-y-1.5">
                          {a.options.map((opt, oi) => {
                            const isStudentChoice = opt === (a.student_answer || a.studentAnswer);
                            const isCorrectChoice = opt === (a.correct_answer || a.correctAnswer);
                            return (
                              <div
                                key={oi}
                                className={`text-sm px-3 py-2 rounded-ios-lg ${
                                  isCorrectChoice
                                    ? 'bg-green-100 text-green-700 font-medium'
                                    : isStudentChoice && !isCorrect
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-50 text-gray-500'
                                }`}
                              >
                                <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span>
                                {opt}
                                {isCorrectChoice && <CheckCircle className="w-3.5 h-3.5 inline ml-2 text-green-600" />}
                                {isStudentChoice && !isCorrect && <XCircle className="w-3.5 h-3.5 inline ml-2 text-red-500" />}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 bg-red-50 rounded-ios-lg">
                            <span className="text-red-600 font-medium">Bạn chọn:</span>{' '}
                            {a.student_answer || a.studentAnswer || 'Chưa trả lời'}
                          </div>
                          <div className="p-2 bg-green-50 rounded-ios-lg">
                            <span className="text-green-600 font-medium">Đáp án:</span>{' '}
                            {a.correct_answer || a.correctAnswer}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <button
          onClick={() => navigate('/student/luyen-thi')}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Về danh sách
        </button>
        {result.exam_id && (
          <button
            onClick={() => navigate(`/student/luyen-thi/${result.exam_id || result.examId}`)}
            className="btn-primary"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Làm lại
          </button>
        )}
      </div>
    </div>
  );
}
