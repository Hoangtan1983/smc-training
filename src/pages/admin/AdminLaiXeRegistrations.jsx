import { useState, useCallback, useEffect } from 'react';
import { Trash2, Bike, Phone, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiLaxeList, apiLaxeUpdate, apiLaxeDelete } from '../../data/api';

const STATUS = [
  { key: 'new', label: 'Mới', color: 'bg-blue-100 text-blue-700' },
  { key: 'contacted', label: 'Đã liên hệ', color: 'bg-amber-100 text-amber-700' },
  { key: 'enrolled', label: 'Đã ghi danh', color: 'bg-green-100 text-green-700' },
  { key: 'cancelled', label: 'Đã huỷ', color: 'bg-gray-100 text-gray-600' },
];

function statusMeta(key) {
  return STATUS.find(s => s.key === key) || STATUS[0];
}

export default function AdminLaiXeRegistrations() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [license, setLicense] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiLaxeList({ status, license });
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Lỗi tải danh sách: ' + (e.message || 'Không thể kết nối'));
    } finally {
      setLoading(false);
    }
  }, [status, license]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const changeStatus = async (reg, newStatus) => {
    try {
      await apiLaxeUpdate(reg.id, { status: newStatus });
      toast.success('Đã cập nhật trạng thái');
      await load();
    } catch (e) {
      toast.error('Lỗi: ' + (e.message || 'Không thể kết nối'));
    }
  };

  const editNote = async (reg) => {
    const note = window.prompt('Ghi chú cho ' + reg.fullName + ':', reg.note || '');
    if (note === null) return;
    try {
      await apiLaxeUpdate(reg.id, { note });
      toast.success('Đã lưu ghi chú');
      await load();
    } catch (e) {
      toast.error('Lỗi: ' + (e.message || 'Không thể kết nối'));
    }
  };

  const remove = async (reg) => {
    if (!window.confirm(`Xoá đăng ký của "${reg.fullName}"?`)) return;
    try {
      await apiLaxeDelete(reg.id);
      toast.success('Đã xoá');
      await load();
    } catch (e) {
      toast.error('Lỗi: ' + (e.message || 'Không thể kết nối'));
    }
  };

  const filtered = list.filter(r =>
    (r.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.phone || '').includes(search) ||
    (r.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('vi-VN');
  };

  if (loading) return <div className="text-center py-12"><div className="spinner mx-auto mb-4" /><p className="text-gray-500">Đang tải...</p></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Đăng ký đào tạo lái xe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Học viên đăng ký từ trang lái xe (tách biệt với UAV)</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-auto">
          <option value="">Tất cả trạng thái</option>
          {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select value={license} onChange={e => setLicense(e.target.value)} className="input-field w-auto">
          <option value="">Tất cả hạng</option>
          <option value="A1">Hạng A1</option>
          <option value="A">Hạng A</option>
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Tìm tên / SĐT / email..." />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có đăng ký nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const meta = statusMeta(r.status);
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{r.fullName}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {r.phone}
                      {r.email ? ` • ${r.email}` : ''}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Hạng {r.licenseType} • Đăng ký {formatDate(r.createdAt)}
                      {r.note ? ` • Ghi chú: ${r.note}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                    <select
                      value={r.status}
                      onChange={e => changeStatus(r, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600"
                    >
                      {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button onClick={() => editNote(r)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg text-xs" title="Ghi chú">Ghi chú</button>
                    <button onClick={() => remove(r)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Xoá"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
