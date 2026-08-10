import { useState, useEffect, useCallback } from 'react';
import { FileText, Upload, Download, Trash2 } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function FileManager({ type, label, iconColor, Icon }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', file: null });

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFiles();
      const allFiles = res.data || res.files || [];
      const filtered = allFiles.filter(f =>
        (f.type || f.file_type || f.category || '') === type
      );
      setFiles(filtered);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách.');
      toast.error('Không thể tải danh sách.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const openUploadModal = () => {
    setForm({ title: '', description: '', file: null });
    setUploadModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!form.title || !form.file) {
      toast.error('Vui lòng nhập tiêu đề và chọn file.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', form.file);
      fd.append('title', form.title);
      fd.append('description', form.description || '');
      fd.append('type', type);
      await api.uploadFile(fd);
      toast.success('Tải lên thành công.');
      setUploadModalOpen(false);
      fetchFiles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tải lên.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      toast.success('Đã xóa file.');
      setConfirmOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa file.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (file) => {
    setSelectedFile(file);
    setConfirmOpen(true);
  };

  const getFileName = (file) => {
    return file.original_name || file.originalName || file.name || file.file_name || file.filename || 'unknown';
  };

  const getFileDate = (file) => {
    return file.created_at || file.createdAt || file.upload_date || file.uploadDate || '-';
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
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
          <button onClick={fetchFiles} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title={`Bài ${label}`}
        subtitle={`Quản lý bài ${label}`}
        action={
          <button onClick={openUploadModal} className="btn-primary">
            <Upload className="w-4 h-4 mr-2" />
            Tải lên
          </button>
        }
      />

      {files.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`Chưa có bài ${label} nào`}
          description={`Nhấn "Tải lên" để thêm bài ${label} mới.`}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map(file => (
            <div key={file.id} className="card card-hover">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-ios-lg ${iconColor} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={file.url || file.download_url || file.path || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost btn-sm p-1.5 text-green-600 hover:bg-green-50"
                    title="Tải xuống"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); promptDelete(file); }}
                    className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">
                {file.title || file.name || getFileName(file)}
              </h3>
              {file.description && (
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{file.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto">
                <FileText className="w-3 h-3" />
                <span className="truncate">{getFileName(file)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{formatDate(getFileDate(file))}</p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title={`Tải lên bài ${label}`}
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tiêu đề</label>
            <input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="input-field"
              placeholder={`Nhập tiêu đề bài ${label}`}
            />
          </div>
          <div>
            <label className="input-label">Mô tả</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="input-field"
              rows={3}
              placeholder="Nhập mô tả (không bắt buộc)"
            />
          </div>
          <div>
            <label className="input-label">Chọn file</label>
            <div className="border-2 border-dashed border-gray-200 rounded-ios-xl p-6 text-center hover:border-smc-300 transition-colors">
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-2">Kéo thả file vào đây hoặc nhấn để chọn</p>
              <input
                type="file"
                onChange={handleFileChange}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-ios-lg file:border-0 file:text-sm file:font-semibold file:bg-smc-50 file:text-smc-700 hover:file:bg-smc-100"
              />
              {form.file && (
                <p className="text-xs text-smc-600 mt-2 font-medium">{form.file.name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setUploadModalOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleUpload} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Tải lên'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title={`Xóa bài ${label}?`}
        message={`Bạn có chắc chắn muốn xóa bài ${label} "${selectedFile?.title || getFileName(selectedFile)}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}