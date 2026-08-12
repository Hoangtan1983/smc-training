import { useState, useRef } from 'react';
import { FileText, Upload, Download, Trash2, Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

// Store files base64 data in memory + localStorage as cache/fallback
const FILE_CACHE_KEY = 'smc_staff_documents';

export default function StaffDocuments() {
  const [files, setFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FILE_CACHE_KEY) || '[]'); }
    catch { return []; }
  });
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  const saveFiles = (updated) => {
    setFiles(updated);
    try { localStorage.setItem(FILE_CACHE_KEY, JSON.stringify(updated)); } catch {}
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limit file size to 5MB for localStorage
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File quá lớn. Vui lòng chọn file dưới 5MB (sẽ có upload server trong bản sau)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const id = 'doc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const updated = [{ id, name: file.name, size: file.size, type: file.type, data: reader.result, uploadedAt: new Date().toISOString() }, ...files];
      saveFiles(updated);
      toast.success('Đã upload tài liệu!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDelete = (id) => {
    saveFiles(files.filter(f => f.id !== id));
    toast.success('Đã xóa!');
  };
  const handleDownload = (file) => { const a = document.createElement('a'); a.href = file.data; a.download = file.name; a.click(); };

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Tài liệu đào tạo</h1><p className="text-sm text-gray-500 mt-0.5">{files.length} tài liệu</p></div>
        <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex items-center gap-2"><Upload className="w-4 h-4" /> Upload tài liệu</button>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.zip" onChange={handleUpload} className="hidden" />
      </div>
      <div className="relative mb-6"><Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm tài liệu..." /></div>
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có tài liệu nào</p></div>
      ) : (
        <div className="space-y-2">{filtered.map(f => (
          <div key={f.id} className="card p-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><FileText className="w-5 h-5 text-amber-500" /></div><div><div className="font-medium text-gray-900 text-sm">{f.name}</div><div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB • {new Date(f.uploadedAt).toLocaleDateString('vi-VN')}</div></div></div>
            <div className="flex gap-1"><button onClick={() => handleDownload(f)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Download className="w-4 h-4" /></button><button onClick={() => handleDelete(f.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
