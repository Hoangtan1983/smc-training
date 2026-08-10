import { Link } from 'react-router-dom';
import {
  Target,
  Eye,
  Flag,
  CalendarClock,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Home,
  CheckCircle2,
} from 'lucide-react';

const milestones = [
  {
    year: '2023',
    title: 'Thành lập trung tâm',
    description: 'SMC Training được thành lập với sứ mệnh đào tạo phi công UAV chuyên nghiệp tại Việt Nam.',
  },
  {
    year: '2024',
    title: 'Ký kết đối tác chiến lược',
    description: 'Hợp tác với các đơn vị hàng không và công nghệ hàng đầu để phát triển chương trình đào tạo.',
  },
  {
    year: '2025',
    title: 'Mở rộng quy mô',
    description: 'Ra mắt chương trình BVLOS và triển khai hệ thống sát hạch trực tuyến. Đào tạo hơn 50 học viên.',
  },
  {
    year: '2026',
    title: 'Chuẩn hóa theo NĐ 288',
    description: 'Cập nhật chương trình đào tạo theo Nghị định 288/2025/NĐ-CP và Thông tư 146/2025/TT-BQP.',
  },
];

const regulations = [
  {
    title: 'Nghị định 288/2025/NĐ-CP',
    description: 'Quy định về quản lý, khai thác và đảm bảo an toàn cho tàu bay không người lái (UAV) và phương tiện bay siêu nhẹ trong không phận Việt Nam.',
    points: [
      'Phân loại UAV theo trọng lượng và mục đích sử dụng',
      'Điều kiện cấp phép bay cho UAV',
      'Yêu cầu đào tạo và sát hạch phi công UAV',
      'Quy định về vùng cấm bay và hạn chế bay',
    ],
  },
  {
    title: 'Thông tư 146/2025/TT-BQP',
    description: 'Hướng dẫn chi tiết về công tác đào tạo, sát hạch và cấp chứng chỉ điều khiển tàu bay không người lái do Bộ Quốc phòng ban hành.',
    points: [
      'Chương trình khung đào tạo phi công UAV',
      'Tiêu chuẩn giảng viên và cơ sở đào tạo',
      'Quy trình tổ chức thi sát hạch',
      'Mẫu chứng chỉ và thời hạn hiệu lực',
    ],
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Banner */}
      <section className="relative pt-20 pb-16 bg-gradient-to-br from-smc-700 via-smc-800 to-gray-900">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, white 1px, transparent 0)', backgroundSize: '50px 50px' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white/80 transition-colors flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white/90 font-medium">Giới thiệu</span>
          </nav>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Về SMC Training
          </h1>
          <p className="text-white/60 mt-3 max-w-xl leading-relaxed">
            Trung tâm đào tạo phi công UAV hàng đầu Việt Nam, đồng hành cùng học viên trên con đường chinh phục bầu trời.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-900 mb-6">
                Trung tâm Đào tạo <span className="text-smc-600">Phi công UAV</span>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                SMC Training là trung tâm đào tạo phi công tàu bay không người lái (UAV) được thành lập với
                sứ mệnh cung cấp nguồn nhân lực chất lượng cao cho ngành công nghiệp UAV đang phát triển
                nhanh chóng tại Việt Nam.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Chúng tôi tự hào là đơn vị tiên phong trong việc xây dựng chương trình đào tạo toàn diện,
                kết hợp giữa kiến thức lý thuyết hàng không, kỹ năng thực hành bay và hiểu biết sâu sắc
                về khung pháp lý hiện hành.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Với đội ngũ giảng viên giàu kinh nghiệm từ lực lượng không quân và hàng không dân dụng,
                cơ sở vật chất hiện đại và giáo trình chuẩn quốc tế, SMC Training cam kết mang đến
                môi trường học tập chuyên nghiệp và hiệu quả nhất cho mọi học viên.
              </p>
            </div>

            <div className="relative">
              <div className="aspect-video rounded-ios-3xl bg-gradient-to-br from-smc-100 via-smc-50 to-accent-100 flex items-center justify-center ring-1 ring-smc-200/50">
                <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-ios-2xl bg-smc-500/10 flex items-center justify-center mx-auto mb-4">
                    <Target className="w-10 h-10 text-smc-600" />
                  </div>
                  <p className="text-smc-700 font-bold text-lg">SMC Training</p>
                  <p className="text-sm text-smc-500/60 mt-1">Đào tạo Phi công UAV chuyên nghiệp</p>
                </div>
              </div>
              {/* Contact card */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="card p-4 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-smc-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Địa chỉ</p>
                    <p className="text-sm font-semibold text-gray-700">Hà Nội, Việt Nam</p>
                  </div>
                </div>
                <div className="card p-4 flex items-center gap-3">
                  <Phone className="w-5 h-5 text-smc-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Điện thoại</p>
                    <p className="text-sm font-semibold text-gray-700">024 1234 5678</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision / Mission */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-8 text-center animate-slide-up">
              <div className="w-14 h-14 rounded-ios-2xl bg-smc-100 flex items-center justify-center mx-auto mb-5">
                <Eye className="w-7 h-7 text-smc-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Tầm nhìn</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Trở thành trung tâm đào tạo UAV hàng đầu khu vực Đông Nam Á, góp phần đưa Việt Nam
                trở thành quốc gia tiên phong trong lĩnh vực công nghệ UAV.
              </p>
            </div>

            <div className="card p-8 text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="w-14 h-14 rounded-ios-2xl bg-accent-100 flex items-center justify-center mx-auto mb-5">
                <Target className="w-7 h-7 text-accent-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Sứ mệnh</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Đào tạo nguồn nhân lực UAV chất lượng cao, đáp ứng nhu cầu ngày càng tăng của thị trường
                trong nước và quốc tế, với cam kết về an toàn và chuyên nghiệp.
              </p>
            </div>

            <div className="card p-8 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="w-14 h-14 rounded-ios-2xl bg-ios-green/10 flex items-center justify-center mx-auto mb-5">
                <Flag className="w-7 h-7 text-ios-green" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Giá trị cốt lõi</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                An toàn - Chất lượng - Chuyên nghiệp - Đổi mới. Đây là bốn trụ cột định hướng mọi
                hoạt động đào tạo và phát triển của trung tâm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Hành trình phát triển</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Những cột mốc quan trọng trên con đường xây dựng và phát triển của SMC Training.
            </p>
          </div>

          <div className="relative max-w-3xl mx-auto">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-smc-100 hidden sm:block" />

            <div className="space-y-8">
              {milestones.map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-6 sm:gap-8">
                  {/* Dot */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-ios-full bg-smc-500 text-white flex items-center justify-center text-xs font-bold shadow-ios-btn">
                    {item.year.slice(2)}
                  </div>
                  {/* Content */}
                  <div className="card flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarClock className="w-4 h-4 text-smc-500" />
                      <span className="text-sm font-bold text-smc-600">{item.year}</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1.5">{item.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Regulations */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Khung pháp lý</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Chương trình đào tạo của chúng tôi tuân thủ đầy đủ các quy định pháp luật hiện hành.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {regulations.map((reg, idx) => (
              <div key={idx} className="card">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{reg.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{reg.description}</p>
                <ul className="space-y-2.5">
                  {reg.points.map((point, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-ios-green flex-shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 card p-6 text-center bg-smc-50 border border-smc-100">
            <Mail className="w-5 h-5 text-smc-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Cần thêm thông tin về quy định pháp lý?{' '}
              <span className="text-smc-600 font-semibold">Liên hệ với chúng tôi: info@smc-training.com</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
