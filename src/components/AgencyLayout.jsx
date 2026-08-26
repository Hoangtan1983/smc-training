import SidebarLayout from './SidebarLayout';
import { Building2, Users, BarChart3, UserCircle, Home } from 'lucide-react';

export default function AgencyLayout() {
  return (
    <SidebarLayout
      title="Đại lý SMC"
      icon={Building2}
      iconColor="text-orange-400"
      links={[
        { to: '/agency', label: 'Dashboard', icon: Home, end: true },
        { to: '/agency/hoc-vien', label: 'Học viên', icon: Users },
        { to: '/agency/bao-cao', label: 'Báo cáo', icon: BarChart3 },
        { to: '/agency/tai-khoan', label: 'Tài khoản', icon: UserCircle },
      ]}
    />
  );
}
