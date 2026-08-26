import { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, UserPlus, Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { apiGetAgencies } from '../../data/api';

const TEMPLATE_DATA = [
  ['Họ tên', 'Số điện thoại', 'Email', 'Hạng thi', 'Học phí', 'Đã nộp', 'Địa chỉ', 'Ghi chú'],
  ['Nguyễn Văn A', '0901000111', 'vana@email.com', 'Hạng A', '15000000', '5000000', 'Hà Nội', ''],
  ['Trần Thị B', '0901000222', 'thib@email.com', 'Hạng B', '20000000', '0', 'TP.HCM', 'Đã tư vấn'],
];

const EMPTY_STUDENT = { fullName: '', phone: '', email: '', rank: '', tuition: '', paid: '', address: '', note: '' };

// Map tên cột Excel (tiếng Việt / tiếng Anh) sang field tiếng Anh mà backend mong đợi
const HEADER_MAP = {
  'họ tên': 'fullName', 'họ và tên': 'fullName', 'ho ten': 'fullName', 'ho và ten': 'fullName', 'fullname': 'fullName', 'name': 'fullName',
  'số điện thoại': 'phone', 'so dien thoai': 'phone', 'sđt': 'phone', 'sdt': 'phone', 'điện thoại': 'phone', 'dien thoai': 'phone', 'phone': 'phone',
  'email': 'email',
  'hạng thi': 'rank', 'hang thi': 'rank', 'hạng': 'rank', 'hang': 'rank', 'rank': 'rank',
};

// Các cột hiển thị trong bảng xem trước (dùng key tiếng Anh đã map)
const PREVIEW_COLUMNS = [
  { label: 'Họ tên', key: 'fullName' },
  { label: 'Số điện thoại', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Hạng thi', key: 'rank' },
];

export default function AgencyImportStudents() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [fileStudents, setFileStudents] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'manual'

  // ── Manual entry state ──
  const [manualStudents, setManualStudents] = useState([{ ...EMPTY_STUDENT }]);
  const [agencies, setAgencies] = useState([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');

  useEffect(() => {
    apiGetAgencies().then(res => {
      setAgencies(Array.isArray(res) ? res : (res?.data || []));
    }).catch(() => {});
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length < 2) {
          toast.error('File không có dữ liệu');
          return;
        }
        const headers = data[0].map(h => String(h).trim());
        const rows = data.slice(1).filter(r => r.some(c => c !== undefined && c !== ''));
        // Map cột sang field tiếng Anh (backend mong đợi fullName/phone/email/rank)
        const mappedRows = rows.map(r => {
          const obj = {};
          headers.forEach((h, i) => {
            const key = HEADER_MAP[String(h).toLowerCase()] || String(h).toLowerCase();
            obj[key] = r[i] !== undefined ? String(r[i]).trim() : '';
          });
          return obj;
        });
        setFileStudents(mappedRows);
        setPreview(mappedRows.slice(0, 10));
      } catch (err) {
        toast.error('Không thể đọc file. Vui lòng kiểm tra định dạng.');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_DATA);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Học viên');
    XLSX.writeFile(wb, 'mau-nhap-hoc-vien-dai-ly.xlsx');
  };

  // ── Import từ file Excel ──
  const handleFileImport = async () => {
    if (!file || fileStudents.length === 0) {
      toast.error('Vui lòng chọn file có dữ liệu học viên');
      return;
    }
    setImporting(true);
    try {
      const token = localStorage.getItem('smc-token');

      const res = await fetch('/api/agency.php?action=import-students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students: fileStudents, agencyId: selectedAgencyId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      toast.success(data.message);
    } catch (e) {
      toast.error(e.message || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  };

  // ── Manual entry helpers ──
  const addRow = () => {
    setManualStudents(prev => [...prev, { ...EMPTY_STUDENT }]);
  };

  const removeRow = (index) => {
    if (manualStudents.length <= 1) return;
    setManualStudents(prev => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    setManualStudents(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // ── Import từ form thủ công (gửi JSON array) ──
  const handleManualImport = async () => {
    // Validate
    const validStudents = manualStudents.filter(s => s.fullName.trim() !== '');
    if (validStudents.length === 0) {
      toast.error('Vui lòng nhập ít nhất 1 học viên');
      return;
    }

    // Kiểm tra thiếu SĐT hoặc Email
    const missing = validStudents.filter(s => !s.phone.trim() && !s.email.trim());
    if (missing.length > 0) {
      toast.error(`Có ${missing.length} học viên thiếu cả SĐT và Email. Vui lòng bổ sung.`);
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem('smc-token');

      // Convert form data sang format API expects (English keys + wrap trong students)
      const rows = validStudents.map(s => ({
        fullName: s.fullName.trim(),
        phone: s.phone.trim(),
        email: s.email.trim(),
        rank: s.rank.trim(),
      }));

      const res = await fetch('/api/agency.php?action=import-students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students: rows, agencyId: selectedAgencyId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      toast.success(data.message);
      // Reset form nếu import thành công
      if (data.imported > 0) {
        setManualStudents([{ ...EMPTY_STUDENT }]);
      }
    } catch (e) {
      toast.error(e.message || 'Import thất bại');
    } finally {
      setImporting(false);
    }
  };

  // ── Hàm gọi chung cho nút "Nhập ngay" (theo tab active) ──
  const handleImport = () => {
    if (!selectedAgencyId) { toast.error('Vui lòng chọn đại lý trước khi nhập'); return; }
    if (activeTab === 'upload') {
      handleFileImport();
    } else {
      handleManualImport();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Nhập học viên cho Đại lý</h1>
        <p className="text-slate-500 mt-1">Upload file Excel/CSV hoặc nhập thủ công — học viên sẽ được gán vào đại lý bạn chọn bên dưới</p>
      </div>

      {/* ── Chọn đại lý ── */}
      <div className="card p-4">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Đại lý nhận học viên *</label>
        <select
          value={selectedAgencyId}
          onChange={e => setSelectedAgencyId(e.target.value)}
          className="input-field w-full sm:max-w-sm"
        >
          <option value="">— Chọn đại lý —</option>
          {agencies.map(a => (
            <option key={a.id} value={a.id}>{a.name || a.agent_name || a.agentName || a.code}</option>
          ))}
        </select>
        {!selectedAgencyId && <p className="text-xs text-amber-600 mt-1">Vui lòng chọn đại lý trước khi nhập</p>}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setActiveTab('upload'); setResults(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'upload'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload size={16} /> Upload Excel
        </button>
        <button
          onClick={() => { setActiveTab('manual'); setResults(null); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'manual'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus size={16} /> Nhập từng người
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB: Upload Excel */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'upload' && (
        <>
          {/* Template download */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-blue-600" />
              <div>
                <p className="font-medium text-blue-800">File mẫu Excel</p>
                <p className="text-sm text-blue-600">Tải file mẫu để biết cấu trúc dữ liệu cần nhập</p>
              </div>
            </div>
            <button onClick={downloadTemplate} className="btn-primary bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
              <Download size={16} /> Tải file mẫu
            </button>
          </div>

          {/* Upload area */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload size={40} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 font-medium">Kéo thả file vào đây hoặc click để chọn</p>
            <p className="text-sm text-slate-400 mt-1">Hỗ trợ: .xlsx, .xls, .csv</p>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg">
                <CheckCircle size={16} />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-green-600">({preview.length} dòng dữ liệu)</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Xem trước dữ liệu ({preview.length} học viên đầu tiên)</h3>
                <button onClick={handleImport} disabled={importing} className="btn-primary flex items-center gap-2">
                  {importing ? <><div className="spinner-small" /> Đang nhập...</> : <><Upload size={16} /> Nhập ngay</>}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {PREVIEW_COLUMNS.map((c) => (
                        <th key={c.key} className="px-4 py-2 text-left font-medium text-slate-600">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-slate-50">
                        {PREVIEW_COLUMNS.map((c) => (
                          <td key={c.key} className="px-4 py-2 text-slate-700">{row[c.key] || '---'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* TAB: Nhập từng người */}
      {/* ════════════════════════════════════════════════════════════ */}
      {activeTab === 'manual' && (
        <>
          {/* Form nhập liệu */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-slate-500" />
                <h3 className="font-semibold text-slate-800">
                  Nhập thủ công ({manualStudents.filter(s => s.fullName.trim()).length} học viên)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 rounded-lg border border-orange-200 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                >
                  <Plus size={14} /> Thêm dòng
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="btn-primary flex items-center gap-2"
                >
                  {importing ? <><div className="spinner-small" /> Đang nhập...</> : <><UserPlus size={16} /> Nhập ngay</>}
                </button>
              </div>
            </div>

            {/* Table header */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600 w-8">#</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">
                      Họ tên <span className="text-red-500">*</span>
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">Số điện thoại</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">Email</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">Hạng thi</th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-600">Học phí (VNĐ)</th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-600">Đã nộp (VNĐ)</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">Địa chỉ</th>
                    <th className="px-3 py-2.5 text-left font-medium text-slate-600">Ghi chú</th>
                    <th className="px-3 py-2.5 text-center font-medium text-slate-600 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {manualStudents.map((student, index) => (
                    <tr key={index} className={`border-t border-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2 text-slate-400 text-xs">{index + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.fullName}
                          onChange={(e) => updateRow(index, 'fullName', e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.phone}
                          onChange={(e) => updateRow(index, 'phone', e.target.value)}
                          placeholder="090xxxxxxx"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="email"
                          value={student.email}
                          onChange={(e) => updateRow(index, 'email', e.target.value)}
                          placeholder="email@example.com"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={student.rank}
                          onChange={(e) => updateRow(index, 'rank', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        >
                          <option value="">— Chọn hạng —</option>
                          <option value="A">Hạng A (VLOS)</option>
                          <option value="B">Hạng B (BVLOS)</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.tuition}
                          onChange={(e) => updateRow(index, 'tuition', e.target.value)}
                          placeholder="15.000.000"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.paid}
                          onChange={(e) => updateRow(index, 'paid', e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.address}
                          onChange={(e) => updateRow(index, 'address', e.target.value)}
                          placeholder="Địa chỉ"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={student.note}
                          onChange={(e) => updateRow(index, 'note', e.target.value)}
                          placeholder="Ghi chú"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeRow(index)}
                          disabled={manualStudents.length <= 1}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Xóa dòng"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Nút thêm dòng cuối bảng */}
            <div className="px-5 py-3 border-t border-gray-100 bg-slate-50/50">
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Thêm học viên
              </button>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-medium mb-1">Lưu ý khi nhập thủ công:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-600">
                <li>Họ tên là trường bắt buộc.</li>
                <li>Cần ít nhất SĐT hoặc Email để tạo tài khoản.</li>
                <li>Hạng thi (A/B) xác định khóa học và loại chứng chỉ. Sau khi nhập, Nhân viên sẽ duyệt và tạo hồ sơ học phí theo hạng.</li>
                <li>Mỗi học viên sẽ nhận email thông báo tài khoản (nếu có email).</li>
                <li>Có thể nhập nhiều học viên cùng lúc bằng cách thêm dòng mới.</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* Import Results (hiển thị chung cho cả 2 tab) */}
      {/* ════════════════════════════════════════════════════════════ */}
      {results && (
        <div className={`rounded-xl border p-6 ${results.errors?.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            {results.errors?.length ? (
              <AlertCircle size={24} className="text-amber-600" />
            ) : (
              <CheckCircle size={24} className="text-emerald-600" />
            )}
            <div>
              <h3 className="font-bold text-lg text-slate-800">
                {results.errors?.length ? 'Import hoàn tất (có lỗi)' : 'Import thành công!'}
              </h3>
              <p className="text-sm text-slate-600">
                Đã nhập: {results.imported} | Bỏ qua: {results.skipped} | Tổng: {results.total}
              </p>
            </div>
          </div>

          {results.errors?.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="font-medium text-amber-700">Lỗi:</p>
              {results.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-800 bg-amber-100 px-3 py-2 rounded-lg">
                  <XCircle size={14} />
                  {e}
                </div>
              ))}
            </div>
          )}

          {results.details?.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-emerald-700">Chi tiết:</p>
              {results.details.map((d, i) => (
                <p key={i} className="text-sm text-emerald-800">{d}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hướng dẫn cột */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-slate-800 mb-3">📋 Hướng dẫn cột dữ liệu</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {[
            { col: 'Họ tên', required: true, desc: 'Họ và tên đầy đủ của học viên (bắt buộc)' },
            { col: 'Số điện thoại', required: false, desc: 'Số điện thoại liên hệ (nên có)' },
            { col: 'Email', required: false, desc: 'Email học viên (dùng để đăng nhập, nên có)' },
            { col: 'Hạng thi', required: false, desc: 'Hạng A (VLOS) hoặc Hạng B (BVLOS). Nhân viên sẽ duyệt và tạo hồ sơ học phí theo hạng.' },
            { col: 'Học phí', required: false, desc: 'Học phí gốc (VNĐ). Để trống, Nhân viên sẽ xác định khi xếp khoá học.' },
            { col: 'Đã nộp', required: false, desc: 'Số tiền học viên đã nộp ban đầu (VNĐ). Để trống = 0đ.' },
            { col: 'Địa chỉ', required: false, desc: 'Địa chỉ thường trú' },
            { col: 'Ghi chú', required: false, desc: 'Ghi chú thêm về học viên' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 rounded-full mt-2 ${item.required ? 'bg-red-500' : 'bg-slate-300'}`} />
              <div>
                <p className="font-medium text-slate-700">
                  {item.col}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </p>
                <p className="text-slate-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
