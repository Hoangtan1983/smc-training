import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import StaffLayout from './components/StaffLayout';
import AccountantLayout from './components/AccountantLayout';
import TeacherLayout from './components/TeacherLayout';
import StudentLayout from './components/StudentLayout';
import AgencyLayout from './components/AgencyLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUserManager from './pages/admin/AdminUserManager';
import AdminCourses from './pages/admin/AdminCourses';
import AdminClasses from './pages/admin/AdminClasses';
import AdminStudents from './pages/admin/AdminStudents';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminExams from './pages/admin/AdminExams';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminEnrollments from './pages/admin/AdminEnrollments';
import AdminTuition from './pages/admin/AdminTuition';
import AdminChangeRequests from './pages/admin/AdminChangeRequests';
import AdminAgencies from './pages/admin/AdminAgencies';
import AdminFiles from './pages/admin/AdminFiles';

// Staff
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffClasses from './pages/staff/StaffClasses';
import StaffStudents from './pages/staff/StaffStudents';
import StaffTeachers from './pages/staff/StaffTeachers';
import StaffCertificates from './pages/staff/StaffCertificates';
import StaffReports from './pages/staff/StaffReports';

// Teacher
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherClasses from './pages/teacher/TeacherClasses';
import TeacherStudents from './pages/teacher/TeacherStudents';
import TeacherPresentations from './pages/teacher/TeacherPresentations';
import TeacherLectures from './pages/teacher/TeacherLectures';
import TeacherLessonPlans from './pages/teacher/TeacherLessonPlans';
import TeacherSyllabus from './pages/teacher/TeacherSyllabus';
import TeacherExams from './pages/teacher/TeacherExams';
import TeacherFlyLogs from './pages/teacher/TeacherFlyLogs';
import TeacherExamGrading from './pages/teacher/TeacherExamGrading';
import TeacherSchedule from './pages/teacher/TeacherSchedule';
import TeacherMaterials from './pages/teacher/TeacherMaterials';
import StaffDocuments from './pages/staff/StaffDocuments';
import StaffCourses from './pages/staff/StaffCourses';
import StaffApprovals from './pages/staff/StaffApprovals';
import StaffChangeRequests from './pages/staff/StaffChangeRequests';
import StaffAgencies from './pages/staff/StaffAgencies';
import StaffUserManager from './pages/staff/StaffUserManager';
import StaffImportStudents from './pages/staff/StaffImportStudents';

// Student
import StudentDashboard from './pages/student/StudentDashboard';
import StudentClasses from './pages/student/StudentClasses';
import StudentMaterials from './pages/student/StudentMaterials';
import StudentPractice from './pages/student/StudentPractice';
import StudentExams from './pages/student/StudentExams';
import StudentFlyLogs from './pages/student/StudentFlyLogs';
import StudentCertificates from './pages/student/StudentCertificates';
import StudentProfile from './pages/student/StudentProfile';
import StudentExamSets from './pages/student/StudentExamSets';
import StudentExamPage from './pages/student/StudentExamPage';
import StudentExamResult from './pages/student/StudentExamResult';
import StudentExamHistory from './pages/student/StudentExamHistory';
import OralPractice from './pages/student/OralPractice';
import StudentPayment from './pages/student/StudentPayment';

// Agency
import AgencyDashboard from './pages/agency/AgencyDashboard';
import AgencyStudents from './pages/agency/AgencyStudents';
import AgencyImportStudents from './pages/agency/AgencyImportStudents';
import AgencyReport from './pages/agency/AgencyReport';
import AgencyProfile from './pages/agency/AgencyProfile';

// Accountant
import AccountantDashboard from './pages/accountant/AccountantDashboard';
import AccountantApprovals from './pages/accountant/AccountantApprovals';
import AccountantCashLedger from './pages/accountant/AccountantCashLedger';
import AccountantReports from './pages/accountant/AccountantReports';
import AccountantTuition from './pages/accountant/AccountantTuition';
import AccountantAgencies from './pages/accountant/AccountantAgencies';

// Public pages
import AboutPage from './pages/AboutPage';
import GalleryPage from './pages/GalleryPage';
import ExamSchedulePage from './pages/ExamSchedulePage';
import CertLookupPage from './pages/CertLookupPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedByRole({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    const redirectMap = { ADMIN: '/admin', STAFF: '/staff', ACCOUNTANT: '/accountant', TEACHER: '/teacher', STUDENT: '/student', AGENCY: '/agency' };
    return <Navigate to={redirectMap[user.role] || '/'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div></div>;

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="gioi-thieu" element={<AboutPage />} />
        <Route path="hinh-anh" element={<GalleryPage />} />
        <Route path="lich-thi" element={<ExamSchedulePage />} />
        <Route path="tra-cuu" element={<CertLookupPage />} />
      </Route>
      <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : user.role === 'STAFF' ? '/staff' : user.role === 'ACCOUNTANT' ? '/accountant' : user.role === 'TEACHER' ? '/teacher' : user.role === 'AGENCY' ? '/agency' : '/student'} replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/student" replace /> : <RegisterPage />} />
      <Route path="/profile" element={<ProtectedByRole><ProfilePage /></ProtectedByRole>} />

      {/* Admin */}
      <Route path="/admin/*" element={<ProtectedByRole role="ADMIN"><AdminLayout /></ProtectedByRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="nguoi-dung" element={<AdminUserManager />} />
        <Route path="tuyen-sinh" element={<AdminEnrollments />} />
        <Route path="khoa-hoc" element={<AdminCourses />} />
        <Route path="lop-hoc" element={<AdminClasses />} />
        <Route path="hoc-vien" element={<AdminStudents />} />
        <Route path="giang-vien" element={<AdminTeachers />} />
        <Route path="sat-hach" element={<AdminExams />} />
        <Route path="chung-chi" element={<AdminCertificates />} />
        <Route path="tai-lieu" element={<AdminFiles />} />
        <Route path="bao-cao" element={<AdminReports />} />
        <Route path="hoc-phi" element={<AdminTuition />} />
        <Route path="doi-lop-bao-luu" element={<AdminChangeRequests />} />
        <Route path="dai-ly" element={<AdminAgencies />} />
        <Route path="cai-dat" element={<AdminSettings />} />
        <Route path="tai-khoan" element={<ProfilePage embedded />} />
      </Route>

      {/* Staff */}
      <Route path="/staff/*" element={<ProtectedByRole role="STAFF"><StaffLayout /></ProtectedByRole>}>
        <Route index element={<StaffDashboard />} />
        <Route path="khoa-hoc" element={<StaffCourses />} />
        <Route path="duyet-tai-khoan" element={<StaffApprovals />} />
        <Route path="doi-lop-bao-luu" element={<StaffChangeRequests />} />
        <Route path="tai-lieu" element={<AdminFiles />} />
        <Route path="lop-hoc" element={<StaffClasses />} />
        <Route path="hoc-vien" element={<StaffStudents />} />
        <Route path="giang-vien" element={<StaffTeachers />} />
        <Route path="chung-chi" element={<StaffCertificates />} />
        <Route path="dai-ly" element={<StaffAgencies />} />
        <Route path="hoc-vien-quan-ly" element={<StaffUserManager />} />
        <Route path="nhap-hoc-vien" element={<StaffImportStudents />} />
        <Route path="bao-cao" element={<StaffReports />} />
        <Route path="tai-khoan" element={<ProfilePage embedded />} />
      </Route>

      {/* Teacher */}
      <Route path="/teacher/*" element={<ProtectedByRole role="TEACHER"><TeacherLayout /></ProtectedByRole>}>
        <Route index element={<TeacherDashboard />} />
        <Route path="lop-hoc" element={<TeacherClasses />} />
        <Route path="hoc-vien" element={<TeacherStudents />} />
        <Route path="tai-lieu" element={<TeacherMaterials />} />
        <Route path="thuyet-trinh" element={<TeacherPresentations />} />
        <Route path="bai-giang" element={<TeacherLectures />} />
        <Route path="giao-an" element={<TeacherLessonPlans />} />
        <Route path="giao-trinh" element={<TeacherSyllabus />} />
        <Route path="kiem-tra" element={<TeacherExams />} />
        <Route path="nhat-ky-bay" element={<TeacherFlyLogs />} />
        <Route path="sat-hach" element={<TeacherExamGrading />} />
        <Route path="lich-day" element={<TeacherSchedule />} />
      </Route>

      {/* Student */}
      <Route path="/student/*" element={<ProtectedByRole role="STUDENT"><StudentLayout /></ProtectedByRole>}>
        <Route index element={<StudentDashboard />} />
        <Route path="lop-hoc" element={<StudentClasses />} />
        <Route path="tai-lieu" element={<StudentMaterials />} />
        <Route path="on-luyen" element={<StudentPractice />} />
        <Route path="luyen-thi" element={<StudentExamSets />} />
        <Route path="luyen-thi/:examId" element={<StudentExamPage />} />
        <Route path="ket-qua/:resultId" element={<StudentExamResult />} />
        <Route path="lich-su-thi" element={<StudentExamHistory />} />
        <Route path="on-luyen-van-dap" element={<OralPractice />} />
        <Route path="kiem-tra" element={<StudentExams />} />
        <Route path="nhat-ky-bay" element={<StudentFlyLogs />} />
        <Route path="chung-chi" element={<StudentCertificates />} />
        <Route path="ho-so" element={<StudentProfile />} />
        <Route path="thanh-toan" element={<StudentPayment />} />
      </Route>

      {/* Agency */}
      <Route path="/agency/*" element={<ProtectedByRole role="AGENCY"><AgencyLayout /></ProtectedByRole>}>
        <Route index element={<AgencyDashboard />} />
        <Route path="hoc-vien" element={<AgencyStudents />} />
        <Route path="nhap-hoc-vien" element={<Navigate to="/agency" replace />} />
        <Route path="bao-cao" element={<AgencyReport />} />
        <Route path="tai-khoan" element={<AgencyProfile />} />
      </Route>

      {/* Accountant */}
      <Route path="/accountant/*" element={<ProtectedByRole role="ACCOUNTANT"><AccountantLayout /></ProtectedByRole>}>
        <Route index element={<AccountantDashboard />} />
        <Route path="duyet-phieu-thu" element={<AccountantApprovals />} />
        <Route path="so-quy-tien-mat" element={<AccountantCashLedger />} />
        <Route path="doi-chieu-ngan-hang" element={<AccountantReports />} />
        <Route path="hoc-phi" element={<AccountantTuition />} />
        <Route path="dai-ly" element={<AccountantAgencies />} />
        <Route path="bao-cao" element={<AccountantReports />} />
        <Route path="tai-khoan" element={<ProfilePage embedded />} />
      </Route>

      {/* Public cert lookup */}
      <Route path="/tra-cuu-chung-chi" element={<CertLookupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1C1C1E',
                color: '#FFFFFF',
                borderRadius: '14px',
                fontSize: '14px',
                padding: '12px 16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              },
            }}
          />
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
