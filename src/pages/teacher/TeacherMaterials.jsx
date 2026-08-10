import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Monitor, BookOpen, BookMarked, Filter } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'all', label: 'Tất cả', icon: Filter },
  { key: 'presentation', label: 'Thuyết trình', icon: Monitor },
  { key: 'lecture', label: 'Bài giảng', icon: BookOpen },
  { key: 'lesson_plan', label: 'Giáo án', icon: FileText },
  { key: 'syllabus', label: 'Giáo trình', icon: BookMarked },
];

const TAB_ICONS = {
  presentation: Monitor,
  lecture: BookOpen,
  lesson_plan: FileText,
  syllabus: BookMarked,
};

const TAB_COLORS = {
  presentation: 'text-blue-600 bg-blue-50',
  lecture: 'text-green-600 bg-green-50',
  lesson_plan: 'text-orange-600 bg-orange-50',
  syllabus: 'text-purple-600 bg-purple-50',
};

export default function TeacherMaterials() {
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

  const filteredFiles = activeTab === 'all'
    ? files
    : files.filter(f => (f.type || f.file_type || f.category || '') === activeTab);

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
        title="Tài liệu giảng dạy"
        subtitle="Tổng hợp tất cả tài liệu đã tải lên"
      />

      {/* Filter tabs */}
      <div className="tab-bar mb-6 flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={activeTab === tab.key ? 'tab-item-active tab-item' : 'tab-item'}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                ({files.filter(f => (f.type || f.file_type || f.category || '') === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có tài liệu nào"
          description={activeTab !== 'all' ? `Chưa có tài liệu loại "${TABS.find(t => t.key === activeTab)?.label}" nào.` : 'Chưa có tài liệu nào được tải lên.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map(file => {
            const fileType = file.type || file.file_type || file.category || 'other';
            const TabIcon = TAB_ICONS[fileType] || FileText;
            const colorClass = TAB_COLORS[fileType] || 'text-gray-600 bg-gray-50';
            const typeLabel = TABS.find(t => t.key === fileType)?.label || 'Tài liệu';

            return (
              <div key={file.id} className="card card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-ios-lg ${colorClass} flex items-center justify-center`}>
                    <TabIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="badge badge-neutral text-xs">{typeLabel}</span>
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
