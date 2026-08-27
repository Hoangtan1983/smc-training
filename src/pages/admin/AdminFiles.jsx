import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Trash2, FileText, Search, Link as LinkIcon, Pencil, X, Image as ImageIcon, FolderOpen, Lock, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUploadFile, apiGetFiles, apiDeleteFile, apiUpdateFile, apiFileUrl } from '../../data/api';

// Các tab phân loại tư liệu — khớp với quy ước category ở backend (api/auth.php)
const TABS = [
  { key: 'material-a', label: 'Hạng A (VLOS)', icon: GraduationCap, accept: '.pdf,.doc,.docx,.ppt,.pptx,.mp4,.zip', hint: 'Học viên hạng A mới nhìn thấy' },
  { key: 'material-b', label: 'Hạng B (BVLOS)', icon: GraduationCap, accept: '.pdf,.doc,.docx,.ppt,.pptx,.mp4,.zip', hint: 'Học viên hạng B mới nhìn thấy' },
  { key: 'public-images', label: 'Hình ảnh công khai', icon: ImageIcon, accept: '.jpg,.jpeg,.png,.gif', hint: 'Hiện trên trang web, ai cũng xem được' },
  { key: 'shared', label: 'Kho dùng chung', icon: FolderOpen, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.zip,.rar,.csv,.txt', hint: 'Lấy link gửi cho bất kỳ ai' },
  { key: 'internal', label: 'Tài liệu nội bộ', icon: Lock, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.csv,.txt', hint: 'Chỉ nhân viên nội bộ nhìn thấy' },
];

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

export default function AdminFiles() {
  const [tab, setTab] = useState('material-a');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null); // { id, title, description }
  const fileInputRef = useRef(null);

  const active = TABS.find(t => t.key === tab) || TABS[0];
  const ActiveIcon = active.icon;

  const loadFiles = useCallback(async () => {
    try {
      const data = await apiGetFiles(tab);
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Lỗi tải danh sách: ' + (e.message || 'Không thể kết nối'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { setLoading(true); loadFiles(); }, [loadFiles]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await apiUploadFile(file, tab);
      toast.success('Đã đăng: ' + file.name);
      await loadFiles();
    } catch (err) {
      toast.error('Lỗi upload: ' + (err.message || 'Không thể kết nối'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Xóa "${file.name}"? Không thể khôi phục.`)) return;
    try {
      await apiDeleteFile(file.id);
      toast.success('Đã xóa');
      await loadFiles();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const handleCopyLink = async (file) => {
    const url = window.location.origin + apiFileUrl(file.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Đã sao chép link');
    } catch {
      window.prompt('Sao chép link này:', url);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await apiUpdateFile(editing.id, { title: editing.title, description: editing.description });
      toast.success('Đã lưu');
      setEditing(null);
      await loadFiles();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const filtered = files.filter(f => ((f.name || '') + ' ' + (f.description || '')).toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Tài liệu & Tư liệu</h1>
          <p className="text-sm text-gray-500 mt-0.5">Đăng hình ảnh, tài liệu lên website mà không cần lập trình viên</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary flex items-center gap-2">
          {uploading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
          Đăng file vào "{active.label}"
        </button>
        <input ref={fileInputRef} type="file" accept={active.accept} onChange={handleUpload} className="hidden" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = t.key === tab;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mb-4">{active.hint}</p>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm..." />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <ActiveIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có file nào trong mục này</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-blue-500" /></div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{f.title || f.name}</div>
                  <div className="text-xs text-gray-400 truncate">{f.name}{f.description ? ' — ' + f.description : ''}</div>
                  <div className="text-xs text-gray-400">{formatSize(f.size)} • {f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('vi-VN') : ''}</div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <a href={apiFileUrl(f.id)} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Xem / Tải"><Download className="w-4 h-4" /></a>
                <button onClick={() => handleCopyLink(f)} className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg" title="Sao chép link"><LinkIcon className="w-4 h-4" /></button>
                <button onClick={() => setEditing({ id: f.id, title: f.title || '', description: f.description || '' })} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg" title="Sửa mô tả"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(f)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal sửa mô tả */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Sửa thông tin file</h3>
              <button onClick={() => setEditing(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="input-field" placeholder="Tiêu đề hiển thị" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className="input-field" rows={3} placeholder="Mô tả ngắn (tuỳ chọn)" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditing(null)} className="btn-ghost flex-1">Hủy</button>
              <button onClick={handleSaveEdit} className="btn-primary flex-1">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
