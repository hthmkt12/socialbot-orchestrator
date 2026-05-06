export class StepTimeoutError extends Error {
  code = 'STEP_TIMEOUT';

  constructor(
    public stepId: string,
    public timeoutMs: number
  ) {
    super(`Step "${stepId}" timed out after ${timeoutMs}ms`);
    this.name = 'StepTimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  stepId: string,
  timeoutMs: number
): Promise<T> {
  if (timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StepTimeoutError(stepId, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
