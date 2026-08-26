import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Edit3, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ExpandableDataTable from '../../components/ExpandableDataTable';
import { apiGetCourses, apiGetAgencyReport, onDataChange } from '../../data/api';

export default function AgencyStudents() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({ phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('smc-token');

  // ĐÃ THỐNG NHẤT: Dùng apiGetAgencyReport (v3) thay vì fetch trực tiếp agency.php
  // Tất cả data từ invoices.json — cùng nguồn với AgencyDashboard
  const fetchData = useCallback(async () => {
    try {
      const [reportRes, coursesData] = await Promise.all([
        apiGetAgencyReport(),
        apiGetCourses().catch(() => []),
      ]);

      const reportData = reportRes?.data || {};
      const agencyInvoices = reportData.invoices || [];
      const stats = reportData.stats || {};

      // Map invoices sang format cũ
      const mappedStudents = agencyInvoices.map(inv => ({
        id: inv.studentId,
        fullName: inv.studentName,
        studentName: inv.studentName,
        email: inv.studentEmail,
        phone: inv.studentPhone,
        courseId: inv.courseId,
        courseName: inv.courseName,
        course: inv.courseName ? { name: inv.courseName } : null,
        agencyId: inv.agencyId,
        agencyDiscountPercent: inv.agencyDiscountPercent,
        status: inv.status === 'paid' ? 'ACTIVE' : 'ACTIVE',
        enrollmentStatus: inv.status === 'frozen' ? 'frozen' : 'active',
        tuition: {
          id: inv.id,
          amount: inv.basePrice || inv.amount,
          baseAmount: inv.basePrice,
          actualAmount: inv.actualAmount,
          totalPaid: inv.totalPaid,
          remainingDue: inv.remainingDue,
          discountPercent: inv.agencyDiscountPercent,
          owesToSmc: inv.owesToSmc,
          status: inv.status,
          step: inv.step,
        },
      }));

      setStudents(mappedStudents);
      setCourses(Array.isArray(coursesData) ? coursesData : (coursesData?.courses || []));
    } catch (err) {
      console.error('[AgencyStudents] Load error:', err);
      setStudents([]);
      toast.error('Không thể tải danh sách học viên: ' + (err.message || ''));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Đồng bộ liên tài khoản
  useEffect(() => {
    const unsub1 = onDataChange('enrollments', () => fetchData());
    const unsub2 = onDataChange('all', (d) => { if (['courses', 'enrollments', 'tuitions', 'invoices'].includes(d?.changed)) fetchData(); });
    return () => { unsub1(); unsub2(); };
  }, [fetchData]);

  // Build course name map từ API
  const getCourseName = (courseId) => {
    if (!courseId) return '---';
    const course = courses.find(c => c.id === courseId);
    return course ? course.name : courseId;
  };

  const filtered = students.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      const match = (s.fullName || '').toLowerCase().includes(q)
        || (s.email || '').toLowerCase().includes(q)
        || (s.phone || '').includes(q);
      if (!match) return false;
    }
    if (statusFilter !== 'all') {
      const tuitionStatus = s.tuition?.status || 'unpaid';
      if (statusFilter !== tuitionStatus) return false;
    }
    return true;
  });

  const columns = [
    { key: 'fullName', label: 'Họ tên', render: (v) => <span className="font-medium text-slate-800">{v.fullName}</span> },
    { key: 'phone', label: 'SĐT', render: (v) => <span className="text-sm text-gray-600">{v.phone || '—'}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-sm text-gray-600">{v.email || '—'}</span> },
    { key: 'course', label: 'Khóa học', render: (v) => {
      if (v.course) return <span className="text-sm font-medium text-blue-700">{v.course.name}</span>;
      if (v.courseName) return <span className="text-sm text-gray-600">{v.courseName}</span>;
      return <span className="text-sm text-gray-400">---</span>;
    }},
    { key: 'class', label: 'Lớp học', render: (v) => {
      if (v.class) return <span className="text-sm font-medium text-purple-700">{v.class.name}</span>;
      return <span className="text-sm text-gray-400">Chưa xếp lớp</span>;
    }},
    { key: 'tuition-base', label: 'Học phí', render: (v) => v.tuition ? (
      <div className="text-right">
        <div className="font-medium">{Number(v.tuition.baseAmount || v.tuition.amount).toLocaleString('vi-VN')}đ</div>
        {v.tuition.discountPercent > 0 && <div className="text-xs text-orange-500">CK {v.tuition.discountPercent}%</div>}
      </div>
    ) : <span className="text-sm text-gray-400">---</span>},
    { key: 'tuition-paid', label: 'Đã nộp', render: (v) => v.tuition ? (
      <div className="text-right">
        <span className="font-medium text-green-600">{Number(v.tuition.totalPaid || 0).toLocaleString('vi-VN')}đ</span>
      </div>
    ) : <span className="text-sm text-gray-400">---</span>},
    { key: 'tuition-smc', label: 'Phải nộp SMC', render: (v) => v.tuition ? (
      <div className="text-right">
        <span className="font-medium text-blue-700">{Number(v.tuition.owesToSmc || 0).toLocaleString('vi-VN')}đ</span>
        {v.tuition.discountPercent > 0 && <div className="text-xs text-blue-400">(sau CK {v.tuition.discountPercent}%)</div>}
      </div>
    ) : <span className="text-sm text-gray-400">---</span>},
    { key: 'tuition-due', label: 'Còn phải thu', render: (v) => v.tuition ? (
      <div className="text-right">
        <span className={`font-medium ${(v.tuition.remainingDue || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
          {Number(v.tuition.remainingDue || 0).toLocaleString('vi-VN')}đ
        </span>
      </div>
    ) : <span className="text-sm text-gray-400">---</span>},
    { key: 'tuition-status', label: 'Trạng thái HP', render: (v) => {
      if (!v.tuition) return <span className="badge badge-gray text-xs">Chưa có</span>;
      const statusMap = {
        'paid': { label: 'Đã đóng', class: 'badge-emerald' },
        'unpaid': { label: 'Chưa đóng', class: 'badge-red' },
        'partial': { label: 'Một phần', class: 'badge-amber' },
        'payment_review': { label: 'Chờ duyệt', class: 'badge-blue' },
      };
      const st = statusMap[v.tuition.status] || { label: v.tuition.status, class: 'badge-gray' };
      return <span className={`badge text-xs ${st.class}`}>{st.label}</span>;
    }},
    { key: 'status', label: 'Tài khoản', render: (v) => (
      <span className={`badge text-xs ${v.status === 'ACTIVE' ? 'badge-emerald' : v.status === 'PENDING' ? 'badge-amber' : 'badge-red'}`}>
        {v.status === 'ACTIVE' ? 'Hoạt động' : v.status === 'PENDING' ? 'Chờ duyệt' : v.status}
      </span>
    )},
  ];

  const renderExpanded = (student) => (
    <div className="p-4 bg-slate-50 rounded-lg text-sm space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 uppercase font-semibold">Khóa học</p>
          <p className="text-sm font-medium text-blue-700">
            {student.course ? student.course.name : (student.courseName || '—')}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase font-semibold">Lớp học</p>
          <p className="text-sm font-medium text-purple-700">
            {student.class ? student.class.name : 'Chưa xếp lớp'}
          </p>
        </div>
      </div>
      {student.class && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
          <div>
            <p className="text-xs text-gray-400">Hạng</p>
            <p className="text-sm font-medium">{student.class.rank || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sĩ số</p>
            <p className="text-sm font-medium">{student.class.studentCount || 0}/{student.class.maxStudents || 20}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Giáo viên</p>
            <p className="text-sm font-medium">{student.class.teacherCount || 0} GV</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Ngày</p>
            <p className="text-sm font-medium">
              {student.class.start_date ? new Date(student.class.start_date).toLocaleDateString('vi-VN') : '—'}
              {' → '}
              {student.class.end_date ? new Date(student.class.end_date).toLocaleDateString('vi-VN') : '—'}
            </p>
          </div>
        </div>
      )}
      {student.stageProgress && Object.keys(student.stageProgress).length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Tiến độ học tập</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(student.stageProgress).map(([key, val]) => {
              const stageLabels = { enrollment: 'Tuyển sinh', theory: 'Lý thuyết', practice: 'Thực hành', exam: 'Sát hạch', certification: 'Chứng chỉ' };
              const isDone = val.status === 'completed';
              return (
                <span key={key} className={`badge text-xs ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isDone ? '✓' : '○'} {stageLabels[key] || key}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <p><strong>Địa chỉ:</strong> {student.address || '---'}</p>
      <p><strong>Ghi chú:</strong> {student.notes || '---'}</p>
      {student.tuition && (
        <>
          <div className="border-t pt-2 mt-2">
            <p className="font-semibold text-slate-700 mb-1">Chi tiết học phí:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-gray-400">Học phí (giá gốc)</p>
                <p className="text-sm font-medium">{Number(student.tuition.baseAmount || student.tuition.amount).toLocaleString('vi-VN')}đ</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Đã nộp</p>
                <p className="text-sm font-medium text-green-600">{Number(student.tuition.totalPaid || 0).toLocaleString('vi-VN')}đ</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Phải nộp cho SMC {student.tuition.discountPercent > 0 ? `(sau CK ${student.tuition.discountPercent}%)` : ''}</p>
                <p className="text-sm font-medium text-blue-700">{Number(student.tuition.owesToSmc || 0).toLocaleString('vi-VN')}đ</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Còn phải thu</p>
                <p className={`text-sm font-medium ${(student.tuition.remainingDue || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>{Number(student.tuition.remainingDue || 0).toLocaleString('vi-VN')}đ</p>
              </div>
            </div>
            <p>Trạng thái: <span className="font-medium">{student.tuition.status}</span></p>
            {student.tuition.discountPercent > 0 && (
              <p className="text-orange-600">Chiết khấu Đại lý: {student.tuition.discountPercent}% → Thực thu: {Number(student.tuition.amount).toLocaleString('vi-VN')}đ</p>
            )}
            {student.tuition.paidDate && <p>Ngày đóng: {new Date(student.tuition.paidDate).toLocaleDateString('vi-VN')}</p>}
          </div>
        </>
      )}
      <p className="text-xs text-slate-400">ID: {student.id}</p>
    </div>
  );

  // ── Cập nhật SĐT/email học viên ──
  const openEdit = (student) => {
    setEditingStudent(student);
    setEditForm({ phone: student.phone || '', email: student.email || '' });
  };

  const handleSave = async () => {
    if (!editingStudent) return;
    setSaving(true);
    try {
      const res = await fetch('/api/agency.php?action=update-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId: editingStudent.id, phone: editForm.phone.trim(), email: editForm.email.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Đã cập nhật thông tin học viên');
      setEditingStudent(null);
      fetchData();
    } catch (e) {
      toast.error(e.message || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const studentActions = (student) => (
    <button
      onClick={() => openEdit(student)}
      className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg"
      title="Cập nhật SĐT/Email"
    >
      <Edit3 className="w-4 h-4" />
    </button>
  );

  // ── Error boundary fallback ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Đang tải danh sách học viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Học viên của Đại lý</h1>
          <p className="text-slate-500 mt-1">Tổng: {filtered.length} học viên</p>
        </div>
        <button
          onClick={() => {
            const csv = [
              ['Họ tên', 'SĐT', 'Email', 'Khóa học', 'Lớp học', 'Học phí (giá gốc)', 'Đã nộp', 'Phải nộp SMC', 'Còn phải thu', 'Trạng thái HP', 'Trạng thái TK'],
              ...filtered.map(s => [
                s.fullName, s.phone, s.email,
                s.course ? s.course.name : (s.courseName || ''),
                s.class ? s.class.name : 'Chưa xếp lớp',
                s.tuition?.baseAmount || s.tuition?.amount || '',
                s.tuition?.totalPaid || 0,
                s.tuition?.owesToSmc || 0,
                s.tuition?.remainingDue || 0,
                s.tuition?.status || '', s.status
              ])
            ].map(r => r.join(',')).join('\n');
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'danh-sach-hoc-vien-dai-ly.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={16} /> Xuất Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="all">Tất cả trạng thái HP</option>
          <option value="paid">Đã đóng</option>
          <option value="unpaid">Chưa đóng</option>
          <option value="partial">Một phần</option>
        </select>
      </div>

      {/* Students table wrapped in try-catch via Error Boundary pattern */}
      <StudentTable students={filtered} columns={columns} renderExpanded={renderExpanded} actions={studentActions} />

      {/* ── Modal cập nhật SĐT/Email ── */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingStudent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Cập nhật thông tin học viên</h3>
              <button onClick={() => setEditingStudent(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900">{editingStudent.fullName || editingStudent.studentName}</p>
                <p className="text-xs text-gray-500">Mã: {editingStudent.id}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Số điện thoại</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="input-field"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="input-field"
                  placeholder="Nhập email"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingStudent(null)} className="btn-ghost flex-1">Hủy</button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component to catch rendering errors
function StudentTable({ students, columns, renderExpanded, actions }) {
  try {
    return (
      <ExpandableDataTable
        columns={columns}
        data={students}
        renderExpanded={renderExpanded}
        actions={actions}
        emptyText="Chưa có học viên nào"
      />
    );
  } catch (e) {
    return (
      <div className="p-6 bg-red-50 rounded-xl border border-red-200">
        <h3 className="font-bold text-red-700">Lỗi hiển thị bảng</h3>
        <p className="text-sm text-red-600 mt-1">{e.message}</p>
        <pre className="text-xs mt-2 bg-red-100 p-3 rounded">{e.stack}</pre>
      </div>
    );
  }
}
