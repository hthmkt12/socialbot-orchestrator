import { ChevronDown, Search, X } from 'lucide-react';
import type { AuditLogFilters } from './audit-page-types';

interface AuditFiltersBarProps {
  actions: string[];
  filters: AuditLogFilters;
  hasActiveFilters: boolean;
  resourceTypes: string[];
  resultCount: number;
  onClear: () => void;
  onChange: (filters: AuditLogFilters) => void;
}

export function AuditFiltersBar({
  actions,
  filters,
  hasActiveFilters,
  resourceTypes,
  resultCount,
  onClear,
  onChange,
}: AuditFiltersBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search action, resource, step, outcome..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
        />
      </div>
      <AuditSelect
        options={actions}
        value={filters.action}
        allLabel="All Actions"
        onChange={(action) => onChange({ ...filters, action })}
      />
      <AuditSelect
        options={resourceTypes}
        value={filters.resource}
        allLabel="All Resources"
        onChange={(resource) => onChange({ ...filters, resource })}
      />
      {hasActiveFilters && (
        <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}
      <span className="text-xs text-gray-400 ml-auto">{resultCount} result{resultCount !== 1 ? 's' : ''}</span>
    </div>
  );
}

function AuditSelect({
  allLabel,
  onChange,
  options,
  value,
}: {
  allLabel: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
      >
        <option value="ALL">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
