/*
  # Seed Demo Data

  1. Data Inserted
    - 4 Android devices (simulated Laixi-connected phones)
      - Pixel 7 Pro (ONLINE)
      - Samsung Galaxy S23 (ONLINE)
      - OnePlus 11 (OFFLINE)
      - Xiaomi 13 (BUSY)
    - 2 Device Groups
      - "Production Fleet" containing Pixel 7 Pro and Galaxy S23
      - "Testing Phones" containing OnePlus 11 and Xiaomi 13
    - 1 Execution Profile
      - "Fast - No Approval" for demo runs without approval gates

  2. Notes
    - Macros, macro versions, and workflow runs require a real user profile
      (created_by_user_id FK to profiles). Those are seeded via the UI
      "Seed Sample Macros" button after first login.
    - Devices are inserted with realistic metadata (battery, charging status)
    - The seed is idempotent using ON CONFLICT DO NOTHING
*/

-- Seed devices
INSERT INTO devices (laixi_device_id, name, model, brand, android_version, screen_width, screen_height, status, last_seen_at, metadata_json)
VALUES
  ('laixi_pixel7pro_001', 'Pixel 7 Pro #1', 'Pixel 7 Pro', 'Google', '14.0', 1440, 3120, 'ONLINE', now(), '{"batteryLevel": 87, "isCharging": false, "wifiSSID": "LabNetwork-5G", "imei": "353456789012345"}'),
  ('laixi_galaxy_s23_002', 'Galaxy S23 #2', 'Galaxy S23', 'Samsung', '14.0', 1080, 2340, 'ONLINE', now(), '{"batteryLevel": 62, "isCharging": true, "wifiSSID": "LabNetwork-5G", "imei": "353456789012346"}'),
  ('laixi_oneplus11_003', 'OnePlus 11 #3', 'OnePlus 11', 'OnePlus', '13.0', 1440, 3216, 'OFFLINE', now() - interval '2 hours', '{"batteryLevel": 15, "isCharging": false, "wifiSSID": null, "imei": "353456789012347"}'),
  ('laixi_xiaomi13_004', 'Xiaomi 13 #4', 'Xiaomi 13', 'Xiaomi', '13.0', 1080, 2400, 'BUSY', now(), '{"batteryLevel": 44, "isCharging": false, "wifiSSID": "LabNetwork-5G", "imei": "353456789012348"}')
ON CONFLICT (laixi_device_id) DO NOTHING;

-- Seed device groups
INSERT INTO device_groups (name, description)
VALUES
  ('Production Fleet', 'Primary devices used for production workflow runs'),
  ('Testing Phones', 'Devices reserved for testing and QA workflows')
ON CONFLICT (name) DO NOTHING;

-- Seed device group members (link devices to groups)
DO $$
DECLARE
  v_pixel_id uuid;
  v_galaxy_id uuid;
  v_oneplus_id uuid;
  v_xiaomi_id uuid;
  v_prod_group_id uuid;
  v_test_group_id uuid;
BEGIN
  SELECT id INTO v_pixel_id FROM devices WHERE laixi_device_id = 'laixi_pixel7pro_001';
  SELECT id INTO v_galaxy_id FROM devices WHERE laixi_device_id = 'laixi_galaxy_s23_002';
  SELECT id INTO v_oneplus_id FROM devices WHERE laixi_device_id = 'laixi_oneplus11_003';
  SELECT id INTO v_xiaomi_id FROM devices WHERE laixi_device_id = 'laixi_xiaomi13_004';
  SELECT id INTO v_prod_group_id FROM device_groups WHERE name = 'Production Fleet';
  SELECT id INTO v_test_group_id FROM device_groups WHERE name = 'Testing Phones';

  IF v_pixel_id IS NOT NULL AND v_prod_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_prod_group_id, v_pixel_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_galaxy_id IS NOT NULL AND v_prod_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_prod_group_id, v_galaxy_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_oneplus_id IS NOT NULL AND v_test_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_test_group_id, v_oneplus_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;

  IF v_xiaomi_id IS NOT NULL AND v_test_group_id IS NOT NULL THEN
    INSERT INTO device_group_members (device_group_id, device_id)
    VALUES (v_test_group_id, v_xiaomi_id)
    ON CONFLICT (device_group_id, device_id) DO NOTHING;
  END IF;
END $$;

-- Seed a fast execution profile (no approval gates, for demo)
INSERT INTO execution_profiles (name, description, concurrency_per_device, default_timeout_ms, max_retries, require_approval_for_adb, require_approval_for_autox)
VALUES (
  'Fast - No Approval',
  'Fast execution profile for demos. No approval required for ADB or AutoX commands.',
  1,
  15000,
  1,
  false,
  false
)
ON CONFLICT DO NOTHING;
