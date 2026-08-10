import { Link } from 'react-router-dom';
import { Award, BookOpen, Users, Shield, ChevronRight, Star, ArrowRight } from 'lucide-react';

const stats = [
  { value: '3', label: 'Khóa đào tạo', suffix: '' },
  { value: '57+', label: 'Học viên', suffix: '' },
  { value: '4+', label: 'Giảng viên kỳ cựu', suffix: '' },
];

const features = [
  {
    icon: Shield,
    title: 'Đào tạo chuyên sâu',
    description: 'Chương trình đào tạo bài bản, kết hợp lý thuyết và thực hành bay thực tế với thiết bị hiện đại.',
  },
  {
    icon: Award,
    title: 'Chứng chỉ quốc gia',
    description: 'Chứng chỉ được cấp theo Nghị định 288/2025/NĐ-CP, có giá trị pháp lý trên toàn quốc.',
  },
  {
    icon: BookOpen,
    title: 'Giảng viên kỳ cựu',
    description: 'Đội ngũ giảng viên giàu kinh nghiệm, từng công tác trong lực lượng không quân và hàng không dân dụng.',
  },
  {
    icon: Users,
    title: 'Hỗ trợ 24/7',
    description: 'Đội ngũ tư vấn và hỗ trợ kỹ thuật luôn sẵn sàng giải đáp mọi thắc mắc của học viên.',
  },
];

const courses = [
  {
    id: 1,
    title: 'Khóa đào tạo VLOS',
    subtitle: 'Visual Line of Sight',
    description: 'Đào tạo phi công UAV trong tầm nhìn trực quan. Phù hợp với người mới bắt đầu, bao gồm lý thuyết hàng không, quy định pháp luật và thực hành bay cơ bản.',
    duration: '8 tuần',
    level: 'Cơ bản',
  },
  {
    id: 2,
    title: 'Khóa đào tạo BVLOS',
    subtitle: 'Beyond Visual Line of Sight',
    description: 'Đào tạo phi công UAV ngoài tầm nhìn trực quan. Dành cho học viên đã có chứng chỉ VLOS, tập trung vào bay tự động và điều khiển từ xa.',
    duration: '12 tuần',
    level: 'Nâng cao',
  },
  {
    id: 3,
    title: 'Sát hạch & Cấp chứng chỉ',
    subtitle: 'Examination & Certification',
    description: 'Kỳ thi sát hạch chính thức để cấp chứng chỉ phi công UAV theo quy định của Cục Hàng không Việt Nam.',
    duration: '1-2 ngày',
    level: 'Đánh giá',
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center bg-gradient-to-br from-smc-600 via-smc-700 to-smc-900 overflow-hidden">
        {/* Overlay pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 25px 25px, white 1px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-smc-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-400/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-3xl animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-ios-full bg-white/10 backdrop-blur-md text-white/80 text-xs font-medium mb-6 ring-1 ring-white/10">
              <Star className="w-3.5 h-3.5 text-accent-400" />
              Theo Nghị định 288/2025/NĐ-CP & Thông tư 146/2025/TT-BQP
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
              Trung tâm Đào tạo<br />
              <span className="text-accent-400">Phi công UAV</span>
              <br />SMC Training
            </h1>

            <p className="text-lg text-white/70 leading-relaxed max-w-xl mb-10">
              Đào tạo chuyên nghiệp theo tiêu chuẩn Cục Hàng không Việt Nam. Cam kết đầu ra, hỗ trợ việc làm sau tốt nghiệp.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="btn-primary bg-white text-smc-700 hover:bg-gray-100 py-3 px-8 text-base shadow-ios-lg shadow-black/10"
              >
                Đăng ký ngay
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                to="/tra-cuu"
                className="inline-flex items-center justify-center px-8 py-3 text-white/90 hover:text-white text-sm font-semibold rounded-ios-lg border border-white/20 hover:border-white/40 backdrop-blur-sm transition-all duration-200"
              >
                Tra cứu chứng chỉ
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
      </section>

      {/* Stats */}
      <section className="relative z-10 -mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-ios-2xl shadow-ios-lg p-6 text-center animate-slide-up"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="stat-value text-smc-600">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
              Tại sao chọn <span className="text-smc-600">SMC Training</span>?
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Chúng tôi cam kết mang đến chương trình đào tạo UAV chất lượng cao nhất, đáp ứng mọi tiêu chuẩn của Cục Hàng không Việt Nam.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="card card-hover group">
                <div className="w-12 h-12 rounded-ios-xl bg-smc-50 flex items-center justify-center mb-4 group-hover:bg-smc-100 transition-colors">
                  <feature.icon className="w-6 h-6 text-smc-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
              Các khóa đào tạo
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Lộ trình đào tạo từ cơ bản đến nâng cao, phù hợp với mọi đối tượng học viên.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div key={course.id} className="card card-hover flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="badge badge-info mb-2">{course.level}</span>
                    <h3 className="text-lg font-bold text-gray-900 mt-2">{course.title}</h3>
                    <p className="text-sm text-smc-600 font-medium">{course.subtitle}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">
                  {course.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Thời lượng: {course.duration}</span>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-smc-600 hover:text-smc-700 transition-colors"
                  >
                    Đăng ký
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-gradient-to-r from-smc-600 to-smc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4">
            Sẵn sàng trở thành Phi công UAV chuyên nghiệp?
          </h2>
          <p className="text-white/70 max-w-md mx-auto mb-8">
            Đăng ký ngay hôm nay để nhận tư vấn miễn phí và ưu đãi học phí đặc biệt.
          </p>
          <Link
            to="/register"
            className="btn-primary bg-white text-smc-700 hover:bg-gray-100 py-3 px-10 text-base"
          >
            Đăng ký ngay
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
