import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Clock, Layers, Eye } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

export default function StaffCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCourses();
      setCourses(res.data || res.courses || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách khóa học.');
      toast.error('Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openDetail = (course) => {
    setSelectedCourse(course);
    setDetailOpen(true);
  };

  const statusBadge = (status) => {
    const map = { active: 'badge-success', ACTIVE: 'badge-success', inactive: 'badge-neutral', INACTIVE: 'badge-neutral' };
    return map[status] || 'badge-neutral';
  };

  const statusLabel = {
    active: 'Hoạt động', ACTIVE: 'Hoạt động',
    inactive: 'Không hoạt động', INACTIVE: 'Không hoạt động',
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchCourses} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Quản lý khóa học" subtitle="Xem thông tin các khóa đào tạo" />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Chưa có khóa học nào"
          description="Liên hệ quản trị viên để tạo khóa học mới"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div key={course.id} className="card-hover cursor-pointer" onClick={() => openDetail(course)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-smc-600" />
                </div>
                <span className={`badge ${statusBadge(course.status)}`}>
                  {statusLabel[course.status] || course.status}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-2">
                {course.name || course.course_name}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span className="font-semibold text-smc-600">{formatVND(course.price)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {course.hours || course.total_hours || 0}h
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {(course.modules || []).length || course.module_count || 0}
                </span>
              </div>
              {course.description && (
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{course.description}</p>
              )}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={(e) => { e.stopPropagation(); openDetail(course); }}
                  className="btn-ghost btn-sm flex-1 text-smc-600 hover:bg-smc-50"
                >
                  <Eye className="w-3.5 h-3.5 mr-1" /> Xem chi tiết
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Chi tiết khóa học"
        size="lg"
      >
        {selectedCourse && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-ios-xl">
              <div className="w-14 h-14 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-smc-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedCourse.name || selectedCourse.course_name}</h3>
                <p className="text-sm text-smc-600 font-semibold">{formatVND(selectedCourse.price)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Tổng giờ:</span>{' '}
                <span className="font-medium">{selectedCourse.hours || selectedCourse.total_hours || 0}h</span>
              </div>
              <div>
                <span className="text-gray-400">Trạng thái:</span>{' '}
                <span className={`badge ${statusBadge(selectedCourse.status)}`}>
                  {statusLabel[selectedCourse.status] || selectedCourse.status}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Số module:</span>{' '}
                <span className="font-medium">{(selectedCourse.modules || []).length || selectedCourse.module_count || 0}</span>
              </div>
            </div>

            {selectedCourse.description && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Mô tả</h4>
                <p className="text-sm text-gray-500 bg-gray-50 rounded-ios-lg p-3">{selectedCourse.description}</p>
              </div>
            )}

            {(selectedCourse.modules || []).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Chương học</h4>
                <div className="space-y-2">
                  {(selectedCourse.modules || []).map((mod, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-ios-lg text-sm">
                      <span className="font-medium text-gray-900">{mod.name || `Module ${idx + 1}`}</span>
                      <span className="text-gray-400">
                        {mod.hours_theory || 0}h LT + {mod.hours_practice || 0}h TH
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
