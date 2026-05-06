import type { DeviceFreshness, DeviceLifecycleStatus } from '../../../packages/shared/src';

export interface PersistedDeviceHealthPatch {
  laixiDeviceId: string;
  deviceName?: string;
  status: DeviceLifecycleStatus;
  heartbeatFreshness: DeviceFreshness;
  lastSeenAt?: string | null;
  lastErrorMessage?: string | null;
  lastErrorAt?: string | null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export class GatewayDeviceStateStore {
  private readonly restBaseUrl: string | null;

  constructor(
    supabaseUrl?: string,
    private readonly serviceRoleKey?: string
  ) {
    this.restBaseUrl = supabaseUrl ? `${trimTrailingSlash(supabaseUrl)}/rest/v1` : null;
  }

  isEnabled() {
    return Boolean(this.restBaseUrl && this.serviceRoleKey);
  }

  async upsertDeviceHealth(patch: PersistedDeviceHealthPatch) {
    if (!this.restBaseUrl || !this.serviceRoleKey) return;

    const payload: Record<string, unknown> = {
      laixi_device_id: patch.laixiDeviceId,
      status: patch.status,
      heartbeat_freshness: patch.heartbeatFreshness,
      updated_at: new Date().toISOString(),
    };

    if (patch.deviceName !== undefined) payload.name = patch.deviceName;
    if (patch.lastSeenAt !== undefined) payload.last_seen_at = patch.lastSeenAt;
    if (patch.lastErrorMessage !== undefined) payload.last_error_message = patch.lastErrorMessage;
    if (patch.lastErrorAt !== undefined) payload.last_error_at = patch.lastErrorAt;

    const response = await fetch(`${this.restBaseUrl}/devices?on_conflict=laixi_device_id`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return;

    const message = await response.text();
    throw new Error(message || `Failed to persist device health for ${patch.laixiDeviceId}`);
  }
}
