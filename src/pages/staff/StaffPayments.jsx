import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiUpdateEnrollment, apiGetUsers, apiGetCourses, apiGetClasses, apiRecordPayment, emitDataChange, onDataChange } from '../../data/api';
import { Search, Plus, Check, DollarSign, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffPayments() {
  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [agencies, setAgencies] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [enrData, userData, courseData, classData] = await Promise.all([
        apiGetEnrollments().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetCourses().catch(() => []),
        apiGetClasses().catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      setStudents(users.filter(u => u.role === 'STUDENT'));
      setCourses(Array.isArray(courseData) ? courseData : []);
      setClasses(Array.isArray(classData) ? classData : []);
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
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Đồng bộ liên tài khoản
  useEffect(() => {
    const unsub1 = onDataChange('enrollments', () => loadAll());
    const unsub2 = onDataChange('all', (d) => { if (['enrollments', 'users', 'courses', 'classes', 'tuitions'].includes(d?.changed)) loadAll(); });
    return () => { unsub1(); unsub2(); };
  }, [loadAll]);

  const handlePayment = async (studentId) => {
    try {
      const existingEnr = enrollments.find(e => (e.student_id || e.studentId) === studentId);
      const coursePrice = existingEnr?.payment?.amount || 15000000;
      const parsed = parseInt(payAmount);
      const amt = isNaN(parsed) ? coursePrice : parsed;

      // Chuyển từ apiProcessPayment (auth.php) → apiRecordPayment (tuition-service.php v3)
      const enrollmentId = existingEnr?.id;
      await apiRecordPayment({
        invoiceId: enrollmentId,   // tuition-service.php cần invoiceId = enrollment ID
        enrollmentId: enrollmentId,
        amount: amt,
        method: payMethod,
        note: 'Thanh toán ghi nhận bởi Nhân viên',
      });

      toast.success('Đã ghi nhận thanh toán!');
      emitDataChange('invoices', { action: 'paid', studentId });
      emitDataChange('all', { changed: 'invoices', action: 'paid' });
      setPayModal(null);
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối đến server'));
    }
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  const getAgencyForStudent = (studentId) => {
    const s = students.find(st => st.id === studentId);
    if (!s?.agencyId) return null;
    return agencies.find(a => a.id === s.agencyId) || null;
  };

  const filtered = enrollments.filter(e => {
    const studentId = e.student_id || e.studentId;
    const s = students.find(st => st.id === studentId);
    return s?.fullName?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Quản lý thanh toán</h1><p className="text-sm text-gray-500 mt-0.5">{enrollments.length} học viên</p></div>
      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm học viên..." /></div>

      <div className="card overflow-hidden"><table className="w-full"><thead><tr className="border-b bg-gray-50/50"><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Học viên</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Lớp</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Học phí</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Đã đóng</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Đại lý</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th><th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Thao tác</th></tr></thead><tbody>
        {filtered.map(enr => {
          const studentId = enr.student_id || enr.studentId;
          const s = students.find(st => st.id === studentId);
          const cls = classes.find(c => c.id === enr.class_id || c.id === enr.classId);
          const course = courses.find(c => c.id === cls?.courseId || c.id === cls?.course_id);
          const price = enr.payment?.amount || 0;
          const historyTotal = enr.payment?.history?.reduce((sum, p) => sum + p.amount, 0) || 0;
          const paid = enr.payment?.status === 'paid' ? price : historyTotal;
          return (
            <tr key={studentId} className="border-b hover:bg-gray-50/50">
              <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{s?.fullName?.charAt(0)?.toUpperCase()}</div><span className="text-sm font-medium">{s?.fullName || studentId}</span></div></td>
              <td className="px-4 py-3 text-sm text-gray-500">{cls?.name || '—'}</td>
              <td className="px-4 py-3 text-sm font-semibold">{price.toLocaleString('vi-VN')}</td>
              <td className="px-4 py-3 text-sm">{paid.toLocaleString('vi-VN')}</td>
              <td className="px-4 py-3">
                {(() => {
                  const agency = getAgencyForStudent(studentId);
                  if (!agency) return <span className="text-xs text-gray-400">—</span>;
                  return (
                    <span className="badge bg-orange-100 text-orange-700 text-xs flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {agency.name}
                    </span>
                  );
                })()}
              </td>
              <td className="px-4 py-3"><span className={`badge text-xs ${paid >= price ? 'bg-green-100 text-green-700' : paid > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{paid >= price ? 'Hoàn thành' : paid > 0 ? 'Một phần' : 'Chưa đóng'}</span></td>
              <td className="px-4 py-3 text-right"><button onClick={() => { setPayModal(enr); setPayAmount(Math.min(price - paid, price) > 0 ? String(Math.min(price - paid, price)) : '0'); }} disabled={paid >= price} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 ml-auto"><DollarSign className="w-3 h-3" /> Ghi nhận TT</button></td>
            </tr>
          );
        })}
        {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Không có dữ liệu</td></tr>}
      </tbody></table></div>

      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPayModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Ghi nhận thanh toán</h3>
            <p className="text-sm text-gray-500 mb-3">Học viên: {students.find(s => s.id === (payModal.student_id || payModal.studentId))?.fullName}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Số tiền (VNĐ)</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phương thức</label><select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field"><option value="bank_transfer">Chuyển khoản</option><option value="cash">Tiền mặt</option></select></div>
            </div>
            <div className="flex gap-3 mt-4"><button onClick={() => setPayModal(null)} className="btn-ghost flex-1">Hủy</button><button onClick={() => handlePayment(payModal.student_id || payModal.studentId)} className="btn-primary flex-1"><Check className="w-4 h-4 inline mr-1" />Xác nhận</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
