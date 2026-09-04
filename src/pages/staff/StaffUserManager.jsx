import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiGetClasses, apiGetTuitions, apiListInvoices, onDataChange } from '../../data/api';
import { Users, Edit3, X, Check, School, Building2, Layers, CreditCard, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';

const RANK_LABELS = { A: 'VLOS (Hạng A)', B: 'BVLOS (Hạng B)' };
const RANK_COLORS = { A: 'bg-blue-100 text-blue-700', B: 'bg-purple-100 text-purple-700' };
const stageLabels = { enrollment: 'Tuyển sinh', theory: 'Lý thuyết', practice: 'Thực hành', exam: 'Sát hạch', certification: 'Chứng chỉ' };

/**
 * Quản lý người dùng cho Nhân viên (Staff)
 * Đồng bộ dữ liệu từ users + tuitions + enrollments + invoices + classes
 */
export default function StaffUserManager() {
  const { getAllUsers, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [tuitions, setTuitions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [classes, setClasses] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { return onDataChange('all', () => { loadAll(); }); }, []);

  const loadAll = async () => {
    const data = await getAllUsers();
    setUsers(data.filter(u => u.role === 'STUDENT'));

    try {
      const [enrData, tData, classData, invData] = await Promise.all([
        apiGetEnrollments().catch(() => []),
        apiGetTuitions().catch(() => []),
        apiGetClasses().catch(() => []),
        apiListInvoices({ perPage: 100 }).catch(() => ({ data: [] })),
      ]);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      setTuitions(Array.isArray(tData) ? tData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setInvoices(Array.isArray(invData?.data) ? invData.data : (Array.isArray(invData) ? invData : []));
    } catch {}

    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=list', { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      setAgencies(d.agencies || []);
    } catch {}
  };

  // ── Helpers ──
  const getEnrollment = sid => enrollments.find(e => (e.studentId || e.student_id) === sid);
  const getTuition = sid => tuitions.find(t => t.studentId === sid);
  const getInvoice = sid => invoices.find(inv => (inv.studentId || inv.student_id) === sid);

  const getClassName = (sid) => {
    const enr = getEnrollment(sid);
    const cid = enr?.classId || enr?.class_id;
    if (cid) return classes.find(c => c.id === cid)?.name || '—';
    const t = getTuition(sid);
    if (t?.className) return t.className;
    return classes.find(c => (c.student_ids || []).some(x => String(x) === String(sid)))?.name || '—';
  };

  const getRank = (s) => {
    if (s.rank === 'A' || s.rank === 'B') return s.rank;
    const t = getTuition(s.id);
    if (t?.courseName?.includes('BVLOS')) return 'B';
    if (t?.courseName?.includes('VLOS')) return 'A';
    return '';
  };

  const getCourseName = (s) => {
    const t = getTuition(s.id);
    if (t?.courseName) return t.courseName;
    const inv = getInvoice(s.id);
    if (inv?.courseName) return inv.courseName;
    return s.courseId || '';
  };

  const getTuitionInfo = (sid) => {
    const t = getTuition(sid);
    if (t) return { amount: t.amount || 0, paid: t.paidAmount || 0, status: t.step || t.status || 'unpaid' };
    const inv = getInvoice(sid);
    if (inv) {
      const bp = inv.basePrice || inv.finalPrice || 0;
      const paid = inv.totalPaid || 0;
      return { amount: bp, paid, status: inv.status || 'partial' };
    }
    return { amount: 0, paid: 0, status: 'unpaid' };
  };

  const getStages = (sid) => {
    const enr = getEnrollment(sid);
    return enr?.stages || enr?.training_stages || null;
  };

  const getAgencyName = (s) => {
    if (!s.agencyId) return null;
    const sid = String(s.agencyId);
    return agencies.find(a => String(a.id) === sid) || { id: sid, name: 'ĐL #' + sid.substring(0, 8) };
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({ fullName: u.fullName, email: u.email, phone: u.phone || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) { toast.error('Vui lòng nhập đầy đủ họ tên và email'); return; }
    try {
      await updateUser(editingUser.id, { fullName: form.fullName, email: form.email, phone: form.phone });
      toast.success('Cập nhật thành công!');
    } catch (err) { toast.error(err.message || 'Lỗi cập nhật'); return; }
    setShowModal(false); loadAll();
  };

  const columns = [
    {
      key: 'student', label: 'Học viên',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div>
          <span className="text-sm font-medium text-gray-900">{u.fullName}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (u) => <span className="text-sm text-gray-500">{u.email}</span> },
    { key: 'phone', label: 'SĐT', render: (u) => <span className="text-sm text-gray-500">{u.phone || '—'}</span> },
    {
      key: 'class', label: 'Lớp',
      render: (u) => {
        const name = getClassName(u.id);
        return name !== '—' ? <span className="badge bg-amber-100 text-amber-700 text-xs"><School className="w-3 h-3 mr-1 inline" />{name}</span> : <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      key: 'rank', label: 'Hạng',
      render: (u) => {
        const rank = getRank(u);
        if (!rank) return <span className="text-xs text-gray-400">—</span>;
        return <span className={`badge text-xs font-semibold ${RANK_COLORS[rank] || 'bg-gray-100 text-gray-600'}`}><Layers className="w-3 h-3 mr-1 inline" />{RANK_LABELS[rank] || rank}</span>;
      },
    },
    {
      key: 'course', label: 'Khóa học',
      render: (u) => {
        const name = getCourseName(u);
        return name ? <span className="text-sm text-gray-700">{name}</span> : <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      key: 'tuition', label: 'Học phí',
      render: (u) => {
        const info = getTuitionInfo(u.id);
        if (info.amount === 0 && info.status === 'paid') return <span className="badge bg-emerald-100 text-emerald-700 text-xs font-semibold">🆓 Miễn phí</span>;
        if (info.amount === 0) return <span className="text-xs text-gray-400">—</span>;
        const due = info.amount - info.paid;
        return due <= 0
          ? <span className="badge bg-green-100 text-green-700 text-xs">{info.amount.toLocaleString('vi-VN')}đ ✅</span>
          : <span className="badge bg-red-100 text-red-700 text-xs">{info.amount.toLocaleString('vi-VN')}đ</span>;
      },
    },
    {
      key: 'stages', label: 'Tiến độ',
      render: (u) => {
        const stages = getStages(u.id);
        if (!stages) return <span className="text-xs text-gray-400">—</span>;
        const entries = Object.entries(stages);
        const done = entries.filter(([,st]) => st?.status === 'completed').length;
        return <span className="text-xs text-gray-500">{done}/{entries.length}</span>;
      },
    },
    {
      key: 'agency', label: 'Đại lý',
      render: (u) => {
        const a = getAgencyName(u);
        return a ? <span className="badge bg-orange-100 text-orange-700 text-xs"><Building2 className="w-3 h-3 mr-1 inline" />{a.name}</span> : <span className="text-xs text-gray-400">—</span>;
      },
    },
    {
      key: 'status', label: 'Trạng thái',
      render: (u) => {
        const info = getTuitionInfo(u.id);
        const enr = getEnrollment(u.id);
        const enrStatus = enr?.status || enr?.enrollment_status || '';
        return (
          <div className="flex flex-col gap-1">
            <span className={`badge text-xs font-semibold ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {u.status === 'ACTIVE' ? '✅ HĐ' : '🔒 Khóa'}
            </span>
            {info.amount > 0 && (
              <span className={`badge text-xs font-semibold ${info.status === 'paid' ? 'bg-green-100 text-green-700' : info.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {info.status === 'paid' ? '💰 Đã TT' : info.status === 'partial' ? '⚠️ TT phần' : '❌ Chưa TT'}
              </span>
            )}
            {info.amount === 0 && info.status === 'paid' && <span className="badge bg-emerald-100 text-emerald-700 text-xs">🆓 Free</span>}
            {enrStatus && (
              <span className={`badge text-xs ${enrStatus === 'active' || enrStatus === 'studying' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                📋 {enrStatus === 'active' ? 'Đang học' : enrStatus}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý học viên</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} học viên — Đồng bộ từ hồ sơ, học phí, lớp học</p>
        </div>
      </div>

      <ExpandableDataTable
        data={users}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ statusFilter: true }}
        emptyIcon={Users}
        emptyText="Không tìm thấy học viên"
        renderExpanded={(u) => {
          const info = getTuitionInfo(u.id);
          const stages = getStages(u.id);
          const rank = getRank(u);
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-bold text-gray-900">{u.fullName}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700 break-all">{u.email}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{u.phone || '—'}</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-bold ${u.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{u.status === 'ACTIVE' ? '✅ Hoạt động' : '🔒 Đã khóa'}</span></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-500 uppercase font-semibold">📚 Lớp</p><p className="text-sm font-bold text-blue-900">{getClassName(u.id)}</p></div>
                <div className={`rounded-lg p-3 ${rank === 'B' ? 'bg-purple-50' : rank === 'A' ? 'bg-blue-50' : 'bg-gray-50'}`}><p className="text-xs text-gray-400 uppercase font-semibold">🏅 Hạng</p><p className="text-sm font-bold text-gray-900">{rank ? RANK_LABELS[rank] || rank : '—'}</p></div>
                <div className="bg-teal-50 rounded-lg p-3"><p className="text-xs text-teal-500 uppercase font-semibold">🎓 Khóa học</p><p className="text-sm font-bold text-teal-900">{getCourseName(u) || '—'}</p></div>
                <div className="bg-orange-50 rounded-lg p-3"><p className="text-xs text-orange-500 uppercase font-semibold">🏢 Đại lý</p><p className="text-sm font-bold text-orange-900">{getAgencyName(u)?.name || '—'}</p></div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3"><CreditCard className="w-3.5 h-3.5 inline mr-1" />Học phí</h4>
                <div className="flex gap-6">
                  <div><p className="text-xs text-gray-400">Tổng</p><p className="text-base font-extrabold text-gray-900">{info.amount.toLocaleString('vi-VN')}đ</p></div>
                  <div><p className="text-xs text-gray-400">Đã nộp</p><p className="text-base font-extrabold text-green-600">{info.paid.toLocaleString('vi-VN')}đ</p></div>
                  <div><p className="text-xs text-gray-400">Còn lại</p><p className={`text-base font-extrabold ${(info.amount - info.paid) > 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.max(0, info.amount - info.paid).toLocaleString('vi-VN')}đ</p></div>
                </div>
              </div>
              {stages && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">📊 Tiến độ</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stages).map(([key, val]) => (
                      <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${val?.status === 'completed' ? 'bg-green-100 text-green-700' : val?.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {val?.status === 'completed' ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                        {stageLabels[key] || key}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }}
        actions={(u) => (
          <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Sửa"><Edit3 className="w-4 h-4" /></button>
        )}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b"><h3 className="text-lg font-bold text-gray-900">Chỉnh sửa học viên</h3><button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Lưu thay đổi</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
