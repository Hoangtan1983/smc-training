import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  School,
  PenTool,
  Monitor,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Home,
  Book,
} from 'lucide-react';

const sidebarLinks = [
  { to: '/dao-tao/giang-vien', icon: Users, label: 'Giáo viên', emoji: '👨‍🏫' },
  { to: '/dao-tao/hoc-vien', icon: GraduationCap, label: 'Học viên', emoji: '🎓' },
  { to: '/dao-tao/khoa-hoc', icon: BookOpen, label: 'Khóa học', emoji: '📚' },
  { to: '/dao-tao/lop-hoc', icon: School, label: 'Lớp học', emoji: '🏫' },
  { to: '/dao-tao/on-luyen', icon: PenTool, label: 'Ôn luyện', emoji: '📝' },
  { to: '/dao-tao/thi-thu', icon: Monitor, label: 'Thi thử', emoji: '🎯' },
  { to: '/dao-tao/tai-lieu', icon: FileText, label: 'Tài liệu', emoji: '📄' },
];

export default function TrainingLayout() {
  const { user, logout, ROLE_LABELS } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="SMC Training" className="h-8 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section Title */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-smc-500 uppercase tracking-wider">
              <Book className="w-3.5 h-3.5" />
              Đào tạo
            </div>
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            {sidebarLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-smc-50 text-smc-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <link.icon className={`w-4 h-4 ${isActive(link.to) ? 'text-smc-500' : 'text-gray-400'}`} />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-100 space-y-1">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg"
            >
              <Home className="w-4 h-4" />
              Về trang chủ
            </Link>
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
              >
                <Shield className="w-4 h-4" />
                Quản trị hệ thống
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg w-full"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-gray-900">Đào tạo</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge text-xs ${ROLE_LABELS?.[user?.role]?.badge || 'badge-student'}`}>
                {ROLE_LABELS?.[user?.role]?.label || user?.role}
              </span>
              <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <div className="w-7 h-7 rounded-full bg-smc-500 flex items-center justify-center text-white text-xs font-bold">
                  {user?.fullName?.charAt(0)?.toUpperCase()}
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
