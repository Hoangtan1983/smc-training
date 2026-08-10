import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', onClear }) {
  return (
    <div className="search-bar">
      <Search className="w-4 h-4" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-10"
      />
      {value && (
        <button
          onClick={() => { onChange(''); onClear && onClear(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      )}
    </div>
  );
}
