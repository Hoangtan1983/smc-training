import { useState, useEffect } from 'react';
import { onDataChange } from '../../data/api';
import { Wallet, Users, Search, Calendar, DollarSign, TrendingUp, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const formatPrice = (v) => {
  if (v == null || isNaN(v)) return '0 ₫';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

export default function AccountantCashLedger() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [staffHoldings, setStaffHoldings] = useState([]);
  const [overview, setOverview] = useState({ activeStaffCount: 0, unremittedCash: 0, reconciledCash: 0 });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateFrom, dateTo,
        page: String(page), perPage: '50',
      });
      if (selectedStaff) params.set('staffId', selectedStaff);

      const res = await fetch(`/api/smc-db.php?action=accountant-cash-ledger&${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data || []);
        setStaffHoldings(data.staffHoldings || []);
        setOverview(data.overview || {});
      }
    } catch (err) {
      console.error('Cash ledger load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub = onDataChange('transactions', loadData);
    const unsub2 = onDataChange('all', loadData);
    return () => { unsub(); unsub2(); };
  }, [dateFrom, dateTo, selectedStaff, page]);

  const filteredEntries = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.staff_name || '').toLowerCase().includes(s)
      || (e.student_name || '').toLowerCase().includes(s)
      || (e.receipt_code || '').toLowerCase().includes(s);
  });

  const handleExportExcel = () => {
    const data = filteredEntries.map(e => ({
      'Ngày': e.created_at ? new Date(e.created_at).toLocaleDateString('vi-VN') : '',
      'Nhân viên': e.staff_name || '',
      'Học viên': e.student_name || '',
      'Mã phiếu thu': e.receipt_code || '',
      'Đại lý': e.agency_name || '',
      'Số tiền': parseInt(e.amount) || 0,
      'Trạng thái sổ quỹ': e.status === 'holding' ? 'Đang giữ' : 'Đã đối soát',
      'Trạng thái phiếu thu': e.payment_status === 'staff_confirmed' ? 'NV đã thu' :
                              e.payment_status === 'approved' ? 'Đã duyệt' : e.payment_status || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So quy tien mat');
    XLSX.writeFile(wb, `so-quy-tien-mat-${dateFrom}_${dateTo}.xlsx`);
    toast.success('Đã xuất Excel!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sổ quỹ tiền mặt</h1>
          <p className="text-slate-400 mt-1">Theo dõi tiền mặt nhân viên thu & bàn giao cho Kế toán</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium
                     rounded-lg transition-colors flex items-center gap-2"
        >
          <TrendingUp size={16} /> Xuất Excel
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm">Tiền mặt chưa bàn giao</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{formatPrice(overview.unremittedCash)}</p>
          <p className="text-slate-500 text-xs mt-1">{overview.activeStaffCount} nhân viên đang giữ</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm">Đã đối soát</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatPrice(overview.reconciledCash)}</p>
          <p className="text-slate-500 text-xs mt-1">Trong kỳ {dateFrom} → {dateTo}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <p className="text-slate-400 text-sm">Tổng giao dịch</p>
          <p className="text-2xl font-bold text-white mt-1">{entries.length}</p>
          <p className="text-slate-500 text-xs mt-1">Phiếu thu tiền mặt</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm
                       focus:outline-none focus:border-emerald-500/50" />
        </div>
        <span className="text-slate-500">→</span>
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm
                       focus:outline-none focus:border-emerald-500/50" />
        </div>
        <select
          value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Tất cả nhân viên</option>
          {staffHoldings.map(sh => (
            <option key={sh.staff_id} value={sh.staff_id}>{sh.staff_name}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Tìm kiếm..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm
                       placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Staff Holdings Summary */}
      {staffHoldings.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Users size={18} className="text-amber-400" />
              Tổng hợp theo nhân viên
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left p-3 font-medium">Nhân viên</th>
                  <th className="text-right p-3 font-medium">Số phiếu</th>
                  <th className="text-right p-3 font-medium">Tổng tiền đang giữ</th>
                  <th className="text-right p-3 font-medium">Thời gian giữ</th>
                  <th className="text-center p-3 font-medium">Cảnh báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {staffHoldings.map(sh => (
                  <tr key={sh.staff_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 text-white font-medium">{sh.staff_name}</td>
                    <td className="p-3 text-right text-white">{sh.pending_count}</td>
                    <td className="p-3 text-right text-amber-400 font-semibold">{formatPrice(sh.total_holding)}</td>
                    <td className="p-3 text-right text-slate-400">
                      {sh.oldest_held_since ? new Date(sh.oldest_held_since).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td className="p-3 text-center">
                      {sh.hours_held > 24 ? (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                          {Math.floor(sh.hours_held)}h ⚠️
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chi tiết sổ quỹ */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Wallet size={18} className="text-emerald-400" />
            Chi tiết giao dịch sổ quỹ
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left p-3 font-medium">Ngày</th>
                <th className="text-left p-3 font-medium">Nhân viên</th>
                <th className="text-left p-3 font-medium">Học viên</th>
                <th className="text-left p-3 font-medium">Mã phiếu</th>
                <th className="text-left p-3 font-medium">Đại lý</th>
                <th className="text-right p-3 font-medium">Số tiền</th>
                <th className="text-center p-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Wallet size={32} className="mx-auto mb-2 text-slate-600" />
                    Không có giao dịch nào
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e, i) => (
                  <tr key={e.id || i} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-3 text-slate-300 text-xs">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      }) : '--'}
                    </td>
                    <td className="p-3 text-white">{e.staff_name || '--'}</td>
                    <td className="p-3 text-white">{e.student_name || '--'}</td>
                    <td className="p-3 text-slate-300 text-xs font-mono">{e.receipt_code || `#${e.payment_id}`}</td>
                    <td className="p-3">
                      {e.agency_name ? (
                        <span className="inline-flex items-center gap-1 text-orange-400 text-xs">
                          <Building2 size={12} /> {e.agency_name}
                        </span>
                      ) : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="p-3 text-right text-white font-medium">{formatPrice(e.amount)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        e.status === 'holding'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {e.status === 'holding' ? 'Đang giữ' : 'Đã đối soát'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
