import { vi } from 'vitest';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

export function createWorkflowRunsSupabaseMock() {
  const updateCalls: Array<{ table: string; payload: Record<string, unknown>; matchValue?: string }> = [];

  const workflowRunsEqMock = vi.fn((_column: string, value: string) => {
    const lastCall = updateCalls[updateCalls.length - 1];
    if (lastCall) {
      lastCall.matchValue = value;
    }
    return Promise.resolve({});
  });

  const workflowRunsUpdateMock = vi.fn((payload: Record<string, unknown>) => {
    updateCalls.push({ table: 'workflow_runs', payload });
    return { eq: workflowRunsEqMock };
  });

  const supabaseFromMock = vi.fn((table: string) => {
    if (table === 'workflow_runs') {
      return { update: workflowRunsUpdateMock };
    }

    throw new Error(`Unexpected table mock request: ${table}`);
  });

  return {
    supabaseFromMock,
    updateCalls,
    workflowRunsEqMock,
    workflowRunsUpdateMock,
  };
}
