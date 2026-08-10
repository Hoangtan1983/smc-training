import { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const REQUIRED_FIELDS = ['full_name', 'email', 'phone'];
const OPTIONAL_FIELDS = ['course_name', 'address', 'notes'];

export default function AgencyImportStudents() {
  const fileInputRef = useRef(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((header, idx) => {
        const key = header.trim().toLowerCase().replace(/\s+/g, '_');
        obj[key] = values[idx] ? values[idx].trim() : '';
      });
      return obj;
    });

    return { headers, rows };
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Vui lòng chọn file CSV.');
      return;
    }

    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        toast.error('File CSV trống hoặc không đúng định dạng.');
        return;
      }

      setCsvHeaders(headers);
      setCsvData(rows);

      const preview = rows.slice(0, 5);
      setPreviewData(preview);

      const validated = rows.map((row) => {
        const errors = [];
        REQUIRED_FIELDS.forEach((field) => {
          if (!row[field] && !row[field.replace(/_/g, ' ')]) {
            errors.push(`Thiếu ${field.replace(/_/g, ' ')}`);
          }
        });
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push('Email không hợp lệ');
        }
        return { ...row, _valid: errors.length === 0, _errors: errors };
      });

      setValidatedRows(validated);
      const validCount = validated.filter((r) => r._valid).length;
      toast.success(`Đã tải ${rows.length} dòng. ${validCount} dòng hợp lệ.`);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleImport = async () => {
    const validRows = validatedRows.filter((r) => r._valid);
    if (validRows.length === 0) {
      toast.error('Không có dòng dữ liệu hợp lệ để nhập.');
      return;
    }

    setImporting(true);
    setProgress(0);
    let successCount = 0;
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const userData = {
          fullName: row.full_name || row['họ_tên'] || row.name || '',
          email: row.email || '',
          phone: row.phone || row['số_điện_thoại'] || row['điện_thoại'] || '',
          role: 'STUDENT',
          course_name: row.course_name || row['khóa_học'] || '',
          address: row.address || row['địa_chỉ'] || '',
          notes: row.notes || row['ghi_chú'] || '',
          source: 'agency_import',
        };
        await api.createUser(userData);
        successCount++;
      } catch (err) {
        errors.push({
          row: i + 1,
          name: row.full_name || row.name || `Dòng ${i + 1}`,
          message: err.message || 'Lỗi không xác định',
        });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImporting(false);
    setResult({ success: successCount, errors });

    if (errors.length === 0) {
      toast.success(`Đã nhập thành công ${successCount} học viên.`);
    } else {
      toast.error(`Đã nhập ${successCount} học viên, ${errors.length} lỗi.`);
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'Họ tên,Email,Số điện thoại,Khóa học,Địa chỉ,Ghi chú\nNguyễn Văn Học,nguyenvanhoc@email.com,0900000001,VLOS - Cơ bản,Hà Nội,\nTrần Thị Bay,tranthibay@email.com,0900000002,BVLOS - Nâng cao,TP.HCM,\n';
    const blob = new Blob(['﻿' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-nhap-hoc-vien-SMC.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Nhập học viên"
        subtitle="Tải lên file CSV để nhập nhiều học viên cùng lúc"
      />

      {/* Instructions */}
      <div className="card mb-6">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-smc-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Hướng dẫn nhập học viên</h3>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Tải file mẫu CSV bên dưới và điền thông tin học viên</li>
              <li>Các cột bắt buộc: <strong>Họ tên, Email, Số điện thoại</strong></li>
              <li>Các cột tùy chọn: Khóa học, Địa chỉ, Ghi chú</li>
              <li>Email phải đúng định dạng và không trùng với học viên hiện có</li>
              <li>File CSV phải được mã hóa UTF-8 để hiển thị tiếng Việt đúng</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={handleDownloadTemplate} className="btn-secondary">
          <Download className="w-4 h-4 mr-2" />
          Tải file mẫu
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
          <Upload className="w-4 h-4 mr-2" />
          Chọn file CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Drop zone */}
      {csvData.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-gray-300 rounded-ios-xl p-12 text-center hover:border-smc-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Kéo thả file CSV vào đây</p>
          <p className="text-sm text-gray-400 mt-1">hoặc nhấn để chọn file</p>
        </div>
      )}

      {/* Preview table */}
      {csvData.length > 0 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              Xem trước dữ liệu ({csvData.length} dòng)
            </h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Số điện thoại</th>
                    <th>Khóa học</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => {
                    const validated = validatedRows[idx];
                    const valid = validated?._valid;
                    const errors = validated?._errors || [];
                    return (
                      <tr key={idx}>
                        <td className="text-xs text-gray-400">{idx + 1}</td>
                        <td className="font-medium text-gray-900">
                          {row.full_name || row['họ_tên'] || row.name || '-'}
                        </td>
                        <td className="text-gray-500">{row.email || '-'}</td>
                        <td className="text-gray-500">{row.phone || row['số_điện_thoại'] || '-'}</td>
                        <td className="text-sm text-gray-500">
                          {row.course_name || row['khóa_học'] || '-'}
                        </td>
                        <td>
                          {valid === undefined ? (
                            <span className="badge badge-neutral">Chưa kiểm tra</span>
                          ) : valid ? (
                            <span className="badge badge-success">Hợp lệ</span>
                          ) : (
                            <span className="badge badge-danger" title={errors.join(', ')}>
                              Lỗi: {errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {csvData.length > 5 && (
                <p className="text-center text-sm text-gray-400 py-3">
                  ... và {csvData.length - 5} dòng khác
                </p>
              )}
            </div>
          </div>

          {/* Import progress */}
          {importing && (
            <div className="card">
              <h3 className="text-base font-bold text-gray-900 mb-3">Đang nhập dữ liệu...</h3>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-smc-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{progress}% hoàn thành</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="card">
              <h3 className="text-base font-bold text-gray-900 mb-4">Kết quả nhập</h3>
              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-green-600">Thành công: {result.success}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="font-semibold text-red-500">Lỗi: {result.errors.length}</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-50 rounded-ios-lg">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium text-red-700">
                          Dòng {err.row} - {err.name}:
                        </span>{' '}
                        <span className="text-red-600">{err.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Import button */}
          {!importing && (
            <div className="flex justify-end">
              <button onClick={handleImport} className="btn-primary">
                <Upload className="w-4 h-4 mr-2" />
                Xác nhận nhập ({validatedRows.filter((r) => r._valid).length} học viên)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
