import type { ApprovalFilterTab } from './approvals-page-types';

interface ApprovalTabsProps {
  pendingCount: number;
  tab: ApprovalFilterTab;
  onChange: (tab: ApprovalFilterTab) => void;
}

export function ApprovalTabs({ pendingCount, tab, onChange }: ApprovalTabsProps) {
  return (
    <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
      {(['PENDING', 'RESOLVED', 'ALL'] as ApprovalFilterTab[]).map((nextTab) => (
        <button
          key={nextTab}
          onClick={() => onChange(nextTab)}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === nextTab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {getTabLabel(nextTab, pendingCount)}
        </button>
      ))}
    </div>
  );
}

function getTabLabel(tab: ApprovalFilterTab, pendingCount: number) {
  if (tab === 'PENDING') return `Pending (${pendingCount})`;
  if (tab === 'RESOLVED') return 'Resolved';
  return 'All';
}
