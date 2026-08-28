import { useState, useEffect } from 'react';
import { apiGetPosts } from '../../data/api';

// Nạp nội dung trang lái xe từ CMS (bảng posts, page_key), hiện nội dung cứng dự phòng khi chưa có bài.
export default function LaiXePageContent({ pageKey, fallback }) {
  const [content, setContent] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetPosts({ type: 'page', pageKey });
        const arr = Array.isArray(data) ? data : [];
        setContent(arr[0]?.content ? arr[0].content : fallback);
      } catch {
        setContent(fallback);
      }
    })();
  }, [pageKey, fallback]);

  if (!content) {
    return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;
  }

  return (
    <div className="page-container py-10">
      <div className="max-w-3xl mx-auto">
        <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
