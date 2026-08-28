import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { apiGetPosts } from '../../data/api';

export default function NewsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetPosts({ type: '' });
        const list = Array.isArray(data) ? data : [];
        // Chỉ hiện tin tức + sự kiện (bỏ trang tĩnh)
        setPosts(list.filter(p => p.type === 'article' || p.type === 'event'));
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="pt-10 pb-12">
      <div className="page-container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Tin tức & Sự kiện</h1>
            <p className="text-lg text-gray-500">Thông tin hoạt động, khai giảng và tin tức mới nhất của SMC Training</p>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-gray-400">Chưa có tin tức nào.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(p => (
                <Link key={p.id} to={`/tin-tuc/${p.slug || p.id}`} className="card p-4 flex items-center gap-4 hover:border-blue-200 transition-colors">
                  {p.coverImage ? (
                    <img src={p.coverImage} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><CalendarDays className="w-8 h-8 text-gray-300" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {p.type === 'event' && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Sự kiện</span>}
                      <span className="text-xs text-gray-400">{formatDate(p.eventDate || p.createdAt)}</span>
                    </div>
                    <div className="font-semibold text-gray-900 truncate">{p.title}</div>
                    {p.excerpt && <div className="text-sm text-gray-500 mt-1 line-clamp-2">{p.excerpt}</div>}
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
