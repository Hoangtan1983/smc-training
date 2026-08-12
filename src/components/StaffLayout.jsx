import SidebarLayout from './SidebarLayout';
import { Briefcase, Users, FileCheck, School, GraduationCap, FileText, BarChart3, BookOpen, Wallet, UserCheck, ArrowLeftRight, UserCircle, Building2 } from 'lucide-react';

export default function StaffLayout() {
  return (
    <SidebarLayout
      title="Nhân viên SMC"
      icon={Briefcase}
      iconColor="text-amber-400"
      links={[
        { to: '/staff', label: 'Tổng quan', icon: BarChart3 },
        { to: '/staff/duyet-tai-khoan', label: 'Duyệt tài khoản', icon: UserCheck },
        { to: '/staff/tuyen-sinh', label: 'Tuyển sinh', icon: FileCheck },
        { to: '/staff/khoa-hoc', label: 'Khóa học', icon: BookOpen },
        { to: '/staff/hoc-phi', label: 'Học phí & Vận hành', icon: Wallet },
        { to: '/staff/lop-hoc', label: 'Lớp học & Xếp lớp', icon: School },
        { to: '/staff/hoc-vien', label: 'Học viên', icon: Users },
        { to: '/staff/hoc-vien-quan-ly', label: 'Sửa thông tin HV', icon: Users },
        { to: '/staff/giang-vien', label: 'Giáo viên', icon: GraduationCap },
        { to: '/staff/doi-lop-bao-luu', label: 'Đổi lớp / Bảo lưu', icon: ArrowLeftRight },
        { to: '/staff/chung-chi', label: 'Chứng chỉ', icon: FileText },
        { to: '/staff/dai-ly', label: 'Đại lý', icon: Building2 },
        { to: '/staff/bao-cao', label: 'Báo cáo', icon: BarChart3 },
        { to: '/staff/tai-khoan', label: 'Tài khoản', icon: UserCircle },
      ]}
    />
  );
}
