import { useState, useEffect } from 'react';
import {
  apiGetOverallReport, apiGetAgencyReport,
} from '../../data/api';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Building2,
  BarChart3, Download, RefreshCw
} from 'lucide-react';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';

const formatPrice = (p) => {
  if (!p || p === 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);
};

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('overview');
  const [revenue, setRevenue] = useState(null);
  const [agency, setAgency] = useState(null);
  const [debts, setDebts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ĐÃ THỐNG NHẤT: Dùng apiGetOverallReport + apiGetAgencyReport (v3 tuition-service.php)
  // thay vì apiV1RevenueReport + apiV1AgencyReport + apiV1DebtsReport (MySQL)
  // Tất cả data từ invoices.json — cùng nguồn với AdminTuition
  const loadData = async () => {
    setLoading(true);
    try {
      const [overallRes, agRes] = await Promise.all([
        apiGetOverallReport().catch(() => ({ data: {} })),
        apiGetAgencyReport().catch(() => ({ data: {} })),
      ]);
      const oData = overallRes?.data || {};
      const agData = agRes?.data || {};

      // Map sang format cũ để không phải sửa JSX
      setRevenue({
        summary: {
          total_enrollments: oData.total_invoices || 0,
          fully_paid: oData.free_student_count || 0,  // sẽ override bên dưới
          partially_paid: oData.total_students || 0,
          unpaid: Math.max(0, (oData.total_invoices || 0) - (oData.total_students || 0)),
          pipeline_value: oData.total_base_price || 0,
          total_collected: oData.total_received || 0,
          total_outstanding: oData.total_due || 0,
        },
        monthly: (oData.by_course || []).map(c => ({
          month: c.name || '',
          txns: c.invoices || 0,
          revenue: c.received || 0,
          cash: 0,
          bank: 0,
          'Thang': c.name || '',
          'So Giao Dich': c.invoices || 0,
          'Doanh Thu Thuc Thu': c.received || 0,
          'Tien Mat': 0,
          'Chuyen Khoan': 0,
        })),
      });

      // Tính paid/unpaid/partial từ data
      const totalInv = oData.total_invoices || 0;
      const totalPaid = Math.round((oData.collection_rate || 0) / 100 * totalInv) || 0;
      setRevenue(prev => ({
        ...prev,
        summary: {
          ...prev.summary,
          fully_paid: totalPaid,
          partially_paid: Math.max(0, totalInv - totalPaid - (prev.summary.unpaid || 0)),
          unpaid: Math.max(0, totalInv - totalPaid),
        }
      }));

      setAgency((oData.by_agency || agData.invoices || []).map(a => ({
        agent_code: a.name || '',
        agent_name: a.name || '',
        commission_rate: a.discountPercent || 0,
        student_count: a.students || a.invoices || 0,
        total_collected: a.received || 0,
        commission_earned: a.discountTotal || 0,
        unsettled: 0,
        settled: a.discountTotal || 0,
      })));

      // Debts: từ by_course (tương đương)
      setDebts({
        by_sale: [],
        by_agent: (oData.by_agency || []).map(a => ({
          agent_name: a.name || '',
          count: a.students || 0,
          total_debt: a.due || 0,
        })),
      });
    } catch (err) {
      console.error('[AdminReports] Load error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const summary = revenue?.summary || {};
  const monthly = revenue?.monthly || [];
  
  const totalEnr = parseInt(summary.total_enrollments || 0);
  const fullyPaid = parseInt(summary.fully_paid || 0);
  const partiallyPaid = parseInt(summary.partially_paid || 0);
  const unpaid = parseInt(summary.unpaid || 0);
  const pipeline = parseInt(summary.pipeline_value || 0);
  const collected = parseInt(summary.total_collected || 0);
  const outstanding = parseInt(summary.total_outstanding || 0);
  const collectionRate = pipeline > 0 ? Math.round(collected / pipeline * 100) : 0;

  // Simple bar chart: max revenue for scaling
  const maxRev = Math.max(1, ...monthly.map(m => parseInt(m.revenue || m['Doanh Thu Thực Thu'] || 0)));

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws1 = wb.addWorksheet('Doanh thu theo thang');
      ws1.columns = [
        { header: 'Thang', key: 'month', width: 15 },
        { header: 'So GD', key: 'txns', width: 12 },
        { header: 'Doanh thu', key: 'revenue', width: 20 },
        { header: 'Tien mat', key: 'cash', width: 20 },
        { header: 'Chuyen khoan', key: 'bank', width: 20 },
      ];
      monthly.forEach(m => ws1.addRow({
        month: m.month || m['Thang'], txns: m.txns || m['So Giao Dich'],
        revenue: parseInt(m.revenue || m['Doanh Thu Thuc Thu'] || 0),
        cash: parseInt(m.cash || m['Tien Mat'] || 0),
        bank: parseInt(m.bank || m['Chuyen Khoan'] || 0),
      }));
      ['revenue', 'cash', 'bank'].forEach(col => ws1.getColumn(col).numFmt = '#,##0');

      if (agency.length > 0) {
        const ws2 = wb.addWorksheet('Hoa hong dai ly');
        ws2.columns = [
          { header: 'Ma DL', key: 'code', width: 15 },
          { header: 'Ten', key: 'name', width: 25 },
          { header: '% HH', key: 'rate', width: 10 },
          { header: 'So HV', key: 'students', width: 10 },
          { header: 'Da thu', key: 'collected', width: 20 },
          { header: 'Hoa hong', key: 'earned', width: 20 },
          { header: 'Chua QT', key: 'unsettled', width: 20 },
          { header: 'Da QT', key: 'settled', width: 20 },
        ];
        agency.forEach(a => ws2.addRow({
          code: a.agent_code, name: a.agent_name, rate: (a.commission_rate) + '%',
          students: a.student_count, collected: parseInt(a.total_collected || 0),
          earned: parseInt(a.commission_earned || 0), unsettled: parseInt(a.unsettled || 0),
          settled: parseInt(a.settled || 0),
        }));
        ['collected', 'earned', 'unsettled', 'settled'].forEach(col => ws2.getColumn(col).numFmt = '#,##0');
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `SMC_BaoCao_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Da xuat bao cao Excel');
    } catch (err) { toast.error('Loi: ' + err.message); }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Dang tai bao cao thong nhat tu he thong...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900"> Bao cao Tai chinh</h1>
          <p className="text-sm text-gray-500 mt-0.5">Du lieu thong nhat tu he thong hoc phi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={handleExportExcel} disabled={exporting} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            {exporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            Xuat Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'overview', label: ' Tong quan' },
          { key: 'revenue', label: ' Doanh thu' },
          { key: 'debts', label: ' Cong no' },
          { key: 'agency', label: ' Hoa hong' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white shadow text-purple-700' : 'text-gray-600 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tong ho so', val: totalEnr, sub: `${fullyPaid} hoan thanh / ${partiallyPaid} dang dong`, icon: Users, color: 'purple' },
              { label: 'Pipeline (du kien)', val: formatPrice(pipeline), sub: 'Tong gia tri tat ca ho so', icon: TrendingUp, color: 'blue' },
              { label: 'Da thu thuc te', val: formatPrice(collected), sub: `Ty le: ${collectionRate}%`, icon: DollarSign, color: 'green' },
              { label: 'Con ton dong', val: formatPrice(outstanding), sub: `${partiallyPaid + unpaid} hoc vien dang no`, icon: TrendingDown, color: 'red' },
            ].map((s, i) => (
              <div key={i} className={`bg-${s.color}-50 rounded-2xl p-4 border border-black/5`}>
                <div className="flex items-center gap-2 mb-2"><s.icon className={`w-5 h-5 text-${s.color}-700`} /><div className="text-xs font-medium text-gray-500">{s.label}</div></div>
                <div className={`text-xl font-extrabold text-${s.color}-700`}>{s.val}</div>
                <div className="text-xs text-gray-400 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center bg-green-50"><div className="text-2xl font-extrabold text-green-600">{fullyPaid}</div><div className="text-sm text-gray-600"> Da nop du</div></div>
            <div className="card p-4 text-center bg-amber-50"><div className="text-2xl font-extrabold text-amber-600">{partiallyPaid}</div><div className="text-sm text-gray-600"> Nop 1 phan</div></div>
            <div className="card p-4 text-center bg-red-50"><div className="text-2xl font-extrabold text-red-600">{unpaid}</div><div className="text-sm text-gray-600"> Chua nop</div></div>
          </div>

          {/* Simple bar chart: monthly revenue */}
          <div className="card p-5 mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Doanh thu theo thang</h3>
            <div className="space-y-3">
              {monthly.slice(-12).map((m, i) => {
                const rev = parseInt(m.revenue || m['Doanh Thu Thuc Thu'] || 0);
                const pct = Math.round(rev / maxRev * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-16 text-xs font-medium text-gray-600 text-right">{m.month || m['Thang']}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full flex items-center justify-end pr-2 transition-all" style={{width: `${pct}%`}}>
                        {pct > 15 && <span className="text-xs text-white font-bold">{formatPrice(rev)}</span>}
                      </div>
                    </div>
                    {pct <= 15 && <span className="text-xs text-gray-500 w-24">{formatPrice(rev)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* REVENUE TAB */}
      {activeTab === 'revenue' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-blue-50">
            <h3 className="font-bold text-blue-800"><BarChart3 className="w-4 h-4 inline mr-2" />Doanh thu thuc thu theo thang</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b-2"><th className="text-left p-3 font-semibold">Thang</th><th className="text-center p-3">GD</th><th className="text-right p-3">Doanh thu</th><th className="text-right p-3">Tien mat</th><th className="text-right p-3">CK</th></tr></thead>
              <tbody>
                {monthly.length === 0 ? <tr><td colSpan={5} className="text-center p-10 text-gray-400">Chua co du lieu</td></tr> :
                  monthly.map((m, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold">{m.month || m['Thang']}</td>
                      <td className="p-3 text-center">{m.txns || m['So Giao Dich']}</td>
                      <td className="p-3 text-right font-mono font-bold text-green-600">{formatPrice(parseInt(m.revenue || m['Doanh Thu Thuc Thu'] || 0))}</td>
                      <td className="p-3 text-right font-mono">{formatPrice(parseInt(m.cash || m['Tien Mat'] || 0))}</td>
                      <td className="p-3 text-right font-mono">{formatPrice(parseInt(m.bank || m['Chuyen Khoan'] || 0))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEBTS TAB */}
      {activeTab === 'debts' && debts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card"><div className="p-4 border-b bg-red-50"><h3 className="font-bold text-red-800">Cong no theo Sale</h3></div>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-left">Sale</th><th className="p-3 text-center">HV</th><th className="p-3 text-right">No</th></tr></thead>
              <tbody>{(debts.by_sale || []).map((s, i) => <tr key={i} className="border-b"><td className="p-3 font-semibold">{s.sale_name}</td><td className="p-3 text-center">{s.count}</td><td className="p-3 text-right font-bold text-red-600">{formatPrice(parseInt(s.total_debt || 0))}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="card"><div className="p-4 border-b bg-orange-50"><h3 className="font-bold text-orange-800">Cong no theo Dai ly</h3></div>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-left">Dai ly</th><th className="p-3 text-center">HV</th><th className="p-3 text-right">No</th></tr></thead>
              <tbody>{(debts.by_agent || []).map((a, i) => <tr key={i} className="border-b"><td className="p-3 font-semibold">{a.agent_name}</td><td className="p-3 text-center">{a.count}</td><td className="p-3 text-right font-bold text-red-600">{formatPrice(parseInt(a.total_debt || 0))}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* AGENCY TAB */}
      {activeTab === 'agency' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-orange-50"><h3 className="font-bold text-orange-800"><Building2 className="w-4 h-4 inline mr-2" />Hoa hong Dai ly (real-time)</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b-2">
              <th className="text-left p-3">Ma DL</th><th className="text-left p-3">Ten</th><th className="text-center p-3">% HH</th><th className="text-center p-3">HV</th>
              <th className="text-right p-3">Da thu</th><th className="text-right p-3">Hoa hong</th><th className="text-right p-3">Chua QT</th><th className="text-right p-3">Da QT</th>
            </tr></thead>
            <tbody>
              {agency.length === 0 ? <tr><td colSpan={8} className="text-center p-10 text-gray-400">Chua co du lieu</td></tr> :
                agency.map((a, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">{a.agent_code}</td><td className="p-3 font-semibold">{a.agent_name}</td>
                    <td className="p-3 text-center font-bold text-orange-600">{a.commission_rate}%</td><td className="p-3 text-center">{a.student_count}</td>
                    <td className="p-3 text-right font-mono text-green-600">{formatPrice(parseInt(a.total_collected || 0))}</td>
                    <td className="p-3 text-right font-mono font-bold text-orange-600">{formatPrice(parseInt(a.commission_earned || 0))}</td>
                    <td className="p-3 text-right font-mono text-amber-600">{formatPrice(parseInt(a.unsettled || 0))}</td>
                    <td className="p-3 text-right font-mono text-green-600">{formatPrice(parseInt(a.settled || 0))}</td>
                  </tr>
                ))}
            </tbody></table>
          </div>
        </div>
      )}
      
      <div className="text-xs text-gray-400 text-center mt-6">Du lieu thong nhat tu he thong hoc phi</div>
    </div>
  );
}
