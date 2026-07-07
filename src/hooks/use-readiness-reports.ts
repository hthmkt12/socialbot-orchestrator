import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createReadinessReport,
  fetchReadinessReports,
  reviewReadinessReport,
  type ReadinessReportInput,
  type ReadinessReviewDecision,
} from '../lib/readiness-report-service';

export function useReadinessReports() {
  return useQuery({
    queryKey: ['readiness-reports'],
    queryFn: fetchReadinessReports,
  });
}

export function useCreateReadinessReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReadinessReportInput) => createReadinessReport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readiness-reports'] });
    },
  });
}

export function useReviewReadinessReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      reviewNotes,
    }: {
      id: string;
      decision: ReadinessReviewDecision;
      reviewNotes?: string;
    }) => reviewReadinessReport(id, decision, reviewNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readiness-reports'] });
    },
  });
}
