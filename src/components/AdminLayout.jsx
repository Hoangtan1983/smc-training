import SidebarLayout from './SidebarLayout';
import { Shield, BookOpen, School, Users, GraduationCap, Award, FileText, BarChart3, Settings, UserCog, DollarSign, UserCircle, Building2, FileCheck, FileImage, Newspaper } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
  const { hasPermission } = useAuth();
  return (
    <SidebarLayout
      title="Admin Dashboard"
      icon={Shield}
      iconColor="text-purple-400"
      links={[
        { to: '/admin', label: 'Tổng quan', icon: BarChart3 },
        { to: '/admin/tuyen-sinh', label: 'Tuyển sinh', icon: FileCheck },
        { to: '/admin/nguoi-dung', label: 'Người dùng', icon: UserCog },
        { to: '/admin/khoa-hoc', label: 'Khóa học', icon: BookOpen },
        { to: '/admin/lop-hoc', label: 'Lớp học', icon: School },
        { to: '/admin/hoc-vien', label: 'Học viên', icon: Users },
        { to: '/admin/giang-vien', label: 'Giáo viên', icon: GraduationCap },
        { to: '/admin/sat-hach', label: 'Sát hạch', icon: Award },
        { to: '/admin/chung-chi', label: 'Chứng chỉ', icon: FileText },
        { to: '/admin/tai-lieu', label: 'Tài liệu & Tư liệu', icon: FileImage },
        { to: '/admin/bai-viet', label: 'Bài viết', icon: Newspaper },
        { to: '/admin/bao-cao', label: 'Báo cáo', icon: BarChart3 },
        { to: '/admin/hoc-phi', label: 'Học phí', icon: DollarSign },
        { to: '/admin/doi-lop-bao-luu', label: 'Đổi lớp & Bảo lưu', icon: Shield },
        { to: '/admin/dai-ly', label: 'Đại lý', icon: Building2 },
        { to: '/admin/cai-dat', label: 'Cài đặt', icon: Settings },
        { to: '/admin/tai-khoan', label: 'Tài khoản', icon: UserCircle },
      ]}
    />
  );
}
