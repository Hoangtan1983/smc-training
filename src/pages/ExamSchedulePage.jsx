import { useState, useEffect } from 'react';
import { CalendarClock, Phone } from 'lucide-react';
import { apiGetPosts } from '../data/api';

export default function ExamSchedulePage() {
  const [pageContent, setPageContent] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetPosts({ type: 'page', pageKey: 'lich-thi' });
        const arr = Array.isArray(data) ? data : [];
        setPageContent(arr[0]?.content ? arr[0].content : null);
      } catch {
        setPageContent(null);
      }
    })();
  }, []);

  // Trung tâm tự đăng lịch thi qua trang quản trị (trang tĩnh key "lich-thi").
  // Khi đã đăng, nội dung sẽ hiển thị ở đây thay cho trạng thái chờ.
  if (pageContent) {
    return (
      <div className="pt-10 pb-12">
        <div className="page-container">
          <div className="max-w-3xl mx-auto">
            <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: pageContent }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-10 pb-12">
      <div className="page-container">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Lịch thi & Sát hạch</h1>
            <p className="text-lg text-gray-500">Lịch thi sát hạch UAV sắp tới</p>
          </div>

          <div className="card p-12 text-center text-gray-400">
            <CalendarClock className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-gray-500">Lịch thi sắp tới sẽ được công bố</p>
            <p className="text-sm text-gray-400 mt-1">Thông tin kỳ sát hạch sẽ được cập nhật tại đây.</p>
          </div>

          <div className="mt-8 p-6 bg-smc-50 rounded-xl text-center">
            <p className="text-sm text-smc-700 flex items-center justify-center gap-1.5">
              <Phone className="w-4 h-4" />
              Liên hệ trung tâm qua số <strong>1900 638939</strong> để biết thêm thông tin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
