import { useState, useEffect } from 'react';
import { apiListInvoices, apiListTransactions, apiGetOverallReport, onDataChange } from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, Users, Clock, AlertTriangle, TrendingUp, CheckCircle, Building2, Wallet, FileCheck } from 'lucide-react';

const formatPrice = (v) => {
  if (v == null || isNaN(v)) return '0 ₫';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

export default function AccountantDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingCount: 0, pendingAmount: 0,
    cashHoldingCount: 0, cashHoldingAmount: 0,
    todayApproved: 0, todayAmount: 0,
    totalRevenue: 0, totalCollected: 0, collectionRate: 0,
    staffCount: 0
  });
  const [pendingPayments, setPendingPayments] = useState([]);
  const [staffHoldings, setStaffHoldings] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Lấy báo cáo tổng quan
      const report = await apiGetOverallReport();
      const rdata = report?.data || report || {};

      // Lấy danh sách phiếu thu đang chờ duyệt (staff_confirmed + pending)
      const txnResult = await apiListTransactions({ status: 'staff_confirmed', limit: 50 });
      const pendingTxns = txnResult?.data || [];

      // Lấy pending bank_transfer
      const txnPending = await apiListTransactions({ status: 'pending', limit: 50 });
      const pendingBankTxns = txnPending?.data || [];

      const allPending = [...pendingTxns, ...pendingBankTxns].slice(0, 50);

      // Lấy sổ quỹ tiền mặt (tổng hợp tất cả NV)
      const cashResult = await apiGetOverallReport(); // Tạm thời dùng report
      // Gọi staff-cash-summary endpoint
      let staffHoldingsData = [];
      try {
        const cashResponse = await fetch('/api/smc-db.php?action=accountant-cash-ledger', {
          credentials: 'include',
        });
        if (cashResponse.ok) {
          const cashData = await cashResponse.json();
          staffHoldingsData = cashData.staffHoldings || [];
        }
      } catch (e) { /* fallback */ }

      setStats({
        pendingCount: allPending.length,
        pendingAmount: allPending.reduce((s, t) => s + (parseInt(t.amount) || 0), 0),
        cashHoldingCount: staffHoldingsData.reduce((s, h) => s + (h.pending_count || 0), 0),
        cashHoldingAmount: staffHoldingsData.reduce((s, h) => s + (parseInt(h.total_holding) || 0), 0),
        todayApproved: (rdata.today_transactions) || 0,
        todayAmount: (rdata.today_amount) || 0,
        totalRevenue: (rdata.total_base_price) || 0,
        totalCollected: (rdata.total_received) || 0,
        collectionRate: (rdata.collection_rate) || 0,
        staffCount: staffHoldingsData.length,
      });
      setPendingPayments(allPending);
      setStaffHoldings(staffHoldingsData);
    } catch (err) {
      console.error('Accountant dashboard load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub1 = onDataChange('invoices', loadData);
    const unsub2 = onDataChange('transactions', loadData);
    const unsub3 = onDataChange('all', loadData);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const StatCard = ({ icon: Icon, label, value, sub, color, iconBg }) => (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg || 'bg-slate-700'} flex items-center justify-center`}>
          <Icon size={20} className={color || 'text-slate-300'} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Xin chào, {user?.fullName || user?.full_name || 'Kế toán'}
        </h1>
        <p className="text-slate-400 mt-1">Tổng quan tài chính & đối soát hôm nay</p>
      </div>

      {/* ⚠️ Cash warning */}
      {stats.cashHoldingAmount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-300 font-semibold">Tiền mặt chưa bàn giao</p>
            <p className="text-amber-200/80 text-sm mt-1">
              {stats.staffCount} nhân viên đang giữ tổng cộng{' '}
              <strong>{formatPrice(stats.cashHoldingAmount)}</strong> tiền mặt ({stats.cashHoldingCount} phiếu thu).
              Cần đối soát và bàn giao trong ngày.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock} label="Phiếu thu chờ duyệt"
          value={stats.pendingCount} sub={formatPrice(stats.pendingAmount)}
          color="text-amber-400" iconBg="bg-amber-500/20"
        />
        <StatCard
          icon={DollarSign} label="Doanh thu hôm nay"
          value={`${stats.todayApproved} giao dịch`} sub={formatPrice(stats.todayAmount)}
          color="text-emerald-400" iconBg="bg-emerald-500/20"
        />
        <StatCard
          icon={Wallet} label="Tiền mặt NV đang giữ"
          value={formatPrice(stats.cashHoldingAmount)} sub={`${stats.cashHoldingCount} phiếu — ${stats.staffCount} nhân viên`}
          color="text-amber-400" iconBg="bg-amber-500/20"
        />
        <StatCard
          icon={TrendingUp} label="Tỷ lệ thu"
          value={`${stats.collectionRate}%`}
          sub={`${formatPrice(stats.totalCollected)} / ${formatPrice(stats.totalRevenue)}`}
          color="text-blue-400" iconBg="bg-blue-500/20"
        />
      </div>

      {/* 2 cột: Phiếu chờ duyệt + NV đang giữ tiền */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái: Phiếu thu chờ duyệt */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <FileCheck size={18} className="text-amber-400" />
              Phiếu thu chờ duyệt
            </h2>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">
              {pendingPayments.length} phiếu
            </span>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
            {pendingPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle size={40} className="mx-auto mb-2 text-emerald-500/50" />
                <p>Không có phiếu thu nào chờ duyệt</p>
              </div>
            ) : (
              pendingPayments.slice(0, 15).map((txn, i) => (
                <div key={txn.id || i} className="p-3 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">
                        {txn.student_name || txn.full_name || `Học viên #${txn.student_id}`}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {txn.receipt_code || `#${txn.id}`} •{' '}
                        {txn.payment_method === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                        {txn.agency_name && (
                          <span className="inline-flex items-center gap-1 text-orange-400 ml-2">
                            <Building2 size={10} /> {txn.agency_name}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">{formatPrice(txn.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'staff_confirmed'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {txn.status === 'staff_confirmed' ? 'NV đã thu' : 'Chờ đối soát'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cột phải: Nhân viên đang giữ tiền */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Users size={18} className="text-amber-400" />
              Tiền mặt nhân viên đang giữ
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
            {staffHoldings.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Building2 size={40} className="mx-auto mb-2 text-slate-600" />
                <p>Không có nhân viên nào đang giữ tiền mặt</p>
              </div>
            ) : (
              staffHoldings.map((sh, i) => (
                <div key={sh.staff_id || i} className="p-3 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{sh.staff_name}</p>
                      <p className="text-slate-400 text-xs">
                        {sh.pending_count} phiếu thu • Giữ từ{' '}
                        {sh.oldest_held_since ? new Date(sh.oldest_held_since).toLocaleDateString('vi-VN') : '--'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-400 font-bold">{formatPrice(sh.total_holding)}</p>
                      {sh.hours_held > 24 && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                          {Math.floor(sh.hours_held)}h ⚠️
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
