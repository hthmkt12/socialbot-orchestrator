/*
  # Extend Demo Macros Seeding Function

  ## Summary
  This migration replaces the `seed_demo_macros()` function to seed all 10 canonical sample macros
  instead of just 3. The function is idempotent and uses macro `key` as the stable unique identifier.

  ## Changes
  1. **Function Replacement**
     - Replaces existing `seed_demo_macros()` function
     - Extends from 3 macros to 10 comprehensive samples
     - Maintains idempotent behavior (safe to run multiple times)

  2. **10 Sample Macros Included**
     - `launch_app_and_capture` - Basic app launch, wait, screenshot, get current app
     - `input_text_demo` - App launch, tap input field, enter text, screenshot
     - `open_and_swipe_feed` - Launch app and swipe feed multiple times
     - `current_app_guard` - Conditional flow based on current app validation
     - `multi_device_launch_check` - Multi-device batch execution demo
     - `approval_before_adb` - Approval checkpoint before ADB command
     - `run_autox_with_approval` - AutoX.js script execution with approval
     - `settings_smoke_test` - System settings smoke test with validation
     - `simple_form_fill_demo` - Multi-field form filling demonstration
     - `grouped_demo_sequence` - Grouped step execution pattern

  3. **Upsert Logic**
     - Uses macro `key` for stable identification
     - Updates existing macros safely
     - Creates new macro versions consistently
     - Marks latest version as ACTIVE
     - Links macro.latest_version_id correctly

  4. **Return Value**
     - Returns JSON summary with inserted and updated counts
     - Provides audit trail of seeding operation

  ## Notes
  - All macro definitions use canonical JSON format
  - Existing macros are preserved and updated
  - Frontend "Load Samples" button continues to work
  - Safe to run multiple times without duplicates
*/

CREATE OR REPLACE FUNCTION seed_demo_macros()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid;
  inserted_count int := 0;
  updated_count int := 0;
  macro_record record;
  version_record record;
  macro_data jsonb;
  all_macros jsonb[];
BEGIN
  -- Get admin user (first user with ADMIN role)
  SELECT id INTO admin_user_id
  FROM users
  WHERE role = 'ADMIN'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create an admin user first.';
  END IF;

  -- Define all 10 sample macros
  all_macros := ARRAY[
    -- 1. Launch App And Capture
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Mở app, chờ vài giây, chụp màn hình, lấy app hiện tại',
      'tags', jsonb_build_array('basic', 'screenshot', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'launch_app_and_capture',
          'name', 'Launch App And Capture',
          'description', 'Mở app, chờ vài giây, chụp màn hình, lấy app hiện tại',
          'tags', jsonb_build_array('basic', 'screenshot', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 10000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object())
        )
      )
    ),
    -- 2. Input Text Demo
    jsonb_build_object(
      'key', 'input_text_demo',
      'name', 'Input Text Demo',
      'description', 'Mở app, chạm vùng nhập, nhập text, chụp màn hình',
      'tags', jsonb_build_array('input', 'demo', 'ui'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'input_text_demo',
          'name', 'Input Text Demo',
          'description', 'Mở app, chạm vùng nhập, nhập text, chụp màn hình',
          'tags', jsonb_build_array('input', 'demo', 'ui')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'textValue', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.3)),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 800)),
          jsonb_build_object('id', 'input_1', 'type', 'input_text', 'params', jsonb_build_object('text', '{{textValue}}')),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 3. Open And Swipe Feed
    jsonb_build_object(
      'key', 'open_and_swipe_feed',
      'name', 'Open And Swipe Feed',
      'description', 'Mở app và cuộn feed vài lần để kiểm tra UI',
      'tags', jsonb_build_array('swipe', 'feed', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'open_and_swipe_feed',
          'name', 'Open And Swipe Feed',
          'description', 'Mở app và cuộn feed vài lần để kiểm tra UI',
          'tags', jsonb_build_array('swipe', 'feed', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'swipe_1', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.8, 'toX', 0.5, 'toY', 0.25)),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
          jsonb_build_object('id', 'swipe_2', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.8, 'toX', 0.5, 'toY', 0.25)),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 4. Current App Guard
    jsonb_build_object(
      'key', 'current_app_guard',
      'name', 'Current App Guard',
      'description', 'Kiểm tra app hiện tại, nếu đúng thì chụp màn hình, sai thì dừng',
      'tags', jsonb_build_array('guard', 'conditional', 'validation'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'current_app_guard',
          'name', 'Current App Guard',
          'description', 'Kiểm tra app hiện tại, nếu đúng thì chụp màn hình, sai thì dừng',
          'tags', jsonb_build_array('guard', 'conditional', 'validation')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'expectedPackage', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object(
            'id', 'if_1',
            'type', 'conditional',
            'params', jsonb_build_object('left', '{{steps.current_1.output.appPackage}}', 'operator', 'equals', 'right', '{{expectedPackage}}'),
            'then', jsonb_build_array(
              jsonb_build_object('id', 'screen_ok', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
            ),
            'else', jsonb_build_array(
              jsonb_build_object('id', 'stop_fail', 'type', 'stop', 'params', jsonb_build_object('reason', 'Current package does not match expectedPackage'))
            )
          )
        )
      )
    ),
    -- 5. Multi Device Launch Check
    jsonb_build_object(
      'key', 'multi_device_launch_check',
      'name', 'Multi Device Launch Check',
      'description', 'Chạy cùng một flow trên nhiều thiết bị',
      'tags', jsonb_build_array('multi-device', 'batch', 'monitoring'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'multi_device_launch_check',
          'name', 'Multi Device Launch Check',
          'description', 'Chạy cùng một flow trên nhiều thiết bị',
          'tags', jsonb_build_array('multi-device', 'batch', 'monitoring')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'multi_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'continue'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object())
        )
      )
    ),
    -- 6. Approval Before ADB
    jsonb_build_object(
      'key', 'approval_before_adb',
      'name', 'Approval Before ADB',
      'description', 'Yêu cầu phê duyệt trước khi chạy lệnh ADB',
      'tags', jsonb_build_array('approval', 'adb', 'sensitive'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'approval_before_adb',
          'name', 'Approval Before ADB',
          'description', 'Yêu cầu phê duyệt trước khi chạy lệnh ADB',
          'tags', jsonb_build_array('approval', 'adb', 'sensitive')
        ),
        'inputs', jsonb_build_object(
          'adbCommand', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 20000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'approval_1', 'type', 'approval_checkpoint', 'params', jsonb_build_object('reason', 'ADB command requires manual approval')),
          jsonb_build_object('id', 'adb_1', 'type', 'adb', 'params', jsonb_build_object('command', '{{adbCommand}}'), 'policy', jsonb_build_object('requiresApproval', true)),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 7. Run AutoX With Approval
    jsonb_build_object(
      'key', 'run_autox_with_approval',
      'name', 'Run AutoX With Approval',
      'description', 'Chạy AutoX.js sau khi được phê duyệt',
      'tags', jsonb_build_array('autox', 'approval', 'script'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'run_autox_with_approval',
          'name', 'Run AutoX With Approval',
          'description', 'Chạy AutoX.js sau khi được phê duyệt',
          'tags', jsonb_build_array('autox', 'approval', 'script')
        ),
        'inputs', jsonb_build_object(
          'filePath', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 30000, 'maxRetries', 0, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'approval_1', 'type', 'approval_checkpoint', 'params', jsonb_build_object('reason', 'Execute AutoX.js requires manual review')),
          jsonb_build_object('id', 'autox_1', 'type', 'run_autox', 'params', jsonb_build_object('filePath', '{{filePath}}'), 'policy', jsonb_build_object('requiresApproval', true)),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 4000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 8. Settings Smoke Test
    jsonb_build_object(
      'key', 'settings_smoke_test',
      'name', 'Settings Smoke Test',
      'description', 'Mở Settings, kiểm tra package đúng, chụp màn hình',
      'tags', jsonb_build_array('settings', 'smoke-test', 'qa'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'settings_smoke_test',
          'name', 'Settings Smoke Test',
          'description', 'Mở Settings, kiểm tra package đúng, chụp màn hình',
          'tags', jsonb_build_array('settings', 'smoke-test', 'qa')
        ),
        'inputs', jsonb_build_object(),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 12000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', 'settings')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object(
            'id', 'if_1',
            'type', 'conditional',
            'params', jsonb_build_object('left', '{{steps.current_1.output.appPackage}}', 'operator', 'contains', 'right', 'settings'),
            'then', jsonb_build_array(
              jsonb_build_object('id', 'screen_ok', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
            ),
            'else', jsonb_build_array(
              jsonb_build_object('id', 'stop_fail', 'type', 'stop', 'params', jsonb_build_object('reason', 'Settings app was not detected'))
            )
          )
        )
      )
    ),
    -- 9. Simple Form Fill Demo
    jsonb_build_object(
      'key', 'simple_form_fill_demo',
      'name', 'Simple Form Fill Demo',
      'description', 'Điền 2 ô nhập liệu demo rồi chụp màn hình',
      'tags', jsonb_build_array('form', 'input', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'simple_form_fill_demo',
          'name', 'Simple Form Fill Demo',
          'description', 'Điền 2 ô nhập liệu demo rồi chụp màn hình',
          'tags', jsonb_build_array('form', 'input', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true),
          'firstValue', jsonb_build_object('type', 'string', 'required', true),
          'secondValue', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 15000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
          jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 3000)),
          jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.28)),
          jsonb_build_object('id', 'input_1', 'type', 'input_text', 'params', jsonb_build_object('text', '{{firstValue}}')),
          jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 700)),
          jsonb_build_object('id', 'tap_2', 'type', 'tap', 'params', jsonb_build_object('x', 0.5, 'y', 0.42)),
          jsonb_build_object('id', 'input_2', 'type', 'input_text', 'params', jsonb_build_object('text', '{{secondValue}}')),
          jsonb_build_object('id', 'wait_3', 'type', 'wait', 'params', jsonb_build_object('ms', 1000)),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    ),
    -- 10. Grouped Demo Sequence
    jsonb_build_object(
      'key', 'grouped_demo_sequence',
      'name', 'Grouped Demo Sequence',
      'description', 'Macro nhóm step: mở app, thao tác nhẹ, chụp màn hình',
      'tags', jsonb_build_array('group', 'sequence', 'demo'),
      'definition', jsonb_build_object(
        'version', 1,
        'meta', jsonb_build_object(
          'key', 'grouped_demo_sequence',
          'name', 'Grouped Demo Sequence',
          'description', 'Macro nhóm step: mở app, thao tác nhẹ, chụp màn hình',
          'tags', jsonb_build_array('group', 'sequence', 'demo')
        ),
        'inputs', jsonb_build_object(
          'appName', jsonb_build_object('type', 'string', 'required', true)
        ),
        'target', jsonb_build_object('mode', 'single_device'),
        'execution', jsonb_build_object('defaultTimeoutMs', 20000, 'maxRetries', 1, 'onError', 'stop'),
        'steps', jsonb_build_array(
          jsonb_build_object(
            'id', 'group_1',
            'type', 'group',
            'params', jsonb_build_object('name', 'launch_and_navigate'),
            'steps', jsonb_build_array(
              jsonb_build_object('id', 'launch_1', 'type', 'launch_app', 'params', jsonb_build_object('appName', '{{appName}}')),
              jsonb_build_object('id', 'wait_1', 'type', 'wait', 'params', jsonb_build_object('ms', 2500)),
              jsonb_build_object('id', 'tap_1', 'type', 'tap', 'params', jsonb_build_object('x', 0.85, 'y', 0.92)),
              jsonb_build_object('id', 'wait_2', 'type', 'wait', 'params', jsonb_build_object('ms', 1200)),
              jsonb_build_object('id', 'swipe_1', 'type', 'swipe', 'params', jsonb_build_object('fromX', 0.5, 'fromY', 0.75, 'toX', 0.5, 'toY', 0.35))
            )
          ),
          jsonb_build_object('id', 'current_1', 'type', 'get_current_app', 'params', jsonb_build_object()),
          jsonb_build_object('id', 'screen_1', 'type', 'screenshot', 'params', jsonb_build_object('saveToArtifact', true))
        )
      )
    )
  ];

  -- Process each macro
  FOREACH macro_data IN ARRAY all_macros
  LOOP
    -- Upsert macro by key
    INSERT INTO macros (key, name, description, created_by_user_id, created_at, updated_at)
    VALUES (
      macro_data->>'key',
      macro_data->>'name',
      macro_data->>'description',
      admin_user_id,
      now(),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING * INTO macro_record;

    -- Check if this is a new macro or update
    IF macro_record.created_at >= now() - interval '1 second' THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

    -- Upsert macro version (version 1)
    INSERT INTO macro_versions (
      macro_id,
      version_number,
      status,
      definition_json,
      input_schema_json,
      tags_json,
      created_by_user_id,
      created_at
    )
    VALUES (
      macro_record.id,
      1,
      'ACTIVE',
      macro_data->'definition',
      macro_data->'definition'->'inputs',
      macro_data->'tags',
      admin_user_id,
      now()
    )
    ON CONFLICT (macro_id, version_number) DO UPDATE
    SET
      status = 'ACTIVE',
      definition_json = EXCLUDED.definition_json,
      input_schema_json = EXCLUDED.input_schema_json,
      tags_json = EXCLUDED.tags_json
    RETURNING * INTO version_record;

    -- Update macro's latest_version_id
    UPDATE macros
    SET latest_version_id = version_record.id
    WHERE id = macro_record.id;
  END LOOP;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count,
    'timestamp', now()
  );
END;
$$;