import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';

const ROLE_REDIRECT = {
  ADMIN: '/admin',
  STAFF: '/staff',
  TEACHER: '/teacher',
  STUDENT: '/student',
  AGENCY: '/agency',
  ACCOUNTANT: '/accountant',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập email/số điện thoại và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      const user = res.user || res.data?.user || res.data;
      const role = (user && user.role) ? user.role : (res.data && res.data.role) ? res.data.role : null;
      const redirectPath = role ? ROLE_REDIRECT[role] : '/';
      toast.success('Đăng nhập thành công!');
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const message = err.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-smc-600 via-smc-700 to-smc-900 px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-smc-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-accent-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-xl flex items-center justify-center mx-auto mb-4 shadow-ios-lg ring-1 ring-white/10">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SMC Training</h1>
          <p className="text-sm text-white/60 mt-1">Trung tâm Đào tạo Phi công UAV</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-ios-3xl shadow-ios-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Đăng nhập</h2>

          {error && (
            <div className="mb-6 p-3.5 bg-ios-red/8 border border-ios-red/20 rounded-ios-xl text-sm text-ios-red flex items-start gap-2.5">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Identifier */}
            <div>
              <label className="input-label" htmlFor="identifier">
                Email hoặc Số điện thoại
              </label>
              <input
                id="identifier"
                className="input-field"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="example@email.com"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="input-label" htmlFor="password">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="input-field pr-11"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <div className="spinner spinner-sm" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              to="/forgot-password"
              className="text-smc-600 hover:text-smc-700 font-medium transition-colors"
            >
              Quên mật khẩu?
            </Link>
            <Link
              to="/register"
              className="text-smc-600 hover:text-smc-700 font-medium transition-colors"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </div>

        {/* Legal text */}
        <p className="text-center text-xs text-white/40 mt-6">
          Tuân thủ Nghị định 288/2025/NĐ-CP & Thông tư 146/2025/TT-BQP
        </p>
      </div>
    </div>
  );
}
