import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ChevronLeft, ChevronRight, Eye, EyeOff, HelpCircle, BookOpen, Plane, Radio, Cloud, Wind, Wrench, Zap } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TOPIC_ICONS = {
  aerodynamics: Wind,
  meteorology: Cloud,
  propulsion: Zap,
  flight: Plane,
  communication: Radio,
  maintenance: Wrench,
  regulations: BookOpen,
  navigation: BookOpen,
};

const TOPIC_COLORS = {
  aerodynamics: 'bg-blue-50 text-blue-600',
  meteorology: 'bg-cyan-50 text-cyan-600',
  propulsion: 'bg-yellow-50 text-yellow-600',
  flight: 'bg-smc-50 text-smc-600',
  communication: 'bg-green-50 text-green-600',
  maintenance: 'bg-orange-50 text-orange-600',
  regulations: 'bg-purple-50 text-purple-600',
  navigation: 'bg-red-50 text-red-600',
};

export default function OralPractice() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [revealedAnswers, setRevealedAnswers] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/oral-questions.json');
      if (!response.ok) {
        throw new Error('Không tìm thấy file dữ liệu câu hỏi vấn đáp.');
      }
      const data = await response.json();
      const topicsList = Array.isArray(data) ? data : (data.topics || data.data || []);
      setTopics(topicsList);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải câu hỏi vấn đáp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleReveal = (questionIndex) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [questionIndex]: !prev[questionIndex],
    }));
  };

  const selectTopic = (topic) => {
    setSelectedTopic(topic);
    setCurrentQuestion(0);
    setRevealedAnswers({});
  };

  const backToTopics = () => {
    setSelectedTopic(null);
    setCurrentQuestion(0);
    setRevealedAnswers({});
  };

  const questions = selectedTopic?.questions || selectedTopic?.items || [];

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
        <PageHeader title="Ôn luyện vấn đáp" subtitle="Ôn tập trả lời câu hỏi vấn đáp" />
        <EmptyState
          icon={MessageCircle}
          title="Không thể tải dữ liệu"
          description={error}
          action={<button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Ôn luyện vấn đáp"
        subtitle={selectedTopic ? `Chủ đề: ${selectedTopic.name || selectedTopic.title || selectedTopic.topic}` : 'Chọn chủ đề để bắt đầu ôn luyện'}
      />

      {!selectedTopic ? (
        topics.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Chưa có câu hỏi vấn đáp" description="Dữ liệu câu hỏi vấn đáp chưa có sẵn." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map(topic => {
              const topicId = topic.id || topic.topic_id || '';
              const TopicIcon = TOPIC_ICONS[topicId] || MessageCircle;
              const colorClass = TOPIC_COLORS[topicId] || 'bg-gray-50 text-gray-600';
              const questionCount = (topic.questions || topic.items || []).length;

              return (
                <div
                  key={topic.id || topic.topic_id}
                  className="card card-hover"
                  onClick={() => selectTopic(topic)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-ios-lg ${colorClass} flex items-center justify-center`}>
                      <TopicIcon className="w-6 h-6" />
                    </div>
                    <span className="badge badge-info">{questionCount} câu</span>
                  </div>
                  <h3 className="font-bold text-gray-900">{topic.name || topic.title || topic.topic}</h3>
                  <p className="text-xs text-gray-500 mt-1">Nhấn để bắt đầu ôn luyện</p>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-6">
          <button onClick={backToTopics} className="btn-ghost text-sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Quay lại danh sách chủ đề
          </button>

          {questions.length === 0 ? (
            <EmptyState icon={MessageCircle} title="Chủ đề này chưa có câu hỏi" />
          ) : (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Câu {currentQuestion + 1} / {questions.length}</span>
                <span className="text-gray-400">{Object.keys(revealedAnswers).filter(k => revealedAnswers[k]).length} gợi ý đã xem</span>
              </div>
              <div className="bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-smc-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                />
              </div>

              {/* Current question */}
              {questions[currentQuestion] && (
                <div className="card">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-smc-100 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-5 h-5 text-smc-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Câu hỏi {currentQuestion + 1}</p>
                      <p className="font-medium text-gray-900 text-lg">
                        {questions[currentQuestion].question || questions[currentQuestion].content || questions[currentQuestion].text}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <button
                      onClick={() => toggleReveal(currentQuestion)}
                      className={`w-full flex items-center justify-between p-4 rounded-ios-xl text-sm font-medium transition-all ${
                        revealedAnswers[currentQuestion]
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {revealedAnswers[currentQuestion] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        {revealedAnswers[currentQuestion] ? 'Ẩn gợi ý' : 'Hiển thị gợi ý'}
                      </span>
                    </button>

                    {revealedAnswers[currentQuestion] && (
                      <div className="mt-4 p-4 bg-green-50 rounded-ios-xl border border-green-200">
                        <p className="text-sm text-green-800 whitespace-pre-wrap">
                          {questions[currentQuestion].answer || questions[currentQuestion].hint || questions[currentQuestion].suggestion || 'Chưa có gợi ý cho câu hỏi này.'}
                        </p>
                      </div>
                    )}
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

                <div className="flex gap-1 flex-wrap justify-center">
                  {questions.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestion(idx)}
                      className={`w-7 h-7 rounded-full text-xs font-medium ${
                        idx === currentQuestion
                          ? 'bg-smc-500 text-white'
                          : revealedAnswers[idx]
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
