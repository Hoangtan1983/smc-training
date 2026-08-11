import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Edit2, Lock, Unlock } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const ROLE_OPTIONS = ['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'AGENCY', 'ACCOUNTANT'];
const STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'FROZEN', 'INACTIVE'];

const roleBadgeColors = {
  ADMIN: 'bg-purple-100 text-purple-700',
  STAFF: 'bg-blue-100 text-blue-700',
  TEACHER: 'bg-teal-100 text-teal-700',
  STUDENT: 'bg-green-100 text-green-700',
  AGENCY: 'bg-orange-100 text-orange-700',
  ACCOUNTANT: 'bg-pink-100 text-pink-700',
};

const roleLabels = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học viên',
  AGENCY: 'Đại lý',
  ACCOUNTANT: 'Kế toán',
};

const statusBadgeMap = {
  ACTIVE: 'badge-success',
  PENDING: 'badge-warning',
  FROZEN: 'badge-neutral',
  INACTIVE: 'badge-danger',
};

const statusLabels = {
  ACTIVE: 'Hoạt động', PENDING: 'Chờ duyệt',
  FROZEN: 'Đóng băng', INACTIVE: 'Không hoạt động',
};

export default function StaffUserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '', role: 'STUDENT', status: 'ACTIVE',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.getUsers(params);
      const data = res.data || res.users || [];
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
      toast.error('Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter(u => {
    const s = search.toLowerCase();
    const name = (u.fullName || u.full_name || u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    return name.includes(s) || email.includes(s) || phone.includes(s);
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  const openCreateModal = () => {
    setSelectedUser(null);
    setForm({ fullName: '', email: '', phone: '', password: '', role: 'STUDENT', status: 'ACTIVE' });
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setForm({
      fullName: user.fullName || user.full_name || user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role || 'STUDENT',
      status: user.status || 'ACTIVE',
    });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.fullName || !form.email) {
      toast.error('Vui lòng nhập họ tên và email.');
      return;
    }
    if (!selectedUser && !form.password) {
      toast.error('Vui lòng nhập mật khẩu cho người dùng mới.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (selectedUser && !payload.password) delete payload.password;
      if (selectedUser) {
        await api.updateUser(selectedUser.id, payload);
        toast.success('Cập nhật người dùng thành công.');
      } else {
        await api.createUser(payload);
        toast.success('Tạo người dùng thành công.');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu người dùng.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const newStatus = selectedUser.status === 'FROZEN' || selectedUser.status === 'frozen' ? 'ACTIVE' : 'FROZEN';
      await api.updateUser(selectedUser.id, { status: newStatus });
      toast.success(newStatus === 'ACTIVE' ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.');
      setConfirmOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thay đổi trạng thái.');
    } finally {
      setSaving(false);
    }
  };

  const promptToggleStatus = (user) => {
    setSelectedUser(user);
    const isLocked = user.status === 'FROZEN' || user.status === 'frozen';
    setConfirmAction(isLocked ? 'unlock' : 'lock');
    setConfirmOpen(true);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  if (loading && users.length === 0) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchUsers} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Quản lý người dùng"
        subtitle="Quản lý tài khoản người dùng trong hệ thống"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <UserPlus className="w-4 h-4 mr-2" />
            Thêm người dùng
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm theo tên, email, số điện thoại..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả vai trò</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>{roleLabels[r]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState title="Không tìm thấy người dùng nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(user => {
                  const isLocked = user.status === 'FROZEN' || user.status === 'frozen';
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-smc-100 flex items-center justify-center text-xs font-bold text-smc-600">
                            {(user.fullName || user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">
                            {user.fullName || user.full_name || user.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-gray-500">{user.email}</td>
                      <td className="text-gray-500">{user.phone || '-'}</td>
                      <td>
                        <span className={`badge ${roleBadgeColors[user.role] || 'badge-neutral'}`}>
                          {roleLabels[user.role] || user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeMap[user.status] || 'badge-neutral'}`}>
                          {statusLabels[user.status] || user.status}
                        </span>
                      </td>
                      <td className="text-gray-500 text-sm">{formatDate(user.created_at || user.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50"
                            title="Sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptToggleStatus(user)}
                            className={`btn-ghost btn-sm p-1.5 ${isLocked ? 'text-green-600 hover:bg-green-50' : 'text-orange-600 hover:bg-orange-50'}`}
                            title={isLocked ? 'Mở khóa' : 'Khóa'}
                          >
                            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedUser ? 'Sửa người dùng' : 'Thêm người dùng'}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Họ tên</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nguyễn Văn A"
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
            <label className="input-label">
              Mật khẩu {selectedUser && <span className="text-gray-400 text-xs">(để trống nếu không đổi)</span>}
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleFormChange}
              className="input-field"
              placeholder={selectedUser ? '...' : 'Nhập mật khẩu'}
            />
          </div>
          <div>
            <label className="input-label">Vai trò</label>
            <select name="role" value={form.role} onChange={handleFormChange} className="input-field">
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Trạng thái</label>
            <select name="status" value={form.status} onChange={handleFormChange} className="input-field">
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedUser ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lock/Unlock Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggleStatus}
        title={confirmAction === 'lock' ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
        message={
          confirmAction === 'lock'
            ? `Bạn có chắc chắn muốn khóa tài khoản của "${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}" không? Người dùng sẽ không thể đăng nhập.`
            : `Bạn có chắc chắn muốn mở khóa tài khoản của "${selectedUser?.fullName || selectedUser?.full_name || selectedUser?.name}" không?`
        }
        confirmText={confirmAction === 'lock' ? 'Khóa' : 'Mở khóa'}
        variant={confirmAction === 'lock' ? 'warning' : 'success'}
      />
    </div>
  );
}
