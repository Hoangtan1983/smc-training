import { useState, useEffect, useCallback } from 'react';
import { Wallet, Download } from 'lucide-react';
import * as api from '../../data/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('vi-VN'); } catch { return d; }
};

const MONTHS = [
  { value: 1, label: 'Tháng 1' }, { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' }, { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' }, { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' }, { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' }, { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' }, { value: 12, label: 'Tháng 12' },
];

export default function AccountantCashLedger() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summary, setSummary] = useState({
    opening: 0,
    income: 0,
    expense: 0,
    closing: 0,
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, tuitionRes] = await Promise.all([
        api.getReports('revenue'),
        api.getTuitionReport(),
      ]);

      const reportData = reportRes.data || reportRes || {};
      const tuitionData = tuitionRes.data || tuitionRes || {};

      const allEntries = reportData.ledger || reportData.cash_ledger || tuitionData.ledger || [];

      setLedgerEntries(allEntries);

      // Calculate summary
      const opening = reportData.opening_balance || reportData.openingBalance || tuitionData.opening_balance || 0;
      const income = allEntries
        .filter((e) => e.type === 'income' || e.type === 'INCOME' || e.type === 'thu' || e.type === 'revenue')
        .reduce((sum, e) => sum + (e.amount || e.value || 0), 0);
      const expense = allEntries
        .filter((e) => e.type === 'expense' || e.type === 'EXPENSE' || e.type === 'chi' || e.type === 'cost')
        .reduce((sum, e) => sum + (e.amount || e.value || 0), 0);

      setSummary({
        opening,
        income,
        expense,
        closing: opening + income - expense,
      });
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu.');
      toast.error('Không thể tải dữ liệu sổ quỹ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = ledgerEntries.filter((entry) => {
    const date = entry.date || entry.created_at || entry.createdAt;
    if (!date) return true;
    try {
      const d = new Date(date);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    } catch {
      return true;
    }
  });

  const runningBalance = (() => {
    let balance = summary.opening;
    return filtered.map((entry) => {
      const income = entry.type === 'income' || entry.type === 'INCOME' || entry.type === 'thu' ? (entry.amount || entry.value || 0) : 0;
      const expense = entry.type === 'expense' || entry.type === 'EXPENSE' || entry.type === 'chi' ? (entry.amount || entry.value || 0) : 0;
      balance = balance + income - expense;
      return balance;
    });
  })();

  const getTypeLabel = (entry) => {
    const map = {
      income: 'Thu', INCOME: 'Thu', thu: 'Thu', revenue: 'Thu',
      expense: 'Chi', EXPENSE: 'Chi', chi: 'Chi', cost: 'Chi',
    };
    return map[entry.type] || entry.type || '-';
  };

  const handleExport = () => {
    toast.success('Tính năng xuất file đang được phát triển.');
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
        title="Sổ quỹ tiền mặt"
        subtitle="Theo dõi thu chi tiền mặt"
        action={
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Xuất file
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="input-field w-full sm:w-40"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="input-field w-full sm:w-32"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Wallet} label="Tồn đầu kỳ" value={formatVND(summary.opening)} color="smc" />
        <StatCard icon={Wallet} label="Thu trong kỳ" value={formatVND(summary.income)} color="green" />
        <StatCard icon={Wallet} label="Chi trong kỳ" value={formatVND(summary.expense)} color="red" />
        <StatCard icon={Wallet} label="Tồn cuối kỳ" value={formatVND(summary.closing)} color="purple" />
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <EmptyState icon={Wallet} title="Không có dữ liệu sổ quỹ trong kỳ" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Diễn giải</th>
                  <th>Thu</th>
                  <th>Chi</th>
                  <th>Tồn</th>
                  <th>Loại</th>
                  <th>Chứng từ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  const isIncome = entry.type === 'income' || entry.type === 'INCOME' || entry.type === 'thu' || entry.type === 'revenue';
                  const income = isIncome ? (entry.amount || entry.value || 0) : 0;
                  const expense = !isIncome ? (entry.amount || entry.value || 0) : 0;
                  return (
                    <tr key={entry.id || idx}>
                      <td className="text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(entry.date || entry.created_at || entry.createdAt)}
                      </td>
                      <td>
                        <p className="font-medium text-gray-900 text-sm">
                          {entry.description || entry.desc || entry.note || entry.name || '-'}
                        </p>
                        {entry.detail && (
                          <p className="text-xs text-gray-400 mt-0.5">{entry.detail}</p>
                        )}
                      </td>
                      <td className="text-sm text-green-600 font-semibold">
                        {isIncome ? formatVND(income) : '-'}
                      </td>
                      <td className="text-sm text-red-500 font-semibold">
                        {!isIncome ? formatVND(expense) : '-'}
                      </td>
                      <td className="font-semibold text-sm">{formatVND(runningBalance[idx])}</td>
                      <td>
                        <span className={`badge ${isIncome ? 'badge-success' : 'badge-danger'}`}>
                          {getTypeLabel(entry)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500">
                        {entry.receipt_code || entry.receiptCode || entry.doc_no || entry.id || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
