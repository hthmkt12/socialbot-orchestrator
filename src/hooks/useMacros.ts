import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  activateMacroVersionRequest,
  archiveMacroVersionRequest,
  createMacroRequest,
  createMacroVersionRequest,
  deleteMacroRequest,
} from './macro-mutation-requests';
import {
  fetchMacro,
  fetchMacros,
  fetchMacroVersions,
} from './macro-query-helpers';

export function useMacros() {
  return useQuery({
    queryKey: ['macros'],
    queryFn: fetchMacros,
  });
}

export function useMacro(id: string) {
  return useQuery({
    queryKey: ['macros', id],
    queryFn: () => fetchMacro(id),
    enabled: !!id,
  });
}

export function useMacroVersions(macroId: string) {
  return useQuery({
    queryKey: ['macro-versions', macroId],
    queryFn: () => fetchMacroVersions(macroId),
    enabled: !!macroId,
  });
}

export function useCreateMacro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMacroRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
  });
}

export function useCreateMacroVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMacroVersionRequest,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['macro-versions', vars.macroId] });
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
  });
}

export function useActivateMacroVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: activateMacroVersionRequest,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['macro-versions', vars.macroId] });
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
  });
}

export function useArchiveMacroVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveMacroVersionRequest,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['macro-versions', vars.macroId] });
      queryClient.invalidateQueries({ queryKey: ['macros'] });
    },
  });
}

export function useDeleteMacro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMacroRequest,
    onSuccess: (_, macroId) => {
      queryClient.invalidateQueries({ queryKey: ['macros'] });
      queryClient.invalidateQueries({ queryKey: ['macros', macroId] });
      queryClient.invalidateQueries({ queryKey: ['macro-versions', macroId] });
    },
  });
}
