import { useParams, useNavigate } from 'react-router-dom';
import { loadData } from '../../data/store';
import { CheckCircle, XCircle, Printer, Download, RotateCcw, ArrowLeft, FileText, Clock, Target, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import QuestionCard from '../../components/QuestionCard';

export default function StudentExamResult() {
  const { resultId } = useParams();
  const navigate = useNavigate();
  // Đọc trực tiếp từ localStorage để tránh cache cũ không có kết quả vừa nộp
  const results = JSON.parse(localStorage.getItem('smc_exam_results') || '[]');
  const result = results.find(r => r.id === resultId);
  const [reviewMode, setReviewMode] = useState(false);

  if (!result) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-12">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-500 mb-2">Không tìm thấy kết quả</h2>
          <p className="text-gray-400 mb-4">Kết quả bài thi này không tồn tại hoặc đã bị xóa.</p>
          <button onClick={() => navigate('/student/luyen-thi')} className="btn-primary">
            Quay lại Luyện thi
          </button>
        </div>
      </div>
    );
  }

  const score = result.correct;
  const total = result.total;
  const percent = Math.round((score / total) * 100);
  const passed = percent >= 70;

  const getGradeInfo = () => {
    if (percent >= 90) return { label: 'Xuất sắc', color: 'text-green-600', bg: 'bg-green-50', emoji: '🏆' };
    if (percent >= 80) return { label: 'Giỏi', color: 'text-emerald-600', bg: 'bg-emerald-50', emoji: '🌟' };
    if (percent >= 70) return { label: 'Khá', color: 'text-blue-600', bg: 'bg-blue-50', emoji: '✅' };
    if (percent >= 50) return { label: 'Trung bình', color: 'text-amber-600', bg: 'bg-amber-50', emoji: '📚' };
    return { label: 'Cần cải thiện', color: 'text-red-600', bg: 'bg-red-50', emoji: '💪' };
  };

  const gradeInfo = getGradeInfo();

  const formatDuration = (mins) => {
    if (!mins || mins <= 0) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}p`;
    return `${m} phút`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // Tạo nội dung HTML cho xuất PDF
    const labels = ['A', 'B', 'C', 'D'];
    let html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết quả bài thi - ${result.student_name}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { color: #1d4ed8; margin: 0 0 8px 0; font-size: 22px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; }
    .info-item { display: flex; justify-content: space-between; }
    .info-label { color: #64748b; }
    .info-value { font-weight: 600; }
    .score-box { text-align: center; margin: 24px 0; padding: 24px; background: ${passed ? '#f0fdf4' : '#fef2f2'}; border-radius: 12px; border: 2px solid ${passed ? '#22c55e' : '#ef4444'}; }
    .score-number { font-size: 48px; font-weight: 800; color: ${passed ? '#16a34a' : '#dc2626'}; }
    .question-block { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
    .question-number { font-weight: 700; color: #1d4ed8; margin-bottom: 4px; }
    .question-text { margin-bottom: 8px; font-weight: 500; }
    .options { padding-left: 16px; }
    .option { padding: 4px 0; display: flex; align-items: center; gap: 8px; }
    .option-marker { font-weight: 600; min-width: 20px; }
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
    <h1>KẾT QUẢ BÀI THI UAV</h1>
    <div class="subtitle">Hệ thống SMC Training — smc-training.com</div>
  </div>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">Học viên:</span> <span class="info-value">${result.student_name}</span></div>
    <div class="info-item"><span class="info-label">Loại bài thi:</span> <span class="info-value">${result.exam_type}</span></div>
    <div class="info-item"><span class="info-label">Ngày thi:</span> <span class="info-value">${new Date(result.date).toLocaleString('vi-VN')}</span></div>
    <div class="info-item"><span class="info-label">Thời gian:</span> <span class="info-value">${formatDuration(result.duration_minutes)}</span></div>
  </div>

  <div class="score-box">
    <div style="font-size: 16px; color: #666; margin-bottom: 8px;">${gradeInfo.emoji} Xếp loại: <strong>${gradeInfo.label}</strong></div>
    <div class="score-number">${score} / ${total}</div>
    <div style="font-size: 20px; color: ${passed ? '#16a34a' : '#dc2626'}; margin-top: 4px;">${percent}% — ${passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</div>
  </div>

  <h2 style="font-size: 16px; color: #1d4ed8; margin-bottom: 12px;">Chi tiết bài thi</h2>
`;

    result.questions.forEach((q, i) => {
      const isCorrect = q.student_answer === q.answer;
      const isAnswered = q.student_answer !== null && q.student_answer !== undefined;

      html += `
  <div class="question-block">
    <div class="question-number">Câu ${i + 1}
      ${isAnswered ? (isCorrect ? '<span class="result-badge correct-badge">ĐÚNG</span>' : '<span class="result-badge incorrect-badge">SAI</span>') : '<span class="result-badge" style="background:#fef3c7;color:#d97706;">CHƯA TRẢ LỜI</span>'}
    </div>
    <div class="question-text">${q.question || q.q || ''}</div>
    <div class="options">
`;

      (q.options || []).forEach((opt, oi) => {
        let marker = '';
        if (oi === q.answer) marker = ' ✅';
        if (oi === q.student_answer && !isCorrect) marker = ' ❌ (bạn chọn)';
        if (oi === q.student_answer && isCorrect) marker = ' ✅ (bạn chọn)';

        let optStyle = '';
        if (oi === q.answer) optStyle = 'style="color:#16a34a;font-weight:600;"';
        if (oi === q.student_answer && !isCorrect) optStyle = 'style="color:#dc2626;font-weight:600;"';

        html += `      <div class="option" ${optStyle}><span class="option-marker">${labels[oi]}.</span> ${opt}${marker}</div>\n`;
      });

      html += `    </div>\n`;
      if (q.explanation) {
        html += `    <div style="margin-top: 8px; padding: 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px; color: #64748b;">📖 ${q.explanation}</div>\n`;
      }
      html += '  </div>\n';
    });

    html += `
  <div class="footer">
    <p>Bài thi được tạo bởi hệ thống SMC Training — smc-training.com</p>
    <p>Dữ liệu câu hỏi từ Phụ lục 2 — Bộ câu hỏi trắc nghiệm UAV</p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (result.student_name || 'hoc-vien').replace(/[^a-zA-Z0-9_À-ỹ]/g, '_');
    a.download = `Ket_qua_thi_${safeName}_${result.exam_type?.replace(/\s+/g, '_') || 'de_thi'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const labels = ['A', 'B', 'C', 'D'];
    let text = '';
    text += '═══════════════════════════════════════\n';
    text += '       KẾT QUẢ BÀI THI UAV\n';
    text += '═══════════════════════════════════════\n\n';
    text += `Học viên: ${result.student_name}\n`;
    text += `Loại bài thi: ${result.exam_type}\n`;
    text += `Ngày thi: ${new Date(result.date).toLocaleString('vi-VN')}\n`;
    text += `Thời gian làm bài: ${formatDuration(result.duration_minutes)}\n`;
    text += `\nKẾT QUẢ: ${score}/${total} (${percent}%) — ${passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}\n`;
    text += `Xếp loại: ${gradeInfo.label}\n`;
    text += `Số câu đã trả lời: ${result.answered}/${result.total}\n`;
    text += `\n${'═'.repeat(60)}\n`;
    text += `                 CHI TIẾT BÀI THI\n`;
    text += `${'═'.repeat(60)}\n\n`;

    result.questions.forEach((q, i) => {
      const isCorrect = q.student_answer === q.answer;
      const isAnswered = q.student_answer !== null && q.student_answer !== undefined;
      const status = isAnswered ? (isCorrect ? '✅ ĐÚNG' : '❌ SAI') : '⬜ CHƯA TRẢ LỜI';

      text += `Câu ${i + 1}: ${status}\n`;
      text += `  ${q.question || q.q || ''}\n`;
      (q.options || []).forEach((opt, oi) => {
        let marker = oi === q.answer ? ' ← ĐÁP ÁN ĐÚNG' : '';
        if (oi === q.student_answer) marker += ' (BẠN CHỌN)';
        text += `    ${labels[oi]}. ${opt}${marker}\n`;
      });
      if (q.explanation) {
        text += `  📖 ${q.explanation}\n`;
      }
      text += '\n';
    });

    text += `${'═'.repeat(60)}\n`;
    text += `Hệ thống SMC Training — smc-training.com\n`;
    text += `Dữ liệu từ Phụ lục 2 — Bộ câu hỏi UAV\n`;

    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (result.student_name || 'hoc-vien').replace(/[^a-zA-Z0-9_À-ỹ]/g, '_');
    a.download = `Ket_qua_thi_${safeName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`animate-fade-in max-w-3xl mx-auto ${reviewMode ? '' : ''}`}>
      {/* Summary Card */}
      <div className="card p-8 text-center mb-8">
        <button
          onClick={() => navigate('/student/luyen-thi')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1 mx-auto"
        >
          <ArrowLeft className="w-3 h-3" /> Quay lại Luyện thi
        </button>

        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
          passed ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {passed ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500" />
          )}
        </div>

        <h2 className="text-2xl font-extrabold mb-1">
          {passed ? 'Chúc mừng! Bạn đã ĐẠT' : 'Chưa đạt — Cần ôn thêm'}
        </h2>

        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold mt-2 ${gradeInfo.bg} ${gradeInfo.color}`}>
          {gradeInfo.emoji} {gradeInfo.label}
        </div>

        <p className="text-gray-500 mt-3 mb-1">{result.exam_type}</p>

        <div className="text-6xl font-extrabold my-4 text-gray-900">{score}<span className="text-3xl text-gray-400">/{total}</span></div>
        <p className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{percent}%</p>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-6 max-w-md mx-auto">
          <div className="text-center">
            <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Thời gian
            </div>
            <div className="font-semibold text-gray-700">{formatDuration(result.duration_minutes)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <Target className="w-3 h-3" /> Đã trả lời
            </div>
            <div className="font-semibold text-gray-700">{result.answered}/{result.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Ngày thi</div>
            <div className="font-semibold text-gray-700 text-xs">{new Date(result.date).toLocaleDateString('vi-VN')}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button
            onClick={() => setReviewMode(!reviewMode)}
            className="btn-outline flex items-center gap-1"
          >
            <FileText className="w-4 h-4" /> {reviewMode ? 'Ẩn chi tiết' : 'Xem lại bài thi'}
          </button>
          <button
            onClick={handleExportPDF}
            className="btn-ghost flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            <Download className="w-4 h-4" /> Xuất HTML (in)
          </button>
          <button
            onClick={handleExportText}
            className="btn-ghost flex items-center gap-1"
          >
            <Download className="w-4 h-4" /> Xuất Text
          </button>
        </div>

        {/* Retry buttons */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => navigate(`/student/luyen-thi/${result.exam_number || 'random'}`)}
            className="btn-primary flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Làm lại
          </button>
          <button
            onClick={() => navigate('/student/luyen-thi')}
            className="btn-ghost"
          >
            Chọn đề khác
          </button>
        </div>
      </div>

      {/* Review Section */}
      {reviewMode && (
        <div className="print-section">
          {/* Print header (visible only when printing) */}
          <div className="hidden print:block mb-6 pb-4 border-b-2 border-blue-700">
            <h2 className="text-xl font-bold text-blue-700">KẾT QUẢ BÀI THI UAV</h2>
            <p className="text-sm">
              Học viên: <strong>{result.student_name}</strong> — {result.exam_type}
            </p>
            <p className="text-sm">
              Điểm: <strong>{score}/{total} ({percent}%)</strong> — {passed ? 'ĐẠT' : 'KHÔNG ĐẠT'} — Ngày: {new Date(result.date).toLocaleDateString('vi-VN')}
            </p>
          </div>

          {result.questions.map((q, i) => (
            <QuestionCard
              key={i}
              question={q}
              index={i}
              selectedAnswer={q.student_answer}
              showResult={true}
            />
          ))}

          <div className="hidden print:block text-center text-xs text-gray-400 mt-8 pt-4 border-t">
            Hệ thống SMC Training — smc-training.com | Dữ liệu từ Phụ lục 2
          </div>
        </div>
      )}
    </div>
  );
}
