import { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const statusBadgeMap = {
  STUDYING: 'badge-info', studying: 'badge-info',
  COMPLETED: 'badge-success', completed: 'badge-success',
  DROPPED: 'badge-danger', dropped: 'badge-danger',
  ACTIVE: 'badge-success', active: 'badge-success',
  PENDING: 'badge-warning', pending: 'badge-warning',
  INACTIVE: 'badge-danger', inactive: 'badge-danger',
  FROZEN: 'badge-neutral', frozen: 'badge-neutral',
};

const statusLabels = {
  STUDYING: 'Đang học', studying: 'Đang học',
  COMPLETED: 'Hoàn thành', completed: 'Hoàn thành',
  DROPPED: 'Bỏ học', dropped: 'Bỏ học',
  ACTIVE: 'Hoạt động', active: 'Hoạt động',
  PENDING: 'Chờ duyệt', pending: 'Chờ duyệt',
  INACTIVE: 'Không hoạt động', inactive: 'Không hoạt động',
  FROZEN: 'Đóng băng', frozen: 'Đóng băng',
};

export default function AgencyStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [enrollmentsRes, usersRes] = await Promise.all([
        api.getEnrollments(),
        api.getUsers({ role: 'STUDENT' }),
      ]);

      const enrollments = enrollmentsRes.data || enrollmentsRes.enrollments || [];
      const users = (usersRes.data || usersRes.users || []).filter(
        (u) => u.role === 'STUDENT' || u.role === 'student'
      );

      const enriched = users.map((u) => {
        const enrollment = enrollments.find(
          (e) => e.student_id === u.id || e.user_id === u.id
        );
        return {
          ...u,
          course_name: enrollment?.course_name || enrollment?.courseName || u.course_name || '-',
          enrollment_date: enrollment?.created_at || enrollment?.createdAt || u.created_at || u.createdAt,
          commission: enrollment?.commission || enrollment?.agency_commission || u.commission || 0,
          status: u.status || 'PENDING',
        };
      });

      setStudents(enriched);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu học viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = students.filter((s) => {
    const matchSearch = () => {
      const str = search.toLowerCase();
      const name = (s.fullName || s.full_name || s.name || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return name.includes(str) || email.includes(str) || phone.includes(str);
    };
    const matchStatus = () => !statusFilter || s.status === statusFilter;
    return matchSearch() && matchStatus();
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const openDetail = (student) => {
    setSelectedStudent(student);
    setDetailOpen(true);
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
      <PageHeader title="Học viên của tôi" subtitle="Danh sách học viên do đại lý giới thiệu" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên, email, số điện thoại..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="STUDYING">Đang học</option>
          <option value="COMPLETED">Hoàn thành</option>
          <option value="DROPPED">Bỏ học</option>
          <option value="PENDING">Chờ duyệt</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState title="Không tìm thấy học viên nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Khóa học</th>
                  <th>Ngày đăng ký</th>
                  <th>Trạng thái học</th>
                  <th>Hoa hồng</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                          {(student.fullName || student.full_name || student.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">
                          {student.fullName || student.full_name || student.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-gray-500">{student.email || '-'}</td>
                    <td className="text-gray-500">{student.phone || '-'}</td>
                    <td className="text-sm text-gray-500">{student.course_name}</td>
                    <td className="text-sm text-gray-500">{formatDate(student.enrollment_date)}</td>
                    <td>
                      <span className={`badge ${statusBadgeMap[student.status] || 'badge-neutral'}`}>
                        {statusLabels[student.status] || student.status}
                      </span>
                    </td>
                    <td className="font-semibold text-green-600">{formatVND(student.commission)}</td>
                    <td>
                      <button
                        onClick={() => openDetail(student)}
                        className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết học viên"
        size="lg"
      >
        {selectedStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-600">
                {(selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name}
                </h3>
                <p className="text-sm text-gray-500">{selectedStudent.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Số điện thoại:</span>{' '}
                <span className="font-medium">{selectedStudent.phone || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400">Trạng thái:</span>{' '}
                <span className="font-medium">{statusLabels[selectedStudent.status] || selectedStudent.status}</span>
              </div>
              <div>
                <span className="text-gray-400">Khóa học:</span>{' '}
                <span className="font-medium">{selectedStudent.course_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400">Ngày đăng ký:</span>{' '}
                <span className="font-medium">{formatDate(selectedStudent.enrollment_date)}</span>
              </div>
              <div>
                <span className="text-gray-400">Hoa hồng:</span>{' '}
                <span className="font-medium text-green-600">{formatVND(selectedStudent.commission)}</span>
              </div>
              <div>
                <span className="text-gray-400">Giai đoạn:</span>{' '}
                <span className="font-medium">{selectedStudent.stage || selectedStudent.training_stage || 'Đăng ký'}</span>
              </div>
            </div>
            {selectedStudent.address && (
              <div className="text-sm">
                <span className="text-gray-400">Địa chỉ:</span>{' '}
                <span className="font-medium">{selectedStudent.address}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
