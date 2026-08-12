import { FileText, Shield, Download, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffReports() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📋 Báo cáo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Báo cáo đào tạo gửi Quân chủng Phòng không - Không quân
          </p>
        </div>
      </div>

      {/* Placeholder — sắp triển khai */}
      <div className="card p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
          <ClipboardList className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-3">
          Báo cáo đào tạo gửi Quân chủng PK-KQ
        </h2>
        <p className="text-gray-500 max-w-lg mx-auto mb-2">
          Chức năng này sẽ được triển khai trong thời gian tới.
        </p>
        <p className="text-sm text-gray-400 max-w-lg mx-auto">
          Dữ liệu báo cáo học phí, doanh thu, chiết khấu đã được chuyển về mục{' '}
          <strong className="text-gray-600">Học phí & Vận hành → tab 📊 Báo cáo</strong>.
        </p>

        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl max-w-md mx-auto text-left">
          <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Báo cáo theo quy định
          </h3>
          <ul className="space-y-2 text-sm text-amber-700">
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Báo cáo danh sách học viên đã tốt nghiệp từng khóa</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Báo cáo kết quả sát hạch & cấp chứng chỉ UAV</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Báo cáo giờ bay thực hành của học viên</span>
            </li>
            <li className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Báo cáo tổng hợp định kỳ (tháng/quý/năm)</span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Vui lòng gửi dữ liệu báo cáo để chúng tôi tích hợp.
        </p>
      </div>
    </div>
  );
}
