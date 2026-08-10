import { useState, useEffect, useCallback } from 'react';
import { BookOpen, UserCheck, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentClasses() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyEnrollments();
      const data = res.data || res.enrollments || [];
      setEnrollments(data);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Khóa học của tôi" subtitle="Các khóa học bạn đã đăng ký" />

      {enrollments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Chưa đăng ký khóa học nào"
          description="Bạn chưa đăng ký khóa học nào. Liên hệ trung tâm để được tư vấn."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrollments.map(enr => (
            <div key={enr.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-smc-600" />
                </div>
                <span className={`badge ${enr.status === 'ACTIVE' || enr.status === 'active' ? 'badge-success' : enr.status === 'COMPLETED' || enr.status === 'completed' ? 'badge-info' : 'badge-neutral'}`}>
                  {enr.status === 'ACTIVE' || enr.status === 'active' ? 'Đang học' :
                   enr.status === 'COMPLETED' || enr.status === 'completed' ? 'Hoàn thành' :
                   enr.status || 'N/A'}
                </span>
              </div>

              <h3 className="font-bold text-gray-900 mb-1">{enr.course_name || enr.courseName || enr.course?.name || '-'}</h3>
              <p className="text-sm text-gray-500 mb-3">{enr.class_name || enr.className || enr.class?.name || '-'}</p>

              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Tiến độ</span>
                  <span className="font-medium">{enr.progress || enr.training_progress || 0}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-smc-500 h-2 rounded-full transition-all"
                    style={{ width: `${enr.progress || enr.training_progress || 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {enr.start_date || enr.startDate || '-'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {enr.end_date || enr.endDate || '-'}
                </span>
              </div>

              {(enr.modules || enr.lessons) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Nội dung khóa học</p>
                  <div className="space-y-1.5">
                    {(enr.modules || enr.lessons || []).map((mod, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle className={`w-3.5 h-3.5 ${mod.completed ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className={mod.completed ? 'text-gray-700' : 'text-gray-400'}>{mod.name || mod.title || `Module ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
