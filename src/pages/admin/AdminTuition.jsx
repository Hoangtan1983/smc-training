import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unpaid', label: 'Chưa thanh toán' },
  { key: 'paid', label: 'Đã thanh toán' },
];

const statusLabels = {
  PAID: 'Đã thanh toán', paid: 'Đã thanh toán',
  UNPAID: 'Chưa thanh toán', unpaid: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần', partial: 'Thanh toán một phần',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
};

const statusBadgeMap = {
  PAID: 'badge-success', paid: 'badge-success',
  UNPAID: 'badge-danger', unpaid: 'badge-danger',
  PARTIAL: 'badge-warning', partial: 'badge-warning',
  PENDING: 'badge-info', pending: 'badge-info',
};

export default function AdminTuition() {
  const [tuitionList, setTuitionList] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ student_id: '', amount: 0, type: 'tuition', notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tuitionRes, studentsRes] = await Promise.all([
        api.getTuitionList(),
        api.getTuitionStudents().catch(() => api.getUsers({ role: 'STUDENT' })),
      ]);

      setTuitionList(tuitionRes.data || tuitionRes.tuitions || tuitionRes.list || []);

      let studentList = [];
      try {
        const sRes = studentsRes.data || studentsRes.students || studentsRes.users || [];
        studentList = sRes.filter(u => u.role === 'STUDENT' || u.role === 'student');
      } catch {
        studentList = [];
      }
      setStudents(studentList);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu học phí.');
      toast.error('Không thể tải dữ liệu học phí.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRevenue = tuitionList
    .filter(t => t.status === 'PAID' || t.status === 'paid')
    .reduce((sum, t) => sum + (t.amount || t.total || 0), 0);

  const totalUnpaid = tuitionList
    .filter(t => t.status === 'UNPAID' || t.status === 'unpaid')
    .reduce((sum, t) => sum + (t.amount || t.total || 0), 0);

  const totalPaid = tuitionList
    .filter(t => t.status === 'PAID' || t.status === 'paid')
    .reduce((sum, t) => sum + (t.paid_amount || t.paidAmount || 0), 0);

  const totalPending = tuitionList
    .filter(t => t.status === 'PENDING' || t.status === 'pending')
    .reduce((sum, t) => sum + (t.amount || t.total || 0), 0);

  const filtered = tuitionList.filter(item => {
    const status = (item.status || '').toLowerCase();
    if (activeTab === 'unpaid') return status === 'unpaid' || status === 'pending';
    if (activeTab === 'paid') return status === 'paid' || status === 'partial';
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [activeTab]);

  const openAddModal = () => {
    setAddForm({ student_id: students[0]?.id || '', amount: 0, type: 'tuition', notes: '' });
    setAddModalOpen(true);
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleAddTuition = async () => {
    if (!addForm.student_id || !addForm.amount) {
      toast.error('Vui lòng chọn học viên và nhập số tiền.');
      return;
    }
    setSaving(true);
    try {
      await api.addTuition(addForm);
      toast.success('Đã thêm khoản thu thành công.');
      setAddModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thêm khoản thu.');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessPayment = async (item) => {
    setSaving(true);
    try {
      await api.processPayment({ tuition_id: item.id, amount: item.amount || item.remaining || item.total });
      toast.success('Đã xử lý thanh toán.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xử lý thanh toán.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveTransaction = async (item) => {
    setSaving(true);
    try {
      await api.approveTransaction({ tuition_id: item.id });
      toast.success('Đã duyệt giao dịch.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt giao dịch.');
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (item) => {
    return item.student_name || item.studentName || item.student?.fullName || item.student?.full_name || item.student?.name ||
      students.find(s => s.id === item.student_id || s.id === item.studentId)?.fullName || '-';
  };

  const getRemaining = (item) => (item.amount || item.total || 0) - (item.paid_amount || item.paidAmount || 0);

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
        title="Quản lý học phí"
        subtitle="Theo dõi và quản lý thu chi"
        action={
          <button onClick={openAddModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Thêm khoản thu
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Tổng thu" value={formatVND(totalRevenue)} color="green" />
        <StatCard icon={AlertCircle} label="Chưa thanh toán" value={formatVND(totalUnpaid)} color="red" />
        <StatCard icon={CheckCircle} label="Đã thanh toán" value={formatVND(totalPaid)} color="smc" />
        <StatCard icon={Clock} label="Đang chờ duyệt" value={formatVND(totalPending)} color="orange" />
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={DollarSign} title="Không có khoản thu nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Học viên</th>
                  <th>Khóa học</th>
                  <th>Tổng tiền</th>
                  <th>Đã trả</th>
                  <th>Còn lại</th>
                  <th>Trạng thái</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(item => {
                  const remaining = getRemaining(item);
                  const status = (item.status || '').toLowerCase();
                  return (
                    <tr key={item.id}>
                      <td className="font-mono text-xs text-smc-600">#{item.id || item.code || item.invoice_code}</td>
                      <td>
                        <span className="font-medium text-gray-900">{getStudentName(item)}</span>
                      </td>
                      <td className="text-sm text-gray-500">{item.course_name || item.courseName || '-'}</td>
                      <td className="font-semibold text-sm">{formatVND(item.amount || item.total)}</td>
                      <td className="text-sm text-green-600">{formatVND(item.paid_amount || item.paidAmount || 0)}</td>
                      <td className="text-sm text-red-500">{remaining > 0 ? formatVND(remaining) : '-'}</td>
                      <td>
                        <span className={`badge ${statusBadgeMap[item.status] || 'badge-neutral'}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetail(item)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem">
                            <Eye className="w-4 h-4" />
                          </button>
                          {(status === 'unpaid' || status === 'pending') && (
                            <>
                              <button onClick={() => handleProcessPayment(item)} className="btn-ghost btn-sm px-2 text-xs text-green-600 hover:bg-green-50">
                                Thanh toán
                              </button>
                              <button onClick={() => handleApproveTransaction(item)} className="btn-ghost btn-sm px-2 text-xs text-blue-600 hover:bg-blue-50">
                                Duyệt
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Add Tuition Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Thêm khoản thu">
        <div className="space-y-4">
          <div>
            <label className="input-label">Học viên</label>
            <select
              value={addForm.student_id}
              onChange={e => setAddForm(prev => ({ ...prev, student_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn học viên...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.full_name || s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Số tiền (VND)</label>
            <input
              type="number"
              value={addForm.amount}
              onChange={e => setAddForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="input-label">Loại</label>
            <select
              value={addForm.type}
              onChange={e => setAddForm(prev => ({ ...prev, type: e.target.value }))}
              className="input-field"
            >
              <option value="tuition">Học phí</option>
              <option value="exam_fee">Lệ phí thi</option>
              <option value="certificate_fee">Lệ phí chứng chỉ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={addForm.notes}
              onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Ghi chú khoản thu..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleAddTuition} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Thêm'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết khoản thu">
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Mã hóa đơn:</span> <span className="font-medium font-mono">#{selectedItem.id || selectedItem.code}</span></div>
              <div><span className="text-gray-400">Trạng thái:</span> <span className={`badge ${statusBadgeMap[selectedItem.status] || 'badge-neutral'}`}>{statusLabels[selectedItem.status] || selectedItem.status}</span></div>
              <div><span className="text-gray-400">Tổng tiền:</span> <span className="font-semibold">{formatVND(selectedItem.amount || selectedItem.total)}</span></div>
              <div><span className="text-gray-400">Đã trả:</span> <span className="font-semibold text-green-600">{formatVND(selectedItem.paid_amount || selectedItem.paidAmount || 0)}</span></div>
              <div><span className="text-gray-400">Còn lại:</span> <span className="font-semibold text-red-500">{formatVND(getRemaining(selectedItem))}</span></div>
              <div><span className="text-gray-400">Loại:</span> <span className="font-medium">{selectedItem.type || 'Học phí'}</span></div>
              <div className="col-span-2"><span className="text-gray-400">Học viên:</span> <span className="font-medium">{getStudentName(selectedItem)}</span></div>
              {selectedItem.notes && (
                <div className="col-span-2"><span className="text-gray-400">Ghi chú:</span> <span>{selectedItem.notes}</span></div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
