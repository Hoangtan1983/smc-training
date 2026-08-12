import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, DollarSign, Users, BookOpen, CheckCircle,
  AlertTriangle, Download, BarChart3, Banknote, CreditCard,
  TrendingUp, TrendingDown, Filter, Percent, Building2,
  Eye, XCircle, Ban, FileText, Wallet, Clock, History,
  Receipt, ArrowUpDown, Calendar, Shield, ShieldOff, Zap
} from 'lucide-react';
import {
  apiGetUsers, apiGetAgencies, apiGetCourses,
  apiListInvoices, apiGetOverallReport, apiGetInvoiceDetail,
  apiRecordPayment, apiConfirmReceipt, apiRejectReceipt,
  apiFreezeInvoice, apiUnfreezeInvoice, apiUpdateInvoice,
  apiListTransactions, apiCreateInvoice, apiDeleteInvoice,
  apiTuitionServiceHealth, apiMarkExempt, apiUnmarkExempt,
  apiAdminApproveTransaction, apiAdminFinalApprove,
  emitDataChange, onDataChange,
} from '../../data/api';
import { formatCurrency, formatDate, formatDateTime, showConfirm, showPrompt } from '../../utils/format';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';

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
  staff_confirmed: { label: 'NV đã thu tiền', color: 'bg-blue-100 text-blue-700' },
  accountant_confirmed: { label: 'KT đã duyệt', color: 'bg-indigo-100 text-indigo-700' },
};

const PAYMENT_METHOD_LABELS = {
  cash: '💵 Tiền mặt',
  bank_transfer: '🏦 Chuyển khoản',
  vnpay: '📱 VNPAY',
  momo: '📱 MOMO',
};

export default function AdminTuition() {
  const [invoices, setInvoices] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [courses, setCourses] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceTransactions, setInvoiceTransactions] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [staffConfirmedTxns, setStaffConfirmedTxns] = useState([]);
  const [accountantConfirmedTxns, setAccountantConfirmedTxns] = useState([]);

  // Payment form
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNote, setPayNote] = useState('');

  // Create invoice form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStudentId, setCreateStudentId] = useState('');
  const [createCourseId, setCreateCourseId] = useState('');
  const [createBasePrice, setCreateBasePrice] = useState('');
  const [createAgencyId, setCreateAgencyId] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [createClassId, setCreateClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [allClasses, setAllClasses] = useState([]);

  const formatPrice = (p) => {
    if (!p || p === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  // ──── Load ALL data ────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, repRes, courseData, userData, agencyData, classData, healthData] = await Promise.all([
        apiListInvoices().catch(() => ({ data: [] })),
        apiGetOverallReport().catch(() => ({ data: {} })),
        apiGetCourses().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetAgencies().catch(() => []),
        fetch('/api/auth.php?action=classes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('smc-token')}` } }).then(r => r.json()).catch(() => []),
        apiTuitionServiceHealth().catch(() => ({ status: 'error' })),
      ]);

      setInvoices(invRes?.data || []);
      setReport(repRes?.data || {});
      setCourses(Array.isArray(courseData) ? courseData : (courseData?.courses || courseData?.data || []));
      setStudents((userData?.users || userData || []).filter(u => (u.role || '') === 'STUDENT'));
      setAgencies(Array.isArray(agencyData) ? agencyData : (agencyData?.data || []));
      setAllClasses(Array.isArray(classData) ? classData.filter(c => (c.status || '') !== 'locked') : []);

      // Load pending transactions for confirmation
      try {
        const txnRes = await apiListTransactions({ status: 'pending' });
        setPendingTxns(txnRes?.data || []);
      } catch {}
      // v5: Load staff_confirmed (chờ Kế toán duyệt)
      try {
        const staffRes = await apiListTransactions({ status: 'staff_confirmed' });
        setStaffConfirmedTxns(staffRes?.data || []);
      } catch {}
      // v5: Load accountant_confirmed (chờ Admin duyệt cuối)
      try {
        const accRes = await apiListTransactions({ status: 'accountant_confirmed' });
        setAccountantConfirmedTxns(accRes?.data || []);
      } catch {}
    } catch (err) {
      toast.error('Không thể tải dữ liệu học phí');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time sync — lắng nghe thay đổi
  useEffect(() => {
    const unsub1 = onDataChange('invoices', () => loadData());
    const unsub2 = onDataChange('transactions', () => loadData());
    const unsub3 = onDataChange('all', (detail) => {
      if (detail?.action === 'delete_user' || detail?.changed === 'invoices') loadData();
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [loadData]);

  // ──── Handlers ────
  const handleViewDetail = async (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
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
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    try {
      const res = await apiRecordPayment({
        invoiceId: payInvoiceId,
        amount: parseInt(payAmount),
        method: payMethod,
        note: payNote,
      });
      toast.success(res.message || 'Đã ghi nhận thanh toán!');
      setShowTransactionModal(false);
      setPayInvoiceId('');
      setPayAmount('');
      setPayNote('');
      emitDataChange('invoices', { action: 'payment_recorded' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConfirmReceipt = async (txnId) => {
    try {
      const res = await apiConfirmReceipt({ transactionId: txnId });
      toast.success(res.message);
      emitDataChange('invoices', { action: 'receipt_confirmed' });
      await loadData();
      if (showDetailModal) {
        handleViewDetail(selectedInvoice);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRejectReceipt = async (txnId) => {
    const reason = await showPrompt({ title: 'Lý do từ chối', message: 'Vui lòng nhập lý do từ chối:', required: true });
    if (!reason) return;
    try {
      const res = await apiRejectReceipt({ transactionId: txnId, reason });
      toast.success(res.message);
      emitDataChange('invoices', { action: 'receipt_rejected' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // v5: Admin duyệt lần cuối (từ accountant_confirmed → confirmed)
  const handleAdminApprove = async (txnId, bypass = false) => {
    const msg = bypass
      ? 'Bạn có chắc muốn duyệt THẲNG (bypass Kế toán) & kích hoạt tài khoản học viên?'
      : 'Bạn có chắc muốn duyệt lần cuối & KÍCH HOẠT tài khoản học viên?';
    if (!window.confirm(msg)) return;
    try {
      // Try auth.php endpoint first, fallback to tuition-service
      let res;
      try {
        res = await apiAdminApproveTransaction({ transactionId: txnId, bypass });
      } catch {
        res = await apiAdminFinalApprove({ transactionId: txnId, bypass });
      }
      toast.success(res.message || 'Đã duyệt & kích hoạt!');
      emitDataChange('invoices', { action: 'admin_approved' });
      emitDataChange('transactions', { action: 'approved' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
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
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreateInvoice = async () => {
    if (!createStudentId || !createCourseId) {
      toast.error('Vui lòng chọn học viên và khóa học');
      return;
    }
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
      setShowCreateModal(false);
      emitDataChange('invoices', { action: 'invoice_created' });
      await loadData();
      // Reset form
      setCreateStudentId('');
      setCreateCourseId('');
      setCreateBasePrice('');
      setCreateAgencyId('');
      setCreateClassId('');
      setCreateNote('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`⚠️ Xóa hóa đơn của ${inv.studentName}?\nTất cả giao dịch liên quan cũng sẽ bị xóa. Hành động này KHÔNG thể hoàn tác.`)) return;
    try {
      await apiDeleteInvoice(inv.id);
      toast.success('Đã xóa hóa đơn');
      emitDataChange('invoices', { action: 'invoice_deleted' });
      await loadData();
      setShowDetailModal(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMarkExempt = async (invoice) => {
    const studentName = invoice.studentName || 'học viên này';
    if (!window.confirm(`🆓 Đánh dấu "${studentName}" là tài khoản Test/Miễn phí?\n\n- Invoice sẽ chuyển sang trạng thái "Miễn phí"\n- Học phí sẽ về 0đ\n- Tất cả giao dịch cũ sẽ bị xóa\n- Học viên sẽ không còn hiển thị trong báo cáo doanh thu\n\n⚠️ Có thể hoàn tác sau này.`)) return;
    try {
      const res = await apiMarkExempt(invoice.studentId, invoice.courseId || '');
      toast.success(res.message || 'Đã đánh dấu miễn phí!');
      emitDataChange('invoices', { action: 'mark_exempt' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnmarkExempt = async (invoice) => {
    const studentName = invoice.studentName || 'học viên này';
    if (!window.confirm(`🔄 Bỏ đánh dấu miễn phí cho "${studentName}"?\n\n- Invoice sẽ chuyển về trạng thái "Chưa thanh toán"\n- Học phí sẽ được khôi phục\n\n⚠️ Học viên sẽ cần đóng học phí bình thường.`)) return;
    try {
      const res = await apiUnmarkExempt(invoice.studentId);
      toast.success(res.message || 'Đã bỏ miễn phí!');
      emitDataChange('invoices', { action: 'unmark_exempt' });
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ──── Export Excel ────
  const [exporting, setExporting] = useState(false);
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
      ws.columns = cols.map(key => {
        const maxLen = Math.max(key.length, ...rows.map(r => String(r[key] || '').length));
        return { width: Math.min(maxLen + 3, 50) };
      });

      const rH = ws.addRow(cols);
      rH.eachCell(cell => {
        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      rows.forEach((row, idx) => {
        const r = ws.addRow(cols.map(c => row[c]));
        r.eachCell((cell, ci) => {
          cell.alignment = { horizontal: cols[ci - 1]?.includes('VNĐ') ? 'right' : 'left', vertical: 'middle' };
          if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          if (cols[ci - 1]?.includes('VNĐ') && typeof row[cols[ci - 1]] === 'number') cell.numFmt = '#,##0';
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SMC_HocPhi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`✅ Đã xuất ${rows.length} hóa đơn`);
    } catch (err) {
      toast.error('Lỗi xuất file: ' + err.message);
    }
    setExporting(false);
  };

  // ──── Filtering ────
  const filtered = invoices.filter(inv => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      (inv.studentName || '').toLowerCase().includes(s) ||
      (inv.studentEmail || '').toLowerCase().includes(s) ||
      (inv.studentPhone || '').toLowerCase().includes(s) ||
      (inv.courseName || '').toLowerCase().includes(s) ||
      (inv.agencyName || '').toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchCourse = !courseFilter || inv.courseId === courseFilter;
    return matchSearch && matchStatus && matchCourse;
  });

  // ──── Stats ────
  const totalPaid = invoices.reduce((s, i) => s + (i.totalPaid || 0), 0);
  const totalDue = invoices.reduce((s, i) => s + (i.remainingDue || 0), 0);
  const totalBase = invoices.reduce((s, i) => s + (i.basePrice || 0), 0);
  // totalDisc: CHỈ tính chiết khấu từ đại lý thực (có agencyId + 0% < dp < 100%)
  const totalDisc = invoices.reduce((s, i) => {
    const aid = i.agencyId || '';
    const dp = i.agencyDiscountPercent || 0;
    return aid && dp > 0 && dp < 100 ? s + (i.agencyDiscountAmount || 0) : s;
  }, 0);
  // totalActualReceived: Tổng đã thu THỰC = totalPaid - phần CK đại lý đã giữ (đại lý chưa nộp về SMC)
  // Phần đại lý giữ = discountAmount của những invoice đại lý (CK đại lý là tiền ĐL được hưởng, không nộp SMC)
  const totalActualReceived = totalPaid - totalDisc;
  // totalRemainingDue = tổng còn phải thu (HV + ĐL còn phải đóng)
  // Đây là số tiền học viên còn nợ lại (remainingDue), không liên quan CK
  const totalRemainingDue = totalDue;
  // Bỏ totalOwesSmc / totalActualRevenue — không dùng nữa
  const paidCount = invoices.filter(i => i.status === 'paid').length;
  const partialCount = invoices.filter(i => i.status === 'partial').length;
  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const frozenCount = invoices.filter(i => i.status === 'frozen').length;
  const exemptCount = invoices.filter(i => i.status === 'exempt').length;
  // agencyCount: chỉ đếm agency thực (dp < 100%, không tính miễn phí)
  const agencyCount = [...new Set(invoices.filter(i => i.agencyId && (i.agencyDiscountPercent || 0) < 100).map(i => i.agencyId))].length;
  // agencyStudentCount: đếm số học viên thuộc đại lý thực
  const agencyStudentCount = invoices.filter(i => i.agencyId && (i.agencyDiscountPercent || 0) < 100).length;
  const agencyOwesSmc = invoices.reduce((s, i) => {
    if (i.agencyId && (i.agencyDiscountPercent || 0) > 0 && (i.agencyDiscountPercent || 0) < 100) {
      return s + ((i.basePrice || 0) - (i.agencyDiscountAmount || 0));
    }
    return s;
  }, 0);
  const collectionRate = totalBase > 0 ? Math.round((totalActualReceived / totalBase) * 100) : 0;

  if (loading && invoices.length === 0) {
    return (
      <div className="animate-fade-in flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Đang tải dữ liệu học phí...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📊 Quản lý Học phí</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Hệ thống học phí thống nhất v3 — Invoice + Transactions
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <FileText className="w-4 h-4" /> Tạo Hóa đơn
          </button>
          <button onClick={loadData} className="btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {[
          { key: 'overview', label: '📊 Tổng quan' },
          { key: 'invoices', label: '📋 Hóa đơn' },
          { key: 'staff-pending', label: `💵 Chờ KT duyệt (${staffConfirmedTxns.length})` },
          { key: 'pending', label: `⏳ Chờ duyệt CK (${pendingTxns.length})` },
          { key: 'admin-pending', label: `🔒 Chờ Admin duyệt (${accountantConfirmedTxns.length})` },
          { key: 'report', label: '📈 Báo cáo' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════ OVERVIEW TAB ════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* ── 4 Big Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { icon: Users, label: 'Tổng hóa đơn', val: invoices.length, sub: `${paidCount} đã TT / ${pendingCount} chưa TT / ${report?.exempt_count || 0} miễn phí`, color: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100' },
              { icon: Banknote, label: 'Tổng đã thu', val: formatPrice(totalActualReceived), sub: `Đã nhận: ${formatPrice(totalPaid)} | CK đại lý: ${formatPrice(totalDisc)} | Tỷ lệ: ${collectionRate}%`, color: 'green', bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100' },
              { icon: TrendingDown, label: 'Còn phải thu', val: formatPrice(totalRemainingDue), sub: `${frozenCount} hóa đơn tạm khóa | ${partialCount + pendingCount} HV chưa hoàn tất`, color: 'red', bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
              { icon: Percent, label: 'Chiết khấu Đại lý', val: formatPrice(totalDisc), sub: `${agencyCount} đại lý | ${agencyStudentCount} học viên ĐL`, color: 'orange', bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-2xl p-4 border border-black/5 overflow-hidden`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 ${s.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                    <s.icon className={`w-4 h-4 ${s.text}`} />
                  </div>
                  <div className="text-xs font-medium text-gray-500 truncate">{s.label}</div>
                </div>
                <div className={`text-lg sm:text-xl font-extrabold ${s.text} truncate`}>{s.val}</div>
                <div className="text-xs text-gray-400 mt-1 truncate">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Status Breakdown Row ── */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Đã TT đủ', count: paidCount, bg: 'bg-white', color: 'text-green-600', dot: 'bg-green-500' },
              { label: 'TT 1 phần', count: partialCount, bg: 'bg-white', color: 'text-amber-600', dot: 'bg-amber-500' },
              { label: 'Chưa TT', count: pendingCount, bg: 'bg-white', color: 'text-red-600', dot: 'bg-red-500' },
              { label: 'Tạm khóa', count: frozenCount, bg: 'bg-white', color: 'text-gray-600', dot: 'bg-gray-400' },
              { label: '🆓 Miễn phí', count: exemptCount, bg: 'bg-white', color: 'text-emerald-600', dot: 'bg-emerald-500' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-xl p-3 text-center border border-black/5`}>
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <div className={`text-lg font-extrabold ${s.color}`}>{s.count}</div>
                </div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Agency + Commission Summary ── */}
          {agencyCount > 0 && (
            <div className="bg-orange-50 rounded-2xl p-5 mb-5 border border-orange-100">
              <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4" /> Thống kê Đại lý
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 text-center"><div className="text-lg font-extrabold text-orange-700">{agencyCount}</div><div className="text-xs text-gray-500">Số đại lý</div></div>
                <div className="bg-white rounded-xl p-3 text-center"><div className="text-lg font-extrabold text-orange-700">{formatPrice(totalDisc)}</div><div className="text-xs text-gray-500">Tổng CK Đại lý</div></div>
                <div className="bg-white rounded-xl p-3 text-center"><div className="text-lg font-extrabold text-gray-700">{agencyStudentCount}</div><div className="text-xs text-gray-500">Học viên Đại lý</div></div>
                <div className="bg-white rounded-xl p-3 text-center"><div className="text-lg font-extrabold text-blue-700">{formatPrice(agencyOwesSmc)}</div><div className="text-xs text-gray-500">Thực thu từ Đại lý</div></div>
              </div>
            </div>
          )}

          {/* ── Quick Report Summary ── */}
          <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">📈 Tổng quan hệ thống</h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
              <div className="text-center"><div className="font-extrabold text-xl text-blue-600">{report?.total_students || 0}</div><div className="text-xs text-gray-500">Tổng học viên</div></div>
              <div className="text-center"><div className="font-extrabold text-xl text-green-600">{report?.activated_count || 0}</div><div className="text-xs text-gray-500">Đã kích hoạt</div></div>
              <div className="text-center"><div className="font-extrabold text-xl text-purple-600">{report?.collection_rate || collectionRate}%</div><div className="text-xs text-gray-500">Tỷ lệ thu</div></div>
              <div className="text-center"><div className="font-extrabold text-xl text-amber-600">{report?.total_commission_fmt || formatPrice(totalDisc)}</div><div className="text-xs text-gray-500">Hoa hồng ĐL</div></div>
              <div className="text-center"><div className="font-extrabold text-xl text-emerald-500">{report?.exempt_count || 0}</div><div className="text-xs text-gray-500">🆓 Miễn phí</div></div>
              <div className="text-center"><div className="font-extrabold text-xl text-cyan-600">{report?.today_amount_fmt || '0 ₫'}</div><div className="text-xs text-gray-500">Hôm nay</div></div>
            </div>
          </div>
        </>
      )}

      {/* ════════════ STAFF PENDING TAB (Chờ Kế toán duyệt) ════════════ */}
      {activeTab === 'staff-pending' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-blue-50">
            <h3 className="font-bold text-blue-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Giao dịch Nhân viên đã thu tiền — Chờ Kế toán đối soát
            </h3>
            <p className="text-xs text-blue-600 mt-1">Nhân viên đã xác nhận thu tiền mặt. Kế toán cần kiểm tra và duyệt.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-semibold">Học viên</th>
                  <th className="text-right p-3 font-semibold">Số tiền</th>
                  <th className="text-left p-3 font-semibold">Phương thức</th>
                  <th className="text-left p-3 font-semibold">Người thu</th>
                  <th className="text-left p-3 font-semibold">Ngày thu</th>
                  <th className="text-center p-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {staffConfirmedTxns.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-10 text-gray-400">Không có giao dịch nào chờ Kế toán duyệt</td></tr>
                ) : staffConfirmedTxns.map(txn => (
                  <tr key={txn.id} className="border-b border-gray-100 hover:bg-blue-50">
                    <td className="p-3 font-medium">{txn.studentName || txn.studentId}</td>
                    <td className="p-3 text-right font-mono font-bold text-green-600">{formatCurrency(txn.amount)}</td>
                    <td className="p-3">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</td>
                    <td className="p-3 text-gray-500">{txn.submittedByName || txn.submittedBy}</td>
                    <td className="p-3 text-gray-500 text-xs">{formatDateTime(txn.createdAt)}</td>
                    <td className="p-3 text-center">
                      <span className="badge text-xs bg-blue-100 text-blue-700">Chờ Kế toán</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ ADMIN PENDING TAB (Chờ Admin duyệt cuối) ════════════ */}
      {activeTab === 'admin-pending' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-purple-50">
            <h3 className="font-bold text-purple-800 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Giao dịch chờ Admin duyệt lần cuối
            </h3>
            <p className="text-xs text-purple-600 mt-1">Kế toán đã duyệt. Admin cần duyệt lần cuối để <b>KÍCH HOẠT</b> tài khoản học viên.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-semibold">Học viên</th>
                  <th className="text-right p-3 font-semibold">Số tiền</th>
                  <th className="text-left p-3 font-semibold">Phương thức</th>
                  <th className="text-left p-3 font-semibold">KT duyệt</th>
                  <th className="text-left p-3 font-semibold">Ngày</th>
                  <th className="text-center p-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {accountantConfirmedTxns.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-10 text-gray-400">✅ Không có giao dịch nào chờ Admin duyệt</td></tr>
                ) : accountantConfirmedTxns.map(txn => (
                  <tr key={txn.id} className="border-b border-gray-100 hover:bg-purple-50">
                    <td className="p-3 font-medium">{txn.studentName || txn.studentId}</td>
                    <td className="p-3 text-right font-mono font-bold text-green-600">{formatCurrency(txn.amount)}</td>
                    <td className="p-3">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</td>
                    <td className="p-3 text-gray-500 text-xs">{txn.confirmedBy || txn.confirmedByName || '—'}</td>
                    <td className="p-3 text-gray-500 text-xs">{formatDateTime(txn.confirmedAt || txn.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleAdminApprove(txn.id, false)} className="btn-primary text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Duyệt & Kích hoạt
                        </button>
                        <button onClick={() => handleAdminApprove(txn.id, true)} className="btn-ghost text-xs px-2 py-1 text-blue-600 border border-blue-300 hover:bg-blue-50" title="Bỏ qua Kế toán">
                          <Zap className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleRejectReceipt(txn.id)} className="btn-ghost text-xs px-2 py-1 text-red-600">
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ PENDING APPROVALS TAB ════════════ */}
      {activeTab === 'pending' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-amber-50">
            <h3 className="font-bold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Giao dịch chờ xác nhận
            </h3>
            <p className="text-xs text-amber-600 mt-1">Học viên đã nộp biên lai chuyển khoản — cần Staff xác nhận</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="text-left p-3 font-semibold">Học viên</th>
                  <th className="text-right p-3 font-semibold">Số tiền</th>
                  <th className="text-left p-3 font-semibold">Phương thức</th>
                  <th className="text-left p-3 font-semibold">Ngày nộp</th>
                  <th className="text-left p-3 font-semibold">Ghi chú</th>
                  <th className="text-center p-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingTxns.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-10 text-gray-400">Không có giao dịch nào chờ duyệt</td></tr>
                ) : pendingTxns.map(txn => (
                  <tr key={txn.id} className="border-b border-gray-100 hover:bg-amber-50">
                    <td className="p-3 font-semibold">{txn.submittedByName || txn.studentId}</td>
                    <td className="p-3 text-right font-mono font-bold text-green-600">{formatPrice(txn.amount)}</td>
                    <td className="p-3">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</td>
                    <td className="p-3 text-gray-500">{new Date(txn.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="p-3 text-gray-500 max-w-[200px] truncate">{txn.note}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleConfirmReceipt(txn.id)} className="btn-primary text-xs px-3 py-1">
                          ✅ Duyệt
                        </button>
                        <button onClick={() => handleRejectReceipt(txn.id)} className="btn-ghost text-xs px-3 py-1 text-red-600">
                          ❌ Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ REPORT TAB (đồng bộ với Staff) ════════════ */}
      {activeTab === 'report' && (
        <>
          {/* ── 4 Key Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { icon: Banknote, label: 'Tổng đã thu', val: formatPrice(report?.total_actual_received ?? totalActualReceived), sub: `Đã nhận: ${formatPrice(report?.total_received ?? totalPaid)} | CK đại lý: ${formatPrice(report?.total_commission ?? totalDisc)} | ${paidCount} HV đã đủ`, color: 'green', bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100' },
              { icon: TrendingDown, label: 'Còn phải thu', val: formatPrice(report?.total_due ?? totalRemainingDue), sub: `${pendingCount + partialCount} HV chưa hoàn tất`, color: 'red', bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
              { icon: TrendingUp, label: 'Tổng HP gốc', val: formatPrice(report?.total_base_price ?? totalBase), sub: `${report?.total_invoices || invoices.length} hóa đơn | Tỷ lệ thu: ${report?.collection_rate || collectionRate}%`, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
              { icon: Percent, label: 'CK Đại lý', val: formatPrice(report?.total_commission ?? totalDisc), sub: `${report?.agency_count || agencyCount} đại lý`, color: 'orange', bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} rounded-2xl p-5 border border-black/5`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${s.iconBg} rounded-xl flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.text}`} />
                  </div>
                  <div className="text-xs font-medium text-gray-500">{s.label}</div>
                </div>
                <div className={`text-xl sm:text-2xl font-extrabold ${s.text} break-all`}>{s.val}</div>
                <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Status + Collection Rate ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-3 text-center border border-black/5"><div className="text-lg font-extrabold text-green-600">{paidCount}</div><div className="text-xs text-gray-500">✅ Đã TT đủ</div></div>
            <div className="bg-white rounded-xl p-3 text-center border border-black/5"><div className="text-lg font-extrabold text-amber-600">{partialCount}</div><div className="text-xs text-gray-500">⚠️ Một phần</div></div>
            <div className="bg-white rounded-xl p-3 text-center border border-black/5"><div className="text-lg font-extrabold text-red-600">{pendingCount}</div><div className="text-xs text-gray-500">❌ Chưa TT</div></div>
            <div className="bg-white rounded-xl p-3 text-center border border-black/5"><div className="text-lg font-extrabold text-blue-700">{collectionRate}%</div><div className="text-xs text-gray-500">📈 Tỷ lệ thu</div></div>
          </div>

          {/* Doanh thu theo hạng thi */}
          <div className="card p-5 mb-5">
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
                  {(report?.by_course || []).map((c, idx) => {
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
                        <td className="p-2.5 text-center">
                          {(c.freeCount || 0) > 0 ? (
                            <span className="badge text-xs bg-blue-100 text-blue-700">{c.freeCount}</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Tổng dòng */}
                <tfoot>
                  <tr className="bg-gray-50 font-bold border-t-2">
                    <td className="p-2.5">Tổng cộng</td>
                    <td className="p-2.5 text-center">{report?.by_course ? report.by_course.reduce((s, c) => s + (c.classCount || 0), 0) : 0}</td>
                    <td className="p-2.5 text-center">{report?.total_students || 0}</td>
                    <td className="p-2.5 text-center">{report?.total_invoices || invoices.length}</td>
                    <td className="p-2.5 text-right text-gray-700">{formatPrice(report?.total_base_price || totalBase)}</td>
                    <td className="p-2.5 text-right text-green-600">{formatPrice(report?.total_received || totalPaid)}</td>
                    <td className="p-2.5 text-right text-red-600">{formatPrice(report?.total_due || totalDue)}</td>
                    <td className="p-2.5 text-center">{report?.collection_rate || collectionRate}%</td>
                    <td className="p-2.5 text-center">{report?.by_course ? report.by_course.reduce((s, c) => s + (c.paidStudentCount || 0), 0) : 0}</td>
                    <td className="p-2.5 text-center">{report?.by_course ? report.by_course.reduce((s, c) => s + (c.partialStudentCount || 0), 0) : 0}</td>
                    <td className="p-2.5 text-center">{report?.by_course ? report.by_course.reduce((s, c) => s + (c.unpaidStudentCount || 0), 0) : 0}</td>
                    <td className="p-2.5 text-center">{report?.exempt_count || 0}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Agency summary */}
          {report?.by_agency && report.by_agency.length > 0 && (
            <div className="card p-5 mb-5">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm"><Building2 className="w-4 h-4" /> Chiết khấu theo Đại lý</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b-2"><th className="text-left p-2.5 font-semibold text-gray-600 whitespace-nowrap">Đại lý</th><th className="text-center p-2.5 font-semibold text-gray-600 w-12 whitespace-nowrap">HV</th><th className="text-right p-2.5 font-semibold text-gray-600 whitespace-nowrap">Đã thu</th><th className="text-right p-2.5 font-semibold text-gray-600 whitespace-nowrap">Còn thiếu</th><th className="text-right p-2.5 font-semibold text-gray-600 whitespace-nowrap">CK</th></tr></thead>
                  <tbody>
                    {report.by_agency.map((a, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-2.5 font-semibold text-sm whitespace-nowrap">{a.name}</td>
                        <td className="p-2.5 text-center text-xs">{a.students}</td>
                        <td className="p-2.5 text-right font-mono text-xs text-green-600 whitespace-nowrap">{(a.received || 0).toLocaleString('vi-VN')} ₫</td>
                        <td className="p-2.5 text-right font-mono text-xs text-red-600 whitespace-nowrap">{(a.due || 0).toLocaleString('vi-VN')} ₫</td>
                        <td className="p-2.5 text-right font-mono text-xs text-orange-600 whitespace-nowrap">{(a.discountTotal || 0).toLocaleString('vi-VN')} ₫</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 text-center mt-4">
            Dữ liệu liên thông real-time từ invoices + transactions (v3) — Đồng bộ với Nhân viên
          </div>
        </>
      )}

      {/* ════════════ INVOICES TAB ════════════ */}
      {(activeTab === 'overview' || activeTab === 'invoices') && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pl-9" placeholder="Tìm tên, email, SĐT, khóa học, đại lý..." />
            </div>
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
            <button onClick={handleExportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
              Xuất Excel
            </button>
          </div>

          {/* Invoice Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
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
                    <th className="text-center p-2.5 font-semibold text-xs w-20">HĐ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="text-center p-10 text-gray-400">
                      <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="font-semibold">Không có hóa đơn nào</p>
                      <p className="text-sm">Nhấn "Tạo Hóa đơn" để bắt đầu</p>
                    </td></tr>
                  ) : filtered.map((inv, idx) => {
                    const pct = inv.basePrice > 0 ? Math.round((inv.totalPaid || 0) / inv.basePrice * 100) : 0;
                    const hasAgency = inv.agencyId && inv.agencyName;
                    const owesSmc = hasAgency ? Math.round(inv.basePrice * (1 - (inv.agencyDiscountPercent || 0) / 100)) : inv.basePrice;
                    const st = STATUS_MAP[inv.status] || STATUS_MAP.pending;
                    const isLegacy = inv._legacy;
                    const rankLabel = inv.studentRank === 'A' ? 'VLOS' : inv.studentRank === 'B' ? 'BVLOS' : '—';
                    const rankColor = inv.studentRank === 'A' ? 'bg-blue-100 text-blue-700' : inv.studentRank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500';
                    return (
                      <tr key={inv.id || idx} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isLegacy ? 'bg-yellow-50/30' : ''}`}>
                        <td className="p-2.5 text-gray-400 text-xs">
                          {idx + 1}
                          {isLegacy && <span className="ml-1 text-amber-500" title="Dữ liệu cũ">⚠️</span>}
                        </td>
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
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
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
                              <button onClick={() => { setPayInvoiceId(inv.id); setPayAmount(inv.remainingDue || ''); setShowTransactionModal(true); }} className="btn-ghost p-1 text-green-600 hover:bg-green-50 rounded" title="Thanh toán">
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

      {/* ════════════ INVOICE DETAIL MODAL ════════════ */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">🧾 Chi tiết Hóa đơn</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleDeleteInvoice(selectedInvoice)} className="btn-ghost text-red-600 text-sm px-3 py-1">🗑 Xóa</button>
                  <button onClick={() => setShowDetailModal(false)} className="btn-ghost p-2">✕</button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Invoice info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div><span className="text-xs text-gray-500">Mã hóa đơn</span><p className="font-mono font-bold text-sm truncate">{selectedInvoice.id?.substring(0, 16)}...</p></div>
                <div><span className="text-xs text-gray-500">Trạng thái</span><p><span className={`badge text-xs ${(STATUS_MAP[selectedInvoice.status] || STATUS_MAP.pending).color}`}>{(STATUS_MAP[selectedInvoice.status] || STATUS_MAP.pending).label}</span></p></div>
                <div><span className="text-xs text-gray-500">Học viên</span><p className="font-semibold text-sm">{selectedInvoice.studentName}</p></div>
                <div><span className="text-xs text-gray-500">Hạng</span><p><span className={`badge text-xs font-bold ${selectedInvoice.studentRank === 'A' ? 'bg-blue-100 text-blue-700' : selectedInvoice.studentRank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{selectedInvoice.studentRank === 'A' ? 'VLOS' : selectedInvoice.studentRank === 'B' ? 'BVLOS' : '—'}</span></p></div>
                <div><span className="text-xs text-gray-500">Khóa học</span><p className="text-sm">{selectedInvoice.courseName}</p></div>
                <div><span className="text-xs text-gray-500">Đại lý</span><p className="text-sm">{selectedInvoice.agencyName || '—'}{selectedInvoice.agencyDiscountPercent > 0 ? ` (CK ${selectedInvoice.agencyDiscountPercent}%)` : ''}</p></div>
                <div><span className="text-xs text-gray-500">Ngày tạo</span><p className="text-sm">{selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).toLocaleDateString('vi-VN') : '—'}</p></div>
              </div>

              {/* Amount summary — clearer layout */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Số tiền theo hạng</div>
                    <div className="font-bold text-lg text-gray-700">{formatPrice(selectedInvoice.basePrice)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Đã nộp</div>
                    <div className="font-bold text-lg text-green-600">{formatPrice(selectedInvoice.totalPaid)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Phải nộp SMC</div>
                    <div className="font-bold text-lg text-blue-700">{formatPrice(selectedInvoice.basePrice > 0 ? Math.round(selectedInvoice.basePrice * (1 - (selectedInvoice.agencyDiscountPercent || 0) / 100)) : 0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Còn phải nộp</div>
                    <div className="font-bold text-lg text-red-600">{formatPrice(selectedInvoice.remainingDue)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Chiết khấu ĐL</div>
                    <div className="font-bold text-lg text-orange-600">{formatPrice(selectedInvoice.agencyDiscountAmount || 0)}</div>
                  </div>
                </div>
                {/* Progress bar */}
                {selectedInvoice.basePrice > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Tiến độ thanh toán</span>
                      <span>{formatPrice(selectedInvoice.totalPaid)} / {formatPrice(selectedInvoice.basePrice)} ({Math.round((selectedInvoice.totalPaid || 0) / selectedInvoice.basePrice * 100)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{width: `${Math.min(100, Math.round((selectedInvoice.totalPaid || 0) / selectedInvoice.basePrice * 100))}%`}} />
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions */}
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Lịch sử giao dịch ({invoiceTransactions.length})
              </h4>
              {invoiceTransactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Chưa có giao dịch nào</p>
              ) : (
                <div className="space-y-2">
                  {invoiceTransactions.map(txn => {
                    const ts = TXN_STATUS[txn.status] || { label: txn.status, color: 'bg-gray-100' };
                    return (
                      <div key={txn.id} className="flex items-center justify-between p-3 bg-white border rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${txn.status === 'confirmed' ? 'bg-green-500' : txn.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <span className="font-mono font-bold text-green-600">{formatPrice(txn.amount)}</span>
                          <span className="text-gray-400">{PAYMENT_METHOD_LABELS[txn.method] || txn.method}</span>
                          <span className="text-gray-400 text-xs">{new Date(txn.createdAt).toLocaleDateString('vi-VN')}</span>
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
              )}

              {/* Quick payment */}
              {selectedInvoice.remainingDue > 0 && selectedInvoice.status !== 'frozen' && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-3">Ghi nhận thanh toán nhanh</h4>
                  <div className="flex gap-2">
                    <input type="number" value={payAmount || selectedInvoice.remainingDue}
                      onChange={e => setPayAmount(e.target.value)}
                      className="input-field flex-1" placeholder="Số tiền" />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field w-auto">
                      <option value="cash">Tiền mặt</option>
                      <option value="bank_transfer">Chuyển khoản</option>
                    </select>
                    <button onClick={async () => {
                      try {
                        await apiRecordPayment({ invoiceId: selectedInvoice.id, amount: parseInt(payAmount), method: payMethod, note: '' });
                        toast.success('Đã ghi nhận!');
                        emitDataChange('invoices');
                        setShowDetailModal(false);
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

      {/* ════════════ RECORD PAYMENT MODAL ════════════ */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowTransactionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">💵 Ghi nhận thanh toán</h3>
                <button onClick={() => setShowTransactionModal(false)} className="btn-ghost p-2">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Hóa đơn</label>
                <input value={payInvoiceId} disabled className="input-field bg-gray-50 text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Số tiền (VNĐ) <span className="text-red-500">*</span></label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="input-field" placeholder="Nhập số tiền" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Phương thức</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field">
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="bank_transfer">🏦 Chuyển khoản</option>
                  <option value="vnpay">📱 VNPAY</option>
                  <option value="momo">📱 MOMO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ghi chú</label>
                <input value={payNote} onChange={e => setPayNote(e.target.value)} className="input-field" placeholder="VD: Đợt 1, nộp tại trung tâm..." />
              </div>
              <button onClick={handleRecordPayment} className="btn-primary w-full py-3 font-bold text-lg">
                ✅ Xác nhận thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ CREATE INVOICE MODAL ════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-extrabold">📝 Tạo Hóa đơn Mới</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Học viên <span className="text-red-500">*</span></label>
                <select value={createStudentId} onChange={e => setCreateStudentId(e.target.value)} className="input-field">
                  <option value="">— Chọn học viên —</option>
                  {students.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING').map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.email || s.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Khóa học <span className="text-red-500">*</span></label>
                <select value={createCourseId} onChange={e => setCreateCourseId(e.target.value)} className="input-field">
                  <option value="">— Chọn khóa học —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} — {formatPrice(c.price)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Học phí gốc (VNĐ)</label>
                <input type="number" value={createBasePrice} onChange={e => setCreateBasePrice(e.target.value)}
                  className="input-field" placeholder="Tự động lấy từ khóa học nếu để trống" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Đại lý (nếu có)</label>
                <select value={createAgencyId} onChange={e => setCreateAgencyId(e.target.value)} className="input-field">
                  <option value="">— Không có đại lý —</option>
                  {agencies.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (CK {a.discountPercent || 0}%)</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Chiết khấu đại lý sẽ được tính và LƯU CỐ ĐỊNH khi tạo hóa đơn</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Xếp lớp (tùy chọn)</label>
                <select value={createClassId} onChange={e => setCreateClassId(e.target.value)} className="input-field">
                  <option value="">— Tự xếp lớp sau —</option>
                  {allClasses.filter(c => c.course_id === createCourseId || !createCourseId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.course_id === 'c001' ? 'VLOS' : 'BVLOS'} — {(c.student_ids || []).length}/{c.max_students || 20} HV)</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Tự động xếp học viên vào lớp đã chọn</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Ghi chú</label>
                <input value={createNote} onChange={e => setCreateNote(e.target.value)} className="input-field" placeholder="Ghi chú nội bộ..." />
              </div>
              <button onClick={handleCreateInvoice} className="btn-primary w-full py-3 font-bold text-lg">
                ✅ Tạo Hóa đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
