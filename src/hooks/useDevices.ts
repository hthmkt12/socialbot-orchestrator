import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getLaixiClient } from '../adapters/laixi/client';
import { logAudit } from '../lib/audit';
import { deleteAdminResource } from '../lib/admin-governance';
import { fetchAllQuarantinedDeviceIds, loadMobileMcpFleetViaProxy } from '../lib/mobile-mcp-orchestrator';
import type { Device, DeviceLock } from '../lib/database.types';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Device[];
    },
  });
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['devices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useDeviceLocks() {
  return useQuery({
    queryKey: ['device-locks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_locks')
        .select('*')
        .order('expires_at', { ascending: false });
      if (error) throw error;
      return data as DeviceLock[];
    },
  });
}

export function useQuarantinedDeviceIds() {
  return useQuery({
    queryKey: ['quarantined-device-ids'],
    queryFn: async () => {
      return await fetchAllQuarantinedDeviceIds();
    },
    refetchInterval: 10_000,
  });
}

export function useSyncDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const configuredBackend = import.meta.env.VITE_DEVICE_BACKEND ?? 'mobile-mcp';
      const devices = configuredBackend === 'mobile-mcp'
        ? (await loadMobileMcpFleetViaProxy()).devices
          .filter((device) => device.platform === 'android')
          .map((device) => ({ id: device.id, status: device.status, model: 'Android', brand: 'Android', androidVersion: 'unknown', screenWidth: 720, screenHeight: 1600, metadata: { source: 'mobile-mcp-ui-sync', bridgeStatus: device.status } }))
        : (await getLaixiClient().getAllInfo()).map((device) => ({ id: device.deviceId, status: 'device', model: device.model, brand: device.brand, androidVersion: device.androidVersion, screenWidth: device.screenWidth, screenHeight: device.screenHeight, metadata: { source: 'laixi-local-development', batteryLevel: device.batteryLevel, isCharging: device.isCharging } }));

      for (const d of devices) {
        const { data: existing } = await supabase
          .from('devices')
          .select('id')
          .eq('laixi_device_id', d.id)
          .maybeSingle();

        const payload = {
          name: `${d.metadata.source === 'mobile-mcp-ui-sync' ? 'Mobile MCP' : 'Laixi'} ${d.id}`,
          model: d.model,
          brand: d.brand,
          android_version: d.androidVersion,
          screen_width: d.screenWidth,
          screen_height: d.screenHeight,
          status: d.status === 'device' ? 'ONLINE' as const : 'OFFLINE' as const,
          last_seen_at: new Date().toISOString(),
          heartbeat_freshness: d.status === 'device' ? 'fresh' as const : 'stale' as const,
          metadata_json: { ...d.metadata, syncedAt: new Date().toISOString() },
        };

        if (existing) {
          const { error } = await supabase.from('devices').update(payload).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('devices').insert({
            laixi_device_id: d.id,
            ...payload,
          });
          if (error) throw error;
        }
      }

      await logAudit('devices.sync', 'device', '*', { count: devices.length, source: devices.some((device) => device.metadata.source === 'mobile-mcp-ui-sync') ? 'mobile-mcp' : 'laixi' });
      return devices.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      await deleteAdminResource('device', deviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-locks'] });
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });
}
