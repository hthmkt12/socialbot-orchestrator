export {
  EMPTY_VERIFICATION,
  fetchDeviceSetupVerificationSnapshot as fetchDeviceSetupVerification,
  type VerificationSnapshot,
} from './device-setup-verification-snapshot';
export {
  runDeviceSetupProbe,
  selectAvailableDeviceId,
} from './device-setup-verification-probe-helpers';
import { supabase } from '../../lib/supabase';

export const deleteExpiredDeviceLocks = async (): Promise<number> => {
  const { data, error } = await supabase
    .from('device_locks')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
};
