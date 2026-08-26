import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiGetClasses, apiListInvoices, apiGetTuitions, onDataChange } from '../../data/api';
import { Search, CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronRight, Building2, GraduationCap, Layers, CreditCard, Tag } from 'lucide-react';
import ExpandableDataTable from '../../components/ExpandableDataTable';

const RANK_LABELS = { A: 'VLOS (Hạng A)', B: 'BVLOS (Hạng B)' };
const RANK_COLORS = { A: 'bg-blue-100 text-blue-700', B: 'bg-purple-100 text-purple-700' };

export default function AdminStudents() {
  const { getAllUsers, updateUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tuitions, setTuitions] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showAgencyModal, setShowAgencyModal] = useState(null);
  const [assignAgencyId, setAssignAgencyId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [userData, enrData, classData, invoiceData, tuitionData] = await Promise.all([
        getAllUsers(),
        apiGetEnrollments().catch(() => []),
        apiGetClasses().catch(() => []),
        apiListInvoices({ perPage: 100 }).catch(() => ({ data: [] })),
        apiGetTuitions().catch(() => []),
      ]);
      setStudents(userData.filter(u => u.role === 'STUDENT'));
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setInvoices(Array.isArray(invoiceData?.data) ? invoiceData.data : (Array.isArray(invoiceData) ? invoiceData : []));
      setTuitions(Array.isArray(tuitionData) ? tuitionData : []);

      // Load agencies
      try {
        const token = localStorage.getItem('smc-token');
        const res = await fetch('/api/agency.php?action=list', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setAgencies(data.agencies || []);
      } catch {}
    } catch {}
  };

  const reload = async () => { await loadAll(); };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => { return onDataChange('users', () => { reload(); }); }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'users' || detail?.changed === 'enrollments' || detail?.changed === 'classes' || detail?.changed === 'invoices' || detail?.changed === 'tuitions') { reload(); }
    });
  }, []);

  // ── Helpers (hỗ trợ cả camelCase & snake_case từ API) ──
  const getEnrollment = studentId => enrollments.find(e => (e.studentId || e.student_id) === studentId);
  const getTuition = studentId => tuitions.find(t => t.studentId === studentId);
  const getInvoice = studentId => invoices.find(inv => (inv.studentId || inv.student_id) === studentId);

  const getClassName = (studentId) => {
    const enr = getEnrollment(studentId);
    // Ưu tiên enrollment classId/class_id → class name
    const cid = enr?.classId || enr?.class_id;
    if (cid) {
      const cls = classes.find(c => c.id === cid);
      if (cls?.name) return cls.name;
    }
    // Ưu tiên tuition className
    const t = getTuition(studentId);
    if (t?.className) return t.className;
    // Fallback: kiểm tra trong class.student_ids
    const cls = classes.find(c => (c.student_ids || []).includes(studentId));
    return cls?.name || '—';
  };

  const getRank = (s) => {
    // Ưu tiên user.rank → tuition → invoice
    if (s.rank) return s.rank;
    const t = getTuition(s.id);
    if (t?.courseName?.includes('BVLOS') || t?.courseName?.includes('Hạng B')) return 'B';
    if (t?.courseName?.includes('VLOS') || t?.courseName?.includes('Hạng A')) return 'A';
    const inv = getInvoice(s.id);
    if (inv?.studentRank) return inv.studentRank;
    return '';
  };

  const getCourseName = (s) => {
    // Ưu tiên tuition.courseName → invoice.courseName → user.courseId
    const t = getTuition(s.id);
    if (t?.courseName) return t.courseName;
    const inv = getInvoice(s.id);
    if (inv?.courseName) return inv.courseName;
    if (s.courseId) {
      const courses = classes; // fallback
      return s.courseId;
    }
    return '';
  };

  const getTuitionInfo = (s) => {
    // Ưu tiên tuition → invoice
    const t = getTuition(s.id);
    if (t) {
      return {
        amount: t.amount || 0,
        paid: t.paidAmount || 0,
        status: t.step || t.status || 'unpaid',
        step: t.step || 'pending',
      };
    }
    const inv = getInvoice(s.id);
    if (inv) {
      const bp = inv.basePrice || inv.finalPrice || 0;
      const paid = inv.totalPaid || 0;
      const due = inv.remainingDue ?? (bp - paid);
      return {
        amount: bp,
        paid,
        status: inv.status || (due <= 0 ? 'paid' : 'partial'),
        step: inv.status || 'pending',
      };
    }
    return { amount: 0, paid: 0, status: 'unpaid', step: 'pending' };
  };

  const getAgencyName = (student) => {
    if (!student.agencyId) return null;
    const sid = String(student.agencyId);
    const agency = agencies.find(a => String(a.id) === sid);
    return agency || { id: sid, name: 'Đại lý #' + sid.substring(0, 8) };
  };

  const getStages = (studentId) => {
    const enr = getEnrollment(studentId);
    return enr?.stages || enr?.training_stages || null;
  };

  const handleAssignAgency = async () => {
    if (!showAgencyModal) return;
    setAssignSaving(true);
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=assign-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId: showAgencyModal, agencyId: assignAgencyId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowAgencyModal(null);
      setAssignAgencyId('');
      reload();
    } catch (e) {
      alert('Lỗi: ' + (e.message || 'Không thể gán đại lý'));
    } finally { setAssignSaving(false); }
  };

  const stageLabels = { enrollment: 'Tuyển sinh', theory: 'Lý thuyết', practice: 'Thực hành', exam: 'Sát hạch', certification: 'Chứng chỉ' };
  const stageIcons = {
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    in_progress: <Clock className="w-4 h-4 text-amber-500" />,
    pending: <Clock className="w-4 h-4 text-gray-300" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const columns = [
    {
      key: 'student', label: 'Học viên',
      render: (s) => (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{s.fullName?.charAt(0)?.toUpperCase()}</div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm truncate">{s.fullName}</h3>
            <p className="text-xs text-gray-500 truncate">{s.email}</p>
            {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'class', label: 'Lớp',
      render: (s) => {
        const name = getClassName(s.id);
        return (
          <span className={`text-sm font-medium ${name !== '—' ? 'text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full' : 'text-gray-400'}`}>
            {name}
          </span>
        );
      },
    },
    {
      key: 'rank', label: 'Hạng',
      render: (s) => {
        const rank = getRank(s);
        if (!rank) return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className={`badge text-xs font-semibold ${RANK_COLORS[rank] || 'bg-gray-100 text-gray-600'}`}>
            <Layers className="w-3 h-3 mr-1 inline" />
            {RANK_LABELS[rank] || rank}
          </span>
        );
      },
    },
    {
      key: 'course', label: 'Khóa học',
      render: (s) => {
        const name = getCourseName(s);
        if (!name) return <span className="text-xs text-gray-400">—</span>;
        return <span className="text-sm text-gray-700 font-medium">{name}</span>;
      },
    },
    {
      key: 'tuition', label: 'Học phí',
      render: (s) => {
        const info = getTuitionInfo(s);
        if (info.amount === 0 && info.status === 'paid') {
          return <span className="badge bg-emerald-100 text-emerald-700 text-xs font-semibold">🆓 Miễn phí (test)</span>;
        }
        if (info.amount === 0) {
          return <span className="text-xs text-gray-400">Chưa có</span>;
        }
        const due = info.amount - info.paid;
        if (due <= 0) {
          return (
            <div>
              <span className="badge bg-green-100 text-green-700 text-xs font-semibold">
                <CreditCard className="w-3 h-3 mr-1 inline" />
                {info.amount.toLocaleString('vi-VN')}đ
              </span>
              <div className="text-xs text-green-600 mt-0.5 font-medium">✅ Đã TT đủ</div>
            </div>
          );
        }
        return (
          <div>
            <span className="badge bg-red-100 text-red-700 text-xs font-semibold">{info.amount.toLocaleString('vi-VN')}đ</span>
            <div className="text-xs text-gray-500 mt-0.5">Đã nộp: {info.paid.toLocaleString('vi-VN')}đ</div>
            <div className="text-xs text-red-500 font-medium">Còn thiếu: {due.toLocaleString('vi-VN')}đ</div>
          </div>
        );
      },
    },
    {
      key: 'stages', label: 'Tiến độ',
      render: (s) => {
        const stages = getStages(s.id);
        if (!stages) return <span className="text-xs text-gray-400">—</span>;
        const entries = Object.entries(stages);
        const completed = entries.filter(([, st]) => st?.status === 'completed').length;
        const total = entries.length;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-gray-500 font-medium">{completed}/{total}</span>
          </div>
        );
      },
    },
    {
      key: 'agency', label: 'Đại lý',
      render: (s) => {
        const agency = getAgencyName(s);
        if (!agency) return <span className="text-xs text-gray-400">—</span>;
        return (
          <button
            onClick={() => { setShowAgencyModal(s.id); setAssignAgencyId(s.agencyId || ''); }}
            className="badge bg-orange-100 text-orange-700 text-xs hover:bg-orange-200 cursor-pointer transition-colors flex items-center gap-1"
            title="Nhấn để thay đổi đại lý"
          >
            <Building2 className="w-3 h-3" />
            {agency.name}
          </button>
        );
      },
    },
    {
      key: 'status', label: 'Trạng thái',
      render: (s) => {
        const info = getTuitionInfo(s);
        const enr = getEnrollment(s.id);
        const enrStatus = enr?.status || enr?.enrollment_status || '';
        return (
          <div className="flex flex-col gap-1">
            {/* Tài khoản */}
            <span className={`badge text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : s.status === 'FROZEN' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {s.status === 'ACTIVE' ? '✅ Hoạt động' : s.status === 'FROZEN' ? '🔒 Đã khóa' : s.status === 'PENDING' ? '⏳ Chờ duyệt' : s.status}
            </span>
            {/* Học phí */}
            {info.amount > 0 && (
              <span className={`badge text-xs font-semibold ${
                info.status === 'paid' ? 'bg-green-100 text-green-700' :
                info.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {info.status === 'paid' ? '💰 Đã TT đủ' :
                 info.status === 'partial' ? '⚠️ TT một phần' :
                 '❌ Chưa TT'}
              </span>
            )}
            {info.amount === 0 && info.status === 'paid' && (
              <span className="badge bg-emerald-100 text-emerald-700 text-xs font-semibold">🆓 Miễn phí</span>
            )}
            {info.amount === 0 && info.status !== 'paid' && (
              <span className="badge bg-gray-100 text-gray-500 text-xs">Chưa có học phí</span>
            )}
            {/* Enrollment */}
            {enrStatus && (
              <span className={`badge text-xs ${
                enrStatus === 'active' || enrStatus === 'studying' ? 'bg-blue-100 text-blue-700' :
                enrStatus === 'completed' ? 'bg-green-100 text-green-700' :
                enrStatus === 'frozen' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                📋 {enrStatus === 'active' ? 'Đang học' :
                    enrStatus === 'studying' ? 'Đang học' :
                    enrStatus === 'completed' ? 'Hoàn thành' :
                    enrStatus === 'frozen' ? 'Bảo lưu' :
                    enrStatus === 'cancelled' ? 'Đã hủy' :
                    enrStatus === 'pending' ? 'Chờ xử lý' : enrStatus}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý học viên</h1>
        <p className="text-sm text-gray-500 mt-0.5">{students.length} học viên — dữ liệu đồng bộ từ hồ sơ, học phí, lớp học</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-blue-600">{students.length}</div>
          <div className="text-xs text-gray-500 mt-1">Tổng học viên</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-green-600">{students.filter(s => s.status === 'ACTIVE').length}</div>
          <div className="text-xs text-gray-500 mt-1">Đang hoạt động</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-red-600">{students.filter(s => s.status === 'FROZEN').length}</div>
          <div className="text-xs text-gray-500 mt-1">Đã khóa</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-amber-600">{students.filter(s => s.status === 'PENDING').length}</div>
          <div className="text-xs text-gray-500 mt-1">Chờ duyệt</div>
        </div>
      </div>

      <ExpandableDataTable
        data={students}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ statusFilter: true, dateFilter: true, dateField: 'createdAt' }}
        emptyIcon={FileText}
        emptyText="Không tìm thấy học viên"
        renderExpanded={(s) => {
          const enr = getEnrollment(s.id);
          const t = getTuition(s.id);
          const agency = getAgencyName(s);
          const stages = getStages(s.id);
          const rank = getRank(s);
          const courseName = getCourseName(s);
          const tuitionInfo = getTuitionInfo(s);
          const className = getClassName(s.id);
          return (
            <div className="space-y-3">
              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Họ tên</p>
                  <p className="text-sm font-bold text-gray-900">{s.fullName}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Email</p>
                  <p className="text-sm text-gray-700 break-all">{s.email}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">SĐT</p>
                  <p className="text-sm text-gray-700">{s.phone || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Trạng thái</p>
                  <span className={`badge text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : s.status === 'FROZEN' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.status === 'ACTIVE' ? '✅ Hoạt động' : s.status === 'FROZEN' ? '🔒 Đã khóa' : s.status === 'PENDING' ? '⏳ Chờ duyệt' : s.status}
                  </span>
                </div>
              </div>

              {/* Lớp + Hạng + Khóa + Đại lý */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-500 uppercase font-semibold mb-0.5">📚 Lớp</p>
                  <p className="text-sm font-bold text-blue-900">{className}</p>
                </div>
                <div className={`rounded-lg p-3 ${rank === 'B' ? 'bg-purple-50' : rank === 'A' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">🏅 Hạng</p>
                  <p className="text-sm font-bold text-gray-900">{rank ? RANK_LABELS[rank] || rank : '—'}</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-3">
                  <p className="text-xs text-teal-500 uppercase font-semibold mb-0.5">🎓 Khóa học</p>
                  <p className="text-sm font-bold text-teal-900">{courseName || '—'}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs text-orange-500 uppercase font-semibold mb-0.5">🏢 Đại lý</p>
                  <p className="text-sm font-bold text-orange-900">
                    {agency ? <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{agency.name}</span> : '—'}
                  </p>
                </div>
              </div>

              {/* Học phí chi tiết */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Chi tiết học phí
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Tổng học phí</p>
                    <p className="text-lg font-extrabold text-gray-900">{tuitionInfo.amount.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Đã nộp</p>
                    <p className="text-lg font-extrabold text-green-600">{tuitionInfo.paid.toLocaleString('vi-VN')}đ</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Còn lại</p>
                    <p className={`text-lg font-extrabold ${(tuitionInfo.amount - tuitionInfo.paid) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {Math.max(0, tuitionInfo.amount - tuitionInfo.paid).toLocaleString('vi-VN')}đ
                    </p>
                  </div>
                </div>
                {t?.paymentHistory?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-400 mb-1.5">Lịch sử thanh toán</p>
                    {t.paymentHistory.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="text-gray-500">{p.date?.substring(0, 10)} — {p.method}</span>
                        <span className="font-semibold text-gray-700">{p.amount?.toLocaleString('vi-VN')}đ</span>
                        {p.note && <span className="text-gray-400 italic ml-2">{p.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tiến độ học tập */}
              {stages && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">📊 Tiến độ học tập</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stages).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        val?.status === 'completed' ? 'bg-green-100 text-green-700' :
                        val?.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        val?.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {stageIcons[val?.status] || stageIcons.pending} {stageLabels[key] || key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />

      {/* Assign Agency Modal */}
      {showAgencyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAgencyModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-500" /> Gán vào Đại lý</h3>
              <button onClick={() => setShowAgencyModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Chọn đại lý để gán học viên này. Học phí sẽ tự động tính lại theo chiết khấu của đại lý.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Đại lý</label>
                <select value={assignAgencyId} onChange={e => setAssignAgencyId(e.target.value)} className="input-field">
                  <option value="">— Không thuộc đại lý nào —</option>
                  {agencies.filter(a => a.status === 'active').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.discountPercent > 0 ? `(CK ${a.discountPercent}%)` : ''} — {a.studentCount || 0} HV
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAgencyModal(null)} className="btn-ghost flex-1">Hủy</button>
                <button onClick={handleAssignAgency} disabled={assignSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {assignSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {assignAgencyId ? 'Gán vào đại lý' : 'Gỡ khỏi đại lý'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
