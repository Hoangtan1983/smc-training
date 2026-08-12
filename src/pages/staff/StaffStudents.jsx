import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiCreateUser, apiUpdateUser, apiDeleteUser, apiGetUsers, apiGetCourses, apiGetClasses, apiAssignClass, emitDataChange, onDataChange } from '../../data/api';
import { Users, Search, Plus, Edit3, Trash2, X, Check, UserPlus, Upload, Download, FileSpreadsheet, FileDown, School, GraduationCap, Phone, Mail, Building2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';

export default function StaffStudents() {
  const { user, getAllUsers, createUser, updateUser, deleteUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [showAgencyModal, setShowAgencyModal] = useState(null);
  const [assignAgencyId, setAssignAgencyId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: 'student123', courseId: '', rank: '', address: '', notes: '' });
  const fileInputRef = useRef(null);

  const [showAssignModal, setShowAssignModal] = useState(null);
  const [assignClassId, setAssignClassId] = useState('');

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { return onDataChange('users', () => { refresh(); }); }, []);
  useEffect(() => {
    return onDataChange('all', (detail) => {
      if (detail?.changed === 'users' || detail?.changed === 'classes' || detail?.changed === 'enrollments' || detail?.changed === 'tuitions') { refresh(); }
    });
  }, []);

  const loadAll = async () => {
    const [userData, classData, courseData] = await Promise.all([
      getAllUsers(), apiGetClasses().catch(() => []), apiGetCourses().catch(() => []),
    ]);
    setStudents(userData.filter(u => u.role === 'STUDENT'));
    setTeachers(userData.filter(u => u.role === 'TEACHER'));
    setClasses(Array.isArray(classData) ? classData : []);
    setCourses(Array.isArray(courseData) ? courseData : []);
    try {
      const { apiGetEnrollments } = await import('../../data/api');
      const enrData = await apiGetEnrollments().catch(() => []);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
    } catch { setEnrollments([]); }
    try {
      const { apiGetRegistrations } = await import('../../data/api');
      const regData = await apiGetRegistrations().catch(() => []);
      setRegistrations(Array.isArray(regData) ? regData : []);
    } catch { setRegistrations([]); }
    // Load agencies
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgencies(data.agencies || []);
    } catch {}
  };

  const refresh = async () => { await loadAll(); };

  const getStudentClass = (studentId) => {
    const enr = enrollments.find(e => e.student_id === studentId);
    // Ưu tiên enrollment.class_id
    if (enr?.class_id) {
      return classes.find(c => c.id === enr.class_id) || null;
    }
    // Fallback: kiểm tra trong class.student_ids
    const cls = classes.find(c => (c.student_ids || []).includes(studentId));
    return cls || null;
  };

  const getClassTeachers = (cls) => {
    if (!cls || !cls.teacher_ids || cls.teacher_ids.length === 0) return '—';
    return cls.teacher_ids.map(tid => teachers.find(t => t.id === tid)?.fullName || tid).join(', ');
  };

  const getStudentRank = (studentId) => {
    const s = students.find(st => st.id === studentId);
    if (!s) return '—';
    if (s.rank === 'A' || s.rank === 'B') return s.rank;
    const reg = registrations.find(r => {
      const rEmail = (r.email || '').toLowerCase().trim();
      const rPhone = (r.phone || '').toLowerCase().trim();
      const sEmail = (s.email || '').toLowerCase().trim();
      const sPhone = (s.phone || '').toLowerCase().trim();
      return (rEmail && rEmail === sEmail) || (rPhone && rPhone === sPhone);
    });
    if (reg?.course) {
      const courseText = reg.course.toLowerCase().trim();
      if (courseText.includes('hạng a') || courseText.includes('hang a')) return 'A';
      if (courseText.includes('hạng b') || courseText.includes('hang b')) return 'B';
      if (courseText === 'c001' || courseText === 'a' || courseText === 'vlos') return 'A';
      if (courseText === 'c002' || courseText === 'c003' || courseText === 'b' || courseText.includes('bvlos')) return 'B';
    }
    const cls = classes.find(c => (c.student_ids || []).includes(studentId));
    if (cls?.rank) return cls.rank;
    const enr = enrollments.find(e => e.student_id === studentId);
    if (enr?.class_id) {
      const cls2 = classes.find(c => c.id === enr.class_id);
      if (cls2?.rank) return cls2.rank;
    }
    return '—';
  };

  const getAgencyName = (student) => {
    // Ưu tiên dữ liệu từ enrollments/invoices (MySQL)
    const enr = enrollments.find(e => e.student_id === student.id);
    if (enr?.agencyId || enr?.agency_name) {
      return { id: enr.agencyId || '', name: enr.agency_name || ('ĐL #' + (enr.agencyId || '').substring(0, 8)) };
    }
    // Fallback sang student.agencyId (JSON cũ)
    if (!student.agencyId) return null;
    return agencies.find(a => a.id === student.agencyId) || { id: student.agencyId, name: 'ĐL #' + student.agencyId.substring(0, 8) };
  };

  const handleAssignAgency = async () => {
    if (!showAgencyModal) return;
    setAssignSaving(true);
    try {
      const token = localStorage.getItem('smc-token');
      const res = await fetch('/api/agency.php?action=assign-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId: showAgencyModal, agencyId: assignAgencyId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(data.message || 'Đã cập nhật đại lý!');
      setShowAgencyModal(null);
      setAssignAgencyId('');
      refresh();
    } catch (e) {
      toast.error('Lỗi: ' + (e.message || 'Không thể gán đại lý'));
    } finally { setAssignSaving(false); }
  };

  const handleAssignClass = async () => {
    if (!assignClassId || !showAssignModal) { toast.error('Vui lòng chọn lớp'); return; }

    // Kiểm tra tương thích hạng trước khi gọi API
    const targetClass = classes.find(c => c.id === assignClassId);
    const student = students.find(s => s.id === showAssignModal);
    if (targetClass && student) {
      const getEffectiveRank = (rank, courseId) => {
        if (rank === 'A' || rank === 'B') return rank;
        if (courseId === 'c001') return 'A';
        if (courseId === 'c002' || courseId === 'c003') return 'B';
        return '';
      };
      const classRank = getEffectiveRank(targetClass.rank || '', targetClass.course_id || '');
      const studentRank = getEffectiveRank(student.rank || '', student.courseId || '');
      if (classRank && studentRank && classRank !== studentRank) {
        toast.error(`Không thể xếp: học viên đăng ký hạng ${studentRank} (${studentRank === 'A' ? 'VLOS' : 'BVLOS'}) vào lớp hạng ${classRank} (${classRank === 'A' ? 'VLOS' : 'BVLOS'})`);
        return;
      }
    }

    setAssignSaving(true);
    try {
      const oldClass = getStudentClass(showAssignModal);
      await apiAssignClass(showAssignModal, assignClassId, oldClass?.id || '');
      toast.success('Đã xếp lớp thành công!');
      emitDataChange('classes', { action: 'student_assigned', studentId: showAssignModal, classId: assignClassId });
      emitDataChange('enrollments', { action: 'updated', studentId: showAssignModal });
      emitDataChange('users', { action: 'class_changed', studentId: showAssignModal });
      setShowAssignModal(null); setAssignClassId(''); refresh();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể xếp lớp'));
    } finally { setAssignSaving(false); }
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ fullName: '', email: '', phone: '', password: 'student123', courseId: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({ fullName: u.fullName || '', email: u.email || '', phone: u.phone || '', password: '', courseId: u.courseId || '', rank: u.rank || '', address: u.address || '', notes: u.notes || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName) { toast.error('Vui lòng nhập họ tên'); return; }
    if (!form.phone && !form.email) { toast.error('Vui lòng nhập SĐT hoặc Email'); return; }
    if (editingUser) {
      await updateUser(editingUser.id, { fullName: form.fullName, phone: form.phone, email: form.email, courseId: form.courseId, rank: form.rank, address: form.address, notes: form.notes, ...(form.password ? { password: form.password } : {}) });
      toast.success('Đã cập nhật học viên!');
    } else {
      await createUser({ fullName: form.fullName, email: form.email || `${form.phone}@student.smc.vn`, phone: form.phone, password: form.password || 'student123', role: 'STUDENT', courseId: form.courseId, address: form.address, notes: form.notes });
      toast.success('Đã tạo học viên!');
    }
    emitDataChange('users', { action: editingUser ? 'updated' : 'created' });
    setShowModal(false); refresh();
  };

  const handleDelete = async (u) => {
    if (window.confirm(`Xóa học viên "${u.fullName}"?`)) { await deleteUser(u.id); toast.success('Đã xóa học viên'); refresh(); }
  };

  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mẫu nhập học viên');
    ws.columns = [{ width: 25 }, { width: 18 }, { width: 32 }, { width: 10 }, { width: 42 }, { width: 32 }];
    const headers = ['Họ tên', 'Số điện thoại', 'Email', 'Hạng', 'Địa chỉ', 'Ghi chú'];
    const rHeader = ws.addRow(headers);
    rHeader.eachCell(cell => {
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    [['Nguyễn Văn A', '0901234567', 'nguyenvana@gmail.com', 'A', '123 Đường ABC, Quận 1, TP.HCM', 'Học viên mới'],
     ['Trần Thị B', '0909876543', 'tranthib@gmail.com', 'B', '456 Đường XYZ, Quận 3, TP.HCM', 'Đã có kinh nghiệm bay']].forEach(row => ws.addRow(row));
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mau-nhap-hoc-vien-SMC.xlsx'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải file mẫu!');
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let courseMap = {};
    try {
      const coursesData = await apiGetCourses();
      const cList = Array.isArray(coursesData) ? coursesData : (coursesData?.courses || []);
      cList.forEach(c => { courseMap[c.name?.toLowerCase()] = c.id; courseMap[(c.code || '').toLowerCase()] = c.id; });
    } catch {}
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { toast.error('File trống'); return; }
        const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('tên') || h.includes('name'));
        const phoneIdx = headers.findIndex(h => h.includes('điện thoại') || h.includes('phone'));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const rankIdx = headers.findIndex(h => h.includes('hạng') || h.includes('rank'));
        const addrIdx = headers.findIndex(h => h.includes('địa chỉ') || h.includes('address'));
        const notesIdx = headers.findIndex(h => h.includes('ghi chú') || h.includes('note'));
        if (nameIdx === -1) { toast.error('File cần có cột "Họ tên"'); return; }
        let imported = 0, skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 2) continue;
          const fullName = cols[nameIdx], phone = phoneIdx >= 0 ? cols[phoneIdx] : '', email = emailIdx >= 0 ? cols[emailIdx] : '';
          const rankVal = rankIdx >= 0 ? cols[rankIdx] : '', address = addrIdx >= 0 ? cols[addrIdx] : '', notes = notesIdx >= 0 ? cols[notesIdx] : '';
          if (!fullName) continue;
          let courseId = '';
          if (rankVal) {
            const r = rankVal.toLowerCase().trim();
            if (r === 'a') courseId = courseMap['a'] || 'c001';
            else if (r === 'b') courseId = courseMap['b'] || 'c002';
          }
          try { await createUser({ fullName, email: email || `${phone || Date.now()}@student.smc.vn`, phone, password: 'student123', role: 'STUDENT', courseId, address, notes }); imported++; }
          catch (err) { console.warn('Skip:', fullName, err.message); skipped++; }
        }
        toast.success(`Đã nhập ${imported} học viên!${skipped > 0 ? ` (${skipped} bỏ qua)` : ''}`);
        refresh();
      } catch (err) { toast.error('Lỗi đọc file: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportExcel = async () => {
    const all = await getAllUsers();
    const studentList = all.filter(u => u.role === 'STUDENT');
    if (studentList.length === 0) { toast.error('Không có dữ liệu'); return; }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh sách học viên');
    ws.columns = [{ width: 28 }, { width: 18 }, { width: 32 }, { width: 10 }, { width: 42 }, { width: 32 }, { width: 15 }, { width: 15 }];
    const hdrs = ['Họ tên', 'Số điện thoại', 'Email', 'Hạng', 'Địa chỉ', 'Ghi chú', 'Ngày tạo', 'Trạng thái'];
    const rH = ws.addRow(hdrs);
    rH.eachCell(cell => {
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    studentList.forEach((s, idx) => {
      ws.addRow([s.fullName || '', s.phone || '', s.email || '', getStudentRank(s.id), s.address || '', s.notes || '', s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '', s.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa']);
    });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `SMC-Danh-sach-hoc-vien-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${studentList.length} học viên ra Excel`);
  };

  const columns = [
    {
      key: 'student', label: 'Học viên',
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">{s.fullName?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div className="text-sm font-medium text-gray-900">{s.fullName}</div>
            {s.notes && <div className="text-xs text-gray-400">{s.notes}</div>}
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'SĐT', render: (s) => <span className="text-sm text-gray-500">{s.phone || '—'}</span> },
    {
      key: 'rank', label: 'Hạng',
      render: (s) => {
        const rank = getStudentRank(s.id);
        return <span className={`badge text-xs font-semibold ${rank === 'A' ? 'bg-blue-100 text-blue-700' : rank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{rank}</span>;
      },
    },
    {
      key: 'agency', label: 'Đại lý',
      render: (s) => {
        const agency = getAgencyName(s);
        if (!agency) return <span className="text-xs text-gray-400">—</span>;
        return (
          <button
            onClick={() => { setShowAgencyModal(s.id); setAssignAgencyId(s.agencyId || ''); }}
            className="badge bg-orange-100 text-orange-700 text-xs hover:bg-orange-200 cursor-pointer transition-colors flex items-center gap-1"
            title="Nhấn để thay đổi đại lý"
          >
            <Building2 className="w-3 h-3" />
            {agency.name}
          </button>
        );
      },
    },
    {
      key: 'class', label: 'Lớp',
      render: (s) => {
        const cls = getStudentClass(s.id);
        return cls ? <span className="badge bg-amber-100 text-amber-700 text-xs flex items-center gap-1"><School className="w-3 h-3" />{cls.name}</span> : <span className="text-xs text-gray-400">Chưa xếp lớp</span>;
      },
    },
    {
      key: 'teachers', label: 'Giáo viên',
      render: (s) => <span className="text-xs text-gray-500 max-w-[150px] truncate block">{getClassTeachers(getStudentClass(s.id))}</span>,
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý học viên</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} học viên</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm"><UserPlus className="w-4 h-4" /> Tạo học viên</button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-outline flex items-center gap-2 text-sm"><Upload className="w-4 h-4" /> Nhập Excel</button>
          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.txt" onChange={handleImportExcel} className="hidden" />
          <button onClick={handleDownloadTemplate} className="btn-ghost flex items-center gap-2 text-sm"><FileDown className="w-4 h-4" /> Tải file mẫu</button>
          <button onClick={handleExportExcel} className="btn-ghost flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Xuất Excel</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-blue-600">{students.length}</div><div className="text-xs text-gray-500 mt-1">Tổng học viên</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-green-600">{students.filter(s => s.status === 'ACTIVE').length}</div><div className="text-xs text-gray-500 mt-1">Đang hoạt động</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-extrabold text-red-600">{students.filter(s => s.status !== 'ACTIVE').length}</div><div className="text-xs text-gray-500 mt-1">Đã khóa</div></div>
      </div>

      <ExpandableDataTable
        data={students}
        columns={columns}
        searchFields={['fullName', 'email', 'phone']}
        filters={{ statusFilter: true, dateFilter: true, dateField: 'createdAt' }}
        emptyIcon={Users}
        emptyText={search ? 'Không tìm thấy học viên' : 'Chưa có học viên nào'}
        renderExpanded={(s) => {
          const cls = getStudentClass(s.id);
          const rank = getStudentRank(s.id);
          const agency = getAgencyName(s);
          return (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Họ tên</p><p className="text-sm font-medium text-gray-900">{s.fullName}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Email</p><p className="text-sm text-gray-700">{s.email}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">SĐT</p><p className="text-sm text-gray-700">{s.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Hạng</p><span className={`badge font-semibold ${rank === 'A' ? 'bg-blue-100 text-blue-700' : rank === 'B' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{rank}</span></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Lớp</p><p className="text-sm text-gray-700">{cls?.name || 'Chưa xếp lớp'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Giáo viên</p><p className="text-sm text-gray-700">{getClassTeachers(cls)}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Đại lý</p>
                  <p className="text-sm text-gray-700">
                    {agency ? (
                      <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                        <Building2 className="w-3.5 h-3.5" />{agency.name}
                      </span>
                    ) : '—'}
                  </p>
                </div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Địa chỉ</p><p className="text-sm text-gray-700">{s.address || '—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-semibold">Ghi chú</p><p className="text-sm text-gray-700">{s.notes || '—'}</p></div>
              </div>
            </div>
          );
        }}
        actions={(s) => {
          const alreadyAssigned = !!getStudentClass(s.id);
          const hasAgency = !!getAgencyName(s);
          return (
          <>
            <button
              onClick={() => { setShowAgencyModal(s.id); setAssignAgencyId(s.agencyId || ''); }}
              className={`p-1.5 rounded-lg ${hasAgency ? 'text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'}`}
              title={hasAgency ? `Đại lý: ${getAgencyName(s)?.name} — Nhấn để đổi` : 'Gán vào đại lý'}
            >
              <Building2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setShowAssignModal(s.id); setAssignClassId(getStudentClass(s.id)?.id || ''); }}
              className={`p-1.5 rounded-lg ${alreadyAssigned ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
              title={alreadyAssigned ? 'Đã xếp lớp — Nhấn để đổi lớp' : 'Xếp lớp'}
            >
              <School className="w-4 h-4" />
            </button>
            <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Sửa"><Edit3 className="w-4 h-4" /></button>
            <button onClick={() => handleDelete(s)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
          </>
          );
        }}
      />

      {/* Assign Class Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><School className="w-5 h-5 text-amber-500" /> Xếp lớp học viên</h3>
              <button onClick={() => setShowAssignModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Chọn lớp</label>
                <select value={assignClassId} onChange={e => setAssignClassId(e.target.value)} className="input-field">
                  <option value="">— Chọn lớp —</option>
                  {classes.filter(c => c.status !== 'completed' && c.status !== 'cancelled').map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({(c.student_ids || []).length}/{c.max_students || 20})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAssignModal(null)} className="btn-ghost flex-1">Hủy</button>
                <button onClick={handleAssignClass} disabled={assignSaving || !assignClassId} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {assignSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <School className="w-4 h-4" />}
                  {assignSaving ? 'Đang xếp...' : 'Xếp lớp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Agency Modal */}
      {showAgencyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAgencyModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-500" /> Gán vào Đại lý</h3>
              <button onClick={() => setShowAgencyModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Chọn đại lý để gán học viên này. Học phí sẽ tự động tính lại theo chiết khấu của đại lý.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Đại lý</label>
                <select value={assignAgencyId} onChange={e => setAssignAgencyId(e.target.value)} className="input-field">
                  <option value="">— Không thuộc đại lý nào —</option>
                  {agencies.filter(a => a.status === 'active').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.discountPercent > 0 ? `(CK ${a.discountPercent}%)` : ''} — {a.studentCount || 0} HV
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAgencyModal(null)} className="btn-ghost flex-1">Hủy</button>
                <button onClick={handleAssignAgency} disabled={assignSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {assignSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Building2 className="w-4 h-4" />}
                  {assignAgencyId ? 'Gán vào đại lý' : 'Gỡ khỏi đại lý'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b z-10">
              <h3 className="text-lg font-bold text-gray-900">{editingUser ? 'Chỉnh sửa học viên' : 'Tạo học viên mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Họ và tên *</label><input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="input-field" placeholder="Nguyễn Văn A" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="09xxxxxxxx" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" placeholder="email@example.com" disabled={!!editingUser} /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Hạng</label><select value={form.rank} onChange={e => setForm({...form, rank: e.target.value})} className="input-field"><option value="">— Chưa có —</option><option value="A">Hạng A</option><option value="B">Hạng B</option></select></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Khóa học</label><select value={form.courseId} onChange={e => setForm({...form, courseId: e.target.value})} className="input-field"><option value="">— Chọn khóa học —</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Địa chỉ</label><input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-field" placeholder="Số nhà, đường, phường, quận, TP" /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Ghi chú</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" rows={2} placeholder="Ghi chú về học viên..." /></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mật khẩu {!editingUser && '(mặc định: student123)'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" placeholder={editingUser ? 'Để trống nếu không đổi' : 'student123'} /></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button><button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">{editingUser ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editingUser ? 'Lưu thay đổi' : 'Tạo học viên'}</button></div>
            </form>
            {!editingUser && (
              <div className="px-6 pb-4 border-t pt-4 bg-gray-50 rounded-b-2xl">
                <p className="text-xs text-gray-500 mb-2"><FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" /><strong>File Excel nhập:</strong> Các cột: Họ tên, SĐT, Email, <span className="text-blue-600">Khóa học</span>, Địa chỉ, Ghi chú</p>
                <button onClick={handleDownloadTemplate} className="text-xs text-blue-600 hover:text-blue-700 underline">Tải file mẫu</button>
                <p className="text-xs text-gray-400 mt-1">Hỗ trợ file .csv (phân cách bằng dấu phẩy hoặc tab).</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
