import { useState, useEffect, useCallback } from 'react';
import {
  Search, CheckCircle, XCircle, Users, CreditCard, DollarSign, Eye,
  Clock, AlertTriangle, Ban, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, School, Banknote, BarChart3, FileText, Download, UserPlus,
  TrendingUp, TrendingDown, Target, Percent, GraduationCap, X, Building2,
  Shield, ShieldOff
} from 'lucide-react';
import {
  apiListInvoices, apiGetOverallReport, apiRecordPayment, apiConfirmReceipt, apiRejectReceipt,
  apiListTransactions, apiCreateInvoice, apiUpdateInvoice,
  apiFreezeInvoice, apiUnfreezeInvoice, apiGetInvoiceDetail,
  apiGetUsers, apiGetAgencies, apiGetCourses,
  apiMarkExempt, apiUnmarkExempt,
  emitDataChange, onDataChange,
} from '../../data/api';
import { formatCurrency, showPrompt } from '../../utils/format';
import { loadData as loadStore } from '../../data/store';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';

// ── Đồng bộ với Admin: dùng cùng STATUS_MAP, PAYMENT_METHOD_LABELS ──
const STATUS_MAP = {
  paid: { label: 'Đã thanh toán', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: 'Thanh toán 1 phần', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  pending: { label: 'Chưa thanh toán', color: 'bg-red-100 text-red-700', icon: XCircle },
  frozen: { label: 'Tạm khóa', color: 'bg-gray-200 text-gray-700', icon: Ban },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700', icon: XCircle },
  exempt: { label: '🆓 Miễn phí', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
};

const TXN_STATUS = {
  confirmed: { label: 'Đã xác nhận', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-700' },
};

const PAYMENT_METHOD_LABELS = {
  cash: '💵 Tiền mặt',
  bank_transfer: '🏦 Chuyển khoản',
  vnpay: '📱 VNPAY',
  momo: '📱 MOMO',
};

const CARD_CONFIG = [
  { key: 'received', icon: TrendingUp, iconColor: 'text-green-500', bg: 'bg-green-50/50', textColor: 'text-green-700', title: 'Tổng đã thu', type: 'received' },
  { key: 'due', icon: TrendingDown, iconColor: 'text-red-500', bg: 'bg-red-50/50', textColor: 'text-red-700', title: 'Còn phải thu', type: 'due' },
  { key: 'students', icon: Users, iconColor: 'text-blue-500', bg: 'bg-blue-50/50', textColor: 'text-blue-700', title: 'HV có học phí', type: 'students' },
  { key: 'activated', icon: Target, iconColor: 'text-purple-500', bg: 'bg-purple-50/50', textColor: 'text-purple-700', title: 'Đã kích hoạt', type: 'activated' },
  { key: 'base', icon: DollarSign, iconColor: 'text-cyan-500', bg: 'bg-cyan-50/50', textColor: 'text-cyan-700', title: 'Tổng HP gốc', type: 'base' },
  { key: 'discount', icon: Percent, iconColor: 'text-orange-500', bg: 'bg-orange-50/50', textColor: 'text-orange-700', title: 'CK Đại lý', type: 'discount' },
];

export default function StaffTuition() {
  const [invoices, setInvoices] = useState([]);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [activeTab, setActiveTab] = useState('invoices');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [report, setReport] = useState(null);

  // Detail modal
  const [showDetail, setShowDetail] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceTransactions, setInvoiceTransactions] = useState([]);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');

  // Create invoice modal
  const [showCreate, setShowCreate] = useState(false);
  const [createStudentId, setCreateStudentId] = useState('');
  const [createCourseId, setCreateCourseId] = useState('');
  const [createBasePrice, setCreateBasePrice] = useState('');
  const [createAgencyId, setCreateAgencyId] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createClassId, setCreateClassId] = useState('');
  const [allClasses, setAllClasses] = useState([]);

  const [exporting, setExporting] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [reportSearch, setReportSearch] = useState('');

  const certs = loadStore('certifications', []);

  const formatPrice = (p) => (!p || p === 0) ? '0 ₫' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

  // ═══════════════ LOAD DATA (v3 unified) ═══════════════
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, repRes, courseData, userData, agencyData, classData] = await Promise.all([
        apiListInvoices({ perPage: 100 }).catch(() => ({ data: [] })),
        apiGetOverallReport().catch(() => ({ data: {} })),
        apiGetCourses().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetAgencies ? apiGetAgencies().catch(() => []) : Promise.resolve([]),
        fetch('/api/auth.php?action=classes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('smc-token')}` } }).then(r => r.json()).catch(() => []),
      ]);

      setInvoices(invRes?.data || []);
      setReport(repRes?.data || {});
      setCourses(Array.isArray(courseData) ? courseData : (courseData?.courses || courseData?.data || []));
      setStudents((userData?.users || userData || []).filter(u => (u.role || '') === 'STUDENT'));
      setAgencies(Array.isArray(agencyData) ? agencyData : (agencyData?.data || []));
      setAllClasses(Array.isArray(classData) ? classData.filter(c => (c.status || '') !== 'locked') : []);

      // Load pending transactions
      try {
        const txnRes = await apiListTransactions({ status: 'pending' });
        setPendingTxns(txnRes?.data || []);
      } catch {}
    } catch (err) {
      console.error('[StaffTuition] Load error:', err);
      toast.error('Không thể tải dữ liệu học phí');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time sync — lắng nghe sự kiện từ Admin và các nguồn khác
  useEffect(() => {
    const unsub1 = onDataChange('invoices', () => loadData());
    const unsub2 = onDataChange('transactions', () => loadData());
    const unsub3 = onDataChange('all', (detail) => {
      if (detail?.action === 'delete_user' || detail?.changed === 'invoices') loadData();
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [loadData]);

  // ── Handlers (v3) ──
  const handleViewDetail = async (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetail(true);
    try {
      const res = await apiGetInvoiceDetail(invoice.id);
      setInvoiceTransactions(res?.data?.transactions || []);
      setSelectedInvoice(res?.data || invoice);
    } catch (err) {
      toast.error('Không thể tải chi tiết hóa đơn');
      setInvoiceTransactions([]);
    }
  };

  const handleRecordPayment = async () => {
    if (!payInvoiceId || !payAmount || parseInt(payAmount) <= 0) {
      toast.error('Vui lòng nhập số tiền'); return;
    }
    try {
      const res = await apiRecordPayment({
        invoiceId: payInvoiceId,
        amount: parseInt(payAmount),
        method: payMethod,
        note: payNote,
      });
      toast.success(res.message || 'Đã ghi nhận thanh toán!');
      setShowPayModal(false);
      setPayInvoiceId('');
      setPayAmount('');
      setPayNote('');
      emitDataChange('invoices', { action: 'payment_recorded' });
      await loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleConfirmReceipt = async (txnId) => {
    try {
      const res = await apiConfirmReceipt({ transactionId: txnId });
      toast.success(res.message);
      emitDataChange('invoices', { action: 'receipt_confirmed' });
      await loadData();
      if (showDetail && selectedInvoice) {
        handleViewDetail(selectedInvoice);
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleRejectReceipt = async (txnId) => {
    let reason = await showPrompt({ title: 'Lý do từ chối', message: 'Vui lòng nhập lý do từ chối:', required: true });
    if (!reason) return;
    reason = reason.trim();
    if (!reason) { toast.error('Vui lòng nhập lý do từ chối'); return; }
    try {
      const res = await apiRejectReceipt({ transactionId: txnId, reason });
      toast.success(res.message);
      emitDataChange('invoices', { action: 'receipt_rejected' });
      await loadData();
      if (showDetail && selectedInvoice) {
        handleViewDetail(selectedInvoice);
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleFreeze = async (inv) => {
    const isFrozen = inv.status === 'frozen';
    const action = isFrozen ? 'mở khóa' : 'tạm khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} hóa đơn của ${inv.studentName}?`)) return;
    try {
      const fn = isFrozen ? apiUnfreezeInvoice : apiFreezeInvoice;
      const res = await fn(inv.id);
      toast.success(res.message);
      emitDataChange('invoices', { action: isFrozen ? 'unfrozen' : 'frozen' });
      await loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleCreateInvoice = async () => {
    if (!createStudentId || !createCourseId) { toast.error('Chọn học viên và khóa học'); return; }
    try {
      const res = await apiCreateInvoice({
        studentId: createStudentId,
        courseId: createCourseId,
        basePrice: parseInt(createBasePrice) || 0,
        agencyId: createAgencyId,
        classId: createClassId,
        note: createNote,
      });
      toast.success(res.message || 'Đã tạo hóa đơn!');
      setShowCreate(false);
      emitDataChange('invoices', { action: 'invoice_created' });
      await loadData();
      setCreateStudentId('');
      setCreateCourseId('');
      setCreateBasePrice('');
      setCreateAgencyId('');
      setCreateClassId('');
      setCreateNote('');
    } catch (err) { toast.error(err.message); }
  };

  const handleMarkExempt = async (invoice) => {
    const studentName = invoice.studentName || 'học viên này';
    if (!window.confirm(`🆓 Đánh dấu "${studentName}" là tài khoản Test/Miễn phí?`)) return;
    try {
      const res = await apiMarkExempt(invoice.studentId, invoice.courseId || '');
      toast.success(res.message || 'Đã đánh dấu miễn phí!');
      emitDataChange('invoices', { action: 'mark_exempt' });
      await loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleUnmarkExempt = async (invoice) => {
    const studentName = invoice.studentName || 'học viên này';
    if (!window.confirm(`🔄 Bỏ đánh dấu miễn phí cho "${studentName}"?`)) return;
    try {
      const res = await apiUnmarkExempt(invoice.studentId);
      toast.success(res.message || 'Đã bỏ miễn phí!');
      emitDataChange('invoices', { action: 'unmark_exempt' });
      await loadData();
    } catch (err) { toast.error(err.message); }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const rows = filtered.map(inv => ({
        'Họ và tên': inv.studentName || '',
        'Email': inv.studentEmail || '',
        'SĐT': inv.studentPhone || '',
        'Hạng': inv.studentRank === 'A' ? 'VLOS' : inv.studentRank === 'B' ? 'BVLOS' : '',
        'Khóa học': inv.courseName || '',
        'Số tiền theo hạng': inv.basePrice || 0,
        'Đại lý': inv.agencyName || '',
        'CK Đại lý %': inv.agencyDiscountPercent || 0,
        'CK Đại lý (VNĐ)': inv.agencyDiscountAmount || 0,
        'Đã nộp (VNĐ)': inv.totalPaid || 0,
        'Phải nộp SMC (VNĐ)': inv.basePrice > 0 ? Math.round(inv.basePrice * (1 - (inv.agencyDiscountPercent || 0) / 100)) : 0,
        'Còn phải nộp (VNĐ)': inv.remainingDue || 0,
        'Trạng thái': STATUS_MAP[inv.status]?.label || inv.status,
        'Ghi chú': inv.note || '',
      }));

      if (rows.length === 0) { toast.error('Không có dữ liệu'); setExporting(false); return; }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Học phí');
      const cols = Object.keys(rows[0]);
      ws.columns = cols.map(k => ({ width: Math.min(Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 3, 50) }));
      const rH = ws.addRow(cols);
      rH.eachCell(c => { c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; });
      rows.forEach((row, i) => {
        const r = ws.addRow(cols.map(c => row[c]));
        r.eachCell((c, ci) => { if (i % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; if (cols[ci - 1]?.includes('VNĐ') && typeof row[cols[ci - 1]] === 'number') c.numFmt = '#,##0'; });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `SMC_HocPhi_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`✅ Đã xuất ${rows.length} hóa đơn`);
    } catch (err) { toast.error('Lỗi: ' + err.message); }
    setExporting(false);
  };

  // ── Filtering ──
  const filtered = invoices.filter(inv => {
    const s = search.toLowerCase();
    const ms = !s ||
      (inv.studentName || '').toLowerCase().includes(s) ||
      (inv.studentEmail || '').toLowerCase().includes(s) ||
      (inv.studentPhone || '').toLowerCase().includes(s) ||
      (inv.courseName || '').toLowerCase().includes(s) ||
      (inv.agencyName || '').toLowerCase().includes(s);
    const mst = statusFilter === 'all' || inv.status === statusFilter;
    const mcourse = !courseFilter || inv.courseId === courseFilter;
    return ms && mst && mcourse;
  });

  const paidCount = invoices.filter(i => i.status === 'paid').length;
  const partialCount = invoices.filter(i => i.status === 'partial').length;
  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const frozenCount = invoices.filter(i => i.status === 'frozen').length;
  const exemptCount = invoices.filter(i => i.status === 'exempt').length;
  const totalPaid = invoices.reduce((s, i) => s + (i.totalPaid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.remainingDue || 0), 0);

  // ──── COMPUTED FOR REPORT TAB ────
  const totalBase = invoices.reduce((s, i) => s + (i.basePrice || 0), 0);
  const totalDisc = invoices.reduce((s, i) => {
    const aid = i.agencyId || '';
    const dp = i.agencyDiscountPercent || 0;
    return aid && dp > 0 && dp < 100 ? s + (i.agencyDiscountAmount || 0) : s;
  }, 0);
  const totalActualReceived = totalPaid - totalDisc;
  const totalRemainingDue = totalDue;
  const activatedCount = invoices.filter(i => i.status === 'paid' || i.status === 'partial').length;
  const agencyCount = [...new Set(invoices.filter(i => i.agencyId && (i.agencyDiscountPercent || 0) < 100).map(i => i.agencyId))].length;
  const collectionRate = totalBase > 0 ? Math.round((totalActualReceived / totalBase) * 100) : 0;

  const formatPlain = (p) => (!p || p === 0) ? '0 ₫' : new Intl.NumberFormat('vi-VN').format(p) + ' ₫';

  const openDetail = (type) => {
    let title = '';
    let data = [];
    let highlightKey = null;
    switch (type) {
      case 'received':
        title = '📊 Chi tiết Tổng đã thu';
        data = invoices.filter(i => (i.totalPaid || 0) > 0).sort((a, b) => (b.totalPaid || 0) - (a.totalPaid || 0));
        highlightKey = 'totalPaid';
        break;
      case 'due':
        title = '📊 Chi tiết Còn phải thu';
        data = invoices.filter(i => (i.remainingDue || 0) > 0).sort((a, b) => (b.remainingDue || 0) - (a.remainingDue || 0));
        highlightKey = 'remainingDue';
        break;
      case 'students':
        title = '📊 Danh sách Học viên có học phí';
        data = [...invoices].sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
        highlightKey = null;
        break;
      case 'activated':
        title = '📊 Học viên đã kích hoạt';
        data = invoices.filter(i => i.status === 'paid' || i.status === 'partial');
        highlightKey = null;
        break;
      case 'base':
        title = '📊 Tổng Học phí gốc';
        data = [...invoices].sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
        highlightKey = 'basePrice';
        break;
      case 'discount':
        title = '📊 Chiết khấu Đại lý';
        data = invoices.filter(i => i.agencyName && (i.agencyDiscountAmount || 0) > 0).sort((a, b) => (b.agencyDiscountAmount || 0) - (a.agencyDiscountAmount || 0));
        highlightKey = 'agencyDiscountAmount';
        break;
      default: break;
    }
    setDetailModal({ type, title, data: data.map(d => ({ ...d, _highlightKey: highlightKey, studentName: d.studentName, courseName: d.courseName })) });
    setReportSearch('');
  };

  const filteredDetail = detailModal?.data?.filter(row => {
    const s = reportSearch.toLowerCase();
    if (!s) return true;
    const fields = [row.studentName, row.courseName, row.studentPhone, row.agencyName];
    return fields.some(f => (f || '').toLowerCase().includes(s));
  }) || [];

  const cardValues = {
    received: formatPlain(report?.total_actual_received ?? totalActualReceived),
    due: formatPlain(report?.total_due ?? totalRemainingDue),
    students: report?.total_students ?? invoices.length,
    activated: report?.activated_count ?? activatedCount,
    base: formatPlain(report?.total_base_price ?? totalBase),
    discount: formatPlain(report?.total_commission ?? totalDisc),
  };

  // ── Report tab computed ──
  const reportByCourse = report?.by_course || [];
  const reportByAgency = report?.by_agency || [];

  if (loading && invoices.length === 0) {
    return <div className="flex items-center justify-center py-20"><div className="text-center"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">💰 Quản lý Học phí</h1>
          <p className="text-sm text-gray-500">Hệ thống học phí v3 — Invoice + Transactions — Đồng bộ thời gian thực với Admin</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><FileText className="w-4 h-4" /> Tạo Hóa đơn</button>
          <button onClick={handleExportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Download className="w-4 h-4" /> Xuất Excel</button>
          <button onClick={loadData} className="btn-ghost flex items-center gap-1.5 text-sm"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { k: 'invoices', l: '📋 Hóa đơn' },
          { k: 'pending', l: `⏳ Chờ duyệt (${pendingTxns.length})` },
          { k: 'report', l: '📊 Báo cáo' },
        ].map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === t.k ? 'bg-white shadow text-blue-700' : 'text-gray-600'}`}>{t.l}</button>
        ))}
      </div>

      {/* Stats — đồng bộ với Admin */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Tổng hóa đơn', val: invoices.length, color: 'purple' },
          { label: 'Đã TT đủ', val: paidCount, color: 'green' },
          { label: 'TT 1 phần', val: partialCount, color: 'amber' },
          { label: 'Chưa TT', val: pendingCount, color: 'red' },
          { label: '🆓 Miễn phí', val: exemptCount, color: 'emerald' },
          { label: 'Chờ duyệt', val: pendingTxns.length, color: 'blue' },
        ].map(s => <div key={s.label} className={`card p-3 text-center bg-${s.color}-50/50`}><div className={`text-lg font-extrabold text-${s.color}-700`}>{s.val}</div><div className="text-xs text-gray-500">{s.label}</div></div>)}
      </div>

      {/* ═══ PENDING TAB ═══ */}
      {activeTab === 'pending' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-amber-50">
            <h3 className="font-bold text-amber-800 flex items-center gap-2"><Clock className="w-4 h-4" /> Giao dịch chờ xác nhận</h3>
            <p className="text-xs text-amber-600 mt-1">Học viên đã nộp biên lai chuyển khoản — cần xác nhận</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b-2"><th className="text-left p-3">Học viên</th><th className="text-right p-3">Số tiền</th><th className="text-left p-3">Phương thức</th><th className="text-left p-3">Ngày nộp</th><th className="text-left p-3">Ghi chú</th><th className="text-center p-3">Thao tác</th></tr></thead>
              <tbody>
                {pendingTxns.length === 0 ? <tr><td colSpan={6} className="text-center p-10 text-gray-400">Không có giao dịch chờ duyệt</td></tr> :
                  pendingTxns.map(txn => (
                    <tr key={txn.id} className="border-b hover:bg-amber-50">
                      <td className="p-3 font-semibold">{txn.submittedByName || txn.studentId}</td>
                      <td className="p-3 text-right font-mono font-bold text-green-600">{formatPrice(txn.amount)}</td>
                      <td className="p-3">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</td>
                      <td className="p-3 text-gray-500 text-xs">{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                      <td className="p-3 text-gray-500 max-w-[200px] truncate">{txn.note}</td>
                      <td className="p-3"><div className="flex justify-center gap-2">
                        <button onClick={() => handleConfirmReceipt(txn.id)} className="btn-primary text-xs px-3 py-1">✅ Duyệt</button>
                        <button onClick={() => handleRejectReceipt(txn.id)} className="btn-ghost text-xs px-3 py-1 text-red-600">❌ Từ chối</button>
                      </div></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ INVOICES TAB ═══ */}
      {(activeTab === 'invoices') && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm tên, email, SĐT, khóa học, đại lý..." /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto">
              <option value="all">Tất cả trạng thái</option>
              <option value="paid">Đã TT đủ</option>
              <option value="partial">TT 1 phần</option>
              <option value="pending">Chưa TT</option>
              <option value="frozen">Tạm khóa</option>
              <option value="exempt">🆓 Miễn phí/Test</option>
            </select>
            <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="input-field w-auto">
              <option value="">Tất cả khóa học</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="text-left p-2.5 font-semibold text-xs w-8">#</th>
                    <th className="text-left p-2.5 font-semibold text-xs">Học viên / Khóa học</th>
                    <th className="text-center p-2.5 font-semibold text-xs w-16">Hạng</th>
                    <th className="text-right p-2.5 font-semibold text-xs whitespace-nowrap">Số tiền theo hạng</th>
                    <th className="text-right p-2.5 font-semibold text-xs whitespace-nowrap">Đã nộp</th>
                    <th className="text-right p-2.5 font-semibold text-xs whitespace-nowrap">Còn phải nộp</th>
                    <th className="text-right p-2.5 font-semibold text-xs whitespace-nowrap">CK ĐL</th>
                    <th className="text-right p-2.5 font-semibold text-xs whitespace-nowrap">Phải nộp SMC</th>
                    <th className="text-center p-2.5 font-semibold text-xs w-24">Trạng thái</th>
                    <th className="text-center p-2.5 font-semibold text-xs w-24">HĐ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={10} className="text-center p-10 text-gray-400">
                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-semibold">Không có hóa đơn nào</p>
                    <p className="text-sm">Nhấn "Tạo Hóa đơn" để bắt đầu</p>
                  </td></tr> :
                    filtered.map((inv, idx) => {
                      const pct = inv.basePrice > 0 ? Math.round((inv.totalPaid || 0) / inv.basePrice * 100) : 0;
                      const hasAgency = inv.agencyId && inv.agencyName;
                      const owesSmc = hasAgency ? Math.round(inv.basePrice * (1 - (inv.agencyDiscountPercent || 0) / 100)) : inv.basePrice;
                      const st = STATUS_MAP[inv.status] || STATUS_MAP.pending;
                      const rankLabel = inv.studentRank === 'A' ? 'VLOS' : inv.studentRank === 'B' ? 'BVLOS' : '—';
                      const rankColor = inv.studentRank === 'A' ? 'bg-blue-100 text-blue-700' : inv.studentRank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500';
                      return (
                        <tr key={inv.id || idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-2.5 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="p-2.5">
                            <p className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight">{inv.studentName || '—'}</p>
                            <p className="text-xs text-gray-400 leading-tight">{inv.courseName || '—'}</p>
                            {inv.agencyName && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded mt-0.5">
                                <Building2 className="w-2.5 h-2.5" /> {inv.agencyName} (CK {inv.agencyDiscountPercent || 0}%)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className={`badge text-[10px] font-bold whitespace-nowrap ${rankColor}`}>{rankLabel}</span>
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs text-gray-700 whitespace-nowrap">{formatPrice(inv.basePrice)}</td>
                          <td className="p-2.5 text-right font-mono text-xs font-semibold text-green-600 whitespace-nowrap">{formatPrice(inv.totalPaid)}</td>
                          <td className="p-2.5 text-right font-mono text-xs font-bold whitespace-nowrap" style={{color: (inv.remainingDue || 0) > 0 ? '#dc2626' : '#6b7280'}}>
                            {(inv.remainingDue || 0) > 0 ? formatPrice(inv.remainingDue) : '✅ Đã nộp đủ'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs whitespace-nowrap">
                            {hasAgency ? (
                              <span className="text-orange-600 font-medium">{inv.agencyDiscountPercent || 0}% (-{formatPrice(inv.agencyDiscountAmount || 0)})</span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="p-2.5 text-right font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">{formatPrice(owesSmc)}</td>
                          <td className="p-2.5 text-center">
                            <span className={`badge text-[10px] whitespace-nowrap ${st.color}`}>{st.label}</span>
                            {pct > 0 && pct < 100 && (
                              <div className="mt-1 h-1 bg-gray-200 rounded-full w-full max-w-[60px] mx-auto">
                                <div className="h-full bg-amber-500 rounded-full" style={{width: `${pct}%`}} />
                              </div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-0.5">
                              <button onClick={() => handleViewDetail(inv)} className="btn-ghost p-1 text-blue-600 hover:bg-blue-50 rounded" title="Xem chi tiết">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {inv.status !== 'exempt' && inv.status !== 'frozen' && (
                                <button onClick={() => { setPayInvoiceId(inv.id); setPayAmount(inv.remainingDue || ''); setShowPayModal(true); }} className="btn-ghost p-1 text-green-600 hover:bg-green-50 rounded" title="Thanh toán">
                                  <Banknote className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {inv.status !== 'exempt' && (
                                <button onClick={() => handleToggleFreeze(inv)} className={`btn-ghost p-1 rounded ${inv.status === 'frozen' ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`} title={inv.status === 'frozen' ? 'Mở khóa' : 'Tạm khóa'}>
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {inv.status === 'exempt' ? (
                                <button onClick={() => handleUnmarkExempt(inv)} className="btn-ghost p-1 text-orange-600 hover:bg-orange-50 rounded" title="Bỏ miễn phí">
                                  <ShieldOff className="w-3.5 h-3.5" />
                                </button>
                              ) : inv.status !== 'frozen' && (
                                <button onClick={() => handleMarkExempt(inv)} className="btn-ghost p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Đánh dấu Test/Miễn phí">
                                  <Shield className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══ REPORT TAB ═══ */}
      {activeTab === 'report' && (
        <>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="card p-5">
              <h3 className="font-bold mb-1 flex items-center gap-2 text-sm"><Users className="w-4 h-4" /> Tuyển sinh</h3>
              <div className="text-2xl font-extrabold">{invoices.length}</div>
              <div className="text-xs text-gray-500">Tổng hóa đơn học phí</div>
            </div>
            <div className="card p-5">
              <h3 className="font-bold mb-1 flex items-center gap-2 text-sm"><GraduationCap className="w-4 h-4" /> Tốt nghiệp</h3>
              <div className="text-2xl font-extrabold">{certs.length}</div>
              <div className="text-xs text-gray-500">Chứng chỉ đã cấp</div>
            </div>
          </div>

          {/* 6 clickable cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {CARD_CONFIG.map(card => (
              <button
                key={card.key}
                onClick={() => openDetail(card.type)}
                className={`card p-4 ${card.bg} hover:shadow-lg hover:scale-[1.02] transition-all text-left cursor-pointer group relative`}
                title="Click để xem danh sách"
              >
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <card.icon className={`w-3.5 h-3.5 ${card.iconColor}`} /> {card.title}
                </div>
                <div className={`text-lg font-extrabold ${card.textColor} break-all`}>{cardValues[card.key]}</div>
                <Eye className="w-3 h-3 text-gray-300 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Status + Rate */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="card p-3 text-center"><div className="text-lg font-extrabold text-green-600">{paidCount}</div><div className="text-xs text-gray-500">✅ Đã TT đủ</div></div>
            <div className="card p-3 text-center"><div className="text-lg font-extrabold text-amber-600">{partialCount}</div><div className="text-xs text-gray-500">⚠️ Một phần</div></div>
            <div className="card p-3 text-center"><div className="text-lg font-extrabold text-red-600">{pendingCount}</div><div className="text-xs text-gray-500">❌ Chưa TT</div></div>
            <div className="card p-3 text-center"><div className="text-lg font-extrabold text-gray-600">{frozenCount}</div><div className="text-xs text-gray-500">🚫 Tạm khóa</div></div>
            <div className="card p-3 text-center"><div className="text-lg font-extrabold text-blue-700">{collectionRate}%</div><div className="text-xs text-gray-500">📈 Tỷ lệ thu</div></div>
          </div>

          {/* Revenue by Course */}
          {reportByCourse.length > 0 && (
            <div className="card p-5 mb-6">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm"><DollarSign className="w-4 h-4" /> Doanh thu theo hạng thi</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b-2">
                      <th className="text-left p-2.5 font-semibold text-gray-600">Hạng thi</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">Lớp</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">HV</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-16">Hóa đơn</th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">Doanh thu dự kiến</th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">Đã thu</th>
                      <th className="text-right p-2.5 font-semibold text-gray-600">Còn phải thu</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-20">Tỷ lệ thu</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">✅ Đủ</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">⚠️ 1P</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">❌ Chưa</th>
                      <th className="text-center p-2.5 font-semibold text-gray-600 w-14">🆓 MP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportByCourse.map((c, idx) => {
                      const ttl = (c.received || 0) + (c.due || 0);
                      const pct = ttl > 0 ? Math.round((c.received || 0) / ttl * 100) : 0;
                      return (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2.5 font-semibold text-sm">{c.name || 'Khóa học'}</td>
                          <td className="p-2.5 text-center text-xs">{c.classCount || 0}</td>
                          <td className="p-2.5 text-center text-xs">{c.students || 0}</td>
                          <td className="p-2.5 text-center text-xs">{c.invoices || 0}</td>
                          <td className="p-2.5 text-right font-mono text-xs text-gray-700 whitespace-nowrap">{(c.basePrice || 0).toLocaleString('vi-VN')} ₫</td>
                          <td className="p-2.5 text-right font-mono text-xs text-green-600 whitespace-nowrap">{(c.received || 0).toLocaleString('vi-VN')} ₫</td>
                          <td className="p-2.5 text-right font-mono text-xs text-red-600 whitespace-nowrap">{(c.due || 0).toLocaleString('vi-VN')} ₫</td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-10 h-1.5 bg-gray-200 rounded-full shrink-0">
                                <div className="h-full rounded-full" style={{width: pct+'%', background: pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'}} />
                              </div>
                              <span className="text-xs font-medium w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="p-2.5 text-center text-xs text-green-600 font-bold">{c.paidStudentCount || 0}</td>
                          <td className="p-2.5 text-center text-xs text-amber-600 font-bold">{c.partialStudentCount || 0}</td>
                          <td className="p-2.5 text-center text-xs text-red-600 font-bold">{c.unpaidStudentCount || 0}</td>
                          <td className="p-2.5 text-center">{(c.freeCount || 0) > 0 ? <span className="badge text-xs bg-blue-100 text-blue-700">{c.freeCount}</span> : <span className="text-xs text-gray-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t-2">
                      <td className="p-2.5">Tổng cộng</td>
                      <td className="p-2.5 text-center">{reportByCourse.reduce((s, c) => s + (c.classCount || 0), 0)}</td>
                      <td className="p-2.5 text-center">{report?.total_students || 0}</td>
                      <td className="p-2.5 text-center">{report?.total_invoices || invoices.length}</td>
                      <td className="p-2.5 text-right text-gray-700">{formatPrice(report?.total_base_price || totalBase)}</td>
                      <td className="p-2.5 text-right text-green-600">{formatPrice(report?.total_received || totalPaid)}</td>
                      <td className="p-2.5 text-right text-red-600">{formatPrice(report?.total_due || totalDue)}</td>
                      <td className="p-2.5 text-center">{report?.collection_rate || collectionRate}%</td>
                      <td className="p-2.5 text-center">{reportByCourse.reduce((s, c) => s + (c.paidStudentCount || 0), 0)}</td>
                      <td className="p-2.5 text-center">{reportByCourse.reduce((s, c) => s + (c.partialStudentCount || 0), 0)}</td>
                      <td className="p-2.5 text-center">{reportByCourse.reduce((s, c) => s + (c.unpaidStudentCount || 0), 0)}</td>
                      <td className="p-2.5 text-center">{report?.exempt_count || 0}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Agency summary */}
          {reportByAgency.length > 0 && (
            <div className="card p-5 mb-6">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm"><Building2 className="w-4 h-4" /> Chiết khấu theo Đại lý</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b-2"><th className="text-left p-2.5 font-semibold text-gray-600">Đại lý</th><th className="text-center p-2.5 font-semibold text-gray-600 w-14">HV</th><th className="text-right p-2.5 font-semibold text-gray-600">Đã thu</th><th className="text-right p-2.5 font-semibold text-gray-600">Còn thiếu</th><th className="text-right p-2.5 font-semibold text-gray-600">CK</th></tr></thead>
                  <tbody>
                    {reportByAgency.map((a, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2.5 font-semibold text-sm">{a.name}</td>
                        <td className="p-2.5 text-center">{a.students}</td>
                        <td className="p-2.5 text-right font-mono text-sm text-green-600">{Number(a.received || 0).toLocaleString('vi-VN')} ₫</td>
                        <td className="p-2.5 text-right font-mono text-sm text-red-600">{Number(a.due || 0).toLocaleString('vi-VN')} ₫</td>
                        <td className="p-2.5 text-right font-mono text-sm text-orange-600">{Number(a.discount_total || a.discountTotal || 0).toLocaleString('vi-VN')} ₫</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 text-center mt-4">
            Dữ liệu liên thông real-time từ invoices + transactions (v3) — Đồng bộ với Admin
          </div>
        </>
      )}

      {/* ═══ REPORT DETAIL MODAL ═══ */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-1 sm:p-4 pt-4 sm:pt-10" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] sm:max-w-7xl max-h-[85vh] sm:max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div><h3 className="text-base font-extrabold text-gray-900">{detailModal.title}</h3><p className="text-xs text-gray-500">{filteredDetail.length} mục</p></div>
              <button onClick={() => setDetailModal(null)} className="btn-ghost p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-4 py-2 border-b bg-gray-50 shrink-0">
              <div className="relative max-w-sm"><Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={reportSearch} onChange={e => setReportSearch(e.target.value)} className="input-field pl-8 py-1.5 text-sm" placeholder="Tìm theo tên, khóa học..." /></div>
            </div>
            <div className="flex-1 overflow-auto px-2 py-3">
              {filteredDetail.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Search className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Không có dữ liệu</p></div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-xs sm:text-sm">
                    <thead><tr className="bg-gray-50 border-b-2 sticky top-0 z-10"><th className="text-left p-2 font-semibold whitespace-nowrap w-6">#</th><th className="text-left p-2 font-semibold whitespace-nowrap">Học viên</th><th className="text-left p-2 font-semibold whitespace-nowrap">Khóa học</th><th className="text-right p-2 font-semibold whitespace-nowrap">Tổng HP</th><th className="text-right p-2 font-semibold whitespace-nowrap">Đã nộp</th><th className="text-right p-2 font-semibold whitespace-nowrap">Còn thiếu</th><th className="text-center p-2 font-semibold whitespace-nowrap">Trạng thái</th></tr></thead>
                    <tbody>
                      {filteredDetail.map((row, idx) => {
                        const st = STATUS_MAP[row.status] || STATUS_MAP.pending;
                        return (
                          <tr key={row.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-2 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="p-2"><p className="font-semibold text-gray-900 whitespace-nowrap text-xs sm:text-sm">{row.studentName || '—'}</p>{row.agencyName && <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs text-orange-600 bg-orange-50 px-1 py-0.5 rounded mt-0.5 whitespace-nowrap"><Building2 className="w-3 h-3 shrink-0" /> {row.agencyName}</span>}</td>
                            <td className="p-2 text-xs sm:text-sm text-gray-600 max-w-[150px] truncate">{row.courseName || '—'}</td>
                            <td className="p-2 text-right font-mono text-xs sm:text-sm text-gray-500 whitespace-nowrap">{formatPlain(row.basePrice)}</td>
                            <td className="p-2 text-right font-mono text-xs sm:text-sm font-semibold text-green-600 whitespace-nowrap">{formatPlain(row.totalPaid)}</td>
                            <td className="p-2 text-right font-mono text-xs sm:text-sm font-bold whitespace-nowrap" style={{color: (row.remainingDue || 0) > 0 ? '#dc2626' : '#6b7280'}}>{(row.remainingDue || 0) > 0 ? formatPlain(row.remainingDue) : '—'}</td>
                            <td className="p-2 text-center"><span className={`badge text-[10px] sm:text-xs whitespace-nowrap ${st.color}`}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 border-t bg-gray-50 flex justify-between items-center shrink-0">
              <span className="text-xs text-gray-500">{filteredDetail.length > 0 && detailModal?.data?.[0]?._highlightKey && (<>Tổng: <strong className="text-gray-700">{formatPlain(filteredDetail.reduce((s, r) => s + (r[r._highlightKey] || 0), 0))}</strong></>)}</span>
              <button onClick={() => setDetailModal(null)} className="btn-ghost text-sm px-3 py-1.5 rounded-lg">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INVOICE DETAIL MODAL ═══ */}
      {showDetail && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b sticky top-0 bg-white z-10 flex justify-between"><h3 className="text-lg font-extrabold">🧾 Chi tiết Hóa đơn</h3><button onClick={() => setShowDetail(false)} className="btn-ghost p-2">✕</button></div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div><span className="text-xs text-gray-500">Mã hóa đơn</span><p className="font-mono font-bold text-sm truncate">{String(selectedInvoice.id ?? '').substring(0, 16)}...</p></div>
                <div><span className="text-xs text-gray-500">Trạng thái</span><p><span className={`badge text-xs ${(STATUS_MAP[selectedInvoice.status] || STATUS_MAP.pending).color}`}>{(STATUS_MAP[selectedInvoice.status] || STATUS_MAP.pending).label}</span></p></div>
                <div><span className="text-xs text-gray-500">Học viên</span><p className="font-semibold text-sm">{selectedInvoice.studentName}</p></div>
                <div><span className="text-xs text-gray-500">Hạng</span><p><span className={`badge text-xs font-bold ${selectedInvoice.studentRank === 'A' ? 'bg-blue-100 text-blue-700' : selectedInvoice.studentRank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{selectedInvoice.studentRank === 'A' ? 'VLOS' : selectedInvoice.studentRank === 'B' ? 'BVLOS' : '—'}</span></p></div>
                <div><span className="text-xs text-gray-500">Khóa học</span><p className="text-sm">{selectedInvoice.courseName}</p></div>
                <div><span className="text-xs text-gray-500">Đại lý</span><p className="text-sm">{selectedInvoice.agencyName || '—'}{selectedInvoice.agencyDiscountPercent > 0 ? ` (CK ${selectedInvoice.agencyDiscountPercent}%)` : ''}</p></div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Số tiền theo hạng</div><div className="font-bold text-lg text-gray-700">{formatPrice(selectedInvoice.basePrice)}</div></div>
                  <div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Đã nộp</div><div className="font-bold text-lg text-green-600">{formatPrice(selectedInvoice.totalPaid)}</div></div>
                  <div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Phải nộp SMC</div><div className="font-bold text-lg text-blue-700">{formatPrice(selectedInvoice.basePrice > 0 ? Math.round(selectedInvoice.basePrice * (1 - (selectedInvoice.agencyDiscountPercent || 0) / 100)) : 0)}</div></div>
                  <div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Còn phải nộp</div><div className="font-bold text-lg text-red-600">{formatPrice(selectedInvoice.remainingDue)}</div></div>
                  <div className="text-center"><div className="text-xs text-gray-500 mb-0.5">Chiết khấu ĐL</div><div className="font-bold text-lg text-orange-600">{formatPrice(selectedInvoice.agencyDiscountAmount || 0)}</div></div>
                </div>
                {selectedInvoice.basePrice > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>Tiến độ thanh toán</span><span>{formatPrice(selectedInvoice.totalPaid)} / {formatPrice(selectedInvoice.basePrice)} ({Math.round((selectedInvoice.totalPaid || 0) / selectedInvoice.basePrice * 100)}%)</span></div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{width: `${Math.min(100, Math.round((selectedInvoice.totalPaid || 0) / selectedInvoice.basePrice * 100))}%`}} /></div>
                  </div>
                )}
              </div>

              {/* Transactions */}
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">Lịch sử giao dịch ({invoiceTransactions.length})</h4>
              {invoiceTransactions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Chưa có giao dịch nào</p> :
                <div className="space-y-2">
                  {invoiceTransactions.map(txn => {
                    const ts = TXN_STATUS[txn.status] || { label: txn.status, color: 'bg-gray-100' };
                    return (
                      <div key={txn.id} className="flex items-center justify-between p-3 bg-white border rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${txn.status === 'confirmed' ? 'bg-green-500' : txn.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <span className="font-mono font-bold text-green-600">{formatPrice(txn.amount)}</span>
                          <span className="text-gray-400">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</span>
                          <span className="text-gray-400 text-xs">{txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge text-xs ${ts.color}`}>{ts.label}</span>
                          {txn.status === 'pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => handleConfirmReceipt(txn.id)} className="text-green-600 hover:bg-green-50 px-2 py-0.5 rounded text-xs font-bold">Duyệt</button>
                              <button onClick={() => handleRejectReceipt(txn.id)} className="text-red-600 hover:bg-red-50 px-2 py-0.5 rounded text-xs">Từ chối</button>
                            </div>
                          )}
                          {txn.note && <span className="text-xs text-gray-400 max-w-[100px] truncate">{txn.note}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              }

              {selectedInvoice.remainingDue > 0 && selectedInvoice.status !== 'frozen' && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-3">Ghi nhận thanh toán nhanh</h4>
                  <div className="flex gap-2">
                    <input type="number" value={payAmount || selectedInvoice.remainingDue} onChange={e => setPayAmount(e.target.value)} className="input-field flex-1" placeholder="Số tiền" />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field w-auto"><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option></select>
                    <button onClick={async () => {
                      try {
                        await apiRecordPayment({ invoiceId: selectedInvoice.id, amount: parseInt(payAmount), method: payMethod, note: '' });
                        toast.success('Đã ghi nhận!');
                        emitDataChange('invoices');
                        setShowDetail(false);
                        await loadData();
                      } catch (err) { toast.error(err.message); }
                    }} className="btn-primary px-4 py-2 text-sm">✅ Xác nhận</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ PAYMENT MODAL ═══ */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowPayModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between"><h3 className="text-lg font-extrabold">💵 Ghi nhận thanh toán</h3><button onClick={() => setShowPayModal(false)} className="btn-ghost p-2">✕</button></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Hóa đơn</label><input value={payInvoiceId} disabled className="input-field bg-gray-50 text-gray-500" /></div>
              <div><label className="block text-sm font-semibold mb-1">Số tiền (VNĐ) <span className="text-red-500">*</span></label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" placeholder="Nhập số tiền" autoFocus /></div>
              <div><label className="block text-sm font-semibold mb-1">Phương thức</label><select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field"><option value="cash">💵 Tiền mặt</option><option value="bank_transfer">🏦 Chuyển khoản</option></select></div>
              <div><label className="block text-sm font-semibold mb-1">Ghi chú</label><input value={payNote} onChange={e => setPayNote(e.target.value)} className="input-field" placeholder="Ghi chú..." /></div>
              <button onClick={handleRecordPayment} className="btn-primary w-full py-3 font-bold">✅ Xác nhận thanh toán</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE INVOICE MODAL ═══ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b"><h3 className="text-lg font-extrabold">📝 Tạo Hóa đơn Mới</h3></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold mb-1">Học viên <span className="text-red-500">*</span></label><select value={createStudentId} onChange={e => setCreateStudentId(e.target.value)} className="input-field"><option value="">— Chọn học viên —</option>{students.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING').map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.email || s.phone})</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Khóa học <span className="text-red-500">*</span></label><select value={createCourseId} onChange={e => setCreateCourseId(e.target.value)} className="input-field"><option value="">— Chọn khóa học —</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name} — {formatPrice(c.price)}</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Học phí gốc (VNĐ)</label><input type="number" value={createBasePrice} onChange={e => setCreateBasePrice(e.target.value)} className="input-field" placeholder="Tự động lấy từ khóa học nếu để trống" /></div>
              <div><label className="block text-sm font-semibold mb-1">Đại lý (nếu có)</label><select value={createAgencyId} onChange={e => setCreateAgencyId(e.target.value)} className="input-field"><option value="">— Không có đại lý —</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name} (CK {a.discountPercent || 0}%)</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Xếp lớp (tùy chọn)</label><select value={createClassId} onChange={e => setCreateClassId(e.target.value)} className="input-field"><option value="">— Tự xếp lớp sau —</option>{allClasses.filter(c => c.course_id === createCourseId || !createCourseId).map(c => <option key={c.id} value={c.id}>{c.name} ({(c.student_ids || []).length}/{c.max_students || 20} HV)</option>)}</select></div>
              <div><label className="block text-sm font-semibold mb-1">Ghi chú</label><input value={createNote} onChange={e => setCreateNote(e.target.value)} className="input-field" placeholder="Ghi chú nội bộ..." /></div>
              <button onClick={handleCreateInvoice} className="btn-primary w-full py-3 font-bold text-lg">✅ Tạo Hóa đơn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
