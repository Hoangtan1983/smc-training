import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, File, Download, Trash2, Film, Presentation } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import SearchInput from '../../components/ui/SearchInput';
import toast from 'react-hot-toast';

const FILE_TYPE_OPTIONS = ['PDF', 'Video', 'Slide', 'Tài liệu', 'Khác'];

const typeIconMap = {
  PDF: FileText, Video: Film, Slide: Presentation,
  'Tài liệu': FileText, Khác: File,
};

const typeColorMap = {
  PDF: 'bg-red-100 text-red-600', Video: 'bg-purple-100 text-purple-600',
  Slide: 'bg-orange-100 text-orange-600', 'Tài liệu': 'bg-blue-100 text-blue-600',
  Khác: 'bg-gray-100 text-gray-600',
};

const formatFileSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function StaffDocuments() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'PDF', file: null });

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFiles();
      setFiles(res.data || res.files || []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tài liệu.');
      toast.error('Không thể tải danh sách tài liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter(f => {
    const s = search.toLowerCase();
    const title = (f.title || f.name || '').toLowerCase();
    return title.includes(s);
  });

  const handleUpload = async () => {
    if (!uploadForm.file) {
      toast.error('Vui lòng chọn file để upload.');
      return;
    }
    if (!uploadForm.title) {
      toast.error('Vui lòng nhập tiêu đề tài liệu.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('type', uploadForm.type);
      await api.uploadFile(formData);
      toast.success('Upload tài liệu thành công.');
      setUploadOpen(false);
      setUploadForm({ title: '', type: 'PDF', file: null });
      fetchFiles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi upload tài liệu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.deleteCourse(selectedFile.id);
      toast.success('Đã xóa tài liệu.');
      setConfirmOpen(false);
      setSelectedFile(null);
      fetchFiles();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa tài liệu.');
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (file) => {
    setSelectedFile(file);
    setConfirmOpen(true);
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
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
        title="Quản lý tài liệu"
        subtitle="Upload và quản lý tài liệu đào tạo"
        action={
          <button
            onClick={() => {
              setUploadForm({ title: '', type: 'PDF', file: null });
              setUploadOpen(true);
            }}
            className="btn-primary"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload tài liệu
          </button>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên tài liệu..." />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có tài liệu nào" description="Nhấn 'Upload tài liệu' để thêm tài liệu đầu tiên" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(file => {
            const TypeIcon = typeIconMap[file.type] || File;
            const typeColor = typeColorMap[file.type] || 'bg-gray-100 text-gray-600';
            return (
              <div key={file.id} className="card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-ios-lg flex items-center justify-center ${typeColor}`}>
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <span className="badge badge-neutral text-xs">{file.type || 'Khác'}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2">
                  {file.title || file.name || 'Không tên'}
                </h3>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>{formatFileSize(file.size || file.file_size)}</span>
                  <span>{formatDate(file.created_at || file.createdAt || file.upload_date)}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {file.url || file.download_url ? (
                    <a
                      href={file.url || file.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm flex-1 text-smc-600 hover:bg-smc-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> Tải về
                    </a>
                  ) : (
                    <span className="btn-ghost btn-sm flex-1 text-gray-400 text-center">
                      <File className="w-3.5 h-3.5 mr-1" /> Xem
                    </span>
                  )}
                  <button
                    onClick={() => promptDelete(file)}
                    className="btn-ghost btn-sm text-red-500 hover:bg-red-50 w-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload tài liệu"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Tiêu đề</label>
            <input
              value={uploadForm.title}
              onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
              className="input-field"
              placeholder="Nhập tiêu đề tài liệu"
            />
          </div>
          <div>
            <label className="input-label">Loại tài liệu</label>
            <select
              value={uploadForm.type}
              onChange={e => setUploadForm(prev => ({ ...prev, type: e.target.value }))}
              className="input-field"
            >
              {FILE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Chọn file</label>
            <div className="mt-1 flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-ios-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploadForm.file ? (
                    <>
                      <File className="w-8 h-8 text-smc-500 mb-1" />
                      <p className="text-sm text-gray-700 font-medium">{uploadForm.file.name}</p>
                      <p className="text-xs text-gray-400">{formatFileSize(uploadForm.file.size)}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-1" />
                      <p className="text-sm text-gray-500">Kéo thả file hoặc nhấn để chọn</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Video, PowerPoint, Word</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadForm(prev => ({
                        ...prev,
                        file,
                        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
                      }));
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setUploadOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleUpload} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Xóa tài liệu?"
        message={`Bạn có chắc chắn muốn xóa tài liệu "${selectedFile?.title || selectedFile?.name}" không?`}
        confirmText="Xóa"
        variant="danger"
      />
    </div>
  );
}
