import fs from 'node:fs';
import path from 'node:path';
import { globalDeviceActionGuardrail } from './device-action-guardrail.js';
import { globalDeviceQuarantineCircuitBreaker } from './device-quarantine-circuit-breaker.js';
import { logger } from './logger.js';

export interface WorkerStatePayload {
  version: 1;
  updatedAt: string;
  guardrails: Record<string, number>;
  circuitBreaker: {
    failureCounts: Record<string, number>;
    quarantineTimestamps: Record<string, number>;
    quarantineReasons: Record<string, string>;
  };
}

const DEFAULT_STATE_FILE_PATH = path.resolve(
  process.env.WORKER_STATE_FILE || './.worker-state.json'
);

export class WorkerStatePersistence {
  constructor(private readonly filePath = DEFAULT_STATE_FILE_PATH) {}

  saveState(): boolean {
    try {
      const payload: WorkerStatePayload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        guardrails: globalDeviceActionGuardrail.dumpSnapshot(),
        circuitBreaker: globalDeviceQuarantineCircuitBreaker.dumpSnapshot(),
      };

      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf-8');
      return true;
    } catch (err) {
      logger.warn({ err, path: this.filePath }, 'failed to persist worker state');
      return false;
    }
  }

  loadState(): boolean {
    try {
      if (!fs.existsSync(this.filePath)) {
        return false;
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const payload = JSON.parse(raw) as Partial<WorkerStatePayload>;

      if (payload.guardrails) {
        globalDeviceActionGuardrail.restoreSnapshot(payload.guardrails);
      }

      if (payload.circuitBreaker) {
        globalDeviceQuarantineCircuitBreaker.restoreSnapshot(payload.circuitBreaker);
      }

      logger.info({ path: this.filePath }, 'restored worker guardrail and quarantine state');
      return true;
    } catch (err) {
      logger.warn({ err, path: this.filePath }, 'failed to load persisted worker state');
      return false;
    }
  }
}

export const globalWorkerStatePersistence = new WorkerStatePersistence();
