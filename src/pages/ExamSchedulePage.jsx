import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Home,
  MapPin,
  Clock,
  Users,
  Filter,
  Search,
} from 'lucide-react';

const examSchedules = [
  {
    id: 1,
    date: '15/08/2026',
    time: '08:00 - 12:00',
    course: 'VLOS - Khóa 06',
    location: 'Sân bay thực hành Hòa Lạc, Hà Nội',
    capacity: '15',
    registered: '12',
    status: 'open',
    statusLabel: 'Đang đăng ký',
  },
  {
    id: 2,
    date: '22/08/2026',
    time: '13:00 - 17:00',
    course: 'BVLOS - Khóa 03',
    location: 'Trung tâm SMC Training, Hà Nội',
    capacity: '10',
    registered: '10',
    status: 'full',
    statusLabel: 'Đã đầy',
  },
  {
    id: 3,
    date: '05/09/2026',
    time: '08:00 - 12:00',
    course: 'VLOS - Khóa 07',
    location: 'Sân bay thực hành Hòa Lạc, Hà Nội',
    capacity: '15',
    registered: '8',
    status: 'open',
    statusLabel: 'Đang đăng ký',
  },
  {
    id: 4,
    date: '12/09/2026',
    time: '08:00 - 17:00',
    course: 'Sát hạch tổng hợp',
    location: 'Trung tâm SMC Training, Hà Nội',
    capacity: '20',
    registered: '5',
    status: 'open',
    statusLabel: 'Đang đăng ký',
  },
  {
    id: 5,
    date: '20/09/2026',
    time: '08:00 - 12:00',
    course: 'VLOS - Khóa 08',
    location: 'Sân bay thực hành Hòa Lạc, Hà Nội',
    capacity: '15',
    registered: '0',
    status: 'upcoming',
    statusLabel: 'Sắp mở',
  },
  {
    id: 6,
    date: '01/10/2026',
    time: '13:00 - 17:00',
    course: 'BVLOS - Khóa 04',
    location: 'Trung tâm SMC Training, Hà Nội',
    capacity: '10',
    registered: '0',
    status: 'upcoming',
    statusLabel: 'Sắp mở',
  },
];

const MONTHS = [
  'Tất cả',
  'Tháng 8/2026',
  'Tháng 9/2026',
  'Tháng 10/2026',
];

function getMonthFromDate(dateStr) {
  const [day, month, year] = dateStr.split('/');
  return `${month}/${year}`;
}

export default function ExamSchedulePage() {
  const [filterMonth, setFilterMonth] = useState('Tất cả');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = examSchedules.filter((exam) => {
    const matchesMonth =
      filterMonth === 'Tất cả' ||
      getMonthFromDate(exam.date) === filterMonth.replace('Tháng ', '');
    const matchesSearch =
      !searchTerm.trim() ||
      exam.course.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  const statusBadge = (status) => {
    switch (status) {
      case 'open':
        return 'badge-success';
      case 'full':
        return 'badge-danger';
      case 'upcoming':
        return 'badge-info';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div>
      {/* Banner */}
      <section className="relative pt-20 pb-16 bg-gradient-to-br from-smc-700 via-smc-800 to-gray-900">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 25px 25px, white 1px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white/80 transition-colors flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white/90 font-medium">Lịch thi</span>
          </nav>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Lịch thi & Sát hạch
          </h1>
          <p className="text-white/60 mt-3 max-w-xl leading-relaxed">
            Theo dõi lịch thi sát hạch UAV và đăng ký tham gia kỳ thi phù hợp với lộ trình đào tạo của bạn.
          </p>
        </div>
      </section>

      {/* Filters & Table */}
      <section className="py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Filters bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            {/* Month filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="tab-bar">
                {MONTHS.map((month) => (
                  <button
                    key={month}
                    onClick={() => setFilterMonth(month)}
                    className={`tab-item whitespace-nowrap text-xs ${filterMonth === month ? 'tab-item-active' : ''}`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>
            {/* Search */}
            <div className="search-bar flex-1 max-w-xs">
              <Search className="w-4 h-4" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm..."
              />
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="empty-state py-16">
              <Calendar className="empty-state-icon" />
              <p className="empty-state-text">Không tìm thấy lịch thi</p>
              <p className="empty-state-sub">
                {searchTerm.trim() || filterMonth !== 'Tất cả'
                  ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.'
                  : 'Lịch thi đang được cập nhật. Vui lòng quay lại sau.'}
              </p>
            </div>
          ) : (
            <div className="table-container">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày thi</th>
                      <th>Khóa học</th>
                      <th>Địa điểm</th>
                      <th>Số lượng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((exam) => (
                      <tr key={exam.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-ios-lg bg-smc-50 flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-4 h-4 text-smc-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{exam.date}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {exam.time}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm font-medium text-gray-900">{exam.course}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="max-w-[200px] truncate">{exam.location}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {exam.registered}/{exam.capacity}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusBadge(exam.status)}`}>
                            {exam.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="mt-6 p-4 bg-smc-50 rounded-ios-2xl border border-smc-100">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-smc-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-smc-700">Thông tin đăng ký thi</p>
                <p className="text-xs text-smc-600/80 mt-1 leading-relaxed">
                  Để đăng ký tham gia kỳ thi sát hạch, vui lòng liên hệ trực tiếp với trung tâm qua số điện thoại
                  <span className="font-semibold"> 024 1234 5678 </span>
                  hoặc gửi email đến <span className="font-semibold">info@smc-training.com</span>.
                  Học viên đã có tài khoản có thể đăng ký trực tuyến trong mục "Kỳ thi" sau khi đăng nhập.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
