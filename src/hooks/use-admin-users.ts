import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProfilesForAdmin, updateUserRole } from '../lib/admin-governance';

export function useAdminProfiles(enabled = true) {
  return useQuery({
    queryKey: ['admin-profiles'],
    queryFn: fetchProfilesForAdmin,
    enabled,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: string }) => updateUserRole(profileId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    },
  });
}
