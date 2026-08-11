import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, School,
  UserCheck, ClipboardCheck, Award, BarChart3, Settings,
  CreditCard, RefreshCw, Building2, Menu, X, LogOut, ChevronDown,
} from 'lucide-react';

const sidebarItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tổng quan', end: true },
  { section: 'Quản lý' },
  { to: '/admin/nguoi-dung', icon: Users, label: 'Người dùng' },
  { to: '/admin/tuyen-sinh', icon: UserCheck, label: 'Tuyển sinh' },
  { to: '/admin/khoa-hoc', icon: BookOpen, label: 'Khóa học' },
  { to: '/admin/lop-hoc', icon: School, label: 'Lớp học' },
  { to: '/admin/hoc-vien', icon: GraduationCap, label: 'Học viên' },
  { to: '/admin/giang-vien', icon: Users, label: 'Giảng viên' },
  { to: '/admin/dai-ly', icon: Building2, label: 'Đại lý' },
  { section: 'Đào tạo & Sát hạch' },
  { to: '/admin/sat-hach', icon: ClipboardCheck, label: 'Sát hạch' },
  { to: '/admin/chung-chi', icon: Award, label: 'Chứng chỉ' },
  { section: 'Tài chính' },
  { to: '/admin/hoc-phi', icon: CreditCard, label: 'Học phí' },
  { section: 'Hệ thống' },
  { to: '/admin/doi-lop-bao-luu', icon: RefreshCw, label: 'Đổi lớp/Bảo lưu' },
  { to: '/admin/bao-cao', icon: BarChart3, label: 'Báo cáo' },
  { to: '/admin/cai-dat', icon: Settings, label: 'Cài đặt' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const roleLabels = {
    ADMIN: 'Quản trị viên',
    STAFF: 'Nhân viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học viên',
    AGENCY: 'Đại lý',
    ACCOUNTANT: 'Kế toán',
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <img src="/logo.png" alt="SMC" className="h-8 w-auto" />
          <span className="text-lg font-extrabold text-gray-900 tracking-tight">SMC Quản trị</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item, idx) => {
            if (item.section) {
              return (
                <div key={`section-${idx}`} className="sidebar-section">
                  {item.section}
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link-active' : 'sidebar-link'
                }
              >
                <item.icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-100">
          <NavLink
            to="/admin/tai-khoan"
            onClick={() => setSidebarOpen(false)}
            className="sidebar-link"
          >
            <Settings className="w-4.5 h-4.5" />
            <span>Tài khoản</span>
          </NavLink>
          <button
            onClick={logout}
            className="sidebar-link w-full text-left text-ios-red hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-ios-lg hover:bg-gray-100 text-gray-500"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.fullName || user?.full_name || user?.name || ''}</p>
              <p className="text-xs text-gray-500">{roleLabels[user?.role] || user?.role || ''}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-smc-500 flex items-center justify-center text-white text-sm font-bold">
              {(user?.fullName || user?.full_name || user?.name || 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
