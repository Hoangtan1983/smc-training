import { Award } from 'lucide-react';

export default function TeacherExamGrading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Sát hạch</h1><p className="text-sm text-gray-500 mt-1">Chấm thi thực hành, hội đồng sát hạch</p></div>
      <div className="card p-12 text-center text-gray-400"><Award className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Tính năng đang phát triển</p></div>
    </div>
  );
}
