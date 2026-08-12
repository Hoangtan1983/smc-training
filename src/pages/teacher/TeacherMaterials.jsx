import { FileText, Upload } from 'lucide-react';

export default function TeacherMaterials() {
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-extrabold text-gray-900">Tài liệu</h1><p className="text-sm text-gray-500 mt-1">Upload và quản lý tài liệu giảng dạy</p></div><button className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" /> Upload tài liệu</button></div>
      <div className="card p-12 text-center text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Tính năng đang phát triển</p></div>
    </div>
  );
}
