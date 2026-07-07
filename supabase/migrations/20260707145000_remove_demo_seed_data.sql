/*
  Remove legacy demo seed rows from fresh and migrated environments.

  These rows were useful during early UI prototyping, but the current use
  cases expect real Mobile MCP/ADB-discovered devices and admin-managed
  execution profiles rather than simulated Laixi devices or no-approval demos.
*/

DELETE FROM device_group_members
WHERE device_id IN (
  SELECT id FROM devices
  WHERE laixi_device_id IN (
    'laixi_pixel7pro_001',
    'laixi_galaxy_s23_002',
    'laixi_oneplus11_003',
    'laixi_xiaomi13_004'
  )
)
OR device_group_id IN (
  SELECT id FROM device_groups
  WHERE name IN ('Production Fleet', 'Testing Phones')
);

DELETE FROM device_groups
WHERE name IN ('Production Fleet', 'Testing Phones');

DELETE FROM devices
WHERE laixi_device_id IN (
  'laixi_pixel7pro_001',
  'laixi_galaxy_s23_002',
  'laixi_oneplus11_003',
  'laixi_xiaomi13_004'
);

DELETE FROM execution_profiles
WHERE name = 'Fast - No Approval'
  AND description = 'Fast execution profile for demos. No approval required for ADB or AutoX commands.';
