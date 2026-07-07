import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExecutionProfile,
  deleteExecutionProfile,
  fetchExecutionProfiles,
  updateExecutionProfile,
  type ExecutionProfileInput,
} from '../lib/execution-profile-service';

export function useExecutionProfiles(enabled = true) {
  return useQuery({
    queryKey: ['execution-profiles'],
    queryFn: fetchExecutionProfiles,
    enabled,
  });
}

export function useCreateExecutionProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExecutionProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-profiles'] });
    },
  });
}

export function useUpdateExecutionProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExecutionProfileInput }) => updateExecutionProfile(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-profiles'] });
    },
  });
}

export function useDeleteExecutionProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteExecutionProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-profiles'] });
    },
  });
}
