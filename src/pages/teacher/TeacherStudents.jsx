import { useState, useEffect, useCallback } from 'react';
import { Users, School, TrendingUp, Plane, X, Search } from 'lucide-react';
import * as api from '../../data/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [studentFlyLogs, setStudentFlyLogs] = useState([]);
  const [studentExamResults, setStudentExamResults] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classesRes, usersRes] = await Promise.all([
        api.getClasses(),
        api.getUsers({ role: 'STUDENT' }),
      ]);
      const allClasses = classesRes.data || classesRes.classes || [];
      const allUsers = usersRes.data || usersRes.users || [];

      const myClasses = allClasses.filter(c => {
        const teacherIds = c.teacher_ids || c.teacherIds || [];
        return teacherIds.includes(user?.id) || teacherIds.includes(String(user?.id));
      });

      setClasses(myClasses);

      const myStudentIds = new Set();
      myClasses.forEach(c => {
        const studentIds = c.student_ids || c.studentIds || [];
        studentIds.forEach(id => myStudentIds.add(String(id)));
      });

      const myStudents = allUsers.filter(s => myStudentIds.has(String(s.id)));
      setStudents(myStudents);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách học viên.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getClassName = (student) => {
    for (const c of classes) {
      const ids = (c.student_ids || c.studentIds || []).map(String);
      if (ids.includes(String(student.id))) {
        return c.name || c.class_name;
      }
    }
    return '-';
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = !search || (s.fullName || s.full_name || s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (!filterClass) return true;
    const className = getClassName(s);
    return className === filterClass;
  });

  const openDetailModal = async (student) => {
    setSelectedStudent(student);
    setStudentFlyLogs([]);
    setStudentExamResults([]);
    setDetailModalOpen(true);
    try {
      const [flyRes, examRes] = await Promise.all([
        api.getFlyLogs({ student_id: student.id }),
        api.getExamResults({ student_id: student.id }),
      ]);
      setStudentFlyLogs(flyRes.data || flyRes.flyLogs || []);
      setStudentExamResults(examRes.data || examRes.results || []);
    } catch {
      // ignore
    }
  };

  const totalFlyHours = studentFlyLogs.reduce((sum, log) => sum + (Number(log.hours || log.flight_hours) || 0), 0);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  const classOptions = [...new Set(students.map(s => getClassName(s)))].filter(Boolean);

  return (
    <div className="page-container">
      <PageHeader title="Học viên của tôi" subtitle="Danh sách học viên trong các lớp bạn phụ trách" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm kiếm học viên..." />
        </div>
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="input-field sm:max-w-[200px]"
        >
          <option value="">Tất cả lớp</option>
          {classOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || filterClass ? 'Không tìm thấy học viên' : 'Chưa có học viên nào'}
          description={search || filterClass ? 'Thử lại với bộ lọc khác.' : 'Lớp của bạn chưa có học viên.'}
        />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Lớp</th>
                  <th>Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-smc-100 flex items-center justify-center text-sm font-bold text-smc-600">
                          {(s.fullName || s.full_name || s.name || 'H').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{s.fullName || s.full_name || s.name}</p>
                          <p className="text-xs text-gray-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-500">{getClassName(s)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                          <div
                            className="bg-smc-500 h-2 rounded-full"
                            style={{ width: `${s.progress || s.training_progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{s.progress || s.training_progress || 0}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'ACTIVE' || s.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {s.status === 'ACTIVE' || s.status === 'active' ? 'Hoạt động' : s.status || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openDetailModal(s)}
                        className="btn-ghost btn-sm text-smc-600 hover:bg-smc-50"
                      >
                        <Search className="w-4 h-4 mr-1" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Chi tiết học viên"
        size="lg"
      >
        {selectedStudent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-full bg-smc-100 flex items-center justify-center text-xl font-bold text-smc-600">
                {(selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name || 'H').charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selectedStudent.fullName || selectedStudent.full_name || selectedStudent.name}</h3>
                <p className="text-sm text-gray-500">{selectedStudent.email}</p>
                <p className="text-sm text-gray-500">{selectedStudent.phone || 'Chưa có SĐT'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card text-center">
                <div className="text-2xl font-bold text-smc-600">{selectedStudent.progress || selectedStudent.training_progress || 0}%</div>
                <div className="text-xs text-gray-500 mt-1">Tiến độ đào tạo</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-green-600">{totalFlyHours}</div>
                <div className="text-xs text-gray-500 mt-1">Tổng giờ bay</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-orange-600">{studentExamResults.length}</div>
                <div className="text-xs text-gray-500 mt-1">Bài thi đã làm</div>
              </div>
            </div>

            {studentExamResults.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">Kết quả thi</h4>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Đề thi</th>
                        <th>Điểm</th>
                        <th>Kết quả</th>
                        <th>Ngày thi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentExamResults.map((r, idx) => (
                        <tr key={r.id || idx}>
                          <td className="text-sm">{r.exam_name || r.examName || '-'}</td>
                          <td className="text-sm font-semibold">{r.score ?? r.total_score ?? '-'}</td>
                          <td>
                            <span className={`badge ${(r.score ?? r.total_score) >= (r.pass_score || r.passScore || 70) ? 'badge-success' : 'badge-danger'}`}>
                              {(r.score ?? r.total_score) >= (r.pass_score || r.passScore || 70) ? 'Đậu' : 'Trượt'}
                            </span>
                          </td>
                          <td className="text-sm text-gray-500">{r.date || r.exam_date || r.created_at || r.createdAt || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {studentFlyLogs.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">Nhật ký bay</h4>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Giờ bay</th>
                        <th>Loại bay</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentFlyLogs.slice(0, 5).map((log, idx) => (
                        <tr key={log.id || idx}>
                          <td className="text-sm">{log.date || log.log_date || '-'}</td>
                          <td className="text-sm font-medium">{log.hours || log.flight_hours || 0} giờ</td>
                          <td><span className="badge badge-info">{log.type || log.flight_type || '-'}</span></td>
                          <td className="text-sm text-gray-500">{log.note || log.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {studentFlyLogs.length > 5 && (
                  <p className="text-xs text-gray-400 mt-2">Hiển thị 5/{studentFlyLogs.length} bản ghi</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
