/**
 * AccountantTuition — Wrapper cho Kế toán
 *
 * Dùng chung AdminTuition nhưng giới hạn: chỉ xem, duyệt phiếu thu,
 * không tạo/sửa/xóa invoice, không đóng băng/mở băng học viên.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, DollarSign, Users, BookOpen, CheckCircle,
  AlertTriangle, Download, BarChart3, Banknote, CreditCard,
  TrendingUp, TrendingDown, Filter, Percent, Building2,
  Eye, XCircle, Ban, FileText, Wallet, Clock, History,
  Receipt, ArrowUpDown, Calendar
} from 'lucide-react';
import {
  apiGetUsers, apiGetAgencies, apiGetCourses,
  apiListInvoices, apiGetOverallReport, apiGetInvoiceDetail,
  apiConfirmReceipt, apiRejectReceipt,
  apiListTransactions,
  apiTuitionServiceHealth,
  emitDataChange, onDataChange,
} from '../../data/api';
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

export default function AccountantTuition() {
  const [invoices, setInvoices] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceTransactions, setInvoiceTransactions] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);

  const formatPrice = (p) => {
    if (!p || p === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, repRes, txnRes, staffTxnRes] = await Promise.all([
        apiListInvoices().catch(() => ({ data: [] })),
        apiGetOverallReport().catch(() => ({ data: {} })),
        apiListTransactions({ status: 'pending' }).catch(() => ({ data: [] })),
        apiListTransactions({ status: 'staff_confirmed' }).catch(() => ({ data: [] })),
      ]);
      setInvoices(invRes?.data || []);
      setReport(repRes?.data || {});
      // Gộp cả pending + staff_confirmed cho tab "Chờ duyệt"
      setPendingTxns([...(txnRes?.data || []), ...(staffTxnRes?.data || [])]);
    } catch (err) {
      toast.error('Không thể tải dữ liệu học phí');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const u1 = onDataChange('invoices', () => loadData());
    const u2 = onDataChange('transactions', () => loadData());
    return () => { u1(); u2(); };
  }, [loadData]);

  const handleViewDetail = async (inv) => {
    setShowDetailModal(true);
    setSelectedInvoice(inv);
    try {
      const res = await apiGetInvoiceDetail(inv.id);
      setInvoiceTransactions(res?.data?.transactions || []);
    } catch { setInvoiceTransactions([]); }
  };

  const handleConfirm = async (txn) => {
    if (!window.confirm(`Xác nhận phiếu thu ${formatPrice(txn.amount)} từ ${txn.studentName || 'học viên'}?`)) return;
    try {
      const res = await apiConfirmReceipt({ transactionId: txn.id, note: 'Kế toán đối soát & duyệt' });
      if (res.needsAdminApproval) {
        toast.success('Đã xác nhận! Chuyển Admin duyệt lần cuối để kích hoạt khóa học.');
      } else {
        toast.success('Đã xác nhận & kích hoạt!');
      }
      emitDataChange('invoices', { action: 'payment_confirmed' });
      emitDataChange('transactions', { action: 'confirmed' });
      loadData();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể xác nhận'));
    }
  };

  const handleReject = async (txn) => {
    const reason = window.prompt('Nhập lý do từ chối:');
    if (!reason) return;
    try {
      await apiRejectReceipt({ transactionId: txn.id, reason });
      toast.success('Đã từ chối phiếu thu');
      emitDataChange('invoices', { action: 'updated' });
      emitDataChange('transactions', { action: 'rejected' });
      loadData();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể từ chối'));
    }
  };

  const filtered = invoices.filter(inv => {
    const studentName = (inv.studentName || '').toLowerCase();
    const matchSearch = studentName.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = report || {};

  if (loading && invoices.length === 0) return (
    <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-500" /> Học phí & Vận hành
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kế toán — Đối soát và duyệt phiếu thu</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'overview', label: '📊 Tổng quan' },
          { key: 'invoices', label: '📋 Hóa đơn' },
          { key: 'pending', label: `⏳ Chờ KT duyệt (${pendingTxns.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tổng hóa đơn', value: stats.totalInvoices || 0, icon: FileText, color: 'text-blue-500' },
              { label: 'Tổng thu', value: formatPrice(stats.totalCollected || 0), icon: DollarSign, color: 'text-green-500' },
              { label: 'Còn thiếu', value: formatPrice(stats.remainingDue || 0), icon: AlertTriangle, color: 'text-red-500' },
              { label: 'Chờ duyệt', value: pendingTxns.length, icon: Clock, color: 'text-amber-500' },
            ].map((card, i) => (
              <div key={i} className="card p-4">
                <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                <div className="text-2xl font-extrabold">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-400 mt-4">
            💡 Kế toán chỉ có quyền xem & duyệt phiếu thu. Cần tạo/sửa hóa đơn? Liên hệ Admin.
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm học viên..." />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto">
              <option value="all">Tất cả</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3">Học viên</th>
                  <th className="pb-3">Khóa học</th>
                  <th className="pb-3">Học phí</th>
                  <th className="pb-3">Đã đóng</th>
                  <th className="pb-3">Còn thiếu</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const StatusIcon = STATUS_MAP[inv.status]?.icon || FileText;
                  return (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{inv.studentName}</td>
                      <td className="py-3 text-gray-500">{inv.courseName}</td>
                      <td className="py-3">{formatPrice(inv.basePrice)}</td>
                      <td className="py-3 text-green-600">{formatPrice(inv.totalPaid)}</td>
                      <td className="py-3 text-red-500">{formatPrice(inv.remainingDue)}</td>
                      <td className="py-3"><span className={`badge text-xs ${STATUS_MAP[inv.status]?.color}`}><StatusIcon className="w-3 h-3 inline mr-1" />{STATUS_MAP[inv.status]?.label}</span></td>
                      <td className="py-3"><button onClick={() => handleViewDetail(inv)} className="text-blue-500 hover:underline text-xs"><Eye className="w-3 h-3 inline mr-1" />Xem</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div>
          {pendingTxns.length === 0 ? (
            <div className="text-center py-12 text-gray-400">✅ Không có phiếu thu nào cần duyệt</div>
          ) : (
            <div className="space-y-4">
              {pendingTxns.map(txn => (
                <div key={txn.id} className="card p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{txn.studentName || 'Học viên'}</h3>
                      <p className="text-sm text-gray-500">{PAYMENT_METHOD_LABELS[txn.paymentMethod] || txn.paymentMethod} — {formatPrice(txn.amount)}</p>
                      {txn.note && <p className="text-xs text-gray-400 mt-1">Ghi chú: {txn.note}</p>}
                      <p className="text-xs text-gray-400">{txn.createdAt ? new Date(txn.createdAt).toLocaleString('vi-VN') : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleConfirm(txn)} className="btn-primary text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Duyệt
                      </button>
                      <button onClick={() => handleReject(txn)} className="btn-ghost text-xs px-4 py-2 text-red-600 border border-red-300 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Chi tiết hóa đơn — {selectedInvoice.studentName}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><span className="text-gray-500">Khóa học:</span> <span className="font-medium">{selectedInvoice.courseName}</span></div>
              <div><span className="text-gray-500">Học phí:</span> <span className="font-medium">{formatPrice(selectedInvoice.basePrice)}</span></div>
              <div><span className="text-gray-500">Đã đóng:</span> <span className="text-green-600 font-medium">{formatPrice(selectedInvoice.totalPaid)}</span></div>
              <div><span className="text-gray-500">Còn thiếu:</span> <span className="text-red-500 font-medium">{formatPrice(selectedInvoice.remainingDue)}</span></div>
              <div><span className="text-gray-500">Đại lý:</span> <span>{selectedInvoice.agencyName || '—'}</span></div>
              <div><span className="text-gray-500">Trạng thái:</span> <span className={`badge text-xs ${STATUS_MAP[selectedInvoice.status]?.color}`}>{STATUS_MAP[selectedInvoice.status]?.label}</span></div>
            </div>
            <h4 className="font-semibold text-sm mb-2">Lịch sử giao dịch</h4>
            {invoiceTransactions.length === 0 ? (
              <p className="text-sm text-gray-400">Chưa có giao dịch nào</p>
            ) : (
              <div className="space-y-2">
                {invoiceTransactions.map(txn => (
                  <div key={txn.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{formatPrice(txn.amount)}</span>
                      <span className="text-gray-500 ml-2">{PAYMENT_METHOD_LABELS[txn.paymentMethod] || txn.paymentMethod}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{txn.createdAt ? new Date(txn.createdAt).toLocaleString('vi-VN') : ''}</span>
                      <span className={`badge text-xs ${TXN_STATUS[txn.status]?.color || 'bg-gray-100 text-gray-700'}`}>{TXN_STATUS[txn.status]?.label || txn.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
