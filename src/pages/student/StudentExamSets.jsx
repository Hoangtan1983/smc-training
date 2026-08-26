import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Shuffle, Clock, FileText, Download, Layers } from 'lucide-react';
import { MODULE_INFO, getTotalQuestionCount, ensureLoaded } from '../../data/questionBank';
import { useState, useEffect } from 'react';

export default function StudentExamSets() {
  const navigate = useNavigate();
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ensureLoaded().then(() => {
      setTotalQuestions(getTotalQuestionCount());
      setLoading(false);
    }).catch(() => {
      setTotalQuestions(585);
      setLoading(false);
    });
  }, []);

  const examSets = [
    { id: 1, name: 'Đề thi cố định số 1', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'blue' },
    { id: 2, name: 'Đề thi cố định số 2', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'indigo' },
    { id: 3, name: 'Đề thi cố định số 3', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'violet' },
    { id: 4, name: 'Đề thi cố định số 4', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'purple' },
    { id: 5, name: 'Đề thi cố định số 5', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'pink' },
    { id: 6, name: 'Đề thi cố định số 6', desc: '100 câu trắc nghiệm — phân bổ 10 học phần', icon: '📝', color: 'rose' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Luyện thi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ngân hàng <strong>{totalQuestions} câu</strong> từ 10 học phần — Phụ lục 2 UAV
        </p>
      </div>

      {/* Đề thi theo môn học */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          Đề thi theo môn học
          <span className="text-xs font-normal text-gray-400">— chọn môn để làm đề trắc nghiệm riêng</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(MODULE_INFO).map(([id, info]) => {
            const minutes = Math.max(10, Math.round(info.questionCount * 1.2));
            return (
              <button
                key={id}
                onClick={() => navigate(`/student/luyen-thi/subject-${id}`)}
                className="card p-5 text-left group cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{info.icon}</span>
                  <span className="badge bg-emerald-50 text-emerald-700 text-xs uppercase font-semibold">{id}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 mt-2 group-hover:text-emerald-600">{info.name}</h3>
                <p className="text-xs text-gray-500">{info.questionCount} câu • {minutes} phút</p>
                <div className="flex items-center gap-1 text-sm text-emerald-600 font-medium mt-3 group-hover:gap-2 transition-all">
                  Vào thi <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Module overview */}
      <div className="card p-4 mb-6 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Cấu trúc ngân hàng câu hỏi (10 học phần)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(MODULE_INFO).map(([id, info]) => (
            <div key={id} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-2 py-1.5 border">
              <span className="text-base">{info.icon}</span>
              <div>
                <span className="font-medium">{id.toUpperCase()}</span>
                <span className="text-gray-400 ml-1">({info.questionCount}c)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6 Fixed Exam Sets */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          6 Đề thi cố định
          <span className="text-xs font-normal text-gray-400">— mỗi đề 100 câu, thời gian 120 phút</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {examSets.map(set => (
            <button
              key={set.id}
              onClick={() => navigate(`/student/luyen-thi/${set.id}`)}
              className="card p-5 text-left group cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
            >
              <span className="text-3xl mb-2 block">{set.icon}</span>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600">{set.name}</h3>
              <p className="text-xs text-gray-500">{set.desc}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="badge bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 120 phút
                </span>
                <span className="text-sm text-blue-500 font-medium group-hover:gap-2 transition-all flex items-center gap-1">
                  Vào thi <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Random Exam */}
      <div className="card p-6 border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50/50 to-orange-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Shuffle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Thi thử — Đề Random</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                100 câu ngẫu nhiên từ ngân hàng {totalQuestions} câu. Mỗi lần thi khác nhau.
              </p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 120 phút • Có thể xem lại & xuất kết quả
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/student/luyen-thi/random')}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Shuffle className="w-4 h-4" /> Thi thử ngay
          </button>
        </div>
      </div>

      {/* History link */}
      <div className="mt-6 text-center">
        <button
          onClick={() => navigate('/student/lich-su-thi')}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mx-auto"
        >
          <Clock className="w-4 h-4" /> Xem lịch sử làm bài
        </button>
      </div>
    </div>
  );
}
