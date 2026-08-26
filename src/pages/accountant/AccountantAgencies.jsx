/**
 * AccountantAgencies — Wrapper cho Kế toán
 *
 * Chỉ xem danh sách đại lý & hoa hồng, không tạo/sửa/xóa đại lý.
 */
import { useState, useEffect } from 'react';
import { Building2, Search, Eye, Percent, DollarSign } from 'lucide-react';
import { apiV1GetAgents, apiV1GetAgentCommissions } from '../../data/api';
import toast from 'react-hot-toast';

const formatPrice = (p) => {
  if (!p || p === 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(p) + ' đ';
};

export default function AccountantAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);

  useEffect(() => {
    apiV1GetAgents()
      .then(res => setAgencies(res?.data || []))
      .catch(() => toast.error('Không thể tải danh sách đại lý'))
      .finally(() => setLoading(false));
  }, []);

  const viewDetail = async (agency) => {
    setShowDetail(agency);
    setDetailData(null);
    try {
      const res = await apiV1GetAgentCommissions(agency.id || agency.agent_code);
      setDetailData(res?.data || { commissions: [], summary: {} });
    } catch {
      toast.error('Không thể tải hoa hồng');
    }
  };

  const filtered = agencies.filter(a =>
    (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.contact_person || a.contactPerson || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-emerald-500" /> Đại lý & Hoa hồng
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kế toán — Xem danh sách đại lý và hoa hồng</p>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm đại lý..." />
        </div>
      </div>

      {/* Agency list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {filtered.map(agency => (
          <div key={agency.id || agency.agent_code} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{agency.name}</h3>
                <p className="text-xs text-gray-500">{agency.contact_person || agency.contactPerson}</p>
              </div>
              <span className="badge bg-purple-100 text-purple-700 text-xs flex items-center gap-1">
                <Percent className="w-3 h-3" /> {parseFloat(agency.commission_rate) || 0}%
              </span>
            </div>
            <div className="text-sm text-gray-500 space-y-1 mb-3">
              <p>📞 {agency.phone || '—'}</p>
              <p>✉️ {agency.email || '—'}</p>
            </div>
            <button onClick={() => viewDetail(agency)} className="btn-ghost text-xs w-full flex items-center justify-center gap-1">
              <Eye className="w-3 h-3" /> Xem hoa hồng
            </button>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Hoa hồng — {showDetail.name}</h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {detailData ? (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-500">Tổng hoa hồng</div>
                    <div className="text-lg font-extrabold text-purple-600">{formatPrice(detailData.commission_amount || 0)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-500">Tổng thu học phí</div>
                    <div className="text-lg font-extrabold text-green-600">{formatPrice(detailData.total_collected || 0)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-500">Số học viên</div>
                    <div className="text-lg font-extrabold text-gray-800">{detailData.total_students || 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-sm text-gray-500">Tỷ lệ hoa hồng</div>
                    <div className="text-lg font-extrabold text-gray-800">{detailData.commission_rate || 0}%</div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">Kỳ: {detailData.period || '—'}</p>
              </div>
            ) : (
              <div className="text-center py-8"><div className="spinner mx-auto" /></div>
            )}
          </div>
        </div>
      )}

      <div className="text-center text-sm text-gray-400 mt-4">
        💡 Kế toán chỉ có quyền xem. Cần tạo/sửa đại lý? Liên hệ Admin.
      </div>
    </div>
  );
}
