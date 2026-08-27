import { useState, useRef, useEffect } from 'react';
import { Presentation, Upload, Download, Trash2, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUploadFile, apiGetFiles, apiDeleteFile } from '../../data/api';

export default function TeacherLectures() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    try {
      const data = await apiGetFiles('lectures');
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      // fallback to localStorage cache
      try { setFiles(JSON.parse(localStorage.getItem('smc_teacher_lectures') || '[]')); } catch {}
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await apiUploadFile(file, 'lectures');
      toast.success('Đã upload bài giảng lên server!');
      await loadFiles();
    } catch (err) {
      toast.error('Lỗi upload: ' + (err.message || 'Không thể kết nối'));
    }
    e.target.value = '';
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteFile(id);
      toast.success('Đã xóa!');
      await loadFiles();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const handleDownload = (file) => {
    if (file.url) window.open(file.url, '_blank');
    else if (file.path) window.open('/api/' + file.path, '_blank');
  };

  const filtered = files.filter(f => (f.name || f.originalName || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Bài giảng</h1><p className="text-sm text-gray-500 mt-0.5">{files.length} file</p></div>
        <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" /> Upload bài giảng</button>
        <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.mp4,.zip" onChange={handleUpload} className="hidden" />
      </div>

      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm bài giảng..." /></div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><Presentation className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có bài giảng nào</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-500" /></div><div><div className="font-medium text-gray-900 text-sm">{f.name || f.originalName}</div><div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB • {new Date(f.uploadedAt).toLocaleDateString('vi-VN')}</div></div></div>
              <div className="flex gap-1">
                <button onClick={() => handleDownload(f)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Tải xuống"><Download className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(f.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
