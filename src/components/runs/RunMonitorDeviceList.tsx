import type { DeviceStatus } from './run-monitor-types';
import { RunMonitorDeviceCard } from './run-monitor-device-sections';

interface RunMonitorDeviceListProps {
  deviceStatuses: DeviceStatus[];
  expandedDevice: string | null;
  expandedSteps: Set<string>;
  onToggleDevice: (deviceId: string) => void;
  onToggleStep: (stepId: string) => void;
}

export function RunMonitorDeviceList(props: RunMonitorDeviceListProps) {
  return (
    <div className="space-y-4">
      {props.deviceStatuses.map((deviceStatus) => (
        <RunMonitorDeviceCard
          key={deviceStatus.device.id}
          deviceStatus={deviceStatus}
          expanded={props.expandedDevice === deviceStatus.device.id}
          expandedSteps={props.expandedSteps}
          onToggleDevice={props.onToggleDevice}
          onToggleStep={props.onToggleStep}
        />
      ))}
    </div>
  );
}
