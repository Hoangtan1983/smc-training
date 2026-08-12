import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen, CheckCircle, HelpCircle } from 'lucide-react';

// Module mapping
const MODULE_NAMES = {
  'M1 - Luật Hàng Không & Giám Sát Bay': { name: 'Luật Hàng Không & Giám Sát Bay', icon: '📜' },
  'M2 - Hệ Thống Thiết Bị & Nguyên Lý Phần Cứng': { name: 'Hệ Thống Thiết Bị & Nguyên Lý Phần Cứng', icon: '🔧' },
  'M3 - Khí Tượng Tầm Thấp & Môi Trường Bay': { name: 'Khí Tượng Tầm Thấp & Môi Trường Bay', icon: '🌤️' },
  'M4 - Phân Loại Vùng Trời & Quy Phạm Vận Hành': { name: 'Phân Loại Vùng Trời & Quy Phạm Vận Hành', icon: '🗺️' },
  'M5 - Thao Tác Bay & Quy Trình Kiểm Tra Mặt Đất': { name: 'Thao Tác Bay & Quy Trình Kiểm Tra Mặt Đất', icon: '🛫' },
  'M6 - Tình Huống Khẩn Cấp & Xử Lý Sự Cố': { name: 'Tình Huống Khẩn Cấp & Xử Lý Sự Cố', icon: '🚨' },
};

const TYPE_ICONS = {
  'Kiến thức': '📚',
  'Đúng/Sai': '⚖️',
  'Tình huống': '🎯',
};

export default function OralPractice() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedIds, setRevealedIds] = useState(new Set());
  const [markedDone, setMarkedDone] = useState(new Set());

  useEffect(() => {
    fetch('/oral-questions.json')
      .then(r => r.json())
      .then(data => {
        setQuestions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = questions.filter(q => {
    const matchModule = selectedModule === 'all' || q.module === selectedModule;
    const matchSearch = !search ||
      q.question?.toLowerCase().includes(search.toLowerCase()) ||
      q.id?.toLowerCase().includes(search.toLowerCase());
    return matchModule && matchSearch;
  });

  const modules = [...new Set(questions.map(q => q.module))].filter(Boolean);
  const stats = { total: questions.length, done: markedDone.size };

  const toggleReveal = (id) => {
    const next = new Set(revealedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setRevealedIds(next);
  };

  const toggleDone = (id) => {
    const next = new Set(markedDone);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMarkedDone(next);
  };

  const startPractice = () => {
    setPracticeMode(true);
    setCurrentIndex(0);
    setRevealedIds(new Set());
  };

  const nextCard = () => {
    if (currentIndex < filtered.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8"><h1 className="text-2xl font-extrabold text-gray-900">Ôn luyện vấn đáp</h1></div>
        <div className="card p-12 text-center"><div className="spinner mx-auto" /><p className="text-gray-500 mt-4">Đang tải ngân hàng câu hỏi...</p></div>
      </div>
    );
  }

  // === PRACTICE MODE (Flashcard) ===
  if (practiceMode && filtered.length > 0) {
    const q = filtered[currentIndex];
    const moduleInfo = MODULE_NAMES[q.module] || { name: q.module, icon: '📋' };
    const isRevealed = revealedIds.has(q.id);
    const isDone = markedDone.has(q.id);

    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Ôn luyện vấn đáp</h1>
            <p className="text-sm text-gray-500">{currentIndex + 1} / {filtered.length} câu</p>
          </div>
          <button onClick={() => setPracticeMode(false)} className="btn-outline text-sm">Thoát</button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / filtered.length) * 100}%` }} />
        </div>

        {/* Flashcard */}
        <div className="card p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{moduleInfo.icon}</span>
            <span className="badge bg-purple-50 text-purple-700 text-xs">{moduleInfo.name}</span>
            <span className="badge bg-amber-50 text-amber-700 text-xs">{TYPE_ICONS[q.type]} {q.type}</span>
            <span className={`badge text-xs ${q.difficulty === 'Dễ' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{q.difficulty}</span>
          </div>

          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-1">{q.id}</p>
            <h2 className="text-lg font-bold text-gray-900 leading-relaxed">{q.question}</h2>
          </div>

          {isRevealed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-800">Đáp án / Hướng dẫn trả lời</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{q.answer}</p>
              {q.criteria && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Tiêu chí đạt:</p>
                  <p className="text-sm text-gray-600">{q.criteria}</p>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => toggleReveal(q.id)} className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-lg">
              <HelpCircle className="w-5 h-5" /> Xem đáp án
            </button>
          )}

          {isRevealed && (
            <div className="flex justify-center mt-4">
              <button onClick={() => { toggleDone(q.id); toggleReveal(q.id); }} className={`btn-outline text-sm ${isDone ? 'bg-green-50 border-green-300 text-green-700' : ''}`}>
                {isDone ? '✅ Đã thuộc' : '☐ Đánh dấu đã thuộc'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button onClick={prevCard} disabled={currentIndex === 0} className="btn-outline disabled:opacity-30">← Câu trước</button>
          <span className="text-sm text-gray-400 self-center">{markedDone.size}/{filtered.length} đã thuộc</span>
          <button onClick={nextCard} disabled={currentIndex === filtered.length - 1} className="btn-outline disabled:opacity-30">Câu sau →</button>
        </div>
      </div>
    );
  }

  // === LIST MODE ===
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Ôn luyện vấn đáp</h1>
        <p className="text-sm text-gray-500 mt-1">Ngân hàng {questions.length} câu hỏi vấn đáp — Phụ lục IV</p>
      </div>

      {/* Stats & Actions */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <p className="text-lg font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Tổng câu hỏi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-lg font-bold text-gray-900">{stats.done}</p>
            <p className="text-xs text-gray-500">Đã thuộc</p>
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={startPractice} disabled={filtered.length === 0} className="btn-primary flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Chế độ Flashcard
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm câu hỏi..." className="input-field pl-9" />
        </div>
        <select value={selectedModule} onChange={e => setSelectedModule(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả module ({questions.length})</option>
          {modules.map(m => (
            <option key={m} value={m}>{MODULE_NAMES[m]?.icon} {MODULE_NAMES[m]?.name || m} ({questions.filter(q => q.module === m).length})</option>
          ))}
        </select>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        {filtered.map((q, idx) => {
          const moduleInfo = MODULE_NAMES[q.module] || { name: q.module, icon: '📋' };
          const isExpanded = expandedId === q.id;
          const isDone = markedDone.has(q.id);

          return (
            <div key={q.id} className={`card transition-all ${isDone ? 'border-green-300 bg-green-50/30' : ''}`}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleDone(q.id)} className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}>
                    {isDone && <CheckCircle className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">{q.id}</span>
                      <span className="badge bg-purple-50 text-purple-700 text-xs">{moduleInfo.icon} {moduleInfo.name}</span>
                      <span className="badge bg-amber-50 text-amber-700 text-xs">{TYPE_ICONS[q.type]} {q.type}</span>
                      <span className={`badge text-xs ${q.difficulty === 'Dễ' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{q.difficulty}</span>
                    </div>
                    <p className={`font-medium ${isDone ? 'text-green-800' : 'text-gray-900'}`}>{q.question}</p>

                    {isExpanded && (
                      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-fade-in">
                        <p className="text-xs font-semibold text-emerald-700 mb-2">Đáp án / Hướng dẫn trả lời:</p>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{q.answer}</p>
                        {q.criteria && (
                          <div className="mt-3 pt-3 border-t border-emerald-200">
                            <p className="text-xs font-semibold text-emerald-700 mb-1">Tiêu chí đạt:</p>
                            <p className="text-sm text-gray-600">{q.criteria}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpandedId(isExpanded ? null : q.id)} className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-lg">Không tìm thấy câu hỏi nào</p>
        </div>
      )}
    </div>
  );
}
