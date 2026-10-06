export interface DeviceQuarantineConfig {
  consecutiveFailureThreshold: number; // e.g. 3 consecutive failures
  quarantineCooldownMs: number; // e.g. 15 minutes
}

export const DEFAULT_QUARANTINE_CONFIG: DeviceQuarantineConfig = {
  consecutiveFailureThreshold: 3,
  quarantineCooldownMs: 15 * 60 * 1000,
};

export interface DeviceQuarantineState {
  deviceId: string;
  consecutiveFailures: number;
  isQuarantined: boolean;
  quarantinedAt?: string;
  reason?: string;
}

/**
 * Circuit breaker that tracks run/step failures per physical device.
 * When a device fails N times consecutively (e.g. 3 times), it is automatically
 * quarantined to prevent repeated failing dispatches and allow hardware recovery.
 */
export class DeviceQuarantineCircuitBreaker {
  private failureCounts = new Map<string, number>();
  private quarantineTimestamps = new Map<string, number>();
  private quarantineReasons = new Map<string, string>();

  constructor(private readonly config: DeviceQuarantineConfig = DEFAULT_QUARANTINE_CONFIG) {}

  recordSuccess(deviceId: string): void {
    this.failureCounts.set(deviceId, 0);
    this.quarantineTimestamps.delete(deviceId);
    this.quarantineReasons.delete(deviceId);
  }

  recordFailure(deviceId: string, reason = 'Repeated run failures'): DeviceQuarantineState {
    const current = (this.failureCounts.get(deviceId) ?? 0) + 1;
    this.failureCounts.set(deviceId, current);

    if (current >= this.config.consecutiveFailureThreshold) {
      if (!this.quarantineTimestamps.has(deviceId)) {
        this.quarantineTimestamps.set(deviceId, Date.now());
        this.quarantineReasons.set(
          deviceId,
          `${reason} (${current}/${this.config.consecutiveFailureThreshold} failures)`
        );
      }
    }

    return this.getState(deviceId);
  }

  getState(deviceId: string): DeviceQuarantineState {
    const failures = this.failureCounts.get(deviceId) ?? 0;
    const quarantinedAtMs = this.quarantineTimestamps.get(deviceId);

    if (!quarantinedAtMs) {
      return {
        deviceId,
        consecutiveFailures: failures,
        isQuarantined: false,
      };
    }

    // Check if cooldown has expired
    const elapsed = Date.now() - quarantinedAtMs;
    if (elapsed > this.config.quarantineCooldownMs) {
      // Cooldown expired, clear quarantine
      this.quarantineTimestamps.delete(deviceId);
      this.quarantineReasons.delete(deviceId);
      return {
        deviceId,
        consecutiveFailures: failures,
        isQuarantined: false,
      };
    }

    return {
      deviceId,
      consecutiveFailures: failures,
      isQuarantined: true,
      quarantinedAt: new Date(quarantinedAtMs).toISOString(),
      reason: this.quarantineReasons.get(deviceId),
    };
  }

  liftQuarantine(deviceId: string): void {
    this.recordSuccess(deviceId);
  }

  clear(): void {
    this.failureCounts.clear();
    this.quarantineTimestamps.clear();
    this.quarantineReasons.clear();
  }
}

export const globalDeviceQuarantineCircuitBreaker = new DeviceQuarantineCircuitBreaker();
