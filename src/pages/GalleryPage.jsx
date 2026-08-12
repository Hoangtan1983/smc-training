import { Camera } from 'lucide-react';

export default function GalleryPage() {
  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Hình ảnh hoạt động</h1>
            <p className="text-lg text-gray-500">Hình ảnh đào tạo và hoạt động tại SMC Training</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div
                key={i}
                className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer border-2 border-dashed border-gray-200"
              >
                <div className="text-center">
                  <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <span className="text-xs text-gray-400">Đang cập nhật</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            Thư viện ảnh đang được cập nhật. Vui lòng quay lại sau.
          </p>
        </div>
      </div>
    </div>
  );
}
