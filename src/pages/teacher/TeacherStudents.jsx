import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, CheckCircle, XCircle, Clock, FileText, ChevronDown, ChevronUp, Play, Flag, Award } from 'lucide-react';
import ExpandableDataTable from '../../components/ExpandableDataTable';
import { onDataChange, apiGetClasses, apiGetCourses, apiGetEnrollments } from '../../data/api';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  enrollment: '📝 Nhập học',
  theory: '📚 Lý thuyết',
  practice: '🚁 Thực hành',
  exam: '📋 Thi',
  certification: '🏅 Chứng chỉ',
};

const STAGE_ORDER = ['enrollment', 'theory', 'practice', 'exam', 'certification'];

const STAGE_COLORS = {
  completed: 'bg-green-100 text-green-700 border-green-300',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
  pending: 'bg-gray-100 text-gray-400 border-gray-200',
};

export default function TeacherStudents() {
  const { user, getAllUsers } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudents, setExpandedStudents] = useState({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [userData, clsData, coursesData, enrData] = await Promise.all([
        getAllUsers(),
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
        apiGetEnrollments().catch(() => []),
      ]);
      const allStudents = userData.filter(u => u.role === 'STUDENT');
      setStudents(allStudents);
      setClasses(Array.isArray(clsData) ? clsData : []);
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
    } catch (e) {
      console.error('TeacherStudents loadAll error:', e);
    }
    setLoading(false);
  };

  const handleUpdateStage = async (studentId, stage, status) => {
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/auth.php?action=update-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId, stage, status }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(data.message || `Đã cập nhật ${stage} → ${status}`);
      await loadAll();
    } catch (e) {
      toast.error(e.message || 'Lỗi cập nhật stage');
    }
  };

  const getEnrollment = (studentId) => enrollments.find(e => e.student_id === studentId);

  const myClasses = classes.filter(c => (c.teacher_ids || []).includes(user?.id));
  const studentIds = [...new Set(myClasses.flatMap(c => c.student_ids || []))];
  const myStudents = students.filter(s => studentIds.includes(s.id));

  const getStudentClass = (studentId) => {
    return myClasses.find(c => (c.student_ids || []).includes(studentId));
  };

  const getStudentCourseName = (studentId) => {
    const cls = getStudentClass(studentId);
    if (!cls?.course_id) return '';
    const fromCourse = courses.find(c => c.id === cls.course_id);
    if (fromCourse) return fromCourse.name;
    const enr = enrollments.find(e => e.student_id === studentId);
    if (enr?.course_name) return enr.course_name;
    const fromEnr = courses.find(c => c.id === enr?.course_id);
    return fromEnr?.name || '';
  };

  const toggleExpanded = (id) => {
    setExpandedStudents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns = [
    {
      key: 'student', label: 'Học viên',
      render: (s) => {
        const cls = getStudentClass(s.id);
        const courseName = getStudentCourseName(s.id);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
              {s.fullName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{s.fullName}</div>
              <div className="text-xs text-gray-400">{s.email}</div>
              {courseName && <div className="text-xs text-blue-600">{courseName}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'class', label: 'Lớp',
      render: (s) => {
        const cls = getStudentClass(s.id);
        return <span className="text-sm text-gray-700">{cls?.name || '—'}</span>;
      },
    },
    {
      key: 'stage_progress', label: 'Tiến độ',
      render: (s) => {
        const enr = getEnrollment(s.id);
        const stages = enr?.stages || {};
        const completed = STAGE_ORDER.filter(st => (stages[st]?.status || '') === 'completed').length;
        const total = STAGE_ORDER.length;
        const pct = total > 0 ? Math.round(completed / total * 100) : 0;
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${pct}%`,
                background: pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
              }} />
            </div>
            <span className="text-xs font-bold text-gray-600">{completed}/{total}</span>
          </div>
        );
      },
    },
    {
      key: 'phone', label: 'SĐT',
      render: (s) => <span className="text-sm text-gray-500">{s.phone || '—'}</span>,
    },
    {
      key: 'status', label: 'Trạng thái',
      render: (s) => (
        <span className={`badge text-xs ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {s.status === 'ACTIVE' ? 'Đang học' : 'Đã khóa'}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Học viên</h1>
        <p className="text-sm text-gray-500 mt-0.5">{myStudents.length} học viên trong các lớp của tôi</p>
      </div>

      <ExpandableDataTable
        data={myStudents}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ dateFilter: true, dateField: 'createdAt' }}
        emptyIcon={FileText}
        emptyText="Chưa có học viên nào trong lớp của bạn"
        renderExpanded={(s) => {
          const cls = getStudentClass(s.id);
          const courseName = getStudentCourseName(s.id);
          const enr = getEnrollment(s.id);
          const stages = enr?.stages || {};
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-medium text-gray-900">{s.fullName}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{s.email}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{s.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Lớp</p><p className="text-sm font-medium text-blue-700">{cls?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Khóa học</p><p className="text-sm font-medium text-purple-700">{courseName || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Trạng thái</p><span className={`text-sm font-medium ${s.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>{s.status === 'ACTIVE' ? 'Đang học' : 'Đã khóa'}</span></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Ngày tham gia</p><p className="text-sm text-gray-700">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Địa chỉ</p><p className="text-sm text-gray-700">{s.address || '—'}</p></div>
              </div>

              {/* ═══ STAGE PROGRESS ═══ */}
              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-3">📊 Cập nhật tiến độ đào tạo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {STAGE_ORDER.map(stage => {
                    const st = stages[stage] || { status: 'pending' };
                    const isCompleted = st.status === 'completed';
                    const isInProgress = st.status === 'in_progress';
                    const badgeColor = STAGE_COLORS[st.status] || STAGE_COLORS.pending;
                    return (
                      <div key={stage} className={`border rounded-lg p-3 text-center ${badgeColor}`}>
                        <div className="text-sm font-semibold mb-2">{STAGE_LABELS[stage]}</div>
                        <div className="text-xs mb-2">
                          {isCompleted ? '✅ Hoàn thành' : isInProgress ? '🔄 Đang làm' : '⬜ Chưa làm'}
                        </div>
                        {!isCompleted && (
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleUpdateStage(s.id, stage, 'in_progress')}
                              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${isInProgress ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'}`}
                              title="Bắt đầu"
                            >
                              ▶ Bắt đầu
                            </button>
                            {isInProgress && (
                              <button
                                onClick={() => handleUpdateStage(s.id, stage, 'completed')}
                                className="px-2 py-1 text-xs rounded font-medium bg-green-500 text-white hover:bg-green-600"
                                title="Hoàn thành"
                              >
                                ✅ Xong
                              </button>
                            )}
                          </div>
                        )}
                        {isCompleted && st.completed_at && (
                          <div className="text-xs text-green-600 mt-1">
                            {new Date(st.completed_at).toLocaleDateString('vi-VN')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
