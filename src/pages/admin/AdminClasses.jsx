import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetClasses, apiGetCourses, apiUpdateClass, apiCreateClass, apiDeleteClass, apiGetUsers, apiGetRegistrations, onDataChange, emitDataChange } from '../../data/api';
import {
  Plus, Edit3, Trash2, X, Search, School, Users, Clock, GraduationCap,
  ChevronDown, ChevronUp, Download, Lock, Unlock, FileSpreadsheet,
  Mail, Phone, MapPin, CreditCard, User, Calendar, BookOpen
} from 'lucide-react';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';

// ── Helpers ──
const formatDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

// ── Xuất Excel định dạng .xlsx chuẩn (ExcelJS) ──
async function exportClassXLSX(cls, course, students, registrations, teachers) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN');
  const getReg = sid => registrations.find(r => r.studentId === sid || r.id === sid) || {};
  const teacherNames = (cls.teacher_ids || []).map(id => teachers.find(t => t.id === id)?.fullName || '').filter(Boolean).join(', ') || 'Chưa phân công';
  const classSize = `${students.length}/${cls.max_students || 20}`;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Danh sách lớp');

  // ── Định nghĩa cột ──
  ws.columns = [
    { width: 5 },   // STT
    { width: 28 },  // Họ và tên
    { width: 20 },  // CCCD/CMND
    { width: 45 },  // Địa chỉ
    { width: 18 },  // SĐT
    { width: 32 },  // Email
    { width: 22 },  // Hạng đăng ký
    { width: 22 },  // Ghi chú
  ];

  let rowIdx = 1;

  // Hàng trống
  ws.addRow([]);
  rowIdx++;

  // Công ty
  const rCompany = ws.addRow(['CHI NHÁNH CÔNG TY TNHH CÔNG NGHỆ SMARTCONNECT']);
  ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
  rCompany.getCell(1).font = { bold: true, size: 14 };
  rCompany.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  rowIdx++;

  // Trung tâm
  const rCenter = ws.addRow(['TRUNG TÂM ĐÀO TẠO ỨNG DỤNG CÔNG NGHỆ SMC']);
  ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
  rCenter.getCell(1).font = { bold: true, size: 14 };
  rCenter.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  rowIdx++;

  // Trống
  ws.addRow([]);
  rowIdx++;

  // Thông tin lớp
  const infoRows = [
    `KHÓA HỌC: ${course?.name || '—'} (${course?.code || ''})`,
    `LỚP HỌC: ${cls.name || ''} — HẠNG ${cls.rank || 'A'}`,
    `KHAI GIẢNG: ${formatDate(cls.start_date)}`,
    `BẾ GIẢNG: ${formatDate(cls.end_date)}`,
    `SĨ SỐ: ${classSize}`,
    `GIÁO VIÊN: ${teacherNames}`,
  ];

  infoRows.forEach(text => {
    const r = ws.addRow([text]);
    ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
    r.getCell(1).font = { bold: true, size: 12 };
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    rowIdx++;
  });

  // Ngày xuất
  const rDate = ws.addRow([`Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`]);
  ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
  rDate.getCell(1).font = { italic: true, size: 11 };
  rDate.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  rowIdx++;

  // Trống
  ws.addRow([]);
  rowIdx++;

  // Header bảng (dòng 12)
  const colHeaders = ['STT', 'Họ và tên', 'CCCD/CMND', 'Địa chỉ', 'Số điện thoại', 'Email', 'Hạng đăng ký', 'Ghi chú'];
  const rHeader = ws.addRow(colHeaders);
  rHeader.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  const headerRowNum = rowIdx;
  rowIdx++;

  // Dữ liệu học viên
  students.forEach((s, idx) => {
    const reg = getReg(s.id);
    const rowData = [
      idx + 1,
      s.fullName || '',
      reg.idNumber || '',
      reg.permanentAddress || reg.currentAddress || '',
      s.phone || reg.phone || '',
      s.email || '',
      reg.course || (s.rank || cls.rank || 'A'),
      s.status === 'ACTIVE' ? 'Đã kích hoạt' : (s.status || ''),
    ];
    const r = ws.addRow(rowData);
    const isEven = (rowIdx - headerRowNum) % 2 === 0;
    r.eachCell((cell, colNum) => {
      cell.alignment = { horizontal: colNum === 1 ? 'center' : 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      }
    });
    rowIdx++;
  });

  // Chiều cao dòng header
  ws.getRow(1).height = 6;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;

  const fileName = `SMC-Danh-sach-${cls.name?.replace(/[^a-zA-Z0-9]/g, '_')}-${dateStr.replace(/\//g, '-')}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Đã xuất file Excel!');
}

export default function AdminClasses() {
  const { getAllUsers } = useAuth();
  const [courses, setCourses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    name: '', course_id: '', teacher_ids: [], max_students: 20,
    start_date: '', end_date: '', status: 'active', rank: 'A'
  });

  const loadAll = async () => {
    try {
      const [classData, courseData, userData, regData] = await Promise.all([
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
        apiGetUsers().catch(() => ({ users: [] })),
        apiGetRegistrations().catch(() => []),
      ]);
      setClasses(Array.isArray(classData) ? classData : []);
      setCourses(Array.isArray(courseData) ? courseData : []);
      const users = Array.isArray(userData) ? userData : (userData.users || []);
      setAllUsers(users);
      setTeachers(users.filter(u => u.role === 'TEACHER'));
      setRegistrations(Array.isArray(regData) ? regData : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    return onDataChange('classes', () => { loadAll(); });
  }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.action === 'delete_user' || detail?.changed === 'users') loadAll();
    });
  }, []);

  const filtered = classes.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    courses.find(co => co.id === c.courseId || co.id === c.course_id)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', course_id: courses[0]?.id || '', teacher_ids: [], max_students: 20, start_date: '', end_date: '', status: 'active', rank: 'A' });
    setShowModal(true);
  };
  const openEdit = c => {
    setEditing(c);
    setForm({ ...c, name: c.name || '', teacher_ids: c.teacher_ids || [] });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.course_id) { toast.error('Vui lòng điền đầy đủ thông tin'); return; }
    try {
      if (editing) {
        await apiUpdateClass(editing.id, form);
        toast.success('Cập nhật lớp học!');
      } else {
        await apiCreateClass({ ...form, student_ids: [], schedule: [] });
        toast.success('Thêm lớp học!');
      }
      await loadAll();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
    emitDataChange('classes', { action: editing ? 'updated' : 'created' });
    setShowModal(false);
  };

  const handleDelete = async (c) => {
    if (window.confirm(`Xóa "${c.name}"?`)) {
      try {
        await apiDeleteClass(c.id);
        await loadAll();
        toast.success('Đã xóa');
        emitDataChange('classes', { action: 'deleted', id: c.id });
      } catch (err) {
        toast.error('Lỗi khi xóa: ' + (err.message || 'Không thể kết nối'));
      }
    }
  };

  // ── Khóa / Mở lớp ──
  const handleToggleLock = async (c) => {
    const newStatus = c.status === 'locked' ? 'active' : 'locked';
    try {
      await apiUpdateClass(c.id, { status: newStatus });
      await loadAll();
      toast.success(newStatus === 'locked' ? 'Đã khóa lớp' : 'Đã mở lớp');
      emitDataChange('classes', { action: 'updated', id: c.id });
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const getCourseName = id => courses.find(c => c.id === id)?.name || '—';
  const getCourse = id => courses.find(c => c.id === id);
  const getTeacherNames = ids => {
    if (!ids || ids.length === 0) return 'Chưa phân công';
    return ids.map(id => teachers.find(t => t.id === id)?.fullName || id).join(', ');
  };
  const getStudentInfo = sid => allUsers.find(u => String(u.id) === String(sid));
  const getRegForStudent = sid => registrations.find(r => r.studentId === sid || r.id === sid) || {};

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý lớp học</h1>
          <p className="text-sm text-gray-500 mt-0.5">{classes.length} lớp — {filtered.length} đang hiển thị</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />Tạo lớp mới</button>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm lớp..." />
      </div>

      <div className="space-y-4">
        {filtered.map(c => {
          const isLocked = c.status === 'locked';
          const studentCount = (c.student_ids || []).length;
          const isExpanded = expandedId === c.id;
          const course = getCourse(c.course_id);
          const siblingClasses = classes.filter(cls => cls.id !== c.id && cls.course_id === c.course_id);

          // Lấy danh sách học viên đầy đủ
          const classStudents = (c.student_ids || []).map(sid => getStudentInfo(sid)).filter(Boolean);

          return (
            <div key={c.id} className={`card overflow-hidden transition-all ${isLocked ? 'opacity-75' : ''}`}>
              {/* Header */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLocked ? 'bg-red-50' : 'bg-amber-50'}`}>
                      <School className={`w-5 h-5 ${isLocked ? 'text-red-400' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        {c.name}
                        {isLocked && <Lock className="w-3.5 h-3.5 text-red-500" />}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {getCourseName(c.course_id)} — Hạng {c.rank || 'A'}
                        {siblingClasses.length > 0 && <span className="ml-2 text-amber-600">(+{siblingClasses.length} lớp cùng khóa)</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`badge text-xs ${isLocked ? 'bg-red-100 text-red-700' : c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isLocked ? '🔒 Đã khóa' : c.status === 'active' ? 'Hoạt động' : c.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-3">
                  <div className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" /> GV: {getTeacherNames(c.teacher_ids)}</div>
                  <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Học viên: {studentCount}/{c.max_students || 20}</div>
                  <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(c.start_date)} → {formatDate(c.end_date)}</div>
                  {c.location && <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {c.location}</div>}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="btn-ghost text-xs flex items-center gap-1 text-blue-600">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? 'Thu gọn' : `Xem danh sách (${studentCount} HV)`}
                  </button>
                  <button onClick={() => handleToggleLock(c)}
                    className={`btn-ghost text-xs flex items-center gap-1 ${isLocked ? 'text-green-600' : 'text-red-500'}`}>
                    {isLocked ? <><Unlock className="w-3.5 h-3.5" /> Mở lớp</> : <><Lock className="w-3.5 h-3.5" /> Khóa lớp</>}
                  </button>
                  <button onClick={() => exportClassXLSX(c, course, classStudents, registrations, teachers)}
                    className="btn-ghost text-xs flex items-center gap-1 text-green-600">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Excel
                  </button>
                  <button onClick={() => openEdit(c)} className="btn-ghost text-xs flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" /> Sửa</button>
                  <button onClick={() => handleDelete(c)} className="btn-ghost text-xs flex items-center gap-1 text-red-500"><Trash2 className="w-3.5 h-3.5" /> Xóa</button>
                </div>
              </div>

              {/* Danh sách học viên (expand) */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Danh sách học viên ({studentCount})
                    </h4>
                    <button onClick={() => exportClassXLSX(c, course, classStudents, registrations, teachers)}
                      className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5">
                      <Download className="w-3.5 h-3.5" /> Xuất danh sách
                    </button>
                  </div>

                  {classStudents.length === 0 ? (
                    <p className="text-center py-6 text-gray-400 text-sm">Chưa có học viên nào trong lớp này</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-500 uppercase">
                            <th className="pb-2 pr-2 w-8">#</th>
                            <th className="pb-2 pr-2">Họ và tên</th>
                            <th className="pb-2 pr-2">CCCD</th>
                            <th className="pb-2 pr-2 hidden md:table-cell">Địa chỉ</th>
                            <th className="pb-2 pr-2">SĐT</th>
                            <th className="pb-2 pr-2 hidden lg:table-cell">Email</th>
                            <th className="pb-2 pr-2">Hạng ĐK</th>
                            <th className="pb-2">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classStudents.map((s, idx) => {
                            const reg = getRegForStudent(s.id);
                            return (
                              <tr key={s.id} className="border-b border-gray-100 hover:bg-white/50">
                                <td className="py-2 pr-2 text-gray-400">{idx + 1}</td>
                                <td className="py-2 pr-2 font-medium text-gray-900">{s.fullName || '—'}</td>
                                <td className="py-2 pr-2 text-gray-600 font-mono text-xs">{reg.idNumber || '—'}</td>
                                <td className="py-2 pr-2 text-gray-500 hidden md:table-cell max-w-[180px] truncate">{reg.permanentAddress || reg.currentAddress || '—'}</td>
                                <td className="py-2 pr-2 text-gray-600">{s.phone || reg.phone || '—'}</td>
                                <td className="py-2 pr-2 text-gray-500 hidden lg:table-cell">{s.email || '—'}</td>
                                <td className="py-2 pr-2">
                                  <span className="badge bg-blue-50 text-blue-700 text-xs">{reg.course || (s.rank || c.rank || 'A')}</span>
                                </td>
                                <td className="py-2">
                                  <span className={`badge text-xs ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : s.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {s.status === 'ACTIVE' ? 'Đã kích hoạt' : s.status === 'PENDING' ? 'Chờ duyệt' : s.status || '—'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <School className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Không có lớp học nào</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editing ? 'Sửa lớp học' : 'Tạo lớp học mới'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tên lớp</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Khóa học</label>
                <select value={form.course_id} onChange={e => setForm({...form, course_id: e.target.value})} className="input-field" required>
                  <option value="">Chọn khóa học...</option>
                  {courses.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
                {form.course_id && (() => {
                  const existingClasses = classes.filter(c => c.course_id === form.course_id && c.id !== (editing?.id || ''));
                  if (existingClasses.length === 0) return <p className="text-xs text-gray-400 mt-1">Chưa có lớp nào cho khóa này</p>;
                  return (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-gray-500">Các lớp hiện có ({existingClasses.length}):</p>
                      {existingClasses.map(c => (
                        <span key={c.id} className="badge bg-amber-50 text-amber-700 text-xs mr-1">{c.name} (Hạng {c.rank || 'A'})</span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hạng</label>
                  <select value={form.rank || 'A'} onChange={e => setForm({...form, rank: e.target.value})} className="input-field">
                    <option value="A">Hạng A</option><option value="B">Hạng B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sĩ số tối đa</label>
                  <input type="number" value={form.max_students} onChange={e => setForm({...form, max_students: parseInt(e.target.value) || 20})} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Giảng viên</label>
                <select multiple value={form.teacher_ids || []}
                  onChange={e => setForm({...form, teacher_ids: Array.from(e.target.selectedOptions, o => o.value)})}
                  className="input-field h-24">
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Giữ Ctrl/Cmd để chọn nhiều</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ngày khai giảng</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ngày bế giảng</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Địa điểm</label>
                <input value={form.location || ''} onChange={e => setForm({...form, location: e.target.value})} className="input-field" placeholder="VD: Phòng 101 - SMC Center" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field">
                  <option value="active">Hoạt động</option>
                  <option value="locked">Khóa</option>
                  <option value="completed">Đã kết thúc</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button>
                <button type="submit" className="btn-primary flex-1">{editing ? 'Cập nhật' : 'Tạo mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}