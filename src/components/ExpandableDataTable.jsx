import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Calendar, X } from 'lucide-react';

/**
 * Component bảng dữ liệu mở rộng/thu gọn với tìm kiếm nâng cao
 *
 * Props:
 * - data: mảng items
 * - columns: [{ key, label, render?, className? }]
 * - searchFields: string[] - các field để search text
 * - filters: { roleFilter?, statusFilter?, dateFilter?, dateField?, customFilters? }
 * - renderExpanded: (item) => JSX
 * - actions: (item) => JSX
 * - emptyIcon: Lucide icon
 * - emptyText: string
 * - roleOptions: [] - cho role filter
 * - roleLabelMap: {} - map role -> label
 * - roleBadgeMap: {} - map role -> badge class
 * - pageSize: number (default 20) — phân trang
 */

export default function ExpandableDataTable({
  data = [],
  columns = [],
  searchFields = ['fullName', 'email', 'phone'],
  filters = {},
  renderExpanded,
  actions,
  emptyIcon: EmptyIcon,
  emptyText = 'Không tìm thấy dữ liệu',
  roleOptions = [],
  roleLabelMap = {},
  roleBadgeMap = {},
  pageSize: _pageSize,
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);

  const pageSize = _pageSize || 20;

  // ── Filter logic ──
  let filtered = data;

  // Text search
  if (search.trim() && searchFields.length > 0) {
    const kw = search.toLowerCase().trim();
    filtered = filtered.filter(item =>
      searchFields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(kw);
      })
    );
  }

  // Role filter
  if (filters.roleFilter && roleFilter !== 'ALL') {
    filtered = filtered.filter(item => item.role === roleFilter);
  }

  // Status filter
  if (filters.statusFilter && statusFilter !== 'ALL') {
    filtered = filtered.filter(item => {
      const status = item.status || 'ACTIVE';
      if (statusFilter === 'ACTIVE') return status === 'ACTIVE';
      if (statusFilter === 'FROZEN') return status !== 'ACTIVE';
      return true;
    });
  }

  // Custom filters
  if (filters.customFilter) {
    filtered = filters.customFilter(filtered, { roleFilter, statusFilter });
  }

  // Date range filter
  if (filters.dateFilter) {
    const dateField = filters.dateField || 'createdAt';
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => {
        const d = new Date(item[dateField]);
        return d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const d = new Date(item[dateField]);
        return d <= to;
      });
    }
  }

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  // Dùng useEffect để reset page khi filter thay đổi, tránh setState trong render
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page khi filters thay đổi làm giảm số trang
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [totalPages, page]);

  const hasFilters = filters.roleFilter || filters.statusFilter || filters.dateFilter || filters.customFilter;

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = search || roleFilter !== 'ALL' || statusFilter !== 'ALL' || dateFrom || dateTo;

  return (
    <div>
      {/* ── Filters Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-9"
            placeholder="Tìm kiếm..."
          />
        </div>

        {/* Role filter */}
        {filters.roleFilter && roleOptions.length > 0 && (
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="input-field w-auto min-w-[120px]"
          >
            <option value="ALL">Tất cả vai trò</option>
            {roleOptions.map(r => (
              <option key={r} value={r}>{roleLabelMap[r] || r}</option>
            ))}
          </select>
        )}

        {/* Status filter */}
        {filters.statusFilter && (
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-auto min-w-[130px]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="FROZEN">Đã khóa</option>
          </select>
        )}

        {/* Date filters */}
        {filters.dateFilter && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="input-field pl-8 w-auto text-xs"
                title="Từ ngày"
              />
            </div>
            <span className="text-gray-300 text-xs">→</span>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="input-field pl-8 w-auto text-xs"
                title="Đến ngày"
              />
            </div>
          </div>
        )}

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="btn-ghost text-xs flex items-center gap-1 text-red-500 hover:bg-red-50 px-3"
          >
            <X className="w-3.5 h-3.5" /> Xóa bộ lọc
          </button>
        )}
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">
          {filtered.length} kết quả
          {hasActiveFilters && <span className="text-amber-500"> (đã lọc)</span>}
        </p>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50/50">
                {/* Expand column */}
                {renderExpanded && (
                  <th className="w-10 px-2 py-3" />
                )}
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.className || ''}`}
                  >
                    {col.label}
                  </th>
                ))}
                {actions && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginated.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    {/* Expand toggle */}
                    {renderExpanded && (
                      <td className="px-2 py-3 align-middle">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                        {col.render ? col.render(item) : (
                          <span className="text-sm text-gray-700">{item[col.key]}</span>
                        )}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {actions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Expanded rows */}
              {renderExpanded && paginated.map(item => {
                const isExpanded = expandedId === item.id;
                if (!isExpanded) return null;
                return (
                  <tr key={`exp-${item.id}`}>
                    <td colSpan={columns.length + (actions ? 1 : 0) + 1} className="px-4 py-0">
                      <div className="bg-gray-50 border border-gray-100 rounded-lg mb-2 p-4 animate-slide-up">
                        {renderExpanded(item)}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0) + (renderExpanded ? 1 : 0)} className="px-4 py-12 text-center text-gray-400">
                    {EmptyIcon && <EmptyIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />}
                    <p className="text-sm">{emptyText}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/30">
            <p className="text-xs text-gray-400">
              Trang {safePage}/{totalPages} • Tổng {filtered.length} mục
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (safePage <= 4) {
                  pageNum = i + 1;
                } else if (safePage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = safePage - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 text-xs rounded border ${
                      pageNum === safePage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
