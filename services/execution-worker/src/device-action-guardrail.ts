export interface DeviceDailyActionBudgetConfig {
  defaultDailyLimit: number;
}

export const DEFAULT_DEVICE_DAILY_ACTION_LIMIT = 500;

export interface DeviceActionUsageRecord {
  deviceId: string;
  count: number;
  dateString: string; // YYYY-MM-DD
}

export interface DeviceActionGuardrailCheck {
  allowed: boolean;
  deviceId: string;
  currentCount: number;
  dailyLimit: number;
  remaining: number;
  reason?: string;
}

/**
 * In-memory / stateless helper to check and record daily action counts per device.
 */
export class DeviceActionGuardrail {
  private dailyCounts = new Map<string, number>();

  constructor(private readonly defaultDailyLimit = DEFAULT_DEVICE_DAILY_ACTION_LIMIT) {}

  private getBucketKey(deviceId: string, date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${deviceId}:${yyyy}-${mm}-${dd}`;
  }

  getUsage(deviceId: string, customLimit?: number, date: Date = new Date()): DeviceActionGuardrailCheck {
    const limit = customLimit && customLimit > 0 ? customLimit : this.defaultDailyLimit;
    const key = this.getBucketKey(deviceId, date);
    const currentCount = this.dailyCounts.get(key) ?? 0;
    const remaining = Math.max(0, limit - currentCount);
    const allowed = currentCount < limit;

    return {
      allowed,
      deviceId,
      currentCount,
      dailyLimit: limit,
      remaining,
      reason: allowed
        ? undefined
        : `Device ${deviceId} exceeded daily action rate limit (${currentCount}/${limit}).`,
    };
  }

  recordAction(deviceId: string, date: Date = new Date()): number {
    const key = this.getBucketKey(deviceId, date);
    const next = (this.dailyCounts.get(key) ?? 0) + 1;
    this.dailyCounts.set(key, next);
    return next;
  }

  reset(deviceId?: string): void {
    if (deviceId) {
      for (const key of this.dailyCounts.keys()) {
        if (key.startsWith(`${deviceId}:`)) {
          this.dailyCounts.delete(key);
        }
      }
    } else {
      this.dailyCounts.clear();
    }
  }
}

export const globalDeviceActionGuardrail = new DeviceActionGuardrail();
