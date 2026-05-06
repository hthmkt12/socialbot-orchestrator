import { useEffect, useMemo, useState } from 'react';
import { getDeviceHealthSummary } from '../../lib/device-health';
import { supabase } from '../../lib/supabase';
import type { Device } from '../../lib/database.types';

export function useDemoDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  useEffect(() => {
    supabase.from('devices').select('*').order('name').then(({ data }) => {
      if (data) {
        setDevices(data as Device[]);
        const runnable = (data as Device[]).find((device) => getDeviceHealthSummary(device).lifecycle.isRunnable);
        if (runnable) setSelectedDeviceId(runnable.id);
      }
    });
  }, []);

  const deviceOptions = useMemo(
    () => devices.map((device) => ({ device, health: getDeviceHealthSummary(device) })),
    [devices]
  );
  const selectedDeviceHealth = useMemo(
    () => deviceOptions.find(({ device }) => device.id === selectedDeviceId)?.health ?? null,
    [deviceOptions, selectedDeviceId]
  );

  return {
    deviceOptions,
    devices,
    selectedDeviceHealth,
    selectedDeviceId,
    setSelectedDeviceId,
  };
}
