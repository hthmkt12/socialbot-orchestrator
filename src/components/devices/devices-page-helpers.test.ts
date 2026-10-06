import { describe, expect, it } from 'vitest';
import {
  buildDeviceCards,
  filterDeviceCards,
  getDispatchRiskDevices,
} from './devices-page-helpers';
import type { Device } from '../../lib/database.types';
import type { DeviceLockSnapshot } from '../../lib/device-locks';

const mockDevice: Device = {
  id: 'dev-1',
  name: 'Pixel 6',
  model: 'Pixel 6',
  brand: 'Google',
  android_version: '13',
  screen_width: 1080,
  screen_height: 2400,
  status: 'ONLINE',
  laixi_device_id: 'laixi-dev-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  last_error_message: null,
  last_error_at: null,
  heartbeat_freshness: 'fresh',
  metadata_json: {},
};

const emptyLockSnapshot: DeviceLockSnapshot = {
  activeLocks: [],
  expiredLocks: [],
  activeByDeviceId: new Map(),
  expiredByDeviceId: new Map(),
};

describe('devices-page-helpers quarantine logic', () => {
  it('marks device as quarantined when in quarantinedDeviceIds set', () => {
    const quarantinedIds = new Set(['dev-1']);
    const cards = buildDeviceCards([mockDevice], emptyLockSnapshot, quarantinedIds);
    expect(cards[0].isQuarantined).toBe(true);

    const nonQuarantinedCards = buildDeviceCards([mockDevice], emptyLockSnapshot, new Set());
    expect(nonQuarantinedCards[0].isQuarantined).toBe(false);
  });

  it('filters by QUARANTINED risk filter', () => {
    const quarantinedCards = buildDeviceCards([mockDevice], emptyLockSnapshot, new Set(['dev-1']));
    const normalDevice: Device = { ...mockDevice, id: 'dev-2', name: 'Galaxy S21' };
    const allCards = [
      ...quarantinedCards,
      ...buildDeviceCards([normalDevice], emptyLockSnapshot, new Set()),
    ];

    const filtered = filterDeviceCards({
      deviceCards: allCards,
      riskFilter: 'QUARANTINED',
      search: '',
      statusFilter: 'ALL',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].device.id).toBe('dev-1');
  });

  it('includes quarantined device in dispatch risk devices', () => {
    const cards = buildDeviceCards([mockDevice], emptyLockSnapshot, new Set(['dev-1']));
    const riskDevices = getDispatchRiskDevices(cards);
    expect(riskDevices).toHaveLength(1);
    expect(riskDevices[0].device.id).toBe('dev-1');
  });
});
