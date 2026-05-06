import { ChevronDown, Search } from 'lucide-react';
import type { FilterStatus } from './runs-page-types';

interface RunsFilterBarProps {
  search: string;
  statusFilter: FilterStatus;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: FilterStatus) => void;
}

export default function RunsFilterBar({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
}: RunsFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search runs..."
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
        />
      </div>
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as FilterStatus)}
          className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
        >
          <option value="ALL">All Status</option>
          <option value="RUNNING">Running</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="PARTIAL_SUCCESS">Partial</option>
          <option value="WAITING_APPROVAL">Awaiting Approval</option>
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}
