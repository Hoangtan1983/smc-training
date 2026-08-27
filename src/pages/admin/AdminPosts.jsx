import { useState, useCallback, useEffect } from 'react';
import { Plus, Pencil, Trash2, Newspaper, CalendarDays, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGetPosts, apiCreatePost, apiUpdatePost, apiDeletePost } from '../../data/api';
import RichTextEditor from '../../components/RichTextEditor';

const TABS = [
  { key: 'article', label: 'Tin tức', icon: Newspaper },
  { key: 'event', label: 'Sự kiện', icon: CalendarDays },
  { key: 'page', label: 'Trang tĩnh', icon: FileText },
];

const PAGE_OPTIONS = [
  { key: 'gioi-thieu', label: 'Giới thiệu (/gioi-thieu)' },
  { key: 'lich-thi', label: 'Lịch thi (/lich-thi)' },
];

const EMPTY_FORM = { id: null, title: '', excerpt: '', content: '', coverImage: '', status: 'draft', eventDate: '', pageKey: 'gioi-thieu' };

export default function AdminPosts() {
  const [tab, setTab] = useState('article');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const data = await apiGetPosts({ type: tab });
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Lỗi tải danh sách: ' + (e.message || 'Không thể kết nối'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { setLoading(true); loadPosts(); }, [loadPosts]);

  const openCreate = () => { setForm({ ...EMPTY_FORM, pageKey: 'gioi-thieu' }); setShowModal(true); };
  const openEdit = (p) => {
    setForm({
      id: p.id, title: p.title || '', excerpt: p.excerpt || '', content: p.content || '',
      coverImage: p.coverImage || '', status: p.status || 'draft',
      eventDate: p.eventDate || '', pageKey: p.pageKey || 'gioi-thieu',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Nhập tiêu đề'); return; }
    setSaving(true);
    try {
      const payload = {
        type: tab, title: form.title, excerpt: form.excerpt, content: form.content,
        coverImage: form.coverImage, status: form.status,
      };
      if (tab === 'event') payload.eventDate = form.eventDate;
      if (tab === 'page') payload.pageKey = form.pageKey;

      if (form.id) await apiUpdatePost(form.id, payload);
      else await apiCreatePost(payload);

      toast.success(form.id ? 'Đã lưu' : 'Đã tạo bài viết');
      setShowModal(false);
      await loadPosts();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Xóa "${p.title}"?`)) return;
    try {
      await apiDeletePost(p.id);
      toast.success('Đã xóa');
      await loadPosts();
    } catch (err) {
      toast.error('Lỗi: ' + (err.message || 'Không thể kết nối'));
    }
  };

  const filtered = posts.filter(p => (p.title || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Bài viết</h1>
          <p className="text-sm text-gray-500 mt-0.5">Viết tin tức, sự kiện và nội dung các trang trên website</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Viết bài mới</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm..." />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400"><p>Chưa có bài nào. Bấm "Viết bài mới" để bắt đầu.</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {p.coverImage ? (
                  <img src={p.coverImage} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-gray-400" /></div>
                )}
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{p.title}</div>
                  <div className="text-xs text-gray-400">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.status === 'published' ? 'Đã đăng' : 'Nháp'}
                    </span>
                    {tab === 'event' && p.eventDate ? ` • ${p.eventDate}` : ''}
                    {tab === 'page' && p.pageKey ? ` • /${p.pageKey}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(p)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg" title="Sửa"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{form.id ? 'Sửa bài viết' : 'Viết bài mới'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Tiêu đề *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Tiêu đề bài viết" />
              </div>

              {tab === 'page' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Trang áp dụng</label>
                  <select value={form.pageKey} onChange={e => setForm({ ...form, pageKey: e.target.value })} className="input-field">
                    {PAGE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </div>
              )}

              {tab === 'event' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Ngày diễn ra</label>
                  <input type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="input-field" />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Mô tả ngắn</label>
                <input value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} className="input-field" placeholder="Một câu tóm tắt (hiện ở danh sách)" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Ảnh bìa (URL)</label>
                <input value={form.coverImage} onChange={e => setForm({ ...form, coverImage: e.target.value })} className="input-field" placeholder="Dán link ảnh từ mục 'Hình ảnh công khai' (sao chép link)" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nội dung</label>
                <RichTextEditor value={form.content} onChange={(html) => setForm({ ...form, content: html })} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Trạng thái</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="draft">Nháp (chưa hiện công khai)</option>
                  <option value="published">Đã đăng (hiện trên web)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Hủy</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null} Lưu bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
