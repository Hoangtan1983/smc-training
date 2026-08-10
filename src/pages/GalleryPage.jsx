import { useState } from 'react';
import { Image, ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'theory', label: 'Lý thuyết' },
  { key: 'practice', label: 'Thực hành' },
  { key: 'events', label: 'Sự kiện' },
];

const galleryItems = [
  {
    id: 1,
    category: 'theory',
    title: 'Lớp học lý thuyết UAV',
    gradient: 'from-smc-400 to-smc-600',
  },
  {
    id: 2,
    category: 'practice',
    title: 'Thực hành bay VLOS',
    gradient: 'from-accent-400 to-accent-600',
  },
  {
    id: 3,
    category: 'events',
    title: 'Lễ khai giảng khóa mới',
    gradient: 'from-ios-purple to-ios-pink',
  },
  {
    id: 4,
    category: 'theory',
    title: 'Học viên nghiên cứu tài liệu',
    gradient: 'from-smc-500 to-smc-700',
  },
  {
    id: 5,
    category: 'practice',
    title: 'Bay thực địa BVLOS',
    gradient: 'from-ios-teal to-ios-green',
  },
  {
    id: 6,
    category: 'events',
    title: 'Trao chứng chỉ tốt nghiệp',
    gradient: 'from-ios-orange to-ios-red',
  },
  {
    id: 7,
    category: 'theory',
    title: 'Phòng học mô phỏng',
    gradient: 'from-smc-300 to-smc-500',
  },
  {
    id: 8,
    category: 'practice',
    title: 'Kiểm tra bay thực tế',
    gradient: 'from-accent-300 to-accent-500',
  },
  {
    id: 9,
    category: 'events',
    title: 'Hội thảo công nghệ UAV',
    gradient: 'from-ios-purple to-smc-500',
  },
];

const LARGE_INDICES = [0, 3, 5, 7];

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState('all');

  const filtered =
    activeTab === 'all'
      ? galleryItems
      : galleryItems.filter((item) => item.category === activeTab);

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
            <span className="text-white/90 font-medium">Hình ảnh</span>
          </nav>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Thư viện hình ảnh
          </h1>
          <p className="text-white/60 mt-3 max-w-xl leading-relaxed">
            Khoảnh khắc tại SMC Training — nơi ghi lại hành trình đào tạo phi công UAV chuyên nghiệp.
          </p>
        </div>
      </section>

      {/* Filter tabs */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="tab-bar max-w-md mx-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-item flex-1 text-center ${activeTab === tab.key ? 'tab-item-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery grid */}
      <section className="pb-16 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filtered.length === 0 ? (
            <div className="empty-state py-20">
              <Image className="empty-state-icon" />
              <p className="empty-state-text">Chưa có hình ảnh</p>
              <p className="empty-state-sub">Thư viện ảnh đang được cập nhật. Vui lòng quay lại sau.</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {filtered.map((item) => {
                const isLarge = LARGE_INDICES.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`break-inside-avoid rounded-ios-2xl bg-gradient-to-br ${item.gradient} overflow-hidden shadow-ios-md hover:shadow-ios-lg transition-shadow duration-300 group cursor-pointer`}
                  >
                    <div className={`relative ${isLarge ? 'aspect-[4/5]' : 'aspect-[4/3]'} flex items-center justify-center`}>
                      {/* Placeholder illustration */}
                      <div className="absolute inset-0 bg-black/10" />
                      <Image className="w-10 h-10 text-white/30 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="p-4 bg-white/10 backdrop-blur-sm">
                      <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
                      <span className="text-xs text-white/50 mt-1 inline-block capitalize">
                        {item.category === 'theory' ? 'Lý thuyết' : item.category === 'practice' ? 'Thực hành' : 'Sự kiện'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
