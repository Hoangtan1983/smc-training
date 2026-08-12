import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetChangeRequests, apiCreateChangeRequest, apiGetUsers, apiGetClasses } from '../../data/api';
import { ArrowLeftRight, Ban, Wallet, Search, RefreshCw, Plus, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Staff tạo yêu cầu Đổi lớp / Bảo lưu / Hoàn phí
 * KHÔNG có quyền duyệt — chỉ Admin mới duyệt (trang AdminChangeRequests)
 */
export default function StaffChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [form, setForm] = useState({
    studentId: '', type: 'change_class', fromClassId: '', toClassId: '', reason: '', amount: 0,
  });

  useEffect(() => { loadData_(); }, []);

  const loadData_ = async () => {
    try {
      const [reqData, userData, classData] = await Promise.all([
        apiGetChangeRequests().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetClasses().catch(() => []),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      const studentList = users.filter(u => u.role === 'STUDENT');
      setAllStudents(studentList);
      setAllClasses(Array.isArray(classData) ? classData : []);
    } catch (e) {
      console.error('Lỗi tải dữ liệu:', e);
    }
    setLoading(false);
  };

  const getStudent = (id) => allStudents.find(s => s.id === id);
  const getClass = (id) => allClasses.find(c => c.id === id);

  // ─── Tạo yêu cầu (staff tạo, admin duyệt) ───
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!form.studentId || !form.type) return toast.error('Vui lòng chọn học viên và loại yêu cầu');

    if (form.type === 'change_class' && !form.toClassId) {
      return toast.error('Vui lòng chọn lớp mới');
    }
    if (!form.reason.trim()) return toast.error('Vui lòng nhập lý do');

    try {
      await apiCreateChangeRequest({
        studentId: form.studentId,
        studentName: getStudent(form.studentId)?.fullName || '',
        type: form.type,
        fromClassId: form.fromClassId,
        fromClassName: getClass(form.fromClassId)?.name || '',
        toClassId: form.toClassId,
        toClassName: getClass(form.toClassId)?.name || '',
        reason: form.reason,
        amount: form.amount || 0,
        status: 'pending',
        createdBy: 'STAFF',
        createdAt: new Date().toISOString(),
        history: [{ action: 'created', date: new Date().toISOString(), by: 'STAFF', note: 'Nhân viên tạo yêu cầu' }],
      });
      toast.success('✅ Đã tạo yêu cầu! Admin sẽ xem xét và phê duyệt.');
      setShowForm(false);
      setForm({ studentId: '', type: 'change_class', fromClassId: '', toClassId: '', reason: '', amount: 0 });
      await loadData_();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const filtered = requests.filter(r => {
    const matchSearch = (r.studentName || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reason || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.type === filterType;
    return matchSearch && matchType;
  });

  const typeLabel = (t) => ({ change_class: 'Đổi lớp', reserve: 'Bảo lưu', refund: 'Hoàn phí' })[t] || t;
  const typeIcon = (t) => {
    if (t === 'change_class') return <ArrowLeftRight className="w-3 h-3" />;
    if (t === 'reserve') return <Ban className="w-3 h-3" />;
    return <Wallet className="w-3 h-3" />;
  };
  const statusBadge = (s) => ({
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    approved: 'bg-green-100 text-green-700 border-green-300',
    rejected: 'bg-red-100 text-red-700 border-red-300',
  })[s] || 'bg-gray-100';

  const statusLabel = (s) => ({
    pending: '⏳ Chờ Admin duyệt',
    approved: '✓ Admin đã duyệt',
    rejected: '✗ Admin từ chối',
  })[s] || s;

  if (loading) return (
    <div className="text-center py-12">
      <div className="spinner mx-auto mb-4" />
      <p className="text-gray-500">Đang tải danh sách học viên...</p>
    </div>
  );

  if (!loading && allStudents.length === 0) return (
    <div className="text-center py-12">
      <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
      <p className="text-gray-700 font-medium">Không tải được danh sách học viên</p>
      <p className="text-sm text-gray-500 mt-1">Vui lòng kiểm tra kết nối mạng hoặc đăng nhập lại</p>
      <button onClick={() => { setLoading(true); loadData_(); }} className="btn-primary mt-4 text-sm">
        <RefreshCw className="w-4 h-4 inline mr-1" /> Thử lại
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Đổi lớp & Bảo lưu</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tạo yêu cầu cho học viên — Admin sẽ xem xét và phê duyệt
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tạo yêu cầu mới
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-blue-600 text-sm">ℹ️</span>
        </div>
        <div>
          <p className="text-sm font-medium text-blue-800">Quy trình Đổi lớp / Bảo lưu</p>
          <p className="text-xs text-blue-600 mt-0.5">
            <strong>B1:</strong> Nhân viên tạo yêu cầu →
            <strong> B2:</strong> Admin xem xét và duyệt/từ chối →
            <strong> B3:</strong> Hệ thống tự động cập nhật lớp & trạng thái học viên
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm theo tên học viên hoặc lý do..." />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field w-auto">
          <option value="all">Tất cả loại</option>
          <option value="change_class">Đổi lớp</option>
          <option value="reserve">Bảo lưu</option>
          <option value="refund">Hoàn phí</option>
        </select>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {filtered.map(req => (
          <div key={req.id} className={`card p-5 border-l-4 ${
            req.status === 'approved' ? 'border-l-green-500' :
            req.status === 'rejected' ? 'border-l-red-500' : 'border-l-amber-500'
          } hover:shadow-md transition-shadow`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge text-xs font-semibold border ${statusBadge(req.status)}`}>
                    {statusLabel(req.status)}
                  </span>
                  <span className="badge bg-blue-100 text-blue-700 text-xs flex items-center gap-1 font-semibold">
                    {typeIcon(req.type)} {typeLabel(req.type)}
                  </span>
                </div>
                <div className="font-bold text-gray-900 text-base">{req.studentName}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {req.type === 'change_class' && (
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium">{req.fromClassName || 'Chưa có lớp'}</span>
                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-medium text-blue-700">{req.toClassName}</span>
                    </span>
                  )}
                  {req.type === 'reserve' && <span className="flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Bảo lưu: {req.reason}</span>}
                  {req.type === 'refund' && <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Hoàn: {req.amount?.toLocaleString('vi-VN')} VNĐ — {req.reason}</span>}
                </div>
              </div>

              {req.status !== 'pending' && (
                <div className="text-xs text-gray-500 flex-shrink-0 flex items-center gap-1">
                  {req.status === 'approved' && (
                    <span className="text-green-600 font-medium">
                      Duyệt: {req.approvedAt ? new Date(req.approvedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="text-red-600 font-medium">
                      Từ chối: {req.rejectedAt ? new Date(req.rejectedAt).toLocaleString('vi-VN') : '—'}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
              <span>Tạo: {new Date(req.createdAt).toLocaleString('vi-VN')}</span>
              {req.reason && <span>• Lý do: {req.reason}</span>}
              <span>• Người tạo: {req.createdBy || 'STAFF'}</span>
            </div>

            {/* History log (nếu có nhiều bước) */}
            {req.history?.length > 1 && (
              <details className="mt-2 text-xs text-gray-400">
                <summary className="cursor-pointer hover:text-gray-600">📋 Lịch sử ({req.history.length} bước)</summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {req.history.map((h, i) => (
                    <li key={i} className="list-disc">
                      [{new Date(h.date).toLocaleString('vi-VN')}] {h.note}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <RefreshCw className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Chưa có yêu cầu nào</p>
            <p className="text-sm mt-1">Nhấn "Tạo yêu cầu mới" để bắt đầu</p>
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-500" /> Tạo yêu cầu mới
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              {/* Học viên */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Học viên *</label>
                {/* Search input cho học viên */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="input-field pl-8 text-sm"
                    placeholder="Tìm học viên theo tên, email, SĐT..."
                  />
                </div>
                <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} className="input-field" size={6} required>
                  <option value="">— Chọn học viên —</option>
                  {allStudents
                    .filter(s => {
                      if (!studentSearch.trim()) return s.status === 'ACTIVE';
                      const kw = studentSearch.toLowerCase().trim();
                      return s.status === 'ACTIVE' && (
                        (s.fullName || '').toLowerCase().includes(kw) ||
                        (s.email || '').toLowerCase().includes(kw) ||
                        (s.phone || '').includes(kw)
                      );
                    })
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} — {s.phone || s.email} {s.rank ? `[Hạng ${s.rank}]` : ''}
                      </option>
                    ))}
                </select>
                {form.studentId && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✅ Đã chọn: {getStudent(form.studentId)?.fullName}
                  </p>
                )}
              </div>

              {/* Loại yêu cầu */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Loại yêu cầu</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'change_class', label: '🔄 Đổi lớp', desc: 'Chuyển sang lớp khác' },
                    { value: 'reserve', label: '⏸️ Bảo lưu', desc: 'Tạm dừng học tập' },
                    { value: 'refund', label: '💰 Hoàn phí', desc: 'Hoàn trả học phí' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: opt.value })}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        form.type === opt.value
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Đổi lớp: chọn lớp cũ + lớp mới */}
              {form.type === 'change_class' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lớp hiện tại</label>
                    <select value={form.fromClassId} onChange={e => setForm({ ...form, fromClassId: e.target.value })} className="input-field">
                      <option value="">— Tự động —</option>
                      {allClasses.filter(c => c.status !== 'completed').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lớp mới *</label>
                    <select value={form.toClassId} onChange={e => setForm({ ...form, toClassId: e.target.value })} className="input-field" required>
                      <option value="">— Chọn lớp mới —</option>
                      {allClasses.filter(c => c.status !== 'completed' && c.id !== form.fromClassId).map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({(c.student_ids || []).length}/{c.max_students || 20})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Hoàn phí: nhập số tiền */}
              {form.type === 'refund' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số tiền hoàn (VNĐ)</label>
                  <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} className="input-field" placeholder="Nhập số tiền..." />
                </div>
              )}

              {/* Lý do */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Lý do *</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-field" rows={3} placeholder="Nhập lý do chi tiết..." required />
              </div>

              {/* Cảnh báo */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700">
                {form.type === 'change_class' && '⚠️ Yêu cầu đổi lớp sẽ được Admin xem xét. Học viên sẽ được chuyển sang lớp mới sau khi được duyệt.'}
                {form.type === 'reserve' && '⚠️ Bảo lưu cần Admin duyệt. Học viên sẽ bị tạm dừng truy cập LMS trong thời gian bảo lưu.'}
                {form.type === 'refund' && '⚠️ Hoàn phí thực hiện theo chính sách SMC Training. Cần Admin & Kế toán xác nhận.'}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Hủy</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Tạo yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
