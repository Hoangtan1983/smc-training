import { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { apiGetFiles, apiFileUrl } from '../data/api';

// Trích mã video từ một URL YouTube (watch/embed/shorts/youtu.be)
function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

export default function VideoPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGetFiles('videos');
        setVideos(Array.isArray(data) ? data : []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="pt-20 pb-12">
      <div className="page-container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Video</h1>
            <p className="text-lg text-gray-500">Video hoạt động đào tạo và hướng dẫn của SMC Training</p>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>
          ) : videos.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-gray-400">Video sẽ được cập nhật tại đây.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {videos.map(v => {
                const yt = youtubeId(v.description);
                return (
                  <div key={v.id} className="card p-4">
                    {yt ? (
                      <div className="aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${yt}`}
                          title={v.title || v.name}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <video controls className="w-full aspect-video rounded-xl bg-black" src={apiFileUrl(v.id)} />
                    )}
                    <h3 className="font-semibold text-gray-900 mt-3 text-center">{v.title || v.name}</h3>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
