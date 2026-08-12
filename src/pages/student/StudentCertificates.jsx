import { Award } from 'lucide-react';
import { loadData } from '../../data/store';
import { useAuth } from '../../context/AuthContext';

export default function StudentCertificates() {
  const { user } = useAuth();
  const certs = loadData('certifications', []).filter(c => c.student_id === user?.id);

  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h1 className="text-2xl font-extrabold text-gray-900">Chứng chỉ</h1></div>
      {certs.length === 0 ? <div className="card p-12 text-center text-gray-400"><Award className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Chưa có chứng chỉ</p><p className="text-sm mt-1">Chứng chỉ sẽ hiển thị ở đây sau khi hoàn thành khóa học và thi sát hạch</p></div> :
        <div className="space-y-4">{certs.map(c => <div key={c.id} className="card p-6 flex justify-between items-center"><div><h3 className="font-bold">{c.cert_number}</h3><p className="text-xs text-gray-500">Cấp: {c.issue_date} • Hết hạn: {c.expiry_date}</p></div><span className={`badge ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status === 'active' ? 'Hiệu lực' : 'Hết hạn'}</span></div>)}</div>
      }
    </div>
  );
}
