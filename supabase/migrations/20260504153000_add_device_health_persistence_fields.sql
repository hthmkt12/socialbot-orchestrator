ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS heartbeat_freshness text NOT NULL DEFAULT 'offline'
    CHECK (heartbeat_freshness IN ('fresh', 'stale', 'offline')),
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

UPDATE public.devices
SET heartbeat_freshness = CASE
  WHEN status = 'OFFLINE' OR last_seen_at IS NULL THEN 'offline'
  ELSE 'fresh'
END
WHERE heartbeat_freshness = 'offline';

CREATE INDEX IF NOT EXISTS idx_devices_heartbeat_freshness ON public.devices(heartbeat_freshness);
