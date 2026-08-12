import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiCreateClass, apiUpdateClass, apiDeleteClass, apiGetTuitions, apiUpdateTuitionStep, apiGetUsers, apiGetCourses, apiAssignClass, emitDataChange, onDataChange } from '../../data/api';
import {
  School, Users, Search, Plus, Edit2, Trash2, UserPlus, UserCheck,
  GraduationCap, Calendar, MapPin, Clock, BookOpen, ArrowRight, AlertTriangle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StaffClasses() {
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [tuitions, setTuitions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', course_id: '', teacher_ids: [], max_students: 20,
    start_date: '', end_date: '', schedule: [], location: '', type: 'offline', rank: 'A'
  });

  // Add student modal
  const [showAddStudent, setShowAddStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Teacher multiselect dropdown
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);
  const teacherDropdownRef = useRef(null);
  const [teacherSearchText, setTeacherSearchText] = useState('');

  useEffect(() => { loadData_(); }, []);

  // ── Subscribe to data changes từ các trang khác ──
  useEffect(() => {
    return onDataChange('classes', () => { loadData_(); });
  }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'classes' || detail?.changed === 'enrollments' || detail?.changed === 'users') {
        loadData_();
      }
    });
  }, []);

  const loadData_ = async () => {
    try {
      const [classData, courseData, tuitionData, userData] = await Promise.all([
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
        apiGetTuitions().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
      ]);
      setClasses(Array.isArray(classData) ? classData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
      setTuitions(Array.isArray(tuitionData) ? tuitionData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      setAllStudents(users.filter(u => u.role === 'STUDENT'));
      setTeachers(users.filter(u => u.role === 'TEACHER'));
    } catch {}
    setLoading(false);
  };

  // ─── Tạo / Sửa lớp ───
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.course_id) return toast.error('Vui lòng nhập tên lớp và chọn khóa học');

    try {
      if (editing) {
        await apiUpdateClass(editing, form);
        toast.success('Đã cập nhật lớp');
      } else {
        const newClass = {
          ...form, student_ids: [],
          status: 'active', createdAt: new Date().toISOString()
        };
        await apiCreateClass(newClass);
        toast.success('Đã tạo lớp mới');
      }
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
    emitDataChange('classes', { action: editing ? 'updated' : 'created' });
    setShowForm(false); setEditing(null);
    setForm({ name: '', course_id: '', teacher_ids: [], max_students: 20, start_date: '', end_date: '', schedule: [], location: '', type: 'offline', rank: 'A' });
    setTeacherSearchText('');
    loadData_();
  };

  const handleEdit = (cls) => {
    setEditing(cls.id);
    setForm({
      name: cls.name, course_id: cls.course_id, teacher_ids: cls.teacher_ids || [],
      max_students: cls.max_students || 20, start_date: cls.start_date || '',
      end_date: cls.end_date || '', schedule: cls.schedule || [],
      location: cls.location || '', type: cls.type || 'offline'
    });
    setTeacherSearchText('');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa lớp này?')) return;
    try {
      await apiDeleteClass(id);
      toast.success('Đã xóa lớp');
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
    emitDataChange('classes', { action: 'deleted', id });
    loadData_();
  };

  // ─── Xếp học viên vào lớp ───
  const handleAddStudent = async (classId, studentId) => {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    const studentIds = [...(cls.student_ids || [])];

    if (studentIds.includes(studentId)) return toast.error('Học viên đã có trong lớp này');
    if (studentIds.length >= (cls.max_students || 20)) return toast.error('Lớp đã đầy');

    // Kiểm tra tương thích hạng: học viên đăng ký BVLOS không thể xếp vào lớp VLOS và ngược lại
    const student = allStudents.find(s => s.id === studentId);
    if (student) {
      const classRank = cls.rank || '';
      const classCourseId = cls.course_id || '';
      const studentRank = student.rank || '';
      const studentCourseId = student.courseId || '';

      // Xác định hạng thực tế của lớp và học viên dựa trên rank + course_id
      const getEffectiveRank = (rank, courseId) => {
        if (rank === 'A' || rank === 'B') return rank;
        if (courseId === 'c001') return 'A';
        if (courseId === 'c002' || courseId === 'c003') return 'B';
        return '';
      };
      const classEffectiveRank = getEffectiveRank(classRank, classCourseId);
      const studentEffectiveRank = getEffectiveRank(studentRank, studentCourseId);

      if (classEffectiveRank && studentEffectiveRank && classEffectiveRank !== studentEffectiveRank) {
        return toast.error(`Không thể xếp: học viên đăng ký hạng ${studentEffectiveRank} (${studentEffectiveRank === 'A' ? 'VLOS' : 'BVLOS'}) vào lớp hạng ${classEffectiveRank} (${classEffectiveRank === 'A' ? 'VLOS' : 'BVLOS'})`);
      }
    }

    // Dùng apiAssignClass để server tự động gỡ khỏi lớp cũ + cập nhật enrollment + tuition
    try {
      // Tìm lớp cũ của học viên (nếu có) từ dữ liệu classes để truyền oldClassId
      const oldClass = classes.find(c => (c.student_ids || []).includes(studentId));
      await apiAssignClass(studentId, classId, oldClass?.id || '');
    } catch (e) {
      console.error('Lỗi xếp lớp:', e);
      toast.error('Không thể xếp học viên vào lớp: ' + (e.message || ''));
      return;
    }

    toast.success('Đã xếp học viên vào lớp');
    emitDataChange('classes', { action: 'student_added', id: classId, studentId });
    emitDataChange('enrollments', { action: 'updated', studentId });
    loadData_();
    setShowAddStudent(null);
  };

  // ─── Phân công Giảng viên ───
  const handleAssignTeachers = async (classId, teacherIds) => {
    try { await apiUpdateClass(classId, { teacher_ids: teacherIds }); } catch {}

    const cls = classes.find(c => c.id === classId);
    const promises = (cls?.student_ids || []).map(async sid => {
      try { await apiUpdateTuitionStep({ studentId: sid, step: 'assigned', status: 'paid', extra: { teacherIds } }); } catch {}
    });
    await Promise.all(promises).catch(() => {});

    const names = teacherIds.map(tid => teachers.find(t => t.id === tid)?.fullName || tid).join(', ');
    toast.success(`Đã phân công giảng viên: ${names || 'Chưa có'}`);
    emitDataChange('classes', { action: 'teacher_updated', id: classId });
    loadData_();
  };

  // ─── Lấy danh sách HV đủ điều kiện xếp lớp (ACTIVE + paid + tương thích hạng + chưa có lớp) ───
  const getEligibleStudents = (classId) => {
    const cls = classes.find(c => c.id === classId);
    const getEffectiveRank = (rank, courseId) => {
      if (rank === 'A' || rank === 'B') return rank;
      if (courseId === 'c001') return 'A';
      if (courseId === 'c002' || courseId === 'c003') return 'B';
      return '';
    };
    const classEffectiveRank = cls ? getEffectiveRank(cls.rank || '', cls.course_id || '') : '';

    // Tập hợp tất cả học viên đã có trong lớp nào đó (để loại khỏi danh sách xếp lớp)
    const studentsInAnyClass = new Set();
    classes.forEach(c => {
      (c.student_ids || []).forEach(sid => studentsInAnyClass.add(sid));
    });

    return allStudents.filter(s => {
      const t = tuitions.find(x => x.studentId === s.id);
      if (!(s.status === 'ACTIVE' && t && (t.status === 'paid' || t.step === 'active' || t.step === 'enrolled' || t.step === 'assigned'))) return false;

      // Loại bỏ học viên đã được xếp vào lớp (bất kỳ lớp nào)
      if (studentsInAnyClass.has(s.id)) return false;

      // Lọc theo hạng: chỉ hiển thị học viên có hạng tương thích với lớp
      if (classEffectiveRank) {
        const studentEffectiveRank = getEffectiveRank(s.rank || '', s.courseId || '');
        if (studentEffectiveRank && studentEffectiveRank !== classEffectiveRank) return false;
      }
      return true;
    });
  };

  // ─── Render ───
  const filtered = classes.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getCourseName = (id) => courses.find(c => c.id === id)?.name || '—';
  const getTeacherNames = (ids) => {
    if (!ids || ids.length === 0) return 'Chưa phân công';
    return ids.map(id => teachers.find(t => t.id === id)?.fullName || id).join(', ');
  };
  const getStudentName = (id) => allStudents.find(s => s.id === id)?.fullName || 'Unknown';

  // Multi-select teacher helpers
  const toggleTeacher = (tid) => {
    const current = form.teacher_ids || [];
    if (current.includes(tid)) {
      setForm({ ...form, teacher_ids: current.filter(id => id !== tid) });
    } else {
      setForm({ ...form, teacher_ids: [...current, tid] });
    }
  };

  const filteredTeachers = teachers.filter(t =>
    (t.fullName || '').toLowerCase().includes(teacherSearchText.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(teacherSearchText.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý Lớp học</h1>
          <p className="text-sm text-gray-500 mt-0.5">{classes.length} lớp — B5: Xếp lớp & B6: Phân công GV</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', course_id: '', teacher_ids: [], max_students: 20, start_date: '', end_date: '', schedule: [], location: '', type: 'offline' }); setTeacherSearchText(''); setShowForm(true); }}
          className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tạo lớp mới
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm lớp học..." />
      </div>

      {/* Class Cards */}
      <div className="space-y-4">
        {filtered.map(cls => {
          const studentCount = (cls.student_ids || []).length;
          const isFull = studentCount >= (cls.max_students || 20);

          return (
            <div key={cls.id} className="card p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                      <School className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{cls.name} <span className="text-xs font-normal text-gray-500">— Hạng {cls.rank || 'A'}</span></h3>
                      <p className="text-sm text-gray-500">{getCourseName(cls.course_id)}</p>
                    </div>
                    <span className={`badge text-xs ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {studentCount}/{cls.max_students} {isFull ? '(Đầy)' : ''}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" /> GV: {getTeacherNames(cls.teacher_ids)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {cls.start_date ? new Date(cls.start_date).toLocaleDateString('vi-VN') : '—'}
                      {' → '}
                      {cls.end_date ? new Date(cls.end_date).toLocaleDateString('vi-VN') : '—'}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {cls.location || cls.type === 'online' ? 'Online' : 'SMC Center'}
                    </div>
                  </div>

                  {/* Student list */}
                  {(cls.student_ids || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(cls.student_ids || []).map(sid => (
                        <span key={sid} className="badge bg-blue-50 text-blue-700 text-xs flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {getStudentName(sid)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {/* Multi-select Teacher */}
                  <div className="relative" ref={teacherDropdownRef}>
                    <button
                      onClick={() => setTeacherDropdownOpen(teacherDropdownOpen === cls.id ? null : cls.id)}
                      className="text-xs border rounded-lg px-2 py-1.5 bg-white min-w-[130px] text-left flex items-center justify-between"
                    >
                      <span className="truncate">
                        {(cls.teacher_ids || []).length > 0
                          ? `${(cls.teacher_ids || []).length} giảng viên`
                          : 'Chọn GV...'}
                      </span>
                      <span className="ml-1 text-gray-400">▼</span>
                    </button>
                    {teacherDropdownOpen === cls.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-30 w-60 max-h-48 overflow-y-auto">
                        {teachers.map(t => {
                          const selected = (cls.teacher_ids || []).includes(t.id);
                          return (
                            <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {
                                  const newIds = selected
                                    ? (cls.teacher_ids || []).filter(id => id !== t.id)
                                    : [...(cls.teacher_ids || []), t.id];
                                  handleAssignTeachers(cls.id, newIds);
                                }}
                                className="rounded"
                              />
                              {t.fullName}
                            </label>
                          );
                        })}
                      </div>
                    )}

                  <button onClick={() => setShowAddStudent(cls.id)}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> Xếp HV
                  </button>

                  <button onClick={() => handleEdit(cls)} className="btn-ghost p-1.5"><Edit2 className="w-4 h-4 text-gray-400" /></button>
                  <button onClick={() => handleDelete(cls.id)} className="btn-ghost p-1.5"><Trash2 className="w-4 h-4 text-gray-400" /></button>
                </div>
              </div>
            </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <School className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>Chưa có lớp học nào</p>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      {showAddStudent && (() => {
        const eligible = getEligibleStudents(showAddStudent);
        const cls = classes.find(c => c.id === showAddStudent);
        const existingIds = cls?.student_ids || [];
        const available = eligible.filter(s => !existingIds.includes(s.id));
        const filtered2 = available.filter(s =>
          (s.fullName || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
          (s.email || '').toLowerCase().includes(studentSearch.toLowerCase())
        );

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Xếp học viên vào lớp: {cls?.name}</h3>
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  className="input-field pl-9" placeholder="Tìm học viên..." />
              </div>

              {filtered2.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Không có học viên đủ điều kiện</p>
                  <p className="text-xs mt-1">Học viên cần ACTIVE + Đã đóng học phí</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered2.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-blue-50/30">
                      <div>
                        <div className="font-medium text-sm">{s.fullName}</div>
                        <div className="text-xs text-gray-500">{s.email}</div>
                      </div>
                      <button onClick={() => handleAddStudent(showAddStudent, s.id)}
                        className="btn-primary text-xs px-3 py-1.5">
                        <UserPlus className="w-3 h-3" /> Xếp vào lớp
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => { setShowAddStudent(null); setStudentSearch(''); }}
                className="btn-ghost w-full mt-4">Đóng</button>
            </div>
          </div>
        );
      })()}

      {/* Create/Edit Class Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Sửa lớp' : 'Tạo lớp mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input-field" placeholder="VD: UAV-A-K02" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khóa học</label>
                <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}
                  className="input-field" required>
                  <option value="">Chọn khóa học...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {/* Hiển thị các lớp hiện có cùng khóa đang chọn */}
                {form.course_id && (() => {
                  const existingClasses = classes.filter(c => c.course_id === form.course_id && c.id !== editing);
                  return (
                    <div className="mt-1.5">
                      {existingClasses.length > 0 ? (
                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-500">Các lớp hiện có ({existingClasses.length}):</p>
                          {existingClasses.map(c => (
                            <span key={c.id} className="badge bg-amber-50 text-amber-700 text-xs mr-1">Hạng {c.rank || 'A'} — {c.name} ({(c.student_ids || []).length}/{c.max_students || 20})</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Chưa có lớp nào cho khóa này</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giảng viên phụ trách (chọn nhiều)
                </label>
                {/* Selected teacher badges */}
                {(form.teacher_ids || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(form.teacher_ids || []).map(tid => {
                      const t = teachers.find(tch => tch.id === tid);
                      return (
                        <span key={tid} className="badge bg-blue-100 text-blue-700 text-xs flex items-center gap-1">
                          {t?.fullName || tid}
                          <button type="button" onClick={() => toggleTeacher(tid)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="text"
                    value={teacherSearchText}
                    onChange={e => setTeacherSearchText(e.target.value)}
                    className="input-field"
                    placeholder="Tìm và chọn giảng viên..."
                  />
                  {teacherSearchText && filteredTeachers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                      {filteredTeachers.filter(t => !(form.teacher_ids || []).includes(t.id)).map(t => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => { toggleTeacher(t.id); setTeacherSearchText(''); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-sm"
                        >
                          {t.fullName} <span className="text-gray-400 text-xs">{t.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hạng</label>
                  <select value={form.rank || 'A'} onChange={e => setForm({ ...form, rank: e.target.value })} className="input-field">
                    <option value="A">Hạng A</option>
                    <option value="B">Hạng B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sĩ số tối đa</label>
                  <input type="number" value={form.max_students}
                    onChange={e => setForm({ ...form, max_students: parseInt(e.target.value) || 20 })}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="input-field">
                    <option value="offline">Offline</option>
                    <option value="online">Online (Zoom)</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa điểm</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="input-field" placeholder="VD: Phòng 101 - SMC Center" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Hủy</button>
                <button type="submit" className="btn-primary flex-1">{editing ? 'Cập nhật' : 'Tạo mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
