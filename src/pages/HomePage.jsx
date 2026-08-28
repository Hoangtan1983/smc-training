import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGetPosts, apiGetFiles, apiFileUrl } from '../data/api';
import {
  Shield,
  Users,
  Wrench,
  Award,
  Target,
  HeadphonesIcon,
  CheckCircle,
  ArrowRight,
  Star,
  Video,
} from 'lucide-react';

const stats = [
  { value: '2', label: 'Hạng chứng chỉ UAV' },
  { value: 'Hạng A', label: 'VLOS — 140h' },
  { value: 'Hạng B', label: 'BVLOS — 296h' },
];

const courses = [
  {
    id: 'uav-a',
    title: 'Chứng chỉ UAV Hạng A — VLOS',
    subtitle: 'Bay trong tầm nhìn trực quan',
    badge: 'Cơ bản',
    badgeColor: 'bg-blue-500',
    duration: '140h (Lý thuyết 42h + Thực hành 84h + Ôn luyện 14h)',
    modules: '6 Học phần',
    features: [
      'Pháp luật & quy định về UAV (NĐ 288)',
      'Khí tượng & môi trường bay (TT 146)',
      'Kiến thức hàng không & nguyên lý bay',
      'Vận hành an toàn & quy trình bay',
      'Kỹ năng bay thực hành trong tầm nhìn',
      'Xử lý tình huống khẩn cấp',
    ],
    highlighted: false,
  },
  {
    id: 'uav-b-bvlos',
    title: 'Chứng chỉ UAV Hạng B — BVLOS',
    subtitle: 'Bay ngoài tầm nhìn — Chuyên sâu',
    badge: 'Phổ biến nhất',
    badgeColor: 'bg-amber-500',
    duration: '296h (Lý thuyết 88h + Thực hành 178h + Ôn luyện 30h)',
    modules: '6 Học phần',
    features: [
      'Nguyên lý bay tầm xa BVLOS',
      'Hệ thống & công nghệ UAV tiên tiến',
      'Thiết bị dẫn đường & camera chuyên dụng',
      'Lập kế hoạch bay tự động (NĐ 288)',
      'Quản lý mối đe dọa & rủi ro (TT 146)',
      'Quy trình khẩn cấp & dự phòng',
    ],
    highlighted: true,
  },
];

const advantages = [
  { icon: Shield, title: 'Trung tâm được cấp phép', desc: 'Hoạt động theo Nghị định 288/2025/NĐ-CP & Thông tư 146/2025/TT-BQP' },
  { icon: Users, title: 'Giảng viên, Chuyên gia', desc: 'Bằng cấp phù hợp + kinh nghiệm thực tế' },
  { icon: Wrench, title: 'Thiết bị hiện đại', desc: 'Sân bay, thiết bị UAV đời mới nhất' },
  { icon: Award, title: '2 Hạng chứng chỉ', desc: 'Hạng A — VLOS (140h: LT 42h + TH 84h + Ôn 14h), Hạng B — BVLOS (296h: LT 88h + TH 178h + Ôn 30h)' },
  { icon: Target, title: 'Thực hành trọng tâm', desc: '60% thời lượng là thực hành bay thực tế' },
  { icon: HeadphonesIcon, title: 'Hỗ trợ sau khóa học', desc: 'Kết nối việc làm, hỗ trợ kỹ thuật sau chứng chỉ' },
];

const process = [
  { step: 1, title: 'Đăng ký', desc: 'Điền form đăng ký và chọn khóa học phù hợp' },
  { step: 2, title: 'Học lý thuyết', desc: 'Hoàn thành các học phần lý thuyết trực tuyến & trực tiếp' },
  { step: 3, title: 'Thực hành bay', desc: 'Thực hành bay thực tế tại sân bay & phòng mô phỏng' },
  { step: 4, title: 'Sát hạch & Chứng chỉ', desc: 'Thi sát hạch cuối khóa & nhận chứng chỉ chính thức' },
];

export default function HomePage() {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetPosts({ type: 'article' });
        setNews((Array.isArray(data) ? data : []).slice(0, 3));
      } catch {
        setNews([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetFiles('videos');
        setVideos(Array.isArray(data) ? data : []);
      } catch {
        setVideos([]);
      }
    })();
  }, []);

  // Trích mã video từ một URL YouTube (watch/embed/shorts/youtu.be)
  const youtubeId = (url) => {
    if (!url) return null;
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : null;
  };

  return (
    <div>
      {/* Hero Section — iOS style */}
      <section className="relative min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-6rem)] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F0FDFB]" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-[#007AFF]/8 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#5AC8FA]/8 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-[#007AFF]/4 rounded-full blur-2xl" />

        <div className="page-container relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#007AFF]/8 border border-[#007AFF]/15 text-[#007AFF] text-[0.75rem] font-semibold mb-6">
              <Star className="w-3.5 h-3.5 fill-[#007AFF] text-[#007AFF]" />
              Hoạt động theo Nghị định 288/2025 và thông tư 146/2025
            </div>

            <h1 className="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] font-bold text-[#1C1C1E] leading-[1.08] tracking-tight animate-fade-in">
              Trung tâm Đào tạo
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#007AFF] to-[#5AC8FA]">
                Ứng dụng Công nghệ SMC
              </span>
            </h1>

            <p className="mt-6 text-[1.0625rem] sm:text-[1.125rem] text-[#8E8E93] max-w-2xl leading-relaxed animate-fade-in">
              Chương trình đào tạo phi công UAV chuyên nghiệp.
              Hoạt động theo Nghị định 288/2025/NĐ-CP và Thông tư 146/2025/TT-BQP về quản lý tàu bay không người lái.
              Cấp chứng chỉ UAV Hạng A — VLOS (140h) và Hạng B — BVLOS (296h).
            </p>

            <div className="mt-10 flex flex-wrap gap-4 animate-slide-up">
              {user ? (
                <Link to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'} className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
                  Vào hệ thống
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
                    Đăng ký khóa học
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/login" className="btn-outline text-base px-8 py-3">
                    Đăng nhập hệ thống
                  </Link>
                </>
              )}
            </div>

            {/* Stats Bar — iOS style */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/70 backdrop-blur-xl backdrop-saturate-150 rounded-2xl p-6 sm:p-8 shadow-ios animate-slide-up border border-black/5">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-[1.5rem] sm:text-[1.75rem] font-bold text-[#007AFF]">{s.value}</div>
                  <div className="text-[0.75rem] sm:text-[0.8125rem] text-[#8E8E93] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Courses Section — iOS style */}
      <section id="courses" className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title">Chương trình đào tạo</h2>
            <p className="section-subtitle mx-auto">
              Lựa chọn khóa học UAV phù hợp với mục tiêu nghề nghiệp của bạn
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {courses.map((course) => (
              <div
                key={course.id}
                className={`relative bg-white rounded-2xl shadow-ios transition-all duration-200 ${
                  course.highlighted ? 'ring-2 ring-[#FF9500]/50 shadow-ios-md' : ''
                }`}
              >
                {course.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`badge text-white ${course.badgeColor} px-3 py-1 shadow-sm`}>
                      {course.badge}
                    </span>
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <h3 className="text-xl font-semibold text-[#1C1C1E] mb-1">{course.title}</h3>
                  <p className="text-[0.8125rem] text-[#8E8E93] mb-6">{course.subtitle}</p>

                  <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-[#F2F2F7] rounded-xl p-3 text-center">
                      <div className="text-[1.0625rem] font-bold text-[#007AFF]">{course.duration}</div>
                      <div className="text-[0.6875rem] text-[#8E8E93]">Thời lượng</div>
                    </div>
                    <div className="flex-1 bg-[#F2F2F7] rounded-xl p-3 text-center">
                      <div className="text-[1.0625rem] font-bold text-[#5AC8FA]">{course.modules}</div>
                      <div className="text-[0.6875rem] text-[#8E8E93]">Học phần</div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-8">
                    {course.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[0.875rem] text-[#1C1C1E]/80">
                        <CheckCircle className="w-4 h-4 text-[#34C759] flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={user ? (user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student') : '/register'}
                    className={`block text-center py-3 rounded-full font-semibold text-[0.875rem] transition-all duration-200 ${
                      course.highlighted
                        ? 'bg-[#FF9500] text-white hover:bg-[#E68600] shadow-sm'
                        : 'bg-[#F2F2F7] text-[#007AFF] hover:bg-[#007AFF]/10'
                    }`}
                  >
                    Đăng ký ngay
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 sm:py-32">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title">Lợi thế của SMC Training</h2>
            <p className="section-subtitle mx-auto">
              Những lý do để chọn SMC Training cho hành trình trở thành phi công UAV chuyên nghiệp
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {advantages.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-ios group cursor-default transition-all duration-200"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F2F2F7] flex items-center justify-center mb-4 group-hover:bg-[#007AFF]/10 transition-colors">
                  <item.icon className="w-6 h-6 text-[#007AFF]" />
                </div>
                <h3 className="font-semibold text-[#1C1C1E] mb-1.5">{item.title}</h3>
                <p className="text-[0.875rem] text-[#8E8E93] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section — iOS style */}
      <section className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title">Quy trình đào tạo</h2>
            <p className="section-subtitle mx-auto">
              4 bước đơn giản để trở thành phi công UAV được cấp chứng chỉ
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {process.map((p, i) => (
              <div key={i} className="text-center relative">
                {i < process.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-black/10">
                    <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-[#007AFF]" />
                  </div>
                )}
                <div className="w-12 h-12 rounded-full bg-[#007AFF] text-white flex items-center justify-center text-lg font-bold mx-auto mb-4 shadow-[0_4px_12px_rgba(0,122,255,0.25)]">
                  {p.step}
                </div>
                <h3 className="font-semibold text-[#1C1C1E] mb-1.5">{p.title}</h3>
                <p className="text-[0.875rem] text-[#8E8E93]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tin tức — lấy từ hệ thống quản trị bài viết */}
      {news.length > 0 && (
        <section className="py-20 sm:py-32">
          <div className="page-container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="section-title">Tin tức & Sự kiện</h2>
              <p className="section-subtitle mx-auto">Cập nhật mới nhất từ SMC Training</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {news.map(p => (
                <Link key={p.id} to={`/tin-tuc/${p.slug || p.id}`} className="card p-5 hover:shadow-ios transition-shadow">
                  {p.coverImage && <img src={p.coverImage} alt="" className="w-full h-36 object-cover rounded-xl mb-4" />}
                  <h3 className="font-semibold text-[#1C1C1E] mb-2 line-clamp-2">{p.title}</h3>
                  {p.excerpt && <p className="text-[0.875rem] text-[#8E8E93] line-clamp-2">{p.excerpt}</p>}
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/tin-tuc" className="inline-flex items-center gap-1 text-[#007AFF] font-medium hover:underline">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Video — lấy từ hệ thống quản trị tư liệu (category "videos") */}
      <section className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="section-title">Video</h2>
            <p className="section-subtitle mx-auto">Video hoạt động đào tạo và hướng dẫn của SMC Training</p>
          </div>

          {videos.length === 0 ? (
            <div className="max-w-3xl mx-auto text-center py-8">
              <Video className="w-14 h-14 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Video sẽ được cập nhật tại đây.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {videos.map(v => {
                const yt = youtubeId(v.description);
                return (
                  <div key={v.id} className="bg-white rounded-2xl p-4 shadow-ios">
                    {yt ? (
                      <div className="aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${yt}`}
                          title={v.title || v.name}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <video controls className="w-full aspect-video rounded-xl bg-black" src={apiFileUrl(v.id)} />
                    )}
                    <h3 className="font-semibold text-[#1C1C1E] mt-3 text-center">{v.title || v.name}</h3>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section — iOS style */}
      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#007AFF] to-[#0062CC]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)]" />

        <div className="page-container relative z-10 text-center">
          <h2 className="text-[1.75rem] sm:text-[2.25rem] font-bold text-white mb-4 tracking-tight">
            Sẵn sàng trở thành phi công UAV chuyên nghiệp?
          </h2>
          <p className="text-[1.0625rem] text-white/70 max-w-xl mx-auto mb-8">
            Đăng ký ngay hôm nay để bắt đầu hành trình chinh phục bầu trời cùng SMC Training
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {user ? (
              <Link to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'} className="px-8 py-3.5 bg-white text-[#007AFF] font-semibold rounded-full hover:bg-white/90 transition-colors shadow-ios-md">
                Vào hệ thống
              </Link>
            ) : (
              <>
                <Link to="/register" className="px-8 py-3.5 bg-white text-[#007AFF] font-semibold rounded-full hover:bg-white/90 transition-colors shadow-ios-md">
                  Đăng ký khóa học
                </Link>
                <Link to="/login" className="px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-full hover:bg-white/10 transition-colors">
                  Đăng nhập
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
