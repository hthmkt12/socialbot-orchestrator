import { ChevronDown, Search } from 'lucide-react';
import type { FilterStatus, RiskFilter } from './devices-page-types';

interface DeviceFiltersBarProps {
  riskFilter: RiskFilter;
  search: string;
  statusFilter: FilterStatus;
  onClear: () => void;
  onRiskFilterChange: (riskFilter: RiskFilter) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (statusFilter: FilterStatus) => void;
}

export function DeviceFiltersBar({
  riskFilter,
  search,
  statusFilter,
  onClear,
  onRiskFilterChange,
  onSearchChange,
  onStatusFilterChange,
}: DeviceFiltersBarProps) {
  const hasFilters = search || statusFilter !== 'ALL' || riskFilter !== 'ALL';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search devices..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
        />
      </div>
      <FilterSelect value={statusFilter} onChange={(value) => onStatusFilterChange(value as FilterStatus)}>
        <option value="ALL">All Status</option>
        <option value="ONLINE">Online</option>
        <option value="OFFLINE">Offline</option>
        <option value="BUSY">Busy</option>
        <option value="ERROR">Error</option>
      </FilterSelect>
      <FilterSelect value={riskFilter} onChange={(value) => onRiskFilterChange(value as RiskFilter)}>
        <option value="ALL">All lifecycle risk</option>
        <option value="STALE_HEARTBEAT">Stale heartbeat</option>
        <option value="LOCKED_DEVICE">Locked device</option>
      </FilterSelect>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  children,
  value,
  onChange,
}: {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
