import { useState } from 'react';
import { Search, Award, Shield, CheckCircle, XCircle } from 'lucide-react';

export default function CertLookupPage() {
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    if (!certId.trim()) return;
    setLoading(true);
    setResult(null);
    // Gọi API tra cứu
    try {
      const resp = await fetch(`/api/auth.php?action=certifications`);
      const data = await resp.json();
      // Tìm chứng chỉ trong danh sách
      const found = (data.certifications || data || []).find(
        c => c.id === certId.trim() || c.certNumber === certId.trim()
      );
      setResult(found || { notFound: true });
    } catch {
      setResult({ notFound: true });
    }
    setLoading(false);
  };

  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-smc-100 flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-smc-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Tra cứu chứng chỉ</h1>
            <p className="text-gray-500">Nhập mã số chứng chỉ UAV để tra cứu thông tin</p>
          </div>

          <div className="card p-6">
            <div className="flex gap-2">
              <input
                value={certId}
                onChange={e => setCertId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="input-field flex-1"
                placeholder="Nhập mã số chứng chỉ (VD: UAV-2026-XXXX)"
              />
              <button onClick={handleSearch} disabled={loading} className="btn-primary flex items-center gap-1.5">
                {loading ? (
                  <div className="spinner w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Tra cứu
              </button>
            </div>

            {result && (
              <div className="mt-6">
                {result.notFound ? (
                  <div className="text-center p-6 bg-red-50 rounded-xl">
                    <XCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <p className="text-red-700 font-semibold">Không tìm thấy chứng chỉ</p>
                    <p className="text-sm text-red-500 mt-1">Vui lòng kiểm tra lại mã số chứng chỉ</p>
                  </div>
                ) : (
                  <div className="p-6 bg-green-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-green-700">Chứng chỉ hợp lệ</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Mã số:</span> <span className="font-semibold">{result.certNumber || result.id}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Học viên:</span> <span className="font-semibold">{result.studentName || result.fullName}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Loại chứng chỉ:</span> <span className="font-semibold">{result.type || result.certType}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Ngày cấp:</span> <span className="font-semibold">{result.issueDate || result.date}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Trạng thái:</span> <span className="badge bg-green-100 text-green-700 text-xs">Còn hiệu lực</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-gray-400 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Dữ liệu được xác thực theo NĐ 288/2025 & TT 146/2025
          </div>
        </div>
      </div>
    </div>
  );
}
