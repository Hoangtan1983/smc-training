import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiUpdateEnrollment, apiGetUsers, apiGetClasses, onDataChange } from '../../data/api';
import { FileCheck, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffEnrollment() {
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [enrData, userData, classData] = await Promise.all([
        apiGetEnrollments().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetClasses().catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      setStudents(users.filter(u => u.role === 'STUDENT'));
      setClasses(Array.isArray(classData) ? classData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // ── Subscribe to data changes từ các trang khác ──
  useEffect(() => {
    return onDataChange('enrollments', () => { loadAll(); });
  }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'enrollments' || detail?.changed === 'users' || detail?.changed === 'classes' || detail?.changed === 'tuitions') {
        loadAll();
      }
    });
  }, []);

  const handleApprove = async (enrollmentId) => {
    try {
      await apiUpdateEnrollment(enrollmentId, { status: 'active', training_stages: { enrollment: { status: 'completed', completed_at: new Date().toISOString(), confirmed_by: 'staff' } } });
      toast.success('Đã duyệt hồ sơ!');
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Tuyển sinh</h1><p className="text-sm text-gray-500 mt-0.5">Duyệt hồ sơ, xác nhận học phí</p></div>
      <div className="space-y-4">
        {enrollments.map(enr => {
          const student = students.find(s => s.id === enr.student_id);
          const cls = classes.find(c => c.id === enr.class_id);
          return (
            <div key={enr.student_id} className="card p-6">
              <div className="flex justify-between items-start">
                <div><h3 className="font-bold text-gray-900">{student?.fullName || enr.student_id}</h3><p className="text-sm text-gray-500">Lớp: {cls?.name || '—'}</p></div>
                <span className={`badge text-xs ${enr.status === 'active' ? 'bg-green-100 text-green-700' : enr.status === 'pending' ? 'bg-amber-100 text-amber-700' : enr.status === 'frozen' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{enr.status === 'active' ? 'Đã duyệt' : enr.status === 'pending' ? 'Chờ duyệt' : enr.status === 'frozen' ? 'Đã khóa' : enr.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                <div><span className="text-gray-400">CMND/CCCD:</span> <span className={enr.documents?.id_card?.status === 'verified' ? 'text-green-600 font-medium' : 'text-amber-600'}>{enr.documents?.id_card?.status || 'Chưa nộp'}</span></div>
                <div><span className="text-gray-400">Sức khỏe:</span> <span className={enr.documents?.health_cert?.status === 'verified' ? 'text-green-600 font-medium' : 'text-amber-600'}>{enr.documents?.health_cert?.status || 'Chưa nộp'}</span></div>
                <div><span className="text-gray-400">Học phí:</span> <span className={enr.payment?.status === 'paid' ? 'text-green-600 font-medium' : 'text-red-500'}>{enr.payment?.amount?.toLocaleString('vi-VN')} VNĐ — {enr.payment?.status === 'paid' ? 'Đã TT' : 'Chưa TT'}</span></div>
              </div>
              {enr.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleApprove(enr.id)} className="btn-primary text-xs px-4 py-2 flex items-center gap-1"><Check className="w-4 h-4" /> Duyệt hồ sơ</button>
                  <button onClick={async () => {
                    if (!window.confirm(`Bạn có chắc muốn từ chối hồ sơ của ${student?.fullName || 'học viên này'}?`)) return;
                    try {
                      await apiUpdateEnrollment(enr.id, { status: 'cancelled', training_stages: { enrollment: { status: 'rejected', completed_at: new Date().toISOString(), confirmed_by: 'staff' } } });
                      toast.success('Đã từ chối hồ sơ!');
                      await loadAll();
                    } catch (err) {
                      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
                    }
                  }} className="btn-ghost text-xs px-4 py-2 text-red-500 flex items-center gap-1"><X className="w-4 h-4" /> Từ chối</button>
                </div>
              )}
            </div>
          );
        })}
        {enrollments.length === 0 && <div className="text-center py-12 text-gray-400"><FileCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />Không có hồ sơ nào</div>}
      </div>
    </div>
  );
}
