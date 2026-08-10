import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, CheckCircle, ArrowRight, Brain, Plane, Radio, Wrench, Wind, Cloud, Zap } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TOPICS = [
  { id: 'aerodynamics', name: 'Khí động học', icon: Wind, color: 'bg-blue-50 text-blue-600' },
  { id: 'meteorology', name: 'Khí tượng', icon: Cloud, color: 'bg-cyan-50 text-cyan-600' },
  { id: 'propulsion', name: 'Động cơ & Hệ thống', icon: Zap, color: 'bg-yellow-50 text-yellow-600' },
  { id: 'flight', name: 'Kỹ thuật bay', icon: Plane, color: 'bg-smc-50 text-smc-600' },
  { id: 'communication', name: 'Liên lạc VTĐ', icon: Radio, color: 'bg-green-50 text-green-600' },
  { id: 'maintenance', name: 'Bảo dưỡng', icon: Wrench, color: 'bg-orange-50 text-orange-600' },
  { id: 'regulations', name: 'Quy định pháp luật', icon: Brain, color: 'bg-purple-50 text-purple-600' },
  { id: 'navigation', name: 'Dẫn đường', icon: BookOpen, color: 'bg-red-50 text-red-600' },
];

export default function StudentPractice() {
  const [questionBank, setQuestionBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQuestionBank();
      setQuestionBank(res.data || res.questions || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải câu hỏi ôn luyện.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTopicQuestions = (topicId) => {
    return questionBank.filter(q =>
      (q.topic || q.category || q.topic_id || '') === topicId
    );
  };

  const topicStats = useMemo(() => {
    return TOPICS.map(topic => ({
      ...topic,
      questionCount: getTopicQuestions(topic.id).length,
    }));
  }, [questionBank]);

  const startQuiz = (topic) => {
    const topicQuestions = getTopicQuestions(topic.id);
    if (topicQuestions.length === 0) {
      toast.error('Chủ đề này chưa có câu hỏi.');
      return;
    }
    const shuffled = [...topicQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));
    setSelectedTopic(topic);
    setQuizQuestions(selected);
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setQuizCompleted(false);
    setShowResults(false);
    setQuizOpen(true);
  };

  const handleAnswerSelect = (answer) => {
    setSelectedAnswers(prev => ({ ...prev, [currentQuestion]: answer }));
  };

  const nextQuestion = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setQuizCompleted(true);
      setShowResults(true);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      const answer = selectedAnswers[idx];
      const correctAnswer = q.correct_answer || q.correctAnswer || q.answer;
      if (answer === correctAnswer) correct++;
    });
    return { correct, total: quizQuestions.length };
  };

  const closeQuiz = () => {
    setQuizOpen(false);
    setSelectedTopic(null);
    setQuizQuestions([]);
    setSelectedAnswers({});
    setQuizCompleted(false);
    setShowResults(false);
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
      <PageHeader title="Ôn luyện" subtitle="Ôn tập kiến thức theo từng chủ đề" />

      {topicStats.every(t => t.questionCount === 0) ? (
        <EmptyState icon={BookOpen} title="Chưa có câu hỏi ôn luyện" description="Ngân hàng câu hỏi chưa có dữ liệu." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topicStats.map(topic => (
            <div
              key={topic.id}
              className="card card-hover"
              onClick={() => startQuiz(topic)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-ios-lg ${topic.color} flex items-center justify-center`}>
                  <topic.icon className="w-6 h-6" />
                </div>
                {topic.questionCount > 0 && (
                  <span className="badge badge-info">{topic.questionCount} câu</span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{topic.name}</h3>
              <p className="text-xs text-gray-500">
                {topic.questionCount > 0
                  ? `Nhấn để bắt đầu ôn luyện (10 câu ngẫu nhiên)`
                  : 'Chưa có câu hỏi'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Quiz Modal */}
      <Modal
        open={quizOpen}
        onClose={closeQuiz}
        title={showResults ? 'Kết quả ôn luyện' : `Ôn luyện - ${selectedTopic?.name || ''}`}
        size="lg"
      >
        {!showResults ? (
          <div className="space-y-6">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Câu {currentQuestion + 1} / {quizQuestions.length}</span>
              <span className="text-gray-400">{Object.keys(selectedAnswers).length} đã trả lời</span>
            </div>
            <div className="bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-smc-500 h-1.5 rounded-full transition-all"
                style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
              />
            </div>

            {quizQuestions[currentQuestion] && (
              <div className="space-y-4">
                <p className="font-medium text-gray-900">
                  {quizQuestions[currentQuestion].question || quizQuestions[currentQuestion].content || quizQuestions[currentQuestion].text}
                </p>
                <div className="space-y-2">
                  {(quizQuestions[currentQuestion].options || []).map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswerSelect(opt)}
                      className={`w-full text-left p-3 rounded-ios-xl border text-sm transition-all ${
                        selectedAnswers[currentQuestion] === opt
                          ? 'border-smc-500 bg-smc-50 text-smc-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={prevQuestion}
                disabled={currentQuestion === 0}
                className="btn-ghost btn-sm disabled:opacity-30"
              >
                Câu trước
              </button>
              <div className="flex gap-2">
                {quizQuestions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestion(idx)}
                    className={`w-7 h-7 rounded-full text-xs font-medium ${
                      idx === currentQuestion
                        ? 'bg-smc-500 text-white'
                        : selectedAnswers[idx] != null
                        ? 'bg-smc-100 text-smc-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={nextQuestion}
                className="btn-primary btn-sm"
              >
                {currentQuestion === quizQuestions.length - 1 ? 'Kết thúc' : 'Câu sau'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            {(() => {
              const { correct, total } = calculateScore();
              const pct = Math.round((correct / total) * 100);
              return (
                <>
                  <div>
                    <div className="text-4xl font-bold text-gray-900">{correct}/{total}</div>
                    <p className="text-gray-500 mt-1">Điểm số: {pct}%</p>
                    <span className={`badge mt-2 ${pct >= 70 ? 'badge-success' : 'badge-danger'}`}>
                      {pct >= 70 ? 'Đạt yêu cầu' : 'Cần ôn luyện thêm'}
                    </span>
                  </div>
                </>
              );
            })()}
            <div className="flex gap-3">
              <button onClick={closeQuiz} className="btn-secondary flex-1">Đóng</button>
              <button onClick={() => { closeQuiz(); if (selectedTopic) setTimeout(() => startQuiz(selectedTopic), 100); }} className="btn-primary flex-1">
                Làm lại
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
