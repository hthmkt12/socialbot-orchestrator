import { Layers } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import type { DeviceGroup } from '../../lib/database.types';

interface DeviceGroupsGridProps {
  groups: DeviceGroup[] | undefined;
  isLoading: boolean;
  onSelectGroup: (group: DeviceGroup) => void;
}

export function DeviceGroupsGrid({ groups, isLoading, onSelectGroup }: DeviceGroupsGridProps) {
  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!groups?.length) {
    return (
      <EmptyState
        icon={<Layers className="w-6 h-6" />}
        title="No device groups"
        description="Create groups to organize and target multiple devices at once."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelectGroup(group)}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-sky-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{group.description || 'No description'}</p>
        </button>
      ))}
    </div>
  );
}
