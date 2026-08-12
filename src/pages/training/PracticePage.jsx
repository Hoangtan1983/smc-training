import { PenTool, BookOpen, ArrowRight } from 'lucide-react';

const modules = [
  { id: 'm1', name: 'M1 - Pháp luật & Quy định về UAV', questions: 120, icon: '📜' },
  { id: 'm2', name: 'M2 - Khí tượng & Môi trường bay', questions: 80, icon: '🌤️' },
  { id: 'm3', name: 'M3 - Quản lý không phận & UTM', questions: 60, icon: '🛰️' },
  { id: 'm4', name: 'M4 - Kiến thức hàng không & Nguyên lý bay', questions: 100, icon: '✈️' },
  { id: 'm5', name: 'M5 - Tổ hợp UAV & Thiết bị đồng bộ', questions: 90, icon: '🔧' },
  { id: 'm6', name: 'M6 - Vận hành an toàn & Quy trình bay', questions: 110, icon: '🛡️' },
  { id: 'm7', name: 'M7 - Nhận biết & Quản lý mối đe dọa', questions: 70, icon: '⚠️' },
  { id: 'm8', name: 'M8 - Xử lý tình huống bất thường', questions: 60, icon: '🚨' },
];

export default function PracticePage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Ôn luyện</h1>
        <p className="text-sm text-gray-500 mt-0.5">Luyện tập theo từng học phần — chọn module để bắt đầu</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(m => (
          <div key={m.id} className="card p-5 group cursor-pointer hover:shadow-lg hover:border-smc-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{m.icon}</span>
              <span className="badge bg-smc-50 text-smc-700 text-xs">{m.questions} câu</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1.5 group-hover:text-smc-600 transition-colors">{m.name}</h3>
            <div className="flex items-center gap-1 text-sm text-smc-500 font-medium">
              Vào ôn luyện <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-5 h-5 text-smc-500" />
          <h2 className="font-bold text-gray-900">Tổng hợp</h2>
        </div>
        <p className="text-sm text-gray-500">Chế độ ôn luyện tổng hợp tất cả các module sẽ sớm ra mắt.</p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400">
          <PenTool className="w-4 h-4" /> Đang phát triển...
        </div>
      </div>
    </div>
  );
}
