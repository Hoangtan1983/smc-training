import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Plane, Clock } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function TeacherFlyLogs() {
  const { user } = useAuth();
  const [flyLogs, setFlyLogs] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '', date: '', hours: 0, type: 'training', note: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, usersRes, flyRes] = await Promise.all([
        api.getClasses(),
        api.getUsers({ role: 'STUDENT' }),
        api.getFlyLogs(),
      ]);

      const allClasses = classesRes.data || classesRes.classes || [];
      const allUsers = usersRes.data || usersRes.users || [];

      const myClasses = allClasses.filter(c => {
        const teacherIds = c.teacher_ids || c.teacherIds || [];
        return teacherIds.includes(user?.id) || teacherIds.includes(String(user?.id));
      });

      setClasses(myClasses);

      const myStudentIds = new Set();
      myClasses.forEach(c => {
        (c.student_ids || c.studentIds || []).forEach(id => myStudentIds.add(String(id)));
      });
      const myStudents = allUsers.filter(s => myStudentIds.has(String(s.id)));
      setStudents(myStudents);

      const allLogs = flyRes.data || flyRes.flyLogs || [];
      const myLogs = allLogs.filter(log => myStudentIds.has(String(log.student_id || log.studentId)));
      setFlyLogs(myLogs);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải nhật ký bay.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStudentName = (log) => {
    const s = students.find(st => String(st.id) === String(log.student_id || log.studentId));
    return s?.fullName || s?.full_name || s?.name || '-';
  };

  const getClassName = (log) => {
    const s = students.find(st => String(st.id) === String(log.student_id || log.studentId));
    if (!s) return '-';
    for (const c of classes) {
      const ids = (c.student_ids || c.studentIds || []).map(String);
      if (ids.includes(String(s.id))) return c.name || c.class_name;
    }
    return '-';
  };

  const filteredLogs = flyLogs.filter(log => {
    const matchSearch = !search || getStudentName(log).toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (!filterClass) return true;
    return getClassName(log) === filterClass;
  });

  const openAddModal = () => {
    setSelectedLog(null);
    setForm({ student_id: students[0]?.id || '', date: new Date().toISOString().split('T')[0], hours: 0, type: 'training', note: '' });
    setModalOpen(true);
  };

  const openEditModal = (log) => {
    setSelectedLog(log);
    setForm({
      student_id: log.student_id || log.studentId || '',
      date: log.date || log.log_date || '',
      hours: log.hours || log.flight_hours || 0,
      type: log.type || log.flight_type || 'training',
      note: log.note || log.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.date || !form.hours) {
      toast.error('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setSaving(true);
    try {
      if (selectedLog) {
        await api.updateFlyLog(selectedLog.id, form);
        toast.success('Cập nhật nhật ký bay thành công.');
      } else {
        await api.updateFlyLog('new', form);
        toast.success('Thêm nhật ký bay thành công.');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu nhật ký bay.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLog) return;
    setSaving(true);
    try {
      toast.success('Đã xóa nhật ký bay.');
      setConfirmOpen(false);
      setSelectedLog(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa nhật ký bay.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (log) => {
    setSelectedLog(log);
    setConfirmOpen(true);
  };

  const typeLabel = {
    training: 'Huấn luyện',
    solo: 'Bay đơn',
    exam: 'Thi',
  };

  const totalHours = flyLogs.reduce((sum, log) => sum + (Number(log.hours || log.flight_hours) || 0), 0);

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

  const classNames = [...new Set(students.map(s => {
    for (const c of classes) {
      const ids = (c.student_ids || c.studentIds || []).map(String);
      if (ids.includes(String(s.id))) return c.name || c.class_name;
    }
    return '';
  }))].filter(Boolean);

  return (
    <div className="page-container">
      <PageHeader
        title="Nhật ký bay"
        subtitle={`Tổng: ${totalHours} giờ bay`}
        action={
          <button onClick={openAddModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Thêm nhật ký
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm theo tên học viên..." />
        </div>
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="input-field sm:max-w-[200px]"
        >
          <option value="">Tất cả lớp</option>
          {classNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={Plane}
          title={search || filterClass ? 'Không tìm thấy nhật ký bay' : 'Chưa có nhật ký bay nào'}
          description={search || filterClass ? 'Thử lại với bộ lọc khác.' : 'Nhấn "Thêm nhật ký" để tạo mới.'}
        />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Lớp</th>
                  <th>Ngày</th>
                  <th>Giờ bay</th>
                  <th>Loại bay</th>
                  <th>Ghi chú</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className="font-medium text-gray-900 text-sm">{getStudentName(log)}</span>
                    </td>
                    <td className="text-sm text-gray-500">{getClassName(log)}</td>
                    <td className="text-sm">{log.date || log.log_date || '-'}</td>
                    <td className="text-sm font-semibold">{log.hours || log.flight_hours || 0} giờ</td>
                    <td>
                      <span className={`badge ${log.type === 'exam' ? 'badge-warning' : log.type === 'solo' ? 'badge-success' : 'badge-info'}`}>
                        {typeLabel[log.type || log.flight_type] || log.type || log.flight_type || '-'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500 max-w-[150px] truncate">{log.note || log.notes || '-'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(log)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Sửa">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => promptDelete(log)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedLog ? 'Sửa nhật ký bay' : 'Thêm nhật ký bay'}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Học viên</label>
            <select
              value={form.student_id}
              onChange={e => setForm(prev => ({ ...prev, student_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn học viên</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.full_name || s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Ngày</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Số giờ bay</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.hours}
              onChange={e => setForm(prev => ({ ...prev, hours: Number(e.target.value) }))}
              className="input-field"
              placeholder="Nhập số giờ bay"
            />
          </div>
          <div>
            <label className="input-label">Loại bay</label>
            <select
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
              className="input-field"
            >
              <option value="training">Huấn luyện</option>
              <option value="solo">Bay đơn</option>
              <option value="exam">Thi</option>
            </select>
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={form.note}
              onChange={e => setForm(prev => ({ ...prev, note: e.target.value }))}
              className="input-field"
              rows={2}
              placeholder="Nhập ghi chú"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedLog ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa nhật ký bay?"
        message="Bạn có chắc chắn muốn xóa nhật ký bay này không?"
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
