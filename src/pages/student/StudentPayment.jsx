import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGetStudentInvoices, apiExamEligibility, onDataChange } from '../../data/api';
import { CheckCircle, AlertTriangle, DollarSign, Phone } from 'lucide-react';

export default function StudentPayment() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [examStatus, setExamStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [invRes, examRes] = await Promise.all([
        apiGetStudentInvoices().catch(() => ({ data: [] })),
        apiExamEligibility().catch(() => ({ data: null })),
      ]);
      setInvoices(invRes?.data || []);
      setExamStatus(examRes?.data || null);
    } catch (err) {
      console.error('[StudentPayment] Load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const u1 = onDataChange('invoices', () => loadData());
    const u2 = onDataChange('transactions', () => loadData());
    return () => { u1(); u2(); };
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Đang tải thông tin học phí...</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">💳 Học phí của tôi</h1>
        <div className="card p-12 text-center text-gray-400">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold">Bạn chưa có hồ sơ học phí</p>
          <p className="text-sm mt-1">Vui lòng liên hệ nhân viên SMC để được tạo hồ sơ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">💳 Học phí của tôi</h1>
      <p className="text-sm text-gray-500 mb-6">Tình trạng học phí của bạn</p>

      {/* Exam Eligibility Banner */}
      {examStatus && (
        <div className={`card p-4 mb-6 border-l-4 ${
          examStatus.eligible ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              examStatus.eligible ? 'bg-green-200' : 'bg-red-200'
            }`}>
              {examStatus.eligible ? (
                <CheckCircle className="w-5 h-5 text-green-700" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-700" />
              )}
            </div>
            <div>
              <p className={`font-bold ${examStatus.eligible ? 'text-green-800' : 'text-red-800'}`}>
                {examStatus.eligible ? '✅ Đủ điều kiện tham gia thi' : '⚠️ Chưa đủ điều kiện thi'}
              </p>
              <p className="text-sm mt-0.5">
                {examStatus.eligible
                  ? 'Bạn đã hoàn thành học phí và có thể đăng ký thi.'
                  : 'Bạn cần hoàn thành học phí để đủ điều kiện thi.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {invoices.map((inv) => {
        const isPaid = inv.status === 'paid';
        const isExempt = inv.status === 'exempt';
        const isPartial = inv.status === 'partial';
        return (
          <div key={inv.id} className="card p-6 mb-6 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-gray-800">
                  🧾 {inv.courseName}
                </h3>
              </div>
              <span className={`badge text-sm px-3 py-1 font-bold ${
                isPaid ? 'bg-green-100 text-green-700' :
                isPartial ? 'bg-amber-100 text-amber-700' :
                isExempt ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {isPaid ? '✅ Đã nộp đủ' :
                 isPartial ? '⚠️ Chưa nộp đủ' :
                 isExempt ? '🆓 Miễn phí' :
                 '⏳ Chưa thanh toán'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {isPaid ? 'Bạn đã hoàn thành học phí cho khóa học này.' :
               isExempt ? 'Khóa học này được miễn học phí.' :
               'Bạn chưa hoàn thành học phí. Vui lòng liên hệ trung tâm để biết chi tiết.'}
            </p>
          </div>
        );
      })}

      <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-blue-500">
        <Phone className="w-5 h-5 text-blue-600" />
        <div className="text-sm text-gray-600">
          <p className="font-semibold text-gray-800">Cần hỗ trợ học phí?</p>
          <p>Vui lòng liên hệ nhân viên SMC để biết chi tiết số tiền và hướng dẫn thanh toán.</p>
        </div>
      </div>
    </div>
  );
}
