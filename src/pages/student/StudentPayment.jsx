import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  apiGetStudentInvoices, apiV1GenerateQR, apiExamEligibility,
  apiSubmitReceipt,
  emitDataChange, onDataChange
} from '../../data/api';
import {
  Upload, CheckCircle, Clock, DollarSign, QrCode,
  AlertTriangle, History, FileText, TrendingUp, Calendar, Camera, Copy
} from 'lucide-react';
import { formatCurrency, formatDate, showPrompt } from '../../utils/format';
import toast from 'react-hot-toast';

export default function StudentPayment() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [examStatus, setExamStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // QR Code
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrAmount, setQrAmount] = useState('');

  const formatPrice = (p) => {
    if (!p || p === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const loadData = useCallback(async () => {
    try {
      const [invRes, examRes] = await Promise.all([
        apiGetStudentInvoices().catch(() => ({ data: [] })),
        apiExamEligibility().catch(() => ({ data: null })),
      ]);
      setInvoices(invRes?.data || []);
      setExamStatus(examRes?.data || null);
    } catch (err) {
      console.error('[StudentPayment] Load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const u1 = onDataChange('invoices', () => loadData());
    const u2 = onDataChange('transactions', () => loadData());
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => { u1(); u2(); window.removeEventListener('focus', onFocus); };
  }, [loadData]);

  const handleGenerateQR = async (invoiceId) => {
    if (!qrAmount || parseInt(qrAmount) <= 0) {
      toast.error('Vui lòng nhập số tiền');
      return;
    }
    try {
      const res = await apiV1GenerateQR({ enrollment_id: invoiceId, amount: parseInt(qrAmount) });
      setQrData(res.data);
      setShowQR(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmitReceipt = async (invoiceId) => {
    const amount = await showPrompt({ title: 'Xác nhận chuyển khoản', message: 'Nhập số tiền bạn đã chuyển (VNĐ):', placeholder: 'Ví dụ: 5000000', required: true });
    if (!amount) return;
    if (isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ (số dương)');
      return;
    }
    try {
      const res = await apiSubmitReceipt({
        invoiceId,
        amount: parseInt(amount),
        method: 'bank_transfer',
        note: 'Học viên nộp biên lai chuyển khoản',
      });
      toast.success(res.message || 'Đã nộp biên lai! Nhân viên SMC sẽ xác nhận trong thời gian sớm nhất.');
      emitDataChange('invoices', { action: 'receipt_submitted' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Đã sao chép!'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Đang tải thông tin học phí...</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">💳 Học phí của tôi</h1>
        <div className="card p-12 text-center text-gray-400">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold">Bạn chưa có hồ sơ học phí</p>
          <p className="text-sm mt-1">Vui lòng liên hệ nhân viên SMC để được tạo hồ sơ</p>
        </div>
      </div>
    );
  }

  // Calculate overall stats
  const totalBase = invoices.reduce((s, inv) => s + (inv.basePrice || 0), 0);
  const totalPaid = invoices.reduce((s, inv) => s + (inv.totalPaid || 0), 0);
  const totalDue = invoices.reduce((s, inv) => s + (inv.remainingDue || 0), 0);
  const overallPct = totalBase > 0 ? Math.round(totalPaid / totalBase * 100) : 0;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">💳 Học phí của tôi</h1>
      <p className="text-sm text-gray-500 mb-6">Theo dõi học phí, lịch đóng tiền và thanh toán QR Code</p>

      {/* Exam Eligibility Banner */}
      {examStatus && (
        <div className={`card p-4 mb-6 border-l-4 ${
          examStatus.eligible ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              examStatus.eligible ? 'bg-green-200' : 'bg-red-200'
            }`}>
              {examStatus.eligible ? (
                <CheckCircle className="w-5 h-5 text-green-700" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-700" />
              )}
            </div>
            <div>
              <p className={`font-bold ${examStatus.eligible ? 'text-green-800' : 'text-red-800'}`}>
                {examStatus.eligible ? '✅ Đủ điều kiện tham gia thi' : '⚠️ Chưa đủ điều kiện thi'}
              </p>
              <p className="text-sm mt-0.5">
                {examStatus.eligible
                  ? 'Bạn đã hoàn thành học phí và có thể đăng ký thi.'
                  : `Cần hoàn thành học phí để đủ điều kiện thi. Đã nộp: ${formatPrice(examStatus.paid)} / ${formatPrice(examStatus.total)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overall progress */}
      {invoices.length > 1 && (
        <div className="card p-4 mb-6 bg-gradient-to-r from-purple-50 to-blue-50">
          <h3 className="font-bold text-gray-800 mb-2">📊 Tổng quan học phí</h3>
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="text-center"><div className="text-xs text-gray-500">Tổng HP</div><div className="font-bold text-blue-700">{formatPrice(totalBase)}</div></div>
            <div className="text-center"><div className="text-xs text-gray-500">Đã nộp</div><div className="font-bold text-green-600">{formatPrice(totalPaid)}</div></div>
            <div className="text-center"><div className="text-xs text-gray-500">Còn thiếu</div><div className="font-bold text-red-600">{formatPrice(totalDue)}</div></div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{width: `${overallPct}%`}} /></div>
        </div>
      )}

      {invoices.map((inv) => {
        const paid = parseInt(inv.totalPaid || 0);
        const baseP = parseInt(inv.basePrice || 0);
        const remaining = parseInt(inv.remainingDue || 0);
        const progressPct = baseP > 0 ? Math.min(100, Math.round(paid / baseP * 100)) : 0;
        const transactions = inv.transactions || [];
        const isExempt = inv.status === 'exempt';

        return (
          <div key={inv.id} className="card p-6 mb-6 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-gray-800">
                  🧾 {inv.courseName}
                </h3>
              </div>
              <span className={`badge text-sm px-3 py-1 font-bold ${
                inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                inv.status === 'exempt' ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {inv.status === 'paid' ? '✅ Đã thanh toán đủ' :
                 inv.status === 'partial' ? '⚠️ Thanh toán 1 phần' :
                 inv.status === 'exempt' ? '🆓 Miễn phí' :
                 '⏳ Chờ thanh toán'}
              </span>
            </div>

            {/* 4 ô số chính */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Học phí gốc</div>
                <div className="font-extrabold text-xl text-blue-700">{formatPrice(baseP)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Đã nộp</div>
                <div className="font-extrabold text-xl text-green-600">{formatPrice(paid)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Còn phải nộp</div>
                <div className={`font-extrabold text-xl ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {isExempt ? '🆓 0đ' : remaining > 0 ? formatPrice(remaining) : '✅ Đủ'}
                </div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Tiến độ</div>
                <div className="font-extrabold text-xl text-purple-600">{isExempt ? 'MP' : progressPct + '%'}</div>
              </div>
            </div>

            {/* Progress bar */}
            {!isExempt && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Tiến độ thanh toán</span>
                  <span>{formatPrice(paid)} / {formatPrice(baseP)}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, background: progressPct >= 100 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#9ca3af' }} />
                </div>
              </div>
            )}

            {/* QR Payment + Submit receipt buttons */}
            {!isExempt && remaining > 0 && inv.status !== 'frozen' && (
              <div className="flex flex-wrap gap-3 mb-4">
                <button onClick={() => {
                  setQrAmount(remaining);
                  setShowQR(true);
                }} className="btn-primary flex items-center gap-2 px-5 py-3 font-bold bg-purple-600 hover:bg-purple-700">
                  <QrCode className="w-5 h-5" /> Tạo mã QR thanh toán
                </button>
                <button onClick={() => handleSubmitReceipt(inv.id)} className="btn-primary flex items-center gap-2 px-5 py-3 font-bold">
                  <Upload className="w-5 h-5" /> Nộp biên lai CK
                </button>
              </div>
            )}

            {/* Payment History (from v3 transactions) */}
            {transactions.length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" /> Lịch sử giao dịch ({transactions.length})
                </h4>
                <div className="space-y-2">
                  {transactions.map(txn => (
                    <div key={txn.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          txn.status === 'confirmed' ? 'bg-green-500' :
                          txn.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
                        }`} />
                        <span className="font-mono font-bold text-green-600">{formatPrice(txn.amount)}</span>
                        <span className="text-gray-400">{txn.method === 'bank_transfer' ? '🏦 CK' : txn.method === 'cash' ? '💵 TM' : txn.method}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        <span className={`badge text-xs ${
                          txn.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          txn.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {txn.status === 'confirmed' ? '✅ Đã duyệt' :
                           txn.status === 'pending' ? '⏳ Chờ duyệt' : '❌ Từ chối'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ═══════ QR CODE MODAL ═══════ */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between">
              <h3 className="text-lg font-extrabold">📱 Quét mã QR để thanh toán</h3>
              <button onClick={() => setShowQR(false)} className="btn-ghost p-2">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {qrData ? (
                <>
                  <div className="text-center">
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 inline-block">
                      <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
                        <div className="text-center">
                          <QrCode className="w-16 h-16 text-purple-600 mx-auto mb-2" />
                          <p className="text-xs text-gray-500 font-mono break-all px-2">{qrData.qr_content?.substring(0, 60)}...</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ngân hàng:</span>
                      <span className="font-bold">{qrData.bank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số tài khoản:</span>
                      <span className="font-bold font-mono">{qrData.account_no}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Chủ tài khoản:</span>
                      <span className="font-bold">{qrData.account_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số tiền:</span>
                      <span className="font-bold text-green-600 text-lg">{formatPrice(qrData.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nội dung CK:</span>
                      <span className="font-bold text-xs font-mono">{qrData.description}</span>
                    </div>
                  </div>

                  <button onClick={() => copyToClipboard(qrData.description)}
                    className="btn-ghost w-full py-2 text-sm flex items-center justify-center gap-2 border">
                    <Copy className="w-4 h-4" /> Sao chép nội dung chuyển khoản
                  </button>

                  <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                    <p>💡 <strong>Hướng dẫn:</strong> Mở app ngân hàng, quét mã QR hoặc chuyển khoản với nội dung <strong>"{qrData.description}"</strong>. Nhân viên SMC sẽ xác nhận trong 24h.</p>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
                    <p className="font-semibold mb-2">🏦 Thông tin chuyển khoản</p>
                    <p><strong>Ngân hàng:</strong> Vietcombank (VCB)</p>
                    <p><strong>Chủ TK:</strong> SMC TRAINING</p>
                    <p className="mt-2 text-xs">Nhập số tiền và nhấn "Tạo QR" để sinh mã thanh toán</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-left">Số tiền (VNĐ)</label>
                    <input type="number" value={qrAmount} onChange={e => setQrAmount(e.target.value)}
                      className="input-field text-lg font-bold text-center" placeholder="Nhập số tiền..." autoFocus />
                  </div>
                  <button onClick={() => {
                    if (invoices[0]) handleGenerateQR(invoices[0].id);
                  }} className="btn-primary w-full py-3 font-bold flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700">
                    <QrCode className="w-5 h-5" /> Tạo mã QR
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
