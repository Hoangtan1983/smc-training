import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetCourses, apiGetClasses } from '../../data/api';
import { loadData } from '../../data/store';
import { Users, BookOpen, School, Award, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { getAllUsers } = useAuth();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllUsers(),
      apiGetCourses().catch(() => []),
      apiGetClasses().catch(() => []),
    ]).then(([userData, coursesData, classesData]) => {
      setUsers(userData);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setLoading(false);
    });
  }, []);

  const certs = loadData('certifications', []);

  const stats = [
    { label: 'Tổng người dùng', value: users.length, icon: Users, color: 'blue' },
    { label: 'Khóa học đang mở', value: courses.filter(c => c.status === 'active').length, icon: BookOpen, color: 'emerald' },
    { label: 'Lớp học đang hoạt động', value: classes.filter(c => c.status === 'active').length, icon: School, color: 'amber' },
    { label: 'Học viên', value: users.filter(u => u.role === 'STUDENT').length, icon: Award, color: 'purple' },
    { label: 'Chứng chỉ đã cấp', value: certs.filter(c => c.status === 'active').length, icon: TrendingUp, color: 'green' },
    { label: 'Giáo viên', value: users.filter(u => u.role === 'TEACHER').length, icon: Users, color: 'cyan' },
  ];

  const colorMap = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', purple: 'bg-purple-50 text-purple-600', green: 'bg-green-50 text-green-600', cyan: 'bg-cyan-50 text-cyan-600' };

  const recentUsers = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const roleMap = { ADMIN: 'badge-admin', STAFF: 'badge-staff', TEACHER: 'badge-instructor', STUDENT: 'badge-student' };

  return (
    <div className="animate-fade-in">
      <div className="mb-8"><h1 className="text-2xl font-extrabold text-gray-900">Tổng quan hệ thống</h1><p className="text-sm text-gray-500 mt-1">Trung tâm Đào tạo Ứng dụng Công nghệ SMC — Mã số DN: 0315541034-001</p></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="card p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500 font-medium">{s.label}</p><p className="text-3xl font-extrabold text-gray-900 mt-0.5">{s.value}</p></div><div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorMap[s.color]}`}><s.icon className="w-5 h-5" /></div></div></div>
        ))}
      </div>

      <div className="card"><div className="px-6 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Người dùng mới nhất</h2></div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-100"><th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Người dùng</th><th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Email</th><th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Vai trò</th><th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">Ngày tạo</th></tr></thead><tbody>
          {recentUsers.map(u => (
            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-6 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{u.fullName?.charAt(0)?.toUpperCase()}</div><span className="text-sm font-medium text-gray-900">{u.fullName}</span></div></td>
              <td className="px-6 py-3 text-sm text-gray-500">{u.email}</td>
              <td className="px-6 py-3"><span className={`badge ${roleMap[u.role] || 'badge-student'}`}>{u.role}</span></td>
              <td className="px-6 py-3 text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
    </div>
  );
}
