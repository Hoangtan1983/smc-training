import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Percent, Users, Target, BarChart3, BookOpen, Building, CreditCard, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { apiGetAgencyReport, onDataChange } from '../../data/api';
import toast from 'react-hot-toast';

export default function AgencyReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const fetchReport = async () => {
    try {
      // Dùng v3 API — cùng nguồn dữ liệu với Admin và Staff
      const res = await apiGetAgencyReport();
      const data = res?.data || {};
      setReport(data);
    } catch (e) {
      toast.error('Không thể tải báo cáo: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  // Real-time sync
  useEffect(() => {
    const unsub = onDataChange('invoices', () => fetchReport());
    const unsub2 = onDataChange('transactions', () => fetchReport());
    return () => { unsub(); unsub2(); };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  const stats = report?.stats || {};
  const agency = report?.agency || {};
  const invoices = report?.invoices || [];

  // Gom theo hạng thi từ invoices
  const byCourse = {};
  const courseStudents = {};
  invoices.forEach(inv => {
    const courseName = inv.courseName || 'Chưa xác định';
    // Xác định hạng: VLOS (A) hay BVLOS (B)
    // Ưu tiên: courseId → basePrice → courseName string match
    let group = courseName;
    const cn = (courseName || '').toLowerCase();
    const cid = inv.courseId || '';
    const bp = inv.basePrice || 0;

    // 1. CourseId lookup (chính xác nhất)
    const VLOS_COURSE_IDS = ['c-8468783fde8fa5a4']; // SMC-VLOSK1
    const BVLOS_COURSE_IDS = ['c-966aaa6eca2d1a07', 'c-980eba3db04f6526']; // SMC-BVLOSK1, SMC-BVLOSK2

    if (VLOS_COURSE_IDS.includes(cid)) group = 'VLOS (Hạng A)';
    else if (BVLOS_COURSE_IDS.includes(cid)) group = 'BVLOS (Hạng B)';
    // 2. BasePrice lookup (15M = Hạng A, 25M = Hạng B)
    else if (bp === 15000000) group = 'VLOS (Hạng A)';
    else if (bp === 25000000) group = 'BVLOS (Hạng B)';
    // 3. Fallback: string matching on courseName
    else if (cn.includes('bvlos') || cn.includes('hạng b')) group = 'BVLOS (Hạng B)';
    else if (cn.includes('vlos') || cn.includes('hạng a')) group = 'VLOS (Hạng A)';

    if (!byCourse[group]) byCourse[group] = { name: group, students: 0, received: 0, discount: 0, paidToSmc: 0 };
    if (!courseStudents[group]) courseStudents[group] = new Set();

    const paid = inv.totalPaid || 0;
    const discAmt = inv.agencyDiscountAmount || 0;
    const owesSmc = inv.owesToSmc || 0;

    byCourse[group].received += paid;
    byCourse[group].discount += discAmt;
    byCourse[group].paidToSmc += owesSmc;
    courseStudents[group].add(inv.studentId || inv.studentName);
  });

  Object.keys(byCourse).forEach(g => {
    byCourse[g].students = courseStudents[g] ? courseStudents[g].size : 0;
  });

  const formatMoney = (v) => new Intl.NumberFormat('vi-VN').format(v || 0) + 'đ';

  const topCards = [
    { label: 'Tổng học viên', value: stats.totalStudents || 0, sub: 'học viên', icon: Users, color: 'blue' },
    { label: 'Tổng thực thu', value: formatMoney(stats.totalPaid), sub: 'Số tiền Đại lý đã thực thu từ học viên', icon: TrendingUp, color: 'emerald' },
    { label: 'Tổng chiết khấu', value: formatMoney(stats.totalDiscount || 0), sub: 'Đại lý được hưởng (' + (agency.discountPercent || 0) + '% trên giá gốc)', icon: Percent, color: 'orange' },
    { label: 'Phải nộp cho SMC', value: formatMoney(stats.totalOwesToSmc), sub: 'Số tiền Đại lý phải nộp về SMC', icon: Building, color: 'purple' },
  ];

  const subCards = [
    { label: 'Đã thu từ HV', value: formatMoney(stats.totalPaid), icon: ArrowUpCircle, color: 'green' },
    { label: 'Chưa thu từ HV', value: formatMoney(stats.totalDue), icon: ArrowDownCircle, color: 'red' },
    { label: 'Đã đóng đủ', value: (stats.paidCount || 0) + '/' + (stats.totalStudents || 0), icon: Target, color: 'emerald' },
    { label: 'Tỷ lệ thu', value: (stats.collectionRate || 0) + '%', icon: CreditCard, color: 'blue' },
  ];

  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Báo cáo doanh thu</h1>
        <p className="text-slate-500 mt-1">Đại lý: {agency.name} — Chiết khấu: {agency.discountPercent || 0}%</p>
        <p className="text-xs text-slate-400 mt-0.5">Đồng bộ real-time với hệ thống v3 (Invoice + Transactions)</p>
      </div>

      {/* TOP Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((s, i) => {
          const c = colorClasses[s.color] || colorClasses.blue;
          return (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <s.icon size={20} className={c.text} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="text-xl font-bold text-slate-800">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SUB Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {subCards.map((s, i) => {
          const c = colorClasses[s.color] || colorClasses.blue;
          return (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={16} className={c.text} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DOANH THU THEO HẠNG (từ v3) */}
      {Object.keys(byCourse).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Doanh thu theo hạng thi
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2">
                  <th className="text-left p-3 font-semibold text-gray-600">Hạng thi</th>
                  <th className="text-center p-3 font-semibold text-gray-600">HV</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Đã thực thu</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Chiết khấu</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Phải nộp SMC</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Tỷ lệ nộp SMC</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCourse).map(([key, c]) => {
                  const smcPct = (c.received || 0) > 0 ? Math.round((c.paidToSmc || 0) / c.received * 100) : 0;
                  return (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="p-3 font-semibold">{c.name}</td>
                      <td className="p-3 text-center">{c.students}</td>
                      <td className="p-3 text-right font-mono text-blue-700">{(c.received || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-3 text-right font-mono text-orange-600">{(c.discount || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-3 text-right font-mono text-purple-700">{(c.paidToSmc || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-20 h-2 bg-gray-200 rounded-full">
                            <div className="h-full rounded-full" style={{width: smcPct+'%', background: smcPct >= 80 ? '#16a34a' : smcPct >= 40 ? '#d97706' : '#dc2626'}} />
                          </div>
                          <span className="text-xs">{smcPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td className="p-3">Tổng cộng</td>
                  <td className="p-3 text-center">{stats.totalStudents || 0}</td>
                  <td className="p-3 text-right text-blue-700">{formatMoney(stats.totalPaid)}</td>
                  <td className="p-3 text-right text-orange-600">{formatMoney(stats.totalDiscount || 0)}</td>
                  <td className="p-3 text-right text-purple-700">{formatMoney(stats.totalOwesToSmc)}</td>
                  <td className="p-3 text-right">{stats.collectionRate || 0}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CHI TIẾT HỌC VIÊN (từ v3 invoices) */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4" /> Chi tiết từng học viên
            </h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showDetails ? 'Thu gọn' : 'Xem chi tiết (' + invoices.length + ' HV)'}
            </button>
          </div>
          {showDetails && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b-2">
                    <th className="text-left p-2 font-semibold text-gray-600">Học viên</th>
                    <th className="text-left p-2 font-semibold text-gray-600">Khóa học</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Giá gốc</th>
                    <th className="text-right p-2 font-semibold text-gray-600">CK ({agency.discountPercent || 0}%)</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Phải nộp SMC</th>
                    <th className="text-right p-2 font-semibold text-gray-600">Đã nộp</th>
                    <th className="text-center p-2 font-semibold text-gray-600">TT</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, idx) => (
                    <tr key={inv.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-medium">{inv.studentName}</td>
                      <td className="p-2 text-xs text-gray-500">{inv.courseName}</td>
                      <td className="p-2 text-right font-mono text-xs text-gray-500">{(inv.basePrice || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-2 text-right font-mono text-xs text-orange-600">-{(inv.agencyDiscountAmount || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-2 text-right font-mono text-xs text-blue-700">{(inv.owesToSmc || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-2 text-right font-mono text-xs text-green-600">{(inv.totalPaid || 0).toLocaleString('vi-VN')}đ</td>
                      <td className="p-2 text-center">
                        <span className={`badge text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {inv.status === 'paid' ? 'Đủ' : inv.status === 'partial' ? '1 phần' : 'Chưa'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Agency Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Thông tin đại lý</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-400">Tên đại lý</p><p className="font-medium text-slate-700">{agency.name || '---'}</p></div>
          <div><p className="text-slate-400">Mã đại lý</p><p className="font-medium text-slate-700">{agency.id || '---'}</p></div>
          <div><p className="text-slate-400">Chiết khấu</p><p className="font-bold text-orange-600">{agency.discountPercent || 0}%</p></div>
          <div><p className="text-slate-400">Học viên hiện tại</p><p className="font-medium text-slate-700">{stats.totalStudents || 0}</p></div>
        </div>
      </div>
    </div>
  );
}
