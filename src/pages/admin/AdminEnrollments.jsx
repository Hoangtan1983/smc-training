import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiUpdateEnrollment, apiGetClasses, apiGetCourses, onDataChange, emitDataChange } from '../../data/api';
import { Check, X, Search, FileCheck, School, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminEnrollments() {
  const { getAllUsers } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);

  const loadAll = async () => {
    try {
      const [enrData, classData, courseData] = await Promise.all([
        apiGetEnrollments().catch(() => []),
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
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

  const handleApprove = async (studentId) => {
    try {
      await apiUpdateEnrollment(studentId, {
        status: 'active',
        stages: { enrollment: { status: 'completed', completed_at: new Date().toISOString(), confirmed_by: 'admin' } }
      });
      toast.success('Đã duyệt hồ sơ!');
      emitDataChange('enrollments', { action: 'approved', studentId });
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const handleReject = async (studentId) => {
    try {
      await apiUpdateEnrollment(studentId, { status: 'rejected' });
      toast.success('Đã từ chối hồ sơ.');
      emitDataChange('enrollments', { action: 'rejected', studentId });
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

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  const filtered = enrollments.filter(e => {
    const s = getStudent(e.student_id || e.studentId);
    return s?.fullName?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Quản lý Tuyển sinh</h1><p className="text-sm text-gray-500 mt-0.5">{enrollments.length} hồ sơ</p></div>
      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm học viên..." /></div>
      <div className="space-y-4">
        {filtered.map(enr => {
          const sid = enr.student_id || enr.studentId;
          const s = getStudent(sid);
          const cls = getClass(enr.class_id || enr.classId);
          const courseId = cls?.courseId || cls?.course_id || enr.course_id;
          const course = getCourse(courseId);
          return (
            <div key={sid} className="card p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-900">{s?.fullName || sid}</h3>
                  <p className="text-sm text-gray-500">{s?.email} • Lớp: {cls?.name || '—'} • Khóa: {course?.name || '—'}</p>
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
                <div><span className="text-gray-400">Học phí:</span> <span className={enr.payment?.status === 'paid' ? 'text-green-600 font-medium' : 'text-red-500'}>{enr.payment?.amount?.toLocaleString('vi-VN') || '0'} VNĐ — {enr.payment?.status === 'paid' ? 'Đã TT' : 'Chưa TT'}</span></div>
              </div>
              <div className="flex gap-2 mt-3">
                {enr.status !== 'active' && <button onClick={() => handleApprove(sid)} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Duyệt</button>}
                {enr.status !== 'rejected' && <button onClick={() => handleReject(sid)} className="btn-ghost text-xs px-3 py-1.5 text-red-500 flex items-center gap-1"><X className="w-3.5 h-3.5" /> Từ chối</button>}
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
    </div>
  );
}
