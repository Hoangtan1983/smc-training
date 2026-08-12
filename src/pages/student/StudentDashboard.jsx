import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loadData, saveData, loadFromStorage } from '../../data/store';
import { onDataChange, apiGetMyTuition, apiGetStudentInvoices, apiGetClasses, apiGetCourses, apiGetEnrollments } from '../../data/api';
import { MODULE_INFO } from '../../data/questionBank';
import {
  BookOpen, Calendar, Award, TrendingUp, Play, FileText,
  CheckCircle, Clock, AlertTriangle, School, GraduationCap,
  Users, MapPin, ChevronRight, Video, Download, ExternalLink,
  Monitor, PenTool, ClipboardCheck, Wallet, DollarSign
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/format';

const formatPrice = (p) => formatCurrency(p);

// Danh sách module chuẩn cho UAV (dùng khi course không có modules)
const UAV_STANDARD_MODULES = Object.entries(MODULE_INFO).map(([key, info]) => ({
  id: key,
  name: `${info.icon} ${info.name}`,
  hours_theory: Math.round(info.questionCount * 0.8),
  hours_practice: Math.round(info.questionCount * 0.7),
  questionCount: info.questionCount,
}));

export default function StudentDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [myTuition, setMyTuition] = useState(null);
  const [myInvoice, setMyInvoice] = useState(null);
  const [myClass, setMyClass] = useState(null);
  const [myEnrollment, setMyEnrollment] = useState(null);
  const [myCourse, setMyCourse] = useState(null);
  const [classTeachers, setClassTeachers] = useState([]);
  const [modules, setModules] = useState([]);
  const [stageProgress, setStageProgress] = useState({});

  // Load tuition từ API server + invoice từ v3
  const fetchMyTuition = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiGetMyTuition();
      const t = res?.tuition;
      setMyTuition(t || null);
    } catch {
      const cached = loadFromStorage('tuitions', []);
      const found = cached.find(t => t.studentId === user?.id);
      setMyTuition(found || null);
    }
    // Load invoice từ StudentPayment API
    try {
      const invRes = await apiGetStudentInvoices();
      const invData = invRes?.data || [];
      setMyInvoice(invData.find(i => !i._legacy && i.status !== 'cancelled') || invData[0] || null);
    } catch { /* fallback */ }
  }, [user?.id]);

  // Load class + enrollment + course từ API server
  const fetchMyClass = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [allClasses, coursesData, enrollmentsData] = await Promise.all([
        apiGetClasses().catch(() => []),
        apiGetCourses().catch(() => []),
        apiGetEnrollments().catch(() => []),
      ]);
      const classes = Array.isArray(allClasses) ? allClasses : [];
      const courses = Array.isArray(coursesData) ? coursesData : [];
      const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : [];

      // Tìm enrollment của học viên
      const enr = enrollments.find(e => e.student_id === user.id);
      setMyEnrollment(enr || null);
      setStageProgress(enr?.stages || {});

      // Tìm lớp
      const classId = enr?.class_id || '';
      let foundClass = classId ? classes.find(c => c.id === classId) : null;
      if (!foundClass) {
        foundClass = classes.find(c => (c.student_ids || []).includes(user.id)) || null;
      }
      setMyClass(foundClass || null);

      // Tìm khóa học: enrollment > class > user > courseId từ user hoặc invoice
      const courseId = enr?.course_id || foundClass?.course_id || user?.courseId || myInvoice?.courseId || '';
      let foundCourse = courseId ? courses.find(c => c.id === courseId) : null;

      if (!foundCourse && courses.length > 0) {
        const classRank = foundClass?.rank || '';
        const userRank = user?.rank || '';
        if (classRank === 'A' || userRank === 'A') {
          foundCourse = courses.find(c => (c.name || '').toLowerCase().includes('hạng a') || (c.code || '').toLowerCase().includes('vlos'));
        } else if (classRank === 'B' || userRank === 'B') {
          foundCourse = courses.find(c => (c.name || '').toLowerCase().includes('hạng b') || (c.code || '').toLowerCase().includes('bvlos'));
        }
      }

      setMyCourse(foundCourse || null);
      const courseModules = foundCourse?.modules || [];
      setModules(courseModules.length > 0 ? courseModules : UAV_STANDARD_MODULES);

      const users = loadData('users', []);
      const allTeachers = users.filter(u => u.role === 'TEACHER');
      if (foundClass) {
        setClassTeachers(allTeachers.filter(u => (foundClass.teacher_ids || []).includes(u.id)));
      }
    } catch (e) {
      // fallback - lỗi đã được log ở api layer
    }
  }, [user?.id, myInvoice?.courseId]);

  useEffect(() => { fetchMyTuition(); fetchMyClass(); }, [user?.id]); // Gộp thành 1 useEffect tránh double-fetch

  // Refresh khi tab được focus trở lại
  useEffect(() => {
    const onFocus = () => { fetchMyTuition(); fetchMyClass(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { fetchMyTuition(); fetchMyClass(); }
    });
    return () => { window.removeEventListener('focus', onFocus); };
  }, [fetchMyTuition, fetchMyClass]);

  // Subscribe to real-time data changes
  useEffect(() => {
    const unsub1 = onDataChange('tuitions', () => {
      fetchMyTuition();
      fetchMyClass();
    });
    const unsub2 = onDataChange('all', (detail) => {
      if (detail?.changed === 'tuitions' || detail?.changed === 'users' || detail?.changed === 'classes' || detail?.changed === 'enrollments') {
        fetchMyTuition();
        fetchMyClass();
      }
    });
    return () => { unsub1(); unsub2(); };
  }, [fetchMyTuition, fetchMyClass]);

  // ── Derived values ──
  const classTeacherNames = classTeachers.map(t => t.fullName).join(', ') || 'Chưa phân công';
  const isActive = user?.status === 'ACTIVE';
  const isPaid = myInvoice?.status === 'paid' || myTuition?.status === 'paid' || myTuition?.step === 'active' || myTuition?.step === 'enrolled' || myTuition?.step === 'assigned';
  const isEnrolled = myTuition?.step === 'enrolled' || myTuition?.step === 'assigned' || !!myClass;
  const isAssigned = myTuition?.step === 'assigned' || (myClass?.teacher_ids || []).length > 0;

  // ── Học phí: dùng invoice (v3) nếu có, fallback tuition cũ ──
  const coursePrice = myCourse?.price || 0;
  const totalPaid = myInvoice?.totalPaid ?? myTuition?.partialAmount ?? 0;
  const remainingDue = myInvoice?.remainingDue ?? (myTuition?.amount ? Math.max(0, (myTuition.amount || 0) - (myTuition.partialAmount || 0)) : 0);
  const paymentStatus = myInvoice?.status || myTuition?.status || 'pending';

  const stepStatus = {
    step1: true,
    step2: isPaid || myTuition?.step === 'payment_review',
    step3: isActive,
    step4: isActive,
    step5: isEnrolled,
    step6: isAssigned,
  };
  const completedSteps = Object.values(stepStatus).filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 6) * 100);

  return (
    <div className="animate-fade-in">
      {/* Welcome — iOS style */}
      <div className="mb-6">
        <h1 className="text-[1.75rem] font-bold text-[#1C1C1E] tracking-tight">
          Xin chào, {user?.fullName}! 👋
        </h1>
        <p className="text-[0.9375rem] text-[#8E8E93] mt-0.5">
          {isActive ? 'Tài khoản đã kích hoạt — Truy cập đầy đủ LMS' : 'Tài khoản đang chờ duyệt'}
        </p>
      </div>

      {/* Status Pipeline — iOS style */}
      <div className="bg-gradient-to-r from-[#F0F7FF] via-[#F0FDFB] to-[#F2F2F7] rounded-2xl p-5 mb-6 shadow-ios">
        <h3 className="font-semibold text-[#1C1C1E] mb-3 text-[0.875rem]">Tiến trình 6 bước (SOP SMC Training)</h3>
        <div className="flex flex-wrap gap-1 items-center">
          {[
            { step: 'B1', label: 'Đăng ký', done: stepStatus.step1 },
            { step: 'B2', label: 'Thanh toán', done: stepStatus.step2 },
            { step: 'B3', label: 'Đối soát', done: stepStatus.step3 },
            { step: 'B4', label: 'Kích hoạt', done: stepStatus.step4 },
            { step: 'B5', label: 'Xếp lớp', done: stepStatus.step5 },
            { step: 'B6', label: 'Phân GV', done: stepStatus.step6 },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 text-xs">→</span>}
              <span className={`badge text-[0.6875rem] ${
                item.done ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-black/5 text-[#AEAEB2]'
              }`}>
                {item.done ? '✓' : '○'} {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-white rounded-full h-2 overflow-hidden">
          <div className="h-full bg-[#34C759] rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-[0.75rem] text-[#8E8E93] mt-1">{progressPercent}% hoàn tất ({completedSteps}/6 bước)</p>
      </div>

      {/* Quick Stats — iOS style */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Payment Status Card */}
        <div className={`bg-white rounded-2xl p-4 shadow-ios border-l-4 ${
          paymentStatus === 'paid'
            ? 'border-l-[#34C759]'
            : paymentStatus === 'partial'
            ? 'border-l-[#FF9500]'
            : 'border-l-[#FF3B30]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              paymentStatus === 'paid'
                ? 'bg-[#34C759]/10 text-[#34C759]'
                : paymentStatus === 'partial'
                ? 'bg-[#FF9500]/10 text-[#FF9500]'
                : 'bg-[#FF3B30]/10 text-[#FF3B30]'
            }`}>
              {paymentStatus === 'paid'
                ? <CheckCircle className="w-5 h-5" />
                : paymentStatus === 'partial'
                ? <AlertTriangle className="w-5 h-5" />
                : <Clock className="w-5 h-5" />
              }
            </div>
            <div className="min-w-0">
              <div className={`text-[0.875rem] font-semibold truncate ${
                paymentStatus === 'paid' ? 'text-[#34C759]' : paymentStatus === 'partial' ? 'text-[#FF9500]' : 'text-[#FF3B30]'
              }`}>
                {paymentStatus === 'paid' ? '✅ Đã thanh toán đủ' : paymentStatus === 'partial' ? '⚠️ Chưa thanh toán đủ' : '⏳ Chưa thanh toán'}
              </div>
              <div className="text-[0.75rem] text-[#8E8E93]">
                Học phí: {formatPrice(coursePrice)}
                {coursePrice > 0 && totalPaid > 0 && ` — Đã đóng: ${formatPrice(totalPaid)}`}
              </div>
              {remainingDue > 0 && (
                <div className="text-[0.6875rem] text-red-500 mt-0.5">
                  Còn thiếu: {formatPrice(remainingDue)}
                </div>
              )}
            </div>
          </div>
          {paymentStatus === 'partial' && myTuition?.dueDate && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Hạn: {new Date(myTuition.dueDate).toLocaleDateString('vi-VN')}
              {new Date(myTuition.dueDate) < new Date() && <span className="font-bold ml-1">— QUÁ HẠN!</span>}
            </div>
          )}
          {paymentStatus === 'paid' && myTuition?.paidDate && (
            <div className="mt-2 text-[0.75rem] text-[#34C759]">
              Đã xác nhận: {new Date(myTuition.paidDate).toLocaleDateString('vi-VN')}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-ios">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <div className="text-lg font-bold">{myCourse?.name || 'Chưa chọn'}</div>
              <div className="text-[0.75rem] text-[#8E8E93]">Khóa học</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-ios">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
              <School className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1C1C1E]">{myClass?.name || '—'}</div>
              <div className="text-[0.75rem] text-[#8E8E93]">Lớp học</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-ios">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#AF52DE]/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#AF52DE]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1C1C1E]">{classTeacherNames}</div>
              <div className="text-[0.75rem] text-[#8E8E93]">Giảng viên</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-ios">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#34C759]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1C1C1E]">{modules.length}</div>
              <div className="text-[0.75rem] text-[#8E8E93]">Mô-đun học</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs — iOS segmented style */}
      <div className="flex gap-0.5 p-0.5 bg-black/5 rounded-xl mb-5">
        {[
          { id: 'overview', label: '📋 Tổng quan' },
          { id: 'modules', label: '📚 Mô-đun học' },
          { id: 'practice', label: '✈️ Thực hành' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-[0.8125rem] font-medium px-3 py-2 rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-[#1C1C1E] shadow-sm'
                : 'text-[#8E8E93]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Tổng quan */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Course info + Teacher */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-ios">
              <h3 className="font-semibold text-[#1C1C1E] mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#007AFF]" /> Thông tin khóa học
              </h3>
              {myCourse ? (
                <div className="space-y-2 text-[0.875rem]">
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Mã khóa học:</span><span className="font-medium">{myCourse.code || myCourse.id}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Tên khóa học:</span><span className="font-medium">{myCourse.name}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Học phí theo hạng:</span><span className="font-bold text-[#007AFF]">{formatPrice(myCourse.price)}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Đã đóng:</span><span className="font-medium text-green-600">{formatPrice(totalPaid)}</span></div>
                  {remainingDue > 0 && (
                    <div className="flex justify-between"><span className="text-[#8E8E93]">Còn phải đóng:</span><span className="font-medium text-red-500">{formatPrice(remainingDue)}</span></div>
                  )}
                  <hr className="my-1" />
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Lý thuyết:</span><span className="font-medium">{myCourse.total_hours_theory || 0}h</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Thực hành:</span><span className="font-medium">{myCourse.total_hours_practice || 0}h</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Ôn luyện:</span><span className="font-medium">{myCourse.total_hours_review || 0}h</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Tổng thời lượng:</span><span className="font-bold text-[#007AFF]">{(myCourse.total_hours_theory || 0) + (myCourse.total_hours_practice || 0) + (myCourse.total_hours_review || 0)}h</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">Giờ bay tối thiểu:</span><span className="font-medium">{myCourse.min_fly_hours || 0}h</span></div>
                </div>
              ) : myEnrollment ? (
                <div className="space-y-2 text-[0.875rem]">
                  <div className="flex justify-between">
                    <span className="text-[#8E8E93]">Trạng thái:</span>
                    <span className={`badge text-[0.6875rem] ${
                      myEnrollment.status === 'active' ? 'bg-[#34C759]/10 text-[#34C759]' :
                      myEnrollment.status === 'pending' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
                      'bg-black/5 text-[#AEAEB2]'
                    }`}>
                      {myEnrollment.status === 'active' ? 'Đang học' :
                       myEnrollment.status === 'pending' ? 'Chờ nhập học' : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E8E93]">Ngày đăng ký:</span>
                    <span className="font-medium">{myEnrollment.createdAt ? new Date(myEnrollment.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E8E93]">Lớp đã xếp:</span>
                    <span className="font-medium">{myClass?.name || 'Chưa xếp lớp'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8E8E93]">Đã đóng:</span>
                    <span className="font-medium text-green-600">{formatPrice(myEnrollment.payment?.paid || totalPaid)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-[#AEAEB2]">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-[0.875rem]">Chưa có thông tin khóa học</p>
                  <p className="text-[0.75rem] mt-1">Vui lòng liên hệ trung tâm để được tư vấn</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-ios">
              <h3 className="font-semibold text-[#1C1C1E] mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#AF52DE]" /> Giảng viên & Lớp học
              </h3>
              {classTeachers.length > 0 ? (
                <div className="space-y-2 text-[0.875rem]">
                  {classTeachers.length === 1 ? (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">Giảng viên:</span><span className="font-medium">{classTeachers[0].fullName}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Email:</span><span>{classTeachers[0].email}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">SĐT:</span><span>{classTeachers[0].phone || '—'}</span></div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">Giảng viên:</span><span className="font-medium">{classTeachers.length} giảng viên</span></div>
                      {classTeachers.map((t, i) => (
                        <div key={t.id} className="flex justify-between text-xs text-gray-500">
                          <span>{i+1}. {t.fullName}</span><span>{t.phone || t.email}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {myClass && (
                    <>
                      <hr className="my-2" />
                      <div className="flex justify-between"><span className="text-gray-500">Lớp:</span><span className="font-medium">{myClass.name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Hình thức:</span><span>{myClass.type === 'online' ? 'Online (Zoom)' : myClass.type === 'hybrid' ? 'Hybrid' : 'Offline'}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Địa điểm:</span><span>{myClass.location || 'SMC Center'}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Đang chờ phân công giảng viên</p>
                  <p className="text-xs mt-1">Hệ thống sẽ thông báo khi có lịch học</p>
                </div>
              )}
            </div>
          </div>

          {/* Class schedule */}
          {myClass?.schedule && myClass.schedule.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Lịch học
              </h3>
              <div className="space-y-2">
                {myClass.schedule.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        s.type === 'theory' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {s.type === 'theory' ? <BookOpen className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{s.day} — {s.time}</div>
                        <div className="text-xs text-gray-500 capitalize">{s.type === 'theory' ? 'Lý thuyết' : 'Thực hành'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      {s.location || 'SMC Center'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage progress */}
          {myEnrollment?.stages && (
            <div className="card p-5">
              <h3 className="font-bold text-gray-800 mb-3">Tiến độ đào tạo</h3>
              <div className="space-y-3">
                {Object.entries(myEnrollment.stages).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-4">
                    <div className="w-28 text-sm text-gray-600">
                      {key === 'enrollment' ? 'Tuyển sinh' :
                       key === 'theory' ? 'Lý thuyết' :
                       key === 'practice' ? 'Thực hành' :
                       key === 'exam' ? 'Sát hạch' : 'Chứng chỉ'}
                    </div>
                    <div className={`flex-1 h-2.5 rounded-full ${
                      val.status === 'completed' ? 'bg-green-500' :
                      val.status === 'in_progress' ? 'bg-amber-500' : 'bg-gray-200'
                    }`} />
                    <div className={`text-sm w-28 ${val.status === 'completed' ? 'text-green-600' : val.status === 'in_progress' ? 'text-amber-600' : 'text-gray-400'}`}>
                      {val.status === 'completed' ? '✓ Hoàn thành' :
                       val.status === 'in_progress' ? 'Đang học' : 'Chờ'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Modules */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {!isActive ? (
            <div className="card p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h3 className="font-bold text-gray-700 mb-2">Chưa có quyền truy cập</h3>
              <p className="text-sm text-gray-500 mb-4">
                Vui lòng hoàn tất thanh toán học phí để mở khóa toàn bộ tài liệu LMS.
              </p>
              <Link to="/student/thanh-toan" className="btn-primary inline-flex items-center gap-1">
                <Wallet className="w-4 h-4" /> Thanh toán ngay
              </Link>
            </div>
          ) : modules.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Chưa có mô-đun học tập</p>
            </div>
          ) : (
            modules.map((mod, i) => (
              <div key={mod.id || i} className="card p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 text-sm">{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{mod.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> Lý thuyết: {mod.hours_theory || 0}h</span>
                        <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Thực hành: {mod.hours_practice || 0}h</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Vào học
                    </button>
                  </div>
                </div>

                {/* Module resources */}
                <div className="mt-3 ml-12 grid sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors">
                    <Video className="w-3.5 h-3.5" /> Video bài giảng
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Tài liệu PDF
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors">
                    <Download className="w-3.5 h-3.5" /> Tải tài nguyên
                  </div>
                </div>
              </div>
            ))
          )}

          {isActive && modules.length > 0 && (
            <div className="card p-4 bg-blue-50 border-blue-200 mt-4">
              <p className="text-sm text-blue-700 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Truy cập đầy đủ LMS tại: <strong>lms.smc-training.com</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Practice */}
      {activeTab === 'practice' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Nhật ký bay
            </h3>
            <p className="text-sm text-gray-500">
              Ghi nhận giờ bay thực hành. Yêu cầu tối thiểu: <strong>{myCourse?.min_fly_hours || 20}h</strong>
            </p>
            <Link to="/student/nhat-ky-bay" className="btn-outline text-xs mt-3 inline-flex items-center gap-1">
              <ClipboardCheck className="w-3 h-3" /> Xem nhật ký bay <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <PenTool className="w-4 h-4" /> Luyện thi & Ôn tập
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link to="/student/luyen-thi" className="flex items-center gap-3 p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-all">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">Luyện thi trắc nghiệm</div>
                  <div className="text-[0.75rem] text-[#8E8E93]">Ngân hàng câu hỏi đầy đủ</div>
                </div>
              </Link>
              <Link to="/student/on-luyen-van-dap" className="flex items-center gap-3 p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-all">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">Ôn luyện vấn đáp</div>
                  <div className="text-[0.75rem] text-[#8E8E93]">Câu hỏi phỏng vấn thực tế</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
