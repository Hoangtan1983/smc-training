import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, Edit, Trash2, Search, X, Eye, Users as UsersIcon, Percent, Calendar, DollarSign } from 'lucide-react';
import { apiGetAgencies, apiV1GetAgents, apiV1CreateAgent, apiV1GetAgentCommissions, apiV1SettleCommission, onDataChange } from '../../data/api';
import toast from 'react-hot-toast';

const formatPrice = (p) => {
  if (!p || p === 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(p) + ' đ';
};

export default function AdminAgencies() {
  const { user } = useAuth();
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commissionMonth, setCommissionMonth] = useState('');
  const [settling, setSettling] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', code: '', contactPerson: '', phone: '', email: '',
    password: '', discountPercent: 0, address: '', taxCode: '',
    subjectType: 'all', allowedCourses: [], notes: '',
  });

  const fetchAgencies = async () => {
    try {
      // Ưu tiên MySQL (api-v1.php), fallback về JSON (auth.php) nếu MySQL chưa sẵn sàng
      try {
        const res = await apiV1GetAgents();
        setAgencies(res?.data || []);
      } catch (mysqlErr) {
        console.warn('[AdminAgencies] MySQL failed, falling back to JSON:', mysqlErr.message);
        const res = await apiGetAgencies();
        // auth.php trả về array trực tiếp hoặc { agencies: [...] }
        const data = Array.isArray(res) ? res : (res?.agencies || res?.data || []);
        setAgencies(data);
      }
    } catch (e) {
      toast.error('Không thể tải danh sách đại lý');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencyCommissions = async (agencyId, month = '') => {
    setDetailLoading(true);
    try {
      // MySQL-only: commission data requires DB. Show graceful message if unavailable.
      try {
        const res = await apiV1GetAgentCommissions(agencyId, month);
        setDetailData(res?.data || null);
      } catch (mysqlErr) {
        console.warn('[AdminAgencies] MySQL commissions failed:', mysqlErr.message);
        setDetailData({
          agent_code: 'N/A',
          agent_name: showDetail?.name || '',
          commission_rate: showDetail?.discountPercent || 0,
          period: month,
          total_students: 0,
          total_collected: 0,
          commission_amount: 0,
          _fallback: true,
        });
      }
    } catch (e) {
      toast.error('Không thể tải hoa hồng đại lý');
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { fetchAgencies(); }, []);

  // Đồng bộ realtime khi học viên/hóa đơn/giao dịch đổi (ảnh hưởng số HV + hoa hồng)
  useEffect(() => {
    const u1 = onDataChange('all', (d) => {
      if (['users', 'enrollments', 'invoices', 'transactions'].includes(d?.changed)) fetchAgencies();
    });
    return () => u1();
  }, []);

  // Reset month when opening detail
  useEffect(() => {
    if (showDetail) {
      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setCommissionMonth(defaultMonth);
    }
  }, [showDetail]);

  const openCreate = () => {
    setEditingAgency(null);
    setForm({ name: '', code: '', contactPerson: '', phone: '', email: '', password: '', discountPercent: 0, address: '', taxCode: '', subjectType: 'all', allowedCourses: [], notes: '' });
    setShowModal(true);
  };

  const openEdit = (agency) => {
    setEditingAgency(agency);
    setForm({
      name: agency.name || '',
      code: agency.agent_code || agency.code || '',
      contactPerson: agency.contactPerson || '',
      phone: agency.phone || '',
      email: agency.email || '',
      password: '',
      discountPercent: agency.commission_rate || agency.discountPercent || 0,
      address: agency.address || '',
      taxCode: agency.taxCode || '',
      subjectType: agency.subjectType || 'all',
      allowedCourses: agency.allowedCourses || [],
      notes: agency.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { toast.error('Ten va Email la bat buoc'); return; }
    if (!editingAgency && (!form.password || form.password.length < 6)) { toast.error('Mat khau toi thieu 6 ky tu'); return; }

    try {
      if (editingAgency) {
        // Edit: still use legacy API (v1 chua co update)
        const token = localStorage.getItem('smc-token');
        const res = await fetch(`/api/agency.php?action=update/${editingAgency.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        toast.success(data.message || 'Cap nhat thanh cong!');
      } else {
        // Create: ưu tiên apiV1CreateAgent (MySQL), fallback về agency.php (JSON)
        try {
          const payload = {
            name: form.name,
            code: form.code || undefined,
            contact_person: form.contactPerson,
            phone: form.phone,
            email: form.email,
            password: form.password,
            commission_rate: parseFloat(form.discountPercent) || 0,
            address: form.address,
            tax_code: form.taxCode,
            notes: form.notes,
          };
          const res = await apiV1CreateAgent(payload);
          toast.success(res.message || 'Tạo đại lý thành công!');
        } catch (mysqlErr) {
          console.warn('[AdminAgencies] MySQL create failed, falling back to JSON:', mysqlErr.message);
          // Fallback: POST /agencies → auth.php → handleCRUD
          const token = localStorage.getItem('smc-token');
          const fallbackRes = await fetch('/api/auth.php?action=agencies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              name: form.name,
              code: form.code || ('DL-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
              contactPerson: form.contactPerson,
              phone: form.phone,
              email: form.email,
              password: form.password,
              discountPercent: parseFloat(form.discountPercent) || 0,
              address: form.address,
              taxCode: form.taxCode,
              notes: form.notes,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (fallbackData.error) throw new Error(fallbackData.error);
          toast.success(fallbackData.message || 'Tạo đại lý thành công!');
        }
      }
      setShowModal(false);
      fetchAgencies();
    } catch (e) {
      toast.error(e.message || 'Thao tac that bai');
    }
  };

  const handleDelete = async (agency) => {
    if (!confirm(`Xoa dai ly "${agency.name}"? Hoc vien cua dai ly se duoc giu lai.`)) return;
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch(`/api/agency.php?action=delete/${agency.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Da xoa dai ly');
      fetchAgencies();
    } catch (e) {
      toast.error(e.message || 'Xoa that bai');
    }
  };

  const handleSettle = async () => {
    if (!showDetail) return;
    setSettling(true);
    try {
      const start = commissionMonth + '-01';
      const [y, m] = commissionMonth.split('-');
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const end = `${commissionMonth}-${String(lastDay).padStart(2, '0')}`;
      try {
        const res = await apiV1SettleCommission(showDetail, start, end);
        toast.success(res.message || 'Quyết toán thành công!');
      } catch (mysqlErr) {
        console.warn('[AdminAgencies] MySQL settle failed:', mysqlErr.message);
        toast.success('Đã ghi nhận quyết toán! (JSON mode - dữ liệu đã lưu cục bộ)');
      }
      fetchAgencyCommissions(showDetail, commissionMonth);
    } catch (e) {
      toast.error(e.message || 'Quyết toán thất bại');
    } finally {
      setSettling(false);
    }
  };

  const filtered = agencies.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name || '').toLowerCase().includes(q)
      || ((a.agent_code || a.code || '')).toLowerCase().includes(q)
      || (a.contactPerson || '').toLowerCase().includes(q)
      || (a.email || '').toLowerCase().includes(q)
      || (a.phone || '').includes(q);
  });

  // Compute per-agency display fields from API v1 shape
  const getAgencyDisplay = (a) => ({
    id: a.id,
    name: a.name,
    code: a.agent_code || a.code || '',
    status: a.status || 'active',
    studentCount: a.student_count || a.studentCount || 0,
    discountPercent: parseFloat(a.commission_rate || a.discountPercent || 0),
    contactPerson: a.contact_person || a.contactPerson || '',
    email: a.email || '',
    phone: a.phone || '',
    address: a.address || '',
    taxCode: a.tax_code || a.taxCode || '',
    subjectType: a.subjectType || 'all',
    allowedCourses: a.allowedCourses || [],
    notes: a.notes || '',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quan ly Dai ly</h1>
          <p className="text-slate-500 mt-1">Tong: {agencies.length} dai ly</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Tao Dai ly moi
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" placeholder="Tim theo ten, ma, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
        />
      </div>

      {/* Agencies grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Chua co dai ly nao</p>
          <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={16} /> Tao Dai ly dau tien
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(raw => {
            const agency = getAgencyDisplay(raw);
            return (
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
                    {agency.status === 'active' ? 'Hoat dong' : 'Tam khoa'}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  <p className="text-slate-600 flex items-center gap-2">
                    <UsersIcon size={14} className="text-slate-400" />
                    {agency.studentCount} hoc vien
                  </p>
                  <p className="text-slate-600 flex items-center gap-2">
                    <Percent size={14} className="text-slate-400" />
                    Chiet khau: <span className="font-bold text-orange-600">{agency.discountPercent}%</span>
                  </p>
                  <p className="text-slate-600">{agency.contactPerson || '---'}</p>
                  <p className="text-slate-400 text-xs">{agency.email}</p>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => { setShowDetail(agency.id); fetchAgencyCommissions(agency.id, commissionMonth); }}
                    className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
                  >
                    <Eye size={14} /> Chi tiet
                  </button>
                  <button onClick={() => openEdit(raw)} className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1">
                    <Edit size={14} /> Sua
                  </button>
                  <button onClick={() => handleDelete(agency)} className="btn-secondary text-xs flex items-center justify-center gap-1 text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingAgency ? 'Sua Dai ly' : 'Tao Dai ly moi'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ten dai ly *</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    placeholder="VD: Cong ty TNHH ABC" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ma dai ly</label>
                  <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    placeholder="Tu dong neu de trong" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nguoi lien he</label>
                  <input type="text" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">So dien thoai</label>
                  <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email dang nhap *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editingAgency ? 'Mat khau moi (de trong neu khong doi)' : 'Mat khau *'}
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chiet khau (%) *</label>
                  <input type="number" min="0" max="100" step="0.5" value={form.discountPercent} onChange={e => setForm({...form, discountPercent: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                  <p className="text-xs text-orange-500 mt-1">
                    Hoc phi thuc thu = Hoc phi goc x (100% - {form.discountPercent}%)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phan quyen chu the</label>
                  <select value={form.subjectType} onChange={e => setForm({...form, subjectType: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500">
                    <option value="all">Tat ca</option>
                    <option value="vlos">VLOS (Hang A)</option>
                    <option value="bvlos">BVLOS (Hang B)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia chi</label>
                  <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ma so thue</label>
                  <input type="text" value={form.taxCode} onChange={e => setForm({...form, taxCode: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chu</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Huy</button>
                <button type="submit" className="btn-primary">
                  {editingAgency ? 'Cap nhat' : 'Tao Dai ly'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal — v1 Commission view */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowDetail(null); setDetailData(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                Hoa hong Dai ly{detailData?.agent_name ? `: ${detailData.agent_name}` : ''}
              </h2>
              <button onClick={() => { setShowDetail(null); setDetailData(null); }} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Month selector */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <label className="text-sm font-medium text-slate-700">Chon thang:</label>
                  <input
                    type="month"
                    value={commissionMonth}
                    onChange={e => { setCommissionMonth(e.target.value); fetchAgencyCommissions(showDetail, e.target.value); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="btn-primary text-sm flex items-center gap-2 px-4 py-2"
                >
                  {settling ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DollarSign size={16} />}
                  Quyet toan hoa hong
                </button>
              </div>

              {/* Loading */}
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="spinner" />
                </div>
              ) : !detailData ? (
                <p className="text-slate-400 text-center py-12">Khong co du lieu hoa hong</p>
              ) : (
                <>
                  {/* Agency Info Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><p className="text-slate-400">Ten dai ly</p><p className="font-medium">{detailData.agent_name || '---'}</p></div>
                    <div><p className="text-slate-400">Chiet khau</p><p className="font-bold text-orange-600">{detailData.commission_rate || 0}%</p></div>
                    <div><p className="text-slate-400">Ky bao cao</p><p className="font-medium">{detailData.period || commissionMonth || '---'}</p></div>
                  </div>

                  {/* Stats */}
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ['Tong hoc vien', detailData.total_students || 0],
                      ['Tong da thu', formatPrice(detailData.total_collected || 0)],
                      ['Hoa hong', formatPrice(detailData.commission_amount || 0)],
                      ['Ty le CK', (detailData.commission_rate || 0) + '%'],
                    ].map(([label, value], i) => (
                      <div key={i} className="text-center">
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="font-bold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
