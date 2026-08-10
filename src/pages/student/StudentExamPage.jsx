import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import * as api from '../../data/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

export default function StudentExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef(null);

  const fetchExam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExams();
      const allExams = res.data || res.exams || [];
      const found = allExams.find(e => String(e.id) === String(examId));
      if (!found) {
        setError('Không tìm thấy đề thi.');
        toast.error('Không tìm thấy đề thi.');
        return;
      }
      setExam(found);
      const totalTime = (found.time_limit || found.timeLimit || 60) * 60;
      setTimeLeft(totalTime);
    } catch (err) {
      setError(err.message || 'Không thể tải đề thi.');
      toast.error('Không thể tải đề thi.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  useEffect(() => {
    if (!exam || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [exam, timeLeft]);

  const handleAutoSubmit = async () => {
    toast.error('Hết thời gian làm bài. Bài thi sẽ được tự động nộp.');
    await submitExam();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionIndex, answer) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const submitExam = async () => {
    setSubmitting(true);
    try {
      const questions = exam.questions || [];
      const formattedAnswers = questions.map((q, idx) => ({
        question_id: q.id,
        question: q.question || q.content || q.text,
        student_answer: answers[idx] || null,
        correct_answer: q.correct_answer || q.correctAnswer || q.answer,
        options: q.options || [],
        max_score: q.point || q.max_score || q.maxScore || 1,
      }));

      const result = await api.submitExam({
        exam_id: examId,
        answers: formattedAnswers,
        time_spent: (exam.time_limit || exam.timeLimit || 60) * 60 - timeLeft,
      });

      toast.success('Nộp bài thành công.');
      const resultId = result.id || result.result_id || result.data?.id || result.data?.result_id;
      if (resultId) {
        navigate(`/student/ket-qua/${resultId}`, { replace: true });
      } else {
        navigate('/student/luyen-thi', { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi nộp bài.');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const questions = exam?.questions || [];

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon text-yellow-500" />
          <p className="empty-state-text text-red-500">{error || 'Không tìm thấy đề thi.'}</p>
          <button onClick={() => navigate('/student/luyen-thi')} className="btn-primary mt-4">Quay lại</button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <AlertTriangle className="empty-state-icon text-yellow-500" />
          <p className="empty-state-text">Đề thi chưa có câu hỏi.</p>
          <button onClick={() => navigate('/student/luyen-thi')} className="btn-primary mt-4">Quay lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Exam header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{exam.name || exam.exam_name}</h1>
            <p className="text-sm text-gray-500">
              {answeredCount}/{questions.length} câu đã trả lời
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-ios-lg text-sm font-bold ${
              timeLeft <= 300 ? 'bg-red-50 text-red-600' : 'bg-smc-50 text-smc-600'
            }`}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="btn-primary btn-sm"
            >
              {submitting ? <span className="spinner spinner-sm" /> : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Nộp bài
                </>
              )}
            </button>
          </div>
        </div>
        <div className="mt-4 bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-smc-500 h-1.5 rounded-full transition-all"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      {questions[currentQuestion] && (
        <div className="card mb-6">
          <p className="text-sm text-gray-500 mb-2">Câu {currentQuestion + 1}</p>
          <p className="font-medium text-gray-900 mb-6">
            {questions[currentQuestion].question || questions[currentQuestion].content || questions[currentQuestion].text}
          </p>
          <div className="space-y-3">
            {(questions[currentQuestion].options || []).map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(currentQuestion, opt)}
                className={`w-full text-left p-4 rounded-ios-xl border text-sm transition-all ${
                  answers[currentQuestion] === opt
                    ? 'border-smc-500 bg-smc-50 text-smc-700 ring-1 ring-smc-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
          disabled={currentQuestion === 0}
          className="btn-ghost disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Câu trước
        </button>

        <div className="hidden sm:flex items-center gap-1 flex-wrap justify-center max-w-[300px]">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQuestion(idx)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                idx === currentQuestion
                  ? 'bg-smc-500 text-white shadow-sm'
                  : answers[idx] != null
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCurrentQuestion(prev => Math.min(questions.length - 1, prev + 1))}
          disabled={currentQuestion === questions.length - 1}
          className="btn-ghost disabled:opacity-30"
        >
          Câu sau
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Submit confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submitExam}
        title="Nộp bài thi?"
        message={`Bạn đã trả lời ${answeredCount}/${questions.length} câu. ${
          questions.length - answeredCount > 0
            ? `Còn ${questions.length - answeredCount} câu chưa trả lời. `
            : ''
        }Bạn có chắc chắn muốn nộp bài không?`}
        confirmText="Nộp bài"
        variant="danger"
      />
    </div>
  );
}
