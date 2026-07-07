import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import {
  useCreateExecutionProfile,
  useDeleteExecutionProfile,
  useExecutionProfiles,
  useUpdateExecutionProfile,
} from '../hooks/use-execution-profiles';
import type { ExecutionProfile } from '../lib/database.types';
import type { ExecutionProfileInput } from '../lib/execution-profile-service';
import { canManageUsers, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

const DEFAULT_FORM: ExecutionProfileInput = {
  name: '',
  description: '',
  concurrency_per_device: 1,
  default_timeout_ms: 10000,
  max_retries: 2,
  retry_base_delay_ms: 1000,
  retry_max_delay_ms: 30000,
  retry_max_elapsed_ms: 120000,
  target_failure_policy: 'skip_failed_target',
  require_approval_for_adb: true,
  require_approval_for_autox: true,
};
const INPUT_CLASS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

export default function AdminExecutionProfilesPage() {
  const profile = useAuthStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const canManage = canManageUsers(profile?.role);
  const { data: profiles, isLoading, isError } = useExecutionProfiles(canManage);
  const createProfile = useCreateExecutionProfile();
  const updateProfile = useUpdateExecutionProfile();
  const deleteProfile = useDeleteExecutionProfile();
  const [form, setForm] = useState<ExecutionProfileInput>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const startEdit = (executionProfile: ExecutionProfile) => {
    setEditingId(executionProfile.id);
    setForm({
      name: executionProfile.name,
      description: executionProfile.description,
      concurrency_per_device: executionProfile.concurrency_per_device,
      default_timeout_ms: executionProfile.default_timeout_ms,
      max_retries: executionProfile.max_retries,
      retry_base_delay_ms: executionProfile.retry_base_delay_ms,
      retry_max_delay_ms: executionProfile.retry_max_delay_ms,
      retry_max_elapsed_ms: executionProfile.retry_max_elapsed_ms,
      target_failure_policy: executionProfile.target_failure_policy,
      require_approval_for_adb: executionProfile.require_approval_for_adb,
      require_approval_for_autox: executionProfile.require_approval_for_autox,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      addToast('Only admins can manage execution profiles', 'error');
      return;
    }

    try {
      if (editingId) {
        await updateProfile.mutateAsync({ id: editingId, input: form });
        addToast('Execution profile updated', 'success');
      } else {
        await createProfile.mutateAsync(form);
        addToast('Execution profile created', 'success');
      }
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save execution profile';
      addToast(message, 'error');
    }
  };

  const handleDelete = async (executionProfile: ExecutionProfile) => {
    if (!canManage) {
      addToast('Only admins can delete execution profiles', 'error');
      return;
    }
    if (!confirm(`Delete execution profile "${executionProfile.name}"?`)) return;

    try {
      await deleteProfile.mutateAsync(executionProfile.id);
      addToast('Execution profile deleted', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete execution profile';
      addToast(message, 'error');
    }
  };

  return (
    <>
      <Header
        title="Execution Profiles"
        subtitle="Admin-only runtime safety defaults"
        actions={
          <button
            disabled={!canManage}
            onClick={() => {
              setEditingId(null);
              setForm(DEFAULT_FORM);
              setShowForm((value) => !value);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canManage ? (
          <RoleAccessNotice
            title={`${getRoleLabel(profile?.role)} role cannot manage execution profiles`}
            detail="Execution profile changes are restricted to admins."
            tone="warning"
          />
        ) : (
          <div className="space-y-6">
            {showForm && (
              <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Name">
                    <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className={INPUT_CLASS} />
                  </Field>
                  <Field label="Description">
                    <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Concurrency per device">
                    <input type="number" min={1} value={form.concurrency_per_device} onChange={(event) => setForm({ ...form, concurrency_per_device: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Default timeout ms">
                    <input type="number" min={1000} step={500} value={form.default_timeout_ms} onChange={(event) => setForm({ ...form, default_timeout_ms: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Max retries">
                    <input type="number" min={0} value={form.max_retries} onChange={(event) => setForm({ ...form, max_retries: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Retry base delay ms">
                    <input type="number" min={0} step={500} value={form.retry_base_delay_ms} onChange={(event) => setForm({ ...form, retry_base_delay_ms: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Retry max delay ms">
                    <input type="number" min={0} step={500} value={form.retry_max_delay_ms} onChange={(event) => setForm({ ...form, retry_max_delay_ms: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Retry max elapsed ms">
                    <input type="number" min={0} step={1000} value={form.retry_max_elapsed_ms} onChange={(event) => setForm({ ...form, retry_max_elapsed_ms: Number(event.target.value) })} className={INPUT_CLASS} />
                  </Field>
                  <Field label="Target failure policy">
                    <select value={form.target_failure_policy} onChange={(event) => setForm({ ...form, target_failure_policy: event.target.value as ExecutionProfileInput['target_failure_policy'] })} className={INPUT_CLASS}>
                      <option value="skip_failed_target">Skip failed target</option>
                      <option value="fail_fast">Fail fast</option>
                    </select>
                  </Field>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.require_approval_for_adb} onChange={(event) => setForm({ ...form, require_approval_for_adb: event.target.checked })} />
                    Require approval for ADB
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.require_approval_for_autox} onChange={(event) => setForm({ ...form, require_approval_for_autox: event.target.checked })} />
                    Require approval for AutoX
                  </label>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={createProfile.isPending || updateProfile.isPending} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {editingId ? 'Save Profile' : 'Create Profile'}
                  </button>
                </div>
              </form>
            )}

            {isLoading ? (
              <div className="flex justify-center p-12"><Spinner size="lg" /></div>
            ) : isError ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">Failed to load execution profiles.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(profiles ?? []).map((executionProfile) => (
                  <div key={executionProfile.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{executionProfile.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{executionProfile.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(executionProfile)} className="px-3 py-1.5 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg">Edit</button>
                        <button onClick={() => void handleDelete(executionProfile)} disabled={deleteProfile.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <Metric label="Concurrency" value={executionProfile.concurrency_per_device} />
                      <Metric label="Timeout" value={`${executionProfile.default_timeout_ms}ms`} />
                      <Metric label="Retries" value={executionProfile.max_retries} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <Metric label="Base delay" value={`${executionProfile.retry_base_delay_ms}ms`} />
                      <Metric label="Max delay" value={`${executionProfile.retry_max_delay_ms}ms`} />
                      <Metric label="Max elapsed" value={`${executionProfile.retry_max_elapsed_ms}ms`} />
                    </div>
                    <div className="mt-3 text-xs">
                      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                        Target failure: {executionProfile.target_failure_policy.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">ADB approval: {executionProfile.require_approval_for_adb ? 'on' : 'off'}</span>
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">AutoX approval: {executionProfile.require_approval_for_autox ? 'on' : 'off'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
