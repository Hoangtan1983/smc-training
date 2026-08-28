import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiLaxeRegister } from '../../data/api';

export default function LaiXeDangKy() {
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', licenseType: 'A1' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      toast.error('Vui lòng nhập họ tên và số điện thoại');
      return;
    }
    setSubmitting(true);
    try {
      await apiLaxeRegister(form);
      setDone(true);
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể gửi đăng ký'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="page-container py-16">
        <div className="max-w-md mx-auto card p-8 text-center">
          <div className="text-green-600 text-4xl mb-3">✓</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Đã gửi đăng ký thành công</h2>
          <p className="text-gray-500">Trung tâm sẽ liên hệ tư vấn với anh/chị trong thời gian sớm nhất.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Đăng ký đào tạo lái xe</h1>
        <p className="text-gray-500 text-center mb-6">Điền thông tin, trung tâm sẽ gọi lại tư vấn</p>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ tên *</label>
            <input
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              className="input-field"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại *</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="input-field"
              placeholder="09xx xxx xxx"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email (tuỳ chọn)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Hạng bằng</label>
            <div className="grid grid-cols-2 gap-3">
              {['A1', 'A'].map(lt => (
                <button
                  type="button"
                  key={lt}
                  onClick={() => setForm({ ...form, licenseType: lt })}
                  className={`py-3 rounded-xl border-2 font-semibold transition-colors ${
                    form.licenseType === lt
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Hạng {lt}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Gửi đăng ký
          </button>
        </form>
      </div>
    </div>
  );
}
