import { useState, useRef } from 'react';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { parseAccountCsv, generateSampleCsv, type CsvAccountRow, type CsvParseResult } from '../../lib/account-csv-import-parser';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (rows: CsvAccountRow[]) => void;
  isImporting: boolean;
  credentialPolicy: {
    canSavePilotCredential: boolean;
    severity: 'blocking' | 'warning';
    message: string;
  };
}

export function CsvImportModal({ open, onClose, onImport, isImporting, credentialPolicy }: Props) {
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setParseResult(parseAccountCsv(text));
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([generateSampleCsv()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (credentialPolicy.canSavePilotCredential && parseResult?.valid.length) {
      onImport(parseResult.valid);
    }
  };

  const handleClose = () => {
    setParseResult(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Accounts from CSV" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Format hint */}
        <div className="text-sm text-gray-600">
          <p>CSV columns: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">username, password, platform, daily_limit</code></p>
          <p className="mt-1 text-xs text-gray-500">Platform must be: instagram, tiktok, or facebook. Daily limit is optional (default: 100).</p>
        </div>

        <div className={`rounded-lg border px-3 py-2 text-xs ${
          credentialPolicy.severity === 'blocking'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          {credentialPolicy.message}
        </div>

        {/* File picker + sample download */}
        <div className="flex items-center gap-3">
          <label className="flex-1 flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-sky-400 hover:bg-sky-50/50 transition-colors">
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">{fileName || 'Choose CSV file…'}</span>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
        </div>

        {/* Parse results */}
        {parseResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-3 text-sm">
              {parseResult.valid.length > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  {parseResult.valid.length} valid row{parseResult.valid.length !== 1 ? 's' : ''}
                </div>
              )}
              {parseResult.errors.length > 0 && (
                <div className="flex items-center gap-1.5 text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {parseResult.errors.length} error{parseResult.errors.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                {parseResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700">Line {err.line}: {err.message}</p>
                ))}
              </div>
            )}

            {/* Preview table */}
            {parseResult.valid.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Username</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Platform</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.valid.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-900">{row.username}</td>
                        <td className="px-3 py-1.5"><Badge variant={row.platform === 'instagram' ? 'red' : row.platform === 'tiktok' ? 'teal' : 'blue'}>{row.platform}</Badge></td>
                        <td className="px-3 py-1.5 text-gray-600">{row.daily_limit}</td>
                      </tr>
                    ))}
                    {parseResult.valid.length > 20 && (
                      <tr className="border-t border-gray-100">
                        <td colSpan={3} className="px-3 py-1.5 text-gray-400 text-center">
                          +{parseResult.valid.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parseResult?.valid.length || isImporting || !credentialPolicy.canSavePilotCredential}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? 'Importing…' : `Import ${parseResult?.valid.length ?? 0} Account${(parseResult?.valid.length ?? 0) !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
