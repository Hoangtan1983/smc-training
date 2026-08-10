import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, Phone, Users, TrendingUp, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function StaffAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', phone: '', commission_rate: 10, address: '' });

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAgencies();
      setAgencies(res.data || res.agencies || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách đại lý.');
      toast.error('Không thể tải danh sách đại lý.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = agencies.filter(a => {
    const s = search.toLowerCase();
    const name = (a.name || a.agency_name || '').toLowerCase();
    const code = (a.code || a.agency_code || '').toLowerCase();
    return name.includes(s) || code.includes(s);
  });

  const openCreateModal = () => {
    setSelectedAgency(null);
    setForm({ name: '', code: '', phone: '', commission_rate: 10, address: '' });
    setModalOpen(true);
  };

  const openEditModal = (agency) => {
    setSelectedAgency(agency);
    setForm({
      name: agency.name || agency.agency_name || '',
      code: agency.code || agency.agency_code || '',
      phone: agency.phone || '',
      commission_rate: agency.commission_rate || agency.commissionRate || 10,
      address: agency.address || '',
    });
    setModalOpen(true);
  };

  const openDetail = (agency) => {
    setSelectedAgency(agency);
    setDetailOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'commission_rate' ? Number(value) : value }));
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Vui lòng nhập tên đại lý.');
      return;
    }
    setSaving(true);
    try {
      if (selectedAgency) {
        await api.createAgency(form);
        toast.success('Cập nhật đại lý thành công.');
      } else {
        await api.createAgency(form);
        toast.success('Tạo đại lý thành công.');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu đại lý.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (agency) => {
    const name = agency.name || agency.agency_name || 'A';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Quản lý đại lý"
        subtitle="Quản lý các đại lý tuyển sinh và hoa hồng"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Thêm đại lý
          </button>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, mã đại lý..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Chưa có đại lý nào" description="Nhấn 'Thêm đại lý' để tạo đại lý đầu tiên" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(agency => (
            <div
              key={agency.id}
              className="card-hover cursor-pointer"
              onClick={() => openDetail(agency)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-ios-lg bg-orange-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-orange-600" />
                </div>
                {agency.code && (
                  <span className="badge badge-info text-xs">{agency.code || agency.agency_code}</span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-2">
                {agency.name || agency.agency_name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                <Phone className="w-3 h-3" /> {agency.phone || '-'}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <span className="font-semibold text-green-600">
                    {agency.commission_rate || agency.commissionRate || 0}%
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>{agency.student_count || agency.students_count || agency.students || 0} HV</span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); openEditModal(agency); }}
                className="btn-ghost btn-sm w-full mt-2 text-blue-600 hover:bg-blue-50"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Sửa
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedAgency ? 'Sửa đại lý' : 'Thêm đại lý'}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tên đại lý</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập tên đại lý"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Mã đại lý</label>
              <input
                name="code"
                value={form.code}
                onChange={handleFormChange}
                className="input-field"
                placeholder="Mã đại lý"
              />
            </div>
            <div>
              <label className="input-label">Số điện thoại</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
                className="input-field"
                placeholder="0900000000"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Hoa hồng (%)</label>
            <input
              name="commission_rate"
              type="number"
              value={form.commission_rate}
              onChange={handleFormChange}
              className="input-field"
              placeholder="10"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="input-label">Địa chỉ</label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleFormChange}
              className="input-field min-h-[80px]"
              placeholder="Địa chỉ đại lý..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedAgency ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết đại lý"
        size="lg"
      >
        {selectedAgency && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-600">
                {getInitials(selectedAgency)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedAgency.name || selectedAgency.agency_name}</h3>
                <p className="text-sm text-gray-500">{selectedAgency.code || selectedAgency.agency_code || 'Chưa có mã'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Số điện thoại:</span> <span className="font-medium">{selectedAgency.phone || '-'}</span></div>
              <div><span className="text-gray-400">Hoa hồng:</span> <span className="font-medium text-green-600">{selectedAgency.commission_rate || selectedAgency.commissionRate || 0}%</span></div>
              <div className="col-span-2"><span className="text-gray-400">Địa chỉ:</span> <span className="font-medium">{selectedAgency.address || '-'}</span></div>
              <div><span className="text-gray-400">Số học viên:</span> <span className="font-medium">{selectedAgency.student_count || selectedAgency.students_count || selectedAgency.students || 0}</span></div>
            </div>

            {selectedAgency.students && selectedAgency.students.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Danh sách học viên</h4>
                <div className="bg-gray-50 rounded-ios-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {selectedAgency.students.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                            {(s.fullName || s.full_name || s.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{s.fullName || s.full_name || s.name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{s.course_name || s.courseName || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
