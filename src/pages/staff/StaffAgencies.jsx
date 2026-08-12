import { useState, useEffect, useRef } from 'react';
import { Building2, Search, Eye, Users as UsersIcon, Percent, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

/**
 * StaffAgencies — Nhân viên chỉ XEM danh sách đại lý và XUẤT Excel
 * KHÔNG có quyền Thêm / Sửa / Xóa
 */
export default function StaffAgencies() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);

  const fetchAgencies = async () => {
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAgencies(data.agencies || []);
    } catch (e) {
      toast.error('Không thể tải danh sách đại lý');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencyDetail = async (agencyId) => {
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch(`/api/agency.php?action=get/${agencyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDetailData(data.agency);
    } catch (e) {
      toast.error('Không thể tải chi tiết đại lý');
    }
  };

  useEffect(() => { fetchAgencies(); }, []);

  const filtered = agencies.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name || '').toLowerCase().includes(q)
      || (a.code || '').toLowerCase().includes(q)
      || (a.contactPerson || '').toLowerCase().includes(q)
      || (a.email || '').toLowerCase().includes(q)
      || (a.phone || '').includes(q);
  });

  // ─── Xuất Excel ───
  const handleExport = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh sách Đại lý');

      sheet.columns = [
        { header: 'Mã ĐL', key: 'code', width: 14 },
        { header: 'Tên Đại lý', key: 'name', width: 24 },
        { header: 'Người liên hệ', key: 'contactPerson', width: 20 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'SĐT', key: 'phone', width: 14 },
        { header: 'Chiết khấu (%)', key: 'discountPercent', width: 14 },
        { header: 'Số HV', key: 'studentCount', width: 10 },
        { header: 'Trạng thái', key: 'status', width: 14 },
        { header: 'Mã số thuế', key: 'taxCode', width: 16 },
        { header: 'Địa chỉ', key: 'address', width: 30 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } };
      sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 28;

      filtered.forEach(a => {
        sheet.addRow({
          code: a.code || '',
          name: a.name || '',
          contactPerson: a.contactPerson || '',
          email: a.email || '',
          phone: a.phone || '',
          discountPercent: a.discountPercent || 0,
          studentCount: a.studentCount || 0,
          status: a.status === 'active' ? 'Hoạt động' : 'Tạm khóa',
          taxCode: a.taxCode || '',
          address: a.address || '',
        });
      });

      // Format
      sheet.getColumn('discountPercent').numFmt = '0.0';
      sheet.getColumn('studentCount').alignment = { horizontal: 'center' };

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Danh-sach-Dai-ly-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ Đã xuất Excel');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('Lỗi khi xuất Excel');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-gray-500">Đang tải danh sách đại lý...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Danh sách Đại lý</h1>
          <p className="text-slate-500 mt-1">Tổng: {agencies.length} đại lý — Chỉ xem</p>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2">
          <Download size={18} /> Xuất Excel
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" placeholder="Tìm theo tên, mã, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
        />
      </div>

      {/* Agencies grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Không tìm thấy đại lý nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(agency => (
            <div key={agency.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-purple-200 transition-colors">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Building2 size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{agency.name}</h3>
                      <p className="text-xs text-slate-400">{agency.code}</p>
                    </div>
                  </div>
                  <span className={`badge text-xs ${agency.status === 'active' ? 'badge-emerald' : 'badge-red'}`}>
                    {agency.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  <p className="text-slate-600 flex items-center gap-2">
                    <UsersIcon size={14} className="text-slate-400" />
                    {agency.studentCount || 0} học viên
                  </p>
                  <p className="text-slate-600 flex items-center gap-2">
                    <Percent size={14} className="text-slate-400" />
                    Chiết khấu: <span className="font-bold text-orange-600">{agency.discountPercent}%</span>
                  </p>
                  <p className="text-slate-600">{agency.contactPerson || '---'}</p>
                  <p className="text-slate-400 text-xs">{agency.email}</p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => { setShowDetail(agency.id); fetchAgencyDetail(agency.id); }}
                    className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
                  >
                    <Eye size={14} /> Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal (read-only) */}
      {showDetail && detailData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowDetail(null); setDetailData(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Chi tiết Đại lý: {detailData.name}</h2>
              <button onClick={() => { setShowDetail(null); setDetailData(null); }} className="text-slate-400 hover:text-slate-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Agency Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><p className="text-slate-400">Mã đại lý</p><p className="font-medium">{detailData.code}</p></div>
                <div><p className="text-slate-400">Người liên hệ</p><p className="font-medium">{detailData.contactPerson || '---'}</p></div>
                <div><p className="text-slate-400">Email</p><p className="font-medium">{detailData.email}</p></div>
                <div><p className="text-slate-400">SĐT</p><p className="font-medium">{detailData.phone || '---'}</p></div>
                <div><p className="text-slate-400">Chiết khấu</p><p className="font-bold text-orange-600">{detailData.discountPercent}%</p></div>
                <div><p className="text-slate-400">Chủ thể</p><p className="font-medium">{detailData.subjectType === 'all' ? 'Tất cả' : detailData.subjectType === 'vlos' ? 'VLOS' : 'BVLOS'}</p></div>
              </div>

              {/* Stats */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  ['Học viên', detailData.stats?.totalStudents || 0],
                  ['Tổng HP gốc', new Intl.NumberFormat('vi-VN').format(detailData.stats?.totalTuition || 0) + 'đ'],
                  ['HP thực thu', new Intl.NumberFormat('vi-VN').format(detailData.stats?.totalActualTuition || 0) + 'đ'],
                  ['Chiết khấu', (detailData.stats?.discountPercent || 0) + '%'],
                  ['Trạng thái', detailData.status === 'active' ? 'Hoạt động' : 'Tạm khóa'],
                ].map(([label, value], i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>

              {/* Students list */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">Danh sách học viên ({detailData.students?.length || 0})</h3>
                {detailData.students && detailData.students.length > 0 ? (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Họ tên</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">SĐT</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.students.map(s => (
                          <tr key={s.id} className="border-t border-gray-100 hover:bg-slate-50">
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{s.fullName}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{s.phone || '---'}</td>
                            <td className="px-3 py-2 text-slate-500">{s.email}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`badge ${s.status === 'ACTIVE' ? 'badge-emerald' : 'badge-amber'}`}>
                                {s.status === 'ACTIVE' ? 'Hoạt động' : s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">Chưa có học viên nào</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
