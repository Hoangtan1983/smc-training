import { useAuth } from '../../context/AuthContext';
import { Plus, FileText, Award } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiGetCertifications, apiGetCourses } from '../../data/api';

export default function AdminCertificates() {
  const [certs, setCerts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getAllUsers } = useAuth();
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [certData, courseData] = await Promise.all([
          apiGetCertifications().catch(() => []),
          apiGetCourses().catch(() => []),
        ]);
        setCerts(Array.isArray(certData) ? certData : []);
        setCourses(Array.isArray(courseData) ? courseData : []);
      } catch {}
      try {
        const data = await getAllUsers();
        setStudents(data.filter(u => u.role === 'STUDENT'));
      } catch {}
      setLoading(false);
    };
    loadAll();
  }, []);

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-extrabold text-gray-900">Quản lý chứng chỉ</h1><p className="text-sm text-gray-500 mt-0.5">{certs.length} chứng chỉ</p></div><button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Cấp chứng chỉ mới</button></div>

      {certs.length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><Award className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có chứng chỉ nào được cấp</p><p className="text-sm mt-1">Chứng chỉ sẽ được hiển thị ở đây sau khi học viên hoàn thành khóa học</p></div>
      ) : (
        <div className="space-y-4">
          {certs.map(c => {
            const student = students.find(s => s.id === c.student_id);
            const course = courses.find(co => co.id === c.course_id);
            return (
              <div key={c.id} className="card p-6"><div className="flex justify-between items-start"><div className="flex items-start gap-4"><div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><FileText className="w-5 h-5 text-green-500" /></div><div><h3 className="font-bold text-gray-900">{student?.fullName || '—'}</h3><p className="text-xs text-gray-500">{course?.name || '—'}</p><p className="text-xs text-gray-400 mt-1">Số: {c.cert_number} • Cấp: {c.issue_date} • Hết hạn: {c.expiry_date}</p></div></div><span className={`badge ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{c.status === 'active' ? 'Hiệu lực' : c.status === 'expired' ? 'Hết hạn' : 'Đã thu hồi'}</span></div></div>
            );
          })}
        </div>
      )}
    </div>
  );
}
