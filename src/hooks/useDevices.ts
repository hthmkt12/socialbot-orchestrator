import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getLaixiClient } from '../adapters/laixi/client';
import { logAudit } from '../lib/audit';
import { deleteAdminResource } from '../lib/admin-governance';
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

export function useSyncDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const client = getLaixiClient();
      const devices = await client.getAllInfo();

      for (const d of devices) {
        const { data: existing } = await supabase
          .from('devices')
          .select('id')
          .eq('laixi_device_id', d.deviceId)
          .maybeSingle();

        const payload = {
          name: d.deviceName || d.model,
          model: d.model,
          brand: d.brand,
          android_version: d.androidVersion,
          screen_width: d.screenWidth,
          screen_height: d.screenHeight,
          status: 'ONLINE' as const,
          last_seen_at: new Date().toISOString(),
          heartbeat_freshness: 'fresh' as const,
          metadata_json: { batteryLevel: d.batteryLevel, isCharging: d.isCharging },
        };

        if (existing) {
          const { error } = await supabase.from('devices').update(payload).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('devices').insert({
            laixi_device_id: d.deviceId,
            ...payload,
          });
          if (error) throw error;
        }
      }

      await logAudit('devices.sync', 'device', '*', { count: devices.length });
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
