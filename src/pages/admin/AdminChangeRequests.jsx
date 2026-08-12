import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  apiGetChangeRequests, apiUpdateChangeRequest, apiGetUsers, apiGetClasses,
  apiUpdateClass, apiUpdateTuitionStep, apiAssignClass, emitDataChange, onDataChange,
} from '../../data/api';
import {
  ArrowLeftRight, Ban, Wallet, Search, Shield, CheckCircle, XCircle,
  Clock, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Admin duyệt/từ chối yêu cầu Đổi lớp / Bảo lưu / Hoàn phí
 * Chỉ Admin mới có quyền truy cập trang này
 */
export default function AdminChangeRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [expandedId, setExpandedId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);

  useEffect(() => { loadData_(); }, []);

  // Subscribe to real-time changes
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'change_requests' || detail?.changed === 'classes' || detail?.changed === 'users') {
        loadData_();
      }
    });
  }, []);

  const loadData_ = async () => {
    try {
      const [reqData, userData, classData] = await Promise.all([
        apiGetChangeRequests().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetClasses().catch(() => []),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      setAllStudents(users.filter(u => u.role === 'STUDENT'));
      setAllClasses(Array.isArray(classData) ? classData : []);
    } catch {}
    setLoading(false);
  };

  const getStudent = (id) => allStudents.find(s => s.id === id);
  const getClass = (id) => allClasses.find(c => c.id === id);

  // ─── DUYỆT YÊU CẦU ───
  const handleApprove = async (req) => {
    const actionLabel = req.type === 'change_class' ? 'đổi lớp' : req.type === 'reserve' ? 'bảo lưu' : 'hoàn phí';
    if (!window.confirm(`🔓 Duyệt yêu cầu ${actionLabel} cho "${req.studentName}"?\n\nHành động này sẽ cập nhật dữ liệu học viên.`)) return;

    const loadingToast = toast.loading('Đang xử lý...');
    try {
      // Thực hiện hành động tương ứng
      if (req.type === 'change_class') {
        // Dùng apiAssignClass để server tự động: gỡ khỏi lớp cũ, thêm vào lớp mới, cập nhật enrollment
        // apiAssignClass quét TẤT CẢ các lớp để gỡ học viên → đảm bảo mỗi HV chỉ thuộc 1 lớp
        await apiAssignClass(req.studentId, req.toClassId, req.fromClassId || '');

        // Cập nhật tuition step
        await apiUpdateTuitionStep({
          studentId: req.studentId, step: 'assigned', status: 'paid',
          extra: { classId: req.toClassId, className: req.toClassName },
        });
        toast.dismiss(loadingToast);
        toast.success(`✅ Đã chuyển "${req.studentName}" sang lớp ${req.toClassName}`);
      } else if (req.type === 'reserve') {
        await apiUpdateTuitionStep({
          studentId: req.studentId, step: 'reserved', status: 'reserved',
          extra: { reserveReason: req.reason },
        });
        toast.dismiss(loadingToast);
        toast.success(`✅ Đã bảo lưu cho "${req.studentName}"`);
      } else if (req.type === 'refund') {
        await apiUpdateTuitionStep({
          studentId: req.studentId, step: 'refunded', status: 'refunded',
          extra: { refundAmount: req.amount, refundReason: req.reason },
        });
        toast.dismiss(loadingToast);
        toast.success(`✅ Đã ghi nhận hoàn phí ${req.amount?.toLocaleString('vi-VN')}đ cho "${req.studentName}"`);
      }

      // Cập nhật trạng thái request → approved
      await apiUpdateChangeRequest(req.id, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: user?.fullName || 'ADMIN',
      });

      // Emit data change events — CHỈ KHI TẤT CẢ API THÀNH CÔNG
      emitDataChange('classes', { action: 'updated' });
      emitDataChange('enrollments', { action: 'updated', studentId: req.studentId });
      emitDataChange('users', { action: 'updated', studentId: req.studentId });
      emitDataChange('tuitions', { action: 'updated', studentId: req.studentId });
      emitDataChange('change_requests', { action: 'approved', id: req.id });
      emitDataChange('all', { changed: 'change_requests' });

      loadData_();
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
      // KHÔNG emit data change — request vẫn ở trạng thái cũ
    }
  };

  // ─── TỪ CHỐI YÊU CẦU ───
  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectModal.note.trim()) return toast.error('Vui lòng nhập lý do từ chối');

    try {
      const req = rejectModal.request;
      const updatedHistory = [...(req.history || []), {
        action: 'rejected',
        date: new Date().toISOString(),
        by: user?.fullName || 'ADMIN',
        note: rejectModal.note,
      }];

      await apiUpdateChangeRequest(req.id, {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: user?.fullName || 'ADMIN',
        rejectReason: rejectModal.note,
        history: updatedHistory,
      });

      toast.success(`Đã từ chối yêu cầu của "${req.studentName}"`);
      emitDataChange('change_requests', { action: 'rejected', id: req.id });
      emitDataChange('all', { changed: 'change_requests' });
      setRejectModal(null);
      loadData_();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const filtered = requests.filter(r => {
    const matchSearch = (r.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reason || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.type === filterType;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // Stats
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  const typeLabel = (t) => ({ change_class: 'Đổi lớp', reserve: 'Bảo lưu', refund: 'Hoàn phí' })[t] || t;
  const statusBadge = (s) => ({
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  })[s] || 'bg-gray-100';

  if (loading) return (
    <div className="text-center py-12">
      <div className="spinner mx-auto mb-4" />
      <p className="text-gray-500">Đang tải danh sách yêu cầu...</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-500" /> Duyệt yêu cầu Đổi lớp & Bảo lưu
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pendingCount} yêu cầu đang chờ — Quyền Admin: Duyệt hoặc Từ chối
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-gray-700">{requests.length}</div>
          <div className="text-xs text-gray-500 mt-1">Tổng yêu cầu</div>
        </div>
        <div className="card p-4 text-center bg-amber-50">
          <div className="text-2xl font-extrabold text-amber-600">{pendingCount}</div>
          <div className="text-xs text-gray-500 mt-1">⏳ Chờ duyệt</div>
        </div>
        <div className="card p-4 text-center bg-green-50">
          <div className="text-2xl font-extrabold text-green-600">{approvedCount}</div>
          <div className="text-xs text-gray-500 mt-1">✅ Đã duyệt</div>
        </div>
        <div className="card p-4 text-center bg-red-50">
          <div className="text-2xl font-extrabold text-red-600">{rejectedCount}</div>
          <div className="text-xs text-gray-500 mt-1">❌ Đã từ chối</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm theo tên học viên, lý do..." />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả loại</option>
          <option value="change_class">Đổi lớp</option>
          <option value="reserve">Bảo lưu</option>
          <option value="refund">Hoàn phí</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field w-auto">
          <option value="pending">⏳ Chờ duyệt</option>
          <option value="all">Tất cả trạng thái</option>
          <option value="approved">✅ Đã duyệt</option>
          <option value="rejected">❌ Đã từ chối</option>
        </select>
      </div>

      {/* Request List */}
      <div className="space-y-4">
        {filtered.map(req => {
          const isExpanded = expandedId === req.id;
          const student = getStudent(req.studentId);

          return (
            <div key={req.id} className={`card overflow-hidden border-l-4 transition-all ${
              req.status === 'approved' ? 'border-l-green-500' :
              req.status === 'rejected' ? 'border-l-red-500' :
              'border-l-amber-500 shadow-md'
            }`}>
              {/* Main row */}
              <div className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge text-xs font-semibold ${statusBadge(req.status)}`}>
                        {req.status === 'pending' && '⏳ Chờ duyệt'}
                        {req.status === 'approved' && '✅ Đã duyệt'}
                        {req.status === 'rejected' && '❌ Đã từ chối'}
                      </span>
                      <span className="badge bg-blue-100 text-blue-700 text-xs font-semibold">
                        {typeLabel(req.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-gray-900 text-lg">{req.studentName}</span>
                      {student && (
                        <span className="text-xs text-gray-400">{student.email}</span>
                      )}
                    </div>

                    {/* Detail theo loại */}
                    <div className="text-sm text-gray-600 mt-1">
                      {req.type === 'change_class' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-medium">
                            {req.fromClassName || 'Chưa có lớp'}
                          </span>
                          <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                            {req.toClassName}
                          </span>
                        </div>
                      )}
                      {req.type === 'reserve' && (
                        <p className="flex items-center gap-2">
                          <Ban className="w-4 h-4 text-amber-500" />
                          <span>Tạm dừng học tập: <strong>{req.reason}</strong></span>
                        </p>
                      )}
                      {req.type === 'refund' && (
                        <p className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-red-500" />
                          <span>Hoàn: <strong>{req.amount?.toLocaleString('vi-VN')} VNĐ</strong> — {req.reason}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {req.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          className="btn-primary flex items-center gap-2 px-5 py-2.5"
                        >
                          <CheckCircle className="w-4 h-4" /> Duyệt
                        </button>
                        <button
                          onClick={() => setRejectModal({ request: req, note: '' })}
                          className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" /> Từ chối
                        </button>
                      </>
                    ) : (
                      <span className={`text-sm font-medium ${
                        req.status === 'approved' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {req.status === 'approved' ? `✅ ${req.approvedBy || 'Admin'} đã duyệt` : `❌ ${req.rejectedBy || 'Admin'} đã từ chối`}
                      </span>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="bg-gray-50 border-t px-5 py-4 animate-slide-up">
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Thông tin học viên */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Học viên</h4>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium text-gray-900">{req.studentName}</p>
                        {student && (
                          <>
                            <p className="text-gray-500">{student.email}</p>
                            <p className="text-gray-500">{student.phone || '—'}</p>
                            <p className="text-xs text-gray-400">Trạng thái: <span className={student.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}>{student.status}</span></p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Chi tiết yêu cầu */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Chi tiết yêu cầu</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-500">Loại:</span> <span className="font-medium">{typeLabel(req.type)}</span></p>
                        {req.type === 'change_class' && (
                          <>
                            <p><span className="text-gray-500">Lớp cũ:</span> {req.fromClassName || '—'}</p>
                            <p><span className="text-gray-500">Lớp mới:</span> <span className="text-blue-700 font-medium">{req.toClassName}</span></p>
                          </>
                        )}
                        <p><span className="text-gray-500">Lý do:</span> {req.reason}</p>
                        {req.amount > 0 && <p><span className="text-gray-500">Số tiền:</span> {req.amount.toLocaleString('vi-VN')} VNĐ</p>}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Lịch sử</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">Tạo: {new Date(req.createdAt).toLocaleString('vi-VN')} bởi {req.createdBy || 'STAFF'}</span>
                        </div>
                        {req.status === 'approved' && (
                          <div className="flex items-center gap-2 text-xs">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-green-600">Duyệt: {req.approvedAt ? new Date(req.approvedAt).toLocaleString('vi-VN') : '—'} bởi {req.approvedBy || 'Admin'}</span>
                          </div>
                        )}
                        {req.status === 'rejected' && (
                          <div className="flex items-center gap-2 text-xs">
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-red-600">Từ chối: {req.rejectedAt ? new Date(req.rejectedAt).toLocaleString('vi-VN') : '—'}</span>
                            {req.rejectReason && <p className="text-red-500 text-xs mt-0.5">Lý do: {req.rejectReason}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card p-16 text-center text-gray-400">
            <Shield className="w-20 h-20 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-medium">Không có yêu cầu nào</p>
            <p className="text-sm mt-1">
              {pendingCount === 0 ? 'Tất cả yêu cầu đã được xử lý ✓' : 'Thử thay đổi bộ lọc'}
            </p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Từ chối yêu cầu</h3>
                <p className="text-sm text-gray-500">
                  {rejectModal.request.studentName} — {typeLabel(rejectModal.request.type)}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lý do từ chối *</label>
              <textarea
                value={rejectModal.note}
                onChange={e => setRejectModal({ ...rejectModal, note: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Nhập lý do từ chối..."
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)} className="btn-ghost flex-1">Hủy</button>
              <button onClick={handleReject} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
