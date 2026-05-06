import type { FormEvent } from 'react';
import Modal from '../ui/Modal';

interface CreateDeviceGroupModalProps {
  description: string;
  isSubmitting: boolean;
  name: string;
  open: boolean;
  onClose: () => void;
  onDescriptionChange: (description: string) => void;
  onNameChange: (name: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function CreateDeviceGroupModal({
  description,
  isSubmitting,
  name,
  open,
  onClose,
  onDescriptionChange,
  onNameChange,
  onSubmit,
}: CreateDeviceGroupModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Create Device Group">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Name</label>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="e.g. Production Fleet"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            placeholder="Optional description"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
