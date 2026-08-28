import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { apiGetPostBySlug } from '../../data/api';

export default function NewsDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setPost(await apiGetPostBySlug(slug));
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const formatDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN');
  };

  return (
    <div className="pt-10 pb-12">
      <div className="page-container">
        <div className="max-w-3xl mx-auto">
          <Link to="/tin-tuc" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
            <ArrowLeft className="w-4 h-4" /> Tin tức & Sự kiện
          </Link>

          {loading ? (
            <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>
          ) : !post ? (
            <div className="text-center text-gray-400 py-12"><p>Không tìm thấy bài viết.</p></div>
          ) : (
            <article>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{post.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400 mb-6">
                <span className="inline-flex items-center gap-1"><CalendarDays className="w-4 h-4" /> {formatDate(post.eventDate || post.createdAt)}</span>
                {post.authorName && <span>• {post.authorName}</span>}
              </div>

              {post.coverImage && <img src={post.coverImage} alt="" className="w-full rounded-2xl mb-6" />}

              <div
                className="prose max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: post.content || '' }}
              />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
