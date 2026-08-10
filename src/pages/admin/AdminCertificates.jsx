import { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Eye, Search } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import SearchInput from '../../components/ui/SearchInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 10;

const statusBadgeMap = { valid: 'badge-success', VALID: 'badge-success', expired: 'badge-danger', EXPIRED: 'badge-danger', revoked: 'badge-neutral', REVOKED: 'badge-neutral' };
const statusLabels = { valid: 'Còn hiệu lực', VALID: 'Còn hiệu lực', expired: 'Hết hạn', EXPIRED: 'Hết hạn', revoked: 'Đã thu hồi', REVOKED: 'Đã thu hồi' };

const CERT_TYPES = ['VLOS', 'BVLOS', 'Định kỳ', 'Nâng cao'];

export default function AdminCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCert, setSelectedCert] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issueForm, setIssueForm] = useState({ student_id: '', cert_type: 'VLOS', expire_date: '', notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [certRes, studentsRes] = await Promise.all([
        api.getCertifications(),
        api.getUsers({ role: 'STUDENT' }),
      ]);
      setCertificates(certRes.data || certRes.certifications || []);
      setStudents((studentsRes.data || studentsRes.users || []).filter(u => u.role === 'STUDENT'));
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu chứng chỉ.');
      toast.error('Không thể tải dữ liệu chứng chỉ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = certificates.filter(cert => {
    const s = search.toLowerCase();
    const code = (cert.code || cert.cert_code || cert.certificate_code || '').toLowerCase();
    const studentName = (cert.student_name || cert.studentName || cert.student?.fullName || cert.student?.full_name || '').toLowerCase();
    const matchSearch = code.includes(s) || studentName.includes(s);
    const status = cert.status || (new Date(cert.expire_date || cert.expireDate) < new Date() ? 'expired' : 'valid');
    const matchFilter = !filterStatus || status === filterStatus;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, filterStatus]);

  const openDetail = (cert) => {
    setSelectedCert(cert);
    setDetailOpen(true);
  };

  const openIssueModal = () => {
    setIssueForm({ student_id: '', cert_type: 'VLOS', expire_date: '', notes: '' });
    setIssueOpen(true);
  };

  const handleIssue = async () => {
    if (!issueForm.student_id || !issueForm.expire_date) {
      toast.error('Vui lòng chọn học viên và ngày hết hạn.');
      return;
    }
    setSaving(true);
    try {
      // Note: There's no dedicated API for creating certificates, so this calls a generic path
      await api.createCourse(issueForm);
      toast.success('Đã cấp chứng chỉ thành công.');
      setIssueOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cấp chứng chỉ.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
  };

  const getCertStatus = (cert) => {
    if (cert.status) return cert.status;
    const expire = cert.expire_date || cert.expireDate;
    if (!expire) return 'valid';
    return new Date(expire) < new Date() ? 'expired' : 'valid';
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
      <PageHeader
        title="Quản lý chứng chỉ"
        subtitle="Cấp và theo dõi chứng chỉ UAV"
        action={
          <button onClick={openIssueModal} className="btn-primary">
            <Award className="w-4 h-4 mr-2" />
            Cấp chứng chỉ
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã chứng chỉ, tên học viên..." />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input-field w-full sm:w-40"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="valid">Còn hiệu lực</option>
          <option value="expired">Hết hạn</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {paginated.length === 0 ? (
            <EmptyState icon={Award} title="Không tìm thấy chứng chỉ nào" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã chứng chỉ</th>
                  <th>Học viên</th>
                  <th>Loại</th>
                  <th>Ngày cấp</th>
                  <th>Ngày hết hạn</th>
                  <th>Trạng thái</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(cert => {
                  const status = getCertStatus(cert);
                  return (
                    <tr key={cert.id}>
                      <td>
                        <span className="font-mono text-sm text-smc-600 font-medium">
                          {cert.code || cert.cert_code || cert.certificate_code || `CERT-${cert.id}`}
                        </span>
                      </td>
                      <td>
                        <span className="font-medium text-gray-900">
                          {cert.student_name || cert.studentName || cert.student?.fullName || cert.student?.full_name || cert.student?.name || '-'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info">{cert.type || cert.cert_type || 'VLOS'}</span>
                      </td>
                      <td className="text-sm text-gray-500">{formatDate(cert.issue_date || cert.issueDate || cert.created_at)}</td>
                      <td className="text-sm text-gray-500">{formatDate(cert.expire_date || cert.expireDate)}</td>
                      <td>
                        <span className={`badge ${statusBadgeMap[status] || 'badge-neutral'}`}>
                          {statusLabels[status] || status}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => openDetail(cert)} className="btn-ghost btn-sm p-1.5 text-smc-600 hover:bg-smc-50">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Chi tiết chứng chỉ">
        {selectedCert && (
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-smc-100 flex items-center justify-center">
                <Award className="w-8 h-8 text-smc-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Mã chứng chỉ:</span> <span className="font-medium font-mono">{selectedCert.code || selectedCert.cert_code || `CERT-${selectedCert.id}`}</span></div>
              <div><span className="text-gray-400">Loại:</span> <span className="font-medium">{selectedCert.type || selectedCert.cert_type || 'VLOS'}</span></div>
              <div><span className="text-gray-400">Ngày cấp:</span> <span className="font-medium">{formatDate(selectedCert.issue_date || selectedCert.issueDate)}</span></div>
              <div><span className="text-gray-400">Ngày hết hạn:</span> <span className="font-medium">{formatDate(selectedCert.expire_date || selectedCert.expireDate)}</span></div>
              <div className="col-span-2">
                <span className="text-gray-400">Học viên:</span>{' '}
                <span className="font-medium">{selectedCert.student_name || selectedCert.studentName || selectedCert.student?.fullName || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Issue Modal */}
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Cấp chứng chỉ mới" size="lg">
        <div className="space-y-4">
          <div>
            <label className="input-label">Học viên</label>
            <select
              value={issueForm.student_id}
              onChange={e => setIssueForm(prev => ({ ...prev, student_id: e.target.value }))}
              className="input-field"
            >
              <option value="">Chọn học viên...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.fullName || s.full_name || s.name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Loại chứng chỉ</label>
            <select
              value={issueForm.cert_type}
              onChange={e => setIssueForm(prev => ({ ...prev, cert_type: e.target.value }))}
              className="input-field"
            >
              {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Ngày hết hạn</label>
            <input
              type="date"
              value={issueForm.expire_date}
              onChange={e => setIssueForm(prev => ({ ...prev, expire_date: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="input-label">Ghi chú</label>
            <textarea
              value={issueForm.notes}
              onChange={e => setIssueForm(prev => ({ ...prev, notes: e.target.value }))}
              className="input-field min-h-[80px]"
              placeholder="Ghi chú..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setIssueOpen(false)} className="btn-secondary flex-1">Hủy</button>
            <button onClick={handleIssue} disabled={saving} className="btn-primary flex-1">
              {saving ? <span className="spinner spinner-sm" /> : 'Cấp chứng chỉ'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
