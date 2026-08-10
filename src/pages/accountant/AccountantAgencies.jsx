import { useState, useEffect, useCallback } from 'react';
import { Building2, Mail, Phone, Users, TrendingUp, DollarSign, Eye, CheckCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import SearchInput from '../../components/ui/SearchInput';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const MONTHS = [
  { value: 1, label: 'Tháng 1' }, { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' }, { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' }, { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' }, { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' }, { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' }, { value: 12, label: 'Tháng 12' },
];

export default function AccountantAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [agencyReports, setAgencyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settleForm, setSettleForm] = useState({
    period: '',
    amount: 0,
    notes: '',
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agenciesRes, reportsRes] = await Promise.all([
        api.getAgencies(),
        api.getReports('agency'),
      ]);

      const agencies = agenciesRes.data || agenciesRes.agencies || [];
      const reports = reportsRes.data || reportsRes || {};

      setAgencies(agencies);

      const commissionData =
        reports.agency_commissions ||
        reports.agencyCommissions ||
        reports.data ||
        agencies.map((a) => ({
          agency_id: a.id,
          agency_name: a.name || a.agency_name,
          total_commission: a.total_commission || a.totalCommission || 0,
          total_paid: a.total_paid || a.totalPaid || 0,
          remaining: (a.total_commission || a.totalCommission || 0) - (a.total_paid || a.totalPaid || 0),
          commission_rate: a.commission_rate || a.commissionRate || 10,
        }));

      setAgencyReports(commissionData);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu đại lý.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getInitials = (agency) => {
    const name = agency.name || agency.agency_name || 'A';
    return name.charAt(0).toUpperCase();
  };

  const getStudentCount = (agency) => {
    return agency.student_count || agency.students?.length || agency.enrollment_count || 0;
  };

  const getCommissionData = (agency) => {
    return (
      agencyReports.find(
        (r) => r.agency_id === agency.id || r.agencyId === agency.id || r.id === agency.id
      ) || {
        total_commission: agency.total_commission || agency.totalCommission || 0,
        total_paid: agency.total_paid || agency.totalPaid || 0,
        remaining:
          (agency.total_commission || agency.totalCommission || 0) -
          (agency.total_paid || agency.totalPaid || 0),
        commission_rate: agency.commission_rate || agency.commissionRate || 10,
      }
    );
  };

  const filtered = agencies.filter((a) => {
    const str = search.toLowerCase();
    const name = (a.name || a.agency_name || '').toLowerCase();
    const code = (a.agent_code || a.code || '').toLowerCase();
    return name.includes(str) || code.includes(str);
  });

  const openDetail = (agency) => {
    setSelectedAgency(agency);
    setDetailOpen(true);
  };

  const openSettle = (agency) => {
    setSelectedAgency(agency);
    setSettleForm({
      period: `${MONTHS[new Date().getMonth()].value}/${currentYear}`,
      amount: getCommissionData(agency).remaining || 0,
      notes: '',
    });
    setSettleOpen(true);
  };

  const handleSettle = async () => {
    if (!settleForm.amount || settleForm.amount <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ.');
      return;
    }
    setSaving(true);
    try {
      await api.processPayment({
        agency_id: selectedAgency.id,
        amount: settleForm.amount,
        period: settleForm.period,
        notes: settleForm.notes,
        type: 'agency_commission',
      });
      toast.success('Đã quyết toán hoa hồng thành công.');
      setSettleOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi quyết toán hoa hồng.');
    } finally {
      setSaving(false);
    }
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
      <PageHeader title="Quản lý đại lý" subtitle="Quản lý đại lý và quyết toán hoa hồng" />

      {/* Search */}
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc mã đại lý..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Không tìm thấy đại lý nào" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agency) => {
            const comm = getCommissionData(agency);
            return (
              <div key={agency.id} className="card-hover">
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

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">{getStudentCount(agency)}</span>
                      <span className="text-xs text-gray-400">học viên</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="font-semibold text-green-600">{comm.commission_rate || 10}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hoa hồng:</span>
                      <span className="font-semibold text-gray-900">
                        {formatVND(comm.total_commission)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Đã trả:</span>
                      <span className="font-semibold text-green-600">
                        {formatVND(comm.total_paid)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Còn nợ:</span>
                      <span className="font-semibold text-red-500">
                        {formatVND(comm.remaining)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openDetail(agency)}
                    className="btn-ghost btn-sm flex-1 text-smc-600 hover:bg-smc-50"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Chi tiết
                  </button>
                  {comm.remaining > 0 && (
                    <button
                      onClick={() => openSettle(agency)}
                      className="btn-ghost btn-sm flex-1 text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Quyết toán
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết đại lý" size="lg">
        {selectedAgency && (() => {
          const comm = getCommissionData(selectedAgency);
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-600">
                  {getInitials(selectedAgency)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedAgency.name || selectedAgency.agency_name}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">
                    {selectedAgency.agent_code || selectedAgency.code}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Email:</span>{' '}
                  <span className="font-medium">{selectedAgency.email || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Số điện thoại:</span>{' '}
                  <span className="font-medium">{selectedAgency.phone || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Địa chỉ:</span>{' '}
                  <span className="font-medium">{selectedAgency.address || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Hoa hồng:</span>{' '}
                  <span className="font-medium text-green-600">{comm.commission_rate || 10}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Tổng hoa hồng:</span>{' '}
                  <span className="font-semibold">{formatVND(comm.total_commission)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Đã trả:</span>{' '}
                  <span className="font-semibold text-green-600">{formatVND(comm.total_paid)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Còn nợ:</span>{' '}
                  <span className="font-semibold text-red-500">{formatVND(comm.remaining)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Số học viên:</span>{' '}
                  <span className="font-medium">{getStudentCount(selectedAgency)}</span>
                </div>
              </div>

              {/* Student list */}
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

              {/* Commission payment history */}
              {comm.payment_history && comm.payment_history.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Lịch sử thanh toán hoa hồng</h4>
                  <div className="bg-gray-50 rounded-ios-lg p-3 max-h-60 overflow-y-auto">
                    <div className="space-y-2">
                      {comm.payment_history.map((payment, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded-ios-lg">
                          <div>
                            <span className="font-medium">{formatVND(payment.amount)}</span>
                            <span className="text-gray-400 ml-2">{payment.period || formatDate(payment.date)}</span>
                          </div>
                          <span className="text-xs text-gray-400">{payment.notes || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Settle Commission Modal */}
      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title="Quyết toán hoa hồng">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Đại lý: <strong>{selectedAgency?.name || selectedAgency?.agency_name}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Số dư còn nợ: <strong className="text-red-500">{formatVND(getCommissionData(selectedAgency || {}).remaining)}</strong>
            </p>
          </div>
          <div>
            <label className="input-label">Kỳ quyết toán (tháng/năm)</label>
            <input
              value={settleForm.period}
              onChange={(e) => setSettleForm((prev) => ({ ...prev, period: e.target.value }))}
              className="input-field"
              placeholder="VD: 8/2026"
            />
          </div>
          <div>
            <label className="input-label">Số tiền (VND)</label>
            <input
              type="number"
              value={settleForm.amount}
              onChange={(e) => setSettleForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={settleForm.notes}
              onChange={(e) => setSettleForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Nhập ghi chú quyết toán..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setSettleOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSettle} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Xác nhận quyết toán'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
