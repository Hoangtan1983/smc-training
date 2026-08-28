import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiUpdateEnrollment, apiGetClasses, apiGetCourses, apiListEnrollments, apiApproveEnrollment, apiRejectEnrollment, apiGetAgencies, onDataChange, emitDataChange } from '../../data/api';
import { Check, X, Search, FileCheck, School, UserPlus, ShieldCheck, Clock, AlertTriangle, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminEnrollments() {
  const { getAllUsers } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]); // enrollment ở bước accountant — chờ Admin kích hoạt
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [activeTab, setActiveTab] = useState('approvals'); // 'approvals' | 'all'

  const loadAll = async () => {
    try {
      const [enrData, classData, courseData, approvalData, agencyData] = await Promise.all([
        apiGetEnrollments().catch(() => []),
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
        apiListEnrollments('accountant').catch(() => ({ data: [] })),
        apiGetAgencies().catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
      setPendingApprovals(approvalData?.data || []);
      setAgencies(Array.isArray(agencyData) ? agencyData : []);
    } catch {}
    try {
      const data = await getAllUsers();
      setStudents(data.filter(u => u.role === 'STUDENT'));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // Lắng nghe thay đổi dữ liệu từ trang khác (vd: xóa user -> cascade enrollments)
  useEffect(() => {
    return onDataChange('enrollments', () => { loadAll(); });
  }, []);

  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.action === 'delete_user') loadAll();
    });
  }, []);

  // ── Admin duyệt cuối (Kích hoạt tài khoản) ──
  const handleFinalApprove = async (enrollmentId) => {
    try {
      await apiApproveEnrollment({ enrollmentId, step: 'admin', note: 'Admin kích hoạt khóa học' });
      toast.success('Đã kích hoạt khóa học! Tài khoản học viên đã ACTIVE.');
      emitDataChange('enrollments', { action: 'admin_approved' });
      emitDataChange('users', { action: 'activated' });
      emitDataChange('all', { changed: 'enrollments' });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kích hoạt'));
    }
  };

  // ── Admin từ chối enrollment ──
  const handleRejectApproval = async (enrollmentId) => {
    try {
      await apiRejectEnrollment({ enrollmentId, reason: 'Admin từ chối kích hoạt' });
      toast.success('Đã từ chối hồ sơ.');
      emitDataChange('enrollments', { action: 'rejected' });
      emitDataChange('all', { changed: 'enrollments' });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể từ chối'));
    }
  };

  const handleApprove = async (enrollmentId) => {
    try {
      await apiUpdateEnrollment(enrollmentId, {
        status: 'active',
        training_stages: { enrollment: { status: 'completed', completed_at: new Date().toISOString(), confirmed_by: 'admin' } }
      });
      toast.success('Đã duyệt hồ sơ!');
      emitDataChange('enrollments', { action: 'approved', enrollmentId });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const handleReject = async (enrollmentId) => {
    try {
      await apiUpdateEnrollment(enrollmentId, { status: 'cancelled' });
      toast.success('Đã từ chối hồ sơ.');
      emitDataChange('enrollments', { action: 'rejected', enrollmentId });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const handleAssignClass = async (studentId, classId) => {
    try {
      // Dùng apiAssignClass để đồng bộ cả classes + enrollments + tuitions
      const { apiAssignClass } = await import('../../data/api');
      await apiAssignClass(studentId, classId, '');
      toast.success('Đã xếp lớp!');
      emitDataChange('classes', { action: 'student_assigned', studentId, classId });
      emitDataChange('enrollments', { action: 'updated', studentId });
      emitDataChange('users', { action: 'class_changed', studentId });
      setAssignModal(null);
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const getStudent = id => students.find(s => s.id === id);
  const getClass = id => classes.find(c => c.id === id);
  const getCourse = id => courses.find(c => c.id === id);
  const getAgencyName = (student) => {
    if (!student?.agencyId) return null;
    const sid = String(student.agencyId);
    const agency = agencies.find(a => String(a.id) === sid);
    return agency || { id: sid, name: 'Đại lý #' + sid.substring(0, 8) };
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  const filtered = enrollments.filter(e => {
    const s = getStudent(e.student_id || e.studentId);
    return s?.fullName?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Quản lý Tuyển sinh</h1><p className="text-sm text-gray-500 mt-0.5">{enrollments.length} hồ sơ • {pendingApprovals.length} chờ kích hoạt</p></div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <ShieldCheck className="w-4 h-4" /> Chờ kích hoạt ({pendingApprovals.length})
        </button>
        <button onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <FileCheck className="w-4 h-4" /> Tất cả hồ sơ ({enrollments.length})
        </button>
      </div>

      {/* ── TAB: Chờ Admin kích hoạt (đã qua Kế toán duyệt) ── */}
      {activeTab === 'approvals' && (
        <div className="space-y-3 mb-6">
          {pendingApprovals.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p className="text-lg font-medium">Tất cả hồ sơ đã được kích hoạt</p>
              <p className="text-sm mt-1">Không có hồ sơ nào đang chờ Admin duyệt</p>
            </div>
          )}
          {pendingApprovals.map(enr => {
            const sid = enr.student_id || enr.studentId;
            const s = getStudent(sid);
            const agency = getAgencyName(s);
            return (
              <div key={enr.id || sid} className="card p-4 sm:p-5 border-l-4 border-l-amber-400">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge bg-purple-100 text-purple-700 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Chờ Admin kích hoạt
                      </span>
                      {enr.approval_accountant_name && (
                        <span className="text-xs text-gray-500">
                          KT: {enr.approval_accountant_name} • {enr.approval_accountant_at ? new Date(enr.approval_accountant_at).toLocaleDateString('vi-VN') : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900">{s?.fullName || enr.studentName || sid}</h3>
                    <p className="text-sm text-gray-500">{s?.email || ''} {s?.phone ? '• ' + s.phone : ''}</p>
                    {agency && (
                      <p className="text-xs text-purple-600 font-medium mt-0.5 inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> Đại lý: {agency.name}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2 text-xs text-gray-500">
                      <span>📋 {enr.courseName || enr.course_name || '—'}</span>
                      <span>💰 {enr.total_amount ? Number(enr.total_amount).toLocaleString('vi-VN') + ' ₫' : '—'}</span>
                    </div>
                    {/* Approval chain */}
                    <div className="flex items-center gap-1 mt-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">✓ NV: {enr.approval_staff_name || '—'}</span>
                      <span className="text-gray-300">→</span>
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">✓ KT: {enr.approval_accountant_name || '—'}</span>
                      <span className="text-gray-300">→</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">○ Admin</span>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-col sm:min-w-[120px]">
                    <button onClick={() => handleFinalApprove(enr.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Kích hoạt
                    </button>
                    <button onClick={() => handleRejectApproval(enr.id)}
                      className="flex-1 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition flex items-center justify-center gap-1.5">
                      <X className="w-4 h-4" /> Từ chối
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Tất cả hồ sơ ── */}
      {activeTab === 'all' && (
      <>
      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm học viên..." /></div>
      <div className="space-y-4">
        {filtered.map(enr => {
          const sid = enr.student_id || enr.studentId;
          const s = getStudent(sid);
          const cls = getClass(enr.class_id || enr.classId);
          const courseId = cls?.courseId || cls?.course_id || enr.course_id;
          const course = getCourse(courseId);
          const agency = getAgencyName(s);
          return (
            <div key={sid} className="card p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{s?.fullName || sid}</h3>
                  <p className="text-sm text-gray-500">{s?.email} • Lớp: {cls?.name || '—'} • Khóa: {course?.name || '—'}{agency ? ` • Đại lý: ${agency.name}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${enr.status === 'active' ? 'bg-green-100 text-green-700' : enr.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {enr.status === 'active' ? 'Đã duyệt' : enr.status === 'pending' ? 'Chờ duyệt' : enr.status}
                  </span>
                  <button onClick={() => setAssignModal(sid)} className="btn-ghost text-xs flex items-center gap-1 text-smc-600"><School className="w-3.5 h-3.5" /> Xếp lớp</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-gray-400">CMND/CCCD:</span> <span className={enr.documents?.id_card?.status === 'verified' ? 'text-green-600 font-medium' : 'text-amber-600'}>{enr.documents?.id_card?.status || 'Chưa nộp'}</span></div>
                <div><span className="text-gray-400">Sức khỏe:</span> <span className={enr.documents?.health_cert?.status === 'verified' ? 'text-green-600 font-medium' : 'text-amber-600'}>{enr.documents?.health_cert?.status || 'Chưa nộp'}</span></div>
                <div><span className="text-gray-400">Học phí:</span> <span className={enr.payment_status === 'fully_paid' ? 'text-green-600 font-medium' : enr.payment_status === 'partially_paid' ? 'text-amber-600' : 'text-red-500'}>{(Number(enr.paid_amount) || 0).toLocaleString('vi-VN')} VNĐ — {enr.payment_status === 'fully_paid' ? 'Đã TT đủ' : enr.payment_status === 'partially_paid' ? 'TT một phần' : 'Chưa TT'}</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                {enr.status !== 'active' && <button onClick={() => handleApprove(enr.id)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Duyệt</button>}
                {enr.status !== 'rejected' && <button onClick={() => handleReject(enr.id)} className="btn-ghost text-xs px-3 py-1.5 text-red-500 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Từ chối</button>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><FileCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />Không có hồ sơ nào</div>}
      </div>

      {/* Assign Class Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Xếp lớp cho: {getStudent(assignModal)?.fullName}</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {classes.filter(c => c.status === 'active' || c.status === 'open').map(c => (
                <button key={c.id} onClick={() => handleAssignClass(assignModal, c.id)} className="w-full text-left p-3 rounded-lg border hover:border-smc-500 hover:bg-smc-50 transition-all flex justify-between items-center">
                  <div><div className="font-medium text-sm">{c.name}</div><div className="text-xs text-gray-500">{getCourse(c.courseId || c.course_id)?.name} • {(c.student_ids || c._enrollments || []).length}/{c.max_students || 20} HV</div></div>
                  <UserPlus className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
