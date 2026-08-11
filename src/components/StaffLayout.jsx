import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, UserCheck, BookOpen, School,
  GraduationCap, Users, Award, BarChart3,
  CreditCard, FileText, UserPlus, RefreshCw,
  Building2, ClipboardList, Menu, X, LogOut, Settings,
} from 'lucide-react';

const sidebarItems = [
  { to: '/staff', icon: LayoutDashboard, label: 'Tổng quan', end: true },
  { section: 'Quản lý' },
  { to: '/staff/tuyen-sinh', icon: UserCheck, label: 'Tuyển sinh' },
  { to: '/staff/khoa-hoc', icon: BookOpen, label: 'Khóa học' },
  { to: '/staff/lop-hoc', icon: School, label: 'Lớp học' },
  { to: '/staff/hoc-vien', icon: GraduationCap, label: 'Học viên' },
  { to: '/staff/giang-vien', icon: Users, label: 'Giảng viên' },
  { to: '/staff/dai-ly', icon: Building2, label: 'Đại lý' },
  { section: 'Phê duyệt & Tài chính' },
  { to: '/staff/duyet-tai-khoan', icon: UserPlus, label: 'Duyệt tài khoản' },
  { to: '/staff/hoc-phi', icon: CreditCard, label: 'Học phí' },
  { to: '/staff/thanh-toan', icon: CreditCard, label: 'Thanh toán' },
  { to: '/staff/doi-lop-bao-luu', icon: RefreshCw, label: 'Đổi lớp/Bảo lưu' },
  { section: 'Hồ sơ' },
  { to: '/staff/chung-chi', icon: Award, label: 'Chứng chỉ' },
  { to: '/staff/tai-lieu', icon: FileText, label: 'Tài liệu' },
  { to: '/staff/hoc-vien-quan-ly', icon: ClipboardList, label: 'QL Học viên' },
  { section: 'Hệ thống' },
  { to: '/staff/bao-cao', icon: BarChart3, label: 'Báo cáo' },
];

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <img src="/logo.png" alt="SMC" className="h-8 w-auto" />
          <span className="text-lg font-extrabold text-gray-900 tracking-tight">SMC Nhân viên</span>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item, idx) => {
            if (item.section) {
              return <div key={`section-${idx}`} className="sidebar-section">{item.section}</div>;
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
              >
                <item.icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <NavLink to="/staff/tai-khoan" onClick={() => setSidebarOpen(false)} className="sidebar-link">
            <Settings className="w-4.5 h-4.5" />
            <span>Tài khoản</span>
          </NavLink>
          <button onClick={logout} className="sidebar-link w-full text-left text-ios-red hover:bg-red-50 hover:text-red-700">
            <LogOut className="w-4.5 h-4.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-ios-lg hover:bg-gray-100 text-gray-500">
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

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
