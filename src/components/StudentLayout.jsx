import SidebarLayout from './SidebarLayout';
import { BookOpen, School, FileText, PenTool, Monitor, ClipboardCheck, Award, User, Wallet } from 'lucide-react';

export default function StudentLayout() {
  return (
    <SidebarLayout
      title="Học viên SMC"
      icon={BookOpen}
      iconColor="text-emerald-400"
      links={[
        { to: '/student', label: 'Tổng quan', icon: BookOpen },
        { to: '/student/thanh-toan', label: 'Thanh toán học phí', icon: Wallet },
        { to: '/student/lop-hoc', label: 'Lớp học của tôi', icon: School },
        { to: '/student/tai-lieu', label: 'Tài liệu học tập', icon: FileText },
        { to: '/student/on-luyen-van-dap', label: 'Ôn luyện vấn đáp', icon: PenTool },
        { to: '/student/luyen-thi', label: 'Luyện thi', icon: PenTool },
        { to: '/student/kiem-tra', label: 'Kiểm tra', icon: Monitor },
        { to: '/student/nhat-ky-bay', label: 'Nhật ký bay', icon: ClipboardCheck },
        { to: '/student/chung-chi', label: 'Chứng chỉ', icon: Award },
        { to: '/student/ho-so', label: 'Hồ sơ cá nhân', icon: User },
      ]}
    />
  );
}
