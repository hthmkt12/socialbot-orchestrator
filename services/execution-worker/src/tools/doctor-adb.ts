import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface AdbDevice {
  serial: string;
  state: string;
  detail: string;
}

void main().catch((error) => {
  console.error('[doctor:adb] FAIL', error);
  process.exit(1);
});

async function main() {
  const before = await collectSignals();
  printReport('before', before);

  if (shouldRunRecovery(before.adbDevices)) {
    console.log('[doctor:adb] recovery: adb kill-server && adb start-server');
    await runCommand('adb', ['kill-server']);
    await startAdbServerDetached();
    const after = await collectSignals();
    printReport('after', after);
  }
}

async function collectSignals() {
  const [adbDevicesRaw, adbVersion, usbipdRaw, pnpRaw] = await Promise.all([
    runCommand('adb', ['devices', '-l']),
    runCommand('adb', ['version']),
    runCommand('usbipd', ['list']),
    runPowerShell(`
      Get-PnpDevice -PresentOnly |
        Where-Object {
          $_.InstanceId -match 'VID_04E8|VID_2717' -or
          $_.FriendlyName -match 'ADB|Android|Redmi|Xiaomi|MTP|SAMSUNG Mobile'
        } |
        Select-Object Status,Class,FriendlyName,InstanceId |
        ConvertTo-Json -Depth 4
    `),
  ]);

  return {
    adbDevicesRaw,
    adbDevices: parseAdbDevices(adbDevicesRaw.stdout),
    adbVersion: firstLine(adbVersion.stdout),
    usbipdRaw,
    androidUsbRows: filterInterestingUsbRows(usbipdRaw.stdout),
    pnpRaw,
  };
}

function printReport(label: string, signals: Awaited<ReturnType<typeof collectSignals>>) {
  console.log(`\n[doctor:adb] === ${label} ===`);
  console.log(`[doctor:adb] adb: ${signals.adbVersion || signals.adbDevicesRaw.error || 'not found'}`);
  console.log(`[doctor:adb] adb devices: ${signals.adbDevices.length}`);
  for (const device of signals.adbDevices) {
    console.log(`[doctor:adb] - ${device.serial} ${device.state} ${device.detail}`.trim());
  }
  if (signals.adbDevices.length === 0) console.log('[doctor:adb] - no ADB transports');

  console.log(`[doctor:adb] usbipd android rows: ${signals.androidUsbRows.length}`);
  for (const row of signals.androidUsbRows) console.log(`[doctor:adb] - ${row}`);
  if (signals.usbipdRaw.stderr.trim()) console.log(`[doctor:adb] usbipd stderr: ${signals.usbipdRaw.stderr.trim()}`);

  const pnp = signals.pnpRaw.stdout.trim();
  console.log(`[doctor:adb] pnp android/usb rows: ${pnp ? 'present' : 'none'}`);
  if (pnp) console.log(pnp);

  console.log(`[doctor:adb] diagnosis: ${diagnose(signals.adbDevices, signals.androidUsbRows, pnp)}`);
}

function diagnose(adbDevices: AdbDevice[], usbRows: string[], pnp: string) {
  if (adbDevices.some((device) => device.state === 'device')) return 'ADB online. Ready for Mobile MCP.';
  if (adbDevices.some((device) => device.state === 'unauthorized')) return 'ADB unauthorized. Unlock phone and accept RSA prompt.';
  if (adbDevices.some((device) => device.state === 'offline')) return 'ADB offline. Replug cable, then accept RSA prompt if shown.';
  if (usbRows.length > 0 || pnp) return 'Windows sees Android USB, but ADB has no online transport. Check USB debugging / driver / RSA prompt.';
  return 'Windows does not see an Android USB device. Check cable, port, USB mode, or phone unlock state.';
}

function shouldRunRecovery(adbDevices: AdbDevice[]) {
  return adbDevices.length === 0 || adbDevices.some((device) => device.state !== 'device');
}

function parseAdbDevices(stdout: string): AdbDevice[] {
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial = '', state = '', ...rest] = line.split(/\s+/);
      return { serial, state, detail: rest.join(' ') };
    })
    .filter((device) => device.serial && device.state);
}

function filterInterestingUsbRows(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /04e8|2717|Samsung|SAMSUNG|Redmi|Xiaomi|Android|ADB/i.test(line));
}

function firstLine(value: string) {
  return value.split(/\r?\n/).find(Boolean) ?? '';
}

async function runCommand(command: string, args: string[]) {
  try {
    const result = await execFileAsync(command, args, { windowsHide: true, timeout: 15_000 });
    return { stdout: result.stdout, stderr: result.stderr, error: null as string | null };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', error: err.message ?? String(error) };
  }
}

function runPowerShell(command: string) {
  return runCommand('powershell.exe', ['-NoProfile', '-Command', command]);
}

async function startAdbServerDetached() {
  await runPowerShell('Start-Process -FilePath adb -ArgumentList start-server -WindowStyle Hidden; Start-Sleep -Seconds 2');
}
