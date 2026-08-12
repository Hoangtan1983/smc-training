import { useState } from 'react';
import { FileText, Download, Search, BookOpen, ExternalLink, GraduationCap } from 'lucide-react';

// Cấu trúc tài liệu UAV theo học phần - được load từ thư mục /tai-lieu trên server
const TAI_LIEU_HOC_PHAN = {
  hangA: {
    name: 'Hạng A — Chứng chỉ UAV cơ bản',
    icon: '🅰️',
    hocPhans: [
      {
        id: 'A-HP1',
        name: 'Học phần 1: Kiến thức cơ bản về UAV',
        icon: '📚',
        folders: [
          {
            name: '1.1. Pháp luật quy định về UAV',
            folder: 'A-HP1-Phap-luat-quy-dinh-UAV',
            file: '1.1. Pháp luật quy định về UAV.pdf',
            size: '4.8 MB',
          },
          {
            name: '1.2. Khí tượng và môi trường bay',
            folder: 'A-HP1-Khi-tuong-moi-truong-bay',
            file: '1.2. Khí tượng và môi trường bay.pdf',
            size: '8.4 MB',
          },
          {
            name: '1.3. Quản lý không phận và UTM cơ bản',
            folder: 'A-HP1-Quan-ly-khong-phan-UTM',
            file: '1.3. Quản lý không phận và UTM cơ bản.pdf',
            size: '3.0 MB',
          },
        ],
      },
      {
        id: 'A-HP2',
        name: 'Học phần 2: Kiến thức hàng không & Thiết bị',
        icon: '✈️',
        folders: [
          {
            name: '2.1. Kiến thức hàng không cơ bản và nguyên lý bay',
            folder: 'A-HP2-Kien-thuc-hang-khong-nguyen-ly-bay',
            file: '2.1. Kiến thức hàng không cơ bản và nguyên lý bay.pdf',
            size: '6.9 MB',
          },
          {
            name: '2.2. Tổ hợp UAV và trang thiết bị đồng bộ',
            folder: 'A-HP2-To-hop-UAV-thiet-bi-dong-bo',
            file: '2.2. Tổ hợp UAV và trang thiết bị đồng bộ.pdf',
            size: '7.1 MB',
          },
        ],
      },
      {
        id: 'A-HP3',
        name: 'Học phần 3: Vận hành & Xử lý tình huống',
        icon: '🛡️',
        folders: [
          {
            name: '3.1. Vận hành an toàn và quy trình bay',
            folder: 'A-HP3-Van-hanh-an-toan-quy-trinh-bay',
            file: '3.1. Vận hành an toàn và quy trình bay.pdf',
            size: '7.2 MB',
          },
          {
            name: '3.2. Nhận biết và quản lý các mối đe dọa',
            folder: 'A-HP3-Nhan-biet-quan-ly-moi-de-doa',
            file: '3.2. Nhận biết và quản lý các mối đe dọa.pdf',
            size: '7.0 MB',
          },
          {
            name: '3.3. Xử lý tình huống bất thường',
            folder: 'A-HP3-Xu-ly-tinh-huong-bat-thuong',
            file: '3.3. Xử lý tình huống bất thường.pdf',
            size: '7.1 MB',
          },
        ],
      },
    ],
  },
  hangB: {
    name: 'Hạng B — Chứng chỉ UAV nâng cao (BVLOS)',
    icon: '🅱️',
    hocPhans: [
      {
        id: 'B-HP1',
        name: 'Học phần 1: Công nghệ & Khai thác BVLOS',
        icon: '🔬',
        folders: [
          {
            name: '1.1. Nguyên lý khai thác BVLOS',
            folder: 'B-HP1-Nguyen-ly-khai-thac-BVLOS',
            file: '1.1. Nguyên lý khai thác BVLOS.pdf',
            size: '7.1 MB',
          },
          {
            name: '1.2. Hệ thống và công nghệ BVLOS',
            folder: 'B-HP1-He-thong-cong-nghe-BVLOS',
            file: '1.2. Hệ thống và công nghệ BVLOS.pdf',
            size: '6.8 MB',
          },
          {
            name: '1.3. Tổ hợp UAV và trang thiết bị đồng bộ',
            folder: 'B-HP1-To-hop-UAV-thiet-bi-dong-bo',
            file: '1.3. Tổ hợp UAV và trang thiết bị đồng bộ.pdf',
            size: '8.1 MB',
          },
        ],
      },
      {
        id: 'B-HP2',
        name: 'Học phần 2: Kế hoạch bay & Xử lý khẩn cấp BVLOS',
        icon: '📋',
        folders: [
          {
            name: '2.1. Lập kế hoạch bay trong BVLOS',
            folder: 'B-HP2-Lap-ke-hoach-bay-BVLOS',
            file: '2.1. Lập kế hoạch bay trong BVLOS.pdf',
            size: '7.0 MB',
          },
          {
            name: '2.2. Nhận biết và quản lý các mối đe dọa phức tạp',
            folder: 'B-HP2-Nhan-biet-quan-ly-moi-de-doa-phuc-tap',
            file: '2.2. Nhận biết và quản lý các mối đe dọa phức tạp.pdf',
            size: '7.2 MB',
          },
          {
            name: '2.3. Xử lý các tình huống khẩn cấp trong BVLOS',
            folder: 'B-HP2-Xu-ly-tinh-huong-khan-cap-BVLOS',
            file: '2.3. Xử lý các tình huống khẩn cấp trong BVLOS.pdf',
            size: '7.1 MB',
          },
        ],
      },
    ],
  },
};

const BASE_URL = 'https://smc-training.com/tai-lieu';

export default function StudentMaterials() {
  const [search, setSearch] = useState('');
  const [expandedHang, setExpandedHang] = useState(null);
  const [expandedHP, setExpandedHP] = useState(null);

  const handleDownload = (folder, file) => {
    const url = `${BASE_URL}/${folder}/${encodeURI(file)}`;
    window.open(url, '_blank');
  };

  const handleView = (folder, file) => {
    const url = `${BASE_URL}/${folder}/${encodeURI(file)}`;
    window.open(url, '_blank');
  };

  // Đếm tổng số tài liệu
  const totalDocs = Object.values(TAI_LIEU_HOC_PHAN).reduce((sum, hang) => {
    return sum + hang.hocPhans.reduce((s, hp) => s + hp.folders.length, 0);
  }, 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Tài liệu học tập</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <strong>{totalDocs} tài liệu</strong> PDF được tổ chức theo học phần — Hạng A & Hạng B
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9"
          placeholder="Tìm kiếm tài liệu..."
        />
      </div>

      {/* Học phần theo Hạng */}
      {Object.entries(TAI_LIEU_HOC_PHAN).map(([hangKey, hangData]) => (
        <div key={hangKey} className="mb-6">
          {/* Hạng header */}
          <button
            onClick={() => setExpandedHang(expandedHang === hangKey ? null : hangKey)}
            className={`w-full card p-4 text-left flex items-center justify-between transition-all ${
              expandedHang === hangKey ? 'border-blue-300 bg-blue-50/30 ring-1 ring-blue-200' : 'hover:border-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{hangData.icon}</span>
              <div>
                <h2 className="font-bold text-gray-900">{hangData.name}</h2>
                <p className="text-xs text-gray-500">
                  {hangData.hocPhans.length} học phần • {hangData.hocPhans.reduce((s, hp) => s + hp.folders.length, 0)} tài liệu
                </p>
              </div>
            </div>
            <span className={`text-gray-400 transition-transform ${expandedHang === hangKey ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {/* Học phần con */}
          {expandedHang === hangKey && (
            <div className="ml-4 mt-2 space-y-3">
              {hangData.hocPhans.map(hp => {
                const isExpanded = expandedHP === hp.id;
                const searchMatch = !search || hp.folders.some(f =>
                  f.name.toLowerCase().includes(search.toLowerCase())
                );

                if (search && !searchMatch) return null;

                return (
                  <div key={hp.id} className="card overflow-hidden">
                    <button
                      onClick={() => setExpandedHP(isExpanded ? null : hp.id)}
                      className="w-full p-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{hp.icon}</span>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-800">{hp.name}</h3>
                          <p className="text-xs text-gray-400">{hp.folders.length} tài liệu PDF</p>
                        </div>
                      </div>
                      <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {hp.folders.map((doc, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-4 py-3 hover:bg-blue-50/30 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm text-gray-800 truncate">{doc.name}</div>
                                <div className="text-xs text-gray-400">PDF • {doc.size}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                              <button
                                onClick={() => handleView(doc.folder, doc.file)}
                                className="btn-ghost text-xs px-2.5 py-1.5 flex items-center gap-1"
                                title="Xem trực tuyến"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Xem
                              </button>
                              <button
                                onClick={() => handleDownload(doc.folder, doc.file)}
                                className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1"
                                title="Tải về"
                              >
                                <Download className="w-3.5 h-3.5" /> Tải
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Footer note */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
        <p className="text-xs text-blue-700 flex items-center justify-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          Tất cả tài liệu được lưu trữ trên máy chủ Mắt Bão — có thể xem trực tuyến hoặc tải về
        </p>
      </div>
    </div>
  );
}
