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
        // Chỉ giữ các file ảnh để tránh render nhầm file khác trong category
        setImages(list.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f.name || '')));
      } catch {
        setImages([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-6xl mx-auto">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img) => (
                <a key={img.id} href={apiFileUrl(img.id)} target="_blank" rel="noreferrer" className="block">
                  <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden hover:opacity-90 transition-opacity">
                    <img src={apiFileUrl(img.id)} alt={img.title || img.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </a>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <p className="text-center text-sm text-gray-400 mt-6">
              {images.length} hình ảnh — bấm vào ảnh để xem kích thước đầy đủ
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
