import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, TrendingUp, DollarSign, Percent, CreditCard, Target, ArrowUpCircle, ArrowDownCircle, Building, Eye } from 'lucide-react';
import { apiGetAgencyReport, onDataChange } from '../../data/api';
import toast from 'react-hot-toast';

const formatPrice = (p) => {
  if (!p || p === 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
};

export default function AgencyDashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvoices, setShowInvoices] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      // Dùng v3 API: lấy báo cáo đại lý từ tuition-service.php
      const res = await apiGetAgencyReport();
      const data = res?.data || null;
      setReport(data);
    } catch (err) {
      console.error('[AgencyDashboard] Load error:', err);
      toast.error('Không thể tải dữ liệu đại lý');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);

  // Real-time sync — lắng nghe thay đổi từ Admin/Staff
  useEffect(() => {
    const unsub = onDataChange('invoices', () => loadReport());
    const unsub2 = onDataChange('transactions', () => loadReport());
    const unsub3 = onDataChange('all', (detail) => {
      if (detail?.changed === 'invoices' || detail?.changed === 'transactions') loadReport();
    });
    return () => { unsub(); unsub2(); unsub3(); };
  }, [loadReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const stats = report?.stats || {};
  const agency = report?.agency || {};
  const invoices = report?.invoices || [];

  const topCards = [
    { label: 'Tổng học viên', val: stats.totalStudents || 0, icon: Users, color: 'blue' },
    { label: 'Chiết khấu', val: (agency.discountPercent || 0) + '%', icon: Percent, color: 'orange' },
    { label: 'HP gốc (chưa CK)', val: formatPrice(stats.totalBaseRevenue), icon: TrendingUp, color: 'slate' },
    { label: 'Phải nộp SMC', val: formatPrice(stats.totalOwesToSmc || 0), icon: Building, color: 'emerald' },
    { label: 'Đã thu từ HV', val: formatPrice(stats.totalPaid), icon: ArrowUpCircle, color: 'green' },
    { label: 'Còn phải thu', val: formatPrice(stats.totalDue), icon: ArrowDownCircle, color: 'red' },
    { label: 'Tỷ lệ thu', val: (stats.collectionRate || 0) + '%', icon: CreditCard, color: 'purple' },
    { label: 'Đã đóng đủ', val: `${stats.paidCount || 0}/${stats.totalStudents || 0}`, icon: Target, color: 'emerald' },
  ];

  const colorMap = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{agency.name || (user?.fullName) || 'Đại lý'}</h1>
          <p className="text-slate-500 mt-1">Báo cáo học phí — Đồng bộ real-time với hệ thống v3</p>
        </div>
        <button onClick={() => setShowInvoices(!showInvoices)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Eye className="w-4 h-4" /> {showInvoices ? 'Ẩn' : 'Xem'} chi tiết học viên
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {topCards.map((s, i) => {
          const c = colorMap[s.color] || colorMap.blue;
          return (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <s.icon size={20} className={c.text} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="text-xl font-bold text-slate-800">{s.val}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice List */}
      {showInvoices && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Danh sách học viên ({invoices.length})
          </h2>
          {invoices.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Chưa có hóa đơn nào</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2">
                    <th className="text-left p-3">Học viên</th>
                    <th className="text-left p-3">Khóa học</th>
                    <th className="text-right p-3">HP gốc</th>
                    <th className="text-right p-3">Đã nộp</th>
                    <th className="text-right p-3">Phải nộp SMC</th>
                    <th className="text-right p-3">Còn phải nộp</th>
                    <th className="text-center p-3">Trạng thái</th>
                    <th className="text-right p-3">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const pct = inv.basePrice > 0 ? Math.round((inv.totalPaid || 0) / inv.basePrice * 100) : 0;
                    return (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold">{inv.studentName}</td>
                        <td className="p-3 text-gray-600">{inv.courseName}</td>
                        <td className="p-3 text-right font-mono">{formatPrice(inv.basePrice)}</td>
                        <td className="p-3 text-right font-mono text-green-600">{formatPrice(inv.totalPaid)}</td>
                        <td className="p-3 text-right font-mono text-blue-700">
                          {formatPrice(inv.owesToSmc || 0)}
                        </td>
                        <td className="p-3 text-right font-mono text-red-600">{(inv.remainingDue || 0) > 0 ? formatPrice(inv.remainingDue) : '--'}</td>
                        <td className="p-3 text-center">
                          <span className={`badge text-xs ${
                            inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                            inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {inv.status === 'paid' ? 'Đã TT đủ' : inv.status === 'partial' ? 'TT 1 phần' : 'Chưa TT'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                              <div className="h-full rounded-full" style={{width: `${pct}%`, background: pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'}} />
                            </div>
                            <span className="text-xs font-bold">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agency Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Thông tin đại lý</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-400">Tên đại lý</p><p className="font-medium">{agency.name || (user?.fullName) || '--'}</p></div>
          <div><p className="text-slate-400">Mức chiết khấu</p><p className="font-medium text-orange-600">{agency.discountPercent || 0}%</p></div>
          <div><p className="text-slate-400">Tổng học viên</p><p className="font-medium">{stats.totalStudents || 0}</p></div>
          <div><p className="text-slate-400">Phải nộp cho SMC</p><p className="font-medium text-blue-600">{formatPrice(stats.totalOwesToSmc || 0)}</p></div>
          <div><p className="text-slate-400">Đã thu từ HV</p><p className="font-medium text-green-600">{formatPrice(stats.totalPaid)}</p></div>
          <div><p className="text-slate-400">Còn phải thu</p><p className="font-medium text-red-600">{formatPrice(stats.totalDue)}</p></div>
        </div>
      </div>
    </div>
  );
}
