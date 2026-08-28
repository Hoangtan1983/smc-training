import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, Phone, Mail } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Trang chủ' },
  { to: '/gioi-thieu', label: 'Giới thiệu' },
  { to: '/hinh-anh', label: 'Hình ảnh' },
  { to: '/video', label: 'Video' },
  { to: '/tin-tuc', label: 'Tin tức & Sự kiện' },
  { to: '/lich-thi', label: 'Lịch thi' },
  { to: '/tra-cuu', label: 'Tra cứu' },
  { to: '/lai-xe', label: 'Đào tạo lái xe' },
];

export default function Layout() {
  const { user, logout, ROLE_LABELS } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50">
        {/* Top utility bar */}
        <div className="hidden md:block bg-[#0B1F3A]">
          <div className="page-container flex items-center justify-between h-8 text-[0.75rem] text-white/85">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> 1900 638939
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> support@smartconnect.com.vn
              </span>
            </div>
            <span className="text-white/60 tracking-wide">Đào tạo UAV • Lái xe A1 & A</span>
          </div>
        </div>

        {/* Main navbar */}
        <div className={`bg-white/95 backdrop-blur border-b transition-shadow duration-200 ${scrolled ? 'shadow-md border-transparent' : 'border-gray-100'}`}>
          <div className="page-container">
            <div className="flex items-center justify-between h-16">
              {/* Logo + brand */}
              <Link to="/" className="flex items-center gap-2.5 shrink-0">
                <img src="/logo.png" alt="SMC Training" className="h-9 w-auto" />
                <div className="leading-tight">
                  <div className="font-bold text-[#0B1F3A] text-sm tracking-tight">SMC TRAINING</div>
                  <div className="text-[0.65rem] text-gray-500">Ứng dụng Công nghệ</div>
                </div>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center gap-5">
                {NAV.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative text-[0.8125rem] font-medium whitespace-nowrap py-1 transition-colors group ${
                      isActive(link.to) ? 'text-[#007AFF]' : 'text-gray-600 hover:text-[#007AFF]'
                    }`}
                  >
                    {link.label}
                    <span className={`absolute left-0 -bottom-0.5 h-[2px] rounded-full bg-[#007AFF] transition-all duration-200 ${isActive(link.to) ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                  </Link>
                ))}
              </nav>

              {/* Right side */}
              <div className="hidden lg:flex items-center gap-3 shrink-0">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link to="/profile" className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-semibold">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left leading-tight">
                        <p className="text-[0.8125rem] font-medium text-gray-800">{user.fullName}</p>
                        <p className="text-[0.6875rem] text-gray-400">{ROLE_LABELS?.[user?.role]?.label || user?.role}</p>
                      </div>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Đăng xuất"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Link to="/login" className="text-[0.8125rem] font-medium text-gray-600 hover:text-[#007AFF] px-3 py-2 transition-colors">
                      Đăng nhập
                    </Link>
                    <Link
                      to="/register"
                      className="inline-flex items-center bg-gradient-to-r from-[#007AFF] to-[#0062CC] text-white text-[0.8125rem] font-semibold px-5 py-2.5 rounded-full shadow-md shadow-[#007AFF]/25 hover:shadow-lg hover:shadow-[#007AFF]/30 transition-all"
                    >
                      Đăng ký ngay
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg animate-slide-down">
            <div className="page-container py-3 space-y-1">
              {NAV.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-[0.9375rem] font-medium transition-colors ${
                    isActive(link.to) ? 'text-[#007AFF] bg-[#007AFF]/8' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-[0.9375rem] font-medium text-[#007AFF] bg-[#007AFF]/8"
                  >
                    Vào hệ thống
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-[0.9375rem] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Tài khoản của tôi
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full text-left px-4 py-2.5 rounded-lg text-[0.9375rem] font-medium text-red-500 hover:bg-red-50"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-lg text-[0.9375rem] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full text-center bg-[#007AFF] text-white font-semibold py-3 rounded-full mt-1"
                  >
                    Đăng ký ngay
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#F2F2F7] text-[#8E8E93] pt-12 pb-8 border-t border-black/5">
        <div className="page-container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <img src="/logo.png" alt="SMC Training" className="h-8 w-auto mb-3 opacity-80" />
              <p className="text-[0.8125rem] text-[#8E8E93] max-w-xs leading-relaxed">
                Trung tâm Đào tạo Ứng dụng Công nghệ SMC — Đơn vị đào tạo phi công UAV theo NĐ 288/2025 & TT 146/2025.
              </p>
            </div>
            <div>
              <h4 className="text-[#1C1C1E] font-semibold mb-3 text-[0.8125rem]">Liên kết nhanh</h4>
              <div className="space-y-2">
                <Link to="/" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Trang chủ</Link>
                <Link to="/gioi-thieu" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Giới thiệu</Link>
                <Link to="/tin-tuc" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Tin tức & Sự kiện</Link>
                <Link to="/lai-xe" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Đào tạo lái xe</Link>
                <Link to="/register" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Đăng ký</Link>
              </div>
            </div>
            <div>
              <h4 className="text-[#1C1C1E] font-semibold mb-3 text-[0.8125rem]">Liên hệ</h4>
              <div className="space-y-2 text-[0.8125rem] text-[#8E8E93]">
                <p>📍 Số 59 Nguyễn Thị Hoa, KP Thanh Bình, Xã Đất Đỏ, TP.HCM</p>
                <p>📞 1900 638939</p>
                <p>✉️ support@smartconnect.com.vn</p>
              </div>
            </div>
            <div>
              <p className="text-[0.6875rem] text-[#AEAEB2] mt-1">Mã số DN: 0315541034-001</p>
            </div>
          </div>
          <div className="border-t border-black/5 pt-6 text-center text-[0.75rem] text-[#AEAEB2]">
            &copy; {new Date().getFullYear()} SMC Training. Tất cả quyền được bảo lưu.
          </div>
        </div>
      </footer>
    </div>
  );
}
