import { FileText, Download, ExternalLink, BookOpen, Search } from 'lucide-react';
import { useState } from 'react';

const documents = [
  { id: 1, title: 'Phụ lục 1 - Quy chế đào tạo UAV', type: 'PDF', size: '2.1 MB', module: 'M1' },
  { id: 2, title: 'Phụ lục 2 - Chương trình khung UAV Hạng A', type: 'PDF', size: '1.8 MB', module: 'M1' },
  { id: 3, title: 'Phụ lục 3 - Chương trình khung UAV Hạng B', type: 'PDF', size: '2.3 MB', module: 'M1' },
  { id: 4, title: 'Phụ lục 4 - Tiêu chuẩn sát hạch', type: 'PDF', size: '1.5 MB', module: 'M1' },
  { id: 5, title: 'M1 - Pháp luật & Quy định về UAV', type: 'PDF', size: '4.2 MB', module: 'M1' },
  { id: 6, title: 'M2 - Khí tượng & Môi trường bay', type: 'PDF', size: '3.8 MB', module: 'M2' },
  { id: 7, title: 'M3 - Quản lý không phận & UTM', type: 'PDF', size: '3.1 MB', module: 'M3' },
  { id: 8, title: 'M4 - Kiến thức hàng không & Nguyên lý bay', type: 'PDF', size: '5.1 MB', module: 'M4' },
  { id: 9, title: 'M5 - Tổ hợp UAV & Thiết bị đồng bộ', type: 'PDF', size: '4.5 MB', module: 'M5' },
  { id: 10, title: 'M6 - Vận hành an toàn & Quy trình bay', type: 'PDF', size: '6.2 MB', module: 'M6' },
  { id: 11, title: 'M7 - Nhận biết & Quản lý mối đe dọa', type: 'PDF', size: '3.4 MB', module: 'M7' },
  { id: 12, title: 'M8 - Xử lý tình huống bất thường', type: 'PDF', size: '2.9 MB', module: 'M8' },
];

export default function DocumentsPage() {
  const [search, setSearch] = useState('');
  const filtered = documents.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

  const modules = [...new Set(filtered.map(d => d.module))];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Tài liệu</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tài liệu học tập chính thức cho các khóa UAV</p>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm kiếm tài liệu..." />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />Không tìm thấy tài liệu
        </div>
      ) : (
        <div className="space-y-6">
          {modules.map(mod => (
            <div key={mod}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{mod}</h3>
              <div className="space-y-2">
                {filtered.filter(d => d.module === mod).map(doc => (
                  <div key={doc.id} className="card p-4 flex items-center justify-between group hover:border-smc-200 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{doc.title}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.type} • {doc.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <button className="p-2 text-gray-400 hover:text-smc-500 hover:bg-smc-50 rounded-lg transition-colors" title="Xem">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-smc-500 hover:bg-smc-50 rounded-lg transition-colors" title="Tải xuống">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
