import pino from 'pino';

/** Structured logger for execution-worker. */
export const logger = pino({
  name: 'execution-worker',
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
    formatters: { level: (label: string) => ({ level: label }) },
  }),
});

/** Create a child logger scoped to a run, device, or request. */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
