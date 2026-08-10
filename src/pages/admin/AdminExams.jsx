import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, ClipboardList, Clock, Target, Trash2 } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function AdminExams() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('exams');
  const [form, setForm] = useState({
    name: '', course_id: '', questions: [], time_limit: 60, pass_score: 70,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [examsRes, coursesRes, qbRes] = await Promise.all([
        api.getExams(),
        api.getCourses(),
        api.getQuestionBank(),
      ]);
      setExams(examsRes.data || examsRes.exams || []);
      setCourses(coursesRes.data || coursesRes.courses || []);
      setQuestionBank(qbRes.data || qbRes.questions || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu sát hạch.');
      toast.error('Không thể tải dữ liệu sát hạch.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await api.getExamResults();
      setExamResults(res.data || res.results || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchResults();
  }, [fetchData, fetchResults]);

  const openCreateModal = () => {
    setSelectedExam(null);
    setForm({ name: '', course_id: courses[0]?.id || '', questions: [], time_limit: 60, pass_score: 70 });
    setModalOpen(true);
  };

  const openEditModal = (exam) => {
    setSelectedExam(exam);
    setForm({
      name: exam.name || exam.exam_name || '',
      course_id: exam.course_id || exam.courseId || courses[0]?.id || '',
      questions: exam.questions || [],
      time_limit: exam.time_limit || exam.timeLimit || 60,
      pass_score: exam.pass_score || exam.passScore || 70,
    });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: ['time_limit', 'pass_score'].includes(name) ? Number(value) : value,
    }));
  };

  const toggleQuestion = (question) => {
    setForm(prev => {
      const exists = prev.questions.find(q => q.id === question.id);
      if (exists) {
        return { ...prev, questions: prev.questions.filter(q => q.id !== question.id) };
      }
      return { ...prev, questions: [...prev.questions, question] };
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.course_id) {
      toast.error('Vui lòng nhập tên đề thi và chọn khóa học.');
      return;
    }
    setSaving(true);
    try {
      await api.createExam(form);
      toast.success(selectedExam ? 'Cập nhật đề thi thành công.' : 'Tạo đề thi thành công.');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu đề thi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setSaving(true);
    try {
      toast.success('Đã xóa đề thi.');
      setConfirmOpen(false);
      setSelectedExam(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa đề thi.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (exam) => {
    setSelectedExam(exam);
    setConfirmOpen(true);
  };

  const getCourseName = (exam) => {
    const course = courses.find(c => c.id === exam.course_id || c.id === exam.courseId);
    return course?.name || course?.course_name || exam.course_name || exam.courseName || '-';
  };

  const statusBadge = (score, passScore) => {
    if (score == null) return 'badge-neutral';
    return score >= (passScore || 70) ? 'badge-success' : 'badge-danger';
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
      <PageHeader
        title="Quản lý sát hạch"
        subtitle="Tạo và quản lý đề thi, xem kết quả"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Tạo đề thi
          </button>
        }
      />

      {/* Tabs */}
      <div className="tab-bar mb-6 inline-flex">
        <button
          onClick={() => setActiveTab('exams')}
          className={activeTab === 'exams' ? 'tab-item-active tab-item' : 'tab-item'}
        >
          <ClipboardList className="w-4 h-4 mr-1.5" />
          Đề thi
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={activeTab === 'results' ? 'tab-item-active tab-item' : 'tab-item'}
        >
          <Target className="w-4 h-4 mr-1.5" />
          Kết quả thi
        </button>
      </div>

      {activeTab === 'exams' ? (
        <div className="table-container">
          <div className="table-wrap">
            {exams.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Chưa có đề thi nào" description="Nhấn 'Tạo đề thi' để tạo mới" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tên đề thi</th>
                    <th>Khóa học</th>
                    <th>Số câu hỏi</th>
                    <th>Thời gian (phút)</th>
                    <th>Điểm đậu</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(exam => (
                    <tr key={exam.id}>
                      <td>
                        <span className="font-medium text-gray-900">{exam.name || exam.exam_name}</span>
                      </td>
                      <td className="text-gray-500 text-sm">{getCourseName(exam)}</td>
                      <td className="text-sm">
                        <span className="badge badge-info">{(exam.questions || []).length || exam.question_count || 0}</span>
                      </td>
                      <td className="text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {exam.time_limit || exam.timeLimit || 60} phút
                        </span>
                      </td>
                      <td className="text-sm font-medium">
                        {exam.pass_score || exam.passScore || 70}%
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(exam)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => promptDelete(exam)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            {examResults.length === 0 ? (
              <EmptyState icon={Target} title="Chưa có kết quả thi nào" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Học viên</th>
                    <th>Đề thi</th>
                    <th>Điểm số</th>
                    <th>Kết quả</th>
                    <th>Ngày thi</th>
                  </tr>
                </thead>
                <tbody>
                  {examResults.map((result, idx) => (
                    <tr key={result.id || idx}>
                      <td>
                        <span className="font-medium text-gray-900">
                          {result.student_name || result.studentName || result.student?.fullName || result.student?.full_name || result.student?.name || '-'}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {result.exam_name || result.examName || '-'}
                      </td>
                      <td className="text-sm font-semibold">{result.score ?? result.total_score ?? '-'}</td>
                      <td>
                        <span className={`badge ${statusBadge(result.score ?? result.total_score, result.pass_score || result.passScore || 70)}`}>
                          {(result.score ?? result.total_score) >= (result.pass_score || result.passScore || 70) ? 'Đậu' : 'Trượt'}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {result.date || result.exam_date || result.created_at || result.createdAt || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedExam ? 'Sửa đề thi' : 'Tạo đề thi'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tên đề thi</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập tên đề thi"
            />
          </div>
          <div>
            <label className="input-label">Khóa học</label>
            <select name="course_id" value={form.course_id} onChange={handleFormChange} className="input-field">
              <option value="">Chọn khóa học</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.course_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Thời gian (phút)</label>
              <input
                name="time_limit" type="number" value={form.time_limit}
                onChange={handleFormChange} className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Điểm đậu (%)</label>
              <input
                name="pass_score" type="number" value={form.pass_score}
                onChange={handleFormChange} className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="input-label">
              Chọn câu hỏi
              <span className="text-gray-400 text-xs ml-2">
                Đã chọn: {form.questions.length} / {questionBank.length}
              </span>
            </label>
            <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-ios-lg p-3 space-y-2">
              {questionBank.length === 0 ? (
                <p className="text-sm text-gray-400">Chưa có câu hỏi trong ngân hàng.</p>
              ) : (
                questionBank.map(q => (
                  <label
                    key={q.id}
                    className={`flex items-center gap-3 p-2 rounded-ios-lg cursor-pointer transition-all text-sm ${
                      form.questions.find(fq => fq.id === q.id)
                        ? 'bg-smc-50 ring-1 ring-smc-200'
                        : 'hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!form.questions.find(fq => fq.id === q.id)}
                      onChange={() => toggleQuestion(q)}
                      className="rounded accent-smc-500"
                    />
                    <span className="flex-1 line-clamp-1">{q.question || q.content || q.text}</span>
                    <span className="text-xs text-gray-400">{q.type || 'MC'}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedExam ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa đề thi?"
        message={`Bạn có chắc chắn muốn xóa đề thi "${selectedExam?.name || selectedExam?.exam_name}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
