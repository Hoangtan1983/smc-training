import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu, X, Home, ClipboardCheck, Trophy } from 'lucide-react';

export default function ExamLayout() {
  const { user, logout, ROLE_LABELS } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="SMC Training" className="h-8 w-auto" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500 uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              Thi sát hạch
            </div>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700">
              <ClipboardCheck className="w-4 h-4" />
              Sát hạch UAV
            </div>
            <p className="text-xs text-gray-400 px-3 mt-4">Tính năng đang phát triển</p>
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-1">
            <Link to="/" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg">
              <Home className="w-4 h-4" />
              Về trang chủ
            </Link>
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h1 className="text-sm font-semibold text-gray-900">Thi sát hạch</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge text-xs ${ROLE_LABELS?.[user?.role]?.badge || 'badge-student'}`}>
                {ROLE_LABELS?.[user?.role]?.label || user?.role}
              </span>
              <div className="w-7 h-7 rounded-full bg-smc-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.fullName?.charAt(0)?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
