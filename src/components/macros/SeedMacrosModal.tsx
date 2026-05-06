import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Code, Hash } from 'lucide-react';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { SAMPLE_MACROS } from '../../contracts/macro';
import { canManageMacros } from '../../lib/role-access';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';

interface SeedMacrosModalProps {
  open: boolean;
  onClose: () => void;
}

export function SeedMacrosModal({ open, onClose }: SeedMacrosModalProps) {
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const canEditMacros = canManageMacros(profile?.role);

  const handleSeed = async () => {
    if (!canEditMacros) {
      addToast('Only operators and admins can load sample macros', 'error');
      return;
    }
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('seed_demo_macros');
      if (error) throw error;
      reportSeedResult(data as { success: boolean; inserted: number; updated: number; total: number }, addToast);
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    } catch {
      addToast('Failed to seed macros', 'error');
    }
    setLoading(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Load Sample Macros">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          This will create {SAMPLE_MACROS.length} sample macros for testing:
        </p>
        <div className="space-y-2">
          {SAMPLE_MACROS.map((macro) => (
            <SampleMacroRow key={macro.meta.key} macro={macro} />
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSeed}
            disabled={loading}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Spinner size="sm" />}
            Load Samples
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SampleMacroRow({ macro }: { macro: (typeof SAMPLE_MACROS)[number] }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Code className="w-4 h-4 text-orange-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{macro.meta.name}</p>
        <p className="text-xs text-gray-500 truncate">{macro.meta.description}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {macro.meta.tags?.map((tag) => <Badge key={tag} variant="blue">{tag}</Badge>)}
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
        <Hash className="w-3 h-3" />
        {macro.steps.length}
      </div>
    </div>
  );
}

function reportSeedResult(
  result: { inserted: number; total: number; updated: number },
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
) {
  if (result.inserted > 0 && result.updated > 0) {
    addToast(`Loaded ${result.total} macros (${result.inserted} new, ${result.updated} updated)`, 'success');
  } else if (result.inserted > 0) {
    addToast(`Loaded ${result.inserted} new macro${result.inserted !== 1 ? 's' : ''}`, 'success');
  } else if (result.updated > 0) {
    addToast(`Updated ${result.updated} macro${result.updated !== 1 ? 's' : ''}`, 'success');
  } else {
    addToast('All macros already loaded', 'info');
  }
}
