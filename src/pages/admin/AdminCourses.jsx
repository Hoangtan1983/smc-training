import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Clock, Layers, BookOpen } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', price: 0, hours: 0, description: '', status: 'active',
    modules: [],
  });

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

  const openCreateModal = () => {
    setSelectedCourse(null);
    setForm({ name: '', price: 0, hours: 0, description: '', status: 'active', modules: [] });
    setModalOpen(true);
  };

  const openEditModal = (course) => {
    setSelectedCourse(course);
    setForm({
      name: course.name || course.course_name || '',
      price: course.price || 0,
      hours: course.hours || course.total_hours || 0,
      description: course.description || '',
      status: course.status || 'active',
      modules: course.modules || [],
    });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === 'price' || name === 'hours' ? Number(value) : value }));
  };

  const handleModuleChange = (index, field, value) => {
    setForm(prev => {
      const modules = [...prev.modules];
      modules[index] = { ...modules[index], [field]: value };
      return { ...prev, modules };
    });
  };

  const addModule = () => {
    setForm(prev => ({
      ...prev,
      modules: [...prev.modules, { name: '', hours_theory: 0, hours_practice: 0 }],
    }));
  };

  const removeModule = (index) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Vui lòng nhập tên khóa học.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (selectedCourse) {
        await api.updateCourse(selectedCourse.id, payload);
        toast.success('Cập nhật khóa học thành công.');
      } else {
        await api.createCourse(payload);
        toast.success('Tạo khóa học thành công.');
      }
      setModalOpen(false);
      fetchCourses();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu khóa học.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    try {
      await api.deleteCourse(selectedCourse.id);
      toast.success('Đã xóa khóa học.');
      setConfirmOpen(false);
      setSelectedCourse(null);
      fetchCourses();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa khóa học.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (course) => {
    setSelectedCourse(course);
    setConfirmOpen(true);
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
      <PageHeader
        title="Quản lý khóa học"
        subtitle="Quản lý nội dung và học phí các khóa đào tạo"
        action={
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Thêm khóa học
          </button>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Chưa có khóa học nào"
          description="Nhấn nút 'Thêm khóa học' để tạo khóa học đầu tiên"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <div key={course.id} className="card-hover">
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
                  onClick={() => openEditModal(course)}
                  className="btn-ghost btn-sm flex-1 text-blue-600 hover:bg-blue-50"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Sửa
                </button>
                <button
                  onClick={() => promptDelete(course)}
                  className="btn-ghost btn-sm flex-1 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCourse ? 'Sửa khóa học' : 'Thêm khóa học'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tên khóa học</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              className="input-field"
              placeholder="Nhập tên khóa học"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Học phí (VND)</label>
              <input
                name="price"
                type="number"
                value={form.price}
                onChange={handleFormChange}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="input-label">Tổng giờ</label>
              <input
                name="hours"
                type="number"
                value={form.hours}
                onChange={handleFormChange}
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Mô tả</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              className="input-field min-h-[80px]"
              placeholder="Mô tả khóa học..."
            />
          </div>
          <div>
            <label className="input-label">Trạng thái</label>
            <select name="status" value={form.status} onChange={handleFormChange} className="input-field">
              <option value="active">Hoạt động</option>
              <option value="inactive">Không hoạt động</option>
            </select>
          </div>

          {/* Modules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="input-label mb-0">Modules / Chương học</label>
              <button type="button" onClick={addModule} className="btn-ghost btn-sm text-smc-600 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Thêm module
              </button>
            </div>
            {form.modules.length === 0 && (
              <p className="text-xs text-gray-400">Chưa có module nào.</p>
            )}
            <div className="space-y-3">
              {form.modules.map((mod, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded-ios-lg">
                  <div className="flex-1 space-y-2">
                    <input
                      value={mod.name || ''}
                      onChange={e => handleModuleChange(idx, 'name', e.target.value)}
                      className="input-field text-sm"
                      placeholder={`Module ${idx + 1}`}
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={mod.hours_theory || 0}
                        onChange={e => handleModuleChange(idx, 'hours_theory', Number(e.target.value))}
                        className="input-field text-sm"
                        placeholder="Giờ lý thuyết"
                      />
                      <input
                        type="number"
                        value={mod.hours_practice || 0}
                        onChange={e => handleModuleChange(idx, 'hours_practice', Number(e.target.value))}
                        className="input-field text-sm"
                        placeholder="Giờ thực hành"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeModule(idx)}
                    className="p-1 text-red-400 hover:text-red-600 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : selectedCourse ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa khóa học?"
        message={`Bạn có chắc chắn muốn xóa khóa học "${selectedCourse?.name || selectedCourse?.course_name}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
