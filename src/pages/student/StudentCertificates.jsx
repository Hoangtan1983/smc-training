import { useState, useEffect, useCallback } from 'react';
import { Award, Clock, AlertCircle } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function StudentCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [certRes, enrRes] = await Promise.all([
        api.getCertifications(),
        api.getMyEnrollments(),
      ]);
      const certs = Array.isArray(certRes) ? certRes : (certRes.data || certRes.certifications || certRes.certificates || []);
      setCertificates(certs);
      setEnrollments(enrRes.data || enrRes.enrollments || []);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải danh sách chứng chỉ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCertStatus = (cert) => {
    const expiryDate = cert.expiry_date || cert.expiryDate || cert.expiration_date;
    if (!expiryDate) return 'valid';
    const now = new Date();
    const expiry = new Date(expiryDate);
    return now < expiry ? 'valid' : 'expired';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="empty-state-text text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-primary mt-4">Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader title="Chứng chỉ của tôi" subtitle="Danh sách chứng chỉ đã đạt được" />

      {certificates.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={Award}
            title="Bạn chưa có chứng chỉ nào"
            description="Hoàn thành khóa học và đạt yêu cầu để được cấp chứng chỉ."
          />
          <div className="card max-w-lg mx-auto">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-smc-500" />
              Điều kiện để được cấp chứng chỉ
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-smc-100 flex items-center justify-center text-xs text-smc-600 font-bold shrink-0 mt-0.5">1</span>
                Hoàn thành tất cả module của khóa học (tiến độ 100%)
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-smc-100 flex items-center justify-center text-xs text-smc-600 font-bold shrink-0 mt-0.5">2</span>
                Đạt điểm yêu cầu trong kỳ thi sát hạch
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-smc-100 flex items-center justify-center text-xs text-smc-600 font-bold shrink-0 mt-0.5">3</span>
                Tích lũy đủ số giờ bay tối thiểu
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-smc-100 flex items-center justify-center text-xs text-smc-600 font-bold shrink-0 mt-0.5">4</span>
                Hoàn thành học phí
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificates.map(cert => {
            const status = getCertStatus(cert);
            return (
              <div
                key={cert.id}
                className={`card ${status === 'valid' ? 'card-hover' : 'opacity-75'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-ios-lg flex items-center justify-center ${
                    status === 'valid' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <Award className={`w-6 h-6 ${status === 'valid' ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <span className={`badge ${status === 'valid' ? 'badge-success' : 'badge-danger'}`}>
                    {status === 'valid' ? 'Còn hiệu lực' : 'Hết hạn'}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{cert.name || cert.cert_name || cert.certificate_name}</h3>
                <div className="space-y-1 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Ngày cấp: {formatDate(cert.issue_date || cert.issueDate || cert.created_at)}</span>
                  </div>
                  {(cert.expiry_date || cert.expiryDate) && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hết hạn: {formatDate(cert.expiry_date || cert.expiryDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
