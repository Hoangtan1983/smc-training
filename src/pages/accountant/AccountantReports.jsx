import { useState, useEffect } from 'react';
import { apiGetOverallReport, apiGetAgencyReport, onDataChange } from '../../data/api';
import { BarChart3, TrendingUp, DollarSign, Building2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const formatPrice = (v) => {
  if (v == null || isNaN(v)) return '0 ₫';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

export default function AccountantReports() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [agencyReport, setAgencyReport] = useState(null);
  const [activeTab, setActiveTab] = useState('revenue');

  const loadData = async () => {
    setLoading(true);
    try {
      const [overall, agency] = await Promise.all([
        apiGetOverallReport(),
        apiGetAgencyReport(),
      ]);
      setReport(overall?.data || overall || {});
      setAgencyReport(agency?.data || agency || {});
    } catch (err) {
      console.error('Reports load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const unsub1 = onDataChange('invoices', loadData);
    const unsub2 = onDataChange('all', loadData);
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleExportExcel = () => {
    const data = [];
    if (activeTab === 'revenue' && report?.by_course) {
      report.by_course.forEach(rc => {
        data.push({ 'Hạng mục': rc.name, 'Số hóa đơn': rc.invoices || 0, 'Đã thu': rc.received || 0, 'Còn nợ': rc.due || 0, 'Tổng': (rc.received || 0) + (rc.due || 0) });
      });
    }
    if (activeTab === 'agency' && agencyReport?.stats) {
      data.push({ 'Hạng mục': 'Tổng học viên', 'Giá trị': agencyReport.stats.totalStudents || 0 });
      data.push({ 'Hạng mục': 'Tổng đã thu', 'Giá trị': agencyReport.stats.totalPaid || 0 });
      data.push({ 'Hạng mục': 'Tổng còn nợ', 'Giá trị': agencyReport.stats.totalDue || 0 });
      data.push({ 'Hạng mục': 'Tỷ lệ thu', 'Giá trị': agencyReport.stats.collectionRate + '%' });
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bao cao');
    XLSX.writeFile(wb, `bao-cao-tai-chinh-${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <h1 className="text-2xl font-bold text-white">Báo cáo tài chính</h1>
          <p className="text-slate-400 mt-1">Doanh thu, hoa hồng đại lý & công nợ</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium
                     rounded-lg transition-colors flex items-center gap-2"
        >
          <FileText size={16} /> Xuất Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-0">
        {[
          { key: 'revenue', label: 'Doanh thu', icon: BarChart3 },
          { key: 'agency', label: 'Hoa hồng đại lý', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-slate-800 text-white border-b-2 border-emerald-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Revenue Tab */}
      {activeTab === 'revenue' && report && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tổng học viên</p>
              <p className="text-2xl font-bold text-white mt-1">{report.total_students || 0}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tổng doanh thu dự kiến</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{formatPrice(report.total_base_price)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Đã thu thực tế</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{formatPrice(report.total_actual_received)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tỷ lệ thu</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{report.collection_rate}%</p>
              <p className="text-slate-500 text-xs mt-1">Còn nợ: {formatPrice(report.total_due)}</p>
            </div>
          </div>

          {/* Revenue by course */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400" />
                Doanh thu theo hạng mục
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left p-3 font-medium">Hạng mục</th>
                    <th className="text-right p-3 font-medium">Số hóa đơn</th>
                    <th className="text-right p-3 font-medium">Đã thu</th>
                    <th className="text-right p-3 font-medium">Còn nợ</th>
                    <th className="text-right p-3 font-medium">Tổng</th>
                    <th className="text-right p-3 font-medium">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {(report.by_course || []).map((rc, i) => {
                    const total = (rc.received || 0) + (rc.due || 0);
                    const rate = total > 0 ? Math.round((rc.received || 0) / total * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 text-white font-medium">{rc.name}</td>
                        <td className="p-3 text-right text-white">{rc.invoices || 0}</td>
                        <td className="p-3 text-right text-emerald-400">{formatPrice(rc.received)}</td>
                        <td className="p-3 text-right text-red-400">{formatPrice(rc.due)}</td>
                        <td className="p-3 text-right text-white">{formatPrice(total)}</td>
                        <td className="p-3 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            rate >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                            rate >= 50 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{rate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agency revenue breakdown */}
          {report.by_agency && report.by_agency.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Building2 size={18} className="text-amber-400" />
                  Doanh thu theo đại lý
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="text-left p-3 font-medium">Đại lý</th>
                      <th className="text-right p-3 font-medium">Học viên</th>
                      <th className="text-right p-3 font-medium">Đã thu</th>
                      <th className="text-right p-3 font-medium">Còn nợ</th>
                      <th className="text-right p-3 font-medium">Chiết khấu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {report.by_agency.map((ag, i) => (
                      <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 text-white font-medium">{ag.name}</td>
                        <td className="p-3 text-right text-white">{ag.students}</td>
                        <td className="p-3 text-right text-emerald-400">{formatPrice(ag.received)}</td>
                        <td className="p-3 text-right text-red-400">{formatPrice(ag.due)}</td>
                        <td className="p-3 text-right text-amber-400">{formatPrice(ag.discount_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agency Tab */}
      {activeTab === 'agency' && agencyReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tổng học viên đại lý</p>
              <p className="text-2xl font-bold text-white mt-1">{agencyReport.stats?.totalStudents || 0}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Đã thanh toán đủ</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{agencyReport.stats?.paidCount || 0}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tổng đã thu</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{formatPrice(agencyReport.stats?.totalPaid)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-slate-400 text-sm">Tỷ lệ thu</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{agencyReport.stats?.collectionRate}%</p>
            </div>
          </div>

          {/* Agency invoice list */}
          {agencyReport.invoices && agencyReport.invoices.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-white font-semibold">Chi tiết học viên đại lý</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="text-left p-3 font-medium">Học viên</th>
                      <th className="text-left p-3 font-medium">Khóa học</th>
                      <th className="text-right p-3 font-medium">Học phí</th>
                      <th className="text-right p-3 font-medium">Đã đóng</th>
                      <th className="text-right p-3 font-medium">Còn nợ</th>
                      <th className="text-center p-3 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {agencyReport.invoices.map((inv, i) => (
                      <tr key={inv.id || i} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 text-white">{inv.studentName || inv.student_name}</td>
                        <td className="p-3 text-slate-300">{inv.courseName || inv.course_name}</td>
                        <td className="p-3 text-right text-white">{formatPrice(inv.basePrice || inv.base_price)}</td>
                        <td className="p-3 text-right text-emerald-400">{formatPrice(inv.totalPaid || inv.total_paid)}</td>
                        <td className="p-3 text-right text-red-400">{formatPrice(inv.remainingDue)}</td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                            inv.status === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {inv.status === 'paid' ? 'Đã đóng đủ' :
                             inv.status === 'partial' ? 'Đóng 1 phần' : 'Chưa đóng'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
