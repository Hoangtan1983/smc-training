import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FileText, Send, CheckCircle, Eye, EyeOff, Upload, Camera, X, ArrowRight, Paperclip } from 'lucide-react';

const COURSES = [
  { value: 'A', label: 'Hạng A — VLOS (Cơ bản) — 15.000.000đ' },
  { value: 'B', label: 'Hạng B — BVLOS (Chuyên sâu) — 25.000.000đ' },
];

const DOCUMENTS = [
  { key: 'healthCert', label: '01 Giấy chứng nhận đủ sức khỏe' },
  { key: 'photos', label: '02 Ảnh màu cỡ 3cm × 4cm, chụp không quá 06 tháng' },
  { key: 'passport', label: 'Bản sao hợp lệ Hộ chiếu còn thời hạn (đối với người nước ngoài)' },
  { key: 'cv', label: 'Sơ yếu lý lịch' },
  { key: 'criminalRecord', label: 'Phiếu lý lịch tư pháp' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    nationality: 'Việt Nam',
    dob: '',
    gender: 'Nam',
    permanentAddress: '',
    currentAddress: '',
    idNumber: '',
    idIssueDate: '',
    idIssuePlace: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    course: '',
  });
  const [docFiles, setDocFiles] = useState({});
  const [docPreviews, setDocPreviews] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const photoInputRef = useRef(null);
  const docInputRefs = useRef({});

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      toast.error('Vui lòng chọn ảnh định dạng JPG hoặc PNG');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleDocUpload = (docKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File quá lớn. Vui lòng chọn file dưới 10MB');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Vui lòng chọn file PDF, JPG hoặc PNG');
      return;
    }
    setDocFiles(prev => ({ ...prev, [docKey]: file }));
    // Tạo preview cho ảnh, hoặc hiển thị tên file cho PDF
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setDocPreviews(prev => ({ ...prev, [docKey]: ev.target.result }));
      reader.readAsDataURL(file);
    } else {
      setDocPreviews(prev => ({ ...prev, [docKey]: { name: file.name, size: file.size, type: 'pdf' } }));
    }
  };

  const handleRemoveDoc = (docKey) => {
    setDocFiles(prev => { const next = { ...prev }; delete next[docKey]; return next; });
    setDocPreviews(prev => { const next = { ...prev }; delete next[docKey]; return next; });
    if (docInputRefs.current[docKey]) docInputRefs.current[docKey].value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.dob || !form.idNumber || !form.phone || !form.email || !form.password) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }
    if (!form.course) {
      toast.error('Vui lòng chọn khóa học');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        courseId: form.course,
      });
      setSubmitted(true);
      toast.success('Đăng ký thành công!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] py-12 px-4 safe-top safe-bottom">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="flex justify-center">
              <img src="/logo.png" alt="SMC Training" className="h-12 w-auto mb-6" />
            </Link>
            <div className="w-20 h-20 rounded-full bg-[#34C759]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-[#34C759]" />
            </div>
            <h1 className="text-[1.75rem] font-bold text-[#1C1C1E] mb-2 tracking-tight">Đăng ký thành công!</h1>
            <p className="text-[0.9375rem] text-[#8E8E93] mb-6">
              Cảm ơn <strong>{form.fullName}</strong> đã đăng ký khóa học tại SMC Training.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-ios border-l-4 border-l-[#FF9500]">
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <h2 className="font-bold text-[#1C1C1E] mb-2">Tài khoản đang chờ duyệt</h2>
              <p className="text-[0.875rem] text-[#8E8E93] leading-relaxed">
                Nhân viên SMC sẽ xem xét và duyệt tài khoản của bạn trong thời gian sớm nhất.
                Bạn sẽ nhận được thông báo qua email hoặc số điện thoại đã đăng ký.
              </p>
            </div>
          </div>
          <div className="mt-4 px-1 text-[0.875rem] text-[#1C1C1E] space-y-1">
            <p><span className="text-[#FF3B30]">*</span> Họ tên: <span className="font-medium">{form.fullName}</span></p>
            <p><span className="text-[#FF3B30]">*</span> Email: <span className="font-medium">{form.email}</span></p>
            {form.phone && <p><span className="text-[#FF3B30]">*</span> SĐT: <span className="font-medium">{form.phone}</span></p>}
          </div>
          <div className="text-center mt-6">
            <p className="text-[0.875rem] text-[#8E8E93] mb-4">Mọi thắc mắc vui lòng liên hệ:</p>
            <p className="text-[0.875rem] font-medium text-[#1C1C1E]">📞 1900 638939</p>
            <p className="text-[0.875rem] text-[#8E8E93]">✉️ support@smartconnect.com.vn</p>
          </div>
          <div className="text-right mt-8">
            <Link to="/" className="btn-outline">Trở về Trang chủ</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] py-12 px-4 safe-top safe-bottom">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="flex justify-center">
            <img src="/logo.png" alt="SMC Training" className="h-12 w-auto mb-6" />
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#FF9500] text-[0.75rem] font-semibold mb-3">
            <FileText className="w-3.5 h-3.5" /> Mẫu số 07 — Nghị định 288/2025/NĐ-CP
          </span>
          <h1 className="text-[1.5rem] sm:text-[1.75rem] font-bold text-[#1C1C1E] mb-2 tracking-tight">
            Đơn đề nghị Học, cấp Giấy phép điều khiển phương tiện bay
          </h1>
          <p className="text-[0.9375rem] text-[#8E8E93]">
            Kính gửi: Trung tâm Đào tạo Ứng dụng Công nghệ SMC
          </p>
          <p className="text-[0.75rem] text-[#AEAEB2] mt-1">
            59 Nguyễn Thị Hoa, Xã Đất Đỏ, TP.HCM
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 shadow-ios space-y-6">
          {/* Section I: Thông tin cá nhân */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              I. Thông tin cá nhân
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.fullName} onChange={e => updateField('fullName', e.target.value)} className="input-field" placeholder="Nguyễn Văn A" required />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Quốc tịch</label>
                <input type="text" value={form.nationality} onChange={e => updateField('nationality', e.target.value)} className="input-field" placeholder="Việt Nam" />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Ngày/tháng/năm sinh <span className="text-red-500">*</span>
                </label>
                <input type="date" value={form.dob} onChange={e => updateField('dob', e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Giới tính</label>
                <select value={form.gender} onChange={e => updateField('gender', e.target.value)} className="input-field">
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section II: Địa chỉ */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              II. Địa chỉ
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Nơi đăng ký hộ khẩu thường trú</label>
                <input type="text" value={form.permanentAddress} onChange={e => updateField('permanentAddress', e.target.value)} className="input-field" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Nơi cư trú hiện tại</label>
                <input type="text" value={form.currentAddress} onChange={e => updateField('currentAddress', e.target.value)} className="input-field" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" />
              </div>
            </div>
          </div>

          {/* Section III: Giấy tờ tùy thân */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              III. Giấy tờ tùy thân
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Số định danh cá nhân/Hộ chiếu <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.idNumber} onChange={e => updateField('idNumber', e.target.value)} className="input-field" placeholder="012345678901" required />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Ngày cấp</label>
                <input type="date" value={form.idIssueDate} onChange={e => updateField('idIssueDate', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">Nơi cấp</label>
                <input type="text" value={form.idIssuePlace} onChange={e => updateField('idIssuePlace', e.target.value)} className="input-field" placeholder="Cục CS QLHC về TTXH" />
              </div>
            </div>
          </div>

          {/* Section IV: Tài khoản & Khóa học */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              IV. Tài khoản đăng nhập & Khóa học
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} className="input-field" placeholder="09xxxxxxxx" required />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="input-field" placeholder="email@example.com" required />
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => updateField('password', e.target.value)} className="input-field pr-10" placeholder="Tối thiểu 6 ký tự" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Xác nhận mật khẩu <span className="text-red-500">*</span>
                </label>
                <input type="password" value={form.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} className="input-field" placeholder="Nhập lại mật khẩu" required />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[0.75rem] font-medium text-[#8E8E93] mb-1">
                  Khóa học đăng ký <span className="text-red-500">*</span>
                </label>
                <select value={form.course} onChange={e => updateField('course', e.target.value)} className="input-field" required>
                  <option value="" disabled>— Chọn khóa học —</option>
                  {COURSES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section V: Hồ sơ đính kèm */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              V. Hồ sơ đính kèm (xin gửi kèm theo)
            </h3>
            <div className="space-y-4">
              {DOCUMENTS.map(item => {
                const hasFile = !!docFiles[item.key];
                const preview = docPreviews[item.key];
                return (
                  <div key={item.key} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasFile && (
                          <span className="text-xs text-green-600 font-medium">✅ Đã tải lên</span>
                        )}
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-smc-600 bg-smc-50 hover:bg-smc-100 rounded-lg transition-colors border border-smc-200">
                          <Upload className="w-3 h-3" />
                          {hasFile ? 'Thay đổi' : 'Tải lên'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleDocUpload(item.key, e)}
                            className="hidden"
                            ref={el => docInputRefs.current[item.key] = el}
                          />
                        </label>
                        {hasFile && (
                          <button type="button" onClick={() => handleRemoveDoc(item.key)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {hasFile && preview && (
                      <div className="p-3 border-t border-gray-100">
                        {preview.type === 'pdf' ? (
                          <div className="flex items-center gap-3 text-sm">
                            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-700 truncate">{preview.name}</p>
                              <p className="text-xs text-gray-400">{formatFileSize(preview.size)}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <img src={preview} alt={item.label} className="w-16 h-20 object-cover rounded border" />
                            <div className="text-xs text-green-600 font-medium">✅ Xem trước</div>
                          </div>
                        )}
                      </div>
                    )}
                    {!hasFile && (
                      <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
                        Chấp nhận file PDF, JPG, PNG (tối đa 10MB)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ảnh màu 3x4 */}
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-[#8E8E93] uppercase tracking-wider border-b border-black/5 pb-2 mb-4">
              Ảnh màu 3cm × 4cm (chụp không quá 06 tháng)
            </h3>
            <div className="flex justify-center">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Ảnh 3x4" className="w-32 h-40 object-cover rounded-lg border-2 border-green-400 shadow-md" />
                  <button type="button" onClick={handleRemovePhoto} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow">
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-xs text-green-600 text-center mt-1 font-medium">✅ Đã tải ảnh</p>
                </div>
              ) : (
                <button type="button" onClick={() => photoInputRef.current?.click()} className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-4 w-32 h-40 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-blue-50 transition-all cursor-pointer group">
                  <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-1" />
                  <span className="text-xs text-gray-400 group-hover:text-blue-600 leading-tight">Ảnh màu<br />3cm × 4cm<br />chụp không quá<br />06 tháng</span>
                  <span className="text-xs text-blue-500 mt-1 flex items-center gap-0.5 font-medium"><Upload className="w-3 h-3" /> Tải lên</span>
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/jpg" onChange={handlePhotoUpload} className="hidden" />
            </div>
          </div>

          {/* Lời cam đoan */}
          <div className="bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-xl p-4">
            <p className="text-[0.875rem] text-[#1C1C1E]">
              <strong>Tôi cam đoan</strong> những điều ghi trên là đúng sự thật, nếu sai tôi xin hoàn toàn chịu trách nhiệm.
            </p>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-black/5">
            <div className="text-[0.75rem] text-[#AEAEB2]">
              <p>📞 Hotline: <strong className="text-[#8E8E93]">1900 638939</strong></p>
              <p>📧 <strong className="text-[#8E8E93]">support@smartconnect.com.vn</strong></p>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary px-8 py-3 flex items-center gap-2 text-base">
              {submitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Đang gửi...' : 'Gửi đơn đăng ký'}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[0.875rem] text-[#8E8E93]">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-[#007AFF] hover:text-[#0062CC]">
            Đăng nhập <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </p>

        <p className="mt-6 text-center text-[0.75rem] text-[#AEAEB2]">
          Bằng việc đăng ký, bạn đồng ý với{' '}
          <a href="#" className="underline hover:text-gray-500">Điều khoản dịch vụ</a>
          {' '}và{' '}
          <a href="#" className="underline hover:text-gray-500">Chính sách bảo mật</a> của SMC Training.
        </p>
      </div>
    </div>
  );
}
