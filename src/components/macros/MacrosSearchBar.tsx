import { Search } from 'lucide-react';

interface MacrosSearchBarProps {
  resultCount: number;
  search: string;
  onSearchChange: (search: string) => void;
}

export function MacrosSearchBar({ resultCount, search, onSearchChange }: MacrosSearchBarProps) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search macros..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
        />
      </div>
      <span className="text-xs text-gray-400">{resultCount} result{resultCount !== 1 ? 's' : ''}</span>
    </div>
  );
}
