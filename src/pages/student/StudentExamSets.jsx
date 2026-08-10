import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, BarChart3, Target } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'VLOS', label: 'VLOS' },
  { key: 'BVLOS', label: 'BVLOS' },
];

export default function StudentExamSets() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExams();
      setExams(res.data || res.exams || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách đề thi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredExams = activeTab === 'all'
    ? exams
    : exams.filter(e =>
        (e.category || e.type || e.exam_type || '').toUpperCase() === activeTab.toUpperCase()
      );

  const getDifficultyLabel = (exam) => {
    const count = (exam.questions || []).length || exam.question_count || 0;
    if (count >= 50) return 'Khó';
    if (count >= 30) return 'Trung bình';
    return 'Dễ';
  };

  const getDifficultyBadge = (label) => {
    if (label === 'Khó') return 'badge-danger';
    if (label === 'Trung bình') return 'badge-warning';
    return 'badge-success';
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
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Luyện thi" subtitle="Chọn bộ đề thi để bắt đầu luyện tập" />

      <div className="tab-bar mb-6 flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredExams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có đề thi"
          description={activeTab !== 'all' ? `Chưa có đề thi loại ${activeTab}.` : 'Chưa có bộ đề thi nào.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map(exam => {
            const difficulty = getDifficultyLabel(exam);
            return (
              <div
                key={exam.id}
                className="card card-hover"
                onClick={() => navigate(`/student/luyen-thi/${exam.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-ios-lg bg-smc-100 flex items-center justify-center">
                    <ClipboardList className="w-6 h-6 text-smc-600" />
                  </div>
                  <span className={`badge ${getDifficultyBadge(difficulty)}`}>
                    {difficulty}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{exam.name || exam.exam_name}</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {(exam.course_name || exam.courseName || exam.category || exam.type || '').toUpperCase()}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    {(exam.questions || []).length || exam.question_count || 0} câu
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {exam.time_limit || exam.timeLimit || 60} phút
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Điểm đậu: {exam.pass_score || exam.passScore || 70}%</span>
                  <button className="btn-primary btn-sm">
                    <Target className="w-3.5 h-3.5 mr-1" />
                    Làm bài
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
