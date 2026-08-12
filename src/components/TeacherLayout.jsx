import SidebarLayout from './SidebarLayout';
import { GraduationCap, School, Users, FileText, PenTool, ClipboardCheck, Calendar, BookOpen, Presentation, ScrollText, BookMarked } from 'lucide-react';

export default function TeacherLayout() {
  return (
    <SidebarLayout
      title="Giáo viên SMC"
      icon={GraduationCap}
      iconColor="text-blue-400"
      links={[
        { to: '/teacher', label: 'Tổng quan', icon: BookOpen },
        { to: '/teacher/lop-hoc', label: 'Lớp học của tôi', icon: School },
        { to: '/teacher/hoc-vien', label: 'Học viên', icon: Users },
        { to: '/teacher/bai-giang', label: 'Bài giảng', icon: Presentation },
        { to: '/teacher/giao-an', label: 'Giáo án', icon: ScrollText },
        { to: '/teacher/giao-trinh', label: 'Giáo trình', icon: BookMarked },
        { to: '/teacher/thuyet-trinh', label: 'Thuyết trình', icon: FileText },
        { to: '/teacher/kiem-tra', label: 'Bài kiểm tra', icon: PenTool },
        { to: '/teacher/nhat-ky-bay', label: 'Nhật ký bay', icon: ClipboardCheck },
        { to: '/teacher/sat-hach', label: 'Sát hạch', icon: Award },
        { to: '/teacher/lich-day', label: 'Lịch giảng dạy', icon: Calendar },
      ]}
    />
  );
}

function Award(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>;
}
