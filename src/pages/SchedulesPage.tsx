import { useState, type FormEvent } from 'react';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import Spinner from '../components/ui/Spinner';
import { CalendarClock, Play, Pause, Trash2, Plus } from 'lucide-react';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule } from '../hooks/use-schedules';
import { useDeviceGroups } from '../hooks/useDeviceGroups';
import { useDevices } from '../hooks/useDevices';
import { useMacros } from '../hooks/useMacros';
import { canManageSchedules, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import type { TargetType, WorkflowSchedule } from '../lib/database.types';

export default function SchedulesPage() {
  const { data: schedules, isLoading } = useSchedules();
  const { data: macros } = useMacros();
  const { data: devices } = useDevices();
  const { data: deviceGroups } = useDeviceGroups();
  const profile = useAuthStore((s) => s.profile);
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const addToast = useUIStore((s) => s.addToast);
  const canEditSchedules = canManageSchedules(profile?.role);
  const [showCreate, setShowCreate] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [macroId, setMacroId] = useState('');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [inputVariablesText, setInputVariablesText] = useState('{}');
  const [targetType, setTargetType] = useState<Extract<TargetType, 'ALL_DEVICES' | 'SINGLE_DEVICE' | 'DEVICE_GROUP'>>('ALL_DEVICES');
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [targetGroupId, setTargetGroupId] = useState('');

  const activeMacros = (macros ?? []).filter((macro) => macro.latest_version_id);

  const toggleActive = async (s: WorkflowSchedule) => {
    if (!canEditSchedules) {
      addToast('Only operators and admins can pause or resume schedules', 'error');
      return;
    }
    try {
      await updateSchedule.mutateAsync({ id: s.id, is_active: !s.is_active });
      addToast(`Schedule ${s.is_active ? 'paused' : 'resumed'}`, 'success');
    } catch {
      addToast('Failed to update schedule', 'error');
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEditSchedules) {
      addToast('Only operators and admins can create schedules', 'error');
      return;
    }

    const selectedMacro = activeMacros.find((macro) => macro.id === macroId);
    if (!selectedMacro?.latest_version_id) {
      addToast('Choose a macro with an active version', 'error');
      return;
    }
    if (targetType === 'SINGLE_DEVICE' && !targetDeviceId) {
      addToast('Choose a target device', 'error');
      return;
    }
    if (targetType === 'DEVICE_GROUP' && !targetGroupId) {
      addToast('Choose a target device group', 'error');
      return;
    }

    let inputVariables: Record<string, unknown>;
    try {
      const parsed = JSON.parse(inputVariablesText);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Input variables must be a JSON object');
      }
      inputVariables = parsed as Record<string, unknown>;
    } catch {
      addToast('Input variables must be valid JSON object', 'error');
      return;
    }

    try {
      await createSchedule.mutateAsync({
        name: scheduleName,
        macro_id: selectedMacro.id,
        macro_version_id: selectedMacro.latest_version_id,
        target_type: targetType,
        target_device_id: targetType === 'SINGLE_DEVICE' ? targetDeviceId : undefined,
        target_group_id: targetType === 'DEVICE_GROUP' ? targetGroupId : undefined,
        cron_expression: cronExpression,
        timezone,
        input_variables: inputVariables,
      });
      addToast('Schedule created', 'success');
      setShowCreate(false);
      setScheduleName('');
      setMacroId('');
      setCronExpression('0 9 * * *');
      setInputVariablesText('{}');
      setTargetType('ALL_DEVICES');
      setTargetDeviceId('');
      setTargetGroupId('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create schedule';
      addToast(message, 'error');
    }
  };

  const removeSchedule = async (s: WorkflowSchedule) => {
    if (!canEditSchedules) {
      addToast('Only operators and admins can delete schedules', 'error');
      return;
    }
    if (!confirm('Delete this schedule?')) return;
    try {
      await deleteSchedule.mutateAsync(s.id);
      addToast('Schedule deleted', 'success');
    } catch {
      addToast('Failed to delete schedule', 'error');
    }
  };

  const getMacroName = (id: string) => {
    return macros?.find((m) => m.id === id)?.name ?? 'Unknown Macro';
  };

  return (
    <>
      <Header
        title="Schedules"
        subtitle="Manage recurring workflows"
        actions={
          <button
            disabled={!canEditSchedules}
            onClick={() => {
              if (!canEditSchedules) {
                addToast('Only operators and admins can create schedules', 'error');
                return;
              }
              setShowCreate((value) => !value);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canEditSchedules && (
          <div className="mb-5">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role can inspect schedules but not change them`}
              detail="You can view recurring workflow timing, macro references, and next-run metadata. Only operators and admins can create, pause, resume, or delete schedules."
            />
          </div>
        )}

        {canEditSchedules && showCreate && (
          <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Name</label>
                <input
                  value={scheduleName}
                  onChange={(event) => setScheduleName(event.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Daily engagement run"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Macro</label>
                <select
                  value={macroId}
                  onChange={(event) => setMacroId(event.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Choose active macro</option>
                  {activeMacros.map((macro) => (
                    <option key={macro.id} value={macro.id}>{macro.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Cron expression</label>
                <input
                  value={cronExpression}
                  onChange={(event) => setCronExpression(event.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Timezone</label>
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Target</label>
                <select
                  value={targetType}
                  onChange={(event) => {
                    const nextType = event.target.value as typeof targetType;
                    setTargetType(nextType);
                    setTargetDeviceId('');
                    setTargetGroupId('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ALL_DEVICES">All devices</option>
                  <option value="SINGLE_DEVICE">Single device</option>
                  <option value="DEVICE_GROUP">Device group</option>
                </select>
              </div>
              {targetType === 'SINGLE_DEVICE' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Device</label>
                  <select
                    value={targetDeviceId}
                    onChange={(event) => setTargetDeviceId(event.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Choose device</option>
                    {(devices ?? []).map((device) => (
                      <option key={device.id} value={device.id}>{device.name || device.model}</option>
                    ))}
                  </select>
                </div>
              )}
              {targetType === 'DEVICE_GROUP' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Device group</label>
                  <select
                    value={targetGroupId}
                    onChange={(event) => setTargetGroupId(event.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Choose group</option>
                    {(deviceGroups ?? []).map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Input variables</label>
              <textarea
                value={inputVariablesText}
                onChange={(event) => setInputVariablesText(event.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSchedule.isPending}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Create Schedule
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex justify-center p-12"><Spinner size="lg" /></div>
        ) : !schedules?.length ? (
          <div className="text-center py-12">
            <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No schedules</h3>
            <p className="text-sm text-gray-500">Create a schedule to automate workflow runs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`bg-white rounded-xl shadow-sm border ${
                  schedule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                } overflow-hidden`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 truncate" title={schedule.name}>
                      {schedule.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void toggleActive(schedule)}
                        disabled={!canEditSchedules || updateSchedule.isPending}
                        className={`p-1.5 rounded-lg ${
                          schedule.is_active ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={schedule.is_active ? 'Pause' : 'Resume'}
                      >
                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => void removeSchedule(schedule)}
                        disabled={!canEditSchedules || deleteSchedule.isPending}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Macro</span>
                      <span className="font-medium text-gray-900 truncate max-w-[120px]" title={getMacroName(schedule.macro_id)}>
                        {getMacroName(schedule.macro_id)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Schedule</span>
                      <span className="font-medium font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                        {schedule.cron_expression}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Timezone</span>
                      <span>{schedule.timezone}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {schedule.next_run_at ? (
                        <>Next: <span className="font-medium text-gray-700">{new Date(schedule.next_run_at).toLocaleString()}</span></>
                      ) : (
                        'Not scheduled'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
