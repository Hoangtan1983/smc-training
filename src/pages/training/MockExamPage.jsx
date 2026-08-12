import { Monitor, Clock, Award, ArrowRight, Timer } from 'lucide-react';

const exams = [
  { id: 'exam-a-vlos', title: 'Thi thử UAV Hạng A (VLOS)', duration: '60 phút', questions: 50, passMark: '70%', icon: '🛩️' },
  { id: 'exam-b-bvlos', title: 'Thi thử UAV Hạng B (BVLOS)', duration: '90 phút', questions: 70, passMark: '75%', icon: '🚁' },
];

export default function MockExamPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Thi thử</h1>
        <p className="text-sm text-gray-500 mt-0.5">Làm bài thi mô phỏng theo định dạng sát hạch thực tế</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {exams.map(exam => (
          <div key={exam.id} className="card p-6 group cursor-pointer hover:shadow-lg hover:border-amber-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <span className="text-3xl">{exam.icon}</span>
              <span className="badge bg-amber-50 text-amber-700 text-xs">{exam.duration}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">{exam.title}</h3>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><Clock className="w-4 h-4 text-amber-500" />{exam.duration}</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><Monitor className="w-4 h-4 text-amber-500" />{exam.questions} câu</div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500"><Award className="w-4 h-4 text-amber-500" />Đỗ: {exam.passMark}</div>
            </div>
            <button className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              Vào thi thử <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3">
          <Timer className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="font-bold text-amber-900">Lưu ý</h3>
            <p className="text-sm text-amber-700 mt-0.5">Bài thi thử mô phỏng điều kiện thi thật với giới hạn thời gian. Kết quả sẽ hiển thị ngay sau khi nộp bài.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
