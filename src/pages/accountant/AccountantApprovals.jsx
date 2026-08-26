import { useState, useEffect } from 'react';
import {
  apiListTransactions, apiConfirmReceipt, apiRejectReceipt,
  apiListEnrollments, apiApproveEnrollment, apiRejectEnrollment,
  apiGetUsers, apiGetAgencies,
  onDataChange, emitDataChange
} from '../../data/api';
import { Check, X, Eye, Search, Filter, DollarSign, Clock, AlertTriangle, Building2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const formatPrice = (v) => {
  if (v == null || isNaN(v)) return '0 ₫';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

const STATUS_MAP = {
  pending: { label: 'Chờ đối soát', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  staff_confirmed: { label: 'NV đã thu tiền', color: 'bg-amber-500/20 text-amber-400', icon: AlertTriangle },
  accountant_confirmed: { label: 'Đã duyệt (chờ Admin)', color: 'bg-purple-500/20 text-purple-400', icon: Clock },
  confirmed: { label: 'Đã kích hoạt', color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
  approved: { label: 'Đã duyệt', color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
  rejected: { label: 'Đã từ chối', color: 'bg-red-500/20 text-red-400', icon: X },
};

const PAYMENT_METHOD_LABELS = {
  cash: '💵 Tiền mặt', bank_transfer: '🏦 Chuyển khoản',
  qr_code: '📱 QR Code', pos: '💳 POS', other: '💰 Khác',
};

export default function AccountantApprovals() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('enrollments');
  const [search, setSearch] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  // Enrollment reject modal
  const [enrRejectModal, setEnrRejectModal] = useState(null);
  const [enrRejectReason, setEnrRejectReason] = useState('');
  // Enrollment approve modal (nhập số tiền đã nộp)
  const [enrApproveModal, setEnrApproveModal] = useState(null);
  const [enrApproveAmount, setEnrApproveAmount] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // Load cả staff_confirmed và pending transactions
      const [staffRes, pendingRes, enrRes, userRes, agencyRes] = await Promise.all([
        apiListTransactions({ status: 'staff_confirmed', limit: 100 }),
        apiListTransactions({ status: 'pending', limit: 100 }),
        apiListEnrollments('staff').catch(() => ({ data: [] })),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetAgencies().catch(() => []),
      ]);

      const staffTxns = (staffRes?.data || []).map(t => ({ ...t, _source: 'staff_confirmed' }));
      const pendingTxns = (pendingRes?.data || []).map(t => ({ ...t, _source: 'pending' }));

      // Merge, staff_confirmed lên trước (ưu tiên duyệt tiền mặt)
      setTransactions([...staffTxns, ...pendingTxns]);
      setEnrollments(enrRes?.data || []);
      setUsers(userRes?.users || userRes || []);
      setAgencies(Array.isArray(agencyRes) ? agencyRes : (agencyRes?.data || []));
    } catch (err) {
      console.error('Load approvals error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub1 = onDataChange('transactions', loadData);
    const unsub2 = onDataChange('enrollments', loadData);
    const unsub3 = onDataChange('all', loadData);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // ── Tên đại lý theo student_id ──
  const getAgencyName = (studentId) => {
    if (!studentId) return null;
    const u = users.find(x => String(x.id) === String(studentId));
    const aid = u?.agencyId ?? u?.agency_id;
    if (!aid) return null;
    const sid = String(aid);
    const agency = agencies.find(a => String(a.id) === sid);
    return agency ? (agency.name || agency.agent_name || agency.agentName) : ('Đại lý #' + sid);
  };

  const filteredTxns = transactions.filter(t => {
    if (activeTab === 'staff_confirmed') return t.status === 'staff_confirmed';
    if (activeTab === 'pending') return t.status === 'pending';
    if (activeTab === 'approved') return t.status === 'approved';
    if (activeTab === 'rejected') return t.status === 'rejected';
    // pending_all: cả pending + staff_confirmed
    if (activeTab === 'pending_all') return t.status === 'pending' || t.status === 'staff_confirmed';
    return true;
  }).filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (t.student_name || t.full_name || '').toLowerCase().includes(s)
      || (t.receipt_code || '').toLowerCase().includes(s)
      || (t.enrollment_code || '').toLowerCase().includes(s)
      || (t.agency_name || '').toLowerCase().includes(s);
  });

  const handleApprove = async (txn) => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await apiConfirmReceipt({ paymentId: txn.id, note: 'Kế toán đối soát & duyệt' });
      if (result?.success || result?.message) {
        toast.success(result?.message || 'Đã duyệt phiếu thu! Khóa học đã được kích hoạt.');
        emitDataChange('transactions');
        emitDataChange('all');
        loadData();
      } else {
        toast.error(result?.error || 'Lỗi khi duyệt phiếu thu');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    }
    setProcessing(false);
  };

  // ── Duyệt hồ sơ enrollment (Nhân viên → Kế toán) ──
  const handleApproveEnrollment = async (enr, amount) => {
    if (processing) return;
    setProcessing(true);
    try {
      const res = await apiApproveEnrollment({ enrollmentId: enr.id, step: 'accountant', note: 'Kế toán đã đối soát & duyệt', amount: Number(amount) || 0 });
      const pay = res?.payment;
      if (pay) {
        if (pay.paymentStatus === 'fully_paid') {
          toast.success(`Đã ghi nhận nộp đủ ${Number(pay.final).toLocaleString('vi-VN')} ₫! Chuyển cho Admin kích hoạt.`);
        } else {
          toast.success(`Đã ghi nhận nộp ${Number(pay.paid).toLocaleString('vi-VN')} ₫, còn thiếu ${Number(pay.remaining).toLocaleString('vi-VN')} ₫.`);
        }
      } else {
        toast.success('Đã duyệt hồ sơ! Chuyển cho Admin kích hoạt.');
      }
      setEnrApproveModal(null);
      setEnrApproveAmount('');
      emitDataChange('enrollments');
      emitDataChange('all');
      loadData();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể duyệt hồ sơ'));
    }
    setProcessing(false);
  };

  const handleRejectEnrollment = async () => {
    if (!enrRejectModal || processing) return;
    setProcessing(true);
    try {
      await apiRejectEnrollment({ enrollmentId: enrRejectModal.id, reason: enrRejectReason || 'Không đạt yêu cầu' });
      toast.success('Đã từ chối hồ sơ.');
      setEnrRejectModal(null);
      setEnrRejectReason('');
      emitDataChange('enrollments');
      emitDataChange('all');
      loadData();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể từ chối'));
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!rejectModal || processing) return;
    setProcessing(true);
    try {
      const result = await apiRejectReceipt({ paymentId: rejectModal.id, reason: rejectReason });
      if (result?.success || result?.message) {
        toast.success('Đã từ chối phiếu thu.');
        setRejectModal(null);
        setRejectReason('');
        emitDataChange('transactions');
        emitDataChange('all');
        loadData();
      } else {
        toast.error(result?.error || 'Lỗi khi từ chối');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    }
    setProcessing(false);
  };

  const tabs = [
    { key: 'enrollments', label: '📋 Hồ sơ chờ duyệt', count: enrollments.length },
    { key: 'pending_all', label: 'Chờ duyệt', count: transactions.filter(t => t.status === 'pending' || t.status === 'staff_confirmed').length },
    { key: 'staff_confirmed', label: 'Tiền mặt (NV đã thu)', count: transactions.filter(t => t.status === 'staff_confirmed').length },
    { key: 'pending', label: 'Chuyển khoản', count: transactions.filter(t => t.status === 'pending').length },
    { key: 'approved', label: 'Đã duyệt', count: transactions.filter(t => t.status === 'approved').length },
    { key: 'rejected', label: 'Đã từ chối', count: transactions.filter(t => t.status === 'rejected').length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Duyệt phiếu thu</h1>
        <p className="text-slate-400 mt-1">
          Đối soát & duyệt phiếu thu từ nhân viên (tiền mặt) và học viên (chuyển khoản).
          <br /><strong className="text-amber-400">Chỉ Kế toán mới có quyền kích hoạt khóa học.</strong>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-slate-800 text-white border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── TAB: Hồ sơ chờ Kế toán duyệt (từ Nhân viên chuyển sang) ── */}
      {activeTab === 'enrollments' && (
        <div className="space-y-3">
          {enrollments.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <FileText size={48} className="mx-auto mb-3 text-slate-600" />
              <p>Không có hồ sơ nào chờ duyệt</p>
              <p className="text-xs mt-1 text-slate-600">Hồ sơ sẽ xuất hiện ở đây sau khi Nhân viên duyệt tài khoản học viên</p>
            </div>
          )}
          {enrollments.map(enr => (
            <div key={enr.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
                      <Clock size={12} /> Chờ Kế toán duyệt
                    </span>
                    <span className="text-xs text-slate-500">
                      NV duyệt: {enr.approval_staff_name || '—'} • {enr.approval_staff_at ? new Date(enr.approval_staff_at).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </div>
                  <p className="text-white font-semibold">{enr.studentName || enr.student_name || `Học viên #${enr.student_id}`}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400 flex-wrap">
                    {getAgencyName(enr.student_id) && (
                      <span className="flex items-center gap-1 text-blue-400 font-medium"><Building2 size={12} /> {getAgencyName(enr.student_id)}</span>
                    )}
                    {enr.student_phone && <span>📞 {enr.student_phone}</span>}
                    {enr.enrollment_code && <span>🎓 {enr.enrollment_code}</span>}
                    <span>📋 {enr.courseName || enr.course_name || '—'}</span>
                    <span>💰 {enr.total_amount ? Number(enr.total_amount).toLocaleString('vi-VN') + ' ₫' : '—'}</span>
                    {enr.approval_staff_note && <span className="text-slate-500">📝 {enr.approval_staff_note}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setEnrApproveModal(enr);
                      const _final = Number(enr.final_amount || enr.finalPrice || 0);
                      const _paid = Number(enr.paid_amount || 0);
                      setEnrApproveAmount(Math.max(0, _final - _paid) || '');
                    }}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500
                               text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={16} /> Duyệt
                  </button>
                  <button
                    onClick={() => { setEnrRejectModal(enr); setEnrRejectReason(''); }}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 hover:bg-red-600/30
                               text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={16} /> Từ chối
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Transaction list — chỉ hiển thị cho tab phiếu thu */}
      {activeTab !== 'enrollments' && (
        <>
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text" placeholder="Tìm theo tên học viên, mã phiếu thu..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm
                     placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Transaction list */}
      <div className="space-y-3">
        {filteredTxns.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <DollarSign size={48} className="mx-auto mb-3 text-slate-600" />
            <p>Không có phiếu thu nào</p>
          </div>
        ) : (
          filteredTxns.map(txn => {
            const st = STATUS_MAP[txn.status] || STATUS_MAP.pending;
            const StatusIcon = st.icon;
            const isPending = txn.status === 'pending' || txn.status === 'staff_confirmed';

            return (
              <div key={txn.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${st.color}`}>
                        <StatusIcon size={12} /> {st.label}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                        {PAYMENT_METHOD_LABELS[txn.payment_method] || txn.payment_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-white font-semibold text-base">
                        {txn.student_name || txn.full_name || `Học viên #${txn.student_id}`}
                      </p>
                      <p className="text-emerald-400 font-bold text-lg">
                        {formatPrice(txn.amount)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                      {txn.courseName && <span>📋 {txn.courseName}</span>}
                      <span>🧾 {txn.receipt_code || `#${txn.id}`}</span>
                      {txn.enrollment_code && <span>🎓 {txn.enrollment_code}</span>}
                      {txn.agency_name && (
                        <span className="inline-flex items-center gap-1 text-orange-400">
                          <Building2 size={10} /> {txn.agency_name}
                        </span>
                      )}
                      <span>📅 {txn.payment_date ? new Date(txn.payment_date).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : '--'}</span>
                      {txn.note && <span className="text-slate-500">📝 {txn.note}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(txn)}
                        disabled={processing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500
                                   text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Check size={16} /> Duyệt
                      </button>
                      <button
                        onClick={() => { setRejectModal(txn); setRejectReason(''); }}
                        disabled={processing}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 hover:bg-red-600/30
                                   text-red-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X size={16} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>

                {/* Receipt image if available */}
                {txn.receipt_image && (
                  <div className="mt-3">
                    <img
                      src={txn.receipt_image} alt="Biên lai"
                      className="max-h-32 rounded-lg border border-slate-600 cursor-pointer hover:opacity-80"
                      onClick={() => window.open(txn.receipt_image, '_blank')}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRejectModal(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Từ chối phiếu thu</h3>
            <p className="text-slate-400 text-sm mb-4">
              {rejectModal.receipt_code || `#${rejectModal.id}`} — {formatPrice(rejectModal.amount)}
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm
                         placeholder-slate-500 focus:outline-none focus:border-red-500/50 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium
                           rounded-lg transition-colors disabled:opacity-50"
              >
                {processing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

      {/* Enrollment Approve Modal (nhập số tiền đã nộp) */}
      {enrApproveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEnrApproveModal(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Duyệt hồ sơ & ghi nhận thanh toán</h3>
            <p className="text-slate-400 text-sm mb-1">
              {enrApproveModal.studentName || enrApproveModal.student_name || `#${enrApproveModal.id}`} — {enrApproveModal.courseName || enrApproveModal.course_name || ''}
            </p>
            <p className="text-slate-400 text-sm mb-4">
              Tổng học phí: <span className="text-white font-medium">{formatPrice(enrApproveModal.final_amount || enrApproveModal.total_amount)}</span>
              {Number(enrApproveModal.paid_amount || 0) > 0 && (
                <span className="ml-2">• Đã nộp: <span className="text-amber-400">{formatPrice(enrApproveModal.paid_amount)}</span></span>
              )}
              <span className="ml-2">• Còn nợ: <span className="text-red-400">{formatPrice(Math.max(0, Number(enrApproveModal.final_amount || 0) - Number(enrApproveModal.paid_amount || 0)))}</span></span>
            </p>
            <label className="block text-sm text-slate-300 mb-1">Số tiền nộp thêm (mặc định = số còn nợ)</label>
            <input
              type="number"
              min="0"
              value={enrApproveAmount}
              onChange={e => setEnrApproveAmount(e.target.value)}
              placeholder="Nhập số tiền đã nộp (VNĐ)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm
                         placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEnrApproveModal(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Hủy</button>
              <button
                onClick={() => handleApproveEnrollment(enrApproveModal, enrApproveAmount)}
                disabled={processing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {processing ? 'Đang xử lý...' : 'Xác nhận duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment Reject Modal */}
      {enrRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEnrRejectModal(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Từ chối hồ sơ</h3>
            <p className="text-slate-400 text-sm mb-4">
              {enrRejectModal.studentName || enrRejectModal.student_name || `#${enrRejectModal.id}`}
            </p>
            <textarea
              value={enrRejectReason}
              onChange={e => setEnrRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm
                         placeholder-slate-500 focus:outline-none focus:border-red-500/50 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEnrRejectModal(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm">Hủy</button>
              <button onClick={handleRejectEnrollment} disabled={processing || !enrRejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {processing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
