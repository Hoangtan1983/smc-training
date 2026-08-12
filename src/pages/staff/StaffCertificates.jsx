import { loadData } from '../../data/store';
import { FileText, Plus } from 'lucide-react';

export default function StaffCertificates() {
  const certs = loadData('certifications', []);

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-extrabold text-gray-900">Chứng chỉ</h1><p className="text-sm text-gray-500 mt-0.5">In và quản lý chứng chỉ</p></div><button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Cấp chứng chỉ</button></div>
      {certs.length === 0 ? <div className="card p-12 text-center text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có chứng chỉ</p></div> : <div className="space-y-3">{certs.map(c => <div key={c.id} className="card p-4"><div className="font-semibold">{c.cert_number}</div><div className="text-xs text-gray-500">Cấp: {c.issue_date} • Hết hạn: {c.expiry_date}</div></div>)}</div>}
    </div>
  );
}
