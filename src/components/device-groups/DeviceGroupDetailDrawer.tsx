import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { useAddDeviceToGroup, useDeviceGroupMembers, useRemoveDeviceFromGroup } from '../../hooks/useDeviceGroups';
import { useDevices } from '../../hooks/useDevices';
import { useUIStore } from '../../stores/ui';
import type { DeviceGroup } from '../../lib/database.types';

interface DeviceGroupDetailDrawerProps {
  group: DeviceGroup;
  onClose: () => void;
}

export function DeviceGroupDetailDrawer({ group, onClose }: DeviceGroupDetailDrawerProps) {
  const { data: members, isLoading } = useDeviceGroupMembers(group.id);
  const { data: allDevices } = useDevices();
  const addDevice = useAddDeviceToGroup();
  const removeDevice = useRemoveDeviceFromGroup();
  const addToast = useUIStore((s) => s.addToast);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const memberDeviceIds = new Set(members?.map((member) => member.device_id) ?? []);
  const availableDevices = allDevices?.filter((device) => !memberDeviceIds.has(device.id)) ?? [];

  const handleAdd = async (deviceId: string) => {
    try {
      await addDevice.mutateAsync({ groupId: group.id, deviceId });
      addToast('Device added to group', 'success');
      const remaining = availableDevices.filter((device) => device.id !== deviceId);
      if (remaining.length === 0) setShowAddDevice(false);
    } catch {
      addToast('Failed to add device', 'error');
    }
  };

  const handleRemove = async (deviceId: string) => {
    try {
      await removeDevice.mutateAsync({ groupId: group.id, deviceId });
      addToast('Device removed from group', 'success');
    } catch {
      addToast('Failed to remove device', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
            <p className="text-xs text-gray-500">{members?.length ?? 0} devices</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Members</h4>
            <button onClick={() => setShowAddDevice(!showAddDevice)} className="text-xs text-sky-600 hover:text-sky-700 font-medium">
              + Add Device
            </button>
          </div>

          {showAddDevice && availableDevices.length > 0 && (
            <AvailableDevicesList devices={availableDevices} onAdd={handleAdd} />
          )}

          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : !members?.length ? (
            <p className="text-sm text-gray-500 text-center py-8">No devices in this group</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  device={member.device as Record<string, unknown>}
                  onRemove={() => handleRemove(member.device_id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AvailableDevicesList({
  devices,
  onAdd,
}: {
  devices: Array<{ id: string; model: string | null; name: string | null }>;
  onAdd: (deviceId: string) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {devices.map((device) => (
        <button
          key={device.id}
          onClick={() => onAdd(device.id)}
          className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 hover:border-sky-300 text-sm transition-colors"
        >
          <span className="text-gray-700">{device.name || device.model}</span>
          <Plus className="w-4 h-4 text-sky-500" />
        </button>
      ))}
    </div>
  );
}

function MemberRow({
  device,
  onRemove,
}: {
  device: Record<string, unknown>;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-900">{String(device.name || device.model || '')}</p>
        <p className="text-xs text-gray-500">{String(device.brand || '')} - {String(device.status || '')}</p>
      </div>
      <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
