import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { apiGetPosts } from '../data/api';

const exams = [
  { date: '15/08/2026', type: 'Sát hạch Hạng A', location: 'SMC Training Center', status: 'Đang đăng ký', statusColor: 'bg-green-100 text-green-700' },
  { date: '30/08/2026', type: 'Sát hạch Hạng B - VLOS', location: 'SMC Training Center', status: 'Sắp mở', statusColor: 'bg-amber-100 text-amber-700' },
  { date: '15/09/2026', type: 'Sát hạch Hạng B - BVLOS', location: 'SMC Training Center', status: 'Sắp mở', statusColor: 'bg-blue-100 text-blue-700' },
];

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

  if (pageContent) {
    return (
      <div className="pt-20 pb-12">
        <div className="page-container">
          <div className="max-w-3xl mx-auto">
            <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: pageContent }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Lịch thi & Sát hạch</h1>
            <p className="text-lg text-gray-500">Lịch thi sát hạch UAV sắp tới</p>
          </div>

          <div className="space-y-3">
            {exams.map((exam, i) => (
              <div key={i} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-smc-50 flex items-center justify-center flex-shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-extrabold text-smc-600 leading-tight">{exam.date.split('/')[0]}</div>
                      <div className="text-xs text-gray-400">Tháng {exam.date.split('/')[1]}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{exam.type}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" /> {exam.date}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {exam.location}
                    </div>
                  </div>
                </div>
                <span className={`badge text-xs px-3 py-1 ${exam.statusColor} flex-shrink-0`}>
                  <Clock className="w-3 h-3 mr-1" /> {exam.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-smc-50 rounded-xl text-center">
            <p className="text-sm text-smc-700">
              Để đăng ký tham gia sát hạch, vui lòng liên hệ trung tâm qua số <strong>1900 638939</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
