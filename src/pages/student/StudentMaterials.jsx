import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Monitor, BookOpen, Video, File } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all', label: 'Tất cả', icon: FileText },
  { key: 'pdf', label: 'PDF', icon: File },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'slide', label: 'Slide', icon: Monitor },
];

export default function StudentMaterials() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getFiles();
      const allFiles = res.data || res.files || [];
      setFiles(allFiles);
    } catch (err) {
      setError(err.message || 'Không thể tải tài liệu.');
      toast.error('Không thể tải danh sách tài liệu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const getFileType = (file) => {
    const name = (file.original_name || file.originalName || file.name || file.filename || '').toLowerCase();
    if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi') || name.endsWith('.webm')) return 'video';
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || name.endsWith('.key')) return 'slide';
    if (name.endsWith('.pdf')) return 'pdf';
    return 'other';
  };

  const filteredFiles = activeTab === 'all'
    ? files
    : files.filter(f => getFileType(f) === activeTab);

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

  const getFileIcon = (file) => {
    const type = getFileType(file);
    switch (type) {
      case 'video': return Video;
      case 'slide': return Monitor;
      case 'pdf': return File;
      default: return FileText;
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
      <PageHeader title="Tài liệu học tập" subtitle="Tài liệu được chia sẻ cho lớp học của bạn" />

      <div className="tab-bar mb-6 flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có tài liệu nào" description="Lớp của bạn chưa có tài liệu được chia sẻ." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map(file => {
            const FileIcon = getFileIcon(file);
            return (
              <div key={file.id} className="card card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-ios-lg bg-smc-50 flex items-center justify-center">
                    <FileIcon className="w-5 h-5 text-smc-600" />
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
