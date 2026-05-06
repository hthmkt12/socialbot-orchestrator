import type { Approval } from '../../lib/database.types';

export function ApprovalFacts({ approval }: { approval: Approval }) {
  const facts = [
    ['Status', approval.status],
    ['Run ID', approval.workflow_run_id.slice(0, 16)],
    ['Step ID', approval.step_id ?? '--'],
    ['Step Type', approval.step_type ?? '--'],
    ['Requested By', approval.requested_by ?? '--'],
    ['Reviewed By', approval.reviewed_by ?? '--'],
    ['Requested', new Date(approval.created_at).toLocaleString()],
    ['Reviewed', approval.reviewed_at ? new Date(approval.reviewed_at).toLocaleString() : '--'],
  ];

  return (
    <div className="space-y-3">
      {facts.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between py-2 border-b border-gray-100">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function ApprovalMetadata({ approval }: { approval: Approval }) {
  if (!approval.metadata || Object.keys(approval.metadata).length === 0) {
    return null;
  }

  return (
    <div>
      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</h5>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-auto font-mono max-h-48">
        {JSON.stringify(approval.metadata, null, 2)}
      </pre>
    </div>
  );
}
