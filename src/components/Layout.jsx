import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, ChevronDown, LogOut, User, LayoutDashboard } from 'lucide-react';

export default function Layout() {
  const { user, logout, ROLE_LABELS } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar — iOS style */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || !isHome
            ? 'bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-b border-black/5'
            : 'bg-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="page-container">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 group"
            >
              <img src="/logo.png" alt="SMC Training" className="h-8 sm:h-9 w-auto" />
              <span className="text-xs sm:text-sm font-semibold text-[#007AFF] tracking-tight">SMC TRAINING</span>
            </Link>

            {/* Desktop Nav — iOS style */}
            <div className="hidden lg:flex items-center gap-1">
              {[
                { to: '/', label: 'Trang chủ' },
                { to: '/gioi-thieu', label: 'Giới thiệu' },
                { to: '/hinh-anh', label: 'Hình ảnh' },
                { to: '/tin-tuc', label: 'Tin tức & Sự kiện' },
                { to: '/lich-thi', label: 'Lịch thi' },
                { to: '/tra-cuu', label: 'Tra cứu' },
              ].map(link => (
                <Link key={link.to} to={link.to}
                  className={`text-[0.8125rem] font-medium px-3 py-1.5 rounded-full transition-colors duration-200 ${
                    location.pathname === link.to
                      ? 'text-[#007AFF] bg-[#007AFF]/8'
                      : 'text-[#1C1C1E] hover:text-[#007AFF] hover:bg-[#007AFF]/5'
                  }`}>
                  {link.label}
                </Link>
              ))}
              {user && (
                <Link
                  to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'}
                  className="text-[0.8125rem] font-medium px-3 py-1.5 rounded-full text-[#007AFF] bg-[#007AFF]/8 hover:bg-[#007AFF]/12 transition-colors"
                >
                  Vào hệ thống
                </Link>
              )}
            </div>

            {/* Desktop Right — iOS style */}
            <div className="hidden lg:flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-black/5 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-semibold">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-[0.8125rem] font-medium text-[#1C1C1E] leading-tight">{user.fullName}</p>
                      <p className="text-[0.6875rem] text-[#8E8E93]">{ROLE_LABELS?.[user?.role]?.label || user?.role}</p>
                    </div>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-red-50 rounded-full transition-colors"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost text-[0.8125rem] py-1.5">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="btn-primary text-[0.8125rem] py-1.5 px-4">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button — iOS style */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-[#1C1C1E] hover:bg-black/5 rounded-full transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu — iOS Sheet style */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-black/5 bg-white animate-slide-down">
            <div className="page-container py-3 space-y-0.5">
              {[
                { to: '/', label: 'Trang chủ' },
                { to: '/gioi-thieu', label: 'Giới thiệu' },
                { to: '/hinh-anh', label: 'Hình ảnh' },
                { to: '/tin-tuc', label: 'Tin tức & Sự kiện' },
                { to: '/lich-thi', label: 'Lịch thi' },
                { to: '/tra-cuu', label: 'Tra cứu' },
              ].map(link => (
                <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-[0.9375rem] font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'text-[#007AFF] bg-[#007AFF]/8'
                      : 'text-[#1C1C1E] hover:bg-black/5'
                  }`}>
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'TEACHER' ? '/teacher' : '/student'}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-[0.9375rem] font-medium text-[#007AFF] bg-[#007AFF]/8"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-[0.9375rem] font-medium text-[#1C1C1E] hover:bg-black/5"
                  >
                    Tài khoản của tôi
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="w-full text-left px-4 py-2.5 rounded-xl text-[0.9375rem] font-medium text-[#FF3B30] hover:bg-red-50"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-[0.9375rem] font-medium text-[#1C1C1E] hover:bg-black/5"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full text-center btn-primary mt-1"
                  >
                    Đăng ký khóa học
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className={isHome ? '' : 'pt-12 sm:pt-14'}>
        <Outlet />
      </main>

      {/* Footer — iOS style */}
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
                <Link to="/login" className="block text-[0.8125rem] text-[#8E8E93] hover:text-[#007AFF] transition-colors">Đăng nhập</Link>
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
