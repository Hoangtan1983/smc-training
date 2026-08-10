import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../data/api';
import toast from 'react-hot-toast';
import { UserPlus, Shield, Eye, EyeOff, Mail, Phone, Lock, User } from 'lucide-react';

const INITIAL_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const INITIAL_ERRORS = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

function validate(form) {
  const errors = { ...INITIAL_ERRORS };

  if (!form.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ và tên.';
  }

  if (!form.email.trim()) {
    errors.email = 'Vui lòng nhập email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Email không đúng định dạng.';
  }

  if (!form.phone.trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại.';
  } else if (!/^[0-9]{10,11}$/.test(form.phone.trim())) {
    errors.phone = 'Số điện thoại không hợp lệ (10-11 chữ số).';
  }

  if (!form.password) {
    errors.password = 'Vui lòng nhập mật khẩu.';
  } else if (form.password.length < 6) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  }

  return errors;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validationErrors = validate(form);
    const hasError = Object.values(validationErrors).some(Boolean);

    if (hasError) {
      setErrors(validationErrors);
      return;
    }

    setErrors(INITIAL_ERRORS);
    setLoading(true);

    try {
      await api.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      navigate('/login', { replace: true });
    } catch (err) {
      const message = err.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (fieldName) =>
    `input-field ${errors[fieldName] ? '!border-ios-red !ring-ios-red/20 focus:!ring-ios-red/20 focus:!border-ios-red' : ''}`;

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
          <p className="text-sm text-white/60 mt-1">Tạo tài khoản học viên mới</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-ios-3xl shadow-ios-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Đăng ký</h2>

          {formError && (
            <div className="mb-6 p-3.5 bg-ios-red/8 border border-ios-red/20 rounded-ios-xl text-sm text-ios-red flex items-start gap-2.5">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label className="input-label" htmlFor="fullName">Họ và tên</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="fullName"
                  className={`${fieldClass('fullName')} pl-10`}
                  type="text"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  placeholder="Nguyễn Văn A"
                  disabled={loading}
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-ios-red mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="input-label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  className={`${fieldClass('email')} pl-10`}
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="example@email.com"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-ios-red mt-1">{errors.email}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="input-label" htmlFor="phone">Số điện thoại</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="phone"
                  className={`${fieldClass('phone')} pl-10`}
                  type="tel"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  placeholder="0912345678"
                  disabled={loading}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-ios-red mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="input-label" htmlFor="password">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  className={`${fieldClass('password')} pl-10 pr-11`}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="Ít nhất 6 ký tự"
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
              {errors.password && (
                <p className="text-xs text-ios-red mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="input-label" htmlFor="confirmPassword">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="confirmPassword"
                  className={`${fieldClass('confirmPassword')} pl-10 pr-11`}
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="Nhập lại mật khẩu"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-ios-red mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base mt-2"
            >
              {loading ? (
                <div className="spinner spinner-sm" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Đăng ký
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-gray-500">Đã có tài khoản? </span>
            <Link
              to="/login"
              className="text-smc-600 hover:text-smc-700 font-medium transition-colors"
            >
              Đăng nhập ngay
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
