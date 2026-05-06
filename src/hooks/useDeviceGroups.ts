import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import type { DeviceGroup, DeviceGroupMember } from '../lib/database.types';

export function useDeviceGroups() {
  return useQuery({
    queryKey: ['device-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_groups')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as DeviceGroup[];
    },
  });
}

export function useDeviceGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['device-group-members', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_group_members')
        .select('*, device:devices(*)')
        .eq('device_group_id', groupId);
      if (error) throw error;
      return data as (DeviceGroupMember & { device: Record<string, unknown> })[];
    },
    enabled: !!groupId,
  });
}

export function useCreateDeviceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('device_groups')
        .insert({ name, description: description ?? '' })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Device group insert returned no data');
      await logAudit('device_group.create', 'device_group', data.id, { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] });
    },
  });
}

export function useAddDeviceToGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, deviceId }: { groupId: string; deviceId: string }) => {
      const { error } = await supabase
        .from('device_group_members')
        .insert({ device_group_id: groupId, device_id: deviceId });
      if (error) throw error;
      await logAudit('device_group.add_device', 'device_group', groupId, { deviceId });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['device-group-members', vars.groupId] });
    },
  });
}

export function useRemoveDeviceFromGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, deviceId }: { groupId: string; deviceId: string }) => {
      const { error } = await supabase
        .from('device_group_members')
        .delete()
        .eq('device_group_id', groupId)
        .eq('device_id', deviceId);
      if (error) throw error;
      await logAudit('device_group.remove_device', 'device_group', groupId, { deviceId });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['device-group-members', vars.groupId] });
    },
  });
}
