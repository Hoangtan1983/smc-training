import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Clock,
  Award,
  Calendar,
  ChevronRight,
  Shield,
  Users,
} from 'lucide-react';

export default function Dashboard() {
  const { user, ROLE_LABELS } = useAuth();

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="page-container">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Xin chào, {user?.fullName}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Chào mừng đến với hệ thống quản lý đào tạo SMC Training
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">2</div>
                <div className="text-xs text-gray-500">Khóa học UAV</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">140-296h</div>
                <div className="text-xs text-gray-500">Thời lượng đào tạo</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">2</div>
                <div className="text-xs text-gray-500">Chứng chỉ</div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">100%</div>
                <div className="text-xs text-gray-500">Tỷ lệ đỗ sát hạch</div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Enrollment Status */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Khóa học UAV Hạng A (VLOS)</h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tiến độ</span>
                <span className="font-semibold text-gray-700">0%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-smc-500 h-2 rounded-full" style={{ width: '0%' }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>M1 - Pháp luật & Quy định</span>
                <span>140 giờ</span>
              </div>
            </div>
          </div>

          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Thông tin tài khoản</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Họ tên</span>
                <span className="text-sm font-semibold text-gray-900">{user?.fullName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-semibold text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Vai trò</span>
                <span className={`badge ${ROLE_LABELS?.[user?.role]?.badge || 'badge-student'}`}>
                  {ROLE_LABELS?.[user?.role]?.label || user?.role}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Ngày tham gia</span>
                <span className="text-sm font-semibold text-gray-900">
                  {new Date(user?.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1 text-sm font-semibold text-smc-500 hover:text-smc-600 mt-2"
              >
                Xem chi tiết <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Admin Quick Actions */}
        {isAdmin && (
          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quản trị hệ thống</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                to="/admin/users"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Quản lý người dùng</div>
                  <div className="text-xs text-gray-500">Thêm, sửa, xóa tài khoản</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
              </Link>
              <Link
                to="/admin/courses"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-smc-300 hover:bg-smc-50 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-smc-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-smc-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Quản lý khóa học</div>
                  <div className="text-xs text-gray-500">Quản lý chương trình đào tạo</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
