import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Flag, AlertTriangle, Save } from 'lucide-react';
import QuestionCard from '../../components/QuestionCard';
import ExamTimer from '../../components/ExamTimer';
import { getExamSet, generateRandomExam, getExamByModule, MODULE_INFO, ensureLoaded } from '../../data/questionBank';
import { useAuth } from '../../context/AuthContext';
import { apiSubmitExamResult } from '../../data/api';
import toast from 'react-hot-toast';

export default function StudentExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [flagged, setFlagged] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const startTimeRef = useRef(Date.now());

  const isSubject = !!examId && examId.startsWith('subject-');
  const moduleCode = isSubject ? examId.slice('subject-'.length) : null;
  const subjectInfo = moduleCode ? MODULE_INFO[moduleCode] : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await ensureLoaded();
        if (cancelled) return;
        let qs;
        if (examId === 'random') {
          qs = generateRandomExam(100);
        } else if (isSubject) {
          qs = getExamByModule(moduleCode);
        } else {
          qs = getExamSet(parseInt(examId) || 1);
        }
        if (!qs || qs.length === 0) {
          throw new Error(isSubject ? 'Môn học này chưa có câu hỏi.' : 'Không thể tạo đề thi.');
        }
        if (!cancelled) {
          setQuestions(qs);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [examId]);

  const handleAnswer = (optionIndex) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 400);
    }
  };

  const handleTimeUp = useCallback(() => {
    handleSubmit();
  }, [answers, questions]);

  const handleSubmit = async () => {
    if (submitted) return;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const durationMinutes = Math.round(durationSeconds / 60);

    const resultId = 'exam-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const result = {
      id: resultId,
      student_id: user?.id,
      student_name: user?.fullName || user?.email || 'Học viên',
      exam_type: isSubject
        ? `Thi theo môn — ${subjectInfo?.name || moduleCode}`
        : examId === 'random'
          ? 'Thi thử (Đề Random)'
          : `Luyện thi - Đề cố định số ${examId}`,
      exam_number: isSubject ? examId : (examId === 'random' ? 'random' : parseInt(examId)),
      date: new Date().toISOString(),
      questions: questions.map((q, i) => ({
        ...q,
        student_answer: answers[i] !== undefined ? answers[i] : null,
      })),
      total: questions.length,
      answered: Object.keys(answers).length,
      correct: questions.filter((q, i) => answers[i] === q.answer).length,
      duration_minutes: durationMinutes || 120,
      duration_seconds: durationSeconds,
    };
    setSubmitted(true);

    // LƯU LOCAL TRƯỚC để trang kết quả luôn có dữ liệu
    try {
      const stored = JSON.parse(localStorage.getItem('smc_exam_results') || '[]');
      stored.push(result);
      localStorage.setItem('smc_exam_results', JSON.stringify(stored));
    } catch {}

    // Sau đó submit lên server
    try {
      await apiSubmitExamResult(result);
    } catch (err) {
      // vẫn đã lưu localStorage ở trên rồi
      console.warn('API submit failed, using localStorage', err);
    }

    navigate(`/student/ket-qua/${result.id}`, { replace: true });
  };

  const toggleFlag = () => {
    setFlagged(prev => {
      const next = new Set(prev);
      next.has(currentIndex) ? next.delete(currentIndex) : next.add(currentIndex);
      return next;
    });
  };

  const goToQuestion = (index) => {
    setCurrentIndex(index);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Đang tải ngân hàng câu hỏi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Không thể tải câu hỏi</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => navigate('/student/luyen-thi')} className="btn-primary">Quay lại</button>
        </div>
      </div>
    );
  }

  if (submitted) return null;

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const examDuration = questions.length > 0 ? Math.max(10, Math.round(questions.length * 1.2)) : 120;

  return (
    <div className="animate-fade-in">
      {/* Exam Header */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="text-sm font-bold text-gray-900">
              {isSubject
                ? `${subjectInfo?.icon || '📚'} Thi theo môn — ${subjectInfo?.name || moduleCode} (${questions.length} câu)`
                : examId === 'random' ? '🧪 Thi thử — Đề Random (100 câu)' : `📝 Luyện thi — Đề cố định số ${examId}`}
            </h1>
            <p className="text-xs text-gray-500">
              Đã trả lời: <strong className="text-blue-600">{answeredCount}</strong>/{questions.length} câu
              {unansweredCount > 0 && (
                <span className="text-amber-500 ml-2">• Còn {unansweredCount} câu chưa trả lời</span>
              )}
              {flagged.size > 0 && (
                <span className="text-amber-500 ml-2">• {flagged.size} câu đã gắn cờ 🚩</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ExamTimer durationMinutes={examDuration} onTimeUp={handleTimeUp} />
            <button onClick={() => setShowConfirm(true)} className="btn-primary text-sm px-4">
              Nộp bài
            </button>
          </div>
        </div>
      </div>

      {/* Question Area */}
      <div className="max-w-3xl mx-auto mt-6">
        {questions[currentIndex] && (
          <>
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
              <span>Câu {currentIndex + 1}/{questions.length}</span>
              {flagged.has(currentIndex) && <span className="text-amber-500">🚩 Đã gắn cờ</span>}
            </div>

            <QuestionCard
              question={questions[currentIndex]}
              index={currentIndex}
              selectedAnswer={answers[currentIndex]}
              onSelect={handleAnswer}
            />

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="btn-ghost flex items-center gap-1 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" /> Câu trước
              </button>

              <button
                onClick={toggleFlag}
                className={`btn-ghost flex items-center gap-1 ${flagged.has(currentIndex) ? 'text-amber-600 bg-amber-50' : ''}`}
              >
                <Flag className="w-4 h-4" />
                {flagged.has(currentIndex) ? 'Bỏ gắn cờ' : 'Gắn cờ xem lại'}
              </button>

              <button
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                className="btn-ghost flex items-center gap-1 disabled:opacity-30"
              >
                Câu sau <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Question Navigation Grid - đặt phía dưới */}
        <div className="mt-6 pb-4">
          <p className="text-xs text-gray-400 mb-2 font-medium">📋 Bộ câu hỏi (nhấn để chuyển):</p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => {
              let btnClass = 'flex-shrink-0 w-8 h-8 rounded text-xs font-bold transition-all ';
              if (i === currentIndex) {
                btnClass += 'bg-blue-600 text-white ring-2 ring-blue-300 scale-110';
              } else if (answers[i] !== undefined) {
                btnClass += 'bg-green-100 text-green-700 border border-green-300';
              } else {
                btnClass += 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200';
              }
              if (flagged.has(i)) {
                btnClass += ' ring-1 ring-amber-400';
              }
              return (
                <button
                  key={i}
                  onClick={() => goToQuestion(i)}
                  className={btnClass}
                  title={`Câu ${i + 1}${flagged.has(i) ? ' (đã gắn cờ)' : ''}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <h3 className="text-lg font-bold">Xác nhận nộp bài</h3>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">
                Đã trả lời: <strong className="text-green-600">{answeredCount}/{questions.length}</strong> câu
              </p>
              {unansweredCount > 0 && (
                <p className="text-sm text-red-500">
                  ⚠️ Còn <strong>{unansweredCount}</strong> câu chưa trả lời!
                </p>
              )}
              {flagged.size > 0 && (
                <p className="text-sm text-amber-500">
                  🚩 <strong>{flagged.size}</strong> câu đã gắn cờ cần xem lại
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Sau khi nộp bài, bạn sẽ xem được kết quả chi tiết và đáp án đúng/sai.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-ghost flex-1">
                Làm tiếp
              </button>
              <button onClick={handleSubmit} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
