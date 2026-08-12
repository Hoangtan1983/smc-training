import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, Home, ChevronRight } from 'lucide-react';

export default function SidebarLayout({ title, icon: IconComponent, iconColor, links, bottomLinks }) {
  const { user, logout, ROLE_LABELS } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path) => {
    if (path === '/') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Overlay — iOS style */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Dark mode (giữ nguyên phong cách tối cũ) */}
      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-slate-900 text-gray-300 z-50 transform transition-transform duration-300 ease-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SMC Training" className="h-8 w-auto brightness-0 invert" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section label */}
        <div className="px-4 pt-5 pb-2">
          <div className={`flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-widest ${iconColor || 'text-[#007AFF]'}`}>
            {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
            {title}
          </div>
        </div>

        {/* Nav — Dark mode */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.9375rem] font-medium transition-all duration-150 ${
                isActive(link.to)
                  ? 'bg-blue-600/20 text-white'
                  : 'text-gray-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {link.icon && (
                <link.icon className={`w-4 h-4 flex-shrink-0 ${isActive(link.to) ? 'text-blue-400' : ''}`} />
              )}
              <span className="flex-1">{link.label}</span>
              {link.badge && (
                <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer — Dark mode */}
        <div className="p-4 border-t border-slate-700/80 space-y-1">
          {bottomLinks?.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 rounded-lg"
            >
              {link.icon && <link.icon className="w-4 h-4" />}
              {link.label}
            </Link>
          ))}
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 rounded-lg"
          >
            <Home className="w-4 h-4" /> Về trang chủ
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg w-full"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[280px]">
        {/* Top Header — iOS-style */}
        <header
          className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-b border-black/5"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between h-12 sm:h-14 px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-[#1C1C1E] hover:bg-black/5 rounded-full transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                {IconComponent && <IconComponent className={`w-4 h-4 ${iconColor || 'text-[#007AFF]'}`} />}
                <h1 className="text-[0.9375rem] font-semibold text-[#1C1C1E]">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge text-[0.6875rem] ${ROLE_LABELS[user?.role]?.badge || 'badge-student'}`}>
                {ROLE_LABELS[user?.role]?.label || user?.role}
              </span>
              <Link
                to="/profile"
                className="w-7 h-7 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-semibold"
              >
                {user?.fullName?.charAt(0)?.toUpperCase()}
              </Link>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
