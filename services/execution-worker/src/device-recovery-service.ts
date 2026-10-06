import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

export type DeviceRecoveryAction = 'restart_adb' | 'reboot_device' | 'wake_screen';

export interface DeviceRecoveryRequest {
  serial?: string;
  action: DeviceRecoveryAction;
}

export interface DeviceRecoveryResult {
  success: boolean;
  action: DeviceRecoveryAction;
  serial?: string;
  message: string;
  durationMs: number;
}

/**
 * Execute device USB or ADB recovery action.
 */
export async function executeDeviceRecovery(
  request: DeviceRecoveryRequest
): Promise<DeviceRecoveryResult> {
  const start = Date.now();
  const { action, serial } = request;

  logger.info({ action, serial }, 'executing device recovery');

  try {
    switch (action) {
      case 'restart_adb': {
        // Kill and restart ADB daemon
        await execFileAsync('adb', ['kill-server']);
        await execFileAsync('adb', ['start-server']);
        const { stdout } = await execFileAsync('adb', ['devices', '-l']);
        const durationMs = Date.now() - start;
        return {
          success: true,
          action,
          message: `ADB server restarted. Devices attached:\n${stdout.trim()}`,
          durationMs,
        };
      }

      case 'wake_screen': {
        if (!serial) {
          throw new Error('Serial is required for wake_screen');
        }
        // Send KEYCODE_WAKEUP (224) and unlock keyevent (82)
        await execFileAsync('adb', ['-s', serial, 'shell', 'input', 'keyevent', '224']);
        await execFileAsync('adb', ['-s', serial, 'shell', 'input', 'keyevent', '82']);
        const durationMs = Date.now() - start;
        return {
          success: true,
          action,
          serial,
          message: `Device ${serial} screen woken and unlocked.`,
          durationMs,
        };
      }

      case 'reboot_device': {
        if (!serial) {
          throw new Error('Serial is required for reboot_device');
        }
        // Soft reboot Android device via ADB
        await execFileAsync('adb', ['-s', serial, 'reboot']);
        const durationMs = Date.now() - start;
        return {
          success: true,
          action,
          serial,
          message: `Reboot signal sent to device ${serial}. Device is restarting.`,
          durationMs,
        };
      }

      default: {
        const _exhaustiveCheck: never = action;
        throw new Error(`Unsupported recovery action: ${_exhaustiveCheck}`);
      }
    }
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ action, serial, durationMs, err: error }, 'device recovery failed');
    return {
      success: false,
      action,
      serial,
      message,
      durationMs,
    };
  }
}
