import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="btn-ghost btn-sm p-2">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) => p === '...' ? (
        <span key={`dots-${i}`} className="px-2 text-gray-400">...</span>
      ) : (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-9 h-9 rounded-ios-lg text-sm font-medium transition-all ${
            p === page ? 'bg-smc-500 text-white shadow-ios-btn' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {p}
        </button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="btn-ghost btn-sm p-2">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
