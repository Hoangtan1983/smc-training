import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, CreditCard, Plus, Eye, CheckCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const statusBadgeMap = {
  PAID: 'badge-success', paid: 'badge-success',
  PARTIAL: 'badge-warning', partial: 'badge-warning',
  UNPAID: 'badge-danger', unpaid: 'badge-danger',
  PENDING: 'badge-warning', pending: 'badge-warning',
};

const statusLabels = {
  PAID: 'Đã thanh toán', paid: 'Đã thanh toán',
  PARTIAL: 'Thanh toán một phần', partial: 'Thanh toán một phần',
  UNPAID: 'Chưa thanh toán', unpaid: 'Chưa thanh toán',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
};

export default function StaffTuition() {
  const [tuitionList, setTuitionList] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  // Add tuition modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    student_id: '', course_id: '', total_amount: 0, paid_amount: 0, notes: '',
  });

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTuition, setSelectedTuition] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tuitionRes, studentsRes] = await Promise.all([
        api.getTuitionList(),
        api.getUsers({ role: 'STUDENT' }),
      ]);

      setTuitionList(tuitionRes.data || tuitionRes.tuition || tuitionRes.students || []);
      setStudents((studentsRes.data || studentsRes.users || []).filter(u => u.role === 'STUDENT'));
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

  const totalRevenue = tuitionList.reduce((sum, t) => sum + (t.paid_amount || t.paidAmount || t.paid || 0), 0);
  const totalExpected = tuitionList.reduce((sum, t) => sum + (t.total_amount || t.totalAmount || t.total || 0), 0);
  const totalUnpaid = totalExpected - totalRevenue;

  const filtered = tuitionList.filter(t => {
    const s = search.toLowerCase();
    const name = (t.student_name || t.studentName || t.student?.fullName || t.student?.full_name || '').toLowerCase();
    const course = (t.course_name || t.courseName || t.course?.name || '').toLowerCase();
    return name.includes(s) || course.includes(s);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  const openDetail = (tuition) => {
    setSelectedTuition(tuition);
    setDetailOpen(true);
  };

  const handleAddTuition = async () => {
    if (!addForm.student_id || !addForm.total_amount) {
      toast.error('Vui lòng chọn học viên và nhập tổng học phí.');
      return;
    }
    setSaving(true);
    try {
      await api.addTuition(addForm);
      toast.success('Đã thêm khoản thu học phí.');
      setAddOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thêm khoản thu.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  const getRemaining = (t) => {
    const total = t.total_amount || t.totalAmount || t.total || 0;
    const paid = t.paid_amount || t.paidAmount || t.paid || 0;
    return total - paid;
  };

  const getStatus = (t) => {
    if (t.status) return t.status;
    const remaining = getRemaining(t);
    const total = t.total_amount || t.totalAmount || t.total || 0;
    if (remaining <= 0) return 'paid';
    if (total > 0 && remaining < total) return 'partial';
    return 'unpaid';
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
        title="Quản lý học phí"
        subtitle="Theo dõi và quản lý học phí học viên"
        action={
          <button
            onClick={() => {
              setAddForm({ student_id: '', course_id: '', total_amount: 0, paid_amount: 0, notes: '' });
              setAddOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm khoản thu
          </button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Tổng dự kiến thu" value={formatVND(totalExpected)} color="smc" />
        <StatCard icon={TrendingUp} label="Đã thanh toán" value={formatVND(totalRevenue)} color="green" />
        <StatCard icon={CreditCard} label="Chưa thanh toán" value={formatVND(totalUnpaid)} color="orange" />
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên học viên, khóa học..." />
      </div>

      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={DollarSign} title="Chưa có dữ liệu học phí" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã HĐ</th>
                  <th>Học viên</th>
                  <th>Khóa học</th>
                  <th>Tổng</th>
                  <th>Đã trả</th>
                  <th>Còn lại</th>
                  <th>Trạng thái</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => {
                  const status = getStatus(t);
                  const remaining = getRemaining(t);
                  const paid = t.paid_amount || t.paidAmount || t.paid || 0;
                  const total = t.total_amount || t.totalAmount || t.total || 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="font-mono text-xs text-smc-600">HD-{t.id}</span>
                      </td>
                      <td>
                        <span className="font-medium text-gray-900">
                          {t.student_name || t.studentName || t.student?.fullName || t.student?.full_name || t.student?.name || '-'}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {t.course_name || t.courseName || t.course?.name || '-'}
                      </td>
                      <td className="font-semibold text-smc-600">{formatVND(total)}</td>
                      <td className="text-sm text-green-600">{formatVND(paid)}</td>
                      <td className="text-sm text-red-500">{formatVND(remaining)}</td>
                      <td>
                        <span className={`badge ${statusBadgeMap[status] || 'badge-neutral'}`}>
                          {statusLabels[status] || status}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => openDetail(t)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50" title="Xem chi tiết">
                          <Eye className="w-4 h-4" />
                        </button>
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
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Thêm khoản thu học phí"
        size="lg"
      >
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
            <label className="input-label">Khóa học</label>
            <select
              value={addForm.course_id}
              onChange={e => setAddForm(prev => ({ ...prev, course_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn khóa học...</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Tổng học phí (VND)</label>
              <input
                type="number"
                value={addForm.total_amount}
                onChange={e => setAddForm(prev => ({ ...prev, total_amount: Number(e.target.value) }))}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="input-label">Đã thanh toán (VND)</label>
              <input
                type="number"
                value={addForm.paid_amount}
                onChange={e => setAddForm(prev => ({ ...prev, paid_amount: Number(e.target.value) }))}
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={addForm.notes}
              onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Ghi chú..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleAddTuition} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Thêm khoản thu'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết học phí"
        size="lg"
      >
        {selectedTuition && (
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-smc-100 flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-smc-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Học viên:</span> <span className="font-medium">{selectedTuition.student_name || selectedTuition.studentName || selectedTuition.student?.fullName || '-'}</span></div>
              <div><span className="text-gray-400">Khóa học:</span> <span className="font-medium">{selectedTuition.course_name || selectedTuition.courseName || '-'}</span></div>
              <div><span className="text-gray-400">Tổng học phí:</span> <span className="font-semibold text-smc-600">{formatVND(selectedTuition.total_amount || selectedTuition.totalAmount || selectedTuition.total)}</span></div>
              <div><span className="text-gray-400">Đã thanh toán:</span> <span className="font-semibold text-green-600">{formatVND(selectedTuition.paid_amount || selectedTuition.paidAmount || selectedTuition.paid)}</span></div>
              <div><span className="text-gray-400">Còn lại:</span> <span className="font-semibold text-red-500">{formatVND(getRemaining(selectedTuition))}</span></div>
              <div><span className="text-gray-400">Trạng thái:</span> <span className={`badge ${statusBadgeMap[getStatus(selectedTuition)] || 'badge-neutral'}`}>{statusLabels[getStatus(selectedTuition)] || getStatus(selectedTuition)}</span></div>
            </div>
            {(selectedTuition.notes || selectedTuition.payments) && (
              <>
                <h4 className="font-semibold text-sm text-gray-700 mt-2">Lịch sử thanh toán</h4>
                <div className="bg-gray-50 rounded-ios-lg p-3">
                  {selectedTuition.payments ? (
                    <div className="space-y-2">
                      {(selectedTuition.payments || []).map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span>{formatDate(p.date || p.created_at)} - {p.method || p.payment_method}</span>
                          <span className="font-medium text-smc-600">{formatVND(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">{selectedTuition.notes || 'Chưa có lịch sử thanh toán'}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
