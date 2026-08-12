import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiGetClasses, apiListInvoices, onDataChange } from '../../data/api';
import { Search, CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronRight, Building2, GraduationCap } from 'lucide-react';
import ExpandableDataTable from '../../components/ExpandableDataTable';

const RANK_LABELS = { A: 'VLOS (Hạng A)', B: 'BVLOS (Hạng B)' };
const RANK_COLORS = { A: 'bg-blue-100 text-blue-700', B: 'bg-purple-100 text-purple-700' };

export default function AdminStudents() {
  const { getAllUsers, updateUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showAgencyModal, setShowAgencyModal] = useState(null);
  const [assignAgencyId, setAssignAgencyId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  const loadAll = async () => {
    try {
      const [userData, enrData, classData, invoiceData] = await Promise.all([
        getAllUsers(),
        apiGetEnrollments().catch(() => []),
        apiGetClasses().catch(() => []),
        apiListInvoices().catch(() => ({ data: [] })),
      ]);
      setStudents(userData.filter(u => u.role === 'STUDENT'));
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setInvoices(Array.isArray(invoiceData?.data) ? invoiceData.data : (Array.isArray(invoiceData) ? invoiceData : []));

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
      if (detail?.changed === 'users' || detail?.changed === 'enrollments' || detail?.changed === 'classes' || detail?.changed === 'invoices') { reload(); }
    });
  }, []);

  const getEnrollment = studentId => enrollments.find(e => e.student_id === studentId);
  const getClassName = (enrollment, studentId) => {
    // Ưu tiên enrollment.class_id
    if (enrollment?.class_id) {
      return classes.find(c => c.id === enrollment.class_id)?.name || '—';
    }
    // Fallback: kiểm tra trong class.student_ids (phòng trường hợp đồng bộ lỗi)
    const cls = classes.find(c => (c.student_ids || []).includes(studentId));
    return cls?.name || '—';
  };
  const getInvoice = studentId => invoices.find(inv => inv.studentId === studentId);

  const getAgencyName = (student) => {
    if (!student.agencyId) return null;
    const agency = agencies.find(a => a.id === student.agencyId);
    return agency || { id: student.agencyId, name: 'Đại lý #' + student.agencyId.substring(0, 8) };
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
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">{s.fullName?.charAt(0)?.toUpperCase()}</div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{s.fullName}</h3>
            <p className="text-xs text-gray-500">{s.email} {s.phone && `• ${s.phone}`}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class', label: 'Lớp',
      render: (s) => {
        const enr = getEnrollment(s.id);
        return (
          <div>
            <p className="text-sm font-medium text-gray-700">{getClassName(enr, s.id)}</p>
          </div>
        );
      },
    },
    {
      key: 'rank', label: 'Hạng',
      render: (s) => {
        const inv = getInvoice(s.id);
        const rank = inv?.studentRank || s.rank || '';
        if (!rank) return <span className="text-xs text-gray-400">—</span>;
        return (
          <span className={`badge text-xs font-semibold ${RANK_COLORS[rank] || 'bg-gray-100 text-gray-600'}`}>
            {RANK_LABELS[rank] || rank}
          </span>
        );
      },
    },
    {
      key: 'course', label: 'Khóa học',
      render: (s) => {
        const inv = getInvoice(s.id);
        if (!inv?.courseName) return <span className="text-xs text-gray-400">—</span>;
        return <span className="text-sm text-gray-700">{inv.courseName}</span>;
      },
    },
    {
      key: 'tuition', label: 'Học phí',
      render: (s) => {
        const inv = getInvoice(s.id);
        if (!inv) return <span className="text-xs text-gray-400">Chưa có</span>;
        const bp = inv.basePrice || 0;
        const paid = inv.totalPaid || 0;
        const due = inv.remainingDue || 0;
        const status = inv.status;
        if (status === 'exempt') return <span className="badge bg-emerald-100 text-emerald-700 text-xs">🆓 Miễn phí</span>;
        if (due <= 0) return <span className="badge bg-green-100 text-green-700 text-xs">{bp.toLocaleString('vi-VN')}đ — Đã TT đủ</span>;
        return (
          <div>
            <span className="badge bg-red-100 text-red-700 text-xs">{bp.toLocaleString('vi-VN')}đ</span>
            <div className="text-xs text-gray-500 mt-0.5">Đã nộp: {paid.toLocaleString('vi-VN')}đ</div>
            <div className="text-xs text-red-500">Còn thiếu: {due.toLocaleString('vi-VN')}đ</div>
          </div>
        );
      },
    },
    {
      key: 'stages', label: 'Tiến độ',
      render: (s) => {
        const enr = getEnrollment(s.id);
        if (!enr?.stages) return <span className="text-xs text-gray-400">—</span>;
        const completed = Object.values(enr.stages).filter(st => st.status === 'completed').length;
        const total = Object.keys(enr.stages).length;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(completed / total) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-500">{completed}/{total}</span>
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
      render: (s) => (
        <span className={`badge text-xs ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : s.status === 'FROZEN' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
          {s.status === 'ACTIVE' ? 'Hoạt động' : s.status === 'FROZEN' ? 'Đã khóa' : s.status === 'PENDING' ? 'Chờ duyệt' : s.status}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Quản lý học viên</h1>
        <p className="text-sm text-gray-500 mt-0.5">{students.length} học viên</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
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
          return (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-medium text-gray-900">{s.fullName}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{s.email}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{s.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Lớp</p><p className="text-sm text-gray-700">{getClassName(enr)}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Đại lý</p>
                  <p className="text-sm text-gray-700">
                    {agency ? (
                      <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                        <Building2 className="w-3.5 h-3.5" />{agency.name}
                      </span>
                    ) : '—'}
                  </p>
                </div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Học phí</p>
                  <p className="text-sm text-gray-700">{(t?.amount || 0).toLocaleString('vi-VN')}đ</p>
                  <p className="text-xs text-gray-500">Đã nộp: {(t?.partialAmount || t?.paymentAmount || 0).toLocaleString('vi-VN')}đ</p>
                  <p className={`text-xs font-medium ${(t?.amount || 0) - (t?.partialAmount || t?.paymentAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(t?.amount || 0) - (t?.partialAmount || t?.paymentAmount || 0) > 0 ? 'Còn thiếu' : 'Đã TT đủ'}
                  </p>
                </div>
              </div>
              {enr?.stages && (
                <div className="pt-3 border-t">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tiến độ học tập</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(enr.stages).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        val.status === 'completed' ? 'bg-green-50 text-green-700' :
                        val.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                        val.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                      }`}>
                        {stageIcons[val.status]} {stageLabels[key]}
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
