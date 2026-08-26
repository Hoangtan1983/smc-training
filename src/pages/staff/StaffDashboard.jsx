import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetEnrollments, apiStaffCashSummary, onDataChange } from '../../data/api';
import { FileCheck, Users, Clock, CheckCircle, Wallet, AlertTriangle, Building2 } from 'lucide-react';

const formatPrice = (v) => {
  if (v == null || isNaN(v)) return '0 ₫';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
};

export default function StaffDashboard() {
  const { getAllUsers, user } = useAuth();
  const [studentCount, setStudentCount] = useState(0);
  const [enrollments, setEnrollments] = useState([]);
  const [cashSummary, setCashSummary] = useState({ totalHolding: 0, pendingCount: 0, pendingPayments: [] });

  const loadData = async () => {
    try {
      const [userData, enrData, cashData] = await Promise.all([
        getAllUsers(),
        apiGetEnrollments().catch(() => []),
        apiStaffCashSummary().catch(() => ({ data: { totalHolding: 0, pendingCount: 0, pendingPayments: [] } })),
      ]);
      setStudentCount(userData.filter(u => u.role === 'STUDENT').length);
      setEnrollments(Array.isArray(enrData) ? enrData : []);
      const cash = cashData?.data || cashData || {};
      setCashSummary({
        totalHolding: cash.totalHolding || 0,
        pendingCount: cash.pendingCount || 0,
        pendingPayments: cash.pendingPayments || [],
      });
    } catch (err) {
      console.error('Staff dashboard load error:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub1 = onDataChange('transactions', loadData);
    const unsub2 = onDataChange('all', loadData);
    return () => { unsub1(); unsub2(); };
  }, []);

  // "Hồ sơ chờ duyệt" = hồ sơ chờ NHÂN VIÊN duyệt (chưa có approval_staff_by), thống nhất với StaffApprovals.
  // Hồ sơ đã qua Nhân viên (đang chờ Kế toán/Admin) KHÔNG tính vào đây.
  const pending = enrollments.filter(e =>
    !e.approval_staff_by && (e.enrollment_status === 'pending' || e.status === 'pending')
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Xin chào, {user?.fullName || user?.full_name || 'Nhân viên'}
        </h1>
        <p className="text-slate-400 mt-1">Công việc cần xử lý hôm nay</p>
      </div>

      {/* ⚠️ Cash warning cho Staff */}
      {cashSummary.totalHolding > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-300 font-semibold">Tiền mặt chưa bàn giao cho Kế toán</p>
            <p className="text-amber-200/80 text-sm mt-1">
              Bạn đang giữ <strong>{formatPrice(cashSummary.totalHolding)}</strong> từ{' '}
              {cashSummary.pendingCount} phiếu thu tiền mặt.
              Hãy bàn giao cho Kế toán trong ngày để được đối soát & kích hoạt khóa học cho học viên.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{pending.length}</div>
              <div className="text-xs text-slate-400">Hồ sơ chờ duyệt</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{enrollments.filter(e => e.status === 'active').length}</div>
              <div className="text-xs text-slate-400">Đang đào tạo</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{studentCount}</div>
              <div className="text-xs text-slate-400">Tổng học viên</div>
            </div>
          </div>
        </div>
        <div className={`bg-slate-800 rounded-xl p-5 border ${cashSummary.totalHolding > 0 ? 'border-amber-500/50' : 'border-slate-700'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cashSummary.totalHolding > 0 ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
              <Wallet className={`w-5 h-5 ${cashSummary.totalHolding > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <div className={`text-xl font-bold ${cashSummary.totalHolding > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {formatPrice(cashSummary.totalHolding)}
              </div>
              <div className="text-xs text-slate-400">Tiền mặt đang giữ ({cashSummary.pendingCount} phiếu)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tiền mặt đang giữ - chi tiết */}
      {cashSummary.pendingPayments.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Wallet size={18} className="text-amber-400" />
              Tiền mặt đang giữ — Cần bàn giao cho Kế toán
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50">
            {cashSummary.pendingPayments.map((p, i) => (
              <div key={p.payment_id || i} className="p-3 hover:bg-slate-700/30 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">{p.student_name || `Học viên`}</p>
                  <p className="text-slate-400 text-xs">
                    {p.receipt_code} • {p.course_name} • Thu từ{' '}
                    {p.held_since ? new Date(p.held_since).toLocaleDateString('vi-VN') : '--'}
                    {p.agency_name ? (
                      <span className="inline-flex items-center gap-1 text-orange-400 ml-2">
                        <Building2 className="w-3 h-3" /> {p.agency_name}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-amber-400 font-bold">{formatPrice(p.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hồ sơ cần xử lý */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FileCheck size={18} className="text-amber-400" />
            Hồ sơ cần xử lý
          </h2>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle size={40} className="mx-auto mb-2 text-emerald-500/50" />
            <p>Không có hồ sơ nào cần xử lý</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {pending.slice(0, 10).map((e, i) => (
              <div key={e.student_id || i} className="p-3 text-sm text-slate-300">
                {e.student_id || e.studentId} — {e.status || 'pending'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
