import Badge from '../ui/Badge';

interface MacroDetailAboutPanelProps {
  description: string | null;
  tags: string[];
}

export function MacroDetailAboutPanel({ description, tags }: MacroDetailAboutPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
      <p className="text-sm text-gray-600 mb-4">{description || 'No description provided.'}</p>
      {tags.length > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Tags:</span>
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="blue">{tag}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
