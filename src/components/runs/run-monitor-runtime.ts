export const isTerminalRunStatus = (status: string | undefined) =>
  status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED' || status === 'PARTIAL_SUCCESS';
