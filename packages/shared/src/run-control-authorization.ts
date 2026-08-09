export type RunControlRole = 'ADMIN' | 'OPERATOR' | 'VIEWER' | string;

export interface RunControlAuthorizationInput {
  userId: string | null | undefined;
  role: RunControlRole | null | undefined;
  runExists: boolean;
  runOwnerId: string | null | undefined;
}

export class RunControlAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = 'RunControlAuthorizationError';
  }
}

export function assertRunControlRole(role: RunControlRole | null | undefined): void {
  if (role !== 'ADMIN' && role !== 'OPERATOR') {
    throw new RunControlAuthorizationError(403, 'Run control is not allowed for this role.');
  }
}

export function assertRunControlAuthorized(input: RunControlAuthorizationInput): void {
  if (!input.userId) throw new RunControlAuthorizationError(401, 'Authentication required.');
  if (!input.runExists) throw new RunControlAuthorizationError(404, 'Run not found.');
  assertRunControlRole(input.role);
  if (input.role !== 'ADMIN' && input.runOwnerId !== input.userId) {
    throw new RunControlAuthorizationError(403, 'Run control is not allowed for this run.');
  }
}
