import { useNavigate } from 'react-router-dom';
import { loadData } from '../../data/store';
import { useAuth } from '../../context/AuthContext';
import { Clock, CheckCircle, XCircle, Eye, RotateCcw, FileText, Trash2, BookOpen } from 'lucide-react';

export default function StudentExamHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const results = (loadData('exam_results', []))
    .filter(r => r.student_id === user?.id)
    .reverse();

  const clearHistory = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả lịch sử làm bài?')) {
      const allResults = loadData('exam_results', []);
      const filtered = allResults.filter(r => r.student_id !== user?.id);
      // Clear and re-save
      allResults.length = 0;
      allResults.push(...filtered);
    }
  };

  const getScoreBadge = (pct) => {
    if (pct >= 90) return { label: 'Xuất sắc', color: 'bg-green-100 text-green-700' };
    if (pct >= 70) return { label: 'Đạt', color: 'bg-green-100 text-green-700' };
    if (pct >= 50) return { label: 'Trung bình', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Yếu', color: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Lịch sử làm bài</h1>
          <p className="text-sm text-gray-500 mt-1">
            {results.length > 0
              ? `${results.length} bài thi đã hoàn thành`
              : 'Chưa có bài thi nào được ghi nhận'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/student/luyen-thi')}
            className="btn-primary flex items-center gap-1 text-sm"
          >
            <BookOpen className="w-4 h-4" /> Luyện thi
          </button>
          {results.length > 0 && (
            <button onClick={clearHistory} className="btn-ghost text-red-500 text-sm flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Xóa
            </button>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-16 h-16 mx-auto mb-4 text-gray-200" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">Chưa có bài thi nào</h3>
          <p className="text-sm text-gray-400 mb-6">
            Bạn chưa hoàn thành bài thi nào. Hãy bắt đầu luyện thi ngay!
          </p>
          <button
            onClick={() => navigate('/student/luyen-thi')}
            className="btn-primary"
          >
            Bắt đầu luyện thi
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map(r => {
            const pct = Math.round((r.correct / r.total) * 100);
            const badge = getScoreBadge(pct);
            const passed = pct >= 70;

            return (
              <div
                key={r.id}
                className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
                onClick={() => navigate(`/student/ket-qua/${r.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    passed ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {passed ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {r.exam_type}
                      <span className={`badge text-xs ${badge.color}`}>{badge.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span>{new Date(r.date).toLocaleString('vi-VN')}</span>
                      <span>•</span>
                      <span>{r.duration_minutes} phút</span>
                      <span>•</span>
                      <span>{r.answered}/{r.total} câu đã trả lời</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-16 sm:ml-0">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{r.correct}<span className="text-sm text-gray-400">/{r.total}</span></div>
                    <div className={`text-sm font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>{pct}%</div>
                  </div>
                  <button
                    className="p-2 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/ket-qua/${r.id}`);
                    }}
                    title="Xem chi tiết"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      {results.length > 0 && (
        <div className="card p-6 mt-8 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Thống kê luyện thi
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{results.length}</div>
              <div className="text-xs text-gray-500">Bài đã làm</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.filter(r => Math.round((r.correct / r.total) * 100) >= 70).length}
              </div>
              <div className="text-xs text-gray-500">Bài Đạt (≥70%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {Math.round(results.reduce((sum, r) => sum + Math.round((r.correct / r.total) * 100), 0) / results.length)}%
              </div>
              <div className="text-xs text-gray-500">Điểm TB</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.max(...results.map(r => Math.round((r.correct / r.total) * 100)))}%
              </div>
              <div className="text-xs text-gray-500">Điểm cao nhất</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
