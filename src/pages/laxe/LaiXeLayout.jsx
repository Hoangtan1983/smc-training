import { NavLink, Link, Outlet } from 'react-router-dom';
import { Bike, Phone } from 'lucide-react';

const links = [
  { to: '/lai-xe', label: 'Giới thiệu', end: true },
  { to: '/lai-xe/hang-a1', label: 'Hạng A1' },
  { to: '/lai-xe/hang-a', label: 'Hạng A' },
  { to: '/lai-xe/dang-ky', label: 'Đăng ký' },
];

// Khu vực đào tạo lái xe — tách biệt hoàn toàn với UAV, dùng màu xanh lá riêng.
export default function LaiXeLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7]">
      <header className="bg-white border-b border-black/5">
        <div className="page-container flex items-center justify-between py-4">
          <Link to="/lai-xe" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-[#1C1C1E] leading-tight">Đào tạo Lái xe SMC</div>
              <div className="text-[0.75rem] text-[#8E8E93]">Hạng A1 & Hạng A</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full text-[0.875rem] font-medium transition-colors ${isActive ? 'bg-green-600 text-white' : 'text-[#1C1C1E] hover:bg-black/5'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <Link to="/" className="text-[0.8125rem] font-medium text-[#8E8E93] hover:text-[#1C1C1E] whitespace-nowrap">
            ← Về SMC Training
          </Link>
        </div>

        <div className="md:hidden page-container pb-3 flex gap-1 overflow-x-auto">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-full text-[0.8125rem] font-medium ${isActive ? 'bg-green-600 text-white' : 'bg-black/5 text-[#1C1C1E]'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-black/5 mt-auto">
        <div className="page-container py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-[#8E8E93]">Đào tạo lái xe SMC — Hạng A1 & Hạng A • Luật Trật tự, an toàn giao thông đường bộ (36/2024/QH15)</p>
          <p className="text-sm text-[#8E8E93] flex items-center gap-1.5">
            <Phone className="w-4 h-4" /> Hotline: 1900 638939
          </p>
        </div>
      </footer>
    </div>
  );
}
