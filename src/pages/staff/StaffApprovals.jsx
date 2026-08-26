import { useState, useEffect } from 'react';
import {
  apiListInvoices, apiGetOverallReport,
  apiRecordPayment, apiConfirmReceipt, apiRejectReceipt,
  apiListTransactions, apiGetUsers, apiGetRegistrations,
  apiGetAgencies, apiProcessPayment, apiUpdateUser,
  apiApproveStudentV2, apiListEnrollments, apiApproveEnrollment, apiRejectEnrollment,
  emitDataChange, onDataChange
} from '../../data/api';
import {
  UserCheck, UserX, Search, Clock, CheckCircle, XCircle, Mail, Phone,
  CreditCard, AlertTriangle, DollarSign, ChevronDown, ChevronUp,
  BookOpen, Filter, FileText, Building2, UserPlus, ShieldCheck
} from 'lucide-react';
import { formatCurrency, showPrompt } from '../../utils/format';
import toast from 'react-hot-toast';

const PAYMENT_METHOD_LABELS = {
  cash: '💵 Tiền mặt',
  bank_transfer: '🏦 Chuyển khoản',
  vnpay: '📱 VNPAY',
  momo: '📱 MOMO',
};

const STATUS_MAP = {
  paid: { label: 'Đã thanh toán', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: 'Thanh toán 1 phần', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  pending: { label: 'Chưa thanh toán', color: 'bg-red-100 text-red-700', icon: XCircle },
  frozen: { label: 'Tạm khóa', color: 'bg-gray-200 text-gray-700', icon: XCircle },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700', icon: XCircle },
  exempt: { label: '🆓 Miễn phí', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const COURSE_LABELS = {
  'c001': 'Hạng A — VLOS (Cơ bản)',
  'c002': 'Hạng B — VLOS (Nâng cao)',
  'c003': 'Hạng B — BVLOS (Chuyên sâu)',
};

export default function StaffApprovals() {
  const [allInvoices, setAllInvoices] = useState([]);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [pendingEnrollments, setPendingEnrollments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('accounts'); // default: tài khoản chờ duyệt
  const [expandedId, setExpandedId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [rankModal, setRankModal] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [invRes, txnRes, userRes, regRes, enrRes, agencyRes] = await Promise.all([
        apiListInvoices({ perPage: 100 }).catch(() => ({ data: [] })),
        apiListTransactions({ status: 'pending' }).catch(() => ({ data: [] })),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetRegistrations().catch(() => []),
        apiListEnrollments().catch(() => ({ data: [] })),
        apiGetAgencies().catch(() => []),
      ]);
      setAllInvoices(invRes?.data || []);
      setPendingTxns(txnRes?.data || []);
      setAgencies(Array.isArray(agencyRes) ? agencyRes : (agencyRes?.data || []));

      const users = userRes?.users || userRes || [];
      const allEnrollments = enrRes?.data || [];

      // Lọc bỏ user đã có enrollment (đã được duyệt bởi Nhân viên)
      const enrolledUserIds = new Set(allEnrollments.map(e => e.student_id).filter(Boolean));
      setPendingUsers(users.filter(u =>
        u.role === 'STUDENT' && u.status === 'PENDING' && !enrolledUserIds.has(u.id)
      ));
      // Hồ sơ chờ Nhân viên duyệt (bước step='staff'): enrollment pending, chưa có approval_staff_by
      setPendingEnrollments(allEnrollments.filter(e =>
        (e.enrollment_status === 'pending' || e.status === 'pending') && !e.approval_staff_by
      ));
      setRegistrations(Array.isArray(regRes) ? regRes : (regRes?.data || []));
    } catch (e) {
      toast.error('Không thể tải danh sách');
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // Subscribe to data changes
  useEffect(() => {
    const u1 = onDataChange('invoices', () => loadAll());
    const u2 = onDataChange('transactions', () => loadAll());
    const u3 = onDataChange('users', () => loadAll());
    const u4 = onDataChange('all', (detail) => {
      if (detail?.changed === 'users' || detail?.changed === 'registrations') loadAll();
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // ── Tìm registration liên kết với user ──
  const getRegistration = (user) => {
    // Ưu tiên match theo userId
    let reg = registrations.find(r => r.userId === user.id);
    // Fallback: match theo email hoặc phone
    if (!reg) {
      reg = registrations.find(r =>
        (r.email && r.email.toLowerCase() === (user.email || '').toLowerCase()) ||
        (r.phone && r.phone === user.phone)
      );
    }
    return reg;
  };

  // ── Tên đại lý (nếu học viên do đại lý nhập) ──
  const getAgencyName = (user) => {
    const aid = user.agencyId ?? user.agency_id;
    if (!aid) return null;
    const sid = String(aid);
    const agency = agencies.find(a => String(a.id) === sid);
    return agency ? (agency.name || agency.agent_name || agency.agentName) : ('Đại lý #' + sid);
  };

  // ── Duyệt tài khoản PENDING → kích hoạt + tạo hồ sơ học phí theo Hạng thi, chuyển cho Kế toán ──
  const handleApproveAccount = async (user, rank = '') => {
    try {
      const note = `Duyệt bởi Nhân viên - ${new Date().toLocaleDateString('vi-VN')}`;
      const res = await apiApproveStudentV2(user.id, note, rank);
      if (res?.needRank || res?.warning) {
        toast.success(`Đã kích hoạt ${user.fullName}. ${res.warning || ''}`, { duration: 6000 });
      } else {
        toast.success(`Đã duyệt ${user.fullName} và tạo hồ sơ học phí! Chuyển cho Kế toán đối soát.`);
      }
      emitDataChange('users', { action: 'approved_pending', userId: user.id });
      emitDataChange('enrollments', { action: 'created', userId: user.id });
      emitDataChange('all', { changed: 'users' });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể duyệt tài khoản'));
    }
  };

  // ── Từ chối tài khoản ──
  const handleRejectAccount = async (user) => {
    const reason = await showPrompt({ title: 'Lý do từ chối', message: `Từ chối tài khoản của ${user.fullName}:`, required: true });
    if (!reason) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) { toast.error('Vui lòng nhập lý do từ chối'); return; }

    try {
      await apiUpdateUser(user.id, { status: 'REJECTED', notes: `Từ chối: ${trimmedReason}` });
      toast.success(`Đã từ chối tài khoản ${user.fullName}`);
      emitDataChange('users', { action: 'rejected', userId: user.id });
      emitDataChange('all', { changed: 'users' });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể từ chối tài khoản'));
    }
  };

  // ── Duyệt hồ sơ (bước step='staff') → chuyển cho Kế toán ──
  const handleApproveEnrollment = async (enr) => {
    try {
      await apiApproveEnrollment({ enrollmentId: enr.id, step: 'staff', note: 'Nhân viên duyệt hồ sơ' });
      toast.success(`Đã duyệt hồ sơ ${enr.student_name || ''}! Chuyển cho Kế toán đối soát.`);
      emitDataChange('enrollments', { action: 'staff_approved', enrollmentId: enr.id });
      emitDataChange('all', { changed: 'enrollments' });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể duyệt hồ sơ'));
    }
  };

  // ── Duyệt phiếu thu ──
  const handleApproveTxn = async (txn) => {
    try {
      await apiConfirmReceipt({ transactionId: txn.id, note: 'Đã duyệt bởi Nhân viên' });
      toast.success('Đã duyệt phiếu thu!');
      emitDataChange('invoices');
      emitDataChange('transactions');
      setConfirmModal(null);
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể duyệt'));
    }
  };

  const handleRejectTxn = async (txn, reason) => {
    try {
      await apiRejectReceipt({ transactionId: txn.id, reason: reason || 'Biên lai không hợp lệ' });
      toast.success('Đã từ chối phiếu thu.');
      emitDataChange('invoices');
      emitDataChange('transactions');
      setConfirmModal(null);
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể từ chối'));
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  const formatPrice = (p) => {
    if (!p || p === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Duyệt tài khoản & Phiếu thu</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pendingUsers.length} tài khoản chờ duyệt • {pendingTxns.length} phiếu thu chờ duyệt
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'accounts', label: `👤 Tài khoản chờ duyệt (${pendingUsers.length})` },
          { key: 'pending-enr', label: `📋 Hồ sơ chờ duyệt (${pendingEnrollments.length})` },
          { key: 'pending-txn', label: `💰 Phiếu thu chờ duyệt (${pendingTxns.length})` },
          { key: 'all-invoices', label: `📋 Tất cả hóa đơn (${allInvoices.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Tài khoản chờ duyệt ── */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          {pendingUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p className="text-lg font-medium">Tất cả tài khoản đã được duyệt</p>
              <p className="text-sm mt-1">Không có tài khoản nào đang chờ duyệt</p>
            </div>
          )}
          {pendingUsers.map(user => {
            const reg = getRegistration(user);
            const agencyName = getAgencyName(user);
            return (
              <div key={user.id} className="card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                        {(user.fullName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{user.fullName}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                          {agencyName && <span className="flex items-center gap-1 text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded"><Building2 className="w-3 h-3" />Đại lý: {agencyName}</span>}
                          {user.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>}
                          {user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Registration details */}
                    {reg && (
                      <div className="mt-3 ml-13 pl-3 border-l-2 border-amber-200 bg-amber-50/50 rounded-r-lg p-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-xs text-gray-400">Khóa học</span>
                            <p className="font-medium text-gray-700">{COURSE_LABELS[reg.course] || reg.course || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Quốc tịch</span>
                            <p className="font-medium text-gray-700">{reg.nationality || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Ngày sinh</span>
                            <p className="font-medium text-gray-700">{formatDate(reg.dob)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Giới tính</span>
                            <p className="font-medium text-gray-700">{reg.gender || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">CCCD/Hộ chiếu</span>
                            <p className="font-medium text-gray-700">{reg.idNumber || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Ngày cấp</span>
                            <p className="font-medium text-gray-700">{formatDate(reg.idIssueDate)}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Nơi cấp</span>
                            <p className="font-medium text-gray-700">{reg.idIssuePlace || '—'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Địa chỉ thường trú</span>
                            <p className="font-medium text-gray-700">{reg.permanentAddress || '—'}</p>
                          </div>
                        </div>
                        {reg.documents && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(reg.documents).map(([key, has]) => (
                              <span key={key} className={`text-xs px-2 py-0.5 rounded-full ${has ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {has ? '✅' : '❌'} {key}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!reg && (
                      <div className="mt-3 ml-13 pl-3 border-l-2 border-gray-200 bg-gray-50 rounded-r-lg p-3">
                        <p className="text-xs text-gray-400 italic">Chưa có đơn đăng ký chi tiết (đăng ký trước khi đồng bộ)</p>
                      </div>
                    )}

                    <div className="mt-2 ml-13 text-xs text-gray-400">
                      Đăng ký: {formatDate(user.createdAt)}
                    </div>
                  </div>

                  <div className="flex gap-2 sm:flex-col sm:min-w-[120px]">
                    <button
                      onClick={() => {
                        if (user.rank === 'A' || user.rank === 'B') handleApproveAccount(user, user.rank);
                        else setRankModal(user);
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Duyệt
                    </button>
                    <button
                      onClick={() => handleRejectAccount(user)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" /> Từ chối
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Hồ sơ chờ duyệt (Nhân viên duyệt step='staff') ── */}
      {activeTab === 'pending-enr' && (
        <div className="space-y-3">
          {pendingEnrollments.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">
              <FileText className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p className="text-lg font-medium">Không có hồ sơ chờ duyệt</p>
              <p className="text-sm mt-1">Hồ sơ sẽ xuất hiện ở đây khi Đại lý nhập học viên có khóa học</p>
            </div>
          )}
          {pendingEnrollments.map(enr => (
            <div key={enr.id} className="card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {(enr.student_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{enr.student_name || `Học viên #${enr.student_id}`}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{enr.course_name || '—'}</span>
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{enr.enrollment_code || ''}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 sm:min-w-[120px]">
                  <button
                    onClick={() => handleApproveEnrollment(enr)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Duyệt hồ sơ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Phiếu thu chờ duyệt ── */}
      {activeTab === 'pending-txn' && (
        <div className="space-y-3">
          {pendingTxns.map(txn => (
            <div key={txn.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{txn.submittedByName || 'Học viên'}</p>
                  <p className="text-sm text-gray-500">Invoice: {txn.invoiceId} • {formatPrice(txn.amount)}</p>
                  <p className="text-xs text-gray-400">{txn.method} • {txn.note || ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApproveTxn(txn)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Duyệt</button>
                  <button onClick={async () => {
                    const reason = await showPrompt({ title: 'Lý do từ chối', message: 'Vui lòng nhập lý do từ chối:', required: true });
                    if (!reason) return;
                    handleRejectTxn(txn, reason);
                  }} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">Từ chối</button>
                </div>
              </div>
            </div>
          ))}
          {pendingTxns.length === 0 && <div className="text-center py-8 text-gray-400">✅ Không có phiếu chờ duyệt</div>}
        </div>
      )}

      {/* ── TAB: Tất cả hóa đơn ── */}
      {activeTab === 'all-invoices' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Học viên</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Khóa học</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Học phí</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Đã đóng</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Đại lý</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th>
            </tr></thead>
            <tbody>
              {allInvoices.map(inv => {
                const status = inv.status || inv.step || 'pending';
                const st = STATUS_MAP[status] || STATUS_MAP.pending;
                const Icon = st.icon;
                return (
                  <tr key={inv.id} className="border-b hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium">{inv.studentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{inv.courseName}</td>
                    <td className="px-4 py-3 text-sm">{formatPrice(inv.basePrice || inv.amount)}</td>
                    <td className="px-4 py-3 text-sm">{formatPrice(inv.totalPaid)}</td>
                    <td className="px-4 py-3">
                      {inv.agencyName ? (
                        <span className="badge bg-orange-100 text-orange-700 text-xs flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {inv.agencyName}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`badge text-xs ${st.color}`}><Icon className="w-3 h-3 inline mr-1" />{st.label}</span></td>
                  </tr>
                );
              })}
              {allInvoices.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal chọn Hạng thi (khi duyệt học viên chưa có hạng) ── */}
      {rankModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRankModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Chọn Hạng thi</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Học viên <span className="font-semibold">{rankModal.fullName}</span> chưa có Hạng thi. Chọn hạng để duyệt và tạo hồ sơ học phí:
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { const u = rankModal; setRankModal(null); handleApproveAccount(u, 'A'); }}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  Hạng A — VLOS (15.000.000 ₫)
                </button>
                <button
                  onClick={() => { const u = rankModal; setRankModal(null); handleApproveAccount(u, 'B'); }}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                >
                  Hạng B — BVLOS (25.000.000 ₫)
                </button>
              </div>
              <button
                onClick={() => setRankModal(null)}
                className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
