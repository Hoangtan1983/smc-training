import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, ClipboardList, Clock, Target, Eye, Trash2 } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function TeacherExams() {
  const [exams, setExams] = useState([]);
  const [courses, setCourses] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu kiểm tra.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const openResultsModal = async (exam) => {
    setSelectedExam(exam);
    setResultsModalOpen(true);
    try {
      const res = await api.getExamResults({ exam_id: exam.id });
      setExamResults(res.data || res.results || []);
    } catch {
      setExamResults([]);
    }
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
      toast.error('Vui lòng nhập tên bài kiểm tra và chọn khóa học.');
      return;
    }
    setSaving(true);
    try {
      await api.createExam(form);
      toast.success(selectedExam ? 'Cập nhật bài kiểm tra thành công.' : 'Tạo bài kiểm tra thành công.');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu bài kiểm tra.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExam) return;
    setSaving(true);
    try {
      toast.success('Đã xóa bài kiểm tra.');
      setConfirmOpen(false);
      setSelectedExam(null);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa bài kiểm tra.');
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
        title="Kiểm tra"
        subtitle="Tạo và quản lý bài kiểm tra"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Tạo bài kiểm tra
          </button>
        }
      />

      {exams.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Chưa có bài kiểm tra nào" description='Nhấn "Tạo bài kiểm tra" để tạo mới' />
      ) : (
        <div className="table-container">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên bài kiểm tra</th>
                  <th>Khóa học</th>
                  <th>Số câu hỏi</th>
                  <th>Thời gian</th>
                  <th>Điểm đậu</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <span className="font-medium text-gray-900">{exam.name || exam.exam_name}</span>
                    </td>
                    <td className="text-gray-500 text-sm">{getCourseName(exam)}</td>
                    <td>
                      <span className="badge badge-info">{(exam.questions || []).length || exam.question_count || 0} câu</span>
                    </td>
                    <td className="text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {exam.time_limit || exam.timeLimit || 60} phút
                      </span>
                    </td>
                    <td className="text-sm font-medium">{exam.pass_score || exam.passScore || 70}%</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openResultsModal(exam)} className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50" title="Xem kết quả">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(exam)} className="btn-ghost btn-sm p-1.5 text-blue-600 hover:bg-blue-50" title="Sửa">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => promptDelete(exam)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedExam ? 'Sửa bài kiểm tra' : 'Tạo bài kiểm tra'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tên bài kiểm tra</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập tên bài kiểm tra"
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

      {/* Results Modal */}
      <Modal
        open={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        title={`Kết quả - ${selectedExam?.name || selectedExam?.exam_name || ''}`}
        size="lg"
      >
        {examResults.length === 0 ? (
          <div className="py-8">
            <EmptyState icon={Target} title="Chưa có kết quả thi" description="Chưa có học viên nào làm bài kiểm tra này." />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Điểm</th>
                  <th>Kết quả</th>
                  <th>Ngày thi</th>
                </tr>
              </thead>
              <tbody>
                {examResults.map((r, idx) => (
                  <tr key={r.id || idx}>
                    <td className="text-sm font-medium">
                      {r.student_name || r.studentName || r.student?.fullName || r.student?.full_name || r.student?.name || '-'}
                    </td>
                    <td className="text-sm font-semibold">{r.score ?? r.total_score ?? '-'}</td>
                    <td>
                      <span className={`badge ${(r.score ?? r.total_score) >= (r.pass_score || r.passScore || 70) ? 'badge-success' : 'badge-danger'}`}>
                        {(r.score ?? r.total_score) >= (r.pass_score || r.passScore || 70) ? 'Đậu' : 'Trượt'}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">{r.date || r.exam_date || r.created_at || r.createdAt || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa bài kiểm tra?"
        message={`Bạn có chắc chắn muốn xóa bài kiểm tra "${selectedExam?.name || selectedExam?.exam_name}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
