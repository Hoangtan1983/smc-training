import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RotateCcw, CheckCircle, XCircle, FileText, Download } from 'lucide-react';
import QuestionCard from '../../components/QuestionCard';
import { getQuestionsByModule, MODULE_INFO } from '../../data/questionBank';
import { useAuth } from '../../context/AuthContext';

export default function StudentPractice() {
  const { user } = useAuth();
  const [selectedModule, setSelectedModule] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [finished, setFinished] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const startModule = (modId) => {
    const qs = getQuestionsByModule(modId);
    setSelectedModule(modId);
    setQuestions(qs);
    setCurrentIndex(0);
    setAnswers({});
    setShowResult(false);
    setFinished(false);
  };

  const handleAnswer = (optionIndex) => {
    if (showResult) return;
    const currentQ = questions[currentIndex];
    const isCorrect = optionIndex === currentQ.answer;
    setAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    setShowResult(true);
    // Auto-advance after 1.5s
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setShowResult(false);
      } else {
        setFinished(true);
      }
    }, 1500);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowResult(false);
    } else {
      setFinished(true);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    return { correct, total: questions.length, percent: Math.round((correct / questions.length) * 100) };
  };

  const handleExportPractice = () => {
    const studentName = user?.fullName || user?.email || 'Học viên';
    const score = calculateScore();
    const labels = ['A', 'B', 'C', 'D'];

    let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết quả ôn luyện - ${studentName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { color: #1d4ed8; margin: 0 0 8px 0; font-size: 22px; }
    .score-box { text-align: center; margin: 24px 0; padding: 24px; background: ${score.percent >= 70 ? '#f0fdf4' : '#fef2f2'}; border-radius: 12px; border: 2px solid ${score.percent >= 70 ? '#22c55e' : '#ef4444'}; }
    .score-number { font-size: 48px; font-weight: 800; color: ${score.percent >= 70 ? '#16a34a' : '#dc2626'}; }
    .question-block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
    .question-number { font-weight: 700; color: #1d4ed8; margin-bottom: 4px; }
    .question-text { margin-bottom: 8px; font-weight: 500; }
    .options { padding-left: 16px; }
    .option { padding: 4px 0; }
    .correct { color: #16a34a; font-weight: 600; }
    .incorrect { color: #dc2626; font-weight: 600; }
    .unanswered { color: #f59e0b; font-style: italic; }
    .result-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px; }
    .correct-badge { background: #dcfce7; color: #16a34a; }
    .incorrect-badge { background: #fee2e2; color: #dc2626; }
    .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>KẾT QUẢ ÔN LUYỆN UAV</h1>
    <div class="subtitle">Hệ thống SMC Training — smc-training.com</div>
  </div>
  <p><strong>Học viên:</strong> ${studentName}</p>
  <p><strong>Module:</strong> ${MODULE_INFO[selectedModule]?.name}</p>
  <p><strong>Ngày:</strong> ${new Date().toLocaleString('vi-VN')}</p>
  <div class="score-box">
    <div class="score-number">${score.correct} / ${score.total}</div>
    <div style="font-size: 20px; color: ${score.percent >= 70 ? '#16a34a' : '#dc2626'}; margin-top: 4px;">${score.percent}% — ${score.percent >= 70 ? 'ĐẠT' : 'CẦN ÔN THÊM'}</div>
  </div>
  <h2 style="font-size: 16px; color: #1d4ed8; margin-bottom: 12px;">Chi tiết ôn luyện</h2>
`;

    questions.forEach((q, i) => {
      const isCorrect = answers[i] === q.answer;
      const isAnswered = answers[i] !== undefined && answers[i] !== null;
      html += `<div class="question-block">
    <div class="question-number">Câu ${i + 1}
      ${isAnswered ? (isCorrect ? '<span class="result-badge correct-badge">ĐÚNG</span>' : '<span class="result-badge incorrect-badge">SAI</span>') : '<span class="result-badge" style="background:#fef3c7;color:#d97706;">CHƯA TRẢ LỜI</span>'}
    </div>
    <div class="question-text">${q.question || q.q || ''}</div>
    <div class="options">`;
      (q.options || []).forEach((opt, oi) => {
        let marker = '';
        if (oi === q.answer) marker = ' ✅';
        if (oi === answers[i] && !isCorrect) marker = ' ❌ (bạn chọn)';
        if (oi === answers[i] && isCorrect) marker = ' ✅ (bạn chọn)';
        let optStyle = '';
        if (oi === q.answer) optStyle = 'style="color:#16a34a;font-weight:600;"';
        if (oi === answers[i] && !isCorrect) optStyle = 'style="color:#dc2626;font-weight:600;"';
        html += `<div class="option" ${optStyle}>${labels[oi]}. ${opt}${marker}</div>`;
      });
      html += `</div>`;
      if (q.explanation) {
        html += `<div style="margin-top: 8px; padding: 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; color: #64748b;">📖 ${q.explanation}</div>`;
      }
      html += `</div>`;
    });

    html += `<div class="footer"><p>Bài ôn luyện được tạo bởi hệ thống SMC Training — smc-training.com</p></div></body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = studentName.replace(/[^a-zA-Z0-9_À-ỹ]/g, '_');
    a.download = `On_luyen_${safeName}_${MODULE_INFO[selectedModule]?.name || 'module'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (reviewMode) {
    const score = calculateScore();
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Xem lại bài ôn luyện</h1>
            <p className="text-sm text-gray-500">{MODULE_INFO[selectedModule]?.name} — {score.correct}/{score.total} ({score.percent}%)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportPractice} className="btn-outline flex items-center gap-1 text-sm">
              <Download className="w-4 h-4" /> Xuất HTML
            </button>
            <button onClick={() => setReviewMode(false)} className="btn-ghost text-sm">
              Ẩn chi tiết
            </button>
          </div>
        </div>
        <div className="print-section">
          {questions.map((q, i) => (
            <QuestionCard
              key={i}
              question={q}
              index={i}
              selectedAnswer={answers[i]}
              showResult={true}
            />
          ))}
        </div>
        <div className="flex justify-center gap-3 mt-6 pb-12">
          <button onClick={() => startModule(selectedModule)} className="btn-primary flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Làm lại</button>
          <button onClick={() => setSelectedModule(null)} className="btn-outline">Chọn module khác</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = calculateScore();
    return (
      <div className="animate-fade-in max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${score.percent >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
            {score.percent >= 70 ? <CheckCircle className="w-10 h-10 text-green-500" /> : <XCircle className="w-10 h-10 text-red-500" />}
          </div>
          <h2 className="text-2xl font-extrabold mb-2">Kết quả ôn luyện</h2>
          <p className="text-gray-500 mb-1">Module: {MODULE_INFO[selectedModule]?.name}</p>
          <p className="text-gray-500 mb-1">Học viên: {user?.fullName || user?.email || 'Học viên'}</p>
          <div className="text-4xl font-extrabold my-4">{score.correct} / {score.total}</div>
          <p className="text-lg text-gray-600">{score.percent}% — {score.percent >= 70 ? 'Đạt ✅' : 'Cần ôn thêm 📚'}</p>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={() => setReviewMode(true)} className="btn-primary flex items-center gap-2"><FileText className="w-4 h-4" /> Xem lại đáp án</button>
            <button onClick={handleExportPractice} className="btn-outline flex items-center gap-2"><Download className="w-4 h-4" /> Xuất kết quả</button>
            <button onClick={() => startModule(selectedModule)} className="btn-outline flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Làm lại</button>
            <button onClick={() => setSelectedModule(null)} className="btn-ghost">Chọn module khác</button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedModule) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8"><h1 className="text-2xl font-extrabold text-gray-900">Ôn luyện</h1><p className="text-sm text-gray-500 mt-1">Luyện tập theo từng module — chọn đáp án và xem giải thích ngay</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(MODULE_INFO).map(([id, info]) => (
            <button key={id} onClick={() => startModule(id)} className="card p-5 text-left group cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
              <span className="text-3xl mb-2 block">{info.icon}</span>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">{info.name}</h3>
              <p className="text-xs text-gray-500">{info.questionCount} câu • Làm xong có giải thích</p>
              <div className="flex items-center gap-1 text-sm text-blue-500 font-medium mt-3 group-hover:gap-2 transition-all">Bắt đầu <ArrowRight className="w-4 h-4" /></div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Ôn luyện</h1>
            <p className="text-sm text-gray-500">{MODULE_INFO[selectedModule]?.name}</p>
          </div>
          <span className="badge bg-blue-50 text-blue-700">{currentIndex + 1}/{questions.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} /></div>
      </div>

      {currentQ && <QuestionCard question={currentQ} index={currentIndex} selectedAnswer={answers[currentIndex]} onSelect={handleAnswer} showResult={showResult} />}

      {showResult && !finished && (
        <div className="flex justify-end mt-4">
          <button onClick={nextQuestion} className="btn-primary flex items-center gap-2">Tiếp tục <ArrowRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
