import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Users, Mail, Phone, TrendingUp } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function AdminAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', agent_code: '', phone: '', email: '', address: '', commission_rate: 10,
  });

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

  const openCreateModal = () => {
    setSelectedAgency(null);
    setForm({ name: '', agent_code: '', phone: '', email: '', address: '', commission_rate: 10 });
    setModalOpen(true);
  };

  const openEditModal = (agency) => {
    setSelectedAgency(agency);
    setForm({
      name: agency.name || agency.agency_name || '',
      agent_code: agency.agent_code || agency.code || '',
      phone: agency.phone || '',
      email: agency.email || '',
      address: agency.address || '',
      commission_rate: agency.commission_rate || agency.commissionRate || 10,
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
    if (!form.name || !form.agent_code) {
      toast.error('Vui lòng nhập tên và mã đại lý.');
      return;
    }
    setSaving(true);
    try {
      if (selectedAgency) {
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

  const getStudentCount = (agency) => {
    return agency.student_count || agency.students?.length || agency.enrollment_count || 0;
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

      {agencies.length === 0 ? (
        <EmptyState icon={Building2} title="Chưa có đại lý nào" description="Nhấn 'Thêm đại lý' để tạo đại lý đầu tiên" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agencies.map(agency => (
            <div
              key={agency.id}
              className="card-hover"
              onClick={() => openDetail(agency)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-ios-lg bg-orange-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-orange-600">{getInitials(agency)}</span>
                </div>
                <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-ios">
                  {agency.agent_code || agency.code || '-'}
                </span>
              </div>

              <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-1">
                {agency.name || agency.agency_name}
              </h3>

              <div className="space-y-1.5 mb-3">
                {agency.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{agency.email}</span>
                  </div>
                )}
                {agency.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Phone className="w-3 h-3" />
                    <span>{agency.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="font-semibold text-gray-900">{getStudentCount(agency)}</span>
                  <span className="text-xs text-gray-400">học viên</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="font-semibold text-green-600">
                    {agency.commission_rate || agency.commissionRate || 10}%
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); openEditModal(agency); }}
                className="btn-ghost btn-sm w-full mt-3 text-smc-600 hover:bg-smc-50"
              >
                Chỉnh sửa
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
          <div>
            <label className="input-label">Mã đại lý</label>
            <input
              name="agent_code"
              value={form.agent_code}
              onChange={handleFormChange}
              className="input-field"
              placeholder="VD: AG001"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="input-label">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                className="input-field"
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Địa chỉ</label>
            <input
              name="address"
              value={form.address}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập địa chỉ"
            />
          </div>
          <div>
            <label className="input-label">Tỉ lệ hoa hồng (%)</label>
            <input
              name="commission_rate"
              type="number"
              value={form.commission_rate}
              onChange={handleFormChange}
              className="input-field"
              placeholder="10"
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
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đại lý" size="lg">
        {selectedAgency && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-600">
                {getInitials(selectedAgency)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedAgency.name || selectedAgency.agency_name}</h3>
                <p className="text-sm text-gray-400 font-mono">{selectedAgency.agent_code || selectedAgency.code}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Email:</span> <span className="font-medium">{selectedAgency.email || '-'}</span></div>
              <div><span className="text-gray-400">Số điện thoại:</span> <span className="font-medium">{selectedAgency.phone || '-'}</span></div>
              <div><span className="text-gray-400">Địa chỉ:</span> <span className="font-medium">{selectedAgency.address || '-'}</span></div>
              <div><span className="text-gray-400">Hoa hồng:</span> <span className="font-medium text-green-600">{selectedAgency.commission_rate || selectedAgency.commissionRate || 10}%</span></div>
              <div><span className="text-gray-400">Tổng học viên:</span> <span className="font-medium">{getStudentCount(selectedAgency)}</span></div>
              <div><span className="text-gray-400">Ngày tạo:</span> <span className="font-medium">{selectedAgency.created_at || selectedAgency.createdAt || '-'}</span></div>
            </div>

            {/* Student list of this agency */}
            {selectedAgency.students && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Danh sách học viên</h4>
                <div className="bg-gray-50 rounded-ios-lg p-3 max-h-60 overflow-y-auto">
                  {selectedAgency.students.length === 0 ? (
                    <p className="text-sm text-gray-400">Chưa có học viên nào.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAgency.students.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">
                            {(s.fullName || s.full_name || s.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">{s.fullName || s.full_name || s.name}</span>
                            <span className="text-gray-400 ml-2">{s.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
