import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { apiGetFiles, apiFileUrl } from '../data/api';

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetFiles('public-images');
        const list = Array.isArray(data) ? data : [];
        setImages(list.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f.name || '')));
      } catch {
        setImages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Chú thích lấy từ "Mô tả" (description) trước; nếu chưa có thì lấy "Tiêu đề"
  // nhưng chỉ khi tiêu đề đã được sửa khác tên file gốc.
  const captionOf = (img) => {
    const desc = (img.description || '').trim();
    if (desc) return desc;
    if (img.title && img.title !== img.name) return img.title;
    return '';
  };

  return (
    <div className="pt-10 pb-12">
      <div className="page-container">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Hình ảnh hoạt động</h1>
            <p className="text-lg text-gray-500">Hình ảnh đào tạo và hoạt động tại SMC Training</p>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>
          ) : images.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-gray-400">Thư viện ảnh đang được cập nhật. Vui lòng quay lại sau.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {images.map((img) => {
                const caption = captionOf(img);
                return (
                  <figure key={img.id} className="text-center">
                    <img
                      src={apiFileUrl(img.id)}
                      alt={img.title || img.name || ''}
                      className="w-full h-auto rounded-2xl shadow-sm"
                      loading="lazy"
                    />
                    {caption && (
                      <figcaption className="mt-3 text-sm text-gray-500 italic">{caption}</figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
