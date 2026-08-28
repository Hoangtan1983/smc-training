import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGetPosts, apiGetFiles, apiFileUrl } from '../data/api';
import {
  Shield, Users, Wrench, Award, Target, HeadphonesIcon, CheckCircle, ArrowRight, Star, Video,
  Quote, ChevronDown, BadgeCheck, Phone,
} from 'lucide-react';

const stats = [
  { value: 1000, suffix: '+', label: 'Học viên & tài khoản' },
  { value: 2, suffix: '', label: 'Hạng chứng chỉ UAV' },
  { value: 140, suffix: 'h', label: 'Chương trình VLOS' },
  { value: 296, suffix: 'h', label: 'Chương trình BVLOS' },
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
  { icon: Award, title: '2 Hạng chứng chỉ', desc: 'VLOS (140h) và BVLOS (296h) chuẩn theo quy định' },
  { icon: Target, title: 'Thực hành trọng tâm', desc: '60% thời lượng là thực hành bay thực tế' },
  { icon: HeadphonesIcon, title: 'Hỗ trợ sau khóa học', desc: 'Kết nối việc làm, hỗ trợ kỹ thuật sau chứng chỉ' },
];

const process = [
  { step: 1, title: 'Đăng ký', desc: 'Điền form đăng ký và chọn khóa học phù hợp' },
  { step: 2, title: 'Học lý thuyết', desc: 'Hoàn thành các học phần lý thuyết trực tuyến & trực tiếp' },
  { step: 3, title: 'Thực hành bay', desc: 'Thực hành bay thực tế tại sân bay & phòng mô phỏng' },
  { step: 4, title: 'Sát hạch & Chứng chỉ', desc: 'Thi sát hạch cuối khóa & nhận chứng chỉ chính thức' },
];

const testimonials = [
  { name: 'Nguyễn Văn An', role: 'Học viên Hạng A — VLOS', quote: 'Khóa học bài bản, giảng viên tận tâm. Mình tự tin hơn rất nhiều khi vận hành UAV.', avatar: 'A', color: 'bg-blue-500' },
  { name: 'Trần Thị Bình', role: 'Học viên Hạng B — BVLOS', quote: 'Lộ trình rõ ràng, thực hành nhiều. Trung tâm hỗ trợ tận tình từ lúc đăng ký đến khi thi.', avatar: 'B', color: 'bg-amber-500' },
  { name: 'Lê Văn Cường', role: 'Học viên lái xe A1', quote: 'Hồ sơ gọn, thầy hướng dẫn dễ hiểu. Đã thi đậu ngay lần đầu.', avatar: 'C', color: 'bg-green-600' },
];

const faqs = [
  { q: 'Điều kiện để học UAV Hạng A là gì?', a: 'Học viên cần đủ tuổi theo quy định và có đầy đủ giấy tờ tùy thân. Trung tâm sẽ hỗ trợ kiểm tra điều kiện và hoàn thiện hồ sơ trước khi nhập học.' },
  { q: 'Thời gian học kéo dài bao lâu?', a: 'Hạng A — VLOS khoảng 140 giờ, Hạng B — BVLOS khoảng 296 giờ, kết hợp lý thuyết và thực hành. Lịch học linh hoạt theo lớp.' },
  { q: 'Có hỗ trợ thủ tục thi sát hạch không?', a: 'Có. Trung tâm hỗ trợ đăng ký hồ sơ, lịch thi sát hạch và hướng dẫn chuẩn bị cho kỳ thi.' },
  { q: 'Học lái xe A1/A cần những giấy tờ gì?', a: 'Chứng minh nhân dân/Căn cước công dân và ảnh thẻ. Vui lòng liên hệ hotline để được hướng dẫn chi tiết theo từng hạng bằng.' },
];

// Đếm số chạy khi phần tử hiện ra
function Counter({ target, suffix = '', duration = 1400 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min((now - t0) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{value}{suffix}</span>;
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-ios overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="font-semibold text-[#1C1C1E]">{q}</span>
        <ChevronDown className={`w-5 h-5 text-[#007AFF] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-5 text-[0.875rem] text-[#8E8E93] leading-relaxed">{a}</p>}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [videos, setVideos] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [heroImage, setHeroImage] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetPosts({ type: 'article' });
        setNews((Array.isArray(data) ? data : []).slice(0, 3));
      } catch { setNews([]); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetFiles('videos');
        setVideos(Array.isArray(data) ? data : []);
      } catch { setVideos([]); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetFiles('public-images');
        const imgs = (Array.isArray(data) ? data : []).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f.name || ''));
        setGallery(imgs);
        const hero = imgs.find(f => /thực hành điều khiển|hero/i.test(f.title || '')) || imgs[0];
        if (hero) setHeroImage(apiFileUrl(hero.id));
      } catch { setGallery([]); }
    })();
  }, []);

  const youtubeId = (url) => {
    if (!url) return null;
    const m = String(url).match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : null;
  };

  return (
    <div>
      {/* Hero — ảnh nền + lớp phủ xanh đậm */}
      <section className="relative min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-6rem)] flex items-center overflow-hidden">
        {heroImage ? (
          <>
            <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/80 to-[#007AFF]/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B1F3A] via-[#0E2A4E] to-[#007AFF]" />
        )}

        <div className="page-container relative z-10 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-[0.75rem] font-semibold mb-6 backdrop-blur">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              Hoạt động theo Nghị định 288/2025 & Thông tư 146/2025
            </div>

            <h1 className="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] font-bold text-white leading-[1.08] tracking-tight animate-fade-in">
              Trung tâm Đào tạo
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5AC8FA] to-[#34C759]">
                Ứng dụng Công nghệ SMC
              </span>
            </h1>

            <p className="mt-6 text-[1.0625rem] sm:text-[1.125rem] text-white/80 max-w-2xl leading-relaxed animate-fade-in">
              Chương trình đào tạo phi công UAV chuyên nghiệp — chứng chỉ UAV Hạng A (VLOS) và Hạng B (BVLOS).
              Đồng hành cùng lộ trình đào tạo lái xe A1 & A.
            </p>

            <div className="mt-10 flex flex-wrap gap-4 animate-slide-up">
              {user ? (
                <Link to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'} className="bg-white text-[#007AFF] text-base px-8 py-3 inline-flex items-center gap-2 rounded-full font-semibold shadow-lg hover:bg-white/90 transition-colors">
                  Vào hệ thống
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="bg-gradient-to-r from-[#007AFF] to-[#0062CC] text-white text-base px-8 py-3 inline-flex items-center gap-2 rounded-full font-semibold shadow-lg shadow-[#007AFF]/30 hover:shadow-xl transition-all">
                    Đăng ký khóa học
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/login" className="border-2 border-white/40 text-white text-base px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition-colors">
                    Đăng nhập hệ thống
                  </Link>
                </>
              )}
            </div>

            {/* Stats — đếm số chạy */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/15 animate-slide-up">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-[1.75rem] sm:text-[2rem] font-bold text-white">
                    <Counter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-[0.75rem] sm:text-[0.8125rem] text-white/70 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title">Chương trình đào tạo</h2>
            <p className="section-subtitle mx-auto">Lựa chọn khóa học UAV phù hợp với mục tiêu nghề nghiệp của bạn</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {courses.map((course) => (
              <div
                key={course.id}
                className={`relative bg-white rounded-2xl shadow-ios transition-all duration-300 hover:-translate-y-1.5 hover:shadow-ios-md ${
                  course.highlighted ? 'ring-2 ring-[#FF9500]/50' : ''
                }`}
              >
                {course.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`badge text-white ${course.badgeColor} px-3 py-1 shadow-sm`}>{course.badge}</span>
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
                      course.highlighted ? 'bg-[#FF9500] text-white hover:bg-[#E68600] shadow-sm' : 'bg-[#F2F2F7] text-[#007AFF] hover:bg-[#007AFF]/10'
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

      {/* Advantages — nền xanh đậm cho tương phản */}
      <section className="py-20 sm:py-32 bg-[#0B1F3A]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title text-white">Lợi thế của SMC Training</h2>
            <p className="section-subtitle mx-auto text-white/60">Những lý do để chọn SMC Training cho hành trình trở thành phi công UAV chuyên nghiệp</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {advantages.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 group">
                <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/15 flex items-center justify-center mb-4 group-hover:bg-[#007AFF]/25 transition-colors">
                  <item.icon className="w-6 h-6 text-[#5AC8FA]" />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{item.title}</h3>
                <p className="text-[0.875rem] text-white/60 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 sm:py-32">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="section-title">Quy trình đào tạo</h2>
            <p className="section-subtitle mx-auto">4 bước đơn giản để trở thành phi công UAV được cấp chứng chỉ</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {process.map((p, i) => (
              <div key={i} className="text-center relative">
                {i < process.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-black/10">
                    <div className="absolute right-0 -top-1 w-2 h-2 rounded-full bg-[#007AFF]" />
                  </div>
                )}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#007AFF] to-[#0062CC] text-white flex items-center justify-center text-lg font-bold mx-auto mb-4 shadow-[0_4px_12px_rgba(0,122,255,0.35)]">
                  {p.step}
                </div>
                <h3 className="font-semibold text-[#1C1C1E] mb-1.5">{p.title}</h3>
                <p className="text-[0.875rem] text-[#8E8E93]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="section-title">Học viên nói gì</h2>
            <p className="section-subtitle mx-auto">Trải nghiệm thực tế từ học viên tại SMC Training</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-ios flex flex-col">
                <Quote className="w-6 h-6 text-[#007AFF]/30 mb-3" />
                <p className="text-[0.9375rem] text-[#1C1C1E]/80 leading-relaxed flex-1">“{t.quote}”</p>
                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-black/5">
                  <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white font-semibold`}>{t.avatar}</div>
                  <div>
                    <div className="font-semibold text-[#1C1C1E] text-sm">{t.name}</div>
                    <div className="text-[0.75rem] text-[#8E8E93]">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tin tức */}
      {news.length > 0 && (
        <section className="py-20 sm:py-32">
          <div className="page-container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="section-title">Tin tức & Sự kiện</h2>
              <p className="section-subtitle mx-auto">Cập nhật mới nhất từ SMC Training</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {news.map(p => (
                <Link key={p.id} to={`/tin-tuc/${p.slug || p.id}`} className="bg-white rounded-2xl p-5 shadow-ios hover:-translate-y-1 transition-all duration-300">
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

      {/* Video */}
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
                        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title={v.title || v.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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

      {/* Ảnh hoạt động + chứng nhận */}
      {gallery.length > 0 && (
        <section className="py-20 sm:py-32">
          <div className="page-container">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="section-title">Hoạt động tại SMC Training</h2>
              <p className="section-subtitle mx-auto">Hình ảnh đào tạo và hoạt động thực tế</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {gallery.map(img => (
                <img key={img.id} src={apiFileUrl(img.id)} alt={img.title || img.name} className="w-full aspect-square object-cover rounded-2xl shadow-ios hover:scale-[1.02] transition-transform" loading="lazy" />
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF]/8 text-[#007AFF] rounded-full text-[0.8125rem] font-semibold">
                <BadgeCheck className="w-4 h-4" /> Nghị định 288/2025/NĐ-CP
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF]/8 text-[#007AFF] rounded-full text-[0.8125rem] font-semibold">
                <BadgeCheck className="w-4 h-4" /> Thông tư 146/2025/TT-BQP
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-[0.8125rem] font-semibold">
                <BadgeCheck className="w-4 h-4" /> Đào tạo lái xe A1 & A
              </span>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-20 sm:py-32 bg-[#F2F2F7]">
        <div className="page-container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="section-title">Câu hỏi thường gặp</h2>
            <p className="section-subtitle mx-auto">Giải đáp nhanh những thắc mắc thường gặp</p>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* CTA */}
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
          <p className="mt-6 text-white/70 text-sm flex items-center justify-center gap-1.5">
            <Phone className="w-4 h-4" /> Hotline: 1900 638939
          </p>
        </div>
      </section>
    </div>
  );
}
