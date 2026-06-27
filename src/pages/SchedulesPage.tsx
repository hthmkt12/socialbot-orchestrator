import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import { CalendarClock, Play, Pause, Trash2, Plus } from 'lucide-react';
import { useSchedules, useUpdateSchedule, useDeleteSchedule } from '../hooks/use-schedules';
import { useMacros } from '../hooks/useMacros';
import { useUIStore } from '../stores/ui';
import type { WorkflowSchedule } from '../lib/database.types';

export default function SchedulesPage() {
  const { data: schedules, isLoading } = useSchedules();
  const { data: macros } = useMacros();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const addToast = useUIStore((s) => s.addToast);

  const toggleActive = async (s: WorkflowSchedule) => {
    try {
      await updateSchedule.mutateAsync({ id: s.id, is_active: !s.is_active });
      addToast(`Schedule ${s.is_active ? 'paused' : 'resumed'}`, 'success');
    } catch {
      addToast('Failed to update schedule', 'error');
    }
  };

  const removeSchedule = async (s: WorkflowSchedule) => {
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
          <button className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 transition-colors">
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
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
                        className={`p-1.5 rounded-lg ${
                          schedule.is_active ? 'text-gray-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
                        }`}
                        title={schedule.is_active ? 'Pause' : 'Resume'}
                      >
                        {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => void removeSchedule(schedule)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
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
