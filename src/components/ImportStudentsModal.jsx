import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, X, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { apiImportStudents } from '../data/api';
import toast from 'react-hot-toast';

const CSV_TEMPLATE_HEADERS = 'Họ tên,Số điện thoại,Email,Khóa học,Học phí,Đã nộp,Địa chỉ,Ghi chú';
const CSV_TEMPLATE_SAMPLE = 'Nguyễn Văn A,0901234567,nguyenvana@gmail.com,A-VLOS,15000000,5000000,"123 Đường ABC, Quận 1, TP.HCM",Học viên mới\nTrần Thị B,0909876543,tranthib@gmail.com,BVLOS-01,20000000,0,"456 Đường XYZ, Quận 3, TP.HCM",Đã có kinh nghiệm bay';

export default function ImportStudentsModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        toast.error('Chỉ hỗ trợ file .csv, .xlsx hoặc .xls');
        return;
      }
      setFile(selected);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const ext = dropped.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        toast.error('Chỉ hỗ trợ file .csv, .xlsx hoặc .xls');
        return;
      }
      setFile(dropped);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return toast.error('Vui lòng chọn file trước');
    setImporting(true);
    try {
      const res = await apiImportStudents(file);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`✅ Đã nhập ${res.imported} học viên thành công!`);
        onSuccess?.();
      }
      if (res.skipped > 0) {
        toast(`${res.skipped} học viên bị bỏ qua (trùng lặp hoặc thiếu thông tin)`, { icon: '⚠️' });
      }
    } catch (err) {
      toast.error('Lỗi nhập file: ' + (err.message || 'Không thể đọc file'));
      setResult({ errors: [err.message] });
    }
    setImporting(false);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['﻿' + CSV_TEMPLATE_HEADERS + '\n' + CSV_TEMPLATE_SAMPLE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-nhap-hoc-vien-SMC.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải file mẫu CSV');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Nhập danh sách học viên từ Excel
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* File upload zone */}
        {!result && (
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                  <p className="font-semibold text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB • {file.name.split('.').pop().toUpperCase()}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-xs text-red-500 hover:underline mt-1"
                  >
                    Xóa file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-gray-300" />
                  <p className="font-semibold text-gray-600">Kéo thả file vào đây</p>
                  <p className="text-sm text-gray-400">hoặc click để chọn file</p>
                  <p className="text-xs text-gray-400 mt-2">Hỗ trợ: .csv, .xlsx, .xls</p>
                </div>
              )}
            </div>

            {/* Template download */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>Chưa có file mẫu?</span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Tải file mẫu CSV
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Các cột: Họ tên*, Số điện thoại*, Email, Khóa học, Địa chỉ, Ghi chú
              </p>
            </div>

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {importing ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nhập...</>
              ) : (
                <><Upload className="w-4 h-4" /> Nhập danh sách học viên</>
              )}
            </button>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl ${result.imported > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.imported > 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-bold text-gray-800">{result.message}</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-semibold">✅ Đã nhập: {result.imported || 0}</span>
                <span className="text-amber-600 font-semibold">⏭ Bỏ qua: {result.skipped || 0}</span>
                <span className="text-gray-500">Tổng: {result.total || 0}</span>
              </div>
            </div>

            {/* Details */}
            {result.details && result.details.length > 0 && (
              <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 text-sm">
                {result.details.map((d, i) => (
                  <p key={i} className={`py-0.5 ${d.startsWith('✅') ? 'text-green-700' : d.startsWith('⏭') ? 'text-amber-600' : 'text-red-600'}`}>
                    {d}
                  </p>
                ))}
              </div>
            )}

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
                {result.errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setFile(null); setResult(null); }} className="btn-ghost flex-1 py-2">
                Nhập file khác
              </button>
              <button onClick={onClose} className="btn-primary flex-1 py-2">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
