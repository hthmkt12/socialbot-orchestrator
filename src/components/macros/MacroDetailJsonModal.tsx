import Modal from '../ui/Modal';

interface MacroDetailJsonModalProps {
  definition: unknown | null;
  onClose: () => void;
}

export function MacroDetailJsonModal({ definition, onClose }: MacroDetailJsonModalProps) {
  return (
    <Modal open={!!definition} onClose={onClose} title="Macro Definition" maxWidth="max-w-3xl">
      <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 overflow-auto max-h-[60vh]">
        {JSON.stringify(definition, null, 2)}
      </pre>
    </Modal>
  );
}
