import { Settings } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8"><h1 className="text-2xl font-extrabold text-gray-900">Cài đặt hệ thống</h1><p className="text-sm text-gray-500 mt-1">Cấu hình hệ thống SMC Training</p></div>
      <div className="card p-12 text-center"><Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="text-gray-400">Tính năng đang phát triển</p></div>
    </div>
  );
}
