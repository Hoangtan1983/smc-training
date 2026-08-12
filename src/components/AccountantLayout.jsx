import SidebarLayout from './SidebarLayout';
import { Calculator, BarChart3, FileCheck, Receipt, BookOpen, Wallet, UserCircle, Building2 } from 'lucide-react';

export default function AccountantLayout() {
  return (
    <SidebarLayout
      title="Kế toán SMC"
      icon={Calculator}
      iconColor="text-emerald-400"
      links={[
        { to: '/accountant', label: 'Tổng quan', icon: BarChart3, end: true },
        { to: '/accountant/duyet-phieu-thu', label: 'Duyệt phiếu thu', icon: FileCheck },
        { to: '/accountant/so-quy-tien-mat', label: 'Sổ quỹ tiền mặt', icon: Wallet },
        { to: '/accountant/doi-chieu-ngan-hang', label: 'Đối chiếu ngân hàng', icon: Receipt },
        { to: '/accountant/hoc-phi', label: 'Học phí & Vận hành', icon: BookOpen },
        { to: '/accountant/dai-ly', label: 'Đại lý & Hoa hồng', icon: Building2 },
        { to: '/accountant/bao-cao', label: 'Báo cáo tài chính', icon: BarChart3 },
        { to: '/accountant/tai-khoan', label: 'Tài khoản', icon: UserCircle },
      ]}
    />
  );
}
