import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      const dest = user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'ACCOUNTANT' ? '/accountant' : user.role === 'TEACHER' ? '/teacher' : user.role === 'AGENCY' ? '/agency' : '/student';
      navigate(dest);
    } catch (err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] py-12 px-4 safe-top safe-bottom">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo + Header — iOS style */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img src="/logo.png" alt="SMC Training" className="h-12 w-auto mx-auto" />
          </Link>
          <h1 className="text-[1.75rem] font-bold text-[#1C1C1E] tracking-tight">Đăng nhập</h1>
          <p className="text-[0.9375rem] text-[#8E8E93] mt-1">Hệ thống Quản lý Đào tạo UAV — SMC Training</p>
        </div>

        {/* Card — iOS style */}
        <div className="bg-white rounded-2xl px-6 py-8 shadow-ios">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[0.8125rem] font-medium text-[#1C1C1E] mb-1.5">Số điện thoại / Email</label>
              <input
                type="text"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="input-field"
                placeholder="Nhập số điện thoại hoặc email"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-[0.8125rem] font-medium text-[#1C1C1E] mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="input-field pr-10"
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#1C1C1E] p-1"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 text-[1rem] mt-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        {/* Footer info — iOS style */}
        <div className="mt-6 text-center text-[0.75rem] text-[#8E8E93] space-y-1">
          <Link to="/tra-cuu-chung-chi" className="text-[#007AFF] hover:underline">
            Tra cứu chứng chỉ UAV
          </Link>
          <p>Trung tâm Đào tạo Ứng dụng Công nghệ SMC</p>
          <p>Hoạt động theo NĐ 288/2025/NĐ-CP & TT 146/2025/TT-BQP</p>
          <p>Số 59 Nguyễn Thị Hoa, KP Thanh Bình, Xã Đất Đỏ, TP.HCM</p>
        </div>
      </div>
    </div>
  );
}
