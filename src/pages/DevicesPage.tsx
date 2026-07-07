import { useMemo, useState } from 'react';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { DeviceDrawer } from '../components/devices/DeviceDrawer';
import { DeviceFiltersBar } from '../components/devices/DeviceFiltersBar';
import { DeviceFleetSummary } from '../components/devices/DeviceFleetSummary';
import { DeviceGrid } from '../components/devices/DeviceGrid';
import { DispatchRiskPanel } from '../components/devices/DispatchRiskPanel';
import {
  DeviceLocksUnavailableNotice,
  DevicesPageSyncAction,
} from '../components/devices/devices-page-shell-sections';
import {
  buildDeviceCards,
  buildDeviceSummaryCohorts,
  filterDeviceCards,
  getDispatchRiskDevices,
} from '../components/devices/devices-page-helpers';
import { useDeleteDevice, useDeviceLocks, useDevices, useSyncDevices } from '../hooks/useDevices';
import { buildDeviceFleetMetrics } from '../lib/device-fleet-metrics';
import {
  buildDeviceLockSnapshot,
  getDeviceLockState,
} from '../lib/device-locks';
import { canDeleteAdminResources, canManageDevices, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useLaixiStore } from '../stores/laixi';
import { useUIStore } from '../stores/ui';
import type { Device } from '../lib/database.types';
import type { FilterStatus, RiskFilter } from '../components/devices/devices-page-types';

export default function DevicesPage() {
  const { data: devices, isLoading } = useDevices();
  const { data: deviceLocks, error: deviceLocksError } = useDeviceLocks();
  const profile = useAuthStore((s) => s.profile);
  const syncDevices = useSyncDevices();
  const deleteDevice = useDeleteDevice();
  const connectionState = useLaixiStore((s) => s.connectionState);
  const connect = useLaixiStore((s) => s.connect);
  const addToast = useUIStore((s) => s.addToast);
  const canSyncDevices = canManageDevices(profile?.role);
  const canDeleteDevices = canDeleteAdminResources(profile?.role);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const deviceLockSnapshot = useMemo(
    () => buildDeviceLockSnapshot(deviceLocks ?? []),
    [deviceLocks]
  );
  const deviceCards = useMemo(
    () => buildDeviceCards(devices, deviceLockSnapshot),
    [deviceLockSnapshot, devices]
  );

  const filtered = useMemo(() => {
    return filterDeviceCards({ deviceCards, riskFilter, search, statusFilter });
  }, [deviceCards, riskFilter, search, statusFilter]);

  const stats = useMemo(() => {
    return buildDeviceFleetMetrics(devices ?? [], deviceLockSnapshot);
  }, [deviceLockSnapshot, devices]);

  const handleSync = async () => {
    if (!canSyncDevices) {
      addToast('Only operators and admins can sync devices', 'error');
      return;
    }
    if (connectionState !== 'connected') {
      connect();
      addToast('Connecting to device bridge...', 'info');
      return;
    }
    try {
      const count = await syncDevices.mutateAsync();
      addToast(`Synced ${count} devices`, 'success');
    } catch {
      addToast('Failed to sync devices', 'error');
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!canDeleteDevices) {
      addToast('Only admins can delete devices', 'error');
      return;
    }

    if (!confirm(`Delete device "${device.name || device.model}"?`)) return;

    try {
      await deleteDevice.mutateAsync(device.id);
      addToast('Device deleted', 'success');
      setSelectedDevice(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to delete device', 'error', 5000);
    }
  };

  const drillIntoCohort = (nextRiskFilter: RiskFilter) => {
    setRiskFilter(nextRiskFilter);
    setStatusFilter('ALL');
    setSearch('');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setRiskFilter('ALL');
  };

  const summaryCohorts = useMemo(
    () => buildDeviceSummaryCohorts(stats),
    [stats]
  );
  const riskDevices = useMemo(
    () => getDispatchRiskDevices(deviceCards),
    [deviceCards]
  );

  return (
    <>
      <Header
        title="Devices"
        subtitle={`${devices?.length ?? 0} devices registered`}
        actions={
          <DevicesPageSyncAction
            canSync={canSyncDevices}
            pending={syncDevices.isPending}
            onSync={() => void handleSync()}
          />
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canSyncDevices && (
          <div className="mb-5">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role can inspect devices but not sync fleet state`}
              detail="You can view registered devices, groups, locks, health, and dispatch risk. Only operators and admins can sync or modify device inventory."
            />
          </div>
        )}

        {deviceLocksError && (
          <DeviceLocksUnavailableNotice
            message={
              deviceLocksError instanceof Error
                ? deviceLocksError.message
                : 'Failed to load device locks'
            }
          />
        )}

        <DeviceFleetSummary
          riskFilter={riskFilter}
          stats={stats}
          summaryCohorts={summaryCohorts}
          onDrill={drillIntoCohort}
        />

        {riskDevices.length > 0 && (
          <DispatchRiskPanel devices={riskDevices} onSelect={setSelectedDevice} onDrill={drillIntoCohort} />
        )}

        <DeviceFiltersBar
          riskFilter={riskFilter}
          search={search}
          statusFilter={statusFilter}
          onClear={clearFilters}
          onRiskFilterChange={setRiskFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
        />

        <DeviceGrid
          canSync={canSyncDevices}
          devices={devices}
          filtered={filtered}
          isLoading={isLoading}
          onSelectDevice={setSelectedDevice}
          onSync={handleSync}
        />
      </div>

      {selectedDevice && (
        <DeviceDrawer
          canDelete={canDeleteDevices}
          deletePending={deleteDevice.isPending}
          device={selectedDevice}
          lockState={getDeviceLockState(selectedDevice.id, deviceLockSnapshot)}
          onClose={() => setSelectedDevice(null)}
          onDelete={() => void handleDeleteDevice(selectedDevice)}
        />
      )}
    </>
  );
}
