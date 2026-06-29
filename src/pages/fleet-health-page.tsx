import { useMemo } from 'react';
import Header from '../components/layout/Header';
import { useDevices } from '../hooks/useDevices';
import { useRuns } from '../hooks/useRuns';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Smartphone, ShieldCheck } from 'lucide-react';
import { DeviceMetricCard } from '../components/fleet-health/DeviceMetricCard';
import { DeviceGridCard } from '../components/fleet-health/DeviceGridCard';

export default function FleetHealthPage() {
  const { data: devices, isLoading: isLoadingDevices } = useDevices();
  const { data: runs, isLoading: isLoadingRuns } = useRuns();

  const isLoading = isLoadingDevices || isLoadingRuns;

  const fleetStats = useMemo(() => {
    if (!devices) return null;

    const now = new Date().getTime();
    const activeRuns = runs?.filter(r => r.status === 'RUNNING') || [];
    
    let online = 0;
    let offline = 0;
    let warning = 0;
    let executing = 0;
    let stalled = 0;

    const deviceStats = devices.map(device => {
      const lastPing = new Date(device.updated_at).getTime();
      const minutesSincePing = (now - lastPing) / (1000 * 60);
      
      let healthStatus: 'healthy' | 'warning' | 'offline' = 'offline';
      
      if (minutesSincePing < 5) {
        healthStatus = 'healthy';
        online++;
      } else if (minutesSincePing < 15) {
        healthStatus = 'warning';
        warning++;
      } else {
        offline++;
      }

      // Check if device is currently assigned to an active run
      const activeRun = activeRuns.find(r => 
        r.target_type === 'SINGLE_DEVICE' && 
        (r.target_selector_json as { deviceIds?: string[] })?.deviceIds?.includes(device.id)
      );

      let isStalled = false;
      if (activeRun) {
        executing++;
        // If lease is expired but run is still marked RUNNING, it's stalled
        if (activeRun.execution_lease_expires_at) {
          const leaseExpiry = new Date(activeRun.execution_lease_expires_at).getTime();
          if (now > leaseExpiry) {
            isStalled = true;
            stalled++;
          }
        }
      }

      return {
        ...device,
        healthStatus,
        active_run: activeRun,
        isStalled
      };
    });

    return {
      total: devices.length,
      online,
      offline,
      warning,
      executing,
      stalled,
      deviceStats
    };
  }, [devices, runs]);

  return (
    <>
      <Header
        title="Fleet Health"
        subtitle="Monitor device availability and queue stall rates"
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !fleetStats || fleetStats.total === 0 ? (
          <EmptyState
            icon={<Smartphone className="w-6 h-6" />}
            title="No devices found"
            description="Add devices to your fleet to monitor their health."
          />
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Top Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DeviceMetricCard 
                title="Total Devices" 
                value={fleetStats.total} 
                icon="Smartphone" 
                color="blue" 
                subtitle={`${fleetStats.online} online`}
              />
              <DeviceMetricCard 
                title="Active Execution" 
                value={fleetStats.executing} 
                icon="PlayCircle" 
                color="emerald" 
                subtitle={`${Math.round((fleetStats.executing / fleetStats.total) * 100)}% utilization`}
              />
              <DeviceMetricCard 
                title="Warning State" 
                value={fleetStats.warning} 
                icon="Activity" 
                color="amber" 
                subtitle="High latency"
              />
              <DeviceMetricCard 
                title="Stalled Queues" 
                value={fleetStats.stalled} 
                icon="AlertTriangle" 
                color={fleetStats.stalled > 0 ? "red" : "emerald"} 
                subtitle="Expired leases"
              />
            </div>

            {/* Device Grid */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                Fleet Telemetry
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {fleetStats.deviceStats.map((device) => (
                  <DeviceGridCard 
                    key={device.id} 
                    device={device} 
                    healthStatus={device.healthStatus} 
                    isStalled={device.isStalled} 
                  />
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
